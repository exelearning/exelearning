/* eslint-disable no-undef */
/**
 * Resource Report iDevice — export/render.
 *
 * Renders the saved snapshot (config + resources) into accessible HTML. Runs at
 * export-build time and in preview; it performs no live asset queries. Asset
 * references are emitted as asset:// URLs which the preview resolver and the export
 * pipeline rewrite to working links / packaged paths.
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
     * Self-contained Creative Commons mark (decorative). Inlined like iconFor() so the
     * report renders icons in exported packages without depending on theme assets.
     */
    ccIcon: function () {
        return (
            '<svg class="resource-report-license-icon" viewBox="0 0 64 64" width="16" height="16" aria-hidden="true" focusable="false">' +
            '<circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="4"/>' +
            '<path fill="currentColor" d="M22 27.5c-1.2-1.5-3-2.3-5-2.3-3.7 0-6.5 2.8-6.5 6.8s2.8 6.8 6.5 6.8c2 0 3.8-.9 5-2.4l3 2.3c-1.9 2.3-4.7 3.7-8 3.7-5.9 0-10.3-4.4-10.3-10.4s4.4-10.4 10.3-10.4c3.3 0 6.1 1.4 8 3.8z"/>' +
            '<path fill="currentColor" d="M44 27.5c-1.2-1.5-3-2.3-5-2.3-3.7 0-6.5 2.8-6.5 6.8s2.8 6.8 6.5 6.8c2 0 3.8-.9 5-2.4l3 2.3c-1.9 2.3-4.7 3.7-8 3.7-5.9 0-10.3-4.4-10.3-10.4s4.4-10.4 10.3-10.4c3.3 0 6.1 1.4 8 3.8z"/>' +
            '</svg>'
        );
    },

    /**
     * Resolve a stored license label (the centralized vocabulary from
     * public/app/common/licenseOptions.js, e.g. "Creative Commons BY-SA") to its
     * canonical URL + CSS class. Values mirror the single source of truth
     * LICENSE_REGISTRY in src/shared/export/constants.ts; kept inline because iDevice
     * export code runs standalone in exported packages (no app/backend access), the
     * same approach as image-gallery's getLinkLicense(). The CC BY-xx codes are not
     * translated, so they match by substring; CC0 is stored as "Creative Commons (…)".
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
                cssClass: variant ? `cc cc-by${variant}` : 'cc',
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
     * License markup: a link when the license has a canonical URL, otherwise a span.
     * Prepends the CC mark for Creative Commons licenses.
     */
    licenseHtml: function (license) {
        const esc = this.escapeHtml.bind(this);
        const meta = this.licenseMeta(license);
        const icon = meta.isCC ? this.ccIcon() : '';
        const cls = 'resource-report-license' + (meta.cssClass ? ' ' + meta.cssClass : '');
        if (meta.url) {
            return `<a class="${cls}" href="${esc(meta.url)}" target="_blank" rel="license noopener">${icon}${esc(license)}</a>`;
        }
        return `<span class="${cls}">${icon}${esc(license)}</span>`;
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
        const cols = [{ key: 'resource', label: 'Resource' }];
        if (config.showThumbnail) cols.unshift({ key: 'thumb', label: 'Preview' });
        if (config.showDescription) cols.push({ key: 'description', label: 'Description' });
        if (config.showAuthor) cols.push({ key: 'author', label: 'Author' });
        if (config.showLicense) cols.push({ key: 'license', label: 'License' });
        if (config.showViewLink !== false || config.showDownloadLink !== false) {
            cols.push({ key: 'links', label: 'Links' });
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
        for (const c of cols) head += `<th scope="col">${this.escapeHtml(this.t(c.label))}</th>`;
        let rows = '';
        for (const res of resources) {
            let cells = '';
            for (const c of cols) cells += `<td>${this.renderCell(c.key, res, config)}</td>`;
            rows += `<tr class="resource-report-row">${cells}</tr>`;
        }
        return `<table class="resource-report-table resource-report-layout-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    },

    /**
     * Build the report HTML from saved data. Pure (no DOM access) — used by the
     * engine for the node/preview/export view.
     */
    buildHtml: function (data) {
        const esc = this.escapeHtml.bind(this);
        const config = data || {};
        const resources = Array.isArray(config.resources) ? config.resources : [];
        const layout = config.layout === 'cards' ? 'cards' : config.layout === 'table' ? 'table' : 'list';

        let html = '<div class="resource-report-IDevice">';
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
    renderView: function (data, accessibility, template) {
        const html = this.buildHtml(data);
        if (typeof template === 'string' && template.indexOf('{content}') !== -1) {
            return template.replace('{content}', html);
        }
        return html;
    },

    /**
     * eXe idevice engine api: no interactive behaviour to attach (static report).
     */
    renderBehaviour: function () {},

    /**
     * eXe idevice engine api: no runtime initialization needed.
     */
    init: function () {},
};
