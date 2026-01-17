/**
 * Bun Test Setup for Frontend JavaScript Tests
 *
 * This file sets up global mocks and configurations needed for testing
 * frontend JavaScript code in the browser environment.
 */

/* eslint-disable no-undef */

import { mock, expect, afterEach, spyOn } from 'bun:test';
import { Window } from 'happy-dom';

// Export test utilities globally for easy access in tests
globalThis.mock = mock;
globalThis.spyOn = spyOn;
globalThis.vi = {
  fn: (impl) => mock(impl || (() => undefined)),
  spyOn: spyOn,
  useFakeTimers: () => {
    // Bun doesn't have fake timers built-in, use real timers with fast-forward
    return globalThis.vi;
  },
  useRealTimers: () => {
    return globalThis.vi;
  },
  advanceTimersByTime: (ms) => {
    // For Bun, we can't actually fake timers, tests need to use real timeouts
    return new Promise(resolve => setTimeout(resolve, Math.min(ms / 1000, 10)));
  },
  clearAllMocks: () => {
    // No-op for Bun compatibility
  },
  resetAllMocks: () => {
    // No-op for Bun compatibility
  },
};

// Create a happy-dom window and register globals
const window = new Window({ url: 'http://localhost:3001/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;
globalThis.FileReader = window.FileReader;
globalThis.NodeFilter = window.NodeFilter;

// ============================================================================
// Mock fflate
// ============================================================================

/**
 * Mock fflate library for testing
 * Provides synchronous and asynchronous zip/unzip operations
 */
const mockFflate = {
  // Convert string to Uint8Array
  strToU8: (str) => new TextEncoder().encode(str),

  // Convert Uint8Array to string
  strFromU8: (data) => new TextDecoder().decode(data),

  // Synchronous zip
  zipSync: (files, options = {}) => {
    // Create a mock ZIP structure as Uint8Array
    const fileList = Object.keys(files);
    const mockData = JSON.stringify({ files: fileList, mock: true });
    return new Uint8Array(Buffer.from(mockData));
  },

  // Asynchronous zip
  zip: (files, optionsOrCallback, callback) => {
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    try {
      const result = mockFflate.zipSync(files, typeof optionsOrCallback === 'object' ? optionsOrCallback : {});
      setTimeout(() => cb(null, result), 0);
    } catch (err) {
      setTimeout(() => cb(err, null), 0);
    }
  },

  // Synchronous unzip
  unzipSync: (data) => {
    // Return a mock unzipped structure
    // If data looks like our mock format, parse it
    try {
      const str = new TextDecoder().decode(data);
      const parsed = JSON.parse(str);
      if (parsed.files && parsed.mock) {
        const result = {};
        parsed.files.forEach((f) => {
          result[f] = new Uint8Array(Buffer.from('mock content'));
        });
        return result;
      }
    } catch (e) {
      // Not our mock format, return empty object
    }
    return {
      'content.xml': new Uint8Array(Buffer.from('<?xml version="1.0"?><ode></ode>')),
    };
  },

  // Asynchronous unzip
  unzip: (data, optionsOrCallback, callback) => {
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    try {
      const result = mockFflate.unzipSync(data);
      setTimeout(() => cb(null, result), 0);
    } catch (err) {
      setTimeout(() => cb(err, null), 0);
    }
  },

  // Compression utilities
  gzipSync: (data) => data,
  gunzipSync: (data) => data,
  deflateSync: (data) => data,
  inflateSync: (data) => data,
};

global.fflate = mockFflate;
window.fflate = mockFflate;

// ============================================================================
// Mock Translation Function
// ============================================================================

global._ = mock((key, ...args) => {
  // Return the key as-is for testing, or format with args
  if (args.length > 0) {
    let result = key;
    args.forEach((arg, i) => {
      result = result.replace(`%${i + 1}`, arg);
    });
    return result;
  }
  return key;
});

// ============================================================================
// Mock eXe Global Object (legacy iDevice API)
// ============================================================================

global.eXe = {
  app: {
    _alertHistory: [],
    alert: mock(function(message) {
      this._alertHistory.push(message);
    }),
    getLastAlert: function() {
      return this._alertHistory[this._alertHistory.length - 1] || '';
    },
    clearHistory: function() {
      this._alertHistory = [];
    },
  },
};

// Also expose on window
window.eXe = global.eXe;

// ============================================================================
// Mock eXeLearning Global Object
// ============================================================================

global.eXeLearning = {
  project: {
    sessionId: 'test-session-id',
    odeId: 'test-ode-id',
    title: 'Test Project',
    author: 'Test Author',
    language: 'en',
    theme: 'default',
    getMetadata: mock(() => ({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
    })),
  },
  toasts: {
    show: mock(() => undefined),
    success: mock(() => undefined),
    error: mock(() => undefined),
    warning: mock(() => undefined),
    info: mock(() => undefined),
  },
  modals: {
    show: mock(() => undefined),
    hide: mock(() => undefined),
    confirm: mock((message) => Promise.resolve(true)),
    alert: mock((message) => Promise.resolve()),
  },
  interface: {
    showLoading: mock(() => undefined),
    hideLoading: mock(() => undefined),
    updateStatus: mock(() => undefined),
    showProgress: mock(() => undefined),
    hideProgress: mock(() => undefined),
  },
  config: {
    baseUrl: 'http://localhost:3001',
    apiUrl: 'http://localhost:3001/api',
    assetsUrl: 'http://localhost:3001/assets',
  },
  utils: {
    generateId: mock(() => 'mock-id-' + Math.random().toString(36).substr(2, 9)),
    sanitizeFilename: mock((name) => name.replace(/[^a-z0-9]/gi, '-').toLowerCase()),
  },
};

// ============================================================================
// Mock Logger (window.AppLogger / window.Logger)
// ============================================================================

const mockLogger = {
  log: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
  debug: mock(() => undefined),
  info: mock(() => undefined),
  group: mock(() => undefined),
  groupEnd: mock(() => undefined),
  time: mock(() => undefined),
  timeEnd: mock(() => undefined),
};

global.Logger = mockLogger;
global.AppLogger = mockLogger;
window.Logger = mockLogger;
window.AppLogger = mockLogger;

// ============================================================================
// Mock Window Properties
// ============================================================================

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockUrls = new Map();
let urlCounter = 0;

global.URL.createObjectURL = mock((blob) => {
  const url = `blob:mock-url-${urlCounter++}`;
  mockUrls.set(url, blob);
  return url;
});

global.URL.revokeObjectURL = mock((url) => {
  mockUrls.delete(url);
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3001/',
    origin: 'http://localhost:3001',
    pathname: '/',
    search: '',
    hash: '',
    assign: mock(() => undefined),
    replace: mock(() => undefined),
    reload: mock(() => undefined),
  },
  writable: true,
});

// Mock window.navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test) Bun/1.0',
    language: 'en-US',
    languages: ['en-US', 'en'],
    platform: 'MacIntel',
    onLine: true,
  },
  writable: true,
});

// ============================================================================
// Mock Exporter Globals
// ============================================================================

// createExporter factory function (used by exporter system)
global.createExporter = mock((type, manager, assetCache, resourceFetcher) => {
  return {
    export: mock(() => Promise.resolve({ success: true, filename: 'export.zip' })),
    getFileExtension: mock(() => '.zip'),
    getFileSuffix: mock(() => '_web'),
    buildFilename: mock(() => 'test-project_web.zip'),
  };
});

// ResourceFetcher class mock
class MockResourceFetcher {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || 'http://localhost:3001';
  }

  async fetchTheme(themeName) {
    return new Map([
      ['content.css', new Blob(['/* Theme CSS */'], { type: 'text/css' })],
      ['default.js', new Blob(['// Theme JS'], { type: 'application/javascript' })],
    ]);
  }

  async fetchBaseLibraries() {
    return new Map([
      ['jquery/jquery.min.js', new Blob(['// jQuery'], { type: 'application/javascript' })],
      ['common.js', new Blob(['// Common'], { type: 'application/javascript' })],
    ]);
  }

  async fetchIdevice(ideviceType) {
    return new Map([
      [`${ideviceType}.js`, new Blob([`// ${ideviceType}`], { type: 'application/javascript' })],
      [`${ideviceType}.css`, new Blob([`/* ${ideviceType} */`], { type: 'text/css' })],
    ]);
  }
}

global.ResourceFetcher = MockResourceFetcher;

// ============================================================================
// Mock Y.js Types for Document Manager Mocks
// ============================================================================

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
    this._data.forEach((v, k) => callback(v, k));
  }

  entries() {
    return this._data.entries();
  }

  keys() {
    return this._data.keys();
  }

  values() {
    return this._data.values();
  }

  toJSON() {
    return Object.fromEntries(this._data);
  }

  toString() {
    const content = this.get('content') || this.get('htmlContent');
    return content ? String(content) : '[object MockYMap]';
  }
}

class MockYArray {
  constructor(items = []) {
    this._items = items;
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

  forEach(callback) {
    this._items.forEach((item, index) => callback(item, index));
  }

  map(callback) {
    return this._items.map(callback);
  }

  toJSON() {
    return this._items.map((i) => (i.toJSON ? i.toJSON() : i));
  }

  toArray() {
    return [...this._items];
  }

  [Symbol.iterator]() {
    return this._items[Symbol.iterator]();
  }
}

global.MockYMap = MockYMap;
global.MockYArray = MockYArray;

// ============================================================================
// Mock Document Manager Factory
// ============================================================================

global.createMockDocumentManager = (overrides = {}) => {
  const defaultMetadata = new MockYMap({
    title: 'Test Project',
    author: 'Test Author',
    language: 'en',
    description: 'Test description',
    license: 'CC-BY-SA',
    theme: 'default',
    createdAt: new Date().toISOString(),
    ...overrides.metadata,
  });

  const defaultNavigation = new MockYArray(overrides.pages || []);

  return {
    getMetadata: mock(() => defaultMetadata),
    getNavigation: mock(() => defaultNavigation),
    getSessionId: mock(() => 'test-session-id'),
    ...overrides,
  };
};

// ============================================================================
// Mock Asset Cache Manager Factory
// ============================================================================

global.createMockAssetCache = (assets = []) => ({
  getAllAssets: mock(() =>
    Promise.resolve(
      assets.length > 0
        ? assets
        : [
            {
              assetId: 'test-asset-1',
              blob: new Blob(['test data'], { type: 'image/png' }),
              metadata: {
                assetId: 'test-asset-1',
                filename: 'image.png',
                originalPath: 'test-asset-1/image.png',
              },
            },
          ]
    )
  ),
  getAsset: mock((assetId) =>
    Promise.resolve({
      assetId,
      blob: new Blob(['test data'], { type: 'image/png' }),
      metadata: { assetId, filename: 'image.png' },
    })
  ),
  addAsset: mock(() => Promise.resolve('new-asset-id')),
  removeAsset: mock(() => Promise.resolve()),
  clear: mock(() => Promise.resolve()),
  destroy: mock(() => undefined),
  init: mock(() => Promise.resolve()),
});

// ============================================================================
// Mock AssetCacheManager Class (for tests that use new AssetCacheManager())
// ============================================================================

class MockAssetCacheManager {
  constructor(projectId) {
    this.projectId = projectId;
    this._assets = new Map();
  }

  async init() {
    return this;
  }

  async getAllAssets() {
    return Array.from(this._assets.values());
  }

  async getAsset(assetId) {
    return this._assets.get(assetId) || null;
  }

  async addAsset(blob, metadata) {
    const assetId = 'mock-asset-' + Math.random().toString(36).substr(2, 9);
    this._assets.set(assetId, { assetId, blob, metadata });
    return assetId;
  }

  async removeAsset(assetId) {
    this._assets.delete(assetId);
  }

  async clear() {
    this._assets.clear();
  }

  destroy() {
    this._assets.clear();
  }
}

global.AssetCacheManager = MockAssetCacheManager;
window.AssetCacheManager = MockAssetCacheManager;

// ============================================================================
// Console Spy Setup (optional)
// ============================================================================

// Suppress console.log in tests unless debugging
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: mock(() => undefined),
    debug: mock(() => undefined),
    info: mock(() => undefined),
    // Keep warn and error visible for test debugging
    warn: console.warn,
    error: console.error,
  };
}

// ============================================================================
// Custom Matchers
// ============================================================================

expect.extend({
  toBeValidXml(received) {
    const hasXmlDeclaration = received.includes('<?xml');
    const hasClosingTags = !/<([a-zA-Z]+)[^>]*>[^<]*$/.test(received);

    if (hasXmlDeclaration && hasClosingTags) {
      return {
        message: () => `expected ${received} not to be valid XML`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be valid XML`,
      pass: false,
    };
  },

  toContainElement(received, selector) {
    const hasElement = received.includes(`<${selector}`) || received.includes(`<${selector}>`);

    if (hasElement) {
      return {
        message: () => `expected HTML not to contain <${selector}>`,
        pass: true,
      };
    }
    return {
      message: () => `expected HTML to contain <${selector}>`,
      pass: false,
    };
  },
});

// ============================================================================
// Cleanup after each test
// ============================================================================

// Default project state for resetting
const defaultProjectState = {
  sessionId: 'test-session-id',
  odeId: 'test-ode-id',
  title: 'Test Project',
  author: 'Test Author',
  language: 'en',
  theme: 'default',
};

// Global afterEach to prevent memory leaks
afterEach(() => {
  // Clear mock URL storage (prevents memory accumulation)
  mockUrls.clear();
  urlCounter = 0;

  // Reset eXeLearning project state
  if (global.eXeLearning && global.eXeLearning.project) {
    global.eXeLearning.project.sessionId = defaultProjectState.sessionId;
    global.eXeLearning.project.odeId = defaultProjectState.odeId;
    global.eXeLearning.project.title = defaultProjectState.title;
    global.eXeLearning.project.author = defaultProjectState.author;
    global.eXeLearning.project.language = defaultProjectState.language;
    global.eXeLearning.project.theme = defaultProjectState.theme;
  }

  // Clear any pending timers
  if (typeof clearTimeout === 'function') {
    // Bun doesn't expose active timer list, but we ensure no lingering state
  }

  // Force garbage collection if available (run with --expose-gc)
  if (typeof global.gc === 'function') {
    global.gc();
  }
});
