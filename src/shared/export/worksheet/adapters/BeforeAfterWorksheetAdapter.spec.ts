import { describe, expect, it } from 'bun:test';
import type { PrintableCardGroup, UnsupportedActivity } from '../types';
import { BeforeAfterWorksheetAdapter } from './BeforeAfterWorksheetAdapter';

interface BeforeAfterFixture {
    instructions?: string;
    textAfter?: string;
    textAfterDiv?: string;
    cards?: Record<string, unknown>[];
    images?: Record<number, string>;
    imagesBack?: Record<number, string>;
}

/** One comparison, both sides carrying a picture unless the test says otherwise. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        url: 'stored/before.png',
        urlBk: 'stored/after.png',
        eText: 'La plaza en 1950',
        eTextBk: 'La plaza hoy',
        alt: '',
        altBk: '',
        author: '',
        authorBk: '',
        ...overrides,
    };
}

/** Build component HTML the way the Before/After editor writes it: plain JSON, never obfuscated. */
function beforeAfterHtml(fixture: BeforeAfterFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'BeforeAfter',
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        cardsGame: fixture.cards ?? [card()],
    });

    let html = '<div class="beforeafter-IDevice">';
    html += `<div class="beforeafter-DataGame js-hidden">${payload}</div>`;
    for (const [index, href] of Object.entries(fixture.images ?? {})) {
        html += `<a class="js-hidden beforeafter-LinkImages" href="${href}">${index}</a>`;
    }
    for (const [index, href] of Object.entries(fixture.imagesBack ?? {})) {
        html += `<a class="js-hidden beforeafter-LinkImagesBack" href="${href}">${index}</a>`;
    }
    if (fixture.textAfterDiv) html += `<div class="beforeafter-extra-content">${fixture.textAfterDiv}</div>`;
    html += '</div>';

    return html;
}

function groupsOf(fixture: BeforeAfterFixture = {}, options = {}): PrintableCardGroup[] {
    const board = BeforeAfterWorksheetAdapter.build(beforeAfterHtml(fixture), options)?.board;

    expect(board?.kind).toBe('groupColumns');
    return (board as { groups: PrintableCardGroup[] }).groups;
}

describe('BeforeAfterWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(BeforeAfterWorksheetAdapter.ideviceType).toBe('beforeafter');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(BeforeAfterWorksheetAdapter.build(beforeAfterHtml(), { title: 'Antes/Después' })?.title).toBe(
            'Antes/Después',
        );
        expect(BeforeAfterWorksheetAdapter.build(beforeAfterHtml(), {})?.title).toBe('Before/After');
    });

    it('reads a payload that was never obfuscated', () => {
        // This iDevice's loader calls no decrypt at all; the JSON sits in the div as it is.
        expect(groupsOf()[0].columns[0]).toHaveLength(1);
    });

    it('sets the two pictures side by side, each with its caption under it', () => {
        const [group] = groupsOf({ images: { 0: 'files/old.png' }, imagesBack: { 0: 'files/new.png' } });

        expect(group.columns[0][0]).toMatchObject({ text: 'La plaza en 1950', media: { src: 'files/old.png' } });
        expect(group.columns[1][0]).toMatchObject({ text: 'La plaza hoy', media: { src: 'files/new.png' } });
    });

    it('heads the columns with the words the caller supplies', () => {
        // The activity has none of its own: its editor's labels never reach the runtime, which
        // draws no captions at all.
        const [group] = groupsOf({}, { labels: { before: 'Antes', after: 'Después' } });

        expect(group.headings).toEqual(['Antes', 'Después']);
    });

    it('falls back to English headings, so the CLI is usable without them', () => {
        expect(groupsOf()[0].headings).toEqual(['Before', 'After']);
    });

    it('says the rows line up, which is what stops them being shuffled', () => {
        expect(groupsOf()[0].aligned).toBe(true);
    });

    it('keeps each before facing its own after', () => {
        // Unlike a matching exercise, the row is the point: a before separated from its after
        // compares nothing.
        const three = ['A', 'B', 'C'].map(name => card({ eText: `${name} antes`, eTextBk: `${name} después` }));
        const [group] = groupsOf({ cards: three });

        expect(group.columns[0].map(entry => entry.text)).toEqual(['A antes', 'B antes', 'C antes']);
        expect(group.columns[1].map(entry => entry.text)).toEqual(['A después', 'B después', 'C después']);
    });

    it('takes the pictures from the sidecars, which are what still resolve', () => {
        const [group] = groupsOf({ images: { 0: 'files/old.png' }, imagesBack: { 0: 'files/new.png' } });

        expect(group.columns[0][0].media?.src).toBe('files/old.png');
        expect(group.columns[1][0].media?.src).toBe('files/new.png');
    });

    it('carries the alt text and the credit of each picture', () => {
        const [group] = groupsOf({
            cards: [card({ alt: 'Antigua', author: 'Ana', altBk: 'Actual', authorBk: 'Ben' })],
        });

        expect(group.columns[0][0].media).toMatchObject({ alt: 'Antigua', author: 'Ana' });
        expect(group.columns[1][0].media).toMatchObject({ alt: 'Actual', author: 'Ben' });
    });

    it('reads the caption as stored, which this iDevice does not encode', () => {
        // Relate URI-encodes the same-named field; this one assigns it to itself and decodes
        // nothing, so decoding here would mangle a caption containing a percent sign.
        const [group] = groupsOf({ cards: [card({ eText: '100% reformada' })] });

        expect(group.columns[0][0].text).toBe('100% reformada');
    });

    it('strips anything unsafe the author left in a caption', () => {
        const [group] = groupsOf({ cards: [card({ eText: 'Hola<script>alert(1)</script>' })] });

        expect(group.columns[0][0].text).toBe('Hola');
    });

    it('prints a comparison whose pictures carry no caption', () => {
        const [group] = groupsOf({ cards: [card({ eText: '', eTextBk: '' })] });

        expect(group.columns[0][0].text).toBeUndefined();
        expect(group.columns[0][0].media?.src).toBe('stored/before.png');
    });

    it('breaks the comparisons into blocks a page can hold', () => {
        // A wide card runs to about 70mm with its picture and caption.
        const groups = groupsOf({ cards: Array.from({ length: 4 }, () => card()) });

        expect(groups.map(group => group.columns[0].length)).toEqual([3, 1]);
        expect(groups.every(group => group.headings?.length === 2)).toBe(true);
    });

    describe('what cannot be printed', () => {
        it('leaves out a comparison missing one of its halves', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const groups = groupsOf(
                { cards: [card(), card({ urlBk: '', eTextBk: '' }), card()] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(groups[0].columns[0]).toHaveLength(2);
            expect(omissions).toEqual(['media-required']);
        });

        it('skips the activity when no comparison survives', () => {
            expect(
                BeforeAfterWorksheetAdapter.build(beforeAfterHtml({ cards: [card({ url: '', eText: '' })] }), {}),
            ).toBeNull();
        });

        it('skips a component whose payload cannot be read', () => {
            expect(BeforeAfterWorksheetAdapter.build('<div class="beforeafter-IDevice"></div>', {})).toBeNull();
        });
    });

    describe('instructions and closing text', () => {
        it('carries the instructions over', () => {
            const activity = BeforeAfterWorksheetAdapter.build(
                beforeAfterHtml({ instructions: '<p>Compara las dos fotos</p>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Compara las dos fotos</p>');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = BeforeAfterWorksheetAdapter.build(
                beforeAfterHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });

        it('unescapes the payload copy when there is no div', () => {
            const activity = BeforeAfterWorksheetAdapter.build(
                beforeAfterHtml({ textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del payload</p>');
        });
    });
});
