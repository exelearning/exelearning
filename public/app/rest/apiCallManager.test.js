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
