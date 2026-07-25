/**
 * External-embed shim injection for the opaque editor preview.
 *
 * Inside an opaque preview the author's provider embeds (YouTube, Vimeo,
 * Dailymotion, …) render blank: the sandbox strips the nested iframe's origin,
 * so the player has no storage and refuses to start (YouTube "Error 153"). The
 * shim (public/app/common/exe_embed_bridge/exe_embed_shim.js) runs INSIDE that
 * document, replaces every cross-origin embed with a geometry placeholder and
 * reports it to the editor, which overlays the real player on the trusted side
 * (see previewMediaHost.js + exe_embed_relay.js). Net effect: videos play in
 * place, with the untrusted document still opaque.
 *
 * The shim travels as ONE file in the snapshot and every page links it with a
 * relative `<script src>`. Inlining it instead would repeat ~14.5 KB per page —
 * on a 15-page project that is ~220 KB re-zipped, re-uploaded and re-extracted
 * on every 500 ms-debounced refresh, and re-downloaded on every page the author
 * visits, since preview responses are `no-store`. A relative URL resolves
 * against the document's URL (the sandbox does not change that) and the serving
 * CSP allows `'self'`, so the link works in the opaque document.
 *
 * The tag goes at the very top of <head>: the shim must run before the page's
 * own scripts, because exe_media_bridge.js checks `window.exeEmbedShim` and
 * defers to it.
 */

/** Preview entries that are HTML documents. */
const HTML_PATH = /\.x?html?$/i;

/** Snapshot-root filename for the shared shim. */
export const EMBED_SHIM_FILENAME = 'exe-embed-shim.js';

/** Marker attribute, also the double-injection guard. */
const SHIM_MARKER = 'data-exe-embed-shim';

function decodeEntry(content) {
    if (typeof content === 'string') return content;
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    return new TextDecoder().decode(bytes);
}

/** `html/page.html` is one level deep, so it needs `../` to reach the root. */
function relativePrefix(path) {
    return '../'.repeat(path.split('/').length - 1);
}

/**
 * Inject the shim tag into one HTML document string. Returns `null` when
 * nothing was injected so callers can keep the original bytes untouched.
 *
 * @param {string} html
 * @param {string} src Relative URL of the shim file.
 * @returns {string|null}
 */
export function injectEmbedShimIntoHtml(html, src) {
    if (!src || typeof html !== 'string') return null;
    if (html.includes(SHIM_MARKER)) return null;
    const tag = `<script ${SHIM_MARKER} src="${src}"></script>`;
    const headOpen = /<head\b[^>]*>/i.exec(html);
    if (headOpen) {
        const at = headOpen.index + headOpen[0].length;
        return html.slice(0, at) + tag + html.slice(at);
    }
    // Degenerate documents (no <head>): still run the shim before the body.
    const bodyOpen = /<body\b[^>]*>/i.exec(html);
    if (bodyOpen) return html.slice(0, bodyOpen.index) + tag + html.slice(bodyOpen.index);
    return null;
}

/**
 * Add the shim to a generated preview file map: one copy of the source at the
 * snapshot root, one `<script src>` per HTML page. Non-HTML entries (and pages
 * that already carry the shim) are returned by reference, byte-identical — the
 * opaque snapshot must keep author bytes.
 *
 * @param {Record<string, string|Uint8Array|ArrayBuffer>} files
 * @param {string} shimSource
 * @returns {{files: Record<string, string|Uint8Array|ArrayBuffer>, injected: number}}
 */
export function applyPreviewEmbedShim(files, shimSource) {
    if (!shimSource) return { files, injected: 0 };
    const output = {};
    let injected = 0;
    for (const [path, content] of Object.entries(files)) {
        if (!HTML_PATH.test(path)) {
            output[path] = content;
            continue;
        }
        const next = injectEmbedShimIntoHtml(
            decodeEntry(content),
            relativePrefix(path) + EMBED_SHIM_FILENAME
        );
        if (!next) {
            output[path] = content;
            continue;
        }
        output[path] = new TextEncoder().encode(next);
        injected += 1;
    }
    if (injected > 0) output[EMBED_SHIM_FILENAME] = shimSource;
    return { files: output, injected };
}
