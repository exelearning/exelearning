import ApiCallManager from './apiCallManager.js';
import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

vi.mock('./apiCallBaseFunctions.js');

describe('ApiCallManager', () => {
  let apiManager;
  let mockApp;
  let mockFunc;

  beforeEach(() => {
    // Mock localStorage
    let store = {};
    const mockLocalStorage = {
      getItem: vi.fn(key => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn(key => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

    mockApp = {
      eXeLearning: {
        config: {
          baseURL: 'http://localhost',
          basePath: '/exelearning',
          changelogURL: 'http://localhost/changelog',
        },
      },
      common: {
        getVersionTimeStamp: vi.fn(() => '123456'),
      },
    };

    window.eXeLearning = mockApp.eXeLearning;
    window.eXeLearning.app = mockApp;
    global.eXeLearning = window.eXeLearning;

    apiManager = new ApiCallManager(mockApp);
    mockFunc = apiManager.func;
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    delete window.eXeLearning;
    delete global.eXeLearning;
  });

  describe('constructor', () => {
    it('should initialize with correct URLs', () => {
      expect(apiManager.apiUrlBase).toBe('http://localhost');
      expect(apiManager.apiUrlBasePath).toBe('/exelearning');
      expect(apiManager.apiUrlParameters).toContain('/api/parameter-management/parameters/data/list');
    });
  });

  describe('loadApiParameters', () => {
    it('should load routes into endpoints', async () => {
      const mockParams = {
        routes: {
          test_route: { path: '/api/test', methods: ['GET'] },
        },
      };
      vi.spyOn(apiManager, 'getApiParameters').mockResolvedValue(mockParams);

      await apiManager.loadApiParameters();

      expect(apiManager.endpoints.test_route).toEqual({
        path: 'http://localhost/api/test',
        methods: ['GET'],
      });
    });
  });

  describe('getApiParameters', () => {
    it('should call func.get with correct URL', async () => {
      await apiManager.getApiParameters();
      expect(mockFunc.get).toHaveBeenCalledWith(apiManager.apiUrlParameters);
    });
  });

  describe('getChangelogText', () => {
    it('should call func.getText with version timestamp', async () => {
      await apiManager.getChangelogText();
      expect(mockFunc.getText).toHaveBeenCalledWith(expect.stringContaining('version=123456'));
    });
  });

  describe('getThirdPartyCodeText / getLicensesList', () => {
    it('should call func.getText with versioned paths', async () => {
      global.eXeLearning.version = 'v9.9.9';

      await apiManager.getThirdPartyCodeText();
      await apiManager.getLicensesList();

      expect(mockFunc.getText).toHaveBeenCalledWith(
        'http://localhost/exelearning/v9.9.9/libs/README.md'
      );
      expect(mockFunc.getText).toHaveBeenCalledWith(
        'http://localhost/exelearning/v9.9.9/libs/LICENSES.md'
      );
    });
  });

  describe('getUploadLimits', () => {
    it('should call func.get with upload limits endpoint', async () => {
      await apiManager.getUploadLimits();
      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/config/upload-limits'
      );
    });
  });

  describe('getTemplates', () => {
    it('should call func.get with locale param', async () => {
      await apiManager.getTemplates('es');
      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/templates?locale=es'
      );
    });
  });

  describe('getRecentUserOdeFiles', () => {
    it('should fetch recent projects with auth header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 'p1' }]),
      });
      localStorage.setItem('authToken', 'recent-token');

      const result = await apiManager.getRecentUserOdeFiles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/user/recent'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer recent-token',
          }),
        })
      );
      expect(result).toEqual([{ id: 'p1' }]);
      localStorage.removeItem('authToken');
    });

    it('should return empty list on fetch error', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const result = await apiManager.getRecentUserOdeFiles();

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentUserOdeSessionId', () => {
    it('should return project id from URL', async () => {
      const oldLocation = window.location;
      delete window.location;
      window.location = { search: '?project=proj-123' };

      const result = await apiManager.getCurrentUserOdeSessionId();

      expect(result).toEqual({
        responseMessage: 'OK',
        odeSessionId: 'proj-123',
      });

      window.location = oldLocation;
    });
  });

  describe('getIdevicesInstalled / getThemesInstalled', () => {
    it('should call func.get with endpoints', async () => {
      apiManager.endpoints.api_idevices_installed = { path: 'http://localhost/idevices' };
      apiManager.endpoints.api_themes_installed = { path: 'http://localhost/themes' };

      await apiManager.getIdevicesInstalled();
      await apiManager.getThemesInstalled();

      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/idevices');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/themes');
    });
  });

  describe('_buildProjectUrl', () => {
    it('should build URLs for numeric IDs', () => {
      const url = apiManager._buildProjectUrl(123, '/sharing');
      expect(url).toBe('http://localhost/exelearning/api/projects/123/sharing');
    });

    it('should build URLs for UUIDs', () => {
      const url = apiManager._buildProjectUrl('abc-123', '/visibility');
      expect(url).toBe('http://localhost/exelearning/api/projects/uuid/abc-123/visibility');
    });
  });

  describe('getResourceLockTimeout', () => {
    it('should return the default lock timeout', async () => {
      const result = await apiManager.getResourceLockTimeout();
      expect(result).toBe(900000);
    });
  });

  describe('send', () => {
    it('should call func.do with endpoint method and url', async () => {
      apiManager.endpoints.api_test = { path: 'http://localhost/test', method: 'POST' };
      await apiManager.send('api_test', { hello: 'world' });

      expect(mockFunc.do).toHaveBeenCalledWith(
        'POST',
        'http://localhost/test',
        { hello: 'world' }
      );
    });
  });

  describe('getIdevicesBySessionId', () => {
    it('should replace session id in endpoint path', async () => {
      apiManager.endpoints.api_games_session_idevices = {
        path: 'http://localhost/api/games/session/{odeSessionId}/idevices',
      };

      await apiManager.getIdevicesBySessionId('sess-1');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/api/games/session/sess-1/idevices'
      );
    });
  });

  describe('upload/import helpers', () => {
    it('should fall back to default URL when import route is missing', async () => {
      apiManager.endpoints.api_odes_ode_local_elp_import_root_from_local = null;
      const payload = { odeSessionId: 's1', odeFileName: 'f', odeFilePath: '/tmp' };

      await apiManager.postImportElpToRootFromLocal(payload);

      expect(mockFunc.post).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/ode-management/odes/ode/import/local/root',
        payload
      );
    });

    it('should fall back and replace nav id for import child', async () => {
      apiManager.endpoints.api_nav_structures_import_elp_child = null;
      const payload = { odeSessionId: 's1' };

      await apiManager.postImportElpAsChildFromLocal('nav-123', payload);

      expect(mockFunc.post).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/nav-structure-management/nav-structures/nav-123/import-elp',
        payload
      );
    });
  });

  describe('theme and idevice helpers', () => {
    it('should replace theme dir in edit endpoint', async () => {
      apiManager.endpoints.api_themes_edit = { path: 'http://localhost/themes/{themeId}' };

      await apiManager.putEditTheme('theme-1', { name: 'Theme' });

      expect(mockFunc.put).toHaveBeenCalledWith(
        'http://localhost/themes/theme-1',
        { name: 'Theme' }
      );
    });

    it('should replace params in theme zip download', async () => {
      apiManager.endpoints.api_themes_download = {
        path: 'http://localhost/api/themes/{themeId}/download',
      };

      await apiManager.getThemeZip('theme-1');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/api/themes/theme-1/download'
      );
    });

    it('should replace params in idevice zip download', async () => {
      apiManager.endpoints.api_idevices_installed_download = {
        path: 'http://localhost/idevices/{odeSessionId}/{ideviceDirName}',
      };

      await apiManager.getIdeviceInstalledZip('session-1', 'idevice-1');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/idevices/session-1/idevice-1'
      );
    });
  });

  describe('getUserOdeFiles', () => {
    it('should fetch user projects with auth header', async () => {
      const mockProjects = { odeFiles: { odeFilesSync: [{ id: 1 }] } };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockProjects),
      });
      localStorage.setItem('authToken', 'test-token');

      const result = await apiManager.getUserOdeFiles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/user/list'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(result).toEqual(mockProjects);
      localStorage.removeItem('authToken');
    });

    it('should return empty list on fetch error', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const result = await apiManager.getUserOdeFiles();
      expect(result.odeFiles.odeFilesSync).toEqual([]);
    });
  });

  describe('getComponentsByPage', () => {
    it('should remove overlays and use Yjs when enabled', async () => {
      document.body.innerHTML = `
        <div class="user-editing-overlay"></div>
        <div id="editing-node" class="editing-article"></div>
        <div id="disabled-node" class="article-disabled"></div>
      `;
      const getComponentsSpy = vi
        .spyOn(apiManager, '_getComponentsByPageFromYjs')
        .mockReturnValue({ responseMessage: 'OK' });
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: {} },
      };

      await apiManager.getComponentsByPage('page-1');

      expect(getComponentsSpy).toHaveBeenCalledWith('page-1');
      expect(document.querySelector('.user-editing-overlay')).toBeNull();
      expect(document.getElementById('editing-node')?.classList.contains('editing-article')).toBe(false);
      expect(document.getElementById('disabled-node')?.classList.contains('article-disabled')).toBe(false);
    });

    it('should call api when Yjs is disabled', async () => {
      apiManager.endpoints.api_idevices_list_by_page = {
        path: 'http://localhost/idevices/{odeNavStructureSyncId}',
      };
      mockApp.project = { _yjsEnabled: false };

      await apiManager.getComponentsByPage('page-1');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/idevices/page-1'
      );
    });
  });

  describe('_getComponentsByPageFromYjs', () => {
    it('should return error when structureBinding is missing', () => {
      mockApp.project = { _yjsEnabled: true, _yjsBridge: {} };

      const result = apiManager._getComponentsByPageFromYjs('page-1');

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Yjs not initialized' });
    });

    it('should return empty root structure when no pages exist', () => {
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding: {
            getPages: vi.fn(() => []),
          },
        },
      };

      const result = apiManager._getComponentsByPageFromYjs('root');

      expect(result).toEqual({
        id: 'root',
        odePageId: 'root',
        pageName: 'Root',
        odePagStructureSyncs: [],
      });
    });

    it('should return empty structure when page is missing', () => {
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding: {
            getPageMap: vi.fn(() => null),
          },
        },
      };

      const result = apiManager._getComponentsByPageFromYjs('page-missing');

      expect(result).toEqual({
        id: 'page-missing',
        odePageId: 'page-missing',
        pageName: 'Page',
        odePagStructureSyncs: [],
      });
    });

    it('should build Yjs component structure and resolve assets', () => {
      const resolveHTMLAssetsSync = vi.fn(() => '<img src="blob://asset.png">');
      const structureBinding = {
        getPageMap: vi.fn(
          () => new Map([['id', 'page-1'], ['pageName', 'Page One'], ['order', 2]])
        ),
        getBlocks: vi.fn(() => [
          {
            id: 'block-1',
            blockId: 'block-1',
            blockName: 'Block',
            iconName: 'Icon',
            order: 1,
            properties: { toJSON: () => ({ visibility: true, cssClass: 'highlight' }) },
          },
        ]),
        getComponents: vi.fn(() => [
          {
            id: 'comp-1',
            ideviceType: 'FreeTextIdevice',
            order: 1,
            htmlContent: '<img src="asset://asset.png">',
            jsonProperties: '{"a":1}',
          },
        ]),
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding, assetManager: { resolveHTMLAssetsSync } },
      };

      const result = apiManager._getComponentsByPageFromYjs('page-1');

      expect(resolveHTMLAssetsSync).toHaveBeenCalledWith(
        '<img src="asset://asset.png">',
        { usePlaceholder: true, addTracking: true }
      );
      expect(result.odePagStructureSyncs[0].odePagStructureSyncProperties.visibility.value).toBe('true');
      expect(result.odePagStructureSyncs[0].odeComponentsSyncs[0].htmlView).toBe('<img src="blob://asset.png">');
      expect(result.odePagStructureSyncs[0].odeComponentsSyncs[0].jsonProperties).toBe('{"a":1}');
    });

    it('should resolve root to first page when available', () => {
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1' }]),
        getPageMap: vi.fn(() => new Map([['id', 'page-1'], ['pageName', 'Page One']])),
        getBlocks: vi.fn(() => []),
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding },
      };

      const result = apiManager._getComponentsByPageFromYjs('root');

      expect(result.odePageId).toBe('page-1');
      expect(result.pageName).toBe('Page One');
    });
  });

  describe('postOdeSave', () => {
    it('should call func.post with correct endpoint', async () => {
      apiManager.endpoints.api_odes_ode_save_manual = { path: 'http://localhost/save' };
      const params = { data: 'test' };
      
      await apiManager.postOdeSave(params);
      
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/save', params);
    });
  });

  describe('putSaveHtmlView', () => {
    it('should save to Yjs when enabled', async () => {
      const updateComponent = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateComponent } },
      };

      const result = await apiManager.putSaveHtmlView({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<p>Test</p>',
      });

      expect(updateComponent).toHaveBeenCalledWith('comp-1', { htmlContent: '<p>Test</p>' });
      expect(result).toEqual({ responseMessage: 'OK' });
      expect(mockFunc.put).not.toHaveBeenCalled();
    });

    it('should call api when Yjs is disabled', async () => {
      apiManager.endpoints.api_idevices_html_view_save = { path: 'http://localhost/html/save' };
      mockApp.project = { _yjsEnabled: false };

      await apiManager.putSaveHtmlView({ odeComponentsSyncId: 'c1', htmlView: '<p>Ok</p>' });

      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/html/save', {
        odeComponentsSyncId: 'c1',
        htmlView: '<p>Ok</p>',
      });
    });

    it('should convert blob URLs to asset URLs before saving to Yjs', async () => {
      const updateComponent = vi.fn();
      const convertBlobURLsToAssetRefs = vi.fn((html) =>
        html.replace('blob:http://localhost/abc-123', 'asset://uuid-image-1234/test.jpg')
      );
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding: { updateComponent },
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      const result = await apiManager.putSaveHtmlView({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<p>Test</p><img src="blob:http://localhost/abc-123">',
      });

      expect(convertBlobURLsToAssetRefs).toHaveBeenCalledWith(
        '<p>Test</p><img src="blob:http://localhost/abc-123">'
      );
      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        htmlContent: '<p>Test</p><img src="asset://uuid-image-1234/test.jpg">',
      });
      expect(result).toEqual({ responseMessage: 'OK' });
    });

    it('should not fail if assetManager is not available', async () => {
      const updateComponent = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateComponent } },
      };

      const result = await apiManager.putSaveHtmlView({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<p>Test</p>',
      });

      expect(updateComponent).toHaveBeenCalledWith('comp-1', { htmlContent: '<p>Test</p>' });
      expect(result).toEqual({ responseMessage: 'OK' });
    });
  });

  describe('_saveIdeviceToYjs', () => {
    it('should return error when structureBinding is missing', () => {
      mockApp.project = { _yjsEnabled: true, _yjsBridge: {} };

      const result = apiManager._saveIdeviceToYjs({ odeComponentsSyncId: 'comp-1' });

      expect(result).toEqual({ responseMessage: 'ERROR', error: 'Yjs not initialized' });
    });

    it('should create a new block and component when missing', () => {
      const createBlock = vi.fn(() => 'block-new');
      const createComponent = vi.fn(() => 'comp-new');
      const structureBinding = {
        getComponentMap: vi.fn(() => null),
        getBlockMap: vi.fn(() => null),
        createBlock,
        createComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding },
      };

      const result = apiManager._saveIdeviceToYjs({
        odeNavStructureSyncId: 'page-1',
        odePagStructureSyncId: 'new',
        odeIdeviceTypeName: 'FreeTextIdevice',
        htmlView: '<p>Hi</p>',
      });

      expect(createBlock).toHaveBeenCalledWith('page-1', '');
      expect(createComponent).toHaveBeenCalledWith(
        'page-1',
        'block-new',
        'FreeTextIdevice',
        expect.objectContaining({ htmlContent: '<p>Hi</p>' })
      );
      expect(result.responseMessage).toBe('OK');
      expect(result.newOdePagStructureSync).toBe(true);
      expect(result.odeComponentsSyncId).toBe('comp-new');
    });

    it('should update existing component', () => {
      const updateComponent = vi.fn();
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding },
      };

      const result = apiManager._saveIdeviceToYjs({
        odeNavStructureSyncId: 'page-1',
        odePagStructureSyncId: 'block-1',
        odeComponentsSyncId: 'comp-1',
        odeIdeviceTypeName: 'FreeTextIdevice',
        htmlView: '<p>Updated</p>',
        jsonProperties: '{"b":2}',
        order: 3,
      });

      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        htmlContent: '<p>Updated</p>',
        jsonProperties: '{"b":2}',
        order: 3,
      });
      expect(result.newOdePagStructureSync).toBe(false);
      expect(result.odeComponentsSyncId).toBe('comp-1');
    });

    it('should convert blob URLs to asset URLs when creating new component', () => {
      const createBlock = vi.fn(() => 'block-new');
      const createComponent = vi.fn(() => 'comp-new');
      const convertBlobURLsToAssetRefs = vi.fn((html) =>
        html.replace('blob:http://localhost/xyz', 'asset://uuid-123/image.jpg')
      );
      const structureBinding = {
        getComponentMap: vi.fn(() => null),
        getBlockMap: vi.fn(() => null),
        createBlock,
        createComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      apiManager._saveIdeviceToYjs({
        odeNavStructureSyncId: 'page-1',
        odePagStructureSyncId: 'new',
        odeIdeviceTypeName: 'FreeTextIdevice',
        htmlView: '<img src="blob:http://localhost/xyz">',
      });

      expect(convertBlobURLsToAssetRefs).toHaveBeenCalledWith(
        '<img src="blob:http://localhost/xyz">'
      );
      expect(createComponent).toHaveBeenCalledWith(
        'page-1',
        'block-new',
        'FreeTextIdevice',
        expect.objectContaining({
          htmlContent: '<img src="asset://uuid-123/image.jpg">',
        })
      );
    });

    it('should convert blob URLs to asset URLs when updating existing component', () => {
      const updateComponent = vi.fn();
      const convertBlobURLsToAssetRefs = vi.fn((html) =>
        html.replace('blob:http://localhost/abc', 'asset://uuid-456/photo.png')
      );
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<p>Test</p><img src="blob:http://localhost/abc">',
      });

      expect(convertBlobURLsToAssetRefs).toHaveBeenCalledWith(
        '<p>Test</p><img src="blob:http://localhost/abc">'
      );
      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        htmlContent: '<p>Test</p><img src="asset://uuid-456/photo.png">',
      });
    });

    it('should not fail if assetManager is not available in _saveIdeviceToYjs', () => {
      const updateComponent = vi.fn();
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding },
      };

      const result = apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<p>No conversion</p>',
      });

      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        htmlContent: '<p>No conversion</p>',
      });
      expect(result.responseMessage).toBe('OK');
    });

    // Tests for jsonProperties blob URL conversion (fixes image persistence bug)
    // JSON-type iDevices like text store content in jsonProperties.textTextarea
    // which must also be converted from blob:// to asset:// URLs

    it('should convert blob URLs in jsonProperties when updating component', () => {
      const updateComponent = vi.fn();
      const convertBlobURLsToAssetRefs = vi.fn((html) =>
        html.replace(/blob:http:\/\/localhost\/img-\d+/g, (match) => {
          return match.replace('blob:http://localhost/img-', 'asset://uuid-');
        })
      );
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      // Simulate text iDevice saving with blob URL in textTextarea
      const jsonPropsWithBlob = JSON.stringify({
        textTextarea: '<p>Hello</p><img src="blob:http://localhost/img-123">',
        textFeedbackInput: 'Show feedback',
      });

      apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        htmlView: '<div class="text-content"><img src="blob:http://localhost/img-123"></div>',
        jsonProperties: jsonPropsWithBlob,
      });

      // Verify jsonProperties was converted
      const updateCall = updateComponent.mock.calls[0];
      const savedJsonProps = JSON.parse(updateCall[1].jsonProperties);
      expect(savedJsonProps.textTextarea).toContain('asset://uuid-123');
      expect(savedJsonProps.textTextarea).not.toContain('blob:');
      expect(savedJsonProps.textFeedbackInput).toBe('Show feedback'); // unchanged

      // Verify htmlContent was also converted
      expect(updateCall[1].htmlContent).toContain('asset://uuid-123');
      expect(updateCall[1].htmlContent).not.toContain('blob:');
    });

    it('should convert blob URLs in jsonProperties when creating new component', () => {
      const createBlock = vi.fn(() => 'block-new');
      const createComponent = vi.fn(() => 'comp-new');
      const convertBlobURLsToAssetRefs = vi.fn((html) =>
        html.replace('blob:http://localhost/new-img', 'asset://new-uuid/photo.jpg')
      );
      const structureBinding = {
        getComponentMap: vi.fn(() => null),
        getBlockMap: vi.fn(() => null),
        createBlock,
        createComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      const jsonPropsWithBlob = JSON.stringify({
        textTextarea: '<img src="blob:http://localhost/new-img" alt="test">',
      });

      apiManager._saveIdeviceToYjs({
        odeNavStructureSyncId: 'page-1',
        odePagStructureSyncId: 'new',
        odeIdeviceTypeName: 'FreeTextIdevice',
        htmlView: '<img src="blob:http://localhost/new-img">',
        jsonProperties: jsonPropsWithBlob,
      });

      // Verify createComponent received converted jsonProperties
      const createCall = createComponent.mock.calls[0];
      const savedJsonProps = JSON.parse(createCall[3].jsonProperties);
      expect(savedJsonProps.textTextarea).toContain('asset://new-uuid/photo.jpg');
      expect(savedJsonProps.textTextarea).not.toContain('blob:');
    });

    it('should NOT modify jsonProperties if no blob URLs present', () => {
      const updateComponent = vi.fn();
      const convertBlobURLsToAssetRefs = vi.fn((html) => html);
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      const jsonPropsNoBlob = JSON.stringify({
        textTextarea: '<p>Plain text with asset://existing-uuid/img.jpg</p>',
        someNumber: 42,
      });

      apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        jsonProperties: jsonPropsNoBlob,
      });

      // convertBlobURLsToAssetRefs should NOT be called for jsonProperties without blob URLs
      // (optimization: skip parsing if no 'blob:' substring found)
      const updateCall = updateComponent.mock.calls[0];
      const savedJsonProps = JSON.parse(updateCall[1].jsonProperties);
      expect(savedJsonProps.textTextarea).toBe('<p>Plain text with asset://existing-uuid/img.jpg</p>');
      expect(savedJsonProps.someNumber).toBe(42);
    });

    it('should handle invalid JSON in jsonProperties gracefully', () => {
      const updateComponent = vi.fn();
      const convertBlobURLsToAssetRefs = vi.fn((html) => html);
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      // Invalid JSON that contains 'blob:' - should not crash
      const invalidJson = 'not valid json blob:http://localhost/xyz';

      const result = apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        jsonProperties: invalidJson,
      });

      // Should still save (pass through unchanged on parse error)
      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        jsonProperties: invalidJson,
      });
      expect(result.responseMessage).toBe('OK');
    });

    it('should convert multiple blob URLs in different jsonProperties fields', () => {
      const updateComponent = vi.fn();
      let callCount = 0;
      const convertBlobURLsToAssetRefs = vi.fn((html) => {
        callCount++;
        return html
          .replace('blob:http://localhost/img1', 'asset://uuid-1/img1.jpg')
          .replace('blob:http://localhost/img2', 'asset://uuid-2/img2.jpg');
      });
      const structureBinding = {
        getComponentMap: vi.fn(() => ({})),
        updateComponent,
      };
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding,
          assetManager: { convertBlobURLsToAssetRefs },
        },
      };

      const jsonPropsMultipleFields = JSON.stringify({
        textTextarea: '<img src="blob:http://localhost/img1">',
        textFeedbackTextarea: '<img src="blob:http://localhost/img2">',
        plainField: 'no blob here',
      });

      apiManager._saveIdeviceToYjs({
        odeComponentsSyncId: 'comp-1',
        jsonProperties: jsonPropsMultipleFields,
      });

      const updateCall = updateComponent.mock.calls[0];
      const savedJsonProps = JSON.parse(updateCall[1].jsonProperties);

      // Both fields with blob URLs should be converted
      expect(savedJsonProps.textTextarea).toContain('asset://uuid-1/img1.jpg');
      expect(savedJsonProps.textFeedbackTextarea).toContain('asset://uuid-2/img2.jpg');
      expect(savedJsonProps.plainField).toBe('no blob here');
    });
  });

  describe('putSavePropertiesIdevice', () => {
    it('should save properties to Yjs when enabled', async () => {
      const updateComponent = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateComponent } },
      };

      const result = await apiManager.putSavePropertiesIdevice({
        odeComponentsSyncId: 'comp-1',
        visibility: 'true',
        cssClass: 'note',
        ignored: 'skip',
      });

      expect(updateComponent).toHaveBeenCalledWith('comp-1', {
        properties: { visibility: 'true', cssClass: 'note' },
      });
      expect(result).toEqual({ responseMessage: 'OK' });
    });
  });

  describe('putSaveBlock', () => {
    it('should update block via Yjs when enabled and values changed', async () => {
      const updateBlock = vi.fn();
      // Mock getBlock to return old values (different from new values)
      const getBlock = vi.fn().mockReturnValue({
        blockName: 'Old Title',
        iconName: 'Old Icon',
        order: 0,
      });
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateBlock, getBlock } },
      };

      const result = await apiManager.putSaveBlock({
        odePagStructureSyncId: 'block-1',
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });

      expect(getBlock).toHaveBeenCalledWith('block-1');
      expect(updateBlock).toHaveBeenCalledWith('block-1', {
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });
      expect(result.responseMessage).toBe('OK');
    });

    it('should skip Yjs update when values are unchanged', async () => {
      const updateBlock = vi.fn();
      // Mock getBlock to return same values as the save params
      const getBlock = vi.fn().mockReturnValue({
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateBlock, getBlock } },
      };

      const result = await apiManager.putSaveBlock({
        odePagStructureSyncId: 'block-1',
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });

      expect(getBlock).toHaveBeenCalledWith('block-1');
      // updateBlock should NOT be called since values are the same
      expect(updateBlock).not.toHaveBeenCalled();
      expect(result.responseMessage).toBe('OK');
    });
  });

  describe('putSavePropertiesBlock', () => {
    it('should update block properties via Yjs', async () => {
      const updateBlock = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateBlock } },
      };

      const result = await apiManager.putSavePropertiesBlock({
        odePagStructureSyncId: 'block-1',
        blockName: 'Block',
        iconName: 'Icon',
        visibility: 'true',
        cssClass: 'hl',
      });

      expect(updateBlock).toHaveBeenCalledWith('block-1', {
        properties: { visibility: 'true', cssClass: 'hl' },
      });
      expect(updateBlock).toHaveBeenCalledWith('block-1', { blockName: 'Block' });
      expect(updateBlock).toHaveBeenCalledWith('block-1', { iconName: 'Icon' });
      expect(result.responseMessage).toBe('OK');
    });
  });

  describe('putSavePropertiesPage', () => {
    it('should update page properties via Yjs', async () => {
      const updatePage = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updatePage } },
      };

      const result = await apiManager.putSavePropertiesPage({
        odeNavStructureSyncId: 'page-1',
        titleNode: 'Page Title',
        order: 3,
        customField: 'custom',
      });

      expect(updatePage).toHaveBeenCalledWith('page-1', {
        pageName: 'Page Title',
        order: 3,
        properties: {
          titleNode: 'Page Title',
          order: 3,
          customField: 'custom',
        },
      });
      expect(result.responseMessage).toBe('OK');
    });
  });

  describe('deleteIdevice', () => {
    it('should call func.delete when Yjs not enabled', async () => {
      apiManager.endpoints.api_idevices_idevice_delete = { path: 'http://localhost/delete/{odeComponentsSyncId}' };
      mockApp.project = { _yjsEnabled: false };

      await apiManager.deleteIdevice('id-123');

      expect(mockFunc.delete).toHaveBeenCalledWith('http://localhost/delete/id-123');
    });

    it('should delete from Yjs when enabled', async () => {
      const mockDeleteComponent = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: {
          structureBinding: {
            deleteComponent: mockDeleteComponent,
          },
        },
      };

      const result = await apiManager.deleteIdevice('id-123');

      expect(mockDeleteComponent).toHaveBeenCalledWith('id-123');
      expect(result.responseMessage).toBe('OK');
    });
  });

  describe('getProject', () => {
    it('should build correct URL for numeric ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 123 }),
      });

      await apiManager.getProject(123);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/projects/123/sharing',
        expect.any(Object)
      );
    });

    it('should build correct URL for UUID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'uuid-123' }),
      });

      await apiManager.getProject('uuid-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/projects/uuid/uuid-123/sharing',
        expect.any(Object)
      );
    });
  });

  describe('getOdeExportDownload', () => {
    it('should post structure for Yjs sessions', async () => {
      apiManager.endpoints.api_ode_export_download = {
        path: 'http://localhost/export/{odeSessionId}/{exportType}',
      };
      vi.spyOn(apiManager, 'buildStructureFromYjs').mockReturnValue({ pages: [] });

      await apiManager.getOdeExportDownload('yjs-123', 'html5');

      expect(mockFunc.post).toHaveBeenCalledWith(
        'http://localhost/export/yjs-123/html5',
        { structure: { pages: [] } }
      );
    });

    it('should fallback to get when structure is unavailable', async () => {
      apiManager.endpoints.api_ode_export_download = {
        path: 'http://localhost/export/{odeSessionId}/{exportType}',
      };
      vi.spyOn(apiManager, 'buildStructureFromYjs').mockReturnValue(null);

      await apiManager.getOdeExportDownload('yjs-456', 'html5');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/export/yjs-456/html5'
      );
    });
  });

  describe('buildStructureFromYjs', () => {
    it('should return null when manager is unavailable', () => {
      mockApp.project = { _yjsBridge: { getDocumentManager: vi.fn(() => null) } };
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = apiManager.buildStructureFromYjs();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should build structure with pages, blocks, and components', () => {
      const navigation = {
        length: 1,
        get: vi.fn(() => new Map([
          ['id', 'page-1'],
          ['pageName', 'Page One'],
          ['parentId', null],
          ['blocks', {
            length: 1,
            get: vi.fn(() => new Map([
              ['id', 'block-1'],
              ['blockName', 'Block One'],
              ['iconName', 'Icon'],
              ['components', {
                length: 1,
                get: vi.fn(() => new Map([
                  ['id', 'comp-1'],
                  ['ideviceType', 'FreeTextIdevice'],
                  ['htmlContent', { toString: () => '<p>Hi</p>' }],
                  ['properties', { toJSON: () => ({ visibility: 'true' }) }],
                ])),
              }],
            ])),
          }],
        ])),
      };
      const manager = {
        getMetadata: vi.fn(() => new Map([
          ['title', 'Title'],
          ['author', 'Author'],
          ['language', 'es'],
          ['description', 'Desc'],
          ['license', 'MIT'],
          ['theme', 'base'],
        ])),
        getNavigation: vi.fn(() => navigation),
      };
      mockApp.project = { _yjsBridge: { getDocumentManager: vi.fn(() => manager) } };

      const result = apiManager.buildStructureFromYjs();

      expect(result.pages[0].blocks[0].components[0].properties).toEqual({ visibility: 'true' });
      expect(result.navigation[0].navText).toBe('Page One');
    });
  });

  describe('getOdeIdevicesDownload', () => {
    it('should build download response and call getText', async () => {
      apiManager.endpoints.api_idevices_download_ode_components = {
        path: 'http://localhost/idevices/{odeSessionId}/{odeBlockId}/{odeIdeviceId}',
      };
      mockFunc.getText.mockResolvedValue('payload');

      const result = await apiManager.getOdeIdevicesDownload('s1', 'b1', 'i1');

      expect(mockFunc.getText).toHaveBeenCalledWith(
        'http://localhost/idevices/s1/b1/i1'
      );
      expect(result.url).toBe('http://localhost/idevices/s1/b1/i1');
      expect(result.response).toBe('payload');
    });
  });

  describe('getFileResourcesForceDownload', () => {
    it('should return url with resource param', async () => {
      apiManager.endpoints.api_idevices_force_download_file_resources = {
        path: 'http://localhost/resource',
      };

      const result = await apiManager.getFileResourcesForceDownload('file.xml');

      expect(result.url).toBe('http://localhost/resource?resource=file.xml');
    });
  });

  describe('postOdeAutosave', () => {
    it('should call post for autosave', async () => {
      apiManager.endpoints.api_odes_ode_save_auto = { path: 'http://localhost/autosave' };

      await apiManager.postOdeAutosave({ data: 'autosave' });

      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/autosave', { data: 'autosave' });
    });
  });

  describe('deprecated sync helpers', () => {
    it('should return OK flags for updates', async () => {
      const result = await apiManager.postCheckUserOdeUpdates({});

      expect(result).toEqual({
        responseMessage: 'OK',
        hasUpdates: false,
        syncNavStructureFlag: false,
        syncPagStructureFlag: false,
        syncComponentsFlag: false,
      });
    });

    it('should return OK for page users', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await apiManager.postCheckUsersOdePage({});

      expect(result).toEqual({ responseMessage: 'OK', usersOnPage: [] });
      warnSpy.mockRestore();
    });

    it('should return OK for edit and flags', async () => {
      const editResult = await apiManager.postEditIdevice({});
      const activateResult = await apiManager.postActivateCurrentOdeUsersUpdateFlag({});
      const componentResult = await apiManager.checkCurrentOdeUsersComponentFlag({});

      expect(editResult).toEqual({ responseMessage: 'OK' });
      expect(activateResult).toEqual({ responseMessage: 'OK' });
      expect(componentResult).toEqual({ responseMessage: 'OK', isAvailable: true });
    });
  });

  describe('project sharing api', () => {
    it('should return error on visibility update failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ message: 'bad' }),
      });

      const result = await apiManager.updateProjectVisibility(1, 'public');

      expect(result.responseMessage).toBe('ERROR');
    });

    it('should map collaborator errors', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: vi.fn().mockResolvedValue({ message: 'not found' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: vi.fn().mockResolvedValue({ message: 'already collaborator' }),
        });

      const notFound = await apiManager.addProjectCollaborator(1, 'a@b.com');
      const already = await apiManager.addProjectCollaborator(1, 'a@b.com');

      expect(notFound.responseMessage).toBe('USER_NOT_FOUND');
      expect(already.responseMessage).toBe('ALREADY_COLLABORATOR');
    });

    it('should handle collaborator removal and transfer', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ ok: true }),
        });

      const removeResult = await apiManager.removeProjectCollaborator(1, 2);
      const transferResult = await apiManager.transferProjectOwnership(1, 99);

      expect(removeResult).toEqual({ ok: true });
      expect(transferResult).toEqual({ ok: true });
    });
  });

  describe('api wrapper calls', () => {
    it('should call legacy session endpoints', async () => {
      apiManager.endpoints.check_current_users_ode_session_id = { path: 'http://localhost/join' };
      apiManager.endpoints.api_odes_ode_elp_open = { path: 'http://localhost/open' };
      apiManager.endpoints.api_odes_ode_local_large_elp_open = { path: 'http://localhost/large' };
      apiManager.endpoints.api_odes_ode_local_elp_open = { path: 'http://localhost/local' };
      apiManager.endpoints.api_odes_ode_local_xml_properties_open = { path: 'http://localhost/xml' };
      apiManager.endpoints.api_odes_ode_local_elp_import_root = { path: 'http://localhost/import-root' };
      apiManager.endpoints.api_odes_ode_local_idevices_open = { path: 'http://localhost/idevices' };
      apiManager.endpoints.api_odes_ode_multiple_local_elp_open = { path: 'http://localhost/multi' };
      apiManager.endpoints.api_odes_remove_ode_file = { path: 'http://localhost/remove' };
      apiManager.endpoints.api_odes_remove_date_ode_files = { path: 'http://localhost/remove-date' };
      apiManager.endpoints.api_odes_check_before_leave_ode_session = { path: 'http://localhost/check' };
      apiManager.endpoints.api_odes_clean_init_autosave_elp = { path: 'http://localhost/clean' };
      apiManager.endpoints.api_odes_ode_session_close = { path: 'http://localhost/close' };

      await apiManager.postJoinCurrentOdeSessionId({ id: 1 });
      await apiManager.postSelectedOdeFile({ name: 'file' });
      await apiManager.postLocalLargeOdeFile({ data: 'big' });
      await apiManager.postLocalOdeFile({ data: 'small' });
      await apiManager.postLocalXmlPropertiesFile({ data: 'xml' });
      await apiManager.postImportElpToRoot({ data: 'root' });
      await apiManager.postLocalOdeComponents({ data: 'components' });
      await apiManager.postMultipleLocalOdeFiles({ data: 'multi' });
      await apiManager.postDeleteOdeFile({ id: 1 });
      await apiManager.postDeleteOdeFilesByDate({ from: '2020' });
      await apiManager.postCheckCurrentOdeUsers({ id: 1 });
      await apiManager.postCleanAutosavesByUser({ id: 1 });
      await apiManager.postCloseSession({ id: 1 });

      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/join', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/open', { name: 'file' });
      expect(mockFunc.fileSendPost).toHaveBeenCalledWith('http://localhost/large', { data: 'big' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/local', { data: 'small' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/xml', { data: 'xml' });
      expect(mockFunc.fileSendPost).toHaveBeenCalledWith('http://localhost/import-root', { data: 'root' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/idevices', { data: 'components' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/multi', { data: 'multi' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/remove', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/remove-date', { from: '2020' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/check', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/clean', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/close', { id: 1 });
    });

    it('should call theme, idevice, and preference endpoints', async () => {
      apiManager.endpoints.api_themes_upload = { path: 'http://localhost/theme/upload' };
      apiManager.endpoints.api_ode_theme_import = { path: 'http://localhost/theme/import' };
      apiManager.endpoints.api_themes_installed_delete = { path: 'http://localhost/theme/delete' };
      apiManager.endpoints.api_themes_new = { path: 'http://localhost/theme/new' };
      apiManager.endpoints.api_idevices_upload = { path: 'http://localhost/idevices/upload' };
      apiManager.endpoints.api_idevices_installed_delete = { path: 'http://localhost/idevices/delete' };
      apiManager.endpoints.api_user_set_lopd_accepted = { path: 'http://localhost/lopd' };
      apiManager.endpoints.api_user_preferences_get = { path: 'http://localhost/prefs' };
      apiManager.endpoints.api_user_preferences_save = { path: 'http://localhost/prefs/save' };

      await apiManager.postUploadTheme({ data: 'theme' });
      // postOdeImportTheme uses fetch directly (not mockFunc), tested separately
      await apiManager.deleteTheme({ id: 1 });
      await apiManager.postNewTheme({ name: 'new' });
      await apiManager.postUploadIdevice({ data: 'idevice' });
      await apiManager.deleteIdeviceInstalled({ id: 2 });
      await apiManager.postUserSetLopdAccepted();
      await apiManager.getUserPreferences();
      await apiManager.putSaveUserPreferences({ mode: 'dark' });

      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/theme/upload', { data: 'theme' });
      expect(mockFunc.delete).toHaveBeenCalledWith('http://localhost/theme/delete', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/theme/new', { name: 'new' });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/idevices/upload', { data: 'idevice' });
      expect(mockFunc.delete).toHaveBeenCalledWith('http://localhost/idevices/delete', { id: 2 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/lopd');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/prefs');
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/prefs/save', { mode: 'dark' });
    });

    it('should call structure and diagnostics endpoints', async () => {
      apiManager.endpoints.api_odes_last_updated = { path: 'http://localhost/last/{odeId}' };
      apiManager.endpoints.api_odes_current_users = {
        path: 'http://localhost/users/{odeId}/{odeVersionId}/{odeSessionId}',
      };
      apiManager.endpoints.api_nav_structures_nav_structure_get = {
        path: 'http://localhost/structure/{odeVersionId}/{odeSessionId}',
      };
      apiManager.endpoints.api_odes_session_get_broken_links = { path: 'http://localhost/broken/session' };
      apiManager.endpoints.api_odes_pag_get_broken_links = { path: 'http://localhost/broken/page/{odePageId}' };
      apiManager.endpoints.api_odes_block_get_broken_links = { path: 'http://localhost/broken/block/{odeBlockId}' };
      apiManager.endpoints.api_odes_idevice_get_broken_links = { path: 'http://localhost/broken/idevice/{odeIdeviceId}' };
      apiManager.endpoints.api_odes_properties_get = { path: 'http://localhost/properties/{odeSessionId}' };
      apiManager.endpoints.api_odes_properties_save = { path: 'http://localhost/properties/save' };
      apiManager.endpoints.api_odes_session_get_used_files = { path: 'http://localhost/used-files' };

      await apiManager.getOdeLastUpdated('ode-1');
      await apiManager.getOdeConcurrentUsers('ode-1', 'v1', 's1');
      await apiManager.getOdeStructure('v1', 's1');
      await apiManager.getOdeSessionBrokenLinks({ id: 1 });
      await apiManager.getOdePageBrokenLinks('page-1');
      await apiManager.getOdeBlockBrokenLinks('block-1');
      await apiManager.getOdeIdeviceBrokenLinks('idev-1');
      await apiManager.getOdeProperties('s1');
      await apiManager.putSaveOdeProperties({ id: 1 });
      await apiManager.getOdeSessionUsedFiles({ id: 1 });

      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/last/ode-1');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/users/ode-1/v1/s1', null, false);
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/structure/v1/s1');
      expect(mockFunc.postJson).toHaveBeenCalledWith('http://localhost/broken/session', { id: 1 });
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/broken/page/page-1');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/broken/block/block-1');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/broken/idevice/idev-1');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/properties/s1');
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/properties/save', { id: 1 });
      expect(mockFunc.postJson).toHaveBeenCalledWith('http://localhost/used-files', { id: 1 });
    });

    it('should call page, block, and file endpoints', async () => {
      apiManager.endpoints.api_pag_structures_pag_structure_reorder = { path: 'http://localhost/block/reorder' };
      apiManager.endpoints.api_pag_structures_pag_structure_duplicate = { path: 'http://localhost/block/clone' };
      apiManager.endpoints.api_pag_structures_pag_structure_delete = {
        path: 'http://localhost/block/delete/{odePagStructureSyncId}',
      };
      apiManager.endpoints.api_nav_structures_nav_structure_data_save = { path: 'http://localhost/page/save' };
      apiManager.endpoints.api_nav_structures_nav_structure_reorder = { path: 'http://localhost/page/reorder' };
      apiManager.endpoints.api_nav_structures_nav_structure_duplicate = { path: 'http://localhost/page/clone' };
      apiManager.endpoints.api_nav_structures_nav_structure_delete = {
        path: 'http://localhost/page/delete/{odeNavStructureSyncId}',
      };
      apiManager.endpoints.api_idevices_upload_file_resources = { path: 'http://localhost/file/upload' };
      apiManager.endpoints.api_idevices_upload_large_file_resources = { path: 'http://localhost/file/large' };

      await apiManager.putReorderBlock({ id: 1 });
      await apiManager.deleteBlock('block-1');
      await apiManager.putSavePage({ id: 1 });
      await apiManager.putReorderPage({ id: 1 });
      await apiManager.postClonePage({ id: 1 });
      await apiManager.deletePage('page-1');
      await apiManager.postUploadFileResource({ file: 'a' });
      await apiManager.postUploadLargeFileResource({ file: 'b' });

      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/block/reorder', { id: 1 });
      expect(mockFunc.delete).toHaveBeenCalledWith('http://localhost/block/delete/block-1');
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/page/save', { id: 1 });
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/page/reorder', { id: 1 });
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/page/clone', { id: 1 });
      expect(mockFunc.delete).toHaveBeenCalledWith('http://localhost/page/delete/page-1');
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/file/upload', { file: 'a' });
      expect(mockFunc.fileSendPost).toHaveBeenCalledWith('http://localhost/file/large', { file: 'b' });
    });

    it('should call translation and cloud endpoints', async () => {
      apiManager.endpoints.api_translations_lists = { path: 'http://localhost/i18n' };
      apiManager.endpoints.api_translations_list_by_locale = { path: 'http://localhost/i18n/{locale}' };
      apiManager.endpoints.api_google_oauth_login_url_get = { path: 'http://localhost/google/login' };
      apiManager.endpoints.api_google_drive_folders_list = { path: 'http://localhost/google/folders' };
      apiManager.endpoints.api_google_drive_file_upload = { path: 'http://localhost/google/upload' };
      apiManager.endpoints.api_dropbox_oauth_login_url_get = { path: 'http://localhost/dropbox/login' };
      apiManager.endpoints.api_dropbox_folders_list = { path: 'http://localhost/dropbox/folders' };
      apiManager.endpoints.api_dropbox_file_upload = { path: 'http://localhost/dropbox/upload' };

      await apiManager.getTranslationsAll();
      await apiManager.getTranslations('es');
      await apiManager.getUrlLoginGoogleDrive();
      await apiManager.getFoldersGoogleDrive();
      await apiManager.uploadFileGoogleDrive({ file: 'a' });
      await apiManager.getUrlLoginDropbox();
      await apiManager.getFoldersDropbox();
      await apiManager.uploadFileDropbox({ file: 'b' });

      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/i18n');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/i18n/es');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/google/login');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/google/folders');
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/google/upload', { file: 'a' });
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/dropbox/login');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/dropbox/folders');
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/dropbox/upload', { file: 'b' });
    });

    it('should call component html endpoints', async () => {
      apiManager.endpoints.api_idevices_html_template_get = {
        path: 'http://localhost/html/{odeComponentsSyncId}',
      };
      apiManager.endpoints.api_idevices_html_view_get = {
        path: 'http://localhost/html/view/{odeComponentsSyncId}',
      };

      await apiManager.getComponentHtmlTemplate('comp-1');
      await apiManager.getSaveHtmlView('comp-2');

      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/html/comp-1');
      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/html/view/{odeComponentsSyncId}');
    });

    it('should call idevice save and reorder endpoints', async () => {
      apiManager.endpoints.api_idevices_idevice_data_save = { path: 'http://localhost/idevice/save' };
      apiManager.endpoints.api_idevices_idevice_reorder = { path: 'http://localhost/idevice/reorder' };

      await apiManager.putSaveIdevice({ id: 1 });
      await apiManager.putReorderIdevice({ id: 1 });

      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/idevice/save', { id: 1 });
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/idevice/reorder', { id: 1 });
    });

    it('should call block sync endpoint', async () => {
      apiManager.endpoints.get_current_block_update = { path: 'http://localhost/block/sync' };

      await apiManager.postObtainOdeBlockSync({ id: 1 });

      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/block/sync', { id: 1 });
    });

    it('should call export download shortcut', async () => {
      apiManager.endpoints.api_ode_export_download = {
        path: 'http://localhost/export/{odeSessionId}/{exportType}',
      };
      global.eXeLearning.extension = 'html5';

      await apiManager.getOdeDownload('sess-1');

      expect(mockFunc.get).toHaveBeenCalledWith('http://localhost/export/sess-1/html5');
    });
  });

  describe('postOdeImportTheme', () => {
    it('should return error when themeZip is not provided', async () => {
      const result = await apiManager.postOdeImportTheme({ themeDirname: 'test-theme' });
      expect(result.responseMessage).toBe('ERROR');
      expect(result.error).toContain('Theme import requires the theme files');
    });

    it('should return error when themeDirname is not provided', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      const result = await apiManager.postOdeImportTheme({ themeZip: mockBlob });
      expect(result.responseMessage).toBe('ERROR');
      expect(result.error).toContain('Theme directory name is required');
    });

    it('should successfully upload theme with FormData', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      const mockResponse = { responseMessage: 'OK', themes: { themes: [] } };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });

      expect(result.responseMessage).toBe('OK');
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[0]).toBe('http://localhost/exelearning/api/themes/import');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].body).toBeInstanceOf(FormData);
    });

    it('should handle fetch errors gracefully', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });

      expect(result.responseMessage).toBe('ERROR');
      expect(result.error).toBe('Network error');
    });

    it('should handle HTTP error responses', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid theme' }),
      });

      const result = await apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });

      expect(result.responseMessage).toBe('ERROR');
      expect(result.error).toBe('Invalid theme');
    });
  });

  describe('getOdePageExportDownload', () => {
    it('should post structure for Yjs sessions with page root', async () => {
      apiManager.endpoints.api_ode_export_download = {
        path: 'http://localhost/export/{odeSessionId}/{exportType}',
      };
      
      const mockStructure = { pages: [] };
      vi.spyOn(apiManager, 'buildStructureFromYjs').mockReturnValue(mockStructure);
      
      const mockResponse = { ok: true, blob: () => 'blob' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      localStorage.setItem('authToken', 'test-token');

      const result = await apiManager.getOdePageExportDownload('yjs-123', 'page-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/export/yjs-123/elpx-page',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify({
            rootPageId: 'page-1',
            structure: mockStructure
          })
        })
      );
      
      localStorage.removeItem('authToken');
    });

    it('should handle fetch errors', async () => {
      apiManager.endpoints.api_ode_export_download = {
        path: 'http://localhost/export/{odeSessionId}/{exportType}',
      };
      global.fetch = vi.fn().mockResolvedValue({ 
        ok: false, 
        status: 500,
        text: () => Promise.resolve('{"error":"fail"}') 
      });

      await expect(apiManager.getOdePageExportDownload('yjs-123', 'page-1'))
        .rejects.toThrow('fail');
    });
  });

  describe('extractLinksForValidation', () => {
    it('should call func.postJson with correct params', async () => {
      apiManager.apiUrlBase = 'http://localhost';
      apiManager.apiUrlBasePath = '/exelearning';
      
      const params = { odeSessionId: 's1', idevices: [] };
      await apiManager.extractLinksForValidation(params);

      expect(mockFunc.postJson).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/ode-management/odes/session/brokenlinks/extract',
        params
      );
    });
  });

  describe('getLinkValidationStreamUrl', () => {
    it('should return correct stream url', () => {
      apiManager.apiUrlBase = 'http://localhost';
      apiManager.apiUrlBasePath = '/exelearning';

      const url = apiManager.getLinkValidationStreamUrl();

      expect(url).toBe('http://localhost/exelearning/api/ode-management/odes/session/brokenlinks/validate-stream');
    });
  });

  describe('static mode', () => {
    describe('_isStaticMode', () => {
      it('should detect static mode from capabilities.storage.remote = false', () => {
        mockApp.capabilities = { storage: { remote: false } };

        const result = apiManager._isStaticMode();

        expect(result).toBe(true);
      });

      it('should return false when storage.remote is true', () => {
        mockApp.capabilities = { storage: { remote: true } };

        const result = apiManager._isStaticMode();

        expect(result).toBe(false);
      });

      it('should return false when capabilities are missing', () => {
        mockApp.capabilities = null;

        const result = apiManager._isStaticMode();

        expect(result).toBe(false);
      });

      it('should return false when storage is missing', () => {
        mockApp.capabilities = {};

        const result = apiManager._isStaticMode();

        expect(result).toBe(false);
      });
    });

    describe('init', () => {
      beforeEach(() => {
        mockApp.capabilities = { storage: { remote: false } };
      });

      it('should use window.__EXE_STATIC_DATA__ when available', async () => {
        window.__EXE_STATIC_DATA__ = {
          parameters: { routes: { test: { path: '/test' } } },
          translations: { en: { translations: { hello: 'Hello' } } },
          idevices: { idevices: [{ id: 'text' }] },
          themes: { themes: [{ id: 'base' }] },
        };
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await apiManager.init();

        expect(apiManager.staticData).toBe(window.__EXE_STATIC_DATA__);
        expect(apiManager.parameters).toEqual(window.__EXE_STATIC_DATA__.parameters);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('window.__EXE_STATIC_DATA__'));

        delete window.__EXE_STATIC_DATA__;
        logSpy.mockRestore();
      });

      it('should load bundle.json when __EXE_STATIC_DATA__ is not available', async () => {
        const mockBundleData = {
          parameters: { routes: { api_test: { path: '/api/test' } } },
          translations: { en: { translations: {} } },
          idevices: { idevices: [] },
          themes: { themes: [] },
        };
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBundleData),
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await apiManager.init();

        expect(global.fetch).toHaveBeenCalledWith('./data/bundle.json');
        expect(apiManager.staticData).toEqual(mockBundleData);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('bundle.json'));
        logSpy.mockRestore();
      });

      it('should use empty defaults when bundle.json fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await apiManager.init();

        expect(apiManager.staticData).toEqual({
          parameters: { routes: {} },
          translations: { en: { translations: {} } },
          idevices: { idevices: [] },
          themes: { themes: [] },
        });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No static data source'));
        warnSpy.mockRestore();
      });

      it('should use empty defaults when bundle.json throws error', async () => {
        global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await apiManager.init();

        expect(apiManager.staticData).toEqual({
          parameters: { routes: {} },
          translations: { en: { translations: {} } },
          idevices: { idevices: [] },
          themes: { themes: [] },
        });
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error loading static bundle'),
          expect.any(Error)
        );
        warnSpy.mockRestore();
      });

      it('should skip loading when not in static mode', async () => {
        mockApp.capabilities = { storage: { remote: true } };
        global.fetch = vi.fn();

        await apiManager.init();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(apiManager.staticData).toBeNull();
      });

      it('should not reload if already initialized', async () => {
        window.__EXE_STATIC_DATA__ = { parameters: { routes: {} } };
        apiManager.staticData = window.__EXE_STATIC_DATA__;
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await apiManager.init();

        // Should not log again since data is already loaded
        expect(logSpy).not.toHaveBeenCalled();
        delete window.__EXE_STATIC_DATA__;
        logSpy.mockRestore();
      });
    });

    describe('getApiParameters in static mode', () => {
      it('should return static data parameters', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        apiManager.staticData = { parameters: { routes: { test: { path: '/test' } } } };

        const result = await apiManager.getApiParameters();

        expect(result).toEqual({ routes: { test: { path: '/test' } } });
        expect(mockFunc.get).not.toHaveBeenCalled();
      });

      it('should return empty routes if static data missing', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        apiManager.staticData = {};

        const result = await apiManager.getApiParameters();

        expect(result).toEqual({ routes: {} });
      });
    });

    describe('getChangelogText in static mode', () => {
      it('should fetch from composeUrl path', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        mockApp.composeUrl = vi.fn((path) => `/app${path}`);
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('# Changelog'),
        });

        const result = await apiManager.getChangelogText();

        expect(mockApp.composeUrl).toHaveBeenCalledWith('/CHANGELOG.md');
        expect(global.fetch).toHaveBeenCalledWith('/app/CHANGELOG.md');
        expect(result).toBe('# Changelog');
      });

      it('should return fallback when fetch fails', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        mockApp.composeUrl = vi.fn((path) => `/app${path}`);
        global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
        global._ = vi.fn((s) => s);

        const result = await apiManager.getChangelogText();

        expect(result).toBe('Changelog not available');
      });
    });

    describe('getUploadLimits in static mode', () => {
      it('should return default limits when DataProvider is set', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        apiManager._dataProvider = {
          getUploadLimits: vi.fn().mockResolvedValue({
            maxFileSize: 100 * 1024 * 1024,
            maxFileSizeFormatted: '100 MB',
            limitingFactor: 'none',
          }),
        };

        const result = await apiManager.getUploadLimits();

        expect(result.maxFileSize).toBe(100 * 1024 * 1024);
        expect(result.limitingFactor).toBe('none');
      });

      it('should return fallback defaults before DataProvider init', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        apiManager._dataProvider = null;

        const result = await apiManager.getUploadLimits();

        expect(result.maxFileSize).toBe(100 * 1024 * 1024);
        expect(result.maxFileSizeFormatted).toBe('100 MB');
        expect(result.details.isStatic).toBe(true);
      });
    });

    describe('getOdeSessionUsedFiles in static mode', () => {
      it('should call _getUsedFilesFromYjs when in static mode', async () => {
        mockApp.capabilities = { storage: { remote: false } };
        const spy = vi.spyOn(apiManager, '_getUsedFilesFromYjs').mockResolvedValue({
          responseMessage: 'OK',
          usedFiles: [{ usedFiles: 'test.jpg' }],
        });

        const result = await apiManager.getOdeSessionUsedFiles({ id: 1 });

        expect(spy).toHaveBeenCalled();
        expect(result.usedFiles).toHaveLength(1);
        spy.mockRestore();
      });

      it('should call API when not in static mode', async () => {
        mockApp.capabilities = { storage: { remote: true } };
        apiManager.endpoints.api_odes_session_get_used_files = { path: 'http://localhost/used-files' };

        await apiManager.getOdeSessionUsedFiles({ id: 1 });

        expect(mockFunc.postJson).toHaveBeenCalledWith('http://localhost/used-files', { id: 1 });
      });
    });
  });

  describe('_getUsedFilesFromYjs', () => {
    it('should return empty array when structureBinding is not available', async () => {
      mockApp.project = { _yjsBridge: {} };
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result).toEqual({ responseMessage: 'OK', usedFiles: [] });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No structureBinding'));
      warnSpy.mockRestore();
    });

    it('should extract assets from htmlContent', async () => {
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return '<img src="asset://abc-123/test.jpg">';
          if (key === 'jsonProperties') return '{}';
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1', pageName: 'Page One' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1', blockName: 'Block' }]),
        getComponents: vi.fn(() => [{
          id: 'comp-1',
          ideviceType: 'TextIdevice',
          order: 1,
          _ymap: mockYmap,
        }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: 'abc-123', name: 'test.jpg', size: 1024 },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.responseMessage).toBe('OK');
      expect(result.usedFiles).toHaveLength(1);
      expect(result.usedFiles[0].usedFiles).toBe('test.jpg');
      expect(result.usedFiles[0].usedFilesPath).toBe('asset://abc-123');
      expect(result.usedFiles[0].pageNamesUsedFiles).toBe('Page One');
    });

    it('should extract assets from jsonProperties', async () => {
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return '';
          if (key === 'jsonProperties') return '{"textArea":"<img src=\\"asset://def-456/photo.png\\">"}';
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1', pageName: 'Page' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1', blockName: '' }]),
        getComponents: vi.fn(() => [{ id: 'comp-1', _ymap: mockYmap }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: 'def-456', name: 'photo.png', size: 2048 },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.usedFiles).toHaveLength(1);
      expect(result.usedFiles[0].usedFilesPath).toBe('asset://def-456');
    });

    it('should extract assets from htmlView fallback', async () => {
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return null;
          if (key === 'htmlView') return '<img src="asset://ghi-789/image.gif">';
          if (key === 'jsonProperties') return null;
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1' }]),
        getComponents: vi.fn(() => [{ id: 'comp-1', _ymap: mockYmap }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { uuid: 'ghi-789', filename: 'image.gif' },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.usedFiles).toHaveLength(1);
      expect(result.usedFiles[0].usedFilesPath).toBe('asset://ghi-789');
    });

    it('should handle Y.Text objects in htmlContent', async () => {
      const mockYText = {
        toString: vi.fn(() => '<img src="asset://ytext-id/doc.pdf">'),
      };
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return mockYText;
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1' }]),
        getComponents: vi.fn(() => [{ id: 'comp-1', _ymap: mockYmap }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: 'ytext-id', name: 'doc.pdf' },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(mockYText.toString).toHaveBeenCalled();
      expect(result.usedFiles[0].usedFilesPath).toBe('asset://ytext-id');
    });

    it('should handle assets without usage context', async () => {
      const structureBinding = {
        getPages: vi.fn(() => []),
        getBlocks: vi.fn(() => []),
        getComponents: vi.fn(() => []),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: 'orphan-123', name: 'orphan.jpg', size: 512 },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.usedFiles).toHaveLength(1);
      expect(result.usedFiles[0].pageNamesUsedFiles).toBe('-');
      expect(result.usedFiles[0].blockNamesUsedFiles).toBe('-');
      expect(result.usedFiles[0].typeComponentSyncUsedFiles).toBe('-');
    });

    it('should deduplicate assets by URL', async () => {
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return '<img src="asset://dup-id/img.jpg"><img src="asset://dup-id/img.jpg">';
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1' }]),
        getComponents: vi.fn(() => [{ id: 'comp-1', _ymap: mockYmap }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: 'dup-id', name: 'img.jpg', size: 100 },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.usedFiles).toHaveLength(1);
    });

    it('should handle assetManager errors gracefully', async () => {
      const structureBinding = {
        getPages: vi.fn(() => []),
        getBlocks: vi.fn(() => []),
        getComponents: vi.fn(() => []),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => {
          throw new Error('IndexedDB error');
        }),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.responseMessage).toBe('OK');
      expect(result.usedFiles).toEqual([]);
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not get assets'),
        expect.any(Error)
      );
      debugSpy.mockRestore();
    });

    it('should strip Idevice suffix from type', async () => {
      // Use valid UUID format (regex expects [a-f0-9-]+)
      const assetId = 'aabbccdd-1234-5678-9abc-def012345678';
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') return `<img src="asset://${assetId}/img.jpg">`;
          return null;
        }),
      };
      const structureBinding = {
        getPages: vi.fn(() => [{ id: 'page-1' }]),
        getBlocks: vi.fn(() => [{ id: 'block-1' }]),
        getComponents: vi.fn(() => [{
          id: 'comp-1',
          ideviceType: 'FreeTextIdevice',
          order: 2,
          _ymap: mockYmap,
        }]),
      };
      const assetManager = {
        getAllAssetsMetadata: vi.fn(() => [
          { id: assetId, name: 'img.jpg' },
        ]),
      };
      mockApp.project = {
        _yjsBridge: { structureBinding, assetManager },
      };

      const result = await apiManager._getUsedFilesFromYjs();

      expect(result.usedFiles[0].typeComponentSyncUsedFiles).toBe('FreeText');
    });
  });

  describe('_formatFileSize', () => {
    it('should return empty string for 0 bytes', () => {
      expect(apiManager._formatFileSize(0)).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(apiManager._formatFileSize(null)).toBe('');
      expect(apiManager._formatFileSize(undefined)).toBe('');
    });

    it('should format bytes', () => {
      expect(apiManager._formatFileSize(500)).toBe('500.0 B');
      expect(apiManager._formatFileSize(1)).toBe('1.0 B');
    });

    it('should format kilobytes', () => {
      expect(apiManager._formatFileSize(1024)).toBe('1.0 KB');
      expect(apiManager._formatFileSize(1536)).toBe('1.5 KB');
      expect(apiManager._formatFileSize(10240)).toBe('10.0 KB');
    });

    it('should format megabytes', () => {
      expect(apiManager._formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(apiManager._formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(apiManager._formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(apiManager._formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(apiManager._formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });

    it('should cap at GB for very large files', () => {
      const terabyte = 1024 * 1024 * 1024 * 1024;
      expect(apiManager._formatFileSize(terabyte)).toBe('1024.0 GB');
    });
  });
});
