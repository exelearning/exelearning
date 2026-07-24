/**
 * Minimal external-media fallback for the opaque-enabled editor preview.
 *
 * An opaque-origin iframe cannot satisfy YouTube's embedder-identity checks
 * (Error 153 territory) and Vimeo behaves similarly, so while the preview is
 * in the `opaque-enabled` state, provider iframes in the generated snapshot
 * are replaced with an accessible placeholder linking "open in a new tab".
 * With `allow-popups-to-escape-sandbox` in the sandbox set (decision D2) that
 * tab is a clean, non-sandboxed context where the video plays.
 *
 * This is deliberately NOT the maximal branch's external media bridge: no
 * relay, no trusted-parent modal, no MessageChannel. The full bridge remains
 * follow-up work for embedded hosts. Only `.html`/`.xhtml` snapshot entries
 * are touched, and an entry without provider iframes is passed through
 * byte-identical.
 */

import { isVideoProviderUrl } from '../../../../utils/videoProviderAllowlist.js';

function translate(text) {
    return typeof _ === 'function' ? _(text) : text;
}

/** True when the URL's hostname is a known external video provider. */
export const isExternalMediaUrl = isVideoProviderUrl;

function buildPlaceholder(doc, src) {
    const wrapper = doc.createElement('div');
    wrapper.className = 'exe-external-media-fallback';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute(
        'style',
        'border:1px solid #ccc;border-radius:4px;padding:1rem;margin:0.5rem 0;background:#f8f8f8;text-align:center;',
    );

    const message = doc.createElement('p');
    message.textContent = translate('External videos are not shown while the isolated preview is enabled.');
    message.setAttribute('style', 'margin:0 0 0.5rem 0;');
    wrapper.appendChild(message);

    const link = doc.createElement('a');
    link.href = src;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = translate('Open the video in a new tab');
    wrapper.appendChild(link);

    return wrapper;
}

function decodeEntry(content) {
    if (typeof content === 'string') return content;
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    return new TextDecoder().decode(bytes);
}

/**
 * Replace provider iframes in one HTML document string. Returns `null` when
 * nothing needed replacing so callers can keep the original bytes untouched.
 */
export function replaceExternalMediaInHtml(html) {
    if (typeof DOMParser === 'undefined') return null;
    if (!/<iframe/i.test(html)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let replaced = 0;
    for (const iframe of Array.from(doc.querySelectorAll('iframe[src]'))) {
        const src = iframe.getAttribute('src');
        if (!isExternalMediaUrl(src)) continue;
        iframe.replaceWith(buildPlaceholder(doc, src));
        replaced++;
    }
    if (replaced === 0) return null;
    const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : '';
    return { html: `${doctype}${doc.documentElement.outerHTML}`, replaced };
}

/**
 * Apply the fallback to a generated snapshot file map (path → bytes/string).
 * Only used in the `opaque-enabled` state; every other transport serves the
 * authored embed untouched. Non-HTML entries and HTML entries without
 * provider iframes are returned by reference, byte-identical.
 */
export function applyPreviewExternalMediaFallback(files) {
    const output = {};
    let replaced = 0;
    for (const [path, content] of Object.entries(files)) {
        if (!/\.x?html?$/i.test(path)) {
            output[path] = content;
            continue;
        }
        const result = replaceExternalMediaInHtml(decodeEntry(content));
        if (!result) {
            output[path] = content;
            continue;
        }
        output[path] = new TextEncoder().encode(result.html);
        replaced += result.replaced;
    }
    return { files: output, replaced };
}
