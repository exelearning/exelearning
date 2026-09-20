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
import { getWorksheetAdapter } from '../worksheet/adapters/registry';
import { isInteractiveActivity } from '../worksheet/interactiveActivities';
import { escapeText } from '../worksheet/sanitizeHtml';
import type { WorksheetLabels } from '../worksheet/types';
import { renderActivityFragment } from '../worksheet/WorksheetRenderer';

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
 */
export const PRINTABLE_ACTIVITY_TYPE = 'worksheet-activity';

/** User-visible strings, passed in already translated. */
export interface PrintActivityLabels extends WorksheetLabels {
    /** Title of the appendix page. */
    appendixTitle?: string;
    /** Pointer left where the activity was. `%s` is replaced by the activity's number. */
    appendixReference?: string;
    /** Shown in place of an activity that has no printable form yet. */
    notPrintable?: string;
}

export interface ApplyActivityModeOptions {
    labels?: PrintActivityLabels;
    /** Translated activity headings keyed by iDevice type, e.g. `{ guess: 'Adivina' }`. */
    ideviceTitles?: Record<string, string>;
    /** Source of randomness for activities that draw questions at random. */
    random?: () => number;
    /** Base URL the iDevice export files are served from, ending in a slash. */
    ideviceBasePath?: string;
}

const DEFAULT_LABELS = {
    appendixTitle: 'Appendix',
    appendixReference: 'See appendix, activity %s',
    notPrintable: 'This activity cannot be printed yet.',
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

/** Heading for an activity, preferring the translated name of its iDevice. */
function activityTitle(type: string, options: ApplyActivityModeOptions): string {
    return options.ideviceTitles?.[type] || getWorksheetAdapter(type)?.defaultTitle || type;
}

/**
 * Markup for an activity that cannot be converted yet.
 *
 * It still prints its heading, so the teacher can see that something stood there rather than
 * wondering whether the page lost it.
 */
function unprintableMarkup(type: string, options: ApplyActivityModeOptions, number?: number): string {
    const label = options.labels?.notPrintable || DEFAULT_LABELS.notPrintable;
    const title = numberedTitle(activityTitle(type, options), number);

    return (
        `<article class="worksheet-activity worksheet-activity-unprintable" data-idevice="${escapeText(type)}">` +
        `<h3 class="worksheet-activity-title">${escapeText(title)}</h3>` +
        `<p class="worksheet-not-printable">${escapeText(label)}</p>` +
        `</article>`
    );
}

/** Markup for the pointer left in the body when the exercises go to the back. */
function referenceMarkup(type: string, options: ApplyActivityModeOptions, number: number): string {
    const pattern = options.labels?.appendixReference || DEFAULT_LABELS.appendixReference;

    return (
        `<article class="worksheet-activity worksheet-activity-reference" data-idevice="${escapeText(type)}">` +
        `<h3 class="worksheet-activity-title">${escapeText(activityTitle(type, options))}</h3>` +
        `<p class="worksheet-reference">${escapeText(pattern.replace('%s', String(number)))}</p>` +
        `</article>`
    );
}

/** Prefix a title with its appendix number, when it has one. */
function numberedTitle(title: string, number?: number): string {
    return number === undefined ? title : `${number}. ${title}`;
}

/**
 * Convert one activity into printable markup.
 *
 * @returns The markup, or null when the iDevice has no adapter
 */
function convert(component: ExportComponent, options: ApplyActivityModeOptions, number?: number): string | null {
    const adapter = getWorksheetAdapter(component.type);
    if (!adapter) return null;

    try {
        const activity = adapter.build(component.content || '', {
            title: activityTitle(component.type, options),
            random: options.random,
            ideviceBasePath: options.ideviceBasePath,
        });
        if (!activity) return null;

        return renderActivityFragment({ ...activity, title: numberedTitle(activity.title, number) }, options.labels);
    } catch {
        // A payload this adapter cannot read is reported as unprintable rather than taking the
        // whole print job down with it.
        return null;
    }
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

    const transformed = pages.map(page => ({
        ...page,
        blocks: (page.blocks || []).reduce<ExportBlock[]>((blocks, block) => {
            const components = block.components || [];
            const kept: ExportComponent[] = [];

            for (const component of components) {
                if (!isInteractiveActivity(component.type)) {
                    kept.push(component);
                    continue;
                }

                if (mode === 'omit') continue;

                if (mode === 'in-place') {
                    const markup = convert(component, options);
                    kept.push(printableComponent(component, markup ?? unprintableMarkup(component.type, options)));
                    continue;
                }

                // The appendix numbers every activity it holds, printable or not, so the pointers
                // in the body and the exercises at the back always agree.
                const number = ++numbered;
                const markup = convert(component, options, number);
                appendix.push(
                    printableComponent(
                        { ...component, id: `${component.id}-appendix` },
                        markup ?? unprintableMarkup(component.type, options, number),
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
