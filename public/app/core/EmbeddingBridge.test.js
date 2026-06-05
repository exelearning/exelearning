import EmbeddingBridge from './EmbeddingBridge.js';

describe('EmbeddingBridge', () => {
    let bridge;
    let mockApp;
    let originalParent;
    let originalAddEventListener;
    let originalRemoveEventListener;
    let messageHandler;

    beforeEach(() => {
        // Store original window properties
        originalParent = window.parent;
        originalAddEventListener = window.addEventListener;
        originalRemoveEventListener = window.removeEventListener;

        // Mock window.addEventListener to capture the message handler
        messageHandler = null;
        window.addEventListener = vi.fn((event, handler) => {
            if (event === 'message') {
                messageHandler = handler;
            }
        });
        window.removeEventListener = vi.fn();

        // Mock window.parent to simulate iframe context
        Object.defineProperty(window, 'parent', {
            value: {
                postMessage: vi.fn(),
            },
            writable: true,
            configurable: true,
        });

        // Mock eXeLearning global
        window.eXeLearning = {
            version: '3.0.0',
            projectId: null,
        };

        // Mock crypto.randomUUID
        if (!global.crypto) {
            global.crypto = {};
        }
        global.crypto.randomUUID = vi.fn(() => 'test-uuid-1234');

        // Mock AppLogger
        window.AppLogger = {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Create mock app
        mockApp = {
            project: {
                importElpDirectly: vi.fn().mockResolvedValue(undefined),
                importFromElpxViaYjs: vi.fn().mockResolvedValue(undefined),
                importElpxFile: vi.fn().mockResolvedValue(undefined),
                refreshAfterDirectImport: vi.fn().mockResolvedValue(undefined),
                exportToElpxBlob: vi.fn().mockResolvedValue(new Blob(['test'])),
                getExportFilename: vi.fn(() => 'test-project.elpx'),
                _yjsBridge: {
                    projectId: 'project-123',
                    importer: {
                        importFromFile: vi.fn().mockResolvedValue(undefined),
                    },
                    exporter: {
                        exportToBlob: vi.fn().mockResolvedValue(new Blob(['test'])),
                        buildFilename: vi.fn(() => 'exported.elpx'),
                    },
                    documentManager: {
                        getMetadata: vi.fn(() => new Map([
                            ['title', 'Test Project'],
                            ['author', 'Test Author'],
                            ['description', 'Test Description'],
                            ['language', 'en'],
                            ['theme', 'base'],
                            ['modifiedAt', '2024-01-01T00:00:00Z'],
                        ])),
                        getNavigation: vi.fn(() => ({ length: 3 })),
                    },
                },
            },
        };

        bridge = new EmbeddingBridge(mockApp);
    });

    afterEach(() => {
        vi.clearAllMocks();

        // Restore original window properties
        Object.defineProperty(window, 'parent', {
            value: originalParent,
            writable: true,
            configurable: true,
        });
        window.addEventListener = originalAddEventListener;
        window.removeEventListener = originalRemoveEventListener;

        delete window.eXeLearning;
        delete window.AppLogger;
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(bridge.app).toBe(mockApp);
            expect(bridge.trustedOrigins).toEqual([]);
            expect(bridge.parentOrigin).toBeNull();
            expect(bridge.version).toBe('3.0.0');
            expect(bridge.messageHandler).toBeNull();
        });

        it('should accept trusted origins option', () => {
            const bridgeWithOrigins = new EmbeddingBridge(mockApp, {
                trustedOrigins: ['https://example.com', 'https://test.com'],
            });
            expect(bridgeWithOrigins.trustedOrigins).toEqual(['https://example.com', 'https://test.com']);
        });

        it('should use "unknown" version if not available', () => {
            delete window.eXeLearning.version;
            const bridgeNoVersion = new EmbeddingBridge(mockApp);
            expect(bridgeNoVersion.version).toBe('unknown');
        });
    });

    describe('init', () => {
        it('should skip initialization if not in iframe', () => {
            // Make window.parent === window (not in iframe)
            Object.defineProperty(window, 'parent', {
                value: window,
                writable: true,
                configurable: true,
            });

            bridge.init();

            expect(window.addEventListener).not.toHaveBeenCalled();
            expect(bridge.messageHandler).toBeNull();
        });

        it('should set up message handler when in iframe', () => {
            bridge.init();

            expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
            expect(bridge.messageHandler).not.toBeNull();
        });

        it('should announce ready state to parent', () => {
            bridge.init();

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'EXELEARNING_READY',
                    version: '3.0.0',
                    capabilities: expect.arrayContaining(['OPEN_FILE', 'REQUEST_SAVE', 'GET_PROJECT_INFO']),
                }),
                '*'
            );
        });
    });

    describe('destroy', () => {
        it('should remove message listener', () => {
            bridge.init();
            const handler = bridge.messageHandler;

            bridge.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith('message', handler);
            expect(bridge.messageHandler).toBeNull();
        });

        it('should do nothing if not initialized', () => {
            bridge.destroy();

            expect(window.removeEventListener).not.toHaveBeenCalled();
        });
    });

    describe('getCapabilities', () => {
        it('should return supported capabilities', () => {
            const capabilities = bridge.getCapabilities();

            expect(capabilities).toContain('OPEN_FILE');
            expect(capabilities).toContain('REQUEST_SAVE');
            expect(capabilities).toContain('GET_PROJECT_INFO');
            expect(capabilities).toContain('REQUEST_EXPORT');
            expect(capabilities).toContain('GET_STATE');
            expect(capabilities).toContain('CONFIGURE');
        });
    });

    describe('handleMessage', () => {
        beforeEach(() => {
            bridge.init();
        });

        it('should reject messages from untrusted origins when trusted origins are set', async () => {
            bridge.trustedOrigins = ['https://trusted.com'];

            await messageHandler({
                origin: 'https://untrusted.com',
                data: { type: 'OPEN_FILE' },
            });

            expect(window.AppLogger.warn).toHaveBeenCalledWith(
                '[EmbeddingBridge] Rejected message from untrusted origin:',
                'https://untrusted.com'
            );
        });

        it('should accept messages from trusted origins', async () => {
            bridge.trustedOrigins = ['https://trusted.com'];

            await messageHandler({
                origin: 'https://trusted.com',
                data: { type: 'GET_PROJECT_INFO', requestId: 'req-1' },
            });

            expect(bridge.parentOrigin).toBe('https://trusted.com');
        });

        it('should accept all origins when trustedOrigins is empty', async () => {
            bridge.trustedOrigins = [];

            await messageHandler({
                origin: 'https://any-origin.com',
                data: { type: 'GET_PROJECT_INFO', requestId: 'req-1' },
            });

            expect(bridge.parentOrigin).toBe('https://any-origin.com');
        });

        it('should ignore messages without type', async () => {
            const initialCallCount = window.parent.postMessage.mock.calls.length;

            await messageHandler({
                origin: 'https://example.com',
                data: { foo: 'bar' },
            });

            // Should not have sent any additional messages beyond the READY message
            expect(window.parent.postMessage).toHaveBeenCalledTimes(initialCallCount);
        });

        it('should ignore messages with null data', async () => {
            const initialCallCount = window.parent.postMessage.mock.calls.length;

            await messageHandler({
                origin: 'https://example.com',
                data: null,
            });

            // Should not have sent any additional messages beyond the READY message
            expect(window.parent.postMessage).toHaveBeenCalledTimes(initialCallCount);
        });

        it('should store parent origin for responses', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: { type: 'GET_PROJECT_INFO', requestId: 'req-1' },
            });

            expect(bridge.parentOrigin).toBe('https://parent.com');
        });

        it('should send error response on exception', async () => {
            mockApp.project._yjsBridge.documentManager = null;

            await messageHandler({
                origin: 'https://example.com',
                data: { type: 'GET_PROJECT_INFO', requestId: 'req-error' },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GET_PROJECT_INFO_ERROR',
                    requestId: 'req-error',
                    error: expect.any(String),
                }),
                'https://example.com'
            );
        });
    });

    describe('handleSetTrustedOrigins', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should update trusted origins', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'SET_TRUSTED_ORIGINS',
                    data: { origins: ['https://new-trusted.com'] },
                    requestId: 'req-origins',
                },
            });

            expect(bridge.trustedOrigins).toEqual(['https://new-trusted.com']);
        });

        it('should send success response', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'SET_TRUSTED_ORIGINS',
                    data: { origins: ['https://new-trusted.com'] },
                    requestId: 'req-origins',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'SET_TRUSTED_ORIGINS_SUCCESS',
                    requestId: 'req-origins',
                }),
                'https://parent.com'
            );
        });

        it('should not update if origins is not an array', async () => {
            bridge.trustedOrigins = ['https://original.com'];

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'SET_TRUSTED_ORIGINS',
                    data: { origins: 'invalid' },
                    requestId: 'req-invalid',
                },
            });

            expect(bridge.trustedOrigins).toEqual(['https://original.com']);
        });
    });

    describe('handleOpenFile', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should throw error if bytes not provided', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: {},
                    requestId: 'req-open',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'OPEN_FILE_ERROR',
                    requestId: 'req-open',
                    error: 'Missing file bytes',
                }),
                'https://parent.com'
            );
        });

        it('should import file using project.importElpDirectly', async () => {
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open',
                },
            });

            expect(mockApp.project.importElpDirectly).toHaveBeenCalledWith(
                expect.any(File),
                { clearExisting: true }
            );
            expect(window.eXeLearning.projectId).toBe('test-uuid-1234');
        });

        it('should refresh UI after direct import when available', async () => {
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open-refresh',
                },
            });

            expect(mockApp.project.refreshAfterDirectImport).toHaveBeenCalled();
        });

        it('should send success response with project ID', async () => {
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open-success',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'OPEN_FILE_SUCCESS',
                    requestId: 'req-open-success',
                    projectId: 'test-uuid-1234',
                }),
                'https://parent.com'
            );
        });

        it('should use default filename if not provided', async () => {
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes },
                    requestId: 'req-open',
                },
            });

            expect(mockApp.project.importElpDirectly).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'project.elpx' }),
                { clearExisting: true }
            );
        });

        it('should fallback to importFromElpxViaYjs if importElpDirectly not available', async () => {
            mockApp.project.importElpDirectly = undefined;
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open',
                },
            });

            expect(mockApp.project.importFromElpxViaYjs).toHaveBeenCalled();
        });

        it('should fallback to importElpxFile when modern import methods are not available', async () => {
            mockApp.project.importElpDirectly = undefined;
            mockApp.project.importFromElpxViaYjs = undefined;
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open-legacy',
                },
            });

            expect(mockApp.project.importElpxFile).toHaveBeenCalledWith(expect.any(File));
        });

        it('should throw error if no import method available', async () => {
            mockApp.project.importElpDirectly = undefined;
            mockApp.project.importFromElpxViaYjs = undefined;
            mockApp.project.importElpxFile = undefined;
            mockApp.project._yjsBridge.importer = undefined;
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'OPEN_FILE_ERROR',
                    error: 'Project import not available',
                }),
                'https://parent.com'
            );
        });
    });

    describe('handleSaveRequest', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should export project using exportToElpxBlob', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_SAVE',
                    requestId: 'req-save',
                },
            });

            expect(mockApp.project.exportToElpxBlob).toHaveBeenCalled();
        });

        it('should send SAVE_FILE response with bytes', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_SAVE',
                    requestId: 'req-save',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'SAVE_FILE',
                    requestId: 'req-save',
                    bytes: expect.any(ArrayBuffer),
                    filename: 'test-project.elpx',
                    size: expect.any(Number),
                }),
                'https://parent.com'
            );
        });

        it('should fallback to _yjsBridge.exporter if exportToElpxBlob not available', async () => {
            mockApp.project.exportToElpxBlob = undefined;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_SAVE',
                    requestId: 'req-save',
                },
            });

            expect(mockApp.project._yjsBridge.exporter.exportToBlob).toHaveBeenCalled();
        });

        it('should use fallback filename if getExportFilename not available', async () => {
            mockApp.project.getExportFilename = undefined;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_SAVE',
                    requestId: 'req-save',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    filename: 'project.elpx',
                }),
                'https://parent.com'
            );
        });

        it('should throw error if no export method available', async () => {
            mockApp.project.exportToElpxBlob = undefined;
            mockApp.project._yjsBridge.exporter = undefined;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_SAVE',
                    requestId: 'req-save',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REQUEST_SAVE_ERROR',
                    error: 'Export not available',
                }),
                'https://parent.com'
            );
        });
    });

    describe('handleGetProjectInfo', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should return project metadata', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'GET_PROJECT_INFO',
                    requestId: 'req-info',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'PROJECT_INFO',
                    requestId: 'req-info',
                    projectId: 'project-123',
                    title: 'Test Project',
                    author: 'Test Author',
                    description: 'Test Description',
                    language: 'en',
                    theme: 'base',
                    pageCount: 3,
                    modifiedAt: '2024-01-01T00:00:00Z',
                }),
                'https://parent.com'
            );
        });

        it('should throw error if documentManager not available', async () => {
            mockApp.project._yjsBridge.documentManager = null;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'GET_PROJECT_INFO',
                    requestId: 'req-info',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'GET_PROJECT_INFO_ERROR',
                    error: 'No project loaded',
                }),
                'https://parent.com'
            );
        });

        it('should use default values for missing metadata', async () => {
            mockApp.project._yjsBridge.documentManager.getMetadata = vi.fn(() => new Map());
            mockApp.project._yjsBridge.documentManager.getNavigation = vi.fn(() => null);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'GET_PROJECT_INFO',
                    requestId: 'req-info',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Untitled',
                    author: '',
                    description: '',
                    language: 'en',
                    theme: 'base',
                    pageCount: 0,
                }),
                'https://parent.com'
            );
        });
    });

    describe('handleExportRequest', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';

            // Mock SharedExporters.quickExport
            window.SharedExporters = {
                quickExport: vi.fn().mockResolvedValue({
                    success: true,
                    data: new ArrayBuffer(16),
                }),
            };

            // Setup yjsBridge with needed properties
            mockApp.project._yjsBridge.resourceFetcher = {};
            mockApp.project._yjsBridge.assetManager = {};
        });

        afterEach(() => {
            delete window.SharedExporters;
        });

        it('should export with default elpx format', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: {},
                    requestId: 'req-export',
                },
            });

            expect(window.SharedExporters.quickExport).toHaveBeenCalledWith(
                'elpx',
                expect.anything(),
                null,
                expect.anything(),
                {},
                expect.anything(),
            );
        });

        it('should export with specified format', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: { format: 'html5' },
                    requestId: 'req-export',
                },
            });

            expect(window.SharedExporters.quickExport).toHaveBeenCalledWith(
                'html5',
                expect.anything(),
                null,
                expect.anything(),
                {},
                expect.anything(),
            );
        });

        it('should return EXPORT_FILE with bytes and filename', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: { format: 'elpx', filename: 'my-project.elpx' },
                    requestId: 'req-export',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'EXPORT_FILE',
                    requestId: 'req-export',
                    bytes: expect.any(ArrayBuffer),
                    filename: 'my-project.elpx',
                    format: 'elpx',
                    size: expect.any(Number),
                }),
                'https://parent.com'
            );
        });

        it('should throw error when no project loaded', async () => {
            mockApp.project._yjsBridge = null;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: {},
                    requestId: 'req-export',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REQUEST_EXPORT_ERROR',
                    error: 'No project loaded',
                }),
                'https://parent.com'
            );
        });

        it('should throw error when export system not available', async () => {
            delete window.SharedExporters;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: {},
                    requestId: 'req-export',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REQUEST_EXPORT_ERROR',
                    error: 'Export system not available',
                }),
                'https://parent.com'
            );
        });

        it('should throw error when export fails', async () => {
            window.SharedExporters.quickExport = vi.fn().mockResolvedValue({
                success: false,
                error: 'Invalid format',
            });

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: { format: 'invalid' },
                    requestId: 'req-export',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REQUEST_EXPORT_ERROR',
                    error: 'Invalid format',
                }),
                'https://parent.com'
            );
        });

        it('should use default filename when not provided', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'REQUEST_EXPORT',
                    data: { format: 'html5' },
                    requestId: 'req-export',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    filename: 'project.zip',
                }),
                'https://parent.com'
            );
        });
    });

    describe('handleGetState', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should return editor state', async () => {
            mockApp.project._yjsBridge.documentManager.isDirty = true;
            mockApp.project._yjsBridge.documentManager.getNavigation = vi.fn(() => ({ length: 5 }));

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'GET_STATE',
                    requestId: 'req-state',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'STATE',
                    requestId: 'req-state',
                    isDirty: true,
                    hasProject: true,
                    pageCount: 5,
                }),
                'https://parent.com'
            );
        });

        it('should return defaults when no project loaded', async () => {
            mockApp.project._yjsBridge = null;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'GET_STATE',
                    requestId: 'req-state',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'STATE',
                    isDirty: false,
                    hasProject: false,
                    pageCount: 0,
                }),
                'https://parent.com'
            );
        });
    });

    describe('utility methods', () => {
        it('normalizeExportData should handle TypedArray views', async () => {
            const view = new Uint8Array([1, 2, 3, 4]);
            const result = await bridge.normalizeExportData(view);
            expect(result.bytes).toBeInstanceOf(ArrayBuffer);
            expect(result.mimeType).toBe('application/octet-stream');
        });

        it('normalizeExportData should handle Blob payloads', async () => {
            const blob = new Blob(['abc'], { type: 'text/plain' });
            const result = await bridge.normalizeExportData(blob);
            expect(result.bytes).toBeInstanceOf(ArrayBuffer);
            expect(result.mimeType).toBe('text/plain');
        });

        it('normalizeExportData should reject unsupported data', async () => {
            await expect(bridge.normalizeExportData({})).rejects.toThrow('Unsupported export data format');
        });

        it('getDefaultExportFilename should map known formats', () => {
            expect(bridge.getDefaultExportFilename('epub3')).toBe('project.epub');
            expect(bridge.getDefaultExportFilename('component')).toBe('project.elp');
            expect(bridge.getDefaultExportFilename('html5')).toBe('project.zip');
        });
    });

    describe('handleConfigure', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should set body data attributes to hide UI elements', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'CONFIGURE',
                    data: {
                        hideUI: { fileMenu: true, saveButton: true },
                    },
                    requestId: 'req-config',
                },
            });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBe('true');
            expect(document.body.getAttribute('data-exe-hide-save')).toBe('true');
            expect(document.body.getAttribute('data-exe-hide-share')).toBeNull();
        });

        it('should remove body data attributes to show UI elements', async () => {
            // First hide
            document.body.setAttribute('data-exe-hide-file-menu', 'true');

            // Then show
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'CONFIGURE',
                    data: {
                        hideUI: { fileMenu: false },
                    },
                    requestId: 'req-config',
                },
            });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBeNull();
        });

        it('should send CONFIGURE_SUCCESS response', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'CONFIGURE',
                    data: { hideUI: { saveButton: true } },
                    requestId: 'req-config',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'CONFIGURE_SUCCESS',
                    requestId: 'req-config',
                }),
                'https://parent.com'
            );
        });

        it('should send success even without hideUI data', async () => {
            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'CONFIGURE',
                    data: {},
                    requestId: 'req-config',
                },
            });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'CONFIGURE_SUCCESS',
                }),
                'https://parent.com'
            );
        });
    });

    describe('postToParent', () => {
        it('should not post if not in iframe', () => {
            // Create a mock postMessage on window (since window.parent === window)
            const mockPostMessage = vi.fn();
            window.postMessage = mockPostMessage;

            Object.defineProperty(window, 'parent', {
                value: window,
                writable: true,
                configurable: true,
            });

            bridge.parentOrigin = 'https://parent.com';
            bridge.postToParent({ type: 'TEST' });

            // postToParent should not call postMessage when not in iframe
            expect(mockPostMessage).not.toHaveBeenCalled();
        });

        it('should not post if parentOrigin is not set', () => {
            bridge.parentOrigin = null;
            bridge.postToParent({ type: 'TEST' });

            expect(window.parent.postMessage).not.toHaveBeenCalled();
        });

        it('should post message to parent with correct origin', () => {
            bridge.parentOrigin = 'https://parent.com';
            bridge.postToParent({ type: 'TEST', data: 'value' });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                { type: 'TEST', data: 'value' },
                'https://parent.com'
            );
        });

        it('should fallback to * on non-DataCloneError', () => {
            bridge.parentOrigin = 'https://parent.com';
            window.parent.postMessage = vi.fn()
                .mockImplementationOnce(() => {
                    throw new Error('Some other error');
                })
                .mockImplementationOnce(() => {});

            bridge.postToParent({ type: 'TEST' });

            expect(window.parent.postMessage).toHaveBeenCalledTimes(2);
            expect(window.parent.postMessage).toHaveBeenLastCalledWith(
                { type: 'TEST' },
                '*'
            );
        });

        it('should log error on DataCloneError', () => {
            bridge.parentOrigin = 'https://parent.com';
            const dataCloneError = new Error('Cannot clone');
            dataCloneError.name = 'DataCloneError';
            window.parent.postMessage = vi.fn().mockImplementation(() => {
                throw dataCloneError;
            });

            bridge.postToParent({ type: 'TEST' });

            expect(window.AppLogger.error).toHaveBeenCalledWith(
                '[EmbeddingBridge] Cannot serialize message:',
                dataCloneError
            );
        });
    });

    describe('notifyParent', () => {
        it('should post EXELEARNING_EVENT message', () => {
            bridge.parentOrigin = 'https://parent.com';
            bridge.notifyParent('SOME_EVENT', { key: 'value' });

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                {
                    type: 'EXELEARNING_EVENT',
                    event: 'SOME_EVENT',
                    data: { key: 'value' },
                },
                'https://parent.com'
            );
        });

        it('should use empty data object by default', () => {
            bridge.parentOrigin = 'https://parent.com';
            bridge.notifyParent('SIMPLE_EVENT');

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                {
                    type: 'EXELEARNING_EVENT',
                    event: 'SIMPLE_EVENT',
                    data: {},
                },
                'https://parent.com'
            );
        });
    });

    describe('notifyDirty', () => {
        it('should notify parent with PROJECT_DIRTY event', () => {
            bridge.parentOrigin = 'https://parent.com';
            bridge.notifyDirty();

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                {
                    type: 'EXELEARNING_EVENT',
                    event: 'PROJECT_DIRTY',
                    data: { isDirty: true },
                },
                'https://parent.com'
            );
        });
    });

    describe('notifySaved', () => {
        it('should notify parent with PROJECT_SAVED event', () => {
            bridge.parentOrigin = 'https://parent.com';
            bridge.notifySaved();

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                {
                    type: 'EXELEARNING_EVENT',
                    event: 'PROJECT_SAVED',
                    data: { isDirty: false },
                },
                'https://parent.com'
            );
        });
    });

    describe('DOCUMENT_LOADED notification', () => {
        it('should send DOCUMENT_LOADED when documentReady resolves', async () => {
            // Create a resolvable documentReady promise
            let resolveDocReady;
            window.eXeLearning.documentReady = new Promise((resolve) => {
                resolveDocReady = resolve;
            });

            // Set up yjsBridge with document info
            mockApp.project._yjsBridge.documentManager.isDirty = false;
            mockApp.project._yjsBridge.documentManager.getNavigation = vi.fn(() => ({ length: 5 }));

            bridge.init();

            // Set parentOrigin (normally set when receiving a message)
            bridge.parentOrigin = 'https://parent.com';

            // Resolve documentReady
            resolveDocReady();
            // Wait for microtask to process the .then()
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(window.parent.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'DOCUMENT_LOADED',
                    projectId: 'project-123',
                    isDirty: false,
                    pageCount: 5,
                }),
                'https://parent.com'
            );
        });

        it('should use * as target origin when parentOrigin is not set', async () => {
            let resolveDocReady;
            window.eXeLearning.documentReady = new Promise((resolve) => {
                resolveDocReady = resolve;
            });

            bridge.init();
            // parentOrigin is null by default

            resolveDocReady();
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should have posted DOCUMENT_LOADED with '*' origin
            const docLoadedCall = window.parent.postMessage.mock.calls.find(
                call => call[0]?.type === 'DOCUMENT_LOADED'
            );
            expect(docLoadedCall).toBeTruthy();
            expect(docLoadedCall[1]).toBe('*');
        });

        it('should handle missing yjsBridge gracefully in DOCUMENT_LOADED', async () => {
            let resolveDocReady;
            window.eXeLearning.documentReady = new Promise((resolve) => {
                resolveDocReady = resolve;
            });

            mockApp.project._yjsBridge = null;

            bridge.init();
            resolveDocReady();
            await new Promise(resolve => setTimeout(resolve, 0));

            const docLoadedCall = window.parent.postMessage.mock.calls.find(
                call => call[0]?.type === 'DOCUMENT_LOADED'
            );
            expect(docLoadedCall).toBeTruthy();
            expect(docLoadedCall[0].projectId).toBeNull();
            expect(docLoadedCall[0].isDirty).toBe(false);
            expect(docLoadedCall[0].pageCount).toBe(0);
        });

        it('should not send DOCUMENT_LOADED when documentReady is not available', () => {
            delete window.eXeLearning.documentReady;

            bridge.init();

            const docLoadedCall = window.parent.postMessage.mock.calls.find(
                call => call[0]?.type === 'DOCUMENT_LOADED'
            );
            expect(docLoadedCall).toBeUndefined();
        });

        it('should not send DOCUMENT_LOADED when not in iframe', async () => {
            let resolveDocReady;
            window.eXeLearning.documentReady = new Promise((resolve) => {
                resolveDocReady = resolve;
            });

            // Make window.parent === window (not in iframe)
            Object.defineProperty(window, 'parent', {
                value: window,
                writable: true,
                configurable: true,
            });

            bridge.init();

            // init() should have returned early, so no message handler set
            expect(bridge.messageHandler).toBeNull();
        });
    });

    describe('unknown message types', () => {
        beforeEach(() => {
            bridge.init();
            bridge.parentOrigin = 'https://parent.com';
        });

        it('should ignore unknown message types', async () => {
            const initialCallCount = window.parent.postMessage.mock.calls.length;

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'UNKNOWN_TYPE',
                    requestId: 'req-unknown',
                },
            });

            // Should not have sent any additional messages
            expect(window.parent.postMessage).toHaveBeenCalledTimes(initialCallCount);
        });
    });
});
