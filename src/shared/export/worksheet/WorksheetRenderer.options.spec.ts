import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableActivity, WorksheetModel } from './types';

function modelWith(items: PrintableActivity['items']): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [{ ideviceType: 'quick-questions', title: 'Test', items }],
            },
        ],
        unsupported: [],
    };
}

describe('renderWorksheet with multiple-choice answers', () => {
    it('draws a box to tick beside every option', () => {
        const html = renderWorksheet(
            modelWith([{ prompt: 'Q', answer: { kind: 'options', labels: ['A', 'B', 'C'] } }]),
        );

        expect(html.match(/class="worksheet-option"/g)).toHaveLength(3);
        expect(html.match(/class="worksheet-option-box"/g)).toHaveLength(3);
        expect(html).toContain('<span class="worksheet-option-label">A</span>');
    });

    it('draws a line instead of a box when the question asks for an order', () => {
        const html = renderWorksheet(
            modelWith([{ prompt: 'Q', answer: { kind: 'options', labels: ['A', 'B'], marker: 'line' } }]),
        );

        // A line is written on, a box is ticked.
        expect(html.match(/class="worksheet-option-line"/g)).toHaveLength(2);
        expect(html).not.toContain('<span class="worksheet-option-box">');
    });

    it('defaults to a box to tick', () => {
        const html = renderWorksheet(
            modelWith([{ prompt: 'Q', answer: { kind: 'options', labels: ['A'], marker: 'box' } }]),
        );

        expect(html).toContain('<span class="worksheet-option-box">');
        expect(html).not.toContain('<span class="worksheet-option-line">');
    });

    it('keeps formatting inside an option label', () => {
        const html = renderWorksheet(
            modelWith([{ prompt: 'Q', answer: { kind: 'options', labels: ['<b>Bold</b>'] } }]),
        );

        expect(html).toContain('<span class="worksheet-option-label"><b>Bold</b></span>');
    });

    it('renders an empty list for a question with no options', () => {
        const html = renderWorksheet(modelWith([{ prompt: 'Q', answer: { kind: 'options', labels: [] } }]));

        expect(html).toContain('<ul class="worksheet-options"></ul>');
        expect(html).not.toContain('class="worksheet-option"');
    });

    it('still throws for answer kinds with no renderer', () => {
        expect(() => renderWorksheet(modelWith([{ prompt: 'Q', answer: { kind: 'lines', count: 2 } }]))).toThrow(
            'not implemented yet',
        );
    });
});
