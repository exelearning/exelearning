/**
 * BlockNode Tests
 *
 * Unit tests for IdeviceBlockNode class methods.
 * Tests core functionality like parameter handling, properties, toggle, order calculation, etc.
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
            },
            putSaveBlock: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
            putSavePropertiesBlock: vi
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
        themes: {
            getThemeIcons: vi.fn(() => ({
                icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
                icon2: { id: 'icon2', value: '/path/to/icon2.svg', title: 'Icon 2' },
            })),
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
                menuStructureBehaviour: {
                    checkIfEmptyNode: vi.fn(),
                },
            },
        },
    },
    config: {
        isOfflineInstallation: false,
    },
};

// Import after setting up mocks
import IdeviceBlockNode from './blockNode.js';

describe('IdeviceBlockNode', () => {
    let block;
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
            movingClassDuration: 300,
            nodeContentElement: document.createElement('div'),
            addEventDragStartToContentBlock: vi.fn(),
            addEventDragEndToContentBlock: vi.fn(),
            components: { blocks: [], idevices: [] },
            getIdeviceById: vi.fn(),
        };

        // Create block with test data
        block = new IdeviceBlockNode(mockEngine, {
            id: 'block-1',
            blockId: 'block-id-1',
            blockName: 'Test Block',
            iconName: 'icon1',
            order: 1,
            pageId: 'page-1',
        });
    });

    afterEach(() => {
        block = null;
    });

    describe('constructor', () => {
        it('initializes with provided data', () => {
            expect(block.id).toBe('block-1');
            expect(block.blockId).toBe('block-id-1');
            expect(block.blockName).toBe('Test Block');
            expect(block.iconName).toBe('icon1');
            expect(block.order).toBe(1);
        });

        it('uses default values when data is missing', () => {
            const emptyBlock = new IdeviceBlockNode(mockEngine, {});
            expect(emptyBlock.mode).toBe('export');
            expect(emptyBlock.blockName).toBeNull();
            expect(emptyBlock.iconName).toBeNull();
        });

        it('generates id when not provided', () => {
            const newBlock = new IdeviceBlockNode(mockEngine, {});
            expect(newBlock.id).toBe('generated-key-123');
        });

        it('initializes empty idevices array', () => {
            expect(block.idevices).toEqual([]);
        });

        it('initializes control parameters', () => {
            expect(block.removeIfEmpty).toBe(false);
            expect(block.askForRemoveIfEmpty).toBe(true);
            expect(block.canHaveHeirs).toBe(true);
        });

        it('stores engine reference', () => {
            expect(block.engine).toBe(mockEngine);
        });

        it('uses engine.generateId when Yjs not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            mockEngine.generateId.mockReturnValue('engine-generated-id');
            const newBlock = new IdeviceBlockNode(mockEngine, {});
            expect(mockEngine.generateId).toHaveBeenCalled();
        });

        describe('ID assignment in Yjs mode', () => {
            it('sets this.id equal to this.blockId when Yjs is enabled and no data.id', () => {
                eXeLearning.app.project._yjsEnabled = true;

                const block = new IdeviceBlockNode(mockEngine, {
                    blockId: 'block-123',
                    // No id provided
                });

                // In Yjs mode, id should equal blockId for consistency
                expect(block.id).toBe(block.blockId);
                expect(block.id).toBe('block-123');
            });

            it('keeps data.id when provided even in Yjs mode', () => {
                eXeLearning.app.project._yjsEnabled = true;

                const block = new IdeviceBlockNode(mockEngine, {
                    id: 'custom-id',
                    blockId: 'block-456',
                });

                // Should use provided id, not blockId
                expect(block.id).toBe('custom-id');
                expect(block.blockId).toBe('block-456');
            });

            it('generates Yjs-style blockId when Yjs is enabled and no blockId provided', () => {
                eXeLearning.app.project._yjsEnabled = true;

                const block = new IdeviceBlockNode(mockEngine, {
                    // No blockId provided
                });

                // BlockId should be generated with Yjs-style format (block-timestamp-random)
                expect(block.blockId).toMatch(/^block-\d+-[a-z0-9]+$/);
                // And id should match blockId since no data.id was provided
                expect(block.id).toBe(block.blockId);
            });

            it('uses engine.generateId for blockId when Yjs is not enabled', () => {
                eXeLearning.app.project._yjsEnabled = false;
                mockEngine.generateId.mockReturnValue('engine-block-id');

                const block = new IdeviceBlockNode(mockEngine, {
                    // No blockId provided
                });

                // BlockId should use engine.generateId
                expect(block.blockId).toBe('engine-block-id');
                expect(mockEngine.generateId).toHaveBeenCalled();
            });

            it('keeps id and blockId independent when Yjs is disabled', () => {
                eXeLearning.app.project._yjsEnabled = false;
                mockEngine.generateId.mockReturnValue('engine-block-id');

                const block = new IdeviceBlockNode(mockEngine, {
                    // No id or blockId provided
                });

                // id should use the default generated key
                expect(block.id).toBe('generated-key-123');
                // blockId should use engine.generateId
                expect(block.blockId).toBe('engine-block-id');
                // They should be different
                expect(block.id).not.toBe(block.blockId);
            });
        });
    });

    describe('setParams', () => {
        it('sets all params from data object', () => {
            block.setParams({
                odeNavStructureSyncId: 'nav-123',
                odeSessionId: 'session-456',
                odeVersionId: 'v2',
                pageId: 'page-2',
                mode: 'edition',
                blockName: 'Updated Block',
                iconName: 'icon2',
                order: 5,
            });

            expect(block.odeNavStructureSyncId).toBe('nav-123');
            expect(block.odeSessionId).toBe('session-456');
            expect(block.odeVersionId).toBe('v2');
            expect(block.pageId).toBe('page-2');
            expect(block.mode).toBe('edition');
            expect(block.blockName).toBe('Updated Block');
            expect(block.iconName).toBe('icon2');
            expect(block.order).toBe(5);
        });

        it('uses default values for missing params', () => {
            block.setParams({});
            expect(block.mode).toBe('export');
        });

        it('calls setProperties when odePagStructureSyncProperties provided', () => {
            const spy = vi.spyOn(block, 'setProperties');
            block.setParams({
                odePagStructureSyncProperties: {
                    identifier: { value: 'my-id' },
                },
            });
            expect(spy).toHaveBeenCalledWith({ identifier: { value: 'my-id' } });
        });
    });

    describe('setProperties', () => {
        it('sets property values from data', () => {
            block.setProperties({
                identifier: { value: 'custom-id' },
                visibility: { value: 'true' },
                cssClass: { value: 'my-class' },
            });

            expect(block.properties.identifier.value).toBe('custom-id');
            expect(block.properties.visibility.value).toBe('true');
            expect(block.properties.cssClass.value).toBe('my-class');
        });

        it('only sets heritable properties when onlyHeritable is true', () => {
            block.setProperties(
                {
                    identifier: { value: 'inherited-id', heritable: true },
                    visibility: { value: 'true', heritable: false },
                },
                true,
            );

            expect(block.properties.identifier.value).toBe('inherited-id');
            expect(block.properties.visibility.value).toBe('false');
        });

        it('handles missing properties gracefully', () => {
            expect(() => {
                block.setProperties(null);
            }).not.toThrow();

            expect(() => {
                block.setProperties({});
            }).not.toThrow();
        });
    });

    describe('isYjsEnabled', () => {
        it('returns false when Yjs is not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            expect(block.isYjsEnabled()).toBe(false);
        });

        it('returns true when Yjs is enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            expect(block.isYjsEnabled()).toBe(true);
        });

        it('returns false when project is undefined', () => {
            const originalProject = eXeLearning.app.project;
            eXeLearning.app.project = undefined;
            expect(block.isYjsEnabled()).toBe(false);
            eXeLearning.app.project = originalProject;
        });
    });

    describe('loadPropertiesFromYjs', () => {
        it('does nothing when Yjs is not enabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            block.loadPropertiesFromYjs();
            expect(block.properties.identifier.value).toBe('');
        });

        it('loads properties from Yjs when enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getBlockProperties: vi.fn(() => ({
                        identifier: 'yjs-id',
                        visibility: true,
                        cssClass: 'yjs-class',
                    })),
                },
            };

            block.loadPropertiesFromYjs();

            expect(block.properties.identifier.value).toBe('yjs-id');
            expect(block.properties.visibility.value).toBe('true');
            expect(block.properties.cssClass.value).toBe('yjs-class');
        });

        it('converts boolean values to strings', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getBlockProperties: vi.fn(() => ({
                        minimized: true,
                        allowToggle: false,
                    })),
                },
            };

            block.loadPropertiesFromYjs();

            expect(block.properties.minimized.value).toBe('true');
            expect(block.properties.allowToggle.value).toBe('false');
        });

        it('does nothing when bridge not available', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = null;
            block.loadPropertiesFromYjs();
            expect(block.properties.identifier.value).toBe('');
        });
    });

    describe('generateBlockContentNode', () => {
        it('creates new article element when newNode is true', () => {
            const node = block.generateBlockContentNode(true);

            expect(node.tagName).toBe('ARTICLE');
            expect(node.id).toBe('block-id-1');
            expect(node.classList.contains('box')).toBe(true);
            expect(node.classList.contains('idevice-element-in-content')).toBe(true);
            expect(node.classList.contains('draggable')).toBe(true);
        });

        it('sets correct attributes', () => {
            const node = block.generateBlockContentNode(true);

            expect(node.getAttribute('sym-id')).toBe('block-1');
            expect(node.getAttribute('order')).toBe('1');
            expect(node.getAttribute('drag')).toBe('box');
            expect(node.getAttribute('drop')).toBe('["idevice"]');
        });

        it('reuses existing element when newNode is false', () => {
            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('old-class');
            block.toggleElement = document.createElement('button');
            block.toggleElement.setAttribute('disabled', 'true');
            // headElement is required for updateMode() to work
            block.headElement = document.createElement('header');

            const node = block.generateBlockContentNode(false);

            expect(node.classList.contains('old-class')).toBe(false);
            expect(node.classList.contains('box')).toBe(true);
            expect(block.toggleElement.hasAttribute('disabled')).toBe(false);
        });

        it('applies CSS classes from properties', () => {
            block.properties.cssClass.value = 'custom-class another-class';
            const node = block.generateBlockContentNode(true);

            expect(node.classList.contains('custom-class')).toBe(true);
            expect(node.classList.contains('another-class')).toBe(true);
        });
    });

    describe('setPropertiesClassesToElement', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            block.toggleElement = document.createElement('button');
            const span = document.createElement('span');
            block.toggleElement.appendChild(span);
        });

        it('sets identifier attribute', () => {
            block.properties.identifier.value = 'my-block-id';
            block.setPropertiesClassesToElement();

            expect(block.blockContent.getAttribute('identifier')).toBe('my-block-id');
        });

        it('sets export-view attribute when visibility is true', () => {
            block.properties.visibility.value = 'true';
            block.setPropertiesClassesToElement();

            expect(block.blockContent.getAttribute('export-view')).toBe('true');
        });

        it('adds CSS classes', () => {
            block.properties.cssClass.value = 'class1 class2 class3';
            block.setPropertiesClassesToElement();

            expect(block.blockContent.classList.contains('class1')).toBe(true);
            expect(block.blockContent.classList.contains('class2')).toBe(true);
            expect(block.blockContent.classList.contains('class3')).toBe(true);
        });

        it('calls toggleOff when minimized is true', () => {
            const spy = vi.spyOn(block, 'toggleOff');
            block.properties.minimized.value = 'true';
            block.setPropertiesClassesToElement();

            expect(spy).toHaveBeenCalled();
        });

        it('does not set identifier when value is empty', () => {
            block.properties.identifier.value = '';
            block.setPropertiesClassesToElement();

            expect(block.blockContent.hasAttribute('identifier')).toBe(false);
        });
    });

    describe('toggleOff / toggleOn', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            block.toggleElement = document.createElement('button');
            block.toggleElement.classList.add('box-toggle-on');
            const span = document.createElement('span');
            span.innerHTML = 'keyboard_arrow_down';
            block.toggleElement.appendChild(span);
        });

        it('toggleOff adds hidden-idevices class', () => {
            block.toggleOff();

            expect(block.blockContent.classList.contains('hidden-idevices')).toBe(
                true,
            );
            expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(
                true,
            );
            expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(
                false,
            );
        });

        it('toggleOn removes hidden-idevices class', () => {
            block.blockContent.classList.add('hidden-idevices');
            block.toggleElement.classList.add('box-toggle-off');
            block.toggleElement.classList.remove('box-toggle-on');

            block.toggleOn();

            expect(block.blockContent.classList.contains('hidden-idevices')).toBe(
                false,
            );
            expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(
                true,
            );
            expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(
                false,
            );
        });
    });

    describe('getCurrentOrder', () => {
        beforeEach(() => {
            const container = document.createElement('div');

            const prevBlock = document.createElement('article');
            prevBlock.classList.add('box');
            prevBlock.setAttribute('order', '5');

            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('box');

            const nextBlock = document.createElement('article');
            nextBlock.classList.add('box');
            nextBlock.setAttribute('order', '10');

            container.appendChild(prevBlock);
            container.appendChild(block.blockContent);
            container.appendChild(nextBlock);
        });

        it('returns order based on previous block', () => {
            const order = block.getCurrentOrder();
            expect(order).toBe(6);
        });

        it('returns -1 when no adjacent blocks exist', () => {
            const container = document.createElement('div');
            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('box');
            container.appendChild(block.blockContent);

            const order = block.getCurrentOrder();
            expect(order).toBe(-1);
        });
    });

    describe('getContentPrevBlock / getContentNextBlock', () => {
        it('returns previous block when exists', () => {
            const container = document.createElement('div');
            const prevBlock = document.createElement('article');
            prevBlock.classList.add('box');
            block.blockContent = document.createElement('article');

            container.appendChild(prevBlock);
            container.appendChild(block.blockContent);

            expect(block.getContentPrevBlock()).toBe(prevBlock);
        });

        it('returns false when no previous block', () => {
            const container = document.createElement('div');
            block.blockContent = document.createElement('article');
            container.appendChild(block.blockContent);

            expect(block.getContentPrevBlock()).toBe(false);
        });

        it('returns next block when exists', () => {
            const container = document.createElement('div');
            block.blockContent = document.createElement('article');
            const nextBlock = document.createElement('article');
            nextBlock.classList.add('box');

            container.appendChild(block.blockContent);
            container.appendChild(nextBlock);

            expect(block.getContentNextBlock()).toBe(nextBlock);
        });

        it('returns false when no next block', () => {
            const container = document.createElement('div');
            block.blockContent = document.createElement('article');
            container.appendChild(block.blockContent);

            expect(block.getContentNextBlock()).toBe(false);
        });
    });

    describe('generateModalMoveToPageBody', () => {
        it('creates modal body with select element', () => {
            const body = block.generateModalMoveToPageBody();

            expect(body.querySelector('.text-info-move-to-page')).not.toBeNull();
            expect(body.querySelector('.select-move-to-page')).not.toBeNull();
        });

        it('populates select with pages', () => {
            const body = block.generateModalMoveToPageBody();
            const options = body.querySelectorAll('option');

            expect(options.length).toBe(2);
            expect(options[0].value).toBe('page-1');
            expect(options[1].value).toBe('page-2');
        });

        it('marks current page as selected', () => {
            block.odeNavStructureSyncId = 'page-1';
            const body = block.generateModalMoveToPageBody();
            const selectedOption = body.querySelector('option[selected]');

            expect(selectedOption.value).toBe('page-1');
        });
    });

    describe('makeEmptyIcon', () => {
        it('creates empty icon element with correct classes', () => {
            const icon = block.makeEmptyIcon();

            expect(icon.classList.contains('exe-icon')).toBe(true);
            expect(icon.classList.contains('option-block-icon')).toBe(true);
            expect(icon.classList.contains('empty-block-icon')).toBe(true);
        });

        it('sets correct attributes', () => {
            const icon = block.makeEmptyIcon();

            expect(icon.getAttribute('tabindex')).toBe('0');
            expect(icon.getAttribute('icon-id')).toBe('0');
            expect(icon.title).toBe('Empty');
        });

        it('sets selected to true when no iconName', () => {
            block.iconName = '';
            const icon = block.makeEmptyIcon();

            expect(icon.getAttribute('selected')).toBe('true');
        });

        it('sets selected to false when iconName exists', () => {
            block.iconName = 'icon1';
            const icon = block.makeEmptyIcon();

            expect(icon.getAttribute('selected')).toBe('false');
        });
    });

    describe('makeIconValueElement', () => {
        it('creates img element with correct src and alt', () => {
            const icon = { value: '/path/to/icon.svg', title: 'My Icon' };
            const img = block.makeIconValueElement(icon);

            expect(img.tagName).toBe('IMG');
            expect(img.getAttribute('src')).toBe('/path/to/icon.svg');
            expect(img.getAttribute('alt')).toBe('My Icon');
        });
    });

    describe('apiUpdateIcon', () => {
        it('updates iconName property', () => {
            block.apiUpdateIcon('new-icon');
            expect(block.iconName).toBe('new-icon');
        });

        it('calls apiSendDataService when id exists', async () => {
            const spy = vi
                .spyOn(block, 'apiSendDataService')
                .mockResolvedValue({ responseMessage: 'OK' });
            await block.apiUpdateIcon('new-icon');
            expect(spy).toHaveBeenCalledWith('putSaveBlock', [
                'odePagStructureSyncId',
                'iconName',
            ]);
        });
    });

    describe('apiUpdateTitle', () => {
        beforeEach(() => {
            block.blockNameElementText = document.createElement('h1');
        });

        it('updates blockName property', () => {
            block.apiUpdateTitle('New Title');
            expect(block.blockName).toBe('New Title');
        });

        it('updates blockNameElementText innerHTML', () => {
            block.apiUpdateTitle('New Title');
            expect(block.blockNameElementText.innerHTML).toBe('New Title');
        });

        it('does not sync to Yjs directly (handled by apiCallManager)', () => {
            // Yjs sync is now handled by putSaveBlock -> apiCallManager
            // to avoid duplicate undo entries
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    updateBlock: mockUpdateBlock,
                },
            };
            block.apiUpdateTitle('New Title');
            // Should NOT be called here - apiCallManager handles it
            expect(mockUpdateBlock).not.toHaveBeenCalled();
        });
    });

    describe('makeModalChangeIconBody', () => {
        it('creates modal body with icons', () => {
            const body = block.makeModalChangeIconBody();

            expect(body.id).toBe('change-block-icon-modal-content');
            expect(body.querySelector('.empty-block-icon')).not.toBeNull();
        });

        it('includes theme icons', () => {
            const body = block.makeModalChangeIconBody();
            const icons = body.querySelectorAll('.option-block-icon');

            expect(icons.length).toBeGreaterThan(1);
        });
    });

    describe('showModalChangeIcon', () => {
        it('calls confirm modal show with correct params', () => {
            block.showModalChangeIcon();

            expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            const callArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            expect(callArgs.title).toBe('Select icon');
            expect(callArgs.confirmButtonText).toBe('Save');
            expect(callArgs.cancelButtonText).toBe('Cancel');
        });
    });

    describe('moveToPageViaYjs', () => {
        it('returns ERROR when structureBinding not available', async () => {
            eXeLearning.app.project._yjsBridge = null;
            const result = await block.moveToPageViaYjs('target-page');
            expect(result.responseMessage).toBe('ERROR');
        });

        it('calls moveBlockToPage when structureBinding available', async () => {
            const mockMoveBlock = vi.fn().mockReturnValue(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockToPage: mockMoveBlock,
                },
            };

            const spy = vi.spyOn(block, 'remove').mockImplementation(() => {});
            const result = await block.moveToPageViaYjs('target-page');

            expect(mockMoveBlock).toHaveBeenCalledWith('block-id-1', 'target-page');
            expect(result.responseMessage).toBe('OK');
        });

        it('updates internal references on success', async () => {
            const mockMoveBlock = vi.fn().mockReturnValue(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockToPage: mockMoveBlock,
                },
            };

            vi.spyOn(block, 'remove').mockImplementation(() => {});
            await block.moveToPageViaYjs('new-target-page');

            expect(block.odeNavStructureSyncId).toBe('new-target-page');
            expect(block.pageId).toBe('new-target-page');
        });
    });

    describe('downloadBlockSelected', () => {
        it('throws error when Yjs bridge not initialized', async () => {
            eXeLearning.app.project._yjsBridge = null;
            await block.downloadBlockSelected('block-1');
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Download error',
                }),
            );
        });
    });

    describe('test method', () => {
        it('logs click message', () => {
            // Logger is bound at module import time to window.AppLogger from vitest.setup.js
            // (since ES6 imports are hoisted before test file code runs)
            // vitest.setup.js sets global.Logger = mockLogger with log: vi.fn()
            block.test();
            expect(global.Logger.log).toHaveBeenCalledWith('click');
        });
    });

    describe('toggleOff', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
            block.toggleElement = document.createElement('button');
            block.toggleElement.innerHTML = '<span>keyboard_arrow_down</span>';
            block.toggleElement.classList.add('box-toggle-on');
        });

        it('adds hidden-idevices class to blockContent', () => {
            block.toggleOff();
            expect(block.blockContent.classList.contains('hidden-idevices')).toBe(true);
        });

        it('removes dropdown-menu-on class from blockContent', () => {
            block.blockContent.classList.add('dropdown-menu-on');
            block.toggleOff();
            expect(block.blockContent.classList.contains('dropdown-menu-on')).toBe(false);
        });

        it('toggles toggle element classes', () => {
            block.toggleOff();
            expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(true);
            expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(false);
        });

        it('updates toggle element title and icon', () => {
            block.toggleOff();
            expect(block.toggleElement.getAttribute('title')).toBe('Show');
            expect(block.toggleElement.querySelector('span').innerHTML).toBe('keyboard_arrow_up');
        });
    });

    describe('toggleOn', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
            block.blockContent.classList.add('hidden-idevices');
            block.toggleElement = document.createElement('button');
            block.toggleElement.innerHTML = '<span>keyboard_arrow_up</span>';
            block.toggleElement.classList.add('box-toggle-off');
        });

        it('removes hidden-idevices class from blockContent', () => {
            block.toggleOn();
            expect(block.blockContent.classList.contains('hidden-idevices')).toBe(false);
        });

        it('toggles toggle element classes', () => {
            block.toggleOn();
            expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(true);
            expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(false);
        });

        it('updates toggle element title and icon', () => {
            block.toggleOn();
            expect(block.toggleElement.getAttribute('title')).toBe('Hide');
            expect(block.toggleElement.querySelector('span').innerHTML).toBe('keyboard_arrow_down');
        });
    });

    describe('generateModalMoveToPageBody', () => {
        it('creates body with text and select elements', () => {
            const body = block.generateModalMoveToPageBody();

            expect(body.querySelector('.text-info-move-to-page')).not.toBeNull();
            expect(body.querySelector('.select-move-to-page')).not.toBeNull();
        });

        it('adds pages as options', () => {
            eXeLearning.app.project.structure.getAllNodesOrderByView = vi.fn().mockReturnValue([
                { id: 'page-1', deep: 0, pageName: 'Home' },
                { id: 'page-2', deep: 1, pageName: 'Chapter 1' },
            ]);

            const body = block.generateModalMoveToPageBody();
            const options = body.querySelectorAll('option');

            expect(options.length).toBe(2);
            expect(options[0].value).toBe('page-1');
            expect(options[1].value).toBe('page-2');
        });

        it('marks current page as selected', () => {
            block.odeNavStructureSyncId = 'page-2';
            eXeLearning.app.project.structure.getAllNodesOrderByView = vi.fn().mockReturnValue([
                { id: 'page-1', deep: 0, pageName: 'Home' },
                { id: 'page-2', deep: 1, pageName: 'Chapter 1' },
            ]);

            const body = block.generateModalMoveToPageBody();
            const selectedOption = body.querySelector('option[selected]');

            expect(selectedOption.value).toBe('page-2');
        });
    });

    describe('saveIconAction', () => {
        beforeEach(() => {
            const modalBody = document.createElement('div');
            const iconElement = document.createElement('div');
            iconElement.classList.add('option-block-icon');
            iconElement.setAttribute('selected', 'true');
            iconElement.setAttribute('icon-id', 'test-icon');
            modalBody.appendChild(iconElement);
            eXeLearning.app.modals.confirm.modalElementBody = modalBody;

            block.apiUpdateIcon = vi.fn();
        });

        it('gets icon value from selected element', () => {
            block.saveIconAction();
            expect(block.apiUpdateIcon).toHaveBeenCalledWith('test-icon');
        });

        it('uses empty string when icon is 0', () => {
            const modalBody = eXeLearning.app.modals.confirm.modalElementBody;
            modalBody.querySelector('.option-block-icon').setAttribute('icon-id', '0');

            block.saveIconAction();
            expect(block.apiUpdateIcon).toHaveBeenCalledWith('');
        });

        it('does not sync to Yjs directly (handled by apiCallManager)', () => {
            // Yjs sync is now handled by apiUpdateIcon -> putSaveBlock -> apiCallManager
            // to avoid duplicate undo entries
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { updateBlock: mockUpdateBlock },
            };

            block.saveIconAction();

            // Should NOT be called here - apiCallManager handles it
            expect(mockUpdateBlock).not.toHaveBeenCalled();
        });
    });

    describe('goWindowToBlock', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            window.location.hash = '';
        });

        it('sets window location hash after delay', () => {
            block.goWindowToBlock(100);
            vi.advanceTimersByTime(100);
            // In JSDOM, window.location.hash may not include the #
            expect(window.location.hash).toContain(block.blockId);
        });
    });

    describe('makeEmptyIcon', () => {
        it('creates empty icon element', () => {
            const emptyIcon = block.makeEmptyIcon();
            expect(emptyIcon.classList.contains('empty-block-icon')).toBe(true);
        });
    });

    describe('generateBlockContentNode', () => {
        it('returns blockContent element when creating new node', () => {
            // Set newNode=true to create a new block content node
            const content = block.generateBlockContentNode(true);
            expect(content).toBeDefined();
            expect(content.classList.contains('box')).toBe(true);
        });

        it('adds draggable class when draggable is true', () => {
            const content = block.generateBlockContentNode(true);
            expect(content.classList.contains('draggable')).toBe(true);
        });
    });

    describe('setProperties', () => {
        it('updates properties.value from data object', () => {
            const props = {
                identifier: { value: 'test-id' },
                visibility: { value: 'true' },
                cssClass: { value: 'custom-class' },
            };

            block.setProperties(props);

            expect(block.properties.identifier.value).toBe('test-id');
            expect(block.properties.visibility.value).toBe('true');
            expect(block.properties.cssClass.value).toBe('custom-class');
        });

        it('handles onlyHeritable flag', () => {
            const props = {
                identifier: { value: 'test-id', heritable: true },
                visibility: { value: 'true', heritable: false },
            };

            block.setProperties(props, true);

            expect(block.properties.identifier.value).toBe('test-id');
            // visibility should not be updated since heritable is false
        });
    });

    describe('updateParam', () => {
        it('updates parameter value', () => {
            block.updateParam('blockName', 'New Name');
            expect(block.blockName).toBe('New Name');
        });
    });

    describe('setPropertiesClassesToElement', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
            block.toggleElement = document.createElement('button');
            block.toggleElement.innerHTML = '<span>keyboard_arrow_down</span>';
        });

        it('sets identifier attribute when value exists', () => {
            block.properties.identifier.value = 'my-block-id';
            block.setPropertiesClassesToElement();
            expect(block.blockContent.getAttribute('identifier')).toBe('my-block-id');
        });

        it('sets export-view attribute when visibility is true', () => {
            block.properties.visibility.value = 'true';
            block.setPropertiesClassesToElement();
            expect(block.blockContent.getAttribute('export-view')).toBe('true');
        });

        it('adds css classes when cssClass has value', () => {
            block.properties.cssClass.value = 'class1 class2';
            block.setPropertiesClassesToElement();
            expect(block.blockContent.classList.contains('class1')).toBe(true);
            expect(block.blockContent.classList.contains('class2')).toBe(true);
        });

        it('calls toggleOff when minimized is true', () => {
            const toggleOffSpy = vi.spyOn(block, 'toggleOff').mockImplementation(() => {});
            block.properties.minimized.value = 'true';
            block.setPropertiesClassesToElement();
            expect(toggleOffSpy).toHaveBeenCalled();
        });
    });

    describe('makeIconNameElement', () => {
        beforeEach(() => {
            block.iconElement = null;
        });

        it('creates icon element', () => {
            const iconEl = block.makeIconNameElement();
            expect(iconEl).toBeDefined();
            expect(iconEl.classList.contains('exe-icon')).toBe(true);
            expect(iconEl.classList.contains('box-icon')).toBe(true);
        });

        it('shows empty icon when no iconName set', () => {
            block.iconName = null;
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(true);
        });

        it('uses theme icon when iconName exists', () => {
            block.iconName = 'icon1';
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
            }));
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });
    });

    describe('makeIconValueElement', () => {
        it('creates img element with src and alt', () => {
            const icon = { value: '/path/to/icon.svg', title: 'Test Icon' };
            const iconValue = block.makeIconValueElement(icon);
            expect(iconValue.tagName).toBe('IMG');
            expect(iconValue.getAttribute('src')).toBe('/path/to/icon.svg');
            expect(iconValue.getAttribute('alt')).toBe('Test Icon');
        });
    });

    describe('makeBlockHeadElement', () => {
        beforeEach(() => {
            block.blockId = 'test-block-id';
            block.blockName = 'Test Block';
            vi.spyOn(block, 'addBehaviourChangeIcon').mockImplementation(() => {});
        });

        it('creates header element', () => {
            const header = block.makeBlockHeadElement();
            expect(header.tagName).toBe('HEADER');
            expect(header.classList.contains('box-head')).toBe(true);
        });

        it('includes toggle button', () => {
            const header = block.makeBlockHeadElement();
            const toggleBtn = header.querySelector('.box-toggler');
            expect(toggleBtn).not.toBeNull();
        });

        it('sets drag attributes', () => {
            const header = block.makeBlockHeadElement();
            expect(header.getAttribute('draggable')).toBe('true');
            expect(header.getAttribute('drag')).toBe('box');
        });
    });

    describe('makeBlockTitleElementText', () => {
        beforeEach(() => {
            block.blockId = 'test-block-id';
            block.blockName = 'Test Block';
            vi.spyOn(block, 'addBehaviourChangeIcon').mockImplementation(() => {});
        });

        it('creates title container element', () => {
            const titleContainer = block.makeBlockTitleElementText();
            expect(titleContainer.classList.contains('content-editable-title')).toBe(true);
        });

        it('includes h1 element with blockName', () => {
            const titleContainer = block.makeBlockTitleElementText();
            const h1 = titleContainer.querySelector('h1');
            expect(h1).not.toBeNull();
            expect(h1.innerHTML).toBe('Test Block');
        });

        it('includes edit button', () => {
            const titleContainer = block.makeBlockTitleElementText();
            const editBtn = titleContainer.querySelector('.btn-edit-title');
            expect(editBtn).not.toBeNull();
        });
    });

    describe('makeBlockButtonsElement', () => {
        beforeEach(() => {
            block.blockId = 'test-block-id';
            vi.spyOn(block, 'addBehaviourButtonDropDown').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonMoveUpBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonMoveDownBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonDeleteBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonPropertiesBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonCloneBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourMoveToPageBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourExportBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourToggleBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addTooltips').mockImplementation(() => {});
            vi.spyOn(block, 'addNoTranslateForGoogle').mockImplementation(() => {});
        });

        it('creates buttons container', () => {
            const buttons = block.makeBlockButtonsElement();
            expect(buttons.classList.contains('box_actions')).toBe(true);
        });

        it('includes move up button', () => {
            const buttons = block.makeBlockButtonsElement();
            expect(buttons.querySelector('.btn-move-up')).not.toBeNull();
        });

        it('includes move down button', () => {
            const buttons = block.makeBlockButtonsElement();
            expect(buttons.querySelector('.btn-move-down')).not.toBeNull();
        });

        it('includes dropdown menu', () => {
            const buttons = block.makeBlockButtonsElement();
            expect(buttons.querySelector('.dropdown-menu')).not.toBeNull();
        });

        it('calls all behaviour methods', () => {
            block.makeBlockButtonsElement();
            expect(block.addBehaviourButtonDropDown).toHaveBeenCalled();
            expect(block.addBehaviourButtonMoveUpBlock).toHaveBeenCalled();
            expect(block.addBehaviourButtonMoveDownBlock).toHaveBeenCalled();
            expect(block.addBehaviourButtonDeleteBlock).toHaveBeenCalled();
        });
    });

    describe('getCurrentOrder', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
        });

        it('returns order from previous block when exists', () => {
            const prevBlock = document.createElement('div');
            prevBlock.classList.add('box');
            prevBlock.setAttribute('order', '5');

            const container = document.createElement('div');
            container.appendChild(prevBlock);
            container.appendChild(block.blockContent);

            const order = block.getCurrentOrder();
            expect(order).toBe(6);
        });

        it('returns order from next block when previous does not exist', () => {
            const nextBlock = document.createElement('div');
            nextBlock.classList.add('box');
            nextBlock.setAttribute('order', '10');

            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            container.appendChild(nextBlock);

            const order = block.getCurrentOrder();
            expect(order).toBe(9);
        });

        it('returns -1 when no adjacent blocks', () => {
            const container = document.createElement('div');
            container.appendChild(block.blockContent);

            const order = block.getCurrentOrder();
            expect(order).toBe(-1);
        });
    });

    describe('getContentPrevBlock', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
        });

        it('returns previous element when it has box class', () => {
            const prevBlock = document.createElement('div');
            prevBlock.classList.add('box');

            const container = document.createElement('div');
            container.appendChild(prevBlock);
            container.appendChild(block.blockContent);

            const result = block.getContentPrevBlock();
            expect(result).toBe(prevBlock);
        });

        it('returns false when previous element does not have box class', () => {
            const prevElement = document.createElement('div');

            const container = document.createElement('div');
            container.appendChild(prevElement);
            container.appendChild(block.blockContent);

            const result = block.getContentPrevBlock();
            expect(result).toBe(false);
        });

        it('returns false when no previous element', () => {
            const container = document.createElement('div');
            container.appendChild(block.blockContent);

            const result = block.getContentPrevBlock();
            expect(result).toBe(false);
        });
    });

    describe('getContentNextBlock', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
        });

        it('returns next element when it has box class', () => {
            const nextBlock = document.createElement('div');
            nextBlock.classList.add('box');

            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            container.appendChild(nextBlock);

            const result = block.getContentNextBlock();
            expect(result).toBe(nextBlock);
        });

        it('returns false when next element does not have box class', () => {
            const nextElement = document.createElement('div');

            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            container.appendChild(nextElement);

            const result = block.getContentNextBlock();
            expect(result).toBe(false);
        });
    });

    describe('apiUpdateTitle', () => {
        beforeEach(() => {
            block.id = 'server-id-123';
            block.blockNameElementText = document.createElement('h1');
            vi.spyOn(block, 'apiSendDataService').mockResolvedValue({ responseMessage: 'OK' });
        });

        it('updates blockName property', () => {
            block.apiUpdateTitle('New Title');
            expect(block.blockName).toBe('New Title');
        });

        it('updates blockNameElementText innerHTML', () => {
            block.apiUpdateTitle('New Title');
            expect(block.blockNameElementText.innerHTML).toBe('New Title');
        });

        it('does not sync to Yjs directly (handled by apiCallManager)', () => {
            // Yjs sync is now handled by putSaveBlock -> apiCallManager
            // to avoid duplicate undo entries
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { updateBlock: mockUpdateBlock },
            };

            block.apiUpdateTitle('New Title');

            // Should NOT be called here - apiCallManager handles it
            expect(mockUpdateBlock).not.toHaveBeenCalled();
        });

        it('calls apiSendDataService when id exists', () => {
            block.apiUpdateTitle('New Title');
            expect(block.apiSendDataService).toHaveBeenCalledWith('putSaveBlock', ['odePagStructureSyncId', 'blockName']);
        });
    });

    describe('apiUpdateIcon', () => {
        beforeEach(() => {
            block.id = 'server-id-123';
            vi.spyOn(block, 'apiSendDataService').mockResolvedValue({ responseMessage: 'OK' });
            vi.spyOn(block, 'makeIconNameElement').mockImplementation(() => {});
        });

        it('updates iconName property', () => {
            block.apiUpdateIcon('new-icon');
            expect(block.iconName).toBe('new-icon');
        });

        it('calls apiSendDataService when id exists', () => {
            block.apiUpdateIcon('new-icon');
            expect(block.apiSendDataService).toHaveBeenCalled();
        });
    });

    describe('apiCloneBlock', () => {
        beforeEach(() => {
            block.id = 'block-to-clone';
            block.cloneBlockViaYjs = vi.fn();
        });

        it('delegates to cloneBlockViaYjs', async () => {
            block.cloneBlockViaYjs.mockResolvedValue({
                responseMessage: 'OK',
                clonedBlock: { id: 'cloned-id' },
            });

            const result = await block.apiCloneBlock();

            expect(block.cloneBlockViaYjs).toHaveBeenCalled();
            expect(result.responseMessage).toBe('OK');
        });
    });

    describe('cloneBlockViaYjs', () => {
        beforeEach(() => {
            block.id = 'block-to-clone';
            block.blockId = 'block-to-clone';
            block.pageId = 'page-1';
            block.engine = {
                loadApiIdevicesInPage: vi.fn().mockResolvedValue(true),
                getBlockById: vi.fn(),
            };
            block.showModalMessageErrorDatabase = vi.fn();
        });

        it('clones block via Yjs on success', async () => {
            const mockClonedBlock = { id: 'cloned-block-id' };
            eXeLearning.app.project._yjsBridge = {
                cloneBlock: vi.fn().mockReturnValue(mockClonedBlock),
            };
            const mockClonedBlockNode = {
                goWindowToBlock: vi.fn(),
                blockContent: { classList: { add: vi.fn(), remove: vi.fn() } },
            };
            block.engine.getBlockById.mockReturnValue(mockClonedBlockNode);

            const result = await block.cloneBlockViaYjs();

            expect(eXeLearning.app.project._yjsBridge.cloneBlock).toHaveBeenCalledWith('page-1', 'block-to-clone');
            expect(block.engine.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
            expect(result.responseMessage).toBe('OK');
        });

        it('returns error when cloneBlock fails', async () => {
            eXeLearning.app.project._yjsBridge = {
                cloneBlock: vi.fn().mockReturnValue(null),
            };

            const result = await block.cloneBlockViaYjs();

            expect(result.responseMessage).toBe('ERROR');
            expect(block.showModalMessageErrorDatabase).toHaveBeenCalled();
        });

        it('returns error when bridge not available', async () => {
            eXeLearning.app.project._yjsBridge = null;

            const result = await block.cloneBlockViaYjs();

            expect(result.responseMessage).toBe('ERROR');
            expect(block.showModalMessageErrorDatabase).toHaveBeenCalled();
        });
    });

    describe('removeIdevices', () => {
        it('only removes iDevices that belong to this block', () => {
            const mockIdevice1 = {
                blockId: 'test-block-id',
                remove: vi.fn(),
            };
            const mockIdevice2 = {
                blockId: 'other-block-id', // Different block
                remove: vi.fn(),
            };
            const mockIdevice3 = {
                blockId: 'test-block-id',
                remove: vi.fn(),
            };

            block.idevices = [mockIdevice1, mockIdevice2, mockIdevice3];
            block.blockId = 'test-block-id';

            // Mock clearIdevicesOfList to not modify the array
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdevices();

            // Only iDevices with matching blockId should be removed
            expect(mockIdevice1.remove).toHaveBeenCalledWith(false);
            expect(mockIdevice2.remove).not.toHaveBeenCalled(); // Different block
            expect(mockIdevice3.remove).toHaveBeenCalledWith(false);
        });

        it('calls clearIdevicesOfList before removing', () => {
            block.idevices = [];
            block.blockId = 'test-block-id';

            const clearSpy = vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdevices();

            expect(clearSpy).toHaveBeenCalled();
        });

        it('handles empty idevices array', () => {
            block.idevices = [];
            block.blockId = 'test-block-id';

            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            // Should not throw
            expect(() => block.removeIdevices()).not.toThrow();
        });

        it('does not remove iDevices from other blocks (prevents cascading deletion)', () => {
            const mockIdeviceFromOtherBlock = {
                blockId: 'completely-different-block',
                remove: vi.fn(),
            };

            block.idevices = [mockIdeviceFromOtherBlock];
            block.blockId = 'test-block-id';

            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdevices();

            // Should NOT be removed because it belongs to a different block
            expect(mockIdeviceFromOtherBlock.remove).not.toHaveBeenCalled();
        });
    });

    describe('removeIdeviceOfListById', () => {
        it('removes iDevice by id', () => {
            const mockIdevice1 = { id: 'idevice-1', odeIdeviceId: 'ode-1' };
            const mockIdevice2 = { id: 'idevice-2', odeIdeviceId: 'ode-2' };
            const mockIdevice3 = { id: 'idevice-3', odeIdeviceId: 'ode-3' };

            block.idevices = [mockIdevice1, mockIdevice2, mockIdevice3];
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdeviceOfListById('idevice-2');

            expect(block.idevices).toHaveLength(2);
            expect(block.idevices).not.toContain(mockIdevice2);
            expect(block.idevices).toContain(mockIdevice1);
            expect(block.idevices).toContain(mockIdevice3);
        });

        it('removes iDevice by odeIdeviceId', () => {
            const mockIdevice1 = { id: 'idevice-1', odeIdeviceId: 'ode-1' };
            const mockIdevice2 = { id: 'idevice-2', odeIdeviceId: 'ode-2' };

            block.idevices = [mockIdevice1, mockIdevice2];
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdeviceOfListById('ode-2');

            expect(block.idevices).toHaveLength(1);
            expect(block.idevices).not.toContain(mockIdevice2);
            expect(block.idevices).toContain(mockIdevice1);
        });

        it('calls clearIdevicesOfList before filtering', () => {
            block.idevices = [];
            const clearSpy = vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdeviceOfListById('any-id');

            expect(clearSpy).toHaveBeenCalled();
        });

        it('handles non-existent id gracefully', () => {
            const mockIdevice = { id: 'idevice-1', odeIdeviceId: 'ode-1' };
            block.idevices = [mockIdevice];
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdeviceOfListById('non-existent-id');

            // Original idevice should still be there
            expect(block.idevices).toHaveLength(1);
            expect(block.idevices).toContain(mockIdevice);
        });

        it('removes iDevice when either id or odeIdeviceId matches', () => {
            const mockIdevice = { id: 'matching-id', odeIdeviceId: 'ode-id' };
            block.idevices = [mockIdevice];
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            // Remove by id
            block.removeIdeviceOfListById('matching-id');

            expect(block.idevices).toHaveLength(0);
        });
    });

    describe('clearIdevicesOfList', () => {
        it('removes iDevices not in engine components list', () => {
            const mockIdevice1 = { hasBeenDeleted: false };
            const mockIdevice2 = { hasBeenDeleted: false };

            // Only mockIdevice1 is in engine.components.idevices
            block.engine.components = { idevices: [mockIdevice1] };
            block.idevices = [mockIdevice1, mockIdevice2];

            block.clearIdevicesOfList();

            expect(block.idevices).toHaveLength(1);
            expect(block.idevices).toContain(mockIdevice1);
            expect(mockIdevice2.hasBeenDeleted).toBe(true);
        });

        it('handles empty idevices array', () => {
            block.engine.components = { idevices: [] };
            block.idevices = [];

            expect(() => block.clearIdevicesOfList()).not.toThrow();
            expect(block.idevices).toHaveLength(0);
        });
    });

});
