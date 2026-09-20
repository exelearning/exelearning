/**
 * Quick questions ('quext') worksheet adapter
 *
 * Turns a Test activity into a printable exercise: each question with its picture, its options
 * and a box to tick beside each one.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'quext'.
 * - `quextion` is the question text and is HTML, unlike the plain-text clues of Guess.
 * - Only the first `numberOptions` entries of `options` are in play; the array is padded to four.
 * - `solution` is the index of the right answer. A worksheet never prints it.
 * - `type` follows the same convention as Guess: 0 plain, 1 picture, 2 video, 3 rich text.
 *   Video questions are left out — a video cannot be put on paper, and a question that only makes
 *   sense once you have watched one is not answerable from the sheet.
 * - Selection uses the shared helper, since this iDevice calls it too, honouring both the share of
 *   questions it asks and whether they are drawn at random.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { readPrintableOptions, indexedQuestions, type RandomSource, selectQuestions } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'quext';

/** Question kinds stored in `questionsGame[].type`. */
const QUESTION_TYPE_IMAGE = 1;
const QUESTION_TYPE_VIDEO = 2;
const QUESTION_TYPE_RICH_TEXT = 3;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** One question as stored by the Test iDevice. */
interface QuextQuestion {
    type?: number;
    quextion?: string;
    options?: string[];
    /** How many of `options` are in play; the array itself is padded to four. */
    numberOptions?: number;
    /** Index of the right answer. Never printed. */
    solution?: number;
    url?: string;
    alt?: string;
    author?: string;
    eText?: string;
}

/** The Test activity payload. */
interface QuextDataGame {
    instructions?: string;
    questionsGame?: QuextQuestion[];
    /** Share of the stored questions the activity actually asks. */
    percentajeQuestions?: number;
    /** Whether questions are drawn and ordered at random. */
    optionsRamdon?: boolean;
    /** Whether the options of a question are shuffled. */
    answersRamdon?: boolean;
}

/** A question paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedQuestion {
    question: QuextQuestion;
    index: number;
}

/**
 * Convert one stored question into a printable item.
 *
 * @returns The item, or null when it offers nothing to answer
 */
function buildItem(
    { question, index }: IndexedQuestion,
    dataGame: QuextDataGame,
    imageLinks: Map<number, string>,
    random: RandomSource,
): PrintableItem | null {
    const labels = readPrintableOptions(
        question.options,
        question.numberOptions,
        dataGame.answersRamdon === true,
        random,
    );
    const prompt = sanitizeHtml(question.quextion);

    // Nothing to tick and nothing to read is not a question.
    if (labels.length === 0 && !prompt) return null;

    const item: PrintableItem = {
        prompt,
        answer: { kind: 'options', labels },
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
        // Mirrors the runtime, which unescapes before injecting.
        const extraText = sanitizeHtml(unescape(question.eText));
        if (extraText) item.extraText = extraText;
    }

    return item;
}

export const QuickQuestionsWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'quick-questions',
    defaultTitle: 'Test',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<QuextDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.questionsGame)) return null;

        const random = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // Video questions are dropped before the share is applied, so the share governs how much
        // of the printable activity is asked rather than coming out short by however many videos
        // the draw happened to catch.
        const printable = indexedQuestions(dataGame.questionsGame, options).filter(entry => {
            if (entry.question.type !== QUESTION_TYPE_VIDEO) return true;
            options.onOmission?.('media-required');
            return false;
        });

        const selected = selectQuestions<IndexedQuestion>(
            printable,
            dataGame.percentajeQuestions,
            dataGame.optionsRamdon,
            random,
        );

        const items = selected
            .map(entry => buildItem(entry, dataGame, imageLinks, random))
            .filter((item): item is PrintableItem => item !== null);

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'quick-questions',
            title: options.title || QuickQuestionsWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
