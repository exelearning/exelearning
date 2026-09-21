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
 * - Unlike Drag and drop, which pairs a picture with a text, **both halves here are full cards**.
 *   Either side can carry a picture, a text, both, or only a sound. One stored card holds both:
 *   `eText`/`url`/`alt`/`author`/`color`/`backcolor` are the front, and the same names with a `Bk`
 *   suffix are the back.
 * - `eText` and `eTextBk` are stored **URI-encoded** and decoded with `decodeURIComponent`. This is
 *   not the family's usual `escape()`/`unescape()` pair, and using the wrong one mangles every
 *   accented character in a Spanish worksheet.
 * - Four sidecar link classes carry the media, keyed by the card's index in the link text:
 *   `relaciona-LinkImages` and `relaciona-LinkImagesBack` for pictures, and the matching `Audios`
 *   pair for sound.
 * - `percentajeCards` and `randomCards` are the share and the draw, as everywhere else.
 * - `color` is the font colour and `backcolor` the background. On paper the background becomes an
 *   outline and a band — see `cardColors` for why, and for what happens to a colour too pale to
 *   survive the trip.
 * - A half carrying only a sound has nothing to print. Its pair is reported and left out, since a
 *   line has to be drawn between two things a student can see.
 */

import { cardAccent, textInk } from '../cardColors';
import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { indexedQuestions, type RandomSource, selectQuestions, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableCard, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'relaciona';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/**
 * How many pairs go in one block of the printed exercise.
 *
 * Paper has pages, and a pair whose halves land on different sheets cannot be joined with a line.
 * Grouping keeps each block a self-contained exercise; the renderer sizes its blocks to match.
 */
const PAIRS_PER_GROUP = 5;

/** One card as stored by the Relate iDevice. It holds both halves of one pair. */
interface RelateCard {
    /** Front: URI-encoded HTML. */
    eText?: string;
    url?: string;
    alt?: string;
    author?: string;
    color?: string;
    backcolor?: string;
    /** Back: the same fields again. */
    eTextBk?: string;
    urlBk?: string;
    altBk?: string;
    authorBk?: string;
    colorBk?: string;
    backcolorBk?: string;
}

/** The Relate activity payload. */
interface RelateDataGame {
    instructions?: string;
    cardsGame?: RelateCard[];
    /** Share of the stored cards the activity actually uses. */
    percentajeCards?: number;
    /** Whether the cards are drawn at random. */
    randomCards?: boolean;
}

/** A card paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedCard {
    question: RelateCard;
    index: number;
}

/** Both halves of one pair, once each has been checked for something printable. */
interface PrintablePair {
    front: PrintableCard;
    back: PrintableCard;
}

/**
 * Decode the text of a card.
 *
 * Mirrors the runtime's own `decodeURIComponentSafe`, with two departures. It does not throw on a
 * malformed sequence — a stray `%` in an author's text would take the whole worksheet down, where
 * on screen it only breaks one card — and it replaces *every* `&percnt;` rather than the first,
 * which the runtime does by omitting the global flag and which would otherwise print the entity
 * itself in the middle of a sentence.
 *
 * @param value - The card's stored text
 * @returns The decoded text, or the input when it cannot be decoded
 */
function decodeText(value: string | undefined): string {
    if (!value) return '';

    try {
        return decodeURIComponent(value).replaceAll('&percnt;', '%');
    } catch {
        return value.replaceAll('&percnt;', '%');
    }
}

/** One face of a stored card, with the `Bk` suffix resolved away. */
interface CardFace {
    text?: string;
    url?: string;
    alt?: string;
    author?: string;
    font?: string;
    background?: string;
}

/**
 * Read one face off a stored card.
 *
 * The iDevice keeps both faces in the same object, the back distinguished only by a `Bk` on every
 * field name. Resolving that in one place is what keeps the rest of the adapter from having to say
 * everything twice, and from pairing a front's colour with a back's text.
 */
function face(card: RelateCard, back: boolean): CardFace {
    return back
        ? {
              text: card.eTextBk,
              url: card.urlBk,
              alt: card.altBk,
              author: card.authorBk,
              font: card.colorBk,
              background: card.backcolorBk,
          }
        : {
              text: card.eText,
              url: card.url,
              alt: card.alt,
              author: card.author,
              font: card.color,
              background: card.backcolor,
          };
}

/**
 * One face of a stored card, as it would print.
 *
 * @param source - The face, as stored
 * @param href - The picture from the sidecar, which is the reference that still resolves
 * @returns The card, or null when the face carries nothing a student could see
 */
function buildHalf(source: CardFace, href: string | undefined): PrintableCard | null {
    const card: PrintableCard = {};
    const body = sanitizeHtml(decodeText(source.text));

    if (body) card.text = body;
    if (href && href.length >= MIN_MEDIA_HREF_LENGTH) {
        card.media = { kind: 'image', src: href, alt: source.alt || undefined, author: source.author || undefined };
    }

    // A face with neither words nor a picture is a sound clip, which paper cannot carry.
    if (!card.text && !card.media) return null;

    const ink = textInk(source.font);
    const accent = cardAccent(source.background);
    if (ink) card.textColor = ink;
    if (accent) card.accentColor = accent;

    return card;
}

/**
 * Split one stored card into the two that face each other.
 *
 * @returns The pair, or null when either half would print blank
 */
function buildPair(
    { question: card, index }: IndexedCard,
    frontImages: Map<number, string>,
    backImages: Map<number, string>,
): PrintablePair | null {
    const frontFace = face(card, false);
    const backFace = face(card, true);
    const front = buildHalf(frontFace, frontImages.get(index) ?? frontFace.url);
    const back = buildHalf(backFace, backImages.get(index) ?? backFace.url);

    // Both halves have to carry something: a pair with a blank side cannot be matched, and
    // printing it would set the student an impossible line to draw.
    return front && back ? { front, back } : null;
}

export const RelateWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'relate',
    defaultTitle: 'Relate',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<RelateDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.cardsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const frontImages = extractMediaLinks(html, PREFIX, 'Images');
        const backImages = extractMediaLinks(html, PREFIX, 'ImagesBack');

        // Unusable cards go before the share is applied, so a pair that cannot be printed does not
        // take up part of the number the teacher asked for. The runtime has no such problem, since
        // every card works on screen.
        const pairs = indexedQuestions(dataGame.cardsGame, options).flatMap(entry => {
            const pair = buildPair(entry, frontImages, backImages);
            if (pair) return [pair];
            options.onOmission?.('media-required');
            return [];
        });

        const selected = selectQuestions(pairs, dataGame.percentajeCards, dataGame.randomCards, random);
        if (selected.length === 0) return null;

        // Grouped before shuffling, so a card's partner is always in the same group and the two
        // never end up on different sheets. Each column of a group is then shuffled on its own:
        // shuffling them together, or not at all, would leave every pair sharing a line and give
        // the exercise away.
        const groups = [];
        for (let start = 0; start < selected.length; start += PAIRS_PER_GROUP) {
            const group = selected.slice(start, start + PAIRS_PER_GROUP);

            groups.push({
                left: shuffleWith(
                    group.map(pair => pair.front),
                    random,
                ),
                right: shuffleWith(
                    group.map(pair => pair.back),
                    random,
                ),
            });
        }

        const activity: PrintableActivity = {
            ideviceType: 'relate',
            title: options.title || RelateWorksheetAdapter.defaultTitle,
            board: { kind: 'pairColumns', groups },
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
