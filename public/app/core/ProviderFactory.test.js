import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    ProviderFactory,
    ServerProviderFactory,
    StaticProviderFactory,
} from './ProviderFactory.js';

// Create class-based mocks for server adapters
vi.mock('./adapters/server/ServerProjectRepository.js', () => ({
    ServerProjectRepository: class { constructor() { this.type = 'ServerProjectRepository'; } },
}));
vi.mock('./adapters/server/ServerCatalogAdapter.js', () => ({
    ServerCatalogAdapter: class { constructor() { this.type = 'ServerCatalogAdapter'; } },
}));
vi.mock('./adapters/server/ServerAssetAdapter.js', () => ({
    ServerAssetAdapter: class { constructor() { this.type = 'ServerAssetAdapter'; } },
}));
vi.mock('./adapters/server/ServerCollaborationAdapter.js', () => ({
    ServerCollaborationAdapter: class { constructor() { this.type = 'ServerCollaborationAdapter'; } },
}));
vi.mock('./adapters/server/ServerExportAdapter.js', () => ({
    ServerExportAdapter: class { constructor() { this.type = 'ServerExportAdapter'; } },
}));
vi.mock('./adapters/server/ServerContentAdapter.js', () => ({
    ServerContentAdapter: class { constructor() { this.type = 'ServerContentAdapter'; } },
}));
vi.mock('./adapters/server/ServerUserPreferenceAdapter.js', () => ({
    ServerUserPreferenceAdapter: class { constructor() { this.type = 'ServerUserPreferenceAdapter'; } },
}));
vi.mock('./adapters/server/ServerLinkValidationAdapter.js', () => ({
    ServerLinkValidationAdapter: class { constructor() { this.type = 'ServerLinkValidationAdapter'; } },
}));
vi.mock('./adapters/server/ServerCloudStorageAdapter.js', () => ({
    ServerCloudStorageAdapter: class { constructor() { this.type = 'ServerCloudStorageAdapter'; } },
}));
vi.mock('./adapters/server/ServerPlatformIntegrationAdapter.js', () => ({
    ServerPlatformIntegrationAdapter: class { constructor() { this.type = 'ServerPlatformIntegrationAdapter'; } },
}));
vi.mock('./adapters/server/ServerSharingAdapter.js', () => ({
    ServerSharingAdapter: class { constructor() { this.type = 'ServerSharingAdapter'; } },
}));

// Create class-based mocks for static adapters
vi.mock('./adapters/static/StaticProjectRepository.js', () => ({
    StaticProjectRepository: class { constructor() { this.type = 'StaticProjectRepository'; } },
}));
vi.mock('./adapters/static/StaticCatalogAdapter.js', () => ({
    StaticCatalogAdapter: class { constructor() { this.type = 'StaticCatalogAdapter'; } },
}));
vi.mock('./adapters/static/StaticAssetAdapter.js', () => ({
    StaticAssetAdapter: class { constructor() { this.type = 'StaticAssetAdapter'; } },
}));
vi.mock('./adapters/static/NullCollaborationAdapter.js', () => ({
    NullCollaborationAdapter: class { constructor() { this.type = 'NullCollaborationAdapter'; } },
}));
vi.mock('./adapters/static/StaticExportAdapter.js', () => ({
    StaticExportAdapter: class { constructor() { this.type = 'StaticExportAdapter'; } },
}));
vi.mock('./adapters/static/StaticContentAdapter.js', () => ({
    StaticContentAdapter: class { constructor() { this.type = 'StaticContentAdapter'; } },
}));
vi.mock('./adapters/static/StaticUserPreferenceAdapter.js', () => ({
    StaticUserPreferenceAdapter: class { constructor() { this.type = 'StaticUserPreferenceAdapter'; } },
}));
vi.mock('./adapters/static/StaticLinkValidationAdapter.js', () => ({
    StaticLinkValidationAdapter: class { constructor() { this.type = 'StaticLinkValidationAdapter'; } },
}));
vi.mock('./adapters/static/StaticCloudStorageAdapter.js', () => ({
    StaticCloudStorageAdapter: class { constructor() { this.type = 'StaticCloudStorageAdapter'; } },
}));
vi.mock('./adapters/static/StaticPlatformIntegrationAdapter.js', () => ({
    StaticPlatformIntegrationAdapter: class { constructor() { this.type = 'StaticPlatformIntegrationAdapter'; } },
}));
vi.mock('./adapters/static/StaticSharingAdapter.js', () => ({
    StaticSharingAdapter: class { constructor() { this.type = 'StaticSharingAdapter'; } },
}));

describe('ProviderFactory', () => {
    let mockConfig;
    let mockCapabilities;

    beforeEach(() => {
        mockConfig = {
            mode: 'server',
            baseUrl: 'http://localhost:8083',
            wsUrl: 'ws://localhost:8083',
            staticDataPath: null,
            isStaticMode: vi.fn().mockReturnValue(false),
            isElectronMode: vi.fn().mockReturnValue(false),
        };
        mockCapabilities = {
            collaboration: { enabled: true },
            storage: { remote: true },
        };
    });

    describe('constructor', () => {
        it('should store config and capabilities', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(factory.config).toBe(mockConfig);
            expect(factory.capabilities).toBe(mockCapabilities);
        });
    });

    describe('getConfig', () => {
        it('should return the config', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(factory.getConfig()).toBe(mockConfig);
        });
    });

    describe('getCapabilities', () => {
        it('should return the capabilities', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(factory.getCapabilities()).toBe(mockCapabilities);
        });
    });

    describe('abstract methods', () => {
        it('should throw for createProjectRepository', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createProjectRepository()).toThrow('not implemented');
        });

        it('should throw for createCatalogAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createCatalogAdapter()).toThrow('not implemented');
        });

        it('should throw for createAssetAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createAssetAdapter()).toThrow('not implemented');
        });

        it('should throw for createCollaborationAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createCollaborationAdapter()).toThrow('not implemented');
        });

        it('should throw for createExportAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createExportAdapter()).toThrow('not implemented');
        });

        it('should throw for createContentAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createContentAdapter()).toThrow('not implemented');
        });

        it('should throw for createUserPreferencesAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createUserPreferencesAdapter()).toThrow('not implemented');
        });

        it('should throw for createLinkValidationAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createLinkValidationAdapter()).toThrow('not implemented');
        });

        it('should throw for createCloudStorageAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createCloudStorageAdapter()).toThrow('not implemented');
        });

        it('should throw for createPlatformIntegrationAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createPlatformIntegrationAdapter()).toThrow('not implemented');
        });

        it('should throw for createSharingAdapter', () => {
            const factory = new ProviderFactory(mockConfig, mockCapabilities);
            expect(() => factory.createSharingAdapter()).toThrow('not implemented');
        });
    });
});

describe('ServerProviderFactory', () => {
    let mockConfig;
    let mockCapabilities;
    let mockHttpClient;
    let factory;

    beforeEach(() => {
        // Setup window.eXeLearning
        window.eXeLearning = {
            config: { basePath: '/test' },
        };

        mockConfig = {
            mode: 'server',
            baseUrl: 'http://localhost:8083',
            wsUrl: 'ws://localhost:8083',
            staticDataPath: null,
            isStaticMode: vi.fn().mockReturnValue(false),
            isElectronMode: vi.fn().mockReturnValue(false),
        };
        mockCapabilities = {
            collaboration: { enabled: true },
            storage: { remote: true },
        };

        factory = new ServerProviderFactory(mockConfig, mockCapabilities);

        // Mock the httpClient
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };
        factory.httpClient = mockHttpClient;
    });

    afterEach(() => {
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should create httpClient', () => {
            expect(factory.httpClient).toBeDefined();
        });

        it('should set basePath from window.eXeLearning', () => {
            expect(factory.basePath).toBe('/test');
        });

        it('should default basePath to empty string', () => {
            delete window.eXeLearning;
            const newFactory = new ServerProviderFactory(mockConfig, mockCapabilities);
            expect(newFactory.basePath).toBe('');
        });

        it('should initialize endpoints as null', () => {
            expect(factory._endpoints).toBeNull();
        });
    });

    describe('loadEndpoints', () => {
        it('should fetch and parse endpoints', async () => {
            mockHttpClient.get.mockResolvedValue({
                routes: {
                    api_test: { path: '/api/test', methods: ['GET'] },
                    api_other: { path: '/api/other', methods: ['POST'] },
                },
            });

            const endpoints = await factory.loadEndpoints();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/test/api/parameter-management/parameters/data/list');
            expect(endpoints.api_test).toEqual({
                path: 'http://localhost:8083/api/test',
                methods: ['GET'],
            });
            expect(endpoints.api_other).toEqual({
                path: 'http://localhost:8083/api/other',
                methods: ['POST'],
            });
        });

        it('should return cached endpoints on subsequent calls', async () => {
            mockHttpClient.get.mockResolvedValue({ routes: {} });

            await factory.loadEndpoints();
            await factory.loadEndpoints();

            expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
        });

        it('should handle fetch error gracefully', async () => {
            mockHttpClient.get.mockRejectedValue(new Error('Network error'));

            const endpoints = await factory.loadEndpoints();

            expect(endpoints).toEqual({});
        });

        it('should handle missing routes gracefully', async () => {
            mockHttpClient.get.mockResolvedValue({});

            const endpoints = await factory.loadEndpoints();

            expect(endpoints).toEqual({});
        });
    });

    describe('createProjectRepository', () => {
        it('should create ServerProjectRepository', () => {
            const repo = factory.createProjectRepository();
            expect(repo.type).toBe('ServerProjectRepository');
        });
    });

    describe('createCatalogAdapter', () => {
        it('should create ServerCatalogAdapter', () => {
            const adapter = factory.createCatalogAdapter();
            expect(adapter.type).toBe('ServerCatalogAdapter');
        });
    });

    describe('createAssetAdapter', () => {
        it('should create ServerAssetAdapter', () => {
            const adapter = factory.createAssetAdapter();
            expect(adapter.type).toBe('ServerAssetAdapter');
        });
    });

    describe('createCollaborationAdapter', () => {
        it('should create ServerCollaborationAdapter', () => {
            const adapter = factory.createCollaborationAdapter();
            expect(adapter.type).toBe('ServerCollaborationAdapter');
        });
    });

    describe('createExportAdapter', () => {
        it('should create ServerExportAdapter', () => {
            const adapter = factory.createExportAdapter();
            expect(adapter.type).toBe('ServerExportAdapter');
        });
    });

    describe('createContentAdapter', () => {
        it('should create ServerContentAdapter', () => {
            const adapter = factory.createContentAdapter();
            expect(adapter.type).toBe('ServerContentAdapter');
        });
    });

    describe('createUserPreferencesAdapter', () => {
        it('should create ServerUserPreferenceAdapter', () => {
            const adapter = factory.createUserPreferencesAdapter();
            expect(adapter.type).toBe('ServerUserPreferenceAdapter');
        });
    });

    describe('createLinkValidationAdapter', () => {
        it('should create ServerLinkValidationAdapter', () => {
            const adapter = factory.createLinkValidationAdapter();
            expect(adapter.type).toBe('ServerLinkValidationAdapter');
        });
    });

    describe('createCloudStorageAdapter', () => {
        it('should create ServerCloudStorageAdapter', () => {
            const adapter = factory.createCloudStorageAdapter();
            expect(adapter.type).toBe('ServerCloudStorageAdapter');
        });
    });

    describe('createPlatformIntegrationAdapter', () => {
        it('should create ServerPlatformIntegrationAdapter', () => {
            const adapter = factory.createPlatformIntegrationAdapter();
            expect(adapter.type).toBe('ServerPlatformIntegrationAdapter');
        });
    });

    describe('createSharingAdapter', () => {
        it('should create ServerSharingAdapter', () => {
            const adapter = factory.createSharingAdapter();
            expect(adapter.type).toBe('ServerSharingAdapter');
        });
    });

    describe('createAllAdapters', () => {
        it('should create all adapters at once', () => {
            const adapters = factory.createAllAdapters();

            expect(adapters.projectRepo.type).toBe('ServerProjectRepository');
            expect(adapters.catalog.type).toBe('ServerCatalogAdapter');
            expect(adapters.assets.type).toBe('ServerAssetAdapter');
            expect(adapters.collaboration.type).toBe('ServerCollaborationAdapter');
            expect(adapters.exportAdapter.type).toBe('ServerExportAdapter');
            expect(adapters.content.type).toBe('ServerContentAdapter');
            expect(adapters.userPreferences.type).toBe('ServerUserPreferenceAdapter');
            expect(adapters.linkValidation.type).toBe('ServerLinkValidationAdapter');
            expect(adapters.cloudStorage.type).toBe('ServerCloudStorageAdapter');
            expect(adapters.platformIntegration.type).toBe('ServerPlatformIntegrationAdapter');
            expect(adapters.sharing.type).toBe('ServerSharingAdapter');
        });

        it('should return 11 adapters', () => {
            const adapters = factory.createAllAdapters();
            expect(Object.keys(adapters)).toHaveLength(11);
        });
    });
});

describe('StaticProviderFactory', () => {
    let mockConfig;
    let mockCapabilities;
    let mockBundleData;
    let factory;

    beforeEach(() => {
        // Setup window.eXeLearning
        window.eXeLearning = {
            app: {
                dataProvider: { type: 'mockDataProvider' },
            },
        };

        mockConfig = {
            mode: 'static',
            baseUrl: '.',
            wsUrl: null,
            staticDataPath: './data/bundle.json',
            isStaticMode: vi.fn().mockReturnValue(true),
            isElectronMode: vi.fn().mockReturnValue(false),
        };
        mockCapabilities = {
            collaboration: { enabled: false },
            storage: { remote: false, local: true },
        };
        mockBundleData = {
            idevices: [{ id: 'text' }],
            themes: [{ id: 'base' }],
            locales: [{ code: 'en' }],
        };

        factory = new StaticProviderFactory(mockConfig, mockCapabilities, mockBundleData);
    });

    afterEach(() => {
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should store bundleData', () => {
            expect(factory.bundleData).toBe(mockBundleData);
        });

        it('should default bundleData to empty object', () => {
            const newFactory = new StaticProviderFactory(mockConfig, mockCapabilities);
            expect(newFactory.bundleData).toEqual({});
        });
    });

    describe('createProjectRepository', () => {
        it('should create StaticProjectRepository', () => {
            const repo = factory.createProjectRepository();
            expect(repo.type).toBe('StaticProjectRepository');
        });
    });

    describe('createCatalogAdapter', () => {
        it('should create StaticCatalogAdapter', () => {
            const adapter = factory.createCatalogAdapter();
            expect(adapter.type).toBe('StaticCatalogAdapter');
        });
    });

    describe('createAssetAdapter', () => {
        it('should create StaticAssetAdapter', () => {
            const adapter = factory.createAssetAdapter();
            expect(adapter.type).toBe('StaticAssetAdapter');
        });
    });

    describe('createCollaborationAdapter', () => {
        it('should create NullCollaborationAdapter', () => {
            const adapter = factory.createCollaborationAdapter();
            expect(adapter.type).toBe('NullCollaborationAdapter');
        });
    });

    describe('createExportAdapter', () => {
        it('should create StaticExportAdapter', () => {
            const adapter = factory.createExportAdapter();
            expect(adapter.type).toBe('StaticExportAdapter');
        });
    });

    describe('createContentAdapter', () => {
        it('should create StaticContentAdapter', () => {
            const adapter = factory.createContentAdapter();
            expect(adapter.type).toBe('StaticContentAdapter');
        });
    });

    describe('createUserPreferencesAdapter', () => {
        it('should create StaticUserPreferenceAdapter', () => {
            const adapter = factory.createUserPreferencesAdapter();
            expect(adapter.type).toBe('StaticUserPreferenceAdapter');
        });
    });

    describe('createLinkValidationAdapter', () => {
        it('should create StaticLinkValidationAdapter', () => {
            const adapter = factory.createLinkValidationAdapter();
            expect(adapter.type).toBe('StaticLinkValidationAdapter');
        });
    });

    describe('createCloudStorageAdapter', () => {
        it('should create StaticCloudStorageAdapter', () => {
            const adapter = factory.createCloudStorageAdapter();
            expect(adapter.type).toBe('StaticCloudStorageAdapter');
        });
    });

    describe('createPlatformIntegrationAdapter', () => {
        it('should create StaticPlatformIntegrationAdapter', () => {
            const adapter = factory.createPlatformIntegrationAdapter();
            expect(adapter.type).toBe('StaticPlatformIntegrationAdapter');
        });
    });

    describe('createSharingAdapter', () => {
        it('should create StaticSharingAdapter', () => {
            const adapter = factory.createSharingAdapter();
            expect(adapter.type).toBe('StaticSharingAdapter');
        });
    });

    describe('createAllAdapters', () => {
        it('should create all adapters at once', () => {
            const adapters = factory.createAllAdapters();

            expect(adapters.projectRepo.type).toBe('StaticProjectRepository');
            expect(adapters.catalog.type).toBe('StaticCatalogAdapter');
            expect(adapters.assets.type).toBe('StaticAssetAdapter');
            expect(adapters.collaboration.type).toBe('NullCollaborationAdapter');
            expect(adapters.exportAdapter.type).toBe('StaticExportAdapter');
            expect(adapters.content.type).toBe('StaticContentAdapter');
            expect(adapters.userPreferences.type).toBe('StaticUserPreferenceAdapter');
            expect(adapters.linkValidation.type).toBe('StaticLinkValidationAdapter');
            expect(adapters.cloudStorage.type).toBe('StaticCloudStorageAdapter');
            expect(adapters.platformIntegration.type).toBe('StaticPlatformIntegrationAdapter');
            expect(adapters.sharing.type).toBe('StaticSharingAdapter');
        });

        it('should return 11 adapters', () => {
            const adapters = factory.createAllAdapters();
            expect(Object.keys(adapters)).toHaveLength(11);
        });
    });
});

describe('ProviderFactory.create()', () => {
    let originalFetch;
    let originalExeStatic;

    beforeEach(() => {
        originalFetch = global.fetch;
        originalExeStatic = window.__EXE_STATIC_MODE__;

        // Setup window.eXeLearning
        window.eXeLearning = {
            config: { basePath: '' },
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
        window.__EXE_STATIC_MODE__ = originalExeStatic;
        delete window.eXeLearning;
    });

    it('should create ServerProviderFactory in server mode', async () => {
        delete window.__EXE_STATIC_MODE__;

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ routes: {} }),
        });

        const factory = await ProviderFactory.create();

        expect(factory).toBeInstanceOf(ServerProviderFactory);
    });

    it('should load endpoints for ServerProviderFactory', async () => {
        delete window.__EXE_STATIC_MODE__;

        const mockEndpoints = {
            routes: { api_test: { path: '/api/test', methods: ['GET'] } },
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockEndpoints),
        });

        const factory = await ProviderFactory.create();

        expect(factory._endpoints).not.toBeNull();
    });

    it('should create StaticProviderFactory in static mode', async () => {
        window.__EXE_STATIC_MODE__ = true;

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ idevices: [], themes: [] }),
        });

        const factory = await ProviderFactory.create();

        expect(factory).toBeInstanceOf(StaticProviderFactory);
    });

    it('should load bundle data for StaticProviderFactory', async () => {
        window.__EXE_STATIC_MODE__ = true;

        const mockBundleData = {
            idevices: [{ id: 'text' }],
            themes: [{ id: 'base' }],
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockBundleData),
        });

        const factory = await ProviderFactory.create();

        expect(factory.bundleData).toEqual(mockBundleData);
    });

    it('should handle bundle data fetch error gracefully', async () => {
        window.__EXE_STATIC_MODE__ = true;

        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const factory = await ProviderFactory.create();

        expect(factory).toBeInstanceOf(StaticProviderFactory);
        expect(factory.bundleData).toEqual({});
    });

    it('should handle non-ok response for bundle data', async () => {
        window.__EXE_STATIC_MODE__ = true;

        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });

        const factory = await ProviderFactory.create();

        expect(factory.bundleData).toEqual({});
    });

    it('should set capabilities from config', async () => {
        delete window.__EXE_STATIC_MODE__;

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ routes: {} }),
        });

        const factory = await ProviderFactory.create();

        expect(factory.capabilities).toBeDefined();
        expect(factory.capabilities.collaboration).toBeDefined();
    });
});
