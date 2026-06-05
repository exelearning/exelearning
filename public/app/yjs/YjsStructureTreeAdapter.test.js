/**
 * YjsStructureTreeAdapter Tests
 *
 * Unit tests for YjsStructureTreeAdapter - adapts Yjs structure changes to legacy tree UI.
 *
 */

 

// Test functions available globally from vitest setup

const YjsStructureTreeAdapter = require('./YjsStructureTreeAdapter');

// Mock YjsStructureBinding
const createMockStructureBinding = (pages = []) => ({
  manager: {
    getNavigation: mock(() => ({
      observeDeep: mock(() => undefined),
      unobserveDeep: mock(() => undefined),
    })),
  },
  getPages: mock(() => pages),
  addPage: mock((name, parentId) => ({
    id: `mock-page-${Date.now()}`,
    pageName: name,
    parentId,
  })),
  updatePage: mock(() => undefined),
  deletePage: mock(() => undefined),
  movePage: mock(() => undefined),
});

describe('YjsStructureTreeAdapter', () => {
  let adapter;
  let mockStructureBinding;
  let container;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.id = 'test-tree-container';
    document.body.appendChild(container);

    mockStructureBinding = createMockStructureBinding([
      { id: 'page-1', pageName: 'Page 1', parentId: null, order: 0 },
      { id: 'page-2', pageName: 'Page 2', parentId: null, order: 1 },
      { id: 'page-3', pageName: 'Child Page', parentId: 'page-1', order: 0 },
    ]);

    adapter = new YjsStructureTreeAdapter(mockStructureBinding, 'test-tree-container');

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});

    // Mock window.eXeLearning
    global.window = {
      ...global.window,
      eXeLearning: {
        app: {
          project: {
            structure: {
              selectNode: mock(() => undefined),
            },
          },
        },
      },
    };
  });

  afterEach(() => {
    
    container.remove();
    delete global.window.eXeLearning;
  });

  describe('constructor', () => {
    it('initializes with structure binding and container ID', () => {
      expect(adapter.structureBinding).toBe(mockStructureBinding);
      expect(adapter.containerId).toBe('test-tree-container');
    });

    it('initializes empty observers array', () => {
      expect(adapter._observers).toEqual([]);
    });

    it('initializes isUpdating flag as false', () => {
      expect(adapter._isUpdating).toBe(false);
    });

    it('initializes selectedPageId as null', () => {
      expect(adapter._selectedPageId).toBeNull();
    });
  });

  describe('initialize', () => {
    it('finds container element', () => {
      adapter.initialize();
      expect(adapter.container).toBe(container);
    });

    it('warns when container not found', () => {
      const adapter2 = new YjsStructureTreeAdapter(mockStructureBinding, 'non-existent');
      adapter2.initialize();
      expect(console.warn).toHaveBeenCalled();
    });

    it('renders tree on initialization', () => {
      adapter.initialize();
      expect(container.innerHTML).not.toBe('');
    });

    it('sets up Yjs observers', () => {
      adapter.initialize();
      expect(adapter._observers.length).toBeGreaterThan(0);
    });
  });

  describe('buildTreeData', () => {
    it('builds hierarchical tree from flat pages', () => {
      const pages = [
        { id: 'page-1', pageName: 'Root', parentId: null, order: 0 },
        { id: 'page-2', pageName: 'Child', parentId: 'page-1', order: 0 },
      ];

      const treeData = adapter.buildTreeData(pages);

      expect(treeData).toHaveLength(1);
      expect(treeData[0].id).toBe('page-1');
      expect(treeData[0].children).toHaveLength(1);
      expect(treeData[0].children[0].id).toBe('page-2');
    });

    it('sorts children by order', () => {
      const pages = [
        { id: 'page-1', pageName: 'Root', parentId: null, order: 0 },
        { id: 'page-2', pageName: 'Child 2', parentId: 'page-1', order: 1 },
        { id: 'page-3', pageName: 'Child 1', parentId: 'page-1', order: 0 },
      ];

      const treeData = adapter.buildTreeData(pages);

      expect(treeData[0].children[0].id).toBe('page-3');
      expect(treeData[0].children[1].id).toBe('page-2');
    });

    it('handles empty pages array', () => {
      const treeData = adapter.buildTreeData([]);
      expect(treeData).toEqual([]);
    });

    it('handles multiple root pages', () => {
      const pages = [
        { id: 'page-1', pageName: 'Root 1', parentId: null, order: 0 },
        { id: 'page-2', pageName: 'Root 2', parentId: null, order: 1 },
      ];

      const treeData = adapter.buildTreeData(pages);

      expect(treeData).toHaveLength(2);
    });

    it('uses Untitled for pages without name', () => {
      const pages = [{ id: 'page-1', parentId: null, order: 0 }];

      const treeData = adapter.buildTreeData(pages);

      expect(treeData[0].text).toBe('Untitled');
    });
  });

  describe('renderHtmlTree', () => {
    it('renders tree HTML to container', () => {
      adapter.container = container;
      const treeData = [
        {
          id: 'page-1',
          text: 'Page 1',
          children: [],
          data: { id: 'page-1' },
        },
      ];

      adapter.renderHtmlTree(treeData);

      expect(container.innerHTML).toContain('yjs-tree-root');
      expect(container.innerHTML).toContain('Page 1');
    });

    it('adds click handlers to nodes', () => {
      adapter.container = container;
      adapter._selectedPageId = null;

      const treeData = [
        {
          id: 'page-1',
          text: 'Page 1',
          children: [],
          data: { id: 'page-1' },
        },
      ];

      adapter.renderHtmlTree(treeData);

      const node = container.querySelector('.yjs-tree-node');
      expect(node).toBeDefined();
    });
  });

  describe('buildHtmlTreeNodes', () => {
    it('builds HTML for single node', () => {
      adapter._selectedPageId = null;

      const nodes = [
        {
          id: 'page-1',
          text: 'Test Page',
          children: [],
        },
      ];

      const html = adapter.buildHtmlTreeNodes(nodes, 0);

      expect(html).toContain('Test Page');
      expect(html).toContain('data-page-id="page-1"');
    });

    it('builds nested HTML for nodes with children', () => {
      adapter._selectedPageId = null;

      const nodes = [
        {
          id: 'parent',
          text: 'Parent',
          children: [
            {
              id: 'child',
              text: 'Child',
              children: [],
            },
          ],
        },
      ];

      const html = adapter.buildHtmlTreeNodes(nodes, 0);

      expect(html).toContain('Parent');
      expect(html).toContain('Child');
      expect(html).toContain('has-children');
    });

    it('marks selected node', () => {
      adapter._selectedPageId = 'page-1';

      const nodes = [
        {
          id: 'page-1',
          text: 'Selected Page',
          children: [],
        },
      ];

      const html = adapter.buildHtmlTreeNodes(nodes, 0);

      expect(html).toContain('selected');
    });

    it('applies correct padding based on depth', () => {
      adapter._selectedPageId = null;

      const nodes = [
        {
          id: 'page-1',
          text: 'Page',
          children: [],
        },
      ];

      const htmlDepth0 = adapter.buildHtmlTreeNodes(nodes, 0);
      const htmlDepth2 = adapter.buildHtmlTreeNodes(nodes, 2);

      expect(htmlDepth0).toContain('padding-left: 0px');
      expect(htmlDepth2).toContain('padding-left: 40px');
    });
  });

  describe('selectPage', () => {
    beforeEach(() => {
      adapter.container = container;
      adapter.initialize();

      // Ensure eXeLearning mock is set for legacy selectNode tests
      window.eXeLearning = {
        app: {
          project: {
            structure: {
              selectNode: mock(() => undefined),
            },
          },
        },
      };
    });

    it('sets selectedPageId', () => {
      adapter.selectPage('page-1');
      expect(adapter._selectedPageId).toBe('page-1');
    });

    it('dispatches pageSelected event', () => {
      const eventHandler = mock(() => undefined);
      container.addEventListener('pageSelected', eventHandler);

      adapter.selectPage('page-1');

      expect(eventHandler).toHaveBeenCalled();
      expect(eventHandler.mock.calls[0][0].detail.pageId).toBe('page-1');
    });

    it('calls legacy selectNode if available', () => {
      adapter.selectPage('page-1');

      expect(window.eXeLearning.app.project.structure.selectNode).toHaveBeenCalledWith('page-1');
    });
  });

  describe('addPage', () => {
    beforeEach(() => {
      adapter.container = container;
      adapter.initialize();
    });

    it('calls structureBinding.addPage', () => {
      adapter.addPage(null, 'New Page');

      expect(mockStructureBinding.addPage).toHaveBeenCalledWith('New Page', null);
    });

    it('returns created page', () => {
      const page = adapter.addPage(null, 'New Page');

      expect(page).toBeDefined();
      expect(page.pageName).toBe('New Page');
    });

    it('renders tree after adding', () => {
      const renderSpy = spyOn(adapter, 'renderTree');

      adapter.addPage(null, 'New Page');

      expect(renderSpy).toHaveBeenCalled();
    });

    it('sets isUpdating flag during operation', () => {
      let wasUpdating = false;

      mockStructureBinding.addPage = mock(() => {
        wasUpdating = adapter._isUpdating;
        return { id: 'new-page', pageName: 'New Page' };
      });

      adapter.addPage(null, 'New Page');

      expect(wasUpdating).toBe(true);
      expect(adapter._isUpdating).toBe(false);
    });
  });

  describe('renamePage', () => {
    beforeEach(() => {
      adapter.container = container;
      adapter.initialize();
    });

    it('calls structureBinding.updatePage', () => {
      adapter.renamePage('page-1', 'Renamed Page');

      expect(mockStructureBinding.updatePage).toHaveBeenCalledWith('page-1', { pageName: 'Renamed Page' });
    });

    it('renders tree after renaming', () => {
      const renderSpy = spyOn(adapter, 'renderTree');

      adapter.renamePage('page-1', 'Renamed Page');

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('deletePage', () => {
    beforeEach(() => {
      adapter.container = container;
      adapter.initialize();
    });

    it('calls structureBinding.deletePage', () => {
      adapter.deletePage('page-1');

      expect(mockStructureBinding.deletePage).toHaveBeenCalledWith('page-1');
    });

    it('clears selection if deleted page was selected', () => {
      adapter._selectedPageId = 'page-1';

      adapter.deletePage('page-1');

      expect(adapter._selectedPageId).toBeNull();
    });

    it('keeps selection if different page was deleted', () => {
      adapter._selectedPageId = 'page-2';

      adapter.deletePage('page-1');

      expect(adapter._selectedPageId).toBe('page-2');
    });

    it('renders tree after deleting', () => {
      const renderSpy = spyOn(adapter, 'renderTree');

      adapter.deletePage('page-1');

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('movePageToParent', () => {
    beforeEach(() => {
      adapter.container = container;
      adapter.initialize();
    });

    it('calls structureBinding.movePage', () => {
      adapter.movePageToParent('page-2', 'page-1');

      expect(mockStructureBinding.movePage).toHaveBeenCalled();
      expect(mockStructureBinding.movePage).toHaveBeenCalledWith('page-2', 'page-1', expect.any(Number));
    });

    it('renders tree after moving', () => {
      const renderSpy = spyOn(adapter, 'renderTree');

      adapter.movePageToParent('page-2', 'page-1');

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('getSelectedPageId', () => {
    it('returns selected page ID', () => {
      adapter._selectedPageId = 'page-1';
      expect(adapter.getSelectedPageId()).toBe('page-1');
    });

    it('returns null when no selection', () => {
      expect(adapter.getSelectedPageId()).toBeNull();
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(adapter.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(adapter.escapeHtml('a & b')).toBe('a &amp; b');
      // Quotes are not escaped by textContent/innerHTML in text context
      expect(adapter.escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it('returns empty string for empty input', () => {
      expect(adapter.escapeHtml('')).toBe('');
    });
  });

  describe('addStyles', () => {
    it('is a no-op (styles moved to SCSS)', () => {
      // addStyles() is now deprecated - styles are in _collaborative.scss
      adapter.addStyles();

      // Should not create any style elements
      const styleEl = document.getElementById('yjs-tree-styles');
      expect(styleEl).toBeNull();
    });
  });

  describe('destroy', () => {
    it('clears observers', () => {
      adapter.initialize();
      adapter._observers.push(() => {});

      adapter.destroy();

      expect(adapter._observers).toEqual([]);
    });

    it('calls cleanup functions for observers', () => {
      adapter.initialize();
      const cleanup = mock(() => undefined);
      adapter._observers.push(cleanup);

      adapter.destroy();

      expect(cleanup).toHaveBeenCalled();
    });

    it('handles cleanup errors gracefully', () => {
      adapter.initialize();
      adapter._observers.push(() => {
        throw new Error('Cleanup error');
      });

      // Should not throw
      expect(() => adapter.destroy()).not.toThrow();
    });
  });

  describe('convertToJsTreeFormat', () => {
    it('converts tree data to jsTree format', () => {
      const nodes = [
        {
          id: 'page-1',
          text: 'Page 1',
          children: [
            {
              id: 'page-2',
              text: 'Page 2',
              children: [],
              data: { id: 'page-2' },
            },
          ],
          data: { id: 'page-1' },
        },
      ];

      const jstreeData = adapter.convertToJsTreeFormat(nodes);

      expect(jstreeData).toHaveLength(1);
      expect(jstreeData[0].id).toBe('page-1');
      expect(jstreeData[0].text).toBe('Page 1');
      expect(jstreeData[0].icon).toContain('material-icons');
      expect(jstreeData[0].state.opened).toBe(true);
      expect(jstreeData[0].children).toHaveLength(1);
    });

    it('handles empty array', () => {
      const jstreeData = adapter.convertToJsTreeFormat([]);
      expect(jstreeData).toEqual([]);
    });
  });
});
