import { describe, it, expect, afterEach } from 'bun:test';
import {
    isMaintenanceMode,
    invalidateMaintenanceCache,
    shouldBypassMaintenance,
    isAdminRequest,
    getPostLoginTarget,
    configure,
    resetDependencies,
} from './maintenance';

// Minimal mock DB (not used directly, passed through to deps)
const mockDb = {} as any;

describe('maintenance service', () => {
    afterEach(() => {
        resetDependencies();
        invalidateMaintenanceCache();
    });

    // ========================================================================
    // isMaintenanceMode
    // ========================================================================
    describe('isMaintenanceMode', () => {
        it('returns false by default (setting not set)', async () => {
            configure({
                getSettingBoolean: async () => false,
            });
            expect(await isMaintenanceMode(mockDb)).toBe(false);
        });

        it('returns true when DB has setting enabled', async () => {
            configure({
                getSettingBoolean: async () => true,
            });
            expect(await isMaintenanceMode(mockDb)).toBe(true);
        });

        it('caches the result (second call does not hit DB within TTL)', async () => {
            let callCount = 0;
            configure({
                getSettingBoolean: async () => {
                    callCount++;
                    return true;
                },
            });

            await isMaintenanceMode(mockDb);
            await isMaintenanceMode(mockDb);
            expect(callCount).toBe(1);
        });

        it('invalidateMaintenanceCache forces re-read', async () => {
            let callCount = 0;
            configure({
                getSettingBoolean: async () => {
                    callCount++;
                    return false;
                },
            });

            await isMaintenanceMode(mockDb);
            expect(callCount).toBe(1);

            invalidateMaintenanceCache();
            await isMaintenanceMode(mockDb);
            expect(callCount).toBe(2);
        });
    });

    // ========================================================================
    // shouldBypassMaintenance
    // ========================================================================
    describe('shouldBypassMaintenance', () => {
        it('whitelists health endpoints', () => {
            expect(shouldBypassMaintenance('/health')).toBe(true);
            expect(shouldBypassMaintenance('/healthcheck')).toBe(true);
        });

        it('whitelists login and auth API', () => {
            expect(shouldBypassMaintenance('/login')).toBe(true);
            expect(shouldBypassMaintenance('/login_check')).toBe(true);
            expect(shouldBypassMaintenance('/login/cas')).toBe(true);
            expect(shouldBypassMaintenance('/login/cas/callback')).toBe(true);
            expect(shouldBypassMaintenance('/login/openid')).toBe(true);
            expect(shouldBypassMaintenance('/login/openid/callback')).toBe(true);
            expect(shouldBypassMaintenance('/login/guest')).toBe(true);
            expect(shouldBypassMaintenance('/logout')).toBe(true);
            expect(shouldBypassMaintenance('/api/auth/login')).toBe(true);
            expect(shouldBypassMaintenance('/api/auth/session/check')).toBe(true);
        });

        it('whitelists admin paths', () => {
            expect(shouldBypassMaintenance('/admin')).toBe(true);
            expect(shouldBypassMaintenance('/api/admin/settings')).toBe(true);
        });

        it('does not whitelist paths starting with /v that are not versioned assets', () => {
            expect(shouldBypassMaintenance('/vulnerable')).toBe(false);
            expect(shouldBypassMaintenance('/view-data')).toBe(false);
        });

        it('whitelists static asset prefixes', () => {
            expect(shouldBypassMaintenance('/v1.2.3/libs/bootstrap.css')).toBe(true);
            expect(shouldBypassMaintenance('/libs/jquery.min.js')).toBe(true);
            expect(shouldBypassMaintenance('/style/main.css')).toBe(true);
            expect(shouldBypassMaintenance('/images/logo.svg')).toBe(true);
            expect(shouldBypassMaintenance('/icons/icon.png')).toBe(true);
            expect(shouldBypassMaintenance('/app/app.js')).toBe(true);
            expect(shouldBypassMaintenance('/favicon.ico')).toBe(true);
        });

        it('whitelists static file extensions', () => {
            expect(shouldBypassMaintenance('/some/path/file.css')).toBe(true);
            expect(shouldBypassMaintenance('/some/path/file.js')).toBe(true);
            expect(shouldBypassMaintenance('/some/path/file.woff2')).toBe(true);
            expect(shouldBypassMaintenance('/some/path/file.png')).toBe(true);
        });

        it('blocks normal application paths', () => {
            expect(shouldBypassMaintenance('/workarea')).toBe(false);
            expect(shouldBypassMaintenance('/api/project/create')).toBe(false);
            expect(shouldBypassMaintenance('/api/export/123/html5')).toBe(false);
            expect(shouldBypassMaintenance('/')).toBe(false);
        });
    });

    // ========================================================================
    // getPostLoginTarget
    // ========================================================================
    describe('getPostLoginTarget', () => {
        it('returns /workarea when maintenance is off', async () => {
            configure({ getSettingBoolean: async () => false });
            expect(await getPostLoginTarget(mockDb, ['ROLE_USER', 'ROLE_ADMIN'])).toBe('/workarea');
        });

        it('returns /admin for admin when maintenance is on', async () => {
            configure({ getSettingBoolean: async () => true });
            expect(await getPostLoginTarget(mockDb, ['ROLE_USER', 'ROLE_ADMIN'])).toBe('/admin');
        });

        it('returns /workarea for non-admin when maintenance is on', async () => {
            configure({ getSettingBoolean: async () => true });
            expect(await getPostLoginTarget(mockDb, ['ROLE_USER'])).toBe('/workarea');
        });
    });

    // ========================================================================
    // isAdminRequest
    // ========================================================================
    describe('isAdminRequest', () => {
        it('returns true with valid admin token', async () => {
            configure({
                verifyToken: async () => ({
                    sub: 1,
                    email: 'admin@test.com',
                    roles: ['ROLE_USER', 'ROLE_ADMIN'],
                    iat: 0,
                    exp: 0,
                }),
            });

            const request = new Request('http://localhost/workarea', {
                headers: { cookie: 'auth=valid-admin-token' },
            });
            expect(await isAdminRequest(request)).toBe(true);
        });

        it('returns false with non-admin token', async () => {
            configure({
                verifyToken: async () => ({
                    sub: 2,
                    email: 'user@test.com',
                    roles: ['ROLE_USER'],
                    iat: 0,
                    exp: 0,
                }),
            });

            const request = new Request('http://localhost/workarea', {
                headers: { cookie: 'auth=valid-user-token' },
            });
            expect(await isAdminRequest(request)).toBe(false);
        });

        it('returns false with no cookie header', async () => {
            const request = new Request('http://localhost/workarea');
            expect(await isAdminRequest(request)).toBe(false);
        });

        it('returns false with no auth cookie', async () => {
            const request = new Request('http://localhost/workarea', {
                headers: { cookie: 'other=value' },
            });
            expect(await isAdminRequest(request)).toBe(false);
        });

        it('returns false with invalid token', async () => {
            configure({
                verifyToken: async () => null,
            });

            const request = new Request('http://localhost/workarea', {
                headers: { cookie: 'auth=invalid-token' },
            });
            expect(await isAdminRequest(request)).toBe(false);
        });
    });
});
