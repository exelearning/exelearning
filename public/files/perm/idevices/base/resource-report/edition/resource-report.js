/* eslint-disable no-undef */
/**
 * Resource Report iDevice — edition.
 *
 * Lists the project's assets (from the centralized File Manager metadata introduced
 * in PR #1868) as an accessible report with title, description, author, license and
 * View/Download links. The asset metadata remains the single source of truth: this
 * iDevice only snapshots the resolved list into its saved data so the export/preview
 * can render it statically (asset:// URLs are resolved by the preview resolver and the
 * export pipeline).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 */
var $exeDevice = {
    name: _('Resource report'),
    classIdevice: 'resource-report',

    // Default configuration — produces a useful report with zero configuration.
    defaults: {
        intro: '',
        resourceMode: 'all', // 'all' | 'used'
        typeFilter: 'all', // 'all' | 'image' | 'audio' | 'video' | 'document' | 'other'
        layout: 'list', // 'list' | 'cards'
        showThumbnail: true,
        showFileName: true,
        showDescription: true,
        showAuthor: true,
        showLicense: true,
        showViewLink: true,
        showDownloadLink: true,
    },

    /**
     * eXe idevice engine api: initialize the editor.
     * @param {HTMLElement} element - editor container
     * @param {Object} previousData - previously saved data object (or empty)
     */
    init: function (element, previousData) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.createForm();
        this.loadPreviousValues();
    },

    /**
     * Resolve the project AssetManager (single source of truth for assets/metadata).
     * @returns {Object|null}
     */
    getAssetManager: function () {
        return window.eXeLearning?.app?.project?._yjsBridge?.assetManager || null;
    },

    /**
     * Categorize an asset by MIME type / extension into a coarse resource type.
     * @param {string} mime
     * @param {string} filename
     * @returns {('image'|'audio'|'video'|'document'|'other')}
     */
    getResourceType: function (mime, filename) {
        const m = (mime || '').toLowerCase();
        if (m.startsWith('image/')) return 'image';
        if (m.startsWith('audio/')) return 'audio';
        if (m.startsWith('video/')) return 'video';
        const docMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument',
            'application/vnd.oasis.opendocument',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'text/plain',
            'text/markdown',
            'text/csv',
        ];
        if (docMimes.some((d) => m.startsWith(d))) return 'document';
        const ext = (filename || '').split('.').pop().toLowerCase();
        const docExt = ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'txt', 'md', 'rtf'];
        if (docExt.includes(ext)) return 'document';
        if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'].includes(ext)) return 'image';
        return 'other';
    },

    /**
     * Build the snapshot of resources for the current configuration. Pure function:
     * takes the asset metadata list, the config, the set of referenced asset ids
     * (or null when not filtering by usage) and a urlFor(asset) resolver.
     * @returns {Array<Object>}
     */
    buildResources: function (allMeta, config, referencedIds, urlFor) {
        const list = Array.isArray(allMeta) ? allMeta : [];
        const resolveUrl = typeof urlFor === 'function' ? urlFor : (a) => `asset://${a.id}`;
        return list
            .filter((a) => a && a.id)
            .filter((a) => {
                if (config.resourceMode === 'used' && referencedIds) {
                    return referencedIds.has(a.id);
                }
                return true;
            })
            .map((a) => {
                const type = this.getResourceType(a.mime, a.filename);
                return { asset: a, type };
            })
            .filter((entry) => config.typeFilter === 'all' || entry.type === config.typeFilter)
            .map(({ asset, type }) => ({
                id: asset.id,
                assetUrl: resolveUrl(asset),
                filename: asset.filename || '',
                mime: asset.mime || '',
                type,
                isImage: type === 'image',
                title: (asset.title || '').trim(),
                description: (asset.description || '').trim(),
                author: (asset.author || '').trim(),
                license: (asset.license || '').trim(),
            }));
    },

    /**
     * Read the current configuration from the form.
     * @returns {Object}
     */
    getConfigFromForm: function () {
        const body = this.ideviceBody;
        const val = (sel, fallback) => {
            const el = body.querySelector(sel);
            return el ? el.value : fallback;
        };
        const checked = (sel, fallback) => {
            const el = body.querySelector(sel);
            return el ? el.checked : fallback;
        };
        return {
            intro: (val('#rrIntro', '') || '').trim(),
            resourceMode: val('#rrResourceMode', this.defaults.resourceMode),
            typeFilter: val('#rrTypeFilter', this.defaults.typeFilter),
            layout: val('#rrLayout', this.defaults.layout),
            showThumbnail: checked('#rrShowThumbnail', this.defaults.showThumbnail),
            showFileName: checked('#rrShowFileName', this.defaults.showFileName),
            showDescription: checked('#rrShowDescription', this.defaults.showDescription),
            showAuthor: checked('#rrShowAuthor', this.defaults.showAuthor),
            showLicense: checked('#rrShowLicense', this.defaults.showLicense),
            showViewLink: checked('#rrShowViewLink', this.defaults.showViewLink),
            showDownloadLink: checked('#rrShowDownloadLink', this.defaults.showDownloadLink),
        };
    },

    /**
     * eXe idevice engine api: serialize editor state.
     * Returns a data object with the config plus a snapshot of the resolved resources.
     * @returns {Object}
     */
    save: function () {
        if (!this.ideviceBody) return false;
        const config = this.getConfigFromForm();
        const am = this.getAssetManager();
        const allMeta = am && am.getAllAssetsMetadata ? am.getAllAssetsMetadata() : [];
        const referencedIds =
            config.resourceMode === 'used' && am && am.getReferencedAssetIds ? am.getReferencedAssetIds() : null;
        const urlFor = (a) => (am && am.getAssetUrl ? am.getAssetUrl(a.id, a.filename) : `asset://${a.id}`);
        const resources = this.buildResources(allMeta, config, referencedIds, urlFor);

        return {
            ideviceId: this.ideviceBody.getAttribute('idevice-id') || '',
            ...config,
            resources,
        };
    },

    /**
     * Render the configuration form.
     */
    createForm: function () {
        const d = this.defaults;
        const opt = (value, label, selected) =>
            `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`;
        const toggle = (id, label, on) =>
            `<div class="toggle-item resource-report-toggle">
                <span class="toggle-control">
                    <input type="checkbox" id="${id}" class="toggle-input"${on ? ' checked' : ''}>
                    <span class="toggle-visual" aria-hidden="true"></span>
                </span>
                <label class="toggle-label" for="${id}">${label}</label>
            </div>`;

        this.ideviceBody.innerHTML = `
        <div id="resourceReportForm" class="resource-report-form">
            <div class="exe-field exe-text-field">
                <label for="rrIntro">${_('Introductory text')}:</label>
                <textarea id="rrIntro" class="ideviceTextfield" rows="2"></textarea>
            </div>
            <div class="resource-report-selects">
                <div class="exe-field exe-text-field">
                    <label for="rrResourceMode">${_('Resources')}:</label>
                    <select id="rrResourceMode" class="ideviceTextfield">
                        ${opt('all', _('All resources'), d.resourceMode)}
                        ${opt('used', _('Used in this project'), d.resourceMode)}
                    </select>
                </div>
                <div class="exe-field exe-text-field">
                    <label for="rrTypeFilter">${_('File type')}:</label>
                    <select id="rrTypeFilter" class="ideviceTextfield">
                        ${opt('all', _('All'), d.typeFilter)}
                        ${opt('image', _('Images'), d.typeFilter)}
                        ${opt('audio', _('Audio'), d.typeFilter)}
                        ${opt('video', _('Video'), d.typeFilter)}
                        ${opt('document', _('Documents'), d.typeFilter)}
                        ${opt('other', _('Other'), d.typeFilter)}
                    </select>
                </div>
                <div class="exe-field exe-text-field">
                    <label for="rrLayout">${_('Layout')}:</label>
                    <select id="rrLayout" class="ideviceTextfield">
                        ${opt('list', _('List'), d.layout)}
                        ${opt('cards', _('Cards'), d.layout)}
                    </select>
                </div>
            </div>
            <fieldset class="exe-fieldset resource-report-toggles">
                <legend><a href="#">${_('Display options')}</a></legend>
                <div class="resource-report-toggle-grid">
                    ${toggle('rrShowThumbnail', _('Show thumbnail'), d.showThumbnail)}
                    ${toggle('rrShowFileName', _('Show file name'), d.showFileName)}
                    ${toggle('rrShowDescription', _('Show description'), d.showDescription)}
                    ${toggle('rrShowAuthor', _('Show author'), d.showAuthor)}
                    ${toggle('rrShowLicense', _('Show license'), d.showLicense)}
                    ${toggle('rrShowViewLink', _('Show view link'), d.showViewLink)}
                    ${toggle('rrShowDownloadLink', _('Show download link'), d.showDownloadLink)}
                </div>
            </fieldset>
        </div>`;
    },

    /**
     * Restore the form from previously saved data (config only; resources are
     * always re-snapshotted from the current project assets on save).
     */
    loadPreviousValues: function () {
        const data = this.idevicePreviousData;
        if (!data || typeof data !== 'object') return;
        const body = this.ideviceBody;
        const setVal = (sel, value) => {
            const el = body.querySelector(sel);
            if (el != null && value != null) el.value = value;
        };
        const setChecked = (sel, value) => {
            const el = body.querySelector(sel);
            if (el != null && typeof value === 'boolean') el.checked = value;
        };
        if (typeof data.intro === 'string') setVal('#rrIntro', data.intro);
        setVal('#rrResourceMode', data.resourceMode);
        setVal('#rrTypeFilter', data.typeFilter);
        setVal('#rrLayout', data.layout);
        setChecked('#rrShowThumbnail', data.showThumbnail);
        setChecked('#rrShowFileName', data.showFileName);
        setChecked('#rrShowDescription', data.showDescription);
        setChecked('#rrShowAuthor', data.showAuthor);
        setChecked('#rrShowLicense', data.showLicense);
        setChecked('#rrShowViewLink', data.showViewLink);
        setChecked('#rrShowDownloadLink', data.showDownloadLink);
    },
};
