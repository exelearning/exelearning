export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        this.button = this.menu.navbar.querySelector('#dropdownUtilities');
        this.preferencesButton = document.querySelector(
            '#navbar-button-preferences'
        );
        this.ideviceManagerButton = this.menu.navbar.querySelector(
            '#navbar-button-idevice-manager'
        );
        this.brokenLinksButton = this.menu.navbar.querySelector(
            '#navbar-button-odebrokenlinks'
        );
        this.filemanagerButton = this.menu.navbar.querySelector(
            '#navbar-button-filemanager'
        );
        this.usedFilesButton = this.menu.navbar.querySelector(
            '#navbar-button-odeusedfiles'
        );
        this.previewButton = this.menu.navbar.querySelector(
            '#navbar-button-preview'
        );
    }

    /**
     *
     */
    setEvents() {
        this.setTooltips();
        this.setPreferencesEvent();
        this.setIdeviceManagerEvent();
        this.setFileManagerEvent();
        this.setOdeBrokenLinksEvent();
        this.setOdeUsedFilesEvent();
        this.setPreviewEvent();
    }

    /**************************************************************************************
     * LISTENERS
     **************************************************************************************/

    /**
     *
     *
     */
    setTooltips() {
        // See eXeLearning.app.common.initTooltips
        $('.main-menu-right button')
            .attr('data-bs-placement', 'bottom')
            .tooltip();
        $('#exeUserMenuToggler').on('click mouseleave', function () {
            $(this).tooltip('hide');
        });
    }

    /**
     * Preferences form
     * Utilities (now user menu) -> Preferences
     *
     */
    setPreferencesEvent() {
        this.preferencesButton.addEventListener('click', (e) => {
            if (eXeLearning.app.project.checkOpenIdevice()) {
                e.preventDefault();
                return false;
            }
            this.preferencesEvent();
            e.preventDefault();
        });
    }

    /**
     * iDevice manager
     * Utilities -> iDevice manager
     *
     */
    setIdeviceManagerEvent() {
        this.ideviceManagerButton.addEventListener('click', () => {
            this.ideviceManagerEvent();
        });
    }

    /**
     * File Manager
     * Utilities -> File Manager
     *
     */
    setFileManagerEvent() {
        this.filemanagerButton.addEventListener('click', () => {
            this.fileManagerEvent();
        });
    }

    /**
     * Broken links
     * Utilities -> Link Validation Report
     *
     */
    setOdeBrokenLinksEvent() {
        this.brokenLinksButton.addEventListener('click', () => {
            this.odeBrokenLinksEvent();
        });
    }

    /**
     * Used Files
     * Utilities -> Resource Report
     *
     */
    setOdeUsedFilesEvent() {
        this.usedFilesButton.addEventListener('click', () => {
            this.odeUsedFilesEvent();
        });
    }

    /**
     * Preview
     * Utilities -> Preview
     *
     */
    setPreviewEvent() {
        this.previewButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.previewEvent();
        });
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Show app preferences modal
     *
     */
    preferencesEvent() {
        eXeLearning.app.user.preferences.showModalPreferences();
    }

    /**
     * Show idevice manager modal
     *
     */
    ideviceManagerEvent() {
        eXeLearning.app.idevices.showModalIdeviceManager();
    }

    /**
     * Show File Manager modal
     *
     */
    fileManagerEvent() {
        eXeLearning.app.modals.filemanager.show();
    }

    /**
     * Gets the ode broken links and shows it in a modal
     *
     */
    odeBrokenLinksEvent() {
        // Show message
        let toastData = {
            title: _('Link validation tool'),
            body: _('Looking for broken links...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        // Get ode broken list
        this.getOdeSessionBrokenLinksEvent().then((response) => {
            if (response.responseMessage == 'OK' && response.brokenLinks) {
                // Show eXe OdeBrokenList modal
                eXeLearning.app.modals.odebrokenlinks.show(
                    response.brokenLinks
                );
            } else {
                // Open eXe alert modal
                eXeLearning.app.modals.alert.show({
                    title: _('Link validation tool'),
                    body: _('No broken links found.'),
                });
            }
            // Remove message
            setTimeout(() => {
                toast.remove();
            }, 800);
        });
    }

    /**
     * Get the broken links in all ode on the session
     * @returns
     */
    async getOdeSessionBrokenLinksEvent() {
        let sessionId = eXeLearning.app.project.odeSession;
        let params = {
            csv: false,
            odeSessionId: sessionId,
        };
        let odeSessionBrokenLinks =
            await eXeLearning.app.api.getOdeSessionBrokenLinks(params);
        return odeSessionBrokenLinks;
    }

    /**
     * Gets the ode used files and shows it in a modal
     *
     */
    odeUsedFilesEvent() {
        // Show message
        let toastData = {
            title: _('Resources report'),
            body: _('Checking the project resources...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        // Get ode used files
        this.getOdeSessionUsedFilesEvent().then((response) => {
            if (response.responseMessage == 'OK' && response.usedFiles) {
                // Show eXe UsedFilesList modal
                eXeLearning.app.modals.odeusedfiles.show(response.usedFiles);
            } else {
                // Open eXe alert modal
                eXeLearning.app.modals.alert.show({
                    title: _('Resources report'),
                    body: _('The project has no files.'),
                });
            }
            // Remove message
            setTimeout(() => {
                toast.remove();
            }, 800);
        });
    }

    /**
     * Get the used files in all ode on the session
     * @returns
     */
    async getOdeSessionUsedFilesEvent() {
        let sessionId = eXeLearning.app.project.odeSession;
        let params = {
            csv: false,
            odeSessionId: sessionId,
            resourceReport: true,
        };
        let odeSessionUsedFiles =
            await eXeLearning.app.api.getOdeSessionUsedFiles(params);
        return odeSessionUsedFiles;
    }

    /**
     * Get an csv string from the json
     *
     * @param {*} objArray
     * @param {*} headerTitles
     * @returns {String}
     */
    json2Csv(objArray, headerTitles) {
        var array =
            typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        var str = '';
        var line = '';
        array.sort(function (a, b) {
            if (a.brokenLinksError < b.brokenLinksError) {
                return -1;
            }
            if (a.brokenLinksError > b.brokenLinksError) {
                return 1;
            }
            return 0;
        });
        for (var i = 0; i < 1; i++) {
            line = '';
            Object.keys(headerTitles).forEach((key) => {
                line +=
                    headerTitles[key] +
                    eXeLearning.app.api.parameters.csvItemSeparator;
            });
            line = line.slice(0, -1);
            str += line + '\r\n';
        }
        for (var i = 0; i < array.length; i++) {
            line = '';
            for (var index in array[i]) {
                if (array[i][index] == null) {
                    array[i][index] = 200;
                }
                line +=
                    array[i][index] +
                    eXeLearning.app.api.parameters.csvItemSeparator;
            }
            line = line.slice(0, -1);
            str += line + '\r\n';
        }
        return str;
    }

    /**
     * Export the ode as HTML5 and view it
     *
     */
    async previewEvent() {
        let toastData = {
            title: _('Preview'),
            body: _('Generating preview...'),
            icon: 'preview',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdePreviewUrl(odeSessionId);
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The preview has been generated.');
            setTimeout(() => {
                window.open(response['urlPreviewIndex']);
            }, 100);
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while generating the preview.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);
    }
}
