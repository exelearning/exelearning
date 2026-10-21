/**
 * DataGame cipher
 *
 * Gamified iDevices (guess, quick-questions, crossword, map, ...) persist their whole state as a
 * JSON blob inside a hidden `<div class="<prefix>-DataGame js-hidden">` in the component HTML.
 * The blob is obfuscated with a XOR pass followed by `escape()`.
 *
 * This is the single source of truth for that transform. It mirrors
 * `$exeDevices.iDevice.gamification.helpers` in public/app/common/common.js, which is the code
 * that actually produced the stored data — so `unescape()` (the exact inverse of `escape()`) is
 * the canonical decoder here, not `decodeURIComponent()`.
 */

/** XOR key used by common.js `helpers.encrypt` / `helpers.decrypt`. */
export const DATA_GAME_CIPHER_KEY = 146;

/**
 * Decode a DataGame payload back to its plain JSON string.
 *
 * Returns '' for empty, absent or undecodable input — callers treat that as "no usable data"
 * rather than an error, matching the browser helper's behaviour.
 *
 * @param value - Escaped, XOR-obfuscated payload as stored in the DataGame div
 * @returns The plain string, or '' when the payload cannot be decoded
 */
export function decryptDataGame(value: string | null | undefined): string {
    if (!value || value === 'undefined' || value === 'null') return '';

    try {
        // `unescape` is the inverse of the `escape` applied by encryptDataGame. It is deprecated
        // but not replaceable here: `decodeURIComponent` throws on the `%uXXXX` sequences that
        // `escape` emits for characters outside Latin-1 (Greek, Cyrillic, emoji, ...).
        const decoded = unescape(value);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(DATA_GAME_CIPHER_KEY ^ decoded.charCodeAt(i));
        }
        return result;
    } catch {
        return '';
    }
}

/**
 * Encode a plain string into the DataGame payload format.
 *
 * @param value - Plain string (normally `JSON.stringify(dataGame)`)
 * @returns The escaped, XOR-obfuscated payload, or '' for empty input
 */
export function encryptDataGame(value: string | null | undefined): string {
    if (!value) return '';

    try {
        let xored = '';
        for (let i = 0; i < value.length; i++) {
            xored += String.fromCharCode(value.charCodeAt(i) ^ DATA_GAME_CIPHER_KEY);
        }
        return escape(xored);
    } catch {
        return '';
    }
}
