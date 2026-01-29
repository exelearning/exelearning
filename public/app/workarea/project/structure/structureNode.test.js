/**
 * StructureNode Tests
 *
 * Comprehensive unit tests for the StructureNode class, covering both
 * legacy API mode and collaborative Yjs mode operations.
 */

import StructureNode from './structureNode.js';

describe('StructureNode', () => {
    let mockStructure;
    let mockApi;
    let mockProject;
    let mockModals;
    let mockMenuStructureCompose;
    let nodeData;

    beforeEach(() => {
        // Mock structure object
        mockStructure = {
            data: [],
            movingNode: false,
            updateNodesStructure: mock(() => {}),
            renameNodeAndReload: mock(() => {}),
            reloadStructureMenu: mock(() => {}),
            resetStructureData: mock(() => {}),
            project: {
                idevices: {
                    loadApiIdevicesInPage: mock(() => {}),
                },
                odeVersion: 'v1',
                odeSession: 'session-123',
                _yjsEnabled: false,
                _yjsBridge: null,
                addPageViaYjs: null,
                clonePageViaYjs: null,
                renamePageViaYjs: null,
                deletePageViaYjs: null,
                movePageViaYjs: null,
            },
            menuStructureCompose: {
                menuNav: {
                    querySelector: mock(() => null),
                },
            },
        };

        mockMenuStructureCompose = mockStructure.menuStructureCompose;

        // Mock API
        mockApi = {
            putSavePage: mock(() => Promise.resolve({
                responseMessage: 'OK',
                odeNavStructureSyncId: 'node-1',
                odeNavStructureSync: {
                    id: 'node-1',
                    pageId: 'page-1',
                    pageName: 'Test Page',
                    parent: 'root',
                    order: 0,
                    odeNavStructureSyncProperties: {
                        titleNode: { value: 'Test Page', heritable: false },
                    },
                },
            })),
            postClonePage: mock(() => Promise.resolve({
                responseMessage: 'OK',
                odeNavStructureSync: {
                    id: 'node-2',
                    pageId: 'page-2',
                    pageName: 'Test Page Copy',
                    parent: 'root',
                    order: 1,
                },
            })),
            deletePage: mock(() => Promise.resolve({ responseMessage: 'OK' })),
            putReorderPage: mock(() => Promise.resolve({ responseMessage: 'OK' })),
            putSavePropertiesPage: mock(() => Promise.resolve({ responseMessage: 'OK' })),
            parameters: {
                odeNavStructureSyncPropertiesConfig: {
                    titleNode: { value: '', heritable: false },
                    author: { value: '', heritable: true },
                    description: { value: '', heritable: false },
                },
            },
        };

        mockProject = mockStructure.project;

        // Mock modals
        mockModals = {
            alert: {
                show: mock(() => {}),
            },
            properties: {
                show: mock(() => {}),
            },
        };

        // Setup global eXeLearning
        window.eXeLearning = {
            app: {
                api: mockApi,
                project: mockProject,
                modals: mockModals,
            },
        };

        // Setup node data
        nodeData = {
            id: 'node-1',
            pageId: 'page-1',
            pageName: 'Test Page',
            parent: 'root',
            order: 1, // Use non-zero value since 0 is falsy
            open: true,
            odeNavStructureSyncProperties: {
                titleNode: { value: 'Test Page', heritable: false },
                author: { value: 'Test Author', heritable: true },
                description: { value: 'Test Description', heritable: false },
            },
        };
    });

    afterEach(() => {
        // Reset mocks
        delete window.eXeLearning;
    });

    describe('Constructor', () => {
        it('initializes with structure and data', () => {
            const node = new StructureNode(mockStructure, nodeData);

            expect(node.structure).toBe(mockStructure);
            expect(node.id).toBe('node-1');
            expect(node.children).toEqual([]);
            expect(node.moving).toBe(false);
            expect(node.canHaveHeirs).toBe(true);
        });

        it('sets params from data', () => {
            const node = new StructureNode(mockStructure, nodeData);

            expect(node.pageId).toBe('page-1');
            expect(node.pageName).toBe('Test Page');
            expect(node.parent).toBe('root');
            expect(node.order).toBe(1);
            expect(node.open).toBe(true);
        });

        it('sets properties from data', () => {
            const node = new StructureNode(mockStructure, nodeData);

            expect(node.properties.titleNode.value).toBe('Test Page');
            expect(node.properties.author.value).toBe('Test Author');
            expect(node.properties.description.value).toBe('Test Description');
        });

        it('initializes with minimal data', () => {
            const minimalData = { id: 'node-minimal', order: 1 };
            const node = new StructureNode(mockStructure, minimalData);

            expect(node.id).toBe('node-minimal');
            expect(node.pageId).toBeNull();
            expect(node.order).toBe(1);
        });
    });

    describe('setParams', () => {
        it('sets all params from data', () => {
            const node = new StructureNode(mockStructure, { id: 'test' });

            node.setParams({
                pageId: 'page-2',
                pageName: 'New Page',
                parent: 'node-1',
                order: 5,
            });

            expect(node.pageId).toBe('page-2');
            expect(node.pageName).toBe('New Page');
            expect(node.parent).toBe('node-1');
            expect(node.order).toBe(5);
        });

        it('uses default values when data is missing', () => {
            const node = new StructureNode(mockStructure, { id: 'test', order: 1 });

            node.setParams({ pageId: 'page-1', order: 2 });

            expect(node.order).toBe(2);
            expect(node.parent).toBeNull();
        });

        it('sets properties if included in data', () => {
            const node = new StructureNode(mockStructure, { id: 'test', order: 1 });

            node.setParams({
                pageName: 'Test',
                odeNavStructureSyncProperties: {
                    titleNode: { value: 'Custom Title', heritable: false },
                },
            });

            // Note: setParams always overrides titleNode.value with pageName at the end
            expect(node.properties.titleNode.value).toBe('Test');
        });

        it('always sets titleNode from pageName', () => {
            const node = new StructureNode(mockStructure, { id: 'test', order: 1 });

            node.setParams({ pageName: 'Override Title' });

            expect(node.properties.titleNode.value).toBe('Override Title');
        });
    });

    describe('setProperties', () => {
        let node;

        beforeEach(() => {
            node = new StructureNode(mockStructure, nodeData);
        });

        it('sets all properties when onlyHeritable is false', () => {
            const newProps = {
                titleNode: { value: 'New Title', heritable: false },
                author: { value: 'New Author', heritable: true },
                description: { value: 'New Description', heritable: false },
            };

            node.setProperties(newProps, false);

            expect(node.properties.titleNode.value).toBe('New Title');
            expect(node.properties.author.value).toBe('New Author');
            expect(node.properties.description.value).toBe('New Description');
        });

        it('sets only heritable properties when onlyHeritable is true', () => {
            const originalTitle = node.properties.titleNode.value;
            const newProps = {
                titleNode: { value: 'New Title', heritable: false },
                author: { value: 'New Author', heritable: true },
                description: { value: 'New Description', heritable: false },
            };

            node.setProperties(newProps, true);

            expect(node.properties.titleNode.value).toBe(originalTitle); // unchanged
            expect(node.properties.author.value).toBe('New Author'); // changed
            expect(node.properties.description.value).not.toBe('New Description'); // unchanged
        });

        it('warns when property is missing', () => {
            const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

            node.setProperties({
                titleNode: { value: 'Test', heritable: false },
                // missing 'author' and 'description'
            }, false);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Missing property 'author'")
            );
        });
    });

    describe('isYjsEnabled', () => {
        it('returns false when Yjs is disabled', () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            expect(node.isYjsEnabled()).toBe(false);
        });

        it('returns true when Yjs is enabled', () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = true;

            expect(node.isYjsEnabled()).toBe(true);
        });

        it('returns false when project is undefined', () => {
            window.eXeLearning.app.project = undefined;
            const node = new StructureNode(mockStructure, nodeData);

            expect(node.isYjsEnabled()).toBe(false);
        });
    });

    describe('create (API mode)', () => {
        it('creates node via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'New Page',
                parent: 'root',
            });
            mockProject._yjsEnabled = false;

            const response = await node.create();

            expect(mockApi.putSavePage).toHaveBeenCalled();
            expect(response.responseMessage).toBe('OK');
            expect(node.id).toBe('node-1');
            expect(mockStructure.data).toContain(node);
        });

        it('updates structure data on successful creation', async () => {
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'New Page',
                parent: 'root',
            });

            await node.create();

            expect(mockStructure.data).toHaveLength(1);
            expect(mockStructure.data[0]).toBe(node);
        });

        it('updates order of pages when odeNavStructureSyncs is returned', async () => {
            mockApi.putSavePage.mockReturnValue(Promise.resolve({
                responseMessage: 'OK',
                odeNavStructureSyncId: 'node-1',
                odeNavStructureSync: {
                    id: 'node-1',
                    pageName: 'New Page',
                },
                odeNavStructureSyncs: [
                    { id: 'node-2', order: 1 },
                    { id: 'node-3', order: 2 },
                ],
            }));

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'New Page',
            });

            await node.create();

            expect(mockStructure.updateNodesStructure).toHaveBeenCalledWith(
                expect.any(Array),
                ['order']
            );
        });

        it('shows error modal on failure', async () => {
            mockApi.putSavePage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'New Page',
            });

            const result = await node.create();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalledWith({
                title: 'Structure node error',
                body: 'An error occurred while saving the node in database',
                contentId: 'error',
            });
        });
    });

    describe('createViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.addPageViaYjs = mock(() => ({
                id: 'yjs-node-1',
                title: 'Yjs Page',
                parentId: null,
                order: 0,
            }));
        });

        it('creates node via Yjs when enabled', async () => {
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Yjs Page',
                parent: 'root',
            });

            const response = await node.createViaYjs();

            expect(mockProject.addPageViaYjs).toHaveBeenCalledWith('Yjs Page', null);
            expect(response.responseMessage).toBe('OK');
            expect(node.id).toBe('yjs-node-1');
        });

        it('converts "root" parent to null for Yjs', async () => {
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Yjs Page',
                parent: 'root',
            });

            await node.createViaYjs();

            expect(mockProject.addPageViaYjs).toHaveBeenCalledWith('Yjs Page', null);
        });

        it('uses actual parent ID when not root', async () => {
            mockProject.addPageViaYjs = mock((title, parentId) => ({
                id: 'yjs-child-1',
                title,
                parentId,
                order: 0,
            }));

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Child Page',
                parent: 'parent-node-1',
            });

            await node.createViaYjs();

            expect(mockProject.addPageViaYjs).toHaveBeenCalledWith('Child Page', 'parent-node-1');
        });

        it('adds node to structure data', async () => {
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Yjs Page',
                parent: 'root',
            });

            await node.createViaYjs();

            expect(mockStructure.data).toContain(node);
        });

        it('shows error modal when Yjs creation fails', async () => {
            mockProject.addPageViaYjs = mock(() => null);

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Yjs Page',
            });

            const result = await node.createViaYjs();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalledWith({
                title: 'Structure node error',
                body: 'An error occurred while creating the page',
                contentId: 'error',
            });
        });

        it('handles exceptions during Yjs creation', async () => {
            mockProject.addPageViaYjs = mock(() => {
                throw new Error('Yjs error');
            });

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Yjs Page',
            });

            const result = await node.createViaYjs();

            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('clone (API mode)', () => {
        it('clones node via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            const response = await node.clone();

            expect(mockApi.postClonePage).toHaveBeenCalledWith({
                odeNavStructureSyncId: 'node-1',
            });
            expect(response.responseMessage).toBe('OK');
        });

        it('shows error modal on clone failure', async () => {
            mockApi.postClonePage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.clone();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalledWith({
                title: 'Structure node error',
                body: 'An error occurred while cloning the node in database',
                contentId: 'error',
            });
        });
    });

    describe('cloneViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.clonePageViaYjs = mock(() => ({
                id: 'yjs-clone-1',
                pageId: 'page-clone-1',
                pageName: 'Test Page Copy',
                parentId: 'root',
                order: 1,
            }));
        });

        it('clones node via Yjs', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            const response = await node.cloneViaYjs();

            expect(mockProject.clonePageViaYjs).toHaveBeenCalledWith('node-1');
            expect(response.responseMessage).toBe('OK');
            expect(response.odeNavStructureSync.id).toBe('yjs-clone-1');
        });

        it('shows error modal when clone fails', async () => {
            mockProject.clonePageViaYjs = mock(() => null);

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.cloneViaYjs();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('rename (API mode)', () => {
        it('renames node via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            const response = await node.rename('Renamed Page');

            expect(node.pageName).toBe('Renamed Page');
            expect(mockApi.putSavePage).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageName: 'Renamed Page',
                })
            );
            expect(response.responseMessage).toBe('OK');
        });

        it('updates titleNode property from response', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.rename('Renamed Page');

            expect(node.properties.titleNode.value).toBe('Test Page'); // from mock response
        });

        it('shows error modal on rename failure', async () => {
            mockApi.putSavePage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.rename('Failed Rename');

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('renameViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.renamePageViaYjs = mock(() => true);
        });

        it('renames node via Yjs', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            const response = await node.renameViaYjs('Yjs Renamed');

            expect(node.pageName).toBe('Yjs Renamed');
            expect(node.properties.titleNode.value).toBe('Yjs Renamed');
            expect(mockProject.renamePageViaYjs).toHaveBeenCalledWith('node-1', 'Yjs Renamed');
            expect(response.responseMessage).toBe('OK');
        });

        it('shows error modal when rename fails', async () => {
            mockProject.renamePageViaYjs = mock(() => false);

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.renameViaYjs('Failed Rename');

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });

        it('handles exceptions during rename', async () => {
            mockProject.renamePageViaYjs = mock(() => {
                throw new Error('Yjs rename error');
            });

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.renameViaYjs('Error Rename');

            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('remove (API mode)', () => {
        it('removes node via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockStructure.data = [node];
            mockProject._yjsEnabled = false;

            const response = await node.remove();

            expect(mockStructure.data).not.toContain(node);
            expect(mockApi.deletePage).toHaveBeenCalledWith('node-1');
            expect(response.responseMessage).toBe('OK');
        });

        it('filters node from structure data', async () => {
            const node1 = new StructureNode(mockStructure, { id: 'node-1' });
            const node2 = new StructureNode(mockStructure, { id: 'node-2' });
            mockStructure.data = [node1, node2];

            await node1.remove();

            expect(mockStructure.data).toHaveLength(1);
            expect(mockStructure.data[0]).toBe(node2);
        });

        it('shows error modal on delete failure', async () => {
            mockApi.deletePage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);
            mockStructure.data = [node];

            const result = await node.remove();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('removeViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.deletePageViaYjs = mock(() => true);
        });

        it('removes node via Yjs', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockStructure.data = [node];

            const response = await node.removeViaYjs();

            expect(mockProject.deletePageViaYjs).toHaveBeenCalledWith('node-1');
            expect(mockStructure.data).not.toContain(node);
            expect(response.responseMessage).toBe('OK');
        });

        it('removes descendants from structure', async () => {
            const parent = new StructureNode(mockStructure, { id: 'parent-1' });
            const child1 = new StructureNode(mockStructure, { id: 'child-1', parent: 'parent-1' });
            const child2 = new StructureNode(mockStructure, { id: 'child-2', parent: 'parent-1' });
            const grandchild = new StructureNode(mockStructure, { id: 'grandchild-1', parent: 'child-1' });
            const unrelated = new StructureNode(mockStructure, { id: 'unrelated-1', parent: 'root' });

            mockStructure.data = [parent, child1, child2, grandchild, unrelated];

            await parent.removeViaYjs();

            expect(mockStructure.data).toHaveLength(1);
            expect(mockStructure.data[0]).toBe(unrelated);
        });

        it('shows error modal when delete fails', async () => {
            mockProject.deletePageViaYjs = mock(() => false);

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.removeViaYjs();

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('_collectLocalDescendantIds', () => {
        it('collects direct children IDs', () => {
            const parent = new StructureNode(mockStructure, { id: 'parent' });
            const child1 = new StructureNode(mockStructure, { id: 'child-1', parent: 'parent' });
            const child2 = new StructureNode(mockStructure, { id: 'child-2', parent: 'parent' });

            mockStructure.data = [parent, child1, child2];

            const descendants = parent._collectLocalDescendantIds('parent');

            expect(descendants).toContain('child-1');
            expect(descendants).toContain('child-2');
            expect(descendants).toHaveLength(2);
        });

        it('collects nested descendants recursively', () => {
            const parent = new StructureNode(mockStructure, { id: 'parent' });
            const child = new StructureNode(mockStructure, { id: 'child', parent: 'parent' });
            const grandchild = new StructureNode(mockStructure, { id: 'grandchild', parent: 'child' });
            const greatGrandchild = new StructureNode(mockStructure, { id: 'great-grandchild', parent: 'grandchild' });

            mockStructure.data = [parent, child, grandchild, greatGrandchild];

            const descendants = parent._collectLocalDescendantIds('parent');

            expect(descendants).toContain('child');
            expect(descendants).toContain('grandchild');
            expect(descendants).toContain('great-grandchild');
            expect(descendants).toHaveLength(3);
        });

        it('returns empty array when no descendants', () => {
            const node = new StructureNode(mockStructure, { id: 'lonely' });
            mockStructure.data = [node];

            const descendants = node._collectLocalDescendantIds('lonely');

            expect(descendants).toEqual([]);
        });
    });

    describe('apiUpdateParent (API mode)', () => {
        it('updates parent via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiUpdateParent('new-parent', 3);

            expect(node.parent).toBe('new-parent');
            expect(node.order).toBe(3);
            expect(mockStructure.movingNode).toBe(true);
            expect(node.moving).toBe(true);
            expect(mockApi.putSavePage).toHaveBeenCalledWith(
                expect.objectContaining({
                    odeNavStructureSyncIdParent: 'new-parent',
                    order: 3,
                })
            );
        });

        it('updates parent without order when not provided', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiUpdateParent('new-parent');

            expect(node.parent).toBe('new-parent');
            expect(mockApi.putSavePage).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    order: expect.anything(),
                })
            );
        });

        it('shows error modal on update failure', async () => {
            mockApi.putSavePage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);

            await node.apiUpdateParent('new-parent');

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('updateParentViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.movePageViaYjs = mock(() => true);
        });

        it('updates parent via Yjs', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.updateParentViaYjs('new-parent', 2);

            expect(node.parent).toBe('new-parent');
            expect(node.order).toBe(2);
            expect(mockProject.movePageViaYjs).toHaveBeenCalledWith('node-1', 'new-parent', 2);
            expect(result).toBe(true);
        });

        it('updates moving state during operation', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.updateParentViaYjs('new-parent', 1);

            expect(mockStructure.movingNode).toBe(false); // reset after operation
            expect(node.moving).toBe(false);
        });

        it('rolls back on Yjs failure', async () => {
            mockProject.movePageViaYjs = mock(() => false);

            const node = new StructureNode(mockStructure, nodeData);
            const originalParent = node.parent;
            const originalOrder = node.order;

            const result = await node.updateParentViaYjs('new-parent', 5);

            expect(result).toBe(false);
            expect(node.parent).toBe(originalParent);
            expect(node.order).toBe(originalOrder);
            expect(mockStructure.reloadStructureMenu).toHaveBeenCalled();
        });

        it('rolls back on exception', async () => {
            mockProject.movePageViaYjs = mock(() => {
                throw new Error('Yjs move error');
            });

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, nodeData);
            const originalParent = node.parent;

            const result = await node.updateParentViaYjs('new-parent');

            expect(result).toBe(false);
            expect(node.parent).toBe(originalParent);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('handles undefined newOrder', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            const originalOrder = node.order;

            await node.updateParentViaYjs('new-parent', undefined);

            expect(node.order).toBe(originalOrder); // unchanged
        });

        it('handles null newOrder', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            const originalOrder = node.order;

            await node.updateParentViaYjs('new-parent', null);

            expect(node.order).toBe(originalOrder); // unchanged
        });
    });

    describe('apiUpdateOrder (API mode)', () => {
        it('updates order via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });
            mockProject._yjsEnabled = false;

            await node.apiUpdateOrder('+');

            expect(node.order).toBe(6);
            expect(mockApi.putReorderPage).toHaveBeenCalledWith(
                expect.objectContaining({ order: 6 })
            );
        });

        it('shows error modal on reorder failure', async () => {
            mockApi.putReorderPage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);

            await node.apiUpdateOrder('+');

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockModals.alert.show).toHaveBeenCalled();
        });

        it('handles promise rejection', async () => {
            mockApi.putReorderPage.mockReturnValue(Promise.reject(new Error('Network error')));

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, nodeData);

            await node.apiUpdateOrder('+');

            // Wait for promise to reject
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('updateOrderViaYjs', () => {
        beforeEach(() => {
            mockProject._yjsEnabled = true;
            mockProject.movePageViaYjs = mock(() => true);
        });

        it('updates order via Yjs', async () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 3 });

            const result = await node.updateOrderViaYjs('+');

            expect(node.order).toBe(4);
            expect(mockProject.movePageViaYjs).toHaveBeenCalledWith('node-1', 'root', 4);
            expect(result).toBe(true);
        });

        it('rolls back on Yjs failure', async () => {
            mockProject.movePageViaYjs = mock(() => false);

            const node = new StructureNode(mockStructure, { ...nodeData, order: 3 });

            const result = await node.updateOrderViaYjs('-');

            expect(result).toBe(false);
            expect(node.order).toBe(3); // rolled back
            expect(mockStructure.reloadStructureMenu).toHaveBeenCalled();
        });

        it('rolls back on exception', async () => {
            mockProject.movePageViaYjs = mock(() => {
                throw new Error('Yjs order error');
            });

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });

            const result = await node.updateOrderViaYjs(10);

            expect(result).toBe(false);
            expect(node.order).toBe(5); // rolled back
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('apiSaveProperties (API mode)', () => {
        it('updates local properties', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiSaveProperties({
                titleNode: 'Updated Title',
                author: 'Updated Author',
            }, false);

            expect(node.properties.titleNode.value).toBe('Updated Title');
            expect(node.properties.author.value).toBe('Updated Author');
        });

        it('saves properties via API when Yjs is disabled', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiSaveProperties({
                titleNode: 'New Title',
            }, false);

            expect(mockApi.putSavePropertiesPage).toHaveBeenCalledWith(
                expect.objectContaining({
                    odeNavStructureSyncId: 'node-1',
                    titleNode: 'New Title',
                })
            );
        });

        it('includes inherit flag when provided', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiSaveProperties({ author: 'Author' }, true);

            expect(mockApi.putSavePropertiesPage).toHaveBeenCalledWith(
                expect.objectContaining({
                    updateChildsProperties: 'true',
                })
            );
        });

        it('renames and reloads on successful save', async () => {
            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiSaveProperties({ titleNode: 'Renamed' }, false);

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockStructure.renameNodeAndReload).toHaveBeenCalledWith('node-1', 'Renamed');
            expect(mockProject.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
        });

        it('shows error modal on save failure', async () => {
            mockApi.putSavePropertiesPage.mockReturnValue(Promise.resolve({
                responseMessage: 'ERROR',
            }));

            const node = new StructureNode(mockStructure, nodeData);
            mockProject._yjsEnabled = false;

            await node.apiSaveProperties({ titleNode: 'Failed' }, false);

            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockModals.alert.show).toHaveBeenCalled();
        });
    });

    describe('savePropertiesViaYjs', () => {
        let mockYjsBridge;

        beforeEach(() => {
            mockYjsBridge = {
                structureBinding: {
                    updatePageProperties: mock(() => true),
                },
            };
            mockProject._yjsEnabled = true;
            mockProject._yjsBridge = mockYjsBridge;
        });

        it('saves properties via Yjs', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            const response = await node.savePropertiesViaYjs({
                titleNode: 'Yjs Title',
                author: 'Yjs Author',
            });

            expect(mockYjsBridge.structureBinding.updatePageProperties).toHaveBeenCalledWith(
                'node-1',
                { titleNode: 'Yjs Title', author: 'Yjs Author' }
            );
            expect(response.responseMessage).toBe('OK');
        });

        it('renames node and reloads when titleNode is updated', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.savePropertiesViaYjs({ titleNode: 'New Yjs Title' });

            expect(node.pageName).toBe('New Yjs Title');
            expect(mockStructure.renameNodeAndReload).toHaveBeenCalledWith('node-1', 'New Yjs Title');
            expect(mockProject.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
        });

        it('resets structure data when highlight is updated (not renameNodeAndReload)', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.savePropertiesViaYjs({ highlight: 'true' });

            expect(mockStructure.resetStructureData).toHaveBeenCalledWith('node-1');
            // renameNodeAndReload should NOT be called when only highlight changes
            expect(mockStructure.renameNodeAndReload).not.toHaveBeenCalled();
            expect(mockProject.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
        });

        it('does not reset structure data when non-visual properties are updated', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.savePropertiesViaYjs({ author: 'New Author' });

            expect(mockStructure.resetStructureData).not.toHaveBeenCalled();
            expect(mockProject.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
        });

        it('handles empty properties object and skips idevices reload', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            const response = await node.savePropertiesViaYjs({});

            expect(mockYjsBridge.structureBinding.updatePageProperties).toHaveBeenCalledWith('node-1', {});
            expect(mockStructure.resetStructureData).not.toHaveBeenCalled();
            // Empty properties should NOT trigger idevices reload
            expect(mockProject.idevices.loadApiIdevicesInPage).not.toHaveBeenCalled();
            expect(response.responseMessage).toBe('OK');
        });

        it('handles titleNode and highlight together - uses renameNodeAndReload', async () => {
            const node = new StructureNode(mockStructure, nodeData);

            await node.savePropertiesViaYjs({ titleNode: 'New Title', highlight: 'true' });

            expect(node.pageName).toBe('New Title');
            // When both titleNode and highlight change, renameNodeAndReload is called (not resetStructureData)
            expect(mockStructure.renameNodeAndReload).toHaveBeenCalledWith('node-1', 'New Title');
            // resetStructureData should NOT be called when titleNode is present (to avoid double reload)
            expect(mockStructure.resetStructureData).not.toHaveBeenCalled();
        });

        it('shows warning when bridge not available', async () => {
            mockProject._yjsBridge = null;

            const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.savePropertiesViaYjs({ titleNode: 'Test' });

            expect(result).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Yjs structure binding not available')
            );
        });

        it('shows error modal when Yjs save fails', async () => {
            mockYjsBridge.structureBinding.updatePageProperties = mock(() => false);

            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.savePropertiesViaYjs({ author: 'Failed' });

            expect(result).toBe(false);
            expect(mockModals.alert.show).toHaveBeenCalled();
        });

        it('handles exceptions during save', async () => {
            mockYjsBridge.structureBinding.updatePageProperties = mock(() => {
                throw new Error('Yjs save error');
            });

            const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const node = new StructureNode(mockStructure, nodeData);

            const result = await node.savePropertiesViaYjs({ author: 'Error' });

            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('loadPropertiesFromYjs', () => {
        let mockYjsBridge;

        beforeEach(() => {
            mockYjsBridge = {
                structureBinding: {
                    getPageProperties: mock(() => ({
                        titleNode: 'Yjs Loaded Title',
                        author: 'Yjs Loaded Author',
                        description: 'Yjs Loaded Description',
                    })),
                },
            };
            mockProject._yjsEnabled = true;
            mockProject._yjsBridge = mockYjsBridge;
        });

        it('loads properties from Yjs', () => {
            const node = new StructureNode(mockStructure, nodeData);

            node.loadPropertiesFromYjs();

            expect(node.properties.titleNode.value).toBe('Yjs Loaded Title');
            expect(node.properties.author.value).toBe('Yjs Loaded Author');
            expect(node.properties.description.value).toBe('Yjs Loaded Description');
        });

        it('converts boolean values to strings', () => {
            mockYjsBridge.structureBinding.getPageProperties = mock(() => ({
                titleNode: 'Title',
                author: true,
                description: false,
            }));

            const node = new StructureNode(mockStructure, nodeData);

            node.loadPropertiesFromYjs();

            expect(node.properties.author.value).toBe('true');
            expect(node.properties.description.value).toBe('false');
        });

        it('does nothing when Yjs is disabled', () => {
            mockProject._yjsEnabled = false;

            const node = new StructureNode(mockStructure, nodeData);
            const originalTitle = node.properties.titleNode.value;

            node.loadPropertiesFromYjs();

            expect(node.properties.titleNode.value).toBe(originalTitle);
        });

        it('does nothing when bridge not available', () => {
            mockProject._yjsBridge = null;

            const node = new StructureNode(mockStructure, nodeData);
            const originalTitle = node.properties.titleNode.value;

            node.loadPropertiesFromYjs();

            expect(node.properties.titleNode.value).toBe(originalTitle);
        });

        it('does nothing when getPageProperties returns null', () => {
            mockYjsBridge.structureBinding.getPageProperties = mock(() => null);

            const node = new StructureNode(mockStructure, nodeData);
            const originalTitle = node.properties.titleNode.value;

            node.loadPropertiesFromYjs();

            expect(node.properties.titleNode.value).toBe(originalTitle);
        });

        it('only updates existing properties', () => {
            mockYjsBridge.structureBinding.getPageProperties = mock(() => ({
                titleNode: 'New Title',
                nonExistentProp: 'Should be ignored',
            }));

            const node = new StructureNode(mockStructure, nodeData);

            node.loadPropertiesFromYjs();

            expect(node.properties.titleNode.value).toBe('New Title');
            expect(node.properties.nonExistentProp).toBeUndefined();
        });
    });

    describe('generateDataObject', () => {
        it('generates data object with specified params', () => {
            const node = new StructureNode(mockStructure, nodeData);

            const data = node.generateDataObject(['odeNavStructureSyncId', 'odePageId']);

            expect(data.odeNavStructureSyncId).toBe('node-1');
            expect(data.odePageId).toBe('page-1');
            expect(data.odeVersionId).toBeUndefined();
        });

        it('includes all base values', () => {
            const node = new StructureNode(mockStructure, nodeData);

            const data = node.generateDataObject([
                'odeNavStructureSyncId',
                'odePageId',
                'odeVersionId',
                'odeSessionId',
            ]);

            expect(data.odeNavStructureSyncId).toBe('node-1');
            expect(data.odePageId).toBe('page-1');
            expect(data.odeVersionId).toBe('v1');
            expect(data.odeSessionId).toBe('session-123');
        });
    });

    describe('getDictBaseValuesData', () => {
        it('returns base API values', () => {
            const node = new StructureNode(mockStructure, nodeData);

            const baseValues = node.getDictBaseValuesData();

            expect(baseValues.odeNavStructureSyncId).toBe('node-1');
            expect(baseValues.odePageId).toBe('page-1');
            expect(baseValues.odeVersionId).toBe('v1');
            expect(baseValues.odeSessionId).toBe('session-123');
        });

        it('returns null for missing id', () => {
            const node = new StructureNode(mockStructure, { id: null });

            const baseValues = node.getDictBaseValuesData();

            expect(baseValues.odeNavStructureSyncId).toBeNull();
        });
    });

    describe('updateOrderByParam', () => {
        it('increments order with "+"', () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });

            node.updateOrderByParam('+');

            expect(node.order).toBe(6);
        });

        it('decrements order with "-"', () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });

            node.updateOrderByParam('-');

            expect(node.order).toBe(4);
        });

        it('sets order to specific number', () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });

            node.updateOrderByParam(10);

            expect(node.order).toBe(10);
        });

        it('handles zero as new order', () => {
            const node = new StructureNode(mockStructure, { ...nodeData, order: 5 });

            node.updateOrderByParam(0);

            expect(node.order).toBe(0);
        });
    });

    describe('updateParam', () => {
        it('updates param value', () => {
            const node = new StructureNode(mockStructure, nodeData);

            node.updateParam('pageName', 'Updated Name');

            expect(node.pageName).toBe('Updated Name');
        });

        it('sets moving attribute on element when param is "moving"', () => {
            const mockElement = {
                setAttribute: mock(() => {}),
            };
            mockMenuStructureCompose.menuNav.querySelector = mock(() => mockElement);

            const node = new StructureNode(mockStructure, nodeData);

            node.updateParam('moving', true);

            expect(mockElement.setAttribute).toHaveBeenCalledWith('moving', true);
        });

        it('does not error when element not found for "moving"', () => {
            mockMenuStructureCompose.menuNav.querySelector = mock(() => null);

            const node = new StructureNode(mockStructure, nodeData);

            expect(() => {
                node.updateParam('moving', true);
            }).not.toThrow();
        });
    });

    describe('getElement', () => {
        it('queries DOM for element with nav-id', () => {
            const mockElement = { id: 'nav-element-1' };
            mockMenuStructureCompose.menuNav.querySelector = mock(() => mockElement);

            const node = new StructureNode(mockStructure, nodeData);

            const element = node.getElement();

            expect(mockMenuStructureCompose.menuNav.querySelector).toHaveBeenCalledWith(
                '.nav-element[nav-id="node-1"]'
            );
            expect(element).toBe(mockElement);
        });

        it('returns null when element not found', () => {
            mockMenuStructureCompose.menuNav.querySelector = mock(() => null);

            const node = new StructureNode(mockStructure, nodeData);

            const element = node.getElement();

            expect(element).toBeNull();
        });
    });

    describe('getPos', () => {
        it('returns position in structure data array', () => {
            const node1 = new StructureNode(mockStructure, { id: 'node-1' });
            const node2 = new StructureNode(mockStructure, { id: 'node-2' });
            const node3 = new StructureNode(mockStructure, { id: 'node-3' });

            mockStructure.data = [node1, node2, node3];

            expect(node1.getPos()).toBe(0);
            expect(node2.getPos()).toBe(1);
            expect(node3.getPos()).toBe(2);
        });

        it('returns false when node not found in structure', () => {
            const node = new StructureNode(mockStructure, { id: 'missing-node' });
            mockStructure.data = [];

            expect(node.getPos()).toBe(false);
        });
    });

    describe('showModalProperties', () => {
        it('loads properties from Yjs before showing modal', () => {
            const node = new StructureNode(mockStructure, nodeData);
            const loadPropertiesSpy = spyOn(node, 'loadPropertiesFromYjs').mockImplementation(() => {});

            node.showModalProperties();

            expect(loadPropertiesSpy).toHaveBeenCalled();
        });

        it('shows properties modal with node data', () => {
            const node = new StructureNode(mockStructure, nodeData);

            node.showModalProperties();

            expect(mockModals.properties.show).toHaveBeenCalledWith({
                node,
                title: 'Page properties',
                contentId: 'page-properties',
                properties: node.properties,
            });
        });
    });

    describe('Integration: create() routing', () => {
        it('uses Yjs when enabled and addPageViaYjs available', async () => {
            mockProject._yjsEnabled = true;
            mockProject.addPageViaYjs = mock(() => ({
                id: 'yjs-1',
                title: 'Yjs Page',
                parentId: null,
                order: 0,
            }));

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Test',
            });

            await node.create();

            expect(mockProject.addPageViaYjs).toHaveBeenCalled();
            expect(mockApi.putSavePage).not.toHaveBeenCalled();
        });

        it('falls back to API when Yjs disabled', async () => {
            mockProject._yjsEnabled = false;
            mockProject.addPageViaYjs = null;

            const node = new StructureNode(mockStructure, {
                id: null,
                pageName: 'Test',
                parent: 'root',
            });

            await node.create();

            expect(mockApi.putSavePage).toHaveBeenCalled();
        });
    });

    describe('Integration: clone() routing', () => {
        it('uses Yjs when enabled', async () => {
            mockProject._yjsEnabled = true;
            mockProject.clonePageViaYjs = mock(() => ({
                id: 'clone-1',
                pageId: 'page-clone-1',
                pageName: 'Clone',
                parentId: 'root',
                order: 1,
            }));

            const node = new StructureNode(mockStructure, nodeData);

            await node.clone();

            expect(mockProject.clonePageViaYjs).toHaveBeenCalled();
            expect(mockApi.postClonePage).not.toHaveBeenCalled();
        });
    });

    describe('Integration: rename() routing', () => {
        it('uses Yjs when enabled', async () => {
            mockProject._yjsEnabled = true;
            mockProject.renamePageViaYjs = mock(() => true);

            const node = new StructureNode(mockStructure, nodeData);

            await node.rename('New Name');

            expect(mockProject.renamePageViaYjs).toHaveBeenCalled();
            expect(mockApi.putSavePage).not.toHaveBeenCalled();
        });
    });

    describe('Integration: remove() routing', () => {
        it('uses Yjs when enabled', async () => {
            mockProject._yjsEnabled = true;
            mockProject.deletePageViaYjs = mock(() => true);

            const node = new StructureNode(mockStructure, nodeData);
            mockStructure.data = [node];

            await node.remove();

            expect(mockProject.deletePageViaYjs).toHaveBeenCalled();
            expect(mockApi.deletePage).not.toHaveBeenCalled();
        });
    });

    describe('Integration: apiUpdateParent() routing', () => {
        it('uses Yjs when enabled', async () => {
            mockProject._yjsEnabled = true;
            mockProject.movePageViaYjs = mock(() => true);

            const node = new StructureNode(mockStructure, nodeData);

            await node.apiUpdateParent('new-parent', 1);

            expect(mockProject.movePageViaYjs).toHaveBeenCalled();
            expect(mockApi.putSavePage).not.toHaveBeenCalled();
        });
    });

    describe('Integration: apiUpdateOrder() routing', () => {
        it('uses Yjs when enabled', async () => {
            mockProject._yjsEnabled = true;
            mockProject.movePageViaYjs = mock(() => true);

            const node = new StructureNode(mockStructure, nodeData);

            await node.apiUpdateOrder('+');

            expect(mockProject.movePageViaYjs).toHaveBeenCalled();
            expect(mockApi.putReorderPage).not.toHaveBeenCalled();
        });
    });

    describe('Integration: apiSaveProperties() routing', () => {
        it('uses Yjs when enabled', async () => {
            const mockYjsBridge = {
                structureBinding: {
                    updatePageProperties: mock(() => true),
                },
            };
            mockProject._yjsEnabled = true;
            mockProject._yjsBridge = mockYjsBridge;

            const node = new StructureNode(mockStructure, nodeData);

            await node.apiSaveProperties({ titleNode: 'Test' }, false);

            expect(mockYjsBridge.structureBinding.updatePageProperties).toHaveBeenCalled();
            expect(mockApi.putSavePropertiesPage).not.toHaveBeenCalled();
        });
    });
});
