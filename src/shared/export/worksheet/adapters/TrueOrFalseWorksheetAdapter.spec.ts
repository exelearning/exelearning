import { describe, expect, it } from 'bun:test';
import type { PrintableActivity, PrintableItem, UnsupportedActivity } from '../types';
import { TrueOrFalseWorksheetAdapter } from './TrueOrFalseWorksheetAdapter';

/** A question as a real project stores one, hint and feedback included. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        question: '<p>¿El corazón humano tiene cuatro cavidades?</p>',
        suggestion: '<p>Recuerda los conceptos de aurículas y ventrículos.</p>',
        feedback: '<p>El sistema circulatorio depende de ello.</p>',
        solution: 1,
        ...overrides,
    };
}

function properties(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        typeGame: 'TrueOrFalse',
        msgs: { msgTrue: 'Verdadero', msgFalse: 'Falso' },
        questionsRandom: false,
        percentageQuestions: 100,
        questionsGame: [question()],
        ...overrides,
    };
}

function build(overrides: Record<string, unknown> = {}, options = {}): PrintableActivity | null {
    return TrueOrFalseWorksheetAdapter.build('', {
        properties: properties(overrides),
        random: () => 0.42,
        ...options,
    });
}

/** The two words the activity offers. */
function labelsOf(item: PrintableItem): string[] {
    if (item.answer?.kind !== 'options') throw new Error('Expected two boxes to tick');

    return item.answer.labels;
}

describe('TrueOrFalseWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(TrueOrFalseWorksheetAdapter.ideviceType).toBe('trueorfalse');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(build({}, { title: 'Verdadero o falso' })?.title).toBe('Verdadero o falso');
        expect(build()?.title).toBe('True or false');
    });

    it('reads its data from the properties, this being a json activity', () => {
        expect(TrueOrFalseWorksheetAdapter.build('<div class="trueorfalse-IDevice"></div>', {})).toBeNull();
    });

    it('sets each statement with two boxes beside it', () => {
        const [item] = build()?.items ?? [];

        expect(item.prompt).toBe('<p>¿El corazón humano tiene cuatro cavidades?</p>');
        expect(labelsOf(item)).toEqual(['Verdadero', 'Falso']);
        expect(item.answer).toMatchObject({ marker: 'box' });
    });

    describe('the two words', () => {
        it('are the activity own, so a Spanish project stays in Spanish', () => {
            expect(labelsOf(build()!.items[0])).toEqual(['Verdadero', 'Falso']);
        });

        it('fall back to something readable where a project stored none', () => {
            expect(labelsOf(build({ msgs: {} })!.items[0])).toEqual(['True', 'False']);
        });

        it('are escaped, an author being free to type anything into them', () => {
            // The renderer writes a label into markup as it is given.
            const labels = labelsOf(
                build({ msgs: { msgTrue: '<img src=x onerror=alert(1)>', msgFalse: 'A<B' } })!.items[0],
            );

            expect(labels).toEqual(['&lt;img src=x onerror=alert(1)&gt;', 'A&lt;B']);
        });
    });

    describe('what is never printed', () => {
        it('which of the two is right, however the activity stored it', () => {
            // The editor writes a boolean; the migration from the questionnaire shape writes 1/0.
            for (const solution of [true, false, 1, 0]) {
                const printed = JSON.stringify(build({ questionsGame: [question({ solution })] }));

                expect(printed).not.toContain('solution');
            }
        });

        it('the hint, which on screen the student chooses to reveal', () => {
            expect(JSON.stringify(build())).not.toContain('aurículas');
        });

        it('the feedback, which comes after the answer', () => {
            expect(JSON.stringify(build())).not.toContain('circulatorio');
        });
    });

    it('strips anything unsafe the author left in a statement', () => {
        const [item] = build({
            questionsGame: [question({ question: '<p>Hola<script>alert(1)</script></p>' })],
        })!.items;

        expect(item.prompt).toBe('<p>Hola</p>');
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => question({ question: `<p>Q${i}</p>` }));

        expect(build({ questionsGame: four, percentageQuestions: 50 })?.items).toHaveLength(2);
    });

    describe('instructions and closing text', () => {
        it('reads both from the properties', () => {
            const activity = build({
                eXeGameInstructions: '<p>Marca verdadero o falso</p>',
                eXeIdeviceTextAfter: '<p>Revisa tus respuestas</p>',
            });

            expect(activity?.instructions).toBe('<p>Marca verdadero o falso</p>');
            expect(activity?.textAfter).toBe('<p>Revisa tus respuestas</p>');
        });

        it('reads the instructions a migrated activity keeps under the questionnaire name', () => {
            const activity = build({ eXeFormInstructions: '<p>De la forma antigua</p>' });

            expect(activity?.instructions).toBe('<p>De la forma antigua</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component with no properties at all', () => {
            expect(TrueOrFalseWorksheetAdapter.build('', {})).toBeNull();
        });

        it('skips an activity with no questions in it', () => {
            expect(build({ questionsGame: [] })).toBeNull();
        });

        it('leaves out a statement with no words', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const activity = TrueOrFalseWorksheetAdapter.build('', {
                properties: properties({ questionsGame: [question(), question({ question: '  ' })] }),
                random: () => 0.42,
                onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason),
            });

            expect(activity?.items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data']);
        });
    });
});

describe('TrueOrFalseWorksheetAdapter and a project saved before the migration', () => {
    /** The questionnaire shape, which the editor turns into `questionsGame` when it opens one. */
    const legacy = {
        msgs: { msgTrue: 'Verdadero', msgFalse: 'Falso' },
        eXeFormInstructions: '<p>De la forma antigua</p>',
        questionsData: [
            { baseText: '<p>¿El agua hierve a 100 °C?</p>', answer: 'True', hint: '<p>A nivel del mar</p>' },
            { baseText: '<p>¿El Sol gira alrededor de la Tierra?</p>', answer: 'False' },
        ],
    };

    it('prints its statements, which nothing rewrites until the author saves', () => {
        const activity = TrueOrFalseWorksheetAdapter.build('', { properties: legacy });

        expect(activity?.items.map(item => item.prompt)).toEqual([
            '<p>¿El agua hierve a 100 °C?</p>',
            '<p>¿El Sol gira alrededor de la Tierra?</p>',
        ]);
    });

    it('offers the same two words beside each', () => {
        const activity = TrueOrFalseWorksheetAdapter.build('', { properties: legacy });

        expect(activity?.items[0].answer).toEqual({ kind: 'options', labels: ['Verdadero', 'Falso'], marker: 'box' });
    });

    it('prints neither the answer nor the hint', () => {
        // The legacy shape records which is right as the string 'True' or 'False'.
        const printed = JSON.stringify(TrueOrFalseWorksheetAdapter.build('', { properties: legacy })?.items);

        expect(printed).not.toContain('True');
        expect(printed).not.toContain('nivel del mar');
    });

    it('prefers the migrated questions where a project carries both', () => {
        const activity = TrueOrFalseWorksheetAdapter.build('', {
            properties: { ...legacy, questionsGame: [{ question: '<p>La migrada</p>' }] },
        });

        expect(activity?.items.map(item => item.prompt)).toEqual(['<p>La migrada</p>']);
    });
});
