/**
 * Adaptative quiz ('adaptative-quiz') worksheet adapter
 *
 * Prints every question the quiz holds, each in the shape its own kind calls for.
 *
 * The adapting is what does not survive. On screen the quiz walks up a level after two right
 * answers and down after two wrong ones, so no two learners see the same questions; a sheet is
 * printed once and handed out, so it carries them all, in stored order, with their difficulty left
 * off. That is the one departure worth naming, and it is the same one every activity that draws
 * its questions at random already makes.
 *
 * Notes on the stored data:
 * - This is a `json` activity: the questions live in the component's properties.
 * - `typeSelect` says what a question asks, in the runtime's own words: 0 select, 1 sort, 2 word.
 *   The three are printed as options to tick, options to number, and boxes to write a word in.
 * - A sort question stores its options **in the right order**, so the sheet shuffles them exactly
 *   as Scrambled list does: printed in stored order, the answer would be the list itself.
 * - `numberOptions` says how many of the six option slots are in play, and `percentageShow` how
 *   much of a word to give away. Both are the author's settings and both are followed.
 * - `type` is 1 when the question carries a picture, which is printed with it.
 * - `solutionMulti`, `solutionOrder` and the hidden part of `solutionWord` are never printed.
 * - Option text is plain text: the activity escapes it rather than rendering it as markup.
 */

import { buildAnswerBoxes, shuffleWith, type RandomSource } from '../questionSelection';
import { escapeText, sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableAnswer,
    PrintableActivity,
    PrintableItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** What a question asks, as `typeSelect` records it. */
const ASK_SORT = 1;
const ASK_WORD = 2;

/** A question carrying a picture. */
const WITH_PICTURE = 1;

/** One option offered for a question. */
interface QuizOption {
    text?: string;
    /** A sound, which paper cannot offer. */
    audio?: string;
}

/** One question of the quiz. */
interface QuizQuestion {
    /** 1 when the question carries a picture. */
    type?: number;
    /** 0 select, 1 sort, 2 word. */
    typeSelect?: number;
    /** The picture, as an `asset://` reference the export pipeline resolves. */
    url?: string;
    author?: string;
    alt?: string;
    question?: string;
    /** How many of the option slots are in play. */
    numberOptions?: number;
    options?: QuizOption[];
    /** The word to write, of which `percentageShow` is given away. */
    solutionWord?: string;
    percentageShow?: number;
}

/** The Adaptative quiz properties. */
interface AdaptativeQuizProperties {
    questionsGame?: QuizQuestion[];
    eXeFormInstructions?: string;
    instructions?: string;
    eXeIdeviceTextAfter?: string;
}

/**
 * The options in play, as plain text.
 *
 * The activity keeps six slots whatever the author filled, and `numberOptions` says how many of
 * them it offers. An option that is only a sound has nothing to print.
 */
function optionsOf(question: QuizQuestion): string[] {
    const stored = Array.isArray(question.options) ? question.options : [];
    const inPlay = typeof question.numberOptions === 'number' ? Math.max(0, question.numberOptions) : stored.length;

    return stored
        .slice(0, inPlay)
        .map(option => escapeText(String(option?.text ?? '').trim()))
        .filter(text => text !== '');
}

/**
 * Build the answer space for one question, which depends on what it asks.
 *
 * @returns The answer, or null when there is nothing for the student to fill in
 */
function buildAnswer(question: QuizQuestion, random: RandomSource): PrintableAnswer | null {
    if (question.typeSelect === ASK_WORD) {
        const groups = buildAnswerBoxes(question.solutionWord, question.percentageShow, false, random);

        return groups.length > 0 ? { kind: 'characterBoxes', groups } : null;
    }

    const labels = optionsOf(question);
    if (labels.length === 0) return null;

    // A sort question stores its options in the right order, so that order is the answer: the
    // sheet shuffles them and gives each a line to write its position on, as Scrambled list does.
    if (question.typeSelect === ASK_SORT) {
        return { kind: 'options', labels: shuffleWith(labels, random), marker: 'line' };
    }

    return { kind: 'options', labels, marker: 'box' };
}

/** One question: its words, its picture if it has one, then the answer space. */
function buildQuestion(question: QuizQuestion, random: RandomSource): PrintableItem | null {
    const prompt = sanitizeHtml(question.question);
    const answer = buildAnswer(question, random);

    // A question needs something to ask and somewhere to answer.
    if (!prompt || !answer) return null;

    const item: PrintableItem = { prompt, answer };
    if (question.type === WITH_PICTURE && (question.url ?? '').trim() !== '')
        item.media = {
            kind: 'image',
            src: question.url as string,
            alt: question.alt || undefined,
            author: question.author || undefined,
        };

    return item;
}

export const AdaptativeQuizWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'adaptative-quiz',
    defaultTitle: 'Adaptative quiz',

    build(_html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const data = (options.properties ?? {}) as AdaptativeQuizProperties;
        if (!Array.isArray(data.questionsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const items = data.questionsGame.flatMap(question => {
            const item = buildQuestion(question ?? {}, random);
            if (item) return [item];
            options.onOmission?.('invalid-data');
            return [];
        });

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'adaptative-quiz',
            title: options.title || AdaptativeQuizWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(data.eXeFormInstructions || data.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(data.eXeIdeviceTextAfter);
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
