/**
 * YjsStructureBinding Tests
 *
 * Unit tests for YjsStructureBinding - binds Yjs document structure to navigation UI.
 *
 */

 

// Test functions available globally from vitest setup

const YjsStructureBinding = require('./YjsStructureBinding');

// Mock Y.Map
class MockYMap {
  constructor(data = {}) {
    this._data = new Map(Object.entries(data));
  }

  get(key) {
    return this._data.get(key);
  }

  set(key, value) {
    this._data.set(key, value);
  }

  has(key) {
    return this._data.has(key);
  }

  delete(key) {
    return this._data.delete(key);
  }

  forEach(callback) {
    this._data.forEach((value, key) => callback(value, key));
  }

  toJSON() {
    return Object.fromEntries(this._data);
  }
}

// Mock Y.Array
class MockYArray {
  constructor(items = []) {
    this._items = items;
    this._observers = [];
  }

  get length() {
    return this._items.length;
  }

  get(index) {
    return this._items[index];
  }

  push(items) {
    if (Array.isArray(items)) {
      this._items.push(...items);
    } else {
      this._items.push(items);
    }
  }

  insert(index, items) {
    if (Array.isArray(items)) {
      this._items.splice(index, 0, ...items);
    } else {
      this._items.splice(index, 0, items);
    }
  }

  delete(index, length = 1) {
    this._items.splice(index, length);
  }

  toArray() {
    return [...this._items];
  }

  forEach(callback) {
    this._items.forEach((item, index) => callback(item, index));
  }

  map(callback) {
    return this._items.map(callback);
  }

  observeDeep(callback) {
    this._observers.push(callback);
  }

  unobserveDeep(callback) {
    this._observers = this._observers.filter((cb) => cb !== callback);
  }
}

// Mock Y.Doc
class MockYDoc {
  constructor() {
    this.clientID = 12345;
    this._arrays = {};
    this._maps = {};
  }

  getArray(name) {
    if (!this._arrays[name]) {
      this._arrays[name] = new MockYArray();
    }
    return this._arrays[name];
  }

  getMap(name) {
    if (!this._maps[name]) {
      this._maps[name] = new MockYMap();
    }
    return this._maps[name];
  }

  transact(fn, origin) {
    fn();
  }
}

// Mock Document Manager
const createMockDocumentManager = (pages = []) => {
  const ydoc = new MockYDoc();
  const navigation = ydoc.getArray('navigation');

  // Add pages
  pages.forEach((page) => navigation.push([page]));

  return {
    getNavigation: mock(() => navigation),
    getDoc: mock(() => ydoc),
    generateId: mock(() => `mock-id-${Math.random().toString(36).substr(2, 9)}`),
  };
};

describe('YjsStructureBinding', () => {
  let binding;
  let mockDocManager;
  const originalWindow = global.window;

  beforeEach(() => {
    // Mock Y.Text
    class MockYText {
      constructor(text = '') {
        this._text = text;
      }
      toString() {
        return this._text;
      }
    }

    // Setup global Y
    global.window = {
      Y: {
        Map: MockYMap,
        Array: MockYArray,
        Text: MockYText,
      },
    };

    mockDocManager = createMockDocumentManager();
    binding = new YjsStructureBinding(mockDocManager);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup to prevent memory leaks
    binding = null;
    mockDocManager = null;

    // Restore original globals instead of deleting
    global.window = originalWindow;
  });

  describe('constructor', () => {
    it('initializes with document manager', () => {
      expect(binding.manager).toBe(mockDocManager);
    });

    it('initializes Y reference', () => {
      expect(binding.Y).toBeDefined();
    });

    it('initializes empty changeCallbacks', () => {
      expect(binding.changeCallbacks).toEqual([]);
    });
  });

  describe('onStructureChange', () => {
    it('adds callback to changeCallbacks', () => {
      const callback = mock(() => undefined);
      binding.onStructureChange(callback);
      expect(binding.changeCallbacks).toContain(callback);
    });

    it('subscribes to navigation observeDeep', () => {
      const navigation = mockDocManager.getNavigation();
      const observeSpy = spyOn(navigation, 'observeDeep');

      binding.onStructureChange(mock(() => undefined));

      expect(observeSpy).toHaveBeenCalled();
    });
  });

  describe('getPages', () => {
    it('returns empty array for empty navigation', () => {
      const pages = binding.getPages();
      expect(pages).toEqual([]);
    });

    it('returns mapped page objects', () => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
      });
      pageMap.set('blocks', new MockYArray());

      const navigation = mockDocManager.getNavigation();
      navigation.push([pageMap]);

      const pages = binding.getPages();

      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe('page-1');
      expect(pages[0].pageName).toBe('Test Page');
    });
  });

  describe('getPage', () => {
    it('returns null for non-existent page', () => {
      const page = binding.getPage('non-existent');
      expect(page).toBeNull();
    });

    it('returns page by ID', () => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', new MockYArray());

      mockDocManager.getNavigation().push([pageMap]);

      const page = binding.getPage('page-1');
      expect(page).toBeDefined();
      expect(page.id).toBe('page-1');
    });
  });

  describe('createPage / addPage', () => {
    it('creates new page with given name', () => {
      const page = binding.createPage('New Page');

      expect(page).toBeDefined();
      expect(page.pageName).toBe('New Page');
      expect(page.id).toBeDefined();
    });

    it('addPage is alias for createPage', () => {
      const page = binding.addPage('New Page');
      expect(page.pageName).toBe('New Page');
    });

    it('creates page with parent ID', () => {
      const page = binding.createPage('Child Page', 'parent-id');
      expect(page.parentId).toBe('parent-id');
    });

    it('adds page to navigation', () => {
      binding.createPage('New Page');

      const navigation = mockDocManager.getNavigation();
      expect(navigation.length).toBe(1);
    });

    it('sets correct order', () => {
      binding.createPage('Page 1');
      const page2 = binding.createPage('Page 2');

      expect(page2.order).toBe(1);
    });

    it('includes createdAt timestamp', () => {
      const page = binding.createPage('New Page');
      expect(page.createdAt).toBeDefined();
    });
  });

  describe('updatePage', () => {
    beforeEach(() => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Original Name',
      });
      pageMap.set('blocks', new MockYArray());
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('updates page name', () => {
      const result = binding.updatePage('page-1', { pageName: 'Updated Name' });

      expect(result).toBe(true);

      const page = binding.getPage('page-1');
      expect(page.pageName).toBe('Updated Name');
    });

    it('returns false for non-existent page', () => {
      const result = binding.updatePage('non-existent', { pageName: 'Test' });
      expect(result).toBe(false);
    });

    it('handles properties object', () => {
      const result = binding.updatePage('page-1', {
        properties: { customProp: 'value' },
      });

      expect(result).toBe(true);
    });
  });

  describe('deletePage', () => {
    beforeEach(() => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('removes page from navigation', () => {
      binding.deletePage('page-1');

      const navigation = mockDocManager.getNavigation();
      expect(navigation.length).toBe(0);
    });

    it('does nothing for non-existent page', () => {
      binding.deletePage('non-existent');

      const navigation = mockDocManager.getNavigation();
      expect(navigation.length).toBe(1);
    });
  });

  describe('reorderPage', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = new MockYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
        });
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('reorders page from index to new index', () => {
      binding.reorderPage(0, 2);

      const navigation = mockDocManager.getNavigation();
      expect(navigation.get(2).get('id')).toBe('page-1');
    });

    it('does nothing when fromIndex equals toIndex', () => {
      const navigation = mockDocManager.getNavigation();
      const originalFirst = navigation.get(0).get('id');

      binding.reorderPage(0, 0);

      expect(navigation.get(0).get('id')).toBe(originalFirst);
    });

    it('does nothing for invalid fromIndex', () => {
      binding.reorderPage(-1, 0);
      binding.reorderPage(10, 0);

      const navigation = mockDocManager.getNavigation();
      expect(navigation.length).toBe(3);
    });

    it('does nothing for invalid toIndex', () => {
      binding.reorderPage(0, -1);
      binding.reorderPage(0, 10);

      const navigation = mockDocManager.getNavigation();
      expect(navigation.get(0).get('id')).toBe('page-1');
    });

    it('updates order fields', () => {
      binding.reorderPage(0, 2);

      const navigation = mockDocManager.getNavigation();
      for (let i = 0; i < navigation.length; i++) {
        expect(navigation.get(i).get('order')).toBe(i);
      }
    });
  });

  describe('movePage', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = new MockYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('updates parent ID', () => {
      const result = binding.movePage('page-2', 'page-1');

      expect(result).toBe(true);
      const page = binding.getPage('page-2');
      expect(page.parentId).toBe('page-1');
    });

    it('handles root parent', () => {
      // First set a parent
      binding.movePage('page-2', 'page-1');

      // Then move to root
      binding.movePage('page-2', 'root');

      const page = binding.getPage('page-2');
      expect(page.parentId).toBeNull();
    });

    it('updates order when index provided', () => {
      binding.movePage('page-1', null, 2);

      const page = binding.getPage('page-1');
      expect(page.order).toBe(2);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePage('non-existent', null, 0);
      expect(result).toBe(false);
    });
  });

  describe('clonePage', () => {
    beforeEach(() => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Original Page',
        parentId: null,
        order: 0,
      });

      const blocksArray = new MockYArray();
      const blockMap = new MockYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      blockMap.set('components', new MockYArray());
      blocksArray.push([blockMap]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('creates copy of page', () => {
      const cloned = binding.clonePage('page-1');

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe('page-1');
    });

    it('uses custom name if provided', () => {
      const cloned = binding.clonePage('page-1', 'Custom Name');
      expect(cloned.pageName).toBe('Custom Name');
    });

    it('appends (copy) to original name by default', () => {
      const cloned = binding.clonePage('page-1');
      expect(cloned.pageName).toBe('Original Page (copy)');
    });

    it('returns null for non-existent page', () => {
      const cloned = binding.clonePage('non-existent');
      expect(cloned).toBeNull();
    });
  });

  describe('getSiblings', () => {
    beforeEach(() => {
      // Root pages
      const root1 = new MockYMap({
        id: 'root-1',
        pageId: 'root-1',
        pageName: 'Root 1',
        parentId: null,
        order: 0,
      });

      const root2 = new MockYMap({
        id: 'root-2',
        pageId: 'root-2',
        pageName: 'Root 2',
        parentId: null,
        order: 1,
      });

      // Child of root-1
      const child = new MockYMap({
        id: 'child-1',
        pageId: 'child-1',
        pageName: 'Child 1',
        parentId: 'root-1',
        order: 0,
      });

      const navigation = mockDocManager.getNavigation();
      navigation.push([root1]);
      navigation.push([root2]);
      navigation.push([child]);
    });

    it('returns siblings with same parent', () => {
      const siblings = binding.getSiblings('root-1');

      expect(siblings).toHaveLength(2);
      expect(siblings.map((s) => s.id)).toContain('root-1');
      expect(siblings.map((s) => s.id)).toContain('root-2');
    });

    it('returns sorted by order', () => {
      const siblings = binding.getSiblings('root-2');

      expect(siblings[0].id).toBe('root-1');
      expect(siblings[1].id).toBe('root-2');
    });

    it('returns empty array for non-existent page', () => {
      const siblings = binding.getSiblings('non-existent');
      expect(siblings).toEqual([]);
    });
  });

  describe('canMoveUp / canMoveDown', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = new MockYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('canMoveUp returns false for first page', () => {
      expect(binding.canMoveUp('page-1')).toBe(false);
    });

    it('canMoveUp returns true for non-first page', () => {
      expect(binding.canMoveUp('page-2')).toBe(true);
      expect(binding.canMoveUp('page-3')).toBe(true);
    });

    it('canMoveDown returns false for last page', () => {
      expect(binding.canMoveDown('page-3')).toBe(false);
    });

    it('canMoveDown returns true for non-last page', () => {
      expect(binding.canMoveDown('page-1')).toBe(true);
      expect(binding.canMoveDown('page-2')).toBe(true);
    });
  });

  describe('generateId', () => {
    it('generates unique IDs with prefix', () => {
      const id1 = binding.generateId('page');
      const id2 = binding.generateId('page');

      expect(id1).not.toBe(id2);
      expect(id1).toContain('page');
    });

    it('generates IDs without prefix', () => {
      const id = binding.generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('mapToPage', () => {
    it('maps Y.Map to page object', () => {
      const pageMap = new MockYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
        createdAt: '2024-01-01',
      });
      pageMap.set('blocks', new MockYArray());

      const page = binding.mapToPage(pageMap, 0);

      expect(page.id).toBe('page-1');
      expect(page.pageName).toBe('Test Page');
      expect(page.parentId).toBeNull();
      expect(page.order).toBe(0);
      expect(page.blockCount).toBe(0);
    });
  });

  describe('mapToComponent', () => {
    it('returns jsonProperties as string when stored as Y.Map', () => {
      // Create a component Y.Map with jsonProperties as Y.Map
      const compMap = new MockYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'crossword',
        order: 0,
      });

      // Store jsonProperties as a Y.Map (simulating the old buggy behavior)
      const jsonPropsMap = new MockYMap({
        title: 'My Crossword',
        difficulty: 'medium',
        words: 5,
      });
      compMap.set('jsonProperties', jsonPropsMap);

      const component = binding.mapToComponent(compMap, 0);

      // jsonProperties should be a valid JSON string
      expect(typeof component.jsonProperties).toBe('string');
      const parsed = JSON.parse(component.jsonProperties);
      expect(parsed.title).toBe('My Crossword');
      expect(parsed.difficulty).toBe('medium');
      expect(parsed.words).toBe(5);
    });

    it('returns jsonProperties string unchanged when stored as string', () => {
      const originalJson = JSON.stringify({ title: 'Test', count: 10 });
      const compMap = new MockYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'trueorfalse',
        order: 0,
        jsonProperties: originalJson,
      });

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe(originalJson);
    });

    it('returns "{}" when jsonProperties is missing', () => {
      const compMap = new MockYMap({
        id: 'comp-3',
        ideviceId: 'comp-3',
        ideviceType: 'text',
        order: 0,
      });

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe('{}');
    });

    it('returns "{}" when jsonProperties is undefined', () => {
      const compMap = new MockYMap({
        id: 'comp-4',
        ideviceType: 'text',
      });
      compMap.set('jsonProperties', undefined);

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe('{}');
    });

    it('returns htmlContent from htmlView fallback', () => {
      const compMap = new MockYMap({
        id: 'comp-5',
        ideviceType: 'text',
        htmlView: '<p>Hello World</p>',
      });

      const component = binding.mapToComponent(compMap, 0);

      expect(component.htmlContent).toBe('<p>Hello World</p>');
    });
  });

  describe('createComponentMapFromApi', () => {
    it('stores jsonProperties as JSON string when passed as object', () => {
      const apiComp = {
        id: 'comp-1',
        odeIdeviceId: 'comp-1',
        odeIdeviceTypeName: 'crossword',
        order: 0,
        htmlView: '<div>Test</div>',
        jsonProperties: { title: 'My Crossword', words: 5 },
      };

      const compMap = binding.createComponentMapFromApi(apiComp);

      // jsonProperties should be stored as a string
      const storedJsonProps = compMap.get('jsonProperties');
      expect(typeof storedJsonProps).toBe('string');
      expect(JSON.parse(storedJsonProps)).toEqual({ title: 'My Crossword', words: 5 });
    });

    it('stores jsonProperties as JSON string when passed as string', () => {
      const jsonStr = JSON.stringify({ title: 'Test', count: 3 });
      const apiComp = {
        id: 'comp-2',
        odeIdeviceId: 'comp-2',
        odeIdeviceTypeName: 'trueorfalse',
        order: 0,
        htmlView: '',
        jsonProperties: jsonStr,
      };

      const compMap = binding.createComponentMapFromApi(apiComp);

      const storedJsonProps = compMap.get('jsonProperties');
      expect(storedJsonProps).toBe(jsonStr);
    });

    it('handles empty jsonProperties', () => {
      const apiComp = {
        id: 'comp-3',
        odeIdeviceId: 'comp-3',
        odeIdeviceTypeName: 'text',
        order: 0,
        htmlView: '<p>Content</p>',
      };

      const compMap = binding.createComponentMapFromApi(apiComp);

      // jsonProperties should not be set (or be undefined)
      const storedJsonProps = compMap.get('jsonProperties');
      expect(storedJsonProps).toBeUndefined();
    });
  });
});
