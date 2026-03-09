import { scanBrokenAssetReferences, regenerate } from './RegenerateProjectService.js';

describe('RegenerateProjectService', () => {
    let mockDocManager;
    let mockAssetManager;
    let mockAssetCache;
    let mockResourceFetcher;

    beforeEach(() => {
        mockAssetManager = {
            getAllAssetsMetadata: vi.fn(() => ({
                'aaa00001-0000-0000-0000-000000000001': { id: 'aaa00001-0000-0000-0000-000000000001', filename: 'image.png' },
                'aaa00002-0000-0000-0000-000000000002': { id: 'aaa00002-0000-0000-0000-000000000002', filename: 'doc.pdf' },
            })),
        };

        mockDocManager = {
            getNavigation: vi.fn(() => [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeText',
                                    html: '<img src="asset://aaa00001-0000-0000-0000-000000000001/image.png">',
                                },
                            ],
                        },
                    ],
                },
            ]),
            getMetadata: vi.fn(() => ({ title: 'My Project' })),
            _updateVersionMetadata: vi.fn(),
        };

        mockAssetCache = {};
        mockResourceFetcher = {};

        window.eXeLearning = {
            app: {
                project: {
                    _yjsBridge: {
                        documentManager: mockDocManager,
                        assetManager: mockAssetManager,
                        assetCache: mockAssetCache,
                        resourceFetcher: mockResourceFetcher,
                    },
                },
                alerts: {
                    showToast: vi.fn(),
                },
            },
            config: {},
        };

        // Mock _ translation function
        window._ = vi.fn((s) => s);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.eXeLearning;
        delete window._;
        delete window.SharedExporters;
        delete window.MermaidPreRenderer;
    });

    describe('scanBrokenAssetReferences', () => {
        it('should return empty array when no broken references', () => {
            const result = scanBrokenAssetReferences();
            expect(result).toEqual([]);
        });

        it('should detect broken asset references', () => {
            mockDocManager.getNavigation.mockReturnValue([
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeText',
                                    html: '<img src="asset://dead0000-0000-0000-0000-000000000bad/image.png">',
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = scanBrokenAssetReferences();
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].assetUrl).toBe('asset://dead0000-0000-0000-0000-000000000bad');
            expect(result[0].pageName).toBe('Page 1');
            expect(result[0].ideviceType).toBe('FreeText');
            expect(result[0].componentId).toBe('comp-1');
        });

        it('should not flag existing asset references', () => {
            mockDocManager.getNavigation.mockReturnValue([
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeText',
                                    html: '<img src="asset://aaa00001-0000-0000-0000-000000000001/image.png">',
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = scanBrokenAssetReferences();
            expect(result).toEqual([]);
        });

        it('should return empty array when navigation is null', () => {
            mockDocManager.getNavigation.mockReturnValue(null);
            const result = scanBrokenAssetReferences();
            expect(result).toEqual([]);
        });

        it('should handle multiple broken refs across pages', () => {
            mockDocManager.getNavigation.mockReturnValue([
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeText',
                                    html: '<img src="asset://bad00001-0000-0000-0000-000000000001/x.png">',
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page-2',
                    title: 'Page 2',
                    blocks: [
                        {
                            id: 'block-2',
                            components: [
                                {
                                    id: 'comp-2',
                                    type: 'Image',
                                    html: '<img src="asset://bad00002-0000-0000-0000-000000000002/y.jpg">',
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = scanBrokenAssetReferences();
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('should not duplicate entries for the same assetUrl in the same component', () => {
            mockDocManager.getNavigation.mockReturnValue([
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeText',
                                    html: '<img src="asset://bad00001-0000-0000-0000-000000000001/x.png"><img src="asset://bad00001-0000-0000-0000-000000000001/x.png">',
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = scanBrokenAssetReferences();
            const matchingComp1 = result.filter(
                (r) => r.componentId === 'comp-1' && r.assetUrl === 'asset://bad00001-0000-0000-0000-000000000001'
            );
            expect(matchingComp1.length).toBe(1);
        });

        it('should handle components with idevices array instead of components', () => {
            mockDocManager.getNavigation.mockReturnValue([
                {
                    id: 'page-1',
                    title: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            idevices: [
                                {
                                    id: 'comp-1',
                                    ideviceType: 'Gallery',
                                    content: 'asset://abc00000-0000-0000-0000-00000000dead',
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = scanBrokenAssetReferences();
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].ideviceType).toBe('Gallery');
        });
    });

    describe('regenerate', () => {
        let mockExporter;

        beforeEach(() => {
            mockExporter = {
                export: vi.fn(() =>
                    Promise.resolve({
                        success: true,
                        data: new ArrayBuffer(10),
                        filename: 'test.elpx',
                    })
                ),
            };

            window.SharedExporters = {
                createExporter: vi.fn(() => mockExporter),
            };

            // Mock DOM for download
            const mockLink = {
                href: '',
                download: '',
                click: vi.fn(),
            };
            vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
            window.URL.createObjectURL = vi.fn(() => 'blob:test');
            window.URL.revokeObjectURL = vi.fn();
        });

        it('should create exporter with correct parameters', async () => {
            await regenerate();

            expect(window.SharedExporters.createExporter).toHaveBeenCalledWith(
                'elpx',
                mockDocManager,
                mockAssetCache,
                mockResourceFetcher,
                mockAssetManager
            );
        });

        it('should pass flattenResources option', async () => {
            await regenerate({ flattenResources: true });

            expect(mockExporter.export).toHaveBeenCalledWith(
                expect.objectContaining({ flattenResources: true })
            );
        });

        it('should not flatten resources by default', async () => {
            await regenerate();

            expect(mockExporter.export).toHaveBeenCalledWith(
                expect.objectContaining({ flattenResources: false })
            );
        });

        it('should throw when SharedExporters not available', async () => {
            window.SharedExporters = null;

            await expect(regenerate()).rejects.toThrow();
        });

        it('should throw when export fails', async () => {
            mockExporter.export.mockResolvedValue({
                success: false,
                error: 'Something went wrong',
            });

            await expect(regenerate()).rejects.toThrow('Something went wrong');
        });

        it('should return success on successful export', async () => {
            const result = await regenerate();
            expect(result).toEqual({ success: true });
        });

        it('should generate sanitized filename', async () => {
            mockDocManager.getMetadata.mockReturnValue({ title: 'My Spécial Project!' });

            await regenerate();

            const link = document.createElement.mock.results[0].value;
            expect(link.download).toBe('my_special_project__regenerated.elpx');
        });

        it('should call _updateVersionMetadata before export', async () => {
            await regenerate();
            expect(mockDocManager._updateVersionMetadata).toHaveBeenCalled();
        });

        it('should add Mermaid pre-renderer when available', async () => {
            const mockPreRender = vi.fn();
            window.MermaidPreRenderer = {
                preRender: mockPreRender,
            };

            await regenerate();

            expect(mockExporter.export).toHaveBeenCalledWith(
                expect.objectContaining({
                    preRenderMermaid: expect.any(Function),
                })
            );
        });

        it('should use electronAPI in offline mode', async () => {
            window.eXeLearning.config.isOfflineInstallation = true;
            window.electronAPI = {
                saveBuffer: vi.fn(() => Promise.resolve(true)),
            };

            await regenerate();

            expect(window.electronAPI.saveBuffer).toHaveBeenCalled();

            delete window.electronAPI;
        });
    });
});
