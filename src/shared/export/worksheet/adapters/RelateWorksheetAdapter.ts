/**
 * Relate ('relaciona') worksheet adapter
 *
 * Turns a Relate activity into a printable pairing exercise: two columns facing each other for the
 * student to join with lines.
 *
 * On screen the student drags a line from a card on the left to its partner on the right. Paper
 * cannot be dragged, so the two sides are laid out and each column is shuffled on its own —
 * otherwise the answer would be whichever card sits on the same line.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'relaciona', not the iDevice's name.
 * - The card shape is shared with Flip cards and is read by `twoFacedCards`, which is also where
 *   the text encoding, the four sidecar classes and the colours are explained.
 * - `instructions` is a field of the payload here. Flip cards keeps its own in a div beside it.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { sanitizeHtml } from '../sanitizeHtml';
import { buildFacingColumns, type TwoFacedDataGame } from '../twoFacedCards';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'relaciona';

/** The Relate payload: the shared card set, plus its own instructions. */
type RelateDataGame = TwoFacedDataGame & { instructions?: string };

export const RelateWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'relate',
    defaultTitle: 'Relate',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<RelateDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.cardsGame)) return null;

        const groups = buildFacingColumns(html, PREFIX, dataGame, options);
        if (!groups) return null;

        const activity: PrintableActivity = {
            ideviceType: 'relate',
            title: options.title || RelateWorksheetAdapter.defaultTitle,
            board: { kind: 'groupColumns', groups },
            // The whole exercise is the two columns; there are no questions to number.
            items: [],
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
