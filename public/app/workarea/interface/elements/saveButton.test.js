import SaveProjectButton from './saveButton.js';

describe('SaveProjectButton', () => {
  let saveButton;
  let mockButton;
  let mockCheckOpenIdevice;
  let mockDownloadProjectEvent;
  let mockSave;
  let mockSaveManager;
  let mockBridge;

  beforeEach(() => {
    // Mock DOM element
    mockButton = {
      addEventListener: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock eXeLearning global
    mockCheckOpenIdevice = vi.fn(() => false);
    mockDownloadProjectEvent = vi.fn();
    mockSave = vi.fn().mockResolvedValue(undefined);
    mockSaveManager = {
      save: vi.fn().mockResolvedValue({ success: true }),
    };
    mockBridge = {
      saveManager: mockSaveManager,
    };

    window.eXeLearning = {
      app: {
        project: {
          checkOpenIdevice: mockCheckOpenIdevice,
          save: mockSave,
          _yjsBridge: mockBridge,
          realTimeEventNotifier: {
            notify: vi.fn(),
          },
          odeSession: 'test-session',
        },
        menus: {
          navbar: {
            file: {
              downloadProjectEvent: mockDownloadProjectEvent,
            },
          },
        },
      },
      config: {
        isOfflineInstallation: false,
      },
    };

    saveButton = new SaveProjectButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should query the save button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-top-save-button');
    });

    it('should store the button element reference', () => {
      expect(saveButton.saveMenuHeadButton).toBe(mockButton);
    });

    it('should initialize isSaving to false', () => {
      expect(saveButton.isSaving).toBe(false);
    });
  });

  describe('init', () => {
    it('should call addEventClick', () => {
      const spy = vi.spyOn(saveButton, 'addEventClick');
      saveButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      saveButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should return early if idevice is open', async () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      saveButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(mockDownloadProjectEvent).not.toHaveBeenCalled();
      expect(saveButton.isSaving).toBe(false);
    });

    it('should prevent double clicks while saving', async () => {
      saveButton.isSaving = true;
      saveButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      // Should not call download or save when already saving
      expect(mockDownloadProjectEvent).not.toHaveBeenCalled();
      expect(mockSaveManager.save).not.toHaveBeenCalled();
    });

    it('should notify real-time collaborators', async () => {
      saveButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(window.eXeLearning.app.project.realTimeEventNotifier.notify).toHaveBeenCalledWith(
        'test-session',
        {
          name: 'save-menu-head-button',
          payload: true,
        }
      );
    });

    it('should call downloadProjectEvent in offline mode', async () => {
      window.eXeLearning.config.isOfflineInstallation = true;
      saveButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockDownloadProjectEvent).toHaveBeenCalled();
      expect(mockSaveManager.save).not.toHaveBeenCalled();
    });

    it('should call saveToServer in online mode', async () => {
      window.eXeLearning.config.isOfflineInstallation = false;
      const spy = vi.spyOn(saveButton, 'saveToServer');
      saveButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(spy).toHaveBeenCalled();
      expect(mockDownloadProjectEvent).not.toHaveBeenCalled();
    });
  });

  describe('saveToServer', () => {
    it('should set isSaving to true during save', async () => {
      const savePromise = saveButton.saveToServer();
      expect(saveButton.isSaving).toBe(true);
      await savePromise;
    });

    it('should call setButtonLoading with true at start', async () => {
      const spy = vi.spyOn(saveButton, 'setButtonLoading');
      await saveButton.saveToServer();
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should call saveManager.save with showProgress option', async () => {
      await saveButton.saveToServer();
      expect(mockSaveManager.save).toHaveBeenCalledWith({ showProgress: true });
    });

    it('should complete successfully on successful save', async () => {
      mockSaveManager.save.mockResolvedValue({ success: true });
      await saveButton.saveToServer();
      expect(mockSaveManager.save).toHaveBeenCalled();
      expect(saveButton.isSaving).toBe(false);
    });

    it('should log error on save failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSaveManager.save.mockResolvedValue({ success: false, error: 'Test error' });

      await saveButton.saveToServer();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[SaveButton] Save failed:', 'Test error');
      consoleErrorSpy.mockRestore();
    });

    it('should use legacy save if saveManager not available', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.eXeLearning.app.project._yjsBridge.saveManager = null;

      await saveButton.saveToServer();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[SaveButton] SaveManager not available, using legacy save');
      expect(mockSave).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should use legacy save if bridge not available', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.eXeLearning.app.project._yjsBridge = null;

      await saveButton.saveToServer();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[SaveButton] SaveManager not available, using legacy save');
      expect(mockSave).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should handle save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network error');
      mockSaveManager.save.mockRejectedValue(error);

      await saveButton.saveToServer();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[SaveButton] Save error:', error);
      consoleErrorSpy.mockRestore();
    });

    it('should reset isSaving after save completes', async () => {
      await saveButton.saveToServer();
      expect(saveButton.isSaving).toBe(false);
    });

    it('should reset isSaving even if save fails', async () => {
      mockSaveManager.save.mockRejectedValue(new Error('Test error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await saveButton.saveToServer();

      expect(saveButton.isSaving).toBe(false);
    });

    it('should call setButtonLoading with false at end', async () => {
      const spy = vi.spyOn(saveButton, 'setButtonLoading');
      await saveButton.saveToServer();
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  describe('setButtonLoading', () => {
    it('should add saving class when loading is true', () => {
      saveButton.setButtonLoading(true);
      expect(mockButton.classList.add).toHaveBeenCalledWith('saving');
    });

    it('should set disabled attribute when loading is true', () => {
      saveButton.setButtonLoading(true);
      expect(mockButton.setAttribute).toHaveBeenCalledWith('disabled', 'disabled');
    });

    it('should remove saving class when loading is false', () => {
      saveButton.setButtonLoading(false);
      expect(mockButton.classList.remove).toHaveBeenCalledWith('saving');
    });

    it('should remove disabled attribute when loading is false', () => {
      saveButton.setButtonLoading(false);
      expect(mockButton.removeAttribute).toHaveBeenCalledWith('disabled');
    });

    it('should handle null button gracefully', () => {
      saveButton.saveMenuHeadButton = null;
      expect(() => saveButton.setButtonLoading(true)).not.toThrow();
      expect(() => saveButton.setButtonLoading(false)).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should complete full save flow in online mode', async () => {
      saveButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockSaveManager.save).toHaveBeenCalled();
      expect(saveButton.isSaving).toBe(false);
      expect(mockButton.classList.remove).toHaveBeenCalledWith('saving');
    });

    it('should complete full save flow in offline mode', async () => {
      window.eXeLearning.config.isOfflineInstallation = true;
      saveButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockDownloadProjectEvent).toHaveBeenCalled();
      expect(mockSaveManager.save).not.toHaveBeenCalled();
    });
  });
});
