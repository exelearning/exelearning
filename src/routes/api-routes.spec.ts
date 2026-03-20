import { describe, it, expect } from 'bun:test';
import { API_ROUTES, STATIC_ROUTES, prefixRoutesWithBasePath } from './api-routes';

describe('API_ROUTES', () => {
    it('contains expected route categories', () => {
        // Spot-check a few routes from each category
        expect(API_ROUTES.api_idevices_installed).toBeDefined();
        expect(API_ROUTES.api_themes_installed).toBeDefined();
        expect(API_ROUTES.api_odes_ode_save_manual).toBeDefined();
        expect(API_ROUTES.api_export_html5).toBeDefined();
        expect(API_ROUTES.api_assets_upload).toBeDefined();
        expect(API_ROUTES.api_auth_login).toBeDefined();
        expect(API_ROUTES.api_translations_lists).toBeDefined();
        expect(API_ROUTES.api_config_parameters).toBeDefined();
    });

    it('all routes have path and methods', () => {
        for (const [key, route] of Object.entries(API_ROUTES)) {
            expect(route.path).toBeString();
            expect(route.path.startsWith('/api/')).toBe(true);
            expect(Array.isArray(route.methods)).toBe(true);
            expect(route.methods.length).toBeGreaterThan(0);
        }
    });
});

describe('STATIC_ROUTES', () => {
    it('every key exists in API_ROUTES with matching definition', () => {
        for (const [key, route] of Object.entries(STATIC_ROUTES)) {
            expect(API_ROUTES[key]).toBeDefined();
            expect(route.path).toBe(API_ROUTES[key].path);
            expect(route.methods).toEqual(API_ROUTES[key].methods);
        }
    });

    it('is a strict subset of API_ROUTES (references, not copies)', () => {
        for (const key of Object.keys(STATIC_ROUTES)) {
            expect(STATIC_ROUTES[key]).toBe(API_ROUTES[key]);
        }
    });

    it('includes the routes needed for static mode', () => {
        expect(STATIC_ROUTES.api_translations_lists).toBeDefined();
        expect(STATIC_ROUTES.api_translations_list_by_locale).toBeDefined();
        expect(STATIC_ROUTES.api_idevices_installed).toBeDefined();
        expect(STATIC_ROUTES.api_themes_installed).toBeDefined();
        expect(STATIC_ROUTES.api_config_upload_limits).toBeDefined();
    });
});

describe('prefixRoutesWithBasePath', () => {
    it('preserves route structure and methods', () => {
        const routes = { test: { path: '/api/test', methods: ['GET', 'POST'] } };
        const result = prefixRoutesWithBasePath(routes);
        expect(result.test.methods).toEqual(['GET', 'POST']);
        // Path should end with the original path (may have basePath prefix)
        expect(result.test.path).toEndWith('/api/test');
    });
});
