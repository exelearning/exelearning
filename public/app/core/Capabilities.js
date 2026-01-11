/**
 * Capabilities - Feature flags that UI and business logic should query.
 * Instead of checking mode, code should check capabilities.
 *
 * Example:
 *   // BAD: if (this.app.isStaticMode()) { ... }
 *   // GOOD: if (!this.app.capabilities.collaboration.enabled) { ... }
 */
export class Capabilities {
    /**
     * @param {import('./RuntimeConfig').RuntimeConfig} config
     */
    constructor(config) {
        const isServer = config.mode === 'server';
        const isStatic = config.mode === 'static';
        const isElectron = config.mode === 'electron';

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
            guest: isStatic || isElectron,
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
            localList: isStatic || isElectron,
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
            localBacked: isStatic || isElectron,
        });

        Object.freeze(this);
    }
}

export default Capabilities;
