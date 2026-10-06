/**
 * Import result contract helpers (single source of truth).
 *
 * `YjsProjectBridge.importFromElpx` (reached via `importFromElpxViaYjs`) resolves
 * to `{ cancelled: true }` — optionally with `{ error: 'zip-limit' }` — instead of
 * throwing when an import is rejected (an archive entry over the applicable size
 * limit) or cancelled (the user declines the desktop large-file confirmation).
 *
 * Every caller MUST honor this shape and skip the success UI, save, and refresh
 * steps when it is present, otherwise a rejected/cancelled import is reported as a
 * green "Completed successfully" and the (unchanged) project may be re-saved. On
 * success the resolved value is the import statistics object; on a genuine failure
 * the promise still rejects, so callers keep their existing try/catch handling.
 *
 * See PR #2198.
 */

/**
 * Whether an import result represents a rejected or cancelled import.
 *
 * @param {Object|null|undefined} result - The value resolved by importFromElpx / importFromElpxViaYjs
 * @returns {boolean} true when the import was rejected or cancelled and must not proceed
 */
export function isImportCancelled(result) {
    return result?.cancelled === true;
}
