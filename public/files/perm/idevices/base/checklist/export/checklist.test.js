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

    describe('ensureJsPDF', () => {
        afterEach(() => {
            delete window.jspdf;
        });

        it('calls onReady immediately when jspdf already loaded', () => {
            window.jspdf = { jsPDF: function () {} };
            const onReady = vi.fn();
            const onError = vi.fn();
            $checklist.ensureJsPDF(onReady, onError);
            expect(onReady).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
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
});
