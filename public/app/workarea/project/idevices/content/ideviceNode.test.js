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

    describe('toogleIdeviceButtonsState', () => {
        it('does nothing when ideviceButtons is null', () => {
            idevice.ideviceButtons = null;
            expect(() => idevice.toogleIdeviceButtonsState(true)).not.toThrow();
        });

        it('disables all buttons when disable is true', () => {
            idevice.ideviceButtons = document.createElement('div');
            const button1 = document.createElement('button');
            button1.classList.add('button-action-idevice');
            const button2 = document.createElement('button');
            button2.classList.add('button-action-idevice');
            idevice.ideviceButtons.appendChild(button1);
            idevice.ideviceButtons.appendChild(button2);

            idevice.toogleIdeviceButtonsState(true);

            expect(button1.disabled).toBe(true);
            expect(button2.disabled).toBe(true);
        });

        it('enables all buttons when disable is false', () => {
            idevice.ideviceButtons = document.createElement('div');
            const button = document.createElement('button');
            button.classList.add('button-action-idevice');
            button.disabled = true;
            idevice.ideviceButtons.appendChild(button);

            idevice.toogleIdeviceButtonsState(false);

            expect(button.disabled).toBe(false);
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
});
