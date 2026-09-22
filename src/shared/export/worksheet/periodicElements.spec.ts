import { describe, expect, it } from 'bun:test';
import { PERIODIC_ELEMENTS, PERIODIC_GROUPS } from './periodicElements';

describe('the periodic table as the activity knows it', () => {
    it('carries every element, in atomic number order', () => {
        // The adapter indexes it as `PERIODIC_ELEMENTS[n - 1]`, which only holds if it is complete
        // and in order.
        expect(PERIODIC_ELEMENTS).toHaveLength(118);
        expect(PERIODIC_ELEMENTS.map(element => element.number)).toEqual(
            Array.from({ length: 118 }, (_, index) => index + 1),
        );
    });

    it('names each element and its group through the activity own wording', () => {
        for (const element of PERIODIC_ELEMENTS) {
            expect(element.nameKey).not.toBe('');
            expect(element.groupKey.startsWith('msg')).toBe(true);
        }
    });

    it('carries the chemistry every card prints', () => {
        for (const element of PERIODIC_ELEMENTS) {
            expect(element.symbol).toMatch(/^[A-Z][a-z]{0,2}$/);
            expect(Number.isFinite(element.mass)).toBe(true);
            expect(element.configuration).not.toBe('');
            expect(element.oxidation).not.toBe('');
        }
    });

    it('records no electronegativity for the noble gases that have none', () => {
        // Null rather than zero: an empty cell must not read as a measured value.
        const without = PERIODIC_ELEMENTS.filter(element => element.electronegativity === null);

        expect(without.map(element => element.symbol)).toEqual(['He', 'Ne', 'Ar', 'Rn']);
    });

    it('spells a few entries the way the activity does', () => {
        expect(PERIODIC_ELEMENTS[0]).toMatchObject({ number: 1, symbol: 'H', nameKey: 'Hydrogen' });
        expect(PERIODIC_ELEMENTS[25]).toMatchObject({
            symbol: 'Fe',
            nameKey: 'Iron',
            groupKey: 'msgTransitionMetal',
            mass: 55.845,
            oxidation: '+3,+2',
            configuration: '[Ar] 3d6 4s2',
        });
        expect(PERIODIC_ELEMENTS[117]).toMatchObject({ number: 118, symbol: 'Og' });
    });

    describe('the groups the author switches on', () => {
        it('are the ten the activity offers, in the order its flags index them', () => {
            // The order is part of the stored format: `groups[3]` is Post-Transition Metals.
            expect(PERIODIC_GROUPS.map(group => group.name)).toEqual([
                'Alkali Metals',
                'Alkaline Earth Metals',
                'Transition Metals',
                'Post-Transition Metals',
                'Metalloids',
                'Non-Metals',
                'Halogens',
                'Noble Gases',
                'Lanthanides',
                'Actinides',
            ]);
        });

        it('place every element in exactly one group', () => {
            const placed = PERIODIC_GROUPS.flatMap(group => [...group.numbers]);

            expect(placed).toHaveLength(118);
            expect(new Set(placed).size).toBe(118);
        });

        it('name each element group the same way its own entry does', () => {
            const byName: Record<string, string> = {
                'Alkali Metals': 'msgAlkaliMetal',
                'Alkaline Earth Metals': 'msgAlkalineEarthMetal',
                'Transition Metals': 'msgTransitionMetal',
                'Post-Transition Metals': 'msgPostTransitionMetal',
                Metalloids: 'msgMetalloid',
                'Non-Metals': 'msgNonMetal',
                Halogens: 'msgHalogen',
                'Noble Gases': 'msgNobleGas',
                Lanthanides: 'msgLanthanide',
                Actinides: 'msgActinide',
            };

            for (const group of PERIODIC_GROUPS)
                for (const atomicNumber of group.numbers)
                    expect(PERIODIC_ELEMENTS[atomicNumber - 1].groupKey).toBe(byName[group.name]);
        });
    });
});
