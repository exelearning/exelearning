/**
 * LatexPreRenderer
 *
 * Pre-renders LaTeX expressions to SVG+MathML using MathJax (already loaded in workarea).
 * This allows exports to include pre-rendered math without bundling MathJax (~1MB).
 *
 * Output format:
 * <span class="exe-math-rendered" data-latex="\frac{1}{2}" data-display="inline|block">
 *   <svg>...</svg>
 *   <math>...</math>
 * </span>
 *
 * IMPORTANT: This implementation handles LaTeX that may span across <br> tags
 * by processing innerHTML of container elements, not just text nodes.
 */
(function (global) {
    'use strict';

    // LaTeX detection patterns (for hasLatex quick check)
    const HAS_LATEX_PATTERN = /\\\(|\\\[|\$\$|\\begin\{|\\(?:eq)?ref\{/;

    // Patterns for matching LaTeX in innerHTML (may contain <br>, &nbsp;, etc.)
    const LATEX_PATTERNS = [
        // Display: \[...\] (may span multiple lines with <br>)
        { regex: /\\\[[\s\S]*?\\\]/g, display: 'block' },
        // Display: $$...$$ (may span multiple lines with <br>)
        { regex: /\$\$([\s\S]*?)\$\$/g, display: 'block' },
        // Block: \begin{...}...\end{...} (may span multiple lines with <br>)
        { regex: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, display: 'block' },
        // Inline: \(...\) (typically single line but support multi)
        { regex: /\\\([\s\S]*?\\\)/g, display: 'inline' },
        // Bare \ref{...} and \eqref{...} - used in text mode to reference equations
        // These should be rendered as inline math to resolve the reference number
        { regex: /\\(?:eq)?ref\{[^}]+\}/g, display: 'inline' },
    ];

    // Elements that should be processed for multiline LaTeX
    // Note: Only BLOCK-level containers are included here. Inline elements like <span>, <a>, <strong>
    // are NOT included because they shouldn't prevent innerHTML processing of their parent.
    // If a <p> contains a <span> + text with LaTeX, we want to process the <p>'s innerHTML directly.
    const CONTAINER_ELEMENTS = new Set(['p', 'div', 'td', 'th', 'li', 'article', 'section', 'main', 'aside', 'header', 'footer', 'blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

    // Elements to skip entirely
    const SKIP_ELEMENTS = new Set(['script', 'style', 'textarea', 'code', 'pre', 'noscript', 'svg', 'math']);

    // Patterns for numbered equation environments (define labels, must be processed first)
    // These create equation numbers and register \label{} for later \ref{} resolution
    const NUMBERED_EQUATION_ENVS = new Set([
        'equation', 'align', 'gather', 'multline', 'flalign', 'alignat',
        'eqnarray', // legacy
    ]);

    // Pattern to detect references that need labels to be defined first
    const REFERENCE_PATTERN = /\\(?:eq)?ref\{[^}]+\}/g;

    /**
     * Check if LaTeX is a numbered equation environment
     * Starred versions (equation*, align*, etc.) are unnumbered
     * @param {string} latex - LaTeX string (may contain HTML)
     * @returns {boolean}
     */
    function isNumberedEquationEnv(latex) {
        // Clean HTML first
        const clean = cleanLatexFromHtml(latex);
        const match = clean.match(/\\begin\{([^}*]+)(\*)?\}/);
        if (!match) return false;
        const envName = match[1];
        const isStarred = match[2] === '*';
        // Starred versions (*) are unnumbered
        return NUMBERED_EQUATION_ENVS.has(envName) && !isStarred;
    }

    /**
     * Check if LaTeX contains a reference (\ref or \eqref)
     * @param {string} latex - LaTeX string (may contain HTML)
     * @returns {boolean}
     */
    function containsReference(latex) {
        const clean = cleanLatexFromHtml(latex);
        return /\\(?:eq)?ref\{[^}]+\}/.test(clean);
    }

    /**
     * Check if HTML contains LaTeX expressions
     * @param {string} html - HTML content
     * @returns {boolean}
     */
    function hasLatex(html) {
        return !!(html && HAS_LATEX_PATTERN.test(html));
    }

    /**
     * Clean LaTeX string by removing HTML tags and decoding entities
     * This handles LaTeX that spans across <br> tags
     * @param {string} latexWithHtml - LaTeX that may contain <br>, &nbsp;, etc.
     * @returns {string} Clean LaTeX for MathJax
     */
    function cleanLatexFromHtml(latexWithHtml) {
        // Remove <br> tags (with optional attributes/self-closing) - replace with newlines
        let clean = latexWithHtml.replace(/<br\s*\/?>/gi, '\n');

        // Remove any other HTML tags FIRST (before decoding entities)
        // This prevents decoded < and > from being mistaken for tags
        clean = clean.replace(/<[^>]+>/g, '');

        // Decode common HTML entities AFTER removing tags
        clean = clean
            .replace(/&nbsp;/gi, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
            .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

        return clean;
    }

    /**
     * Clean LaTeX string by removing delimiters
     * @param {string} latex - Raw LaTeX with delimiters
     * @returns {string} Clean LaTeX without delimiters
     */
    function cleanLatexDelimiters(latex) {
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
        // For \begin...\end, keep as-is (MathJax handles it)
        return latex;
    }

    /**
     * Escape HTML special characters for use in attributes
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtmlAttribute(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Elements whose content should not be processed for LaTeX
     * (in addition to SKIP_ELEMENTS which handles DOM traversal)
     */
    const SKIP_CONTENT_TAGS = new Set(['script', 'style', 'code', 'pre', 'textarea', 'noscript']);

    /**
     * Pattern to detect <span style="...color:..."> which indicates example code
     * Users show LaTeX examples in colored spans, while using \color{} for actual colored math
     */
    const COLORED_SPAN_PATTERN = /<span\s+[^>]*style\s*=\s*["'][^"']*color\s*:/i;

    /**
     * Check if a position in HTML is inside an attribute value, skip element, or colored span
     * This prevents processing LaTeX that appears in:
     * - title="...", data-*="...", etc.
     * - <script>...</script>, <code>...</code>, <pre>...</pre>, etc.
     * - <span style="color:...">...</span> (example code shown in color)
     * @param {string} html - The HTML string
     * @param {number} position - Position to check
     * @returns {boolean} True if position should be skipped
     */
    function shouldSkipPosition(html, position) {
        let inTag = false;
        let inAttrValue = false;
        let attrQuoteChar = null;
        let skipElementStack = []; // Stack of skip element names we're inside
        let coloredSpanDepth = 0; // Track nested colored spans

        for (let i = 0; i < position; i++) {
            const char = html[i];

            if (!inTag && char === '<') {
                // Starting a tag - check if it's an opening or closing tag
                inTag = true;
                inAttrValue = false;
                attrQuoteChar = null;

                // Look ahead to get the tag name and check for colored span
                let j = i + 1;
                let isClosing = false;
                if (html[j] === '/') {
                    isClosing = true;
                    j++;
                }

                // Extract tag name
                let tagName = '';
                while (j < html.length && /[a-zA-Z0-9]/.test(html[j])) {
                    tagName += html[j].toLowerCase();
                    j++;
                }

                if (tagName && SKIP_CONTENT_TAGS.has(tagName)) {
                    if (isClosing) {
                        // Closing tag - pop from stack if it matches
                        if (skipElementStack.length > 0 && skipElementStack[skipElementStack.length - 1] === tagName) {
                            skipElementStack.pop();
                        }
                    } else {
                        // Opening tag - push to stack
                        skipElementStack.push(tagName);
                    }
                }

                // Check for colored span (span with style containing color:)
                if (tagName === 'span') {
                    if (isClosing) {
                        if (coloredSpanDepth > 0) {
                            coloredSpanDepth--;
                        }
                    } else {
                        // Find the end of this tag to check for style="...color:..."
                        let tagEnd = html.indexOf('>', i);
                        if (tagEnd !== -1) {
                            const tagContent = html.substring(i, tagEnd + 1);
                            if (/style\s*=\s*["'][^"']*color\s*:/i.test(tagContent)) {
                                coloredSpanDepth++;
                            }
                        }
                    }
                }
            } else if (inTag && !inAttrValue && char === '>') {
                // Ending a tag
                inTag = false;
            } else if (inTag && !inAttrValue && char === '=' && i + 1 < html.length) {
                // Found = in tag, check for quote
                const nextChar = html[i + 1];
                if (nextChar === '"' || nextChar === "'") {
                    inAttrValue = true;
                    attrQuoteChar = nextChar;
                    i++; // Skip the quote
                }
            } else if (inAttrValue && char === attrQuoteChar) {
                // Closing quote for attribute value
                inAttrValue = false;
                attrQuoteChar = null;
            }
        }

        // Skip if inside attribute value, skip element, OR colored span
        return inAttrValue || skipElementStack.length > 0 || coloredSpanDepth > 0;
    }

    /**
     * Render a single LaTeX expression using MathJax
     * Uses async API (tex2svgPromise) when available to support extensions like \color
     * @param {string} latex - LaTeX expression (with or without delimiters, already cleaned from HTML)
     * @param {string} display - 'inline' or 'block'
     * @returns {Promise<{ svg: string, mathml: string }>} Rendered content
     */
    async function renderLatexExpression(latex, display) {
        if (typeof MathJax === 'undefined' || !MathJax.tex2svg) {
            throw new Error('MathJax tex2svg not available');
        }

        const cleanLatex = cleanLatexDelimiters(latex);

        try {
            // Use async API if available (handles extensions like \color that need loading)
            let node;
            if (MathJax.tex2svgPromise) {
                node = await MathJax.tex2svgPromise(cleanLatex, {
                    display: display === 'block',
                });
            } else {
                // Fall back to sync API
                node = MathJax.tex2svg(cleanLatex, {
                    display: display === 'block',
                });
            }

            // Extract SVG
            const svg = node.querySelector('svg');
            const svgHtml = svg ? svg.outerHTML : '';

            // Extract MathML from mjx-assistive-mml if present
            const assistiveMml = node.querySelector('mjx-assistive-mml math');
            let mathmlHtml = '';
            if (assistiveMml) {
                mathmlHtml = assistiveMml.outerHTML;
            } else if (MathJax.tex2mml) {
                // Generate MathML using tex2mml if available
                try {
                    mathmlHtml = MathJax.tex2mml(cleanLatex, {
                        display: display === 'block',
                    });
                } catch (e) {
                    console.warn('[LatexPreRenderer] Could not generate MathML:', e);
                }
            }

            return { svg: svgHtml, mathml: mathmlHtml };
        } catch (error) {
            console.error('[LatexPreRenderer] Render error:', error);
            throw error;
        }
    }

    /**
     * Create the rendered wrapper HTML string
     * @param {string} originalLatex - Original LaTeX (may contain HTML like <br>)
     * @param {string} cleanLatex - Clean LaTeX for data-latex attribute
     * @param {string} display - 'inline' or 'block'
     * @param {string} svg - SVG HTML string
     * @param {string} mathml - MathML HTML string
     * @returns {string} Wrapper span HTML
     */
    function createRenderedWrapperHtml(originalLatex, cleanLatex, display, svg, mathml) {
        const displayAttr = display === 'block' ? ' data-display="block"' : '';
        const inner = svg + (mathml || '');
        return `<span class="exe-math-rendered" data-latex="${escapeHtmlAttribute(cleanLatex)}"${displayAttr}>${inner}</span>`;
    }

    /**
     * Process innerHTML of an element to find and render LaTeX
     * This handles LaTeX that spans across <br> tags
     * @param {Element} element - Element to process
     * @returns {Promise<{ replaced: number, errors: number }>}
     */
    async function processElementInnerHtml(element) {
        let innerHTML = element.innerHTML;

        // Quick check
        if (!HAS_LATEX_PATTERN.test(innerHTML)) {
            return { replaced: 0, errors: 0 };
        }

        // First pass: find ALL matches from all patterns before any replacements
        // This prevents patterns from incorrectly matching already-rendered content
        const allMatches = [];

        // HTML formatting tags that indicate the content is example code, not LaTeX to render
        // If LaTeX contains these tags, it's likely showing LaTeX syntax as an example
        const FORMATTING_TAG_PATTERN = /<(strong|em|b|i|u|mark|s|del|ins|sub|sup)\b[^>]*>/i;

        for (const pattern of LATEX_PATTERNS) {
            pattern.regex.lastIndex = 0;
            let match;
            while ((match = pattern.regex.exec(innerHTML)) !== null) {
                // Skip matches inside attributes or skip elements (script, code, pre, etc.)
                if (shouldSkipPosition(innerHTML, match.index)) {
                    continue;
                }

                // Skip matches that contain HTML formatting tags (indicates example code, not real LaTeX)
                // e.g., "\( \dfrac{x}{y} = <strong>\boxed</strong>{...} \)" is showing LaTeX syntax
                if (FORMATTING_TAG_PATTERN.test(match[0])) {
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
            return { replaced: 0, errors: 0 };
        }

        // Sort by start position
        allMatches.sort((a, b) => a.start - b.start);

        // Remove overlapping matches (keep first/longest at each position)
        const filteredMatches = [];
        let lastEnd = -1;
        for (const m of allMatches) {
            if (m.start >= lastEnd) {
                filteredMatches.push(m);
                lastEnd = m.end;
            }
        }

        if (filteredMatches.length === 0) {
            return { replaced: 0, errors: 0 };
        }

        // Classify each match for two-phase rendering
        // Numbered equations must be rendered FIRST to register labels
        // Then references can resolve those labels
        for (const m of filteredMatches) {
            m.isNumberedEquation = isNumberedEquationEnv(m.matchWithHtml);
            m.hasReference = containsReference(m.matchWithHtml);
        }

        // Separate matches by type
        const equations = filteredMatches.filter(m => m.isNumberedEquation);
        const withReferences = filteredMatches.filter(m => m.hasReference && !m.isNumberedEquation);
        const others = filteredMatches.filter(m => !m.isNumberedEquation && !m.hasReference);

        let totalReplaced = 0;
        let totalErrors = 0;

        // PHASE 1: Render ALL numbered equations first (registers labels in MathJax)
        for (const m of equations) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = await renderLatexExpression(cleanLatex, m.display);
                m.rendered = createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[LatexPreRenderer] Failed to render equation:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // PHASE 2: Render expressions with references (labels are now registered)
        for (const m of withReferences) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = await renderLatexExpression(cleanLatex, m.display);
                m.rendered = createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[LatexPreRenderer] Failed to render reference:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // PHASE 3: Render other LaTeX (inline math, etc.)
        for (const m of others) {
            const cleanLatex = cleanLatexFromHtml(m.matchWithHtml);
            try {
                const { svg, mathml } = await renderLatexExpression(cleanLatex, m.display);
                m.rendered = createRenderedWrapperHtml(m.matchWithHtml, cleanLatex, m.display, svg, mathml);
                totalReplaced++;
            } catch (error) {
                console.warn('[LatexPreRenderer] Failed to render:', cleanLatex, error);
                m.rendered = m.matchWithHtml;
                totalErrors++;
            }
        }

        // Build new innerHTML with replacements (must be in position order)
        let newHtml = '';
        let lastIndex = 0;

        for (const m of filteredMatches) {
            newHtml += innerHTML.slice(lastIndex, m.start);
            newHtml += m.rendered;
            lastIndex = m.end;
        }

        // Add remaining text after last match
        newHtml += innerHTML.slice(lastIndex);

        if (totalReplaced > 0) {
            element.innerHTML = newHtml;
        }

        return { replaced: totalReplaced, errors: totalErrors };
    }

    /**
     * Recursively process all elements in the DOM
     * Uses innerHTML approach for container elements to handle multiline LaTeX
     * @param {Node} node - Node to process
     * @param {Document} doc - Document for creating elements
     * @returns {Promise<{ replaced: number, errors: number }>}
     */
    async function processNode(node, doc) {
        let totalReplaced = 0;
        let totalErrors = 0;

        // Skip certain elements entirely
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            if (SKIP_ELEMENTS.has(tagName)) {
                return { replaced: 0, errors: 0 };
            }

            // Skip elements that already have rendered math
            if (node.classList && node.classList.contains('exe-math-rendered')) {
                return { replaced: 0, errors: 0 };
            }

            // For container elements, check if they have LaTeX and no nested containers
            // If so, process innerHTML directly (handles <br> in LaTeX)
            if (CONTAINER_ELEMENTS.has(tagName)) {
                const innerHTML = node.innerHTML;

                if (HAS_LATEX_PATTERN.test(innerHTML)) {
                    // Check if this element has nested container elements
                    const hasNestedContainers = Array.from(node.children).some(
                        child => CONTAINER_ELEMENTS.has(child.tagName.toLowerCase())
                    );

                    if (!hasNestedContainers) {
                        // Process innerHTML directly (handles multiline LaTeX)
                        const result = await processElementInnerHtml(node);
                        return { replaced: result.replaced, errors: result.errors };
                    }
                }
            }
        }

        // For non-container elements or containers with nested containers,
        // recursively process children
        const children = Array.from(node.childNodes);
        for (const child of children) {
            const result = await processNode(child, doc);
            totalReplaced += result.replaced;
            totalErrors += result.errors;
        }

        return { replaced: totalReplaced, errors: totalErrors };
    }

    /**
     * Elements whose content should be preserved from DOMParser
     * DOMParser can corrupt content inside these (e.g., <link> tags inside <code> blocks)
     */
    const PRESERVE_CONTENT_TAGS = ['script', 'style', 'code', 'pre', 'textarea', 'noscript'];

    /**
     * Extract and preserve content from skip elements before DOMParser
     * This prevents DOMParser from corrupting content like <link> or <script> inside <code> blocks
     * @param {string} html - HTML to process
     * @returns {{ html: string, preserved: Map<string, string> }}
     */
    function preserveSkipElementContent(html) {
        const preserved = new Map();
        let counter = 0;
        let result = html;

        for (const tagName of PRESERVE_CONTENT_TAGS) {
            // Match opening tag, content, and closing tag
            // Use non-greedy match and handle nested tags by matching from outermost
            const pattern = new RegExp(
                `(<${tagName}\\b[^>]*>)([\\s\\S]*?)(<\\/${tagName}>)`,
                'gi'
            );

            result = result.replace(pattern, (match, openTag, content, closeTag) => {
                // Only preserve if content might be corrupted by DOMParser
                // Check for HTML-like content that could be misinterpreted
                if (content.includes('<') && (
                    content.includes('<link') ||
                    content.includes('<script') ||
                    content.includes('<style') ||
                    content.includes('<meta') ||
                    content.includes('<base')
                )) {
                    const placeholder = `__LATEX_PRESERVE_${counter}__`;
                    preserved.set(placeholder, content);
                    counter++;
                    return openTag + placeholder + closeTag;
                }
                return match;
            });
        }

        return { html: result, preserved };
    }

    /**
     * Restore preserved content after processing
     * @param {string} html - Processed HTML with placeholders
     * @param {Map<string, string>} preserved - Map of placeholders to original content
     * @returns {string}
     */
    function restorePreservedContent(html, preserved) {
        let result = html;
        for (const [placeholder, content] of preserved) {
            result = result.replace(placeholder, content);
        }
        return result;
    }

    /**
     * Check if LaTeX is a numbered equation environment (defines labels)
     * @param {string} latex - LaTeX expression
     * @returns {boolean}
     */
    function isNumberedEquation(latex) {
        const envMatch = latex.match(/\\begin\{([^}*]+)\*?\}/);
        if (!envMatch) return false;
        const envName = envMatch[1].replace('*', ''); // Remove * for unnumbered variants
        return NUMBERED_EQUATION_ENVS.has(envName) && !envMatch[1].endsWith('*');
    }

    /**
     * Check if LaTeX contains a reference (\ref or \eqref)
     * @param {string} latex - LaTeX expression
     * @returns {boolean}
     */
    function containsReference(latex) {
        return REFERENCE_PATTERN.test(latex);
    }

    /**
     * Process a single iDevice element with proper equation numbering
     * Renders numbered equations first (to register labels), then other content
     * @param {Element} idevice - The iDevice DOM element
     * @param {Document} doc - The document
     * @returns {Promise<{replaced: number, errors: number}>}
     */
    async function processIdeviceWithNumbering(idevice, doc) {
        // Reset MathJax equation counter for this iDevice
        if (typeof MathJax !== 'undefined' && typeof MathJax.texReset === 'function') {
            MathJax.texReset();
        }

        // Process using the standard processNode - it handles innerHTML correctly
        // MathJax maintains label state between consecutive tex2svg calls
        // so \ref{} can resolve labels defined in earlier equations
        return await processNode(idevice, doc);
    }

    /**
     * Pre-render LaTeX per iDevice to maintain proper equation numbering
     * Each iDevice gets its own equation numbering scope (starting from 1)
     * @param {string} html - Full HTML with multiple iDevices
     * @param {Map<string, string>} preserved - Preserved content map
     * @returns {Promise<{html: string, hasLatex: boolean, latexRendered: boolean, count: number}>}
     */
    async function preRenderPerIdevice(html, preserved) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find all iDevice containers
        const idevices = doc.querySelectorAll('.idevice_node');
        let totalReplaced = 0;
        let totalErrors = 0;

        // Process each iDevice with its own equation numbering scope
        for (const idevice of idevices) {
            const result = await processIdeviceWithNumbering(idevice, doc);
            totalReplaced += result.replaced;
            totalErrors += result.errors;
        }

        // Also process content outside iDevices (navigation, headers, etc.)
        // These don't have equation numbering - reset before processing
        if (typeof MathJax !== 'undefined' && typeof MathJax.texReset === 'function') {
            MathJax.texReset();
        }

        // Find and process elements that are NOT inside an iDevice
        const allContainers = doc.body.querySelectorAll(
            Array.from(CONTAINER_ELEMENTS).join(',')
        );
        for (const container of allContainers) {
            // Skip if inside an iDevice (already processed)
            if (container.closest('.idevice_node')) continue;
            // Skip if already has rendered math
            if (container.querySelector('.exe-math-rendered')) continue;

            const result = await processNode(container, doc);
            totalReplaced += result.replaced;
            totalErrors += result.errors;
        }

        if (totalReplaced === 0) {
            return {
                html: html.includes('idevice_node') ? html : html,
                hasLatex: true,
                latexRendered: false,
                count: 0,
            };
        }

        // Serialize back to HTML
        let outputHtml;
        if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
            outputHtml = doc.documentElement.outerHTML;
            if (html.toLowerCase().includes('<!doctype')) {
                outputHtml = '<!DOCTYPE html>\n' + outputHtml;
            }
        } else {
            outputHtml = doc.body.innerHTML;
        }

        // Restore preserved content
        if (preserved && preserved.size > 0) {
            outputHtml = restorePreservedContent(outputHtml, preserved);
        }

        return {
            html: outputHtml,
            hasLatex: true,
            latexRendered: totalReplaced > 0,
            count: totalReplaced,
        };
    }

    /**
     * Main pre-render function using DOM parsing
     * @param {string} html - HTML content with LaTeX expressions
     * @returns {Promise<{html: string, hasLatex: boolean, latexRendered: boolean, count: number}>}
     */
    async function preRender(html) {
        // Quick check: any LaTeX at all?
        if (!html || !HAS_LATEX_PATTERN.test(html)) {
            return {
                html,
                hasLatex: false,
                latexRendered: false,
                count: 0,
            };
        }

        // Check MathJax availability
        if (typeof MathJax === 'undefined' || !MathJax.tex2svg) {
            console.warn('[LatexPreRenderer] MathJax not available, skipping pre-render');
            return {
                html,
                hasLatex: true,
                latexRendered: false,
                count: 0,
            };
        }

        // Preserve content in skip elements BEFORE DOMParser
        // This prevents DOMParser from corrupting content like <link> inside <code> blocks
        const { html: safeHtml, preserved } = preserveSkipElementContent(html);

        // Check if HTML has iDevice structure (preview mode with equation numbering scopes)
        // Use per-iDevice processing to reset equation numbers between iDevices
        if (safeHtml.includes('idevice_node')) {
            return await preRenderPerIdevice(safeHtml, preserved);
        }

        // Parse HTML into DOM (simple mode without iDevice scoping)
        const parser = new DOMParser();
        const doc = parser.parseFromString(safeHtml, 'text/html');

        // Process the document body
        const result = await processNode(doc.body, doc);

        if (result.replaced === 0) {
            return {
                html,
                hasLatex: true, // We detected LaTeX but couldn't render any
                latexRendered: false,
                count: 0,
            };
        }

        // Serialize back to HTML
        // Use innerHTML to get only the body content if the input was a fragment
        // Otherwise use the full document
        let outputHtml;
        if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
            // Full document - serialize entire document
            outputHtml = doc.documentElement.outerHTML;
            // Add doctype
            if (html.toLowerCase().includes('<!doctype')) {
                outputHtml = '<!DOCTYPE html>\n' + outputHtml;
            }
        } else {
            // Fragment - serialize just the body content
            outputHtml = doc.body.innerHTML;
        }

        // Restore preserved content that was protected from DOMParser
        if (preserved.size > 0) {
            outputHtml = restorePreservedContent(outputHtml, preserved);
        }

        return {
            html: outputHtml,
            hasLatex: true,
            latexRendered: result.replaced > 0,
            count: result.replaced,
        };
    }

    // =========================================================================
    // DataGame LaTeX Pre-rendering
    // Game iDevices store questions in encrypted JSON. We need to decrypt,
    // pre-render LaTeX to SVG, and re-encrypt before export.
    // =========================================================================

    /** XOR encryption key (same as common.js) */
    const ENCRYPT_KEY = 146;

    /**
     * Decrypt XOR-encoded string (matches common.js helpers.decrypt)
     * @param {string} str - Encrypted string
     * @returns {string} Decrypted string
     */
    function decrypt(str) {
        if (!str || str === 'undefined' || str === 'null') return '';
        try {
            str = unescape(str);
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(ENCRYPT_KEY ^ str.charCodeAt(i));
            }
            return result;
        } catch {
            return '';
        }
    }

    /**
     * Encrypt string with XOR (matches common.js helpers.encrypt)
     * @param {string} str - String to encrypt
     * @returns {string} Encrypted string
     */
    function encrypt(str) {
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
     * Pre-render LaTeX in a single string value
     * Returns HTML with <span class="exe-math-rendered"> wrappers
     * @param {string} text - Text that may contain LaTeX
     * @returns {Promise<string>} Text with pre-rendered LaTeX
     */
    async function preRenderString(text) {
        if (!text || typeof text !== 'string' || !hasLatex(text)) {
            return text;
        }

        let result = text;

        // Process each LaTeX pattern
        for (const pattern of LATEX_PATTERNS) {
            pattern.regex.lastIndex = 0;
            const matches = [...text.matchAll(pattern.regex)];

            for (const match of matches) {
                const latexWithDelimiters = match[0];
                const cleanLatex = cleanLatexFromHtml(latexWithDelimiters);

                try {
                    const { svg, mathml } = await renderLatexExpression(cleanLatex, pattern.display);
                    const rendered = createRenderedWrapperHtml(latexWithDelimiters, cleanLatex, pattern.display, svg, mathml);
                    result = result.replace(latexWithDelimiters, rendered);
                } catch (error) {
                    console.warn('[LatexPreRenderer] Failed to pre-render in game data:', cleanLatex, error);
                    // Keep original LaTeX on error
                }
            }
        }

        return result;
    }

    /**
     * Recursively process game data, pre-rendering LaTeX in string fields
     * @param {any} data - Game data (object, array, or primitive)
     * @returns {Promise<any>} Processed data with pre-rendered LaTeX
     */
    async function preRenderLatexInGameData(data) {
        if (typeof data === 'string') {
            return await preRenderString(data);
        }

        if (Array.isArray(data)) {
            const result = [];
            for (const item of data) {
                result.push(await preRenderLatexInGameData(item));
            }
            return result;
        }

        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = await preRenderLatexInGameData(value);
            }
            return result;
        }

        return data;
    }

    /**
     * Pre-render LaTeX inside encrypted DataGame divs
     * Called BEFORE the main preRender() to handle encrypted game data
     * @param {string} html - HTML containing DataGame divs
     * @returns {Promise<{html: string, count: number}>} HTML with pre-rendered LaTeX in DataGame
     */
    async function preRenderDataGameLatex(html) {
        if (!html || typeof html !== 'string') {
            return { html, count: 0 };
        }

        // Check MathJax availability
        if (typeof MathJax === 'undefined' || !MathJax.tex2svg) {
            return { html, count: 0 };
        }

        // Find all DataGame divs (various naming conventions)
        // quext-DataGame, DataGame, etc.
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
            if (!hasLatex(decrypted)) continue;

            try {
                // Parse JSON
                const data = JSON.parse(decrypted);

                // Pre-render LaTeX in all string fields
                const processedData = await preRenderLatexInGameData(data);

                // Re-encrypt
                const newEncrypted = encrypt(JSON.stringify(processedData));

                // Replace in HTML
                const newDiv = fullMatch.replace(encryptedContent, newEncrypted);
                result = result.replace(fullMatch, newDiv);

                totalCount++;
                console.log('[LatexPreRenderer] Pre-rendered LaTeX in DataGame');
            } catch (error) {
                console.warn('[LatexPreRenderer] Failed to process DataGame:', error);
                // Keep original on error
            }
        }

        return { html: result, count: totalCount };
    }

    /**
     * Extract LaTeX expressions from HTML (for testing)
     * @param {string} html - HTML content
     * @returns {{ html: string, expressions: Array<{placeholder: string, latex: string, display: string}> }}
     */
    function _extractLatexExpressions(html) {
        const expressions = [];
        let counter = 0;
        let processedHtml = html;

        for (const pattern of LATEX_PATTERNS) {
            pattern.regex.lastIndex = 0;
            processedHtml = processedHtml.replace(pattern.regex, (match) => {
                const placeholder = `<!--LATEX_PLACEHOLDER_${counter}-->`;
                expressions.push({
                    placeholder,
                    latex: match,
                    display: pattern.display,
                    original: match,
                });
                counter++;
                return placeholder;
            });
        }

        return { html: processedHtml, expressions };
    }

    // Public API
    const LatexPreRenderer = {
        preRender,
        preRenderDataGameLatex,
        hasLatex,
        // For testing
        _extractLatexExpressions,
        _renderLatexExpression: renderLatexExpression,
        _cleanLatexFromHtml: cleanLatexFromHtml,
        _decrypt: decrypt,
        _encrypt: encrypt,
    };

    // Expose to global/window
    if (typeof global !== 'undefined') {
        global.LatexPreRenderer = LatexPreRenderer;
    }
    if (typeof window !== 'undefined') {
        window.LatexPreRenderer = LatexPreRenderer;
    }

    // AMD support
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return LatexPreRenderer;
        });
    }

    // CommonJS support
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LatexPreRenderer;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
