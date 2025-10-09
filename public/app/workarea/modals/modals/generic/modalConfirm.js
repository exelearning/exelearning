import Modal from '../modal.js';

export default class ModalConfirm extends Modal {
    constructor(manager) {
        let id = 'modalConfirm';
        let titleDefault;
        super(manager, id, titleDefault, true);
        this.confirmButtonDefaultText = _('Yes');
        this.cancelButtonDefaultText = _('No');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.button-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.cancel.btn.button-tertiary'
        );
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('Confirm');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            let title = data.title ? data.title : this.titleDefault;
            let contentId = data.contentId ? data.contentId : null;
            let body = data.body ? data.body : '';
            let confirmButtonText = data.confirmButtonText
                ? data.confirmButtonText
                : this.confirmButtonDefaultText;
            let cancelButtonText = data.cancelButtonText
                ? data.cancelButtonText
                : this.cancelButtonDefaultText;
            let confirmExec = data.confirmExec ? data.confirmExec : null;
            let cancelExec = data.cancelExec ? data.cancelExec : null;
            let closeExec = data.closeExec ? data.closeExec : null;
            let behaviour = data.behaviour ? data.behaviour : null;
            let focusFirstInputText = data.focusFirstInputText
                ? data.focusFirstInputText
                : null;
            let focusCancelButton = data.focusCancelButton
                ? data.focusCancelButton
                : null;
            // Set params
            this.setTitle(title);
            this.setContentId(contentId);
            this.setBody(body);
            this.setConfirmButtonText(confirmButtonText);
            this.setCancelButtonText(cancelButtonText);
            this.setConfirmExec(confirmExec);
            this.setCancelExec(cancelExec);
            this.setCloseExec(closeExec);
            // Show modal
            this.modal.show();
            // Add default behaviour to text inputs
            setTimeout(() => {
                this.addBehaviourTextInputs();
            }, this.timeMax);
            // Set behaviour param
            if (behaviour) {
                behaviour.call();
            }
            // Focus
            if (focusFirstInputText) {
                // Focus first input text
                setTimeout(() => {
                    this.focusTextInput(
                        this.modalElementBody.querySelector('input[type="text"')
                    );
                }, this.timeMax);
            } else if (focusCancelButton) {
                // Focus cancel button
                setTimeout(() => {
                    this.cancelButton.focus();
                }, this.timeMax);
            } else {
                // Focus confirm button
                setTimeout(() => {
                    this.confirmButton.focus();
                }, this.timeMax);
            }
        }, time);
    }

    /**
     *
     * @param {*} buttonText
     */
    setConfirmButtonText(buttonText) {
        this.confirmButton.innerHTML = buttonText;
    }

    /**
     *
     * @param {*} buttonText
     */
    setCancelButtonText(buttonText) {
        this.cancelButton.innerHTML = buttonText;
    }

    /**
     * Add event keyup to all text inputs
     *
     */
    addBehaviourTextInputs() {
        // Press enter to confirm in text inputs
        if (this.confirmExec) {
            this.modalElementBody
                .querySelectorAll('input[type="text"]')
                .forEach((input) => {
                    input.addEventListener('keyup', (event) => {
                        event.preventDefault();
                        if (event.key == 'Enter') {
                            this.confirm();
                        }
                    });
                });
        }
    }

    /**
     * Focus input text element
     *
     * @param {*} input
     */
    focusTextInput(input) {
        if (input) {
            input.focus();
            let inputElementValue = input.value;
            input.value = '';
            input.value = inputElementValue;
        }
    }
}
