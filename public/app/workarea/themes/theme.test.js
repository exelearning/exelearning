import Theme from './theme.js';

describe('Theme', () => {
  let theme;
  let mockManager;
  let mockData;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((text, context) => text);

    // Mock eXeLearning global
    window.eXeLearning = {
      config: {
        themeBaseType: 'XHTML',
      },
      app: {
        project: {
          structure: {
            nodeSelected: null,
          },
          idevices: {
            cleanNodeAndLoadPage: vi.fn().mockResolvedValue(undefined),
          },
        },
        api: {
          func: {
            getText: vi.fn().mockResolvedValue('body { color: red; }'),
          },
          endpoints: {
            api_idevices_download_file_resources: {
              path: '/api/resources',
            },
          },
        },
      },
    };

    // Mock manager
    mockManager = {
      symfonyURL: 'http://localhost:8080',
      app: window.eXeLearning.app,
    };

    // Mock theme data
    mockData = {
      dirName: 'test-theme',
      url: '/themes/test-theme',
      valid: true,
      author: 'Test Author',
      authorUrl: 'http://test.com',
      description: 'A test theme',
      license: 'GPL',
      licenseUrl: 'http://gpl.org',
      title: 'Test Theme',
      version: '2.0',
      templatePage: '<div>{page-content}</div>',
      templateIdevice: '<div class="idevice"></div>',
      textColor: '#000',
      linkColor: '#00f',
      cssFiles: ['style.css', 'layout.css'],
      downloadable: true,
    };

    theme = new Theme(mockManager, mockData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window._;
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should store manager reference', () => {
      expect(theme.manager).toBe(mockManager);
    });

    it('should set id from dirName', () => {
      expect(theme.id).toBe('test-theme');
    });

    it('should set valid property', () => {
      expect(theme.valid).toBe(true);
    });

    it('should construct path correctly', () => {
      expect(theme.path).toBe('http://localhost:8080/themes/test-theme/');
    });

    it('should call setConfigValues with data', () => {
      const spy = vi.spyOn(Theme.prototype, 'setConfigValues');
      new Theme(mockManager, mockData);
      expect(spy).toHaveBeenCalledWith(mockData);
      spy.mockRestore();
    });

    it('should store dirName property for theme editing', () => {
      expect(theme.dirName).toBe('test-theme');
    });
  });

  describe('setConfigValues', () => {
    it('should set all config values from data', () => {
      expect(theme.author).toBe('Test Author');
      expect(theme.authorUrl).toBe('http://test.com');
      expect(theme.description).toBe('A test theme');
      expect(theme.license).toBe('GPL');
      expect(theme.version).toBe('2.0');
    });

    it('should use default values when data values are missing', () => {
      const minimalData = {
        dirName: 'minimal-theme',
        url: '/themes/minimal',
        valid: true,
      };
      const minimalTheme = new Theme(mockManager, minimalData);

      expect(minimalTheme.author).toBe('');
      expect(minimalTheme.title).toBe('Unknown');
      expect(minimalTheme.version).toBe('1.0');
    });

    it('should translate translatable params', () => {
      expect(window._).toHaveBeenCalledWith('Test Theme', 'test-theme');
    });

    it('should handle cssFiles array', () => {
      expect(theme.cssFiles).toEqual(['style.css', 'layout.css']);
    });
  });

  describe('isTranslatable', () => {
    it('should return true for title param', () => {
      expect(theme.isTranslatable('title')).toBe(true);
    });

    it('should return false for non-translatable params', () => {
      expect(theme.isTranslatable('author')).toBe(false);
      expect(theme.isTranslatable('version')).toBe(false);
      expect(theme.isTranslatable('license')).toBe(false);
    });
  });

  describe('isValid', () => {
    it('should return true when id is set', () => {
      expect(theme.isValid()).toBe(true);
    });

    it('should return false when id is null', () => {
      theme.id = null;
      expect(theme.isValid()).toBe(false);
    });

    it('should return false when id is undefined', () => {
      theme.id = undefined;
      expect(theme.isValid()).toBe(false);
    });
  });

  describe('getHeaderImgUrl', () => {
    it('should return full URL for header image', () => {
      theme.headerImgUrl = '/images/header.png';
      expect(theme.getHeaderImgUrl()).toBe('http://localhost:8080/images/header.png');
    });
  });

  describe('getLogoImgUrl', () => {
    it('should return full URL for logo image', () => {
      theme.logoImgUrl = '/images/logo.png';
      expect(theme.getLogoImgUrl()).toBe('http://localhost:8080/images/logo.png');
    });
  });

  describe('getPageTemplateElement', () => {
    it('should return DOM element with template', () => {
      const element = theme.getPageTemplateElement();

      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.classList.contains('page-content-template-container')).toBe(true);
    });

    it('should replace {page-content} with template div', () => {
      const element = theme.getPageTemplateElement();
      const templateDiv = element.querySelector('.page-content-template');

      expect(templateDiv).toBeTruthy();
    });

    it('should return false when templatePage is empty', () => {
      theme.templatePage = '';
      expect(theme.getPageTemplateElement()).toBe(false);
    });

    it('should return false when templatePage is null', () => {
      theme.templatePage = null;
      expect(theme.getPageTemplateElement()).toBe(false);
    });
  });

  describe('getResourceServicePath', () => {
    it('should construct resource path correctly', () => {
      const path = '/files/themes/test/style.css';
      const result = theme.getResourceServicePath(path);

      expect(result).toBe('/api/resources?resource=/themes/test/style.css');
    });

    it('should handle path without /files/ prefix', () => {
      const path = '/themes/test/style.css';
      const result = theme.getResourceServicePath(path);

      expect(result).toContain('resource=//themes/test/style.css');
    });

    it('should extract path after /files/', () => {
      const path = 'http://localhost/files/perm/themes/modern/base.css';
      const result = theme.getResourceServicePath(path);

      expect(result).toBe('/api/resources?resource=/perm/themes/modern/base.css');
    });

    it('should return site theme paths directly without resource service', () => {
      const path = '/v1.0.0/site-files/themes/custom-theme/style.css';
      const result = theme.getResourceServicePath(path);

      // Site themes are served directly, not through the resource service
      expect(result).toBe('/v1.0.0/site-files/themes/custom-theme/style.css');
    });

    it('should return admin theme paths directly for backwards compatibility', () => {
      const path = '/v1.0.0/admin-files/themes/custom-theme/style.css';
      const result = theme.getResourceServicePath(path);

      // Admin themes path still works for backwards compatibility
      expect(result).toBe('/v1.0.0/admin-files/themes/custom-theme/style.css');
    });

    it('should return user theme paths directly (from FILES_DIR)', () => {
      const path = '/v0.0.0-alpha/user-files/themes/universal/style.css';
      const result = theme.getResourceServicePath(path);

      // User themes imported from ELP files are served directly via /user-files/
      expect(result).toBe('/v0.0.0-alpha/user-files/themes/universal/style.css');
    });
  });

  describe('loadStyleDynamically', () => {
    let mockHead;

    beforeEach(() => {
      mockHead = {
        append: vi.fn(),
      };
      vi.spyOn(document, 'querySelector').mockReturnValue(mockHead);
      vi.spyOn(document, 'createElement').mockReturnValue({
        classList: {
          add: vi.fn(),
        },
        setAttribute: vi.fn(),
        href: '',
      });
    });

    it('should create link element with correct attributes', () => {
      const path = '/themes/test/style.css';
      const link = theme.loadStyleDynamically(path);

      expect(link.classList.add).toHaveBeenCalledWith('exe');
      expect(link.classList.add).toHaveBeenCalledWith('theme-style');
      expect(link.setAttribute).toHaveBeenCalledWith('rel', 'stylesheet');
      expect(link.setAttribute).toHaveBeenCalledWith('type', 'text/css');
    });

    it('should set href without version when newVersion is false', () => {
      const path = '/themes/test/style.css';
      const link = theme.loadStyleDynamically(path, false);

      expect(link.href).toBe(path);
    });

    it('should append timestamp when newVersion is true', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      const path = '/themes/test/style.css';
      const link = theme.loadStyleDynamically(path, true);

      expect(link.href).toContain('?t=');
      expect(link.href).toMatch(/\/themes\/test\/style\.css\?t=\d+/);
    });

    it('should append link to head', () => {
      const path = '/themes/test/style.css';
      theme.loadStyleDynamically(path);

      expect(mockHead.append).toHaveBeenCalled();
    });

    it('should return the created link element', () => {
      const path = '/themes/test/style.css';
      const result = theme.loadStyleDynamically(path);

      expect(result).toBeDefined();
      expect(result.classList).toBeDefined();
    });
  });

  describe('loadStyleByInsertingIt', () => {
    let mockHead;
    let mockStyle;

    beforeEach(() => {
      mockStyle = {
        classList: {
          add: vi.fn(),
        },
        innerHTML: '',
      };

      mockHead = {
        append: vi.fn(),
      };

      vi.spyOn(document, 'querySelector').mockReturnValue(mockHead);
      vi.spyOn(document, 'createElement').mockReturnValue(mockStyle);
    });

    it('should create style element with classes', async () => {
      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.classList.add).toHaveBeenCalledWith('exe');
      expect(mockStyle.classList.add).toHaveBeenCalledWith('theme-style');
    });

    it('should fetch CSS text via API', async () => {
      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(window.eXeLearning.app.api.func.getText).toHaveBeenCalledWith(path);
    });

    it('should replace relative URLs without quotes', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(img/bg.png); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(http://localhost:8080/themes/test-theme/img/bg.png); }');
    });

    it('should replace relative URLs with single quotes', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        "body { background: url('img/bg.png'); }"
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe("body { background: url('http://localhost:8080/themes/test-theme/img/bg.png'); }");
    });

    it('should replace relative URLs with double quotes', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url("img/bg.png"); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url("http://localhost:8080/themes/test-theme/img/bg.png"); }');
    });

    it('should not replace absolute HTTP URLs', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(http://example.com/bg.png); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(http://example.com/bg.png); }');
    });

    it('should not replace absolute HTTPS URLs', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(https://example.com/bg.png); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(https://example.com/bg.png); }');
    });

    it('should not replace data URLs', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(data:image/png;base64,abc123); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(data:image/png;base64,abc123); }');
    });

    it('should not replace blob URLs', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(blob:http://localhost/abc-123); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(blob:http://localhost/abc-123); }');
    });

    it('should handle multiple URLs in CSS', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        '.exe-content { background: url(img/bg.png); } .header { background: url("images/header.jpg"); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe(
        '.exe-content { background: url(http://localhost:8080/themes/test-theme/img/bg.png); } .header { background: url("http://localhost:8080/themes/test-theme/images/header.jpg"); }'
      );
    });

    it('should not replace root-relative URLs (starting with /)', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(/api/idevices/download-file-resources); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(/api/idevices/download-file-resources); }');
    });

    it('should append style to head', async () => {
      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockHead.append).toHaveBeenCalledWith(mockStyle);
    });

    it('should return the created style element', async () => {
      const path = '/api/resources?resource=/themes/test/style.css';
      const result = await theme.loadStyleByInsertingIt(path);

      expect(result).toBe(mockStyle);
    });
  });

  describe('removePreviousCssLoaded', () => {
    it('should remove elements with prev-theme-style class', () => {
      const mockElement1 = { remove: vi.fn() };
      const mockElement2 = { remove: vi.fn() };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([mockElement1, mockElement2]);

      theme.removePreviousCssLoaded();

      expect(document.querySelectorAll).toHaveBeenCalledWith('head .theme-style.prev-theme-style');
      expect(mockElement1.remove).toHaveBeenCalled();
      expect(mockElement2.remove).toHaveBeenCalled();
    });

    it('should handle empty element list', () => {
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([]);

      expect(() => theme.removePreviousCssLoaded()).not.toThrow();
    });
  });

  describe('loadCss', () => {
    it('should load all CSS files', async () => {
      const spy = vi.spyOn(theme, 'loadStyleByInsertingIt').mockResolvedValue({});

      await theme.loadCss();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('style.css'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('layout.css'));
    });

    it('should construct full paths for CSS files', async () => {
      const spy = vi.spyOn(theme, 'loadStyleByInsertingIt').mockResolvedValue({});

      await theme.loadCss();

      const calls = spy.mock.calls;
      expect(calls[0][0]).toContain('http://localhost:8080/themes/test-theme/style.css');
      expect(calls[1][0]).toContain('http://localhost:8080/themes/test-theme/layout.css');
    });

    it('should handle empty cssFiles array', async () => {
      theme.cssFiles = [];
      const spy = vi.spyOn(theme, 'loadStyleByInsertingIt');

      await theme.loadCss();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should use loadUserThemeCss for user themes (isUserTheme flag)', async () => {
      theme.isUserTheme = true;
      const spy = vi.spyOn(theme, 'loadUserThemeCss').mockResolvedValue(undefined);
      const serverSpy = vi.spyOn(theme, 'loadStyleByInsertingIt');

      await theme.loadCss();

      expect(spy).toHaveBeenCalled();
      expect(serverSpy).not.toHaveBeenCalled();
    });

    it('should use loadUserThemeCss for user-theme:// paths', async () => {
      theme.path = 'user-theme://custom-theme/';
      const spy = vi.spyOn(theme, 'loadUserThemeCss').mockResolvedValue(undefined);
      const serverSpy = vi.spyOn(theme, 'loadStyleByInsertingIt');

      await theme.loadCss();

      expect(spy).toHaveBeenCalled();
      expect(serverSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadUserThemeCss', () => {
    beforeEach(() => {
      window.eXeLearning.app.resourceFetcher = null;
    });

    it('should log error when ResourceFetcher is not available', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await theme.loadUserThemeCss();

      expect(consoleSpy).toHaveBeenCalledWith('[Theme] ResourceFetcher not available for user theme');
    });

    it('should log error when theme files are not found', async () => {
      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(null),
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await theme.loadUserThemeCss();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('files not found'));
    });

    it('should try getUserThemeAsync if getUserTheme returns null', async () => {
      const mockThemeFiles = new Map([
        ['style.css', new Blob(['body { color: red; }'], { type: 'text/css' })],
      ]);

      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(null),
        getUserThemeAsync: vi.fn().mockResolvedValue(mockThemeFiles),
      };

      theme.cssFiles = ['style.css'];
      const injectSpy = vi.spyOn(theme, 'injectUserThemeCss').mockResolvedValue({});

      await theme.loadUserThemeCss();

      expect(window.eXeLearning.app.resourceFetcher.getUserThemeAsync).toHaveBeenCalledWith('test-theme');
      expect(injectSpy).toHaveBeenCalled();
    });

    it('should load CSS files from theme files map', async () => {
      const mockThemeFiles = new Map([
        ['style.css', new Blob(['body { color: red; }'], { type: 'text/css' })],
        ['layout.css', new Blob(['.container { width: 100%; }'], { type: 'text/css' })],
      ]);

      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(mockThemeFiles),
      };

      const injectSpy = vi.spyOn(theme, 'injectUserThemeCss').mockResolvedValue({});

      await theme.loadUserThemeCss();

      expect(injectSpy).toHaveBeenCalledTimes(2);
    });

    it('should warn when CSS file not found in theme files', async () => {
      const mockThemeFiles = new Map(); // Empty map

      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(mockThemeFiles),
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await theme.loadUserThemeCss();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found in user theme'));
    });
  });

  describe('injectUserThemeCss', () => {
    let mockHead;
    let mockStyle;

    beforeEach(() => {
      mockStyle = {
        classList: {
          add: vi.fn(),
        },
        setAttribute: vi.fn(),
        innerHTML: '',
      };

      mockHead = {
        append: vi.fn(),
      };

      vi.spyOn(document, 'querySelector').mockReturnValue(mockHead);
      vi.spyOn(document, 'createElement').mockReturnValue(mockStyle);

      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(new Map()),
      };
    });

    it('should create style element with user theme attributes', async () => {
      await theme.injectUserThemeCss('body { color: red; }', 'style.css');

      expect(mockStyle.classList.add).toHaveBeenCalledWith('exe');
      expect(mockStyle.classList.add).toHaveBeenCalledWith('theme-style');
      expect(mockStyle.setAttribute).toHaveBeenCalledWith('data-user-theme', 'test-theme');
      expect(mockStyle.setAttribute).toHaveBeenCalledWith('data-file', 'style.css');
    });

    it('should append style to head', async () => {
      await theme.injectUserThemeCss('body { color: red; }', 'style.css');

      expect(mockHead.append).toHaveBeenCalledWith(mockStyle);
    });

    it('should return the created style element', async () => {
      const result = await theme.injectUserThemeCss('body { color: red; }', 'style.css');

      expect(result).toBe(mockStyle);
    });

    it('should call rewriteCssUrls when theme files are available', async () => {
      const mockThemeFiles = new Map([
        ['img/bg.png', new Blob([''], { type: 'image/png' })],
      ]);

      window.eXeLearning.app.resourceFetcher = {
        getUserTheme: vi.fn().mockReturnValue(mockThemeFiles),
      };

      const rewriteSpy = vi.spyOn(theme, 'rewriteCssUrls').mockResolvedValue('rewritten css');

      await theme.injectUserThemeCss('body { background: url(img/bg.png); }', 'style.css');

      expect(rewriteSpy).toHaveBeenCalledWith('body { background: url(img/bg.png); }', mockThemeFiles);
    });
  });

  describe('rewriteCssUrls', () => {
    let mockCreateObjectURL;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
      global.URL.createObjectURL = mockCreateObjectURL;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should rewrite relative URLs to blob URLs', async () => {
      const mockThemeFiles = new Map([
        ['img/bg.png', new Blob([''], { type: 'image/png' })],
      ]);

      const cssText = 'body { background: url(img/bg.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(result).toContain("url('blob:");
    });

    it('should handle URLs with ./ prefix', async () => {
      const mockThemeFiles = new Map([
        ['img/bg.png', new Blob([''], { type: 'image/png' })],
      ]);

      const cssText = 'body { background: url(./img/bg.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(result).toContain("url('blob:");
    });

    it('should skip http URLs', async () => {
      const mockThemeFiles = new Map();

      const cssText = 'body { background: url(http://example.com/bg.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(result).toBe(cssText);
    });

    it('should skip https URLs', async () => {
      const mockThemeFiles = new Map();

      const cssText = 'body { background: url(https://example.com/bg.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(result).toBe(cssText);
    });

    it('should skip data URLs', async () => {
      const mockThemeFiles = new Map();

      const cssText = 'body { background: url(data:image/png;base64,abc); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(result).toBe(cssText);
    });

    it('should skip protocol-relative URLs', async () => {
      const mockThemeFiles = new Map();

      const cssText = 'body { background: url(//example.com/bg.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(result).toBe(cssText);
    });

    it('should handle missing files gracefully', async () => {
      const mockThemeFiles = new Map(); // Empty map

      const cssText = 'body { background: url(img/missing.png); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(result).toBe(cssText);
    });

    it('should handle multiple URLs', async () => {
      const mockThemeFiles = new Map([
        ['img/bg.png', new Blob([''], { type: 'image/png' })],
        ['fonts/font.woff', new Blob([''], { type: 'font/woff' })],
      ]);

      const cssText = 'body { background: url(img/bg.png); } @font-face { src: url(fonts/font.woff); }';
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);
      expect(result).toContain("url('blob:");
    });

    it('should handle URLs with quotes', async () => {
      const mockThemeFiles = new Map([
        ['img/bg.png', new Blob([''], { type: 'image/png' })],
      ]);

      const cssText = "body { background: url('img/bg.png'); }";
      const result = await theme.rewriteCssUrls(cssText, mockThemeFiles);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(result).toContain("url('blob:");
    });
  });

  describe('select', () => {
    let mockElements;

    beforeEach(() => {
      mockElements = [
        { classList: { add: vi.fn() } },
        { classList: { add: vi.fn() } },
      ];

      vi.spyOn(document, 'querySelectorAll').mockReturnValue(mockElements);
      vi.spyOn(theme, 'loadCss').mockResolvedValue(undefined);
      vi.spyOn(theme, 'removePreviousCssLoaded').mockImplementation(() => {});
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add prev-theme-style class to existing styles', async () => {
      await theme.select();

      expect(mockElements[0].classList.add).toHaveBeenCalledWith('prev-theme-style');
      expect(mockElements[1].classList.add).toHaveBeenCalledWith('prev-theme-style');
    });

    it('should load CSS', async () => {
      const spy = vi.spyOn(theme, 'loadCss');
      await theme.select();

      expect(spy).toHaveBeenCalled();
    });

    it('should remove previous CSS after timeout', async () => {
      const spy = vi.spyOn(theme, 'removePreviousCssLoaded');

      await theme.select();
      vi.advanceTimersByTime(100);

      expect(spy).toHaveBeenCalled();
    });

    it('should reload page when node is selected and not root', async () => {
      const mockNode = {
        getAttribute: vi.fn(() => 'page-1'),
      };
      window.eXeLearning.app.project.structure.nodeSelected = mockNode;

      await theme.select(false);

      expect(window.eXeLearning.app.project.idevices.cleanNodeAndLoadPage).toHaveBeenCalledWith(true, null);
    });

    it('should not reload page when node is root', async () => {
      const mockNode = {
        getAttribute: vi.fn(() => 'root'),
      };
      window.eXeLearning.app.project.structure.nodeSelected = mockNode;

      await theme.select(false);

      expect(window.eXeLearning.app.project.idevices.cleanNodeAndLoadPage).not.toHaveBeenCalled();
    });

    it('should not reload page when isSync is true', async () => {
      const mockNode = {
        getAttribute: vi.fn(() => 'page-1'),
      };
      window.eXeLearning.app.project.structure.nodeSelected = mockNode;

      await theme.select(true);

      expect(window.eXeLearning.app.project.idevices.cleanNodeAndLoadPage).not.toHaveBeenCalled();
    });

    it('should not reload when nodeSelected is null', async () => {
      window.eXeLearning.app.project.structure.nodeSelected = null;

      await theme.select(false);

      expect(window.eXeLearning.app.project.idevices.cleanNodeAndLoadPage).not.toHaveBeenCalled();
    });
  });
});
