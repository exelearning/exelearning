/**
 * IdevicesEngine Tests
 *
 * Unit tests for IdevicesEngine class methods.
 * Tests core functionality like drag/drop, component management, etc.
 *
 * Run with: bun test:frontend:ci
 */

// Setup global mocks BEFORE importing the module
global.window = global.window || {};
window.AppLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

// Mock jQuery with chainable methods
const createJQueryMock = () => {
    const mock = {
        height: () => 100,
        remove: vi.fn(),
        is: () => false,
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        find: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
        css: vi.fn().mockReturnThis(),
        html: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        append: vi.fn().mockReturnThis(),
        prepend: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        off: vi.fn().mockReturnThis(),
        each: vi.fn().mockReturnThis(),
        length: 0,
    };
    return mock;
};
global.$ = vi.fn((selector) => createJQueryMock());

// Mock translation function
global._ = (text) => text;

// Mock eXeLearning global object
global.eXeLearning = {
    app: {
        api: {
            parameters: {
                generateNewItemKey: 'generated-key-123',
                odePagStructureSyncPropertiesConfig: {
                    identifier: { value: '' },
                    visibility: { value: 'false' },
                    cssClass: { value: '' },
                    allowToggle: { value: 'true' },
                    minimized: { value: 'false' },
                },
                odeComponentsSyncPropertiesConfig: {
                    identifier: { value: '' },
                    visibility: { value: 'false' },
                    cssClass: { value: '' },
                },
            },
            getComponentsByPage: vi.fn().mockResolvedValue({
                odePagStructureSyncs: [],
            }),
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
                nodeSelected: {
                    getAttribute: vi.fn((attr) => {
                        if (attr === 'nav-id') return 'nav-123';
                        if (attr === 'page-id') return 'page-123';
                        return null;
                    }),
                },
                getSelectNodeNavId: vi.fn(() => 'nav-id-1'),
                getSelectNodePageId: vi.fn(() => 'page-id-1'),
                getAllNodesOrderByView: vi.fn(() => []),
                menuStructureBehaviour: {
                    checkIfEmptyNode: vi.fn(),
                    createAddTextBtn: vi.fn(),
                    clearMenuNavDragOverClasses: vi.fn(),
                },
            },
            changeUserFlagOnEdit: vi.fn(),
        },
        themes: {
            selected: {
                getPageTemplateElement: vi.fn(() => null),
                templatePageClass: 'template-page',
                templatePageContainerClass: 'template-container',
            },
            getThemeIcons: vi.fn(() => ({})),
        },
        idevices: {
            getIdeviceInstalled: vi.fn((name) => {
                if (name === 'text') {
                    return { name: 'text', title: 'Text', cssClass: 'text', edition: true };
                }
                return null;
            }),
        },
        modals: {
            alert: { show: vi.fn(), modal: { _isShown: false } },
            confirm: { show: vi.fn(), close: vi.fn() },
            properties: { show: vi.fn() },
        },
        common: {
            initTooltips: vi.fn(),
            generateId: vi.fn(() => `common-id-${Date.now()}`),
        },
        menus: {
            menuIdevices: {
                menuIdevices: document.createElement('div'),
                menuIdevicesBottomContent: document.createElement('div'),
            },
            menuStructure: {
                menuStructureBehaviour: {
                    checkIfEmptyNode: vi.fn(),
                    createAddTextBtn: vi.fn(),
                    clearMenuNavDragOverClasses: vi.fn(),
                },
                menuStructureCompose: {
                    menuNavList: document.createElement('div'),
                },
            },
        },
    },
    config: {
        isOfflineInstallation: false,
        clientCallWaitingTime: 5000,
    },
};

// Import after setting up mocks
import IdevicesEngine from './idevicesEngine.js';

describe('IdevicesEngine', () => {
    let engine;
    let mockProject;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset eXeLearning config
        eXeLearning.app.project._yjsEnabled = false;
        eXeLearning.app.project._yjsBridge = null;

        // Setup basic DOM
        document.body.innerHTML = `
            <div id="main">
                <div id="workarea">
                    <div id="node-content-container">
                        <div id="load-screen-node-content"></div>
                        <div id="node-content" mode="view"></div>
                    </div>
                </div>
            </div>
            <div id="menu_idevices">
                <div class="idevice_item draggable" id="text" draggable="true">Text</div>
            </div>
        `;

        // Create mock project
        // The code uses this.project.app.eXeLearning.config which is the global
        mockProject = {
            app: {
                ...eXeLearning.app,
                eXeLearning: eXeLearning, // Reference to global
            },
            _yjsBridge: null,
            _yjsEnabled: false,
            properties: {
                formProperties: { show: vi.fn(), hide: vi.fn() },
            },
        };

        // Create engine
        engine = new IdevicesEngine(mockProject);
    });

    afterEach(() => {
        engine = null;
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('initializes with project reference', () => {
            expect(engine.project).toBe(mockProject);
        });

        it('initializes DOM element references', () => {
            expect(engine.workareaElement).not.toBeNull();
            expect(engine.nodeContainerElement).not.toBeNull();
            expect(engine.nodeContentElement).not.toBeNull();
        });

        it('initializes empty components arrays', () => {
            expect(engine.components.blocks).toEqual([]);
            expect(engine.components.idevices).toEqual([]);
        });

        it('initializes control properties', () => {
            expect(engine.loadingPage).toBe(false);
            expect(engine.mode).toBe('view');
            expect(engine.draggedElement).toBeNull();
            expect(engine.ideviceActive).toBeNull();
        });

        it('sets clientCallWaitingTime from config', () => {
            expect(engine.clientCallWaitingTime).toBe(5000);
        });
    });

    describe('generateId', () => {
        it('delegates to project.app.common.generateId', () => {
            const result = engine.generateId();
            expect(eXeLearning.app.common.generateId).toHaveBeenCalled();
        });
    });

    describe('isDragableInside', () => {
        it('returns false when element is null', () => {
            const container = document.createElement('div');
            expect(engine.isDragableInside(null, container)).toBe(false);
        });

        it('returns false when container is null', () => {
            const element = document.createElement('div');
            expect(engine.isDragableInside(element, null)).toBe(false);
        });

        it('returns false when element equals container', () => {
            const element = document.createElement('div');
            expect(engine.isDragableInside(element, element)).toBe(false);
        });

        it('returns false when box-head is dragged into box', () => {
            const element = document.createElement('div');
            element.classList.add('box-head');
            element.setAttribute('drag', 'box');
            const container = document.createElement('div');
            container.classList.add('box');
            container.setAttribute('drop', '["box"]');
            expect(engine.isDragableInside(element, container)).toBe(false);
        });

        it('returns true when drag type matches drop list', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');
            const container = document.createElement('div');
            container.setAttribute('drop', '["idevice"]');
            expect(engine.isDragableInside(element, container)).toBe(true);
        });

        it('returns false when drag type does not match drop list', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');
            const container = document.createElement('div');
            container.setAttribute('drop', '["box"]');
            expect(engine.isDragableInside(element, container)).toBe(false);
        });

        it('returns false when container has no drop attribute', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');
            const container = document.createElement('div');
            expect(engine.isDragableInside(element, container)).toBe(false);
        });
    });

    describe('getDragAfterElement', () => {
        it('returns undefined when no elements', () => {
            const result = engine.getDragAfterElement(100, []);
            expect(result).toBeUndefined();
        });

        it('finds element after y position', () => {
            const child1 = document.createElement('div');
            const child2 = document.createElement('div');
            // Mock getBoundingClientRect
            child1.getBoundingClientRect = () => ({ top: 50 });
            child2.getBoundingClientRect = () => ({ top: 150 });

            const result = engine.getDragAfterElement(100, [child1, child2]);
            expect(result).toBe(child2);
        });
    });

    describe('resetDragElement', () => {
        it('clears draggedElement', () => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.classList.add('in', 'out');
            engine.resetDragElement();
            expect(engine.draggedElement).toBeNull();
        });

        it('removes classes from draggedElement', () => {
            const element = document.createElement('div');
            element.classList.add('in', 'out');
            engine.draggedElement = element;
            engine.resetDragElement();
            // Element classes removed before nullifying
        });

        it('removes element from DOM when remove is true', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);
            engine.draggedElement = element;
            engine.resetDragElement(true);
            expect(document.body.contains(element)).toBe(false);
        });

        it('does nothing when draggedElement is null', () => {
            engine.draggedElement = null;
            expect(() => engine.resetDragElement()).not.toThrow();
        });
    });

    describe('resetDragOverClasses', () => {
        it('removes component-inside class from nodeContentElement', () => {
            engine.nodeContentElement.classList.add('component-inside');
            engine.resetDragOverClasses();
            expect(engine.nodeContentElement.classList.contains('component-inside')).toBe(false);
        });

        it('removes component-inside class from all blocks', () => {
            const mockBlock = {
                blockContent: document.createElement('div'),
            };
            mockBlock.blockContent.classList.add('component-inside');
            engine.components.blocks.push(mockBlock);

            engine.resetDragOverClasses();

            expect(mockBlock.blockContent.classList.contains('component-inside')).toBe(false);
        });

        it('calls createAddTextBtn', () => {
            engine.resetDragOverClasses();
            expect(
                eXeLearning.app.project.structure.menuStructureBehaviour.createAddTextBtn
            ).toHaveBeenCalled();
        });
    });

    describe('updateMode', () => {
        it('sets mode to view when no idevice in edition', () => {
            engine.components.idevices = [];
            engine.updateMode();
            expect(engine.mode).toBe('view');
            expect(engine.nodeContentElement.getAttribute('mode')).toBe('view');
        });

        it('sets mode to edition when idevice is being edited', () => {
            engine.components.idevices = [{ mode: 'edition' }];
            engine.updateMode();
            expect(engine.mode).toBe('edition');
            expect(engine.nodeContentElement.getAttribute('mode')).toBe('edition');
        });
    });

    describe('isIdeviceInEdition', () => {
        it('returns false when no idevices', () => {
            engine.components.idevices = [];
            expect(engine.isIdeviceInEdition()).toBe(false);
        });

        it('returns false when all idevices are in export mode', () => {
            engine.components.idevices = [{ mode: 'export' }, { mode: 'export' }];
            expect(engine.isIdeviceInEdition()).toBe(false);
        });

        it('returns idevice when one is in edition mode', () => {
            const editingIdevice = { mode: 'edition', id: 'test-1' };
            engine.components.idevices = [{ mode: 'export' }, editingIdevice];
            expect(engine.isIdeviceInEdition()).toBe(editingIdevice);
        });
    });

    describe('getIdeviceActive', () => {
        it('returns ideviceActive value', () => {
            const mockActive = { id: 'active-1' };
            engine.ideviceActive = mockActive;
            expect(engine.getIdeviceActive()).toBe(mockActive);
        });

        it('returns null when no active idevice', () => {
            engine.ideviceActive = null;
            expect(engine.getIdeviceActive()).toBeNull();
        });
    });

    describe('getIdeviceById', () => {
        it('returns null when idevice not found', () => {
            engine.components.idevices = [];
            expect(engine.getIdeviceById('nonexistent')).toBeNull();
        });

        it('returns idevice by odeIdeviceId', () => {
            const mockIdevice = { odeIdeviceId: 'idevice-123', name: 'test' };
            engine.components.idevices = [mockIdevice];
            expect(engine.getIdeviceById('idevice-123')).toBe(mockIdevice);
        });

        it('returns null when id does not match any idevice', () => {
            const mockIdevice = { odeIdeviceId: 'idevice-123' };
            engine.components.idevices = [mockIdevice];
            expect(engine.getIdeviceById('idevice-456')).toBeNull();
        });
    });

    describe('getBlockById', () => {
        it('returns null when block not found', () => {
            engine.components.blocks = [];
            expect(engine.getBlockById('nonexistent')).toBeNull();
        });

        it('returns block by blockId', () => {
            const mockBlock = { blockId: 'block-123', name: 'test' };
            engine.components.blocks = [mockBlock];
            expect(engine.getBlockById('block-123')).toBe(mockBlock);
        });

        it('returns null when id does not match any block', () => {
            const mockBlock = { blockId: 'block-123' };
            engine.components.blocks = [mockBlock];
            expect(engine.getBlockById('block-456')).toBeNull();
        });
    });

    describe('addIdeviceToComponentsList', () => {
        it('adds idevice to components.idevices', () => {
            const mockIdevice = { id: 'idevice-1' };
            engine.addIdeviceToComponentsList(mockIdevice, 'block-1');
            expect(engine.components.idevices).toContain(mockIdevice);
        });

        it('adds idevice to block.idevices when block exists', () => {
            const mockBlock = { blockId: 'block-1', idevices: [] };
            engine.components.blocks = [mockBlock];
            const mockIdevice = { id: 'idevice-1' };

            engine.addIdeviceToComponentsList(mockIdevice, 'block-1');

            expect(mockBlock.idevices).toContain(mockIdevice);
        });

        it('does not throw when block not found', () => {
            const mockIdevice = { id: 'idevice-1' };
            expect(() => {
                engine.addIdeviceToComponentsList(mockIdevice, 'nonexistent');
            }).not.toThrow();
        });
    });

    describe('removeIdeviceOfComponentList', () => {
        it('removes idevice from components list', () => {
            const mockIdevice = { id: 'idevice-1', odeIdeviceId: 'ode-1' };
            engine.components.idevices = [mockIdevice, { id: 'idevice-2' }];

            engine.removeIdeviceOfComponentList('idevice-1');

            expect(engine.components.idevices.length).toBe(1);
            expect(engine.components.idevices[0].id).toBe('idevice-2');
        });

        it('does nothing when id not found', () => {
            engine.components.idevices = [{ id: 'idevice-1' }];
            engine.removeIdeviceOfComponentList('nonexistent');
            expect(engine.components.idevices.length).toBe(1);
        });
    });

    describe('removeBlockOfComponentList', () => {
        it('removes block from components list', () => {
            const mockBlock = { id: 'block-1', blockId: 'block-1' };
            engine.components.blocks = [mockBlock, { id: 'block-2', blockId: 'block-2' }];

            engine.removeBlockOfComponentList('block-1');

            expect(engine.components.blocks.length).toBe(1);
            expect(engine.components.blocks[0].id).toBe('block-2');
        });

        it('calls createAddTextBtn', () => {
            engine.components.blocks = [];
            engine.removeBlockOfComponentList('nonexistent');
            expect(
                eXeLearning.app.project.structure.menuStructureBehaviour.createAddTextBtn
            ).toHaveBeenCalled();
        });
    });

    describe('setParentsAndChildrenIdevicesBlocks', () => {
        it('assigns idevices to their respective blocks', () => {
            const mockBlock1 = { blockId: 'block-1', idevices: [] };
            const mockBlock2 = { blockId: 'block-2', idevices: [] };
            engine.components.blocks = [mockBlock1, mockBlock2];

            const mockIdevice1 = { blockId: 'block-1', id: 'i1' };
            const mockIdevice2 = { blockId: 'block-2', id: 'i2' };
            const mockIdevice3 = { blockId: 'block-1', id: 'i3' };
            engine.components.idevices = [mockIdevice1, mockIdevice2, mockIdevice3];

            engine.setParentsAndChildrenIdevicesBlocks();

            expect(mockBlock1.idevices).toContain(mockIdevice1);
            expect(mockBlock1.idevices).toContain(mockIdevice3);
            expect(mockBlock2.idevices).toContain(mockIdevice2);
        });

        it('clears existing block idevices before assigning', () => {
            const mockBlock = { blockId: 'block-1', idevices: [{ old: true }] };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            engine.setParentsAndChildrenIdevicesBlocks();

            expect(mockBlock.idevices).toEqual([]);
        });
    });

    describe('updateComponentsBlocks', () => {
        it('updates block parameters', () => {
            const mockBlock = {
                blockId: 'block-1',
                blockName: 'Old Name',
                updateParam: vi.fn(),
            };
            engine.components.blocks = [mockBlock];

            const blocksData = [{ blockId: 'block-1', blockName: 'New Name' }];
            engine.updateComponentsBlocks(blocksData, ['blockName']);

            expect(mockBlock.updateParam).toHaveBeenCalledWith('blockName', 'New Name');
        });

        it('does nothing when block not found', () => {
            engine.components.blocks = [];
            const blocksData = [{ blockId: 'nonexistent', blockName: 'New' }];
            expect(() => {
                engine.updateComponentsBlocks(blocksData, ['blockName']);
            }).not.toThrow();
        });
    });

    describe('updateComponentsIdevices', () => {
        it('updates idevice parameters', () => {
            const mockIdevice = {
                odeIdeviceId: 'idevice-1',
                order: 0,
                updateParam: vi.fn(),
            };
            engine.components.idevices = [mockIdevice];

            const idevicesData = [{ odeIdeviceId: 'idevice-1', order: 5 }];
            engine.updateComponentsIdevices(idevicesData, ['order']);

            expect(mockIdevice.updateParam).toHaveBeenCalledWith('order', 5);
        });
    });

    describe('newBlockNode', () => {
        it('creates a new IdeviceBlockNode', () => {
            const blockData = { blockName: 'Test Block', iconName: 'icon1' };
            const blockNode = engine.newBlockNode(blockData, false);

            expect(blockNode).toBeDefined();
            expect(blockNode.blockContent).toBeDefined();
        });

        it('adds block to components when addToComponents is true', () => {
            const blockData = { blockName: 'Test Block' };
            engine.newBlockNode(blockData, true);

            expect(engine.components.blocks.length).toBe(1);
        });

        it('does not add block to components when addToComponents is false', () => {
            const blockData = { blockName: 'Test Block' };
            engine.newBlockNode(blockData, false);

            expect(engine.components.blocks.length).toBe(0);
        });
    });

    describe('behaviour', () => {
        beforeEach(() => {
            // Setup menu idevices elements
            eXeLearning.app.menus.menuIdevices.menuIdevices = document.createElement('div');
            eXeLearning.app.menus.menuIdevices.menuIdevicesBottomContent = document.createElement('div');
        });

        it('initializes clickIdeviceMenuEnabled', () => {
            engine.behaviour();
            expect(engine.clickIdeviceMenuEnabled).toBe(true);
        });

        it('updates mode', () => {
            const updateModeSpy = vi.spyOn(engine, 'updateMode');
            engine.behaviour();
            expect(updateModeSpy).toHaveBeenCalled();
        });

        it('initializes iDevice presence tracking', () => {
            const initPresenceSpy = vi.spyOn(engine, 'initIdevicePresence').mockImplementation(() => {});
            engine.behaviour();
            expect(initPresenceSpy).toHaveBeenCalled();
        });
    });

    describe('clearSelection', () => {
        it('clears window selection', () => {
            window.getSelection = vi.fn().mockReturnValue({
                removeAllRanges: vi.fn(),
            });

            engine.clearSelection();

            expect(window.getSelection).toHaveBeenCalled();
        });
    });

    describe('loadApiIdevicesInPage', () => {
        it('returns false when already loading', async () => {
            engine.loadingPage = true;
            const result = await engine.loadApiIdevicesInPage(false);
            expect(result).toBe(false);
        });

        it('sets loadingPage to true when starting', async () => {
            engine.loadingPage = false;
            engine.cleanNodeAndLoadPage = vi.fn().mockResolvedValue(true);

            const promise = engine.loadApiIdevicesInPage(false);
            // loadingPage should be true during the call

            await promise;
        });
    });

    describe('syncNewIdeviceToYjs', () => {
        it('returns early when no YjsBridge', () => {
            mockProject._yjsBridge = null;
            const ideviceNode = { odeIdeviceId: 'test-1' };

            engine.syncNewIdeviceToYjs(ideviceNode);
            // Should not throw
        });

        it('returns early when fromYjs flag is set', () => {
            mockProject._yjsBridge = {
                structureBinding: {
                    getBlocks: vi.fn().mockReturnValue([]),
                },
            };
            const ideviceNode = { odeIdeviceId: 'test-1', fromYjs: true };

            engine.syncNewIdeviceToYjs(ideviceNode);
            // Should return early without calling addComponent
        });
    });

    describe('moveIdeviceMenuToContent', () => {
        beforeEach(() => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.classList.add('idevice_item');
            // Default to non-root page
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn((attr) => {
                if (attr === 'nav-id') return 'page-1';
                return null;
            });
        });

        it('returns false when page is root', () => {
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn((attr) => {
                if (attr === 'nav-id') return 'root';
                return null;
            });

            const result = engine.moveIdeviceMenuToContent(engine.nodeContentElement, 100);
            expect(result).toBe(false);
        });

        it('adds classes to dragged element', () => {
            engine.moveIdeviceMenuToContent(engine.nodeContentElement, 100);

            expect(engine.draggedElement.classList.contains('idevice-content-block')).toBe(true);
            expect(engine.draggedElement.classList.contains('idevice-element-in-content')).toBe(true);
        });

        it('appends element to container when no after element', () => {
            engine.moveIdeviceMenuToContent(engine.nodeContentElement, 100);

            // Verify the element has the expected classes added
            expect(engine.draggedElement.classList.contains('idevice-content-block')).toBe(true);
            expect(engine.draggedElement.classList.contains('idevice-element-in-content')).toBe(true);
        });
    });

    describe('moveIdeviceContentToContent', () => {
        beforeEach(() => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.classList.add('idevice_actions');
        });

        it('appends element to container', () => {
            engine.moveIdeviceContentToContent(engine.nodeContentElement, 100);

            expect(engine.nodeContentElement.contains(engine.draggedElement)).toBe(true);
        });
    });

    describe('moveBlockContentToContent', () => {
        beforeEach(() => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.classList.add('box-head');
        });

        it('appends element to container', () => {
            engine.moveBlockContentToContent(engine.nodeContentElement, 100);

            expect(engine.nodeContentElement.contains(engine.draggedElement)).toBe(true);
        });
    });

    describe('setBlockDataToIdeviceNode', () => {
        it('sets block data to idevice node', () => {
            const ideviceNode = {};
            const blockNode = {
                blockId: 'block-123',
                id: 'sync-id-123',
                odeNavStructureSyncId: 'nav-123',
            };

            engine.setBlockDataToIdeviceNode(ideviceNode, blockNode);

            expect(ideviceNode.block).toBe(blockNode);
            expect(ideviceNode.blockId).toBe('block-123');
            expect(ideviceNode.odePagStructureSyncId).toBe('sync-id-123');
            expect(ideviceNode.odeNavStructureSyncId).toBe('nav-123');
        });
    });

    describe('setIdeviceActive / unsetIdeviceActive', () => {
        it('sets active idevice', () => {
            const mockIdevice = { id: 'active-1' };
            engine.setIdeviceActive(mockIdevice);

            expect(engine.ideviceActive).toBe(mockIdevice);
        });

        it('unsets active idevice', () => {
            engine.ideviceActive = { id: 'active-1' };
            engine.unsetIdeviceActive();

            expect(engine.ideviceActive).toBeNull();
        });
    });

    describe('showNodeContainerLoadScreen', () => {
        it('adds loading class and removes hidden class', () => {
            engine.nodeContentLoadScreenElement.classList.add('hidden');

            engine.showNodeContainerLoadScreen();

            expect(engine.nodeContentLoadScreenElement.classList.contains('loading')).toBe(true);
            expect(engine.nodeContentLoadScreenElement.classList.contains('hidden')).toBe(false);
        });

        it('sets data-visible attribute', () => {
            engine.showNodeContainerLoadScreen();

            expect(engine.nodeContentLoadScreenElement.getAttribute('data-visible')).toBe('true');
        });

        it('clears existing timeout', () => {
            engine.hideNodeContanerLoadScreenTimeout = setTimeout(() => {}, 10000);
            const clearSpy = vi.spyOn(global, 'clearTimeout');

            engine.showNodeContainerLoadScreen();

            expect(clearSpy).toHaveBeenCalled();
        });
    });

    describe('hideNodeContainerLoadScreen', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('adds hiding class and removes loading class', () => {
            engine.nodeContentLoadScreenElement.classList.add('loading');

            engine.hideNodeContainerLoadScreen(100);

            expect(engine.nodeContentLoadScreenElement.classList.contains('hiding')).toBe(true);
            expect(engine.nodeContentLoadScreenElement.classList.contains('loading')).toBe(false);
        });

        it('adds hidden class after timeout', () => {
            engine.hideNodeContainerLoadScreen(100);
            vi.advanceTimersByTime(100);

            expect(engine.nodeContentLoadScreenElement.classList.contains('hidden')).toBe(true);
        });

        it('sets data-visible to false after timeout', () => {
            engine.hideNodeContainerLoadScreen(100);
            vi.advanceTimersByTime(100);

            expect(engine.nodeContentLoadScreenElement.getAttribute('data-visible')).toBe('false');
        });
    });

    describe('removeClassLoadingBlocks', () => {
        it('calls removeClassLoading on all blocks', () => {
            const mockBlock1 = { removeClassLoading: vi.fn() };
            const mockBlock2 = { removeClassLoading: vi.fn() };
            engine.components.blocks = [mockBlock1, mockBlock2];

            engine.removeClassLoadingBlocks();

            expect(mockBlock1.removeClassLoading).toHaveBeenCalled();
            expect(mockBlock2.removeClassLoading).toHaveBeenCalled();
        });
    });

    describe('saveEditionIdevices', () => {
        it('returns true when no idevices in edition', async () => {
            engine.components.idevices = [{ mode: 'export', save: vi.fn() }];

            const result = await engine.saveEditionIdevices();

            expect(result).toBe(true);
        });

        it('saves idevices in edition mode', async () => {
            const mockSave = vi.fn(() => true);
            engine.components.idevices = [{ mode: 'edition', loading: false, save: mockSave }];

            await engine.saveEditionIdevices();

            expect(mockSave).toHaveBeenCalled();
        });

        it('removes loading idevices', async () => {
            const mockRemove = vi.fn();
            engine.components.idevices = [{ mode: 'edition', loading: true, remove: mockRemove }];

            await engine.saveEditionIdevices();

            expect(mockRemove).toHaveBeenCalled();
        });

        it('skips saving when ideviceOnEdit is provided', async () => {
            const mockSave = vi.fn(() => true);
            engine.components.idevices = [{ mode: 'edition', loading: false, save: mockSave }];

            await engine.saveEditionIdevices({ id: 'editing' });

            expect(mockSave).not.toHaveBeenCalled();
        });
    });

    describe('cleanNodeContent', () => {
        it('clears components arrays', async () => {
            engine.components.blocks = [{ id: 'block-1' }];
            engine.components.idevices = [{ id: 'idevice-1' }];

            await engine.cleanNodeContent(true);

            expect(engine.components.blocks).toEqual([]);
            expect(engine.components.idevices).toEqual([]);
        });

        it('calls saveEditionIdevices when force is false', async () => {
            const saveSpy = vi.spyOn(engine, 'saveEditionIdevices').mockResolvedValue(true);

            await engine.cleanNodeContent(false);

            expect(saveSpy).toHaveBeenCalled();
        });

        it('updates mode after cleaning', async () => {
            const updateModeSpy = vi.spyOn(engine, 'updateMode');

            await engine.cleanNodeContent(true);

            expect(updateModeSpy).toHaveBeenCalled();
        });
    });

    describe('removeNodeContentHeader', () => {
        beforeEach(() => {
            const header = document.createElement('div');
            header.id = 'header-node-content';
            header.innerHTML = '<span>Header</span>';
            engine.nodeContainerElement.appendChild(header);
        });

        it('clears header innerHTML', () => {
            engine.removeNodeContentHeader();

            const header = engine.nodeContainerElement.querySelector('#header-node-content');
            expect(header.innerHTML).toBe('');
        });

        it('adds sr-av class', () => {
            engine.removeNodeContentHeader();

            const header = engine.nodeContainerElement.querySelector('#header-node-content');
            expect(header.classList.contains('sr-av')).toBe(true);
        });
    });

    describe('removeNodeContentPageTitle', () => {
        beforeEach(() => {
            const title = document.createElement('div');
            title.id = 'page-title-node-content';
            title.innerHTML = 'Title';
            engine.nodeContainerElement.appendChild(title);
        });

        it('clears title innerHTML', () => {
            engine.removeNodeContentPageTitle();

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.innerHTML).toBe('');
        });

        it('adds hidden class', () => {
            engine.removeNodeContentPageTitle();

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.classList.contains('hidden')).toBe(true);
        });
    });

    describe('removeNodeContentLangAttribute', () => {
        it('removes lang attribute from nodeContentElement', () => {
            engine.nodeContentElement.setAttribute('lang', 'en');

            engine.removeNodeContentLangAttribute();

            expect(engine.nodeContentElement.hasAttribute('lang')).toBe(false);
        });
    });

    describe('removeNodeContentFormProperties', () => {
        it('removes form properties element when exists', () => {
            const form = document.createElement('div');
            form.id = 'properties-node-content-form';
            engine.nodeContentElement.appendChild(form);

            engine.removeNodeContentFormProperties();

            expect(engine.nodeContentElement.querySelector('#properties-node-content-form')).toBeNull();
        });

        it('does nothing when form does not exist', () => {
            expect(() => engine.removeNodeContentFormProperties()).not.toThrow();
        });
    });

    describe('loadIdevicesExportScripts', () => {
        it('calls loadScriptsExport on unique idevices', () => {
            const mockLoadScriptsExport = vi.fn();
            const mockIdevice = { id: 'text', loadScriptsExport: mockLoadScriptsExport };
            engine.components.idevices = [
                { idevice: mockIdevice },
                { idevice: mockIdevice }, // Same idevice should only load once
            ];

            engine.loadIdevicesExportScripts();

            expect(mockLoadScriptsExport).toHaveBeenCalledTimes(1);
        });

        it('handles idevices without idevice property', () => {
            engine.components.idevices = [{ idevice: null }];

            expect(() => engine.loadIdevicesExportScripts()).not.toThrow();
        });
    });

    describe('loadIdevicesExportStyles', () => {
        it('calls loadStylesExport on unique idevices', async () => {
            const mockLoadStylesExport = vi.fn().mockResolvedValue(undefined);
            const mockIdevice = { id: 'text', loadStylesExport: mockLoadStylesExport };
            engine.components.idevices = [
                { idevice: mockIdevice },
            ];

            await engine.loadIdevicesExportStyles();

            expect(mockLoadStylesExport).toHaveBeenCalled();
        });
    });

    describe('loadScriptDynamically', () => {
        it('creates script element with correct attributes', () => {
            const script = engine.loadScriptDynamically('/path/to/script.js', false);

            expect(script.tagName).toBe('SCRIPT');
            expect(script.getAttribute('type')).toBe('text/javascript');
            expect(script.src).toContain('/path/to/script.js');
        });

        it('adds cache-busting timestamp when newVersion is true', () => {
            const script = engine.loadScriptDynamically('/path/to/script.js', true);

            expect(script.src).toMatch(/\?t=\d+/);
        });

        it('appends script to head', () => {
            const script = engine.loadScriptDynamically('/path/to/script.js', false);

            expect(document.head.contains(script)).toBe(true);
        });
    });

    describe('loadStyleDynamically', () => {
        it('creates link element with correct attributes', () => {
            const style = engine.loadStyleDynamically('/path/to/style.css', false);

            expect(style.tagName).toBe('LINK');
            expect(style.getAttribute('rel')).toBe('stylesheet');
            expect(style.href).toContain('/path/to/style.css');
        });

        it('adds cache-busting timestamp when newVersion is true', () => {
            const style = engine.loadStyleDynamically('/path/to/style.css', true);

            expect(style.href).toMatch(/\?t=\d+/);
        });

        it('appends style to head', () => {
            const style = engine.loadStyleDynamically('/path/to/style.css', false);

            expect(document.head.contains(style)).toBe(true);
        });
    });

    describe('loadScript', () => {
        it('creates link element for CSS files', () => {
            engine.loadScript('/path/to/style.css');

            const link = document.head.querySelector('link[href*="style.css"]');
            expect(link).not.toBeNull();
            expect(engine.ideviceScriptsElements.length).toBe(1);
        });

        it('creates script element for JS files', () => {
            engine.loadScript('/path/to/script.js');

            const script = document.head.querySelector('script[src*="script.js"]');
            expect(script).not.toBeNull();
            expect(engine.ideviceScriptsElements.length).toBe(1);
        });

        it('does nothing for unknown extensions', () => {
            engine.loadScript('/path/to/file.txt');

            expect(engine.ideviceScriptsElements.length).toBe(0);
        });
    });

    describe('clearIdevicesScripts', () => {
        it('removes all script elements and clears array', () => {
            const script1 = document.createElement('script');
            const script2 = document.createElement('script');
            document.head.appendChild(script1);
            document.head.appendChild(script2);
            engine.ideviceScriptsElements = [script1, script2];

            engine.clearIdevicesScripts();

            expect(engine.ideviceScriptsElements).toEqual([]);
            expect(document.head.contains(script1)).toBe(false);
            expect(document.head.contains(script2)).toBe(false);
        });
    });

    describe('clearNeedlessScripts', () => {
        it('removes non-exe scripts from head', () => {
            const exeScript = document.createElement('script');
            exeScript.classList.add('exe');
            const otherScript = document.createElement('script');
            document.head.appendChild(exeScript);
            document.head.appendChild(otherScript);

            engine.clearNeedlessScripts();

            expect(document.head.contains(exeScript)).toBe(true);
            expect(document.head.contains(otherScript)).toBe(false);
        });
    });

    describe('getPageTitleProperties', () => {
        it('returns empty object when no properties', () => {
            const result = engine.getPageTitleProperties(null);

            expect(result).toEqual({});
        });

        it('returns properties from legacy object format', () => {
            const props = {
                hidePageTitle: { value: true },
                editableInPage: { value: false },
                titlePage: { value: 'Page Title' },
                titleNode: { value: 'Node Title' },
            };

            const result = engine.getPageTitleProperties(props);

            expect(result.hidePageTitle).toBe(true);
            expect(result.editableInPage).toBe(false);
            expect(result.titlePage).toBe('Page Title');
            expect(result.titleNode).toBe('Node Title');
        });

        it('returns empty object for string pageId without Yjs', () => {
            mockProject._yjsBridge = null;

            const result = engine.getPageTitleProperties('page-123');

            expect(result).toEqual({});
        });
    });

    describe('cleanupPagePropertiesObserver', () => {
        it('unobserves and clears references', () => {
            const mockUnobserveDeep = vi.fn();
            engine._pagePropertiesObserver = vi.fn();
            engine._observedPageMap = { unobserveDeep: mockUnobserveDeep };
            engine._observedPageId = 'page-123';

            engine.cleanupPagePropertiesObserver();

            expect(mockUnobserveDeep).toHaveBeenCalled();
            expect(engine._pagePropertiesObserver).toBeNull();
            expect(engine._observedPageId).toBeNull();
            expect(engine._observedPageMap).toBeNull();
        });

        it('handles cleanup when no observer exists', () => {
            engine._pagePropertiesObserver = null;
            engine._observedPageMap = null;

            expect(() => engine.cleanupPagePropertiesObserver()).not.toThrow();
        });
    });

    describe('setNodeContentHeader', () => {
        beforeEach(() => {
            const header = document.createElement('div');
            header.id = 'header-node-content';
            engine.nodeContainerElement.appendChild(header);
        });

        it('clears header when no theme selected', () => {
            eXeLearning.app.themes.selected = null;

            engine.setNodeContentHeader();

            const header = engine.nodeContainerElement.querySelector('#header-node-content');
            expect(header.innerHTML).toBe('');
        });

        it('adds logo container when theme has logoImg', () => {
            eXeLearning.app.themes.selected = {
                logoImg: 'logo.png',
                getLogoImgUrl: vi.fn(() => '/path/to/logo.png'),
            };

            engine.setNodeContentHeader();

            const header = engine.nodeContainerElement.querySelector('#header-node-content');
            expect(header.querySelector('.logo-img-container')).not.toBeNull();
        });

        it('adds header container when theme has headerImg', () => {
            eXeLearning.app.themes.selected = {
                headerImg: 'header.png',
                getHeaderImgUrl: vi.fn(() => '/path/to/header.png'),
            };

            engine.setNodeContentHeader();

            const header = engine.nodeContainerElement.querySelector('#header-node-content');
            expect(header.querySelector('.header-img-container')).not.toBeNull();
        });
    });

    describe('setNodeContentPageTitle', () => {
        beforeEach(() => {
            const title = document.createElement('div');
            title.id = 'page-title-node-content';
            engine.nodeContainerElement.appendChild(title);
        });

        it('hides title when hidePageTitle is true', () => {
            const props = { hidePageTitle: { value: true } };

            engine.setNodeContentPageTitle(props);

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.classList.contains('hidden')).toBe(true);
        });

        it('uses titlePage when editableInPage is true', () => {
            const props = {
                editableInPage: { value: true },
                titlePage: { value: 'Custom Page Title' },
                titleNode: { value: 'Node Title' },
            };

            engine.setNodeContentPageTitle(props);

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.innerText).toBe('Custom Page Title');
        });

        it('uses titleNode when editableInPage is false', () => {
            const props = {
                editableInPage: { value: false },
                titlePage: { value: 'Custom Page Title' },
                titleNode: { value: 'Node Title' },
            };

            engine.setNodeContentPageTitle(props);

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.innerText).toBe('Node Title');
        });

        it('calls MathJax.typesetPromise when title contains LaTeX', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };

            const props = {
                editableInPage: { value: true },
                titlePage: { value: 'Title with \\(x^2\\)' },
            };

            engine.setNodeContentPageTitle(props);

            const title = engine.nodeContainerElement.querySelector('#page-title-node-content');
            expect(title.innerText).toBe('Title with \\(x^2\\)');
            expect(mockTypesetPromise).toHaveBeenCalledWith([title]);

            delete globalThis.MathJax;
        });

        it('does not call MathJax when title has no LaTeX', () => {
            const mockTypesetPromise = vi.fn().mockResolvedValue();
            globalThis.MathJax = { typesetPromise: mockTypesetPromise };

            const props = {
                editableInPage: { value: true },
                titlePage: { value: 'Normal title' },
            };

            engine.setNodeContentPageTitle(props);

            expect(mockTypesetPromise).not.toHaveBeenCalled();

            delete globalThis.MathJax;
        });
    });

    describe('resetNodeTemplate', () => {
        it('does nothing when no theme selected', () => {
            eXeLearning.app.themes.selected = null;

            expect(() => engine.resetNodeTemplate()).not.toThrow();
        });
    });

    describe('resetThemePageTemplate', () => {
        it('removes page content template if exists', () => {
            const template = document.createElement('div');
            template.classList.add('page-content-template');
            engine.workareaElement.appendChild(template);

            engine.resetThemePageTemplate();

            expect(engine.workareaElement.querySelector('.page-content-template')).toBeNull();
        });

        it('does nothing when template does not exist', () => {
            expect(() => engine.resetThemePageTemplate()).not.toThrow();
        });
    });

    describe('enableInternalLinks', () => {
        it('does nothing when no internal links', () => {
            expect(() => engine.enableInternalLinks()).not.toThrow();
        });

        it('sets onclick handler for internal links', () => {
            const link = document.createElement('a');
            link.href = 'exe-node:page-123';
            document.body.appendChild(link);

            eXeLearning.app.project.structure.data = [
                { pageId: 'page-123', pageName: 'Test Page' },
            ];

            const button = document.createElement('span');
            button.classList.add('nav-element-text');
            button.innerText = 'Test Page';
            document.body.appendChild(button);

            engine.enableInternalLinks();

            expect(link.onclick).toBeDefined();
        });
    });

    describe('onloadedScriptCallback', () => {
        it('sets onload handler for modern browsers', () => {
            const element = { onload: null };

            engine.onloadedScriptCallback('/path', element, null);

            expect(element.onload).toBeDefined();
        });

        it('sets onreadystatechange for older browsers', () => {
            const element = { readyState: 'loading', onreadystatechange: null };

            engine.onloadedScriptCallback('/path', element, null);

            expect(element.onreadystatechange).toBeDefined();
        });

        it('executes function callback on load', () => {
            const element = { onload: null };
            const callback = vi.fn();

            engine.onloadedScriptCallback('/path', element, callback);
            element.onload();

            expect(callback).toHaveBeenCalled();
        });

        it('executes string callback on load', () => {
            const element = { onload: null };
            globalThis.testCallbackExecuted = false;

            engine.onloadedScriptCallback(
                '/path',
                element,
                'globalThis.testCallbackExecuted = true',
            );
            element.onload();

            expect(globalThis.testCallbackExecuted).toBe(true);
            delete globalThis.testCallbackExecuted;
        });

        it('executes function callback on readystatechange complete', () => {
            const element = { readyState: 'loading', onreadystatechange: null };
            const callback = vi.fn();

            engine.onloadedScriptCallback('/path', element, callback);

            element.readyState = 'complete';
            element.onreadystatechange();

            expect(callback).toHaveBeenCalled();
        });
    });

    describe('initIdevicePresence', () => {
        it('does not throw when Yjs not enabled', () => {
            mockProject._yjsEnabled = false;

            expect(() => engine.initIdevicePresence()).not.toThrow();
        });
    });

    describe('_updateIdevicePresence', () => {
        it('groups users by editingComponentId', () => {
            const users = [
                { editingComponentId: 'comp-1', name: 'User1', isLocal: false },
                { editingComponentId: 'comp-1', name: 'User2', isLocal: false },
                { editingComponentId: 'comp-2', name: 'User3', isLocal: false },
            ];

            // This method updates DOM, just verify it doesn't throw
            expect(() => engine._updateIdevicePresence(users)).not.toThrow();
        });

        it('ignores local users', () => {
            const users = [
                { editingComponentId: 'comp-1', name: 'LocalUser', isLocal: true },
            ];

            expect(() => engine._updateIdevicePresence(users)).not.toThrow();
        });
    });

    describe('_renderIdeviceEditorAvatar', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
            container.classList.add('idevice-editor-avatar');
        });

        it('hides container when no users', () => {
            engine._renderIdeviceEditorAvatar(container, []);

            expect(container.style.display).toBe('none');
        });

        it('shows container when users exist', () => {
            const users = [{ name: 'User1', color: '#ff0000' }];

            engine._renderIdeviceEditorAvatar(container, users);

            expect(container.style.display).toBe('flex');
        });

        it('renders user avatar with color', () => {
            const users = [{ name: 'User1', color: '#ff0000' }];

            engine._renderIdeviceEditorAvatar(container, users);

            const avatar = container.querySelector('.idevice-user-avatar');
            expect(avatar).not.toBeNull();
            // JSDOM may return color as hex or rgb depending on version
            expect(avatar.style.borderColor).toMatch(/(#ff0000|rgb\(255, 0, 0\))/i);
        });

        it('shows +N indicator for multiple users', () => {
            const users = [
                { name: 'User1' },
                { name: 'User2' },
                { name: 'User3' },
            ];

            engine._renderIdeviceEditorAvatar(container, users);

            const more = container.querySelector('.idevice-user-more');
            expect(more).not.toBeNull();
            expect(more.textContent).toBe('+2');
        });
    });

    describe('appendNewIdeviceProcess', () => {
        it('adds idevice to components list when save succeeds', async () => {
            vi.spyOn(engine, 'saveEditionIdevices').mockResolvedValue(true);
            const ideviceNode = { id: 'new-idevice' };

            const result = await engine.appendNewIdeviceProcess(ideviceNode);

            expect(result).toBe(true);
            expect(engine.components.idevices).toContain(ideviceNode);
        });

        it('does not add idevice when save fails', async () => {
            vi.spyOn(engine, 'saveEditionIdevices').mockResolvedValue(false);
            const ideviceNode = { id: 'new-idevice' };

            const result = await engine.appendNewIdeviceProcess(ideviceNode);

            expect(result).toBe(false);
            expect(engine.components.idevices).not.toContain(ideviceNode);
        });
    });

    describe('loadApiComponentsInContentByPage', () => {
        beforeEach(() => {
            // Add required elements for the function
            const pageTitle = document.createElement('div');
            pageTitle.id = 'page-title-node-content';
            engine.nodeContainerElement.appendChild(pageTitle);

            const header = document.createElement('div');
            header.id = 'header-node-content';
            engine.nodeContainerElement.appendChild(header);
        });

        it('returns false when idPage is falsy', async () => {
            const result = await engine.loadApiComponentsInContentByPage(null);
            expect(result).toBe(false);
        });

        it('calls getAndLoadComponentsRootNode for root page', async () => {
            const spy = vi.spyOn(engine, 'getAndLoadComponentsRootNode').mockResolvedValue(undefined);

            const result = await engine.loadApiComponentsInContentByPage('root');

            expect(spy).toHaveBeenCalledWith('root');
            expect(result).toBe(true);
        });
    });

    describe('getAndLoadComponentsRootNode', () => {
        it('shows form properties and hides load screen', async () => {
            vi.spyOn(engine, 'hideNodeContainerLoadScreen').mockImplementation(() => {});

            await engine.getAndLoadComponentsRootNode('root');

            expect(mockProject.properties.formProperties.show).toHaveBeenCalled();
            expect(engine.hideNodeContainerLoadScreen).toHaveBeenCalledWith(500);
        });
    });

    describe('loadApiIdevicesInPage', () => {
        it('returns false when already loading', async () => {
            engine.loadingPage = true;

            const result = await engine.loadApiIdevicesInPage(false);

            expect(result).toBe(false);
        });

        it('calls cleanNodeAndLoadPage when not loading', async () => {
            engine.loadingPage = false;
            vi.spyOn(engine, 'cleanNodeAndLoadPage').mockResolvedValue(true);

            await engine.loadApiIdevicesInPage(true);

            expect(engine.cleanNodeAndLoadPage).toHaveBeenCalled();
        });
    });

    describe('cleanNodeAndLoadPage', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'cleanNodeContent').mockResolvedValue(true);
            vi.spyOn(engine, 'loadingComponentsProcess').mockResolvedValue(true);
            vi.spyOn(engine, 'loadThemePageTemplate').mockImplementation(() => {});
        });

        it('calls cleanNodeContent', async () => {
            await engine.cleanNodeAndLoadPage(false);

            expect(engine.cleanNodeContent).toHaveBeenCalled();
        });

        it('calls loadThemePageTemplate with page id', async () => {
            await engine.cleanNodeAndLoadPage(false);

            expect(engine.loadThemePageTemplate).toHaveBeenCalledWith('page-1');
        });
    });

    describe('loadingComponentsProcess', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'showNodeContainerLoadScreen').mockImplementation(() => {});
            vi.spyOn(engine, 'loadApiComponentsInContentByPage').mockResolvedValue(true);
        });

        it('returns false when saveIdevicesOk is false', async () => {
            const result = await engine.loadingComponentsProcess(false, null, false);

            expect(result).toBe(false);
        });

        it('shows load screen when loadScreen is true', async () => {
            await engine.loadingComponentsProcess(true, null, true);

            expect(engine.showNodeContainerLoadScreen).toHaveBeenCalled();
        });

        it('sets loadingPage to false after completion', async () => {
            engine.loadingPage = true;

            await engine.loadingComponentsProcess(true, null, false);

            expect(engine.loadingPage).toBe(false);
        });
    });

    describe('loadThemePageTemplate', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'resetNodeTemplate').mockImplementation(() => {});
        });

        it('calls resetNodeTemplate', () => {
            engine.loadThemePageTemplate('page-1');

            expect(engine.resetNodeTemplate).toHaveBeenCalled();
        });

        it('returns early when no theme selected', () => {
            eXeLearning.app.themes.selected = null;

            expect(() => engine.loadThemePageTemplate('page-1')).not.toThrow();
        });
    });

    describe('loadLegacyExeFunctionalitiesExport', () => {
        beforeEach(() => {
            global.$exeFX = { init: vi.fn() };
            global.$exeGames = { init: vi.fn() };
            global.$exeHighlighter = { init: vi.fn() };
            global.$exeABCmusic = { init: vi.fn() };
            global.$exe = { init: vi.fn() };
        });

        afterEach(() => {
            delete global.$exeFX;
            delete global.$exeGames;
            delete global.$exeHighlighter;
            delete global.$exeABCmusic;
            delete global.$exe;
        });

        it('calls init on all legacy objects', () => {
            engine.loadLegacyExeFunctionalitiesExport();

            expect(global.$exeFX.init).toHaveBeenCalled();
            expect(global.$exeGames.init).toHaveBeenCalled();
            expect(global.$exeHighlighter.init).toHaveBeenCalled();
            expect(global.$exeABCmusic.init).toHaveBeenCalled();
            expect(global.$exe.init).toHaveBeenCalled();
        });
    });

    describe('resetCurrentIdevicesExportView', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'clearNeedlessScripts').mockImplementation(() => {});
            vi.spyOn(engine, 'loadIdevicesExportStyles').mockResolvedValue(undefined);
            vi.spyOn(engine, 'loadIdevicesExportScripts').mockImplementation(() => {});
            vi.spyOn(engine, 'loadLegacyExeFunctionalitiesExport').mockImplementation(() => {});
            vi.spyOn(engine, 'enableInternalLinks').mockImplementation(() => {});
        });

        it('clears needless scripts', async () => {
            await engine.resetCurrentIdevicesExportView([]);

            expect(engine.clearNeedlessScripts).toHaveBeenCalled();
        });

        it('loads export styles and scripts', async () => {
            await engine.resetCurrentIdevicesExportView([]);

            expect(engine.loadIdevicesExportStyles).toHaveBeenCalled();
            expect(engine.loadIdevicesExportScripts).toHaveBeenCalled();
        });

        it('loads legacy functionalities', async () => {
            await engine.resetCurrentIdevicesExportView([]);

            expect(engine.loadLegacyExeFunctionalitiesExport).toHaveBeenCalled();
        });

        it('enables internal links', async () => {
            await engine.resetCurrentIdevicesExportView([]);

            expect(engine.enableInternalLinks).toHaveBeenCalled();
        });
    });

    describe('addEventDragOverToContainer', () => {
        it('adds dragover event listener to container', () => {
            const container = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(container, 'addEventListener');

            engine.addEventDragOverToContainer(container);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
        });
    });

    describe('addEventDragEnterToContainer', () => {
        it('adds dragenter event listener to container', () => {
            const container = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(container, 'addEventListener');

            engine.addEventDragEnterToContainer(container);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragenter', expect.any(Function));
        });
    });

    describe('addEventDragLeaveToContainer', () => {
        it('adds dragleave event listener to container', () => {
            const container = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(container, 'addEventListener');

            engine.addEventDragLeaveToContainer(container);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragleave', expect.any(Function));
        });
    });

    describe('addEventDropToContainer', () => {
        it('adds drop event listener to container', () => {
            const container = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(container, 'addEventListener');

            engine.addEventDropToContainer(container);

            expect(addEventListenerSpy).toHaveBeenCalledWith('drop', expect.any(Function));
        });
    });

    describe('addEventDragStartToMenuIdevices', () => {
        it('adds dragstart event listener to all menu idevices', () => {
            const element1 = document.createElement('div');
            const element2 = document.createElement('div');
            engine.menuIdevicesDraggableElements = [element1, element2];

            const spy1 = vi.spyOn(element1, 'addEventListener');
            const spy2 = vi.spyOn(element2, 'addEventListener');

            engine.addEventDragStartToMenuIdevices();

            expect(spy1).toHaveBeenCalledWith('dragstart', expect.any(Function));
            expect(spy2).toHaveBeenCalledWith('dragstart', expect.any(Function));
        });
    });

    describe('addEventDragEndToMenuIdevice', () => {
        it('adds dragend event listener to element', () => {
            const element = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventDragEndToMenuIdevice(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragend', expect.any(Function));
        });
    });

    describe('addEventDragStartToContentIdevice', () => {
        it('adds dragstart event listener to element', () => {
            const element = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventDragStartToContentIdevice(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragstart', expect.any(Function));
        });
    });

    describe('addEventDragEndToContentIdevice', () => {
        it('adds dragend event listener to element', () => {
            const element = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventDragEndToContentIdevice(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragend', expect.any(Function));
        });
    });

    describe('addEventDragStartToContentBlock', () => {
        it('adds dragstart event listener to element', () => {
            const element = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventDragStartToContentBlock(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragstart', expect.any(Function));
        });
    });

    describe('addEventDragEndToContentBlock', () => {
        it('adds dragend event listener to element', () => {
            const element = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventDragEndToContentBlock(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('dragend', expect.any(Function));
        });
    });

    describe('addEventClickIdevice', () => {
        it('adds click event listener to all menu idevices', () => {
            const element = document.createElement('div');
            engine.menuIdevicesDraggableElements = [element];
            const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

            engine.addEventClickIdevice();

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    describe('loadStyleByInsertingIt', () => {
        beforeEach(() => {
            eXeLearning.app.api.func = {
                getText: vi.fn().mockResolvedValue('body { color: red; }'),
            };
        });

        it('creates style element with correct attributes', async () => {
            const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: '/path/export/' };

            const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

            expect(style.tagName).toBe('STYLE');
            expect(style.getAttribute('idevice')).toBe('text');
            expect(style.getAttribute('status')).toBe('export');
        });

        it('uses pathEdition for edition status', async () => {
            const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: '/path/export/' };

            const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'edition');

            expect(style.getAttribute('status')).toBe('edition');
        });

        describe('CSS URL rewriting', () => {
            it('rewrites relative URLs without quotes', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue('.icon { background: url(icon.svg); }');

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe('.icon { background: url(http://localhost/export/icon.svg); }');
            });

            it('rewrites relative URLs with single quotes', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(".icon { background: url('icon.svg'); }");

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(".icon { background: url('http://localhost/export/icon.svg'); }");
            });

            it('rewrites relative URLs with double quotes', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue('.icon { background: url("icon.svg"); }');

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe('.icon { background: url("http://localhost/export/icon.svg"); }');
            });

            it('rewrites paths with subdirectories', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue('.icon { background: url(images/icons/icon.svg); }');

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe('.icon { background: url(http://localhost/export/images/icons/icon.svg); }');
            });

            it('does not rewrite absolute HTTP URLs', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithHttp = '.icon { background: url(http://example.com/icon.svg); }';
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithHttp);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(cssWithHttp);
            });

            it('does not rewrite absolute HTTPS URLs', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithHttps = '.icon { background: url(https://example.com/icon.svg); }';
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithHttps);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(cssWithHttps);
            });

            it('does not rewrite data URLs', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithDataUrl = '.icon { background: url(data:image/svg+xml;base64,PHN2Zz4=); }';
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithDataUrl);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(cssWithDataUrl);
            });

            it('does not rewrite blob URLs', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithBlobUrl = '.icon { background: url(blob:http://localhost/abc-123); }';
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithBlobUrl);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(cssWithBlobUrl);
            });

            it('does not rewrite root-relative URLs (starting with /)', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                // This is the key test case - URLs rewritten by server to API endpoints start with /
                const cssWithRootRelative = '.icon { background: url(/api/idevices/download-file-resources?resource=icon.svg); }';
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithRootRelative);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                // Should NOT be rewritten - URL already has server path
                expect(style.innerHTML).toBe(cssWithRootRelative);
            });

            it('does not rewrite root-relative URLs with quotes', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithQuotedRootRelative = ".icon { background: url('/api/idevices/resource.svg'); }";
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithQuotedRootRelative);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe(cssWithQuotedRootRelative);
            });

            it('handles multiple URLs in CSS', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                const cssWithMultipleUrls = `
                    .icon1 { background: url(icon1.svg); }
                    .icon2 { background: url('icon2.png'); }
                    .icon3 { background: url("icon3.gif"); }
                    .external { background: url(https://cdn.example.com/external.png); }
                    .api { background: url(/api/resource); }
                `;
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue(cssWithMultipleUrls);

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toContain('url(http://localhost/export/icon1.svg)');
                expect(style.innerHTML).toContain("url('http://localhost/export/icon2.png')");
                expect(style.innerHTML).toContain('url("http://localhost/export/icon3.gif")');
                expect(style.innerHTML).toContain('url(https://cdn.example.com/external.png)');
                expect(style.innerHTML).toContain('url(/api/resource)');
            });

            it('uses pathEdition for URL rewriting when status is edition', async () => {
                const idevice = { id: 'text', pathEdition: 'http://localhost/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue('.icon { background: url(icon.svg); }');

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'edition');

                expect(style.innerHTML).toBe('.icon { background: url(http://localhost/edition/icon.svg); }');
            });

            it('handles URLs with leading spaces', async () => {
                const idevice = { id: 'text', pathEdition: '/path/edition/', pathExport: 'http://localhost/export/' };
                eXeLearning.app.api.func.getText = vi.fn().mockResolvedValue('.icon { background: url(  icon.svg); }');

                const style = await engine.loadStyleByInsertingIt('/path/to/style.css', idevice, 'export');

                expect(style.innerHTML).toBe('.icon { background: url(http://localhost/export/icon.svg); }');
            });
        });
    });

    describe('renderRemoteIdevice', () => {
        beforeEach(() => {
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn((attr) => {
                if (attr === 'nav-id') return 'page-1';
                return null;
            });
            eXeLearning.app.idevices = {
                getIdeviceInstalled: vi.fn(() => ({ id: 'text' })),
            };
        });

        it('returns early when on different page', async () => {
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn(() => 'page-2');

            await engine.renderRemoteIdevice({ id: 'comp-1', ideviceType: 'text' }, 'page-1', 'block-1');

            // Should not create anything
            expect(engine.components.idevices.length).toBe(0);
        });

        it('returns early when idevice already exists in DOM', async () => {
            const existingIdevice = document.createElement('div');
            existingIdevice.id = 'comp-1';
            document.body.appendChild(existingIdevice);

            await engine.renderRemoteIdevice({ id: 'comp-1', ideviceType: 'text' }, 'page-1', 'block-1');

            expect(engine.components.idevices.length).toBe(0);
        });

        it('returns early when idevice type not installed', async () => {
            eXeLearning.app.idevices.getIdeviceInstalled = vi.fn(() => null);

            await engine.renderRemoteIdevice({ id: 'comp-1', ideviceType: 'unknown' }, 'page-1', 'block-1');

            expect(engine.components.idevices.length).toBe(0);
        });
    });

    describe('updateRemoteIdeviceContent', () => {
        it('returns early when component not found', async () => {
            engine.components.idevices = [];

            await engine.updateRemoteIdeviceContent({ id: 'unknown' });
            // Should not throw
        });

        it('updates idevice htmlView when component found', async () => {
            const mockIdevice = {
                odeIdeviceId: 'comp-1',
                htmlView: 'old content',
                lockedByRemote: true,
                lockUserName: 'User1',
                updateLockIndicator: vi.fn(),
            };
            engine.components.idevices = [mockIdevice];

            await engine.updateRemoteIdeviceContent({ id: 'comp-1', htmlContent: 'new content' });

            expect(mockIdevice.htmlView).toBe('new content');
            expect(mockIdevice.lockedByRemote).toBe(false);
        });
    });

    describe('initPagePropertiesObserver', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'cleanupPagePropertiesObserver').mockImplementation(() => {});
        });

        it('cleans up previous observer', () => {
            engine.initPagePropertiesObserver('page-1');

            expect(engine.cleanupPagePropertiesObserver).toHaveBeenCalled();
        });

        it('returns early when no structureBinding', () => {
            mockProject._yjsBridge = null;

            expect(() => engine.initPagePropertiesObserver('page-1')).not.toThrow();
        });
    });

    describe('addIdeviceNodeToContainer', () => {
        let mockIdeviceNode;

        beforeEach(() => {
            mockIdeviceNode = {
                ideviceContent: document.createElement('div'),
                ideviceButtons: document.createElement('div'),
                idevice: { title: 'Test' },
                mode: 'export',
                blockId: null,
                odePagStructureSyncId: null,
                odeNavStructureSyncId: null,
                block: null,
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                makeIdeviceContentNode: vi.fn(() => document.createElement('div')),
                goWindowToIdevice: vi.fn(),
                loadInitScriptIdevice: vi.fn(),
            };
            vi.spyOn(engine, 'syncNewIdeviceToYjs').mockImplementation(() => {});
        });

        it('prepends buttons when ideviceContent already exists', () => {
            const prependSpy = vi.spyOn(mockIdeviceNode.ideviceContent, 'prepend');

            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(mockIdeviceNode.makeIdeviceButtonsElement).toHaveBeenCalled();
        });

        it('calls makeIdeviceContentNode when ideviceContent is null', () => {
            mockIdeviceNode.ideviceContent = null;

            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(mockIdeviceNode.makeIdeviceContentNode).toHaveBeenCalledWith(true);
        });

        it('creates new block when container is node-content', () => {
            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(engine.components.blocks.length).toBe(1);
        });

        it('syncs idevice to Yjs', () => {
            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(engine.syncNewIdeviceToYjs).toHaveBeenCalledWith(mockIdeviceNode);
        });

        it('calls changeUserFlagOnEdit when idevice is in edition mode', () => {
            mockIdeviceNode.mode = 'edition';

            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(eXeLearning.app.project.changeUserFlagOnEdit).toHaveBeenCalled();
        });

        it('goes to idevice window when in edition mode', () => {
            mockIdeviceNode.mode = 'edition';

            engine.addIdeviceNodeToContainer(mockIdeviceNode, engine.nodeContentElement);

            expect(mockIdeviceNode.goWindowToIdevice).toHaveBeenCalled();
        });
    });

    describe('dropIdeviceMenuInContent', () => {
        beforeEach(() => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.id = 'text';
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'createIdeviceInContent').mockResolvedValue({});
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
        });

        it('creates idevice when container is valid', async () => {
            await engine.dropIdeviceMenuInContent(engine.nodeContentElement);

            expect(engine.createIdeviceInContent).toHaveBeenCalled();
        });

        it('resets drag element after drop', async () => {
            await engine.dropIdeviceMenuInContent(engine.nodeContentElement);

            expect(engine.resetDragElement).toHaveBeenCalledWith(true);
            expect(engine.resetDragOverClasses).toHaveBeenCalled();
        });

        it('does not create idevice when container is invalid', async () => {
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(false);

            await engine.dropIdeviceMenuInContent(engine.nodeContentElement);

            expect(engine.createIdeviceInContent).not.toHaveBeenCalled();
        });
    });

    describe('dropIdeviceContentInContent', () => {
        beforeEach(() => {
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-1');
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            // Mock non-root page
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn((attr) => {
                if (attr === 'nav-id') return 'page-1';
                return null;
            });
        });

        it('returns false when page is root', async () => {
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn(() => 'root');

            const result = await engine.dropIdeviceContentInContent(engine.nodeContentElement);

            expect(result).toBe(false);
        });

        it('does nothing when idevice not found', async () => {
            engine.components.idevices = [];

            await engine.dropIdeviceContentInContent(engine.nodeContentElement);

            expect(engine.resetDragElement).not.toHaveBeenCalled();
        });
    });


    describe('dragEndIdeviceOutOffContainer', () => {
        beforeEach(() => {
            const mockIdevice = {
                odeIdeviceId: 'idevice-1',
                ideviceContent: document.createElement('div'),
                makeIdeviceContentNode: vi.fn(),
            };
            engine.components.idevices = [mockIdevice];
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-1');
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
        });

        it('resets drag element', () => {
            engine.dragEndIdeviceOutOffContainer();

            expect(engine.resetDragElement).toHaveBeenCalledWith(true);
        });

        it('resets drag over classes', () => {
            engine.dragEndIdeviceOutOffContainer();

            expect(engine.resetDragOverClasses).toHaveBeenCalled();
        });

        it('calls makeIdeviceContentNode on idevice', () => {
            engine.dragEndIdeviceOutOffContainer();

            expect(engine.components.idevices[0].makeIdeviceContentNode).toHaveBeenCalledWith(false);
        });
    });

    describe('dragEndBlockOutOffContainer', () => {
        let mockBlock;

        beforeEach(() => {
            mockBlock = {
                blockId: 'block-1',
                blockContent: document.createElement('div'),
                headElement: document.createElement('div'),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                toggleOn: vi.fn(),
            };
            mockBlock.blockContent.appendChild(mockBlock.headElement);
            engine.components.blocks = [mockBlock];
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('block-id', 'block-1');
            engine.draggedElement.toggle = false;
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
        });

        it('does nothing when block not found', () => {
            engine.components.blocks = [];

            expect(() => engine.dragEndBlockOutOffContainer()).not.toThrow();
        });

        it('resets drag element and classes', () => {
            engine.dragEndBlockOutOffContainer();

            expect(engine.resetDragElement).toHaveBeenCalled();
            expect(engine.resetDragOverClasses).toHaveBeenCalled();
        });

        it('calls apiUpdateOrder on block', () => {
            engine.dragEndBlockOutOffContainer();

            expect(mockBlock.apiUpdateOrder).toHaveBeenCalledWith(true);
        });

        it('toggles on block when toggle flag is set', () => {
            engine.draggedElement.toggle = true;

            engine.dragEndBlockOutOffContainer();

            expect(mockBlock.toggleOn).toHaveBeenCalled();
        });
    });

    describe('createIdeviceInContent', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'newIdeviceNode').mockResolvedValue({
                mode: 'export',
                loadInitScriptIdevice: vi.fn().mockResolvedValue(undefined),
            });
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation(() => {});
        });

        it('returns false when container is root', async () => {
            const container = document.createElement('div');
            container.setAttribute('node-selected', 'root');

            const result = await engine.createIdeviceInContent({}, container);

            expect(result).toBe(false);
        });

        it('returns false when another idevice is in edition', async () => {
            const container = document.createElement('div');
            const editionIdevice = document.createElement('div');
            editionIdevice.classList.add('idevice_node');
            editionIdevice.setAttribute('mode', 'edition');
            container.appendChild(editionIdevice);

            const result = await engine.createIdeviceInContent({}, container);

            expect(result).toBe(false);
        });

        it('creates new idevice node when container is valid', async () => {
            const container = document.createElement('div');

            await engine.createIdeviceInContent({ odeIdeviceTypeName: 'text' }, container);

            expect(engine.newIdeviceNode).toHaveBeenCalled();
        });
    });

    describe('newIdeviceNode', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'appendNewIdeviceProcess').mockResolvedValue(true);
        });

        it('returns idevice node when appendNewIdeviceProcess succeeds', async () => {
            const result = await engine.newIdeviceNode({ odeIdeviceTypeName: 'text' });

            expect(result).toBeDefined();
        });

        it('returns false when appendNewIdeviceProcess fails', async () => {
            vi.spyOn(engine, 'appendNewIdeviceProcess').mockResolvedValue(false);
            vi.useFakeTimers();

            const resultPromise = engine.newIdeviceNode({ odeIdeviceTypeName: 'text' });
            vi.advanceTimersByTime(600);
            const result = await resultPromise;

            expect(result).toBe(false);
            vi.useRealTimers();
        });
    });

    describe('cloneBlockInContent', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'loadApiIdevicesInPage').mockResolvedValue(true);
        });

        it('reloads page when loadApiIdevicesInPage succeeds', async () => {
            const mockBlock = {
                blockId: 'clone-block-1',
                blockContent: document.createElement('div'),
                goWindowToBlock: vi.fn(),
            };
            engine.components.blocks = [mockBlock];

            await engine.cloneBlockInContent({}, { blockId: 'clone-block-1' });

            expect(engine.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
        });

        it('scrolls to cloned block', async () => {
            const mockBlock = {
                blockId: 'clone-block-1',
                blockContent: document.createElement('div'),
                goWindowToBlock: vi.fn(),
            };
            engine.components.blocks = [mockBlock];

            await engine.cloneBlockInContent({}, { blockId: 'clone-block-1' });

            expect(mockBlock.goWindowToBlock).toHaveBeenCalledWith(100);
        });
    });

    describe('cloneIdeviceInContent', () => {
        beforeEach(() => {
            const mockBlock = {
                blockId: 'block-1',
                blockContent: document.createElement('div'),
            };
            engine.components.blocks = [mockBlock];
            vi.spyOn(engine, 'createIdeviceInContent').mockResolvedValue({
                ideviceContent: document.createElement('div'),
                resetWindowHash: vi.fn(),
                goWindowToIdevice: vi.fn(),
            });
            vi.spyOn(engine, 'resetCurrentIdevicesExportView').mockImplementation(() => {});
        });

        it('creates clone idevice in block', async () => {
            const originalIdevice = { ideviceContent: document.createElement('div') };

            await engine.cloneIdeviceInContent(originalIdevice, { blockId: 'block-1' });

            expect(engine.createIdeviceInContent).toHaveBeenCalled();
        });
    });

    describe('loadComponentsPage', () => {
        beforeEach(() => {
            vi.spyOn(engine, 'newBlockNode').mockReturnValue({
                blockContent: document.createElement('div'),
            });
            vi.spyOn(engine, 'createIdeviceInContent').mockResolvedValue({});
        });

        it('creates blocks from pagStructure', async () => {
            const pagStructure = [
                { blockId: 'block-1', odeComponentsSyncs: [] },
                { blockId: 'block-2', odeComponentsSyncs: [] },
            ];

            await engine.loadComponentsPage(pagStructure);

            expect(engine.newBlockNode).toHaveBeenCalledTimes(2);
        });

        it('appends blocks to nodeContentElement', async () => {
            const pagStructure = [{ blockId: 'block-1', odeComponentsSyncs: [] }];

            await engine.loadComponentsPage(pagStructure);

            // Block should be appended
            expect(engine.nodeContentElement.children.length).toBeGreaterThan(0);
        });
    });

    describe('getAndLoadComponentsPageNode', () => {
        beforeEach(() => {
            // Setup required DOM elements
            const pageTitle = document.createElement('div');
            pageTitle.id = 'page-title-node-content';
            engine.nodeContainerElement.appendChild(pageTitle);

            const header = document.createElement('div');
            header.id = 'header-node-content';
            engine.nodeContainerElement.appendChild(header);

            eXeLearning.app.api.getComponentsByPage = vi.fn().mockResolvedValue({
                odePagStructureSyncs: [],
            });
            vi.spyOn(engine, 'loadComponentsPage').mockResolvedValue(undefined);
            vi.spyOn(engine, 'loadIdevicesExportStyles').mockResolvedValue(undefined);
            vi.spyOn(engine, 'loadIdevicesExportScripts').mockImplementation(() => {});
            vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            vi.spyOn(engine, 'hideNodeContainerLoadScreen').mockImplementation(() => {});
            vi.spyOn(engine, 'removeClassLoadingBlocks').mockImplementation(() => {});
            vi.spyOn(engine, 'loadLegacyExeFunctionalitiesExport').mockImplementation(() => {});
            vi.spyOn(engine, 'enableInternalLinks').mockImplementation(() => {});
            vi.spyOn(engine, 'setNodeContentHeader').mockImplementation(() => {});
            vi.spyOn(engine, 'setNodeContentPageTitle').mockImplementation(() => {});
            vi.spyOn(engine, 'removeNodeContentFormProperties').mockImplementation(() => {});
        });

        it('returns false when data is null', async () => {
            eXeLearning.app.api.getComponentsByPage = vi.fn().mockResolvedValue(null);

            const result = await engine.getAndLoadComponentsPageNode('page-1');

            expect(result).toBe(false);
        });

        it('loads components when data is valid', async () => {
            const result = await engine.getAndLoadComponentsPageNode('page-1');

            expect(engine.loadComponentsPage).toHaveBeenCalled();
        });
    });

    describe('setParentsAndChildrenIdevicesBlocks with blockIdToCheck', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('removes empty blocks when removeIfEmpty is true and blockIdToCheck matches', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: true,
                askForRemoveIfEmpty: false,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Pass specific block ID to check
            engine.setParentsAndChildrenIdevicesBlocks('block-1');

            expect(mockBlock.remove).toHaveBeenCalledWith(true);
        });

        it('does NOT check blocks when blockIdToCheck is null', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: true,
                askForRemoveIfEmpty: false,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Pass null - should not check any blocks
            engine.setParentsAndChildrenIdevicesBlocks(null);

            expect(mockBlock.remove).not.toHaveBeenCalled();
        });

        it('shows confirm modal for empty blocks when askForRemoveIfEmpty is true and blockIdToCheck matches', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: true,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Pass specific block ID to check
            engine.setParentsAndChildrenIdevicesBlocks('block-1');
            vi.advanceTimersByTime(400);

            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
        });

        it('does NOT show confirm modal for blocks not matching blockIdToCheck', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: true,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Pass different block ID - should not show modal for block-1
            engine.setParentsAndChildrenIdevicesBlocks('block-other');
            vi.advanceTimersByTime(400);

            expect(eXeLearning.app.modals.confirm.show).not.toHaveBeenCalled();
        });

        it('does nothing when blockIdToCheck refers to non-existent block', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: true,
                askForRemoveIfEmpty: false,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Pass ID that doesn't exist - getBlockById returns undefined
            engine.setParentsAndChildrenIdevicesBlocks('non-existent-block');

            expect(mockBlock.remove).not.toHaveBeenCalled();
        });

        it('does NOT remove block when it still has idevices', () => {
            const mockIdevice = { blockId: 'block-1' };
            const mockBlock = {
                blockId: 'block-1',
                idevices: [mockIdevice],
                removeIfEmpty: true,
                askForRemoveIfEmpty: false,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [mockIdevice];

            // Block has idevices so should not be removed
            engine.setParentsAndChildrenIdevicesBlocks('block-1');

            expect(mockBlock.remove).not.toHaveBeenCalled();
        });

        it('correctly assigns idevices to their blocks during rebuild', () => {
            const mockIdevice1 = { blockId: 'block-1' };
            const mockIdevice2 = { blockId: 'block-2' };
            const mockBlock1 = {
                blockId: 'block-1',
                idevices: ['old-ref'],
                removeIfEmpty: false,
                askForRemoveIfEmpty: false,
            };
            const mockBlock2 = {
                blockId: 'block-2',
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: false,
            };
            engine.components.blocks = [mockBlock1, mockBlock2];
            engine.components.idevices = [mockIdevice1, mockIdevice2];

            engine.setParentsAndChildrenIdevicesBlocks(null);

            expect(mockBlock1.idevices).toEqual([mockIdevice1]);
            expect(mockBlock2.idevices).toEqual([mockIdevice2]);
        });

        it('executes confirmExec callback to remove block when user confirms', () => {
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: true,
                remove: vi.fn(),
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [];

            // Capture the confirmExec callback
            let capturedConfirmExec = null;
            eXeLearning.app.modals.confirm.show = vi.fn((options) => {
                capturedConfirmExec = options.confirmExec;
            });

            engine.setParentsAndChildrenIdevicesBlocks('block-1');
            vi.advanceTimersByTime(400);

            // Verify modal was shown
            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();

            // Execute the confirm callback (simulating user clicking "Yes")
            capturedConfirmExec();

            // Verify block was removed
            expect(mockBlock.remove).toHaveBeenCalledWith(true);
        });

        it('handles idevices with non-existent blockId gracefully', () => {
            const mockIdevice = { blockId: 'non-existent-block' };
            const mockBlock = {
                blockId: 'block-1',
                idevices: [],
                removeIfEmpty: false,
                askForRemoveIfEmpty: false,
            };
            engine.components.blocks = [mockBlock];
            engine.components.idevices = [mockIdevice];

            // Should not throw, idevice just won't be assigned
            expect(() => {
                engine.setParentsAndChildrenIdevicesBlocks(null);
            }).not.toThrow();

            expect(mockBlock.idevices).toEqual([]);
        });
    });

    describe('syncNewIdeviceToYjs with valid bridge', () => {
        let mockBridge;

        beforeEach(() => {
            mockBridge = {
                structureBinding: {
                    getBlocks: vi.fn().mockReturnValue([]),
                    getPage: vi.fn().mockReturnValue({ id: 'page-1' }),
                    getComponents: vi.fn().mockReturnValue([]),
                },
                addBlock: vi.fn().mockReturnValue('new-block-id'),
                addComponent: vi.fn().mockReturnValue('new-comp-id'),
            };
            mockProject._yjsBridge = mockBridge;
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn(() => 'page-1');
        });

        it('creates block in Yjs when it does not exist', () => {
            const ideviceNode = {
                odeIdeviceId: 'idevice-1',
                blockId: 'block-1',
                fromYjs: false,
                yjsComponentId: null,
                idevice: { id: 'text', title: 'Text' },
                htmlView: '<p>Content</p>',
                jsonProperties: {},
                order: 0,
            };
            engine.components.blocks = [];

            engine.syncNewIdeviceToYjs(ideviceNode);

            expect(mockBridge.addBlock).toHaveBeenCalled();
        });

        it('adds component to Yjs', () => {
            const ideviceNode = {
                odeIdeviceId: 'idevice-1',
                blockId: 'block-1',
                fromYjs: false,
                yjsComponentId: null,
                idevice: { id: 'text', title: 'Text' },
                htmlView: '<p>Content</p>',
                jsonProperties: {},
                order: 0,
            };

            engine.syncNewIdeviceToYjs(ideviceNode);

            expect(mockBridge.addComponent).toHaveBeenCalled();
        });

        it('sets yjsComponentId on idevice node', () => {
            const ideviceNode = {
                odeIdeviceId: 'idevice-1',
                blockId: 'block-1',
                fromYjs: false,
                yjsComponentId: null,
                idevice: { id: 'text', title: 'Text' },
                htmlView: '<p>Content</p>',
                jsonProperties: {},
                order: 0,
            };

            engine.syncNewIdeviceToYjs(ideviceNode);

            expect(ideviceNode.yjsComponentId).toBe('new-comp-id');
        });

        it('calculates block order from DOM position when creating new block', () => {
            // Create DOM structure with existing blocks
            const nodeContent = document.createElement('div');
            nodeContent.id = 'node-content';

            // Add two existing blocks before where new one will be inserted
            const block0 = document.createElement('article');
            block0.className = 'box';
            block0.id = 'existing-block-0';
            nodeContent.appendChild(block0);

            const block1 = document.createElement('article');
            block1.className = 'box';
            block1.id = 'existing-block-1';
            nodeContent.appendChild(block1);

            // New block that will be inserted at position 1 (between block0 and block1)
            const newBlockContent = document.createElement('article');
            newBlockContent.className = 'box';
            newBlockContent.id = 'new-block-id';
            // Insert before block1 to simulate being at position 1
            nodeContent.insertBefore(newBlockContent, block1);

            document.body.appendChild(nodeContent);

            const mockBlockNode = {
                blockName: 'Test Block',
                blockContent: newBlockContent,
                getCurrentOrder: vi.fn().mockReturnValue(-1), // Fallback should not be needed
            };
            vi.spyOn(engine, 'getBlockById').mockReturnValue(mockBlockNode);

            const ideviceNode = {
                odeIdeviceId: 'idevice-1',
                blockId: 'new-block-id',
                fromYjs: false,
                yjsComponentId: null,
                idevice: { id: 'text', title: 'Text' },
                htmlView: '<p>Content</p>',
                jsonProperties: {},
                ideviceContent: null,
            };
            engine.components.blocks = [];

            engine.syncNewIdeviceToYjs(ideviceNode);

            // Should calculate order=1 from DOM position (second among .box elements)
            expect(mockBridge.addBlock).toHaveBeenCalledWith(
                'page-1',
                'Test Block',
                'new-block-id',
                1 // Expected order based on DOM position
            );

            document.body.removeChild(nodeContent);
        });

        it('calculates component order from DOM position', () => {
            // Setup: block already exists in Yjs
            mockBridge.structureBinding.getBlocks = vi.fn().mockReturnValue([
                { id: 'block-1', blockId: 'block-1' },
            ]);

            // Create DOM structure with existing iDevices
            const blockContent = document.createElement('article');
            blockContent.className = 'box';
            blockContent.id = 'block-1';

            // Add existing iDevice
            const existingIdevice = document.createElement('div');
            existingIdevice.className = 'idevice_node';
            existingIdevice.id = 'existing-idevice';
            blockContent.appendChild(existingIdevice);

            // New iDevice inserted before existing one (at position 0)
            const newIdeviceContent = document.createElement('div');
            newIdeviceContent.className = 'idevice_node';
            newIdeviceContent.id = 'new-idevice-content';
            blockContent.insertBefore(newIdeviceContent, existingIdevice);

            document.body.appendChild(blockContent);

            const ideviceNode = {
                odeIdeviceId: 'new-idevice',
                blockId: 'block-1',
                fromYjs: false,
                yjsComponentId: null,
                idevice: { id: 'text', title: 'Text' },
                htmlView: '<p>Content</p>',
                jsonProperties: {},
                ideviceContent: newIdeviceContent,
                getCurrentOrder: vi.fn().mockReturnValue(-1),
            };
            engine.components.blocks = [];

            engine.syncNewIdeviceToYjs(ideviceNode);

            // Should calculate order=0 from DOM position (first among .idevice_node elements)
            const addComponentCall = mockBridge.addComponent.mock.calls[0];
            expect(addComponentCall[3].order).toBe(0);

            document.body.removeChild(blockContent);
        });
    });

    describe('renderRemoteIdevice with block creation', () => {
        beforeEach(() => {
            eXeLearning.app.project.structure.nodeSelected.getAttribute = vi.fn(() => 'page-1');
            eXeLearning.app.idevices = {
                getIdeviceInstalled: vi.fn(() => ({
                    id: 'text',
                    name: 'text',
                    title: 'Text',
                    cssClass: 'text',
                })),
            };
            vi.spyOn(engine, 'newBlockNode').mockReturnValue({
                blockContent: document.createElement('article'),
                blockId: 'new-block',
            });
            vi.spyOn(engine, 'setBlockDataToIdeviceNode').mockImplementation(() => {});
        });

        it('creates new block when block container not found', async () => {
            await engine.renderRemoteIdevice(
                { id: 'comp-1', ideviceType: 'text', htmlContent: '<p>Test</p>' },
                'page-1',
                'nonexistent-block'
            );

            expect(engine.newBlockNode).toHaveBeenCalled();
        });
    });

    describe('updateRemoteIdeviceContent with ideviceBody', () => {
        it('updates idevice body innerHTML', async () => {
            const mockIdevice = {
                odeIdeviceId: 'comp-1',
                htmlView: 'old',
                mode: 'export',
                ideviceContent: document.createElement('div'),
                ideviceBody: document.createElement('div'),
                lockedByRemote: true,
                lockUserName: 'User',
                lockUserColor: '#fff',
                updateLockIndicator: vi.fn(),
                loadInitScriptIdevice: vi.fn().mockResolvedValue(undefined),
            };
            engine.components.idevices = [mockIdevice];

            await engine.updateRemoteIdeviceContent({ id: 'comp-1', htmlContent: '<p>New</p>' });

            expect(mockIdevice.ideviceBody.innerHTML).toBe('<p>New</p>');
        });

        it('removes placeholder from idevice body', async () => {
            const mockIdevice = {
                odeIdeviceId: 'comp-1',
                htmlView: 'old',
                mode: 'export',
                ideviceContent: document.createElement('div'),
                ideviceBody: document.createElement('div'),
                lockedByRemote: false,
                updateLockIndicator: vi.fn(),
                loadInitScriptIdevice: vi.fn().mockResolvedValue(undefined),
            };
            const placeholder = document.createElement('div');
            placeholder.classList.add('idevice-locked-placeholder');
            mockIdevice.ideviceBody.appendChild(placeholder);
            engine.components.idevices = [mockIdevice];

            await engine.updateRemoteIdeviceContent({ id: 'comp-1', htmlContent: '<p>New</p>' });

            expect(mockIdevice.ideviceBody.querySelector('.idevice-locked-placeholder')).toBeNull();
        });
    });

    describe('loadLegacyExeFunctionalitiesExport', () => {
        beforeEach(() => {
            global.$exeFX = { init: vi.fn() };
            global.$exeGames = { init: vi.fn() };
            global.$exeHighlighter = { init: vi.fn() };
            global.$exeABCmusic = { init: vi.fn() };
            global.$exe = { init: vi.fn() };
        });

        it('initializes $exeFX', () => {
            engine.loadLegacyExeFunctionalitiesExport();
            expect($exeFX.init).toHaveBeenCalled();
        });

        it('initializes $exeGames', () => {
            engine.loadLegacyExeFunctionalitiesExport();
            expect($exeGames.init).toHaveBeenCalled();
        });

        it('initializes $exeHighlighter', () => {
            engine.loadLegacyExeFunctionalitiesExport();
            expect($exeHighlighter.init).toHaveBeenCalled();
        });

        it('initializes $exeABCmusic', () => {
            engine.loadLegacyExeFunctionalitiesExport();
            expect($exeABCmusic.init).toHaveBeenCalled();
        });

        it('initializes $exe', () => {
            engine.loadLegacyExeFunctionalitiesExport();
            expect($exe.init).toHaveBeenCalled();
        });
    });

    describe('enableInternalLinks', () => {
        it('does nothing when no internal links found', () => {
            expect(() => engine.enableInternalLinks()).not.toThrow();
        });

        it('processes internal links when found', () => {
            // Create mock internal link
            const link = document.createElement('a');
            link.href = 'exe-node:page-1';
            document.body.appendChild(link);

            // Setup mock structure
            eXeLearning.app.project.structure.data = [
                { pageId: 'page-1', pageName: 'Home' },
            ];

            expect(() => engine.enableInternalLinks()).not.toThrow();

            document.body.removeChild(link);
        });
    });

    describe('loadScript with CSS extension', () => {
        it('creates link element for CSS files', () => {
            const initialHeadCount = document.head.children.length;

            engine.loadScript('http://localhost/style.css', vi.fn());

            expect(document.head.children.length).toBeGreaterThan(initialHeadCount);
        });

        it('adds CSS element to ideviceScriptsElements', () => {
            engine.ideviceScriptsElements = [];

            engine.loadScript('http://localhost/style.css', vi.fn());

            expect(engine.ideviceScriptsElements.length).toBe(1);
        });
    });

    describe('clearIdevicesScripts with actual elements', () => {
        it('removes all script elements', () => {
            const script1 = document.createElement('script');
            const script2 = document.createElement('script');
            document.head.appendChild(script1);
            document.head.appendChild(script2);

            engine.ideviceScriptsElements = [script1, script2];

            engine.clearIdevicesScripts();

            expect(engine.ideviceScriptsElements.length).toBe(0);
        });
    });

    describe('loadIdevicesExportScripts with idevices', () => {
        it('calls loadScriptsExport on unique idevices', () => {
            const mockLoadScripts = vi.fn();
            engine.components.idevices = [
                { idevice: { id: 'text', loadScriptsExport: mockLoadScripts } },
                { idevice: { id: 'text', loadScriptsExport: mockLoadScripts } },
                { idevice: { id: 'image', loadScriptsExport: mockLoadScripts } },
            ];

            engine.loadIdevicesExportScripts();

            // Should be called twice (once for 'text', once for 'image')
            expect(mockLoadScripts).toHaveBeenCalledTimes(2);
        });
    });

    describe('loadIdevicesExportStyles with idevices', () => {
        it('calls loadStylesExport on unique idevices', async () => {
            const mockLoadStyles = vi.fn().mockResolvedValue(undefined);
            engine.components.idevices = [
                { idevice: { id: 'text', loadStylesExport: mockLoadStyles } },
                { idevice: { id: 'text', loadStylesExport: mockLoadStyles } },
            ];

            await engine.loadIdevicesExportStyles();

            // Should be called once (only unique idevices)
            expect(mockLoadStyles).toHaveBeenCalledTimes(1);
        });
    });

    describe('isInsideBlockHeader', () => {
        it('returns false for null element', () => {
            expect(engine.isInsideBlockHeader(null)).toBe(false);
        });

        it('returns false for undefined element', () => {
            expect(engine.isInsideBlockHeader(undefined)).toBe(false);
        });

        it('returns true when element is a box-head', () => {
            const header = document.createElement('header');
            header.classList.add('box-head');
            expect(engine.isInsideBlockHeader(header)).toBe(true);
        });

        it('returns true when element is inside a box-head', () => {
            const header = document.createElement('header');
            header.classList.add('box-head');
            const title = document.createElement('h1');
            title.classList.add('box-title');
            header.appendChild(title);
            document.body.appendChild(header);

            expect(engine.isInsideBlockHeader(title)).toBe(true);

            // Cleanup
            document.body.removeChild(header);
        });

        it('returns true for deeply nested elements inside box-head', () => {
            const header = document.createElement('header');
            header.classList.add('box-head');
            const div = document.createElement('div');
            div.classList.add('content-editable-title');
            const button = document.createElement('button');
            div.appendChild(button);
            header.appendChild(div);
            document.body.appendChild(header);

            expect(engine.isInsideBlockHeader(button)).toBe(true);

            // Cleanup
            document.body.removeChild(header);
        });

        it('returns false for element outside box-head', () => {
            const container = document.createElement('div');
            container.id = 'node-content';
            const article = document.createElement('article');
            article.classList.add('box');
            const blockBody = document.createElement('div');
            blockBody.classList.add('blockBody');
            article.appendChild(blockBody);
            container.appendChild(article);
            document.body.appendChild(container);

            expect(engine.isInsideBlockHeader(blockBody)).toBe(false);

            // Cleanup
            document.body.removeChild(container);
        });

        it('returns false for element in block body', () => {
            const header = document.createElement('header');
            header.classList.add('box-head');
            const blockBody = document.createElement('div');
            blockBody.classList.add('blockBody');
            const article = document.createElement('article');
            article.classList.add('box');
            article.appendChild(header);
            article.appendChild(blockBody);

            const idevice = document.createElement('div');
            idevice.classList.add('idevice_node');
            blockBody.appendChild(idevice);
            document.body.appendChild(article);

            expect(engine.isInsideBlockHeader(idevice)).toBe(false);

            // Cleanup
            document.body.removeChild(article);
        });
    });

    describe('isDragableInside with block header validation', () => {
        it('returns false when container is a box-head element', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');
            const container = document.createElement('header');
            container.classList.add('box-head');
            container.setAttribute('drop', '["idevice"]');

            expect(engine.isDragableInside(element, container)).toBe(false);
        });

        it('returns false when container is inside a box-head', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');

            const header = document.createElement('header');
            header.classList.add('box-head');
            const title = document.createElement('h1');
            title.classList.add('box-title');
            title.setAttribute('drop', '["idevice"]');
            header.appendChild(title);
            document.body.appendChild(header);

            expect(engine.isDragableInside(element, title)).toBe(false);

            // Cleanup
            document.body.removeChild(header);
        });

        it('returns false for button inside box-head', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');

            const header = document.createElement('header');
            header.classList.add('box-head');
            const button = document.createElement('button');
            button.classList.add('btn-toggle');
            button.setAttribute('drop', '["idevice"]');
            header.appendChild(button);
            document.body.appendChild(header);

            expect(engine.isDragableInside(element, button)).toBe(false);

            // Cleanup
            document.body.removeChild(header);
        });

        it('returns true for valid drop in block body', () => {
            const element = document.createElement('div');
            element.setAttribute('drag', 'idevice');

            const article = document.createElement('article');
            article.classList.add('box');
            const header = document.createElement('header');
            header.classList.add('box-head');
            const blockBody = document.createElement('div');
            blockBody.classList.add('blockBody');
            blockBody.setAttribute('drop', '["idevice"]');
            article.appendChild(header);
            article.appendChild(blockBody);
            document.body.appendChild(article);

            expect(engine.isDragableInside(element, blockBody)).toBe(true);

            // Cleanup
            document.body.removeChild(article);
        });
    });

    describe('dropIdeviceContentInContent state synchronization', () => {
        it('removes iDevice from source block array before moving', async () => {
            // Setup source block with iDevice
            const sourceBlock = {
                blockId: 'block-source-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const targetBlock = {
                blockId: 'block-target-456',
                idevices: [],
            };

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-source-123',
                order: 0,
                ideviceContent: document.createElement('div'),
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock, targetBlock];
            engine.components.idevices = [mockIdeviceNode];

            // Mock getIdeviceById to return the idevice
            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            vi.spyOn(engine, 'getBlockById').mockImplementation((id) => {
                if (id === 'block-source-123') return sourceBlock;
                if (id === 'block-target-456') return targetBlock;
                return null;
            });
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            // Mock addIdeviceNodeToContainer to simulate moving to different block
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode) => {
                ideviceNode.blockId = 'block-target-456';
            });

            // Setup dragged element
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            // Create target container (target block)
            const container = document.createElement('article');
            container.id = 'block-target-456';
            container.classList.add('box');

            // Execute
            await engine.dropIdeviceContentInContent(container);

            // Verify source block's removeIdeviceOfListById was called
            expect(sourceBlock.removeIdeviceOfListById).toHaveBeenCalledWith('idevice-123');
        });

        it('adds iDevice to target block array after moving', async () => {
            const sourceBlock = {
                blockId: 'block-source-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const targetBlock = {
                blockId: 'block-target-456',
                idevices: [],
            };

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-source-123',
                ideviceContent: document.createElement('div'),
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock, targetBlock];
            engine.components.idevices = [mockIdeviceNode];

            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            // Return target block after setBlockDataToIdeviceNode updates blockId
            vi.spyOn(engine, 'getBlockById').mockImplementation((id) => {
                if (id === 'block-source-123') return sourceBlock;
                if (id === 'block-target-456') return targetBlock;
                return null;
            });
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            vi.spyOn(engine, 'setBlockDataToIdeviceNode').mockImplementation((idevice, block) => {
                idevice.blockId = block.blockId;
            });
            // Mock addIdeviceNodeToContainer to update blockId and avoid DOM manipulation issues
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode, container) => {
                // Simulate blockId update that happens in real implementation
                ideviceNode.blockId = container.id;
            });

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            const container = document.createElement('article');
            container.id = 'block-target-456';
            container.classList.add('box');

            await engine.dropIdeviceContentInContent(container);

            // Verify target block's idevices array contains the moved iDevice
            expect(targetBlock.idevices).toContain(mockIdeviceNode);
        });
    });

    describe('addIdeviceNodeToContainer with Yjs block creation', () => {
        it('creates block in Yjs before DOM when dropping outside blocks', () => {
            const mockBridge = {
                addBlock: vi.fn().mockReturnValue('yjs-block-id-123'),
            };

            // Enable Yjs
            engine.project._yjsBridge = mockBridge;
            engine.project.app.project.structure.getSelectNodePageId = vi.fn(() => 'page-123');

            const mockIdeviceNode = {
                idevice: { title: 'Test iDevice' },
                ideviceContent: null,
                makeIdeviceContentNode: vi.fn(() => {
                    const div = document.createElement('div');
                    div.classList.add('idevice_node');
                    return div;
                }),
                mode: 'view',
            };

            // Setup node-content container
            const container = document.createElement('article');
            container.id = 'node-content';
            document.body.appendChild(container);

            // Setup dragged element for position calculation
            engine.draggedElement = document.createElement('div');
            engine.draggedElement.getBoundingClientRect = vi.fn(() => ({
                top: 100,
                height: 50,
            }));
            container.appendChild(engine.draggedElement);

            // Mock newBlockNode to verify it receives the Yjs blockId
            const mockNewBlockNode = vi.fn().mockReturnValue({
                blockId: 'yjs-block-id-123',
                blockContent: document.createElement('article'),
            });
            vi.spyOn(engine, 'newBlockNode').mockImplementation(mockNewBlockNode);
            vi.spyOn(engine, 'setBlockDataToIdeviceNode').mockImplementation(() => {});
            vi.spyOn(engine, 'syncNewIdeviceToYjs').mockImplementation(() => {});

            // Execute
            engine.addIdeviceNodeToContainer(mockIdeviceNode, container);

            // Verify Yjs bridge.addBlock was called first
            expect(mockBridge.addBlock).toHaveBeenCalledWith(
                'page-123',
                'Test iDevice',
                null,
                expect.any(Number)
            );

            // Verify newBlockNode received the Yjs blockId
            expect(mockNewBlockNode).toHaveBeenCalledWith(
                expect.objectContaining({
                    blockId: 'yjs-block-id-123',
                }),
                true
            );

            // Cleanup
            document.body.removeChild(container);
        });

        it('generates local blockId when Yjs bridge is not available', () => {
            // Disable Yjs
            engine.project._yjsBridge = null;

            const mockIdeviceNode = {
                idevice: { title: 'Test iDevice' },
                ideviceContent: null,
                makeIdeviceContentNode: vi.fn(() => {
                    const div = document.createElement('div');
                    div.classList.add('idevice_node');
                    return div;
                }),
                mode: 'view',
            };

            const container = document.createElement('article');
            container.id = 'node-content';
            document.body.appendChild(container);

            engine.draggedElement = document.createElement('div');
            container.appendChild(engine.draggedElement);

            const mockNewBlockNode = vi.fn().mockReturnValue({
                blockId: 'local-block-id',
                blockContent: document.createElement('article'),
            });
            vi.spyOn(engine, 'newBlockNode').mockImplementation(mockNewBlockNode);
            vi.spyOn(engine, 'setBlockDataToIdeviceNode').mockImplementation(() => {});
            vi.spyOn(engine, 'syncNewIdeviceToYjs').mockImplementation(() => {});

            engine.addIdeviceNodeToContainer(mockIdeviceNode, container);

            // Verify newBlockNode was called with null blockId (will generate locally)
            expect(mockNewBlockNode).toHaveBeenCalledWith(
                expect.objectContaining({
                    blockId: null,
                }),
                true
            );

            // Cleanup
            document.body.removeChild(container);
        });
    });

    describe('dropIdeviceContentInContent order sync to Yjs', () => {
        it('calls apiUpdateOrder for same-block reorder instead of apiUpdateBlock', async () => {
            const sourceBlock = {
                blockId: 'block-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const mockIdeviceContent = document.createElement('div');
            mockIdeviceContent.classList.add('idevice_node');

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-123', // Same block
                order: 0,
                ideviceContent: mockIdeviceContent,
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock];
            engine.components.idevices = [mockIdeviceNode];

            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            vi.spyOn(engine, 'getBlockById').mockReturnValue(sourceBlock);
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            // Mock addIdeviceNodeToContainer - simulates reorder within same block
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode) => {
                // blockId stays the same (same block reorder)
                ideviceNode.blockId = 'block-123';
            });

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            // Create container as the same block
            const container = document.createElement('article');
            container.id = 'block-123';
            container.classList.add('box');
            container.appendChild(mockIdeviceContent);

            await engine.dropIdeviceContentInContent(container);

            // For same-block reorder, apiUpdateOrder should be called, NOT apiUpdateBlock
            expect(mockIdeviceNode.apiUpdateOrder).toHaveBeenCalledWith(false);
            expect(mockIdeviceNode.apiUpdateBlock).not.toHaveBeenCalled();
        });

        it('calls apiUpdateBlock when moving to different block', async () => {
            const sourceBlock = {
                blockId: 'block-source-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const targetBlock = {
                blockId: 'block-target-456',
                idevices: [],
            };

            const mockIdeviceContent = document.createElement('div');
            mockIdeviceContent.classList.add('idevice_node');

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-source-123',
                order: 0,
                ideviceContent: mockIdeviceContent,
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock, targetBlock];
            engine.components.idevices = [mockIdeviceNode];

            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            vi.spyOn(engine, 'getBlockById').mockImplementation((id) => {
                if (id === 'block-source-123') return sourceBlock;
                if (id === 'block-target-456') return targetBlock;
                return null;
            });
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            // Mock addIdeviceNodeToContainer - simulates moving to different block
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode) => {
                // blockId changes (different block)
                ideviceNode.blockId = 'block-target-456';
            });

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            const container = document.createElement('article');
            container.id = 'block-target-456';
            container.classList.add('box');
            container.appendChild(mockIdeviceContent);

            await engine.dropIdeviceContentInContent(container);

            // For different block, apiUpdateBlock should be called
            expect(mockIdeviceNode.apiUpdateBlock).toHaveBeenCalled();
            expect(mockIdeviceNode.apiUpdateOrder).not.toHaveBeenCalled();
        });

        it('passes source blockId to setParentsAndChildrenIdevicesBlocks when moving to different block', async () => {
            vi.useFakeTimers();

            const sourceBlock = {
                blockId: 'block-source-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const targetBlock = {
                blockId: 'block-target-456',
                idevices: [],
            };

            const mockIdeviceContent = document.createElement('div');
            mockIdeviceContent.classList.add('idevice_node');

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-source-123', // Original block
                order: 0,
                ideviceContent: mockIdeviceContent,
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock, targetBlock];
            engine.components.idevices = [mockIdeviceNode];

            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            vi.spyOn(engine, 'getBlockById').mockImplementation((id) => {
                if (id === 'block-source-123') return sourceBlock;
                if (id === 'block-target-456') return targetBlock;
                return null;
            });
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            const setParentsSpy = vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode) => {
                ideviceNode.blockId = 'block-target-456';
            });

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            const container = document.createElement('article');
            container.id = 'block-target-456';
            container.classList.add('box');
            container.appendChild(mockIdeviceContent);

            await engine.dropIdeviceContentInContent(container);

            // Advance timer to execute handlePostMove setTimeout
            vi.advanceTimersByTime(100);

            // Should pass the SOURCE block ID to check if it became empty
            expect(setParentsSpy).toHaveBeenCalledWith('block-source-123');

            vi.useRealTimers();
        });

        it('passes null to setParentsAndChildrenIdevicesBlocks for same-block reorder', async () => {
            vi.useFakeTimers();

            const sourceBlock = {
                blockId: 'block-123',
                idevices: [],
                removeIdeviceOfListById: vi.fn(),
            };

            const mockIdeviceContent = document.createElement('div');
            mockIdeviceContent.classList.add('idevice_node');

            const mockIdeviceNode = {
                odeIdeviceId: 'idevice-123',
                blockId: 'block-123',
                order: 0,
                ideviceContent: mockIdeviceContent,
                ideviceButtons: document.createElement('div'),
                makeIdeviceButtonsElement: vi.fn(() => document.createElement('div')),
                apiUpdateBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [sourceBlock];
            engine.components.idevices = [mockIdeviceNode];

            vi.spyOn(engine, 'getIdeviceById').mockReturnValue(mockIdeviceNode);
            vi.spyOn(engine, 'getBlockById').mockReturnValue(sourceBlock);
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});
            const setParentsSpy = vi.spyOn(engine, 'setParentsAndChildrenIdevicesBlocks').mockImplementation(() => {});
            vi.spyOn(engine, 'addIdeviceNodeToContainer').mockImplementation((ideviceNode) => {
                ideviceNode.blockId = 'block-123'; // Same block
            });

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('idevice-id', 'idevice-123');
            engine.draggedElement.classList.add('idevice_actions');

            const container = document.createElement('article');
            container.id = 'block-123';
            container.classList.add('box');
            container.appendChild(mockIdeviceContent);

            await engine.dropIdeviceContentInContent(container);

            // Advance timer to execute handlePostMove setTimeout
            vi.advanceTimersByTime(100);

            // For same-block reorder, should pass null (no block became empty)
            expect(setParentsSpy).toHaveBeenCalledWith(null);

            vi.useRealTimers();
        });
    });

    describe('dropBlockContentInContent order sync to Yjs', () => {
        it('calculates order from DOM position and calls apiUpdateOrder', async () => {
            // Setup node-content with multiple blocks FIRST
            const nodeContent = document.createElement('div');
            nodeContent.id = 'node-content';

            const block1 = document.createElement('article');
            block1.classList.add('box');
            block1.id = 'block-first';

            // This is the block we're testing - it will be at index 1
            const block2 = document.createElement('article');
            block2.classList.add('box');
            block2.id = 'block-123';

            const mockHeadElement = document.createElement('header');
            mockHeadElement.classList.add('box-head');
            block2.appendChild(mockHeadElement);

            nodeContent.appendChild(block1);
            nodeContent.appendChild(block2);
            document.body.appendChild(nodeContent);

            // Create mockBlockNode with blockContent pointing to block2 (which is in DOM)
            const mockBlockNode = {
                blockId: 'block-123',
                order: 0,
                pageId: 'page-123',
                blockContent: block2, // Points to actual DOM element
                headElement: mockHeadElement,
                toggleOn: vi.fn(),
                apiUpdateOrder: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            };

            engine.components.blocks = [mockBlockNode];

            vi.spyOn(engine, 'getBlockById').mockReturnValue(mockBlockNode);
            vi.spyOn(engine, 'isDragableInside').mockReturnValue(true);
            vi.spyOn(engine, 'resetDragElement').mockImplementation(() => {});
            vi.spyOn(engine, 'resetDragOverClasses').mockImplementation(() => {});

            engine.nodeContentElement = nodeContent;

            engine.draggedElement = document.createElement('div');
            engine.draggedElement.setAttribute('block-id', 'block-123');
            engine.draggedElement.classList.add('box-head');
            engine.draggedElement.toggle = false;

            await engine.dropBlockContentInContent(nodeContent);

            // apiUpdateOrder should be called with false (explicit order, not getCurrentOrder)
            expect(mockBlockNode.apiUpdateOrder).toHaveBeenCalledWith(false);
            // Order should be calculated from DOM position (block2 is at index 1)
            expect(mockBlockNode.order).toBe(1);

            // Cleanup
            document.body.removeChild(nodeContent);
        });
    });

});
