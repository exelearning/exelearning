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
        expect(script.textContent).not.toContain('\n');
        expect(script.textContent).toBe(
            '\\begin{document}\\begin{circuitikz} \\draw (0,0) to[R, l=$R_1$] (3,0); \\end{circuitikz}\\end{document}'
        );
    });

    it('ignores the loading spinner and captures only after tikzjax-load-finished', () => {
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
        preview.innerHTML = '<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg>';
        preview
            .querySelector('svg')
            .dispatchEvent(
                new Event('tikzjax-load-finished', { bubbles: true })
            );

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
});
