import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditionHarness, EditorHarness } from '../../test/helpers';
import { installEditionHarness, mountEditor } from '../../test/helpers';
import type { InteractiveVideoDocumentV2, Question, QuestionInteraction } from '../../shared/types';
import { newDocument } from '../../shared/types';
import { createInteraction } from '../state';
import { normalizeQuestionForKind, validateQuestions, wrapSelectionAsBlank } from './question';

/** A question record whose per-kind fields can be poked at from tests. */
type LooseQuestion = Record<string, unknown> & Question;

function looseQuestion(kind: string, extra: Record<string, unknown> = {}): LooseQuestion {
    return { kind, prompt: '', score: 1, retry: true, ...extra } as LooseQuestion;
}

/** A document holding one question interaction of `kind`. */
function docWithQuestion(question: Record<string, unknown>): InteractiveVideoDocumentV2 {
    const doc = newDocument();
    const interaction = createInteraction('question', 'iv-0', 5) as QuestionInteraction;
    interaction.question = question as Question;
    doc.interactions = [interaction];
    return doc;
}

describe('normalizeQuestionForKind', () => {
    it('never throws on missing or non-object questions', () => {
        expect(() => normalizeQuestionForKind(null)).not.toThrow();
        expect(() => normalizeQuestionForKind(undefined)).not.toThrow();
        expect(() => normalizeQuestionForKind('nonsense' as unknown as Question)).not.toThrow();
    });

    it('gives choice questions answers and drops the other kinds’ fields', () => {
        const question = looseQuestion('singleChoice', { answers: [], solution: 1, segments: [{ t: 'text' }] });
        normalizeQuestionForKind(question);
        expect(question.answers).toEqual([
            ['', 1],
            ['', 0],
        ]);
        expect(question).not.toHaveProperty('solution');
        expect(question).not.toHaveProperty('segments');

        const multiple = looseQuestion('multipleChoice', { answers: [['A', 1]] });
        normalizeQuestionForKind(multiple);
        expect(multiple.answers).toEqual([['A', 1]]);
    });

    it('gives trueFalse a solution and no answer rows', () => {
        const question = looseQuestion('trueFalse', { answers: [['A', 1]], segments: [] });
        normalizeQuestionForKind(question);
        expect(question.solution).toBe(1);
        expect(question).not.toHaveProperty('answers');
        expect(question).not.toHaveProperty('segments');

        const isFalse = looseQuestion('trueFalse', { solution: 0 });
        normalizeQuestionForKind(isFalse);
        expect(isFalse.solution).toBe(0);
    });

    it('derives cloze segments from the plain-text prompt', () => {
        const question = looseQuestion('cloze', {
            prompt: 'el caballo [[blanco]]',
            answers: [['A', 1]],
            solution: 1,
            additionalWords: ['x'],
        });
        normalizeQuestionForKind(question);
        expect(question.segments).toEqual([
            { t: 'text', text: 'el caballo ' },
            { t: 'blank', answers: ['blanco'] },
        ]);
        expect(question).not.toHaveProperty('answers');
        expect(question).not.toHaveProperty('solution');
        expect(question).not.toHaveProperty('additionalWords');
    });

    it('derives dropdown segments and always keeps a distractor list', () => {
        const question = looseQuestion('dropdown', { prompt: 'the capital is [[Paris]]' });
        normalizeQuestionForKind(question);
        expect(question.additionalWords).toEqual([]);
        expect(question.segments).toHaveLength(2);

        const withWords = looseQuestion('dropdown', { prompt: '[[a]]', additionalWords: ['London'] });
        normalizeQuestionForKind(withWords);
        expect(withWords.additionalWords).toEqual(['London']);
    });

    it('leaves a kind it does not know exactly as it found it', () => {
        const question = looseQuestion('legacyThing', { blob: { a: 1 } });
        normalizeQuestionForKind(question);
        expect(question).toEqual({ kind: 'legacyThing', prompt: '', score: 1, retry: true, blob: { a: 1 } });
    });
});

describe('validateQuestions', () => {
    it('blocks a multiple-choice question with no correct answer (would always grade 0)', () => {
        const error = validateQuestions(
            docWithQuestion(
                looseQuestion('multipleChoice', {
                    prompt: 'Pick some',
                    answers: [
                        ['a', 0],
                        ['b', 0],
                    ],
                }),
            ),
        );
        expect(error).toContain('at least one correct answer');
        expect(
            validateQuestions(
                docWithQuestion(
                    looseQuestion('multipleChoice', {
                        prompt: 'Pick some',
                        answers: [
                            ['a', 1],
                            ['b', 0],
                        ],
                    }),
                ),
            ),
        ).toBeNull();
    });

    it('blocks a matching question without one complete pair', () => {
        expect(
            validateQuestions(docWithQuestion(looseQuestion('matchElements', { prompt: 'M', pairs: [] }))),
        ).toContain('at least one complete pair');
        expect(
            validateQuestions(
                docWithQuestion(looseQuestion('matchElements', { prompt: 'M', pairs: [['left', '']] })),
            ),
        ).toContain('at least one complete pair');
        expect(
            validateQuestions(
                docWithQuestion(looseQuestion('matchElements', { prompt: 'M', pairs: [['left', 'right']] })),
            ),
        ).toBeNull();
    });

    it('blocks an ordering question with fewer than two real items', () => {
        expect(
            validateQuestions(docWithQuestion(looseQuestion('sortableList', { prompt: 'S', items: ['one', ' '] }))),
        ).toContain('at least two items');
        expect(
            validateQuestions(
                docWithQuestion(looseQuestion('sortableList', { prompt: 'S', items: ['one', 'two'] })),
            ),
        ).toBeNull();
    });

    it('accepts a document with nothing to validate', () => {
        expect(validateQuestions(newDocument())).toBeNull();
        const doc = newDocument();
        doc.interactions = [createInteraction('note', 'iv-0', 1)];
        expect(validateQuestions(doc)).toBeNull();
    });

    it('requires at least two non-empty single-choice answers', () => {
        const error = validateQuestions(
            docWithQuestion(
                looseQuestion('singleChoice', {
                    prompt: 'Pick',
                    answers: [
                        ['Only', 1],
                        ['', 0],
                    ],
                }),
            ),
        );
        expect(error).toContain('at least two answers');
    });

    it('requires exactly one correct single-choice answer', () => {
        expect(
            validateQuestions(
                docWithQuestion(
                    looseQuestion('singleChoice', {
                        prompt: 'Pick',
                        answers: [
                            ['A', 0],
                            ['B', 0],
                        ],
                    }),
                ),
            ),
        ).toContain('exactly one correct');
        expect(
            validateQuestions(
                docWithQuestion(
                    looseQuestion('singleChoice', {
                        prompt: 'Pick',
                        answers: [
                            ['A', 1],
                            ['B', 1],
                        ],
                    }),
                ),
            ),
        ).toContain('exactly one correct');
    });

    it('accepts a valid single choice (two answers, exactly one correct)', () => {
        expect(
            validateQuestions(
                docWithQuestion(
                    looseQuestion('singleChoice', {
                        prompt: 'Pick',
                        answers: [
                            ['A', 1],
                            ['B', 0],
                        ],
                    }),
                ),
            ),
        ).toBeNull();
    });

    it('treats missing single-choice answers as too few', () => {
        expect(validateQuestions(docWithQuestion(looseQuestion('singleChoice', { prompt: 'Pick' })))).toContain(
            'at least two answers',
        );
    });

    it('requires a trueFalse statement', () => {
        expect(validateQuestions(docWithQuestion(looseQuestion('trueFalse', { solution: 1 })))).toContain(
            'need a statement',
        );
        expect(
            validateQuestions(docWithQuestion(looseQuestion('trueFalse', { prompt: '   ', solution: 1 }))),
        ).toContain('need a statement');
        expect(
            validateQuestions(docWithQuestion(looseQuestion('trueFalse', { prompt: 'The sky is green', solution: 0 }))),
        ).toBeNull();
    });

    it('requires at least one blank in cloze and dropdown questions', () => {
        expect(validateQuestions(docWithQuestion(looseQuestion('cloze', { prompt: 'no blanks here' })))).toContain(
            'at least one blank',
        );
        expect(validateQuestions(docWithQuestion(looseQuestion('dropdown', { prompt: 'no blanks here' })))).toContain(
            'at least one blank',
        );
        // Blanks are accepted from the stored segments or parsed from the prompt.
        expect(
            validateQuestions(docWithQuestion(looseQuestion('cloze', { prompt: 'el caballo [[blanco]]' }))),
        ).toBeNull();
        expect(
            validateQuestions(
                docWithQuestion(
                    looseQuestion('dropdown', { prompt: 'ignored', segments: [{ t: 'blank', answers: ['Paris'] }] }),
                ),
            ),
        ).toBeNull();
    });

    it('leaves unknown legacy kinds to the runtime', () => {
        expect(validateQuestions(docWithQuestion(looseQuestion('legacyThing')))).toBeNull();
    });
});

describe('wrapSelectionAsBlank', () => {
    function mountPrompt(value: string, start: number, end: number): HTMLTextAreaElement {
        document.body.innerHTML = '<textarea id="ivQuestionPrompt"></textarea>';
        const textarea = document.getElementById('ivQuestionPrompt') as HTMLTextAreaElement;
        textarea.value = value;
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
        return textarea;
    }

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('does nothing without a prompt field or without a selection', () => {
        expect(() => wrapSelectionAsBlank()).not.toThrow();
        const textarea = mountPrompt('el caballo blanco', 5, 5);
        wrapSelectionAsBlank();
        expect(textarea.value).toBe('el caballo blanco');
    });

    it('inserts a plain-text [[…]] token, never markup', () => {
        const textarea = mountPrompt('el caballo blanco', 11, 17);
        wrapSelectionAsBlank();
        expect(textarea.value).toBe('el caballo [[blanco]]');
        expect(textarea.value).not.toContain('<span');
        expect(textarea.value).not.toContain('line-through');
        // The selection still covers the marked word.
        expect(textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)).toBe('blanco');
    });

    it('toggles the token off when the selection is inside one', () => {
        const textarea = mountPrompt('el caballo [[blanco]]', 13, 19);
        wrapSelectionAsBlank();
        expect(textarea.value).toBe('el caballo blanco');
    });

    it('toggles the token off when the selection is the whole token', () => {
        const textarea = mountPrompt('el caballo [[blanco]]', 11, 21);
        wrapSelectionAsBlank();
        expect(textarea.value).toBe('el caballo blanco');
        expect(textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)).toBe('blanco');
    });
});

describe('the question detail editor', () => {
    let edition: EditionHarness;
    let harness: EditorHarness;
    let interaction: QuestionInteraction;

    beforeEach(() => {
        edition = installEditionHarness();
        harness = mountEditor();
        harness.editor.addInteraction('question');
        interaction = harness.state.doc.interactions[0] as QuestionInteraction;
    });

    afterEach(() => {
        edition.restore();
    });

    /** Switch kind through the select, the way an author does. */
    function switchKind(kind: string): LooseQuestion {
        $('#ivQuestionKind').val(kind).trigger('change');
        return interaction.question as LooseQuestion;
    }

    function markSelection(value: string, start: number, end: number): void {
        const prompt = document.getElementById('ivQuestionPrompt') as HTMLTextAreaElement;
        prompt.value = value;
        prompt.selectionStart = start;
        prompt.selectionEnd = end;
    }

    it('offers every known question type and keeps an unknown one', () => {
        const kinds = Array.from(document.querySelectorAll<HTMLOptionElement>('#ivQuestionKind option')).map(
            option => option.value,
        );
        expect(kinds).toEqual([
            'singleChoice',
            'multipleChoice',
            'trueFalse',
            'dropdown',
            'cloze',
            'matchElements',
            'sortableList',
        ]);
        (interaction.question as LooseQuestion).kind = 'legacyThing';
        harness.editor.renderDetail();
        expect(
            Array.from(document.querySelectorAll<HTMLOptionElement>('#ivQuestionKind option')).map(o => o.value),
        ).toContain('legacyThing');
        expect(document.querySelector('#ivDetailPanel .exe-iv-hint')?.textContent).toContain('preserved');
    });

    it('escapes an authored prompt into the textarea', () => {
        $('#ivQuestionPrompt').val('<b>¿Cuál?</b>').trigger('input');
        harness.editor.renderDetail();
        expect(document.querySelector<HTMLTextAreaElement>('#ivQuestionPrompt')?.value).toBe('<b>¿Cuál?</b>');
        expect(document.querySelector('#ivDetailPanel b')).toBeNull();
    });

    describe('single and multiple choice', () => {
        it('renders exclusive radio toggles for single choice and keeps one correct answer', () => {
            (interaction.question as LooseQuestion).answers = [
                ['A', 1],
                ['B', 0],
            ];
            harness.editor.renderDetail();
            const toggles = document.querySelectorAll<HTMLInputElement>('.exe-iv-answer-correct');
            expect(toggles.length).toBe(2);
            for (const toggle of toggles) {
                expect(toggle.getAttribute('type')).toBe('radio');
            }
            const name = toggles[0]?.getAttribute('name');
            expect(name).toContain('ivAnswerCorrect-');
            expect(toggles[1]?.getAttribute('name')).toBe(name);
            // Selecting B zeroes A in the model (exclusive).
            toggles[1]!.checked = true;
            $(toggles[1]!).trigger('change');
            expect((interaction.question as LooseQuestion).answers).toEqual([
                ['A', 0],
                ['B', 1],
            ]);
        });

        it('keeps independent checkbox toggles for multiple choice', () => {
            const question = switchKind('multipleChoice');
            const toggles = document.querySelectorAll<HTMLInputElement>('.exe-iv-answer-correct');
            expect(toggles.length).toBe(2);
            for (const toggle of toggles) {
                expect(toggle.getAttribute('type')).toBe('checkbox');
            }
            toggles[1]!.checked = true;
            $(toggles[1]!).trigger('change');
            expect(question.answers).toEqual([
                ['', 1],
                ['', 1],
            ]);
            toggles[0]!.checked = false;
            $(toggles[0]!).trigger('change');
            expect(question.answers).toEqual([
                ['', 0],
                ['', 1],
            ]);
        });

        it('writes answer text and appends new answers', () => {
            const firstAnswer = document.querySelectorAll<HTMLInputElement>('#ivAnswers .exe-iv-answer-text')[0]!;
            $(firstAnswer).val('Paris').trigger('input');
            expect((interaction.question as LooseQuestion).answers).toEqual([
                ['Paris', 1],
                ['', 0],
            ]);
            document.getElementById('ivAddAnswer')?.click();
            expect((interaction.question as LooseQuestion).answers).toHaveLength(3);
            expect(document.querySelectorAll('#ivAnswers .exe-iv-answer-row').length).toBe(3);
        });
    });

    describe('true / false', () => {
        it('renders a dedicated radio pair with no answer repeater', () => {
            const question = switchKind('trueFalse');
            const radios = document.querySelectorAll<HTMLInputElement>('.exe-iv-tf-correct');
            expect(radios.length).toBe(2);
            for (const radio of radios) {
                expect(radio.getAttribute('type')).toBe('radio');
            }
            expect(document.getElementById('ivAnswers')).toBeNull();
            expect(document.getElementById('ivAddAnswer')).toBeNull();
            // Default solution = True (1).
            expect(question.solution).toBe(1);
            expect(document.querySelector<HTMLInputElement>('.exe-iv-tf-correct[value="1"]')?.checked).toBe(true);
        });

        it('writes question.solution when False is chosen', () => {
            const question = switchKind('trueFalse');
            const falseRadio = document.querySelector<HTMLInputElement>('.exe-iv-tf-correct[value="0"]');
            falseRadio!.checked = true;
            $(falseRadio!).trigger('change');
            expect(question.solution).toBe(0);
            harness.editor.renderDetail();
            expect(document.querySelector<HTMLInputElement>('.exe-iv-tf-correct[value="0"]')?.checked).toBe(true);
        });

        it('repairs a solution that is out of range when the editor opens', () => {
            const question = interaction.question as LooseQuestion;
            question.kind = 'trueFalse';
            question.solution = 7;
            harness.editor.renderDetail();
            expect(question.solution).toBe(1);
        });
    });

    describe('cloze', () => {
        it('marks the selection as a [[…]] blank and stores HTML-free segments', () => {
            const question = switchKind('cloze');
            const mark = document.getElementById('ivClozeMark');
            expect(mark?.classList.contains('btn-primary')).toBe(true);
            expect(mark?.classList.contains('btn-secondary')).toBe(false);
            markSelection('el caballo blanco', 11, 17);
            mark?.click();
            expect(document.querySelector<HTMLTextAreaElement>('#ivQuestionPrompt')?.value).toBe(
                'el caballo [[blanco]]',
            );
            expect(question.prompt).toBe('el caballo [[blanco]]');
            expect(question.prompt).not.toContain('<span');
            expect(JSON.stringify(question.segments)).not.toContain('<span');
            expect((question.segments as Array<{ t: string }>).filter(s => s.t === 'blank')).toHaveLength(1);
            expect(document.getElementById('ivClozeCount')?.textContent).toContain('1');
        });

        it('keeps the blank count live as the prompt is typed', () => {
            const question = switchKind('cloze');
            $('#ivQuestionPrompt').val('[[a]] y [[b]]').trigger('input');
            expect((question.segments as Array<{ t: string }>).filter(s => s.t === 'blank')).toHaveLength(2);
            expect(document.getElementById('ivClozeCount')?.textContent).toContain('2');
        });
    });

    describe('dropdown', () => {
        it('marks blanks and collects distractor words', () => {
            const question = switchKind('dropdown');
            const mark = document.getElementById('ivDropdownMarkBlank');
            expect(mark?.classList.contains('btn-primary')).toBe(true);
            expect(mark?.classList.contains('btn-secondary')).toBe(false);
            markSelection('the capital is Paris', 15, 20);
            mark?.click();
            expect(document.querySelector<HTMLTextAreaElement>('#ivQuestionPrompt')?.value).toBe(
                'the capital is [[Paris]]',
            );
            expect(question.prompt).not.toContain('<span');
            expect((question.segments as Array<{ t: string }>).filter(s => s.t === 'blank')).toHaveLength(1);

            $('#ivDropdownWords').val('London\nBerlin\n\n').trigger('input');
            expect(question.additionalWords).toEqual(['London', 'Berlin']);
            const summary = document.getElementById('ivDropdownSummary')?.textContent ?? '';
            expect(summary).toContain('Paris');
            expect(summary).toContain('London');
            expect(summary).toContain('Berlin');
        });
    });

    describe('match elements', () => {
        it('adds, edits and deletes pairs', () => {
            const question = switchKind('matchElements');
            expect(document.getElementById('ivMatchPairs')).not.toBeNull();
            document.getElementById('ivAddPair')?.click();
            expect(question.pairs).toEqual([['', '']]);
            $('#ivMatchPairs .exe-iv-match-left-input').val('Madrid').trigger('input');
            $('#ivMatchPairs .exe-iv-match-right-input').val('España').trigger('input');
            expect(question.pairs).toEqual([['Madrid', 'España']]);
            document.getElementById('ivAddPair')?.click();
            expect(question.pairs).toHaveLength(2);
            document.querySelector<HTMLElement>('#ivMatchPairs .exe-iv-match-del')?.click();
            expect(question.pairs).toEqual([['', '']]);
        });
    });

    describe('sortable list', () => {
        it('adds, edits, reorders and deletes items', () => {
            const question = switchKind('sortableList');
            expect(document.getElementById('ivSortItems')).not.toBeNull();
            document.getElementById('ivAddSortItem')?.click();
            document.getElementById('ivAddSortItem')?.click();
            expect(question.items).toEqual(['', '']);
            const texts = document.querySelectorAll<HTMLInputElement>('#ivSortItems .exe-iv-sort-item-text');
            $(texts[0]!).val('First').trigger('input');
            $(texts[1]!).val('Second').trigger('input');
            expect(question.items).toEqual(['First', 'Second']);
            // The first row cannot move up and the last cannot move down.
            expect(
                document.querySelector('#ivSortItems .exe-iv-sort-item-up[data-index="0"]')?.hasAttribute('disabled'),
            ).toBe(true);
            document.querySelector<HTMLElement>('#ivSortItems .exe-iv-sort-item-up[data-index="1"]')?.click();
            expect(question.items).toEqual(['Second', 'First']);
            document.querySelector<HTMLElement>('#ivSortItems .exe-iv-sort-item-down[data-index="0"]')?.click();
            expect(question.items).toEqual(['First', 'Second']);
            // Moving beyond the ends is a no-op.
            document.querySelector<HTMLElement>('#ivSortItems .exe-iv-sort-item-up[data-index="0"]')?.click();
            document.querySelector<HTMLElement>('#ivSortItems .exe-iv-sort-item-down[data-index="1"]')?.click();
            expect(question.items).toEqual(['First', 'Second']);
            document.querySelector<HTMLElement>('#ivSortItems .exe-iv-sort-item-del[data-index="0"]')?.click();
            expect(question.items).toEqual(['Second']);
        });
    });
});
