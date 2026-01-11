import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerPlatformIntegrationAdapter } from './ServerPlatformIntegrationAdapter.js';

describe('ServerPlatformIntegrationAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            post: vi.fn(),
        };

        mockEndpoints = {
            set_platform_new_ode: { path: '/api/platform/ode/new' },
            open_platform_elp: { path: '/api/platform/elp/open' },
        };

        adapter = new ServerPlatformIntegrationAdapter(mockHttpClient, mockEndpoints);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should store httpClient and endpoints', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerPlatformIntegrationAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('set_platform_new_ode'))
                .toBe('/api/platform/ode/new');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('uploadElp', () => {
        it('should call http.post with correct endpoint and params', async () => {
            const params = { elpData: 'base64data', filename: 'project.elp' };
            mockHttpClient.post.mockResolvedValue({ success: true, url: 'https://lms.example.com/resource/123' });

            const result = await adapter.uploadElp(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/platform/ode/new', params);
            expect(result.success).toBe(true);
            expect(result.url).toBe('https://lms.example.com/resource/123');
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerPlatformIntegrationAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.uploadElp({});

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED' });
            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });
    });

    describe('openElp', () => {
        it('should call http.post with correct endpoint and params', async () => {
            const params = { resourceId: '123', platform: 'moodle' };
            mockHttpClient.post.mockResolvedValue({ success: true, elpData: 'base64data' });

            const result = await adapter.openElp(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/platform/elp/open', params);
            expect(result.success).toBe(true);
            expect(result.elpData).toBe('base64data');
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerPlatformIntegrationAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.openElp({});

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED' });
            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });
    });

    describe('isSupported', () => {
        it('should return true', () => {
            expect(adapter.isSupported()).toBe(true);
        });
    });
});
