import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalOdeBrokenLinks from './modalOdeBrokenLinks.js';

// Mock LinkValidationManager as a class
const mockLinkManager = {
    startValidation: vi.fn(),
    cancel: vi.fn(),
    isInProgress: vi.fn().mockReturnValue(false),
    toExportFormat: vi.fn().mockReturnValue([]),
    onLinksExtracted: null,
    onLinkUpdate: null,
    onProgress: null,
    onComplete: null,
    onError: null,
};

vi.mock('../../../utils/LinkValidationManager.js', () => {
    return {
        default: class MockLinkValidationManager {
            constructor() {
                Object.assign(this, mockLinkManager);
            }
        },
    };
});

describe('ModalOdeBrokenLinks', () => {
    let modal;
    let mockManager;
    let mockElement;
    let mockBootstrapModal;

    beforeEach(() => {
        // Reset mock functions
        mockLinkManager.startValidation = vi.fn();
        mockLinkManager.cancel = vi.fn();
        mockLinkManager.isInProgress = vi.fn().mockReturnValue(false);
        mockLinkManager.toExportFormat = vi.fn().mockReturnValue([]);
        mockLinkManager.onLinksExtracted = null;
        mockLinkManager.onLinkUpdate = null;
        mockLinkManager.onProgress = null;
        mockLinkManager.onComplete = null;
        mockLinkManager.onError = null;

        // Mock translation function
        window._ = vi.fn((key) => key);

        // Mock eXeLearning global
        window.eXeLearning = {
            app: {
                project: { odeSession: 'test-session' },
                alerts: {
                    showToast: vi.fn(),
                },
                api: {
                    extractLinksForValidation: vi.fn().mockResolvedValue({
                        responseMessage: 'OK',
                        links: [],
                        totalLinks: 0,
                    }),
                    getLinkValidationStreamUrl: vi.fn().mockReturnValue('/api/validate-stream'),
                    app: {
                        menus: {
                            navbar: {
                                utilities: {
                                    json2Csv: vi.fn().mockReturnValue('csv-content'),
                                },
                            },
                        },
                    },
                },
            },
        };

        // Mock URL.createObjectURL and revokeObjectURL
        window.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
        window.URL.revokeObjectURL = vi.fn();

        // Mock DOM
        mockElement = document.createElement('div');
        mockElement.id = 'modalOdeBrokenLinks';
        mockElement.innerHTML = `
            <div class="modal-header">
                <h5 class="modal-title"></h5>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
                <button class="btn btn-primary confirm">Download CSV</button>
                <button class="close btn btn-secondary">Cancel</button>
            </div>
        `;
        document.body.appendChild(mockElement);

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'modalOdeBrokenLinks') return mockElement;
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

        // Mock interact
        const mockInteractable = {
            draggable: vi.fn().mockReturnThis(),
        };
        window.interact = vi.fn().mockImplementation(() => mockInteractable);
        window.interact.modifiers = {
            restrictRect: vi.fn(),
        };

        mockManager = {
            closeModals: vi.fn(() => false),
        };

        modal = new ModalOdeBrokenLinks(mockManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('makeTheadElements', () => {
        it('should create table header with all columns', () => {
            const thead = modal.makeTheadElements();
            const headers = thead.querySelectorAll('th');
            expect(headers.length).toBe(8);
            expect(headers[0].textContent).toBe('Status');
            expect(headers[1].textContent).toBe('Link');
            expect(headers[2].textContent).toBe('Error');
        });
    });

    describe('createLinkRow', () => {
        it('should create row with pending status', () => {
            const link = {
                id: 'test-id',
                url: 'https://example.com',
                status: 'pending',
                error: null,
                count: 1,
                pageName: 'Home',
                blockName: 'Content',
                ideviceType: 'Text',
                order: '1',
            };
            const row = modal.createLinkRow(link);
            expect(row.dataset.linkId).toBe('test-id');
            expect(row.querySelector('.link-status .spinner-border')).not.toBeNull();
            expect(row.querySelector('.link-url').textContent).toBe('https://example.com');
        });

        it('should create row with valid status', () => {
            const link = {
                id: 'test-id',
                url: 'https://example.com',
                status: 'valid',
                error: null,
                count: 1,
            };
            const row = modal.createLinkRow(link);
            expect(row.querySelector('.link-status .text-success')).not.toBeNull();
        });

        it('should create row with broken status', () => {
            const link = {
                id: 'test-id',
                url: 'https://broken.com',
                status: 'broken',
                error: '404',
                count: 1,
            };
            const row = modal.createLinkRow(link);
            expect(row.querySelector('.link-status .text-danger')).not.toBeNull();
            expect(row.querySelector('.link-error').textContent).toBe('404');
        });
    });

    describe('getStatusHtml', () => {
        it('should return spinner for pending status', () => {
            const html = modal.getStatusHtml('pending', null);
            expect(html).toContain('spinner-border');
        });

        it('should return spinner for validating status', () => {
            const html = modal.getStatusHtml('validating', null);
            expect(html).toContain('spinner-border');
        });

        it('should return checkmark for valid status', () => {
            const html = modal.getStatusHtml('valid', null);
            expect(html).toContain('text-success');
            expect(html).toContain('&#10003;');
        });

        it('should return X for broken status', () => {
            const html = modal.getStatusHtml('broken', '404');
            expect(html).toContain('text-danger');
            expect(html).toContain('&#10007;');
        });

        it('should return empty string for unknown status', () => {
            const html = modal.getStatusHtml('unknown', null);
            expect(html).toBe('');
        });
    });

    describe('createProgressHtml', () => {
        it('should create progress bar HTML', () => {
            const html = modal.createProgressHtml();
            expect(html).toContain('progress-bar');
            expect(html).toContain('progress-text');
            expect(html).toContain('progress-stats');
        });
    });

    describe('buildBody', () => {
        it('should build body with progress and table', () => {
            const links = [
                { id: '1', url: 'https://example.com', status: 'pending', count: 1 },
            ];
            const body = modal.buildBody(links);
            expect(body.querySelector('.validation-progress')).not.toBeNull();
            expect(body.querySelector('table')).not.toBeNull();
            expect(body.querySelectorAll('tbody tr').length).toBe(1);
        });

        it('should show "No links found" message when empty', () => {
            const body = modal.buildBody([]);
            const cell = body.querySelector('tbody td');
            expect(cell.textContent).toBe('No links found in content');
            expect(cell.colSpan).toBe(8);
        });
    });

    describe('updateProgress', () => {
        beforeEach(() => {
            modal.progressContainer = document.createElement('div');
            modal.progressContainer.innerHTML = modal.createProgressHtml();
        });

        it('should update progress bar width', () => {
            modal.updateProgress({ total: 10, validated: 5, broken: 0 });
            const bar = modal.progressContainer.querySelector('.progress-bar');
            expect(bar.style.width).toBe('50%');
        });

        it('should update stats text', () => {
            modal.updateProgress({ total: 10, validated: 3, broken: 0 });
            const stats = modal.progressContainer.querySelector('.progress-stats');
            expect(stats.textContent).toBe('3 / 10');
        });

        it('should show complete message when done', () => {
            modal.updateProgress({ total: 10, validated: 10, broken: 2 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toContain('Complete');
            expect(text.textContent).toContain('2');
            expect(text.classList.contains('text-danger')).toBe(true);
        });

        it('should show success message when no broken links', () => {
            modal.updateProgress({ total: 10, validated: 10, broken: 0 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toContain('No broken links');
            expect(text.classList.contains('text-success')).toBe(true);
        });
    });

    describe('updateLinkRow', () => {
        beforeEach(() => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="link-status"><span class="spinner-border"></span></td>
                <td class="link-url">https://example.com</td>
                <td class="link-error"></td>
            `;
            modal.rowElements.set('test-id', row);
        });

        it('should update row status to valid', () => {
            modal.updateLinkRow('test-id', 'valid', null);
            const row = modal.rowElements.get('test-id');
            expect(row.querySelector('.text-success')).not.toBeNull();
        });

        it('should update row status to broken', () => {
            modal.updateLinkRow('test-id', 'broken', '404');
            const row = modal.rowElements.get('test-id');
            expect(row.querySelector('.text-danger')).not.toBeNull();
            expect(row.querySelector('.link-error').textContent).toBe('404');
            expect(row.classList.contains('table-danger')).toBe(true);
        });

        it('should handle non-existent row', () => {
            // Should not throw
            modal.updateLinkRow('non-existent', 'valid', null);
        });
    });

    describe('show', () => {
        it('should set title to Link Validation', () => {
            vi.useFakeTimers();
            modal.show([]);
            vi.advanceTimersByTime(100);
            expect(mockElement.querySelector('.modal-title').textContent).toBe('Link Validation');
            vi.useRealTimers();
        });

        it('should disable CSV button initially', () => {
            vi.useFakeTimers();
            modal.show([]);
            vi.advanceTimersByTime(100);
            expect(modal.confirmButton.disabled).toBe(true);
            vi.useRealTimers();
        });

        it('should create LinkValidationManager and start validation', () => {
            vi.useFakeTimers();
            const idevices = [{ html: '<a href="https://test.com">Test</a>' }];
            modal.show(idevices);
            vi.advanceTimersByTime(100);
            expect(modal.linkManager).not.toBeNull();
            expect(modal.linkManager.startValidation).toHaveBeenCalledWith(idevices);
            vi.useRealTimers();
        });

        it('should show modal', () => {
            vi.useFakeTimers();
            modal.show([]);
            vi.advanceTimersByTime(100);
            expect(mockBootstrapModal.show).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('downloadCsv', () => {
        it('should warn when no link manager', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            modal.linkManager = null;
            modal.downloadCsv();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[ModalOdeBrokenLinks] No link manager available for CSV export'
            );
        });

        it('should show toast when no broken links', () => {
            modal.linkManager = {
                toExportFormat: vi.fn().mockReturnValue([]),
            };
            modal.downloadCsv();
            expect(eXeLearning.app.alerts.showToast).toHaveBeenCalledWith({
                type: 'info',
                message: 'No broken links to export',
            });
        });

        it('should create and trigger download', () => {
            const brokenLinks = [
                {
                    brokenLinks: 'http://bad.link',
                    brokenLinksError: '404',
                    nTimesBrokenLinks: 1,
                },
            ];
            modal.linkManager = {
                toExportFormat: vi.fn().mockReturnValue(brokenLinks),
            };

            // Store original createElement
            const originalCreateElement = document.createElement.bind(document);
            const clickSpy = vi.fn();

            // Mock createElement to intercept anchor creation
            document.createElement = vi.fn((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = clickSpy;
                }
                return el;
            });

            modal.downloadCsv();

            expect(window.eXeLearning.app.api.app.menus.navbar.utilities.json2Csv).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();

            // Restore original
            document.createElement = originalCreateElement;
        });
    });

    describe('onHide', () => {
        it('should cancel validation and clean up', () => {
            const mockCancel = vi.fn();
            modal.linkManager = { cancel: mockCancel };
            modal.rowElements.set('test', document.createElement('tr'));
            modal.progressContainer = document.createElement('div');

            modal.onHide();

            expect(mockCancel).toHaveBeenCalled();
            expect(modal.linkManager).toBeNull();
            expect(modal.rowElements.size).toBe(0);
            expect(modal.progressContainer).toBeNull();
        });
    });
});
