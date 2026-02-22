/**
 * Tests for FormProperties class
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
        user: {
            preferences: {
                preferences: {
                    advancedMode: { value: 'false' },
                },
            },
        },
        common: {
            generateId: vi.fn().mockReturnValue('generated-id-123'),
        },
    },
};

import FormProperties from './formProperties.js';

describe('FormProperties', () => {
    let mockNodeContent;
    let mockPropertiesFormElement;
    let mockProperties;
    let mockYjsBinding;
    let mockDocumentManager;
    let mockYjsBridge;
    let mockProject;
    let originalWindow;

    beforeEach(() => {
        // Save original window objects
        originalWindow = {
            AppLogger: global.window?.AppLogger,
            eXeLearning: global.window?.eXeLearning,
            _: global.window?._,
            YjsPropertiesBinding: global.window?.YjsPropertiesBinding,
        };

        // Mock DOM elements
        mockNodeContent = {
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            append: vi.fn(() => {}),
        };

        mockPropertiesFormElement = {
            replaceWith: vi.fn(() => {}),
            remove: vi.fn(() => {}),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
        };

        // Mock Yjs binding
        mockYjsBinding = {
            bindForm: vi.fn(() => {}),
            unbindForm: vi.fn(() => {}),
        };

        mockDocumentManager = {
            initialized: true,
        };

        mockYjsBridge = {
            initialized: true,
            getDocumentManager: vi.fn(() => mockDocumentManager),
        };

        mockProject = {
            _yjsBridge: mockYjsBridge,
        };

        // Setup window mocks
        global.window = global.window || {};
        global.window.AppLogger = {
            log: vi.fn(() => {}),
        };

        global.window.eXeLearning = {
            app: {
                user: {
                    preferences: {
                        preferences: {
                            advancedMode: { value: 'false' },
                        },
                    },
                },
                common: {
                    generateId: vi.fn(() => 'generated-id-123'),
                },
            },
        };

        global.window._ = vi.fn((text) => text);

        // Mock YjsPropertiesBinding as a constructor
        global.window.YjsPropertiesBinding = class MockYjsPropertiesBinding {
            constructor() {
                return mockYjsBinding;
            }
        };

        // Mock document.querySelector
        const originalQuerySelector = document.querySelector;
        document.querySelector = vi.fn((selector) => {
            if (selector === '#main #workarea #node-content') {
                return mockNodeContent;
            }
            if (selector === 'body') {
                return {
                    addEventListener: vi.fn(() => {}),
                };
            }
            return originalQuerySelector.call(document, selector);
        });

        // Mock document.createElement
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = function (tagName) {
            const element = originalCreateElement(tagName);
            // Ensure all mock methods exist
            if (!element.setAttribute) element.setAttribute = vi.fn(() => {});
            if (!element.getAttribute) element.getAttribute = vi.fn(() => null);
            if (!element.addEventListener) element.addEventListener = vi.fn(() => {});
            if (!element.append) element.append = vi.fn(() => {});
            if (!element.remove) element.remove = vi.fn(() => {});
            return element;
        };

        // Mock properties
        mockProperties = {
            project: mockProject,
            properties: {
                titleNode: {
                    type: 'text',
                    value: 'Test Title',
                    title: 'Title',
                    required: true,
                    alwaysVisible: true,
                    category: { properties: 'Properties' },
                    groups: { properties_package: 'Package Properties' },
                },
                description: {
                    type: 'textarea',
                    value: 'Test Description',
                    title: 'Description',
                    required: false,
                    alwaysVisible: true,
                    category: { properties: 'Properties' },
                    groups: { properties_package: 'Package Properties' },
                    rows: 5,
                },
            },
            cataloguing: {
                author: {
                    type: 'text',
                    value: 'Test Author',
                    title: 'Author',
                    required: true,
                    alwaysVisible: false,
                    category: { cataloguing: 'Cataloguing' },
                    groups: { cataloguing_general: 'General' },
                },
            },
        };
    });

    afterEach(() => {
        // Restore original window objects
        if (originalWindow.AppLogger) {
            global.window.AppLogger = originalWindow.AppLogger;
        }
        if (originalWindow.eXeLearning) {
            global.window.eXeLearning = originalWindow.eXeLearning;
        }
        if (originalWindow._) {
            global.window._ = originalWindow._;
        }
        if (originalWindow.YjsPropertiesBinding) {
            global.window.YjsPropertiesBinding = originalWindow.YjsPropertiesBinding;
        }
    });

    describe('constructor', () => {
        it('should initialize with properties and query DOM elements', () => {
            const formProperties = new FormProperties(mockProperties);

            expect(formProperties.properties).toBe(mockProperties);
            expect(formProperties.metadataProperties).toEqual({});
            expect(formProperties.categories).toEqual([]);
            expect(formProperties.cataloguingCategoryKey).toBe('cataloguing');
            expect(formProperties.nodeContent).toBe(mockNodeContent);
            expect(formProperties.yjsBinding).toBe(null);
        });

        it('should query node-content element', () => {
            new FormProperties(mockProperties);

            expect(document.querySelector).toHaveBeenCalledWith(
                '#main #workarea #node-content'
            );
        });

        it('should add body click listener to hide help dialogs', () => {
            const bodyElement = { addEventListener: vi.fn(() => {}) };
            document.querySelector = vi.fn((selector) => {
                if (selector === 'body') return bodyElement;
                if (selector === '#main #workarea #node-content') return mockNodeContent;
                return null;
            });

            new FormProperties(mockProperties);

            expect(bodyElement.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function)
            );
        });
    });

    describe('combineMetadataProperties', () => {
        it('should combine all properties in advanced mode', () => {
            global.window.eXeLearning.app.user.preferences.preferences.advancedMode.value =
                'true';
            const formProperties = new FormProperties(mockProperties);

            const result = formProperties.combineMetadataProperties();

            expect(result).toHaveProperty('titleNode');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('author');
            expect(Object.keys(result).length).toBe(3);
        });

        it('should filter to only alwaysVisible properties in normal mode', () => {
            global.window.eXeLearning.app.user.preferences.preferences.advancedMode.value =
                'false';
            const formProperties = new FormProperties(mockProperties);

            const result = formProperties.combineMetadataProperties();

            expect(result).toHaveProperty('titleNode');
            expect(result).toHaveProperty('description');
            expect(result).not.toHaveProperty('author');
            expect(Object.keys(result).length).toBe(2);
        });

        it('should set metadataPropertiesBase with combined properties', () => {
            const formProperties = new FormProperties(mockProperties);

            formProperties.combineMetadataProperties();

            expect(formProperties.metadataPropertiesBase).toHaveProperty('titleNode');
            expect(formProperties.metadataPropertiesBase).toHaveProperty('author');
        });
    });

    describe('setBodyElement', () => {
        it('should replace existing form element', () => {
            mockNodeContent.querySelector = vi.fn(() => mockPropertiesFormElement);
            const formProperties = new FormProperties(mockProperties);
            const newElement = document.createElement('form');

            formProperties.setBodyElement(newElement);

            expect(mockPropertiesFormElement.replaceWith).toHaveBeenCalledWith(newElement);
        });

        it('should append form element if none exists', () => {
            mockNodeContent.querySelector = vi.fn(() => null);
            const formProperties = new FormProperties(mockProperties);
            const newElement = document.createElement('form');

            formProperties.setBodyElement(newElement);

            expect(mockNodeContent.append).toHaveBeenCalledWith(newElement);
            expect(formProperties.propertiesFormElement).toBe(newElement);
        });
    });

    describe('remove', () => {
        it('should cleanup Yjs binding and remove form element', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.yjsBinding = mockYjsBinding;
            formProperties.propertiesFormElement = mockPropertiesFormElement;

            formProperties.remove();

            expect(mockYjsBinding.unbindForm).toHaveBeenCalled();
            expect(formProperties.yjsBinding).toBe(null);
            expect(mockPropertiesFormElement.remove).toHaveBeenCalled();
        });

        it('should handle missing Yjs binding gracefully', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.propertiesFormElement = mockPropertiesFormElement;
            formProperties.yjsBinding = null;

            formProperties.remove();

            expect(mockPropertiesFormElement.remove).toHaveBeenCalled();
        });

        it('should handle missing form element gracefully', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.yjsBinding = mockYjsBinding;
            formProperties.propertiesFormElement = null;

            formProperties.remove();

            expect(mockYjsBinding.unbindForm).toHaveBeenCalled();
        });
    });

    describe('makeBodyElement', () => {
        it('should create form element with correct structure', () => {
            const formProperties = new FormProperties(mockProperties);
            const properties = { titleNode: mockProperties.properties.titleNode };

            const element = formProperties.makeBodyElement(properties);

            expect(element.tagName).toBe('FORM');
            expect(element.id).toBe('properties-node-content-form');
            expect(element.classList.contains('loading')).toBe(true);
            expect(element.hasAttribute('novalidate')).toBe(true);
        });

        it('should create form content and table containers', () => {
            const formProperties = new FormProperties(mockProperties);
            const properties = { titleNode: mockProperties.properties.titleNode };

            const element = formProperties.makeBodyElement(properties);
            const formContent = element.querySelector('.exe-properties-form-content');

            expect(formContent).not.toBe(null);
            expect(formContent.querySelector('.exe-table-content')).not.toBe(null);
        });

        it('should remove loading class after timeout', async () => {
            const formProperties = new FormProperties(mockProperties);
            const properties = { titleNode: mockProperties.properties.titleNode };

            const element = formProperties.makeBodyElement(properties);

            await new Promise((resolve) => {
                setTimeout(resolve, 150);
            });
            expect(element.classList.contains('loading')).toBe(false);
        });
    });

    describe('makeRowElement', () => {
        it('should create row element for text property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { ...mockProperties.properties.titleNode };

            const row = formProperties.makeRowElement('titleNode', property);

            expect(row.classList.contains('property-row')).toBe(true);
            expect(row.getAttribute('property')).toBe('titleNode');
            expect(row.getAttribute('type')).toBe('text');
        });

        it('should create row element for checkbox property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                type: 'checkbox',
                value: 'true',
                title: 'Test Checkbox',
                category: { properties: 'Properties' },
            };

            const row = formProperties.makeRowElement('testCheckbox', property);

            expect(row.getAttribute('type')).toBe('checkbox');
            expect(row.querySelector('.toggle-item')).not.toBe(null);
        });

        it('should set property id on property object', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { ...mockProperties.properties.titleNode };

            formProperties.makeRowElement('titleNode', property);

            expect(property.id).toBe('titleNode');
        });

        it('should add copied-row class for multiple properties', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                ...mockProperties.properties.titleNode,
                multipleId: 'contributor',
                multipleIndex: 2,
            };

            const row = formProperties.makeRowElement('contributor-2', property);

            expect(row.classList.contains('copied-row')).toBe(true);
        });

        it('should create checkbox with toggle behavior', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                type: 'checkbox',
                value: 'false',
                title: 'Toggle Test',
                category: { properties: 'Properties' },
            };

            const row = formProperties.makeRowElement('toggleTest', property);
            const toggleItem = row.querySelector('.toggle-item');
            const toggleInput = row.querySelector('.toggle-input');

            expect(toggleItem).not.toBe(null);
            expect(toggleInput).not.toBe(null);
            expect(toggleInput.type).toBe('checkbox');
        });

        it('should set duplicate attribute', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                ...mockProperties.properties.titleNode,
                duplicate: 3,
            };

            const row = formProperties.makeRowElement('titleNode', property);

            expect(row.getAttribute('duplicate')).toBe('3');
        });

    });

    describe('makeRowElementLabel', () => {
        it('should create label for required property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { title: 'Test Title', required: true };

            const label = formProperties.makeRowElementLabel('test-id', property);

            expect(label.tagName).toBe('LABEL');
            expect(label.textContent).toBe('* Test Title');
            expect(label.getAttribute('for')).toBe('test-id');
            // For required fields, the translatable text is wrapped in a span
            const span = label.querySelector('span[data-i18n]');
            expect(span).not.toBeNull();
            expect(span.getAttribute('data-i18n')).toBe('Test Title');
        });

        it('should create label for non-required property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { title: 'Test Title', required: false };

            const label = formProperties.makeRowElementLabel('test-id', property);

            expect(label.innerHTML).toBe('Test Title');
        });
    });

    describe('makeRowValueElement', () => {
        it('should create text input element', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'text', value: 'Test Value', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('INPUT');
            expect(element.value).toBe('Test Value');
            expect(element.classList.contains('form-control')).toBe(true);
        });

        it('should create checkbox input element', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'checkbox', value: 'true', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('INPUT');
            expect(element.checked).toBe(true);
            expect(element.classList.contains('toggle-input')).toBe(true);
        });

        it('should create checkbox input element from boolean true value', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'checkbox', value: true, id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('INPUT');
            expect(element.checked).toBe(true);
        });

        it('should create checkbox as unchecked for false value', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'checkbox', value: 'false', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.checked).toBe(false);
        });

        it('should create checkbox as unchecked for boolean false value', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'checkbox', value: false, id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.checked).toBe(false);
        });

        it('should create date input element', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'date', value: '2024-01-01', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('INPUT');
            expect(element.value).toBe('2024-01-01');
            expect(element.classList.contains('form-control')).toBe(true);
        });

        it('should create textarea element', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                type: 'textarea',
                value: 'Test Description',
                rows: 5,
                id: 'testId',
            };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('TEXTAREA');
            expect(element.value).toBe('Test Description');
            expect(element.getAttribute('rows')).toBe('5');
            expect(element.classList.contains('form-control')).toBe(true);
        });

        it('should create textarea with default rows if not specified', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'textarea', value: 'Test', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.getAttribute('rows')).toBe('3');
        });

        it('should create select element with options', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {
                type: 'select',
                value: 'option2',
                options: { option1: 'Option 1', option2: 'Option 2', option3: 'Option 3' },
                id: 'testId',
            };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('SELECT');
            expect(element.classList.contains('form-select')).toBe(true);
            const options = element.querySelectorAll('option');
            expect(options.length).toBe(3);
            expect(options[1].hasAttribute('selected')).toBe(true);
        });

        it('should create div for unknown type', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { type: 'unknown', value: 'test', id: 'testId' };

            const element = formProperties.makeRowValueElement(
                'test-id',
                'testName',
                property
            );

            expect(element.tagName).toBe('DIV');
        });

        // Note: Legacy license handling tests are in YjsPropertiesBinding.test.js
        // as that's where the actual legacy detection and injection logic lives
    });

    describe('addAttributesRowValueElement', () => {
        it('should add id and name attributes', () => {
            const formProperties = new FormProperties(mockProperties);
            const element = document.createElement('input');
            const property = {
                type: 'text',
                id: 'testId',
                category: { properties: 'Properties' },
                groups: { properties_package: 'Package' },
            };

            const result = formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            expect(result.id).toBe('test-id');
            expect(result.getAttribute('name')).toBe('test-id');
            expect(result.getAttribute('property')).toBe('testName');
        });

        it('should add required attribute for required properties', () => {
            const formProperties = new FormProperties(mockProperties);
            const element = document.createElement('input');
            const property = {
                type: 'text',
                required: true,
                id: 'testId',
                category: {},
                groups: {},
            };

            const result = formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            expect(result.hasAttribute('required')).toBe(true);
            expect(result.classList.contains('required')).toBe(true);
        });

        it('should add readonly attribute for readonly properties', () => {
            const formProperties = new FormProperties(mockProperties);
            const element = document.createElement('input');
            const property = {
                type: 'text',
                readonly: true,
                id: 'testId',
                category: {},
                groups: {},
            };

            const result = formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            expect(result.hasAttribute('readonly')).toBe(true);
        });

        it('should add data-testid attribute', () => {
            const formProperties = new FormProperties(mockProperties);
            const element = document.createElement('input');
            const property = {
                type: 'text',
                id: 'titleNode',
                category: {},
                groups: {},
            };

            const result = formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            expect(result.getAttribute('data-testid')).toBe('prop-title');
        });

        it('should add focus event listener to hide help content', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            const element = document.createElement('input');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
            const property = {
                type: 'text',
                id: 'testId',
                category: {},
                groups: {},
            };

            formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
        });

        it('should add change event listener for onchange property', () => {
            mockNodeContent.querySelector = vi.fn(() => null);
            const formProperties = new FormProperties(mockProperties);
            formProperties.propertiesFormElement = {
                querySelector: vi.fn(() => ({ querySelector: () => ({ value: '' }) })),
            };
            const element = document.createElement('input');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
            const property = {
                type: 'text',
                id: 'testId',
                onchange: 'targetProperty',
                category: {},
                groups: {},
            };

            formProperties.addAttributesRowValueElement(
                'test-id',
                'testName',
                property,
                element
            );

            const calls = addEventListenerSpy.mock.calls;
            const changeCall = calls.find((call) => call[0] === 'change');
            expect(changeCall).toBeDefined();
        });
    });

    describe('makeRowElementHelp', () => {
        it('should create help container with help text', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { help: 'This is help text' };

            const helpContainer = formProperties.makeRowElementHelp(property);

            expect(helpContainer).not.toBe(false);
            expect(helpContainer.classList.contains('exe-form-help')).toBe(true);
            expect(helpContainer.querySelector('.help-content').innerHTML).toBe(
                'This is help text'
            );
        });

        it('should return false if no help text', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {};

            const helpContainer = formProperties.makeRowElementHelp(property);

            expect(helpContainer).toBe(false);
        });

        it('should create help icon', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { help: 'Help text' };

            const helpContainer = formProperties.makeRowElementHelp(property);
            const helpIcon = helpContainer.querySelector('.form-help-exe-icon');

            expect(helpIcon).not.toBe(null);
            expect(helpIcon.classList.contains('icon-medium')).toBe(true);
        });
    });

    describe('makeRowActionsElement', () => {
        it('should create actions container for duplicate property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { duplicate: 3 };
            const row = document.createElement('div');

            const actionsContainer = formProperties.makeRowActionsElement(property, row);

            expect(actionsContainer).not.toBe(false);
            expect(actionsContainer.classList.contains('actions-duplicate-properties-container')).toBe(true);
            expect(actionsContainer.getAttribute('duplicate')).toBe('3');
        });

        it('should return false if not duplicate property', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = {};
            const row = document.createElement('div');

            const actionsContainer = formProperties.makeRowActionsElement(property, row);

            expect(actionsContainer).toBe(false);
        });

        it('should create add and delete buttons', () => {
            const formProperties = new FormProperties(mockProperties);
            const property = { duplicate: 2 };
            const row = document.createElement('div');

            const actionsContainer = formProperties.makeRowActionsElement(property, row);
            const addButton = actionsContainer.querySelector('.add-properties');
            const deleteButton = actionsContainer.querySelector('.delete-properties');

            expect(addButton).not.toBe(null);
            expect(deleteButton).not.toBe(null);
            expect(addButton.innerHTML).toBe('add_circle_outline');
            expect(deleteButton.innerHTML).toBe('remove_circle_outline');
        });
    });

    describe('initYjsBinding', () => {
        it('should initialize Yjs binding when conditions are met', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.propertiesFormElement = document.createElement('form');

            formProperties.initYjsBinding();

            expect(mockYjsBinding.bindForm).toHaveBeenCalledWith(
                formProperties.propertiesFormElement
            );
            expect(formProperties.yjsBinding).toBe(mockYjsBinding);
        });

        it('should cleanup previous binding before creating new one', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.propertiesFormElement = document.createElement('form');
            const previousBinding = { unbindForm: vi.fn(() => {}) };
            formProperties.yjsBinding = previousBinding;

            formProperties.initYjsBinding();

            expect(previousBinding.unbindForm).toHaveBeenCalled();
        });

        it('should not initialize if YjsBridge is not initialized', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.properties.project._yjsBridge.initialized = false;
            formProperties.propertiesFormElement = document.createElement('form');

            formProperties.initYjsBinding();

            // Verify binding was not initialized
            expect(formProperties.yjsBinding).toBe(null);
        });

        it('should not initialize if documentManager is not initialized', () => {
            const formProperties = new FormProperties(mockProperties);
            mockDocumentManager.initialized = false;
            formProperties.propertiesFormElement = document.createElement('form');

            formProperties.initYjsBinding();

            expect(mockYjsBinding.bindForm).not.toHaveBeenCalled();
        });

        it('should not initialize if YjsPropertiesBinding is not available', () => {
            const formProperties = new FormProperties(mockProperties);
            global.window.YjsPropertiesBinding = undefined;
            formProperties.propertiesFormElement = document.createElement('form');

            formProperties.initYjsBinding();

            expect(formProperties.yjsBinding).toBe(null);
        });

        it('should not initialize if YjsBridge does not exist', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.properties.project._yjsBridge = undefined;
            formProperties.propertiesFormElement = document.createElement('form');

            formProperties.initYjsBinding();

            expect(formProperties.yjsBinding).toBe(null);
        });
    });

    describe('showHelpContent', () => {
        it('should show help content', () => {
            const formProperties = new FormProperties(mockProperties);
            const helpContainer = document.createElement('div');
            const helpContent = document.createElement('span');
            helpContent.classList.add('help-content', 'help-hidden');
            helpContainer.appendChild(helpContent);

            formProperties.showHelpContent(helpContainer);

            expect(helpContent.classList.contains('help-hidden')).toBe(false);
            expect(helpContainer.classList.contains('help-content-active')).toBe(true);
            expect(helpContainer.classList.contains('help-content-disabled')).toBe(false);
        });
    });

    describe('hideHelpContent', () => {
        it('should hide help content', () => {
            const formProperties = new FormProperties(mockProperties);
            const helpContainer = document.createElement('div');
            helpContainer.classList.add('help-content-active');
            const helpContent = document.createElement('span');
            helpContent.classList.add('help-content');
            helpContainer.appendChild(helpContent);

            formProperties.hideHelpContent(helpContainer);

            expect(helpContent.classList.contains('help-hidden')).toBe(true);
            expect(helpContainer.classList.contains('help-content-disabled')).toBe(true);
            expect(helpContainer.classList.contains('help-content-active')).toBe(false);
        });
    });

    describe('hideHelpContentAll', () => {
        it('should hide all help content elements', () => {
            const formProperties = new FormProperties(mockProperties);
            const help1 = document.createElement('div');
            const help2 = document.createElement('div');
            const helpContent1 = document.createElement('span');
            const helpContent2 = document.createElement('span');
            helpContent1.classList.add('help-content');
            helpContent2.classList.add('help-content');
            help1.appendChild(helpContent1);
            help2.appendChild(helpContent2);

            mockNodeContent.querySelectorAll = vi.fn(() => [help1, help2]);

            formProperties.hideHelpContentAll();

            expect(helpContent1.classList.contains('help-hidden')).toBe(true);
            expect(helpContent2.classList.contains('help-hidden')).toBe(true);
        });
    });

    describe('focusTextInput', () => {
        it('should focus input and reset value', () => {
            const formProperties = new FormProperties(mockProperties);
            const input = document.createElement('input');
            input.value = 'test value';
            const focusSpy = vi.spyOn(input, 'focus');

            formProperties.focusTextInput(input);

            expect(focusSpy).toHaveBeenCalled();
            expect(input.value).toBe('test value');
        });

        it('should handle null input gracefully', () => {
            const formProperties = new FormProperties(mockProperties);

            expect(() => formProperties.focusTextInput(null)).not.toThrow();
        });
    });

    describe('reloadValues', () => {
        it('should reload text input values', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.combineMetadataProperties();

            const input = document.createElement('input');
            input.setAttribute('property', 'titleNode');
            mockNodeContent.querySelector = vi.fn((selector) => {
                if (selector.includes('titleNode')) return input;
                return null;
            });

            formProperties.properties.properties.titleNode.value = 'New Title';
            formProperties.reloadValues();

            expect(input.value).toBe('New Title');
        });

        it('should reload checkbox values to checked', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    testCheckbox: {
                        type: 'checkbox',
                        value: 'true',
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('property', 'testCheckbox');
            mockNodeContent.querySelector = vi.fn(() => checkbox);

            formProperties.reloadValues();

            expect(checkbox.checked).toBe(true);
        });

        it('should reload checkbox boolean values to checked', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    testCheckbox: {
                        type: 'checkbox',
                        value: true,
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('property', 'testCheckbox');
            mockNodeContent.querySelector = vi.fn(() => checkbox);

            formProperties.reloadValues();

            expect(checkbox.checked).toBe(true);
        });

        it('should reload checkbox values to unchecked', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    testCheckbox: {
                        type: 'checkbox',
                        value: 'false',
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.setAttribute('property', 'testCheckbox');
            mockNodeContent.querySelector = vi.fn(() => checkbox);

            formProperties.reloadValues();

            expect(checkbox.checked).toBe(false);
        });

        it('should reload textarea values', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    description: {
                        type: 'textarea',
                        value: 'Updated description',
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const textarea = document.createElement('textarea');
            textarea.setAttribute('property', 'description');
            mockNodeContent.querySelector = vi.fn(() => textarea);

            formProperties.reloadValues();

            expect(textarea.value).toBe('Updated description');
        });

        it('should reload date values', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    dateCreated: {
                        type: 'date',
                        value: '2024-12-18',
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const dateInput = document.createElement('input');
            dateInput.type = 'date';
            dateInput.setAttribute('property', 'dateCreated');
            mockNodeContent.querySelector = vi.fn(() => dateInput);

            formProperties.reloadValues();

            expect(dateInput.value).toBe('2024-12-18');
        });

        it('should handle multiple properties with multipleId', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.nodeContent = mockNodeContent;
            formProperties.properties = {
                properties: {
                    'contributor-1': {
                        type: 'text',
                        value: 'Contributor 1',
                        multipleId: 'contributor',
                        multipleIndex: 1,
                        alwaysVisible: true,
                    },
                    'contributor-2': {
                        type: 'text',
                        value: 'Contributor 2',
                        multipleId: 'contributor',
                        multipleIndex: 2,
                        alwaysVisible: true,
                    },
                },
                cataloguing: {},
                project: mockProject,
            };

            const input1 = document.createElement('input');
            const input2 = document.createElement('input');
            input1.setAttribute('property', 'contributor');
            input2.setAttribute('property', 'contributor');

            mockNodeContent.querySelectorAll = vi.fn(() => [input1, input2]);

            formProperties.reloadValues();

            expect(input1.value).toBe('Contributor 1');
            expect(input2.value).toBe('Contributor 2');
        });

        it('should skip properties without matching elements', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.metadataProperties = {
                missingProperty: {
                    type: 'text',
                    value: 'Test',
                },
            };

            mockNodeContent.querySelector = vi.fn(() => null);

            expect(() => formProperties.reloadValues()).not.toThrow();
        });
    });

    describe('show', () => {
        it('should combine metadata properties', () => {
            const formProperties = new FormProperties(mockProperties);
            mockNodeContent.querySelector = vi.fn(() => null);

            formProperties.show();

            // Verify metadata properties were combined
            expect(formProperties.metadataProperties).toBeDefined();
            expect(Object.keys(formProperties.metadataProperties).length).toBeGreaterThan(0);
        });

        it('should create and set body element', () => {
            const formProperties = new FormProperties(mockProperties);
            mockNodeContent.querySelector = vi.fn(() => null);

            formProperties.show();

            // Verify form element was created
            expect(formProperties.propertiesFormElement).toBeDefined();
            expect(formProperties.propertiesFormElement.id).toBe('properties-node-content-form');
        });

        it('should initialize Yjs binding', () => {
            const formProperties = new FormProperties(mockProperties);
            mockNodeContent.querySelector = vi.fn(() => null);

            formProperties.show();

            // Verify Yjs binding was initialized
            expect(formProperties.yjsBinding).toBe(mockYjsBinding);
        });
    });

    describe('addRowsFlatWithSectionTitles', () => {
        it('should sort properties by multipleId and multipleIndex', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                'prop-1': {
                    multipleId: 'contributor',
                    multipleIndex: 2,
                    category: {},
                    groups: {},
                },
                'prop-2': {
                    multipleId: 'contributor',
                    multipleIndex: 1,
                    category: {},
                    groups: {},
                },
            };

            formProperties.addRowsFlatWithSectionTitles(properties, table);

            const rows = table.querySelectorAll('.property-row');
            expect(rows.length).toBeGreaterThan(0);
        });

        it('should create group containers', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                titleNode: {
                    type: 'text',
                    title: 'Title',
                    value: 'Test',
                    groups: { properties_package: 'Package Properties' },
                    category: { properties: 'Properties' },
                },
            };

            formProperties.addRowsFlatWithSectionTitles(properties, table);

            const groupContainer = table.querySelector('[data-group="properties_package"]');
            expect(groupContainer).not.toBe(null);
        });

        it('should create collapsible group titles', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                titleNode: {
                    type: 'text',
                    title: 'Title',
                    value: 'Test',
                    groups: { properties_package: 'Package Properties' },
                    category: { properties: 'Properties' },
                },
            };

            formProperties.addRowsFlatWithSectionTitles(properties, table);

            const groupTitle = table.querySelector('.properties-group-title');
            expect(groupTitle).not.toBe(null);
            expect(groupTitle.getAttribute('data-bs-toggle')).toBe('collapse');
        });

        it('should mark package properties as expanded by default', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                titleNode: {
                    type: 'text',
                    title: 'Title',
                    value: 'Test',
                    groups: { properties_package: 'Package Properties' },
                    category: { properties: 'Properties' },
                },
            };

            formProperties.addRowsFlatWithSectionTitles(properties, table);

            const groupTitle = table.querySelector('.properties-group-title');
            expect(groupTitle.getAttribute('aria-expanded')).toBe('true');
        });

        it('should handle properties without groups', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                standalone: {
                    type: 'text',
                    title: 'Standalone',
                    value: 'Test',
                    category: {},
                },
            };

            formProperties.addRowsFlatWithSectionTitles(properties, table);

            const noGroupContainer = table.querySelector('[data-group="no-group"]');
            expect(noGroupContainer).not.toBe(null);
        });
    });

    describe('cloneRowElement', () => {
        it('should clone row and update IDs', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.metadataProperties = {
                contributor: {
                    type: 'text',
                    title: 'Contributor',
                    value: 'Test',
                },
            };

            const originalRow = document.createElement('div');
            originalRow.id = 'contributor-123-container';
            originalRow.setAttribute('property', 'contributor');

            const label = document.createElement('label');
            label.id = 'contributor-123';
            originalRow.appendChild(label);

            const input = document.createElement('input');
            input.id = 'contributor-123';
            input.classList.add('property-value');
            input.value = 'Original Value';
            originalRow.appendChild(input);

            const propertyBase = { groups: {} };
            const clonedRow = formProperties.cloneRowElement(originalRow, propertyBase, 0);

            expect(clonedRow.classList.contains('copied-row')).toBe(true);
            expect(clonedRow.classList.contains('first-copied-row')).toBe(true);
        });

        it('should clear value of cloned input elements', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.metadataProperties = {
                contributor: { type: 'text' },
            };

            const originalRow = document.createElement('div');
            originalRow.setAttribute('property', 'contributor');
            const input = document.createElement('input');
            input.classList.add('property-value');
            input.value = 'Original Value';
            originalRow.appendChild(input);

            const propertyBase = { groups: {} };
            const clonedRow = formProperties.cloneRowElement(originalRow, propertyBase, 0);
            const clonedInput = clonedRow.querySelector('.property-value');

            expect(clonedInput.value).toBe('');
        });

        it('should not clear value of cloned select elements', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.metadataProperties = {
                contributor: { type: 'select' },
            };

            const originalRow = document.createElement('div');
            originalRow.setAttribute('property', 'contributor');
            const select = document.createElement('select');
            select.classList.add('property-value');
            const option1 = document.createElement('option');
            option1.value = 'option1';
            option1.text = 'Option 1';
            const option2 = document.createElement('option');
            option2.value = 'option2';
            option2.text = 'Option 2';
            select.appendChild(option1);
            select.appendChild(option2);
            select.selectedIndex = 0;
            originalRow.appendChild(select);

            const propertyBase = { groups: {} };
            const clonedRow = formProperties.cloneRowElement(originalRow, propertyBase, 0);
            const clonedSelect = clonedRow.querySelector('.property-value');

            // The code doesn't clear select element values (unlike text inputs)
            // It just clones the node, which includes options
            expect(clonedSelect.tagName).toBe('SELECT');
            expect(clonedSelect.options.length).toBe(2);
        });

        it('should add first-copied-row class only for first clone', () => {
            const formProperties = new FormProperties(mockProperties);
            formProperties.metadataProperties = {
                contributor: { type: 'text' },
            };

            const originalRow = document.createElement('div');
            originalRow.setAttribute('property', 'contributor');
            const input = document.createElement('input');
            input.classList.add('property-value');
            originalRow.appendChild(input);

            const propertyBase = { groups: {} };
            const firstClone = formProperties.cloneRowElement(originalRow, propertyBase, 0);
            const secondClone = formProperties.cloneRowElement(originalRow, propertyBase, 1);

            expect(firstClone.classList.contains('first-copied-row')).toBe(true);
            expect(secondClone.classList.contains('first-copied-row')).toBe(false);
        });
    });

    describe('insertAfter', () => {
        it('should insert new node after reference node', () => {
            const formProperties = new FormProperties(mockProperties);
            const parent = document.createElement('div');
            const reference = document.createElement('div');
            const newNode = document.createElement('div');
            parent.appendChild(reference);

            formProperties.insertAfter(reference, newNode);

            expect(parent.children[1]).toBe(newNode);
        });
    });

    describe('addRowsWithTabs', () => {
        it('should create tab navigation with 3 tabs', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {
                titleNode: {
                    type: 'text',
                    title: 'Title',
                    value: 'Test',
                    groups: { properties_package: 'Content metadata' },
                    category: { properties: 'Properties' },
                },
            };

            formProperties.addRowsWithTabs(properties, table);

            const tabs = table.querySelectorAll('.project-properties-tab');
            expect(tabs.length).toBe(3);
        });

        it('should create tab panes for each tab', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {};

            formProperties.addRowsWithTabs(properties, table);

            const panes = table.querySelectorAll('.project-properties-tab-pane');
            expect(panes.length).toBe(3);
        });

        it('should set first tab as active by default', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {};

            formProperties.addRowsWithTabs(properties, table);

            const firstTab = table.querySelector('.project-properties-tab');
            const firstPane = table.querySelector('.project-properties-tab-pane');
            expect(firstTab.classList.contains('active')).toBe(true);
            expect(firstPane.classList.contains('active')).toBe(true);
        });

        it('should have correct tab titles', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {};

            formProperties.addRowsWithTabs(properties, table);

            const tabs = table.querySelectorAll('.project-properties-tab');
            expect(tabs[0].textContent).toBe('Content metadata');
            expect(tabs[1].textContent).toBe('Export options');
            expect(tabs[2].textContent).toBe('Custom code');
        });

        it('should have proper ARIA attributes on tabs', () => {
            const formProperties = new FormProperties(mockProperties);
            const table = document.createElement('div');
            const properties = {};

            formProperties.addRowsWithTabs(properties, table);

            const firstTab = table.querySelector('.project-properties-tab');
            expect(firstTab.getAttribute('role')).toBe('tab');
            expect(firstTab.getAttribute('aria-selected')).toBe('true');
        });
    });

    describe('groupPropertiesByGroup', () => {
        it('should group properties by their group key', () => {
            const formProperties = new FormProperties(mockProperties);
            const properties = {
                prop1: {
                    groups: { properties_package: 'Package' },
                },
                prop2: {
                    groups: { export: 'Export' },
                },
                prop3: {
                    groups: { properties_package: 'Package' },
                },
            };

            const grouped = formProperties.groupPropertiesByGroup(properties);

            expect(grouped.get('properties_package').length).toBe(2);
            expect(grouped.get('export').length).toBe(1);
        });

        it('should place properties without groups in __no_group__', () => {
            const formProperties = new FormProperties(mockProperties);
            const properties = {
                prop1: { groups: {} },
                prop2: {},
            };

            const grouped = formProperties.groupPropertiesByGroup(properties);

            expect(grouped.get('__no_group__').length).toBe(2);
        });
    });

    describe('activateTab', () => {
        it('should activate selected tab and deactivate others', () => {
            const formProperties = new FormProperties(mockProperties);

            const tabsNav = document.createElement('div');
            const tab1 = document.createElement('button');
            tab1.classList.add('project-properties-tab', 'active');
            const tab2 = document.createElement('button');
            tab2.classList.add('project-properties-tab');
            tabsNav.appendChild(tab1);
            tabsNav.appendChild(tab2);

            const tabContent = document.createElement('div');
            const pane1 = document.createElement('div');
            pane1.id = 'pane-1';
            pane1.classList.add('project-properties-tab-pane', 'active');
            const pane2 = document.createElement('div');
            pane2.id = 'pane-2';
            pane2.classList.add('project-properties-tab-pane');
            tabContent.appendChild(pane1);
            tabContent.appendChild(pane2);

            formProperties.activateTab(tabsNav, tabContent, tab2, 'pane-2');

            expect(tab1.classList.contains('active')).toBe(false);
            expect(tab2.classList.contains('active')).toBe(true);
            expect(pane1.classList.contains('active')).toBe(false);
            expect(pane2.classList.contains('active')).toBe(true);
        });

        it('should update aria-selected attributes', () => {
            const formProperties = new FormProperties(mockProperties);

            const tabsNav = document.createElement('div');
            const tab1 = document.createElement('button');
            tab1.classList.add('project-properties-tab');
            tab1.setAttribute('aria-selected', 'true');
            const tab2 = document.createElement('button');
            tab2.classList.add('project-properties-tab');
            tab2.setAttribute('aria-selected', 'false');
            tabsNav.appendChild(tab1);
            tabsNav.appendChild(tab2);

            const tabContent = document.createElement('div');
            const pane = document.createElement('div');
            pane.id = 'pane-2';
            pane.classList.add('project-properties-tab-pane');
            tabContent.appendChild(pane);

            formProperties.activateTab(tabsNav, tabContent, tab2, 'pane-2');

            expect(tab1.getAttribute('aria-selected')).toBe('false');
            expect(tab2.getAttribute('aria-selected')).toBe('true');
        });
    });
});
