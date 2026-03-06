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
        window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
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

            // Online mode: save + transition via full reload
            const pendingAction = data.pendingAction;
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

            // Pure logout with save: save and redirect
            this.close();
            try {
                const saveManager = eXeLearning.app.project?._yjsBridge?.saveManager;
                if (saveManager) {
                    await saveManager.save();
                }
            } catch (error) {
                console.error('[SessionLogout] Error saving before logout:', error);
            }
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
            window.onbeforeunload = null;
            const basePath = window.eXeLearning?.config?.basePath || '';
            window.location.href = `${basePath}/logout`;
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

            // Online mode: transition without save
            const pendingAction = data.pendingAction;
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

            // Pure logout without save: redirect
            this.close();
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
            window.onbeforeunload = null;
            const basePath = window.eXeLearning?.config?.basePath || '';
            window.location.href = `${basePath}/logout`;
        });
    }
}
