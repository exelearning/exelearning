import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuntimeConfig } from './RuntimeConfig.js';

describe('RuntimeConfig', () => {
    let originalStaticMode;
    let originalElectronAPI;

    beforeEach(() => {
        originalStaticMode = window.__EXE_STATIC_MODE__;
        originalElectronAPI = window.electronAPI;
    });

    afterEach(() => {
        window.__EXE_STATIC_MODE__ = originalStaticMode;
        window.electronAPI = originalElectronAPI;
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

        it('should detect Electron mode', () => {
            delete window.__EXE_STATIC_MODE__;
            window.electronAPI = { test: true };

            const config = RuntimeConfig.fromEnvironment();

            expect(config.mode).toBe('electron');
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

    describe('isElectronMode', () => {
        it('should return true for Electron mode', () => {
            const config = new RuntimeConfig({ mode: 'electron', baseUrl: 'http://localhost', wsUrl: null, staticDataPath: null });
            expect(config.isElectronMode()).toBe(true);
        });

        it('should return false for other modes', () => {
            const serverConfig = new RuntimeConfig({ mode: 'server', baseUrl: 'http://localhost', wsUrl: 'ws://localhost', staticDataPath: null });
            const staticConfig = new RuntimeConfig({ mode: 'static', baseUrl: '.', wsUrl: null, staticDataPath: null });

            expect(serverConfig.isElectronMode()).toBe(false);
            expect(staticConfig.isElectronMode()).toBe(false);
        });
    });
});
