import Modal from '../modal.js';
import { scanBrokenAssetReferences, regenerate } from '../../../utils/RegenerateProjectService.js';

/**
 * Modal for regenerating a project as a clean .elpx file
 */
export default class ModalRegenerateProject extends Modal {
    constructor(manager) {
        const id = 'modalRegenerateProject';
        super(manager, id, undefined, false);
        this.confirmButton = this.modalElement.querySelector('button.btn.btn-primary');
    }

    /**
     * Build the modal body HTML
     * @returns {string}
     */
    buildBodyHtml() {
        return `
            <div class="regenerate-project-content">
                <p>${_('Export a clean copy of this project as a new .elpx file. The original project will not be modified.')}</p>
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="regenerate-flatten-resources">
                    <label class="form-check-label" for="regenerate-flatten-resources">
                        ${_('Flatten resources')}
                    </label>
                    <small class="form-text text-muted d-block">${_('Remove subfolders from asset paths, placing all files at root level.')}</small>
                    <small class="form-text text-warning d-block">${_('Warning: if files in different folders share the same name, they will be renamed, which may break embedded resources. Use with caution.')}</small>
                </div>
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="regenerate-check-broken">
                    <label class="form-check-label" for="regenerate-check-broken">
                        ${_('Check for broken references')}
                    </label>
                    <small class="form-text text-muted d-block">${_('Scan content for asset references that no longer exist.')}</small>
                </div>
                <div id="regenerate-warnings" class="d-none mb-3"></div>
                <div id="regenerate-progress" class="d-none">
                    <div class="d-flex align-items-center">
                        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                        <span>${_('Generating file...')}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show the modal
     */
    show() {
        this.titleDefault = _('Regenerate project');
        const time = this.manager.closeModals() ? 500 : 50;

        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.setBody(this.buildBodyHtml());

            if (this.confirmButton) {
                this.confirmButton.disabled = false;
                this.confirmButton.textContent = _('Regenerate');
            }

            this.setConfirmExec(() => this.onConfirm());

            this.modal.show();
        }, time);
    }

    /**
     * Handle confirm button click
     */
    async onConfirm() {
        this.preventCloseModal = true;

        const flattenResources = this.modalElement.querySelector('#regenerate-flatten-resources')?.checked || false;
        const checkBroken = this.modalElement.querySelector('#regenerate-check-broken')?.checked || false;

        const warningsArea = this.modalElement.querySelector('#regenerate-warnings');
        const progressArea = this.modalElement.querySelector('#regenerate-progress');

        // Step 1: Check for broken references if requested
        if (checkBroken) {
            try {
                const brokenRefs = scanBrokenAssetReferences();
                if (brokenRefs.length > 0) {
                    const alreadyWarned = warningsArea?.classList.contains('user-confirmed');
                    if (!alreadyWarned) {
                        this.showBrokenWarnings(warningsArea, brokenRefs);
                        return; // Wait for user to click Regenerate again
                    }
                }
            } catch (error) {
                console.error('[ModalRegenerateProject] Broken reference scan failed:', error);
            }
        }

        // Step 2: Regenerate
        try {
            if (this.confirmButton) this.confirmButton.disabled = true;
            if (progressArea) progressArea.classList.remove('d-none');

            await regenerate({ flattenResources });

            this.preventCloseModal = false;
            this.close(true);

            eXeLearning.app.alerts.showToast({
                type: 'success',
                message: _('Project regenerated successfully'),
            });
        } catch (error) {
            console.error('[ModalRegenerateProject] Regeneration failed:', error);
            eXeLearning.app.alerts.showToast({
                type: 'error',
                message: _('Error regenerating project') + ': ' + error.message,
            });
            this.preventCloseModal = false;
            if (this.confirmButton) this.confirmButton.disabled = false;
            if (progressArea) progressArea.classList.add('d-none');
        }
    }

    /**
     * Show broken reference warnings in the modal
     * @param {HTMLElement} warningsArea
     * @param {Array} brokenRefs
     */
    showBrokenWarnings(warningsArea, brokenRefs) {
        if (!warningsArea) return;

        let html = `<div class="alert alert-warning">`;
        html += `<strong>${_('Broken references found')} (${brokenRefs.length}):</strong>`;
        html += `<ul class="mb-0 mt-1" style="max-height: 200px; overflow-y: auto;">`;

        for (const ref of brokenRefs) {
            html += `<li><code>${this.escapeHtml(ref.assetUrl)}</code> — ${this.escapeHtml(ref.pageName)} (${this.escapeHtml(ref.ideviceType)})</li>`;
        }

        html += `</ul>`;
        html += `<p class="mt-2 mb-0"><small>${_('These references will remain in the regenerated file. Click Regenerate again to proceed.')}</small></p>`;
        html += `</div>`;

        warningsArea.innerHTML = html;
        warningsArea.classList.remove('d-none');
        warningsArea.classList.add('user-confirmed');
    }

    /**
     * Escape HTML special characters
     * @param {string} str
     * @returns {string}
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
}
