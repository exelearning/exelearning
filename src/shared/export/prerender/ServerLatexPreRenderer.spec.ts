/**
 * ServerLatexPreRenderer Unit Tests
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { ServerLatexPreRenderer } from './ServerLatexPreRenderer';

describe('ServerLatexPreRenderer', () => {
    let renderer: ServerLatexPreRenderer;

    beforeAll(() => {
        renderer = new ServerLatexPreRenderer();
    });

    describe('hasLatex', () => {
        it('should detect inline LaTeX with \\( \\)', () => {
            expect(renderer.hasLatex('Hello \\(x^2\\) world')).toBe(true);
        });

        it('should detect display LaTeX with \\[ \\]', () => {
            expect(renderer.hasLatex('Hello \\[x^2\\] world')).toBe(true);
        });

        it('should detect display LaTeX with $$', () => {
            expect(renderer.hasLatex('Hello $$x^2$$ world')).toBe(true);
        });

        it('should detect \\begin{equation}', () => {
            expect(renderer.hasLatex('Hello \\begin{equation}x^2\\end{equation} world')).toBe(true);
        });

        it('should detect \\ref{...}', () => {
            expect(renderer.hasLatex('See equation \\ref{eq1}')).toBe(true);
        });

        it('should detect \\eqref{...}', () => {
            expect(renderer.hasLatex('See equation \\eqref{eq1}')).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(renderer.hasLatex('Hello world')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(renderer.hasLatex('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(renderer.hasLatex(null as unknown as string)).toBe(false);
            expect(renderer.hasLatex(undefined as unknown as string)).toBe(false);
        });
    });

    describe('preRender', () => {
        it('should pre-render inline LaTeX to SVG', async () => {
            const html = '<p>The formula \\(x^2\\) is simple.</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).toContain('<svg');
            expect(result.html).toContain('data-latex');
        });

        it('should pre-render display LaTeX to SVG', async () => {
            const html = '<p>The formula: \\[x^2 + y^2 = z^2\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).toContain('data-display="block"');
            expect(result.html).toContain('<svg');
        });

        it('should pre-render multiple LaTeX expressions', async () => {
            const html = '<p>Given \\(a\\) and \\(b\\), we have \\[a + b = c\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(3);
        });

        it('should handle LaTeX with HTML entities', async () => {
            const html = '<p>Formula: \\(a &lt; b\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should handle LaTeX spanning <br> tags', async () => {
            const html = '<p>\\[a + b =<br>c\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should pre-render inline LaTeX inside span elements', async () => {
            const html = '<p><span style="color:#c00">\\(x^2\\)</span></p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should skip LaTeX inside <code> tags', async () => {
            const html = '<p>Example: <code>\\(x^2\\)</code></p>';
            const result = await renderer.preRender(html);

            // The LaTeX pattern is detected but should be skipped
            expect(result.html).not.toContain('exe-math-rendered');
        });

        it('should skip LaTeX inside attribute values', async () => {
            const html = '<p data-formula="\\(x^2\\)">Content</p>';
            const result = await renderer.preRender(html);

            // LaTeX in attribute should not be rendered
            expect(result.html).toContain('data-formula="\\(x^2\\)"');
        });

        it('should return unchanged HTML for text without LaTeX', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should skip already pre-rendered content', async () => {
            // HTML with pre-rendered LaTeX but no raw LaTeX patterns
            const html = '<span class="exe-math-rendered" data-latex="x^2"><svg></svg></span>';
            const result = await renderer.preRender(html);

            // No raw LaTeX patterns detected (exe-math-rendered is already processed)
            expect(result.hasLatex).toBe(false);
            expect(result.latexRendered).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should render raw LaTeX even if content already has exe-math-rendered', async () => {
            // HTML with both raw LaTeX and already-rendered content
            const html = '<p>\\(new\\) <span class="exe-math-rendered"><svg></svg></span></p>';
            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should render pending formulas in mixed table content with pre-rendered spans', async () => {
            const html = `
<table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
<tbody>
<tr>
<th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg></span></span></th>
<th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
</tr>
</tbody>
</table>
`;

            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(2);
            expect(result.html).toContain('data-latex="\\(\\mathrm{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathit{ABCdef}\\)"');
        });

        it('should render all pending ABCdef formulas from provided mixed pre-rendered table', async () => {
            const html = `
<table border="1" cellpadding="6" style="margin-left: auto; margin-right: auto;">
<tbody>
<tr>
<th style="width: 304px; text-align: center;" colspan="2"><span style="font-size: 12pt;">Tipografías matemáticas</span></th>
</tr>
<tr>
<th style="width: 137px; text-align: center;"><span style="font-size: 12pt;"><span class="exe-math-rendered" data-latex="\\(\\LaTeX\\)"><svg></svg><math></math></span></span></th>
<th style="width: 151px; text-align: center;"><span style="font-size: 12pt;">Resultado</span></th>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathrm{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathrm{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathit{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathit{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathbb{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathbb{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathcal{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathcal{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="color: #0000ff; font-size: 12pt;">&nbsp;\\mathfrak{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathfrak{ABCdef}\\)</span></td>
</tr>
<tr>
<td style="width: 137px; text-align: center;"><span style="font-size: 12pt; color: #0000ff;">&nbsp;\\mathscr{ABCdef}</span></td>
<td style="width: 151px; text-align: center;"><span style="font-size: 12pt; color: #000000;">\\(\\mathscr{ABCdef}\\)</span></td>
</tr>
</tbody>
</table>`;

            const result = await renderer.preRender(html);

            expect(result.hasLatex).toBe(true);
            expect(result.latexRendered).toBe(true);
            expect(result.count).toBe(6);
            expect(result.html).toContain('data-latex="\\(\\mathrm{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathit{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathbb{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathcal{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathfrak{ABCdef}\\)"');
            expect(result.html).toContain('data-latex="\\(\\mathscr{ABCdef}\\)"');
        });

        it('should handle fractions', async () => {
            const html = '<p>\\(\\frac{1}{2}\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle square roots', async () => {
            const html = '<p>\\(\\sqrt{x}\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle Greek letters', async () => {
            const html = '<p>\\(\\alpha + \\beta = \\gamma\\)</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle sums and integrals', async () => {
            const html = '<p>\\[\\sum_{i=1}^n x_i\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });

        it('should handle matrices', async () => {
            const html = '<p>\\[\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\]</p>';
            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
        });
    });

    describe('preRenderDataGameLatex', () => {
        it('should decrypt, pre-render, and re-encrypt DataGame content', async () => {
            // Create encrypted JSON with LaTeX
            const gameData = { question: 'What is \\(x^2\\)?' };
            const jsonStr = JSON.stringify(gameData);

            // Encrypt (XOR with key 146)
            let encrypted = '';
            for (let i = 0; i < jsonStr.length; i++) {
                encrypted += String.fromCharCode(jsonStr.charCodeAt(i) ^ 146);
            }
            const escapedEncrypted = escape(encrypted);

            const html = `<div class="quext-DataGame">${escapedEncrypted}</div>`;
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(1);
            // The content should be different (re-encrypted with pre-rendered LaTeX)
            expect(result.html).not.toBe(html);
        });

        it('should return unchanged HTML if no DataGame divs', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should skip DataGame without LaTeX', async () => {
            const gameData = { question: 'What is 2 + 2?' };
            const jsonStr = JSON.stringify(gameData);

            let encrypted = '';
            for (let i = 0; i < jsonStr.length; i++) {
                encrypted += String.fromCharCode(jsonStr.charCodeAt(i) ^ 146);
            }
            const escapedEncrypted = escape(encrypted);

            const html = `<div class="quext-DataGame">${escapedEncrypted}</div>`;
            const result = await renderer.preRenderDataGameLatex(html);

            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });
    });

    describe('data-idevice-json-data pre-render (parity with browser)', () => {
        // Mirror IdeviceRenderer.escapeAttr so the fixture matches export output.
        const escapeAttr = (s: string): string =>
            s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const buildIdevice = (type: string, data: unknown): string =>
            `<div id="id1" class="idevice_node ${type}" data-idevice-path="idevices/${type}/" data-idevice-type="${type}" data-idevice-component-type="json" data-idevice-json-data="${escapeAttr(JSON.stringify(data))}"></div>`;

        it('recursively pre-renders nested LaTeX for trueorfalse', async () => {
            const html = buildIdevice('trueorfalse', {
                eXeGameInstructions: '<p>Intro \\(a\\)</p>',
                questionsGame: [{ question: '<p>\\(x^2\\)</p>', feedback: '<p>\\(y^2\\)</p>' }],
            });

            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.count).toBeGreaterThan(0);
            expect(result.html).toContain('exe-math-rendered');
            // Raw delimiters must be gone from the (now pre-rendered) attribute.
            expect(result.html).not.toContain('\\(x^2\\)');
        });

        it('recursively pre-renders nested LaTeX for adaptative-quiz', async () => {
            const html = buildIdevice('adaptative-quiz', {
                questions: [{ question: 'Solve \\(x^2\\)', options: [{ text: '\\(i\\)' }, { text: '1' }] }],
            });

            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).not.toContain('\\(x^2\\)');
        });

        it('does NOT pre-render JSON LaTeX for non-allowlisted iDevices', async () => {
            const html = buildIdevice('classify', {
                questions: [{ question: '<p>\\(x^2\\)</p>' }],
            });

            const result = await renderer.preRender(html);

            // Attribute left untouched (this iDevice transforms text at runtime → MathJax).
            expect(result.html).toBe(html);
            expect(result.html).not.toContain('exe-math-rendered');
        });

        it('recursively pre-renders nested LaTeX for form questions', async () => {
            const html = buildIdevice('form', {
                eXeFormInstructions: '<p>Intro \\(a\\)</p>',
                questionsData: [
                    {
                        baseText: '<p>Solve \\(x^2\\)</p>',
                        answers: [
                            [true, '\\(i\\)'],
                            [false, 'plain'],
                        ],
                        feedbackRight: '<p>Yes \\(y^2\\)</p>',
                        wrongAnswersValue: '\\(z\\)|other',
                    },
                ],
            });

            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).not.toContain('\\(x^2\\)');

            const decoded = decodeJsonAttr(result.html);
            expect(decoded.questionsData[0].baseText).toContain('exe-math-rendered');
            expect(decoded.questionsData[0].answers[0][1]).toContain('exe-math-rendered');
            // Dropdown distractors land in an <option value> → kept raw.
            expect(decoded.questionsData[0].wrongAnswersValue).toBe('\\(z\\)|other');
        });

        it('recursively pre-renders nested LaTeX for scrambled-list', async () => {
            const html = buildIdevice('scrambled-list', {
                instructions: '<p>Order: \\(a\\)</p>',
                options: ['\\(x^2\\)', '\\(y^2\\)', 'plain'],
            });

            const result = await renderer.preRender(html);

            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');
            expect(result.html).not.toContain('\\(x^2\\)');
        });

        it('does not pre-render scrambled-list buttonText (rendered in an input value)', async () => {
            const html = buildIdevice('scrambled-list', {
                options: ['\\(x^2\\)', 'plain'],
                buttonText: 'Check \\(k\\)',
            });

            const result = await renderer.preRender(html);

            // The option IS rendered...
            expect(result.html).toContain('exe-math-rendered');
            // ...but buttonText (used as an <input value>) stays raw.
            const decoded = decodeJsonAttr(result.html);
            expect(decoded.buttonText).toBe('Check \\(k\\)');
        });

        it('leaves trueorfalse JSON without LaTeX unchanged', async () => {
            const html = buildIdevice('trueorfalse', {
                eXeGameInstructions: '<p>No math here</p>',
                questionsGame: [{ question: '<p>Plain</p>' }],
            });

            const result = await renderer.preRender(html);

            expect(result.html).toBe(html);
            expect(result.count).toBe(0);
        });

        // Reverse of escapeHtmlAttribute (&amp; last) so we can read the JSON back.
        const decodeJsonAttr = (html: string): Record<string, any> => {
            const match = html.match(/data-idevice-json-data="([^"]*)"/);
            if (!match) throw new Error('No data-idevice-json-data attribute found');
            const json = match[1]
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
            return JSON.parse(json);
        };

        it('does not pre-render literal-compared fields like itinerary.codeAccess', async () => {
            const html = buildIdevice('adaptative-quiz', {
                questionsGame: [{ question: 'Solve \\(x^2\\)' }],
                itinerary: {
                    showCodeAccess: true,
                    codeAccess: '\\(secret\\)',
                    messageCodeAccess: 'Enter \\(k\\)',
                },
            });

            const result = await renderer.preRender(html);

            // Visible content (and the visible message field) is still rendered...
            expect(result.latexRendered).toBe(true);
            expect(result.html).toContain('exe-math-rendered');

            const decoded = decodeJsonAttr(result.html);
            // ...but the access code, compared verbatim at runtime, is left intact.
            expect(decoded.itinerary.codeAccess).toBe('\\(secret\\)');
            // The neighbouring visible field in the same object IS rendered.
            expect(decoded.itinerary.messageCodeAccess).toContain('exe-math-rendered');
        });
    });
});
