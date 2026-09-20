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
        // Stored as typed, unlike the other gamified iDevices: this editor writes `eText` straight
        // from the input and the runtime injects it without decoding. Unescaping it here would
        // rewrite a teacher's own '%41' into 'A'.
        const text = sanitizeHtml(card.eText ?? '');
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

/** Smallest and largest number of containers the activity works with. */
const MIN_GROUPS = 2;
const MAX_GROUPS = 9;

/**
 * Work out how many containers the activity uses, as the runtime does.
 *
 * A stored `numberGroups` is honoured when it is one of the values the activity supports. Projects
 * saved by older versions carry `null` there, and the runtime infers the count from the highest
 * group any card belongs to rather than from how many names happen to be stored — an activity can
 * keep nine names from before the number was turned down.
 *
 * @param numberGroups - The stored count, often null in older projects
 * @param cards - The stored cards, whose `group` says which container they belong in
 */
function countContainers(numberGroups: unknown, cards: ClassifyCard[]): number {
    const stored = Number.parseInt(String(numberGroups), 10);
    if (Number.isFinite(stored) && stored >= MIN_GROUPS && stored <= MAX_GROUPS) return stored;

    const highest = cards.reduce((max, card) => {
        const group = Number.parseInt(String(card?.group), 10);
        return Number.isFinite(group) ? Math.max(max, group) : max;
    }, 1);

    return Math.min(Math.max(highest + 1, MIN_GROUPS), MAX_GROUPS);
}

/**
 * Give each container a name and an outline colour.
 *
 * Short of names, the runtime pads with a numbered label and so does this, so a card never ends up
 * without a container to be matched to.
 *
 * @param groups - The stored names
 * @param wanted - How many containers the activity uses
 */
function buildContainers(groups: string[], wanted: number): PrintableContainer[] {
    const named = groups.map(name => (typeof name === 'string' ? name.trim() : ''));

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
            countContainers(dataGame.numberGroups, dataGame.wordsGame),
        );

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

        // A card carrying only a sound clip is a valid activity card — the editor accepts it and
        // the runtime gives it a play button — but there is nothing to print for it. It is left
        // out and reported, so a worksheet missing a card never looks complete.
        const cards = shuffleWith(selected, random).flatMap(entry => {
            const card = buildCard(entry, imageLinks);
            if (card) return [card];
            options.onOmission?.('media-required');
            return [];
        });

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
