import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { QuickQuestionsWorksheetAdapter } from './QuickQuestionsWorksheetAdapter';
import type { PrintableActivity } from '../types';

interface QuextFixtureOptions {
    instructions?: string;
    questionsGame?: Record<string, unknown>[];
    imageLinks?: Record<number, string>;
    textAfter?: string;
    percentajeQuestions?: number;
    optionsRamdon?: boolean;
    answersRamdon?: boolean;
}

/** A question with four options; type 0 is a plain one. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        type: 0,
        quextion: '<p>Question</p>',
        options: ['A', 'B', 'C', 'D'],
        numberOptions: 4,
        solution: 0,
        ...overrides,
    };
}

/** Build component HTML the way the Test editor writes it. */
function quextHtml(options: QuextFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Quext',
        instructions: options.instructions ?? '',
        percentajeQuestions: options.percentajeQuestions,
        optionsRamdon: options.optionsRamdon,
        answersRamdon: options.answersRamdon,
        questionsGame: options.questionsGame ?? [question()],
    });

    let html = '<div class="quext-IDevice">';
    html += '<div class="quext-version js-hidden">2</div>';
    html += `<div class="quext-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden quext-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="quext-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

/** The option labels of one item. */
function labelsOf(activity: PrintableActivity | null, index = 0): string[] {
    const answer = activity?.items[index]?.answer;
    return answer?.kind === 'options' ? answer.labels : [];
}

describe('QuickQuestionsWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(QuickQuestionsWorksheetAdapter.ideviceType).toBe('quick-questions');
    });

    it('builds one item per question, with a box per option', () => {
        const activity = QuickQuestionsWorksheetAdapter.build(quextHtml(), {});

        expect(activity?.items).toHaveLength(1);
        expect(activity?.items[0].prompt).toBe('<p>Question</p>');
        expect(labelsOf(activity)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('never prints which option is the right one', () => {
        const activity = QuickQuestionsWorksheetAdapter.build(
            quextHtml({ questionsGame: [question({ solution: 2 })] }),
            {},
        );

        // The answer carries labels only; nothing marks the solution.
        expect(JSON.stringify(activity?.items[0].answer)).not.toContain('solution');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(QuickQuestionsWorksheetAdapter.build(quextHtml(), { title: 'Cuestionario' })?.title).toBe(
            'Cuestionario',
        );
        expect(QuickQuestionsWorksheetAdapter.build(quextHtml(), {})?.title).toBe('Test');
    });

    it('carries over instructions and closing text', () => {
        const activity = QuickQuestionsWorksheetAdapter.build(
            quextHtml({ instructions: '<p>Responda</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Responda</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('video questions', () => {
        it('leaves a video question out', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({
                    questionsGame: [
                        question({ quextion: 'Plain' }),
                        question({ type: 2, quextion: 'Watch the video' }),
                    ],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Plain');
        });

        it('returns null when every question is a video one', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ type: 2 }), question({ type: 2 })] }),
                {},
            );

            expect(activity).toBeNull();
        });

        it('applies the share to what is printable, not to the stored total', () => {
            // Four questions, two of them video. Half of the two printable ones is one.
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({
                    questionsGame: [
                        question({ quextion: 'A' }),
                        question({ type: 2, quextion: 'V1' }),
                        question({ quextion: 'B' }),
                        question({ type: 2, quextion: 'V2' }),
                    ],
                    percentajeQuestions: 50,
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(['A', 'B']).toContain(activity?.items[0].prompt);
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
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: four, percentajeQuestions: 50 }),
                {},
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B']);
        });

        it('prints every question when the activity sets no share', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(quextHtml({ questionsGame: four }), {});

            expect(activity?.items).toHaveLength(4);
        });

        it('keeps the stored order when questions are not random', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: four, optionsRamdon: false }),
                { random: () => 0 },
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('reorders the questions when the activity asks for random ones', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: four, optionsRamdon: true }),
                { random: () => 0 },
            );

            const prompts = activity?.items.map(item => item.prompt) ?? [];
            expect([...prompts].sort()).toEqual(['A', 'B', 'C', 'D']);
            expect(prompts).not.toEqual(['A', 'B', 'C', 'D']);
        });

        it('keeps the option order when the activity does not shuffle answers', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(quextHtml({ answersRamdon: false }), {
                random: () => 0,
            });

            expect(labelsOf(activity)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('shuffles the options when the activity asks for it', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(quextHtml({ answersRamdon: true }), {
                random: () => 0,
            });

            const labels = labelsOf(activity);
            expect([...labels].sort()).toEqual(['A', 'B', 'C', 'D']);
            expect(labels).not.toEqual(['A', 'B', 'C', 'D']);
        });
    });

    describe('options', () => {
        it('offers only as many options as the question declares', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ numberOptions: 2 })] }),
                {},
            );

            expect(labelsOf(activity)).toEqual(['A', 'B']);
        });

        it('drops the blank padding the editor leaves behind', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ options: ['A', 'B', '', ''] })] }),
                {},
            );

            expect(labelsOf(activity)).toEqual(['A', 'B']);
        });

        it('keeps formatting inside an option', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ options: ['<b>Bold</b>', 'Plain', '', ''] })] }),
                {},
            );

            expect(labelsOf(activity)).toEqual(['<b>Bold</b>', 'Plain']);
        });
    });

    describe('question media', () => {
        it('takes a picture from the sidecar link, not from the payload', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({
                    questionsGame: [question({ type: 1, url: 'asset://stale', alt: 'A picture' })],
                    imageLinks: { 0: 'blob:http://localhost/fresh' },
                }),
                {},
            );

            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/fresh');
            expect(activity?.items[0].media?.alt).toBe('A picture');
        });

        it('keeps each picture matched to its own question after a video is dropped', () => {
            // The sidecars are keyed by stored position, which dropping a question shifts.
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({
                    questionsGame: [
                        question({ type: 2, quextion: 'Video' }),
                        question({ type: 1, quextion: 'Picture' }),
                    ],
                    imageLinks: { 1: 'blob:http://localhost/second' },
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/second');
        });

        it('unescapes and sanitises the rich text of a type 3 question', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ type: 3, eText: escape('<p>Read <b>this</b></p>') })] }),
                {},
            );

            expect(activity?.items[0].extraText).toBe('<p>Read <b>this</b></p>');
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(QuickQuestionsWorksheetAdapter.build(quextHtml({ questionsGame: [] }), {})).toBeNull();
            expect(QuickQuestionsWorksheetAdapter.build('<div class="quext-IDevice"></div>', {})).toBeNull();
            expect(QuickQuestionsWorksheetAdapter.build('<div class="quext-DataGame">not json</div>', {})).toBeNull();
            expect(QuickQuestionsWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when questionsGame is not an array', () => {
            const html = `<div class="quext-DataGame js-hidden">${encryptDataGame('{"questionsGame":"nope"}')}</div>`;

            expect(QuickQuestionsWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('skips a question with neither text nor options', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({
                    questionsGame: [
                        question({ quextion: '', options: ['', '', '', ''] }),
                        question({ quextion: 'Real' }),
                    ],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Real');
        });

        it('keeps a question that has text but no options', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ options: ['', '', '', ''] })] }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(labelsOf(activity)).toEqual([]);
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a question', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ quextion: '<p>Hi</p><script>alert(1)</script>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('<p>Hi</p>');
        });

        it('strips an event handler from an option', () => {
            const activity = QuickQuestionsWorksheetAdapter.build(
                quextHtml({ questionsGame: [question({ options: ['<b onclick="x()">A</b>', 'B', '', ''] })] }),
                {},
            );

            expect(labelsOf(activity)[0]).toBe('<b>A</b>');
        });
    });
});
