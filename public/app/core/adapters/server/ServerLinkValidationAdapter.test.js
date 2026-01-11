import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerLinkValidationAdapter } from './ServerLinkValidationAdapter.js';

describe('ServerLinkValidationAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
        };

        mockEndpoints = {
            api_odes_session_get_broken_links: { path: '/api/odes/session/brokenlinks' },
            api_odes_pag_get_broken_links: { path: '/api/odes/page/{odePageId}/brokenlinks' },
            api_odes_block_get_broken_links: { path: '/api/odes/block/{odeBlockId}/brokenlinks' },
            api_odes_idevice_get_broken_links: { path: '/api/odes/idevice/{odeIdeviceId}/brokenlinks' },
        };

        adapter = new ServerLinkValidationAdapter(mockHttpClient, mockEndpoints, '/test');

        window.eXeLearning = {
            config: { baseURL: 'http://localhost:8083' },
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
            const adapterWithoutEndpoints = new ServerLinkValidationAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerLinkValidationAdapter(mockHttpClient, {});
            expect(adapterWithoutPath.basePath).toBe('');
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_odes_session_get_broken_links'))
                .toBe('/api/odes/session/brokenlinks');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('getSessionBrokenLinks', () => {
        it('should use endpoint if available', async () => {
            const params = { sessionId: '123' };
            mockHttpClient.post.mockResolvedValue({ brokenLinks: [] });

            const result = await adapter.getSessionBrokenLinks(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/odes/session/brokenlinks',
                params
            );
            expect(result.brokenLinks).toEqual([]);
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerLinkValidationAdapter(
                mockHttpClient, {}, '/test'
            );
            const params = { sessionId: '123' };
            mockHttpClient.post.mockResolvedValue({ brokenLinks: [] });

            await adapterWithoutEndpoints.getSessionBrokenLinks(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/ode-management/odes/session/brokenlinks',
                params
            );
        });
    });

    describe('extractLinks', () => {
        it('should call correct URL', async () => {
            const params = { sessionId: '123', content: '<a href="test">Test</a>' };
            mockHttpClient.post.mockResolvedValue({ links: [], totalLinks: 0 });

            const result = await adapter.extractLinks(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/ode-management/odes/session/brokenlinks/extract',
                params
            );
            expect(result.links).toEqual([]);
        });
    });

    describe('getValidationStreamUrl', () => {
        it('should return correct stream URL', () => {
            const url = adapter.getValidationStreamUrl();

            expect(url).toBe(
                'http://localhost:8083/test/api/ode-management/odes/session/brokenlinks/validate-stream'
            );
        });

        it('should handle missing baseURL', () => {
            delete window.eXeLearning;
            const url = adapter.getValidationStreamUrl();

            expect(url).toBe('/test/api/ode-management/odes/session/brokenlinks/validate-stream');
        });
    });

    describe('getPageBrokenLinks', () => {
        it('should use endpoint with pageId substitution', async () => {
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapter.getPageBrokenLinks('page-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/odes/page/page-123/brokenlinks'
            );
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerLinkValidationAdapter(
                mockHttpClient, {}, '/test'
            );
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapterWithoutEndpoints.getPageBrokenLinks('page-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/ode-management/odes/page/page-123/brokenlinks'
            );
        });
    });

    describe('getBlockBrokenLinks', () => {
        it('should use endpoint with blockId substitution', async () => {
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapter.getBlockBrokenLinks('block-456');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/odes/block/block-456/brokenlinks'
            );
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerLinkValidationAdapter(
                mockHttpClient, {}, '/test'
            );
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapterWithoutEndpoints.getBlockBrokenLinks('block-456');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/ode-management/odes/block/block-456/brokenlinks'
            );
        });
    });

    describe('getIdeviceBrokenLinks', () => {
        it('should use endpoint with ideviceId substitution', async () => {
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapter.getIdeviceBrokenLinks('idevice-789');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/odes/idevice/idevice-789/brokenlinks'
            );
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerLinkValidationAdapter(
                mockHttpClient, {}, '/test'
            );
            mockHttpClient.get.mockResolvedValue({ brokenLinks: [] });

            await adapterWithoutEndpoints.getIdeviceBrokenLinks('idevice-789');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/ode-management/odes/idevice/idevice-789/brokenlinks'
            );
        });
    });

    describe('isSupported', () => {
        it('should return true', () => {
            expect(adapter.isSupported()).toBe(true);
        });
    });
});
