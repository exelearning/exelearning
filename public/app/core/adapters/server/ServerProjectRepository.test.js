import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerProjectRepository } from './ServerProjectRepository.js';

describe('ServerProjectRepository', () => {
    let repo;
    let mockHttpClient;

    beforeEach(() => {
        mockHttpClient = {
            baseUrl: 'http://localhost:8083',
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        repo = new ServerProjectRepository(mockHttpClient, '/test');

        // Mock fetch
        global.fetch = vi.fn();

        // Mock localStorage
        const localStorageData = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn((key) => localStorageData[key] || null),
                setItem: vi.fn((key, value) => { localStorageData[key] = value; }),
                removeItem: vi.fn((key) => { delete localStorageData[key]; }),
                clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]); }),
            },
            writable: true,
        });

        // Mock window.eXeLearning for auth token
        window.eXeLearning = {
            config: { token: 'test-token' },
        };
    });

    afterEach(() => {
        delete window.eXeLearning;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should store httpClient and basePath', () => {
            expect(repo.http).toBe(mockHttpClient);
            expect(repo.basePath).toBe('/test');
        });

        it('should default basePath to empty string', () => {
            const repoWithoutPath = new ServerProjectRepository(mockHttpClient);
            expect(repoWithoutPath.basePath).toBe('');
        });
    });

    describe('_getAuthToken', () => {
        it('should get token from window.eXeLearning.config', () => {
            const token = repo._getAuthToken();
            expect(token).toBe('test-token');
        });

        it('should fallback to localStorage', () => {
            delete window.eXeLearning;
            window.localStorage.getItem.mockReturnValue('local-token');

            const token = repo._getAuthToken();
            expect(token).toBe('local-token');
        });

        it('should return null if no token available', () => {
            delete window.eXeLearning;
            window.localStorage.getItem.mockReturnValue(null);

            const token = repo._getAuthToken();
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

            const result = await repo._authFetch('http://test.com/api');

            expect(global.fetch).toHaveBeenCalledWith('http://test.com/api', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token',
                },
                credentials: 'include',
            });
            expect(result).toEqual({ data: 'test' });
        });

        it('should return null for 204 status', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 204,
            });

            const result = await repo._authFetch('http://test.com/api');
            expect(result).toBeNull();
        });

        it('should throw NotFoundError for 404', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            await expect(repo._authFetch('http://test.com/api')).rejects.toThrow();
        });

        it('should throw NetworkError for other errors', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Server Error',
            });

            await expect(repo._authFetch('http://test.com/api')).rejects.toThrow();
        });
    });

    describe('list', () => {
        it('should return project list', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    odeFiles: {
                        odeFilesSync: [{ id: '1', title: 'Project 1' }],
                    },
                }),
            });

            const result = await repo.list();

            expect(result).toEqual([{ id: '1', title: 'Project 1' }]);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await repo.list();

            expect(result).toEqual([]);
        });
    });

    describe('get', () => {
        it('should return project by id', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ id: '123', title: 'Test' }),
            });

            const result = await repo.get('123');

            expect(result).toEqual({ id: '123', title: 'Test' });
        });

        it('should return null for not found', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            const result = await repo.get('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should create project with POST request', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ uuid: 'new-uuid', title: 'New Project' }),
            });

            const result = await repo.create({ title: 'New Project' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/project/create-quick'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ title: 'New Project' }),
                }),
            );
            expect(result).toEqual({ uuid: 'new-uuid', title: 'New Project' });
        });
    });

    describe('update', () => {
        it('should update project with PUT request', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ id: '123', title: 'Updated' }),
            });

            const result = await repo.update('123', { title: 'Updated' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/projects/123'),
                expect.objectContaining({
                    method: 'PUT',
                }),
            );
            expect(result).toEqual({ id: '123', title: 'Updated' });
        });
    });

    describe('delete', () => {
        it('should delete project with POST request', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });

            await repo.delete('123');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/remove-file'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ odeFileId: '123' }),
                }),
            );
        });
    });

    describe('getRecent', () => {
        it('should return recent projects', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve([{ id: '1' }, { id: '2' }]),
            });

            const result = await repo.getRecent(3);

            expect(result).toEqual([{ id: '1' }, { id: '2' }]);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockRejectedValue(new Error('Error'));

            const result = await repo.getRecent();

            expect(result).toEqual([]);
        });
    });

    describe('exists', () => {
        it('should return true if project exists', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ id: '123' }),
            });

            const result = await repo.exists('123');

            expect(result).toBe(true);
        });

        it('should return false if project not found', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            const result = await repo.exists('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('joinSession', () => {
        it('should join session', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ available: true }),
            });

            const result = await repo.joinSession('session-123');

            expect(result).toEqual({ available: true });
        });
    });

    describe('checkCurrentUsers', () => {
        it('should check current users', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ currentUsers: 2 }),
            });

            const result = await repo.checkCurrentUsers({ sessionId: 'test' });

            expect(result).toEqual({ currentUsers: 2 });
        });
    });

    describe('save', () => {
        it('should save project', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.save('session-123', { data: 'test' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/ode/session-123/save/manual'),
                expect.any(Object),
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('autoSave', () => {
        it('should autosave without waiting', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            // autoSave doesn't return anything (fire and forget)
            await repo.autoSave('session-123', { data: 'test' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/ode/session-123/save/auto'),
                expect.any(Object),
            );
        });
    });

    describe('saveAs', () => {
        it('should save as new project', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK', newId: 'new-123' }),
            });

            const result = await repo.saveAs('session-123', { title: 'Copy' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/ode/session-123/save-as'),
                expect.any(Object),
            );
            expect(result).toEqual({ responseMessage: 'OK', newId: 'new-123' });
        });
    });

    describe('duplicate', () => {
        it('should duplicate project', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.duplicate('123');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/duplicate'),
                expect.objectContaining({
                    body: JSON.stringify({ odeFileId: '123' }),
                }),
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('getLastUpdated', () => {
        it('should get last updated timestamp', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ lastUpdated: '2024-01-01' }),
            });

            const result = await repo.getLastUpdated('123');

            expect(result).toEqual({ lastUpdated: '2024-01-01' });
        });

        it('should return null on error', async () => {
            global.fetch.mockRejectedValue(new Error('Error'));

            const result = await repo.getLastUpdated('123');

            expect(result).toEqual({ lastUpdated: null });
        });
    });

    describe('getConcurrentUsers', () => {
        it('should get concurrent users via GET with query param', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ currentUsers: [{ id: '1' }] }),
            });

            const result = await repo.getConcurrentUsers('123', 'v1', 'session-id');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/odes/current-users?odeSessionId=session-id',
                expect.any(Object)
            );
            expect(result).toEqual({ users: [{ id: '1' }] });
        });

        it('should return empty users when currentUsers is missing', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            });

            const result = await repo.getConcurrentUsers('123', 'v1', 'session');

            expect(result).toEqual({ users: [] });
        });

        it('should return empty users on error', async () => {
            global.fetch.mockRejectedValue(new Error('Error'));

            const result = await repo.getConcurrentUsers('123', 'v1', 'session');

            expect(result).toEqual({ users: [] });
        });
    });

    describe('closeSession', () => {
        it('should close session', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.closeSession({ sessionId: 'test' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('openFile', () => {
        it('should open file', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ odeSessionId: 'new-session' }),
            });

            const result = await repo.openFile('test.elp');

            expect(result).toEqual({ odeSessionId: 'new-session' });
        });
    });

    describe('openLocalFile', () => {
        it('should open local file', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ odeSessionId: 'local-session' }),
            });

            const result = await repo.openLocalFile({ content: 'test' });

            expect(result).toEqual({ odeSessionId: 'local-session' });
        });
    });

    describe('openLargeLocalFile', () => {
        it('should open large local file with FormData', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ odeSessionId: 'large-session' }),
            });

            const formData = new FormData();
            const result = await repo.openLargeLocalFile(formData);

            expect(result).toEqual({ odeSessionId: 'large-session' });
        });

        it('should throw on error', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Error',
            });

            const formData = new FormData();
            await expect(repo.openLargeLocalFile(formData)).rejects.toThrow();
        });
    });

    describe('getLocalProperties', () => {
        it('should get local properties', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ properties: {} }),
            });

            const result = await repo.getLocalProperties({ data: 'test' });

            expect(result).toEqual({ properties: {} });
        });
    });

    describe('getLocalComponents', () => {
        it('should get local components', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ components: [] }),
            });

            const result = await repo.getLocalComponents({ data: 'test' });

            expect(result).toEqual({ components: [] });
        });
    });

    describe('importToRoot', () => {
        it('should import to root with FormData', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const formData = new FormData();
            const result = await repo.importToRoot(formData);

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('importToRootFromLocal', () => {
        it('should import to root from local', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.importToRootFromLocal({ data: 'test' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('importAsChild', () => {
        it('should import as child', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.importAsChild('nav-123', { data: 'test' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/nav-structure-management/nav-structures/nav-123/import-elp'),
                expect.any(Object),
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('openMultipleLocalFiles', () => {
        it('should open multiple local files', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.openMultipleLocalFiles({ files: [] });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('deleteByDate', () => {
        it('should delete by date', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.deleteByDate({ before: '2024-01-01' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('cleanAutosaves', () => {
        it('should clean autosaves', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.cleanAutosaves({ sessionId: 'test' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('should handle errors gracefully', async () => {
            global.fetch.mockRejectedValue(new Error('Error'));

            const result = await repo.cleanAutosaves({ sessionId: 'test' });

            expect(result).toEqual({ success: true, message: 'Cleanup skipped' });
        });
    });

    describe('getStructure', () => {
        it('should get structure', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ structure: {} }),
            });

            const result = await repo.getStructure('v1', 'session');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/nav-structure-management/nav-structures/v1/session'),
                expect.any(Object),
            );
            expect(result).toEqual({ structure: {} });
        });
    });

    describe('getProperties', () => {
        it('should get properties', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ properties: {} }),
            });

            const result = await repo.getProperties('session');

            expect(result).toEqual({ properties: {} });
        });
    });

    describe('saveProperties', () => {
        it('should save properties', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ responseMessage: 'OK' }),
            });

            const result = await repo.saveProperties({ title: 'Test' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/ode-management/odes/properties/save'),
                expect.objectContaining({
                    method: 'PUT',
                }),
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('getUsedFiles', () => {
        it('should get used files', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ files: [] }),
            });

            const result = await repo.getUsedFiles({ sessionId: 'test' });

            expect(result).toEqual({ files: [] });
        });
    });
});
