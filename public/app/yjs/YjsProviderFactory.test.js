import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YjsProviderFactory } from './YjsProviderFactory.js';

describe('YjsProviderFactory', () => {
    let mockIndexeddbPersistence;
    let mockWebsocketProvider;
    let originalIndexeddbPersistence;
    let originalWebsocketProvider;
    let originalConsoleWarn;

    beforeEach(() => {
        // Save original globals
        originalIndexeddbPersistence = global.window.IndexeddbPersistence;
        originalWebsocketProvider = global.window.WebsocketProvider;
        originalConsoleWarn = console.warn;

        // Mock console.warn
        console.warn = vi.fn();

        // Create mock IndexeddbPersistence
        mockIndexeddbPersistence = vi.fn(function (dbName, ydoc) {
            this.dbName = dbName;
            this.ydoc = ydoc;
            this.synced = false;
            this._callbacks = {};
        });
        mockIndexeddbPersistence.prototype.on = function (event, callback) {
            this._callbacks[event] = callback;
            // Simulate immediate sync
            if (event === 'synced') {
                this.synced = true;
                setTimeout(() => callback(), 0);
            }
        };

        // Create mock WebsocketProvider
        mockWebsocketProvider = vi.fn(function (url, room, ydoc, options) {
            this.url = url;
            this.room = room;
            this.ydoc = ydoc;
            this.options = options;
            this.awareness = { setLocalState: vi.fn() };
        });

        // Set up globals
        global.window.IndexeddbPersistence = mockIndexeddbPersistence;
        global.window.WebsocketProvider = mockWebsocketProvider;
    });

    afterEach(() => {
        // Restore globals
        global.window.IndexeddbPersistence = originalIndexeddbPersistence;
        global.window.WebsocketProvider = originalWebsocketProvider;
        console.warn = originalConsoleWarn;
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('stores capabilities and default config', () => {
            const capabilities = {
                collaboration: { enabled: true },
            };

            const factory = new YjsProviderFactory(capabilities);

            expect(factory.capabilities).toBe(capabilities);
            expect(factory.config.wsUrl).toBeNull();
            expect(factory.config.token).toBe('');
            expect(factory.config.dbPrefix).toBe('exelearning-project-');
        });

        it('stores custom config values', () => {
            const capabilities = { collaboration: { enabled: false } };
            const config = {
                wsUrl: 'wss://test.example.com',
                token: 'test-token',
                dbPrefix: 'custom-prefix-',
            };

            const factory = new YjsProviderFactory(capabilities, config);

            expect(factory.config.wsUrl).toBe('wss://test.example.com');
            expect(factory.config.token).toBe('test-token');
            expect(factory.config.dbPrefix).toBe('custom-prefix-');
        });

        it('uses defaults for missing config values', () => {
            const capabilities = { collaboration: { enabled: true } };
            const config = { wsUrl: 'wss://example.com' };

            const factory = new YjsProviderFactory(capabilities, config);

            expect(factory.config.wsUrl).toBe('wss://example.com');
            expect(factory.config.token).toBe('');
            expect(factory.config.dbPrefix).toBe('exelearning-project-');
        });
    });

    describe('createProviders', () => {
        it('creates IndexedDB provider only when collaboration disabled', async () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const ydoc = { guid: 'test-doc' };

            const result = await factory.createProviders(ydoc, 'project-123');

            expect(result.indexedDB).not.toBeNull();
            expect(result.websocket).toBeNull();
            expect(result.awareness).toBeNull();
            expect(mockIndexeddbPersistence).toHaveBeenCalledWith('exelearning-project-project-123', ydoc);
        });

        it('creates both providers when collaboration enabled and wsUrl set', async () => {
            const capabilities = { collaboration: { enabled: true } };
            const config = { wsUrl: 'wss://collab.example.com', token: 'jwt-token' };
            const factory = new YjsProviderFactory(capabilities, config);
            const ydoc = { guid: 'test-doc' };

            const result = await factory.createProviders(ydoc, 'project-456');

            expect(result.indexedDB).not.toBeNull();
            expect(result.websocket).not.toBeNull();
            expect(result.awareness).not.toBeNull();
            expect(mockWebsocketProvider).toHaveBeenCalledWith(
                'wss://collab.example.com',
                'project-project-456',
                ydoc,
                { connect: false, params: { token: 'jwt-token' } }
            );
        });

        it('does not create WebSocket provider when wsUrl is missing', async () => {
            const capabilities = { collaboration: { enabled: true } };
            const factory = new YjsProviderFactory(capabilities);
            const ydoc = { guid: 'test-doc' };

            const result = await factory.createProviders(ydoc, 'project-789');

            expect(result.indexedDB).not.toBeNull();
            expect(result.websocket).toBeNull();
            expect(result.awareness).toBeNull();
        });
    });

    describe('_createIndexedDBProvider', () => {
        it('returns null and warns when IndexeddbPersistence not available', async () => {
            global.window.IndexeddbPersistence = undefined;
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const ydoc = { guid: 'test-doc' };

            const provider = await factory._createIndexedDBProvider(ydoc, 'project-123');

            expect(provider).toBeNull();
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('IndexeddbPersistence not loaded')
            );
        });

        it('waits for sync before resolving', async () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const ydoc = { guid: 'test-doc' };

            const provider = await factory._createIndexedDBProvider(ydoc, 'project-123');

            expect(provider).not.toBeNull();
            expect(provider.synced).toBe(true);
        });

        it('resolves after timeout if sync does not complete', async () => {
            // Create a mock that doesn't auto-sync
            const slowMockPersistence = vi.fn(function (dbName, ydoc) {
                this.dbName = dbName;
                this.ydoc = ydoc;
                this.synced = false;
                this._callbacks = {};
            });
            slowMockPersistence.prototype.on = function (event, callback) {
                this._callbacks[event] = callback;
                // Don't trigger sync callback immediately
            };
            global.window.IndexeddbPersistence = slowMockPersistence;

            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const ydoc = { guid: 'test-doc' };

            // Use fake timers
            vi.useFakeTimers();

            const providerPromise = factory._createIndexedDBProvider(ydoc, 'project-timeout');

            // Fast-forward past the timeout
            await vi.advanceTimersByTimeAsync(5001);

            const provider = await providerPromise;

            expect(provider).not.toBeNull();
            expect(provider.synced).toBe(false);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('IndexedDB sync timeout')
            );

            vi.useRealTimers();
        });

        it('uses custom dbPrefix in database name', async () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities, { dbPrefix: 'my-app-' });
            const ydoc = { guid: 'test-doc' };

            await factory._createIndexedDBProvider(ydoc, 'abc');

            expect(mockIndexeddbPersistence).toHaveBeenCalledWith('my-app-abc', ydoc);
        });
    });

    describe('_createWebSocketProvider', () => {
        it('returns null values and warns when WebsocketProvider not available', async () => {
            global.window.WebsocketProvider = undefined;
            const capabilities = { collaboration: { enabled: true } };
            const factory = new YjsProviderFactory(capabilities, { wsUrl: 'wss://test.com' });
            const ydoc = { guid: 'test-doc' };

            const result = await factory._createWebSocketProvider(ydoc, 'project-123');

            expect(result.provider).toBeNull();
            expect(result.awareness).toBeNull();
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('WebsocketProvider not loaded')
            );
        });

        it('creates WebSocket provider with correct parameters', async () => {
            const capabilities = { collaboration: { enabled: true } };
            const config = { wsUrl: 'wss://collab.example.com', token: 'my-token' };
            const factory = new YjsProviderFactory(capabilities, config);
            const ydoc = { guid: 'test-doc' };

            const result = await factory._createWebSocketProvider(ydoc, 'proj-001');

            expect(result.provider).not.toBeNull();
            expect(result.awareness).not.toBeNull();
            expect(mockWebsocketProvider).toHaveBeenCalledWith(
                'wss://collab.example.com',
                'project-proj-001',
                ydoc,
                { connect: false, params: { token: 'my-token' } }
            );
        });

        it('passes empty token if not configured', async () => {
            const capabilities = { collaboration: { enabled: true } };
            const factory = new YjsProviderFactory(capabilities, { wsUrl: 'wss://test.com' });
            const ydoc = { guid: 'test-doc' };

            await factory._createWebSocketProvider(ydoc, 'proj-002');

            expect(mockWebsocketProvider).toHaveBeenCalledWith(
                'wss://test.com',
                'project-proj-002',
                ydoc,
                { connect: false, params: { token: '' } }
            );
        });
    });

    describe('isWebSocketAvailable', () => {
        it('returns true when all conditions are met', () => {
            const capabilities = { collaboration: { enabled: true } };
            const config = { wsUrl: 'wss://test.com' };
            const factory = new YjsProviderFactory(capabilities, config);

            expect(factory.isWebSocketAvailable()).toBe(true);
        });

        it('returns false when collaboration is disabled', () => {
            const capabilities = { collaboration: { enabled: false } };
            const config = { wsUrl: 'wss://test.com' };
            const factory = new YjsProviderFactory(capabilities, config);

            expect(factory.isWebSocketAvailable()).toBe(false);
        });

        it('returns false when wsUrl is not set', () => {
            const capabilities = { collaboration: { enabled: true } };
            const factory = new YjsProviderFactory(capabilities);

            expect(factory.isWebSocketAvailable()).toBe(false);
        });

        it('returns false when WebsocketProvider is not loaded', () => {
            global.window.WebsocketProvider = undefined;
            const capabilities = { collaboration: { enabled: true } };
            const config = { wsUrl: 'wss://test.com' };
            const factory = new YjsProviderFactory(capabilities, config);

            expect(factory.isWebSocketAvailable()).toBe(false);
        });
    });

    describe('isIndexedDBAvailable', () => {
        it('returns true when IndexeddbPersistence is available', () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);

            expect(factory.isIndexedDBAvailable()).toBe(true);
        });

        it('returns false when IndexeddbPersistence is not available', () => {
            global.window.IndexeddbPersistence = undefined;
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);

            expect(factory.isIndexedDBAvailable()).toBe(false);
        });
    });

    describe('generateUserColor', () => {
        it('returns a valid hex color string', () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);

            const color = factory.generateUserColor();

            expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });

        it('returns a color from the predefined palette', () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const expectedColors = [
                '#f44336', '#e91e63', '#9c27b0', '#673ab7',
                '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
                '#009688', '#4caf50', '#8bc34a', '#cddc39',
                '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
            ];

            // Generate multiple colors and verify they're all from the palette
            for (let i = 0; i < 50; i++) {
                const color = factory.generateUserColor();
                expect(expectedColors).toContain(color);
            }
        });

        it('generates different colors over multiple calls (random)', () => {
            const capabilities = { collaboration: { enabled: false } };
            const factory = new YjsProviderFactory(capabilities);
            const colors = new Set();

            // Generate 100 colors - with 16 options, we should see variety
            for (let i = 0; i < 100; i++) {
                colors.add(factory.generateUserColor());
            }

            // Should have generated at least a few different colors
            expect(colors.size).toBeGreaterThan(1);
        });
    });

    describe('default export', () => {
        it('exports the class as default', async () => {
            const module = await import('./YjsProviderFactory.js');
            expect(module.default).toBe(YjsProviderFactory);
        });
    });
});
