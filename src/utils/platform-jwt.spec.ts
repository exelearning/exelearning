import { SignJWT } from 'jose';
import {
    getProviderConfig,
    getProviderSecret,
    isValidProvider,
    isAllowedProviderUrl,
    isSafeReturnUrl,
    extractProviderId,
    decodePlatformJWT,
    buildIntegrationUrl,
    getPlatformIntegrationParams,
    getExportTypeFromPkgType,
    validateProviderConfiguration,
    warnIfProviderUrlsMissing,
    resetProviderUrlWarning,
    type PlatformJWTPayload,
} from './platform-jwt';

describe('Platform JWT Utilities', () => {
    // Store original environment variables to restore after tests
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
        originalEnv = {
            APP_SECRET: process.env.APP_SECRET,
            PROVIDER_URLS: process.env.PROVIDER_URLS,
            PROVIDER_TOKENS: process.env.PROVIDER_TOKENS,
            PROVIDER_IDS: process.env.PROVIDER_IDS,
        };
    });

    afterEach(() => {
        // Restore original environment variables
        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        });
    });

    describe('getProviderConfig', () => {
        it('should return empty arrays when env vars are not set', () => {
            delete process.env.PROVIDER_URLS;
            delete process.env.PROVIDER_TOKENS;
            delete process.env.PROVIDER_IDS;

            const config = getProviderConfig();
            expect(config.urls).toEqual([]);
            expect(config.tokens).toEqual([]);
            expect(config.ids).toEqual([]);
        });

        it('should parse comma-separated values', () => {
            process.env.PROVIDER_URLS = 'https://moodle1.com,https://moodle2.com';
            process.env.PROVIDER_TOKENS = 'token1,token2';
            process.env.PROVIDER_IDS = 'provider1,provider2';

            const config = getProviderConfig();
            expect(config.urls).toEqual(['https://moodle1.com', 'https://moodle2.com']);
            expect(config.tokens).toEqual(['token1', 'token2']);
            expect(config.ids).toEqual(['provider1', 'provider2']);
        });

        it('should trim whitespace from values', () => {
            process.env.PROVIDER_URLS = ' https://moodle.com , https://moodle2.com ';
            process.env.PROVIDER_TOKENS = ' token1 , token2 ';
            process.env.PROVIDER_IDS = ' id1 , id2 ';

            const config = getProviderConfig();
            expect(config.urls).toEqual(['https://moodle.com', 'https://moodle2.com']);
            expect(config.tokens).toEqual(['token1', 'token2']);
            expect(config.ids).toEqual(['id1', 'id2']);
        });

        it('should handle single value', () => {
            process.env.PROVIDER_URLS = 'https://moodle.com';
            process.env.PROVIDER_TOKENS = 'token';
            process.env.PROVIDER_IDS = 'moodlelms';

            const config = getProviderConfig();
            expect(config.urls).toEqual(['https://moodle.com']);
            expect(config.tokens).toEqual(['token']);
            expect(config.ids).toEqual(['moodlelms']);
        });
    });

    describe('getProviderSecret', () => {
        it('should return APP_SECRET when no providerId', () => {
            process.env.APP_SECRET = 'app-secret';
            delete process.env.PROVIDER_IDS;
            delete process.env.PROVIDER_TOKENS;

            expect(getProviderSecret()).toBe('app-secret');
            expect(getProviderSecret(undefined)).toBe('app-secret');
        });

        it('should return provider-specific token when found', () => {
            process.env.APP_SECRET = 'app-secret';
            process.env.PROVIDER_IDS = 'moodlelms,workplace';
            process.env.PROVIDER_TOKENS = 'moodle-token,workplace-token';

            expect(getProviderSecret('moodlelms')).toBe('moodle-token');
            expect(getProviderSecret('workplace')).toBe('workplace-token');
        });

        it('should fall back to APP_SECRET when provider not found', () => {
            process.env.APP_SECRET = 'app-secret';
            process.env.PROVIDER_IDS = 'moodlelms';
            process.env.PROVIDER_TOKENS = 'moodle-token';

            expect(getProviderSecret('unknown')).toBe('app-secret');
        });

        it('should handle _legacy suffix in provider ID', () => {
            process.env.PROVIDER_IDS = 'moodlelms';
            process.env.PROVIDER_TOKENS = 'moodle-token';

            expect(getProviderSecret('moodlelms_legacy')).toBe('moodle-token');
        });
    });

    describe('isValidProvider', () => {
        it('should return true when no providers configured', () => {
            delete process.env.PROVIDER_IDS;

            expect(isValidProvider('any-provider')).toBe(true);
        });

        it('should return true for configured provider', () => {
            process.env.PROVIDER_IDS = 'moodlelms,workplace';

            expect(isValidProvider('moodlelms')).toBe(true);
            expect(isValidProvider('workplace')).toBe(true);
        });

        it('should return false for unknown provider', () => {
            process.env.PROVIDER_IDS = 'moodlelms';

            expect(isValidProvider('unknown')).toBe(false);
        });

        it('should handle _legacy suffix', () => {
            process.env.PROVIDER_IDS = 'moodlelms';

            expect(isValidProvider('moodlelms_legacy')).toBe(true);
        });
    });

    describe('isAllowedProviderUrl', () => {
        // SECURITY (bug M3): this is an allow-list and now FAILS CLOSED. Previously
        // an empty PROVIDER_URLS (the shipped default) returned true for any URL,
        // which enabled SSRF via the JWT returnurl. With no providers configured
        // nothing is allowed, so platform integration requires an explicit list.
        it('should return false when no providers configured (fail closed)', () => {
            delete process.env.PROVIDER_URLS;

            expect(isAllowedProviderUrl('https://any-domain.com/path')).toBe(false);
        });

        it('should return true for URL matching a configured provider', () => {
            process.env.PROVIDER_URLS = 'https://moodle.example.com,https://workplace.example.com';

            expect(isAllowedProviderUrl('https://moodle.example.com/course/view.php?id=1')).toBe(true);
            expect(isAllowedProviderUrl('https://workplace.example.com/mod/exescorm/view.php')).toBe(true);
        });

        it('should return false for URL not matching any provider', () => {
            process.env.PROVIDER_URLS = 'https://moodle.example.com';

            expect(isAllowedProviderUrl('https://other-domain.com/path')).toBe(false);
        });

        it('should return false for empty URL', () => {
            process.env.PROVIDER_URLS = 'https://moodle.example.com';

            expect(isAllowedProviderUrl('')).toBe(false);
        });
    });

    describe('isSafeReturnUrl', () => {
        it('should allow public http(s) hostnames', () => {
            expect(isSafeReturnUrl('https://moodle.example.com/mod/exescorm/view.php?id=1')).toBe(true);
            expect(isSafeReturnUrl('http://moodle.example.com/mod/exeweb/view.php')).toBe(true);
        });

        it('should allow a public IP literal host', () => {
            expect(isSafeReturnUrl('https://8.8.8.8/mod/exescorm/view.php')).toBe(true);
        });

        it('should reject empty and unparseable URLs', () => {
            expect(isSafeReturnUrl('')).toBe(false);
            expect(isSafeReturnUrl('not a url')).toBe(false);
        });

        it('should reject non-http(s) schemes', () => {
            expect(isSafeReturnUrl('file:///etc/passwd')).toBe(false);
            expect(isSafeReturnUrl('ftp://moodle.example.com/x')).toBe(false);
            expect(isSafeReturnUrl('gopher://moodle.example.com/x')).toBe(false);
        });

        it('should reject internal IPv4 literal hosts (SSRF guard)', () => {
            expect(isSafeReturnUrl('http://127.0.0.1/mod/exescorm/view.php')).toBe(false);
            expect(isSafeReturnUrl('http://10.0.0.5/mod/exescorm/view.php')).toBe(false);
            expect(isSafeReturnUrl('http://192.168.1.10/mod/exescorm/view.php')).toBe(false);
            // Cloud metadata endpoint (link-local).
            expect(isSafeReturnUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
        });

        it('should reject internal IPv6 literal hosts (SSRF guard)', () => {
            expect(isSafeReturnUrl('http://[::1]/mod/exescorm/view.php')).toBe(false);
            expect(isSafeReturnUrl('http://[fe80::1]/mod/exescorm/view.php')).toBe(false);
        });
    });

    describe('extractProviderId', () => {
        it('should extract provider_id from new format', () => {
            const payload = {
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com',
                pkgtype: 'scorm' as const,
                provider_id: 'moodlelms',
                exp: Date.now() / 1000 + 3600,
                iat: Date.now() / 1000,
            };

            expect(extractProviderId(payload)).toBe('moodlelms');
        });

        it('should extract from legacy format with provider.name', () => {
            const payload = {
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com',
                pkgtype: 'scorm' as const,
                provider: { name: 'MoodleLMS' },
                exp: Date.now() / 1000 + 3600,
                iat: Date.now() / 1000,
            };

            expect(extractProviderId(payload)).toBe('moodlelms_legacy');
        });

        it('should return null when no provider info', () => {
            const payload = {
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com',
                pkgtype: 'scorm' as const,
                exp: Date.now() / 1000 + 3600,
                iat: Date.now() / 1000,
            };

            expect(extractProviderId(payload)).toBeNull();
        });
    });

    describe('decodePlatformJWT', () => {
        const createValidToken = async (payload: Partial<PlatformJWTPayload>, secret: string) => {
            const fullPayload = {
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com/course/view.php?id=1',
                pkgtype: 'scorm',
                ...payload,
            };

            return new SignJWT(fullPayload as unknown as Record<string, unknown>)
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode(secret));
        };

        it('should decode valid token with APP_SECRET', async () => {
            process.env.APP_SECRET = 'test-secret';
            delete process.env.PROVIDER_IDS;

            const token = await createValidToken({ userid: 'user123', cmid: 'cm456' }, 'test-secret');

            const result = await decodePlatformJWT(token);
            expect(result).not.toBeNull();
            expect(result?.userid).toBe('user123');
            expect(result?.cmid).toBe('cm456');
        });

        it('should decode valid token with provider-specific secret', async () => {
            process.env.APP_SECRET = 'app-secret';
            process.env.PROVIDER_IDS = 'moodlelms';
            process.env.PROVIDER_TOKENS = 'moodle-secret';

            const token = await createValidToken({ userid: 'user123', provider_id: 'moodlelms' }, 'moodle-secret');

            const result = await decodePlatformJWT(token, 'moodlelms');
            expect(result).not.toBeNull();
            expect(result?.userid).toBe('user123');
        });

        it('should return null for invalid token', async () => {
            process.env.APP_SECRET = 'test-secret';

            const result = await decodePlatformJWT('invalid-token');
            expect(result).toBeNull();
        });

        it('should return null for token signed with wrong secret', async () => {
            process.env.APP_SECRET = 'correct-secret';

            const token = await createValidToken({}, 'wrong-secret');

            const result = await decodePlatformJWT(token);
            expect(result).toBeNull();
        });

        it('should return null for expired token', async () => {
            process.env.APP_SECRET = 'test-secret';

            // Create token that expired 1 hour ago
            const token = await new SignJWT({
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com',
                pkgtype: 'scorm',
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt(Date.now() / 1000 - 7200) // 2 hours ago
                .setExpirationTime(Date.now() / 1000 - 3600) // 1 hour ago
                .sign(new TextEncoder().encode('test-secret'));

            const result = await decodePlatformJWT(token);
            expect(result).toBeNull();
        });

        it('should return null when missing required returnurl', async () => {
            process.env.APP_SECRET = 'test-secret';

            const token = await new SignJWT({
                userid: '123',
                cmid: '456',
                pkgtype: 'scorm',
                // returnurl is missing
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode('test-secret'));

            const result = await decodePlatformJWT(token);
            expect(result).toBeNull();
        });
    });

    describe('buildIntegrationUrl', () => {
        it('should build set_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.com/mod/exescorm/view.php?id=123';
            expect(buildIntegrationUrl(returnUrl, 'set')).toBe('https://moodle.com/mod/exescorm/set_ode.php');
        });

        it('should build get_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.com/mod/exescorm/view.php?id=123';
            expect(buildIntegrationUrl(returnUrl, 'get')).toBe('https://moodle.com/mod/exescorm/get_ode.php');
        });

        it('should build set_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.com/mod/exeweb/view.php?id=456';
            expect(buildIntegrationUrl(returnUrl, 'set')).toBe('https://moodle.com/mod/exeweb/set_ode.php');
        });

        it('should build get_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.com/mod/exeweb/view.php?id=456';
            expect(buildIntegrationUrl(returnUrl, 'get')).toBe('https://moodle.com/mod/exeweb/get_ode.php');
        });

        it('should handle course/section pattern for SCORM', () => {
            const returnUrl = 'https://moodle.com/course/section.php?id=789';
            expect(buildIntegrationUrl(returnUrl, 'set')).toBe('https://moodle.com/mod/exescorm/set_ode.php');
        });

        it('should return null for unknown URL pattern', () => {
            const returnUrl = 'https://moodle.com/some/other/path';
            expect(buildIntegrationUrl(returnUrl, 'set')).toBeNull();
        });
    });

    describe('getExportTypeFromPkgType', () => {
        it('should map scorm to scorm12', () => {
            expect(getExportTypeFromPkgType('scorm')).toBe('scorm12');
        });

        it('should map webzip to html5', () => {
            expect(getExportTypeFromPkgType('webzip')).toBe('html5');
        });

        it('should default to scorm12 for unknown types', () => {
            expect(getExportTypeFromPkgType('unknown')).toBe('scorm12');
            expect(getExportTypeFromPkgType('')).toBe('scorm12');
        });
    });

    describe('validateProviderConfiguration', () => {
        it('should return empty array for valid configuration', () => {
            process.env.PROVIDER_URLS = 'https://a.com,https://b.com';
            process.env.PROVIDER_TOKENS = 'token-a,token-b';
            process.env.PROVIDER_IDS = 'id-a,id-b';

            const errors = validateProviderConfiguration();
            expect(errors).toEqual([]);
        });

        it('should return empty array when no providers configured', () => {
            delete process.env.PROVIDER_URLS;
            delete process.env.PROVIDER_TOKENS;
            delete process.env.PROVIDER_IDS;

            const errors = validateProviderConfiguration();
            expect(errors).toEqual([]);
        });

        it('should detect mismatched array lengths', () => {
            process.env.PROVIDER_URLS = 'https://a.com,https://b.com';
            process.env.PROVIDER_TOKENS = 'token-a';
            process.env.PROVIDER_IDS = 'id-a,id-b';

            const errors = validateProviderConfiguration();
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('mismatch');
        });

        it('should detect duplicate provider IDs', () => {
            process.env.PROVIDER_URLS = 'https://a.com,https://b.com';
            process.env.PROVIDER_TOKENS = 'token-a,token-b';
            process.env.PROVIDER_IDS = 'id-a,id-a';

            const errors = validateProviderConfiguration();
            expect(errors).toContain('Duplicate provider IDs found');
        });
    });

    describe('warnIfProviderUrlsMissing', () => {
        // isAllowedProviderUrl fails closed when PROVIDER_URLS is empty. If an
        // operator wires up platform integration (PROVIDER_TOKENS / PROVIDER_IDS)
        // but forgets PROVIDER_URLS, every callback is silently rejected. Emit a
        // one-time startup warning so the misconfiguration is visible.
        let originalWarn: typeof console.warn;
        let warnings: string[];

        beforeEach(() => {
            resetProviderUrlWarning();
            originalWarn = console.warn;
            warnings = [];
            console.warn = (...args: unknown[]) => {
                warnings.push(args.map(String).join(' '));
            };
        });

        afterEach(() => {
            console.warn = originalWarn;
        });

        it('warns when integration is configured (tokens) but PROVIDER_URLS is empty', () => {
            delete process.env.PROVIDER_URLS;
            process.env.PROVIDER_TOKENS = 'token-a';
            process.env.PROVIDER_IDS = 'id-a';

            const warned = warnIfProviderUrlsMissing();

            expect(warned).toBe(true);
            expect(warnings.length).toBe(1);
            expect(warnings[0]).toContain('PROVIDER_URLS');
        });

        it('warns when only PROVIDER_IDS is set but PROVIDER_URLS is empty', () => {
            delete process.env.PROVIDER_URLS;
            delete process.env.PROVIDER_TOKENS;
            process.env.PROVIDER_IDS = 'id-a';

            const warned = warnIfProviderUrlsMissing();

            expect(warned).toBe(true);
            expect(warnings.length).toBe(1);
        });

        it('only warns once across repeated calls (one-time startup warning)', () => {
            delete process.env.PROVIDER_URLS;
            process.env.PROVIDER_TOKENS = 'token-a';
            process.env.PROVIDER_IDS = 'id-a';

            expect(warnIfProviderUrlsMissing()).toBe(true);
            expect(warnIfProviderUrlsMissing()).toBe(false);
            expect(warnIfProviderUrlsMissing()).toBe(false);
            expect(warnings.length).toBe(1);
        });

        it('does not warn when PROVIDER_URLS is configured alongside integration', () => {
            process.env.PROVIDER_URLS = 'https://a.com';
            process.env.PROVIDER_TOKENS = 'token-a';
            process.env.PROVIDER_IDS = 'id-a';

            const warned = warnIfProviderUrlsMissing();

            expect(warned).toBe(false);
            expect(warnings.length).toBe(0);
        });

        it('does not warn when no platform integration is configured at all', () => {
            delete process.env.PROVIDER_URLS;
            delete process.env.PROVIDER_TOKENS;
            delete process.env.PROVIDER_IDS;

            const warned = warnIfProviderUrlsMissing();

            expect(warned).toBe(false);
            expect(warnings.length).toBe(0);
        });
    });

    describe('getPlatformIntegrationParams', () => {
        const createValidToken = async (payload: Partial<PlatformJWTPayload>) => {
            const fullPayload = {
                userid: '123',
                cmid: '456',
                returnurl: 'https://moodle.com/mod/exescorm/view.php?id=1',
                pkgtype: 'scorm',
                ...payload,
            };

            return new SignJWT(fullPayload as unknown as Record<string, unknown>)
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode('test-secret'));
        };

        beforeEach(() => {
            process.env.APP_SECRET = 'test-secret';
            delete process.env.PROVIDER_IDS;
            // SECURITY (bug M3): isAllowedProviderUrl now fails closed, so the
            // legitimate success path requires an explicit allow-list that
            // matches the token's returnurl host (https://moodle.com).
            process.env.PROVIDER_URLS = 'https://moodle.com';
        });

        it('should return params with platformIntegrationUrl for set operation', async () => {
            const token = await createValidToken({
                returnurl: 'https://moodle.com/mod/exescorm/view.php?id=1',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).not.toBeNull();
            expect(params?.platformIntegrationUrl).toBe('https://moodle.com/mod/exescorm/set_ode.php');
        });

        it('should return params with platformIntegrationUrl for get operation', async () => {
            const token = await createValidToken({
                returnurl: 'https://moodle.com/mod/exescorm/view.php?id=1',
            });

            const params = await getPlatformIntegrationParams(token, 'get');
            expect(params).not.toBeNull();
            expect(params?.platformIntegrationUrl).toBe('https://moodle.com/mod/exescorm/get_ode.php');
        });

        it('should return null for invalid token', async () => {
            const params = await getPlatformIntegrationParams('invalid-token', 'set');
            expect(params).toBeNull();
        });

        it('should return null for invalid provider', async () => {
            process.env.PROVIDER_IDS = 'allowed-provider';

            const token = await createValidToken({
                provider_id: 'not-allowed',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).toBeNull();
        });

        it('should return null for URL not in allowed providers', async () => {
            process.env.PROVIDER_URLS = 'https://allowed-moodle.com';

            const token = await createValidToken({
                returnurl: 'https://other-moodle.com/mod/exescorm/view.php',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).toBeNull();
        });

        // SECURITY (bug M3): with no PROVIDER_URLS configured the allow-list is
        // empty and must deny — previously this returned params for any URL.
        it('should return null when PROVIDER_URLS is empty (fail closed)', async () => {
            delete process.env.PROVIDER_URLS;

            const token = await createValidToken({
                returnurl: 'https://moodle.com/mod/exescorm/view.php?id=1',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).toBeNull();
        });

        // SECURITY (bug M3): an internal IP-literal returnurl must be rejected as
        // a request target even if an allow-list prefix would otherwise match.
        it('should return null for a returnurl pointing at an internal IP', async () => {
            process.env.PROVIDER_URLS = 'http://169.254.169.254';

            const token = await createValidToken({
                returnurl: 'http://169.254.169.254/mod/exescorm/view.php',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).toBeNull();
        });

        // SECURITY (bug M3): a non-http(s) scheme returnurl must be rejected.
        it('should return null for a returnurl with a non-http(s) scheme', async () => {
            process.env.PROVIDER_URLS = 'file://';

            const token = await createValidToken({
                returnurl: 'file:///mod/exescorm/etc/passwd',
            });

            const params = await getPlatformIntegrationParams(token, 'set');
            expect(params).toBeNull();
        });
    });
});
