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
     * Render a single resource item (<li>).
     */
    renderItem: function (res, config) {
        const esc = this.escapeHtml.bind(this);
        const title = res.title || res.filename || this.t('Missing resource');
        const altText = res.description || res.title || '';

        let thumb = '';
        if (config.showThumbnail) {
            if (res.isImage && res.assetUrl) {
                thumb = `<img class="resource-report-img" src="${esc(res.assetUrl)}" alt="${esc(altText)}" loading="lazy" />`;
            } else {
                thumb = this.iconFor(res.type);
            }
            thumb = `<div class="resource-report-thumb">${thumb}</div>`;
        }

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
            metaParts.push(`<span class="resource-report-license">${esc(res.license)}</span>`);
        }
        if (metaParts.length) {
            body += `<div class="resource-report-meta">${metaParts.join('<span class="resource-report-sep"> · </span>')}</div>`;
        }
        // View/Download links are opt-in (default on for back-compat with older snapshots).
        const showView = config.showViewLink !== false;
        const showDownload = config.showDownloadLink !== false;
        if (res.assetUrl && (showView || showDownload)) {
            const forName = esc(title);
            let actions = '';
            if (showView) {
                const viewLabel = this.t('View');
                actions += `<a class="resource-report-view" href="${esc(res.assetUrl)}" target="_blank" rel="noopener" aria-label="${viewLabel}: ${forName}">${viewLabel}</a>`;
            }
            if (showDownload) {
                const dlLabel = this.t('Download');
                actions += `<a class="resource-report-download" href="${esc(res.assetUrl)}" download="${esc(res.filename)}" aria-label="${dlLabel}: ${forName}">${dlLabel}</a>`;
            }
            body += `<div class="resource-report-actions">${actions}</div>`;
        }

        return `<li class="resource-report-item">${thumb}<div class="resource-report-body">${body}</div></li>`;
    },

    /**
     * Build the report HTML from saved data. Pure (no DOM access) — used by the
     * engine for the node/preview/export view.
     */
    buildHtml: function (data) {
        const esc = this.escapeHtml.bind(this);
        const config = data || {};
        const resources = Array.isArray(config.resources) ? config.resources : [];
        const layout = config.layout === 'cards' ? 'cards' : 'list';

        let html = '<div class="resource-report-IDevice">';
        if (config.intro) {
            html += `<p class="resource-report-intro">${esc(config.intro)}</p>`;
        }
        if (resources.length === 0) {
            html += `<p class="resource-report-empty">${this.t('No resources available')}</p>`;
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
