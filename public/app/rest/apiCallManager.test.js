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
        symfony: {
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

    apiManager = new ApiCallManager(mockApp);
    mockFunc = apiManager.func;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.eXeLearning;
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
        'http://localhost/exelearning/v9.9.9/libs/README'
      );
      expect(mockFunc.getText).toHaveBeenCalledWith(
        'http://localhost/exelearning/v9.9.9/libs/LICENSES'
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
      apiManager.endpoints.api_themes_edit = { path: 'http://localhost/themes/{themeDirName}' };

      await apiManager.putEditTheme('theme-1', { name: 'Theme' });

      expect(mockFunc.put).toHaveBeenCalledWith(
        'http://localhost/themes/theme-1',
        { name: 'Theme' }
      );
    });

    it('should replace params in theme zip download', async () => {
      apiManager.endpoints.api_themes_download = {
        path: 'http://localhost/themes/{odeSessionId}/{themeDirName}',
      };

      await apiManager.getThemeZip('session-1', 'theme-1');

      expect(mockFunc.get).toHaveBeenCalledWith(
        'http://localhost/themes/session-1/theme-1'
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

  describe('postOdeSave', () => {
    it('should call func.post with correct endpoint', async () => {
      apiManager.endpoints.api_odes_ode_save_manual = { path: 'http://localhost/save' };
      const params = { data: 'test' };
      
      await apiManager.postOdeSave(params);
      
      expect(mockFunc.post).toHaveBeenCalledWith('http://localhost/save', params);
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
});
