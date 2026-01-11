/**
 * Tests for MenuIdevicesCompose class
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock translation function BEFORE importing the class
global._ = vi.fn((str) => str);

// Mock eXeLearning global BEFORE importing
global.eXeLearning = {
    app: {
        api: {
            postUploadIdevice: vi.fn().mockResolvedValue({}),
            deleteIdeviceInstalled: vi.fn().mockResolvedValue({}),
            getIdeviceInstalledZip: vi.fn().mockResolvedValue({}),
        },
        project: {
            odeSession: 'test-session-123',
            idevices: {
                behaviour: vi.fn(),
            },
        },
        modals: {
            confirm: {
                show: vi.fn(),
            },
        },
    },
};

// Mock eXe global for alerts (must have clearHistory and _confirmResponses for vitest.setup.js)
global.eXe = {
    app: {
        alert: vi.fn(),
        clearHistory: vi.fn(),
        _confirmResponses: new Map(),
    },
};

// Mock FileReader as a proper class constructor
class MockFileReader {
    constructor() {
        this.onload = null;
        this.readAsDataURL = vi.fn((file) => {
            if (this.onload) {
                this.onload({ target: { result: 'data:application/zip;base64,test' } });
            }
        });
    }
}
global.FileReader = MockFileReader;

import MenuIdevicesCompose from './menuIdevicesCompose.js';

describe('MenuIdevicesCompose', () => {
    let menuIdevicesCompose;
    let mockParent;
    let mockIdeviceList;
    let mockMenuElement;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset DOM
        document.body.innerHTML = `
            <div id="menu_idevices">
                <div id="list_menu_idevices"></div>
            </div>
            <div class="idevices type_imported">
                <div class="useridevices-content"></div>
            </div>
        `;

        // Get menu element reference
        mockMenuElement = document.querySelector('#menu_idevices #list_menu_idevices');

        // Mock parent
        mockParent = {
            compose: vi.fn(),
            behaviour: vi.fn(),
        };

        // Mock idevice list
        mockIdeviceList = {
            installed: {
                text: {
                    id: 'text',
                    title: 'Text',
                    category: 'Information and presentation',
                    visible: true,
                    icon: { type: 'exe-icon', name: 'text-icon' },
                },
                quiz: {
                    id: 'quiz',
                    title: 'Quiz',
                    category: 'Assessment and tracking',
                    visible: true,
                    icon: { type: 'exe-icon', name: 'quiz-icon' },
                },
                memory: {
                    id: 'memory',
                    title: 'Memory Game',
                    category: 'Games',
                    visible: true,
                    icon: { type: 'exe-icon', name: 'memory-icon' },
                },
            },
            loadIdevice: vi.fn(),
            removeIdevice: vi.fn(),
        };

        // Reset API mocks with proper resolved values
        eXeLearning.app.api.postUploadIdevice.mockResolvedValue({});
        eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({});
        eXeLearning.app.api.getIdeviceInstalledZip.mockResolvedValue({});

        // Create instance
        menuIdevicesCompose = new MenuIdevicesCompose(mockParent, mockIdeviceList);
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with parent and idevice list', () => {
            expect(menuIdevicesCompose.parent).toBe(mockParent);
            expect(menuIdevicesCompose.idevicesList).toBe(mockIdeviceList);
        });

        it('should set idevicesInstalled from list', () => {
            expect(menuIdevicesCompose.idevicesInstalled).toBe(mockIdeviceList.installed);
        });

        it('should query menu element from DOM', () => {
            expect(menuIdevicesCompose.menuIdevices).toBe(mockMenuElement);
        });

        it('should initialize empty readers array', () => {
            expect(menuIdevicesCompose.readers).toEqual([]);
        });
    });

    describe('categoryKeys', () => {
        it('should have information category', () => {
            expect(menuIdevicesCompose.categoryKeys.information).toBe('Information and presentation');
        });

        it('should have evaluation category', () => {
            expect(menuIdevicesCompose.categoryKeys.evaluation).toBe('Assessment and tracking');
        });

        it('should have games category', () => {
            expect(menuIdevicesCompose.categoryKeys.games).toBe('Games');
        });

        it('should have interactive category', () => {
            expect(menuIdevicesCompose.categoryKeys.interactive).toBe('Interactive activities');
        });

        it('should have science category', () => {
            expect(menuIdevicesCompose.categoryKeys.science).toBe('Science');
        });

        it('should have imported category', () => {
            expect(menuIdevicesCompose.categoryKeys.imported).toBe('Imported');
        });
    });

    describe('categoriesOrder', () => {
        it('should have ordered category keys', () => {
            expect(menuIdevicesCompose.categoriesOrder).toHaveLength(5);
            expect(menuIdevicesCompose.categoriesOrder[0]).toBe('information');
            expect(menuIdevicesCompose.categoriesOrder[1]).toBe('evaluation');
            expect(menuIdevicesCompose.categoriesOrder[2]).toBe('games');
            expect(menuIdevicesCompose.categoriesOrder[3]).toBe('interactive');
            expect(menuIdevicesCompose.categoriesOrder[4]).toBe('science');
        });
    });

    describe('getCategoryTitle', () => {
        it('should return translated title for known category', () => {
            expect(menuIdevicesCompose.getCategoryTitle('information')).toBe('Information and presentation');
        });

        it('should return the key itself for unknown category', () => {
            expect(menuIdevicesCompose.getCategoryTitle('unknown')).toBe('unknown');
        });
    });

    describe('compose', () => {
        it('should clear menu innerHTML', () => {
            mockMenuElement.innerHTML = '<div>test</div>';
            menuIdevicesCompose.compose();
            // Menu gets rebuilt, so check it has content
            expect(menuIdevicesCompose.categoriesIdevices).toBeDefined();
        });

        it('should initialize categoriesExtra as empty array', () => {
            menuIdevicesCompose.compose();
            expect(menuIdevicesCompose.categoriesExtra).toEqual([]);
        });

        it('should initialize categoriesIdevices object', () => {
            menuIdevicesCompose.compose();
            expect(menuIdevicesCompose.categoriesIdevices).toBeDefined();
            expect(typeof menuIdevicesCompose.categoriesIdevices).toBe('object');
        });

        it('should call addIdevicesToCategory', () => {
            const spy = vi.spyOn(menuIdevicesCompose, 'addIdevicesToCategory');
            menuIdevicesCompose.compose();
            expect(spy).toHaveBeenCalled();
        });

        it('should create category elements for all ordered categories', () => {
            menuIdevicesCompose.compose();
            // Should have at least the 5 base categories rendered
            const categories = mockMenuElement.querySelectorAll('.idevice_category');
            expect(categories.length).toBeGreaterThanOrEqual(5);
        });

        it('should create category elements in menu', () => {
            menuIdevicesCompose.compose();
            const categories = mockMenuElement.querySelectorAll('.idevice_category');
            expect(categories.length).toBeGreaterThan(0);
        });
    });

    describe('addIdevicesToCategory', () => {
        beforeEach(() => {
            menuIdevicesCompose.categoriesIdevices = {};
            menuIdevicesCompose.categoriesExtra = [];
            // Initialize known categories using English category names
            for (let [key, englishName] of Object.entries(menuIdevicesCompose.categoryKeys)) {
                menuIdevicesCompose.categoriesIdevices[englishName] = [];
            }
        });

        it('should add idevices to their respective categories', () => {
            menuIdevicesCompose.addIdevicesToCategory();
            expect(menuIdevicesCompose.categoriesIdevices['Information and presentation']).toContainEqual(
                expect.objectContaining({ id: 'text' })
            );
        });

        it('should add quiz to evaluation category', () => {
            menuIdevicesCompose.addIdevicesToCategory();
            expect(menuIdevicesCompose.categoriesIdevices['Assessment and tracking']).toContainEqual(
                expect.objectContaining({ id: 'quiz' })
            );
        });

        it('should add memory to games category', () => {
            menuIdevicesCompose.addIdevicesToCategory();
            expect(menuIdevicesCompose.categoriesIdevices['Games']).toContainEqual(
                expect.objectContaining({ id: 'memory' })
            );
        });

        it('should create new category for unknown categories', () => {
            mockIdeviceList.installed.custom = {
                id: 'custom',
                title: 'Custom',
                category: 'Custom Category',
                icon: { type: 'exe-icon', name: 'custom-icon' },
            };
            menuIdevicesCompose.idevicesInstalled = mockIdeviceList.installed;

            menuIdevicesCompose.addIdevicesToCategory();

            expect(menuIdevicesCompose.categoriesIdevices['Custom Category']).toBeDefined();
            expect(menuIdevicesCompose.categoriesExtra).toContain('Custom Category');
        });
    });

    describe('createDivCategoryIdevices', () => {
        let mockIdevices;

        beforeEach(() => {
            mockIdevices = [
                { id: 'text', title: 'Text', icon: { type: 'exe-icon', name: 'text-icon' } },
                { id: 'image', title: 'Image', icon: { type: 'exe-icon', name: 'image-icon' } },
            ];
        });

        it('should reorder text idevice to first position in information category', () => {
            const idevices = [
                { id: 'image', title: 'Image', icon: { type: 'exe-icon', name: 'image-icon' } },
                { id: 'text', title: 'Text', icon: { type: 'exe-icon', name: 'text-icon' } },
            ];
            menuIdevicesCompose.createDivCategoryIdevices('Information and presentation', idevices, 'information');
            expect(idevices[0].id).toBe('text');
        });

        it('should not reorder if text is already first', () => {
            menuIdevicesCompose.createDivCategoryIdevices('Information and presentation', mockIdevices, 'information');
            expect(mockIdevices[0].id).toBe('text');
        });

        it('should handle category without text idevice', () => {
            const idevices = [
                { id: 'quiz', title: 'Quiz', icon: { type: 'exe-icon', name: 'quiz-icon' } },
            ];
            menuIdevicesCompose.createDivCategoryIdevices('Assessment and tracking', idevices, 'evaluation');
            expect(idevices[0].id).toBe('quiz');
        });

        it('should create category div element', () => {
            menuIdevicesCompose.createDivCategoryIdevices('Games', [], 'games');
            const categoryDiv = mockMenuElement.querySelector('.idevice_category');
            expect(categoryDiv).not.toBeNull();
        });

        it('should append category to menu', () => {
            menuIdevicesCompose.createDivCategoryIdevices('Games', [], 'games');
            expect(mockMenuElement.children.length).toBeGreaterThan(0);
        });
    });

    describe('elementDivCategory', () => {
        it('should create div element', () => {
            const result = menuIdevicesCompose.elementDivCategory('Test Category');
            expect(result.tagName).toBe('DIV');
        });

        it('should add idevice_category class', () => {
            const result = menuIdevicesCompose.elementDivCategory('Test Category');
            expect(result.classList.contains('idevice_category')).toBe(true);
        });

        it('should add off class', () => {
            const result = menuIdevicesCompose.elementDivCategory('Test Category');
            expect(result.classList.contains('off')).toBe(true);
        });
    });

    describe('elementLabelCategory', () => {
        it('should create label div', () => {
            const result = menuIdevicesCompose.elementLabelCategory('Test', 'information');
            expect(result.tagName).toBe('DIV');
            expect(result.classList.contains('label')).toBe(true);
        });

        it('should create icon content and title', () => {
            const result = menuIdevicesCompose.elementLabelCategory('Info', 'information');
            expect(result.children.length).toBe(2);
        });

        it('should create h3 title element', () => {
            const result = menuIdevicesCompose.elementLabelCategory('Test Category', 'information');
            const h3 = result.querySelector('h3');
            expect(h3).not.toBeNull();
        });

        it('should set category icons for different types', () => {
            const icons = ['information', 'evaluation', 'games', 'interactive', 'science', 'imported', 'unknown'];
            icons.forEach(icon => {
                const result = menuIdevicesCompose.elementLabelCategory('Test', icon);
                expect(result.children.length).toBe(2);
            });
        });
    });

    describe('elementDivIdevicesParent', () => {
        let mockIdevices;

        beforeEach(() => {
            mockIdevices = [
                { id: 'text', title: 'Text', icon: { type: 'exe-icon', name: 'text-icon' } },
            ];
        });

        it('should create div with idevices class', () => {
            const result = menuIdevicesCompose.elementDivIdevicesParent(mockIdevices, 'information');
            expect(result.classList.contains('idevices')).toBe(true);
            expect(result.classList.contains('type_information')).toBe(true);
        });

        it('should add category title and description elements', () => {
            const result = menuIdevicesCompose.elementDivIdevicesParent(mockIdevices, 'information');
            const title = result.querySelector('.idevices-category-title');
            const desc = result.querySelector('.idevices-category-description');
            expect(title).not.toBeNull();
            expect(desc).not.toBeNull();
        });

        it('should handle different category types', () => {
            const types = ['information', 'evaluation', 'games', 'interactive', 'science', 'imported'];
            types.forEach(type => {
                const result = menuIdevicesCompose.elementDivIdevicesParent(mockIdevices, type);
                expect(result.classList.contains(`type_${type}`)).toBe(true);
            });
        });

        it('should filter out example idevice', () => {
            const idevicesWithExample = [
                { id: 'text', title: 'Text', icon: { type: 'exe-icon', name: 'text-icon' } },
                { id: 'example', title: 'Example', icon: { type: 'exe-icon', name: 'example-icon' } },
            ];
            const result = menuIdevicesCompose.elementDivIdevicesParent(idevicesWithExample, 'information');
            const items = result.querySelectorAll('.idevice_item');
            // Should only create element for text, not example
            expect(items.length).toBe(1);
        });

        it('should create import box for imported category', () => {
            const result = menuIdevicesCompose.elementDivIdevicesParent(mockIdevices, 'imported');
            const importBox = result.querySelector('.idevice-import-upload');
            expect(importBox).not.toBeNull();
        });
    });

    describe('elementDivIdevice', () => {
        let mockIdevice;

        beforeEach(() => {
            mockIdevice = {
                id: 'text',
                title: 'Text iDevice',
                icon: { type: 'exe-icon', name: 'text-icon' },
            };
        });

        it('should create div element with correct id', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.id).toBe('text');
        });

        it('should add idevice_item and draggable classes', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.classList.contains('idevice_item')).toBe(true);
            expect(result.classList.contains('draggable')).toBe(true);
        });

        it('should set draggable attribute to true', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.getAttribute('draggable')).toBe('true');
        });

        it('should set drag attribute to idevice', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.getAttribute('drag')).toBe('idevice');
        });

        it('should set icon-type and icon-name attributes', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.getAttribute('icon-type')).toBe('exe-icon');
            expect(result.getAttribute('icon-name')).toBe('text-icon');
        });

        it('should set data-testid attribute', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.getAttribute('data-testid')).toBe('idevice-text');
        });

        it('should append icon and title elements', () => {
            const result = menuIdevicesCompose.elementDivIdevice(mockIdevice);
            expect(result.querySelector('.idevice_icon')).not.toBeNull();
            expect(result.querySelector('.idevice_title')).not.toBeNull();
        });
    });

    describe('elementDivIdeviceImported', () => {
        let mockIdevice;

        beforeEach(() => {
            mockIdevice = {
                id: 'custom-idevice',
                title: 'Custom iDevice',
                icon: { type: 'exe-icon', name: 'custom-icon' },
            };
        });

        it('should create div with correct id', () => {
            const result = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            expect(result.id).toBe('custom-idevice');
        });

        it('should add idevice_item and draggable classes', () => {
            const result = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            expect(result.classList.contains('idevice_item')).toBe(true);
            expect(result.classList.contains('draggable')).toBe(true);
        });

        it('should set title attribute', () => {
            const result = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            expect(result.getAttribute('title')).toBe('Custom iDevice');
        });

        it('should create dropdown menu with export and delete buttons', () => {
            const result = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            const dropdown = result.querySelector('.dropdown');
            expect(dropdown).not.toBeNull();
            expect(result.querySelector('.userIdeviceExport')).not.toBeNull();
            expect(result.querySelector('.userIdeviceDelete')).not.toBeNull();
        });
    });

    describe('elementDivIcon', () => {
        it('should create div with idevice_icon class', () => {
            const ideviceData = { icon: { type: 'exe-icon', name: 'test-icon' } };
            const result = menuIdevicesCompose.elementDivIcon(ideviceData);
            expect(result.classList.contains('idevice_icon')).toBe(true);
        });

        it('should set innerHTML for exe-icon type', () => {
            const ideviceData = { icon: { type: 'exe-icon', name: '<svg>icon</svg>' } };
            const result = menuIdevicesCompose.elementDivIcon(ideviceData);
            expect(result.innerHTML).toBe('<svg>icon</svg>');
        });

        it('should set background styles for img type', () => {
            const ideviceData = {
                icon: { type: 'img', url: 'icon.png' },
                path: '/idevices/custom',
            };
            const result = menuIdevicesCompose.elementDivIcon(ideviceData);
            expect(result.classList.contains('idevice-img-icon')).toBe(true);
            expect(result.style.backgroundImage).toContain('url');
        });
    });

    describe('elementDivTitle', () => {
        it('should create div with idevice_title class', () => {
            const result = menuIdevicesCompose.elementDivTitle('Test Title');
            expect(result.classList.contains('idevice_title')).toBe(true);
        });

        it('should set innerHTML to title', () => {
            const result = menuIdevicesCompose.elementDivTitle('Test Title');
            expect(result.innerHTML).toBe('Test Title');
        });
    });

    describe('createImportDeviceBox', () => {
        it('should create button element', () => {
            const result = menuIdevicesCompose.createImportDeviceBox();
            expect(result.tagName).toBe('BUTTON');
        });

        it('should add correct classes to button', () => {
            const result = menuIdevicesCompose.createImportDeviceBox();
            expect(result.classList.contains('idevice-import-upload')).toBe(true);
            expect(result.classList.contains('btn')).toBe(true);
        });

        it('should have click handler that triggers file input', () => {
            // Create file input element
            const input = document.createElement('input');
            input.id = 'idevice-file-import';
            input.click = vi.fn();
            document.body.appendChild(input);

            const result = menuIdevicesCompose.createImportDeviceBox();
            result.click();

            expect(input.click).toHaveBeenCalled();
        });

        it('should handle dragover event', () => {
            const result = menuIdevicesCompose.createImportDeviceBox();
            const event = new Event('dragover');
            event.preventDefault = vi.fn();
            result.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle dragleave event', () => {
            const result = menuIdevicesCompose.createImportDeviceBox();
            result.classList.add('dragover');
            result.dispatchEvent(new Event('dragleave'));
            expect(result.classList.contains('dragover')).toBe(false);
        });
    });

    describe('makeElementInputFileImportIdevice', () => {
        it('should create wrapper div', () => {
            const result = menuIdevicesCompose.makeElementInputFileImportIdevice();
            expect(result.tagName).toBe('DIV');
        });

        it('should contain input and label elements', () => {
            const result = menuIdevicesCompose.makeElementInputFileImportIdevice();
            const input = result.querySelector('input');
            const label = result.querySelector('label');
            expect(input).not.toBeNull();
            expect(label).not.toBeNull();
        });

        it('should set input type to file', () => {
            const result = menuIdevicesCompose.makeElementInputFileImportIdevice();
            const input = result.querySelector('input');
            expect(input.getAttribute('type')).toBe('file');
        });

        it('should accept zip files only', () => {
            const result = menuIdevicesCompose.makeElementInputFileImportIdevice();
            const input = result.querySelector('input');
            expect(input.getAttribute('accept')).toBe('.zip');
        });
    });

    describe('addNewReader', () => {
        it('should add reader to readers array', () => {
            const mockFile = { name: 'test.zip' };
            menuIdevicesCompose.addNewReader(mockFile);
            expect(menuIdevicesCompose.readers.length).toBe(1);
        });

        it('should call readAsDataURL on reader', () => {
            const mockFile = { name: 'test.zip' };
            menuIdevicesCompose.addNewReader(mockFile);
            const reader = menuIdevicesCompose.readers[0];
            expect(reader.readAsDataURL).toHaveBeenCalledWith(mockFile);
        });

        it('should call uploadIdevice on load', () => {
            const spy = vi.spyOn(menuIdevicesCompose, 'uploadIdevice');
            const mockFile = { name: 'test.zip' };
            menuIdevicesCompose.addNewReader(mockFile);
            expect(spy).toHaveBeenCalledWith('test.zip', 'data:application/zip;base64,test');
        });
    });

    describe('uploadIdevice', () => {
        it('should call API with filename and file data', async () => {
            eXeLearning.app.api.postUploadIdevice.mockResolvedValue({
                responseMessage: 'OK',
                idevice: { name: 'custom', title: 'Custom', icon: {} },
            });
            menuIdevicesCompose.categoriesIdevices = { 'Imported': [] };

            await menuIdevicesCompose.uploadIdevice('test.zip', 'data:test');

            expect(eXeLearning.app.api.postUploadIdevice).toHaveBeenCalledWith({
                filename: 'test.zip',
                file: 'data:test',
            });
        });

        it('should load idevice on success', async () => {
            const mockResponse = {
                responseMessage: 'OK',
                idevice: { name: 'custom', title: 'Custom', icon: {} },
            };
            eXeLearning.app.api.postUploadIdevice.mockResolvedValue(mockResponse);
            menuIdevicesCompose.categoriesIdevices = { 'Imported': [] };

            await menuIdevicesCompose.uploadIdevice('test.zip', 'data:test');

            expect(mockIdeviceList.loadIdevice).toHaveBeenCalled();
        });

        it('should show alert on failure', async () => {
            const spy = vi.spyOn(menuIdevicesCompose, 'showElementAlert');
            eXeLearning.app.api.postUploadIdevice.mockResolvedValue({
                responseMessage: 'ERROR',
                error: 'Invalid file',
            });

            await menuIdevicesCompose.uploadIdevice('test.zip', 'data:test');

            expect(spy).toHaveBeenCalledWith('Failed to install the new iDevice', expect.any(Object));
        });
    });

    describe('removeIdevice', () => {
        beforeEach(() => {
            menuIdevicesCompose.categoriesIdevices = {
                'Imported': [{ id: 'custom', name: 'custom' }],
            };
            // Add element to DOM
            const el = document.createElement('div');
            el.id = 'custom';
            document.body.appendChild(el);
        });

        it('should call API with id', async () => {
            eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({
                responseMessage: 'OK',
                deleted: { name: 'custom' },
            });

            await menuIdevicesCompose.removeIdevice('custom');

            expect(eXeLearning.app.api.deleteIdeviceInstalled).toHaveBeenCalledWith({ id: 'custom' });
        });

        it('should remove idevice from list on success', async () => {
            eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({
                responseMessage: 'OK',
                deleted: { name: 'custom' },
            });

            await menuIdevicesCompose.removeIdevice('custom');

            expect(mockIdeviceList.removeIdevice).toHaveBeenCalledWith('custom');
        });

        it('should remove DOM element on success', async () => {
            eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({
                responseMessage: 'OK',
                deleted: { name: 'custom' },
            });

            await menuIdevicesCompose.removeIdevice('custom');

            expect(document.getElementById('custom')).toBeNull();
        });

        it('should show alert on failure', async () => {
            vi.useFakeTimers();
            const spy = vi.spyOn(menuIdevicesCompose, 'showElementAlert');
            eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({
                responseMessage: 'ERROR',
            });

            await menuIdevicesCompose.removeIdevice('custom');
            vi.runAllTimers();

            expect(spy).toHaveBeenCalledWith('Could not remove the iDevice', expect.any(Object));
            vi.useRealTimers();
        });
    });

    describe('downloadIdeviceZip', () => {
        it('should call API with session and dirName', async () => {
            const mockIdevice = { dirName: 'custom-idevice' };
            eXeLearning.app.api.getIdeviceInstalledZip.mockResolvedValue({
                zipFileName: 'custom.zip',
                zipBase64: 'base64data',
            });

            await menuIdevicesCompose.downloadIdeviceZip(mockIdevice);

            expect(eXeLearning.app.api.getIdeviceInstalledZip).toHaveBeenCalledWith(
                'test-session-123',
                'custom-idevice'
            );
        });

        it('should not throw on empty response', async () => {
            const mockIdevice = { dirName: 'custom-idevice' };
            eXeLearning.app.api.getIdeviceInstalledZip.mockResolvedValue(null);

            // downloadIdeviceZip doesn't return a promise, just uses internal .then()
            // We just verify it doesn't throw by waiting for the API call
            menuIdevicesCompose.downloadIdeviceZip(mockIdevice);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(eXeLearning.app.api.getIdeviceInstalledZip).toHaveBeenCalled();
        });
    });

    describe('rebuildImportedIdevices', () => {
        beforeEach(() => {
            menuIdevicesCompose.categoriesIdevices = {
                'Imported': [
                    { id: 'custom1', title: 'Custom 1', icon: { type: 'exe-icon', name: 'icon1' } },
                    { id: 'custom2', title: 'Custom 2', icon: { type: 'exe-icon', name: 'icon2' } },
                ],
            };
        });

        it('should query imported idevices content', () => {
            menuIdevicesCompose.rebuildImportedIdevices();
            expect(menuIdevicesCompose.importedIdevicesContent).not.toBeNull();
        });

        it('should call behaviour on project idevices', () => {
            menuIdevicesCompose.rebuildImportedIdevices();
            expect(eXeLearning.app.project.idevices.behaviour).toHaveBeenCalled();
        });
    });

    describe('showElementAlert', () => {
        it('should call eXe.app.alert with message', () => {
            menuIdevicesCompose.showElementAlert('Test error', null);
            expect(eXe.app.alert).toHaveBeenCalledWith('<p>Test error</p>');
        });

        it('should include response error in alert', () => {
            menuIdevicesCompose.showElementAlert('Test error', { error: 'Details here' });
            expect(eXe.app.alert).toHaveBeenCalledWith('<p>Test error:</p><p>&nbsp;Details here</p>');
        });

        it('should handle response without error property', () => {
            menuIdevicesCompose.showElementAlert('Test error', {});
            expect(eXe.app.alert).toHaveBeenCalledWith('<p>Test error</p>');
        });
    });

    describe('export button click handler', () => {
        it('should call downloadIdeviceZip on export click', async () => {
            eXeLearning.app.api.getIdeviceInstalledZip.mockResolvedValue({
                zipFileName: 'custom.zip',
                zipBase64: 'base64data',
            });
            const spy = vi.spyOn(menuIdevicesCompose, 'downloadIdeviceZip');
            const mockIdevice = {
                id: 'custom',
                title: 'Custom',
                icon: { type: 'exe-icon', name: 'icon' },
            };

            const element = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            const exportButton = element.querySelector('.userIdeviceExport');
            exportButton.click();

            expect(spy).toHaveBeenCalledWith(mockIdevice);
        });
    });

    describe('delete button click handler', () => {
        it('should show confirm modal on delete click', () => {
            const mockIdevice = {
                id: 'custom',
                title: 'Custom',
                icon: { type: 'exe-icon', name: 'icon' },
            };

            const element = menuIdevicesCompose.elementDivIdeviceImported(mockIdevice);
            const deleteButton = element.querySelector('.userIdeviceDelete');
            deleteButton.click();

            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Delete iDevice',
                    confirmButtonText: 'Delete',
                    cancelButtonText: 'Cancel',
                })
            );
        });
    });

    describe('file input change handler', () => {
        it('should call addNewReader on file input change', () => {
            const spy = vi.spyOn(menuIdevicesCompose, 'addNewReader');
            const wrapper = menuIdevicesCompose.makeElementInputFileImportIdevice();
            const input = wrapper.querySelector('input');

            // Create a mock file and simulate change event
            const mockFile = { name: 'test.zip' };
            Object.defineProperty(input, 'files', {
                value: [mockFile],
                writable: true,
            });

            input.dispatchEvent(new Event('change'));

            expect(spy).toHaveBeenCalledWith(mockFile);
        });
    });
});
