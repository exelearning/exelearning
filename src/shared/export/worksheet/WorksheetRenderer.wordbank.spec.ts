import { describe, expect, it } from 'bun:test';
import { renderInlineGap, renderWorksheet } from './WorksheetRenderer';
import type { PrintableActivity, WorksheetModel } from './types';

function modelWith(overrides: Partial<PrintableActivity>): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'complete',
                        title: 'Complete',
                        items: [{ prompt: 'El <span class="worksheet-gap"></span> llegó.' }],
                        ...overrides,
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

describe('renderInlineGap', () => {
    it('sizes the gap from the length of the word', () => {
        expect(renderInlineGap(8)).toBe('<span class="worksheet-gap" style="width: 17.6mm"></span>');
    });

    it('gives a very short word a gap that can still be written in', () => {
        // One character would be unwritable, so three is the floor.
        expect(renderInlineGap(1)).toBe(renderInlineGap(3));
    });
});

describe('renderWorksheet with a word bank', () => {
    it('lists the words above the text they go into', () => {
        const html = renderWorksheet(modelWith({ board: { kind: 'wordBank', words: ['Cid', 'Toledo'] } }));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).toContain('<ul class="worksheet-word-bank">');
        expect(body).toContain('<li class="worksheet-word">Cid</li>');
        expect(body).toContain('<li class="worksheet-word">Toledo</li>');
        // Above the text, not below it.
        expect(body.indexOf('worksheet-word-bank')).toBeLessThan(body.indexOf('worksheet-items'));
    });

    it('keeps formatting inside a word', () => {
        const html = renderWorksheet(modelWith({ board: { kind: 'wordBank', words: ['<b>Cid</b>'] } }));

        expect(html).toContain('<li class="worksheet-word"><b>Cid</b></li>');
    });

    it('renders an empty list when the activity offers no words', () => {
        const html = renderWorksheet(modelWith({ board: { kind: 'wordBank', words: [] } }));

        expect(html).toContain('<ul class="worksheet-word-bank"></ul>');
    });

    it('draws no bank when the activity has no board', () => {
        const html = renderWorksheet(modelWith({}));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).not.toContain('worksheet-word-bank');
    });
});
