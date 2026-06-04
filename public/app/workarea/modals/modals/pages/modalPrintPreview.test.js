import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalPrintPreview from './modalPrintPreview.js';

describe('ModalPrintPreview', () => {
    let modal;
    let mockManager;
    let overlayElement;

    beforeEach(() => {
        // Create mock overlay element
        overlayElement = document.createElement('div');
        overlayElement.id = 'printPreviewOverlay';
        overlayElement.className = 'print-preview-overlay';
        overlayElement.setAttribute('data-visible', 'false');
        overlayElement.innerHTML = `
            <div class="print-preview-header">
                <div class="print-preview-title">Print preview</div>
                <div class="print-preview-options">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printOptPageNumbers" checked>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printOptLinkUrls" checked>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printOptWatermark">
                    </div>
                </div>
                <div class="print-preview-actions">
                    <button class="print-preview-print-btn"></button>
                    <button class="print-preview-close-btn"></button>
                </div>
            </div>
            <div class="print-preview-content">
                <div class="print-preview-loading"></div>
                <iframe class="print-preview-iframe"></iframe>
            </div>
        `;
        document.body.appendChild(overlayElement);

        // Mock manager
        mockManager = {};

        // Mock global eXeLearning
        global.eXeLearning = {
            app: {
                project: {
                    _yjsEnabled: true,
                    _yjsBridge: {
                        documentManager: {},
                        assetManager: {
                            resolveAssetUrlsAsync: vi.fn((html) => Promise.resolve(html)),
                        },
                    },
                },
            },
            config: {
                baseURL: 'http://localhost:8080',
                basePath: '',
                version: 'v1.0.0',
            },
        };

        // Mock window functions
        global.window.generatePrintPreview = vi.fn().mockResolvedValue({
            success: true,
            html: '<html><body>Test content</body></html>',
        });
        global.window.ResourceFetcher = class MockResourceFetcher {};

        // Mock URL
        global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock _ translation function
        global._ = (str) => str;

        modal = new ModalPrintPreview(mockManager);
    });

    afterEach(() => {
        document.body.removeChild(overlayElement);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should find overlay element', () => {
            expect(modal.overlay).toBeTruthy();
            expect(modal.overlay.id).toBe('printPreviewOverlay');
        });

        it('should find iframe element', () => {
            expect(modal.iframe).toBeTruthy();
            expect(modal.iframe.classList.contains('print-preview-iframe')).toBe(true);
        });

        it('should find loading element', () => {
            expect(modal.loadingEl).toBeTruthy();
        });

        it('should find print button', () => {
            expect(modal.printBtn).toBeTruthy();
        });

        it('should find close button', () => {
            expect(modal.closeBtn).toBeTruthy();
        });

        it('should initialize blobUrl as null', () => {
            expect(modal.blobUrl).toBeNull();
        });

        it('should initialize printWindowUrl as null', () => {
            expect(modal.printWindowUrl).toBeNull();
        });
    });

    describe('behaviour', () => {
        it('should add click listener to print button', () => {
            const printSpy = vi.spyOn(modal, 'print').mockImplementation(() => {});
            modal.behaviour();

            modal.printBtn.click();

            expect(printSpy).toHaveBeenCalled();
        });

        it('should add click listener to close button', () => {
            const closeSpy = vi.spyOn(modal, 'close');
            modal.behaviour();

            modal.closeBtn.click();

            expect(closeSpy).toHaveBeenCalled();
        });
    });

    describe('isVisible', () => {
        it('should return true when data-visible is true', () => {
            overlayElement.setAttribute('data-visible', 'true');
            expect(modal.isVisible()).toBe(true);
        });

        it('should return false when data-visible is false', () => {
            overlayElement.setAttribute('data-visible', 'false');
            expect(modal.isVisible()).toBe(false);
        });
    });

    describe('getPrintOptions', () => {
        it('should return default checked states from checkboxes', () => {
            const options = modal.getPrintOptions();
            expect(options.showPageNumbers).toBe(true);
            expect(options.showLinkUrls).toBe(true);
            expect(options.showWatermark).toBe(false);
        });

        it('should reflect unchecked page numbers', () => {
            document.getElementById('printOptPageNumbers').checked = false;
            const options = modal.getPrintOptions();
            expect(options.showPageNumbers).toBe(false);
        });

        it('should reflect checked watermark', () => {
            document.getElementById('printOptWatermark').checked = true;
            const options = modal.getPrintOptions();
            expect(options.showWatermark).toBe(true);
        });

        it('should reflect unchecked link URLs', () => {
            document.getElementById('printOptLinkUrls').checked = false;
            const options = modal.getPrintOptions();
            expect(options.showLinkUrls).toBe(false);
        });

        it('should return defaults when checkboxes are missing', () => {
            // Remove checkboxes from DOM
            overlayElement.querySelectorAll('input[type="checkbox"]').forEach(el => el.remove());
            const options = modal.getPrintOptions();
            expect(options.showPageNumbers).toBe(true);
            expect(options.showWatermark).toBe(false);
            expect(options.showLinkUrls).toBe(true);
        });
    });

    describe('buildPreviewOptions', () => {
        it('should include print options from checkboxes', () => {
            const options = modal.buildPreviewOptions();
            expect(options.showPageNumbers).toBe(true);
            expect(options.showLinkUrls).toBe(true);
            expect(options.showWatermark).toBe(false);
            expect(options.baseUrl).toBe('http://localhost:8080');
        });

        it('should merge extra options', () => {
            const options = modal.buildPreviewOptions({ printMode: true });
            expect(options.printMode).toBe(true);
            expect(options.showPageNumbers).toBe(true);
        });

        it('should allow extra options to override checkbox options', () => {
            const options = modal.buildPreviewOptions({ showPageNumbers: false });
            expect(options.showPageNumbers).toBe(false);
        });
    });

    describe('show', () => {
        it('should set data-visible to true', async () => {
            vi.spyOn(modal, 'generatePreview').mockResolvedValue();

            await modal.show();

            expect(overlayElement.getAttribute('data-visible')).toBe('true');
        });

        it('should call generatePreview', async () => {
            const generateSpy = vi.spyOn(modal, 'generatePreview').mockResolvedValue();

            await modal.show();

            expect(generateSpy).toHaveBeenCalled();
        });

        it('should show error on generatePreview failure', async () => {
            const showErrorSpy = vi.spyOn(modal, 'showError');
            vi.spyOn(modal, 'generatePreview').mockRejectedValue(new Error('Test error'));

            await modal.show();

            expect(showErrorSpy).toHaveBeenCalledWith('Test error');
        });
    });

    describe('close', () => {
        it('should set data-visible to false', () => {
            overlayElement.setAttribute('data-visible', 'true');

            modal.close();

            expect(overlayElement.getAttribute('data-visible')).toBe('false');
        });

        it('should call cleanup', () => {
            const cleanupSpy = vi.spyOn(modal, 'cleanup');

            modal.close();

            expect(cleanupSpy).toHaveBeenCalled();
        });
    });

    describe('generatePreview', () => {
        beforeEach(() => {
            // Mock iframe src setter to avoid happy-dom Blob URL error
            if (modal.iframe) {
                Object.defineProperty(modal.iframe, 'src', {
                    set: vi.fn(),
                    get: () => '',
                    configurable: true
                });
            }
        });

        it('should throw error when Yjs is not enabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;

            await expect(modal.generatePreview()).rejects.toThrow('Print preview requires server mode');
        });

        it('should throw error when document manager not available', async () => {
            eXeLearning.app.project._yjsBridge = null;

            await expect(modal.generatePreview()).rejects.toThrow('Document manager not available');
        });

        it('should throw error when generatePrintPreview not loaded', async () => {
            window.generatePrintPreview = undefined;
            window.SharedExporters = undefined;

            await expect(modal.generatePreview()).rejects.toThrow('Print preview not available');
        });

        it('should call generatePrintPreview', async () => {
            await modal.generatePreview();

            expect(window.generatePrintPreview).toHaveBeenCalled();
        });

        it('should create blob URL', async () => {
            await modal.generatePreview();

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(modal.blobUrl).toBe('blob:test-url');
        });

        it('should throw error when generation fails', async () => {
            window.generatePrintPreview = vi.fn().mockResolvedValue({
                success: false,
                error: 'Generation failed',
            });

            await expect(modal.generatePreview()).rejects.toThrow('Generation failed');
        });

        it('should resolve asset URLs when assetManager is available', async () => {
            const assetManager = eXeLearning.app.project._yjsBridge.assetManager;

            await modal.generatePreview();

            // Verify that assetManager was passed as the 4th argument
            const calls = window.generatePrintPreview.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][3]).toBe(assetManager);
        });

        it('should pass print options to generatePrintPreview', async () => {
            document.getElementById('printOptWatermark').checked = true;

            await modal.generatePreview();

            const calls = window.generatePrintPreview.mock.calls;
            const optionsArg = calls[0][2];
            expect(optionsArg.showPageNumbers).toBe(true);
            expect(optionsArg.showWatermark).toBe(true);
            expect(optionsArg.showLinkUrls).toBe(true);
        });
    });

    describe('print', () => {
        it('should call openPrintWindow', async () => {
            const openSpy = vi.spyOn(modal, 'openPrintWindow').mockResolvedValue();

            await modal.print();

            expect(openSpy).toHaveBeenCalled();
        });

        it('should fall back to iframe print if openPrintWindow fails', async () => {
            vi.spyOn(modal, 'openPrintWindow').mockRejectedValue(new Error('blocked'));
            const mockPrint = vi.fn();
            modal.iframe = {
                contentWindow: { print: mockPrint },
                classList: { toggle: vi.fn(), add: vi.fn() },
                src: '',
            };

            await modal.print();

            expect(mockPrint).toHaveBeenCalled();
        });

        it('should not throw when fallback also has no contentWindow', async () => {
            vi.spyOn(modal, 'openPrintWindow').mockRejectedValue(new Error('blocked'));
            modal.iframe = {
                contentWindow: null,
                classList: { toggle: vi.fn(), add: vi.fn() },
            };

            await expect(modal.print()).resolves.toBeUndefined();
        });
    });

    describe('openPrintWindow', () => {
        beforeEach(() => {
            global.window.open = vi.fn(() => ({ closed: false }));
        });

        it('should call generatePrintPreview with printMode true', async () => {
            await modal.openPrintWindow();

            const calls = window.generatePrintPreview.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            const optionsArg = calls[0][2];
            expect(optionsArg.printMode).toBe(true);
        });

        it('should create blob URL for print window', async () => {
            await modal.openPrintWindow();

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(modal.printWindowUrl).toBe('blob:test-url');
        });

        it('should open window with blob URL', async () => {
            await modal.openPrintWindow();

            expect(window.open).toHaveBeenCalledWith('blob:test-url', '_blank');
        });

        it('should throw if window.open returns null (blocked popup)', async () => {
            global.window.open = vi.fn(() => null);

            await expect(modal.openPrintWindow()).rejects.toThrow('Could not open print window');
        });

        it('should revoke previous printWindowUrl before creating new one', async () => {
            modal.printWindowUrl = 'blob:old-url';

            await modal.openPrintWindow();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old-url');
        });

        it('should throw error when Yjs is not enabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;

            await expect(modal.openPrintWindow()).rejects.toThrow('Print preview requires server mode');
        });

        it('should pass print options from checkboxes', async () => {
            document.getElementById('printOptWatermark').checked = true;
            document.getElementById('printOptPageNumbers').checked = false;

            await modal.openPrintWindow();

            const calls = window.generatePrintPreview.mock.calls;
            const optionsArg = calls[0][2];
            expect(optionsArg.printMode).toBe(true);
            expect(optionsArg.showWatermark).toBe(true);
            expect(optionsArg.showPageNumbers).toBe(false);
        });
    });

    describe('showLoading', () => {
        it('should toggle hidden class on loading element', () => {
            modal.showLoading(true);
            expect(modal.loadingEl.classList.contains('hidden')).toBe(false);

            modal.showLoading(false);
            expect(modal.loadingEl.classList.contains('hidden')).toBe(true);
        });

        it('should toggle hidden class on iframe', () => {
            modal.showLoading(true);
            expect(modal.iframe.classList.contains('hidden')).toBe(true);

            modal.showLoading(false);
            expect(modal.iframe.classList.contains('hidden')).toBe(false);
        });
    });

    describe('showError', () => {
        it('should display error message in loading element', () => {
            modal.showError('Test error message');

            expect(modal.loadingEl.innerHTML).toContain('Test error message');
            expect(modal.loadingEl.innerHTML).toContain('print-preview-error');
        });

        it('should hide iframe', () => {
            modal.showError('Test error');

            expect(modal.iframe.classList.contains('hidden')).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should revoke blob URL if exists', () => {
            modal.blobUrl = 'blob:test-url';

            modal.cleanup();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
            expect(modal.blobUrl).toBeNull();
        });

        it('should revoke printWindowUrl if exists', () => {
            modal.printWindowUrl = 'blob:print-url';

            modal.cleanup();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:print-url');
            expect(modal.printWindowUrl).toBeNull();
        });

        it('should reset iframe src', () => {
            modal.cleanup();

            expect(modal.iframe.src).toContain('about:blank');
        });

        it('should reset loading indicator', () => {
            modal.loadingEl.innerHTML = 'Error';

            modal.cleanup();

            expect(modal.loadingEl.innerHTML).toContain('spinner-border');
        });

        it('should not throw when blobUrl is null', () => {
            modal.blobUrl = null;

            expect(() => modal.cleanup()).not.toThrow();
        });
    });
});
