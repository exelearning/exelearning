/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

function setQuestionForm() {
    document.body.innerHTML = `
        <input type="radio" name="slctime" value="0" checked>
        <input type="radio" name="slcnumber" value="4" checked>
        <input type="radio" name="slctypeselect" value="0" checked>
        <input type="radio" name="slcactivitymode" value="test" checked>
        <input id="elceScoreQuestion" value="1">
        <textarea id="elceTikzCode"></textarea>
        <input id="elceDescription" value="">
        <textarea id="elceQuestion">What circuit is shown?</textarea>
        <span id="elceSolutionSelect">A</span>
        <input class="ELCE-EAnwersOptions" value="Series">
        <input class="ELCE-EAnwersOptions" value="Parallel">
        <input class="ELCE-EAnwersOptions" value="Mixed">
        <input class="ELCE-EAnwersOptions" value="Open">
        <input id="elcePercentageShow" value="35">
        <input id="elceDefinitionWord" value="">
        <input id="elceSolutionWord" value="">
    `;
}

describe('electrical-circuits iDevice edition', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        const code = readFileSync(join(__dirname, 'electrical-circuits.js'), 'utf-8');
        $exeDevice = loadIdevice(code);
        $exeDevice.setMessagesInfo();
        $exeDevicesEdition.iDevice.gamification.helpers.stopSound = vi.fn();
    });

    it('creates default questions with tikzCode and an empty tikzSvg', () => {
        const question = $exeDevice.getCuestionDefault();

        expect(question.tikzCode).toContain('\\begin{circuitikz}');
        expect(question.tikzSvg).toBe('');
        expect(question).not.toHaveProperty('tikzSvgHash');
    });

    it('sanitizes captured SVG before storing it', () => {
        const unsafeSvg = `
            <svg width="100" height="50" viewBox="0 0 10 10" onclick="alert(1)">
                <script>alert(1)</script>
                <foreignObject><div>html</div></foreignObject>
                <a href="javascript:alert(1)"><path onload="alert(1)" d="M0 0"></path></a>
            </svg>
        `;

        const sanitized = $exeDevice.sanitizeTikzSvg(unsafeSvg);

        expect(sanitized).toContain('<svg');
        expect(sanitized).toContain('viewBox="0 0 10 10"');
        expect(sanitized).not.toContain('width=');
        expect(sanitized).not.toContain('height=');
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('foreignObject');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('javascript:');
    });

    it('stores captured SVG only for the matching TikZ code', () => {
        const preview = document.createElement('div');
        preview.innerHTML = '<svg width="100" height="50" viewBox="0 0 10 10"><path d="M0 0"></path></svg>';

        const sanitized = $exeDevice.captureRenderedTikzPreview('  \\draw (0,0);  ', preview);

        expect(sanitized).toContain('<svg');
        expect($exeDevice.getRenderedTikzSvgForCode('\\draw (0,0);')).toBe(sanitized);
        expect($exeDevice.getRenderedTikzSvgForCode('\\draw (1,1);')).toBe('');
    });

    it('invalidates a captured SVG after the TikZ code changes', () => {
        $exeDevice.setRenderedTikzSvg('\\draw (0,0);', '<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg>');

        $exeDevice.invalidateTikzSvgPreview();

        expect($exeDevice.getRenderedTikzSvgForCode('\\draw (0,0);')).toBe('');
    });

    it('blocks saving a question with TikZ code until an SVG is rendered', () => {
        setQuestionForm();
        $('#elceTikzCode').val('\\draw (0,0);');
        $exeDevice.selectsGame = [{}];
        $exeDevice.active = 0;
        const showMessage = vi.spyOn($exeDevice, 'showMessage').mockImplementation(() => {});

        const isValid = $exeDevice.validateQuestion();

        expect(isValid).toBe(false);
        expect(showMessage).toHaveBeenCalledWith($exeDevice.msgs.msgERenderCircuitPreview);
    });

    it('collapses line breaks in the TikZ code before compiling', () => {
        document.body.innerHTML = `
            <textarea id="elceTikzCode"></textarea>
            <div id="elceTikzPreview"></div>
            <div id="elceNoCircuit"></div>
        `;
        const multiline =
            '\\begin{circuitikz}\n\\draw (0,0)\n  to[R, l=$R_1$] (3,0);\n\\end{circuitikz}';
        $('#elceTikzCode').val(multiline);

        $exeDevice.renderTikzPreview();

        const script = document.querySelector(
            '#elceTikzPreview script[type="text/tikz"]'
        );
        expect(script).not.toBeNull();
        expect(JSON.parse(script.dataset.texPackages)).toEqual({
            circuitikz: '',
            amsmath: '',
            amssymb: '',
        });
        expect(script.dataset.showConsole).toBe('true');
        expect(script.textContent).not.toContain('\n');
        expect(script.textContent).toBe(
            '\\begin{document}\\begin{circuitikz} \\draw (0,0) to[R, l=$R_1$] (3,0); \\end{circuitikz}\\end{document}'
        );
    });

    it('ignores the loading spinner and captures only after tikzjax-load-finished', async () => {
        document.body.innerHTML = `
            <textarea id="elceTikzCode"></textarea>
            <div id="elceTikzPreview"></div>
            <div id="elceNoCircuit"></div>
        `;
        $('#elceTikzCode').val(
            '\\begin{circuitikz}\\draw (0,0) to[R, l=$R$] (3,0);\\end{circuitikz}'
        );
        const code = $exeDevice.normalizeTikzCode($('#elceTikzCode').val());
        const preview = document.getElementById('elceTikzPreview');

        $exeDevice.renderTikzPreview();

        // TikZJax first inserts its loading-spinner <svg> placeholder. Without
        // the finished event nothing must be captured (this is what used to
        // require a second click).
        preview.innerHTML = '<svg class="spinner"><circle r="15"></circle></svg>';
        expect($exeDevice.getRenderedTikzSvgForCode(code)).toBe('');

        // TikZJax then swaps in the real circuit and fires the finished event.
        // Capture now happens after the (async) <text>-to-<path> conversion, so
        // wait for the exposed promise before asserting. This SVG has no <text>,
        // so conversion is a no-op and no fonts are fetched.
        preview.innerHTML = '<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg>';
        preview
            .querySelector('svg')
            .dispatchEvent(
                new Event('tikzjax-load-finished', { bubbles: true })
            );
        await $exeDevice.tikzCapturePromise;

        expect($exeDevice.getRenderedTikzSvgForCode(code)).toContain('<svg');
    });

    it('normalizeTikzCode collapses line breaks and surrounding indentation', () => {
        expect(
            $exeDevice.normalizeTikzCode(
                '\\begin{circuitikz}\n  \\draw (0,0);\n\\end{circuitikz}'
            )
        ).toBe('\\begin{circuitikz} \\draw (0,0); \\end{circuitikz}');
        expect($exeDevice.normalizeTikzCode('')).toBe('');
        expect($exeDevice.normalizeTikzCode(null)).toBe('');
    });

    it('sanitizeTikzUnicode rewrites the ohm sign that crashed inputenc', () => {
        // The exact label from the reported bug: a literal Ω (U+03A9) aborted
        // TikZJax with "Unicode character ^^ce^^a9 not set up for use with
        // LaTeX" and no DVI was produced.
        expect(
            $exeDevice.sanitizeTikzUnicode('to[R=1 kΩ] (4,2) to[R=2 kΩ]')
        ).toBe(
            'to[R=1 k\\ensuremath{\\Omega}] (4,2) to[R=2 k\\ensuremath{\\Omega}]'
        );
    });

    it('sanitizeTikzUnicode maps Greek letters, operators, units and arrows', () => {
        expect($exeDevice.sanitizeTikzUnicode('1 µF')).toBe(
            '1 \\ensuremath{\\mu}F'
        );
        expect($exeDevice.sanitizeTikzUnicode('1 μF')).toBe(
            '1 \\ensuremath{\\mu}F'
        );
        expect($exeDevice.sanitizeTikzUnicode('2×3±1')).toBe(
            '2\\ensuremath{\\times}3\\ensuremath{\\pm}1'
        );
        expect($exeDevice.sanitizeTikzUnicode('45°')).toBe(
            '45\\ensuremath{^\\circ}'
        );
        expect($exeDevice.sanitizeTikzUnicode('α→β')).toBe(
            '\\ensuremath{\\alpha}\\ensuremath{\\rightarrow}\\ensuremath{\\beta}'
        );
    });

    it('sanitizeTikzUnicode leaves plain LaTeX and empty input untouched', () => {
        const plain = '\\begin{circuitikz}\\draw (0,0) to[R, l=$R_1$] (3,0);\\end{circuitikz}';
        expect($exeDevice.sanitizeTikzUnicode(plain)).toBe(plain);
        expect($exeDevice.sanitizeTikzUnicode('')).toBe('');
        expect($exeDevice.sanitizeTikzUnicode(null)).toBe('');
    });

    it('sanitizeTikzUnicode is idempotent so repeated normalization is safe', () => {
        const once = $exeDevice.sanitizeTikzUnicode('R=1 kΩ');
        expect($exeDevice.sanitizeTikzUnicode(once)).toBe(once);
    });

    it('sanitizeTikzRendererSyntax repairs AI-generated labels that break TikZJax', () => {
        const code = String.raw`\begin{circuitikz}\draw (0,0) to[battery1,l={$5,\mathrm{V}$}] (0,2) to[R,l={$1,\mathrm{k}\Omega$}] (3,2) to[R,l={$220,\Omega$}] (3,0) to[C,l={$100,\mu\mathrm{F}$}] (0,0) to[lD] (1,0);\end{circuitikz}`;

        expect($exeDevice.sanitizeTikzRendererSyntax(code)).toBe(
            String.raw`\begin{circuitikz}\draw (0,0) to[battery1,l={$5\,\mathrm{V}$}] (0,2) to[R,l={$1\,\mathrm{k}\Omega$}] (3,2) to[R,l={$220\,\Omega$}] (3,0) to[C,l={$100\,\mu\mathrm{F}$}] (0,0) to[leD] (1,0);\end{circuitikz}`
        );
    });

    it('sanitizeTikzRendererSyntax expands shorthand labels with units', () => {
        const code = '\\begin{circuitikz}\\draw (0,0) to[battery1,l=5 V] (0,2) to[R=1 kΩ] (3,2) to[R=220 Ω] (3,0) to[C=100 \\mu F] (0,0);\\end{circuitikz}';

        expect($exeDevice.sanitizeTikzRendererSyntax(code)).toBe(
            String.raw`\begin{circuitikz}\draw (0,0) to[battery1,l={$5\,\mathrm{V}$}] (0,2) to[R,l={$1\,\mathrm{k}\Omega$}] (3,2) to[R,l={$220\,\Omega$}] (3,0) to[C,l={$100\,\mu\mathrm{F}$}] (0,0);\end{circuitikz}`
        );
    });

    it('sanitizeTikzRendererSyntax collapses double-escaped thin spaces', () => {
        const code = String.raw`\begin{circuitikz}\draw (0,0) to[battery1,l={$5\\,\mathrm{V}$}] (0,2) to[fuse] (2,2) -- (4,2) -- (4,0) -- (0,0);\end{circuitikz}`;

        expect($exeDevice.sanitizeTikzRendererSyntax(code)).toBe(
            String.raw`\begin{circuitikz}\draw (0,0) to[battery1,l={$5\,\mathrm{V}$}] (0,2) to[fuse] (2,2) -- (4,2) -- (4,0) -- (0,0);\end{circuitikz}`
        );
    });

    it('normalizeTikzCode collapses whitespace and sanitizes Unicode together', () => {
        expect(
            $exeDevice.normalizeTikzCode(
                '\\begin{circuitikz}\n  \\draw (0,0) to[R=1 kΩ] (3,0);\n\\end{circuitikz}'
            )
        ).toBe(
            '\\begin{circuitikz} \\draw (0,0) to[R,l={$1\\,\\mathrm{k}\\Omega$}] (3,0); \\end{circuitikz}'
        );
    });

    it('normalizeVisibleCircuitText converts TeX units to Unicode for visible fields', () => {
        expect($exeDevice.normalizeVisibleCircuitText('{$1{,}22,\\mathrm{k}\\Omega$}')).toBe('1,22 kΩ');
        expect($exeDevice.normalizeVisibleCircuitText('$100\\,\\mu\\mathrm{F}$')).toBe('100 µF');
        expect($exeDevice.normalizeVisibleCircuitText('5\\,\\mathrm{V} \\pm 1\\degree')).toBe('5 V ± 1°');
    });

    it('finds the cached SVG whether the code is queried multi-line or single-line', () => {
        const multiline =
            '\\begin{circuitikz}\n\\draw (0,0)\n  to[R, l=$R$] (3,0);\n\\end{circuitikz}';
        const singleLine =
            '\\begin{circuitikz} \\draw (0,0) to[R, l=$R$] (3,0); \\end{circuitikz}';

        const stored = $exeDevice.setRenderedTikzSvg(
            multiline,
            '<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg>'
        );

        expect(stored).toContain('<svg');
        // Both forms resolve to the same cache key, so validateQuestion (which
        // reads the raw textarea) and renderTikzPreview stay in sync.
        expect($exeDevice.getRenderedTikzSvgForCode(multiline)).toBe(stored);
        expect($exeDevice.getRenderedTikzSvgForCode(singleLine)).toBe(stored);
    });

    it('wires the AI question generator with the electric-circuits format (gameId 11)', () => {
        // The AI tab is built with getTabIA(11), the electric-circuits format
        // (Description#TikZ#Solution#Question#Options...). addEvents() must
        // register the SAME gameId, otherwise questions generated or pasted by
        // the user are validated against the wrong (adaptative-quiz, id 10)
        // format and silently rejected. Guards the 10 -> 11 fix.
        const shareAddEvents = vi.fn();
        $exeDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
        $exeDevicesEdition.iDevice.gamification.share = { addEvents: shareAddEvents };

        $exeDevice.addEvents();

        expect(shareAddEvents).toHaveBeenCalledWith(11, $exeDevice.insertQuestions);
    });

    it('insertQuestions normalizes AI-generated TikZ before adding questions', () => {
        const addQuestions = vi.spyOn($exeDevice, 'addQuestions').mockImplementation(() => {});
        const line =
            'Circuito#\\begin{circuitikz}\\draw (0,0) to[battery1,l={$5,\\mathrm{V}$}] (0,2) to[R,l={$220,\\Omega$}] (2,2) to[lD] (2,0) -- (0,0);\\end{circuitikz}#A#Question#Correct#Wrong';

        $exeDevice.insertQuestions([line]);

        expect(addQuestions).toHaveBeenCalledWith([
            expect.objectContaining({
                tikzCode:
                    '\\begin{circuitikz}\\draw (0,0) to[battery1,l={$5\\,\\mathrm{V}$}] (0,2) to[R,l={$220\\,\\Omega$}] (2,2) to[leD] (2,0) -- (0,0);\\end{circuitikz}',
            }),
        ]);
    });

    it('insertQuestions converts visible TeX units to Unicode without changing TikZ rules', () => {
        const addQuestions = vi.spyOn($exeDevice, 'addQuestions').mockImplementation(() => {});
        const line =
            'Circuito \\Omega#\\begin{circuitikz}\\draw (0,0) to[R,l={$220\\,\\Omega$}] (2,0);\\end{circuitikz}#A#Valor de \\Omega#{$1{,}22,\\mathrm{k}\\Omega$}#220 \\Omega#100\\,\\mu\\mathrm{F}';

        $exeDevice.insertQuestions([line]);

        expect(addQuestions).toHaveBeenCalledWith([
            expect.objectContaining({
                description: 'Circuito Ω',
                tikzCode:
                    '\\begin{circuitikz}\\draw (0,0) to[R,l={$220\\,\\Omega$}] (2,0);\\end{circuitikz}',
                quextion: 'Valor de Ω',
                options: ['1,22 kΩ', '220 Ω', '100 µF', ''],
            }),
        ]);
    });

    it('round-trips tikzCode and tikzSvg without tikzSvgHash', () => {
        setQuestionForm();
        $('#elceTikzCode').val('\\draw (0,0);');
        const svg = $exeDevice.setRenderedTikzSvg(
            '\\draw (0,0);',
            '<svg width="100" height="50" viewBox="0 0 10 10"><path d="M0 0"></path></svg>'
        );
        $exeDevice.selectsGame = [{}];
        $exeDevice.active = 0;

        expect($exeDevice.validateQuestion()).toBe(true);
        const saved = $exeDevice.selectsGame[0];
        const reloaded = JSON.parse(JSON.stringify(saved));

        expect(reloaded.tikzCode).toBe('\\draw (0,0);');
        expect(reloaded.tikzSvg).toBe(svg);
        expect(reloaded).not.toHaveProperty('tikzSvgHash');
    });

    function loadFont(family) {
        const file = readFileSync(join(__dirname, 'fonts', `${family}.ttf`));
        const buffer = file.buffer.slice(
            file.byteOffset,
            file.byteOffset + file.byteLength
        );
        return $exeDevice.parseTikzFont(buffer);
    }

    function makeTikzSvg(textContent, attrs = {}) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        const text = document.createElementNS(ns, 'text');
        const merged = { 'font-family': 'cmr10', x: '5', y: '10', 'font-size': '10', ...attrs };
        Object.entries(merged).forEach(([name, value]) => text.setAttribute(name, value));
        text.textContent = textContent;
        svg.appendChild(text);
        return svg;
    }

    it('parseTikzFont reads cmr10 and exposes the Omega glyph at U+00AD', () => {
        const font = loadFont('cmr10');

        expect(font).not.toBeNull();
        expect(font.unitsPerEm).toBeGreaterThan(0);
        // Computer Modern carries uppercase Omega at U+00AD (not the real Greek
        // block), which is exactly where TikZJax's encoding table points.
        const omegaGlyph = font.cmap.get(0x00ad);
        expect(omegaGlyph).toBeGreaterThan(0);
        const contours = font.glyphContours(omegaGlyph);
        expect(contours.length).toBeGreaterThan(0);
        expect(contours[0][0]).toHaveProperty('on');
        // Glyphs without an outline (e.g. space) yield no contours.
        expect(font.glyphContours(font.cmap.get(0x20))).toEqual([]);
    });

    it('parseTikzFont returns null for a buffer that is not a font', () => {
        expect($exeDevice.parseTikzFont(new ArrayBuffer(4))).toBeNull();
        expect($exeDevice.parseTikzFont(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBeNull();
    });

    it('tikzGlyphStringToPath draws the ohm sign and applies the U+00AC fixup', () => {
        const font = loadFont('cmr10');

        // The not-sign U+00AC TikZJax emits for Omega must resolve to the same
        // outline as the real Omega code point U+00AD.
        const fromNotSign = $exeDevice.tikzGlyphStringToPath(font, '¬', 0, 0, 10);
        const fromOmega = $exeDevice.tikzGlyphStringToPath(font, '­', 0, 0, 10);
        expect(fromNotSign).toBe(fromOmega);
        expect(fromNotSign.startsWith('M')).toBe(true);

        // A code point the font does not map contributes nothing.
        expect($exeDevice.tikzGlyphStringToPath(font, '☃', 0, 0, 10)).toBe('');
    });

    it('convertTikzTextToPaths replaces <text> with a self-contained <path>', async () => {
        const font = loadFont('cmr10');
        vi.spyOn($exeDevice, 'loadTikzFont').mockResolvedValue(font);
        const svg = makeTikzSvg('¬', { fill: 'black' });

        await $exeDevice.convertTikzTextToPaths(svg);

        expect(svg.querySelector('text')).toBeNull();
        const path = svg.querySelector('path');
        expect(path).not.toBeNull();
        expect(path.getAttribute('d').startsWith('M')).toBe(true);
        expect(path.getAttribute('fill')).toBe('black');
    });

    it('convertTikzTextToPaths leaves <text> untouched when the font fails to load', async () => {
        vi.spyOn($exeDevice, 'loadTikzFont').mockResolvedValue(null);
        const svg = makeTikzSvg('¬');

        await $exeDevice.convertTikzTextToPaths(svg);

        expect(svg.querySelector('text')).not.toBeNull();
        expect(svg.querySelector('path')).toBeNull();
    });

    it('convertTikzTextToPaths is a no-op when there is no text to convert', async () => {
        const loadSpy = vi.spyOn($exeDevice, 'loadTikzFont');
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.appendChild(document.createElementNS(ns, 'path'));

        await $exeDevice.convertTikzTextToPaths(svg);
        await $exeDevice.convertTikzTextToPaths(null);

        expect(loadSpy).not.toHaveBeenCalled();
    });

    it('loadTikzFont fetches, parses and caches a font, returning null on failure', async () => {
        const file = readFileSync(join(__dirname, 'fonts', 'cmr10.ttf'));
        const okFetch = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () =>
                file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        });
        global.fetch = okFetch;
        $exeDevice.tikzFontCache = {};
        $exeDevice.idevicePath = '/idevice/';

        const font = await $exeDevice.loadTikzFont('cmr10');
        expect(font.unitsPerEm).toBeGreaterThan(0);
        expect(okFetch).toHaveBeenCalledWith('/idevice/fonts/cmr10.ttf');

        // Second call is served from cache (no extra fetch).
        await $exeDevice.loadTikzFont('cmr10');
        expect(okFetch).toHaveBeenCalledTimes(1);

        // A failed response resolves to null.
        global.fetch = vi.fn().mockResolvedValue({ ok: false });
        $exeDevice.tikzFontCache = {};
        expect(await $exeDevice.loadTikzFont('cmmi10')).toBeNull();
    });
});
