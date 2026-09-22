import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableCard, PrintableItem, UnsupportedActivity } from '../types';
import { SelectMediaFilesWorksheetAdapter } from './SelectMediaFilesWorksheetAdapter';

interface MediaFixture {
    instructionsExe?: string;
    instructions?: string;
    instructionsDiv?: string;
    textAfter?: string;
    textAfterDiv?: string;
    questions?: Record<string, unknown>[];
    percentajeQuestions?: number;
    numberMaxCards?: unknown;
    /** Sidecar links for each question's cards, by question index. */
    cardImages?: Record<number, Record<number, string>>;
    /** Sidecar links for the questions' own pictures. */
    questionImages?: Record<number, string>;
}

/** One card, as the editor stores it. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        eText: 'Pato',
        url: 'files/tmp/stale.jpg',
        audio: '',
        alt: '',
        color: '#000000',
        backcolor: '#ffffff',
        state: false,
        ...overrides,
    };
}

/** One question and the cards it offers. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        definition: '¿Cuáles son carnívoros?',
        url: '',
        alt: '',
        author: '',
        cards: [card(), card({ eText: 'Perro', state: true })],
        ...overrides,
    };
}

function mediaHtml(fixture: MediaFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'seleccionamedias',
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        percentajeQuestions: fixture.percentajeQuestions,
        numberMaxCards: fixture.numberMaxCards ?? '30',
        phrasesGame: fixture.questions ?? [question()],
    });

    let html = '<div class="seleccionamedias-IDevice">';
    if (fixture.instructionsDiv) html += `<div class="seleccionamedias-instructions">${fixture.instructionsDiv}</div>`;
    html += `<div class="seleccionamedias-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(fixture.questionImages ?? {}))
        html += `<a href="${href}" class="js-hidden seleccionamedias-LinkImagesDef">${index}</a>`;

    for (const [questionIndex, cards] of Object.entries(fixture.cardImages ?? { 0: { 0: 'pato.png', 1: 'perro.png' } }))
        for (const [cardIndex, href] of Object.entries(cards))
            html += `<a href="${href}" class="js-hidden seleccionamedias-LinkImages-${questionIndex}">${cardIndex}</a>`;

    if (fixture.textAfterDiv) html += `<div class="seleccionamedias-extra-content">${fixture.textAfterDiv}</div>`;

    return `${html}</div>`;
}

function itemsOf(fixture: MediaFixture = {}, options = {}): PrintableItem[] {
    return SelectMediaFilesWorksheetAdapter.build(mediaHtml(fixture), { random: () => 0.5, ...options })?.items ?? [];
}

/** The cards a question offers, as the sheet lays them out. */
function cardsOf(item: PrintableItem): PrintableCard[] {
    if (item.answer?.kind !== 'mediaOptions') throw new Error('Expected pictures to choose between');

    return item.answer.cards;
}

describe('SelectMediaFilesWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(SelectMediaFilesWorksheetAdapter.ideviceType).toBe('select-media-files');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(SelectMediaFilesWorksheetAdapter.build(mediaHtml(), { title: 'Selecciona' })?.title).toBe('Selecciona');
        expect(SelectMediaFilesWorksheetAdapter.build(mediaHtml(), {})?.title).toBe('Select multimedia');
    });

    it('sets the question, then the cards to tick', () => {
        const [item] = itemsOf();

        expect(item.prompt).toBe('¿Cuáles son carnívoros?');
        expect(item.answer?.kind).toBe('mediaOptions');
        expect(cardsOf(item)).toHaveLength(2);
    });

    it('puts the card own words beside its picture', () => {
        const [first] = cardsOf(itemsOf()[0]);

        expect(first.text).toBe('Pato');
        expect(first.media).toEqual({ kind: 'image', src: 'pato.png', alt: undefined });
    });

    describe('where a picture comes from', () => {
        it('the sidecar, the payload copy having gone stale', () => {
            const printed = JSON.stringify(itemsOf());

            expect(printed).toContain('pato.png');
            expect(printed).not.toContain('files/tmp/stale.jpg');
        });

        it('keyed twice over: the class says the question, the link text the card', () => {
            const items = itemsOf({
                questions: [question(), question({ definition: 'Segunda' })],
                cardImages: { 0: { 0: 'uno.png' }, 1: { 1: 'dos.png' } },
            });

            expect(cardsOf(items[0])[0].media?.src).toBe('uno.png');
            expect(cardsOf(items[0])[1].media).toBeUndefined();
            expect(cardsOf(items[1])[0].media).toBeUndefined();
            expect(cardsOf(items[1])[1].media?.src).toBe('dos.png');
        });

        it('the question own picture, keyed by question', () => {
            const [item] = itemsOf({ questionImages: { 0: 'enunciado.png' } });

            expect(item.media?.src).toBe('enunciado.png');
        });
    });

    describe('what cannot be offered on paper', () => {
        it('leaves out a card that is only a sound', () => {
            // A box beside an empty space gives the student no way to tell it from the next one.
            const cards = cardsOf(
                itemsOf({
                    questions: [question({ cards: [card(), card({ eText: '', url: '', audio: 'sonido.mp3' })] })],
                    // The sidecar is what says a card has a picture, so the sound-only one has none.
                    cardImages: { 0: { 0: 'pato.png' } },
                })[0],
            );

            expect(cards).toHaveLength(1);
            expect(cards[0].text).toBe('Pato');
        });

        it('keeps a card that is only words, and one that is only a picture', () => {
            const cards = cardsOf(
                itemsOf({
                    questions: [question({ cards: [card({ url: '' }), card({ eText: '' })] })],
                    cardImages: { 0: { 1: 'perro.png' } },
                })[0],
            );

            expect(cards[0]).toEqual({ text: 'Pato' });
            expect(cards[1]).toEqual({ media: { kind: 'image', src: 'perro.png', alt: undefined } });
        });

        it('leaves out a question whose cards all fall away', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                {
                    questions: [question(), question({ cards: [card({ eText: '', url: '', audio: 'a.mp3' })] })],
                    cardImages: { 0: { 0: 'pato.png', 1: 'perro.png' } },
                },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['media-required']);
        });
    });

    it('never prints which cards are the right ones', () => {
        expect(JSON.stringify(itemsOf())).not.toContain('state');
    });

    describe('the author colours', () => {
        it('are read for paper, as the cards of the other activities are', () => {
            const [first] = cardsOf(itemsOf({ questions: [question({ cards: [card({ backcolor: '#a40000' })] })] })[0]);

            expect(first.accentColor).toBe('#a40000');
        });

        it('drop a font colour the paper would swallow', () => {
            const [first] = cardsOf(itemsOf({ questions: [question({ cards: [card({ color: '#fefefe' })] })] })[0]);

            expect(first.textColor).toBeUndefined();
        });
    });

    describe('how many cards a question offers', () => {
        const eight = Array.from({ length: 8 }, (_, i) => card({ eText: `C${i}`, url: '' }));

        it('all of them, the cap being the editor maximum', () => {
            expect(cardsOf(itemsOf({ questions: [question({ cards: eight })], numberMaxCards: '30' })[0])).toHaveLength(
                8,
            );
        });

        it('only as many as the activity caps them at', () => {
            expect(cardsOf(itemsOf({ questions: [question({ cards: eight })], numberMaxCards: '4' })[0])).toHaveLength(
                4,
            );
        });

        it('in stored order, a cap not being a reshuffle', () => {
            const cards = cardsOf(itemsOf({ questions: [question({ cards: eight })], numberMaxCards: '4' })[0]);
            const order = cards.map(entry => entry.text);

            expect([...order].sort()).toEqual(order);
        });

        it('all of them when the activity never had the setting', () => {
            expect(
                cardsOf(itemsOf({ questions: [question({ cards: eight })], numberMaxCards: undefined })[0]),
            ).toHaveLength(8);
        });
    });

    it('strips anything unsafe the author left in the words', () => {
        const [item] = itemsOf({
            questions: [question({ definition: 'Hola<script>alert(1)</script>', cards: [card({ eText: 'A<b>B' })] })],
        });

        expect(item.prompt).toBe('Hola');
        expect(cardsOf(item)[0].text).toBe('A<b>B</b>');
    });

    describe('instructions and closing text', () => {
        it('reads the instructions from the div before the payload', () => {
            const activity = SelectMediaFilesWorksheetAdapter.build(
                mediaHtml({ instructionsDiv: '<p>Del div</p>', instructionsExe: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Del div</p>');
        });

        it('unescapes the rich instructions the payload keeps', () => {
            const activity = SelectMediaFilesWorksheetAdapter.build(
                mediaHtml({ instructionsExe: escape('<p>Elige las correctas</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Elige las correctas</p>');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = SelectMediaFilesWorksheetAdapter.build(
                mediaHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(SelectMediaFilesWorksheetAdapter.build('<div class="seleccionamedias-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no questions in it', () => {
            expect(SelectMediaFilesWorksheetAdapter.build(mediaHtml({ questions: [] }), {})).toBeNull();
        });
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => question({ definition: `Q${i}` }));

        expect(itemsOf({ questions: four, percentajeQuestions: 50 })).toHaveLength(2);
    });
});
