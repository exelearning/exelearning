/**
 * Classify ('clasifica') worksheet adapter
 *
 * Turns a Classify activity into a printable matching exercise: the cards down the left, the
 * containers they belong in down the right, and room between them for the student to pair them up.
 *
 * On screen the student drags each card into a container. Paper cannot be dragged, so the two
 * sides are simply laid out facing each other.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'clasifica'.
 * - Cards live in `wordsGame`, containers in `groups` — plain names, with no colour of their own,
 *   so one is assigned by position.
 * - A card's `group` is the container it belongs to. That is the answer, and is never printed.
 * - `type` says what a card carries: 0 a picture, 1 text, 2 both.
 * - `percentajeQuestions` is applied in stored order, as the runtime does, and the cards are then
 *   shuffled so their order gives nothing away.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { selectQuestions, indexedQuestions, type RandomSource, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableCard,
    PrintableContainer,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'clasifica';

/** What a card carries, stored in `type`. */
const CARD_TYPE_IMAGE = 0;
const CARD_TYPE_TEXT = 1;
const CARD_TYPE_BOTH = 2;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/**
 * Outline colours for the containers, assigned by position.
 *
 * The activity stores names only, so the colours are ours. They are dark enough to stay legible
 * printed in greyscale, and the list wraps round if an activity has more containers than colours.
 */
const CONTAINER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#d35400', '#8e44ad', '#16a085', '#b7950b', '#2c3e50'];

/** One card as stored by the Classify iDevice. */
interface ClassifyCard {
    /** 0 a picture, 1 text, 2 both. */
    type?: number;
    /** The card's text, escaped. */
    eText?: string;
    url?: string;
    alt?: string;
    author?: string;
    /** Which container it belongs in. Never printed. */
    group?: number;
}

/** The Classify activity payload. */
interface ClassifyDataGame {
    instructions?: string;
    wordsGame?: ClassifyCard[];
    /** Container names. */
    groups?: string[];
    /** How many of them the activity actually uses. */
    numberGroups?: number;
    /** Share of the stored cards the activity actually uses. */
    percentajeQuestions?: number;
}

/** A card paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedCard {
    question: ClassifyCard;
    index: number;
}

/**
 * Convert one stored card into a printable one.
 *
 * @returns The card, or null when it carries neither text nor a picture
 */
function buildCard({ question: card, index }: IndexedCard, imageLinks: Map<number, string>): PrintableCard | null {
    const printable: PrintableCard = {};

    if (card.type === CARD_TYPE_TEXT || card.type === CARD_TYPE_BOTH) {
        // Mirrors the runtime, which unescapes before injecting.
        const text = sanitizeHtml(unescape(card.eText ?? ''));
        if (text) printable.text = text;
    }

    if (card.type === CARD_TYPE_IMAGE || card.type === CARD_TYPE_BOTH) {
        const src = imageLinks.get(index) ?? card.url ?? '';
        if (src.length >= MIN_MEDIA_HREF_LENGTH) {
            printable.media = {
                kind: 'image',
                src,
                alt: card.alt || undefined,
                author: card.author || undefined,
            };
        }
    }

    return printable.text || printable.media ? printable : null;
}

/**
 * Give each container a name and an outline colour.
 *
 * Only as many as the activity is configured to use are kept. An activity can store more names
 * than that, from before the number was turned down, and those extra ones are not part of the
 * exercise. Short of names, the runtime falls back to a numbered label and so does this.
 *
 * @param groups - The stored names
 * @param numberGroups - How many containers the activity uses; all of them when absent
 */
function buildContainers(groups: string[], numberGroups: number | undefined): PrintableContainer[] {
    const named = groups.map(name => (typeof name === 'string' ? name.trim() : ''));
    const wanted =
        typeof numberGroups === 'number' && Number.isFinite(numberGroups) && numberGroups > 0
            ? numberGroups
            : named.length;

    return Array.from({ length: wanted }, (_, index) => ({
        name: named[index] || `Group ${index + 1}`,
        color: CONTAINER_COLORS[index % CONTAINER_COLORS.length],
    }));
}

export const ClassifyWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'classify',
    defaultTitle: 'Classify',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<ClassifyDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame)) return null;

        const containers = buildContainers(
            Array.isArray(dataGame.groups) ? dataGame.groups : [],
            dataGame.numberGroups,
        );
        if (containers.length === 0) return null;

        const random: RandomSource = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // The share is taken in stored order, as the runtime does; the shuffle comes after, so the
        // printed order of the cards gives nothing away about where they belong.
        const selected = selectQuestions<IndexedCard>(
            indexedQuestions(dataGame.wordsGame, options),
            dataGame.percentajeQuestions,
            false,
            random,
        );

        const cards = shuffleWith(selected, random)
            .map(entry => buildCard(entry, imageLinks))
            .filter((card): card is PrintableCard => card !== null);

        if (cards.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'classify',
            title: options.title || ClassifyWorksheetAdapter.defaultTitle,
            board: { kind: 'matchColumns', cards, containers },
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
