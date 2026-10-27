/**
 * Checklist ('checklist') worksheet adapter
 *
 * Prints a checklist as a list to fill in by hand: its heading, the learner's details when it asks
 * for them, the score to write in when it scores its items, and one row per item marked the way the
 * activity marks it on screen.
 *
 * Like the rubric, nothing here is a game and nothing is hidden: the items are what is being ticked
 * off. What the sheet takes away is only what paper cannot carry. A switch becomes a box to tick, a
 * text field a line to write on, and a drop-down its states written out, each with a dotted blank
 * before it. The buttons and the running count of what is done go, and so do the logos: on screen
 * they are background images, which a browser leaves off the page unless the reader asks for them.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'listacotejo', and the payload is obfuscated like most of the
 *   family's.
 * - Each entry of `levels` is one item. `type` is how it is marked, as the editor's own drop-down
 *   numbers it: '0' Box, '1' Text, '2' Selection, '3' Do not mark. `nivel` is how deep it is
 *   indented, from '0' to '3'. `item` is HTML. All three are strings.
 * - `points` is a string as well, empty for an item that is not scored. The runtime adds the items
 *   up with `parseInt` and shows the score only when that total is above zero. The sheet counts
 *   only the items it can print and reports any it has to omit.
 * - The activity's own wording is in `msgs`, where the author may have changed it, and it is used
 *   rather than ours. Where it names nothing, nothing is printed for it.
 * - The instructions and the closing text are not in the payload but in divs beside it.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { escapeText, hasPrintableContent, sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableChecklist,
    PrintableChecklistItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'listacotejo';

/** Classes the text around the list is written into. */
const INSTRUCTIONS_CLASS = 'listacotejo-instructions';
const TEXT_AFTER_CLASS = 'listacotejo-extra-content';

/** How each kind of item the editor offers is marked on paper, keyed by its stored type. */
const MARKERS: Record<string, PrintableChecklistItem['marker']> = {
    '0': 'box',
    '1': 'boxAndLine',
    '2': 'states',
    '3': 'none',
};

/** The deepest indent the editor offers: its table has four level columns. */
const MAX_LEVEL = 3;

/** One item as stored by the Checklist iDevice. */
interface ChecklistLevel {
    type?: string;
    nivel?: string;
    item?: string;
    points?: string;
}

/** The activity's own wording, which the author can edit. */
interface ChecklistMessages {
    msgName?: string;
    msgDate?: string;
    msgScore?: string;
    msgPoint?: string;
    msgPoints?: string;
    msgDone?: string;
    msgInProgress?: string;
    msgUnrealized?: string;
}

/** The Checklist payload. */
interface ChecklistDataGame {
    title?: string;
    subtitle?: string;
    levels?: ChecklistLevel[];
    userData?: boolean;
    useScore?: boolean;
    footer?: string;
    msgs?: ChecklistMessages;
}

/** A stored value as trimmed text, whatever type it was saved as. */
function text(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/** The indent an item is drawn at, read as the runtime reads it and kept to what the editor offers. */
function levelOf(nivel: unknown): number {
    const level = Number.parseInt(text(nivel), 10);

    return Number.isNaN(level) ? 0 : Math.min(Math.max(level, 0), MAX_LEVEL);
}

/** What an item is worth, worded as the runtime words it, or nothing when it is not scored. */
function pointsOf(points: string, msgs: ChecklistMessages): string {
    if (!points) return '';

    const unit = text(points === '1' ? msgs.msgPoint : msgs.msgPoints);
    return escapeText(`(${unit ? `${points} ${unit}` : points})`);
}

/** Read printable items and their total together, reporting any criteria left off the sheet. */
function readItems(
    levels: ChecklistLevel[],
    data: ChecklistDataGame,
    onOmission: WorksheetAdapterOptions['onOmission'],
): { items: PrintableChecklistItem[]; total: number } {
    const msgs = data.msgs ?? {};
    const items: PrintableChecklistItem[] = [];
    let total = 0;

    for (const level of levels) {
        const type = text(level?.type);
        const marker = Object.hasOwn(MARKERS, type) ? MARKERS[type] : undefined;
        const content = sanitizeHtml(level?.item);
        if (!marker || !hasPrintableContent(content)) {
            onOmission?.('invalid-data');
            continue;
        }

        const item: PrintableChecklistItem = { text: content, level: levelOf(level.nivel), marker };
        const points = data.useScore ? pointsOf(text(level.points), msgs) : '';
        if (points) item.points = points;
        items.push(item);
        const value = Number.parseInt(text(level.points), 10);
        if (!Number.isNaN(value)) total += value;
    }

    return { items, total };
}

/**
 * Assemble the list as it prints.
 *
 * The containing sheet may already ask for the learner's name and date. In that case the
 * checklist does not repeat those fields.
 */
function assemble(
    data: ChecklistDataGame,
    levels: ChecklistLevel[],
    options: WorksheetAdapterOptions,
): PrintableChecklist | null {
    const { items, total } = readItems(levels, data, options.onOmission);
    if (items.length === 0) return null;

    const msgs = data.msgs ?? {};
    const word = (value: unknown) => escapeText(text(value));

    const fields = data.userData && !options.hasIdentityFields ? [word(msgs.msgName), word(msgs.msgDate)] : [];
    const list: PrintableChecklist = {
        fields: fields.filter(label => label !== ''),
        states: [word(msgs.msgDone), word(msgs.msgInProgress), word(msgs.msgUnrealized)],
        items,
    };

    const title = sanitizeHtml(data.title);
    if (title) list.title = title;

    const subtitle = sanitizeHtml(data.subtitle);
    if (subtitle) list.subtitle = subtitle;

    const scoreLabel = word(msgs.msgScore);
    if (data.useScore && total > 0 && scoreLabel) list.score = { label: scoreLabel, total };

    const footer = sanitizeHtml(data.footer);
    if (footer) list.footer = footer;

    return list;
}

export const ChecklistWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'checklist',
    defaultTitle: 'Checklist',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const data = extractDataGame<ChecklistDataGame>(html, PREFIX);
        if (!data || !Array.isArray(data.levels)) return null;

        const list = assemble(data, data.levels, options);
        if (!list) return null;

        // The whole checklist is the board: on screen it is one thing the learner fills in, and its
        // items are not questions to number.
        const activity: PrintableActivity = {
            ideviceType: 'checklist',
            title: options.title || ChecklistWorksheetAdapter.defaultTitle,
            board: { kind: 'checklist', list },
            items: [],
        };

        const instructions = sanitizeHtml(extractDivContent(html, INSTRUCTIONS_CLASS));
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, TEXT_AFTER_CLASS));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
