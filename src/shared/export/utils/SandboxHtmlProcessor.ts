/**
 * Utility to process user-provided HTML and wrap JavaScript in SandboxJS execution blocks.
 * This helps mitigate security risks for user-injected scripts in iDevices, headers, and footers.
 */
export class SandboxHtmlProcessor {
    /**
     * Process HTML string to sandbox `<script>` and inline `on*` event handlers.
     *
     * @param html HTML string to process
     * @returns Processed HTML string with sandboxed scripts
     */
    static process(html: string): string {
        if (!html || typeof html !== 'string') {
            return html;
        }

        // Fast check to see if there might be anything to sandbox
        if (!html.includes('<script') && !html.match(/\son[a-z]+=/i)) {
            return html;
        }

        try {
            // To ensure compatibility with browser and Node environments (esbuild),
            // we use the built-in DOM parser in the browser or parse with regex/string-manipulation
            // as a fallback if window.DOMParser is not available (which it should be in both the preview and electron).
            let document: Document;
            let isBrowser = false;
            const container: HTMLElement | null = null;

            if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
                const parser = new window.DOMParser();
                document = parser.parseFromString(html, 'text/html');
                isBrowser = true;
            } else {
                // Node.js environment workaround using regex (since JSDOM breaks esbuild node resolution)
                return SandboxHtmlProcessor.regexProcess(html);
            }

            let hasChanges = false;

            // 1. Process inline <script> tags
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                // We only sandbox inline scripts (no src attribute)
                if (!script.hasAttribute('src') && script.textContent && script.textContent.trim() !== '') {
                    const originalCode = script.textContent;
                    // Check if it's already sandboxed to avoid double-wrapping
                    if (!originalCode.includes('new Sandbox().compile(')) {
                        script.textContent = SandboxHtmlProcessor.createSandboxWrapper(originalCode);
                        hasChanges = true;
                    }
                }
            });

            // 2. Process inline event handlers (onclick, onmouseover, etc.)
            // We need to iterate over all elements and their attributes
            // A more efficient way is to use XPath or TreeWalker, but querySelectorAll('*') is okay for typical iDevice sizes
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                const attributes = el.attributes;
                for (let i = 0; i < attributes.length; i++) {
                    const attr = attributes[i];
                    if (attr.name.startsWith('on') && attr.value.trim() !== '') {
                        const originalCode = attr.value;
                        if (!originalCode.includes('new Sandbox().compile(')) {
                            // Event handler wrap needs to return values sometimes (e.g., return false;)
                            el.setAttribute(attr.name, SandboxHtmlProcessor.createSandboxWrapper(originalCode, true));
                            hasChanges = true;
                        }
                    }
                }
            });

            // Only serialize if we made changes
            if (hasChanges) {
                // DOMParser adds <html><head><body> tags if they weren't there.
                // We need to extract just the fragment content if the original HTML didn't have <html>.
                if (!html.toLowerCase().includes('<html')) {
                    // Bare <script> tags parsed as text/html go to <head> (HTML5 parser rule),
                    // while block elements like <div> go to <body>.
                    // Return head + body to capture all modified content.
                    return (document.head.innerHTML + document.body.innerHTML).trim() || html;
                }
                return document.documentElement.outerHTML;
            }

            return html;
        } catch (error) {
            console.error('Error processing HTML for SandboxJS:', error);
            // Fallback to original HTML if processing fails
            return SandboxHtmlProcessor.regexProcess(html);
        }
    }

    /**
     * Fallback processor using regular expressions (for Node.js context without DOM)
     */
    private static regexProcess(html: string): string {
        let result = html;

        // 1. Process <script> tags
        // This regex finds script tags without a src attribute
        const scriptRegex = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
        result = result.replace(scriptRegex, (match, scriptContent) => {
            if (!scriptContent || scriptContent.trim() === '') return match;
            if (scriptContent.includes('new Sandbox().compile(')) return match;

            const wrapped = SandboxHtmlProcessor.createSandboxWrapper(scriptContent);
            return match.replace(scriptContent, wrapped);
        });

        // 2. Process inline on* handlers
        // Finding all on[a-z]+="something"
        // It's a bit naive but works for standard cases
        const handlerRegex = /(\bon[a-z]+\s*=\s*)(['"])([\s\S]*?)\2/gi;
        result = result.replace(handlerRegex, (match, prefix, quote, handlerContent) => {
            if (!handlerContent || handlerContent.trim() === '') return match;
            if (handlerContent.includes('new Sandbox().compile(')) return match;

            const wrapped = SandboxHtmlProcessor.createSandboxWrapper(handlerContent, true);
            // Reconstruct the attribute: prefix + quote + wrapped + quote
            // We must escape quotes in the wrapped code depending on the bounding quote
            const safeWrapped = wrapped.replace(new RegExp(quote, 'g'), '\\' + quote);
            return prefix + quote + safeWrapped + quote;
        });

        return result;
    }

    /**
     * Creates a SandboxJS wrapper block for the given code.
     * @param code The JavaScript code to sandbox
     * @param isEventContext Whether this is for an event handler
     * @returns The wrapped code
     */
    private static createSandboxWrapper(code: string, isEventContext: boolean = false): string {
        // Prepare the code block string
        // SandboxJS requires explicit scope passing if the script wants to access `document`, `window`, etc.
        // Also we pass `this` and `event` for event handlers.

        // Escape backticks and standard string escapes so we can place it in a template literal or string
        // Since we are compiling the code as a string, we need to escape it properly.
        const escapedCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const wrapper = `
try {
    const __code = \`${escapedCode}\`;
    const __sandbox = new Sandbox({
        globals: { ...Sandbox.SAFE_GLOBALS, document, window, console, alert: alert.bind(window), Math, RegExp, Date, setTimeout: setTimeout.bind(window), setInterval: setInterval.bind(window), clearTimeout: clearTimeout.bind(window), clearInterval: clearInterval.bind(window) }
    });
    const __exec = __sandbox.compile(__code);
    ${isEventContext ? 'return ' : ''}__exec({ this: this, event: typeof event !== 'undefined' ? event : null }).run();
} catch (e) {
    console.error("Sandbox execution error:", e);
}
        `.trim();

        return wrapper;
    }
}
