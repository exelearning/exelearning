export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        this.button = this.menu.navbar.querySelector('#dropdownFile');
        this.newButton = this.menu.navbar.querySelector('#navbar-button-new');
        this.saveButton = this.menu.navbar.querySelector('#navbar-button-save');
        this.saveButtonAs = this.menu.navbar.querySelector(
            '#navbar-button-save-as',
        );
        /*
        Temporally disabled:
        this.uploadGoogleDriveButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtodrive',
        );
        this.uploadDropboxButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtodropbox',
        );
        */
        this.uploadPlatformButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtoplatform',
        );
        this.openUserOdeFilesButton = this.menu.navbar.querySelector(
            '#navbar-button-openuserodefiles',
        );
        this.recentProjectsButton = this.menu.navbar.querySelector(
            '#navbar-button-dropdown-recent-projects',
        );
        this.downloadProjectButton = this.menu.navbar.querySelector(
            '#navbar-button-download-project',
        );
        this.exportHTML5Button = this.menu.navbar.querySelector(
            '#navbar-button-export-html5',
        );
        this.exportHTML5SPButton = this.menu.navbar.querySelector(
            '#navbar-button-export-html5-sp',
        );
        this.exportSCORM12Button = this.menu.navbar.querySelector(
            '#navbar-button-export-scorm12',
        );
        this.exportSCORM2004Button = this.menu.navbar.querySelector(
            '#navbar-button-export-scorm2004',
        );
        this.exportIMSButton = this.menu.navbar.querySelector(
            '#navbar-button-export-ims',
        );
        this.exportEPUB3Button = this.menu.navbar.querySelector(
            '#navbar-button-export-epub3',
        );
        this.exportXmlPropertiesButton = this.menu.navbar.querySelector(
            '#navbar-button-export-xml-properties',
        );
        this.importXmlPropertiesButton = this.menu.navbar.querySelector(
            '#navbar-button-import-xml-properties',
        );
        this.leftPanelsTogglerButton = this.menu.navbar.querySelector(
            '#exe-panels-toggler',
        );
    }

    /**
     *
     */
    setEvents() {
        this.setNewProjectEvent();
        this.setSaveProjectEvent();
        this.setSaveAsProjectEvent();
        /*
        Temporally disabled:
        this.setUploadGoogleDriveEvent();
        this.setUploadDropboxEvent();
        */
        this.setUploadPlatformEvent();
        this.setOpenUserOdeFilesEvent();
        this.setRecentProjectsEvent();
        this.setDownloadProjectEvent();
        this.setExportHTML5Event();
        this.setExportHTML5SPEvent();
        this.setExportSCORM12Event();
        this.setExportSCORM2004Event();
        this.setExportIMSEvent();
        this.setExportEPUB3Event();
        this.setExportXmlPropertiesEvent();
        this.setImportXmlPropertiesEvent();
        this.setLeftPanelsTogglerEvents();
    }

    /**************************************************************************************
     * LISTENERS
     **************************************************************************************/

    /**
     * New project
     * File -> New
     *
     */
    setNewProjectEvent() {
        this.newButton.addEventListener('click', () => {
            this.newProjectEvent();
        });
    }

    /**
     * Save project
     * File -> Save
     *
     */
    setSaveProjectEvent() {
        this.saveButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.saveOdeEvent();
        });
    }

    /**
     * Save as project
     * File -> Save as
     *
     */
    setSaveAsProjectEvent() {
        this.saveButtonAs.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.saveAsOdeEvent();
        });
    }

    /**
     * Upload ELP to Google Drive
     * File -> Upload to -> Google Drive
     *
     */
    /*
    Temporally disabled:
    setUploadGoogleDriveEvent() {
        this.uploadGoogleDriveButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.uploadToGoogleDriveEvent();
        });
    }
    */

    /**
     * Upload ELP to Google Drive
     * File -> Upload to -> Google Drive
     *
     */
    /*
    Temporally disabled:
    setUploadDropboxEvent() {
        this.uploadDropboxButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.uploadToDropboxEvent();
        });
    }
    */

    /**
     * Upload ELP to platform
     * File -> Upload to -> platform
     *
     */
    setUploadPlatformEvent() {
        if (this.uploadPlatformButton) {
            this.uploadPlatformButton.addEventListener('click', () => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.uploadPlatformEvent();
            });
        }
    }

    /**
     * Show list of elp files
     * File -> Open
     *
     */
    setOpenUserOdeFilesEvent() {
        this.openUserOdeFilesButton.addEventListener('click', () => {
            this.openUserOdeFilesEvent();
        });
    }

    /**
     * Show the 3 most recent elp
     * File -> Recent projects
     *
     */
    setRecentProjectsEvent() {
        this.recentProjectsButton.addEventListener('click', () => {
            this.showMostRecentProjectsEvent();
        });
    }

    /**
     * Download the project
     * File -> Download
     *
     */
    setDownloadProjectEvent() {
        this.downloadProjectButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return false;
            this.downloadProjectEvent();
            return false;
        });
    }

    /**
     * Download the project to HTML5
     * File -> Export as -> HTML5 (web site)
     *
     */
    setExportHTML5Event() {
        this.exportHTML5Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5Event();
        });
    }

    /**
     * Download the project to HTML5 Single Page
     * File -> Export as -> HTML5 (single page)
     *
     */
    setExportHTML5SPEvent() {
        this.exportHTML5SPButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5SPEvent();
        });
    }

    /**
     * Download the project to SCORM 1.2
     * File -> Export as -> SCORM 1.2
     *
     */
    setExportSCORM12Event() {
        this.exportSCORM12Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM12Event();
        });
    }

    /**
     * Download the project to SCORM 2004
     * File -> Export as -> SCORM 2004
     *
     */
    setExportSCORM2004Event() {
        this.exportSCORM2004Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM2004Event();
        });
    }

    /**
     * Download the project to IMS CP
     * File -> Export as -> IMS CP
     *
     */
    setExportIMSEvent() {
        this.exportIMSButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportIMSEvent();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> ePub3
     *
     */
    setExportEPUB3Event() {
        this.exportEPUB3Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportEPUB3Event();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> Xml properties
     *
     */
    setExportXmlPropertiesEvent() {
        this.exportXmlPropertiesButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportXmlPropertiesEvent();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> Xml properties
     *
     */
    setImportXmlPropertiesEvent() {
        this.importXmlPropertiesButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.importXmlPropertiesEvent();
        });
    }

    /**
     * Hide/Show the left panels (left column)
     *
     */
    setLeftPanelsTogglerEvents() {
        // See eXeLearning.app.common.initTooltips
        $(this.leftPanelsTogglerButton)
            .attr('data-bs-placement', 'bottom')
            .tooltip()
            .on('click', function () {
                $(this).tooltip('hide');
                $('body').toggleClass('left-column-hidden');
            });
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Creates a new session
     *
     */
    newProjectEvent() {
        let odeSessionId = eXeLearning.app.project.odeSession;
        this.newSession(odeSessionId);
    }

    /**
     * newSession
     *
     * @param {*} odeSessionId
     */
    async newSession(odeSessionId) {
        let params = { odeSessionId: odeSessionId };
        let data = {
            title: _('New file'),
            forceOpen: _('Create new file without saving'),
            newFile: true,
        };

        eXeLearning.app.api
            .postCheckCurrentOdeUsers(params)
            .then((response) => {
                if (response['leaveEmptySession']) {
                    this.createSession(params);
                } else {
                    eXeLearning.app.modals.sessionlogout.show(data);
                }
            });
    }

    /**
     * createSession
     *
     */
    async createSession(params) {
        await eXeLearning.app.api.postCloseSession(params).then((response) => {
            if (response.responseMessage == 'OK') {
                // Reload project
                eXeLearning.app.project.loadCurrentProject();
                eXeLearning.app.project.openLoad();
            }
        });
    }

    /**
     * Save ode in ELP file
     *
     */
    saveOdeEvent() {
        eXeLearning.app.project.save();
    }

    /**
     * Save as ode in ELP file
     *
     */
    saveAsOdeEvent() {
        let odeSessionId = eXeLearning.app.project.odeSession;
        let odeVersionId = eXeLearning.app.project.odeVersion;
        let odeId = eXeLearning.app.project.odeId;
        let params = {
            odeSessionId: odeSessionId,
            odeVersionId: odeVersionId,
            odeId: odeId,
        };
        this.currentOdeUsers(params);
    }

    /**
     * Save as project
     *
     */
    async saveAs(title) {
        let data = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
            title: title,
        };
        // Show message
        let toastData = {
            title: _('Save'),
            body: _('Saving the project...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        // Save
        let response = await eXeLearning.app.api.postOdeSaveAs(data);
        if (response && response.responseMessage == 'OK') {
            eXeLearning.app.project.odeId = response.odeId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeSession = response.newSessionId;
            await eXeLearning.app.project.openLoad();
            eXeLearning.app.project.showModalSaveOk(response);
            eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
            toast.toastBody.innerHTML = _('Project saved.');
        } else {
            eXeLearning.app.project.showModalSaveError(response);
            toast.toastBody.innerHTML = _(
                'An error occurred while saving the project.',
            );
            toast.toastBody.classList.add('error');
        }
        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);
    }

    /**
     *
     */
    makeConfirmTitleInputModal() {
        let body = this.makeBodyElementPropertiesTiltleName();
        eXeLearning.app.modals.confirm.show({
            title: _('Save project'),
            body: body.innerHTML,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            focusFirstInputText: true,
            confirmExec: () => {
                let modalInputText = document.querySelector(
                    '.modal-confirm .properties-title-input',
                );
                let modalInputTextValue = modalInputText.value;
                this.saveAs(modalInputTextValue);
            },
        });
    }

    /**
     *
     * @returns
     */
    makeBodyElementPropertiesTiltleName() {
        let element = document.createElement('div');
        element.classList.add('properties-title-div');
        element.append(this.makeDivContentPropertiesTiltleName());
        return element;
    }

    /**
     *
     * @returns
     */
    makeDivContentPropertiesTiltleName() {
        let element = document.createElement('div');
        let p = document.createElement('p');
        let inputText = document.createElement('input');

        element.classList.add('properties-title-content-div');

        p.classList.add('properties-title-notice');
        p.innerHTML = _('Please enter the project title:');

        inputText.classList.add('properties-title-input');
        inputText.setAttribute('type', 'text');

        element.append(p);
        element.append(inputText);

        return element;
    }

    /**
     * It connects with the google api to show a modal with the google drive directories
     *  where the project can be uploaded
     *
     */
    uploadToGoogleDriveEvent() {
        // Get Google Drive folders
        this.getFoldersGoogleDrive().then((response) => {
            if (!response.error) {
                // Show eXe Google Drive modal
                eXeLearning.app.modals.uploadtodrive.show(response.files);
            } else {
                if (eXeLearning.app.actions.authorizeAddActions) {
                    // Open window Google Drive login in popup
                    this.openWindowLoginGoogleDrive();
                } else {
                    // Open eXe alert modal
                    eXeLearning.app.modals.alert.show({
                        title: _('Google Drive error'),
                        body: response.error,
                        contentId: 'error',
                    });
                }
            }
        });
    }

    /**
     * uploadToGoogleDriveEvent
     * Get the directories that the user has in google drive
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        let foldersInfo = await eXeLearning.app.api.getFoldersGoogleDrive();
        if (foldersInfo) {
            if (foldersInfo.folders && foldersInfo.folders.files) {
                return { error: false, files: foldersInfo.folders };
            } else {
                return { error: foldersInfo, files: [] };
            }
        } else {
            return { error: _('Unknown'), files: [] };
        }
    }

    /**
     * uploadToGoogleDriveEvent
     * Get login url from google drive and open it in a popup
     *
     */
    async openWindowLoginGoogleDrive() {
        let urlGoogleDrive = await eXeLearning.app.api.getUrlLoginGoogleDrive();
        let windowLoginGoogleDrive = window.open(
            urlGoogleDrive.url,
            'drive',
            'location=1,status=1,scrollbars=1,width=600,height=500,top=250, left=720, menubar=0, toolbar=0,resizable=0',
        );
    }

    /**
     * It connects with the dropbox api to show a modal with the dropbox directories
     *  where the project can be uploaded
     *
     */
    uploadToDropboxEvent() {
        // Get Dropbox folders
        this.getFoldersDropbox().then((response) => {
            if (!response.error) {
                // Show eXe Dropbox modal
                eXeLearning.app.modals.uploadtodropbox.show(response.files);
            } else {
                if (eXeLearning.app.actions.authorizeAddActions) {
                    // Open window Dropbox login in popup
                    this.openWindowLoginDropbox();
                } else {
                    // Open eXe alert modal
                    eXeLearning.app.modals.alert.show({
                        title: _('Dropbox error'),
                        body: response.error,
                        contentId: 'error',
                    });
                }
            }
        });
    }

    /**
     * uploadToDropboxEvent
     * Get the directories that the user has in dropbox
     *
     * @returns
     */
    async getFoldersDropbox() {
        let foldersInfo = await eXeLearning.app.api.getFoldersDropbox();
        if (foldersInfo) {
            if (foldersInfo.folders && foldersInfo.folders.files) {
                return { error: false, files: foldersInfo.folders };
            } else {
                return { error: foldersInfo, files: [] };
            }
        } else {
            return { error: _('Unknown'), files: [] };
        }
    }

    /**
     * uploadToDropboxEvent
     * Get login url from dropbox and open it in a popup
     *
     */
    async openWindowLoginDropbox() {
        let urlDropbox = await eXeLearning.app.api.getUrlLoginDropbox();
        let windowLoginDropbox = window.open(
            urlDropbox.url,
            'dropbox',
            'location=1,status=1,scrollbars=1,width=600,height=500,top=250, left=720, menubar=0, toolbar=0,resizable=0',
        );
    }

    /**
     * Save ode and send to platform
     *
     */
    async uploadPlatformEvent() {
        const urlParams = new URLSearchParams(window.location.search);
        let jwt_token = urlParams.get('jwt_token');

        let data = {
            odeSessionId: eXeLearning.app.project.odeSession,
            platformUrlSet: eXeLearning.config.platformUrlSet,
            jwt_token: jwt_token,
        };
        // Save
        let response;

        response =
            await eXeLearning.app.api.postFirstTypePlatformIntegrationElpUpload(
                data,
            );

        if (response.responseMessage == 'OK') {
            window.onbeforeunload = null;
            window.location.replace(response.returnUrl);
        } else {
            eXe.app.alert(_(response.responseMessage));
        }
    }

    /**
     *
     * @returns
     */
    createIdevicesUploadInput() {
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-ode-file-upload');
        inputUpload.setAttribute('accept', '.elp');
        inputUpload.classList.add('d-none');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-ode-file-upload-input',
            );
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(odeFile);
        });
        this.menu.navbar.append(inputUpload);
        return inputUpload;
    }

    /**
     * Show list of elp on perm
     *
     */
    openUserOdeFilesEvent() {
        if (
            eXeLearning.config.isOfflineInstallation === true &&
            eXeLearning.app.user.versionControl == 'inactive'
        ) {
            this.createIdevicesUploadInput();
            this.menu.navbar
                .querySelector('input.local-ode-file-upload-input')
                .click();
        } else {
            // Get ode files
            this.getOdeFilesListEvent().then((response) => {
                eXeLearning.app.modals.openuserodefiles.show(response);
            });
        }
    }

    /**
     * getOdeFilesList
     * Get the ode files saved by the user
     *
     * @returns
     */
    async getOdeFilesListEvent() {
        let odeFilesList = await eXeLearning.app.api.getUserOdeFiles();
        return odeFilesList;
    }

    /**
     * showMostRecentProjectsEvent
     *
     */
    showMostRecentProjectsEvent() {
        let recentProjectsDropdownList = this.menu.navbar.querySelector(
            '#navbar-dropdown-menu-recent-projects',
        );
        eXeLearning.app.api.getRecentUserOdeFiles().then((response) => {
            let recentProjectsList = this.makeRecentProjecList(response);
            recentProjectsDropdownList.innerHTML = '';
            recentProjectsDropdownList.append(recentProjectsList);
        });
    }

    /**
     *
     * @param {*} odeFiles
     * @returns
     */
    makeRecentProjecList(odeFiles) {
        let recentProjectsLi = document.createElement('li');
        if (odeFiles.length > 0) {
            odeFiles.forEach((odeFile) => {
                let recentProjectLink = document.createElement('a');

                recentProjectLink.classList.add('dropdown-item');
                recentProjectLink.setAttribute('href', '#');

                recentProjectLink.addEventListener('click', () => {
                    let odeSessionId = eXeLearning.app.project.odeSession;
                    let odeVersionId = eXeLearning.app.project.odeVersion;
                    let odeId = eXeLearning.app.project.odeId;

                    let params = {
                        odeSessionId: odeSessionId,
                        odeVersionId: odeVersionId,
                        odeId: odeId,
                    };

                    eXeLearning.app.api
                        .postCheckCurrentOdeUsers(params)
                        .then((response) => {
                            if (response['leaveEmptySession']) {
                                eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession(
                                    odeFile.fileName,
                                );
                            } else {
                                let data = {
                                    title: _('Open project'),
                                    forceOpen: _('Open without saving'),
                                    openOdeFile: true,
                                    id: odeFile.fileName,
                                };
                                eXeLearning.app.modals.sessionlogout.show(data);
                            }
                        });
                });

                recentProjectLink.innerHTML = odeFile.title;
                recentProjectsLi.append(recentProjectLink);
            });
        } else {
            let recentProjectLink = document.createElement('a');
            recentProjectLink.classList.add('dropdown-item');
            recentProjectLink.innerHTML = _('No recent projects...');
            recentProjectsLi.append(recentProjectLink);
        }

        return recentProjectsLi;
    }

    /**
     * Download project ELP
     *
     */
    async downloadProjectEvent() {
        let toastData = {
            title: _('Download'),
            body: _('File generation in progress.'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'elp',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('File generated.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while generating the file.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as HTML5 and download it
     *
     */
    async exportHTML5Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as HTML5 and download it
     *
     */
    async exportHTML5SPEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5-sp',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM12Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm12',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM2004Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm2004',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as IMS CP and download it
     *
     */
    async exportIMSEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'ims',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as ePub3 and download it
     *
     */
    async exportEPUB3Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'epub3',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the properties as xml and download it
     *
     */
    async exportXmlPropertiesEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'properties',
        );
        if (response['responseMessage'] == 'OK') {
            this.downloadLink(
                response['urlZipFile'],
                response['exportProjectName'],
            );
            toast.toastBody.innerHTML = _(
                'The project properties have been exported.',
            );
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.',
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

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     *
     * @returns
     */
    createPropertiesUploadInput() {
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-xml-properties-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-xml-properties-upload');
        inputUpload.setAttribute('accept', '.xml');
        inputUpload.classList.add('hidden');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-xml-properties-upload-input',
            );
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createPropertiesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                odeFile,
                false,
                true,
            );
        });
        this.menu.navbar.append(inputUpload);
        return inputUpload;
    }

    /**
     * Export the properties as xml and download it
     *
     */
    async importXmlPropertiesEvent() {
        this.createPropertiesUploadInput();
        this.menu.navbar
            .querySelector('.local-xml-properties-upload-input')
            .click();
    }

    /**
     * Helper function to download the content of a link
     *
     * @param {*} $url
     * @param {*} $name
     */
    downloadLink($url, $name) {
        eXeLearning.app.api
            .getFileResourcesForceDownload($url)
            .then((response) => {
                let downloadLink = document.createElement('a');
                downloadLink.href = response.url;
                downloadLink.download = $name;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            });
    }

    /**
     * currentOdeUsers
     *
     */
    async currentOdeUsers(params) {
        let response = await eXeLearning.app.api.getOdeConcurrentUsers(
            params.odeId,
            params.odeVersionId,
            params.odeSessionId,
        );
        let numberOfCurrentUsers = response.currentUsers.length;
        if (numberOfCurrentUsers == 1) {
            this.makeConfirmTitleInputModal();
        } else {
            let response = { responseMessage: _('Other users are connected.') };
            eXeLearning.app.project.showModalSaveError(response);
        }
    }
}
