/**
 * Unit tests for the beforeafter iDevice (edition).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('beforeafter iDevice edition', () => {
    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});

describe('beforeafter minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'beforeafter.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('beforeafter edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/beforeafter/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const tabNames = () =>
        [...document.querySelectorAll('#beforeAfterQIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`beforeAfterQIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'BeforeAfter',
        author: 'Author Name',
        showMinimize: false,
        cardsGame: [
            {
                url: 'img1.png',
                urlBk: 'img2.png',
                author: 'A1',
                authorBk: 'A2',
                alt: 'Alt 1',
                altBk: 'Alt 2',
                eText: 'Before title',
                eTextBk: 'After title',
                description: 'Card description',
                position: 50,
                vertical: false,
            },
        ],
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        evaluation: false,
        evaluationID: '',
        passScoreMode: 'global',
        passScoreCustom: 5,
        ...overrides,
    });
    const exportHelpers = {
        isJsonString: (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        },
    };
    let device;
    let previousApp;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
        document.body.innerHTML = '<div id="bfafBody"></div>';
        device = loadIdevice(join(__dirname, 'beforeafter.js'));
        device.init(document.getElementById('bfafBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('explains what goes in the Questions tab', () => {
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Add the cards: each one compares a before image with an after image. Edit them one by one.');
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('keeps the "Show minimized" switch working after unchecking it', () => {
        const input = document.getElementById('bfafEShowMinimize');

        input.click();
        input.click();
        expect(input.checked).toBe(false);
        expect(input.style.display).not.toBe('none');

        input.click();
        expect(input.checked).toBe(true);
    });

    it('stores the orientation in the card on screen', () => {
        device.cardsGame = [{ vertical: false }];
        device.active = 0;

        document.getElementById('bfafEVertical').click();

        expect(device.cardsGame[0].vertical).toBe(true);
    });

    it('lays the form out in the shared tabs, and opens on its questions (contents)', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'after',
            'grading',
            'texts',
        ]);
        expect(document.getElementById('beforeAfterQIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toContain('Slide to reveal');
        expect(panel('options').querySelector('#bfafEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#bfafEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgYouScore').value).toBe('Your score');
    });

    it('provides accessible help tooltips for options and card controls', () => {
        const optionHelp = panel('options').querySelector('#bfafEOptions .exe-idevice-help');
        expect(optionHelp).not.toBeNull();
        expect(optionHelp.tagName).toBe('BUTTON');
        expect(optionHelp.type).toBe('button');
        expect(optionHelp.title).toBe('Information');

        const cardHelpButtons = [...panel('contents').querySelectorAll('#bfafEPanel .exe-idevice-help')];
        expect(cardHelpButtons.length).toBeGreaterThanOrEqual(2);
        for (const help of [optionHelp, ...cardHelpButtons]) {
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(10);
            const row = help.closest('.d-flex');
            expect(row).not.toBeNull();
            const controls = [...row.querySelectorAll('input')];
            const checked = controls.map((c) => c.checked);
            help.click();
            expect(controls.map((c) => c.checked)).toEqual(checked);
        }
    });

    it('escapes translated help text in the explanation', () => {
        const text = 'Use "Accept" <once> & keep the learner\'s answer.';
        const container = document.createElement('div');
        container.innerHTML = edition().common.getHelpTooltip(text);
        const button = container.querySelector('button');
        expect(button.title).toBe('Information');
        expect(container.querySelector('.help-content').textContent).toBe(text);
        expect(container.querySelector('once')).toBeNull();
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBeGreaterThanOrEqual(3);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('beforeAfterQIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('contents').classList.contains('active')).toBe(false);
    });

    it('restores showMinimize and author when updating field game', () => {
        device.updateFieldGame(game({ showMinimize: true, author: 'New Author' }));

        expect(document.getElementById('bfafEShowMinimize').checked).toBe(true);
        expect(document.getElementById('bfafEAuthory').value).toBe('New Author');
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '<p>Extra info</p>',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the form values including showMinimize', () => {
            device.updateFieldGame(game({ showMinimize: true }));
            device.showCard(0);
            const data = device.validateData();

            expect(data.showMinimize).toBe(true);
            expect(data.author).toBe('Author Name');
            expect(data.instructions).toBe('<p>Instructions</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra info</p>');
            expect(device.save()).toContain('<div class="beforeafter-extra-content"><p>Extra info</p></div>');
        });
    });
});
