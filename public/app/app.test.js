/**
 * App.js Bun Tests
 *
 * Unit tests for the main App class utility methods.
 * Since App uses ES modules with many dependencies, we test the utility methods
 * by extracting their logic and testing in isolation.
 *
 */

 

// Test functions available globally from vitest setup

describe('App utility methods', () => {
  // Extracted utility methods for testing
  // These match the implementation in app.js

  /**
   * Get the base path from eXeLearning config
   * @param {Object} eXeLearning - The eXeLearning global config
   * @returns {string} The base path without trailing slash
   */
  function getBasePath(eXeLearning) {
    const basePath = eXeLearning?.symfony?.basePath ?? '';
    if (!basePath || basePath === '/') {
      return '';
    }
    return basePath.replace(/\/+$/, '');
  }

  /**
   * Compose a full URL with base path
   * @param {string} path - The path to compose
   * @param {Object} eXeLearning - The eXeLearning global config
   * @returns {string} The composed URL
   */
  function composeUrl(path = '', eXeLearning) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const basePath = getBasePath(eXeLearning);

    if (!basePath) {
      return normalizedPath;
    }

    return `${basePath}${normalizedPath}`;
  }

  /**
   * Parse JSON data with HTML entity replacement
   * @param {string} data - JSON string with possible HTML entities
   * @returns {Object} Parsed JSON object
   */
  function parseJsonWithEntities(data) {
    return JSON.parse(data.replace(/&quot;/g, '"'));
  }

  /**
   * Force HTTPS for URLs if current protocol is HTTPS
   * @param {string} url - The URL to process
   * @param {string} currentProtocol - Current page protocol
   * @returns {string} The processed URL
   */
  function forceHttpsIfNeeded(url, currentProtocol) {
    if (currentProtocol === 'https:' && url && url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  }

  describe('getBasePath', () => {
    it('returns empty string when basePath is not set', () => {
      expect(getBasePath({})).toBe('');
      expect(getBasePath({ symfony: {} })).toBe('');
      expect(getBasePath(null)).toBe('');
      expect(getBasePath(undefined)).toBe('');
    });

    it('returns empty string when basePath is root', () => {
      expect(getBasePath({ symfony: { basePath: '/' } })).toBe('');
    });

    it('returns basePath without trailing slash', () => {
      expect(getBasePath({ symfony: { basePath: '/app' } })).toBe('/app');
      expect(getBasePath({ symfony: { basePath: '/app/' } })).toBe('/app');
      expect(getBasePath({ symfony: { basePath: '/app///' } })).toBe('/app');
    });

    it('handles nested base paths', () => {
      expect(getBasePath({ symfony: { basePath: '/my/app/path' } })).toBe(
        '/my/app/path'
      );
      expect(getBasePath({ symfony: { basePath: '/my/app/path/' } })).toBe(
        '/my/app/path'
      );
    });
  });

  describe('composeUrl', () => {
    it('returns normalized path when no basePath', () => {
      const exeConfig = {};
      expect(composeUrl('/api/test', exeConfig)).toBe('/api/test');
      expect(composeUrl('api/test', exeConfig)).toBe('/api/test');
    });

    it('prepends basePath to path', () => {
      const exeConfig = { symfony: { basePath: '/app' } };
      expect(composeUrl('/api/test', exeConfig)).toBe('/app/api/test');
      expect(composeUrl('api/test', exeConfig)).toBe('/app/api/test');
    });

    it('handles empty path', () => {
      const exeConfig = { symfony: { basePath: '/app' } };
      expect(composeUrl('', exeConfig)).toBe('/app/');
    });

    it('handles root path', () => {
      const exeConfig = { symfony: { basePath: '/app' } };
      expect(composeUrl('/', exeConfig)).toBe('/app/');
    });

    it('handles complex base paths', () => {
      const exeConfig = { symfony: { basePath: '/prefix/app' } };
      expect(composeUrl('/api/v1/projects', exeConfig)).toBe(
        '/prefix/app/api/v1/projects'
      );
    });
  });

  describe('parseJsonWithEntities', () => {
    it('parses valid JSON', () => {
      expect(parseJsonWithEntities('{"key":"value"}')).toEqual({ key: 'value' });
    });

    it('replaces &quot; with double quotes', () => {
      const input = '{&quot;name&quot;:&quot;test&quot;}';
      expect(parseJsonWithEntities(input)).toEqual({ name: 'test' });
    });

    it('handles nested objects', () => {
      const input = '{&quot;user&quot;:{&quot;name&quot;:&quot;John&quot;}}';
      expect(parseJsonWithEntities(input)).toEqual({ user: { name: 'John' } });
    });

    it('handles arrays', () => {
      const input = '{&quot;items&quot;:[1,2,3]}';
      expect(parseJsonWithEntities(input)).toEqual({ items: [1, 2, 3] });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseJsonWithEntities('invalid')).toThrow();
    });
  });

  describe('forceHttpsIfNeeded', () => {
    it('converts http to https when protocol is https:', () => {
      expect(forceHttpsIfNeeded('http://example.com', 'https:')).toBe(
        'https://example.com'
      );
      expect(forceHttpsIfNeeded('http://api.example.com/path', 'https:')).toBe(
        'https://api.example.com/path'
      );
    });

    it('leaves https URLs unchanged', () => {
      expect(forceHttpsIfNeeded('https://example.com', 'https:')).toBe(
        'https://example.com'
      );
    });

    it('leaves http URLs unchanged when protocol is http:', () => {
      expect(forceHttpsIfNeeded('http://example.com', 'http:')).toBe(
        'http://example.com'
      );
    });

    it('handles null/undefined URLs', () => {
      expect(forceHttpsIfNeeded(null, 'https:')).toBeNull();
      expect(forceHttpsIfNeeded(undefined, 'https:')).toBeUndefined();
      expect(forceHttpsIfNeeded('', 'https:')).toBe('');
    });
  });
});

describe('App session monitor configuration', () => {
  /**
   * Calculate session check interval
   * @param {Object} config - The eXeLearning config
   * @returns {number} The interval in milliseconds
   */
  function getSessionCheckInterval(config) {
    const baseInterval = Number(
      config.sessionCheckIntervalMs || config.sessionCheckInterval || 0
    );
    return baseInterval > 0 ? baseInterval : 60000;
  }

  describe('getSessionCheckInterval', () => {
    it('returns configured interval in ms', () => {
      expect(getSessionCheckInterval({ sessionCheckIntervalMs: 30000 })).toBe(30000);
    });

    it('falls back to sessionCheckInterval', () => {
      expect(getSessionCheckInterval({ sessionCheckInterval: 45000 })).toBe(45000);
    });

    it('returns default 60000 when not configured', () => {
      expect(getSessionCheckInterval({})).toBe(60000);
      expect(getSessionCheckInterval({ sessionCheckIntervalMs: 0 })).toBe(60000);
      expect(getSessionCheckInterval({ sessionCheckIntervalMs: -1 })).toBe(60000);
    });

    it('prefers sessionCheckIntervalMs over sessionCheckInterval', () => {
      expect(
        getSessionCheckInterval({
          sessionCheckIntervalMs: 20000,
          sessionCheckInterval: 40000,
        })
      ).toBe(20000);
    });
  });
});

describe('App URL protocol handling', () => {
  /**
   * Check if running on Panther test port
   * @param {string} port - The port number
   * @returns {boolean} True if it's a Panther port (90XX)
   */
  function isPantherPort(port) {
    return /^90\d{2}$/.test(String(port || ''));
  }

  describe('isPantherPort', () => {
    it('returns true for 90XX ports', () => {
      expect(isPantherPort('9000')).toBe(true);
      expect(isPantherPort('9080')).toBe(true);
      expect(isPantherPort('9099')).toBe(true);
    });

    it('returns false for other ports', () => {
      expect(isPantherPort('8080')).toBe(false);
      expect(isPantherPort('3000')).toBe(false);
      expect(isPantherPort('443')).toBe(false);
      expect(isPantherPort('')).toBe(false);
      expect(isPantherPort(null)).toBe(false);
    });
  });
});

describe('App string utilities', () => {
  // Helper to sanitize project titles for filenames
  function sanitizeProjectTitle(title) {
    if (!title) return 'untitled';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'untitled';
  }

  describe('sanitizeProjectTitle', () => {
    it('converts to lowercase', () => {
      expect(sanitizeProjectTitle('My Project')).toBe('my-project');
    });

    it('replaces spaces with hyphens', () => {
      expect(sanitizeProjectTitle('hello world test')).toBe('hello-world-test');
    });

    it('removes special characters', () => {
      expect(sanitizeProjectTitle('test@project!')).toBe('testproject');
    });

    it('collapses multiple hyphens', () => {
      expect(sanitizeProjectTitle('test   project')).toBe('test-project');
    });

    it('returns untitled for empty input', () => {
      expect(sanitizeProjectTitle('')).toBe('untitled');
      expect(sanitizeProjectTitle(null)).toBe('untitled');
      expect(sanitizeProjectTitle(undefined)).toBe('untitled');
    });

    it('removes leading/trailing hyphens', () => {
      expect(sanitizeProjectTitle('-test-')).toBe('test');
      expect(sanitizeProjectTitle('---test---')).toBe('test');
    });
  });
});

describe('App configuration validation', () => {
  /**
   * Check if installation is offline
   * @param {Object} config - The eXeLearning config
   * @returns {boolean} True if offline installation
   */
  function isOfflineInstallation(config) {
    return Boolean(config?.isOfflineInstallation);
  }

  /**
   * Get environment name
   * @param {Object} symfony - The symfony config
   * @returns {string} Environment name
   */
  function getEnvironment(symfony) {
    return symfony?.environment || 'prod';
  }

  describe('isOfflineInstallation', () => {
    it('returns true when flag is set', () => {
      expect(isOfflineInstallation({ isOfflineInstallation: true })).toBe(true);
    });

    it('returns false when flag is false', () => {
      expect(isOfflineInstallation({ isOfflineInstallation: false })).toBe(false);
    });

    it('returns false when config is missing', () => {
      expect(isOfflineInstallation(null)).toBe(false);
      expect(isOfflineInstallation(undefined)).toBe(false);
      expect(isOfflineInstallation({})).toBe(false);
    });
  });

  describe('getEnvironment', () => {
    it('returns configured environment', () => {
      expect(getEnvironment({ environment: 'test' })).toBe('test');
      expect(getEnvironment({ environment: 'dev' })).toBe('dev');
      expect(getEnvironment({ environment: 'prod' })).toBe('prod');
    });

    it('returns prod as default', () => {
      expect(getEnvironment({})).toBe('prod');
      expect(getEnvironment(null)).toBe('prod');
      expect(getEnvironment(undefined)).toBe('prod');
    });
  });
});

describe('App eXeLearning global checks', () => {
  /**
   * Check if running inside eXe editor
   * @returns {boolean} True if eXeLearning global is defined
   */
  function isInExe() {
    return typeof eXeLearning !== 'undefined';
  }

  /**
   * Check if preview mode
   * @param {Object} body - The body element (jQuery or DOM)
   * @returns {boolean} True if in preview mode
   */
  function isPreview(body) {
    if (!body) return false;
    if (typeof body.hasClass === 'function') {
      return body.hasClass('preview');
    }
    if (body.classList) {
      return body.classList.contains('preview');
    }
    return false;
  }

  describe('isInExe', () => {
    it('returns false when eXeLearning is undefined', () => {
      // In test environment, eXeLearning should not be defined
      const originalExe = global.eXeLearning;
      global.eXeLearning = undefined;

      expect(isInExe()).toBe(false);

      global.eXeLearning = originalExe;
    });

    it('returns true when eXeLearning is defined', () => {
      global.eXeLearning = { version: '4.0' };
      expect(isInExe()).toBe(true);
      global.eXeLearning = undefined;
    });
  });

  describe('isPreview', () => {
    it('returns false for null body', () => {
      expect(isPreview(null)).toBe(false);
    });

    it('checks hasClass for jQuery-like objects', () => {
      const mockBody = {
        hasClass: mock(() => true),
      };
      expect(isPreview(mockBody)).toBe(true);
      expect(mockBody.hasClass).toHaveBeenCalledWith('preview');
    });

    it('checks classList for DOM elements', () => {
      const mockBody = {
        classList: {
          contains: mock(() => false),
        },
      };
      expect(isPreview(mockBody)).toBe(false);
      expect(mockBody.classList.contains).toHaveBeenCalledWith('preview');
    });
  });
});

describe('App API URL composition', () => {
  /**
   * Compose API endpoint URL
   * @param {string} endpoint - The API endpoint
   * @param {Object} symfony - The symfony config
   * @returns {string} Full API URL
   */
  function composeApiUrl(endpoint, symfony) {
    const baseUrl = symfony?.fullURL || '';
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${normalizedEndpoint}`;
  }

  describe('composeApiUrl', () => {
    it('composes URL with fullURL', () => {
      const symfony = { fullURL: 'https://example.com/app' };
      expect(composeApiUrl('/api/v1/projects', symfony)).toBe(
        'https://example.com/app/api/v1/projects'
      );
    });

    it('normalizes endpoint without leading slash', () => {
      const symfony = { fullURL: 'https://example.com' };
      expect(composeApiUrl('api/test', symfony)).toBe('https://example.com/api/test');
    });

    it('handles missing fullURL', () => {
      expect(composeApiUrl('/api/test', {})).toBe('/api/test');
      expect(composeApiUrl('/api/test', null)).toBe('/api/test');
    });
  });
});
