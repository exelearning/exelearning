import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableCard, PrintableCardGroup, UnsupportedActivity } from '../types';
import { RelateWorksheetAdapter } from './RelateWorksheetAdapter';

interface RelateFixture {
    instructions?: string;
    textAfter?: string;
    cards?: Record<string, unknown>[];
    percentajeCards?: number;
    randomCards?: boolean;
    /** Sidecar pictures, by card index. */
    images?: Record<number, string>;
    imagesBack?: Record<number, string>;
}

/** One card, with both faces carrying text unless the test says otherwise. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        eText: encodeURIComponent('El caballo'),
        eTextBk: encodeURIComponent('Horse'),
        url: '',
        urlBk: '',
        color: '',
        backcolor: '',
        colorBk: '',
        backcolorBk: '',
        ...overrides,
    };
}

/** Build component HTML the way the Relate editor writes it, sidecars and all. */
function relateHtml(fixture: RelateFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Relaciona',
        instructions: fixture.instructions ?? '',
        percentajeCards: fixture.percentajeCards,
        randomCards: fixture.randomCards,
        cardsGame: fixture.cards ?? [card()],
    });

    let html = '<div class="relaciona-IDevice">';
    html += `<div class="relaciona-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    for (const [index, href] of Object.entries(fixture.images ?? {})) {
        html += `<a class="js-hidden relaciona-LinkImages" href="${href}">${index}</a>`;
    }
    for (const [index, href] of Object.entries(fixture.imagesBack ?? {})) {
        html += `<a class="js-hidden relaciona-LinkImagesBack" href="${href}">${index}</a>`;
    }
    if (fixture.textAfter) html += `<div class="relaciona-extra-content">${fixture.textAfter}</div>`;
    html += '</div>';

    return html;
}

/** The two columns the adapter built, or a failure if it built something else. */
function groupsOf(fixture: RelateFixture = {}, options = {}): PrintableCardGroup[] {
    const board = RelateWorksheetAdapter.build(relateHtml(fixture), options)?.board;

    expect(board?.kind).toBe('groupColumns');
    return (board as { groups: PrintableCardGroup[] }).groups;
}

/** A source that walks a fixed sequence, so a shuffle can be pinned without being constant. */
function sequence(values: number[]): () => number {
    let index = 0;
    return () => values[index++ % values.length];
}

/** Every card of both columns, for the assertions that do not care which side it was on. */
function allCards(groups: PrintableCardGroup[]): PrintableCard[] {
    return groups.flatMap(group => [...group.columns[0], ...group.columns[1]]);
}

describe('RelateWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(RelateWorksheetAdapter.ideviceType).toBe('relate');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(RelateWorksheetAdapter.build(relateHtml(), { title: 'Relaciona' })?.title).toBe('Relaciona');
        expect(RelateWorksheetAdapter.build(relateHtml(), {})?.title).toBe('Relate');
    });

    it('carries over instructions and closing text', () => {
        const activity = RelateWorksheetAdapter.build(
            relateHtml({ instructions: '<p>Une cada pareja</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Une cada pareja</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('sets the whole exercise as two columns, with no questions to number', () => {
        const activity = RelateWorksheetAdapter.build(relateHtml(), {});

        expect(activity?.board?.kind).toBe('groupColumns');
        expect(activity?.items).toEqual([]);
    });

    it('puts one face in each column', () => {
        const [group] = groupsOf();

        expect(group.columns[0][0].text).toBe('El caballo');
        expect(group.columns[1][0].text).toBe('Horse');
    });

    describe('the text of a card', () => {
        it('decodes it the way the activity decodes it', () => {
            // URI-encoded, not escape()d: the family's usual unescape() mangles every accent.
            const [group] = groupsOf({ cards: [card({ eText: encodeURIComponent('La araña teje') })] });

            expect(group.columns[0][0].text).toBe('La araña teje');
        });

        it('restores every percent sign the editor encoded, not just the first', () => {
            // The runtime replaces only the first, having left the global flag off its regex; the
            // rest would print the entity itself in the middle of a sentence.
            const [group] = groupsOf({ cards: [card({ eText: '50&percnt; y 20&percnt;' })] });

            expect(group.columns[0][0].text).toBe('50% y 20%');
        });

        it("keeps the author's formatting", () => {
            const [group] = groupsOf({ cards: [card({ eText: encodeURIComponent('<b>Uno</b>') })] });

            expect(group.columns[0][0].text).toBe('<b>Uno</b>');
        });

        it('strips anything unsafe the author left in it', () => {
            const [group] = groupsOf({
                cards: [card({ eText: encodeURIComponent('Hola<script>alert(1)</script>') })],
            });

            expect(group.columns[0][0].text).toBe('Hola');
        });

        it('survives a stray percent sign instead of losing the worksheet', () => {
            // decodeURIComponent throws on this. On screen it breaks one card; here it would take
            // the whole sheet down.
            const [group] = groupsOf({ cards: [card({ eText: '100% seguro' })] });

            expect(group.columns[0][0].text).toBe('100% seguro');
        });
    });

    describe('pictures', () => {
        it('takes them from the sidecar links, which are what still resolve', () => {
            // The payload's own copy points at an asset:// the rewriting pass cannot see inside.
            const [group] = groupsOf({
                cards: [card({ url: 'asset://stale.png', urlBk: 'asset://stale-back.png' })],
                images: { 0: 'files/front.png' },
                imagesBack: { 0: 'files/back.png' },
            });

            expect(group.columns[0][0].media?.src).toBe('files/front.png');
            expect(group.columns[1][0].media?.src).toBe('files/back.png');
        });

        it("keys the two sides separately, so a front never takes the back's picture", () => {
            const [group] = groupsOf({ cards: [card()], images: { 0: 'files/front.png' } });

            expect(group.columns[0][0].media?.src).toBe('files/front.png');
            expect(group.columns[1][0].media).toBeUndefined();
        });

        it('carries the alt text and the credit of each side', () => {
            const [group] = groupsOf({
                cards: [card({ alt: 'Un caballo', author: 'Ana', altBk: 'A horse', authorBk: 'Ben' })],
                images: { 0: 'files/front.png' },
                imagesBack: { 0: 'files/back.png' },
            });

            expect(group.columns[0][0].media).toMatchObject({ alt: 'Un caballo', author: 'Ana' });
            expect(group.columns[1][0].media).toMatchObject({ alt: 'A horse', author: 'Ben' });
        });

        it('keeps both the picture and the text when a card has each', () => {
            const [group] = groupsOf({ cards: [card()], images: { 0: 'files/front.png' } });

            expect(group.columns[0][0].text).toBe('El caballo');
            expect(group.columns[0][0].media?.src).toBe('files/front.png');
        });

        it('takes a card with only a picture', () => {
            const [group] = groupsOf({
                cards: [card({ eText: '', eTextBk: '' })],
                images: { 0: 'files/front.png' },
                imagesBack: { 0: 'files/back.png' },
            });

            expect(group.columns[0][0].text).toBeUndefined();
            expect(group.columns[0][0].media?.src).toBe('files/front.png');
        });
    });

    describe('colours', () => {
        it('writes the text in the colour the author chose', () => {
            const [group] = groupsOf({ cards: [card({ color: '#0d5aa7', colorBk: '#a30000' })] });

            expect(group.columns[0][0].textColor).toBe('#0d5aa7');
            expect(group.columns[1][0].textColor).toBe('#a30000');
        });

        it('marks the card with the background colour instead of filling it', () => {
            const [group] = groupsOf({ cards: [card({ backcolor: '#ffd95c' })] });

            // The renderer draws it as an outline and a band; nothing here says "background".
            expect(group.columns[0][0].accentColor).toBe('#ffd95c');
        });

        it('leaves a card unmarked when the author kept the editor default', () => {
            // #ffffff is what the Relate editor starts every card at.
            const [group] = groupsOf({ cards: [card({ backcolor: '#ffffff', color: '#000000' })] });

            expect(group.columns[0][0].accentColor).toBeUndefined();
            expect(group.columns[0][0].textColor).toBeUndefined();
        });

        it('drops a font colour the reader would lose against the paper', () => {
            const [group] = groupsOf({ cards: [card({ color: '#ffffff' })] });

            expect(group.columns[0][0].textColor).toBeUndefined();
        });

        it('refuses a colour that is not one, rather than writing it into a style attribute', () => {
            const [group] = groupsOf({ cards: [card({ color: 'red; background: url(x)', backcolor: 'inherit' })] });

            expect(group.columns[0][0].textColor).toBeUndefined();
            expect(group.columns[0][0].accentColor).toBeUndefined();
        });
    });

    describe('what cannot be printed', () => {
        it('leaves out a pair whose side carries only a sound', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const groups = groupsOf(
                {
                    cards: [card(), card({ eTextBk: '', urlBk: '' }), card()],
                },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(allCards(groups)).toHaveLength(4);
            expect(omissions).toEqual(['media-required']);
        });

        it('skips the activity when no pair survives', () => {
            expect(RelateWorksheetAdapter.build(relateHtml({ cards: [card({ eText: '', url: '' })] }), {})).toBeNull();
        });

        it('skips a component whose payload cannot be read', () => {
            expect(RelateWorksheetAdapter.build('<div class="relaciona-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no cards in it', () => {
            expect(RelateWorksheetAdapter.build(relateHtml({ cards: [] }), {})).toBeNull();
        });
    });

    describe('the share and the shuffle', () => {
        it('sets only the share of cards the activity asks for', () => {
            const cards = [card(), card(), card(), card()];

            expect(allCards(groupsOf({ cards, percentajeCards: 50 }))).toHaveLength(4);
        });

        it('breaks the pairs into blocks a page can hold', () => {
            // Six pairs: five in the first block, one in the second. A pair whose halves land on
            // different sheets cannot be joined with a line.
            const groups = groupsOf({ cards: Array.from({ length: 6 }, () => card()) });

            expect(groups.map(group => group.columns[0].length)).toEqual([5, 1]);
            expect(groups.map(group => group.columns[1].length)).toEqual([5, 1]);
        });

        it('shuffles each column on its own, so a pair does not share a line', () => {
            const cards = Array.from({ length: 5 }, (_, i) =>
                card({ eText: encodeURIComponent(`F${i}`), eTextBk: encodeURIComponent(`B${i}`) }),
            );
            const [group] = groupsOf({ cards }, { random: sequence([0.9, 0.1, 0.5, 0.7, 0.3, 0.2]) });

            const left = group.columns[0].map(entry => entry.text?.slice(1));
            const right = group.columns[1].map(entry => entry.text?.slice(1));

            // Both columns hold the same five cards...
            expect([...left].sort()).toEqual([...right].sort());
            // ...but not in the same order, which is what the exercise rests on.
            expect(left).not.toEqual(right);
        });
    });
});
