/**
 * Server-side Pre-renderers for CLI Export
 *
 * These pre-renderers convert LaTeX and Mermaid content to static SVG
 * during CLI export, eliminating the need to bundle heavy client-side
 * libraries (MathJax ~1MB, Mermaid ~2.7MB) in the exported content.
 *
 * Usage:
 * ```typescript
 * import { ServerLatexPreRenderer, ServerMermaidPreRenderer } from './prerender';
 *
 * const latexRenderer = new ServerLatexPreRenderer();
 * const mermaidRenderer = new ServerMermaidPreRenderer();
 * await mermaidRenderer.initialize();
 *
 * const result = await exporter.export({
 *   preRenderLatex: (html) => latexRenderer.preRender(html),
 *   preRenderDataGameLatex: (html) => latexRenderer.preRenderDataGameLatex(html),
 *   preRenderMermaid: (html) => mermaidRenderer.preRender(html),
 * });
 * ```
 */

export { ServerLatexPreRenderer } from './ServerLatexPreRenderer';
export { ServerMermaidPreRenderer } from './ServerMermaidPreRenderer';
export type {
    ServerLatexPreRendererInterface,
    ServerMermaidPreRendererInterface,
    LatexPreRenderResult,
    MermaidPreRenderResult,
} from './interfaces';
