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
        },
        project: {
            checkOpenIdevice: vi.fn(() => false),
        },
        themes: {
            list: {
                installed: {},
            },
        },
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
            <div id="exestylescontent-tab"></div>
            <div id="importedstylescontent-tab"></div>
            <div id="exestylescontent">
                <div class="theme-card" data-theme-id="base-1"></div>
                <div class="theme-card selected" data-theme-id="base-2"></div>
            </div>
            <div id="importedstylescontent">
                <div class="user-theme-item" data-theme-id="user-1"></div>
                <div class="user-theme-item selected" data-theme-id="user-2"></div>
            </div>
        `;

        eXeLearning.app.themes.list.installed = {
            one: { id: 'base-1', type: 'base' },
            two: { id: 'user-1', type: 'user' },
            three: { id: 'base-2', type: 'base' },
        };

        navbarStyles = new NavbarStyles({ navbar: document });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('splits installed themes into base and user lists', () => {
        expect(navbarStyles.baseThemes.map((t) => t.id)).toEqual([
            'base-1',
            'base-2',
        ]);
        expect(navbarStyles.userThemes.map((t) => t.id)).toEqual(['user-1']);
    });

    it('updates selected theme classes in both lists', () => {
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
});
