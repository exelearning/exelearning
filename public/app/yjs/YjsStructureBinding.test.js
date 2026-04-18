/**
 * YjsStructureBinding Tests
 *
 * Unit tests for YjsStructureBinding - binds Yjs document structure to navigation UI.
 *
 */

 

// Test functions available globally from vitest setup

const YjsStructureBinding = require('./YjsStructureBinding');

let testDoc;
let scratchArray;

const createYMap = (data = {}) => {
  const map = new window.Y.Map();
  Object.entries(data).forEach(([key, value]) => map.set(key, value));
  return map;
};

const createYArray = (items = []) => {
  const arr = new window.Y.Array();
  if (items.length) arr.push(items);
  return arr;
};

const createYText = (text = '') => {
  const ytext = new window.Y.Text();
  if (text) ytext.insert(0, text);
  return ytext;
};

const integrateYType = (type) => {
  scratchArray.push([type]);
  return type;
};

// Mock Document Manager
const createMockDocumentManager = (pages = []) => {
  const ydoc = testDoc;
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
    testDoc = new window.Y.Doc();
    scratchArray = testDoc.getArray('__scratch');

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
    testDoc = null;
    scratchArray = null;

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
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
      });
      pageMap.set('blocks', createYArray());

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
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray());

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
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Original Name',
      });
      pageMap.set('blocks', createYArray());
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
      const pageMap = createYMap({
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
        const pageMap = createYMap({
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
        const pageMap = createYMap({
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
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Original Page',
        parentId: null,
        order: 0,
      });

      const blocksArray = createYArray();
      const blockMap = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      blockMap.set('components', createYArray());
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
      const root1 = createYMap({
        id: 'root-1',
        pageId: 'root-1',
        pageName: 'Root 1',
        parentId: null,
        order: 0,
      });

      const root2 = createYMap({
        id: 'root-2',
        pageId: 'root-2',
        pageName: 'Root 2',
        parentId: null,
        order: 1,
      });

      // Child of root-1
      const child = createYMap({
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
        const pageMap = createYMap({
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

  describe('grouped page movement', () => {
    beforeEach(() => {
      const pages = [
        createYMap({ id: 'a', pageId: 'a', pageName: 'A', parentId: null, order: 0 }),
        createYMap({ id: 'b', pageId: 'b', pageName: 'B', parentId: null, order: 1 }),
        createYMap({ id: 'c', pageId: 'c', pageName: 'C', parentId: null, order: 2 }),
        createYMap({ id: 'd', pageId: 'd', pageName: 'D', parentId: null, order: 3 }),
      ];
      pages.forEach((p) => {
        p.set('blocks', createYArray());
        mockDocManager.getNavigation().push([p]);
      });
    });

    it('canMoveGroupRight returns false when first selected has no previous sibling', () => {
      expect(binding.canMoveGroupRight(['a', 'b'])).toBe(false);
    });

    it('movePageGroupRight nests selection under previous sibling of first selected', () => {
      const moved = binding.movePageGroupRight(['b', 'c']);
      expect(moved).toBe(true);

      const pageB = binding.getPageMap('b');
      const pageC = binding.getPageMap('c');
      expect(pageB.get('parentId')).toBe('a');
      expect(pageC.get('parentId')).toBe('a');
      expect(pageB.get('order')).toBe(0);
      expect(pageC.get('order')).toBe(1);
    });

    it('movePageGroupLeft keeps order and inserts after current parent', () => {
      binding.movePageGroupRight(['b', 'c']); // b,c become children of a
      const movedLeft = binding.movePageGroupLeft(['b', 'c']);
      expect(movedLeft).toBe(true);

      const topLevel = binding
        .getPages()
        .filter((p) => p.parentId === null)
        .sort((x, y) => x.order - y.order)
        .map((p) => p.id);
      expect(topLevel).toEqual(['a', 'b', 'c', 'd']);
    });

    it('movePageGroupPrev/movePageGroupNext move as block without re-nesting', () => {
      const movedUp = binding.movePageGroupPrev(['c', 'd']);
      expect(movedUp).toBe(true);
      let topLevel = binding
        .getPages()
        .filter((p) => p.parentId === null)
        .sort((x, y) => x.order - y.order)
        .map((p) => p.id);
      expect(topLevel).toEqual(['a', 'c', 'd', 'b']);

      const movedDown = binding.movePageGroupNext(['c', 'd']);
      expect(movedDown).toBe(true);
      topLevel = binding
        .getPages()
        .filter((p) => p.parentId === null)
        .sort((x, y) => x.order - y.order)
        .map((p) => p.id);
      expect(topLevel).toEqual(['a', 'b', 'c', 'd']);
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
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
        createdAt: '2024-01-01',
      });
      pageMap.set('blocks', createYArray());
      integrateYType(pageMap);

      const page = binding.mapToPage(pageMap, 0);

      expect(page.id).toBe('page-1');
      expect(page.pageName).toBe('Test Page');
      expect(page.parentId).toBeNull();
      expect(page.order).toBe(0);
      expect(page.blockCount).toBe(0);
    });
  });

  describe('getBlocks', () => {
    it('returns blocks sorted by order property', () => {
      // Create blocks with different order values (not in sequence)
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 57,
      });
      block1.set('components', createYArray());

      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        order: 1,
      });
      block2.set('components', createYArray());

      const block3 = createYMap({
        id: 'block-3',
        blockId: 'block-3',
        blockName: 'Block 3',
        order: 74,
      });
      block3.set('components', createYArray());

      // Add blocks in wrong order (57, 1, 74)
      const blocksArray = createYArray([block1, block2, block3]);

      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        parentId: null,
        order: 0,
      });
      pageMap.set('blocks', blocksArray);

      mockDocManager.getNavigation().push([pageMap]);

      const blocks = binding.getBlocks('page-1');

      // Should be sorted by order: 1, 57, 74
      expect(blocks).toHaveLength(3);
      expect(blocks[0].id).toBe('block-2'); // order: 1
      expect(blocks[1].id).toBe('block-1'); // order: 57
      expect(blocks[2].id).toBe('block-3'); // order: 74
    });

    it('returns blocks in insertion order when all have same order', () => {
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });
      block1.set('components', createYArray());

      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        order: 0,
      });
      block2.set('components', createYArray());

      const blocksArray = createYArray([block1, block2]);
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', blocksArray);

      mockDocManager.getNavigation().push([pageMap]);

      const blocks = binding.getBlocks('page-1');

      expect(blocks).toHaveLength(2);
      // Stable sort maintains insertion order for equal values
      expect(blocks[0].id).toBe('block-1');
      expect(blocks[1].id).toBe('block-2');
    });

    it('returns empty array for non-existent page', () => {
      const blocks = binding.getBlocks('non-existent');
      expect(blocks).toEqual([]);
    });
  });

  describe('getComponents', () => {
    it('returns components sorted by order property', () => {
      // Create components with different order values
      const comp1 = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 85,
      });

      const comp2 = createYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'FreeTextIdevice',
        order: 10,
      });

      const comp3 = createYMap({
        id: 'comp-3',
        ideviceId: 'comp-3',
        ideviceType: 'FreeTextIdevice',
        order: 50,
      });

      // Add in wrong order (85, 10, 50)
      const componentsArray = createYArray([comp1, comp2, comp3]);

      const blockMap = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });
      blockMap.set('components', componentsArray);

      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray([blockMap]));

      mockDocManager.getNavigation().push([pageMap]);

      const components = binding.getComponents('page-1', 'block-1');

      // Should be sorted by order: 10, 50, 85
      expect(components).toHaveLength(3);
      expect(components[0].id).toBe('comp-2'); // order: 10
      expect(components[1].id).toBe('comp-3'); // order: 50
      expect(components[2].id).toBe('comp-1'); // order: 85
    });

    it('returns empty array for non-existent block', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray());

      mockDocManager.getNavigation().push([pageMap]);

      const components = binding.getComponents('page-1', 'non-existent');
      expect(components).toEqual([]);
    });
  });

  describe('mapToComponent', () => {
    it('returns jsonProperties as string when stored as Y.Map', () => {
      // Create a component Y.Map with jsonProperties as Y.Map
      const compMap = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'crossword',
        order: 0,
      });

      // Store jsonProperties as a Y.Map (simulating the old buggy behavior)
      const jsonPropsMap = createYMap({
        title: 'My Crossword',
        difficulty: 'medium',
        words: 5,
      });
      compMap.set('jsonProperties', jsonPropsMap);
      integrateYType(compMap);

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
      const compMap = createYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'trueorfalse',
        order: 0,
        jsonProperties: originalJson,
      });
      integrateYType(compMap);

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe(originalJson);
    });

    it('returns "{}" when jsonProperties is missing', () => {
      const compMap = createYMap({
        id: 'comp-3',
        ideviceId: 'comp-3',
        ideviceType: 'text',
        order: 0,
      });
      integrateYType(compMap);

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe('{}');
    });

    it('returns "{}" when jsonProperties is undefined', () => {
      const compMap = createYMap({
        id: 'comp-4',
        ideviceType: 'text',
      });
      compMap.set('jsonProperties', undefined);
      integrateYType(compMap);

      const component = binding.mapToComponent(compMap, 0);

      expect(component.jsonProperties).toBe('{}');
    });

    it('returns htmlContent from htmlView fallback', () => {
      const compMap = createYMap({
        id: 'comp-5',
        ideviceType: 'text',
        htmlView: '<p>Hello World</p>',
      });
      integrateYType(compMap);

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
      integrateYType(compMap);

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
      integrateYType(compMap);

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
      integrateYType(compMap);

      // jsonProperties should not be set (or be undefined)
      const storedJsonProps = compMap.get('jsonProperties');
      expect(storedJsonProps).toBeUndefined();
    });
  });

  // ===== Block Operations Tests =====

  describe('getBlocks', () => {
    it('returns empty array for non-existent page', () => {
      const blocks = binding.getBlocks('non-existent');
      expect(blocks).toEqual([]);
    });

    it('returns empty array when page has no blocks', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray());
      mockDocManager.getNavigation().push([pageMap]);

      const blocks = binding.getBlocks('page-1');
      expect(blocks).toEqual([]);
    });

    it('returns multiple blocks correctly', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });
      block1.set('components', createYArray());
      blocksArray.push([block1]);

      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        order: 1,
      });
      block2.set('components', createYArray());
      blocksArray.push([block2]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);

      const blocks = binding.getBlocks('page-1');
      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockName).toBe('Block 1');
      expect(blocks[1].blockName).toBe('Block 2');
    });
  });

  describe('getBlock', () => {
    it('returns null for non-existent block', () => {
      const block = binding.getBlock('non-existent');
      expect(block).toBeNull();
    });

    it('returns null when navigation is empty', () => {
      const block = binding.getBlock('block-1');
      expect(block).toBeNull();
    });

    it('finds block by id across all pages', () => {
      // Create page 1 with block 1
      const page1 = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Page 1',
      });
      const blocks1 = createYArray();
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        iconName: 'info',
        order: 0,
      });
      block1.set('components', createYArray());
      blocks1.push([block1]);
      page1.set('blocks', blocks1);

      // Create page 2 with block 2
      const page2 = createYMap({
        id: 'page-2',
        pageId: 'page-2',
        pageName: 'Page 2',
      });
      const blocks2 = createYArray();
      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        iconName: 'alert',
        order: 0,
      });
      block2.set('components', createYArray());
      blocks2.push([block2]);
      page2.set('blocks', blocks2);

      mockDocManager.getNavigation().push([page1]);
      mockDocManager.getNavigation().push([page2]);

      // Find block from page 2
      const foundBlock = binding.getBlock('block-2');
      expect(foundBlock).not.toBeNull();
      expect(foundBlock.id).toBe('block-2');
      expect(foundBlock.blockName).toBe('Block 2');
      expect(foundBlock.iconName).toBe('alert');
    });

    it('finds block by blockId when id is different', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        blockId: 'my-block-id',  // Only blockId, no id
        blockName: 'Test Block',
        order: 0,
      });
      block.set('components', createYArray());
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);

      const foundBlock = binding.getBlock('my-block-id');
      expect(foundBlock).not.toBeNull();
      expect(foundBlock.blockName).toBe('Test Block');
    });
  });

  describe('createBlock', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray());
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('creates block with default name', () => {
      const blockId = binding.createBlock('page-1');

      expect(blockId).toBeDefined();
      expect(typeof blockId).toBe('string');
    });

    it('creates block with custom name', () => {
      const blockId = binding.createBlock('page-1', 'Custom Block');

      const blocks = binding.getBlocks('page-1');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('Custom Block');
    });

    it('returns null for non-existent page', () => {
      const blockId = binding.createBlock('non-existent', 'Block');
      expect(blockId).toBeNull();
    });

    it('uses existing block ID when provided', () => {
      const blockId = binding.createBlock('page-1', 'Block', 'my-existing-id');
      expect(blockId).toBe('my-existing-id');
    });

    it('increments order for multiple blocks', () => {
      binding.createBlock('page-1', 'Block 1');
      binding.createBlock('page-1', 'Block 2');

      const blocks = binding.getBlocks('page-1');
      expect(blocks[0].order).toBe(0);
      expect(blocks[1].order).toBe(1);
    });

    // Regression test: inserting block at specific order should work correctly
    it('inserts block at specified order position and shifts existing blocks', () => {
      // Create two blocks at positions 0 and 1
      binding.createBlock('page-1', 'Block A', 'block-a');
      binding.createBlock('page-1', 'Block B', 'block-b');

      // Now insert a new block at position 0 (beginning)
      binding.createBlock('page-1', 'Block New', 'block-new', 0);

      const blocks = binding.getBlocks('page-1');

      // Should have 3 blocks
      expect(blocks).toHaveLength(3);

      // block-new should be first (order 0)
      expect(blocks[0].id).toBe('block-new');
      expect(blocks[0].order).toBe(0);

      // block-a should be second (order 1, shifted from 0)
      expect(blocks[1].id).toBe('block-a');
      expect(blocks[1].order).toBe(1);

      // block-b should be third (order 2, shifted from 1)
      expect(blocks[2].id).toBe('block-b');
      expect(blocks[2].order).toBe(2);
    });

    it('inserts block in middle position correctly', () => {
      // Create three blocks
      binding.createBlock('page-1', 'Block 0', 'block-0');
      binding.createBlock('page-1', 'Block 1', 'block-1');
      binding.createBlock('page-1', 'Block 2', 'block-2');

      // Insert new block at position 1 (middle)
      binding.createBlock('page-1', 'Block Middle', 'block-middle', 1);

      const blocks = binding.getBlocks('page-1');

      expect(blocks).toHaveLength(4);
      expect(blocks[0].id).toBe('block-0');
      expect(blocks[0].order).toBe(0);
      expect(blocks[1].id).toBe('block-middle');
      expect(blocks[1].order).toBe(1);
      expect(blocks[2].id).toBe('block-1');
      expect(blocks[2].order).toBe(2);
      expect(blocks[3].id).toBe('block-2');
      expect(blocks[3].order).toBe(3);
    });
  });

  describe('updateBlock', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Original Name',
        order: 0,
      });
      block.set('components', createYArray());
      blocksArray.push([block]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('updates block name', () => {
      const result = binding.updateBlock('block-1', { blockName: 'Updated Name' });

      expect(result).toBe(true);
      const blocks = binding.getBlocks('page-1');
      expect(blocks[0].blockName).toBe('Updated Name');
    });

    it('updates block properties', () => {
      const result = binding.updateBlock('block-1', {
        properties: { visibility: 'true', teacherOnly: 'false' },
      });

      expect(result).toBe(true);
    });

    it('returns false for non-existent block', () => {
      const result = binding.updateBlock('non-existent', { blockName: 'Test' });
      expect(result).toBe(false);
    });

    it('converts checkbox values in properties', () => {
      const result = binding.updateBlock('block-1', {
        properties: { visibility: true, teacherOnly: '1', minimized: 'false' },
      });

      expect(result).toBe(true);
    });
  });

  describe('deleteBlock', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });
      block1.set('components', createYArray());
      blocksArray.push([block1]);

      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        order: 1,
      });
      block2.set('components', createYArray());
      blocksArray.push([block2]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('deletes block successfully', () => {
      const result = binding.deleteBlock('page-1', 'block-1');

      expect(result).toBe(true);
      const blocks = binding.getBlocks('page-1');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe('block-2');
    });

    it('returns false for non-existent block', () => {
      const result = binding.deleteBlock('page-1', 'non-existent');
      expect(result).toBe(false);
    });

    it('updates order after deletion', () => {
      binding.deleteBlock('page-1', 'block-1');

      const blocks = binding.getBlocks('page-1');
      expect(blocks[0].order).toBe(0);
    });
  });

  describe('updateBlockOrder', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      for (let i = 0; i < 3; i++) {
        const block = createYMap({
          id: `block-${i + 1}`,
          blockId: `block-${i + 1}`,
          blockName: `Block ${i + 1}`,
          order: i,
        });
        block.set('components', createYArray());
        blocksArray.push([block]);
      }

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('reorders block to new position', () => {
      const result = binding.updateBlockOrder('block-1', 2);

      expect(result).toBe(true);
    });

    it('returns false for non-existent block', () => {
      const result = binding.updateBlockOrder('non-existent', 0);
      expect(result).toBe(false);
    });

    it('handles same position gracefully', () => {
      const result = binding.updateBlockOrder('block-1', 0);
      expect(result).toBe(true);
    });
  });

  describe('cloneBlock', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Original Block',
        order: 0,
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      componentsArray.push([comp]);
      block.set('components', componentsArray);
      blocksArray.push([block]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('clones block with new ID', () => {
      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe('block-1');
      expect(cloned.blockName).toBe('Original Block');
    });

    it('returns null for non-existent page', () => {
      const cloned = binding.cloneBlock('non-existent', 'block-1');
      expect(cloned).toBeNull();
    });

    it('returns null for non-existent block', () => {
      const cloned = binding.cloneBlock('page-1', 'non-existent');
      expect(cloned).toBeNull();
    });

    it('clones components within block', () => {
      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned.componentCount).toBe(1);
    });
  });

  describe('moveBlockToPage', () => {
    beforeEach(() => {
      // Create two pages with blocks
      const page1 = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Page 1',
      });
      const blocks1 = createYArray();
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });
      block1.set('components', createYArray());
      blocks1.push([block1]);
      page1.set('blocks', blocks1);

      const page2 = createYMap({
        id: 'page-2',
        pageId: 'page-2',
        pageName: 'Page 2',
      });
      page2.set('blocks', createYArray());

      mockDocManager.getNavigation().push([page1]);
      mockDocManager.getNavigation().push([page2]);
    });

    it('moves block to different page', () => {
      const result = binding.moveBlockToPage('block-1', 'page-2');

      expect(result).toBe(true);
      expect(binding.getBlocks('page-1')).toHaveLength(0);
      expect(binding.getBlocks('page-2')).toHaveLength(1);
    });

    it('returns false for non-existent block', () => {
      const result = binding.moveBlockToPage('non-existent', 'page-2');
      expect(result).toBe(false);
    });

    it('returns false for non-existent target page', () => {
      const result = binding.moveBlockToPage('block-1', 'non-existent');
      expect(result).toBe(false);
    });

    it('returns false when moving to same page', () => {
      const result = binding.moveBlockToPage('block-1', 'page-1');
      expect(result).toBe(false);
    });

    it('places moved block at end based on max order (not array length)', () => {
      // Setup page-2 with non-sequential orders (simulating deletions)
      const page2 = mockDocManager.getNavigation().get(1);
      const blocks2 = page2.get('blocks');
      const existingBlock1 = createYMap({ id: 'existing-1', blockId: 'existing-1', order: 0 });
      const existingBlock2 = createYMap({ id: 'existing-2', blockId: 'existing-2', order: 5 }); // Gap in orders
      existingBlock1.set('components', createYArray());
      existingBlock2.set('components', createYArray());
      blocks2.push([existingBlock1]);
      blocks2.push([existingBlock2]);

      // Move block-1 to page-2
      const result = binding.moveBlockToPage('block-1', 'page-2');

      expect(result).toBe(true);
      const movedBlocks = binding.getBlocks('page-2');
      expect(movedBlocks).toHaveLength(3);
      // Moved block should have order 6 (maxOrder 5 + 1), appearing last when sorted
      const movedBlock = movedBlocks.find((b) => b.blockName === 'Block 1');
      expect(movedBlock.order).toBe(6);
      // Verify sort order places it at the end
      expect(movedBlocks[2].blockName).toBe('Block 1');
    });
  });

  // ===== Component Operations Tests =====

  describe('getComponents', () => {
    it('returns empty array for non-existent block', () => {
      const components = binding.getComponents('page-1', 'non-existent');
      expect(components).toEqual([]);
    });

    it('returns empty array when block has no components', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      block.set('components', createYArray());
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);

      const components = binding.getComponents('page-1', 'block-1');
      expect(components).toEqual([]);
    });

    it('returns multiple components correctly', () => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp1 = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      const comp2 = createYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'MultiChoiceIdevice',
        order: 1,
      });
      componentsArray.push([comp1]);
      componentsArray.push([comp2]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);

      const components = binding.getComponents('page-1', 'block-1');
      expect(components).toHaveLength(2);
      expect(components[0].ideviceType).toBe('FreeTextIdevice');
      expect(components[1].ideviceType).toBe('MultiChoiceIdevice');
    });
  });

  describe('getComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      componentsArray.push([comp]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('returns component by ID', () => {
      const component = binding.getComponent('comp-1');

      expect(component).toBeDefined();
      expect(component.id).toBe('comp-1');
      expect(component.ideviceType).toBe('FreeTextIdevice');
    });

    it('returns null for non-existent component', () => {
      const component = binding.getComponent('non-existent');
      expect(component).toBeNull();
    });
  });

  describe('createComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      block.set('components', createYArray());
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('creates component with idevice type', () => {
      const compId = binding.createComponent('page-1', 'block-1', 'FreeTextIdevice');

      expect(compId).toBeDefined();
      const components = binding.getComponents('page-1', 'block-1');
      expect(components).toHaveLength(1);
      expect(components[0].ideviceType).toBe('FreeTextIdevice');
    });

    it('creates component with initial data', () => {
      const compId = binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', {
        title: 'Test Title',
      });

      expect(compId).toBeDefined();
    });

    it('uses provided ID if given in initialData', () => {
      const compId = binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', {
        id: 'my-custom-id',
      });

      expect(compId).toBe('my-custom-id');
    });

    it('returns null for non-existent block', () => {
      const compId = binding.createComponent('page-1', 'non-existent', 'FreeTextIdevice');
      expect(compId).toBeNull();
    });

    it('increments order for multiple components', () => {
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice');
      binding.createComponent('page-1', 'block-1', 'MultiChoiceIdevice');

      const components = binding.getComponents('page-1', 'block-1');
      expect(components[0].order).toBe(0);
      expect(components[1].order).toBe(1);
    });

    // Regression test: inserting component at specific order should work correctly
    it('inserts component at specified order position and shifts existing components', () => {
      // Create two components at positions 0 and 1
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', { id: 'comp-a' });
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', { id: 'comp-b' });

      // Now insert a new component at position 0 (beginning)
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', {
        id: 'comp-new',
        order: 0,
      });

      const components = binding.getComponents('page-1', 'block-1');

      // Should have 3 components
      expect(components).toHaveLength(3);

      // comp-new should be first (order 0)
      expect(components[0].id).toBe('comp-new');
      expect(components[0].order).toBe(0);

      // comp-a should be second (order 1, shifted from 0)
      expect(components[1].id).toBe('comp-a');
      expect(components[1].order).toBe(1);

      // comp-b should be third (order 2, shifted from 1)
      expect(components[2].id).toBe('comp-b');
      expect(components[2].order).toBe(2);
    });

    it('inserts component in middle position correctly', () => {
      // Create three components
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', { id: 'comp-0' });
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', { id: 'comp-1' });
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', { id: 'comp-2' });

      // Insert new component at position 1 (middle)
      binding.createComponent('page-1', 'block-1', 'FreeTextIdevice', {
        id: 'comp-middle',
        order: 1,
      });

      const components = binding.getComponents('page-1', 'block-1');

      expect(components).toHaveLength(4);
      expect(components[0].id).toBe('comp-0');
      expect(components[0].order).toBe(0);
      expect(components[1].id).toBe('comp-middle');
      expect(components[1].order).toBe(1);
      expect(components[2].id).toBe('comp-1');
      expect(components[2].order).toBe(2);
      expect(components[3].id).toBe('comp-2');
      expect(components[3].order).toBe(3);
    });
  });

  describe('updateComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      componentsArray.push([comp]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('updates simple property', () => {
      binding.updateComponent('comp-1', { title: 'New Title' });

      const comp = binding.getComponent('comp-1');
      expect(comp).toBeDefined();
    });

    it('updates htmlContent property', () => {
      binding.updateComponent('comp-1', { htmlContent: '<p>New content</p>' });

      // Should not throw
    });

    it('updates properties object with checkbox conversion', () => {
      binding.updateComponent('comp-1', {
        properties: { visibility: 'true', teacherOnly: false },
      });

      // Should not throw
    });

    it('does nothing for non-existent component', () => {
      // Should not throw
      binding.updateComponent('non-existent', { title: 'Test' });
    });

    it('updates jsonProperties with string value', () => {
      const jsonData = JSON.stringify({ key: 'value', items: [1, 2, 3] });
      binding.updateComponent('comp-1', { jsonProperties: jsonData });

      const comp = binding.getComponent('comp-1');
      // getComponent returns a plain object with jsonProperties property
      expect(comp.jsonProperties).toBe(jsonData);
    });

    it('updates jsonProperties and calls prepareJsonForSync when assetManager available', () => {
      // Setup mock assetManager on window.eXeLearning
      const mockPrepareJsonForSync = mock((json) => json.replace('blob:', 'asset://'));
      global.window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              assetManager: {
                prepareJsonForSync: mockPrepareJsonForSync,
              },
            },
          },
        },
      };

      const jsonData = JSON.stringify({ img: 'blob:http://localhost/abc' });
      binding.updateComponent('comp-1', { jsonProperties: jsonData });

      expect(mockPrepareJsonForSync).toHaveBeenCalledWith(jsonData);

      // Cleanup
      delete global.window.eXeLearning;
    });

    it('handles jsonProperties when assetManager is not available', () => {
      // Ensure no assetManager
      global.window.eXeLearning = { app: null };

      const jsonData = JSON.stringify({ key: 'value' });
      // Should not throw
      binding.updateComponent('comp-1', { jsonProperties: jsonData });

      const comp = binding.getComponent('comp-1');
      // getComponent returns a plain object with jsonProperties property
      expect(comp.jsonProperties).toBe(jsonData);

      // Cleanup
      delete global.window.eXeLearning;
    });

    it('converts object jsonProperties to string before storing', () => {
      const jsonObj = { key: 'value', nested: { a: 1 } };
      binding.updateComponent('comp-1', { jsonProperties: jsonObj });

      const comp = binding.getComponent('comp-1');
      // getComponent returns a plain object with jsonProperties property (as string)
      const stored = comp.jsonProperties;
      expect(typeof stored).toBe('string');
      expect(JSON.parse(stored)).toEqual(jsonObj);
    });

    // Regression test for issue #1674: updateComponent must drop the stale
    // `htmlView` plain-string fallback when refreshing `htmlContent`, otherwise
    // readers (e.g. File Manager reference counter) see stale content after
    // in-place edits in the desktop/Electron build.
    it('clears stale htmlView string when htmlContent is updated (issue #1674)', () => {
      const navigation = mockDocManager.getNavigation();
      const pageMap = navigation.get(0);
      const blocks = pageMap.get('blocks');
      const block = blocks.get(0);
      const components = block.get('components');
      const comp = components.get(0);

      // Simulate post-import state: htmlView holds the imported HTML string
      // (exactly how ElpxImporter/createComponentMapFromApi populate it).
      comp.set('htmlView', '<p><img src="asset://stale-1674/img.jpg"></p>');
      expect(comp.get('htmlView')).toBeDefined();

      binding.updateComponent('comp-1', { htmlContent: '<p>image removed</p>' });

      // htmlView must have been deleted so it can't mask the fresh htmlContent.
      expect(comp.get('htmlView')).toBeUndefined();
      const fresh = comp.get('htmlContent');
      expect(fresh.toString()).toBe('<p>image removed</p>');
    });
  });

  describe('deleteComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp1 = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      const comp2 = createYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'MultiChoiceIdevice',
        order: 1,
      });
      componentsArray.push([comp1]);
      componentsArray.push([comp2]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('deletes component successfully', () => {
      const result = binding.deleteComponent('comp-1');

      expect(result).toBe(true);
      const components = binding.getComponents('page-1', 'block-1');
      expect(components).toHaveLength(1);
      expect(components[0].id).toBe('comp-2');
    });

    it('returns false for non-existent component', () => {
      const result = binding.deleteComponent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('reorderComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      for (let i = 0; i < 3; i++) {
        const comp = createYMap({
          id: `comp-${i + 1}`,
          ideviceId: `comp-${i + 1}`,
          ideviceType: 'FreeTextIdevice',
          order: i,
        });
        componentsArray.push([comp]);
      }
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('reorders component to new position', () => {
      const result = binding.reorderComponent('comp-1', 2);

      expect(result).toBe(true);
    });

    it('returns false for non-existent component', () => {
      const result = binding.reorderComponent('non-existent', 0);
      expect(result).toBe(false);
    });

    it('handles same position gracefully', () => {
      const result = binding.reorderComponent('comp-1', 0);
      expect(result).toBe(true);
    });
  });

  describe('cloneComponent', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
        title: 'Original Title',
      });
      componentsArray.push([comp]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('clones component with new ID', () => {
      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe('comp-1');
      expect(cloned.ideviceType).toBe('FreeTextIdevice');
    });

    it('returns null for non-existent block', () => {
      const cloned = binding.cloneComponent('page-1', 'non-existent', 'comp-1');
      expect(cloned).toBeNull();
    });

    it('returns null for non-existent component', () => {
      const cloned = binding.cloneComponent('page-1', 'block-1', 'non-existent');
      expect(cloned).toBeNull();
    });

    it('increments order for cloned component', () => {
      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned.order).toBe(1);
    });
  });

  describe('cloneComponentMap deep cloning', () => {
    let component;

    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      component = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });

      const componentsArray = createYArray();
      componentsArray.push([component]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('should clone htmlContent', () => {
      const html = new Y.Text();
      html.insert(0, '<p>Test content with <strong>formatting</strong></p>');
      component.set('htmlContent', html);

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      // Get the cloned component from the block
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);
      expect(clonedComp.get('htmlContent').toString()).toBe('<p>Test content with <strong>formatting</strong></p>');
    });

    it('should clone jsonProperties Y.Map', () => {
      const jsonProps = new Y.Map();
      jsonProps.set('questions', [{ q: 'What is 2+2?', a: '4' }]);
      jsonProps.set('options', ['A', 'B', 'C', 'D']);
      jsonProps.set('correctAnswer', 'D');
      component.set('jsonProperties', jsonProps);

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);
      const clonedJsonProps = clonedComp.get('jsonProperties');
      expect(clonedJsonProps).toBeDefined();
      expect(clonedJsonProps.get('questions')).toEqual([{ q: 'What is 2+2?', a: '4' }]);
      expect(clonedJsonProps.get('options')).toEqual(['A', 'B', 'C', 'D']);
      expect(clonedJsonProps.get('correctAnswer')).toBe('D');
    });

    // Regression test for JSON-type iDevices (text, crossword, etc.)
    // jsonProperties is stored as string, not Y.Map, in most cases
    it('should clone jsonProperties when stored as string (common case for text iDevice)', () => {
      // This is how jsonProperties is typically stored (see apiFromComponent line ~2500)
      const jsonPropsString = JSON.stringify({
        textTextarea: '<p>Hello</p><img src="asset://uuid-123/image.jpg">',
        textFeedbackInput: 'Show feedback',
        textFeedbackTextarea: '<p>Good job!</p>',
      });
      component.set('jsonProperties', jsonPropsString);

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);

      // jsonProperties should be cloned as-is when it's a string
      const clonedJsonProps = clonedComp.get('jsonProperties');
      expect(typeof clonedJsonProps).toBe('string');
      expect(clonedJsonProps).toBe(jsonPropsString);

      // Verify the content is preserved
      const parsed = JSON.parse(clonedJsonProps);
      expect(parsed.textTextarea).toBe('<p>Hello</p><img src="asset://uuid-123/image.jpg">');
      expect(parsed.textFeedbackInput).toBe('Show feedback');
      expect(parsed.textFeedbackTextarea).toBe('<p>Good job!</p>');
    });

    it('should clone properties Y.Map', () => {
      const props = new Y.Map();
      props.set('visibility', 'visible');
      props.set('teacherOnly', true);
      props.set('cssClass', 'highlight');
      component.set('properties', props);

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);
      const clonedProps = clonedComp.get('properties');
      expect(clonedProps).toBeDefined();
      expect(clonedProps.get('visibility')).toBe('visible');
      expect(clonedProps.get('teacherOnly')).toBe(true);
      expect(clonedProps.get('cssClass')).toBe('highlight');
    });

    it('should clone htmlView', () => {
      component.set('htmlView', '<div class="rendered">Rendered content</div>');

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);
      expect(clonedComp.get('htmlView')).toBe('<div class="rendered">Rendered content</div>');
    });

    it('should clone title, subtitle, instructions, and feedback', () => {
      component.set('title', 'My Title');
      component.set('subtitle', 'My Subtitle');
      component.set('instructions', 'Read carefully');
      component.set('feedback', 'Good job!');

      const cloned = binding.cloneComponent('page-1', 'block-1', 'comp-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedComp = blocks.get(0).get('components').get(1);
      expect(clonedComp.get('title')).toBe('My Title');
      expect(clonedComp.get('subtitle')).toBe('My Subtitle');
      expect(clonedComp.get('instructions')).toBe('Read carefully');
      expect(clonedComp.get('feedback')).toBe('Good job!');
    });
  });

  describe('cloneBlockMap deep cloning', () => {
    let block;

    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();
      block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Original Block',
        order: 0,
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      componentsArray.push([comp]);
      block.set('components', componentsArray);
      blocksArray.push([block]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('should clone block properties Y.Map', () => {
      const props = new Y.Map();
      props.set('allowToggle', true);
      props.set('minimized', false);
      props.set('visibility', 'visible');
      block.set('properties', props);

      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedBlock = blocks.get(1);
      const clonedProps = clonedBlock.get('properties');
      expect(clonedProps).toBeDefined();
      expect(clonedProps.get('allowToggle')).toBe(true);
      expect(clonedProps.get('minimized')).toBe(false);
      expect(clonedProps.get('visibility')).toBe('visible');
    });

    it('should clone iconName and blockType', () => {
      block.set('iconName', 'fa-book');
      block.set('blockType', 'content');

      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned).toBeDefined();
      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedBlock = blocks.get(1);
      expect(clonedBlock.get('iconName')).toBe('fa-book');
      expect(clonedBlock.get('blockType')).toBe('content');
    });

    it('should clone all components with their content', () => {
      // Add content to the component
      const comp = block.get('components').get(0);
      const html = new Y.Text();
      html.insert(0, '<p>Component content</p>');
      comp.set('htmlContent', html);

      const jsonProps = new Y.Map();
      jsonProps.set('answers', ['A', 'B', 'C']);
      comp.set('jsonProperties', jsonProps);

      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned).toBeDefined();
      expect(cloned.componentCount).toBe(1);

      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedBlock = blocks.get(1);
      const clonedComps = clonedBlock.get('components');
      expect(clonedComps.length).toBe(1);

      const clonedComp = clonedComps.get(0);
      expect(clonedComp.get('htmlContent').toString()).toBe('<p>Component content</p>');
      expect(clonedComp.get('jsonProperties').get('answers')).toEqual(['A', 'B', 'C']);
    });

    it('should clone multiple components with different content', () => {
      // Add second component
      const comp2 = createYMap({
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'MultipleChoiceIdevice',
        order: 1,
      });
      const html2 = new Y.Text();
      html2.insert(0, '<p>Second component</p>');
      comp2.set('htmlContent', html2);
      block.get('components').push([comp2]);

      const cloned = binding.cloneBlock('page-1', 'block-1');

      expect(cloned).toBeDefined();
      expect(cloned.componentCount).toBe(2);

      const blocks = mockDocManager.getNavigation().get(0).get('blocks');
      const clonedBlock = blocks.get(1);
      const clonedComps = clonedBlock.get('components');
      expect(clonedComps.length).toBe(2);
      expect(clonedComps.get(0).get('ideviceType')).toBe('FreeTextIdevice');
      expect(clonedComps.get(1).get('ideviceType')).toBe('MultipleChoiceIdevice');
      expect(clonedComps.get(1).get('htmlContent').toString()).toBe('<p>Second component</p>');
    });
  });

  describe('clonePage deep cloning', () => {
    let page;
    let block;
    let component;

    beforeEach(() => {
      page = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Original Page',
      });
      const blocksArray = createYArray();
      block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
        order: 0,
      });

      component = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });

      const componentsArray = createYArray();
      componentsArray.push([component]);
      block.set('components', componentsArray);
      blocksArray.push([block]);
      page.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([page]);
    });

    it('should clone page with all blocks and components content', () => {
      // Add content to component
      const html = new Y.Text();
      html.insert(0, '<h1>Page content</h1>');
      component.set('htmlContent', html);

      const jsonProps = new Y.Map();
      jsonProps.set('options', ['A', 'B', 'C']);
      component.set('jsonProperties', jsonProps);

      // Add block properties
      const blockProps = new Y.Map();
      blockProps.set('allowToggle', true);
      block.set('properties', blockProps);
      block.set('iconName', 'fa-file-text');

      const cloned = binding.clonePage('page-1');

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe('page-1');
      expect(cloned.pageName).toBe('Original Page (copy)');
      expect(cloned.blockCount).toBe(1);

      // Verify cloned content
      const clonedPageMap = cloned._ymap;
      const clonedBlocks = clonedPageMap.get('blocks');
      expect(clonedBlocks.length).toBe(1);

      const clonedBlock = clonedBlocks.get(0);
      expect(clonedBlock.get('iconName')).toBe('fa-file-text');
      expect(clonedBlock.get('properties').get('allowToggle')).toBe(true);

      const clonedComps = clonedBlock.get('components');
      expect(clonedComps.length).toBe(1);

      const clonedComp = clonedComps.get(0);
      expect(clonedComp.get('htmlContent').toString()).toBe('<h1>Page content</h1>');
      expect(clonedComp.get('jsonProperties').get('options')).toEqual(['A', 'B', 'C']);
    });

    it('should clone page with multiple blocks each having multiple components', () => {
      // Add second block with two components
      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
        order: 1,
      });
      block2.set('iconName', 'fa-question');

      const comp2a = createYMap({
        id: 'comp-2a',
        ideviceId: 'comp-2a',
        ideviceType: 'MultipleChoiceIdevice',
        order: 0,
      });
      const html2a = new Y.Text();
      html2a.insert(0, '<p>Question 1</p>');
      comp2a.set('htmlContent', html2a);

      const comp2b = createYMap({
        id: 'comp-2b',
        ideviceId: 'comp-2b',
        ideviceType: 'TrueFalseIdevice',
        order: 1,
      });
      const html2b = new Y.Text();
      html2b.insert(0, '<p>Question 2</p>');
      comp2b.set('htmlContent', html2b);

      const comps2 = createYArray();
      comps2.push([comp2a]);
      comps2.push([comp2b]);
      block2.set('components', comps2);

      page.get('blocks').push([block2]);

      const cloned = binding.clonePage('page-1');

      expect(cloned).toBeDefined();
      expect(cloned.blockCount).toBe(2);

      const clonedPageMap = cloned._ymap;
      const clonedBlocks = clonedPageMap.get('blocks');
      expect(clonedBlocks.length).toBe(2);

      // Verify second block
      const clonedBlock2 = clonedBlocks.get(1);
      expect(clonedBlock2.get('iconName')).toBe('fa-question');

      const clonedComps2 = clonedBlock2.get('components');
      expect(clonedComps2.length).toBe(2);
      expect(clonedComps2.get(0).get('htmlContent').toString()).toBe('<p>Question 1</p>');
      expect(clonedComps2.get(1).get('htmlContent').toString()).toBe('<p>Question 2</p>');
    });
  });

  describe('moveComponentToBlock', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const blocksArray = createYArray();

      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      const components1 = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      components1.push([comp]);
      block1.set('components', components1);

      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
      });
      block2.set('components', createYArray());

      blocksArray.push([block1]);
      blocksArray.push([block2]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('moves component to different block', () => {
      const result = binding.moveComponentToBlock('comp-1', 'block-2');

      expect(result).toBe(true);
      expect(binding.getComponents('page-1', 'block-1')).toHaveLength(0);
      expect(binding.getComponents('page-1', 'block-2')).toHaveLength(1);
    });

    it('returns false for non-existent component', () => {
      const result = binding.moveComponentToBlock('non-existent', 'block-2');
      expect(result).toBe(false);
    });

    it('returns false for non-existent target block', () => {
      const result = binding.moveComponentToBlock('comp-1', 'non-existent');
      expect(result).toBe(false);
    });

    it('handles moving within same block as reorder', () => {
      const result = binding.moveComponentToBlock('comp-1', 'block-1', 0);
      expect(result).toBe(true);
    });

    it('places moved component at end based on max order (not array length)', () => {
      // Add components with non-sequential orders to block-2
      const page = mockDocManager.getNavigation().get(0);
      const blocks = page.get('blocks');
      const block2 = blocks.get(1);
      const comps2 = block2.get('components');
      const existingComp1 = createYMap({ id: 'existing-comp-1', ideviceId: 'existing-comp-1', order: 0 });
      const existingComp2 = createYMap({ id: 'existing-comp-2', ideviceId: 'existing-comp-2', order: 10 }); // Gap
      comps2.push([existingComp1]);
      comps2.push([existingComp2]);

      // Move comp-1 to block-2
      const result = binding.moveComponentToBlock('comp-1', 'block-2');

      expect(result).toBe(true);
      const movedComps = binding.getComponents('page-1', 'block-2');
      expect(movedComps).toHaveLength(3);
      // Moved component should have order 11 (maxOrder 10 + 1)
      const movedComp = movedComps.find((c) => c.id === 'comp-1');
      expect(movedComp.order).toBe(11);
      // Verify sort order places it at the end
      expect(movedComps[2].id).toBe('comp-1');
    });
  });

  describe('moveComponentToPage', () => {
    beforeEach(() => {
      const page1 = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Page 1',
      });
      const blocks1 = createYArray();
      const block1 = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      const components1 = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        order: 0,
      });
      components1.push([comp]);
      block1.set('components', components1);
      blocks1.push([block1]);
      page1.set('blocks', blocks1);

      const page2 = createYMap({
        id: 'page-2',
        pageId: 'page-2',
        pageName: 'Page 2',
      });
      page2.set('blocks', createYArray());

      mockDocManager.getNavigation().push([page1]);
      mockDocManager.getNavigation().push([page2]);
    });

    it('moves component to different page creating new block', () => {
      const result = binding.moveComponentToPage('comp-1', 'page-2');

      expect(result).toBeDefined();
      expect(result.blockId).toBeDefined();
      expect(result.componentId).toBe('comp-1');
    });

    it('returns null for non-existent component', () => {
      const result = binding.moveComponentToPage('non-existent', 'page-2');
      expect(result).toBeNull();
    });

    it('returns null for non-existent target page', () => {
      const result = binding.moveComponentToPage('comp-1', 'non-existent');
      expect(result).toBeNull();
    });

    it('uses custom block name', () => {
      const result = binding.moveComponentToPage('comp-1', 'page-2', 'Custom Block Name');

      expect(result).toBeDefined();
      expect(result.blockId).toBeDefined();
    });

    it('places new block at end based on max order (not array length)', () => {
      // Add blocks with non-sequential orders to page-2
      const page2 = mockDocManager.getNavigation().get(1);
      const blocks2 = page2.get('blocks');
      const existingBlock1 = createYMap({ id: 'existing-1', blockId: 'existing-1', order: 0 });
      const existingBlock2 = createYMap({ id: 'existing-2', blockId: 'existing-2', order: 7 }); // Gap
      existingBlock1.set('components', createYArray());
      existingBlock2.set('components', createYArray());
      blocks2.push([existingBlock1]);
      blocks2.push([existingBlock2]);

      // Move comp-1 to page-2
      const result = binding.moveComponentToPage('comp-1', 'page-2');

      expect(result).toBeDefined();
      const movedBlocks = binding.getBlocks('page-2');
      expect(movedBlocks).toHaveLength(3);
      // New block should have order 8 (maxOrder 7 + 1)
      const newBlock = movedBlocks.find((b) => b.id === result.blockId);
      expect(newBlock.order).toBe(8);
      // Verify sort order places it at the end
      expect(movedBlocks[2].id).toBe(result.blockId);
    });
  });

  // ===== Advanced Page Movement Tests =====

  describe('movePagePrev', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = createYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('swaps with previous sibling', () => {
      const result = binding.movePagePrev('page-2');

      expect(result).toBe(true);
    });

    it('returns false for first sibling', () => {
      const result = binding.movePagePrev('page-1');
      expect(result).toBe(false);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePagePrev('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('movePageNext', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = createYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('swaps with next sibling', () => {
      const result = binding.movePageNext('page-2');

      expect(result).toBe(true);
    });

    it('returns false for last sibling', () => {
      const result = binding.movePageNext('page-3');
      expect(result).toBe(false);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePageNext('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('movePageLeft', () => {
    beforeEach(() => {
      // Parent page
      const parent = createYMap({
        id: 'parent',
        pageId: 'parent',
        pageName: 'Parent',
        order: 0,
        parentId: null,
      });
      parent.set('blocks', createYArray());

      // Child page
      const child = createYMap({
        id: 'child',
        pageId: 'child',
        pageName: 'Child',
        order: 0,
        parentId: 'parent',
      });
      child.set('blocks', createYArray());

      mockDocManager.getNavigation().push([parent]);
      mockDocManager.getNavigation().push([child]);
    });

    it('moves child to grandparent level', () => {
      const result = binding.movePageLeft('child');

      expect(result).toBe(true);
      const page = binding.getPage('child');
      expect(page.parentId).toBeNull();
    });

    it('returns false for root level page', () => {
      const result = binding.movePageLeft('parent');
      expect(result).toBe(false);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePageLeft('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('movePageRight', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = createYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('becomes child of previous sibling', () => {
      const result = binding.movePageRight('page-2');

      expect(result).toBe(true);
      const page = binding.getPage('page-2');
      expect(page.parentId).toBe('page-1');
    });

    it('returns false for first sibling', () => {
      const result = binding.movePageRight('page-1');
      expect(result).toBe(false);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePageRight('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('canMoveLeft', () => {
    beforeEach(() => {
      const parent = createYMap({
        id: 'parent',
        pageId: 'parent',
        pageName: 'Parent',
        order: 0,
        parentId: null,
      });
      parent.set('blocks', createYArray());

      const child = createYMap({
        id: 'child',
        pageId: 'child',
        pageName: 'Child',
        order: 0,
        parentId: 'parent',
      });
      child.set('blocks', createYArray());

      mockDocManager.getNavigation().push([parent]);
      mockDocManager.getNavigation().push([child]);
    });

    it('returns true for child page', () => {
      expect(binding.canMoveLeft('child')).toBe(true);
    });

    it('returns false for root page', () => {
      expect(binding.canMoveLeft('parent')).toBe(false);
    });

    it('returns false for non-existent page', () => {
      expect(binding.canMoveLeft('non-existent')).toBe(false);
    });
  });

  describe('canMoveRight', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2'].forEach((name, i) => {
        const pageMap = createYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('returns true for page with previous sibling', () => {
      expect(binding.canMoveRight('page-2')).toBe(true);
    });

    it('returns false for first page', () => {
      expect(binding.canMoveRight('page-1')).toBe(false);
    });
  });

  describe('movePageToTarget', () => {
    beforeEach(() => {
      ['Page 1', 'Page 2', 'Page 3'].forEach((name, i) => {
        const pageMap = createYMap({
          id: `page-${i + 1}`,
          pageId: `page-${i + 1}`,
          pageName: name,
          order: i,
          parentId: null,
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);
      });
    });

    it('moves page to become sibling of target', () => {
      const result = binding.movePageToTarget('page-1', 'page-3');

      expect(result).toBe(true);
    });

    it('returns false when moving to self', () => {
      const result = binding.movePageToTarget('page-1', 'page-1');
      expect(result).toBe(false);
    });

    it('returns false for non-existent page', () => {
      const result = binding.movePageToTarget('non-existent', 'page-2');
      expect(result).toBe(false);
    });

    it('returns false for non-existent target', () => {
      const result = binding.movePageToTarget('page-1', 'non-existent');
      expect(result).toBe(false);
    });

    it('becomes first child when target has children', () => {
      // Add a child to page-2
      const child = createYMap({
        id: 'child',
        pageId: 'child',
        pageName: 'Child',
        order: 0,
        parentId: 'page-2',
      });
      child.set('blocks', createYArray());
      mockDocManager.getNavigation().push([child]);

      const result = binding.movePageToTarget('page-3', 'page-2');

      expect(result).toBe(true);
      const page = binding.getPage('page-3');
      expect(page.parentId).toBe('page-2');
    });
  });

  describe('isDescendant', () => {
    beforeEach(() => {
      // Create hierarchy: grandparent > parent > child
      const grandparent = createYMap({
        id: 'grandparent',
        pageId: 'grandparent',
        pageName: 'Grandparent',
        order: 0,
        parentId: null,
      });
      grandparent.set('blocks', createYArray());

      const parent = createYMap({
        id: 'parent',
        pageId: 'parent',
        pageName: 'Parent',
        order: 0,
        parentId: 'grandparent',
      });
      parent.set('blocks', createYArray());

      const child = createYMap({
        id: 'child',
        pageId: 'child',
        pageName: 'Child',
        order: 0,
        parentId: 'parent',
      });
      child.set('blocks', createYArray());

      mockDocManager.getNavigation().push([grandparent]);
      mockDocManager.getNavigation().push([parent]);
      mockDocManager.getNavigation().push([child]);
    });

    it('returns true for direct child', () => {
      expect(binding.isDescendant('child', 'parent')).toBe(true);
    });

    it('returns true for grandchild', () => {
      expect(binding.isDescendant('child', 'grandparent')).toBe(true);
    });

    it('returns false for non-descendant', () => {
      expect(binding.isDescendant('grandparent', 'child')).toBe(false);
    });

    it('returns false for same page', () => {
      expect(binding.isDescendant('parent', 'parent')).toBe(false);
    });

    it('returns false for non-existent page', () => {
      expect(binding.isDescendant('non-existent', 'parent')).toBe(false);
    });
  });

  describe('cloneChildPages', () => {
    beforeEach(() => {
      // Parent page
      const parent = createYMap({
        id: 'parent',
        pageId: 'parent',
        pageName: 'Parent',
        order: 0,
        parentId: null,
      });
      parent.set('blocks', createYArray());

      // Child pages
      const child1 = createYMap({
        id: 'child-1',
        pageId: 'child-1',
        pageName: 'Child 1',
        order: 0,
        parentId: 'parent',
      });
      child1.set('blocks', createYArray());

      const child2 = createYMap({
        id: 'child-2',
        pageId: 'child-2',
        pageName: 'Child 2',
        order: 1,
        parentId: 'parent',
      });
      child2.set('blocks', createYArray());

      mockDocManager.getNavigation().push([parent]);
      mockDocManager.getNavigation().push([child1]);
      mockDocManager.getNavigation().push([child2]);
    });

    it('clones child pages with new parent', () => {
      // Clone parent first to have a new parent ID
      const clonedParent = binding.clonePage('parent', 'Cloned Parent');

      // cloneChildPages is called internally by clonePage
      // Verify the original structure
      const pages = binding.getPages();
      expect(pages.length).toBeGreaterThan(3);
    });

    it('handles page with no children', () => {
      // child-1 has no children
      binding.cloneChildPages('child-1', 'new-parent-id');

      // Should not throw and navigation should be unchanged
      const pages = binding.getPages();
      expect(pages).toHaveLength(3);
    });
  });

  // ===== Import & Properties Tests =====

  describe('importFromApiStructure', () => {
    it('imports valid API structure', () => {
      const apiStructure = [
        {
          id: 1,
          pageId: 'page-1',
          pageName: 'Test Page',
          parent: null,
          order: 0,
          odePagStructureSyncs: [],
        },
      ];

      binding.importFromApiStructure(apiStructure);

      const pages = binding.getPages();
      expect(pages).toHaveLength(1);
      expect(pages[0].pageName).toBe('Test Page');
    });

    it('clears existing navigation before import', () => {
      // Add existing page
      binding.createPage('Existing Page');
      expect(binding.getPages()).toHaveLength(1);

      // Import new structure
      const apiStructure = [
        {
          pageId: 'new-page',
          pageName: 'New Page',
          parent: null,
          order: 0,
          odePagStructureSyncs: [],
        },
      ];

      binding.importFromApiStructure(apiStructure);

      const pages = binding.getPages();
      expect(pages).toHaveLength(1);
      expect(pages[0].pageName).toBe('New Page');
    });

    it('handles null/undefined structure', () => {
      binding.importFromApiStructure(null);
      expect(binding.getPages()).toHaveLength(0);

      binding.importFromApiStructure(undefined);
      expect(binding.getPages()).toHaveLength(0);
    });

    it('imports pages with blocks and components', () => {
      const apiStructure = [
        {
          pageId: 'page-1',
          pageName: 'Page 1',
          parent: null,
          order: 0,
          odePagStructureSyncs: [
            {
              blockId: 'block-1',
              blockName: 'Block 1',
              order: 0,
              odeComponentsSyncs: [
                {
                  odeIdeviceId: 'comp-1',
                  odeIdeviceTypeName: 'FreeTextIdevice',
                  htmlView: '<p>Hello</p>',
                  order: 0,
                },
              ],
            },
          ],
        },
      ];

      binding.importFromApiStructure(apiStructure);

      const pages = binding.getPages();
      expect(pages).toHaveLength(1);

      const blocks = binding.getBlocks('page-1');
      expect(blocks).toHaveLength(1);

      const components = binding.getComponents('page-1', 'block-1');
      expect(components).toHaveLength(1);
    });

    it('handles root parent correctly', () => {
      const apiStructure = [
        {
          pageId: 'page-1',
          pageName: 'Root Page',
          parent: 'root',
          order: 0,
          odePagStructureSyncs: [],
        },
      ];

      binding.importFromApiStructure(apiStructure);

      const page = binding.getPage('page-1');
      expect(page.parentId).toBeNull();
    });
  });

  describe('clearNavigation', () => {
    it('clears all pages from navigation', () => {
      binding.createPage('Page 1');
      binding.createPage('Page 2');
      expect(binding.getPages()).toHaveLength(2);

      binding.clearNavigation();

      expect(binding.getPages()).toHaveLength(0);
    });

    it('handles empty navigation', () => {
      binding.clearNavigation();
      expect(binding.getPages()).toHaveLength(0);
    });
  });

  describe('createBlockMapFromApi', () => {
    it('creates block with properties', () => {
      const apiBlock = {
        blockId: 'block-1',
        blockName: 'Test Block',
        blockType: 'custom',
        order: 1,
        odePagStructureSyncProperties: {
          visibility: { value: true },
          teacherOnly: { value: false },
        },
        odeComponentsSyncs: [],
      };

      const blockMap = binding.createBlockMapFromApi(apiBlock);
      integrateYType(blockMap);

      expect(blockMap.get('id')).toBe('block-1');
      expect(blockMap.get('blockName')).toBe('Test Block');
      expect(blockMap.get('blockType')).toBe('custom');
    });

    it('handles empty block name', () => {
      const apiBlock = {
        blockId: 'block-1',
        blockName: '',
        order: 0,
        odeComponentsSyncs: [],
      };

      const blockMap = binding.createBlockMapFromApi(apiBlock);
      integrateYType(blockMap);

      expect(blockMap.get('blockName')).toBe('');
    });
  });

  describe('getPageProperties', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      const propsMap = createYMap({
        hidePageTitle: true,
        customProp: 'value',
      });
      pageMap.set('properties', propsMap);
      pageMap.set('blocks', createYArray());
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('returns page properties', () => {
      const props = binding.getPageProperties('page-1');

      expect(props).toBeDefined();
      expect(props.hidePageTitle).toBe(true);
      expect(props.customProp).toBe('value');
    });

    it('includes pageName as titleNode fallback', () => {
      const props = binding.getPageProperties('page-1');

      expect(props.titleNode).toBe('Test Page');
    });

    it('returns null for non-existent page', () => {
      const props = binding.getPageProperties('non-existent');
      expect(props).toBeNull();
    });
  });

  describe('getBlockProperties', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });
      const propsMap = createYMap({
        visibility: true,
        teacherOnly: false,
      });
      block.set('properties', propsMap);
      block.set('components', createYArray());
      blocksArray.push([block]);

      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('returns block properties', () => {
      const props = binding.getBlockProperties('block-1');

      expect(props).toBeDefined();
      expect(props.visibility).toBe(true);
      expect(props.teacherOnly).toBe(false);
    });

    it('returns null for non-existent block', () => {
      const props = binding.getBlockProperties('non-existent');
      expect(props).toBeNull();
    });

    it('returns empty object when no properties', () => {
      // Create a block without properties
      const pageMap = mockDocManager.getNavigation().get(0);
      const blocks = pageMap.get('blocks');
      const block2 = createYMap({
        id: 'block-2',
        blockId: 'block-2',
        blockName: 'Block 2',
      });
      block2.set('components', createYArray());
      blocks.push([block2]);

      const props = binding.getBlockProperties('block-2');
      expect(props).toEqual({});
    });
  });

  describe('getComponentProperties', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });

      const blocksArray = createYArray();
      const block = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block 1',
      });

      const componentsArray = createYArray();
      const comp = createYMap({
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
      });
      const propsMap = createYMap({
        visibility: true,
        customField: 'test',
      });
      comp.set('properties', propsMap);
      componentsArray.push([comp]);

      block.set('components', componentsArray);
      blocksArray.push([block]);
      pageMap.set('blocks', blocksArray);
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('returns component properties', () => {
      const props = binding.getComponentProperties('comp-1');

      expect(props).toBeDefined();
      expect(props.visibility).toBe(true);
      expect(props.customField).toBe('test');
    });

    it('returns null for non-existent component', () => {
      const props = binding.getComponentProperties('non-existent');
      expect(props).toBeNull();
    });
  });

  describe('updatePageProperties', () => {
    beforeEach(() => {
      const pageMap = createYMap({
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
      });
      pageMap.set('blocks', createYArray());
      mockDocManager.getNavigation().push([pageMap]);
    });

    it('updates page properties', () => {
      const result = binding.updatePageProperties('page-1', {
        customProp: 'value',
      });

      expect(result).toBe(true);
    });

    it('converts checkbox values to boolean', () => {
      const result = binding.updatePageProperties('page-1', {
        hidePageTitle: 'true',
        visibility: '1',
        editableInPage: true,
      });

      expect(result).toBe(true);
    });

    it('returns false for non-existent page', () => {
      const result = binding.updatePageProperties('non-existent', {
        prop: 'value',
      });
      expect(result).toBe(false);
    });
  });

  describe('mapToBlock', () => {
    it('maps Y.Map to block object', () => {
      const blockMap = createYMap({
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Test Block',
        iconName: 'icon-test',
        blockType: 'custom',
        order: 2,
        createdAt: '2024-01-01',
      });
      blockMap.set('components', createYArray());
      integrateYType(blockMap);

      const block = binding.mapToBlock(blockMap, 0);

      expect(block.id).toBe('block-1');
      expect(block.blockName).toBe('Test Block');
      expect(block.iconName).toBe('icon-test');
      expect(block.blockType).toBe('custom');
      expect(block.order).toBe(2);
      expect(block.componentCount).toBe(0);
    });

    it('uses index as fallback for order', () => {
      const blockMap = createYMap({
        id: 'block-1',
        blockName: 'Test Block',
      });
      blockMap.set('components', createYArray());
      integrateYType(blockMap);

      const block = binding.mapToBlock(blockMap, 5);

      expect(block.order).toBe(5);
    });
  });

  // ===== Observers & Edge Cases Tests =====

  describe('onBlocksComponentsChange', () => {
    it('registers callback for block/component changes', () => {
      const callback = mock(() => undefined);

      binding.onBlocksComponentsChange(callback);

      expect(binding.blocksComponentsCallbacks).toContain(callback);
    });

    it('does not add duplicate observer', () => {
      const callback1 = mock(() => undefined);
      const callback2 = mock(() => undefined);

      binding.onBlocksComponentsChange(callback1);
      binding.onBlocksComponentsChange(callback2);

      // Both callbacks should be registered
      expect(binding.blocksComponentsCallbacks).toHaveLength(2);
      // But observer should only be set once
      expect(binding._blocksComponentsObserverSet).toBe(true);
    });
  });

  describe('edge cases', () => {
    describe('null navigation handling', () => {
      it('getBlocks returns empty array when page has no blocks property', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        // Don't set blocks property
        mockDocManager.getNavigation().push([pageMap]);

        const blocks = binding.getBlocks('page-1');
        expect(blocks).toEqual([]);
      });

      it('getComponents returns empty array when block has no components', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        const blocksArray = createYArray();
        const block = createYMap({
          id: 'block-1',
          blockId: 'block-1',
          blockName: 'Block 1',
        });
        // Don't set components property
        blocksArray.push([block]);
        pageMap.set('blocks', blocksArray);
        mockDocManager.getNavigation().push([pageMap]);

        const components = binding.getComponents('page-1', 'block-1');
        expect(components).toEqual([]);
      });
    });

    describe('empty structures', () => {
      it('handles page with empty blocks array', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);

        expect(binding.getBlocks('page-1')).toEqual([]);
        expect(binding.getPage('page-1').blockCount).toBe(0);
      });

      it('handles block with empty components array', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        const blocksArray = createYArray();
        const block = createYMap({
          id: 'block-1',
          blockId: 'block-1',
          blockName: 'Block 1',
        });
        block.set('components', createYArray());
        blocksArray.push([block]);
        pageMap.set('blocks', blocksArray);
        mockDocManager.getNavigation().push([pageMap]);

        const blocks = binding.getBlocks('page-1');
        expect(blocks[0].componentCount).toBe(0);
      });
    });

    describe('Y.Text handling', () => {
      it('mapToComponent handles Y.Text htmlContent', () => {
        const compMap = createYMap({
          id: 'comp-1',
          ideviceId: 'comp-1',
          ideviceType: 'FreeTextIdevice',
          order: 0,
        });
        compMap.set('htmlContent', createYText('<p>Test Content</p>'));
        integrateYType(compMap);

        const component = binding.mapToComponent(compMap, 0);

        expect(component.htmlContent).toBe('<p>Test Content</p>');
      });

      it('mapToComponent handles null htmlContent', () => {
        const compMap = createYMap({
          id: 'comp-1',
          ideviceId: 'comp-1',
          ideviceType: 'FreeTextIdevice',
          order: 0,
        });
        // Don't set htmlContent
        integrateYType(compMap);

        const component = binding.mapToComponent(compMap, 0);

        expect(component.htmlContent).toBe('');
      });

      it('mapToComponent handles string htmlContent', () => {
        const compMap = createYMap({
          id: 'comp-1',
          ideviceId: 'comp-1',
          ideviceType: 'FreeTextIdevice',
          order: 0,
          htmlContent: '<p>Direct string content</p>',
        });
        integrateYType(compMap);

        const component = binding.mapToComponent(compMap, 0);

        expect(component.htmlContent).toBe('<p>Direct string content</p>');
      });
    });

    describe('getPageMap and getBlockMap', () => {
      it('getPageMap returns null for non-existent page', () => {
        const pageMap = binding.getPageMap('non-existent');
        expect(pageMap).toBeNull();
      });

      it('getBlockMap returns null for non-existent page', () => {
        const blockMap = binding.getBlockMap('non-existent', 'block-1');
        expect(blockMap).toBeNull();
      });

      it('getBlockMap returns null for non-existent block', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        pageMap.set('blocks', createYArray());
        mockDocManager.getNavigation().push([pageMap]);

        const blockMap = binding.getBlockMap('page-1', 'non-existent');
        expect(blockMap).toBeNull();
      });
    });

    describe('getComponentMap', () => {
      it('returns null for non-existent component', () => {
        const compMap = binding.getComponentMap('non-existent');
        expect(compMap).toBeNull();
      });

      it('searches through all pages and blocks', () => {
        const pageMap = createYMap({
          id: 'page-1',
          pageId: 'page-1',
          pageName: 'Test Page',
        });
        const blocksArray = createYArray();
        const block = createYMap({
          id: 'block-1',
          blockId: 'block-1',
          blockName: 'Block 1',
        });
        const componentsArray = createYArray();
        const comp = createYMap({
          id: 'comp-1',
          ideviceId: 'comp-1',
          ideviceType: 'FreeTextIdevice',
        });
        componentsArray.push([comp]);
        block.set('components', componentsArray);
        blocksArray.push([block]);
        pageMap.set('blocks', blocksArray);
        mockDocManager.getNavigation().push([pageMap]);

        const compMap = binding.getComponentMap('comp-1');
        expect(compMap).toBeDefined();
        expect(compMap.get('id')).toBe('comp-1');
      });
    });

    describe('createPageMapFromApi', () => {
      it('handles page with properties', () => {
        const apiPage = {
          pageId: 'page-1',
          pageName: 'Test Page',
          parent: null,
          order: 0,
          odeNavStructureSyncProperties: {
            hidePageTitle: { value: true },
            customProp: { value: 'test' },
          },
          odePagStructureSyncs: [],
        };

        const pageMap = binding.createPageMapFromApi(apiPage);
        integrateYType(pageMap);

        const props = pageMap.get('properties');
        expect(props).toBeDefined();
        expect(props.get('hidePageTitle')).toBe(true);
        expect(props.get('customProp')).toBe('test');
      });

      it('generates ID when not provided', () => {
        const apiPage = {
          pageName: 'Test Page',
          parent: null,
          order: 0,
          odePagStructureSyncs: [],
        };

        const pageMap = binding.createPageMapFromApi(apiPage);
        integrateYType(pageMap);

        expect(pageMap.get('id')).toBeDefined();
        expect(pageMap.get('id')).toContain('page');
      });
    });
  });

  describe('mapToComponent media type handling', () => {
    let compMap;

    beforeEach(() => {
      compMap = new Y.Map();
      integrateYType(compMap);
      compMap.set('id', 'idevice-1');
      compMap.set('ideviceId', 'idevice-1');
      compMap.set('ideviceType', 'udl-content');
      compMap.set('order', 0);
    });

    afterEach(() => {
      delete window.addMediaTypes;
      delete window.resolveAssetUrls;
    });

    it('calls addMediaTypes before resolveAssetUrls for audio content', () => {
      const callOrder = [];

      window.addMediaTypes = vi.fn((html) => {
        callOrder.push('addMediaTypes');
        return html.replace('<audio', '<audio type="audio/webm"');
      });

      window.resolveAssetUrls = vi.fn((html) => {
        callOrder.push('resolveAssetUrls');
        return html.replace('asset://', 'blob://');
      });

      compMap.set('htmlView', '<audio src="asset://uuid/audio.webm"></audio>');

      const result = binding.mapToComponent(compMap, 0);

      expect(callOrder).toEqual(['addMediaTypes', 'resolveAssetUrls']);
      expect(window.addMediaTypes).toHaveBeenCalled();
      expect(window.resolveAssetUrls).toHaveBeenCalled();
    });

    it('calls addMediaTypes for video content', () => {
      window.addMediaTypes = vi.fn((html) => html);
      window.resolveAssetUrls = vi.fn((html) => html);

      compMap.set('htmlView', '<video src="asset://uuid/video.mp4"></video>');

      binding.mapToComponent(compMap, 0);

      expect(window.addMediaTypes).toHaveBeenCalled();
    });

    it('does not call addMediaTypes when no audio or video present', () => {
      window.addMediaTypes = vi.fn((html) => html);
      window.resolveAssetUrls = vi.fn((html) => html);

      compMap.set('htmlView', '<p>No media content</p>');

      binding.mapToComponent(compMap, 0);

      expect(window.addMediaTypes).not.toHaveBeenCalled();
    });

    it('still resolves asset URLs when addMediaTypes is not available', () => {
      window.resolveAssetUrls = vi.fn((html) => html.replace('asset://', 'blob://'));

      compMap.set('htmlView', '<audio src="asset://uuid/audio.webm"></audio>');

      const result = binding.mapToComponent(compMap, 0);

      expect(result.htmlContent).toContain('blob://');
    });

    it('type attribute is added before URL resolution', () => {
      // Simulates the fix: addMediaTypes extracts extension from asset:// URL
      // before resolveAssetUrls converts it to blob:// (losing the extension)
      window.addMediaTypes = vi.fn((html) => {
        // Can extract .webm extension from asset:// URL
        if (html.includes('asset://') && html.includes('.webm')) {
          return html.replace('<audio', '<audio type="audio/webm"');
        }
        return html;
      });

      window.resolveAssetUrls = vi.fn((html) => {
        // After this, extension info is lost
        return html.replace(/asset:\/\/[^"]+\.webm/g, 'blob://test-blob-url');
      });

      compMap.set('htmlView', '<audio src="asset://uuid/audio.webm" class="mediaelement"></audio>');

      const result = binding.mapToComponent(compMap, 0);

      // Type should be present because addMediaTypes ran before resolveAssetUrls
      expect(result.htmlContent).toContain('type="audio/webm"');
      expect(result.htmlContent).toContain('blob://');
    });

    it('does not call addMediaTypes when htmlContent is empty', () => {
      window.addMediaTypes = vi.fn((html) => html);
      window.resolveAssetUrls = vi.fn((html) => html);

      compMap.set('htmlView', '');

      binding.mapToComponent(compMap, 0);

      // Should not call addMediaTypes for empty content
      expect(window.addMediaTypes).not.toHaveBeenCalled();
    });

    it('does not call addMediaTypes when htmlContent is null', () => {
      window.addMediaTypes = vi.fn((html) => html);
      window.resolveAssetUrls = vi.fn((html) => html);

      compMap.set('htmlView', null);

      binding.mapToComponent(compMap, 0);

      // Should not call addMediaTypes for null content
      expect(window.addMediaTypes).not.toHaveBeenCalled();
    });

    it('handles content with both audio and video elements', () => {
      window.addMediaTypes = vi.fn((html) => html);
      window.resolveAssetUrls = vi.fn((html) => html);

      compMap.set('htmlView', '<audio src="asset://uuid/audio.mp3"></audio><video src="asset://uuid/video.mp4"></video>');

      binding.mapToComponent(compMap, 0);

      // Should call addMediaTypes since it has both audio and video
      expect(window.addMediaTypes).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Regression #1665: block reorder via arrow buttons loses order.
  // updateBlockOrder() must keep the page's blocks Y.Array in a stable,
  // deterministic order under repeated moves. Each block must appear
  // exactly once, the array index must equal the `order` field, and the
  // logical order produced by a sequence of moves must match what a
  // reference implementation would produce.
  // ----------------------------------------------------------------
  describe('updateBlockOrder regression #1665', () => {
    // Build a page with `count` blocks, ids "b0".."b(count-1)", and push
    // it into navigation. Returns the {pageId, blocks Y.Array}.
    function seedPageWithBlocks(count) {
      const pageMap = createYMap({ id: 'page-1', pageId: 'page-1', pageName: 'P', order: 0 });
      const blocks = createYArray();
      for (let i = 0; i < count; i++) {
        const b = createYMap({ id: `b${i}`, blockId: `b${i}`, order: i });
        blocks.push([b]);
      }
      pageMap.set('blocks', blocks);
      const navigation = mockDocManager.getNavigation();
      navigation.push([pageMap]);
      return { pageMap, blocks };
    }

    function readBlockIds(blocks) {
      const ids = [];
      for (let i = 0; i < blocks.length; i++) ids.push(blocks.get(i).get('id'));
      return ids;
    }

    function readBlockOrders(blocks) {
      const orders = [];
      for (let i = 0; i < blocks.length; i++) orders.push(blocks.get(i).get('order'));
      return orders;
    }

    it('moving a block from index 0 to index 2 produces the expected order', () => {
      const { blocks } = seedPageWithBlocks(5); // [b0, b1, b2, b3, b4]

      // Mirrors what addBehaviourButtonMoveDownBlock() asks for: place b0
      // at the position currently occupied by b2 -> [b1, b2, b0, b3, b4].
      const ok = binding.updateBlockOrder('b0', 2);

      expect(ok).toBe(true);
      expect(blocks.length).toBe(5);
      expect(readBlockIds(blocks)).toEqual(['b1', 'b2', 'b0', 'b3', 'b4']);
    });

    it('moving a block from index 4 to index 1 produces the expected order', () => {
      const { blocks } = seedPageWithBlocks(5); // [b0, b1, b2, b3, b4]

      const ok = binding.updateBlockOrder('b4', 1);

      expect(ok).toBe(true);
      expect(blocks.length).toBe(5);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b4', 'b1', 'b2', 'b3']);
    });

    it('after every reorder, every block id must appear exactly once', () => {
      const { blocks } = seedPageWithBlocks(6);

      binding.updateBlockOrder('b0', 5);
      binding.updateBlockOrder('b3', 0);
      binding.updateBlockOrder('b5', 2);

      const ids = readBlockIds(blocks);
      expect(blocks.length).toBe(6);
      expect(new Set(ids).size).toBe(6); // no duplicates
      expect(ids.sort()).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5']); // no losses
    });

    it('after every reorder, the `order` field must equal the array index', () => {
      const { blocks } = seedPageWithBlocks(5);

      binding.updateBlockOrder('b1', 3);
      binding.updateBlockOrder('b4', 0);
      binding.updateBlockOrder('b2', 4);

      const orders = readBlockOrders(blocks);
      expect(orders).toEqual([0, 1, 2, 3, 4]);
    });

    it('a long sequence of arrow moves matches a reference array implementation', () => {
      const N = 6;
      const { blocks } = seedPageWithBlocks(N); // [b0..b5]

      // Reference: a plain JS array kept in lockstep with the same moves.
      const reference = Array.from({ length: N }, (_, i) => `b${i}`);

      // Sequence of (blockId, newIndex) moves chosen to exercise both
      // upward and downward shifts and adjacent swaps.
      const sequence = [
        ['b0', 5], // move b0 from front to back
        ['b3', 0], // pull b3 to the front
        ['b5', 2], // mid swap
        ['b1', 4], // forward shift
        ['b2', 1], // backward shift
        ['b0', 0], // bring b0 to the front again
      ];

      for (const [blockId, newOrder] of sequence) {
        const fromIdx = reference.indexOf(blockId);
        if (fromIdx === -1) throw new Error(`reference: ${blockId} missing`);
        reference.splice(fromIdx, 1);
        const insertAt = Math.min(Math.max(0, newOrder), reference.length);
        reference.splice(insertAt, 0, blockId);

        const ok = binding.updateBlockOrder(blockId, newOrder);
        expect(ok).toBe(true);
      }

      expect(blocks.length).toBe(N);
      expect(readBlockIds(blocks)).toEqual(reference);
      // And `order` field is in sync with the array.
      expect(readBlockOrders(blocks)).toEqual(reference.map((_, i) => i));
    });

    it('moving down by one (the arrow-down case) places the block right after its neighbour', () => {
      const { blocks } = seedPageWithBlocks(4); // [b0, b1, b2, b3]

      // Click "move down" on b1: it should swap with b2 -> [b0, b2, b1, b3].
      // The click handler in blockNode.js computes its `this.order` from
      // the DOM by reading the next sibling's order (=2) and calls
      // updateBlockOrder('b1', 2).
      const ok = binding.updateBlockOrder('b1', 2);

      expect(ok).toBe(true);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b2', 'b1', 'b3']);
    });

    it('moving up by one (the arrow-up case) places the block right before its neighbour', () => {
      const { blocks } = seedPageWithBlocks(4); // [b0, b1, b2, b3]

      // Click "move up" on b2: should swap with b1 -> [b0, b2, b1, b3].
      // The click handler in blockNode.js asks for newOrder = previous
      // sibling's order = 1.
      const ok = binding.updateBlockOrder('b2', 1);

      expect(ok).toBe(true);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b2', 'b1', 'b3']);
    });

    // ----------------------------------------------------------------
    // Fix for #1665. The bug was NOT in updateBlockOrder() in isolation —
    // the unit tests above pass — but in how the click handler in
    // blockNode.js fed the `newOrder`. The handler kept a per-instance
    // `this.order` field and did `this.order++` / `this.order--` on every
    // arrow click. After a single reorder, the JS instances of the OTHER
    // blocks on the same page still held their pre-move `order` values,
    // because nothing reconciled them with the Y.Doc. The next click on a
    // neighbour fed updateBlockOrder a target index computed from that
    // stale snapshot and the blocks "jumped" positions.
    //
    // The fix is `moveBlockRelative(blockId, delta)`: it reads the block's
    // current index directly from the Y.Doc (the source of truth) and
    // applies the delta from there. Per-instance counters become
    // irrelevant. These tests exercise it the way blockNode.js does.
    // ----------------------------------------------------------------
    it('moveBlockRelative fixes #1665: consecutive "move down" clicks on different blocks', () => {
      const { blocks } = seedPageWithBlocks(3); // [b0, b1, b2]

      // Click "move down" on b0 -> [b1, b0, b2].
      binding.moveBlockRelative('b0', +1);
      expect(readBlockIds(blocks)).toEqual(['b1', 'b0', 'b2']);

      // Click "move down" on b1. b1 is now physically at index 0; the
      // binding reads that fresh from the Y.Doc and slides it ONE slot.
      // Final order: [b0, b1, b2].
      binding.moveBlockRelative('b1', +1);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);
    });

    it('moveBlockRelative fixes #1665: consecutive "move up" clicks', () => {
      const { blocks } = seedPageWithBlocks(3); // [b0, b1, b2]

      binding.moveBlockRelative('b2', -1);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b2', 'b1']);

      binding.moveBlockRelative('b1', -1);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);
    });

    it('moveBlockRelative fixes #1665: alternating arrow clicks match the reference order', () => {
      const N = 5;
      const { blocks } = seedPageWithBlocks(N); // [b0, b1, b2, b3, b4]

      // Reference: a plain JS array advanced by the SAME intended moves.
      // Each click is a single-slot neighbour swap.
      const reference = Array.from({ length: N }, (_, i) => `b${i}`);

      function refMoveDown(id) {
        const i = reference.indexOf(id);
        if (i < 0 || i === reference.length - 1) return;
        [reference[i], reference[i + 1]] = [reference[i + 1], reference[i]];
      }
      function refMoveUp(id) {
        const i = reference.indexOf(id);
        if (i <= 0) return;
        [reference[i], reference[i - 1]] = [reference[i - 1], reference[i]];
      }

      const clicks = [
        ['b0', 'down'],
        ['b2', 'up'],
        ['b3', 'down'],
        ['b1', 'up'],
        ['b4', 'up'],
      ];

      for (const [id, dir] of clicks) {
        if (dir === 'down') {
          refMoveDown(id);
          binding.moveBlockRelative(id, +1);
        } else {
          refMoveUp(id);
          binding.moveBlockRelative(id, -1);
        }
      }

      expect(blocks.length).toBe(N);
      expect(new Set(readBlockIds(blocks)).size).toBe(N);
      expect(readBlockIds(blocks)).toEqual(reference);
      // And the `order` field stays in sync with the array index.
      expect(readBlockOrders(blocks)).toEqual(reference.map((_, i) => i));
    });

    it('moveBlockRelative is a no-op at the array edges', () => {
      const { blocks } = seedPageWithBlocks(3); // [b0, b1, b2]

      // Try to move b0 up at the top edge: must not change anything.
      const r1 = binding.moveBlockRelative('b0', -1);
      expect(r1).toBe(false);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);

      // Try to move b2 down at the bottom edge: must not change anything.
      const r2 = binding.moveBlockRelative('b2', +1);
      expect(r2).toBe(false);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);
    });

    it('moveBlockRelative clamps larger deltas into the valid range', () => {
      const { blocks } = seedPageWithBlocks(3); // [b0, b1, b2]

      // delta=+10 from index 0 lands at the last index (2).
      binding.moveBlockRelative('b0', +10);
      expect(readBlockIds(blocks)).toEqual(['b1', 'b2', 'b0']);

      // delta=-10 from index 2 lands back at index 0.
      binding.moveBlockRelative('b0', -10);
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);
    });

    it('moveBlockRelative returns false when the block does not exist', () => {
      seedPageWithBlocks(3);
      expect(binding.moveBlockRelative('does-not-exist', +1)).toBe(false);
    });

    it('moveBlockRelative rejects delta=0 and non-finite deltas without touching the array', () => {
      const { blocks } = seedPageWithBlocks(3);
      expect(binding.moveBlockRelative('b1', 0)).toBe(false);
      expect(binding.moveBlockRelative('b1', NaN)).toBe(false);
      expect(binding.moveBlockRelative('b1', Infinity)).toBe(false);
      expect(binding.moveBlockRelative('b1', -Infinity)).toBe(false);
      // Array unchanged.
      expect(readBlockIds(blocks)).toEqual(['b0', 'b1', 'b2']);
    });

    it('findBlockLocation returns the page and the index of an existing block', () => {
      const { blocks } = seedPageWithBlocks(3);
      const loc = binding.findBlockLocation('b1');
      expect(loc).not.toBeNull();
      expect(loc.index).toBe(1);
      expect(loc.blocks).toBe(blocks);
    });

    it('findBlockLocation returns null when the block does not exist', () => {
      seedPageWithBlocks(3);
      expect(binding.findBlockLocation('does-not-exist')).toBeNull();
    });
  });
});
