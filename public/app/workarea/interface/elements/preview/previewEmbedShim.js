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
 * The shim is INLINED rather than linked: the opaque document has no stable
 * origin for a relative URL to resolve against, and the serving CSP allows
 * 'unsafe-inline' scripts but pins everything else to 'self'. It must run
 * before the page's own scripts (exe_media_bridge.js checks window.exeEmbedShim
 * and defers to it), hence the injection at the very top of <head>.
 */

/** Preview entries that are HTML documents. */
const HTML_PATH = /\.x?html?$/i;

/** Marker attribute, also the double-injection guard. */
const SHIM_MARKER = 'data-exe-embed-shim';

function decodeEntry(content) {
    if (typeof content === 'string') return content;
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    return new TextDecoder().decode(bytes);
}

/**
 * Neutralize any `</script` inside the injected source so it cannot terminate
 * the wrapping tag early. Defense in depth — the canonical shim contains none.
 */
function escapeForInlineScript(source) {
    return String(source).replace(/<\/script/gi, '<\\/script');
}

/**
 * Inject the shim into one HTML document string. Returns `null` when nothing
 * was injected so callers can keep the original bytes untouched.
 *
 * @param {string} html
 * @param {string} shimSource
 * @returns {string|null}
 */
export function injectEmbedShimIntoHtml(html, shimSource) {
    if (!shimSource || typeof html !== 'string') return null;
    if (html.includes(SHIM_MARKER)) return null;
    const tag = `<script ${SHIM_MARKER}>${escapeForInlineScript(shimSource)}</script>`;
    const headOpen = /<head\b[^>]*>/i.exec(html);
    if (headOpen) {
        const at = headOpen.index + headOpen[0].length;
        return html.slice(0, at) + tag + html.slice(at);
    }
    // Degenerate documents (no <head>): still run the shim before the body.
    const bodyOpen = /<body\b[^>]*>/i.exec(html);
    if (bodyOpen) return html.slice(0, bodyOpen.index) + tag + html.slice(bodyOpen.index);
    return tag + html;
}

/**
 * Inject the shim into every HTML page of a generated preview file map.
 * Non-HTML entries (and pages that already carry the shim) are returned by
 * reference, byte-identical — the opaque snapshot must keep author bytes.
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
        const next = injectEmbedShimIntoHtml(decodeEntry(content), shimSource);
        if (!next) {
            output[path] = content;
            continue;
        }
        output[path] = new TextEncoder().encode(next);
        injected += 1;
    }
    return { files: output, injected };
}
