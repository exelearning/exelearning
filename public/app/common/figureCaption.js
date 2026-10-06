/**
 * Browser/authoring twin of src/shared/export/figure-caption.ts.
 *
 * Builds the image caption (figure/figcaption) auto-derived from the centralized File
 * Manager asset metadata (image name/`title`, `author`, `authorUrl`, `sourceUrl`,
 * `license`) plus the per-instance presentation chosen in the TinyMCE image dialog
 * (`heading`, `notes`, `hidden`).
 *
 * Used by the TinyMCE exeimage plugin (via a window global) and the live caption
 * resolver — neither can import the TypeScript exporter module. Keep this in lockstep
 * with figure-caption.ts (same convention as sanitizer.ts ↔ slide/slide.js): the markup
 * and license resolution MUST stay byte-for-byte identical so the caption a user sees
 * while authoring matches the one baked into exported packages.
 */

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Return a safe href for caption links, or '' when the URL must not be linked.
 * Only http:, https: and relative URLs (including scheme-relative //host) are
 * allowed; any other scheme (javascript:, data:, vbscript:, file:, …) is refused
 * and the caller renders the text without an anchor. Control characters and
 * whitespace are stripped before scheme matching because browsers ignore them
 * when parsing URLs (the classic "jav\tascript:" smuggling bypass).
 */
function safeCaptionUrl(value) {
    const url = String(value == null ? '' : value).trim();
    if (!url) return '';
    // Strip control characters and whitespace (code points <= 0x20) the way
    // browsers do while parsing, so the scheme cannot be smuggled past the check.
    let normalized = '';
    for (const ch of url) {
        if (ch.charCodeAt(0) > 0x20) normalized += ch;
    }
    const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!scheme) return url; // relative URL (/path, //host, ?query, #anchor)
    const name = scheme[1].toLowerCase();
    return name === 'http' || name === 'https' ? url : '';
}

/**
 * Resolve a stored license label (centralized vocabulary from licenseOptions.js) to its
 * canonical URL + `cc cc-<code>` icon class. Mirrors resolveCaptionLicense() in
 * figure-caption.ts and the resource-report iDevice's licenseMeta().
 * @param {string|undefined|null} license
 * @returns {{ url: string, cssClass: string, isCC: boolean }}
 */
export function resolveCaptionLicense(license) {
    const label = String(license == null ? '' : license).trim();
    if (!label) return { url: '', cssClass: '', isCC: false };
    if (/^creative commons\s*\(/i.test(label)) {
        return { url: 'https://creativecommons.org/publicdomain/zero/1.0/', cssClass: 'cc cc-0', isCC: true };
    }
    const cc = label.match(/^creative commons\s+by([a-z-]*)/i);
    if (cc) {
        const variant = cc[1].toLowerCase();
        return {
            url: `https://creativecommons.org/licenses/by${variant}/4.0/`,
            cssClass: `cc cc-by${variant}`,
            isCC: true,
        };
    }
    if (/^gnu\/gpl$/i.test(label)) {
        return { url: 'https://www.gnu.org/licenses/gpl.html', cssClass: '', isCC: false };
    }
    return { url: '', cssClass: '', isCC: false };
}

function nameHtml(title, sourceUrl) {
    if (!title) return '';
    const inner = `<em>${esc(title)}</em>`;
    const href = safeCaptionUrl(sourceUrl);
    if (href) {
        return `<a class="title" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`;
    }
    return `<span class="title">${inner}</span>`;
}

function authorHtml(author, authorUrl) {
    if (!author) return '';
    const href = safeCaptionUrl(authorUrl);
    if (href) {
        return `<a class="author" href="${esc(href)}" target="_blank" rel="noopener">${esc(author)}</a>`;
    }
    return `<span class="author">${esc(author)}</span>`;
}

function licenseHtml(license) {
    if (!license) return '';
    const meta = resolveCaptionLicense(license);
    if (!meta.url) {
        return `<span class="license custom-license">${esc(license)}</span>`;
    }
    const icon = meta.isCC ? '<span></span>' : '';
    const inner = `<a class="license ${meta.cssClass}" href="${esc(meta.url)}" rel="license noopener" target="_blank">${icon}${esc(license)}</a>`;
    return `<span class="license"><span class="sep">(</span>${inner}<span class="sep">)</span></span>`;
}

/**
 * Build the caption for an inserted image.
 * @param {{title?:string, author?:string, authorUrl?:string, sourceUrl?:string, license?:string}} meta
 * @param {{heading?:string, notes?:string, hidden?:boolean}} instance
 * @returns {{header:string, caption:string}}
 */
export function buildFigureCaption(meta, instance) {
    const m = meta || {};
    const i = instance || {};
    if (i.hidden) {
        return { header: '', caption: '' };
    }

    const heading = (i.heading || '').trim();
    const notes = (i.notes || '').trim();
    const header = heading ? `<div class="figcaption header"><strong>${esc(heading)}</strong></div>` : '';

    const name = nameHtml((m.title || '').trim(), (m.sourceUrl || '').trim());
    const author = authorHtml((m.author || '').trim(), (m.authorUrl || '').trim());
    const license = licenseHtml((m.license || '').trim());
    const notesSpan = notes ? `<span class="notes">${esc(notes)}</span>` : '';

    const lead = [];
    if (name) lead.push(name);
    if (author) lead.push(author);
    let inner = lead.join('. ');
    if (license) inner += (inner ? ' ' : '') + license;
    if (notesSpan) inner += (inner ? '. ' : '') + notesSpan;

    const caption = inner ? `<figcaption class="figcaption">${inner}</figcaption>` : '';
    return { header, caption };
}

// Expose the builder to the standalone TinyMCE exeimage plugin, which loads as its own
// script and cannot import this ES module. The plugin reads window.exeFigureCaption to
// render the caption at insert/edit time. Guarded for non-browser (test/SSR) contexts.
if (typeof window !== 'undefined') {
    window.exeFigureCaption = window.exeFigureCaption || {};
    window.exeFigureCaption.buildFigureCaption = buildFigureCaption;
    window.exeFigureCaption.resolveCaptionLicense = resolveCaptionLicense;
}
