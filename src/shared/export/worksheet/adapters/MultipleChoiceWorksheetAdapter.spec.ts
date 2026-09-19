import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { MultipleChoiceWorksheetAdapter, isRandomOrder } from './MultipleChoiceWorksheetAdapter';
import type { PrintableActivity } from '../types';

interface SelectFixtureOptions {
    instructions?: string;
    selectsGame?: Record<string, unknown>[];
    imageLinks?: Record<number, string>;
    textAfter?: string;
    percentajeQuestions?: number;
    order?: number;
    optionsRamdon?: boolean;
    answersRamdon?: boolean;
}

/** A Select question: tick one of four options. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        typeSelect: 0,
        type: 0,
        quextion: '<p>Question</p>',
        options: ['A', 'B', 'C', 'D'],
        numberOptions: 4,
        solution: '0',
        ...overrides,
    };
}

/** Build component HTML the way the Select editor writes it. */
function selectHtml(options: SelectFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Selecciona',
        instructions: options.instructions ?? '',
        percentajeQuestions: options.percentajeQuestions,
        order: options.order,
        optionsRamdon: options.optionsRamdon,
        answersRamdon: options.answersRamdon,
        selectsGame: options.selectsGame ?? [question()],
    });

    let html = '<div class="selecciona-IDevice">';
    html += `<div class="selecciona-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden selecciona-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="selecciona-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

/** The option labels of one item. */
function labelsOf(activity: PrintableActivity | null, index = 0): string[] {
    const answer = activity?.items[index]?.answer;
    return answer?.kind === 'options' ? answer.labels : [];
}

/** The answer boxes of one item, as text: '.' is an empty box. */
function boxesOf(activity: PrintableActivity | null, index = 0): string {
    const answer = activity?.items[index]?.answer;
    if (answer?.kind !== 'characterBoxes') return '';

    return answer.groups.map(group => group.map(box => box ?? '.').join('')).join(' ');
}

describe('isRandomOrder', () => {
    it('is not random in the default order', () => {
        expect(isRandomOrder({ order: 0 })).toBe(false);
    });

    it('is random in the random order', () => {
        expect(isRandomOrder({ order: 1 })).toBe(true);
    });

    it('treats a tree as random, since paper cannot branch', () => {
        expect(isRandomOrder({ order: 2 })).toBe(true);
    });

    it('falls back to the legacy flag when the activity predates the order setting', () => {
        expect(isRandomOrder({ optionsRamdon: true })).toBe(true);
        expect(isRandomOrder({ optionsRamdon: false })).toBe(false);
        expect(isRandomOrder({})).toBe(false);
    });
});

describe('MultipleChoiceWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(MultipleChoiceWorksheetAdapter.ideviceType).toBe('quick-questions-multiple-choice');
    });

    it('builds one item per question, with a box per option', () => {
        const activity = MultipleChoiceWorksheetAdapter.build(selectHtml(), {});

        expect(activity?.items).toHaveLength(1);
        expect(activity?.items[0].prompt).toBe('<p>Question</p>');
        expect(labelsOf(activity)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('never prints which option is the right one', () => {
        const activity = MultipleChoiceWorksheetAdapter.build(
            selectHtml({ selectsGame: [question({ solution: '2' })] }),
            {},
        );

        expect(JSON.stringify(activity?.items[0].answer)).not.toContain('solution');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(MultipleChoiceWorksheetAdapter.build(selectHtml(), { title: 'Selecciona' })?.title).toBe('Selecciona');
        expect(MultipleChoiceWorksheetAdapter.build(selectHtml(), {})?.title).toBe('Select');
    });

    it('carries over instructions and closing text', () => {
        const activity = MultipleChoiceWorksheetAdapter.build(
            selectHtml({ instructions: '<p>Elija</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Elija</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('question kinds', () => {
        it('prints an ordering question as its options, with a line to number them on', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ typeSelect: 1 })] }),
                {},
            );
            const answer = activity?.items[0].answer;

            expect(labelsOf(activity)).toEqual(['A', 'B', 'C', 'D']);
            expect(answer?.kind === 'options' && answer.marker).toBe('line');
        });

        it('prints a choice question with boxes to tick', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(selectHtml(), {});
            const answer = activity?.items[0].answer;

            expect(answer?.kind === 'options' && answer.marker).toBe('box');
        });

        it('prints a word question as one box per character', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ typeSelect: 2, solutionQuestion: 'Mio Cid' })] }),
                {},
            );

            // percentageShow is absent, so nothing is given away.
            expect(boxesOf(activity)).toBe('... ...');
        });

        it('gives away the share of letters a word question asks for', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({
                    selectsGame: [question({ typeSelect: 2, solutionQuestion: 'Cat', percentageShow: 100 })],
                }),
                {},
            );

            // The runtime always upper-cases a word question, so the boxes do too.
            expect(boxesOf(activity)).toBe('CAT');
        });

        it('gives away part of the letters at an intermediate share', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({
                    selectsGame: [question({ typeSelect: 2, solutionQuestion: 'Perro', percentageShow: 40 })],
                }),
                {},
            );

            // 40% of five letters is two.
            expect(boxesOf(activity).replace(/\./g, '')).toHaveLength(2);
        });

        it('skips a word question with no word to write', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({
                    selectsGame: [
                        question({ typeSelect: 2, solutionQuestion: '', quextion: '' }),
                        question({ quextion: 'Real' }),
                    ],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Real');
        });
    });

    describe('video questions', () => {
        it('leaves a video question out', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({
                    selectsGame: [question({ quextion: 'Plain' }), question({ type: 2, quextion: 'Video' })],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Plain');
        });

        it('returns null when every question is a video one', () => {
            expect(
                MultipleChoiceWorksheetAdapter.build(
                    selectHtml({ selectsGame: [question({ type: 2 }), question({ type: 2 })] }),
                    {},
                ),
            ).toBeNull();
        });
    });

    describe('activity options', () => {
        const four = [
            question({ quextion: 'A' }),
            question({ quextion: 'B' }),
            question({ quextion: 'C' }),
            question({ quextion: 'D' }),
        ];

        it('prints only the share of questions the activity asks', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: four, percentajeQuestions: 50, order: 0 }),
                {},
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B']);
        });

        it('applies the share to a tree too, which the runtime does not', () => {
            // The activity keeps every question in tree mode; a printed sheet cannot branch, so it
            // takes the share like any other order.
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: four, percentajeQuestions: 50, order: 2 }),
                { random: () => 0 },
            );

            expect(activity?.items).toHaveLength(2);
        });

        it('keeps the stored order in the default order', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(selectHtml({ selectsGame: four, order: 0 }), {
                random: () => 0,
            });

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('reorders the questions in the random order', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(selectHtml({ selectsGame: four, order: 1 }), {
                random: () => 0,
            });

            const prompts = activity?.items.map(item => item.prompt) ?? [];
            expect([...prompts].sort()).toEqual(['A', 'B', 'C', 'D']);
            expect(prompts).not.toEqual(['A', 'B', 'C', 'D']);
        });

        it('reorders the questions in a tree', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(selectHtml({ selectsGame: four, order: 2 }), {
                random: () => 0,
            });

            expect(activity?.items.map(item => item.prompt)).not.toEqual(['A', 'B', 'C', 'D']);
        });

        it('shuffles the options when the activity asks for it', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(selectHtml({ answersRamdon: true }), {
                random: () => 0,
            });

            const labels = labelsOf(activity);
            expect([...labels].sort()).toEqual(['A', 'B', 'C', 'D']);
            expect(labels).not.toEqual(['A', 'B', 'C', 'D']);
        });

        it('offers only as many options as the question declares', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ numberOptions: 2 })] }),
                {},
            );

            expect(labelsOf(activity)).toEqual(['A', 'B']);
        });
    });

    describe('question media', () => {
        it('takes a picture from the sidecar link, not from the payload', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({
                    selectsGame: [question({ type: 1, url: 'asset://stale', alt: 'A picture' })],
                    imageLinks: { 0: 'blob:http://localhost/fresh' },
                }),
                {},
            );

            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/fresh');
            expect(activity?.items[0].media?.alt).toBe('A picture');
        });

        it('unescapes and sanitises the rich text of a type 3 question', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ type: 3, eText: escape('<p>Read <b>this</b></p>') })] }),
                {},
            );

            expect(activity?.items[0].extraText).toBe('<p>Read <b>this</b></p>');
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(MultipleChoiceWorksheetAdapter.build(selectHtml({ selectsGame: [] }), {})).toBeNull();
            expect(MultipleChoiceWorksheetAdapter.build('<div class="selecciona-IDevice"></div>', {})).toBeNull();
            expect(MultipleChoiceWorksheetAdapter.build('<div class="selecciona-DataGame">x</div>', {})).toBeNull();
            expect(MultipleChoiceWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when selectsGame is not an array', () => {
            const html = `<div class="selecciona-DataGame js-hidden">${encryptDataGame('{"selectsGame":"no"}')}</div>`;

            expect(MultipleChoiceWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('keeps a question that has text but nothing to answer', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ options: ['', '', '', ''] })] }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].answer).toBeUndefined();
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a question', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ quextion: '<p>Hi</p><script>alert(1)</script>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('<p>Hi</p>');
        });

        it('strips an event handler from an option', () => {
            const activity = MultipleChoiceWorksheetAdapter.build(
                selectHtml({ selectsGame: [question({ options: ['<b onclick="x()">A</b>', 'B', '', ''] })] }),
                {},
            );

            expect(labelsOf(activity)[0]).toBe('<b>A</b>');
        });
    });
});
