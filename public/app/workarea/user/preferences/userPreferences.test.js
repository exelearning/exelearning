import UserPreferences from './userPreferences.js';

describe('UserPreferences', () => {
  let userPreferences;
  let mockManager;
  let originalLocalStorage;

  beforeEach(() => {
    // Store original localStorage
    originalLocalStorage = window.localStorage;

    // Mock localStorage
    const store = {};
    window.localStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => Object.keys(store).forEach(key => delete store[key])),
    };

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
          getApiParameters: vi.fn().mockResolvedValue({
            userPreferencesConfig: {
              advancedMode: { value: 'false' },
              versionControl: { value: 'true' },
              locale: { value: 'en' }
            }
          }),
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
      reloadLang: vi.fn().mockResolvedValue(),
      app: globalThis.eXeLearning.app
    };

    userPreferences = new UserPreferences(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.eXeLearning;
    delete globalThis._;
    window.localStorage = originalLocalStorage;
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

    it('should load preferences from API in static mode', async () => {
      await userPreferences.load();

      expect(globalThis.eXeLearning.app.api.getApiParameters).toHaveBeenCalled();
      expect(userPreferences.preferences).toBeDefined();
      expect(userPreferences.preferences.advancedMode).toBeDefined();
    });

    it('should use fallback defaults if API has no config', async () => {
      globalThis.eXeLearning.app.api.getApiParameters.mockResolvedValue({});

      await userPreferences.load();

      expect(userPreferences.preferences).toBeDefined();
      expect(userPreferences.preferences.locale).toEqual({ title: 'Language', value: 'en', type: 'select' });
    });

    it('should load from localStorage if available', async () => {
      // Pre-populate localStorage
      localStorage.setItem('exe_user_preferences', JSON.stringify({
        userPreferences: {
          advancedMode: { value: 'true' },
          versionControl: { value: 'false' },
          locale: { value: 'fr' }
        }
      }));

      await userPreferences.load();

      // After setPreferences, the values should be updated
      expect(userPreferences.preferences.advancedMode.value).toBe('true');
      expect(userPreferences.preferences.locale.value).toBe('fr');
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

    it('should add static mode notice in static mode', async () => {
      // Set up static mode
      globalThis.eXeLearning.app.capabilities = { storage: { remote: false } };

      // Create mock modal element
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      userPreferences.preferences = { some: 'pref' };
      userPreferences.showModalPreferences();

      // Wait for setTimeout (350ms)
      await new Promise(resolve => setTimeout(resolve, 400));

      const notice = document.getElementById('preferences-static-notice');
      expect(notice).not.toBeNull();
      expect(notice.className).toBe('alert alert-info');
      expect(notice.textContent).toBe('Preferences will be applied after refreshing the page.');

      // Cleanup
      document.body.removeChild(mockModal);
    });

    it('should not add static mode notice in server mode', async () => {
      // Server mode is default
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      userPreferences.preferences = { some: 'pref' };
      userPreferences.showModalPreferences();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 400));

      const notice = document.getElementById('preferences-static-notice');
      expect(notice).toBeNull();

      // Cleanup
      document.body.removeChild(mockModal);
    });
  });

  describe('_addStaticModeNotice', () => {
    it('should add notice to modal body', () => {
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      userPreferences._addStaticModeNotice();

      const notice = document.getElementById('preferences-static-notice');
      expect(notice).not.toBeNull();
      expect(notice.getAttribute('role')).toBe('alert');

      // Cleanup
      document.body.removeChild(mockModal);
    });

    it('should not add duplicate notice', () => {
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      // Call twice
      userPreferences._addStaticModeNotice();
      userPreferences._addStaticModeNotice();

      const notices = document.querySelectorAll('#preferences-static-notice');
      expect(notices.length).toBe(1);

      // Cleanup
      document.body.removeChild(mockModal);
    });

    it('should handle missing modal gracefully', () => {
      // No modal in DOM
      expect(() => userPreferences._addStaticModeNotice()).not.toThrow();
    });

    it('should handle modal without body gracefully', () => {
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      // No modal-body child
      document.body.appendChild(mockModal);

      expect(() => userPreferences._addStaticModeNotice()).not.toThrow();

      // Cleanup
      document.body.removeChild(mockModal);
    });
  });

  describe('_showStaticReloadWarning', () => {
    it('should add warning to modal body', () => {
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      userPreferences._showStaticReloadWarning();

      const warning = document.getElementById('preferences-reload-warning');
      expect(warning).not.toBeNull();
      expect(warning.className).toBe('alert alert-warning');

      // Cleanup
      document.body.removeChild(mockModal);
    });

    it('should reuse existing warning element', () => {
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      // Call twice
      userPreferences._showStaticReloadWarning();
      userPreferences._showStaticReloadWarning();

      const warnings = document.querySelectorAll('#preferences-reload-warning');
      expect(warnings.length).toBe(1);

      // Cleanup
      document.body.removeChild(mockModal);
    });

    it('should handle missing modal gracefully', () => {
      expect(() => userPreferences._showStaticReloadWarning()).not.toThrow();
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

    it('should save preferences to localStorage in static mode', async () => {
      userPreferences.preferences = {
        advancedMode: { value: 'false' },
        versionControl: { value: 'true' }
      };

      await userPreferences.apiSaveProperties({
        advancedMode: 'true'
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'exe_user_preferences',
        expect.any(String)
      );
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

    it('should reload versionControl when saving versionControl preference', async () => {
      userPreferences.preferences = {
        versionControl: { value: 'false' }
      };

      await userPreferences.apiSaveProperties({
        versionControl: 'true'
      });

      expect(mockManager.reloadVersionControl).toHaveBeenCalledWith('true');
    });

    it('should show static reload warning when changing locale in static mode', async () => {
      userPreferences.preferences = {
        locale: { value: 'en' }
      };

      // Create mock modal for the warning
      const mockModal = document.createElement('div');
      mockModal.id = 'modalProperties';
      const mockBody = document.createElement('div');
      mockBody.className = 'modal-body';
      mockModal.appendChild(mockBody);
      document.body.appendChild(mockModal);

      await userPreferences.apiSaveProperties({
        locale: 'es'
      });

      // Should show warning instead of reloading page
      const warning = document.getElementById('preferences-reload-warning');
      expect(warning).not.toBeNull();

      // Cleanup
      document.body.removeChild(mockModal);
    });
  });

  describe('loadStaticPreferences error handling', () => {
    beforeEach(() => {
      // Set up static mode
      globalThis.eXeLearning.app.capabilities = { storage: { remote: false } };
    });

    it('should handle localStorage parse errors gracefully', async () => {
      // Set up invalid JSON in localStorage
      localStorage.getItem = vi.fn().mockReturnValue('invalid json {{{');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await userPreferences.loadStaticPreferences();

      expect(warnSpy).toHaveBeenCalledWith(
        '[UserPreferences] Error loading static preferences:',
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });
  });
});
