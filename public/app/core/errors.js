/**
 * Application Error Types
 * Structured errors for better error handling across the application.
 */

/**
 * Base application error.
 */
export class AppError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} code - Error code for programmatic handling
     */
    constructor(message, code = 'APP_ERROR') {
        super(message);
        this.name = 'AppError';
        this.code = code;
    }
}

/**
 * Network-related errors (HTTP failures, timeouts, etc.)
 */
export class NetworkError extends AppError {
    /**
     * @param {string} message - Error message
     * @param {number} [statusCode] - HTTP status code
     * @param {Object} [response] - Response data
     */
    constructor(message, statusCode = null, response = null) {
        super(message, 'NETWORK_ERROR');
        this.name = 'NetworkError';
        this.statusCode = statusCode;
        this.response = response;
    }

    /**
     * Check if error is a client error (4xx).
     * @returns {boolean}
     */
    isClientError() {
        return this.statusCode >= 400 && this.statusCode < 500;
    }

    /**
     * Check if error is a server error (5xx).
     * @returns {boolean}
     */
    isServerError() {
        return this.statusCode >= 500 && this.statusCode < 600;
    }
}

/**
 * Feature not available in current mode.
 */
export class FeatureDisabledError extends AppError {
    /**
     * @param {string} feature - Feature name
     */
    constructor(feature) {
        super(`Feature "${feature}" is not available in this mode`, 'FEATURE_DISABLED');
        this.name = 'FeatureDisabledError';
        this.feature = feature;
    }
}

/**
 * Storage-related errors (IndexedDB, file system, etc.)
 */
export class StorageError extends AppError {
    /**
     * @param {string} message - Error message
     * @param {Error} [cause] - Original error
     */
    constructor(message, cause = null) {
        super(message, 'STORAGE_ERROR');
        this.name = 'StorageError';
        this.cause = cause;
    }
}

/**
 * Validation errors for user input.
 */
export class ValidationError extends AppError {
    /**
     * @param {string} message - Error message
     * @param {Object} [fields] - Field-specific errors
     */
    constructor(message, fields = {}) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.fields = fields;
    }
}

/**
 * Authentication/authorization errors.
 */
export class AuthError extends AppError {
    /**
     * @param {string} message - Error message
     * @param {boolean} [requiresLogin] - Whether user needs to log in
     */
    constructor(message, requiresLogin = false) {
        super(message, 'AUTH_ERROR');
        this.name = 'AuthError';
        this.requiresLogin = requiresLogin;
    }
}

/**
 * Resource not found errors.
 */
export class NotFoundError extends AppError {
    /**
     * @param {string} resourceType - Type of resource (project, asset, etc.)
     * @param {string} resourceId - Resource identifier
     */
    constructor(resourceType, resourceId) {
        super(`${resourceType} "${resourceId}" not found`, 'NOT_FOUND');
        this.name = 'NotFoundError';
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

export default {
    AppError,
    NetworkError,
    FeatureDisabledError,
    StorageError,
    ValidationError,
    AuthError,
    NotFoundError,
};
