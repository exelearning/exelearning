import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableItem, WorksheetModel } from './types';

function modelWith(items: PrintableItem[], ideviceType = 'complete'): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [{ ideviceType, title: 'Activity', items }],
            },
        ],
        unsupported: [],
    };
}

describe('renderWorksheet question numbering', () => {
    it('numbers the questions when an activity has several', () => {
        const html = renderWorksheet(modelWith([{ prompt: 'A' }, { prompt: 'B' }]));

        expect(html).toContain('<ol class="worksheet-items">');
        // Matched on the markup: the class name also appears in the inlined stylesheet.
        expect(html).not.toContain('<ol class="worksheet-items worksheet-items-plain">');
    });

    it('leaves a lone question unnumbered', () => {
        // A complete activity is one text, so a leading "1." is noise.
        const html = renderWorksheet(modelWith([{ prompt: 'El <span></span> llegó.' }]));

        expect(html).toContain('<ol class="worksheet-items worksheet-items-plain">');
    });

    it('keeps an explicit number even on a lone question', () => {
        // A crossword numbers its clues after the grid, so the number is not the list's to drop.
        const html = renderWorksheet(modelWith([{ prompt: 'Clue', number: 3 }], 'crossword'));

        expect(html).toContain('<ol class="worksheet-items">');
        expect(html).toContain('<li class="worksheet-item" value="3">');
    });

    it('renders an activity with no questions without falling over', () => {
        const html = renderWorksheet(modelWith([]));

        expect(html).toContain('worksheet-items-plain');
    });
});
