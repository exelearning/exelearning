/**
 * Server-side Pre-renderer Interfaces
 *
 * These interfaces define the contract for pre-rendering LaTeX and Mermaid
 * content on the server side (CLI export) without requiring a browser.
 */

import type { LatexPreRenderResult, MermaidPreRenderResult } from '../interfaces';

/**
 * Server LaTeX pre-renderer interface
 */
export interface ServerLatexPreRendererInterface {
    /**
     * Pre-render LaTeX expressions in HTML to SVG+MathML
     * @param html - HTML content with LaTeX expressions
     * @returns Pre-render result with processed HTML
     */
    preRender(html: string): Promise<LatexPreRenderResult>;

    /**
     * Pre-render LaTeX inside encrypted DataGame divs
     * Game iDevices store questions in encrypted JSON
     * @param html - HTML containing DataGame divs
     * @returns HTML with pre-rendered LaTeX in DataGame
     */
    preRenderDataGameLatex(html: string): Promise<{ html: string; count: number }>;

    /**
     * Check if HTML contains LaTeX expressions
     * @param html - HTML content
     * @returns True if LaTeX is detected
     */
    hasLatex(html: string): boolean;
}

/**
 * Server Mermaid pre-renderer interface
 */
export interface ServerMermaidPreRendererInterface {
    /**
     * Initialize Mermaid library (must be called before preRender)
     */
    initialize(): Promise<void>;

    /**
     * Pre-render Mermaid diagrams in HTML to static SVG
     * @param html - HTML content with Mermaid diagrams
     * @returns Pre-render result with processed HTML
     */
    preRender(html: string): Promise<MermaidPreRenderResult>;

    /**
     * Check if HTML contains Mermaid diagrams
     * @param html - HTML content
     * @returns True if Mermaid is detected
     */
    hasMermaid(html: string): boolean;
}

// Re-export result types for convenience
export type { LatexPreRenderResult, MermaidPreRenderResult };
