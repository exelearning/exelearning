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

    it('should replace relative URLs with theme path', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(bg.png); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(http://localhost:8080/themes/test-theme/bg.png); }');
    });

    it('should not replace absolute HTTP URLs', async () => {
      window.eXeLearning.app.api.func.getText.mockResolvedValue(
        'body { background: url(http://example.com/bg.png); }'
      );

      const path = '/api/resources?resource=/themes/test/style.css';
      await theme.loadStyleByInsertingIt(path);

      expect(mockStyle.innerHTML).toBe('body { background: url(http://example.com/bg.png); }');
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
