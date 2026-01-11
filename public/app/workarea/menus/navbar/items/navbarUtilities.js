// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        this.button = this.menu.navbar.querySelector('#dropdownUtilities');
        this.preferencesButton = document.querySelector(
            '#navbar-button-preferences'
        );
        this.ideviceManagerButton = this.menu.navbar.querySelector(
            '#navbar-button-idevice-manager'
        );
        this.brokenLinksButton = this.menu.navbar.querySelector(
            '#navbar-button-odebrokenlinks'
        );
        this.filemanagerButton = this.menu.navbar.querySelector(
            '#navbar-button-filemanager'
        );
        this.usedFilesButton = this.menu.navbar.querySelector(
            '#navbar-button-odeusedfiles'
        );
        this.previewButton = this.menu.navbar.querySelector(
            '#navbar-button-preview'
        );
        this.projectPreferencesButton = document.querySelector(
            '#head-top-settings-button'
        );
    }

    /**
     *
     */
    setEvents() {
        this.setTooltips();
        this.setPreferencesEvent();
        this.setIdeviceManagerEvent();
        this.setFileManagerEvent();
        this.setOdeBrokenLinksEvent();
        this.setOdeUsedFilesEvent();
        this.setPreviewEvent();
        this.setProjectPreferencesEvent();
    }

    /**************************************************************************************
     * LISTENERS
     **************************************************************************************/

    /**
     *
     *
     */
    setTooltips() {
        // See eXeLearning.app.common.initTooltips
        // Avoid binding tooltips to dropdown toggles to prevent Bootstrap instance conflicts
        $('.main-menu-right > button')
            .attr('data-bs-placement', 'bottom')
            .tooltip();
    }

    /**
     * Preferences form
     * Utilities (now user menu) -> Preferences
     *
     */
    setPreferencesEvent() {
        this.preferencesButton.addEventListener('click', (e) => {
            if (eXeLearning.app.project.checkOpenIdevice()) {
                e.preventDefault();
                return false;
            }
            this.preferencesEvent();
            e.preventDefault();
        });
    }

    /**
     * iDevice manager
     * Utilities -> iDevice manager
     *
     */
    setIdeviceManagerEvent() {
        this.ideviceManagerButton.addEventListener('click', () => {
            this.ideviceManagerEvent();
        });
    }

    /**
     * File Manager
     * Utilities -> File Manager
     *
     */
    setFileManagerEvent() {
        this.filemanagerButton.addEventListener('click', () => {
            this.fileManagerEvent();
        });
    }

    /**
     * Broken links
     * Utilities -> Link Validation Report
     *
     */
    setOdeBrokenLinksEvent() {
        this.brokenLinksButton.addEventListener('click', () => {
            this.odeBrokenLinksEvent();
        });
    }

    /**
     * Used Files
     * Utilities -> Resource Report
     *
     */
    setOdeUsedFilesEvent() {
        this.usedFilesButton.addEventListener('click', () => {
            this.odeUsedFilesEvent();
        });
    }

    /**
     * Preview
     * Utilities -> Preview
     *
     */
    setPreviewEvent() {
        this.previewButton.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            this.previewEvent();
        });
    }

    setProjectPreferencesEvent() {
        this.projectPreferencesButton.addEventListener('click', () => {
            document
                .querySelector('[nav-id="root"]')
                ?.querySelectorAll('.nav-element-text')[0]
                ?.click();
        });
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Show app preferences modal
     *
     */
    preferencesEvent() {
        eXeLearning.app.user.preferences.showModalPreferences();
    }

    /**
     * Show idevice manager modal
     *
     */
    ideviceManagerEvent() {
        eXeLearning.app.idevices.showModalIdeviceManager();
    }

    /**
     * Show File Manager modal
     *
     */
    fileManagerEvent() {
        eXeLearning.app.modals.filemanager.show();
    }

    /**
     * Opens the link validation modal with progressive validation
     * Modal shows all links immediately with spinners, then updates as validation completes
     */
    odeBrokenLinksEvent() {
        // Collect all idevices HTML content for validation
        const idevices = this.collectAllIdevicesHtml();

        // Open modal immediately - validation happens inside the modal
        eXeLearning.app.modals.odebrokenlinks.show(idevices);
    }

    /**
     * Get the broken links in all ode on the session (legacy method for compatibility)
     * @returns {Promise<Object>}
     * @deprecated Use odeBrokenLinksEvent() for progressive validation UI
     */
    async getOdeSessionBrokenLinksEvent() {
        const sessionId = eXeLearning.app.project.odeSession;

        // Collect all idevices HTML content for validation
        const idevices = this.collectAllIdevicesHtml();

        const params = {
            csv: false,
            odeSessionId: sessionId,
            idevices: idevices,
        };
        const odeSessionBrokenLinks =
            await eXeLearning.app.api.getOdeSessionBrokenLinks(params);
        return odeSessionBrokenLinks;
    }

    /**
     * Collect HTML content from all idevices in the project
     * @returns {Array} Array of idevice data with HTML content
     */
    collectAllIdevicesHtml() {
        const idevices = [];

        // Check if Yjs project manager is available
        if (!eXeLearning.app.project._yjsBridge?.structureBinding) {
            console.warn('[NavbarUtilities] Yjs structure binding not available');
            return idevices;
        }

        const structureBinding = eXeLearning.app.project._yjsBridge.structureBinding;
        const navigation = structureBinding.manager?.getNavigation();

        if (!navigation) {
            console.warn('[NavbarUtilities] Navigation not available');
            return idevices;
        }

        // Iterate through all pages
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i);
            const pageName = pageMap.get('title') || pageMap.get('name') || '';
            const blocks = pageMap.get('blocks');

            if (!blocks) continue;

            // Iterate through all blocks in the page
            for (let j = 0; j < blocks.length; j++) {
                const blockMap = blocks.get(j);
                const blockName = blockMap.get('blockName') || blockMap.get('title') || blockMap.get('name') || '';
                const components = blockMap.get('components');

                if (!components) continue;

                // Iterate through all components (idevices) in the block
                for (let k = 0; k < components.length; k++) {
                    const compMap = components.get(k);

                    // Get HTML content (try htmlContent first, then htmlView)
                    let htmlContent = '';
                    const rawHtmlContent = compMap.get('htmlContent');
                    const rawHtmlView = compMap.get('htmlView');

                    if (rawHtmlContent) {
                        // Y.Text or string
                        htmlContent = typeof rawHtmlContent.toString === 'function'
                            ? rawHtmlContent.toString()
                            : String(rawHtmlContent);
                    } else if (rawHtmlView) {
                        htmlContent = String(rawHtmlView);
                    }

                    // Also check jsonProperties for links (some idevices store URLs there)
                    const jsonProperties = compMap.get('jsonProperties');
                    if (jsonProperties) {
                        // Append JSON properties to HTML for link extraction
                        htmlContent += ' ' + (typeof jsonProperties === 'string'
                            ? jsonProperties
                            : JSON.stringify(jsonProperties));
                    }

                    if (htmlContent) {
                        idevices.push({
                            html: htmlContent,
                            pageName: pageName,
                            blockName: blockName,
                            ideviceType: compMap.get('ideviceType') || '',
                            order: compMap.get('order') ?? k,
                        });
                    }
                }
            }
        }

        console.log(`[NavbarUtilities] Collected ${idevices.length} idevices for link validation`);
        return idevices;
    }

    /**
     * Gets the ode used files and shows it in a modal
     *
     */
    odeUsedFilesEvent() {
        // Show message
        let toastData = {
            title: _('Resources report'),
            body: _('Checking the project resources...'),
            icon: 'downloading',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        // Get ode used files
        this.getOdeSessionUsedFilesEvent().then((response) => {
            if (response.responseMessage == 'OK' && response.usedFiles) {
                // Show eXe UsedFilesList modal
                eXeLearning.app.modals.odeusedfiles.show(response);
            } else {
                // Open eXe alert modal
                eXeLearning.app.modals.alert.show({
                    title: _('Resources report'),
                    body: _('The project has no files.'),
                });
            }
            // Remove message
            setTimeout(() => {
                toast.remove();
            }, 800);
        });
    }

    /**
     * Get the used files in all ode on the session
     * @returns
     */
    async getOdeSessionUsedFilesEvent() {
        let sessionId = eXeLearning.app.project.odeSession;

        // Collect all idevices HTML content
        let idevices = this.collectAllIdevicesHtml();

        // Collect asset metadata from IndexedDB for assets referenced in idevices
        let assetMetadata = await this.collectAssetMetadata(idevices);

        let params = {
            csv: false,
            odeSessionId: sessionId,
            resourceReport: true,
            idevices: idevices,
            assetMetadata: assetMetadata,
        };
        let odeSessionUsedFiles =
            await eXeLearning.app.api.getOdeSessionUsedFiles(params);
        return odeSessionUsedFiles;
    }

    /**
     * Collect metadata for all assets referenced in idevices HTML
     * @param {Array} idevices - Array of idevice objects with html property
     * @returns {Promise<Object>} Map of assetId -> {filename, size, mime}
     */
    async collectAssetMetadata(idevices) {
        const assetMetadata = {};

        // Get asset manager from Yjs bridge
        const assetManager = eXeLearning.app.project?._yjsBridge?.assetManager;
        if (!assetManager) {
            console.warn('[NavbarUtilities] AssetManager not available');
            return assetMetadata;
        }

        // Extract all unique asset IDs from idevices HTML
        const assetIds = new Set();
        const assetRegex = /asset:\/\/([a-f0-9-]+)/gi;

        for (const idevice of idevices) {
            if (!idevice.html) continue;
            let match;
            while ((match = assetRegex.exec(idevice.html)) !== null) {
                assetIds.add(match[1]);
            }
        }

        // Get metadata for each asset from IndexedDB
        for (const assetId of assetIds) {
            try {
                const asset = await assetManager.getAsset(assetId);
                if (asset) {
                    assetMetadata[assetId] = {
                        filename: asset.filename || null,
                        size: asset.size || 0,
                        mime: asset.mime || 'application/octet-stream',
                    };
                }
            } catch (error) {
                console.warn(`[NavbarUtilities] Failed to get metadata for asset ${assetId}:`, error);
            }
        }

        Logger.log(`[NavbarUtilities] Collected metadata for ${Object.keys(assetMetadata).length} assets`);
        return assetMetadata;
    }

    /**
     * Get an csv string from the json
     *
     * @param {*} objArray
     * @param {*} headerTitles
     * @returns {String}
     */
    json2Csv(objArray, headerTitles) {
        // Parse objArray if it's a JSON string
        const parsedObj =
            typeof objArray === 'string' ? JSON.parse(objArray) : objArray;

        // Determine which array to export based on headerTitles
        // If headerTitles contains 'Link' or 'Error' → brokenLinks
        // If headerTitles contains 'File' → usedFiles
        let dataArray = [];
        let keyMap = {};

        if (headerTitles.includes('Link') || headerTitles.includes('Error')) {
            dataArray = parsedObj.brokenLinks || [];
            keyMap = {
                Link: 'brokenLinks',
                Error: 'brokenLinksError',
                Times: 'nTimesBrokenLinks',
                'Page name': 'pageNamesBrokenLinks',
                'Block name': 'blockNamesBrokenLinks',
                Type: 'typeComponentSyncBrokenLinks',
                'Block position': 'orderComponentSyncBrokenLinks',
            };
        } else if (headerTitles.includes('File')) {
            dataArray = parsedObj.usedFiles || [];
            keyMap = {
                File: 'usedFiles',
                Path: 'usedFilesPath',
                Size: 'usedFilesSize',
                'Page name': 'pageNamesUsedFiles',
                'Block name': 'blockNamesUsedFiles',
                Type: 'typeComponentSyncUsedFiles',
                'Block position': 'orderComponentSyncUsedFiles',
            };
        } else {
            // Unknown type, return empty CSV with headers
            return headerTitles.join(',') + '\r\n';
        }

        // CSV string initialization
        let csv = '';
        csv += headerTitles.join(',') + '\r\n';

        // Add data rows
        dataArray.forEach((item) => {
            // For brokenLinks, skip rows where Error is null/undefined
            if (
                keyMap['Error'] &&
                (item[keyMap['Error']] === null ||
                    item[keyMap['Error']] === undefined)
            ) {
                return;
            }

            const row = headerTitles
                .map((title) => {
                    let value = item[keyMap[title]];

                    if (value === null || value === undefined) value = '';

                    // Escape commas, quotes, and newlines
                    if (
                        typeof value === 'string' &&
                        (value.includes(',') ||
                            value.includes('"') ||
                            value.includes('\n'))
                    ) {
                        value = `"${value.replace(/"/g, '""')}"`;
                    }

                    return value;
                })
                .join(',');

            csv += row + '\r\n';
        });

        return csv;
    }

    /**
     * Export the ode as HTML5 and view it
     *
     */
    async previewEvent() {
        // Try panel-based preview first (new UI)
        const previewPanel = eXeLearning.app.interface?.previewButton?.getPanel();
        if (previewPanel) {
            previewPanel.toggle();
            return;
        }

        // Fallback: Try client-side popup preview (Yjs mode)
        if (eXeLearning.app.project?._yjsEnabled) {
            const handled = await this.openClientPreview();
            if (handled) return;
        }

        // Fall back to server-side preview (legacy mode)
        let toastData = {
            title: _('Preview'),
            body: _('Generating preview...'),
            icon: 'preview',
        };
        let toast = eXeLearning.app.toasts.createToast(toastData);
        let odeSessionId = eXeLearning.app.project.odeSession;
        let response = await eXeLearning.app.api.getOdePreviewUrl(odeSessionId);
        if (response['responseMessage'] == 'OK') {
            toast.toastBody.innerHTML = _('The preview has been generated.');
            setTimeout(() => {
                window.open(response['urlPreviewIndex']);
            }, 100);
        } else {
            toast.toastBody.innerHTML = _(
                'An error occurred while generating the preview.'
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
    }

    /**
     * Client-side website preview using SharedExporters (Yjs mode)
     * Generates multi-page SPA HTML entirely in the browser and opens in new window
     * @returns {Promise<boolean>} - True if preview was handled client-side
     */
    async openClientPreview() {
        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            console.warn('[NavbarUtilities] Yjs document manager not available for preview');
            return false;
        }

        // Require SharedExporters (unified TypeScript export system)
        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.openPreviewWindow) {
            console.error('[NavbarUtilities] SharedExporters not loaded - ensure exporters.bundle.js is included');
            return false;
        }

        const toastData = {
            title: _('Preview'),
            body: _('Generating preview...'),
            icon: 'preview',
        };
        const toast = eXeLearning.app.toasts.createToast(toastData);

        try {
            // Get the document manager
            const documentManager = yjsBridge.documentManager;

            // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
            const resourceFetcher = yjsBridge.resourceFetcher || null;

            // Build preview options
            const previewOptions = {
                baseUrl: window.location.origin,
                basePath: window.eXeLearning?.config?.basePath || '',
                version: window.eXeLearning?.config?.version || 'v1.0.0',
            };

            // Generate preview using SharedExporters (unified TypeScript pipeline)
            Logger.log('[NavbarUtilities] Starting unified preview via SharedExporters...');
            const previewWindow = await SharedExporters.openPreviewWindow(
                documentManager,
                resourceFetcher,
                previewOptions
            );

            if (previewWindow) {
                toast.toastBody.innerHTML = _('The preview has been generated.');
                Logger.log('[NavbarUtilities] Unified preview opened successfully');
            } else {
                throw new Error('Failed to open preview window');
            }

        } catch (error) {
            console.error('[NavbarUtilities] Client-side preview error:', error);
            toast.toastBody.innerHTML = _(
                'An error occurred while generating the preview.'
            );
            toast.toastBody.classList.add('error');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: error.message || _('Unknown error.'),
                contentId: 'error',
            });
            return true; // Error shown to user, no server fallback in Yjs mode
        }

        // Remove toast after delay
        setTimeout(() => {
            toast.remove();
        }, 1000);

        return true; // Handled client-side
    }
}
