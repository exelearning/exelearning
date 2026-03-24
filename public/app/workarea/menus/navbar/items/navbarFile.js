// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

import ImportProgress from '../../../interface/importProgress.js';

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
        this.settingsButton = this.menu.navbar.querySelector(
            '#navbar-button-settings'
        );
        this.shareButton = this.menu.navbar.querySelector('#navbar-button-share');
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
        // Finish button in header (alternative to uploadPlatformButton)
        this.finishButton = document.querySelector('#head-top-finish-button');
        this.openUserOdeFilesButton = this.menu.navbar.querySelector(
            '#navbar-button-openuserodefiles'
        );
        // Offline-only Open and Save entries (in the offline actions block)
        this.openOfflineButton = this.menu.navbar.querySelector(
            '#navbar-button-open-offline'
        );
        this.saveOfflineButton = this.menu.navbar.querySelector(
            '#navbar-button-save-offline'
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
        this.exportHTML5FolderAsButton = this.menu.navbar.querySelector(
            '#navbar-button-exportas-html5-folder'
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
        this.setSettingsEvent();
        this.setShareEvent();
        /*
        Temporally disabled:
        this.setUploadGoogleDriveEvent();
        this.setUploadDropboxEvent();
        */
        this.setUploadPlatformEvent();
        this.setOpenUserOdeFilesEvent();
        this.setOpenOfflineEvent();
        this.setRecentProjectsEvent();
        this.setDownloadProjectEvent();
        this.setSaveProjectOfflineEvent();
        this.setDownloadProjectAsEvent();
        this.setExportHTML5Event();
        this.setExportHTML5AsEvent();
        this.setExportHTML5FolderAsEvent();
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

        // Check for available templates and show button if any exist
        this.checkAndShowNewFromTemplateButton();
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
        // In static/offline mode, "New" should open the current static entry URL.
        // This keeps versioned query params (e.g. ?v=...) and avoids forcing /workarea.
        const newProjectUrl = this.resolveNewProjectWindowUrl();
        if (this.newButton?.setAttribute) {
            this.newButton.setAttribute('href', newProjectUrl);
        }
        this.newProjectOpenInNewTabIntent = false;
        this.newProjectModifierPressed = false;
        this.attachNewProjectModifierTracking();

        // Some environments lose modifier flags between mousedown and click.
        // Capture the user's original intent here and consume it on click.
        const previousHandlers = this.newButton.__exeNewProjectHandlers;
        if (previousHandlers?.pointerdown) {
            this.newButton.removeEventListener(
                'pointerdown',
                previousHandlers.pointerdown
            );
        }
        if (previousHandlers?.mousedown) {
            this.newButton.removeEventListener(
                'mousedown',
                previousHandlers.mousedown
            );
        }
        if (previousHandlers?.click) {
            this.newButton.removeEventListener('click', previousHandlers.click);
        }

        this._onNewProjectPointerDown = (event) => {
            this.newProjectOpenInNewTabIntent =
                this.newProjectOpenInNewTabIntent ||
                this.shouldOpenNewProjectInNewTab(event);
        };
        this._onNewProjectMouseDown = (event) => {
            this.newProjectOpenInNewTabIntent =
                this.newProjectOpenInNewTabIntent ||
                this.shouldOpenNewProjectInNewTab(event);
        };
        this._onNewProjectClick = (event) => {
            // Electron does not always honor Cmd/Ctrl-click on in-app links.
            // Force opening a new tab/window for modifier/middle clicks.
            const shouldOpenInNewTab =
                this.newProjectOpenInNewTabIntent ||
                this.newProjectModifierPressed ||
                this.shouldOpenNewProjectInNewTab(event);
            this.newProjectOpenInNewTabIntent = false;

            if (shouldOpenInNewTab) {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                // Defensive guard: if another stale/duplicate listener fires in the
                // same user gesture, ignore its in-place "new project" navigation.
                this.suppressNewProjectEventUntil = Date.now() + 1000;
                window.__exeSuppressNewProjectUntil = this.suppressNewProjectEventUntil;
                this.openNewProjectInNewWindow();
                return;
            }

            event?.preventDefault?.();
            this.newProjectEvent();
        };

        this.newButton.addEventListener(
            'pointerdown',
            this._onNewProjectPointerDown
        );
        this.newButton.addEventListener('mousedown', this._onNewProjectMouseDown);
        this.newButton.addEventListener('click', this._onNewProjectClick);
        this.newButton.__exeNewProjectHandlers = {
            pointerdown: this._onNewProjectPointerDown,
            mousedown: this._onNewProjectMouseDown,
            click: this._onNewProjectClick,
        };
    }

    /**
     * Track Ctrl/Cmd pressed state to handle environments where click events
     * lose modifier flags.
     */
    attachNewProjectModifierTracking() {
        if (this._newProjectModifierTrackingAttached) return;

        this._newProjectModifierTrackingAttached = true;
        this._onNewProjectModifierKeyDown = (event) => {
            if (event?.key === 'Control' || event?.key === 'Meta') {
                this.newProjectModifierPressed = true;
            }
        };
        this._onNewProjectModifierKeyUp = (event) => {
            if (event?.key === 'Control' || event?.key === 'Meta') {
                this.newProjectModifierPressed = false;
            }
        };
        this._onNewProjectModifierWindowBlur = () => {
            this.newProjectModifierPressed = false;
        };

        window.addEventListener('keydown', this._onNewProjectModifierKeyDown, true);
        window.addEventListener('keyup', this._onNewProjectModifierKeyUp, true);
        window.addEventListener('blur', this._onNewProjectModifierWindowBlur);
    }

    /**
     * Return true when the New action should open using native link behavior
     * (Ctrl/Cmd-click, Shift-click, middle-click, etc.).
     *
     * @param {MouseEvent | undefined} event
     * @returns {boolean}
     */
    shouldOpenNewProjectInNewTab(event) {
        if (!event) return false;
        return (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button === 1
        );
    }

    /**
     * Open the New project URL in a new browser/Electron window.
     */
    openNewProjectInNewWindow() {
        const newProjectUrl = this.resolveNewProjectWindowUrl();
        const popup = window.open(newProjectUrl, '_blank');
        popup?.focus?.();
    }

    /**
     * Resolve the URL used by File -> New when opening in a new tab/window.
     * In static/offline mode we keep the current URL; in online mode we use /workarea.
     *
     * @returns {string}
     */
    resolveNewProjectWindowUrl() {
        const capabilities = eXeLearning?.app?.capabilities;
        const hasRemoteStorage = capabilities?.storage?.remote;
        const isStaticOrOffline =
            window.__EXE_STATIC_MODE__ === true ||
            eXeLearning?.config?.isOfflineInstallation === true ||
            hasRemoteStorage === false;

        if (isStaticOrOffline) {
            return window.location.href;
        }

        const basePath = window.eXeLearning?.config?.basePath || '';
        return `${window.location.origin}${basePath}/workarea`;
    }

    /**
     * Static mode (PWA/browser or Electron) where no backend session APIs are available.
     *
     * @returns {boolean}
     */
    isStaticMode() {
        const capabilities = eXeLearning?.app?.capabilities;
        return (
            window.__EXE_STATIC_MODE__ === true ||
            capabilities?.storage?.remote === false
        );
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
     * Check if there are templates available for the current locale
     * and show the "New from Template" button if so
     */
    async checkAndShowNewFromTemplateButton() {
        // Templates require server API - skip when no remote storage
        // Note: Only skip if capabilities are available AND remote is explicitly false
        const capabilities = eXeLearning?.app?.capabilities;
        if (capabilities && !capabilities.storage.remote) {
            return;
        }

        try {
            // Get current locale from eXeLearning config or default to 'en'
            const locale = eXeLearning?.config?.locale || 'en';
            const basePath = eXeLearning?.config?.basePath || '';

            const response = await fetch(`${basePath}/api/templates?locale=${locale}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                Logger.debug('[NavbarFile] Templates API not available');
                return;
            }

            const data = await response.json();

            // Show button if there are any templates (builtin or admin)
            if (data.templates && data.templates.length > 0) {
                const li = this.newFromTemplateButton?.parentElement;
                if (li) {
                    li.classList.remove('d-none');
                    Logger.debug(`[NavbarFile] Showing "New from Template" - ${data.templates.length} templates available for ${locale}`);
                }
            }
        } catch (error) {
            // Silently ignore - button stays hidden
            Logger.debug('[NavbarFile] Could not check templates:', error.message);
        }
    }

    /**
     * Save project
     * File -> Save
     *
     */
    setSaveProjectEvent() {
        this.saveButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            // Offline desktop: use ELP export flow as persistent file save
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.downloadProjectEvent();
                return;
            }
            this.saveOdeEvent();
        });
    }

    /**
     * Project settings
     * File -> Settings
     *
     */
    setSettingsEvent() {
        if (!this.settingsButton) return;
        this.settingsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.openProjectSettingsEvent();
        });
    }

    /**
     * Share project
     * File -> Share
     *
     */
    setShareEvent() {
        if (!this.shareButton) return;
        this.shareButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.openShareModalEvent();
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
     * Also handles the Finish button in the header
     */
    setUploadPlatformEvent() {
        const handler = () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.uploadPlatformEvent();
        };

        if (this.uploadPlatformButton) {
            this.uploadPlatformButton.addEventListener('click', handler);
        }

        if (this.finishButton) {
            this.finishButton.addEventListener('click', handler);
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
     * Offline explicit Open action
     * File -> Offline actions -> Open
     */
    setOpenOfflineEvent() {
        if (!this.openOfflineButton) return;
        this.openOfflineButton.addEventListener('click', () => {
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
     * Offline explicit Save action
     * File -> Offline actions -> Save
     */
    setSaveProjectOfflineEvent() {
        if (!this.saveOfflineButton) return;
        this.saveOfflineButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return false;
            this.downloadProjectEvent();
            return false;
        });
    }

    /**
     * Download project (ELP) As... (offline)
     */
    setDownloadProjectAsEvent() {
        if (!this.downloadProjectAsButton) return;
        this.downloadProjectAsButton.addEventListener('click', () => {
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
     * Export Website directly to a folder (offline only)
     */
    setExportHTML5FolderAsEvent() {
        if (!this.exportHTML5FolderAsButton) return;
        this.exportHTML5FolderAsButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.exportHTML5FolderAsEvent();
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

    openPrintPreview() {
        // Open print preview modal
        const printPreviewModal = eXeLearning?.app?.modals?.printpreview;
        if (printPreviewModal) {
            printPreviewModal.show();
        } else {
            console.warn('[NavbarFile] Print preview modal not available');
            eXeLearning?.app?.modals?.alert?.show({
                title: _('Error'),
                body: _('Print preview is not available.'),
            });
        }
    }

    /**
     * Client-side preview using PreviewExporter (Yjs mode)
     * Generates HTML entirely in the browser and opens in new window
     * @returns {Promise<boolean>} - True if preview was handled client-side
     */
    async openClientPreview() {
        // Check if Yjs mode is enabled
        if (!eXeLearning.app.project?._yjsEnabled) {
            return false; // Fall back to server-side
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            console.warn('[NavbarFile] Yjs document manager not available for preview');
            return false;
        }

        // Check if PreviewExporter is loaded
        if (typeof window.PreviewExporter !== 'function') {
            console.warn('[NavbarFile] PreviewExporter not loaded');
            return false;
        }

        const toastData = {
            title: _('Preview'),
            body: _('Generating preview...'),
            icon: 'preview',
        };
        const toast = eXeLearning?.app?.toasts?.createToast
            ? eXeLearning.app.toasts.createToast(toastData)
            : null;

        try {
            // Get the document manager and asset cache from YjsBridge
            const documentManager = yjsBridge.documentManager;
            const assetCache = yjsBridge.assetCache || null;
            const assetManager = yjsBridge.assetManager || null;

            // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
            const resourceFetcher = yjsBridge.resourceFetcher || null;

            // Create PreviewExporter
            const exporter = new window.PreviewExporter(
                documentManager,
                assetCache,
                resourceFetcher,
                assetManager
            );

            // Generate preview
            Logger.log('[NavbarFile] Starting client-side preview...');
            const result = await exporter.preview();

            if (result.success) {
                if (toast) {
                    toast.toastBody.innerHTML = _('Preview opened in new window.');
                }
                Logger.log('[NavbarFile] Client-side preview opened successfully');
            } else {
                throw new Error(result.error || 'Preview failed');
            }

        } catch (error) {
            console.error('[NavbarFile] Client-side preview error:', error);
            if (toast) {
                toast.toastBody.innerHTML = _(
                    'An error occurred while generating the preview.'
                );
                toast.toastBody.classList.add('error');
                setTimeout(() => toast.remove(), 1500);
            }
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: error.message || _('Unknown error.'),
                contentId: 'error',
            });
            return true; // Error shown to user, no server fallback in Yjs mode
        }

        // Remove toast after delay
        if (toast) {
            setTimeout(() => toast.remove(), 1500);
        }

        return true; // Handled client-side
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

                        // Clean up orphaned modal backdrops
                        const ensureModalBackdropCleared = (delay = 0) => {
                            const removeBackdrops = () => {
                                document
                                    .querySelectorAll('.modal-backdrop')
                                    .forEach((backdrop) => backdrop.remove());
                                if (!document.querySelector('.modal.show')) {
                                    document.body.classList.remove('modal-open');
                                }
                            };

                            if (delay > 0) {
                                setTimeout(removeBackdrops, delay);
                            } else {
                                removeBackdrops();
                            }
                        };

                        try {
                            // Check if Yjs mode is enabled - import directly in browser
                            if (
                                eXeLearning.app.project?._yjsEnabled &&
                                eXeLearning.app.project?.importFromElpxViaYjs
                            ) {
                                // Import via Yjs (handles both standard .elpx and legacy contentv3.xml)
                                progressModal.setProcessingPhase('extracting');
                                Logger.log('[NavbarFile] Importing via Yjs (client-side):', file.name);

                                const stats = await eXeLearning.app.project.importFromElpxViaYjs(
                                    file,
                                    { clearExisting: false }
                                );

                                Logger.log('[NavbarFile] Yjs import complete:', stats);
                                progressModal.setComplete(
                                    true,
                                    _('Completed successfully') +
                                        ` (${stats?.pages || 0} ${_('pages')})`
                                );

                                setTimeout(() => {
                                    progressModal.hide();
                                    ensureModalBackdropCleared(350);
                                }, 600);
                            } else {
                                // Legacy: Upload file to server and use API
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

                                progressModal.setProcessingPhase('extracting');

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
                                    if (
                                        structure &&
                                        typeof structure.resetDataAndStructureData ===
                                            'function'
                                    ) {
                                        structure.resetDataAndStructureData(
                                            selectedNodeId || false
                                        );
                                    } else {
                                        eXeLearning.app.project.openLoad();
                                    }
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
        // Auto-collapse sidebar on mobile devices (< 768px)
        this.initMobileLayout();

        // See eXeLearning.app.common.initTooltips
        $(this.leftPanelsTogglerButton)
            .attr('data-bs-placement', 'bottom')
            .tooltip()
            .on('click', function () {
                $(this).tooltip('hide');
                $('body').toggleClass('left-column-hidden');
            });

        // Handle resize: collapse sidebar when transitioning to mobile
        window.addEventListener('resize', () => {
            this.handleResponsiveLayout();
        });

        // Close sidebar when tapping backdrop on mobile
        this.initMobileBackdropClose();
    }

    /**
     * Initialize mobile backdrop tap-to-close functionality
     * Closes sidebar when user taps the dark overlay area
     */
    initMobileBackdropClose() {
        document.addEventListener('click', (e) => {
            // Only on mobile
            if (window.innerWidth >= 768) return;

            // Only when sidebar is visible
            if (document.body.classList.contains('left-column-hidden')) return;

            // Check if click is on the backdrop (::after pseudo-element)
            // The backdrop covers the entire screen except the sidebar
            const sidebar = document.querySelector('.asideleft');
            if (!sidebar) return;

            const sidebarRect = sidebar.getBoundingClientRect();
            const clickX = e.clientX;
            const clickY = e.clientY;

            // If click is outside the sidebar bounds, close it
            const isOutsideSidebar =
                clickX > sidebarRect.right ||
                clickX < sidebarRect.left ||
                clickY > sidebarRect.bottom ||
                clickY < sidebarRect.top;

            // Also check if click is on the toggler button (don't close in that case)
            const toggler = document.getElementById('exe-panels-toggler');
            const isOnToggler = toggler && toggler.contains(e.target);

            if (isOutsideSidebar && !isOnToggler) {
                document.body.classList.add('left-column-hidden');
            }
        });
    }

    /**
     * Initialize mobile layout - collapse sidebar on mobile devices
     */
    initMobileLayout() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            document.body.classList.add('left-column-hidden');
        }
    }

    /**
     * Handle responsive layout changes on window resize
     */
    handleResponsiveLayout() {
        const isMobile = window.innerWidth < 768;
        // Only auto-collapse when transitioning TO mobile, don't force it
        // This allows users to manually expand on mobile if they want
        if (isMobile && !this._wasResizedToMobile) {
            document.body.classList.add('left-column-hidden');
            this._wasResizedToMobile = true;
        } else if (!isMobile) {
            this._wasResizedToMobile = false;
        }
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Creates a new session
     *
     */
    newProjectEvent() {
        const globalSuppressUntil = window.__exeSuppressNewProjectUntil || 0;
        if (
            this.suppressNewProjectEventUntil &&
            Date.now() < this.suppressNewProjectEventUntil
        ) {
            this.suppressNewProjectEventUntil = 0;
            return;
        }
        if (globalSuppressUntil && Date.now() < globalSuppressUntil) {
            window.__exeSuppressNewProjectUntil = 0;
            return;
        }

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
        // Check for unsaved changes using Yjs mechanism
        const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
        const hasUnsaved =
            yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

        if (hasUnsaved) {
            // Show confirmation modal with save option
            const data = {
                title: _('New file'),
                forceOpen: _('Create new file without saving'),
                pendingAction: { action: 'new' },
            };
            eXeLearning.app.modals.sessionlogout.show(data);
        } else {
            // No unsaved changes, create new session directly
            this.createSession();
        }
    }

    /**
     * createSession
     * Creates a new project/session. Always does a full page reload in online mode.
     */
    async createSession() {
        if (
            this.isStaticMode() &&
            typeof window.newProject === 'function'
        ) {
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
            window.onbeforeunload = null;
            window.newProject();
            return;
        }

        // Use transitionToProject for a clean full-page-reload transition
        if (eXeLearning.app.project?.transitionToProject) {
            try {
                await eXeLearning.app.project.transitionToProject({
                    action: 'new',
                    skipSave: true,
                });
                return;
            } catch (error) {
                console.error('[NavbarFile] Failed to create new project:', error);
                // Fall through to legacy behavior
            }
        }

        // Legacy fallback: redirect to projects page
        window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
        window.onbeforeunload = null;
        const basePath = window.eXeLearning?.config?.basePath || '';
        window.location.href = `${basePath}/projects`;
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
     * Open the project settings panel
     *
     */
    openProjectSettingsEvent() {
        document
            .querySelector('[nav-id="root"]')
            ?.querySelectorAll('.nav-element-text')[0]
            ?.click();
    }

    /**
     * Open the share modal
     *
     */
    openShareModalEvent() {
        if (eXeLearning.app.modals?.share) {
            eXeLearning.app.modals.share.show();
        } else {
            Logger.warn('Share menu: Share modal not available');
        }
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

        // Get project UUID - in Yjs mode this is the project ID, otherwise use odeSession
        const projectUuid = eXeLearning.app.project.yjsProjectId ||
                           eXeLearning.app.project.odeId ||
                           eXeLearning.app.project.odeSession;

        // Save project to server before uploading to platform
        // This ensures the Yjs document is persisted
        try {
            if (eXeLearning.app.project._yjsBridge?.getDocumentManager) {
                const docManager = eXeLearning.app.project._yjsBridge.getDocumentManager();
                if (docManager?.saveToServer) {
                    await docManager.saveToServer();
                    console.log('[NavbarFile] Project saved to server before platform upload');
                }
            }
        } catch (saveError) {
            console.warn('[NavbarFile] Failed to save before platform upload:', saveError);
            // Continue anyway - server might have the document from WebSocket sync
        }

        let data = {
            projectUuid: projectUuid,
            jwt_token: jwt_token,
        };
        // Upload to platform
        let response;

        response =
            await eXeLearning.app.api.postFirstTypePlatformIntegrationElpUpload(
                data
            );

        if (response.responseMessage == 'OK') {
            window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
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
            // Use e.target instead of querySelector to get the actual input that triggered the event
            let uploadOdeFile = e.target;
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            // Only proceed if a file was actually selected
            if (odeFile) {
                eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                    odeFile
                );
            }
        });
        this.menu.navbar.append(inputUpload);
        return inputUpload;
    }

    /**
     * Show list of elp on perm
     *
     */
    openUserOdeFilesEvent() {
        // Static mode: use client-side file input directly (no server storage)
        // Note: Only trigger static mode if capabilities are available AND remote is explicitly false
        const capabilities = eXeLearning?.app?.capabilities;
        if (capabilities && !capabilities.storage.remote) {
            this.openFileInputStatic();
            return;
        }

        if (eXeLearning.config.isOfflineInstallation === true) {
            // Electron offline: use native dialog so we know the real path
            if (
                window.electronAPI &&
                typeof window.electronAPI.openElp === 'function'
            ) {
                (async () => {
                    const filePath = await window.electronAPI.openElp();
                    if (!filePath) return;
                    // Read and build a File for existing upload flow
                    const res = await window.electronAPI.readFile(filePath);
                    if (!res || !res.ok) {
                        eXeLearning.app.modals.alert.show({
                            title: _('Error opening'),
                            body:
                                res && res.error
                                    ? res.error
                                    : _('Unknown error.'),
                            contentId: 'error',
                        });
                        return;
                    }
                    const base64 = res.base64;
                    const binStr = atob(base64);
                    const len = binStr.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++)
                        bytes[i] = binStr.charCodeAt(i);
                    const blob = new Blob([bytes], {
                        type: 'application/octet-stream',
                    });
                    // Derive filename in a cross-platform way (Windows/Mac/Linux)
                    const filename =
                        (filePath && filePath.split(/[\\/]/).pop()) ||
                        'project.elpx';
                    const file = new File([blob], filename, {
                        type: 'application/octet-stream',
                        lastModified: Date.now(),
                    });
                    // Store original local path so we can remember it after open
                    try {
                        window.__originalElpPath = filePath;
                    } catch (_e) {
                        // Intentional: Electron-specific assignment may fail
                    }
                    eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                        file
                    );
                })();
            } else {
                // Fallback to hidden input
                this.createIdevicesUploadInput();
                this.menu.navbar
                    .querySelector('input.local-ode-file-upload-input')
                    .click();
            }
        } else {
            // Get ode files
            this.getOdeFilesListEvent().then((response) => {
                eXeLearning.app.modals.openuserodefiles.show(response);
            });
        }
    }

    /**
     * Opens file input for static mode (PWA/offline)
     * Uses ElpxImporter directly without server APIs
     */
    openFileInputStatic() {
        // Create or reuse a hidden file input
        let fileInput = document.getElementById('static-open-file-input');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'static-open-file-input';
            fileInput.accept = '.elpx,.elp,.zip';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    // Reuse unified open flow (handles unsaved modal + static import)
                    eXeLearning.app.modals.openuserodefiles.largeFilesUpload(file);
                }
                // Reset for next use
                e.target.value = '';
            });
        }

        fileInput.click();
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
                    const projectUuid = odeFile.odeId;

                    // Check for unsaved changes in Yjs architecture
                    const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
                    const hasUnsaved =
                        yjsBridge?.documentManager?.hasUnsavedChanges?.() ||
                        false;

                    if (hasUnsaved) {
                        // Show confirmation modal with pendingAction
                        const data = {
                            title: _('Open project'),
                            forceOpen: _('Open without saving'),
                            pendingAction: { action: 'open', projectUuid },
                        };
                        eXeLearning.app.modals.sessionlogout.show(data);
                    } else {
                        // No unsaved changes, navigate directly
                        const basePath = window.eXeLearning?.config?.basePath || '';
                        window.location.href = `${basePath}/workarea?project=${projectUuid}`;
                    }
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
        // Check if Yjs mode is enabled - use Yjs export
        if (eXeLearning.app.project?._yjsEnabled &&
            eXeLearning.app.project?.exportToElpxViaYjs) {
            return await this.downloadProjectViaYjs();
        }

        // Legacy: Download via REST API
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
            this.electronSave(
                response['urlZipFile'],
                eXeLearning.extension,
                response['exportProjectName']
            );
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
     * Download project via Yjs collaborative system
     * Exports the Y.Doc to .elpx format directly in browser
     * In Electron/Desktop mode: always prompts for save destination
     */
    async downloadProjectViaYjs() {
        let toastData = {
            title: _('Save'),
            body: _('Generating file from collaborative document...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);

        try {
            const result = await eXeLearning.app.project.exportToElpxViaYjs();

            // If user cancelled the OS save dialog, leave project dirty
            if (result?.saved === false) {
                toast.remove();
                return;
            }

            toast.toastBody.innerHTML = _('File saved.');
            Logger.log('[NavbarFile] Project saved via Yjs');

            // In offline/static mode, export acts as the save operation.
            // Mark document clean so the save indicator turns green.
            const capabilities = eXeLearning?.app?.capabilities;
            const isOfflineLike = window.electronAPI || (capabilities && capabilities.storage?.remote === false);
            if (isOfflineLike) {
                const docManager = eXeLearning?.app?.project?._yjsBridge?.documentManager;
                if (docManager?.markClean) {
                    docManager.markClean();
                }
            }

        } catch (error) {
            console.error('[NavbarFile] Yjs save error:', error);
            toast.toastBody.innerHTML = _(
                'An error occurred while saving the file.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: error.message || _('Unknown error.'),
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
     * Client-side export via SharedExporters (unified TypeScript pipeline)
     * Runs entirely in the browser using the Yjs document and assets
     * @param {string} format - Export format: 'HTML5', 'PAGE', 'SCORM12', 'SCORM2004', 'IMS', 'EPUB3'
     * @param {string} fallbackApiFormat - API format string for server-side fallback
     * @param {Object} options - Export options
     * @param {boolean} options.saveAs - If true, always prompt for save location (Electron only)
     * @returns {Promise<boolean>} - True if export was handled client-side
     */
    async exportViaYjs(format, fallbackApiFormat, options = {}) {
        // Check if Yjs mode is enabled and required components are available
        if (!eXeLearning.app.project?._yjsEnabled) {
            return false; // Fall back to server-side
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            console.warn('[NavbarFile] Yjs document manager not available');
            return false;
        }

        // Require SharedExporters (unified TypeScript export system)
        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.createExporter) {
            console.error('[NavbarFile] SharedExporters not loaded - ensure exporters.bundle.js is included');
            return false;
        }

        // For formats not yet implemented client-side, fall back to server
        const supportedFormats = ['HTML5', 'ELPX', 'ELP', 'SCORM12', 'SCORM2004', 'PAGE', 'HTML5SP', 'IMS', 'EPUB3', 'EPUB'];
        const normalizedFormat = format.toUpperCase().replace('-', '');
        if (!supportedFormats.includes(normalizedFormat)) {
            Logger.log(`[NavbarFile] Format ${format} not yet supported client-side, using server`);
            return false;
        }

        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);

        try {
            // Get the document manager and asset managers from YjsBridge
            const documentManager = yjsBridge.documentManager;
            // Note: assetManager (new) contains actual imported assets in 'exelearning-assets-v2' database
            // assetCache (legacy) uses 'exelearning-assets' database which may be empty
            const assetManager = yjsBridge.assetManager || null;
            const assetCache = yjsBridge.assetCache || null;

            // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
            const resourceFetcher = yjsBridge.resourceFetcher || null;

            // Export using quickExport which auto-injects LaTeX pre-renderer hook
            // This enables SVG+MathML generation in exports (skipping MathJax ~1MB)
            Logger.log(`[NavbarFile] Starting unified ${format} export via SharedExporters...`);
            const result = await SharedExporters.quickExport(
                format,
                documentManager,
                assetCache,
                resourceFetcher,
                {}, // options
                assetManager
            );

            if (result.success && result.data) {
                // Check if Electron mode - use Electron save API for desktop behavior
                if (
                    eXeLearning?.config?.isOfflineInstallation &&
                    window.electronAPI?.saveBuffer
                ) {
                    const uint8Array = new Uint8Array(result.data);
                    const key = window.__currentProjectId || 'default';
                    const exportKey = `${key}:${fallbackApiFormat}`;
                    const exportFilename = result.filename || 'export.zip';

                    const saved = await window.electronAPI.saveBuffer(
                        uint8Array,
                        exportKey,
                        exportFilename
                    );
                    const wasSaved =
                        typeof saved === 'object' && saved !== null
                            ? saved.saved === true
                            : saved === true;
                    if (!wasSaved) {
                        toast.remove();
                        return true; // Handled client-side (cancel should not trigger server fallback)
                    }
                    Logger.log(
                        `[NavbarFile] Unified export via Electron: ${exportFilename}`
                    );
                } else {
                    // Browser mode: use blob URL download
                    const blob = new Blob([result.data], {
                        type: 'application/zip',
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = result.filename || `export.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    Logger.log(
                        `[NavbarFile] Unified export complete: ${result.filename}`
                    );
                }

                toast.toastBody.innerHTML = _('The project has been exported.');
            } else {
                throw new Error(result.error || 'Export failed');
            }

        } catch (error) {
            console.error(`[NavbarFile] Client-side ${format} export error:`, error);
            toast.toastBody.innerHTML = _(
                'An error occurred while exporting the project.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: error.message || _('Unknown error.'),
                contentId: 'error',
            });
        }

        // Remove message
        setTimeout(() => {
            toast.remove();
        }, 1000);

        // Reload last edition text in interface
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();

        return true; // Handled client-side
    }

    /**
     * Export the ode as HTML5 and download it
     *
     */
    async exportHTML5Event() {
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('HTML5', 'html5');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-html5',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode) with saveAs behavior
        const handledClientSide = await this.exportViaYjs('HTML5', 'html5', {
            saveAs: true,
        });
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-html5'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-html5`,
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
     * Export Website to folder (unzipped) — offline Electron only
     */
    async exportHTML5FolderAsEvent() {
        let toastData = {
            title: _('Export'),
            body: _('Generating export files...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        try {
            if (
                !eXeLearning.config.isOfflineInstallation ||
                !window.electronAPI
            ) {
                toast.toastBody.innerHTML = _(
                    'This option is only available offline.'
                );
                toast.toastBody.classList.add('error');
                setTimeout(() => toast.remove(), 1200);
                return;
            }

            // Try client-side export first (Yjs mode)
            if (
                eXeLearning.app.project?._yjsEnabled &&
                window.SharedExporters?.quickExport
            ) {
                const yjsBridge = eXeLearning.app.project._yjsBridge;
                if (yjsBridge?.documentManager) {
                    const documentManager = yjsBridge.documentManager;
                    const assetManager = yjsBridge.assetManager || null;
                    const assetCache = yjsBridge.assetCache || null;
                    // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
                    const resourceFetcher = yjsBridge.resourceFetcher || null;

                    const result = await window.SharedExporters.quickExport(
                        'HTML5',
                        documentManager,
                        assetCache,
                        resourceFetcher,
                        {},
                        assetManager
                    );

                    if (result.success && result.data) {
                        // Convert ArrayBuffer to base64 for IPC transfer
                        const uint8Array = new Uint8Array(result.data);
                        let binary = '';
                        for (let i = 0; i < uint8Array.length; i++) {
                            binary += String.fromCharCode(uint8Array[i]);
                        }
                        const base64Data = btoa(binary);
                        const suggestedBase = (
                            result.filename || 'export'
                        ).replace(/\.zip$/i, '');

                        if (
                            typeof window.electronAPI.exportBufferToFolder ===
                            'function'
                        ) {
                            const folderResult =
                                await window.electronAPI.exportBufferToFolder(
                                    base64Data,
                                    suggestedBase
                                );
                            if (folderResult && folderResult.ok) {
                                toast.toastBody.innerHTML = _(
                                    'The project has been exported.'
                                );
                            } else if (folderResult && folderResult.canceled) {
                                toast.toastBody.innerHTML = _('Export canceled.');
                            } else {
                                throw new Error(
                                    folderResult?.error || 'Folder export failed'
                                );
                            }
                        } else {
                            // Fallback: download as zip
                            const blob = new Blob([result.data], {
                                type: 'application/zip',
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = result.filename || 'export.zip';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            toast.toastBody.innerHTML = _(
                                'The project has been exported.'
                            );
                        }
                        setTimeout(() => toast.remove(), 1000);
                        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
                        return;
                    }
                }
            }

            // Fall back to server-side export
            let odeSessionId = eXeLearning.app.project.odeSession;
            let response = await eXeLearning.app.api.getOdeExportDownload(
                odeSessionId,
                'html5'
            );
            if (response && response['responseMessage'] === 'OK') {
                const url = response['urlZipFile'];
                const suggestedBase = this.normalizeSuggestedName(
                    response['exportProjectName'],
                    'export-html5'
                ).replace(/\.zip$/i, '');
                const keyBase = window.__currentProjectId || 'default';

                if (typeof window.electronAPI.exportToFolder === 'function') {
                    const result = await window.electronAPI.exportToFolder(
                        url,
                        `${keyBase}:export-html5-folder`,
                        suggestedBase
                    );
                    if (result && result.ok) {
                        toast.toastBody.innerHTML = _(
                            'The project has been exported.'
                        );
                    } else {
                        toast.toastBody.innerHTML = _('Export canceled.');
                    }
                } else {
                    // Fallback: download as zip if folder export is not available
                    this.downloadLink(url, `${suggestedBase}.zip`);
                    toast.toastBody.innerHTML = _(
                        'The project has been exported.'
                    );
                }
            } else {
                toast.toastBody.innerHTML = _(
                    'An error occurred while exporting the project.'
                );
                toast.toastBody.classList.add('error');
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body:
                        response && response['responseMessage']
                            ? response['responseMessage']
                            : _('Unknown error.'),
                    contentId: 'error',
                });
            }
        } catch (e) {
            console.error('[NavbarFile] Folder export error:', e);
            toast.toastBody.innerHTML = _('Unexpected error.');
            toast.toastBody.classList.add('error');
        }
        setTimeout(() => toast.remove(), 1000);
        eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
    }

    /**
     * Export the ode as HTML5 Single Page and download it
     *
     */
    async exportHTML5SPEvent() {
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('PAGE', 'html5-sp');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-html5-sp',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('PAGE', 'html5-sp');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-html5-sp'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-html5-sp`,
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
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM12Event() {
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('SCORM12', 'scorm12');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-scorm12',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('SCORM12', 'scorm12');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-scorm12'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-scorm12`,
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
     * Export the ode as SCORM 1.2 and download it
     *
     */
    async exportSCORM2004Event() {
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('SCORM2004', 'scorm2004');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-scorm2004',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('SCORM2004', 'scorm2004');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('IMS', 'ims');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-ims',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('IMS', 'ims');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-ims'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-ims`,
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
     * Export the ode as ePub3 and download it
     *
     */
    async exportEPUB3Event() {
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('EPUB3', 'epub3');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-epub3',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
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
        // Try client-side export first (Yjs mode)
        const handledClientSide = await this.exportViaYjs('EPUB3', 'epub3');
        if (handledClientSide) {
            return;
        }

        // Fall back to server-side export
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-epub3'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-epub3`,
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
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                this.electronSave(
                    response['urlZipFile'],
                    'export-xml-properties',
                    response['exportProjectName']
                );
            } else {
                this.downloadLink(
                    response['urlZipFile'],
                    response['exportProjectName']
                );
            }
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
            const url = response['urlZipFile'];
            const suggested = this.normalizeSuggestedName(
                response['exportProjectName'],
                'export-xml-properties'
            );
            const keyBase = window.__currentProjectId || 'default';
            if (
                window.electronAPI &&
                typeof window.electronAPI.saveAs === 'function'
            ) {
                await window.electronAPI.saveAs(
                    url,
                    `${keyBase}:export-xml-properties`,
                    suggested
                );
            } else {
                this.downloadLink(url, suggested);
            }
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
            // Use e.target instead of querySelector to get the actual input that triggered the event
            let uploadOdeFile = e.target;
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createPropertiesUploadInput();
            inputUpload.remove();
            this.menu.navbar.append(newUploadInput);

            // Only proceed if a file was actually selected
            if (odeFile) {
                eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                    odeFile,
                    false,
                    true
                );
            }
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
                // In Electron offline builds, always prefer native save flow to avoid duplicate pickers
                if (
                    eXeLearning.config.isOfflineInstallation === true &&
                    window.electronAPI &&
                    typeof window.electronAPI.save === 'function'
                ) {
                    const key = window.__currentProjectId || 'default';
                    const suggested =
                        typeof $name === 'string' && $name
                            ? $name
                            : 'document.elpx';
                    // Try to infer a typeKey from the extension for better naming
                    let typeKey = eXeLearning.extension;
                    try {
                        if (/export-html5-sp/i.test(suggested))
                            typeKey = 'export-html5-sp';
                        else if (/export-html5/i.test(suggested))
                            typeKey = 'export-html5';
                        else if (/export-scorm2004/i.test(suggested))
                            typeKey = 'export-scorm2004';
                        else if (/export-scorm12/i.test(suggested))
                            typeKey = 'export-scorm12';
                        else if (/export-ims/i.test(suggested))
                            typeKey = 'export-ims';
                        else if (/export-epub3/i.test(suggested))
                            typeKey = 'export-epub3';
                        else if (/xml/i.test(suggested))
                            typeKey = 'export-xml-properties';
                        else if (/\.zip$/i.test(suggested)) typeKey = 'export';
                    } catch (_e) {
                        // Intentional: defaults to generic export type if parsing fails
                    }
                    const safeName = this.normalizeSuggestedName(
                        suggested,
                        typeKey
                    );
                    window.electronAPI.save(finalUrl, key, safeName);
                    return;
                }
                // Browser fallback
                let downloadLink = document.createElement('a');
                downloadLink.href = finalUrl;
                downloadLink.download = $name;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            });
    }

    /**
     * Offline helper: remember per-export-type path
     * @param {string} url
     * @param {string} typeKey
     * @param {string} suggestedName
     */
    electronSave(url, typeKey, suggestedName) {
        const keyBase = window.__currentProjectId || 'default';
        // For standard project save (ELP), reuse the base key so Save after Save As uses same path
        const key =
            typeKey === eXeLearning.extension
                ? keyBase
                : `${keyBase}:${typeKey}`;
        const safeName = this.normalizeSuggestedName(suggestedName, typeKey);
        if (
            window.electronAPI &&
            typeof window.electronAPI.save === 'function'
        ) {
            window.electronAPI.save(url, key, safeName);
        } else {
            this.downloadLink(url, safeName);
        }
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
                } catch (_e) {
                    // Intentional: use default name if project properties unavailable
                }
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

    /**
     * Check if the file is a legacy .elp with contentv3.xml (Python pickle format)
     * These files cannot be parsed in the browser and need backend conversion.
     *
     * @param {File} file - The .elp or .elpx file
     * @returns {Promise<boolean>} - True if it's a legacy format
     */
    async checkIfLegacyElpFormat(file) {
        try {
            const fflateLib = window.fflate;
            if (!fflateLib) {
                console.warn('[NavbarFile] fflate not available for format detection');
                return false;
            }

            const arrayBuffer = await file.arrayBuffer();
            const uint8Data = new Uint8Array(arrayBuffer);
            const zip = fflateLib.unzipSync(uint8Data);

            // Check if contentv3.xml exists (legacy marker)
            const contentV3 = zip['contentv3.xml'];
            if (!contentV3) {
                // Has content.xml (standard format) - not legacy
                return false;
            }

            // Read contentv3.xml to check if it's Python pickle XML
            const xmlContent = new TextDecoder().decode(contentV3);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

            // Python pickle format has <instance> or <dictionary> as root element
            const rootTag = xmlDoc.documentElement?.tagName;
            if (rootTag === 'instance' || rootTag === 'dictionary') {
                Logger.log('[NavbarFile] Detected Python pickle format (legacy)');
                return true;
            }

            // contentv3.xml exists but has standard XML format (rare case)
            return false;
        } catch (error) {
            console.error('[NavbarFile] Error detecting file format:', error);
            // On error, assume not legacy and try direct import (which will fail gracefully)
            return false;
        }
    }

    /**
     * Convert legacy .elp file via backend API
     * The backend uses LegacyXmlParserService to convert Python pickle XML to standard format.
     *
     * @param {File} file - The legacy .elp file
     * @param {Object} progressModal - Progress modal for UI updates
     * @returns {Promise<{success: boolean, structure?: Object, assets?: Array, error?: string}>}
     */
    async convertLegacyElpViaBackend(file, progressModal) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', eXeLearning.app.project.odeSession);

            const basePath = window.eXeLearning?.config?.basePath || '';
            const response = await fetch(`${basePath}/api/project/convert-legacy`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${eXeLearning.app.auth?.token || ''}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.message || `Server error: ${response.status}`
                };
            }

            const data = await response.json();

            return {
                success: true,
                structure: data.structure,
                assets: data.assets || []
            };
        } catch (error) {
            console.error('[NavbarFile] Legacy conversion failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to convert legacy file'
            };
        }
    }
}
