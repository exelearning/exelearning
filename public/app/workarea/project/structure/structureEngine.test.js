/**
 * StructureEngine Tests
 *
 * Comprehensive unit tests for StructureEngine - manages project navigation structure.
 * Tests both Yjs collaborative mode and legacy API mode.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Setup global mocks BEFORE any other imports
global.window = global.window || {};
window.AppLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
global._ = vi.fn((text) => text);
global.eXeLearning = {
  app: {
    api: {
      getOdeStructure: vi.fn().mockResolvedValue({ structure: [] }),
      putSavePage: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      deletePage: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      parameters: {
        odeNavStructureSyncPropertiesConfig: {
          titleNode: { value: '' }
        }
      }
    },
    common: {
      generateId: vi.fn(() => `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    },
    modals: {
      alert: {
        show: vi.fn()
      }
    },
    project: {
      properties: {
        properties: {
          pp_title: { value: 'Test Document' }
        }
      },
      idevices: {
        loadApiIdevicesInPage: vi.fn()
      }
    }
  }
};

// Import the real module - StructureNode will now see window
import StructureEngine from './structureEngine.js';
import StructureNode from './structureNode.js';

describe('StructureEngine', () => {
  let engine;
  let mockProject;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="main">
        <div id="workarea">
          <div id="node-content"></div>
        </div>
      </div>
    `;

    // Reset mocks
    vi.clearAllMocks();

    // Create mock project
    mockProject = {
      odeVersion: '3.0',
      odeSession: 'test-session-123',
      app: window.eXeLearning.app,
      _yjsEnabled: false,
      _yjsBridge: null,
      _forceStructureImport: false
    };

    // Create engine instance
    engine = new StructureEngine(mockProject);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with project reference', () => {
      expect(engine.project).toBe(mockProject);
    });

    it('initializes data properties as null', () => {
      expect(engine.data).toBe(null);
      expect(engine.dataJson).toBe(null);
      expect(engine.dataGroupByParent).toBe(null);
    });

    it('initializes nodeSelected as null', () => {
      expect(engine.nodeSelected).toBe(null);
    });

    it('finds nodeContainer element in DOM', () => {
      expect(engine.nodeContainer).toBeDefined();
      expect(engine.nodeContainer.id).toBe('node-content');
    });

    it('initializes movingNode flag as false', () => {
      expect(engine.movingNode).toBe(false);
    });

    it('initializes _structureLoaded flag as false', () => {
      expect(engine._structureLoaded).toBe(false);
    });

    it('sets rootNodeData with correct defaults', () => {
      expect(engine.rootNodeData).toEqual({
        id: 'root',
        pageId: 'root',
        pageName: '',
        icon: 'edit_note',
        parent: null,
        order: 1
      });
    });
  });

  describe('isYjsEnabled', () => {
    it('returns false when project._yjsEnabled is not set', () => {
      expect(engine.isYjsEnabled()).toBe(false);
    });

    it('returns false when project._yjsEnabled is false', () => {
      engine.project._yjsEnabled = false;
      expect(engine.isYjsEnabled()).toBe(false);
    });

    it('returns true when project._yjsEnabled is true', () => {
      engine.project._yjsEnabled = true;
      expect(engine.isYjsEnabled()).toBe(true);
    });

    it('returns false when project is null', () => {
      engine.project = null;
      expect(engine.isYjsEnabled()).toBe(false);
    });
  });

  describe('loadData', () => {
    it('calls getOdeStructure and processStructureData', async () => {
      const mockStructure = [
        { id: 'page-1', pageId: 'page-1', pageName: 'Page 1', parent: 'root', order: 1 }
      ];

      vi.spyOn(engine, 'getOdeStructure').mockResolvedValue(mockStructure);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});

      await engine.loadData();

      expect(engine.getOdeStructure).toHaveBeenCalled();
      expect(engine.processStructureData).toHaveBeenCalledWith(mockStructure);
      expect(engine.dataJson).toEqual(mockStructure);
    });
  });

  describe('getOdeStructure', () => {
    it('fetches from API when Yjs is not enabled', async () => {
      const mockStructure = [{ id: 'page-1', pageName: 'Test' }];
      vi.spyOn(engine, 'fetchStructureFromApi').mockResolvedValue(mockStructure);

      const result = await engine.getOdeStructure();

      expect(engine.fetchStructureFromApi).toHaveBeenCalled();
      expect(result).toEqual(mockStructure);
    });

    it('returns Yjs data when Yjs is enabled and has data', async () => {
      engine.project._yjsEnabled = true;
      engine.project._yjsBridge = {
        documentManager: {
          getNavigation: () => [{ id: 'page-1' }]
        }
      };

      const mockYjsData = [{ id: 'page-1', pageName: 'From Yjs' }];
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue(mockYjsData);

      const result = await engine.getOdeStructure();

      expect(engine.getStructureFromYjs).toHaveBeenCalled();
      expect(result).toEqual(mockYjsData);
    });

    it('imports from API to Yjs when Yjs is empty', async () => {
      engine.project._yjsEnabled = true;
      engine.project._yjsBridge = {
        documentManager: {
          getNavigation: () => []
        },
        importStructure: vi.fn(),
        clearNavigation: vi.fn()
      };

      const mockApiData = [{ id: 'page-1', pageName: 'From API' }];
      const mockYjsData = [{ id: 'page-1', pageName: 'Imported' }];

      vi.spyOn(engine, 'fetchStructureFromApi').mockResolvedValue(mockApiData);
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue(mockYjsData);

      const result = await engine.getOdeStructure();

      expect(engine.fetchStructureFromApi).toHaveBeenCalled();
      expect(engine.project._yjsBridge.importStructure).toHaveBeenCalledWith(mockApiData);
      expect(result).toEqual(mockYjsData);
    });

    it('handles force import flag when Yjs enabled', async () => {
      engine.project._yjsEnabled = true;
      engine.project._forceStructureImport = true;
      engine.project._yjsBridge = {
        documentManager: {
          getNavigation: () => [{ id: 'existing' }]
        },
        clearNavigation: vi.fn(),
        importStructure: vi.fn()
      };

      const mockApiData = [{ id: 'page-1', pageName: 'Forced' }];
      const mockYjsData = [{ id: 'page-1', pageName: 'Imported' }];

      vi.spyOn(engine, 'fetchStructureFromApi').mockResolvedValue(mockApiData);
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue(mockYjsData);

      await engine.getOdeStructure();

      expect(engine.project._forceStructureImport).toBe(false);
      expect(engine.project._yjsBridge.clearNavigation).toHaveBeenCalled();
      expect(engine.fetchStructureFromApi).toHaveBeenCalled();
      expect(engine.project._yjsBridge.importStructure).toHaveBeenCalledWith(mockApiData);
    });
  });

  describe('fetchStructureFromApi', () => {
    it('calls api.getOdeStructure with session info', async () => {
      const mockResponse = {
        structure: [{ id: 'page-1', pageName: 'Test' }]
      };

      mockProject.app.api.getOdeStructure.mockResolvedValue(mockResponse);

      const result = await engine.fetchStructureFromApi();

      expect(mockProject.app.api.getOdeStructure).toHaveBeenCalledWith('3.0', 'test-session-123');
      expect(result).toEqual(mockResponse.structure);
    });

    it('returns empty array when structure is missing', async () => {
      mockProject.app.api.getOdeStructure.mockResolvedValue({});

      const result = await engine.fetchStructureFromApi();

      expect(result).toEqual([]);
    });
  });

  describe('getStructureFromYjs', () => {
    it('returns empty array when bridge not available', () => {
      engine.project._yjsBridge = null;

      const result = engine.getStructureFromYjs();

      expect(result).toEqual([]);
    });

    it('converts Yjs pages to API format', () => {
      const mockPages = [
        {
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
          parentId: null,
          order: 1,
          properties: {
            layout: 'standard'
          }
        }
      ];

      engine.project._yjsBridge = {
        structureBinding: {
          getPages: () => mockPages,
          getBlocks: () => [],
          getComponents: () => []
        }
      };

      const result = engine.getStructureFromYjs();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('page-1');
      expect(result[0].pageName).toBe('Test Page');
      expect(result[0].parent).toBe('root');
      expect(result[0].odeNavStructureSyncProperties).toEqual({
        layout: { value: 'standard' }
      });
    });

    it('handles invalid order values safely', () => {
      engine.project._yjsBridge = {
        structureBinding: {
          getPages: () => [
            { id: 'page-1', pageName: 'Test', order: NaN },
            { id: 'page-2', pageName: 'Test2', order: Infinity }
          ],
          getBlocks: () => [],
          getComponents: () => []
        }
      };

      const result = engine.getStructureFromYjs();

      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(0);
    });

    it('returns null for properties when properties is an array', () => {
      engine.project._yjsBridge = {
        structureBinding: {
          getPages: () => [
            {
              id: 'page-1',
              pageName: 'Test',
              parentId: null,
              order: 1,
              properties: ['not', 'an', 'object']
            }
          ],
          getBlocks: () => [],
          getComponents: () => []
        }
      };

      const result = engine.getStructureFromYjs();

      expect(result[0].odeNavStructureSyncProperties).toBeNull();
    });

    it('returns null for properties when properties is null', () => {
      engine.project._yjsBridge = {
        structureBinding: {
          getPages: () => [
            {
              id: 'page-1',
              pageName: 'Test',
              parentId: null,
              order: 1,
              properties: null
            }
          ],
          getBlocks: () => [],
          getComponents: () => []
        }
      };

      const result = engine.getStructureFromYjs();

      expect(result[0].odeNavStructureSyncProperties).toBeNull();
    });
  });

  describe('compareNodesSort', () => {
    it('sorts by order ascending', () => {
      expect(engine.compareNodesSort({ order: 5 }, { order: 10 })).toBe(-1);
      expect(engine.compareNodesSort({ order: 10 }, { order: 5 })).toBe(1);
      expect(engine.compareNodesSort({ order: 5 }, { order: 5 })).toBe(0);
    });

    it('handles missing order values', () => {
      expect(engine.compareNodesSort({}, { order: 5 })).toBe(-1);
      expect(engine.compareNodesSort({ order: 5 }, {})).toBe(1);
      expect(engine.compareNodesSort({}, {})).toBe(0);
    });

    it('handles invalid order values', () => {
      expect(engine.compareNodesSort({ order: NaN }, { order: 5 })).toBe(-1);
      // Infinity is treated as 0 by the safe comparison, so it's less than 5
      expect(engine.compareNodesSort({ order: Infinity }, { order: 5 })).toBe(-1);
    });
  });

  describe('addParentRootToData', () => {
    it('upgrades top-level nodes to root children', () => {
      const nodes = [
        { id: 'root', parent: null, children: [] },
        { id: 'page-a', parent: null, children: [] },
        { id: 'page-b', parent: 'page-a', children: [] }
      ];

      const result = engine.addParentRootToData(nodes);

      expect(result.find(n => n.id === 'page-a').parent).toBe('root');
      expect(result.find(n => n.id === 'root').parent).toBe(null);
      expect(result.find(n => n.id === 'page-b').parent).toBe('page-a');
    });
  });

  describe('groupDataByParent', () => {
    it('returns default structure for invalid input', () => {
      const grouped = engine.groupDataByParent(null);

      expect(grouped.null.children).toEqual([]);
      expect(grouped.root.children).toEqual([]);
    });

    it('groups nodes by parent ID', () => {
      const nodes = [
        { id: 'root', parent: null, children: [] },
        { id: 'page-1', parent: 'root', children: [], order: 1 },
        { id: 'page-2', parent: 'root', children: [], order: 2 }
      ];

      const grouped = engine.groupDataByParent(nodes);

      expect(grouped.root.children).toHaveLength(2);
      expect(grouped.root.children[0].id).toBe('page-1');
      expect(grouped.root.children[1].id).toBe('page-2');
    });

    it('sorts children by order', () => {
      const nodes = [
        { id: 'page-2', parent: 'root', children: [], order: 2 },
        { id: 'page-1', parent: 'root', children: [], order: 1 },
        { id: 'page-3', parent: 'root', children: [], order: 3 }
      ];

      const grouped = engine.groupDataByParent(nodes);

      expect(grouped.root.children.map(n => n.id)).toEqual(['page-1', 'page-2', 'page-3']);
    });

    it('skips invalid nodes', () => {
      const nodes = [
        { id: 'page-1', parent: 'root', children: [], order: 1 },
        null,
        { id: null, parent: 'root', children: [] },
        { id: 'page-2', parent: 'root', children: [], order: 2 }
      ];

      const grouped = engine.groupDataByParent(nodes);

      expect(grouped.root.children).toHaveLength(2);
    });
  });

  describe('orderStructureData', () => {
    it('orders nodes by hierarchy', () => {
      const nodes = [
        { id: 'root', parent: null, children: [], order: 0 },
        { id: 'page-2', parent: 'page-1', children: [], order: 1 },
        { id: 'page-1', parent: 'root', children: [], order: 1 }
      ];

      const ordered = engine.orderStructureData(JSON.parse(JSON.stringify(nodes)));

      expect(ordered.map(n => n.id)).toEqual(['root', 'page-1', 'page-2']);
    });

    it('sets index and deep properties', () => {
      const nodes = [
        { id: 'root', parent: null, children: [], order: 0 },
        { id: 'a', parent: 'root', children: [], order: 1 },
        { id: 'b', parent: 'a', children: [], order: 1 }
      ];

      const ordered = engine.orderStructureData(JSON.parse(JSON.stringify(nodes)));

      expect(ordered[1].index).toBe('1');
      expect(ordered[1].deep).toBe(0);
      expect(ordered[2].index).toBe('1.1');
      expect(ordered[2].deep).toBe(1);
    });
  });

  describe('addOpenParamToStructureData', () => {
    it('assigns open flags appropriately', () => {
      const nodes = [
        { id: 'with-children', children: [{ id: 'child' }], open: null },
        { id: 'leaf', children: [], open: false }
      ];

      const updated = engine.addOpenParamToStructureData(nodes);

      expect(updated.find(n => n.id === 'with-children').open).toBe(true);
      expect(updated.find(n => n.id === 'leaf').open).toBe(null);
    });

    it('preserves existing open state for parents', () => {
      const nodes = [
        { id: 'parent', children: [{}], open: false }
      ];

      const updated = engine.addOpenParamToStructureData(nodes);

      expect(updated[0].open).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty data array gracefully', () => {
      engine.data = [];

      expect(() => engine.getNode('any-id')).not.toThrow();
      expect(() => engine.getChildren('any-id')).not.toThrow();
      expect(() => engine.getDecendents('any-id')).not.toThrow();
    });

    it('handles null project gracefully', () => {
      engine.project = null;

      expect(engine.isYjsEnabled()).toBe(false);
    });

    it('handles missing DOM elements gracefully', () => {
      document.body.innerHTML = '';
      const newEngine = new StructureEngine(mockProject);

      expect(newEngine.nodeContainer).toBe(null);
    });
  });

  describe('generateNodeId', () => {
    it('calls app.common.generateId', () => {
      const id = engine.generateNodeId();

      expect(mockProject.app.common.generateId).toHaveBeenCalled();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });

  describe('getPosNode', () => {
    it('returns position of node in data array', () => {
      engine.data = [
        { id: 'root' },
        { id: 'page-1' },
        { id: 'page-2' }
      ];

      const pos = engine.getPosNode('page-1');
      expect(pos).toBe(1);
    });

    it('returns false for non-existent node', () => {
      engine.data = [{ id: 'root' }];

      const pos = engine.getPosNode('non-existent');
      expect(pos).toBe(false);
    });
  });

  describe('hasChildren', () => {
    beforeEach(() => {
      engine.data = [
        { id: 'root' },
        { id: 'page-1' }
      ];
    });

    it('returns true when node exists', () => {
      expect(engine.hasChildren('page-1')).toBe(true);
    });

    it('returns false when node does not exist', () => {
      expect(engine.hasChildren('non-existent')).toBe(false);
    });
  });

  describe('getYjsBinding', () => {
    it('returns structureBinding when available', () => {
      const mockBinding = { movePagePrev: vi.fn() };
      engine.project._yjsBridge = {
        structureBinding: mockBinding
      };

      expect(engine.getYjsBinding()).toBe(mockBinding);
    });

    it('returns null when bridge not available', () => {
      engine.project._yjsBridge = null;

      expect(engine.getYjsBinding()).toBe(null);
    });

    it('returns null when structureBinding not available', () => {
      engine.project._yjsBridge = {};

      expect(engine.getYjsBinding()).toBe(null);
    });
  });

  describe('setDataFromYjs', () => {
    it('uses passed data directly and reloads menu with selection', () => {
      const navElement = document.createElement('div');
      navElement.className = 'nav-element';
      navElement.setAttribute('nav-id', 'page-1');
      engine.menuStructureBehaviour = {
        nodeSelected: navElement
      };
      engine.menuStructureCompose = {
        compose: vi.fn()
      };

      // Data with complete properties (as syncStructureToLegacy now provides)
      const fullData = [{
        id: 'page-1',
        pageName: 'Page 1',
        odeNavStructureSyncProperties: { highlight: { value: true } }
      }];
      const processSpy = vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});
      const reloadSpy = vi.spyOn(engine, 'reloadStructureMenu').mockResolvedValue();

      // setDataFromYjs should use the passed data directly
      engine.setDataFromYjs(fullData);

      // Verify it used the passed data
      expect(engine.dataJson).toBe(fullData);
      expect(processSpy).toHaveBeenCalledWith(fullData);
      expect(reloadSpy).toHaveBeenCalledWith('page-1');
    });

    it('preserves highlighted class when data includes properties', () => {
      const navElement = document.createElement('div');
      navElement.className = 'nav-element';
      navElement.setAttribute('nav-id', 'page-1');
      engine.menuStructureBehaviour = {
        nodeSelected: navElement
      };
      engine.menuStructureCompose = {
        compose: vi.fn()
      };

      // Data with highlight property set to true
      const dataWithHighlight = [{
        id: 'page-1',
        pageName: 'Page 1',
        parent: 'root',
        order: 1,
        odeNavStructureSyncProperties: { highlight: { value: 'true' } }
      }];

      const processSpy = vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});
      const reloadSpy = vi.spyOn(engine, 'reloadStructureMenu').mockResolvedValue();

      engine.setDataFromYjs(dataWithHighlight);

      // Verify data includes the highlight property
      expect(engine.dataJson[0].odeNavStructureSyncProperties.highlight.value).toBe('true');
    });

    it('skips menu reload when menuStructureCompose is not available', () => {
      engine.menuStructureBehaviour = {
        nodeSelected: null
      };
      // Explicitly set menuStructureCompose to undefined
      engine.menuStructureCompose = undefined;

      const data = [{
        id: 'page-1',
        pageName: 'Page 1',
        parent: 'root',
        order: 1
      }];
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});
      const reloadSpy = vi.spyOn(engine, 'reloadStructureMenu');

      // Test that the code path goes to the else branch
      expect(engine.menuStructureCompose).toBeUndefined();

      engine.setDataFromYjs(data);

      // Check that processStructureData was called (confirming the test ran correctly)
      expect(engine.processStructureData).toHaveBeenCalledWith(data);

      // reloadStructureMenu should NOT be called when menuStructureCompose is missing
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateDataFromApi', () => {
    it('updates nodes and clears moving flag', async () => {
      const node = {
        id: 'page-1',
        updateParam: vi.fn()
      };
      engine.data = [node];
      vi.spyOn(engine, 'getOdeStructure').mockResolvedValue([
        { id: 'page-1', order: 2, parent: 'root' }
      ]);

      const result = await engine.updateDataFromApi();

      expect(node.updateParam).toHaveBeenCalledWith('order', 2);
      expect(node.updateParam).toHaveBeenCalledWith('parent', 'root');
      expect(engine.movingNode).toBe(false);
      expect(result).toBe(engine.data);
    });
  });

  describe('subscribeToYjsChanges', () => {
    it('loads initial data from Yjs when empty', () => {
      engine.project._yjsEnabled = true;
      engine.data = [];
      engine.menuStructureCompose = { compose: vi.fn() };
      engine.menuStructureBehaviour = {
        behaviour: vi.fn(),
        selectFirst: vi.fn()
      };
      engine.project._yjsBridge = {
        onStructureChange: vi.fn()
      };
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue([
        { id: 'page-1', pageName: 'Page 1', parent: 'root', order: 1, odePagStructureSyncs: [] }
      ]);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {
        engine.data = [{ id: 'page-1', parent: 'root', children: [] }];
      });

      engine.subscribeToYjsChanges();

      expect(engine.menuStructureCompose.compose).toHaveBeenCalled();
      expect(engine.menuStructureBehaviour.selectFirst).toHaveBeenCalled();
    });

    it('handles remote structure changes and reloads page content', async () => {
      engine.project._yjsEnabled = true;
      engine.project._yjsBridge = {
        onStructureChange: vi.fn(),
        getAffectedPageIdsForBlockStructureChanges: vi.fn(() => new Set(['page-1']))
      };
      engine.menuStructureCompose = { compose: vi.fn() };
      engine.menuStructureBehaviour = {
        behaviour: vi.fn(),
        selectFirst: vi.fn(),
        menuNav: document.querySelector('#main'),
        nodeSelected: (() => {
          const el = document.createElement('div');
          el.className = 'nav-element';
          el.setAttribute('nav-id', 'page-1');
          return el;
        })()
      };
      document.querySelector('#main').appendChild(engine.menuStructureBehaviour.nodeSelected);
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue([
        { id: 'page-1', pageName: 'Page 1', parent: 'root', order: 1, odePagStructureSyncs: [] }
      ]);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {
        engine.data = [{ id: 'page-1', parent: 'root', children: [] }];
      });
      const selectSpy = vi.spyOn(engine, 'selectNode').mockResolvedValue();

      engine.subscribeToYjsChanges();
      const callback = engine.project._yjsBridge.onStructureChange.mock.calls[0][0];
      await callback([], { local: false });

      expect(selectSpy).toHaveBeenCalledWith('page-1');
      expect(engine.menuStructureCompose.compose).toHaveBeenCalled();
      expect(mockProject.app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalled();
    });

    it('does not reload page content for remote changes handled incrementally', async () => {
      engine.project._yjsEnabled = true;
      engine.project._yjsBridge = {
        onStructureChange: vi.fn(),
        getAffectedPageIdsForBlockStructureChanges: vi.fn(() => new Set())
      };
      engine.menuStructureCompose = { compose: vi.fn() };
      engine.menuStructureBehaviour = {
        behaviour: vi.fn(),
        selectFirst: vi.fn(),
        menuNav: document.querySelector('#main'),
        nodeSelected: (() => {
          const el = document.createElement('div');
          el.className = 'nav-element';
          el.setAttribute('nav-id', 'page-1');
          return el;
        })()
      };
      document.querySelector('#main').appendChild(engine.menuStructureBehaviour.nodeSelected);
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue([
        { id: 'page-1', pageName: 'Page 1', parent: 'root', order: 1, odePagStructureSyncs: [] }
      ]);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {
        engine.data = [{ id: 'page-1', parent: 'root', children: [] }];
      });
      const selectSpy = vi.spyOn(engine, 'selectNode').mockResolvedValue();

      engine.subscribeToYjsChanges();
      const callback = engine.project._yjsBridge.onStructureChange.mock.calls[0][0];
      await callback(
        [
          {
            path: [0, 'blocks', 0, 'components'],
            changes: {
              added: { size: 1 },
              deleted: { size: 0 },
            },
          },
        ],
        { local: false },
      );

      expect(selectSpy).toHaveBeenCalledWith('page-1');
      expect(engine.menuStructureCompose.compose).toHaveBeenCalled();
      expect(mockProject.app.project.idevices.loadApiIdevicesInPage).not.toHaveBeenCalled();
    });
  });

  describe('resetStructureData', () => {
    it('reloads from Yjs when enabled', async () => {
      engine.project._yjsEnabled = true;
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue([]);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});
      vi.spyOn(engine, 'openNode').mockImplementation(() => {});
      vi.spyOn(engine, 'reloadStructureMenu').mockResolvedValue();

      await engine.resetStructureData('page-1');

      expect(engine.getStructureFromYjs).toHaveBeenCalled();
      expect(engine.reloadStructureMenu).toHaveBeenCalledWith('page-1');
    });

    it('reloads from API when Yjs disabled', async () => {
      engine.project._yjsEnabled = false;
      vi.spyOn(engine, 'updateDataFromApi').mockResolvedValue([
        { id: 'root', children: [] }
      ]);
      vi.spyOn(engine, 'openNode').mockImplementation(() => {});
      vi.spyOn(engine, 'reloadStructureMenu').mockResolvedValue();

      await engine.resetStructureData('page-1');

      expect(engine.updateDataFromApi).toHaveBeenCalled();
      expect(engine.reloadStructureMenu).toHaveBeenCalledWith('page-1');
    });
  });

  describe('resetDataAndStructureData', () => {
    it('reloads from Yjs when enabled', async () => {
      engine.project._yjsEnabled = true;
      vi.spyOn(engine, 'getStructureFromYjs').mockReturnValue([]);
      vi.spyOn(engine, 'processStructureData').mockImplementation(() => {});
      vi.spyOn(engine, 'openNode').mockImplementation(() => {});
      vi.spyOn(engine, 'reloadStructureMenu').mockResolvedValue();

      await engine.resetDataAndStructureData('page-1');

      expect(engine.getStructureFromYjs).toHaveBeenCalled();
      expect(engine.reloadStructureMenu).toHaveBeenCalledWith('page-1');
    });
  });

  describe('reloadStructureMenu', () => {
    it('selects specific node when id is provided', async () => {
      engine.menuStructureCompose = { compose: vi.fn() };
      engine.menuStructureBehaviour = { behaviour: vi.fn(), selectFirst: vi.fn() };
      const selectSpy = vi.spyOn(engine, 'selectNode').mockResolvedValue();

      await engine.reloadStructureMenu('page-1');

      expect(selectSpy).toHaveBeenCalledWith('page-1');
    });

    it('selects first node when no id provided', async () => {
      engine.menuStructureCompose = { compose: vi.fn() };
      engine.menuStructureBehaviour = { behaviour: vi.fn(), selectFirst: vi.fn() };
      const firstSpy = vi.spyOn(engine, 'selectFirst').mockResolvedValue();

      await engine.reloadStructureMenu(null);

      expect(firstSpy).toHaveBeenCalled();
    });
  });

  describe('processStructureData', () => {
    it('adds root node and orders structure', () => {
      const data = [
        { id: 'page-1', pageId: 'page-1', pageName: 'Page 1', parent: 'root', order: 1, odePagStructureSyncs: [] },
        { id: 'page-2', pageId: 'page-2', pageName: 'Page 2', parent: 'page-1', order: 1, odePagStructureSyncs: [] }
      ];

      engine.processStructureData(data);

      const root = engine.data.find((node) => node.id === 'root');
      const page1 = engine.data.find((node) => node.id === 'page-1');
      expect(root.pageName).toBe('Test Document');
      expect(page1.open).toBe(true);
    });
  });

  describe('setTitleToNodeRoot', () => {
    it('updates root node text in DOM', () => {
      engine.data = [{ id: 'root', pageName: '', children: [] }];
      engine.menuNav = document.querySelector('#main');
      const rootEl = document.createElement('div');
      rootEl.className = 'nav-element';
      rootEl.setAttribute('nav-id', 'root');
      rootEl.innerHTML = '<span class="node-text"></span>';
      engine.menuNav.appendChild(rootEl);

      engine.setTitleToNodeRoot();

      expect(rootEl.querySelector('.node-text').textContent).toBe('Test Document');
    });
  });

  describe('movement methods', () => {
    it('moves node using binding and resets structure', () => {
      engine.project._yjsBridge = {
        structureBinding: {
          movePagePrev: vi.fn(() => true),
          movePageNext: vi.fn(() => true),
          movePageLeft: vi.fn(() => true),
          movePageRight: vi.fn(() => true),
          movePageToTarget: vi.fn(() => true)
        }
      };
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();

      engine.moveNodePrev('a');
      engine.moveNodeNext('a');
      engine.moveNodeUp('a');
      engine.moveNodeDown('a');
      engine.moveNodeToNode('a', 'b');

      expect(resetSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('createNodeAndReload', () => {
    it('resets structure on successful create', async () => {
      vi.spyOn(engine, 'createNode').mockResolvedValue({
        responseMessage: 'OK',
        odeNavStructureSyncId: 'page-1'
      });
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();

      engine.createNodeAndReload('root', 'Title');
      await Promise.resolve();

      expect(resetSpy).toHaveBeenCalledWith('page-1');
    });
  });

  describe('createNode', () => {
    it('creates a StructureNode and calls create', async () => {
      const createSpy = vi.spyOn(StructureNode.prototype, 'create').mockResolvedValue({ responseMessage: 'OK' });
      const result = await engine.createNode('root', 'Title');
      expect(createSpy).toHaveBeenCalled();
      expect(result.responseMessage).toBe('OK');
      createSpy.mockRestore();
    });
  });

  describe('cloneNodeAndReload', () => {
    it('clones node and reloads structure', async () => {
      vi.spyOn(engine, 'cloneNode').mockResolvedValue({ id: 'clone-1' });
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();

      await engine.cloneNodeAndReload('page-1');

      expect(resetSpy).toHaveBeenCalledWith('clone-1');
    });
  });

  describe('cloneNode', () => {
    it('clones node and adds to data', async () => {
      const node = {
        clone: vi.fn().mockResolvedValue({
          odeNavStructureSync: { id: 'clone-1', pageId: 'clone-1', pageName: 'Clone', parent: 'root' }
        })
      };
      engine.data = [];
      vi.spyOn(engine, 'getNode').mockReturnValue(node);

      const clone = await engine.cloneNode('page-1');

      expect(clone.id).toBe('clone-1');
      expect(engine.data).toHaveLength(1);
    });
  });

  describe('cloneNodeNav', () => {
    it('adds cloned node to data', async () => {
      engine.data = [];
      const clone = await engine.cloneNodeNav({ id: 'clone-2', pageId: 'clone-2', pageName: 'Clone', parent: 'root' });
      expect(clone.id).toBe('clone-2');
      expect(engine.data).toHaveLength(1);
    });
  });

  describe('updateNodesStructure', () => {
    it('updates params on existing nodes', () => {
      const node = { id: 'page-1', updateParam: vi.fn() };
      engine.data = [node];
      engine.updateNodesStructure({ a: { id: 'page-1', order: 2 } }, ['order']);
      expect(node.updateParam).toHaveBeenCalledWith('order', 2);
    });
  });

  describe('renameNodeAndReload', () => {
    it('renames node and resets structure', () => {
      const renameSpy = vi.spyOn(engine, 'renameNode').mockImplementation(() => {});
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();
      engine.renameNodeAndReload('page-1', 'New');
      expect(renameSpy).toHaveBeenCalledWith('page-1', 'New');
      expect(resetSpy).toHaveBeenCalledWith('page-1');
    });
  });

  describe('removeNodeCompleteAndReload', () => {
    it('ignores empty id', () => {
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();
      engine.removeNodeCompleteAndReload(null);
      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('removes node when possible and reloads', () => {
      const node = { remove: vi.fn() };
      vi.spyOn(engine, 'getNode').mockReturnValue(node);
      const removeSpy = vi.spyOn(engine, 'removeNode').mockReturnValue(true);
      const resetSpy = vi.spyOn(engine, 'resetStructureData').mockResolvedValue();
      engine.removeNodeCompleteAndReload('page-1');
      expect(removeSpy).toHaveBeenCalledWith('page-1');
      expect(resetSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('removeNode', () => {
    it('returns false when node missing', () => {
      vi.spyOn(engine, 'getNode').mockReturnValue(null);
      expect(engine.removeNode('missing')).toBe(false);
    });
  });

  describe('removeChildren', () => {
    it('removes nodes by parent id', () => {
      engine.data = [
        { id: 'a', parent: 'root' },
        { id: 'b', parent: 'a' }
      ];
      engine.removeChildren('a');
      expect(engine.data).toHaveLength(1);
    });
  });

  describe('removeDecendents', () => {
    it('removes descendant nodes', () => {
      const removeSpy = vi.spyOn(engine, 'removeNodes').mockImplementation(() => {});
      vi.spyOn(engine, 'getDecendents').mockReturnValue([{ id: 'a' }]);
      engine.removeDecendents('root');
      expect(removeSpy).toHaveBeenCalledWith(['a']);
    });
  });

  describe('cleanOrphans', () => {
    it('removes nodes whose parent is missing', () => {
      engine.data = [
        { id: 'root', parent: null },
        { id: 'orphan', parent: 'missing' }
      ];
      const removeSpy = vi.spyOn(engine, 'removeNode').mockImplementation((id) => {
        engine.data = engine.data.filter((node) => node.id !== id);
        return true;
      });
      engine.cleanOrphans();
      expect(removeSpy).toHaveBeenCalledWith('orphan');
      expect(engine.data).toHaveLength(1);
    });
  });

  describe('openNode', () => {
    it('opens ancestors for a node', () => {
      engine.data = [
        { id: 'root', parent: null, children: [{ id: 'a' }], open: false },
        { id: 'a', parent: 'root', children: [{ id: 'b' }], open: false },
        { id: 'b', parent: 'a', children: [], open: false }
      ];
      engine.openNode('b');
      expect(engine.data.find((n) => n.id === 'a').open).toBe(true);
    });
  });

  describe('getChildren/getDecendents/getAncestors', () => {
    it('returns expected nodes', () => {
      engine.data = [
        { id: 'root', parent: null },
        { id: 'a', parent: 'root' },
        { id: 'b', parent: 'a' }
      ];
      expect(engine.getChildren('root').map((n) => n.id)).toEqual(['a']);
      expect(engine.getDecendents('root').map((n) => n.id)).toEqual(['a', 'b']);
      expect(engine.getAncestors('b')).toEqual(['a', 'root', null]);
    });
  });

  describe('getAllNodesOrderByView', () => {
    it('returns nodes ordered by view', () => {
      engine.data = [
        { id: 'root' },
        { id: 'page-1' }
      ];
      const list = document.createElement('div');
      list.className = 'nav-list';
      list.innerHTML = '<div class="nav-element" nav-id="page-1"></div>';
      engine.menuStructureCompose = { menuNavList: list };

      const result = engine.getAllNodesOrderByView();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('page-1');
    });
  });

  describe('getPosInNodesOrderByView', () => {
    it('returns false when nodesOrderByView missing', () => {
      engine.nodesOrderByView = null;
      expect(engine.getPosInNodesOrderByView('page-1')).toBe(false);
    });
  });

  describe('selectNode/selectFirst', () => {
    it('selects node when element exists', async () => {
      const nav = document.createElement('div');
      nav.className = 'nav-element';
      nav.setAttribute('nav-id', 'page-1');
      const menuNav = document.createElement('div');
      menuNav.appendChild(nav);
      engine.menuStructureCompose = { menuNav };
      engine.menuStructureBehaviour = { selectNode: vi.fn() };

      await engine.selectNode('page-1');
      expect(engine.menuStructureBehaviour.selectNode).toHaveBeenCalledWith(nav);
    });

    it('calls selectFirst when node is missing', async () => {
      engine.menuStructureCompose = { menuNav: document.createElement('div') };
      engine.menuStructureBehaviour = { selectNode: vi.fn(), selectFirst: vi.fn() };
      await engine.selectNode('missing');
      expect(engine.menuStructureBehaviour.selectFirst).toHaveBeenCalled();
    });
  });

  describe('getSelectedNode helpers', () => {
    it('returns selected node ids', () => {
      engine.data = [
        { id: 'page-1', pageId: 'page-1' }
      ];
      const element = document.createElement('div');
      element.setAttribute('nav-id', 'page-1');
      engine.menuStructureBehaviour = { nodeSelected: element };

      expect(engine.getSelectNodeNavId()).toBe('page-1');
      expect(engine.getSelectNodePageId()).toBe('page-1');
    });

    it('returns false when no selection', () => {
      engine.menuStructureBehaviour = { nodeSelected: null };
      expect(engine.getSelectedNode()).toBe(false);
    });
  });
});
