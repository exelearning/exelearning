import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalPrintPreview, {
    ACTIVITY_MODE_APPENDIX,
    ACTIVITY_MODE_IN_PLACE,
    ACTIVITY_MODE_OMIT,
    PREVIEW_MODE_DOCUMENT,
    PREVIEW_MODE_IDEVICES,
    PRINT_AS_SHOWN_CLASS,
    REGENERATE_DELAY_MS,
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

        it('should have no options panel where the page has no markup for it', () => {
            expect(modal.panel).toBeNull();
            expect(modal.optionsBtn).toBeNull();
        });
    });

    describe('concurrent previews', () => {
        it('waits for a closed preview before generating the newly opened mode', async () => {
            let resolveOld;
            const oldDispose = vi.fn();
            const currentDispose = vi.fn();
            window.generatePrintPreview.mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
            window.generateWorksheet.mockResolvedValue({ success: true, html: 'NEW', dispose: currentDispose });
            const oldRequest = modal.show(PREVIEW_MODE_DOCUMENT);
            modal.close();
            const newRequest = modal.show(PREVIEW_MODE_IDEVICES);
            expect(window.generateWorksheet).not.toHaveBeenCalled();
            resolveOld({ success: true, html: 'OLD', dispose: oldDispose });
            await Promise.all([oldRequest, newRequest]);
            expect(URL.createObjectURL).toHaveBeenCalledOnce();
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
            const newRequest = modal.show(PREVIEW_MODE_IDEVICES);
            rejectOld(new Error('stale error'));
            await Promise.all([oldRequest, newRequest]);
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
        it('should call iframe contentWindow.print() for a loaded preview', () => {
            overlayElement.setAttribute('data-visible', 'true');
            modal.ready = true;
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
            overlayElement.setAttribute('data-visible', 'true');
            modal.ready = true;
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

describe('ModalPrintPreview and its options panel', () => {
    let modal;
    let overlayElement;

    const ACTIVITIES = [
        { id: 'c1', type: 'guess', pageTitle: 'Tema 1', blockTitle: '' },
        { id: 'c2', type: 'crossword', pageTitle: 'Tema 2', blockTitle: 'Repaso final' },
        { id: 'c3', type: 'guess', pageTitle: 'Tema 3', blockTitle: '' },
    ];

    const panelEl = () => overlayElement.querySelector('.print-options-panel');
    const optionsBtn = () => overlayElement.querySelector('.print-preview-options-btn');
    const printBtn = () => overlayElement.querySelector('.print-preview-print-btn');
    const radios = () => [...overlayElement.querySelectorAll('input[name="print-activity-mode"]')];
    const checkedChoice = () =>
        overlayElement.querySelector('input[name="print-activity-mode"]:checked')?.value;
    const boxes = () => [...overlayElement.querySelectorAll('input[name="print-activity-selected"]')];
    const status = () => overlayElement.querySelector('.print-options-status').textContent;
    const linkUrls = () => overlayElement.querySelector('#printOptLinkUrls');
    const unfoldBlocks = () => overlayElement.querySelector('#printOptUnfoldBlocks');
    const unprintable = () => overlayElement.querySelector('#printOptUnprintableTitles');
    const busy = () => overlayElement.getAttribute('data-busy');
    const lastOptions = () => global.window.generatePrintPreview.mock.calls.at(-1)[2];
    const lastWorksheetOptions = () => global.window.generateWorksheet.mock.calls.at(-1)[1];

    /** Pick a choice, clearing the others as the browser would (happy-dom does not). */
    const choose = (value) => {
        radios().forEach((input) => {
            input.checked = input.value === value;
        });
        radios()
            .find((input) => input.value === value)
            .dispatchEvent(new Event('change'));
    };
    const tick = (input, checked) => {
        input.checked = checked;
        input.dispatchEvent(new Event('change'));
    };
    /** Let the wait before drawing the preview again pass, and the drawing finish. */
    const settle = () => vi.advanceTimersByTimeAsync(REGENERATE_DELAY_MS);
    /** The browser reports the document in the frame as loaded. */
    const loaded = () => modal.iframe.onload();
    /** Give the frame a document of its own, as the browser does once a preview loads in it. */
    const frameDocument = () => {
        const doc = document.implementation.createHTMLDocument('preview');
        Object.defineProperty(modal.iframe, 'contentDocument', { configurable: true, get: () => doc });
        return doc;
    };
    /** A preview loads in the frame; returns the <html> of its document. */
    const loadedPage = () => {
        const doc = frameDocument();
        loaded();
        return doc.documentElement;
    };

    /** Show the preview of a project that has the three activities above. */
    const showWithActivities = (mode = PREVIEW_MODE_DOCUMENT, activityMode = ACTIVITY_MODE_IN_PLACE, selected = null) =>
        modal.show(mode, activityMode, selected, ACTIVITIES);

    beforeEach(() => {
        vi.useFakeTimers();
        overlayElement = document.createElement('div');
        overlayElement.id = 'printPreviewOverlay';
        overlayElement.setAttribute('data-visible', 'false');
        overlayElement.setAttribute('data-busy', 'false');
        overlayElement.innerHTML = `
            <span class="print-preview-title-text">Print preview</span>
            <button class="print-preview-options-btn" aria-expanded="false" hidden></button>
            <button class="print-preview-print-btn"></button>
            <button class="print-preview-close-btn"></button>
            <div class="print-preview-loading"></div>
            <iframe class="print-preview-iframe"></iframe>
            <aside class="print-options-panel" hidden>
                <button class="print-options-close"></button>
                <div class="print-options-body">
                    <div class="print-options-activities" hidden></div>
                    <fieldset class="print-options-document">
                        <input type="checkbox" id="printOptLinkUrls" checked>
                        <input type="checkbox" id="printOptUnfoldBlocks" checked>
                        <div class="form-check" hidden><input type="checkbox" id="printOptUnprintableTitles"></div>
                    </fieldset>
                </div>
                <p class="print-options-status"></p>
            </aside>
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
        modal.behaviour();
    });

    afterEach(() => {
        modal.close();
        vi.useRealTimers();
        document.body.removeChild(overlayElement);
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    describe('when the preview opens', () => {
        it('builds the panel from the markup', () => {
            expect(modal.panel).not.toBeNull();
            expect(modal.optionsBtn).toBe(optionsBtn());
        });

        it('offers only the document options when the project has no interactive activity', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);

            expect(panelEl().hidden).toBe(false);
            expect(optionsBtn().hidden).toBe(false);
            expect(radios()).toHaveLength(0);
            expect(linkUrls().disabled).toBe(false);
            // The document prints as it always did, links with their URLs.
            expect(lastOptions().activities).toBeUndefined();
            expect(lastOptions().showLinkUrls).toBe(true);
        });

        it('offers the choices when it has some, with the one it is given preselected', async () => {
            await showWithActivities();

            expect(panelEl().hidden).toBe(false);
            expect(optionsBtn().hidden).toBe(false);
            expect(optionsBtn().getAttribute('aria-expanded')).toBe('true');
            expect(radios().map((radio) => radio.value)).toEqual(['omit', 'in-place', 'appendix', 'idevices']);
            expect(checkedChoice()).toBe(ACTIVITY_MODE_IN_PLACE);
            expect(boxes()).toHaveLength(3);
            expect(boxes().every((box) => box.checked)).toBe(true);
        });

        it('draws the preview the panel shows', async () => {
            await showWithActivities();

            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_IN_PLACE);
            expect(lastOptions().activities).not.toHaveProperty('selectedActivities');
        });

        it('starts the activities in an appendix when the arguments say nothing about them', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, null, null, ACTIVITIES);

            expect(checkedChoice()).toBe(ACTIVITY_MODE_APPENDIX);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_APPENDIX);
        });

        it('starts with the choice it is told to', async () => {
            await showWithActivities(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_APPENDIX);

            expect(checkedChoice()).toBe(ACTIVITY_MODE_APPENDIX);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_APPENDIX);
        });

        it('starts with the worksheet when printing only the activities', async () => {
            await showWithActivities(PREVIEW_MODE_IDEVICES, null);

            expect(checkedChoice()).toBe(PREVIEW_MODE_IDEVICES);
            expect(global.window.generateWorksheet).toHaveBeenCalledTimes(1);
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
            expect(modal.titleEl.textContent).toBe('Print iDevices');
        });

        it('starts with the activities it is told to print', async () => {
            await showWithActivities(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_APPENDIX, ['c2']);

            expect(boxes().map((box) => box.checked)).toEqual([false, true, false]);
            expect(lastOptions().activities.selectedActivities).toEqual(['c2']);
        });

        it('names an activity by its iDevice when its block has no name', async () => {
            global.eXeLearning.app.idevices = { getIdeviceInstalled: () => ({ title: 'Adivina' }) };

            await showWithActivities();

            expect([...overlayElement.querySelectorAll('.print-activities-list label')][0].textContent).toBe(
                'Tema 1 — Adivina'
            );
        });

        it('forgets the activity choices of the last project', async () => {
            await showWithActivities();
            await modal.show(PREVIEW_MODE_DOCUMENT);

            expect(radios()).toHaveLength(0);
            expect(lastOptions().activities).toBeUndefined();
        });

        it('treats anything but a list as no activities', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, null, null, undefined);
            expect(radios()).toHaveLength(0);

            await modal.show(PREVIEW_MODE_DOCUMENT, null, null, 'nonsense');
            expect(radios()).toHaveLength(0);
        });

        it('keeps the worksheet of a project that has no activity to choose about', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES);

            expect(global.window.generateWorksheet).toHaveBeenCalledTimes(1);
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
            expect(modal.mode).toBe(PREVIEW_MODE_IDEVICES);
        });
    });

    describe('the URLs of links', () => {
        it('are written by default', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);

            expect(modal.getPrintOptions()).toEqual({ showLinkUrls: true });
            expect(lastOptions().showLinkUrls).toBe(true);
        });

        it('are left out once the option is cleared, and the preview drawn again', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            loaded();
            global.window.generatePrintPreview.mockClear();

            tick(linkUrls(), false);
            expect(busy()).toBe('true');
            await settle();

            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(lastOptions().showLinkUrls).toBe(false);
        });

        it('stay as chosen when the activities change', async () => {
            await showWithActivities();
            loaded();
            tick(linkUrls(), false);
            await settle();
            loaded();

            choose(ACTIVITY_MODE_OMIT);
            await settle();

            expect(lastOptions().showLinkUrls).toBe(false);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_OMIT);
        });

        it('cannot be chosen for the worksheet, which has no links to show', async () => {
            await showWithActivities(PREVIEW_MODE_IDEVICES, null);
            expect(linkUrls().disabled).toBe(true);

            loaded();
            choose(ACTIVITY_MODE_APPENDIX);
            expect(linkUrls().disabled).toBe(false);
        });

        it('are part of the options built for the document preview', () => {
            modal.showLinkUrls = false;

            const options = modal.buildPreviewOptions();

            expect(options.showLinkUrls).toBe(false);
            expect(options.baseUrl).toBe('http://localhost:8080');
            expect(options).not.toHaveProperty('activities');
        });
    });

    describe('the activities that can never be printed', () => {
        const MAP = { id: 'm1', type: 'map', pageTitle: 'Tema 4', blockTitle: '', neverPrintable: true };
        const WITH_MAP = [...ACTIVITIES, MAP];

        it('are left out of the document unless their titles are asked for', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_APPENDIX, null, WITH_MAP);

            expect(unprintable().checked).toBe(false);
            expect(lastOptions().activities.selectedActivities).toEqual(['c1', 'c2', 'c3']);
        });

        it('are left off the worksheet unless their titles are asked for', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES, null, null, WITH_MAP);

            expect(lastWorksheetOptions().selectedActivities).toEqual(['c1', 'c2', 'c3']);
        });

        it('come back, with the preview drawn again, once their titles are asked for', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE, null, WITH_MAP);
            loaded();
            global.window.generatePrintPreview.mockClear();

            tick(unprintable(), true);
            expect(busy()).toBe('true');
            await settle();

            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_IN_PLACE);
            expect(lastOptions().activities).not.toHaveProperty('selectedActivities');
        });

        it('do not stop the document from printing when they are all the project has', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE, null, [MAP]);
            loaded();

            expect(lastOptions().activities.selectedActivities).toEqual([]);
            expect(printBtn().disabled).toBe(false);
            expect(status()).toBe('');
        });

        it('can be asked for in the worksheet too, where the other document options cannot', async () => {
            await modal.show(PREVIEW_MODE_IDEVICES, null, null, WITH_MAP);

            expect(unprintable().disabled).toBe(false);
            expect(linkUrls().disabled).toBe(true);
        });
    });

    describe('the style', () => {
        const withTheme = (selected) => {
            global.eXeLearning.app.themes = { selected };
        };

        it('is loaded from where the server serves the one the editor shows', () => {
            withTheme({ path: '/v1/site-files/themes/custom/' });

            expect(modal.buildPreviewOptions().themeUrl).toBe('http://localhost:8080/v1/site-files/themes/custom/');
        });

        it('keeps a style URL that is already absolute', () => {
            withTheme({ path: 'https://cdn.example.test/themes/custom/' });

            expect(modal.buildPreviewOptions().themeUrl).toBe('https://cdn.example.test/themes/custom/');
        });

        it.each([
            ['marked as imported', { path: '/v1/user-files/themes/custom/', isUserTheme: true }],
            ['kept in the project', { path: 'user-theme://custom/' }],
        ])('takes a style the user imported (%s) from its own files, having no URL for it', (_case, theme) => {
            withTheme(theme);

            const options = modal.buildPreviewOptions();
            expect(options).not.toHaveProperty('themeUrl');
            expect(options.themeFromFiles).toBe(true);
        });

        it('gives no URL when there is no style manager to ask', () => {
            expect(modal.buildPreviewOptions()).not.toHaveProperty('themeUrl');
        });

        it('gives no URL when the style path cannot be made absolute', () => {
            global.eXeLearning.config.baseURL = 'not a url';
            withTheme({ path: '/v1/site-files/themes/custom/' });

            expect(modal.buildPreviewOptions()).not.toHaveProperty('themeUrl');
        });

        it('reaches the exporter', async () => {
            withTheme({ path: '/v1/files/perm/themes/base/base/' });

            await modal.show(PREVIEW_MODE_DOCUMENT);

            expect(lastOptions().themeUrl).toBe('http://localhost:8080/v1/files/perm/themes/base/base/');
        });
    });

    describe('how folded blocks print', () => {
        it('unfolds them on paper by default', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            const page = loadedPage();

            expect(modal.unfoldBlocks).toBe(true);
            expect(unfoldBlocks().disabled).toBe(false);
            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(false);
        });

        it('keeps the preview as it is shown once the option is cleared, without drawing it again', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            const page = loadedPage();
            global.window.generatePrintPreview.mockClear();

            tick(unfoldBlocks(), false);

            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(true);
            expect(busy()).toBe('false');
            expect(printBtn().disabled).toBe(false);
            await settle();
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
            // How a block prints is no business of the exporter.
            expect(modal.getPrintOptions()).toEqual({ showLinkUrls: true });
        });

        it('unfolds them again once the option is ticked back', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            const page = loadedPage();

            tick(unfoldBlocks(), false);
            tick(unfoldBlocks(), true);

            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(false);
            expect(modal.unfoldBlocks).toBe(true);
        });

        it('keeps the choice in a preview drawn again for another option', async () => {
            await showWithActivities();
            loadedPage();
            tick(unfoldBlocks(), false);

            choose(ACTIVITY_MODE_OMIT);
            await settle();
            const page = loadedPage();

            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_OMIT);
            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(true);
        });

        it('offers no choice for the worksheet, which has no blocks to fold', async () => {
            await showWithActivities(PREVIEW_MODE_IDEVICES, null);
            expect(unfoldBlocks().disabled).toBe(true);

            loadedPage();
            choose(ACTIVITY_MODE_APPENDIX);
            expect(unfoldBlocks().disabled).toBe(false);
        });

        it('takes the choice to a preview that loads after it', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            Object.defineProperty(modal.iframe, 'contentDocument', { configurable: true, get: () => null });

            expect(() => tick(unfoldBlocks(), false)).not.toThrow();

            const page = loadedPage();
            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(true);
        });

        it('leaves a document that cannot be reached as it was built', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            Object.defineProperty(modal.iframe, 'contentDocument', {
                configurable: true,
                get: () => {
                    throw new DOMException('Blocked a frame', 'SecurityError');
                },
            });

            expect(() => tick(unfoldBlocks(), false)).not.toThrow();
            expect(modal.unfoldBlocks).toBe(false);
        });

        it('ignores the option while the preview is closed', async () => {
            await modal.show(PREVIEW_MODE_DOCUMENT);
            const page = loadedPage();
            modal.close();

            tick(unfoldBlocks(), false);

            expect(modal.unfoldBlocks).toBe(true);
            expect(page.classList.contains(PRINT_AS_SHOWN_CLASS)).toBe(false);
        });
    });

    describe('when an option changes', () => {
        beforeEach(async () => {
            await showWithActivities();
            loaded();
            global.window.generatePrintPreview.mockClear();
            global.window.generateWorksheet.mockClear();
        });

        it('draws the preview again for the new choice, after a short wait', async () => {
            choose(ACTIVITY_MODE_APPENDIX);
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();

            await settle();

            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_APPENDIX);
        });

        it('is busy from the moment the option changes until the new preview has loaded', async () => {
            expect(busy()).toBe('false');
            expect(printBtn().disabled).toBe(false);

            choose(ACTIVITY_MODE_APPENDIX);
            expect(busy()).toBe('true');
            expect(printBtn().disabled).toBe(true);

            await settle();
            expect(busy()).toBe('true');

            loaded();
            expect(busy()).toBe('false');
            expect(printBtn().disabled).toBe(false);
        });

        it('draws once when several options change in a row', async () => {
            choose(ACTIVITY_MODE_APPENDIX);
            tick(boxes()[0], false);
            tick(boxes()[1], false);

            await settle();

            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(lastOptions().activities.selectedActivities).toEqual(['c3']);
        });

        it('asks only for the activities left ticked', async () => {
            tick(boxes()[1], false);

            await settle();

            expect(lastOptions().activities.selectedActivities).toEqual(['c1', 'c3']);
        });

        it('switches to the worksheet, and its heading, when only the activities are asked for', async () => {
            choose(PREVIEW_MODE_IDEVICES);
            expect(modal.titleEl.textContent).toBe('Print iDevices');

            await settle();

            expect(global.window.generateWorksheet).toHaveBeenCalledTimes(1);
            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
        });

        it('goes back to the document, and its heading, when the activities are asked for there again', async () => {
            choose(PREVIEW_MODE_IDEVICES);
            await settle();
            loaded();

            choose(ACTIVITY_MODE_OMIT);
            await settle();

            expect(modal.titleEl.textContent).toBe('Print preview');
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_OMIT);
            expect(lastOptions().activities).not.toHaveProperty('selectedActivities');
        });

        it('hands the worksheet the activities left ticked', async () => {
            choose(PREVIEW_MODE_IDEVICES);
            tick(boxes()[0], false);

            await settle();

            expect(lastWorksheetOptions().selectedActivities).toEqual(['c2', 'c3']);
        });

        it('drops a preview that was still being drawn for the old options', async () => {
            let resolveOld;
            const oldDispose = vi.fn();
            global.window.generatePrintPreview.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveOld = resolve;
                })
            );
            const pending = modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE, null, ACTIVITIES);
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();
            const created = global.URL.createObjectURL.mock.calls.length;
            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);

            resolveOld({ success: true, html: 'OLD', dispose: oldDispose });
            await pending;
            await settle();

            expect(oldDispose).toHaveBeenCalledOnce();
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(created + 1);
            expect(lastOptions().activities.mode).toBe(ACTIVITY_MODE_APPENDIX);
        });

        it('stays busy until the newest preview has loaded, whatever the older ones do', async () => {
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();
            const newest = modal.iframe.onload;
            choose(ACTIVITY_MODE_OMIT);

            // The load of the preview drawn for the appendix arrives late.
            newest();

            expect(busy()).toBe('true');
        });

        it('shows the error, and stops being busy, when drawing again fails', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            global.window.generatePrintPreview.mockRejectedValueOnce(new Error('Boom'));

            choose(ACTIVITY_MODE_APPENDIX);
            await settle();

            expect(modal.loadingEl.innerHTML).toContain('Boom');
            expect(busy()).toBe('false');
        });

        it('disables printing and releases the old document after a failed regeneration, then recovers', async () => {
            const dispose = vi.fn();
            global.window.generatePrintPreview.mockResolvedValueOnce({ success: true, html: 'OLD', dispose });
            await showWithActivities();
            loaded();
            const nativePrint = vi.fn();
            Object.defineProperty(modal.iframe, 'contentWindow', { configurable: true, value: { print: nativePrint } });
            vi.spyOn(console, 'error').mockImplementation(() => {});
            global.window.generatePrintPreview.mockRejectedValueOnce(new Error('Boom'));

            choose(ACTIVITY_MODE_APPENDIX);
            await settle();

            expect(dispose).toHaveBeenCalledOnce();
            expect(modal.iframe.src).toBe('about:blank');
            expect(modal.blobUrl).toBeNull();
            expect(printBtn().disabled).toBe(true);
            modal.print();
            expect(nativePrint).not.toHaveBeenCalled();

            choose(ACTIVITY_MODE_IN_PLACE);
            expect(modal.loadingEl.textContent).not.toContain('Boom');
            await settle();
            expect(printBtn().disabled).toBe(true);
            loaded();
            expect(printBtn().disabled).toBe(false);
        });

        it('coalesces changes made while an exporter is running into the latest options only', async () => {
            let resolveSlow;
            const dispose = vi.fn();
            global.window.generatePrintPreview.mockReturnValueOnce(new Promise(resolve => { resolveSlow = resolve; }));
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();
            choose(ACTIVITY_MODE_OMIT);
            await settle();
            choose(PREVIEW_MODE_IDEVICES);
            await settle();
            tick(boxes()[0], false);
            await settle();
            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(global.window.generateWorksheet).not.toHaveBeenCalled();

            resolveSlow({ success: true, html: 'STALE', dispose });
            await settle();

            expect(dispose).toHaveBeenCalledOnce();
            expect(global.window.generatePrintPreview).toHaveBeenCalledTimes(1);
            expect(global.window.generateWorksheet).toHaveBeenCalledOnce();
            expect(lastWorksheetOptions().selectedActivities).toEqual(['c2', 'c3']);
            loaded();
            expect(printBtn().disabled).toBe(false);
        });

        it('drops queued work when closed while generation is running', async () => {
            let resolveSlow;
            const dispose = vi.fn();
            global.window.generatePrintPreview.mockReturnValueOnce(new Promise(resolve => { resolveSlow = resolve; }));
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();
            choose(PREVIEW_MODE_IDEVICES);
            await settle();
            modal.close();
            resolveSlow({ success: true, html: 'STALE', dispose });
            await settle();

            expect(dispose).toHaveBeenCalledOnce();
            expect(global.window.generateWorksheet).not.toHaveBeenCalled();
            expect(modal.iframe.src).toBe('about:blank');
            expect(modal.generationPromise).toBeNull();
            expect(printBtn().disabled).toBe(true);
        });

        it('keeps the debounce of the latest change when the active generation finishes', async () => {
            let resolveSlow;
            global.window.generatePrintPreview.mockReturnValueOnce(new Promise(resolve => { resolveSlow = resolve; }));
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();
            choose(ACTIVITY_MODE_OMIT);
            await settle();
            choose(PREVIEW_MODE_IDEVICES);
            resolveSlow({ success: true, html: 'STALE' });
            await vi.advanceTimersByTimeAsync(REGENERATE_DELAY_MS - 1);
            expect(global.window.generateWorksheet).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(global.window.generateWorksheet).toHaveBeenCalledOnce();
        });

        it('says nothing of an error from a preview that is no longer wanted', async () => {
            let rejectOld;
            global.window.generatePrintPreview.mockReturnValueOnce(
                new Promise((resolve, reject) => {
                    rejectOld = reject;
                })
            );
            const error = vi.spyOn(modal, 'showError');
            const pending = modal.show(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_IN_PLACE, null, ACTIVITIES);
            choose(ACTIVITY_MODE_APPENDIX);
            await settle();

            rejectOld(new Error('old'));
            await pending;

            expect(error).not.toHaveBeenCalled();
        });

        it('does nothing once the overlay has been closed', async () => {
            modal.close();

            choose(ACTIVITY_MODE_APPENDIX);
            await settle();

            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
        });

        it('stops waiting to draw when the overlay is closed', async () => {
            choose(ACTIVITY_MODE_APPENDIX);

            modal.close();
            await settle();

            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
            expect(busy()).toBe('false');
        });

        it('stops waiting to draw when a new preview is asked for', async () => {
            choose(ACTIVITY_MODE_APPENDIX);

            await showWithActivities(PREVIEW_MODE_DOCUMENT, ACTIVITY_MODE_OMIT);
            global.window.generatePrintPreview.mockClear();
            await settle();

            expect(global.window.generatePrintPreview).not.toHaveBeenCalled();
        });
    });

    describe('when no activity is left to print', () => {
        beforeEach(async () => {
            await showWithActivities();
            loaded();
        });

        it('still draws the preview, but does not allow printing it', async () => {
            boxes().forEach((box) => tick(box, false));
            await settle();
            loaded();

            expect(lastOptions().activities.selectedActivities).toEqual([]);
            expect(busy()).toBe('false');
            expect(printBtn().disabled).toBe(true);
            expect(status()).toBe('Select at least one activity to print.');
        });

        it('allows printing again once one is ticked', async () => {
            boxes().forEach((box) => tick(box, false));
            await settle();
            loaded();

            tick(boxes()[0], true);
            await settle();
            loaded();

            expect(printBtn().disabled).toBe(false);
            expect(status()).toBe('');
        });

        it('allows printing when none of them is to be printed', async () => {
            boxes().forEach((box) => tick(box, false));
            choose(ACTIVITY_MODE_OMIT);
            await settle();
            loaded();

            expect(printBtn().disabled).toBe(false);
            expect(status()).toBe('');
        });

        it('does not start out unable to print the next project', async () => {
            boxes().forEach((box) => tick(box, false));
            await settle();

            await modal.show(PREVIEW_MODE_DOCUMENT);
            loaded();

            expect(printBtn().disabled).toBe(false);
        });
    });

    describe('the buttons', () => {
        beforeEach(async () => {
            await showWithActivities();
            loaded();
        });

        it('closes the panel from its own button, and opens it again from the one in the header', () => {
            panelEl().querySelector('.print-options-close').click();
            expect(panelEl().hidden).toBe(true);
            expect(optionsBtn().getAttribute('aria-expanded')).toBe('false');

            optionsBtn().click();
            expect(panelEl().hidden).toBe(false);
            expect(optionsBtn().getAttribute('aria-expanded')).toBe('true');
        });

        it('does not print while the preview is being drawn', () => {
            choose(ACTIVITY_MODE_APPENDIX);

            expect(printBtn().disabled).toBe(true);
        });

        it.each(['busy', 'invalid', 'closed', 'not-ready'])('rejects direct printing when %s', (state) => {
            const nativePrint = vi.fn();
            Object.defineProperty(modal.iframe, 'contentWindow', { configurable: true, value: { print: nativePrint } });
            if (state === 'busy') modal.busy = true;
            if (state === 'invalid') modal.valid = false;
            if (state === 'closed') modal.close();
            if (state === 'not-ready') modal.ready = false;
            modal.print();
            expect(nativePrint).not.toHaveBeenCalled();
        });

        it('prints once the preview is ready', () => {
            const printSpy = vi.spyOn(modal, 'print').mockImplementation(() => {});

            printBtn().click();

            expect(printSpy).toHaveBeenCalledOnce();
        });

        it('does not print the first preview before it has loaded', async () => {
            await showWithActivities();

            expect(printBtn().disabled).toBe(true);

            loaded();
            expect(printBtn().disabled).toBe(false);
        });
    });

    describe('being busy', () => {
        it('is not busy once the overlay is closed', async () => {
            await showWithActivities();
            expect(busy()).toBe('true');

            modal.close();

            expect(busy()).toBe('false');
        });

        it('is not busy once the preview has failed', () => {
            modal.showLoading(true);

            modal.showError('Something went wrong');

            expect(busy()).toBe('false');
        });

        it('does not need the button to be there', () => {
            modal.printBtn = null;

            expect(() => modal.setBusy(true)).not.toThrow();
        });
    });

    describe('ideviceName', () => {
        it('gives the name the iDevice menu shows', () => {
            global.eXeLearning.app.idevices = { getIdeviceInstalled: vi.fn(() => ({ title: 'Adivina' })) };

            expect(modal.ideviceName('guess')).toBe('Adivina');
            expect(global.eXeLearning.app.idevices.getIdeviceInstalled).toHaveBeenCalledWith('guess');
        });

        it('gives nothing when the iDevice is not installed or the menu is not there', () => {
            expect(modal.ideviceName('guess')).toBe('');

            global.eXeLearning.app.idevices = { getIdeviceInstalled: () => null };
            expect(modal.ideviceName('guess')).toBe('');
        });
    });
});
