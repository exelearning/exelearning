/* eslint-disable no-undef */
/**
 * File attachment iDevice (export code)
 *
 * Renders a list of downloadable files attached to a page. Files are backed by
 * the Media Library / AssetManager and referenced with `asset://` URLs, which the
 * export pipeline rewrites to packaged `content/resources/...` paths. In the
 * editor/preview the same `asset://` URLs are resolved to live blob URLs.
 *
 * Released under the GNU AGPL-3.0 License.
 */
var $fileattachment = {
    /**
     * eXe idevice engine — JSON idevice api function. Execution order: 1.
     * Builds the static HTML for the download area and injects it into the template.
     *
     * @param {Object} data - jsonProperties for this iDevice
     * @param {Number} accesibility
     * @param {String} template - template file content containing the {content} marker
     * @returns {String}
     */
    renderView: function (data, accesibility, template) {
        const htmlContent = $fileattachment.getStringAttachments(data);
        return template.replace('{content}', htmlContent);
    },

    /**
     * JSON idevice api function. Execution order: 2.
     * Resolves `asset://` download links to live blob URLs when running inside the
     * editor/preview (where the static export rewrite has not happened). In a real
     * export the links already point at `content/resources/...`, so this is a no-op.
     *
     * @param {Object} data
     */
    renderBehaviour: function (data) {
        if (!data || !data.ideviceId) return;
        const node = document.getElementById(data.ideviceId);
        if (!node) return;

        const assetManager = $fileattachment.getAssetManager();
        if (!assetManager) return;

        const links = node.querySelectorAll('a.fileAttachment-link[href^="asset://"]');
        links.forEach((link) => {
            const assetUrl = link.getAttribute('href');
            $fileattachment.resolveAssetHref(assetManager, link, assetUrl);
        });
    },

    /**
     * JSON idevice api function. Execution order: 3.
     */
    init: function () {},

    /**
     * Export-safe string lookup.
     *
     * The editor-only `c_()` / `_()` helpers do not exist in an exported site:
     * exports ship `libs/common_i18n.js`, which defines the already-resolved
     * `$exe_i18n` bundle. Calling `c_()` from here threw
     * `ReferenceError: c_ is not defined`, which aborted `renderView()` and left
     * the iDevice unrendered. The English literal is used when the bundle (or the
     * key) is unavailable, so the export never fails on a missing string.
     *
     * @param {String} key - key in the `$exe_i18n` bundle
     * @param {String} fallback - English source string
     * @returns {String}
     */
    translate: function (key, fallback) {
        try {
            const scope = typeof window !== 'undefined' ? window : globalThis;
            const bundle = scope && scope.$exe_i18n;
            const value = bundle && bundle[key];
            if (typeof value === 'string' && value.trim()) return value;
        } catch (e) {
            // Fall through to the English literal.
        }
        return fallback;
    },

    /**
     * Locate the live AssetManager, reaching into parent/top frames because export
     * JS runs inside the preview iframe.
     *
     * @returns {Object|null}
     */
    getAssetManager: function () {
        const windows = [];
        try {
            if (typeof window !== 'undefined') windows.push(window);
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) windows.push(window.parent);
            if (typeof window !== 'undefined' && window.top && window.top !== window) windows.push(window.top);
        } catch (e) {
            // Cross-origin frame access can throw; ignore and use what we have.
        }
        for (const w of windows) {
            const manager = w && w.eXeLearning && w.eXeLearning.app && w.eXeLearning.app.project && w.eXeLearning.app.project._yjsBridge && w.eXeLearning.app.project._yjsBridge.assetManager;
            if (manager) return manager;
        }
        return null;
    },

    /**
     * Resolve a single `asset://` link to a blob URL (sync cache first, then async).
     *
     * @param {Object} assetManager
     * @param {HTMLAnchorElement} link
     * @param {String} assetUrl
     */
    resolveAssetHref: function (assetManager, link, assetUrl) {
        try {
            if (typeof assetManager.resolveAssetURLSync === 'function') {
                const sync = assetManager.resolveAssetURLSync(assetUrl);
                if (sync) {
                    link.setAttribute('href', sync);
                    return;
                }
            }
            if (typeof assetManager.resolveAssetURL === 'function') {
                const promise = assetManager.resolveAssetURL(assetUrl);
                if (promise && typeof promise.then === 'function') {
                    promise.then((resolved) => {
                        if (resolved) link.setAttribute('href', resolved);
                    }).catch(() => {});
                }
            }
        } catch (e) {
            // Leave the original href in place if resolution fails.
        }
    },

    /**
     * Build the full download-area HTML from the iDevice data.
     *
     * @param {Object} data
     * @returns {String}
     */
    getStringAttachments: function (data) {
        data = data || {};
        const attachments = $fileattachment.getAttachments(data);
        const parts = ['<div class="fileAttachment-IDevice">'];

        // Instructions are shown whenever they contain text (no separate toggle).
        if (data.intro && String(data.intro).trim()) {
            parts.push(`<div class="fileAttachment-intro">${data.intro}</div>`);
        }

        if (attachments.length === 0) {
            parts.push(
                `<p class="fileAttachment-empty">${$fileattachment.translate('noFilesAttached', 'No files attached.')}</p>`,
            );
        } else {
            const showDescriptions = data.showDescriptions !== false;
            parts.push('<ul class="fileAttachment-list">');
            attachments.forEach((attachment) => {
                parts.push($fileattachment.renderItem(attachment, showDescriptions));
            });
            parts.push('</ul>');
        }

        parts.push('</div>');
        return parts.join('');
    },

    /**
     * Normalize the attachments array out of the iDevice data.
     *
     * @param {Object} data
     * @returns {Array}
     */
    getAttachments: function (data) {
        if (!data || !Array.isArray(data.attachments)) return [];
        return data.attachments.filter((attachment) => attachment && typeof attachment === 'object');
    },

    /**
     * Render a single attachment list item.
     *
     * @param {Object} attachment
     * @param {Boolean} showDescriptions
     * @returns {String}
     */
    renderItem: function (attachment, showDescriptions) {
        const filename = attachment.filename || '';
        const url = attachment.url || '';
        const label =
            (attachment.title && String(attachment.title).trim()) ||
            filename ||
            $fileattachment.translate('attachment', 'Attachment');
        const category = $fileattachment.getFileCategory(attachment.mimeType, filename);
        const icon = $fileattachment.getFileIconSvg(attachment.mimeType, filename);
        const size = $fileattachment.formatFileSize(attachment.size);

        const meta = [];
        if (filename && filename !== label) meta.push($fileattachment.escapeHtml(filename));
        if (size) meta.push($fileattachment.escapeHtml(size));
        const metaHtml = meta.length
            ? `<span class="fileAttachment-meta">${meta.join(' · ')}</span>`
            : '';

        const descriptionHtml =
            showDescriptions && attachment.description && String(attachment.description).trim()
                ? `<p class="fileAttachment-description">${$fileattachment.escapeHtml(attachment.description)}</p>`
                : '';

        let body;
        if (url) {
            // Accessible link text: "Download <label>" announced via the visually hidden span.
            body = `<a class="fileAttachment-link" href="${$fileattachment.escapeAttr(url)}" download="${$fileattachment.escapeAttr(filename || label)}">
                <span class="fileAttachment-icon fileAttachment-icon--${category}" aria-hidden="true">${icon}</span>
                <span class="fileAttachment-text">
                    <span class="exe-sr-only">${$fileattachment.translate('download', 'Download')} </span><span class="fileAttachment-title">${$fileattachment.escapeHtml(label)}</span>
                    ${metaHtml}
                </span>
            </a>`;
        } else {
            // Missing asset: render a safe, non-clickable placeholder instead of a broken link.
            body = `<span class="fileAttachment-link fileAttachment-link--missing">
                <span class="fileAttachment-icon fileAttachment-icon--${category}" aria-hidden="true">${icon}</span>
                <span class="fileAttachment-text">
                    <span class="fileAttachment-title">${$fileattachment.escapeHtml(label)}</span>
                    <span class="fileAttachment-meta fileAttachment-meta--missing">${$fileattachment.translate('fileUnavailable', 'File unavailable')}</span>
                </span>
            </span>`;
        }

        return `<li class="fileAttachment-item fileAttachment-item--${category}">${body}${descriptionHtml}</li>`;
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
        const ext = $fileattachment.getExtension(filename);

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
     * Build a self-contained inline SVG document icon, labelled with the file
     * extension. No icon-font dependency, so it renders in every export target.
     *
     * @param {String} mimeType
     * @param {String} filename
     * @returns {String}
     */
    getFileIconSvg: function (mimeType, filename) {
        const ext = $fileattachment.getExtension(filename);
        const rawLabel = (ext || $fileattachment.getFileCategory(mimeType, filename) || 'file').toUpperCase();
        // Only keep alphanumerics and cap the length so the label fits the glyph.
        const label = $fileattachment.escapeHtml(rawLabel.replace(/[^A-Z0-9]/g, '').slice(0, 4));
        return `<svg class="fileAttachment-glyph" viewBox="0 0 40 48" width="40" height="48" focusable="false" aria-hidden="true"><path class="fileAttachment-glyph-page" d="M4 2h22l10 10v34a0 0 0 0 1 0 0H4a0 0 0 0 1 0 0V2z"/><path class="fileAttachment-glyph-fold" d="M26 2l10 10H26z"/><text class="fileAttachment-glyph-label" x="20" y="34" text-anchor="middle">${label}</text></svg>`;
    },

    /**
     * Human-readable file size. Returns '' when size is missing/invalid.
     *
     * @param {Number} bytes
     * @returns {String}
     */
    formatFileSize: function (bytes) {
        const value = Number(bytes);
        if (!isFinite(value) || value <= 0) return '';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = value;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        const rounded = unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
        return `${rounded} ${units[unit]}`;
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
        return $fileattachment.escapeHtml(str);
    },
};
