import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaticProjectRepository } from './StaticProjectRepository.js';

describe('StaticProjectRepository', () => {
    let repo;
    let mockIndexedDB;

    beforeEach(() => {
        repo = new StaticProjectRepository();

        // Mock IndexedDB
        mockIndexedDB = {
            databases: vi.fn(),
            open: vi.fn(),
            deleteDatabase: vi.fn(),
        };
        window.indexedDB = mockIndexedDB;

        // Mock crypto.randomUUID
        crypto.randomUUID = vi.fn().mockReturnValue('test-uuid-123');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should set default dbPrefix', () => {
            expect(repo.dbPrefix).toBe('exelearning-project-');
        });

        it('should allow custom dbPrefix', () => {
            const customRepo = new StaticProjectRepository({ dbPrefix: 'custom-' });
            expect(customRepo.dbPrefix).toBe('custom-');
        });
    });

    describe('list', () => {
        it('should return empty array if databases() not supported', async () => {
            delete window.indexedDB.databases;

            const result = await repo.list();

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            mockIndexedDB.databases.mockRejectedValue(new Error('Error'));

            const result = await repo.list();

            expect(result).toEqual([]);
        });

        it('should filter and return project databases', async () => {
            mockIndexedDB.databases.mockResolvedValue([
                { name: 'exelearning-project-uuid1' },
                { name: 'exelearning-project-uuid2' },
                { name: 'other-database' },
            ]);

            // Mock _getProjectMetadata
            repo._getProjectMetadata = vi.fn()
                .mockResolvedValueOnce({ title: 'Project 1', updatedAt: '2024-01-02' })
                .mockResolvedValueOnce({ title: 'Project 2', updatedAt: '2024-01-01' });

            const result = await repo.list();

            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('Project 1');
            expect(result[1].title).toBe('Project 2');
        });
    });

    describe('get', () => {
        it('should return null if project not found', async () => {
            repo._getProjectMetadata = vi.fn().mockResolvedValue(null);

            const result = await repo.get('nonexistent');

            expect(result).toBeNull();
        });

        it('should return project with metadata', async () => {
            repo._getProjectMetadata = vi.fn().mockResolvedValue({
                title: 'Test Project',
                updatedAt: '2024-01-01',
            });

            const result = await repo.get('test-uuid');

            expect(result).toEqual({
                uuid: 'test-uuid',
                id: 'test-uuid',
                title: 'Test Project',
                updatedAt: '2024-01-01',
                isLocal: true,
            });
        });

        it('should return null on error', async () => {
            repo._getProjectMetadata = vi.fn().mockRejectedValue(new Error('Error'));

            const result = await repo.get('test-uuid');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should create project with UUID', async () => {
            repo._saveProjectMetadata = vi.fn().mockResolvedValue();

            const result = await repo.create({ title: 'New Project' });

            expect(result.uuid).toBe('test-uuid-123');
            expect(result.title).toBe('New Project');
            expect(result.isLocal).toBe(true);
            expect(repo._saveProjectMetadata).toHaveBeenCalled();
        });

        it('should use provided UUID if given', async () => {
            repo._saveProjectMetadata = vi.fn().mockResolvedValue();

            const result = await repo.create({ uuid: 'custom-uuid', title: 'Test' });

            expect(result.uuid).toBe('custom-uuid');
        });

        it('should default title to Untitled Project', async () => {
            repo._saveProjectMetadata = vi.fn().mockResolvedValue();

            const result = await repo.create({});

            expect(result.title).toBe('Untitled Project');
        });
    });

    describe('update', () => {
        it('should throw if project not found', async () => {
            repo.get = vi.fn().mockResolvedValue(null);

            await expect(repo.update('nonexistent', {})).rejects.toThrow();
        });

        it('should update project metadata', async () => {
            repo.get = vi.fn().mockResolvedValue({
                uuid: 'test-uuid',
                title: 'Old Title',
            });
            repo._saveProjectMetadata = vi.fn().mockResolvedValue();

            const result = await repo.update('test-uuid', { title: 'New Title' });

            expect(result.title).toBe('New Title');
            expect(result.isLocal).toBe(true);
        });
    });

    describe('delete', () => {
        it('should delete project database', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            mockIndexedDB.deleteDatabase.mockReturnValue(mockRequest);

            const deletePromise = repo.delete('test-uuid');
            mockRequest.onsuccess();

            await deletePromise;

            expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('exelearning-project-test-uuid');
        });

        it('should handle blocked deletion', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            mockIndexedDB.deleteDatabase.mockReturnValue(mockRequest);

            const deletePromise = repo.delete('test-uuid');
            mockRequest.onblocked();

            await deletePromise;
        });
    });

    describe('getRecent', () => {
        it('should return limited number of projects', async () => {
            repo.list = vi.fn().mockResolvedValue([
                { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' },
            ]);

            const result = await repo.getRecent(2);

            expect(result).toHaveLength(2);
        });

        it('should default to 3 projects', async () => {
            repo.list = vi.fn().mockResolvedValue([
                { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' },
            ]);

            const result = await repo.getRecent();

            expect(result).toHaveLength(3);
        });
    });

    describe('exists', () => {
        it('should return true if project exists', async () => {
            repo.get = vi.fn().mockResolvedValue({ id: 'test' });

            const result = await repo.exists('test');

            expect(result).toBe(true);
        });

        it('should return false if project not found', async () => {
            repo.get = vi.fn().mockResolvedValue(null);

            const result = await repo.exists('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('save', () => {
        it('should return OK for static mode', async () => {
            const result = await repo.save('session', {});

            expect(result).toEqual({ responseMessage: 'OK', staticMode: true });
        });
    });

    describe('autoSave', () => {
        it('should be no-op in static mode', async () => {
            await repo.autoSave('session', {});
            // Should not throw
        });
    });

    describe('saveAs', () => {
        it('should return OK for static mode', async () => {
            const result = await repo.saveAs('session', {});

            expect(result).toEqual({ responseMessage: 'OK', staticMode: true });
        });
    });

    describe('duplicate', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await repo.duplicate('123');

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' });
        });
    });

    describe('getLastUpdated', () => {
        it('should return metadata updatedAt', async () => {
            repo._getProjectMetadata = vi.fn().mockResolvedValue({
                updatedAt: '2024-01-01',
            });

            const result = await repo.getLastUpdated('test-uuid');

            expect(result).toEqual({ lastUpdated: '2024-01-01', staticMode: true });
        });

        it('should return null on error', async () => {
            repo._getProjectMetadata = vi.fn().mockRejectedValue(new Error('Error'));

            const result = await repo.getLastUpdated('test-uuid');

            expect(result).toEqual({ lastUpdated: null });
        });
    });

    describe('getConcurrentUsers', () => {
        it('should return empty users in static mode', async () => {
            const result = await repo.getConcurrentUsers('id', 'v', 's');

            expect(result).toEqual({ users: [], staticMode: true });
        });
    });

    describe('closeSession', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.closeSession({});

            expect(result).toEqual({ responseMessage: 'OK', staticMode: true });
        });
    });

    describe('joinSession', () => {
        it('should return available true in static mode', async () => {
            const result = await repo.joinSession('session');

            expect(result).toEqual({ available: true, staticMode: true });
        });
    });

    describe('checkCurrentUsers', () => {
        it('should return 0 users in static mode', async () => {
            const result = await repo.checkCurrentUsers({});

            expect(result).toEqual({ responseMessage: 'OK', currentUsers: 0, staticMode: true });
        });
    });

    describe('openFile', () => {
        it('should return OK in static mode', async () => {
            window.eXeLearning = { projectId: 'current-project' };

            const result = await repo.openFile('test.elp');

            expect(result).toEqual({ responseMessage: 'OK', odeSessionId: 'current-project' });

            delete window.eXeLearning;
        });
    });

    describe('openLocalFile', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.openLocalFile({});

            expect(result.responseMessage).toBe('OK');
        });
    });

    describe('openLargeLocalFile', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.openLargeLocalFile({});

            expect(result.responseMessage).toBe('OK');
        });
    });

    describe('getLocalProperties', () => {
        it('should return empty properties', async () => {
            const result = await repo.getLocalProperties({});

            expect(result).toEqual({ responseMessage: 'OK', properties: {} });
        });
    });

    describe('getLocalComponents', () => {
        it('should return empty components', async () => {
            const result = await repo.getLocalComponents({});

            expect(result).toEqual({ responseMessage: 'OK', components: [] });
        });
    });

    describe('importToRoot', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.importToRoot({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('importToRootFromLocal', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.importToRootFromLocal({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('importAsChild', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.importAsChild('nav', {});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('openMultipleLocalFiles', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.openMultipleLocalFiles({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('deleteByDate', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.deleteByDate({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('cleanAutosaves', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.cleanAutosaves({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('getStructure', () => {
        it('should return null structure in static mode', async () => {
            const result = await repo.getStructure('v', 's');

            expect(result).toEqual({ structure: null });
        });
    });

    describe('getProperties', () => {
        it('should return bundled config properties', async () => {
            window.eXeLearning = {
                app: {
                    apiCallManager: {
                        parameters: {
                            odeProjectSyncPropertiesConfig: { key: 'value' },
                        },
                    },
                },
            };

            const result = await repo.getProperties('session');

            expect(result).toEqual({
                responseMessage: 'OK',
                properties: { key: 'value' },
            });

            delete window.eXeLearning;
        });
    });

    describe('saveProperties', () => {
        it('should return OK in static mode', async () => {
            const result = await repo.saveProperties({});

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('getUsedFiles', () => {
        it('should return empty files', async () => {
            const result = await repo.getUsedFiles({});

            expect(result).toEqual({ responseMessage: 'OK', usedFiles: [] });
        });
    });
});
