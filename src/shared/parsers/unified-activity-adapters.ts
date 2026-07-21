/**
 * Adapters from the Unified Activity Format normalized model to concrete
 * iDevice data structures.
 *
 * Each adapter targets a CONFIRMED runtime model:
 * - selection -> `form` iDevice questionsData entry (`activityType: 'selection'`)
 * - true/false -> `trueorfalse` game question, and (alternatively) a `form`
 *   `true-false` questionsData entry
 * - fill-in-the-blank -> `form` iDevice questionsData entry (`activityType: 'fill'`)
 *   with blanks encoded as `<u>answer</u>`
 * - flashcard -> `flipcards` (Memory cards) card object
 *
 * Adapters never invent storage fields and deliberately omit the question `id`
 * (the form/flipcards editors generate ids when missing), keeping output
 * deterministic and testable. The `hint` parameter maps to the iDevice
 * `suggestion` field — NOT to a `hint` field, which the form iDevice never reads.
 *
 * Output `baseText`/`question` values are HTML; this layer does not sanitize —
 * sanitization belongs to the iDevice render layer, consistent with the rest of
 * the codebase.
 *
 * @module shared/parsers/unified-activity-adapters
 */

import type {
    UnifiedActivityItem,
    UnifiedActivityParams,
    UnifiedFillBlankItem,
    UnifiedFlashcardItem,
    UnifiedSelectionItem,
    UnifiedTrueFalseItem,
} from './unified-activity-format';

/** A `form` iDevice selection question (`questionsData` entry). */
export interface FormSelectionQuestion {
    activityType: 'selection';
    selectionType: 'single' | 'multiple';
    baseText: string;
    answers: Array<[boolean, string]>;
    suggestion?: string;
    feedbackRight?: string;
    feedbackWrong?: string;
    customScore?: number;
}

/** A `form` iDevice true/false question (`questionsData` entry). */
export interface FormTrueFalseQuestion {
    activityType: 'true-false';
    baseText: string;
    /** `'1'` for true, `'0'` for false (matches the form iDevice encoding). */
    answer: '1' | '0';
    suggestion?: string;
    feedbackRight?: string;
    feedbackWrong?: string;
}

/** A `form` iDevice fill-in-the-blank question (`questionsData` entry). */
export interface FormFillQuestion {
    activityType: 'fill';
    /** HTML with each blank encoded as `<u>answer</u>` (alternatives as `<u>a|b</u>`). */
    baseText: string;
    suggestion?: string;
    feedbackRight?: string;
    feedbackWrong?: string;
    capitalization?: boolean;
    strict?: boolean;
    customScore?: number;
}

/** Any `form` iDevice question produced by the adapters. */
export type FormQuestion = FormSelectionQuestion | FormTrueFalseQuestion | FormFillQuestion;

/** A `trueorfalse` game question (matches the legacy TrueFalseHandler output). */
export interface TrueOrFalseQuestion {
    question: string;
    feedback: string;
    suggestion: string;
    /** `1` for true, `0` for false. */
    solution: number;
}

/** A `flipcards` (Memory cards) card object. */
export interface FlipCard {
    id: string;
    type: number;
    url: string;
    audio: string;
    x: number;
    y: number;
    author: string;
    alt: string;
    eText: string;
    color: string;
    backcolor: string;
    correct: number;
    urlBk: string;
    audioBk: string;
    xBk: number;
    yBk: number;
    authorBk: string;
    altBk: string;
    eTextBk: string;
    colorBk: string;
    backcolorBk: string;
}

/** Result of converting a batch of items into `form` questions. */
export interface FormQuestionsResult {
    questions: FormQuestion[];
    skipped: Array<{ item: UnifiedActivityItem; reason: string }>;
}

/** Wrap plain authoring text in a paragraph, as the form/game iDevices expect. */
function toHtmlParagraph(text: string): string {
    return `<p>${text}</p>`;
}

/**
 * Mirror the `flipcards` editor's `encodeURIComponentSafe`.
 * (Reproduced verbatim, including the single-`%` replacement, so output matches.)
 */
function encodeURIComponentSafe(value: string): string {
    if (!value) {
        return value;
    }
    return encodeURIComponent(value.replace('%', '&percnt;'));
}

/** Collect the form feedback/score fields present on the item params. */
function formFeedbackFields(params: UnifiedActivityParams): {
    suggestion?: string;
    feedbackRight?: string;
    feedbackWrong?: string;
    customScore?: number;
} {
    const fields: { suggestion?: string; feedbackRight?: string; feedbackWrong?: string; customScore?: number } = {};
    if (params.hint) {
        fields.suggestion = params.hint;
    }
    if (params.explain) {
        fields.feedbackRight = params.explain;
    }
    if (params.feedback) {
        fields.feedbackWrong = params.feedback;
    }
    if (params.points !== undefined) {
        fields.customScore = params.points;
    }
    return fields;
}

/** Convert a selection item into a `form` iDevice questionsData entry. */
export function unifiedSelectionToFormQuestion(item: UnifiedSelectionItem): FormSelectionQuestion {
    const answers = item.options.map((option, index): [boolean, string] => [
        item.correctIndexes.includes(index),
        option,
    ]);
    return {
        activityType: 'selection',
        selectionType: item.selectionType,
        baseText: toHtmlParagraph(item.question),
        answers,
        ...formFeedbackFields(item.params),
    };
}

/** Convert a true/false item into a `trueorfalse` game question. */
export function unifiedTrueFalseToTrueOrFalseQuestion(item: UnifiedTrueFalseItem): TrueOrFalseQuestion {
    return {
        question: toHtmlParagraph(item.statement),
        feedback: item.params.explain ?? item.params.feedback ?? '',
        suggestion: item.params.hint ?? '',
        solution: item.answer ? 1 : 0,
    };
}

/** Convert a true/false item into a `form` iDevice `true-false` questionsData entry. */
export function unifiedTrueFalseToFormQuestion(item: UnifiedTrueFalseItem): FormTrueFalseQuestion {
    const feedback = formFeedbackFields(item.params);
    return {
        activityType: 'true-false',
        baseText: toHtmlParagraph(item.statement),
        answer: item.answer ? '1' : '0',
        ...(feedback.suggestion !== undefined ? { suggestion: feedback.suggestion } : {}),
        ...(feedback.feedbackRight !== undefined ? { feedbackRight: feedback.feedbackRight } : {}),
        ...(feedback.feedbackWrong !== undefined ? { feedbackWrong: feedback.feedbackWrong } : {}),
    };
}

/** Render the fill-in-the-blank tokens into form `<u>answer</u>` baseText. */
function renderFillBaseText(item: UnifiedFillBlankItem): string {
    const body = item.tokens
        .map(token => {
            if (token.type === 'text') {
                return token.value;
            }
            return `<u>${token.answers.join('|')}</u>`;
        })
        .join('');
    return toHtmlParagraph(body);
}

/** Convert a fill-in-the-blank item into a `form` iDevice `fill` questionsData entry. */
export function unifiedFillBlankToFormQuestion(item: UnifiedFillBlankItem): FormFillQuestion {
    const question: FormFillQuestion = {
        activityType: 'fill',
        baseText: renderFillBaseText(item),
        ...formFeedbackFields(item.params),
    };
    if (item.params.caseSensitive !== undefined) {
        question.capitalization = item.params.caseSensitive;
    }
    if (item.params.strict !== undefined) {
        question.strict = item.params.strict;
    }
    return question;
}

/** Build a `flipcards` card with all fields at their safe defaults. */
export function flipCardDefault(): FlipCard {
    return {
        id: '',
        type: 2,
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        eText: '',
        color: '#000000',
        backcolor: '#ffffff',
        correct: 0,
        urlBk: '',
        audioBk: '',
        xBk: 0,
        yBk: 0,
        authorBk: '',
        altBk: '',
        eTextBk: '',
        colorBk: '#000000',
        backcolorBk: '#ffffff',
    };
}

/** Convert a flashcard item into a `flipcards` card object. */
export function unifiedFlashcardToFlipCard(item: UnifiedFlashcardItem): FlipCard {
    return {
        ...flipCardDefault(),
        eText: encodeURIComponentSafe(item.front),
        eTextBk: encodeURIComponentSafe(item.back),
    };
}

/**
 * Convert a batch of items into `form` iDevice questionsData entries.
 * Selection, true/false and fill items become form questions; flashcards are
 * skipped (the `form` iDevice has no flashcard activity type) and reported.
 */
export function unifiedItemsToFormQuestionsData(items: UnifiedActivityItem[]): FormQuestionsResult {
    const questions: FormQuestion[] = [];
    const skipped: Array<{ item: UnifiedActivityItem; reason: string }> = [];
    for (const item of items) {
        switch (item.kind) {
            case 'selection':
                questions.push(unifiedSelectionToFormQuestion(item));
                break;
            case 'truefalse':
                questions.push(unifiedTrueFalseToFormQuestion(item));
                break;
            case 'fillblank':
                questions.push(unifiedFillBlankToFormQuestion(item));
                break;
            default:
                skipped.push({ item, reason: `The form iDevice has no "${item.kind}" activity type.` });
                break;
        }
    }
    return { questions, skipped };
}
