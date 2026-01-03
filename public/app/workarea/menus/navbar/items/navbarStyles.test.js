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

    it('handles editTheme success and error paths', async () => {
        vi.useFakeTimers();
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        eXeLearning.app.api.putEditTheme.mockResolvedValue({
            responseMessage: 'OK',
            themes: { themes: [] },
        });

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

    it('uploads theme and handles failure', async () => {
        eXeLearning.app.api.postUploadTheme.mockResolvedValue({
            responseMessage: 'OK',
            theme: { id: 'new' },
        });
        const buildSpy = vi.spyOn(navbarStyles, 'buildUserListThemes');
        navbarStyles.uploadTheme('theme.zip', 'data');
        await Promise.resolve();
        expect(eXeLearning.app.themes.list.loadTheme).toHaveBeenCalled();
        expect(buildSpy).toHaveBeenCalled();

        eXeLearning.app.api.postUploadTheme.mockResolvedValue({
            responseMessage: 'ERR',
            error: 'fail',
        });
        const alertSpy = vi.spyOn(navbarStyles, 'showElementAlert');
        navbarStyles.uploadTheme('theme.zip', 'data');
        await Promise.resolve();
        expect(alertSpy).toHaveBeenCalled();
    });

    it('downloads theme zip when data is available', async () => {
        eXeLearning.app.api.getThemeZip.mockResolvedValue({
            zipFileName: 'theme.zip',
            zipBase64: 'dGVzdA==',
        });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await navbarStyles.downloadThemeZip({ dirName: 'user-1' });
        expect(clickSpy).toHaveBeenCalled();
        clickSpy.mockRestore();
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
});
