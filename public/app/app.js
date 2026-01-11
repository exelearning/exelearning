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
import DataProvider from './core/DataProvider.js';
// Core infrastructure - ports/adapters pattern
import { RuntimeConfig } from './core/RuntimeConfig.js';
import { Capabilities } from './core/Capabilities.js';
import { ProviderFactory } from './core/ProviderFactory.js';

export default class App {
    constructor(eXeLearning) {
        this.eXeLearning = eXeLearning;
        this.parseExelearningConfig();

        // Detect and initialize static/offline mode
        this.initializeDataProvider();

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

        if (!this.eXeLearning.config.isOfflineInstallation) {
            this.setupSessionMonitor();
        }
    }

    /**
     *
     */
    async init() {
        // Initialize DataProvider (load static data if in static mode)
        await this.dataProvider.init();

        // Create ProviderFactory and inject adapters (Ports & Adapters pattern)
        // This is the ONLY place where mode detection happens for adapters
        await this.initializeAdapters();

        // Compose and initialized toasts
        this.initializedToasts();
        // Compose and initialized modals
        this.initializedModals();
        // Load api routes (uses DataProvider in static mode)
        await this.loadApiParameters();
        // Load locale strings
        await this.loadLocale();
        // Load idevices installed
        await this.loadIdevicesInstalled();
        // Load themes installed
        await this.loadThemesInstalled();
        // Load user data
        await this.loadUser();
        // Show LOPDGDD modal if necessary and load project data
        await this.showModalLopd();
        // "Not for production use" warning
        await this.showProvisionalDemoWarning();
        // To review (showProvisionalToDoWarning might be useful for future beta releases)
        // await this.showProvisionalToDoWarning();
        // Missing strings (not extracted). See #428 (to do)
        await this.tmpStringList();
        // Add the notranslate class to some elements
        await this.addNoTranslateForGoogle();
        // Execute the custom JavaScript code
        await this.runCustomJavaScriptCode();
        // Compose and initialize shortcuts
        await this.initializedShortcuts();

        // Electron: show toast with final saved path
        this.bindElectronDownloadToasts();

        // Electron: handle files opened via file association
        this.bindElectronFileOpenHandler();

        // Handle exe-package:elp protocol for download-source-file iDevice
        this.initExePackageProtocolHandler();
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
                    body: _('Project not loaded or Yjs not enabled'),
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
     * Initialize DataProvider based on detected mode (static vs server)
     * Called during constructor, before other managers are created
     */
    initializeDataProvider() {
        // Use RuntimeConfig for mode detection (single source of truth)
        this.runtimeConfig = RuntimeConfig.fromEnvironment();
        this.capabilities = new Capabilities(this.runtimeConfig);

        // Backward compatibility: store mode flags in config
        const isStaticMode = this.runtimeConfig.isStaticMode();
        this.eXeLearning.config.isStaticMode = isStaticMode;

        // Create DataProvider with detected mode
        const mode = isStaticMode ? 'static' : 'server';
        const basePath = this.eXeLearning.config.basePath || '';

        this.dataProvider = new DataProvider(mode, { basePath });

        if (isStaticMode) {
            console.log('[App] Running in STATIC/OFFLINE mode');
            // Ensure offline-related flags are set
            this.eXeLearning.config.isOfflineInstallation = true;
        }

        // Log capabilities for debugging
        console.log('[App] Capabilities:', {
            collaboration: this.capabilities.collaboration.enabled,
            remoteStorage: this.capabilities.storage.remote,
            auth: this.capabilities.auth.required,
        });
    }

    /**
     * Initialize adapters using ProviderFactory (Ports & Adapters pattern).
     * This is the ONLY place where adapters are created and injected.
     * After this, all API calls go through the appropriate adapter based on mode.
     */
    async initializeAdapters() {
        try {
            // Create factory (mode detection happens inside)
            const factory = await ProviderFactory.create();

            // Create all adapters
            const adapters = factory.createAllAdapters();

            // Inject into ApiCallManager
            this.api.setAdapters(adapters);

            // Store factory and capabilities for other components
            this.providerFactory = factory;
            // Update capabilities from factory (in case they differ)
            this.capabilities = factory.getCapabilities();

            console.log('[App] Adapters injected successfully:', {
                mode: factory.getConfig().mode,
                adaptersInjected: Object.keys(adapters).length,
            });
        } catch (error) {
            console.error('[App] Failed to initialize adapters:', error);
            // Continue without adapters - legacy fallback code will handle it
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
        // Fallback to DataProvider for backward compatibility
        return this.dataProvider?.isStaticMode() ?? false;
    }

    /**
     *
     */
    async loadApiParameters() {
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
    }

    /**
     *
     */
    async initializedToasts() {
        this.toasts.init();
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
        if (
            !window.electronAPI ||
            typeof window.electronAPI.onOpenFile !== 'function'
        )
            return;

        window.electronAPI.onOpenFile(async (filePath) => {
            console.log('[App] Received file to open:', filePath);
            await this.openFileFromPath(filePath);
        });
    }

    /**
     * Open a file from a filesystem path (used by Electron file association)
     * @param {string} filePath - Full path to the .elpx file
     */
    async openFileFromPath(filePath) {
        try {
            // Read file via Electron API
            const res = await window.electronAPI.readFile(filePath);

            if (!res || !res.ok) {
                console.error('[App] Error reading file:', res?.error);
                return;
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

            // Store original path for save functionality
            if (window.electronAPI && window.electronAPI.setSavedPath) {
                const projectKey = this.project?.odeSession || 'default';
                await window.electronAPI.setSavedPath(projectKey, filePath);
            }

            // Use existing upload function
            this.modals.openuserodefiles.largeFilesUpload(file);
        } catch (error) {
            console.error('[App] Error opening file:', error);
        }
    }

    /**
     * "Not for production use" warning (alpha, beta, rc... versions)
     *
     */
    async showProvisionalDemoWarning() {
        if (
            eXeLearning.version.indexOf('-alpha') === -1 &&
            eXeLearning.version.indexOf('-beta') === -1 &&
            eXeLearning.version.indexOf('-rc') === -1
        ) {
            return;
        }

        let msg = _(
            'eXeLearning %s is a development version. It is not for production use.'
        );

        // Disable offline versions after DEMO_EXPIRATION_DATE
        if ($('body').attr('installation-type') == 'offline') {
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
 */
let __exeBeforeUnloadInstalled = false;
function __exeInstallBeforeUnloadOnce() {
    if (__exeBeforeUnloadInstalled) return;
    __exeBeforeUnloadInstalled = true;

    window.onbeforeunload = function (event) {
        // Auto-save with Yjs handles data persistence - no confirmation dialog needed
        return undefined;
    };
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
