// @vitest-environment happy-dom
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

        // Updated DOM to match new Context Menu structure
        document.body.innerHTML = `
            <div id="main">
                <div id="menu_nav">
                    <div id="nav_list">
                        <div class="nav-element toggle-on" nav-id="node-1" page-id="page-1" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            
                            <!-- Trigger Container (Now a DIV with .dropdown) -->
                            <div class="nav-element-text dropdown">
                                <span class="node-text-span">Node 1</span>
                                
                                <!-- Trigger Button -->
                                <button class="node-menu-button page-settings-trigger" 
                                        data-menunavid="node-1" 
                                        data-bs-toggle="dropdown">
                                </button>
                                
                                <!-- Dropdown Menu -->
                                <ul class="dropdown-menu">
                                    <li><button class="dropdown-item page-add" data-parentnavid="node-1">Add Subpage</button></li>
                                    <li><button class="dropdown-item action_clone" data-nav-id="node-1">Clone</button></li>
                                    <li><button class="dropdown-item action_delete" data-nav-id="node-1">Delete</button></li>
                                    <li><button class="dropdown-item page-settings" data-menunavid="node-1">Properties</button></li>
                                    <li><button class="dropdown-item action_import_idevices" data-nav-id="node-1">Import</button></li>
                                </ul>

                                <!-- Standalone Add Button (Inside textElement) -->
                                <button class="node-add-button" data-parentnavid="node-1"></button>
                            </div>
                        </div>

                        <!-- Root Node -->
                        <div class="nav-element toggle-on" nav-id="root" page-id="root" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            <div class="nav-element-text dropdown">
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

        // Bootstrap mock (Attach to window for module access)
        window.bootstrap = {
            Dropdown: class {
                static getOrCreateInstance() { return new this(); }
                static getInstance() { return new this(); }
                toggle() {}
                hide() {}
            }
        };
        // Also ensure global for good measure
        global.bootstrap = window.bootstrap;

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
            cloneNodeAndReload: vi.fn().mockResolvedValue(),
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
        // Manually trigger the delegation setup which is usually done in behaviour()
        behaviour.addEventNavElementOnMenuIconClic(); 
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete global.$;
        delete global.bootstrap;
        delete window.bootstrap;
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

            const textBtn = firstNode.querySelector('.nav-element-text');
            expect(textBtn.getAttribute('data-testid')).toBe('nav-node-text');

            const menuBtn = firstNode.querySelector('.node-menu-button');
            expect(menuBtn.getAttribute('data-testid')).toBe('nav-node-menu');
        });
    });

    describe('addEventNavElementOnMenuIconClic (Context Menu Delegation)', () => {
        it('opens properties from context menu item', () => {
            console.log('DEBUG TEST: Test Start');
            const mutationSpy = vi.spyOn(behaviour, 'mutationForModalProperties').mockImplementation(() => {});
            
            // Find properties item in dropdown
            const propItem = document.querySelector('.dropdown-item.page-settings');
            console.log('DEBUG TEST: Prop Item:', propItem ? 'Found' : 'Not Found');
            
            if (propItem) {
                propItem.click();
                console.log('DEBUG TEST: Click Triggered');
            }

            const node = mockStructureEngine.getNode('node-1');
            console.log('DEBUG TEST: Node retrieved:', node);
            
            expect(node.showModalProperties).toHaveBeenCalled();
            console.log('DEBUG TEST: Expectation Passed');
            expect(mutationSpy).toHaveBeenCalled();
        });

        it('triggers clone from context menu item', async () => {
             const renameSpy = vi.spyOn(behaviour, 'showModalRenameNode').mockImplementation(() => {});
             const cloneItem = document.querySelector('.dropdown-item.action_clone');
             cloneItem.click();
             
             await Promise.resolve();
             expect(mockStructureEngine.cloneNodeAndReload).toHaveBeenCalledWith('node-1');
             expect(renameSpy).toHaveBeenCalled();
        });

        it('triggers delete from context menu item', () => {
             const deleteSpy = vi.spyOn(behaviour, 'showModalRemoveNode').mockImplementation(() => {});
             const deleteItem = document.querySelector('.dropdown-item.action_delete');
             deleteItem.click();
             expect(deleteSpy).toHaveBeenCalledWith('node-1');
        });
        
        it('triggers add subpage from context menu item', () => {
             const addSpy = vi.spyOn(behaviour, 'showModalNewNode').mockImplementation(() => {});
             const addItem = document.querySelector('.dropdown-item.page-add');
             addItem.click();
             expect(addSpy).toHaveBeenCalledWith('node-1');
        });
    });

    describe('addEventNavElementOnAddIconClick', () => {
        it('calls showModalNewNode when clicking standalone add button', () => {
            const spy = vi.spyOn(behaviour, 'showModalNewNode').mockImplementation(() => {});

            behaviour.addEventNavElementOnAddIconClick();

            const rootAddButton = document.querySelector('.nav-element[nav-id="root"] .node-add-button');
            console.log('DEBUG TEST: Root Add Button:', rootAddButton);
            
            if (rootAddButton) {
                rootAddButton.click();
            } else {
                 throw new Error('Root Add Button not found in DOM');
            }

            expect(spy).toHaveBeenCalledWith(null);
        });
    });

    describe('addEventNavElementOnclick', () => {
        it('selects node when clicking text', async () => {
            const selectSpy = vi.spyOn(behaviour, 'selectNode').mockResolvedValue(
                document.querySelector('.nav-element[nav-id="node-1"]')
            );

            behaviour.addEventNavElementOnclick();
            const label = document.querySelector('.nav-element[nav-id="node-1"] > .nav-element-text');
            label.click();

            await Promise.resolve();
            expect(selectSpy).toHaveBeenCalled();
        });

        it('does NOT select node when clicking a dropdown item (propagation stopped)', async () => {
            const selectSpy = vi.spyOn(behaviour, 'selectNode');

            behaviour.addEventNavElementOnclick();
            
            // Click on a dropdown item inside the text element
            const propItem = document.querySelector('.dropdown-item.page-settings');
            
            // Create a bubbling event
            const event = new MouseEvent('click', { bubbles: true });
            propItem.dispatchEvent(event);

            await Promise.resolve();
            // Should NOT have called selectNode because the handler ignores .dropdown-item
            expect(selectSpy).not.toHaveBeenCalled();
        });
    });
    
    // ... Keeping rest of tests for non-modified features ...
    
    describe('addEventNavElementIconOnclick', () => {
         it('toggles classes, icon text, and node state on click', () => {
            behaviour.addEventNavElementIconOnclick();
            const navElement = document.querySelector('.nav-element[nav-id="node-1"]');
            const icon = navElement.querySelector('.exe-icon');
            icon.click();
            expect(navElement.classList.contains('toggle-off')).toBe(true);
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
    
    // ... existing tests definitions ...
    
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
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            expect(wrapper.style.display).toBe('block');
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
});
