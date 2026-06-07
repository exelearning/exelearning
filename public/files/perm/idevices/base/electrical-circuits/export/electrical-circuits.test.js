/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function configureGamificationGlobals() {
    global.$exeDevices = {
        iDevice: {
            gamification: {
                colors: {
                    borderColors: {
                        red: '#ff0000',
                        blue: '#0000ff',
                        green: '#00ff00',
                        yellow: '#ffff00',
                    },
                    backColor: {
                        black: '#000000',
                        white: '#ffffff',
                    },
                },
                helpers: {
                    decrypt: (value) => value,
                    isJsonString: (value) => JSON.parse(value),
                    getQuestions: (questions) => questions,
                },
                scorm: {},
                math: {
                    updateLatex: vi.fn(),
                },
                observers: {
                    observeResize: vi.fn(),
                },
            },
        },
    };
}

function loadExportIdevice(code) {
    let modifiedCode = code.replace(/var\s+\$eXeEC\s*=/, 'global.$eXeEC =');
    modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeEC\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeEC;
}

describe('electrical-circuits iDevice export', () => {
    let $eXeEC;

    beforeEach(() => {
        global.$eXeEC = undefined;
        configureGamificationGlobals();
        const code = readFileSync(join(__dirname, 'electrical-circuits.js'), 'utf-8');
        $eXeEC = loadExportIdevice(code);
    });

    it('enable starts the game without loading TikZJax', () => {
        const loadGame = vi.spyOn($eXeEC, 'loadGame').mockImplementation(() => {});

        $eXeEC.enable();

        expect(loadGame).toHaveBeenCalled();
        expect(document.querySelector('script[src*="tikzjax"]')).toBeNull();
    });

    it('sanitizes SVG before rendering it', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';
        const question = {
            tikzSvg: `
                <svg width="100" height="50" viewBox="0 0 10 10" onload="alert(1)">
                    <script>alert(1)</script>
                    <foreignObject><div>html</div></foreignObject>
                    <path onclick="alert(1)" href="javascript:alert(1)" d="M0 0"></path>
                </svg>
            `,
        };

        $eXeEC.showTikzCircuit(question, 0);
        const previewHtml = document.getElementById('elcpTikzPreview-0').innerHTML;

        expect(previewHtml).toContain('<svg');
        expect(previewHtml).toContain('viewBox="0 0 10 10"');
        expect(previewHtml).not.toContain('width=');
        expect(previewHtml).not.toContain('height=');
        expect(previewHtml).not.toContain('<script');
        expect(previewHtml).not.toContain('foreignObject');
        expect(previewHtml).not.toContain('onload');
        expect(previewHtml).not.toContain('onclick');
        expect(previewHtml).not.toContain('javascript:');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('does not render from tikzCode when SVG is missing', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';

        $eXeEC.showTikzCircuit({ tikzCode: '\\draw (0,0);', tikzSvg: '' }, 0);

        expect(document.getElementById('elcpTikzPreview-0').innerHTML).toBe('');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('loadDataGame preserves tikzSvg and does not add tikzSvgHash', () => {
        const data = {
            text: () =>
                JSON.stringify({
                    selectsGame: [
                        {
                            tikzCode: '\\draw (0,0);',
                            tikzSvg: '<svg viewBox="0 0 10 10"></svg>',
                            customScore: 2,
                        },
                    ],
                    percentajeQuestions: 100,
                    msgs: {},
                }),
        };

        const loaded = $eXeEC.loadDataGame(data);

        expect(loaded.selectsGame[0].tikzSvg).toBe('<svg viewBox="0 0 10 10"></svg>');
        expect(loaded.selectsGame[0]).not.toHaveProperty('tikzSvgHash');
    });
});
