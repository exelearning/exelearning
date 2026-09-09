/**
 * Reading the entries of a preview snapshot.
 *
 * Two modules walk the same map of `path -> bytes` and rewrite the HTML documents in it:
 * the embed shim, which injects the in-content runtime, and the external-media fallback,
 * which swaps provider iframes for links. They each had their own copy of "is this an HTML
 * entry" and "turn this entry into a string", which is two places for an encoding fix to
 * land in one of.
 */

/** Preview entries that are HTML documents. */
export const HTML_PATH = /\.x?html?$/i;

/** Whether a snapshot entry is an HTML document, by path. */
export function isHtmlEntry(path) {
    return HTML_PATH.test(path);
}

/**
 * A snapshot entry as text.
 *
 * Entries arrive as strings or as bytes depending on where the snapshot came from, so both
 * are accepted rather than pushing the check onto every caller.
 */
export function decodeEntry(content) {
    if (typeof content === 'string') return content;
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    return new TextDecoder().decode(bytes);
}
