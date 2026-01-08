import Modal from '../modal.js';

export default class ModalSessionLogout extends Modal {
    constructor(manager) {
        let id = 'modalSessionLogout';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.saveSessionButton = this.modalElement.querySelector(
            'button.session-logout-save.btn.btn-primary'
        );
        this.notSaveSessionButton = this.modalElement.querySelector(
            'button.session-logout-without-save.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        // Modal footer content element
        this.modalFooterContent =
            this.modalElement.querySelector('.modal-footer');
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('Logout');
        data = data ? data : {};
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        let title = data.title ? data.title : this.titleDefault;
        setTimeout(() => {
            this.setTitle(title);
            this.setBody(_('Do you want to save the current project?'));
            this.setFooterContent(data);
            this.modal.show();
        }, time);
    }

    /**
     * setFooterContent
     *
     */
    setFooterContent(data) {
        let saveSessionButton = this.saveSessionButton.cloneNode(true);
        let notSaveSessionButton = this.notSaveSessionButton.cloneNode(true);
        let cancelButton = this.cancelButton;

        this.modalFooterContent.innerHTML = '';
        this.modalFooterContent.appendChild(
            this.setSaveSessionButton(saveSessionButton, data)
        );
        this.modalFooterContent.appendChild(
            this.setNotSaveSessionButton(notSaveSessionButton, data)
        );
        this.modalFooterContent.appendChild(cancelButton);
    }

    /**
     * setSaveSessionButton
     *
     * @param {*} saveSessionButton
     * @returns
     */
    setSaveSessionButton(saveSessionButton, data) {
        saveSessionButton.innerHTML = _('Yes');
        this.saveSessionEventListener(saveSessionButton, data);
        return saveSessionButton;
    }

    /**
     * setNotSaveSessionButton
     *
     * @param {*} notSaveSessionButton
     * @returns
     */
    setNotSaveSessionButton(notSaveSessionButton, data) {
        notSaveSessionButton.innerHTML = data.forceOpen
            ? data.forceOpen
            : _('Exit without saving');
        this.notSaveSessionEventListener(notSaveSessionButton, data);
        return notSaveSessionButton;
    }

    /**
     * Close the offline app (Electron window)
     */
    closeOfflineApp() {
        window.onbeforeunload = null;
        window.close();
    }

    /**
     * saveSessionEventListener
     *
     * @param {*} saveSessionButton
     */
    saveSessionEventListener(saveSessionButton, data) {
        saveSessionButton.addEventListener('click', async () => {
            // Handle offline exit: save and close app
            if (data.offlineExit) {
                this.close();
                await this.saveAndCloseOffline();
                return;
            }

            let odeParams = [];

            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;
            odeParams['odeVersion'] = eXeLearning.app.project.odeVersion;
            odeParams['odeId'] = eXeLearning.app.project.odeId;

            this.saveSession(odeParams, data);
            this.close();
        });
    }

    /**
     * Save project and close app in offline mode
     */
    async saveAndCloseOffline() {
        try {
            // Use Yjs export for saving
            if (
                eXeLearning.app.project?._yjsEnabled &&
                eXeLearning.app.project?.exportToElpxViaYjs
            ) {
                await eXeLearning.app.project.exportToElpxViaYjs({
                    saveAs: false,
                });
            }
            this.closeOfflineApp();
        } catch (error) {
            console.error(
                '[ModalSessionLogout] Error saving before exit:',
                error
            );
            eXeLearning.app.modals.alert.show({
                title: _('Error saving'),
                body: _('An error occurred while saving the project'),
                contentId: 'error',
            });
        }
    }

    /**
     * notSaveSessionEventListener
     *
     * @param {*} notSaveSessionButton
     */
    notSaveSessionEventListener(notSaveSessionButton, data) {
        notSaveSessionButton.addEventListener('click', () => {
            // Handle offline exit: close app without saving
            if (data.offlineExit) {
                this.close();
                this.closeOfflineApp();
                return;
            }

            // Handle Yjs project navigation (from Recent Projects menu)
            if (data.openYjsProject && data.projectUuid) {
                const basePath = window.eXeLearning?.config?.basePath || '';
                window.location.href = `${basePath}/workarea?project=${data.projectUuid}`;
                this.close();
                return;
            }

            let odeParams = [];
            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;

            if (data.openOdeFile) {
                if (data.localOdeFile) {
                    // Check if this is a large file upload
                    if (data.isLargeFile && data.odeFile) {
                        // For large files, resume the upload process
                        eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                            data.odeFile,
                            false,
                            false,
                            true, // skipSessionCheck
                            true // forceCloseSession
                        );
                    } else {
                        // For regular files, use the normal flow
                        eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession(
                            data.odeFileName,
                            data.odeFilePath
                        );
                    }
                } else {
                    eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession(
                        data.id
                    );
                }
                this.close();
            } else {
                window.onbeforeunload = null;
                this.closeSession(odeParams['odeSessionId'], data);
            }
        });
    }

    /**
     * saveSession
     *
     * @param {*} odeParams
     */
    async saveSession(odeParams, data) {
        // Handle Yjs-enabled projects: use SaveManager instead of legacy API
        const isYjsEnabled = eXeLearning?.app?.project?._yjsEnabled;
        const saveManager = eXeLearning?.app?.project?._yjsBridge?.saveManager;

        if (isYjsEnabled && saveManager) {
            try {
                // Save current project using Yjs SaveManager
                await saveManager.save();

                // Handle navigation based on action type
                if (data.openYjsProject && data.projectUuid) {
                    // Navigate to another Yjs project
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    window.location.href = `${basePath}/workarea?project=${data.projectUuid}`;
                } else if (data.newFile) {
                    // Creating new file - reload to create new project
                    window.onbeforeunload = null;
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    window.location.href = `${basePath}/workarea`;
                } else if (data.openOdeFile) {
                    // Opening a file
                    if (data.localOdeFile) {
                        if (data.isLargeFile && data.odeFile) {
                            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                                data.odeFile,
                                false,
                                false,
                                true,
                                true
                            );
                        } else {
                            eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession(
                                data.odeFileName,
                                data.odeFilePath
                            );
                        }
                    } else {
                        eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession(
                            data.id
                        );
                    }
                } else {
                    // Default: close session
                    window.onbeforeunload = null;
                    this.closeSession(odeParams['odeSessionId'], data);
                }
            } catch (error) {
                console.error('[SessionLogout] Error saving Yjs project:', error);
                eXeLearning.app.modals.alert.show({
                    title: _('Error saving'),
                    body: _('An error occurred while saving the project'),
                    contentId: 'error',
                });
            }
            return;
        }

        let params = {
            odeSessionId: odeParams['odeSessionId'],
            odeVersion: odeParams['odeVersion'],
            odeId: odeParams['odeId'],
        };
        await eXeLearning.app.api.postOdeSave(params).then((response) => {
            if (response.responseMessage == 'OK') {
                if (!data.openOdeFile && !data.newFile) {
                    window.onbeforeunload = null;
                    this.closeSession(odeParams['odeSessionId'], data);
                } else if (data.openOdeFile) {
                    if (data.localOdeFile) {
                        // Check if this is a large file upload
                        if (data.isLargeFile && data.odeFile) {
                            // For large files, resume the upload process
                            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                                data.odeFile,
                                false,
                                false,
                                true, // skipSessionCheck
                                true // forceCloseSession
                            );
                        } else {
                            // For regular files, use the normal flow
                            eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession(
                                data.odeFileName,
                                data.odeFilePath
                            );
                        }
                    } else {
                        eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession(
                            data.id
                        );
                    }
                } else {
                    eXeLearning.app.menus.navbar.file.createSession(params);
                }
            } else {
                let errorTextMessage = _(
                    'An error occurred while saving the file: ${response.responseMessage}'
                );
                errorTextMessage = errorTextMessage.replace(
                    '${response.responseMessage}',
                    response.responseMessage
                );
                eXeLearning.app.modals.alert.show({
                    title: _('Error saving'),
                    body: _(errorTextMessage),
                    contentId: 'error',
                });
            }
        });
    }

    /**
     * closeSession
     *
     * @param {*} odeSessionId
     */
    async closeSession(odeSessionId, data) {
        let params = { odeSessionId: odeSessionId };
        if (data.newFile) {
            eXeLearning.app.menus.navbar.file.createSession(params);
            this.close();
        } else {
            await eXeLearning.app.api
                .postCloseSession(params)
                .then((response) => {
                    if (response.responseMessage == 'OK') {
                        if (!this.offlineInstallation) {
                            this.realTimeEventNotifier.notify(odeSessionId, {
                                name: 'user-exiting',
                                payload: eXeLearning.user.username,
                            });
                        }
                        // We leave half a second for the notification to have time to be triggered
                        setTimeout(() => {
                            let pathname = window.location.pathname.split('/');
                            let basePathname = pathname
                                .splice(0, pathname.length - 1)
                                .join('/');
                            window.location.href =
                                window.location.origin +
                                basePathname +
                                '/logout';
                        }, 500);
                    }
                });
        }
    }
}
