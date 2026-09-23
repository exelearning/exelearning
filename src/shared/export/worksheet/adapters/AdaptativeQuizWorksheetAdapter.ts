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
 * - **A word question turns the usual fields around**, and its runtime says so in as many words:
 *   `question` is the word the learner types and `solutionWord` is the definition shown above the
 *   input. So the definition is the prompt and the word is what the boxes are built from — the
 *   other way round, the sheet would print the answer and ask for the definition.
 * - Older projects keep the question's text in `text` rather than `question`, and their options as
 *   plain strings rather than `{ text, audio }`. Both shapes are read, as the runtime reads them.
 * - A sort question stores its options **in the right order**, so the sheet shuffles them exactly
 *   as Scrambled list does: printed in stored order, the answer would be the list itself.
 * - `numberOptions` says how many of the six option slots are in play, and `percentageShow` how
 *   much of a word to give away. Both are the author's settings and both are followed.
 * - `type` is 1 when the question carries a picture, which is printed with it.
 * - `solutionMulti`, `solutionOrder` and the hidden letters of a word answer are never printed.
 * - Prompts and options are plain text: the activity escapes them rather than rendering markup.
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
    /** The question's text — or, in a word question, the word the learner types. */
    question?: string;
    /** Where an older project keeps the question's text instead. */
    text?: string;
    /** How many of the option slots are in play. */
    numberOptions?: number;
    /** `{ text, audio }` today; a plain string in an older project. */
    options?: (QuizOption | string)[];
    /** In a word question, the definition shown above the input. */
    solutionWord?: string;
    percentageShow?: number;
}

/** What the question asks, whichever field this project keeps it in. */
function wordingOf(question: QuizQuestion): string {
    return question.question || question.text || '';
}

/** The Adaptative quiz properties. */
interface AdaptativeQuizProperties {
    questionsGame?: QuizQuestion[];
    /** Older projects keep the question list here. */
    questions?: QuizQuestion[];
    caseSensitive?: boolean;
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

    return (
        stored
            .slice(0, inPlay)
            // An older project stores each option as a plain string rather than as an object.
            .map(option => escapeText(String(typeof option === 'string' ? option : (option?.text ?? '')).trim()))
            .filter(text => text !== '')
    );
}

/**
 * Build the answer space for one question, which depends on what it asks.
 *
 * @returns The answer, or null when there is nothing for the student to fill in
 */
function buildAnswer(question: QuizQuestion, random: RandomSource, caseSensitive: boolean): PrintableAnswer | null {
    if (question.typeSelect === ASK_WORD) {
        // The word is in `question`, not in `solutionWord`: see the note at the top.
        const groups = buildAnswerBoxes(wordingOf(question), question.percentageShow, caseSensitive, random);

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
function buildQuestion(question: QuizQuestion, random: RandomSource, caseSensitive: boolean): PrintableItem | null {
    // A word question asks its definition and answers with the word, so the two swap places.
    const prompt = escapeText(question.typeSelect === ASK_WORD ? question.solutionWord : wordingOf(question)).trim();
    const answer = buildAnswer(question, random, caseSensitive);

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
        const questions = Array.isArray(data.questionsGame) ? data.questionsGame : data.questions;
        if (!Array.isArray(questions)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const items = questions.flatMap(question => {
            const item = buildQuestion(question ?? {}, random, data.caseSensitive === true);
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
