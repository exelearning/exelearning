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
     * Show the save-before-transition dialog.
     *
     * @param {Object} data
     * @param {string} [data.title] - Modal title
     * @param {string} [data.forceOpen] - Label for the "don't save" button
     * @param {Object} [data.pendingAction] - Action descriptor for transitionToProject:
     *   { action: 'new'|'open'|'import', projectUuid?, file? }
     * @param {boolean} [data.offlineExit] - Electron: save-and-close flow
     * @param {boolean} [data.newFile] - Legacy compat: treated as { action: 'new' }
     * @param {boolean} [data.openYjsProject] - Legacy compat: treated as { action: 'open' }
     * @param {string} [data.projectUuid] - Legacy compat: for openYjsProject
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
     * Build the pending action object from data (supports both new and legacy formats).
     * @param {Object} data
     * @returns {Object} - { action, projectUuid?, file? }
     */
    _resolvePendingAction(data) {
        if (data.pendingAction) {
            return data.pendingAction;
        }
        // Legacy compat: derive pendingAction from old-style flags
        if (data.openYjsProject && data.projectUuid) {
            return { action: 'open', projectUuid: data.projectUuid };
        }
        if (data.newFile) {
            return { action: 'new' };
        }
        // Fallback: no project transition, just exit
        return null;
    }

    /**
     * setFooterContent
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
     */
    setSaveSessionButton(saveSessionButton, data) {
        saveSessionButton.innerHTML = _('Yes');
        this.saveSessionEventListener(saveSessionButton, data);
        return saveSessionButton;
    }

    /**
     * setNotSaveSessionButton
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
     * "Yes" (save) button click handler.
     */
    saveSessionEventListener(saveSessionButton, data) {
        saveSessionButton.addEventListener('click', async () => {
            // Handle offline exit: save and close app
            if (data.offlineExit) {
                this.close();
                await this.saveAndCloseOffline();
                return;
            }

            // Static mode: save-as-elp then create new project
            const isStaticMode =
                eXeLearning?.app?.capabilities?.storage?.remote === false &&
                !window.electronAPI;
            if (data.newFile && isStaticMode) {
                if (eXeLearning.app.project?.exportToElpxViaYjs) {
                    await eXeLearning.app.project.exportToElpxViaYjs({
                        saveAs: false,
                    });
                }
                this.close();
                if (typeof window.newProject === 'function') {
                    window.newProject();
                }
                return;
            }

            // Online mode: save + transition via full reload
            const pendingAction = this._resolvePendingAction(data);
            if (pendingAction && eXeLearning.app.project?.transitionToProject) {
                this.close();
                try {
                    await eXeLearning.app.project.transitionToProject({
                        ...pendingAction,
                        skipSave: false,
                    });
                } catch (error) {
                    console.error('[SessionLogout] Error during transition:', error);
                    eXeLearning.app.modals.alert.show({
                        title: _('Error saving'),
                        body: _('An error occurred while saving the project'),
                        contentId: 'error',
                    });
                }
                return;
            }

            // Legacy fallback: use old saveSession path
            let odeParams = [];
            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;
            odeParams['odeVersion'] = eXeLearning.app.project.odeVersion;
            odeParams['odeId'] = eXeLearning.app.project.odeId;
            this.saveSession(odeParams, data);
            this.close();
        });
    }

    /**
     * "No" (don't save) button click handler.
     */
    notSaveSessionEventListener(notSaveSessionButton, data) {
        notSaveSessionButton.addEventListener('click', async () => {
            // Handle offline exit: close app without saving
            if (data.offlineExit) {
                this.close();
                this.closeOfflineApp();
                return;
            }

            // Static mode: new file without saving
            const isStaticMode =
                eXeLearning?.app?.capabilities?.storage?.remote === false &&
                !window.electronAPI;
            if (data.newFile && isStaticMode) {
                this.close();
                if (typeof window.newProject === 'function') {
                    window.newProject();
                }
                return;
            }

            // Online mode: transition without save
            const pendingAction = this._resolvePendingAction(data);
            if (pendingAction && eXeLearning.app.project?.transitionToProject) {
                this.close();
                try {
                    await eXeLearning.app.project.transitionToProject({
                        ...pendingAction,
                        skipSave: true,
                    });
                } catch (error) {
                    console.error('[SessionLogout] Error during transition:', error);
                }
                return;
            }

            // Legacy fallback for flows without pendingAction
            let odeParams = [];
            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;

            if (data.openOdeFile) {
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
                this.close();
            } else {
                window.onbeforeunload = null;
                this.closeSession(odeParams['odeSessionId'], data);
            }
        });
    }

    /**
     * saveSession (legacy path - used when transitionToProject is not available)
     */
    async saveSession(odeParams, data) {
        // Handle Yjs-enabled projects: use SaveManager instead of legacy API
        const isYjsEnabled = eXeLearning?.app?.project?._yjsEnabled;
        const saveManager = eXeLearning?.app?.project?._yjsBridge?.saveManager;

        if (isYjsEnabled && saveManager) {
            try {
                const isStaticMode =
                    eXeLearning?.app?.capabilities?.storage?.remote === false &&
                    !window.electronAPI;

                if (data.newFile && isStaticMode) {
                    if (eXeLearning.app.project?.exportToElpxViaYjs) {
                        await eXeLearning.app.project.exportToElpxViaYjs({
                            saveAs: false,
                        });
                    }
                    this.close();
                    if (typeof window.newProject === 'function') {
                        window.newProject();
                    }
                    return;
                }

                // Save current project using Yjs SaveManager
                await saveManager.save();

                // Handle navigation based on action type
                if (data.openYjsProject && data.projectUuid) {
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    window.location.href = `${basePath}/workarea?project=${data.projectUuid}`;
                } else if (data.newFile) {
                    window.onbeforeunload = null;
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    try {
                        const createResp = await fetch(`${basePath}/api/project/create-quick`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ title: window._ ? _('Untitled') : 'Untitled' })
                        });
                        if (createResp.ok) {
                            const createData = await createResp.json();
                            window.location.href = `${basePath}/workarea?project=${createData.uuid}&new=1`;
                        } else {
                            window.location.href = `${basePath}/projects`;
                        }
                    } catch {
                        window.location.href = `${basePath}/projects`;
                    }
                } else if (data.openOdeFile) {
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
     * closeSession (legacy path)
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
