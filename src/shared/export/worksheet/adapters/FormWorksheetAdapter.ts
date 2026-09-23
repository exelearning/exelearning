/**
 * Form ('form') worksheet adapter
 *
 * Prints a questionnaire as the four kinds of question it is built from: a statement to mark true
 * or false, options to tick, a gap to write in, and a gap to choose a word for.
 *
 * This is the first adapter for the `json` family, which keeps its data in the component's
 * properties rather than in a hidden div inside its HTML — there the markup is an empty shell, and
 * `form-Data` holds nothing but `{}`. The data arrives through `options.properties`.
 *
 * Notes on the stored data:
 * - `questionsData` holds the questions, each with an `activityType` of `true-false`, `selection`,
 *   `fill` or `dropdown`, and its wording in `baseText` as author HTML.
 * - A `fill` or `dropdown` question marks each blank by wrapping the answer in `<u>`. The word
 *   inside is the answer and is never printed; what is printed is a gap the width of it.
 * - A `dropdown` offers one set of choices for the whole question: every answer in its text, plus
 *   the distractors in `wrongAnswersValue` split on `|`, shuffled together. The sheet offers the
 *   same set at each gap, as the activity does.
 * - `selection` stores `answers` as `[isCorrect, text]` pairs and `selectionType` as `single` or
 *   `multiple`. Which are correct is never printed.
 * - `true-false` stores the answer as `'1'` or `'0'`, and its own words for true and false in
 *   `msgs`. The sheet uses those, so a Spanish project offers 'Verdadero' and 'Falso'.
 */

import { renderInlineGap } from '../WorksheetRenderer';
import { selectQuestions, shuffleWith, type RandomSource } from '../questionSelection';
import { escapeText, htmlToText, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** How wide a gap is, in characters, when the answer gives no better guide. */
const DEFAULT_GAP = 8;

/** A blank, as both gap-filling kinds of question mark one. */
const BLANK = /<u>([\s\S]*?)<\/u>/gi;

/** One question, whichever of the four kinds it is. */
interface FormQuestion {
    activityType?: string;
    /** The wording, as author HTML, with `<u>` marking any blanks. */
    baseText?: string;
    /** Distractors for a dropdown, separated by a pipe. */
    wrongAnswersValue?: string;
    /** `[isCorrect, text]` pairs, for a selection. */
    answers?: [boolean, string][];
    /** `single` or `multiple`, for a selection. */
    selectionType?: string;
    /** `'1'` true or `'0'` false, for a true-or-false. */
    answer?: string;
}

/** The Form properties. */
interface FormProperties {
    questionsData?: FormQuestion[];
    questionsRandom?: boolean;
    /** Share of the questions to ask, stored as the editor's input yields it. */
    percentageQuestions?: unknown;
    eXeFormInstructions?: string;
    eXeIdeviceTextAfter?: string;
    /** The activity's own wording, which the author can edit. */
    msgs?: Record<string, string>;
}

/** The answers a blank wraps, in the order they appear. */
function blanksIn(baseText: string): string[] {
    return [...baseText.matchAll(BLANK)].map(match => htmlToText(match[1]).trim());
}

/**
 * Replace every blank with a gap the width of the answer behind it.
 *
 * The answer itself never reaches the page: what is left is a space as long as the word, which is
 * the only thing about it a printed exercise may give away.
 *
 * The author's markup is sanitised first and the blanks replaced in what comes out. `<u>` is one of
 * the tags the sanitiser keeps, so the blanks are all still there — and doing it this way round
 * means the gap markup never has to pass through a filter that would strip it.
 */
function withGaps(baseText: string, choices?: string[]): string {
    return sanitizeHtml(baseText).replace(BLANK, (_, answer: string) => {
        const width = htmlToText(answer).trim().length || DEFAULT_GAP;

        return renderInlineGap(width, choices);
    });
}

/** One statement to mark true or false, with the activity's own words for the two. */
function buildTrueFalse(question: FormQuestion, msgs: Record<string, string>): PrintableItem | null {
    const prompt = sanitizeHtml(question.baseText);
    if (!prompt) return null;

    const labels = [(msgs.msgTrue ?? '').trim() || 'True', (msgs.msgFalse ?? '').trim() || 'False'].map(escapeText);

    return { prompt, answer: { kind: 'options', labels, marker: 'box' } };
}

/** One question with options to tick, however many of them are right. */
function buildSelection(question: FormQuestion, random: RandomSource): PrintableItem | null {
    const prompt = sanitizeHtml(question.baseText);
    const answers = Array.isArray(question.answers) ? question.answers : [];
    // Like the interactive Form, treat option labels as text. The renderer accepts safe HTML,
    // so escape comparisons and author examples as well as executable markup before handing it on.
    const labels = answers
        .map(answer => (Array.isArray(answer) ? String(answer[1] ?? '') : ''))
        .filter(text => text.trim() !== '')
        .map(escapeText);

    if (!prompt || labels.length === 0) return null;

    return { prompt, answer: { kind: 'options', labels: shuffleWith(labels, random), marker: 'box' } };
}

/** One question whose blanks are written into, or chosen for. */
function buildGapped(question: FormQuestion, random: RandomSource): PrintableItem | null {
    const baseText = question.baseText ?? '';
    const answers = blanksIn(baseText);
    if (answers.length === 0) return null;

    // A dropdown offers one set for the whole question: its own answers and its distractors.
    const distractors = (question.wrongAnswersValue ?? '')
        .split('|')
        .map(word => word.trim())
        .filter(word => word !== '');
    const choices =
        question.activityType === 'dropdown' ? shuffleWith([...answers, ...distractors], random) : undefined;

    const prompt = withGaps(baseText, choices);

    return prompt ? { prompt } : null;
}

export const FormWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'form',
    defaultTitle: 'Form',

    build(_html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const data = (options.properties ?? {}) as FormProperties;
        if (!Array.isArray(data.questionsData)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const msgs = data.msgs ?? {};

        const items = data.questionsData.flatMap(question => {
            const entry = question ?? {};
            let item: PrintableItem | null = null;

            if (entry.activityType === 'true-false') item = buildTrueFalse(entry, msgs);
            else if (entry.activityType === 'selection') item = buildSelection(entry, random);
            else if (entry.activityType === 'fill' || entry.activityType === 'dropdown')
                item = buildGapped(entry, random);

            if (item) return [item];
            options.onOmission?.('invalid-data');
            return [];
        });

        const share = Number(data.percentageQuestions);
        const selected = selectQuestions(
            items,
            Number.isFinite(share) ? share : undefined,
            data.questionsRandom === true,
            random,
        );
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'form',
            title: options.title || FormWorksheetAdapter.defaultTitle,
            items: selected,
        };

        const instructions = sanitizeHtml(data.eXeFormInstructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(data.eXeIdeviceTextAfter);
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
