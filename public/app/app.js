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

class App {
    constructor(eXeLearning) {
        this.eXeLearning = eXeLearning;
        this.parseExelearningSymfonyData();
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
    }

    /**
     *
     */
    async init() {
        // Compose and initialized toasts
        this.initializedToasts();
        // Compose and initialized modals
        this.initializedModals();
        // Load api routes
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
        // To do warning (remove this as soon as possible)
        await this.showProvisionalToDoWarning();
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
    }

    /**
     *
     */
    parseExelearningSymfonyData() {
        window.eXeLearning.user = JSON.parse(
            window.eXeLearning.user.replace(/&quot;/g, '"')
        );
        window.eXeLearning.config = JSON.parse(
            window.eXeLearning.config.replace(/&quot;/g, '"')
        );
        window.eXeLearning.symfony = JSON.parse(
            window.eXeLearning.symfony.replace(/&quot;/g, '"')
        );
        window.eXeLearning.mercure = JSON.parse(
            window.eXeLearning.mercure.replace(/&quot;/g, '"')
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
                    window.eXeLearning.symfony[property] &&
                    window.eXeLearning.symfony[property].startsWith('http://')
                ) {
                    window.eXeLearning.symfony[property] =
                        window.eXeLearning.symfony[property].replace(
                            'http://',
                            'https://'
                        );
                }
            });

            if (
                window.eXeLearning.mercure.url &&
                window.eXeLearning.mercure.url.startsWith('http://')
            ) {
                window.eXeLearning.mercure.url =
                    window.eXeLearning.mercure.url.replace(
                        'http://',
                        'https://'
                    );
            }
        }

        // Test-env override: when running E2E with Panther, the page origin
        // is the internal PHP server (exelearning:908X), which doesn't host Mercure.
        // Force the hub to the Nginx/Caddy endpoint in the exelearning container.
        if (window.eXeLearning?.symfony?.environment === 'test') {
            // Only override if not already explicitly set to a non-908X host
            try {
                const current = window.eXeLearning.mercure?.url || '';
                const url = new URL(current || 'http://exelearning');
                const isPantherPort = /^90\d{2}$/.test(
                    String(urlRequest.port || '')
                );
                const isCurrentOk = current.includes('exelearning:8080');
                if (!isCurrentOk && isPantherPort) {
                    window.eXeLearning.mercure = {
                        ...(window.eXeLearning.mercure || {}),
                        url: 'http://exelearning:8080/.well-known/mercure',
                    };
                }
            } catch (e) {
                // Fallback: set directly
                window.eXeLearning.mercure = {
                    ...(window.eXeLearning.mercure || {}),
                    url: 'http://exelearning:8080/.well-known/mercure',
                };
            }
        }
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
        // Check FILES_DIR
        if (!this.eXeLearning.symfony.filesDirPermission.checked) {
            let htmlBody = '';
            this.eXeLearning.symfony.filesDirPermission.info.forEach((text) => {
                htmlBody += `<p>${text}</p>`;
            });
            this.modals.alert.show({
                title: _('Permissions error'),
                body: htmlBody,
                contentId: 'error',
            });
        }
    }

    /**
     * Show LOPDGDD modal if necessary
     *
     */
    async showModalLopd() {
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
        } catch (e) {}
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
        } catch (_e) {}
    }

    /**
     * "Not for production use" warning (alpha, beta, rc... versions)
     *
     */
    async showProvisionalDemoWarning() {
        if (eXeLearning.version.indexOf('-') === -1) {
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
                    var date = date
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
        event.preventDefault();
        // Modern browsers ignore custom text; a non-empty value is still
        // required to trigger the confirmation dialog.
        event.returnValue = '';
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
 * Catch ctrl+z action
 *
 */
/* To review (no Ctrl+Z for the moment
window.addEventListener('keydown', function (event) {
    if (
        (event.key == 'z' || event.key == 'Z') &&
        (event.ctrlKey || event.metaKey)
    ) {
        eXeLearning.app.project.undoLastAction();
    }
});
*/

/**
 * Run eXe client on load
 *
 */
window.onload = function () {
    var eXeLearning = window.eXeLearning;
    eXeLearning.app = new App(eXeLearning);
    eXeLearning.app.init();
};
