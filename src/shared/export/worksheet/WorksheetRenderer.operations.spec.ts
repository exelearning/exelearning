import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableOperationRow, WorksheetLabels, WorksheetModel } from './types';

function modelWith(rows: PrintableOperationRow[]): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'mathematicaloperations',
                        title: 'Math operations',
                        board: { kind: 'operationTable', rows },
                        items: [],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a class name found is one that was drawn. */
function render(rows: PrintableOperationRow[], labels: WorksheetLabels = {}): string {
    const html = renderWorksheet(modelWith(rows), labels);

    return html.slice(html.indexOf('<body>'));
}

describe('renderWorksheet with a table of sums', () => {
    it('draws each operation beside its result', () => {
        const body = render([
            { operation: '4 + 4', result: '8' },
            { operation: '9 ÷ 3', result: '3' },
        ]);

        expect(body).toContain('<table class="worksheet-operations">');
        expect(body).toContain('<td class="worksheet-operation">4 + 4</td>');
        expect(body).toContain('<td class="worksheet-operation-result">8</td>');
        expect(body).toContain('<td class="worksheet-operation">9 ÷ 3</td>');
    });

    it('leaves the cell empty when that is what the student fills in', () => {
        const body = render([{ operation: '4 + 4', result: null }]);

        expect(body).toContain('<td class="worksheet-operation-result"></td>');
    });

    it('heads the columns so each side says what it is', () => {
        const body = render([{ operation: '4 + 4', result: null }]);

        expect(body).toContain('<th>Operation</th><th>Result</th>');
    });

    it("heads them in the reader's language", () => {
        const body = render([{ operation: '4 + 4', result: null }], { operation: 'Operación', result: 'Resultado' });

        expect(body).toContain('<th>Operación</th><th>Resultado</th>');
    });

    it('escapes a heading rather than letting it close the cell', () => {
        const body = render([{ operation: '4 + 4', result: null }], { operation: '</th><script>x</script>' });

        expect(body).not.toContain('<script>');
        expect(body).toContain('&lt;/th&gt;');
    });

    it('keeps the gap markup the adapter put in an operation', () => {
        const body = render([{ operation: '<span class="worksheet-gap"></span> + 4', result: '8' }]);

        expect(body).toContain('<td class="worksheet-operation"><span class="worksheet-gap"></span> + 4</td>');
    });

    it('draws no table when the activity set no operations', () => {
        const body = render([]);

        expect(body).not.toContain('<table class="worksheet-operations">');
    });
});
