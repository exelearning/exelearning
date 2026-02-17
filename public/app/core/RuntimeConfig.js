/**
 * RuntimeConfig - Immutable bootstrap configuration.
 * This is the ONLY place that checks window.__EXE_STATIC_MODE__.
 * All other code should use capabilities or injected adapters.
 *
 * Supported modes:
 * - 'server': Full server mode with API, WebSocket, collaboration
 * - 'static': Static build (PWA) or Electron app, local-only
 * - 'embedded': Running in iframe (LMS, WordPress, etc.), communicates via postMessage
 */
export class RuntimeConfig {
    /**
     * @param {Object} options
     * @param {'server'|'static'|'embedded'} options.mode - Runtime mode
     * @param {string} options.baseUrl - Base URL for API calls
     * @param {string|null} options.wsUrl - WebSocket URL (null in static/embedded mode)
     * @param {string|null} options.staticDataPath - Path to bundle.json (null in server mode)
     * @param {boolean} options.isEmbedded - Whether running in an iframe
     * @param {string|null} options.parentOrigin - Parent window origin (for embedded mode)
     * @param {Object|null} options.embeddingConfig - External embedding configuration from __EXE_EMBEDDING_CONFIG__
     */
    constructor(options) {
        this.mode = options.mode;
        this.baseUrl = options.baseUrl;
        this.wsUrl = options.wsUrl;
        this.staticDataPath = options.staticDataPath;
        this.isEmbedded = options.isEmbedded || false;
        this.parentOrigin = options.parentOrigin || null;
        this.embeddingConfig = options.embeddingConfig || null;
        Object.freeze(this);
    }

    /**
     * Create RuntimeConfig from environment detection.
     * This is the single decision point for mode detection.
     * @returns {RuntimeConfig}
     */
    static fromEnvironment() {
        const normalizeBasePath = (value) => {
            if (!value || value === '.') return '.';
            let normalized = String(value).trim();
            try {
                normalized = new URL(normalized, window.location.origin).pathname;
            } catch {
                // Keep non-URL values as-is.
            }
            normalized = normalized.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
            if (!normalized) return '.';
            if (!normalized.startsWith('/')) {
                normalized = '/' + normalized;
            }
            return normalized;
        };
        const joinBasePath = (basePath, suffix) => {
            const base = normalizeBasePath(basePath);
            if (base === '.') {
                return `.${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
            }
            return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
        };

        // Detect if running in an iframe (embedded mode)
        const isInIframe = window.parent !== window;

        // Read external embedding configuration (set by LMS plugins before loading the editor)
        const embeddingConfig = window.__EXE_EMBEDDING_CONFIG__ || null;

        // Check for static mode flag (set by build-static-bundle.ts)
        if (window.__EXE_STATIC_MODE__) {
            const staticBasePath = normalizeBasePath(embeddingConfig?.basePath || '.');
            return new RuntimeConfig({
                mode: 'static',
                baseUrl: staticBasePath,
                wsUrl: null,
                staticDataPath: joinBasePath(staticBasePath, '/data/bundle.json'),
                isEmbedded: isInIframe || !!embeddingConfig,
                parentOrigin: embeddingConfig?.parentOrigin || null,
                embeddingConfig,
            });
        }

        // Check for Electron mode - treat as static mode
        // Electron apps use the same local-only capabilities as static builds
        if (window.electronAPI) {
            return new RuntimeConfig({
                mode: 'static',
                baseUrl: window.location.origin,
                wsUrl: null, // Electron doesn't use WebSocket collaboration
                staticDataPath: null,
                isEmbedded: false, // Electron is never embedded
                parentOrigin: null,
                embeddingConfig: null,
            });
        }

        // Check for explicit embedded mode flag (set by parent via postMessage or URL param)
        // This allows server-mode instances to be embedded in LMS iframes
        const urlParams = new URLSearchParams(window.location.search);
        const isExplicitlyEmbedded = urlParams.get('embedded') === 'true';

        // Default: server mode (may be embedded in iframe)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return new RuntimeConfig({
            mode: 'server',
            baseUrl: window.location.origin,
            wsUrl: `${protocol}//${window.location.host}`,
            staticDataPath: null,
            isEmbedded: isInIframe || isExplicitlyEmbedded || !!embeddingConfig,
            parentOrigin: embeddingConfig?.parentOrigin || null,
            embeddingConfig,
        });
    }

    /**
     * Check if running in static mode (no server).
     * This includes both static builds and Electron apps.
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
     * Check if running embedded in an iframe.
     * Can be true for both server and static modes.
     * When embedded, communication with parent happens via postMessage.
     * @returns {boolean}
     */
    isEmbeddedMode() {
        return this.isEmbedded;
    }
}

export default RuntimeConfig;
