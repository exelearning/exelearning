/**
 * Vitest Setup for Frontend JavaScript Tests
 *
 * This file sets up global mocks and configurations needed for testing
 * frontend JavaScript code in the browser environment.
 *
 * Adapted from bun-test.setup.js for Vitest with worker isolation.
 */

/* eslint-disable no-undef */

import { vi, expect, afterEach, describe, it, beforeEach, beforeAll, afterAll } from 'vitest';

// ============================================================================
// Bun:test Compatibility Layer
// ============================================================================
// Make bun:test functions available globally so tests don't need to change imports
globalThis.mock = vi.fn.bind(vi);
globalThis.spyOn = vi.spyOn.bind(vi);
globalThis.describe = describe;
globalThis.it = it;
globalThis.test = it;
globalThis.expect = expect;
globalThis.beforeEach = beforeEach;
globalThis.afterEach = afterEach;
globalThis.beforeAll = beforeAll;
globalThis.afterAll = afterAll;
globalThis.vi = vi;

// Note: Vitest with happy-dom environment automatically provides window, document, etc.
// We only need to ensure globalThis references are set up

// Ensure globalThis has window reference (Vitest's happy-dom sets this up, but we ensure it)
if (typeof window !== 'undefined') {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.DOMParser = window.DOMParser;
  globalThis.XMLSerializer = window.XMLSerializer;
  globalThis.FileReader = window.FileReader;
  globalThis.NodeFilter = window.NodeFilter;

  // Make navigator writable for tests (happy-dom has it as getter-only)
  // Tests need to be able to mock navigator.sendBeacon, etc.
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (navigatorDescriptor && !navigatorDescriptor.writable) {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...window.navigator,
        userAgent: 'Mozilla/5.0 (Test) Vitest/1.0',
        language: 'en-US',
        languages: ['en-US', 'en'],
        platform: 'MacIntel',
        onLine: true,
        sendBeacon: vi.fn(() => true),
      },
      writable: true,
      configurable: true,
    });
  } else {
    globalThis.navigator = window.navigator;
  }
}

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
if (typeof window !== 'undefined') {
  window.fflate = mockFflate;
}

// ============================================================================
// Mock Translation Function
// ============================================================================

global._ = vi.fn((key, ...args) => {
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
    getMetadata: vi.fn(() => ({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
    })),
  },
  toasts: {
    show: vi.fn(() => undefined),
    success: vi.fn(() => undefined),
    error: vi.fn(() => undefined),
    warning: vi.fn(() => undefined),
    info: vi.fn(() => undefined),
  },
  modals: {
    show: vi.fn(() => undefined),
    hide: vi.fn(() => undefined),
    confirm: vi.fn((message) => Promise.resolve(true)),
    alert: vi.fn((message) => Promise.resolve()),
  },
  interface: {
    showLoading: vi.fn(() => undefined),
    hideLoading: vi.fn(() => undefined),
    updateStatus: vi.fn(() => undefined),
    showProgress: vi.fn(() => undefined),
    hideProgress: vi.fn(() => undefined),
  },
  config: {
    baseUrl: 'http://localhost:3001',
    apiUrl: 'http://localhost:3001/api',
    assetsUrl: 'http://localhost:3001/assets',
  },
  utils: {
    generateId: vi.fn(() => 'mock-id-' + Math.random().toString(36).substr(2, 9)),
    sanitizeFilename: vi.fn((name) => name.replace(/[^a-z0-9]/gi, '-').toLowerCase()),
  },
};

// ============================================================================
// Mock Logger (window.AppLogger / window.Logger)
// ============================================================================

const mockLogger = {
  log: vi.fn(() => undefined),
  warn: vi.fn(() => undefined),
  error: vi.fn(() => undefined),
  debug: vi.fn(() => undefined),
  info: vi.fn(() => undefined),
  group: vi.fn(() => undefined),
  groupEnd: vi.fn(() => undefined),
  time: vi.fn(() => undefined),
  timeEnd: vi.fn(() => undefined),
};

global.Logger = mockLogger;
global.AppLogger = mockLogger;
if (typeof window !== 'undefined') {
  window.Logger = mockLogger;
  window.AppLogger = mockLogger;
}

// ============================================================================
// Mock Window Properties
// ============================================================================

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockUrls = new Map();
let urlCounter = 0;

if (typeof URL !== 'undefined') {
  global.URL.createObjectURL = vi.fn((blob) => {
    const url = `blob:mock-url-${urlCounter++}`;
    mockUrls.set(url, blob);
    return url;
  });

  global.URL.revokeObjectURL = vi.fn((url) => {
    mockUrls.delete(url);
  });
}

// Mock window.location (only if window exists)
if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3001/',
        origin: 'http://localhost:3001',
        pathname: '/',
        search: '',
        hash: '',
        assign: vi.fn(() => undefined),
        replace: vi.fn(() => undefined),
        reload: vi.fn(() => undefined),
      },
      writable: true,
      configurable: true,
    });
  } catch (e) {
    // Happy-dom may already have location set up
  }

  // Mock window.navigator
  try {
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Test) Vitest/1.0',
        language: 'en-US',
        languages: ['en-US', 'en'],
        platform: 'MacIntel',
        onLine: true,
      },
      writable: true,
      configurable: true,
    });
  } catch (e) {
    // Happy-dom may already have navigator set up
  }
}

// ============================================================================
// Mock Exporter Globals
// ============================================================================

// createExporter factory function (used by exporter system)
global.createExporter = vi.fn((type, manager, assetCache, resourceFetcher) => {
  return {
    export: vi.fn(() => Promise.resolve({ success: true, filename: 'export.zip' })),
    getFileExtension: vi.fn(() => '.zip'),
    getFileSuffix: vi.fn(() => '_web'),
    buildFilename: vi.fn(() => 'test-project_web.zip'),
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
    getMetadata: vi.fn(() => defaultMetadata),
    getNavigation: vi.fn(() => defaultNavigation),
    getSessionId: vi.fn(() => 'test-session-id'),
    ...overrides,
  };
};

// ============================================================================
// Mock Asset Cache Manager Factory
// ============================================================================

global.createMockAssetCache = (assets = []) => ({
  getAllAssets: vi.fn(() =>
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
  getAsset: vi.fn((assetId) =>
    Promise.resolve({
      assetId,
      blob: new Blob(['test data'], { type: 'image/png' }),
      metadata: { assetId, filename: 'image.png' },
    })
  ),
  addAsset: vi.fn(() => Promise.resolve('new-asset-id')),
  removeAsset: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => Promise.resolve()),
  destroy: vi.fn(() => undefined),
  init: vi.fn(() => Promise.resolve()),
});

// ============================================================================
// Mock AssetManager Factory (IndexedDB-based asset system)
// ============================================================================

/**
 * Creates a mock AssetManager that matches the interface of the real AssetManager class.
 * Use this for tests that need to test export functionality with the new asset system.
 *
 * @param {Array} assets - Optional array of assets to pre-populate
 * @returns {Object} Mock AssetManager instance
 */
global.createMockAssetManager = (assets = []) => {
  const assetMap = new Map();
  const blobURLCache = new Map();

  // Pre-populate with provided assets
  for (const asset of assets) {
    assetMap.set(asset.id || asset.assetId, asset);
  }

  return {
    projectId: 'test-project-id',
    db: {},
    blobURLCache,
    reverseBlobCache: new Map(),
    missingAssets: new Set(),
    failedAssets: new Map(),
    pendingFetches: new Set(),

    // Initialize (no-op in tests)
    init: vi.fn(() => Promise.resolve()),

    // Get all project assets
    getProjectAssets: vi.fn(() =>
      Promise.resolve(
        assets.map((a) => ({
          id: a.id || a.assetId,
          projectId: 'test-project-id',
          blob: a.blob || new Blob(['test data'], { type: 'image/png' }),
          mime: a.mime || 'image/png',
          hash: a.hash || 'mock-hash-' + (a.id || a.assetId),
          size: a.size || 100,
          uploaded: a.uploaded !== undefined ? a.uploaded : false,
          filename: a.filename || 'image.png',
          originalPath: a.originalPath || `${a.id || a.assetId}/image.png`,
        }))
      )
    ),

    // Get single asset by ID
    getAsset: vi.fn((id) => {
      const asset = assetMap.get(id);
      if (!asset) return Promise.resolve(null);
      return Promise.resolve({
        id: asset.id || asset.assetId,
        projectId: 'test-project-id',
        blob: asset.blob || new Blob(['test data'], { type: 'image/png' }),
        mime: asset.mime || 'image/png',
        hash: asset.hash || 'mock-hash-' + id,
        size: asset.size || 100,
        uploaded: asset.uploaded !== undefined ? asset.uploaded : false,
        filename: asset.filename || 'image.png',
        originalPath: asset.originalPath,
      });
    }),

    // Check if asset exists
    hasAsset: vi.fn((id) => Promise.resolve(assetMap.has(id))),

    // Resolve asset:// URL to blob URL
    resolveAssetURL: vi.fn((assetUrl) => {
      const id = assetUrl.replace('asset://', '').split('/')[0];
      if (blobURLCache.has(id)) {
        return Promise.resolve(blobURLCache.get(id));
      }
      const blobURL = `blob:mock-url-${id}`;
      blobURLCache.set(id, blobURL);
      return Promise.resolve(blobURL);
    }),

    // Resolve asset:// URL synchronously
    resolveAssetURLSync: vi.fn((assetUrl) => {
      const id = assetUrl.replace('asset://', '').split('/')[0];
      return blobURLCache.get(id) || null;
    }),

    // Resolve HTML assets
    resolveHTMLAssets: vi.fn((html) => Promise.resolve(html)),
    resolveHTMLAssetsSync: vi.fn((html) => html),

    // Insert image
    insertImage: vi.fn((file) => Promise.resolve(`asset://mock-${Date.now()}/${file.name}`)),

    // Upload/download methods
    uploadPendingAssets: vi.fn(() => Promise.resolve({ uploaded: 0, failed: 0, bytes: 0 })),
    downloadMissingAssetsFromServer: vi.fn(() => Promise.resolve({ downloaded: 0, failed: 0 })),

    // Asset ID extraction
    extractAssetId: vi.fn((assetUrl) => {
      const path = assetUrl.replace('asset://', '');
      const slashIndex = path.indexOf('/');
      return slashIndex > 0 ? path.substring(0, slashIndex) : path;
    }),

    // Statistics
    getStats: vi.fn(() =>
      Promise.resolve({
        total: assets.length,
        pending: 0,
        uploaded: assets.length,
        totalSize: 100 * assets.length,
      })
    ),

    // Check for missing assets
    hasMissingAssets: vi.fn(() => false),
    getMissingAssetsList: vi.fn(() => []),

    // Cleanup
    cleanup: vi.fn(),

    // Methods used by exporters
    preloadAllAssets: vi.fn(() => Promise.resolve(assets.length)),
    getAllAssetIds: vi.fn(() => Promise.resolve(assets.map((a) => a.id || a.assetId))),
  };
};

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
if (typeof window !== 'undefined') {
  window.AssetCacheManager = MockAssetCacheManager;
}

// ============================================================================
// Console Spy Setup (optional)
// ============================================================================

// Suppress console.log in tests unless debugging
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: vi.fn(() => undefined),
    debug: vi.fn(() => undefined),
    info: vi.fn(() => undefined),
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
// Mock iDevice Configs for Tests
// ============================================================================

/**
 * Creates mock iDevice configurations that match the real config.xml files.
 * These configs are used by IdeviceHtmlRenderer tests.
 *
 * Note: componentType values match actual config.xml files:
 * - 'json' = has <component-type>json</component-type> in config.xml
 * - 'html' = no <component-type> tag (default behavior)
 *
 * @param {Array} overrides - Optional array of configs to add/override
 * @returns {Array} Array of iDevice config objects
 */
global.createMockIdeviceConfigs = (overrides = []) => {
  // These match the actual config.xml files in public/files/perm/idevices/base/
  const defaults = [
    // JSON iDevices (have <component-type>json</component-type> in config.xml)
    { id: 'text', cssClass: 'text', componentType: 'json', exportTemplateFilename: 'text.html' },
    // Legacy iDevice aliases that map to 'text'
    { id: 'FreeTextIdevice', cssClass: 'text', componentType: 'json', exportTemplateFilename: 'text.html' },
    { id: 'TextIdevice', cssClass: 'text', componentType: 'json', exportTemplateFilename: 'text.html' },
    { id: 'form', cssClass: 'form', componentType: 'json', exportTemplateFilename: 'form.html' },
    { id: 'example', cssClass: 'example', componentType: 'json', exportTemplateFilename: 'example.html' },
    { id: 'casestudy', cssClass: 'casestudy', componentType: 'json', exportTemplateFilename: 'casestudy.html' },
    { id: 'trueorfalse', cssClass: 'trueorfalse', componentType: 'json', exportTemplateFilename: 'trueorfalse.html' },
    { id: 'magnifier', cssClass: 'magnifier', componentType: 'json', exportTemplateFilename: 'magnifier.html' },
    { id: 'image-gallery', cssClass: 'image-gallery', componentType: 'json', exportTemplateFilename: 'image-gallery.html' },
    { id: 'scrambled-list', cssClass: 'scrambled-list', componentType: 'json', exportTemplateFilename: 'scrambled-list.html' },

    // HTML iDevices (NO <component-type> in config.xml, so default to 'html')
    { id: 'crossword', cssClass: 'crossword', componentType: 'html', exportTemplateFilename: 'crossword.html' },
    { id: 'puzzle', cssClass: 'puzzle', componentType: 'html', exportTemplateFilename: 'puzzle.html' },
    { id: 'trivial', cssClass: 'trivial', componentType: 'html', exportTemplateFilename: 'trivial.html' },
    { id: 'hangman', cssClass: 'hangman', componentType: 'html', exportTemplateFilename: 'hangman.html' },
  ];

  return [...defaults, ...overrides];
};

/**
 * Sets up a mock fetch for the /api/idevices endpoint.
 * Call this in beforeEach() before creating an IdeviceHtmlRenderer.
 *
 * @param {Array} configs - Optional array of configs to override defaults
 */
global.mockFetchForIdevices = (configs = []) => {
  const mockConfigs = global.createMockIdeviceConfigs(configs);

  global.fetch = vi.fn((url) => {
    if (url === '/api/idevices') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockConfigs),
      });
    }
    // For other URLs, return a rejection or mock as needed
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
};

/**
 * Clears the fetch mock.
 * Call this in afterEach() to clean up.
 */
global.clearFetchMock = () => {
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
  }
};

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

  // Clear all mocks between tests
  vi.clearAllMocks();
});
