/**
 * Unit tests for the runtime scoring glue: reading the learner's responses out
 * of the overlay DOM, grading them with the shared pure functions, reflecting
 * the outcome into the results table, and keeping score/completion current.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { emptyPlayback } from '../shared/playback';
import { normalizeV2 } from '../shared/schema';
import { sortInteractions } from '../shared/scheduling';
import type { InteractiveVideoDocumentV2, Question, QuestionInteraction } from '../shared/types';
import type { RuntimeInstance } from './instance';
import { makeTranslator, renderQuestionHtml, renderViewHtml, type Translate } from './renderer';
import { gradeInteraction, refreshResults, updateScore } from './scoring';

interface Harness {
    instance: RuntimeInstance;
    overlay: HTMLElement;
    root: HTMLElement;
}

/** Normalize a partial v2 payload into a full document, as the runtime does. */
function makeDoc(overrides: Record<string, unknown> = {}): InteractiveVideoDocumentV2 {
    return normalizeV2({
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        ...overrides,
    });
}

/** A question interaction from a RAW question object (segments as authored). */
function questionInteraction(question: Record<string, unknown>, id = 'iv-q'): QuestionInteraction {
    return { id, type: 'question', time: 5, duration: null, pause: true, question: question as unknown as Question };
}

/** Mount a document's view and build the instance state scoring reads. */
function mount(doc: InteractiveVideoDocumentV2, id = 'iv1'): Harness {
    document.body.innerHTML = renderViewHtml(doc, id, makeTranslator(doc.customTexts));
    const root = document.getElementById('exe-iv-' + id);
    const overlay = document.querySelector<HTMLElement>('.exe-iv-overlay');
    if (!root || !overlay) {
        throw new Error('the view did not mount');
    }
    const instance: RuntimeInstance = {
        id: id,
        doc: doc,
        root: root,
        sorted: sortInteractions(doc.interactions),
        provider: 'local',
        video: null,
        iframe: null,
        adapter: null,
        t: makeTranslator(doc.customTexts),
        consumed: new Set<string>(),
        pending: [],
        answered: {},
        results: {},
        playback: emptyPlayback(),
        duration: undefined,
        seen: {},
        overlayActive: false,
        overlayTimer: null,
        lastTime: -Infinity,
        start() {},
        seek() {},
        pause() {},
        resume() {},
        destroy() {},
        recordResult(interactionId, fraction) {
            instance.results[interactionId] = fraction;
            instance.answered[interactionId] = true;
            updateScore(instance);
        },
    };
    return { instance, overlay, root };
}

/** Render one question into the panel and hand back what grading needs. */
function present(
    question: Record<string, unknown>,
    translator?: Translate,
): Harness & { interaction: QuestionInteraction } {
    const interaction = questionInteraction(question);
    const doc = makeDoc({ interactions: [interaction] });
    const harness = mount(doc);
    if (translator) {
        harness.instance.t = translator;
    }
    harness.overlay.innerHTML = renderQuestionHtml(interaction, harness.instance.id, harness.instance.t);
    return { ...harness, interaction };
}

function feedback(overlay: HTMLElement): HTMLElement {
    const node = overlay.querySelector<HTMLElement>('.exe-iv-feedback');
    if (!node) {
        throw new Error('the question rendered no feedback area');
    }
    return node;
}

function statusOf(root: HTMLElement, id: string): string {
    return root.querySelector('tr[data-iv-result="' + id + '"] .exe-iv-results-status span')?.textContent ?? '';
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('refreshResults', () => {
    const doc = makeDoc({
        interactions: [
            { id: 'c', type: 'cover', time: 0, body: '<p>Portada</p>' },
            { id: 'n', type: 'note', time: 5, body: '<p>Hi</p>' },
            {
                id: 'q',
                type: 'question',
                time: 10,
                question: {
                    kind: 'singleChoice',
                    prompt: 'Q?',
                    answers: [
                        ['a', 1],
                        ['b', 0],
                    ],
                },
            },
        ],
    });

    it('shows a dash until an interaction has been reached', () => {
        const { instance, root } = mount(doc);
        refreshResults(instance);
        expect(statusOf(root, 'n')).toBe('-');
        expect(statusOf(root, 'q')).toBe('-');
    });

    it('marks a viewed note as Seen and a graded question as a percentage', () => {
        const { instance, root } = mount(doc);
        instance.seen['n'] = true;
        instance.results['q'] = 0.5;
        refreshResults(instance);
        expect(statusOf(root, 'n')).toBe('Seen');
        expect(statusOf(root, 'q')).toBe('50%');
    });

    it('fills in the total from the aggregated score', () => {
        const { instance, root } = mount(doc);
        instance.results['q'] = 1;
        updateScore(instance);
        expect(root.querySelector('.exe-iv-results-total span')?.textContent).toBe('100%');
    });

    it('lets a Custom text replace the Seen label', () => {
        const custom = makeDoc({ ...doc, customTexts: { seen: 'Visto' } });
        const { instance, root } = mount(custom);
        instance.seen['n'] = true;
        refreshResults(instance);
        expect(statusOf(root, 'n')).toBe('Visto');
    });

    it('is a no-op when the author turned the results table off', () => {
        const { instance, root } = mount(makeDoc({ ...doc, scorm: { showResults: false } }));
        instance.results['q'] = 1;
        expect(() => refreshResults(instance)).not.toThrow();
        expect(root.querySelector('.exe-iv-results-table')).toBeNull();
    });
});

describe('updateScore', () => {
    function scoredDoc(overrides: Record<string, unknown> = {}): InteractiveVideoDocumentV2 {
        return makeDoc({
            interactions: [
                { id: 'n', type: 'note', time: 3, body: 'x' },
                {
                    id: 'q1',
                    type: 'question',
                    time: 5,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Q1',
                        answers: [
                            ['a', 1],
                            ['b', 0],
                        ],
                    },
                },
                {
                    id: 'q2',
                    type: 'question',
                    time: 8,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Q2',
                        answers: [
                            ['a', 1],
                            ['b', 0],
                        ],
                    },
                },
            ],
            ...overrides,
        });
    }

    it('aggregates the questions only, in the shapes SCORM expects', () => {
        const { instance } = mount(scoredDoc());
        instance.results['q1'] = 1;
        instance.answered['q1'] = true;
        updateScore(instance);
        expect(instance.score?.raw).toBe(1);
        expect(instance.score?.max).toBe(2);
        expect(instance.score?.percent).toBe(50);
        expect(instance.score?.scaled10).toBe(5);
    });

    it('counts every interaction in the denominator when legacy scoreNIA is on', () => {
        const { instance } = mount(scoredDoc({ meta: { legacy: { scoreNIA: true } } }));
        instance.results['q1'] = 1;
        instance.results['q2'] = 1;
        updateScore(instance);
        expect(instance.score?.max).toBe(3);
        expect(instance.score?.percent).toBe(67);
    });

    it('never auto-completes an activity whose completion mode is none', () => {
        const { instance } = mount(scoredDoc());
        instance.results['q1'] = 1;
        instance.results['q2'] = 1;
        instance.answered['q1'] = true;
        instance.answered['q2'] = true;
        updateScore(instance);
        expect(instance.completed).toBe(false);
    });

    it('completes an answerRequired activity once every question is answered', () => {
        const { instance } = mount(scoredDoc({ completion: { mode: 'answerRequired', requiredScore: null } }));
        instance.answered['q1'] = true;
        updateScore(instance);
        expect(instance.completed).toBe(false);
        instance.answered['q2'] = true;
        updateScore(instance);
        expect(instance.completed).toBe(true);
    });

    it('completes a scoreThreshold activity at or above the required percentage', () => {
        const { instance } = mount(scoredDoc({ completion: { mode: 'scoreThreshold', requiredScore: 100 } }));
        instance.results['q1'] = 1;
        instance.answered['q1'] = true;
        updateScore(instance);
        expect(instance.completed).toBe(false);
        instance.results['q2'] = 1;
        instance.answered['q2'] = true;
        updateScore(instance);
        expect(instance.completed).toBe(true);
    });

    it('does not accept a watch activity satisfied by reaching the end without watching', () => {
        const { instance } = mount(scoredDoc({ completion: { mode: 'watch', requiredScore: null } }));
        instance.duration = 100;
        instance.watched = true;
        updateScore(instance);
        expect(instance.completed).toBe(false);
    });

    it('completes a watch activity that really was watched', () => {
        const { instance } = mount(scoredDoc({ completion: { mode: 'watch', requiredScore: null } }));
        instance.duration = 10;
        instance.playback = { segments: [[0, 10]], totalWatchTime: 10 };
        updateScore(instance);
        expect(instance.completed).toBe(true);
    });

    it('falls back to the ended event when the provider reports no duration', () => {
        const { instance } = mount(scoredDoc({ completion: { mode: 'watch', requiredScore: null } }));
        instance.duration = undefined;
        updateScore(instance);
        expect(instance.completed).toBe(false);
        instance.watched = true;
        updateScore(instance);
        expect(instance.completed).toBe(true);
    });

    it('works with no gamification layer at all (plain HTML export)', () => {
        const { instance } = mount(scoredDoc());
        expect(() => updateScore(instance)).not.toThrow();
    });
});

describe('gradeInteraction', () => {
    it('nudges instead of grading a question the learner has not answered', () => {
        const { instance, interaction, overlay } = present({
            kind: 'singleChoice',
            prompt: 'Capital?',
            answers: [
                ['Paris', 1],
                ['Rome', 0],
            ],
        });
        expect(gradeInteraction(instance, interaction, overlay)).toBe(false);
        // No score is recorded, so the learner is not silently given a 0.
        expect(instance.results['iv-q']).toBeUndefined();
        expect(feedback(overlay).textContent).toBe('Please finish the activity');
        // The nudge is not a verdict, so it is not coloured like one.
        expect(feedback(overlay).className).toContain('is-pending');
        expect(feedback(overlay).className).not.toContain('is-wrong');
    });

    it('grades a single choice and marks the verdict with a state class', () => {
        const { instance, interaction, overlay } = present({
            kind: 'singleChoice',
            prompt: 'Capital?',
            answers: [
                ['Paris', 1],
                ['Rome', 0],
            ],
        });
        const paris = overlay.querySelector<HTMLInputElement>('input[value="0"]');
        if (!paris) {
            throw new Error('the choices did not render');
        }
        paris.checked = true;
        expect(gradeInteraction(instance, interaction, overlay)).toBe(true);
        expect(instance.results['iv-q']).toBe(1);
        // The wording carries the verdict; the class only adds colour on top.
        expect(feedback(overlay).textContent).toBe('Correct!');
        expect(feedback(overlay).className).toContain('is-correct');
    });

    it('records a wrong single choice as zero', () => {
        const { instance, interaction, overlay } = present({
            kind: 'singleChoice',
            prompt: 'Capital?',
            answers: [
                ['Paris', 1],
                ['Rome', 0],
            ],
        });
        const rome = overlay.querySelector<HTMLInputElement>('input[value="1"]');
        if (!rome) {
            throw new Error('the choices did not render');
        }
        rome.checked = true;
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(0);
        expect(feedback(overlay).textContent).toBe('Incorrect');
        expect(feedback(overlay).className).toContain('is-wrong');
    });

    it('replaces the recorded score when the learner answers again', () => {
        const { instance, interaction, overlay } = present({
            kind: 'singleChoice',
            prompt: 'Capital?',
            answers: [
                ['Paris', 1],
                ['Rome', 0],
            ],
        });
        const [paris, rome] = Array.from(overlay.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
        if (!paris || !rome) {
            throw new Error('the choices did not render');
        }
        rome.checked = true;
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(0);
        rome.checked = false;
        paris.checked = true;
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(1);
    });

    it('gives partial credit for a partly-correct multiple choice', () => {
        const { instance, interaction, overlay } = present({
            kind: 'multipleChoice',
            prompt: 'Even numbers?',
            answers: [
                ['Two', 1],
                ['Three', 0],
                ['Four', 1],
            ],
        });
        const boxes = Array.from(overlay.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        const two = boxes[0];
        if (!two) {
            throw new Error('the choices did not render');
        }
        two.checked = true;
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(0.5);
        expect(feedback(overlay).textContent).toBe('Partially correct');
        expect(feedback(overlay).className).toContain('is-partial');
    });

    it('grades True/False both ways', () => {
        for (const [solution, pick, expected] of [
            [1, '1', 1],
            [1, '0', 0],
            [0, '1', 0],
            [0, '0', 1],
        ] as const) {
            const { instance, interaction, overlay } = present({ kind: 'trueFalse', prompt: 'Sky?', solution });
            const radio = overlay.querySelector<HTMLInputElement>('input[value="' + pick + '"]');
            if (!radio) {
                throw new Error('the True/False control did not render');
            }
            radio.checked = true;
            gradeInteraction(instance, interaction, overlay);
            expect(instance.results['iv-q']).toBe(expected);
        }
    });

    it('grades a cloze case-insensitively and locks the fields', () => {
        const { instance, interaction, overlay } = present({
            kind: 'cloze',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
            ],
        });
        const input = overlay.querySelector<HTMLInputElement>('.exe-iv-cloze-input');
        if (!input) {
            throw new Error('the cloze did not render');
        }
        input.value = '  paris ';
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(1);
        expect(input.classList.contains('is-correct')).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('false');
        expect(input.getAttribute('readonly')).toBe('readonly');
    });

    it('shows the expected answer next to a wrong cloze blank', () => {
        const { instance, interaction, overlay } = present({
            kind: 'cloze',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
            ],
        });
        const input = overlay.querySelector<HTMLInputElement>('.exe-iv-cloze-input');
        if (!input) {
            throw new Error('the cloze did not render');
        }
        input.value = 'Rome';
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(0);
        expect(input.classList.contains('is-incorrect')).toBe(true);
        expect(overlay.querySelector('.exe-iv-cloze-solution')?.textContent).toContain('Paris');
    });

    it('does not grade a cloze the learner left blank', () => {
        const { instance, interaction, overlay } = present({
            kind: 'cloze',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
            ],
        });
        expect(gradeInteraction(instance, interaction, overlay)).toBe(false);
        expect(instance.results['iv-q']).toBeUndefined();
    });

    it('grades a dropdown per blank and marks each select', () => {
        const { instance, interaction, overlay } = present({
            kind: 'dropdown',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
                { t: 'text', text: ' and ' },
                { t: 'blank', answers: ['Madrid'] },
            ],
            additionalWords: ['London'],
        });
        const selects = Array.from(overlay.querySelectorAll<HTMLSelectElement>('.exe-iv-dropdown-select'));
        const [first, second] = selects;
        if (!first || !second) {
            throw new Error('the dropdown did not render both blanks');
        }
        first.value = 'Paris';
        second.value = 'London';
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(0.5);
        expect(first.getAttribute('aria-invalid')).toBe('false');
        expect(first.classList.contains('is-correct')).toBe(true);
        expect(second.getAttribute('aria-invalid')).toBe('true');
        expect(second.classList.contains('is-wrong')).toBe(true);
    });

    it('does not grade a dropdown with nothing chosen', () => {
        const { instance, interaction, overlay } = present({
            kind: 'dropdown',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
            ],
            additionalWords: ['London'],
        });
        expect(gradeInteraction(instance, interaction, overlay)).toBe(false);
        expect(feedback(overlay).textContent).toBe('Please finish the activity');
    });

    it('grades matchElements by the select of each left row', () => {
        const { instance, interaction, overlay } = present({
            kind: 'matchElements',
            prompt: 'Match',
            pairs: [
                ['France', 'Paris'],
                ['Spain', 'Madrid'],
            ],
        });
        const selects = Array.from(overlay.querySelectorAll<HTMLSelectElement>('.exe-iv-match-select'));
        const [france, spain] = selects;
        if (!france || !spain) {
            throw new Error('the match rows did not render');
        }
        france.value = 'Paris';
        spain.value = 'Madrid';
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(1);
    });

    it('does not grade matchElements with no pair chosen', () => {
        const { instance, interaction, overlay } = present({
            kind: 'matchElements',
            prompt: 'Match',
            pairs: [['France', 'Paris']],
        });
        expect(gradeInteraction(instance, interaction, overlay)).toBe(false);
        expect(instance.results['iv-q']).toBeUndefined();
    });

    it('treats a sortable list as answered even when left in its shuffled order', () => {
        const { instance, interaction, overlay } = present({
            kind: 'sortableList',
            prompt: 'Order',
            items: ['A', 'B', 'C'],
        });
        expect(gradeInteraction(instance, interaction, overlay)).toBe(true);
        expect(typeof instance.results['iv-q']).toBe('number');
    });

    it('scores a sortable list put in the correct order and then locks it', () => {
        const { instance, interaction, overlay } = present({
            kind: 'sortableList',
            prompt: 'Order',
            items: ['A', 'B', 'C'],
        });
        const list = overlay.querySelector('.exe-iv-sortable-list');
        if (!list) {
            throw new Error('the sortable list did not render');
        }
        Array.from(list.querySelectorAll('.exe-iv-sortable-item'))
            .sort((a, b) => Number(a.getAttribute('data-iv-index')) - Number(b.getAttribute('data-iv-index')))
            .forEach(item => list.appendChild(item));
        gradeInteraction(instance, interaction, overlay);
        expect(instance.results['iv-q']).toBe(1);
        for (const button of Array.from(overlay.querySelectorAll<HTMLButtonElement>('.exe-iv-sort-btn'))) {
            expect(button.disabled).toBe(true);
        }
    });

    it('grades a migrated multi-correct single choice without throwing (first-correct-wins)', () => {
        // The migration keeps only the first correct answer; grading the kept
        // one must still score, and picking the demoted one must not throw.
        const doc = makeDoc({
            interactions: [
                {
                    id: 'iv-q',
                    type: 'question',
                    time: 5,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Q?',
                        answers: [
                            ['a', 1],
                            ['b', 1],
                        ],
                    },
                },
            ],
        });
        const interaction = doc.interactions[0];
        if (!interaction || interaction.type !== 'question') {
            throw new Error('the question was not normalized');
        }
        expect(interaction.question).toMatchObject({
            answers: [
                ['a', 1],
                ['b', 0],
            ],
        });
        const harness = mount(doc);
        harness.overlay.innerHTML = renderQuestionHtml(interaction, harness.instance.id, harness.instance.t);
        const kept = harness.overlay.querySelector<HTMLInputElement>('input[value="0"]');
        if (!kept) {
            throw new Error('the choices did not render');
        }
        kept.checked = true;
        expect(() => gradeInteraction(harness.instance, interaction, harness.overlay)).not.toThrow();
        expect(harness.instance.results['iv-q']).toBe(1);
    });

    it('reflects the grade into the results table and the total', () => {
        const doc = makeDoc({
            interactions: [
                {
                    id: 'iv-q',
                    type: 'question',
                    time: 5,
                    question: { kind: 'trueFalse', prompt: 'Sky?', solution: 1 },
                },
            ],
        });
        const interaction = doc.interactions[0];
        if (!interaction || interaction.type !== 'question') {
            throw new Error('the question was not normalized');
        }
        const harness = mount(doc);
        harness.overlay.innerHTML = renderQuestionHtml(interaction, harness.instance.id, harness.instance.t);
        const radio = harness.overlay.querySelector<HTMLInputElement>('input[value="1"]');
        if (!radio) {
            throw new Error('the True/False control did not render');
        }
        radio.checked = true;
        gradeInteraction(harness.instance, interaction, harness.overlay);
        expect(statusOf(harness.root, 'iv-q')).toBe('100%');
        expect(harness.root.querySelector('.exe-iv-results-total span')?.textContent).toBe('100%');
    });

    it('lets Custom texts replace the verdicts and the nudge', () => {
        const translator = makeTranslator({
            right: '¡Bien!',
            wrong: 'Mal',
            notAnswered: 'Contesta primero',
        });
        const { instance, interaction, overlay } = present(
            { kind: 'trueFalse', prompt: 'Sky?', solution: 1 },
            translator,
        );
        gradeInteraction(instance, interaction, overlay);
        expect(feedback(overlay).textContent).toBe('Contesta primero');
        const radio = overlay.querySelector<HTMLInputElement>('input[value="1"]');
        if (!radio) {
            throw new Error('the True/False control did not render');
        }
        radio.checked = true;
        gradeInteraction(instance, interaction, overlay);
        expect(feedback(overlay).textContent).toBe('¡Bien!');
    });
});
