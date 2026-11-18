import { describe, expect, it } from 'bun:test';
import { buildFacingColumns, decodeCardText, type TwoFacedDataGame } from './twoFacedCards';
import type { UnsupportedActivity } from './types';

/** One card, both faces carrying text unless the test says otherwise. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { eText: encodeURIComponent('El caballo'), eTextBk: encodeURIComponent('Horse'), ...overrides };
}

/** Sidecar links, the way both editors write them. */
function sidecars(images: Record<number, string> = {}, back: Record<number, string> = {}): string {
    return (
        Object.entries(images)
            .map(([index, href]) => `<a class="js-hidden demo-LinkImages" href="${href}">${index}</a>`)
            .join('') +
        Object.entries(back)
            .map(([index, href]) => `<a class="js-hidden demo-LinkImagesBack" href="${href}">${index}</a>`)
            .join('')
    );
}

function columnsOf(dataGame: TwoFacedDataGame, html = '', options = {}) {
    const groups = buildFacingColumns(html, 'demo', dataGame, options);
    expect(groups).not.toBeNull();
    return groups as NonNullable<typeof groups>;
}

describe('decodeCardText', () => {
    it('decodes what the editors encode', () => {
        // decodeURIComponent, not the family's unescape(): that one mangles every accent.
        expect(decodeCardText(encodeURIComponent('La araña teje'))).toBe('La araña teje');
    });

    it('restores every percent sign, not just the first', () => {
        // Both runtimes carry the same regex without its global flag, so the rest would print as
        // the entity itself in the middle of a sentence.
        expect(decodeCardText('50&percnt; y 20&percnt;')).toBe('50% y 20%');
    });

    it('survives a stray percent sign instead of throwing', () => {
        // decodeURIComponent throws on this. On screen it breaks one card; here it would take the
        // whole worksheet down.
        expect(decodeCardText('100% seguro')).toBe('100% seguro');
    });

    it('reads nothing out of nothing', () => {
        expect(decodeCardText(undefined)).toBe('');
        expect(decodeCardText('')).toBe('');
    });
});

describe('buildFacingColumns', () => {
    it('puts one face in each column', () => {
        const [group] = columnsOf({ cardsGame: [card()] });

        expect(group.columns[0][0].text).toBe('El caballo');
        expect(group.columns[1][0].text).toBe('Horse');
    });

    it("takes each face's picture from its own sidecar", () => {
        const [group] = columnsOf(
            { cardsGame: [card({ url: 'asset://stale.png' })] },
            sidecars({ 0: 'files/front.png' }, { 0: 'files/back.png' }),
        );

        expect(group.columns[0][0].media?.src).toBe('files/front.png');
        expect(group.columns[1][0].media?.src).toBe('files/back.png');
    });

    it("marks a card with its colour and writes its words in the author's", () => {
        const [group] = columnsOf({
            cardsGame: [card({ backcolor: '#ffd95c', color: '#0d5aa7', backcolorBk: '#a30000' })],
        });

        expect(group.columns[0][0].accentColor).toBe('#ffd95c');
        expect(group.columns[0][0].textColor).toBe('#0d5aa7');
        expect(group.columns[1][0].accentColor).toBe('#a30000');
    });

    it('leaves out a pair whose face carries only a sound', () => {
        const omissions: UnsupportedActivity['reason'][] = [];
        const groups = columnsOf({ cardsGame: [card(), card({ eTextBk: '', urlBk: '' }), card()] }, '', {
            onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason),
        });

        expect(groups[0].columns.flat()).toHaveLength(4);
        expect(omissions).toEqual(['media-required']);
    });

    it('reports nothing at all when no pair survives', () => {
        expect(buildFacingColumns('', 'demo', { cardsGame: [card({ eText: '', url: '' })] })).toBeNull();
        expect(buildFacingColumns('', 'demo', { cardsGame: [] })).toBeNull();
    });

    it('breaks the pairs into blocks a page can hold', () => {
        // A pair whose halves land on different sheets cannot be joined with a line.
        const groups = columnsOf({ cardsGame: Array.from({ length: 6 }, () => card()) });

        expect(groups.map(group => group.columns[0].length)).toEqual([5, 1]);
        expect(groups.map(group => group.columns[1].length)).toEqual([5, 1]);
    });

    it('shuffles each column on its own, so a pair does not share a line', () => {
        let seed = 7;
        const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        const cards = Array.from({ length: 5 }, (_, i) =>
            card({ eText: encodeURIComponent(`F${i}`), eTextBk: encodeURIComponent(`B${i}`) }),
        );
        const [group] = columnsOf({ cardsGame: cards }, '', { random });

        const left = group.columns[0].map(entry => entry.text?.slice(1));
        const right = group.columns[1].map(entry => entry.text?.slice(1));

        expect([...left].sort()).toEqual([...right].sort());
        expect(left).not.toEqual(right);
    });
});
