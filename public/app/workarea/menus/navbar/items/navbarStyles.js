// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        this.button = this.menu.navbar.querySelector('#dropdownStyles');
        this.menuButton = this.menu.navbar.querySelector('#navbar-button-styles');
        this.readers = [];
        this.paramsInfo = JSON.parse(
            JSON.stringify(eXeLearning.app.api.parameters.themeInfoFieldsConfig)
        );
        this.paramsEdit = JSON.parse(
            JSON.stringify(
                eXeLearning.app.api.parameters.themeEditionFieldsConfig
            )
        );
        this.updateThemes();
        const exeStylesTab = document.querySelector('#exestylescontent-tab');
        if (exeStylesTab) {
            exeStylesTab.addEventListener('click', () => {
                this.buildBaseListThemes();
            });
        }
        const importedStylesTab = document.querySelector('#importedstylescontent-tab');
        if (importedStylesTab) {
            importedStylesTab.addEventListener('click', () => {
                this.buildUserListThemes();
            });
        }
    }

    updateThemes() {
        this.themes = eXeLearning.app.themes.list.installed;
        this.userThemes = [];
        this.baseThemes = [];
        for (const key in this.themes) {
            const theme = this.themes[key];
            if (theme.type === 'user') {
                this.userThemes.push(theme);
            } else if (theme.type === 'base' || theme.type === 'site' || theme.type === 'admin') {
                // Include base, site, and admin (legacy) themes in the System tab
                this.baseThemes.push(theme);
            }
        }
    }

    /**
     * Update the selected theme in the UI (for remote Yjs changes)
     * @param {string} themeId - The theme ID that was selected
     */
    updateSelectedTheme(themeId) {
        // Update base themes selection
        document.querySelectorAll('#exestylescontent .theme-card').forEach(card => {
            if (card.dataset.themeId === themeId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Update user themes selection
        document.querySelectorAll('#importedstylescontent .user-theme-item').forEach(item => {
            if (item.dataset.themeId === themeId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        Logger.log('[NavbarStyles] Updated selected theme UI:', themeId);
    }

    /**
     * Style Manager
     * Styles
     *
     */
    setStyleManagerEvent() {
        [this.button, this.menuButton].filter(Boolean).forEach((button) => {
            button.addEventListener('click', () => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.styleManagerEvent();
            });
        });
    }

    /**
     * Show Style Manager modal
     *
     */
    styleManagerEvent() {
        // Refresh themes list before building UI (themes may have loaded after constructor)
        this.updateThemes();
        this.buildBaseListThemes();
        this.buildUserListThemes();

        this.toggleSidenav();
        document
            .getElementById('sidenav-overlay')
            .addEventListener('click', this.toggleSidenav);
        document
            .getElementById('stylessidenavclose')
            .addEventListener('click', this.toggleSidenav);
    }

    buildBaseListThemes() {
        let contentBaseThemes = document.querySelector(
            '#styleslistContent #exestylescontent'
        );
        contentBaseThemes.innerHTML = '';
        for (const key in this.baseThemes) {
            const theme = this.baseThemes[key];
            const themeCard = document.createElement('div');
            themeCard.classList.add('theme-card');
            themeCard.dataset.themeId = theme.id;
            if (theme.manager.selected && theme.manager.selected.name === theme.name) {
                themeCard.classList.add('selected');
            }
            const header = document.createElement('div');
            header.classList.add('theme-card-header');
            const title = document.createElement('h4');
            title.classList.add('theme-card-title');
            title.textContent = theme.title;
            const button = document.createElement('div');
            button.classList.add(
                'btn',
                'button-square',
                'fixed-border',
                'small',
                'd-flex',
                'justify-content-center',
                'align-items-center'
            );
            button.innerHTML = `<span class="micro-icon dots-menu-vertical-icon"></span>`;
            const menu = document.createElement('div');
            menu.classList.add('theme-menu', 'exe-submenu', 'hidden');
            const ul = document.createElement('ul');
            const liDownload = document.createElement('li');
            if (theme.downloadable == '1')
                liDownload.classList.add('theme-action-download');
            else liDownload.classList.add('disabled');
            const iconDownload = document.createElement('span');
            if (theme.downloadable == '1')
                iconDownload.classList.add('small-icon', 'download-icon-green');
            else
                iconDownload.classList.add(
                    'small-icon',
                    'download-icon-disabled'
                );
            liDownload.appendChild(iconDownload);
            liDownload.appendChild(
                document.createTextNode(` ${_('Download')}`)
            );
            // Click event
            liDownload.addEventListener('click', (e) => {
                this.downloadThemeZip(theme);
            });

            const liInfo = document.createElement('li');
            liInfo.classList.add('theme-action-info');
            const iconInfo = document.createElement('span');
            iconInfo.classList.add('small-icon', 'info-icon-green');
            liInfo.appendChild(iconInfo);
            liInfo.appendChild(document.createTextNode(` ${_('Properties')}`));
            liInfo.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                let leftBody = document.getElementById('exestylescontent');
                leftBody.innerHTML = '';
                leftBody.append(this.makeElementInfoTheme(theme, 'base'));
            });

            ul.appendChild(liInfo);
            ul.appendChild(liDownload);

            menu.appendChild(ul);
            header.appendChild(title);
            header.appendChild(button);
            header.appendChild(menu);

            const preview = document.createElement('img');
            preview.classList.add('theme-card-preview');
            preview.setAttribute('alt', _('Preview'));
            preview.src = `${theme.path}screenshot.png`;
            const description = document.createElement('p');
            description.classList.add('theme-description');
            description.innerHTML = theme.description;
            themeCard.appendChild(header);
            themeCard.appendChild(preview);
            themeCard.appendChild(description);
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.theme-menu').forEach((m) => {
                    if (m !== menu) m.classList.add('hidden');
                });
                menu.classList.toggle('hidden');
            });

            contentBaseThemes.appendChild(themeCard);

            themeCard.addEventListener('click', () => {
                eXeLearning.app.themes
                    .selectTheme(theme.id, true, false)
                    .then(() => {
                        document
                            .querySelectorAll('.theme-card.selected')
                            .forEach((t) => {
                                if (t !== menu) t.classList.remove('selected');
                            });
                        themeCard.classList.add('selected');
                    });
            });
        }
        document.addEventListener('click', () => {
            document
                .querySelectorAll('.theme-menu')
                .forEach((m) => m.classList.add('hidden'));
        });
    }

    buildUserListThemes() {
        const contentUserThemes = document.querySelector(
            '#styleslistContent #importedstylescontent'
        );
        contentUserThemes.innerHTML = '';
        const infoText = document.createElement('div');
        infoText.classList.add('user-theme-empty-info');

        // No imported style
        if (Object.keys(this.userThemes).length === 0) {
            infoText.innerHTML = `
        <p class="empty-title">${_('There are no imported styles yet')}...</p>
        <p class="info-description">
            ${_('You can check the guide to create a style or add it from a link.')}
        </p>`;
            contentUserThemes.appendChild(infoText);
            contentUserThemes.appendChild(this.createEmptyBox());
            return;
        }

        infoText.innerHTML = `<p class="info-description">
            ${_('You can check the guide to create a style or add it from a link.')}
        </p>`;
        contentUserThemes.appendChild(infoText);

        for (const key in this.userThemes) {
            const theme = this.userThemes[key];

            const item = document.createElement('div');
            item.classList.add('user-theme-item');
            item.dataset.themeId = theme.id;
            if (theme.manager.selected && theme.manager.selected.name === theme.name) {
                item.classList.add('selected');
            }

            const icon = document.createElement('span');
            icon.classList.add('medium-icon', 'palette-icon-green');
            const title = document.createElement('span');
            title.classList.add('user-theme-title');
            title.textContent = theme.title;

            const button = document.createElement('div');
            button.classList.add(
                'btn',
                'button-square',
                'fixed-border',
                'small',
                'd-flex',
                'justify-content-center',
                'align-items-center'
            );
            button.innerHTML = `<span class="micro-icon dots-menu-vertical-icon"></span>`;

            const menu = document.createElement('div');
            menu.classList.add('theme-menu', 'exe-submenu', 'hidden');

            const ul = document.createElement('ul');

            ul.appendChild(this.makeMenuThemeEdit(theme));
            ul.appendChild(this.makeMenuThemeDownload(theme));
            ul.appendChild(this.makeMenuThemeInfo(theme));
            ul.appendChild(this.makeMenuThemeDelete(theme.id));

            menu.appendChild(ul);

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.theme-menu').forEach((m) => {
                    if (m !== menu) m.classList.add('hidden');
                });
                menu.classList.toggle('hidden');
            });

            item.appendChild(icon);
            item.appendChild(title);
            item.appendChild(button);
            item.appendChild(menu);

            item.addEventListener('click', () => {
                eXeLearning.app.themes
                    .selectTheme(theme.id, true, false)
                    .then(() => {
                        document
                            .querySelectorAll('.user-theme-item.selected')
                            .forEach((t) => {
                                if (t !== menu) t.classList.remove('selected');
                            });
                        item.classList.add('selected');
                    });
            });

            contentUserThemes.appendChild(item);
        }

        contentUserThemes.appendChild(this.createEmptyBox());

        document.addEventListener('click', () => {
            document
                .querySelectorAll('.theme-menu')
                .forEach((m) => m.classList.add('hidden'));
        });
    }

    createEmptyBox() {
        const emptyBox = document.createElement('div');
        emptyBox.classList.add('user-theme-empty-upload');

        const iconContainer = document.createElement('div');
        iconContainer.classList.add('upload-box-icon');

        const icon = document.createElement('span');
        icon.classList.add('medium-icon', 'upload-cloud-icon');
        iconContainer.appendChild(icon);

        const textContainer = document.createElement('div');
        textContainer.classList.add('upload-box-text');

        const pStrong = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = _('Click to upload the file');
        pStrong.appendChild(strong);

        const pMuted = document.createElement('p');
        pMuted.classList.add('text-muted');
        pMuted.textContent = _('or drag it here');

        textContainer.appendChild(pStrong);
        textContainer.appendChild(pMuted);

        emptyBox.appendChild(iconContainer);
        emptyBox.appendChild(textContainer);

        const inputFileWrapper = this.makeElementInputFileImportTheme();
        emptyBox.appendChild(inputFileWrapper);
        emptyBox.addEventListener('click', () =>
            inputFileWrapper.querySelector('#theme-file-import')?.click()
        );

        emptyBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            emptyBox.classList.add('dragover');
        });

        emptyBox.addEventListener('dragleave', () => {
            emptyBox.classList.remove('dragover');
        });

        emptyBox.addEventListener('drop', (e) => {
            e.preventDefault();
            emptyBox.classList.remove('dragover');
            const files = e.dataTransfer.files;
            Array.from(files).forEach((file) => this.addNewReader(file));
        });

        return emptyBox;
    }

    makeMenuThemeEdit(theme) {
        const li = document.createElement('li');

        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'edit-icon-green');
        li.appendChild(icon);
        li.appendChild(document.createTextNode(` ${_('Edit')}`));
        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let leftBody = document.getElementById('importedstylescontent');
            leftBody.innerHTML = '';
            leftBody.append(this.makeElementEditTheme(theme));
        });
        return li;
    }

    makeElementEditTheme(theme) {
        const container = document.createElement('div');
        container.classList.add('edit-theme-container');
        const backBtn = document.createElement('div');
        backBtn.classList.add(
            'btn',
            'button-tertiary',
            'button-narrow',
            'action-back',
            'd-flex',
            'justify-content-center',
            'align-items-center'
        );
        const backIcon = document.createElement('div');
        backIcon.classList.add('medium-icon', 'arrow-left-icon');
        backBtn.appendChild(backIcon);
        backBtn.addEventListener('click', () => {
            this.buildUserListThemes();
        });

        container.appendChild(backBtn);
        container.appendChild(this.makeElementEditThemeTable(theme));

        return container;
    }

    makeMenuThemeDownload(theme) {
        const li = document.createElement('li');
        const isDownloadable = theme.downloadable === '1' || theme.downloadable === 1;

        // Disable if not downloadable
        if (!isDownloadable) {
            li.classList.add('disabled');
        }

        const icon = document.createElement('span');
        if (isDownloadable) {
            icon.classList.add('small-icon', 'download-icon-green');
        } else {
            icon.classList.add('small-icon', 'download-icon-disabled');
        }
        li.appendChild(icon);
        li.appendChild(document.createTextNode(` ${_('Download')}`));

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDownloadable) {
                this.downloadThemeZip(theme);
            }
        });
        return li;
    }

    makeMenuThemeInfo(theme) {
        const li = document.createElement('li');

        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'info-icon-green');
        li.appendChild(icon);
        li.appendChild(document.createTextNode(` ${_('Properties')}`));

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let leftBody = document.getElementById('importedstylescontent');
            leftBody.innerHTML = '';
            leftBody.append(this.makeElementInfoTheme(theme, 'users'));
        });

        return li;
    }

    makeMenuThemeDelete(themeId) {
        const li = document.createElement('li');

        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'delete-icon-red');
        li.appendChild(icon);
        li.appendChild(document.createTextNode(` ${_('Delete')}`));
        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            eXeLearning.app.modals.confirm.show({
                title: _('Delete style'),
                body: _(
                    `Are you sure you want to delete the style: ${themeId}?`
                ),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => {
                    this.removeTheme(themeId);
                },
            });
        });
        return li;
    }

    async newTheme(fields) {
        let response = await eXeLearning.app.api.postNewTheme(fields);
        if (response && response.responseMessage === 'OK' && response.themes) {
            let promise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    this.themes.loadThemes(response.themes.themes);
                    this.updateThemes();
                    this.buildUserListThemes();
                    resolve(true);
                }, 1000);
            });
            return promise;
        } else {
            // Show alert
            this.showElementAlert(_('Failed to create the style'), response);
        }
    }

    /**
     * Edit a theme's configuration
     * For user themes: updates config in IndexedDB
     * For server themes (site): uses API
     */
    async editTheme(dirName, fields) {
        try {
            // Find the theme by dirName or id in installed themes
            const installedThemes = eXeLearning.app.themes.list.installed;
            let theme = installedThemes[dirName];
            if (!theme) {
                // Search by dirName property
                theme = Object.values(installedThemes).find(
                    (t) => t.dirName === dirName || t.id === dirName || t.name === dirName
                );
            }
            const isUserTheme = theme?.isUserTheme || theme?.type === 'user';

            if (isUserTheme) {
                // Update config in IndexedDB
                const resourceCache = eXeLearning.app.project?._yjsBridge?.resourceCache;
                if (!resourceCache) {
                    this.showElementAlert(_('Storage not available'), {});
                    return;
                }

                // Extract config fields from form data
                const configUpdates = fields.data || {};

                // Use the theme name (key in IndexedDB) for the update
                const themeName = theme.name || theme.dirName || dirName;

                // Update theme config in IndexedDB
                await resourceCache.updateUserThemeConfig(themeName, configUpdates);

                // Update the theme object in memory
                if (theme) {
                    Object.assign(theme, configUpdates);
                    if (configUpdates.title) {
                        theme.displayName = configUpdates.title;
                    }
                }

                // Refresh UI
                this.updateThemes();
                this.buildUserListThemes();
                Logger.log(`[NavbarStyles] User theme '${dirName}' config updated`);
                return;
            }

            // Server themes (site): use API
            let response = await eXeLearning.app.api.putEditTheme(dirName, fields);
            if (response && response.responseMessage === 'OK' && response.themes) {
                eXeLearning.app.themes.list.loadThemesInstalled();
                let promise = new Promise((resolve, reject) => {
                    setTimeout(() => {
                        this.updateThemes();
                        this.buildUserListThemes();
                    }, 1000);
                });
                return promise;
            } else {
                // Show alert
                this.showElementAlert(_('Failed to edit the style '), response);
            }
        } catch (error) {
            console.error('[NavbarStyles] editTheme error:', error);
            this.showElementAlert(_('Failed to edit the style '), { error: error.message });
        }
    }
    /**
     * Remove a user theme
     * For user themes: deletes from IndexedDB
     * For server themes: calls API (if allowed)
     */
    async removeTheme(id) {
        try {
            // Check if it's a user theme (stored in IndexedDB)
            const theme = eXeLearning.app.themes.list.installed[id];
            const isUserTheme = theme?.isUserTheme || theme?.type === 'user';

            if (isUserTheme) {
                // Delete from IndexedDB
                const resourceCache = eXeLearning.app.project?._yjsBridge?.resourceCache;
                if (resourceCache) {
                    await resourceCache.deleteUserTheme(id);
                    Logger.log(`[NavbarStyles] User theme '${id}' deleted from IndexedDB`);
                }

                // Remove from ResourceFetcher cache
                const resourceFetcher = eXeLearning.app.resourceFetcher;
                if (resourceFetcher) {
                    resourceFetcher.userThemeFiles?.delete(id);
                    resourceFetcher.cache?.delete(`theme:${id}`);
                }

                // Remove from ThemeList
                await eXeLearning.app.themes.list.removeTheme(id);
                this.updateThemes();
                this.buildUserListThemes();

                Logger.log(`[NavbarStyles] User theme '${id}' removed successfully`);
            } else {
                // Server theme - use API (legacy behavior)
                let params = {};
                params.id = id;
                let response = await eXeLearning.app.api.deleteTheme(params);
                if (
                    response &&
                    response.responseMessage === 'OK' &&
                    response.deleted &&
                    response.deleted.name
                ) {
                    await eXeLearning.app.themes.list.removeTheme(
                        response.deleted.name
                    );
                    this.updateThemes();
                    this.buildUserListThemes();
                } else {
                    this.showElementAlert(_('Failed to remove style'), response);
                }
            }
        } catch (error) {
            console.error('[NavbarStyles] Remove theme error:', error);
            this.showElementAlert(_('Failed to remove style'), { error: error.message });
        }
    }

    makeElementInfoTheme(theme, tab) {
        const container = document.createElement('div');
        container.classList.add('info-theme-container');

        const backBtn = document.createElement('div');
        backBtn.classList.add(
            'btn',
            'button-tertiary',
            'button-narrow',
            'action-back',
            'd-flex',
            'justifycontent-center',
            'align-items-center'
        );
        const backIcon = document.createElement('div');
        backIcon.classList.add('medium-icon', 'arrow-left-icon');
        backBtn.appendChild(backIcon);
        backBtn.addEventListener('click', () => {
            if (tab === 'base') {
                this.buildBaseListThemes();
            }
            if (tab === 'users') {
                this.buildUserListThemes();
            }
        });

        container.appendChild(backBtn);

        for (let [param, config] of Object.entries(this.paramsInfo)) {
            if (theme[param]) {
                container.appendChild(
                    this.makeElementInfoThemeItem(param, theme[param], config)
                );
            }
        }

        return container;
    }

    showElementAlert(txt, response) {
        let defErrorText = txt;
        let resErrorText = response && response.error ? response.error : '';
        let errorText = resErrorText
            ? `<p>${defErrorText}:</p><p>&nbsp;${resErrorText}</p>`
            : `<p>${defErrorText}</p>`;
        eXe.app.alert(errorText);
    }

    makeElementInputFileImportTheme() {
        let inputFile = document.createElement('input');
        inputFile.setAttribute('type', 'file');
        inputFile.setAttribute('accept', '.zip');
        inputFile.id = 'theme-file-import';
        inputFile.classList.add('hidden', 'theme-file-import');
        let label = document.createElement('label');
        label.setAttribute('for', inputFile.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Import style in ZIP format');
        inputFile.addEventListener('change', (event) => {
            Array.from(inputFile.files).forEach((theme) => {
                this.addNewReader(theme);
            });
            inputFile.value = null;
        });
        let wrapper = document.createElement('div');
        wrapper.append(label);
        wrapper.append(inputFile);

        return wrapper;
    }

    addNewReader(file) {
        // Read file as ArrayBuffer for ZIP parsing
        let reader = new FileReader();
        this.readers.push(reader);
        reader.onload = (event) => {
            this.uploadThemeToIndexedDB(file.name, event.target.result);
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Upload theme to IndexedDB (client-side storage)
     * Does NOT upload to server - themes are stored locally and synced via Yjs
     * @param {string} fileName - ZIP file name
     * @param {ArrayBuffer} arrayBuffer - ZIP file content
     */
    async uploadThemeToIndexedDB(fileName, arrayBuffer) {
        try {
            // Parse ZIP with fflate
            const fflate = window.fflate;
            if (!fflate) {
                throw new Error('fflate library not loaded');
            }

            const uint8Data = new Uint8Array(arrayBuffer);
            const zip = fflate.unzipSync(uint8Data);

            // Validate config.xml exists
            const configXmlData = zip['config.xml'];
            if (!configXmlData) {
                this.showElementAlert(_('Invalid style package'), { error: _('config.xml not found in ZIP') });
                return;
            }

            // Parse config.xml
            const configXml = new TextDecoder().decode(configXmlData);
            const getValue = (tag) => {
                const match = configXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
                return match ? match[1].trim() : '';
            };

            // Extract theme name from config.xml
            let themeName = getValue('name') || fileName.replace('.zip', '');
            // Sanitize theme name for use as directory/key
            const dirName = themeName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            // Check if theme already exists
            if (eXeLearning.app.themes.list.installed[dirName]) {
                this.showElementAlert(_('Style already exists'), { error: _('A style with this name already exists') });
                return;
            }

            // Create theme config object
            const themeConfig = {
                name: dirName,
                dirName: dirName,
                displayName: themeName,
                title: themeName,
                type: 'user',
                version: getValue('version') || '1.0',
                author: getValue('author') || '',
                license: getValue('license') || '',
                description: getValue('description') || '',
                downloadable: getValue('downloadable') || '1', // Default to downloadable
                cssFiles: [],
                js: [],
                icons: {},
                valid: true,
                isUserTheme: true,
            };

            // Scan for CSS, JS, and icons
            for (const filePath of Object.keys(zip)) {
                if (filePath.endsWith('.css') && !filePath.includes('/')) {
                    themeConfig.cssFiles.push(filePath);
                } else if (filePath.endsWith('.js') && !filePath.includes('/')) {
                    themeConfig.js.push(filePath);
                } else if (filePath.startsWith('icons/') && (filePath.endsWith('.png') || filePath.endsWith('.svg'))) {
                    const iconName = filePath.replace('icons/', '').replace(/\.(png|svg)$/, '');
                    themeConfig.icons[iconName] = filePath;
                }
            }

            if (themeConfig.cssFiles.length === 0) {
                themeConfig.cssFiles.push('style.css');
            }

            // Compress theme files for storage
            const compressedFiles = fflate.zipSync(zip, { level: 6 });

            // Get ResourceCache from YjsProjectBridge
            const resourceCache = eXeLearning.app.project?._yjsBridge?.resourceCache;
            if (!resourceCache) {
                this.showElementAlert(_('Failed to install the new style'), { error: _('Storage not available') });
                return;
            }

            // Save to IndexedDB
            await resourceCache.setUserTheme(dirName, compressedFiles, themeConfig);
            Logger.log(`[NavbarStyles] Theme '${dirName}' saved to IndexedDB`);

            // Register with ResourceFetcher
            const resourceFetcher = eXeLearning.app.resourceFetcher;
            if (resourceFetcher) {
                await resourceFetcher.setUserThemeFiles(dirName, zip);
            }

            // Add to installed themes (does NOT auto-select)
            eXeLearning.app.themes.list.addUserTheme(themeConfig);

            // Update UI
            this.updateThemes();
            this.buildUserListThemes();

            Logger.log(`[NavbarStyles] Theme '${dirName}' installed successfully`);
        } catch (error) {
            console.error('[NavbarStyles] Theme upload error:', error);
            this.showElementAlert(_('Failed to install the new style'), { error: error.message });
        }
    }

    /**
     * Legacy upload method - redirects to new IndexedDB upload
     * @deprecated Use uploadThemeToIndexedDB instead
     */
    uploadTheme(fileName, fileData) {
        console.warn('[NavbarStyles] uploadTheme() is deprecated, use uploadThemeToIndexedDB()');
        // Convert base64 to ArrayBuffer if needed
        if (typeof fileData === 'string' && fileData.includes('base64,')) {
            const base64 = fileData.split('base64,')[1];
            const binary = atob(base64);
            const arrayBuffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                arrayBuffer[i] = binary.charCodeAt(i);
            }
            this.uploadThemeToIndexedDB(fileName, arrayBuffer.buffer);
        } else {
            this.uploadThemeToIndexedDB(fileName, fileData);
        }
    }

    /**
     * Download theme as ZIP file
     * For user themes: get from IndexedDB and download client-side
     * For server themes: use API to download
     */
    async downloadThemeZip(theme) {
        // Check downloadable
        const isDownloadable = theme.downloadable === '1' || theme.downloadable === 1;
        if (!isDownloadable) {
            this.showElementAlert(_('This style cannot be downloaded'), {});
            return;
        }

        // User themes: get from IndexedDB and create ZIP client-side
        if (theme.type === 'user' || theme.isUserTheme) {
            try {
                const resourceCache = eXeLearning.app.project?._yjsBridge?.resourceCache;
                if (!resourceCache) {
                    this.showElementAlert(_('Storage not available'), {});
                    return;
                }

                // Use getUserThemeRaw to get the compressed ZIP data
                const themeData = await resourceCache.getUserThemeRaw(theme.name);
                if (!themeData?.compressedFiles) {
                    this.showElementAlert(_('Style files not found'), {});
                    return;
                }

                // themeData.compressedFiles is the raw compressed ZIP data (Uint8Array)
                const blob = new Blob([themeData.compressedFiles], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${theme.name}.zip`;
                link.click();
                URL.revokeObjectURL(url);
                Logger.log(`[NavbarStyles] User theme '${theme.name}' downloaded`);
            } catch (error) {
                console.error('[NavbarStyles] Download theme error:', error);
                this.showElementAlert(_('Failed to download the style'), { error: error.message });
            }
            return;
        }

        // Server themes: use existing API
        eXeLearning.app.api
            .getThemeZip(eXeLearning.app.project.odeSession, theme.dirName)
            .then((response) => {
                if (response && response.zipFileName && response.zipBase64) {
                    let link = document.createElement('a');
                    link.setAttribute('type', 'hidden');
                    link.href = 'data:text/plain;base64,' + response.zipBase64;
                    link.download = response.zipFileName;
                    link.click();
                    link.remove();
                }
            });
    }

    toggleSidenav() {
        const sidenav = document.getElementById('stylessidenav');
        const overlay = document.getElementById('sidenav-overlay');
        const isOpen = sidenav.classList.contains('active');

        if (isOpen) {
            sidenav.classList.remove('active');
            overlay.classList.remove('active');
        } else {
            sidenav.classList.add('active');
            overlay.classList.add('active');
        }
    }

    makeElementInfoThemeItem(key, value, config) {
        const group = document.createElement('div');
        group.classList.add('mb-3');

        const label = document.createElement('label');
        label.classList.add('form-label', 'theme-info-key');
        label.setAttribute('for', 'theme-info-key-' + key);
        label.textContent = config.title;
        group.appendChild(label);

        switch (config.tag) {
            case 'text': {
                const input = document.createElement('input');
                input.id = 'theme-info-key-' + key;
                input.type = 'text';
                input.classList.add('form-control', 'theme-info-value-text');
                input.disabled = true;
                input.value = value;
                group.appendChild(input);
                break;
            }
            case 'textarea': {
                const textarea = document.createElement('textarea');
                textarea.id = 'theme-info-key-' + key;
                textarea.classList.add('form-control', 'theme-info-value-text');
                textarea.disabled = true;
                textarea.value = value;
                group.appendChild(textarea);
                break;
            }
        }

        return group;
    }

    makeElementEditThemeTable(theme) {
        const tableEditTheme = document.createElement('div');
        tableEditTheme.classList.add('edit-theme-table');

        const tabsMap = {};
        for (const [, config] of Object.entries(this.paramsEdit)) {
            const id = this.slugifyCategory(config.category);
            tabsMap[id] = config.category;
            config.tabId = id;
        }

        const tabs = Object.entries(tabsMap).map(([id, title], idx) => ({
            id,
            title,
            active: idx === 0,
        }));

        const nav = this.makeThemesFormTabs(tabs);
        tableEditTheme.append(nav);

        const tabContent = document.createElement('div');
        tabContent.classList.add('tab-content');
        tabContent.classList.add(
            'edit-theme-table-rows-container',
            'exe-form-content-rows'
        );
        tableEditTheme.append(tabContent);

        /** @type {Record<string, HTMLElement>} */
        const panesById = {};
        for (const [tabId] of Object.entries(tabsMap)) {
            const pane = document.createElement('div');
            pane.classList.add('tab-pane', 'fade');
            pane.classList.add(`pane-${tabId}`);
            if (!Object.keys(panesById).length) {
                pane.classList.add('show', 'active');
            }
            pane.id = tabId;
            tabContent.append(pane);
            panesById[tabId] = pane;
        }

        for (const [param, config] of Object.entries(this.paramsEdit)) {
            const value = theme[param] ? theme[param] : '';
            const row = this.makeElementEditThemeTableRow(
                param,
                value,
                config,
                theme.id
            );
            (panesById[config.tabId] || tabContent).append(row);
        }

        tableEditTheme.append(this.buttonSave(theme));
        return tableEditTheme;
    }

    makeThemesFormTabs(tabs) {
        const formTabs = document.createElement('ul');
        formTabs.classList.add('nav', 'nav-tabs', 'exe-form-tabs');

        // 0→info, 1→texts, 2→header
        const namesByIndex = ['info', 'texts', 'header'];
        tabs.forEach((data, index) => {
            const li = document.createElement('li');
            li.classList.add('nav-item');
            const link = document.createElement('a');
            link.classList.add('nav-link', 'exe-tab');
            if (data.active) link.classList.add('active');
            link.setAttribute('data-bs-toggle', 'tab');
            link.setAttribute('href', `#${data.id}`);
            link.setAttribute('role', 'tab');
            link.setAttribute('aria-controls', data.id);
            link.setAttribute('aria-selected', data.active ? 'true' : 'false');
            link.setAttribute('title', data.title);

            const iconInfo = document.createElement('div');
            iconInfo.classList.add('small-icon');

            const name = namesByIndex[index];

            switch (name) {
                case 'info':
                    iconInfo.classList.add('settings-icon-green');
                    link.classList.add(`${name}-button`);
                    break;
                case 'texts':
                    iconInfo.classList.add('colors-icon-green');
                    link.classList.add(`${name}-button`);
                    break;
                case 'header':
                    iconInfo.classList.add('image-compact-icon-green');
                    link.classList.add(`${name}-button`);
                    break;
                default:
                    link.textContent = data.title;
                    break;
            }

            li.append(link);
            link.append(iconInfo);
            formTabs.append(li);
        });

        return formTabs;
    }

    makeElementEditThemeTableRow(key, value, config, themeId) {
        const row = document.createElement('div');
        row.classList.add('row-table-edit-theme', 'row-form-content', 'et-row');
        row.setAttribute('category', config.tabId);

        const colLabel = document.createElement('div');
        colLabel.classList.add('et-col-label');

        const colField = document.createElement('div');
        colField.classList.add('et-col-field');

        colLabel.append(
            this.makeElementEditThemeTableRowKey(key, config, themeId)
        );
        colField.append(
            this.makeElementEditThemeTableRowValue(key, value, config, themeId)
        );

        row.append(colLabel, colField);
        return row;
    }

    makeElementEditThemeTableRowKey(key, config, themeId) {
        const label = document.createElement('label');
        label.classList.add('form-label', 'theme-edit-key');
        label.setAttribute('for', `${themeId}-${key}-field`);
        label.innerHTML = `${config.title}`;
        return label;
    }

    makeElementEditThemeTableRowValue(key, value, config, themeId) {
        let element;
        switch (config.tag) {
            case 'textarea':
                element = this.makeElementEditThemeTextarea(value);
                break;
            case 'text':
                element = this.makeElementEditThemeText(value);
                break;
            case 'color':
                element = this.makeElementEditThemeColor(value, config.config);
                break;
            case 'img':
                element = this.makeElementEditThemeImg(value);
                break;
            default:
                element = this.makeElementEditThemeText(value);
        }

        if (element) {
            if (config.tag === 'img') {
                const inputFile = element.querySelector('input[type="file"]');
                if (inputFile) {
                    inputFile.id = `${themeId}-${key}-field`;
                }
            } else {
                element.id = `${themeId}-${key}-field`;
            }
            if (config.tag !== 'color') {
                element.classList.add('theme-edit-value-field');
                element.setAttribute('field', config.config);
            }
        }

        return element;
    }

    makeElementEditThemeTextarea(value) {
        const el = document.createElement('textarea');
        el.classList.add('form-control', 'theme-edit-value-text');
        el.value = value ?? '';
        el.rows = 4;
        return el;
    }

    makeElementEditThemeText(value) {
        const el = document.createElement('input');
        el.type = 'text';
        el.classList.add('form-control', 'theme-edit-value-text');
        el.value = value ?? '';
        return el;
    }

    makeElementEditThemeColor(value, field) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('et-color-wrapper');

        const el = document.createElement('input');
        el.type = 'color';
        el.classList.add('form-control-color');
        el.value = value ?? '#000000';

        const hex = document.createElement('input');
        hex.type = 'text';
        hex.classList.add(
            'form-control',
            'form-control-sm',
            'theme-edit-value-field'
        );
        hex.value = value ?? '#000000';
        hex.classList.add('theme-edit-value-field');
        hex.setAttribute('field', field);

        el.addEventListener('input', () => {
            hex.value = el.value;
        });
        hex.addEventListener('input', () => {
            el.value = hex.value;
        });

        el.setAttribute('data-role', 'color-input');
        hex.setAttribute('data-role', 'color-hex');

        wrapper.append(el, hex);
        return wrapper;
    }

    makeElementEditThemeImg(value) {
        const element = document.createElement('div');
        element.classList.add('img-container');
        element.setAttribute('value', value || '');
        if (!value) element.classList.add('no-img');

        const imgElement = document.createElement('img');
        imgElement.classList.add('preview-img');
        if (value) {
            imgElement.setAttribute(
                'src',
                `${eXeLearning.config.basePath}${value}?v=${Date.now()}`
            );
        }

        const inputFileElement = document.createElement('input');
        inputFileElement.type = 'file';
        inputFileElement.accept = 'image/*';
        inputFileElement.classList.add('et-hidden');

        const inputButtonElement = document.createElement('button');
        inputButtonElement.type = 'button';
        inputButtonElement.classList.add(
            'btn',
            'btn-outline-primary',
            'btn-sm'
        );
        inputButtonElement.setAttribute('value', _('Select image'));
        inputButtonElement.textContent = _('Select image');

        const removeElement = document.createElement('button');
        removeElement.type = 'button';
        removeElement.classList.add(
            'exe-icon',
            'remove-img',
            'btn',
            'btn-outline-danger',
            'btn-sm'
        );
        removeElement.setAttribute('aria-label', _('Remove image'));
        removeElement.innerHTML = 'close';

        const controls = document.createElement('div');
        controls.classList.add('et-img-controls');
        controls.append(inputButtonElement, removeElement);

        inputButtonElement.addEventListener('click', () =>
            inputFileElement.click()
        );

        inputFileElement.addEventListener('change', (e) => {
            const file = e.target.files.length > 0 ? e.target.files[0] : null;
            if (file) {
                this.readFile(file).then((data) => {
                    if (data) {
                        element.classList.remove('no-img');
                        element.setAttribute('value', data);
                        imgElement.setAttribute('src', data);
                    }
                });
            }
        });

        removeElement.addEventListener('click', () => {
            inputFileElement.value = '';
            element.classList.add('no-img');
            element.setAttribute('value', '');
            imgElement.setAttribute('src', '');
        });

        element.append(inputFileElement);
        element.append(imgElement);
        element.append(controls);

        return element;
    }

    buttonSave(theme) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add(
            'btn',
            'btn-save-theme',
            'button-tertiary',
            'd-flex',
            'align-items-center',
            'justify-content-start'
        );
        btn.title = _('Save');
        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'save-icon');
        btn.append(icon);
        const buttonText = document.createElement('span');
        buttonText.innerText = btn.title;
        btn.append(buttonText);
        btn.addEventListener('click', () => {
            this.confirmExecEvent(theme);
        });

        return btn;
    }

    slugifyCategory(str) {
        return String(str)
            .replaceAll(/[^a-zA-Z ]/g, '')
            .replaceAll(' ', '')
            .toLowerCase();
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (field) => {
                resolve(field.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    getFormEditThemeValues() {
        let valueFields = { data: {} };
        let fields = document.querySelectorAll('.theme-edit-value-field');
        fields.forEach((field) => {
            let id = field.getAttribute('field');
            valueFields['data'][id] = field.value
                ? field.value
                : field.getAttribute('value');
        });
        return valueFields;
    }

    async confirmExecEvent(theme) {
        let formFieldsValues = this.getFormEditThemeValues();
        if (theme.id) {
            // Edit theme files
            await this.editTheme(theme.dirName, formFieldsValues);
            // Reload the theme if you have the edited theme selected
            if (theme.id === this.themes.manager.selected.id) {
                await this.themes.manager.selectTheme(
                    this.themes.manager.selected.id,
                    true,
                    true
                );
                this.updateThemes();
                this.buildUserListThemes();
            }
        } else {
            // Create theme files
            await this.newTheme(formFieldsValues);
        }
    }
}
