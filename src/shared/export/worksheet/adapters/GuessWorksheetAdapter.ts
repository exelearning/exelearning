/**
 * Guess ('adivina') worksheet adapter
 *
 * Turns a Guess activity into a printable exercise: the author's instructions, then one numbered
 * question per hidden word, each with its picture (when it has one) and a row of empty boxes —
 * one per character of the solution, so the length is visible but the answer is not.
 *
 * Data layout notes that are easy to get wrong:
 * - The DataGame class prefix is 'adivina', not 'guess'. It cannot be derived from the type.
 * - `definition` is the clue shown to the student; `word` is the solution.
 * - Picture URLs come from the sidecar links, not from `url` inside the payload. See
 *   dataGameReader for why, and guess/export/guess.js `loadDataGame` for the same override at
 *   runtime — including its rule that an href under 4 characters means "no picture".
 * - `eText` is stored escape()'d, matching guess/export/guess.js:1149.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { buildAnswerBoxes, indexedQuestions, type RandomSource, selectQuestions } from '../questionSelection';
import { escapeText, htmlToText, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'adivina';

/** Question kinds stored in `wordsGame[].type`. */
const QUESTION_TYPE_IMAGE = 1;
const QUESTION_TYPE_RICH_TEXT = 3;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** Default share of letters given away when neither question nor activity sets one. */
const DEFAULT_PERCENTAGE_SHOW = 35;

/** One question as stored by the Guess iDevice. */
interface GuessWord {
    word?: string;
    definition?: string;
    type?: number;
    url?: string;
    alt?: string;
    author?: string;
    eText?: string;
    /** Share of this solution's letters to give away. Falls back to the activity's value. */
    percentageShow?: number;
}

/** The Guess activity payload. */
interface GuessDataGame {
    instructions?: string;
    wordsGame?: GuessWord[];
    /** Share of the stored questions the activity actually asks. */
    percentajeQuestions?: number;
    /** Whether questions are drawn and ordered at random. */
    optionsRamdon?: boolean;
    /** Activity-wide fallback for the share of letters given away. */
    percentageShow?: number;
    caseSensitive?: boolean;
}

/** A question paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedWord {
    question: GuessWord;
    index: number;
}

/**
 * Convert one stored question into a printable item.
 *
 * @returns The item, or null when the question has no solution to draw boxes for
 */
function buildItem(
    { question, index }: IndexedWord,
    dataGame: GuessDataGame,
    imageLinks: Map<number, string>,
    random: RandomSource,
): PrintableItem | null {
    // The runtime falls back from the question's own setting to the activity's; so do we.
    const percentageShow = question.percentageShow ?? dataGame.percentageShow ?? DEFAULT_PERCENTAGE_SHOW;
    const groups = buildAnswerBoxes(question.word, percentageShow, dataGame.caseSensitive === true, random);
    if (groups.length === 0) return null;

    const item: PrintableItem = {
        prompt: escapeText(htmlToText(question.definition)),
        answer: { kind: 'characterBoxes', groups },
    };

    if (question.type === QUESTION_TYPE_IMAGE) {
        const src = imageLinks.get(index) ?? question.url ?? '';
        if (src.length >= MIN_MEDIA_HREF_LENGTH) {
            item.media = {
                kind: 'image',
                src,
                alt: question.alt || undefined,
                author: question.author || undefined,
            };
        }
    }

    if (question.type === QUESTION_TYPE_RICH_TEXT && question.eText) {
        // Mirrors the runtime, which unescapes before injecting. On payloads that were never
        // escaped this is a no-op, so both eras of stored data read correctly.
        const extraText = sanitizeHtml(unescape(question.eText));
        if (extraText) item.extraText = extraText;
    }

    return item;
}

export const GuessWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'guess',
    defaultTitle: 'Guess',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<GuessDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame)) return null;

        const random = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // Selection happens on index-carrying pairs: the sidecar links are keyed by a question's
        // position in the stored array, which selecting and shuffling would otherwise destroy.
        const selected = selectQuestions<IndexedWord>(
            indexedQuestions(dataGame.wordsGame, options).filter(({ question }) => {
                if (question.type !== 2) return true;
                options.onOmission?.('media-required');
                return false;
            }),
            dataGame.percentajeQuestions,
            dataGame.optionsRamdon,
            random,
        );

        const items = selected
            .map(entry => buildItem(entry, dataGame, imageLinks, random))
            .filter((item): item is PrintableItem => item !== null);

        // An activity whose questions all lack a solution has nothing printable in it.
        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'guess',
            title: options.title || GuessWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
