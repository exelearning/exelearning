import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuntimeConfig } from './RuntimeConfig.js';

describe('RuntimeConfig', () => {
    let originalStaticMode;
    let originalElectronAPI;
    let originalEmbeddingConfig;

    beforeEach(() => {
        originalStaticMode = window.__EXE_STATIC_MODE__;
        originalElectronAPI = window.electronAPI;
        originalEmbeddingConfig = window.__EXE_EMBEDDING_CONFIG__;
    });

    afterEach(() => {
        window.__EXE_STATIC_MODE__ = originalStaticMode;
        window.electronAPI = originalElectronAPI;
        window.__EXE_EMBEDDING_CONFIG__ = originalEmbeddingConfig;
    });

    describe('constructor', () => {
        it('should create immutable config object', () => {
            const config = new RuntimeConfig({
                mode: 'server',
                baseUrl: 'http://localhost:8080',
                wsUrl: 'ws://localhost:8080',
                staticDataPath: null,
            });

            expect(Object.isFrozen(config)).toBe(true);
            expect(() => {
                config.mode = 'static';
            }).toThrow();
        });

        it('should store all provided options', () => {
            const config = new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: './data/bundle.json',
            });

            expect(config.mode).toBe('static');
            expect(config.baseUrl).toBe('.');
            expect(config.wsUrl).toBe(null);
            expect(config.staticDataPath).toBe('./data/bundle.json');
        });
    });

    describe('fromEnvironment', () => {
        it('should detect static mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;

            const config = RuntimeConfig.fromEnvironment();

            expect(config.mode).toBe('static');
            expect(config.baseUrl).toBe('.');
            expect(config.wsUrl).toBe(null);
            expect(config.staticDataPath).toBe('./data/bundle.json');
        });

        it('should detect Electron as static mode', () => {
            delete window.__EXE_STATIC_MODE__;
            window.electronAPI = { test: true };

            const config = RuntimeConfig.fromEnvironment();

            // Electron is treated as static mode (same capabilities)
            expect(config.mode).toBe('static');
            expect(config.wsUrl).toBe(null);
        });

        it('should default to server mode', () => {
            delete window.__EXE_STATIC_MODE__;
            delete window.electronAPI;

            const config = RuntimeConfig.fromEnvironment();

            expect(config.mode).toBe('server');
            expect(config.wsUrl).not.toBe(null);
            expect(config.staticDataPath).toBe(null);
        });
    });

    describe('isStaticMode', () => {
        it('should return true for static mode', () => {
            const config = new RuntimeConfig({ mode: 'static', baseUrl: '.', wsUrl: null, staticDataPath: null });
            expect(config.isStaticMode()).toBe(true);
        });

        it('should return false for server mode', () => {
            const config = new RuntimeConfig({ mode: 'server', baseUrl: 'http://localhost', wsUrl: 'ws://localhost', staticDataPath: null });
            expect(config.isStaticMode()).toBe(false);
        });
    });

    describe('embeddingConfig', () => {
        it('should read __EXE_EMBEDDING_CONFIG__ in static mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = {
                basePath: '/wp-content/plugins/exelearning/static',
                parentOrigin: 'https://mysite.com',
                trustedOrigins: ['https://mysite.com'],
            };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.embeddingConfig).not.toBeNull();
            expect(config.embeddingConfig.basePath).toBe('/wp-content/plugins/exelearning/static');
            expect(config.embeddingConfig.parentOrigin).toBe('https://mysite.com');
        });

        it('should use basePath from config in static mode', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = {
                basePath: '/custom/path',
            };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.baseUrl).toBe('/custom/path');
            expect(config.staticDataPath).toBe('/custom/path/data/bundle.json');
        });

        it('should normalize embedding basePath without leading slash', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = {
                basePath: 'custom/path/',
            };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.baseUrl).toBe('/custom/path');
            expect(config.staticDataPath).toBe('/custom/path/data/bundle.json');
        });

        it('should set isEmbedded when config is present even without iframe', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = { basePath: '.' };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.isEmbedded).toBe(true);
        });

        it('should have null embeddingConfig when not set', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            delete window.__EXE_EMBEDDING_CONFIG__;

            const config = RuntimeConfig.fromEnvironment();

            expect(config.embeddingConfig).toBeNull();
        });

        it('should freeze embeddingConfig as part of config', () => {
            const config = new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: null,
                embeddingConfig: { basePath: '/test' },
            });

            expect(Object.isFrozen(config)).toBe(true);
            expect(config.embeddingConfig.basePath).toBe('/test');
        });

        it('should pass parentOrigin from embeddingConfig', () => {
            window.__EXE_STATIC_MODE__ = true;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = {
                parentOrigin: 'https://lms.example.com',
            };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.parentOrigin).toBe('https://lms.example.com');
        });

        it('should read embeddingConfig in server mode', () => {
            delete window.__EXE_STATIC_MODE__;
            delete window.electronAPI;
            window.__EXE_EMBEDDING_CONFIG__ = {
                basePath: '/editor',
                parentOrigin: 'https://lms.example.com',
            };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.embeddingConfig).not.toBeNull();
            expect(config.isEmbedded).toBe(true);
            expect(config.parentOrigin).toBe('https://lms.example.com');
        });

        it('should not set embeddingConfig for Electron', () => {
            delete window.__EXE_STATIC_MODE__;
            window.electronAPI = { test: true };
            window.__EXE_EMBEDDING_CONFIG__ = { basePath: '/test' };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.embeddingConfig).toBeNull();
            expect(config.isEmbedded).toBe(false);
        });
    });

    describe('isServerMode', () => {
        it('should return true for server mode', () => {
            const config = new RuntimeConfig({ mode: 'server', baseUrl: 'http://localhost', wsUrl: 'ws://localhost', staticDataPath: null });
            expect(config.isServerMode()).toBe(true);
        });

        it('should return false for static mode', () => {
            const config = new RuntimeConfig({ mode: 'static', baseUrl: '.', wsUrl: null, staticDataPath: null });
            expect(config.isServerMode()).toBe(false);
        });
    });
});
