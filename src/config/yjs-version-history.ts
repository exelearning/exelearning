/**
 * Yjs version history configuration.
 */

export const DEFAULT_YJS_VERSION_HISTORY_LIMIT = 5;

/**
 * Parse the configured Yjs version history retention limit.
 *
 * Invalid, empty, negative, or unsafe integer values fall back to the default.
 * A value of zero explicitly disables automatic history creation.
 */
export function parseYjsVersionHistoryLimit(value: string | undefined): number {
    if (value === undefined || value.trim() === '') {
        return DEFAULT_YJS_VERSION_HISTORY_LIMIT;
    }

    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
        return DEFAULT_YJS_VERSION_HISTORY_LIMIT;
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
        return DEFAULT_YJS_VERSION_HISTORY_LIMIT;
    }

    return parsed;
}

/**
 * Read the Yjs version history retention limit from the environment.
 */
export function getYjsVersionHistoryLimit(
    value: string | undefined = process.env.YJS_VERSION_HISTORY_LIMIT,
): number {
    return parseYjsVersionHistoryLimit(value);
}
