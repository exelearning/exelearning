import UserPreferences from './userPreferences.js';

describe('UserPreferences', () => {
  let userPreferences;
  let mockManager;

  beforeEach(() => {
    // Mock global eXeLearning
    globalThis.eXeLearning = {
      app: {
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
          putSaveUserPreferences: vi.fn().mockResolvedValue({ responseMessage: 'OK' })
        },
        modals: {
          properties: {
            show: vi.fn()
          }
        }
      }
    };

    globalThis._ = vi.fn(key => key);

    mockManager = {
      reloadMode: vi.fn(),
      reloadVersionControl: vi.fn(),
      reloadLang: vi.fn(),
      app: globalThis.eXeLearning.app
    };

    userPreferences = new UserPreferences(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.eXeLearning;
    delete globalThis._;
  });

  describe('load', () => {
    it('should load initial config and fetch api preferences', async () => {
      await userPreferences.load();
      
      expect(userPreferences.preferences).toBeDefined();
      expect(mockManager.reloadMode).toHaveBeenCalledWith('true');
      expect(mockManager.reloadVersionControl).toHaveBeenCalledWith('false');
      expect(mockManager.reloadLang).toHaveBeenCalledWith('es');
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

  describe('apiSaveProperties', () => {
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
      
      // Wait for promise resolution in then()
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockManager.reloadMode).toHaveBeenCalledWith('true');
      expect(window.location.reload).toHaveBeenCalled();

      window.location = originalLocation;
    });
  });
});
