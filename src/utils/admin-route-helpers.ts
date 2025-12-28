/**
 * Admin Route Helpers
 * Shared utilities for admin CRUD routes
 */
import * as fs from 'fs-extra';

// ============================================================================
// HTTP STATUS HELPERS
// ============================================================================

const STATUS_TEXT: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
};

/**
 * Create a standardized error response object
 */
export function createErrorResponse(status: number, message: string) {
    return {
        error: STATUS_TEXT[status] || 'Error',
        message,
    };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Parse and validate an integer ID from route params
 * Returns the parsed ID or null if invalid
 */
export function parseIntegerId(id: string): number | null {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Validate a required file upload
 * Returns error response object if invalid, null if valid
 */
export function validateFileUpload(file: unknown): { status: number; response: object } | null {
    if (!file) {
        return {
            status: 400,
            response: createErrorResponse(400, 'No file uploaded'),
        };
    }
    return null;
}

// ============================================================================
// FILE SYSTEM HELPERS
// ============================================================================

/**
 * Safely delete a file if it exists
 * Silently ignores errors (file not found, permission issues)
 */
export async function deleteFileIfExists(filePath: string): Promise<void> {
    try {
        await fs.remove(filePath);
    } catch {
        // Silently ignore deletion errors
    }
}

/**
 * Check if a file exists at the given path
 */
export async function fileExists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Get the files directory from environment variables
 */
export function getFilesDir(): string {
    return process.env.ELYSIA_FILES_DIR || process.env.FILES_DIR || '/mnt/data';
}

/**
 * Get the JWT secret from environment variables
 */
export function getJwtSecret(): string {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
}
