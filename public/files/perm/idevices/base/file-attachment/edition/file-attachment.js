/* eslint-disable no-undef */
/**
 * File attachment iDevice (edition code)
 *
 * Lets authors attach one or more downloadable files to a page. Files are
 * selected/uploaded through the existing Media Library (File Manager) and stored
 * as stable `asset://` references; the binary asset stays the source of truth.
 *
 * Released under the GNU AGPL-3.0 License.
 */
var $exeDevice = {
    i18n: {
        name: _('File attachments'),
    },

    ideviceBody: null,
    idevicePreviousData: null,
    idevicePath: '',
    introEditorId: 'fileAttachmentIntro',
    nextRowId: 0,

    /**
     * Required eXe init hook.
     *
     * @param {HTMLElement} element - the iDevice body node to render into
     * @param {Object} previousData - parsed jsonProperties from a previous save
     * @param {String} path - edition resources path
     */
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData || {};
        this.idevicePath = path || '';
        this.nextRowId = 0;
        this.createForm();
        this.observeAssetChanges();
    },

    /**
     * Build the authoring form and wire behaviour.
     */
    createForm: function () {
        this.ideviceBody.innerHTML = `
            <div class="fileAttachmentForm">
                <div class="exe-parent">
                    <fieldset id="fileAttachmentIntroFieldset" class="exe-fieldset exe-fieldset-closed">
                        <legend class="exe-text-legend">
                            <a href="#">${_('Instructions')}</a>
                        </legend>
                        <div>
                            <textarea id="${this.introEditorId}" class="exe-html-editor" aria-label="${_('Instructions')}" rows="4"></textarea>
                        </div>
                    </fieldset>
                </div>

                <div>
                    <label class="fileAttachment-toggle" for="fileAttachmentShowDescriptions">
                        <input type="checkbox" id="fileAttachmentShowDescriptions" checked />
                        ${_('Show file descriptions')}
                    </label>
                </div>

                <div class="fileAttachment-actions">
                    <button type="button" id="fileAttachmentAddButton" class="btn btn-primary">
                        ${_('Add files')}
                    </button>
                    <input type="file" id="fileAttachmentNativeInput" multiple style="display:none;" />
                </div>

                <ul id="fileAttachmentList" class="fileAttachment-edit-list"></ul>
                <p id="fileAttachmentEmpty" class="fileAttachment-edit-empty">${_('No files attached yet.')}</p>
            </div>
        `;

        this.loadPreviousValues();
        this.addEvents();
        this.refreshEmptyState();
    },

    /**
     * Restore previously saved state into the form.
     */
    loadPreviousValues: function () {
        const data = this.idevicePreviousData || {};

        const introEl = this.ideviceBody.querySelector(`#${this.introEditorId}`);
        if (introEl) introEl.value = data.intro || '';

        // Expand the (collapsible) instructions panel when it already has content.
        if (data.intro && String(data.intro).trim()) {
            const introFieldset = this.ideviceBody.querySelector('#fileAttachmentIntroFieldset');
            if (introFieldset) introFieldset.classList.remove('exe-fieldset-closed');
        }

        const showDescEl = this.ideviceBody.querySelector('#fileAttachmentShowDescriptions');
        if (showDescEl) showDescEl.checked = data.showDescriptions !== false;

        const attachments = Array.isArray(data.attachments) ? data.attachments : [];
        attachments.forEach((attachment) => this.addAttachment(attachment));

        if (typeof $exeTinyMCE !== 'undefined' && $exeTinyMCE.init) {
            $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
        }
    },

    /**
     * Wire global form behaviour (add button + native input fallback).
     */
    addEvents: function () {
        const addButton = this.ideviceBody.querySelector('#fileAttachmentAddButton');
        if (addButton) {
            addButton.addEventListener('click', () => this.openFileManager());
        }

        const nativeInput = this.ideviceBody.querySelector('#fileAttachmentNativeInput');
        if (nativeInput) {
            nativeInput.addEventListener('change', (event) => {
                const files = Array.from(event.target.files || []);
                files.forEach((file) => this.uploadFile(file));
                event.target.value = '';
            });
        }
    },

    /**
     * Open the Media Library / File Manager to pick or upload files.
     * Falls back to a native file input when the modal is unavailable.
     */
    openFileManager: function () {
        const fileManager = this.getFileManager();
        if (!fileManager) {
            const nativeInput = this.ideviceBody.querySelector('#fileAttachmentNativeInput');
            if (nativeInput) nativeInput.click();
            return;
        }

        fileManager.show({
            multiSelect: true,
            onSelect: (result) => {
                const results = Array.isArray(result) ? result : [result];
                results.forEach((item) => this.addAttachmentFromAsset(item));
            },
        });
    },

    /**
     * Resolve the File Manager modal instance if it is usable.
     *
     * @returns {Object|null}
     */
    getFileManager: function () {
        const fileManager =
            typeof eXeLearning !== 'undefined' &&
            eXeLearning.app &&
            eXeLearning.app.modals &&
            eXeLearning.app.modals.filemanager;
        return fileManager && typeof fileManager.show === 'function' ? fileManager : null;
    },

    /**
     * Resolve the live AssetManager (used by the native-input fallback).
     *
     * @returns {Object|null}
     */
    getAssetManager: function () {
        return (
            (typeof eXeLearning !== 'undefined' &&
                eXeLearning.app &&
                eXeLearning.app.project &&
                eXeLearning.app.project._yjsBridge &&
                eXeLearning.app.project._yjsBridge.assetManager) ||
            null
        );
    },

    /**
     * Observe the Media Library asset metadata so attachments stay in sync when a
     * referenced file is renamed or deleted while this iDevice is being edited.
     * There is no dedicated asset-change event, so we observe the shared Yjs map.
     */
    observeAssetChanges: function () {
        const assetManager = this.getAssetManager();
        const assetsMap =
            assetManager && typeof assetManager.getAssetsYMap === 'function' ? assetManager.getAssetsYMap() : null;
        if (!assetsMap || typeof assetsMap.observe !== 'function') return;

        const body = this.ideviceBody;
        // Bind to this instance, not to the global `$exeDevice`: the core resets that
        // global when edition ends while the iDevice node stays on the page, so
        // reading it here threw a TypeError that Yjs propagated into the Media
        // Library rename/delete caller.
        const device = this;
        const handler = () => {
            // Self-clean once this iDevice's DOM has been torn down.
            if (typeof document !== 'undefined' && !document.contains(body)) {
                try {
                    assetsMap.unobserve(handler);
                } catch (e) {
                    // Ignore unobserve errors on already-detached maps.
                }
                return;
            }
            device.refreshAttachmentsFromAssets();
        };

        assetsMap.observe(handler);
        this._assetsObserver = { map: assetsMap, handler };
    },

    /**
     * Reconcile every attachment row against the live Media Library assets.
     */
    refreshAttachmentsFromAssets: function () {
        const rows = this.ideviceBody.querySelectorAll('#fileAttachmentList .fileAttachment-edit-item');
        rows.forEach((row) => this.refreshRowFromAsset(row));
    },

    /**
     * Reconcile a single row against the live asset: update the filename/icon when
     * it was renamed, or flag it missing when it was deleted from the Media Library.
     *
     * @param {HTMLElement} row
     */
    refreshRowFromAsset: function (row) {
        const assetManager = this.getAssetManager();
        if (!assetManager || typeof assetManager.getAssetMetadata !== 'function') return;

        const url = row.getAttribute('data-url') || '';
        if (url.indexOf('asset://') !== 0) return;

        const assetId =
            typeof assetManager.extractAssetId === 'function' ? assetManager.extractAssetId(url) : null;
        if (!assetId) return;

        const meta = assetManager.getAssetMetadata(assetId);
        if (!meta) {
            // The referenced file was deleted from the Media Library.
            this.setRowMissing(row, true);
            return;
        }

        const filename = meta.filename || row.getAttribute('data-filename') || '';
        const newUrl =
            typeof assetManager.getAssetUrl === 'function' ? assetManager.getAssetUrl(assetId, filename) : url;
        this.updateRowMeta(row, {
            url: newUrl,
            filename,
            mimeType: meta.mime || '',
            size: typeof meta.size === 'number' ? meta.size : 0,
        });
        this.setRowMissing(row, false);
    },

    /**
     * Apply refreshed asset metadata to a row's stored data and display.
     *
     * @param {HTMLElement} row
     * @param {Object} meta - { url, filename, mimeType, size }
     */
    updateRowMeta: function (row, meta) {
        if (meta.url) row.setAttribute('data-url', meta.url);
        row.setAttribute('data-filename', meta.filename || '');
        row.setAttribute('data-mime', meta.mimeType || '');
        row.setAttribute('data-size', String(meta.size || 0));

        const filenameEl = row.querySelector('.fileAttachment-edit-filename');
        if (filenameEl) filenameEl.textContent = meta.filename || _('Unknown file');

        const iconEl = row.querySelector('.fileAttachment-edit-icon');
        if (iconEl) {
            const category = this.getFileCategory(meta.mimeType, meta.filename);
            iconEl.className = `fileAttachment-edit-icon fileAttachment-icon--${category}`;
            iconEl.innerHTML = this.getFileIconSvg(meta.mimeType, meta.filename);
        }
    },

    /**
     * Toggle the "missing asset" state on a row.
     *
     * @param {HTMLElement} row
     * @param {Boolean} missing
     */
    setRowMissing: function (row, missing) {
        row.classList.toggle('fileAttachment-edit-item--missing', missing);
        const fields = row.querySelector('.fileAttachment-edit-fields');
        if (!fields) return;

        let warning = fields.querySelector('.fileAttachment-edit-warning');
        if (missing && !warning) {
            warning = document.createElement('p');
            warning.className = 'fileAttachment-edit-warning';
            warning.textContent = _('The attached file is missing. Re-add it from the Media Library.');
            const filenameEl = fields.querySelector('.fileAttachment-edit-filename');
            if (filenameEl) {
                filenameEl.insertAdjacentElement('afterend', warning);
            } else {
                fields.insertAdjacentElement('afterbegin', warning);
            }
        } else if (!missing && warning) {
            warning.remove();
        }
    },

    /**
     * Upload a single File through the AssetManager and add it as an attachment.
     *
     * @param {File} file
     */
    uploadFile: async function (file) {
        const assetManager = this.getAssetManager();
        if (!assetManager || typeof assetManager.insertImage !== 'function') {
            if (typeof eXe !== 'undefined' && eXe.app && eXe.app.alert) {
                eXe.app.alert(_('The Media Library is not available.'));
            }
            return;
        }
        try {
            const assetUrl = await assetManager.insertImage(file);
            if (!assetUrl) return;
            const assetId = assetManager.extractAssetId ? assetManager.extractAssetId(assetUrl) : null;
            const metadata =
                assetId && assetManager.getAssetMetadata ? assetManager.getAssetMetadata(assetId) || {} : {};
            this.addAttachment({
                url: assetUrl,
                filename: metadata.filename || file.name || '',
                mimeType: metadata.mime || file.type || '',
                size: typeof metadata.size === 'number' ? metadata.size : file.size || 0,
                title: '',
                description: '',
            });
        } catch (e) {
            if (typeof eXe !== 'undefined' && eXe.app && eXe.app.alert) {
                eXe.app.alert(_('The file could not be uploaded.'));
            }
        }
    },

    /**
     * Add an attachment from a Media Library selection result.
     *
     * @param {Object} result - { assetUrl, blobUrl, asset:{ filename, mime, size } }
     */
    addAttachmentFromAsset: function (result) {
        if (!result) return;
        const asset = result.asset || {};
        this.addAttachment({
            url: result.assetUrl || '',
            filename: asset.filename || '',
            mimeType: asset.mime || '',
            size: typeof asset.size === 'number' ? asset.size : 0,
            title: '',
            description: '',
        });
    },

    /**
     * Append an attachment row to the list.
     *
     * @param {Object} attachment
     */
    addAttachment: function (attachment) {
        attachment = attachment || {};
        const list = this.ideviceBody.querySelector('#fileAttachmentList');
        if (!list) return;

        const rowId = this.nextRowId++;
        const filename = attachment.filename || '';
        const url = attachment.url || '';
        const category = this.getFileCategory(attachment.mimeType, filename);
        const icon = this.getFileIconSvg(attachment.mimeType, filename);
        const missing = !url;

        const item = document.createElement('li');
        item.className = `fileAttachment-edit-item${missing ? ' fileAttachment-edit-item--missing' : ''}`;
        item.setAttribute('data-row-id', String(rowId));
        item.setAttribute('data-url', url);
        item.setAttribute('data-filename', filename);
        item.setAttribute('data-mime', attachment.mimeType || '');
        item.setAttribute('data-size', String(typeof attachment.size === 'number' ? attachment.size : 0));

        const titleId = `fileAttachmentTitle_${rowId}`;
        const descId = `fileAttachmentDesc_${rowId}`;
        const displayName = filename || _('Unknown file');

        item.innerHTML = `
            <span class="fileAttachment-edit-icon fileAttachment-icon--${category}" aria-hidden="true">${icon}</span>
            <div class="fileAttachment-edit-fields">
                <p class="fileAttachment-edit-filename">${this.escapeHtml(displayName)}</p>
                ${
                    missing
                        ? `<p class="fileAttachment-edit-warning">${_('The attached file is missing. Re-add it from the Media Library.')}</p>`
                        : ''
                }
                <div class="fileAttachment-edit-details fileAttachment-edit-details-closed">
                    <button type="button" class="fileAttachment-edit-details-toggle" aria-expanded="false">${_('File properties')}</button>
                    <div class="fileAttachment-edit-details-body">
                        <div class="property-row">
                            <label for="${titleId}">${_('Title')}:</label>
                            <input type="text" id="${titleId}" class="fileAttachment-edit-title ideviceTextfield" value="${this.escapeAttr(attachment.title || '')}" />
                        </div>
                        <div class="property-row">
                            <label for="${descId}">${_('Description')}:</label>
                            <textarea id="${descId}" class="fileAttachment-edit-description ideviceTextfield" rows="2">${this.escapeHtml(attachment.description || '')}</textarea>
                        </div>
                    </div>
                </div>
            </div>
            <div class="fileAttachment-edit-buttons">
                <button type="button" class="fileAttachment-edit-up" title="${_('Move up')}" aria-label="${_('Move up')}"><i aria-hidden="true">keyboard_arrow_up</i></button>
                <button type="button" class="fileAttachment-edit-down" title="${_('Move down')}" aria-label="${_('Move down')}"><i aria-hidden="true">keyboard_arrow_down</i></button>
                <button type="button" class="fileAttachment-edit-remove" title="${_('Delete')}" aria-label="${_('Delete')}"><i aria-hidden="true">close</i></button>
            </div>
        `;

        list.appendChild(item);
        this.addRowEvents(item);
        // Reconcile against the live Media Library asset (handles a renamed or
        // deleted asset since this attachment was last saved).
        this.refreshRowFromAsset(item);
        this.refreshEmptyState();
    },

    /**
     * Wire per-row buttons (properties, reorder + remove).
     *
     * @param {HTMLElement} item
     */
    addRowEvents: function (item) {
        // Collapsible file properties section (collapsed by default, like the
        // optional feedback section in the text iDevice).
        const detailsToggle = item.querySelector('.fileAttachment-edit-details-toggle');
        if (detailsToggle) {
            detailsToggle.addEventListener('click', () => {
                const details = item.querySelector('.fileAttachment-edit-details');
                const closed = details.classList.toggle('fileAttachment-edit-details-closed');
                detailsToggle.setAttribute('aria-expanded', String(!closed));
            });
        }

        const removeBtn = item.querySelector('.fileAttachment-edit-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                item.remove();
                this.refreshEmptyState();
            });
        }

        const upBtn = item.querySelector('.fileAttachment-edit-up');
        if (upBtn) {
            upBtn.addEventListener('click', () => {
                const prev = item.previousElementSibling;
                if (prev) item.parentNode.insertBefore(item, prev);
            });
        }

        const downBtn = item.querySelector('.fileAttachment-edit-down');
        if (downBtn) {
            downBtn.addEventListener('click', () => {
                const next = item.nextElementSibling;
                if (next) item.parentNode.insertBefore(next, item);
            });
        }
    },

    /**
     * Toggle the empty-state message based on the number of rows.
     */
    refreshEmptyState: function () {
        const list = this.ideviceBody.querySelector('#fileAttachmentList');
        const empty = this.ideviceBody.querySelector('#fileAttachmentEmpty');
        if (!list || !empty) return;
        empty.style.display = list.children.length === 0 ? '' : 'none';
    },

    /**
     * Required eXe save hook.
     *
     * @returns {Object|false}
     */
    save: function () {
        const showDescEl = this.ideviceBody.querySelector('#fileAttachmentShowDescriptions');

        const data = {
            ideviceId: this.ideviceBody.getAttribute('idevice-id'),
            intro: this.getIntro(),
            showDescriptions: showDescEl ? showDescEl.checked : true,
            attachments: this.collectAttachments(),
        };

        return data;
    },

    /**
     * Read the instructions HTML, preferring the live TinyMCE editor.
     *
     * @returns {String}
     */
    getIntro: function () {
        if (typeof tinymce !== 'undefined' && tinymce.get) {
            const editor = tinymce.get(this.introEditorId);
            if (editor && typeof editor.getContent === 'function') {
                return editor.getContent();
            }
        }
        const introEl = this.ideviceBody.querySelector(`#${this.introEditorId}`);
        return introEl ? introEl.value : '';
    },

    /**
     * Collect attachment data from the rendered rows, preserving order.
     *
     * @returns {Array}
     */
    collectAttachments: function () {
        const rows = this.ideviceBody.querySelectorAll('#fileAttachmentList .fileAttachment-edit-item');
        const attachments = [];
        rows.forEach((row) => {
            const titleEl = row.querySelector('.fileAttachment-edit-title');
            const descEl = row.querySelector('.fileAttachment-edit-description');
            const size = parseInt(row.getAttribute('data-size') || '0', 10);
            attachments.push({
                url: row.getAttribute('data-url') || '',
                filename: row.getAttribute('data-filename') || '',
                mimeType: row.getAttribute('data-mime') || '',
                size: isNaN(size) ? 0 : size,
                title: titleEl ? titleEl.value.trim() : '',
                description: descEl ? descEl.value.trim() : '',
            });
        });
        return attachments;
    },

    /**
     * Map a MIME type / filename to a coarse file category used for icon styling.
     *
     * @param {String} mimeType
     * @param {String} filename
     * @returns {String}
     */
    getFileCategory: function (mimeType, filename) {
        const mime = (mimeType || '').toLowerCase();
        const ext = this.getExtension(filename);

        if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
            return 'image';
        }
        if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac'].includes(ext)) return 'audio';
        if (mime.startsWith('video/') || ['mp4', 'webm', 'ogv', 'avi', 'mov', 'mkv'].includes(ext)) return 'video';
        if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
        if (
            mime.includes('zip') ||
            mime.includes('compressed') ||
            mime.includes('x-tar') ||
            ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
        ) {
            return 'archive';
        }
        if (mime.includes('word') || mime === 'application/msword' || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
            return 'document';
        }
        if (
            mime.includes('sheet') ||
            mime.includes('excel') ||
            mime === 'text/csv' ||
            ['xls', 'xlsx', 'ods', 'csv'].includes(ext)
        ) {
            return 'spreadsheet';
        }
        if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx', 'odp'].includes(ext)) {
            return 'presentation';
        }
        if (mime.startsWith('text/') || ['txt', 'md', 'html', 'htm', 'xml', 'json'].includes(ext)) return 'text';
        return 'file';
    },

    /**
     * Lowercase file extension without the dot (empty string when none).
     *
     * @param {String} filename
     * @returns {String}
     */
    getExtension: function (filename) {
        if (!filename || typeof filename !== 'string') return '';
        const clean = filename.split(/[?#]/)[0];
        const dot = clean.lastIndexOf('.');
        if (dot <= 0 || dot === clean.length - 1) return '';
        return clean.slice(dot + 1).toLowerCase();
    },

    /**
     * Self-contained inline SVG document icon labelled with the file extension.
     *
     * @param {String} mimeType
     * @param {String} filename
     * @returns {String}
     */
    getFileIconSvg: function (mimeType, filename) {
        const ext = this.getExtension(filename);
        const rawLabel = (ext || this.getFileCategory(mimeType, filename) || 'file').toUpperCase();
        const label = this.escapeHtml(rawLabel.replace(/[^A-Z0-9]/g, '').slice(0, 4));
        return `<svg class="fileAttachment-glyph" viewBox="0 0 40 48" width="40" height="48" focusable="false" aria-hidden="true"><path class="fileAttachment-glyph-page" d="M4 2h22l10 10v34a0 0 0 0 1 0 0H4a0 0 0 0 1 0 0V2z"/><path class="fileAttachment-glyph-fold" d="M26 2l10 10H26z"/><text class="fileAttachment-glyph-label" x="20" y="34" text-anchor="middle">${label}</text></svg>`;
    },

    /**
     * Escape text for safe insertion as element content.
     *
     * @param {String} str
     * @returns {String}
     */
    escapeHtml: function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Escape a value for safe insertion as an HTML attribute.
     *
     * @param {String} str
     * @returns {String}
     */
    escapeAttr: function (str) {
        return this.escapeHtml(str);
    },
};
