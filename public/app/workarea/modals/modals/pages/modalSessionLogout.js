import Modal from '../modal.js';
import RealTimeEventNotifier from '../../../../RealTimeEventNotifier/RealTimeEventNotifier.js';

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
        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;

        if (!this.offlineInstallation) {
            this.realTimeEventNotifier = new RealTimeEventNotifier(
                eXeLearning.mercure.url,
                eXeLearning.mercure.jwtSecretKey
            );
        }
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
     * saveSessionEventListener
     *
     * @param {*} saveSessionButton
     */
    saveSessionEventListener(saveSessionButton, data) {
        saveSessionButton.addEventListener('click', () => {
            let odeParams = [];

            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;
            odeParams['odeVersion'] = eXeLearning.app.project.odeVersion;
            odeParams['odeId'] = eXeLearning.app.project.odeId;

            this.saveSession(odeParams, data);
            this.close();
        });
    }

    /**
     * notSaveSessionEventListener
     *
     * @param {*} notSaveSessionButton
     */
    notSaveSessionEventListener(notSaveSessionButton, data) {
        notSaveSessionButton.addEventListener('click', () => {
            let odeParams = [];
            odeParams['odeSessionId'] = eXeLearning.app.project.odeSession;

            if (data.openOdeFile) {
                if (data.localOdeFile) {
                    eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession(
                        data.odeFileName,
                        data.odeFilePath
                    );
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
                        eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession(
                            data.odeFileName,
                            data.odeFilePath
                        );
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
        console.log('asdjhjkaslhdkjashkjda');
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
