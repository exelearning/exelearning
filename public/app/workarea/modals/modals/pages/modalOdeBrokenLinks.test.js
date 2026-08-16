import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalOdeBrokenLinks from './modalOdeBrokenLinks.js';

// Mock LinkValidationManager as a class
const mockLinkManager = {
    startValidation: vi.fn(),
    cancel: vi.fn(),
    isInProgress: vi.fn().mockReturnValue(false),
    isBrowserLimited: vi.fn().mockReturnValue(false),
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
        mockLinkManager.isBrowserLimited = vi.fn().mockReturnValue(false);
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
                toasts: {
                    createToast: vi.fn(),
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
            expect(row.dataset.status).toBe('broken');
            expect(row.querySelector('.link-status .text-danger')).not.toBeNull();
            expect(row.querySelector('.link-error').textContent).toBe('404');
        });

        it('should render the URL as a clickable link', () => {
            const link = {
                id: 'test-id',
                url: 'https://www.youtube.com/@example',
                status: 'unknown',
                error: 'Not checked automatically: open the link to review it',
                count: 1,
            };
            const row = modal.createLinkRow(link);
            const anchor = row.querySelector('.link-url a');
            expect(anchor).not.toBeNull();
            expect(anchor.getAttribute('href')).toBe('https://www.youtube.com/@example');
            expect(anchor.getAttribute('target')).toBe('_blank');
            expect(row.querySelector('.link-url').textContent).toBe('https://www.youtube.com/@example');
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

        it('should return a warning sign for links needing manual review', () => {
            const html = modal.getStatusHtml('unknown', 'Not checked automatically: open the link to review it');
            expect(html).toContain('text-warning-emphasis');
            expect(html).toContain('&#9888;');
            expect(html).toContain('Not checked automatically: open the link to review it');
        });

        it('should fall back to a generic title when no reason is given', () => {
            const html = modal.getStatusHtml('unknown', null);
            expect(html).toContain('Requires manual review');
        });

        it('should return empty string for an unrecognised status', () => {
            const html = modal.getStatusHtml('not-a-status', null);
            expect(html).toBe('');
        });
    });

    describe('getStatusLabel', () => {
        it('should return readable labels for exported statuses', () => {
            expect(modal.getStatusLabel('valid')).toBe('Valid');
            expect(modal.getStatusLabel('broken')).toBe('Broken');
            expect(modal.getStatusLabel('unknown')).toBe('Requires manual review');
            expect(modal.getStatusLabel('pending')).toBe('');
        });
    });

    describe('createUrlContent', () => {
        it('should render http(s) URLs as links opening in a new tab', () => {
            const anchor = modal.createUrlContent('https://example.com/page');
            expect(anchor.tagName).toBe('A');
            expect(anchor.getAttribute('href')).toBe('https://example.com/page');
            expect(anchor.getAttribute('target')).toBe('_blank');
            expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
            expect(anchor.textContent).toBe('https://example.com/page');
        });

        it('should resolve protocol-relative URLs to https', () => {
            const anchor = modal.createUrlContent('//cdn.example.com/file.js');
            expect(anchor.getAttribute('href')).toBe('https://cdn.example.com/file.js');
            expect(anchor.textContent).toBe('//cdn.example.com/file.js');
        });

        it('should not build an anchor for non-http schemes', () => {
            const node = modal.createUrlContent('javascript:alert(1)');
            expect(node.nodeType).toBe(Node.TEXT_NODE);
            expect(node.textContent).toBe('javascript:alert(1)');
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

    describe('createLegendHtml', () => {
        it('should explain that a check mark only means the server responded (soft-404s)', () => {
            const html = modal.createLegendHtml();
            expect(html).toContain('some sites answer 200');
        });
    });

    describe('browser-limited relabelling', () => {
        beforeEach(() => {
            modal.linkManager = { isBrowserLimited: () => true };
            modal.progressContainer = document.createElement('div');
            modal.progressContainer.innerHTML = modal.createProgressHtml();
        });

        it('should promise a listing instead of a validation while running', () => {
            expect(modal.createProgressHtml()).toContain('Listing links...');
        });

        it('should close with a listing summary, without validation language', () => {
            modal.updateProgress({ total: 5, validated: 5, broken: 0, unknown: 3 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toBe('Links listed: 3 to review manually');
            expect(text.textContent).not.toContain('Complete');
            expect(text.classList.contains('text-warning-emphasis')).toBe(true);
        });

        it('should report a plain listing when nothing needs review', () => {
            modal.updateProgress({ total: 2, validated: 2, broken: 0, unknown: 0 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toBe('Links listed');
            expect(text.classList.contains('text-success')).toBe(true);
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

        it('should explain the browser limitation in flavors that cannot check links', () => {
            modal.linkManager = { isBrowserLimited: () => true };
            const links = [{ id: '1', url: 'https://example.com', status: 'pending', count: 1 }];

            const body = modal.buildBody(links);

            const notice = body.querySelector('.validation-static-notice');
            expect(notice).not.toBeNull();
            expect(notice.textContent).toContain('browser security restrictions');
        });

        it('should not show the browser-limitation notice when links can be checked', () => {
            modal.linkManager = { isBrowserLimited: () => false };
            const links = [{ id: '1', url: 'https://example.com', status: 'pending', count: 1 }];

            const body = modal.buildBody(links);

            expect(body.querySelector('.validation-static-notice')).toBeNull();
        });

        it('should not show the browser-limitation notice when there are no links', () => {
            modal.linkManager = { isBrowserLimited: () => true };

            const body = modal.buildBody([]);

            expect(body.querySelector('.validation-static-notice')).toBeNull();
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

        it('should report how many links need a manual review', () => {
            modal.updateProgress({ total: 10, validated: 10, broken: 0, unknown: 4 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toContain('No broken links');
            expect(text.textContent).toContain('4 to review');
            expect(text.classList.contains('text-warning-emphasis')).toBe(true);
            expect(text.classList.contains('text-success')).toBe(false);
        });

        it('should keep the danger colour when there are broken and reviewable links', () => {
            modal.updateProgress({ total: 10, validated: 10, broken: 2, unknown: 3 });
            const text = modal.progressContainer.querySelector('.progress-text');
            expect(text.textContent).toContain('2 broken');
            expect(text.textContent).toContain('3 to review');
            expect(text.classList.contains('text-danger')).toBe(true);
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
            expect(row.dataset.status).toBe('broken');
        });

        it('should highlight links needing a manual review in amber', () => {
            modal.updateLinkRow('test-id', 'unknown', 'Not checked automatically: open the link to review it');
            const row = modal.rowElements.get('test-id');
            expect(row.querySelector('.text-warning-emphasis')).not.toBeNull();
            expect(row.classList.contains('table-warning')).toBe(true);
            expect(row.classList.contains('table-danger')).toBe(false);
            expect(row.dataset.status).toBe('unknown');
            expect(row.querySelector('.link-error').textContent).toBe(
                'Not checked automatically: open the link to review it',
            );
        });

        it('should not paint rows amber in browser-limited flavors', () => {
            // Every external link is unknown there, so the amber background adds
            // nothing over the notice and floods the table with yellow.
            modal.linkManager = { isBrowserLimited: () => true };

            modal.updateLinkRow('test-id', 'unknown', 'Not checked automatically');

            const row = modal.rowElements.get('test-id');
            expect(row.classList.contains('table-warning')).toBe(false);
            expect(row.querySelector('.text-warning-emphasis')).not.toBeNull();
            expect(row.dataset.status).toBe('unknown');
        });

        it('should still paint broken rows red in browser-limited flavors', () => {
            modal.linkManager = { isBrowserLimited: () => true };

            modal.updateLinkRow('test-id', 'broken', '404');

            expect(modal.rowElements.get('test-id').classList.contains('table-danger')).toBe(true);
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

    describe('onError', () => {
        it('should show an error toast via the real toast API when validation fails', () => {
            vi.useFakeTimers();
            modal.show([]);
            vi.advanceTimersByTime(100);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Trigger the validation-error callback wired up in show()
            modal.linkManager.onError(new Error('boom'));

            expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith({
                title: 'Error',
                body: 'Error validating links',
                icon: 'error',
                modal: true,
                remove: 5000,
            });
            consoleSpy.mockRestore();
            vi.useRealTimers();
        });
    });

    describe('downloadCsv', () => {
        it('should warn when no table found', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            // Clear modal body to have no table
            modal.modalElement.querySelector('.modal-body').innerHTML = '';
            modal.downloadCsv();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[ModalOdeBrokenLinks] No table found for CSV export'
            );
        });

        it('should show toast when nothing needs exporting', () => {
            // Create table with only valid links
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead><tr><th>Status</th><th>Link</th></tr></thead>
                    <tbody>
                        <tr data-status="valid"><td>OK</td><td>https://valid.com</td></tr>
                    </tbody>
                </table>
            `;
            modal.downloadCsv();
            expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith({
                title: 'Link Validation',
                body: 'No links to export',
                icon: 'info',
                modal: true,
                remove: 5000,
            });
        });

        it('should not throw when there are no broken links (regression #1947)', () => {
            // Reproduces the reported crash: the toast manager lives at
            // app.toasts.createToast, not the non-existent app.alerts.showToast.
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead><tr><th>Status</th><th>Link</th></tr></thead>
                    <tbody>
                        <tr data-status="valid"><td>OK</td><td>https://valid.com</td></tr>
                    </tbody>
                </table>
            `;
            expect(() => modal.downloadCsv()).not.toThrow();
            expect(eXeLearning.app.toasts.createToast).toHaveBeenCalled();
        });

        it('should create and trigger download for broken links', () => {
            // Create table with broken links
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Link</th>
                            <th>Error</th>
                            <th>Times</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="table-danger" data-status="broken">
                            <td class="link-status">X</td>
                            <td>http://broken.link</td>
                            <td>404</td>
                            <td>1</td>
                        </tr>
                    </tbody>
                </table>
            `;

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

            expect(clickSpy).toHaveBeenCalled();

            // Restore original
            document.createElement = originalCreateElement;
        });

        it('should spell out the status instead of exporting the icon', () => {
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Link</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="table-danger" data-status="broken">
                            <td class="link-status"><span class="text-danger">&#10007;</span></td>
                            <td>http://broken.link</td>
                            <td>404</td>
                        </tr>
                        <tr class="table-warning" data-status="unknown">
                            <td class="link-status"><span class="text-warning">&#9888;</span></td>
                            <td>https://www.youtube.com/@example</td>
                            <td>Not checked automatically: open the link to review it</td>
                        </tr>
                    </tbody>
                </table>
            `;

            const tableToCSVSpy = vi.spyOn(modal, 'tableToCSV');
            modal.downloadCsv();

            expect(tableToCSVSpy).toHaveBeenCalled();
            const filteredTable = tableToCSVSpy.mock.calls[0][0];
            const statusCells = filteredTable.querySelectorAll('tbody .link-status');
            expect(statusCells[0].textContent).toBe('Broken');
            expect(statusCells[1].textContent).toBe('Requires manual review');
            // The status column is no longer dropped from the CSV
            expect(tableToCSVSpy.mock.calls[0][1]).toBeUndefined();
        });

        it('should name the export after its content (broken + review rows)', () => {
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead><tr><th>Status</th><th>Link</th></tr></thead>
                    <tbody>
                        <tr data-status="broken"><td class="link-status">X</td><td>http://broken.com</td></tr>
                    </tbody>
                </table>
            `;
            const downloadSpy = vi.spyOn(modal, 'downloadCSVFile').mockImplementation(() => {});

            modal.downloadCsv();

            expect(downloadSpy).toHaveBeenCalledWith(expect.any(String), 'link-report.csv');
        });

        it('should include broken and manual-review rows but not valid ones', () => {
            modal.modalElement.querySelector('.modal-body').innerHTML = `
                <table>
                    <thead>
                        <tr><th>Status</th><th>Link</th></tr>
                    </thead>
                    <tbody>
                        <tr data-status="valid"><td class="link-status">OK</td><td>https://valid.com</td></tr>
                        <tr class="table-danger" data-status="broken"><td class="link-status">X</td><td>http://broken.com</td></tr>
                        <tr class="table-warning" data-status="unknown"><td class="link-status">!</td><td>https://review.com</td></tr>
                        <tr data-status="pending"><td class="link-status"></td><td>https://pending.com</td></tr>
                    </tbody>
                </table>
            `;

            const tableToCSVSpy = vi.spyOn(modal, 'tableToCSV');
            modal.downloadCsv();

            expect(tableToCSVSpy).toHaveBeenCalled();
            const filteredTable = tableToCSVSpy.mock.calls[0][0];
            const rows = filteredTable.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);
            expect(rows[0].dataset.status).toBe('broken');
            expect(rows[1].dataset.status).toBe('unknown');
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
