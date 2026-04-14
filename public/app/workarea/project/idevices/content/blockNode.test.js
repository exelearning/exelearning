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
    });

    describe('setProperties', () => {
        it('sets property values from data', () => {
            block.setProperties({
                visibility: { value: 'true' },
                cssClass: { value: 'my-class' },
            });

            expect(block.properties.visibility.value).toBe('true');
            expect(block.properties.cssClass.value).toBe('my-class');
        });

        it('only sets heritable properties when onlyHeritable is true', () => {
            block.setProperties(
                {
                    visibility: { value: 'true', heritable: false },
                },
                true,
            );

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
        });

        it('loads properties from Yjs when enabled', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getBlockProperties: vi.fn(() => ({
                        visibility: true,
                        cssClass: 'yjs-class',
                    })),
                },
            };

            block.loadPropertiesFromYjs();

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

        it('shows visibility off indicator when visibility is false', () => {
            block.properties.visibility.value = 'false';
            const node = block.generateBlockContentNode(true);
            const indicator = node.querySelector('.visibility-off-indicator');
            expect(indicator).not.toBeNull();
            expect(indicator.querySelector('.exe-visibility-off-green-icon')).not.toBeNull();
        });

        it('does not show visibility off indicator when visibility is true', () => {
            block.properties.visibility.value = 'true';
            const node = block.generateBlockContentNode(true);
            const indicator = node.querySelector('.visibility-off-indicator');
            expect(indicator).toBeNull();
        });

        it('shows teacher-only indicator when teacherOnly is true', () => {
            block.properties.teacherOnly = { value: 'true' };
            const node = block.generateBlockContentNode(true);
            const indicator = node.querySelector('.teacher-only-indicator');
            expect(indicator).not.toBeNull();
            expect(indicator.querySelector('.exe-teacher-only-icon')).not.toBeNull();
            expect(indicator.querySelector('.visually-hidden').textContent).toBeTruthy();
        });

        it('does not show teacher-only indicator when teacherOnly is false', () => {
            block.properties.teacherOnly = { value: 'false' };
            const node = block.generateBlockContentNode(true);
            const indicator = node.querySelector('.teacher-only-indicator');
            expect(indicator).toBeNull();
        });

        it('shows both indicators when visibility is false and teacherOnly is true', () => {
            block.properties.visibility.value = 'false';
            block.properties.teacherOnly = { value: 'true' };
            const node = block.generateBlockContentNode(true);
            const visIndicator = node.querySelector('.visibility-off-indicator');
            const teacherIndicator = node.querySelector('.teacher-only-indicator');
            expect(visIndicator).not.toBeNull();
            expect(teacherIndicator).not.toBeNull();
            // Both at same left, stacked vertically
            expect(visIndicator.style.left).toBe('-32px');
            expect(teacherIndicator.style.left).toBe('-32px');
            expect(visIndicator.style.top).toBe('2px');
            expect(teacherIndicator.style.top).toBe('26px');
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

        it('adds exe-teacher-highlight class when teacherOnly is true', () => {
            block.properties.teacherOnly = { value: 'true' };
            block.setPropertiesClassesToElement();

            expect(block.blockContent.classList.contains('exe-teacher-highlight')).toBe(true);
        });

        it('does not add exe-teacher-highlight class when teacherOnly is false', () => {
            block.properties.teacherOnly = { value: 'false' };
            block.setPropertiesClassesToElement();

            expect(block.blockContent.classList.contains('exe-teacher-highlight')).toBe(false);
        });

        it('calls toggleOff when minimized is true', () => {
            const spy = vi.spyOn(block, 'toggleOff');
            block.properties.minimized.value = 'true';
            block.setPropertiesClassesToElement();

            expect(spy).toHaveBeenCalled();
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

    // Regression #1665: arrow-driven reorder must consult the Y.Doc as the
    // source of truth for the block's current position. reorderViaYjsRelative
    // is the entrypoint the click handlers use when Yjs is enabled.
    describe('reorderViaYjsRelative', () => {
        let blockContent;

        beforeEach(() => {
            blockContent = document.createElement('div');
            blockContent.classList.add('moving');
            block.blockContent = blockContent;
        });

        it('falls back to reorderViaYjs when structureBinding is missing', async () => {
            eXeLearning.app.project._yjsBridge = null;
            const fallback = vi
                .spyOn(block, 'reorderViaYjs')
                .mockResolvedValue({ responseMessage: 'ERROR' });

            const result = await block.reorderViaYjsRelative(+1);

            expect(fallback).toHaveBeenCalled();
            expect(result.responseMessage).toBe('ERROR');
        });

        it('falls back to reorderViaYjs when moveBlockRelative is not exposed by the bridge', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    // Older bridge: only the absolute method exists.
                    updateBlockOrder: vi.fn(),
                    findBlockLocation: vi.fn(),
                },
            };
            const fallback = vi
                .spyOn(block, 'reorderViaYjs')
                .mockResolvedValue({ responseMessage: 'OK' });

            const result = await block.reorderViaYjsRelative(-1);

            expect(fallback).toHaveBeenCalled();
            expect(result.responseMessage).toBe('OK');
        });

        it('calls moveBlockRelative with this.blockId and the delta on the happy path', async () => {
            const mockMove = vi.fn().mockReturnValue(true);
            const mockFind = vi.fn().mockReturnValue({ index: 3 });
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: mockFind,
                },
            };

            const result = await block.reorderViaYjsRelative(+1);

            expect(mockMove).toHaveBeenCalledWith('block-id-1', +1);
            expect(result.responseMessage).toBe('OK');
        });

        it('reconciles this.order with the new index reported by findBlockLocation', async () => {
            const mockMove = vi.fn().mockReturnValue(true);
            const mockFind = vi.fn().mockReturnValue({ index: 4 });
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: mockFind,
                },
            };

            block.order = 1;
            await block.reorderViaYjsRelative(+1);

            expect(mockFind).toHaveBeenCalledWith('block-id-1');
            expect(block.order).toBe(4);
        });

        it('does not fail when findBlockLocation is missing on the bridge', async () => {
            const mockMove = vi.fn().mockReturnValue(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    // findBlockLocation intentionally absent
                },
            };

            block.order = 7;
            const result = await block.reorderViaYjsRelative(-1);

            expect(result.responseMessage).toBe('OK');
            // No reconciliation possible — order stays at the previous value.
            expect(block.order).toBe(7);
        });

        it('retries with this.id when this.blockId fails and the two ids differ', async () => {
            const mockMove = vi
                .fn()
                .mockReturnValueOnce(false) // first call with blockId fails
                .mockReturnValueOnce(true); // retry with id succeeds
            const mockFind = vi.fn().mockReturnValue({ index: 0 });
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: mockFind,
                },
            };

            // Make blockId and id differ.
            block.id = 'different-id';
            block.blockId = 'block-id-1';

            const result = await block.reorderViaYjsRelative(+1);

            expect(mockMove).toHaveBeenCalledTimes(2);
            expect(mockMove).toHaveBeenNthCalledWith(1, 'block-id-1', +1);
            expect(mockMove).toHaveBeenNthCalledWith(2, 'different-id', +1);
            expect(result.responseMessage).toBe('OK');
        });

        it('returns ERROR when moveBlockRelative reports failure even after the retry', async () => {
            const mockMove = vi.fn().mockReturnValue(false);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: vi.fn(),
                },
            };

            const result = await block.reorderViaYjsRelative(+1);
            expect(result.responseMessage).toBe('ERROR');
        });

        it('returns ERROR when moveBlockRelative throws', async () => {
            const mockMove = vi.fn(() => {
                throw new Error('boom');
            });
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: vi.fn(),
                },
            };
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await block.reorderViaYjsRelative(+1);

            expect(result.responseMessage).toBe('ERROR');
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('schedules removal of the moving CSS class on success', async () => {
            vi.useFakeTimers();
            try {
                eXeLearning.app.project._yjsBridge = {
                    structureBinding: {
                        moveBlockRelative: vi.fn().mockReturnValue(true),
                        findBlockLocation: vi.fn().mockReturnValue({ index: 2 }),
                    },
                };

                expect(blockContent.classList.contains('moving')).toBe(true);
                await block.reorderViaYjsRelative(+1);
                // Class is still present immediately after the call (the
                // handler clears it on a timer to keep the CSS animation).
                expect(blockContent.classList.contains('moving')).toBe(true);

                vi.advanceTimersByTime(mockEngine.movingClassDuration + 10);
                expect(blockContent.classList.contains('moving')).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    // The arrow click handlers themselves used to mutate `this.order`
    // before forwarding to apiUpdateOrder. Issue #1665 changed them to
    // route through reorderViaYjsRelative when Yjs is enabled. These tests
    // exercise the click path via the real DOM button to make sure that
    // - the move CSS class is added,
    // - reorderViaYjsRelative is called with the right delta,
    // - the DOM block is reinserted next to its neighbour on success,
    // - the legacy non-Yjs path still mutates this.order and goes through
    //   apiUpdateOrder.
    describe('addBehaviourButtonMoveUpBlock / addBehaviourButtonMoveDownBlock', () => {
        let upButton;
        let downButton;
        let prevBlock;
        let nextBlock;
        let nodeContent;
        let originalDollar;
        let originalCheckOpenIdevice;
        let originalIsAvailable;

        beforeEach(() => {
            // Build a buttons container with the two arrow buttons. The
            // handlers locate them by id (#moveUp<blockId> / #moveDown<blockId>).
            block.blockButtons = document.createElement('div');
            upButton = document.createElement('button');
            upButton.id = `moveUp${block.blockId}`;
            block.blockButtons.appendChild(upButton);
            downButton = document.createElement('button');
            downButton.id = `moveDown${block.blockId}`;
            block.blockButtons.appendChild(downButton);

            // The block lives inside a node-content container with a
            // sibling that the handler will use as previousBlock / nextBlock.
            // getContentPrevBlock / getContentNextBlock require the .box class.
            nodeContent = document.createElement('div');
            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('box');
            prevBlock = document.createElement('article');
            prevBlock.classList.add('box');
            nextBlock = document.createElement('article');
            nextBlock.classList.add('box');
            nodeContent.appendChild(prevBlock);
            nodeContent.appendChild(block.blockContent);
            nodeContent.appendChild(nextBlock);
            mockEngine.nodeContentElement = nodeContent;

            // Stub jQuery: the handler reads $('#dropdownMenuButton<id>').
            // vitest.setup.js loads real jQuery as global.$, so save and
            // restore around the test instead of deleting.
            originalDollar = global.$;
            global.$ = vi.fn(() => ({
                attr: vi.fn(() => 'false'),
                trigger: vi.fn(),
            }));

            originalCheckOpenIdevice = eXeLearning.app.project.checkOpenIdevice;
            originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            global.$ = originalDollar;
            eXeLearning.app.project.checkOpenIdevice = originalCheckOpenIdevice;
            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
        });

        it('move-up handler routes through reorderViaYjsRelative(-1) when Yjs is enabled', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });

            block.addBehaviourButtonMoveUpBlock();
            upButton.click();

            await vi.waitFor(() => {
                expect(reorderSpy).toHaveBeenCalledWith(-1);
            });
            // moving class is added before the await.
            expect(block.blockContent.classList.contains('moving')).toBe(true);
            // After the promise resolves, the block is reinserted before
            // its previous sibling.
            await vi.waitFor(() => {
                expect(nodeContent.children[0]).toBe(block.blockContent);
            });
        });

        it('move-up handler does nothing when there is no previous block', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });
            // Move the block to the very top: no previous sibling.
            nodeContent.removeChild(prevBlock);
            nodeContent.insertBefore(block.blockContent, nodeContent.firstChild);

            block.addBehaviourButtonMoveUpBlock();
            upButton.click();
            // Wait one microtask so the isAvalaibleOdeComponent promise resolves.
            await new Promise((r) => setTimeout(r, 0));

            expect(reorderSpy).not.toHaveBeenCalled();
            expect(block.blockContent.classList.contains('moving')).toBe(false);
        });

        it('move-up handler skips the click when checkOpenIdevice is true', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);

            block.addBehaviourButtonMoveUpBlock();
            upButton.click();
            await new Promise((r) => setTimeout(r, 0));

            expect(reorderSpy).not.toHaveBeenCalled();
            expect(block.blockContent.classList.contains('moving')).toBe(false);
        });

        it('move-up handler shows an alert and does not move when isAvalaibleOdeComponent fails', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi.spyOn(block, 'reorderViaYjsRelative');
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'iDevice locked' });

            block.addBehaviourButtonMoveUpBlock();
            upButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
            expect(reorderSpy).not.toHaveBeenCalled();
        });

        it('move-up handler does not reinsert the DOM when reorderViaYjsRelative reports ERROR', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            vi.spyOn(block, 'reorderViaYjsRelative').mockResolvedValue({
                responseMessage: 'ERROR',
            });

            const initialIndex = Array.from(nodeContent.children).indexOf(block.blockContent);
            block.addBehaviourButtonMoveUpBlock();
            upButton.click();
            await new Promise((r) => setTimeout(r, 0));
            await new Promise((r) => setTimeout(r, 0));

            // Position unchanged.
            expect(Array.from(nodeContent.children).indexOf(block.blockContent)).toBe(initialIndex);
        });

        it('move-up handler legacy path mutates this.order and calls apiUpdateOrder', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(false);
            const apiSpy = vi
                .spyOn(block, 'apiUpdateOrder')
                .mockResolvedValue({ responseMessage: 'OK' });

            block.order = 3;
            block.addBehaviourButtonMoveUpBlock();
            upButton.click();

            await vi.waitFor(() => {
                expect(apiSpy).toHaveBeenCalled();
            });
            expect(block.order).toBe(2);
        });

        it('move-down handler routes through reorderViaYjsRelative(+1) when Yjs is enabled', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });

            block.addBehaviourButtonMoveDownBlock();
            downButton.click();

            await vi.waitFor(() => {
                expect(reorderSpy).toHaveBeenCalledWith(+1);
            });
            expect(block.blockContent.classList.contains('moving')).toBe(true);
            // After resolution, the block sits after its previous nextBlock.
            await vi.waitFor(() => {
                expect(nodeContent.children[2]).toBe(block.blockContent);
            });
        });

        it('move-down handler does nothing when there is no next block', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });
            // Move the block to the very bottom: no next sibling.
            nodeContent.removeChild(nextBlock);
            nodeContent.appendChild(block.blockContent);

            block.addBehaviourButtonMoveDownBlock();
            downButton.click();
            await new Promise((r) => setTimeout(r, 0));

            expect(reorderSpy).not.toHaveBeenCalled();
            expect(block.blockContent.classList.contains('moving')).toBe(false);
        });

        it('move-down handler legacy path mutates this.order and calls apiUpdateOrder', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(false);
            const apiSpy = vi
                .spyOn(block, 'apiUpdateOrder')
                .mockResolvedValue({ responseMessage: 'OK' });

            block.order = 1;
            block.addBehaviourButtonMoveDownBlock();
            downButton.click();

            await vi.waitFor(() => {
                expect(apiSpy).toHaveBeenCalled();
            });
            expect(block.order).toBe(2);
        });
    });

    describe('downloadBlockSelected', () => {
        it('throws error when Collaboration service not ready', async () => {
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

        it('creates box-content div and sets boxContent property', () => {
            block.generateBlockContentNode(true);
            expect(block.boxContent).toBeDefined();
            expect(block.boxContent.tagName).toBe('DIV');
            expect(block.boxContent.classList.contains('box-content')).toBe(true);
        });

        it('appends box-content after box-head inside blockContent', () => {
            block.generateBlockContentNode(true);
            const children = Array.from(block.blockContent.children);
            const headIndex = children.indexOf(block.headElement);
            const boxContentIndex = children.indexOf(block.boxContent);
            expect(headIndex).toBeGreaterThanOrEqual(0);
            expect(boxContentIndex).toBeGreaterThan(headIndex);
        });
    });

    describe('setProperties', () => {
        it('updates properties.value from data object', () => {
            const props = {
                visibility: { value: 'true' },
                cssClass: { value: 'custom-class' },
            };

            block.setProperties(props);

            expect(block.properties.visibility.value).toBe('true');
            expect(block.properties.cssClass.value).toBe('custom-class');
        });

        it('handles onlyHeritable flag', () => {
            const props = {
                visibility: { value: 'true', heritable: false },
            };

            block.setProperties(props, true);

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

        it('uses fallback search by icon.id when direct lookup fails', () => {
            // iconName is 'my-icon-id' but the key in themeIcons is 'different-key'
            block.iconName = 'my-icon-id';
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                'different-key': { id: 'my-icon-id', value: '/path/to/icon.svg', title: 'Icon' },
            }));
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });

        it('uses fallback search by icon.value when direct lookup fails', () => {
            // iconName is the icon value path
            block.iconName = '/path/to/icon.svg';
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                'some-key': { id: 'some-id', value: '/path/to/icon.svg', title: 'Icon' },
            }));
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });
    });

    describe('makeModalChangeIconBody', () => {
        it('sets icon-id attribute to icon.id (without extension)', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                share: { id: 'share', value: '/path/to/share.svg', title: 'Share' },
                download: { id: 'download', value: '/path/to/download.png', title: 'Download' },
            }));

            const body = block.makeModalChangeIconBody();
            const iconElements = body.querySelectorAll('.option-block-icon:not(.empty-block-icon)');

            // icon-id uses icon.id which does NOT include the extension (consistent with themes.ts)
            const iconIds = Array.from(iconElements).map(el => el.getAttribute('icon-id'));
            expect(iconIds).toContain('share');
            expect(iconIds).toContain('download');
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

        it('schedules title render after attaching to DOM', () => {
            const originalRaf = global.requestAnimationFrame;
            const rafMock = vi.fn((cb) => {
                cb();
                return 1;
            });
            global.requestAnimationFrame = rafMock;
            const renderSpy = vi
                .spyOn(block, 'renderBlockTitle')
                .mockImplementation(() => {});

            block.makeBlockTitleElementText();

            expect(rafMock).toHaveBeenCalled();
            expect(renderSpy).toHaveBeenCalled();

            global.requestAnimationFrame = originalRaf;
        });

        it('allows direct editing when clicking the title', async () => {
            const titleContainer = block.makeBlockTitleElementText();
            const h1 = titleContainer.querySelector('h1');

            h1.click();
            await Promise.resolve();

            expect(h1.getAttribute('contenteditable')).toBe('true');
        });

        it('restores raw LaTeX text when entering edit mode', async () => {
            block.blockName = '\\(x^2\\)';
            const titleContainer = block.makeBlockTitleElementText();
            const h1 = titleContainer.querySelector('h1');

            // Simulate previously rendered title markup.
            h1.innerHTML = '<mjx-container>rendered</mjx-container>';

            h1.click();
            await Promise.resolve();

            expect(h1.textContent).toBe('\\(x^2\\)');
        });
    });

    describe('renderBlockTitle', () => {
        beforeEach(() => {
            block.blockNameElementText = document.createElement('h1');
            delete global.MathJax;
        });

        it('sets plain text and skips MathJax for non-latex title', async () => {
            const typesetPromise = vi.fn(() => Promise.resolve());
            global.MathJax = {
                startup: { promise: Promise.resolve() },
                typesetPromise,
            };
            block.blockName = 'Plain title';
            document.body.appendChild(block.blockNameElementText);

            block.renderBlockTitle();
            await Promise.resolve();

            expect(block.blockNameElementText.textContent).toBe('Plain title');
            expect(typesetPromise).not.toHaveBeenCalled();
        });

        it('typesets latex when node is connected', async () => {
            const typesetPromise = vi.fn(() => Promise.resolve());
            const typesetClear = vi.fn(() => undefined);
            global.MathJax = {
                startup: { promise: Promise.resolve() },
                typesetPromise,
                typesetClear,
            };
            block.blockName = '\\(x^2\\)';
            document.body.appendChild(block.blockNameElementText);

            block.renderBlockTitle();
            await Promise.resolve();
            await Promise.resolve();

            expect(typesetClear).toHaveBeenCalled();
            expect(typesetPromise).toHaveBeenCalledWith([block.blockNameElementText]);
        });

        it('skips typeset when title node is not connected', async () => {
            const typesetPromise = vi.fn(() => Promise.resolve());
            global.MathJax = {
                startup: { promise: Promise.resolve() },
                typesetPromise,
            };
            block.blockName = '\\(x^2\\)';

            block.renderBlockTitle();
            await Promise.resolve();

            expect(typesetPromise).not.toHaveBeenCalled();
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

        // Issue #1667: when a page is rendered from an imported .elpx the
        // node-content container can end up with whitespace text nodes
        // between the <article.box> siblings. `nextSibling` (the previous
        // implementation) would return the text node and the down-arrow
        // click handler would silently exit with nextBlock=false. The fix
        // uses nextElementSibling, which skips non-element nodes.
        it('skips whitespace text nodes between blocks (regression #1667)', () => {
            const nextBlock = document.createElement('article');
            nextBlock.classList.add('box');

            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            container.appendChild(document.createTextNode('\n    '));
            container.appendChild(nextBlock);

            expect(block.blockContent.nextSibling?.nodeType).toBe(Node.TEXT_NODE);
            expect(block.getContentNextBlock()).toBe(nextBlock);
        });

        it('skips comment nodes between blocks', () => {
            const nextBlock = document.createElement('article');
            nextBlock.classList.add('box');

            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            container.appendChild(document.createComment(' gap '));
            container.appendChild(nextBlock);

            expect(block.getContentNextBlock()).toBe(nextBlock);
        });
    });

    describe('getContentPrevBlock whitespace handling', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
        });

        // Issue #1667 sibling case: getContentPrevBlock already used
        // previousElementSibling, keep a regression lock so the two helpers
        // stay symmetric.
        it('skips whitespace text nodes before the block', () => {
            const prevBlock = document.createElement('article');
            prevBlock.classList.add('box');

            const container = document.createElement('div');
            container.appendChild(prevBlock);
            container.appendChild(document.createTextNode('\n    '));
            container.appendChild(block.blockContent);

            expect(block.getContentPrevBlock()).toBe(prevBlock);
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

    describe('getLockedIdevicesInfo', () => {
        it('returns empty array when Yjs is disabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            block.idevices = [
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'User A', lockUserColor: '#f00' }) },
            ];
            expect(block.getLockedIdevicesInfo()).toEqual([]);
        });

        it('returns empty array when no iDevices are locked', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'block-id-1', isLockedByOtherUser: () => false, getLockInfo: () => null },
                { blockId: 'block-id-1', isLockedByOtherUser: () => false, getLockInfo: () => null },
            ];
            expect(block.getLockedIdevicesInfo()).toEqual([]);
        });

        it('returns locked user info for locked iDevices', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
            ];
            const result = block.getLockedIdevicesInfo();
            expect(result).toEqual([{ name: 'Alice', color: '#f00' }]);
        });

        it('deduplicates users by name', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
            ];
            const result = block.getLockedIdevicesInfo();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice');
        });

        it('includes multiple different users', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Bob', lockUserColor: '#0f0' }) },
            ];
            const result = block.getLockedIdevicesInfo();
            expect(result).toHaveLength(2);
            expect(result.map(u => u.name)).toEqual(['Alice', 'Bob']);
        });

        it('ignores iDevices from other blocks', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'other-block', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
                { blockId: 'block-id-1', isLockedByOtherUser: () => false, getLockInfo: () => null },
            ];
            expect(block.getLockedIdevicesInfo()).toEqual([]);
        });

        it('handles iDevices without isLockedByOtherUser method gracefully', () => {
            eXeLearning.app.project._yjsEnabled = true;
            block.idevices = [
                { blockId: 'block-id-1' },
                { blockId: 'block-id-1', isLockedByOtherUser: () => true, getLockInfo: () => ({ lockUserName: 'Alice', lockUserColor: '#f00' }) },
            ];
            const result = block.getLockedIdevicesInfo();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice');
        });
    });

    describe('addBehaviourButtonDeleteBlock - locked iDevices warning', () => {
        let deleteButton;

        beforeEach(() => {
            // Generate block content with buttons so addBehaviourButtonDeleteBlock can find the button
            block.blockId = 'test-block-id';
            vi.spyOn(block, 'addBehaviourButtonDropDown').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonMoveUpBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonMoveDownBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonPropertiesBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourButtonCloneBlock').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourMoveToPageBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourExportBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addBehaviourToggleBlockButton').mockImplementation(() => {});
            vi.spyOn(block, 'addTooltips').mockImplementation(() => {});
            vi.spyOn(block, 'addNoTranslateForGoogle').mockImplementation(() => {});
            vi.spyOn(block, 'remove').mockImplementation(() => {});

            // Build buttons element (which registers the delete handler internally)
            block.makeBlockButtonsElement();
            deleteButton = block.blockButtons.querySelector('#deleteBlocktest-block-id');

            // Mock jQuery $ for the handler
            global.$ = vi.fn(() => ({
                attr: vi.fn(() => 'false'),
                trigger: vi.fn(),
            }));

            // Mock isAvalaibleOdeComponent to resolve OK
            eXeLearning.app.project.isAvalaibleOdeComponent = vi.fn().mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            delete global.$;
        });

        it('deletes directly when no iDevices are locked', async () => {
            vi.spyOn(block, 'getLockedIdevicesInfo').mockReturnValue([]);

            deleteButton.click();
            await vi.waitFor(() => {
                expect(block.remove).toHaveBeenCalledWith(true);
            });
            expect(eXeLearning.app.modals.confirm.show).not.toHaveBeenCalled();
        });

        it('shows warning modal when iDevices are locked', async () => {
            vi.spyOn(block, 'getLockedIdevicesInfo').mockReturnValue([
                { name: 'Alice', color: '#f00' },
            ]);

            deleteButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });
            // Block should NOT be removed yet (user hasn't confirmed)
            expect(block.remove).not.toHaveBeenCalled();
        });

        it('shows multiple user names in warning', async () => {
            vi.spyOn(block, 'getLockedIdevicesInfo').mockReturnValue([
                { name: 'Alice', color: '#f00' },
                { name: 'Bob', color: '#0f0' },
            ]);

            deleteButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });
            const callArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            expect(callArgs.body).toContain('Alice');
            expect(callArgs.body).toContain('Bob');
            expect(callArgs.focusCancelButton).toBe(true);
        });

        it('executes deletion when user confirms in modal', async () => {
            vi.spyOn(block, 'getLockedIdevicesInfo').mockReturnValue([
                { name: 'Alice', color: '#f00' },
            ]);

            deleteButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });

            // Simulate user confirming
            const callArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            callArgs.confirmExec();

            expect(block.remove).toHaveBeenCalledWith(true);
            expect(eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode).toHaveBeenCalled();
        });

        it('uses singular message for one locked user', async () => {
            vi.spyOn(block, 'getLockedIdevicesInfo').mockReturnValue([
                { name: 'Alice', color: '#f00' },
            ]);

            deleteButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });
            const callArgs = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            expect(callArgs.body).toContain('An iDevice in this box is being edited by another user');
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
