import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { HiddenImageWorksheetAdapter } from './HiddenImageWorksheetAdapter';

interface HiddenImageFixture {
    instructionsExe?: string;
    instructions?: string;
    textAfter?: string;
    textAfterDiv?: string;
    questions?: Record<string, unknown>[];
    percentajeQuestions?: number;
    optionsRamdon?: boolean;
    answersRamdon?: boolean;
    images?: Record<number, string>;
    /** Written unobfuscated, as an activity older than version 1 stores it. */
    plain?: boolean;
}

/** One question, with the four slots the editor always keeps. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        question: '¿Qué animal ladra?',
        options: ['El perro', 'El gato', '', ''],
        numberOptions: 2,
        solution: 0,
        url: '',
        audio: '',
        ...overrides,
    };
}

/** Build component HTML the way the Hidden image editor writes it. */
function hiddenImageHtml(fixture: HiddenImageFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'HiddenImage',
        version: 1,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        percentajeQuestions: fixture.percentajeQuestions,
        optionsRamdon: fixture.optionsRamdon,
        answersRamdon: fixture.answersRamdon,
        questionsGame: fixture.questions ?? [question()],
    });

    let html = '<div class="hiddenimage-IDevice">';
    html += `<div class="hiddenimage-DataGame js-hidden">${fixture.plain ? payload : encryptDataGame(payload)}</div>`;
    for (const [index, href] of Object.entries(fixture.images ?? {})) {
        html += `<a class="js-hidden hiddenimage-LinkImages" href="${href}">${index}</a>`;
    }
    if (fixture.textAfterDiv) html += `<div class="hiddenimage-extra-content">${fixture.textAfterDiv}</div>`;
    html += '</div>';

    return html;
}

function itemsOf(fixture: HiddenImageFixture = {}, options = {}): PrintableItem[] {
    return HiddenImageWorksheetAdapter.build(hiddenImageHtml(fixture), options)?.items ?? [];
}

/** The option labels of one item, whatever marker they carry. */
function labelsOf(item: PrintableItem): string[] {
    expect(item.answer?.kind).toBe('options');
    return (item.answer as { labels: string[] }).labels;
}

describe('HiddenImageWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(HiddenImageWorksheetAdapter.ideviceType).toBe('hidden-image');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(HiddenImageWorksheetAdapter.build(hiddenImageHtml(), { title: 'Imagen' })?.title).toBe('Imagen');
        expect(HiddenImageWorksheetAdapter.build(hiddenImageHtml(), {})?.title).toBe('Hidden image');
    });

    it('sets the question, then its picture, then the options', () => {
        // The renderer draws an item in that order, which is what this activity needs.
        const [item] = itemsOf({ images: { 0: 'files/dog.png' } });

        expect(item.prompt).toBe('¿Qué animal ladra?');
        expect(item.media?.src).toBe('files/dog.png');
        expect(labelsOf(item)).toEqual(['El perro', 'El gato']);
    });

    it('gives each option a box to tick', () => {
        const [item] = itemsOf();

        expect((item.answer as { marker: string }).marker).toBe('box');
    });

    it('never prints which option is the right one', () => {
        const [item] = itemsOf({ questions: [question({ solution: 1 })] });

        expect(JSON.stringify(item)).not.toContain('solution');
    });

    describe('the options a question really offers', () => {
        it('prints only the ones the author filled in', () => {
            // The editor keeps four slots and the runtime draws four boxes, the spare ones blank.
            // A blank line beside a tick box reads as an option the student failed to see.
            const [item] = itemsOf();

            expect(labelsOf(item)).toHaveLength(2);
        });

        it('prints all four when the question uses them', () => {
            const four = question({ options: ['A', 'B', 'C', 'D'], numberOptions: 4 });

            expect(labelsOf(itemsOf({ questions: [four] })[0])).toEqual(['A', 'B', 'C', 'D']);
        });

        it('leaves out a blank slot inside the count', () => {
            const gappy = question({ options: ['A', '', 'C', ''], numberOptions: 3 });

            expect(labelsOf(itemsOf({ questions: [gappy] })[0])).toEqual(['A', 'C']);
        });

        it("keeps the author's formatting and strips what is unsafe", () => {
            const marked = question({ options: ['<b>Uno</b>', 'Dos<script>alert(1)</script>'] });

            expect(labelsOf(itemsOf({ questions: [marked] })[0])).toEqual(['<b>Uno</b>', 'Dos']);
        });
    });

    describe('the two shuffle flags, which are named the wrong way round', () => {
        const four = [
            question({ question: 'Q0', options: ['A0', 'B0', 'C0', 'D0'], numberOptions: 4 }),
            question({ question: 'Q1', options: ['A1', 'B1', 'C1', 'D1'], numberOptions: 4 }),
        ];

        it('leaves the options in their stored order by default', () => {
            expect(labelsOf(itemsOf({ questions: four })[0])).toEqual(['A0', 'B0', 'C0', 'D0']);
        });

        it('shuffles the options when answersRamdon is set, not when optionsRamdon is', () => {
            // `optionsRamdon` is the questions' flag despite its name; reading it the way it is
            // spelled sets a different exercise from the one the teacher configured.
            let seed = 3;
            const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

            const shuffled = labelsOf(itemsOf({ questions: four, answersRamdon: true }, { random })[0]);
            expect([...shuffled].sort()).toEqual(['A0', 'B0', 'C0', 'D0']);
            expect(shuffled).not.toEqual(['A0', 'B0', 'C0', 'D0']);

            expect(labelsOf(itemsOf({ questions: four, optionsRamdon: true })[0])).toEqual(['A0', 'B0', 'C0', 'D0']);
        });
    });

    describe('pictures', () => {
        it('takes them from the sidecar link, not from the payload', () => {
            // The payload's own copy points at an asset:// the rewriting pass cannot see inside.
            const [item] = itemsOf({
                questions: [question({ url: 'asset://stale.png' })],
                images: { 0: 'files/dog.png' },
            });

            expect(item.media?.src).toBe('files/dog.png');
        });

        it('keeps each picture matched to its own question', () => {
            const items = itemsOf({
                questions: [question({ question: 'Q0' }), question({ question: 'Q1' })],
                images: { 0: 'files/first.png', 1: 'files/second.png' },
            });

            expect(items.map(item => item.media?.src)).toEqual(['files/first.png', 'files/second.png']);
        });

        it('prints a question that has no picture at all', () => {
            // The reveal is the picture's whole job on screen; a question can still be answered.
            const [item] = itemsOf();

            expect(item.media).toBeUndefined();
            expect(item.prompt).toBe('¿Qué animal ladra?');
        });
    });

    describe('instructions and closing text', () => {
        it('unescapes the rich instructions the editor stores', () => {
            const activity = HiddenImageWorksheetAdapter.build(
                hiddenImageHtml({ instructionsExe: escape('<p>Elige la respuesta</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Elige la respuesta</p>');
        });

        it('falls back to the plain instructions when there are no rich ones', () => {
            const activity = HiddenImageWorksheetAdapter.build(
                hiddenImageHtml({ instructions: 'Elige la respuesta' }),
                {},
            );

            expect(activity?.instructions).toBe('Elige la respuesta');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = HiddenImageWorksheetAdapter.build(
                hiddenImageHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });

        it('falls back to the payload copy when there is no div', () => {
            const activity = HiddenImageWorksheetAdapter.build(
                hiddenImageHtml({ textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del payload</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('reads an activity older than version 1, which stores plain JSON', () => {
            expect(itemsOf({ plain: true })).toHaveLength(1);
        });

        it('leaves out a question with nothing to choose between', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { questions: [question(), question({ options: ['', '', '', ''] }), question()] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(2);
            expect(omissions).toEqual(['invalid-data']);
        });

        it('leaves out a question with no prompt', () => {
            expect(itemsOf({ questions: [question({ question: '' })] })).toHaveLength(0);
        });

        it('skips a component whose payload cannot be read', () => {
            expect(HiddenImageWorksheetAdapter.build('<div class="hiddenimage-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no questions in it', () => {
            expect(HiddenImageWorksheetAdapter.build(hiddenImageHtml({ questions: [] }), {})).toBeNull();
        });
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => question({ question: `Q${i}` }));

        expect(itemsOf({ questions: four, percentajeQuestions: 50 })).toHaveLength(2);
    });
});
