/**
 * Select multimedia ('select-media-files') worksheet adapter
 *
 * Prints each question with its picture, and the cards to choose from underneath: a box to tick
 * beside each one, and the card's own words below the picture they belong to.
 *
 * On screen the cards are clicked and checked. On paper the choosing is the same act, so what the
 * sheet loses is only the checking — and the cards that are nothing but a sound, which paper has no
 * way to offer.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'seleccionamedias', not the iDevice's name.
 * - A question is `definition`, which is what the runtime draws; `phrase` sits beside it in older
 *   payloads and is drawn by nothing, so it is not read here either.
 * - Media URLs come from the sidecars, never from the payload. The question's own picture is keyed
 *   by question index under one class; a card's is keyed twice over, as Sort keys its own — the
 *   class carries the question (`seleccionamedias-LinkImages-0`) and the link text the card.
 * - `state` marks the card as one of the right answers. It is never printed.
 * - `numberMaxCards` caps how many cards a question puts in play, drawn at random and returned to
 *   stored order. Questions are drawn at random too, always: this activity offers no way to turn
 *   that off.
 * - Cards carry the author's colours, read for paper by `cardColors` as Relate and Flip cards do.
 */

import { cardAccent, textInk } from '../cardColors';
import { extractDataGame, extractDivContent, extractMediaLinksByClass } from '../dataGameReader';
import { selectCards, selectQuestions, type RandomSource } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableCard,
    PrintableItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'seleccionamedias';

/** Sidecar class holding the picture of each question, keyed by question index. */
const QUESTION_IMAGES = `${PREFIX}-LinkImagesDef`;

/** One card to choose from. */
interface MediaCard {
    /** The card's own words, stored raw. */
    eText?: string;
    /** The picture, whose current URL is in the sidecar rather than here. */
    url?: string;
    /** A sound, which paper cannot offer. */
    audio?: string;
    alt?: string;
    color?: string;
    backcolor?: string;
    /** Whether this card is one of the right answers. Never printed. */
    state?: boolean;
}

/** One question and the cards it offers. */
interface MediaQuestion {
    /** The question as the runtime draws it. */
    definition?: string;
    /** The question's own picture; the sidecar holds the URL that still resolves. */
    url?: string;
    alt?: string;
    author?: string;
    cards?: MediaCard[];
}

/** The Select multimedia payload. */
interface SelectMediaDataGame {
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    phrasesGame?: MediaQuestion[];
    percentajeQuestions?: number;
    /** How many cards a question puts in play, stored as the editor's input yields it. */
    numberMaxCards?: unknown;
}

/**
 * One card as it prints, or null when nothing of it can be printed.
 *
 * A card that is only a sound has nothing to choose between: a box beside an empty space offers
 * the student no way to tell it from the next one.
 */
function buildCard(card: MediaCard, src: string | undefined): PrintableCard | null {
    const text = sanitizeHtml(card.eText);
    if (!src && !text) return null;

    const printable: PrintableCard = {};
    if (src) printable.media = { kind: 'image', src, alt: card.alt || undefined };
    if (text) printable.text = text;

    const ink = textInk(card.color);
    const accent = cardAccent(card.backcolor);
    if (text && ink) printable.textColor = ink;
    if (accent) printable.accentColor = accent;

    return printable;
}

/** One question: its words, its picture, then the cards to tick. */
function buildQuestion(
    question: MediaQuestion,
    images: Map<number, string>,
    questionImage: string | undefined,
    max: unknown,
    random: RandomSource,
): PrintableItem | null {
    const cards = selectCards(question.cards ?? [], max, random)
        .map((card, index) => buildCard(card ?? {}, images.get(index)))
        .filter((card): card is PrintableCard => card !== null);

    // Without cards there is nothing to choose between, whatever the question says.
    if (cards.length === 0) return null;

    const item: PrintableItem = { prompt: sanitizeHtml(question.definition), answer: { kind: 'mediaOptions', cards } };
    if (questionImage)
        item.media = {
            kind: 'image',
            src: questionImage,
            alt: question.alt || undefined,
            author: question.author || undefined,
        };

    return item;
}

export const SelectMediaFilesWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'select-media-files',
    defaultTitle: 'Select multimedia',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<SelectMediaDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.phrasesGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const questionImages = extractMediaLinksByClass(html, QUESTION_IMAGES);

        const items = dataGame.phrasesGame.flatMap((question, index) => {
            // A card's picture is keyed twice: the class says which question, the link text which
            // card. Reading the class per question is what keeps the two apart.
            const cardImages = extractMediaLinksByClass(html, `${PREFIX}-LinkImages-${index}`);
            const item = buildQuestion(
                question ?? {},
                cardImages,
                questionImages.get(index),
                dataGame.numberMaxCards,
                random,
            );

            if (item) return [item];
            options.onOmission?.('media-required');
            return [];
        });

        // The draw is always random here: the activity offers no way to turn it off.
        const selected = selectQuestions(items, dataGame.percentajeQuestions, true, random);
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'select-media-files',
            title: options.title || SelectMediaFilesWorksheetAdapter.defaultTitle,
            items: selected,
        };

        // The div is what the asset pass rewrote; the payload's copy is the escaped, stale one.
        const instructions = sanitizeHtml(
            extractDivContent(html, `${PREFIX}-instructions`) ||
                (dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions),
        );
        if (instructions) activity.instructions = instructions;

        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
