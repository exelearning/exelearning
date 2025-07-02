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
        // Add not extracted strings (to review)
        await this.addNotExtractedLinks();
        // Add the notranslate class to some elements
        await this.addNoTranslateForGoogle();
        // Execute the custom JavaScript code
        await this.runCustomJavaScriptCode();
    }

    /**
     *
     */
    parseExelearningSymfonyData() {
        window.eXeLearning.user = JSON.parse(
            window.eXeLearning.user.replace(/&quot;/g, '"'),
        );
        window.eXeLearning.config = JSON.parse(
            window.eXeLearning.config.replace(/&quot;/g, '"'),
        );
        window.eXeLearning.symfony = JSON.parse(
            window.eXeLearning.symfony.replace(/&quot;/g, '"'),
        );
        window.eXeLearning.mercure = JSON.parse(
            window.eXeLearning.mercure.replace(/&quot;/g, '"'),
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
                            'https://',
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
                        'https://',
                    );
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
     * Some strings are not found with "make translations" due to the "make fix-js" formatting
     *
     */
    async addNotExtractedLinks() {
        let strs = [
            // ideviceNode.js
            _('Delete iDevice? This cannot be undone.'),
            _('iDevice deleted. Now the box is empty. Delete the box too?'),
            // projectManager.js
            _('You are editing an iDevice. Please close it before continuing'),
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
     * "Not for production use" warning (alpha, beta, rc... versions)
     *
     */
    async showProvisionalDemoWarning() {
        if (eXeLearning.version.indexOf('-') === -1) {
            return;
        }

        let msg = _(
            'eXeLearning %s is a development version. It is not for production use.',
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
                                'eXeLearning %s has expired! Please download the latest version.',
                            );
                            msg = msg.replace(
                                'eXeLearning %s',
                                '<strong>eXeLearning ' +
                                    eXeLearning.version +
                                    '</strong>',
                            );
                            $('body').html(
                                '<div id="load-screen-main" class="expired"><p class="alert alert-warning">' +
                                    msg +
                                    '</p></div>',
                            );
                            return;
                        } else {
                            msg = _(
                                'This is just a demo version. Not for real projects. Days before it expires: %s',
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
                                '<strong>' + diff + '</strong>',
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

        $('#eXeLearningNavbar > ul').append(
            '<li class="nav-item"><a class="nav-link text-danger" href="#" id="eXeToDoWarning" hreflang="es"><i class="auto-icon" aria-hidden="true">warning</i>' +
                _('Warning') +
                '</a></li>',
        );
        $('#eXeToDoWarning').on('click', function () {
            let msg = `
                    <p class="alert alert-info mb-4">Por favor, antes de avisar de un fallo, asegúrate de que no está en esta lista.</p>
                    <p><strong>Problemas que ya conocemos:</strong></p>
                    <ul>
                        <li class="exe-offline">Solo deja descargar proyectos, no guardar y exportar. Estamos en ello...</li>
                        <li class="exe-offline">De momento guarda en un directorio temporal, no puedes elegir dónde.</li>
                        <li>Solo hay un estilo y no puedes instalar más.</li>
                        <li>No hay editor de estilos.</li>
                        <li>Falta Archivo - Imprimir.</li>
                        <li>No se puede exportar o importar una página.</li>
                        <li>Si estás editando un iDevice no puedes cambiar su título.</li>
                        <li>La exportación SCORM 2004 no funciona bien.</li>
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
 */
window.onbeforeunload = function (event) {
    event.preventDefault();
    // Kept for legacy.
    event.returnValue = false;
};

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
