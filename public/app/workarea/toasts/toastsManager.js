import Toast from './toasts/toast.js';
import ToastDefault from './toasts/generic/toastDefault.js';

export default class ToastManagement {
    constructor(app) {
        this.app = app;
        this.default = null;
    }

    /**
     *
     */
    init() {
        this.default = new ToastDefault(this);
    }

    /**
     * Get or create a toasts container inside a modal
     * @param {HTMLElement} modal - The modal element
     * @returns {HTMLElement} The toasts container
     */
    getOrCreateModalToastsContainer(modal) {
        let container = modal.querySelector('.modal-toasts-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toasts-container modal-toasts-container';
            // Insert at the beginning of modal-content
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.insertBefore(container, modalContent.firstChild);
            }
        }
        return container;
    }

    /**
     * Create and show a toast
     * @param {Object} data - Toast configuration
     * @param {string} [data.title] - Toast title
     * @param {string} [data.body] - Toast body content
     * @param {string} [data.icon] - Icon name (default: 'info')
     * @param {boolean} [data.error] - Apply error styling
     * @param {number} [data.remove] - Auto-remove after ms
     * @param {boolean} [data.modal] - Position toast inside the currently open modal
     * @returns {Toast} The created toast instance
     */
    createToast(data) {
        let tmpToastId = `tmp-toast-${eXeLearning.app.common.generateId()}`;
        let tmpToastElement = this.default.toastElement.cloneNode(true);
        tmpToastElement.id = tmpToastId;

        // Determine target container
        let container;
        if (data.modal) {
            // Find the currently open modal
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                container = this.getOrCreateModalToastsContainer(openModal);
            }
        }

        // Fallback to body container
        if (!container) {
            container = document.querySelector('body > .toasts-container');
        }

        container.append(tmpToastElement);
        let tmpToast = new Toast(this, tmpToastId);
        tmpToast.show(data);
        return tmpToast;
    }
}
