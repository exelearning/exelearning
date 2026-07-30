/**
 * Answer grading, score aggregation and completion rules. Deterministic;
 * fractions are SCORM-compatible (0..1). The DOM never enters here — the
 * runtime extracts learner responses and passes plain values.
 */

import { normalizeClozeAnswer } from './cloze';
import type { CompletionState, Interaction, InteractiveVideoDocumentV2, ScoreSummary } from './types';
import { toIdLookup } from './scheduling';

/** Fraction (0 or 1) for a single-choice answer given the chosen index. */
export function gradeSingleChoice(answers: unknown, selectedIndex: number): number {
    if (!Array.isArray(answers)) {
        return 0;
    }
    const chosen = answers[selectedIndex];
    return chosen && chosen[1] === 1 ? 1 : 0;
}

/**
 * Fraction (0 or 1) for a True/False answer: 1 only when the learner's boolean
 * selection equals the stored `solution` (both coerced to 0|1). An invalid or
 * missing selection (anything other than 0/1) counts as wrong, so a blank
 * answer never scores. Never throws.
 */
export function gradeTrueFalse(solution: unknown, selected: unknown): number {
    const sel = Number(selected);
    if (sel !== 0 && sel !== 1) {
        return 0;
    }
    const sol = Number(solution) === 1 ? 1 : 0;
    return sel === sol ? 1 : 0;
}

/**
 * Partial-credit fraction (0..1) for a multiple-choice answer: correct
 * selections minus wrong selections over the number of correct options,
 * clamped so wrong guesses never yield a negative score.
 */
export function gradeMultipleChoice(answers: unknown, selectedIndices: unknown): number {
    if (!Array.isArray(answers)) {
        return 0;
    }
    const selected = toIdLookup(Array.isArray(selectedIndices) ? selectedIndices : []);
    let correctTotal = 0;
    let selectedCorrect = 0;
    let selectedWrong = 0;
    for (let i = 0; i < answers.length; i++) {
        const isCorrect = answers[i] && answers[i][1] === 1;
        if (isCorrect) {
            correctTotal++;
        }
        if (selected[i]) {
            if (isCorrect) {
                selectedCorrect++;
            } else {
                selectedWrong++;
            }
        }
    }
    if (correctTotal === 0) {
        return 0;
    }
    return Math.max(0, Math.min(1, (selectedCorrect - selectedWrong) / correctTotal));
}

/**
 * Fraction (0..1) for a dropdown answer: blanks answered with their exact
 * (trimmed, case-sensitive) correct word over the total number of blanks. A
 * missing/empty selection counts as wrong; no penalty below zero.
 */
export function gradeDropdown(correctWords: unknown, selectedValues: unknown): number {
    if (!Array.isArray(correctWords) || correctWords.length === 0) {
        return 0;
    }
    const selected = Array.isArray(selectedValues) ? selectedValues : [];
    let correct = 0;
    for (let i = 0; i < correctWords.length; i++) {
        const expected = typeof correctWords[i] === 'string' ? correctWords[i].replace(/^\s+|\s+$/g, '') : '';
        const got = typeof selected[i] === 'string' ? selected[i].replace(/^\s+|\s+$/g, '') : '';
        if (expected !== '' && got === expected) {
            correct++;
        }
    }
    return correct / correctWords.length;
}

/**
 * Fraction (0..1) for a fill-in-the-blank (cloze) answer: the share of blanks
 * whose learner input matches the stored answer after normalization
 * (case-insensitive, whitespace-collapsed, trimmed). Each stored answer may
 * list `|`-separated acceptable variants; any one match counts. Legacy blanks
 * (a single line-through word) are the one-variant case, so migrated content
 * grades unchanged apart from being case-insensitive. `correctAnswers` and
 * `learnerAnswers` are parallel arrays.
 */
export function gradeCloze(correctAnswers: unknown, learnerAnswers: unknown): number {
    if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
        return 0;
    }
    const learner = Array.isArray(learnerAnswers) ? learnerAnswers : [];
    let correct = 0;
    for (let i = 0; i < correctAnswers.length; i++) {
        const actual = normalizeClozeAnswer(learner[i]);
        const variants = String(correctAnswers[i] == null ? '' : correctAnswers[i]).split('|');
        for (const variant of variants) {
            if (normalizeClozeAnswer(variant) === actual) {
                correct++;
                break;
            }
        }
    }
    return correct / correctAnswers.length;
}

/**
 * Fraction (0..1) for a match-the-pairs answer: the number of left rows whose
 * selected right equals its correct right, over the total number of pairs.
 * `responses[i]` is the right-hand value chosen for left row `i` (blank or
 * missing counts as wrong, and never shrinks the denominator). Comparison is
 * by right-hand text, so duplicate rights are interchangeable — mirroring the
 * legacy runtime — and an empty correct answer is never satisfied by a blank
 * response.
 */
export function gradeMatchElements(pairs: unknown, responses: unknown): number {
    if (!Array.isArray(pairs) || pairs.length === 0) {
        return 0;
    }
    const answers = Array.isArray(responses) ? responses : [];
    let correct = 0;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const expected = pair && pair[1] != null ? String(pair[1]) : '';
        const got = answers[i] != null ? String(answers[i]) : '';
        if (got !== '' && got === expected) {
            correct++;
        }
    }
    return correct / pairs.length;
}

/**
 * Partial-credit fraction (0..1) for a sortable-list answer: the number of
 * items the learner placed in their correct position over the total number of
 * items. `items` is stored in the correct order, so the item that belongs at
 * position p is the one whose original index is p; `responseOrder[p]` is the
 * original index of the item the learner placed at display position p.
 * Index-based (not text) so duplicate labels and the display shuffle are
 * handled correctly. Robust to malformed input — never throws; parseInt keeps
 * a stray null from coercing to 0 and falsely matching position 0.
 */
export function gradeSortableList(items: unknown, responseOrder: unknown): number {
    if (!Array.isArray(items) || items.length === 0) {
        return 0;
    }
    const response = Array.isArray(responseOrder) ? responseOrder : [];
    let correct = 0;
    for (let i = 0; i < items.length; i++) {
        if (parseInt(String(response[i]), 10) === i) {
            correct++;
        }
    }
    return correct / items.length;
}

/**
 * Aggregate per-question fractions into a SCORM-friendly score. The
 * denominator is the number of gradable questions, or every interaction when
 * `scoreNIA` (score non-interactive activities) is on — matching the legacy
 * `scoreNIA` semantics. `scaled10` mirrors the legacy 0..10 model.
 */
export function aggregateScore(
    interactions: readonly Interaction[] | null | undefined,
    resultsById: Record<string, number> | null | undefined,
    scoreNIA?: unknown,
): ScoreSummary {
    const list = Array.isArray(interactions) ? interactions : [];
    const results = resultsById || {};
    const questions = list.filter(it => it && it.type === 'question');
    const denom = scoreNIA ? list.length : questions.length;
    let raw = 0;
    for (const question of questions) {
        const value = Number(results[question.id]);
        if (isFinite(value)) {
            raw += value;
        }
    }
    const fraction = denom > 0 ? raw / denom : 0;
    return {
        raw: raw,
        max: denom,
        fraction: fraction,
        scaled10: Math.round(fraction * 10 * 100) / 100,
        percent: Math.round(fraction * 100),
    };
}

/**
 * Whether the activity is complete per its explicit completion mode. Never
 * auto-completes in `none`/`manual`; other modes gate on watched / all
 * questions answered / score threshold (SDD-0001 §13).
 */
export function computeCompletion(
    doc: Pick<InteractiveVideoDocumentV2, 'completion' | 'interactions'> | null | undefined,
    state: CompletionState | null | undefined,
): boolean {
    const completion = doc?.completion ?? { mode: 'none' as const, requiredScore: null };
    const interactions = Array.isArray(doc?.interactions) ? doc.interactions : [];
    const current = state ?? {};
    switch (completion.mode) {
        case 'watch':
            return current.watched === true;
        case 'answerRequired': {
            const answered = toIdLookup(current.answeredIds ? Array.from(current.answeredIds) : null);
            const questions = interactions.filter(it => it && it.type === 'question');
            if (questions.length === 0) {
                return true;
            }
            for (const question of questions) {
                if (!answered[question.id]) {
                    return false;
                }
            }
            return true;
        }
        case 'scoreThreshold': {
            const required = Number(completion.requiredScore);
            const percent =
                current.score && isFinite(Number(current.score.percent)) ? Number(current.score.percent) : 0;
            return isFinite(required) ? percent >= required : false;
        }
        default:
            return false;
    }
}
