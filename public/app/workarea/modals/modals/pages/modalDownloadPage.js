import Modal from '../modal.js';

const EXPORT_OPTIONS = [
    { value: 'elpx', labelKey: 'eXeLearning content (elpx)' },
    { value: 'website', labelKey: 'Website' },
    { value: 'single-page', labelKey: 'Single page' },
    { value: 'scorm12', labelKey: 'SCORM 1.2' },
    { value: 'ims', labelKey: 'IMS CP' },
    { value: 'epub3', labelKey: 'ePub3' },
];

export default class ModalDownloadPage extends Modal {
    constructor(manager) {
        super(manager, 'modalDownloadPage', undefined, false);

        this.selectElement = this.modalElement.querySelector(
            '#download-page-format'
        );
        this.pageTitleElement = this.modalElement.querySelector(
            '.download-page-title'
        );
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );

        this.nodeId = null;

        this.confirmButton.addEventListener('click', () => {
            this.onConfirm();
        });
        this.cancelButton.addEventListener('click', () => {
            this.modal.hide();
        });

        this.renderOptions();
    }

    renderOptions() {
        this.selectElement.innerHTML = '';
        EXPORT_OPTIONS.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = _(opt.labelKey);
            this.selectElement.append(option);
        });
    }

    show(data = {}) {
        this.titleDefault = _('Download page');
        const { nodeId = null, pageTitle = '', defaultFormat = 'elpx' } = data;
        this.nodeId = nodeId;

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;

        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.pageTitleElement.textContent = pageTitle || '';
            this.selectElement.value = defaultFormat;
            this.modal.show();
            this.selectElement.focus();
        }, time);
    }

    onConfirm() {
        const format = this.selectElement.value;
        const detail = {
            nodeId: this.nodeId,
            format,
        };
        document.dispatchEvent(
            new CustomEvent('nav:download-page:confirm', { detail })
        );
        this.modal.hide();
    }
}
