/**
 * Cards with two faces, printed as two columns to join
 *
 * Relate and Flip cards store the same thing under the same names: one object per card holding
 * both of its faces, the back distinguished only by a `Bk` on every field. Each face can carry a
 * picture, a text, both, or only a sound, and each has its own font and background colour. Their
 * media sits in four sidecar link classes, two per face.
 *
 * On screen the two activities do different things with that — one drags a line between the faces,
 * the other turns a card over — but paper can do neither, and what is left is the same exercise:
 * the faces laid out in two columns, each shuffled on its own, for the student to join up. So the
 * reading of the stored shape lives here once rather than in each adapter, where the next one to
 * be written would have copied it a third time.
 */

import { cardAccent, textInk } from './cardColors';
import { extractMediaLinks } from './dataGameReader';
import { groupMatchingCards } from './matchingCards';
import { indexedQuestions, type RandomSource, selectQuestions } from './questionSelection';
import { sanitizeHtml } from './sanitizeHtml';
import type { PrintableCard, PrintableCardGroup, WorksheetAdapterOptions } from './types';

/** Shortest href the runtimes accept as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** One card as these iDevices store it: both faces in one object. */
export interface TwoFacedCard {
    /** Front. The text is URI-encoded. */
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

/** What both payloads carry about the set as a whole. */
export interface TwoFacedDataGame {
    cardsGame?: TwoFacedCard[];
    /** Share of the stored cards the activity actually uses. */
    percentajeCards?: number;
    /** Whether the cards are drawn at random. */
    randomCards?: boolean;
}

/** One face, with the `Bk` suffix resolved away. */
interface CardFace {
    text?: string;
    url?: string;
    alt?: string;
    author?: string;
    font?: string;
    background?: string;
}

/**
 * Decode the text of a card.
 *
 * Mirrors the runtimes' own `decodeURIComponentSafe` — both iDevices carry an identical copy —
 * with two departures. It does not throw on a malformed sequence: a stray `%` in an author's text
 * breaks one card on screen and would take the whole worksheet down here. And it replaces *every*
 * `&percnt;` rather than the first, which the runtimes do by omitting the global flag and which
 * would otherwise print the entity itself in the middle of a sentence.
 *
 * Note this is `decodeURIComponent`, not the `escape()`/`unescape()` pair most of the gamified
 * family uses. Reaching for the family's habit here mangles every accent in a Spanish worksheet.
 *
 * @param value - The card's stored text
 * @returns The decoded text, or the input when it cannot be decoded
 */
export function decodeCardText(value: string | undefined): string {
    if (!value) return '';

    try {
        return decodeURIComponent(value).replaceAll('&percnt;', '%');
    } catch {
        return value.replaceAll('&percnt;', '%');
    }
}

/**
 * Read one face off a stored card.
 *
 * Resolving the `Bk` suffix in one place is what keeps an adapter from having to say everything
 * twice, and from pairing a front's colour with a back's text.
 */
function face(card: TwoFacedCard, back: boolean): CardFace {
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
function buildFace(source: CardFace, href: string | undefined): PrintableCard | null {
    const card: PrintableCard = {};
    const body = sanitizeHtml(decodeCardText(source.text));

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
 * Lay a set of two-faced cards out as two columns to join.
 *
 * @param html - The component's stored HTML, for the sidecars
 * @param prefix - The iDevice's sidecar class prefix
 * @param dataGame - The payload
 * @param options - The adapter's own options, for the omission report and the random source
 * @returns The page-sized groups, or null when nothing survives
 */
export function buildFacingColumns(
    html: string,
    prefix: string,
    dataGame: TwoFacedDataGame,
    options: WorksheetAdapterOptions = {},
): PrintableCardGroup[] | null {
    const random: RandomSource = options.random ?? Math.random;
    const frontImages = extractMediaLinks(html, prefix, 'Images');
    const backImages = extractMediaLinks(html, prefix, 'ImagesBack');

    // Unusable cards go before the share is applied, so a pair that cannot be printed does not
    // take up part of the number the teacher asked for. The runtimes have no such problem, since
    // every card works on screen.
    const pairs = indexedQuestions(dataGame.cardsGame ?? [], options).flatMap(({ question, index }) => {
        const frontFace = face(question, false);
        const backFace = face(question, true);
        const front = buildFace(frontFace, frontImages.get(index) ?? frontFace.url);
        const back = buildFace(backFace, backImages.get(index) ?? backFace.url);

        // Both faces have to carry something: a pair with a blank side cannot be matched, and
        // printing it would set the student an impossible line to draw.
        if (front && back) return [{ front, back }];
        options.onOmission?.('media-required');
        return [];
    });

    const selected = selectQuestions(pairs, dataGame.percentajeCards, dataGame.randomCards, random);
    if (selected.length === 0) return null;

    return groupMatchingCards(
        selected.map(pair => [pair.front, pair.back]),
        random,
    );
}
