/**
 * Flip cards ('flipcards') worksheet adapter
 *
 * Turns a Flip cards activity into a printable pairing exercise: the fronts in one column and the
 * backs in the other, each shuffled on its own, for the student to join with lines.
 *
 * On screen a card is turned over. Paper cannot be turned over, and the activity offers four ways
 * of using the same cards — show, navigate, identify and memory — none of which survives the trip
 * intact. What does survive is what every one of them rests on: which front goes with which back.
 * Two columns to join is how a set of flash cards has always been put on paper, and it asks the
 * same knowledge the screen asks, with the self-checking taken away.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is the iDevice's own name here, unlike most of the family.
 * - The card shape is shared with Relate and is read by `twoFacedCards`, which is also where the
 *   text encoding, the four sidecar classes and the colours are explained.
 * - `instructions` is a div beside the payload, not a field inside it. Relate keeps its own inside.
 * - `type` picks the game: 0 show, 1 navigate, 2 identify, 3 memory. It changes nothing here — the
 *   pairing is the same in all four, and a printed sheet cannot offer any of them.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { sanitizeHtml } from '../sanitizeHtml';
import { buildFacingColumns, type TwoFacedDataGame } from '../twoFacedCards';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'flipcards';

export const FlipcardsWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'flipcards',
    defaultTitle: 'Flip cards',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<TwoFacedDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.cardsGame)) return null;

        const groups = buildFacingColumns(html, PREFIX, dataGame, options);
        if (!groups) return null;

        const activity: PrintableActivity = {
            ideviceType: 'flipcards',
            title: options.title || FlipcardsWorksheetAdapter.defaultTitle,
            board: { kind: 'groupColumns', groups },
            // The whole exercise is the two columns; there are no questions to number.
            items: [],
        };

        const instructions = sanitizeHtml(extractDivContent(html, `${PREFIX}-instructions`));
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
