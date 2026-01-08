import Modal from '../modal.js';

export default class ModalOdeUsedFiles extends Modal {
    constructor(manager) {
        let id = 'modalOdeUsedFiles';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.confirmButtonDefaultText = _('End');
        this.cancelButtonDefaultText = _('Cancel');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeTheadElements() {
        let tHead = document.createElement('thead');
        let thTitles = [
            _('File'),
            _('Path'),
            _('Size'),
            _('Page name'),
            _('Block name'),
            _('iDevice'),
            _('Position'),
        ];
        for (let thCount = 0; thCount < thTitles.length; thCount++) {
            let th = document.createElement('th');
            th.textContent = _(thTitles[thCount]);
            tHead.appendChild(th);
        }
        return tHead;
    }

    /**
     * Create a clickable link for an asset path
     * @param {string} path - The asset path (asset://uuid or server path)
     * @returns {HTMLElement} - A clickable anchor or span element
     */
    createPathLink(path) {
        if (!path) {
            let span = document.createElement('span');
            span.textContent = '';
            return span;
        }

        // Check if it's an asset:// URL (browser-stored asset)
        const assetMatch = path.match(/asset:\/\/([a-f0-9-]+)/i);
        if (assetMatch) {
            const assetId = assetMatch[1];
            let link = document.createElement('a');
            link.href = '#';
            link.textContent = path;
            link.title = _('Click to open resource in new window');
            link.style.cursor = 'pointer';
            link.onclick = async (e) => {
                e.preventDefault();
                await this.openAssetInNewWindow(assetId);
            };
            return link;
        }

        // Check if it's a server path (starts with / or http)
        if (path.startsWith('/') || path.startsWith('http')) {
            let link = document.createElement('a');
            link.href = path;
            link.textContent = path;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = _('Click to open resource in new window');
            return link;
        }

        // Default: just text
        let span = document.createElement('span');
        span.textContent = path;
        return span;
    }

    /**
     * Open a browser-stored asset in a new window
     * @param {string} assetId - The asset UUID
     */
    async openAssetInNewWindow(assetId) {
        try {
            const assetManager =
                eXeLearning.app.project?._yjsBridge?.assetManager;
            if (!assetManager) {
                console.error(
                    '[ModalOdeUsedFiles] AssetManager not available'
                );
                alert(_('Cannot open resource: Asset manager not available'));
                return;
            }

            const asset = await assetManager.getAsset(assetId);
            if (!asset || !asset.blob) {
                console.error(
                    `[ModalOdeUsedFiles] Asset not found: ${assetId}`
                );
                alert(_('Cannot open resource: Asset not found'));
                return;
            }

            const blobUrl = await assetManager.createBlobURL(asset.blob);
            window.open(blobUrl, '_blank');
        } catch (error) {
            console.error(
                '[ModalOdeUsedFiles] Error opening asset:',
                error
            );
            alert(_('Error opening resource'));
        }
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeTbodyElements(odeElements) {
        let odeComponentLinkKey;
        let tBody = document.createElement('tbody');
        let files = odeElements['usedFiles'];
        for (
            odeComponentLinkKey = 0;
            odeComponentLinkKey < files.length;
            odeComponentLinkKey++
        ) {
            let tdContent = [
                files[odeComponentLinkKey]['usedFiles'],
                files[odeComponentLinkKey]['usedFilesPath'],
                files[odeComponentLinkKey]['usedFilesSize'],
                files[odeComponentLinkKey]['pageNamesUsedFiles'],
                files[odeComponentLinkKey]['blockNamesUsedFiles'],
                files[odeComponentLinkKey]['typeComponentSyncUsedFiles'],
                files[odeComponentLinkKey]['orderComponentSyncUsedFiles'],
            ];
            let tr = document.createElement('tr');
            for (let tdCount = 0; tdCount < tdContent.length; tdCount++) {
                let td = document.createElement('td');
                // Column 1 (index 1) is the path - make it clickable
                if (tdCount === 1) {
                    td.appendChild(this.createPathLink(tdContent[tdCount]));
                } else {
                    td.textContent = tdContent[tdCount];
                }
                tr.appendChild(td);
            }
            tBody.appendChild(tr);
        }
        return tBody;
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeOdeListElements(odeElements) {
        let odeTable = document.createElement('table');
        let tHead = this.makeTheadElements();
        let tBody = this.makeTbodyElements(odeElements);
        odeTable.appendChild(tHead);
        odeTable.appendChild(tBody);
        odeTable.classList.add('table');
        odeTable.classList.add('table-striped');
        return odeTable;
    }

    /**
     * Set body content using DOM element (preserves event handlers)
     * @param {HTMLElement} element - DOM element to set as body content
     */
    setBodyElement(element) {
        this.modalElementBody.innerHTML = '';
        this.modalElementBody.appendChild(element);
    }

    /**
     *
     * @param {*} odeElements
     */
    show(odeElements) {
        // Set title
        this.titleDefault = _('Resource Report');
        let time = this.manager.closeModals() ? 500 : 50;
        setTimeout(() => {
            odeElements = odeElements ? odeElements : {};
            let title = odeElements.title
                ? odeElements.title
                : this.titleDefault;
            this.setTitle(title);
            // Use DOM element instead of innerHTML to preserve onclick handlers
            this.setBodyElement(this.makeOdeListElements(odeElements));
            this.setConfirmExec(() => {
                this.downloadCsv();
            });
            this.modal.show();
        }, time);
    }

    /**
     * Download resources as CSV by parsing the visible table
     * No server call needed - data is already in the rendered table
     */
    downloadCsv() {
        this.preventCloseModal = true;

        // Find the table in the modal body
        const table = this.modalElement.querySelector('table');
        if (!table) {
            console.warn('[ModalOdeUsedFiles] No table found for CSV export');
            return;
        }

        // Check if there are any data rows
        const dataRows = table.querySelectorAll('tbody tr');
        if (dataRows.length === 0) {
            eXeLearning.app.alerts.showToast({
                type: 'info',
                message: _('No resources to export'),
            });
            return;
        }

        // Convert table to CSV (no columns to skip)
        const csv = this.tableToCSV(table);

        // Download the CSV file
        this.downloadCSVFile(csv, 'ResourceReport.csv');
    }
}
