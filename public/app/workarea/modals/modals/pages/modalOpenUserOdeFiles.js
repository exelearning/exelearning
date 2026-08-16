import Modal from '../modal.js';
import ImportProgress from '../../../interface/importProgress.js';
import { isImportCancelled } from '../../../interface/importResult.js';
import { ProjectListRenderMixin } from './projectListRender.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class modalOpenUserOdeFiles extends ProjectListRenderMixin(Modal) {
    constructor(manager) {
        super(manager, 'modalOpenUserOdeFiles', undefined, false);

        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        this.modalFooterContent =
            this.modalElement.querySelector('.modal-footer');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );

        this.odeFiles = [];
        this.uploadLimits = null; // Cache for upload limits
        this.allOdeFilesData = null; // Store all projects data for tab filtering
        this.currentTab = 'my-projects'; // Current active tab
        this.selectedProjectUuid = null; // Currently selected project UUID
        this.folders = []; // Caller's personal dashboard folders ({uuid, name, projectCount})
        this.currentFolderUuid = null; // null = "All projects"
        this.UNFILED_FOLDER_VALUE = '__unfiled__'; // Sentinel for the "Unfiled" filter option
        this.folderTreeContainer = null;
        this.expandedFolderUuids = new Set(); // Folder uuids currently expanded in the tree
        this._openFolderPicker = null;

        // Load upload limits when modal is created
        this.loadUploadLimits();
    }

    /**
     * Load upload limits from server
     * This is cached to avoid repeated API calls
     * In static mode, uses default limits (no backend API)
     */
    async loadUploadLimits() {
        // Skip API call in static mode
        if (eXeLearning.app?.capabilities?.storage?.remote === false) {
            this.uploadLimits = {
                maxFileSize: 100 * 1024 * 1024, // 100MB default
                maxFileSizeFormatted: '100 MB',
            };
            return;
        }

        try {
            this.uploadLimits = await eXeLearning.app.api.getUploadLimits();
        } catch (error) {
            console.error('Failed to load upload limits:', error);
            // Set a reasonable default if API call fails
            this.uploadLimits = {
                maxFileSize: 100 * 1024 * 1024, // 100MB default
                maxFileSizeFormatted: '100 MB',
            };
        }
    }

    /**
     * Validate file size before upload
     *
     * @param {File} file - The file to validate
     * @returns {boolean} - true if file is valid, false otherwise
     */
    validateFileSize(file) {
        if (!this.uploadLimits) {
            console.warn('Upload limits not loaded yet, skipping validation');
            return true; // Allow upload if limits not loaded yet
        }

        if (file.size > this.uploadLimits.maxFileSize) {
            const fileSizeFormatted = this.formatBytes(file.size);
            const errorMessage = _(
                'File size ({fileSize}) exceeds the maximum allowed size ({maxSize}).'
            )
                .replace('{fileSize}', fileSizeFormatted)
                .replace('{maxSize}', this.uploadLimits.maxFileSizeFormatted);

            eXeLearning.app.modals.alert.show({
                title: _('File too large'),
                body: errorMessage,
                contentId: 'error',
            });

            return false;
        }

        return true;
    }

    /**
     * Format bytes to human-readable format
     *
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size (e.g., "512 MB")
     */
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        bytes = Math.max(bytes, 0);
        const pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
        const powCapped = Math.min(pow, units.length - 1);
        const value = bytes / Math.pow(1024, powCapped);

        return `${value.toFixed(2)} ${units[powCapped]}`;
    }

    show(data = {}) {
        this.titleDefault = _('Open project');
        this.odeFiles = [];
        this.removeDeleteButtonFooter(this.odeFiles);
        this.currentTab = 'my-projects'; // Reset to default tab
        this.selectedProjectUuid = null; // Reset selection
        this.currentFolderUuid = null; // Reset folder filter to "All projects"

        // Disable Open button until a project is selected
        this.confirmButton.disabled = true;
        this.confirmButton.classList.add('disabled');

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        this.modalElementBodyContent.innerHTML = '';
        setTimeout(() => {
            data = data || {};
            this.setTitle(this.titleDefault);

            // Store all projects data for tab filtering
            this.allOdeFilesData = data['odeFiles'];
            this.folders = this.allOdeFilesData?.folders || [];

            this.setBodyElement(this.makeFolderSidebar());
            const modalActions = this.makeModalActions();
            this.setBodyElement(modalActions);
            const bodyContent = this.makeElementListOdeFiles(this.allOdeFilesData);
            this.setBodyElement(bodyContent);

            const footerContent = this.makeFooterElement(data);
            if (eXeLearning.config.isOfflineInstallation === false) {
                this.setFooterElement(footerContent);
            }
            this.modal.show();
            // Typeset LaTeX in project titles after modal is shown
            this.typesetTitles();
        }, time);
    }

    setBodyElement(bodyElement) {
        this.modalElementBodyContent.append(bodyElement);
    }

    setFooterElement(footerElement) {
        const firstChild =
            this.modalFooterContent.querySelector('.btn-primary');
        const old = this.modalFooterContent.querySelector('.progress-bar-div');
        if (old) old.remove();
        this.modalFooterContent.insertBefore(footerElement, firstChild);
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    makeModalActions() {
        const modalActions = document.createElement('div');
        modalActions.classList.add('modal-actions');

        // Add tabs for "My Projects" and "Shared with me"
        const tabsContainer = this.makeProjectTabs();
        modalActions.append(tabsContainer);

        modalActions.append(
            this.makeFilterForList('.ode-title', _('Search saved projects...'))
        );
        modalActions.append(this.makeUploadInput());
        return modalActions;
    }

    makeFooterElement(data) {
        return this.showFreeDiskSpace(data['odeFiles']);
    }

    showFreeDiskSpace(data) {
        const progressBarDiv = document.createElement('div');
        const fullBarDiv = document.createElement('div');
        const textElementBarDiv = document.createElement('p');
        fullBarDiv.classList.add('progress-bar-div');

        // Handle case where disk space info is not available (Yjs projects)
        if (!data || !data.maxDiskSpaceFormatted || data.maxDiskSpace === 0) {
            // Return empty element - disk space not applicable for Yjs architecture
            return fullBarDiv;
        }

        const maxValue = data.maxDiskSpaceFormatted;
        const valueNow = data.usedSpaceFormatted;
        const percentage = (data.usedSpace * 100) / data.maxDiskSpace;

        progressBarDiv.classList.add('progress');

        let baseBarText = _('%s of %s used');
        baseBarText = baseBarText.replace('%s', valueNow);
        baseBarText = baseBarText.replace('%s', maxValue);
        textElementBarDiv.innerHTML = baseBarText;

        textElementBarDiv.append(progressBarDiv);
        fullBarDiv.appendChild(textElementBarDiv);

        const progressBar = this.makeProgressBar(
            maxValue,
            valueNow,
            percentage
        );
        progressBarDiv.appendChild(progressBar);

        return fullBarDiv;
    }

    makeProgressBar(maxValue, valueNow, percentage) {
        const progressBar = document.createElement('div');
        if (percentage > 85) {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-danger'
            );
        } else if (percentage > 50) {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-warning'
            );
        } else {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-success'
            );
        }
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('style', 'width:' + percentage + '%');
        progressBar.setAttribute('aria-valuenow', valueNow);
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', maxValue);
        return progressBar;
    }

    openSelectedOdeFile() {
        const selected = this.modalElementBody.querySelector(
            '.ode-row.selected .ode-file-title'
        );
        const odeFileName = selected ? selected.id : null;
        if (odeFileName) {
            setTimeout(
                () => this.openUserOdeFilesEvent(odeFileName),
                this.timeMax
            );
        }
    }

    /**
     * Enable the "Open" confirm button when a project becomes selected
     * (overrides ProjectListRenderMixin's no-op default — "Gestionar
     * proyectos" has no "Open" role for its confirm button, so it doesn't
     * need to override this).
     * @param {string} _projectUuid
     */
    _onProjectSelected(_projectUuid) {
        this.confirmButton.disabled = false;
        this.confirmButton.classList.remove('disabled');
    }

    /**
     * Restore the confirm button to "Open" (overrides
     * ProjectListRenderMixin's safe default of just disabling it).
     */
    _resetConfirmButtonToDefault() {
        this.confirmButton.innerHTML = _('Open');
        this.setConfirmExec(() => this.openSelectedOdeFile());
        if (!this.selectedProjectUuid) {
            this.confirmButton.disabled = true;
            this.confirmButton.classList.add('disabled');
        }
    }

    async openUserOdeFilesWithOpenSession(id) {
        const params = {
            elpFileName: id,
            forceCloseOdeUserPreviousSession: '1',
            odeSessionId: eXeLearning.app.project.odeSession,
        };
        const response = await eXeLearning.app.api.postSelectedOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            await eXeLearning.app.project.openLoad();
            this.loadOdeTheme(response);
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage || _('An error occurred while opening the file.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    makeUploadInput() {
        const uploadDiv = document.createElement('div');
        uploadDiv.id = 'local-ode-file-upload-div';

        const inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input', 'd-none');
        inputUpload.type = 'file';
        inputUpload.name = 'local-ode-file-upload';
        inputUpload.id = 'local-ode-modal-file-upload';
        inputUpload.accept = '.' + eXeLearning.extension + ',.elpx,.elp,.zip,.epub';
        inputUpload.addEventListener('change', () => {
            const file = inputUpload.files[0];
            if (file) {
                // Validate file size BEFORE attempting upload
                if (!this.validateFileSize(file)) {
                    // Clear the input so user can select a different file
                    inputUpload.value = '';
                    return;
                }
                this.largeFilesUpload(file);
            }
        });

        let label = document.createElement('label');
        label.setAttribute('for', inputUpload.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Upload iDevice file');

        const buttonUpload = document.createElement('button');
        buttonUpload.classList.add(
            'ode-files-button-upload',
            'btn',
            'button-secondary',
            'd-flex',
            'align-items-center',
            'justify-content-start'
        );
        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'import-icon');
        buttonUpload.append(icon, _('Select a file from your device'));
        buttonUpload.addEventListener('click', () => inputUpload.click());

        const inputMultiple = document.createElement('input');
        inputMultiple.classList.add(
            'multiple-local-ode-file-upload-input',
            'd-none'
        );
        inputMultiple.type = 'file';
        inputMultiple.multiple = true;
        inputMultiple.name = 'multiple-local-ode-file-upload';
        inputMultiple.id = 'multiple-local-modal-ode-file-upload';
        inputMultiple.accept = '.elpx,.elp,.zip';
        inputMultiple.addEventListener('change', () => {
            if (inputMultiple.files?.length) {
                // Validate each file size BEFORE attempting upload
                const invalidFiles = [];
                for (const file of inputMultiple.files) {
                    if (!this.validateFileSize(file)) {
                        invalidFiles.push(file.name);
                    }
                }

                if (invalidFiles.length > 0) {
                    // Clear the input so user can select different files
                    inputMultiple.value = '';
                    return;
                }

                this.uploadOdeFilesToServer(inputMultiple.files);
            }
        });

        let labelMultiple = document.createElement('label');
        labelMultiple.setAttribute('for', inputMultiple.id);
        labelMultiple.classList.add('visually-hidden');
        labelMultiple.textContent = _('Upload iDevice file');

        uploadDiv.append(
            label,
            inputUpload,
            labelMultiple,
            inputMultiple,
            buttonUpload
        );
        return uploadDiv;
    }

    async largeFilesUpload(
        odeFile,
        isImportIdevices = false,
        isImportProperties = false,
        skipSessionCheck = false,
        forceCloseSession = false
    ) {
        let response = [];
        let odeFileName = odeFile.name;

        if (isImportIdevices) {
            if (
                !odeFileName.includes('.idevice') &&
                !odeFileName.includes('.block')
            ) {
                return setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _('The content is not a box or an iDevice'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            }

            // === CLIENT-SIDE IMPORT: Process .idevice/.block files directly in browser ===
            try {
                Logger.log(`[ComponentImport] Importing ${odeFileName} client-side...`);

                // Get document manager and asset manager from Yjs bridge
                const documentManager = eXeLearning.app.project._yjsBridge?.getDocumentManager();
                const assetManager = eXeLearning.app.project._yjsBridge?.assetManager;

                if (!documentManager) {
                    throw new Error('Yjs document manager not available');
                }

                // Create ComponentImporter instance
                const ComponentImporter = window.ComponentImporter;
                if (!ComponentImporter) {
                    throw new Error('ComponentImporter not loaded');
                }

                const importer = new ComponentImporter(documentManager, assetManager);

                // Get current page ID from selected node
                const currentPageId = eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected?.getAttribute('nav-id');
                if (!currentPageId) {
                    throw new Error('No page selected');
                }

                // Close modal before processing
                if (this.modal && this.modal._isShown) {
                    this.close();
                }

                // Import the component file
                const result = await importer.importComponent(odeFile, currentPageId);

                if (result.success) {
                    Logger.log(`[ComponentImport] Import successful, block ID: ${result.blockId}`);
                    // Preload assets into cache so they're available for sync resolution
                    // This ensures images display immediately without needing page refresh
                    await assetManager.preloadAllAssets();
                    // Refresh only the page content (blocks/idevices) - stays on current page
                    await eXeLearning.app.project.idevices.loadApiIdevicesInPage(true);
                } else {
                    throw new Error(result.error || 'Import failed');
                }

                return; // Skip the server upload flow
            } catch (error) {
                console.error('[ComponentImport] Client-side import failed:', error);
                setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: error.message || _('An error occurred while importing the component.'),
                        contentId: 'error',
                    });
                }, this.timeMax);
                return;
            }
            // === END CLIENT-SIDE IMPORT ===
        }

        const hasPreUploadedData =
            skipSessionCheck &&
            forceCloseSession &&
            odeFile &&
            odeFile._preUploadedOdeData &&
            odeFile._preUploadedOdeData.odeFileName &&
            odeFile._preUploadedOdeData.odeFilePath;

        if (hasPreUploadedData) {
            if (this.modal && this.modal._isShown) {
                this.close();
            }

            const progressModal = eXeLearning.app.modals.uploadprogress;
            progressModal.show({
                fileName: odeFile.name,
                fileSize: odeFile.size,
            });
            progressModal.setProcessingPhase('extracting');

            await this.openLocalElpFile(
                odeFile._preUploadedOdeData.odeFileName,
                odeFile._preUploadedOdeData.odeFilePath,
                isImportIdevices,
                progressModal,
                forceCloseSession,
                odeFile
            );
            this.ensureModalBackdropCleared(350);

            return;
        }

        // Check for unsaved changes BEFORE processing (only for ELP files, not imports)
        if (!skipSessionCheck && !isImportIdevices && !isImportProperties) {
            const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
            const hasUnsaved =
                yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

            if (hasUnsaved) {
                // Close open files modal
                if (this.modal && this.modal._isShown) {
                    this.close();
                }

                // Show session logout modal with pendingAction for import
                const data = {
                    title: _('Open project'),
                    forceOpen: _('Open without saving'),
                    pendingAction: { action: 'import', file: odeFile },
                };
                eXeLearning.app.modals.sessionlogout.show(data);
                return;
            }
        }

        // Close the open files modal before showing progress (if it's open)
        if (this.modal && this.modal._isShown) {
            this.close();
        }

        // Show progress modal
        const progressModal = eXeLearning.app.modals.uploadprogress;
        progressModal.show({
            fileName: odeFileName,
            fileSize: odeFile.size,
        });

        // === DIRECT IN-MEMORY PROCESSING: Process file without upload or redirect ===
        // Only for opening ELP files (not import idevices or import properties)
        if (!isImportIdevices && !isImportProperties) {
            try {
                progressModal.setProcessingPhase('extracting');

                // Static mode: skip API call and use ElpxImporter directly
                // Note: Only trigger static mode if capabilities are available AND remote is explicitly false
                const capabilities = eXeLearning?.app?.capabilities;
                if (capabilities && !capabilities.storage.remote) {
                    progressModal.hide();
                    this.cleanupOrphanedBackdrops();

                    // Use YjsBridge.importFromElpx directly (client-side, no server APIs)
                    const yjsBridge = eXeLearning.app.project._yjsBridge;
                    if (!yjsBridge) {
                        throw new Error('Collaboration service not ready.');
                    }

                    // Show inline progress in workarea (same as online mode)
                    const importProgress = new ImportProgress();
                    importProgress.show();

                    try {
                        Logger.log('[OpenFile] Static mode - importing file:', odeFileName);

                        // Clear the previous project's assets/metadata only AFTER the import
                        // preflight/confirmation gate passes (handled inside importFromElpx via
                        // the clearPreviousProject option). This guarantees that cancelling a
                        // large-file confirmation, or rejecting an over-limit archive, leaves
                        // the current project untouched. See issue #2193.
                        const importResult = await yjsBridge.importFromElpx(odeFile, {
                            onProgress: (progress) => importProgress.update(progress),
                            clearPreviousProject: true
                        });

                        importProgress.hide();

                        // Import was cancelled (large-file confirmation declined) or rejected
                        // (over the applicable limit). The bridge already showed the actionable
                        // error when relevant; the current project is unchanged, so stop here.
                        if (isImportCancelled(importResult)) {
                            Logger.log('[OpenFile] Static mode import cancelled/rejected:', odeFileName);
                            return;
                        }

                        // Refresh UI after import (without server calls)
                        if (eXeLearning.app.project?.refreshAfterDirectImport) {
                            await eXeLearning.app.project.refreshAfterDirectImport();
                        }

                        Logger.log('[OpenFile] Static mode import complete:', odeFileName);
                    } catch (err) {
                        // Ensure progress is hidden on error
                        importProgress.hide();
                        throw err;
                    }
                    return;
                }

                // Online mode: store file in IndexedDB and do a full page reload
                progressModal.hide();
                this.cleanupOrphanedBackdrops();

                Logger.log(`[OpenFile] Storing file in IndexedDB for import after reload: ${odeFileName}`);
                await eXeLearning.app.project.transitionToProject({
                    action: 'import',
                    file: odeFile,
                    skipSave: true,
                });
                return;
            } catch (err) {
                console.error('[OpenFile] Error in direct client processing:', err);
                // Fall back to legacy upload flow
                Logger.log('[OpenFile] Falling back to legacy upload flow...');
            }
        }
        // === END DIRECT IN-MEMORY PROCESSING ===

        const length = 1024 * 1024 * 15; // 15MB
        const totalSize = odeFile.size;
        let start = 0;
        let end = start + length;
        let uploadedBytes = 0;

        try {
            while (start < totalSize) {
                const fd = new FormData();
                const blob = odeFile.slice(start, end);
                fd.append('odeFilePart', blob);
                fd.append('odeFileName', [odeFileName]);
                fd.append('odeSessionId', [eXeLearning.app.project.odeSession]);

                response = await eXeLearning.app.api.postLocalLargeOdeFile(fd);

                if (response['responseMessage'] !== 'OK') {
                    break;
                }

                // Update odeSession with the ID from server response (generated on first chunk)
                if (response['odeSessionId']) {
                    eXeLearning.app.project.odeSession = response['odeSessionId'];
                }

                // Update progress
                uploadedBytes += blob.size;
                const percentage = (uploadedBytes / totalSize) * 100;
                progressModal.updateUploadProgress(
                    percentage,
                    uploadedBytes,
                    totalSize
                );

                start = end;
                end = start + length;
            }

            if (response['responseMessage'] === 'OK') {
                // Upload complete, now processing
                progressModal.setProcessingPhase('extracting');

                odeFileName = response['odeFileName'];
                const odeFilePath = response['odeFilePath'];

                if (odeFile) {
                    odeFile._preUploadedOdeData = {
                        odeFileName,
                        odeFilePath,
                    };
                }

                if (isImportProperties) {
                    await this.openLocalXmlPropertiesFile(
                        odeFileName,
                        odeFilePath
                    );
                    // Hide progress modal after processing
                    progressModal.hide();
                } else {
                    await this.openLocalElpFile(
                        odeFileName,
                        odeFilePath,
                        isImportIdevices,
                        progressModal,
                        forceCloseSession,
                        odeFile
                    );
                    // Modal is closed inside openLocalElpFile
                }
            } else {
                this.ensureModalBackdropCleared(350);
                // Show error
                progressModal.showError(
                    response['responseMessage'] ||
                        _('Error while uploading the project.')
                );

                setTimeout(() => {
                    progressModal.hide();
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: response['responseMessage']
                            ? response.responseMessage
                            : _('Error while uploading the project.'),
                        contentId: 'error',
                    });
                }, 2000);
            }
        } catch (error) {
            console.error('Upload error:', error);
            progressModal.showError(_('Unexpected error during upload'));

            setTimeout(() => {
                progressModal.hide();
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: _(
                        'An unexpected error occurred while processing the file.'
                    ),
                    contentId: 'error',
                });
            }, 2000);
        }
    }

    async openLocalXmlPropertiesFile(odeFileName, odeFilePath) {
        const selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName,
            odeFilePath,
            odeNavStructureSyncId: selectedNavId,
        };
        const response =
            await eXeLearning.app.api.postLocalXmlPropertiesFile(data);
        if (response.responseMessage === 'OK') {
            eXeLearning.app.project.properties.loadPropertiesFromYjs();
            await eXeLearning.app.project.openLoad();
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: response.responseMessage
                        ? _(response.responseMessage)
                        : _('An error occurred while importing properties.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    async openLocalElpFile(
        odeFileName,
        odeFilePath,
        isImportIdevices,
        progressModal = null,
        forceCloseSession = false,
        originalFile = null
    ) {
        const selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );

        const odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        const forceCloseFlag = forceCloseSession ? '1' : '0';
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName,
            odeFilePath,
            odeNavStructureSyncId: selectedNavId,
            forceCloseOdeUserPreviousSession: forceCloseFlag,
        };
        const clearPreUploadedData = () => {
            if (originalFile && originalFile._preUploadedOdeData) {
                delete originalFile._preUploadedOdeData;
            }
        };

        let response;
        response = !isImportIdevices
            ? await eXeLearning.app.api.postLocalOdeFile(data)
            : await eXeLearning.app.api.postLocalOdeComponents(data);

        if (response.responseMessage == 'OK') {
            // Close progress modal before loading project
            // Wait for Bootstrap to fully close the modal via hidden.bs.modal event
            if (progressModal) {
                await progressModal.hide();
                this.cleanupOrphanedBackdrops();
            }

            if (!isImportIdevices) {
                eXeLearning.app.project.odeSession = response.odeSessionId;
                eXeLearning.app.project.odeVersion = response.odeVersionId;
                eXeLearning.app.project.odeId = response.odeId;
                // Ensure Electron saves target under current project key immediately
                try {
                    window.__currentProjectId = response.odeId;
                } catch (_e) {
                    // Intentional: Electron global may not exist
                }
                // If server returned a Yjs project UUID, redirect to the new URL-based workarea
                // with import parameter so frontend can use ElpxImporter
                if (response.projectUuid && response.elpImportPath) {
                    Logger.log(`[OpenFile] Redirecting to Yjs project: ${response.projectUuid}`);
                    Logger.log(`[OpenFile] Import path: ${response.elpImportPath}`);
                    // Clear beforeunload handler to prevent browser "Leave site?" dialog
                    window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
                    window.onbeforeunload = null;
                    window._skipLeaveSessionModal = true;
                    const importParam = encodeURIComponent(response.elpImportPath);
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    window.location.href = `${basePath}/workarea?project=${response.projectUuid}&import=${importParam}`;
                    return; // Stop here - page will reload
                }

                // Legacy flow: Load project without redirect
                await eXeLearning.app.project.openLoad();
                this.loadOdeTheme(response);
                clearPreUploadedData();

                // Show warning if file was created with a newer version
                if (response.newerVersionWarning) {
                    setTimeout(() => {
                        eXeLearning.app.modals.alert.show({
                            title: _('Warning'),
                            body: response.newerVersionWarning,
                            contentId: 'warning',
                        });
                    }, 500);
                }
            } else {
                try {
                    const newOdeBlockSync =
                        await eXeLearning.app.api.postObtainOdeBlockSync({
                            odeBlockId: response.odeBlockId,
                        });
                    if (newOdeBlockSync && newOdeBlockSync.blockId) {
                        await eXeLearning.app.project.addOdeBlock(
                            newOdeBlockSync
                        );
                    } else {
                        eXeLearning.app.project.updateUserPage(selectedNavId);
                    }
                } catch (_e) {
                    eXeLearning.app.project.updateUserPage(selectedNavId);
                }
                clearPreUploadedData();
            }
        } else {
            if (isImportIdevices) {
                setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: response.responseMessage
                            ? _(response.responseMessage)
                            : _('An error occurred while importing the file.'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            } else {
                // If we already checked the session (progressModal present), just show error
                if (progressModal) {
                    await progressModal.hide();
                    this.cleanupOrphanedBackdrops();
                    const message =
                        typeof response.responseMessage === 'string'
                            ? response.responseMessage.toLowerCase()
                            : '';

                    if (message.includes('user already has an open session')) {
                        eXeLearning.app.modals.sessionlogout.show({
                            title: _('Open project'),
                            forceOpen: _('Open without saving'),
                            pendingAction: { action: 'import', file: originalFile },
                        });

                        return;
                    }

                    setTimeout(() => {
                        eXeLearning.app.modals.alert.show({
                            title: _('Import error'),
                            body: response.responseMessage
                                ? _(response.responseMessage)
                                : _('An error occurred while opening the file.'),
                            contentId: 'error',
                        });
                    }, this.timeMax);
                } else {
                    // For regular files, check for unsaved changes using Yjs mechanism
                    const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
                    const hasUnsaved =
                        yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

                    if (hasUnsaved) {
                        eXeLearning.app.modals.sessionlogout.show({
                            title: _('Open project'),
                            forceOpen: _('Open without saving'),
                            pendingAction: { action: 'import', file: originalFile },
                        });
                    } else if (originalFile && eXeLearning.app.project?.transitionToProject) {
                        await eXeLearning.app.project.transitionToProject({
                            action: 'import',
                            file: originalFile,
                            skipSave: true,
                        });
                    } else {
                        this.openUserLocalOdeFilesWithOpenSession(
                            odeFileName,
                            odeFilePath
                        );
                    }
                }
            }
        }
    }

    async openUserLocalOdeFilesWithOpenSession(odeFileName, odeFilePath) {
        const params = {
            odeFileName,
            odeFilePath,
            forceCloseOdeUserPreviousSession: '1',
        };
        const response = await eXeLearning.app.api.postLocalOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            // Ensure Electron saves target under current project key immediately
            try {
                window.__currentProjectId = response.odeId;
            } catch (_e) {
                // Intentional: Electron global may not exist
            }
            // If server returned a Yjs project UUID, redirect with import param
            if (response.projectUuid && response.elpImportPath) {
                Logger.log(`[OpenFile] Redirecting to Yjs project: ${response.projectUuid}`);
                Logger.log(`[OpenFile] Import path: ${response.elpImportPath}`);
                // Clear beforeunload handler to prevent browser "Leave site?" dialog
                window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
                window.onbeforeunload = null;
                const importParam = encodeURIComponent(response.elpImportPath);
                const basePath = window.eXeLearning?.config?.basePath || '';
                window.location.href = `${basePath}/workarea?project=${response.projectUuid}&import=${importParam}`;
                return;
            }

            // Legacy flow: Load project without redirect
            await eXeLearning.app.project.openLoad();
            this.loadOdeTheme(response);
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage || _('An error occurred while opening the file.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /**
     * Clean up orphaned modal backdrops
     * Called after Bootstrap's hidden.bs.modal event fires
     * This is the preferred method - use instead of ensureModalBackdropCleared
     */
    cleanupOrphanedBackdrops() {
        // Remove all backdrops - they should have been cleaned by Bootstrap
        // but sometimes get orphaned during async operations
        document
            .querySelectorAll('.modal-backdrop')
            .forEach((backdrop) => backdrop.remove());

        // Only remove modal-open class if no modals are actually showing
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * @deprecated Use cleanupOrphanedBackdrops() after awaiting modal.hide() instead
     * This method uses unreliable timeouts. Kept for backwards compatibility.
     */
    ensureModalBackdropCleared(delay = 0) {
        const removeBackdrops = () => {
            if (document.querySelector('.modal.show')) {
                return;
            }
            document
                .querySelectorAll('.modal-backdrop')
                .forEach((backdrop) => backdrop.remove());
            document.body.classList.remove('modal-open');
        };

        if (delay > 0) {
            setTimeout(removeBackdrops, delay);
        } else {
            removeBackdrops();
        }
    }

    loadOdeTheme(response) {
        if (response.theme && response.themeDir && response.authorized) {
            if (
                Object.keys(eXeLearning.app.themes.list.installed).includes(
                    response.theme
                )
            ) {
                eXeLearning.app.themes.selectTheme(response.theme);
            } else {
                this.showModalLoadOdeTheme(response);
            }
        }
    }

    showModalLoadOdeTheme(response) {
        // For projects opened from server (legacy flow), we don't have access
        // to the original ELP file to extract theme files. Show info message
        // and use default theme.
        // Note: Theme import for local .elpx files is handled by YjsProjectBridge.
        let text = '';
        text +=
            '<p>' +
            _("You don't have the style used by this project.") +
            '</p>';
        text +=
            '<p>' +
            _('The default style will be used instead.') +
            '</p>';
        eXeLearning.app.modals.alert.show({
            title: _('Style not available'),
            body: text,
            confirmExec: () => {
                // Select default theme
                const defaultTheme = eXeLearning.config?.defaultTheme || 'base';
                eXeLearning.app.themes.selectTheme(defaultTheme, false);
            },
        });
    }
}

