/**
 * Detail editor for question interactions: kind selector, prompt, and the
 * per-kind answer editors (choice rows, True/False radio pair, cloze/dropdown
 * `[[…]]` blank marking, match pairs, sortable items). Also owns the
 * question-shape normalization applied when kinds are switched or the
 * document is saved, and the pre-save validation.
 */

import { parsePromptText, segmentBlanks, dropdownOptions, dropdownWordsFromSegments } from '../../shared/cloze';
import { escapeHtml } from '../../shared/html';
import type { InteractiveVideoDocumentV2, Question, QuestionInteraction } from '../../shared/types';
import { tr } from '../state';
import type { DetailHost } from './types';

const KNOWN_KINDS = [
    'singleChoice',
    'multipleChoice',
    'trueFalse',
    'dropdown',
    'cloze',
    'matchElements',
    'sortableList',
] as const;

/**
 * Ensure a question carries the fields its kind needs and none it does not,
 * so switching kinds (or saving) never leaves stale data (e.g. an `answers`
 * array on a trueFalse, or a `solution` on a singleChoice). Cloze/dropdown
 * segments are derived from the plain-text `[[…]]` prompt.
 */
export function normalizeQuestionForKind(question: Question | null | undefined): void {
    if (!question || typeof question !== 'object') {
        return;
    }
    const record = question as Record<string, unknown>;
    const kind = question.kind;
    if (kind === 'singleChoice' || kind === 'multipleChoice') {
        if (!Array.isArray(record.answers) || record.answers.length === 0) {
            record.answers = [
                ['', 1],
                ['', 0],
            ];
        }
        delete record.solution;
        delete record.segments;
    } else if (kind === 'trueFalse') {
        if (record.solution !== 0 && record.solution !== 1) {
            record.solution = 1;
        }
        delete record.answers;
        delete record.segments;
    } else if (kind === 'cloze' || kind === 'dropdown') {
        record.segments = parsePromptText(question.prompt || '');
        delete record.answers;
        delete record.solution;
        if (kind === 'dropdown' && !Array.isArray(record.additionalWords)) {
            record.additionalWords = [];
        } else if (kind === 'cloze') {
            delete record.additionalWords;
        }
    }
}

/**
 * Validate the authored questions before saving; returns an error string to
 * show (via eXe.app.alert) or null when everything is valid. singleChoice
 * needs ≥2 non-empty answers and exactly one correct; trueFalse needs a
 * statement; cloze/dropdown need at least one blank.
 */
export function validateQuestions(doc: InteractiveVideoDocumentV2): string | null {
    for (const interaction of doc.interactions) {
        if (!interaction || interaction.type !== 'question' || !interaction.question) {
            continue;
        }
        const question = interaction.question as Record<string, unknown> & Question;
        if (question.kind === 'singleChoice') {
            const answers = Array.isArray(question.answers) ? question.answers : [];
            const nonEmpty = answers.filter(a => a && String(a[0] == null ? '' : a[0]).trim() !== '');
            const correct = answers.filter(a => a && a[1] === 1);
            if (nonEmpty.length < 2) {
                return tr('Single choice questions need at least two answers.');
            }
            if (correct.length !== 1) {
                return tr('Single choice questions need exactly one correct answer.');
            }
        } else if (question.kind === 'multipleChoice') {
            // Without at least one correct answer the question can only ever
            // grade 0 — a silent trap for the learner.
            const answers = Array.isArray(question.answers) ? question.answers : [];
            if (!answers.some(a => a && a[1] === 1)) {
                return tr('Multiple choice questions need at least one correct answer.');
            }
        } else if (question.kind === 'trueFalse') {
            if (String(question.prompt == null ? '' : question.prompt).trim() === '') {
                return tr('True/False questions need a statement.');
            }
        } else if (question.kind === 'matchElements') {
            const pairs = Array.isArray(question.pairs) ? question.pairs : [];
            const complete = pairs.filter(
                p => p && String(p[0] ?? '').trim() !== '' && String(p[1] ?? '').trim() !== '',
            );
            if (complete.length < 1) {
                return tr('Matching questions need at least one complete pair.');
            }
        } else if (question.kind === 'sortableList') {
            const items = Array.isArray(question.items) ? question.items : [];
            if (items.filter(item => String(item ?? '').trim() !== '').length < 2) {
                return tr('Ordering questions need at least two items.');
            }
        } else if (question.kind === 'cloze' || question.kind === 'dropdown') {
            const segments = Array.isArray(question.segments)
                ? question.segments
                : parsePromptText(question.prompt || '');
            if (segmentBlanks(segments).length < 1) {
                return tr('Fill-in questions need at least one blank.');
            }
        }
    }
    return null;
}

/**
 * Wrap the current #ivQuestionPrompt selection in a PLAIN-TEXT `[[…]]` blank
 * token (never HTML). Idempotent: when the selection is already the inside of
 * a `[[…]]` token (or is itself a full token), it unwraps instead — so a
 * second "Mark as blank" toggles the blank off.
 */
export function wrapSelectionAsBlank(): void {
    const textarea = document.getElementById('ivQuestionPrompt') as HTMLTextAreaElement | null;
    if (!textarea) {
        return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start == null || end == null || start === end) {
        return;
    }
    const value = textarea.value;
    const before = value.substring(0, start);
    const selection = value.substring(start, end);
    const after = value.substring(end);
    let newValue: string;
    let newStart: number;
    let newEnd: number;
    if (/\[\[$/.test(before) && /^\]\]/.test(after)) {
        // Selection sits inside an existing [[ … ]] token -> unwrap it.
        newValue = before.slice(0, -2) + selection + after.slice(2);
        newStart = start - 2;
        newEnd = end - 2;
    } else if (selection.length >= 4 && /^\[\[[\s\S]*\]\]$/.test(selection)) {
        // Selection is itself a full [[ … ]] token -> unwrap it.
        newValue = before + selection.slice(2, -2) + after;
        newStart = start;
        newEnd = end - 4;
    } else {
        newValue = before + '[[' + selection + ']]' + after;
        newStart = start + 2;
        newEnd = end + 2;
    }
    textarea.value = newValue;
    try {
        textarea.setSelectionRange(newStart, newEnd);
    } catch {
        /* setSelectionRange throws on non-focusable/detached fields in tests */
    }
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** Detail editor for a matchElements question's [left, right] pairs. */
function detailMatchElements(interaction: QuestionInteraction): string {
    const t = tr;
    const question = interaction.question as Record<string, unknown>;
    const pairs = Array.isArray(question.pairs) ? question.pairs : [];
    const rows = pairs
        .map(
            (pair, index) =>
                '<div class="exe-iv-match-edit-row" data-index="' +
                index +
                '"><input type="text" class="form-control exe-iv-match-left-input" data-index="' +
                index +
                '" placeholder="' +
                t('Left item') +
                '" value="' +
                escapeHtml(pair && pair[0] != null ? pair[0] : '') +
                '"><input type="text" class="form-control exe-iv-match-right-input" data-index="' +
                index +
                '" placeholder="' +
                t('Match') +
                '" value="' +
                escapeHtml(pair && pair[1] != null ? pair[1] : '') +
                '"><button type="button" class="exe-iv-match-del" data-index="' +
                index +
                '" aria-label="' +
                t('Delete') +
                '">✕</button></div>',
        )
        .join('');
    return (
        '<div class="exe-form-group"><label>' +
        t('Pairs to match') +
        '</label><div id="ivMatchPairs">' +
        rows +
        '</div><button type="button" id="ivAddPair" class="btn btn-secondary btn-sm">+ ' +
        t('Pair') +
        '</button></div>'
    );
}

/** Detail editor for a sortableList question's items (in the correct order). */
function detailSortableList(interaction: QuestionInteraction): string {
    const t = tr;
    const question = interaction.question as Record<string, unknown>;
    const items = Array.isArray(question.items) ? question.items : [];
    const rows = items
        .map(
            (item, index) =>
                '<li class="exe-iv-sort-item-row" data-index="' +
                index +
                '"><span class="exe-iv-sort-item-pos" aria-hidden="true">' +
                (index + 1) +
                '</span><input type="text" class="form-control exe-iv-sort-item-text" data-index="' +
                index +
                '" value="' +
                escapeHtml(item) +
                '"><button type="button" class="exe-iv-sort-item-up" data-index="' +
                index +
                '"' +
                (index === 0 ? ' disabled' : '') +
                ' aria-label="' +
                t('Move up') +
                '">▲</button><button type="button" class="exe-iv-sort-item-down" data-index="' +
                index +
                '"' +
                (index === items.length - 1 ? ' disabled' : '') +
                ' aria-label="' +
                t('Move down') +
                '">▼</button><button type="button" class="exe-iv-sort-item-del" data-index="' +
                index +
                '" aria-label="' +
                t('Delete') +
                '">✕</button></li>',
        )
        .join('');
    return (
        '<div class="exe-form-group"><label>' +
        t('Items in the correct order') +
        '</label><ol id="ivSortItems" class="exe-iv-sort-edit-list">' +
        rows +
        '</ol><button type="button" id="ivAddSortItem" class="btn btn-secondary btn-sm">+ ' +
        t('Item') +
        '</button></div>'
    );
}

/** Detail editor for a dropdown question (mark blanks + distractors). */
function detailDropdown(question: Record<string, unknown>): string {
    const t = tr;
    const words = Array.isArray(question.additionalWords) ? question.additionalWords.join('\n') : '';
    return (
        '<div class="exe-form-group"><button type="button" id="ivDropdownMarkBlank" class="btn btn-primary btn-sm">' +
        t('Mark selection as blank') +
        '</button><p class="exe-iv-hint">' +
        t('Write the sentence above, select a word and mark it as a blank. Each blank becomes a dropdown.') +
        '</p></div><div class="exe-form-group"><label for="ivDropdownWords">' +
        t('Distractor words (one per line)') +
        '</label><textarea id="ivDropdownWords" class="form-control" rows="3">' +
        escapeHtml(words) +
        '</textarea></div><p class="exe-iv-hint" id="ivDropdownSummary" role="status" aria-live="polite"></p>'
    );
}

/** Detail editor for a cloze question (mark blanks). */
function detailCloze(): string {
    const t = tr;
    return (
        '<div class="exe-form-group"><button type="button" id="ivClozeMark" class="btn btn-primary btn-sm">' +
        t('Mark selection as blank') +
        '</button><p class="exe-iv-hint">' +
        t(
            'Write the sentence above, select the word(s) learners must fill in, then mark them as a blank. Separate accepted variants with a vertical bar (|).',
        ) +
        '</p></div><p class="exe-iv-hint" id="ivClozeCount" role="status" aria-live="polite"></p>'
    );
}

/**
 * Dedicated True/False control: a labelled radio pair writing
 * `question.solution` (1 = True, 0 = False; default True). It never reuses
 * the multiple-choice answer rows and has no "+ Answer" button.
 */
function detailTrueFalse(interaction: QuestionInteraction): string {
    const t = tr;
    const question = interaction.question as Record<string, unknown>;
    const solution = question.solution === 0 ? 0 : 1;
    const name = 'ivTrueFalse-' + escapeHtml(interaction.id);
    const trueId = escapeHtml(interaction.id) + '-tf-true';
    const falseId = escapeHtml(interaction.id) + '-tf-false';
    return (
        '<fieldset class="exe-form-group exe-iv-truefalse"><legend>' +
        t('Answer') +
        '</legend>' +
        '<div class="exe-form-check"><input type="radio" class="exe-iv-tf-correct" name="' +
        name +
        '" id="' +
        trueId +
        '" value="1"' +
        (solution === 1 ? ' checked' : '') +
        '><label for="' +
        trueId +
        '">' +
        t('True') +
        '</label></div>' +
        '<div class="exe-form-check"><input type="radio" class="exe-iv-tf-correct" name="' +
        name +
        '" id="' +
        falseId +
        '" value="0"' +
        (solution === 0 ? ' checked' : '') +
        '><label for="' +
        falseId +
        '">' +
        t('False') +
        '</label></div></fieldset>'
    );
}

export function detailQuestion(interaction: QuestionInteraction): string {
    const t = tr;
    const question = interaction.question as Record<string, unknown> & Question;
    const answers = Array.isArray(question.answers) ? question.answers : [];
    const kinds: string[] = KNOWN_KINDS.slice();
    if (kinds.indexOf(question.kind) === -1 && question.kind) {
        kinds.push(question.kind);
    }
    const kindOptions = kinds
        .map(
            kind =>
                '<option value="' +
                kind +
                '"' +
                (question.kind === kind ? ' selected' : '') +
                '>' +
                t(kind) +
                '</option>',
        )
        .join('');
    // singleChoice is an EXCLUSIVE radio group (exactly one correct);
    // multipleChoice keeps independent checkboxes.
    const isSingle = question.kind === 'singleChoice';
    const correctType = isSingle ? 'radio' : 'checkbox';
    const correctName = isSingle ? ' name="ivAnswerCorrect-' + escapeHtml(interaction.id) + '"' : '';
    const answerRows = answers
        .map(
            (answer, index) =>
                '<div class="exe-iv-answer-row"><input type="' +
                correctType +
                '"' +
                correctName +
                ' class="exe-iv-answer-correct" data-index="' +
                index +
                '"' +
                (answer[1] === 1 ? ' checked' : '') +
                ' aria-label="' +
                t('Correct') +
                '"><input type="text" class="form-control exe-iv-answer-text" data-index="' +
                index +
                '" value="' +
                escapeHtml(answer[0]) +
                '"></div>',
        )
        .join('');
    let answersBlock: string;
    if (question.kind === 'singleChoice' || question.kind === 'multipleChoice') {
        answersBlock =
            '<div class="exe-form-group"><label>' +
            t('Answers') +
            '</label><div id="ivAnswers">' +
            answerRows +
            '</div><button type="button" id="ivAddAnswer" class="btn btn-secondary btn-sm">+ ' +
            t('Answer') +
            '</button></div>';
    } else if (question.kind === 'trueFalse') {
        answersBlock = detailTrueFalse(interaction);
    } else if (question.kind === 'dropdown') {
        answersBlock = detailDropdown(question);
    } else if (question.kind === 'cloze') {
        answersBlock = detailCloze();
    } else if (question.kind === 'matchElements') {
        answersBlock = detailMatchElements(interaction);
    } else if (question.kind === 'sortableList') {
        answersBlock = detailSortableList(interaction);
    } else {
        answersBlock =
            '<p class="exe-iv-hint">' +
            t('This question type is preserved; its answers are edited as raw content.') +
            '</p>';
    }
    return (
        '<div class="exe-form-group"><label for="ivQuestionKind">' +
        t('Question type') +
        '</label><select id="ivQuestionKind" class="form-select">' +
        kindOptions +
        '</select></div>' +
        '<div class="exe-form-group"><label for="ivQuestionPrompt">' +
        t('Question') +
        '</label><textarea id="ivQuestionPrompt" class="form-control" rows="2">' +
        escapeHtml(question.prompt || '') +
        '</textarea></div>' +
        answersBlock
    );
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export function bindQuestion(interaction: QuestionInteraction, host: DetailHost): void {
    const question = interaction.question as Record<string, unknown> & Question;
    $('#ivQuestionKind').on('change', function () {
        question.kind = $(this).val() ?? '';
        normalizeQuestionForKind(question);
        host.renderDetail();
    });
    $('#ivQuestionPrompt').on('input', function () {
        question.prompt = $(this).val() ?? '';
    });
    $('#ivAnswers')
        .find('.exe-iv-answer-text')
        .on('input', function () {
            const index = parseInt($(this).attr('data-index') ?? '', 10);
            const answers = question.answers as unknown[][] | undefined;
            const row = answers?.[index];
            if (row) {
                row[0] = $(this).val() ?? '';
            }
        });
    $('#ivAnswers')
        .find('.exe-iv-answer-correct')
        .on('change', function () {
            const index = parseInt($(this).attr('data-index') ?? '', 10);
            const answers = question.answers as unknown[][] | undefined;
            if (!answers) {
                return;
            }
            if (question.kind === 'singleChoice') {
                // Exclusive: exactly one correct answer.
                for (const row of answers) {
                    row[1] = 0;
                }
                const row = answers[index];
                if (row) {
                    row[1] = 1;
                }
            } else {
                const row = answers[index];
                if (row) {
                    row[1] = $(this).is(':checked') ? 1 : 0;
                }
            }
        });
    $('#ivAddAnswer').on('click', () => {
        (question.answers as unknown[][]).push(['', 0]);
        host.renderDetail();
    });
    if (question.kind === 'trueFalse') {
        if (question.solution !== 0 && question.solution !== 1) {
            question.solution = 1;
        }
        $('.exe-iv-tf-correct').on('change', function () {
            question.solution = parseInt($(this).val() ?? '', 10) === 1 ? 1 : 0;
        });
    }
    if (question.kind === 'matchElements') {
        bindMatchElements(question, host);
    }
    if (question.kind === 'sortableList') {
        bindSortableList(question, host);
    }
    if (question.kind === 'dropdown') {
        bindDropdown(question);
    }
    if (question.kind === 'cloze') {
        bindCloze(question);
    }
}

function bindMatchElements(question: Record<string, unknown>, host: DetailHost): void {
    if (!Array.isArray(question.pairs)) {
        question.pairs = [];
    }
    const pairs = question.pairs as unknown[][];
    $('#ivMatchPairs')
        .find('.exe-iv-match-left-input')
        .on('input', function () {
            const index = parseInt($(this).attr('data-index') ?? '', 10);
            if (!pairs[index]) {
                pairs[index] = ['', ''];
            }
            (pairs[index] as unknown[])[0] = $(this).val() ?? '';
        });
    $('#ivMatchPairs')
        .find('.exe-iv-match-right-input')
        .on('input', function () {
            const index = parseInt($(this).attr('data-index') ?? '', 10);
            if (!pairs[index]) {
                pairs[index] = ['', ''];
            }
            (pairs[index] as unknown[])[1] = $(this).val() ?? '';
        });
    $('#ivMatchPairs')
        .find('.exe-iv-match-del')
        .on('click', function () {
            pairs.splice(parseInt($(this).attr('data-index') ?? '', 10), 1);
            host.renderDetail();
        });
    $('#ivAddPair').on('click', () => {
        pairs.push(['', '']);
        host.renderDetail();
    });
}

function bindSortableList(question: Record<string, unknown>, host: DetailHost): void {
    if (!Array.isArray(question.items)) {
        question.items = [];
    }
    const items = question.items as string[];
    $('#ivSortItems')
        .find('.exe-iv-sort-item-text')
        .on('input', function () {
            items[parseInt($(this).attr('data-index') ?? '', 10)] = $(this).val() ?? '';
        });
    $('#ivSortItems')
        .find('.exe-iv-sort-item-up')
        .on('click', function () {
            const i = parseInt($(this).attr('data-index') ?? '', 10);
            if (i > 0) {
                const up = items[i - 1] as string;
                items[i - 1] = items[i] as string;
                items[i] = up;
                host.renderDetail();
            }
        });
    $('#ivSortItems')
        .find('.exe-iv-sort-item-down')
        .on('click', function () {
            const i = parseInt($(this).attr('data-index') ?? '', 10);
            if (i < items.length - 1) {
                const down = items[i + 1] as string;
                items[i + 1] = items[i] as string;
                items[i] = down;
                host.renderDetail();
            }
        });
    $('#ivSortItems')
        .find('.exe-iv-sort-item-del')
        .on('click', function () {
            items.splice(parseInt($(this).attr('data-index') ?? '', 10), 1);
            host.renderDetail();
        });
    $('#ivAddSortItem').on('click', () => {
        items.push('');
        host.renderDetail();
    });
}

function bindDropdown(question: Record<string, unknown> & Question): void {
    if (!Array.isArray(question.additionalWords)) {
        question.additionalWords = [];
    }
    const refreshSummary = (): void => {
        question.prompt = $('#ivQuestionPrompt').val() ?? '';
        question.segments = parsePromptText(question.prompt);
        const words = dropdownWordsFromSegments(question.segments);
        const pool = dropdownOptions(words, question.additionalWords);
        $('#ivDropdownSummary').text(
            tr('Blanks') + ': ' + words.length + ' · ' + tr('Options') + ': ' + pool.join(', '),
        );
    };
    $('#ivQuestionPrompt').on('input', refreshSummary);
    $('#ivDropdownWords').on('input', function () {
        question.additionalWords = ($(this).val() ?? '')
            .split('\n')
            .map(word => word.trim())
            .filter(word => word !== '');
        refreshSummary();
    });
    $('#ivDropdownMarkBlank').on('click', () => {
        wrapSelectionAsBlank();
        refreshSummary();
    });
    refreshSummary();
}

function bindCloze(question: Record<string, unknown> & Question): void {
    const updateClozeCount = (): void => {
        question.prompt = $('#ivQuestionPrompt').val() ?? '';
        question.segments = parsePromptText(question.prompt);
        $('#ivClozeCount').text(tr('Blanks') + ': ' + segmentBlanks(question.segments).length);
    };
    $('#ivQuestionPrompt').on('input', updateClozeCount);
    $('#ivClozeMark').on('click', () => {
        wrapSelectionAsBlank();
        updateClozeCount();
    });
    updateClozeCount();
}
