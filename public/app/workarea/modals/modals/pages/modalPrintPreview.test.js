import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalPrintPreview, {
    ACTIVITY_MODE_APPENDIX,
    ACTIVITY_MODE_IN_PLACE,
    ACTIVITY_MODE_OMIT,
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

    describe('concurrent previews', () => {
        it('keeps the new mode when an older generation finishes last', async () => {
            let resolveOld;
            const oldDispose = vi.fn();
            const currentDispose = vi.fn();
            window.generatePrintPreview.mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
            window.generateWorksheet.mockResolvedValue({ success: true, html: 'NEW', dispose: currentDispose });
            const oldRequest = modal.show(PREVIEW_MODE_DOCUMENT);
            modal.close();
            await modal.show(PREVIEW_MODE_IDEVICES);
            const created = URL.createObjectURL.mock.calls.length;
            resolveOld({ success: true, html: 'OLD', dispose: oldDispose });
            await oldRequest;
            expect(URL.createObjectURL).toHaveBeenCalledTimes(created);
            expect(modal.mode).toBe(PREVIEW_MODE_IDEVICES);
            expect(oldDispose).toHaveBeenCalledOnce();
            expect(currentDispose).not.toHaveBeenCalled();
            modal.close();
            modal.close();
            expect(currentDispose).toHaveBeenCalledOnce();
        });

        it('ignores a rejected generation after switching mode', async () => {
            let rejectOld;
            window.generatePrintPreview.mockReturnValue(new Promise((resolve, reject) => { rejectOld = reject; }));
            const error = vi.spyOn(modal, 'showError');
            const oldRequest = modal.show();
            await modal.show(PREVIEW_MODE_IDEVICES);
            rejectOld(new Error('stale error'));
            await oldRequest;
            expect(error).not.toHaveBeenCalled();
        });

        it('disposes a result that arrives after the overlay was closed', async () => {
            let resolve;
            const dispose = vi.fn();
            window.generatePrintPreview.mockReturnValue(new Promise(done => { resolve = done; }));
            const pending = modal.show();
            modal.close();
            resolve({ success: true, html: 'CLOSED', dispose });
            await pending;
            expect(modal.isVisible()).toBe(false);
            expect(modal.iframe.getAttribute('src')).toBe('about:blank');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
            expect(dispose).toHaveBeenCalledOnce();
        });

        it('ignores load handlers belonging to the previous request', async () => {
            await modal.show();
            const oldLoad = modal.iframe.onload;
            await modal.show(PREVIEW_MODE_IDEVICES);
            const loading = vi.spyOn(modal, 'showLoading');
            oldLoad();
            expect(loading).not.toHaveBeenCalled();
            modal.iframe.onload();
            expect(loading).toHaveBeenCalledWith(false);
        });

        it('releases result assets if creating the document URL fails', async () => {
            const dispose = vi.fn();
            window.generatePrintPreview.mockResolvedValue({ success: true, html: 'HTML', dispose });
            URL.createObjectURL.mockImplementationOnce(() => { throw new Error('URL failure'); });
            await expect(modal.generatePreview()).rejects.toThrow('URL failure');
            expect(dispose).toHaveBeenCalledOnce();
        });

        it('releases assets attached to a failed result', async () => {
            const dispose = vi.fn();
            window.generatePrintPreview.mockResolvedValue({ success: false, error: 'failed', dispose });
            await expect(modal.generatePreview()).rejects.toThrow('failed');
            expect(dispose).toHaveBeenCalledOnce();
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

describe('ModalPrintPreview and interactive activities', () => {
    let modal;
    let overlayElement;

    /** The options object handed to the shared exporter on the last call. */
    const lastOptions = () => global.window.generatePrintPreview.mock.calls.at(-1)[2];

    beforeEach(() => {
        overlayElement = document.createElement('div');
        overlayElement.id = 'printPreviewOverlay';
        overlayElement.setAttribute('data-visible', 'false');
        overlayElement.innerHTML = `
            <span class="print-preview-title-text"></span>
            <button class="print-preview-print-btn"></button>
            <button class="print-preview-close-btn"></button>
            <div class="print-preview-loading"></div>
            <iframe class="print-preview-iframe"></iframe>
        `;
        document.body.appendChild(overlayElement);

        global.eXeLearning = {
            app: { project: { _yjsEnabled: true, _yjsBridge: { documentManager: {}, assetManager: {} } } },
            config: { baseURL: 'http://localhost:8080', basePath: '', version: 'v1.0.0' },
        };
        global.window.generatePrintPreview = vi.fn().mockResolvedValue({ success: true, html: '<html></html>' });
        global.window.generateWorksheet = vi.fn().mockResolvedValue({ success: true, html: '<html></html>' });
        global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
        global.URL.revokeObjectURL = vi.fn();
        global._ = (str) => str;

        modal = new ModalPrintPreview({});
    });

    afterEach(() => {
        document.body.removeChild(overlayElement);
        vi.clearAllMocks();
    });

    it('asks for nothing when no mode is chosen, as printing always behaved', async () => {
        await modal.show(PREVIEW_MODE_DOCUMENT);

        expect(lastOptions().activities).toBeUndefined();
    });

    it('passes the chosen mode through to the exporter', async () => {
        for (const mode of [ACTIVITY_MODE_OMIT, ACTIVITY_MODE_IN_PLACE, ACTIVITY_MODE_APPENDIX]) {
            await modal.show(PREVIEW_MODE_DOCUMENT, mode);

            expect(lastOptions().activities.mode).toBe(mode);
        }
    });

    it('hands over the strings the exercises need, translated', async () => {
        await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_APPENDIX);
        const { labels, ideviceTitles } = lastOptions().activities;

        expect(labels.appendixTitle).toBe('Appendix');
        expect(labels.appendixReference).toContain('%s');
        expect(labels.notPrintable).toBeTruthy();
        // The worksheet's own labels come along, since the same exercises are drawn either way.
        expect(labels.across).toBe('Across');
        expect(ideviceTitles.guess).toBe('Guess');
    });

    it('tells the exporter where the iDevice files are, for pictures they ship', async () => {
        await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE);

        expect(lastOptions().activities.ideviceBasePath).toBe(
            'http://localhost:8080/files/perm/idevices/base/'
        );
    });

    it('forgets the mode when the next preview does not ask for one', async () => {
        await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE);
        await modal.show(PREVIEW_MODE_DOCUMENT);

        expect(lastOptions().activities).toBeUndefined();
    });

    it('draws the worksheet from the same labels the document preview uses', async () => {
        await modal.show(PREVIEW_MODE_IDEVICES);
        const worksheetOptions = global.window.generateWorksheet.mock.calls.at(-1)[1];

        expect(worksheetOptions.labels).toEqual(modal.getWorksheetLabels());
        expect(worksheetOptions.ideviceTitles).toEqual(modal.getIdeviceTitles());
    });

    describe('the activities the user chose', () => {
        const worksheetOptions = () => global.window.generateWorksheet.mock.calls.at(-1)[1];

        it('reach the document exporter', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_APPENDIX, ['c2']);

            expect(lastOptions().activities.selectedActivities).toEqual(['c2']);
        });

        it('reach the worksheet', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES, null, ['c1', 'c3']);

            expect(worksheetOptions().selectedActivities).toEqual(['c1', 'c3']);
        });

        it('are left out when every one of them is to be printed', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE);
            expect(lastOptions().activities).not.toHaveProperty('selectedActivities');

            await modal.show(PREVIEW_MODE_IDEVICES);
            expect(worksheetOptions()).not.toHaveProperty('selectedActivities');
        });

        it('are forgotten when the next preview does not choose', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES, null, ['c1']);
            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(worksheetOptions()).not.toHaveProperty('selectedActivities');
        });
    });
});
