import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerContentAdapter } from './ServerContentAdapter.js';

describe('ServerContentAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        mockEndpoints = {
            api_ode_page_edit: { path: '/api/page' },
            api_ode_page_reorder: { path: '/api/page/reorder' },
            api_ode_page_clone: { path: '/api/page/clone' },
            api_ode_page_delete: { path: '/api/page/{odeNavStructureSyncId}' },
            api_ode_block_reorder: { path: '/api/block/reorder' },
            api_ode_block_delete: { path: '/api/block/{odeBlockSyncId}' },
            api_idevices_idevice_reorder: { path: '/api/idevice/reorder' },
            api_idevices_idevice_data_save: { path: '/api/idevice/save' },
            api_idevices_idevice_clone: { path: '/api/idevice/clone' },
            api_idevices_idevice_delete: { path: '/api/idevice/{odeComponentsSyncId}' },
        };

        adapter = new ServerContentAdapter(mockHttpClient, mockEndpoints);

        window.eXeLearning = { config: { basePath: '' } };
    });

    afterEach(() => {
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should store httpClient and endpoints', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_ode_page_edit')).toBe('/api/page');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('savePage', () => {
        it('should save page using endpoint', async () => {
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.savePage({ pageId: '123', title: 'Test' });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/page',
                { pageId: '123', title: 'Test' },
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.savePage({ pageId: '123' });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/page',
                { pageId: '123' },
            );
        });
    });

    describe('reorderPage', () => {
        it('should reorder page using endpoint', async () => {
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.reorderPage({ order: [1, 2, 3] });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/page/reorder',
                { order: [1, 2, 3] },
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.reorderPage({});

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/page/reorder', {});
        });
    });

    describe('clonePage', () => {
        it('should clone page using endpoint', async () => {
            mockHttpClient.post.mockResolvedValue({ responseMessage: 'OK', newId: 'new-123' });

            const result = await adapter.clonePage({ pageId: '123' });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/page/clone',
                { pageId: '123' },
            );
            expect(result).toEqual({ responseMessage: 'OK', newId: 'new-123' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.post.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.clonePage({});

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/page/clone', {});
        });
    });

    describe('deletePage', () => {
        it('should delete page using endpoint with replaced placeholder', async () => {
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.deletePage('page-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/page/page-123');
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.deletePage('page-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/page/page-123');
        });
    });

    describe('reorderBlock', () => {
        it('should reorder block using endpoint', async () => {
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.reorderBlock({ order: [1, 2] });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/block/reorder',
                { order: [1, 2] },
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.reorderBlock({});

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/block/reorder', {});
        });
    });

    describe('deleteBlock', () => {
        it('should delete block using endpoint with replaced placeholder', async () => {
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.deleteBlock('block-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/block/block-123');
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.deleteBlock('block-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/block/block-123');
        });
    });

    describe('reorderIdevice', () => {
        it('should reorder iDevice using endpoint', async () => {
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.reorderIdevice({ order: [1, 2] });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/idevice/reorder',
                { order: [1, 2] },
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.reorderIdevice({});

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/idevice/reorder', {});
        });
    });

    describe('saveIdevice', () => {
        it('should save iDevice using endpoint', async () => {
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.saveIdevice({ ideviceId: '123', content: 'test' });

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/idevice/save',
                { ideviceId: '123', content: 'test' },
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.saveIdevice({});

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/idevice/save', {});
        });
    });

    describe('cloneIdevice', () => {
        it('should clone iDevice using endpoint', async () => {
            mockHttpClient.post.mockResolvedValue({ responseMessage: 'OK', newId: 'new-456' });

            const result = await adapter.cloneIdevice({ ideviceId: '123' });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/idevice/clone',
                { ideviceId: '123' },
            );
            expect(result).toEqual({ responseMessage: 'OK', newId: 'new-456' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.post.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.cloneIdevice({});

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/idevice/clone', {});
        });
    });

    describe('deleteIdevice', () => {
        it('should delete iDevice using endpoint with replaced placeholder', async () => {
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.deleteIdevice('idevice-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/idevice/idevice-123');
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerContentAdapter(mockHttpClient, {});
            mockHttpClient.delete.mockResolvedValue({ responseMessage: 'OK' });

            await adapterWithoutEndpoints.deleteIdevice('idevice-123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/idevice/idevice-123');
        });
    });

    describe('send', () => {
        it('should throw if endpoint not found', async () => {
            await expect(adapter.send('nonexistent', {})).rejects.toThrow('Endpoint not found');
        });

        it('should use GET method', async () => {
            adapter.endpoints.test_get = { path: '/api/test', method: 'GET' };
            mockHttpClient.get.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_get', {});

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/test');
            expect(result).toEqual({ data: 'test' });
        });

        it('should use POST method', async () => {
            adapter.endpoints.test_post = { path: '/api/test', method: 'POST' };
            mockHttpClient.post.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_post', { foo: 'bar' });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/test', { foo: 'bar' });
            expect(result).toEqual({ data: 'test' });
        });

        it('should use PUT method', async () => {
            adapter.endpoints.test_put = { path: '/api/test', method: 'PUT' };
            mockHttpClient.put.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_put', { foo: 'bar' });

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/test', { foo: 'bar' });
            expect(result).toEqual({ data: 'test' });
        });

        it('should use DELETE method', async () => {
            adapter.endpoints.test_delete = { path: '/api/test', method: 'DELETE' };
            mockHttpClient.delete.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_delete', {});

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/test');
            expect(result).toEqual({ data: 'test' });
        });

        it('should default to POST for unknown methods', async () => {
            adapter.endpoints.test_unknown = { path: '/api/test', method: 'PATCH' };
            mockHttpClient.post.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_unknown', { foo: 'bar' });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/test', { foo: 'bar' });
            expect(result).toEqual({ data: 'test' });
        });

        it('should use methods array if method not specified', async () => {
            adapter.endpoints.test_methods = { path: '/api/test', methods: ['POST'] };
            mockHttpClient.post.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_methods', {});

            expect(mockHttpClient.post).toHaveBeenCalled();
            expect(result).toEqual({ data: 'test' });
        });

        it('should default to GET if no method specified', async () => {
            adapter.endpoints.test_nomethod = { path: '/api/test' };
            mockHttpClient.get.mockResolvedValue({ data: 'test' });

            const result = await adapter.send('test_nomethod', {});

            expect(mockHttpClient.get).toHaveBeenCalled();
            expect(result).toEqual({ data: 'test' });
        });
    });
});
