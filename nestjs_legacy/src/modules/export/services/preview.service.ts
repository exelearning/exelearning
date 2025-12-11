import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as mime from 'mime-types';

/**
 * Preview Service Helper
 * Handles preview-specific operations like temp path generation,
 * URL building, and MIME type detection
 */
@Injectable()
export class PreviewService {
    private readonly logger = new Logger(PreviewService.name);

    /**
     * Generate random temp path for preview isolation
     * @returns Random hex string (6 characters) with trailing slash
     * @example "a3f5d2/"
     */
    generateRandomTempPath(): string {
        // Generate 3 random bytes and convert to hex (6 characters)
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
    buildPreviewUrl(sessionId: string, tempPath: string, filePath: string): string {
        // Check if session ID matches date pattern YYYYMMDD...
        if (/^\d{8}/.test(sessionId)) {
            const year = sessionId.substring(0, 4);
            const month = sessionId.substring(4, 6);
            const day = sessionId.substring(6, 8);
            const urlPath = `/files/tmp/${year}/${month}/${day}/${sessionId}/export/${tempPath}${filePath}`;
            this.logger.debug(`Built date-based preview URL: ${urlPath}`);
            return urlPath;
        }

        // Fallback URL for non-date session IDs
        const urlPath = `/files/tmp/${sessionId}/export/${tempPath}${filePath}`;
        this.logger.debug(`Built fallback preview URL: ${urlPath}`);
        return urlPath;
    }

    /**
     * Build file system path from URL components
     * @param filesDir - Base files directory
     * @param year - Year (4 digits)
     * @param month - Month (2 digits)
     * @param day - Day (2 digits)
     * @param random - Random part of session ID
     * @param subdir - Subdirectory (temp path)
     * @param file - File name
     * @returns Absolute file path
     */
    buildFilePath(
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
     * @param filesDir - Base files directory
     * @param year - Year
     * @param month - Month
     * @param day - Day
     * @param random - Random part
     * @param subdir - Subdirectory
     * @param file - File name
     * @returns Fallback absolute file path
     */
    buildFallbackFilePath(
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
    getMimeType(filePath: string): string {
        const detectedMimeType = mime.lookup(filePath);

        if (detectedMimeType) {
            return detectedMimeType;
        }

        // Default fallback
        return 'application/octet-stream';
    }

    /**
     * Validate that parameters are safe and correctly formatted
     * @param year - Year (must be 4 digits)
     * @param month - Month (must be 2 digits)
     * @param day - Day (must be 2 digits)
     * @returns true if valid, false otherwise
     */
    validateUrlParams(year: string, month: string, day: string): boolean {
        // Validate year (4 digits)
        if (!/^\d{4}$/.test(year)) {
            this.logger.warn(`Invalid year format: ${year}`);
            return false;
        }

        // Validate month (2 digits)
        if (!/^\d{2}$/.test(month)) {
            this.logger.warn(`Invalid month format: ${month}`);
            return false;
        }

        // Validate day (2 digits)
        if (!/^\d{2}$/.test(day)) {
            this.logger.warn(`Invalid day format: ${day}`);
            return false;
        }

        return true;
    }

    /**
     * Extract session path components for preview URL building
     * @param sessionPath - Session directory path
     * @returns Object with year, month, day, sessionId
     */
    extractSessionPathComponents(sessionPath: string): {
        year?: string;
        month?: string;
        day?: string;
        sessionId: string;
        isFallback?: boolean;
    } | null {
        // Extract components from path like: /path/to/files/2025/01/16/20250116abc123
        // Normalize path separators for cross-platform compatibility (Windows uses \, Unix uses /)
        const normalizedPath = sessionPath.replace(/\\/g, '/');
        const pathParts = normalizedPath.split('/').filter((part) => part.length > 0);
        const len = pathParts.length;

        // Check for standard date-based structure
        if (len >= 4) {
            const sessionId = pathParts[len - 1];
            const day = pathParts[len - 2];
            const month = pathParts[len - 3];
            const year = pathParts[len - 4];

            // If valid date structure
            if (this.validateUrlParams(year, month, day)) {
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

        this.logger.error(`Invalid session path format: ${sessionPath}`);
        return null;
    }
}
