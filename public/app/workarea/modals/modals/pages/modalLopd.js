import Modal from '../modal.js';

export default class ModalLopd extends Modal {
    constructor(manager) {
        let id = 'modalLopd';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.confirmButtonDefaultText = _('Accept');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.permanent = true;
    }

    /**
     *
     * @param {*} data
     */
    show() {
        // Set title
        this.titleDefault = 'eXeLearning';
        this.setTitle(this.titleDefault);
        this.setConfirmExec(() => {
            this.setLopdAccepted();
        });
        // We prevent users from being able to close the modal
        this.modal._config.keyboard = false;
        this.modal._config.backdrop = 'static';
        // Display modal
        this.modal.show();
    }

    /**
     *
     */
    setLopdAccepted() {
        this.manager.app.api.postUserSetLopdAccepted().then((response) => {
            if (response.responseMessage == 'OK') {
                this.loadProjectLopdAccepted();
                this.close();
            }
        });
    }

    /**
     *
     */
    async loadProjectLopdAccepted() {
        await eXeLearning.app.loadProject();
        // Show node-content-container
        document.querySelector('#node-content-container').style.display = '';
        // Check for errors
        eXeLearning.app.check();
    }

    /**
     *
     */
    confirm() {
        if (this.confirmExec) {
            this.confirmExec.call();
        }
    }
}
