import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableCard, PrintableCardGroup, UnsupportedActivity } from '../types';
import { answersAtMediumLevel, DiscoverWorksheetAdapter, membersPerAnswer } from './DiscoverWorksheetAdapter';

interface DiscoverFixture {
    instructions?: string;
    textAfter?: string;
    words?: Record<string, unknown>[];
    /** 0 pairs, 1 trios, 2 quartets. */
    gameMode?: number;
    gameLevels?: number;
    percentajeQuestions?: number;
    /** Sidecar pictures: position within the answer, then entry index. */
    images?: Record<number, Record<number, string>>;
}

/** One member of an answer. */
function member(text: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { eText: text, url: '', audio: '', alt: '', author: '', color: '', backcolor: '', ...overrides };
}

/** One answer, with as many members as the test needs. */
function word(texts: string[], overrides: Record<string, unknown>[] = []): Record<string, unknown> {
    return { data: texts.map((text, index) => member(text, overrides[index] ?? {})) };
}

/** Build component HTML the way the Discover editor writes it, sidecars and all. */
function discoverHtml(fixture: DiscoverFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Descubre',
        version: 4,
        gameMode: fixture.gameMode ?? 0,
        gameLevels: fixture.gameLevels,
        percentajeQuestions: fixture.percentajeQuestions,
        wordsGame: fixture.words ?? [word(['El caballo', 'Horse'])],
    });

    let html = '<div class="descubre-IDevice">';
    html += `<div class="descubre-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.instructions) html += `<div class="descubre-instructions js-hidden">${fixture.instructions}</div>`;
    for (const [position, byIndex] of Object.entries(fixture.images ?? {})) {
        for (const [index, href] of Object.entries(byIndex)) {
            html += `<a class="js-hidden descubre-LinkImages-${position}" href="${href}">${index}</a>`;
        }
    }
    if (fixture.textAfter) html += `<div class="descubre-extra-content">${fixture.textAfter}</div>`;
    html += '</div>';

    return html;
}

/** The columns the adapter built, or a failure if it built something else. */
function groupsOf(fixture: DiscoverFixture = {}, options = {}): PrintableCardGroup[] {
    const board = DiscoverWorksheetAdapter.build(discoverHtml(fixture), options)?.board;

    expect(board?.kind).toBe('groupColumns');
    return (board as { groups: PrintableCardGroup[] }).groups;
}

/** Every card of every column. */
function allCards(groups: PrintableCardGroup[]): PrintableCard[] {
    return groups.flatMap(group => group.columns.flat());
}

/** A source that walks a fixed sequence, so a shuffle can be pinned without being constant. */
function sequence(values: number[]): () => number {
    let index = 0;
    return () => values[index++ % values.length];
}

describe('membersPerAnswer', () => {
    it("reads the activity's own Type", () => {
        expect(membersPerAnswer(0)).toBe(2); // pairs
        expect(membersPerAnswer(1)).toBe(3); // trios
        expect(membersPerAnswer(2)).toBe(4); // quartets
    });

    it('falls back to pairs, and never past the four slots the editor keeps', () => {
        expect(membersPerAnswer(undefined)).toBe(2);
        expect(membersPerAnswer(-3)).toBe(2);
        expect(membersPerAnswer(9)).toBe(4);
    });
});

describe('answersAtMediumLevel', () => {
    it('prints every answer when the activity offers one level', () => {
        expect(answersAtMediumLevel(9, 1)).toBe(9);
        expect(answersAtMediumLevel(9, undefined)).toBe(9);
    });

    it('prints two thirds when there are three levels, which is the middle one', () => {
        // The runtime's own arithmetic: a third, two thirds, all.
        expect(answersAtMediumLevel(9, 3)).toBe(6);
        expect(answersAtMediumLevel(10, 3)).toBe(6);
    });

    it('prints the lower of two levels, there being no middle', () => {
        // The two are "half" and "all"; a default should be the one that is not the maximum.
        expect(answersAtMediumLevel(10, 2)).toBe(5);
    });

    it('always prints at least one answer, however the division falls', () => {
        expect(answersAtMediumLevel(1, 3)).toBe(1);
        expect(answersAtMediumLevel(2, 2)).toBe(1);
    });

    it('prints nothing when there is nothing', () => {
        expect(answersAtMediumLevel(0, 3)).toBe(0);
    });
});

describe('DiscoverWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(DiscoverWorksheetAdapter.ideviceType).toBe('discover');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(DiscoverWorksheetAdapter.build(discoverHtml(), { title: 'Descubre' })?.title).toBe('Descubre');
        expect(DiscoverWorksheetAdapter.build(discoverHtml(), {})?.title).toBe('Discover');
    });

    it('carries over instructions and closing text', () => {
        const activity = DiscoverWorksheetAdapter.build(
            discoverHtml({ instructions: '<p>Une las parejas</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Une las parejas</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('sets the whole exercise as columns, with no questions to number', () => {
        const activity = DiscoverWorksheetAdapter.build(discoverHtml(), {});

        expect(activity?.board?.kind).toBe('groupColumns');
        expect(activity?.items).toEqual([]);
    });

    describe('how many columns', () => {
        it('draws two for pairs', () => {
            const [group] = groupsOf({ gameMode: 0, words: [word(['A', 'B'])] });

            expect(group.columns).toHaveLength(2);
            expect(group.columns.map(column => column[0].text)).toEqual(['A', 'B']);
        });

        it('draws three for trios', () => {
            const [group] = groupsOf({ gameMode: 1, words: [word(['A', 'B', 'C'])] });

            expect(group.columns).toHaveLength(3);
            expect(group.columns.map(column => column[0].text)).toEqual(['A', 'B', 'C']);
        });

        it('draws four for quartets', () => {
            const [group] = groupsOf({ gameMode: 2, words: [word(['A', 'B', 'C', 'D'])] });

            expect(group.columns).toHaveLength(4);
            expect(group.columns.map(column => column[0].text)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('ignores the slots the mode leaves out', () => {
            // The editor keeps four slots on every entry whatever the mode uses.
            const [group] = groupsOf({ gameMode: 0, words: [word(['A', 'B', 'C', 'D'])] });

            expect(group.columns).toHaveLength(2);
        });
    });

    describe('difficulty levels', () => {
        const nine = Array.from({ length: 9 }, (_, i) => word([`A${i}`, `B${i}`]));

        it('prints every answer when the activity offers one level', () => {
            expect(allCards(groupsOf({ words: nine, gameLevels: 1 }))).toHaveLength(18);
        });

        it('prints the middle level when the activity offers three', () => {
            // Six answers of two cards: two thirds of nine, as the runtime's easy/medium/hard go.
            expect(allCards(groupsOf({ words: nine, gameLevels: 3 }))).toHaveLength(12);
        });

        it('prints the lower level when the activity offers two', () => {
            expect(allCards(groupsOf({ words: nine, gameLevels: 2 }))).toHaveLength(8);
        });
    });

    describe('pictures', () => {
        it('takes them from the sidecars, which key the position and the entry separately', () => {
            const [group] = groupsOf({
                gameMode: 1,
                words: [word(['', '', ''])],
                images: { 0: { 0: 'files/a.png' }, 1: { 0: 'files/b.png' }, 2: { 0: 'files/c.png' } },
            });

            expect(group.columns.map(column => column[0].media?.src)).toEqual([
                'files/a.png',
                'files/b.png',
                'files/c.png',
            ]);
        });

        it('keys each entry separately within one position', () => {
            const groups = groupsOf({
                words: [word(['', 'B0']), word(['', 'B1'])],
                images: { 0: { 0: 'files/first.png', 1: 'files/second.png' } },
            });
            const sources = groups[0].columns[0].map(card => card.media?.src);

            expect(sources.sort()).toEqual(['files/first.png', 'files/second.png']);
        });

        it('keeps both the picture and the text on one card', () => {
            const [group] = groupsOf({ words: [word(['El caballo', 'Horse'])], images: { 0: { 0: 'files/a.png' } } });

            expect(group.columns[0][0].text).toBe('El caballo');
            expect(group.columns[0][0].media?.src).toBe('files/a.png');
        });
    });

    describe('text and colours', () => {
        it('reads the text as stored, which this iDevice does not encode', () => {
            // Relate URI-encodes the same-named field; this one takes it straight off the input.
            const [group] = groupsOf({ words: [word(['La araña teje', 'The spider weaves'])] });

            expect(group.columns[0][0].text).toBe('La araña teje');
        });

        it('strips anything unsafe the author left in it', () => {
            const [group] = groupsOf({ words: [word(['Hola<script>alert(1)</script>', 'Hi'])] });

            expect(group.columns[0][0].text).toBe('Hola');
        });

        it('marks a card with its colour instead of filling it', () => {
            const [group] = groupsOf({
                words: [word(['A', 'B'], [{ backcolor: '#ffd95c', color: '#0d5aa7' }])],
            });

            expect(group.columns[0][0].accentColor).toBe('#ffd95c');
            expect(group.columns[0][0].textColor).toBe('#0d5aa7');
        });

        it('leaves a card unmarked when the author kept the editor default', () => {
            const [group] = groupsOf({
                words: [word(['A', 'B'], [{ backcolor: '#ffffff', color: '#000000' }])],
            });

            expect(group.columns[0][0].accentColor).toBeUndefined();
            expect(group.columns[0][0].textColor).toBeUndefined();
        });
    });

    describe('what cannot be printed', () => {
        it('leaves out an answer that loses a member to a sound clip', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const groups = groupsOf(
                { words: [word(['A', 'B']), word(['C', '']), word(['D', 'E'])] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(allCards(groups)).toHaveLength(4);
            expect(omissions).toEqual(['media-required']);
        });

        it('leaves out an answer with fewer members than the mode needs', () => {
            const groups = groupsOf({ gameMode: 1, words: [word(['A', 'B', 'C']), word(['D', 'E'])] });

            expect(allCards(groups)).toHaveLength(3);
        });

        it('skips the activity when no answer survives', () => {
            expect(DiscoverWorksheetAdapter.build(discoverHtml({ words: [word(['', ''])] }), {})).toBeNull();
        });

        it('skips a component whose payload cannot be read', () => {
            expect(DiscoverWorksheetAdapter.build('<div class="descubre-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no answers in it', () => {
            expect(DiscoverWorksheetAdapter.build(discoverHtml({ words: [] }), {})).toBeNull();
        });
    });

    describe('the share and the shuffle', () => {
        it('breaks the answers into blocks a page can hold', () => {
            const six = Array.from({ length: 6 }, (_, i) => word([`A${i}`, `B${i}`]));
            const groups = groupsOf({ words: six });

            expect(groups.map(group => group.columns[0].length)).toEqual([5, 1]);
        });

        it('shuffles every column on its own, so an answer does not share a line', () => {
            const five = Array.from({ length: 5 }, (_, i) => word([`A${i}`, `B${i}`, `C${i}`]));
            const [group] = groupsOf(
                { gameMode: 1, words: five },
                { random: sequence([0.9, 0.1, 0.5, 0.7, 0.3, 0.2]) },
            );
            const [first, second, third] = group.columns.map(column => column.map(card => card.text?.slice(1)));

            // Every column holds the same five answers...
            expect([...first].sort()).toEqual([...second].sort());
            expect([...first].sort()).toEqual([...third].sort());
            // ...but not in the same order, which is what the exercise rests on.
            expect(first).not.toEqual(second);
            expect(second).not.toEqual(third);
        });
    });
});
