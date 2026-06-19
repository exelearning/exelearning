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
import { isIP } from 'node:net';
import { isBlockedAddress } from './ssrf-guard';

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
 * Check if a URL belongs to a configured provider.
 *
 * This is an allow-list, so it FAILS CLOSED: when no providers are configured
 * (the shipped default), nothing is allowed. The previous behavior returned
 * `true` for any URL when PROVIDER_URLS was empty, which — combined with the
 * server deriving its callback target from the attacker-controlled JWT
 * `returnurl` — let a holder of a valid platform JWT drive the server to fetch
 * arbitrary internal hosts (SSRF). Deploying platform integration now requires
 * an explicit PROVIDER_URLS allow-list.
 *
 * @param url - The URL to validate
 * @returns true if URL is from an allowed provider, false otherwise
 */
export function isAllowedProviderUrl(url: string): boolean {
    const config = getProviderConfig();

    // No providers configured => empty allow-list => nothing is allowed.
    if (config.urls.length === 0) {
        return false;
    }

    if (!url) {
        return false;
    }

    return config.urls.some(allowedUrl => url.startsWith(allowedUrl));
}

/**
 * Synchronous guard for a platform return URL used to derive a server-side
 * request target (see {@link buildIntegrationUrl} and platform callbacks).
 *
 * Rejects:
 *   - URLs that do not parse,
 *   - schemes other than http(s) (e.g. file:, gopher:, ftp:),
 *   - hosts that are IP literals flagged by {@link isBlockedAddress}
 *     (loopback / private / link-local — including cloud metadata
 *     169.254.169.254 — CGNAT, multicast, reserved, unspecified).
 *
 * This is intentionally synchronous and does NOT perform DNS resolution, so it
 * can run inside the synchronous URL-building path. The allow-list check in
 * {@link isAllowedProviderUrl} is the primary control; this is defense in depth
 * against an attacker-supplied IP-literal returnurl. For full DNS-aware egress
 * filtering (including DNS rebinding), the outbound request should additionally
 * go through `assertUrlAllowed` / `safeFetch` from `./ssrf-guard`.
 *
 * @param url - The return URL from the JWT payload
 * @returns true if the URL is safe to use as a request target, false otherwise
 */
export function isSafeReturnUrl(url: string): boolean {
    if (!url) {
        return false;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }

    // url.hostname keeps brackets for IPv6 literals; strip them for the IP check.
    const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!host) {
        return false;
    }

    // If the host is an IP literal, reject blocked ranges synchronously.
    // Hostnames are left to the allow-list (and DNS-aware guard at fetch time).
    if (isIP(host) !== 0 && isBlockedAddress(host)) {
        return false;
    }

    return true;
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

    // Reject obviously-unsafe return URLs (non-http(s) scheme, internal IP
    // literal) before they can become a server-side request target (SSRF).
    if (!isSafeReturnUrl(payload.returnurl)) {
        console.warn(`[PlatformJWT] Unsafe return URL rejected: ${payload.returnurl}`);
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

// Tracks whether the "PROVIDER_URLS empty" startup warning has been emitted, so
// it is logged at most once per process (avoids spamming on every callback).
let providerUrlWarningEmitted = false;

/**
 * Reset the one-time PROVIDER_URLS warning flag. Exposed for tests so each case
 * can assert the warn path in isolation. Not used in production code.
 */
export function resetProviderUrlWarning(): void {
    providerUrlWarningEmitted = false;
}

/**
 * Emit a one-time startup warning when platform integration is *intended*
 * (PROVIDER_TOKENS or PROVIDER_IDS are set) but PROVIDER_URLS is empty.
 *
 * Since {@link isAllowedProviderUrl} now fails CLOSED on an empty allow-list,
 * an operator who configures provider tokens/ids but forgets PROVIDER_URLS will
 * have every platform callback silently rejected with no obvious cause. This
 * surfaces that misconfiguration loudly at startup. Call it once during server
 * bootstrap (see `src/index.ts`).
 *
 * @returns true if a warning was emitted on this call, false otherwise (already
 *          warned, or configuration does not match the misconfigured shape).
 */
export function warnIfProviderUrlsMissing(): boolean {
    if (providerUrlWarningEmitted) {
        return false;
    }

    const config = getProviderConfig();
    const integrationConfigured = config.tokens.length > 0 || config.ids.length > 0;

    if (integrationConfigured && config.urls.length === 0) {
        providerUrlWarningEmitted = true;
        console.warn(
            '[PlatformJWT] Platform integration is configured (PROVIDER_TOKENS/PROVIDER_IDS set) ' +
                'but PROVIDER_URLS is empty. isAllowedProviderUrl now fails closed, so every ' +
                'platform callback will be rejected. Set PROVIDER_URLS to an explicit allow-list ' +
                'of provider base URLs to enable platform integration.',
        );
        return true;
    }

    return false;
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
