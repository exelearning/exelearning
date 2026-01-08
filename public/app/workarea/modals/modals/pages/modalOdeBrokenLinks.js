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

        // Status cell with spinner
        const statusTd = document.createElement('td');
        statusTd.className = 'link-status text-center';
        statusTd.innerHTML = this.getStatusHtml(link.status, link.error);
        tr.appendChild(statusTd);

        // URL cell
        const urlTd = document.createElement('td');
        urlTd.className = 'link-url';
        urlTd.textContent = link.url;
        urlTd.title = link.url;
        urlTd.style.maxWidth = '300px';
        urlTd.style.overflow = 'hidden';
        urlTd.style.textOverflow = 'ellipsis';
        urlTd.style.whiteSpace = 'nowrap';
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
     * Get HTML for status indicator
     * @param {string} status - pending, valid, or broken
     * @param {string|null} error - Error message if broken
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
            default:
                return '';
        }
    }

    /**
     * Create progress bar HTML
     * @returns {string}
     */
    createProgressHtml() {
        return `
            <div class="validation-progress mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="progress-text text-muted">${_('Validating links...')}</small>
                    <small class="progress-stats text-muted">0 / 0</small>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                </div>
            </div>
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
            const brokenText = stats.broken > 0
                ? `${stats.broken} ${_('broken')}`
                : _('No broken links');
            progressText.textContent = `${_('Complete')}: ${brokenText}`;
            progressText.classList.remove('text-muted');
            progressText.classList.add(stats.broken > 0 ? 'text-danger' : 'text-success');
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

        // Add visual indicator for broken links
        if (status === 'broken') {
            row.classList.add('table-danger');
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
                eXeLearning.app.alerts.showToast({
                    type: 'error',
                    message: _('Error validating links'),
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
     * Download broken links as CSV by parsing the visible table
     */
    downloadCsv() {
        this.preventCloseModal = true;

        // Find the table in the modal body
        const table = this.modalElement.querySelector('table');
        if (!table) {
            console.warn('[ModalOdeBrokenLinks] No table found for CSV export');
            return;
        }

        // Check if there are any broken links (rows with table-danger class)
        const brokenRows = table.querySelectorAll('tbody tr.table-danger');
        if (brokenRows.length === 0) {
            eXeLearning.app.alerts.showToast({
                type: 'info',
                message: _('No broken links to export'),
            });
            return;
        }

        // Create a filtered table with only broken links for CSV export
        const filteredTable = document.createElement('table');
        const thead = table.querySelector('thead');
        if (thead) {
            filteredTable.appendChild(thead.cloneNode(true));
        }

        const tbody = document.createElement('tbody');
        brokenRows.forEach((row) => {
            tbody.appendChild(row.cloneNode(true));
        });
        filteredTable.appendChild(tbody);

        // Convert to CSV, skipping the first column (Status icon)
        const csv = this.tableToCSV(filteredTable, { skipColumns: [0] });

        // Download the CSV file
        this.downloadCSVFile(csv, 'BrokenLinks.csv');
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
