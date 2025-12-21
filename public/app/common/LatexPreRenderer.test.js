/**
 * Tests for LatexPreRenderer
 *
 * Note: These tests run without MathJax, so they test the detection and extraction
 * logic but not the actual rendering (which requires MathJax in a browser context).
 */
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';

// Setup DOM environment before importing LatexPreRenderer
const window = new Window();
globalThis.DOMParser = window.DOMParser;
globalThis.Node = window.Node;
globalThis.document = window.document;

// Import the module (it will attach to globalThis in Node/Bun context)
import './LatexPreRenderer.js';

describe('LatexPreRenderer', () => {
    let LatexPreRenderer;

    beforeEach(() => {
        // Get the global instance
        LatexPreRenderer = globalThis.LatexPreRenderer || window?.LatexPreRenderer;
    });

    describe('hasLatex', () => {
        test('returns false for empty string', () => {
            expect(LatexPreRenderer.hasLatex('')).toBe(false);
        });

        test('returns false for null/undefined', () => {
            expect(LatexPreRenderer.hasLatex(null)).toBe(false);
            expect(LatexPreRenderer.hasLatex(undefined)).toBe(false);
        });

        test('returns false for HTML without LaTeX', () => {
            const html = '<div><p>Hello world</p></div>';
            expect(LatexPreRenderer.hasLatex(html)).toBe(false);
        });

        test('returns true for inline LaTeX with \\(', () => {
            const html = '<p>The formula \\(x^2 + y^2 = z^2\\) is famous.</p>';
            expect(LatexPreRenderer.hasLatex(html)).toBe(true);
        });

        test('returns true for display LaTeX with \\[', () => {
            const html = '<div>\\[\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\\]</div>';
            expect(LatexPreRenderer.hasLatex(html)).toBe(true);
        });

        test('returns true for LaTeX with $$', () => {
            const html = '<p>Equation: $$E = mc^2$$</p>';
            expect(LatexPreRenderer.hasLatex(html)).toBe(true);
        });

        test('returns true for LaTeX with \\begin', () => {
            const html = '<p>\\begin{equation}a^2 + b^2 = c^2\\end{equation}</p>';
            expect(LatexPreRenderer.hasLatex(html)).toBe(true);
        });
    });

    describe('_extractLatexExpressions', () => {
        test('extracts inline \\(...\\) expressions', () => {
            const html = '<p>The value is \\(x = 5\\) units.</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].latex).toBe('\\(x = 5\\)');
            expect(result.expressions[0].display).toBe('inline');
            expect(result.html).toContain('<!--LATEX_PLACEHOLDER_0-->');
        });

        test('extracts display \\[...\\] expressions', () => {
            const html = '<div>\\[y = mx + b\\]</div>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].latex).toBe('\\[y = mx + b\\]');
            expect(result.expressions[0].display).toBe('block');
        });

        test('extracts $$...$$ display expressions', () => {
            const html = '<p>$$\\frac{a}{b}$$</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].latex).toBe('$$\\frac{a}{b}$$');
            expect(result.expressions[0].display).toBe('block');
        });

        test('extracts \\begin{...}...\\end{...} expressions', () => {
            const html = '<p>\\begin{align}x &= 1\\end{align}</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].display).toBe('block');
        });

        test('extracts multiple expressions in order', () => {
            const html = '<p>First: \\(a\\), second: \\[b\\], third: \\(c\\)</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(3);
            expect(result.html).toContain('<!--LATEX_PLACEHOLDER_0-->');
            expect(result.html).toContain('<!--LATEX_PLACEHOLDER_1-->');
            expect(result.html).toContain('<!--LATEX_PLACEHOLDER_2-->');
        });

        test('returns empty expressions for HTML without LaTeX', () => {
            const html = '<p>No math here</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(0);
            expect(result.html).toBe(html);
        });

        test('handles nested HTML correctly', () => {
            const html = '<div class="math"><span>\\(x^2\\)</span></div>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.html).toContain('<div class="math"><span><!--LATEX_PLACEHOLDER_0--></span></div>');
        });

        test('extracts LaTeX with <br> tags (multiline)', () => {
            const html = '<p>\\[<br>&nbsp; \\left \\{<br>&nbsp; &nbsp; x = 1<br>&nbsp; \\right \\}<br>\\]</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].display).toBe('block');
            // The extraction should include the <br> tags in the match
            expect(result.expressions[0].latex).toContain('<br>');
        });

        test('extracts \\begin...\\end with <br> tags', () => {
            const html = '<p>\\begin{aligned}<br>x &= 1<br>y &= 2<br>\\end{aligned}</p>';
            const result = LatexPreRenderer._extractLatexExpressions(html);

            expect(result.expressions.length).toBe(1);
            expect(result.expressions[0].display).toBe('block');
            expect(result.expressions[0].latex).toContain('<br>');
        });
    });

    describe('_cleanLatexFromHtml', () => {
        test('removes <br> tags and replaces with newlines', () => {
            const input = '\\[<br>x = 1<br>\\]';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\[\nx = 1\n\\]');
            expect(result).not.toContain('<br>');
        });

        test('removes self-closing <br /> tags', () => {
            const input = '\\[<br />x = 1<br/>\\]';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\[\nx = 1\n\\]');
        });

        test('decodes &nbsp; to space', () => {
            const input = '\\[&nbsp;&nbsp;x = 1&nbsp;\\]';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\[  x = 1 \\]');
        });

        test('decodes HTML entities', () => {
            const input = '\\(x &lt; y &amp;&amp; a &gt; b\\)';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\(x < y && a > b\\)');
        });

        test('decodes numeric HTML entities', () => {
            const input = '\\(&#60;&#62;&#38;\\)';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\(<>&\\)');
        });

        test('decodes hex HTML entities', () => {
            const input = '\\(&#x3C;&#x3E;\\)';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).toBe('\\(<>\\)');
        });

        test('handles complex multiline LaTeX', () => {
            const input = '\\[<br>&nbsp; \\left \\{<br>&nbsp; &nbsp; \\begin{aligned}<br>&nbsp; &nbsp; &nbsp; x &amp;= 1<br>&nbsp; &nbsp; \\end{aligned}<br>&nbsp; \\right \\}<br>\\]';
            const result = LatexPreRenderer._cleanLatexFromHtml(input);

            expect(result).not.toContain('<br>');
            expect(result).not.toContain('&nbsp;');
            expect(result).not.toContain('&amp;');
            expect(result).toContain('\\left \\{');
            expect(result).toContain('\\begin{aligned}');
            expect(result).toContain('x &= 1');
        });
    });

    describe('preRender', () => {
        test('returns hasLatex: false for non-LaTeX content', async () => {
            const html = '<p>Hello world</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        test('returns hasLatex: true but latexRendered: false when MathJax not available', async () => {
            const html = '<p>\\(x^2\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
            // Original HTML should be preserved when MathJax is not available
            expect(result.html).toBe(html);
        });

        test('handles empty string', async () => {
            const result = await LatexPreRenderer.preRender('');

            expect(result.hasLatex).toBe(false);
            expect(result.html).toBe('');
        });

        test('handles null gracefully', async () => {
            const result = await LatexPreRenderer.preRender(null);

            expect(result.hasLatex).toBe(false);
            expect(result.html).toBe(null);
        });
    });

    describe('preRender with mock MathJax', () => {
        let originalMathJax;

        beforeEach(() => {
            // Save original MathJax if exists
            originalMathJax = globalThis.MathJax;

            // Create mock MathJax
            globalThis.MathJax = {
                tex2svg: vi.fn((latex, options) => {
                    // Create a mock DOM structure similar to MathJax output
                    const container = {
                        querySelector: (selector) => {
                            if (selector === 'svg') {
                                return {
                                    outerHTML: `<svg data-latex="${latex}"><g></g></svg>`,
                                };
                            }
                            if (selector === 'mjx-assistive-mml math') {
                                return {
                                    outerHTML: `<math><mi>x</mi></math>`,
                                };
                            }
                            return null;
                        },
                    };
                    return container;
                }),
            };
        });

        afterEach(() => {
            // Restore original MathJax
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('renders LaTeX when MathJax is available', async () => {
            const html = '<p>\\(x^2\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).toContain('data-latex');
            expect(result.html).toContain('<svg');
        });

        test('renders multiple expressions', async () => {
            const html = '<p>\\(a\\) and \\(b\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(2);
            expect(result.html.match(/exe-math-rendered/g).length).toBe(2);
        });

        test('preserves original LaTeX in data-latex attribute', async () => {
            const html = '<p>\\(x^2 + y^2\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('data-latex="\\(x^2 + y^2\\)"');
        });

        test('marks block expressions with data-display="block"', async () => {
            const html = '<p>\\[\\frac{1}{2}\\]</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('data-display="block"');
        });

        test('handles MathJax errors gracefully', async () => {
            // Make tex2svg throw an error
            globalThis.MathJax.tex2svg = vi.fn(() => {
                throw new Error('MathJax error');
            });

            const html = '<p>\\(invalid\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            // Should restore original LaTeX on error
            expect(result.html).toContain('\\(invalid\\)');
        });

        test('preserves special characters in data-latex attribute', async () => {
            const html = '<p>\\(x < y\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            // The DOM handles attribute escaping internally
            // The original LaTeX including < should be preserved in data-latex
            expect(result.html).toContain('data-latex');
            expect(result.html).toContain('x < y');
        });

        test('renders multiline LaTeX with <br> tags', async () => {
            const html = '<p>\\[<br>&nbsp; x = 1<br>\\]</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            // The <br> should be removed from output
            expect(result.html).not.toContain('\\[<br>');
        });

        test('renders \\begin...\\end with <br> tags', async () => {
            const html = '<p>\\begin{aligned}<br>x &amp;= 1<br>\\end{aligned}</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
        });

        test('cleans LaTeX before storing in data-latex attribute', async () => {
            const html = '<p>\\[<br>&nbsp; \\frac{1}{2}<br>\\]</p>';
            const result = await LatexPreRenderer.preRender(html);

            // data-latex should contain cleaned LaTeX (no HTML entities or tags)
            expect(result.html).toContain('data-latex');
            // It should not contain raw <br> or &nbsp;
            expect(result.html).not.toContain('data-latex="\\[<br>');
        });

        test('does NOT process LaTeX inside HTML attributes', async () => {
            // LaTeX in title attribute should NOT be processed
            const html = '<p><a href="#" title="Se escribe: \\( \\LaTeX \\)">\\(\\LaTeX\\)</a></p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the text content, not the title attribute

            // The title attribute should remain unchanged
            expect(result.html).toContain('title="Se escribe: \\( \\LaTeX \\)"');
            // The text content should be rendered
            expect(result.html).toContain('exe-math-rendered');
        });

        test('does NOT process LaTeX inside data-* attributes', async () => {
            // LaTeX in data attributes should NOT be processed
            const html = '<p data-formula="\\(x^2\\)">\\(y^2\\)</p>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the text content

            // The data attribute should remain unchanged
            expect(result.html).toContain('data-formula="\\(x^2\\)"');
            // The text content should be rendered
            expect(result.html).toContain('exe-math-rendered');
        });

        test('does NOT process LaTeX inside <script> tags (TikZ)', async () => {
            // TikZ scripts use \begin{tikzpicture} which matches our LaTeX pattern
            const html = `<div>
                <p>\\(x^2\\)</p>
                <script type="text/tikz">
                    \\begin{tikzpicture}
                        \\draw (0,0) circle (1in);
                    \\end{tikzpicture}
                </script>
            </div>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the p content, not the script

            // The script content should remain unchanged
            expect(result.html).toContain('\\begin{tikzpicture}');
            expect(result.html).toContain('\\draw (0,0) circle (1in)');
            // The text content should be rendered
            expect(result.html).toContain('exe-math-rendered');
        });

        test('does NOT process LaTeX inside <code> tags', async () => {
            // Code blocks showing LaTeX examples
            const html = '<div><code>\\(x^2\\)</code><p>\\(y^2\\)</p></div>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the p content

            // The code content should remain unchanged
            expect(result.html).toContain('<code>\\(x^2\\)</code>');
        });

        test('does NOT process LaTeX inside <pre> tags', async () => {
            // Pre blocks showing LaTeX examples
            const html = '<div><pre>\\begin{aligned}x &= 1\\end{aligned}</pre><p>\\(z\\)</p></div>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the p content

            // The pre content should remain unchanged
            expect(result.html).toContain('<pre>\\begin{aligned}');
        });

        test('preserves <link> and <script> tags inside <code> blocks', async () => {
            // Code blocks containing HTML examples that DOMParser would corrupt
            const html = `<div>
                <code><link rel="stylesheet" href="test.css"><script src="test.js"></script></code>
                <p>\\(x\\)</p>
            </div>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);

            // The code content should be preserved - DOMParser should NOT move/remove these
            expect(result.html).toContain('<link rel="stylesheet"');
            expect(result.html).toContain('<script src="test.js">');
        });

        test('preserves HTML examples inside highlighted code blocks', async () => {
            // Simulates Prism.js highlighted code block with HTML content
            const html = `<div class="highlighted-code language-html">
                <pre class="language-html"><code class="language-html"><link rel="stylesheet" type="text/css" href="https://tikzjax.com/fonts.css">
<script src="https://tikzjax.com/tikzjax.js"></script></code></pre>
            </div>
            <p>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);

            // The highlighted code content should be fully preserved
            expect(result.html).toContain('https://tikzjax.com/fonts.css');
            expect(result.html).toContain('https://tikzjax.com/tikzjax.js');
        });

        test('does NOT render LaTeX that contains formatting tags (example code)', async () => {
            // LaTeX with <strong> inside is showing syntax example, not real LaTeX
            const html = `<p>La expresión <span style="color: #0000ff;">\\( \\dfrac{x}{y} = <strong>\\boxed</strong>{z} \\)</span> produce: \\( \\dfrac{x}{y} = \\boxed{z} \\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1); // Only the second LaTeX without <strong>

            // The first LaTeX with <strong> should remain as text
            expect(result.html).toContain('<strong>\\boxed</strong>');
            // The second LaTeX should be rendered
            expect(result.html).toContain('exe-math-rendered');
        });

        test('does NOT render LaTeX that contains <em> tags', async () => {
            const html = `<p>Ejemplo: \\( x = <em>variable</em> \\) vs \\( x = 5 \\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1); // Only second one rendered
            expect(result.html).toContain('<em>variable</em>');
        });

        test('does NOT render LaTeX inside colored span (example code)', async () => {
            // LaTeX in colored span is example code, should not be rendered
            const html = `<p><span style="color: #0000ff;">\\(x^2\\)</span> produce: \\(x^2\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1); // Only second one rendered
            // First LaTeX in colored span should remain as text
            expect(result.html).toContain('<span style="color: #0000ff;">\\(x^2\\)</span>');
            // Second LaTeX should be rendered
            expect(result.html).toContain('exe-math-rendered');
        });

        test('does NOT render LaTeX inside nested colored spans', async () => {
            const html = `<p><span style="color: blue;"><span>\\(y\\)</span></span> vs \\(z\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1); // Only z rendered
            expect(result.html).toContain('\\(y\\)'); // y stays as text
        });
    });

    describe('iDevice equation numbering', () => {
        beforeEach(() => {
            // Setup MathJax mock for iDevice tests
            globalThis.MathJax = {
                tex2svg: vi.fn(() => {
                    const container = document.createElement('div');
                    container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><path d="test"/></svg><mjx-assistive-mml><math><mi>x</mi></math></mjx-assistive-mml>';
                    return container;
                }),
                texReset: vi.fn(),
            };
        });

        afterEach(() => {
            delete globalThis.MathJax;
        });

        test('detects iDevice structure and uses per-iDevice processing', async () => {
            const html = `
                <div class="idevice_node" id="dev1">
                    <p>\\(x^2\\)</p>
                </div>
                <div class="idevice_node" id="dev2">
                    <p>\\(y^2\\)</p>
                </div>
            `;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            expect(result.html).toContain('exe-math-rendered');
        });

        test('processes content outside iDevices', async () => {
            const html = `
                <nav><p>\\(nav\\)</p></nav>
                <div class="idevice_node">
                    <p>\\(content\\)</p>
                </div>
            `;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBeGreaterThanOrEqual(1);
        });

        test('handles equation environments', async () => {
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}E = mc^2\\end{equation}</p>
                </div>
            `;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        test('renders multiple iDevices independently', async () => {
            // Each iDevice should have its own equation numbering scope
            const html = `
                <div class="idevice_node" id="idev-1">
                    <p>\\begin{equation}a = 1\\end{equation}</p>
                </div>
                <div class="idevice_node" id="idev-2">
                    <p>\\begin{equation}b = 2\\end{equation}</p>
                </div>
            `;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            // Both iDevices should have rendered content
            expect(result.html).toContain('id="idev-1"');
            expect(result.html).toContain('id="idev-2"');
        });

        test('calls MathJax.texReset for each iDevice when available', async () => {
            const html = `
                <div class="idevice_node" id="dev1"><p>\\(a\\)</p></div>
                <div class="idevice_node" id="dev2"><p>\\(b\\)</p></div>
            `;
            await LatexPreRenderer.preRender(html);

            // texReset should be called for each iDevice plus once for non-iDevice content
            expect(globalThis.MathJax.texReset).toHaveBeenCalled();
        });

        test('renders numbered equations before references (two-phase)', async () => {
            // This test verifies that equations with \label are rendered before \ref
            // so that MathJax can resolve the references
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{eq1}x = 1\\end{equation}</p>
                    <p>See equation \\(\\ref{eq1}\\) for details.</p>
                </div>
            `;

            // Track the order in which expressions are rendered
            const renderOrder = [];
            globalThis.MathJax.tex2svg = vi.fn((latex) => {
                renderOrder.push(latex);
                const container = document.createElement('mjx-container');
                container.innerHTML = '<svg><text>mock</text></svg>';
                return container;
            });

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);

            // Verify the equation (with \label) was rendered before the reference
            // The first render should be the equation environment
            expect(renderOrder[0]).toContain('begin{equation}');
            expect(renderOrder[0]).toContain('\\label{eq1}');
            // The second render should be the reference
            expect(renderOrder[1]).toContain('\\ref{eq1}');
        });

        test('handles \eqref references', async () => {
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{myeq}y = mx + b\\end{equation}</p>
                    <p>From \\(\\eqref{myeq}\\) we can see...</p>
                </div>
            `;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            expect(result.html).toContain('exe-math-rendered');
        });

        test('renders equations in multiple paragraphs before any references', async () => {
            // Complex case: multiple equations spread across paragraphs, references at the end
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{eq:first}a = 1\\end{equation}</p>
                    <p>\\begin{equation}\\label{eq:second}b = 2\\end{equation}</p>
                    <p>Compare \\(\\ref{eq:first}\\) and \\(\\ref{eq:second}\\).</p>
                </div>
            `;

            const renderOrder = [];
            globalThis.MathJax.tex2svg = vi.fn((latex) => {
                renderOrder.push(latex);
                const container = document.createElement('mjx-container');
                container.innerHTML = '<svg><text>mock</text></svg>';
                return container;
            });

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(4);

            // The first two renders should be the equations (with labels)
            expect(renderOrder[0]).toContain('\\label{eq:first}');
            expect(renderOrder[1]).toContain('\\label{eq:second}');
            // References come after
            expect(renderOrder[2]).toContain('\\ref{eq:first}');
            expect(renderOrder[3]).toContain('\\ref{eq:second}');
        });

        test('correctly identifies starred equation environments as unnumbered', async () => {
            // Starred environments (equation*, align*, etc.) don't get numbers
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation*}x = 1\\end{equation*}</p>
                </div>
            `;

            const renderOrder = [];
            globalThis.MathJax.tex2svg = vi.fn((latex) => {
                renderOrder.push({ latex, type: 'render' });
                const container = document.createElement('mjx-container');
                container.innerHTML = '<svg><text>mock</text></svg>';
                return container;
            });

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            // equation* should be rendered as 'other' (not numbered equation)
            expect(result.count).toBe(1);
        });

        test('renders bare \\ref{} outside of math delimiters', async () => {
            // In LaTeX, \ref can be used in text mode. MathJax can render them too.
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{myeq}a = b\\end{equation}</p>
                    <p>As shown in equation \\ref{myeq} we have...</p>
                </div>
            `;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            // Both equation and bare \ref should be rendered (wrapped in exe-math-rendered)
            // The data-latex attribute stores the original, but the literal text should be replaced
            expect(result.html).toContain('data-latex="\\ref{myeq}"');
            expect(result.html).toContain('exe-math-rendered');
        });

        test('renders bare \\eqref{} outside of math delimiters', async () => {
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{eq1}x^2\\end{equation}</p>
                    <p>From \\eqref{eq1} we derive...</p>
                </div>
            `;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            // The eqref should be wrapped in a rendered span
            expect(result.html).toContain('data-latex="\\eqref{eq1}"');
        });

        test('renders equations before bare refs (cross-element)', async () => {
            // Ensure two-phase rendering works even for bare refs
            const html = `
                <div class="idevice_node">
                    <p>\\begin{equation}\\label{first}a\\end{equation}</p>
                    <p>\\begin{equation}\\label{second}b\\end{equation}</p>
                    <p>In \\ref{first} and \\eqref{second} we see...</p>
                </div>
            `;

            const renderOrder = [];
            globalThis.MathJax.tex2svg = vi.fn((latex) => {
                renderOrder.push(latex);
                const container = document.createElement('mjx-container');
                container.innerHTML = '<svg><text>mock</text></svg>';
                return container;
            });

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(4);

            // Equations should be rendered before refs
            expect(renderOrder[0]).toContain('\\label{first}');
            expect(renderOrder[1]).toContain('\\label{second}');
            expect(renderOrder[2]).toContain('\\ref{first}');
            expect(renderOrder[3]).toContain('\\eqref{second}');
        });
    });
});
