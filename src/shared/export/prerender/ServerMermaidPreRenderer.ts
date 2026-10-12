/**
 * ServerMermaidPreRenderer
 *
 * Pre-renders Mermaid diagrams to static SVG using the mermaid npm package.
 * This allows CLI exports to include pre-rendered diagrams without bundling Mermaid (~2.7MB).
 *
 * Output format:
 * <div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B">
 *   <svg>...rendered diagram...</svg>
 * </div>
 *
 * Based on the browser-side MermaidPreRenderer.js, adapted for Node.js using
 * the mermaid npm package with jsdom for DOM virtualization.
 */

// Type only: jsdom is loaded in initialize(). Imported statically, jsdom
// (CommonJS) runs while the server's module graph is still loading, and since
// Bun 1.4 its require('parse5') fails when that graph also imports the ESM
// parse5, as the worksheet code does ("require() async module is
// unsupported"), so the server does not start.
import type { JSDOM } from 'jsdom';
import type { MermaidPreRenderResult, ServerMermaidPreRendererInterface } from './interfaces';

// Detection pattern for mermaid diagrams
const HAS_MERMAID_PATTERN = /<pre\s+[^>]*class="[^"]*\bmermaid\b[^"]*"/i;

// Counter for unique render IDs
let renderCounter = 0;

/** Approximate width of a character and height of a line, for text jsdom cannot measure. */
const CHAR_WIDTH = 8;
const LINE_HEIGHT = 16;

/** Elements that draw nothing where they stand, so take no room in their parent's box. */
const NOT_DRAWN = new Set([
    'style',
    'defs',
    'marker',
    'title',
    'desc',
    'metadata',
    'script',
    'clippath',
    'mask',
    'pattern',
    'lineargradient',
    'radialgradient',
    'symbol',
]);

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** A numeric attribute, or 0. */
function attribute(element: Element, name: string): number {
    const value = Number.parseFloat(element.getAttribute(name) ?? '');
    return Number.isFinite(value) ? value : 0;
}

/** The box around a list of coordinates, read as x,y pairs. */
function boxAroundPoints(values: number[]): Box | null {
    if (values.length < 2) return null;
    const xs = values.filter((_, index) => index % 2 === 0);
    const ys = values.filter((_, index) => index % 2 === 1);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Every number in an attribute such as a path's `d` or a polygon's `points`. */
function numbersIn(element: Element, name: string): number[] {
    return (element.getAttribute(name)?.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}

/**
 * Estimate the bounding box jsdom cannot compute.
 *
 * Mermaid sizes each label from its box and the whole drawing from the box of the <svg>. Text is
 * measured by its length, shapes by their own attributes, and anything else as the union of its
 * children, each moved by its `translate`. Scaling and rotation are left out: mermaid lays its
 * diagrams out by translating groups.
 *
 * @param element - An SVG element
 * @returns Its box in its own coordinates, or null when it draws nothing
 */
export function estimateBBox(element: Element): Box | null {
    const tag = element.tagName.toLowerCase();
    if (NOT_DRAWN.has(tag)) return null;

    switch (tag) {
        case 'text':
        case 'tspan': {
            const text = element.textContent ?? '';
            if (!text.trim()) return null;
            const x = attribute(element, 'x');
            const y = attribute(element, 'y');
            // y is the baseline: most of a line sits above it.
            return { x, y: y - LINE_HEIGHT * 0.75, width: text.length * CHAR_WIDTH, height: LINE_HEIGHT };
        }
        case 'rect':
        case 'image':
        case 'foreignobject':
            return {
                x: attribute(element, 'x'),
                y: attribute(element, 'y'),
                width: attribute(element, 'width'),
                height: attribute(element, 'height'),
            };
        case 'circle': {
            const r = attribute(element, 'r');
            return { x: attribute(element, 'cx') - r, y: attribute(element, 'cy') - r, width: 2 * r, height: 2 * r };
        }
        case 'ellipse': {
            const rx = attribute(element, 'rx');
            const ry = attribute(element, 'ry');
            return {
                x: attribute(element, 'cx') - rx,
                y: attribute(element, 'cy') - ry,
                width: 2 * rx,
                height: 2 * ry,
            };
        }
        case 'line':
            return boxAroundPoints(['x1', 'y1', 'x2', 'y2'].map(name => attribute(element, name)));
        case 'polygon':
        case 'polyline':
            return boxAroundPoints(numbersIn(element, 'points'));
        case 'path':
            return boxAroundPoints(numbersIn(element, 'd'));
        default: {
            const boxes: Box[] = [];
            for (const child of Array.from(element.children)) {
                const box = estimateBBox(child);
                if (!box) continue;
                const moved = /translate\(\s*(-?[\d.e]+)(?:[\s,]+(-?[\d.e]+))?\s*\)/i.exec(
                    child.getAttribute('transform') ?? '',
                );
                const dx = moved ? Number(moved[1]) : 0;
                const dy = moved?.[2] ? Number(moved[2]) : 0;
                boxes.push({ ...box, x: box.x + dx, y: box.y + dy });
            }
            if (boxes.length === 0) return null;
            const x = Math.min(...boxes.map(box => box.x));
            const y = Math.min(...boxes.map(box => box.y));
            const right = Math.max(...boxes.map(box => box.x + box.width));
            const bottom = Math.max(...boxes.map(box => box.y + box.height));
            return { x, y, width: right - x, height: bottom - y };
        }
    }
}

/**
 * Escape HTML special characters for use in attributes
 */
function escapeHtmlAttribute(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Decode HTML entities in mermaid code
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

// Import mermaid dynamically to handle the ESM module
let mermaidModule: MermaidAPI | null = null;

/**
 * Server-side Mermaid Pre-renderer using mermaid npm package
 */
export class ServerMermaidPreRenderer implements ServerMermaidPreRendererInterface {
    private mermaid: MermaidAPI | null = null;
    private dom: JSDOM | null = null;
    private initialized = false;
    private initializationFailed = false;

    /**
     * Check if HTML contains Mermaid diagrams
     */
    hasMermaid(html: string): boolean {
        return !!(html && HAS_MERMAID_PATTERN.test(html));
    }

    /**
     * Initialize the Mermaid library
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Create jsdom with required features for mermaid
        const jsdom = await import('jsdom');
        this.dom = new jsdom.JSDOM(
            '<!DOCTYPE html><html><head></head><body><div id="mermaid-container"></div></body></html>',
            {
                runScripts: 'dangerously',
                pretendToBeVisual: true,
                url: 'http://localhost',
            },
        );

        const { window } = this.dom;

        // Polyfill the SVG measuring that mermaid needs and jsdom doesn't implement. jsdom has no
        // class of its own for <text> or <tspan>, so both go on SVGElement.
        const svgElement = window.SVGElement.prototype as unknown as Record<string, unknown>;
        if (!svgElement.getBBox) {
            svgElement.getBBox = function (this: Element) {
                return estimateBBox(this) ?? { x: 0, y: 0, width: 0, height: 0 };
            };
        }
        if (!svgElement.getComputedTextLength) {
            svgElement.getComputedTextLength = function (this: Element) {
                const text = this.textContent || '';
                return text.length * CHAR_WIDTH;
            };
        }

        // Set up minimal browser globals that Mermaid expects
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.window = window;
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.document = window.document;
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.navigator = window.navigator;
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.Element = window.Element;
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.HTMLElement = window.HTMLElement;
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.SVGElement = window.SVGElement;
        // Mermaid builds each diagram's styles in a constructed stylesheet; without it every
        // diagram fails to render and the export keeps the source instead.
        // @ts-expect-error - Adding globals for Mermaid compatibility
        global.CSSStyleSheet = window.CSSStyleSheet;

        try {
            // Import mermaid from npm package (cached for subsequent initializations)
            if (!mermaidModule) {
                const imported = await import('mermaid');
                mermaidModule = imported.default as unknown as MermaidAPI;
            }
            this.mermaid = mermaidModule;

            if (!this.mermaid) {
                throw new Error('Mermaid library not found after import');
            }

            // Initialize mermaid with settings optimized for server-side rendering
            this.mermaid.initialize({
                startOnLoad: false,
                suppressErrorRendering: true,
                logLevel: 'fatal',
                securityLevel: 'loose',
                theme: 'default',
                // Labels as SVG text, which can be measured here: an HTML label is sized by the
                // browser, and jsdom gives it no size, so it ends up in a 0x0 box. Only this
                // root-level setting is read; the per-diagram one is deprecated.
                htmlLabels: false,
                // Use simple settings for server-side rendering
                flowchart: { useMaxWidth: true },
                sequence: { useMaxWidth: true },
                gantt: { useMaxWidth: true },
            });

            this.initialized = true;
        } catch (error) {
            // Mermaid initialization may fail if SVG rendering isn't available
            // In this case, pre-rendering will be skipped and Mermaid diagrams
            // will be included in export with the Mermaid library
            console.warn(
                '[ServerMermaidPreRenderer] Failed to initialize Mermaid library. ' +
                    'Mermaid diagrams will not be pre-rendered. Error:',
                error,
            );
            this.initialized = false;
            this.initializationFailed = true;
        }
    }

    /**
     * Render a single Mermaid diagram to SVG
     */
    private async renderMermaidToSvg(code: string): Promise<string> {
        if (!this.mermaid) {
            throw new Error('Mermaid not initialized');
        }

        // Generate unique ID for this render
        const id = `mermaid-server-${Date.now()}-${renderCounter++}`;

        try {
            // Use mermaid.render() API
            const result = await this.mermaid.render(id, code);
            return result.svg;
        } catch (error) {
            console.error('[ServerMermaidPreRenderer] Render error:', error);
            throw error;
        }
    }

    /**
     * Create the rendered wrapper HTML
     */
    private createRenderedWrapper(originalCode: string, svg: string): string {
        const escapedCode = escapeHtmlAttribute(originalCode.trim());
        return `<div class="exe-mermaid-rendered" data-mermaid="${escapedCode}">${svg}</div>`;
    }

    /**
     * Pre-render all Mermaid diagrams in HTML
     */
    async preRender(html: string): Promise<MermaidPreRenderResult> {
        // Quick check: any Mermaid at all?
        const hasMermaidInHtml = html && HAS_MERMAID_PATTERN.test(html);
        const hasMermaidInJson = html && /data-idevice-json-data="[^"]*mermaid/i.test(html);

        if (!hasMermaidInHtml && !hasMermaidInJson) {
            return {
                html,
                hasMermaid: false,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Initialize if needed
        if (!this.initialized && !this.initializationFailed) {
            await this.initialize();
        }

        // If initialization failed, return HTML unchanged (Mermaid lib will be included in export)
        if (this.initializationFailed || !this.mermaid) {
            return {
                html,
                hasMermaid: hasMermaidInHtml || hasMermaidInJson,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Pattern to match <pre class="mermaid">...</pre>
        const mermaidPattern = /<pre\s+([^>]*)class="([^"]*\bmermaid\b[^"]*)"([^>]*)>([\s\S]*?)<\/pre>/gi;

        let result = html;
        let renderedCount = 0;
        let errorCount = 0;

        // First, process JSON data attributes (for JSON iDevices)
        const jsonDataPattern = /data-idevice-json-data="([^"]*)"/g;
        let jsonMatch: RegExpExecArray | null;

        while ((jsonMatch = jsonDataPattern.exec(html)) !== null) {
            const encodedJson = jsonMatch[1];
            if (!encodedJson.includes('mermaid')) continue;

            try {
                // Decode HTML entities in the JSON string
                const decodedJson = decodeHtmlEntities(encodedJson);
                const jsonData = JSON.parse(decodedJson);

                let jsonUpdated = false;

                // Process each property that might contain mermaid
                for (const [key, value] of Object.entries(jsonData)) {
                    if (typeof value !== 'string' || !HAS_MERMAID_PATTERN.test(value)) {
                        continue;
                    }

                    // Process mermaid in this property
                    let propertyHtml = value;
                    let propertyMatch: RegExpExecArray | null;
                    const propertyPattern = /<pre\s+([^>]*)class="([^"]*\bmermaid\b[^"]*)"([^>]*)>([\s\S]*?)<\/pre>/gi;

                    while ((propertyMatch = propertyPattern.exec(value)) !== null) {
                        const fullMatch = propertyMatch[0];
                        const code = decodeHtmlEntities(propertyMatch[4].trim());

                        if (!code || code.length < 5) continue;

                        try {
                            const svg = await this.renderMermaidToSvg(code);
                            if (svg) {
                                const wrapper = this.createRenderedWrapper(code, svg);
                                propertyHtml = propertyHtml.replace(fullMatch, wrapper);
                                renderedCount++;
                                jsonUpdated = true;
                            }
                        } catch (err) {
                            console.warn('[ServerMermaidPreRenderer] Failed to render mermaid in JSON:', key, err);
                            errorCount++;
                        }
                    }

                    if (jsonUpdated) {
                        (jsonData as Record<string, unknown>)[key] = propertyHtml;
                    }
                }

                if (jsonUpdated) {
                    // Re-encode and escape the JSON
                    const newJson = JSON.stringify(jsonData);
                    const escapedNewJson = newJson
                        .replace(/&/g, '&amp;')
                        .replace(/"/g, '&quot;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');

                    result = result.replace(
                        `data-idevice-json-data="${encodedJson}"`,
                        `data-idevice-json-data="${escapedNewJson}"`,
                    );
                }
            } catch (err) {
                console.warn('[ServerMermaidPreRenderer] Failed to process JSON data:', err);
            }
        }

        // Then process direct <pre class="mermaid"> elements
        let match: RegExpExecArray | null;
        const processedMatches: Array<{ original: string; replacement: string }> = [];

        // Reset the pattern
        mermaidPattern.lastIndex = 0;

        while ((match = mermaidPattern.exec(result)) !== null) {
            const fullMatch = match[0];
            const code = decodeHtmlEntities(match[4].trim());

            if (!code || code.length < 5) continue;

            // Check if already processed
            if (match[0].includes('data-processed')) continue;

            try {
                const svg = await this.renderMermaidToSvg(code);
                if (svg) {
                    const wrapper = this.createRenderedWrapper(code, svg);
                    processedMatches.push({ original: fullMatch, replacement: wrapper });
                    renderedCount++;
                }
            } catch (err) {
                console.warn('[ServerMermaidPreRenderer] Failed to render:', code.substring(0, 50) + '...', err);
                errorCount++;
            }
        }

        // Apply replacements (from end to avoid index shifting)
        for (const { original, replacement } of processedMatches.reverse()) {
            result = result.replace(original, replacement);
        }

        return {
            html: result,
            hasMermaid: hasMermaidInHtml || hasMermaidInJson,
            mermaidRendered: renderedCount > 0,
            count: renderedCount,
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.dom) {
            this.dom.window.close();
            this.dom = null;
        }
        this.mermaid = null;
        this.initialized = false;

        // Clean up global references
        // @ts-expect-error - Cleaning up globals
        delete global.window;
        // @ts-expect-error - Cleaning up globals
        delete global.document;
        // @ts-expect-error - Cleaning up globals
        delete global.navigator;
        // @ts-expect-error - Cleaning up globals
        delete global.Element;
        // @ts-expect-error - Cleaning up globals
        delete global.HTMLElement;
        // @ts-expect-error - Cleaning up globals
        delete global.SVGElement;
    }
}

/**
 * Mermaid API interface (minimal typing)
 */
interface MermaidAPI {
    initialize(config: MermaidConfig): void;
    render(id: string, code: string): Promise<{ svg: string }>;
}

interface MermaidConfig {
    startOnLoad?: boolean;
    suppressErrorRendering?: boolean;
    logLevel?: string;
    securityLevel?: string;
    theme?: string;
    htmlLabels?: boolean;
    flowchart?: { useMaxWidth?: boolean; htmlLabels?: boolean };
    sequence?: { useMaxWidth?: boolean };
    gantt?: { useMaxWidth?: boolean };
}
