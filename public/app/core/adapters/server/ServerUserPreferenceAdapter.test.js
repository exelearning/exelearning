import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerUserPreferenceAdapter } from './ServerUserPreferenceAdapter.js';

describe('ServerUserPreferenceAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            put: vi.fn(),
            post: vi.fn(),
        };

        mockEndpoints = {
            api_user_preferences_get: { path: '/api/user/preferences' },
            api_user_preferences_save: { path: '/api/user/preferences' },
            api_user_set_lopd_accepted: { path: '/api/user/lopd/accept' },
        };

        adapter = new ServerUserPreferenceAdapter(mockHttpClient, mockEndpoints, '/test');

        // Mock fetch
        global.fetch = vi.fn();

        // Mock localStorage
        const localStorageData = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn((key) => localStorageData[key] || null),
                setItem: vi.fn((key, value) => { localStorageData[key] = value; }),
                removeItem: vi.fn((key) => { delete localStorageData[key]; }),
            },
            writable: true,
        });

        // Mock window.eXeLearning
        window.eXeLearning = {
            config: { token: 'test-token' },
        };
    });

    afterEach(() => {
        delete window.eXeLearning;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should store httpClient, endpoints and basePath', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
            expect(adapter.basePath).toBe('/test');
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerUserPreferenceAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerUserPreferenceAdapter(mockHttpClient, {});
            expect(adapterWithoutPath.basePath).toBe('');
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_user_preferences_get'))
                .toBe('/api/user/preferences');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('_getAuthToken', () => {
        it('should get token from window.eXeLearning.config', () => {
            const token = adapter._getAuthToken();
            expect(token).toBe('test-token');
        });

        it('should fallback to localStorage', () => {
            delete window.eXeLearning;
            window.localStorage.getItem.mockReturnValue('local-token');

            const token = adapter._getAuthToken();
            expect(token).toBe('local-token');
        });

        it('should return null if no token available', () => {
            delete window.eXeLearning;
            window.localStorage.getItem.mockReturnValue(null);

            const token = adapter._getAuthToken();
            expect(token).toBeNull();
        });
    });

    describe('_authFetch', () => {
        it('should make authenticated request', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: 'test' }),
            });

            const result = await adapter._authFetch('http://test.com/api');

            expect(global.fetch).toHaveBeenCalledWith('http://test.com/api', {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer test-token',
                },
                credentials: 'include',
            });
            expect(result.data).toBe('test');
        });

        it('should handle 204 No Content response', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 204,
            });

            const result = await adapter._authFetch('http://test.com/api');

            expect(result).toEqual({ success: true });
        });

        it('should throw on non-ok response', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });

            await expect(adapter._authFetch('http://test.com/api'))
                .rejects.toThrow('Request failed: Unauthorized');
        });

        it('should work without token', async () => {
            delete window.eXeLearning;
            window.localStorage.getItem.mockReturnValue(null);

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: 'test' }),
            });

            await adapter._authFetch('http://test.com/api');

            expect(global.fetch).toHaveBeenCalledWith('http://test.com/api', {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
        });
    });

    describe('getPreferences', () => {
        it('should fetch preferences and merge with defaults', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    userPreferences: {
                        locale: { title: 'Language', value: 'es', type: 'select' },
                    },
                }),
            });

            const result = await adapter.getPreferences();

            expect(result.userPreferences.locale.value).toBe('es');
            expect(result.userPreferences.advancedMode).toBeDefined();
        });

        it('should return defaults on error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await adapter.getPreferences();

            expect(result.userPreferences).toBeDefined();
            expect(result.userPreferences.locale).toBeDefined();
        });

        it('should fallback to basePath URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerUserPreferenceAdapter(
                mockHttpClient, {}, '/api'
            );

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ userPreferences: {} }),
            });

            await adapterWithoutEndpoints.getPreferences();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/api/user/preferences',
                expect.any(Object)
            );
        });
    });

    describe('savePreferences', () => {
        it('should save preferences via PUT', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });

            const params = { locale: 'es' };
            const result = await adapter.savePreferences(params);

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/user/preferences',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(params),
                })
            );
            expect(result.success).toBe(true);
        });
    });

    describe('acceptLopd', () => {
        it('should call LOPD accept endpoint', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });

            const result = await adapter.acceptLopd();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/user/lopd/accept',
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.success).toBe(true);
        });

        it('should fallback to basePath URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerUserPreferenceAdapter(
                mockHttpClient, {}, '/api'
            );

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });

            await adapterWithoutEndpoints.acceptLopd();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/api/user/lopd/accept',
                expect.any(Object)
            );
        });
    });

    describe('isLopdAccepted', () => {
        it('should return true if LOPD is accepted', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    userPreferences: {
                        lopdAccepted: { value: true },
                    },
                }),
            });

            const result = await adapter.isLopdAccepted();

            expect(result).toBe(true);
        });

        it('should return false if LOPD not accepted', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    userPreferences: {
                        lopdAccepted: { value: false },
                    },
                }),
            });

            const result = await adapter.isLopdAccepted();

            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await adapter.isLopdAccepted();

            expect(result).toBe(false);
        });
    });

    describe('getPreference', () => {
        it('should return preference value', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    userPreferences: {
                        locale: { value: 'es' },
                    },
                }),
            });

            const result = await adapter.getPreference('locale');

            expect(result).toBe('es');
        });

        it('should return default value if preference not found', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ userPreferences: {} }),
            });

            const result = await adapter.getPreference('nonexistent', 'default');

            expect(result).toBe('default');
        });

        it('should return default value on error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await adapter.getPreference('locale', 'en');

            expect(result).toBe('en');
        });
    });

    describe('setPreference', () => {
        it('should save single preference', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });

            const result = await adapter.setPreference('locale', 'es');

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/user/preferences',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ locale: 'es' }),
                })
            );
            expect(result.success).toBe(true);
        });
    });
});
