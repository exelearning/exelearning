/**
 * Extract date directory structure from identifier
 * Converts "20250118101235DEF" → "2025/01/18/"
 *
 * This is used to create date-based directory structure in permanent storage:
 * files/perm/odes/2025/01/18/
 *
 * @param identifier Version ID or ODE ID (format: YYYYMMDDHHmmssXXX)
 * @returns Date directory structure (e.g., "2025/01/18/")
 */
export function getDateDirStructureFromIdentifier(identifier: string): string {
    if (!identifier || identifier.length < 8) {
        throw new Error(`Invalid identifier format: ${identifier}. Expected at least 8 characters (YYYYMMDD).`);
    }

    // Extract date components from identifier
    // Format: YYYYMMDDHHmmssXXX (e.g., 20250118101235DEF)
    const year = identifier.substring(0, 4); // 2025
    const month = identifier.substring(4, 6); // 01
    const day = identifier.substring(6, 8); // 18

    // Validate extracted values
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    if (yearNum < 2000 || yearNum > 2100) {
        throw new Error(`Invalid year in identifier: ${year}`);
    }

    if (monthNum < 1 || monthNum > 12) {
        throw new Error(`Invalid month in identifier: ${month}`);
    }

    if (dayNum < 1 || dayNum > 31) {
        throw new Error(`Invalid day in identifier: ${day}`);
    }

    // Return formatted path: "YYYY/MM/DD/"
    return `${year}/${month}/${day}/`;
}

/**
 * Get current date as directory structure
 * @returns Current date as "YYYY/MM/DD/"
 */
export function getCurrentDateDirStructure(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}/`;
}
