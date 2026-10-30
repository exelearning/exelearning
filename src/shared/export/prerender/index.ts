/**
 * Pre-renderers for exports
 *
 * These pre-renderers convert LaTeX and Mermaid content to static SVG
 * during export, so exported content does not need MathJax or a diagram
 * renderer at runtime.
 *
 * Usage:
 * ```typescript
 * import { render } from 'pele';
 * import { ServerLatexPreRenderer, MermaidPreRenderer } from './prerender';
 *
 * const latexRenderer = new ServerLatexPreRenderer();
 * const mermaidRenderer = new MermaidPreRenderer(render);
 *
 * const result = await exporter.export({
 *   preRenderLatex: (html) => latexRenderer.preRender(html),
 *   preRenderDataGameLatex: (html) => latexRenderer.preRenderDataGameLatex(html),
 *   preRenderMermaid: (html) => mermaidRenderer.preRender(html),
 * });
 * ```
 */

export { ServerLatexPreRenderer } from './ServerLatexPreRenderer';
export { MermaidPreRenderer, MERMAID_FONT_FAMILY } from './MermaidPreRenderer';
export type { MermaidRenderFunction } from './MermaidPreRenderer';
export type {
    ServerLatexPreRendererInterface,
    MermaidPreRendererInterface,
    LatexPreRenderResult,
    MermaidPreRenderResult,
} from './interfaces';
