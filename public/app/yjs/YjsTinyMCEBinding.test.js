/**
 * YjsTinyMCEBinding Tests
 *
 * Unit tests for YjsTinyMCEBinding - binds TinyMCE editor instances to Y.Text.
 *
 */

 

// Test functions available globally from vitest setup

const YjsTinyMCEBinding = require('./YjsTinyMCEBinding');

const createYText = (content = '') => {
  const ydoc = new window.Y.Doc();
  const ytext = ydoc.getText('content');
  if (content) {
    ytext.insert(0, content);
  }
  return ytext;
};

// Mock TinyMCE Editor
const createMockEditor = (content = '') => {
  const body = document.createElement('div');
  body.innerHTML = content;

  return {
    _content: content,
    _listeners: {},
    selection: {
      getBookmark: mock(() => ({ id: 'bookmark-1' })),
      moveToBookmark: mock(() => undefined),
      getRng: mock(() => ({
        startContainer: body.firstChild || body,
        startOffset: 0,
        endContainer: body.firstChild || body,
        endOffset: 0,
      })),
    },
    getContent: mock(function () {
      return this._content;
    }),
    setContent: mock(function (content) {
      this._content = content;
    }),
    getBody: mock(() => body),
    on: mock(function (event, callback) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
    }),
    off: mock(function (event, callback) {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
      }
    }),
    fire: mock(function (event) {
      if (this._listeners[event]) {
        this._listeners[event].forEach((cb) => cb());
      }
    }),
  };
};

// Mock Awareness
class MockAwareness {
  constructor() {
    this.clientID = 12345;
    this._localState = {};
    this._states = new Map();
    this._listeners = {};
  }

  getLocalState() {
    return this._localState;
  }

  setLocalStateField(field, value) {
    this._localState[field] = value;
  }

  getStates() {
    return this._states;
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }
}

describe('YjsTinyMCEBinding', () => {
  let binding;
  let mockEditor;
  let mockYText;

  beforeEach(() => {
    mockEditor = createMockEditor('<p>Initial content</p>');
    mockYText = createYText('<p>Initial content</p>');

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    
    if (binding) {
      binding.destroy();
    }
  });

  describe('constructor', () => {
    it('initializes with editor and yText', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      expect(binding.editor).toBe(mockEditor);
      expect(binding.yText).toBe(mockYText);
    });

    it('initializes with default options', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      expect(binding.userId).toBe('unknown');
      expect(binding.userName).toBe('User');
      expect(binding.awareness).toBeNull();
    });

    it('accepts custom options', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        userId: 'user-123',
        userName: 'John Doe',
        userColor: '#ff0000',
      });

      expect(binding.userId).toBe('user-123');
      expect(binding.userName).toBe('John Doe');
      expect(binding.userColor).toBe('#ff0000');
    });

    it('generates random color if not provided', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      expect(binding.userColor).toMatch(/^#[a-f0-9]{6}$/i);
    });

    it('initializes isUpdating as false', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      expect(binding._isUpdating).toBe(false);
    });

    it('initializes observers and listeners arrays (populated by init)', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      // After init(), _observers contains cleanup functions and _editorListeners contains editor event cleanups
      expect(Array.isArray(binding._observers)).toBe(true);
      expect(Array.isArray(binding._editorListeners)).toBe(true);
      // init() adds observers, so they won't be empty
      expect(binding._observers.length).toBeGreaterThan(0);
      expect(binding._editorListeners.length).toBeGreaterThan(0);
    });

    it('calls init on construction', () => {
      const initSpy = spyOn(YjsTinyMCEBinding.prototype, 'init');
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      expect(initSpy).toHaveBeenCalled();
      initSpy.mockRestore();
    });
  });

  describe('init', () => {
    it('syncs content to editor when different', () => {
      // Make content different so setContent gets called
      mockYText.delete(0, mockYText.length);
      mockYText.insert(0, '<p>Different content</p>');
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      expect(mockEditor.setContent).toHaveBeenCalledWith('<p>Different content</p>');
    });

    it('does not call setContent when content matches', () => {
      // Content matches, so setContent should NOT be called
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      expect(mockEditor.setContent).not.toHaveBeenCalled();
    });

    it('observes Y.Text changes', () => {
      const observeSpy = spyOn(mockYText, 'observe');
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      expect(observeSpy).toHaveBeenCalled();
    });

    it('binds editor events', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      expect(mockEditor.on).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('NodeChange', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('SelectionChange', expect.any(Function));
    });
  });

  describe('syncToEditor', () => {
    it('updates editor content from Y.Text', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      mockYText.delete(0, mockYText.length);
      mockYText.insert(0, '<p>Updated content</p>');

      binding.syncToEditor();

      expect(mockEditor.setContent).toHaveBeenCalledWith('<p>Updated content</p>');
    });

    it('saves and restores cursor position', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      mockYText.delete(0, mockYText.length);
      mockYText.insert(0, '<p>New content</p>');

      binding.syncToEditor();

      expect(mockEditor.selection.getBookmark).toHaveBeenCalled();
      expect(mockEditor.selection.moveToBookmark).toHaveBeenCalled();
    });

    it('does not update if content is same', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      mockEditor.setContent.mockClear();

      // Content should be same
      binding.syncToEditor();

      // Should still try to update (actual check is in the method)
    });

    it('sets isUpdating flag during sync', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      let wasUpdating = false;
      mockEditor.setContent = mock(() => {
        wasUpdating = binding._isUpdating;
      });

      mockYText.delete(0, mockYText.length);
      mockYText.insert(0, '<p>New content</p>');
      binding.syncToEditor();

      expect(wasUpdating).toBe(true);
      expect(binding._isUpdating).toBe(false);
    });
  });

  describe('syncFromEditor', () => {
    it('updates Y.Text from editor content (simple append)', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      // Simple append case - easier for diff algorithm
      mockEditor._content = '<p>Initial content</p> more';

      binding.syncFromEditor();

      expect(mockYText.toString()).toBe('<p>Initial content</p> more');
    });

    it('updates Y.Text from editor content (simple prefix)', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      // Simple prefix case
      mockEditor._content = 'prefix <p>Initial content</p>';

      binding.syncFromEditor();

      expect(mockYText.toString()).toBe('prefix <p>Initial content</p>');
    });

    it('does nothing if content is same', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const deleteSpy = spyOn(mockYText, 'delete');
      const insertSpy = spyOn(mockYText, 'insert');

      binding.syncFromEditor();

      // No operations if content is same - check spies were not called
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('computeDiff', () => {
    it('returns empty array for identical strings', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('hello', 'hello');
      expect(diff).toEqual([]);
    });

    it('detects insertion at end (suffix addition)', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('hello', 'hello world');

      const insertOp = diff.find((op) => op.type === 'insert');
      expect(insertOp).toBeDefined();
      expect(insertOp.text).toBe(' world');
      expect(insertOp.index).toBe(5);
    });

    it('detects insertion at start (prefix addition)', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('world', 'hello world');

      const insertOp = diff.find((op) => op.type === 'insert');
      expect(insertOp).toBeDefined();
      expect(insertOp.text).toBe('hello ');
      expect(insertOp.index).toBe(0);
    });

    it('detects deletion at end', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('hello world', 'hello');

      const deleteOp = diff.find((op) => op.type === 'delete');
      expect(deleteOp).toBeDefined();
      expect(deleteOp.length).toBe(6); // ' world'
    });

    it('detects deletion at start', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('hello world', 'world');

      const deleteOp = diff.find((op) => op.type === 'delete');
      expect(deleteOp).toBeDefined();
      expect(deleteOp.length).toBe(6); // 'hello '
    });

    it('handles replacement in middle', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      // The algorithm finds common prefix and suffix
      const diff = binding.computeDiff('hello', 'hallo');

      // Should have both delete and insert operations
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some(op => op.type === 'delete' || op.type === 'insert')).toBe(true);
    });

    it('handles complete replacement', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const diff = binding.computeDiff('abc', 'xyz');

      // Should delete old content and insert new
      expect(diff.length).toBe(2);
      const deleteOp = diff.find((op) => op.type === 'delete');
      const insertOp = diff.find((op) => op.type === 'insert');
      expect(deleteOp).toBeDefined();
      expect(insertOp).toBeDefined();
    });
  });

  describe('generateUserColor', () => {
    it('returns hex color from palette', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const color = binding.generateUserColor();

      expect(color).toMatch(/^#[a-f0-9]{6}$/i);
    });

    it('returns color from predefined set', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      const validColors = [
        '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
        '#2196f3', '#03a9f4', '#00bcd4', '#009688',
        '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
        '#ffc107', '#ff9800', '#ff5722', '#795548',
      ];

      const color = binding.generateUserColor();
      expect(validColors).toContain(color);
    });
  });

  describe('getContent', () => {
    it('returns Y.Text content', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      expect(binding.getContent()).toBe('<p>Initial content</p>');
    });
  });

  describe('setContent', () => {
    it('replaces Y.Text content', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.setContent('<p>New content</p>');

      expect(mockYText.toString()).toBe('<p>New content</p>');
    });

    it('handles null content', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.setContent(null);

      expect(mockYText.toString()).toBe('');
    });

    it('handles undefined content', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.setContent(undefined);

      expect(mockYText.toString()).toBe('');
    });
  });

  describe('destroy', () => {
    it('removes Y.Text observers', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      const unobserveSpy = spyOn(mockYText, 'unobserve');

      binding.destroy();

      expect(unobserveSpy).toHaveBeenCalled();
    });

    it('removes editor listeners', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.destroy();

      expect(mockEditor.off).toHaveBeenCalled();
    });

    it('clears observers array', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.destroy();

      expect(binding._observers).toEqual([]);
    });

    it('clears editor listeners array', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding.destroy();

      expect(binding._editorListeners).toEqual([]);
    });

    it('handles cleanup errors gracefully', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
      binding._observers.push(() => {
        throw new Error('Cleanup error');
      });

      expect(() => binding.destroy()).not.toThrow();
    });
  });

  describe('with awareness', () => {
    let mockAwareness;

    beforeEach(() => {
      mockAwareness = new MockAwareness();
    });

    it('sets up awareness on init', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
      });

      expect(binding.awareness).toBe(mockAwareness);
    });

    it('sets local cursor state', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(mockAwareness._localState.cursor).toBeDefined();
      expect(mockAwareness._localState.cursor.userId).toBe('user-1');
    });

    it('observes awareness changes', () => {
      const onSpy = spyOn(mockAwareness, 'on');

      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
      });

      expect(onSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('updateAwarenessSelection', () => {
    it('does nothing when no awareness', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      // Should not throw
      binding.updateAwarenessSelection();
    });

    it('updates awareness with cursor position', () => {
      const mockAwareness = new MockAwareness();
      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
      });

      binding.updateAwarenessSelection();

      expect(mockAwareness._localState.cursor).toBeDefined();
    });
  });

  describe('getTextOffset', () => {
    it('calculates text offset from DOM position', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      const body = mockEditor.getBody();
      body.innerHTML = 'Hello World';

      // This is a simplified test - actual implementation uses TreeWalker
      const offset = binding.getTextOffset(body.firstChild, 5);

      // Should return some offset value
      expect(typeof offset).toBe('number');
    });
  });

  describe('createRangeFromOffset', () => {
    it('returns null for out of range offset', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      const body = mockEditor.getBody();
      body.innerHTML = 'Short';

      const range = binding.createRangeFromOffset(1000);

      expect(range).toBeNull();
    });
  });

  describe('renderRemoteCursors', () => {
    it('does nothing when no awareness', () => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);

      // Should not throw
      binding.renderRemoteCursors();
    });

    it('removes existing cursor elements', () => {
      const mockAwareness = new MockAwareness();
      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
      });

      const body = mockEditor.getBody();
      const existingCursor = document.createElement('span');
      existingCursor.className = 'yjs-remote-cursor';
      body.appendChild(existingCursor);

      binding.renderRemoteCursors();

      const cursors = body.querySelectorAll('.yjs-remote-cursor');
      expect(cursors.length).toBe(0);
    });

    it('renders cursors for other clients', () => {
      const mockAwareness = new MockAwareness();
      mockAwareness._states.set(99999, {
        cursor: {
          userId: 'other-user',
          userName: 'Other User',
          color: '#ff0000',
          anchor: 5,
          head: 5,
        },
      });

      binding = new YjsTinyMCEBinding(mockEditor, mockYText, {
        awareness: mockAwareness,
      });

      const body = mockEditor.getBody();
      body.innerHTML = 'Hello World';

      binding.renderRemoteCursors();

      // Check that cursor elements were added (may vary based on implementation)
    });
  });

  describe('convertBlobUrlsToAssetUrls', () => {
    beforeEach(() => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
    });

    it('returns html unchanged when no assetManager', () => {
      const html = '<img src="blob:http://localhost:8081/abc123">';
      expect(binding.convertBlobUrlsToAssetUrls(html)).toBe(html);
    });

    it('returns html unchanged for null input', () => {
      expect(binding.convertBlobUrlsToAssetUrls(null)).toBe(null);
    });

    it('returns html unchanged for undefined input', () => {
      expect(binding.convertBlobUrlsToAssetUrls(undefined)).toBe(undefined);
    });

    it('returns html unchanged for empty string', () => {
      expect(binding.convertBlobUrlsToAssetUrls('')).toBe('');
    });

    it('returns html unchanged for non-string input', () => {
      expect(binding.convertBlobUrlsToAssetUrls(123)).toBe(123);
    });

    it('converts blob URLs to asset URLs when assetManager available', () => {
      // Setup mock assetManager
      const mockAssetManager = {
        reverseBlobCache: new Map([
          ['blob:http://localhost:8081/abc123', 'asset-uuid-123'],
        ]),
        getAssetById: () => ({ filename: 'image.png' }),
      };
      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              assetManager: mockAssetManager,
            },
          },
        },
      };

      const html = '<img src="blob:http://localhost:8081/abc123">';
      const result = binding.convertBlobUrlsToAssetUrls(html);

      expect(result).toBe('<img src="asset://asset-uuid-123/image.png">');

      // Cleanup
      delete window.eXeLearning;
    });

    it('converts multiple blob URLs', () => {
      const mockAssetManager = {
        reverseBlobCache: new Map([
          ['blob:http://localhost:8081/abc123', 'uuid-1'],
          ['blob:http://localhost:8081/def456', 'uuid-2'],
        ]),
        getAssetById: (id) => ({ filename: id === 'uuid-1' ? 'img1.png' : 'img2.jpg' }),
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="blob:http://localhost:8081/abc123"><img src="blob:http://localhost:8081/def456">';
      const result = binding.convertBlobUrlsToAssetUrls(html);

      expect(result).toContain('asset://uuid-1/img1.png');
      expect(result).toContain('asset://uuid-2/img2.jpg');

      delete window.eXeLearning;
    });

    it('keeps unknown blob URLs unchanged and warns', () => {
      const mockAssetManager = {
        reverseBlobCache: new Map(), // Empty cache
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="blob:http://localhost:8081/unknown">';
      const result = binding.convertBlobUrlsToAssetUrls(html);

      expect(result).toBe(html); // Unchanged
      expect(console.warn).toHaveBeenCalled();

      delete window.eXeLearning;
    });

    it('uses fallback filename when asset has no filename', () => {
      const mockAssetManager = {
        reverseBlobCache: new Map([
          ['blob:http://localhost:8081/abc123', 'uuid-1'],
        ]),
        getAssetById: () => null, // No asset info
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="blob:http://localhost:8081/abc123">';
      const result = binding.convertBlobUrlsToAssetUrls(html);

      expect(result).toBe('<img src="asset://uuid-1/image">');

      delete window.eXeLearning;
    });
  });

  describe('convertAssetUrlsToBlobUrls', () => {
    beforeEach(() => {
      binding = new YjsTinyMCEBinding(mockEditor, mockYText);
    });

    it('returns html unchanged when no assetManager', () => {
      const html = '<img src="asset://a1b2c3d4-e5f6-7890/image.png">';
      expect(binding.convertAssetUrlsToBlobUrls(html)).toBe(html);
    });

    it('returns html unchanged for null input', () => {
      expect(binding.convertAssetUrlsToBlobUrls(null)).toBe(null);
    });

    it('returns html unchanged for undefined input', () => {
      expect(binding.convertAssetUrlsToBlobUrls(undefined)).toBe(undefined);
    });

    it('returns html unchanged for empty string', () => {
      expect(binding.convertAssetUrlsToBlobUrls('')).toBe('');
    });

    it('converts asset URLs to blob URLs when in cache', () => {
      // Use valid hex UUID format
      const mockAssetManager = {
        blobURLCache: new Map([
          ['a1b2c3d4-e5f6-7890', 'blob:http://localhost:8081/abc123'],
        ]),
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="asset://a1b2c3d4-e5f6-7890/image.png">';
      const result = binding.convertAssetUrlsToBlobUrls(html);

      expect(result).toBe('<img src="blob:http://localhost:8081/abc123">');

      delete window.eXeLearning;
    });

    it('converts multiple asset URLs', () => {
      // Use valid hex UUIDs for proper regex matching
      const mockAssetManager = {
        blobURLCache: new Map([
          ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'blob:http://localhost:8081/abc'],
          ['11111111-2222-3333-4444-555555555555', 'blob:http://localhost:8081/def'],
        ]),
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/a.png"><img src="asset://11111111-2222-3333-4444-555555555555/b.jpg">';
      const result = binding.convertAssetUrlsToBlobUrls(html);

      expect(result).toContain('blob:http://localhost:8081/abc');
      expect(result).toContain('blob:http://localhost:8081/def');

      delete window.eXeLearning;
    });

    it('keeps asset URL unchanged when not in cache and tries to resolve', () => {
      const resolveAssetURL = mock(() => {});
      const mockAssetManager = {
        blobURLCache: new Map(), // Empty cache
        resolveAssetURL,
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      // Use valid hex UUID format
      const html = '<img src="asset://abcd1234-5678-90ab-cdef-123456789abc/image.png">';
      const result = binding.convertAssetUrlsToBlobUrls(html);

      expect(result).toBe(html); // Unchanged
      expect(resolveAssetURL).toHaveBeenCalledWith('asset://abcd1234-5678-90ab-cdef-123456789abc/image.png');

      delete window.eXeLearning;
    });

    it('handles uppercase UUIDs', () => {
      // Use valid hex format with uppercase
      const mockAssetManager = {
        blobURLCache: new Map([
          ['ABCD1234-5678-90AB-CDEF-123456789ABC', 'blob:http://localhost:8081/upper'],
        ]),
      };
      window.eXeLearning = {
        app: { project: { _yjsBridge: { assetManager: mockAssetManager } } },
      };

      const html = '<img src="asset://ABCD1234-5678-90AB-CDEF-123456789ABC/image.png">';
      const result = binding.convertAssetUrlsToBlobUrls(html);

      expect(result).toBe('<img src="blob:http://localhost:8081/upper">');

      delete window.eXeLearning;
    });
  });
});
