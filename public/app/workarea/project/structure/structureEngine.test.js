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
        odeNavStructureSyncPropertiesConfig: {}
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
});
