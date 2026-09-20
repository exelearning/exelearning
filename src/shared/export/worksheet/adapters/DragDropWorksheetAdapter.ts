/**
 * Drag and drop ('dragdrop') worksheet adapter
 *
 * Turns a Drag and drop activity into a printable pairing exercise: two columns facing each other,
 * one holding the pictures and the other the texts, for the student to join with lines.
 *
 * On screen the student drags each card onto its partner. Paper cannot be dragged, so the two
 * sides are simply laid out and each column is shuffled on its own — otherwise the answer would be
 * whichever card sits on the same line.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'dragdrop'.
 * - Cards live in `cardsGame`; each carries both halves of one pair, `definition` and `url`.
 * - `typeDrag` says which column the text goes in. The activity fills its first column from
 *   `cardsGame` as targets and its second as sources, so 0 puts the text on the left and 1 on the
 *   right. This is the setting the teacher chose, so it is followed rather than fixed here.
 * - `definition` is plain HTML, not escaped — unlike the Classify cards, which store `eText`.
 * - `percentajeCards` and `randomCards` are the share and the draw, as everywhere else.
 * - A card whose picture is missing, or which carries only audio, cannot be paired on paper. It is
 *   reported and left out, together with its text.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { indexedQuestions, type RandomSource, selectQuestions, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableCard, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'dragdrop';

/** `typeDrag`: which column the text goes in. */
const TEXT_ON_THE_LEFT = 0;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** One card as stored by the Drag and drop iDevice. Each holds both halves of one pair. */
interface DragDropCard {
    /** The text half, as plain HTML. */
    definition?: string;
    /** The picture half. The sidecar link carries the resolvable reference. */
    url?: string;
    alt?: string;
    /** Sound clip, which has no paper equivalent. */
    audio?: string;
}

/** The Drag and drop activity payload. */
interface DragDropDataGame {
    instructions?: string;
    cardsGame?: DragDropCard[];
    /** 0 puts the text in the left column, 1 in the right. */
    typeDrag?: number;
    /** Share of the stored cards the activity actually uses. */
    percentajeCards?: number;
    /** Whether the cards are drawn at random. */
    randomCards?: boolean;
}

/** A card paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedCard {
    question: DragDropCard;
    index: number;
}

/** Both halves of one pair, once each has been checked for something printable. */
interface PrintablePair {
    text: PrintableCard;
    media: PrintableCard;
}

/**
 * Split one stored card into the two cards that face each other.
 *
 * @returns The pair, or null when either half would print blank
 */
function buildPair({ question: card, index }: IndexedCard, imageLinks: Map<number, string>): PrintablePair | null {
    const text = sanitizeHtml(card.definition);
    const src = imageLinks.get(index) ?? card.url ?? '';

    // Both halves have to carry something: a pair with a blank side cannot be matched, and
    // printing it would set the student an impossible line to draw.
    if (!text || src.length < MIN_MEDIA_HREF_LENGTH) return null;

    return {
        text: { text },
        media: { media: { kind: 'image', src, alt: card.alt || undefined } },
    };
}

export const DragDropWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'dragdrop',
    defaultTitle: 'Drag and drop',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<DragDropDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.cardsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // Unusable cards go before the share is applied, so a pair that cannot be printed does not
        // take up part of the number the teacher asked for. The runtime has no such problem, since
        // every card works on screen.
        const pairs = indexedQuestions(dataGame.cardsGame, options).flatMap(entry => {
            const pair = buildPair(entry, imageLinks);
            if (pair) return [pair];
            options.onOmission?.('media-required');
            return [];
        });

        const selected = selectQuestions(pairs, dataGame.percentajeCards, dataGame.randomCards, random);
        if (selected.length === 0) return null;

        // Each column is shuffled on its own. Shuffling them together, or not at all, would leave
        // each pair sharing a line and give the whole exercise away.
        const texts = shuffleWith(
            selected.map(pair => pair.text),
            random,
        );
        const media = shuffleWith(
            selected.map(pair => pair.media),
            random,
        );

        const textOnTheLeft = (dataGame.typeDrag ?? TEXT_ON_THE_LEFT) === TEXT_ON_THE_LEFT;

        const activity: PrintableActivity = {
            ideviceType: 'dragdrop',
            title: options.title || DragDropWorksheetAdapter.defaultTitle,
            board: {
                kind: 'pairColumns',
                left: textOnTheLeft ? texts : media,
                right: textOnTheLeft ? media : texts,
            },
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
