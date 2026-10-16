/**
 * What printing does with a project's interactive activities
 *
 * Printing a project renders it the way the browser draws it, which for an interactive activity is
 * a half-played game board rather than an exercise. The user is asked what to do about that, and
 * this is where the answer is carried out.
 *
 * It works on the page model, before anything is rendered: components are dropped, replaced by a
 * printable exercise, or replaced by a pointer into an appendix, and the appendix itself is just
 * another page. Everything downstream — the renderer, the styles, the asset URLs already resolved
 * by `preprocessPages` — carries on as it would for any other document.
 *
 * Nothing here mutates the pages it is given: the caller keeps its own copy intact.
 */

import type { ExportBlock, ExportComponent, ExportPage } from '../interfaces';
import {
    isBlockVisible,
    isComponentVisible,
    isStudentBlock,
    isTeacherOnly,
    isTeacherOnlyBlock,
    visibleWorksheetPages,
} from '../utils/visibility';
import { getWorksheetAdapter } from '../worksheet/adapters/registry';
import { isInteractiveActivity, isNeverPrintable } from '../worksheet/interactiveActivities';
import { escapeText } from '../worksheet/sanitizeHtml';
import type { UnsupportedActivity, WorksheetLabels } from '../worksheet/types';
import { renderActivityFragment, renderActivityHeading, resolveWorksheetLabels } from '../worksheet/WorksheetRenderer';

/** What the user chose to do with the interactive activities. */
export type PrintActivityMode =
    /** Print the document without them. */
    | 'omit'
    /** Print each one as an exercise, where the author put it. */
    | 'in-place'
    /** Leave a pointer in place and print the exercises at the back. */
    | 'appendix'
    /** Print the exercises alone, with none of the project's text. */
    | 'activities-only';

/**
 * The modes that compose a document.
 *
 * `activities-only` is not one of them: it produces the worksheet on its own, through
 * `WorksheetExporter`, so it never reaches this module.
 */
export type DocumentActivityMode = Exclude<PrintActivityMode, 'activities-only'>;

/**
 * Type given to a component whose content has been replaced by printable markup.
 *
 * It is deliberately not a real iDevice: the renderer emits the content as it stands, and the
 * caller keeps this type out of `usedIdevices` so no iDevice script or stylesheet is pulled in for
 * it. Reusing `text` would not work — its `renderView` rewrites the content from stored JSON on
 * load, erasing the exercise.
 *
 * It must also not be named after a class the worksheet itself uses. `IdeviceRenderer` turns a
 * component's type into a class on the wrapper it emits, so a type called `worksheet-activity`
 * would put that class on both the wrapper and the exercise inside it, leaving every selector
 * ambiguous.
 */
export const PRINTABLE_ACTIVITY_TYPE = 'printable-activity';

/** User-visible strings, passed in already translated. */
export interface PrintActivityLabels extends WorksheetLabels {
    /** Title of the appendix page. */
    appendixTitle?: string;
    /** Pointer left where the activity was. `%s` is replaced by the activity's number. */
    appendixReference?: string;
    /** Shown in place of an activity that will not be given a printable form. */
    notAvailable?: string;
}

export interface ApplyActivityModeOptions {
    labels?: PrintActivityLabels;
    /** Translated activity headings keyed by iDevice type, e.g. `{ guess: 'Adivina' }`. */
    ideviceTitles?: Record<string, string>;
    /** Source of randomness for activities that draw questions at random. */
    random?: () => number;
    /** Base URL the iDevice export files are served from, ending in a slash. */
    ideviceBasePath?: string;
    /**
     * Component ids of the activities the user chose to print. The others are left out, as the
     * `omit` mode leaves out all of them. Absent means every one of them is printed.
     */
    selectedActivities?: readonly string[];
}

/** One interactive activity printing acts on, as the print dialog offers it for choosing. */
export interface InteractiveActivityEntry {
    /** The component's id, which is what a selection is made of. */
    id: string;
    /** iDevice type, e.g. 'guess'. */
    type: string;
    pageTitle: string;
    /** What the author called the block the activity sits in; empty when it was left blank. */
    blockTitle: string;
    /**
     * True for an iDevice that will never be given a printed form (see `isNeverPrintable`). The
     * print options leave these out unless the user asks for the note that stands in for them.
     */
    neverPrintable: boolean;
}

const DEFAULT_LABELS = {
    appendixTitle: 'Appendix',
    appendixReference: 'See appendix, activity %s',
    notAvailable: 'Not available in print.',
};

/** Id of the appendix page, fixed so a test or a stylesheet can find it. */
const APPENDIX_PAGE_ID = 'worksheet-appendix';

/**
 * Build a component carrying ready-made markup.
 *
 * It keeps the original component's id and order so the document's structure is unchanged; only
 * what it holds is different.
 */
function printableComponent(original: ExportComponent, content: string): ExportComponent {
    return {
        ...original,
        type: PRINTABLE_ACTIVITY_TYPE,
        content,
        // The stored properties describe a game this component no longer holds. An empty set
        // avoids handing the renderer configuration for an iDevice that is no longer there.
        properties: {},
    };
}

/** The activity's name, preferring the translated one. Used to build an exercise, never printed. */
function activityTitle(type: string, options: ApplyActivityModeOptions): string {
    return options.ideviceTitles?.[type] || getWorksheetAdapter(type)?.defaultTitle || type;
}

/** The same reasons name a partial omission and an activity with nothing left to print. */
function omissionWording(options: ApplyActivityModeOptions): Record<UnsupportedActivity['reason'], string> {
    const labels = resolveWorksheetLabels(options.labels);
    return {
        'media-required': labels.mediaRequired,
        'invalid-data': labels.invalidData,
        'unplaced-word': labels.unplacedWords,
        'not-printable': options.labels?.notAvailable || DEFAULT_LABELS.notAvailable,
    };
}

/**
 * A note listing what an adapter had to leave out of an exercise.
 *
 * Shown to whoever is setting the work, not to the student: the export stylesheet hides
 * `worksheet-unsupported` when printing, the same rule the worksheet's own list relies on. So the
 * teacher sees on screen that a question was dropped, and the handout stays clean.
 */
function omissionNote(
    omissions: Map<NonNullable<UnsupportedActivity['reason']>, number>,
    options: ApplyActivityModeOptions,
): string {
    if (omissions.size === 0) return '';

    // Resolved through the renderer so this note and the worksheet's own list say the same thing.
    const wording = omissionWording(options);

    const entries = [...omissions.entries()]
        .map(([reason, count]) => `<li>${escapeText(wording[reason])} (${count})</li>`)
        .join('');

    return `<aside class="worksheet-unsupported"><ul>${entries}</ul></aside>`;
}

/**
 * The heading an appendix entry needs: the number the body points at, and what the author called
 * the block it came from. Built by the renderer, so both printing paths word it the same way.
 */
function appendixHeading(entry?: { number: number; blockTitle: string }): string {
    return entry === undefined ? '' : renderActivityHeading({ ideviceType: '', title: '', items: [], ...entry });
}

/**
 * Markup for an activity that has no printed form.
 *
 * The note stands in for it, so the teacher can see that something stood there rather than
 * wondering whether the page lost it. It does not name the iDevice: that name belongs to the
 * editor, not to the handout.
 *
 * Which note depends on why. One whose answer is settled says it is not available in print: a whole
 * iDevice type that has no printed form, or one component whose adapter found nothing in it that
 * paper could carry. Otherwise preserve the adapter's reasons, such as requiring multimedia or
 * unreadable data, in the worksheet's words; nothing promises a printed form for later.
 */
function unprintableMarkup(
    type: string,
    options: ApplyActivityModeOptions,
    entry?: { number: number; blockTitle: string },
    reasons: readonly UnsupportedActivity['reason'][] = [isNeverPrintable(type) ? 'not-printable' : 'invalid-data'],
): string {
    const wording = omissionWording(options);

    return (
        `<article class="worksheet-activity worksheet-activity-unprintable" data-idevice="${escapeText(type)}">` +
        appendixHeading(entry) +
        reasons.map(reason => `<p class="worksheet-not-printable">${escapeText(wording[reason])}</p>`).join('') +
        `</article>`
    );
}

/** Markup for the pointer left in the body when the exercises go to the back. */
function referenceMarkup(type: string, options: ApplyActivityModeOptions, number: number): string {
    const pattern = options.labels?.appendixReference || DEFAULT_LABELS.appendixReference;

    return (
        `<article class="worksheet-activity worksheet-activity-reference" data-idevice="${escapeText(type)}">` +
        `<p class="worksheet-reference">${escapeText(pattern.replace('%s', String(number)))}</p>` +
        `</article>`
    );
}

/**
 * Convert one activity into printable markup.
 *
 * @returns The markup, including the adapter's reasons when nothing can print, or null when no
 *   adapter or omission reason was available
 */
function convert(
    component: ExportComponent,
    options: ApplyActivityModeOptions,
    appendix?: { number: number; blockTitle: string },
): string | null {
    const adapter = getWorksheetAdapter(component.type);
    if (!adapter) return null;

    try {
        // What the adapter had to leave out is collected rather than dropped: the worksheet path
        // reports it, and printing the document should not be the quieter way to lose content.
        const omissions = new Map<NonNullable<UnsupportedActivity['reason']>, number>();
        const activity = adapter.build(component.content || '', {
            properties: component.properties,
            title: activityTitle(component.type, options),
            labels: options.labels,
            random: options.random,
            ideviceBasePath: options.ideviceBasePath,
            onOmission: (reason, count = 1) => omissions.set(reason, (omissions.get(reason) ?? 0) + count),
        });
        // A valid activity may contain only multimedia questions. Keep every reason its adapter
        // reported even when it could build no exercise, rather than calling that data invalid.
        if (!activity) {
            return omissions.size ? unprintableMarkup(component.type, options, appendix, [...omissions.keys()]) : null;
        }

        // In place the block draws its own heading, so the exercise carries none. In the appendix
        // it needs both: the number the body points at, and what the author called the block.
        const fragment = renderActivityFragment(
            appendix === undefined ? activity : { ...activity, ...appendix },
            options.labels,
        );

        return fragment + omissionNote(omissions, options);
    } catch {
        // A payload this adapter cannot read is reported as unprintable rather than taking the
        // whole print job down with it.
        return null;
    }
}

/**
 * Whether printing acts on this component at all.
 *
 * What the author restricted stays exactly as the document prints it. Converting it would be
 * harmless, but moving it to the appendix would not: the appendix is a block of our own, and a copy
 * there would not carry the restriction its own block applies. `novisible` and `teacher-only` are
 * display:none in the export stylesheet, so a copy that loses them puts hidden or teacher-only
 * material on the student's sheet.
 */
function isActedOn(block: ExportBlock, component: ExportComponent): boolean {
    return (
        isStudentBlock(block) &&
        isComponentVisible(component) &&
        !isTeacherOnly(component) &&
        isInteractiveActivity(component.type)
    );
}

/** Whether a component is an interactive activity kept for teachers, by its block or by itself. */
function isTeacherOnlyActivity(block: ExportBlock, component: ExportComponent): boolean {
    return isInteractiveActivity(component.type) && (isTeacherOnlyBlock(block) || isTeacherOnly(component));
}

/**
 * Leave out of the printed document the interactive activities kept for teachers.
 *
 * Teacher-only content prints when the user asks for it, but its activities never do. Printing
 * has no say over them, since the print options neither list nor convert what is restricted, so
 * they would reach paper as the game the screen shows. A block they leave with nothing goes, as a
 * block the modes empty does.
 *
 * @param pages - The project's pages
 * @returns New pages, without those activities
 */
export function leaveOutTeacherOnlyActivities(pages: ExportPage[]): ExportPage[] {
    return pages.map(page => ({
        ...page,
        blocks: (page.blocks || []).reduce<ExportBlock[]>((blocks, block) => {
            const components = block.components || [];
            const kept = components.filter(component => !isTeacherOnlyActivity(block, component));
            if (kept.length === 0 && components.length > 0) return blocks;

            blocks.push(kept.length === components.length ? block : { ...block, components: kept });
            return blocks;
        }, []),
    }));
}

/**
 * Whether the printed document would hold teacher-only content, which the print options can then
 * offer to print: a teacher-only block, or a teacher-only component in an open one, on a page that
 * prints. Its activities do not count, since they never print.
 *
 * @param pages - The project's pages
 * @returns true when there is some
 */
export function hasTeacherOnlyContent(pages: ExportPage[]): boolean {
    return visibleWorksheetPages(leaveOutTeacherOnlyActivities(pages)).some(page =>
        (page.blocks || []).some(block => {
            if (!isBlockVisible(block)) return false;
            const shown = (block.components || []).filter(isComponentVisible);
            return isTeacherOnlyBlock(block) ? shown.length > 0 : shown.some(isTeacherOnly);
        }),
    );
}

/**
 * The interactive activities printing acts on, in document order.
 *
 * This is what the print dialog asks about and offers for choosing, and the same rule decides what
 * `applyActivityMode` touches — so the dialog never lists an activity the modes leave alone, nor
 * misses one they change. Pages hidden themselves or under a hidden ancestor do not print, so
 * nothing on them is listed.
 *
 * Each entry says whether its activity is one that will never be given a printed form, so the
 * print options can offer to leave those out without asking the exporter again.
 *
 * @param pages - The project's pages, as the export document gives them
 * @returns One entry per activity
 */
export function listInteractiveActivities(pages: ExportPage[]): InteractiveActivityEntry[] {
    const entries: InteractiveActivityEntry[] = [];

    for (const page of visibleWorksheetPages(pages))
        for (const block of page.blocks || [])
            for (const component of block.components || [])
                if (isActedOn(block, component))
                    entries.push({
                        id: component.id,
                        type: component.type,
                        pageTitle: (page.title || '').trim(),
                        blockTitle: (block.name || '').trim(),
                        neverPrintable: isNeverPrintable(component.type),
                    });

    return entries;
}

/** The activities the user left ticked, or null when every one is. */
function selection(options: ApplyActivityModeOptions): ReadonlySet<string> | null {
    return options.selectedActivities ? new Set(options.selectedActivities) : null;
}

/** Whether the mode drops an activity printing acts on: every one in `omit`, and any left unticked. */
function isDropped(
    component: ExportComponent,
    mode: DocumentActivityMode,
    selected: ReadonlySet<string> | null,
): boolean {
    return mode === 'omit' || (selected !== null && !selected.has(component.id));
}

/**
 * Which components the chosen mode turns into exercises, the same ones `applyActivityMode` does.
 *
 * Whatever has to be drawn before a conversion is drawn for these alone: every other component
 * prints as it is, or not at all.
 *
 * @param mode - What to do with the interactive activities
 * @param options - The selection the user made, if any
 * @returns Whether a component, in its block, is converted
 */
export function convertedBy(
    mode: DocumentActivityMode,
    options: ApplyActivityModeOptions = {},
): (block: ExportBlock, component: ExportComponent) => boolean {
    const selected = selection(options);

    return (block, component) => isActedOn(block, component) && !isDropped(component, mode, selected);
}

/**
 * Which components the chosen mode leaves out of the document, the same ones `applyActivityMode`
 * drops: every activity in `omit`, and any the user left unticked.
 *
 * Nothing these alone use needs preparing for the preview, such as a copy of their pictures.
 *
 * @param mode - What to do with the interactive activities
 * @param options - The selection the user made, if any
 * @returns Whether a component, in its block, is left out
 */
export function droppedBy(
    mode: DocumentActivityMode,
    options: ApplyActivityModeOptions = {},
): (block: ExportBlock, component: ExportComponent) => boolean {
    const selected = selection(options);

    return (block, component) => isActedOn(block, component) && isDropped(component, mode, selected);
}

/**
 * Apply the chosen mode to a project's pages.
 *
 * @param pages - Pages as they come out of preprocessing
 * @param mode - What to do with the interactive activities
 * @param options - Translated strings and per-activity context
 * @returns New pages, with the appendix appended when the mode asks for one
 */
export function applyActivityMode(
    pages: ExportPage[],
    mode: DocumentActivityMode,
    options: ApplyActivityModeOptions = {},
): ExportPage[] {
    const appendix: ExportComponent[] = [];
    let numbered = 0;
    const selected = selection(options);

    const transformed = pages.map(page => ({
        ...page,
        blocks: (page.blocks || []).reduce<ExportBlock[]>((blocks, block) => {
            const components = block.components || [];
            const kept: ExportComponent[] = [];

            for (const component of components) {
                if (!isActedOn(block, component)) {
                    kept.push(component);
                    continue;
                }

                // One the user left unticked goes as every activity goes in `omit`. It is dropped
                // before it is numbered, so the appendix has no gap where it would have been.
                if (isDropped(component, mode, selected)) continue;

                if (mode === 'in-place') {
                    const markup = convert(component, options);
                    kept.push(printableComponent(component, markup ?? unprintableMarkup(component.type, options)));
                    continue;
                }

                // The appendix numbers every activity it holds, printable or not, so the pointers
                // in the body and the exercises at the back always agree.
                const number = ++numbered;
                // The appendix entry leaves its block behind, so it carries the block's heading
                // with it — otherwise the exercise arrives at the back of the document unnamed.
                const entry = { number, blockTitle: (block.name || '').trim() };
                const markup = convert(component, options, entry);
                appendix.push(
                    printableComponent(
                        { ...component, id: `${component.id}-appendix` },
                        markup ?? unprintableMarkup(component.type, options, entry),
                    ),
                );
                kept.push(printableComponent(component, referenceMarkup(component.type, options, number)));
            }

            // A block emptied by this pass would print as a heading with nothing under it. One
            // that arrived empty is left alone, since that is how the document already prints.
            if (kept.length === 0 && components.length > 0) return blocks;

            blocks.push({ ...block, components: kept });
            return blocks;
        }, []),
    }));

    if (appendix.length === 0) return transformed;

    return [...transformed, buildAppendixPage(appendix, transformed, options)];
}

/**
 * Build the appendix as an ordinary page.
 *
 * Making it a page rather than markup appended to the document means it goes through the same
 * rendering, styling and numbering as everything else.
 */
function buildAppendixPage(
    components: ExportComponent[],
    pages: ExportPage[],
    options: ApplyActivityModeOptions,
): ExportPage {
    const lastOrder = pages.reduce((highest, page) => Math.max(highest, page.order ?? 0), 0);

    return {
        id: APPENDIX_PAGE_ID,
        title: options.labels?.appendixTitle || DEFAULT_LABELS.appendixTitle,
        parentId: null,
        order: lastOrder + 1,
        blocks: [
            {
                id: `${APPENDIX_PAGE_ID}-block`,
                // Unnamed: each activity already carries its own heading, and a block title above
                // them would repeat the first one.
                name: '',
                order: 0,
                components: components.map((component, index) => ({ ...component, order: index })),
            },
        ],
    };
}
