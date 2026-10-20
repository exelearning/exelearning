/**
 * Tests for progress-report edition iDevice
 *
 * The pure functions run against stubbed globals; the form laid out in the
 * shared tabs runs against the real ones, kept aside before any stub.
 */

/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { runInThisContext } from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the iDevice code
const iDevicePath = path.join(__dirname, 'progress-report.js');
const iDeviceCode = fs.readFileSync(iDevicePath, 'utf8');

// The real jQuery installed by the Vitest setup, kept aside because
// loadIdevice() below replaces the global with a stub for the pure-function
// tests. The lifecycle tests put it back.
const realJQuery = global.$;
const realExeDevices = global.$exeDevices;
const realEXeLearning = global.eXeLearning;
const realUnderscore = global._;

/**
 * Helper to load the iDevice with mocked globals
 */
function loadIdevice() {
    // Create mock for $exeDevices.iDevice.gamification.helpers.isJsonString
    const isJsonString = (str) => {
        try {
            return JSON.parse(str);
        } catch (e) {
            return false;
        }
    };

    // Mock $eXeInforme for normalizeFileName reference in buildNestedPages
    global.$eXeInforme = {
        normalizeFileName: (fileName) => fileName?.toLowerCase().replace(/\s+/g, '-') || '',
        getEvaluatioID: () => ({ evaluation: false, ideviceID: '', evaluationID: '' }),
    };

    // Mock $exeDevices
    global.$exeDevices = {
        iDevice: {
            gamification: {
                helpers: {
                    isJsonString,
                },
            },
        },
    };

    // Mock jQuery
    global.$ = (typeof mock !== 'undefined' ? mock : function() {})(() => ({
        val: () => '',
        find: () => ({ length: 0 }),
        hide: () => {},
        show: () => {},
        on: () => {},
        data: () => null,
        each: () => {},
        children: () => ({ length: 0, each: () => {} }),
    }));
    global.jQuery = global.$;

    // Mock eXeLearning
    global.eXeLearning = {
        app: {
            project: {
                odeId: 'test-ode-id',
            },
        },
    };

    // Mock translation function
    global._ = (str) => str;

    // Replace 'var $exeDevice' with 'global.$exeDevice' to expose it
    const modifiedCode = iDeviceCode.replace(/var \$exeDevice/, 'global.$exeDevice');
    eval(modifiedCode);

    return global.$exeDevice;
}

describe('progress-report edition iDevice', () => {
    let $exeDevice;

    beforeEach(() => {
        // Reset globals before each test for isolation
        global.$exeDevice = undefined;
        $exeDevice = loadIdevice();
    });

    describe('normalizeFileName', () => {
        test('should handle basic accented characters', () => {
            expect($exeDevice.normalizeFileName('café')).toBe('cafe');
            expect($exeDevice.normalizeFileName('naïve')).toBe('naive');
        });

        test('should convert spaces to hyphens', () => {
            expect($exeDevice.normalizeFileName('hello world')).toBe('hello-world');
        });

        test('should handle special Spanish characters', () => {
            expect($exeDevice.normalizeFileName('niño')).toBe('nino');
            expect($exeDevice.normalizeFileName('España')).toBe('espana');
        });

        test('should handle German umlauts', () => {
            expect($exeDevice.normalizeFileName('München')).toBe('muenchen');
            // Note: ß is not in the replacement map so it stays as is
            expect($exeDevice.normalizeFileName('Größe')).toBe('groeße');
        });

        test('should convert to lowercase', () => {
            expect($exeDevice.normalizeFileName('HELLO')).toBe('hello');
            expect($exeDevice.normalizeFileName('TeSt')).toBe('test');
        });

        test('should handle empty string', () => {
            expect($exeDevice.normalizeFileName('')).toBe('');
        });

        test('should handle null/undefined', () => {
            expect($exeDevice.normalizeFileName(null)).toBe('');
            expect($exeDevice.normalizeFileName(undefined)).toBe('');
        });

        test('should handle Polish characters', () => {
            expect($exeDevice.normalizeFileName('łódź')).toBe('lodz');
            expect($exeDevice.normalizeFileName('żółć')).toBe('zolc');
        });

        test('should handle Czech characters', () => {
            // š -> sh, ž -> zh, ť -> t, č -> ch, ý -> y according to replacement map
            expect($exeDevice.normalizeFileName('Příliš')).toBe('prilish');
            expect($exeDevice.normalizeFileName('žluťoučký')).toBe('zhlutouchky');
        });
    });

    describe('extractEvaluationDataHtml', () => {
        test('should extract data from valid HTML', () => {
            const html =
                '<div data-id="idev123" data-evaluationid="eval456" data-evaluationb="true"></div>';
            const result = $exeDevice.extractEvaluationDataHtml(html);
            expect(result).toEqual({
                dataId: 'idev123',
                evaluationId: 'eval456',
                evaluation: true,
            });
        });

        test('should return false for invalid HTML', () => {
            expect($exeDevice.extractEvaluationDataHtml('<div></div>')).toBe(false);
            expect($exeDevice.extractEvaluationDataHtml('')).toBe(false);
            expect($exeDevice.extractEvaluationDataHtml(null)).toBe(false);
        });

        test('should handle evaluation boolean variations', () => {
            const html1 =
                '<div data-id="id1" data-evaluationid="eval1" data-evaluationb="false"></div>';
            const result1 = $exeDevice.extractEvaluationDataHtml(html1);
            expect(result1.evaluation).toBe(false);

            const html2 =
                '<div data-id="id2" data-evaluationid="eval2" data-evaluationb="1"></div>';
            const result2 = $exeDevice.extractEvaluationDataHtml(html2);
            expect(result2.evaluation).toBe(true);

            const html3 =
                '<div data-id="id3" data-evaluationid="eval3" data-evaluationb="yes"></div>';
            const result3 = $exeDevice.extractEvaluationDataHtml(html3);
            expect(result3.evaluation).toBe(true);
        });

        test('should default to true when evaluationb is missing', () => {
            const html =
                '<div data-id="id1" data-evaluationid="eval1"></div>';
            const result = $exeDevice.extractEvaluationDataHtml(html);
            expect(result.evaluation).toBe(true);
        });
    });

    describe('extractEvaluationDataJSON', () => {
        test('should extract data from valid JSON', () => {
            const json = JSON.stringify({
                evaluationID: 'eval789',
                id: 'idev123',
                'data-evaluation': 'true',
            });
            const result = $exeDevice.extractEvaluationDataJSON(json);
            expect(result).toEqual({
                dataId: 'idev123',
                evaluationId: 'eval789',
                evaluation: true,
            });
        });

        test('should return false for invalid JSON', () => {
            expect($exeDevice.extractEvaluationDataJSON('not json')).toBe(false);
            expect($exeDevice.extractEvaluationDataJSON('')).toBe(false);
            expect($exeDevice.extractEvaluationDataJSON(null)).toBe(false);
        });

        test('should handle alternative property names', () => {
            const json = JSON.stringify({
                evaluationId: 'eval1',
                ideviceId: 'idev1',
                'data-evaluationb': 'yes',
            });
            const result = $exeDevice.extractEvaluationDataJSON(json);
            expect(result.evaluationId).toBe('eval1');
            expect(result.dataId).toBe('idev1');
            expect(result.evaluation).toBe(true);
        });

        test('should return false when no evaluationId', () => {
            const json = JSON.stringify({ id: 'idev1' });
            expect($exeDevice.extractEvaluationDataJSON(json)).toBe(false);
        });
    });

    describe('getEvaluatioID', () => {
        test('should extract from HTML when available', () => {
            const html =
                '<div data-id="idev123" data-evaluationid="eval456" data-evaluationb="true"></div>';
            const result = $exeDevice.getEvaluatioID(html, null);
            expect(result).toEqual({
                evaluation: true,
                ideviceID: 'idev123',
                evaluationID: 'eval456',
            });
        });

        test('should fall back to JSON when HTML fails', () => {
            const json = JSON.stringify({
                evaluationID: 'eval789',
                id: 'idev456',
                'data-evaluation': 'true',
            });
            const result = $exeDevice.getEvaluatioID('<div></div>', json);
            expect(result.evaluationID).toBe('eval789');
            expect(result.ideviceID).toBe('idev456');
        });

        test('should return empty values when both fail', () => {
            const result = $exeDevice.getEvaluatioID('<div></div>', 'invalid');
            expect(result).toEqual({
                evaluation: false,
                ideviceID: '',
                evaluationID: '',
            });
        });
    });

    describe('buildNestedPages', () => {
        test('should handle empty array', () => {
            const result = $exeDevice.buildNestedPages([]);
            expect(result).toEqual([]);
        });

        test('should handle flat pages', () => {
            const data = [
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page 1',
                    ode_nav_structure_sync_order: 1,
                },
                {
                    odePageId: 'page2',
                    odeParentPageId: null,
                    pageName: 'Page 2',
                    ode_nav_structure_sync_order: 2,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result.length).toBe(2);
            expect(result[0].title).toBe('Page 1');
            expect(result[1].title).toBe('Page 2');
        });

        test('should handle nested pages', () => {
            const data = [
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Parent',
                    ode_nav_structure_sync_order: 1,
                },
                {
                    odePageId: 'page2',
                    odeParentPageId: 'page1',
                    pageName: 'Child',
                    ode_nav_structure_sync_order: 1,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result.length).toBe(1);
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].title).toBe('Child');
        });

        test('should add components to pages', () => {
            const data = [
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page 1',
                    ode_nav_structure_sync_order: 1,
                    componentId: 'comp1',
                    blockName: 'Block 1',
                    blockOrder: 0,
                    ode_components_sync_order: 1,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result[0].components.length).toBe(1);
            expect(result[0].components[0].blockName).toBe('Block 1');
        });

        test('should sort pages by order', () => {
            const data = [
                {
                    odePageId: 'page2',
                    odeParentPageId: null,
                    pageName: 'Page B',
                    ode_nav_structure_sync_order: 2,
                },
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page A',
                    ode_nav_structure_sync_order: 1,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result[0].title).toBe('Page A');
            expect(result[1].title).toBe('Page B');
        });

        test('should sort components by blockOrder then ode_components_sync_order', () => {
            const data = [
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page 1',
                    ode_nav_structure_sync_order: 1,
                    componentId: 'comp2',
                    blockName: 'Block 2',
                    blockOrder: 2,
                    ode_components_sync_order: 1,
                },
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page 1',
                    ode_nav_structure_sync_order: 1,
                    componentId: 'comp1',
                    blockName: 'Block 1',
                    blockOrder: 1,
                    ode_components_sync_order: 1,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result[0].components[0].blockName).toBe('Block 1');
            expect(result[0].components[1].blockName).toBe('Block 2');
        });

        test('should set first page url to index', () => {
            const data = [
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Home Page',
                    ode_nav_structure_sync_order: 1,
                },
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result[0].url).toBe('index');
        });

        test('should handle null rows gracefully', () => {
            const data = [
                null,
                {
                    odePageId: 'page1',
                    odeParentPageId: null,
                    pageName: 'Page 1',
                    ode_nav_structure_sync_order: 1,
                },
                undefined,
            ];
            const result = $exeDevice.buildNestedPages(data);
            expect(result.length).toBe(1);
        });
    });

    // Note: edition version doesn't have 'options' property - it uses form elements instead

    describe('i18n property', () => {
        test('should have i18n translations defined', () => {
            expect($exeDevice.i18n).toBeDefined();
            expect(typeof $exeDevice.i18n).toBe('object');
        });
    });

    describe('ci18n property', () => {
        test('should have ci18n for custom translations', () => {
            expect($exeDevice.ci18n).toBeDefined();
            expect(typeof $exeDevice.ci18n).toBe('object');
        });
    });

    describe('applyTypeShow', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.applyTypeShow).toBe('function');
        });
    });

    describe('showPages', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.showPages).toBe('function');
        });
    });

    describe('generateHtmlFromPagesEdition', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.generateHtmlFromPagesEdition).toBe('function');
        });
    });

    describe('setMessagesInfo', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.setMessagesInfo).toBe('function');
        });
    });

    describe('createForm', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.createForm).toBe('function');
        });
    });

    describe('init', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.init).toBe('function');
        });
    });

    describe('refreshTranslations', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.refreshTranslations).toBe('function');
        });
    });

    describe('getIdevicesBySessionId', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.getIdevicesBySessionId).toBe('function');
        });
    });

    describe('extractIdevicesFromYjs', () => {
        test('should be defined as a function', () => {
            expect(typeof $exeDevice.extractIdevicesFromYjs).toBe('function');
        });

        test('should use page order instead of navigation index', () => {
            const makeYMap = (data) => ({
                get: (key) => data[key],
            });

            const pageA = makeYMap({
                id: 'page-a',
                title: 'Page A',
                parentId: null,
                order: 9,
                blocks: {
                    length: 0,
                    get: () => null,
                },
            });

            const pageB = makeYMap({
                id: 'page-b',
                title: 'Page B',
                parentId: null,
                order: 2,
                blocks: {
                    length: 0,
                    get: () => null,
                },
            });

            const navigation = {
                length: 2,
                get: (idx) => (idx === 0 ? pageA : pageB),
            };

            const yjsBridge = {
                documentManager: {
                    ydoc: {
                        getArray: () => navigation,
                    },
                },
            };

            const result = $exeDevice.extractIdevicesFromYjs(
                yjsBridge,
                'session-1'
            );

            const rowA = result.find((row) => row.odePageId === 'page-a');
            const rowB = result.find((row) => row.odePageId === 'page-b');

            expect(rowA.ode_nav_structure_sync_order).toBe(9);
            expect(rowB.ode_nav_structure_sync_order).toBe(2);
        });
    });

    describe('msgs property', () => {
        test('should be defined as an object', () => {
            expect($exeDevice.msgs).toBeDefined();
            expect(typeof $exeDevice.msgs).toBe('object');
        });
    });

    describe('number property', () => {
        test('should be a number', () => {
            expect(typeof $exeDevice.number).toBe('number');
            expect($exeDevice.number).toBe(0);
        });
    });

    describe('sessionIdevices property', () => {
        test('should be defined', () => {
            expect($exeDevice.sessionIdevices).toBeDefined();
        });
    });

    describe('edition lifecycle teardown', () => {
        let lifecycle;

        beforeEach(() => {
            // This file stubs jQuery for the pure-function tests; the lifecycle
            // handlers need the real one back.
            global.$ = realJQuery;
            global.jQuery = realJQuery;
            window.$ = realJQuery;
            window.jQuery = realJQuery;

            lifecycle = global.attachEditionLifecycle($exeDevice);

            document.body.innerHTML = `
                <form id="informeQEIdeviceForm">
                    <input type="radio" name="showtype" value="0" />
                    <button id="informeERefresh"></button>
                    <div id="informeEPages"></div>
                </form>`;
        });

        afterEach(() => {
            if (!lifecycle.isDestroyed()) lifecycle.destroy();
            document.body.innerHTML = '';
        });

        test('redraws the pages when the display type is clicked', () => {
            $exeDevice.showPages = vi.fn();
            $exeDevice.addEvents();

            realJQuery('input[name="showtype"]').trigger('click');

            expect($exeDevice.showPages).toHaveBeenCalledTimes(1);
        });

        test('stops handling display type clicks once the edition is closed', () => {
            $exeDevice.showPages = vi.fn();
            $exeDevice.addEvents();

            lifecycle.destroy();
            realJQuery('input[name="showtype"]').trigger('click');

            expect($exeDevice.showPages).not.toHaveBeenCalled();
        });

        test('leaves unrelated document handlers in place after teardown', () => {
            const unrelated = vi.fn();
            realJQuery(document).on('click.informeUnrelated', 'input[name="showtype"]', unrelated);
            $exeDevice.showPages = vi.fn();
            $exeDevice.addEvents();

            lifecycle.destroy();
            realJQuery('input[name="showtype"]').trigger('click');

            expect(unrelated).toHaveBeenCalledTimes(1);
            realJQuery(document).off('click.informeUnrelated');
        });

        test('does not apply a load that resolves after the edition closed', async () => {
            let resolveApi;
            global.eXeLearning = {
                app: {
                    project: { odeSession: 'session-1' },
                    api: {
                        getIdevicesBySessionId: () =>
                            new Promise(resolve => {
                                resolveApi = resolve;
                            }),
                    },
                },
            };
            $exeDevice.sessionIdevices = 'untouched';
            $exeDevice.buildNestedPages = vi.fn(() => []);
            $exeDevice.showPages = vi.fn();

            const pending = $exeDevice.getIdevicesBySessionId();
            lifecycle.destroy();
            resolveApi({ data: [{ id: 'a' }] });
            await pending;

            expect($exeDevice.buildNestedPages).not.toHaveBeenCalled();
            expect($exeDevice.showPages).not.toHaveBeenCalled();
            expect($exeDevice.sessionIdevices).toBe('untouched');
        });

        test('applies a load that resolves while the edition is open', async () => {
            global.eXeLearning = {
                app: {
                    project: { odeSession: 'session-1' },
                    api: {
                        getIdevicesBySessionId: () => Promise.resolve({ data: [{ id: 'a' }] }),
                    },
                },
            };
            $exeDevice.buildNestedPages = vi.fn(() => ['page']);
            $exeDevice.generateHtmlFromPagesEdition = vi.fn(() => '<p>ok</p>');
            $exeDevice.showPages = vi.fn();

            await $exeDevice.getIdevicesBySessionId();

            expect($exeDevice.sessionIdevices).toEqual(['page']);
            expect($exeDevice.showPages).toHaveBeenCalledTimes(1);
            expect(realJQuery('#informeEPages').html()).toBe('<p>ok</p>');
        });
    });
});

describe('progress-report edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/progress-report/edition/';
    const tabNames = () =>
        [...document.querySelectorAll('#reportQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`reportQEIdeviceForm-panel-${name}`);
    const report = (overrides = {}) => ({
        typeGame: 'Progress Report',
        typeshow: 2,
        evaluationID: 'unit-one',
        number: 0,
        showDate: false,
        showTypeGame: false,
        activeLinks: true,
        userData: true,
        sessionIdevices: [],
        msgs: {},
        ...overrides,
    });
    const stored = (data) => `
        <div class="informe-IDevice">
            <div class="informe-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
    let device;
    let tooltips;
    let previousIsJsonString;

    beforeEach(() => {
        // The pure-function suites above replace these globals with stubs.
        global.$ = realJQuery;
        global.jQuery = realJQuery;
        window.$ = realJQuery;
        window.jQuery = realJQuery;
        global.$exeDevices = realExeDevices;
        global._ = realUnderscore;
        previousIsJsonString = realExeDevices.iDevice.gamification.helpers.isJsonString;
        realExeDevices.iDevice.gamification.helpers.isJsonString = (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        };
        tooltips = new Map();
        global.eXeLearning = {
            ...realEXeLearning,
            app: {
                ...realEXeLearning.app,
                project: { odeId: 'ode-1', odeSession: 'session-1' },
                api: { getIdevicesBySessionId: async () => ({ data: [] }) },
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
        global.$exeDevice = undefined;
        document.body.innerHTML = '<div id="progressReportBody"></div>';
        const filename = path.join(__dirname, 'progress-report.js');
        runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        realExeDevices.iDevice.gamification.helpers.isJsonString = previousIsJsonString;
        global.eXeLearning = realEXeLearning;
        vi.unstubAllGlobals();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = {}) =>
        device.init(document.getElementById('progressReportBody'), previousData, PATH);

    it('lays the form out in the shared tabs, and opens on the iDevices it reports', () => {
        open();

        expect(tabNames()).toEqual(['options', 'contents', 'texts']);
        expect(document.getElementById('reportQEIdeviceForm-tab-contents').textContent.trim()).toBe('Questions');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        open();

        for (const id of ['informeEEvaluationID', 'informeEShowDate', 'informeEShowTypeGame', 'informeEActiveLinks', 'informeEUserData', 'showtype0']) {
            expect(panel('options').querySelector(`#${id}`)).not.toBeNull();
        }
        expect(panel('contents').querySelector('#informeEPages')).not.toBeNull();
        expect(panel('contents').querySelector('#informeERefresh')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSummary').value).toBe('Summary of activities');
    });

    it('explains what goes in the Questions tab, and offers no sharing', () => {
        open();
        const info = panel('contents').firstElementChild;

        expect(info.classList.contains('alert-info')).toBe(true);
        expect(info.textContent).toContain('The pages and iDevices of this resource.');
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
        expect(document.querySelectorAll('#reportQEIdeviceForm .exe-block-info')).toHaveLength(0);
    });

    it('provides one accessible information button in each options row', () => {
        open();
        const options = panel('options');
        const helpButtons = [...options.querySelectorAll('#informeEOptions .exe-idevice-help')];
        const state = () => [...options.querySelectorAll('input')].map((input) => `${input.checked}${input.value}`);

        expect(helpButtons).toHaveLength(6);
        for (const help of helpButtons) {
            expect(help.closest('.d-flex')).not.toBeNull();
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const before = state();
            help.click();
            help.closest('.d-flex').querySelector('.help-content')?.click();
            expect(state()).toEqual(before);
        }
    });

    it('disposes all option tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#reportQEIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(6);
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

    it('restores the options of a saved report', () => {
        open(stored(report({ msgs: { msgSummary: 'Your results' } })));

        expect(document.getElementById('informeEEvaluationID').value).toBe('unit-one');
        expect(document.getElementById('informeEShowDate').checked).toBe(false);
        expect(document.getElementById('informeEShowTypeGame').checked).toBe(false);
        expect(document.getElementById('informeEActiveLinks').checked).toBe(true);
        expect(document.getElementById('informeEUserData').checked).toBe(true);
        expect(document.getElementById('showtype2').checked).toBe(true);
        expect(document.getElementById('ci18n_msgSummary').value).toBe('Your results');
    });

    it('saves the options it shows', () => {
        open(stored(report()));

        expect(device.validateData()).toMatchObject({
            evaluationID: 'unit-one',
            typeshow: 2,
            showDate: false,
            showTypeGame: false,
            activeLinks: true,
            userData: true,
        });
        expect(device.save()).not.toContain('exe-idevice-help');
    });

    describe('listed iDevices', () => {
        const pages = [
            {
                id: 'page-1',
                title: 'Unit 1',
                components: [
                    { ideviceID: 'quiz', blockName: 'Quiz', odeIdeviceTypeName: 'trivial' },
                    { ideviceID: 'words', blockName: 'Words', odeIdeviceTypeName: 'word-search' },
                ],
                children: [],
            },
        ];

        it('shows the type of each iDevice only while the option is on', () => {
            open();

            document.getElementById('informeEShowTypeGame').checked = false;
            expect(device.generateHtmlFromPagesEdition(pages)).not.toContain('(trivial)');

            document.getElementById('informeEShowTypeGame').checked = true;
            expect(device.generateHtmlFromPagesEdition(pages)).toContain('(trivial)');
        });

        it('gives no id to the type, which repeats for each iDevice', () => {
            open();
            const list = document.createElement('div');

            list.innerHTML = device.generateHtmlFromPagesEdition(pages);

            expect(list.querySelectorAll('[id="informeEType"]')).toHaveLength(0);
            expect(list.querySelectorAll('.IFPE-ComponentType')).toHaveLength(2);
        });
    });

    it('saves the message for browsers the report does not support', () => {
        open(stored(report()));

        const html = device.save();

        expect(html).toContain('<div class="informe-bns js-hidden">Your browser is not compatible with this tool.</div>');
        expect(html).not.toContain('undefined');
    });
});
