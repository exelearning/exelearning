/**
 * Adaptative quiz ('adaptative-quiz') worksheet adapter
 *
 * Prints the questions the quiz asks, each in the shape its own kind calls for.
 *
 * The adapting is what does not survive. On screen the quiz starts at its initial level, walks up a
 * level after two right answers and down after two wrong ones, and draws each question at random
 * from the level the learner is on, so no two learners see the same questions. A sheet is printed
 * once and handed out, so it asks as many questions as a learner answers — the author's "Number of
 * questions" — shared out between the levels rather than following any one learner, and printed in
 * stored order with their difficulty left off.
 *
 * Notes on the stored data:
 * - This is a `json` activity: the questions live in the component's properties.
 * - `numRound` is the "Number of questions", read with `parseInt` as the runtime reads it. The
 *   editor always saves one, five unless the author changed it. Without a whole number of at least
 *   one there is no count, and the sheet prints every question.
 * - `difficulty` is a question's level and `initialLevel` the one the quiz starts at, both 2 when
 *   unset, as the runtime has them.
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

/** The level the runtime gives a question, or a quiz's start, that does not say. */
const DEFAULT_LEVEL = 2;

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
    /** The question's level, 1 being the easiest. */
    difficulty?: number | string;
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
    /** "Number of questions": how many a learner answers. */
    numRound?: number | string;
    /** The level the quiz starts at. */
    initialLevel?: number | string;
}

/** A question the sheet can print, with the level it belongs to. */
interface LeveledItem {
    item: PrintableItem;
    level: number;
}

/**
 * How many questions a learner answers, read with `parseInt` as the runtime reads `numRound`.
 *
 * @returns The count, or undefined when the value is not a whole number of at least one
 */
function questionCountOf(value: unknown): number | undefined {
    const count = Number.parseInt(String(value), 10);

    return count >= 1 ? count : undefined;
}

/** A level as the runtime falls back to it: whatever `parseInt` makes of it, or the default. */
function levelOf(value: unknown): number {
    return Number.parseInt(String(value), 10) || DEFAULT_LEVEL;
}

/**
 * Share `count` questions out between the levels.
 *
 * The runtime starts at the initial level and moves up or down from there, so the levels are taken
 * in turn from that one outwards — the nearest first, the easier of two equally near — one question
 * from each in stored order, until there are enough. Every level gives one before any gives a
 * second, and the chosen questions go back into stored order.
 *
 * @param questions - The printable questions, in stored order
 * @param count - How many to keep
 * @param initialLevel - The level the quiz starts at
 * @returns The questions to print, in stored order
 */
function shareOutByLevel(questions: LeveledItem[], count: number, initialLevel: number): PrintableItem[] {
    const byLevel = new Map<number, number[]>();
    questions.forEach(({ level }, index) => byLevel.set(level, [...(byLevel.get(level) ?? []), index]));

    const turns = [...byLevel.keys()].sort((a, b) => Math.abs(a - initialLevel) - Math.abs(b - initialLevel) || a - b);
    const deepest = Math.max(...[...byLevel.values()].map(indices => indices.length));

    const chosen = new Set<number>();
    for (let round = 0; round < deepest && chosen.size < count; round++) {
        for (const level of turns) {
            const index = byLevel.get(level)?.[round];
            if (index !== undefined && chosen.size < count) chosen.add(index);
        }
    }

    return questions.filter((_, index) => chosen.has(index)).map(({ item }) => item);
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
        const printable = questions.flatMap<LeveledItem>(question => {
            const item = buildQuestion(question ?? {}, random, data.caseSensitive === true);
            if (item) return [{ item, level: levelOf(question?.difficulty) }];
            options.onOmission?.('invalid-data');
            return [];
        });

        if (printable.length === 0) return null;

        // A question left off here is one a learner would not have been asked either, so it is not
        // reported as an omission.
        const count = questionCountOf(data.numRound);
        const items =
            count === undefined || count >= printable.length
                ? printable.map(({ item }) => item)
                : shareOutByLevel(printable, count, levelOf(data.initialLevel));

        const activity: PrintableActivity = {
            ideviceType: 'adaptative-quiz',
            title: options.title || AdaptativeQuizWorksheetAdapter.defaultTitle,
            twoColumns: true,
            items,
        };

        const instructions = sanitizeHtml(data.eXeFormInstructions || data.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(data.eXeIdeviceTextAfter);
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
