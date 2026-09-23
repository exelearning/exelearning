/**
 * Padlock ('padlock') worksheet adapter
 *
 * Prints the instructions and, under them, the feedback the lock guards.
 *
 * There is nothing to solve on paper. The activity is a combination the student types in, and what
 * it protects is a passage of the author's writing; a printed sheet has no lock to open, so it
 * carries the writing. What it never carries is the combination.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'candado', not the iDevice's name.
 * - Both texts live **only** in their own divs. The editor writes `candadoInstructions` and
 *   `candadoRetro` into the payload as empty strings and keeps the real content beside it, so the
 *   payload is no use here and the divs are the whole source — which is as well, since they are
 *   also the copies the export pipeline rewrote.
 * - `candadoSolution` is the combination, and is never printed.
 */

import { extractDivContent } from '../dataGameReader';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'candado';

export const PadlockWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'padlock',
    defaultTitle: 'Padlock',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const instructions = sanitizeHtml(extractDivContent(html, `${PREFIX}-instructions`));
        const feedback = sanitizeHtml(extractDivContent(html, `${PREFIX}-retro`));

        // With neither there is nothing of the activity left to print.
        if (!instructions && !feedback) return null;

        const activity: PrintableActivity = {
            ideviceType: 'padlock',
            title: options.title || PadlockWorksheetAdapter.defaultTitle,
            // The feedback is a passage to read, not a question: it carries no answer space, and
            // as the only item it is drawn without a number.
            items: feedback ? [{ prompt: feedback }] : [],
        };

        if (instructions) activity.instructions = instructions;

        return activity;
    },
};
