/**
 * Self-contained page inlining for the srcdoc preview transport.
 *
 * An opaque-origin srcdoc document has no server behind it: every local
 * reference (stylesheets, scripts, fonts, images, media, PDFs) must be
 * embedded into the page itself. References are resolved relative to the file
 * that contains them (the page for HTML attributes, the stylesheet for CSS
 * url()/@import), and byte budgets keep pathological projects from freezing
 * the tab — over-budget assets keep their original reference (they 404
 * quietly, exactly like today's blob fallback) and are reported so the panel
 * can show a notice.
 */
import {
    decodeFileContent,
    documentMimeFor,
    findFileContent,
    resolveRelativePath,
    toUint8Array,
} from './previewFileMap.js';

const MIB = 1024 * 1024;

/** Per-asset raw-byte caps by asset class (base64 output is ~4/3 larger). */
const DEFAULT_PER_ASSET_CAPS = Object.freeze({
    font: 5 * MIB,
    image: 5 * MIB,
    media: 16 * MIB,
    pdf: 16 * MIB,
});

/** Total raw bytes inlined per page across all asset classes. */
const DEFAULT_TOTAL_BUDGET = 48 * MIB;

const FONT_EXTENSIONS = /^(woff2?|ttf|otf|eot)$/i;
const IMAGE_EXTENSIONS = /^(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;
const MEDIA_EXTENSIONS = /^(mp3|mp4|webm|ogg|oga|ogv|wav|m4a|m4v|vtt)$/i;

/** MIME overrides for asset types documentMimeFor does not cover. */
const INLINE_MIME_OVERRIDES = {
    woff2: 'font/woff2',
    woff: 'font/woff',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
    vtt: 'text/vtt',
    css: 'text/css',
    js: 'application/javascript',
    bmp: 'image/bmp',
    oga: 'audio/ogg',
    ogv: 'video/ogg',
    m4v: 'video/mp4',
};

function extensionOf(path) {
    const name = path.split('/').pop() || '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function assetClassOf(path) {
    const ext = extensionOf(path);
    if (FONT_EXTENSIONS.test(ext)) return 'font';
    if (IMAGE_EXTENSIONS.test(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (MEDIA_EXTENSIONS.test(ext)) return 'media';
    return 'other';
}

function mimeFor(path) {
    const ext = extensionOf(path);
    return INLINE_MIME_OVERRIDES[ext] || documentMimeFor(path);
}

function bytesToBase64(bytes) {
    const chunks = [];
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(''));
}

function dataUriFor(path, bytes) {
    return `data:${mimeFor(path)};base64,${bytesToBase64(bytes)}`;
}

function dirOf(path) {
    return path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
}

/**
 * Resolve a reference found inside `basePath`'s directory against the file
 * map. Returns null for external/protocol/data references or missing files.
 */
function resolveRef(ref, baseDir, files) {
    const clean = ref.split('?')[0].split('#')[0].trim();
    if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
    const joined = clean.startsWith('/') ? clean.replace(/^\/+/, '') : baseDir + clean;
    const resolved = resolveRelativePath(joined);
    let content = findFileContent(files, resolved);
    if (content === undefined) content = findFileContent(files, clean);
    if (content === undefined) return null;
    return { path: resolved, content };
}

/** Consume budget for an asset; records the skip reason when it does not fit. */
function tryConsume(state, path, size, assetClass) {
    const cap = state.caps[assetClass];
    if (cap && size > cap) {
        state.skipped.push({ path, size, reason: 'per-asset-cap' });
        return false;
    }
    if (size > state.remaining) {
        state.skipped.push({ path, size, reason: 'total-budget' });
        return false;
    }
    state.remaining -= size;
    return true;
}

/**
 * Inline @import chains and url() assets (fonts/images) inside CSS text,
 * resolving every reference against the CSS file's own directory.
 */
function processCss(cssText, cssPath, files, state, visited, depth) {
    const dir = dirOf(cssPath);

    cssText = cssText.replace(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi, (match, ref) => {
        if (depth >= 4) return '';
        const resolved = resolveRef(ref, dir, files);
        if (!resolved) return match;
        if (visited.has(resolved.path)) return '';
        visited.add(resolved.path);
        const imported = decodeFileContent(resolved.content);
        if (imported == null) return match;
        return processCss(imported, resolved.path, files, state, visited, depth + 1);
    });

    cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, _quote, ref) => {
        const resolved = resolveRef(ref, dir, files);
        if (!resolved) return match;
        const assetClass = assetClassOf(resolved.path);
        if (assetClass !== 'font' && assetClass !== 'image') return match;
        const bytes = toUint8Array(resolved.content);
        if (!bytes) return match;
        if (!tryConsume(state, resolved.path, bytes.length, assetClass)) return match;
        return `url(${dataUriFor(resolved.path, bytes)})`;
    });

    return cssText;
}

function inlineStylesheets(html, files, state, pageDir) {
    return html.replace(
        /<link\s+(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']([^"']+)["'])[^>]*\/?>/gi,
        (match, href) => {
            const resolved = resolveRef(href, pageDir, files);
            if (!resolved) return match;
            const cssText = decodeFileContent(resolved.content);
            if (cssText == null) return match;
            const processed = processCss(cssText, resolved.path, files, state, new Set([resolved.path]), 0);
            const escaped = processed.replace(/<\/style/gi, '<\\/style');
            const safeHref = href.replace(/\*\//g, '* /');
            return `<style>/* ${safeHref} */\n${escaped}</style>`;
        },
    );
}

function inlineScripts(html, files, state, pageDir) {
    return html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, (match, src) => {
        const resolved = resolveRef(src, pageDir, files);
        if (!resolved) return match;
        const content = decodeFileContent(resolved.content);
        if (content == null) return match;
        const escaped = content.replace(/<\/script/gi, '<\\/script');
        const safeSrc = src.replace(/\*\//g, '* /');
        return `<script>/* ${safeSrc} */\n${escaped}</script>`;
    });
}

/** Replace PDF <object>/<embed>/<iframe> with data-URI placeholders the PDF.js embed script renders. */
function inlinePdfEmbeds(html, files, state, pageDir) {
    const replaceEmbed = (match, src) => {
        const resolved = resolveRef(src, pageDir, files);
        if (!resolved) return match;
        const bytes = toUint8Array(resolved.content);
        if (!bytes) return match;
        if (!tryConsume(state, resolved.path, bytes.length, 'pdf')) return match;

        const wMatch = match.match(/width=(["']?)(\d+(?:px|%)?)\1/i);
        const hMatch = match.match(/height=(["']?)(\d+(?:px|%)?)\1/i);
        const w = wMatch ? wMatch[2] : '100%';
        const h = hMatch ? hMatch[2] : '600px';
        return `<div data-exe-pdf-src="${dataUriFor(resolved.path, bytes)}" style="width:${w};height:${h}"></div>`;
    };

    html = html.replace(
        /<object([^>]*?)data=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*)>[\s\S]*?<\/object>/gi,
        (match, _pre, _q, src) => replaceEmbed(match, src),
    );
    html = html.replace(/<embed([^>]*?)src=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*?)\/?>/gi, (match, _pre, _q, src) =>
        replaceEmbed(match, src),
    );
    html = html.replace(
        /<iframe([^>]*?)src=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*)>[\s\S]*?<\/iframe>/gi,
        (match, _pre, _q, src) => replaceEmbed(match, src),
    );
    return html;
}

/** Convert a single URL reference to a data URI when it fits the budget. */
function inlineRef(ref, files, state, pageDir, allowedClasses) {
    const resolved = resolveRef(ref, pageDir, files);
    if (!resolved) return null;
    const assetClass = assetClassOf(resolved.path);
    if (!allowedClasses.includes(assetClass)) return null;
    const bytes = toUint8Array(resolved.content);
    if (!bytes) return null;
    if (!tryConsume(state, resolved.path, bytes.length, assetClass)) return null;
    return dataUriFor(resolved.path, bytes);
}

function inlineSrcset(value, files, state, pageDir) {
    const candidates = value.split(',').map((candidate) => {
        const trimmed = candidate.trim();
        if (!trimmed) return candidate;
        const spaceIndex = trimmed.search(/\s/);
        const url = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
        const descriptor = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex);
        const dataUri = inlineRef(url, files, state, pageDir, ['image']);
        return dataUri ? `${dataUri}${descriptor}` : trimmed;
    });
    return candidates.join(', ');
}

/** Inline src/poster/srcset attributes on img/audio/video/source/track tags. */
function inlineMediaAttributes(html, files, state, pageDir) {
    return html.replace(/<(img|audio|video|source|track)\b[^>]*>/gi, (tag, tagName) => {
        const isImg = /^img$/i.test(tagName);
        const srcClasses = isImg ? ['image'] : ['media', 'image'];

        tag = tag.replace(/(\ssrc=)(["'])([^"']+)\2/i, (match, prefix, quote, value) => {
            const dataUri = inlineRef(value, files, state, pageDir, srcClasses);
            return dataUri ? `${prefix}${quote}${dataUri}${quote}` : match;
        });
        tag = tag.replace(/(\sposter=)(["'])([^"']+)\2/i, (match, prefix, quote, value) => {
            const dataUri = inlineRef(value, files, state, pageDir, ['image']);
            return dataUri ? `${prefix}${quote}${dataUri}${quote}` : match;
        });
        tag = tag.replace(/(\ssrcset=)(["'])([^"']+)\2/i, (match, prefix, quote, value) => {
            return `${prefix}${quote}${inlineSrcset(value, files, state, pageDir)}${quote}`;
        });
        return tag;
    });
}

/**
 * Inline href attributes on <a> tags that point to bundled image assets. Some iDevices
 * (before/after, image gallery, magnifier) carry their images as anchor hrefs and promote
 * them to <img> at runtime by reading the href. Without a server the relative href cannot
 * resolve in the opaque srcdoc document, so inline the ones that resolve to an image asset.
 * Non-image hrefs (page navigation, downloads) resolve to a non-image class and are left
 * untouched.
 */
function inlineAnchorImageHrefs(html, files, state, pageDir) {
    return html.replace(/<a\b[^>]*>/gi, (tag) => {
        return tag.replace(/(\shref=)(["'])([^"']+)\2/i, (match, prefix, quote, value) => {
            const dataUri = inlineRef(value, files, state, pageDir, ['image']);
            return dataUri ? `${prefix}${quote}${dataUri}${quote}` : match;
        });
    });
}

/**
 * Inline a preview page for srcdoc rendering.
 * @param {string} html Page HTML.
 * @param {Object<string, ArrayBuffer|Uint8Array|string>} files Preview file map.
 * @param {{pagePath: string, perAssetCaps?: Object, totalBudget?: number}} options
 * @returns {{html: string, stats: {inlinedBytes: number, skipped: Array<{path: string, size: number, reason: string}>}}}
 */
export function inlinePreviewPage(html, files, options) {
    const totalBudget = options.totalBudget ?? DEFAULT_TOTAL_BUDGET;
    const state = {
        caps: { ...DEFAULT_PER_ASSET_CAPS, ...(options.perAssetCaps || {}) },
        remaining: totalBudget,
        skipped: [],
    };
    const pageDir = dirOf(options.pagePath || '');

    html = inlineStylesheets(html, files, state, pageDir);
    html = inlineScripts(html, files, state, pageDir);
    html = inlinePdfEmbeds(html, files, state, pageDir);
    html = inlineMediaAttributes(html, files, state, pageDir);
    html = inlineAnchorImageHrefs(html, files, state, pageDir);

    return {
        html,
        stats: { inlinedBytes: totalBudget - state.remaining, skipped: state.skipped },
    };
}
