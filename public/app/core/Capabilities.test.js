import { describe, it, expect } from 'vitest';
import { Capabilities } from './Capabilities.js';
import { RuntimeConfig } from './RuntimeConfig.js';

describe('Capabilities', () => {
    describe('server mode', () => {
        const config = new RuntimeConfig({
            mode: 'server',
            baseUrl: 'http://localhost:8080',
            wsUrl: 'ws://localhost:8080',
            staticDataPath: null,
        });
        const capabilities = new Capabilities(config);

        it('should be immutable', () => {
            expect(Object.isFrozen(capabilities)).toBe(true);
            expect(Object.isFrozen(capabilities.collaboration)).toBe(true);
            expect(Object.isFrozen(capabilities.storage)).toBe(true);
        });

        it('should enable collaboration features', () => {
            expect(capabilities.collaboration.enabled).toBe(true);
            expect(capabilities.collaboration.realtime).toBe(true);
            expect(capabilities.collaboration.presence).toBe(true);
            expect(capabilities.collaboration.concurrent).toBe(true);
        });

        it('should enable remote storage', () => {
            expect(capabilities.storage.remote).toBe(true);
            expect(capabilities.storage.local).toBe(true);
            expect(capabilities.storage.sync).toBe(true);
            expect(capabilities.storage.serverPersistence).toBe(true);
        });

        it('should enable both export methods', () => {
            expect(capabilities.export.serverSide).toBe(true);
            expect(capabilities.export.clientSide).toBe(true);
        });

        it('should require authentication', () => {
            expect(capabilities.auth.required).toBe(true);
            expect(capabilities.auth.guest).toBe(false);
            expect(capabilities.auth.loginAvailable).toBe(true);
        });

        it('should enable remote project features', () => {
            expect(capabilities.projects.remoteList).toBe(true);
            expect(capabilities.projects.localList).toBe(false);
            expect(capabilities.projects.recentFromServer).toBe(true);
            expect(capabilities.projects.openFromServer).toBe(true);
            expect(capabilities.projects.saveToServer).toBe(true);
        });

        it('should enable sharing', () => {
            expect(capabilities.sharing.enabled).toBe(true);
            expect(capabilities.sharing.visibility).toBe(true);
            expect(capabilities.sharing.links).toBe(true);
        });

        it('should enable server-backed file manager', () => {
            expect(capabilities.fileManager.enabled).toBe(true);
            expect(capabilities.fileManager.serverBacked).toBe(true);
            expect(capabilities.fileManager.localBacked).toBe(false);
        });
    });

    describe('ui capabilities', () => {
        it('should default all ui flags to true when no embedding config', () => {
            const config = new RuntimeConfig({
                mode: 'server',
                baseUrl: 'http://localhost:8080',
                wsUrl: 'ws://localhost:8080',
                staticDataPath: null,
            });
            const capabilities = new Capabilities(config);

            expect(capabilities.ui.showFileMenu).toBe(true);
            expect(capabilities.ui.showSaveButton).toBe(true);
            expect(capabilities.ui.showShareButton).toBe(true);
            expect(capabilities.ui.showUserMenu).toBe(true);
            expect(capabilities.ui.showDownloadButton).toBe(true);
            expect(capabilities.ui.showHelpMenu).toBe(true);
        });

        it('should hide file menu when hideUI.fileMenu is true', () => {
            const config = new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: null,
                embeddingConfig: { hideUI: { fileMenu: true } },
            });
            const capabilities = new Capabilities(config);

            expect(capabilities.ui.showFileMenu).toBe(false);
            expect(capabilities.ui.showSaveButton).toBe(true);
        });

        it('should map each hideUI flag correctly', () => {
            const config = new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: null,
                embeddingConfig: {
                    hideUI: {
                        fileMenu: true,
                        saveButton: true,
                        shareButton: true,
                        userMenu: true,
                        downloadButton: true,
                        helpMenu: true,
                    },
                },
            });
            const capabilities = new Capabilities(config);

            expect(capabilities.ui.showFileMenu).toBe(false);
            expect(capabilities.ui.showSaveButton).toBe(false);
            expect(capabilities.ui.showShareButton).toBe(false);
            expect(capabilities.ui.showUserMenu).toBe(false);
            expect(capabilities.ui.showDownloadButton).toBe(false);
            expect(capabilities.ui.showHelpMenu).toBe(false);
        });

        it('should only affect specified keys with partial hideUI', () => {
            const config = new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: null,
                embeddingConfig: { hideUI: { saveButton: true, helpMenu: true } },
            });
            const capabilities = new Capabilities(config);

            expect(capabilities.ui.showFileMenu).toBe(true);
            expect(capabilities.ui.showSaveButton).toBe(false);
            expect(capabilities.ui.showShareButton).toBe(true);
            expect(capabilities.ui.showUserMenu).toBe(true);
            expect(capabilities.ui.showDownloadButton).toBe(true);
            expect(capabilities.ui.showHelpMenu).toBe(false);
        });

        it('should be frozen', () => {
            const config = new RuntimeConfig({
                mode: 'server',
                baseUrl: 'http://localhost',
                wsUrl: 'ws://localhost',
                staticDataPath: null,
            });
            const capabilities = new Capabilities(config);

            expect(Object.isFrozen(capabilities.ui)).toBe(true);
        });
    });

    describe('static mode (includes Electron)', () => {
        const config = new RuntimeConfig({
            mode: 'static',
            baseUrl: '.',
            wsUrl: null,
            staticDataPath: './data/bundle.json',
        });
        const capabilities = new Capabilities(config);

        it('should disable collaboration features', () => {
            expect(capabilities.collaboration.enabled).toBe(false);
            expect(capabilities.collaboration.realtime).toBe(false);
            expect(capabilities.collaboration.presence).toBe(false);
            expect(capabilities.collaboration.concurrent).toBe(false);
        });

        it('should use local storage only', () => {
            expect(capabilities.storage.remote).toBe(false);
            expect(capabilities.storage.local).toBe(true);
            expect(capabilities.storage.sync).toBe(false);
            expect(capabilities.storage.serverPersistence).toBe(false);
        });

        it('should only support client-side export', () => {
            expect(capabilities.export.serverSide).toBe(false);
            expect(capabilities.export.clientSide).toBe(true);
        });

        it('should allow guest access', () => {
            expect(capabilities.auth.required).toBe(false);
            expect(capabilities.auth.guest).toBe(true);
            expect(capabilities.auth.loginAvailable).toBe(false);
        });

        it('should use local project storage', () => {
            expect(capabilities.projects.remoteList).toBe(false);
            expect(capabilities.projects.localList).toBe(true);
            expect(capabilities.projects.recentFromServer).toBe(false);
            expect(capabilities.projects.openFromServer).toBe(false);
            expect(capabilities.projects.saveToServer).toBe(false);
        });

        it('should disable sharing', () => {
            expect(capabilities.sharing.enabled).toBe(false);
            expect(capabilities.sharing.visibility).toBe(false);
            expect(capabilities.sharing.links).toBe(false);
        });

        it('should use local-backed file manager', () => {
            expect(capabilities.fileManager.enabled).toBe(true);
            expect(capabilities.fileManager.serverBacked).toBe(false);
            expect(capabilities.fileManager.localBacked).toBe(true);
        });
    });
});
