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
 * - `afterElement` is `textAfter` wrapped in a div by the editor. The wrapper is the activity's
 *   own markup, so the closing text is read from `textAfter` itself.
 * - There is one question here, not a list of them: the whole activity is a single ordering.
 */

import { shuffleWith, type RandomSource } from '../questionSelection';
import { hasPrintableContent, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

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

        // The activity keeps its elements as plain strings, and drops the blank ones.
        const labels = stored
            .map(option => sanitizeHtml(typeof option === 'string' || typeof option === 'number' ? String(option) : ''))
            .filter(hasPrintableContent);

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
