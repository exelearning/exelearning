/**
 * ID Generator Utilities
 * Ported from Symfony's Util.php to maintain compatibility
 *
 * CRITICAL: These functions generate IDs in Symfony-compatible format.
 * DO NOT replace with UUIDs as the ID format is required for:
 * - File system organization (year/month/day directory structure)
 * - Backward compatibility with existing ELP files
 * - Old format imports (contentv2/contentv3 conversion)
 */

/**
 * Generates a unique ID in Symfony-compatible format
 *
 * Format: YYYYMMDDHHmmss + 6 random uppercase letters
 * Example: 20250116143027ABCDEF (20 characters total)
 *
 * Breakdown:
 * - YYYY: 4-digit year
 * - MM: 2-digit month (01-12)
 * - DD: 2-digit day (01-31)
 * - HH: 2-digit hour (00-23, UTC)
 * - mm: 2-digit minutes (00-59)
 * - ss: 2-digit seconds (00-59)
 * - 6 random uppercase letters (A-Z)
 *
 * This format is ESSENTIAL for:
 * 1. File organization: The date components are extracted to create directory structure
 *    Example: files/tmp/2025/01/16/{sessionId}/
 * 2. Backward compatibility: Existing ELP files use this format
 * 3. Old format imports: contentv2/contentv3 conversion expects this format
 *
 * @returns string - 20-character ID in format YYYYMMDDHHmmss + 6 random letters
 *
 * @see symfony_legacy/src/Util/net/exelearning/Util/Util.php::generateId()
 */
export function generateId(): string {
    const now = new Date();

    // Get UTC components for consistent timezone handling
    const year = now.getUTCFullYear().toString();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');

    // Format: YYYYMMDDHHmmss (14 characters)
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

    // Generate 6 random uppercase letters
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomString = '';
    for (let i = 0; i < 6; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return timestamp + randomString;
}

/**
 * Generates a unique ID that doesn't exist in the provided array
 *
 * This function is used when converting old XML formats to ensure
 * no ID collisions occur. It keeps generating new IDs until it finds
 * one that's not in the provided array.
 *
 * Usage example (from old XML conversion):
 * ```typescript
 * const generatedIds: string[] = [];
 * const newPageId = generateIdCheckUnique(generatedIds);
 * generatedIds.push(newPageId);
 * ```
 *
 * @param generatedIds - Array of already generated IDs to check against
 * @returns string - A unique ID not present in the array
 *
 * @see symfony_legacy/src/Util/net/exelearning/Util/Util.php::generateIdCheckUnique()
 */
export function generateIdCheckUnique(generatedIds: string[]): string {
    let newId: string;

    do {
        newId = generateId();
    } while (generatedIds.includes(newId));

    return newId;
}

/**
 * Generates a random string of uppercase letters
 *
 * Used for temporary file naming and other purposes where a random
 * string is needed without timestamp information.
 *
 * @param length - Length of the random string to generate
 * @returns string - Random uppercase letters of specified length
 *
 * @see symfony_legacy/src/Util/net/exelearning/Util/Util.php::generateRandomStr()
 */
export function generateRandomStr(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
}
