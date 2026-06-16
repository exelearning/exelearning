/**
 * Tests for the OIDC Discovery resolver.
 *
 * The resolver wires `OIDC_ISSUER` into the runtime configuration: when an
 * issuer is configured it fetches the provider metadata from
 * `${issuer}/.well-known/openid-configuration` and fills only the endpoint
 * values that were not configured explicitly. Explicit configuration always
 * wins; discovery never overrides it.
 */
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import {
    discoverOidcMetadata,
    resolveOidcEndpoints,
    resetOidcDiscoveryCache,
    normalizeIssuer,
    setOidcDiscoveryCacheTtlForTesting,
    type OidcDiscoveryMetadata,
} from './oidc-discovery';

const ISSUER = 'https://idp.example.com';

function metadataDoc(overrides: Partial<OidcDiscoveryMetadata> = {}): OidcDiscoveryMetadata {
    return {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        end_session_endpoint: `${ISSUER}/logout`,
        jwks_uri: `${ISSUER}/jwks`,
        ...overrides,
    };
}

/** Build a mock fetch that returns the given JSON body with status 200. */
function jsonFetch(body: unknown, status = 200) {
    return mock(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    })) as unknown as typeof fetch;
}

describe('normalizeIssuer', () => {
    it('strips a single trailing slash', () => {
        expect(normalizeIssuer('https://idp.example.com/')).toBe('https://idp.example.com');
    });

    it('strips multiple trailing slashes', () => {
        expect(normalizeIssuer('https://idp.example.com///')).toBe('https://idp.example.com');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeIssuer('  https://idp.example.com/  ')).toBe('https://idp.example.com');
    });

    it('preserves issuers that carry a path (Keycloak realms)', () => {
        expect(normalizeIssuer('https://kc.example.com/realms/main/')).toBe('https://kc.example.com/realms/main');
    });
});

describe('discoverOidcMetadata', () => {
    beforeEach(() => resetOidcDiscoveryCache());

    it('fetches the well-known document and returns the metadata', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const meta = await discoverOidcMetadata(ISSUER, { fetch: fetchMock });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const calledUrl = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls[0][0];
        expect(calledUrl).toBe(`${ISSUER}/.well-known/openid-configuration`);
        expect(meta.authorization_endpoint).toBe(`${ISSUER}/authorize`);
        expect(meta.token_endpoint).toBe(`${ISSUER}/token`);
    });

    it('appends the well-known path after the issuer path for Keycloak-style issuers', async () => {
        const issuer = 'https://kc.example.com/realms/main';
        const fetchMock = jsonFetch(metadataDoc({ issuer }));
        await discoverOidcMetadata(issuer, { fetch: fetchMock });
        const calledUrl = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls[0][0];
        expect(calledUrl).toBe(`${issuer}/.well-known/openid-configuration`);
    });

    it('caches metadata per issuer (fetches once for repeated calls)', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fetches separately for different issuers', async () => {
        const fetchMock = jsonFetch(metadataDoc({ issuer: 'https://a.example.com' }));
        await discoverOidcMetadata('https://a.example.com', { fetch: fetchMock });
        const fetchMock2 = jsonFetch(metadataDoc({ issuer: 'https://b.example.com' }));
        await discoverOidcMetadata('https://b.example.com', { fetch: fetchMock2 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock2).toHaveBeenCalledTimes(1);
    });

    it('accepts a discovered issuer that differs only by a trailing slash', async () => {
        const fetchMock = jsonFetch(metadataDoc({ issuer: `${ISSUER}/` }));
        const meta = await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(meta.token_endpoint).toBe(`${ISSUER}/token`);
    });

    it('rejects metadata whose issuer does not match the configured issuer', async () => {
        const fetchMock = jsonFetch(metadataDoc({ issuer: 'https://evil.example.com' }));
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow(/issuer/i);
    });

    it('rejects a non-200 response', async () => {
        const fetchMock = jsonFetch({}, 404);
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow();
    });

    it('rejects a malformed (non-JSON) discovery document', async () => {
        const fetchMock = mock(async () => ({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('Unexpected token');
            },
        })) as unknown as typeof fetch;
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow();
    });

    it('rejects a document missing authorization_endpoint', async () => {
        const doc = metadataDoc();
        delete (doc as Record<string, unknown>).authorization_endpoint;
        const fetchMock = jsonFetch(doc);
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow(/authorization_endpoint/i);
    });

    it('rejects a document missing token_endpoint', async () => {
        const doc = metadataDoc();
        delete (doc as Record<string, unknown>).token_endpoint;
        const fetchMock = jsonFetch(doc);
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow(/token_endpoint/i);
    });

    it('rejects a document missing the issuer field', async () => {
        const doc = metadataDoc();
        delete (doc as Record<string, unknown>).issuer;
        const fetchMock = jsonFetch(doc);
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow(/issuer/i);
    });

    it('accepts an HTTPS issuer', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).resolves.toBeDefined();
    });

    it('accepts a local HTTP issuer for development (localhost)', async () => {
        const issuer = 'http://localhost:8080';
        const fetchMock = jsonFetch(metadataDoc({ issuer }));
        await expect(discoverOidcMetadata(issuer, { fetch: fetchMock })).resolves.toBeDefined();
    });

    it('accepts a local HTTP issuer for development (127.0.0.1)', async () => {
        const issuer = 'http://127.0.0.1:8080';
        const fetchMock = jsonFetch(metadataDoc({ issuer }));
        await expect(discoverOidcMetadata(issuer, { fetch: fetchMock })).resolves.toBeDefined();
    });

    it('rejects a non-local HTTP issuer (HTTPS required)', async () => {
        const issuer = 'http://idp.example.com';
        const fetchMock = jsonFetch(metadataDoc({ issuer }));
        await expect(discoverOidcMetadata(issuer, { fetch: fetchMock })).rejects.toThrow(/https/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an issuer with a non-HTTP(S) scheme', async () => {
        const issuer = 'ftp://idp.example.com';
        const fetchMock = jsonFetch(metadataDoc({ issuer }));
        await expect(discoverOidcMetadata(issuer, { fetch: fetchMock })).rejects.toThrow(/https/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an issuer that is not a valid URL', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        await expect(discoverOidcMetadata('not-a-valid-url', { fetch: fetchMock })).rejects.toThrow(/https/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exposes the discovered jwks_uri', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const meta = await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(meta.jwks_uri).toBe(`${ISSUER}/jwks`);
    });

    it('rejects when the injected fetch rejects (timeout / network error)', async () => {
        const fetchMock = mock(async () => {
            throw new Error('network timeout');
        }) as unknown as typeof fetch;
        await expect(discoverOidcMetadata(ISSUER, { fetch: fetchMock })).rejects.toThrow(/network timeout/i);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('discoverOidcMetadata cache TTL', () => {
    beforeEach(() => resetOidcDiscoveryCache());
    afterEach(() => setOidcDiscoveryCacheTtlForTesting(undefined));

    it('re-fetches once the cached entry has expired (rotated endpoints)', async () => {
        setOidcDiscoveryCacheTtlForTesting(1);
        const fetchMock = jsonFetch(metadataDoc());
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Wait for the (very short) TTL to elapse, then call again.
        await new Promise(resolve => setTimeout(resolve, 5));
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('still serves from cache within the TTL window', async () => {
        setOidcDiscoveryCacheTtlForTesting(60_000);
        const fetchMock = jsonFetch(metadataDoc());
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        await discoverOidcMetadata(ISSUER, { fetch: fetchMock });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('resolveOidcEndpoints', () => {
    beforeEach(() => resetOidcDiscoveryCache());

    it('returns explicit endpoints without attempting discovery when issuer is empty', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: '',
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: 'https://explicit/logout',
            },
            { fetch: fetchMock },
        );
        expect(fetchMock).not.toHaveBeenCalled();
        expect(resolved.authorizationEndpoint).toBe('https://explicit/auth');
        expect(resolved.tokenEndpoint).toBe('https://explicit/token');
    });

    it('does not attempt discovery when all endpoints are already explicit', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: 'https://explicit/logout',
                jwksUri: 'https://explicit/jwks',
            },
            { fetch: fetchMock },
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fills all missing endpoints from discovery', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: '',
                tokenEndpoint: '',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.authorizationEndpoint).toBe(`${ISSUER}/authorize`);
        expect(resolved.tokenEndpoint).toBe(`${ISSUER}/token`);
        expect(resolved.userinfoEndpoint).toBe(`${ISSUER}/userinfo`);
        expect(resolved.endSessionEndpoint).toBe(`${ISSUER}/logout`);
    });

    it('keeps explicit endpoints and only fills the missing ones (mixed config)', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: '',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        // Explicit values are preserved.
        expect(resolved.authorizationEndpoint).toBe('https://explicit/auth');
        expect(resolved.userinfoEndpoint).toBe('https://explicit/userinfo');
        // Missing ones are discovered.
        expect(resolved.tokenEndpoint).toBe(`${ISSUER}/token`);
        expect(resolved.endSessionEndpoint).toBe(`${ISSUER}/logout`);
    });

    it('never lets discovery override an explicit endpoint', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.authorizationEndpoint).toBe('https://explicit/auth');
        expect(resolved.tokenEndpoint).toBe('https://explicit/token');
    });

    it('falls back to explicit endpoints when discovery fails', async () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
        const fetchMock = jsonFetch({}, 500);
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.authorizationEndpoint).toBe('https://explicit/auth');
        expect(resolved.tokenEndpoint).toBe('https://explicit/token');
        // The endpoint that could not be discovered stays empty (route-level checks handle it).
        expect(resolved.endSessionEndpoint).toBe('');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('leaves missing endpoints empty when discovery fails and they were not explicit', async () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
        const fetchMock = jsonFetch({}, 500);
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: '',
                tokenEndpoint: '',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.authorizationEndpoint).toBe('');
        expect(resolved.tokenEndpoint).toBe('');
        warnSpy.mockRestore();
    });

    it('uses a discovered end_session_endpoint only when not explicitly configured', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: 'https://explicit/logout',
                jwksUri: 'https://explicit/jwks',
            },
            { fetch: fetchMock },
        );
        expect(resolved.endSessionEndpoint).toBe('https://explicit/logout');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not break when the provider omits end_session_endpoint', async () => {
        const doc = metadataDoc();
        delete (doc as Record<string, unknown>).end_session_endpoint;
        const fetchMock = jsonFetch(doc);
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: '',
                tokenEndpoint: '',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.authorizationEndpoint).toBe(`${ISSUER}/authorize`);
        expect(resolved.endSessionEndpoint).toBe('');
    });

    it('fills jwksUri from discovery when not configured explicitly', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: '',
                tokenEndpoint: '',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
                jwksUri: '',
            },
            { fetch: fetchMock },
        );
        expect(resolved.jwksUri).toBe(`${ISSUER}/jwks`);
    });

    it('never lets discovery override an explicit jwksUri', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: '',
                tokenEndpoint: '',
                userinfoEndpoint: '',
                endSessionEndpoint: '',
                jwksUri: 'https://explicit/jwks',
            },
            { fetch: fetchMock },
        );
        expect(resolved.jwksUri).toBe('https://explicit/jwks');
    });

    it('does NOT trigger discovery when only the optional end_session_endpoint is blank', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: '',
                jwksUri: 'https://explicit/jwks',
            },
            { fetch: fetchMock },
        );
        // end_session_endpoint is optional; its absence alone must not cost a discovery round-trip.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(resolved.endSessionEndpoint).toBe('');
    });

    it('still triggers discovery when a required endpoint (jwksUri) is blank even if end_session is the only other gap', async () => {
        const fetchMock = jsonFetch(metadataDoc());
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: '',
                jwksUri: '',
            },
            { fetch: fetchMock },
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(resolved.jwksUri).toBe(`${ISSUER}/jwks`);
        expect(resolved.endSessionEndpoint).toBe(`${ISSUER}/logout`);
    });

    it('swallows a rejecting fetch (timeout / network), warns, and falls back to explicit endpoints', async () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
        const fetchMock = mock(async () => {
            throw new Error('network down');
        }) as unknown as typeof fetch;
        const resolved = await resolveOidcEndpoints(
            {
                issuer: ISSUER,
                authorizationEndpoint: 'https://explicit/auth',
                tokenEndpoint: 'https://explicit/token',
                userinfoEndpoint: 'https://explicit/userinfo',
                endSessionEndpoint: '',
                jwksUri: '',
            },
            { fetch: fetchMock },
        );
        // resolveOidcEndpoints must not reject — it degrades gracefully.
        expect(resolved.authorizationEndpoint).toBe('https://explicit/auth');
        expect(resolved.tokenEndpoint).toBe('https://explicit/token');
        // The endpoints that could only come from discovery stay empty.
        expect(resolved.jwksUri).toBe('');
        expect(resolved.endSessionEndpoint).toBe('');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
