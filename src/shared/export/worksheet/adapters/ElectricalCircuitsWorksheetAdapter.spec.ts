import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { ElectricalCircuitsWorksheetAdapter } from './ElectricalCircuitsWorksheetAdapter';

const CIRCUIT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10"/></svg>';

interface CircuitFixture {
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

/** One question, with a circuit and both wordings the two modes use. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        quextion: '¿Cómo están conectadas las bombillas?',
        description: 'Circuito en serie con dos bombillas',
        tikzSvg: CIRCUIT,
        tikzCode: '\\begin{circuitikz}\\end{circuitikz}',
        typeSelect: 0,
        options: ['En serie', 'En paralelo', '', ''],
        numberOptions: 2,
        solution: 0,
        ...overrides,
    };
}

function circuitsHtml(fixture: CircuitFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'ElectricalCircuits',
        version: 3.1,
        activityMode: fixture.activityMode,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        percentajeQuestions: fixture.percentajeQuestions,
        questionsRandom: fixture.questionsRandom,
        answersRamdon: fixture.answersRamdon,
        selectsGame: fixture.questions ?? [question()],
    });

    let html = '<div class="electrical-circuits-IDevice">';
    html += `<div class="electrical-circuits-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.textAfterDiv) html += `<div class="electrical-circuits-extra-content">${fixture.textAfterDiv}</div>`;
    html += '</div>';

    return html;
}

function itemsOf(fixture: CircuitFixture = {}, options = {}): PrintableItem[] {
    return ElectricalCircuitsWorksheetAdapter.build(circuitsHtml(fixture), options)?.items ?? [];
}

describe('ElectricalCircuitsWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ElectricalCircuitsWorksheetAdapter.ideviceType).toBe('electrical-circuits');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(ElectricalCircuitsWorksheetAdapter.build(circuitsHtml(), { title: 'Circuitos' })?.title).toBe(
            'Circuitos',
        );
        expect(ElectricalCircuitsWorksheetAdapter.build(circuitsHtml(), {})?.title).toBe('Electrical circuits');
    });

    describe('presentation mode', () => {
        const shown = { activityMode: 'show' };

        it('sets the circuit with its description underneath', () => {
            // The renderer draws an item as prompt, picture, extra text — so the caption goes in
            // the extra text, or it would print above the drawing it describes.
            const [item] = itemsOf(shown);

            expect(item.prompt).toBe('');
            expect(item.media?.src.startsWith('data:image/svg+xml,')).toBe(true);
            expect(item.extraText).toBe('Circuito en serie con dos bombillas');
        });

        it('asks nothing, there being nothing to answer', () => {
            expect(itemsOf(shown)[0].answer).toBeUndefined();
        });

        it('does not number the circuits, since they are a set of diagrams', () => {
            expect(ElectricalCircuitsWorksheetAdapter.build(circuitsHtml(shown), {})?.unnumbered).toBe(true);
        });

        it('takes a circuit that carries no description', () => {
            const [item] = itemsOf({ ...shown, questions: [question({ description: '' })] });

            expect(item.media).toBeDefined();
            expect(item.extraText).toBeUndefined();
        });

        it('leaves out a circuit that has no drawing, the caption alone describing nothing', () => {
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { ...shown, questions: [question(), question({ tikzSvg: '' })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['media-required']);
        });
    });

    describe('test mode', () => {
        it('is what an activity with no mode stored is, as the runtime reads it', () => {
            const [item] = itemsOf();

            expect(item.prompt).toBe('¿Cómo están conectadas las bombillas?');
        });

        it('sets the question, its circuit, then the options', () => {
            const [item] = itemsOf();

            expect(item.media?.src.startsWith('data:image/svg+xml,')).toBe(true);
            expect(item.answer).toEqual({ kind: 'options', labels: ['En serie', 'En paralelo'], marker: 'box' });
        });

        it('gives an ordering question a line to write a position on', () => {
            // The three kinds are Select's, and are answered here the way they are there.
            const [item] = itemsOf({ questions: [question({ typeSelect: 1 })] });

            expect((item.answer as { marker: string }).marker).toBe('line');
        });

        it('gives a written answer one box per letter', () => {
            const [item] = itemsOf({
                questions: [question({ typeSelect: 2, solutionQuestion: 'SERIE', percentageShow: 0 })],
            });

            expect(item.answer?.kind).toBe('characterBoxes');
        });

        it('never prints which option is the right one', () => {
            expect(JSON.stringify(itemsOf()[0])).not.toContain('solution');
        });

        it('asks a question whose circuit is missing, the words still being answerable', () => {
            const [item] = itemsOf({ questions: [question({ tikzSvg: '' })] });

            expect(item.media).toBeUndefined();
            expect(item.prompt).toBe('¿Cómo están conectadas las bombillas?');
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

    it('strips anything unsafe the author left in the words', () => {
        const [item] = itemsOf({ questions: [question({ quextion: 'Hola<script>alert(1)</script>' })] });

        expect(item.prompt).toBe('Hola');
    });

    it('carries the drawing as an image rather than as markup', () => {
        // A browser runs no script in an SVG loaded through an img, which is the whole of the
        // safety argument; see circuitImage.
        const [item] = itemsOf({ questions: [question({ tikzSvg: '<svg onload="alert(1)"><g/></svg>' })] });

        expect(item.media?.src).not.toContain('<');
        expect(item.media?.src).not.toContain('"');
    });

    describe('instructions and closing text', () => {
        it('unescapes the rich instructions the editor stores', () => {
            const activity = ElectricalCircuitsWorksheetAdapter.build(
                circuitsHtml({ instructionsExe: escape('<p>Observa cada circuito</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Observa cada circuito</p>');
        });

        it('reads the closing text from the div, which is the copy the pipeline rewrote', () => {
            const activity = ElectricalCircuitsWorksheetAdapter.build(
                circuitsHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(
                ElectricalCircuitsWorksheetAdapter.build('<div class="electrical-circuits-IDevice"></div>', {}),
            ).toBeNull();
        });

        it('skips a payload with no questions in it', () => {
            expect(ElectricalCircuitsWorksheetAdapter.build(circuitsHtml({ questions: [] }), {})).toBeNull();
        });

        it('skips the activity when nothing survives', () => {
            expect(
                ElectricalCircuitsWorksheetAdapter.build(
                    circuitsHtml({ questions: [question({ quextion: '', options: [] })] }),
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
