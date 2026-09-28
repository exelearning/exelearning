/**
 * eXeLearning
 *
 * Desktop main JavaScript
 */

import ApiCallManager from './rest/apiCallManager.js';
import Locale from './locate/locale.js';
import Common from './common/app_common.js';
import IdeviceManager from './workarea/idevices/idevicesManager.js';
import ProjectManager from './workarea/project/projectManager.js';
import ToastsManager from './workarea/toasts/toastsManager.js';
import ModalsManager from './workarea/modals/modalsManager.js';
import InterfaceManager from './workarea/interface/interfaceManager.js';
import MenuManager from './workarea/menus/menuManager.js';
import ThemesManager from './workarea/themes/themesManager.js';
import UserManager from './workarea/user/userManager.js';
import Actions from './common/app_actions.js';
import Shortcuts from './common/shortcuts.js';
import SessionMonitor from './common/sessionMonitor.js';
// Core infrastructure - mode detection
import { RuntimeConfig } from './core/RuntimeConfig.js';
import { Capabilities } from './core/Capabilities.js';
// Embedding bridge for iframe communication
import EmbeddingBridge from './core/EmbeddingBridge.js';
import { HIDE_UI_ATTR_MAP, applyHideUI } from './core/ui-visibility.js';
// DOM translation for static mode
import DOMTranslator from './locate/domTranslator.js';
import WebMCPService from './integrations/webmcp/WebMCPService.js';
// Unsaved changes helper
import UnsavedChangesHelper from './utils/unsavedChangesHelper.js';
window.UnsavedChangesHelper = UnsavedChangesHelper;
// Blob paste guard
import BlobPasteGuard from './common/blobPasteGuard.js';
// Drag-and-drop to open project files
import FileDropHandler from './common/fileDropHandler.js';
// Mermaid max-size utilities — exposed on window.eXeLearning for TinyMCE plugins
import * as mermaidMaxSize from './common/mermaidMaxSize.js';

/** Error code set on the rejection when the preview worker never confirms SET_CONTENT. */
const PREVIEW_SW_TIMEOUT_CODE = 'PREVIEW_SW_TIMEOUT';

export default class App {
    constructor(eXeLearning) {
        eXeLearning.mermaidMaxSize = mermaidMaxSize;
        this.eXeLearning = eXeLearning;
        this.parseExelearningConfig();

        // Detect and initialize static/offline mode
        this.initializeModeDetection();

        // Embedding bridge for iframe communication
        this.embeddingBridge = null;
        if (this.capabilities.embedded.enabled) {
            const embeddingConfig = this.runtimeConfig.embeddingConfig;
            this.embeddingBridge = new EmbeddingBridge(this, {
                trustedOrigins: embeddingConfig?.trustedOrigins || [],
            });
        }

        // Ready promise for external consumers (plugins, LMS integrations)
        this._readyResolve = null;
        window.eXeLearning.ready = new Promise((resolve) => {
            this._readyResolve = resolve;
        });

        // Document ready promise — resolves when the project document is fully loaded
        // and ready for interaction (save, export, get state, etc.)
        this._documentReadyResolve = null;
        window.eXeLearning.documentReady = new Promise((resolve) => {
            this._documentReadyResolve = resolve;
        });

        this.api = new ApiCallManager(this);
        this.locale = new Locale(this);
        this.common = new Common(this);
        this.toasts = new ToastsManager(this);
        this.idevices = new IdeviceManager(this);
        this.themes = new ThemesManager(this);
        this.project = new ProjectManager(this);
        this.interface = new InterfaceManager(this);
        this.modals = new ModalsManager(this);
        this.menus = new MenuManager(this);
        this.user = new UserManager(this);
        this.actions = new Actions(this);
        this.shortcuts = new Shortcuts(this);
        this.sessionMonitor = null;
        this.sessionExpirationHandled = false;
        this.electronFileOpenHandlerBound = false;
        this.pendingElectronOpenFiles = [];
        this.pendingStaticOpenFiles = [];
        this.webmcp = new WebMCPService(this);
        this.fileDropHandler = new FileDropHandler({ app: this });

        if (!this.eXeLearning.config.isOfflineInstallation) {
            this.setupSessionMonitor();
        }
    }

    /**
     *
     */
    async init() {
        // Register file-open listener as early as possible to avoid losing IPC events.
        this.bindElectronFileOpenHandler();
        // Enable drag-and-drop of .elpx/.elp files onto the editor window.
        this.fileDropHandler.bind();
        // Pick up pending PWA/static file opens queued before app init.
        if (window.__pendingImportFile instanceof File) {
            this.pendingStaticOpenFiles.push(window.__pendingImportFile);
            window.__pendingImportFile = null;
        }

        // Initialize API (loads static data if in static mode)
        await this.api.init();

        // Register static mode adapters if needed
        if (this.runtimeConfig?.isStaticMode()) {
            await this._registerStaticModeAdapters();
        }

        // Register preview Service Worker (for unified preview/export rendering)
        this.registerPreviewServiceWorker();

        // Load api routes FIRST - required before any API calls
        // (uses DataProvider in static mode)
        await this.loadApiParameters();

        // Load locale strings - required before initializing UI components
        // that use _() for translations (modals, toasts, etc.)
        await this.loadLocale();
        // Compose and initialized toasts
        this.initializedToasts();
        // Compose and initialized modals
        this.initializedModals();
        // Load idevices installed
        await this.loadIdevicesInstalled();
        // Load themes installed
        await this.loadThemesInstalled();
        // Load user data
        await this.loadUser();
        // Show LOPDGDD modal if necessary and load project data
        await this.showModalLopd();
        // Process pending static/PWA files after project init.
        await this.flushPendingStaticOpenFilesWhenReady();
        // Process any pending Electron file-open events after project init.
        await this.flushPendingElectronOpenFilesWhenReady();
        // Register WebMCP tools if WebMCP library is present.
        this.webmcp.init();
        // Show deferred URL import error from static mode (set by ?url= handler)
        if (window.__exeStaticUrlError && this.modals?.alert) {
            this.modals.alert.show({
                title: _('Import Error'),
                body: window.__exeStaticUrlError,
                contentId: 'error',
            });
            window.__exeStaticUrlError = null;
        }
        // "Not for production use" warning
        await this.showProvisionalDemoWarning();
        // To review (showProvisionalToDoWarning might be useful for future beta releases)
        // await this.showProvisionalToDoWarning();
        // Missing strings (not extracted). See #428 (to do)
        await this.tmpStringList();
        // Add the notranslate class to some elements
        await this.addNoTranslateForGoogle();
        // Compose and initialize shortcuts
        await this.initializedShortcuts();

        // Electron: show toast with final saved path
        this.bindElectronDownloadToasts();

        // Handle exe-package:elp protocol for download-source-file iDevice
        this.initExePackageProtocolHandler();

        // Apply embedded UI visibility (CSS-driven via body data attributes)
        if (this.capabilities.embedded.enabled) {
            this._applyEmbeddedUIVisibility();
        }

        // Initialize embedding bridge — announces EXELEARNING_READY to parent
        if (this.embeddingBridge) {
            this.embeddingBridge.init();
        }

        // Resolve the ready promise
        if (this._readyResolve) {
            this._readyResolve({
                version: window.eXeLearning.version,
                capabilities: this.embeddingBridge?.getCapabilities() || [],
            });
            this._readyResolve = null;
        }

        // Execute the custom JavaScript code after the app is fully ready
        await this.runCustomJavaScriptCode();
    }

    /**
     * Register the preview Service Worker.
     *
     * The flow is defensive on purpose (GitHub issue #2429). A browser profile can keep a
     * preview-sw.js registration that reports an "activated" worker which never answers
     * messages (typically after the script changed between builds), and pre-4.0.0 builds
     * registered the worker at the root scope, which shadows the /viewer/ registration and
     * captures the content while another worker serves the iframe. Therefore:
     *   1. preview registrations whose scope contains the preview scope are removed,
     *   2. the /viewer/ registration is registered (or adopted), the browser is asked to
     *      compare preview-sw.js with its stored copy, and a new worker is awaited,
     *   3. the worker is pinged and re-registered once when it does not answer.
     * When even that fails the promise resolves null so the preview panel can fall back to
     * blob URLs instead of showing an error.
     * @returns {Promise<ServiceWorkerRegistration|null>} Registration promise
     */
    registerPreviewServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            this._previewSwRegistrationPromise = Promise.resolve(null);
            return this._previewSwRegistrationPromise;
        }

        // Check secure context (required for SW)
        // app: protocol is treated as secure in Electron with registerSchemesAsPrivileged
        const isSecureContext =
            window.isSecureContext ||
            location.protocol === 'https:' ||
            location.protocol === 'app:' ||
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            this._previewSwRegistrationPromise = Promise.resolve(null);
            return this._previewSwRegistrationPromise;
        }

        const { scope } = this._getPreviewServiceWorkerPaths();
        this._previewSwUnavailable = false;

        this._previewSwRegistrationPromise = (async () => {
            try {
                await this._unregisterStalePreviewWorkers(scope);

                let registration = await this._installPreviewServiceWorker();

                const status = await this.pingPreviewServiceWorker(registration.active);
                if (status) {
                    this._checkPreviewServiceWorkerVersion(status);
                } else {
                    console.warn('[Preview SW] Registered worker does not answer, re-registering it');
                    registration = await this._recoverPreviewServiceWorker();
                }

                return registration;
            } catch (error) {
                console.error('[Preview SW] Registration failed:', error);
                this._previewSwRegistration = null;
                this._previewSwUnavailable = true;
                return null;
            }
        })();

        return this._previewSwRegistrationPromise;
    }

    /**
     * Resolve (once) the scope and script URL used for the preview Service Worker.
     * The script URL carries the app version so that every release installs a fresh worker:
     * a changed URL is the only thing that makes register() replace a stored script.
     * @returns {{ basePath: string, scope: string, scriptUrl: string }}
     * @private
     */
    _getPreviewServiceWorkerPaths() {
        if (!this._previewSwPaths) {
            const basePath = this._resolvePreviewServiceWorkerBasePath();
            const version = this.eXeLearning?.version;
            const query = version ? `?v=${encodeURIComponent(String(version))}` : '';
            this._previewSwPaths = {
                basePath,
                // Use a dedicated scope suffix to avoid conflicts with the PWA SW
                scope: `${basePath}viewer/`,
                scriptUrl: `${basePath}preview-sw.js${query}`,
            };
        }
        return this._previewSwPaths;
    }

    /**
     * Whether a Service Worker script URL is the preview worker (ignores the version query).
     * @param {string|undefined} scriptURL
     * @returns {boolean}
     * @private
     */
    _isPreviewServiceWorkerScript(scriptURL) {
        return this._toPathname(scriptURL).endsWith('/preview-sw.js');
    }

    /**
     * Pathname of an absolute URL or absolute path; empty string when it cannot be parsed.
     * @param {string|undefined} value
     * @returns {string}
     * @private
     */
    _toPathname(value) {
        if (!value) return '';
        try {
            return new URL(String(value), 'http://localhost').pathname;
        } catch {
            return '';
        }
    }

    /**
     * Unregister preview-sw.js registrations whose scope contains the preview scope.
     *
     * Such registrations (e.g. scope "/" left behind by pre-4.0.0 builds) are returned by
     * getRegistration() lookups, control the editor page and receive the preview content
     * while the /viewer/ worker serves the iframe, so the preview stays blank or times out.
     * Registrations of other deployments on the same origin (sibling scopes) and non-preview
     * workers (PWA service-worker.js) are left untouched.
     * @param {string} previewScope - Expected preview scope (absolute path or URL)
     * @returns {Promise<string[]>} Scopes that were unregistered
     * @private
     */
    async _unregisterStalePreviewWorkers(previewScope) {
        let registrations;
        try {
            registrations = await navigator.serviceWorker.getRegistrations();
        } catch (error) {
            console.warn('[Preview SW] Could not list registrations:', error);
            return [];
        }

        // Registrations are same-origin by definition, so scopes are compared by path.
        const expectedPath = this._toPathname(previewScope);
        const stale = registrations.filter((registration) => {
            const worker = registration.active || registration.waiting || registration.installing;
            if (!this._isPreviewServiceWorkerScript(worker?.scriptURL)) return false;
            const scopePath = this._toPathname(registration.scope);
            return Boolean(scopePath) && scopePath !== expectedPath && expectedPath.startsWith(scopePath);
        });

        await Promise.all(
            stale.map(async (registration) => {
                console.warn('[Preview SW] Removing stale registration with scope', registration.scope);
                try {
                    await registration.unregister();
                } catch (error) {
                    console.warn('[Preview SW] Could not unregister', registration.scope, error);
                }
            })
        );

        return stale.map((registration) => registration.scope);
    }

    /**
     * Register the preview worker for the preview scope and wait until it is usable.
     * register() returns the existing registration when scope and script URL match, so an
     * explicit update() is needed to make the browser compare preview-sw.js with the stored
     * copy; a worker installed by that check is awaited before returning.
     * @returns {Promise<ServiceWorkerRegistration>}
     * @private
     */
    async _installPreviewServiceWorker() {
        const { scope, scriptUrl } = this._getPreviewServiceWorkerPaths();
        const registration = await navigator.serviceWorker.register(scriptUrl, { scope });
        this._previewSwRegistration = registration;

        // A changed script URL (new app version) makes register() start an install by itself;
        // otherwise ask the browser to compare preview-sw.js with the stored copy.
        if (!registration.installing && typeof registration.update === 'function') {
            try {
                await registration.update();
            } catch (error) {
                console.warn('[Preview SW] Update check failed, keeping the current worker:', error);
            }
        }

        await this._waitForActivation(registration);
        await this._tryClaimClients(registration);
        this._watchPreviewServiceWorkerUpdates(registration);

        return registration;
    }

    /**
     * Nudge a worker installed later (browser-initiated update) to take over immediately.
     * @param {ServiceWorkerRegistration} registration
     * @private
     */
    _watchPreviewServiceWorkerUpdates(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            }
        });
    }

    /**
     * Ask the worker for its status over a MessageChannel.
     * A registration can report an "activated" worker that no longer runs its message
     * handler; this is the only way to tell such a worker from a healthy one.
     * @param {ServiceWorker|null} sw
     * @param {number} timeoutMs - Time to wait for the STATUS reply
     * @returns {Promise<Object|null>} STATUS payload, or null when the worker did not answer
     */
    pingPreviewServiceWorker(sw, timeoutMs = 3000) {
        if (!sw || sw.state === 'redundant' || typeof sw.postMessage !== 'function') {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            const channel = new MessageChannel();
            let timer = null;
            const finish = (value) => {
                clearTimeout(timer);
                channel.port1.close();
                resolve(value);
            };
            timer = setTimeout(() => finish(null), timeoutMs);
            channel.port1.onmessage = (event) => {
                finish(event.data?.type === 'STATUS' ? event.data : null);
            };
            try {
                sw.postMessage({ type: 'GET_STATUS' }, [channel.port2]);
            } catch {
                finish(null);
            }
        });
    }

    /**
     * Warn when the worker reports a version other than the app's (stale script still running).
     * @param {Object} status - STATUS payload from the worker
     * @private
     */
    _checkPreviewServiceWorkerVersion(status) {
        const appVersion = this.eXeLearning?.version;
        const workerAppVersion = status?.appVersion;
        if (!appVersion || !workerAppVersion || workerAppVersion === String(appVersion)) return;
        console.warn('[Preview SW] Worker was registered with a different app version', {
            worker: workerAppVersion,
            app: String(appVersion),
            script: status.version,
        });
    }

    /**
     * Replace the preview worker registration with a fresh one and verify it answers.
     * Concurrent callers share the in-flight recovery. On failure the cached registration is
     * cleared so callers fall back to the blob URL preview.
     * @returns {Promise<ServiceWorkerRegistration>}
     * @private
     */
    async _recoverPreviewServiceWorker() {
        if (this._previewSwRecoveryPromise) {
            return this._previewSwRecoveryPromise;
        }

        const { scope } = this._getPreviewServiceWorkerPaths();

        this._previewSwRecoveryPromise = (async () => {
            let current = this._previewSwRegistration;
            if (!current) {
                try {
                    current = await navigator.serviceWorker.getRegistration(scope);
                } catch {
                    current = null;
                }
            }

            const currentWorker = current?.active || current?.waiting || current?.installing;
            if (current && this._isPreviewServiceWorkerScript(currentWorker?.scriptURL)) {
                try {
                    await current.unregister();
                } catch (error) {
                    console.warn('[Preview SW] Could not unregister the stale worker:', error);
                }
            }
            this._previewSwRegistration = null;

            const registration = await this._installPreviewServiceWorker();
            const status = await this.pingPreviewServiceWorker(registration.active);
            if (!status) {
                this._previewSwRegistration = null;
                throw new Error('Preview Service Worker does not answer after re-registration');
            }
            this._checkPreviewServiceWorkerVersion(status);
            return registration;
        })();

        try {
            return await this._previewSwRecoveryPromise;
        } finally {
            this._previewSwRecoveryPromise = null;
        }
    }

    /**
     * Resolve base path for preview Service Worker registration.
     * Priority:
     * 1) runtime embeddingConfig.basePath (explicit static assets base path)
     * 2) current pathname directory
     * @returns {string} Normalized absolute path with trailing slash (e.g. "/", "/exelearning/")
     * @private
     */
    _resolvePreviewServiceWorkerBasePath() {
        let rawBasePath = this.runtimeConfig?.embeddingConfig?.basePath;

        if (!rawBasePath) {
            const pathname = window.location.pathname || '/';
            rawBasePath = pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
        }

        try {
            rawBasePath = new URL(rawBasePath, window.location.origin).pathname;
        } catch {
            // Keep raw value if it's not URL-parseable.
        }

        let normalized = String(rawBasePath || '/').trim();
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        normalized = normalized.replace(/\/{2,}/g, '/');
        normalized = normalized.replace(/\/+$/, '');

        return (normalized || '') + '/';
    }

    /**
     * Wait for SW to activate
     * @param {ServiceWorkerRegistration} registration
     * @private
     */
    async _waitForActivation(registration) {
        const sw = registration.installing || registration.waiting || registration.active;
        if (!sw || sw.state === 'activated') return;

        await Promise.race([
            new Promise((resolve) => {
                const onStateChange = () => {
                    if (sw.state === 'activated') {
                        sw.removeEventListener('statechange', onStateChange);
                        resolve();
                    }
                };
                sw.addEventListener('statechange', onStateChange);
                if (sw.state === 'activated') {
                    sw.removeEventListener('statechange', onStateChange);
                    resolve();
                }
            }),
            new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
    }

    /**
     * Whether the current page is inside a Service Worker registration scope.
     * @param {string} scope - Registration scope (absolute URL or path)
     * @returns {boolean}
     * @private
     */
    _isPageWithinScope(scope) {
        try {
            const scopeHref = new URL(scope, window.location.origin).href;
            return window.location.href.startsWith(scopeHref);
        } catch {
            return false;
        }
    }

    /**
     * Try to claim clients (non-fatal if fails).
     * clients.claim() only affects pages inside the registration scope. The editor page lives
     * outside the /viewer/ scope, so waiting for a controllerchange there can never succeed and
     * would only delay the first preview by the full timeout.
     * @param {ServiceWorkerRegistration} registration
     * @private
     */
    async _tryClaimClients(registration) {
        if (navigator.serviceWorker.controller || !registration.active) return;
        if (!this._isPageWithinScope(registration.scope)) return;

        registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
        try {
            await this._waitForController(5000);
        } catch {
            // Non-fatal: iframe will still work via SW scope
        }
    }

    /**
     * Wait for Service Worker to become the controller
     * @param {number} timeout - Maximum time to wait in ms
     * @returns {Promise<ServiceWorker>} The controller
     * @private
     */
    _waitForController(timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (navigator.serviceWorker.controller) {
                resolve(navigator.serviceWorker.controller);
                return;
            }

            const timeoutId = setTimeout(() => {
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                reject(new Error('Controller timeout'));
            }, timeout);

            const onControllerChange = () => {
                clearTimeout(timeoutId);
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve(navigator.serviceWorker.controller);
            };

            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        });
    }

    /**
     * Get the preview Service Worker
     * Falls back to registration's active worker if page isn't controlled yet
     * (happens on subsequent app runs before SW claims the page)
     * @returns {ServiceWorker|null} The active service worker or null
     */
    getPreviewServiceWorker() {
        // First check our stored registration - this is the authoritative source
        // for the preview SW, especially in static mode where PWA SW may be the controller
        if (this._previewSwRegistration?.active) {
            return this._previewSwRegistration.active;
        }

        // Registration gave up (worker never answered, even after re-registering): a stale
        // root-scope worker may still control this page, but it must not be used.
        if (this._previewSwUnavailable) {
            return null;
        }

        // Fallback: check if controller is the preview SW (not PWA SW)
        const controller = navigator.serviceWorker?.controller;
        if (this._isPreviewServiceWorkerScript(controller?.scriptURL)) {
            return controller;
        }

        return null;
    }

    /**
     * Wait for the preview Service Worker to be ready
     * Returns the active SW - doesn't require it to be controlling the parent page
     * The preview iframe will be controlled by the SW based on its URL
     * @param {number} timeout - Maximum time to wait in ms (default 10000)
     * @returns {Promise<ServiceWorker>} The active service worker
     */
    async waitForPreviewServiceWorker(timeout = 10000) {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Workers not supported');
        }

        // Wait for our registration to complete (it handles activation and health checks).
        // It takes precedence over the controller: a stale root-scope worker can still control
        // the editor page during the session in which it was unregistered.
        if (this._previewSwRegistrationPromise) {
            const registration = await Promise.race([
                this._previewSwRegistrationPromise,
                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error('Service Worker registration timeout')
                            ),
                        timeout
                    )
                ),
            ]);

            if (!registration) {
                throw new Error('Service Worker registration failed');
            }

            // Return the active SW from registration (doesn't need to be controlling parent page)
            if (registration.active) {
                return registration.active;
            }
        }

        // Fallback: the controller, when it is the preview SW (not PWA SW)
        const controller = navigator.serviceWorker.controller;
        if (this._isPreviewServiceWorkerScript(controller?.scriptURL)) {
            return controller;
        }

        // Check if we have a stored registration with active SW
        if (this._previewSwRegistration?.active) {
            return this._previewSwRegistration.active;
        }

        throw new Error('Service Worker not available');
    }

    /**
     * Send content to the preview Service Worker.
     *
     * ArrayBuffers in `files` are transferred to the worker, so they cannot be sent twice.
     * When the worker never confirms the content, it is re-registered once and, if
     * `regenerateFiles` is given, the content is regenerated and sent to the new worker.
     * @param {Object} files - Map of file paths to ArrayBuffer content
     * @param {Object} options - Options for content serving
     * @param {Object} [retry]
     * @param {(() => Promise<Object>)|null} [retry.regenerateFiles] - Produces fresh files for a resend
     * @returns {Promise<{fileCount: number}>} Promise that resolves when content is ready
     */
    async sendContentToPreviewSW(files, options = {}, { regenerateFiles = null } = {}) {
        // Wait for SW registration to complete if needed
        if (this._previewSwRegistrationPromise) {
            await this._previewSwRegistrationPromise;
        }

        const sw = this.getPreviewServiceWorker();
        if (!sw) {
            throw new Error('Preview Service Worker not available');
        }

        try {
            return await this._postContentToPreviewSW(sw, files, options);
        } catch (error) {
            if (error?.code !== PREVIEW_SW_TIMEOUT_CODE) {
                throw error;
            }

            console.warn('[Preview SW] Timed out waiting for content ready, re-registering the worker');
            let registration;
            try {
                registration = await this._recoverPreviewServiceWorker();
            } catch (recoveryError) {
                console.error('[Preview SW] Recovery failed:', recoveryError);
                // Same outcome as a failed load-time registration: stop offering the worker so
                // the preview panel degrades to blob URLs instead of showing an error.
                this._previewSwUnavailable = true;
                throw error;
            }

            if (typeof regenerateFiles !== 'function') {
                throw error;
            }

            const freshFiles = await regenerateFiles();
            return await this._postContentToPreviewSW(registration.active, freshFiles, options);
        }
    }

    /**
     * Post SET_CONTENT to a worker and wait until it confirms the content can be served.
     * @param {ServiceWorker} sw
     * @param {Object} files - Map of file paths to ArrayBuffer content (buffers are transferred)
     * @param {Object} options - Options for content serving
     * @returns {Promise<{fileCount: number}>}
     * @private
     */
    _postContentToPreviewSW(sw, files, options) {
        return new Promise((resolve, reject) => {
            // Use MessageChannel for bi-directional communication
            // This works even when SW is not the controller of the current page
            const messageChannel = new MessageChannel();
            let timeoutId;

            // Listen for response on the channel
            messageChannel.port1.onmessage = (event) => {
                if (event.data?.type === 'CONTENT_READY') {
                    // Content received by SW, now verify it can serve requests
                    // This extra verification step handles Firefox's stricter event timing
                    const verifyChannel = new MessageChannel();
                    verifyChannel.port1.onmessage = (verifyEvent) => {
                        clearTimeout(timeoutId);
                        messageChannel.port1.close();
                        verifyChannel.port1.close();
                        if (verifyEvent.data?.ready) {
                            resolve({ fileCount: verifyEvent.data.fileCount });
                        } else {
                            reject(
                                new Error(
                                    'SW content not ready after verification'
                                )
                            );
                        }
                    };
                    sw.postMessage({ type: 'VERIFY_READY' }, [
                        verifyChannel.port2,
                    ]);
                } else if (event.data?.type === 'READY_VERIFIED') {
                    // Direct response (when SW responds on same channel)
                    clearTimeout(timeoutId);
                    messageChannel.port1.close();
                    if (event.data.ready) {
                        resolve({ fileCount: event.data.fileCount });
                    } else {
                        reject(
                            new Error('SW content not ready after verification')
                        );
                    }
                }
            };

            // Collect transferable ArrayBuffers
            const transferables = [messageChannel.port2];
            for (const value of Object.values(files)) {
                if (value instanceof ArrayBuffer) {
                    transferables.push(value);
                }
            }

            // Send content to SW with MessageChannel port
            sw.postMessage(
                {
                    type: 'SET_CONTENT',
                    data: { files, options },
                },
                transferables
            );

            // Timeout after 10 seconds
            timeoutId = setTimeout(() => {
                messageChannel.port1.close();
                const error = new Error('Timeout waiting for SW content ready');
                error.code = PREVIEW_SW_TIMEOUT_CODE;
                reject(error);
            }, 10000);
        });
    }

    /**
     * Update specific files in the preview Service Worker
     * @param {Object} files - Map of file paths to ArrayBuffer content (null to delete)
     * @returns {Promise<void>}
     */
    async updatePreviewSWFiles(files) {
        const sw = this.getPreviewServiceWorker();
        if (!sw) {
            throw new Error('Preview Service Worker not available');
        }

        // Collect transferable ArrayBuffers
        const transferables = [];
        for (const value of Object.values(files)) {
            if (value instanceof ArrayBuffer) {
                transferables.push(value);
            }
        }

        sw.postMessage(
            {
                type: 'UPDATE_FILES',
                data: { files },
            },
            transferables
        );
    }

    /**
     * Clear content from the preview Service Worker
     */
    clearPreviewSWContent() {
        const sw = this.getPreviewServiceWorker();
        if (sw) {
            sw.postMessage({ type: 'CLEAR_CONTENT' });
        }
    }

    /**
     * Initialize handler for exe-package:elp protocol
     * Used by download-source-file iDevice to download project in editor/preview
     */
    initExePackageProtocolHandler() {
        document.addEventListener('click', async (e) => {
            const link = e.target.closest('a[href="exe-package:elp"]');
            if (!link) return;

            e.preventDefault();
            e.stopPropagation();

            // Check if Yjs mode is enabled
            if (!this.project?._yjsEnabled || !this.project?.exportToElpxViaYjs) {
                this.modals.alert.show({
                    title: _('Error'),
                    body: _('Project not ready for collaboration'),
                    contentId: 'error',
                });
                return;
            }

            // Show loading toast
            const toastData = {
                title: _('Download'),
                body: _('Generating ELPX file...'),
                icon: 'downloading',
            };
            const toast = this.toasts.createToast(toastData);

            try {
                // Export using existing method - filename is auto-generated from project title (sanitized)
                await this.project.exportToElpxViaYjs();

                // Update toast
                toast.toastBody.innerHTML = _('File generated and downloaded.');
            } catch (error) {
                console.error('[exe-package:elp] Error:', error);
                toast.toastBody.innerHTML = _('Error generating ELPX file.');
                toast.toastBody.classList.add('error');
                this.modals.alert.show({
                    title: _('Error'),
                    body: error.message || _('Unknown error.'),
                    contentId: 'error',
                });
            }

            // Remove toast after delay
            setTimeout(() => {
                toast.remove();
            }, 2000);
        });
    }

    /**
     *
     */
    parseExelearningConfig() {
        window.eXeLearning.user = JSON.parse(
            window.eXeLearning.user.replace(/&quot;/g, '"')
        );
        window.eXeLearning.config = JSON.parse(
            window.eXeLearning.config.replace(/&quot;/g, '"')
        );

        const urlRequest = new URL(window.location.href);
        const protocol = urlRequest.protocol; // "https:"

        // HOTFIX: If the site is running under HTTPS, force https in baseURL, fullURL, and changelogURL
        if ('https:' === protocol) {
            const propertiesToForceHTTPS = [
                'baseURL',
                'fullURL',
                'changelogURL',
            ];
            propertiesToForceHTTPS.forEach((property) => {
                if (
                    window.eXeLearning.config[property] &&
                    window.eXeLearning.config[property].startsWith('http://')
                ) {
                    window.eXeLearning.config[property] =
                        window.eXeLearning.config[property].replace(
                            'http://',
                            'https://'
                        );
                }
            });
        }

        // COMPATIBILITY SHIM: Create eXeLearning.symfony for legacy iDevices
        // Legacy iDevices (like interactive-video) reference eXeLearning.symfony.baseURL
        // This shim maps them to the new eXeLearning.config structure
        window.eXeLearning.symfony = {
            baseURL: window.eXeLearning.config.baseURL || '',
            basePath: window.eXeLearning.config.basePath || '',
            fullURL: window.eXeLearning.config.fullURL || '',
        };
    }

    /**
     * Initialize mode detection based on runtime environment (static vs server)
     * Called during constructor, before other managers are created
     */
    initializeModeDetection() {
        // Use RuntimeConfig for mode detection (single source of truth)
        this.runtimeConfig = RuntimeConfig.fromEnvironment();
        this.capabilities = new Capabilities(this.runtimeConfig);

        // Backward compatibility: store mode flags in config
        const isStaticMode = this.runtimeConfig.isStaticMode();
        this.eXeLearning.config.isStaticMode = isStaticMode;

        if (isStaticMode) {
            console.log('[App] Running in STATIC/OFFLINE mode');
            // Ensure offline-related flags are set
            this.eXeLearning.config.isOfflineInstallation = true;

            // In static mode, detect basePath from current URL if not set
            // This allows static builds to work when deployed in subdirectories
            // (e.g., https://exelearning.pages.dev/pr-preview/pr-20/)
            if (!this.eXeLearning.config.basePath) {
                const pathname = window.location.pathname;
                // Known SPA routes handled by the main index.html - these are NOT real subdirectories
                // Query string (e.g., ?project=static-project) is in window.location.search, not pathname
                const knownSpaRoutes = ['/workarea', '/login', '/viewer'];
                const isKnownSpaRoute = knownSpaRoutes.some(
                    (route) => pathname === route || pathname.startsWith(route + '/'),
                );

                let detectedBase;
                if (isKnownSpaRoute) {
                    // SPA route - static files are at root
                    detectedBase = '';
                } else {
                    // Real subdirectory deployment (e.g., /pr-preview/pr-20/)
                    // Remove index.html and trailing slashes to get the base directory
                    detectedBase = pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
                }
                this.eXeLearning.config.basePath = detectedBase;

                // Also update the symfony compatibility shim with detected basePath
                if (window.eXeLearning.symfony) {
                    window.eXeLearning.symfony.basePath = detectedBase;
                }
            }

            // Override basePath from embedding config if provided
            const embeddingBasePath = this.runtimeConfig.embeddingConfig?.basePath;
            if (embeddingBasePath) {
                this.eXeLearning.config.basePath = embeddingBasePath.replace(/\/+$/, '');
                if (window.eXeLearning.symfony) {
                    window.eXeLearning.symfony.basePath = this.eXeLearning.config.basePath;
                }
                console.log('[App] BasePath from embedding config:', this.eXeLearning.config.basePath);
            }
        }

        // Log capabilities for debugging
        console.log('[App] Capabilities:', {
            collaboration: this.capabilities.collaboration.enabled,
            remoteStorage: this.capabilities.storage.remote,
            auth: this.capabilities.auth.required,
        });
    }

    /**
     * Apply embedded UI visibility using body data attributes.
     * CSS rules in main.scss handle the actual hiding based on these attributes.
     * @private
     */
    _applyEmbeddedUIVisibility() {
        document.body.setAttribute('data-embedded', 'true');

        const ui = this.capabilities.ui;
        const hideFlags = {};
        for (const key of Object.keys(HIDE_UI_ATTR_MAP)) {
            // Convert "fileMenu" → "showFileMenu" capability key
            const capKey = 'show' + key.charAt(0).toUpperCase() + key.slice(1);
            if (!ui[capKey]) {
                hideFlags[key] = true;
            }
        }
        applyHideUI(hideFlags);
    }

    /**
     * Register adapters for static/offline mode
     * These adapters provide client-side implementations for features
     * that normally require server API calls
     * @private
     */
    async _registerStaticModeAdapters() {
        try {
            const { default: LinkValidationAdapter } = await import(
                './adapters/LinkValidationAdapter.js'
            );
            this.api.setAdapters({
                linkValidation: new LinkValidationAdapter(),
            });
            console.log('[App] Registered static mode adapters');
        } catch (error) {
            console.error('[App] Failed to register static mode adapters:', error);
        }
    }

    /**
     * Detect if the app should run in static (offline) mode
     * @deprecated Use this.runtimeConfig.isStaticMode() or this.capabilities.storage.remote instead
     * @returns {boolean}
     */
    detectStaticMode() {
        // Use RuntimeConfig if available (new pattern)
        if (this.runtimeConfig) {
            return this.runtimeConfig.isStaticMode();
        }

        // Fallback for early initialization before RuntimeConfig is set
        // Priority 1: Explicit static mode flag (set in static/index.html)
        if (window.__EXE_STATIC_MODE__ === true) {
            return true;
        }

        // Priority 2: File protocol (opened as local file)
        if (window.location.protocol === 'file:') {
            return true;
        }

        // Priority 3: No server URL configured
        if (!this.eXeLearning.config.fullURL) {
            return true;
        }

        // Default: server mode
        return false;
    }

    setupSessionMonitor() {
        const baseInterval = Number(
            this.eXeLearning.config.sessionCheckIntervalMs ||
                this.eXeLearning.config.sessionCheckInterval ||
                0
        );

        const interval = baseInterval > 0 ? baseInterval : 60000;

        const checkUrl = this.composeUrl('/api/session/check');
        const loginUrl = this.composeUrl('/login');

        this.sessionMonitor = new SessionMonitor({
            checkUrl,
            loginUrl,
            interval,
            closeYjsConnections: (reason) =>
                this.closeYjsConnections(reason),
            onSessionInvalid: (reason) => this.handleSessionExpiration(reason),
            onNetworkError: (error, reason) => {
                console.debug(
                    'SessionMonitor: temporary issue while checking the session',
                    reason,
                    error
                );
            },
        });

        window.eXeSessionMonitor = this.sessionMonitor;
        this.sessionMonitor.start();
    }

    getBasePath() {
        const basePath = this.eXeLearning.config?.basePath ?? '';
        if (!basePath || basePath === '/') {
            return '';
        }

        return basePath.replace(/\/+$/, '');
    }

    composeUrl(path = '') {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const basePath = this.getBasePath();

        if (!basePath) {
            return normalizedPath;
        }

        return `${basePath}${normalizedPath}`;
    }

    /**
     * Close Yjs WebSocket connections when session expires.
     * This prevents orphaned WebSocket connections and ensures clean logout.
     * @param {string} reason - The reason for closing (e.g., 'unauthorized', 'session-check')
     */
    closeYjsConnections(reason) {
        console.debug('Closing Yjs connections due to:', reason);

        // Close YjsDocumentManager WebSocket connection
        const bridge = this.project?._yjsBridge;
        if (bridge?.manager) {
            try {
                // Disconnect WebSocket without saving (session is invalid)
                if (bridge.manager.wsProvider) {
                    bridge.manager.wsProvider.disconnect();
                    console.debug('Yjs WebSocket disconnected');
                }
            } catch (error) {
                console.debug(
                    'SessionMonitor: error while closing Yjs WebSocket',
                    error
                );
            }
        }

        // Also try to close via YjsDocumentManager if available globally
        if (window.yjsDocumentManager?.wsProvider) {
            try {
                window.yjsDocumentManager.wsProvider.disconnect();
            } catch (error) {
                console.debug(
                    'SessionMonitor: error while closing global Yjs WebSocket',
                    error
                );
            }
        }
    }

    handleSessionExpiration(reason) {
        if (this.sessionExpirationHandled) {
            return;
        }

        this.sessionExpirationHandled = true;

        // Cleanup iDevice timers
        try {
            this.project?.cleanupCurrentIdeviceTimer?.();
        } catch (error) {
            console.debug(
                'SessionMonitor: error while cleaning up timers during logout',
                error
            );
        }

        // Cleanup Yjs observers and bindings
        try {
            const bridge = this.project?._yjsBridge;
            if (bridge) {
                bridge.destroy?.();
            }
        } catch (error) {
            console.debug(
                'SessionMonitor: error while cleaning up Yjs bridge during logout',
                error
            );
        }

        console.info('Session expired, redirecting to login.', reason);
    }

    /**
     * Check if the app is running in static/offline mode.
     * @deprecated Prefer using this.capabilities for feature checks
     * @returns {boolean}
     */
    isStaticMode() {
        // Use RuntimeConfig as primary source
        if (this.runtimeConfig) {
            return this.runtimeConfig.isStaticMode();
        }
        // Fallback to capabilities
        return this.capabilities?.storage?.remote === false;
    }

    /**
     * Load API parameters (routes, config) from server
     * Skipped in static mode as there's no backend API
     */
    async loadApiParameters() {
        // Skip in static mode - no backend API available
        if (this.capabilities?.storage?.remote === false) {
            console.log('[App] Static mode - skipping API parameters load');
            return;
        }
        await this.api.loadApiParameters();
    }

    /**
     *
     */
    async loadIdevicesInstalled() {
        await this.idevices.loadIdevicesFromAPI();
    }

    /**
     *
     */
    async loadThemesInstalled() {
        await this.themes.loadThemesFromAPI();
    }

    /**
     *
     */
    async loadProject() {
        await this.project.load();
    }

    /**
     *
     */
    async loadUser() {
        await this.user.loadUserPreferences();
    }

    /**
     *
     */
    async loadInstallationType() {
        await this.project.reloadInstallationType();
    }

    /**
     *
     * @param {*} locale
     */
    async loadLocale() {
        await this.locale.init();

        // Initialize DOM translator for static mode
        // This translates elements with data-i18n attributes after translations are loaded
        if (this.runtimeConfig?.isStaticMode()) {
            this._domTranslator = new DOMTranslator();
            this._domTranslator.translateAll();
            this._domTranslator.observeDOM();
            console.log('[App] DOM translator initialized for static mode');
        }
    }

    /**
     * Re-translate all DOM elements (useful when language changes)
     * Only applicable in static mode where DOMTranslator is used
     */
    refreshTranslations() {
        if (this._domTranslator) {
            this._domTranslator.refresh();
        }
    }

    /**
     *
     */
    async initializedToasts() {
        this.toasts.init();
        new BlobPasteGuard({ toastsManager: this.toasts }).start();
    }

    /**
     *
     */
    async initializedModals() {
        this.modals.init();
        this.modals.behaviour();
    }

    /**
     *
     */
    async selectFirstNodeStructure() {
        await this.project.structure.selectFirst();
    }

    /**
     *
     */
    async ideviceEngineBehaviour() {
        this.project.idevices.behaviour();
    }

    /**
     * Check for errors
     *
     */
    async check() {
        // No server-side checks needed when remote storage is unavailable
        if (!this.capabilities?.storage?.remote) {
            return;
        }

        // Check FILES_DIR
        if (!this.eXeLearning.config?.filesDirPermission?.checked) {
            let htmlBody = '';
            const info = this.eXeLearning.config?.filesDirPermission?.info || [];
            info.forEach((text) => {
                htmlBody += `<p>${text}</p>`;
            });
            if (htmlBody) {
                this.modals.alert.show({
                    title: _('Permissions error'),
                    body: htmlBody,
                    contentId: 'error',
                });
            }
        }
    }

    /**
     * Show LOPDGDD modal if necessary
     * Skip LOPD modal when auth is not required (guest access)
     *
     */
    async showModalLopd() {
        // Skip LOPD modal when auth is not required (static/offline mode)
        if (!this.capabilities?.auth?.required) {
            await this.loadProject();
            this.check();
            return;
        }

        if (!eXeLearning.user.acceptedLopd) {
            // Load modals content
            await this.project.loadModalsContent();
            // Remove loading screen
            this.interface.loadingScreen.hide();
            // Hide node-content loading panel
            document.querySelector('#node-content-container').style.display =
                'none';
            this.modals.lopd.modal._config.keyboard = false;
            this.modals.lopd.modal._config.backdrop = 'static';
            this.modals.lopd.modal._ignoreBackdropClick = true;
            this.modals.lopd.show({});
        } else {
            // In case LOPD accepted
            await this.loadProject();
            // Check for errors
            this.check();
        }
    }

    /**
     * To do. Some strings are not extracted (see #428)
     *
     */
    async tmpStringList() {
        const requiredStrins = [
            _(
                'Create image maps: Images with interactive hotspots to reveal images, videos, sounds, texts...'
            ),
            _('Show questionnaire'),
            _('Show active areas'),
            _('Click here to do this activity'),
            _('Select the correct options and click on the "Reply" button.'),
            _(
                'Mark all the options in the correct order and click on the "Reply" button.'
            ),
            _(
                'Write the correct word o phrase and click on the "Reply" button.'
            ),
            _('Click on'),
            _('Everything is perfect! Do you want to repeat this activity?'),
            _(
                'Great! You have passed the test, but you can improve it surely. Do you want to repeat this activity?'
            ),
            _(
                'Almost perfect! You can still do it better. Do you want to repeat this activity?'
            ),
            _('It is not correct! You have clicked on'),
            _('and the correct answer is'),
            _('Great! You have visited the required dots.'),
            _('You can do the test.'),
            _('Select a subtitle file. Supported formats:'),
            _('Map'),
            _('Return'),
            _('Questionnarie'),
            _('Arrow'),
            _('Map marker'),
            _('Do you want to save the changes of this presentation?'),
            _('Do you want to save the changes of this quiz?'),
            _('Do you want to save the changes of this map?'),
            _('Provide a slide title.'),
            _('Hide score bar'),
            _('Play the sound when scrolling the mouse over the points.'),
            _('Show when the mouse is over the icon or active area.'),
            _('Hide areas'),
        ];
    }

    /**
     * Add the notranslate class to some elements (see #43)
     *
     */
    async addNoTranslateForGoogle() {
        $('.exe-icon, .auto-icon, #nav_list .root-icon').each(function () {
            $(this).addClass('notranslate');
        });
    }

    /**
     * Execute the custom JavaScript code
     *
     */
    async runCustomJavaScriptCode() {
        try {
            $eXeLearningCustom.init();
        } catch (e) {
            // Intentional: suppress errors from optional custom JavaScript
        }
    }

    /**
     * Compose and initialize shortcuts
     */
    async initializedShortcuts() {
        this.shortcuts.init();
    }

    /**
     * Bind Electron download-done to show final path toast (offline desktop)
     */
    bindElectronDownloadToasts() {
        if (
            !window.electronAPI ||
            typeof window.electronAPI.onDownloadDone !== 'function'
        )
            return;
        try {
            window.electronAPI.onDownloadDone(({ ok, path, error }) => {
                const esc = (s) =>
                    (s || '')
                        .toString()
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;');
                if (ok) {
                    let toastData = {
                        title: _('Saved'),
                        body: `Saved to: <code>${esc(path)}</code>`,
                        icon: 'task_alt',
                        remove: 3500,
                    };
                    this.toasts.createToast(toastData);
                } else {
                    let toastData = {
                        title: _('Error'),
                        body: esc(error || _('Unknown error.')),
                        icon: 'error',
                        error: true,
                        remove: 5000,
                    };
                    this.toasts.createToast(toastData);
                }
            });
        } catch (_e) {
            // Intentional: Electron API may not exist in browser
        }
    }

    /**
     * Bind handler for files opened via Electron file association
     */
    bindElectronFileOpenHandler() {
        if (this.electronFileOpenHandlerBound) return;
        if (
            !window.electronAPI ||
            typeof window.electronAPI.onOpenFile !== 'function'
        )
            return;

        this.electronFileOpenHandlerBound = true;
        window.electronAPI.onOpenFile(async (filePath) => {
            console.log('[App] Received file to open:', filePath);
            await this.openFileFromPath(filePath);
        });

        if (
            typeof window.electronAPI.notifyRendererReadyForOpenFile === 'function'
        ) {
            window.electronAPI.notifyRendererReadyForOpenFile();
        }
        if (window.electronAPI?.onGetCloseCopy) {
            window.electronAPI.onGetCloseCopy(() => {
                window.electronAPI.sendCloseCopy({
                    title:              _('Unsaved changes'),
                    message:            _('You have unsaved changes. Are you sure you want to leave?'),
                    detail:             _('If you close now, your latest changes will be lost. Stay to save the project first.'),
                    stayButtonLabel:    _('Stay'),
                    discardButtonLabel: _('Close without saving'),
               });
           });
        }
    }

    /**
     * Open a file from a filesystem path (used by Electron file association)
     * @param {string} filePath - Full path to the .elpx file
     */
    async openFileFromPath(filePath) {
        try {
            if (
                this.runtimeConfig?.isStaticMode?.() &&
                !this.isYjsBridgeReadyForElectronOpen()
            ) {
                this.pendingElectronOpenFiles.push(filePath);
                void this.flushPendingElectronOpenFilesWhenReady();
                return;
            }

            if (
                !this.modals?.openuserodefiles ||
                typeof this.modals.openuserodefiles.largeFilesUpload !== 'function'
            ) {
                this.pendingElectronOpenFiles.push(filePath);
                void this.flushPendingElectronOpenFilesWhenReady();
                return;
            }

            // Read file via Electron API
            const res = await window.electronAPI.readFile(filePath);

            if (!res || !res.ok) {
                console.error('[App] Error reading file:', res?.error);
                return;
            }

            // Persist the opened file path across the reload that follows
            // import, so the next Save dialog pre-fills with it.
            try {
                if (typeof window.electronAPI.setSavedPath === 'function') {
                    await window.electronAPI.setSavedPath(filePath);
                }
            } catch (_e) {
                // Best effort — must not break the open flow.
            }

            // Convert base64 to File object
            const binStr = atob(res.base64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
                bytes[i] = binStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/octet-stream' });

            // Extract filename from path
            const filename = filePath.split(/[\\/]/).pop() || 'project.elpx';
            const file = new File([blob], filename, {
                type: 'application/octet-stream',
                lastModified: res.mtimeMs || Date.now(),
            });

            // Use existing upload function
            this.modals.openuserodefiles.largeFilesUpload(file);
        } catch (error) {
            console.error('[App] Error opening file:', error);
        }
    }

    async openStaticFile(file) {
        if (!(file instanceof File)) return;
        if (!this.runtimeConfig?.isStaticMode?.()) return;

        if (
            !this.isYjsBridgeReadyForElectronOpen() ||
            !this.modals?.openuserodefiles ||
            typeof this.modals.openuserodefiles.largeFilesUpload !== 'function'
        ) {
            this.pendingStaticOpenFiles.push(file);
            void this.flushPendingStaticOpenFilesWhenReady();
            return;
        }

        this.modals.openuserodefiles.largeFilesUpload(file);
    }

    isYjsBridgeReadyForElectronOpen() {
        const bridge = this.project?._yjsBridge;
        if (!bridge) return false;
        const getDocumentManager = bridge.getDocumentManager;
        if (typeof getDocumentManager !== 'function') return false;
        return !!getDocumentManager.call(bridge);
    }

    async flushPendingElectronOpenFilesWhenReady(
        maxWaitMs = 20000,
        pollMs = 150
    ) {
        if (this.pendingElectronOpenFiles.length === 0) return;

        if (this.runtimeConfig?.isStaticMode?.()) {
            const start = Date.now();
            while (
                this.pendingElectronOpenFiles.length > 0 &&
                !this.isYjsBridgeReadyForElectronOpen() &&
                Date.now() - start < maxWaitMs
            ) {
                await new Promise((resolve) => setTimeout(resolve, pollMs));
            }
        }

        await this.flushPendingElectronOpenFiles();
    }

    async flushPendingStaticOpenFilesWhenReady(maxWaitMs = 20000, pollMs = 150) {
        if (this.pendingStaticOpenFiles.length === 0) return;

        if (this.runtimeConfig?.isStaticMode?.()) {
            const start = Date.now();
            while (
                this.pendingStaticOpenFiles.length > 0 &&
                !this.isYjsBridgeReadyForElectronOpen() &&
                Date.now() - start < maxWaitMs
            ) {
                await new Promise((resolve) => setTimeout(resolve, pollMs));
            }
        }

        if (
            !this.modals?.openuserodefiles ||
            typeof this.modals.openuserodefiles.largeFilesUpload !== 'function' ||
            this.pendingStaticOpenFiles.length === 0
        ) {
            return;
        }

        const filesToOpen = [...this.pendingStaticOpenFiles];
        this.pendingStaticOpenFiles = [];
        for (const file of filesToOpen) {
            this.modals.openuserodefiles.largeFilesUpload(file);
        }
    }

    async flushPendingElectronOpenFiles() {
        if (
            this.runtimeConfig?.isStaticMode?.() &&
            !this.isYjsBridgeReadyForElectronOpen()
        ) {
            return;
        }

        if (
            !this.modals?.openuserodefiles ||
            typeof this.modals.openuserodefiles.largeFilesUpload !== 'function' ||
            this.pendingElectronOpenFiles.length === 0
        ) {
            return;
        }

        const filesToOpen = [...this.pendingElectronOpenFiles];
        this.pendingElectronOpenFiles = [];
        for (const filePath of filesToOpen) {
            await this.openFileFromPath(filePath);
        }
    }

    /**
     * "Not for production use" warning (alpha, beta, rc... versions)
     *
     */
    async showProvisionalDemoWarning() {
        if (
            eXeLearning.version.indexOf('-nightly') === -1 &&
            eXeLearning.version.indexOf('-pr') === -1 &&
            eXeLearning.version.indexOf('-alpha') === -1 &&
            eXeLearning.version.indexOf('-beta') === -1 &&
            eXeLearning.version.indexOf('-rc') === -1
        ) {
            return;
        }

        let msg = _(
            'eXeLearning %s is a development version. It is not for production use.'
        );

        // Disable static versions after DEMO_EXPIRATION_DATE
        if ($('body').attr('installation-type') == 'static') {
            msg = _('This is just a demo version. Not for real projects.');
            var expires = eXeLearning.expires;
            if (expires.length == 8) {
                expires = parseInt(expires);
                if (!isNaN(expires) && expires != -1) {
                    var date = new Date();
                    date = date
                        .toISOString()
                        .slice(0, 10)
                        .replace(/-/g, '');
                    if (date.length == 8) {
                        if (date >= expires) {
                            msg = _(
                                'eXeLearning %s has expired! Please download the latest version.'
                            );
                            msg = msg.replace(
                                'eXeLearning %s',
                                '<strong>eXeLearning ' +
                                    eXeLearning.version +
                                    '</strong>'
                            );
                            $('body').html(
                                '<div id="load-screen-main" class="expired"><p class="alert alert-warning">' +
                                    msg +
                                    '</p></div>'
                            );
                            return;
                        } else {
                            msg = _(
                                'This is just a demo version. Not for real projects. Days before it expires: %s'
                            );

                            var expiresObj = expires.toString();
                            expiresObj =
                                expiresObj.substring(0, 4) +
                                '-' +
                                expiresObj.substring(4, 6) +
                                '-' +
                                expiresObj.substring(6, 8);
                            var dateObj = date.toString();
                            dateObj =
                                dateObj.substring(0, 4) +
                                '-' +
                                dateObj.substring(4, 6) +
                                '-' +
                                dateObj.substring(6, 8);

                            var expiresDate = new Date(expiresObj).getTime();
                            var currentDate = new Date(dateObj).getTime();
                            var diff = expiresDate - currentDate;
                            diff = diff / (1000 * 60 * 60 * 24);

                            msg = msg.replace(
                                '%s',
                                '<strong>' + diff + '</strong>'
                            );
                        }
                    }
                }
            }
        }

        msg = msg.replace('eXeLearning %s', '<strong>eXeLearning %s</strong>');
        msg = msg.replace('%s', eXeLearning.version);

        let closeMsg = _('Accept');
        let tmp = `
      <div class="alert alert-warning alert-dismissible fade show m-4"
           role="alert"
           id="eXeBetaWarning">
        ${msg}
        <button type="button"
                class="btn-close"
                data-bs-dismiss="alert"
                aria-label="${closeMsg}"
                id="eXeBetaWarningCloseBtn">
        </button>
      </div>
    `;

        if (!document.getElementById('eXeBetaWarning')) {
            let nodeContent = $('#node-content');
            if (nodeContent.length !== 1) {
                return;
            }
            nodeContent.before(tmp);
        }
    }

    /**
     * Provisional "Things to do" warning
     *
     */
    async showProvisionalToDoWarning() {
        if (eXeLearning.version.indexOf('-') === -1) {
            return;
        }
        if (document.getElementById('eXeToDoWarning')) {
            return;
        }

        $('#eXeLearningNavbar nav div > ul').append(
            '<li class="nav-item"><a class="nav-link text-danger" href="#" id="eXeToDoWarning" hreflang="es"><span class="auto-icon" aria-hidden="true">warning</span>' +
                _('Warning') +
                '</a></li>'
        );
        $('#eXeToDoWarning').on('click', function () {
            let msg = `
                    <p class="alert alert-info mb-4">Por favor, antes de avisar de un fallo, asegúrate de que no está en esta lista.</p>
                    <p><strong>Problemas que ya conocemos:</strong></p>
                    <ul>
                        <li>Solo hay dos estilos, y son casi iguales.</li>
                        <li>No hay editor de estilos.</li>
                        <li>Falta Archivo - Imprimir.</li>
                        <li>No se puede exportar o importar una página.</li>
                        <li>Si estás editando un iDevice no puedes cambiar su título.</li>
                        <li>No hay opción para exportar en formato SCORM 2004.</li>
                    </ul>
                    <p><strong>Si encuentras algo más:</strong> Ayuda → Informar de un fallo</p>
                    <p>Muchas gracias.</p>
            `;
            eXe.app.alert(msg, 'Importante');
            $(this).removeClass('text-danger').addClass('text-muted');
            return false;
        });
    }
}

/****************************************************************************************/

/**
 * Prevent unexpected close
 *
 * Install the `beforeunload` handler only after the first real user gesture.
 * If we install it eagerly on page load, Chrome (especially in headless/E2E
 * contexts) blocks the confirmation panel and logs a SEVERE console warning:
 *   "Blocked attempt to show a 'beforeunload' confirmation panel for a frame
 *    that never had a user gesture since its load."
 * Deferring the installation avoids noisy warnings during automated navigations
 * while preserving the safety prompt for real users after they interact.
 *
 * Warn only when there are unsaved changes. Electron handles close flow separately.
 */
let __exeBeforeUnloadInstalled = false;
function __exeInstallBeforeUnloadOnce() {
    if (__exeBeforeUnloadInstalled) return;
    __exeBeforeUnloadInstalled = true;

    // Delegate to UnsavedChangesHelper (single source of truth for beforeunload)
    if (window.UnsavedChangesHelper) {
        window.UnsavedChangesHelper.setupBeforeUnloadHandler();
    }
}

// Listen for the first trusted user interaction and install then.
['pointerdown', 'touchstart', 'keydown', 'input'].forEach((type) => {
    window.addEventListener(type, __exeInstallBeforeUnloadOnce, {
        once: true,
        passive: true,
        capture: true,
    });
});

/**
 * Run eXe client on load
 * In static mode, waits for project selection before initializing
 *
 */
window.onload = function () {
    var eXeLearning = window.eXeLearning;
    eXeLearning.app = new App(eXeLearning);

    // Static mode: wait for project selection (projectId will be set by welcome screen)
    // Use RuntimeConfig for early detection (before app.capabilities is available)
    const runtimeConfig = RuntimeConfig.fromEnvironment();
    if (runtimeConfig.isStaticMode() && !eXeLearning.projectId) {
        console.log('[App] Static mode: waiting for project selection...');
        // Expose a function to start the app after project is selected
        window.__startExeApp = function () {
            console.log('[App] Starting app with project:', eXeLearning.projectId);
            eXeLearning.app.init();
        };
        return;
    }

    eXeLearning.app.init();
};
