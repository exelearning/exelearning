/**
 * Generate ELP filename from odeId and odeVersionId
 * Format: {odeId}_{odeVersionId}.elpx
 * Example: 20250118101234ABC_20250118101235DEF.elpx
 */
export function generateElpFilename(odeId: string, odeVersionId: string): string {
    return `${odeId}_${odeVersionId}.elpx`;
}

/**
 * Parse ELP filename to extract odeId and odeVersionId
 * @param filename ELP filename (e.g., "20250118101234ABC_20250118101235DEF.elpx")
 * @returns Object with odeId and odeVersionId, or null if invalid format
 */
export function parseElpFilename(filename: string): { odeId: string; odeVersionId: string } | null {
    // Remove .elpx extension
    const nameWithoutExt = filename.replace(/\.elpx?$/i, '');

    // Split by underscore
    const parts = nameWithoutExt.split('_');

    if (parts.length !== 2) {
        return null;
    }

    return {
        odeId: parts[0],
        odeVersionId: parts[1],
    };
}
