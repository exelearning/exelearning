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
                importElpxFile: vi.fn().mockResolvedValue(undefined),
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
            expect(bridge.pendingRequests).toBeInstanceOf(Map);
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

        it('should clear pending requests', () => {
            bridge.pendingRequests.set('req-1', { resolve: vi.fn() });
            bridge.pendingRequests.set('req-2', { resolve: vi.fn() });

            bridge.destroy();

            expect(bridge.pendingRequests.size).toBe(0);
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

        it('should import file using project.importElpxFile', async () => {
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open',
                },
            });

            expect(mockApp.project.importElpxFile).toHaveBeenCalledWith(
                expect.any(File)
            );
            expect(window.eXeLearning.projectId).toBe('test-uuid-1234');
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

            expect(mockApp.project.importElpxFile).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'project.elpx' })
            );
        });

        it('should fallback to _yjsBridge.importer if importElpxFile not available', async () => {
            mockApp.project.importElpxFile = undefined;
            const bytes = new ArrayBuffer(8);

            await messageHandler({
                origin: 'https://parent.com',
                data: {
                    type: 'OPEN_FILE',
                    data: { bytes, filename: 'test.elpx' },
                    requestId: 'req-open',
                },
            });

            expect(mockApp.project._yjsBridge.importer.importFromFile).toHaveBeenCalled();
        });

        it('should throw error if no import method available', async () => {
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
