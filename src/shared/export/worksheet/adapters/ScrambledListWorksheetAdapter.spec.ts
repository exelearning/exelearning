import { describe, expect, it } from 'bun:test';
import type { PrintableActivity } from '../types';
import { ScrambledListWorksheetAdapter } from './ScrambledListWorksheetAdapter';

/** The steps of the scientific method, as a real project stores them: in the right order. */
const STEPS = ['Observa el fenómeno', 'Plantea una pregunta', 'Formula una hipótesis', 'Diseña un experimento'];

function properties(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { typeGame: 'sortableList', options: STEPS, instructions: '', textAfter: '', ...overrides };
}

function build(overrides: Record<string, unknown> = {}, options = {}): PrintableActivity | null {
    return ScrambledListWorksheetAdapter.build('', {
        properties: properties(overrides),
        random: () => 0.42,
        ...options,
    });
}

/** The elements as the sheet offers them, each with a line beside it. */
function labelsOf(activity: PrintableActivity | null): string[] {
    const answer = activity?.items[0]?.answer;
    if (answer?.kind !== 'options') throw new Error('Expected elements with a line beside them');

    return answer.labels;
}

describe('ScrambledListWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ScrambledListWorksheetAdapter.ideviceType).toBe('scrambled-list');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(build({}, { title: 'Ordena' })?.title).toBe('Ordena');
        expect(build()?.title).toBe('Scrambled list');
    });

    it('reads its data from the properties, this being a json activity', () => {
        expect(ScrambledListWorksheetAdapter.build('<div class="scrambled-list-IDevice"></div>', {})).toBeNull();
    });

    it('asks it as one question, the whole activity being a single ordering', () => {
        const activity = build();

        expect(activity?.items).toHaveLength(1);
        expect(activity?.items[0].prompt).toBe('');
    });

    it('gives each element a line beside it, to write its position on', () => {
        // A line rather than a box: what the student puts there is a number.
        expect(build()?.items[0].answer).toMatchObject({ kind: 'options', marker: 'line' });
    });

    it('offers every element the activity stores', () => {
        expect([...labelsOf(build())].sort()).toEqual([...STEPS].sort());
    });

    it('never prints them in the order they are stored in, that being the answer', () => {
        // Drawn with several sources of randomness: none of them may leave the answer standing.
        const orders = [0.1, 0.42, 0.7, 0.9].map(value => labelsOf(build({}, { random: () => value })));

        expect(orders.every(order => JSON.stringify(order) === JSON.stringify(STEPS))).toBe(false);
    });

    it('drops an element the author left blank', () => {
        expect(labelsOf(build({ options: ['Uno', '', '   ', 'Dos', 'Tres'] }))).toHaveLength(3);
    });

    it('takes an element stored as a number, as the activity accepts one', () => {
        expect([...labelsOf(build({ options: [1, 2, 'Tres'] }))].sort()).toEqual(['1', '2', 'Tres']);
    });

    it('strips anything unsafe the author left in an element', () => {
        const labels = labelsOf(build({ options: ['Hola<script>alert(1)</script>', 'Adiós'] }));

        expect(labels).toContain('Hola');
        expect(labels.join('')).not.toContain('script');
    });

    describe('instructions and closing text', () => {
        it('reads both from the properties', () => {
            const activity = build({
                instructions: '<p>Ordena los pasos</p>',
                textAfter: '<p>Compruébalo con tu compañero</p>',
            });

            expect(activity?.instructions).toBe('<p>Ordena los pasos</p>');
            expect(activity?.textAfter).toBe('<p>Compruébalo con tu compañero</p>');
        });

        it('ignores the wrapped copy the editor derives from the closing text', () => {
            // `afterElement` is `textAfter` inside the activity's own div; reading it would print
            // that markup as well.
            const activity = build({ textAfter: '', afterElement: '<div class="x"><p>Derivado</p></div>' });

            expect(activity?.textAfter).toBeUndefined();
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component with no properties at all', () => {
            expect(ScrambledListWorksheetAdapter.build('', {})).toBeNull();
        });

        it('skips an activity with nothing to order', () => {
            expect(build({ options: [] })).toBeNull();
            expect(build({ options: ['   ', ''] })).toBeNull();
        });

        it('skips an activity of one element, which is not an ordering', () => {
            expect(build({ options: ['Sólo uno'] })).toBeNull();
        });
    });
});

describe('ScrambledListWorksheetAdapter and the shapes older projects wrapped an element in', () => {
    const elementsOf = (options: unknown[]) => {
        const activity = ScrambledListWorksheetAdapter.build('', {
            properties: { options, instructions: '', textAfter: '' },
            random: () => 0.42,
        });
        const answer = activity?.items[0]?.answer;
        if (answer?.kind !== 'options') throw new Error('Expected elements to order');

        return [...answer.labels].sort();
    };

    it('reads one kept in an object, under any of the names the activity accepts', () => {
        // `normalizeOptionItem` tries text, option, content, html, value, label, title, name.
        expect(elementsOf([{ text: 'Uno' }, { label: 'Dos' }, { value: 'Tres' }])).toEqual(['Dos', 'Tres', 'Uno']);
    });

    it('reads one kept in an array, taking its first entry with anything in it', () => {
        expect(elementsOf([['', 'Uno'], ['Dos']])).toEqual(['Dos', 'Uno']);
    });

    it('still reads the plain strings a project saves today', () => {
        expect(elementsOf(['Uno', 'Dos'])).toEqual(['Dos', 'Uno']);
    });

    it('drops a wrapper with nothing in it', () => {
        expect(elementsOf(['Uno', {}, { other: '' }, [], null, false, 'Dos'])).toEqual(['Dos', 'Uno']);
    });

    it('falls back to other own keys, including nested wrappers', () => {
        expect(elementsOf([{ other: 'Uno' }, { text: '', extra: { custom: ['', 'Dos'] } }])).toEqual(['Dos', 'Uno']);
    });

    it('prefers known wrapper keys over other keys regardless of insertion order', () => {
        expect(
            elementsOf([
                { other: 'Discarded', label: 'Uno' },
                { extra: 'Discarded', text: 'Dos' },
            ]),
        ).toEqual(['Dos', 'Uno']);
    });

    it('ignores inherited values when choosing an element', () => {
        const option = Object.assign(Object.create({ text: 'Inherited', extra: 'Inherited' }), { other: 'Uno' });
        expect(elementsOf([option, 'Dos'])).toEqual(['Dos', 'Uno']);
    });
});
