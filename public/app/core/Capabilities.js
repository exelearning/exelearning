/**
 * Capabilities - Feature flags that UI and business logic should query.
 * Instead of checking mode, code should check capabilities.
 *
 * Example:
 *   // BAD: if (this.app.isStaticMode()) { ... }
 *   // GOOD: if (!this.app.capabilities.collaboration.enabled) { ... }
 */
import { resolvePreviewTransport } from './previewTransport.js';

export class Capabilities {
    /**
     * @param {import('./RuntimeConfig').RuntimeConfig} config
     * @param {{hasElectronApi?: boolean}} [environment] Injectable for tests;
     *   defaults to detecting the Electron preload API on window.
     */
    constructor(config, environment = {}) {
        const isServer = config.mode === 'server';
        const isStatic = config.mode === 'static';
        const isEmbedded = config.isEmbedded || false;
        const hasElectronApi =
            environment.hasElectronApi ?? (typeof window !== 'undefined' && !!window.electronAPI);

        /**
         * Collaboration features (presence, real-time sync)
         */
        this.collaboration = Object.freeze({
            /** Whether collaboration is available */
            enabled: isServer,
            /** Whether real-time sync via WebSocket is available */
            realtime: isServer,
            /** Whether presence/cursors are available */
            presence: isServer,
            /** Whether concurrent editing is supported */
            concurrent: isServer,
        });

        /**
         * Storage capabilities
         */
        this.storage = Object.freeze({
            /** Whether remote server storage is available */
            remote: isServer,
            /** Whether local storage (IndexedDB) is available */
            local: true, // Always available
            /** Whether sync between local and remote is available */
            sync: isServer,
            /** Whether projects are persisted to server */
            serverPersistence: isServer,
        });

        /**
         * Export capabilities
         */
        this.export = Object.freeze({
            /** Whether server-side export is available */
            serverSide: isServer,
            /** Whether client-side export (JSZip) is available */
            clientSide: true, // Always available
        });

        /**
         * Authentication capabilities
         */
        this.auth = Object.freeze({
            /** Whether authentication is required */
            required: isServer,
            /** Whether guest/anonymous access is allowed */
            guest: isStatic,
            /** Whether login/logout is available */
            loginAvailable: isServer,
        });

        /**
         * Project management capabilities
         */
        this.projects = Object.freeze({
            /** Whether project list is fetched from server */
            remoteList: isServer,
            /** Whether projects are stored in IndexedDB */
            localList: isStatic,
            /** Whether "Recent Projects" uses server API */
            recentFromServer: isServer,
            /** Whether "Open from server" is available */
            openFromServer: isServer,
            /** Whether "Save to server" is available */
            saveToServer: isServer,
        });

        /**
         * Sharing capabilities
         */
        this.sharing = Object.freeze({
            /** Whether sharing is available */
            enabled: isServer,
            /** Whether visibility settings are available */
            visibility: isServer,
            /** Whether link sharing is available */
            links: isServer,
        });

        /**
         * File management capabilities
         */
        this.fileManager = Object.freeze({
            /** Whether file manager dialog is available */
            enabled: true, // Available in all modes
            /** Whether file manager uses server API */
            serverBacked: isServer,
            /** Whether files are stored locally */
            localBacked: isStatic,
        });

        /**
         * UI visibility (for embedded mode — controls which UI elements are shown)
         */
        const hideUI = config.embeddingConfig?.hideUI || {};
        this.ui = Object.freeze({
            showFileMenu: !hideUI.fileMenu,
            showSaveButton: !hideUI.saveButton,
            showShareButton: !hideUI.shareButton,
            showUserMenu: !hideUI.userMenu,
            showDownloadButton: !hideUI.downloadButton,
            showHelpMenu: !hideUI.helpMenu,
        });

        /**
         * Preview transport (see core/previewTransport.js). The preview
         * renders untrusted authored content: opaque-safe transports run it
         * in an opaque-origin sandbox (no allow-same-origin).
         */
        const previewTransport = resolvePreviewTransport(config, { hasElectronApi });
        this.preview = Object.freeze({
            /** Which transport serves preview content */
            transport: previewTransport,
            /** Whether the transport works inside an opaque-origin sandbox */
            opaqueSafe: previewTransport !== 'service-worker',
            /** Whether "open preview in new tab" is available (needs a real URL) */
            extractToNewTab: previewTransport !== 'srcdoc',
            /** Whether the legacy same-origin Service Worker preview is active */
            legacyServiceWorker: previewTransport === 'service-worker',
        });

        /**
         * Embedded mode capabilities (for iframe hosting in LMS, etc.)
         */
        this.embedded = Object.freeze({
            /** Whether running in an iframe */
            enabled: isEmbedded,
            /** Whether postMessage communication is available */
            postMessage: isEmbedded,
            /** Whether file operations should use parent window */
            parentFileSystem: isEmbedded && isStatic,
            /** Whether data can be provided by parent window */
            parentDataProvider: isEmbedded && isStatic,
            /** Whether save should notify parent instead of downloading */
            saveToParent: isEmbedded,
            /** Whether open should request file from parent */
            openFromParent: isEmbedded,
        });

        Object.freeze(this);
    }
}

export default Capabilities;
