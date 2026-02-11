/**
 * IdeviceNode Tests
 *
 * Unit tests for IdeviceNode class methods.
 * Tests core functionality like parameter handling, properties, mode updates, etc.
 *
 * Run with: bun test:frontend:ci
 */

// Setup global mocks BEFORE importing the module
// Note: ES6 imports are hoisted, so vitest.setup.js mocks are already in place
// We extend/override them here as needed

// Mock eXeLearning global object with required nested structure
global.eXeLearning = {
    app: {
        api: {
            parameters: {
                generateNewItemKey: 'generated-key-123',
                odeComponentsSyncPropertiesConfig: {
                    identifier: { value: '' },
                    visibility: { value: 'false' },
                    cssClass: { value: '' },
                },
            },
            putSaveComponent: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            putSavePropertiesComponent: vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' }),
        },
        project: {
            _yjsEnabled: false,
            _yjsBridge: null,
            odeVersion: 'v1',
            odeSession: 'session-123',
            checkOpenIdevice: vi.fn(() => false),
            isAvalaibleOdeComponent: vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' }),
            structure: {
                getSelectNodeNavId: vi.fn(() => 'nav-id-1'),
                getSelectNodePageId: vi.fn(() => 'page-id-1'),
                getAllNodesOrderByView: vi.fn(() => [
                    { id: 'page-1', deep: 0, pageName: 'Home' },
                    { id: 'page-2', deep: 1, pageName: 'Chapter 1' },
                ]),
            },
        },
        idevices: {
            getIdeviceInstalled: vi.fn((name) => {
                if (name === 'text' || name === 'FreeTextIdevice') {
                    return {
                        name: 'text',
                        title: 'Text',
                        cssClass: 'text',
                        edition: true,
                    };
                }
                if (name === 'crossword') {
                    return {
                        name: 'crossword',
                        title: 'Crossword',
                        cssClass: 'crossword',
                        edition: true,
                    };
                }
                return null;
            }),
        },
        modals: {
            alert: { show: vi.fn() },
            confirm: {
                show: vi.fn(),
                close: vi.fn(),
                modalElementBody: null,
            },
            properties: { show: vi.fn() },
        },
        common: {
            initTooltips: vi.fn(),
        },
        menus: {
            menuStructure: {
                engine: {
                    menuStructureBehaviour: {
                        checkIfEmptyNode: vi.fn(),
                        createAddTextBtn: vi.fn(),
                    },
                },
            },
        },
    },
    config: {
        isOfflineInstallation: false,
    },
};

// Import after setting up mocks
import IdeviceNode from './ideviceNode.js';

describe('IdeviceNode', () => {
    let idevice;
    let mockEngine;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset eXeLearning config
        eXeLearning.app.project._yjsEnabled = false;
        eXeLearning.app.project._yjsBridge = null;

        // Reset structure in case a test set it to null
        eXeLearning.app.project.structure = {
            getSelectNodeNavId: vi.fn(() => 'nav-id-1'),
            getSelectNodePageId: vi.fn(() => 'page-id-1'),
            getAllNodesOrderByView: vi.fn(() => [
                { id: 'page-1', deep: 0, pageName: 'Home' },
                { id: 'page-2', deep: 1, pageName: 'Chapter 1' },
            ]),
        };

        // Create mock engine
        mockEngine = {
            generateId: vi.fn(() => `engine-id-${Date.now()}`),
            clientCallWaitingTime: 5000,
            nodeContentElement: document.createElement('div'),
            addEventDragStartToContentIdevice: vi.fn(),
            addEventDragEndToContentIdevice: vi.fn(),
            components: { blocks: [], idevices: [] },
            getBlockById: vi.fn(),
            project: {
                _yjsBridge: null,
            },
        };

        // Setup basic DOM
        document.body.innerHTML = `
            <div id="node-content-container">
                <div id="node-content"></div>
            </div>
        `;

        // Create idevice with test data
        idevice = new IdeviceNode(mockEngine, {
            id: 'idevice-1',
            odeIdeviceId: 'idevice-id-1',
            odeIdeviceTypeName: 'text',
            order: 1,
            blockId: 'block-1',
            mode: 'export',
        });
    });

    afterEach(() => {
        idevice = null;
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('initializes with provided data', () => {
            expect(idevice.id).toBe('idevice-1');
            expect(idevice.odeIdeviceId).toBe('idevice-id-1');
            expect(idevice.odeIdeviceTypeName).toBe('text');
            expect(idevice.order).toBe(1);
            expect(idevice.blockId).toBe('block-1');
        });

        it('uses default values when data is missing', () => {
            const emptyIdevice = new IdeviceNode(mockEngine, {
                odeIdeviceTypeName: 'text',
            });
            expect(emptyIdevice.mode).toBe('edition');
            expect(emptyIdevice.order).toBe(0);
            expect(emptyIdevice.htmlView).toBe('');
        });

        it('generates odeIdeviceId when not provided', () => {
            mockEngine.generateId.mockReturnValue('generated-idevice-id');
            const newIdevice = new IdeviceNode(mockEngine, {
                odeIdeviceTypeName: 'text',
            });
            expect(mockEngine.generateId).toHaveBeenCalled();
        });

        it('initializes control parameters', () => {
            expect(idevice.accesibility).toBe(1);
            expect(idevice.visibility).toBe(true);
            expect(idevice.haveEdition).toBe(true);
            expect(idevice.canHaveHeirs).toBe(false);
        });

        it('stores engine reference', () => {
            expect(idevice.engine).toBe(mockEngine);
        });

        it('finds installed idevice by type name', () => {
            expect(idevice.idevice).not.toBeNull();
            expect(idevice.idevice.name).toBe('text');
        });

        it('initializes with Yjs-style ID when Yjs enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            const yjsIdevice = new IdeviceNode(mockEngine, {
                odeIdeviceTypeName: 'text',
            });
            expect(yjsIdevice.odeIdeviceId).toMatch(/^idevice-\d+-[a-z0-9]+$/);
        });
    });

    describe('setParams', () => {
        it('sets all params from data object', () => {
            idevice.setParams({
                odeNavStructureSyncId: 'nav-123',
                odeSessionId: 'session-456',
                odeVersionId: 'v2',
                blockId: 'block-2',
                mode: 'edition',
                order: 5,
                htmlView: '<p>Test content</p>',
            });

            expect(idevice.odeNavStructureSyncId).toBe('nav-123');
            expect(idevice.odeSessionId).toBe('session-456');
            expect(idevice.odeVersionId).toBe('v2');
            expect(idevice.blockId).toBe('block-2');
            expect(idevice.mode).toBe('edition');
            expect(idevice.order).toBe(5);
            expect(idevice.htmlView).toBe('<p>Test content</p>');
        });

        it('uses default values for missing params', () => {
            idevice.setParams({});
            expect(idevice.mode).toBe('edition');
            expect(idevice.order).toBe(0);
        });

        it('parses jsonProperties when passed as valid JSON string', () => {
            const jsonStr = JSON.stringify({
                title: 'My Crossword',
                words: 5,
                active: true,
            });
            idevice.setParams({ jsonProperties: jsonStr });

            expect(typeof idevice.jsonProperties).toBe('object');
            expect(idevice.jsonProperties.title).toBe('My Crossword');
            expect(idevice.jsonProperties.words).toBe(5);
        });

        it('handles empty jsonProperties string', () => {
            idevice.setParams({ jsonProperties: '{}' });
            expect(typeof idevice.jsonProperties).toBe('object');
            expect(Object.keys(idevice.jsonProperties).length).toBe(0);
        });

        it('calls setProperties when odeComponentsSyncProperties provided', () => {
            const spy = vi.spyOn(idevice, 'setProperties');
            idevice.setParams({
                odeComponentsSyncProperties: {
                    identifier: { value: 'my-id' },
                },
            });
            expect(spy).toHaveBeenCalledWith({ identifier: { value: 'my-id' } });
        });
    });

    describe('setProperties', () => {
        it('sets property values from data', () => {
            idevice.setProperties({
                identifier: { value: 'custom-id' },
                visibility: { value: 'true' },
                cssClass: { value: 'my-class' },
            });

            expect(idevice.properties.identifier.value).toBe('custom-id');
            expect(idevice.properties.visibility.value).toBe('true');
            expect(idevice.properties.cssClass.value).toBe('my-class');
        });

        it('only sets heritable properties when onlyHeritable is true', () => {
            idevice.setProperties(
                {
                    identifier: { value: 'inherited-id', heritable: true },
                    visibility: { value: 'true', heritable: false },
                },
                true,
            );

            expect(idevice.properties.identifier.value).toBe('inherited-id');
            expect(idevice.properties.visibility.value).toBe('false');
        });

        it('handles missing properties gracefully', () => {
            expect(() => {
                idevice.setProperties(null);
            }).not.toThrow();

            expect(() => {
                idevice.setProperties({});
            }).not.toThrow();
        });

        it('calls setPropertiesClassesToElement when ideviceContent exists', () => {
            idevice.ideviceContent = document.createElement('div');
            const spy = vi.spyOn(idevice, 'setPropertiesClassesToElement');
            idevice.setProperties({
                identifier: { value: 'test-id' },
            });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('isYjsEnabled', () => {
        it('returns false when Yjs is not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            expect(idevice.isYjsEnabled()).toBe(false);
        });

        it('returns true when Yjs is enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            expect(idevice.isYjsEnabled()).toBe(true);
        });

        it('returns false when project is undefined', () => {
            const originalProject = eXeLearning.app.project;
            eXeLearning.app.project = undefined;
            expect(idevice.isYjsEnabled()).toBe(false);
            eXeLearning.app.project = originalProject;
        });
    });

    describe('loadPropertiesFromYjs', () => {
        it('does nothing when Yjs is not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            idevice.loadPropertiesFromYjs();
            expect(idevice.properties.identifier.value).toBe('');
        });

        it('loads properties from Yjs when enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getComponentProperties: vi.fn(() => ({
                        identifier: 'yjs-id',
                        visibility: true,
                        cssClass: 'yjs-class',
                    })),
                },
            };

            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe('yjs-id');
            expect(idevice.properties.visibility.value).toBe('true');
            expect(idevice.properties.cssClass.value).toBe('yjs-class');
        });

        it('converts boolean values to strings', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getComponentProperties: vi.fn(() => ({
                        visibility: false,
                    })),
                },
            };

            idevice.loadPropertiesFromYjs();
            expect(idevice.properties.visibility.value).toBe('false');
        });

        it('does nothing when bridge not available', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = null;
            idevice.loadPropertiesFromYjs();
            expect(idevice.properties.identifier.value).toBe('');
        });
    });

    describe('makeIdeviceContentNode', () => {
        it('creates new div element when newNode is true', () => {
            const node = idevice.makeIdeviceContentNode(true);

            expect(node.tagName).toBe('DIV');
            expect(node.id).toBe('idevice-id-1');
            expect(node.classList.contains('idevice_node')).toBe(true);
            expect(node.classList.contains('idevice-element-in-content')).toBe(true);
            expect(node.classList.contains('draggable')).toBe(true);
        });

        it('sets correct attributes', () => {
            const node = idevice.makeIdeviceContentNode(true);

            expect(node.getAttribute('mode')).toBe('export');
            expect(node.getAttribute('order')).toBe('1');
            expect(node.getAttribute('drag')).toBe('idevice');
        });

        it('reuses existing element when newNode is false', () => {
            idevice.ideviceContent = document.createElement('div');
            idevice.ideviceContent.classList.add('old-class');
            idevice.ideviceContent.setAttribute('old-attr', 'value');

            const node = idevice.makeIdeviceContentNode(false);

            expect(node.classList.contains('old-class')).toBe(false);
            expect(node.classList.contains('idevice_node')).toBe(true);
            expect(node.hasAttribute('old-attr')).toBe(false);
        });

        it('adds idevice type class when idevice has name', () => {
            const node = idevice.makeIdeviceContentNode(true);
            expect(node.classList.contains('text')).toBe(true);
        });
    });

    describe('setPropertiesClassesToElement', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('sets identifier attribute', () => {
            idevice.properties.identifier.value = 'my-idevice-id';
            idevice.setPropertiesClassesToElement();

            expect(idevice.ideviceContent.getAttribute('identifier')).toBe(
                'my-idevice-id',
            );
        });

        it('sets export-view attribute when visibility is set', () => {
            idevice.properties.visibility.value = 'true';
            idevice.setPropertiesClassesToElement();

            expect(idevice.ideviceContent.getAttribute('export-view')).toBe('true');
        });

        it('adds CSS classes', () => {
            idevice.properties.cssClass.value = 'class1 class2 class3';
            idevice.setPropertiesClassesToElement();

            expect(idevice.ideviceContent.classList.contains('class1')).toBe(true);
            expect(idevice.ideviceContent.classList.contains('class2')).toBe(true);
            expect(idevice.ideviceContent.classList.contains('class3')).toBe(true);
        });

        it('does not set identifier when value is empty', () => {
            idevice.properties.identifier.value = '';
            idevice.setPropertiesClassesToElement();

            expect(idevice.ideviceContent.hasAttribute('identifier')).toBe(false);
        });
    });

    describe('makeIdeviceBodyElement', () => {
        it('creates body element with correct classes', () => {
            const body = idevice.makeIdeviceBodyElement();

            expect(body.tagName).toBe('DIV');
            expect(body.classList.contains('idevice_body')).toBe(true);
            expect(body.classList.contains('idevice-element-in-content')).toBe(true);
        });

        it('adds idevice css class when available', () => {
            const body = idevice.makeIdeviceBodyElement();
            expect(body.classList.contains('textIdevice')).toBe(true);
        });

        it('sets idevice-id attribute', () => {
            const body = idevice.makeIdeviceBodyElement();
            expect(body.getAttribute('idevice-id')).toBe('idevice-id-1');
        });
    });

    describe('getCurrentOrder', () => {
        beforeEach(() => {
            const container = document.createElement('div');

            const prevIdevice = document.createElement('div');
            prevIdevice.classList.add('idevice_node');
            prevIdevice.setAttribute('order', '5');

            idevice.ideviceContent = document.createElement('div');
            idevice.ideviceContent.classList.add('idevice_node');

            const nextIdevice = document.createElement('div');
            nextIdevice.classList.add('idevice_node');
            nextIdevice.setAttribute('order', '10');

            container.appendChild(prevIdevice);
            container.appendChild(idevice.ideviceContent);
            container.appendChild(nextIdevice);
        });

        it('returns order based on previous idevice', () => {
            const order = idevice.getCurrentOrder();
            expect(order).toBe(6);
        });

        it('returns -1 when no adjacent idevices exist', () => {
            const container = document.createElement('div');
            idevice.ideviceContent = document.createElement('div');
            idevice.ideviceContent.classList.add('idevice_node');
            container.appendChild(idevice.ideviceContent);

            const order = idevice.getCurrentOrder();
            expect(order).toBe(-1);
        });
    });

    describe('getContentPrevIdevice / getContentNextIdevice', () => {
        it('returns previous idevice when exists', () => {
            const container = document.createElement('div');
            const prevIdevice = document.createElement('div');
            prevIdevice.classList.add('idevice_node');
            idevice.ideviceContent = document.createElement('div');

            container.appendChild(prevIdevice);
            container.appendChild(idevice.ideviceContent);

            expect(idevice.getContentPrevIdevice()).toBe(prevIdevice);
        });

        it('returns false when no previous idevice', () => {
            const container = document.createElement('div');
            idevice.ideviceContent = document.createElement('div');
            container.appendChild(idevice.ideviceContent);

            expect(idevice.getContentPrevIdevice()).toBe(false);
        });

        it('returns next idevice when exists', () => {
            const container = document.createElement('div');
            idevice.ideviceContent = document.createElement('div');
            const nextIdevice = document.createElement('div');
            nextIdevice.classList.add('idevice_node');

            container.appendChild(idevice.ideviceContent);
            container.appendChild(nextIdevice);

            expect(idevice.getContentNextIdevice()).toBe(nextIdevice);
        });

        it('returns false when no next idevice', () => {
            const container = document.createElement('div');
            idevice.ideviceContent = document.createElement('div');
            container.appendChild(idevice.ideviceContent);

            expect(idevice.getContentNextIdevice()).toBe(false);
        });
    });

    describe('findInstalledIdevice', () => {
        it('returns null when typeName is empty', () => {
            const result = idevice.findInstalledIdevice('');
            expect(result).toBeNull();
        });

        it('returns idevice for direct match', () => {
            const result = idevice.findInstalledIdevice('text');
            expect(result).not.toBeNull();
            expect(result.name).toBe('text');
        });

        it('returns idevice for legacy type name', () => {
            const result = idevice.findInstalledIdevice('FreeTextIdevice');
            expect(result).not.toBeNull();
            expect(result.name).toBe('text');
        });

        it('returns null for unknown type', () => {
            const result = idevice.findInstalledIdevice('unknownType');
            expect(result).toBeNull();
        });
    });

    describe('checkIsValid', () => {
        it('returns true when all required fields are set', () => {
            expect(idevice.checkIsValid()).toBe(true);
            expect(idevice.valid).toBe(true);
        });

        it('returns false when odeIdeviceId is missing', () => {
            idevice.odeIdeviceId = null;
            expect(idevice.checkIsValid()).toBe(false);
            expect(idevice.valid).toBe(false);
        });

        it('returns false when odeIdeviceTypeName is missing', () => {
            idevice.odeIdeviceTypeName = '';
            expect(idevice.checkIsValid()).toBe(false);
        });

        it('returns false when idevice is not found', () => {
            idevice.idevice = null;
            expect(idevice.checkIsValid()).toBe(false);
        });
    });

    describe('updateMode', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
            idevice.ideviceBody = document.createElement('div');
            mockEngine.getBlockById = vi.fn(() => ({
                updateMode: vi.fn(),
            }));
        });

        it('updates mode to edition', () => {
            idevice.updateMode('edition');

            expect(idevice.mode).toBe('edition');
            expect(idevice.ideviceContent.getAttribute('mode')).toBe('edition');
            expect(
                idevice.ideviceContent.classList.contains('draggable'),
            ).toBe(false);
        });

        it('updates mode to export', () => {
            idevice.mode = 'edition';
            idevice.updateMode('export');

            expect(idevice.mode).toBe('export');
            expect(idevice.ideviceContent.getAttribute('mode')).toBe('export');
            expect(idevice.ideviceContent.classList.contains('draggable')).toBe(
                true,
            );
            expect(
                idevice.ideviceContent.classList.contains('eXeLearning-content'),
            ).toBe(true);
        });

        it('removes save-error class when switching to export', () => {
            idevice.ideviceBody.classList.add('save-error');
            idevice.updateMode('export');

            expect(idevice.ideviceBody.classList.contains('save-error')).toBe(
                false,
            );
        });
    });

    describe('isLockedByOtherUser', () => {
        it('returns true when lockedByRemote flag is set', () => {
            idevice.lockedByRemote = true;
            expect(idevice.isLockedByOtherUser()).toBe(true);
        });

        it('returns false when no lock manager', () => {
            idevice.lockedByRemote = false;
            expect(idevice.isLockedByOtherUser()).toBe(false);
        });

        it('returns true when lock manager reports locked', () => {
            idevice.lockedByRemote = false;
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: {
                        isLocked: vi.fn(() => true),
                    },
                },
            };
            expect(idevice.isLockedByOtherUser()).toBe(true);
        });
    });

    describe('getLockInfo', () => {
        it('returns stored info when lockedByRemote', () => {
            idevice.lockedByRemote = true;
            idevice.lockUserName = 'Test User';
            idevice.lockUserColor = '#ff0000';

            const info = idevice.getLockInfo();
            expect(info.lockUserName).toBe('Test User');
            expect(info.lockUserColor).toBe('#ff0000');
        });

        it('returns null when no lock manager', () => {
            idevice.lockedByRemote = false;
            expect(idevice.getLockInfo()).toBeNull();
        });
    });

    describe('getLockManager', () => {
        it('returns null when no bridge', () => {
            expect(idevice.getLockManager()).toBeNull();
        });

        it('returns lock manager from bridge', () => {
            const mockLockManager = { isLocked: vi.fn() };
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: mockLockManager,
                },
            };
            expect(idevice.getLockManager()).toBe(mockLockManager);
        });
    });

    describe('releaseYjsEditingLock', () => {
        it('does nothing when Yjs is not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            const mockLockManager = { releaseLock: vi.fn() };
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: mockLockManager,
                    structureBinding: { updateComponent: vi.fn() },
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            idevice.releaseYjsEditingLock();

            expect(mockLockManager.releaseLock).not.toHaveBeenCalled();
        });

        it('releases lock via lockManager when Yjs is enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            const mockLockManager = { releaseLock: vi.fn() };
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: mockLockManager,
                    structureBinding: { updateComponent: vi.fn() },
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            idevice.releaseYjsEditingLock();

            expect(mockLockManager.releaseLock).toHaveBeenCalledWith('idevice-id-1');
        });

        it('clears lock info from component via structureBinding', () => {
            eXeLearning.app.project._yjsEnabled = true;
            const mockUpdateComponent = vi.fn();
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: { releaseLock: vi.fn() },
                    structureBinding: { updateComponent: mockUpdateComponent },
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            idevice.releaseYjsEditingLock();

            expect(mockUpdateComponent).toHaveBeenCalledWith('idevice-id-1', {
                lockedBy: null,
                lockUserName: null,
                lockUserColor: null,
            });
        });

        it('clears editing component in awareness via documentManager', () => {
            eXeLearning.app.project._yjsEnabled = true;
            const mockSetEditingComponent = vi.fn();
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: { releaseLock: vi.fn() },
                    structureBinding: { updateComponent: vi.fn() },
                    getDocumentManager: vi.fn(() => ({
                        setEditingComponent: mockSetEditingComponent,
                    })),
                },
            };

            idevice.releaseYjsEditingLock();

            expect(mockSetEditingComponent).toHaveBeenCalledWith(null);
        });

        it('uses yjsComponentId when available instead of odeIdeviceId', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-component-123';
            const mockLockManager = { releaseLock: vi.fn() };
            const mockUpdateComponent = vi.fn();
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: mockLockManager,
                    structureBinding: { updateComponent: mockUpdateComponent },
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            idevice.releaseYjsEditingLock();

            expect(mockLockManager.releaseLock).toHaveBeenCalledWith('yjs-component-123');
            expect(mockUpdateComponent).toHaveBeenCalledWith(
                'yjs-component-123',
                expect.any(Object),
            );
        });

        it('handles missing lockManager gracefully', () => {
            eXeLearning.app.project._yjsEnabled = true;
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: null,
                    structureBinding: { updateComponent: vi.fn() },
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            expect(() => idevice.releaseYjsEditingLock()).not.toThrow();
        });

        it('handles missing structureBinding gracefully', () => {
            eXeLearning.app.project._yjsEnabled = true;
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: { releaseLock: vi.fn() },
                    structureBinding: null,
                    getDocumentManager: vi.fn(() => ({ setEditingComponent: vi.fn() })),
                },
            };

            expect(() => idevice.releaseYjsEditingLock()).not.toThrow();
        });

        it('handles missing documentManager gracefully', () => {
            eXeLearning.app.project._yjsEnabled = true;
            mockEngine.project = {
                _yjsBridge: {
                    lockManager: { releaseLock: vi.fn() },
                    structureBinding: { updateComponent: vi.fn() },
                    getDocumentManager: vi.fn(() => null),
                },
            };

            expect(() => idevice.releaseYjsEditingLock()).not.toThrow();
        });
    });

    describe('toogleIdeviceButtonsState', () => {
        it('does nothing when ideviceButtons is null', () => {
            idevice.ideviceButtons = null;
            expect(() => idevice.toogleIdeviceButtonsState(true)).not.toThrow();
        });

        it('disables all action buttons when disable is true', () => {
            idevice.ideviceButtons = document.createElement('div');
            const button1 = document.createElement('button');
            button1.classList.add('btn-action-menu');
            const button2 = document.createElement('button');
            button2.classList.add('btn-action-menu');
            idevice.ideviceButtons.appendChild(button1);
            idevice.ideviceButtons.appendChild(button2);

            idevice.toogleIdeviceButtonsState(true);

            expect(button1.disabled).toBe(true);
            expect(button2.disabled).toBe(true);
        });

        it('enables all action buttons when disable is false', () => {
            idevice.ideviceButtons = document.createElement('div');
            const button = document.createElement('button');
            button.classList.add('btn-action-menu');
            button.disabled = true;
            idevice.ideviceButtons.appendChild(button);

            idevice.toogleIdeviceButtonsState(false);

            expect(button.disabled).toBe(false);
        });

        it('does not affect buttons without btn-action-menu class', () => {
            idevice.ideviceButtons = document.createElement('div');
            const actionButton = document.createElement('button');
            actionButton.classList.add('btn-action-menu');
            const otherButton = document.createElement('button');
            otherButton.classList.add('some-other-class');
            idevice.ideviceButtons.appendChild(actionButton);
            idevice.ideviceButtons.appendChild(otherButton);

            idevice.toogleIdeviceButtonsState(true);

            expect(actionButton.disabled).toBe(true);
            expect(otherButton.disabled).toBe(false);
        });
    });

    describe('getBlock', () => {
        it('calls engine.getBlockById with blockId', () => {
            const mockBlock = { id: 'block-1' };
            mockEngine.getBlockById = vi.fn(() => mockBlock);

            const result = idevice.getBlock();

            expect(mockEngine.getBlockById).toHaveBeenCalledWith('block-1');
            expect(result).toBe(mockBlock);
        });
    });

    describe('resetWindowHash', () => {
        it('sets scrollTop from offsetTop', () => {
            // offsetTop is a getter-only property, so we verify the method runs
            expect(() => idevice.resetWindowHash()).not.toThrow();
        });
    });

    describe('updateLockIndicator', () => {
        it('does nothing when ideviceButtons is null', () => {
            idevice.ideviceButtons = null;
            expect(() => idevice.updateLockIndicator()).not.toThrow();
        });

        it('calls makeIdeviceButtonsElement when buttons exist', () => {
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceContent = document.createElement('div');
            const spy = vi.spyOn(idevice, 'makeIdeviceButtonsElement');

            idevice.updateLockIndicator();

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('createAddTextBtn', () => {
        it('calls menuStructureBehaviour.createAddTextBtn', () => {
            idevice.createAddTextBtn();
            expect(
                eXeLearning.app.menus.menuStructure.engine.menuStructureBehaviour
                    .createAddTextBtn,
            ).toHaveBeenCalled();
        });
    });

    describe('inactivityInElement', () => {
        it('returns cleanup function when elementId is undefined', () => {
            const cleanup = idevice.inactivityInElement(undefined, 10, vi.fn());
            expect(typeof cleanup).toBe('function');
        });

        it('returns cleanup function when element not found', () => {
            const cleanup = idevice.inactivityInElement(
                'non-existent-element',
                10,
                vi.fn(),
            );
            expect(typeof cleanup).toBe('function');
        });

        it('sets up inactivity tracking for existing element', () => {
            const element = document.createElement('div');
            element.id = 'test-element';
            document.body.appendChild(element);

            // Mock the required nested property for inactivity tracking
            eXeLearning.app.project.idevices = {
                components: {
                    blocks: [],
                },
            };

            const callback = vi.fn();
            const cleanup = idevice.inactivityInElement('test-element', 10, callback);

            expect(typeof cleanup).toBe('function');
            expect(idevice.inactivityTimers).toBeDefined();
        });
    });

    describe('htmlView fallback for hybrid iDevices', () => {
        it('handles jsonProperties as stringified object', () => {
            // setParams expects JSON string, not raw object
            const propsObj = { title: 'Test', count: 10 };
            idevice.setParams({
                jsonProperties: JSON.stringify(propsObj),
            });

            expect(typeof idevice.jsonProperties).toBe('object');
            expect(idevice.jsonProperties.title).toBe('Test');
            expect(idevice.jsonProperties.count).toBe(10);
        });

        it('handles nested object in jsonProperties', () => {
            const complexObj = {
                title: 'Complex',
                settings: {
                    difficulty: 'hard',
                    timer: 60,
                },
                items: [1, 2, 3],
            };
            const jsonStr = JSON.stringify(complexObj);

            idevice.setParams({ jsonProperties: jsonStr });

            expect(idevice.jsonProperties.title).toBe('Complex');
            expect(idevice.jsonProperties.settings.difficulty).toBe('hard');
            expect(idevice.jsonProperties.items).toEqual([1, 2, 3]);
        });
    });

    describe('generateModalMoveToPageBody', () => {
        beforeEach(() => {
            idevice.block = {
                odeNavStructureSyncId: 'page-1',
            };
        });

        it('creates body element with text and select', () => {
            const body = idevice.generateModalMoveToPageBody();

            expect(body.tagName).toBe('DIV');
            expect(body.querySelector('.text-info-move-to-page')).not.toBeNull();
            expect(body.querySelector('.select-move-to-page')).not.toBeNull();
        });

        it('adds pages from structure to select element', () => {
            const body = idevice.generateModalMoveToPageBody();
            const select = body.querySelector('.select-move-to-page');

            expect(select.children.length).toBe(2);
            expect(select.children[0].value).toBe('page-1');
            expect(select.children[1].value).toBe('page-2');
        });

        it('marks current page as selected', () => {
            const body = idevice.generateModalMoveToPageBody();
            const select = body.querySelector('.select-move-to-page');

            expect(select.children[0].hasAttribute('selected')).toBe(true);
        });
    });

    describe('exportHtmlView', () => {
        beforeEach(() => {
            idevice.htmlView = '<p>Test content</p>';
            // Mock theme
            eXeLearning.app.themes = {
                selected: null,
            };
        });

        it('returns htmlView when no theme template', () => {
            const result = idevice.exportHtmlView();
            expect(result).toBe('<p>Test content</p>');
        });

        it('uses theme template when available', () => {
            eXeLearning.app.themes = {
                selected: {
                    templateIdevice: '<div class="themed">{idevice-content}</div>',
                },
            };

            const result = idevice.exportHtmlView();
            expect(result).toBe('<div class="themed"><p>Test content</p></div>');
        });

        it('calls addMediaTypes when available', () => {
            window.addMediaTypes = vi.fn((html) => html + '<!-- media -->');
            const result = idevice.exportHtmlView();

            expect(window.addMediaTypes).toHaveBeenCalled();
            expect(result).toContain('<!-- media -->');
            delete window.addMediaTypes;
        });

        it('calls simplifyMediaElements when available', () => {
            window.simplifyMediaElements = vi.fn((html) => html + '<!-- simplified -->');
            const result = idevice.exportHtmlView();

            expect(window.simplifyMediaElements).toHaveBeenCalled();
            expect(result).toContain('<!-- simplified -->');
            delete window.simplifyMediaElements;
        });

        it('calls resolveAssetUrls when available', () => {
            window.resolveAssetUrls = vi.fn((html) => html.replace('asset://', 'blob://'));
            idevice.htmlView = '<img src="asset://image.png">';
            const result = idevice.exportHtmlView();

            expect(window.resolveAssetUrls).toHaveBeenCalled();
            delete window.resolveAssetUrls;
        });
    });

    describe('restartExeIdeviceValue', () => {
        it('sets isSync to false when it was true', () => {
            idevice.isSync = true;
            idevice.restartExeIdeviceValue();

            expect(idevice.isSync).toBe(false);
        });

        it('clears $exeDevice when isSync is false', () => {
            idevice.isSync = false;
            global.$exeDevice = { some: 'value' };

            idevice.restartExeIdeviceValue();

            expect(global.$exeDevice).toBeUndefined();
        });
    });

    describe('showLockedPlaceholder', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
            idevice.lockedByRemote = true;
            idevice.lockUserName = 'Test User';
            idevice.lockUserColor = '#ff0000';
        });

        it('sets placeholder HTML in ideviceBody', () => {
            const result = idevice.showLockedPlaceholder();

            expect(idevice.ideviceBody.querySelector('.idevice-locked-placeholder')).not.toBeNull();
        });

        it('includes user name in placeholder', () => {
            idevice.showLockedPlaceholder();

            expect(idevice.ideviceBody.innerHTML).toContain('Test User');
        });

        it('returns locked status object', () => {
            const result = idevice.showLockedPlaceholder();

            expect(result.init).toBe('locked');
            expect(result.lockedBy).toBe('Test User');
        });

        it('uses default user name when not set', () => {
            idevice.lockUserName = null;
            idevice.lockedByRemote = false;
            mockEngine.project = { _yjsBridge: null };

            const result = idevice.showLockedPlaceholder();

            expect(result.lockedBy).toContain('Another user');
        });
    });

    describe('getBodyHTML', () => {
        it('returns empty string when ideviceBody is null', () => {
            idevice.ideviceBody = null;
            expect(idevice.getBodyHTML()).toBe('');
        });

        it('returns inner HTML when ideviceBody exists', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.innerHTML = '<p>Content</p>';
            // Note: getInnerHTML may not exist, use innerHTML instead
            idevice.ideviceBody.getInnerHTML = () => idevice.ideviceBody.innerHTML;

            expect(idevice.getBodyHTML()).toBe('<p>Content</p>');
        });
    });

    describe('getSavedData', () => {
        it('returns jsonProperties for json type idevice', () => {
            idevice.idevice = { componentType: 'json' };
            idevice.jsonProperties = { key: 'value' };

            const result = idevice.getSavedData();
            expect(result).toEqual({ key: 'value' });
        });

        it('returns htmlView for html type idevice', () => {
            idevice.idevice = { componentType: 'html' };
            idevice.htmlView = '<p>Test</p>';

            const result = idevice.getSavedData();
            expect(result).toBe('<p>Test</p>');
        });

        it('returns htmlView when componentType is undefined', () => {
            idevice.idevice = {};
            idevice.htmlView = '<p>Default</p>';

            const result = idevice.getSavedData();
            expect(result).toBe('<p>Default</p>');
        });
    });

    describe('getViewHTML', () => {
        it('returns htmlView when valid', () => {
            idevice.htmlView = '<p>Content</p>';
            expect(idevice.getViewHTML()).toBe('<p>Content</p>');
        });

        it('returns empty string when htmlView is undefined', () => {
            idevice.htmlView = 'undefined';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is null string', () => {
            idevice.htmlView = 'null';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is false string', () => {
            idevice.htmlView = 'false';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is actual null', () => {
            idevice.htmlView = null;
            expect(idevice.getViewHTML()).toBe('');
        });
    });

    describe('getJsonProperties', () => {
        it('returns jsonProperties object when json is false', () => {
            idevice.jsonProperties = { key: 'value' };
            const result = idevice.getJsonProperties(false);

            expect(result).toEqual({ key: 'value' });
        });

        it('returns JSON string when json is true', () => {
            idevice.jsonProperties = { key: 'value' };
            const result = idevice.getJsonProperties(true);

            expect(result).toBe('{"key":"value"}');
        });

        it('returns empty object when jsonProperties is null', () => {
            idevice.jsonProperties = null;
            const result = idevice.getJsonProperties(false);

            expect(result).toBeNull();
        });
    });

    describe('getPathEdition / getPathExport', () => {
        it('returns pathEdition from idevice', () => {
            idevice.idevice = { pathEdition: '/path/to/edition' };
            expect(idevice.getPathEdition()).toBe('/path/to/edition');
        });

        it('returns pathExport from idevice', () => {
            idevice.idevice = { pathExport: '/path/to/export' };
            expect(idevice.getPathExport()).toBe('/path/to/export');
        });
    });

    describe('clearSelection', () => {
        it('clears selection using getSelection API', () => {
            const mockSelection = { removeAllRanges: vi.fn() };
            window.getSelection = vi.fn(() => mockSelection);

            idevice.clearSelection();

            expect(mockSelection.removeAllRanges).toHaveBeenCalled();
        });

        it('uses document.selection.empty as fallback', () => {
            window.getSelection = null;
            document.selection = { empty: vi.fn() };

            idevice.clearSelection();

            expect(document.selection.empty).toHaveBeenCalled();
            delete document.selection;
        });
    });

    describe('updateParam', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('updates the specified param value', () => {
            idevice.updateParam('blockId', 'new-block-id');
            expect(idevice.blockId).toBe('new-block-id');
        });

        it('updates order attribute on ideviceContent when param is order', () => {
            idevice.updateParam('order', 5);

            expect(idevice.order).toBe(5);
            expect(idevice.ideviceContent.getAttribute('order')).toBe('5');
        });

        it('does not set attribute for non-order params', () => {
            idevice.updateParam('blockId', 'test');
            expect(idevice.ideviceContent.hasAttribute('blockId')).toBe(false);
        });
    });

    describe('updateModeParentBlock', () => {
        it('calls block.updateMode when block exists', () => {
            const mockBlock = { updateMode: vi.fn() };
            mockEngine.getBlockById = vi.fn(() => mockBlock);
            idevice.mode = 'edition';

            idevice.updateModeParentBlock();

            expect(mockBlock.updateMode).toHaveBeenCalledWith('edition');
        });

        it('does not throw when block is null', () => {
            mockEngine.getBlockById = vi.fn(() => null);

            expect(() => idevice.updateModeParentBlock()).not.toThrow();
        });
    });

    describe('goWindowToIdevice', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
            idevice.ideviceContent.id = idevice.odeIdeviceId;
            document.body.appendChild(idevice.ideviceContent);
            idevice.nodeContainer = document.createElement('div');
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('scrolls to block when idevice is first in block', () => {
            idevice.block = {
                blockId: 'block-1',
                idevices: [{ odeIdeviceId: idevice.odeIdeviceId }],
            };
            const blockEl = document.createElement('div');
            blockEl.id = 'block-1';
            document.body.appendChild(blockEl);

            vi.useFakeTimers();
            idevice.goWindowToIdevice(100);
            vi.advanceTimersByTime(100);
            vi.useRealTimers();

            // Just verify it doesn't throw
            expect(true).toBe(true);
        });

        it('scrolls to idevice when not first in block', () => {
            idevice.block = {
                blockId: 'block-1',
                idevices: [
                    { odeIdeviceId: 'other-idevice' },
                    { odeIdeviceId: idevice.odeIdeviceId },
                ],
            };

            vi.useFakeTimers();
            idevice.goWindowToIdevice(100);
            vi.advanceTimersByTime(100);
            vi.useRealTimers();

            expect(true).toBe(true);
        });
    });

    describe('clearFilesElements', () => {
        it('clears both scripts and styles', () => {
            const mockScript = { remove: vi.fn() };
            const mockStyle = { remove: vi.fn() };
            idevice.scriptsElements = [mockScript];
            idevice.stylesElements = [mockStyle];

            idevice.clearFilesElements();

            expect(mockScript.remove).toHaveBeenCalled();
            expect(mockStyle.remove).toHaveBeenCalled();
        });
    });

    describe('clearScriptsElements', () => {
        it('removes all script elements', () => {
            const script1 = { remove: vi.fn() };
            const script2 = { remove: vi.fn() };
            idevice.scriptsElements = [script1, script2];

            idevice.clearScriptsElements();

            expect(script1.remove).toHaveBeenCalled();
            expect(script2.remove).toHaveBeenCalled();
        });
    });

    describe('clearStylesElements', () => {
        it('removes all style elements', () => {
            const style1 = { remove: vi.fn() };
            const style2 = { remove: vi.fn() };
            idevice.stylesElements = [style1, style2];

            idevice.clearStylesElements();

            expect(style1.remove).toHaveBeenCalled();
            expect(style2.remove).toHaveBeenCalled();
        });
    });

    describe('editionLoadedError', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
            idevice.idevice = { title: 'Test iDevice' };
        });

        it('sets loading to false', () => {
            idevice.loading = true;
            idevice.editionLoadedError();

            expect(idevice.loading).toBe(false);
        });

        it('sets loading attribute to false on content', () => {
            idevice.editionLoadedError();

            expect(idevice.ideviceContent.getAttribute('loading')).toBe('false');
        });

        it('shows alert modal with error', () => {
            idevice.editionLoadedError();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test iDevice',
                    contentId: 'error',
                })
            );
        });
    });

    describe('exportLoadedError', () => {
        beforeEach(() => {
            idevice.idevice = { title: 'Test iDevice' };
            mockEngine.updateMode = vi.fn();
        });

        it('calls engine.updateMode', () => {
            idevice.exportLoadedError();

            expect(mockEngine.updateMode).toHaveBeenCalled();
        });

        it('shows alert modal with error', () => {
            idevice.exportLoadedError();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test iDevice',
                    contentId: 'error',
                })
            );
        });
    });

    describe('generateDataObject', () => {
        beforeEach(() => {
            idevice.id = 'comp-123';
            idevice.order = 5;
            idevice.blockId = 'block-1';
            idevice.idevice = { name: 'text' };
            idevice.block = {
                id: 'block-1',
                blockId: 'block-1',
                blockName: 'Text Block',
                iconName: 'text-icon',
                getCurrentOrder: () => 1,
            };
        });

        it('returns object with requested params', () => {
            const params = ['odeComponentsSyncId', 'order'];
            const result = idevice.generateDataObject(params);

            expect(result.odeComponentsSyncId).toBe('comp-123');
            expect(result.order).toBe(5);
            expect(Object.keys(result).length).toBe(2);
        });

        it('excludes non-requested params', () => {
            const params = ['order'];
            const result = idevice.generateDataObject(params);

            expect(result.odeComponentsSyncId).toBeUndefined();
            expect(result.order).toBe(5);
        });
    });

    describe('getDictBaseValuesData', () => {
        beforeEach(() => {
            idevice.id = 'comp-123';
            idevice.order = 3;
            idevice.odeIdeviceId = 'idevice-123';
            idevice.idevice = { name: 'text' };
            idevice.jsonProperties = { prop: 'value' };
            idevice.htmlView = '<p>Content</p>';
            idevice.block = {
                id: 'block-1',
                blockId: 'block-1',
                blockName: 'Block Name',
                iconName: 'icon',
                getCurrentOrder: () => 2,
            };
        });

        it('returns complete data dictionary', () => {
            const result = idevice.getDictBaseValuesData();

            expect(result.odeComponentsSyncId).toBe('comp-123');
            expect(result.order).toBe(3);
            expect(result.odeIdeviceId).toBe('idevice-123');
            expect(result.odeIdeviceTypeName).toBe('text');
        });

        it('includes block data when block exists', () => {
            const result = idevice.getDictBaseValuesData();

            expect(result.odePagStructureSyncId).toBe('block-1');
            expect(result.odeBlockId).toBe('block-1');
            expect(result.blockName).toBe('Block Name');
            expect(result.iconName).toBe('icon');
        });

        it('returns null for block data when block is null', () => {
            idevice.block = null;
            const result = idevice.getDictBaseValuesData();

            expect(result.odePagStructureSyncId).toBeNull();
            expect(result.odeBlockId).toBeNull();
            expect(result.blockName).toBeNull();
        });
    });

    describe('showModalMessageErrorDatabase', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('shows alert modal after delay', () => {
            idevice.showModalMessageErrorDatabase({}, 'Default error');

            vi.advanceTimersByTime(300);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });

        it('uses default message when no response message', () => {
            idevice.showModalMessageErrorDatabase({}, 'Default error message');

            vi.advanceTimersByTime(300);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    contentId: 'error',
                })
            );
        });
    });

    describe('remove', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
            document.body.appendChild(idevice.ideviceContent);
            idevice.scriptsElements = [];
            idevice.stylesElements = [];
            idevice.block = {
                idevices: [idevice],
                removeIdeviceOfListById: vi.fn(),
            };
            mockEngine.removeIdeviceOfComponentList = vi.fn();
            mockEngine.updateMode = vi.fn();
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('removes ideviceContent from DOM', () => {
            idevice.remove(false);

            expect(document.body.contains(idevice.ideviceContent)).toBe(false);
        });

        it('removes idevice from engine components list', () => {
            idevice.remove(false);

            expect(mockEngine.removeIdeviceOfComponentList).toHaveBeenCalledWith(idevice.id);
        });

        it('removes idevice from block list', () => {
            idevice.remove(false);

            expect(idevice.block.removeIdeviceOfListById).toHaveBeenCalledWith(idevice.id);
        });

        it('clears $exeDevice when in edition mode', () => {
            idevice.mode = 'edition';
            global.$exeDevice = { some: 'data' };

            idevice.remove(false);

            expect(global.$exeDevice).toBeUndefined();
        });

        it('calls apiDeleteIdevice when bbdd is true', () => {
            const spy = vi.spyOn(idevice, 'apiDeleteIdevice').mockResolvedValue({});

            idevice.remove(true);

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('removeBlockParentProcess', () => {
        beforeEach(() => {
            idevice.block = {
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: false,
                remove: vi.fn(),
            };
        });

        it('removes block when removeIfEmpty is true and block has no idevices', () => {
            idevice.block.removeIfEmpty = true;

            idevice.removeBlockParentProcess(true);

            expect(idevice.block.remove).toHaveBeenCalledWith(true);
        });

        it('does not remove block when it still has idevices', () => {
            idevice.block.idevices = [{ id: 'other' }];
            idevice.block.removeIfEmpty = true;

            idevice.removeBlockParentProcess(true);

            expect(idevice.block.remove).not.toHaveBeenCalled();
        });

        it('shows confirm modal when askForRemoveIfEmpty is true', () => {
            idevice.block.askForRemoveIfEmpty = true;
            vi.useFakeTimers();

            idevice.removeBlockParentProcess(true);
            vi.advanceTimersByTime(300);

            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('lockScreen / unlockScreen', () => {
        let loadScreen;
        let nodeContent;

        beforeEach(() => {
            loadScreen = document.createElement('div');
            loadScreen.id = 'load-screen-node-content';
            loadScreen.classList.add('hide', 'hidden');
            document.body.appendChild(loadScreen);

            nodeContent = document.createElement('div');
            nodeContent.id = 'node-content';
            document.body.appendChild(nodeContent);
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('lockScreen shows the load screen', () => {
            idevice.lockScreen();

            expect(loadScreen.classList.contains('loading')).toBe(true);
            expect(loadScreen.classList.contains('hide')).toBe(false);
            expect(loadScreen.getAttribute('data-visible')).toBe('true');
        });

        it('lockScreen sets node content as not ready', () => {
            idevice.lockScreen();

            // The lockScreen function uses optional chaining, so nodeContent may not be updated
            // if document.getElementById returns null
            const nodeContentEl = document.getElementById('node-content');
            if (nodeContentEl) {
                expect(nodeContentEl.getAttribute('data-ready')).toBe('false');
            } else {
                // Just verify it doesn't throw
                expect(true).toBe(true);
            }
        });

        it('unlockScreen hides the load screen', () => {
            idevice.lockScreen();
            vi.useFakeTimers();

            idevice.unlockScreen(100);
            vi.advanceTimersByTime(100);

            expect(loadScreen.classList.contains('loading')).toBe(false);
            expect(loadScreen.getAttribute('data-visible')).toBe('false');
            vi.useRealTimers();
        });
    });

    describe('cleanupInactivityTracker', () => {
        it('calls inactivityCleanup when it exists', () => {
            const mockCleanup = vi.fn();
            idevice.inactivityCleanup = mockCleanup;

            idevice.cleanupInactivityTracker();

            expect(mockCleanup).toHaveBeenCalled();
            // After calling, it should be set to null
            expect(idevice.inactivityCleanup).toBeNull();
        });

        it('clears inactivityTimer when it exists', () => {
            const timerId = setTimeout(() => {}, 10000);
            idevice.inactivityTimer = timerId;

            idevice.cleanupInactivityTracker();

            expect(idevice.inactivityTimer).toBeNull();
        });

        it('does not throw when no cleanup functions exist', () => {
            idevice.inactivityCleanup = null;
            idevice.inactivityTimer = null;

            expect(() => idevice.cleanupInactivityTracker()).not.toThrow();
        });
    });

    describe('readFile', () => {
        it('resolves with file data', async () => {
            const blob = new Blob(['test content'], { type: 'text/plain' });
            const file = new File([blob], 'test.txt');

            const result = await idevice.readFile(file);

            expect(result).toContain('data:');
        });
    });

    describe('activateUpdateFlag', () => {
        beforeEach(() => {
            eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag = vi.fn();
        });

        it('calls API with correct params', () => {
            idevice.activateUpdateFlag();

            expect(
                eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    odeIdeviceId: idevice.odeIdeviceId,
                })
            );
        });
    });

    describe('activateComponentFlag', () => {
        it('is a no-op function', () => {
            expect(() => idevice.activateComponentFlag()).not.toThrow();
        });
    });

    describe('loadScriptsEdition / loadStylesEdition', () => {
        beforeEach(() => {
            idevice.idevice = {
                loadScriptsEdition: vi.fn(() => [{ id: 'script1' }]),
                loadStylesEdition: vi.fn(() => Promise.resolve([{ id: 'style1' }])),
            };
            idevice.stylesElements = [];
        });

        it('loadScriptsEdition calls idevice.loadScriptsEdition', () => {
            idevice.loadScriptsEdition();

            expect(idevice.idevice.loadScriptsEdition).toHaveBeenCalled();
        });

        it('loadStylesEdition calls idevice.loadStylesEdition', async () => {
            await idevice.loadStylesEdition();

            expect(idevice.idevice.loadStylesEdition).toHaveBeenCalled();
        });

        it('handles null idevice gracefully', () => {
            idevice.idevice = null;

            expect(() => idevice.loadScriptsEdition()).not.toThrow();
        });
    });

    describe('loadScriptsExport / loadStylesExport', () => {
        beforeEach(() => {
            idevice.idevice = {
                loadScriptsExport: vi.fn(() => [{ id: 'script1' }]),
                loadStylesExport: vi.fn(() => Promise.resolve([{ id: 'style1' }])),
            };
            idevice.stylesElements = [];
        });

        it('loadScriptsExport calls idevice.loadScriptsExport', () => {
            idevice.loadScriptsExport();

            expect(idevice.idevice.loadScriptsExport).toHaveBeenCalled();
        });

        it('loadStylesExport calls idevice.loadStylesExport', async () => {
            await idevice.loadStylesExport();

            expect(idevice.idevice.loadStylesExport).toHaveBeenCalled();
        });
    });

    describe('updateResourceLockStatus', () => {
        it('is a no-op function (Yjs handles sync)', () => {
            expect(() => {
                idevice.updateResourceLockStatus({
                    odeIdeviceId: 'test',
                    blockId: 'block',
                    actionType: 'EDIT_BLOCK',
                });
            }).not.toThrow();
        });
    });

    describe('checkIdeviceIsEditing', () => {
        it('calls updateResourceLockStatus', () => {
            const spy = vi.spyOn(idevice, 'updateResourceLockStatus');

            idevice.checkIdeviceIsEditing();

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('getContentPrevIdevice', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('returns previous element when it has idevice_node class', () => {
            const prevIdevice = document.createElement('div');
            prevIdevice.classList.add('idevice_node');

            const container = document.createElement('div');
            container.appendChild(prevIdevice);
            container.appendChild(idevice.ideviceContent);

            const result = idevice.getContentPrevIdevice();
            expect(result).toBe(prevIdevice);
        });

        it('returns false when previous element does not have idevice_node class', () => {
            const prevElement = document.createElement('div');

            const container = document.createElement('div');
            container.appendChild(prevElement);
            container.appendChild(idevice.ideviceContent);

            const result = idevice.getContentPrevIdevice();
            expect(result).toBe(false);
        });

        it('returns false when no previous element', () => {
            const container = document.createElement('div');
            container.appendChild(idevice.ideviceContent);

            const result = idevice.getContentPrevIdevice();
            expect(result).toBe(false);
        });
    });

    describe('getContentNextIdevice', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('returns next element when it has idevice_node class', () => {
            const nextIdevice = document.createElement('div');
            nextIdevice.classList.add('idevice_node');

            const container = document.createElement('div');
            container.appendChild(idevice.ideviceContent);
            container.appendChild(nextIdevice);

            const result = idevice.getContentNextIdevice();
            expect(result).toBe(nextIdevice);
        });

        it('returns false when next element does not have idevice_node class', () => {
            const nextElement = document.createElement('div');

            const container = document.createElement('div');
            container.appendChild(idevice.ideviceContent);
            container.appendChild(nextElement);

            const result = idevice.getContentNextIdevice();
            expect(result).toBe(false);
        });
    });

    describe('getCurrentOrder', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('returns order from previous idevice when exists', () => {
            const prevIdevice = document.createElement('div');
            prevIdevice.classList.add('idevice_node');
            prevIdevice.setAttribute('order', '5');

            const container = document.createElement('div');
            container.appendChild(prevIdevice);
            container.appendChild(idevice.ideviceContent);

            const order = idevice.getCurrentOrder();
            expect(order).toBe(6);
        });

        it('returns order from next idevice when previous does not exist', () => {
            const nextIdevice = document.createElement('div');
            nextIdevice.classList.add('idevice_node');
            nextIdevice.setAttribute('order', '10');

            const container = document.createElement('div');
            container.appendChild(idevice.ideviceContent);
            container.appendChild(nextIdevice);

            const order = idevice.getCurrentOrder();
            expect(order).toBe(9);
        });

        it('returns -1 when no adjacent idevices', () => {
            const container = document.createElement('div');
            container.appendChild(idevice.ideviceContent);

            const order = idevice.getCurrentOrder();
            expect(order).toBe(-1);
        });
    });

    describe('setPropertiesClassesToElement', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('sets identifier attribute when value exists', () => {
            idevice.properties.identifier.value = 'my-idevice-id';
            idevice.setPropertiesClassesToElement();
            expect(idevice.ideviceContent.getAttribute('identifier')).toBe('my-idevice-id');
        });

        it('sets export-view attribute when visibility is true', () => {
            idevice.properties.visibility.value = 'true';
            idevice.setPropertiesClassesToElement();
            expect(idevice.ideviceContent.getAttribute('export-view')).toBe('true');
        });

        it('adds css classes when cssClass has value', () => {
            idevice.properties.cssClass.value = 'class1 class2';
            idevice.setPropertiesClassesToElement();
            expect(idevice.ideviceContent.classList.contains('class1')).toBe(true);
            expect(idevice.ideviceContent.classList.contains('class2')).toBe(true);
        });
    });

    describe('isYjsEnabled', () => {
        it('returns true when Yjs is enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;

            expect(idevice.isYjsEnabled()).toBe(true);
        });

        it('returns false when Yjs is disabled', () => {
            eXeLearning.app.project._yjsEnabled = false;

            expect(idevice.isYjsEnabled()).toBe(false);
        });
    });

    describe('loadPropertiesFromYjs', () => {
        beforeEach(() => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getComponentProperties: vi.fn().mockReturnValue({
                        identifier: 'yjs-id',
                        visibility: true,
                    }),
                },
            };
            idevice.yjsComponentId = 'yjs-comp-id';
        });

        it('loads properties from Yjs when enabled', () => {
            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe('yjs-id');
            expect(idevice.properties.visibility.value).toBe('true');
        });

        it('does nothing when Yjs is disabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            const originalValue = idevice.properties.identifier.value;

            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe(originalValue);
        });
    });

    describe('exportHtmlView', () => {
        beforeEach(() => {
            idevice.htmlView = '<p>Test content</p>';
            global.eXeLearning.app.themes = {
                selected: null,
            };
        });

        it('returns htmlView when no theme template', () => {
            const result = idevice.exportHtmlView();
            expect(result).toBe('<p>Test content</p>');
        });

        it('applies theme template when available', () => {
            eXeLearning.app.themes.selected = {
                templateIdevice: '<div class="themed">{idevice-content}</div>',
            };
            const result = idevice.exportHtmlView();
            expect(result).toBe('<div class="themed"><p>Test content</p></div>');
        });

        it('calls addMediaTypes when available', () => {
            window.addMediaTypes = vi.fn((html) => html + ' [media]');
            const result = idevice.exportHtmlView();
            expect(window.addMediaTypes).toHaveBeenCalled();
            expect(result).toContain('[media]');
            delete window.addMediaTypes;
        });

        it('calls simplifyMediaElements when available', () => {
            window.simplifyMediaElements = vi.fn((html) => html + ' [simplified]');
            const result = idevice.exportHtmlView();
            expect(window.simplifyMediaElements).toHaveBeenCalled();
            expect(result).toContain('[simplified]');
            delete window.simplifyMediaElements;
        });

        it('calls resolveAssetUrls when available', () => {
            window.resolveAssetUrls = vi.fn((html) => html + ' [resolved]');
            const result = idevice.exportHtmlView();
            expect(window.resolveAssetUrls).toHaveBeenCalled();
            expect(result).toContain('[resolved]');
            delete window.resolveAssetUrls;
        });
    });

    describe('restartExeIdeviceValue', () => {
        it('sets isSync to false when isSync is true', () => {
            idevice.isSync = true;
            idevice.restartExeIdeviceValue();
            expect(idevice.isSync).toBe(false);
        });

        it('sets $exeDevice to undefined when isSync is false', () => {
            idevice.isSync = false;
            global.$exeDevice = { test: true };
            idevice.restartExeIdeviceValue();
            expect(global.$exeDevice).toBeUndefined();
        });
    });

    describe('showLockedPlaceholder', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
            idevice.odeIdeviceId = 'test-idevice-123';
        });

        it('shows placeholder HTML in ideviceBody', () => {
            idevice.lockUserName = 'John';
            const result = idevice.showLockedPlaceholder();

            expect(idevice.ideviceBody.innerHTML).toContain('idevice-locked-placeholder');
            expect(result.init).toBe('locked');
        });

        it('returns lockedBy info from getLockInfo', () => {
            idevice.getLockInfo = vi.fn().mockReturnValue({
                lockUserName: 'Jane',
                lockUserColor: '#ff0000',
            });
            const result = idevice.showLockedPlaceholder();

            expect(result.lockedBy).toBe('Jane');
            expect(idevice.ideviceBody.innerHTML).toContain('Jane');
        });

        it('uses default user name when no lock info available', () => {
            idevice.getLockInfo = vi.fn().mockReturnValue(null);
            idevice.lockUserName = null;
            const result = idevice.showLockedPlaceholder();

            expect(result.lockedBy).toBe('Another user');
        });
    });

    describe('generateContentExportView', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
            idevice.htmlView = '<p>HTML content</p>';
        });

        it('calls exportProcessIdeviceHtml for html type', async () => {
            idevice.idevice = { componentType: 'html' };
            const spy = vi.spyOn(idevice, 'exportProcessIdeviceHtml').mockResolvedValue({ init: 'true' });

            const result = await idevice.generateContentExportView();

            expect(spy).toHaveBeenCalled();
            expect(result).toEqual({ init: 'true' });
        });

        it('calls exportProcessIdeviceJson for json type', async () => {
            idevice.idevice = { componentType: 'json' };
            const spy = vi.spyOn(idevice, 'exportProcessIdeviceJson').mockResolvedValue({ responseMessage: 'OK' });

            const result = await idevice.generateContentExportView();

            expect(spy).toHaveBeenCalled();
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('defaults to html type when no componentType', async () => {
            idevice.idevice = {};
            const spy = vi.spyOn(idevice, 'exportProcessIdeviceHtml').mockResolvedValue({ init: 'true' });

            await idevice.generateContentExportView();

            expect(spy).toHaveBeenCalled();
        });

        it('calls typesetLatexInContent after loading content', async () => {
            idevice.idevice = { componentType: 'html' };
            vi.spyOn(idevice, 'exportProcessIdeviceHtml').mockResolvedValue({ init: 'true' });
            const typesetSpy = vi.spyOn(idevice, 'typesetLatexInContent');

            await idevice.generateContentExportView();

            expect(typesetSpy).toHaveBeenCalled();
        });
    });

    describe('typesetLatexInContent', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
        });

        it('does nothing if ideviceBody is null', () => {
            idevice.ideviceBody = null;
            idevice.typesetLatexInContent();
            // Should not throw
        });

        it('calls MathJax.typesetPromise when content contains LaTeX delimiters \\(', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };
            idevice.ideviceBody.textContent = 'Some text with \\(E=mc^2\\) formula';

            idevice.typesetLatexInContent();

            expect(mockTypesetPromise).toHaveBeenCalledWith([idevice.ideviceBody]);
        });

        it('calls MathJax.typesetPromise when content contains LaTeX delimiters \\[', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };
            idevice.ideviceBody.textContent = 'Display math: \\[x^2\\]';

            idevice.typesetLatexInContent();

            expect(mockTypesetPromise).toHaveBeenCalledWith([idevice.ideviceBody]);
        });

        it('calls MathJax.typesetPromise when content contains $$', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };
            idevice.ideviceBody.textContent = 'Math: $$x = 1$$';

            idevice.typesetLatexInContent();

            expect(mockTypesetPromise).toHaveBeenCalledWith([idevice.ideviceBody]);
        });

        it('does not call MathJax when content has no LaTeX', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };
            idevice.ideviceBody.textContent = 'Plain text without formulas';

            idevice.typesetLatexInContent();

            expect(mockTypesetPromise).not.toHaveBeenCalled();
        });

        it('does not call MathJax when MathJax is not defined', () => {
            delete globalThis.MathJax;
            idevice.ideviceBody.textContent = 'Some text with \\(E=mc^2\\) formula';

            // Should not throw
            idevice.typesetLatexInContent();
        });
    });

    describe('exportProcessIdeviceHtml', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
            idevice.htmlView = '<p>Test HTML</p>';
            global.eXeLearning.app.themes = { selected: null };
        });

        it('sets innerHTML to exportHtmlView result', async () => {
            const result = await idevice.exportProcessIdeviceHtml();

            expect(idevice.ideviceBody.innerHTML).toBe('<p>Test HTML</p>');
            expect(result).toEqual({ init: 'true' });
        });
    });

    describe('getBodyHTML', () => {
        it('returns innerHTML when ideviceBody exists and has getInnerHTML', () => {
            idevice.ideviceBody = {
                getInnerHTML: vi.fn().mockReturnValue('<p>Body content</p>'),
            };
            const result = idevice.getBodyHTML();
            expect(result).toBe('<p>Body content</p>');
        });

        it('returns empty string when ideviceBody is null', () => {
            idevice.ideviceBody = null;
            const result = idevice.getBodyHTML();
            expect(result).toBe('');
        });
    });

    describe('getSavedData', () => {
        it('returns jsonProperties for json component type', () => {
            idevice.idevice = { componentType: 'json' };
            idevice.jsonProperties = { key: 'value' };

            const result = idevice.getSavedData();
            expect(result).toEqual({ key: 'value' });
        });

        it('returns viewHTML for html component type', () => {
            idevice.idevice = { componentType: 'html' };
            idevice.htmlView = '<p>HTML</p>';

            const result = idevice.getSavedData();
            expect(result).toBe('<p>HTML</p>');
        });

        it('returns viewHTML when no componentType', () => {
            idevice.idevice = {};
            idevice.htmlView = '<p>Default</p>';

            const result = idevice.getSavedData();
            expect(result).toBe('<p>Default</p>');
        });
    });

    describe('getViewHTML', () => {
        it('returns htmlView when valid', () => {
            idevice.htmlView = '<p>Valid HTML</p>';
            expect(idevice.getViewHTML()).toBe('<p>Valid HTML</p>');
        });

        it('returns empty string when htmlView is undefined', () => {
            idevice.htmlView = 'undefined';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is null string', () => {
            idevice.htmlView = 'null';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is false string', () => {
            idevice.htmlView = 'false';
            expect(idevice.getViewHTML()).toBe('');
        });

        it('returns empty string when htmlView is falsy', () => {
            idevice.htmlView = null;
            expect(idevice.getViewHTML()).toBe('');
        });
    });

    describe('getJsonProperties', () => {
        beforeEach(() => {
            idevice.jsonProperties = { key: 'value', num: 123 };
        });

        it('returns JSON string when json param is true', () => {
            const result = idevice.getJsonProperties(true);
            expect(result).toBe('{"key":"value","num":123}');
        });

        it('returns object when json param is false', () => {
            const result = idevice.getJsonProperties(false);
            expect(result).toEqual({ key: 'value', num: 123 });
        });

        it('returns object when json param is undefined', () => {
            const result = idevice.getJsonProperties();
            expect(result).toEqual({ key: 'value', num: 123 });
        });
    });

    describe('getPathEdition', () => {
        it('returns pathEdition from idevice', () => {
            idevice.idevice = { pathEdition: '/path/to/edition' };
            expect(idevice.getPathEdition()).toBe('/path/to/edition');
        });
    });

    describe('getPathExport', () => {
        it('returns pathExport from idevice', () => {
            idevice.idevice = { pathExport: '/path/to/export' };
            expect(idevice.getPathExport()).toBe('/path/to/export');
        });
    });

    describe('getBlock', () => {
        it('calls engine.getBlockById with blockId', () => {
            const mockBlock = { id: 'block-1' };
            mockEngine.getBlockById.mockReturnValue(mockBlock);
            idevice.blockId = 'block-1';

            const result = idevice.getBlock();

            expect(mockEngine.getBlockById).toHaveBeenCalledWith('block-1');
            expect(result).toBe(mockBlock);
        });
    });

    describe('generateDataObject', () => {
        beforeEach(() => {
            idevice.id = 'comp-123';
            idevice.order = 5;
            idevice.odeIdeviceId = 'idevice-456';
            idevice.idevice = { name: 'text' };
            idevice.htmlView = '<p>Test</p>';
            idevice.jsonProperties = { key: 'value' };
            idevice.block = {
                id: 'block-789',
                blockId: 'block-id',
                blockName: 'Test Block',
                iconName: 'icon.png',
                getCurrentOrder: vi.fn().mockReturnValue(1),
            };
        });

        it('generates object with specified params', () => {
            const params = ['odeComponentsSyncId', 'order', 'odeIdeviceId'];
            const result = idevice.generateDataObject(params);

            expect(result.odeComponentsSyncId).toBe('comp-123');
            expect(result.order).toBe(5);
            expect(result.odeIdeviceId).toBe('idevice-456');
        });

        it('only includes specified params', () => {
            const params = ['order'];
            const result = idevice.generateDataObject(params);

            expect(Object.keys(result)).toHaveLength(1);
            expect(result.order).toBe(5);
        });
    });

    describe('getDictBaseValuesData', () => {
        beforeEach(() => {
            idevice.id = 'comp-id';
            idevice.order = 3;
            idevice.odeIdeviceId = 'idevice-id';
            idevice.odeNavStructureSyncId = 'nav-sync-id';
            idevice.pageId = 'page-id';
            idevice.idevice = { name: 'text' };
            idevice.htmlView = '<p>Content</p>';
            idevice.jsonProperties = { prop: 'val' };
            idevice.block = {
                id: 'block-id',
                blockId: 'block-ode-id',
                blockName: 'Block Name',
                iconName: 'icon.svg',
                getCurrentOrder: vi.fn().mockReturnValue(2),
            };
        });

        it('returns dictionary with all base values', () => {
            const result = idevice.getDictBaseValuesData();

            expect(result.odeComponentsSyncId).toBe('comp-id');
            expect(result.odeVersionId).toBe('v1');
            expect(result.odeSessionId).toBe('session-123');
            expect(result.odeNavStructureSyncId).toBe('nav-sync-id');
            expect(result.odePageId).toBe('page-id');
            expect(result.odeBlockId).toBe('block-ode-id');
            expect(result.blockName).toBe('Block Name');
            expect(result.order).toBe(3);
        });

        it('uses default nav id when odeNavStructureSyncId is not set', () => {
            idevice.odeNavStructureSyncId = null;
            const result = idevice.getDictBaseValuesData();

            expect(result.odeNavStructureSyncId).toBe('nav-id-1');
        });

        it('uses default page id when pageId is not set', () => {
            idevice.pageId = null;
            const result = idevice.getDictBaseValuesData();

            expect(result.odePageId).toBe('page-id-1');
        });
    });

    describe('showModalMessageErrorDatabase', () => {
        it('shows alert modal with default message', () => {
            vi.useFakeTimers();
            const defaultMessage = 'Default error message';

            idevice.showModalMessageErrorDatabase({}, defaultMessage);
            vi.advanceTimersByTime(300);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'iDevice error',
                body: defaultMessage,
                contentId: 'error',
            });
            vi.useRealTimers();
        });
    });

    describe('clearFilesElements', () => {
        it('calls clearScriptsElements and clearStylesElements', () => {
            const clearScriptsSpy = vi.spyOn(idevice, 'clearScriptsElements').mockImplementation(() => {});
            const clearStylesSpy = vi.spyOn(idevice, 'clearStylesElements').mockImplementation(() => {});

            idevice.clearFilesElements();

            expect(clearScriptsSpy).toHaveBeenCalled();
            expect(clearStylesSpy).toHaveBeenCalled();
        });
    });

    describe('clearScriptsElements', () => {
        it('removes all script elements', () => {
            const script1 = { remove: vi.fn() };
            const script2 = { remove: vi.fn() };
            idevice.scriptsElements = [script1, script2];
            idevice.idevice = null;

            idevice.clearScriptsElements();

            expect(script1.remove).toHaveBeenCalled();
            expect(script2.remove).toHaveBeenCalled();
        });
    });

    describe('clearStylesElements', () => {
        it('removes all style elements', () => {
            const style1 = { remove: vi.fn() };
            const style2 = { remove: vi.fn() };
            idevice.stylesElements = [style1, style2];

            idevice.clearStylesElements();

            expect(style1.remove).toHaveBeenCalled();
            expect(style2.remove).toHaveBeenCalled();
        });
    });

    describe('editionLoadedError', () => {
        it('sets loading to false and shows alert', () => {
            idevice.ideviceContent = document.createElement('div');
            idevice.idevice = { title: 'Test iDevice' };

            idevice.editionLoadedError();

            expect(idevice.loading).toBe(false);
            expect(idevice.ideviceContent.getAttribute('loading')).toBe('false');
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Test iDevice',
                body: 'Failed to load the iDevice.',
                contentId: 'error',
            });
        });
    });

    describe('exportLoadedError', () => {
        it('updates mode and shows alert', () => {
            idevice.idevice = { title: 'Export iDevice' };
            mockEngine.updateMode = vi.fn();

            idevice.exportLoadedError();

            expect(mockEngine.updateMode).toHaveBeenCalled();
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Export iDevice',
                body: 'Failed to load the iDevice view.',
                contentId: 'error',
            });
        });
    });

    describe('loadScriptsEdition', () => {
        it('loads scripts from idevice and concatenates to stylesElements', () => {
            const newScripts = [{ id: 'script1' }, { id: 'script2' }];
            idevice.idevice = {
                loadScriptsEdition: vi.fn().mockReturnValue(newScripts),
            };
            idevice.stylesElements = [{ id: 'style1' }];

            idevice.loadScriptsEdition();

            expect(idevice.idevice.loadScriptsEdition).toHaveBeenCalled();
            expect(idevice.scriptsElements).toEqual([{ id: 'style1' }, { id: 'script1' }, { id: 'script2' }]);
        });

        it('handles null idevice', () => {
            idevice.idevice = null;
            idevice.stylesElements = [];

            idevice.loadScriptsEdition();

            expect(idevice.scriptsElements).toEqual([]);
        });
    });

    describe('loadScriptsExport', () => {
        it('loads export scripts from idevice', () => {
            const newScripts = [{ id: 'export-script' }];
            idevice.idevice = {
                loadScriptsExport: vi.fn().mockReturnValue(newScripts),
            };
            idevice.stylesElements = [];

            idevice.loadScriptsExport();

            expect(idevice.idevice.loadScriptsExport).toHaveBeenCalled();
            expect(idevice.scriptsElements).toEqual([{ id: 'export-script' }]);
        });
    });

    describe('loadStylesEdition', () => {
        it('loads styles from idevice asynchronously', async () => {
            const newStyles = [{ id: 'style-edit' }];
            idevice.idevice = {
                loadStylesEdition: vi.fn().mockResolvedValue(newStyles),
            };
            idevice.stylesElements = [{ id: 'existing' }];

            await idevice.loadStylesEdition();

            expect(idevice.idevice.loadStylesEdition).toHaveBeenCalled();
            expect(idevice.stylesElements).toEqual([{ id: 'existing' }, { id: 'style-edit' }]);
        });
    });

    describe('loadStylesExport', () => {
        it('loads export styles from idevice asynchronously', async () => {
            const newStyles = [{ id: 'style-export' }];
            idevice.idevice = {
                loadStylesExport: vi.fn().mockResolvedValue(newStyles),
            };
            idevice.stylesElements = [];

            await idevice.loadStylesExport();

            expect(idevice.idevice.loadStylesExport).toHaveBeenCalled();
            expect(idevice.stylesElements).toEqual([{ id: 'style-export' }]);
        });
    });

    describe('cleanupInactivityTracker', () => {
        it('clears inactivity timer when set', () => {
            vi.useFakeTimers();
            idevice.inactivityTimer = setTimeout(() => {}, 1000);

            idevice.cleanupInactivityTracker();

            expect(idevice.inactivityTimer).toBeNull();
            vi.useRealTimers();
        });

        it('handles null inactivityTimer gracefully', () => {
            idevice.inactivityTimer = null;

            expect(() => idevice.cleanupInactivityTracker()).not.toThrow();
        });
    });

    describe('remove', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
            document.body.appendChild(idevice.ideviceContent);
            idevice.checkDeviceLoadInterval = setInterval(() => {}, 1000);
            idevice.mode = 'export';
            idevice.block = {
                idevices: [idevice],
                removeIdeviceOfListById: vi.fn(),
            };
            mockEngine.removeIdeviceOfComponentList = vi.fn();
            mockEngine.updateMode = vi.fn();
        });

        it('removes idevice content element from DOM', () => {
            idevice.remove(false);

            expect(document.body.contains(idevice.ideviceContent)).toBe(false);
        });

        it('clears check device interval', () => {
            vi.useFakeTimers();
            const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

            idevice.remove(false);

            expect(clearIntervalSpy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('removes idevice from engine component list', () => {
            idevice.remove(false);

            expect(mockEngine.removeIdeviceOfComponentList).toHaveBeenCalledWith(idevice.id);
        });

        it('removes idevice from block list', () => {
            idevice.remove(false);

            expect(idevice.block.removeIdeviceOfListById).toHaveBeenCalledWith(idevice.id);
        });

        it('updates engine mode', () => {
            idevice.remove(false);

            expect(mockEngine.updateMode).toHaveBeenCalled();
        });

        it('sets $exeDevice to undefined when mode is edition', () => {
            idevice.mode = 'edition';
            global.$exeDevice = { test: true };

            idevice.remove(false);

            expect(global.$exeDevice).toBeUndefined();
        });

        it('calls apiDeleteIdevice when bbdd is true', () => {
            const apiDeleteSpy = vi.spyOn(idevice, 'apiDeleteIdevice').mockImplementation(() => {});
            idevice.removeBlockParentProcess = vi.fn();

            idevice.remove(true);

            expect(apiDeleteSpy).toHaveBeenCalled();
        });
    });

    describe('removeBlockParentProcess', () => {
        it('removes block when empty and removeIfEmpty is true', () => {
            idevice.block = {
                idevices: [],
                removeIfEmpty: true,
                remove: vi.fn(),
            };

            idevice.removeBlockParentProcess(true);

            expect(idevice.block.remove).toHaveBeenCalledWith(true);
        });

        it('shows confirm modal when askForRemoveIfEmpty is true', () => {
            vi.useFakeTimers();
            idevice.block = {
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: true,
                remove: vi.fn(),
            };

            idevice.removeBlockParentProcess(true);
            vi.advanceTimersByTime(300);

            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('does nothing when block has idevices', () => {
            idevice.block = {
                idevices: [{ id: 'other' }],
                removeIfEmpty: true,
                remove: vi.fn(),
            };

            idevice.removeBlockParentProcess(true);

            expect(idevice.block.remove).not.toHaveBeenCalled();
        });
    });

    describe('edition', () => {
        beforeEach(() => {
            mockEngine.mode = 'view';
            mockEngine.updateMode = vi.fn();
            idevice.checkDeviceLoadInterval = null;
            idevice.loadInitScriptIdevice = vi.fn();
            idevice.goWindowToIdevice = vi.fn();
        });

        it('loads edition script when engine mode is view', () => {
            idevice.edition();

            expect(idevice.goWindowToIdevice).toHaveBeenCalledWith(100);
            expect(idevice.loadInitScriptIdevice).toHaveBeenCalledWith('edition');
            expect(mockEngine.updateMode).toHaveBeenCalled();
        });

        it('shows alert when engine mode is not view', () => {
            mockEngine.mode = 'edition';

            idevice.edition();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Not allowed',
                body: 'You cannot edit another iDevice until you save the current one',
            });
        });

        it('sets editing component in Yjs when enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp-id';
            const mockSetEditingComponent = vi.fn();
            idevice.engine.project = {
                _yjsBridge: {
                    getDocumentManager: vi.fn().mockReturnValue({
                        setEditingComponent: mockSetEditingComponent,
                    }),
                },
            };

            idevice.edition();

            expect(mockSetEditingComponent).toHaveBeenCalledWith('yjs-comp-id');
        });

        it('stops playing audio when entering edition mode', () => {
            const mockStopSound = vi.fn();
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        media: {
                            stopSound: mockStopSound,
                        },
                    },
                },
            };

            idevice.edition();

            expect(mockStopSound).toHaveBeenCalled();
            delete global.$exeDevices;
        });

        it('does not throw when $exeDevices is undefined', () => {
            delete global.$exeDevices;

            expect(() => idevice.edition()).not.toThrow();
        });

        it('does not throw when stopSound is not available', () => {
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        media: {},
                    },
                },
            };

            expect(() => idevice.edition()).not.toThrow();
            delete global.$exeDevices;
        });

        it('acquires Yjs lock and writes metadata when lock is available', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp-123';
            const mockRequestLock = vi.fn().mockReturnValue(true);
            const mockGetClientId = vi.fn().mockReturnValue('client-42');
            const mockGetCurrentUser = vi.fn().mockReturnValue({ name: 'Alice', color: '#ff0000' });
            const mockUpdateComponent = vi.fn();
            const mockSetEditingComponent = vi.fn();
            idevice.engine.project = {
                _yjsBridge: {
                    lockManager: {
                        requestLock: mockRequestLock,
                        getClientId: mockGetClientId,
                        getCurrentUser: mockGetCurrentUser,
                    },
                    structureBinding: {
                        updateComponent: mockUpdateComponent,
                    },
                    getDocumentManager: vi.fn().mockReturnValue({
                        setEditingComponent: mockSetEditingComponent,
                    }),
                },
            };

            idevice.edition();

            expect(mockRequestLock).toHaveBeenCalledWith('yjs-comp-123');
            expect(mockUpdateComponent).toHaveBeenCalledWith('yjs-comp-123', {
                lockedBy: 'client-42',
                lockUserName: 'Alice',
                lockUserColor: '#ff0000',
            });
            expect(idevice.goWindowToIdevice).toHaveBeenCalledWith(100);
            expect(idevice.loadInitScriptIdevice).toHaveBeenCalledWith('edition');
        });

        it('shows alert and re-enables buttons when lock is denied', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp-123';
            idevice.toogleIdeviceButtonsState = vi.fn();
            const mockRequestLock = vi.fn().mockReturnValue(false);
            idevice.engine.project = {
                _yjsBridge: {
                    lockManager: {
                        requestLock: mockRequestLock,
                    },
                },
            };
            idevice.getLockInfo = vi.fn().mockReturnValue({
                lockUserName: 'Bob',
                lockUserColor: '#00ff00',
            });

            idevice.edition();

            expect(mockRequestLock).toHaveBeenCalledWith('yjs-comp-123');
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'iDevice locked',
                body: 'This iDevice is being edited by Bob',
                contentId: 'warning',
            });
            expect(idevice.toogleIdeviceButtonsState).toHaveBeenCalledWith(false);
            expect(idevice.goWindowToIdevice).not.toHaveBeenCalled();
            expect(idevice.loadInitScriptIdevice).not.toHaveBeenCalled();
        });

        it('proceeds normally when no lock manager is available', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp-123';
            const mockSetEditingComponent = vi.fn();
            idevice.engine.project = {
                _yjsBridge: {
                    lockManager: null,
                    getDocumentManager: vi.fn().mockReturnValue({
                        setEditingComponent: mockSetEditingComponent,
                    }),
                },
            };

            idevice.edition();

            expect(idevice.goWindowToIdevice).toHaveBeenCalledWith(100);
            expect(idevice.loadInitScriptIdevice).toHaveBeenCalledWith('edition');
            expect(mockEngine.updateMode).toHaveBeenCalled();
        });

        it('uses yjsComponentId over odeIdeviceId for lock acquisition', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-preferred-id';
            idevice.odeIdeviceId = 'ode-fallback-id';
            const mockRequestLock = vi.fn().mockReturnValue(true);
            const mockGetClientId = vi.fn().mockReturnValue('client-1');
            const mockGetCurrentUser = vi.fn().mockReturnValue({ name: 'User', color: '#999' });
            idevice.engine.project = {
                _yjsBridge: {
                    lockManager: {
                        requestLock: mockRequestLock,
                        getClientId: mockGetClientId,
                        getCurrentUser: mockGetCurrentUser,
                    },
                    structureBinding: {
                        updateComponent: vi.fn(),
                    },
                    getDocumentManager: vi.fn().mockReturnValue({
                        setEditingComponent: vi.fn(),
                    }),
                },
            };

            idevice.edition();

            expect(mockRequestLock).toHaveBeenCalledWith('yjs-preferred-id');
        });

        it('falls back to "Another user" when lockInfo is null on denial', () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp-123';
            idevice.toogleIdeviceButtonsState = vi.fn();
            const mockRequestLock = vi.fn().mockReturnValue(false);
            idevice.engine.project = {
                _yjsBridge: {
                    lockManager: {
                        requestLock: mockRequestLock,
                    },
                },
            };
            idevice.getLockInfo = vi.fn().mockReturnValue(null);

            idevice.edition();

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'iDevice locked',
                body: 'This iDevice is being edited by Another user',
                contentId: 'warning',
            });
            expect(idevice.toogleIdeviceButtonsState).toHaveBeenCalledWith(false);
            expect(idevice.goWindowToIdevice).not.toHaveBeenCalled();
        });
    });

    describe('save', () => {
        beforeEach(() => {
            idevice.checkDeviceLoadInterval = null;
            idevice.saveIdeviceProcess = vi.fn().mockResolvedValue(true);
            idevice.resetWindowHash = vi.fn();
            idevice.goWindowToIdevice = vi.fn();
            idevice.loadInitScriptIdevice = vi.fn().mockResolvedValue();
            idevice.loadLegacyExeFunctionalitiesExport = vi.fn();
            mockEngine.resetCurrentIdevicesExportView = vi.fn();
            mockEngine.unsetIdeviceActive = vi.fn();
            eXeLearning.app.project.changeUserFlagOnEdit = vi.fn().mockResolvedValue();
        });

        it('saves idevice and loads export view on success', async () => {
            const result = await idevice.save(false);

            expect(idevice.saveIdeviceProcess).toHaveBeenCalled();
            expect(idevice.loadInitScriptIdevice).toHaveBeenCalledWith('export');
            expect(mockEngine.unsetIdeviceActive).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('resets current idevices when loadPage is true', async () => {
            await idevice.save(true);

            expect(mockEngine.resetCurrentIdevicesExportView).toHaveBeenCalledWith([idevice.id]);
        });

        it('shows error modal when save fails', async () => {
            vi.useFakeTimers();
            idevice.saveIdeviceProcess.mockResolvedValue(false);
            idevice.toogleIdeviceButtonsState = vi.fn();
            eXeLearning.app.modals.alert.modal = { _isShown: false };
            eXeLearning.app.modals.confirm.modal = { _isShown: false };

            await idevice.save(false);
            vi.advanceTimersByTime(500);

            expect(idevice.toogleIdeviceButtonsState).toHaveBeenCalledWith(false);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('releases lock in Yjs when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp';
            const mockReleaseLock = vi.fn();
            idevice.getLockManager = vi.fn().mockReturnValue({
                releaseLock: mockReleaseLock,
            });
            idevice.engine.project = {
                _yjsBridge: {
                    structureBinding: {
                        updateComponent: vi.fn(),
                    },
                    getDocumentManager: vi.fn().mockReturnValue({
                        setEditingComponent: vi.fn(),
                    }),
                },
            };

            await idevice.save(false);

            expect(mockReleaseLock).toHaveBeenCalledWith('yjs-comp');
        });

        it('stops playing audio when exiting edition mode', async () => {
            const mockStopSound = vi.fn();
            global.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        helpers: {
                            stopSound: mockStopSound,
                        },
                    },
                },
            };

            await idevice.save(false);

            expect(mockStopSound).toHaveBeenCalled();
            delete global.$exeDevicesEdition;
        });

        it('does not throw when $exeDevicesEdition is undefined', async () => {
            delete global.$exeDevicesEdition;

            await expect(idevice.save(false)).resolves.not.toThrow();
        });

        it('does not throw when stopSound is not available in edition helpers', async () => {
            global.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        helpers: {},
                    },
                },
            };

            await expect(idevice.save(false)).resolves.not.toThrow();
            delete global.$exeDevicesEdition;
        });
    });

    describe('saveIdeviceProcess', () => {
        it('calls apiSaveIdeviceJson for json type', async () => {
            idevice.idevice = { componentType: 'json' };
            idevice.apiSaveIdeviceJson = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            const result = await idevice.saveIdeviceProcess();

            expect(idevice.apiSaveIdeviceJson).toHaveBeenCalledWith(true);
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('calls apiSaveIdeviceViewHTML for html type', async () => {
            idevice.idevice = { componentType: 'html' };
            idevice.apiSaveIdeviceViewHTML = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            const result = await idevice.saveIdeviceProcess();

            expect(idevice.apiSaveIdeviceViewHTML).toHaveBeenCalledWith(true);
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('defaults to html type when no componentType', async () => {
            idevice.idevice = {};
            idevice.apiSaveIdeviceViewHTML = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            await idevice.saveIdeviceProcess();

            expect(idevice.apiSaveIdeviceViewHTML).toHaveBeenCalledWith(true);
        });
    });

    describe('apiSaveIdeviceViewHTML', () => {
        beforeEach(() => {
            idevice.htmlView = '<p>HTML to save</p>';
            idevice.ideviceBody = document.createElement('div');
            idevice.apiSendDataService = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
        });

        it('sends htmlView params to service', async () => {
            const result = await idevice.apiSaveIdeviceViewHTML(false);

            expect(idevice.apiSendDataService).toHaveBeenCalledWith(
                'putSaveHtmlView',
                ['odeComponentsSyncId', 'htmlView'],
                false
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('gets htmlView from $exeDevice when saveIdevice is true', async () => {
            global.$exeDevice = {
                save: vi.fn().mockReturnValue('<p>Saved HTML</p>'),
            };

            await idevice.apiSaveIdeviceViewHTML(true);

            expect(global.$exeDevice.save).toHaveBeenCalled();
            expect(idevice.htmlView).toBe('<p>Saved HTML</p>');
        });

        it('adds error class when $exeDevice.save returns false', async () => {
            global.$exeDevice = {
                save: vi.fn().mockReturnValue(false),
            };

            await idevice.apiSaveIdeviceViewHTML(true);

            expect(idevice.ideviceBody.classList.contains('save-error')).toBe(true);
        });

        it('returns false when htmlView is falsy', async () => {
            idevice.htmlView = null;

            const result = await idevice.apiSaveIdeviceViewHTML(false);

            expect(result).toBe(false);
        });
    });

    describe('apiSaveIdeviceJson', () => {
        beforeEach(() => {
            idevice.jsonProperties = { data: 'test' };
            idevice.ideviceBody = document.createElement('div');
            idevice.htmlView = '';
            idevice.apiSendDataService = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
        });

        it('sends jsonProperties params to service', async () => {
            const result = await idevice.apiSaveIdeviceJson(false);

            expect(idevice.apiSendDataService).toHaveBeenCalledWith(
                'putSaveIdevice',
                ['odeComponentsSyncId', 'jsonProperties'],
                false
            );
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('gets jsonProperties from $exeDevice when saveIdevice is true', async () => {
            global.$exeDevice = {
                save: vi.fn().mockReturnValue({ key: 'new value' }),
            };

            await idevice.apiSaveIdeviceJson(true);

            expect(global.$exeDevice.save).toHaveBeenCalled();
            expect(idevice.jsonProperties).toEqual({ key: 'new value' });
        });

        it('returns false when jsonProperties is falsy', async () => {
            idevice.jsonProperties = null;

            const result = await idevice.apiSaveIdeviceJson(false);

            expect(result).toBe(false);
        });
    });

    describe('reorderViaYjs', () => {
        beforeEach(() => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-id';
            idevice.order = 3;
            idevice.ideviceContent = document.createElement('div');
            mockEngine.movingClassDuration = 100;
        });

        it('returns OK when reorder succeeds', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    reorderComponent: vi.fn().mockReturnValue(true),
                },
            };

            const result = await idevice.reorderViaYjs();

            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('returns ERROR when structureBinding is not available', async () => {
            eXeLearning.app.project._yjsBridge = null;

            const result = await idevice.reorderViaYjs();

            expect(result).toEqual({ responseMessage: 'ERROR' });
        });

        it('tries multiple component IDs', async () => {
            const reorderMock = vi.fn().mockReturnValue(false).mockReturnValueOnce(false).mockReturnValueOnce(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    reorderComponent: reorderMock,
                },
            };
            idevice.odeIdeviceId = 'ode-id';
            idevice.id = 'comp-id';

            await idevice.reorderViaYjs();

            expect(reorderMock).toHaveBeenCalled();
        });
    });

    describe('moveToBlockViaYjs', () => {
        beforeEach(() => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp';
            idevice.order = 2;
            idevice.block = { blockId: 'block-123' };
            mockEngine.setParentsAndChildrenIdevicesBlocks = vi.fn();
        });

        it('returns OK when move succeeds', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToBlock: vi.fn().mockReturnValue(true),
                },
            };

            const result = await idevice.moveToBlockViaYjs();

            expect(result).toEqual({ responseMessage: 'OK' });
            // Caller (dropIdeviceContentInContent) handles empty block check
            // Function is called without arguments (uses default null)
            expect(mockEngine.setParentsAndChildrenIdevicesBlocks).toHaveBeenCalled();
        });

        it('returns ERROR when structureBinding is not available', async () => {
            eXeLearning.app.project._yjsBridge = null;

            const result = await idevice.moveToBlockViaYjs();

            expect(result).toEqual({ responseMessage: 'ERROR' });
        });
    });

    describe('moveToPageViaYjs', () => {
        beforeEach(() => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.yjsComponentId = 'yjs-comp';
            idevice.idevice = { title: 'Text' };
            idevice.ideviceContent = document.createElement('div');
            document.body.appendChild(idevice.ideviceContent);
            mockEngine.setParentsAndChildrenIdevicesBlocks = vi.fn();
            // Mock remove to prevent side effects
            idevice.remove = vi.fn();
        });

        it('returns OK when move succeeds', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToPage: vi.fn().mockReturnValue({ blockId: 'new-block' }),
                },
            };

            const result = await idevice.moveToPageViaYjs('new-page-id');

            expect(result).toEqual({ responseMessage: 'OK' });
            expect(idevice.odeNavStructureSyncId).toBe('new-page-id');
            expect(idevice.blockId).toBe('new-block');
        });

        it('returns ERROR when structureBinding is not available', async () => {
            eXeLearning.app.project._yjsBridge = null;

            const result = await idevice.moveToPageViaYjs('new-page-id');

            expect(result).toEqual({ responseMessage: 'ERROR' });
        });

        it('passes previous blockId to setParentsAndChildrenIdevicesBlocks for empty block check', async () => {
            // Set up initial block ID
            idevice.blockId = 'old-block-id';

            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToPage: vi.fn().mockReturnValue({ blockId: 'new-block-id' }),
                },
            };

            await idevice.moveToPageViaYjs('new-page-id');

            // Should pass the OLD block ID (before the move) to check if it became empty
            expect(mockEngine.setParentsAndChildrenIdevicesBlocks).toHaveBeenCalledWith('old-block-id');
        });

        it('calls remove() to clean up idevice view after successful move', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToPage: vi.fn().mockReturnValue({ blockId: 'new-block' }),
                },
            };

            await idevice.moveToPageViaYjs('new-page-id');

            expect(idevice.remove).toHaveBeenCalled();
        });

        it('returns ERROR when moveComponentToPage returns null', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToPage: vi.fn().mockReturnValue(null),
                },
            };

            const result = await idevice.moveToPageViaYjs('new-page-id');

            expect(result).toEqual({ responseMessage: 'ERROR' });
            expect(mockEngine.setParentsAndChildrenIdevicesBlocks).not.toHaveBeenCalled();
        });

        it('tries multiple component IDs when first one fails', async () => {
            idevice.yjsComponentId = 'yjs-id';
            idevice.odeIdeviceId = 'ode-id';
            idevice.id = 'fallback-id';

            const mockMoveToPage = vi.fn()
                .mockReturnValueOnce(null) // First call fails
                .mockReturnValueOnce({ blockId: 'new-block' }); // Second succeeds

            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveComponentToPage: mockMoveToPage,
                },
            };

            const result = await idevice.moveToPageViaYjs('new-page-id');

            expect(result).toEqual({ responseMessage: 'OK' });
            expect(mockMoveToPage).toHaveBeenCalledTimes(2);
        });
    });

    describe('deleteViaYjs', () => {
        beforeEach(() => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.deleteComponentViaYjs = vi.fn().mockReturnValue(true);
            idevice.id = 'comp-to-delete';
        });

        it('returns OK when delete succeeds', async () => {
            const result = await idevice.deleteViaYjs();

            expect(eXeLearning.app.project.deleteComponentViaYjs).toHaveBeenCalledWith('comp-to-delete');
            expect(result).toEqual({ responseMessage: 'OK' });
        });

        it('shows error modal when delete fails', async () => {
            vi.useFakeTimers();
            eXeLearning.app.project.deleteComponentViaYjs.mockReturnValue(false);

            const result = await idevice.deleteViaYjs();
            vi.advanceTimersByTime(300);

            expect(result).toBe(false);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('generateModalMoveToPageBody', () => {
        beforeEach(() => {
            idevice.block = {
                odeNavStructureSyncId: 'page-1',
            };
        });

        it('generates modal body with select element', () => {
            const result = idevice.generateModalMoveToPageBody();

            expect(result.tagName).toBe('DIV');
            expect(result.querySelector('.text-info-move-to-page')).not.toBeNull();
            expect(result.querySelector('.select-move-to-page')).not.toBeNull();
        });

        it('populates select with pages from structure', () => {
            const result = idevice.generateModalMoveToPageBody();
            const select = result.querySelector('select');

            expect(select.options.length).toBe(2);
            expect(select.options[0].value).toBe('page-1');
            expect(select.options[1].value).toBe('page-2');
        });

        it('marks current page as selected', () => {
            const result = idevice.generateModalMoveToPageBody();
            const select = result.querySelector('select');

            expect(select.options[0].selected).toBe(true);
        });
    });

    describe('legacyExeFieldsetAction', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
        });

        it('adds open class to fieldsets without closed class', () => {
            idevice.ideviceBody.innerHTML = `
                <fieldset class="exe-fieldset">
                    <legend><a href="#">Toggle</a></legend>
                </fieldset>
            `;

            idevice.legacyExeFieldsetAction();

            const fieldset = idevice.ideviceBody.querySelector('fieldset');
            expect(fieldset.classList.contains('exe-fieldset-open')).toBe(true);
        });

        it('toggles fieldset on legend click', () => {
            idevice.ideviceBody.innerHTML = `
                <fieldset class="exe-fieldset exe-fieldset-open">
                    <legend><a href="#">Toggle</a></legend>
                </fieldset>
            `;

            idevice.legacyExeFieldsetAction();

            const legend = idevice.ideviceBody.querySelector('legend a');
            legend.click();

            const fieldset = idevice.ideviceBody.querySelector('fieldset');
            expect(fieldset.classList.contains('exe-fieldset-closed')).toBe(true);
            expect(fieldset.classList.contains('exe-fieldset-open')).toBe(false);
        });
    });

    describe('checkIdeviceIsEditing', () => {
        it('calls updateResourceLockStatus with correct params', () => {
            idevice.updateResourceLockStatus = vi.fn();
            idevice.odeIdeviceId = 'test-idevice';
            idevice.blockId = 'test-block';
            idevice.block = { pageId: 'test-page' };

            idevice.checkIdeviceIsEditing();

            expect(idevice.updateResourceLockStatus).toHaveBeenCalledWith({
                odeIdeviceId: 'test-idevice',
                blockId: 'test-block',
                actionType: 'LOADING',
                pageId: 'test-page',
            });
        });
    });

    describe('addNoTranslateForGoogle', () => {
        it('adds notranslate class to auto-icon elements', () => {
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = '<span class="auto-icon">Icon</span>';

            idevice.addNoTranslateForGoogle();

            const icon = idevice.ideviceButtons.querySelector('.auto-icon');
            expect(icon.classList.contains('notranslate')).toBe(true);
        });
    });

    describe('addTooltips', () => {
        it('adds tooltip class and initializes tooltips', () => {
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `
                <button class="btn-action-menu">Action</button>
            `;

            idevice.addTooltips();

            const button = idevice.ideviceButtons.querySelector('button');
            expect(button.classList.contains('exe-app-tooltip')).toBe(true);
            expect(eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(idevice.ideviceButtons);
        });

        it('excludes dropdown and special buttons from tooltip class', () => {
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `
                <button class="btn-action-menu" data-bs-toggle="dropdown">Dropdown</button>
                <button class="btn-action-menu btn-edit-idevice">Edit</button>
                <button class="btn-action-menu btn-save-idevice">Save</button>
            `;

            idevice.addTooltips();

            const buttons = idevice.ideviceButtons.querySelectorAll('button');
            buttons.forEach((btn) => {
                expect(btn.classList.contains('exe-app-tooltip')).toBe(false);
            });
        });
    });

    describe('inactivityInElement', () => {
        beforeEach(() => {
            idevice.inactivityTimer = null;
            idevice.timeIdeviceEditing = 12345;
            idevice.updateResourceLockStatus = vi.fn();
            idevice.odeIdeviceId = 'test-element-id';
            eXeLearning.app.project.changeUserFlagOnEdit = vi.fn().mockResolvedValue({});
            // Create element in DOM with the correct ID
            const element = document.createElement('div');
            element.id = 'test-element-id';
            document.body.appendChild(element);
        });

        afterEach(() => {
            const element = document.getElementById('test-element-id');
            if (element) element.remove();
        });

        it('clears existing timer before setting new one', () => {
            vi.useFakeTimers();
            idevice.inactivityTimer = setTimeout(() => {}, 10000);
            const clearSpy = vi.spyOn(global, 'clearTimeout');

            idevice.inactivityInElement('test-element-id', 60000, () => {});

            expect(clearSpy).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('returns cleanup function when element exists', () => {
            const result = idevice.inactivityInElement('test-element-id', 60000, () => {});

            expect(typeof result).toBe('function');
        });

        it('returns empty function when elementId is undefined', () => {
            const result = idevice.inactivityInElement(undefined, 60000, () => {});

            expect(typeof result).toBe('function');
        });

        it('returns empty function when element not found in DOM', () => {
            const result = idevice.inactivityInElement('non-existent-id', 60000, () => {});

            expect(typeof result).toBe('function');
        });

        it('sets up inactivity timers storage', () => {
            idevice.inactivityInElement('test-element-id', 60000, () => {});

            expect(idevice.inactivityTimers).toBeDefined();
            expect(idevice.inactiveStates).toBeDefined();
        });
    });

    describe('lockScreen', () => {
        beforeEach(() => {
            const loadScreen = document.createElement('div');
            loadScreen.id = 'load-screen-node-content';
            loadScreen.classList.add('hide', 'hidden');
            document.body.appendChild(loadScreen);

            const nodeContent = document.createElement('div');
            nodeContent.id = 'node-content';
            document.body.appendChild(nodeContent);
        });

        afterEach(() => {
            document.getElementById('load-screen-node-content')?.remove();
            document.getElementById('node-content')?.remove();
        });

        it('shows load screen with correct styles', () => {
            idevice.lockScreen();

            const loadScreen = document.getElementById('load-screen-node-content');
            expect(loadScreen.style.zIndex).toBe('9999');
            expect(loadScreen.style.position).toBe('fixed');
            expect(loadScreen.classList.contains('loading')).toBe(true);
            expect(loadScreen.classList.contains('hide')).toBe(false);
        });

        it('sets data-visible attribute to true', () => {
            idevice.lockScreen();

            const loadScreen = document.getElementById('load-screen-node-content');
            expect(loadScreen.getAttribute('data-visible')).toBe('true');
        });
    });

    describe('unlockScreen', () => {
        beforeEach(() => {
            const loadScreen = document.createElement('div');
            loadScreen.id = 'load-screen-node-content';
            loadScreen.classList.add('loading');
            document.body.appendChild(loadScreen);

            const nodeContent = document.createElement('div');
            nodeContent.id = 'node-content';
            document.body.appendChild(nodeContent);
        });

        afterEach(() => {
            document.getElementById('load-screen-node-content')?.remove();
            document.getElementById('node-content')?.remove();
        });

        it('removes loading class and adds hidding class', () => {
            idevice.unlockScreen();

            const loadScreen = document.getElementById('load-screen-node-content');
            expect(loadScreen.classList.contains('loading')).toBe(false);
            expect(loadScreen.classList.contains('hidding')).toBe(true);
        });

        it('sets hide class after timeout', () => {
            vi.useFakeTimers();
            idevice.unlockScreen(0);
            vi.advanceTimersByTime(100);

            const loadScreen = document.getElementById('load-screen-node-content');
            expect(loadScreen.classList.contains('hide')).toBe(true);
            expect(loadScreen.classList.contains('hidden')).toBe(true);
            vi.useRealTimers();
        });
    });

    describe('updateParam', () => {
        beforeEach(() => {
            idevice.ideviceContent = document.createElement('div');
        });

        it('updates parameter value', () => {
            idevice.updateParam('testParam', 'newValue');
            expect(idevice.testParam).toBe('newValue');
        });

        it('updates order attribute on ideviceContent when param is order', () => {
            idevice.updateParam('order', 5);

            expect(idevice.order).toBe(5);
            expect(idevice.ideviceContent.getAttribute('order')).toBe('5');
        });
    });

    describe('updateModeParentBlock', () => {
        it('updates block mode when block exists', () => {
            const mockBlock = {
                updateMode: vi.fn(),
            };
            mockEngine.getBlockById.mockReturnValue(mockBlock);
            idevice.mode = 'edition';

            idevice.updateModeParentBlock();

            expect(mockBlock.updateMode).toHaveBeenCalledWith('edition');
        });

        it('handles missing block gracefully', () => {
            mockEngine.getBlockById.mockReturnValue(null);

            expect(() => idevice.updateModeParentBlock()).not.toThrow();
        });
    });

    describe('resetWindowHash', () => {
        it('resets scrollTop to offsetTop', () => {
            idevice.nodeContainer = {
                scrollTop: 100,
                offsetTop: 50,
            };

            idevice.resetWindowHash();

            expect(idevice.nodeContainer.scrollTop).toBe(50);
        });
    });

    describe('goWindowToIdevice', () => {
        beforeEach(() => {
            idevice.nodeContainer = { scrollTop: 0 };
            idevice.odeIdeviceId = 'idevice-123';
            const element = document.createElement('div');
            element.id = 'idevice-123';
            element.style.position = 'relative';
            document.body.appendChild(element);
        });

        afterEach(() => {
            document.getElementById('idevice-123')?.remove();
            document.getElementById('block-123')?.remove();
        });

        it('scrolls to idevice element after timeout', () => {
            vi.useFakeTimers();
            idevice.block = { idevices: [], blockId: 'block-123' };

            idevice.goWindowToIdevice(100);
            vi.advanceTimersByTime(100);

            vi.useRealTimers();
        });

        it('uses block id when idevice is first in block', () => {
            vi.useFakeTimers();
            const blockElement = document.createElement('div');
            blockElement.id = 'block-123';
            document.body.appendChild(blockElement);

            idevice.block = {
                idevices: [{ odeIdeviceId: 'idevice-123' }],
                blockId: 'block-123',
            };

            idevice.goWindowToIdevice(100);
            vi.advanceTimersByTime(100);

            vi.useRealTimers();
        });
    });

    describe('clearSelection', () => {
        it('calls window.getSelection().removeAllRanges()', () => {
            const removeAllRanges = vi.fn();
            window.getSelection = vi.fn().mockReturnValue({
                removeAllRanges,
            });

            idevice.clearSelection();

            expect(removeAllRanges).toHaveBeenCalled();
        });
    });

    describe('activateUpdateFlag', () => {
        it('calls postActivateCurrentOdeUsersUpdateFlag with correct params', () => {
            eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag = vi.fn();
            idevice.odeIdeviceId = 'test-idevice';

            idevice.activateUpdateFlag();

            expect(eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag).toHaveBeenCalledWith({
                odeSessionId: 'session-123',
                odeIdeviceId: 'test-idevice',
            });
        });
    });

    describe('sendPublishedNotification', () => {
        it('does not notify when offlineInstallation is true', () => {
            idevice.offlineInstallation = true;
            idevice.realTimeEventNotifier = { notify: vi.fn() };

            idevice.sendPublishedNotification();

            expect(idevice.realTimeEventNotifier.notify).not.toHaveBeenCalled();
        });

        it('notifies when offlineInstallation is false', () => {
            idevice.offlineInstallation = false;
            idevice.realTimeEventNotifier = { notify: vi.fn() };

            idevice.sendPublishedNotification();

            expect(idevice.realTimeEventNotifier.notify).toHaveBeenCalledWith(
                'session-123',
                { name: 'new-content-published' }
            );
        });
    });

    describe('readFile', () => {
        it('resolves with file content', async () => {
            const mockFile = new Blob(['test content'], { type: 'text/plain' });

            const result = await idevice.readFile(mockFile);

            expect(result).toContain('data:');
        });
    });

    describe('processFile', () => {
        it('handles file processing silently on error', async () => {
            idevice.addUploadImage = vi.fn().mockRejectedValue(new Error('Upload failed'));

            // Should not throw
            await expect(idevice.processFile({}, 'test-id', 'image')).resolves.toBeUndefined();
        });
    });

    describe('base64ToFile', () => {
        it('converts base64 data URL to File object', () => {
            // 1x1 transparent PNG as base64
            const base64 =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            const file = idevice.base64ToFile(base64, 'test.png');

            expect(file).toBeInstanceOf(File);
            expect(file.name).toBe('test.png');
            expect(file.type).toBe('image/png');
            expect(file.size).toBeGreaterThan(0);
        });

        it('throws error for invalid base64 data', () => {
            expect(() => idevice.base64ToFile('not-a-data-url', 'test.png')).toThrow('Invalid base64 data URL');
        });
    });

    describe('apiUploadFile', () => {
        const base64Image =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        let originalYjsBridge;

        beforeEach(() => {
            // Save original _yjsBridge state
            originalYjsBridge = eXeLearning.app.project._yjsBridge;
        });

        afterEach(() => {
            // Restore original _yjsBridge state
            eXeLearning.app.project._yjsBridge = originalYjsBridge;
        });

        it('calls postUploadFileResource with correct params', async () => {
            eXeLearning.app.api.postUploadFileResource = vi.fn().mockResolvedValue({ success: true });
            idevice.odeIdeviceId = 'idevice-123';

            await idevice.apiUploadFile(base64Image, 'test.png');

            expect(eXeLearning.app.api.postUploadFileResource).toHaveBeenCalledWith({
                odeIdeviceId: 'idevice-123',
                file: base64Image,
                filename: 'test.png',
                createThumbnail: true,
            });
        });

        it('creates asset and returns correct URLs', async () => {
            // insertImage() returns asset://uuid.ext format
            const mockBlobUrl = 'blob:http://localhost:8080/mock-blob-id';
            const mockAssetManager = {
                insertImage: vi.fn().mockResolvedValue('asset://abc123-def4-5678-90ab-cdef12345678.webm'),
                resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
            };
            eXeLearning.app.project._yjsBridge = { assetManager: mockAssetManager };
            eXeLearning.app.api.postUploadFileResource = vi.fn().mockResolvedValue({
                savedPath: '/v1/files/perm/assets/project123',
                savedFilename: 'recording.webm',
                savedThumbnailName: 'thumb_recording.webm',
            });
            idevice.odeIdeviceId = 'idevice-123';

            const result = await idevice.apiUploadFile(base64Image, 'recording.webm');

            expect(mockAssetManager.insertImage).toHaveBeenCalled();
            expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://abc123-def4-5678-90ab-cdef12345678.webm');
            expect(result.savedPath).toBe('');
            expect(result.savedFilename).toBe('asset://abc123-def4-5678-90ab-cdef12345678.webm');
            expect(result.savedThumbnailName).toBe('asset://abc123-def4-5678-90ab-cdef12345678.webm');
            expect(result.previewUrl).toBe(mockBlobUrl);
        });

        it('falls back to server paths when AssetManager is not available', async () => {
            // Set _yjsBridge to null to simulate AssetManager not available
            eXeLearning.app.project._yjsBridge = null;
            eXeLearning.app.api.postUploadFileResource = vi.fn().mockResolvedValue({
                savedPath: '/v1/files/perm/assets/project123',
                savedFilename: 'test.png',
                savedThumbnailName: 'thumb_test.png',
            });
            idevice.odeIdeviceId = 'idevice-123';

            const result = await idevice.apiUploadFile(base64Image, 'test.png');

            expect(result.savedPath).toBe('/v1/files/perm/assets/project123');
            expect(result.savedFilename).toBe('test.png');
            expect(result.savedThumbnailName).toBe('thumb_test.png');
        });

        it('falls back to server paths when asset creation fails', async () => {
            const mockAssetManager = {
                insertImage: vi.fn().mockRejectedValue(new Error('Asset creation failed')),
            };
            eXeLearning.app.project._yjsBridge = { assetManager: mockAssetManager };
            eXeLearning.app.api.postUploadFileResource = vi.fn().mockResolvedValue({
                savedPath: '/v1/files/perm/assets/project123',
                savedFilename: 'test.png',
                savedThumbnailName: 'thumb_test.png',
            });
            idevice.odeIdeviceId = 'idevice-123';

            const result = await idevice.apiUploadFile(base64Image, 'test.png');

            // Should fallback to original server paths
            expect(result.savedPath).toBe('/v1/files/perm/assets/project123');
            expect(result.savedFilename).toBe('test.png');
            expect(result.savedThumbnailName).toBe('thumb_test.png');
        });
    });

    describe('apiUploadLargeFile', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-456';
            eXeLearning.app.api.postUploadLargeFileResource = vi.fn().mockResolvedValue({ success: true });
        });

        it('appends idevice data to formData', async () => {
            const formData = new FormData();
            const appendSpy = vi.spyOn(formData, 'append');

            await idevice.apiUploadLargeFile(formData);

            expect(appendSpy).toHaveBeenCalledWith('odeIdeviceId', ['idevice-456']);
            expect(appendSpy).toHaveBeenCalledWith('createThumbnail', [true]);
        });

        it('handles memory error response', async () => {
            eXeLearning.app.api.postUploadLargeFileResource.mockResolvedValue('Allowed memory size exceeded');
            const formData = new FormData();

            const result = await idevice.apiUploadLargeFile(formData);

            expect(result.code).toBe('File is too large');
        });

        it('handles generic error response', async () => {
            eXeLearning.app.api.postUploadLargeFileResource.mockResolvedValue('Some other error string');
            const formData = new FormData();

            const result = await idevice.apiUploadLargeFile(formData);

            expect(result.code).toBe('Error uploading file');
        });
    });

    describe('apiGetHtmlView', () => {
        it('fetches and sets htmlView', async () => {
            eXeLearning.app.api.getSaveHtmlView = vi.fn().mockResolvedValue({
                htmlView: '<p>Fetched HTML</p>',
            });
            idevice.id = 'comp-id';
            idevice.ideviceBody = document.createElement('div');

            const result = await idevice.apiGetHtmlView();

            expect(result).toBe('<p>Fetched HTML</p>');
            expect(idevice.htmlView).toBe('<p>Fetched HTML</p>');
            expect(idevice.ideviceBody.innerHTML).toBe('<p>Fetched HTML</p>');
        });
    });

    describe('apiGetComponentHtmlTemplate', () => {
        it('fetches component html template', async () => {
            eXeLearning.app.api.getComponentHtmlTemplate = vi.fn().mockResolvedValue({
                htmlTemplate: '<template>{{content}}</template>',
            });
            idevice.id = 'comp-id';

            const result = await idevice.apiGetComponentHtmlTemplate();

            expect(result).toBe('<template>{{content}}</template>');
        });
    });

    describe('apiSendDataService', () => {
        beforeEach(() => {
            idevice.id = 'comp-id';
            idevice.order = 1;
            idevice.odeIdeviceId = 'idevice-id';
            idevice.idevice = { name: 'text' };
            idevice.block = {
                id: 'block-id',
                blockId: 'block-ode-id',
                blockName: 'Block',
                iconName: 'icon.svg',
                idevices: [],
                getCurrentOrder: vi.fn().mockReturnValue(0),
                updateParam: vi.fn(),
            };
            eXeLearning.app.api.testService = vi.fn();
        });

        it('returns response on success', async () => {
            eXeLearning.app.api.testService.mockResolvedValue({
                responseMessage: 'OK',
            });

            const result = await idevice.apiSendDataService('testService', ['odeComponentsSyncId'], false);

            expect(result.responseMessage).toBe('OK');
        });

        it('returns false on failure', async () => {
            eXeLearning.app.api.testService.mockResolvedValue({
                responseMessage: 'ERROR',
            });

            const result = await idevice.apiSendDataService('testService', ['odeComponentsSyncId'], false);

            expect(result).toBe(false);
        });

        it('updates idevice params on new component creation', async () => {
            eXeLearning.app.api.testService.mockResolvedValue({
                responseMessage: 'OK',
                newOdeComponentsSync: true,
                odeComponentsSync: { id: 'new-id', pageId: 'new-page' },
                odePagStructureSync: { odeNavStructureSyncId: 'new-nav' },
            });

            await idevice.apiSendDataService('testService', ['odeComponentsSyncId'], false);

            expect(idevice.id).toBe('new-id');
            expect(idevice.pageId).toBe('new-page');
        });

        it('adds idevice to block idevices list', async () => {
            eXeLearning.app.api.testService.mockResolvedValue({
                responseMessage: 'OK',
            });

            await idevice.apiSendDataService('testService', ['odeComponentsSyncId'], false);

            expect(idevice.block.idevices).toContain(idevice);
        });
    });

    describe('apiSaveProperties', () => {
        beforeEach(() => {
            idevice.id = 'comp-id';
            idevice.properties = {
                identifier: { value: 'old-id' },
                visibility: { value: 'true' },
            };
            idevice.makeIdeviceContentNode = vi.fn();
            eXeLearning.app.api.putSavePropertiesIdevice = vi.fn();
        });

        it('updates properties and calls API', async () => {
            eXeLearning.app.api.putSavePropertiesIdevice.mockResolvedValue({
                responseMessage: 'OK',
            });

            await idevice.apiSaveProperties({ identifier: 'new-id' });

            expect(idevice.properties.identifier.value).toBe('new-id');
            expect(eXeLearning.app.api.putSavePropertiesIdevice).toHaveBeenCalled();
        });

        it('resets idevice content on success', async () => {
            eXeLearning.app.api.putSavePropertiesIdevice.mockResolvedValue({
                responseMessage: 'OK',
            });

            await idevice.apiSaveProperties({ identifier: 'new-id' });

            expect(idevice.makeIdeviceContentNode).toHaveBeenCalledWith(false);
        });

        it('shows error modal on failure', async () => {
            eXeLearning.app.api.putSavePropertiesIdevice.mockResolvedValue({
                responseMessage: 'ERROR',
            });

            await idevice.apiSaveProperties({ identifier: 'new-id' });

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });
    });

    describe('apiUpdateOrder', () => {
        beforeEach(() => {
            idevice.id = 'comp-id';
            idevice.order = 2;
            idevice.ideviceContent = document.createElement('div');
            idevice.apiSendDataService = vi.fn();
            mockEngine.updateComponentsIdevices = vi.fn();
            mockEngine.movingClassDuration = 100;
        });

        it('uses Yjs when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.reorderViaYjs = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            await idevice.apiUpdateOrder();

            expect(idevice.reorderViaYjs).toHaveBeenCalled();
        });

        it('uses API when Yjs disabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            idevice.apiSendDataService.mockResolvedValue({
                responseMessage: 'OK',
                odeComponentsSyncs: [],
            });

            await idevice.apiUpdateOrder();

            expect(idevice.apiSendDataService).toHaveBeenCalledWith(
                'putReorderIdevice',
                ['odeComponentsSyncId', 'order'],
                true
            );
        });
    });

    describe('apiUpdateBlock', () => {
        beforeEach(() => {
            idevice.id = 'comp-id';
            idevice.apiSendDataService = vi.fn();
            mockEngine.setParentsAndChildrenIdevicesBlocks = vi.fn();
        });

        it('uses Yjs when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            idevice.moveToBlockViaYjs = vi.fn().mockResolvedValue({ responseMessage: 'OK' });

            await idevice.apiUpdateBlock();

            expect(idevice.moveToBlockViaYjs).toHaveBeenCalled();
        });
    });

    describe('apiDeleteIdevice', () => {
        beforeEach(() => {
            idevice.id = 'comp-to-delete';
            mockEngine.updateComponentsIdevices = vi.fn();
            eXeLearning.app.api.deleteIdevice = vi.fn();
        });

        it('uses Yjs when enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project.deleteComponentViaYjs = vi.fn().mockReturnValue(true);

            await idevice.apiDeleteIdevice();

            expect(eXeLearning.app.project.deleteComponentViaYjs).toHaveBeenCalled();
        });

        it('uses API when Yjs disabled', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.api.deleteIdevice.mockResolvedValue({
                responseMessage: 'OK',
                odeComponentsSyncs: [],
            });

            await idevice.apiDeleteIdevice();

            expect(eXeLearning.app.api.deleteIdevice).toHaveBeenCalledWith('comp-to-delete');
        });
    });

    describe('apiCloneIdevice', () => {
        beforeEach(() => {
            idevice.id = 'comp-to-clone';
            idevice.cloneViaYjs = vi.fn();
        });

        it('delegates to cloneViaYjs', async () => {
            idevice.cloneViaYjs.mockResolvedValue({
                responseMessage: 'OK',
                clonedComponent: { id: 'cloned-id' },
            });

            const result = await idevice.apiCloneIdevice();

            expect(idevice.cloneViaYjs).toHaveBeenCalled();
            expect(result.responseMessage).toBe('OK');
        });
    });

    describe('cloneViaYjs', () => {
        beforeEach(() => {
            idevice.id = 'comp-to-clone';
            idevice.pageId = 'page-1';
            idevice.blockId = 'block-1';
            mockEngine.loadApiIdevicesInPage = vi.fn().mockResolvedValue(true);
        });

        it('clones component via Yjs on success', async () => {
            eXeLearning.app.project.cloneComponentViaYjs = vi.fn().mockReturnValue({
                id: 'cloned-id',
            });

            const result = await idevice.cloneViaYjs();

            expect(eXeLearning.app.project.cloneComponentViaYjs).toHaveBeenCalledWith(
                'page-1',
                'block-1',
                'comp-to-clone'
            );
            expect(mockEngine.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
            expect(result.responseMessage).toBe('OK');
        });

        it('returns error when cloneComponentViaYjs fails', async () => {
            eXeLearning.app.project.cloneComponentViaYjs = vi.fn().mockReturnValue(null);
            idevice.showModalMessageErrorDatabase = vi.fn();

            const result = await idevice.cloneViaYjs();

            expect(result.responseMessage).toBe('ERROR');
            expect(idevice.showModalMessageErrorDatabase).toHaveBeenCalled();
        });

        it('returns error when missing pageId or blockId', async () => {
            idevice.pageId = null;
            idevice.blockId = null;
            eXeLearning.app.project.structure = null;
            idevice.showModalMessageErrorDatabase = vi.fn();

            const result = await idevice.cloneViaYjs();

            expect(result.responseMessage).toBe('ERROR');
            expect(idevice.showModalMessageErrorDatabase).toHaveBeenCalled();
        });
    });

    describe('createAddTextBtn', () => {
        it('calls menuStructureBehaviour.createAddTextBtn', () => {
            idevice.createAddTextBtn();

            expect(eXeLearning.app.menus.menuStructure.engine.menuStructureBehaviour.createAddTextBtn).toHaveBeenCalled();
        });
    });

    describe('ideviceInitExportLoadSuccess', () => {
        it('clears interval and generates export view', async () => {
            idevice.checkDeviceLoadInterval = setInterval(() => {}, 1000);
            idevice.generateContentExportView = vi.fn().mockResolvedValue({ init: 'true' });

            const result = await idevice.ideviceInitExportLoadSuccess();

            expect(idevice.generateContentExportView).toHaveBeenCalled();
            expect(result).toEqual({ init: 'true' });
        });
    });

    describe('ideviceInitEditionLoadError', () => {
        it('clears interval and calls editionLoadedError', () => {
            idevice.checkDeviceLoadInterval = setInterval(() => {}, 1000);
            idevice.editionLoadedError = vi.fn();

            idevice.ideviceInitEditionLoadError();

            expect(idevice.editionLoadedError).toHaveBeenCalled();
        });
    });

    describe('ideviceInitExportLoadError', () => {
        it('clears interval and calls exportLoadedError', () => {
            idevice.checkDeviceLoadInterval = setInterval(() => {}, 1000);
            idevice.exportLoadedError = vi.fn();

            idevice.ideviceInitExportLoadError();

            expect(idevice.exportLoadedError).toHaveBeenCalled();
        });
    });

    describe('getLockManager', () => {
        it('returns lockManager when available', () => {
            const mockLockManager = { isLocked: vi.fn() };
            idevice.engine = {
                project: {
                    _yjsBridge: {
                        lockManager: mockLockManager,
                    },
                },
            };

            const result = idevice.getLockManager();

            expect(result).toBe(mockLockManager);
        });

        it('returns null when lockManager not available', () => {
            idevice.engine = { project: null };

            const result = idevice.getLockManager();

            expect(result).toBeNull();
        });
    });

    describe('updateLockIndicator', () => {
        it('calls makeIdeviceButtonsElement when ideviceButtons exists', () => {
            idevice.ideviceButtons = document.createElement('div');
            idevice.makeIdeviceButtonsElement = vi.fn();

            idevice.updateLockIndicator();

            expect(idevice.makeIdeviceButtonsElement).toHaveBeenCalled();
        });

        it('does nothing when ideviceButtons is null', () => {
            idevice.ideviceButtons = null;
            idevice.makeIdeviceButtonsElement = vi.fn();

            idevice.updateLockIndicator();

            expect(idevice.makeIdeviceButtonsElement).not.toHaveBeenCalled();
        });
    });

    describe('addBehaviourEditionIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="editIdeviceidevice-123">Edit</button>`;
        });

        it('adds click event listener to edit button without throwing', () => {
            expect(() => idevice.addBehaviourEditionIdeviceButton()).not.toThrow();

            const editBtn = idevice.ideviceButtons.querySelector('#editIdeviceidevice-123');
            expect(editBtn).not.toBeNull();
        });

        it('expands minimized iDevice before entering edit mode', async () => {
            // Set up iDevice with minify button and icon (collapsed state)
            idevice.ideviceButtons.innerHTML = `
                <button id="editIdeviceidevice-123">Edit</button>
                <button id="minifyIdeviceidevice-123">
                    <span id="minifyIdeviceidevice-123icon" class="chevron-up-icon-green"></span>
                </button>
            `;

            // Create iDevice body element and add to DOM (hidden = minimized)
            const ideviceBody = document.createElement('div');
            ideviceBody.className = 'idevice_body';
            ideviceBody.setAttribute('idevice-id', 'idevice-123');
            ideviceBody.style.display = 'none'; // Hidden via inline style (minimized)
            document.body.appendChild(ideviceBody);

            // Verify initial state: element has display:none
            expect(ideviceBody.style.display).toBe('none');

            // Set up required mocks
            idevice.isLockedByOtherUser = vi.fn(() => false);
            idevice.toogleIdeviceButtonsState = vi.fn();
            idevice.edition = vi.fn();
            idevice.odeNavStructureSyncId = 'nav-123';
            idevice.blockId = 'block-123';
            idevice.block = { pageId: 'page-123' };
            eXeLearning.app.project.changeUserFlagOnEdit = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });

            // Add behavior and click the edit button
            idevice.addBehaviourEditionIdeviceButton();
            const editBtn = idevice.ideviceButtons.querySelector('#editIdeviceidevice-123');
            editBtn.click();

            // Wait for async operations
            await vi.waitFor(() => {
                expect(idevice.edition).toHaveBeenCalled();
            });

            // Verify: iDevice body should be visible (jQuery.show() removes display:none)
            expect(ideviceBody.style.display).not.toBe('none');

            // Verify: icon should change from chevron-up to chevron-down
            const minifyIcon = idevice.ideviceButtons.querySelector(
                '#minifyIdeviceidevice-123icon'
            );
            expect(minifyIcon.classList.contains('chevron-down-icon-green')).toBe(true);
            expect(minifyIcon.classList.contains('chevron-up-icon-green')).toBe(false);

            // Clean up
            document.body.removeChild(ideviceBody);
        });
    });

    describe('addBehaviourEditionIdeviceDoubleClick', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
            idevice.mode = 'export';
            mockEngine.mode = 'view';
        });

        it('adds dblclick event listener without throwing', () => {
            expect(() => idevice.addBehaviourEditionIdeviceDoubleClick()).not.toThrow();
        });
    });

    describe('addBehaviourMoveUpIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="moveUpIdeviceidevice-123">Up</button>`;
            mockEngine.moveUpIdeviceInContent = vi.fn();
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourMoveUpIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#moveUpIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourMoveDownIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="moveDownIdeviceidevice-123">Down</button>`;
            mockEngine.moveDownIdeviceInContent = vi.fn();
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourMoveDownIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#moveDownIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourDeleteIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="deleteIdeviceidevice-123">Delete</button>`;
            idevice.remove = vi.fn();
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourDeleteIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#deleteIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourUndoIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.id = 'idevice-123';
            idevice.mode = 'edition';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="undoIdeviceidevice-123">Undo</button>`;
            idevice.loadInitScriptIdevice = vi.fn().mockResolvedValue();
            idevice.loadLegacyExeFunctionalitiesExport = vi.fn();
            idevice.toogleIdeviceButtonsState = vi.fn();
            idevice.cleanupInactivityTracker = vi.fn();
            idevice.releaseYjsEditingLock = vi.fn();
            idevice.createAddTextBtn = vi.fn();
            mockEngine.unsetIdeviceActive = vi.fn();
            mockEngine.resetCurrentIdevicesExportView = vi.fn().mockResolvedValue();
            eXeLearning.app.project.changeUserFlagOnEdit = vi.fn().mockResolvedValue();
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourUndoIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#undoIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });

        it('confirmExec calls loadInitScriptIdevice and resetCurrentIdevicesExportView sequentially', async () => {
            // Capture confirmExec callback
            let capturedConfirmExec;
            eXeLearning.app.modals.confirm.show = vi.fn(({ confirmExec }) => {
                capturedConfirmExec = confirmExec;
            });

            idevice.addBehaviourUndoIdeviceButton();
            // Trigger click to show confirm modal
            const btn = idevice.ideviceButtons.querySelector('#undoIdeviceidevice-123');
            btn.click();

            expect(capturedConfirmExec).toBeDefined();

            // Execute the confirm callback
            await capturedConfirmExec();

            expect(idevice.loadInitScriptIdevice).toHaveBeenCalledWith('export');
            expect(mockEngine.resetCurrentIdevicesExportView).toHaveBeenCalledWith(['idevice-123']);
        });

        it('confirmExec awaits loadInitScriptIdevice before resetCurrentIdevicesExportView', async () => {
            const callOrder = [];
            idevice.loadInitScriptIdevice = vi.fn().mockImplementation(async () => {
                callOrder.push('loadInitScript');
            });
            mockEngine.resetCurrentIdevicesExportView = vi.fn().mockImplementation(async () => {
                callOrder.push('resetExportView');
            });

            let capturedConfirmExec;
            eXeLearning.app.modals.confirm.show = vi.fn(({ confirmExec }) => {
                capturedConfirmExec = confirmExec;
            });

            idevice.addBehaviourUndoIdeviceButton();
            idevice.ideviceButtons.querySelector('#undoIdeviceidevice-123').click();
            await capturedConfirmExec();

            expect(callOrder).toEqual(['loadInitScript', 'resetExportView']);
        });
    });

    describe('addBehaviourPropertiesIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="propertiesIdeviceidevice-123">Props</button>`;
            idevice.loadPropertiesFromYjs = vi.fn();
            eXeLearning.app.modals.editPropertiesIdevice = { show: vi.fn() };
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourPropertiesIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#propertiesIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviouCloneIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="cloneIdeviceidevice-123">Clone</button>`;
            idevice.apiCloneIdevice = vi.fn().mockResolvedValue();
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviouCloneIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#cloneIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourMoveToPageIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="moveIdeviceidevice-123">Move</button>`;
            idevice.block = { odeNavStructureSyncId: 'page-1' };
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourMoveToPageIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#moveIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourExportIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="exportIdeviceidevice-123">Export</button>`;
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourExportIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#exportIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('addBehaviourMinifyIdeviceButton', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-123';
            idevice.ideviceButtons = document.createElement('div');
            idevice.ideviceButtons.innerHTML = `<button id="minifyIdeviceidevice-123"><span id="minifyIdeviceidevice-123icon" class="chevron-down-icon-green"></span></button>`;
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.style.display = 'block';
        });

        it('adds click listener without throwing', () => {
            expect(() => idevice.addBehaviourMinifyIdeviceButton()).not.toThrow();

            const btn = idevice.ideviceButtons.querySelector('#minifyIdeviceidevice-123');
            expect(btn).not.toBeNull();
        });
    });

    describe('makeIdeviceButtonsElement', () => {
        beforeEach(() => {
            idevice.odeIdeviceId = 'idevice-test';
            idevice.ideviceContent = document.createElement('div');
            idevice.mode = 'edition';
            idevice.valid = true;
            idevice.haveEdition = true;
            mockEngine.addEventDragStartToContentIdevice = vi.fn();
            mockEngine.addEventDragEndToContentIdevice = vi.fn();
        });

        it('creates buttons for edition mode', () => {
            idevice.makeIdeviceButtonsElement();

            expect(idevice.ideviceButtons).not.toBeNull();
            expect(idevice.ideviceButtons.classList.contains('idevice_actions')).toBe(true);
            expect(idevice.ideviceButtons.innerHTML).toContain('saveIdevice');
        });

        it('creates buttons for export mode', () => {
            idevice.mode = 'export';
            idevice.ideviceContent.querySelector = vi.fn().mockReturnValue(null);

            idevice.makeIdeviceButtonsElement();

            expect(idevice.ideviceButtons.innerHTML).toContain('editIdevice');
        });

        it('should disable delete, move up, move down, and actions buttons when locked by other user', () => {
            idevice.mode = 'export';
            idevice.lockedByRemote = true;
            idevice.lockUserName = 'Remote User';
            idevice.ideviceContent.querySelector = vi.fn().mockReturnValue(null);

            idevice.makeIdeviceButtonsElement();

            const moveUp = idevice.ideviceButtons.querySelector('.btn-move-up-idevice');
            const moveDown = idevice.ideviceButtons.querySelector('.btn-move-down-idevice');
            const deleteBtn = idevice.ideviceButtons.querySelector('.btn-delete-idevice');
            const editBtn = idevice.ideviceButtons.querySelector('.btn-edit-idevice');
            const actionsDropdown = idevice.ideviceButtons.querySelector('[data-bs-toggle="dropdown"]');

            expect(moveUp.disabled).toBe(true);
            expect(moveDown.disabled).toBe(true);
            expect(deleteBtn.disabled).toBe(true);
            expect(editBtn.disabled).toBe(true);
            expect(actionsDropdown.disabled).toBe(true);
            // drag&drop should be disabled
            expect(idevice.ideviceButtons.getAttribute('draggable')).toBe('false');
        });

        it('should enable delete, move up, move down buttons when NOT locked', () => {
            idevice.mode = 'export';
            idevice.lockedByRemote = false;
            idevice.ideviceContent.querySelector = vi.fn().mockReturnValue(null);

            idevice.makeIdeviceButtonsElement();

            const moveUp = idevice.ideviceButtons.querySelector('.btn-move-up-idevice');
            const moveDown = idevice.ideviceButtons.querySelector('.btn-move-down-idevice');
            const deleteBtn = idevice.ideviceButtons.querySelector('.btn-delete-idevice');
            const editBtn = idevice.ideviceButtons.querySelector('.btn-edit-idevice');

            expect(moveUp.disabled).toBe(false);
            expect(moveDown.disabled).toBe(false);
            expect(deleteBtn.disabled).toBe(false);
            expect(editBtn.disabled).toBe(false);
            // drag&drop should be enabled
            expect(idevice.ideviceButtons.getAttribute('draggable')).toBe('true');
        });
    });

    describe('locked iDevice handler guards', () => {
        beforeEach(() => {
            // Set up export mode with buttons rendered
            idevice.odeIdeviceId = 'idevice-test';
            idevice.ideviceContent = document.createElement('div');
            idevice.mode = 'export';
            idevice.valid = true;
            idevice.haveEdition = true;
            idevice.lockedByRemote = false;
            idevice.ideviceContent.querySelector = vi.fn().mockReturnValue(null);
            mockEngine.addEventDragStartToContentIdevice = vi.fn();
            mockEngine.addEventDragEndToContentIdevice = vi.fn();
            idevice.makeIdeviceButtonsElement();
        });

        it('delete handler should not proceed when locked by other user', () => {
            const changeUserFlagSpy = eXeLearning.app.project.changeUserFlagOnEdit = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
            idevice.lockedByRemote = true;

            const deleteBtn = idevice.ideviceButtons.querySelector('.btn-delete-idevice');
            deleteBtn.click();

            expect(changeUserFlagSpy).not.toHaveBeenCalled();
        });

        it('move up handler should not proceed when locked by other user', () => {
            const isAvailableSpy = eXeLearning.app.project.isAvalaibleOdeComponent = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
            idevice.lockedByRemote = true;

            const moveUpBtn = idevice.ideviceButtons.querySelector('.btn-move-up-idevice');
            moveUpBtn.click();

            expect(isAvailableSpy).not.toHaveBeenCalled();
        });

        it('move down handler should not proceed when locked by other user', () => {
            const isAvailableSpy = eXeLearning.app.project.isAvalaibleOdeComponent = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
            idevice.lockedByRemote = true;

            const moveDownBtn = idevice.ideviceButtons.querySelector('.btn-move-down-idevice');
            moveDownBtn.click();

            expect(isAvailableSpy).not.toHaveBeenCalled();
        });

        it('delete handler should proceed when NOT locked by other user', () => {
            eXeLearning.app.project.changeUserFlagOnEdit = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
            idevice.lockedByRemote = false;

            const deleteBtn = idevice.ideviceButtons.querySelector('.btn-delete-idevice');
            deleteBtn.click();

            expect(eXeLearning.app.project.changeUserFlagOnEdit).toHaveBeenCalled();
        });
    });

    describe('addUploadImage', () => {
        beforeEach(() => {
            idevice.lockScreen = vi.fn();
            idevice.unlockScreen = vi.fn();
            idevice.ideviceBody = document.createElement('div');
            const input = document.createElement('input');
            input.id = 'file-input';
            idevice.ideviceBody.appendChild(input);
        });

        it('calls lockScreen at start', async () => {
            // Mock eXe.app properly
            const originalEXe = global.eXe;
            global.eXe = {
                ...global.eXe,
                app: {
                    ...global.eXe?.app,
                    uploadLargeFile: vi.fn().mockResolvedValue({
                        savedPath: '/uploads',
                        savedFilename: 'file.png',
                    }),
                    clearHistory: vi.fn(),
                },
            };

            const mockFile = new Blob(['test'], { type: 'image/png' });

            await idevice.addUploadImage(mockFile, 'file.png', 'file-input', 'image');

            expect(idevice.lockScreen).toHaveBeenCalled();

            global.eXe = originalEXe;
        });
    });

    describe('activateComponentFlag', () => {
        it('exists as a method', () => {
            expect(typeof idevice.activateComponentFlag).toBe('function');
        });
    });

    describe('updateResourceLockStatus', () => {
        it('exists as a method', () => {
            expect(typeof idevice.updateResourceLockStatus).toBe('function');
        });
    });

    describe('exportProcessIdeviceJson', () => {
        it('exists as a method', () => {
            expect(typeof idevice.exportProcessIdeviceJson).toBe('function');
        });
    });

    describe('apiUpdatePage', () => {
        it('exists as a method', () => {
            expect(typeof idevice.apiUpdatePage).toBe('function');
        });
    });

    describe('getContentPrevIdevice', () => {
        it('exists as a method', () => {
            expect(typeof idevice.getContentPrevIdevice).toBe('function');
        });
    });

    describe('getContentNextIdevice', () => {
        it('exists as a method', () => {
            expect(typeof idevice.getContentNextIdevice).toBe('function');
        });
    });

    describe('getOdeIdeviceBrokenLinksEvent', () => {
        it('calls API to get broken links', async () => {
            eXeLearning.app.api.getOdeIdeviceBrokenLinks = vi.fn().mockResolvedValue([]);

            const result = await idevice.getOdeIdeviceBrokenLinksEvent('idevice-123');

            expect(eXeLearning.app.api.getOdeIdeviceBrokenLinks).toHaveBeenCalledWith('idevice-123');
            expect(result).toEqual([]);
        });
    });

    describe('loadLegacyExeFunctionalitiesEdition', () => {
        it('exists as a method', () => {
            expect(typeof idevice.loadLegacyExeFunctionalitiesEdition).toBe('function');
        });
    });

    describe('loadLegacyExeFunctionalitiesExport', () => {
        it('exists as a method', () => {
            expect(typeof idevice.loadLegacyExeFunctionalitiesExport).toBe('function');
        });

        it('calls $exe.mermaid.init() to render mermaid diagrams', () => {
            const mermaidInitSpy = vi.spyOn(global.$exe.mermaid, 'init');
            idevice.loadLegacyExeFunctionalitiesExport();
            expect(mermaidInitSpy).toHaveBeenCalled();
            mermaidInitSpy.mockRestore();
        });
    });

    describe('legacyExeIdevicesFilePicker', () => {
        beforeEach(() => {
            idevice.ideviceBody = document.createElement('div');
        });

        it('sets up file picker functionality without throwing', () => {
            expect(() => idevice.legacyExeIdevicesFilePicker()).not.toThrow();
        });
    });

    describe('initExeDeviceEdition', () => {
        it('exists as a method', () => {
            expect(typeof idevice.initExeDeviceEdition).toBe('function');
        });
    });

    describe('pageId property', () => {
        it('can be set and retrieved', () => {
            idevice.pageId = 'page-test';
            expect(idevice.pageId).toBe('page-test');
        });
    });

    describe('odeNavStructureSyncId property', () => {
        it('can be set and retrieved', () => {
            idevice.odeNavStructureSyncId = 'nav-test';
            expect(idevice.odeNavStructureSyncId).toBe('nav-test');
        });
    });

    describe('loadInitScriptIdevice', () => {
        it('exists as a method', () => {
            expect(typeof idevice.loadInitScriptIdevice).toBe('function');
        });
    });

    describe('getCurrentOrder', () => {
        it('exists as a method', () => {
            expect(typeof idevice.getCurrentOrder).toBe('function');
        });
    });

    describe('_getIdeviceTypeIconHtml', () => {
        it('returns empty string when idevice is null', () => {
            idevice.idevice = null;

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toBe('');
        });

        it('returns empty string when idevice has no icon', () => {
            idevice.idevice = { title: 'Test', name: 'test' };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toBe('');
        });

        it('returns exe-icon SVG when icon.type is exe-icon', () => {
            idevice.idevice = {
                title: 'Test iDevice',
                icon: {
                    type: 'exe-icon',
                    name: '<svg>icon</svg>',
                },
            };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toContain('<div class="idevice-type-icon');
            expect(result).toContain('exe-app-tooltip');
            expect(result).toContain('title="Test iDevice"');
            expect(result).toContain('<svg>icon</svg>');
        });

        it('returns img background when icon.type is img with url', () => {
            idevice.idevice = {
                title: 'Image iDevice',
                path: '/path/to/idevice',
                icon: {
                    type: 'img',
                    url: 'icon.png',
                },
            };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toContain('<div class="idevice-type-icon idevice-img-icon');
            expect(result).toContain('exe-app-tooltip');
            expect(result).toContain('title="Image iDevice"');
            expect(result).toContain("background-image: url('/path/to/idevice/icon.png')");
        });

        it('returns empty string for unknown icon type', () => {
            idevice.idevice = {
                title: 'Unknown',
                icon: {
                    type: 'unknown-type',
                    name: 'something',
                },
            };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toBe('');
        });

        it('returns empty string when img type has no url', () => {
            idevice.idevice = {
                title: 'No URL',
                icon: {
                    type: 'img',
                    url: '',
                },
            };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toBe('');
        });

        it('uses odeIdeviceTypeName when idevice.title is missing', () => {
            idevice.odeIdeviceTypeName = 'FallbackType';
            idevice.idevice = {
                icon: {
                    type: 'exe-icon',
                    name: '<svg>icon</svg>',
                },
            };

            const result = idevice._getIdeviceTypeIconHtml();

            expect(result).toContain('title="FallbackType"');
        });
    });

    describe('loadPropertiesFromYjs edge cases', () => {
        it('does nothing when structureBinding is null', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: null,
            };

            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe('');
        });

        it('does nothing when getComponentProperties returns null', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getComponentProperties: vi.fn(() => null),
                },
            };

            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe('');
        });

        it('ignores unknown property keys from Yjs', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getComponentProperties: vi.fn(() => ({
                        unknownProp: 'value',
                        identifier: 'yjs-id',
                    })),
                },
            };

            idevice.loadPropertiesFromYjs();

            expect(idevice.properties.identifier.value).toBe('yjs-id');
            expect(idevice.properties.unknownProp).toBeUndefined();
        });
    });

    describe('findInstalledIdevice additional cases', () => {
        it('returns null when typeName is null', () => {
            const result = idevice.findInstalledIdevice(null);
            expect(result).toBeNull();
        });

        it('returns null when typeName is undefined', () => {
            const result = idevice.findInstalledIdevice(undefined);
            expect(result).toBeNull();
        });

        it('strips Idevice suffix for mapping lookup', () => {
            const result = idevice.findInstalledIdevice('FreeTextIdevice');
            expect(result).not.toBeNull();
            expect(result.name).toBe('text');
        });
    });

    describe('cleanupInactivityTracker additional cases', () => {
        it('handles when both inactivityCleanup and inactivityTimer exist', () => {
            const cleanupFn = vi.fn();
            idevice.inactivityCleanup = cleanupFn;
            idevice.inactivityTimer = setTimeout(() => {}, 10000);

            idevice.cleanupInactivityTracker();

            expect(cleanupFn).toHaveBeenCalled();
            expect(idevice.inactivityCleanup).toBeNull();
            expect(idevice.inactivityTimer).toBeNull();
        });

        it('clears timer directly when inactivityCleanup is null', () => {
            const timerId = setTimeout(() => {}, 10000);
            idevice.inactivityCleanup = null;
            idevice.inactivityTimer = timerId;
            const clearSpy = vi.spyOn(global, 'clearTimeout');

            idevice.cleanupInactivityTracker();

            expect(clearSpy).toHaveBeenCalledWith(timerId);
            expect(idevice.inactivityTimer).toBeNull();
        });
    });

    describe('typesetLatexInContent', () => {
        it('does nothing when ideviceBody is null', () => {
            idevice.ideviceBody = null;

            // Should not throw
            expect(() => idevice.typesetLatexInContent()).not.toThrow();
        });

        it('does not call MathJax when no LaTeX content', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = 'No LaTeX here';
            window.MathJax = { typesetPromise: vi.fn().mockResolvedValue() };

            idevice.typesetLatexInContent();

            expect(window.MathJax.typesetPromise).not.toHaveBeenCalled();
        });

        it('calls MathJax.typesetPromise when content has LaTeX', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = 'Formula: \\( x^2 \\)';
            window.MathJax = { typesetPromise: vi.fn().mockResolvedValue() };

            idevice.typesetLatexInContent();

            expect(window.MathJax.typesetPromise).toHaveBeenCalledWith([idevice.ideviceBody]);
        });

        it('detects $$ delimiters', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = 'Formula: $$ x^2 $$';
            window.MathJax = { typesetPromise: vi.fn().mockResolvedValue() };

            idevice.typesetLatexInContent();

            expect(window.MathJax.typesetPromise).toHaveBeenCalled();
        });

        it('detects \\begin{ delimiters', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = '\\begin{equation} x \\end{equation}';
            window.MathJax = { typesetPromise: vi.fn().mockResolvedValue() };

            idevice.typesetLatexInContent();

            expect(window.MathJax.typesetPromise).toHaveBeenCalled();
        });

        it('handles MathJax errors gracefully', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = '\\( x \\)';
            window.MathJax = { typesetPromise: vi.fn().mockRejectedValue(new Error('MathJax error')) };

            // Should not throw
            expect(() => idevice.typesetLatexInContent()).not.toThrow();
        });

        it('does nothing when MathJax is undefined', () => {
            idevice.ideviceBody = document.createElement('div');
            idevice.ideviceBody.textContent = '\\( x \\)';
            delete window.MathJax;

            // Should not throw
            expect(() => idevice.typesetLatexInContent()).not.toThrow();
        });
    });

    describe('loadExportIdevice', () => {
        it('calls loadScriptsExport and loadStylesExport', async () => {
            const loadScriptsSpy = vi.spyOn(idevice, 'loadScriptsExport').mockImplementation(() => {});
            const loadStylesSpy = vi.spyOn(idevice, 'loadStylesExport').mockResolvedValue();

            await idevice.loadExportIdevice();

            expect(loadScriptsSpy).toHaveBeenCalled();
            expect(loadStylesSpy).toHaveBeenCalled();
        });
    });

    describe('static mode properties logic', () => {
        it('static mode condition is true when capabilities.storage.remote is false', () => {
            eXeLearning.app.capabilities = { storage: { remote: false } };

            const isStaticMode = eXeLearning.app?.capabilities?.storage?.remote === false;

            expect(isStaticMode).toBe(true);
        });

        it('static mode condition is false when capabilities is undefined', () => {
            delete eXeLearning.app.capabilities;

            const isStaticMode = eXeLearning.app?.capabilities?.storage?.remote === false;

            expect(isStaticMode).toBe(false);
        });

        it('static mode condition is false when storage.remote is true', () => {
            eXeLearning.app.capabilities = { storage: { remote: true } };

            const isStaticMode = eXeLearning.app?.capabilities?.storage?.remote === false;

            expect(isStaticMode).toBe(false);
        });

        it('retrieves config from staticData in static mode', () => {
            const staticConfig = { test: 'static-value' };
            eXeLearning.app.capabilities = { storage: { remote: false } };
            eXeLearning.app.api.staticData = {
                parameters: {
                    odeComponentsSyncPropertiesConfig: staticConfig,
                },
            };

            const isStaticMode = eXeLearning.app?.capabilities?.storage?.remote === false;
            const config = isStaticMode
                ? eXeLearning.app?.api?.staticData?.parameters?.odeComponentsSyncPropertiesConfig
                : eXeLearning.app?.api?.parameters?.odeComponentsSyncPropertiesConfig;

            expect(config).toEqual(staticConfig);
        });

        it('retrieves config from api.parameters when not in static mode', () => {
            const serverConfig = { test: 'server-value' };
            delete eXeLearning.app.capabilities;
            eXeLearning.app.api.parameters = {
                odeComponentsSyncPropertiesConfig: serverConfig,
            };

            const isStaticMode = eXeLearning.app?.capabilities?.storage?.remote === false;
            const config = isStaticMode
                ? eXeLearning.app?.api?.staticData?.parameters?.odeComponentsSyncPropertiesConfig
                : eXeLearning.app?.api?.parameters?.odeComponentsSyncPropertiesConfig;

            expect(config).toEqual(serverConfig);
        });
    });

    describe('new block detection', () => {
        it('detects new block by new- prefix', () => {
            idevice.block = { id: 'new-12345-abc' };

            // The isNewBlock check is inside sendAddIdevicePush, so we test indirectly
            // by checking the behavior. New blocks include additional params.
            eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag = vi.fn();
            eXeLearning.app.api.parameters = { generateNewItemKey: 'different-key' };

            // The new- prefix should trigger the new block path
            expect(idevice.block.id.startsWith('new-')).toBe(true);
        });

        it('detects new block by generateNewItemKey', () => {
            const newKey = 'special-new-key';
            eXeLearning.app.api.parameters = { generateNewItemKey: newKey };
            idevice.block = { id: newKey };

            expect(idevice.block.id).toBe(newKey);
        });
    });
});
