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

        // Remove existing modal if present
        this.hide();

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
     * @param {string} phase - Phase name: 'extracting', 'parsing', 'finalizing'
     */
    setProcessingPhase(phase) {
        if (!this.progressBar) return;

        this.currentPhase = 'processing';

        // Set indeterminate progress bar
        this.progressBar.classList.add('progress-bar-animated');
        this.progressBar.style.width = '100%';
        this.percentageText.textContent = '';

        const phaseMessages = {
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
        };

        const message = phaseMessages[phase] || {
            status: _('Processing...'),
            info: _('Please wait...'),
        };

        this.statusText.textContent = message.status;
        this.phaseText.textContent = message.info;
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
     */
    hide() {
        if (this.modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(this.modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }

            // Remove modal after animation
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.modal = null;
                this.progressBar = null;
                this.statusText = null;
                this.percentageText = null;
                this.phaseText = null;
            }, 300);
        }
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
