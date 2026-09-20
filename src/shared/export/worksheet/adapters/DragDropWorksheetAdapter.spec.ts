import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { DragDropWorksheetAdapter } from './DragDropWorksheetAdapter';
import type { PrintableActivity, PrintableCard } from '../types';

interface DragDropFixtureOptions {
    instructions?: string;
    cardsGame?: Record<string, unknown>[];
    typeDrag?: number;
    percentajeCards?: number;
    randomCards?: boolean;
    imageLinks?: Record<number, string>;
    audioLinks?: Record<number, string>;
    textAfter?: string;
}

/** One card, carrying both halves of a pair. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { definition: 'Perro', url: 'asset://dog', alt: 'Un perro', ...overrides };
}

/** Build component HTML the way the Drag and drop editor writes it. */
function dragdropHtml(options: DragDropFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'DragDrop',
        instructions: options.instructions ?? '',
        typeDrag: options.typeDrag,
        percentajeCards: options.percentajeCards,
        randomCards: options.randomCards,
        cardsGame: options.cardsGame ?? [card()],
    });

    let html = '<div class="dragdrop-IDevice">';
    html += `<div class="dragdrop-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden dragdrop-LinkImages">${index}</a>`;
    }
    for (const [index, href] of Object.entries(options.audioLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden dragdrop-LinkAudios">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="dragdrop-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

function columns(activity: PrintableActivity | null): { left: PrintableCard[]; right: PrintableCard[] } {
    const board = activity?.board;
    return board?.kind === 'pairColumns' ? board : { left: [], right: [] };
}

/** Four cards whose texts are easy to tell apart. */
function fourCards(): Record<string, unknown>[] {
    return ['uno', 'dos', 'tres', 'cuatro'].map((text, index) =>
        card({ definition: text, url: `asset://image-${index}` }),
    );
}

describe('DragDropWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(DragDropWorksheetAdapter.ideviceType).toBe('dragdrop');
    });

    it('lays the two halves of each pair out facing each other', () => {
        const activity = DragDropWorksheetAdapter.build(dragdropHtml(), {});

        expect(activity?.board?.kind).toBe('pairColumns');
        expect(columns(activity).left).toHaveLength(1);
        expect(columns(activity).right).toHaveLength(1);
    });

    it('prints no questions, since the exercise is the two columns', () => {
        expect(DragDropWorksheetAdapter.build(dragdropHtml(), {})?.items).toEqual([]);
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(DragDropWorksheetAdapter.build(dragdropHtml(), { title: 'Arrastrar' })?.title).toBe('Arrastrar');
        expect(DragDropWorksheetAdapter.build(dragdropHtml(), {})?.title).toBe('Drag and drop');
    });

    it('carries over instructions and closing text', () => {
        const activity = DragDropWorksheetAdapter.build(
            dragdropHtml({ instructions: '<p>Une cada pareja</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Une cada pareja</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('which column holds the text', () => {
        it('puts it on the left when the activity says so', () => {
            const activity = DragDropWorksheetAdapter.build(dragdropHtml({ typeDrag: 0 }), {});

            expect(columns(activity).left[0].text).toBe('Perro');
            expect(columns(activity).right[0].media?.src).toBe('asset://dog');
        });

        it('puts it on the right when the activity says so', () => {
            const activity = DragDropWorksheetAdapter.build(dragdropHtml({ typeDrag: 1 }), {});

            expect(columns(activity).right[0].text).toBe('Perro');
            expect(columns(activity).left[0].media?.src).toBe('asset://dog');
        });

        it('defaults to the left when the activity stores no setting', () => {
            // The runtime treats a missing typeDrag as 0, and so does this.
            const activity = DragDropWorksheetAdapter.build(dragdropHtml(), {});

            expect(columns(activity).left[0].text).toBe('Perro');
        });
    });

    describe('cards', () => {
        it('takes the picture from the sidecar link, not from the payload', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ imageLinks: { 0: 'blob:http://localhost/dog' } }),
                {},
            );

            expect(columns(activity).right[0].media?.src).toBe('blob:http://localhost/dog');
            expect(columns(activity).right[0].media?.alt).toBe('Un perro');
        });

        it('keeps each picture matched to its own card', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({
                    cardsGame: [card({ definition: 'Gato' }), card({ definition: 'Perro' })],
                    imageLinks: { 1: 'blob:http://localhost/second' },
                }),
                { random: () => 0 },
            );

            expect(columns(activity).right.map(entry => entry.media?.src)).toContain('blob:http://localhost/second');
        });

        it('does not leave every pair sharing a line', () => {
            // The point of the exercise. A stateful source is used deliberately: a constant one
            // would hand both columns the same permutation, and the pairs would line up again
            // while the test still passed.
            let seed = 0;
            const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

            const activity = DragDropWorksheetAdapter.build(dragdropHtml({ cardsGame: fourCards(), imageLinks: {} }), {
                random,
            });
            const { left, right } = columns(activity);

            // Each card's text and picture carry the same position, so a line pairs them only when
            // the two columns agree at that index.
            const order = ['uno', 'dos', 'tres', 'cuatro'];
            const pairedOnTheSameLine = left.filter(
                (entry, index) => right[index].media?.src === `asset://image-${order.indexOf(entry.text ?? '')}`,
            );

            expect(pairedOnTheSameLine.length).toBeLessThan(left.length);
        });

        it('shuffles each column on its own, so no line pairs anything', () => {
            const activity = DragDropWorksheetAdapter.build(dragdropHtml({ cardsGame: fourCards() }), {
                random: () => 0,
            });
            const { left, right } = columns(activity);

            // Both sides still hold every card...
            expect([...left.map(entry => entry.text)].sort()).toEqual(['cuatro', 'dos', 'tres', 'uno']);
            expect(right).toHaveLength(4);
            // ...but neither keeps the stored order, so a row pairs nothing.
            expect(left.map(entry => entry.text)).not.toEqual(['uno', 'dos', 'tres', 'cuatro']);
            expect(right.map(entry => entry.media?.src)).not.toEqual([
                'asset://image-0',
                'asset://image-1',
                'asset://image-2',
                'asset://image-3',
            ]);
        });

        it('prints only the share of cards the activity uses', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ cardsGame: fourCards(), percentajeCards: 50 }),
                {},
            );

            expect(columns(activity).left).toHaveLength(2);
            expect(columns(activity).right).toHaveLength(2);
        });

        it('prints every card when the activity sets no share', () => {
            expect(
                columns(DragDropWorksheetAdapter.build(dragdropHtml({ cardsGame: fourCards() }), {})).left,
            ).toHaveLength(4);
        });

        it('keeps the two columns the same length whatever the share', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ cardsGame: fourCards(), percentajeCards: 75, randomCards: true }),
                { random: () => 0.5 },
            );
            const { left, right } = columns(activity);

            expect(left.length).toBe(right.length);
            expect(left.length).toBeGreaterThan(0);
        });
    });

    describe('cards that cannot be paired on paper', () => {
        it('leaves out a card with no picture, and reports it', () => {
            const omissions: string[] = [];
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ cardsGame: [card(), card({ definition: 'Sin imagen', url: '' })] }),
                { onOmission: reason => omissions.push(reason) },
            );

            expect(columns(activity).left).toHaveLength(1);
            expect(columns(activity).left[0].text).toBe('Perro');
            expect(omissions).toEqual(['media-required']);
        });

        it('leaves out a card carrying only audio, which has no paper equivalent', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({
                    cardsGame: [card(), card({ definition: 'Solo audio', url: '' })],
                    audioLinks: { 1: 'blob:http://localhost/sound' },
                }),
                {},
            );

            expect(columns(activity).left).toHaveLength(1);
        });

        it('leaves out a card with no text', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ cardsGame: [card(), card({ definition: '' })] }),
                {},
            );

            expect(columns(activity).left).toHaveLength(1);
        });

        it('drops them before the share, so an unusable card costs the teacher nothing', () => {
            // Four cards, half of them unusable, asking for every card: the two that can be
            // printed are printed. Applying the share first would have left one.
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({
                    cardsGame: [
                        card({ definition: 'a' }),
                        card({ definition: '' }),
                        card({ definition: 'b' }),
                        card({ url: '' }),
                    ],
                    percentajeCards: 100,
                }),
                {},
            );

            expect(columns(activity).left).toHaveLength(2);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(DragDropWorksheetAdapter.build(dragdropHtml({ cardsGame: [] }), {})).toBeNull();
            expect(DragDropWorksheetAdapter.build('<div class="dragdrop-IDevice"></div>', {})).toBeNull();
            expect(DragDropWorksheetAdapter.build('<div class="dragdrop-DataGame">no</div>', {})).toBeNull();
            expect(DragDropWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when cardsGame is not an array', () => {
            const html = `<div class="dragdrop-DataGame js-hidden">${encryptDataGame('{"cardsGame":"no"}')}</div>`;

            expect(DragDropWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('returns null when no card can be paired', () => {
            expect(DragDropWorksheetAdapter.build(dragdropHtml({ cardsGame: [card({ url: '' })] }), {})).toBeNull();
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a card', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ cardsGame: [card({ definition: '<p>Hi</p><script>alert(1)</script>' })] }),
                {},
            );

            expect(columns(activity).left[0].text).toBe('<p>Hi</p>');
        });

        it('strips a script smuggled into the instructions', () => {
            const activity = DragDropWorksheetAdapter.build(
                dragdropHtml({ instructions: '<p>Hi</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hi</p>');
        });
    });
});
