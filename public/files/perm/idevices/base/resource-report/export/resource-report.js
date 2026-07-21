/* eslint-disable no-undef */
/**
 * Resource Report iDevice — export/render.
 *
 * Renders the resource list into accessible HTML. In the workarea (preview) and the
 * browser-side export the list is resolved LIVE from the AssetManager, so the report is
 * always up to date and refreshes when assets change (see renderBehaviour, which mirrors
 * the download-source-file iDevice). The saved `resources` snapshot is the fallback for
 * static/server exports where no AssetManager is available. Asset references are emitted
 * as asset:// URLs which the preview resolver and the export pipeline rewrite to working
 * links / packaged paths.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 */
var $resourcereport = {
    /**
     * Translation helper — uses the global _() when available (build-time language),
     * falls back to identity so the module is testable in isolation.
     */
    t: function (s) {
        return typeof _ === 'function' ? _(s) : s;
    },

    escapeHtml: function (str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Inline SVG icon for a non-image resource type (self-contained so it renders in
     * exported packages without depending on the workarea-only icon font).
     */
    iconFor: function (type) {
        const paths = {
            audio: '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/>',
            video: '<path d="M4 4h16v16H4z" fill="none"/><path d="M10 8l6 4-6 4z"/><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>',
            document:
                '<path d="M6 2h8l4 4v16H6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" stroke-width="2" fill="none"/>',
            other: '<path d="M6 2h8l4 4v16H6z" fill="none" stroke="currentColor" stroke-width="2"/>',
        };
        const inner = paths[type] || paths.other;
        return `<svg class="resource-report-icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">${inner}</svg>`;
    },

    /**
     * Resolve a stored license label (the centralized vocabulary from
     * public/app/common/licenseOptions.js, e.g. "Creative Commons BY-SA") to its
     * canonical URL + CSS class. Values mirror the single source of truth
     * LICENSE_REGISTRY in src/shared/export/constants.ts; kept inline because iDevice
     * export code runs standalone in exported packages (no app/backend access), the
     * same approach as the download-source-file iDevice. The CC BY-xx codes are not
     * translated, so they match by substring; CC0 is stored as "Creative Commons (…)".
     * The cssClass follows the shared `cc cc-<code>` convention used by the page
     * footer and the download-source-file iDevice so themes render the matching icon.
     * @param {string|undefined} license
     * @returns {{ url: string, cssClass: string, isCC: boolean }}
     */
    licenseMeta: function (license) {
        const label = String(license == null ? '' : license).trim();
        if (!label) return { url: '', cssClass: '', isCC: false };
        // CC0 (Public Domain Dedication) — the inner "(…)" text is translated.
        if (/^creative commons\s*\(/i.test(label)) {
            return { url: 'https://creativecommons.org/publicdomain/zero/1.0/', cssClass: 'cc cc-0', isCC: true };
        }
        // CC 4.0 BY / BY-SA / BY-ND / BY-NC / BY-NC-SA / BY-NC-ND.
        const cc = label.match(/^creative commons\s+by([a-z-]*)/i);
        if (cc) {
            const variant = cc[1].toLowerCase(); // '', '-sa', '-nd', '-nc', '-nc-sa', '-nc-nd'
            return {
                url: `https://creativecommons.org/licenses/by${variant}/4.0/`,
                cssClass: `cc cc-by${variant}`,
                isCC: true,
            };
        }
        if (/^gnu\/gpl$/i.test(label)) {
            return { url: 'https://www.gnu.org/licenses/gpl.html', cssClass: '', isCC: false };
        }
        // Public Domain / Copyright / custom free-text: no canonical link, no CC icon.
        return { url: '', cssClass: '', isCC: false };
    },

    /**
     * License markup, reusing the shared `exe-prop-license` convention from the page
     * footer and the download-source-file iDevice: a `rel="license"` link with the
     * `cc cc-<code>` classes (the empty inner <span> is the themed icon placeholder)
     * when the license has a canonical URL, otherwise plain text.
     */
    licenseHtml: function (license) {
        const esc = this.escapeHtml.bind(this);
        const meta = this.licenseMeta(license);
        if (!meta.url) {
            return `<span class="exe-prop-license">${esc(license)}</span>`;
        }
        const classAttr = meta.cssClass ? ` class="${meta.cssClass}"` : '';
        const iconSpan = meta.isCC ? '<span></span>' : '';
        return `<span class="exe-prop-license"><a href="${esc(meta.url)}" rel="license"${classAttr}>${iconSpan}${esc(license)}</a></span>`;
    },

    /**
     * Thumbnail markup (image or file-type icon), wrapped — empty when thumbnails off.
     */
    thumbHtml: function (res, config) {
        if (!config.showThumbnail) return '';
        const esc = this.escapeHtml.bind(this);
        const altText = res.description || res.title || '';
        let inner;
        if (res.isImage && res.assetUrl) {
            inner = `<img class="resource-report-img" src="${esc(res.assetUrl)}" alt="${esc(altText)}" loading="lazy" />`;
        } else {
            inner = this.iconFor(res.type);
        }
        return `<div class="resource-report-thumb">${inner}</div>`;
    },

    /**
     * View/Download actions markup. Links are opt-in (default on for older snapshots).
     */
    actionsHtml: function (res, config) {
        const esc = this.escapeHtml.bind(this);
        const showView = config.showViewLink !== false;
        const showDownload = config.showDownloadLink !== false;
        if (!res.assetUrl || (!showView && !showDownload)) return '';
        const forName = esc(res.title || res.filename || this.t('Missing resource'));
        let actions = '';
        if (showView) {
            const viewLabel = this.t('View');
            actions += `<a class="resource-report-view" href="${esc(res.assetUrl)}" target="_blank" rel="noopener" aria-label="${viewLabel}: ${forName}">${viewLabel}</a>`;
        }
        if (showDownload) {
            const dlLabel = this.t('Download');
            actions += `<a class="resource-report-download" href="${esc(res.assetUrl)}" download="${esc(res.filename)}" aria-label="${dlLabel}: ${forName}">${dlLabel}</a>`;
        }
        return `<div class="resource-report-actions">${actions}</div>`;
    },

    /**
     * Render a single resource item (<li>) for the list/cards layouts.
     */
    renderItem: function (res, config) {
        const esc = this.escapeHtml.bind(this);
        const title = res.title || res.filename || this.t('Missing resource');
        const thumb = this.thumbHtml(res, config);

        let body = `<span class="resource-report-item-title">${esc(title)}</span>`;
        if (config.showFileName && res.filename) {
            body += `<span class="resource-report-filename">${esc(res.filename)}</span>`;
        }
        if (config.showDescription && res.description) {
            body += `<p class="resource-report-desc">${esc(res.description)}</p>`;
        }
        const metaParts = [];
        if (config.showAuthor && res.author) {
            metaParts.push(`<span class="resource-report-author">${esc(res.author)}</span>`);
        }
        if (config.showLicense && res.license) {
            metaParts.push(this.licenseHtml(res.license));
        }
        if (metaParts.length) {
            body += `<div class="resource-report-meta">${metaParts.join('<span class="resource-report-sep"> · </span>')}</div>`;
        }
        body += this.actionsHtml(res, config);

        return `<li class="resource-report-item">${thumb}<div class="resource-report-body">${body}</div></li>`;
    },

    /**
     * Columns shown in the table layout, honoring the show* toggles.
     */
    tableColumns: function (config) {
        // Labels use literal-string this.t('…') calls so the i18n key extractor can see
        // them (it cannot follow this.t(variable)); the resolved label is stored ready to
        // render.
        const cols = [{ key: 'resource', label: this.t('Resource') }];
        if (config.showThumbnail) cols.unshift({ key: 'thumb', label: this.t('Preview') });
        if (config.showDescription) cols.push({ key: 'description', label: this.t('Description') });
        if (config.showAuthor) cols.push({ key: 'author', label: this.t('Author') });
        if (config.showLicense) cols.push({ key: 'license', label: this.t('License') });
        if (config.showViewLink !== false || config.showDownloadLink !== false) {
            cols.push({ key: 'links', label: this.t('Links') });
        }
        return cols;
    },

    /**
     * Render a single table cell for a given column key.
     */
    renderCell: function (key, res, config) {
        const esc = this.escapeHtml.bind(this);
        switch (key) {
            case 'thumb':
                return this.thumbHtml(res, config);
            case 'resource': {
                const title = res.title || res.filename || this.t('Missing resource');
                let out = `<span class="resource-report-item-title">${esc(title)}</span>`;
                if (config.showFileName && res.filename) {
                    out += `<span class="resource-report-filename">${esc(res.filename)}</span>`;
                }
                return out;
            }
            case 'description':
                return res.description ? `<p class="resource-report-desc">${esc(res.description)}</p>` : '';
            case 'author':
                return res.author ? `<span class="resource-report-author">${esc(res.author)}</span>` : '';
            case 'license':
                return res.license ? this.licenseHtml(res.license) : '';
            case 'links':
                return this.actionsHtml(res, config);
            default:
                return '';
        }
    },

    /**
     * Render the table/condensed layout.
     */
    buildTable: function (resources, config) {
        const cols = this.tableColumns(config);
        let head = '';
        // c.label is already translated (see tableColumns); just escape for output.
        for (const c of cols) head += `<th scope="col">${this.escapeHtml(c.label)}</th>`;
        let rows = '';
        for (const res of resources) {
            let cells = '';
            for (const c of cols) cells += `<td>${this.renderCell(c.key, res, config)}</td>`;
            rows += `<tr class="resource-report-row">${cells}</tr>`;
        }
        return `<table class="resource-report-table resource-report-layout-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    },

    /**
     * Resolve the project AssetManager when running in the workarea / browser-side export
     * (single source of truth for assets/metadata). Returns null in static/server exports
     * where no Yjs app is present, so callers fall back to the saved snapshot.
     * @returns {Object|null}
     */
    getAssetManager: function () {
        return (
            (typeof window !== 'undefined' &&
                window.eXeLearning &&
                window.eXeLearning.app &&
                window.eXeLearning.app.project &&
                window.eXeLearning.app.project._yjsBridge &&
                window.eXeLearning.app.project._yjsBridge.assetManager) ||
            null
        );
    },

    /**
     * Categorize an asset by MIME type / extension into a coarse resource type.
     * Kept identical to the helper in edition/resource-report.js (the edition/export
     * split cannot share a module), so the live list matches the saved snapshot.
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
     * Build the resource list for the current configuration. Pure; identical to the
     * edition helper so the live (export) list matches the snapshot (edition save).
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
     * Resolve the CURRENT resource list from the live AssetManager, or null when none is
     * available (caller falls back to the saved snapshot).
     * @returns {Array<Object>|null}
     */
    resolveLiveResources: function (config) {
        const am = this.getAssetManager();
        if (!am || typeof am.getAllAssetsMetadata !== 'function') return null;
        const allMeta = am.getAllAssetsMetadata();
        const referencedIds =
            config.resourceMode === 'used' && typeof am.getReferencedAssetIds === 'function'
                ? am.getReferencedAssetIds()
                : null;
        const urlFor = (a) =>
            typeof am.getAssetUrl === 'function' ? am.getAssetUrl(a.id, a.filename) : `asset://${a.id}`;
        return this.buildResources(allMeta, config, referencedIds, urlFor);
    },

    /**
     * Build the report HTML. Uses the live AssetManager list when available (workarea /
     * browser export), otherwise the saved snapshot. Stamps `data-idevice-id` so a single
     * instance can be refreshed in place by renderBehaviour.
     */
    buildHtml: function (data, ideviceId) {
        const esc = this.escapeHtml.bind(this);
        const config = data || {};
        const live = this.resolveLiveResources(config);
        const resources = live || (Array.isArray(config.resources) ? config.resources : []);
        const layout = config.layout === 'cards' ? 'cards' : config.layout === 'table' ? 'table' : 'list';
        const id = ideviceId || config.ideviceId || '';

        let html = `<div class="resource-report-IDevice"${id ? ` data-idevice-id="${esc(id)}"` : ''}>`;
        if (config.intro) {
            html += `<p class="resource-report-intro">${esc(config.intro)}</p>`;
        }
        if (resources.length === 0) {
            html += `<p class="resource-report-empty">${this.t('No resources available')}</p>`;
        } else if (layout === 'table') {
            html += this.buildTable(resources, config);
        } else {
            html += `<ul class="resource-report-list resource-report-layout-${layout}">`;
            for (const res of resources) {
                html += this.renderItem(res, config);
            }
            html += '</ul>';
        }
        html += '</div>';
        return html;
    },

    /**
     * eXe idevice engine api: render view. Honors a {content} template when provided.
     */
    renderView: function (data, accessibility, template, ideviceId) {
        const html = this.buildHtml(data, ideviceId);
        if (typeof template === 'string' && template.indexOf('{content}') !== -1) {
            return template.replace('{content}', html);
        }
        return html;
    },

    /**
     * iDevice ids that already have a live-refresh observer attached, so re-renders of
     * the node don't stack duplicate observers.
     */
    _observed: {},

    /**
     * eXe idevice engine api: in the workarea, keep the report up to date by observing the
     * assets Y.Map and re-rendering this instance whenever assets are added/removed or
     * their metadata changes — the same live approach the download-source-file iDevice
     * uses for project metadata. No-op in static/server exports (no AssetManager).
     *
     * Note: the "used in this project" filter also depends on content references stored in
     * the structure map (not the assets map), so it refreshes on asset changes but not on
     * unrelated text edits elsewhere; reopening/saving still reconciles it.
     */
    renderBehaviour: function (data, accessibility, ideviceId) {
        const am = this.getAssetManager();
        if (!am || typeof am.getAssetsYMap !== 'function') return;
        const id = ideviceId || (data && data.ideviceId) || '';
        if (!id || this._observed[id]) return;
        // Mark synchronously so concurrent node re-renders don't stack observers.
        this._observed[id] = true;
        const self = this;
        // Defer so the rendered DOM and the Yjs document are ready (mirrors source-file).
        setTimeout(function () {
            let assetsMap;
            try {
                assetsMap = am.getAssetsYMap();
            } catch (e) {
                assetsMap = null;
            }
            if (!assetsMap || typeof assetsMap.observe !== 'function') {
                self._observed[id] = false; // allow a later retry if the map wasn't ready
                return;
            }
            let pending = null;
            assetsMap.observe(function () {
                // Coalesce bursts (e.g. a bulk upload) into a single re-render.
                if (pending) return;
                pending = setTimeout(function () {
                    pending = null;
                    const root = document.querySelector(
                        '.resource-report-IDevice[data-idevice-id="' + id + '"]'
                    );
                    if (root) root.outerHTML = self.buildHtml(data, id);
                }, 150);
            });
        }, 0);
    },

    /**
     * eXe idevice engine api: no runtime initialization needed.
     */
    init: function () {},
};
