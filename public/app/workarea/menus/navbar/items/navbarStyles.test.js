/**
 * Tests for NavbarStyles class (quick wins)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock translation function
global._ = vi.fn((str) => str);

// Mock window.AppLogger
global.window = global.window || {};
window.AppLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

// Mock eXeLearning global
global.eXeLearning = {
    app: {
        api: {
            parameters: {
                themeInfoFieldsConfig: {},
                themeEditionFieldsConfig: {},
            },
            postNewTheme: vi.fn(),
            putEditTheme: vi.fn(),
            deleteTheme: vi.fn(),
            postUploadTheme: vi.fn(),
            getThemeZip: vi.fn(),
        },
        project: {
            checkOpenIdevice: vi.fn(() => false),
            odeSession: 'session-1',
        },
        themes: {
            list: {
                installed: {},
                loadThemesInstalled: vi.fn(),
                loadTheme: vi.fn(),
                orderThemesInstalled: vi.fn(),
                removeTheme: vi.fn(),
            },
            manager: {
                selected: { id: 'user-1', name: 'User Theme 1' },
                selectTheme: vi.fn(),
            },
            selectTheme: vi.fn().mockResolvedValue(),
        },
        modals: {
            confirm: { show: vi.fn() },
        },
    },
    config: {
        basePath: '',
    },
};

global.eXe = {
    app: {
        alert: vi.fn(),
        clearHistory: vi.fn(),
        _confirmResponses: new Map(),
    },
};

import NavbarStyles from './navbarStyles.js';

describe('NavbarStyles', () => {
    let navbarStyles;

    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="navbar">
                <button id="dropdownStyles"></button>
                <button id="navbar-button-styles"></button>
            </div>
            <div id="styleslistContent">
                <div id="exestylescontent"></div>
                <div id="importedstylescontent"></div>
            </div>
            <div id="exestylescontent-tab"></div>
            <div id="importedstylescontent-tab"></div>
            <div id="stylessidenav" class="sidenav"></div>
            <div id="sidenav-overlay"></div>
            <button id="stylessidenavclose"></button>
        `;

        eXeLearning.app.api.parameters.themeInfoFieldsConfig = {
            author: { title: 'Author', tag: 'text' },
            description: { title: 'Description', tag: 'textarea' },
        };
        eXeLearning.app.api.parameters.themeEditionFieldsConfig = {
            primaryColor: { title: 'Primary', tag: 'color', config: 'primary', category: 'Info' },
            title: { title: 'Title', tag: 'text', config: 'title', category: 'Texts' },
            headerImage: { title: 'Header', tag: 'img', config: 'header', category: 'Header' },
        };
        eXeLearning.app.api.getThemeZip.mockResolvedValue({});

        eXeLearning.app.themes.list.installed = {
            one: {
                id: 'base-1',
                type: 'base',
                title: 'Base 1',
                name: 'Base Theme 1',
                description: 'Base description',
                path: '/base-1/',
                manager: { selected: { name: 'Base Theme 2' } },
                downloadable: '1',
            },
            two: {
                id: 'user-1',
                type: 'user',
                name: 'User Theme 1',
                title: 'User 1',
                manager: { selected: { name: 'User Theme 1' } },
                dirName: 'user-1',
            },
            three: {
                id: 'base-2',
                type: 'base',
                title: 'Base 2',
                name: 'Base Theme 2',
                description: 'Another description',
                path: '/base-2/',
                manager: { selected: { name: 'Base Theme 2' } },
                downloadable: '0',
            },
            four: {
                id: 'site-1',
                type: 'site',
                title: 'Site Theme 1',
                name: 'Site Theme 1',
                description: 'Site managed theme',
                path: '/site-files/themes/site-1/',
                manager: { selected: { name: 'Base Theme 2' } },
                downloadable: '1',
            },
        };

        navbarStyles = new NavbarStyles({ navbar: document });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('splits installed themes into base (including site) and user lists', () => {
        expect(navbarStyles.baseThemes.map((t) => t.id)).toEqual([
            'base-1',
            'base-2',
            'site-1',
        ]);
        expect(navbarStyles.userThemes.map((t) => t.id)).toEqual(['user-1']);
    });

    it('updates selected theme classes in both lists', () => {
        const baseContainer = document.querySelector('#exestylescontent');
        baseContainer.innerHTML = `
            <div class="theme-card selected" data-theme-id="base-1"></div>
            <div class="theme-card" data-theme-id="base-2"></div>
        `;
        const userContainer = document.querySelector('#importedstylescontent');
        userContainer.innerHTML = `
            <div class="user-theme-item selected" data-theme-id="user-2"></div>
            <div class="user-theme-item" data-theme-id="user-1"></div>
        `;

        navbarStyles.updateSelectedTheme('user-1');

        const baseSelected = document.querySelectorAll(
            '#exestylescontent .theme-card.selected'
        );
        expect(baseSelected.length).toBe(0);

        const userSelected = document.querySelectorAll(
            '#importedstylescontent .user-theme-item.selected'
        );
        expect(userSelected.length).toBe(1);
        expect(userSelected[0].dataset.themeId).toBe('user-1');
    });

    it('creates input wrapper and dispatches addNewReader on file change', () => {
        const spy = vi.spyOn(navbarStyles, 'addNewReader').mockImplementation(() => {});
        const wrapper = navbarStyles.makeElementInputFileImportTheme();
        document.body.appendChild(wrapper);

        const input = wrapper.querySelector('#theme-file-import');
        const file = new File(['content'], 'theme.zip', { type: 'application/zip' });
        Object.defineProperty(input, 'files', {
            value: [file],
            writable: false,
        });

        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(spy).toHaveBeenCalledWith(file);
        expect(input.value).toBe('');
    });

    it('creates empty upload box with drag/drop behavior', () => {
        const input = document.createElement('input');
        input.id = 'theme-file-import';
        const wrapper = document.createElement('div');
        wrapper.appendChild(input);

        vi.spyOn(navbarStyles, 'makeElementInputFileImportTheme').mockReturnValue(
            wrapper
        );
        const addSpy = vi.spyOn(navbarStyles, 'addNewReader').mockImplementation(() => {});

        const emptyBox = navbarStyles.createEmptyBox();
        document.body.appendChild(emptyBox);

        const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
        emptyBox.dispatchEvent(new Event('click', { bubbles: false }));
        expect(clickSpy).toHaveBeenCalled();

        emptyBox.dispatchEvent(new Event('dragover', { bubbles: true }));
        expect(emptyBox.classList.contains('dragover')).toBe(true);

        emptyBox.dispatchEvent(new Event('dragleave', { bubbles: true }));
        expect(emptyBox.classList.contains('dragover')).toBe(false);

        const dropEvent = new Event('drop', { bubbles: true });
        const dropFile = new File(['content'], 'theme.zip', { type: 'application/zip' });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: { files: [dropFile] },
        });
        emptyBox.dispatchEvent(dropEvent);

        expect(addSpy).toHaveBeenCalledWith(dropFile);
    });

    it('sets up style manager event handlers', () => {
        const spy = vi.spyOn(navbarStyles, 'styleManagerEvent');
        navbarStyles.setStyleManagerEvent();

        document.querySelector('#dropdownStyles').click();
        expect(spy).toHaveBeenCalled();

        eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
        document.querySelector('#navbar-button-styles').click();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('toggles sidenav when style manager is opened', () => {
        const toggleSpy = vi.spyOn(navbarStyles, 'toggleSidenav');
        navbarStyles.styleManagerEvent();

        expect(toggleSpy).toHaveBeenCalled();
        document.getElementById('sidenav-overlay').click();
        expect(toggleSpy).toHaveBeenCalledTimes(2);
    });

    it('builds base themes list with download and info actions', async () => {
        navbarStyles.buildBaseListThemes();

        const cards = document.querySelectorAll('.theme-card');
        // 2 base + 1 site theme = 3 cards
        expect(cards.length).toBe(3);

        const downloadItem = document.querySelector('.theme-action-download');
        downloadItem.dispatchEvent(new MouseEvent('click'));

        const infoItem = document.querySelector('.theme-action-info');
        infoItem.dispatchEvent(new MouseEvent('click'));
        expect(document.querySelector('.info-theme-container')).toBeTruthy();
    });

    it('builds user themes list with menu items', () => {
        navbarStyles.buildUserListThemes();

        const items = document.querySelectorAll('.user-theme-item');
        expect(items.length).toBe(1);

        const menuDelete = document.querySelector('.theme-menu li:last-child');
        menuDelete.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
    });

    it('shows empty user themes state', () => {
        navbarStyles.userThemes = [];
        navbarStyles.buildUserListThemes();
        expect(document.querySelector('.user-theme-empty-info')).toBeTruthy();
    });

    it('handles newTheme success and error paths', async () => {
        vi.useFakeTimers();
        const loadSpy = vi.fn();
        navbarStyles.themes = { loadThemes: loadSpy };
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        eXeLearning.app.api.postNewTheme.mockResolvedValue({
            responseMessage: 'OK',
            themes: { themes: [] },
        });

        const promise = navbarStyles.newTheme({ data: {} });
        await vi.runAllTimersAsync();
        await promise;

        expect(loadSpy).toHaveBeenCalled();
        expect(buildSpy).toHaveBeenCalled();

        eXeLearning.app.api.postNewTheme.mockResolvedValue({
            responseMessage: 'ERR',
            error: 'fail',
        });
        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.newTheme({ data: {} });
        expect(alertSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('handles editTheme success and error paths for server themes', async () => {
        vi.useFakeTimers();
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        eXeLearning.app.api.putEditTheme.mockResolvedValue({
            responseMessage: 'OK',
            themes: { themes: [] },
        });

        // 'dir' is not a user theme, so it uses API
        navbarStyles.editTheme('dir', { data: {} });
        await vi.runAllTimersAsync();

        expect(eXeLearning.app.themes.list.loadThemesInstalled).toHaveBeenCalled();
        expect(buildSpy).toHaveBeenCalled();

        eXeLearning.app.api.putEditTheme.mockResolvedValue({
            responseMessage: 'ERR',
            error: 'fail',
        });
        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.editTheme('dir', { data: {} });
        expect(alertSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('handles editTheme for user themes via IndexedDB', async () => {
        const mockResourceCache = {
            updateUserThemeConfig: vi.fn().mockResolvedValue(),
        };
        eXeLearning.app.project._yjsBridge = {
            resourceCache: mockResourceCache,
        };

        // 'user-1' is a user theme (type: 'user') with name: 'User Theme 1'
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        await navbarStyles.editTheme('user-1', { data: { title: 'New Title', author: 'New Author' } });

        // Uses theme.name ('User Theme 1') as the key in IndexedDB
        expect(mockResourceCache.updateUserThemeConfig).toHaveBeenCalledWith('User Theme 1', {
            title: 'New Title',
            author: 'New Author',
        });
        expect(buildSpy).toHaveBeenCalled();
        expect(eXeLearning.app.api.putEditTheme).not.toHaveBeenCalled();
    });

    it('shows alert when user theme edit fails', async () => {
        const mockResourceCache = {
            updateUserThemeConfig: vi.fn().mockRejectedValue(new Error('DB error')),
        };
        eXeLearning.app.project._yjsBridge = {
            resourceCache: mockResourceCache,
        };

        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.editTheme('user-1', { data: { title: 'New Title' } });

        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to edit'), expect.any(Object));
    });

    it('handles removeTheme success and error paths', async () => {
        eXeLearning.app.api.deleteTheme.mockResolvedValue({
            responseMessage: 'OK',
            deleted: { name: 'User Theme 1' },
        });
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        await navbarStyles.removeTheme('user-1');
        expect(eXeLearning.app.themes.list.removeTheme).toHaveBeenCalledWith(
            'User Theme 1'
        );
        expect(buildSpy).toHaveBeenCalled();

        vi.useFakeTimers();
        eXeLearning.app.api.deleteTheme.mockResolvedValue({
            responseMessage: 'ERR',
            error: 'fail',
        });
        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.removeTheme('user-1');
        vi.advanceTimersByTime(1000);
        expect(alertSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('uploads theme (legacy method redirects to IndexedDB upload)', async () => {
        // The uploadTheme method is deprecated and now redirects to uploadThemeToIndexedDB
        const uploadToIndexedDBSpy = vi.spyOn(navbarStyles, 'uploadThemeToIndexedDB').mockResolvedValue();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Test with base64 data
        navbarStyles.uploadTheme('theme.zip', 'data:application/zip;base64,dGVzdA==');
        await Promise.resolve();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
        expect(uploadToIndexedDBSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
        uploadToIndexedDBSpy.mockRestore();
    });

    it('downloads theme zip when data is available (server theme)', async () => {
        eXeLearning.app.api.getThemeZip.mockResolvedValue({
            zipFileName: 'theme.zip',
            zipBase64: 'dGVzdA==',
        });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await navbarStyles.downloadThemeZip({ dirName: 'base-1', downloadable: '1' });
        expect(clickSpy).toHaveBeenCalled();
        clickSpy.mockRestore();
    });

    it('shows alert when theme is not downloadable', async () => {
        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.downloadThemeZip({ dirName: 'user-1', downloadable: '0' });
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('cannot be downloaded'), expect.any(Object));
        expect(eXeLearning.app.api.getThemeZip).not.toHaveBeenCalled();
    });

    it('downloads user theme from IndexedDB', async () => {
        const mockResourceCache = {
            getUserThemeRaw: vi.fn().mockResolvedValue({
                compressedFiles: new Uint8Array([80, 75, 3, 4]), // ZIP magic bytes
            }),
        };
        eXeLearning.app.project._yjsBridge = {
            resourceCache: mockResourceCache,
        };

        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await navbarStyles.downloadThemeZip({
            name: 'user-theme',
            type: 'user',
            downloadable: '1',
        });

        expect(mockResourceCache.getUserThemeRaw).toHaveBeenCalledWith('user-theme');
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalled();

        createObjectURLSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
        clickSpy.mockRestore();
    });

    it('shows alert when user theme not found in IndexedDB', async () => {
        const mockResourceCache = {
            getUserThemeRaw: vi.fn().mockResolvedValue(null),
        };
        eXeLearning.app.project._yjsBridge = {
            resourceCache: mockResourceCache,
        };

        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        await navbarStyles.downloadThemeZip({
            name: 'missing-theme',
            type: 'user',
            downloadable: '1',
        });

        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('not found'), expect.any(Object));
    });

    describe('makeMenuThemeDownload', () => {
        it('shows enabled download button when downloadable is 1', () => {
            const theme = { downloadable: '1' };
            const li = navbarStyles.makeMenuThemeDownload(theme);
            expect(li.classList.contains('disabled')).toBe(false);
            expect(li.querySelector('.download-icon-green')).toBeTruthy();
        });

        it('shows disabled download button when downloadable is not 1', () => {
            const theme = { downloadable: '0' };
            const li = navbarStyles.makeMenuThemeDownload(theme);
            expect(li.classList.contains('disabled')).toBe(true);
            expect(li.querySelector('.download-icon-disabled')).toBeTruthy();
        });

        it('does not call downloadThemeZip when disabled', async () => {
            const theme = { downloadable: '0' };
            const downloadSpy = vi.spyOn(navbarStyles, 'downloadThemeZip');
            const li = navbarStyles.makeMenuThemeDownload(theme);
            li.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(downloadSpy).not.toHaveBeenCalled();
        });
    });

    it('toggles sidenav state', () => {
        const sidenav = document.getElementById('stylessidenav');
        const overlay = document.getElementById('sidenav-overlay');
        navbarStyles.toggleSidenav();
        expect(sidenav.classList.contains('active')).toBe(true);
        expect(overlay.classList.contains('active')).toBe(true);
        navbarStyles.toggleSidenav();
        expect(sidenav.classList.contains('active')).toBe(false);
    });

    it('builds edit theme table and handles color sync', () => {
        const theme = { id: 'user-1', primaryColor: '#ff0000', title: 'Title' };
        const table = navbarStyles.makeElementEditThemeTable(theme);
        document.body.appendChild(table);
        const colorInput = table.querySelector('[data-role="color-input"]');
        const hexInput = table.querySelector('[data-role="color-hex"]');
        colorInput.value = '#00ff00';
        colorInput.dispatchEvent(new Event('input'));
        expect(hexInput.value).toBe('#00ff00');
        hexInput.value = '#0000ff';
        hexInput.dispatchEvent(new Event('input'));
        expect(colorInput.value).toBe('#0000ff');
    });

    it('handles image selection and removal in edit form', async () => {
        const readSpy = vi.spyOn(navbarStyles, 'readFile').mockResolvedValue('data:image/png;base64,abc');
        const img = navbarStyles.makeElementEditThemeImg('');
        document.body.appendChild(img);
        const fileInput = img.querySelector('input[type="file"]');
        const file = new File(['x'], 'image.png', { type: 'image/png' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fileInput.dispatchEvent(new Event('change'));
        await Promise.resolve();
        expect(readSpy).toHaveBeenCalled();

        const removeButton = img.querySelector('.remove-img');
        removeButton.click();
        expect(img.classList.contains('no-img')).toBe(true);
    });

    it('reads files and slugifies categories', async () => {
        const OriginalFileReader = global.FileReader;
        class MockFileReader {
            constructor() {
                this.onload = null;
                this.onerror = null;
            }
            readAsDataURL() {
                if (this.onload) {
                    this.onload({ target: { result: 'data' } });
                }
            }
        }
        global.FileReader = MockFileReader;

        const promise = navbarStyles.readFile(new File(['x'], 'file.txt'));
        await expect(promise).resolves.toBe('data');

        global.FileReader = OriginalFileReader;
        expect(navbarStyles.slugifyCategory(' My Tab! ')).toBe('mytab');
    });

    it('collects form values and submits edit actions', async () => {
        document.body.innerHTML += `
            <input class="theme-edit-value-field" field="title" value="Title" />
        `;
        const values = navbarStyles.getFormEditThemeValues();
        expect(values.data.title).toBe('Title');

        navbarStyles.themes = {
            manager: {
                selected: { id: 'user-1' },
                selectTheme: vi.fn().mockResolvedValue(),
            },
        };
        const editSpy = vi.spyOn(navbarStyles, 'editTheme').mockResolvedValue();
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        await navbarStyles.confirmExecEvent({ id: 'user-1', dirName: 'user-1' });
        expect(editSpy).toHaveBeenCalled();
        expect(buildSpy).toHaveBeenCalled();
    });

    describe('uploadThemeToIndexedDB', () => {
        let mockResourceCache;
        let mockResourceFetcher;

        beforeEach(() => {
            mockResourceCache = {
                setUserTheme: vi.fn().mockResolvedValue(),
            };
            mockResourceFetcher = {
                setUserThemeFiles: vi.fn().mockResolvedValue(),
            };
            eXeLearning.app.project._yjsBridge = {
                resourceCache: mockResourceCache,
            };
            eXeLearning.app.resourceFetcher = mockResourceFetcher;
            eXeLearning.app.themes.list.addUserTheme = vi.fn();

            // Mock fflate
            window.fflate = {
                unzipSync: vi.fn().mockReturnValue({
                    'config.xml': new TextEncoder().encode('<theme><name>Test Theme</name><version>1.0</version></theme>'),
                    'style.css': new Uint8Array([1, 2, 3]),
                }),
                zipSync: vi.fn().mockReturnValue(new Uint8Array([80, 75, 3, 4])),
            };
        });

        afterEach(() => {
            delete window.fflate;
            delete eXeLearning.app.project._yjsBridge;
            delete eXeLearning.app.resourceFetcher;
        });

        it('parses ZIP and stores theme in IndexedDB', async () => {
            const arrayBuffer = new ArrayBuffer(10);
            await navbarStyles.uploadThemeToIndexedDB('theme.zip', arrayBuffer);

            expect(window.fflate.unzipSync).toHaveBeenCalled();
            expect(mockResourceCache.setUserTheme).toHaveBeenCalledWith(
                'test_theme',
                expect.any(Uint8Array),
                expect.objectContaining({
                    name: 'test_theme',
                    type: 'user',
                    isUserTheme: true,
                })
            );
            expect(mockResourceFetcher.setUserThemeFiles).toHaveBeenCalledWith(
                'test_theme',
                expect.any(Object)
            );
            expect(eXeLearning.app.themes.list.addUserTheme).toHaveBeenCalled();
        });

        it('shows alert when fflate is not loaded', async () => {
            delete window.fflate;
            const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');

            await navbarStyles.uploadThemeToIndexedDB('theme.zip', new ArrayBuffer(10));

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to install'),
                expect.objectContaining({ error: 'fflate library not loaded' })
            );
        });

        it('shows alert when config.xml is missing', async () => {
            window.fflate.unzipSync.mockReturnValue({
                'style.css': new Uint8Array([1, 2, 3]),
            });
            const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');

            await navbarStyles.uploadThemeToIndexedDB('theme.zip', new ArrayBuffer(10));

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('Invalid style'),
                expect.any(Object)
            );
        });

        it('shows alert when theme already exists', async () => {
            eXeLearning.app.themes.list.installed['test_theme'] = { id: 'test_theme' };
            const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');

            await navbarStyles.uploadThemeToIndexedDB('theme.zip', new ArrayBuffer(10));

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('already exists'),
                expect.any(Object)
            );
        });

        it('shows alert when storage is not available', async () => {
            delete eXeLearning.app.project._yjsBridge;
            const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');

            await navbarStyles.uploadThemeToIndexedDB('theme.zip', new ArrayBuffer(10));

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to install'),
                expect.objectContaining({ error: expect.stringContaining('Storage not available') })
            );
        });

        it('detects CSS and JS files in theme', async () => {
            window.fflate.unzipSync.mockReturnValue({
                'config.xml': new TextEncoder().encode('<theme><name>CSS Theme</name></theme>'),
                'main.css': new Uint8Array([1]),
                'extra.css': new Uint8Array([2]),
                'script.js': new Uint8Array([3]),
                'icons/icon1.png': new Uint8Array([4]),
            });

            await navbarStyles.uploadThemeToIndexedDB('theme.zip', new ArrayBuffer(10));

            expect(mockResourceCache.setUserTheme).toHaveBeenCalledWith(
                'css_theme',
                expect.any(Uint8Array),
                expect.objectContaining({
                    cssFiles: ['main.css', 'extra.css'],
                    js: ['script.js'],
                    icons: { icon1: 'icons/icon1.png' },
                })
            );
        });
    });

    describe('removeTheme for user themes', () => {
        let mockResourceCache;
        let mockResourceFetcher;

        beforeEach(() => {
            mockResourceCache = {
                deleteUserTheme: vi.fn().mockResolvedValue(),
            };
            mockResourceFetcher = {
                userThemeFiles: new Map(),
                cache: new Map(),
            };
            eXeLearning.app.project._yjsBridge = {
                resourceCache: mockResourceCache,
            };
            eXeLearning.app.resourceFetcher = mockResourceFetcher;

            // Ensure the user-1 theme exists and is marked as user theme
            eXeLearning.app.themes.list.installed['user-1'] = {
                id: 'user-1',
                type: 'user',
                name: 'User Theme 1',
                title: 'User 1',
                manager: { selected: { name: 'User Theme 1' } },
                dirName: 'user-1',
                isUserTheme: true,
            };
        });

        afterEach(() => {
            delete eXeLearning.app.project._yjsBridge;
            delete eXeLearning.app.resourceFetcher;
        });

        it('removes user theme from IndexedDB and caches', async () => {
            mockResourceFetcher.userThemeFiles.set('user-1', {});
            mockResourceFetcher.cache.set('theme:user-1', new Map());

            const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
            await navbarStyles.removeTheme('user-1');

            expect(mockResourceCache.deleteUserTheme).toHaveBeenCalledWith('user-1');
            expect(mockResourceFetcher.userThemeFiles.has('user-1')).toBe(false);
            expect(mockResourceFetcher.cache.has('theme:user-1')).toBe(false);
            expect(eXeLearning.app.themes.list.removeTheme).toHaveBeenCalledWith('user-1');
            expect(buildSpy).toHaveBeenCalled();
        });

        it('handles removal errors gracefully', async () => {
            mockResourceCache.deleteUserTheme.mockRejectedValue(new Error('DB error'));

            const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
            await navbarStyles.removeTheme('user-1');

            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to remove'),
                expect.objectContaining({ error: 'DB error' })
            );
        });
    });

    describe('addNewReader', () => {
        it('reads file as ArrayBuffer and calls uploadThemeToIndexedDB', async () => {
            const uploadSpy = vi.spyOn(navbarStyles, 'uploadThemeToIndexedDB').mockResolvedValue();
            const OriginalFileReader = global.FileReader;

            let onloadCallback;
            class MockFileReader {
                constructor() {
                    navbarStyles.readers.push(this);
                }
                readAsArrayBuffer(file) {
                    setTimeout(() => {
                        if (onloadCallback) {
                            onloadCallback({ target: { result: new ArrayBuffer(10) } });
                        }
                    }, 0);
                }
                set onload(cb) {
                    onloadCallback = cb;
                }
            }
            global.FileReader = MockFileReader;

            const file = new File(['content'], 'theme.zip', { type: 'application/zip' });
            navbarStyles.addNewReader(file);

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(uploadSpy).toHaveBeenCalledWith('theme.zip', expect.any(ArrayBuffer));

            global.FileReader = OriginalFileReader;
            uploadSpy.mockRestore();
        });
    });
});
