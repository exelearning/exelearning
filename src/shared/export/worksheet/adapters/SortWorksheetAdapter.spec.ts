import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { SortWorksheetAdapter } from './SortWorksheetAdapter';
import type { PrintableActivity, PrintableCard } from '../types';

interface SortFixtureOptions {
    instructions?: string;
    type?: number;
    phrasesGame?: Record<string, unknown>[];
    percentajeQuestions?: number;
    gameColumns?: number;
    orderedColumns?: boolean;
    /** Sidecar links, keyed by round and then by card. */
    imageLinks?: Record<number, Record<number, string>>;
    textAfter?: string;
}

/** One card of a round. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { type: 1, eText: 'Uno', order: 0, ...overrides };
}

/** Build component HTML the way the Sort editor writes it. */
function sortHtml(options: SortFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Ordena',
        instructions: options.instructions ?? '',
        type: options.type,
        percentajeQuestions: options.percentajeQuestions,
        gameColumns: options.gameColumns,
        orderedColumns: options.orderedColumns,
        phrasesGame: options.phrasesGame ?? [{ cards: [card()] }],
    });

    let html = '<div class="ordena-IDevice">';
    html += `<div class="ordena-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [round, cards] of Object.entries(options.imageLinks ?? {})) {
        for (const [position, href] of Object.entries(cards)) {
            html += `<a href="${href}" class="js-hidden ordena-LinkImages-${round}">${position}</a>`;
        }
    }
    if (options.textAfter) {
        html += `<div class="ordena-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

/** The cards of a round, in the order they are printed. */
function cardsOf(activity: PrintableActivity | null, round = 0): PrintableCard[] {
    const answer = activity?.items[round]?.answer;
    return answer?.kind === 'orderCards' ? answer.cards : [];
}

describe('SortWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(SortWorksheetAdapter.ideviceType).toBe('sort');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(SortWorksheetAdapter.build(sortHtml(), { title: 'Ordena' })?.title).toBe('Ordena');
        expect(SortWorksheetAdapter.build(sortHtml(), {})?.title).toBe('Sort');
    });

    it('carries over instructions and closing text', () => {
        const activity = SortWorksheetAdapter.build(
            sortHtml({ instructions: '<p>Ordena</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Ordena</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('makes one question of each round', () => {
        const activity = SortWorksheetAdapter.build(
            sortHtml({
                type: 0,
                phrasesGame: [{ phrase: 'uno dos' }, { phrase: 'tres cuatro' }, { phrase: 'cinco seis' }],
            }),
            {},
        );

        expect(activity?.items).toHaveLength(3);
    });

    describe('the sentence mode', () => {
        const sentence = (phrase: string, random?: () => number) =>
            SortWorksheetAdapter.build(sortHtml({ type: 0, phrasesGame: [{ phrase }] }), { random });

        it('prints the words out of order, separated by bars', () => {
            const activity = sentence('El Cid gana la batalla', () => 0);
            const prompt = activity?.items[0].prompt ?? '';

            expect(prompt).toContain(' / ');
            expect(prompt.split(' / ').sort()).toEqual(['Cid', 'El', 'batalla', 'gana', 'la']);
        });

        it('does not print them in the order they read', () => {
            expect(sentence('uno dos tres cuatro', () => 0)?.items[0].prompt).not.toBe('uno / dos / tres / cuatro');
        });

        it('leaves blank space to write the sentence out in', () => {
            expect(sentence('uno dos')?.items[0].answer).toEqual({ kind: 'writingSpace', lines: 1 });
        });

        it('treats runs of whitespace as one break', () => {
            const prompt = sentence('  uno   dos  ')?.items[0].prompt ?? '';

            expect(prompt.split(' / ').sort()).toEqual(['dos', 'uno']);
        });

        it('skips a round with no sentence in it', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ type: 0, phrasesGame: [{ phrase: '   ' }, { phrase: 'uno dos' }] }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
        });
    });

    describe('the multimedia mode', () => {
        it('is what an activity storing no mode gets, as the runtime decides it', () => {
            const activity = SortWorksheetAdapter.build(sortHtml(), {});

            expect(activity?.items[0].answer?.kind).toBe('orderCards');
        });

        it('prints the cards with somewhere to write each position', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ phrasesGame: [{ cards: [card({ eText: 'Uno' }), card({ eText: 'Dos', order: 1 })] }] }),
                {},
            );

            expect(cardsOf(activity)).toHaveLength(2);
            expect(
                cardsOf(activity)
                    .map(entry => entry.text)
                    .sort(),
            ).toEqual(['Dos', 'Uno']);
        });

        it('never carries where a card belongs into what is printed', () => {
            // Matched on the cards, not on the answer: its own kind is spelled 'orderCards'.
            const activity = SortWorksheetAdapter.build(
                sortHtml({ phrasesGame: [{ cards: [card({ order: 3 })] }] }),
                {},
            );

            expect(cardsOf(activity)).toEqual([{ text: 'Uno' }]);
            expect(JSON.stringify(cardsOf(activity))).not.toContain('order');
        });

        it('shuffles them, or the printed order would be the answer', () => {
            const four = ['uno', 'dos', 'tres', 'cuatro'].map((eText, order) => card({ eText, order }));
            const activity = SortWorksheetAdapter.build(sortHtml({ phrasesGame: [{ cards: four }] }), {
                random: () => 0,
            });

            const texts = cardsOf(activity).map(entry => entry.text);
            expect([...texts].sort()).toEqual(['cuatro', 'dos', 'tres', 'uno']);
            expect(texts).not.toEqual(['uno', 'dos', 'tres', 'cuatro']);
        });

        it('takes a picture from the link of its own round, not another', () => {
            // The class carries the round and the link text the card, unlike every sibling.
            const activity = SortWorksheetAdapter.build(
                sortHtml({
                    phrasesGame: [
                        { cards: [card({ type: 0, url: 'asset://stale' })] },
                        { cards: [card({ type: 0, url: 'asset://stale' })] },
                    ],
                    imageLinks: { 0: { 0: 'blob:round-one' }, 1: { 0: 'blob:round-two' } },
                    percentajeQuestions: 100,
                }),
                {},
            );

            const srcs = [cardsOf(activity, 0)[0]?.media?.src, cardsOf(activity, 1)[0]?.media?.src].sort();
            expect(srcs).toEqual(['blob:round-one', 'blob:round-two']);
        });

        it('reads both halves of a card carrying text and a picture', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({
                    phrasesGame: [{ cards: [card({ type: 2, eText: 'Perro' })] }],
                    imageLinks: { 0: { 0: 'blob:dog' } },
                }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('Perro');
            expect(cardsOf(activity)[0].media?.src).toBe('blob:dog');
        });

        it('reports a card it cannot print instead of dropping it quietly', () => {
            const omissions: string[] = [];
            const activity = SortWorksheetAdapter.build(
                sortHtml({
                    phrasesGame: [{ cards: [card(), card({ type: 0, url: '', audio: 'asset://sound' })] }],
                }),
                { onOmission: reason => omissions.push(reason) },
            );

            expect(cardsOf(activity)).toHaveLength(1);
            expect(omissions).toEqual(['media-required']);
        });

        it('prints a card text as the author typed it', () => {
            // Stored as typed here, like Classify: unescaping would rewrite a literal '%41'.
            const activity = SortWorksheetAdapter.build(
                sortHtml({ phrasesGame: [{ cards: [card({ eText: 'Literal %41' })] }] }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('Literal %41');
        });
    });

    describe('the share of rounds', () => {
        const four = () => Array.from({ length: 4 }, (_, index) => ({ phrase: `frase ${index} dos` }));

        it('asks only the share the activity uses', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ type: 0, phrasesGame: four(), percentajeQuestions: 50 }),
                {},
            );

            expect(activity?.items).toHaveLength(2);
        });

        it('asks every round when the activity sets no share', () => {
            expect(SortWorksheetAdapter.build(sortHtml({ type: 0, phrasesGame: four() }), {})?.items).toHaveLength(4);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(SortWorksheetAdapter.build(sortHtml({ phrasesGame: [] }), {})).toBeNull();
            expect(SortWorksheetAdapter.build('<div class="ordena-IDevice"></div>', {})).toBeNull();
            expect(SortWorksheetAdapter.build('<div class="ordena-DataGame">no</div>', {})).toBeNull();
            expect(SortWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when phrasesGame is not an array', () => {
            const html = `<div class="ordena-DataGame js-hidden">${encryptDataGame('{"phrasesGame":"no"}')}</div>`;

            expect(SortWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('returns null when no round can be printed', () => {
            expect(SortWorksheetAdapter.build(sortHtml({ phrasesGame: [{ cards: [] }] }), {})).toBeNull();
        });

        it('survives a round with no cards at all', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ phrasesGame: [{}, { cards: [card()] }], percentajeQuestions: 100 }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a card', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ phrasesGame: [{ cards: [card({ eText: '<p>Hi</p><script>alert(1)</script>' })] }] }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('<p>Hi</p>');
        });

        it('strips a script smuggled into a sentence', () => {
            const activity = SortWorksheetAdapter.build(
                sortHtml({ type: 0, phrasesGame: [{ phrase: 'uno <script>alert(1)</script> dos' }] }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('<script>');
        });
    });
});

describe('SortWorksheetAdapter with fixed headings', () => {
    /** Six cards, each naming its stored position. */
    const six = () => Array.from({ length: 6 }, (_, order) => card({ eText: `c${order}`, order }));

    const headed = (overrides: SortFixtureOptions = {}) =>
        SortWorksheetAdapter.build(
            sortHtml({ gameColumns: 3, orderedColumns: true, phrasesGame: [{ cards: six() }], ...overrides }),
            { random: () => 0 },
        );

    /** The answer of the first round, whatever shape it took. */
    const answerOf = (activity: PrintableActivity | null) => activity?.items[0]?.answer;

    it('keeps the first card of each column where it belongs', () => {
        // The activity fixes its first row and shuffles only what is below it.
        expect(
            cardsOf(headed())
                .slice(0, 3)
                .map(entry => entry.text),
        ).toEqual(['c0', 'c1', 'c2']);
    });

    it('says how many of them are given rather than asked', () => {
        const answer = answerOf(headed());

        expect(answer?.kind === 'orderCards' && answer.headers).toBe(3);
    });

    it('still shuffles the cards below them', () => {
        const below = cardsOf(headed())
            .slice(3)
            .map(entry => entry.text);

        expect([...below].sort()).toEqual(['c3', 'c4', 'c5']);
        expect(below).not.toEqual(['c3', 'c4', 'c5']);
    });

    it('lays the cards out in the activity’s own columns', () => {
        const answer = answerOf(headed());

        expect(answer?.kind === 'orderCards' && answer.columns).toBe(3);
    });

    it('fixes nothing when the activity does not ask for headings', () => {
        const answer = answerOf(headed({ orderedColumns: false }));

        expect(answer?.kind === 'orderCards' && answer.headers).toBeUndefined();
        expect(cardsOf(headed({ orderedColumns: false })).map(entry => entry.text)).not.toEqual([
            'c0',
            'c1',
            'c2',
            'c3',
            'c4',
            'c5',
        ]);
    });

    it('fixes nothing with fewer than two columns, as the activity does', () => {
        // Headings need columns to head: the runtime turns the setting off below two.
        const answer = answerOf(headed({ gameColumns: 1 }));

        expect(answer?.kind === 'orderCards' && answer.headers).toBeUndefined();
        expect(answer?.kind === 'orderCards' && answer.columns).toBeUndefined();
    });

    it('never fixes more cards than the round holds', () => {
        const answer = answerOf(headed({ gameColumns: 9, phrasesGame: [{ cards: six().slice(0, 2) }] }));

        expect(answer?.kind === 'orderCards' && answer.headers).toBe(2);
    });
});
