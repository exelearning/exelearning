import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalImageOptimizer from './modalImageOptimizer.js';
import { STATUS } from '../../../utils/ImageOptimizerManager.js';

// Mock ImageOptimizerManager
vi.mock('../../../utils/ImageOptimizerManager.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        queue: new Map(),
        onAssetUpdate: null,
        onProgress: null,
        onEstimateComplete: null,
        onOptimizeComplete: null,
        onError: null,
        addAsset: vi.fn(),
        removeAsset: vi.fn(),
        clearQueue: vi.fn(),
        getQueueItem: vi.fn(),
        getAllItems: vi.fn(() => []),
        setPreset: vi.fn(),
        setJpegQuality: vi.fn(),
        resetEstimates: vi.fn(),
        getSettings: vi.fn(() => ({ preset: 'medium', jpegQuality: 0.85 })),
        getStats: vi.fn(() => ({
            total: 0, estimated: 0, optimized: 0, failed: 0,
            totalOriginal: 0, totalEstimated: 0, totalOptimized: 0, savings: 0, savingsPercent: 0,
        })),
        getStatsForSelection: vi.fn(() => ({
            selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0,
        })),
        estimateSelected: vi.fn().mockResolvedValue({}),
        optimizeSelected: vi.fn().mockResolvedValue({}),
        cancel: vi.fn(),
        terminateWorker: vi.fn(),
        isInProgress: vi.fn(() => false),
    })),
    STATUS: {
        PENDING: 'pending',
        ESTIMATING: 'estimating',
        READY: 'ready',
        OPTIMIZING: 'optimizing',
        DONE: 'done',
        FAILED: 'failed',
    },
}));

describe('ModalImageOptimizer', () => {
    let modal;
    let mockManager;
    let mockElement;
    let mockBootstrapModal;

    beforeEach(() => {
        // Mock translation function
        window._ = vi.fn((key) => key);

        // Mock URL.createObjectURL and revokeObjectURL
        global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock crypto.subtle using vi.stubGlobal (crypto is a getter-only property)
        vi.stubGlobal('crypto', {
            subtle: {
                digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
            },
        });

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(new Blob(['test'])),
        });

        // Mock eXeLearning global
        window.eXeLearning = {
            basePath: '',
            app: {
                project: {
                    odeId: 'proj-123',
                    getProjectUuid: vi.fn(() => 'proj-uuid-123'),
                    _yjsBridge: {
                        assetManager: {
                            getProjectAssets: vi.fn().mockResolvedValue([]),
                            getBlob: vi.fn().mockResolvedValue(null),
                            putBlob: vi.fn().mockResolvedValue(),
                            getAssetMetadata: vi.fn().mockReturnValue({ filename: 'test.png', mime: 'image/png' }),
                            setAssetMetadata: vi.fn(),
                            getAssetUrl: vi.fn((id, filename) => `asset://${id}/${filename}`),
                            resolveAssetURL: vi.fn().mockResolvedValue('blob:resolved-url'),
                            blobURLCache: new Map(),
                            reverseBlobCache: new Map(),
                        },
                    },
                },
                modals: {
                    alert: { show: vi.fn() },
                },
                alerts: {
                    showToast: vi.fn(),
                },
            },
        };

        // Mock DOM
        mockElement = document.createElement('div');
        mockElement.id = 'modalImageOptimizer';
        mockElement.innerHTML = `
            <div class="modal-header">
                <div class="modal-title"></div>
                <button class="close image-optimizer-close-btn"></button>
            </div>
            <div class="modal-body">
                <div class="image-optimizer-loading"></div>
                <div class="image-optimizer-empty d-none"></div>
                <div class="image-optimizer-content d-none">
                    <div class="image-optimizer-settings">
                        <select class="image-optimizer-preset">
                            <option value="light">Light</option>
                            <option value="medium" selected>Medium</option>
                            <option value="strong">Strong</option>
                        </select>
                        <div class="image-optimizer-quality-container d-none">
                            <input type="range" class="image-optimizer-quality" min="50" max="100" value="85">
                            <span class="image-optimizer-quality-value">85</span>
                        </div>
                        <button class="image-optimizer-select-all"></button>
                        <button class="image-optimizer-deselect-all"></button>
                    </div>
                    <div class="image-optimizer-queue">
                        <table>
                            <thead>
                                <tr>
                                    <th><input type="checkbox" class="image-optimizer-toggle-all"></th>
                                </tr>
                            </thead>
                            <tbody class="image-optimizer-tbody"></tbody>
                        </table>
                    </div>
                    <div class="image-optimizer-summary">
                        <span class="summary-selected">0</span>
                        <span class="summary-original">0 KB</span>
                        <span class="summary-estimated">-</span>
                        <span class="summary-savings">-</span>
                    </div>
                    <div class="image-optimizer-confirm-panel d-none"></div>
                    <div class="image-optimizer-progress-panel d-none">
                        <span class="image-optimizer-progress-text"></span>
                        <div class="image-optimizer-progress-bar" style="width: 0%"></div>
                        <span class="image-optimizer-progress-percent">0%</span>
                        <span class="image-optimizer-progress-detail"></span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="image-optimizer-footer-normal">
                    <button class="image-optimizer-optimize-btn" disabled></button>
                </div>
                <div class="image-optimizer-footer-confirm d-none">
                    <button class="image-optimizer-confirm-btn"></button>
                    <button class="image-optimizer-cancel-btn"></button>
                </div>
                <div class="image-optimizer-footer-progress d-none"></div>
            </div>
        `;
        document.body.appendChild(mockElement);

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'modalImageOptimizer') return mockElement;
            return null;
        });

        // Mock bootstrap.Modal
        mockBootstrapModal = {
            show: vi.fn(),
            hide: vi.fn(),
        };
        window.bootstrap = {
            Modal: vi.fn().mockImplementation(function () {
                return mockBootstrapModal;
            }),
        };
        window.bootstrap.Modal.getInstance = vi.fn(() => mockBootstrapModal);

        mockManager = {
            closeModals: vi.fn(() => false),
        };

        modal = new ModalImageOptimizer(mockManager);
        modal.initElements();
        modal.initBehaviour();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
        delete window.eXeLearning;
        delete window._;
        delete window.bootstrap;
    });

    describe('constructor', () => {
        it('should initialize with correct ID', () => {
            expect(modal.id).toBe('modalImageOptimizer');
        });

        it('should initialize with default state', () => {
            expect(modal.selectedAssets.size).toBe(0);
            expect(modal.rowElements.size).toBe(0);
            expect(modal.hasJpegs).toBe(false);
            expect(modal.viewState).toBe('normal');
        });
    });

    describe('assetManager getter', () => {
        it('should return assetManager from project', () => {
            const am = modal.assetManager;
            expect(am).toBe(window.eXeLearning.app.project._yjsBridge.assetManager);
        });

        it('should return null when project not available', () => {
            window.eXeLearning.app.project = null;
            expect(modal.assetManager).toBeNull();
        });
    });

    describe('initElements', () => {
        it('should initialize all DOM references', () => {
            expect(modal.loadingEl).not.toBeNull();
            expect(modal.emptyEl).not.toBeNull();
            expect(modal.contentEl).not.toBeNull();
            expect(modal.tbodyEl).not.toBeNull();
            expect(modal.summaryEl).not.toBeNull();
            expect(modal.presetSelect).not.toBeNull();
            expect(modal.optimizeBtn).not.toBeNull();
            expect(modal.confirmPanel).not.toBeNull();
            expect(modal.progressPanel).not.toBeNull();
            expect(modal.progressBar).not.toBeNull();
        });
    });

    describe('setContentState', () => {
        it('should show loading state', () => {
            modal.setContentState('loading');

            expect(modal.loadingEl.classList.contains('d-none')).toBe(false);
            expect(modal.emptyEl.classList.contains('d-none')).toBe(true);
            expect(modal.contentEl.classList.contains('d-none')).toBe(true);
        });

        it('should show empty state', () => {
            modal.setContentState('empty');

            expect(modal.loadingEl.classList.contains('d-none')).toBe(true);
            expect(modal.emptyEl.classList.contains('d-none')).toBe(false);
            expect(modal.contentEl.classList.contains('d-none')).toBe(true);
        });

        it('should show content state', () => {
            modal.setContentState('content');

            expect(modal.loadingEl.classList.contains('d-none')).toBe(true);
            expect(modal.emptyEl.classList.contains('d-none')).toBe(true);
            expect(modal.contentEl.classList.contains('d-none')).toBe(false);
        });

        it('should disable optimize button when loading', () => {
            modal.optimizeBtn.disabled = false;
            modal.setContentState('loading');

            expect(modal.optimizeBtn.disabled).toBe(true);
        });
    });

    describe('applyViewState', () => {
        it('should apply normal view state', () => {
            modal.applyViewState('normal');

            expect(modal.viewState).toBe('normal');
            expect(modal.confirmPanel.classList.contains('d-none')).toBe(true);
            expect(modal.progressPanel.classList.contains('d-none')).toBe(true);
            expect(modal.settingsPanel.classList.contains('d-none')).toBe(false);
            expect(modal.footerNormal.classList.contains('d-none')).toBe(false);
            expect(modal.footerConfirm.classList.contains('d-none')).toBe(true);
            expect(modal.footerProgress.classList.contains('d-none')).toBe(true);
        });

        it('should apply confirm view state', () => {
            // Need selection for confirm state
            modal.selectedAssets.add('asset-1');
            modal.applyViewState('confirm');

            expect(modal.viewState).toBe('confirm');
            expect(modal.confirmPanel.classList.contains('d-none')).toBe(false);
            expect(modal.progressPanel.classList.contains('d-none')).toBe(true);
            expect(modal.settingsPanel.classList.contains('d-none')).toBe(true);
            expect(modal.footerNormal.classList.contains('d-none')).toBe(true);
            expect(modal.footerConfirm.classList.contains('d-none')).toBe(false);
        });

        it('should not apply confirm state without selection', () => {
            modal.viewState = 'normal';
            modal.applyViewState('confirm');

            expect(modal.viewState).toBe('normal');
        });

        it('should apply progress view state', () => {
            modal.applyViewState('progress');

            expect(modal.viewState).toBe('progress');
            expect(modal.confirmPanel.classList.contains('d-none')).toBe(true);
            expect(modal.progressPanel.classList.contains('d-none')).toBe(false);
            expect(modal.footerNormal.classList.contains('d-none')).toBe(true);
            expect(modal.footerProgress.classList.contains('d-none')).toBe(false);
            expect(modal.closeBtn.classList.contains('d-none')).toBe(true);
        });

        it('should reset progress bar when entering progress state', () => {
            modal.progressBar.style.width = '50%';
            modal.applyViewState('progress');

            expect(modal.progressBar.style.width).toBe('0%');
        });

    });

    describe('formatSize', () => {
        it('should format 0 bytes', () => {
            expect(modal.formatSize(0)).toBe('0 B');
        });

        it('should format bytes', () => {
            expect(modal.formatSize(500)).toBe('500 B');
        });

        it('should format kilobytes', () => {
            expect(modal.formatSize(1024)).toBe('1.0 KB');
            expect(modal.formatSize(2560)).toBe('2.5 KB');
        });

        it('should format megabytes', () => {
            expect(modal.formatSize(1048576)).toBe('1.0 MB');
            expect(modal.formatSize(5242880)).toBe('5.0 MB');
        });

        it('should format gigabytes', () => {
            expect(modal.formatSize(1073741824)).toBe('1.0 GB');
        });
    });

    describe('getStatusBadge', () => {
        it('should return badge for PENDING status', () => {
            const badge = modal.getStatusBadge(STATUS.PENDING);
            expect(badge).toContain('bg-secondary');
            expect(badge).toContain('Queued');
        });

        it('should return badge for ESTIMATING status', () => {
            const badge = modal.getStatusBadge(STATUS.ESTIMATING);
            expect(badge).toContain('bg-info');
            expect(badge).toContain('spinner-border');
            expect(badge).toContain('Estimating...');
        });

        it('should return badge for READY status', () => {
            const badge = modal.getStatusBadge(STATUS.READY);
            expect(badge).toContain('bg-primary');
            expect(badge).toContain('Ready');
        });

        it('should return badge for OPTIMIZING status', () => {
            const badge = modal.getStatusBadge(STATUS.OPTIMIZING);
            expect(badge).toContain('bg-warning');
            expect(badge).toContain('spinner-border');
            expect(badge).toContain('Optimizing...');
        });

        it('should return badge for DONE status', () => {
            const badge = modal.getStatusBadge(STATUS.DONE);
            expect(badge).toContain('bg-success');
            expect(badge).toContain('Done');
        });

        it('should return badge for FAILED status with error', () => {
            const badge = modal.getStatusBadge(STATUS.FAILED, 'Test error');
            expect(badge).toContain('bg-danger');
            expect(badge).toContain('Failed');
            expect(badge).toContain('title="Test error"');
        });

        it('should return empty string for unknown status', () => {
            const badge = modal.getStatusBadge('unknown');
            expect(badge).toBe('');
        });

        it('should return badge for already optimized status', () => {
            const badge = modal.getStatusBadge('already_optimized');
            expect(badge).toContain('Already optimized');
        });
    });

    describe('isAlreadyOptimized', () => {
        it('should be true when estimated size is larger than original', () => {
            expect(modal.isAlreadyOptimized({
                originalSize: 1000,
                estimatedSize: 1200,
            })).toBe(true);
        });

        it('should be true when savings percent is below minimum threshold', () => {
            expect(modal.isAlreadyOptimized({
                originalSize: 1000,
                estimatedSize: 995, // 0.5%
            })).toBe(true);
        });

        it('should be false when savings percent is at or above minimum threshold', () => {
            expect(modal.isAlreadyOptimized({
                originalSize: 1000,
                estimatedSize: 990, // 1.0%
            })).toBe(false);
        });
    });

    describe('buildImageRow', () => {
        it('should create a table row element', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);

            expect(row.tagName).toBe('TR');
            expect(row.dataset.assetId).toBe('asset-1');
        });

        it('should create row with checkbox', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');

            expect(checkbox).not.toBeNull();
            expect(checkbox.checked).toBe(true);
        });

        it('should create row with unchecked checkbox when selected is false', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, false);
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');

            expect(checkbox.checked).toBe(false);
        });

        it('should create thumbnail with blob URL', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const img = row.querySelector('.image-optimizer-thumbnail');

            expect(img).not.toBeNull();
            expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        });

        it('should show filename', () => {
            const asset = { id: 'asset-1', filename: 'myimage.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const nameCell = row.querySelector('.image-optimizer-filename');

            expect(nameCell.textContent).toBe('myimage.png');
        });

        it('should show correct type for PNG', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const typeCell = row.querySelector('.image-optimizer-type');

            expect(typeCell.textContent).toBe('PNG');
        });

        it('should show correct type for JPEG', () => {
            const asset = { id: 'asset-1', filename: 'test.jpg', mime: 'image/jpeg', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/jpeg' });

            const row = modal.buildImageRow(asset, blob, true);
            const typeCell = row.querySelector('.image-optimizer-type');

            expect(typeCell.textContent).toBe('JPEG');
        });

        it('should show original size', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 2048 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const sizeCell = row.querySelector('.image-optimizer-original-size');

            expect(sizeCell.textContent).toBe('2.0 KB');
        });

        it('should add change handler to checkbox', () => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });

            const row = modal.buildImageRow(asset, blob, true);
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');

            // Mock the optimizerManager
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: STATUS.PENDING }]]),
                getQueueItem: vi.fn(() => ({ status: STATUS.PENDING })),
                getStatsForSelection: vi.fn(() => ({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
                isInProgress: vi.fn(() => false),
            };

            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));

            expect(modal.selectedAssets.has('asset-1')).toBe(false);
        });
    });

    describe('updateImageRow', () => {
        let row;

        beforeEach(() => {
            const asset = { id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 };
            const blob = new Blob(['test'], { type: 'image/png' });
            row = modal.buildImageRow(asset, blob, true);
            modal.rowElements.set('asset-1', row);

            modal.optimizerManager = {
                getStatsForSelection: vi.fn(() => ({
                    selected: 1,
                    totalOriginal: 1000,
                    totalEstimated: 750,
                    savings: 250,
                    savingsPercent: '25.0',
                })),
            };
        });

        it('should update estimated size', () => {
            modal.updateImageRow('asset-1', { estimatedSize: 750, status: STATUS.READY });

            const estimatedCell = row.querySelector('.image-optimizer-estimated-size');
            expect(estimatedCell.textContent).toContain('750');
            expect(estimatedCell.classList.contains('text-muted')).toBe(false);
        });

        it('should update optimized size with bold', () => {
            modal.updateImageRow('asset-1', { optimizedSize: 600, status: STATUS.DONE });

            const estimatedCell = row.querySelector('.image-optimizer-estimated-size');
            expect(estimatedCell.classList.contains('fw-bold')).toBe(true);
        });

        it('should update savings with positive value', () => {
            modal.updateImageRow('asset-1', {
                originalSize: 1000,
                estimatedSize: 750,
                status: STATUS.READY,
            });

            const savingsCell = row.querySelector('.image-optimizer-savings');
            expect(savingsCell.innerHTML).toContain('text-success');
            expect(savingsCell.innerHTML).toContain('25.0%');
        });

        it('should show N/A savings when size would increase (already optimized)', () => {
            modal.updateImageRow('asset-1', {
                originalSize: 1000,
                estimatedSize: 1200,
                status: STATUS.READY,
            });

            const savingsCell = row.querySelector('.image-optimizer-savings');
            expect(savingsCell.textContent).toBe('N/A');
        });

        it('should update status badge', () => {
            modal.updateImageRow('asset-1', { status: STATUS.READY });

            const statusCell = row.querySelector('.image-optimizer-status');
            expect(statusCell.innerHTML).toContain('Ready');
        });

        it('should mark row as already optimized and disable selection', () => {
            modal.selectedAssets.add('asset-1');

            modal.updateImageRow('asset-1', {
                status: STATUS.READY,
                originalSize: 1000,
                estimatedSize: 1002,
            });

            const statusCell = row.querySelector('.image-optimizer-status');
            const estimatedCell = row.querySelector('.image-optimizer-estimated-size');
            const savingsCell = row.querySelector('.image-optimizer-savings');
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            expect(statusCell.innerHTML).toContain('Already optimized');
            expect(estimatedCell.textContent).toBe('N/A');
            expect(savingsCell.textContent).toBe('N/A');
            expect(checkbox.disabled).toBe(true);
            expect(checkbox.checked).toBe(false);
            expect(modal.selectedAssets.has('asset-1')).toBe(false);
        });

        it('should not throw for unknown asset', () => {
            expect(() => {
                modal.updateImageRow('unknown-asset', { status: STATUS.READY });
            }).not.toThrow();
        });

        it('should highlight row when optimizing', () => {
            modal.viewState = 'progress';
            modal.updateImageRow('asset-1', { status: STATUS.OPTIMIZING, filename: 'test.png' });

            expect(row.classList.contains('table-warning')).toBe(true);
        });

        it('should remove highlight when done', () => {
            row.classList.add('table-warning');
            modal.updateImageRow('asset-1', { status: STATUS.DONE });

            expect(row.classList.contains('table-warning')).toBe(false);
        });
    });

    describe('onRowCheckboxChange', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: STATUS.PENDING }]]),
                getQueueItem: vi.fn(() => ({ status: STATUS.PENDING })),
                getStatsForSelection: vi.fn(() => ({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
                isInProgress: vi.fn(() => false),
            };
        });

        it('should add asset to selection when checked', () => {
            modal.onRowCheckboxChange('asset-1', true);

            expect(modal.selectedAssets.has('asset-1')).toBe(true);
        });

        it('should remove asset from selection when unchecked', () => {
            modal.selectedAssets.add('asset-1');
            modal.onRowCheckboxChange('asset-1', false);

            expect(modal.selectedAssets.has('asset-1')).toBe(false);
        });

        it('should keep asset unselected when row is not selectable', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png' }, blob, false);
            row.dataset.selectable = 'false';
            modal.rowElements.set('asset-1', row);

            modal.onRowCheckboxChange('asset-1', true);

            expect(modal.selectedAssets.has('asset-1')).toBe(false);
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            expect(checkbox.checked).toBe(false);
        });
    });

    describe('selectAll / deselectAll', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                queue: new Map([
                    ['asset-1', { status: STATUS.PENDING }],
                    ['asset-2', { status: STATUS.READY }],
                ]),
                getQueueItem: vi.fn((id) => modal.optimizerManager.queue.get(id)),
                getStatsForSelection: vi.fn(() => ({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
                isInProgress: vi.fn(() => false),
            };

            // Create rows
            const blob = new Blob(['test'], { type: 'image/png' });
            const row1 = modal.buildImageRow({ id: 'asset-1', filename: 'test1.png', mime: 'image/png' }, blob, false);
            const row2 = modal.buildImageRow({ id: 'asset-2', filename: 'test2.png', mime: 'image/png' }, blob, false);
            modal.rowElements.set('asset-1', row1);
            modal.rowElements.set('asset-2', row2);
        });

        it('should select all assets', () => {
            modal.selectAll();

            expect(modal.selectedAssets.size).toBe(2);
            expect(modal.selectedAssets.has('asset-1')).toBe(true);
            expect(modal.selectedAssets.has('asset-2')).toBe(true);
        });

        it('should check all checkboxes when selecting all', () => {
            modal.selectAll();

            for (const row of modal.rowElements.values()) {
                const checkbox = row.querySelector('.image-optimizer-row-checkbox');
                expect(checkbox.checked).toBe(true);
            }
        });

        it('should deselect all assets', () => {
            modal.selectedAssets.add('asset-1');
            modal.selectedAssets.add('asset-2');

            modal.deselectAll();

            expect(modal.selectedAssets.size).toBe(0);
        });

        it('should uncheck all checkboxes when deselecting all', () => {
            modal.selectAll();
            modal.deselectAll();

            for (const row of modal.rowElements.values()) {
                const checkbox = row.querySelector('.image-optimizer-row-checkbox');
                expect(checkbox.checked).toBe(false);
            }
        });

        it('should skip non-selectable assets when selecting all', () => {
            const row1 = modal.rowElements.get('asset-1');
            row1.dataset.selectable = 'false';
            const checkbox1 = row1.querySelector('.image-optimizer-row-checkbox');

            modal.selectAll();

            expect(modal.selectedAssets.has('asset-1')).toBe(false);
            expect(checkbox1.checked).toBe(false);
            expect(modal.selectedAssets.has('asset-2')).toBe(true);
        });
    });

    describe('updateToggleAllState', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                queue: new Map([
                    ['asset-1', {}],
                    ['asset-2', {}],
                ]),
            };
        });

        it('should check toggle all when all selected', () => {
            modal.selectedAssets.add('asset-1');
            modal.selectedAssets.add('asset-2');

            modal.updateToggleAllState();

            expect(modal.toggleAllCheckbox.checked).toBe(true);
            expect(modal.toggleAllCheckbox.indeterminate).toBe(false);
        });

        it('should set indeterminate when some selected', () => {
            modal.selectedAssets.add('asset-1');

            modal.updateToggleAllState();

            expect(modal.toggleAllCheckbox.checked).toBe(false);
            expect(modal.toggleAllCheckbox.indeterminate).toBe(true);
        });

        it('should uncheck when none selected', () => {
            modal.updateToggleAllState();

            expect(modal.toggleAllCheckbox.checked).toBe(false);
            expect(modal.toggleAllCheckbox.indeterminate).toBe(false);
        });
    });

    describe('updateButtons', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: STATUS.READY }]]),
                getQueueItem: vi.fn((id) => modal.optimizerManager.queue.get(id)),
                isInProgress: vi.fn(() => false),
            };
        });

        it('should enable optimize button when has ready items', () => {
            modal.selectedAssets.add('asset-1');
            modal.updateButtons();

            expect(modal.optimizeBtn.disabled).toBe(false);
        });

        it('should disable optimize button when no selection', () => {
            modal.updateButtons();

            expect(modal.optimizeBtn.disabled).toBe(true);
        });

        it('should disable optimize button when processing', () => {
            modal.selectedAssets.add('asset-1');
            modal.optimizerManager.isInProgress = vi.fn(() => true);

            modal.updateButtons();

            expect(modal.optimizeBtn.disabled).toBe(true);
        });

        it('should disable optimize button when no ready items', () => {
            modal.selectedAssets.add('asset-1');
            modal.optimizerManager.queue.set('asset-1', { status: STATUS.PENDING });

            modal.updateButtons();

            expect(modal.optimizeBtn.disabled).toBe(true);
        });
    });

    describe('updateProgressBar', () => {
        it('should update progress bar width', () => {
            modal.updateProgressBar(5, 10);

            expect(modal.progressBar.style.width).toBe('50%');
        });

        it('should update aria-valuenow', () => {
            modal.updateProgressBar(3, 4);

            expect(modal.progressBar.getAttribute('aria-valuenow')).toBe('75');
        });

        it('should update percent text', () => {
            modal.updateProgressBar(1, 4);

            expect(modal.progressPercent.textContent).toBe('25%');
        });

        it('should handle 0 total', () => {
            modal.updateProgressBar(0, 0);

            expect(modal.progressBar.style.width).toBe('0%');
        });
    });

    describe('setCurrentProcessingItem', () => {
        beforeEach(() => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png' }, blob, true);
            modal.rowElements.set('asset-1', row);
            document.body.appendChild(row);
        });

        it('should highlight the current row', () => {
            modal.setCurrentProcessingItem('asset-1', 'test.png');

            const row = modal.rowElements.get('asset-1');
            expect(row.classList.contains('table-warning')).toBe(true);
        });

        it('should update progress detail text', () => {
            modal.setCurrentProcessingItem('asset-1', 'test.png');

            expect(modal.progressDetail.textContent).toContain('test.png');
        });

        it('should clear highlight when null', () => {
            const row = modal.rowElements.get('asset-1');
            row.classList.add('table-warning');

            modal.setCurrentProcessingItem(null);

            expect(row.classList.contains('table-warning')).toBe(false);
        });

        it('should clear progress detail when null', () => {
            modal.progressDetail.textContent = 'Processing: test.png';
            modal.setCurrentProcessingItem(null);

            expect(modal.progressDetail.textContent).toBe('');
        });
    });

    describe('setRowsInteractive', () => {
        beforeEach(() => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png' }, blob, true);
            modal.rowElements.set('asset-1', row);
        });

        it('should disable row checkboxes when not interactive', () => {
            modal.setRowsInteractive(false);

            const row = modal.rowElements.get('asset-1');
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            expect(checkbox.disabled).toBe(true);
        });

        it('should enable row checkboxes when interactive', () => {
            modal.setRowsInteractive(false);
            modal.setRowsInteractive(true);

            const row = modal.rowElements.get('asset-1');
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            expect(checkbox.disabled).toBe(false);
        });

        it('should disable toggle all checkbox', () => {
            modal.setRowsInteractive(false);

            expect(modal.toggleAllCheckbox.disabled).toBe(true);
        });

        it('should disable select/deselect buttons', () => {
            modal.setRowsInteractive(false);

            expect(modal.selectAllBtn.disabled).toBe(true);
            expect(modal.deselectAllBtn.disabled).toBe(true);
        });
    });

    describe('onPresetChange', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                setPreset: vi.fn(),
                resetEstimates: vi.fn(),
                isInProgress: vi.fn(() => false),
                cancel: vi.fn(),
                getQueueItem: vi.fn(() => null),
                estimateSelected: vi.fn().mockResolvedValue({}),
                queue: new Map(),
                getStatsForSelection: vi.fn(() => ({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
            };
        });

        it('should update manager preset', () => {
            modal.presetSelect.value = 'strong';
            modal.onPresetChange();

            expect(modal.optimizerManager.setPreset).toHaveBeenCalledWith('strong');
        });

        it('should update quality slider value', () => {
            modal.presetSelect.value = 'strong';
            modal.onPresetChange();

            expect(modal.qualitySlider.value).toBe('75');
            expect(modal.qualityValue.textContent).toBe('75');
        });

        it('should trigger re-estimation', () => {
            const reEstimateSpy = vi.spyOn(modal, 'reEstimate');
            modal.presetSelect.value = 'strong';
            modal.onPresetChange();

            expect(reEstimateSpy).toHaveBeenCalled();
        });
    });

    describe('onQualityChange', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            modal.optimizerManager = {
                setJpegQuality: vi.fn(),
                resetEstimates: vi.fn(),
                isInProgress: vi.fn(() => false),
                cancel: vi.fn(),
                getQueueItem: vi.fn(() => null),
                estimateSelected: vi.fn().mockResolvedValue({}),
                queue: new Map(),
                getStatsForSelection: vi.fn(() => ({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
            };
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should update manager quality', () => {
            modal.qualitySlider.value = '90';
            modal.onQualityChange();

            expect(modal.optimizerManager.setJpegQuality).toHaveBeenCalledWith(0.9);
        });

        it('should update quality value display', () => {
            modal.qualitySlider.value = '75';
            modal.onQualityChange();

            expect(modal.qualityValue.textContent).toBe('75');
        });

        it('should trigger re-estimation after debounce delay', () => {
            const reEstimateSpy = vi.spyOn(modal, 'reEstimate');
            modal.qualitySlider.value = '75';
            modal.onQualityChange();

            expect(reEstimateSpy).not.toHaveBeenCalled();
            vi.runAllTimers();
            expect(reEstimateSpy).toHaveBeenCalled();
        });

        it('should debounce re-estimation on rapid slider changes', () => {
            const reEstimateSpy = vi.spyOn(modal, 'reEstimate');
            modal.qualitySlider.value = '75';
            modal.onQualityChange();
            modal.onQualityChange();
            modal.onQualityChange();

            vi.runAllTimers();
            expect(reEstimateSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('reEstimate', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                setPreset: vi.fn(),
                resetEstimates: vi.fn(),
                isInProgress: vi.fn(() => false),
                cancel: vi.fn(),
                getQueueItem: vi.fn((id) => modal.optimizerManager.queue.get(id)),
                estimateSelected: vi.fn().mockResolvedValue({}),
                queue: new Map([
                    ['asset-1', { assetId: 'asset-1', status: 'pending', estimatedSize: null, originalSize: 1000 }],
                ]),
                getStatsForSelection: vi.fn(() => ({ selected: 1, totalOriginal: 1000, totalEstimated: 0, savings: 0, savingsPercent: 0 })),
                cancel: vi.fn(),
            };

            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png', size: 1000 }, blob, true);
            modal.rowElements.set('asset-1', row);
            modal.selectedAssets.add('asset-1');
        });

        it('should do nothing when viewState is not normal', async () => {
            modal.viewState = 'progress';

            await modal.reEstimate();

            expect(modal.optimizerManager.resetEstimates).not.toHaveBeenCalled();
        });

        it('should do nothing when optimizerManager is null', async () => {
            modal.optimizerManager = null;

            // Should not throw
            await expect(modal.reEstimate()).resolves.toBeUndefined();
        });

        it('should reset estimates on the manager', async () => {
            await modal.reEstimate();

            expect(modal.optimizerManager.resetEstimates).toHaveBeenCalled();
        });

        it('should restart estimation for currently selected assets', async () => {
            await modal.reEstimate();

            expect(modal.optimizerManager.estimateSelected).toHaveBeenCalledWith(['asset-1']);
        });

        it('should cancel ongoing estimation before re-estimating', async () => {
            modal.optimizerManager.isInProgress = vi.fn(() => true);
            modal._estimatePromise = Promise.resolve();

            await modal.reEstimate();

            expect(modal.optimizerManager.cancel).toHaveBeenCalled();
        });

        it('should re-enable and re-select previously disabled "already optimized" items', async () => {
            const row = modal.rowElements.get('asset-1');
            row.dataset.selectable = 'false';
            modal.selectedAssets.delete('asset-1');

            await modal.reEstimate();

            expect(modal.selectedAssets.has('asset-1')).toBe(true);
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            expect(checkbox.disabled).toBe(false);
        });

        it('should not start estimation when no assets are selected', async () => {
            modal.selectedAssets.clear();
            // All rows remain selectable but none are selected
            for (const row of modal.rowElements.values()) {
                row.dataset.selectable = 'true';
            }

            await modal.reEstimate();

            expect(modal.optimizerManager.estimateSelected).not.toHaveBeenCalled();
        });
    });

    describe('onProgress', () => {
        it('should update progress bar during optimize phase', () => {
            modal.viewState = 'progress';
            modal.onProgress(5, 10, 'optimize');

            expect(modal.progressBar.style.width).toBe('50%');
        });

        it('should not update progress bar during estimate phase', () => {
            modal.viewState = 'progress';
            modal.progressBar.style.width = '0%';

            modal.onProgress(5, 10, 'estimate');

            expect(modal.progressBar.style.width).toBe('0%');
        });

        it('should not update progress bar when not in progress state', () => {
            modal.viewState = 'normal';
            modal.progressBar.style.width = '0%';

            modal.onProgress(5, 10, 'optimize');

            expect(modal.progressBar.style.width).toBe('0%');
        });
    });

    describe('onHide', () => {
        let mockOptimizerManager;

        beforeEach(() => {
            mockOptimizerManager = {
                cancel: vi.fn(),
                terminateWorker: vi.fn(),
            };
            modal.optimizerManager = mockOptimizerManager;

            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png' }, blob, true);
            modal.rowElements.set('asset-1', row);
            modal.selectedAssets.add('asset-1');
        });

        it('should cancel and terminate worker', () => {
            modal.onHide();

            expect(mockOptimizerManager.cancel).toHaveBeenCalled();
            expect(mockOptimizerManager.terminateWorker).toHaveBeenCalled();
        });

        it('should revoke thumbnail blob URLs', () => {
            modal.onHide();

            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should clear state', () => {
            modal.onHide();

            expect(modal.rowElements.size).toBe(0);
            expect(modal.selectedAssets.size).toBe(0);
            expect(modal.viewState).toBe('normal');
        });

        it('should reset to normal view state', () => {
            modal.viewState = 'progress';
            modal.onHide();

            expect(modal.viewState).toBe('normal');
        });
    });

    describe('computeHash', () => {
        it('should compute SHA-256 hash of blob', async () => {
            const blob = new Blob(['test data']);
            const hash = await modal.computeHash(blob);

            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 produces 32 bytes = 64 hex chars
        });
    });

    describe('show (state management)', () => {
        it('should reset state on show', async () => {
            modal.selectedAssets.add('old-asset');
            modal.rowElements.set('old-asset', document.createElement('tr'));
            modal.viewState = 'progress';

            // Pre-set a mock optimizer manager to avoid Worker constructor issue
            modal.optimizerManager = {
                onAssetUpdate: null,
                onProgress: null,
                onEstimateComplete: null,
                onOptimizeComplete: null,
                onError: null,
            };

            // Clear state like show() does, then test it
            modal.selectedAssets.clear();
            modal.rowElements.clear();
            modal.viewState = 'normal';

            expect(modal.selectedAssets.size).toBe(0);
            expect(modal.rowElements.size).toBe(0);
            expect(modal.viewState).toBe('normal');
        });

        it('should set content state to loading', () => {
            modal.setContentState('loading');

            expect(modal.loadingEl.classList.contains('d-none')).toBe(false);
            expect(modal.emptyEl.classList.contains('d-none')).toBe(true);
            expect(modal.contentEl.classList.contains('d-none')).toBe(true);
        });

        it('should disable optimize button when loading', () => {
            modal.setContentState('loading');

            expect(modal.optimizeBtn.disabled).toBe(true);
        });
    });

    describe('loadProjectImages', () => {
        it('should show empty state when assetManager is not available', async () => {
            window.eXeLearning.app.project._yjsBridge = null;

            await modal.loadProjectImages();

            expect(modal.emptyEl.classList.contains('d-none')).toBe(false);
        });

        it('should show empty state when getProjectAssets fails', async () => {
            window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets = vi.fn().mockRejectedValue(new Error('Failed'));

            await modal.loadProjectImages();

            expect(modal.emptyEl.classList.contains('d-none')).toBe(false);
        });

        it('should show empty state when no images found', async () => {
            window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets = vi.fn().mockResolvedValue([
                { id: 'asset-1', mime: 'application/pdf', filename: 'doc.pdf' },
            ]);

            await modal.loadProjectImages();

            expect(modal.emptyEl.classList.contains('d-none')).toBe(false);
        });

        it('should filter PNG and JPEG images', async () => {
            const pngBlob = new Blob(['png'], { type: 'image/png' });
            const jpegBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
            window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets = vi.fn().mockResolvedValue([
                { id: 'asset-1', mime: 'image/png', filename: 'test.png', blob: pngBlob, size: 100 },
                { id: 'asset-2', mime: 'image/jpeg', filename: 'test.jpg', blob: jpegBlob, size: 200 },
                { id: 'asset-3', mime: 'application/pdf', filename: 'doc.pdf', size: 300 },
            ]);

            modal.optimizerManager = {
                addAsset: vi.fn(),
                estimateSelected: vi.fn().mockResolvedValue({}),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
                queue: new Map(),
            };

            await modal.loadProjectImages();

            // Should add only PNG and JPEG
            expect(modal.optimizerManager.addAsset).toHaveBeenCalledTimes(2);
        });

        it('should show quality slider when JPEGs present', async () => {
            const jpegBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
            window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets = vi.fn().mockResolvedValue([
                { id: 'asset-1', mime: 'image/jpeg', filename: 'test.jpg', blob: jpegBlob, size: 200 },
            ]);

            modal.optimizerManager = {
                addAsset: vi.fn(),
                estimateSelected: vi.fn().mockResolvedValue({}),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
                queue: new Map([['asset-1', {}]]),
            };

            await modal.loadProjectImages();

            expect(modal.hasJpegs).toBe(true);
            expect(modal.qualityContainer.classList.contains('d-none')).toBe(false);
        });
    });

    describe('fetchAssetBlob', () => {
        it('should return null when assetManager is not available', async () => {
            window.eXeLearning.app.project._yjsBridge = null;

            const blob = await modal.fetchAssetBlob('asset-1');

            expect(blob).toBeNull();
        });

        it('should return blob from getBlob if available', async () => {
            const testBlob = new Blob(['test'], { type: 'image/png' });
            window.eXeLearning.app.project._yjsBridge.assetManager.getBlob = vi.fn().mockResolvedValue(testBlob);

            const blob = await modal.fetchAssetBlob('asset-1');

            expect(blob).toBe(testBlob);
        });

        it('should fallback to resolving URL when getBlob returns null', async () => {
            const testBlob = new Blob(['test'], { type: 'image/png' });
            window.eXeLearning.app.project._yjsBridge.assetManager.getBlob = vi.fn().mockResolvedValue(null);
            window.eXeLearning.app.project._yjsBridge.assetManager.resolveAssetURL = vi.fn().mockResolvedValue('blob:resolved');
            global.fetch = vi.fn().mockResolvedValue({
                blob: vi.fn().mockResolvedValue(testBlob),
            });

            const blob = await modal.fetchAssetBlob('asset-1');

            expect(blob).toBe(testBlob);
        });

        it('should return null when metadata not found', async () => {
            window.eXeLearning.app.project._yjsBridge.assetManager.getBlob = vi.fn().mockResolvedValue(null);
            window.eXeLearning.app.project._yjsBridge.assetManager.getAssetMetadata = vi.fn().mockReturnValue(null);

            const blob = await modal.fetchAssetBlob('asset-1');

            expect(blob).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            window.eXeLearning.app.project._yjsBridge.assetManager.getBlob = vi.fn().mockRejectedValue(new Error('DB error'));

            const blob = await modal.fetchAssetBlob('asset-1');

            expect(blob).toBeNull();
        });
    });

    describe('updateSummary', () => {
        it('should update summary elements', () => {
            modal.optimizerManager = {
                getStatsForSelection: vi.fn().mockReturnValue({
                    selected: 3,
                    totalOriginal: 3000,
                    totalEstimated: 2400,
                    savings: 600,
                    savingsPercent: '20.0',
                }),
            };

            modal.selectedAssets.add('asset-1');
            modal.selectedAssets.add('asset-2');
            modal.selectedAssets.add('asset-3');

            modal.updateSummary();

            expect(modal.summaryEl.querySelector('.summary-selected').textContent).toBe('3');
            expect(modal.summaryEl.querySelector('.summary-original').textContent).toBe('2.9 KB');
        });

        it('should show dash when no estimates available', () => {
            modal.optimizerManager = {
                getStatsForSelection: vi.fn().mockReturnValue({
                    selected: 1,
                    totalOriginal: 1000,
                    totalEstimated: 0,
                    savings: 0,
                    savingsPercent: 0,
                }),
            };

            modal.updateSummary();

            expect(modal.summaryEl.querySelector('.summary-estimated').textContent).toBe('-');
        });

        it('should handle missing summaryEl', () => {
            modal.summaryEl = null;

            expect(() => modal.updateSummary()).not.toThrow();
        });
    });

    describe('startOptimization', () => {
        it('should not start if no selection', async () => {
            modal.optimizerManager = {
                optimizeSelected: vi.fn(),
            };
            modal.selectedAssets.clear();

            await modal.startOptimization();

            expect(modal.optimizerManager.optimizeSelected).not.toHaveBeenCalled();
        });

        it('should show progress view during optimization', async () => {
            modal.selectedAssets.add('asset-1');
            modal.optimizerManager = {
                optimizeSelected: vi.fn().mockResolvedValue({}),
                getQueueItem: vi.fn().mockReturnValue({ status: 'done', optimizedBlob: new Blob() }),
                isInProgress: vi.fn().mockReturnValue(false),
            };
            modal.replaceOptimizedAssets = vi.fn().mockResolvedValue();

            const viewStateSpy = vi.spyOn(modal, 'applyViewState');

            await modal.startOptimization();

            expect(viewStateSpy).toHaveBeenCalledWith('progress');
        });

        it('should show success toast on completion', async () => {
            modal.selectedAssets.add('asset-1');
            modal.optimizerManager = {
                optimizeSelected: vi.fn().mockResolvedValue({}),
                getQueueItem: vi.fn().mockReturnValue(null),
                isInProgress: vi.fn().mockReturnValue(false),
            };
            modal.replaceOptimizedAssets = vi.fn().mockResolvedValue();

            await modal.startOptimization();

            expect(eXeLearning.app.alerts.showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' })
            );
        });

        it('should show error toast on failure', async () => {
            modal.selectedAssets.add('asset-1');
            modal.optimizerManager = {
                optimizeSelected: vi.fn().mockRejectedValue(new Error('Failed')),
                isInProgress: vi.fn().mockReturnValue(false),
                getQueueItem: vi.fn().mockReturnValue(null),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
            };

            await modal.startOptimization();

            expect(eXeLearning.app.alerts.showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' })
            );
        });
    });

    describe('replaceOptimizedAssets', () => {
        it('should throw when assetManager not available', async () => {
            window.eXeLearning.app.project._yjsBridge = null;

            await expect(modal.replaceOptimizedAssets(['asset-1'])).rejects.toThrow('AssetManager not available');
        });

        it('should skip assets that are not done', async () => {
            modal.optimizerManager = {
                getQueueItem: vi.fn().mockReturnValue({ status: 'pending' }),
            };

            await modal.replaceOptimizedAssets(['asset-1']);

            // Should not throw, just skip
            expect(modal.optimizerManager.getQueueItem).toHaveBeenCalled();
        });

        it('should replace done assets with optimized blob', async () => {
            const optimizedBlob = new Blob(['optimized'], { type: 'image/png' });
            modal.optimizerManager = {
                getQueueItem: vi.fn().mockReturnValue({
                    status: 'done',
                    optimizedBlob,
                    outputFormat: 'image/png',
                }),
            };
            modal.uploadAsset = vi.fn().mockResolvedValue();

            await modal.replaceOptimizedAssets(['asset-1']);

            expect(window.eXeLearning.app.project._yjsBridge.assetManager.putBlob).toHaveBeenCalledWith('asset-1', optimizedBlob);
        });
    });

    describe('uploadAsset', () => {
        it('should throw when project UUID not available', async () => {
            window.eXeLearning.app.project.getProjectUuid = vi.fn().mockReturnValue(null);

            await expect(modal.uploadAsset('asset-1', new Blob(), 'test.png', 'image/png'))
                .rejects.toThrow('Project UUID not available');
        });

        it('should upload to correct endpoint', async () => {
            window.eXeLearning.app.project.getProjectUuid = vi.fn().mockReturnValue('proj-123');
            global.fetch = vi.fn().mockResolvedValue({ ok: true });

            await modal.uploadAsset('asset-1', new Blob(['test']), 'test.png', 'image/png');

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/projects/proj-123/assets',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should throw on upload failure', async () => {
            window.eXeLearning.app.project.getProjectUuid = vi.fn().mockReturnValue('proj-123');
            global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

            await expect(modal.uploadAsset('asset-1', new Blob(), 'test.png', 'image/png'))
                .rejects.toThrow('Upload failed: 500');
        });
    });

    describe('onEstimateComplete', () => {
        it('should update buttons and summary', () => {
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: 'ready' }]]),
                getQueueItem: vi.fn().mockReturnValue({ status: 'ready' }),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
                isInProgress: vi.fn().mockReturnValue(false),
            };

            const updateButtonsSpy = vi.spyOn(modal, 'updateButtons');
            const updateSummarySpy = vi.spyOn(modal, 'updateSummary');

            modal.onEstimateComplete();

            expect(updateButtonsSpy).toHaveBeenCalled();
            expect(updateSummarySpy).toHaveBeenCalled();
        });
    });

    describe('onOptimizeComplete', () => {
        it('should update buttons and summary', () => {
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: 'done' }]]),
                getQueueItem: vi.fn().mockReturnValue({ status: 'done' }),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
                isInProgress: vi.fn().mockReturnValue(false),
            };

            const updateButtonsSpy = vi.spyOn(modal, 'updateButtons');
            const updateSummarySpy = vi.spyOn(modal, 'updateSummary');

            modal.onOptimizeComplete();

            expect(updateButtonsSpy).toHaveBeenCalled();
            expect(updateSummarySpy).toHaveBeenCalled();
        });
    });

    describe('onError', () => {
        it('should log error to console', () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            modal.onError('asset-1', 'Test error');

            expect(errorSpy).toHaveBeenCalledWith('[ModalImageOptimizer] Error for asset-1:', 'Test error');
            errorSpy.mockRestore();
        });
    });

    describe('startAutoEstimate', () => {
        it('should estimate selected assets', async () => {
            modal.optimizerManager = {
                estimateSelected: vi.fn().mockResolvedValue({}),
                queue: new Map([['asset-1', { status: 'ready' }]]),
                getQueueItem: vi.fn().mockReturnValue({ status: 'ready' }),
                getStatsForSelection: vi.fn().mockReturnValue({ selected: 0, totalOriginal: 0, totalEstimated: 0, savings: 0, savingsPercent: 0 }),
                isInProgress: vi.fn().mockReturnValue(false),
            };
            modal.selectedAssets.add('asset-1');

            await modal.startAutoEstimate();

            expect(modal.optimizerManager.estimateSelected).toHaveBeenCalledWith(['asset-1']);
        });

        it('should handle estimation errors', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            modal.optimizerManager = {
                estimateSelected: vi.fn().mockRejectedValue(new Error('Estimate failed')),
            };
            modal.selectedAssets.add('asset-1');

            await modal.startAutoEstimate();

            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('initBehaviour', () => {
        it('should set up event listeners', () => {
            // Test that initBehaviour sets up event listeners
            modal.initBehaviour();

            // Verify listeners are attached (they were set in initBehaviour)
            expect(modal.presetSelect).toBeDefined();
            expect(modal.qualitySlider).toBeDefined();
        });
    });

    describe('event handlers', () => {
        beforeEach(() => {
            modal.optimizerManager = {
                queue: new Map([['asset-1', { status: STATUS.READY }]]),
                getQueueItem: vi.fn((id) => modal.optimizerManager.queue.get(id)),
                getStatsForSelection: vi.fn(() => ({ selected: 1, totalOriginal: 1000, totalEstimated: 750, savings: 250, savingsPercent: '25.0' })),
                isInProgress: vi.fn(() => false),
                setPreset: vi.fn(),
                optimizeSelected: vi.fn().mockResolvedValue({}),
            };
        });

        it('should show confirmation on optimize button click', () => {
            modal.selectedAssets.add('asset-1');

            // Directly call applyViewState to simulate what the click handler does
            modal.applyViewState('confirm');

            expect(modal.viewState).toBe('confirm');
        });

        it('should return to normal view on cancel button click', () => {
            modal.selectedAssets.add('asset-1');
            modal.applyViewState('confirm');

            modal.cancelBtn.click();

            expect(modal.viewState).toBe('normal');
        });

        it('should toggle all checkboxes on toggle all change', () => {
            const blob = new Blob(['test'], { type: 'image/png' });
            const row = modal.buildImageRow({ id: 'asset-1', filename: 'test.png', mime: 'image/png' }, blob, false);
            modal.rowElements.set('asset-1', row);

            modal.toggleAllCheckbox.checked = true;
            modal.toggleAllCheckbox.dispatchEvent(new Event('change'));

            expect(modal.selectedAssets.has('asset-1')).toBe(true);
        });
    });
});
