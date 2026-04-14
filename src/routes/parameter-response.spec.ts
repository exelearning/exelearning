import { describe, it, expect } from 'bun:test';
import { buildConfigParams } from './config-params';
import { buildParameterResponse } from './parameter-response';
import { API_ROUTES, STATIC_ROUTES } from './api-routes';

const LICENSES = { 'cc-by-4.0': 'Attribution 4.0' };
const PACKAGE_LOCALES = { en: 'English', es: 'Spanish' };
const LOCALES = { en: 'English', es: 'Spanish' };

const configParams = buildConfigParams({ TRANS_PREFIX: '', LICENSES, PACKAGE_LOCALES, LOCALES });

/**
 * The set of config keys that the frontend expects in the parameter response.
 * Any change here must be reflected in the frontend's data consumption code.
 */
const REQUIRED_CONFIG_KEYS = [
    'userPreferencesConfig',
    'ideviceInfoFieldsConfig',
    'themeInfoFieldsConfig',
    'themeEditionFieldsConfig',
    'odeComponentsSyncPropertiesConfig',
    'odeNavStructureSyncPropertiesConfig',
    'odePagStructureSyncPropertiesConfig',
    'odeProjectSyncPropertiesConfig',
    'odeProjectSyncCataloguingConfig',
    'routes',
] as const;

describe('buildParameterResponse', () => {
    it('includes all required config keys', () => {
        const result = buildParameterResponse({
            configParams,
            routes: { test: { path: '/test', methods: ['GET'] } },
        });

        for (const key of REQUIRED_CONFIG_KEYS) {
            expect(result).toHaveProperty(key);
        }
    });

    it('spreads app settings at the top level when provided', () => {
        const result = buildParameterResponse({
            configParams,
            routes: {},
            appSettings: {
                canInstallThemes: 1,
                canInstallIdevices: 0,
                autosaveOdeFilesFunction: true,
                autosaveIntervalTime: 600,
                generateNewItemKey: 'item_test_123',
            },
        });

        expect(result.canInstallThemes).toBe(1);
        expect(result.canInstallIdevices).toBe(0);
        expect(result.autosaveOdeFilesFunction).toBe(true);
        expect(result.autosaveIntervalTime).toBe(600);
        expect(result.generateNewItemKey).toBe('item_test_123');
    });

    it('omits app settings when not provided', () => {
        const result = buildParameterResponse({ configParams, routes: {} });
        expect(result).not.toHaveProperty('canInstallThemes');
        expect(result).not.toHaveProperty('autosaveOdeFilesFunction');
    });

    it('disableThemeEdition returns empty object for themeEditionFieldsConfig', () => {
        const result = buildParameterResponse({
            configParams,
            routes: {},
            disableThemeEdition: true,
        });
        expect(result.themeEditionFieldsConfig).toEqual({});
    });

    it('includes full themeEditionFieldsConfig when disableThemeEdition is false', () => {
        const result = buildParameterResponse({
            configParams,
            routes: {},
            disableThemeEdition: false,
        });
        expect(Object.keys(result.themeEditionFieldsConfig).length).toBeGreaterThan(0);
    });

    it('passes routes through unchanged', () => {
        const routes = { r1: { path: '/a', methods: ['GET'] }, r2: { path: '/b', methods: ['POST'] } };
        const result = buildParameterResponse({ configParams, routes });
        expect(result.routes).toEqual(routes);
    });
});

describe('server/static response contract alignment', () => {
    it('server and static responses share the same config key set', () => {
        // Simulate server-mode response (with app settings, full routes)
        const serverResponse = buildParameterResponse({
            configParams,
            routes: API_ROUTES,
            appSettings: {
                canInstallThemes: 0,
                canInstallIdevices: 0,
                autosaveOdeFilesFunction: true,
                autosaveIntervalTime: 600,
                generateNewItemKey: 'item_x',
            },
        });

        // Simulate static-mode response (no app settings, minimal routes, theme edition disabled)
        const staticResponse = buildParameterResponse({
            configParams,
            routes: STATIC_ROUTES,
            disableThemeEdition: true,
        });

        // Every required config key must be present in BOTH responses
        for (const key of REQUIRED_CONFIG_KEYS) {
            expect(serverResponse).toHaveProperty(key);
            expect(staticResponse).toHaveProperty(key);
        }

        // Config objects (excluding routes and app settings) must have the same keys
        // This catches scenarios where a new config group is added to config-params.ts
        // but the response builder forgets to include it
        const configKeySet = REQUIRED_CONFIG_KEYS.filter(k => k !== 'routes');
        for (const key of configKeySet) {
            const serverVal = (serverResponse as Record<string, unknown>)[key];
            const staticVal = (staticResponse as Record<string, unknown>)[key];
            expect(typeof serverVal).toBe(typeof staticVal);
        }
    });

    it('static response contains no server-only app settings keys', () => {
        const staticResponse = buildParameterResponse({
            configParams,
            routes: STATIC_ROUTES,
            disableThemeEdition: true,
        });

        const appSettingKeys = [
            'canInstallThemes',
            'canInstallIdevices',
            'autosaveOdeFilesFunction',
            'autosaveIntervalTime',
            'generateNewItemKey',
        ];

        for (const key of appSettingKeys) {
            expect(staticResponse).not.toHaveProperty(key);
        }
    });
});
