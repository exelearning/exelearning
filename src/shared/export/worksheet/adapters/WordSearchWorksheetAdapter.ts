/**
 * Word search ('sopa') worksheet adapter
 *
 * Turns a word search into a printable exercise: the grid on top, the numbered clues below, each
 * with its illustration underneath when it has one.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'sopa', not the iDevice's name.
 * - `wordsGame[i]` carries the answer in `word` and the clue in `definition`. The editor caps a
 *   word at fourteen characters and forbids spaces, so every answer is a single token.
 * - `reverses` and `diagonals` say which directions a word may run in. They are passed straight to
 *   the layout, which means the same eight orientations the activity uses.
 * - `percentajeQuestions` is applied in stored order: unlike its siblings, the runtime asks for no
 *   random draw (`getQuestions` is called without the flag).
 * - The grid itself is not stored. The activity builds one on every load, so a printed grid could
 *   never match the screen; this builds its own with the same rules.
 * - Audio exists per word and has no paper equivalent, so a clue that is only sound is reported.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { indexedQuestions, type RandomSource, selectQuestions } from '../questionSelection';
import { escapeText, htmlToText, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';
import { buildWordSearchLayout } from '../wordSearchLayout';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'sopa';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** One clue as stored by the Word search iDevice. */
interface SearchWord {
    /** The answer hidden in the grid. */
    word?: string;
    /** The clue the student reads. */
    definition?: string;
    url?: string;
    alt?: string;
    author?: string;
    /** Sound clip, which has no paper equivalent. */
    audio?: string;
}

/** The Word search activity payload. */
interface SearchDataGame {
    instructions?: string;
    wordsGame?: SearchWord[];
    /** Share of the stored words the activity actually asks. */
    percentajeQuestions?: number;
    /** Whether a word may run backwards. */
    reverses?: boolean;
    /** Whether a word may run diagonally. */
    diagonals?: boolean;
}

/** A word paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedWord {
    question: SearchWord;
    index: number;
}

/**
 * Build the clue for one word.
 */
function buildClue(entry: IndexedWord, number: number, imageLinks: Map<number, string>): PrintableItem {
    const { question: word, index } = entry;

    const item: PrintableItem = {
        prompt: escapeText(htmlToText(word.definition)),
        // The answer is found in the shared grid, so the clue has no writing space of its own.
        number,
    };

    const src = imageLinks.get(index) ?? word.url ?? '';
    if (src.length >= MIN_MEDIA_HREF_LENGTH) {
        item.media = {
            kind: 'image',
            src,
            alt: word.alt || undefined,
            author: word.author || undefined,
            // Small: a clue illustration sits under its text without taking the page over.
            size: 'small',
        };
    }

    return item;
}

export const WordSearchWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'word-search',
    defaultTitle: 'Word search',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<SearchDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // The share is taken in stored order, as the runtime takes it.
        const selected = selectQuestions<IndexedWord>(
            indexedQuestions(dataGame.wordsGame, options).filter(({ question }) => {
                if ((question.word ?? '').trim()) return true;
                // Without an answer there is nothing to hide in the grid.
                options.onOmission?.('invalid-data');
                return false;
            }),
            dataGame.percentajeQuestions,
            false,
            random,
        );

        const layout = buildWordSearchLayout(
            selected.map(entry => entry.question.word),
            {
                reverses: dataGame.reverses === true,
                diagonals: dataGame.diagonals === true,
                randomSource: random,
            },
        );

        if (layout.rows.length === 0) return null;

        // Only the words that found a place are asked about, and they are numbered as they are
        // listed rather than in the order the solver happened to seat them.
        const placed = new Set(layout.placements.map(placement => placement.index));
        const asked = selected.filter((_, index) => placed.has(index));

        const omitted = selected.length - asked.length;
        if (omitted > 0) options.onOmission?.('unplaced-word', omitted);

        const items = asked.flatMap((entry, position) => {
            const clue = buildClue(entry, position + 1, imageLinks);
            if (clue.prompt || clue.media) return [clue];
            // A clue that is only a sound clip has nothing to read on paper.
            options.onOmission?.('media-required');
            return [];
        });

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'word-search',
            title: options.title || WordSearchWorksheetAdapter.defaultTitle,
            board: { kind: 'wordGrid', rows: layout.rows },
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
