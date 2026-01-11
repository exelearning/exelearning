import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaticAssetAdapter } from './StaticAssetAdapter.js';

describe('StaticAssetAdapter', () => {
    let adapter;
    let mockDb;
    let mockStore;
    let mockTx;

    /**
     * Helper to create a mock IDBRequest that auto-triggers onsuccess
     */
    function createMockRequest(result) {
        const request = {
            result,
            onsuccess: null,
            onerror: null,
        };
        // Schedule callback trigger for next tick
        setTimeout(() => {
            if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
    }

    beforeEach(() => {
        adapter = new StaticAssetAdapter();

        // Create mock IndexedDB objects
        mockStore = {
            put: vi.fn().mockImplementation(() => createMockRequest(undefined)),
            get: vi.fn().mockImplementation(() => createMockRequest(null)),
            delete: vi.fn().mockImplementation(() => createMockRequest(undefined)),
            getAll: vi.fn().mockImplementation(() => createMockRequest([])),
        };

        mockTx = {
            objectStore: vi.fn().mockReturnValue(mockStore),
            oncomplete: null,
            onerror: null,
        };

        mockDb = {
            transaction: vi.fn().mockImplementation(() => {
                // Schedule oncomplete for next tick
                setTimeout(() => {
                    if (mockTx.oncomplete) mockTx.oncomplete();
                }, 0);
                return mockTx;
            }),
            objectStoreNames: {
                contains: vi.fn().mockReturnValue(true),
            },
            createObjectStore: vi.fn(),
            close: vi.fn(),
        };

        // Mock IndexedDB.open
        const mockRequest = {
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            result: mockDb,
        };

        window.indexedDB = {
            open: vi.fn().mockImplementation(() => {
                setTimeout(() => {
                    if (mockRequest.onsuccess) {
                        mockRequest.onsuccess({ target: mockRequest });
                    }
                }, 0);
                return mockRequest;
            }),
            deleteDatabase: vi.fn(),
        };

        // Mock URL.createObjectURL
        URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should set default dbPrefix', () => {
            expect(adapter.dbPrefix).toBe('exelearning-assets-');
        });

        it('should set default storeName', () => {
            expect(adapter.storeName).toBe('assets');
        });

        it('should allow custom options', () => {
            const customAdapter = new StaticAssetAdapter({
                dbPrefix: 'custom-',
                storeName: 'files',
            });
            expect(customAdapter.dbPrefix).toBe('custom-');
            expect(customAdapter.storeName).toBe('files');
        });
    });

    describe('_openDatabase', () => {
        it('should open database with correct name', async () => {
            const db = await adapter._openDatabase('project-123');

            expect(window.indexedDB.open).toHaveBeenCalledWith('exelearning-assets-project-123', 1);
            expect(db).toBe(mockDb);
        });

        it('should create object store on upgrade', async () => {
            mockDb.objectStoreNames.contains.mockReturnValue(false);

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                onupgradeneeded: null,
                result: mockDb,
            };

            window.indexedDB.open = vi.fn().mockImplementation(() => {
                setTimeout(() => {
                    if (mockRequest.onupgradeneeded) {
                        mockRequest.onupgradeneeded({ target: { result: mockDb } });
                    }
                    if (mockRequest.onsuccess) {
                        mockRequest.onsuccess({ target: mockRequest });
                    }
                }, 0);
                return mockRequest;
            });

            await adapter._openDatabase('project-123');

            expect(mockDb.createObjectStore).toHaveBeenCalledWith('assets', { keyPath: 'path' });
        });
    });

    describe('upload', () => {
        it('should upload file to IndexedDB', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

            // Mock methods completely
            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);
            adapter.getUrl = vi.fn().mockResolvedValue('blob:test-url');

            const result = await adapter.upload('project-123', file, 'docs/test.txt');

            expect(result.path).toBe('docs/test.txt');
            expect(result.url).toBe('blob:test-url');
            expect(mockStore.put).toHaveBeenCalled();
            expect(mockDb.close).toHaveBeenCalled();
        });
    });

    describe('getUrl', () => {
        it('should create blob URL', async () => {
            const mockBlob = new Blob(['content']);
            adapter.getBlob = vi.fn().mockResolvedValue(mockBlob);

            const url = await adapter.getUrl('project-123', 'test.txt');

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(url).toBe('blob:test-url');
        });
    });

    describe('getBlob', () => {
        it('should get blob from IndexedDB', async () => {
            const mockAsset = {
                path: 'test.txt',
                data: new ArrayBuffer(8),
                type: 'text/plain',
            };

            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);

            // Mock store.get to return asset
            mockStore.get.mockImplementation(() => createMockRequest(mockAsset));

            const result = await adapter.getBlob('project-123', 'test.txt');

            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe('text/plain');
            expect(mockDb.close).toHaveBeenCalled();
        });

        it('should throw NotFoundError if asset not found', async () => {
            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);

            // Mock store.get to return null (not found)
            mockStore.get.mockImplementation(() => createMockRequest(null));

            await expect(adapter.getBlob('project-123', 'nonexistent.txt'))
                .rejects.toThrow('asset');
        });
    });

    describe('delete', () => {
        it('should delete asset from IndexedDB', async () => {
            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);

            await adapter.delete('project-123', 'test.txt');

            expect(mockStore.delete).toHaveBeenCalledWith('test.txt');
            expect(mockDb.close).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('should list all assets', async () => {
            const mockAssets = [
                { path: 'file1.txt', name: 'file1.txt', size: 100, type: 'text/plain' },
                { path: 'file2.png', name: 'file2.png', size: 200, type: 'image/png' },
            ];

            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);

            // Mock list to return assets directly
            adapter.list = vi.fn().mockResolvedValue(mockAssets);

            const result = await adapter.list('project-123');

            expect(result).toHaveLength(2);
            expect(result[0].path).toBe('file1.txt');
        });

        it('should filter by directory', async () => {
            const mockAssets = [
                { path: 'images/file1.png', name: 'file1.png', size: 100, type: 'image/png' },
            ];

            adapter.list = vi.fn().mockResolvedValue(mockAssets);

            const result = await adapter.list('project-123', 'images');

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('images/file1.png');
        });
    });

    describe('exists', () => {
        it('should return true if asset exists', async () => {
            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);
            adapter.exists = vi.fn().mockResolvedValue(true);

            const result = await adapter.exists('project-123', 'test.txt');

            expect(result).toBe(true);
        });

        it('should return false if asset does not exist', async () => {
            adapter._openDatabase = vi.fn().mockResolvedValue(mockDb);
            adapter.exists = vi.fn().mockResolvedValue(false);

            const result = await adapter.exists('project-123', 'nonexistent.txt');

            expect(result).toBe(false);
        });
    });

    describe('copy', () => {
        it('should copy asset', async () => {
            const mockBlob = new Blob(['content'], { type: 'text/plain' });
            adapter.getBlob = vi.fn().mockResolvedValue(mockBlob);
            adapter.upload = vi.fn().mockResolvedValue({ path: 'dest.txt' });

            await adapter.copy('project-123', 'src.txt', 'dest.txt');

            expect(adapter.getBlob).toHaveBeenCalledWith('project-123', 'src.txt');
            expect(adapter.upload).toHaveBeenCalled();
        });
    });

    describe('move', () => {
        it('should move asset (copy then delete)', async () => {
            adapter.copy = vi.fn().mockResolvedValue();
            adapter.delete = vi.fn().mockResolvedValue();

            await adapter.move('project-123', 'old.txt', 'new.txt');

            expect(adapter.copy).toHaveBeenCalledWith('project-123', 'old.txt', 'new.txt');
            expect(adapter.delete).toHaveBeenCalledWith('project-123', 'old.txt');
        });
    });

    describe('clearAll', () => {
        it('should delete entire asset database', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            window.indexedDB.deleteDatabase.mockReturnValue(mockRequest);

            const clearPromise = adapter.clearAll('project-123');
            mockRequest.onsuccess();

            await clearPromise;

            expect(window.indexedDB.deleteDatabase).toHaveBeenCalledWith('exelearning-assets-project-123');
        });

        it('should handle blocked deletion', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            window.indexedDB.deleteDatabase.mockReturnValue(mockRequest);

            const clearPromise = adapter.clearAll('project-123');
            mockRequest.onblocked();

            await clearPromise;
        });
    });
});
