/**
 * Tests for MenuStructureBehaviour class
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../interface/importProgress.js', () => ({
    default: vi.fn().mockImplementation(function MockImportProgress() {
        return {
            show: vi.fn(),
            update: vi.fn(),
            hide: vi.fn(),
        };
    }),
}));

// Mock translation function
global._ = vi.fn((str) => str);

// Mock window.AppLogger
global.window = global.window || {};
window.AppLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

import MenuStructureBehaviour from './menuStructureBehaviour.js';

const buildJqueryStub = () => {
    class JQueryLite {
        constructor(elements) {
            this.elements = elements || [];
        }

        eq(idx) {
            const el = this.elements[idx] ? [this.elements[idx]] : [];
            return new JQueryLite(el);
        }

        attr(name, value) {
            if (value === undefined) {
                return this.elements[0]?.getAttribute(name);
            }
            this.elements.forEach((el) => el.setAttribute(name, value));
            return this;
        }

        addClass(cls) {
            this.elements.forEach((el) => el.classList.add(cls));
            return this;
        }

        remove() {
            this.elements.forEach((el) => el.remove());
            return this;
        }

        hide() {
            this.elements.forEach((el) => {
                el.style.display = 'none';
            });
            return this;
        }

        is(selector) {
            if (selector === ':visible') {
                const el = this.elements[0];
                if (!el) return false;
                return el.style.display !== 'none';
            }
            return false;
        }

        css(prop, value) {
            if (value === undefined) {
                return this.elements[0]?.style?.[prop] || '';
            }
            this.elements.forEach((el) => {
                el.style[prop] = value;
            });
            return this;
        }

        append(html) {
            this.elements.forEach((el) => {
                if (typeof html === 'string') {
                    el.insertAdjacentHTML('beforeend', html);
                } else if (html instanceof HTMLElement) {
                    el.appendChild(html);
                }
            });
            return this;
        }

        off() {
            return this;
        }

        on(event, handler) {
            this.elements.forEach((el) => {
                el.addEventListener(event, handler);
            });
            return this;
        }

        trigger(event) {
            this.elements.forEach((el) => {
                el.dispatchEvent(new Event(event, { bubbles: true }));
            });
            return this;
        }
    }

    return (selector, context) => {
        const root = context || document;
        const elements = Array.from(root.querySelectorAll(selector));
        return new JQueryLite(elements);
    };
};

describe('MenuStructureBehaviour', () => {
    let behaviour;
    let mockStructureEngine;
    let nodeMap;

    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="main">
                <div id="menu_nav">
                    <div id="nav_list">
                        <div class="nav-element toggle-on" nav-id="node-1" page-id="page-1" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            <div class="nav-element-text">
                                <span class="node-text-span">Node 1</span>
                                <button class="node-menu-button" data-menunavid="node-1"></button>
                                <button class="node-add-button" data-parentnavid="node-1"></button>
                            </div>
                        </div>
                        <div class="nav-element toggle-on" nav-id="root" page-id="root" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            <div class="nav-element-text">
                                <span class="node-text-span">Root</span>
                                <button class="node-add-button" data-parentnavid="root"></button>
                            </div>
                        </div>
                    </div>
                    <div id="nav_actions">
                        <button class="button_nav_action action_add"></button>
                        <button class="button_nav_action action_properties"></button>
                        <button class="button_nav_action action_delete"></button>
                        <button class="button_nav_action action_clone"></button>
                        <button class="button_nav_action action_import_idevices"></button>
                        <button class="button_nav_action action_check_broken_links"></button>
                    </div>
                    <div class="buttons_action_container_right">
                        <button class="button_nav_action action_move_prev"></button>
                        <button class="button_nav_action action_move_next"></button>
                        <button class="button_nav_action action_move_up"></button>
                        <button class="button_nav_action action_move_down"></button>
                    </div>
                </div>
            </div>
            <div id="node-content-container"></div>
            <div id="idevices-bottom"></div>
            <div id="node-content"></div>
            <div id="properties-node-content-form" style="display:none"></div>
            <div id="list_menu_idevices">
                <div id="text"><div class="idevice_icon" style="background-image:url('test.png')"></div></div>
            </div>
        `;

        global.$ = buildJqueryStub();
        global.confirm = vi.fn(() => true);

        nodeMap = {
            'node-1': { id: 'node-1', pageId: 'page-1', pageName: 'Node 1', open: true, showModalProperties: vi.fn() },
            root: { id: 'root', pageId: 'root', pageName: 'Root', open: true, showModalProperties: vi.fn() },
        };

        mockStructureEngine = {
            menuStructureBehaviour: null,
            data: { 'node-1': { parent: 'root' }, root: { parent: null } },
            getNode: vi.fn((id) => nodeMap[id]),
            createNodeAndReload: vi.fn(),
            renameNodeAndReload: vi.fn(),
            cloneNodeAndReload: vi.fn(),
            removeNodeCompleteAndReload: vi.fn(),
            moveNodePrev: vi.fn(),
            moveNodeNext: vi.fn(),
            moveNodeUp: vi.fn(),
            moveNodeDown: vi.fn(),
            moveNodeToNode: vi.fn(),
            resetDataAndStructureData: vi.fn(),
        };

        const docManager = {
            setSelectedPage: vi.fn(),
            getOtherUsersOnPageAndDescendants: vi.fn(() => ({ allAffectedUsers: [] })),
        };

        global.eXeLearning = {
            app: {
                common: {
                    initTooltips: vi.fn(),
                },
                api: {
                    getOdePageBrokenLinks: vi.fn().mockResolvedValue({ responseMessage: null }),
                },
                project: {
                    checkOpenIdevice: vi.fn(() => false),
                    unlockIdevices: vi.fn(),
                    openLoad: vi.fn(),
                    idevices: {
                        loadApiIdevicesInPage: vi.fn().mockResolvedValue(true),
                        draggedElement: null,
                    },
                    bridge: {
                        onPageNavigation: vi.fn(),
                    },
                    _yjsEnabled: true,
                    _yjsBridge: {
                        getDocumentManager: vi.fn(() => docManager),
                        structureBinding: {
                            canMoveUp: vi.fn(() => true),
                            canMoveDown: vi.fn(() => false),
                            canMoveLeft: vi.fn(() => true),
                            canMoveRight: vi.fn(() => false),
                        },
                    },
                },
                modals: {
                    alert: { show: vi.fn() },
                    confirm: {
                        show: vi.fn(),
                        confirm: vi.fn(),
                        modalElement: document.createElement('div'),
                        modalElementBody: document.createElement('div'),
                    },
                    odebrokenlinks: { show: vi.fn() },
                    openuserodefiles: { largeFilesUpload: vi.fn() },
                },
            },
        };

        behaviour = new MenuStructureBehaviour(mockStructureEngine);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete global.$;
    });

    describe('behaviour', () => {
        it('wires buttons and events on first call', () => {
            const spy = vi.spyOn(behaviour, 'addEventNavNewNodeOnclick');
            behaviour.behaviour(true);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('addNavTestIds', () => {
        it('adds data-testid and data-node-id attributes to nav elements', () => {
            behaviour.addNavTestIds();

            const navElements = document.querySelectorAll('.nav-element[nav-id]');
            expect(navElements.length).toBe(2);

            const firstNode = navElements[0];
            expect(firstNode.getAttribute('data-testid')).toBe('nav-node');
            expect(firstNode.getAttribute('data-node-id')).toBe('node-1');

            const textBtn = firstNode.querySelector('.nav-element-text');
            expect(textBtn.getAttribute('data-testid')).toBe('nav-node-text');
            expect(textBtn.getAttribute('data-node-id')).toBe('node-1');

            const menuBtn = firstNode.querySelector('.node-menu-button');
            expect(menuBtn.getAttribute('data-testid')).toBe('nav-node-menu');
            expect(menuBtn.getAttribute('data-node-id')).toBe('node-1');

            const toggle = firstNode.querySelector('.exe-icon');
            expect(toggle.getAttribute('data-testid')).toBe('nav-node-toggle');
            expect(toggle.getAttribute('data-node-id')).toBe('node-1');
        });
    });

    describe('addEventNavElementOnAddIconClick', () => {
        it('calls showModalNewNode with null for root and id for non-root', () => {
            const spy = vi.spyOn(behaviour, 'showModalNewNode').mockImplementation(() => {});

            behaviour.addEventNavElementOnAddIconClick();

            const rootAddButton = document.querySelector(
                '.nav-element[nav-id="root"] .node-add-button'
            );
            const nodeAddButton = document.querySelector(
                '.nav-element[nav-id="node-1"] .node-add-button'
            );

            rootAddButton.click();
            nodeAddButton.click();

            expect(spy).toHaveBeenCalledWith(null);
            expect(spy).toHaveBeenCalledWith('node-1');
        });
    });

    describe('addEventNavElementIconOnclick', () => {
        it('toggles classes, icon text, and node state on click', () => {
            behaviour.addEventNavElementIconOnclick();

            const navElement = document.querySelector('.nav-element[nav-id="node-1"]');
            const icon = navElement.querySelector('.exe-icon');

            icon.click();
            expect(navElement.classList.contains('toggle-off')).toBe(true);
            expect(navElement.classList.contains('toggle-on')).toBe(false);
            expect(icon.innerHTML).toBe('keyboard_arrow_right');
            expect(mockStructureEngine.getNode('node-1').open).toBe(false);
            expect(navElement.getAttribute('data-expanded')).toBe('false');
            expect(navElement.getAttribute('aria-expanded')).toBe('false');

            icon.click();
            expect(navElement.classList.contains('toggle-on')).toBe(true);
            expect(navElement.classList.contains('toggle-off')).toBe(false);
            expect(icon.innerHTML).toBe('keyboard_arrow_down');
            expect(mockStructureEngine.getNode('node-1').open).toBe(true);
            expect(navElement.getAttribute('data-expanded')).toBe('true');
            expect(navElement.getAttribute('aria-expanded')).toBe('true');
        });
    });

    describe('addEventNavElementOnMenuIconClic', () => {
        it('opens properties modal for the selected node', () => {
            const mutationSpy = vi
                .spyOn(behaviour, 'mutationForModalProperties')
                .mockImplementation(() => {});

            behaviour.addEventNavElementOnMenuIconClic();

            const menuButton = document.querySelector('.node-menu-button');
            menuButton.click();

            const node = mockStructureEngine.getNode('node-1');
            expect(node.showModalProperties).toHaveBeenCalled();
            expect(mutationSpy).toHaveBeenCalled();
        });
    });

    describe('addEventNavElementOnDbclick', () => {
        it('sets dbclickNode when a nav element is double-clicked', () => {
            behaviour.addEventNavElementOnDbclick();

            const label = document.querySelector(
                '.nav-element[nav-id="node-1"] > .nav-element-text'
            );
            label.dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true, cancelable: true })
            );

            expect(behaviour.dbclickNode).toBe(true);
        });
    });

    describe('addEventNavElementOnclick', () => {
        it('selects node and triggers properties on dblclick flag', async () => {
            behaviour.dbclickNode = true;
            const propSpy = vi.spyOn(behaviour, 'showModalPropertiesNode').mockImplementation(() => {});
            const selectSpy = vi.spyOn(behaviour, 'selectNode').mockResolvedValue(
                document.querySelector('.nav-element[nav-id="node-1"]')
            );

            behaviour.addEventNavElementOnclick();
            const label = document.querySelector('.nav-element[nav-id="node-1"] > .nav-element-text');
            label.click();

            await Promise.resolve();
            expect(selectSpy).toHaveBeenCalled();
            expect(propSpy).toHaveBeenCalled();
            expect(behaviour.dbclickNode).toBe(false);
        });
    });

    describe('nav action buttons', () => {
        it('creates new page at root from add button', () => {
            const spy = vi.spyOn(behaviour, 'showModalNewNode').mockImplementation(() => {});
            behaviour.addEventNavNewNodeOnclick();
            document.querySelector('.button_nav_action.action_add').click();
            expect(spy).toHaveBeenCalledWith(null);
        });

        it('opens properties for selected node', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            const spy = vi.spyOn(behaviour, 'showModalPropertiesNode').mockImplementation(() => {});
            behaviour.addEventNavPropertiesNodeOnclick();
            document.querySelector('.button_nav_action.action_properties').click();
            expect(spy).toHaveBeenCalled();
        });

        it('opens delete modal for selected node', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            const spy = vi.spyOn(behaviour, 'showModalRemoveNode').mockImplementation(() => {});
            behaviour.addEventNavRemoveNodeOnclick();
            document.querySelector('.button_nav_action.action_delete').click();
            expect(spy).toHaveBeenCalled();
        });

        it('clones node and opens rename modal', async () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            const renameSpy = vi.spyOn(behaviour, 'showModalRenameNode').mockImplementation(() => {});
            behaviour.addEventNavCloneNodeOnclick();
            document.querySelector('.button_nav_action.action_clone').click();
            await Promise.resolve();
            expect(mockStructureEngine.cloneNodeAndReload).toHaveBeenCalledWith('node-1');
            expect(renameSpy).toHaveBeenCalled();
        });
    });

    describe('createIdevicesUploadInput', () => {
        it('imports project file via Yjs bridge', async () => {
            const importFile = new File(['x'], 'sample.elpx', { type: 'application/zip' });
            const bridge = {
                documentManager: true,
                initialized: true,
                importFromElpx: vi.fn().mockResolvedValue({}),
            };
            window.YjsModules = { getBridge: vi.fn(() => bridge) };

            const input = behaviour.createIdevicesUploadInput();
            Object.defineProperty(input, 'files', {
                value: [importFile],
                configurable: true,
            });

            await input.dispatchEvent(new Event('change'));
            expect(bridge.importFromElpx).toHaveBeenCalled();
            expect(mockStructureEngine.resetDataAndStructureData).toHaveBeenCalled();
        });

        it('falls back to largeFilesUpload for non-project files', async () => {
            const importFile = new File(['x'], 'sample.idevice', { type: 'application/octet-stream' });
            const input = behaviour.createIdevicesUploadInput();
            Object.defineProperty(input, 'files', {
                value: [importFile],
                configurable: true,
            });

            await input.dispatchEvent(new Event('change'));
            expect(eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(
                importFile,
                true
            );
        });
    });

    describe('addEventNavImportIdevicesOnclick', () => {
        it('clicks file input when node selected', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            behaviour.addEventNavImportIdevicesOnclick();
            const input = document.querySelector('input.local-ode-file-upload-input');
            const clickSpy = vi.spyOn(input, 'click');
            document.querySelector('.button_nav_action.action_import_idevices').click();
            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('broken links', () => {
        it('calls API and opens modal with results', async () => {
            behaviour.addEventNavCheckOdePageBrokenLinksOnclick();
            const innerMain = document.createElement('div');
            innerMain.id = 'main';
            innerMain.innerHTML = '<div class="toggle-on"><div class="selected" page-id="page-1"></div></div>';
            behaviour.menuNav.appendChild(innerMain);
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            document.querySelector('.button_nav_action.action_check_broken_links').click();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(eXeLearning.app.api.getOdePageBrokenLinks).toHaveBeenCalled();
            expect(eXeLearning.app.modals.odebrokenlinks.show).toHaveBeenCalled();
        });
    });

    describe('showModalNewNode', () => {
        it('uses default title when input is empty', () => {
            const confirm = eXeLearning.app.modals.confirm;
            confirm.show.mockImplementation(({ confirmExec, behaviour: behaviourFn }) => {
                confirm.modalElement.innerHTML = '<input id="input-new-node" value="">';
                confirm.modalElementBody.innerHTML = '<input value="">';
                behaviourFn();
                confirmExec();
            });
            behaviour.showModalNewNode(null);
            expect(mockStructureEngine.createNodeAndReload).toHaveBeenCalledWith(null, 'New page');
        });
    });

    describe('showModalRenameNode', () => {
        it('renames node with new title', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            const confirm = eXeLearning.app.modals.confirm;
            confirm.show.mockImplementation(({ confirmExec, behaviour: behaviourFn }) => {
                confirm.modalElement.innerHTML = '<input id="input-rename-node" value="New title">';
                confirm.modalElementBody.innerHTML = '<input value="New title">';
                behaviourFn();
                confirmExec();
            });
            behaviour.showModalRenameNode();
            expect(mockStructureEngine.renameNodeAndReload).toHaveBeenCalledWith('node-1', 'New title');
        });
    });

    describe('mutationForModalProperties', () => {
        it('syncs title input when editableInPage is toggled', async () => {
            behaviour.mutationForModalProperties();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'property-value';
            checkbox.setAttribute('property', 'editableInPage');

            const input = document.createElement('input');
            input.className = 'property-value';
            input.setAttribute('property', 'titlePage');

            const titleInput = document.createElement('input');
            titleInput.className = 'property-value';
            titleInput.setAttribute('property', 'titleNode');
            titleInput.value = 'Node title';

            const wrapper = document.createElement('div');
            wrapper.id = 'titlePage';

            document.body.append(checkbox, input, titleInput, wrapper);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(wrapper.style.display).toBe('none');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            expect(wrapper.style.display).toBe('block');
        });
    });

    describe('showModalRemoveNode', () => {
        it('shows warning for affected users', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            vi.spyOn(behaviour, '_getAffectedUsersForDeletion').mockReturnValue([{ name: 'Alice' }]);
            vi.spyOn(behaviour, '_nodeHasDescendants').mockReturnValue(true);
            behaviour.showModalRemoveNode();
            const args = eXeLearning.app.modals.confirm.show.mock.calls[0][0];
            expect(args.body).toContain('Alice');
            args.confirmExec();
            expect(mockStructureEngine.removeNodeCompleteAndReload).toHaveBeenCalledWith('node-1');
        });
    });

    describe('_getAffectedUsersForDeletion', () => {
        it('returns empty when yjs disabled', () => {
            eXeLearning.app.project._yjsEnabled = false;
            expect(behaviour._getAffectedUsersForDeletion('page-1')).toEqual([]);
        });
    });

    describe('_nodeHasDescendants', () => {
        it('detects children from structure data', () => {
            expect(behaviour._nodeHasDescendants('root')).toBe(true);
            expect(behaviour._nodeHasDescendants('node-1')).toBe(false);
        });
    });

    describe('drag and drop', () => {
        it('adds drag-over class when dragging node', async () => {
            behaviour.addDragAndDropFunctionalityToNavElements();
            const nodeText = document.querySelector('.nav-element[nav-id="node-1"] > .nav-element-text');
            behaviour.nodeDrag = document.querySelector('.nav-element[nav-id="root"]');
            nodeText.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
            expect(nodeText.classList.contains('drag-over')).toBe(true);
        });

        it('moves node on dragend', () => {
            behaviour.addDragAndDropFunctionalityToNavElements();
            const nodeText = document.querySelector('.nav-element[nav-id="node-1"] > .nav-element-text');
            behaviour.nodeDrag = document.querySelector('.nav-element[nav-id="node-1"]');
            nodeText.classList.add('drag-over');
            nodeText.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
            expect(mockStructureEngine.moveNodeToNode).toHaveBeenCalled();
        });
    });

    describe('selectNode', () => {
        it('selects current node and updates UI', async () => {
            const element = document.querySelector('.nav-element[nav-id="node-1"]');
            const select = await behaviour.selectNode(element);
            expect(select).toBe(element);
            expect(behaviour.nodeSelected).toBe(element);
            expect(document.querySelector('#node-content-container').classList.contains('properties-page')).toBe(false);
        });

        it('returns null when element is missing', async () => {
            const select = await behaviour.selectNode(null);
            expect(select).toBeNull();
        });
    });

    describe('setNodeSelected and awareness', () => {
        it('sets node selection attributes and updates awareness', () => {
            const element = document.querySelector('.nav-element[nav-id="node-1"]');
            behaviour.setNodeSelected(element);
            expect(element.getAttribute('data-selected')).toBe('true');
            const docManager = eXeLearning.app.project._yjsBridge.getDocumentManager();
            expect(docManager.setSelectedPage).toHaveBeenCalledWith('page-1');
        });
    });

    describe('setNodeIdToNodeContentElement', () => {
        it('sets node-selected when node exists', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            behaviour.setNodeIdToNodeContentElement();
            expect(document.querySelector('#node-content').getAttribute('node-selected')).toBe('page-1');
        });
    });

    describe('createAddTextBtn', () => {
        it('creates quick add button and triggers idevice click', () => {
            const clickSpy = vi.fn();
            document.querySelector('#list_menu_idevices #text').addEventListener('click', clickSpy);
            behaviour.createAddTextBtn();
            const btn = document.querySelector('#eXeAddContentBtnWrapper button');
            btn.click();
            expect(clickSpy).toHaveBeenCalled();
            expect(document.querySelector('#eXeAddContentBtnWrapper')).toBeNull();
        });
    });

    describe('enabledActionButtons', () => {
        it('enables buttons based on structure binding', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="node-1"]');
            behaviour.enabledActionButtons();
            expect(document.querySelector('.button_nav_action.action_add').disabled).toBe(false);
            expect(document.querySelector('.button_nav_action.action_move_next').disabled).toBe(true);
        });

        it('enables only add for root', () => {
            behaviour.nodeSelected = document.querySelector('.nav-element[nav-id="root"]');
            behaviour.enabledActionButtons();
            expect(document.querySelector('.button_nav_action.action_add').disabled).toBe(false);
            expect(document.querySelector('.button_nav_action.action_delete').disabled).toBe(true);
        });
    });

    describe('disableActionButtons', () => {
        it('disables all action buttons', () => {
            behaviour.disableActionButtons();
            const buttons = document.querySelectorAll('#nav_actions .button_nav_action');
            buttons.forEach((btn) => expect(btn.disabled).toBe(true));
        });
    });

    describe('clearMenuNavDragOverClasses', () => {
        it('removes drag-over classes', () => {
            const nodeText = document.querySelector('.nav-element[nav-id="node-1"] > .nav-element-text');
            nodeText.classList.add('drag-over', 'idevice-content-over');
            behaviour.clearMenuNavDragOverClasses();
            expect(nodeText.classList.contains('drag-over')).toBe(false);
            expect(nodeText.classList.contains('idevice-content-over')).toBe(false);
        });
    });

    describe('focusTextInput', () => {
        it('focuses and preserves value', () => {
            const input = document.createElement('input');
            input.value = 'Hello';
            const focusSpy = vi.spyOn(input, 'focus');
            behaviour.focusTextInput(input);
            expect(focusSpy).toHaveBeenCalled();
            expect(input.value).toBe('Hello');
        });
    });
});
