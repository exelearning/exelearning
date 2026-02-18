/**
 * ServerLatexPreRenderer
 *
 * Pre-renders LaTeX expressions to SVG+MathML using MathJax v3's Node.js API.
 * This allows CLI exports to include pre-rendered math without bundling MathJax (~1MB).
 *
 * Output format:
 * <span class="exe-math-rendered" data-latex="\frac{1}{2}" data-display="inline|block">
 *   <svg>...</svg>
 *   <math>...</math>
 * </span>
 *
 * Based on the browser-side LatexPreRenderer.js, adapted for Node.js using
 * MathJax's liteAdaptor (no DOM required).
 */

import { mathjax } from 'mathjax-full/js/mathjax';
import { TeX } from 'mathjax-full/js/input/tex';
import { SVG } from 'mathjax-full/js/output/svg';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages';
import type { LatexPreRenderResult, ServerLatexPreRendererInterface } from './interfaces';

// LaTeX detection patterns (for hasLatex quick check)
const HAS_LATEX_PATTERN = /\\\(|\\\[|\$\$|\\begin\{|\\(?:eq)?ref\{/;

// Patterns for matching LaTeX in HTML (may contain <br>, &nbsp;, etc.)
const LATEX_PATTERNS: Array<{ regex: RegExp; display: 'inline' | 'block' }> = [
    // Display: \[...\] (may span multiple lines with <br>)
    { regex: /\\\[[\s\S]*?\\\]/g, display: 'block' },
    // Display: $$...$$ (may span multiple lines with <br>)
    { regex: /\$\$([\s\S]*?)\$\$/g, display: 'block' },
    // Block: \begin{...}...\end{...} (may span multiple lines with <br>)
    { regex: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, display: 'block' },
    // Inline: \(...\) (typically single line but support multi)
    { regex: /\\\([\s\S]*?\\\)/g, display: 'inline' },
    // Bare \ref{...} and \eqref{...} - used in text mode to reference equations
    { regex: /\\(?:eq)?ref\{[^}]+\}/g, display: 'inline' },
];

// Patterns for numbered equation environments (define labels, must be processed first)
const NUMBERED_EQUATION_ENVS = new Set(['equation', 'align', 'gather', 'multline', 'flalign', 'alignat', 'eqnarray']);

// Tags that should skip LaTeX processing
const SKIP_CONTENT_TAGS = new Set(['script', 'style', 'code', 'pre', 'textarea', 'noscript']);

// XOR encryption key (same as common.js)
const ENCRYPT_KEY = 146;

/**
 * Decrypt XOR-encoded string (matches common.js helpers.decrypt)
 */
function decrypt(str: string): string {
    if (!str || str === 'undefined' || str === 'null') return '';
    try {
        const decoded = unescape(str);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(ENCRYPT_KEY ^ decoded.charCodeAt(i));
        }
        return result;
    } catch {
        return '';
    }
}

/**
 * Encrypt string with XOR (matches common.js helpers.encrypt)
 */
function encrypt(str: string): string {
    if (!str) return '';
    try {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPT_KEY);
        }
        return escape(result);
    } catch {
        return '';
    }
}

/**
 * Clean LaTeX string by removing HTML tags and decoding entities
 */
function cleanLatexFromHtml(latexWithHtml: string): string {
    // Remove <br> tags - replace with newlines
    let clean = latexWithHtml.replace(/<br\s*\/?>/gi, '\n');
    // Remove any other HTML tags
    clean = clean.replace(/<[^>]+>/g, '');
    // Decode common HTML entities
    clean = clean
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
        .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
    return clean;
}

/**
 * Clean LaTeX string by removing delimiters
 */
function cleanLatexDelimiters(latex: string): string {
    if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
        return latex.slice(2, -2);
    }
    if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
        return latex.slice(2, -2);
    }
    if (latex.startsWith('$$') && latex.endsWith('$$')) {
        return latex.slice(2, -2);
    }
    if (latex.startsWith('$') && latex.endsWith('$')) {
        return latex.slice(1, -1);
    }
    return latex;
}

/**
 * Escape HTML special characters for use in attributes
 */
function escapeHtmlAttribute(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Check if a position in HTML is inside an attribute value or skip element
 */
function shouldSkipPosition(html: string, position: number): boolean {
    let inTag = false;
    let inAttrValue = false;
    let attrQuoteChar: string | null = null;
    const skipElementStack: string[] = [];
    let renderedSpanDepth = 0;

    for (let i = 0; i < position; i++) {
        const char = html[i];

        if (!inTag && char === '<') {
            inTag = true;
            inAttrValue = false;
            attrQuoteChar = null;

            let j = i + 1;
            let isClosing = false;
            if (html[j] === '/') {
                isClosing = true;
                j++;
            }

            let tagName = '';
            while (j < html.length && /[a-zA-Z0-9]/.test(html[j])) {
                tagName += html[j].toLowerCase();
                j++;
            }

            if (tagName && SKIP_CONTENT_TAGS.has(tagName)) {
                if (isClosing) {
                    if (skipElementStack.length > 0 && skipElementStack[skipElementStack.length - 1] === tagName) {
                        skipElementStack.pop();
                    }
                } else {
                    skipElementStack.push(tagName);
                }
            }

            // Skip content inside already pre-rendered wrappers so we don't double-process
            if (tagName === 'span') {
                if (isClosing) {
                    if (renderedSpanDepth > 0) {
                        renderedSpanDepth--;
                    }
                } else {
                    const tagEnd = html.indexOf('>', i);
                    if (tagEnd !== -1) {
                        const tagContent = html.substring(i, tagEnd + 1);
                        if (/class\s*=\s*["'][^"']*\bexe-math-rendered\b[^"']*["']/i.test(tagContent)) {
                            renderedSpanDepth++;
                        }
                    }
                }
            }
        } else if (inTag && !inAttrValue && char === '>') {
            inTag = false;
        } else if (inTag && !inAttrValue && char === '=' && i + 1 < html.length) {
            const nextChar = html[i + 1];
            if (nextChar === '"' || nextChar === "'") {
                inAttrValue = true;
                attrQuoteChar = nextChar;
                i++;
            }
        } else if (inAttrValue && char === attrQuoteChar) {
            inAttrValue = false;
            attrQuoteChar = null;
        }
    }

    return inAttrValue || skipElementStack.length > 0 || renderedSpanDepth > 0;
}

/**
 * Check if LaTeX is a numbered equation environment
 */
function isNumberedEquationEnv(latex: string): boolean {
    const clean = cleanLatexFromHtml(latex);
    const match = clean.match(/\\begin\{([^}*]+)(\*)?\}/);
    if (!match) return false;
    const envName = match[1];
    const isStarred = match[2] === '*';
    return NUMBERED_EQUATION_ENVS.has(envName) && !isStarred;
}

/**
 * Check if LaTeX contains a reference (\ref or \eqref)
 */
function containsReference(latex: string): boolean {
    const clean = cleanLatexFromHtml(latex);
    return /\\(?:eq)?ref\{[^}]+\}/.test(clean);
}

interface LatexMatch {
    matchWithHtml: string;
    start: number;
    end: number;
    display: 'inline' | 'block';
    isNumberedEquation?: boolean;
    hasReference?: boolean;
    rendered?: string;
}

/**
 * Server-side LaTeX Pre-renderer using MathJax v3 Node.js API
 */
export class ServerLatexPreRenderer implements ServerLatexPreRendererInterface {
    private adaptor: ReturnType<typeof liteAdaptor>;
    private tex: InstanceType<typeof TeX<unknown, unknown, unknown>>;
    private svg: InstanceType<typeof SVG<unknown, unknown, unknown>>;
    private htmlDoc: ReturnType<typeof mathjax.document>;

    constructor() {
        // Create adaptor for Node.js (no DOM)
        this.adaptor = liteAdaptor();
        RegisterHTMLHandler(this.adaptor);

        // Create TeX input processor with all packages
        this.tex = new TeX({
            packages: AllPackages,
            // Enable equation numbering and tagging
            tags: 'ams',
        });

        // Create SVG output processor
        this.svg = new SVG({
            fontCache: 'local',
        });

        // Create document for processing
        this.htmlDoc = mathjax.document('', {
            InputJax: this.tex,
            OutputJax: this.svg,
        });
    }

    /**
     * Check if HTML contains LaTeX expressions
     */
    hasLatex(html: string): boolean {
        return !!(html && HAS_LATEX_PATTERN.test(html));
    }

    /**
     * Render a single LaTeX expression to SVG+MathML
     */
    private renderLatexExpression(latex: string, display: 'inline' | 'block'): { svg: string; mathml: string } {
        const cleanLatex = cleanLatexDelimiters(latex);

        try {
            // Reset the document for fresh rendering
            this.htmlDoc.clear();

            // Convert to MathML first for accessibility
            const node = this.htmlDoc.convert(cleanLatex, { display: display === 'block' });

            // Get SVG output
            const svgOutput = this.adaptor.outerHTML(node);

            // Extract just the SVG element from the wrapper
            const svgMatch = svgOutput.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
            const svgHtml = svgMatch ? svgMatch[0] : '';

            // Generate MathML using tex2mml
            let mathmlHtml = '';
            try {
                const mmlNode = this.htmlDoc.convert(cleanLatex, {
                    display: display === 'block',
                    em: 16,
                    ex: 8,
                    containerWidth: 80 * 16,
                });
                // Try to extract MathML from assistive-mml if present
                const assistiveMml = this.adaptor.innerHTML(mmlNode);
                const mathMatch = assistiveMml.match(/<math[^>]*>[\s\S]*?<\/math>/i);
                if (mathMatch) {
                    mathmlHtml = mathMatch[0];
                }
            } catch {
                // MathML generation failed, continue without it
            }

            return { svg: svgHtml, mathml: mathmlHtml };
        } catch (error) {
            console.error('[ServerLatexPreRenderer] Render error:', error);
            throw error;
        }
    }

    /**
     * Create the rendered wrapper HTML string
     */
    private createRenderedWrapperHtml(
        _originalLatex: string,
        cleanLatex: string,
        display: 'inline' | 'block',
        svg: string,
        mathml: string,
    ): string {
        const displayAttr = display === 'block' ? ' data-display="block"' : '';
        const inner = svg + (mathml || '');
        return `<span class="exe-math-rendered" data-latex="${escapeHtmlAttribute(cleanLatex)}"${displayAttr}>${inner}</span>`;
    }

    /**
     * Pre-render all LaTeX expressions in HTML
     */
    async preRender(html: string): Promise<LatexPreRenderResult> {
        // Quick check: any LaTeX at all?
        if (!html || !HAS_LATEX_PATTERN.test(html)) {
            return {
                html,
                hasLatex: false,
                latexRendered: false,
                count: 0,
            };
        }

        // Collect all matches
        const allMatches: LatexMatch[] = [];
        const formattingTagPattern = /<(strong|em|b|i|u|mark|s|del|ins|sub|sup)\b[^>]*>/i;

        for (const pattern of LATEX_PATTERNS) {
            pattern.regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.regex.exec(html)) !== null) {
                if (shouldSkipPosition(html, match.index)) {
                    continue;
                }
                if (formattingTagPattern.test(match[0])) {
                    continue;
                }
                allMatches.push({
                    matchWithHtml: match[0],
                    start: match.index,
                    end: match.index + match[0].length,
                    display: pattern.display,
                });
            }
        }

        if (allMatches.length === 0) {
            return {
                html,
                hasLatex: true,
                latexRendered: false,
                count: 0,
            };
        }

        // Sort by start position
        allMatches.sort((a, b) => a.start - b.start);

        // Remove overlapping matches
        const filteredMatches: LatexMatch[] = [];
        let lastEnd = -1;
        for (const m of allMatches) {
            if (m.start >= lastEnd) {
                filteredMatches.push(m);
                lastEnd = m.end;
            }
        }

        if (filteredMatches.length === 0) {
            return {
                html,
                hasLatex: true,
                latexRendered: false,
                count: 0,
            };
        }

        // Classify each match
        for (const m of filteredMatches) {
            m.isNumberedEquation = isNumberedEquationEnv(m.matchWithHtml);
            m.hasReference = containsReference(m.matchWithHtml);
        }

        // Separate matches by type for phased rendering
        const equations = filteredMatches.filter(m => m.isNumberedEquation);
        const withReferences = filteredMatches.filter(m => m.hasReference && !m.isNumberedEquation);
        const others = filteredMatches.filter(m => !m.isNumberedEquation && !m.hasReference);

        let totalReplaced = 0;
        let totalErrors = 0;

        // Reset equation numbering
        this.tex.parseOptions.tags.reset?.();

        // PHASE 1: Render numbered equations first (registers labels)
        for (const m of equations) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = this.renderLatexExpression(cleanLatex, m.display);
                m.rendered = this.createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[ServerLatexPreRenderer] Failed to render equation:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // PHASE 2: Render expressions with references
        for (const m of withReferences) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = this.renderLatexExpression(cleanLatex, m.display);
                m.rendered = this.createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[ServerLatexPreRenderer] Failed to render reference:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // PHASE 3: Render other LaTeX
        for (const m of others) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = this.renderLatexExpression(cleanLatex, m.display);
                m.rendered = this.createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[ServerLatexPreRenderer] Failed to render:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // Build new HTML with replacements
        let newHtml = '';
        let lastIndex = 0;
        for (const m of filteredMatches) {
            newHtml += html.slice(lastIndex, m.start);
            newHtml += m.rendered;
            lastIndex = m.end;
        }
        newHtml += html.slice(lastIndex);

        return {
            html: newHtml,
            hasLatex: true,
            latexRendered: totalReplaced > 0,
            count: totalReplaced,
        };
    }

    /**
     * Pre-render a single string value (for JSON properties)
     */
    private async preRenderString(text: string): Promise<string> {
        if (!text || typeof text !== 'string' || !this.hasLatex(text)) {
            return text;
        }

        const result = await this.preRender(text);
        return result.html;
    }

    /**
     * Recursively process game data, pre-rendering LaTeX in string fields
     */
    private async preRenderLatexInGameData(data: unknown): Promise<unknown> {
        if (typeof data === 'string') {
            return await this.preRenderString(data);
        }
        if (Array.isArray(data)) {
            const result: unknown[] = [];
            for (const item of data) {
                result.push(await this.preRenderLatexInGameData(item));
            }
            return result;
        }
        if (typeof data === 'object' && data !== null) {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = await this.preRenderLatexInGameData(value);
            }
            return result;
        }
        return data;
    }

    /**
     * Pre-render LaTeX inside encrypted DataGame divs
     */
    async preRenderDataGameLatex(html: string): Promise<{ html: string; count: number }> {
        if (!html || typeof html !== 'string') {
            return { html, count: 0 };
        }

        // Find all DataGame divs
        const dataGamePattern = /<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        const matches = [...html.matchAll(dataGamePattern)];

        if (matches.length === 0) {
            return { html, count: 0 };
        }

        let result = html;
        let totalCount = 0;

        for (const match of matches) {
            const fullMatch = match[0];
            const encryptedContent = match[1].trim();

            if (!encryptedContent) continue;

            // Decrypt the content
            const decrypted = decrypt(encryptedContent);

            // Quick check for LaTeX
            if (!this.hasLatex(decrypted)) continue;

            try {
                // Parse JSON
                const data = JSON.parse(decrypted);

                // Pre-render LaTeX in all string fields
                const processedData = await this.preRenderLatexInGameData(data);

                // Re-encrypt
                const newEncrypted = encrypt(JSON.stringify(processedData));

                // Replace in HTML
                const newDiv = fullMatch.replace(encryptedContent, newEncrypted);
                result = result.replace(fullMatch, newDiv);

                totalCount++;
            } catch (error) {
                console.warn('[ServerLatexPreRenderer] Failed to process DataGame:', error);
            }
        }

        return { html: result, count: totalCount };
    }
}
