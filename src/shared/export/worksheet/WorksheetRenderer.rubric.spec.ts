import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableRubric, WorksheetModel } from './types';

function table(overrides: Partial<PrintableRubric> = {}): PrintableRubric {
    return {
        title: 'Rúbrica de exposición oral',
        fields: ['Actividad', 'Puntuación'],
        levels: ['Excelente', 'Mejorable'],
        rows: [
            { criterion: 'Habla', cells: ['Habla con claridad.', 'Se le entiende mal.'] },
            { criterion: 'Volumen', cells: ['Se le oye al fondo.', 'Cuesta oírle.'] },
        ],
        notes: 'Notas',
        ...overrides,
    };
}

function modelWith(rubric: PrintableRubric): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'rubric',
                        title: 'Rubric',
                        board: { kind: 'rubricTable', table: rubric },
                        items: [],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a class name found is one that was drawn. */
function render(overrides: Partial<PrintableRubric> = {}): string {
    const html = renderWorksheet(modelWith(table(overrides)), {});

    return html.slice(html.indexOf('<body>'));
}

describe('renderWorksheet with an assessment table', () => {
    it('draws a column per level, with an empty corner above the criteria', () => {
        const body = render();

        expect(body).toContain('<thead><tr><th></th><th>Excelente</th><th>Mejorable</th></tr></thead>');
    });

    it('draws a row per criterion, with every descriptor in place', () => {
        // Marking is done by ticking a cell, so nothing in the table is left blank.
        const body = render();
        const mark = '<span class="worksheet-rubric-mark"></span>';

        expect(body).toContain(
            `<tr><th>Habla</th><td>Habla con claridad.${mark}</td><td>Se le entiende mal.${mark}</td></tr>`,
        );
        expect(body).toContain(
            `<tr><th>Volumen</th><td>Se le oye al fondo.${mark}</td><td>Cuesta oírle.${mark}</td></tr>`,
        );
    });

    it('gives every cell a box to tick, an empty one included, as the activity gives each a checkbox', () => {
        const body = render({ rows: [{ criterion: 'Habla', cells: ['Habla con claridad.', ''] }] });

        expect(body.match(/class="worksheet-rubric-mark"/g)).toHaveLength(2);
        expect(body).toContain('<td><span class="worksheet-rubric-mark"></span></td>');
    });

    it('puts the box in the bottom-right corner of its cell', () => {
        const html = renderWorksheet(modelWith(table()), {});

        expect(html).toMatch(/\.worksheet-rubric-table td \{[^}]*position: relative;/);
        expect(html).toMatch(/\.worksheet-rubric-mark \{[^}]*position: absolute;[^}]*right: [^;]+;[^}]*bottom: [^;]+;/);
    });

    it('names the table with the rubric own title', () => {
        expect(render()).toContain('<caption>Rúbrica de exposición oral</caption>');
    });

    it('leaves the caption out when the rubric has no name', () => {
        expect(render({ title: undefined })).not.toContain('<caption>');
    });

    it('puts a labelled rule above the table for each field', () => {
        const body = render();

        expect(body).toContain('<p class="worksheet-rubric-field"><span>Actividad:</span>');
        expect(body).toContain('<p class="worksheet-rubric-field"><span>Puntuación:</span>');
        expect(body.indexOf('worksheet-rubric-field')).toBeLessThan(body.indexOf('worksheet-rubric-table'));
    });

    it('draws no field when the activity named none', () => {
        expect(render({ fields: [] })).not.toContain('worksheet-rubric-field');
    });

    it('leaves blank room for notes under the table', () => {
        const body = render();

        expect(body).toContain('<p class="worksheet-rubric-notes">Notas:</p>');
        expect(body.indexOf('worksheet-rubric-notes')).toBeGreaterThan(body.indexOf('worksheet-rubric-table'));
        expect(body).toContain('class="worksheet-writing-space" style="height: 14mm"');
    });

    it('leaves the notes out when the rubric names none', () => {
        expect(render({ notes: undefined })).not.toContain('worksheet-rubric-notes');
    });
});
