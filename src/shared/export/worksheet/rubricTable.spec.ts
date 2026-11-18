import { describe, expect, it } from 'bun:test';
import { readRubricTable } from './rubricTable';

/** The payload the current editor writes: `escape()`d JSON, with no obfuscation over it. */
function payload(data: Record<string, unknown>): string {
    return `<div class="exe-rubrics-DataGame js-hidden">${escape(JSON.stringify(data))}</div>`;
}

/** The list the iDevice keeps its own wording in, beside the table. */
function strings(words: Record<string, string>): string {
    const items = Object.entries(words)
        .map(([key, word]) => `<li class="${key}">${word}</li>`)
        .join('');

    return `<ul class="exe-rubrics-strings">${items}</ul>`;
}

/** A table as the current editor stores it. */
function storedTable(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: 'Rúbrica de exposición oral',
        categories: ['Habla', 'Volumen'],
        scores: ['Excelente', 'Mejorable'],
        descriptions: [
            [
                { text: 'Habla despacio y con claridad.', weight: '4' },
                { text: 'Se acelera y se le entiende mal.', weight: '2' },
            ],
            [
                { text: 'Se le oye en toda la sala.', weight: '4' },
                { text: 'Cuesta oírle desde el fondo.', weight: '2' },
            ],
        ],
        ...overrides,
    };
}

/** The same table as an older project carries it: plain HTML the author pasted. */
function legacyHtml(): string {
    return (
        "<div class='rubric'><table class='exe-table'>" +
        '<caption>Rúbrica de exposición oral</caption>' +
        '<thead><tr><th>&nbsp;</th><th>Excelente</th><th>Mejorable</th></tr></thead>' +
        '<tbody>' +
        '<tr><th>Habla</th>' +
        '<td>Habla despacio y con claridad. <span>(4)</span></td>' +
        '<td>Se acelera y se le entiende mal. <span>(2)</span></td></tr>' +
        '<tr><th>Volumen</th>' +
        '<td>Se le oye en toda la sala. <span>(4)</span></td>' +
        '<td>Cuesta oírle desde el fondo. <span>(2)</span></td></tr>' +
        '</tbody></table></div>'
    );
}

describe('readRubricTable', () => {
    describe('the shape the current editor writes', () => {
        it('reads the table out of the payload', () => {
            const table = readRubricTable(payload({ table: storedTable() }));

            expect(table?.title).toBe('Rúbrica de exposición oral');
            expect(table?.levels).toEqual(['Excelente', 'Mejorable']);
            expect(table?.rows.map(row => row.criterion)).toEqual(['Habla', 'Volumen']);
        });

        it('reads one stored at the top level, as older versions wrote it', () => {
            const table = readRubricTable(payload(storedTable()));

            expect(table?.rows).toHaveLength(2);
        });

        it('prints the descriptor with what the level is worth after it', () => {
            const table = readRubricTable(payload({ table: storedTable() }));

            expect(table?.rows[0].cells[0]).toBe(
                'Habla despacio y con claridad. <span class="worksheet-rubric-weight">(4)</span>',
            );
        });

        it('leaves the weight off a cell that carries none', () => {
            const table = readRubricTable(
                payload({ table: storedTable({ descriptions: [[{ text: 'Sin peso' }], []] }) }),
            );

            expect(table?.rows[0].cells[0]).toBe('Sin peso');
        });

        it('takes a cell stored as plain text, which older projects did', () => {
            const table = readRubricTable(payload({ table: storedTable({ descriptions: [['Texto suelto'], []] }) }));

            expect(table?.rows[0].cells[0]).toBe('Texto suelto');
        });

        it('pads a row the author left short, so the columns still line up', () => {
            const table = readRubricTable(payload({ table: storedTable({ descriptions: [[{ text: 'Sólo una' }]] }) }));

            expect(table?.rows[0].cells).toEqual(['Sólo una', '']);
            expect(table?.rows[1].cells).toEqual(['', '']);
        });

        it('reads a payload that was never escaped', () => {
            const html = `<div class="exe-rubrics-DataGame">${JSON.stringify({ table: storedTable() })}</div>`;

            expect(readRubricTable(html)?.rows).toHaveLength(2);
        });
    });

    describe('the table an older project carries as HTML', () => {
        /** A table an author put in their own text, which is not the rubric. */
        const prose = (className: string) =>
            `<div class="${className}"><table class="exe-table"><tbody><tr><td>Cómo evaluar</td></tr></tbody></table></div>`;

        it('ignores tables in instructions, including tables with the generic exe-table class', () => {
            expect(readRubricTable(prose('exe-rubrics-instructions') + legacyHtml())?.rows).toEqual(
                readRubricTable(legacyHtml())?.rows,
            );
        });

        it('ignores one in the closing text too', () => {
            expect(readRubricTable(legacyHtml() + prose('exe-rubrics-text-after'))?.rows).toHaveLength(2);
        });

        it('reads an unwrapped legacy table and an edition-marked table', () => {
            const unwrapped = legacyHtml().replace("<div class='rubric'>", '').replace('</div>', '');
            expect(readRubricTable(unwrapped)?.rows).toHaveLength(2);
            expect(
                readRubricTable(
                    unwrapped.replace("class='exe-table'", 'class="exe-table" data-rubric-table-type="edition"'),
                )?.rows,
            ).toHaveLength(2);
        });

        it('finds the rubric past a table that is not one, wrapper or no wrapper', () => {
            // The oldest projects carry the table bare: the component is wrapped by the page, not
            // by the stored HTML, so there is no `rubric` div to scope the search to. What tells
            // the rubric from a table in someone's prose is its shape.
            const unwrapped = legacyHtml().replace("<div class='rubric'>", '').replace('</div>', '');
            const loose =
                '<table class="exe-table"><tbody><tr><td>Dos columnas</td><td>sin niveles</td></tr></tbody></table>';

            for (const rubric of [legacyHtml(), unwrapped]) {
                expect(readRubricTable(loose + rubric)?.rows.map(row => row.criterion)).toEqual(['Habla', 'Volumen']);
            }
        });
        it('reads the caption, the levels and the criteria', () => {
            const table = readRubricTable(legacyHtml());

            expect(table?.title).toBe('Rúbrica de exposición oral');
            // The corner above the criteria heads nothing and is skipped.
            expect(table?.levels).toEqual(['Excelente', 'Mejorable']);
            expect(table?.rows.map(row => row.criterion)).toEqual(['Habla', 'Volumen']);
        });

        it('takes the weight out of the cell and puts it back after the descriptor', () => {
            expect(readRubricTable(legacyHtml())?.rows[0].cells[0]).toBe(
                'Habla despacio y con claridad. <span class="worksheet-rubric-weight">(4)</span>',
            );
        });

        it('ignores the table the runtime drew for itself', () => {
            // It is the same data rendered back; reading it would take the runtime's output for
            // the author's own markup.
            const drawn = legacyHtml().replace(
                "class='exe-table'",
                'class="exe-table" data-rubric-table-type="export"',
            );

            expect(readRubricTable(drawn)).toBeNull();
        });

        it('is only read when there is no payload to read instead', () => {
            const html = payload({ table: storedTable({ title: 'Del payload' }) }) + legacyHtml();

            expect(readRubricTable(html)?.title).toBe('Del payload');
        });
    });

    describe('the words the activity uses for its fields', () => {
        it('comes from the list beside the table', () => {
            const html = legacyHtml() + strings({ activity: 'Actividad', score: 'Puntuación', notes: 'Notas' });
            const table = readRubricTable(html);

            expect(table?.fields).toEqual(['Actividad', 'Puntuación']);
            expect(table?.notes).toBe('Notas');
        });

        it('comes from the payload before the list', () => {
            const html =
                payload({ table: storedTable(), i18n: { activity: 'Tarea', score: 'Nota', notes: 'Comentarios' } }) +
                strings({ activity: 'Actividad', score: 'Puntuación', notes: 'Notas' });

            expect(readRubricTable(html)?.fields).toEqual(['Tarea', 'Nota']);
        });

        it('preserves the date unless the containing sheet already asks for one, and the name always', () => {
            const html = legacyHtml() + strings({ activity: 'Actividad', name: 'Nombre', date: 'Fecha' });

            expect(readRubricTable(html)?.fields).toEqual(['Actividad', 'Nombre', 'Fecha']);
            expect(readRubricTable(html, true)?.fields).toEqual(['Actividad', 'Nombre']);
        });

        it('prints no field the activity has no word for', () => {
            const table = readRubricTable(legacyHtml());

            expect(table?.fields).toEqual([]);
            expect(table?.notes).toBeUndefined();
        });
    });

    it('strips anything unsafe an author left in a cell or a heading', () => {
        const table = readRubricTable(
            payload({
                table: storedTable({
                    categories: ['Habla<script>alert(1)</script>', 'Volumen'],
                    descriptions: [[{ text: 'Bien<script>x</script>', weight: '4' }], []],
                }),
            }),
        );

        expect(table?.rows[0].criterion).toBe('Habla');
        expect(table?.rows[0].cells[0]).toContain('Bien <span');
    });

    describe('what cannot be read', () => {
        it('a component with no rubric in it', () => {
            expect(readRubricTable('<div class="rubric"></div>')).toBeNull();
            expect(readRubricTable('')).toBeNull();
        });

        it('a payload that is not readable JSON', () => {
            expect(readRubricTable('<div class="exe-rubrics-DataGame">no es json</div>')).toBeNull();
        });

        it('a table with no levels, or none with criteria', () => {
            expect(readRubricTable(payload({ table: storedTable({ scores: [] }) }))).toBeNull();
            expect(readRubricTable(payload({ table: storedTable({ categories: [] }) }))).toBeNull();
        });
    });
});
