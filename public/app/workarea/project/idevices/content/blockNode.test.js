/**
 * BlockNode Tests
 *
 * Unit tests for IdeviceBlockNode class methods.
 * Tests core functionality like parameter handling, properties, toggle, order calculation, etc.
 *
 * Run with: bun test:frontend:ci
 */

// Setup global mocks BEFORE importing the module
// vi.hoisted runs BEFORE the (hoisted) static imports, so blockNode.js sees
// window.AppLogger when it evaluates `const Logger = window.AppLogger || console`.
vi.hoisted(() => {
    globalThis.window = globalThis.window || {};
    window.AppLogger = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
});

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
import IdeviceBlockNode, { sortThemeIcons } from './blockNode.js';

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
                });

                expect(block.id).toBe(block.blockId);
                expect(block.id).toBe('block-123');
            });

            it('keeps data.id when provided even in Yjs mode', () => {
                eXeLearning.app.project._yjsEnabled = true;

                const block = new IdeviceBlockNode(mockEngine, {
                    id: 'custom-id',
                    blockId: 'block-456',
                });

                expect(block.id).toBe('custom-id');
                expect(block.blockId).toBe('block-456');
            });

            it('generates Yjs-style blockId when Yjs is enabled and no blockId provided', () => {
                eXeLearning.app.project._yjsEnabled = true;

                const block = new IdeviceBlockNode(mockEngine, {});

                expect(block.blockId).toMatch(/^block-\d+-[a-z0-9]+$/);
                expect(block.id).toBe(block.blockId);
            });

            it('uses engine.generateId for blockId when Yjs is not enabled', () => {
                eXeLearning.app.project._yjsEnabled = false;
                mockEngine.generateId.mockReturnValue('engine-block-id');

                const block = new IdeviceBlockNode(mockEngine, {});

                expect(block.blockId).toBe('engine-block-id');
                expect(mockEngine.generateId).toHaveBeenCalled();
            });

            it('keeps id and blockId independent when Yjs is disabled', () => {
                eXeLearning.app.project._yjsEnabled = false;
                mockEngine.generateId.mockReturnValue('engine-block-id');

                const block = new IdeviceBlockNode(mockEngine, {});

                expect(block.id).toBe('generated-key-123');
                expect(block.blockId).toBe('engine-block-id');
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

        function makeClassListStrict(el) {
            const realAdd = el.classList.add.bind(el.classList);
            vi.spyOn(el.classList, 'add').mockImplementation((...tokens) => {
                for (const token of tokens) {
                    if (token === '') {
                        throw new Error(
                            "Failed to execute 'add' on 'DOMTokenList': The token provided must not be empty."
                        );
                    }
                }
                return realAdd(...tokens);
            });
        }

        it('does not throw and skips empty tokens when cssClass has extra spaces', () => {
            makeClassListStrict(block.blockContent);
            block.properties.cssClass.value = '  a  b  ';

            expect(() => block.setPropertiesClassesToElement()).not.toThrow();
            expect(block.blockContent.classList.contains('a')).toBe(true);
            expect(block.blockContent.classList.contains('b')).toBe(true);
            expect(block.blockContent.classList.contains('')).toBe(false);
        });

        it('does not throw when cssClass contains a pasted CSS rule', () => {
            makeClassListStrict(block.blockContent);
            block.properties.cssClass.value =
                '.lista_de_cotejo {     border: 1px solid #d4d4d4;     border-radius: 6px; }';

            expect(() => block.setPropertiesClassesToElement()).not.toThrow();
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
            span.innerHTML = 'keyboard_arrow_up';
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

        it('adds original-icon-selection class when no iconName', () => {
            block.iconName = '';
            const icon = block.makeEmptyIcon();

            expect(icon.classList.contains('original-icon-selection')).toBe(true);
        });

        it('sets selected to false when iconName exists', () => {
            block.iconName = 'icon1';
            const icon = block.makeEmptyIcon();

            expect(icon.getAttribute('selected')).toBe('false');
        });

        it('does not add original-icon-selection class when iconName exists', () => {
            block.iconName = 'icon1';
            const icon = block.makeEmptyIcon();

            expect(icon.classList.contains('original-icon-selection')).toBe(false);
        });
    });

    describe('makeIconValueElement', () => {
        const originalConfig = eXeLearning.config;

        afterEach(() => {
            eXeLearning.config = originalConfig;
        });

        it('creates img element with correct src and alt', () => {
            const icon = { value: '/path/to/icon.svg', title: 'My Icon' };
            const img = block.makeIconValueElement(icon);

            expect(img.tagName).toBe('IMG');
            expect(img.getAttribute('src')).toBe('/path/to/icon.svg');
            expect(img.getAttribute('alt')).toBe('My Icon');
        });

        it('does not re-prefix theme icon URLs that already include BASE_PATH', () => {
            eXeLearning.config = { basePath: '/web/exelearning' };
            const value = '/web/exelearning/v0.0.0-alpha/files/perm/themes/base/base/icons/info.png';
            const img = block.makeIconValueElement({ value, title: 'Info' });

            expect(img.getAttribute('src')).toBe(value);
        });

        it('leaves absolute theme icon URLs unchanged when no BASE_PATH is configured', () => {
            eXeLearning.config = { basePath: '' };
            const value = '/v0.0.0-alpha/files/perm/themes/base/base/icons/info.png';
            const img = block.makeIconValueElement({ value, title: 'Info' });

            expect(img.getAttribute('src')).toBe(value);
        });

        it('converts absolute icon URLs to relative in static mode', () => {
            eXeLearning.config = { isStaticMode: true };
            const value = '/v0.0.0-alpha/files/perm/themes/base/base/icons/info.png';
            const img = block.makeIconValueElement({ value, title: 'Info' });

            expect(img.getAttribute('src')).toBe(`.${value}`);
        });

        it('converts absolute icon URLs to relative in offline installation mode', () => {
            eXeLearning.config = { isOfflineInstallation: true };
            const value = '/v0.0.0-alpha/files/perm/themes/base/base/icons/info.png';
            const img = block.makeIconValueElement({ value, title: 'Info' });

            expect(img.getAttribute('src')).toBe(`.${value}`);
        });

        it('still prefixes client-built material icon paths with BASE_PATH (contrast)', () => {
            eXeLearning.config = { basePath: '/web/exelearning' };
            expect(block.resolveAppAssetUrl('/libs/material-icons/icons/alarm.svg')).toBe(
                '/web/exelearning/libs/material-icons/icons/alarm.svg'
            );
        });
    });

    describe('renderMaterialMaskIcon (shared sprite runtime)', () => {
        afterEach(() => {
            delete window.eXeBlockIconRuntime;
        });

        it('emits a placeholder for hydration when no shared runtime is present', () => {
            const html = block.renderMaterialMaskIcon('lightbulb');
            expect(html).toContain('class="exe-material-icon"');
            expect(html).toContain('data-exe-material-icon="lightbulb"');
            expect(html).not.toContain('.svg');

            expect(block.renderMaterialMaskIcon('totally-unknown-icon')).toContain('data-exe-material-icon="help"');
        });

        it('delegates to the shared runtime (sprite data: URI) when available', () => {
            window.eXeBlockIconRuntime = {
                renderMaterialMaskIcon: () =>
                    '<span class="exe-material-icon" style="--exe-material-icon-url:url(\'data:image/svg+xml;utf8,X\');"></span>',
            };

            const html = block.renderMaterialMaskIcon('lightbulb');
            expect(html).toContain('data:image/svg+xml;utf8,');
            expect(html).not.toContain('data-exe-material-icon');
        });
    });

    describe('apiUpdateIcon', () => {
        it('updates iconName property', () => {
            block.apiUpdateIcon('new-icon');
            expect(block.iconName).toBe('new-icon');
        });

        it('updates Yjs directly when collaborative mode is enabled', async () => {
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    updateBlock: mockUpdateBlock,
                },
            };

            await block.apiUpdateIcon({ source: 'material', value: 'alarm' });

            expect(mockUpdateBlock).toHaveBeenCalledWith(block.blockId, {
                icon: { source: 'material', value: 'alarm', name: 'alarm' },
                iconName: 'mi-alarm',
            });
        });

        it('calls apiSendDataService when id exists', async () => {
            const spy = vi
                .spyOn(block, 'apiSendDataService')
                .mockResolvedValue({ responseMessage: 'OK' });
            eXeLearning.app.project._yjsEnabled = false;
            await block.apiUpdateIcon('new-icon');
            expect(spy).toHaveBeenCalledWith('putSaveBlock', [
                'odePagStructureSyncId',
                'iconName',
                'icon',
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
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    updateBlock: mockUpdateBlock,
                },
            };
            block.apiUpdateTitle('New Title');
            expect(mockUpdateBlock).not.toHaveBeenCalled();
        });
    });

    describe('makeModalChangeIconBody', () => {
        it('creates modal body with icons', () => {
            const body = block.makeModalChangeIconBody();

            expect(body.id).toBe('change-block-icon-modal-content');
            expect(body.querySelector('.empty-block-icon')).not.toBeNull();
            expect(body.querySelector('#block-icon-custom-button')).not.toBeNull();
        });

        it('includes material icons', () => {
            const body = block.makeModalChangeIconBody();
            const icons = body.querySelectorAll('.option-block-icon[data-icon-source="material"]');

            expect(icons.length).toBeGreaterThan(1);
        });

        it('lists current theme icons before material icons', () => {
            const body = block.makeModalChangeIconBody();
            const options = [...body.querySelectorAll('.option-block-icon')];
            const themeIcons = options.filter((icon) => icon.getAttribute('data-icon-source') === 'theme');
            const firstThemeIndex = options.indexOf(themeIcons[0]);
            const firstMaterialIndex = options.indexOf(
                options.find((icon) => icon.getAttribute('data-icon-source') === 'material')
            );

            expect(themeIcons).toHaveLength(2);
            expect(themeIcons[0].getAttribute('data-icon-value')).toBe('icon1');
            expect(themeIcons[0].getAttribute('title')).toBe('Icon 1');
            expect(themeIcons[0].classList.contains('theme-block-icon')).toBe(true);
            expect(firstThemeIndex).toBeLessThan(firstMaterialIndex);
        });

        it('lists theme icons alphabetically regardless of source order (#2411)', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                udl_rep_informarse: { id: 'udl_rep_informarse', value: '/i/udl_rep_informarse.svg' },
                udl_exp_grupohomogeneo: { id: 'udl_exp_grupohomogeneo', value: '/i/udl_exp_grupohomogeneo.svg' },
                udl_eng_reto: { id: 'udl_eng_reto', value: '/i/udl_eng_reto.svg' },
                udl_eng_curiosidad: { id: 'udl_eng_curiosidad', value: '/i/udl_eng_curiosidad.svg' },
            }));
            const body = block.makeModalChangeIconBody();
            const values = [...body.querySelectorAll('.option-block-icon[data-icon-source="theme"]')].map((el) =>
                el.getAttribute('data-icon-value')
            );

            expect(values).toEqual([
                'udl_eng_curiosidad',
                'udl_eng_reto',
                'udl_exp_grupohomogeneo',
                'udl_rep_informarse',
            ]);
        });

        it('adds section titles separating theme and general icons', () => {
            const body = block.makeModalChangeIconBody();
            const titles = [...body.querySelectorAll('.icon-options-section-title')].map((el) => el.textContent);

            expect(titles).toEqual(['Style icons', 'General icons']);
        });

        it('omits section titles when the theme has no icons', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({}));
            const body = block.makeModalChangeIconBody();

            expect(body.querySelectorAll('.icon-options-section-title')).toHaveLength(0);
            expect(body.querySelectorAll('.option-block-icon[data-icon-source="theme"]')).toHaveLength(0);
        });

        it('renders material modal options as inline SVG from the shared sprite runtime', () => {
            const renderMaterialInlineIcon = vi.fn(
                () =>
                    '<svg class="exe-material-icon-sprite" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M1-1Z"/></svg>'
            );
            window.eXeBlockIconRuntime = { renderMaterialInlineIcon };
            try {
                const body = block.makeModalChangeIconBody();
                const firstMaterialIcon = body.querySelector('.option-block-icon[data-icon-source="material"]');

                expect(firstMaterialIcon.querySelector('.exe-material-icon-sprite path')).not.toBeNull();
                expect(body.querySelector('.exe-material-icon-sprite use')).toBeNull();
                expect(body.innerHTML).not.toContain('material-icons.svg');
                expect(renderMaterialInlineIcon).toHaveBeenCalledWith(
                    firstMaterialIcon.getAttribute('data-icon-value'),
                    expect.objectContaining({ catalog: expect.any(Array) })
                );
            } finally {
                delete window.eXeBlockIconRuntime;
            }
        });

        it('renders material modal options as hydration placeholders when the sprite is not loaded yet', () => {
            const body = block.makeModalChangeIconBody();
            const firstMaterialIcon = body.querySelector('.option-block-icon[data-icon-source="material"]');

            expect(firstMaterialIcon.querySelector('.exe-material-icon[data-exe-material-icon]')).not.toBeNull();
            expect(body.querySelector('use')).toBeNull();
            expect(body.innerHTML).not.toContain('material-icons.svg');
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
            expect(typeof callArgs.cancelExec).toBe('function');
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
                },
            };

            block.order = 7;
            const result = await block.reorderViaYjsRelative(-1);

            expect(result.responseMessage).toBe('OK');
            expect(block.order).toBe(7);
        });

        it('retries with this.id when this.blockId fails and the two ids differ', async () => {
            const mockMove = vi
                .fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);
            const mockFind = vi.fn().mockReturnValue({ index: 0 });
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    moveBlockRelative: mockMove,
                    findBlockLocation: mockFind,
                },
            };

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
                expect(blockContent.classList.contains('moving')).toBe(true);

                vi.advanceTimersByTime(mockEngine.movingClassDuration + 10);
                expect(blockContent.classList.contains('moving')).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

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
            block.blockButtons = document.createElement('div');
            upButton = document.createElement('button');
            upButton.id = `moveUp${block.blockId}`;
            block.blockButtons.appendChild(upButton);
            downButton = document.createElement('button');
            downButton.id = `moveDown${block.blockId}`;
            block.blockButtons.appendChild(downButton);

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
            expect(block.blockContent.classList.contains('moving')).toBe(true);
            await vi.waitFor(() => {
                expect(nodeContent.children[0]).toBe(block.blockContent);
            });
        });

        it('move-up handler does nothing when there is no previous block', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });
            nodeContent.removeChild(prevBlock);
            nodeContent.insertBefore(block.blockContent, nodeContent.firstChild);

            block.addBehaviourButtonMoveUpBlock();
            upButton.click();
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
            await vi.waitFor(() => {
                expect(nodeContent.children[2]).toBe(block.blockContent);
            });
        });

        it('move-down handler does nothing when there is no next block', async () => {
            vi.spyOn(block, 'isYjsEnabled').mockReturnValue(true);
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjsRelative')
                .mockResolvedValue({ responseMessage: 'OK' });
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
            block.test();
            expect(window.AppLogger.log).toHaveBeenCalledWith('click');
        });
    });

    describe('toggleOff', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
            block.toggleElement = document.createElement('button');
            block.toggleElement.innerHTML = '<span>keyboard_arrow_up</span>';
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
            expect(block.toggleElement.querySelector('span').innerHTML).toBe('keyboard_arrow_down');
        });
    });

    describe('toggleOn', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('div');
            block.blockContent.classList.add('hidden-idevices');
            block.toggleElement = document.createElement('button');
            block.toggleElement.innerHTML = '<span>keyboard_arrow_down</span>';
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
            expect(block.toggleElement.querySelector('span').innerHTML).toBe('keyboard_arrow_up');
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
            iconElement.setAttribute('data-icon-source', 'material');
            iconElement.setAttribute('data-icon-value', 'alarm');
            modalBody.appendChild(iconElement);
            eXeLearning.app.modals.confirm.modalElementBody = modalBody;

            block.apiUpdateIcon = vi.fn();
        });

        it('gets icon value from selected element', () => {
            block.saveIconAction();
            expect(block.apiUpdateIcon).toHaveBeenCalledWith({
                source: 'material',
                value: 'alarm',
                name: 'alarm',
            });
        });

        it('uses empty string when icon is 0', () => {
            const modalBody = eXeLearning.app.modals.confirm.modalElementBody;
            modalBody.querySelector('.option-block-icon').setAttribute('data-icon-source', 'none');
            modalBody.querySelector('.option-block-icon').setAttribute('data-icon-value', '');

            block.saveIconAction();
            expect(block.apiUpdateIcon).toHaveBeenCalledWith({
                source: 'none',
                value: '',
            });
        });

        it('uses custom asset selected via toolbar button', () => {
            const modalBody = eXeLearning.app.modals.confirm.modalElementBody;
            const customButton = document.createElement('button');
            customButton.id = 'block-icon-custom-button';
            customButton.className = 'selected';
            modalBody.appendChild(customButton);
            modalBody.setAttribute('data-custom-icon-source', 'asset');
            modalBody.setAttribute('data-custom-icon-value', 'asset://uuid-123/dog.jpg');
            modalBody.setAttribute('data-custom-icon-name', 'dog.jpg');
            modalBody.querySelector('.option-block-icon').setAttribute('selected', 'false');

            block.saveIconAction();

            expect(block.apiUpdateIcon).toHaveBeenCalledWith({
                source: 'asset',
                value: 'asset://uuid-123/dog.jpg',
                name: 'dog.jpg',
            });
        });

        it('derives canonical asset:// URL from asset metadata', () => {
            eXeLearning.app.project._yjsBridge = {
                assetManager: {
                    getAssetUrl: vi.fn(() => 'asset://uuid-999/black-dog.jpg'),
                },
            };

            expect(block.getCanonicalAssetUrl({
                assetUrl: 'blob:should-not-be-used',
                asset: { id: 'uuid-999', filename: 'black-dog.jpg' },
            })).toBe('asset://uuid-999/black-dog.jpg');
        });

        it('delegates selected icon to apiUpdateIcon', () => {
            block.saveIconAction();

            expect(block.apiUpdateIcon).toHaveBeenCalledWith({
                source: 'material',
                value: 'alarm',
                name: 'alarm',
            });
        });
    });

    describe('icon helpers', () => {
        const attached = [];
        const attach = (element) => {
            document.body.appendChild(element);
            attached.push(element);
            return element;
        };

        afterEach(() => {
            attached.splice(0).forEach((element) => element.remove());
        });

        describe('collaborator-controlled asset icon descriptors', () => {
            const parse = (html) => {
                const host = document.createElement('div');
                host.innerHTML = html;
                return host;
            };

            const expectSingleInertImg = (html) => {
                const host = parse(html);
                expect(host.children).toHaveLength(1);
                const img = host.querySelector('img');
                expect(img).not.toBeNull();
                for (const attr of Array.from(img.attributes)) {
                    expect(['src', 'alt']).toContain(attr.name);
                }
                return img;
            };

            it.each([
                'asset://uuid/x.png" onerror="window.__xss=1',
                "asset://uuid/x.png' onerror='window.__xss=1",
                'asset://uuid/x.png"><img src=x onerror="window.__xss=1">',
                '/icons/a.png"><script>window.__xss=1</script>',
                'javascript:window.__xss=1',
            ])('renderIconPreviewHtml keeps %s inside the <img> attributes', (value) => {
                eXeLearning.app.project._yjsBridge = { assetManager: { resolveAssetURLSync: () => value } };
                const html = block.renderIconPreviewHtml({ source: 'asset', value });
                const img = expectSingleInertImg(html);
                expect(img.getAttribute('alt')).toBe(value);
                eXeLearning.app.project._yjsBridge = null;
            });

            it('escapes a crafted icon name used as alt text', () => {
                const name = '"><img src=x onerror="window.__xss=1">';
                eXeLearning.app.project._yjsBridge = {
                    assetManager: { resolveAssetURLSync: () => 'blob:http://localhost/1' },
                };
                const html = block.renderIconPreviewHtml({ source: 'asset', value: 'asset://uuid/ok.png', name });
                const img = expectSingleInertImg(html);
                expect(img.getAttribute('src')).toBe('blob:http://localhost/1');
                expect(img.getAttribute('alt')).toBe(name);
                eXeLearning.app.project._yjsBridge = null;
            });

            it('applyIconElementState renders a crafted descriptor inert in the block header', () => {
                block.iconElement = document.createElement('div');
                block.applyIconElementState({
                    source: 'asset',
                    value: 'asset://uuid/x.png" onerror="window.__xss=1',
                    previewUrl: 'asset://uuid/x.png" onerror="window.__xss=1',
                });
                expectSingleInertImg(block.iconElement.innerHTML);
            });

            it('still renders a legitimate asset icon', () => {
                eXeLearning.app.project._yjsBridge = {
                    assetManager: { resolveAssetURLSync: () => 'blob:http://localhost/ok' },
                };
                const html = block.renderIconPreviewHtml({ source: 'asset', value: 'asset://uuid/ok.png' });
                expect(html).toBe('<img src="blob:http://localhost/ok" alt="asset://uuid/ok.png">');
                eXeLearning.app.project._yjsBridge = null;
            });
        });

        it('normalizes legacy icon names into structured descriptors', () => {
            expect(block.normalizeIconDescriptor(null, '')).toEqual({ source: 'none', value: '' });
            expect(block.normalizeIconDescriptor(null, 'mi-alarm')).toEqual({
                source: 'material',
                value: 'alarm',
                name: 'alarm',
            });
            expect(block.normalizeIconDescriptor(null, 'activity')).toEqual({
                source: 'material',
                value: 'checklist',
                name: 'checklist',
            });
            expect(block.normalizeIconDescriptor(null, 'asset://uuid/icon.jpg')).toEqual({
                source: 'asset',
                value: 'asset://uuid/icon.jpg',
                name: 'asset://uuid/icon.jpg',
            });
            expect(block.normalizeIconDescriptor(null, 'legacy-theme')).toEqual({
                source: 'theme',
                value: 'legacy-theme',
                name: 'legacy-theme',
            });
        });

        it('prefers the current style icon over the legacy Material mapping', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                objectives: { id: 'objectives', value: '/icons/objectives.png', title: 'Objectives' },
            }));
            expect(block.normalizeIconDescriptor(null, 'objectives')).toEqual({
                source: 'theme',
                value: 'objectives',
                name: 'objectives',
            });

            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({}));
            expect(block.normalizeIconDescriptor(null, 'objectives')).toEqual({
                source: 'material',
                value: 'target',
                name: 'target',
            });
        });

        it('normalizes a stored icon name the style has since renamed', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                objectives: { id: 'objectives', value: '/icons/objectives.png', title: 'Objectives' },
            }));

            expect(block.normalizeIconDescriptor(null, 'objetives')).toEqual({
                source: 'theme',
                value: 'objectives',
                name: 'objectives',
            });

            expect(block.normalizeIconDescriptor({ source: 'theme', value: 'objetives' })).toEqual({
                source: 'theme',
                value: 'objectives',
                name: 'objectives',
            });
        });

        it('falls back to the legacy Material mapping under the renamed name', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({}));

            expect(block.normalizeIconDescriptor(null, 'objetives')).toEqual({
                source: 'material',
                value: 'target',
                name: 'target',
            });
        });

        it('finds the style icon behind a renamed stored name', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                think_alt: { id: 'think_alt', value: '/icons/think_alt.svg', title: 'Think' },
            }));

            expect(block.resolveThemeIconData('think-alt')).toEqual({
                id: 'think_alt',
                value: '/icons/think_alt.svg',
                title: 'Think',
            });
        });

        it('resolves app asset URLs using composeUrl and basePath fallbacks', () => {
            eXeLearning.app.composeUrl = vi.fn((path) => `/composed${path}`);
            expect(block.resolveAppAssetUrl('/libs/material-icons/icons/alarm.svg')).toBe(
                '/composed/libs/material-icons/icons/alarm.svg'
            );

            delete eXeLearning.app.composeUrl;
            window.eXeLearning.config = JSON.stringify({ basePath: '/exe' });
            expect(block.resolveAppAssetUrl('/libs/material-icons/icons/alarm.svg')).toBe(
                '/exe/libs/material-icons/icons/alarm.svg'
            );
        });

        it('returns renderable asset URL for asset refs, public paths and passthrough values', () => {
            eXeLearning.app.project._yjsBridge = {
                assetManager: {
                    resolveAssetURLSync: vi.fn(() => 'blob:asset-ref'),
                    extractAssetId: vi.fn(() => 'uuid-123'),
                    generateLoadingPlaceholder: vi.fn(() => 'data:image/svg+xml,loading'),
                },
            };

            expect(block.getRenderableAssetUrl('asset://uuid-123/icon.jpg')).toBe('blob:asset-ref');
            expect(block.getRenderableAssetUrl('/icons/theme.svg')).toContain('/icons/theme.svg');
            expect(block.getRenderableAssetUrl('https://example.com/icon.svg')).toBe('https://example.com/icon.svg');
        });

        it('renders material picker icon as a hydration placeholder with the help fallback when no shared runtime exists', () => {
            const html = block.renderMaterialInlineIcon('not-in-catalog');
            expect(html).toContain('class="exe-material-icon"');
            expect(html).toContain('data-exe-material-icon="help"');
            expect(html).not.toContain('<use');
        });

        it('delegates material picker icon rendering to the shared runtime with the catalog', () => {
            const renderMaterialInlineIcon = vi.fn(() => '<svg class="exe-material-icon-sprite"><path d="M1-1Z"/></svg>');
            window.eXeBlockIconRuntime = { renderMaterialInlineIcon };
            try {
                expect(block.renderMaterialInlineIcon('alarm')).toContain('<path d="M1-1Z"/>');
                expect(renderMaterialInlineIcon).toHaveBeenCalledWith(
                    'alarm',
                    expect.objectContaining({ catalog: expect.any(Array) })
                );
            } finally {
                delete window.eXeBlockIconRuntime;
            }
        });

        it('filters material and theme icon tiles from the search query', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
            }));
            const body = block.makeModalChangeIconBody();
            const icons = body.querySelectorAll('.option-block-icon');
            block.filterModalMaterialIcons(icons, 'alarm');

            const alarm = body.querySelector('.option-block-icon[data-icon-value="alarm"]');
            const book = body.querySelector('.option-block-icon[data-icon-value="book"]');
            const themeIcon = body.querySelector('.option-block-icon[data-icon-source="theme"]');
            const empty = body.querySelector('.empty-block-icon');

            expect(alarm.style.display).toBe('');
            expect(book.style.display).toBe('none');
            expect(themeIcon.style.display).toBe('none');
            expect(empty.style.display).toBe('');
        });

        it('keeps theme icons matching the search query by title', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
            }));
            const body = block.makeModalChangeIconBody();
            const icons = body.querySelectorAll('.option-block-icon');
            block.filterModalMaterialIcons(icons, 'icon 1');

            const themeIcon = body.querySelector('.option-block-icon[data-icon-value="icon1"]');
            expect(themeIcon.style.display).toBe('');
        });

        it('hides section titles while searching and restores them when cleared', () => {
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
            }));
            const body = block.makeModalChangeIconBody();
            const icons = body.querySelectorAll('.option-block-icon');
            const titles = body.querySelectorAll('.icon-options-section-title');

            block.filterModalMaterialIcons(icons, 'alarm');
            titles.forEach((title) => expect(title.style.display).toBe('none'));

            block.filterModalMaterialIcons(icons, '');
            titles.forEach((title) => expect(title.style.display).toBe(''));
        });

        it('prefers the picker accent over the box head icon color', () => {
            block.headElement = attach(document.createElement('div'));
            block.headElement.style.setProperty('--exe-icon-color', '#fff');
            block.headElement.style.setProperty('--exe-icon-picker-color', '#0d77d1');
            expect(block.getCurrentThemeIconColor()).toBe('#0d77d1');

            block.headElement.style.removeProperty('--exe-icon-picker-color');
            expect(block.getCurrentThemeIconColor()).toBe('#fff');
        });

        it('falls back to the title, then the icon, when the block has no header yet', () => {
            block.headElement = null;
            block.blockNameElementText = attach(document.createElement('h1'));
            block.blockNameElementText.style.setProperty('--exe-icon-color', '#123456');
            expect(block.getCurrentThemeIconColor()).toBe('#123456');

            block.blockNameElementText = null;
            block.iconElement = attach(document.createElement('div'));
            block.iconElement.style.setProperty('--exe-icon-color', '#654321');
            expect(block.getCurrentThemeIconColor()).toBe('#654321');
        });

        it('resolves no color when the theme declares neither variable', () => {
            block.headElement = attach(document.createElement('div'));
            block.headElement.style.color = 'rgb(1, 2, 3)';
            block.blockNameElementText = null;
            block.iconElement = null;

            expect(block.getCurrentThemeIconColor()).toBe('');
        });

        it('resolves currentColor against the block header, not the modal it is copied onto', () => {
            block.headElement = attach(document.createElement('div'));
            block.headElement.style.color = 'rgb(1, 2, 3)';
            block.headElement.style.setProperty('--exe-icon-color', 'currentColor');

            expect(block.getCurrentThemeIconColor()).toBe('rgb(1, 2, 3)');
        });

        it('leaves the picker untinted rather than throwing when getComputedStyle is missing', () => {
            block.headElement = attach(document.createElement('div'));
            block.headElement.style.setProperty('--exe-icon-color', '#123456');
            const original = window.getComputedStyle;
            window.getComputedStyle = undefined;

            try {
                expect(block.getCurrentThemeIconColor()).toBe('');
            } finally {
                window.getComputedStyle = original;
            }
        });

        it('sets --modal-icon-color on the picker from the theme variable', () => {
            block.headElement = attach(document.createElement('div'));
            block.headElement.style.setProperty('--exe-icon-color', '#123456');

            const body = block.makeModalChangeIconBody();

            expect(body.style.getPropertyValue('--modal-icon-color')).toBe('#123456');
        });

        it('leaves --modal-icon-color unset when the theme declares no tint', () => {
            block.headElement = null;
            block.blockNameElementText = null;
            block.iconElement = null;

            const body = block.makeModalChangeIconBody();

            expect(body.style.getPropertyValue('--modal-icon-color')).toBe('');
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
            block.toggleElement.innerHTML = '<span>keyboard_arrow_up</span>';
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
            block.iconName = 'my-icon-id';
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                'different-key': { id: 'my-icon-id', value: '/path/to/icon.svg', title: 'Icon' },
            }));
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });

        it('uses fallback search by icon.value when direct lookup fails', () => {
            block.iconName = '/path/to/icon.svg';
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                'some-key': { id: 'some-id', value: '/path/to/icon.svg', title: 'Icon' },
            }));
            const iconEl = block.makeIconNameElement();
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });

        it('resolves asset icons through AssetManager cache for preview', () => {
            block.iconName = 'asset://asset-123/icon.jpg';
            block.icon = { source: 'asset', value: 'asset://asset-123/icon.jpg', name: 'icon.jpg' };
            eXeLearning.app.project._yjsBridge = {
                assetManager: {
                    resolveAssetURLSync: vi.fn(() => 'blob:test-icon'),
                    resolveAssetURL: vi.fn().mockResolvedValue('blob:test-icon'),
                },
            };

            const iconEl = block.makeIconNameElement();
            const img = iconEl.querySelector('img');

            expect(img).not.toBeNull();
            expect(img.getAttribute('src')).toBe('blob:test-icon');
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });

        it('uses a loading placeholder instead of empty src when asset blob is not cached yet', () => {
            block.iconName = 'asset://12345678-1234-1234-1234-123456789012/icon.jpg';
            block.icon = {
                source: 'asset',
                value: 'asset://12345678-1234-1234-1234-123456789012/icon.jpg',
                name: 'icon.jpg',
            };
            eXeLearning.app.project._yjsBridge = {
                assetManager: {
                    resolveAssetURLSync: vi.fn(() => null),
                    extractAssetId: vi.fn(() => '12345678-1234-1234-1234-123456789012'),
                    generateLoadingPlaceholder: vi.fn(() => 'data:image/svg+xml,placeholder'),
                    resolveAssetURL: vi.fn().mockResolvedValue('blob:test-icon'),
                },
            };

            const iconEl = block.makeIconNameElement();
            const img = iconEl.querySelector('img');

            expect(img).not.toBeNull();
            expect(img.getAttribute('src')).toBe('data:image/svg+xml,placeholder');
            expect(iconEl.classList.contains('exe-no-icon')).toBe(false);
        });

        it('previewIconElement updates button preview for selected custom asset', () => {
            block.iconElement = document.createElement('button');
            block.iconElement.className = 'exe-icon box-icon exe-app-tooltip exe-no-icon';
            eXeLearning.app.project._yjsBridge = {
                assetManager: {
                    resolveAssetURLSync: vi.fn(() => 'blob:preview-icon'),
                    resolveAssetURL: vi.fn().mockResolvedValue('blob:preview-icon'),
                },
            };

            block.previewIconElement({
                source: 'asset',
                value: 'asset://asset-123/icon.jpg',
                name: 'icon.jpg',
                previewUrl: 'blob:preview-icon',
            });

            const img = block.iconElement.querySelector('img');
            expect(img).not.toBeNull();
            expect(img.getAttribute('src')).toBe('blob:preview-icon');
            expect(block.iconElement.classList.contains('exe-no-icon')).toBe(false);
        });
    });

    describe('makeModalChangeIconBody', () => {
        it('sets icon-id attribute to material icon ids', () => {
            const body = block.makeModalChangeIconBody();
            const iconElements = body.querySelectorAll('.option-block-icon:not(.empty-block-icon)');

            const iconIds = Array.from(iconElements).map(el => el.getAttribute('icon-id'));
            expect(iconIds).toContain('mi-alarm');
            expect(iconIds).toContain('mi-lightbulb');
        });

        it('persists custom asset icon immediately when selected from file manager', async () => {
            const body = block.makeModalChangeIconBody();
            eXeLearning.app.modals.confirm.modalElementBody = body;
            const apiUpdateIconSpy = vi.spyOn(block, 'apiUpdateIcon').mockResolvedValue(true);
            const previewSpy = vi.spyOn(block, 'previewIconElement').mockImplementation(() => {});
            eXeLearning.app.modals.filemanager = eXeLearning.app.modals.filemanager || {};

            let onSelectCallback;
            eXeLearning.app.modals.filemanager.show = vi.fn(({ onSelect }) => {
                onSelectCallback = onSelect;
            });

            block.addBehaviourToModalChangeIconBody();
            body.querySelector('#block-icon-custom-button').click();

            await onSelectCallback({
                assetUrl: 'asset://uuid-123/black-dog.jpg',
                blobUrl: 'blob:black-dog',
                asset: { id: 'uuid-123', filename: 'black-dog.jpg' },
            });

            expect(apiUpdateIconSpy).toHaveBeenCalledWith({
                source: 'asset',
                value: 'asset://uuid-123/black-dog.jpg',
                name: 'black-dog.jpg',
            });
            expect(previewSpy).toHaveBeenCalledWith({
                source: 'asset',
                value: 'asset://uuid-123/black-dog.jpg',
                name: 'black-dog.jpg',
                previewUrl: 'blob:black-dog',
            });
        });

        it('marks icon as selected when iconName matches icon.id', () => {
            block.iconName = 'share';
            block.icon = { source: 'theme', value: 'share', name: 'Share' };
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                share: { id: 'share', value: '/path/to/share.svg', title: 'Share' },
                download: { id: 'download', value: '/path/to/download.png', title: 'Download' },
            }));

            const body = block.makeModalChangeIconBody();
            const shareEl = body.querySelector('.option-block-icon[icon-id="share"]');
            const downloadEl = body.querySelector('.option-block-icon[icon-id="download"]');

            expect(shareEl.getAttribute('selected')).toBe('true');
            expect(downloadEl.getAttribute('selected')).not.toBe('true');
        });

        it('adds original-icon-selection class to the matching icon', () => {
            block.iconName = 'share';
            block.icon = { source: 'theme', value: 'share', name: 'Share' };
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                share: { id: 'share', value: '/path/to/share.svg', title: 'Share' },
                download: { id: 'download', value: '/path/to/download.png', title: 'Download' },
            }));

            const body = block.makeModalChangeIconBody();
            const shareEl = body.querySelector('.option-block-icon[icon-id="share"]');
            const downloadEl = body.querySelector('.option-block-icon[icon-id="download"]');

            expect(shareEl.classList.contains('original-icon-selection')).toBe(true);
            expect(downloadEl.classList.contains('original-icon-selection')).toBe(false);
        });

        it('marks icon as selected when iconName matches icon.value', () => {
            block.iconName = '/path/to/share.svg';
            block.icon = { source: 'theme', value: '/path/to/share.svg', name: 'Share' };
            eXeLearning.app.themes.getThemeIcons = vi.fn(() => ({
                share: { id: 'share', value: '/path/to/share.svg', title: 'Share' },
                download: { id: 'download', value: '/path/to/download.png', title: 'Download' },
            }));

            const body = block.makeModalChangeIconBody();
            const shareEl = body.querySelector('.option-block-icon[icon-id="share"]');

            expect(shareEl.getAttribute('selected')).toBe('true');
        });
    });

    describe('makeIconValueElement', () => {
        it('creates img element with src and alt', () => {
            window.eXeLearning.config = {};
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
            const mockUpdateBlock = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { updateBlock: mockUpdateBlock },
            };

            block.apiUpdateTitle('New Title');

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

            block.makeBlockButtonsElement();
            deleteButton = block.blockButtons.querySelector('#deleteBlocktest-block-id');

            global.$ = vi.fn(() => ({
                attr: vi.fn(() => 'false'),
                trigger: vi.fn(),
            }));

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
                blockId: 'other-block-id',
                remove: vi.fn(),
            };
            const mockIdevice3 = {
                blockId: 'test-block-id',
                remove: vi.fn(),
            };

            block.idevices = [mockIdevice1, mockIdevice2, mockIdevice3];
            block.blockId = 'test-block-id';

            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdevices();

            expect(mockIdevice1.remove).toHaveBeenCalledWith(false);
            expect(mockIdevice2.remove).not.toHaveBeenCalled();
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

            expect(block.idevices).toHaveLength(1);
            expect(block.idevices).toContain(mockIdevice);
        });

        it('removes iDevice when either id or odeIdeviceId matches', () => {
            const mockIdevice = { id: 'matching-id', odeIdeviceId: 'ode-id' };
            block.idevices = [mockIdevice];
            vi.spyOn(block, 'clearIdevicesOfList').mockImplementation(() => {});

            block.removeIdeviceOfListById('matching-id');

            expect(block.idevices).toHaveLength(0);
        });
    });

    describe('clearIdevicesOfList', () => {
        it('removes iDevices not in engine components list', () => {
            const mockIdevice1 = { hasBeenDeleted: false };
            const mockIdevice2 = { hasBeenDeleted: false };

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

    describe('addBehaviourChangeIcon', () => {
        let iconEl;
        let originalIsAvailable;

        beforeEach(() => {
            iconEl = document.createElement('button');
            block.iconElement = iconEl;
            originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
        });

        it('calls showModalChangeIcon when component is available', async () => {
            const showSpy = vi
                .spyOn(block, 'showModalChangeIcon')
                .mockImplementation(() => {});
            block.addBehaviourChangeIcon();
            iconEl.click();
            await vi.waitFor(() => {
                expect(showSpy).toHaveBeenCalled();
            });
        });

        it('shows alert when component is not available', async () => {
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'iDevice locked' });
            block.addBehaviourChangeIcon();
            iconEl.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
        });
    });

    describe('addBehaviourButtonDropDown', () => {
        let dropdownButton;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            dropdownButton = document.createElement('button');
            dropdownButton.id = `dropdownMenuButton${block.blockId}`;
            block.blockButtons.appendChild(dropdownButton);
        });

        it('calls toggleOn when dropdown has show class and block has hidden-idevices', () => {
            document.body.appendChild(block.blockButtons);
            block.blockContent = document.createElement('article');
            block.blockContent.id = block.blockId;
            block.blockContent.classList.add('hidden-idevices');
            document.body.appendChild(block.blockContent);

            dropdownButton.classList.add('show');
            const toggleOnSpy = vi
                .spyOn(block, 'toggleOn')
                .mockImplementation(() => {});
            block.addBehaviourButtonDropDown();
            dropdownButton.click();

            expect(toggleOnSpy).toHaveBeenCalled();

            document.body.removeChild(block.blockButtons);
            document.body.removeChild(block.blockContent);
        });

        it('does nothing when dropdown does not have show class', () => {
            const toggleOnSpy = vi
                .spyOn(block, 'toggleOn')
                .mockImplementation(() => {});
            block.addBehaviourButtonDropDown();
            dropdownButton.click();
            expect(toggleOnSpy).not.toHaveBeenCalled();
        });
    });

    describe('addBehaviourButtonPropertiesBlock', () => {
        let propertiesButton;
        let originalIsAvailable;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            propertiesButton = document.createElement('button');
            propertiesButton.id = `dropdownBlockMore-button-properties${block.blockId}`;
            block.blockButtons.appendChild(propertiesButton);

            originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
        });

        it('loads Yjs properties and shows properties modal on OK', async () => {
            const loadSpy = vi
                .spyOn(block, 'loadPropertiesFromYjs')
                .mockImplementation(() => {});
            block.addBehaviourButtonPropertiesBlock();
            propertiesButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.properties.show).toHaveBeenCalled();
            });
            expect(loadSpy).toHaveBeenCalled();
        });

        it('shows alert when component is not available', async () => {
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'locked' });
            block.addBehaviourButtonPropertiesBlock();
            propertiesButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
        });
    });

    describe('addBehaviourButtonCloneBlock', () => {
        it('calls apiCloneBlock when button is clicked', async () => {
            block.blockButtons = document.createElement('div');
            const btn = document.createElement('button');
            btn.id = `dropdownBlockMore-button-clone${block.blockId}`;
            block.blockButtons.appendChild(btn);

            const cloneSpy = vi
                .spyOn(block, 'apiCloneBlock')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.addBehaviourButtonCloneBlock();
            btn.click();
            await vi.waitFor(() => {
                expect(cloneSpy).toHaveBeenCalled();
            });
        });
    });

    describe('addBehaviourMoveToPageBlockButton', () => {
        let moveButton;
        let originalIsAvailable;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            moveButton = document.createElement('button');
            moveButton.id = `dropdownBlockMore-button-move${block.blockId}`;
            block.blockButtons.appendChild(moveButton);

            originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
        });

        it('shows confirm modal with correct title on OK', async () => {
            block.addBehaviourMoveToPageBlockButton();
            moveButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });
            const args = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            expect(args.title).toBe('Move box to page');
            expect(args.confirmButtonText).toBe('Move');
        });

        it('shows alert when component is not available', async () => {
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'locked' });
            block.addBehaviourMoveToPageBlockButton();
            moveButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
        });

        it('calls apiUpdatePage with selected page id from confirmExec', async () => {
            const apiUpdatePageSpy = vi
                .spyOn(block, 'apiUpdatePage')
                .mockResolvedValue({ responseMessage: 'OK' });

            const main = document.createElement('div');
            main.id = 'main';
            const workarea = document.createElement('div');
            workarea.id = 'workarea';
            const menuNav = document.createElement('div');
            menuNav.id = 'menu_nav_content';
            const pageEl = document.createElement('div');
            pageEl.setAttribute('nav-id', 'page-2');
            menuNav.appendChild(pageEl);
            workarea.appendChild(menuNav);
            main.appendChild(workarea);
            document.body.appendChild(main);

            const modalBody = document.createElement('div');
            const select = document.createElement('select');
            select.classList.add('select-move-to-page');
            const option = document.createElement('option');
            option.setAttribute('value', 'page-2');
            select.appendChild(option);
            select.selectedIndex = 0;
            modalBody.appendChild(select);
            eXeLearning.app.modals.confirm.modalElementBody = modalBody;

            block.addBehaviourMoveToPageBlockButton();
            moveButton.click();

            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
            });

            const args = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            args.confirmExec();

            await vi.waitFor(() => {
                expect(apiUpdatePageSpy).toHaveBeenCalledWith('page-2');
            });

            document.body.removeChild(main);
        });
    });

    describe('addBehaviourExportBlockButton', () => {
        let exportButton;
        let originalIsAvailable;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            exportButton = document.createElement('button');
            exportButton.id = `dropdownBlockMore-button-export${block.blockId}`;
            block.blockButtons.appendChild(exportButton);

            originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
        });

        afterEach(() => {
            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
        });

        it('calls downloadBlockSelected with blockId on OK', async () => {
            const downloadSpy = vi
                .spyOn(block, 'downloadBlockSelected')
                .mockResolvedValue(undefined);
            block.addBehaviourExportBlockButton();
            exportButton.click();
            await vi.waitFor(() => {
                expect(downloadSpy).toHaveBeenCalledWith(block.blockId);
            });
        });

        it('shows alert when component is not available', async () => {
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'locked' });
            block.addBehaviourExportBlockButton();
            exportButton.click();
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
        });
    });

    // -------------------------------------------------------------------------
    // addBehaviourImportIdeviceButton
    // -------------------------------------------------------------------------
    describe('addBehaviourImportIdeviceButton', () => {
        let importButton;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            importButton = document.createElement('button');
            importButton.id = `dropdownBlockMore-button-import-idevice${block.blockId}`;
            block.blockButtons.appendChild(importButton);
        });

        const flushAvailabilityCheck = () => new Promise((r) => setTimeout(r, 0));

        it('does nothing when an iDevice is already open', async () => {
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            const appendSpy = vi.spyOn(document.body, 'appendChild');
            block.addBehaviourImportIdeviceButton();
            importButton.click();
            await flushAvailabilityCheck();
            expect(appendSpy).not.toHaveBeenCalled();
            eXeLearning.app.project.checkOpenIdevice = vi.fn(() => false);
        });

        // Revisión #2474: cuando el box lo tiene otro colaborador, se muestra
        // el alert y se sale con `return`, sin llegar a `checkOpenIdevice` ni
        // a abrir el file picker.
        it('shows an alert and returns early when the box is held by another collaborator (#2474)', async () => {
            const originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            const originalCheckOpen = eXeLearning.app.project.checkOpenIdevice;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'iDevice locked' });
            const checkOpenSpy = vi.fn(() => false);
            eXeLearning.app.project.checkOpenIdevice = checkOpenSpy;
            const appendSpy = vi.spyOn(document.body, 'appendChild');

            block.addBehaviourImportIdeviceButton();
            importButton.click();
            await flushAvailabilityCheck();

            expect(
                eXeLearning.app.project.isAvalaibleOdeComponent
            ).toHaveBeenCalledWith(block.blockId, null);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'iDevice error',
                    body: 'Could not check the box availability',
                    contentId: 'error',
                }),
            );
            // El `return` de la rama de error corta la ejecución: ni se
            // comprueba si hay un iDevice abierto, ni se abre el file picker.
            expect(checkOpenSpy).not.toHaveBeenCalled();
            expect(appendSpy).not.toHaveBeenCalled();

            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
            eXeLearning.app.project.checkOpenIdevice = originalCheckOpen;
        });

        // Revisión #2474, punto 6: si `isAvalaibleOdeComponent` rechaza
        // (servidor caído, offline), el handler antes dejaba al usuario sin
        // feedback: ni modal, ni apertura del picker, solo una promesa
        // rechazada sin manejar en consola. El `.catch` ahora muestra el
        // mismo alert estándar y corta la ejecución.
        it('shows an alert when the availability check rejects (review #2474, point 6)', async () => {
            const originalIsAvailable = eXeLearning.app.project.isAvalaibleOdeComponent;
            const originalCheckOpen = eXeLearning.app.project.checkOpenIdevice;
            eXeLearning.app.project.isAvalaibleOdeComponent = vi
                .fn()
                .mockRejectedValue(new Error('server hiccup'));
            const checkOpenSpy = vi.fn(() => false);
            eXeLearning.app.project.checkOpenIdevice = checkOpenSpy;
            const appendSpy = vi.spyOn(document.body, 'appendChild');

            block.addBehaviourImportIdeviceButton();
            importButton.click();
            await flushAvailabilityCheck();
            // Let the .catch handler run.
            await new Promise((r) => setTimeout(r, 0));

            expect(
                eXeLearning.app.project.isAvalaibleOdeComponent
            ).toHaveBeenCalledWith(block.blockId, null);
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'iDevice error',
                    body: 'Could not check the box availability',
                    contentId: 'error',
                }),
            );
            // The catch must stop the flow: neither checkOpenIdevice nor the
            // picker should run after a rejected availability check.
            expect(checkOpenSpy).not.toHaveBeenCalled();
            expect(appendSpy).not.toHaveBeenCalled();

            eXeLearning.app.project.isAvalaibleOdeComponent = originalIsAvailable;
            eXeLearning.app.project.checkOpenIdevice = originalCheckOpen;
        });

        it('creates a file input restricted to .idevice on click', async () => {
            let capturedInput;
            const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
                capturedInput = node;
                return node;
            });
            block.addBehaviourImportIdeviceButton();
            importButton.click();
            await flushAvailabilityCheck();
            expect(capturedInput.type).toBe('file');
            expect(capturedInput.accept).toBe('.idevice');
            appendSpy.mockRestore();
        });

        const clickAndCaptureInput = async () => {
            let capturedInput;
            const realAppend = document.body.appendChild.bind(document.body);
            const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
                capturedInput = node;
                return realAppend(node);
            });
            const clickSpy = vi
                .spyOn(HTMLInputElement.prototype, 'click')
                .mockImplementation(() => {});
            block.addBehaviourImportIdeviceButton();
            importButton.click();
            await flushAvailabilityCheck();
            appendSpy.mockRestore();
            return { input: capturedInput, clickSpy };
        };

        const setFiles = (input, files) => {
            Object.defineProperty(input, 'files', { value: files, configurable: true });
        };

        afterEach(() => {
            vi.restoreAllMocks();
            document.querySelectorAll('input[type="file"].d-none').forEach((n) => n.remove());
        });

        it('appends a hidden input to the body and opens the file picker', async () => {
            const { input, clickSpy } = await clickAndCaptureInput();

            expect(input.classList.contains('d-none')).toBe(true);
            expect(document.body.contains(input)).toBe(true);
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });

        it('removes the input when the file picker is cancelled', async () => {
            const { input } = await clickAndCaptureInput();

            input.dispatchEvent(new Event('cancel'));

            expect(document.body.contains(input)).toBe(false);
        });

        it('removes the input on the next window focus when the browser never fires cancel', async () => {
            const { input } = await clickAndCaptureInput();
            expect(document.body.contains(input)).toBe(true);

            window.dispatchEvent(new Event('focus'));

            expect(document.body.contains(input)).toBe(false);
            window.dispatchEvent(new Event('focus'));
        });

        it('stops listening for window focus once the input is cleaned up', async () => {
            const { input } = await clickAndCaptureInput();
            const removeSpy = vi.spyOn(window, 'removeEventListener');

            input.dispatchEvent(new Event('cancel'));

            expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
            removeSpy.mockRestore();
        });

        it('imports the selected file and removes the input on change', async () => {
            const importSpy = vi.spyOn(block, 'importIdeviceFileIntoBlock').mockResolvedValue();
            const { input } = await clickAndCaptureInput();
            const file = new File([new Uint8Array([1])], 'test.idevice');
            setFiles(input, [file]);

            input.dispatchEvent(new Event('change'));
            await vi.waitFor(() => expect(importSpy).toHaveBeenCalledWith(file));

            expect(importSpy).toHaveBeenCalledTimes(1);
            expect(document.body.contains(input)).toBe(false);
        });

        it('imports the selected file even when window focus removed the input first', async () => {
            const importSpy = vi.spyOn(block, 'importIdeviceFileIntoBlock').mockResolvedValue();
            const { input } = await clickAndCaptureInput();
            const file = new File([new Uint8Array([1])], 'test.idevice');
            setFiles(input, [file]);

            window.dispatchEvent(new Event('focus'));
            input.dispatchEvent(new Event('change'));

            await vi.waitFor(() => expect(importSpy).toHaveBeenCalledWith(file));
            expect(document.body.contains(input)).toBe(false);
        });

        it('does not import when the change event has an empty file list', async () => {
            const importSpy = vi.spyOn(block, 'importIdeviceFileIntoBlock').mockResolvedValue();
            const { input } = await clickAndCaptureInput();
            setFiles(input, []);

            input.dispatchEvent(new Event('change'));
            await Promise.resolve();

            expect(importSpy).not.toHaveBeenCalled();
            expect(document.body.contains(input)).toBe(false);
        });

        it('does not import when the input has no files property', async () => {
            const importSpy = vi.spyOn(block, 'importIdeviceFileIntoBlock').mockResolvedValue();
            const { input } = await clickAndCaptureInput();
            setFiles(input, null);

            input.dispatchEvent(new Event('change'));
            await Promise.resolve();

            expect(importSpy).not.toHaveBeenCalled();
            expect(document.body.contains(input)).toBe(false);
        });

        it('does not throw when the input was already detached before change', async () => {
            const importSpy = vi.spyOn(block, 'importIdeviceFileIntoBlock').mockResolvedValue();
            const { input } = await clickAndCaptureInput();
            const file = new File([new Uint8Array([1])], 'test.idevice');
            setFiles(input, [file]);

            input.dispatchEvent(new Event('cancel'));
            input.dispatchEvent(new Event('change'));
            await vi.waitFor(() => expect(importSpy).toHaveBeenCalledWith(file));

            expect(document.body.contains(input)).toBe(false);
        });

        it('creates a new independent input on every click', async () => {
            const inputs = [];
            const realAppend = document.body.appendChild.bind(document.body);
            vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
                inputs.push(node);
                return realAppend(node);
            });
            vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
            block.addBehaviourImportIdeviceButton();

            importButton.click();
            importButton.click();
            await flushAvailabilityCheck();

            expect(inputs).toHaveLength(2);
            expect(inputs[0]).not.toBe(inputs[1]);
        });
    });

    // -------------------------------------------------------------------------
    // importIdeviceFileIntoBlock
    // -------------------------------------------------------------------------
    describe('importIdeviceFileIntoBlock', () => {
        // The catch block shows a fixed, user-facing message and logs the real
        // error with console.error; it does not surface error.message.
        const IMPORT_ERROR_BODY = 'An error occurred while importing the component.';

        let originalBridge;
        let originalComponentImporter;
        let originalMenuNodeSelected;

        beforeEach(() => {
            block.pageId = 'page-1';
            originalBridge = eXeLearning.app.project._yjsBridge;
            originalComponentImporter = window.ComponentImporter;
            originalMenuNodeSelected =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected;
        });

        afterEach(() => {
            eXeLearning.app.project._yjsBridge = originalBridge;
            window.ComponentImporter = originalComponentImporter;
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected =
                originalMenuNodeSelected;
        });

        it('imports successfully, preloads assets and refreshes the page', async () => {
            const importMock = vi.fn().mockResolvedValue({
                success: true,
                blockId: block.blockId,
                componentIds: ['new-idevice-1'],
            });
            const preloadMock = vi.fn().mockResolvedValue(1);
            const loadIdevicesMock = vi.fn().mockResolvedValue();

            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: { preloadAllAssets: preloadMock },
            };
            window.ComponentImporter = class {
                constructor() {}
                importIdeviceIntoBlock = importMock;
            };
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: loadIdevicesMock,
            };

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(importMock).toHaveBeenCalledWith(file, 'page-1', block.blockId);
            expect(preloadMock).toHaveBeenCalled();
            expect(loadIdevicesMock).toHaveBeenCalledWith(true);
        });

        it('shows an alert when import fails', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: null,
            };
            window.ComponentImporter = class {
                constructor() {}
                importIdeviceIntoBlock = vi.fn().mockResolvedValue({
                    success: false,
                    error: 'boom',
                });
            };

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Import error', body: IMPORT_ERROR_BODY }),
            );
        });

        it('shows an alert when the Yjs document manager is not available', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => undefined),
                assetManager: null,
            };
            window.ComponentImporter = class {};

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('shows an alert when ComponentImporter is not loaded', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: null,
            };
            window.ComponentImporter = undefined;

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('shows an alert when no page is selected', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: null,
            };
            window.ComponentImporter = class {
                importIdeviceIntoBlock = vi.fn();
            };
            block.pageId = null;
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = null;

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('shows a generic alert when the import result has no error message', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: null,
            };
            window.ComponentImporter = class {
                constructor() {}
                importIdeviceIntoBlock = vi.fn().mockResolvedValue({
                    success: false,
                });
            };

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('does not call preloadAllAssets when the asset manager does not expose it', async () => {
            const loadIdevicesMock = vi.fn().mockResolvedValue();
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: {},
            };
            window.ComponentImporter = class {
                importIdeviceIntoBlock = vi.fn().mockResolvedValue({
                    success: true,
                    blockId: block.blockId,
                    componentIds: ['x'],
                });
            };
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: loadIdevicesMock,
            };

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(loadIdevicesMock).toHaveBeenCalledWith(true);
        });

        it('falls back to the default message when the error has no message', async () => {
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => ({})),
                assetManager: null,
            };
            window.ComponentImporter = class {
                constructor() {}
                importIdeviceIntoBlock = vi.fn(() => {
                    throw { toString: () => 'weird failure' };
                });
            };

            const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
            await block.importIdeviceFileIntoBlock(file);

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: expect.any(String),
                }),
            );
        });

        const setupBridge = ({ importResult, assetManager = null, documentManager = {} } = {}) => {
            const importMock = vi.fn().mockResolvedValue(importResult);
            const ctorSpy = vi.fn();
            eXeLearning.app.project._yjsBridge = {
                getDocumentManager: vi.fn(() => documentManager),
                assetManager,
            };
            window.ComponentImporter = class {
                constructor(...args) {
                    ctorSpy(...args);
                }
                importIdeviceIntoBlock = importMock;
            };
            return { importMock, ctorSpy };
        };

        const makeFile = () => new File([new Uint8Array([1, 2, 3])], 'test.idevice');

        // exelearning#2653: Modal.setBody assigns to innerHTML, so the alert body
        // must never carry text coming from the imported file or the importer.
        it('never forwards importer error text (possible markup) to the alert body (#2653)', async () => {
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const payload = '<img src=x onerror="window.__xss=1">';
            setupBridge({ importResult: { success: false, error: payload } });

            await block.importIdeviceFileIntoBlock(makeFile());

            const { body } = eXeLearning.app.modals.alert.show.mock.calls[0][0];
            expect(body).toBe(IMPORT_ERROR_BODY);
            expect(body).not.toContain('<');
            // The real error is still available for debugging, via the console only.
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('shows an alert when the Yjs bridge is not available', async () => {
            eXeLearning.app.project._yjsBridge = null;
            window.ComponentImporter = class {};

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import error',
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('shows an alert when the bridge does not expose getDocumentManager', async () => {
            eXeLearning.app.project._yjsBridge = { assetManager: null };
            window.ComponentImporter = class {};

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: IMPORT_ERROR_BODY,
                }),
            );
        });

        it('creates the importer with the document manager and the asset manager', async () => {
            const documentManager = { name: 'doc-manager' };
            const assetManager = { preloadAllAssets: vi.fn().mockResolvedValue(0) };
            const { ctorSpy } = setupBridge({
                importResult: { success: true, componentIds: ['a'] },
                assetManager,
                documentManager,
            });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn().mockResolvedValue(),
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(ctorSpy).toHaveBeenCalledWith(documentManager, assetManager);
        });

        it('imports without an asset manager and still refreshes the page', async () => {
            const loadIdevicesMock = vi.fn().mockResolvedValue();
            const { importMock, ctorSpy } = setupBridge({
                importResult: { success: true, componentIds: ['a'] },
                assetManager: undefined,
            });
            eXeLearning.app.project.idevices = { loadApiIdevicesInPage: loadIdevicesMock };

            const file = makeFile();
            await block.importIdeviceFileIntoBlock(file);

            expect(ctorSpy.mock.calls[0][1]).toBeFalsy();
            expect(importMock).toHaveBeenCalledWith(file, 'page-1', block.blockId);
            expect(loadIdevicesMock).toHaveBeenCalledWith(true);
            expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalled();
        });

        it('falls back to the selected navigation node when the block has no pageId', async () => {
            const { importMock } = setupBridge({
                importResult: { success: true, componentIds: ['a'] },
            });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn().mockResolvedValue(),
            };
            block.pageId = null;
            const getAttribute = vi.fn(() => 'nav-9');
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = {
                getAttribute,
            };

            const file = makeFile();
            await block.importIdeviceFileIntoBlock(file);

            expect(getAttribute).toHaveBeenCalledWith('nav-id');
            expect(importMock).toHaveBeenCalledWith(file, 'nav-9', block.blockId);
        });

        it('prefers the block pageId over the selected navigation node', async () => {
            const { importMock } = setupBridge({
                importResult: { success: true, componentIds: ['a'] },
            });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn().mockResolvedValue(),
            };
            const getAttribute = vi.fn(() => 'nav-9');
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = {
                getAttribute,
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(getAttribute).not.toHaveBeenCalled();
            expect(importMock.mock.calls[0][1]).toBe('page-1');
        });

        it('shows an alert when the selected node has no nav-id attribute', async () => {
            const { importMock } = setupBridge({
                importResult: { success: true },
            });
            block.pageId = null;
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = {
                getAttribute: vi.fn(() => null),
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(importMock).not.toHaveBeenCalled();
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({ body: IMPORT_ERROR_BODY }),
            );
        });

        it('shows a generic alert when the importer returns no result', async () => {
            setupBridge({ importResult: undefined });

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Import error', body: IMPORT_ERROR_BODY }),
            );
        });

        it('does not preload assets nor refresh the page when the import fails', async () => {
            const preloadMock = vi.fn().mockResolvedValue(0);
            const loadIdevicesMock = vi.fn().mockResolvedValue();
            setupBridge({
                importResult: { success: false, error: 'boom' },
                assetManager: { preloadAllAssets: preloadMock },
            });
            eXeLearning.app.project.idevices = { loadApiIdevicesInPage: loadIdevicesMock };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(preloadMock).not.toHaveBeenCalled();
            expect(loadIdevicesMock).not.toHaveBeenCalled();
        });

        it('preloads assets before refreshing the page and shows no alert on success', async () => {
            const calls = [];
            setupBridge({
                importResult: { success: true, componentIds: ['a'] },
                assetManager: {
                    preloadAllAssets: vi.fn(async () => {
                        calls.push('preload');
                    }),
                },
            });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn(async () => {
                    calls.push('load');
                }),
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(calls).toEqual(['preload', 'load']);
            expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalled();
        });

        it('reports a refresh failure, not an import error, when preloading assets fails', async () => {
            const loadIdevicesMock = vi.fn().mockResolvedValue();
            setupBridge({
                importResult: { success: true, componentIds: ['a'] },
                assetManager: {
                    preloadAllAssets: vi.fn().mockRejectedValue(new Error('preload failed')),
                },
            });
            eXeLearning.app.project.idevices = { loadApiIdevicesInPage: loadIdevicesMock };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(loadIdevicesMock).not.toHaveBeenCalled();
            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Page refresh error',
                    body: 'The iDevice was imported, but the page could not be refreshed. Reload the page to see the imported content. Do not import the file again, as it would duplicate the content.',
                }),
            );
            expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalledWith(
                expect.objectContaining({ body: 'preload failed' }),
            );
        });

        it('reports a refresh failure, not an import error, when refreshing the page fails', async () => {
            setupBridge({ importResult: { success: true, componentIds: ['a'] } });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn().mockRejectedValue(new Error('reload failed')),
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Page refresh error',
                    body: 'The iDevice was imported, but the page could not be refreshed. Reload the page to see the imported content. Do not import the file again, as it would duplicate the content.',
                }),
            );
            expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalledWith(
                expect.objectContaining({ body: 'reload failed' }),
            );
        });

        it('logs the refresh failure separately from an import failure', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            setupBridge({ importResult: { success: true, componentIds: ['a'] } });
            eXeLearning.app.project.idevices = {
                loadApiIdevicesInPage: vi.fn().mockRejectedValue(new Error('reload failed')),
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(errorSpy).toHaveBeenCalledWith(
                '[BlockNode] iDevice imported but the page failed to refresh:',
                expect.objectContaining({ message: 'reload failed' }),
            );
            expect(errorSpy).not.toHaveBeenCalledWith(
                '[BlockNode] Import iDevice failed:',
                expect.anything(),
            );
            errorSpy.mockRestore();
        });

        describe('refresh failure after a successful insert (review #2474, point 2)', () => {
            const REFRESH_BODY =
                'The iDevice was imported, but the page could not be refreshed. Reload the page to see the imported content. Do not import the file again, as it would duplicate the content.';

            const setupInsertingImporter = () => {
                const insertedComponents = [];
                const importMock = vi.fn(async () => {
                    insertedComponents.push(`imported-${insertedComponents.length + 1}`);
                    return { success: true, blockId: block.blockId, componentIds: ['c1'] };
                });
                setupBridge({ importResult: { success: true } });
                window.ComponentImporter = class {
                    importIdeviceIntoBlock = importMock;
                };
                return { insertedComponents, importMock };
            };

            it('keeps the inserted iDevice and reports only a refresh failure when loadApiIdevicesInPage(true) rejects', async () => {
                const order = [];
                const { insertedComponents, importMock } = setupInsertingImporter();
                importMock.mockImplementationOnce(async () => {
                    order.push('insert');
                    insertedComponents.push('imported-1');
                    return { success: true, blockId: block.blockId, componentIds: ['c1'] };
                });
                const loadIdevicesMock = vi.fn(async () => {
                    order.push('refresh');
                    throw new Error('reload failed');
                });
                eXeLearning.app.project.idevices = { loadApiIdevicesInPage: loadIdevicesMock };
                const file = makeFile();

                await expect(block.importIdeviceFileIntoBlock(file)).resolves.toBeUndefined();

                expect(order).toEqual(['insert', 'refresh']);
                expect(importMock).toHaveBeenCalledTimes(1);
                expect(importMock).toHaveBeenCalledWith(file, 'page-1', block.blockId);
                expect(insertedComponents).toEqual(['imported-1']);
                expect(loadIdevicesMock).toHaveBeenCalledTimes(1);
                expect(loadIdevicesMock).toHaveBeenCalledWith(true);
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledTimes(1);
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                    expect.objectContaining({ title: 'Page refresh error', body: REFRESH_BODY }),
                );
                expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalledWith(
                    expect.objectContaining({ title: 'Import error' }),
                );
                expect(REFRESH_BODY).toContain('Do not import the file again');
                expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalledWith(
                    expect.objectContaining({ body: 'reload failed' }),
                );
            });

            it('never re-runs the import after the refresh failed (content is not duplicated)', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                const { insertedComponents, importMock } = setupInsertingImporter();
                eXeLearning.app.project.idevices = {
                    loadApiIdevicesInPage: vi.fn().mockRejectedValue(new Error('reload failed')),
                };

                await block.importIdeviceFileIntoBlock(makeFile());
                await Promise.resolve();

                expect(importMock).toHaveBeenCalledTimes(1);
                expect(insertedComponents).toHaveLength(1);
            });

            it('contrast: a genuine import failure never refreshes and shows the import error', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                const loadIdevicesMock = vi.fn().mockResolvedValue();
                const { importMock } = setupBridge({
                    importResult: { success: false, error: 'Target block not found' },
                });
                eXeLearning.app.project.idevices = { loadApiIdevicesInPage: loadIdevicesMock };

                await block.importIdeviceFileIntoBlock(makeFile());

                expect(importMock).toHaveBeenCalledTimes(1);
                expect(loadIdevicesMock).not.toHaveBeenCalled();
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledTimes(1);
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                    expect.objectContaining({ title: 'Import error', body: IMPORT_ERROR_BODY }),
                );
                expect(eXeLearning.app.modals.alert.show).not.toHaveBeenCalledWith(
                    expect.objectContaining({ body: REFRESH_BODY }),
                );
            });
        });

        it('uses the translated default message when the error has an empty message', async () => {
            setupBridge({ importResult: { success: true } });
            window.ComponentImporter = class {
                importIdeviceIntoBlock = vi.fn().mockRejectedValue(new Error(''));
            };

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
                title: 'Import error',
                body: 'An error occurred while importing the component.',
                contentId: 'error',
            });
        });

        it('logs the failure to the console', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            setupBridge({ importResult: { success: false, error: 'boom' } });

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(errorSpy).toHaveBeenCalledWith(
                '[BlockNode] Import iDevice failed:',
                expect.objectContaining({ message: 'boom' }),
            );
            errorSpy.mockRestore();
        });

        it('passes contentId "error" to the alert', async () => {
            setupBridge({ importResult: { success: false, error: 'boom' } });

            await block.importIdeviceFileIntoBlock(makeFile());

            expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                expect.objectContaining({ contentId: 'error' }),
            );
        });
    });

    describe('addBehaviourToggleBlockButton', () => {
        let toggleButton;
        let originalDollar;

        beforeEach(() => {
            block.headElement = document.createElement('header');
            toggleButton = document.createElement('button');
            toggleButton.id = `toggleBox${block.blockId}`;
            block.headElement.appendChild(toggleButton);

            block.blockContent = document.createElement('article');
            block.toggleElement = null;

            originalDollar = global.$;
            global.$ = vi.fn(() => ({
                attr: vi.fn(() => 'false'),
                trigger: vi.fn(),
            }));
        });

        afterEach(() => {
            global.$ = originalDollar;
        });

        it('calls toggleOff when toggle is currently on', () => {
            toggleButton.classList.add('box-toggle-on');
            const toggleOffSpy = vi
                .spyOn(block, 'toggleOff')
                .mockImplementation(() => {});
            block.addBehaviourToggleBlockButton();
            toggleButton.click();
            expect(toggleOffSpy).toHaveBeenCalled();
        });

        it('calls toggleOn when toggle is currently off', () => {
            toggleButton.classList.add('box-toggle-off');
            const toggleOnSpy = vi
                .spyOn(block, 'toggleOn')
                .mockImplementation(() => {});
            block.addBehaviourToggleBlockButton();
            toggleButton.click();
            expect(toggleOnSpy).toHaveBeenCalled();
        });

        it('sets this.toggleElement from headElement on call', () => {
            block.addBehaviourToggleBlockButton();
            expect(block.toggleElement).toBe(toggleButton);
        });
    });

    describe('addTooltips', () => {
        let originalDollar;

        beforeEach(() => {
            block.blockButtons = document.createElement('div');
            originalDollar = global.$;
        });

        afterEach(() => {
            global.$ = originalDollar;
        });

        it('calls initTooltips on blockButtons', () => {
            global.$ = vi.fn(() => ({ addClass: vi.fn() }));
            block.addTooltips();
            expect(eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(
                block.blockButtons,
            );
        });

        it('adds exe-app-tooltip class via jQuery', () => {
            const mockAddClass = vi.fn();
            global.$ = vi.fn(() => ({ addClass: mockAddClass }));
            block.addTooltips();
            expect(mockAddClass).toHaveBeenCalledWith('exe-app-tooltip');
        });
    });

    describe('addNoTranslateForGoogle', () => {
        let originalDollar;

        beforeEach(() => {
            block.ideviceButtons = document.createElement('div');
            originalDollar = global.$;
        });

        afterEach(() => {
            global.$ = originalDollar;
        });

        it('calls jQuery to add notranslate class to auto-icons', () => {
            const mockAddClass = vi.fn();
            global.$ = vi.fn(() => ({ addClass: mockAddClass }));
            block.addNoTranslateForGoogle();
            expect(mockAddClass).toHaveBeenCalledWith('notranslate');
        });
    });

    describe('addBehaviourToModalChangeIconBody', () => {
        let modalBody;
        let icon1;
        let icon2;

        beforeEach(() => {
            modalBody = document.createElement('div');
            modalBody.id = 'change-block-icon-modal-content';
            icon1 = document.createElement('div');
            icon1.classList.add('option-block-icon');
            icon1.setAttribute('selected', 'false');
            icon2 = document.createElement('div');
            icon2.classList.add('option-block-icon');
            icon2.setAttribute('selected', 'false');
            modalBody.appendChild(icon1);
            modalBody.appendChild(icon2);
            eXeLearning.app.modals.confirm.modalElementBody = modalBody;
        });

        it('selects clicked icon and deselects others on click', () => {
            icon1.setAttribute('selected', 'true');
            block.addBehaviourToModalChangeIconBody();
            icon2.click();
            expect(icon2.getAttribute('selected')).toBe('true');
            expect(icon1.getAttribute('selected')).toBe('false');
        });

        it('calls saveIconAction and closes modal on double-click', () => {
            const saveIconSpy = vi
                .spyOn(block, 'saveIconAction')
                .mockImplementation(() => {});
            block.addBehaviourToModalChangeIconBody();
            icon1.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            expect(saveIconSpy).toHaveBeenCalled();
            expect(eXeLearning.app.modals.confirm.close).toHaveBeenCalled();
        });

        it('calls saveIconAction and closes modal on Enter key', () => {
            const saveIconSpy = vi
                .spyOn(block, 'saveIconAction')
                .mockImplementation(() => {});
            block.addBehaviourToModalChangeIconBody();
            icon1.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
            );
            expect(saveIconSpy).toHaveBeenCalled();
            expect(eXeLearning.app.modals.confirm.close).toHaveBeenCalled();
        });

        it('does not call saveIconAction on non-Enter keyup', () => {
            const saveIconSpy = vi
                .spyOn(block, 'saveIconAction')
                .mockImplementation(() => {});
            block.addBehaviourToModalChangeIconBody();
            icon1.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'Space', bubbles: true }),
            );
            expect(saveIconSpy).not.toHaveBeenCalled();
        });
    });

    describe('apiSaveProperties', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            block.toggleElement = document.createElement('button');
            block.toggleElement.appendChild(document.createElement('span'));
            block.headElement = document.createElement('header');
            mockEngine.getIdeviceById = vi.fn();
        });

        it('calls putSavePropertiesBlock with correct params', async () => {
            eXeLearning.app.api.putSavePropertiesBlock.mockResolvedValue({
                responseMessage: 'OK',
            });
            await block.apiSaveProperties({ visibility: 'true' });
            expect(eXeLearning.app.api.putSavePropertiesBlock).toHaveBeenCalled();
            const args = eXeLearning.app.api.putSavePropertiesBlock.mock.calls[0][0];
            expect(args.odePagStructureSyncId).toBe(block.blockId);
        });

        it('adds updateChildsProperties when inherit is true', async () => {
            eXeLearning.app.api.putSavePropertiesBlock.mockResolvedValue({
                responseMessage: 'OK',
                odePagStructureSync: {},
            });
            vi.spyOn(block, 'generateBlockContentNode').mockImplementation(() => {});
            await block.apiSaveProperties({}, true);
            const args = eXeLearning.app.api.putSavePropertiesBlock.mock.calls[0][0];
            expect(args.updateChildsProperties).toBe('true');
        });

        it('calls generateBlockContentNode(false) on success', async () => {
            eXeLearning.app.api.putSavePropertiesBlock.mockResolvedValue({
                responseMessage: 'OK',
            });
            const generateSpy = vi
                .spyOn(block, 'generateBlockContentNode')
                .mockImplementation(() => {});
            await block.apiSaveProperties({});
            await vi.waitFor(() => {
                expect(generateSpy).toHaveBeenCalledWith(false);
            });
        });

        it('shows alert on error response', async () => {
            eXeLearning.app.api.putSavePropertiesBlock.mockResolvedValue({
                responseMessage: 'ERROR',
            });
            await block.apiSaveProperties({});
            await vi.waitFor(() => {
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            });
        });

        it('propagates properties to idevices when inherit=true and odeComponentsSyncs exists', async () => {
            const mockIdevice = {
                setProperties: vi.fn(),
                makeIdeviceContentNode: vi.fn(),
            };
            mockEngine.getIdeviceById.mockReturnValue(mockIdevice);
            eXeLearning.app.api.putSavePropertiesBlock.mockResolvedValue({
                responseMessage: 'OK',
                odePagStructureSync: {
                    odeComponentsSyncs: [{ odeIdeviceId: 'idevice-1' }],
                },
            });
            vi.spyOn(block, 'generateBlockContentNode').mockImplementation(() => {});
            await block.apiSaveProperties({}, true);
            await vi.waitFor(() => {
                expect(mockIdevice.setProperties).toHaveBeenCalledWith(
                    block.properties,
                    true,
                );
                expect(mockIdevice.makeIdeviceContentNode).toHaveBeenCalledWith(false);
            });
        });
    });

    describe('apiUpdatePage', () => {
        it('returns false when target page equals current page', async () => {
            block.odeNavStructureSyncId = 'page-1';
            const result = await block.apiUpdatePage('page-1');
            expect(result).toBe(false);
        });

        it('routes through moveToPageViaYjs when Yjs is enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            const moveSpy = vi
                .spyOn(block, 'moveToPageViaYjs')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.odeNavStructureSyncId = 'page-1';
            await block.apiUpdatePage('other-page');
            expect(moveSpy).toHaveBeenCalledWith('other-page');
        });

        it('legacy path calls apiSendDataService and removes on OK', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            block.odeNavStructureSyncId = 'page-1';
            const apiSendSpy = vi
                .spyOn(block, 'apiSendDataService')
                .mockResolvedValue({ responseMessage: 'OK' });
            const removeSpy = vi
                .spyOn(block, 'remove')
                .mockImplementation(() => {});
            await block.apiUpdatePage('page-2');
            expect(apiSendSpy).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalled();
        });

        it('legacy path shows error modal on non-OK response', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            block.odeNavStructureSyncId = 'page-1';
            vi.spyOn(block, 'apiSendDataService').mockResolvedValue(false);
            const showModalSpy = vi
                .spyOn(block, 'showModalMessageErrorDatabase')
                .mockImplementation(() => {});
            await block.apiUpdatePage('page-2');
            expect(showModalSpy).toHaveBeenCalled();
        });
    });

    describe('deleteBlockViaYjs', () => {
        it('returns ERROR when bridge not available', async () => {
            eXeLearning.app.project._yjsBridge = null;
            const result = await block.deleteBlockViaYjs();
            expect(result.responseMessage).toBe('ERROR');
        });

        it('calls deleteBlock with blockId and returns OK on success', async () => {
            const mockDelete = vi.fn().mockReturnValue(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { deleteBlock: mockDelete },
            };
            const result = await block.deleteBlockViaYjs();
            expect(mockDelete).toHaveBeenCalledWith(block.pageId, block.blockId);
            expect(result.responseMessage).toBe('OK');
        });

        it('retries with this.id when blockId fails and ids differ', async () => {
            block.id = 'alt-id';
            block.blockId = 'block-id-1';
            const mockDelete = vi
                .fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { deleteBlock: mockDelete },
            };
            const result = await block.deleteBlockViaYjs();
            expect(mockDelete).toHaveBeenCalledTimes(2);
            expect(result.responseMessage).toBe('OK');
        });

        it('returns ERROR when all attempts fail', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { deleteBlock: vi.fn().mockReturnValue(false) },
            };
            const result = await block.deleteBlockViaYjs();
            expect(result.responseMessage).toBe('ERROR');
            warnSpy.mockRestore();
        });

        it('returns ERROR when an exception is thrown', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    deleteBlock: vi.fn(() => {
                        throw new Error('delete failed');
                    }),
                },
            };
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await block.deleteBlockViaYjs();
            expect(result.responseMessage).toBe('ERROR');
            errSpy.mockRestore();
        });
    });

    describe('reorderViaYjs', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('moving');
        });

        it('returns ERROR when bridge not available', async () => {
            eXeLearning.app.project._yjsBridge = null;
            const result = await block.reorderViaYjs();
            expect(result.responseMessage).toBe('ERROR');
        });

        it('calls updateBlockOrder with blockId and returns OK on success', async () => {
            const mockUpdate = vi.fn().mockReturnValue(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { updateBlockOrder: mockUpdate },
            };
            block.order = 2;
            const result = await block.reorderViaYjs();
            expect(mockUpdate).toHaveBeenCalledWith(block.blockId, 2);
            expect(result.responseMessage).toBe('OK');
        });

        it('retries with this.id when blockId fails and ids differ', async () => {
            block.id = 'alt-id';
            block.blockId = 'block-id-1';
            const mockUpdate = vi
                .fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);
            eXeLearning.app.project._yjsBridge = {
                structureBinding: { updateBlockOrder: mockUpdate },
            };
            const result = await block.reorderViaYjs();
            expect(mockUpdate).toHaveBeenCalledTimes(2);
            expect(result.responseMessage).toBe('OK');
        });

        it('returns ERROR when all attempts fail', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    updateBlockOrder: vi.fn().mockReturnValue(false),
                },
            };
            const result = await block.reorderViaYjs();
            expect(result.responseMessage).toBe('ERROR');
        });

        it('schedules removal of moving class on success', async () => {
            vi.useFakeTimers();
            try {
                eXeLearning.app.project._yjsBridge = {
                    structureBinding: {
                        updateBlockOrder: vi.fn().mockReturnValue(true),
                    },
                };
                await block.reorderViaYjs();
                expect(block.blockContent.classList.contains('moving')).toBe(true);
                vi.advanceTimersByTime(mockEngine.movingClassDuration + 10);
                expect(block.blockContent.classList.contains('moving')).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('returns ERROR when exception is thrown', async () => {
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    updateBlockOrder: vi.fn(() => {
                        throw new Error('reorder error');
                    }),
                },
            };
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await block.reorderViaYjs();
            expect(result.responseMessage).toBe('ERROR');
            errSpy.mockRestore();
        });
    });

    describe('getFallbackPageOrder', () => {
        it('returns 1 when components.blocks is not an array', () => {
            mockEngine.components = {};
            block.pageId = 'page-1';
            expect(block.getFallbackPageOrder()).toBe(1);
        });

        it('returns 1 when no blocks exist', () => {
            mockEngine.components = { blocks: [] };
            block.pageId = 'page-1';
            expect(block.getFallbackPageOrder()).toBe(1);
        });

        it('returns max order + 1 from blocks on current page', () => {
            block.pageId = 'page-1';
            mockEngine.components = {
                blocks: [
                    { pageId: 'page-1', order: 3 },
                    { pageId: 'page-1', order: 7 },
                    { pageId: 'page-2', order: 10 },
                ],
            };
            expect(block.getFallbackPageOrder()).toBe(8);
        });

        it('falls back to blockContent.getAttribute when block.order is undefined', () => {
            block.pageId = 'page-1';
            const bc = document.createElement('article');
            bc.setAttribute('order', '5');
            mockEngine.components = {
                blocks: [{ pageId: 'page-1', order: undefined, blockContent: bc }],
            };
            expect(block.getFallbackPageOrder()).toBe(6);
        });

        it('returns 1 when exception is thrown', () => {
            const originalComponents = mockEngine.components;
            Object.defineProperty(mockEngine, 'components', {
                get() {
                    throw new Error('oops');
                },
                configurable: true,
            });
            expect(block.getFallbackPageOrder()).toBe(1);
            Object.defineProperty(mockEngine, 'components', {
                value: originalComponents,
                configurable: true,
                writable: true,
            });
        });
    });

    describe('apiUpdateOrder', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            mockEngine.updateComponentsBlocks = vi.fn();
        });

        it('routes through reorderViaYjs when Yjs is enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            const reorderSpy = vi
                .spyOn(block, 'reorderViaYjs')
                .mockResolvedValue({ responseMessage: 'OK' });
            await block.apiUpdateOrder();
            expect(reorderSpy).toHaveBeenCalled();
        });

        it('legacy path calls putReorderBlock and removes moving class on OK', async () => {
            vi.useFakeTimers();
            try {
                eXeLearning.app.project._yjsEnabled = false;
                block.blockContent.classList.add('moving');
                vi.spyOn(block, 'apiSendDataService').mockResolvedValue({
                    responseMessage: 'OK',
                });
                await block.apiUpdateOrder();
                vi.advanceTimersByTime(mockEngine.movingClassDuration + 10);
                expect(block.blockContent.classList.contains('moving')).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('legacy path shows error modal on non-OK response', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            vi.spyOn(block, 'apiSendDataService').mockResolvedValue(false);
            const showModalSpy = vi
                .spyOn(block, 'showModalMessageErrorDatabase')
                .mockImplementation(() => {});
            await block.apiUpdateOrder();
            expect(showModalSpy).toHaveBeenCalled();
        });

        it('with getCurrentOrder=true reads order from adjacent blocks first', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            const container = document.createElement('div');
            const prevBlock = document.createElement('article');
            prevBlock.classList.add('box');
            prevBlock.setAttribute('order', '5');
            container.appendChild(prevBlock);
            container.appendChild(block.blockContent);

            vi.spyOn(block, 'apiSendDataService').mockResolvedValue({
                responseMessage: 'OK',
            });
            await block.apiUpdateOrder(true);
            expect(block.order).toBe(6);
        });

        it('with getCurrentOrder=true uses getFallbackPageOrder when no adjacent blocks', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            const container = document.createElement('div');
            container.appendChild(block.blockContent);
            mockEngine.components = { blocks: [] };
            block.pageId = 'page-1';

            vi.spyOn(block, 'apiSendDataService').mockResolvedValue({
                responseMessage: 'OK',
            });
            await block.apiUpdateOrder(true);
            expect(block.order).toBe(1);
        });
    });

    describe('apiDeleteBlock', () => {
        beforeEach(() => {
            mockEngine.updateComponentsBlocks = vi.fn();
        });

        it('calls deleteBlockViaYjs when Yjs is enabled', async () => {
            eXeLearning.app.project._yjsEnabled = true;
            const deleteSpy = vi
                .spyOn(block, 'deleteBlockViaYjs')
                .mockResolvedValue({ responseMessage: 'OK' });
            await block.apiDeleteBlock();
            expect(deleteSpy).toHaveBeenCalled();
        });

        it('legacy path calls eXeLearning.app.api.deleteBlock', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.api.deleteBlock = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'OK' });
            await block.apiDeleteBlock();
            await vi.waitFor(() => {
                expect(eXeLearning.app.api.deleteBlock).toHaveBeenCalledWith(block.id);
            });
        });

        it('legacy path calls updateComponentsBlocks when odePagStructureSyncs present', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            const syncs = [{ id: 'b1', order: 0 }];
            eXeLearning.app.api.deleteBlock = vi.fn().mockResolvedValue({
                responseMessage: 'OK',
                odePagStructureSyncs: syncs,
            });
            await block.apiDeleteBlock();
            await vi.waitFor(() => {
                expect(mockEngine.updateComponentsBlocks).toHaveBeenCalledWith(
                    syncs,
                    ['order'],
                );
            });
        });

        it('legacy path shows error modal on failure', async () => {
            eXeLearning.app.project._yjsEnabled = false;
            eXeLearning.app.api.deleteBlock = vi
                .fn()
                .mockResolvedValue({ responseMessage: 'ERROR' });
            const showModalSpy = vi
                .spyOn(block, 'showModalMessageErrorDatabase')
                .mockImplementation(() => {});
            await block.apiDeleteBlock();
            await vi.waitFor(() => {
                expect(showModalSpy).toHaveBeenCalled();
            });
        });
    });

    describe('apiSendDataService', () => {
        beforeEach(() => {
            mockEngine.updateComponentsBlocks = vi.fn();
        });

        it('returns response on success', async () => {
            eXeLearning.app.api.putSaveBlock.mockResolvedValue({
                responseMessage: 'OK',
            });
            const result = await block.apiSendDataService('putSaveBlock', [
                'odePagStructureSyncId',
            ]);
            expect(result.responseMessage).toBe('OK');
        });

        it('calls updateComponentsBlocks when odePagStructureSyncs is present', async () => {
            const syncs = [{ id: 'b1', order: 1 }];
            eXeLearning.app.api.putSaveBlock.mockResolvedValue({
                responseMessage: 'OK',
                odePagStructureSyncs: syncs,
            });
            await block.apiSendDataService('putSaveBlock', [
                'odePagStructureSyncId',
                'order',
            ]);
            expect(mockEngine.updateComponentsBlocks).toHaveBeenCalledWith(syncs, [
                'order',
            ]);
        });

        it('returns false on non-OK response', async () => {
            eXeLearning.app.api.putSaveBlock.mockResolvedValue({
                responseMessage: 'ERROR',
            });
            const result = await block.apiSendDataService('putSaveBlock', [
                'odePagStructureSyncId',
            ]);
            expect(result).toBe(false);
        });
    });

    describe('generateDataObject', () => {
        it('builds data object from params array', () => {
            block.blockId = 'blk-1';
            block.iconName = 'myIcon';
            block.blockName = 'My Block';
            block.order = 3;

            const result = block.generateDataObject([
                'odePagStructureSyncId',
                'iconName',
                'blockName',
                'order',
            ]);

            expect(result.odePagStructureSyncId).toBe('blk-1');
            expect(result.iconName).toBe('myIcon');
            expect(result.blockName).toBe('My Block');
            expect(result.order).toBe(3);
        });

        it('only includes params listed in the array', () => {
            const result = block.generateDataObject(['odePagStructureSyncId']);
            expect(Object.keys(result)).toEqual(['odePagStructureSyncId']);
        });
    });

    describe('getDictBaseValuesData', () => {
        it('returns correct base data dictionary', () => {
            block.blockId = 'blk-1';
            block.iconName = 'icon1';
            block.blockName = 'Block';
            block.order = 2;
            block.odeNavStructureSyncId = 'nav-1';
            block.pageId = 'page-1';

            const result = block.getDictBaseValuesData();

            expect(result.odePagStructureSyncId).toBe('blk-1');
            expect(result.iconName).toBe('icon1');
            expect(result.blockName).toBe('Block');
            expect(result.order).toBe(2);
            expect(result.odeVersionId).toBe('v1');
            expect(result.odeSessionId).toBe('session-123');
            expect(result.odeNavStructureSyncId).toBe('nav-1');
            expect(result.odePageId).toBe('page-1');
        });

        it('uses structure defaults when odeNavStructureSyncId and pageId are unset', () => {
            block.odeNavStructureSyncId = null;
            block.pageId = null;

            const result = block.getDictBaseValuesData();

            expect(result.odeNavStructureSyncId).toBe('nav-id-1');
            expect(result.odePageId).toBe('page-id-1');
        });
    });

    describe('showModalMessageErrorDatabase', () => {
        it('shows alert with default message after 300ms timeout', async () => {
            vi.useFakeTimers();
            try {
                block.showModalMessageErrorDatabase({}, 'Default error message');
                vi.advanceTimersByTime(300);
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Block error',
                        body: 'Default error message',
                    }),
                );
            } finally {
                vi.useRealTimers();
            }
        });

        it('shows default message even when response is falsy', async () => {
            vi.useFakeTimers();
            try {
                block.showModalMessageErrorDatabase(false, 'Fallback message');
                vi.advanceTimersByTime(300);
                expect(eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                    expect.objectContaining({ body: 'Fallback message' }),
                );
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('remove', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            document.body.appendChild(block.blockContent);
            mockEngine.removeBlockOfComponentList = vi.fn();
            mockEngine.updateMode = vi.fn();
        });

        afterEach(() => {
            if (document.body.contains(block.blockContent)) {
                document.body.removeChild(block.blockContent);
            }
        });

        it('removes blockContent from the DOM', () => {
            vi.spyOn(block, 'removeIdevices').mockImplementation(() => {});
            block.remove();
            expect(document.body.contains(block.blockContent)).toBe(false);
        });

        it('calls engine.removeBlockOfComponentList with block id', () => {
            vi.spyOn(block, 'removeIdevices').mockImplementation(() => {});
            block.remove();
            expect(mockEngine.removeBlockOfComponentList).toHaveBeenCalledWith(
                block.id,
            );
        });

        it('calls engine.updateMode', () => {
            vi.spyOn(block, 'removeIdevices').mockImplementation(() => {});
            block.remove();
            expect(mockEngine.updateMode).toHaveBeenCalled();
        });

        it('calls apiDeleteBlock when bbdd is true', () => {
            vi.spyOn(block, 'removeIdevices').mockImplementation(() => {});
            const apiDeleteSpy = vi
                .spyOn(block, 'apiDeleteBlock')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.remove(true);
            expect(apiDeleteSpy).toHaveBeenCalled();
        });

        it('does not call apiDeleteBlock when bbdd is false', () => {
            vi.spyOn(block, 'removeIdevices').mockImplementation(() => {});
            const apiDeleteSpy = vi
                .spyOn(block, 'apiDeleteBlock')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.remove(false);
            expect(apiDeleteSpy).not.toHaveBeenCalled();
        });
    });

    describe('removeClassLoading', () => {
        it('removes loading class from blockContent', () => {
            block.blockContent = document.createElement('article');
            block.blockContent.classList.add('loading', 'extra-class');
            block.removeClassLoading();
            expect(block.blockContent.classList.contains('loading')).toBe(false);
            expect(block.blockContent.classList.contains('extra-class')).toBe(true);
        });
    });

    describe('updateMode', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
            block.headElement = document.createElement('header');
            block.headElement.classList.add('draggable');
            block.headElement.setAttribute('draggable', 'true');
            block.mode = 'export';
        });

        it('sets mode attribute on blockContent', () => {
            block.updateMode('edition');
            expect(block.blockContent.getAttribute('mode')).toBe('edition');
        });

        it('edition mode makes headElement non-draggable', () => {
            block.updateMode('edition');
            expect(block.headElement.getAttribute('draggable')).toBe('false');
            expect(block.headElement.classList.contains('draggable')).toBe(false);
        });

        it('export mode makes headElement draggable', () => {
            block.mode = 'edition';
            block.headElement.classList.remove('draggable');
            block.updateMode('export');
            expect(block.headElement.getAttribute('draggable')).toBe('true');
            expect(block.headElement.classList.contains('draggable')).toBe(true);
        });

        it('uses existing this.mode when no argument is provided', () => {
            block.mode = 'export';
            block.updateMode();
            expect(block.blockContent.getAttribute('mode')).toBe('export');
        });
    });

    describe('updateParam id and order cases', () => {
        beforeEach(() => {
            block.blockContent = document.createElement('article');
        });

        it("updates blockContent sym-id attribute for param 'id'", () => {
            block.updateParam('id', 'new-block-id');
            expect(block.id).toBe('new-block-id');
            expect(block.blockContent.getAttribute('sym-id')).toBe('new-block-id');
        });

        it("updates blockContent order attribute for param 'order'", () => {
            block.updateParam('order', 7);
            expect(block.order).toBe(7);
            expect(block.blockContent.getAttribute('order')).toBe('7');
        });

        it('updates arbitrary property without DOM side-effect for other params', () => {
            block.updateParam('blockName', 'Hello');
            expect(block.blockName).toBe('Hello');
        });
    });

    describe('resetWindowHash', () => {
        afterEach(() => {
            window.location.hash = '';
        });

        it('sets window.location.hash to node-content', () => {
            block.resetWindowHash();
            expect(window.location.hash).toContain('node-content');
        });
    });

    describe('focusTextInput', () => {
        it('focuses the input element', () => {
            const input = document.createElement('input');
            input.value = 'test';
            document.body.appendChild(input);
            const focusSpy = vi.spyOn(input, 'focus');
            block.focusTextInput(input);
            expect(focusSpy).toHaveBeenCalled();
            document.body.removeChild(input);
        });

        it('clears and restores the input value to move caret to end', () => {
            const input = document.createElement('input');
            input.value = 'original value';
            document.body.appendChild(input);
            block.focusTextInput(input);
            expect(input.value).toBe('original value');
            document.body.removeChild(input);
        });
    });

    describe('sendPublishedNotification', () => {
        it('does nothing when offlineInstallation is true', () => {
            block.offlineInstallation = true;
            block.realTimeEventNotifier = { notify: vi.fn() };
            block.sendPublishedNotification();
            expect(block.realTimeEventNotifier.notify).not.toHaveBeenCalled();
        });

        it('calls realTimeEventNotifier.notify when not offline', () => {
            block.offlineInstallation = false;
            const notifySpy = vi.fn();
            block.realTimeEventNotifier = { notify: notifySpy };
            block.sendPublishedNotification();
            expect(notifySpy).toHaveBeenCalledWith(
                eXeLearning.app.project.odeSession,
                { name: 'new-content-published' },
            );
        });
    });

    describe('makeIconValueElement — static / offline mode branch', () => {
        it('converts absolute path to relative when isStaticMode is true', () => {
            const savedConfig = eXeLearning.config;
            eXeLearning.config = { isStaticMode: true, isOfflineInstallation: false };

            const icon = { value: '/themes/theme/icons/star.svg', title: 'Star' };
            const img = block.makeIconValueElement(icon);

            expect(img.getAttribute('src')).toBe('./themes/theme/icons/star.svg');
            eXeLearning.config = savedConfig;
        });

        it('converts absolute path to relative when isOfflineInstallation is true', () => {
            const savedConfig = eXeLearning.config;
            eXeLearning.config = { isStaticMode: false, isOfflineInstallation: true };

            const icon = { value: '/themes/theme/icons/star.svg', title: 'Star' };
            const img = block.makeIconValueElement(icon);

            expect(img.getAttribute('src')).toBe('./themes/theme/icons/star.svg');
            eXeLearning.config = savedConfig;
        });

        it('leaves path unchanged in server mode', () => {
            const icon = { value: '/themes/theme/icons/star.svg', title: 'Star' };
            const img = block.makeIconValueElement(icon);
            expect(img.getAttribute('src')).toBe('/themes/theme/icons/star.svg');
        });

        it('leaves relative path unchanged', () => {
            const icon = { value: 'relative/path/icon.svg', title: 'Icon' };
            const img = block.makeIconValueElement(icon);
            expect(img.getAttribute('src')).toBe('relative/path/icon.svg');
        });
    });

    describe('loadPropertiesFromYjs null yjsProperties', () => {
        it('does nothing when getBlockProperties returns null', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getBlockProperties: vi.fn(() => null),
                },
            };
            const originalValue = block.properties.visibility.value;
            block.loadPropertiesFromYjs();
            expect(block.properties.visibility.value).toBe(originalValue);
        });

        it('handles getBlockProperties returning undefined gracefully', () => {
            eXeLearning.app.project._yjsEnabled = true;
            eXeLearning.app.project._yjsBridge = {
                structureBinding: {
                    getBlockProperties: vi.fn(() => undefined),
                },
            };
            const originalValue = block.properties.visibility.value;
            block.loadPropertiesFromYjs();
            expect(block.properties.visibility.value).toBe(originalValue);
        });
    });

    describe('apiUpdateIcon — no id branch', () => {
        it('does not call apiSendDataService when id is null', () => {
            const apiSendSpy = vi
                .spyOn(block, 'apiSendDataService')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.id = null;
            block.apiUpdateIcon('new-icon');
            expect(apiSendSpy).not.toHaveBeenCalled();
        });
    });

    describe('apiUpdateTitle — no id branch', () => {
        it('does not call apiSendDataService when id is null', () => {
            block.blockNameElementText = document.createElement('h1');
            const apiSendSpy = vi
                .spyOn(block, 'apiSendDataService')
                .mockResolvedValue({ responseMessage: 'OK' });
            block.id = null;
            block.apiUpdateTitle('New Title');
            expect(apiSendSpy).not.toHaveBeenCalled();
        });
    });

    describe('generateBlockContentNode — no id branch', () => {
        let originalDollar;

        beforeEach(() => {
            originalDollar = global.$;
            if (typeof global.$ !== 'function') {
                global.$ = vi.fn(() => ({ addClass: vi.fn() }));
            }
        });

        afterEach(() => {
            global.$ = originalDollar;
        });

        it('does not set sym-id attribute when block has no id', () => {
            block.id = null;
            const node = block.generateBlockContentNode(true);
            expect(node.hasAttribute('sym-id')).toBe(false);
        });
    });

});

describe('sortThemeIcons', () => {
    it('returns icons sorted by id with numeric awareness', () => {
        const sorted = sortThemeIcons({
            icon10: { id: 'icon10', value: '/i/icon10.svg' },
            icon2: { id: 'icon2', value: '/i/icon2.svg' },
            icon1: { id: 'icon1', value: '/i/icon1.svg' },
        });

        expect(sorted.map((icon) => icon.id)).toEqual(['icon1', 'icon2', 'icon10']);
    });

    it('drops entries without a value and falls back to value when id is missing', () => {
        const sorted = sortThemeIcons({
            b: { id: 'b', value: '/i/b.svg' },
            broken: { id: 'broken' },
            empty: null,
            a: { value: '/i/a.svg' },
        });

        expect(sorted.map((icon) => icon.id || icon.value)).toEqual(['/i/a.svg', 'b']);
    });

    it('returns an empty list for null or undefined input', () => {
        expect(sortThemeIcons(null)).toEqual([]);
        expect(sortThemeIcons(undefined)).toEqual([]);
    });
});
