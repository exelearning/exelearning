/**
 * Padlock ('padlock') worksheet adapter
 *
 * Prints the feedback the lock guards.
 *
 * There is nothing to solve on paper. The activity is a combination the student types in, and what
 * it protects is a passage of the author's writing; a printed sheet has no lock to open, so it
 * carries the writing. What it never carries is the combination or the instructions to unlock it.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'candado', not the iDevice's name.
 * - The feedback lives **only** in its own div. The editor writes `candadoRetro` into the payload
 *   as an empty string and keeps the real content beside it, so the payload is no use here and the
 *   div is the whole source — which is as well, since it is also the copy the export pipeline rewrote.
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
        const feedback = sanitizeHtml(extractDivContent(html, `${PREFIX}-retro`));

        // Without feedback there is nothing of the activity left to print.
        if (!feedback) return null;

        const activity: PrintableActivity = {
            ideviceType: 'padlock',
            title: options.title || PadlockWorksheetAdapter.defaultTitle,
            // The feedback is a passage to read, not a question: it carries no answer space, and
            // as the only item it is drawn without a number.
            items: [{ prompt: feedback }],
        };

        return activity;
    },
};
