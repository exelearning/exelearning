import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { ClassifyWorksheetAdapter } from './ClassifyWorksheetAdapter';
import type { PrintableActivity, PrintableCard, PrintableContainer } from '../types';

interface ClassifyFixtureOptions {
    instructions?: string;
    wordsGame?: Record<string, unknown>[];
    groups?: string[];
    imageLinks?: Record<number, string>;
    textAfter?: string;
    percentajeQuestions?: number;
    numberGroups?: number;
}

/** A text card belonging to the first container. */
function card(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { type: 1, eText: escape('Perro'), group: 0, ...overrides };
}

/** Build component HTML the way the Classify editor writes it. */
function classifyHtml(options: ClassifyFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Clasifica',
        instructions: options.instructions ?? '',
        groups: options.groups ?? ['Mamiferos', 'Aves'],
        numberGroups: options.numberGroups,
        percentajeQuestions: options.percentajeQuestions,
        wordsGame: options.wordsGame ?? [card()],
    });

    let html = '<div class="clasifica-IDevice">';
    html += `<div class="clasifica-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden clasifica-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="clasifica-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

function cardsOf(activity: PrintableActivity | null): PrintableCard[] {
    const board = activity?.board;
    return board?.kind === 'matchColumns' ? board.cards : [];
}

function containersOf(activity: PrintableActivity | null): PrintableContainer[] {
    const board = activity?.board;
    return board?.kind === 'matchColumns' ? board.containers : [];
}

describe('ClassifyWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ClassifyWorksheetAdapter.ideviceType).toBe('classify');
    });

    it('lays the cards out against the containers', () => {
        const activity = ClassifyWorksheetAdapter.build(classifyHtml(), {});

        expect(activity?.board?.kind).toBe('matchColumns');
        expect(cardsOf(activity)).toHaveLength(1);
        expect(containersOf(activity).map(container => container.name)).toEqual(['Mamiferos', 'Aves']);
    });

    it('prints no questions, since the exercise is the two columns', () => {
        expect(ClassifyWorksheetAdapter.build(classifyHtml(), {})?.items).toEqual([]);
    });

    it('never prints which container a card belongs to', () => {
        const activity = ClassifyWorksheetAdapter.build(classifyHtml(), {});

        expect(JSON.stringify(activity?.board)).not.toContain('group');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(ClassifyWorksheetAdapter.build(classifyHtml(), { title: 'Clasifica' })?.title).toBe('Clasifica');
        expect(ClassifyWorksheetAdapter.build(classifyHtml(), {})?.title).toBe('Classify');
    });

    it('carries over instructions and closing text', () => {
        const activity = ClassifyWorksheetAdapter.build(
            classifyHtml({ instructions: '<p>Clasifica</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Clasifica</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('containers', () => {
        it('gives each one a colour of its own', () => {
            const containers = containersOf(
                ClassifyWorksheetAdapter.build(classifyHtml({ groups: ['A', 'B', 'C'] }), {}),
            );

            expect(new Set(containers.map(container => container.color)).size).toBe(3);
        });

        it('wraps the palette round when there are more containers than colours', () => {
            const groups = Array.from({ length: 9 }, (_, index) => `G${index}`);
            const containers = containersOf(ClassifyWorksheetAdapter.build(classifyHtml({ groups }), {}));

            expect(containers).toHaveLength(9);
            expect(containers[8].color).toBe(containers[0].color);
        });

        it('labels a container the author left unnamed', () => {
            // The activity uses three, so three are printed; the runtime falls back to a numbered
            // label for the ones with no name and so does this.
            const containers = containersOf(
                ClassifyWorksheetAdapter.build(classifyHtml({ groups: ['Aves', '', '   '], numberGroups: 3 }), {}),
            );

            expect(containers.map(container => container.name)).toEqual(['Aves', 'Group 2', 'Group 3']);
        });

        it('prints only as many containers as the activity uses', () => {
            const containers = containersOf(
                ClassifyWorksheetAdapter.build(
                    classifyHtml({ groups: ['Aves', 'Peces', 'Reptiles'], numberGroups: 2 }),
                    {},
                ),
            );

            // The third name is left over from before the number was turned down.
            expect(containers.map(container => container.name)).toEqual(['Aves', 'Peces']);
        });

        it('returns null when the activity has no containers', () => {
            expect(ClassifyWorksheetAdapter.build(classifyHtml({ groups: [] }), {})).toBeNull();
        });
    });

    describe('cards', () => {
        it('reads the text of a text card', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({ wordsGame: [card({ eText: escape('<b>Perro</b>') })] }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('<b>Perro</b>');
            expect(cardsOf(activity)[0].media).toBeUndefined();
        });

        it('takes a picture card from the sidecar link, not from the payload', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({
                    wordsGame: [card({ type: 0, url: 'asset://stale', alt: 'Un perro' })],
                    imageLinks: { 0: 'blob:http://localhost/dog' },
                }),
                {},
            );

            expect(cardsOf(activity)[0].media?.src).toBe('blob:http://localhost/dog');
            expect(cardsOf(activity)[0].media?.alt).toBe('Un perro');
            expect(cardsOf(activity)[0].text).toBeUndefined();
        });

        it('reads both halves of a card that carries text and a picture', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({
                    wordsGame: [card({ type: 2, eText: escape('Perro') })],
                    imageLinks: { 0: 'blob:http://localhost/dog' },
                }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('Perro');
            expect(cardsOf(activity)[0].media?.src).toBe('blob:http://localhost/dog');
        });

        it('keeps each picture matched to its own card despite the shuffle', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({
                    wordsGame: [card({ eText: escape('Texto') }), card({ type: 0 })],
                    imageLinks: { 1: 'blob:http://localhost/second' },
                }),
                { random: () => 0 },
            );

            const withPicture = cardsOf(activity).filter(entry => entry.media);
            expect(withPicture).toHaveLength(1);
            expect(withPicture[0].media?.src).toBe('blob:http://localhost/second');
        });

        it('skips a card that carries nothing', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({ wordsGame: [card({ eText: '' }), card({ eText: escape('Gato') })] }),
                {},
            );

            expect(cardsOf(activity)).toHaveLength(1);
            expect(cardsOf(activity)[0].text).toBe('Gato');
        });

        it('shuffles the cards, so their order gives nothing away', () => {
            const four = ['uno', 'dos', 'tres', 'cuatro'].map(text => card({ eText: escape(text) }));
            const activity = ClassifyWorksheetAdapter.build(classifyHtml({ wordsGame: four }), {
                random: () => 0,
            });

            const texts = cardsOf(activity).map(entry => entry.text);
            expect([...texts].sort()).toEqual(['cuatro', 'dos', 'tres', 'uno']);
            expect(texts).not.toEqual(['uno', 'dos', 'tres', 'cuatro']);
        });

        it('prints only the share of cards the activity uses', () => {
            const four = ['uno', 'dos', 'tres', 'cuatro'].map(text => card({ eText: escape(text) }));
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({ wordsGame: four, percentajeQuestions: 50 }),
                {},
            );

            expect(cardsOf(activity)).toHaveLength(2);
        });

        it('prints every card when the activity sets no share', () => {
            const four = ['uno', 'dos', 'tres', 'cuatro'].map(text => card({ eText: escape(text) }));

            expect(cardsOf(ClassifyWorksheetAdapter.build(classifyHtml({ wordsGame: four }), {}))).toHaveLength(4);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(ClassifyWorksheetAdapter.build(classifyHtml({ wordsGame: [] }), {})).toBeNull();
            expect(ClassifyWorksheetAdapter.build('<div class="clasifica-IDevice"></div>', {})).toBeNull();
            expect(ClassifyWorksheetAdapter.build('<div class="clasifica-DataGame">no</div>', {})).toBeNull();
            expect(ClassifyWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when wordsGame is not an array', () => {
            const html = `<div class="clasifica-DataGame js-hidden">${encryptDataGame('{"wordsGame":"no"}')}</div>`;

            expect(ClassifyWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('returns null when every card is empty', () => {
            expect(ClassifyWorksheetAdapter.build(classifyHtml({ wordsGame: [card({ eText: '' })] }), {})).toBeNull();
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a card', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({ wordsGame: [card({ eText: escape('<p>Hi</p><script>alert(1)</script>') })] }),
                {},
            );

            expect(cardsOf(activity)[0].text).toBe('<p>Hi</p>');
        });

        it('strips a script smuggled into the instructions', () => {
            const activity = ClassifyWorksheetAdapter.build(
                classifyHtml({ instructions: '<p>Hi</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hi</p>');
        });
    });
});
