import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableCardGroup } from '../types';
import { FlipcardsWorksheetAdapter } from './FlipcardsWorksheetAdapter';

interface FlipcardsFixture {
    instructions?: string;
    textAfter?: string;
    cards?: Record<string, unknown>[];
    /** 0 show, 1 navigate, 2 identify, 3 memory. */
    type?: number;
    percentajeCards?: number;
    images?: Record<number, string>;
    imagesBack?: Record<number, string>;
}

/** One card, both faces carrying text unless the test says otherwise. */
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

/** Build component HTML the way the Flip cards editor writes it. */
function flipcardsHtml(fixture: FlipcardsFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'FlipCards',
        type: fixture.type ?? 0,
        percentajeCards: fixture.percentajeCards,
        cardsGame: fixture.cards ?? [card()],
    });

    let html = '<div class="flipcards-IDevice">';
    html += `<div class="flipcards-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    // Unlike Relate, the instructions are a div beside the payload rather than a field inside it.
    if (fixture.instructions) html += `<div class="flipcards-instructions js-hidden">${fixture.instructions}</div>`;
    for (const [index, href] of Object.entries(fixture.images ?? {})) {
        html += `<a class="js-hidden flipcards-LinkImages" href="${href}">${index}</a>`;
    }
    for (const [index, href] of Object.entries(fixture.imagesBack ?? {})) {
        html += `<a class="js-hidden flipcards-LinkImagesBack" href="${href}">${index}</a>`;
    }
    if (fixture.textAfter) html += `<div class="flipcards-extra-content">${fixture.textAfter}</div>`;
    html += '</div>';

    return html;
}

function groupsOf(fixture: FlipcardsFixture = {}, options = {}): PrintableCardGroup[] {
    const board = FlipcardsWorksheetAdapter.build(flipcardsHtml(fixture), options)?.board;

    expect(board?.kind).toBe('groupColumns');
    return (board as { groups: PrintableCardGroup[] }).groups;
}

describe('FlipcardsWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(FlipcardsWorksheetAdapter.ideviceType).toBe('flipcards');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(FlipcardsWorksheetAdapter.build(flipcardsHtml(), { title: 'Tarjetas' })?.title).toBe('Tarjetas');
        expect(FlipcardsWorksheetAdapter.build(flipcardsHtml(), {})?.title).toBe('Flip cards');
    });

    it('reads its instructions from the div beside the payload', () => {
        // Relate keeps the same thing inside the payload; this one does not.
        const activity = FlipcardsWorksheetAdapter.build(
            flipcardsHtml({ instructions: '<p>Une cada tarjeta</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Une cada tarjeta</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('sets the whole exercise as two columns, with no questions to number', () => {
        const activity = FlipcardsWorksheetAdapter.build(flipcardsHtml(), {});

        expect(activity?.board?.kind).toBe('groupColumns');
        expect(activity?.items).toEqual([]);
    });

    it('puts the fronts in one column and the backs in the other', () => {
        const [group] = groupsOf();

        expect(group.columns[0][0].text).toBe('El caballo');
        expect(group.columns[1][0].text).toBe('Horse');
    });

    it('prints the same exercise whichever game the activity was set to', () => {
        // Show, navigate, identify and memory all rest on which front goes with which back, and a
        // sheet can offer none of them.
        for (const type of [0, 1, 2, 3]) {
            const [group] = groupsOf({ type });

            expect(group.columns.map(column => column[0].text)).toEqual(['El caballo', 'Horse']);
        }
    });

    it("takes each face's picture from its own sidecar", () => {
        const [group] = groupsOf({
            cards: [card({ url: 'asset://stale.png' })],
            images: { 0: 'files/front.png' },
            imagesBack: { 0: 'files/back.png' },
        });

        expect(group.columns[0][0].media?.src).toBe('files/front.png');
        expect(group.columns[1][0].media?.src).toBe('files/back.png');
    });

    it('marks a card with the colour the author gave it', () => {
        const [group] = groupsOf({ cards: [card({ backcolor: '#ffd95c', color: '#0d5aa7' })] });

        expect(group.columns[0][0].accentColor).toBe('#ffd95c');
        expect(group.columns[0][0].textColor).toBe('#0d5aa7');
    });

    it('decodes the text the way the activity decodes it', () => {
        const [group] = groupsOf({ cards: [card({ eText: encodeURIComponent('La araña teje') })] });

        expect(group.columns[0][0].text).toBe('La araña teje');
    });

    it('strips anything unsafe the author left in it', () => {
        const [group] = groupsOf({ cards: [card({ eText: encodeURIComponent('Hola<script>alert(1)</script>') })] });

        expect(group.columns[0][0].text).toBe('Hola');
    });

    it('skips a component whose payload cannot be read', () => {
        expect(FlipcardsWorksheetAdapter.build('<div class="flipcards-IDevice"></div>', {})).toBeNull();
    });

    it('skips a payload with no cards in it', () => {
        expect(FlipcardsWorksheetAdapter.build(flipcardsHtml({ cards: [] }), {})).toBeNull();
    });
});
