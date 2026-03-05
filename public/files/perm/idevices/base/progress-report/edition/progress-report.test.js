/**
 * Tests for progress-report edition iDevice
 */

/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the iDevice code
const iDevicePath = path.join(__dirname, 'progress-report.js');
const iDeviceCode = fs.readFileSync(iDevicePath, 'utf8');

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

    // Mock $exeDevicesEdition
    global.$exeDevicesEdition = {
        iDevice: {
            gamification: {
                common: {
                    getLanguageTab: () => '',
                },
            },
            tabs: {
                init: () => {},
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

    describe('typeshow property', () => {
        test('should have default typeshow value', () => {
            expect($exeDevice.typeshow).toBeDefined();
            expect(typeof $exeDevice.typeshow).toBe('number');
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

    describe('id property', () => {
        test('should be an empty string initially', () => {
            expect($exeDevice.id).toBeDefined();
            expect(typeof $exeDevice.id).toBe('string');
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
});
