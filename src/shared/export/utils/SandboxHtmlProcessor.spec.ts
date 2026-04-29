import { SandboxHtmlProcessor } from './SandboxHtmlProcessor';

function withMockWindow<T>(mockWindow: unknown, run: () => T): T {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
        value: mockWindow,
        configurable: true,
        writable: true,
    });

    try {
        return run();
    } finally {
        Object.defineProperty(globalThis, 'window', {
            value: originalWindow,
            configurable: true,
            writable: true,
        });
    }
}

describe('SandboxHtmlProcessor', () => {
    it('should return empty or non-string inputs unchanged', () => {
        expect(SandboxHtmlProcessor.process('')).toBe('');
        // @ts-expect-error testing invalid input
        expect(SandboxHtmlProcessor.process(null)).toBe(null);
    });

    it('should return HTML without scripts unchanged', () => {
        const html = '<div><p>Hello world</p></div>';
        expect(SandboxHtmlProcessor.process(html)).toBe(html);
    });

    it('should wrap inline scripts with SandboxJS', () => {
        const html = '<div><script>console.log("hello");</script></div>';
        const result = SandboxHtmlProcessor.process(html);

        expect(result).toContain('new Sandbox');
        expect(result).toContain('console.log("hello");');
        expect(result).toContain('__sandbox.compile(__code)');
    });

    it('should ignore scripts with src attribute', () => {
        const html = '<div><script src="test.js"></script><script>alert(1)</script></div>';
        const result = SandboxHtmlProcessor.process(html);

        expect(result).toContain('<script src="test.js"></script>');
        expect(result).toContain('new Sandbox');
        expect(result).toContain('alert(1)');
    });

    it('should wrap inline event handlers with SandboxJS', () => {
        const html = '<button onclick="alert(\'clicked\')">Click me</button>';
        const result = SandboxHtmlProcessor.process(html);

        expect(result).toContain('new Sandbox');
        expect(result).toContain("alert('clicked')");
        expect(result).toContain('return __exec');
    });

    it('should not wrap already wrapped scripts', () => {
        const html = '<script>new Sandbox().compile("alert(1)")();</script>';
        const result = SandboxHtmlProcessor.process(html);

        // It shouldn't double wrap
        expect(result.split('new Sandbox').length).toBe(2); // One match means it wasn't added again
    });

    it('should wrap scripts and handlers through the DOMParser path', () => {
        const scriptNode = {
            textContent: 'console.log("browser");',
            hasAttribute: (name: string) => name === 'src',
        };
        const eventAttribute = { name: 'onclick', value: 'alert("browser")' };
        const eventNode = {
            attributes: [eventAttribute],
            setAttribute: (name: string, value: string) => {
                eventAttribute.name = name;
                eventAttribute.value = value;
            },
        };
        const body = {
            get innerHTML() {
                return `<div><script>${scriptNode.textContent}</script><button onclick="${eventAttribute.value}">Click</button></div>`;
            },
        };
        const documentElement = {
            get outerHTML() {
                return `<html><body>${body.innerHTML}</body></html>`;
            },
        };
        class MockDOMParser {
            parseFromString() {
                return {
                    querySelectorAll: (selector: string) => {
                        if (selector === 'script') return [scriptNode];
                        if (selector === '*') return [eventNode];
                        return [];
                    },
                    body,
                    documentElement,
                };
            }
        }

        const result = withMockWindow({ DOMParser: MockDOMParser }, () =>
            SandboxHtmlProcessor.process(
                '<div><script>console.log("browser");</script><button onclick="alert(&quot;browser&quot;)">Click</button></div>',
            ),
        );

        expect(result).toContain('console.log("browser");');
        expect(result).toContain('__sandbox.compile(__code)');
        expect(result).toContain('return __exec');
    });

    it('should return a full HTML document from the DOMParser path when input contains html tags', () => {
        const scriptNode = {
            textContent: 'console.log("doc");',
            hasAttribute: () => false,
        };
        const body = {
            get innerHTML() {
                return `<script>${scriptNode.textContent}</script>`;
            },
        };
        const documentElement = {
            get outerHTML() {
                return `<html><head><title>x</title></head><body>${body.innerHTML}</body></html>`;
            },
        };
        class MockDOMParser {
            parseFromString() {
                return {
                    querySelectorAll: (selector: string) => (selector === 'script' ? [scriptNode] : []),
                    body,
                    documentElement,
                };
            }
        }

        const result = withMockWindow({ DOMParser: MockDOMParser }, () =>
            SandboxHtmlProcessor.process(
                '<html><head><title>x</title></head><body><script>console.log("doc");</script></body></html>',
            ),
        );

        expect(result.toLowerCase()).toContain('<html');
        expect(result).toContain('console.log("doc");');
        expect(result).toContain('__sandbox.compile(__code)');
    });

    it('should return original html on the DOMParser path when nothing changes', () => {
        const scriptNode = {
            textContent: '',
            hasAttribute: (name: string) => name === 'src',
        };
        const eventNode = {
            attributes: [{ name: 'onclick', value: '' }],
            setAttribute: () => {
                throw new Error('setAttribute should not be called');
            },
        };
        class MockDOMParser {
            parseFromString() {
                return {
                    querySelectorAll: (selector: string) => {
                        if (selector === 'script') return [scriptNode];
                        if (selector === '*') return [eventNode];
                        return [];
                    },
                    body: { innerHTML: '<div>unchanged</div>' },
                    documentElement: { outerHTML: '<html><body>unchanged</body></html>' },
                };
            }
        }

        const html = '<script src="test.js"></script><button onclick="">Click</button>';
        const result = withMockWindow({ DOMParser: MockDOMParser }, () => SandboxHtmlProcessor.process(html));

        expect(result).toBe(html);
    });

    it('should not wrap already wrapped inline event handlers', () => {
        const html = '<button onclick="new Sandbox().compile(\'return false\')()">Click me</button>';
        const result = SandboxHtmlProcessor.process(html);

        expect(result.split('new Sandbox').length).toBe(2);
    });

    it('should use regex fallback when DOMParser is unavailable', () => {
        withMockWindow(undefined, () => {
            const html = `<div><script>const price = \`Total: \${42}\`;\\nconsole.log(price);</script></div>`;
            const result = SandboxHtmlProcessor.process(html);

            expect(result).toContain('new Sandbox');
            expect(result).toContain(
                `const __code = \`const price = \\\`Total: \\\${42}\\\`;\\\\nconsole.log(price);\`;`,
            );
        });
    });

    it('should escape matching quotes when regex fallback wraps event handlers', () => {
        withMockWindow(undefined, () => {
            const html = `<button onclick="alert('clicked')">Click me</button>`;
            const result = SandboxHtmlProcessor.process(html);

            expect(result).toContain(`onclick="try {`);
            expect(result).toContain(`console.error(\\"Sandbox execution error:\\", e);`);
        });
    });

    it('should fall back to regex processing if DOMParser throws', () => {
        class ThrowingDOMParser {
            parseFromString() {
                throw new Error('parse failed');
            }
        }
        const originalConsoleError = console.error;
        const consoleErrors: unknown[][] = [];
        console.error = (...args: unknown[]) => {
            consoleErrors.push(args);
        };

        try {
            const result = withMockWindow({ DOMParser: ThrowingDOMParser }, () =>
                SandboxHtmlProcessor.process('<div><script>alert(1)</script></div>'),
            );

            expect(consoleErrors.length).toBeGreaterThan(0);
            expect(result).toContain('new Sandbox');
            expect(result).toContain('alert(1)');
        } finally {
            console.error = originalConsoleError;
        }
    });
});
