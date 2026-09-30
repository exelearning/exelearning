/**
 * Runtime scoring glue: extract the learner's responses from the overlay DOM,
 * grade them with the shared pure functions, reflect results into the results
 * table, and keep score/completion (and their SCORM report) up to date.
 */

import { clozeAnswersFromSegments, dropdownWordsFromSegments } from '../shared/cloze';
import { isVideoCompleted } from '../shared/playback';
import {
    aggregateScore,
    computeCompletion,
    gradeCloze,
    gradeDropdown,
    gradeMatchElements,
    gradeMultipleChoice,
    gradeSingleChoice,
    gradeSortableList,
    gradeTrueFalse,
} from '../shared/scoring';
import type { Question, QuestionInteraction } from '../shared/types';
import type { RuntimeInstance } from './instance';
import { segmentsFor } from './renderer';
import { reportScore } from './scorm';

/** Fill in the results-table statuses + Total from the instance state. */
export function refreshResults(instance: RuntimeInstance): void {
    const t = instance.t;
    const root = instance.root;
    if (!root) {
        return;
    }
    const rows = root.querySelectorAll('.exe-iv-results-table tbody tr[data-iv-result]');
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) {
            continue;
        }
        const id = row.getAttribute('data-iv-result') || '';
        const cell = row.querySelector('.exe-iv-results-status span');
        if (!cell) {
            continue;
        }
        if (Object.hasOwn(instance.results, id)) {
            cell.textContent = Math.round((instance.results[id] ?? 0) * 100) + '%';
        } else if (instance.seen[id]) {
            cell.textContent = t('Seen', 'seen');
        } else {
            cell.textContent = '-';
        }
    }
    const total = root.querySelector('.exe-iv-results-total span');
    if (total && instance.score) {
        total.textContent = instance.score.percent + '%';
    }
}

/** Recompute score/completion, refresh the table and report through SCORM. */
export function updateScore(instance: RuntimeInstance): void {
    const doc = instance.doc;
    const scoreNIA = doc.meta?.legacy?.scoreNIA;
    const score = aggregateScore(doc.interactions, instance.results, scoreNIA);
    instance.score = score;
    instance.completed = computeCompletion(doc, {
        watched: isVideoCompleted(instance.playback, instance.duration, instance.watched === true),
        answeredIds: Object.keys(instance.answered),
        score: score,
    });
    refreshResults(instance);
    reportScore(instance);
}

/**
 * True when the learner has actually responded to the question on screen.
 * Grading an untouched question would silently record a 0, so Check nudges
 * instead (the legacy `notAnswered` behaviour).
 */
function hasResponse(question: Question, overlay: HTMLElement): boolean {
    const kind = question.kind;
    if (kind === 'dropdown' || kind === 'matchElements') {
        const selects = overlay.querySelectorAll<HTMLSelectElement>(
            kind === 'dropdown' ? '.exe-iv-dropdown-select' : 'select.exe-iv-match-select',
        );
        for (let i = 0; i < selects.length; i++) {
            if (selects[i]?.value) {
                return true;
            }
        }
        return false;
    }
    if (kind === 'cloze') {
        const fields = overlay.querySelectorAll<HTMLInputElement>('.exe-iv-cloze-input');
        for (let i = 0; i < fields.length; i++) {
            if (String(fields[i]?.value || '').trim() !== '') {
                return true;
            }
        }
        return false;
    }
    if (kind === 'sortableList') {
        // An order is always a response: the learner may consider the shuffled
        // order already correct.
        return true;
    }
    return !!overlay.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
}

/**
 * Grade the question on screen, announce feedback and record the score.
 * Returns true when a result was recorded (false when the learner has not
 * responded yet), so the caller can decide whether to offer Continue.
 */
export function gradeInteraction(
    instance: RuntimeInstance,
    interaction: QuestionInteraction,
    overlay: HTMLElement,
): boolean {
    const t = instance.t;
    const question = interaction.question;
    let fraction = 0;
    if (!hasResponse(question, overlay)) {
        const pending = overlay.querySelector('.exe-iv-feedback');
        if (pending) {
            pending.className = 'exe-iv-feedback is-pending';
            pending.textContent = t('Please finish the activity', 'notAnswered');
        }
        return false;
    }
    if (question.kind === 'dropdown') {
        const segments = segmentsFor(question);
        const correctWords = dropdownWordsFromSegments(segments);
        const selects = overlay.querySelectorAll<HTMLSelectElement>('.exe-iv-dropdown-select');
        const chosen: string[] = [];
        for (let d = 0; d < selects.length; d++) {
            chosen.push(selects[d]?.value ?? '');
        }
        for (let d = 0; d < selects.length; d++) {
            const select = selects[d];
            if (!select) {
                continue;
            }
            const blankOk = gradeDropdown([correctWords[d]], [select.value]) === 1;
            select.setAttribute('aria-invalid', blankOk ? 'false' : 'true');
            select.classList.toggle('is-correct', blankOk);
            select.classList.toggle('is-wrong', !blankOk);
        }
        fraction = gradeDropdown(correctWords, chosen);
    } else if (question.kind === 'cloze') {
        const segments = segmentsFor(question);
        const clozeAnswers = clozeAnswersFromSegments(segments);
        const firstVariants = dropdownWordsFromSegments(segments);
        const responses: string[] = [];
        for (let c = 0; c < clozeAnswers.length; c++) {
            const field = overlay.querySelector<HTMLInputElement>('.exe-iv-cloze-input[data-cloze-index="' + c + '"]');
            const value = field ? field.value : '';
            responses.push(value);
            if (field) {
                const ok = gradeCloze([clozeAnswers[c]], [value]) >= 1;
                field.classList.add(ok ? 'is-correct' : 'is-incorrect');
                field.setAttribute('aria-invalid', ok ? 'false' : 'true');
                field.setAttribute('readonly', 'readonly');
                if (!ok && field.parentNode) {
                    const solution = document.createElement('span');
                    solution.className = 'exe-iv-cloze-solution';
                    solution.textContent = ' (' + t('Answer') + ': ' + firstVariants[c] + ')';
                    field.parentNode.insertBefore(solution, field.nextSibling);
                }
            }
        }
        fraction = gradeCloze(clozeAnswers, responses);
    } else if (question.kind === 'trueFalse') {
        const selected = overlay.querySelector<HTMLInputElement>('input[type="radio"]:checked');
        const value = selected ? parseInt(selected.value, 10) : -1;
        fraction = gradeTrueFalse(question.solution, value);
    } else if (question.kind === 'matchElements') {
        const selects = overlay.querySelectorAll<HTMLSelectElement>('select.exe-iv-match-select');
        const responses: string[] = [];
        for (let m = 0; m < selects.length; m++) {
            const select = selects[m];
            if (!select) {
                continue;
            }
            const index = parseInt(select.getAttribute('data-index') || '', 10);
            responses[isFinite(index) ? index : m] = select.value;
        }
        fraction = gradeMatchElements(question.pairs, responses);
    } else if (question.kind === 'sortableList') {
        const items = overlay.querySelectorAll('.exe-iv-sortable-item');
        const responseOrder: number[] = [];
        for (let s = 0; s < items.length; s++) {
            responseOrder.push(parseInt(items[s]?.getAttribute('data-iv-index') || '', 10));
        }
        fraction = gradeSortableList(question.items, responseOrder);
        const sortButtons = overlay.querySelectorAll<HTMLButtonElement>('.exe-iv-sort-btn');
        for (let sb = 0; sb < sortButtons.length; sb++) {
            const button = sortButtons[sb];
            if (button) {
                button.disabled = true;
            }
        }
    } else if (question.kind === 'multipleChoice') {
        const checked = overlay.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
        const indices: number[] = [];
        for (let i = 0; i < checked.length; i++) {
            indices.push(parseInt(checked[i]?.value ?? '', 10));
        }
        fraction = gradeMultipleChoice((question as { answers?: unknown }).answers, indices);
    } else {
        const selected = overlay.querySelector<HTMLInputElement>('input[type="radio"]:checked');
        const index = selected ? parseInt(selected.value, 10) : -1;
        fraction = gradeSingleChoice((question as { answers?: unknown }).answers, index);
    }
    instance.recordResult(interaction.id, fraction);
    const feedback = overlay.querySelector('.exe-iv-feedback');
    if (feedback) {
        // The wording already carries the verdict; the state class only adds
        // colour and a mark on top of it, so colour is never the only cue.
        feedback.className =
            'exe-iv-feedback ' + (fraction >= 1 ? 'is-correct' : fraction > 0 ? 'is-partial' : 'is-wrong');
        feedback.textContent =
            fraction >= 1 ? t('Correct!', 'right') : fraction > 0 ? t('Partially correct') : t('Incorrect', 'wrong');
    }
    return true;
}
