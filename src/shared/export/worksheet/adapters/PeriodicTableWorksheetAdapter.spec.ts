import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableElementCard } from '../types';
import { PeriodicTableWorksheetAdapter } from './PeriodicTableWorksheetAdapter';

interface PeriodicFixture {
    /** The editor stores All first, then the ten individual groups. */
    groups?: number[];
    number?: number;
    gameType?: number;
    mode?: number;
    types?: unknown[];
    /** Leave the field out of the payload entirely, as an older project may have. */
    omit?: 'number' | 'gameType';
    instructionsExe?: string;
    instructions?: string;
    instructionsDiv?: string;
    textAfter?: string;
    textAfterDiv?: string;
    msgs?: Record<string, string>;
}

/** The wording a Spanish project carries, which is what the sheet should print. */
const SPANISH = {
    msgGroup: 'Grupo',
    msgNumber: 'Número',
    msgName: 'Nombre',
    msgSymbol: 'Símbolo',
    msgAlkaliMetal: 'Metal alcalino',
    msgNobleGas: 'Gas noble',
    Lithium: 'Litio',
    Sodium: 'Sodio',
    Potassium: 'Potasio',
    Rubidium: 'Rubidio',
    Caesium: 'Cesio',
    Francium: 'Francio',
    Helium: 'Helio',
    Neon: 'Neón',
    Argon: 'Argón',
    Krypton: 'Kriptón',
    Xenon: 'Xenón',
    Radon: 'Radón',
    Oganesson: 'Oganesón',
};

/** Only the alkali metals, which is six elements and easy to reason about. */
const ALKALI = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Only the noble gases, seven elements of another colour. */
const NOBLE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0];

function periodicHtml(fixture: PeriodicFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Periodic table',
        groups: fixture.groups ?? ALKALI,
        number: fixture.omit === 'number' ? undefined : (fixture.number ?? 6),
        gameType: fixture.omit === 'gameType' ? undefined : (fixture.gameType ?? 2),
        mode: fixture.mode ?? 0,
        types: fixture.types,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        msgs: fixture.msgs ?? SPANISH,
    });

    let html = '<div class="periodic-table-IDevice">';
    if (fixture.instructionsDiv) html += `<div class="periodic-table-instructions">${fixture.instructionsDiv}</div>`;
    html += `<div class="periodic-table-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.textAfterDiv) html += `<div class="periodic-table-extra-content">${fixture.textAfterDiv}</div>`;

    return `${html}</div>`;
}

function cardsOf(fixture: PeriodicFixture = {}, options = {}): PrintableElementCard[] {
    const activity = PeriodicTableWorksheetAdapter.build(periodicHtml(fixture), { random: () => 0.42, ...options });
    if (activity?.board?.kind !== 'elementCards') throw new Error('Expected element cards');

    return activity.board.cards;
}

describe('PeriodicTableWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(PeriodicTableWorksheetAdapter.ideviceType).toBe('periodic-table');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(PeriodicTableWorksheetAdapter.build(periodicHtml(), { title: 'Tabla' })?.title).toBe('Tabla');
        expect(PeriodicTableWorksheetAdapter.build(periodicHtml(), {})?.title).toBe('Periodic table');
    });

    it('carries the cards as the board, each card being a question', () => {
        const activity = PeriodicTableWorksheetAdapter.build(periodicHtml(), {});

        expect(activity?.board?.kind).toBe('elementCards');
        expect(activity?.items).toEqual([]);
    });

    it('never draws the periodic table, which the activity does not draw on a phone either', () => {
        const printed = JSON.stringify(PeriodicTableWorksheetAdapter.build(periodicHtml(), {}));

        expect(printed).not.toContain('crosswordGrid');
        expect(printed).not.toContain('wordGrid');
    });

    describe('which elements are asked about', () => {
        it('uses all 118 elements when All is selected, regardless of the individual flags', () => {
            for (const individualFlags of [Array(10).fill(0), Array(10).fill(1), ALKALI.slice(1)]) {
                const numbers = cardsOf({ groups: [1, ...individualFlags], number: 118 })
                    .map(card => Number(card.number))
                    .sort((a, b) => a - b);

                expect(numbers).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
            }
        });

        it('keeps the last group, actinides, at its stored index', () => {
            const numbers = cardsOf({ groups: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], number: 118 })
                .map(card => Number(card.number))
                .sort((a, b) => a - b);

            expect(numbers).toEqual(Array.from({ length: 15 }, (_, i) => i + 89));
        });

        it('only those in the groups the author switched on', () => {
            // By atomic number, the symbol being the field this fixture asks for.
            const numbers = cardsOf({ groups: ALKALI }).map(card => Number(card.number));

            expect([...numbers].sort((a, b) => a - b)).toEqual([3, 11, 19, 37, 55, 87]);
        });

        it('as many as the activity asks for', () => {
            expect(cardsOf({ number: 3 })).toHaveLength(3);
        });

        it('every one of them when it asks for more than the groups hold', () => {
            expect(cardsOf({ number: 40 })).toHaveLength(6);
        });

        it('one at least, whatever the activity stored', () => {
            expect(cardsOf({ number: 0 })).toHaveLength(1);
            expect(cardsOf({ omit: 'number' })).toHaveLength(1);
        });

        it('drawn afresh, as the activity draws them on every load', () => {
            const first = cardsOf({ number: 3 }, { random: () => 0.1 }).map(card => card.number);
            const second = cardsOf({ number: 3 }, { random: () => 0.9 }).map(card => card.number);

            expect(first).not.toEqual(second);
        });
    });

    describe('what a card carries', () => {
        it('the chemistry the activity shows on its own card', () => {
            const card = cardsOf({ groups: ALKALI, number: 6 }).find(entry => entry.number === '3');

            expect(card).toMatchObject({
                groupLabel: 'Grupo',
                group: 'Metal alcalino',
                name: 'Litio',
                mass: '6.941',
                oxidation: ['+1'],
                configuration: '1s2 2s1',
            });
        });

        it('nothing the activity card hides, such as the electronegativity', () => {
            const [card] = cardsOf({ groups: ALKALI, number: 1 });

            expect(card).not.toHaveProperty('electronegativity');
        });

        it('the colour the activity gives its group', () => {
            expect(cardsOf({ groups: ALKALI, number: 6 }).map(card => card.color)).toEqual(Array(6).fill('#dfa5d2'));
            expect(cardsOf({ groups: NOBLE, number: 7 }).map(card => card.color)).toEqual(Array(7).fill('#c2c6ff'));
        });

        it('each oxidation state on its own, as the activity boxes them', () => {
            const oxygen = cardsOf({ groups: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0], number: 7 }).find(
                card => card.number === '6',
            );

            expect(oxygen?.oxidation).toEqual(['+4', '-4']);
        });
    });

    describe('which field is left blank', () => {
        it('the symbol', () => {
            const [card] = cardsOf({ gameType: 2 });

            expect(card.symbol).toBeNull();
            expect(card.number).not.toBeNull();
            expect(card.name).not.toBeNull();
        });

        it('the atomic number', () => {
            const [card] = cardsOf({ gameType: 0 });

            expect(card.number).toBeNull();
            expect(card.symbol).not.toBeNull();
        });

        it('the name', () => {
            const [card] = cardsOf({ gameType: 1 });

            expect(card.name).toBeNull();
            expect(card.symbol).not.toBeNull();
        });

        it('the atomic number, for a project that never stored which', () => {
            // The editor's first option, so an activity with nothing recorded still asks
            // something rather than showing all three and asking nothing.
            const [card] = cardsOf({ omit: 'gameType' });

            expect(card.number).toBeNull();
        });
    });

    describe('in Complete mode, where the author ticks several values at once', () => {
        const COMPLETE = 1;

        it('leaves blank every value ticked, and prints the rest', () => {
            // Number, name and group ticked; symbol, configuration and oxidation states not.
            const [card] = cardsOf({ mode: COMPLETE, types: [1, 1, 0, 1, 0, 0], gameType: 2 });

            expect(card.number).toBeNull();
            expect(card.name).toBeNull();
            expect(card.group).toBeNull();
            expect(card.symbol).not.toBeNull();
            expect(card.configuration).not.toBeNull();
            expect(card.oxidation.length).toBeGreaterThan(0);
        });

        it('keeps the colour and the word for group, as the activity card keeps them', () => {
            const [card] = cardsOf({ mode: COMPLETE, types: [0, 0, 0, 1, 0, 0] });

            expect(card.groupLabel).toBe('Grupo');
            expect(card.color).toBe('#dfa5d2');
        });

        it('honours the two flags the editor offers no switch for, as the runtime does', () => {
            const [card] = cardsOf({ mode: COMPLETE, types: [0, 0, 1, 0, 1, 1] });

            expect(card.configuration).toBeNull();
            expect(card.oxidation).toEqual([]);
            expect(card.symbol).toBeNull();
            expect(card.number).not.toBeNull();
        });

        it('ignores the single value gameType names, which the editor hides in this mode', () => {
            const [card] = cardsOf({ mode: COMPLETE, types: [0, 1, 0, 0, 0, 0], gameType: 2 });

            expect(card.name).toBeNull();
            expect(card.symbol).not.toBeNull();
        });

        it('falls back to gameType when nothing is ticked, so the sheet still asks something', () => {
            for (const types of [undefined, [0, 0, 0, 0, 0, 0], 'not a list']) {
                const [card] = cardsOf({ mode: COMPLETE, types: types as unknown[], gameType: 1 });

                expect(card.name).toBeNull();
                expect(card.number).not.toBeNull();
                expect(card.group).not.toBeNull();
            }
        });

        it('is the only mode that reads the ticks', () => {
            for (const mode of [0, 2]) {
                const [card] = cardsOf({ mode, types: [1, 1, 0, 1, 0, 0], gameType: 2 });

                expect(card.symbol).toBeNull();
                expect(card.number).not.toBeNull();
                expect(card.name).not.toBeNull();
                expect(card.group).not.toBeNull();
            }
        });
    });

    describe('the words the activity uses', () => {
        it('are its own, so a Spanish project stays in Spanish', () => {
            const [card] = cardsOf({ groups: NOBLE, number: 7 });

            expect(card.group).toBe('Gas noble');
            expect(card.groupLabel).toBe('Grupo');
        });

        it('fall back to something readable where a project stored none', () => {
            const [card] = cardsOf({ msgs: {} });

            expect(card.groupLabel).toBe('Group');
        });
    });

    describe('instructions and closing text', () => {
        it('reads the instructions from the div before the payload', () => {
            const activity = PeriodicTableWorksheetAdapter.build(
                periodicHtml({ instructionsDiv: '<p>Del div</p>', instructionsExe: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Del div</p>');
        });

        it('unescapes the rich instructions the payload keeps', () => {
            const activity = PeriodicTableWorksheetAdapter.build(
                periodicHtml({ instructionsExe: escape('<p>Completa los huecos</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Completa los huecos</p>');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = PeriodicTableWorksheetAdapter.build(
                periodicHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(PeriodicTableWorksheetAdapter.build('<div class="periodic-table-IDevice"></div>', {})).toBeNull();
        });

        it('skips an activity with no group switched on', () => {
            expect(PeriodicTableWorksheetAdapter.build(periodicHtml({ groups: [] }), {})).toBeNull();
            expect(
                PeriodicTableWorksheetAdapter.build(periodicHtml({ groups: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }), {}),
            ).toBeNull();
        });
    });
});
