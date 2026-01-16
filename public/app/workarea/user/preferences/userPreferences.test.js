import UserPreferences from './userPreferences.js';

describe('UserPreferences', () => {
  let userPreferences;
  let mockManager;

  beforeEach(() => {
    // Mock global eXeLearning for server mode (default)
    globalThis.eXeLearning = {
      app: {
        capabilities: { storage: { remote: true } }, // Server mode
        api: {
          parameters: {
            userPreferencesConfig: {
              advancedMode: { value: 'false' },
              versionControl: { value: 'true' },
              locale: { value: 'en' }
            }
          },
          getUserPreferences: vi.fn().mockResolvedValue({
            userPreferences: {
              advancedMode: { value: 'true' },
              versionControl: { value: 'false' },
              locale: { value: 'es' }
            }
          }),
          putSaveUserPreferences: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          getAdapter: vi.fn().mockReturnValue(null)
        },
        modals: {
          properties: {
            show: vi.fn()
          }
        },
        dataProvider: {
          getApiParameters: vi.fn().mockResolvedValue({
            userPreferencesConfig: {
              advancedMode: { value: 'false' },
              versionControl: { value: 'true' },
              locale: { value: 'en' }
            }
          })
        }
      }
    };

    globalThis._ = vi.fn(key => key);

    mockManager = {
      reloadMode: vi.fn(),
      reloadVersionControl: vi.fn(),
      reloadLang: vi.fn().mockResolvedValue(),
      app: globalThis.eXeLearning.app
    };

    userPreferences = new UserPreferences(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.eXeLearning;
    delete globalThis._;
  });

  describe('load (server mode)', () => {
    it('should load initial config and fetch api preferences', async () => {
      await userPreferences.load();

      expect(userPreferences.preferences).toBeDefined();
      expect(mockManager.reloadMode).toHaveBeenCalledWith('true');
      expect(mockManager.reloadVersionControl).toHaveBeenCalledWith('false');
      expect(mockManager.reloadLang).toHaveBeenCalledWith('es');
    });
  });

  describe('load (static mode)', () => {
    beforeEach(() => {
      // Set up static mode
      globalThis.eXeLearning.app.capabilities = { storage: { remote: false } };
    });

    it('should load preferences from DataProvider in static mode', async () => {
      await userPreferences.load();

      expect(globalThis.eXeLearning.app.dataProvider.getApiParameters).toHaveBeenCalled();
      expect(userPreferences.preferences).toBeDefined();
      expect(userPreferences.preferences.advancedMode).toBeDefined();
    });

    it('should use fallback defaults if DataProvider has no config', async () => {
      globalThis.eXeLearning.app.dataProvider.getApiParameters.mockResolvedValue({});

      await userPreferences.load();

      expect(userPreferences.preferences).toBeDefined();
      expect(userPreferences.preferences.locale).toEqual({ title: 'Language', value: 'en', type: 'select' });
    });

    it('should load from adapter if available', async () => {
      const mockAdapter = {
        getPreferences: vi.fn().mockResolvedValue({
          userPreferences: {
            advancedMode: { value: 'true' },
            versionControl: { value: 'false' },
            locale: { value: 'fr' }
          }
        })
      };
      globalThis.eXeLearning.app.api.getAdapter = vi.fn().mockReturnValue(mockAdapter);

      await userPreferences.load();

      expect(mockAdapter.getPreferences).toHaveBeenCalled();
      // After setPreferences, the values should be updated
      expect(userPreferences.preferences.advancedMode.value).toBe('true');
    });
  });

  describe('setPreferences', () => {
    it('should update existing preferences and create new ones from template', () => {
      userPreferences.preferences = {
        testPref: { value: 'old' }
      };
      
      userPreferences.setPreferences({
        testPref: { value: 'new' },
        newPref: { value: 'brand-new' }
      });
      
      expect(userPreferences.preferences.testPref.value).toBe('new');
      expect(userPreferences.preferences.newPref.value).toBe('brand-new');
      expect(userPreferences.preferences.newPref.type).toBe('text'); // from template
    });
  });

  describe('showModalPreferences', () => {
    it('should call modals.properties.show', () => {
      userPreferences.preferences = { some: 'pref' };
      userPreferences.showModalPreferences();
      
      expect(mockManager.app.modals.properties.show).toHaveBeenCalledWith(expect.objectContaining({
        contentId: 'preferences',
        properties: userPreferences.preferences
      }));
    });
  });

  describe('apiSaveProperties (server mode)', () => {
    it('should update local preferences and call api.putSaveUserPreferences', async () => {
      userPreferences.preferences = {
        advancedMode: { value: 'false' },
        locale: { value: 'en' }
      };

      // Mock window.location.reload
      const originalLocation = window.location;
      delete window.location;
      window.location = { reload: vi.fn() };

      await userPreferences.apiSaveProperties({
        advancedMode: 'true',
        locale: 'fr'
      });

      expect(userPreferences.preferences.advancedMode.value).toBe('true');
      expect(globalThis.eXeLearning.app.api.putSaveUserPreferences).toHaveBeenCalledWith({
        advancedMode: 'true',
        locale: 'fr'
      });
      expect(mockManager.reloadMode).toHaveBeenCalledWith('true');
      expect(mockManager.reloadLang).toHaveBeenCalledWith('fr');
      expect(window.location.reload).toHaveBeenCalled();

      window.location = originalLocation;
    });
  });

  describe('apiSaveProperties (static mode)', () => {
    beforeEach(() => {
      // Set up static mode
      globalThis.eXeLearning.app.capabilities = { storage: { remote: false } };
    });

    it('should save preferences via adapter in static mode', async () => {
      const mockAdapter = {
        savePreferences: vi.fn().mockResolvedValue({ success: true })
      };
      globalThis.eXeLearning.app.api.getAdapter = vi.fn().mockReturnValue(mockAdapter);

      userPreferences.preferences = {
        advancedMode: { value: 'false' },
        versionControl: { value: 'true' }
      };

      await userPreferences.apiSaveProperties({
        advancedMode: 'true'
      });

      expect(mockAdapter.savePreferences).toHaveBeenCalledWith({
        advancedMode: 'true'
      });
      expect(globalThis.eXeLearning.app.api.putSaveUserPreferences).not.toHaveBeenCalled();
    });

    it('should not call server API in static mode', async () => {
      userPreferences.preferences = {
        advancedMode: { value: 'false' }
      };

      await userPreferences.apiSaveProperties({
        advancedMode: 'true'
      });

      expect(globalThis.eXeLearning.app.api.putSaveUserPreferences).not.toHaveBeenCalled();
    });
  });
});
