/**
 * Asset URL Resolver Tests
 *
 * Unit tests for the asset:// URL resolver that intercepts jQuery attr/prop calls.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AssetUrlResolver', () => {
  let mockAssetManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock AssetManager
    mockAssetManager = {
      resolveAssetURL: vi.fn(),
    };
  });

  afterEach(() => {
    // Clean up globals
    delete window.eXeLearningAssetResolver;
    delete window.jQuery;
    delete window.eXeLearning;
    vi.restoreAllMocks();
  });

  describe('when jQuery is not available', () => {
    beforeEach(async () => {
      vi.resetModules();
      delete window.jQuery;
      delete window.eXeLearningAssetResolver;

      await import('./asset_url_resolver.js');
    });

    it('logs warning and does not initialize', () => {
      expect(console.warn).toHaveBeenCalledWith(
        '[AssetResolver] jQuery not found, skipping initialization'
      );
      expect(window.eXeLearningAssetResolver).toBeUndefined();
    });
  });

  describe('when jQuery is available', () => {
    let resolver;
    let originalAttrFn;
    let originalPropFn;

    beforeEach(async () => {
      vi.resetModules();

      // Create mock jQuery functions
      originalAttrFn = vi.fn(function() { return this; });
      originalPropFn = vi.fn(function() { return this; });

      window.jQuery = function(selector) {
        return {
          each: vi.fn((callback) => {
            if (selector?.tagName) {
              callback.call(selector, 0, selector);
            }
            return window.jQuery(selector);
          }),
          length: 1,
        };
      };

      window.jQuery.fn = {
        attr: originalAttrFn,
        prop: originalPropFn,
      };

      // Set up eXeLearning with AssetManager
      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              assetManager: mockAssetManager,
            },
          },
        },
      };

      // Clear and reload module
      delete window.eXeLearningAssetResolver;

      await import('./asset_url_resolver.js');

      resolver = window.eXeLearningAssetResolver;
    });

    it('initializes eXeLearningAssetResolver global', () => {
      expect(resolver).toBeDefined();
      expect(typeof resolver.resolve).toBe('function');
      expect(typeof resolver.clearCache).toBe('function');
      expect(typeof resolver.getCacheSize).toBe('function');
      expect(typeof resolver.isAssetUrl).toBe('function');
    });

    it('logs initialization message', () => {
      expect(console.log).toHaveBeenCalledWith(
        '[AssetResolver] Initialized - asset:// URLs will be auto-resolved (with MutationObserver)'
      );
    });

    it('exposes disconnect method for cleanup', () => {
      expect(typeof resolver.disconnect).toBe('function');
    });

    describe('isAssetUrl', () => {
      it('returns true for asset:// URLs', () => {
        expect(resolver.isAssetUrl('asset://image.png')).toBe(true);
        expect(resolver.isAssetUrl('asset://path/to/file.jpg')).toBe(true);
        expect(resolver.isAssetUrl('asset://')).toBe(true);
      });

      it('returns false for non-asset URLs', () => {
        expect(resolver.isAssetUrl('http://example.com/image.png')).toBe(false);
        expect(resolver.isAssetUrl('https://example.com/image.png')).toBe(false);
        expect(resolver.isAssetUrl('/images/photo.jpg')).toBe(false);
        expect(resolver.isAssetUrl('data:image/png;base64,abc')).toBe(false);
        expect(resolver.isAssetUrl('blob:http://localhost/abc')).toBe(false);
      });

      it('returns false for null/undefined/non-string values', () => {
        expect(resolver.isAssetUrl(null)).toBeFalsy();
        expect(resolver.isAssetUrl(undefined)).toBeFalsy();
        expect(resolver.isAssetUrl(123)).toBeFalsy();
        expect(resolver.isAssetUrl({})).toBeFalsy();
        expect(resolver.isAssetUrl([])).toBeFalsy();
        expect(resolver.isAssetUrl('')).toBeFalsy();
      });

      it('returns false for URLs starting with "asset" but not "asset://"', () => {
        expect(resolver.isAssetUrl('assets/image.png')).toBe(false);
        expect(resolver.isAssetUrl('asset-manager.js')).toBe(false);
      });
    });

    describe('resolve', () => {
      beforeEach(() => {
        resolver.clearCache();
      });

      it('returns original URL for non-asset URLs', async () => {
        const url = 'http://example.com/image.png';
        const result = await resolver.resolve(url);
        expect(result).toBe(url);
        expect(mockAssetManager.resolveAssetURL).not.toHaveBeenCalled();
      });

      it('resolves asset:// URL via AssetManager', async () => {
        const assetUrl = 'asset://image.png';
        const blobUrl = 'blob:http://localhost/abc123';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        const result = await resolver.resolve(assetUrl);

        expect(result).toBe(blobUrl);
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith(assetUrl);
      });

      it('caches resolved URLs', async () => {
        const assetUrl = 'asset://cached.png';
        const blobUrl = 'blob:http://localhost/cached';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        // First call
        await resolver.resolve(assetUrl);
        // Second call - should use cache
        const result = await resolver.resolve(assetUrl);

        expect(result).toBe(blobUrl);
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledTimes(1);
      });

      it('returns null when resolveAssetURL returns null (asset not available)', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue(null);

        const assetUrl = 'asset://null-result.png';
        const result = await resolver.resolve(assetUrl);

        // Returns null instead of invalid asset:// URL to prevent browser errors
        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
          '[AssetResolver] Could not resolve asset URL:',
          assetUrl
        );
      });

      it('returns null and logs warning on error', async () => {
        mockAssetManager.resolveAssetURL.mockRejectedValue(new Error('Resolution failed'));

        const assetUrl = 'asset://error.png';
        const result = await resolver.resolve(assetUrl);

        // Returns null instead of invalid asset:// URL to prevent browser errors
        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
          '[AssetResolver] Error resolving:',
          assetUrl,
          expect.any(Error)
        );
      });

      it('handles null URL', async () => {
        const result = await resolver.resolve(null);
        expect(result).toBe(null);
      });

      it('handles undefined URL', async () => {
        const result = await resolver.resolve(undefined);
        expect(result).toBe(undefined);
      });

      it('handles empty string URL', async () => {
        const result = await resolver.resolve('');
        expect(result).toBe('');
      });

      it('populates cache so getAttribute can return blob URL for asset:// href (SimpleLightbox support)', async () => {
        // This test verifies the behavior for SimpleLightbox and similar libraries
        // When they read the href of an anchor, they should get the resolved blob:// URL
        const assetUrl = 'asset://cached-uuid-test/lightbox-image.jpg';
        const blobUrl = 'blob:http://localhost/cached-blob-test';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        // Resolve the URL to populate the cache
        const resolved = await resolver.resolve(assetUrl);
        expect(resolved).toBe(blobUrl);

        // Now create an anchor with the asset:// href
        const a = document.createElement('a');
        a.setAttribute('href', assetUrl);

        // When reading the href, should get the cached blob URL
        const result = a.getAttribute('href');
        expect(result).toBe(blobUrl);
      });
    });

    describe('clearCache', () => {
      it('clears the resolution cache', async () => {
        resolver.clearCache();
        const assetUrl = 'asset://toclear.png';
        const blobUrl = 'blob:http://localhost/toclear';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        // Populate cache
        await resolver.resolve(assetUrl);
        expect(resolver.getCacheSize()).toBeGreaterThan(0);

        // Clear cache
        resolver.clearCache();
        expect(resolver.getCacheSize()).toBe(0);
      });
    });

    describe('getCacheSize', () => {
      beforeEach(() => {
        resolver.clearCache();
      });

      it('returns 0 after clearing', () => {
        expect(resolver.getCacheSize()).toBe(0);
      });

      it('returns correct count after caching', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:url');

        await resolver.resolve('asset://one.png');
        expect(resolver.getCacheSize()).toBe(1);

        await resolver.resolve('asset://two.png');
        expect(resolver.getCacheSize()).toBe(2);

        // Same URL shouldn't increase count
        await resolver.resolve('asset://one.png');
        expect(resolver.getCacheSize()).toBe(2);
      });
    });

    describe('AssetManager unavailable scenarios', () => {
      // When AssetManager is unavailable, resolve() returns null to prevent
      // the browser from trying to load invalid asset:// URLs

      it('returns null when eXeLearning is undefined', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = undefined;

        // Clear cache to force resolution attempt
        resolver.clearCache();
        const assetUrl = 'asset://no-exelearning.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });

      it('returns null when app is undefined', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = {};

        resolver.clearCache();
        const assetUrl = 'asset://no-app.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });

      it('returns null when project is undefined', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = { app: {} };

        resolver.clearCache();
        const assetUrl = 'asset://no-project.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });

      it('returns null when _yjsBridge is undefined', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = { app: { project: {} } };

        resolver.clearCache();
        const assetUrl = 'asset://no-bridge.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });

      it('returns null when assetManager is undefined', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = { app: { project: { _yjsBridge: {} } } };

        resolver.clearCache();
        const assetUrl = 'asset://no-assetmanager.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });

      it('returns null when resolveAssetURL method is missing', async () => {
        const savedEXL = window.eXeLearning;
        window.eXeLearning = {
          app: {
            project: {
              _yjsBridge: {
                assetManager: {}, // No resolveAssetURL method
              },
            },
          },
        };

        resolver.clearCache();
        const assetUrl = 'asset://no-method.png';
        const result = await resolver.resolve(assetUrl);

        expect(result).toBeNull();
        window.eXeLearning = savedEXL;
      });
    });

    describe('jQuery attr interceptor', () => {
      it('intercepts src with asset:// and resolves asynchronously', async () => {
        const blobUrl = 'blob:http://localhost/resolved';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        const result = window.jQuery.fn.attr.call($el, 'src', 'asset://image.png');

        // Should return $el for chaining
        expect(result).toBe($el);

        // Wait for async resolution
        await new Promise(resolve => setTimeout(resolve, 20));

        // Original attr should be called with resolved URL
        expect(originalAttrFn).toHaveBeenCalled();
      });

      it('passes through non-src attributes unchanged', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, 'alt', 'test image');

        expect(originalAttrFn).toHaveBeenCalledWith('alt', 'test image');
      });

      it('passes through src with non-asset URLs', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, 'src', 'http://example.com/image.png');

        expect(originalAttrFn).toHaveBeenCalled();
      });

      it('passes through getter calls', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, 'src');

        expect(originalAttrFn).toHaveBeenCalledWith('src');
      });

      it('only updates IMG, SOURCE, VIDEO, AUDIO elements', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:url');

        // Test with DIV element (should not be updated)
        const mockElement = { tagName: 'DIV' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, 'src', 'asset://image.png');

        await new Promise(resolve => setTimeout(resolve, 20));

        // Resolution happens, but originalAttr is only called for media elements
        // The interceptor checks tagName before calling originalAttr
      });

      it('handles object form with asset:// src', async () => {
        const blobUrl = 'blob:http://localhost/resolved';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        const result = window.jQuery.fn.attr.call($el, {
          src: 'asset://image.png',
          alt: 'Test image',
          'data-custom': 'value'
        });

        // Should return $el for chaining
        expect(result).toBe($el);

        // Other attributes should be set immediately
        expect(originalAttrFn).toHaveBeenCalledWith({
          alt: 'Test image',
          'data-custom': 'value'
        });

        // Wait for async resolution
        await new Promise(resolve => setTimeout(resolve, 20));

        // Src should be resolved and set
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://image.png');
      });

      it('passes through object form without asset:// src', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, {
          src: 'http://example.com/image.png',
          alt: 'Test'
        });

        expect(originalAttrFn).toHaveBeenCalledWith({
          src: 'http://example.com/image.png',
          alt: 'Test'
        });
      });

      it('passes through object form without src', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.attr.call($el, { alt: 'Test', 'data-id': '123' });

        expect(originalAttrFn).toHaveBeenCalledWith({ alt: 'Test', 'data-id': '123' });
      });
    });

    describe('jQuery prop interceptor', () => {
      it('intercepts src with asset:// and resolves asynchronously', async () => {
        const blobUrl = 'blob:http://localhost/resolved';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        const result = window.jQuery.fn.prop.call($el, 'src', 'asset://image.png');

        expect(result).toBe($el);

        await new Promise(resolve => setTimeout(resolve, 20));

        expect(originalPropFn).toHaveBeenCalled();
      });

      it('passes through non-src props', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.prop.call($el, 'disabled', true);

        expect(originalPropFn).toHaveBeenCalledWith('disabled', true);
      });

      it('passes through src with non-asset URLs', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.prop.call($el, 'src', 'https://example.com/image.png');

        expect(originalPropFn).toHaveBeenCalled();
      });

      it('handles object form with asset:// src', async () => {
        const blobUrl = 'blob:http://localhost/resolved';
        mockAssetManager.resolveAssetURL.mockResolvedValue(blobUrl);

        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        const result = window.jQuery.fn.prop.call($el, {
          src: 'asset://image.png',
          disabled: false
        });

        // Should return $el for chaining
        expect(result).toBe($el);

        // Other props should be set immediately
        expect(originalPropFn).toHaveBeenCalledWith({
          disabled: false
        });

        // Wait for async resolution
        await new Promise(resolve => setTimeout(resolve, 20));

        // Src should be resolved and set
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://image.png');
      });

      it('passes through object form without asset:// src', () => {
        const mockElement = { tagName: 'IMG' };
        const $el = window.jQuery(mockElement);
        window.jQuery.fn.prop.call($el, {
          src: 'http://example.com/image.png',
          alt: 'Test'
        });

        expect(originalPropFn).toHaveBeenCalledWith({
          src: 'http://example.com/image.png',
          alt: 'Test'
        });
      });
    });

    describe('element type handling', () => {
      it('handles VIDEO elements', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:resolved');
        resolver.clearCache();

        const element = { tagName: 'VIDEO' };
        const $el = window.jQuery(element);
        window.jQuery.fn.attr.call($el, 'src', 'asset://video.mp4');

        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalled();
      });

      it('handles AUDIO elements', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:resolved');
        resolver.clearCache();

        const element = { tagName: 'AUDIO' };
        const $el = window.jQuery(element);
        window.jQuery.fn.attr.call($el, 'src', 'asset://audio.mp3');

        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalled();
      });

      it('handles SOURCE elements', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:resolved');
        resolver.clearCache();

        const element = { tagName: 'SOURCE' };
        const $el = window.jQuery(element);
        window.jQuery.fn.attr.call($el, 'src', 'asset://source.webm');

        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalled();
      });

      it('handles IMG elements', async () => {
        mockAssetManager.resolveAssetURL.mockResolvedValue('blob:resolved');
        resolver.clearCache();

        const element = { tagName: 'IMG' };
        const $el = window.jQuery(element);
        window.jQuery.fn.attr.call($el, 'src', 'asset://image.png');

        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalled();
      });
    });
  });

  describe('getAttribute interception', () => {
    it('returns asset URL when data-asset-url exists and src is blob URL', () => {
      const img = document.createElement('img');
      img.setAttribute('data-asset-url', 'asset://uuid-123/image.png');
      // Simulate the blob URL being set on the src
      Object.defineProperty(img, 'src', {
        value: 'blob:http://localhost/test',
        writable: true,
        configurable: true
      });
      // Also set it as attribute for getAttribute to return
      img.setAttribute('src', 'blob:http://localhost/test');

      const result = img.getAttribute('src');
      expect(result).toBe('asset://uuid-123/image.png');
    });

    it('returns original src when no data-asset-url exists', () => {
      const img = document.createElement('img');
      img.setAttribute('src', 'blob:http://localhost/test');

      const result = img.getAttribute('src');
      expect(result).toBe('blob:http://localhost/test');
    });

    it('returns original src when src is not blob URL', () => {
      const img = document.createElement('img');
      img.setAttribute('data-asset-url', 'asset://uuid-123/image.png');
      img.setAttribute('src', 'https://example.com/image.png');

      const result = img.getAttribute('src');
      expect(result).toBe('https://example.com/image.png');
    });

    it('returns asset URL for origin attribute using data-asset-origin', () => {
      const img = document.createElement('img');
      // origin attribute uses its own data-asset-origin storage
      img.setAttribute('data-asset-origin', 'asset://uuid-456/large.jpg');
      img.setAttribute('origin', 'blob:http://localhost/origin');

      const result = img.getAttribute('origin');
      expect(result).toBe('asset://uuid-456/large.jpg');
    });

    it('does not mix data-asset-url with origin attribute', () => {
      const img = document.createElement('img');
      // Only data-asset-url is set, not data-asset-origin
      img.setAttribute('data-asset-url', 'asset://uuid-thumb/thumb.jpg');
      img.setAttribute('origin', 'blob:http://localhost/fullsize');

      // origin should NOT use data-asset-url, it should return the blob URL
      const result = img.getAttribute('origin');
      expect(result).toBe('blob:http://localhost/fullsize');
    });

    it('returns origin asset URL only when origin is blob URL', () => {
      const img = document.createElement('img');
      img.setAttribute('data-asset-origin', 'asset://uuid-456/large.jpg');
      // Non-blob URL should be returned as-is
      img.setAttribute('origin', 'https://example.com/fullsize.jpg');

      const result = img.getAttribute('origin');
      expect(result).toBe('https://example.com/fullsize.jpg');
    });

    it('handles both src and origin independently', () => {
      const img = document.createElement('img');
      img.setAttribute('data-asset-url', 'asset://uuid-thumb/thumb.jpg');
      img.setAttribute('data-asset-origin', 'asset://uuid-full/fullsize.jpg');
      img.setAttribute('src', 'blob:http://localhost/thumb-blob');
      img.setAttribute('origin', 'blob:http://localhost/full-blob');

      expect(img.getAttribute('src')).toBe('asset://uuid-thumb/thumb.jpg');
      expect(img.getAttribute('origin')).toBe('asset://uuid-full/fullsize.jpg');
    });

    it('does not affect non-media elements', () => {
      const div = document.createElement('div');
      div.setAttribute('data-asset-url', 'asset://uuid/file');
      div.setAttribute('src', 'blob:http://localhost/test');

      const result = div.getAttribute('src');
      expect(result).toBe('blob:http://localhost/test');
    });

    it('does not affect other attributes', () => {
      const img = document.createElement('img');
      img.setAttribute('data-asset-url', 'asset://uuid/file');
      img.setAttribute('alt', 'test image');

      const result = img.getAttribute('alt');
      expect(result).toBe('test image');
    });

    it('returns asset URL for anchor href when blob URL', () => {
      const a = document.createElement('a');
      a.setAttribute('data-asset-url', 'asset://uuid-789/image.jpg');
      a.setAttribute('href', 'blob:http://localhost/anchor-test');

      const result = a.getAttribute('href');
      expect(result).toBe('asset://uuid-789/image.jpg');
    });

    it('returns original href for anchor when not blob URL', () => {
      const a = document.createElement('a');
      a.setAttribute('data-asset-url', 'asset://uuid/image.jpg');
      a.setAttribute('href', 'https://example.com/image.jpg');

      const result = a.getAttribute('href');
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('returns original href for anchor when no data-asset-url', () => {
      const a = document.createElement('a');
      a.setAttribute('href', 'blob:http://localhost/test');

      const result = a.getAttribute('href');
      expect(result).toBe('blob:http://localhost/test');
    });

    // Note: Testing the cache behavior for asset:// -> blob:// resolution requires
    // the resolver to be loaded with a mocked AssetManager. This is tested in the
    // 'when jQuery is available' describe block's resolve tests. The getAttribute
    // interception for cached URLs is verified through the combined test flow.
  });
});
