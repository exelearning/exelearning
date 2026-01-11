/**
 * RuntimeConfig - Immutable bootstrap configuration.
 * This is the ONLY place that checks window.__EXE_STATIC_MODE__.
 * All other code should use capabilities or injected adapters.
 */
export class RuntimeConfig {
    /**
     * @param {Object} options
     * @param {'server'|'static'|'electron'} options.mode - Runtime mode
     * @param {string} options.baseUrl - Base URL for API calls
     * @param {string|null} options.wsUrl - WebSocket URL (null in static mode)
     * @param {string|null} options.staticDataPath - Path to bundle.json (null in server mode)
     */
    constructor(options) {
        this.mode = options.mode;
        this.baseUrl = options.baseUrl;
        this.wsUrl = options.wsUrl;
        this.staticDataPath = options.staticDataPath;
        Object.freeze(this);
    }

    /**
     * Create RuntimeConfig from environment detection.
     * This is the single decision point for mode detection.
     * @returns {RuntimeConfig}
     */
    static fromEnvironment() {
        // Check for static mode flag (set by build-static-bundle.ts)
        if (window.__EXE_STATIC_MODE__) {
            return new RuntimeConfig({
                mode: 'static',
                baseUrl: '.',
                wsUrl: null,
                staticDataPath: './data/bundle.json',
            });
        }

        // Check for Electron mode
        if (window.electronAPI) {
            return new RuntimeConfig({
                mode: 'electron',
                baseUrl: window.location.origin,
                wsUrl: null, // Electron doesn't use WebSocket collaboration
                staticDataPath: null,
            });
        }

        // Default: server mode
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return new RuntimeConfig({
            mode: 'server',
            baseUrl: window.location.origin,
            wsUrl: `${protocol}//${window.location.host}`,
            staticDataPath: null,
        });
    }

    /**
     * Check if running in static mode (no server).
     * Prefer using capabilities instead of this method.
     * @returns {boolean}
     */
    isStaticMode() {
        return this.mode === 'static';
    }

    /**
     * Check if running in server mode (full API available).
     * @returns {boolean}
     */
    isServerMode() {
        return this.mode === 'server';
    }

    /**
     * Check if running in Electron mode.
     * @returns {boolean}
     */
    isElectronMode() {
        return this.mode === 'electron';
    }
}

export default RuntimeConfig;
