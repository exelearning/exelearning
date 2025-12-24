/**
 * Custom exceptions for Elysia
 * Migrated from NestJS HttpExceptionFilter
 */

// HTTP status texts
const STATUS_TEXTS: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
};

export function getStatusText(code: number): string {
    return STATUS_TEXTS[code] || 'Error';
}

/**
 * HTTP Exception with status code
 */
export class HttpException extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 500,
    ) {
        super(message);
        this.name = 'HttpException';
    }
}

/**
 * Base exception with i18n support
 */
export class TranslatableException extends Error {
    constructor(
        public readonly translationKey: string,
        public readonly statusCode: number = 400,
        public readonly parameters: Record<string, string | number> = {},
    ) {
        super(translationKey);
        this.name = 'TranslatableException';
    }
}

// --- Logical Exceptions ---

/**
 * Thrown when autosave is attempted but a recent save already exists
 */
export class AutosaveRecentSaveException extends TranslatableException {
    constructor() {
        super('error.autosave_recent_save', 400);
    }
}

/**
 * Thrown when a user already has an open session
 */
export class UserAlreadyOpenSessionException extends TranslatableException {
    constructor() {
        super('error.session_already_open', 409);
    }
}

/**
 * Thrown when user doesn't have enough storage space
 */
export class UserInsufficientSpaceException extends TranslatableException {
    constructor(
        public readonly usedSpace: number,
        public readonly maxSpace: number,
        public readonly requiredSpace: number,
        public readonly availableSpace: number,
    ) {
        super('error.insufficient_space', 400, {
            usedSpace: formatBytes(usedSpace),
            maxSpace: formatBytes(maxSpace),
            requiredSpace: formatBytes(requiredSpace),
            availableSpace: formatBytes(availableSpace),
        });
    }
}

/**
 * Thrown when a required extension is not installed
 */
export class ExtensionNotInstalledException extends TranslatableException {
    constructor(public readonly extension: string) {
        super('error.extension_not_installed', 500, { extension });
    }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}
