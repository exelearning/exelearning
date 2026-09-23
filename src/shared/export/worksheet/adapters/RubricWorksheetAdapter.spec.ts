import { describe, expect, it } from 'bun:test';
import type { PrintableRubric, WorksheetAdapterOptions } from '../types';
import { RubricWorksheetAdapter } from './RubricWorksheetAdapter';

interface RubricFixture {
    instructions?: string;
    textAfter?: string;
    table?: Record<string, unknown>;
    words?: Record<string, string>;
}

function storedTable(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: 'Rúbrica de exposición oral',
        categories: ['Habla'],
        scores: ['Excelente', 'Mejorable'],
        descriptions: [
            [
                { text: 'Habla con claridad.', weight: '4' },
                { text: 'Se le entiende mal.', weight: '2' },
            ],
        ],
        ...overrides,
    };
}

function rubricHtml(fixture: RubricFixture = {}): string {
    const words = fixture.words ?? { activity: 'Actividad', score: 'Puntuación', notes: 'Notas' };
    const items = Object.entries(words)
        .map(([key, word]) => `<li class="${key}">${word}</li>`)
        .join('');

    let html = '';
    if (fixture.instructions) html += `<div class="exe-rubrics-instructions">${fixture.instructions}</div>`;
    html += '<div class="rubric">';
    html += `<div class="exe-rubrics-DataGame js-hidden">${escape(JSON.stringify({ table: fixture.table ?? storedTable() }))}</div>`;
    html += `<ul class="exe-rubrics-strings">${items}</ul>`;
    html += '</div>';
    if (fixture.textAfter) html += `<div class="exe-rubrics-text-after">${fixture.textAfter}</div>`;

    return html;
}

function tableOf(fixture: RubricFixture = {}, options: WorksheetAdapterOptions = {}): PrintableRubric {
    const activity = RubricWorksheetAdapter.build(rubricHtml(fixture), options);
    if (activity?.board?.kind !== 'rubricTable') throw new Error('Expected a printable rubric');
    return activity.board.table;
}

describe('RubricWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(RubricWorksheetAdapter.ideviceType).toBe('rubric');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(RubricWorksheetAdapter.build(rubricHtml(), { title: 'Rúbrica' })?.title).toBe('Rúbrica');
        expect(RubricWorksheetAdapter.build(rubricHtml(), {})?.title).toBe('Rubric');
    });

    it('carries the whole rubric as the board, there being no questions beside it', () => {
        const activity = RubricWorksheetAdapter.build(rubricHtml(), {});

        expect(activity?.board?.kind).toBe('rubricTable');
        expect(activity?.items).toEqual([]);
    });

    it('prints every descriptor, which is what the teacher is choosing between', () => {
        // Every other adapter hides the answer; hiding these would leave a grid of numbers.
        const table = tableOf();

        expect(table.rows[0].cells[0]).toContain('Habla con claridad.');
        expect(table.rows[0].cells[1]).toContain('Se le entiende mal.');
    });

    it('asks for the activity and the score, and leaves room for notes', () => {
        const table = tableOf();

        expect(table.fields).toEqual(['Actividad', 'Puntuación']);
        expect(table.notes).toBe('Notas');
    });

    it('keeps name and date when no containing worksheet supplies them', () => {
        const table = tableOf({ words: { activity: 'Actividad', name: 'Nombre', date: 'Fecha' } });

        expect(table.fields).toEqual(['Actividad', 'Nombre', 'Fecha']);
    });

    it('omits only the date when the containing worksheet asks for its own', () => {
        const table = tableOf(
            { words: { activity: 'Actividad', name: 'Nombre', score: 'Nota', date: 'Fecha' } },
            { hasIdentityFields: true },
        );
        // The name stays under the activity it names, as it sits on screen.
        expect(table.fields).toEqual(['Actividad', 'Nombre', 'Nota']);
    });

    it('keeps the rubric own name as the table caption', () => {
        expect(tableOf().title).toBe('Rúbrica de exposición oral');
    });

    it('reads the text around the table from the divs the pipeline rewrote', () => {
        const activity = RubricWorksheetAdapter.build(
            rubricHtml({ instructions: '<p>Evalúa la exposición</p>', textAfter: '<p>Entrega el lunes</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Evalúa la exposición</p>');
        expect(activity?.textAfter).toBe('<p>Entrega el lunes</p>');
    });

    describe('what cannot be printed', () => {
        it('skips a component with no rubric in it', () => {
            expect(RubricWorksheetAdapter.build('<div class="rubric"></div>', {})).toBeNull();
        });

        it('skips a rubric with no criteria', () => {
            expect(RubricWorksheetAdapter.build(rubricHtml({ table: storedTable({ categories: [] }) }), {})).toBeNull();
        });
    });
});
