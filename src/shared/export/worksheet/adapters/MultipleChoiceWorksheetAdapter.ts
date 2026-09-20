/**
 * Quick questions multiple choice ('selecciona') worksheet adapter
 *
 * Turns a Select activity into a printable exercise. It is the richest of the question iDevices:
 * each question is one of three kinds, held in `typeSelect`.
 *
 * - 0, Select: tick the right option or options.
 * - 1, Order: the same options, but with a line beside each to write its position on.
 * - 2, Word: write a word, so it prints one box per character of `solutionQuestion`, giving away
 *   the share of its letters the question asks for, exactly as Guess does.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'selecciona', and the questions live in `selectsGame`.
 * - `type` follows the usual media convention, and video questions are left out: a video cannot
 *   be put on paper.
 * - `order` holds how the questions are sequenced: 0 in order, 1 at random, 2 as a tree. Older
 *   activities have no `order` and fall back to `optionsRamdon`, as the runtime does.
 * - A tree is a branching path, which paper cannot follow, so it is printed as a random draw.
 *   That is a deliberate departure: the runtime skips selection altogether in tree mode, while
 *   here the share of questions is applied to it like any other.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import {
    buildAnswerBoxes,
    indexedQuestions,
    readPrintableOptions,
    selectQuestions,
    type RandomSource,
} from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableAnswer,
    PrintableItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'selecciona';

/** Question kinds stored in `selectsGame[].type`. */
const QUESTION_TYPE_IMAGE = 1;
const QUESTION_TYPE_VIDEO = 2;
const QUESTION_TYPE_RICH_TEXT = 3;

/** Answer kinds stored in `selectsGame[].typeSelect`. */
const SELECT_KIND_ORDER = 1;
const SELECT_KIND_WORD = 2;

/** How the questions are sequenced, stored in `order`. */
const ORDER_RANDOM = 1;
const ORDER_TREE = 2;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** One question as stored by the Select iDevice. */
interface SelectQuestion {
    /** 0 tick an option, 1 put the options in order, 2 write a word. */
    typeSelect?: number;
    type?: number;
    quextion?: string;
    options?: string[];
    numberOptions?: number;
    /** The right answer. Never printed. */
    solution?: string | number;
    /** The word to write, when `typeSelect` is 2. */
    solutionQuestion?: string;
    /** Share of that word's letters given away, as in Guess. */
    percentageShow?: number;
    url?: string;
    alt?: string;
    author?: string;
    eText?: string;
}

/** The Select activity payload. */
interface SelectDataGame {
    instructions?: string;
    selectsGame?: SelectQuestion[];
    /** Share of the stored questions the activity actually asks. */
    percentajeQuestions?: number;
    /** 0 in order, 1 at random, 2 as a tree. Absent on activities saved before it existed. */
    order?: number;
    /** What older activities used instead of `order`. */
    optionsRamdon?: boolean;
    /** Whether the options of a question are shuffled. */
    answersRamdon?: boolean;
}

/** A question paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedQuestion {
    question: SelectQuestion;
    index: number;
}

/**
 * Decide whether the questions are drawn at random.
 *
 * A tree counts as random here: its branching cannot be printed, so a random draw is the closest
 * paper equivalent. Activities predating `order` fall back to `optionsRamdon`, as the runtime does.
 */
export function isRandomOrder(dataGame: SelectDataGame): boolean {
    if (typeof dataGame.order !== 'number') return dataGame.optionsRamdon === true;

    return dataGame.order === ORDER_RANDOM || dataGame.order === ORDER_TREE;
}

/**
 * Build the answer space for one question, which depends on its kind.
 *
 * @returns The answer, or null when there is nothing for the student to fill in
 */
function buildAnswer(question: SelectQuestion, dataGame: SelectDataGame, random: RandomSource): PrintableAnswer | null {
    if (question.typeSelect === SELECT_KIND_WORD) {
        // Nothing is given away: this iDevice has no setting for hint letters.
        // The runtime always upper-cases here, so the printed boxes read like the on-screen ones.
        const groups = buildAnswerBoxes(question.solutionQuestion, question.percentageShow, false, random);
        return groups.length > 0 ? { kind: 'characterBoxes', groups } : null;
    }

    const labels = readPrintableOptions(
        question.options,
        question.numberOptions,
        dataGame.answersRamdon === true,
        random,
    );
    if (labels.length === 0) return null;

    // An ordering question asks for a position rather than a tick, so its options get a line to
    // write the number on instead of a box.
    const marker = question.typeSelect === SELECT_KIND_ORDER ? 'line' : 'box';

    return { kind: 'options', labels, marker };
}

/**
 * Convert one stored question into a printable item.
 *
 * @returns The item, or null when it offers nothing to answer
 */
function buildItem(
    { question, index }: IndexedQuestion,
    dataGame: SelectDataGame,
    imageLinks: Map<number, string>,
    random: RandomSource,
): PrintableItem | null {
    const answer = buildAnswer(question, dataGame, random);
    const prompt = sanitizeHtml(question.quextion);

    if (!answer && !prompt) return null;

    const item: PrintableItem = { prompt };
    if (answer) item.answer = answer;

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
        const extraText = sanitizeHtml(unescape(question.eText));
        if (extraText) item.extraText = extraText;
    }

    return item;
}

export const MultipleChoiceWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'quick-questions-multiple-choice',
    defaultTitle: 'Select',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<SelectDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.selectsGame)) return null;

        const random = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // Video questions go before the share is applied, so it governs how much of the printable
        // activity is asked rather than coming out short by however many the draw happened to hit.
        const printable = indexedQuestions(dataGame.selectsGame, options).filter(entry => {
            if (entry.question.type !== QUESTION_TYPE_VIDEO) return true;
            options.onOmission?.('media-required');
            return false;
        });

        const selected = selectQuestions<IndexedQuestion>(
            printable,
            dataGame.percentajeQuestions,
            isRandomOrder(dataGame),
            random,
        );

        const items = selected
            .map(entry => buildItem(entry, dataGame, imageLinks, random))
            .filter((item): item is PrintableItem => item !== null);

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'quick-questions-multiple-choice',
            title: options.title || MultipleChoiceWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
