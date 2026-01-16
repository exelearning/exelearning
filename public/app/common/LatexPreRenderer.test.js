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

    describe('encrypt and decrypt', () => {
        test('decrypt returns empty string for empty input', () => {
            expect(LatexPreRenderer._decrypt('')).toBe('');
        });

        test('decrypt returns empty string for "undefined" string', () => {
            expect(LatexPreRenderer._decrypt('undefined')).toBe('');
        });

        test('decrypt returns empty string for "null" string', () => {
            expect(LatexPreRenderer._decrypt('null')).toBe('');
        });

        test('encrypt returns empty string for empty input', () => {
            expect(LatexPreRenderer._encrypt('')).toBe('');
        });

        test('encrypt and decrypt are reversible', () => {
            const original = 'Hello World! LaTeX: \\(x^2\\)';
            const encrypted = LatexPreRenderer._encrypt(original);
            const decrypted = LatexPreRenderer._decrypt(encrypted);
            expect(decrypted).toBe(original);
        });

        test('encrypt produces different output than input', () => {
            const original = 'test string';
            const encrypted = LatexPreRenderer._encrypt(original);
            expect(encrypted).not.toBe(original);
        });

        test('decrypt handles XOR encoding correctly', () => {
            // The encrypt function uses XOR with key 146
            const testStr = 'abc';
            const encrypted = LatexPreRenderer._encrypt(testStr);
            expect(encrypted).toBeTruthy();
            expect(LatexPreRenderer._decrypt(encrypted)).toBe(testStr);
        });
    });

    describe('preRenderDataGameLatex', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn((latex, options) => {
                    const container = {
                        querySelector: (selector) => {
                            if (selector === 'svg') {
                                return { outerHTML: `<svg data-latex="${latex}"><g></g></svg>` };
                            }
                            if (selector === 'mjx-assistive-mml math') {
                                return { outerHTML: `<math><mi>x</mi></math>` };
                            }
                            return null;
                        },
                    };
                    return container;
                }),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('returns unchanged html for empty input', async () => {
            const result = await LatexPreRenderer.preRenderDataGameLatex('');
            expect(result.html).toBe('');
            expect(result.count).toBe(0);
        });

        test('returns unchanged html for null input', async () => {
            const result = await LatexPreRenderer.preRenderDataGameLatex(null);
            expect(result.html).toBe(null);
            expect(result.count).toBe(0);
        });

        test('returns unchanged html when no DataGame divs present', async () => {
            const html = '<div><p>Regular content</p></div>';
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);
            expect(result.html).toBe(html);
            expect(result.count).toBe(0);
        });

        test('returns unchanged html when MathJax not available', async () => {
            delete globalThis.MathJax;
            const html = '<div class="DataGame">encrypted content</div>';
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);
            expect(result.html).toBe(html);
            expect(result.count).toBe(0);
        });

        test('processes DataGame div with encrypted JSON containing LaTeX', async () => {
            // Create a JSON object with LaTeX
            const gameData = { question: 'What is \\(x^2\\)?', answer: '4' };
            const jsonStr = JSON.stringify(gameData);
            const encrypted = LatexPreRenderer._encrypt(jsonStr);

            const html = `<div class="quext-DataGame">${encrypted}</div>`;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(1);
            // The content should be different (re-encrypted with rendered LaTeX)
            expect(result.html).not.toBe(html);
        });

        test('skips DataGame div without LaTeX', async () => {
            const gameData = { question: 'What is 2+2?', answer: '4' };
            const jsonStr = JSON.stringify(gameData);
            const encrypted = LatexPreRenderer._encrypt(jsonStr);

            const html = `<div class="DataGame">${encrypted}</div>`;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            // No LaTeX to process, should return unchanged
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        test('handles empty encrypted content', async () => {
            const html = '<div class="DataGame">   </div>';
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);
            expect(result.count).toBe(0);
        });

        test('handles invalid JSON gracefully', async () => {
            // Encrypt invalid JSON
            const encrypted = LatexPreRenderer._encrypt('not valid json \\(x\\)');
            const html = `<div class="DataGame">${encrypted}</div>`;

            // Should not throw, just return original
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        test('processes nested arrays in game data', async () => {
            const gameData = {
                questions: [
                    { text: 'First: \\(a\\)' },
                    { text: 'Second: \\(b\\)' },
                ],
            };
            const jsonStr = JSON.stringify(gameData);
            const encrypted = LatexPreRenderer._encrypt(jsonStr);

            const html = `<div class="DataGame">${encrypted}</div>`;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(1);
        });

        test('handles multiple DataGame divs', async () => {
            const gameData1 = { question: '\\(x\\)' };
            const gameData2 = { question: '\\(y\\)' };
            const encrypted1 = LatexPreRenderer._encrypt(JSON.stringify(gameData1));
            const encrypted2 = LatexPreRenderer._encrypt(JSON.stringify(gameData2));

            const html = `
                <div class="DataGame">${encrypted1}</div>
                <div class="DataGame">${encrypted2}</div>
            `;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(2);
        });

        test('handles game data with primitive values (numbers, booleans, null)', async () => {
            // Game data that includes primitive values that shouldn't be processed as strings
            const gameData = {
                question: '\\(x^2\\)',
                score: 100,
                enabled: true,
                extra: null,
            };
            const jsonStr = JSON.stringify(gameData);
            const encrypted = LatexPreRenderer._encrypt(jsonStr);

            const html = `<div class="DataGame">${encrypted}</div>`;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(1);
            // Decrypt the result to verify primitive values are preserved
            const resultMatch = result.html.match(/<div class="DataGame">([^<]+)<\/div>/);
            expect(resultMatch).toBeTruthy();
            const decrypted = JSON.parse(LatexPreRenderer._decrypt(resultMatch[1]));
            expect(decrypted.score).toBe(100);
            expect(decrypted.enabled).toBe(true);
            expect(decrypted.extra).toBe(null);
        });

        test('handles render error in game data string gracefully', async () => {
            // Make tex2svg throw an error
            globalThis.MathJax.tex2svg = vi.fn(() => {
                throw new Error('MathJax failed');
            });

            const gameData = { question: '\\(invalid\\)' };
            const jsonStr = JSON.stringify(gameData);
            const encrypted = LatexPreRenderer._encrypt(jsonStr);

            const html = `<div class="DataGame">${encrypted}</div>`;
            const result = await LatexPreRenderer.preRenderDataGameLatex(html);

            // Should still process but keep original LaTeX on render error
            expect(result.count).toBe(1);
        });
    });

    describe('renderLatexExpression with tex2svgPromise', () => {
        let originalMathJax;

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('uses tex2svgPromise when available (async path)', async () => {
            originalMathJax = globalThis.MathJax;

            const mockContainer = {
                querySelector: (selector) => {
                    if (selector === 'svg') {
                        return { outerHTML: '<svg><g>async</g></svg>' };
                    }
                    if (selector === 'mjx-assistive-mml math') {
                        return { outerHTML: '<math><mi>async</mi></math>' };
                    }
                    return null;
                },
            };

            globalThis.MathJax = {
                tex2svg: vi.fn(),
                tex2svgPromise: vi.fn().mockResolvedValue(mockContainer),
            };

            const result = await LatexPreRenderer._renderLatexExpression('x^2', 'inline');

            expect(globalThis.MathJax.tex2svgPromise).toHaveBeenCalledWith('x^2', { display: false });
            expect(globalThis.MathJax.tex2svg).not.toHaveBeenCalled();
            expect(result.svg).toContain('<svg>');
            expect(result.mathml).toContain('<math>');
        });

        test('uses tex2mml fallback when assistive-mml not present', async () => {
            originalMathJax = globalThis.MathJax;

            const mockContainer = {
                querySelector: (selector) => {
                    if (selector === 'svg') {
                        return { outerHTML: '<svg><g>test</g></svg>' };
                    }
                    // No assistive-mml
                    return null;
                },
            };

            globalThis.MathJax = {
                tex2svg: vi.fn().mockReturnValue(mockContainer),
                tex2mml: vi.fn().mockReturnValue('<math><mi>fallback</mi></math>'),
            };

            const result = await LatexPreRenderer._renderLatexExpression('y^2', 'block');

            expect(result.svg).toContain('<svg>');
            expect(globalThis.MathJax.tex2mml).toHaveBeenCalledWith('y^2', { display: true });
            expect(result.mathml).toContain('<math>');
        });

        test('handles tex2mml error gracefully', async () => {
            originalMathJax = globalThis.MathJax;

            const mockContainer = {
                querySelector: () => null,
            };

            globalThis.MathJax = {
                tex2svg: vi.fn().mockReturnValue(mockContainer),
                tex2mml: vi.fn().mockImplementation(() => {
                    throw new Error('tex2mml failed');
                }),
            };

            // Should not throw
            const result = await LatexPreRenderer._renderLatexExpression('z^2', 'inline');
            expect(result.svg).toBe('');
            expect(result.mathml).toBe('');
        });

        test('throws when MathJax not available', async () => {
            originalMathJax = globalThis.MathJax;
            delete globalThis.MathJax;

            await expect(LatexPreRenderer._renderLatexExpression('x', 'inline'))
                .rejects.toThrow('MathJax tex2svg not available');
        });
    });

    describe('cleanLatexDelimiters via _renderLatexExpression', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn((latex) => ({
                    querySelector: (sel) => sel === 'svg' ? { outerHTML: `<svg>${latex}</svg>` } : null,
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('strips \\(...\\) delimiters', async () => {
            await LatexPreRenderer._renderLatexExpression('\\(x^2\\)', 'inline');
            expect(globalThis.MathJax.tex2svg).toHaveBeenCalledWith('x^2', { display: false });
        });

        test('strips \\[...\\] delimiters', async () => {
            await LatexPreRenderer._renderLatexExpression('\\[y^2\\]', 'block');
            expect(globalThis.MathJax.tex2svg).toHaveBeenCalledWith('y^2', { display: true });
        });

        test('strips $$...$$ delimiters', async () => {
            await LatexPreRenderer._renderLatexExpression('$$z^2$$', 'block');
            expect(globalThis.MathJax.tex2svg).toHaveBeenCalledWith('z^2', { display: true });
        });

        test('strips single $...$ delimiters', async () => {
            await LatexPreRenderer._renderLatexExpression('$a+b$', 'inline');
            expect(globalThis.MathJax.tex2svg).toHaveBeenCalledWith('a+b', { display: false });
        });

        test('keeps \\begin...\\end as-is', async () => {
            await LatexPreRenderer._renderLatexExpression('\\begin{equation}x\\end{equation}', 'block');
            expect(globalThis.MathJax.tex2svg).toHaveBeenCalledWith('\\begin{equation}x\\end{equation}', { display: true });
        });
    });

    describe('preRender with full document', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        if (sel === 'mjx-assistive-mml math') return { outerHTML: '<math></math>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('handles full HTML document with doctype', async () => {
            const html = '<!DOCTYPE html><html><head></head><body><p>\\(x\\)</p></body></html>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('<html');
            expect(result.html).toContain('exe-math-rendered');
        });

        test('handles full HTML document without doctype but with <html> tag', async () => {
            const html = '<html><body><p>\\(y\\)</p></body></html>';
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('<html');
            expect(result.html).not.toContain('<!DOCTYPE');
        });

        test('preserves content when processing full document with idevices', async () => {
            const html = `<!DOCTYPE html>
            <html><body>
                <div class="idevice_node"><p>\\(a\\)</p></div>
            </body></html>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('<!DOCTYPE html>');
        });
    });

    describe('preserveSkipElementContent', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('preserves script tags with <link> inside code blocks', async () => {
            const html = `<code><script src="test.js"></script></code><p>\\(x\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('<script src="test.js">');
        });

        test('preserves style tags inside pre blocks', async () => {
            const html = `<pre><style>.test{}</style></pre><p>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('<style>.test{}');
        });

        test('preserves meta tags inside code blocks', async () => {
            const html = `<code><meta name="test"></code><p>\\(z\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('<meta name="test">');
        });

        test('preserves base tags inside code blocks', async () => {
            const html = `<code><base href="http://test.com"></code><p>\\(a\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.html).toContain('<base href="http://test.com">');
        });
    });

    describe('shouldSkipPosition edge cases', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('skips LaTeX inside nested script tags', async () => {
            const html = `<script><script>\\(x\\)</script></script><p>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            // Only \\(y\\) should be rendered
            expect(result.count).toBe(1);
        });

        test('skips LaTeX inside textarea', async () => {
            const html = `<div><textarea>\\(x\\)</textarea><p>\\(y\\)</p></div>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
            expect(result.html).toContain('<textarea>\\(x\\)</textarea>');
        });

        test('handles attribute with single quotes', async () => {
            const html = `<p data-info='\\(x\\)'>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
            // DOM parser may normalize quotes to double quotes
            expect(result.html).toContain('data-info');
            expect(result.html).toContain('\\(x\\)');
        });

        test('handles unquoted attribute values correctly', async () => {
            // LaTeX in normal text should still be processed
            const html = `<p data-val=test>\\(z\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
        });
    });

    describe('processNode edge cases', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('skips svg elements', async () => {
            const html = `<svg><text>\\(x\\)</text></svg><p>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
        });

        test('skips math elements', async () => {
            const html = `<math><mi>\\(x\\)</mi></math><p>\\(y\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
        });

        test('skips elements with exe-math-rendered class', async () => {
            const html = `<span class="exe-math-rendered">\\(already\\)</span><p>\\(new\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
        });

        test('processes containers with nested containers recursively', async () => {
            const html = `<div><p>\\(inner\\)</p></div>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
        });

        test('handles container with nested block elements', async () => {
            // When a container has nested containers, it processes children recursively
            const html = `<div><div><p>\\(nested\\)</p></div></div>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(1);
        });
    });

    describe('hasLatex with \\ref and \\eqref', () => {
        test('returns true for \\ref{} references', () => {
            expect(LatexPreRenderer.hasLatex('See \\ref{eq1}')).toBe(true);
        });

        test('returns true for \\eqref{} references', () => {
            expect(LatexPreRenderer.hasLatex('From \\eqref{myeq}')).toBe(true);
        });
    });

    describe('overlapping LaTeX patterns', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('handles adjacent LaTeX expressions correctly', async () => {
            const html = `<p>\\(a\\)\\(b\\)</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(2);
        });

        test('handles LaTeX with no content between', async () => {
            const html = `<p>\\[x\\]\\[y\\]</p>`;
            const result = await LatexPreRenderer.preRender(html);

            expect(result.count).toBe(2);
        });
    });

    describe('JSON iDevice data attribute processing', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        if (sel === 'mjx-assistive-mml math') return { outerHTML: '<math></math>' };
                        return null;
                    },
                })),
                texReset: vi.fn(),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('detects LaTeX in data-idevice-json-data attribute', async () => {
            const jsonData = {
                textTextarea: '<p>Some text \\(x^2\\)</p>',
                otherField: 'no latex here',
            };
            const jsonStr = JSON.stringify(jsonData).replace(/"/g, '&quot;');
            const html = `<div class="idevice_node" data-idevice-json-data="${jsonStr}"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(true);
        });

        test('pre-renders LaTeX in JSON data attribute', async () => {
            const jsonData = {
                textTextarea: '<p>The formula \\(x^2\\) is simple</p>',
            };
            const jsonStr = JSON.stringify(jsonData).replace(/"/g, '&quot;');
            const html = `<div class="idevice_node" data-idevice-json-data="${jsonStr}"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBeGreaterThan(0);

            // Check the JSON data was updated with pre-rendered content
            const parser = new globalThis.DOMParser();
            const doc = parser.parseFromString(result.html, 'text/html');
            const element = doc.querySelector('[data-idevice-json-data]');
            const newJsonData = JSON.parse(element.getAttribute('data-idevice-json-data'));

            expect(newJsonData.textTextarea).toContain('exe-math-rendered');
        });

        test('processes multiple JSON iDevice elements', async () => {
            const jsonData1 = {
                textTextarea: '<p>\\(a^2\\)</p>',
            };
            const jsonData2 = {
                textTextarea: '<p>\\(b^2\\)</p>',
            };
            const jsonStr1 = JSON.stringify(jsonData1).replace(/"/g, '&quot;');
            const jsonStr2 = JSON.stringify(jsonData2).replace(/"/g, '&quot;');
            const html = `
                <div class="idevice_node" data-idevice-json-data="${jsonStr1}"></div>
                <div class="idevice_node" data-idevice-json-data="${jsonStr2}"></div>
            `;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBeGreaterThanOrEqual(2);
        });

        test('skips JSON data without LaTeX content', async () => {
            const jsonData = {
                textTextarea: '<p>Regular text content without math</p>',
                otherField: 'Just text',
            };
            const jsonStr = JSON.stringify(jsonData).replace(/"/g, '&quot;');
            const html = `<div class="idevice_node" data-idevice-json-data="${jsonStr}"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
        });

        test('handles invalid JSON in data attribute gracefully', async () => {
            // Invalid JSON but contains LaTeX pattern
            const html = `<div class="idevice_node" data-idevice-json-data="invalid json with \\(x\\)"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            // Should not crash
            expect(result.hasLatex).toBe(true);
        });

        test('processes both JSON data and HTML body LaTeX', async () => {
            const jsonData = {
                textTextarea: '<p>\\(formula\\)</p>',
            };
            const jsonStr = JSON.stringify(jsonData).replace(/"/g, '&quot;');
            const html = `
                <div class="idevice_node" data-idevice-json-data="${jsonStr}">
                    <p>\\(another\\)</p>
                </div>
            `;

            const result = await LatexPreRenderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBeGreaterThanOrEqual(2);
        });

        test('skips JSON properties that do not contain LaTeX', async () => {
            const jsonData = {
                textTextarea: '<p>\\(x^2\\)</p>',
                plainText: 'No LaTeX here',
                number: 42,
                boolVal: true,
            };
            const jsonStr = JSON.stringify(jsonData).replace(/"/g, '&quot;');
            const html = `<div class="idevice_node" data-idevice-json-data="${jsonStr}"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            // Should only process textTextarea, not other properties
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);

            // Non-string properties should be preserved
            const parser = new globalThis.DOMParser();
            const doc = parser.parseFromString(result.html, 'text/html');
            const element = doc.querySelector('[data-idevice-json-data]');
            const newJsonData = JSON.parse(element.getAttribute('data-idevice-json-data'));

            expect(newJsonData.plainText).toBe('No LaTeX here');
        });
    });

    describe('double-processing prevention', () => {
        let originalMathJax;

        beforeEach(() => {
            originalMathJax = globalThis.MathJax;
            globalThis.MathJax = {
                tex2svg: vi.fn(() => ({
                    querySelector: (sel) => {
                        if (sel === 'svg') return { outerHTML: '<svg></svg>' };
                        if (sel === 'mjx-assistive-mml math') return { outerHTML: '<math></math>' };
                        return null;
                    },
                })),
            };
        });

        afterEach(() => {
            if (originalMathJax !== undefined) {
                globalThis.MathJax = originalMathJax;
            } else {
                delete globalThis.MathJax;
            }
        });

        test('skips string that already contains pre-rendered LaTeX', async () => {
            // Simulate already pre-rendered content in JSON data
            const alreadyRendered = '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg></span>';
            const result = await LatexPreRenderer.preRender(alreadyRendered);

            // Should NOT try to process the LaTeX inside data-latex attribute
            expect(result.html).toBe(alreadyRendered);
            expect(result.latexRendered).toBe(false);
        });

        test('does not corrupt data-latex attribute by double-processing', async () => {
            // This was the bug: preRenderString would match LaTeX inside data-latex attribute
            // and try to wrap it again, corrupting the attribute value
            const content = '<p><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg></span></p>';

            const result = await LatexPreRenderer.preRender(content);

            // The content should be unchanged - no double processing
            expect(result.html).not.toContain('data-latex="<span');
            expect(result.html).not.toContain('data-latex="&lt;span');
        });

        test('preRender skips JSON with already-rendered content in data-idevice-json-data', async () => {
            // Simulate iDevice with already pre-rendered textTextarea
            const renderedLatex = '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg></span>';
            const jsonData = JSON.stringify({ textTextarea: `<p>Text ${renderedLatex}</p>` });
            const html = `<div class="idevice_node text" data-idevice-json-data="${jsonData.replace(/"/g, '&quot;')}"></div>`;

            const result = await LatexPreRenderer.preRender(html);

            // Should not double-process the already-rendered LaTeX
            // The data-latex attribute should NOT contain HTML spans
            expect(result.html).not.toMatch(/data-latex="[^"]*<span/);
            expect(result.html).not.toMatch(/data-latex="[^"]*&lt;span/);
        });

        test('preRender skips container elements with already-rendered LaTeX children', async () => {
            // Simulate a paragraph that already has pre-rendered LaTeX inside
            const html = '<p><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg></span> is great</p>';

            const result = await LatexPreRenderer.preRender(html);

            // Should not try to process the content again
            // Count of exe-math-rendered should remain 1, not increase
            const matches = result.html.match(/exe-math-rendered/g) || [];
            expect(matches.length).toBe(1);

            // The data-latex should NOT be corrupted
            expect(result.html).not.toContain('data-latex="<span');
        });

        test('preRender skips iDevice DOM with already-rendered LaTeX', async () => {
            // Simulate iDevice structure with already-rendered content in both JSON and DOM
            const renderedSpan = '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg></span>';
            const jsonData = JSON.stringify({ textTextarea: `<p>${renderedSpan}</p>` });
            const html = `
                <div class="idevice_node text" data-idevice-json-data="${jsonData.replace(/"/g, '&quot;')}">
                    <div class="exe-text"><p>${renderedSpan}</p></div>
                </div>`;

            const result = await LatexPreRenderer.preRender(html);

            // Count exe-math-rendered - should be 1 in the DOM content, not doubled
            const domMatches = result.html.match(/class="exe-math-rendered"/g) || [];
            expect(domMatches.length).toBe(1);

            // Verify no corruption
            expect(result.html).not.toContain('data-latex="<span');
            expect(result.html).not.toContain('data-latex="&lt;span');
        });
    });
});
