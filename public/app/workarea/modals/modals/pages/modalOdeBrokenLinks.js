import Modal from '../modal.js';
import LinkValidationManager from '../../../utils/LinkValidationManager.js';

/**
 * Modal for progressive link validation
 *
 * Shows all links immediately with spinners, then updates each
 * to show valid (checkmark) or broken (X) status as validation completes.
 */
export default class ModalOdeBrokenLinks extends Modal {
    constructor(manager) {
        const id = 'modalOdeBrokenLinks';
        super(manager, id, undefined, false);
        this.confirmButtonDefaultText = _('Download CSV');
        this.cancelButtonDefaultText = _('Cancel');
        this.confirmButton = this.modalElement.querySelector('button.btn.btn-primary');
        this.cancelButton = this.modalElement.querySelector('button.close.btn.btn-secondary');

        /** @type {LinkValidationManager|null} */
        this.linkManager = null;

        /** @type {HTMLElement|null} */
        this.progressContainer = null;

        /** @type {HTMLElement|null} */
        this.tableBody = null;

        /** @type {Map<string, HTMLElement>} */
        this.rowElements = new Map();
    }

    /**
     * Create the table header with status column
     * @returns {HTMLElement}
     */
    makeTheadElements() {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        const titles = [
            _('Status'),
            _('Link'),
            _('Error'),
            _('Times'),
            _('Page name'),
            _('Block name'),
            _('iDevice'),
            _('Position'),
        ];

        for (const title of titles) {
            const th = document.createElement('th');
            th.textContent = title;
            tr.appendChild(th);
        }

        thead.appendChild(tr);
        return thead;
    }

    /**
     * Create a table row for a link
     * @param {Object} link - Link object with id, url, status, etc.
     * @returns {HTMLElement}
     */
    createLinkRow(link) {
        const tr = document.createElement('tr');
        tr.dataset.linkId = link.id;
        tr.dataset.status = link.status || 'pending';

        // Status cell with spinner
        const statusTd = document.createElement('td');
        statusTd.className = 'link-status text-center';
        statusTd.innerHTML = this.getStatusHtml(link.status, link.error);
        tr.appendChild(statusTd);

        // URL cell (clickable when the URL is safe to open in a new tab)
        const urlTd = document.createElement('td');
        urlTd.className = 'link-url';
        urlTd.title = link.url;
        urlTd.style.maxWidth = '300px';
        urlTd.style.overflow = 'hidden';
        urlTd.style.textOverflow = 'ellipsis';
        urlTd.style.whiteSpace = 'nowrap';
        urlTd.appendChild(this.createUrlContent(link.url));
        tr.appendChild(urlTd);

        // Error cell
        const errorTd = document.createElement('td');
        errorTd.className = 'link-error';
        errorTd.textContent = link.error || '';
        tr.appendChild(errorTd);

        // Count cell
        const countTd = document.createElement('td');
        countTd.textContent = link.count || '';
        tr.appendChild(countTd);

        // Page name cell
        const pageTd = document.createElement('td');
        pageTd.textContent = link.pageName || '';
        tr.appendChild(pageTd);

        // Block name cell
        const blockTd = document.createElement('td');
        blockTd.textContent = link.blockName || '';
        tr.appendChild(blockTd);

        // iDevice type cell
        const ideviceTd = document.createElement('td');
        ideviceTd.textContent = link.ideviceType || '';
        tr.appendChild(ideviceTd);

        // Order cell
        const orderTd = document.createElement('td');
        orderTd.textContent = link.order || '';
        tr.appendChild(orderTd);

        return tr;
    }

    /**
     * Build the content of the URL cell.
     * Only http(s) URLs become anchors, so a crafted `javascript:` or `data:`
     * href can never end up in the report.
     *
     * @param {string} url
     * @returns {HTMLElement|Text}
     */
    createUrlContent(url) {
        const safeUrl = typeof url === 'string' ? url.trim() : '';
        const isHttpUrl = /^https?:\/\//i.test(safeUrl) || safeUrl.startsWith('//');

        if (!isHttpUrl) {
            return document.createTextNode(safeUrl);
        }

        const anchor = document.createElement('a');
        anchor.href = safeUrl.startsWith('//') ? `https:${safeUrl}` : safeUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = safeUrl;
        return anchor;
    }

    /**
     * Get HTML for status indicator
     * @param {string} status - pending, valid, broken or unknown
     * @param {string|null} error - Error message if broken, reason if unknown
     * @returns {string}
     */
    getStatusHtml(status, error) {
        switch (status) {
            case 'pending':
            case 'validating':
                return `<span class="spinner-border spinner-border-sm text-secondary" role="status" aria-label="${_('Validating')}"></span>`;
            case 'valid':
                return `<span class="text-success" title="${_('Valid')}">&#10003;</span>`;
            case 'broken':
                return `<span class="text-danger" title="${error || _('Error')}">&#10007;</span>`;
            case 'unknown':
                return `<span class="text-warning-emphasis" title="${error || _('Requires manual review')}">&#9888;</span>`;
            default:
                return '';
        }
    }

    /**
     * Human-readable label for a status, used in the exported CSV
     * @param {string} status
     * @returns {string}
     */
    getStatusLabel(status) {
        switch (status) {
            case 'valid':
                return _('Valid');
            case 'broken':
                return _('Broken');
            case 'unknown':
                return _('Requires manual review');
            default:
                return '';
        }
    }

    /**
     * Create progress bar HTML
     * @returns {string}
     */
    createProgressHtml() {
        // Browser-limited flavors do not validate anything: promise a listing,
        // not a validation (review of PR #2208).
        const label = this.linkManager?.isBrowserLimited?.() ? _('Listing links...') : _('Validating links...');
        return `
            <div class="validation-progress mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="progress-text text-muted">${label}</small>
                    <small class="progress-stats text-muted">0 / 0</small>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Notice shown in flavors where the check runs in a plain browser (static
     * web, embeds): CORS hides the status of external links, so none of them
     * can be verified automatically and every one needs a manual review.
     * @returns {string}
     */
    createBrowserLimitedNoticeHtml() {
        return `
            <div class="alert alert-warning validation-static-notice small" role="alert">
                ${_(
                    'Due to browser security restrictions, this version of eXeLearning cannot check external links automatically. Open each link to review it manually.'
                )}
            </div>
        `;
    }

    /**
     * Legend explaining the three possible outcomes.
     * The amber one matters: a browser cannot read the HTTP status of a
     * cross-origin response, so many links can only be confirmed by opening them.
     * @returns {string}
     */
    createLegendHtml() {
        return `
            <p class="validation-legend small text-muted mb-2">
                <span class="text-success">&#10003;</span> ${_('Valid')} &middot;
                <span class="text-danger">&#10007;</span> ${_('Broken')} &middot;
                <span class="text-warning-emphasis">&#9888;</span> ${_('Requires manual review')}
                &mdash; ${_('the status of these links could not be checked automatically; open them to confirm.')}
                <br>
                ${_('A check mark means the server responded: some sites answer 200 even for pages that do not exist.')}
            </p>
        `;
    }

    /**
     * Update progress bar
     * @param {Object} stats - Validation statistics
     */
    updateProgress(stats) {
        if (!this.progressContainer) return;

        const progressBar = this.progressContainer.querySelector('.progress-bar');
        const progressStats = this.progressContainer.querySelector('.progress-stats');
        const progressText = this.progressContainer.querySelector('.progress-text');

        const percent = stats.total > 0 ? Math.round((stats.validated / stats.total) * 100) : 0;

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (progressStats) {
            progressStats.textContent = `${stats.validated} / ${stats.total}`;
        }

        if (progressText && stats.validated === stats.total) {
            const unknown = stats.unknown || 0;
            if (this.linkManager?.isBrowserLimited?.()) {
                // Nothing was validated in this flavor: report a listing, with
                // no "broken"/"Complete" language (review of PR #2208).
                progressText.textContent =
                    unknown > 0 ? `${_('Links listed')}: ${unknown} ${_('to review manually')}` : _('Links listed');
            } else {
                const summary = [
                    stats.broken > 0 ? `${stats.broken} ${_('broken')}` : _('No broken links'),
                    unknown > 0 ? `${unknown} ${_('to review')}` : '',
                ]
                    .filter(Boolean)
                    .join(', ');
                progressText.textContent = `${_('Complete')}: ${summary}`;
            }
            progressText.classList.remove('text-muted', 'text-danger', 'text-warning-emphasis', 'text-success');
            if (stats.broken > 0) {
                progressText.classList.add('text-danger');
            } else if (unknown > 0) {
                progressText.classList.add('text-warning-emphasis');
            } else {
                progressText.classList.add('text-success');
            }
        }
    }

    /**
     * Update a single link row
     * @param {string} linkId - Link ID
     * @param {string} status - New status
     * @param {string|null} error - Error message if broken
     */
    updateLinkRow(linkId, status, error) {
        const row = this.rowElements.get(linkId);
        if (!row) return;

        row.dataset.status = status;

        // Update status cell
        const statusCell = row.querySelector('.link-status');
        if (statusCell) {
            statusCell.innerHTML = this.getStatusHtml(status, error);
        }

        // Update error cell
        const errorCell = row.querySelector('.link-error');
        if (errorCell) {
            errorCell.textContent = error || '';
        }

        // Visual indicator: red for broken links, amber for inconclusive checks.
        // In browser-limited flavors every external link ends up unknown, so the
        // amber highlight carries no information and turns the whole table yellow
        // on top of the already amber notice: the ⚠ icon is marker enough there.
        row.classList.remove('table-danger', 'table-warning');
        if (status === 'broken') {
            row.classList.add('table-danger');
        } else if (status === 'unknown' && !this.linkManager?.isBrowserLimited?.()) {
            row.classList.add('table-warning');
        }
    }

    /**
     * Build the modal body with progress and table
     * @param {Array} links - Array of link objects
     * @returns {HTMLElement}
     */
    buildBody(links) {
        const container = document.createElement('div');

        // Progress section
        this.progressContainer = document.createElement('div');
        this.progressContainer.innerHTML = this.createProgressHtml();
        container.appendChild(this.progressContainer);

        // Browser-limited flavors cannot check external links at all: say so
        // once, up front, instead of letting the amber rows speak for themselves
        if (links.length > 0 && this.linkManager?.isBrowserLimited?.()) {
            const notice = document.createElement('div');
            notice.innerHTML = this.createBrowserLimitedNoticeHtml();
            container.appendChild(notice);
        }

        // Legend explaining the status icons
        const legend = document.createElement('div');
        legend.innerHTML = this.createLegendHtml();
        container.appendChild(legend);

        // Table
        const table = document.createElement('table');
        table.className = 'table table-striped table-sm';
        table.appendChild(this.makeTheadElements());

        this.tableBody = document.createElement('tbody');
        this.rowElements.clear();

        if (links.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 8;
            td.className = 'text-center text-muted';
            td.textContent = _('No links found in content');
            tr.appendChild(td);
            this.tableBody.appendChild(tr);
        } else {
            for (const link of links) {
                const row = this.createLinkRow(link);
                this.rowElements.set(link.id, row);
                this.tableBody.appendChild(row);
            }
        }

        table.appendChild(this.tableBody);

        // Wrap table in scrollable container
        const tableWrapper = document.createElement('div');
        tableWrapper.style.maxHeight = '400px';
        tableWrapper.style.overflowY = 'auto';
        tableWrapper.appendChild(table);

        container.appendChild(tableWrapper);

        return container;
    }

    /**
     * Show the modal and start validation
     * @param {Array} idevices - Array of idevice content objects
     */
    show(idevices) {
        this.titleDefault = _('Link Validation');
        const time = this.manager.closeModals() ? 500 : 50;

        setTimeout(() => {
            this.setTitle(this.titleDefault);

            // Disable CSV button initially
            if (this.confirmButton) {
                this.confirmButton.disabled = true;
                this.confirmButton.textContent = _('Download CSV');
            }

            // Create and configure the validation manager
            this.linkManager = new LinkValidationManager();

            this.linkManager.onLinksExtracted = (links, stats) => {
                // Build and show the table with all links
                const body = this.buildBody(links);
                this.setBody(body.innerHTML);

                // Re-bind row elements after setting body
                const rows = this.modalElement.querySelectorAll('tbody tr[data-link-id]');
                this.rowElements.clear();
                rows.forEach((row) => {
                    this.rowElements.set(row.dataset.linkId, row);
                });

                // Get progress container reference
                this.progressContainer = this.modalElement.querySelector('.validation-progress');
                this.updateProgress(stats);
            };

            this.linkManager.onLinkUpdate = (linkId, status, error) => {
                this.updateLinkRow(linkId, status, error);
            };

            this.linkManager.onProgress = (stats) => {
                this.updateProgress(stats);
            };

            this.linkManager.onComplete = (stats, cancelled) => {
                // Enable CSV download button
                if (this.confirmButton) {
                    this.confirmButton.disabled = false;
                }

                // Update progress to complete state
                this.updateProgress(stats);

                // Hide progress bar after a moment
                if (this.progressContainer && !cancelled) {
                    setTimeout(() => {
                        const progressBar = this.progressContainer.querySelector('.progress');
                        if (progressBar) {
                            progressBar.style.display = 'none';
                        }
                    }, 1000);
                }
            };

            this.linkManager.onError = (error) => {
                console.error('[ModalOdeBrokenLinks] Validation error:', error);
                eXeLearning.app.toasts.createToast({
                    title: _('Error'),
                    body: _('Error validating links'),
                    icon: 'error',
                    modal: true,
                    remove: 5000,
                });
            };

            // Set up CSV download
            this.setConfirmExec(() => {
                this.downloadCsv();
            });

            // Set up cancel to stop validation
            this.setCancelExec(() => {
                if (this.linkManager && this.linkManager.isInProgress()) {
                    this.linkManager.cancel();
                }
            });

            // Show the modal
            this.modal.show();

            // Start validation
            this.linkManager.startValidation(idevices || []);
        }, time);
    }

    /**
     * Download the links that need attention as CSV by parsing the visible table.
     * Includes both broken links and links that could not be checked automatically,
     * with the status spelled out instead of the icon.
     */
    downloadCsv() {
        this.preventCloseModal = true;

        // Find the table in the modal body
        const table = this.modalElement.querySelector('table');
        if (!table) {
            console.warn('[ModalOdeBrokenLinks] No table found for CSV export');
            return;
        }

        const rowsToExport = table.querySelectorAll(
            'tbody tr[data-status="broken"], tbody tr[data-status="unknown"]'
        );
        if (rowsToExport.length === 0) {
            eXeLearning.app.toasts.createToast({
                title: _('Link Validation'),
                body: _('No links to export'),
                icon: 'info',
                modal: true,
                remove: 5000,
            });
            return;
        }

        // Create a filtered table with the exportable rows
        const filteredTable = document.createElement('table');
        const thead = table.querySelector('thead');
        if (thead) {
            filteredTable.appendChild(thead.cloneNode(true));
        }

        const tbody = document.createElement('tbody');
        rowsToExport.forEach((row) => {
            const clone = row.cloneNode(true);
            // Replace the status icon with its text label so the CSV is readable
            const statusCell = clone.querySelector('.link-status');
            if (statusCell) {
                statusCell.textContent = this.getStatusLabel(row.dataset.status);
            }
            tbody.appendChild(clone);
        });
        filteredTable.appendChild(tbody);

        const csv = this.tableToCSV(filteredTable);

        // Download the CSV file. Named for what it contains — broken AND
        // review rows — not just broken links (review of PR #2208).
        this.downloadCSVFile(csv, 'link-report.csv');
    }

    /**
     * Clean up when modal is hidden
     */
    onHide() {
        if (this.linkManager) {
            this.linkManager.cancel();
            this.linkManager = null;
        }
        this.rowElements.clear();
        this.progressContainer = null;
        this.tableBody = null;
    }
}
