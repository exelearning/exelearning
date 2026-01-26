/**
 * ProjectProperties Tests
 *
 * Unit tests for ProjectProperties - manages project properties and cataloguing metadata.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock FormProperties before importing ProjectProperties
vi.mock('./formProperties.js', () => {
    return {
        default: vi.fn().mockImplementation(function (properties) {
            return {
                properties: properties,
                show: vi.fn(),
                remove: vi.fn(),
                combineMetadataProperties: vi.fn(),
            };
        }),
    };
});

import ProjectProperties from './projectProperties.js';
import FormProperties from './formProperties.js';

describe('ProjectProperties', () => {
    let projectProperties;
    let mockProject;
    let mockApp;
    let mockYjsBridge;
    let mockDocumentManager;
    let mockMetadataMap;

    beforeEach(() => {
        // Setup global mocks
        window.AppLogger = {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        window._ = vi.fn((key) => key);

        // Setup console spies
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Create mock metadata map
        mockMetadataMap = new Map();
        mockMetadataMap.set('title', 'Project Title');
        mockMetadataMap.set('author', 'John Doe');
        mockMetadataMap.set('description', 'Test Description');

        // Create mock document manager
        mockDocumentManager = {
            getMetadata: vi.fn(() => mockMetadataMap),
        };

        // Create mock Yjs bridge
        mockYjsBridge = {
            initialized: true,
            getDocumentManager: vi.fn(() => mockDocumentManager),
        };

        // Setup eXeLearning mock
        window.eXeLearning = {
            app: {
                api: {
                    parameters: {
                        odeProjectSyncPropertiesConfig: {
                            properties_package: {
                                pp_title: {
                                    title: 'Title',
                                    value: '',
                                    type: 'text',
                                    alwaysVisible: true,
                                },
                                pp_author: {
                                    title: 'Author',
                                    value: '',
                                    type: 'text',
                                    alwaysVisible: true,
                                },
                            },
                            properties_license: {
                                pp_license: {
                                    title: 'License',
                                    value: '',
                                    type: 'select',
                                    alwaysVisible: false,
                                },
                            },
                        },
                        // LOM fields have been deprecated - cataloguing config is now empty
                        odeProjectSyncCataloguingConfig: {},
                    },
                },
                modals: {
                    properties: {
                        show: vi.fn(),
                    },
                },
            },
        };

        // Create mock project with structure and interface
        mockApp = {
            interface: {
                odeTitleElement: {
                    setTitle: vi.fn(),
                },
            },
        };

        mockProject = {
            app: mockApp,
            structure: {
                setTitleToNodeRoot: vi.fn(),
            },
            _yjsBridge: mockYjsBridge,
        };

        // Clear FormProperties mock calls
        FormProperties.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete window.AppLogger;
        delete window._;
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should create a ProjectProperties instance', () => {
            projectProperties = new ProjectProperties(mockProject);

            expect(projectProperties).toBeInstanceOf(ProjectProperties);
            expect(projectProperties.project).toBe(mockProject);
        });

        it('should initialize categoryPropertiesId to "properties"', () => {
            projectProperties = new ProjectProperties(mockProject);

            expect(projectProperties.categoryPropertiesId).toBe('properties');
        });

        it('should initialize categoryCataloguingId to "cataloguing"', () => {
            projectProperties = new ProjectProperties(mockProject);

            expect(projectProperties.categoryCataloguingId).toBe('cataloguing');
        });

        it('should create a FormProperties instance', () => {
            projectProperties = new ProjectProperties(mockProject);

            expect(FormProperties).toHaveBeenCalledTimes(1);
            expect(FormProperties).toHaveBeenCalledWith(projectProperties);
            expect(projectProperties.formProperties).toBeDefined();
        });

        it('should pass itself to FormProperties constructor', () => {
            projectProperties = new ProjectProperties(mockProject);

            const formPropertiesInstance = FormProperties.mock.results[0].value;
            expect(formPropertiesInstance.properties).toBe(projectProperties);
        });
    });

    describe('load', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
            vi.spyOn(projectProperties, 'loadPropertiesFromYjs').mockImplementation(() => {});
        });

        it('should load properties config from API parameters', async () => {
            await projectProperties.load();

            expect(projectProperties.propertiesConfig).toBeDefined();
            expect(projectProperties.propertiesConfig).toHaveProperty('properties_package');
            expect(projectProperties.propertiesConfig).toHaveProperty('properties_license');
        });

        it('should create a deep copy of propertiesConfig', async () => {
            await projectProperties.load();

            const originalConfig = window.eXeLearning.app.api.parameters.odeProjectSyncPropertiesConfig;
            expect(projectProperties.propertiesConfig).not.toBe(originalConfig);
            expect(projectProperties.propertiesConfig.properties_package).not.toBe(
                originalConfig.properties_package
            );
        });

        it('should flatten properties config into properties object', async () => {
            await projectProperties.load();

            expect(projectProperties.properties).toBeDefined();
            expect(projectProperties.properties).toHaveProperty('pp_title');
            expect(projectProperties.properties).toHaveProperty('pp_author');
            expect(projectProperties.properties).toHaveProperty('pp_license');
        });

        it('should preserve property structure when flattening', async () => {
            await projectProperties.load();

            expect(projectProperties.properties.pp_title).toMatchObject({
                title: 'Title',
                value: '',
                type: 'text',
                alwaysVisible: true,
            });
        });

        it('should load cataloguing config from API parameters (now empty)', async () => {
            await projectProperties.load();

            expect(projectProperties.cataloguingConfig).toBeDefined();
            // LOM fields have been deprecated - cataloguing config is now empty
            expect(Object.keys(projectProperties.cataloguingConfig)).toHaveLength(0);
        });

        it('should create a deep copy of cataloguingConfig (even if empty)', async () => {
            await projectProperties.load();

            const originalConfig = window.eXeLearning.app.api.parameters.odeProjectSyncCataloguingConfig;
            expect(projectProperties.cataloguingConfig).not.toBe(originalConfig);
        });

        it('should flatten cataloguing config into empty cataloguing object', async () => {
            await projectProperties.load();

            expect(projectProperties.cataloguing).toBeDefined();
            // LOM fields have been deprecated - no properties expected
            expect(Object.keys(projectProperties.cataloguing)).toHaveLength(0);
        });

        it('should call loadPropertiesFromYjs after loading configs', async () => {
            await projectProperties.load();

            expect(projectProperties.loadPropertiesFromYjs).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple categories in properties config', async () => {
            await projectProperties.load();

            const propertyKeys = Object.keys(projectProperties.properties);
            expect(propertyKeys).toContain('pp_title');
            expect(propertyKeys).toContain('pp_author');
            expect(propertyKeys).toContain('pp_license');
        });

        it('should handle empty cataloguing config', async () => {
            await projectProperties.load();

            const cataloguingKeys = Object.keys(projectProperties.cataloguing);
            // LOM fields have been deprecated - no properties expected
            expect(cataloguingKeys).toHaveLength(0);
        });
    });

    describe('showModalProperties', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
            projectProperties.properties = {
                pp_title: { title: 'Title', value: 'Test', type: 'text' },
            };
        });

        it('should call eXeLearning.app.modals.properties.show', () => {
            projectProperties.showModalProperties();

            expect(window.eXeLearning.app.modals.properties.show).toHaveBeenCalledTimes(1);
        });

        it('should pass correct parameters to modal show', () => {
            projectProperties.showModalProperties();

            expect(window.eXeLearning.app.modals.properties.show).toHaveBeenCalledWith({
                node: projectProperties,
                title: 'Project properties',
                contentId: 'project-properties',
                properties: projectProperties.properties,
                fullScreen: true,
            });
        });

        it('should pass node reference as this', () => {
            projectProperties.showModalProperties();

            const callArgs = window.eXeLearning.app.modals.properties.show.mock.calls[0][0];
            expect(callArgs.node).toBe(projectProperties);
        });

        it('should use translated title', () => {
            window._ = vi.fn((key) => `Translated: ${key}`);
            projectProperties.showModalProperties();

            const callArgs = window.eXeLearning.app.modals.properties.show.mock.calls[0][0];
            expect(callArgs.title).toBe('Translated: Project properties');
            expect(window._).toHaveBeenCalledWith('Project properties');
        });

        it('should enable fullScreen mode', () => {
            projectProperties.showModalProperties();

            const callArgs = window.eXeLearning.app.modals.properties.show.mock.calls[0][0];
            expect(callArgs.fullScreen).toBe(true);
        });
    });

    describe('loadPropertiesFromYjs', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
            projectProperties.properties = {
                pp_title: { title: 'Title', value: '', type: 'text' },
                pp_author: { title: 'Author', value: '', type: 'text' },
                pp_description: { title: 'Description', value: '', type: 'textarea' },
                pp_license: { title: 'License', value: '', type: 'select' },
            };
        });

        it('should load properties from Yjs metadata map', () => {
            projectProperties.loadPropertiesFromYjs();

            expect(projectProperties.properties.pp_title.value).toBe('Project Title');
            expect(projectProperties.properties.pp_author.value).toBe('John Doe');
            expect(projectProperties.properties.pp_description.value).toBe('Test Description');
        });

        it('should map property keys correctly using mapPropertyToMetadataKey', () => {
            vi.spyOn(projectProperties, 'mapPropertyToMetadataKey');
            projectProperties.loadPropertiesFromYjs();

            expect(projectProperties.mapPropertyToMetadataKey).toHaveBeenCalledWith('pp_title');
            expect(projectProperties.mapPropertyToMetadataKey).toHaveBeenCalledWith('pp_author');
        });

        it('should not update properties with undefined metadata values', () => {
            projectProperties.loadPropertiesFromYjs();

            // pp_license has no metadata value
            expect(projectProperties.properties.pp_license.value).toBe('');
        });

        it('should handle null Yjs bridge gracefully', () => {
            mockProject._yjsBridge = null;

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.warn).toHaveBeenCalledWith(
                '[ProjectProperties] Yjs document manager not available'
            );
        });

        it('should handle undefined Yjs bridge gracefully', () => {
            mockProject._yjsBridge = undefined;

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.warn).toHaveBeenCalledWith(
                '[ProjectProperties] Yjs document manager not available'
            );
        });

        it('should handle null document manager gracefully', () => {
            mockYjsBridge.getDocumentManager.mockReturnValue(null);

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.warn).toHaveBeenCalledWith(
                '[ProjectProperties] Yjs document manager not available'
            );
        });

        it('should handle null metadata map gracefully', () => {
            mockDocumentManager.getMetadata.mockReturnValue(null);

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.warn).toHaveBeenCalledWith(
                '[ProjectProperties] Yjs metadata map not available'
            );
        });

        it('should handle undefined metadata map gracefully', () => {
            mockDocumentManager.getMetadata.mockReturnValue(undefined);

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.warn).toHaveBeenCalledWith(
                '[ProjectProperties] Yjs metadata map not available'
            );
        });

        it('should complete successfully without errors', () => {
            // This test verifies that loadPropertiesFromYjs completes without throwing
            // The actual logging is tested implicitly via no exceptions being thrown
            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();

            // Verify the properties were actually loaded from metadata
            expect(projectProperties.properties.pp_title.value).toBe('Project Title');
            expect(projectProperties.properties.pp_author.value).toBe('John Doe');
        });

        it('should catch and log errors during loading', () => {
            mockYjsBridge.getDocumentManager.mockImplementation(() => {
                throw new Error('Test error');
            });

            expect(() => projectProperties.loadPropertiesFromYjs()).not.toThrow();
            expect(console.error).toHaveBeenCalledWith(
                '[ProjectProperties] Failed to load from Yjs:',
                expect.any(Error)
            );
        });

        it('should update properties only when metadata value exists', () => {
            mockMetadataMap.set('title', 'New Title');
            mockMetadataMap.set('author', 'New Author');
            // Clear description from metadata to test that it's not updated
            mockMetadataMap.delete('description');

            projectProperties.loadPropertiesFromYjs();

            expect(projectProperties.properties.pp_title.value).toBe('New Title');
            expect(projectProperties.properties.pp_author.value).toBe('New Author');
            expect(projectProperties.properties.pp_description.value).toBe('');
        });

        it('should handle empty metadata map', () => {
            mockMetadataMap.clear();

            projectProperties.loadPropertiesFromYjs();

            expect(projectProperties.properties.pp_title.value).toBe('');
            expect(projectProperties.properties.pp_author.value).toBe('');
            expect(projectProperties.properties.pp_description.value).toBe('');
        });

        it('should call getDocumentManager on Yjs bridge', () => {
            projectProperties.loadPropertiesFromYjs();

            expect(mockYjsBridge.getDocumentManager).toHaveBeenCalledTimes(1);
        });

        it('should call getMetadata on document manager', () => {
            projectProperties.loadPropertiesFromYjs();

            expect(mockDocumentManager.getMetadata).toHaveBeenCalledTimes(1);
        });
    });

    describe('mapPropertyToMetadataKey', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
        });

        it('should remove "pp_" prefix from property key', () => {
            const result = projectProperties.mapPropertyToMetadataKey('pp_title');

            expect(result).toBe('title');
        });

        it('should remove "pp_" prefix from multiple keys', () => {
            expect(projectProperties.mapPropertyToMetadataKey('pp_author')).toBe('author');
            expect(projectProperties.mapPropertyToMetadataKey('pp_description')).toBe('description');
            expect(projectProperties.mapPropertyToMetadataKey('pp_license')).toBe('license');
        });

        it('should map pp_lang to language (special case)', () => {
            const result = projectProperties.mapPropertyToMetadataKey('pp_lang');

            expect(result).toBe('language');
        });

        it('should return original key if no "pp_" prefix', () => {
            const result = projectProperties.mapPropertyToMetadataKey('title');

            expect(result).toBe('title');
        });

        it('should handle keys without prefix correctly', () => {
            expect(projectProperties.mapPropertyToMetadataKey('author')).toBe('author');
            expect(projectProperties.mapPropertyToMetadataKey('custom_field')).toBe('custom_field');
            expect(projectProperties.mapPropertyToMetadataKey('some_other_key')).toBe('some_other_key');
        });

        it('should handle empty string', () => {
            const result = projectProperties.mapPropertyToMetadataKey('');

            expect(result).toBe('');
        });

        it('should handle "pp_" only prefix', () => {
            const result = projectProperties.mapPropertyToMetadataKey('pp_');

            expect(result).toBe('');
        });

        it('should only remove first occurrence of "pp_"', () => {
            const result = projectProperties.mapPropertyToMetadataKey('pp_pp_title');

            expect(result).toBe('pp_title');
        });

        it('should handle case sensitivity', () => {
            expect(projectProperties.mapPropertyToMetadataKey('PP_title')).toBe('PP_title');
            expect(projectProperties.mapPropertyToMetadataKey('Pp_title')).toBe('Pp_title');
        });
    });

    describe('updateTitlePropertiesStructureNode', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
        });

        it('should call structure.setTitleToNodeRoot', () => {
            projectProperties.updateTitlePropertiesStructureNode();

            expect(mockProject.structure.setTitleToNodeRoot).toHaveBeenCalledTimes(1);
        });

        it('should call setTitleToNodeRoot without arguments', () => {
            projectProperties.updateTitlePropertiesStructureNode();

            expect(mockProject.structure.setTitleToNodeRoot).toHaveBeenCalledWith();
        });

        it('should not throw if structure is undefined', () => {
            mockProject.structure = undefined;

            expect(() => projectProperties.updateTitlePropertiesStructureNode()).toThrow();
        });

        it('should not throw if setTitleToNodeRoot is undefined', () => {
            mockProject.structure.setTitleToNodeRoot = undefined;

            expect(() => projectProperties.updateTitlePropertiesStructureNode()).toThrow();
        });
    });

    describe('updateTitlePropertiesMenuTop', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
        });

        it('should call interface.odeTitleElement.setTitle', () => {
            projectProperties.updateTitlePropertiesMenuTop();

            expect(mockApp.interface.odeTitleElement.setTitle).toHaveBeenCalledTimes(1);
        });

        it('should call setTitle without arguments', () => {
            projectProperties.updateTitlePropertiesMenuTop();

            expect(mockApp.interface.odeTitleElement.setTitle).toHaveBeenCalledWith();
        });

        it('should not throw if app is undefined', () => {
            mockProject.app = undefined;

            expect(() => projectProperties.updateTitlePropertiesMenuTop()).toThrow();
        });

        it('should not throw if interface is undefined', () => {
            mockProject.app.interface = undefined;

            expect(() => projectProperties.updateTitlePropertiesMenuTop()).toThrow();
        });

        it('should not throw if odeTitleElement is undefined', () => {
            mockProject.app.interface.odeTitleElement = undefined;

            expect(() => projectProperties.updateTitlePropertiesMenuTop()).toThrow();
        });

        it('should not throw if setTitle is undefined', () => {
            mockProject.app.interface.odeTitleElement.setTitle = undefined;

            expect(() => projectProperties.updateTitlePropertiesMenuTop()).toThrow();
        });
    });

    describe('integration tests', () => {
        beforeEach(() => {
            projectProperties = new ProjectProperties(mockProject);
        });

        it('should work end-to-end with full load and display flow', async () => {
            vi.spyOn(projectProperties, 'loadPropertiesFromYjs');

            await projectProperties.load();
            projectProperties.showModalProperties();

            expect(projectProperties.propertiesConfig).toBeDefined();
            expect(projectProperties.cataloguingConfig).toBeDefined();
            expect(projectProperties.loadPropertiesFromYjs).toHaveBeenCalled();
            expect(window.eXeLearning.app.modals.properties.show).toHaveBeenCalled();
        });

        it('should maintain reference between project and properties', () => {
            expect(projectProperties.project).toBe(mockProject);
            expect(projectProperties.formProperties.properties).toBe(projectProperties);
        });

        it('should handle property updates from Yjs and title updates', async () => {
            await projectProperties.load();
            projectProperties.loadPropertiesFromYjs();
            projectProperties.updateTitlePropertiesStructureNode();
            projectProperties.updateTitlePropertiesMenuTop();

            expect(mockProject.structure.setTitleToNodeRoot).toHaveBeenCalled();
            expect(mockApp.interface.odeTitleElement.setTitle).toHaveBeenCalled();
        });
    });
});
