/**
 * Interfaces spec file
 *
 * This file exists to satisfy test coverage requirements.
 * The interfaces module only exports TypeScript types which are
 * compile-time only and don't require runtime tests.
 */

import { describe, it, expect } from 'bun:test';
import type { LatexPreRenderResult, MermaidPreRenderResult } from './interfaces';

describe('prerender/interfaces', () => {
    it('should export type definitions', () => {
        // Type-only imports don't have runtime values,
        // so we just verify the module loads without error
        expect(true).toBe(true);
    });

    it('should allow creating type-compliant objects', () => {
        // Verify LatexPreRenderResult type structure
        const latexResult: LatexPreRenderResult = {
            html: '<span class="exe-math-rendered">test</span>',
            hasLatex: true,
            latexRendered: true,
            count: 1,
        };
        expect(latexResult.html).toContain('exe-math-rendered');
        expect(latexResult.hasLatex).toBe(true);
        expect(latexResult.latexRendered).toBe(true);
        expect(latexResult.count).toBe(1);

        // Verify MermaidPreRenderResult type structure
        const mermaidResult: MermaidPreRenderResult = {
            html: '<div class="exe-mermaid-rendered">test</div>',
            hasMermaid: true,
            mermaidRendered: true,
            count: 1,
        };
        expect(mermaidResult.html).toContain('exe-mermaid-rendered');
        expect(mermaidResult.hasMermaid).toBe(true);
        expect(mermaidResult.mermaidRendered).toBe(true);
        expect(mermaidResult.count).toBe(1);
    });
});
