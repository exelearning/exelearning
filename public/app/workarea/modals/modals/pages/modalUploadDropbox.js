import Modal from '../modal.js';

export default class ModalUploadtodropbox extends Modal {
    constructor(manager) {
        let id = 'modalUploadToDropbox';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.confirmButtonDefaultText = _('Upload');
        this.cancelButtonDefaultText = _('Cancel');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
    }

    /**
     *
     * @param {*} files
     */

    show(files) {
        // Set title
        this.titleDefault = _('Upload to Dropbox');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.setBody(this.makeBodyHtml(files));
            this.setConfirmExec(() => {
                this.uploadFile();
            });
            this.modal.show();
        }, time);
    }

    /**
     * Generate html of body
     *
     * @param {*} files
     * @returns {String}
     */
    makeBodyHtml(files) {
        let element = document.createElement('div');
        element.append(this.makeElementBodyInfo());
        element.append(this.makeElementSelectDir(files));
        return element.innerHTML;
    }

    /**
     *
     * @returns {Node}
     */
    makeElementBodyInfo() {
        let element = document.createElement('p');
        element.innerHTML = _(
            'Select the Dropbox directory where the project will be uploaded:'
        );
        return element;
    }

    /**
     *
     * @param {*} files
     * @returns {Node}
     */
    makeElementSelectDir(files) {
        let selectList = document.createElement('select');
        selectList.id = 'dropbox-folders';
        let option = document.createElement('option');
        // Directory root
        option.value = null;
        option.text = _('Root');
        option.setAttribute('selected', 'selected');
        selectList.appendChild(option);
        // Sort the array of directories
        files.files.sort((a, b) =>
            a.name > b.name ? 1 : b.name > a.name ? -1 : 0
        );
        // All directories of root
        files.files.forEach((folder) => {
            //If there are no folders, the folder root still has to exist
            if (folder != null) {
                option = document.createElement('option');
                option.value = folder.id;
                option.text = folder.name;
                selectList.appendChild(option);
            }
        });
        return selectList;
    }

    /**
     *
     */
    async uploadFile() {
        let sessionId = eXeLearning.app.project.odeSession;
        let odeId = eXeLearning.app.project.odeId;
        let odeVersion = eXeLearning.app.project.odeVersion;
        let folderSelected = this.modalElementBody.querySelector(
            'select#dropbox-folders option:checked'
        );
        let folderId = folderSelected.value;
        let params = {
            folder: folderId,
            odeSessionId: sessionId,
            odeId: odeId,
            odeVersion: odeVersion,
        };
        let response = await eXeLearning.app.api.uploadFileDropbox(params);
        // Close this modal
        this.close();
        // Open alert modal
        setTimeout(() => {
            this.showUploadAlert(response);
        }, 300);
    }

    /**
     *
     * @param {*} response
     */
    showUploadAlert(response) {
        eXeLearning.app.modals.alert.show({
            title: response.status,
            body: response.statusMsg,
        });
    }
}
