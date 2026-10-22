/**
 * Unit tests for checklist iDevice (export/runtime)
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeListaCotejo\s*=/, 'global.$eXeListaCotejo =')
        .replace(/\$\(function\s*\(\)\s*\{[\s\S]*?\}\);?\s*$/, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeListaCotejo;
}

describe('checklist iDevice export', () => {
    let $checklist;

    beforeEach(() => {
        global.$eXeListaCotejo = undefined;

        const filePath = join(__dirname, 'checklist.js');
        const code = readFileSync(filePath, 'utf-8');
        $checklist = loadExportIdevice(code);
    });

    describe('getElectronAPI', () => {
        afterEach(() => {
            delete window.electronAPI;
        });

        it('returns window.electronAPI when present', () => {
            const fakeAPI = { saveBufferAs: vi.fn() };
            window.electronAPI = fakeAPI;
            expect($checklist.getElectronAPI()).toBe(fakeAPI);
        });

        it('returns window.parent.electronAPI from iframe context', () => {
            // In happy-dom window.parent === window, so set it directly
            const fakeAPI = { saveBufferAs: vi.fn() };
            window.electronAPI = fakeAPI;
            expect($checklist.getElectronAPI()).toBe(fakeAPI);
        });

        it('returns null when no electronAPI exists', () => {
            expect($checklist.getElectronAPI()).toBeNull();
        });
    });

    describe('saveReport Electron PDF path', () => {
        let mockSaveBufferAs;

        beforeEach(() => {
            mockSaveBufferAs = vi.fn().mockResolvedValue({ saved: true });
            window.electronAPI = { saveBufferAs: mockSaveBufferAs };
        });

        afterEach(() => {
            delete window.electronAPI;
            delete window.jspdf;
            delete window.html2canvas;
        });

        it('doPdf uses electronAPI.saveBufferAs with Uint8Array instead of pdf.save', async () => {
            const pdfSaveSpy = vi.fn();
            const fakeBlob = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
            window.jspdf = {
                jsPDF: function () {
                    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
                    this.getImageProperties = () => ({ width: 800, height: 600 });
                    this.addImage = vi.fn();
                    this.addPage = vi.fn();
                    this.output = vi.fn().mockReturnValue(fakeBlob);
                    this.save = pdfSaveSpy;
                },
            };

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

            document.body.innerHTML = '<div id="ctjList-0">Content</div>';
            window.html2canvas = vi.fn().mockResolvedValue(canvas);

            $checklist.options[0] = {
                msgs: { msgList: 'checklist' },
            };
            $checklist.saveReport(0);

            await new Promise((r) => setTimeout(r, 300));

            expect(pdfSaveSpy).not.toHaveBeenCalled();
            expect(mockSaveBufferAs).toHaveBeenCalledTimes(1);
            expect(mockSaveBufferAs.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
            expect(mockSaveBufferAs.mock.calls[0][1]).toBe('checklist-pdf');
            expect(mockSaveBufferAs.mock.calls[0][2]).toBe('checklist.pdf');
        });

        it('fallbackPng uses electronAPI.saveBufferAs with Uint8Array when jsPDF unavailable', async () => {
            window.jspdf = undefined;
            vi.stubGlobal('$exe', { loadJsPDF: vi.fn((onReady, onError) => onError()) });

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

            document.body.innerHTML = '<div id="ctjList-0">Content</div>';
            window.html2canvas = vi.fn().mockResolvedValue(canvas);

            $checklist.options[0] = {
                msgs: { msgList: 'checklist' },
            };
            $checklist.saveReport(0);

            await new Promise((r) => setTimeout(r, 300));

            expect(mockSaveBufferAs).toHaveBeenCalledTimes(1);
            expect($exe.loadJsPDF).toHaveBeenCalledTimes(1);
            vi.unstubAllGlobals();
            expect(mockSaveBufferAs.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
            expect(mockSaveBufferAs.mock.calls[0][0].length).toBeGreaterThan(0);
            expect(mockSaveBufferAs.mock.calls[0][1]).toBe('checklist-png');
            expect(mockSaveBufferAs.mock.calls[0][2]).toBe('checklist.png');
        });
    });

    describe('saveReport browser fallback', () => {
        afterEach(() => {
            delete window.jspdf;
            delete window.html2canvas;
        });

        it('doPdf calls pdf.save when not in Electron', async () => {
            const pdfSaveSpy = vi.fn();
            window.jspdf = {
                jsPDF: function () {
                    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
                    this.getImageProperties = () => ({ width: 800, height: 600 });
                    this.addImage = vi.fn();
                    this.addPage = vi.fn();
                    this.output = vi.fn();
                    this.save = pdfSaveSpy;
                },
            };

            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

            document.body.innerHTML = '<div id="ctjList-0">Content</div>';
            window.html2canvas = vi.fn().mockResolvedValue(canvas);

            $checklist.options[0] = {
                msgs: { msgList: 'lista' },
            };
            $checklist.saveReport(0);

            await new Promise((r) => setTimeout(r, 300));

            expect(pdfSaveSpy).toHaveBeenCalledTimes(1);
            expect(pdfSaveSpy).toHaveBeenCalledWith('lista.pdf');
        });
    });

    describe('convertToNumber', () => {
        it('converts valid number string', () => {
            expect($checklist.convertToNumber('5')).toBe(5);
        });

        it('returns 0 for NaN input', () => {
            expect($checklist.convertToNumber('abc')).toBe(0);
        });

        it('returns 0 for empty string', () => {
            expect($checklist.convertToNumber('')).toBe(0);
        });
    });

    describe('loadDataGame', () => {
        it('returns defaults for invalid JSON data', () => {
            // Mock helpers
            const origHelpers = global.$exeDevices;
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        helpers: {
                            decrypt: (x) => x,
                            isJsonString: () => null,
                        },
                    },
                },
            };

            const data = $('<span>invalid-json</span>');
            const result = $checklist.loadDataGame(data, '', '', '');

            expect(result.levels).toEqual([]);
            expect(result.urlCommunity).toBe('');

            global.$exeDevices = origHelpers;
        });
    });

    describe('where a checklist keeps its list', () => {
        let previousLocalStorage;
        let previousExeDevices;
        let store;

        // One checkbox item, as createItems renders it, plus the learner's name and date.
        const renderList = () => {
            document.body.innerHTML = `
                <input type="text" id="ctjUserName-0">
                <input type="text" id="ctjUserDate-0">
                <div id="ctjItems-0"><div class="CTJP-Item"><input type="checkbox"></div></div>
                <button type="button" id="ctjReboot-0"></button>`;
        };
        const ticked = () => $('#ctjItems-0 input[type="checkbox"]').is(':checked');

        beforeEach(() => {
            previousLocalStorage = global.localStorage;
            previousExeDevices = global.$exeDevices;
            store = {};
            global.localStorage = {
                getItem: (key) => (key in store ? store[key] : null),
                setItem: (key, value) => {
                    store[key] = String(value);
                },
                removeItem: (key) => {
                    delete store[key];
                },
            };
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        helpers: {
                            isJsonString: (value) => (typeof value === 'string' ? JSON.parse(value) : false),
                        },
                        math: { hasLatex: () => false },
                    },
                },
            };
            renderList();
        });

        afterEach(() => {
            global.localStorage = previousLocalStorage;
            global.$exeDevices = previousExeDevices;
            document.body.innerHTML = '';
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        });

        it("names the entry after the checklist's own component", () => {
            document.body.innerHTML =
                '<div class="idevice_node checklist" id="idevice-abc"><div class="listacotejo-IDevice"></div></div>';

            expect($checklist.storageKeyOf(document.querySelector('.listacotejo-IDevice'))).toBe(
                'dataCotejo-idevice-abc'
            );
        });

        it('gives no key to a checklist outside any component', () => {
            document.body.innerHTML = '<div class="listacotejo-IDevice"></div>';

            expect($checklist.storageKeyOf(document.querySelector('.listacotejo-IDevice'))).toBe('');
        });

        it('keeps the list under its own component, not under the id its data carries', () => {
            $checklist.options = [
                { id: 'idevice-original', storageKey: 'dataCotejo-idevice-copy', saveData: true, save: true },
            ];
            $('#ctjItems-0 input[type="checkbox"]').prop('checked', true);

            $checklist.saveCotejo(0);

            expect(JSON.parse(store['dataCotejo-idevice-copy']).items).toEqual([{ type: 0, state: 1, text: '' }]);
            expect(store['dataCotejo-idevice-original']).toBeUndefined();
        });

        it('keeps nothing when it belongs to no component', () => {
            $checklist.options = [{ id: 'idevice-original', storageKey: '', saveData: true, save: true }];

            $checklist.saveCotejo(0);

            expect(Object.keys(store)).toEqual([]);
        });

        it("comes back with its own list, not another checklist's", () => {
            const tickedList = JSON.stringify({ name: '', date: '', items: [{ type: 0, state: 1, text: '' }] });
            store['dataCotejo-idevice-original'] = tickedList;
            vi.spyOn($checklist, 'counter').mockImplementation(() => {});
            $checklist.options = [
                { id: 'idevice-original', storageKey: 'dataCotejo-idevice-copy', saveData: true, msgs: {} },
            ];

            $checklist.addEvents(0);
            expect(ticked()).toBe(false);

            store['dataCotejo-idevice-copy'] = tickedList;
            renderList();
            $checklist.addEvents(0);
            expect(ticked()).toBe(true);
        });

        it('starting over forgets its own list only', () => {
            store['dataCotejo-idevice-copy'] = '{}';
            store['dataCotejo-idevice-original'] = '{}';
            vi.spyOn($checklist, 'counter').mockImplementation(() => {});
            vi.spyOn($checklist, 'createItems').mockReturnValue('');
            vi.stubGlobal('confirm', () => true);
            $checklist.options = [
                { id: 'idevice-original', storageKey: 'dataCotejo-idevice-copy', saveData: true, msgs: {} },
            ];
            $checklist.addEvents(0);

            $('#ctjReboot-0').trigger('click');

            expect(store['dataCotejo-idevice-copy']).toBeUndefined();
            expect(store['dataCotejo-idevice-original']).toBe('{}');
        });

        it('starting over touches no entry when it belongs to no component', () => {
            store['dataCotejo-'] = '{}';
            vi.spyOn($checklist, 'counter').mockImplementation(() => {});
            vi.spyOn($checklist, 'createItems').mockReturnValue('');
            vi.stubGlobal('confirm', () => true);
            $checklist.options = [{ id: false, storageKey: '', saveData: true, msgs: {} }];
            $checklist.addEvents(0);

            $('#ctjReboot-0').trigger('click');

            expect(store['dataCotejo-']).toBe('{}');
        });
    });
});

describe('jsPDF loading', () => {
    it('uses the shared bundled copy through $exe.loadJsPDF, never a CDN', () => {
        const code = readFileSync(join(__dirname, 'checklist.js'), 'utf-8');
        expect(code).not.toMatch(/https?:\/\/[^'"`]*jspdf/i);
        expect(code).toContain('$exe.loadJsPDF(');
        expect(code).not.toContain('ensureJsPDF');
    });
});
