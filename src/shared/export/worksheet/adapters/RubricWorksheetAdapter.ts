/**
 * Rubric ('rubric') worksheet adapter
 *
 * Prints an assessment table as the table it is: the fields above it, the criteria against the
 * levels with every descriptor in place, and room for notes underneath.
 *
 * Unlike the activities around it, nothing here is a game and nothing is hidden. What the sheet
 * takes away is only what paper cannot carry — the text inputs, the buttons, the running total —
 * and marking is done by ringing the cell that fits rather than by clicking it.
 *
 * Notes on the stored data:
 * - The table is read by `rubricTable`, which handles both the shape the current editor writes and
 *   the plain HTML table an older project carries.
 * - Its own wording for the fields comes from the activity, and where it names none, none is
 *   printed. Name and date are left out only when the containing worksheet already asks for them.
 * - Nothing is left blank in the table. Every other adapter hides the answer; here the descriptors
 *   are what the teacher chooses between, so hiding them would leave a grid of numbers.
 */

import { extractDivContent } from '../dataGameReader';
import { readRubricTable } from '../rubricTable';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/**
 * Classes the text around the table is written into.
 *
 * The iDevice also keeps an escaped copy of both in a screen-reader-only block, but the editor
 * writes these divs whenever there is anything to write, and they are the copies the export
 * pipeline rewrote.
 */
const INSTRUCTIONS_CLASS = 'exe-rubrics-instructions';
const TEXT_AFTER_CLASS = 'exe-rubrics-text-after';

export const RubricWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'rubric',
    defaultTitle: 'Rubric',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const table = readRubricTable(html, options.hasIdentityFields);
        if (!table) return null;

        // The whole rubric is the board: there are no questions beside it, and on screen it is one
        // thing a teacher fills in rather than a table with an exercise around it.
        const activity: PrintableActivity = {
            ideviceType: 'rubric',
            title: options.title || RubricWorksheetAdapter.defaultTitle,
            board: { kind: 'rubricTable', table },
            items: [],
        };

        const instructions = sanitizeHtml(extractDivContent(html, INSTRUCTIONS_CLASS));
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, TEXT_AFTER_CLASS));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
