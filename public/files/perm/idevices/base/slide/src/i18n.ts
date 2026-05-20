/**
 * Slide iDevice — translation helper.
 *
 * Wraps the global eXeLearning translation function (`window._`) so the
 * editor can opt into translations when present and degrade gracefully in
 * isolation (tests, standalone bundles).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

type GlobalWithUnderscore = { _?: (key: string) => string };

export function t(key: string): string {
    const g = globalThis as unknown as GlobalWithUnderscore;
    if (typeof g._ === 'function') {
        try {
            const out = g._(key);
            if (typeof out === 'string' && out.length > 0) return out;
        } catch {
            /* fall through to key */
        }
    }
    return key;
}
