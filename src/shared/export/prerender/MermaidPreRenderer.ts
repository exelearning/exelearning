/**
 * MermaidPreRenderer
 *
 * Renders Mermaid diagrams to static SVG with Pele (https://pele.run), which parses
 * Mermaid syntax and computes its own layout, so it needs no DOM or browser APIs.
 *
 * The same code runs in the browser (exporters bundle, with the vendored `pele.global.js`)
 * and on the server/CLI (with the `pele` package). The caller passes Pele's `render`
 * function, which keeps Pele out of the exporters bundle loaded at workarea start-up.
 *
 * Output format:
 * <div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B">
 *   <svg class="pele">...rendered diagram...</svg>
 * </div>
 *
 * A diagram that cannot be rendered keeps its <pre class="mermaid"> source and is
 * reported in `failures`.
 */

import type { MermaidPreRenderResult, MermaidRenderFailure } from '../interfaces';
import type { MermaidPreRendererInterface } from './interfaces';

/** Pele's `render(source, options)`, reduced to what this module uses. */
export type MermaidRenderFunction = (source: string, options: { fontFamily: string }) => { svg: string };

/**
 * Font stack of Mermaid's default theme. Pele sizes labels for it and writes it into
 * the SVG as the fallback of `--pele-font`. The editor runtime in common.js uses the same value.
 */
export const MERMAID_FONT_FAMILY = '"trebuchet ms", verdana, arial, sans-serif';

const PRE_PATTERN = /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi;
const JSON_DATA_PATTERN = /data-idevice-json-data="([^"]*)"/g;

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
        if (name[0] === '#') {
            const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
        }
        return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    });
}

function escapeAttribute(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attribute(attrs: string, name: string): string | null {
    const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
    return match ? (match[1] ?? match[2]) : null;
}

function isMermaidPre(attrs: string): boolean {
    return (attribute(attrs, 'class') ?? '').split(/\s+/).includes('mermaid');
}

/** Diagram source from the inner HTML of a <pre class="mermaid">. */
function extractSource(innerHtml: string): string {
    const text = innerHtml
        // An SVG left inside the <pre> by the old Mermaid.js runtime
        .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '');
    return decodeEntities(text).trim();
}

export class MermaidPreRenderer implements MermaidPreRendererInterface {
    constructor(private readonly render: MermaidRenderFunction) {}

    hasMermaid(html: string): boolean {
        if (!html) return false;
        for (const match of html.matchAll(PRE_PATTERN)) {
            if (isMermaidPre(match[1])) return true;
        }
        return false;
    }

    async preRender(html: string): Promise<MermaidPreRenderResult> {
        const failures: MermaidRenderFailure[] = [];
        let count = 0;
        let hasMermaid = false;

        const renderFragment = (fragment: string): string =>
            fragment.replace(PRE_PATTERN, (whole, attrs: string, inner: string) => {
                if (!isMermaidPre(attrs)) return whole;
                hasMermaid = true;
                const source = extractSource(inner);
                if (!source) return whole;
                try {
                    const { svg } = this.render(source, { fontFamily: MERMAID_FONT_FAMILY });
                    count++;
                    const style = attribute(attrs, 'style');
                    const styleAttr = style ? ` style="${escapeAttribute(style)}"` : '';
                    return `<div class="exe-mermaid-rendered"${styleAttr} data-mermaid="${escapeAttribute(source)}">${svg}</div>`;
                } catch (error) {
                    const code = (error as { code?: unknown })?.code;
                    failures.push({
                        code: typeof code === 'string' ? code : 'error',
                        message: error instanceof Error ? error.message : String(error),
                        source,
                    });
                    return whole;
                }
            });

        // JSON iDevices keep their content, escaped, in data-idevice-json-data.
        let result = html.replace(JSON_DATA_PATTERN, (whole, encoded: string) => {
            if (!encoded.includes('mermaid')) return whole;
            let data: unknown;
            try {
                data = JSON.parse(decodeEntities(encoded));
            } catch {
                return whole;
            }
            if (!data || typeof data !== 'object') return whole;
            let changed = false;
            for (const [key, value] of Object.entries(data)) {
                if (typeof value !== 'string') continue;
                const rendered = renderFragment(value);
                if (rendered !== value) {
                    (data as Record<string, unknown>)[key] = rendered;
                    changed = true;
                }
            }
            return changed ? `data-idevice-json-data="${escapeAttribute(JSON.stringify(data))}"` : whole;
        });

        result = renderFragment(result);

        return {
            html: count > 0 ? result : html,
            hasMermaid,
            mermaidRendered: count > 0,
            count,
            failures,
        };
    }
}
