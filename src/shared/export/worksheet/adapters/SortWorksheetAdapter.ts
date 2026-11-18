/**
 * Sort ('ordena') worksheet adapter
 *
 * Turns a put-in-order activity into a printable exercise. It has two modes, and they print
 * differently because they ask different things:
 *
 * - **Sentence.** The words come out of order, separated by bars, with a line underneath to write
 *   the sentence out in its proper order.
 * - **Multimedia.** The cards come out of order, each over a line where the student writes the
 *   position it belongs in. Paper cannot be dragged, so the order is written rather than made.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'ordena'.
 * - `type` picks the mode: 0 is the sentence, anything else the cards. The runtime treats a
 *   missing value as the card mode, and so does this.
 * - An activity holds several rounds in `phrasesGame`, each a sentence or its own set of cards.
 *   Each round becomes one question on the sheet.
 * - `percentajeQuestions` applies, and the draw is always random: the runtime passes the flag
 *   hardcoded, so there is no stored order to honour.
 * - Media links are keyed twice over, unlike every sibling: the class carries the round
 *   (`ordena-LinkImages-0`) and the link text the card within it.
 * - `eText` is stored as typed, as in Classify and unlike the rest of the family, so it is not
 *   unescaped here.
 * - A card's `order` is where it belongs. That is the answer, and is never printed.
 */

import { extractDataGame, extractDivContent, extractMediaLinksByClass } from '../dataGameReader';
import { type RandomSource, selectQuestions, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableCard,
    PrintableActivity,
    PrintableItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'ordena';

/** `type` 0 puts a sentence in order; anything else, a set of cards. */
const SENTENCE_MODE = 0;

/** What a card carries, stored in `type`. */
const CARD_TYPE_IMAGE = 0;
const CARD_TYPE_TEXT = 1;
const CARD_TYPE_BOTH = 2;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** Fewest columns the activity will lay its cards out in, and so head. */
const MIN_COLUMNS = 2;

/** Separator printed between the words of a scrambled sentence. */
const WORD_SEPARATOR = ' / ';

/** One card of a round. */
interface SortCard {
    /** 0 a picture, 1 text, 2 both. */
    type?: number;
    /** The card's text, as typed. */
    eText?: string;
    url?: string;
    alt?: string;
    author?: string;
    /** Sound clip, which has no paper equivalent. */
    audio?: string;
    /** Where the card belongs. Never printed. */
    order?: number;
}

/** One round: a sentence to put in order, or a set of cards. */
interface SortPhrase {
    phrase?: string;
    definition?: string;
    cards?: SortCard[];
}

/** The Sort activity payload. */
interface SortDataGame {
    instructions?: string;
    phrasesGame?: SortPhrase[];
    /** 0 is the sentence mode, anything else the cards. */
    type?: number;
    /** Share of the stored rounds the activity actually uses. */
    percentajeQuestions?: number;
    /** How many columns the cards are laid out in. */
    gameColumns?: number;
    /** Whether the first row is fixed headings rather than cards to place. */
    orderedColumns?: boolean;
}

/** A round paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedPhrase {
    question: SortPhrase;
    index: number;
}

/**
 * Convert one stored card into a printable one.
 *
 * @returns The card, or null when it carries nothing that can be printed
 */
function buildCard(card: SortCard, src: string): PrintableCard | null {
    const printable: PrintableCard = {};

    if (card.type === CARD_TYPE_TEXT || card.type === CARD_TYPE_BOTH) {
        const text = sanitizeHtml(card.eText ?? '');
        if (text) printable.text = text;
    }

    if (card.type === CARD_TYPE_IMAGE || card.type === CARD_TYPE_BOTH) {
        if (src.length >= MIN_MEDIA_HREF_LENGTH) {
            printable.media = { kind: 'image', src, alt: card.alt || undefined, author: card.author || undefined };
        }
    }

    return printable.text || printable.media ? printable : null;
}

/**
 * Build the question for one round of the card mode.
 *
 * @returns The question, or null when no card in the round can be printed
 */
function buildCardRound(
    { question: round, index }: IndexedPhrase,
    html: string,
    columns: number,
    headings: number,
    random: RandomSource,
    options: WorksheetAdapterOptions,
): PrintableItem | null {
    // Keyed by round and then by card, so each round carries its own set of links.
    const imageLinks = extractMediaLinksByClass(html, `${PREFIX}-LinkImages-${index}`);
    const stored = Array.isArray(round.cards) ? round.cards : [];

    const printableCards = stored.map((card, position) => {
        const printable = buildCard(card, imageLinks.get(position) ?? card.url ?? '');
        if (printable) return printable;
        // A card carrying only a sound clip is playable on screen and blank on paper.
        options.onOmission?.('media-required');
        return null;
    });

    // Headings identify columns. Removing one would move the next heading and promote an answer
    // into the fixed row, so a round without all its headings cannot be printed faithfully.
    const headers = Math.min(headings, stored.length);
    if (printableCards.slice(0, headers).some(card => card === null)) return null;
    const cards = printableCards.filter((card): card is PrintableCard => card !== null);
    if (cards.length === 0) return null;

    // With fixed headings the activity keeps its first row where it belongs and shuffles only what
    // is below it (`getFixedOrder`), so the same holds on paper: the headings are given, and only
    // the rest are shuffled and numbered.
    const given = cards.slice(0, headers);
    const asked = shuffleWith(cards.slice(headers), random);

    return {
        prompt: sanitizeHtml(round.definition),
        answer: {
            kind: 'orderCards',
            cards: [...given, ...asked],
            ...(columns >= MIN_COLUMNS ? { columns } : {}),
            ...(headers > 0 ? { headers } : {}),
        },
    };
}

/**
 * Build the question for one round of the sentence mode.
 *
 * @returns The question, or null when the round holds no sentence
 */
function buildSentenceRound(round: SortPhrase, random: RandomSource): PrintableItem | null {
    const words = (round.phrase ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word.length > 0);

    if (words.length === 0) return null;

    const statement = sanitizeHtml(round.definition);
    const scrambled = sanitizeHtml(shuffleWith(words, random).join(WORD_SEPARATOR));
    return {
        // Out of order and separated by bars, so each word is legible as its own.
        prompt: (statement ? `<div>${statement}</div>` : '') + scrambled,
        // One line to write the sentence out in its proper order.
        answer: { kind: 'writingSpace', lines: 1 },
    };
}

export const SortWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'sort',
    defaultTitle: 'Sort',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<SortDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.phrasesGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const sentences = dataGame.type === SENTENCE_MODE;

        // Fixed headings need columns to head, so the activity itself ignores the setting below
        // two. The first row is then one card per column, given rather than asked.
        const columns = Number.parseInt(String(dataGame.gameColumns), 10);
        const laidOut = Number.isFinite(columns) && columns >= MIN_COLUMNS ? columns : 0;
        const headings = dataGame.orderedColumns === true ? laidOut : 0;

        // The share is applied as the runtime applies it, at random: it passes the flag hardcoded,
        // so there is no stored order for a sheet to keep.
        const rounds = selectQuestions(
            dataGame.phrasesGame.map((question, index) => ({ question, index })),
            dataGame.percentajeQuestions,
            true,
            random,
        );

        const items = rounds.flatMap(entry => {
            const item = sentences
                ? buildSentenceRound(entry.question, random)
                : buildCardRound(entry, html, laidOut, headings, random, options);
            return item ? [item] : [];
        });

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'sort',
            title: options.title || SortWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
