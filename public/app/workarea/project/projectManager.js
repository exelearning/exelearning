import ProjectProperties from './properties/projectProperties.js';
import IdevicesEngine from './idevices/idevicesEngine.js';
import StructureEngine from './structure/structureEngine.js';
import RealTimeEventNotifier from '../../RealTimeEventNotifier/RealTimeEventNotifier.js';

export default class projectManager {
    constructor(app) {
        this.app = app;
        this.properties = new ProjectProperties(this);
        this.idevices = new IdevicesEngine(this);
        this.structure = new StructureEngine(this);
        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;
        this.clientIntervalUpdate = eXeLearning.config.clientIntervalUpdate;
        this.syncIntervalTime = 250;
        if (!this.offlineInstallation) {
            this.realTimeEventNotifier = new RealTimeEventNotifier(
                this.app.eXeLearning.mercure.url,
                this.app.eXeLearning.mercure.jwtSecretKey,
            );
            this.eventSource;
        }
    }

    /**
     *
     */
    async load() {
        console.log('public/app/workarea/project/projectManager.js: load');
        // Api params
        await this.loadCurrentProject();
        // Load project properties
        await this.loadProjectProperties();
        this.app.locale.loadContentTranslationsStrings(
            this.properties.properties.pp_lang.value,
        );
        // Compose and initialized interface
        await this.loadInterface();
        // Load structure data
        await this.loadStructureData();
        // Initialized menus
        await this.loadMenus();
        // Load modals content
        await this.loadModalsContent();
        // Behaviour of idevices in menu and content
        this.ideviceEngineBehaviour();
        // Legacy idevice functions
        this.compatibilityLegacy();
        // Inicialize
        await this.initialiceProject();
        // Show workarea of app
        this.showScreen();
        // Call the function to execute sorting and reordering
        this.sortBlocksById(true);
        // Set offline atributtes
        this.setInstallationTypeAttribute();
        // Run autosave
        this.generateIntervalAutosave();
        // Run check ode updates
        //this.generateIntervalCheckOdeUpdates();
        //Remove previous autosaves
        this.cleanPreviousAutosaves();

        if (!this.offlineInstallation) {
            await this.subscribeToSessionAndNotify();
        }
    }

    /**
     *
     */
    async openLoad() {
        console.log('public/app/workarea/project/projectManager.js:openLoad');
        // Close window open elp in case of new elp
        eXeLearning.app.modals.openuserodefiles.close();
        // Load user data
        await this.loadUser();
        // Show loading screen
        this.app.interface.loadingScreen.show();
        // Load project properties
        await this.loadProjectProperties();
        // Load structure data
        await this.loadStructureData();
        // Load title
        this.app.interface.odeTitleElement.setTitle();
        // Initialized menus
        this.properties.formProperties.remove();
        this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = false;
        await this.structure.reloadStructureMenu();
        // Load modals content
        await this.loadModalsContent();
        // Inicialize
        await this.initialiceProject();
        // Show workarea of app
        this.showScreen();
        // Set offline atributtes
        this.setInstallationTypeAttribute();
        // Run autosave
        this.generateIntervalAutosave(true);

        if (!this.offlineInstallation) {
            await this.subscribeToSessionAndNotify();
        }
    }

    /**
     *
     * @param {*} pageid
     */
    async updateUserPage(pageid) {
        // Get page position
        let scroll = document.querySelector('.template-page');
        let scrollPos;
        if (scroll !== null) {
            scrollPos = document.querySelector('.template-page').scrollTop;
        } else {
            scrollPos = document.querySelector(
                '#node-content-container',
            ).scrollTop;
        }
        // Load structure data
        await this.loadStructureData();
        // Load modals content
        await this.loadModalsContent();
        this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = false;
        await this.structure.reloadStructureMenu(pageid);
        await this.initialiceProject();
        // Move to page location
        if (scroll !== null) {
            document.querySelector('.template-page').scrollTo(0, scrollPos);
        } else {
            document
                .querySelector('#node-content-container')
                .scrollTo(0, scrollPos);
        }
    }

    async subscribeToSessionAndNotify() {
        // It's very important to close if the connection is not longer needed.
        // Opened connections have a continuous buffer that will drain your application resources.
        if (this.eventSource != null) {
            this.eventSource.close();
        }

        // Subscription to the session messages odeSession.
        // Here it checks any message receive and send a local event in order to be
        // managed by whatever file it need to respond to.
        this.eventSource = this.realTimeEventNotifier.getSubscription(
            this.odeSession,
        );

        this.eventSource.onmessage = (event) => {
            let message = JSON.parse(event.data);

            // // TO-DO: Here we can control messages passed
            // switch (message.name) {
            //     case 'test-message':

            //         break;
            // }

            let localEvent;
            console.log('Received message from mercure: ', message);

            if (event.lastEventId !== undefined) {
                this.realTimeEventNotifier.setLastEventID(event.lastEventId);
            }

            // Server-Sent Event is translated to a local event. This way the SSE subscription is
            // made in one only place when app starts.
            localEvent = new CustomEvent(message.name, {
                detail: { user: message.payload },
            });
            window.dispatchEvent(localEvent);
        };

        // A new `new-user-editing` message is sent to notify that there is a new user editing
        this.realTimeEventNotifier.notify(this.odeSession, {
            name: 'new-user-editing',
            payload: this.app.user.name,
        });

        // Update resource
        window.addEventListener('new-content-published', (e) => {
            let pageId = this.structure.getSelectNodeNavId();
            setTimeout(() => {
                this.checkUserUpdateFlag(pageId);
            }, 500);
        });

        // Update structure.
        window.addEventListener('structure-changed', (e) => {
            this.reloadStructure();
        });
    }

    async reloadStructure() {
        let nodeId = this.structure.getSelectNodeNavId();
        let pageId = await this.structure.resetDataAndStructureData(nodeId);
        return await this.checkUserUpdateFlag(pageId);
    }

    /**
     *
     */
    async loadCurrentProject() {
        // TODO: Projects are loaded multiple times depending on whether you are logged in,
        // whether it comes from the Modole integration,.... This happens between this method
        // and loadPlatformProject
        console.log(
            'public/app/workarea/project/projectManager.js:loadCurrentProject',
        );
        let response = await this.app.api.getCurrentProject();
        if (response && response.responseMessage == 'OK') {
            this.odeId = response.currentOdeUsers.odeId;
            this.odeVersion = response.currentOdeUsers.odeVersionId;
            // Get odeSession for open elp platform
            let odeSessionId = response.currentOdeUsers.odeSessionId;

            // Case join the shared session
            if (eXeLearning.symfony.odeSessionId) {
                // Check odeSessionId and set on bbdd
                let params = { odeSessionId: eXeLearning.symfony.odeSessionId };
                let response =
                    await this.app.api.postJoinCurrentOdeSessionId(params);
                if (response.responseMessage == 'OK') {
                    this.odeSession = eXeLearning.symfony.odeSessionId;
                    window.location.replace('workarea');
                }
            } else if (eXeLearning.user.odePlatformId) {
                this.loadPlatformProject(odeSessionId);
            } else if (eXeLearning.user.newOde) {
                this.newSession(odeSessionId);
                const urlParams = new URLSearchParams(window.location.search);
                let jwtToken = urlParams.get('jwt_token');
                window.location.replace('workarea' + '?jwt_token=' + jwtToken);
            }
            this.odeSession = response.currentOdeUsers.odeSessionId;
            if (response.isNewSession) {
                this.isSaveAs = true;
            }
        }
    }

    /**
     * Open elp from platform
     *
     * @param {*} odeSessionId
     */
    async loadPlatformProject(odeSessionId) {
        // Check odeSessionId and set on bbdd
        let odePlatformId = eXeLearning.user.odePlatformId;

        const urlParams = new URLSearchParams(window.location.search);
        let jwtToken = urlParams.get('jwt_token');
        let params = {
            odePlatformId,
            odeSessionId: odeSessionId,
            platformUrlGet: eXeLearning.config.platformUrlGet,
            jwt_token: jwtToken,
        };
        let response;

        response = await this.app.api.platformIntegrationOpenElp(params);

        if (response.responseMessage == 'OK') {
            let params = {
                odeFileName: response.elpFileName,
                odeFilePath: response.elpFilePath,
                forceCloseOdeUserPreviousSession:
                    response.forceCloseOdeUserPreviousSession,
            };
            response = await this.app.api.postLocalOdeFile(params);
            if (response.responseMessage == 'OK') {
                this.app.project.odeSession = response.odeSessionId;
                this.app.project.odeVersion = response.odeVersionId;
                this.app.project.odeId = response.odeId;
                // Load project
                this.odeSession = response.odeSessionId;
                window.location.replace('workarea' + '?jwt_token=' + jwtToken);
            }
        }
    }

    /**
     * newSession
     *
     * @param {*} odeSessionId
     */
    async newSession(odeSessionId) {
        let params = { odeSessionId: odeSessionId };
        this.createSession(params);
    }

    /**
     * createSession
     *
     */
    async createSession(params) {
        await this.app.api.postCloseSession(params).then((response) => {
            if (response.responseMessage == 'OK') {
                // Reload project
                this.app.project.loadCurrentProject();
                this.app.project.openLoad();
            }
        });
    }

    /**
     *
     */
    async loadProjectProperties() {
        await this.properties.load();
    }

    /**
     *
     */
    async loadInterface() {
        await this.app.interface.load();
    }

    /**
     *
     */
    async loadUser() {
        await this.app.user.loadUserPreferences();
    }

    /**
     *
     */
    async loadStructureData() {
        // Reset list of idevices and blocks
        this.idevices.components = { blocks: [], idevices: [] };
        // Load structure data
        await this.structure.loadData();
    }

    /**
     *
     */
    async loadMenus() {
        await this.app.menus.load();
    }

    /**
     *
     */
    async loadModalsContent() {
        // Release notes
        await this.app.modals.releasenotes.load();
        // Third party code information and licenses
        await this.app.modals.legalnotes.load();
    }

    /**
     *
     */
    async ideviceEngineBehaviour() {
        this.idevices.behaviour();
    }

    /**
     * To maintain compatibility with eXe Legacy
     *
     */
    async compatibilityLegacy() {
        // eXe
        window.eXe = {};
        window.eXe.app = {};
        // Inside eXe app
        window.eXe.app.isInExe = () => {
            return true;
        };
        // Project properties
        window.eXe.app.getProjectProperties = () => {
            return this.properties.properties;
        };
        // Idevice with editing active
        window.eXe.app.getIdeviceActive = () =>
            this.idevices.getIdeviceActive();
        // Idevice by id
        window.eXe.app.getIdeviceById = (id) =>
            this.idevices.getIdeviceById(id);
        // Get idevice installed by name
        window.eXe.app.getIdeviceInstalled = (name) =>
            this.app.idevices.getIdeviceInstalled(name);
        // Get idevice installed edition path
        window.eXe.app.getIdeviceInstalledEditionPath = (name) =>
            this.app.idevices.getIdeviceInstalledEditionPath(name);
        // Get idevice installed export path
        window.eXe.app.getIdeviceInstalledExportPath = (name) =>
            this.app.idevices.getIdeviceInstalledExportPath(name);
        // Alert modal used in idevices
        window.eXe.app.alert = (body, t) =>
            this.app.modals.alert.show({
                body: body,
                title: t ? t : _('Alert'),
            });
        // Confirm modal used in idevices
        window.eXe.app.confirm = (t, b, ce) =>
            this.app.modals.confirm.show({
                title: t,
                body: b,
                confirmExec: ce,
            });
        // Load JS or CSS file
        window.eXe.app.loadScript = (url, callback) =>
            this.idevices.loadScript(url, callback);
        // Idevice active -> Upload file (base64)
        window.eXe.app.uploadFile = (base64, name) =>
            this.idevices.ideviceActive.apiUploadFile(base64, name);
        // Idevice active -> Upload file (form data with values: file, filename, odeSessionId)
        window.eXe.app.uploadLargeFile = (formData) =>
            this.idevices.ideviceActive.apiUploadLargeFile(formData);
    }

    /**
     * Select node and theme
     *
     */
    async initialiceProject() {
        // Select theme
        let theme = eXeLearning.config.defaultTheme;
        if (this.app.user.preferences.preferences.theme) {
            theme = this.app.user.preferences.preferences.theme.value;
        }
        await this.app.themes.selectTheme(theme, false);
        // Select node and load idevices in page
        await this.lastNodeSelected();
    }

    /**
     * Get last node selected
     *
     */
    async lastNodeSelected() {
        // Select last node selected and load
        let element = null;
        let response = await this.app.api.getCurrentProject();
        if (response && response.responseMessage == 'OK') {
            let pageIdElement = response.currentOdeUsers.currentPageId;
            element = this.app.menus.menuEngine.menuNav.querySelector(
                `[page-id='${pageIdElement}']`,
            );
            if (element) {
                await this.app.menus.menuStructure.menuStructureBehaviour.selectNode(
                    element,
                );
            } else {
                await this.app.selectFirstNodeStructure();
            }
        } else {
            await this.app.selectFirstNodeStructure();
        }
    }

    /**
     * Hide workarea loading screen
     *
     */
    async showScreen() {
        setTimeout(() => {
            this.app.interface.loadingScreen.hide();
        }, 250);
    }

    /**
     * Set installation type attribute to body and elements
     *
     */
    setInstallationTypeAttribute() {
        if (this.offlineInstallation == true) {
            document
                .querySelector('body')
                .setAttribute('installation-type', 'offline');
            /* To review (see #432)
            document.querySelector(
                '#navbar-button-download-project',
            ).innerHTML = 'Save';
            */
            document.querySelector('#head-top-download-button').innerHTML =
                'save';
            document
                .querySelector('#head-top-download-button')
                .setAttribute('title', 'Save');
        } else {
            document
                .querySelector('body')
                .setAttribute('installation-type', 'online');
        }
    }

    /**
     * Save project
     *
     */
    async save() {
        if (eXeLearning.config.isOfflineInstallation) {
            // To do (offline version save action #432)
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            // Show message
            let toastData = {
                title: _('Save'),
                body: _('Saving the project...'),
                icon: 'downloading',
            };
            let toast = this.app.toasts.createToast(toastData);
            // Save
            let response = await this.app.api.postOdeSave(data);
            if (response && response.responseMessage == 'OK') {
                if (!this.offlineInstallation) {
                    this.realTimeEventNotifier.notify(this.odeSession, {
                        name: 'new-content-published',
                    });
                }

                this.app.interface.connectionTime.loadLasUpdatedInInterface();
                toast.toastBody.innerHTML = _('Project saved.');
            } else {
                this.showModalSaveError(response);
                toast.toastBody.innerHTML = _(
                    'An error occurred while saving the project.',
                );
                toast.toastBody.classList.add('error');
            }
            // Remove message
            setTimeout(() => {
                toast.remove();
            }, 1000);
        } else {
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            // Show message
            let toastData = {
                title: _('Save'),
                body: _('Saving the project...'),
                icon: 'downloading',
            };
            let toast = this.app.toasts.createToast(toastData);
            // Save
            let response = await this.app.api.postOdeSave(data);
            if (response && response.responseMessage == 'OK') {
                if (!this.offlineInstallation) {
                    this.realTimeEventNotifier.notify(this.odeSession, {
                        name: 'new-content-published',
                    });
                }

                this.app.interface.connectionTime.loadLasUpdatedInInterface();
                toast.toastBody.innerHTML = _('Project saved.');
            } else {
                this.showModalSaveError(response);
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
    }

    /**
     * Show modal project save ok
     *
     */
    showModalSaveOk(data) {
        this.app.modals.alert.show({
            title: _('Saved'),
            body: _('The project has been saved.'),
        });
    }

    /**
     * Show modal project save error
     *
     * @param {*} data
     */
    showModalSaveError(data) {
        let errorTextMessage = _(
            'Error while saving: ${response.responseMessage}',
        );
        errorTextMessage = errorTextMessage.replace(
            '${response.responseMessage}',
            data.responseMessage,
        );
        this.app.modals.alert.show({
            title: _('Error'),
            body: _(errorTextMessage),
            contentId: 'error',
        });
    }

    /**
     *
     * @param {*} removePrev
     */
    async generateIntervalAutosave(removePrev) {
        if (this.app.api.parameters.autosaveOdeFilesFunction) {
            if (removePrev) clearInterval(this.intervalSaveOde);
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            this.intervalSaveOde = setInterval(() => {
                this.app.api.postOdeAutosave(data);
            }, this.app.api.parameters.autosaveIntervalTime * 1000);
        }
    }

    /**
     *
     * @param {*} removePrev
     */
    async generateIntervalSessionExpiration(removePrev) {
        if (this.app.api.parameters.autosaveOdeFilesFunction) {
            if (removePrev) clearInterval(this.intervalSaveOde);
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            this.intervalSaveOde = setInterval(() => {
                this.app.api.renewSession();
            }, 10000);
        }
    }

    /*********************************************************************************************/
    /*  SYNCHRONIZATION (UPDATE CURRENT USERS CHANGES)
    /*********************************************************************************************/

    /**
     *
     */
    async generateIntervalCheckOdeUpdates() {
        // Check online version
        if (this.offlineInstallation !== true) {
            setInterval(() => {
                // Params
                let odeId = this.odeId;
                let odeVersion = this.odeVersion;
                let odeSession = this.odeSession;
                let isCheckUpdate = true;
                let elementsPage = document.querySelectorAll(
                    '.idevice-element-in-content',
                );
                let elementsDragging = document.querySelectorAll('.dragging');
                let pageId = this.structure.getSelectNodeNavId();
                // Check users in session
                isCheckUpdate = this.checkUsersInSession(
                    odeId,
                    odeVersion,
                    odeSession,
                    isCheckUpdate,
                );
                // Check if any element is in mode edition
                isCheckUpdate = this.checkModeEdition(
                    elementsPage,
                    isCheckUpdate,
                );
                // Check if any element is dragging
                isCheckUpdate = this.checkDraggingElement(
                    elementsDragging,
                    isCheckUpdate,
                );
                if (isCheckUpdate) {
                    // Check if the user has an update and action type
                    this.checkUserUpdateFlag(pageId);
                }
            }, this.clientIntervalUpdate);
        }
    }

    /**
     *
     * @param {*} newOdeComponentSync
     */
    async replaceOdeComponent(newOdeComponentSync, isUndoMoveTo = false) {
        let cloneIdeviceNode, blockContent, oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(
            newOdeComponentSync.odeIdeviceId,
        );
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(newOdeComponentSync.blockId);

        if (blockNode) {
            blockContent = blockNode.blockContent;
            newOdeComponentSync.isSync = true;
            newOdeComponentSync.mode = 'export';
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                newOdeComponentSync,
                blockContent,
                elementOnModeEdition,
            );
        } else {
            let odeNavStructureSyncId = document
                .querySelector('.nav-element .selected')
                .getAttribute('nav-id');
            let workareaElement = document.querySelector('#main #workarea');
            let nodeContainerElement = workareaElement.querySelector(
                '#node-content-container',
            );
            let nodeContentElement =
                nodeContainerElement.querySelector('#node-content');

            newOdeComponentSync.isSync = true;
            newOdeComponentSync.mode = 'export';
            // Create new idevice
            let newIdevice = await this.idevices.createIdeviceInContent(
                newOdeComponentSync,
                nodeContentElement,
                elementOnModeEdition,
            );
            newIdevice.odeNavStructureSyncId = odeNavStructureSyncId;
        }

        if (oldOdeComponent || isUndoMoveTo) {
            if (isUndoMoveTo) {
                blockContent.insertBefore(
                    cloneIdeviceNode.ideviceContent,
                    blockContent.children[cloneIdeviceNode.order],
                );
            } else {
                blockContent.insertBefore(
                    cloneIdeviceNode.ideviceContent,
                    oldOdeComponentSibling,
                );
            }
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} odeId
     * @param {*} odeVersion
     * @param {*} odeSession
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkUsersInSession(odeId, odeVersion, odeSession, isCheckUpdate) {
        this.app.api
            .getOdeConcurrentUsers(odeId, odeVersion, odeSession)
            .then((response) => {
                let currentUsers = response.currentUsers;
                if (!currentUsers || currentUsers.length <= 1) {
                    isCheckUpdate = false;
                }
            });
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} elementsPage
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkModeEdition(elementsPage, isCheckUpdate) {
        elementsPage.forEach((elementPage) => {
            let elementPageMode = elementPage.getAttribute('mode');
            if (elementPageMode == 'edition') {
                isCheckUpdate = false;
            }
        });
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} elementsDragging
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkDraggingElement(elementsDragging, isCheckUpdate) {
        if (elementsDragging.length > 0) {
            isCheckUpdate = false;
        }
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} response
     */
    async updateEditedElement(response) {
        if (response.odeComponentSyncId) {
            // Update idevice
            this.replaceOdeComponent(response.odeComponentSync);
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
            }
        } else if (response.odeBlockId) {
            // Update block
            this.replaceOdeBlock(response.odeBlockSync);

            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
            }
        } else {
            // Update page
            this.replaceOdePage(response.odePageSync);
            // Apply page title from properties if same page
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            if (selectedOdePageId == response.odePageSync.pageId) {
                eXeLearning.app.project.idevices.setNodeContentPageTitle(
                    response.odePageSync.odeNavStructureSyncProperties,
                );
            }
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateDeletedElement(response) {
        if (response.odeComponentSyncId) {
            // Delete idevice
            this.deleteOdeComponent(response.odeComponentSyncId);
        } else if (response.odeBlockId) {
            // Delete block
            this.deleteOdeBlock(response.odeBlockId);
        } else {
            // Delete page
            this.deleteOdePage(response.odePageId);
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateAddedElement(response) {
        if (response.odeComponentSyncId) {
            // Add idevice
            this.addOdeComponent(response.odeComponentSync);
        } else if (response.odeBlockSync) {
            // Add block
            this.addOdeBlock(response.odeBlockSync);
        } else {
            // Add Page
            this.addOdePage(response.odePageSync);
            // Force reload structure
            this.reloadStructure();
        }
    }

    /**
     *
     */
    async updateOrderNavMap(syncChange) {
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData(
            navId,
        );

        // Sync theme if neccesary
        let userTheme =
            eXeLearning.app.user.preferences.preferences.theme.value;
        if (userTheme !== syncChange.styleThemeValueId) {
            this.app.modals.confirm.show({
                title: _('Style changed'),
                body: _(
                    'Your style has changed. Reload the page to apply changes?',
                ),
                confirmButtonText: _('Yes'),
                confirmExec: () => {
                    eXeLearning.app.themes.selectTheme(
                        syncChange.styleThemeValueId,
                        true,
                    );
                },
            });
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateMovedElement(response) {
        if (response.odeComponentSyncId) {
            // Move idevice
            this.moveOdeComponent(response.odeComponentSync);
        } else {
            // Move block
            this.moveOdeBlock(response.odeBlockSync);
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} response
     */
    async updateMovedElementOnSamePage(response) {
        if (response.odeComponentSyncId) {
            // Move idevice
            this.moveOdeComponentOnSamePage(response.odeComponentSync);
        } else {
            // Move block
            this.moveOdeBlockOnSamePage(response.odeBlockSync);
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} pageId
     */
    async checkUserUpdateFlag(pageId) {
        // Check if the user has an update
        this.app.api.postCheckUserOdeUpdates().then((response) => {
            if (response.responseMessage == 'OK') {
                for (let syncChange of response.syncChanges) {
                    setTimeout(() => {
                        if (syncChange.actionType == 'EDIT') {
                            // Update page, idevice or block
                            setTimeout(() => {
                                this.updateEditedElement(syncChange);
                            }, this.syncIntervalTime);
                        } else if (syncChange.actionType == 'DELETE') {
                            // Delete page, idevice or block
                            this.updateDeletedElement(syncChange);
                        } else if (syncChange.actionType == 'ADD') {
                            // Add page, idevice or block
                            this.updateAddedElement(syncChange);
                        } else if (syncChange.actionType == 'RELOAD_NAV_MAP') {
                            // Reload nav map when changes order
                            this.updateOrderNavMap(syncChange);
                        } else if (syncChange.actionType == 'MOVE_TO_PAGE') {
                            this.updateMovedElement(syncChange);
                        } else if (syncChange.actionType == 'MOVE_ON_PAGE') {
                            // Move block/idevice on page
                            this.updateMovedElementOnSamePage(syncChange);
                        } else {
                            // Update page
                            this.updateUserPage(pageId);
                        }
                    }, this.syncIntervalTime);
                }
            }
        });
    }

    /**
     *
     * @param {*} newOdeBlockSync
     */
    async replaceOdeBlock(newOdeBlockSync) {
        let oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(newOdeBlockSync.blockId);
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }

        // Get new block and place in the respective container
        newOdeBlockSync.mode = 'export';
        let cloneBlockNode = await this.idevices.newBlockNode(
            newOdeBlockSync,
            true,
        );
        nodeContentElement.insertBefore(
            cloneBlockNode.blockContent,
            nodeContentElement.children[cloneBlockNode.order],
        );
        // Load Idevices in block
        newOdeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
            idevice.mode = 'export';
            await this.idevices.createIdeviceInContent(
                idevice,
                cloneBlockNode.blockContent,
                elementOnModeEdition,
            );
        });
    }

    /**
     *
     * @param {*} odeBlockSync
     */
    async moveOdeBlockOnSamePage(odeBlockSync) {
        // Delete old idevice
        let oldOdeComponent = document.getElementById(odeBlockSync.blockId);
        if (oldOdeComponent) {
            oldOdeComponent.remove();
        }

        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        let cloneBlockNode = await this.idevices.newBlockNode(
            odeBlockSync,
            true,
        );
        // Fix the order of blocks when creating a new content block
        let blockPosition = nodeContentElement.children.length - 1;

        nodeContentElement.insertBefore(
            cloneBlockNode.blockContent,
            nodeContentElement.children[blockPosition], //nodeContentElement.children[cloneBlockNode.order],
        );

        // Load Idevices in block if node-content is on mode "view"
        var loadIdevicesOnBlock = setInterval(() => {
            if (nodeContentElement.getAttribute('mode') == 'view') {
                odeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
                    // Exclude empty idevices
                    if (idevice.htmlView !== null) {
                        idevice.mode = 'export';
                        await this.idevices.createIdeviceInContent(
                            idevice,
                            cloneBlockNode.blockContent,
                            elementOnModeEdition,
                        );
                    }
                });
                clearInterval(loadIdevicesOnBlock);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} odeIdeviceSync
     */
    async moveOdeComponentOnSamePage(odeIdeviceSync) {
        let cloneIdeviceNode, blockContent, oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(
            odeIdeviceSync.odeIdeviceId,
        );
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(odeIdeviceSync.blockId);

        if (blockNode) {
            blockContent = blockNode.blockContent;
            odeIdeviceSync.mode = 'export';
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                odeIdeviceSync,
                blockContent,
                elementOnModeEdition,
            );
        } else {
            odeIdeviceSync.mode = 'export';
            // Create new idevice
            let params = { odeBlockId: odeIdeviceSync.blockId };
            let newOdeBlockSync =
                await this.app.api.postObtainOdeBlockSync(params);
            odeIdeviceSync.mode = 'export';
            let cloneBlockNode = await this.idevices.newBlockNode(
                newOdeBlockSync,
                true,
            );
            blockContent = cloneBlockNode.blockContent;
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                odeIdeviceSync,
                blockContent,
                elementOnModeEdition,
            );
            // Move
            nodeContentElement.insertBefore(
                blockContent,
                nodeContentElement.children[cloneBlockNode.order],
            );
        }
        if (blockNode) {
            // Move
            blockContent.insertBefore(
                cloneIdeviceNode.ideviceContent,
                blockContent.children[cloneIdeviceNode.order],
            );
        }
    }

    /**
     * Updates the pageElement to apply the sync changes
     *
     * @param {*} newOdePage
     *
     * Exceptional cases included: properties changes
     */
    async replaceOdePage(newOdePage) {
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        // Check if the ode page is empty (only case "root")
        if (!newOdePage) {
            // Delete page
            let properties = newOdePage.odeNavStructureSyncProperties;
            // Remove node in structure list
            this.structure.data = this.structure.data.filter(
                (node, index, arr) => {
                    return node.id != newOdePage.id;
                },
            );
            //
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.cloneNodeNav(
                newOdePage,
            );

            // Set title in node page
            if (newOdePage.id == navId) {
                this.idevices.setNodeContentPageTitle(properties);
            }
        }

        // Synchronize properties
        await this.app.project.properties.apiLoadProperties();
        await this.app.project.properties.formProperties.reloadValues();

        this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData(
            navId,
        );

        let odeTitleMenuHeadElement = document.querySelector(
            '#exe-title > .exe-title.content',
        );
        odeTitleMenuHeadElement.innerHTML =
            this.app.project.properties.properties.pp_title.value;
    }

    /**
     *
     * @param {*} odeComponentSyncId
     */
    async deleteOdeComponent(odeComponentSyncId) {
        // Delete idevice
        let oldOdeComponent = document.getElementById(odeComponentSyncId);
        oldOdeComponent.remove();
    }

    /**
     *
     * @param {*} odeBlockId
     */
    async deleteOdeBlock(odeBlockId) {
        // Delete block
        let oldOdeComponent = document.getElementById(odeBlockId);
        oldOdeComponent.remove();
    }

    /**
     *
     * @param {*} odePageId
     */
    async deleteOdePage(odePageId) {
        // Delete page
        let selectedNavId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        // Remove node in structure list
        this.structure.data = this.structure.data.filter((node, index, arr) => {
            return node.pageId != odePageId;
        });

        if (odePageId == selectedPageId) {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                false,
            );
        } else {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                selectedNavId,
            );
        }
    }

    /**
     *
     * @param {*} newOdeComponentSync
     */
    async addOdeComponent(newOdeComponentSync) {
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(newOdeComponentSync.blockId);
        let blockContent = blockNode.blockContent;
        newOdeComponentSync.mode = 'export';
        let cloneIdeviceNode = await this.idevices.createIdeviceInContent(
            newOdeComponentSync,
            blockContent,
            elementOnModeEdition,
        );
        // Move
        blockContent.insertBefore(
            cloneIdeviceNode.ideviceContent,
            blockContent.children[cloneIdeviceNode.order],
        );
    }

    /**
     *
     * @param {*} newOdeBlockSync
     */
    async addOdeBlock(newOdeBlockSync, isUndoMoveTo = false) {
        // Get new block and place in the respective container
        let odeNavStructureSyncId = document
            .querySelector('.nav-element .selected')
            .getAttribute('nav-id');
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']",
        );
        newOdeBlockSync.mode = 'export';
        let cloneBlockNode = await this.idevices.newBlockNode(
            newOdeBlockSync,
            true,
        );
        if (isUndoMoveTo) {
            nodeContentElement.insertBefore(
                cloneBlockNode.blockContent,
                nodeContentElement.children[cloneBlockNode.order],
            );
        } else {
            nodeContentElement.insertBefore(
                cloneBlockNode.blockContent,
                nodeContentElement.children[cloneBlockNode.order],
            );
        }

        // Load Idevices in block
        newOdeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
            idevice.mode = 'export';
            let ideviceNode = await this.idevices.createIdeviceInContent(
                idevice,
                cloneBlockNode.blockContent,
                elementOnModeEdition,
            );
        });

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id',
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} newOdePageSync
     */
    async addOdePage(newOdePageSync) {
        await this.app.menus.menuStructure.menuStructureCompose.structureEngine.cloneNodeNav(
            newOdePageSync,
        );
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );

        // In case of first page reset structure must be the new navId
        let lengthNavElements =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.menuNavList.getElementsByClassName(
                'nav-element',
            ).length;
        if (navId == 'root' && lengthNavElements <= 1) {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                newOdePageSync.id,
            );
        }

        // Reset structure and stay on selected nav
        await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
            navId,
        );
    }

    /**
     *
     * @param {*} OdeBlockSync
     */
    async moveOdeBlock(OdeBlockSync, isUndoMoveTo = false) {
        let elementsPage = document.querySelectorAll(
            '.idevice-element-in-content',
        );
        let isAddElement = false;
        if (elementsPage.length <= 0) {
            isAddElement = true;
        }
        for (let elementPage of elementsPage) {
            let blockId = elementPage.getAttribute('block-id');
            if (OdeBlockSync.blockId == blockId) {
                this.deleteOdeBlock(OdeBlockSync.blockId);
                isAddElement = false;
                return;
            } else if (OdeBlockSync.id !== blockId) {
                isAddElement = true;
            }
        }
        if (isAddElement) {
            this.addOdeBlock(OdeBlockSync, isUndoMoveTo);
        }
    }

    /**
     *
     * @param {*} odeComponentSync
     */
    async moveOdeComponent(odeComponentSync, isUndoMoveTo = false) {
        let elementsPage = document.querySelectorAll(
            '.idevice_node .idevice-element-in-content',
        );
        let isAddElement = false;
        if (elementsPage.length <= 0) {
            isAddElement = true;
        }
        for (let elementPage of elementsPage) {
            let componentId = elementPage.getAttribute('idevice-id');
            if (odeComponentSync.odeIdeviceId == componentId) {
                if (isUndoMoveTo) {
                    this.deleteOdeBlock(odeComponentSync.previousBlockId);
                } else {
                    this.deleteOdeComponent(odeComponentSync.odeIdeviceId);
                }
                isAddElement = false;
                return;
            } else if (odeComponentSync.odeIdeviceId !== componentId) {
                isAddElement = true;
            }
        }
        if (isAddElement) {
            this.replaceOdeComponent(odeComponentSync, isUndoMoveTo);
        }
    }

    /**
     *
     */
    async cleanPreviousAutosaves() {
        let params = { odeSessionId: this.odeSession };
        await this.app.api.postCleanAutosavesByUser(params);
    }

    /**
     *
     * @param {*} odeComponentFlag
     * @param {*} odePageId
     * @param {*} blockId
     * @param {*} odeIdeviceId
     * @param {*} actionType
     * @param {*} destPageId
     */
    async updateCurrentOdeUsersUpdateFlag(
        odeComponentFlag,
        odePageId,
        blockId,
        odeIdeviceId,
        actionType,
        destPageId,
    ) {
        let params = {
            odeSessionId: this.odeSession,
            odePageId: odePageId,
            blockId: blockId,
            odeIdeviceId: odeIdeviceId,
            odeComponentFlag: odeComponentFlag,
            actionType: actionType,
            destinationPageId: destPageId,
        };
        let response =
            await this.app.api.postActivateCurrentOdeUsersUpdateFlag(params);
        return response;
    }

    /**
     *
     * @param {*} odeComponentFlag
     * @param {*} odeNavStructureSyncId
     * @param {*} blockId
     * @param {*} odeIdeviceId
     * @returns
     */
    async changeUserFlagOnEdit(
        odeComponentFlag,
        odeNavStructureSyncId,
        blockId,
        odeIdeviceId,
        isIdeviceRemove = false,
    ) {
        let params = {
            odeSessionId: this.odeSession,
            odeIdeviceId: odeIdeviceId,
            blockId: blockId,
            odeNavStructureSyncId: odeNavStructureSyncId,
            odeComponentFlag: odeComponentFlag,
        };

        // In case of multiple session and odeComponentFlag set to false wait for the clientIntervalUpdate
        if (this.offlineInstallation !== true && odeComponentFlag == false) {
            // Params
            let odeId = this.odeId;
            let odeVersion = this.odeVersion;
            let odeSession = this.odeSession;
            let isMultipleSession = true;
            // Check users in session
            isMultipleSession = await this.checkUsersInSession(
                odeId,
                odeVersion,
                odeSession,
                isMultipleSession,
            );

            if (isMultipleSession && isIdeviceRemove == false) {
                setTimeout(() => {
                    // In case user does not edit again the idevice
                    let e = document.getElementById(params.odeIdeviceId);
                    if (e && e.getAttribute('mode') !== 'edition') {
                        let response = this.app.api.postEditIdevice(params);
                        return response;
                    }
                }, this.clientIntervalUpdate);
            } else {
                let response = await this.app.api.postEditIdevice(params);
                return response;
            }
        } else {
            let response = await this.app.api.postEditIdevice(params);
            return response;
        }
    }

    /**
     *
     * @param {*} blockId
     * @param {*} odeIdeviceId
     * @returns
     */
    async isAvalaibleOdeComponent(blockId, odeIdeviceId) {
        let params = {
            odeSessionId: this.odeSession,
            odeIdeviceId: odeIdeviceId,
            blockId: blockId,
        };
        let response =
            await this.app.api.checkCurrentOdeUsersComponentFlag(params);
        return response;
    }

    /*********************************************************************************************/
    /* ODE OPERATIONS (UNDO HISTORY) ACTIONS
  /*********************************************************************************************/

    /**
     * Send ode operation to bbdd
     *
     * @param {*} odeSourceId
     * @param {*} odeDestinationId
     * @param {*} actionType
     * @param {*} additionalData
     * @returns
     */
    async sendOdeOperationLog(
        odeSourceId,
        odeDestinationId,
        actionType,
        additionalData,
    ) {
        if (additionalData !== null) {
            additionalData = JSON.stringify(additionalData);
        }
        let params = {
            odeSessionId: this.odeSession,
            odeSourceId: odeSourceId,
            odeDestinationId: odeDestinationId,
            actionType: actionType,
            additionalData: additionalData,
        };
        let response = await this.app.api.postOdeOperation(params);
        return response;
    }

    /**
     * Get last action and do undo
     *
     */
    async undoLastAction() {
        let response = await this.app.api.getActionFromLastOdeOperation();
        if (response.responseMessage == 'OK') {
            this.app.modals.confirm.show({
                title: _('Undo'),
                body: _('Undo the last action?'),
                confirmButtonText: _('Yes'),
                confirmExec: () => {
                    this.typeUndoByAction(response);
                    this.app.api.getConfirmLastOperationLogDone();
                },
            });
        } else {
            // Show message
            let text = response.responseMessageBody
                ? response.responseMessageBody
                : _('Unable to undo the last action.');
            let toastData = {
                title: _('Undo'),
                body: _(text),
                icon: 'restore',
                remove: 1000,
                error: true,
            };
            let toast = this.app.toasts.createToast(toastData);
        }
    }

    /**
     * Select the undo by the action on bbdd
     *
     * @param {*} response
     */
    async typeUndoByAction(response) {
        if (response.isDelete && response.isDelete == true) {
            this.undoAddIdevice(response.deleteBlockId);
            this.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.deleteBlockId,
                null,
                'DELETE',
                null,
            );
        } else if (response.isMoveTo && response.isMoveTo == true) {
            this.undoBlockLastMoveTo(
                response.moveFrom,
                response.moveTo,
                response.previousOrder,
                response.previousPageId,
                response.blockDto,
            );
            this.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.blockDto.blockId,
                null,
                'MOVE_TO_PAGE',
                response.moveFrom,
            );
        } else if (
            response.isMoveIdeviceTo &&
            response.isMoveIdeviceTo == true
        ) {
            this.undoIdeviceLastMoveTo(
                response.moveFrom,
                response.moveTo,
                response.previousOrder,
                response.previousPageId,
                response.odeBlockDto,
                response.odeIdeviceDto,
            );
            this.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                null,
                response.odeIdeviceDto.odeIdeviceId,
                'MOVE_TO_PAGE',
                response.moveFrom,
            );
        } else if (response.isMoveBlockOn && response.isMoveBlockOn == true) {
            this.undoLastMoveBlockOrder(
                response.previousOrder,
                response.odeBlockDto,
            );
            this.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.odeBlockDto.blockId,
                null,
                'MOVE_ON_PAGE',
                null,
            );
        } else if (
            response.isMoveIdeviceOn &&
            response.isMoveIdeviceOn == true
        ) {
            this.undoLastMoveIdeviceOrder(
                response.previousOrder,
                response.odeBlockDto,
                response.odeIdeviceDto,
            );
            this.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                null,
                response.odeIdeviceDto.odeIdeviceId,
                'MOVE_ON_PAGE',
                null,
            );
        } else if (
            response.isCloneIdeviceDelete &&
            response.isCloneIdeviceDelete == true
        ) {
            this.undoCloneIdevice(response.odeIdeviceDto, response.moveFrom);
        } else if (
            response.isCloneBlockDelete &&
            response.isCloneBlockDelete == true
        ) {
            this.undoCloneBlock(response.blockDto);
        } else if (
            response.isClonePageDelete &&
            response.isClonePageDelete == true
        ) {
            this.undoClonePage(response.navId, response.pageId);
        } else if (
            response.isAddPageDelete &&
            response.isAddPageDelete == true
        ) {
            this.undoAddPage(response.navId, response.pageId);
        } else if (response.isMovePage && response.isMovePage == true) {
            this.undoMovePage(
                response.navId,
                response.baseNavId,
                response.previousMov,
                response.isMovePageButton,
                response.isUndoMove,
                response.previousNodeBaseParent,
                response.previousNodeMovParent,
                response.previousNodeMovOrder,
            );
        }
    }

    /**
     * Remove from bbdd and interface idevice added previously
     *
     * @param {*} odeBlockId
     */
    async undoAddIdevice(odeBlockId) {
        let odeBlock = document.getElementById(odeBlockId);
        let id = odeBlock.getAttribute('sym-id');
        this.idevices.getBlockById(odeBlockId).removeIdevices();
        this.app.api.deleteBlock(id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All blocks that have been modified
                if (response.odePagStructureSyncs) {
                    // Update the order of other blocks
                    this.idevices.updateComponentsBlocks(
                        response.odePagStructureSyncs,
                        ['order'],
                    );
                    odeBlock.remove();
                    this.idevices.removeBlockOfComponentList(id);
                    this.idevices.updateMode();
                }
            }
        });
    }

    /**
     * Remove from bbdd and interface the cloned idevice
     *
     * @param {*} odeIdeviceDto
     */
    async undoCloneIdevice(odeIdeviceDto, moveFrom) {
        let ideviceNode = document.getElementById(odeIdeviceDto.odeIdeviceId);
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        this.app.api.deleteIdevice(odeIdeviceDto.id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All idevices that have been modified
                if (response.odeComponentsSyncs) {
                    // update the order of other idevices
                    this.idevices.updateComponentsIdevices(
                        response.odeComponentsSyncs,
                        ['order'],
                    );
                    if (ideviceNode && selectedPageId == moveFrom) {
                        ideviceNode.remove();
                    }
                }
            }
        });
    }

    /**
     * Remove from bbdd and interface the cloned block
     *
     * @param {*} previousOdeBlockDto
     */
    async undoCloneBlock(previousOdeBlockDto) {
        let blockNode = document.getElementById(previousOdeBlockDto.blockId);
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        this.app.api.deleteBlock(previousOdeBlockDto.id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All blocks that have been modified
                if (response.odePagStructureSyncs) {
                    // Update the order of other blocks
                    this.idevices.updateComponentsBlocks(
                        response.odePagStructureSyncs,
                        ['order'],
                    );
                    if (
                        blockNode &&
                        previousOdeBlockDto.pageId == selectedPageId
                    ) {
                        blockNode.remove();
                    }
                }
            }
        });
    }

    /**
     * Remove from bbdd and interface cloned page
     *
     * @param {*} navId
     */
    async undoClonePage(navId, pageId) {
        // Delete page
        let selectedNavId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        this.app.api.deletePage(navId).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // Remove node in structure list
                this.structure.data = this.structure.data.filter(
                    (node, index, arr) => {
                        return node.id != navId;
                    },
                );
                if (navId == selectedNavId) {
                    this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                        false,
                    );
                } else {
                    this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                        selectedNavId,
                    );
                }
                // update current ode users update flag
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    pageId,
                    null,
                    null,
                    'DELETE',
                );
            }
        });
    }

    /**
     * Remove from bbdd and interface added page
     *
     * @param {*} navId
     */
    async undoAddPage(navId, pageId) {
        // Delete page
        let selectedNavId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        this.app.api.deletePage(navId).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // Remove node in structure list
                this.structure.data = this.structure.data.filter(
                    (node, index, arr) => {
                        return node.id != navId;
                    },
                );
                if (navId == selectedNavId) {
                    this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                        false,
                    );
                } else {
                    this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                        selectedNavId,
                    );
                }

                // update current ode users update flag
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    pageId,
                    null,
                    null,
                    'DELETE',
                );
            }
        });
    }

    /**
     * Undo last page move
     *
     * @param {*} navId
     * @param {*} baseNavId
     * @param {*} previousMov
     * @param {*} isMovePageButton
     * @param {*} isUndoMove
     * @param {*} previousNodeBaseParentId
     * @param {*} previousNodeMovParentId
     * @param {*} previousNodeMovOrder
     */
    async undoMovePage(
        navId,
        baseNavId,
        previousMov,
        isMovePageButton,
        isUndoMove,
        previousNodeBaseParentId,
        previousNodeMovParentId,
        previousNodeMovOrder,
    ) {
        let actualmov;
        let selectedNavId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id',
            );
        // Get the actual mov if the page was moved with buttons
        if (isMovePageButton && isMovePageButton == true) {
            correlationMov = {
                next: 'prev',
                prev: 'next',
                down: 'up',
                up: 'down',
            };
            actualMov = correlationMov[previousMov];
            // Undo last move
            await this.structure.moveNode(navId, actualmov, isUndoMove);
            this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                selectedNavId,
            );
        } else {
            // Get nodes
            let nodeNav = this.structure.getNode(navId);
            let nodeBaseNav = this.structure.getNode(baseNavId);
            let previousNodeMovParent = this.structure.getNode(
                previousNodeMovParentId,
            );
            let previousNodeBaseParent = this.structure.getNode(
                previousNodeBaseParentId,
            );

            // Get the parent of the parent to obtain order
            let previousNodeBaseSecondParent = this.structure.getNode(
                previousNodeBaseParent.parent,
            );

            // Check if previously was parent and do the update
            if (previousNodeBaseParentId == previousNodeMovParentId) {
                // Check if base was parent and the nodeNav was in the parent
                if (
                    previousNodeBaseParent.children.length > 0 &&
                    nodeNav.parent == previousNodeBaseParent.id
                ) {
                    await nodeNav.apiUpdateOrder(previousNodeMovOrder);
                } else {
                    await nodeNav.apiUpdateParent(
                        previousNodeBaseParent.parent,
                        previousNodeBaseSecondParent.order + 1,
                    );
                }
            } else {
                // Check if the base and node parents are the same
                if (nodeNav.parent == nodeBaseNav.parent) {
                    await nodeNav.apiUpdateParent(
                        nodeBaseNav.id,
                        nodeBaseNav.order + 1,
                    );
                } else {
                    await nodeNav.apiUpdateParent(
                        previousNodeMovParentId,
                        previousNodeMovParent.order + 1,
                    );
                }
            }

            this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                selectedNavId,
            );
            this.updateUserPage(selectedNavId);
        }
    }

    /**
     * Undo last block move to page
     *
     * @param {*} moveFrom
     * @param {*} moveTo
     * @param {*} previousOrder
     * @param {*} previousPageId
     * @param {*} previousOdeBlockDto
     */
    async undoBlockLastMoveTo(
        moveFrom,
        moveTo,
        previousOrder,
        previousPageId,
        previousOdeBlockDto,
    ) {
        // Required parameters
        let isUndoMoveTo = true;
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        // Update page in database
        let data = this.generateBlockDataObject(
            moveFrom,
            previousOrder,
            previousPageId,
            previousOdeBlockDto,
        );
        let response = await this.app.api['putSaveBlock'].call(
            this.app.api,
            data,
        );
        if (response && response.responseMessage == 'OK') {
            // All blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other components if necessary
                this.idevices.updateComponentsBlocks(
                    response.odePagStructureSyncs,
                    ['order'],
                );
                previousOdeBlockDto.order = previousOrder;
                previousOdeBlockDto.odePageId = moveFrom;
                previousOdeBlockDto.odeNavStructureSyncId = previousPageId;
                if (selectedPageId == moveFrom || selectedPageId == moveTo) {
                    this.updateUserPage(
                        previousOdeBlockDto.odeNavStructureSyncId,
                    );
                }
            }
        } else {
            let defaultModalMessage = _(
                'An error occurred while saving the component.',
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     *
     * Undo last idevice move to page
     *
     * @param {*} moveFrom
     * @param {*} moveTo
     * @param {*} previousOrder
     * @param {*} previousPageId
     * @param {*} previousOdeBlockDto
     * @param {*} odeIdeviceDto
     */
    async undoIdeviceLastMoveTo(
        moveFrom,
        moveTo,
        previousOrder,
        previousPageId,
        previousOdeBlockDto,
        odeIdeviceDto,
    ) {
        // Required parameters
        let isUndoMoveTo = true;
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        // Update page in database
        let data = this.generateIdeviceDataObject(
            moveFrom,
            moveTo,
            previousOrder,
            previousPageId,
            previousOdeBlockDto,
            odeIdeviceDto,
        );
        let response = await this.app.api['putSaveIdevice'].call(
            this.app.api,
            data,
        );
        if (response && response.responseMessage == 'OK') {
            // All Idevices that have been modified
            if (response.odeComponentsSyncs) {
                // update the order of other idevices
                this.idevices.updateComponentsIdevices(
                    response.odeComponentsSyncs,
                    ['order'],
                );
            }
            // All Blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other idevices
                this.idevices.updateComponentsBlocks(
                    response.odeComponentsSyncs,
                    ['order'],
                );
            }
            // Delete block in destination page
            this.app.api
                .deleteBlock(odeIdeviceDto.odePagStructureSyncId)
                .then((response) => {
                    if (
                        response.responseMessage &&
                        response.responseMessage == 'OK'
                    ) {
                        // All blocks that have been modified
                        if (response.odePagStructureSyncs) {
                            // Update the order of other blocks
                            this.idevices.updateComponentsBlocks(
                                response.odePagStructureSyncs,
                                ['order'],
                            );
                        }
                    }
                });
            odeIdeviceDto.order = previousOrder;
            odeIdeviceDto.previousBlockId = odeIdeviceDto.blockId;
            odeIdeviceDto.blockId = previousOdeBlockDto.blockId;

            if (selectedPageId == moveFrom || selectedPageId == moveTo) {
                //this.moveOdeComponent(odeIdeviceDto, isUndoMoveTo);
                this.updateUserPage(previousOdeBlockDto.odeNavStructureSyncId);
            }
        } else {
            let defaultModalMessage = _(
                'An error occurred while saving the component.',
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     * Undo block last move on page
     *
     * @param {*} previousOrder
     * @param {*} previousOdeBlockDto
     */
    async undoLastMoveBlockOrder(previousOrder, previousOdeBlockDto) {
        // Required parameters
        let isUndoMoveTo = true;
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        // Update page in database
        let data = this.generateBlockDataObject(
            null,
            previousOrder,
            null,
            previousOdeBlockDto,
        );
        let response = await this.app.api['putSaveBlock'].call(
            this.app.api,
            data,
        );
        if (response && response.responseMessage == 'OK') {
            // All blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other components if necessary
                this.idevices.updateComponentsBlocks(
                    response.odePagStructureSyncs,
                    ['order'],
                );
                previousOdeBlockDto.order = previousOrder;
                await this.app.api['putReorderBlock'].call(this.app.api, data);
                if (selectedPageId == previousOdeBlockDto.pageId) {
                    this.updateUserPage(
                        previousOdeBlockDto.odeNavStructureSyncId,
                    );
                }
            }
        } else {
            let defaultModalMessage = _(
                'An error occurred while saving the component.',
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     * Undo idevice last move on page
     *
     * @param {*} previousOrder
     * @param {*} previousOdeBlockDto
     * @param {*} odeIdeviceDto
     */
    async undoLastMoveIdeviceOrder(
        previousOrder,
        previousOdeBlockDto,
        odeIdeviceDto,
    ) {
        // Required parameters
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id',
            );
        let odeBlockIdBeforeUndo = odeIdeviceDto.blockId;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementBlockRemove = nodeContentElement.querySelector(
            `[id="${odeBlockIdBeforeUndo}"]`,
        );
        // Update page in database
        let data = this.generateIdeviceDataObject(
            null,
            null,
            previousOrder,
            null,
            previousOdeBlockDto,
            odeIdeviceDto,
        );
        let response = await this.app.api['putSaveIdevice'].call(
            this.app.api,
            data,
        );
        if (response && response.responseMessage == 'OK') {
            // All blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other components if necessary
                this.idevices.updateComponentsBlocks(
                    response.odePagStructureSyncs,
                    ['order'],
                );
                odeIdeviceDto.order = previousOrder;
                odeIdeviceDto.blockId = previousOdeBlockDto.blockId;
                await this.app.api['putReorderIdevice'].call(
                    this.app.api,
                    data,
                );
                if (selectedPageId == previousOdeBlockDto.pageId) {
                    this.updateUserPage(
                        previousOdeBlockDto.odeNavStructureSyncId,
                    );
                    // Delete block in destination page
                    if (elementBlockRemove.childElementCount <= 1) {
                        this.app.api
                            .deleteBlock(odeIdeviceDto.odePagStructureSyncId)
                            .then((response) => {
                                if (
                                    response.responseMessage &&
                                    response.responseMessage == 'OK'
                                ) {
                                    // All blocks that have been modified
                                    if (response.odePagStructureSyncs) {
                                        // Update the order of other blocks
                                        this.idevices.updateComponentsBlocks(
                                            response.odePagStructureSyncs,
                                            ['order'],
                                        );
                                        elementBlockRemove.remove();
                                    }
                                }
                            });
                    }
                }
            }
        } else {
            let defaultModalMessage = _(
                'An error occurred while saving the component.',
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     * Generate block array data to send to api
     *
     * @param {*} moveFrom
     * @param {*} previousOrder
     * @param {*} previousPageId
     * @param {*} previousOdeBlockDto
     * @returns
     */
    generateBlockDataObject(
        moveFrom,
        previousOrder,
        previousPageId,
        previousOdeBlockDto,
    ) {
        let defaultVersion = this.odeVersion;
        let defaultSession = this.odeSession;
        let defaultOdeNavStructureSyncId = this.structure.getSelectNodeNavId();
        let defaultOdePageId = this.structure.getSelectNodePageId();
        return {
            odePagStructureSyncId: previousOdeBlockDto.id,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: previousPageId
                ? previousPageId
                : defaultOdeNavStructureSyncId,
            odePageId: moveFrom ? moveFrom : defaultOdePageId,
            iconName: previousOdeBlockDto.iconName,
            blockName: previousOdeBlockDto.blockName,
            order: previousOrder,
            isUndoLastAction: true,
        };
    }

    /**
     * Generate idevice array data to send to api
     *
     * @param {*} moveFrom
     * @param {*} moveTo
     * @param {*} previousOrder
     * @param {*} previousPageId
     * @param {*} previousOdeBlockDto
     * @param {*} odeIdeviceDto
     * @returns
     */
    generateIdeviceDataObject(
        moveFrom,
        moveTo,
        previousOrder,
        previousPageId,
        previousOdeBlockDto,
        odeIdeviceDto,
    ) {
        let defaultVersion = this.odeVersion;
        let defaultSession = this.odeSession;
        return {
            odeComponentsSyncId: odeIdeviceDto.id,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: previousPageId,
            odePageId: moveFrom,
            odePagStructureSyncId: previousOdeBlockDto.id,
            odePagStructureSyncOrder: previousOdeBlockDto.order,
            odeBlockId: previousOdeBlockDto.blockId,
            blockName: previousOdeBlockDto.blockName,
            iconName: previousOdeBlockDto.iconName,
            order: previousOrder,
            isUndoLastAction: true,
        };
    }

    /**
     *
     * @return {boolean} - True if at least one iDevice is in edition mode, false otherwise.
     */
    checkOpenIdevice() {
        const container = document.getElementById('node-content');
        if (!container) {
            return false;
        }
        const element = container.querySelector(
            'div.idevice_node[mode="edition"]',
        );
        if (element !== null) {
            eXeLearning.app.modals.alert.show({
                title: _('Info'),
                body: _(
                    'You are currently editing an iDevice. Please close it before continuing',
                ),
            });
            return true;
        }
    }

    /**
     * Sorts <article> elements inside #node-content by their IDs
     * and reorders them visually in the DOM.
     *
     * @param {boolean} ascending - If true, sorts ascending (a → b); if false, descending (b → a)
     */
    sortBlocksById(ascending = true) {
        // Get the main container elements
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container',
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');

        // Get and sort <article> elements by ID
        let sortedArticles = Array.from(nodeContentElement.children)
            .filter((el) => el.tagName.toLowerCase() === 'article')
            .sort((a, b) => {
                return ascending
                    ? a.id.localeCompare(b.id)
                    : b.id.localeCompare(a.id);
            });

        // Loop through sorted elements
        sortedArticles.forEach((el) => {
            const text = el.querySelector('.exe-text-activity p');
            const udl = el.querySelector('.exe-udlContent-content > div');

            // Get the content from the <article>, fallback to placeholder
            const content = text
                ? text.innerText
                : udl?.innerText || '[No content]';

            // Shorten long content strings for display
            const shortened =
                content.length > 50 ? content.slice(0, 50) + '…' : content;

            // Log the ID and shortened content
            console.log('id: ' + el.id + ' content: ' + shortened);

            // Re-append the element to reorder it in the DOM
            nodeContentElement.appendChild(el);
        });
    }
}
