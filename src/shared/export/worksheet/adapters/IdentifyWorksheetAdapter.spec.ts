import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableItem, UnsupportedActivity } from '../types';
import { IdentifyWorksheetAdapter } from './IdentifyWorksheetAdapter';

interface IdentifyFixture {
    instructionsExe?: string;
    instructions?: string;
    instructionsDiv?: string;
    textAfter?: string;
    textAfterDiv?: string;
    questions?: Record<string, unknown>[];
    percentajeQuestions?: number;
    questionsRamdon?: boolean;
    msgClue?: string;
}

/** One question, as the editor stores it: eight clue slots, of which some are in play. */
function question(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        question: 'Plantea una metafísica dual.',
        numberClues: 3,
        clues: ['Autor de La República', 'Discípulo de Sócrates', 'Filósofo ateniense', '', '', '', '', ''],
        solution: 'Platón',
        url: 'https://upload.wikimedia.org/retrato.jpg',
        alt: 'Retrato de Platón',
        author: 'Wikimedia',
        audio: '',
        attempts: 4,
        ...overrides,
    };
}

function identifyHtml(fixture: IdentifyFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'identifica',
        version: 1,
        instructionsExe: fixture.instructionsExe,
        instructions: fixture.instructions,
        textAfter: fixture.textAfter,
        percentajeQuestions: fixture.percentajeQuestions,
        questionsRamdon: fixture.questionsRamdon,
        questionsGame: fixture.questions ?? [question()],
        msgs: { msgClue: fixture.msgClue ?? 'Sugerencia' },
    });

    let html = '<div class="identifica-IDevice">';
    if (fixture.instructionsDiv) html += `<div class="identifica-instructions">${fixture.instructionsDiv}</div>`;
    html += `<div class="identifica-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.textAfterDiv) html += `<div class="identifica-extra-content">${fixture.textAfterDiv}</div>`;
    html += '</div>';

    return html;
}

function itemsOf(fixture: IdentifyFixture = {}, options = {}): PrintableItem[] {
    return IdentifyWorksheetAdapter.build(identifyHtml(fixture), options)?.items ?? [];
}

/** One clue as the sheet lays it out. */
function clue(label: string, text: string): string {
    return `<li><span class="worksheet-clue-label">${label}</span>${text}</li>`;
}

describe('IdentifyWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(IdentifyWorksheetAdapter.ideviceType).toBe('identify');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(IdentifyWorksheetAdapter.build(identifyHtml(), { title: 'Identifica' })?.title).toBe('Identifica');
        expect(IdentifyWorksheetAdapter.build(identifyHtml(), {})?.title).toBe('Identify');
    });

    it('leads with the statement and puts the clues under it', () => {
        const [item] = itemsOf();

        expect(item.prompt).toBe('Plantea una metafísica dual.');
        expect(item.extraText).toBe(
            '<ul class="worksheet-clues">' +
                clue('Sugerencia 1.', 'Autor de La República') +
                clue('Sugerencia 2.', 'Discípulo de Sócrates') +
                clue('Sugerencia 3.', 'Filósofo ateniense') +
                '</ul>',
        );
    });

    it('leaves blank room to name the answer in', () => {
        expect(itemsOf()[0].answer).toEqual({ kind: 'writingSpace', lines: 2 });
    });

    it('leaves the picture out, recognising it being the whole of the game', () => {
        const [item] = itemsOf();

        expect(item.media).toBeUndefined();
        expect(JSON.stringify(item)).not.toContain('retrato.jpg');
    });

    it('never prints the answer, nor the other wordings of it the activity accepts', () => {
        const printed = JSON.stringify(itemsOf({ questions: [question({ solution: 'Platón | El ateniense' })] }));

        expect(printed).not.toContain('Platón');
        expect(printed).not.toContain('El ateniense');
    });

    describe('which clues are in play', () => {
        it('only as many as the activity offers, whatever is left in the slots past them', () => {
            // The slots past the count hold whatever the author last typed there.
            const [item] = itemsOf({
                questions: [question({ numberClues: 2, clues: ['Uno', 'Dos', 'Borrador', '', '', '', '', ''] })],
            });

            expect(item.extraText).toContain('Uno');
            expect(item.extraText).toContain('Dos');
            expect(item.extraText).not.toContain('Borrador');
        });

        it('skips a slot the author left blank in the middle', () => {
            const [item] = itemsOf({
                questions: [question({ numberClues: 3, clues: ['Uno', '   ', 'Tres', '', '', '', '', ''] })],
            });

            expect(item.extraText).toBe(
                `<ul class="worksheet-clues">${clue('Sugerencia 1.', 'Uno')}${clue('Sugerencia 2.', 'Tres')}</ul>`,
            );
        });

        it('takes them all when the activity says nothing about how many', () => {
            const [item] = itemsOf({
                questions: [question({ numberClues: undefined, clues: ['Uno', 'Dos'] })],
            });

            expect(item.extraText).toContain('Uno');
            expect(item.extraText).toContain('Dos');
        });
    });

    describe('what a clue is called', () => {
        it('the activity own word for it, which the author may have changed', () => {
            const [item] = itemsOf({ msgClue: 'Pista' });

            expect(item.extraText).toContain('<span class="worksheet-clue-label">Pista 1.</span>');
        });

        it('the number alone where the activity has no word of its own', () => {
            // Inventing one would need a translation for something already translated.
            const [item] = itemsOf({ msgClue: '' });

            expect(item.extraText).toContain('<span class="worksheet-clue-label">1.</span>');
        });

        it('escaped, an author being free to type anything into it', () => {
            const [item] = itemsOf({ msgClue: '<b>Pista' });

            expect(item.extraText).toContain('&lt;b&gt;Pista 1.');
        });
    });

    it('strips anything unsafe the author left in the words', () => {
        const [item] = itemsOf({
            questions: [question({ question: 'Hola<script>alert(1)</script>', clues: ['Uno<script>x</script>'] })],
        });

        expect(item.prompt).toBe('Hola');
        expect(item.extraText).toContain('>Uno</li>');
    });

    describe('instructions and closing text', () => {
        it('reads the instructions from the div, which is the copy the pipeline rewrote', () => {
            const activity = IdentifyWorksheetAdapter.build(
                identifyHtml({ instructionsDiv: '<p>Del div</p>', instructionsExe: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Del div</p>');
        });

        it('unescapes the rich instructions the payload keeps', () => {
            const activity = IdentifyWorksheetAdapter.build(
                identifyHtml({ instructionsExe: escape('<p>Usa las pistas</p>') }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Usa las pistas</p>');
        });

        it('reads the closing text from the div before the payload', () => {
            const activity = IdentifyWorksheetAdapter.build(
                identifyHtml({ textAfterDiv: '<p>Del div</p>', textAfter: escape('<p>Del payload</p>') }),
                {},
            );

            expect(activity?.textAfter).toBe('<p>Del div</p>');
        });
    });

    describe('what cannot be printed', () => {
        it('skips a component whose payload cannot be read', () => {
            expect(IdentifyWorksheetAdapter.build('<div class="identifica-IDevice"></div>', {})).toBeNull();
        });

        it('skips a payload with no questions in it', () => {
            expect(IdentifyWorksheetAdapter.build(identifyHtml({ questions: [] }), {})).toBeNull();
        });

        it('leaves out a question with neither a statement nor a clue', () => {
            // Without the picture there is nothing left of it to ask.
            const omissions: UnsupportedActivity['reason'][] = [];
            const items = itemsOf(
                { questions: [question(), question({ question: '', clues: ['', '', ''] })] },
                { onOmission: (reason: UnsupportedActivity['reason']) => omissions.push(reason) },
            );

            expect(items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data']);
        });

        it('keeps a question that has clues but no statement', () => {
            const [item] = itemsOf({ questions: [question({ question: '' })] });

            expect(item.prompt).toBe('');
            expect(item.extraText).toContain('Autor de La República');
        });
    });

    it('sets only the share of questions the activity asks for', () => {
        const four = Array.from({ length: 4 }, (_, i) => question({ question: `Q${i}` }));

        expect(itemsOf({ questions: four, percentajeQuestions: 50 })).toHaveLength(2);
    });
});
