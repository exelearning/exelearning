/**
 * Unit tests for the checklist iDevice editor.
 *
 * Cover the form laid out in the shared tabs: what goes in each tab, the help
 * of each option, the logo blocks each switch shows, and the options and items
 * kept when the checklist is saved and reopened.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('checklist edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/checklist/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'Cotejo',
        id: false,
        title: 'My tasks',
        subtitle: 'Unit 1',
        levels: [
            { type: '0', nivel: '0', item: 'Read the text', points: '' },
            { type: '1', nivel: '1', item: 'Write a summary', points: '' },
        ],
        hasLogo: true,
        urlLogo: '',
        hasCommunity: false,
        urlCommunity: '',
        hasDecorative: false,
        urlDecorative: '',
        saveData: true,
        userData: true,
        footer: 'License',
        useScore: false,
        msgs: {},
        ...overrides,
    });
    const stored = (data) => `
        <div class="listacotejo-IDevice">
            <div class="listacotejo-instructions CTJ-instructions"><p>Tick what you finished</p></div>
            <div class="listacotejo-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
    let device;
    let previousApp;
    let previousHelpers;
    let previousMedia;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning.app;
        tooltips = new Map();
        global.eXeLearning.app = {
            ...previousApp,
            common: {
                initTooltips: vi.fn((scope) => {
                    scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                        if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                    });
                }),
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        previousHelpers = { ...helpers() };
        Object.assign(helpers(), {
            isJsonString: (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return false;
                }
            },
            decrypt: (text) => text,
            encrypt: (text) => text,
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        document.body.innerHTML = '<div id="checklistBody"></div>';
        const filename = join(__dirname, 'checklist.js');
        runInThisContext(readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = {}) => device.init(document.getElementById('checklistBody'), previousData, PATH);

    it('lays the form out in the shared tabs, and opens on its items', () => {
        open();

        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'after', 'texts']);
        expect(document.getElementById('gameQEIdeviceForm-tab-contents').textContent.trim()).toBe('Questions');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        open();

        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
            'Complete the checklist ticking the boxes for all finished activities.'
        );
        for (const id of ['ctjUserData', 'ctjSaveData', 'ctjUseScore', 'ctjCommunity', 'ctjLogo', 'ctjDecorative', 'ctjFooter']) {
            expect(panel('options').querySelector(`#${id}`)).not.toBeNull();
        }
        for (const id of ['ctjTitle', 'ctjSubTitle']) {
            expect(panel('contents').querySelector(`#${id}`)).not.toBeNull();
        }
        expect(panel('contents').querySelector('.CTJ-Table')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgComplit').value).toBe('Completed');
    });

    it('explains what goes in the Questions tab, and offers no sharing', () => {
        open();
        const info = panel('contents').firstElementChild;

        expect(info.classList.contains('alert-info')).toBe(true);
        expect(info.textContent).toContain('Write the title of the checklist and its items');
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('provides one accessible information button in each options row', () => {
        open();
        const helpButtons = [...panel('options').querySelectorAll('#ctjEOptions .exe-idevice-help')];

        expect(helpButtons).toHaveLength(7);
        for (const help of helpButtons) {
            const row = help.closest('.d-flex');
            expect(row.querySelector('input')).not.toBeNull();
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const controls = [...row.querySelectorAll('input')];
            const values = controls.map((control) => `${control.checked}${control.value}`);
            help.click();
            row.querySelector('.help-content')?.click();
            expect(controls.map((control) => `${control.checked}${control.value}`)).toEqual(values);
        }
    });

    it('disposes all option tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#gameQEIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(7);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('leaves the state of each switch to its native checkbox', () => {
        open();

        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('shows the block of a logo while its switch is on', () => {
        open();
        const block = document.getElementById('ctjlogologo');

        document.getElementById('ctjLogo').click();
        expect(block.style.display).not.toBe('none');

        document.getElementById('ctjLogo').click();
        expect(block.style.display).toBe('none');
    });

    it('restores the options and the items of a saved checklist', () => {
        open(stored(game()));

        expect(document.getElementById('ctjTitle').value).toBe('My tasks');
        expect(document.getElementById('ctjSubTitle').value).toBe('Unit 1');
        expect(document.getElementById('ctjUserData').checked).toBe(true);
        expect(document.getElementById('ctjSaveData').checked).toBe(true);
        expect(document.getElementById('ctjLogo').checked).toBe(true);
        expect(document.getElementById('ctjFooter').value).toBe('License');
        expect(document.querySelectorAll('.CTJ-data-row')).toHaveLength(2);
        expect(document.querySelector('.CTJ-data-row .CTJ-Level1').innerHTML).toBe('Read the text');
    });

    it('saves the options it shows', () => {
        open(stored(game()));

        expect(device.validateData()).toMatchObject({
            title: 'My tasks',
            subtitle: 'Unit 1',
            userData: true,
            saveData: true,
            hasLogo: true,
            footer: 'License',
            useScore: false,
        });
    });
});
