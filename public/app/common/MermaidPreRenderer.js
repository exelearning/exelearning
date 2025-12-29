/**
 * MermaidPreRenderer
 *
 * Pre-renders Mermaid diagrams to SVG using Mermaid library (already loaded in workarea).
 * This allows exports to include pre-rendered diagrams without bundling Mermaid (~2.7MB).
 *
 * Output format:
 * <div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B">
 *   <svg>...rendered diagram...</svg>
 * </div>
 *
 * IMPORTANT: This is used during export/preview. The editor continues to use
 * runtime Mermaid rendering via common.js $exe.mermaid.
 */
(function (global) {
    'use strict';

    // Detection pattern for mermaid diagrams
    // Matches <pre class="mermaid">, <pre class="mermaid other">, <pre class="other mermaid">
    const HAS_MERMAID_PATTERN = /<pre\s+[^>]*class="[^"]*\bmermaid\b[^"]*"/i;

    /**
     * Check if an SVG has a broken viewBox (width or height = 0)
     * This happens when Mermaid renders while the element is hidden/has zero width
     * @param {Element} element - Element containing the SVG
     * @returns {boolean} True if SVG is broken
     */
    function hasBrokenSvg(element) {
        const svg = element.querySelector('svg');
        if (!svg) return false;

        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return false;

        // Parse viewBox: "minX minY width height"
        const parts = viewBox.trim().split(/\s+/);
        if (parts.length >= 4) {
            const width = parseFloat(parts[2]);
            const height = parseFloat(parts[3]);
            // If width or height is 0 or negative, the SVG is broken
            if (width <= 0 || height <= 0) {
                return true;
            }
        }

        // Also check for max-width: 0px style which indicates broken render
        const style = svg.getAttribute('style') || '';
        if (style.includes('max-width: 0px') || style.includes('max-width:0px')) {
            return true;
        }

        return false;
    }

    /**
     * Extract original Mermaid code from a processed element
     * When Mermaid renders, it replaces the text content with SVG.
     * We need to recover the original code from:
     * 1. Text nodes in the element (if any remain)
     * 2. The parent iDevice's JSON data (data-idevice-json-data attribute)
     * @param {Element} preElement - The pre.mermaid element
     * @param {Document} doc - The document for querying
     * @returns {string|null} Original mermaid code or null
     */
    function extractMermaidCode(preElement, doc) {
        // First try: get text nodes if any remain
        const textNodes = [];
        for (const child of preElement.childNodes) {
            if (child.nodeType === 3 /* TEXT_NODE */) {
                const text = child.textContent.trim();
                if (text) textNodes.push(text);
            }
        }
        if (textNodes.length > 0) {
            const code = textNodes.join('\n').trim();
            // Validate it looks like Mermaid code (not just whitespace or HTML)
            if (code.length > 5 && !code.startsWith('<')) {
                return code;
            }
        }

        // Second try: look for the code in the parent iDevice's JSON data
        // The iDevice stores original content in data-idevice-json-data
        const ideviceNode = preElement.closest('[data-idevice-json-data]');
        if (ideviceNode) {
            try {
                const jsonStr = ideviceNode.getAttribute('data-idevice-json-data');
                const jsonData = JSON.parse(jsonStr);
                // Look for fields that might contain mermaid code
                for (const [key, value] of Object.entries(jsonData)) {
                    if (typeof value === 'string' && value.includes('mermaid')) {
                        // Parse the HTML content to extract mermaid code properly
                        const tempDiv = doc.createElement('div');
                        tempDiv.innerHTML = value;
                        const mermaidPre = tempDiv.querySelector('pre.mermaid');
                        if (mermaidPre) {
                            const code = mermaidPre.textContent.trim();
                            if (code.length > 5) {
                                return code;
                            }
                        }
                    }
                }
            } catch (e) {
                // JSON parse failed, continue
                console.warn('[MermaidPreRenderer] Failed to parse idevice JSON:', e);
            }
        }

        // If element has no SVG, try getting text content directly
        if (!preElement.querySelector('svg')) {
            return preElement.textContent.trim();
        }

        return null;
    }

    // Counter for unique render IDs
    let renderCounter = 0;

    /**
     * Check if HTML contains Mermaid diagrams
     * @param {string} html - HTML content
     * @returns {boolean}
     */
    function hasMermaid(html) {
        return !!(html && HAS_MERMAID_PATTERN.test(html));
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
     * Load Mermaid library dynamically if not already loaded
     * @param {number} timeout - Timeout in ms (default 5000)
     * @returns {Promise<void>}
     */
    async function loadMermaidLibrary(timeout = 5000) {
        if (typeof mermaid !== 'undefined') {
            return; // Already loaded
        }

        // Skip in test environments without proper DOM
        if (typeof document === 'undefined' || !document.head) {
            throw new Error('Mermaid library could not be loaded (no DOM)');
        }

        // Determine the correct path for Mermaid library
        const isWorkarea = document.querySelector('html')?.id === 'exe-workarea';
        const mermaidPath = isWorkarea
            ? '../app/common/mermaid/mermaid.min.js'
            : './libs/mermaid/mermaid.min.js';

        console.log('[MermaidPreRenderer] Loading Mermaid library from:', mermaidPath);

        return new Promise((resolve, reject) => {
            // Add timeout to prevent hanging forever
            const timeoutId = setTimeout(() => {
                reject(new Error('Mermaid library load timeout'));
            }, timeout);

            const script = document.createElement('script');
            script.src = mermaidPath;
            script.async = true;
            script.onload = () => {
                clearTimeout(timeoutId);
                console.log('[MermaidPreRenderer] Mermaid library loaded successfully');
                resolve();
            };
            script.onerror = () => {
                // Try alternative path
                const altPath = isWorkarea
                    ? './libs/mermaid/mermaid.min.js'
                    : '../app/common/mermaid/mermaid.min.js';
                console.log('[MermaidPreRenderer] Trying alternative path:', altPath);

                const altScript = document.createElement('script');
                altScript.src = altPath;
                altScript.async = true;
                altScript.onload = () => {
                    clearTimeout(timeoutId);
                    console.log('[MermaidPreRenderer] Mermaid library loaded from alternative path');
                    resolve();
                };
                altScript.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Failed to load Mermaid library'));
                };
                document.head.appendChild(altScript);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize Mermaid for pre-rendering
     * Loads Mermaid dynamically if not available
     * @returns {Promise<void>}
     */
    async function initMermaid() {
        // Load Mermaid if not available
        if (typeof mermaid === 'undefined') {
            await loadMermaidLibrary();
        }

        if (typeof mermaid === 'undefined') {
            throw new Error('Mermaid library could not be loaded');
        }

        // Initialize with optimal settings for pre-rendering
        mermaid.initialize({
            startOnLoad: false,
            suppressErrorRendering: true,
            logLevel: 'fatal',
            securityLevel: 'loose', // Allow inline styles in SVG
            gantt: { useMaxWidth: true },
            flowchart: { useMaxWidth: true },
            sequence: { useMaxWidth: true },
            theme: 'default',
        });
    }

    /**
     * Render a single Mermaid diagram to SVG
     * @param {string} code - Mermaid diagram code
     * @returns {Promise<string>} SVG HTML string
     */
    async function renderMermaidToSvg(code) {
        if (typeof mermaid === 'undefined') {
            throw new Error('Mermaid library not loaded');
        }

        // Generate unique ID for this render
        const id = `mermaid-pre-render-${renderCounter++}`;

        try {
            // Use mermaid.render() API which returns { svg: string }
            const { svg } = await mermaid.render(id, code);
            return svg;
        } catch (error) {
            console.error('[MermaidPreRenderer] Render error:', error.message || error);
            throw error;
        }
    }

    /**
     * Create the rendered wrapper HTML
     * @param {string} originalCode - Original Mermaid code
     * @param {string} svg - SVG HTML string
     * @returns {string} Wrapper div HTML
     */
    function createRenderedWrapper(originalCode, svg) {
        const escapedCode = escapeHtmlAttribute(originalCode.trim());
        return `<div class="exe-mermaid-rendered" data-mermaid="${escapedCode}">${svg}</div>`;
    }

    /**
     * Process a single <pre class="mermaid"> element
     * @param {Element} preElement - The pre element to process
     * @param {Document} doc - The document
     * @returns {Promise<boolean>} True if successfully rendered
     */
    async function processMermaidElement(preElement, doc) {
        // Get the mermaid code (text content of the <pre>)
        const code = preElement.textContent.trim();

        if (!code) {
            console.warn('[MermaidPreRenderer] Empty mermaid code, skipping');
            return false;
        }

        try {
            // Render to SVG
            const svg = await renderMermaidToSvg(code);

            if (!svg) {
                console.warn('[MermaidPreRenderer] Empty SVG output, skipping');
                return false;
            }

            // Create the wrapper element
            const wrapper = doc.createElement('div');
            wrapper.className = 'exe-mermaid-rendered';
            wrapper.setAttribute('data-mermaid', code);
            wrapper.innerHTML = svg;

            // Replace the <pre> with the wrapper
            preElement.parentNode.replaceChild(wrapper, preElement);

            return true;
        } catch (error) {
            console.warn('[MermaidPreRenderer] Failed to render:', code.substring(0, 50) + '...', error);
            return false;
        }
    }

    /**
     * Pre-render all Mermaid diagrams in HTML string
     * @param {string} html - HTML content with <pre class="mermaid"> elements
     * @returns {Promise<{html: string, hasMermaid: boolean, mermaidRendered: boolean, count: number}>}
     */
    async function preRender(html) {
        // Quick check: any Mermaid at all?
        if (!html || !HAS_MERMAID_PATTERN.test(html)) {
            return {
                html,
                hasMermaid: false,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Initialize Mermaid for pre-rendering (will load dynamically if needed)
        try {
            await initMermaid();
        } catch (error) {
            console.warn('[MermaidPreRenderer] Failed to initialize Mermaid:', error);
            return {
                html,
                hasMermaid: true,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Parse HTML into DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find all <pre class="mermaid"> elements
        const mermaidElements = doc.querySelectorAll('pre.mermaid');

        if (mermaidElements.length === 0) {
            return {
                html,
                hasMermaid: false,
                mermaidRendered: false,
                count: 0,
            };
        }

        let renderedCount = 0;
        let errorCount = 0;

        // Process each mermaid element
        // Convert NodeList to Array to avoid live collection issues when replacing elements
        const elements = Array.from(mermaidElements);

        for (const element of elements) {
            // Check if already processed by runtime Mermaid
            if (element.hasAttribute('data-processed')) {
                // ALWAYS try to re-render processed elements
                // Runtime Mermaid may have rendered with broken dimensions (element was hidden)
                // We need to extract original code and re-render properly
                const code = extractMermaidCode(element, doc);
                if (code) {
                    const isBroken = hasBrokenSvg(element);
                    if (isBroken) {
                        console.log('[MermaidPreRenderer] Detected broken SVG, re-rendering...');
                    }
                    try {
                        const svg = await renderMermaidToSvg(code);
                        if (svg) {
                            // Create wrapper and replace
                            const wrapper = doc.createElement('div');
                            wrapper.className = 'exe-mermaid-rendered';
                            wrapper.setAttribute('data-mermaid', code);
                            wrapper.innerHTML = svg;
                            element.parentNode.replaceChild(wrapper, element);
                            renderedCount++;
                            if (isBroken) {
                                console.log('[MermaidPreRenderer] Successfully re-rendered broken SVG');
                            }
                            continue;
                        }
                    } catch (err) {
                        console.warn('[MermaidPreRenderer] Failed to re-render:', err);
                    }
                }
                // Skip if couldn't extract code or re-render failed
                continue;
            }

            try {
                const success = await processMermaidElement(element, doc);
                if (success) {
                    renderedCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.warn('[MermaidPreRenderer] Error processing element:', error);
                errorCount++;
            }
        }

        if (renderedCount === 0) {
            return {
                html,
                hasMermaid: true,
                mermaidRendered: false,
                count: 0,
            };
        }

        // Serialize back to HTML
        let outputHtml;
        if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
            // Full document - serialize entire document
            outputHtml = doc.documentElement.outerHTML;
            // Add doctype if original had it
            if (html.toLowerCase().includes('<!doctype')) {
                outputHtml = '<!DOCTYPE html>\n' + outputHtml;
            }
        } else {
            // Fragment - serialize just the body content
            outputHtml = doc.body.innerHTML;
        }

        return {
            html: outputHtml,
            hasMermaid: true,
            mermaidRendered: renderedCount > 0,
            count: renderedCount,
        };
    }

    /**
     * Get the mermaid code from a pre-rendered element (for editing)
     * @param {Element} element - The exe-mermaid-rendered element
     * @returns {string|null} Original mermaid code or null
     */
    function getOriginalCode(element) {
        if (!element || !element.classList.contains('exe-mermaid-rendered')) {
            return null;
        }
        return element.getAttribute('data-mermaid') || null;
    }

    // Public API
    const MermaidPreRenderer = {
        preRender,
        hasMermaid,
        getOriginalCode,
        // For testing
        _renderMermaidToSvg: renderMermaidToSvg,
        _initMermaid: initMermaid,
        _escapeHtmlAttribute: escapeHtmlAttribute,
    };

    // Expose to global/window
    if (typeof global !== 'undefined') {
        global.MermaidPreRenderer = MermaidPreRenderer;
    }
    if (typeof window !== 'undefined') {
        window.MermaidPreRenderer = MermaidPreRenderer;
    }

    // AMD support
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return MermaidPreRenderer;
        });
    }

    // CommonJS support
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MermaidPreRenderer;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
