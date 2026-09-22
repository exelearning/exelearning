import { describe, expect, it } from 'bun:test';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { FormWorksheetAdapter } from './FormWorksheetAdapter';

/** The activity's own words for true and false, as a Spanish project carries them. */
const MSGS = { msgTrue: 'Verdadero', msgFalse: 'Falso' };

interface FormFixture {
    questions?: Record<string, unknown>[];
    questionsRandom?: boolean;
    percentageQuestions?: unknown;
    eXeFormInstructions?: string;
    eXeIdeviceTextAfter?: string;
    msgs?: Record<string, string>;
}

function properties(fixture: FormFixture = {}): Record<string, unknown> {
    return {
        id: '20250605150704YWTQEJ',
        msgs: fixture.msgs ?? MSGS,
        questionsRandom: fixture.questionsRandom ?? false,
        percentageQuestions: fixture.percentageQuestions ?? '100',
        eXeFormInstructions: fixture.eXeFormInstructions,
        eXeIdeviceTextAfter: fixture.eXeIdeviceTextAfter,
        questionsData: fixture.questions ?? [{ activityType: 'true-false', baseText: '<p>¿Llueve?</p>', answer: '1' }],
    };
}

function itemsOf(fixture: FormFixture = {}, options = {}): PrintableItem[] {
    return FormWorksheetAdapter.build('', { properties: properties(fixture), random: () => 0.42, ...options })?.items ?? [];
}

/** The options a question offers, as the sheet lays them out. */
function labelsOf(item: PrintableItem): string[] {
    if (item.answer?.kind !== 'options') throw new Error('Expected options to tick');

    return item.answer.labels;
}

describe('FormWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(FormWorksheetAdapter.ideviceType).toBe('form');
    });

    it('uses the supplied title and falls back to the default', () => {
        const built = (title?: string) => FormWorksheetAdapter.build('', { properties: properties(), title });

        expect(built('Cuestionario')?.title).toBe('Cuestionario');
        expect(built()?.title).toBe('Form');
    });

    it('reads its data from the properties, the markup being an empty shell', () => {
        // The `json` family stores nothing in its HTML: `form-Data` holds `{}`.
        const shell = '<div class="form-IDevice"><div class="form-Data js-hidden">{}</div></div>';

        expect(FormWorksheetAdapter.build(shell, {})).toBeNull();
        expect(FormWorksheetAdapter.build(shell, { properties: properties() })?.items).toHaveLength(1);
    });

    describe('a statement to mark true or false', () => {
        it('offers the two in the activity own words', () => {
            const [item] = itemsOf();

            expect(item.prompt).toBe('<p>¿Llueve?</p>');
            expect(labelsOf(item)).toEqual(['Verdadero', 'Falso']);
            expect(item.answer).toMatchObject({ marker: 'box' });
        });

        it('falls back to something readable where a project stored none', () => {
            expect(labelsOf(itemsOf({ msgs: {} })[0])).toEqual(['True', 'False']);
        });

        it('never prints which of the two is right', () => {
            expect(JSON.stringify(itemsOf())).not.toContain('"answer":"1"');
        });
    });

    describe('options to tick', () => {
        const selection = (overrides: Record<string, unknown> = {}) => ({
            activityType: 'selection',
            selectionType: 'single',
            baseText: '<p>¿Capital de Francia?</p>',
            answers: [
                [false, 'Roma'],
                [true, 'París'],
                [false, 'Madrid'],
            ],
            ...overrides,
        });

        it('prints every option, whichever are right', () => {
            const [item] = itemsOf({ questions: [selection()] });

            expect([...labelsOf(item)].sort()).toEqual(['Madrid', 'París', 'Roma']);
        });

        it('never prints which they are', () => {
            // The pairs are `[isCorrect, text]`; only the text reaches the page.
            expect(JSON.stringify(itemsOf({ questions: [selection()] }))).not.toContain('true');
        });

        it('asks the same way whether one answer is right or several', () => {
            // On paper a box is a box: how many to tick is the question's own business.
            const single = itemsOf({ questions: [selection({ selectionType: 'single' })] })[0];
            const multiple = itemsOf({ questions: [selection({ selectionType: 'multiple' })] })[0];

            expect(single.answer).toMatchObject({ marker: 'box' });
            expect(multiple.answer).toMatchObject({ marker: 'box' });
        });

        it('leaves out an option the author left blank', () => {
            const [item] = itemsOf({
                questions: [selection({ answers: [[true, 'París'], [false, '  '], [false, 'Roma']] })],
            });

            expect(labelsOf(item)).toHaveLength(2);
        });

        it('leaves out a question with nothing to choose between', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { questions: [selection(), selection({ answers: [] })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data']);
        });
    });

    describe('a gap to write in', () => {
        const fill = (baseText: string) => ({ activityType: 'fill', baseText });

        it('replaces each blank with a gap the width of its answer', () => {
            const [item] = itemsOf({ questions: [fill('<p>El <u>Cid</u> y el <u>caballo</u>.</p>')] });

            expect(item.prompt).toContain('El <span class="worksheet-gap"');
            expect(item.prompt?.match(/worksheet-gap/g)).toHaveLength(2);
        });

        it('never prints the answer behind a blank', () => {
            const [item] = itemsOf({ questions: [fill('<p>El <u>Cid</u>.</p>')] });

            expect(item.prompt).not.toContain('Cid');
        });

        it('sizes the gap by the answer, which is all a printed exercise may give away', () => {
            const [short] = itemsOf({ questions: [fill('<p><u>sí</u></p>')] });
            const [long] = itemsOf({ questions: [fill('<p><u>indeterminación</u></p>')] });
            const width = (item: PrintableItem) => Number(/width: ([\d.]+)mm/.exec(item.prompt ?? '')?.[1]);

            expect(width(long)).toBeGreaterThan(width(short));
        });

        it('keeps the author formatting around the gaps', () => {
            const [item] = itemsOf({ questions: [fill('<p>El <strong>gran</strong> <u>Cid</u>.</p>')] });

            expect(item.prompt).toContain('<strong>gran</strong>');
        });

        it('offers no choices, a fill question having none', () => {
            const [item] = itemsOf({ questions: [fill('<p><u>Cid</u></p>')] });

            expect(item.prompt).not.toContain('worksheet-gap-options');
        });

        it('leaves out a question with no blank in it', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { questions: [fill('<p>Sin huecos</p>')] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(0);
            expect(omissions).toEqual(['invalid-data']);
        });
    });

    describe('a gap to choose a word for', () => {
        const dropdown = (overrides: Record<string, unknown> = {}) => ({
            activityType: 'dropdown',
            baseText: '<p>El <u>Cid</u> montaba a <u>Babieca</u>.</p>',
            wrongAnswersValue: 'Rocinante|Bucéfalo',
            ...overrides,
        });

        it('offers one set of choices at every gap, as the activity does', () => {
            // The activity builds a single list for the whole question and shows it at each blank.
            const [item] = itemsOf({ questions: [dropdown()] });
            const offered = item.prompt?.match(/worksheet-gap-options/g);

            expect(offered).toHaveLength(2);
            for (const word of ['Cid', 'Babieca', 'Rocinante', 'Bucéfalo'])
                expect(item.prompt?.match(new RegExp(word, 'g'))).toHaveLength(2);
        });

        it('takes the distractors the activity stored, split on the pipe', () => {
            const [item] = itemsOf({ questions: [dropdown({ wrongAnswersValue: 'Uno | Dos ||' })] });

            expect(item.prompt).toContain('Uno');
            expect(item.prompt).toContain('Dos');
        });

        it('works with no distractors at all', () => {
            const [item] = itemsOf({ questions: [dropdown({ wrongAnswersValue: '' })] });

            expect(item.prompt).toContain('worksheet-gap-options');
        });
    });

    it('strips anything unsafe the author left in a question', () => {
        const [item] = itemsOf({
            questions: [{ activityType: 'true-false', baseText: '<p>Hola<script>alert(1)</script></p>' }],
        });

        expect(item.prompt).toBe('<p>Hola</p>');
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => ({
            activityType: 'true-false',
            baseText: `<p>Q${i}</p>`,
        }));

        expect(itemsOf({ questions: four, percentageQuestions: '50' })).toHaveLength(2);
    });

    describe('instructions and closing text', () => {
        it('reads both from the properties, there being no divs to read', () => {
            const activity = FormWorksheetAdapter.build('', {
                properties: properties({
                    eXeFormInstructions: '<p>Completa el cuestionario</p>',
                    eXeIdeviceTextAfter: '<p>Entrégalo el lunes</p>',
                }),
            });

            expect(activity?.instructions).toBe('<p>Completa el cuestionario</p>');
            expect(activity?.textAfter).toBe('<p>Entrégalo el lunes</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component with no properties at all', () => {
            expect(FormWorksheetAdapter.build('', {})).toBeNull();
        });

        it('skips a questionnaire with no questions in it', () => {
            expect(FormWorksheetAdapter.build('', { properties: properties({ questions: [] }) })).toBeNull();
        });

        it('skips a question of a kind it does not know', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { questions: [{ activityType: 'something-new', baseText: '<p>¿Qué?</p>' }] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(0);
            expect(omissions).toEqual(['invalid-data']);
        });
    });
});
