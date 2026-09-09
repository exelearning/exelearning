/**
 * Time parsing and formatting. Storage always keeps raw seconds; `mm:ss` /
 * `hh:mm:ss` strings are display- and input-only.
 */

/** Zero-pad a non-negative integer to at least two digits. */
function pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
}

/**
 * Format a number of seconds as `mm:ss`, or `hh:mm:ss` once it reaches an
 * hour. Fractional seconds are floored; invalid/negative input yields `00:00`.
 */
export function secondsToHms(value: unknown): string {
    let total = Number(value);
    if (!isFinite(total) || total < 0) {
        total = 0;
    }
    total = Math.floor(total);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
        return pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
    }
    return pad2(minutes) + ':' + pad2(seconds);
}

/**
 * Parse an `mm:ss` or `hh:mm:ss` string into seconds. Components may be
 * unpadded (`1:5`). Returns `NaN` for anything unparseable so callers can
 * distinguish "no value" from `0`.
 */
export function hmsToSeconds(hms: unknown): number {
    if (typeof hms !== 'string') {
        return NaN;
    }
    const parts = hms.split(':');
    if (parts.length < 2 || parts.length > 3) {
        return NaN;
    }
    let seconds = 0;
    for (const part of parts) {
        if (!/^\d+$/.test(part)) {
            return NaN;
        }
        seconds = seconds * 60 + Number(part);
    }
    return seconds;
}

/**
 * Coerce any input to a finite, non-negative number of seconds, defaulting to
 * `0` (never throws). Accepts numbers, numeric strings, and `mm:ss` /
 * `hh:mm:ss` strings. Used at migration and runtime so a single malformed
 * value can never blank the whole activity.
 */
export function toSeconds(value: unknown): number {
    if (typeof value === 'number') {
        return isFinite(value) && value >= 0 ? value : 0;
    }
    if (typeof value === 'string') {
        const parsed = value.indexOf(':') > -1 ? hmsToSeconds(value) : Number(value);
        return isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }
    return 0;
}
