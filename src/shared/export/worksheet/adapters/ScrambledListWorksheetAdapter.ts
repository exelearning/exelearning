/**
 * Scrambled list ('scrambled-list') worksheet adapter
 *
 * Prints the elements out of order, each with a line beside it to write its position on.
 *
 * On screen the student drags them into place. On paper they number them instead, which is the
 * same judgement made with a pencil — so what the sheet loses is only the dragging.
 *
 * Notes on the stored data:
 * - This is a `json` activity: the questions live in the component's properties, not in its HTML.
 * - `options` is the list **in the right order**. That order is the answer, so the sheet never
 *   prints it: the elements are shuffled, exactly as the activity shuffles them to be played.
 * - An element is a plain string today. Older projects wrapped it: in an array, or in an object
 *   under any of several keys. The activity reads all of those and so does this, or a list saved
 *   the old way prints as nothing at all.
 * - `afterElement` is `textAfter` wrapped in a div by the editor. The wrapper is the activity's
 *   own markup, so the closing text is read from `textAfter` itself.
 * - There is one question here, not a list of them: the whole activity is a single ordering.
 */

import { shuffleWith, type RandomSource } from '../questionSelection';
import { hasPrintableContent, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/**
 * The keys an older project may have wrapped an element's text under.
 *
 * The activity's own `normalizeOptionItem` tries these in this order, so this does too.
 */
const WRAPPER_KEYS = ['text', 'option', 'content', 'html', 'value', 'label', 'title', 'name'];

/**
 * One element's text, however this project wrapped it.
 *
 * Today it is a plain string. An older one may hold a number, an array whose first non-empty entry
 * is the text, or an object keeping it under one of several names.
 */
function elementText(option: unknown): string {
    if (typeof option === 'string' || typeof option === 'number') return String(option).trim();

    if (Array.isArray(option)) {
        for (const entry of option) {
            const text = elementText(entry);
            if (text !== '') return text;
        }
        return '';
    }

    if (option === null || typeof option !== 'object') return '';

    const record = option as Record<string, unknown>;
    for (const key of WRAPPER_KEYS) {
        if (!Object.hasOwn(record, key)) continue;
        const text = elementText(record[key]);
        if (text !== '') return text;
    }

    // The runtime also reads arbitrary own keys after trying the preferred wrappers.
    for (const key of Object.keys(record)) {
        const text = elementText(record[key]);
        if (text !== '') return text;
    }

    return '';
}

/** The Scrambled list properties. */
interface ScrambledListProperties {
    /** The elements, in the order they should end up in. Never printed in that order. */
    options?: unknown[];
    instructions?: string;
    textAfter?: string;
}

export const ScrambledListWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'scrambled-list',
    defaultTitle: 'Scrambled list',

    build(_html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const data = (options.properties ?? {}) as ScrambledListProperties;
        const stored = Array.isArray(data.options) ? data.options : [];

        const labels = stored.map(option => sanitizeHtml(elementText(option))).filter(hasPrintableContent);

        // One element is not an ordering, and nothing at all is not an exercise.
        if (labels.length < 2) return null;

        const random: RandomSource = options.random ?? Math.random;
        const activity: PrintableActivity = {
            ideviceType: 'scrambled-list',
            title: options.title || ScrambledListWorksheetAdapter.defaultTitle,
            // A line beside each element, for the position the student works out. The stored order
            // is the answer, so what is printed is a shuffle of it.
            items: [{ prompt: '', answer: { kind: 'options', labels: shuffleWith(labels, random), marker: 'line' } }],
        };

        const instructions = sanitizeHtml(data.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(data.textAfter);
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
