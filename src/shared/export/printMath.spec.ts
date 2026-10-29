import { describe, it, expect } from 'bun:test';
import { printPagesHaveLatex } from './printMath';
import { encryptDataGame } from './utils/dataGameCipher';
import type { ExportPage } from './interfaces';

const pages = (content: string, properties: Record<string, unknown> = {}, title = 'Page'): ExportPage[] => [
    {
        id: 'p',
        title,
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'b',
                name: 'Block',
                order: 0,
                components: [{ id: 'c', type: 'text', order: 0, content, properties }],
            },
        ],
    },
];
const game = (data: unknown) => `<div class="quext-DataGame js-hidden">${encryptDataGame(JSON.stringify(data))}</div>`;

describe('printPagesHaveLatex', () => {
    it.each(['\\(x\\)', '\\[x\\]', '$$x$$', '\\begin{align}x\\end{align}', '\\ref{eq}', '\\eqref{eq}'])(
        'finds %s, the delimiters the preview renders',
        formula => {
            expect(printPagesHaveLatex(pages(`<p>${formula}</p>`))).toBe(true);
        },
    );

    it('finds a formula in a title or deep in the properties of a JSON activity', () => {
        expect(printPagesHaveLatex(pages('<p>Text</p>', {}, 'Unit \\(1\\)'))).toBe(true);
        expect(printPagesHaveLatex(pages('', { questions: [{ options: ['a', '\\(b\\)'] }] }))).toBe(true);
    });

    it("finds a formula only a game's encrypted data holds, in any of its games", () => {
        const content = game({ question: 'No maths here' }) + game({ question: 'Solve \\(x^2=1\\)' });
        // Encrypted, the formula is not in the text a plain search reads.
        expect(content).not.toContain('\\(');
        expect(printPagesHaveLatex(pages(content))).toBe(true);
        expect(printPagesHaveLatex(pages(game({ question: 'No maths here' })))).toBe(false);
    });

    it('finds nothing in plain text, single dollar signs or pages without components', () => {
        expect(printPagesHaveLatex(pages('<p>From $5 to $9 (or less)</p>', { note: 'x [y]' }))).toBe(false);
        expect(printPagesHaveLatex([{ id: 'p', title: 'Empty', parentId: null, order: 0, blocks: [] }])).toBe(false);
        expect(printPagesHaveLatex([{ id: 'p', title: 'No blocks', parentId: null, order: 0 } as ExportPage])).toBe(
            false,
        );
        expect(printPagesHaveLatex([])).toBe(false);
    });
});
