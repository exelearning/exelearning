/**
 * Shared builder for the image caption (figure/figcaption) that is auto-derived from
 * the centralized File Manager asset metadata plus the per-instance presentation the
 * author chose in the TinyMCE image dialog.
 *
 * Centralized (one source of truth, edited only in the File Manager, propagated to
 * every insertion): image name (`title`), `author`, `authorUrl`, `sourceUrl`, `license`.
 * Per-instance (unique to each insertion): `heading`, `notes`, `hidden`.
 *
 * The markup mirrors the long-standing exeimage figcaption convention
 * (`figure.exe-figure` › optional `div.figcaption.header` › `figcaption.figcaption`
 * with `.title` / `.author` / `.license` children) so existing theme CSS styles it.
 *
 * IMPORTANT — twin file: `public/app/common/figureCaption.js` is the browser/authoring
 * twin of this module (the TinyMCE plugin + the live caption resolver cannot import TS).
 * Keep the two in lockstep; any change here must be mirrored there and vice-versa, the
 * same convention used for `sanitizer.ts` ↔ `slide/slide.js`.
 */

import type { AssetExportMetadata } from './interfaces';

export interface FigureCaptionMetadata {
    /** Centralized image name / display title. */
    title?: string;
    author?: string;
    authorUrl?: string;
    /** Link to the original resource (the "image URL"). */
    sourceUrl?: string;
    /** Stored license label from the centralized vocabulary (licenseOptions.js). */
    license?: string;
}

export interface FigureCaptionInstance {
    /** Per-instance caption heading (Encabezado). */
    heading?: string;
    /** Per-instance caption notes (Observaciones). */
    notes?: string;
    /** When true, no caption is rendered at all (Ocultar pie de imagen). */
    hidden?: boolean;
}

export interface ResolvedLicense {
    url: string;
    cssClass: string;
    isCC: boolean;
}

function esc(value: string | undefined | null): string {
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
function safeCaptionUrl(value: string): string {
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
 * Resolve a stored license label (the centralized vocabulary from
 * public/app/common/licenseOptions.js, e.g. "Creative Commons BY-SA") to its canonical
 * URL + `cc cc-<code>` icon class. Values mirror the single source of truth
 * LICENSE_REGISTRY in constants.ts; resolved here by label because the same logic must
 * run client-side and in standalone exported packages. Identical to the resource-report
 * iDevice's `licenseMeta`.
 */
export function resolveCaptionLicense(license: string | undefined | null): ResolvedLicense {
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
}

/** Build the `.title` element: name text linked to the source URL when safe. */
function nameHtml(title: string, sourceUrl: string): string {
    if (!title) return '';
    const inner = `<em>${esc(title)}</em>`;
    const href = safeCaptionUrl(sourceUrl);
    if (href) {
        return `<a class="title" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`;
    }
    return `<span class="title">${inner}</span>`;
}

/** Build the `.author` element: author text linked to the author URL when safe. */
function authorHtml(author: string, authorUrl: string): string {
    if (!author) return '';
    const href = safeCaptionUrl(authorUrl);
    if (href) {
        return `<a class="author" href="${esc(href)}" target="_blank" rel="noopener">${esc(author)}</a>`;
    }
    return `<span class="author">${esc(author)}</span>`;
}

/** Build the license element, wrapped in parentheses, linked + iconed for CC. */
function licenseHtml(license: string): string {
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
 *
 * @returns `{ header, caption }` — `header` is the optional `div.figcaption.header`
 *   sibling rendered before the image; `caption` is the `figcaption.figcaption`
 *   rendered after it. Both are empty strings when there is nothing to show (or the
 *   caption is hidden), so callers can simply skip empty pieces.
 */
export function buildFigureCaption(
    meta: FigureCaptionMetadata,
    instance: FigureCaptionInstance,
): { header: string; caption: string } {
    if (instance?.hidden) {
        return { header: '', caption: '' };
    }

    const heading = (instance?.heading || '').trim();
    const notes = (instance?.notes || '').trim();
    const header = heading ? `<div class="figcaption header"><strong>${esc(heading)}</strong></div>` : '';

    const name = nameHtml((meta.title || '').trim(), (meta.sourceUrl || '').trim());
    const author = authorHtml((meta.author || '').trim(), (meta.authorUrl || '').trim());
    const license = licenseHtml((meta.license || '').trim());
    const notesHtml = notes ? `<span class="notes">${esc(notes)}</span>` : '';

    const lead: string[] = [];
    if (name) lead.push(name);
    if (author) lead.push(author);
    let inner = lead.join('. ');
    if (license) inner += (inner ? ' ' : '') + license;
    if (notesHtml) inner += (inner ? '. ' : '') + notesHtml;

    const caption = inner ? `<figcaption class="figcaption">${inner}</figcaption>` : '';
    return { header, caption };
}

function decodeAttr(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function readAttr(attrs: string, name: string): string {
    const m =
        new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs) ||
        new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(attrs);
    return m ? m[1] : '';
}

/**
 * The embedded element a `figure[data-asset-id]` presents: an image (exeimage) or a
 * media element (exemedia — video/audio/iframe/embed). Container elements keep their
 * children (`<source>`/`<track>`); `<img>`/`<embed>` are void. The first match is the
 * figure's subject; anything else inside the figure (stale captions) is rebuilt around it.
 */
const FIGURE_MEDIA_RE =
    /<img\b[^>]*>|<video\b[\s\S]*?<\/video>|<audio\b[\s\S]*?<\/audio>|<iframe\b[\s\S]*?<\/iframe>|<embed\b[^>]*>/i;

/**
 * Bake the auto-derived captions into exported HTML.
 *
 * The caption stored in the Y.Doc is a snapshot from insert/edit time and can go stale
 * after a File Manager metadata edit (the live resolver only updates the authoring DOM,
 * not the stored content). At export we therefore re-derive the figcaption of every
 * `figure[data-asset-id]` — image figures (exeimage) and media figures (exemedia:
 * video/audio/iframe/embed) alike — from the current centralized metadata + the figure's
 * per-instance `data-caption-*`, so static packages (HTML5/SCORM/EPUB/ELPX) always
 * reflect the File Manager. DOM-free (figures never nest) so it runs in both the browser
 * and server export pipelines without a DOM dependency.
 *
 * @param html - rendered iDevice content HTML
 * @param metadataMap - centralized metadata keyed by asset id (from getExportMetadataMap)
 */
export function bakeFigureCaptions(html: string, metadataMap?: Map<string, AssetExportMetadata>): string {
    if (!html || html.indexOf('data-asset-id') === -1) return html;
    return html.replace(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi, (full, attrs: string, inner: string) => {
        const assetId = readAttr(attrs, 'data-asset-id');
        if (!assetId) return full;
        const mediaMatch = inner.match(FIGURE_MEDIA_RE);
        if (!mediaMatch) return full;
        const media = mediaMatch[0];
        const meta = metadataMap?.get(assetId) || {};
        const instance: FigureCaptionInstance = {
            heading: decodeAttr(readAttr(attrs, 'data-caption-heading')),
            notes: decodeAttr(readAttr(attrs, 'data-caption-notes')),
            hidden: readAttr(attrs, 'data-caption-hidden') === 'true',
        };
        const { header, caption } = buildFigureCaption(meta, instance);
        return `<figure${attrs}>${header}${media}${caption}</figure>`;
    });
}
