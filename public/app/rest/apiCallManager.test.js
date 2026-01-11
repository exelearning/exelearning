import ApiCallManager from './apiCallManager.js';
import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

vi.mock('./apiCallBaseFunctions.js');

describe('ApiCallManager', () => {
  let apiManager;
  let mockApp;
  let mockFunc;
  let mockCatalog;
  let mockProjectRepo;
  let mockAssets;

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
      // Mock isStaticMode for static mode checks in apiCallManager
      isStaticMode: vi.fn(() => false),
      dataProvider: {
        getApiParameters: vi.fn(),
        getTranslations: vi.fn(),
        getInstalledIdevices: vi.fn(),
        getInstalledThemes: vi.fn(),
      },
    };

    // Mock adapters for the new ports/adapters pattern
    mockCatalog = {
      getApiParameters: vi.fn().mockResolvedValue({ routes: {} }),
      getChangelog: vi.fn().mockResolvedValue('changelog content'),
      getUploadLimits: vi.fn().mockResolvedValue({ maxFileSize: 1024 }),
      getThirdPartyCode: vi.fn().mockResolvedValue('third party code'),
      getLicensesList: vi.fn().mockResolvedValue('licenses'),
      getIDevices: vi.fn().mockResolvedValue([]),
      getThemes: vi.fn().mockResolvedValue([]),
      getTemplates: vi.fn().mockResolvedValue({ templates: [] }),
      getLocales: vi.fn().mockResolvedValue(['en', 'es']),
      getTranslations: vi.fn().mockResolvedValue({}),
      getComponentHtmlTemplate: vi.fn().mockResolvedValue({ responseMessage: 'OK', htmlTemplate: '' }),
      getSaveHtmlView: vi.fn().mockResolvedValue({ responseMessage: 'OK', htmlView: '' }),
      getIdevicesBySessionId: vi.fn().mockResolvedValue([]),
      // Theme methods
      uploadTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      importTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      deleteTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      createTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      updateTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getThemeZip: vi.fn().mockResolvedValue(new Blob(['theme'])),
      // iDevice methods
      uploadIdevice: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      deleteIdevice: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getIdeviceZip: vi.fn().mockResolvedValue(new Blob(['idevice'])),
    };

    mockProjectRepo = {
      list: vi.fn().mockResolvedValue([]),
      getRecent: vi.fn().mockResolvedValue([]),
      openFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      delete: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      save: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      joinSession: vi.fn().mockResolvedValue({ available: true }),
      openLargeLocalFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      openLocalFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getLocalProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK', properties: {} }),
      importToRoot: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      importToRootFromLocal: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getLocalComponents: vi.fn().mockResolvedValue({ responseMessage: 'OK', components: [] }),
      openMultipleLocalFiles: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      importAsChild: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      deleteByDate: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      checkCurrentUsers: vi.fn().mockResolvedValue({ responseMessage: 'OK', currentUsers: 0 }),
      cleanAutosaves: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      closeSession: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getLastUpdated: vi.fn().mockResolvedValue({ lastUpdated: new Date().toISOString() }),
      getConcurrentUsers: vi.fn().mockResolvedValue({ users: [] }),
      getStructure: vi.fn().mockResolvedValue({ structure: null }),
      getProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK', properties: {} }),
      saveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      autoSave: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      saveAs: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
    };

    mockAssets = {
      upload: vi.fn().mockResolvedValue({ url: '/test.png' }),
      getUrl: vi.fn().mockResolvedValue('/asset.png'),
      delete: vi.fn().mockResolvedValue({}),
      getDownloadUrl: vi.fn().mockResolvedValue({ url: '/download.xml', responseMessage: 'OK' }),
    };

    // Additional mock adapters needed for complete coverage
    const mockUserPreferences = {
      acceptLopd: vi.fn().mockResolvedValue({ success: true }),
      getPreferences: vi.fn().mockResolvedValue({ userPreferences: {} }),
      savePreferences: vi.fn().mockResolvedValue({ success: true }),
    };

    const mockLinkValidation = {
      getSessionBrokenLinks: vi.fn().mockResolvedValue({ responseMessage: 'OK', brokenLinks: [] }),
      getValidationStreamUrl: vi.fn().mockReturnValue('http://localhost/validate-stream'),
      getPageBrokenLinks: vi.fn().mockResolvedValue({ brokenLinks: [] }),
      getBlockBrokenLinks: vi.fn().mockResolvedValue({ brokenLinks: [] }),
      getIdeviceBrokenLinks: vi.fn().mockResolvedValue({ brokenLinks: [] }),
    };

    const mockCloudStorage = {
      getGoogleDriveLoginUrl: vi.fn().mockResolvedValue({ url: 'http://google.com/oauth' }),
      getGoogleDriveFolders: vi.fn().mockResolvedValue({ folders: [] }),
      uploadToGoogleDrive: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      getDropboxLoginUrl: vi.fn().mockResolvedValue({ url: 'http://dropbox.com/oauth' }),
      getDropboxFolders: vi.fn().mockResolvedValue({ folders: [] }),
      uploadToDropbox: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
    };

    const mockCollaboration = {
      obtainBlockSync: vi.fn().mockResolvedValue({ responseMessage: 'OK', block: null }),
    };

    const mockExportAdapter = {
      downloadExport: vi.fn().mockResolvedValue(new Blob(['export'])),
      getPreviewUrl: vi.fn().mockResolvedValue({ responseMessage: 'OK', url: '/preview' }),
      downloadIDevice: vi.fn().mockResolvedValue({ url: '', response: '', responseMessage: 'OK' }),
    };

    const mockPlatformIntegration = {
      uploadElp: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      openElp: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
    };

    const mockSharing = {
      getProject: vi.fn().mockResolvedValue({ responseMessage: 'OK', project: { id: 1 } }),
      getSharingInfo: vi.fn().mockResolvedValue({ visibility: 'private', collaborators: [] }),
      updateVisibility: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      addCollaborator: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      removeCollaborator: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      transferOwnership: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
    };

    // Store references for use in tests
    window._mockAdapters = {
      userPreferences: mockUserPreferences,
      linkValidation: mockLinkValidation,
      cloudStorage: mockCloudStorage,
      collaboration: mockCollaboration,
      exportAdapter: mockExportAdapter,
      platformIntegration: mockPlatformIntegration,
      sharing: mockSharing,
    };

    window.eXeLearning = mockApp.eXeLearning;
    window.eXeLearning.app = mockApp;
    global.eXeLearning = window.eXeLearning;

    apiManager = new ApiCallManager(mockApp);
    mockFunc = apiManager.func;

    // Inject all mock adapters
    apiManager.setAdapters({
      catalog: mockCatalog,
      projectRepo: mockProjectRepo,
      assets: mockAssets,
      userPreferences: window._mockAdapters.userPreferences,
      linkValidation: window._mockAdapters.linkValidation,
      cloudStorage: window._mockAdapters.cloudStorage,
      collaboration: window._mockAdapters.collaboration,
      exportAdapter: window._mockAdapters.exportAdapter,
      platformIntegration: window._mockAdapters.platformIntegration,
      sharing: window._mockAdapters.sharing,
    });
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
    it('should call catalog adapter getApiParameters', async () => {
      await apiManager.getApiParameters();
      expect(mockCatalog.getApiParameters).toHaveBeenCalled();
    });
  });

  describe('getChangelogText', () => {
    it('should call catalog adapter getChangelog', async () => {
      const result = await apiManager.getChangelogText();
      expect(mockCatalog.getChangelog).toHaveBeenCalled();
      expect(result).toBe('changelog content');
    });
  });

  describe('getThirdPartyCodeText / getLicensesList', () => {
    it('should call catalog adapter methods', async () => {
      await apiManager.getThirdPartyCodeText();
      await apiManager.getLicensesList();

      expect(mockCatalog.getThirdPartyCode).toHaveBeenCalled();
      expect(mockCatalog.getLicensesList).toHaveBeenCalled();
    });
  });

  describe('getUploadLimits', () => {
    it('should call catalog adapter getUploadLimits', async () => {
      const result = await apiManager.getUploadLimits();
      expect(mockCatalog.getUploadLimits).toHaveBeenCalled();
      expect(result).toEqual({ maxFileSize: 1024 });
    });
  });

  describe('getTemplates', () => {
    it('should call catalog adapter getTemplates with locale', async () => {
      await apiManager.getTemplates('es');
      expect(mockCatalog.getTemplates).toHaveBeenCalledWith('es');
    });
  });

  describe('getRecentUserOdeFiles', () => {
    it('should call projectRepo adapter getRecent', async () => {
      mockProjectRepo.getRecent.mockResolvedValue([{ id: 'p1' }]);

      const result = await apiManager.getRecentUserOdeFiles();

      expect(mockProjectRepo.getRecent).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('should return empty list on error', async () => {
      mockProjectRepo.getRecent.mockRejectedValue(new Error('Network error'));

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
    it('should call catalog adapter methods', async () => {
      await apiManager.getIdevicesInstalled();
      await apiManager.getThemesInstalled();

      expect(mockCatalog.getIDevices).toHaveBeenCalled();
      expect(mockCatalog.getThemes).toHaveBeenCalled();
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
    it('should call catalog adapter getIdevicesBySessionId', async () => {
      mockCatalog.getIdevicesBySessionId.mockResolvedValue([{ id: 1 }]);

      const result = await apiManager.getIdevicesBySessionId('sess-1');

      expect(mockCatalog.getIdevicesBySessionId).toHaveBeenCalledWith('sess-1');
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('upload/import helpers', () => {
    it('should call projectRepo adapter importToRootFromLocal', async () => {
      const payload = { odeSessionId: 's1', odeFileName: 'f', odeFilePath: '/tmp' };

      await apiManager.postImportElpToRootFromLocal(payload);

      expect(mockProjectRepo.importToRootFromLocal).toHaveBeenCalledWith(payload);
    });

    it('should call projectRepo adapter importAsChild with navId', async () => {
      const payload = { odeSessionId: 's1' };

      await apiManager.postImportElpAsChildFromLocal('nav-123', payload);

      expect(mockProjectRepo.importAsChild).toHaveBeenCalledWith('nav-123', payload);
    });
  });

  describe('theme and idevice helpers', () => {
    it('should call catalog adapter updateTheme', async () => {
      await apiManager.putEditTheme('theme-1', { name: 'Theme' });

      expect(mockCatalog.updateTheme).toHaveBeenCalledWith('theme-1', { name: 'Theme' });
    });

    it('should call catalog adapter getThemeZip', async () => {
      await apiManager.getThemeZip('session-1', 'theme-1');

      expect(mockCatalog.getThemeZip).toHaveBeenCalledWith('session-1', 'theme-1');
    });

    it('should call catalog adapter getIdeviceZip', async () => {
      await apiManager.getIdeviceInstalledZip('session-1', 'idevice-1');

      expect(mockCatalog.getIdeviceZip).toHaveBeenCalledWith('session-1', 'idevice-1');
    });
  });

  describe('getUserOdeFiles', () => {
    it('should call projectRepo adapter list and wrap in expected format', async () => {
      const mockProjects = [{ id: 1 }, { id: 2 }];
      mockProjectRepo.list.mockResolvedValue(mockProjects);

      const result = await apiManager.getUserOdeFiles();

      expect(mockProjectRepo.list).toHaveBeenCalled();
      expect(result).toEqual({ odeFiles: { odeFilesSync: mockProjects } });
    });

    it('should return empty list on adapter error', async () => {
      mockProjectRepo.list.mockRejectedValue(new Error('Database error'));
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
    it('should call projectRepo adapter save', async () => {
      window.eXeLearning.odeSessionId = 'sess-1';
      const params = { data: 'test' };

      await apiManager.postOdeSave(params);

      expect(mockProjectRepo.save).toHaveBeenCalledWith('sess-1', params);
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
    it('should update block via Yjs when enabled', async () => {
      const updateBlock = vi.fn();
      mockApp.project = {
        _yjsEnabled: true,
        _yjsBridge: { structureBinding: { updateBlock } },
      };

      const result = await apiManager.putSaveBlock({
        odePagStructureSyncId: 'block-1',
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });

      expect(updateBlock).toHaveBeenCalledWith('block-1', {
        blockName: 'Title',
        iconName: 'Icon',
        order: 2,
      });
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
    it('should call sharing adapter getProject for numeric ID', async () => {
      await apiManager.getProject(123);

      expect(window._mockAdapters.sharing.getProject).toHaveBeenCalledWith(123);
    });

    it('should call sharing adapter getProject for UUID', async () => {
      await apiManager.getProject('uuid-123');

      expect(window._mockAdapters.sharing.getProject).toHaveBeenCalledWith('uuid-123');
    });
  });

  describe('getOdeExportDownload', () => {
    it('should call exportAdapter downloadExport', async () => {
      await apiManager.getOdeExportDownload('yjs-123', 'html5');

      expect(window._mockAdapters.exportAdapter.downloadExport).toHaveBeenCalledWith('yjs-123', 'html5');
    });

    it('should handle different export types', async () => {
      await apiManager.getOdeExportDownload('sess-456', 'scorm2004');

      expect(window._mockAdapters.exportAdapter.downloadExport).toHaveBeenCalledWith('sess-456', 'scorm2004');
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
    it('should call exportAdapter downloadIDevice', async () => {
      await apiManager.getOdeIdevicesDownload('s1', 'b1', 'i1');

      expect(window._mockAdapters.exportAdapter.downloadIDevice).toHaveBeenCalledWith('s1', 'b1', 'i1');
    });
  });

  describe('getFileResourcesForceDownload', () => {
    it('should call assets adapter getDownloadUrl', async () => {
      await apiManager.getFileResourcesForceDownload('file.xml');

      expect(mockAssets.getDownloadUrl).toHaveBeenCalledWith('file.xml');
    });
  });

  describe('postOdeAutosave', () => {
    it('should call projectRepo adapter autoSave', async () => {
      window.eXeLearning.odeSessionId = 'sess-1';

      await apiManager.postOdeAutosave({ data: 'autosave' });

      expect(mockProjectRepo.autoSave).toHaveBeenCalledWith('sess-1', { data: 'autosave' });
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
    it('should call sharing adapter updateVisibility', async () => {
      await apiManager.updateProjectVisibility(1, 'public');

      expect(window._mockAdapters.sharing.updateVisibility).toHaveBeenCalledWith(1, 'public');
    });

    it('should call sharing adapter addCollaborator', async () => {
      await apiManager.addProjectCollaborator(1, 'a@b.com', 'editor');

      expect(window._mockAdapters.sharing.addCollaborator).toHaveBeenCalledWith(1, 'a@b.com', 'editor');
    });

    it('should call sharing adapter removeCollaborator and transferOwnership', async () => {
      await apiManager.removeProjectCollaborator(1, 2);
      await apiManager.transferProjectOwnership(1, 99);

      expect(window._mockAdapters.sharing.removeCollaborator).toHaveBeenCalledWith(1, 2);
      expect(window._mockAdapters.sharing.transferOwnership).toHaveBeenCalledWith(1, 99);
    });
  });

  describe('api wrapper calls via adapters', () => {
    it('should call projectRepo adapter for session operations', async () => {
      await apiManager.postJoinCurrentOdeSessionId({ odeSessionId: 'sess-1' });
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

      expect(mockProjectRepo.joinSession).toHaveBeenCalledWith('sess-1');
      expect(mockProjectRepo.openFile).toHaveBeenCalledWith({ name: 'file' });
      expect(mockProjectRepo.openLargeLocalFile).toHaveBeenCalledWith({ data: 'big' });
      expect(mockProjectRepo.openLocalFile).toHaveBeenCalledWith({ data: 'small' });
      expect(mockProjectRepo.getLocalProperties).toHaveBeenCalledWith({ data: 'xml' });
      expect(mockProjectRepo.importToRoot).toHaveBeenCalledWith({ data: 'root' });
      expect(mockProjectRepo.getLocalComponents).toHaveBeenCalledWith({ data: 'components' });
      expect(mockProjectRepo.openMultipleLocalFiles).toHaveBeenCalledWith({ data: 'multi' });
      expect(mockProjectRepo.delete).toHaveBeenCalledWith({ id: 1 });
      expect(mockProjectRepo.deleteByDate).toHaveBeenCalledWith({ from: '2020' });
      expect(mockProjectRepo.checkCurrentUsers).toHaveBeenCalledWith({ id: 1 });
      expect(mockProjectRepo.cleanAutosaves).toHaveBeenCalledWith({ id: 1 });
      expect(mockProjectRepo.closeSession).toHaveBeenCalledWith({ id: 1 });
    });

    it('should call catalog and userPreferences adapters', async () => {
      await apiManager.postUploadTheme({ data: 'theme' });
      await apiManager.deleteTheme({ id: 1 });
      await apiManager.postNewTheme({ name: 'new' });
      await apiManager.postUploadIdevice({ data: 'idevice' });
      await apiManager.deleteIdeviceInstalled({ id: 2 });
      await apiManager.postUserSetLopdAccepted();
      await apiManager.getUserPreferences();
      await apiManager.putSaveUserPreferences({ mode: 'dark' });

      expect(mockCatalog.uploadTheme).toHaveBeenCalledWith({ data: 'theme' });
      expect(mockCatalog.deleteTheme).toHaveBeenCalledWith({ id: 1 });
      expect(mockCatalog.createTheme).toHaveBeenCalledWith({ name: 'new' });
      expect(mockCatalog.uploadIdevice).toHaveBeenCalledWith({ data: 'idevice' });
      expect(mockCatalog.deleteIdevice).toHaveBeenCalledWith({ id: 2 });
      expect(window._mockAdapters.userPreferences.acceptLopd).toHaveBeenCalled();
      expect(window._mockAdapters.userPreferences.getPreferences).toHaveBeenCalled();
      expect(window._mockAdapters.userPreferences.savePreferences).toHaveBeenCalledWith({ mode: 'dark' });
    });
  });

  describe('getUserPreferences', () => {
    it('should call userPreferences adapter getPreferences', async () => {
      const result = await apiManager.getUserPreferences();

      expect(window._mockAdapters.userPreferences.getPreferences).toHaveBeenCalled();
      expect(result).toEqual({ userPreferences: {} });
    });

    it('should return adapter response', async () => {
      window._mockAdapters.userPreferences.getPreferences.mockResolvedValueOnce({
        userPreferences: {
          locale: { value: 'es' },
          advancedMode: { value: 'true' },
        },
      });

      const result = await apiManager.getUserPreferences();

      expect(result.userPreferences.locale.value).toBe('es');
      expect(result.userPreferences.advancedMode.value).toBe('true');
    });
  });

  describe('putSaveUserPreferences', () => {
    it('should call userPreferences adapter savePreferences', async () => {
      const result = await apiManager.putSaveUserPreferences({ locale: 'es', advancedMode: 'false' });

      expect(window._mockAdapters.userPreferences.savePreferences).toHaveBeenCalledWith({
        locale: 'es',
        advancedMode: 'false',
      });
      expect(result.success).toBe(true);
    });

    it('should return adapter error response', async () => {
      window._mockAdapters.userPreferences.savePreferences.mockResolvedValueOnce({
        success: false,
        error: 'Storage full',
      });

      const result = await apiManager.putSaveUserPreferences({ locale: 'es' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage full');
    });

    it('should call structure and diagnostics endpoints via adapters', async () => {
      await apiManager.getOdeLastUpdated('ode-1');
      await apiManager.getOdeConcurrentUsers('ode-1', 'v1', 's1');
      await apiManager.getOdeStructure('v1', 's1');
      await apiManager.getOdeSessionBrokenLinks({ id: 1 });
      await apiManager.getOdePageBrokenLinks('page-1');
      await apiManager.getOdeBlockBrokenLinks('block-1');
      await apiManager.getOdeIdeviceBrokenLinks('idev-1');
      await apiManager.getOdeProperties('s1');
      await apiManager.putSaveOdeProperties({ id: 1 });

      expect(mockProjectRepo.getLastUpdated).toHaveBeenCalledWith('ode-1');
      expect(mockProjectRepo.getConcurrentUsers).toHaveBeenCalledWith('ode-1', 'v1', 's1');
      expect(mockProjectRepo.getStructure).toHaveBeenCalledWith('v1', 's1');
      expect(window._mockAdapters.linkValidation.getSessionBrokenLinks).toHaveBeenCalledWith({ id: 1 });
      expect(window._mockAdapters.linkValidation.getPageBrokenLinks).toHaveBeenCalledWith('page-1');
      expect(window._mockAdapters.linkValidation.getBlockBrokenLinks).toHaveBeenCalledWith('block-1');
      expect(window._mockAdapters.linkValidation.getIdeviceBrokenLinks).toHaveBeenCalledWith('idev-1');
      expect(mockProjectRepo.getProperties).toHaveBeenCalledWith('s1');
      expect(mockProjectRepo.saveProperties).toHaveBeenCalledWith({ id: 1 });
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

    it('should call translation and cloud endpoints via adapters', async () => {
      await apiManager.getTranslationsAll();
      await apiManager.getTranslations('es');
      await apiManager.getUrlLoginGoogleDrive();
      await apiManager.getFoldersGoogleDrive();
      await apiManager.uploadFileGoogleDrive({ file: 'a' });
      await apiManager.getUrlLoginDropbox();
      await apiManager.getFoldersDropbox();
      await apiManager.uploadFileDropbox({ file: 'b' });

      expect(mockCatalog.getLocales).toHaveBeenCalled();
      expect(mockCatalog.getTranslations).toHaveBeenCalledWith('es');
      expect(window._mockAdapters.cloudStorage.getGoogleDriveLoginUrl).toHaveBeenCalled();
      expect(window._mockAdapters.cloudStorage.getGoogleDriveFolders).toHaveBeenCalled();
      expect(window._mockAdapters.cloudStorage.uploadToGoogleDrive).toHaveBeenCalledWith({ file: 'a' });
      expect(window._mockAdapters.cloudStorage.getDropboxLoginUrl).toHaveBeenCalled();
      expect(window._mockAdapters.cloudStorage.getDropboxFolders).toHaveBeenCalled();
      expect(window._mockAdapters.cloudStorage.uploadToDropbox).toHaveBeenCalledWith({ file: 'b' });
    });

    it('should call component html endpoints via catalog adapter', async () => {
      await apiManager.getComponentHtmlTemplate('comp-1');
      await apiManager.getSaveHtmlView('comp-2');

      expect(mockCatalog.getComponentHtmlTemplate).toHaveBeenCalledWith('comp-1');
      expect(mockCatalog.getSaveHtmlView).toHaveBeenCalledWith('comp-2');
    });

    it('should call idevice save/reorder and preview via adapters', async () => {
      apiManager.endpoints.api_idevices_idevice_data_save = { path: 'http://localhost/idevice/save' };
      apiManager.endpoints.api_idevices_idevice_reorder = { path: 'http://localhost/idevice/reorder' };

      await apiManager.putSaveIdevice({ id: 1 });
      await apiManager.putReorderIdevice({ id: 1 });
      await apiManager.getOdePreviewUrl('sess-1');

      // idevice save/reorder still use func for now
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/idevice/save', { id: 1 });
      expect(mockFunc.put).toHaveBeenCalledWith('http://localhost/idevice/reorder', { id: 1 });
      // preview uses export adapter
      expect(window._mockAdapters.exportAdapter.getPreviewUrl).toHaveBeenCalledWith('sess-1');
    });

    it('should call block sync via collaboration adapter', async () => {
      await apiManager.postObtainOdeBlockSync({ id: 1 });

      expect(window._mockAdapters.collaboration.obtainBlockSync).toHaveBeenCalledWith({ id: 1 });
    });

    it('should call export download via adapter', async () => {
      global.eXeLearning.extension = 'html5';

      await apiManager.getOdeDownload('sess-1');

      expect(window._mockAdapters.exportAdapter.downloadExport).toHaveBeenCalledWith('sess-1', 'html5');
    });
  });

  describe('postOdeImportTheme', () => {
    it('should call catalog adapter importTheme method', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });

      const result = await apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });

      expect(mockCatalog.importTheme).toHaveBeenCalledWith({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });
      expect(result.responseMessage).toBe('OK');
    });

    it('should handle adapter errors gracefully', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });

      mockCatalog.importTheme.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      })).rejects.toThrow('Network error');
    });

    it('should return error response from adapter', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });

      mockCatalog.importTheme.mockResolvedValueOnce({
        responseMessage: 'ERROR',
        error: 'Invalid theme',
      });

      const result = await apiManager.postOdeImportTheme({
        themeDirname: 'test-theme',
        themeZip: mockBlob,
      });

      expect(result.responseMessage).toBe('ERROR');
      expect(result.error).toBe('Invalid theme');
    });
  });

  describe('Yjs-based content extraction', () => {
    let mockStructureBinding;

    beforeEach(() => {
      // Set up mock structureBinding for Yjs
      // Note: _ymap contains raw content before URL resolution (asset:// URLs)
      // while htmlContent is already resolved (blob:// URLs)
      const mockYmap = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') {
            return {
              toString: () => '<p>Test content with <a href="https://example.com">link</a> and <img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890" /></p>',
            };
          }
          if (key === 'jsonProperties') {
            return '{}';
          }
          return null;
        }),
      };

      mockStructureBinding = {
        getPages: vi.fn().mockReturnValue([
          { id: 'page-1', pageName: 'Test Page' },
        ]),
        getBlocks: vi.fn().mockReturnValue([
          { id: 'block-1', blockName: 'Test Block' },
        ]),
        getComponents: vi.fn().mockReturnValue([
          {
            // htmlContent is resolved (blob URLs) - used by link extraction
            htmlContent: '<p>Test content with <a href="https://example.com">link</a> and <img src="blob:http://localhost/uuid" /></p>',
            ideviceType: 'textIdevice',
            order: 1,
            // _ymap contains raw content (asset:// URLs) - used by resource report
            _ymap: mockYmap,
          },
        ]),
      };
    });

    describe('getOdeSessionUsedFiles', () => {
      it('should always use Yjs to extract assets', async () => {
        // Set up Yjs active state
        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: mockStructureBinding,
            assetManager: null,
          },
        };

        const result = await apiManager.getOdeSessionUsedFiles({ id: 1 });

        expect(mockStructureBinding.getPages).toHaveBeenCalled();
        expect(result.responseMessage).toBe('OK');
        expect(result.usedFiles).toBeDefined();
        expect(Array.isArray(result.usedFiles)).toBe(true);
        // Should find the asset:// URL in the htmlContent
        expect(result.usedFiles.length).toBeGreaterThan(0);
        expect(result.usedFiles[0].usedFilesPath).toContain('asset://');
      });

      it('should return empty array with OK response when structureBinding is not available', async () => {
        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: null,
          },
        };

        const result = await apiManager.getOdeSessionUsedFiles({ id: 1 });

        expect(result.responseMessage).toBe('OK');
        expect(result.usedFiles).toEqual([]);
      });

      it('should use AssetManager.getAllAssetsMetadata and include usage location', async () => {
        // Use UUID-like hex values that match the asset regex pattern: /asset:\/\/([a-f0-9-]+)/gi
        const assetId1 = 'aabbccdd-1111-2222-3333-444455556666';
        const assetId2 = 'eeff0011-5555-6666-7777-888899990000';

        // Create a mock with content that includes asset references
        const mockStructureBindingWithAssets = {
          getPages: vi.fn().mockReturnValue([{ id: 'page-1', pageName: 'Test Page' }]),
          getBlocks: vi.fn().mockReturnValue([{ id: 'block-1', blockName: 'Test Block' }]),
          getComponents: vi.fn().mockReturnValue([{
            ideviceType: 'textIdevice',
            order: 1,
            _ymap: {
              get: (key) => key === 'htmlContent' ? `<img src="asset://${assetId1}"/>` : null,
            },
          }]),
        };

        const mockAssetManager = {
          getAllAssetsMetadata: vi.fn().mockReturnValue([
            { id: assetId1, name: 'test.jpg', size: 1024 },
            { id: assetId2, name: 'test2.png', size: 2048 },
          ]),
          getAsset: vi.fn().mockResolvedValue(null),
        };

        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: mockStructureBindingWithAssets,
            assetManager: mockAssetManager,
          },
        };

        const result = await apiManager.getOdeSessionUsedFiles({ id: 1 });

        expect(result.responseMessage).toBe('OK');
        expect(mockAssetManager.getAllAssetsMetadata).toHaveBeenCalled();
        expect(result.usedFiles.length).toBe(2);

        // First asset (assetId1) should have usage location since it's in content
        const asset1File = result.usedFiles.find(f => f.usedFilesPath === `asset://${assetId1}`);
        expect(asset1File.usedFiles).toBe('test.jpg');
        expect(asset1File.pageNamesUsedFiles).toBe('Test Page');
        expect(asset1File.blockNamesUsedFiles).toBe('Test Block');
        expect(asset1File.typeComponentSyncUsedFiles).toBe('text');

        // Second asset (assetId2) is not in content, so location should be '-'
        const asset2File = result.usedFiles.find(f => f.usedFilesPath === `asset://${assetId2}`);
        expect(asset2File.usedFiles).toBe('test2.png');
        expect(asset2File.pageNamesUsedFiles).toBe('-');
      });
    });

    describe('extractLinksForValidation', () => {
      it('should always extract links from Yjs', async () => {
        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: mockStructureBinding,
          },
        };

        const result = await apiManager.extractLinksForValidation({ odeSessionId: 's1', idevices: [] });

        expect(mockStructureBinding.getPages).toHaveBeenCalled();
        expect(result.links).toBeDefined();
        expect(Array.isArray(result.links)).toBe(true);
        // Should find the href URL in the htmlContent
        expect(result.links.length).toBeGreaterThan(0);
        expect(result.links[0].url).toBe('https://example.com');
      });

      it('should skip internal anchors and asset URLs', async () => {
        mockStructureBinding.getComponents.mockReturnValue([
          {
            htmlContent: '<a href="#anchor">Anchor</a><a href="asset://uuid">Asset</a><a href="https://valid.com">Valid</a>',
            ideviceType: 'textIdevice',
            order: 1,
          },
        ]);

        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: mockStructureBinding,
          },
        };

        const result = await apiManager.extractLinksForValidation({ odeSessionId: 's1', idevices: [] });

        // Should only find the valid https link, not anchor or asset
        expect(result.links.length).toBe(1);
        expect(result.links[0].url).toBe('https://valid.com');
      });

      it('should return empty array when structureBinding is not available', async () => {
        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          _yjsBridge: {
            structureBinding: null,
          },
        };

        const result = await apiManager.extractLinksForValidation({ odeSessionId: 's1', idevices: [] });

        expect(result.links).toEqual([]);
        expect(result.totalLinks).toBe(0);
      });
    });

    describe('_formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(apiManager._formatFileSize(0)).toBe('');
        expect(apiManager._formatFileSize(512)).toBe('512.0 B');
        expect(apiManager._formatFileSize(1024)).toBe('1.0 KB');
        expect(apiManager._formatFileSize(1536)).toBe('1.5 KB');
        expect(apiManager._formatFileSize(1048576)).toBe('1.0 MB');
        expect(apiManager._formatFileSize(1073741824)).toBe('1.0 GB');
      });

      it('should return empty string for null/undefined', () => {
        expect(apiManager._formatFileSize(null)).toBe('');
        expect(apiManager._formatFileSize(undefined)).toBe('');
      });
    });
  });
});
