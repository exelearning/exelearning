/**
 * Modal for displaying upload and processing progress for large files
 */
export default class ModalUploadProgress {
    constructor(modalsContainer) {
        this.modalsContainer = modalsContainer;
        this.modal = null;
        this.progressBar = null;
        this.statusText = null;
        this.currentPhase = null;
    }

    /**
     * Create and show the progress modal
     * @param {Object} options - Configuration options
     * @param {string} options.fileName - Name of the file being processed
     * @param {number} options.fileSize - Size of the file in bytes
     */
    show(options = {}) {
        const { fileName = 'archivo', fileSize = 0 } = options;

        // Remove existing modal if present (synchronous cleanup)
        if (this.modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(this.modal);
            if (bootstrapModal) {
                bootstrapModal.dispose();
            }
            if (this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.modal = null;
            this.progressBar = null;
            this.statusText = null;
            this.percentageText = null;
            this.phaseText = null;
        }

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="uploadProgressModal" tabindex="-1" role="dialog"
                 aria-labelledby="uploadProgressModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="uploadProgressModalLabel">
                                ${_('Processing file')}
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="upload-file-name text-truncate" style="max-width: 70%;" title="${fileName}">
                                        <strong>${fileName}</strong>
                                    </span>
                                    <span class="upload-file-size text-muted">
                                        ${this.formatFileSize(fileSize)}
                                    </span>
                                </div>
                            </div>

                            <div class="mb-3">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="upload-status-text">${_('Preparing upload...')}</span>
                                    <span class="upload-percentage">0%</span>
                                </div>
                                <div class="progress" style="height: 24px;">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated"
                                         role="progressbar"
                                         style="width: 0%;"
                                         aria-valuenow="0"
                                         aria-valuemin="0"
                                         aria-valuemax="100">
                                    </div>
                                </div>
                            </div>

                            <div class="upload-phase-info mt-3 p-3 bg-light rounded">
                                <small class="text-muted upload-phase-text">
                                    ${_('This may take a few moments for large files...')}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to container
        const div = document.createElement('div');
        div.innerHTML = modalHTML.trim();
        this.modal = div.firstChild;
        this.modalsContainer.appendChild(this.modal);

        // Get references to elements
        this.progressBar = this.modal.querySelector('.progress-bar');
        this.statusText = this.modal.querySelector('.upload-status-text');
        this.percentageText = this.modal.querySelector('.upload-percentage');
        this.phaseText = this.modal.querySelector('.upload-phase-text');

        // Show modal
        const bootstrapModal = new bootstrap.Modal(this.modal);
        bootstrapModal.show();

        return this;
    }

    /**
     * Update upload progress
     * @param {number} percentage - Progress percentage (0-100)
     * @param {number} uploadedBytes - Number of bytes uploaded
     * @param {number} totalBytes - Total bytes to upload
     */
    updateUploadProgress(percentage, uploadedBytes = 0, totalBytes = 0) {
        if (!this.progressBar) return;

        const progress = Math.min(100, Math.max(0, percentage));

        this.progressBar.style.width = `${progress}%`;
        this.progressBar.setAttribute('aria-valuenow', progress);

        this.percentageText.textContent = `${Math.round(progress)}%`;

        if (uploadedBytes > 0 && totalBytes > 0) {
            this.statusText.textContent = `${_('Uploading')}: ${this.formatFileSize(uploadedBytes)} / ${this.formatFileSize(totalBytes)}`;
        } else {
            this.statusText.textContent = _('Uploading file...');
        }

        this.currentPhase = 'upload';
    }

    /**
     * Set processing phase (extraction, parsing, etc.)
     * @param {string} phase - Phase name: 'extracting', 'parsing', 'finalizing', 'savingProject', 'uploadingAssets', 'savingComplete'
     */
    setProcessingPhase(phase) {
        if (!this.progressBar) return;

        this.currentPhase = 'processing';

        // Set indeterminate progress bar
        this.progressBar.classList.add('progress-bar-animated');
        this.progressBar.style.width = '100%';
        this.percentageText.textContent = '';

        const phaseMessages = {
            // Upload phases
            extracting: {
                status: _('Extracting files...'),
                info: _(
                    'Extracting ZIP file contents. This may take several minutes for large files.'
                ),
            },
            parsing: {
                status: _('Processing content...'),
                info: _('Reading and validating file structure. Almost done!'),
            },
            finalizing: {
                status: _('Finalizing...'),
                info: _('Completing the process...'),
            },
            // Save phases
            savingProject: {
                status: _('Saving project...'),
                info: _('Saving document structure to server...'),
            },
            uploadingAssets: {
                status: _('Uploading assets...'),
                info: _('Uploading images and files to server...'),
            },
            savingComplete: {
                status: _('Save complete!'),
                info: _('All changes have been saved successfully.'),
            },
        };

        const message = phaseMessages[phase] || {
            status: _('Processing...'),
            info: _('Please wait...'),
        };

        this.statusText.textContent = message.status;
        this.phaseText.textContent = message.info;
    }

    /**
     * Update asset upload progress
     * @param {number} current - Current asset index (1-based)
     * @param {number} total - Total number of assets
     * @param {number} uploadedBytes - Bytes uploaded so far
     * @param {number} totalBytes - Total bytes to upload
     */
    setAssetUploadProgress(current, total, uploadedBytes = 0, totalBytes = 0) {
        if (!this.progressBar) return;

        this.currentPhase = 'uploadingAssets';

        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

        this.progressBar.classList.add('progress-bar-animated', 'progress-bar-striped');
        this.progressBar.style.width = `${percentage}%`;
        this.progressBar.setAttribute('aria-valuenow', percentage);
        this.percentageText.textContent = `${percentage}%`;

        // Status text with asset count
        if (totalBytes > 0) {
            this.statusText.textContent = `${_('Uploading asset')} ${current}/${total} (${this.formatFileSize(uploadedBytes)}/${this.formatFileSize(totalBytes)})`;
        } else {
            this.statusText.textContent = `${_('Uploading asset')} ${current}/${total}`;
        }

        this.phaseText.textContent = _('Uploading images and files to server...');
    }

    /**
     * Show the modal in save mode
     * @param {Object} options - Configuration options
     * @param {string} options.projectTitle - Name of the project being saved
     */
    showSaveMode(options = {}) {
        const { projectTitle = 'project' } = options;

        // Remove existing modal if present
        if (this.modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(this.modal);
            if (bootstrapModal) {
                bootstrapModal.dispose();
            }
            if (this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.modal = null;
        }

        // Create modal HTML for save mode
        const modalHTML = `
            <div class="modal fade" id="uploadProgressModal" tabindex="-1" role="dialog"
                 aria-labelledby="uploadProgressModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="uploadProgressModalLabel">
                                ${_('Saving project')}
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="upload-file-name text-truncate" style="max-width: 100%;" title="${projectTitle}">
                                        <strong>${projectTitle}</strong>
                                    </span>
                                </div>
                            </div>

                            <div class="mb-3">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="upload-status-text">${_('Preparing...')}</span>
                                    <span class="upload-percentage"></span>
                                </div>
                                <div class="progress" style="height: 24px;">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated"
                                         role="progressbar"
                                         style="width: 100%;"
                                         aria-valuenow="0"
                                         aria-valuemin="0"
                                         aria-valuemax="100">
                                    </div>
                                </div>
                            </div>

                            <div class="upload-phase-info mt-3 p-3 bg-light rounded">
                                <small class="text-muted upload-phase-text">
                                    ${_('Preparing to save your project...')}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to container
        const div = document.createElement('div');
        div.innerHTML = modalHTML.trim();
        this.modal = div.firstChild;
        this.modalsContainer.appendChild(this.modal);

        // Get references to elements
        this.progressBar = this.modal.querySelector('.progress-bar');
        this.statusText = this.modal.querySelector('.upload-status-text');
        this.percentageText = this.modal.querySelector('.upload-percentage');
        this.phaseText = this.modal.querySelector('.upload-phase-text');

        // Show modal
        const bootstrapModal = new bootstrap.Modal(this.modal);
        bootstrapModal.show();

        return this;
    }

    /**
     * Show completion status
     * @param {boolean} success - Whether the operation was successful
     * @param {string} message - Optional custom message
     * @param {boolean} autoHide - Auto-hide after showing completion (default: false)
     */
    setComplete(success, message = null, autoHide = false) {
        if (!this.progressBar) return;

        this.progressBar.classList.remove(
            'progress-bar-animated',
            'progress-bar-striped'
        );

        if (success) {
            this.progressBar.classList.add('bg-success');
            this.progressBar.style.width = '100%';
            this.statusText.textContent =
                message || _('Completed successfully');
            this.percentageText.textContent = '100%';
        } else {
            this.progressBar.classList.add('bg-danger');
            this.statusText.textContent = message || _('Error processing file');
        }

        // Auto-hide only if requested
        if (success && autoHide) {
            setTimeout(() => {
                this.hide();
            }, 2000);
        }
    }

    /**
     * Show error state
     * @param {string} errorMessage - Error message to display
     */
    showError(errorMessage) {
        this.setComplete(false, errorMessage);
    }

    /**
     * Hide and remove the modal
     * Returns a Promise that resolves when Bootstrap has fully hidden the modal
     * @returns {Promise<void>}
     */
    hide() {
        return new Promise((resolve) => {
            const cleanup = () => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.modal = null;
                this.progressBar = null;
                this.statusText = null;
                this.percentageText = null;
                this.phaseText = null;
            };

            if (this.modal) {
                const modalElement = this.modal;
                const bootstrapModal = bootstrap.Modal.getInstance(modalElement);

                if (bootstrapModal) {
                    let resolved = false;

                    // Safety timeout in case Bootstrap event never fires
                    const timeoutId = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            console.warn('[ModalUploadProgress] Bootstrap hidden event timeout, forcing cleanup');
                            modalElement.removeEventListener('hidden.bs.modal', onHidden);
                            // Force hide the modal manually
                            modalElement.classList.remove('show');
                            modalElement.style.display = 'none';
                            modalElement.setAttribute('aria-hidden', 'true');
                            // Clean up backdrop and body class
                            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                            if (!document.querySelector('.modal.show')) {
                                document.body.classList.remove('modal-open');
                            }
                            cleanup();
                            resolve();
                        }
                    }, 500); // 500ms should be enough for the animation

                    const onHidden = () => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeoutId);
                            cleanup();
                            resolve();
                        }
                    };

                    modalElement.addEventListener('hidden.bs.modal', onHidden, { once: true });
                    bootstrapModal.hide();
                } else {
                    // No Bootstrap instance, clean up directly
                    cleanup();
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    /**
     * Format bytes to human-readable size
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
        );
    }
}
