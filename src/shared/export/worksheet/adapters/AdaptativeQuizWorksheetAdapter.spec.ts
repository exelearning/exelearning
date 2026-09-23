import { describe, expect, it } from 'bun:test';
import type { PrintableActivity, PrintableItem, UnsupportedActivity } from '../types';
import { AdaptativeQuizWorksheetAdapter } from './AdaptativeQuizWorksheetAdapter';

/** One question, as the editor stores one: six option slots whatever the author filled. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        type: 0,
        typeSelect: 0,
        url: '',
        author: '',
        alt: '',
        question: '<p>¿Qué orgánulo guarda el material genético?</p>',
        numberOptions: 4,
        options: [
            { text: 'Mitocondria', audio: '' },
            { text: 'Núcleo', audio: '' },
            { text: 'Ribosoma', audio: '' },
            { text: 'Vacuola', audio: '' },
            { text: 'Borrador', audio: '' },
            { text: '', audio: '' },
        ],
        solutionMulti: [1],
        solutionOrder: [],
        solutionWord: '',
        percentageShow: 35,
        difficulty: 2,
        ...overrides,
    };
}

function properties(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { typeGame: 'adaptativeQuiz', questionsGame: [question()], ...overrides };
}

function build(overrides: Record<string, unknown> = {}, options = {}): PrintableActivity | null {
    return AdaptativeQuizWorksheetAdapter.build('', {
        properties: properties(overrides),
        random: () => 0.42,
        ...options,
    });
}

/** The options a question offers. */
function labelsOf(item: PrintableItem): string[] {
    if (item.answer?.kind !== 'options') throw new Error('Expected options');

    return item.answer.labels;
}

describe('AdaptativeQuizWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(AdaptativeQuizWorksheetAdapter.ideviceType).toBe('adaptative-quiz');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(build({}, { title: 'Cuestionario' })?.title).toBe('Cuestionario');
        expect(build()?.title).toBe('Adaptative quiz');
    });

    it('reads its data from the properties, this being a json activity', () => {
        expect(AdaptativeQuizWorksheetAdapter.build('<div class="adaptative-quiz-IDevice"></div>', {})).toBeNull();
    });

    it('prints every question, the adapting being what paper cannot do', () => {
        // On screen the quiz walks levels and no two learners see the same questions.
        const levels = [1, 2, 3].map(difficulty => question({ difficulty }));

        expect(build({ questionsGame: levels })?.items).toHaveLength(3);
    });

    describe('a question with options to tick', () => {
        it('offers them with a box each', () => {
            const [item] = build()!.items;

            expect(item.answer).toMatchObject({ marker: 'box' });
            expect(labelsOf(item)).toEqual(['Mitocondria', 'Núcleo', 'Ribosoma', 'Vacuola']);
        });

        it('offers only as many as the activity puts in play', () => {
            // The slots past `numberOptions` hold whatever the author last typed there.
            expect(labelsOf(build({ questionsGame: [question({ numberOptions: 2 })] })!.items[0])).toEqual([
                'Mitocondria',
                'Núcleo',
            ]);
        });

        it('never prints which of them are right', () => {
            expect(JSON.stringify(build())).not.toContain('solutionMulti');
        });

        it('keeps them in stored order, the activity asking nothing about it', () => {
            expect(labelsOf(build()!.items[0])).toEqual(['Mitocondria', 'Núcleo', 'Ribosoma', 'Vacuola']);
        });
    });

    describe('a question to put in order', () => {
        const sorted = () =>
            question({
                typeSelect: 1,
                numberOptions: 4,
                question: '<p>Ordena del más sencillo al más complejo</p>',
                options: [
                    { text: 'Célula' },
                    { text: 'Tejido' },
                    { text: 'Órgano' },
                    { text: 'Aparato' },
                    { text: 'Borrador' },
                    { text: '' },
                ],
                solutionOrder: [1, 2, 3, 4],
            });

        it('gives each one a line to write its position on', () => {
            expect(build({ questionsGame: [sorted()] })!.items[0].answer).toMatchObject({ marker: 'line' });
        });

        it('shuffles them, the stored order being the answer', () => {
            // The same rule Scrambled list follows: printed in order, the list is the solution.
            const stored = ['Célula', 'Tejido', 'Órgano', 'Aparato'];
            const orders = [0.1, 0.42, 0.7, 0.9].map(value =>
                labelsOf(build({ questionsGame: [sorted()] }, { random: () => value })!.items[0]),
            );

            expect(orders.every(order => JSON.stringify(order) === JSON.stringify(stored))).toBe(false);
            for (const order of orders) expect([...order].sort()).toEqual([...stored].sort());
        });

        it('never prints the order itself', () => {
            expect(JSON.stringify(build({ questionsGame: [sorted()] }))).not.toContain('solutionOrder');
        });
    });

    describe('a question answered with a word', () => {
        const word = (overrides: Record<string, unknown> = {}) =>
            question({
                typeSelect: 2,
                question: '<p>Doble circulación</p>',
                options: [],
                solutionWord: 'Pasa dos veces',
                percentageShow: 0,
                ...overrides,
            });

        it('leaves one box per character, grouped by word', () => {
            const answer = build({ questionsGame: [word()] })!.items[0].answer;
            if (answer?.kind !== 'characterBoxes') throw new Error('Expected boxes');

            expect(answer.groups).toHaveLength(3);
            expect(answer.groups.map(group => group.length)).toEqual([4, 3, 5]);
        });

        it('gives away the share of letters the activity asks for', () => {
            const answer = build({ questionsGame: [word({ percentageShow: 100 })] })!.items[0].answer;
            if (answer?.kind !== 'characterBoxes') throw new Error('Expected boxes');

            expect(answer.groups.flat().every(box => box !== null)).toBe(true);
        });

        it('gives none of it away when the activity gives none', () => {
            const answer = build({ questionsGame: [word()] })!.items[0].answer;
            if (answer?.kind !== 'characterBoxes') throw new Error('Expected boxes');

            expect(answer.groups.flat().every(box => box === null)).toBe(true);
        });

        it('leaves out a question with no word to write', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const activity = AdaptativeQuizWorksheetAdapter.build('', {
                properties: properties({ questionsGame: [word({ solutionWord: '' })] }),
                onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason),
            });

            expect(activity).toBeNull();
            expect(omissions).toEqual(['invalid-data']);
        });
    });

    describe('a question carrying a picture', () => {
        it('prints it beside the words', () => {
            const [item] = build({
                questionsGame: [question({ type: 1, url: 'asset://abc', alt: 'Una célula', author: 'CEDEC' })],
            })!.items;

            expect(item.media).toEqual({ kind: 'image', src: 'asset://abc', alt: 'Una célula', author: 'CEDEC' });
        });

        it('prints none when the question carries none', () => {
            expect(build()!.items[0].media).toBeUndefined();
            expect(build({ questionsGame: [question({ type: 1, url: '' })] })!.items[0].media).toBeUndefined();
        });
    });

    it('prints option text literally, the activity treating it as text', () => {
        const [item] = build({
            questionsGame: [question({ numberOptions: 2, options: [{ text: 'A<B' }, { text: '<img src=x onerror=1>' }] })],
        })!.items;

        expect(labelsOf(item)).toEqual(['A&lt;B', '&lt;img src=x onerror=1&gt;']);
    });

    it('strips anything unsafe the author left in a question', () => {
        const [item] = build({ questionsGame: [question({ question: '<p>Hola<script>alert(1)</script></p>' })] })!.items;

        expect(item.prompt).toBe('<p>Hola</p>');
    });

    describe('instructions and closing text', () => {
        it('reads both from the properties', () => {
            const activity = build({
                eXeFormInstructions: '<p>Elige la respuesta correcta</p>',
                eXeIdeviceTextAfter: '<p>Corrige con tu profesor</p>',
            });

            expect(activity?.instructions).toBe('<p>Elige la respuesta correcta</p>');
            expect(activity?.textAfter).toBe('<p>Corrige con tu profesor</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component with no properties at all', () => {
            expect(AdaptativeQuizWorksheetAdapter.build('', {})).toBeNull();
        });

        it('skips a quiz with no questions in it', () => {
            expect(build({ questionsGame: [] })).toBeNull();
        });

        it('leaves out a question with nothing to ask or nothing to answer', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const activity = AdaptativeQuizWorksheetAdapter.build('', {
                properties: properties({
                    questionsGame: [question(), question({ question: '' }), question({ options: [] })],
                }),
                random: () => 0.42,
                onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason),
            });

            expect(activity?.items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data', 'invalid-data']);
        });
    });
});
