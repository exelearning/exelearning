/**
 * Preview Service Helper for Elysia
 * Handles preview-specific operations like temp path generation,
 * URL building, and MIME type detection
 */
import * as crypto from 'crypto';
import * as path from 'path';
import * as mime from 'mime-types';

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Generate random temp path for preview isolation
 * @returns Random hex string (6 characters) with trailing slash
 * @example "a3f5d2/"
 */
export function generateRandomTempPath(): string {
    const randomHex = crypto.randomBytes(3).toString('hex');
    return `${randomHex}/`;
}

/**
 * Build complete preview URL from session and file path
 * @param sessionId - ODE session ID (contains date pattern)
 * @param tempPath - Random subdirectory (e.g., "a3f5d2/")
 * @param filePath - Relative file path (e.g., "index.html" or "pages/page1.html")
 * @returns Complete URL path
 * @example "/files/tmp/2025/01/16/20250116abc123/a3f5d2/index.html"
 */
export function buildPreviewUrl(sessionId: string, tempPath: string, filePath: string): string {
    // Check if session ID matches date pattern YYYYMMDD...
    if (/^\d{8}/.test(sessionId)) {
        const year = sessionId.substring(0, 4);
        const month = sessionId.substring(4, 6);
        const day = sessionId.substring(6, 8);
        const urlPath = `/files/tmp/${year}/${month}/${day}/${sessionId}/export/${tempPath}${filePath}`;
        if (DEBUG) console.log(`[Preview] Built date-based preview URL: ${urlPath}`);
        return urlPath;
    }

    // Fallback URL for non-date session IDs
    const urlPath = `/files/tmp/${sessionId}/export/${tempPath}${filePath}`;
    if (DEBUG) console.log(`[Preview] Built fallback preview URL: ${urlPath}`);
    return urlPath;
}

/**
 * Build file system path from URL components
 */
export function buildFilePath(
    filesDir: string,
    year: string,
    month: string,
    day: string,
    random: string,
    subdir: string,
    file: string,
): string {
    return path.join(filesDir, year, month, day, random, subdir, file);
}

/**
 * Build fallback file path (checks /tmp subdirectory)
 */
export function buildFallbackFilePath(
    filesDir: string,
    year: string,
    month: string,
    day: string,
    random: string,
    subdir: string,
    file: string,
): string {
    return path.join(filesDir, 'tmp', year, month, day, random, subdir, file);
}

/**
 * Get MIME type for a file
 * @param filePath - File path
 * @returns MIME type string
 */
export function getMimeType(filePath: string): string {
    const detectedMimeType = mime.lookup(filePath);
    return detectedMimeType || 'application/octet-stream';
}

/**
 * Validate that parameters are safe and correctly formatted
 * @param year - Year (must be 4 digits)
 * @param month - Month (must be 2 digits)
 * @param day - Day (must be 2 digits)
 * @returns true if valid, false otherwise
 */
export function validateUrlParams(year: string, month: string, day: string): boolean {
    // Validate year (4 digits)
    if (!/^\d{4}$/.test(year)) {
        if (DEBUG) console.warn(`[Preview] Invalid year format: ${year}`);
        return false;
    }

    // Validate month (2 digits)
    if (!/^\d{2}$/.test(month)) {
        if (DEBUG) console.warn(`[Preview] Invalid month format: ${month}`);
        return false;
    }

    // Validate day (2 digits)
    if (!/^\d{2}$/.test(day)) {
        if (DEBUG) console.warn(`[Preview] Invalid day format: ${day}`);
        return false;
    }

    return true;
}

/**
 * Session path components
 */
export interface SessionPathComponents {
    year?: string;
    month?: string;
    day?: string;
    sessionId: string;
    isFallback?: boolean;
}

/**
 * Extract session path components for preview URL building
 * @param sessionPath - Session directory path
 * @returns Object with year, month, day, sessionId
 */
export function extractSessionPathComponents(sessionPath: string): SessionPathComponents | null {
    // Normalize path separators for cross-platform compatibility
    const normalizedPath = sessionPath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
    const len = pathParts.length;

    // Check for standard date-based structure
    if (len >= 4) {
        const sessionId = pathParts[len - 1];
        const day = pathParts[len - 2];
        const month = pathParts[len - 3];
        const year = pathParts[len - 4];

        // If valid date structure
        if (validateUrlParams(year, month, day)) {
            return { year, month, day, sessionId };
        }
    }

    // Check for fallback structure: .../tmp/sessionId
    if (len >= 2) {
        const sessionId = pathParts[len - 1];
        const parentDir = pathParts[len - 2];

        if (parentDir === 'tmp') {
            return { sessionId, isFallback: true };
        }
    }

    console.error(`[Preview] Invalid session path format: ${sessionPath}`);
    return null;
}
