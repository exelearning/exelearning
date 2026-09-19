import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalPrintPreview, {
    PREVIEW_MODE_DOCUMENT,
    PREVIEW_MODE_IDEVICES,
} from './modalPrintPreview.js';

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
                <div class="print-preview-title"><span class="print-preview-title-text">Print preview</span></div>
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
        global.window.generateWorksheet = vi.fn().mockResolvedValue({
            success: true,
            html: '<html><body>Worksheet</body></html>',
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
    });

    describe('print', () => {
        it('should call iframe contentWindow.print()', () => {
            const mockPrint = vi.fn();
            modal.iframe = {
                contentWindow: { print: mockPrint },
                classList: { toggle: vi.fn(), add: vi.fn() },
                src: '',
            };

            modal.print();

            expect(mockPrint).toHaveBeenCalled();
        });

        it('should not throw when iframe has no contentWindow', () => {
            modal.iframe = {
                contentWindow: null,
                classList: { toggle: vi.fn(), add: vi.fn() },
            };

            expect(() => modal.print()).not.toThrow();
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

    describe('preview modes', () => {
        it('should default to the document mode', async () => {
            await modal.show();

            expect(modal.mode).toBe(PREVIEW_MODE_DOCUMENT);
            expect(global.window.generatePrintPreview).toHaveBeenCalled();
            expect(global.window.generateWorksheet).not.toHaveBeenCalled();
        });

        it('should build the worksheet in the idevices mode', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(modal.mode).toBe(PREVIEW_MODE_IDEVICES);
            expect(global.window.generateWorksheet).toHaveBeenCalled();
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
        });

        it('should load the worksheet into the iframe', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(modal.iframe.src).toContain('blob:test-url');
        });

        it('should pass the document manager, labels and asset manager to the worksheet', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES);

            const [documentManager, options, assetManager] =
                global.window.generateWorksheet.mock.calls[0];

            expect(documentManager).toBe(
                global.eXeLearning.app.project._yjsBridge.documentManager
            );
            expect(assetManager).toBe(
                global.eXeLearning.app.project._yjsBridge.assetManager
            );
            expect(options.labels.studentName).toBe('Name');
            expect(options.labels.date).toBe('Date');
            expect(options.ideviceTitles.guess).toBe('Guess');
        });

        it('should switch the heading to match the mode', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES);
            expect(modal.titleEl.textContent).toBe('Print iDevices');

            await modal.show(PREVIEW_MODE_DOCUMENT);
            expect(modal.titleEl.textContent).toBe('Print preview');
        });

        it('should fall back to SharedExporters when the global is absent', async () => {
            delete global.window.generateWorksheet;
            const shared = vi
                .fn()
                .mockResolvedValue({ success: true, html: '<html></html>' });
            global.window.SharedExporters = { generateWorksheet: shared };

            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(shared).toHaveBeenCalled();
            delete global.window.SharedExporters;
        });

        it('should report a missing worksheet generator', async () => {
            delete global.window.generateWorksheet;

            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(modal.loadingEl.innerHTML).toContain(
                'Print iDevices is not available.'
            );
        });

        it('should report a failed worksheet generation', async () => {
            global.window.generateWorksheet.mockResolvedValue({
                success: false,
                error: 'No activities',
            });

            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(modal.loadingEl.innerHTML).toContain('No activities');
        });

        it('should require Yjs mode', async () => {
            global.eXeLearning.app.project._yjsEnabled = false;

            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(modal.loadingEl.innerHTML).toContain(
                'Print preview requires server mode'
            );
            expect(global.window.generateWorksheet).not.toHaveBeenCalled();
        });
    });
});
