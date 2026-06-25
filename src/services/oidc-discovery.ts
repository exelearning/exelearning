/**
 * OpenID Connect Discovery resolver.
 *
 * Wires `OIDC_ISSUER` into the runtime OIDC configuration. When an issuer is
 * configured the resolver fetches the provider metadata from
 * `${issuer}/.well-known/openid-configuration` (OpenID Connect Discovery 1.0)
 * and uses it to fill any endpoint that was not configured explicitly.
 *
 * Precedence rules:
 *   - Explicit endpoint configuration always wins; discovery never overrides it.
 *   - Discovery only fills missing endpoint values.
 *   - An empty issuer disables discovery entirely.
 *   - If discovery fails, the explicitly configured endpoints are used as-is and
 *     the caller's existing "endpoint missing" checks take over. The resolver is
 *     deliberately tolerant so a transient provider outage never blocks logins
 *     that already have every endpoint configured explicitly.
 *
 * Security:
 *   - Discovery requires HTTPS, except for local development issuers
 *     (`localhost`, `127.0.0.1`, `[::1]`).
 *   - The discovered `issuer` must match the configured issuer (ignoring a
 *     trailing slash); mismatches are rejected.
 *   - Malformed, non-200, or incomplete discovery documents are rejected.
 *   - The discovery request uses a short timeout so it cannot stall logins.
 */

/** Subset of the OIDC provider metadata we consume. */
export interface OidcDiscoveryMetadata {
    issuer: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
    end_session_endpoint?: string;
    /**
     * URL of the provider's JSON Web Key Set. Used to verify the id_token
     * signature without operators having to configure `OIDC_JWKS_URI` by hand.
     */
    jwks_uri?: string;
}

/** Explicitly configured OIDC endpoints (already resolved from settings/env). */
export interface OidcEndpointConfig {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    endSessionEndpoint: string;
    /** Explicit JWKS URI (`OIDC_JWKS_URI`); discovery fills it when blank. */
    jwksUri?: string;
}

/** Effective OIDC endpoints after merging explicit config with discovery. */
export interface ResolvedOidcEndpoints {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    endSessionEndpoint: string;
    /** JWKS URI used to verify id_token signatures (explicit or discovered). */
    jwksUri: string;
}

export interface OidcDiscoveryOptions {
    /** Injectable fetch implementation (defaults to the global `fetch`). */
    fetch?: typeof fetch;
    /** Request timeout in milliseconds (defaults to {@link DEFAULT_TIMEOUT_MS}). */
    timeoutMs?: number;
}

/** Short timeout so discovery never stalls authentication startup or login. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Default time-to-live for cached discovery metadata. Endpoints and signing
 * keys rotate over time, so a cached document must eventually be re-fetched.
 * One hour balances avoiding a per-login round-trip against picking up rotated
 * endpoints in a reasonable window.
 */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

let cacheTtlMs = DEFAULT_CACHE_TTL_MS;

interface CacheEntry {
    metadata: OidcDiscoveryMetadata;
    /** Epoch milliseconds after which this entry must be re-fetched. */
    expiresAt: number;
}

/** In-memory cache of validated discovery metadata, keyed by normalized issuer. */
const metadataCache = new Map<string, CacheEntry>();

/** Clear the discovery cache. Primarily for tests. */
export function resetOidcDiscoveryCache(): void {
    metadataCache.clear();
}

/**
 * Override the discovery cache TTL. Intended for tests so expiry can be
 * exercised without waiting an hour. Passing `undefined` restores the default.
 */
export function setOidcDiscoveryCacheTtlForTesting(ttlMs: number | undefined): void {
    cacheTtlMs = ttlMs ?? DEFAULT_CACHE_TTL_MS;
}

/** Trim whitespace and strip trailing slashes so issuers compare consistently. */
export function normalizeIssuer(issuer: string): string {
    return issuer.trim().replace(/\/+$/, '');
}

/**
 * Discovery must use HTTPS, except for clearly local development issuers where
 * plain HTTP is the norm (a developer running an IdP on their machine).
 */
function isHttpsOrLocalhost(issuer: string): boolean {
    let url: URL;
    try {
        url = new URL(issuer);
    } catch {
        return false;
    }
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') {
        const host = url.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    }
    return false;
}

/**
 * Fetch and validate the OIDC provider metadata for an issuer. Results are
 * cached per normalized issuer. Throws on any validation or transport error.
 */
export async function discoverOidcMetadata(
    issuer: string,
    options: OidcDiscoveryOptions = {},
): Promise<OidcDiscoveryMetadata> {
    const normalized = normalizeIssuer(issuer);
    if (!normalized) {
        throw new Error('OIDC discovery requires a non-empty OIDC_ISSUER.');
    }

    const cached = metadataCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.metadata;
    if (cached) metadataCache.delete(normalized);

    if (!isHttpsOrLocalhost(normalized)) {
        throw new Error(
            `OIDC discovery requires an HTTPS issuer (got "${issuer}"). ` +
                'Plain HTTP is only allowed for local development issuers (localhost, 127.0.0.1, [::1]).',
        );
    }

    const fetchImpl = options.fetch ?? fetch;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const discoveryUrl = `${normalized}/.well-known/openid-configuration`;

    const response = await fetchImpl(discoveryUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
        throw new Error(`OIDC discovery for "${issuer}" returned HTTP ${response.status}.`);
    }

    let doc: OidcDiscoveryMetadata;
    try {
        doc = (await response.json()) as OidcDiscoveryMetadata;
    } catch (cause) {
        throw new Error(`OIDC discovery document for "${issuer}" is not valid JSON.`, { cause });
    }

    if (!doc || typeof doc.issuer !== 'string' || doc.issuer.trim() === '') {
        throw new Error(`OIDC discovery document for "${issuer}" is missing the "issuer" field.`);
    }
    if (normalizeIssuer(doc.issuer) !== normalized) {
        throw new Error(
            `OIDC discovery issuer mismatch: configured "${normalized}" but provider returned "${doc.issuer}".`,
        );
    }
    if (typeof doc.authorization_endpoint !== 'string' || doc.authorization_endpoint.trim() === '') {
        throw new Error(`OIDC discovery document for "${issuer}" is missing "authorization_endpoint".`);
    }
    if (typeof doc.token_endpoint !== 'string' || doc.token_endpoint.trim() === '') {
        throw new Error(`OIDC discovery document for "${issuer}" is missing "token_endpoint".`);
    }

    metadataCache.set(normalized, { metadata: doc, expiresAt: Date.now() + cacheTtlMs });
    return doc;
}

/**
 * Merge explicit endpoint configuration with values discovered from the issuer.
 * Explicit values always win; discovery only fills the gaps. Discovery is
 * skipped when the issuer is empty or every endpoint is already explicit, and a
 * discovery failure degrades gracefully to the explicit configuration.
 */
export async function resolveOidcEndpoints(
    config: OidcEndpointConfig,
    options: OidcDiscoveryOptions = {},
): Promise<ResolvedOidcEndpoints> {
    const resolved: ResolvedOidcEndpoints = {
        authorizationEndpoint: config.authorizationEndpoint,
        tokenEndpoint: config.tokenEndpoint,
        userinfoEndpoint: config.userinfoEndpoint,
        endSessionEndpoint: config.endSessionEndpoint,
        jwksUri: config.jwksUri ?? '',
    };

    const issuer = normalizeIssuer(config.issuer);
    if (!issuer) return resolved;

    // `end_session_endpoint` is optional in OIDC (e.g. Google does not publish
    // it). Its absence alone must NOT cost a discovery round-trip on every
    // login — only a genuinely required endpoint left blank justifies one.
    const needsDiscovery =
        !resolved.authorizationEndpoint || !resolved.tokenEndpoint || !resolved.userinfoEndpoint || !resolved.jwksUri;
    if (!needsDiscovery) return resolved;

    try {
        const meta = await discoverOidcMetadata(issuer, options);
        if (!resolved.authorizationEndpoint && meta.authorization_endpoint) {
            resolved.authorizationEndpoint = meta.authorization_endpoint;
        }
        if (!resolved.tokenEndpoint && meta.token_endpoint) {
            resolved.tokenEndpoint = meta.token_endpoint;
        }
        if (!resolved.userinfoEndpoint && meta.userinfo_endpoint) {
            resolved.userinfoEndpoint = meta.userinfo_endpoint;
        }
        if (!resolved.endSessionEndpoint && meta.end_session_endpoint) {
            resolved.endSessionEndpoint = meta.end_session_endpoint;
        }
        if (!resolved.jwksUri && meta.jwks_uri) {
            resolved.jwksUri = meta.jwks_uri;
        }
    } catch (error) {
        console.warn(
            `[oidc] Discovery from issuer "${issuer}" failed; falling back to explicitly configured endpoints.`,
            error instanceof Error ? error.message : error,
        );
    }

    return resolved;
}
