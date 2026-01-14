/**
 * Tests for MenuStructureCompose class
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
        project: {
            _yjsEnabled: false,
            _yjsBridge: null,
        },
    },
};

// Mock eXe global (required by vitest.setup.js)
global.eXe = {
    app: {
        alert: vi.fn(),
        clearHistory: vi.fn(),
        _confirmResponses: new Map(),
    },
};

// Mock avatar utils before import
vi.mock('../../../utils/avatarUtils.js', () => ({
    getInitials: vi.fn((name) => (name ? name.substring(0, 2).toUpperCase() : 'UN')),
    generateGravatarUrl: vi.fn((email, size) => email ? `https://gravatar.com/${email}` : null),
}));

import MenuStructureCompose from './menuStructureCompose.js';

describe('MenuStructureCompose', () => {
    let menuStructureCompose;
    let mockStructureEngine;
    let mockMenuNav;
    let mockMenuNavList;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = `
            <div id="main">
                <div id="menu_nav">
                    <div id="nav_list"></div>
                </div>
            </div>
        `;

        mockMenuNav = document.querySelector('#main #menu_nav');
        mockMenuNavList = mockMenuNav.querySelector('#nav_list');

        // Mock structure engine
        mockStructureEngine = {
            data: {},
            menuStructureCompose: null,
            menuStructureBehaviour: null,
        };

        // Reset eXeLearning
        eXeLearning.app.project = {
            _yjsEnabled: false,
            _yjsBridge: null,
        };

        // Create instance
        menuStructureCompose = new MenuStructureCompose(mockStructureEngine);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with structureEngine', () => {
            expect(menuStructureCompose.structureEngine).toBe(mockStructureEngine);
        });

        it('should query menu nav element from DOM', () => {
            expect(menuStructureCompose.menuNav).toBe(mockMenuNav);
        });

        it('should query nav list element from DOM', () => {
            expect(menuStructureCompose.menuNavList).toBe(mockMenuNavList);
        });

        it('should add itself to structureEngine', () => {
            expect(mockStructureEngine.menuStructureCompose).toBe(menuStructureCompose);
        });

        it('should initialize levelItemCounters object', () => {
            expect(menuStructureCompose.levelItemCounters).toEqual({});
        });

        it('should initialize presence unsubscribe to null', () => {
            expect(menuStructureCompose._presenceUnsubscribe).toBeNull();
        });
    });

    describe('compose', () => {
        it('should clear nav list innerHTML', () => {
            mockMenuNavList.innerHTML = '<div>test</div>';
            mockStructureEngine.data = {};
            menuStructureCompose.compose();
            expect(mockMenuNavList.innerHTML).toBe('');
        });

        it('should use structureEngine data', () => {
            mockStructureEngine.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.compose();
            expect(menuStructureCompose.data).toBe(mockStructureEngine.data);
        });

        it('should reset levelItemCounters', () => {
            menuStructureCompose.levelItemCounters = { 0: 5 };
            mockStructureEngine.data = {};
            menuStructureCompose.compose();
            expect(menuStructureCompose.levelItemCounters).toEqual({});
        });

        it('should build tree for root nodes', () => {
            mockStructureEngine.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root Page',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.compose();
            const rootElement = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            expect(rootElement).not.toBeNull();
        });

        it('should track only child nodes', () => {
            mockStructureEngine.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
                child: {
                    id: 'child',
                    pageId: 'page-child',
                    pageName: 'Child',
                    parent: 'root',
                    order: 1,
                    open: false,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.compose();
            expect(menuStructureCompose.onlyChildMap['child']).toBe(true);
        });
    });

    describe('navElementsById', () => {
        it('should convert array to object by id', () => {
            const data = [
                { id: 'node1', name: 'Node 1' },
                { id: 'node2', name: 'Node 2' },
            ];
            const result = menuStructureCompose.navElementsById(data);
            expect(result).toEqual({
                node1: { id: 'node1', name: 'Node 1' },
                node2: { id: 'node2', name: 'Node 2' },
            });
        });

        it('should handle empty array', () => {
            const result = menuStructureCompose.navElementsById([]);
            expect(result).toEqual({});
        });
    });

    describe('makeNodeStructureContentNode', () => {
        let mockNode;
        let mockParent;

        beforeEach(() => {
            mockNode = {
                id: 'test-node',
                pageId: 'page-test',
                pageName: 'Test Page',
                parent: 'root',
                order: 1,
                open: false,
                icon: '<svg></svg>',
                properties: { visibility: { value: '' } },
            };
            mockParent = document.createElement('div');
        });

        it('should create div element with nav-element class', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element).not.toBeNull();
        });

        it('should add level class', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 2, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.classList.contains('level2')).toBe(true);
        });

        it('should add item class', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 3, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.classList.contains('item3')).toBe(true);
        });

        it('should add onlyitem class when isOnlyItem is true', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, true);
            const element = mockParent.querySelector('.nav-element');
            expect(element.classList.contains('onlyitem')).toBe(true);
        });

        it('should set nav-id attribute', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.getAttribute('nav-id')).toBe('test-node');
        });

        it('should set page-id attribute', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.getAttribute('page-id')).toBe('page-test');
        });

        it('should set data-testid attributes', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.getAttribute('data-node-id')).toBe('test-node');
            expect(element.getAttribute('data-selected')).toBe('false');
        });

        it('should add toggle-on class when node.open is true', () => {
            mockNode.open = true;
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.classList.contains('toggle-on')).toBe(true);
            expect(element.getAttribute('data-expanded')).toBe('true');
        });

        it('should add toggle-off class when node.open is false', () => {
            mockNode.open = false;
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.classList.contains('toggle-off')).toBe(true);
            expect(element.getAttribute('data-expanded')).toBe('false');
        });

        it('should contain icon element', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.querySelector('.nav-element-toggle')).not.toBeNull();
        });

        it('should contain text element', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.querySelector('.nav-element-text')).not.toBeNull();
        });

        it('should contain children container', () => {
            menuStructureCompose.makeNodeStructureContentNode(mockParent, mockNode, 0, 1, false);
            const element = mockParent.querySelector('.nav-element');
            expect(element.querySelector('.nav-element-children-container')).not.toBeNull();
        });
    });

    describe('makeNodeIconElement', () => {
        it('should create span element with exe-icon class', () => {
            const node = { open: false };
            const result = menuStructureCompose.makeNodeIconElement(node);
            expect(result.tagName).toBe('SPAN');
            expect(result.classList.contains('exe-icon')).toBe(true);
            expect(result.classList.contains('nav-element-toggle')).toBe(true);
        });

        it('should show arrow down when open', () => {
            const node = { open: true };
            const result = menuStructureCompose.makeNodeIconElement(node);
            expect(result.innerHTML).toBe('keyboard_arrow_down');
        });

        it('should show arrow right when closed', () => {
            const node = { open: false };
            const result = menuStructureCompose.makeNodeIconElement(node);
            expect(result.innerHTML).toBe('keyboard_arrow_right');
        });
    });

    describe('makeNodeRootIconElement', () => {
        it('should create span element with root-icon class', () => {
            const node = { icon: '<svg>root</svg>' };
            const result = menuStructureCompose.makeNodeRootIconElement(node);
            expect(result.tagName).toBe('SPAN');
            expect(result.classList.contains('root-icon')).toBe(true);
        });

        it('should set innerHTML to node icon', () => {
            const node = { icon: '<svg>root-icon</svg>' };
            const result = menuStructureCompose.makeNodeRootIconElement(node);
            expect(result.innerHTML).toBe('<svg>root-icon</svg>');
        });
    });

    describe('makeNodeTextElement', () => {
        let mockNode;

        beforeEach(() => {
            mockNode = {
                id: 'test-node',
                pageId: 'page-test',
                pageName: 'Test Page',
                icon: '<svg></svg>',
            };
        });

        it('should create div element with nav-element-text and dropdown classes', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            expect(result.tagName).toBe('DIV');
            expect(result.classList.contains('nav-element-text')).toBe(true);
            expect(result.classList.contains('dropdown')).toBe(true);
        });

        it('should set title attribute to pageName', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            expect(result.getAttribute('title')).toBe('Test Page');
        });

        it('should contain page icon', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const pageIcon = result.querySelector('.page-icon');
            expect(pageIcon).not.toBeNull();
        });

        it('should contain node text span with pageName', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const textSpan = result.querySelector('.node-text-span');
            expect(textSpan).not.toBeNull();
            expect(textSpan.innerText).toBe('Test Page');
        });

        it('should contain add button', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const addButton = result.querySelector('.page-add');
            expect(addButton).not.toBeNull();
            expect(addButton.getAttribute('data-parentnavid')).toBe('test-node');
        });

        it('should contain settings button for non-root nodes', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const settingsButton = result.querySelector('.page-settings');
            expect(settingsButton).not.toBeNull();
            expect(settingsButton.getAttribute('data-menunavid')).toBe('test-node');
        });

        it('should not contain settings button for root node', () => {
            mockNode.id = 'root';
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const settingsButton = result.querySelector('.page-settings');
            expect(settingsButton).toBeNull();
        });

        it('should contain root icon for root node', () => {
            mockNode.id = 'root';
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const rootIcon = result.querySelector('.root-icon');
            expect(rootIcon).not.toBeNull();
        });

        it('should set draggable for non-root nodes', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            expect(result.getAttribute('draggable')).toBe('true');
        });

        it('should not set draggable for root node', () => {
            mockNode.id = 'root';
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            expect(result.getAttribute('draggable')).toBeNull();
        });

        it('should contain drag over element', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const dragOver = result.querySelector('.drag-over-border');
            expect(dragOver).not.toBeNull();
        });

        it('should contain presence container', () => {
            const result = menuStructureCompose.makeNodeTextElement(mockNode);
            const presence = result.querySelector('.node-presence-avatars');
            expect(presence).not.toBeNull();
            expect(presence.dataset.pageId).toBe('page-test');
        });
    });

    describe('setPropertiesClassesToElement', () => {
        it('should set export-view attribute when visibility value exists', () => {
            const element = document.createElement('div');
            const node = { properties: { visibility: { value: 'hidden' } } };
            menuStructureCompose.setPropertiesClassesToElement(element, node);
            expect(element.getAttribute('export-view')).toBe('hidden');
        });

        it('should not set export-view attribute when visibility value is empty', () => {
            const element = document.createElement('div');
            const node = { properties: { visibility: { value: '' } } };
            menuStructureCompose.setPropertiesClassesToElement(element, node);
            expect(element.getAttribute('export-view')).toBeNull();
        });
    });

    describe('buildTreeRecursive', () => {
        beforeEach(() => {
            menuStructureCompose.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
                child1: {
                    id: 'child1',
                    pageId: 'page-child1',
                    pageName: 'Child 1',
                    parent: 'root',
                    order: 1,
                    open: false,
                    properties: { visibility: { value: '' } },
                },
                child2: {
                    id: 'child2',
                    pageId: 'page-child2',
                    pageName: 'Child 2',
                    parent: 'root',
                    order: 2,
                    open: false,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.levelItemCounters = {};
            menuStructureCompose.onlyChildMap = {};
        });

        it('should build root node', () => {
            menuStructureCompose.buildTreeRecursive(
                menuStructureCompose.data.root,
                mockMenuNavList,
                0
            );
            const rootElement = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            expect(rootElement).not.toBeNull();
        });

        it('should build child nodes', () => {
            menuStructureCompose.buildTreeRecursive(
                menuStructureCompose.data.root,
                mockMenuNavList,
                0
            );
            const rootElement = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            const childContainer = rootElement.querySelector('.nav-element-children-container');
            expect(childContainer.querySelectorAll('.nav-element').length).toBe(2);
        });

        it('should set is-parent attribute for nodes with children', () => {
            menuStructureCompose.buildTreeRecursive(
                menuStructureCompose.data.root,
                mockMenuNavList,
                0
            );
            const rootElement = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            expect(rootElement.getAttribute('is-parent')).toBe('true');
        });

        it('should increment level counters', () => {
            menuStructureCompose.buildTreeRecursive(
                menuStructureCompose.data.root,
                mockMenuNavList,
                0
            );
            expect(menuStructureCompose.levelItemCounters[0]).toBe(2);
            expect(menuStructureCompose.levelItemCounters[1]).toBe(3);
        });
    });

    describe('getNodeLevel', () => {
        beforeEach(() => {
            menuStructureCompose.data = {
                root: {
                    id: 'root',
                    parent: null,
                },
                child: {
                    id: 'child',
                    parent: 'root',
                },
                grandchild: {
                    id: 'grandchild',
                    parent: 'child',
                },
            };
        });

        it('should return 0 for root node', () => {
            const level = menuStructureCompose.getNodeLevel(menuStructureCompose.data.root);
            expect(level).toBe(0);
        });

        it('should return 1 for child node', () => {
            const level = menuStructureCompose.getNodeLevel(menuStructureCompose.data.child);
            expect(level).toBe(1);
        });

        it('should return 2 for grandchild node', () => {
            const level = menuStructureCompose.getNodeLevel(menuStructureCompose.data.grandchild);
            expect(level).toBe(2);
        });
    });

    describe('recalculateLevelsFromDomTree', () => {
        beforeEach(() => {
            mockMenuNavList.innerHTML = `
                <div class="nav-element" nav-id="root">
                    <div class="nav-element-children-container">
                        <div class="nav-element" nav-id="child1">
                            <div class="nav-element-children-container">
                                <div class="nav-element" nav-id="grandchild"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        it('should add level0 class to root nodes', () => {
            menuStructureCompose.recalculateLevelsFromDomTree();
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            expect(root.classList.contains('level0')).toBe(true);
        });

        it('should add level1 class to child nodes', () => {
            menuStructureCompose.recalculateLevelsFromDomTree();
            const child = mockMenuNavList.querySelector('.nav-element[nav-id="child1"]');
            expect(child.classList.contains('level1')).toBe(true);
        });

        it('should add level2 class to grandchild nodes', () => {
            menuStructureCompose.recalculateLevelsFromDomTree();
            const grandchild = mockMenuNavList.querySelector('.nav-element[nav-id="grandchild"]');
            expect(grandchild.classList.contains('level2')).toBe(true);
        });
    });

    describe('_updateNodePresence', () => {
        beforeEach(() => {
            mockMenuNavList.innerHTML = `
                <div class="node-presence-avatars" data-page-id="page1"></div>
                <div class="node-presence-avatars" data-page-id="page2"></div>
            `;
        });

        it('should hide containers when no users on page', () => {
            const users = [];
            menuStructureCompose._updateNodePresence(users);
            const containers = mockMenuNavList.querySelectorAll('.node-presence-avatars');
            containers.forEach(c => {
                expect(c.style.display).toBe('none');
            });
        });

        it('should show containers for pages with users', () => {
            const users = [
                { selectedPageId: 'page1', isLocal: false, name: 'User 1', email: 'user1@test.com' },
            ];
            menuStructureCompose._updateNodePresence(users);
            const container = mockMenuNavList.querySelector('[data-page-id="page1"]');
            expect(container.style.display).toBe('flex');
        });

        it('should not show local users', () => {
            const users = [
                { selectedPageId: 'page1', isLocal: true, name: 'Local User' },
            ];
            menuStructureCompose._updateNodePresence(users);
            const container = mockMenuNavList.querySelector('[data-page-id="page1"]');
            expect(container.style.display).toBe('none');
        });
    });

    describe('_renderNodePresence', () => {
        let mockContainer;

        beforeEach(() => {
            mockContainer = document.createElement('div');
            mockContainer.classList.add('node-presence-avatars');
        });

        it('should hide container when no users', () => {
            menuStructureCompose._renderNodePresence(mockContainer, []);
            expect(mockContainer.style.display).toBe('none');
            expect(mockContainer.innerHTML).toBe('');
        });

        it('should show container when users exist', () => {
            const users = [{ name: 'User 1', email: 'user1@test.com' }];
            menuStructureCompose._renderNodePresence(mockContainer, users);
            expect(mockContainer.style.display).toBe('flex');
        });

        it('should create avatar for each user', () => {
            const users = [
                { name: 'User 1', email: 'user1@test.com' },
                { name: 'User 2', email: 'user2@test.com' },
            ];
            menuStructureCompose._renderNodePresence(mockContainer, users);
            const avatars = mockContainer.querySelectorAll('.node-user-avatar');
            expect(avatars.length).toBe(2);
        });

        it('should limit to 3 avatars and show +N', () => {
            const users = [
                { name: 'User 1', email: 'user1@test.com' },
                { name: 'User 2', email: 'user2@test.com' },
                { name: 'User 3', email: 'user3@test.com' },
                { name: 'User 4', email: 'user4@test.com' },
                { name: 'User 5', email: 'user5@test.com' },
            ];
            menuStructureCompose._renderNodePresence(mockContainer, users);
            const avatars = mockContainer.querySelectorAll('.node-user-avatar');
            expect(avatars.length).toBe(4); // 3 users + 1 "+N"
            const more = mockContainer.querySelector('.node-user-more');
            expect(more.textContent).toBe('+2');
        });

        it('should set avatar title to email or name', () => {
            const users = [{ name: 'Test User', email: 'test@example.com' }];
            menuStructureCompose._renderNodePresence(mockContainer, users);
            const avatar = mockContainer.querySelector('.node-user-avatar');
            expect(avatar.title).toBe('test@example.com');
        });

        it('should apply user color as border', () => {
            const users = [{ name: 'User 1', color: '#ff0000' }];
            menuStructureCompose._renderNodePresence(mockContainer, users);
            const avatar = mockContainer.querySelector('.node-user-avatar');
            expect(avatar.style.borderColor).toBe('#ff0000');
        });
    });

    describe('_findNodeInPreviousData', () => {
        beforeEach(() => {
            menuStructureCompose.structureEngine = {
                data: {
                    node1: { id: 'node1', pageId: 'page1', parent: 'root' },
                    node2: { id: 'node2', pageId: 'page2', parent: 'node1' },
                },
            };
        });

        it('should find node by pageId', () => {
            const previousPageIds = new Set(['page1', 'page2']);
            const result = menuStructureCompose._findNodeInPreviousData('page1', previousPageIds);
            expect(result).toEqual({ id: 'node1', pageId: 'page1', parent: 'root' });
        });

        it('should return null for non-existent pageId', () => {
            const previousPageIds = new Set(['page1', 'page2']);
            const result = menuStructureCompose._findNodeInPreviousData('page999', previousPageIds);
            expect(result).toBeNull();
        });
    });

    describe('_updatePreviousPageIds', () => {
        it('should populate set with page IDs', () => {
            menuStructureCompose.structureEngine = {
                data: {
                    node1: { pageId: 'page1' },
                    node2: { pageId: 'page2' },
                },
            };
            const pageIdSet = new Set();
            menuStructureCompose._updatePreviousPageIds(pageIdSet);
            expect(pageIdSet.has('page1')).toBe(true);
            expect(pageIdSet.has('page2')).toBe(true);
        });

        it('should clear set before populating', () => {
            menuStructureCompose.structureEngine = {
                data: {
                    node1: { pageId: 'page1' },
                },
            };
            const pageIdSet = new Set(['old-page']);
            menuStructureCompose._updatePreviousPageIds(pageIdSet);
            expect(pageIdSet.has('old-page')).toBe(false);
        });
    });

    describe('initAccesibility', () => {
        beforeEach(() => {
            mockStructureEngine.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
                child: {
                    id: 'child',
                    pageId: 'page-child',
                    pageName: 'Child',
                    parent: 'root',
                    order: 1,
                    open: false,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.compose();
        });

        it('should set role=tree on nav_list', () => {
            expect(mockMenuNavList.getAttribute('role')).toBe('tree');
        });

        it('should set aria-label on tree', () => {
            expect(mockMenuNavList.getAttribute('aria-label')).toBe('Table of contents');
        });

        it('should set role=treeitem on nav elements', () => {
            const items = mockMenuNavList.querySelectorAll('.nav-element');
            items.forEach(item => {
                expect(item.getAttribute('role')).toBe('treeitem');
            });
        });

        it('should set role=group on children containers', () => {
            const groups = mockMenuNavList.querySelectorAll('.nav-element-children-container');
            groups.forEach(group => {
                expect(group.getAttribute('role')).toBe('group');
            });
        });

        it('should set tabindex on nav elements', () => {
            const items = mockMenuNavList.querySelectorAll('.nav-element');
            items.forEach(item => {
                expect(item.getAttribute('tabindex')).toBe('0');
            });
        });

        it('should set aria-expanded on parent nodes', () => {
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            expect(root.getAttribute('aria-expanded')).toBe('true');
        });

        it('should set aria-selected based on selected class', () => {
            const items = mockMenuNavList.querySelectorAll('.nav-element');
            items.forEach(item => {
                expect(item.getAttribute('aria-selected')).toBe('false');
            });
        });

        it('should set aria-hidden on icons', () => {
            const icons = mockMenuNavList.querySelectorAll('.nav-element-toggle, .page-icon');
            icons.forEach(icon => {
                expect(icon.getAttribute('aria-hidden')).toBe('true');
            });
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            mockStructureEngine.data = {
                root: {
                    id: 'root',
                    pageId: 'page-root',
                    pageName: 'Root',
                    parent: null,
                    order: 0,
                    open: true,
                    properties: { visibility: { value: '' } },
                },
                child: {
                    id: 'child',
                    pageId: 'page-child',
                    pageName: 'Child',
                    parent: 'root',
                    order: 1,
                    open: false,
                    properties: { visibility: { value: '' } },
                },
            };
            menuStructureCompose.compose();
        });

        it('should handle ArrowDown key', () => {
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            root.focus();
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            event.preventDefault = vi.fn();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle ArrowUp key', () => {
            const child = mockMenuNavList.querySelector('.nav-element[nav-id="child"]');
            child.focus();
            const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
            event.preventDefault = vi.fn();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle Home key', () => {
            const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
            event.preventDefault = vi.fn();
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            root.focus();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle End key', () => {
            const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
            event.preventDefault = vi.fn();
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            root.focus();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle Enter key', () => {
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            root.focus();
            const textElement = root.querySelector('.nav-element-text');
            textElement.click = vi.fn();
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            event.preventDefault = vi.fn();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle Space key', () => {
            const root = mockMenuNavList.querySelector('.nav-element[nav-id="root"]');
            root.focus();
            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
            event.preventDefault = vi.fn();
            mockMenuNavList.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });
});
