const KNOWN_EXPORT_EXTENSIONS = new Set(['.elpx', '.zip', '.epub', '.xml']);

export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        this.button = this.menu.navbar.querySelector('#dropdownFile');
        this.newButton = this.menu.navbar.querySelector('#navbar-button-new');
        this.newFromTemplateButton = this.menu.navbar.querySelector(
            '#navbar-button-new-from-template'
        );
        this.saveButton = this.menu.navbar.querySelector('#navbar-button-save');
        this.saveButtonAs = this.menu.navbar.querySelector(
            '#navbar-button-save-as'
        );
        /*
        Temporally disabled:
        this.uploadGoogleDriveButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtodrive',
        );
        this.uploadDropboxButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtodropbox',
        );
        */
        this.uploadPlatformButton = this.menu.navbar.querySelector(
            '#navbar-button-uploadtoplatform'
        );
        this.openUserOdeFilesButton = this.menu.navbar.querySelector(
            '#navbar-button-openuserodefiles'
        );
        this.recentProjectsButton = this.menu.navbar.querySelector(
            '#navbar-button-dropdown-recent-projects'
        );
        this.downloadProjectButton = this.menu.navbar.querySelector(
            '#navbar-button-download-project'
        );
        this.downloadProjectAsButton = this.menu.navbar.querySelector(
            '#navbar-button-download-project-as'
        );
        this.exportHTML5Button = this.menu.navbar.querySelector(
            '#navbar-button-export-html5'
        );
        this.exportHTML5AsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-html5'
        );
        this.exportHTML5SPButton = this.menu.navbar.querySelector(
            '#navbar-button-export-html5-sp'
        );
        this.exportHTML5SPAsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-html5-sp'
        );
        this.exportPrintButton = this.menu.navbar.querySelector(
            '#navbar-button-export-print'
        );
        this.exportSCORM12Button = this.menu.navbar.querySelector(
            '#navbar-button-export-scorm12'
        );
        this.exportSCORM12AsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-scorm12'
        );
        this.exportSCORM2004Button = this.menu.navbar.querySelector(
            '#navbar-button-export-scorm2004'
        );
        this.exportSCORM2004AsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-scorm2004'
        );
        this.exportIMSButton = this.menu.navbar.querySelector(
            '#navbar-button-export-ims'
        );
        this.exportIMSAsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-ims'
        );
        this.exportEPUB3Button = this.menu.navbar.querySelector(
            '#navbar-button-export-epub3'
        );
        this.exportEPUB3AsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-epub3'
        );
        this.exportXmlPropertiesButton = this.menu.navbar.querySelector(
            '#navbar-button-export-xml-properties'
        );
        this.exportXmlPropertiesAsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-xml-properties'
        );
        this.importXmlPropertiesButton = this.menu.navbar.querySelector(
            '#navbar-button-import-xml-properties'
        );
        this.importElpButton = this.menu.navbar.querySelector(
            '#navbar-button-import-elp'
        );
        this.leftPanelsTogglerButton = this.menu.navbar.querySelector(
            '#exe-panels-toggler'
        );
    }

    /**
     *
     */
    setEvents() {
        this.setNewProjectEvent();
        this.setNewFromTemplateEvent();
        this.setSaveProjectEvent();
        this.setSaveAsProjectEvent();
        /*
        Temporally disabled:
        this.setUploadGoogleDriveEvent();
        this.setUploadDropboxEvent();
        */
        this.setUploadPlatformEvent();
        this.setOpenUserOdeFilesEvent();
        this.setRecentProjectsEvent();
        this.setDownloadProjectEvent();
        this.setDownloadProjectAsEvent();
        this.setExportHTML5Event();
        this.setExportHTML5AsEvent();
        this.setExportHTML5SPEvent();
        this.setExportHTML5SPAsEvent();
        this.setExportPrintEvent();
        this.setExportSCORM12Event();
        this.setExportSCORM12AsEvent();
        this.setExportSCORM2004Event();
        this.setExportSCORM2004AsEvent();
        this.setExportIMSEvent();
        this.setExportIMSAsEvent();
        this.setExportEPUB3Event();
        this.setExportEPUB3AsEvent();
        this.setExportXmlPropertiesEvent();
        this.setExportXmlPropertiesAsEvent();
        this.setImportXmlPropertiesEvent();
        this.setImportElpEvent();
        this.setLeftPanelsTogglerEvents();
    }

    /**************************************************************************************
     * LISTENERS
     **************************************************************************************/

    /**
     * New project
     * File -> New
     *
     */
    setNewProjectEvent() {
        this.newButton.addEventListener('click', () => {
            this.newProjectEvent();
        });
    }

    /**
     * New project from template
     * File -> New from Template...
     *
     */
    setNewFromTemplateEvent() {
        this.newFromTemplateButton.addEventListener('click', () => {
            this.newFromTemplateEvent();
        });
    }

    /**
     * Save project
     * File -> Save
     *
     */
    setSaveProjectEvent() {
        this.saveButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.saveOdeEvent();
        });
    }

    /**
     * Save as project
     * File -> Save as
     *
     */
    setSaveAsProjectEvent() {
        this.saveButtonAs.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.saveAsOdeEvent();
        });
    }

    /**
     * Upload ELP to Google Drive
     * File -> Upload to -> Google Drive
     *
     */
    /*
    Temporally disabled:
    setUploadGoogleDriveEvent() {
        this.uploadGoogleDriveButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.uploadToGoogleDriveEvent();
        });
    }
    */

    /**
     * Upload ELP to Google Drive
     * File -> Upload to -> Google Drive
     *
     */
    /*
    Temporally disabled:
    setUploadDropboxEvent() {
        this.uploadDropboxButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.uploadToDropboxEvent();
        });
    }
    */

    /**
     * Upload ELP to platform
     * File -> Upload to -> platform
     *
     */
    setUploadPlatformEvent() {
        if (this.uploadPlatformButton) {
            this.uploadPlatformButton.addEventListener('click', () => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.uploadPlatformEvent();
            });
        }
    }

    /**
     * Show list of elp files
     * File -> Open
     *
     */
    setOpenUserOdeFilesEvent() {
        this.openUserOdeFilesButton.addEventListener('click', () => {
            this.openUserOdeFilesEvent();
        });
    }

    /**
     * Show the 3 most recent elp
     * File -> Recent projects
     *
     */
    setRecentProjectsEvent() {
        this.recentProjectsButton.addEventListener('click', () => {
            this.showMostRecentProjectsEvent();
        });
    }

    /**
     * Download the project
     * File -> Download
     *
     */
    setDownloadProjectEvent() {
        this.downloadProjectButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return false;
            this.downloadProjectEvent();
            return false;
        });
    }

    /**
     * Download the project to HTML5
     * File -> Export as -> HTML5 (web site)
     *
     */
    setExportHTML5Event() {
        this.exportHTML5Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5Event();
        });
    }

    setExportHTML5AsEvent() {
        if (!this.exportHTML5AsButton) return;
        this.exportHTML5AsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5AsEvent();
        });
    }

    /**
     * Download the project to HTML5 Single Page
     * File -> Export as -> HTML5 (single page)
     *
     */
    setExportHTML5SPEvent() {
        this.exportHTML5SPButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5SPEvent();
        });
    }

    setExportHTML5SPAsEvent() {
        if (!this.exportHTML5SPAsButton) return;
        this.exportHTML5SPAsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5SPAsEvent();
        });
    }

    /**
     * Open the unified print/PDF view in a new tab.
     */
    setExportPrintEvent() {
        if (!this.exportPrintButton) return;
        this.exportPrintButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.openPrintPreview();
        });
    }

    async openPrintPreview() {
        const project = eXeLearning?.app?.project;
        const sessionId = project?.odeSession;

        if (!sessionId) {
            console.warn('Print preview requires an active session id.');
            return;
        }

        const projectId =
            project?.odeId || window.__currentProjectId || 'unsaved';

        const toastData = {
            title: _('Print'),
            body: _('Generating preview...'),
            icon: 'preview',
        };
        const toast = eXeLearning?.app?.toasts?.createToast
            ? eXeLearning.app.toasts.createToast(toastData)
            : null;

        const baseUrl =
            window.eXeLearning?.symfony?.baseURL || window.location.origin;
        const basePathRaw =
            window.eXeLearning?.symfony?.basePath !== undefined
                ? window.eXeLearning.symfony.basePath
                : '';
        const trimmedBasePath = String(basePathRaw).replace(/^\/+|\/+$/g, '');
        const sanitizedBasePath = trimmedBasePath ? `/${trimmedBasePath}` : '';
        const safeProjectId = encodeURIComponent(projectId);
        const endpointPath = `${sanitizedBasePath}/project/${safeProjectId}/export/single-page-preview`;
        const requestUrl = new URL(endpointPath, baseUrl);
        requestUrl.searchParams.set('sessionId', sessionId);

        let previewWindow = null;

        try {
            const response = await fetch(requestUrl.toString(), {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error(`Unexpected status ${response.status}`);
            }

            const data = await response.json();
            if (!data || !data.url) {
                throw new Error('Missing preview URL in response');
            }

            if (toast) {
                toast.toastBody.innerHTML = _('Generating preview...');
            }

            previewWindow = window.open(data.url, '_blank', 'noopener');
        } catch (error) {
            console.error('Unable to open print preview', error);
            if (toast) {
                toast.toastBody.innerHTML = _(
                    'An error occurred while generating the preview.'
                );
                toast.toastBody.classList.add('error');
            }
            if (previewWindow) {
                previewWindow.close();
            }
            if (eXeLearning?.app?.modals?.alert) {
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: _(
                        'An error occurred while generating the print preview.'
                    ),
                    contentId: 'error',
                });
            }
        } finally {
            if (toast) {
                setTimeout(() => toast.remove(), 1000);
            }
        }
    }

    /**
     * Download the project to SCORM 1.2
     * File -> Export as -> SCORM 1.2
     *
     */
    setExportSCORM12Event() {
        this.exportSCORM12Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM12Event();
        });
    }

    setExportSCORM12AsEvent() {
        if (!this.exportSCORM12AsButton) return;
        this.exportSCORM12AsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM12AsEvent();
        });
    }

    /**
     * Download the project to SCORM 2004
     * File -> Export as -> SCORM 2004
     *
     */
    setExportSCORM2004Event() {
        this.exportSCORM2004Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM2004Event();
        });
    }

    setExportSCORM2004AsEvent() {
        if (!this.exportSCORM2004AsButton) return;
        this.exportSCORM2004AsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportSCORM2004AsEvent();
        });
    }

    /**
     * Download the project to IMS CP
     * File -> Export as -> IMS CP
     *
     */
    setExportIMSEvent() {
        this.exportIMSButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportIMSEvent();
        });
    }

    setExportIMSAsEvent() {
        if (!this.exportIMSAsButton) return;
        this.exportIMSAsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportIMSAsEvent();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> ePub3
     *
     */
    setExportEPUB3Event() {
        this.exportEPUB3Button.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportEPUB3Event();
        });
    }

    setExportEPUB3AsEvent() {
        if (!this.exportEPUB3AsButton) return;
        this.exportEPUB3AsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportEPUB3AsEvent();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> Xml properties
     *
     */
    setExportXmlPropertiesEvent() {
        this.exportXmlPropertiesButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportXmlPropertiesEvent();
        });
    }

    setExportXmlPropertiesAsEvent() {
        if (!this.exportXmlPropertiesAsButton) return;
        this.exportXmlPropertiesAsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportXmlPropertiesAsEvent();
        });
    }

    /**
     * Download the project to ePub3
     * File -> Export as -> Xml properties
     *
     */
    setImportXmlPropertiesEvent() {
        this.importXmlPropertiesButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.importXmlPropertiesEvent();
        });
    }

    /**
     * Import an .elpx file and append it to the root node.
     */
    setImportElpEvent() {
        if (!this.importElpButton) return;

        this.importElpButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            eXeLearning.app.modals.confirm.show({
                title: _('Import (.elpx...)'),
                body: _(
                    'Import .elpx, .elp, or editable .zip or .epub files. The imported content will be added after the last page of the current project.'
                ),
                confirmButtonText: _('Continue'),
                cancelButtonText: _('Cancel'),
                focusFirstInputText: true,
                confirmExec: () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.elpx,.elp,.zip,.epub';
                    input.classList.add('visually-hidden');
                    document.body.appendChild(input);

                    input.addEventListener('change', async () => {
                        if (!input.files || !input.files.length) {
                            input.remove();
                            return;
                        }

                        const file = input.files[0];
                        const progressModal =
                            eXeLearning.app.modals.uploadprogress;
                        progressModal.show({
                            fileName: file.name,
                            fileSize: file.size,
                        });

                        const refreshStructure = (targetId = false) => {
                            const structure =
                                eXeLearning?.app?.project?.structure;
                            if (
                                structure &&
                                typeof structure.resetDataAndStructureData ===
                                    'function'
                            ) {
                                structure.resetDataAndStructureData(targetId);
                            } else {
                                eXeLearning.app.project.openLoad();
                            }
                        };

                        const ensureModalBackdropCleared = (delay = 0) => {
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
                        };

                        try {
                            // Upload file in chunks (15 MB)
                            const chunkSize = 1024 * 1024 * 15;
                            const totalSize = file.size;
                            let start = 0;
                            let uploadedBytes = 0;
                            let response;

                            while (start < totalSize) {
                                const end = Math.min(
                                    start + chunkSize,
                                    totalSize
                                );
                                const blob = file.slice(start, end);
                                const fd = new FormData();
                                fd.append('odeFilePart', blob);
                                fd.append('odeFileName', [file.name]);
                                fd.append('odeSessionId', [
                                    eXeLearning.app.project.odeSession,
                                ]);

                                response =
                                    await eXeLearning.app.api.postLocalLargeOdeFile(
                                        fd
                                    );

                                if (response['responseMessage'] !== 'OK') {
                                    break;
                                }

                                // Update progress
                                uploadedBytes += blob.size;
                                const percentage =
                                    (uploadedBytes / totalSize) * 100;
                                progressModal.updateUploadProgress(
                                    percentage,
                                    uploadedBytes,
                                    totalSize
                                );

                                start = end;
                            }

                            if (response['responseMessage'] !== 'OK') {
                                progressModal.showError(
                                    response['responseMessage'] ||
                                        _('Error while uploading the file.')
                                );
                                setTimeout(() => {
                                    progressModal.hide();
                                    eXeLearning.app.modals.alert.show({
                                        title: _('Error'),
                                        body:
                                            response['responseMessage'] ||
                                            _(
                                                'Unexpected error importing file.'
                                            ),
                                    });
                                }, 2000);
                                input.remove();
                                return;
                            }

                            // Set extracting phase
                            progressModal.setProcessingPhase('extracting');

                            // Call JSON-based import API
                            const payload = {
                                odeSessionId:
                                    eXeLearning.app.project.odeSession,
                                odeFileName: response['odeFileName'],
                                odeFilePath: response['odeFilePath'],
                            };

                            const importResponse =
                                await eXeLearning.app.api.postImportElpToRootFromLocal(
                                    payload
                                );

                            if (
                                importResponse &&
                                importResponse.responseMessage === 'OK'
                            ) {
                                progressModal.setComplete(
                                    true,
                                    _('Completed successfully')
                                );
                                const structure =
                                    eXeLearning?.app?.project?.structure;
                                const selectedNodeId =
                                    structure &&
                                    typeof structure.getSelectNodeNavId ===
                                        'function'
                                        ? structure.getSelectNodeNavId()
                                        : null;
                                refreshStructure(selectedNodeId || false);
                                setTimeout(() => {
                                    progressModal.hide();
                                    ensureModalBackdropCleared(350);
                                }, 600);
                            } else {
                                const message =
                                    importResponse?.responseMessage ||
                                    _('Unexpected error importing file.');
                                progressModal.showError(message);
                                setTimeout(() => {
                                    progressModal.hide();
                                    eXeLearning.app.modals.alert.show({
                                        title: _('Error'),
                                        body: message,
                                    });
                                }, 2000);
                            }
                        } catch (err) {
                            console.error('Import error:', err);
                            progressModal.showError(
                                _(
                                    'An unexpected error occurred while processing the file.'
                                )
                            );
                            setTimeout(() => {
                                progressModal.hide();
                                eXeLearning.app.modals.alert.show({
                                    title: _('Error'),
                                    body: _(
                                        'An unexpected error occurred while processing the file.'
                                    ),
                                });
                            }, 2000);
                        } finally {
                            ensureModalBackdropCleared(350);
                            input.remove();
                        }
                    });

                    input.click();
                },
            });
        });
    }

    /**
     * Hide/Show the left panels (left column)
     *
     */
    setLeftPanelsTogglerEvents() {
        // See eXeLearning.app.common.initTooltips
        $(this.leftPanelsTogglerButton)
            .attr('data-bs-placement', 'bottom')
            .tooltip()
            .on('click', function () {
                $(this).tooltip('hide');
                $('body').toggleClass('left-column-hidden');
            });
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Creates a new session
     *
     */
    newProjectEvent() {
        let odeSessionId = eXeLearning.app.project.odeSession;
        this.newSession(odeSessionId);
    }

    /**
     * Opens the template selection modal
     * File -> New from Template
     */
    newFromTemplateEvent() {
        eXeLearning.app.modals.templateselection.show();
    }

    /**
     * newSession
     *
     * @param {*} odeSessionId
     */
    async newSession(odeSessionId) {
        let params = { odeSessionId: odeSessionId };
        let data = {
            title: _('New file'),
            forceOpen: _('Create new file without saving'),
            newFile: true,
        };

        eXeLearning.app.api
            .postCheckCurrentOdeUsers(params)
            .then((response) => {
                if (response['leaveEmptySession']) {
                    this.createSession(params);
                } else {
                    eXeLearning.app.modals.sessionlogout.show(data);
                }
            });
    }

    /**
     * createSession
     *
     */
    async createSession(params) {
        await eXeLearning.app.api.postCloseSession(params).then((response) => {
            if (response.responseMessage == 'OK') {
                // Reload project
                eXeLearning.app.project.loadCurrentProject();
                eXeLearning.app.project.openLoad();
            }
        });
    }

    /**
     * Save ode in ELP file
     *
     */
    saveOdeEvent() {
        eXeLearning.app.project.save();
    }

    /**
     * Save as ode in ELP file
     *
     */
    saveAsOdeEvent() {
        let odeSessionId = eXeLearning.app.project.odeSession;
        let odeVersionId = eXeLearning.app.project.odeVersion;
        let odeId = eXeLearning.app.project.odeId;
        let params = {
            odeSessionId: odeSessionId,
            odeVersionId: odeVersionId,
            odeId: odeId,
        };
        this.currentOdeUsers(params);
    }

    /**
     * Save as project
     *
     */
    async saveAs(title) {
        let data = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
            title: title,
        };
        // Show message
        let toastData = {
            title: _('Save'),
            body: _('Saving the project...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        // Save
        let response = await eXeLearning.app.api.postOdeSaveAs(data);
        if (response && response.responseMessage == 'OK') {
            eXeLearning.app.project.odeId = response.odeId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeSession = response.newSessionId;
            await eXeLearning.app.project.openLoad();
            eXeLearning.app.project.showModalSaveOk(response);
            eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
            toast.toastBody.innerHTML = _('Project saved.');
        } else {
            eXeLearning.app.project.showModalSaveError(response);
            toast.toastBody.innerHTML = _(
                'An error occurred while saving the project.'
            );
            toast.toastBody.classList.add('error');
        }
        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);
    }

    /**
     *
     */
    makeConfirmTitleInputModal() {
        let body = this.makeBodyElementPropertiesTiltleName();
        eXeLearning.app.modals.confirm.show({
            title: _('Save project'),
            body: body.innerHTML,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            focusFirstInputText: true,
            confirmExec: () => {
                let modalInputText = document.querySelector(
                    '.modal-confirm .properties-title-input'
                );
                let modalInputTextValue = modalInputText.value;
                this.saveAs(modalInputTextValue);
            },
        });
    }

    /**
     *
     * @returns
     */
    makeBodyElementPropertiesTiltleName() {
        let element = document.createElement('div');
        element.classList.add('properties-title-div');
        element.append(this.makeDivContentPropertiesTiltleName());
        return element;
    }

    /**
     *
     * @returns
     */
    makeDivContentPropertiesTiltleName() {
        let element = document.createElement('div');
        let p = document.createElement('p');
        let inputText = document.createElement('input');

        element.classList.add('properties-title-content-div');

        p.classList.add('properties-title-notice');
        p.innerHTML = _('Please enter the project title:');

        inputText.classList.add('properties-title-input');
        inputText.setAttribute('type', 'text');

        element.append(p);
        element.append(inputText);

        return element;
    }

    /**
     * It connects with the google api to show a modal with the google drive directories
     *  where the project can be uploaded
     *
     */
    uploadToGoogleDriveEvent() {
        // Get Google Drive folders
        this.getFoldersGoogleDrive().then((response) => {
            if (!response.error) {
                // Show eXe Google Drive modal
                eXeLearning.app.modals.uploadtodrive.show(response.files);
            } else {
                if (eXeLearning.app.actions.authorizeAddActions) {
                    // Open window Google Drive login in popup
                    this.openWindowLoginGoogleDrive();
                } else {
                    // Open eXe alert modal
                    eXeLearning.app.modals.alert.show({
                        title: _('Google Drive error'),
                        body: response.error,
                        contentId: 'error',
                    });
                }
            }
        });
    }

    /**
     * uploadToGoogleDriveEvent
     * Get the directories that the user has in google drive
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        let foldersInfo = await eXeLearning.app.api.getFoldersGoogleDrive();
        if (foldersInfo) {
            if (foldersInfo.folders && foldersInfo.folders.files) {
                return { error: false, files: foldersInfo.folders };
            } else {
                return { error: foldersInfo, files: [] };
            }
        } else {
            return { error: _('Unknown'), files: [] };
        }
    }

    /**
     * uploadToGoogleDriveEvent
     * Get login url from google drive and open it in a popup
     *
     */
    async openWindowLoginGoogleDrive() {
        let urlGoogleDrive = await eXeLearning.app.api.getUrlLoginGoogleDrive();
        let windowLoginGoogleDrive = window.open(
            urlGoogleDrive.url,
            'drive',
            'location=1,status=1,scrollbars=1,width=600,height=500,top=250, left=720, menubar=0, toolbar=0,resizable=0'
        );
    }

    /**
     * It connects with the dropbox api to show a modal with the dropbox directories
     *  where the project can be uploaded
     *
     */
    uploadToDropboxEvent() {
        // Get Dropbox folders
        this.getFoldersDropbox().then((response) => {
            if (!response.error) {
                // Show eXe Dropbox modal
                eXeLearning.app.modals.uploadtodropbox.show(response.files);
            } else {
                if (eXeLearning.app.actions.authorizeAddActions) {
                    // Open window Dropbox login in popup
                    this.openWindowLoginDropbox();
                } else {
                    // Open eXe alert modal
                    eXeLearning.app.modals.alert.show({
                        title: _('Dropbox error'),
                        body: response.error,
                        contentId: 'error',
                    });
                }
            }
        });
    }

    /**
     * uploadToDropboxEvent
     * Get the directories that the user has in dropbox
     *
     * @returns
     */
    async getFoldersDropbox() {
        let foldersInfo = await eXeLearning.app.api.getFoldersDropbox();
        if (foldersInfo) {
            if (foldersInfo.folders && foldersInfo.folders.files) {
                return { error: false, files: foldersInfo.folders };
            } else {
                return { error: foldersInfo, files: [] };
            }
        } else {
            return { error: _('Unknown'), files: [] };
        }
    }

    /**
     * uploadToDropboxEvent
     * Get login url from dropbox and open it in a popup
     *
     */
    async openWindowLoginDropbox() {
        let urlDropbox = await eXeLearning.app.api.getUrlLoginDropbox();
        let windowLoginDropbox = window.open(
            urlDropbox.url,
            'dropbox',
            'location=1,status=1,scrollbars=1,width=600,height=500,top=250, left=720, menubar=0, toolbar=0,resizable=0'
        );
    }

    /**
     * Save ode and send to platform
     *
     */
    async uploadPlatformEvent() {
        const urlParams = new URLSearchParams(window.location.search);
        let jwt_token = urlParams.get('jwt_token');

        let data = {
            odeSessionId: eXeLearning.app.project.odeSession,
            platformUrlSet: eXeLearning.config.platformUrlSet,
            jwt_token: jwt_token,
        };
        // Save
        let response;

        response =
            await eXeLearning.app.api.postFirstTypePlatformIntegrationElpUpload(
                data
            );

        if (response.responseMessage == 'OK') {
            window.onbeforeunload = null;
            window.location.replace(response.returnUrl);
        } else {
            eXe.app.alert(_(response.responseMessage));
        }
    }

    /**
     *
     * @returns
     */
    createIdevicesUploadInput() {
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-ode-file-upload');
        // Allow both .elpx and .zip for offline picker fallback
        inputUpload.setAttribute('accept', '.elpx,.zip');
        inputUpload.classList.add('d-none');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-ode-file-upload-input'
            );
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(odeFile);
        });
        this.menu.navbar.append(inputUpload);
        return inputUpload;
    }

    /**
     * Show list of elp on perm
     *
     */
    openUserOdeFilesEvent() {
        // Get ode files
        this.getOdeFilesListEvent().then((response) => {
            eXeLearning.app.modals.openuserodefiles.show(response);
        });
    }

    /**
     * getOdeFilesList
     * Get the ode files saved by the user
     *
     * @returns
     */
    async getOdeFilesListEvent() {
        let odeFilesList = await eXeLearning.app.api.getUserOdeFiles();
        return odeFilesList;
    }

    /**
     * showMostRecentProjectsEvent
     *
     */
    showMostRecentProjectsEvent() {
        let recentProjectsDropdownList = this.menu.navbar.querySelector(
            '#navbar-dropdown-menu-recent-projects'
        );
        eXeLearning.app.api.getRecentUserOdeFiles().then((response) => {
            let recentProjectsList = this.makeRecentProjecList(response);
            recentProjectsDropdownList.innerHTML = '';
            recentProjectsDropdownList.append(recentProjectsList);
        });
    }

    /**
     *
     * @param {*} odeFiles
     * @returns
     */
    makeRecentProjecList(odeFiles) {
        let recentProjectsLi = document.createElement('li');
        if (odeFiles.length > 0) {
            odeFiles.forEach((odeFile) => {
                let recentProjectLink = document.createElement('a');

                recentProjectLink.classList.add('dropdown-item');
                recentProjectLink.setAttribute('href', '#');

                recentProjectLink.addEventListener('click', () => {
                    let odeSessionId = eXeLearning.app.project.odeSession;
                    let odeVersionId = eXeLearning.app.project.odeVersion;
                    let odeId = eXeLearning.app.project.odeId;

                    let params = {
                        odeSessionId: odeSessionId,
                        odeVersionId: odeVersionId,
                        odeId: odeId,
                    };

                    eXeLearning.app.api
                        .postCheckCurrentOdeUsers(params)
                        .then((response) => {
                            if (response['leaveEmptySession']) {
                                eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession(
                                    odeFile.fileName
                                );
                            } else {
                                let data = {
                                    title: _('Open project'),
                                    forceOpen: _('Open without saving'),
                                    openOdeFile: true,
                                    id: odeFile.fileName,
                                };
                                eXeLearning.app.modals.sessionlogout.show(data);
                            }
                        });
                });

                recentProjectLink.innerHTML = odeFile.title;
                recentProjectsLi.append(recentProjectLink);
            });
        } else {
            let recentProjectLink = document.createElement('a');
            recentProjectLink.classList.add('dropdown-item');
            recentProjectLink.innerHTML = _('No recent projects...');
            recentProjectsLi.append(recentProjectLink);
        }

        return recentProjectsLi;
    }

    /**
     * Download project ELP
     *
     */
    async downloadProjectEvent() {
        let toastData = {
            title: _('Download'),
            body: _('File generation in progress.'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            eXeLearning.extension
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('File generated.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while generating the file.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as HTML5 and download it
     *
     */
    async exportHTML5Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export HTML5 (Save As...)
     */
    async exportHTML5AsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as HTML5 and download it
     *
     */
    async exportHTML5SPEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5-sp'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export HTML5 Single Page (Save As...)
     */
    async exportHTML5SPAsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'html5-sp'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM12Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm12'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export SCORM 1.2 (Save As...)
     */
    async exportSCORM12AsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm12'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM2004Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm2004'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export SCORM 2004 (Save As...)
     */
    async exportSCORM2004AsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'scorm2004'
        );
        if (response['responseMessage'] == 'OK') {
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-scorm2004'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-scorm2004`,
                    suggested
                );
            } else {
                this.downloadLink(url, suggested);
            }
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as IMS CP and download it
     *
     */
    async exportIMSEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'ims'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export IMS (Save As...)
     */
    async exportIMSAsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'ims'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as ePub3 and download it
     *
     */
    async exportEPUB3Event() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'epub3'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export ePub3 (Save As...)
     */
    async exportEPUB3AsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'epub3'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The project has been exported.');
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the properties as xml and download it
     *
     */
    async exportXmlPropertiesEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'properties'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _(
                'The project properties have been exported.'
            );
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export XML properties (Save As...)
     */
    async exportXmlPropertiesAsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdeExportDownload(
            odeSessionId,
            'properties'
        );
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _(
                'The project properties have been exported.'
            );
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: response['responseMessage']
                    ? response['responseMessage']
                    : _('Unknown error.'),
                contentId: 'error',
            });
        }
        setTimeout(() => {
            toast.remove();
        }, 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     *
     * @returns
     */
    createPropertiesUploadInput() {
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-xml-properties-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-xml-properties-upload');
        inputUpload.setAttribute('accept', '.xml');
        inputUpload.classList.add('hidden');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-xml-properties-upload-input'
            );
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createPropertiesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                odeFile,
                false,
                true
            );
        });
        this.menu.navbar.append(inputUpload);
        return inputUpload;
    }

    /**
     * Export the properties as xml and download it
     *
     */
    async importXmlPropertiesEvent() {
        this.createPropertiesUploadInput();
        this.menu.navbar
            .querySelector('.local-xml-properties-upload-input')
            .click();
    }

    /**
     * Helper function to download the content of a link
     *
     * @param {*} $url
     * @param {*} $name
     */
    downloadLink($url, $name) {
        eXeLearning.app.api
            .getFileResourcesForceDownload($url)
            .then((response) => {
                const finalUrl = response.url || $url;
                // Browser download
                let downloadLink = document.createElement('a');
                downloadLink.href = finalUrl;
                downloadLink.download = $name;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            });
    }

    /**
     * Ensure suggested name has the correct extension per export type
     */
    normalizeSuggestedName(name, typeKey) {
        try {
            const trimmed = (name || '').trim();
            const baseNoExt = trimmed.replace(/\.[^.]+$/, '');
            const lowerNoExt = baseNoExt.toLowerCase();
            const looksGeneric =
                !lowerNoExt ||
                /^document(\b|[\s._-].*)?$/.test(lowerNoExt) ||
                /^export(\b|[-_.].*)?$/.test(lowerNoExt);

            let base = trimmed;
            if (looksGeneric) {
                // Build from project title if available
                try {
                    const titleProp =
                        eXeLearning.app.project.properties?.properties?.pp_title
                            ?.value;
                    if (titleProp && titleProp.trim()) {
                        base = titleProp.trim();
                    }
                } catch (_e) {}
                if (!base || !base.trim()) base = 'project';
                base = this.appendSuffixForType(base, typeKey);
            }

            const lower = (typeKey || '').toLowerCase();
            let ext = '';
            if (lower.endsWith('epub3')) ext = '.epub';
            else if (lower.endsWith(eXeLearning.extension))
                ext = '.' + eXeLearning.extension;
            else if (lower.includes('xml')) ext = '.xml';
            else ext = '.zip';
            const match = /\.([^.]+)$/.exec(base);
            const matchFragment = match ? match[0] : null;
            const lowerCurrentExt = match ? `.${match[1].toLowerCase()}` : null;
            if (
                !lowerCurrentExt ||
                !KNOWN_EXPORT_EXTENSIONS.has(lowerCurrentExt)
            ) {
                base += ext;
            } else if (lowerCurrentExt !== ext) {
                base = base.slice(0, -matchFragment.length) + ext;
            }
            return base;
        } catch (_e) {
            return name || 'export.zip';
        }
    }

    appendSuffixForType(base, typeKey) {
        const lower = (typeKey || '').toLowerCase();
        if (lower.endsWith('html5')) return `${base}_web`;
        if (lower.endsWith('html5-sp')) return `${base}_page`;
        if (lower.endsWith('scorm12')) return `${base}_scorm`;
        if (lower.endsWith('scorm2004')) return `${base}_scorm2004`;
        if (lower.endsWith('ims')) return `${base}_ims`;
        return base; // elp, epub3, xml properties: no suffix here
    }

    /**
     * currentOdeUsers
     *
     */
    async currentOdeUsers(params) {
        let response = await eXeLearning.app.api.getOdeConcurrentUsers(
            params.odeId,
            params.odeVersionId,
            params.odeSessionId
        );
        let numberOfCurrentUsers = response.currentUsers.length;
        if (numberOfCurrentUsers == 1) {
            this.makeConfirmTitleInputModal();
        } else {
            let response = { responseMessage: _('Other users are connected.') };
            eXeLearning.app.project.showModalSaveError(response);
        }
    }
}
