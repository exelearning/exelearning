import ModalRegenerateProject from './modalRegenerateProject.js';

// Mock the service module
vi.mock('../../../utils/RegenerateProjectService.js', () => ({
    scanBrokenAssetReferences: vi.fn(() => []),
    regenerate: vi.fn(() => Promise.resolve({ success: true })),
}));

import { scanBrokenAssetReferences, regenerate } from '../../../utils/RegenerateProjectService.js';

describe('ModalRegenerateProject', () => {
    let modal;
    let mockManager;
    let mockModalElement;
    let mockBootstrapModal;

    beforeEach(() => {
        // Mock _ translation function
        window._ = vi.fn((s) => s);

        // Mock eXeLearning
        window.eXeLearning = {
            app: {
                alerts: {
                    showToast: vi.fn(),
                },
            },
        };

        // Mock bootstrap
        mockBootstrapModal = {
            show: vi.fn(),
            hide: vi.fn(),
            _isShown: false,
        };
        window.bootstrap = {
            Modal: function () {
                return mockBootstrapModal;
            },
        };

        // Mock interact
        window.interact = vi.fn(() => ({
            draggable: vi.fn(),
        }));

        // Create mock modal element
        mockModalElement = document.createElement('div');
        mockModalElement.id = 'modalRegenerateProject';
        mockModalElement.innerHTML = `
            <div class="modal-header">
                <div class="modal-title"></div>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
                <button type="button" class="confirm btn btn-primary">Regenerate</button>
                <button type="button" class="close btn btn-secondary">Cancel</button>
            </div>
        `;
        document.body.appendChild(mockModalElement);

        mockManager = {
            closeModals: vi.fn(() => false),
        };

        modal = new ModalRegenerateProject(mockManager);

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.removeChild(mockModalElement);
        vi.restoreAllMocks();
        delete window._;
        delete window.eXeLearning;
        delete window.bootstrap;
        delete window.interact;
    });

    describe('constructor', () => {
        it('should create with correct id', () => {
            expect(modal.id).toBe('modalRegenerateProject');
        });

        it('should find confirm button', () => {
            expect(modal.confirmButton).toBeTruthy();
            expect(modal.confirmButton.classList.contains('btn-primary')).toBe(true);
        });
    });

    describe('buildBodyHtml', () => {
        it('should return HTML with checkboxes', () => {
            const html = modal.buildBodyHtml();
            expect(html).toContain('regenerate-flatten-resources');
            expect(html).toContain('regenerate-check-broken');
            expect(html).toContain('regenerate-progress');
            expect(html).toContain('regenerate-warnings');
        });

        it('should use translated strings', () => {
            modal.buildBodyHtml();
            expect(window._).toHaveBeenCalledWith('Flatten resources');
            expect(window._).toHaveBeenCalledWith('Check for broken references');
        });
    });

    describe('show', () => {
        it('should set title and body', () => {
            vi.useFakeTimers();
            modal.show();
            vi.advanceTimersByTime(100);

            expect(mockModalElement.querySelector('.modal-title').innerHTML).toBe('Regenerate project');
            expect(mockModalElement.querySelector('.modal-body').innerHTML).toContain('regenerate-flatten-resources');
            vi.useRealTimers();
        });

        it('should show bootstrap modal', () => {
            vi.useFakeTimers();
            modal.show();
            vi.advanceTimersByTime(100);

            expect(mockBootstrapModal.show).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('should enable confirm button', () => {
            vi.useFakeTimers();
            modal.confirmButton.disabled = true;
            modal.show();
            vi.advanceTimersByTime(100);

            expect(modal.confirmButton.disabled).toBe(false);
            vi.useRealTimers();
        });
    });

    describe('onConfirm', () => {
        beforeEach(() => {
            // Set up modal body with checkboxes
            mockModalElement.querySelector('.modal-body').innerHTML = modal.buildBodyHtml();
        });

        it('should call regenerate without flattenResources by default', async () => {
            await modal.onConfirm();

            expect(regenerate).toHaveBeenCalledWith({ flattenResources: false });
        });

        it('should call regenerate with flattenResources when checked', async () => {
            mockModalElement.querySelector('#regenerate-flatten-resources').checked = true;

            await modal.onConfirm();

            expect(regenerate).toHaveBeenCalledWith({ flattenResources: true });
        });

        it('should show success toast on completion', async () => {
            await modal.onConfirm();

            expect(window.eXeLearning.app.alerts.showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' })
            );
        });

        it('should show error toast on failure', async () => {
            regenerate.mockRejectedValueOnce(new Error('Export failed'));

            await modal.onConfirm();

            expect(window.eXeLearning.app.alerts.showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' })
            );
        });

        it('should scan broken references when checkbox is checked', async () => {
            mockModalElement.querySelector('#regenerate-check-broken').checked = true;

            await modal.onConfirm();

            expect(scanBrokenAssetReferences).toHaveBeenCalled();
        });

        it('should show warnings and not regenerate when broken refs found on first click', async () => {
            mockModalElement.querySelector('#regenerate-check-broken').checked = true;
            scanBrokenAssetReferences.mockReturnValueOnce([
                { assetUrl: 'asset://missing', pageName: 'Page 1', ideviceType: 'FreeText', componentId: 'c1' },
            ]);

            await modal.onConfirm();

            const warningsArea = mockModalElement.querySelector('#regenerate-warnings');
            expect(warningsArea.classList.contains('d-none')).toBe(false);
            expect(regenerate).not.toHaveBeenCalled();
        });

        it('should proceed with regeneration after warnings are shown and user confirms again', async () => {
            mockModalElement.querySelector('#regenerate-check-broken').checked = true;

            // First call - show warnings
            scanBrokenAssetReferences.mockReturnValueOnce([
                { assetUrl: 'asset://missing', pageName: 'Page 1', ideviceType: 'FreeText', componentId: 'c1' },
            ]);
            await modal.onConfirm();
            expect(regenerate).not.toHaveBeenCalled();

            // Second call - user confirmed warnings
            scanBrokenAssetReferences.mockReturnValueOnce([
                { assetUrl: 'asset://missing', pageName: 'Page 1', ideviceType: 'FreeText', componentId: 'c1' },
            ]);
            await modal.onConfirm();
            expect(regenerate).toHaveBeenCalled();
        });

        it('should disable confirm button during regeneration', async () => {
            let resolveExport;
            regenerate.mockImplementationOnce(
                () => new Promise((resolve) => { resolveExport = resolve; })
            );

            const promise = modal.onConfirm();
            expect(modal.confirmButton.disabled).toBe(true);

            resolveExport({ success: true });
            await promise;
        });

        it('should show progress spinner during regeneration', async () => {
            let resolveExport;
            regenerate.mockImplementationOnce(
                () => new Promise((resolve) => { resolveExport = resolve; })
            );

            const promise = modal.onConfirm();
            const progressArea = mockModalElement.querySelector('#regenerate-progress');
            expect(progressArea.classList.contains('d-none')).toBe(false);

            resolveExport({ success: true });
            await promise;
        });
    });

    describe('showBrokenWarnings', () => {
        it('should display warnings in the area', () => {
            const warningsArea = document.createElement('div');
            warningsArea.classList.add('d-none');

            modal.showBrokenWarnings(warningsArea, [
                { assetUrl: 'asset://abc', pageName: 'Page 1', ideviceType: 'Text', componentId: 'c1' },
            ]);

            expect(warningsArea.classList.contains('d-none')).toBe(false);
            expect(warningsArea.innerHTML).toContain('asset://abc');
            expect(warningsArea.innerHTML).toContain('Page 1');
        });

        it('should mark area as user-confirmed', () => {
            const warningsArea = document.createElement('div');
            modal.showBrokenWarnings(warningsArea, [
                { assetUrl: 'asset://abc', pageName: 'P', ideviceType: 'T', componentId: 'c' },
            ]);
            expect(warningsArea.classList.contains('user-confirmed')).toBe(true);
        });

        it('should handle null warningsArea gracefully', () => {
            expect(() => modal.showBrokenWarnings(null, [])).not.toThrow();
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(modal.escapeHtml('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert("xss")&lt;/script&gt;'
            );
        });

        it('should handle null/undefined', () => {
            expect(modal.escapeHtml(null)).toBe('');
            expect(modal.escapeHtml(undefined)).toBe('');
        });
    });
});
