import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpClient } from './HttpClient.js';
import { NetworkError, AuthError } from './errors.js';

describe('HttpClient', () => {
    let client;
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        client = new HttpClient('https://api.example.com');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should store base URL', () => {
            expect(client.baseUrl).toBe('https://api.example.com');
        });

        it('should remove trailing slash from base URL', () => {
            const clientWithSlash = new HttpClient('https://api.example.com/');
            expect(clientWithSlash.baseUrl).toBe('https://api.example.com');
        });
    });

    describe('_buildUrl', () => {
        it('should build URL with path starting with slash', () => {
            expect(client._buildUrl('/users')).toBe('https://api.example.com/users');
        });

        it('should build URL with path without leading slash', () => {
            expect(client._buildUrl('users')).toBe('https://api.example.com/users');
        });

        it('should return absolute URLs unchanged', () => {
            expect(client._buildUrl('https://other.com/api')).toBe('https://other.com/api');
            expect(client._buildUrl('http://other.com/api')).toBe('http://other.com/api');
        });
    });

    describe('get', () => {
        it('should make GET request', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ data: 'test' }),
            });

            const result = await client.get('/users');

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'GET',
                    credentials: 'include',
                }),
            );
            expect(result).toEqual({ data: 'test' });
        });
    });

    describe('post', () => {
        it('should make POST request with JSON data', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ id: 1 }),
            });

            const result = await client.post('/users', { name: 'Test' });

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test' }),
                }),
            );
            expect(result).toEqual({ id: 1 });
        });

        it('should make POST request with FormData', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ success: true }),
            });

            const formData = new FormData();
            formData.append('file', 'test');

            await client.post('/upload', formData);

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/upload',
                expect.objectContaining({
                    method: 'POST',
                    body: formData,
                }),
            );
        });
    });

    describe('put', () => {
        it('should make PUT request', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ updated: true }),
            });

            await client.put('/users/1', { name: 'Updated' });

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ name: 'Updated' }),
                }),
            );
        });
    });

    describe('patch', () => {
        it('should make PATCH request', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ patched: true }),
            });

            await client.patch('/users/1', { name: 'Patched' });

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'PATCH',
                }),
            );
        });
    });

    describe('delete', () => {
        it('should make DELETE request', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 204,
            });

            const result = await client.delete('/users/1');

            expect(fetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'DELETE',
                }),
            );
            expect(result).toBeNull();
        });
    });

    describe('downloadBlob', () => {
        it('should download and return blob', async () => {
            const mockBlob = new Blob(['test content']);
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(mockBlob),
            });

            const result = await client.downloadBlob('/files/test.pdf');

            expect(fetch).toHaveBeenCalledWith('https://api.example.com/files/test.pdf', {
                method: 'GET',
                credentials: 'include',
            });
            expect(result).toBe(mockBlob);
        });

        it('should throw NetworkError on failure', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            await expect(client.downloadBlob('/files/missing.pdf')).rejects.toThrow(NetworkError);
            await expect(client.downloadBlob('/files/missing.pdf')).rejects.toThrow(
                'Download failed: Not Found',
            );
        });
    });

    describe('upload', () => {
        it('should upload without progress callback using fetch', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ uploaded: true }),
            });

            const formData = new FormData();
            const result = await client.upload('/upload', formData);

            expect(fetch).toHaveBeenCalled();
            expect(result).toEqual({ uploaded: true });
        });

        it('should upload with progress callback using XMLHttpRequest', async () => {
            const mockXhr = {
                open: vi.fn(),
                send: vi.fn(),
                upload: {
                    addEventListener: vi.fn(),
                },
                addEventListener: vi.fn(),
                withCredentials: false,
                status: 200,
                responseText: JSON.stringify({ uploaded: true }),
            };

            // Create a proper constructor function
            const MockXHR = function () {
                return mockXhr;
            };
            global.XMLHttpRequest = MockXHR;

            const progressCallback = vi.fn();
            const formData = new FormData();
            const uploadPromise = client.upload('/upload', formData, progressCallback);

            // Simulate load event
            const loadHandler = mockXhr.addEventListener.mock.calls.find(
                (call) => call[0] === 'load',
            )[1];
            loadHandler();

            const result = await uploadPromise;

            expect(mockXhr.open).toHaveBeenCalledWith('POST', 'https://api.example.com/upload');
            expect(mockXhr.withCredentials).toBe(true);
            expect(result).toEqual({ uploaded: true });
        });

        it('should call progress callback when upload progresses', async () => {
            const mockXhr = {
                open: vi.fn(),
                send: vi.fn(),
                upload: {
                    addEventListener: vi.fn(),
                },
                addEventListener: vi.fn(),
                withCredentials: false,
                status: 200,
                responseText: JSON.stringify({ uploaded: true }),
            };

            const MockXHR = function () {
                return mockXhr;
            };
            global.XMLHttpRequest = MockXHR;

            const progressCallback = vi.fn();
            const formData = new FormData();
            const uploadPromise = client.upload('/upload', formData, progressCallback);

            // Simulate progress event
            const progressHandler = mockXhr.upload.addEventListener.mock.calls.find(
                (call) => call[0] === 'progress',
            )[1];
            progressHandler({ lengthComputable: true, loaded: 50, total: 100 });

            expect(progressCallback).toHaveBeenCalledWith(0.5);

            // Complete the upload
            const loadHandler = mockXhr.addEventListener.mock.calls.find(
                (call) => call[0] === 'load',
            )[1];
            loadHandler();

            await uploadPromise;
        });

        it('should handle non-JSON response from XHR upload', async () => {
            const mockXhr = {
                open: vi.fn(),
                send: vi.fn(),
                upload: { addEventListener: vi.fn() },
                addEventListener: vi.fn(),
                withCredentials: false,
                status: 200,
                responseText: 'plain text response',
            };

            const MockXHR = function () {
                return mockXhr;
            };
            global.XMLHttpRequest = MockXHR;

            const uploadPromise = client.upload('/upload', new FormData(), vi.fn());

            const loadHandler = mockXhr.addEventListener.mock.calls.find(
                (call) => call[0] === 'load',
            )[1];
            loadHandler();

            const result = await uploadPromise;
            expect(result).toBe('plain text response');
        });

        it('should reject on XHR upload failure', async () => {
            const mockXhr = {
                open: vi.fn(),
                send: vi.fn(),
                upload: { addEventListener: vi.fn() },
                addEventListener: vi.fn(),
                withCredentials: false,
                status: 500,
                statusText: 'Server Error',
            };

            const MockXHR = function () {
                return mockXhr;
            };
            global.XMLHttpRequest = MockXHR;

            const uploadPromise = client.upload('/upload', new FormData(), vi.fn());

            const loadHandler = mockXhr.addEventListener.mock.calls.find(
                (call) => call[0] === 'load',
            )[1];
            loadHandler();

            await expect(uploadPromise).rejects.toThrow(NetworkError);
        });

        it('should reject on XHR network error', async () => {
            const mockXhr = {
                open: vi.fn(),
                send: vi.fn(),
                upload: { addEventListener: vi.fn() },
                addEventListener: vi.fn(),
                withCredentials: false,
            };

            const MockXHR = function () {
                return mockXhr;
            };
            global.XMLHttpRequest = MockXHR;

            const uploadPromise = client.upload('/upload', new FormData(), vi.fn());

            const errorHandler = mockXhr.addEventListener.mock.calls.find(
                (call) => call[0] === 'error',
            )[1];
            errorHandler();

            await expect(uploadPromise).rejects.toThrow('Upload failed: Network error');
        });
    });

    describe('_request error handling', () => {
        it('should throw AuthError on 401', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            });

            await expect(client.get('/protected')).rejects.toThrow(AuthError);
            await expect(client.get('/protected')).rejects.toThrow('Session expired');
        });

        it('should throw AuthError on 403', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
            });

            await expect(client.get('/admin')).rejects.toThrow(AuthError);
            await expect(client.get('/admin')).rejects.toThrow('Access denied');
        });

        it('should throw NetworkError with response message on failure', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: () => Promise.resolve({ message: 'Invalid data' }),
            });

            await expect(client.post('/data', {})).rejects.toThrow(NetworkError);
            await expect(client.post('/data', {})).rejects.toThrow('Invalid data');
        });

        it('should throw NetworkError with statusText when JSON parse fails', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.reject(new Error('Invalid JSON')),
            });

            await expect(client.get('/error')).rejects.toThrow('Request failed: Internal Server Error');
        });

        it('should throw NetworkError on network failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

            await expect(client.get('/api')).rejects.toThrow(NetworkError);
            await expect(client.get('/api')).rejects.toThrow('Network error: Failed to fetch');
        });

        it('should re-throw NetworkError and AuthError as-is', async () => {
            const networkError = new NetworkError('Test error');
            global.fetch = vi.fn().mockRejectedValue(networkError);

            await expect(client.get('/api')).rejects.toBe(networkError);
        });
    });

    describe('_request response handling', () => {
        it('should return null for 204 No Content', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 204,
            });

            const result = await client.delete('/item/1');
            expect(result).toBeNull();
        });

        it('should parse JSON response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ data: 'json' }),
            });

            const result = await client.get('/data');
            expect(result).toEqual({ data: 'json' });
        });

        it('should return text for non-JSON response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/plain']]),
                text: () => Promise.resolve('plain text'),
            });

            const result = await client.get('/text');
            expect(result).toBe('plain text');
        });

        it('should return text when content-type is missing', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map(),
                text: () => Promise.resolve('no content type'),
            });

            const result = await client.get('/unknown');
            expect(result).toBe('no content type');
        });
    });

    describe('default export', () => {
        it('should export HttpClient as default', async () => {
            const module = await import('./HttpClient.js');
            expect(module.default).toBe(HttpClient);
        });
    });
});
