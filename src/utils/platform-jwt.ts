/**
 * Platform JWT Utilities
 *
 * Handles JWT tokens from external platforms (Moodle, Moodle Workplace, etc.)
 *
 * NOTE: Platform JWT is DIFFERENT from internal auth JWT:
 * - Internal JWT: signed with API_JWT_SECRET, payload {sub, email, roles}
 * - Platform JWT: signed with APP_SECRET or PROVIDER_TOKENS[i], payload {userid, cmid, returnurl, pkgtype}
 */
import { jwtVerify } from 'jose';

/**
 * Payload structure for platform JWT tokens
 */
export interface PlatformJWTPayload {
    userid: string; // User ID in the platform (e.g., Moodle user ID)
    cmid: string; // Course module ID in Moodle
    returnurl: string; // URL to redirect user back to platform
    pkgtype: 'scorm' | 'webzip'; // Package type for export
    exportType?: string; // Optional explicit export type
    provider_id?: string; // Provider identifier
    provider?: { name?: string }; // Legacy format provider object
    exp: number; // Expiration timestamp
    iat: number; // Issued at timestamp
    nbf?: number; // Not before timestamp
}

/**
 * Provider configuration structure
 */
export interface ProviderConfig {
    urls: string[];
    tokens: string[];
    ids: string[];
}

/**
 * Integration parameters with enriched platform data
 */
export interface PlatformIntegrationParams extends PlatformJWTPayload {
    platformIntegrationUrl?: string;
}

// JWT algorithm used for platform tokens (HS256 = HMAC-SHA256)
const JWT_ALGORITHM = 'HS256';

/**
 * Parse comma-separated environment variable into array
 */
function parseEnvArray(envValue: string | undefined): string[] {
    if (!envValue || envValue.trim() === '') {
        return [];
    }
    return envValue.split(',').map(s => s.trim());
}

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfig(): ProviderConfig {
    return {
        urls: parseEnvArray(process.env.PROVIDER_URLS),
        tokens: parseEnvArray(process.env.PROVIDER_TOKENS),
        ids: parseEnvArray(process.env.PROVIDER_IDS),
    };
}

/**
 * Get the secret for a specific provider or fallback to APP_SECRET
 * @param providerId - Optional provider ID to look up specific token
 * @returns The secret string to use for JWT verification
 */
export function getProviderSecret(providerId?: string): string {
    if (providerId) {
        const config = getProviderConfig();

        // Remove '_legacy' suffix if present (for backwards compatibility)
        const normalizedId = providerId.endsWith('_legacy') ? providerId.slice(0, -7) : providerId;

        const index = config.ids.indexOf(normalizedId);
        if (index !== -1 && config.tokens[index]) {
            return config.tokens[index];
        }
    }

    // Fallback to APP_SECRET
    return process.env.APP_SECRET || '';
}

/**
 * Check if a provider ID is valid (configured in environment)
 * @param providerId - The provider ID to validate
 * @returns true if provider is configured, false otherwise
 */
export function isValidProvider(providerId: string): boolean {
    const config = getProviderConfig();

    // If no providers configured, allow all
    if (config.ids.length === 0) {
        return true;
    }

    // Remove '_legacy' suffix if present
    const normalizedId = providerId.endsWith('_legacy') ? providerId.slice(0, -7) : providerId;

    return config.ids.includes(normalizedId);
}

/**
 * Check if a URL belongs to a configured provider
 * @param url - The URL to validate
 * @returns true if URL is from an allowed provider, false otherwise
 */
export function isAllowedProviderUrl(url: string): boolean {
    const config = getProviderConfig();

    // If no providers configured, allow all
    if (config.urls.length === 0) {
        return true;
    }

    if (!url) {
        return false;
    }

    return config.urls.some(allowedUrl => url.startsWith(allowedUrl));
}

/**
 * Extract provider ID from JWT payload, supporting both legacy and new formats
 * @param payload - The decoded JWT payload
 * @returns Provider ID or null if not found
 */
export function extractProviderId(payload: PlatformJWTPayload): string | null {
    // New format: direct provider_id field
    if (payload.provider_id) {
        return payload.provider_id;
    }

    // Legacy format: provider object with name
    if (payload.provider?.name) {
        const providerName = payload.provider.name.toLowerCase();
        return `${providerName}_legacy`;
    }

    return null;
}

/**
 * Decode and verify a platform JWT token
 * @param token - The JWT token string
 * @param providerId - Optional provider ID for specific token validation
 * @returns Decoded payload or null on failure
 */
export async function decodePlatformJWT(token: string, providerId?: string): Promise<PlatformJWTPayload | null> {
    try {
        const secret = getProviderSecret(providerId);

        if (!secret) {
            console.error('[PlatformJWT] No secret available for JWT verification');
            return null;
        }

        const secretKey = new TextEncoder().encode(secret);

        const { payload } = await jwtVerify(token, secretKey, {
            algorithms: [JWT_ALGORITHM],
        });

        // Cast to our expected payload type
        const platformPayload = payload as unknown as PlatformJWTPayload;

        // Validate required fields
        if (!platformPayload.returnurl) {
            console.error('[PlatformJWT] Missing required field: returnurl');
            return null;
        }

        return platformPayload;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[PlatformJWT] JWT decode error:', message);
        return null;
    }
}

/**
 * Build platform integration URL based on return URL patterns
 * @param returnUrl - The return URL from JWT
 * @param operation - 'set' for uploading to platform, 'get' for downloading from platform
 * @returns The integration endpoint URL or null if pattern not matched
 */
export function buildIntegrationUrl(returnUrl: string, operation: 'set' | 'get'): string | null {
    const op = operation === 'set' ? 's' : 'g';

    // SCORM module patterns
    if (returnUrl.includes('/mod/exescorm')) {
        const baseUrl = returnUrl.split('/mod/exescorm')[0];
        return `${baseUrl}/mod/exescorm/${op}et_ode.php`;
    }

    if (returnUrl.includes('/course/section')) {
        const baseUrl = returnUrl.split('/course/section')[0];
        return `${baseUrl}/mod/exescorm/${op}et_ode.php`;
    }

    // Web/HTML5 module pattern
    if (returnUrl.includes('/mod/exeweb')) {
        const baseUrl = returnUrl.split('/mod/exeweb')[0];
        return `${baseUrl}/mod/exeweb/${op}et_ode.php`;
    }

    return null;
}

/**
 * Get integration parameters from JWT token with enriched platform data
 * @param jwtToken - The JWT token string
 * @param operation - 'set' for uploading, 'get' for downloading
 * @returns Integration parameters or null on failure
 */
export async function getPlatformIntegrationParams(
    jwtToken: string,
    operation: 'set' | 'get',
): Promise<PlatformIntegrationParams | null> {
    const payload = await decodePlatformJWT(jwtToken);
    if (!payload) {
        return null;
    }

    // Extract and validate provider
    const providerId = extractProviderId(payload);
    if (providerId && !isValidProvider(providerId)) {
        console.warn(`[PlatformJWT] Invalid provider ID in JWT: ${providerId}`);
        return null;
    }

    // Validate return URL against allowed providers
    if (!isAllowedProviderUrl(payload.returnurl)) {
        console.warn(`[PlatformJWT] Return URL not in allowed providers: ${payload.returnurl}`);
        return null;
    }

    // Build platform integration URL
    const platformIntegrationUrl = buildIntegrationUrl(payload.returnurl, operation);

    return {
        ...payload,
        platformIntegrationUrl: platformIntegrationUrl || undefined,
    };
}

/**
 * Map package type from JWT to export type
 * @param pkgtype - The package type from JWT (scorm or webzip)
 * @returns The export type constant
 */
export function getExportTypeFromPkgType(pkgtype: string): 'scorm12' | 'html5' {
    switch (pkgtype) {
        case 'scorm':
            return 'scorm12';
        case 'webzip':
            return 'html5';
        default:
            // Default to SCORM if unknown
            return 'scorm12';
    }
}

/**
 * Validate provider configuration consistency
 * @returns Array of error messages, empty if configuration is valid
 */
export function validateProviderConfiguration(): string[] {
    const config = getProviderConfig();
    const errors: string[] = [];

    const urlCount = config.urls.length;
    const tokenCount = config.tokens.length;
    const idCount = config.ids.length;

    if (urlCount !== tokenCount || urlCount !== idCount) {
        errors.push(`Provider configuration mismatch: URLs(${urlCount}), Tokens(${tokenCount}), IDs(${idCount})`);
    }

    // Check for duplicate IDs
    const uniqueIds = new Set(config.ids);
    if (uniqueIds.size !== config.ids.length) {
        errors.push('Duplicate provider IDs found');
    }

    return errors;
}
