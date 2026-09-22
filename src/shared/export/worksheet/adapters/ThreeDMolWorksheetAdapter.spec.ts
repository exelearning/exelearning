import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { ThreeDMolWorksheetAdapter } from './ThreeDMolWorksheetAdapter';

/** A capture, as the pass that runs before this adapter writes one in. */
const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';

/** Enough of an SDF file to say a molecule was meant to be drawn here. */
const MODEL = '\n  Mrv  \n\n  1  0  0  0  0  0            999 V2000\n';

interface MoleculeFixture {
    activityMode?: string;
    instructionsExe?: string;
    instructions?: string;
    textAfter?: string;
    textAfterDiv?: string;
    questions?: Record<string, unknown>[];
    percentajeQuestions?: number;
    questionsRandom?: boolean;
    answersRamdon?: boolean;
}

/** One question, already captured, with both wordings the two modes use. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        quextion: '¿Cuántos átomos de carbono tiene?',
        description: 'Glucosa en representación de varillas',
        alt: 'Modelo de glucosa',
        modelData: MODEL,
        modelFormat: 'sdf',
        modelStyle: 'stick',
        modelImage: PICTURE,
        typeSelect: 0,
        options: ['Seis', 'Doce', '', ''],
        numberOptions: 2,
        solution: 0,
        ...overrides,
    };
}

function moleculesHtml(fixture: MoleculeFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: '3DMol',
        version: 1.0,
        activityMode: fixture.activityMode,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        percentajeQuestions: fixture.percentajeQuestions,
        questionsRandom: fixture.questionsRandom,
        answersRamdon: fixture.answersRamdon,
        selectsGame: fixture.questions ?? [question()],
    });

    let html = '<div class="dmole-IDevice">';
    html += `<div class="dmole-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.textAfterDiv) html += `<div class="dmole-extra-content">${fixture.textAfterDiv}</div>`;
    html += '</div>';

    return html;
}

function itemsOf(fixture: MoleculeFixture = {}, options = {}): PrintableItem[] {
    return ThreeDMolWorksheetAdapter.build(moleculesHtml(fixture), options)?.items ?? [];
}

describe('ThreeDMolWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ThreeDMolWorksheetAdapter.ideviceType).toBe('3dmol');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(ThreeDMolWorksheetAdapter.build(moleculesHtml(), { title: 'Moléculas' })?.title).toBe('Moléculas');
        expect(ThreeDMolWorksheetAdapter.build(moleculesHtml(), {})?.title).toBe('3D molecules');
    });

    describe('presentation mode', () => {
        const shown = { activityMode: 'show' };

        it('sets the molecule with its description underneath', () => {
            const [item] = itemsOf(shown);

            expect(item.prompt).toBe('');
            expect(item.media?.src).toBe(PICTURE);
            expect(item.extraText).toBe('Glucosa en representación de varillas');
        });

        it('describes the molecule for a reader who cannot see it', () => {
            expect(itemsOf(shown)[0].media?.alt).toBe('Modelo de glucosa');
        });

        it('asks nothing, there being nothing to answer', () => {
            expect(itemsOf(shown)[0].answer).toBeUndefined();
        });

        it('does not number the molecules, since they are a set of pictures', () => {
            expect(ThreeDMolWorksheetAdapter.build(moleculesHtml(shown), {})?.unnumbered).toBe(true);
        });

        it('takes a molecule that carries no description', () => {
            const [item] = itemsOf({ ...shown, questions: [question({ description: '' })] });

            expect(item.media).toBeDefined();
            expect(item.extraText).toBeUndefined();
        });

        it('leaves out a molecule nobody drew, the caption alone describing an empty space', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { ...shown, questions: [question(), question({ modelImage: undefined })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['media-required']);
        });
    });

    describe('test mode', () => {
        it('is what an activity with no mode stored is, as the runtime reads it', () => {
            expect(itemsOf()[0].prompt).toBe('¿Cuántos átomos de carbono tiene?');
        });

        it('sets the question, its molecule, then the options', () => {
            const [item] = itemsOf();

            expect(item.media?.src).toBe(PICTURE);
            expect(item.answer).toEqual({ kind: 'options', labels: ['Seis', 'Doce'], marker: 'box' });
        });

        it('gives an ordering question a line to write a position on', () => {
            // The three kinds are Select's, and are answered here the way they are there.
            const [item] = itemsOf({ questions: [question({ typeSelect: 1 })] });

            expect((item.answer as { marker: string }).marker).toBe('line');
        });

        it('gives a written answer one box per letter', () => {
            const [item] = itemsOf({
                questions: [question({ typeSelect: 2, solutionQuestion: 'SEIS', percentageShow: 0 })],
            });

            expect(item.answer?.kind).toBe('characterBoxes');
        });

        it('never prints which option is the right one', () => {
            expect(JSON.stringify(itemsOf()[0])).not.toContain('solution');
        });

        it('asks a question whose molecule was not drawn, the words still being answerable', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const [item] = itemsOf(
                { questions: [question({ modelImage: undefined })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(item.media).toBeUndefined();
            expect(item.prompt).toBe('¿Cuántos átomos de carbono tiene?');
            // Worth saying so: the question stored a molecule, and the sheet has none.
            expect(omissions).toEqual(['media-required']);
        });

        it('says nothing about a question that never had a molecule to lose', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            itemsOf(
                { questions: [question({ modelData: '', modelImage: undefined })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(omissions).toEqual([]);
        });

        it('leaves out a question with nothing to ask or nothing to answer', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                {
                    questions: [
                        question(),
                        question({ quextion: '' }),
                        question({ options: ['', '', '', ''], numberOptions: 0 }),
                    ],
                },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data', 'invalid-data']);
        });
    });

    it('takes only a drawn picture, never the model that was meant to become one', () => {
        // Anything that is not a capture would reach the sheet as a broken image.
        const [item] = itemsOf({ questions: [question({ modelImage: MODEL })] });

        expect(item.media).toBeUndefined();
    });

    it('strips anything unsafe the author left in the words', () => {
        const [item] = itemsOf({ questions: [question({ quextion: 'Hola<script>alert(1)</script>' })] });

        expect(item.prompt).toBe('Hola');
    });

    describe('instructions and closing text', () => {
        it('unescapes the rich instructions the editor stores', () => {
            const activity = ThreeDMolWorksheetAdapter.build(
                moleculesHtml({ instructionsExe: escape('<p>Observa cada molécula</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Observa cada molécula</p>');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = ThreeDMolWorksheetAdapter.build(
                moleculesHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(ThreeDMolWorksheetAdapter.build('<div class="dmole-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no questions in it', () => {
            expect(ThreeDMolWorksheetAdapter.build(moleculesHtml({ questions: [] }), {})).toBeNull();
        });

        it('skips the activity when nothing survives', () => {
            expect(
                ThreeDMolWorksheetAdapter.build(
                    moleculesHtml({ questions: [question({ quextion: '', options: [] })] }),
                    {},
                ),
            ).toBeNull();
        });
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => question({ quextion: `Q${i}` }));

        expect(itemsOf({ questions: four, percentajeQuestions: 50 })).toHaveLength(2);
    });
});
