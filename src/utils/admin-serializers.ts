/**
 * Admin Serializers
 * Shared utilities for serializing database records to API responses
 */

// ============================================================================
// STRING TRANSFORMATIONS
// ============================================================================

/**
 * Convert snake_case to camelCase
 * @example snakeToCamel('display_name') => 'displayName'
 */
export function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

// ============================================================================
// RECORD SERIALIZATION
// ============================================================================

/**
 * Serialize a database record to an API response object
 *
 * Features:
 * - Converts snake_case keys to camelCase
 * - Converts specified fields from SQLite integers (0/1) to booleans
 *
 * @param record - The database record to serialize
 * @param booleanFields - Field names (in snake_case) that should be converted to booleans
 * @returns Serialized object with camelCase keys
 *
 * @example
 * const theme = { id: 1, display_name: 'My Theme', is_enabled: 1 };
 * serializeRecord(theme, ['is_enabled']);
 * // => { id: 1, displayName: 'My Theme', isEnabled: true }
 */
export function serializeRecord<T extends Record<string, unknown>>(
    record: T,
    booleanFields: string[] = [],
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
        const camelKey = snakeToCamel(key);

        if (booleanFields.includes(key)) {
            // Convert SQLite integer to boolean
            result[camelKey] = value === 1;
        } else {
            result[camelKey] = value;
        }
    }

    return result;
}

/**
 * Create a typed serializer function for a specific record type
 *
 * @param booleanFields - Field names (in snake_case) that should be converted to booleans
 * @returns A serializer function for the record type
 *
 * @example
 * const serializeTheme = createSerializer<Theme>(['is_enabled', 'is_default', 'is_builtin']);
 * const serialized = serializeTheme(theme);
 */
export function createSerializer<T extends Record<string, unknown>>(
    booleanFields: string[] = [],
): (record: T) => Record<string, unknown> {
    return (record: T) => serializeRecord(record, booleanFields);
}
