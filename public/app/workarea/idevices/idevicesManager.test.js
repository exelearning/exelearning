/**
 * IdeviceManager class Tests
 *
 * Unit tests for the IdeviceManager class that coordinates iDevice operations.
 *
 * Run with: make test-frontend
 */

 

import IdeviceManager from './idevicesManager.js';

describe('IdeviceManager', () => {
  let mockApp;

  beforeEach(() => {
    // Mock AppLogger
    window.AppLogger = {
      log: vi.fn(),
    };

    // Mock translation function
    window._ = vi.fn((text) => text);

    // Mock app
    mockApp = {
      eXeLearning: {
        config: {
          fullURL: 'http://localhost:8080',
        },
      },
      api: {
        getIdevicesInstalled: vi.fn().mockResolvedValue({ idevices: [] }),
        endpoints: {
          api_idevices_download_file_resources: {
            path: '/api/idevices/resources',
          },
        },
      },
      modals: {
        idevicemanager: {
          show: vi.fn(),
        },
      },
      project: {
        idevices: {
          behaviour: vi.fn(),
          getIdeviceActive: vi.fn(),
          getIdeviceById: vi.fn(),
          setIdeviceActive: vi.fn(),
          loadScriptDynamically: vi.fn(),
          loadStyleByInsertingIt: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.AppLogger;
    delete window._;
  });

  describe('constructor', () => {
    it('sets app reference', () => {
      const manager = new IdeviceManager(mockApp);
      expect(manager.app).toBe(mockApp);
    });

    it('creates IdevicesList instance', () => {
      const manager = new IdeviceManager(mockApp);
      expect(manager.list).toBeDefined();
      expect(manager.list.manager).toBe(manager);
    });

    it('sets symfonyURL from app config', () => {
      const manager = new IdeviceManager(mockApp);
      expect(manager.symfonyURL).toBe('http://localhost:8080');
    });
  });

  describe('loadIdevicesFromAPI', () => {
    it('delegates to list.load()', async () => {
      const manager = new IdeviceManager(mockApp);
      const loadSpy = vi.spyOn(manager.list, 'load');

      await manager.loadIdevicesFromAPI();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('showModalIdeviceManager', () => {
    it('shows modal with list', () => {
      const manager = new IdeviceManager(mockApp);

      manager.showModalIdeviceManager();

      expect(mockApp.modals.idevicemanager.show).toHaveBeenCalledWith(manager.list);
    });
  });

  describe('ideviceEngineBehaviour', () => {
    it('calls project.idevices.behaviour()', () => {
      const manager = new IdeviceManager(mockApp);

      manager.ideviceEngineBehaviour();

      expect(mockApp.project.idevices.behaviour).toHaveBeenCalled();
    });
  });

  describe('getIdeviceActive', () => {
    it('delegates to project.idevices.getIdeviceActive()', () => {
      const mockActiveIdevice = { id: 'active-idevice' };
      mockApp.project.idevices.getIdeviceActive.mockReturnValue(mockActiveIdevice);

      const manager = new IdeviceManager(mockApp);
      const result = manager.getIdeviceActive();

      expect(mockApp.project.idevices.getIdeviceActive).toHaveBeenCalled();
      expect(result).toBe(mockActiveIdevice);
    });

    it('returns undefined when no active idevice', () => {
      mockApp.project.idevices.getIdeviceActive.mockReturnValue(undefined);

      const manager = new IdeviceManager(mockApp);
      const result = manager.getIdeviceActive();

      expect(result).toBeUndefined();
    });
  });

  describe('getIdeviceById', () => {
    it('delegates to project.idevices.getIdeviceById()', () => {
      const mockIdevice = { id: 'test-id' };
      mockApp.project.idevices.getIdeviceById.mockReturnValue(mockIdevice);

      const manager = new IdeviceManager(mockApp);
      const result = manager.getIdeviceById('test-id');

      expect(mockApp.project.idevices.getIdeviceById).toHaveBeenCalledWith('test-id');
      expect(result).toBe(mockIdevice);
    });

    it('returns null when idevice not found', () => {
      mockApp.project.idevices.getIdeviceById.mockReturnValue(null);

      const manager = new IdeviceManager(mockApp);
      const result = manager.getIdeviceById('non-existing');

      expect(result).toBeNull();
    });
  });

  describe('setIdeviceActive', () => {
    it('delegates to project.idevices.setIdeviceActive()', () => {
      const mockIdevice = { id: 'idevice-to-set' };

      const manager = new IdeviceManager(mockApp);
      manager.setIdeviceActive(mockIdevice);

      expect(mockApp.project.idevices.setIdeviceActive).toHaveBeenCalledWith(mockIdevice);
    });

    it('returns result from setIdeviceActive', () => {
      mockApp.project.idevices.setIdeviceActive.mockReturnValue(true);

      const manager = new IdeviceManager(mockApp);
      const result = manager.setIdeviceActive({ id: 'test' });

      expect(result).toBe(true);
    });
  });

  describe('unsetIdeviceActive', () => {
    it('calls setIdeviceActive with undefined', () => {
      const manager = new IdeviceManager(mockApp);
      manager.unsetIdeviceActive();

      expect(mockApp.project.idevices.setIdeviceActive).toHaveBeenCalledWith(undefined);
    });

    it('returns result from setIdeviceActive', () => {
      mockApp.project.idevices.setIdeviceActive.mockReturnValue(false);

      const manager = new IdeviceManager(mockApp);
      const result = manager.unsetIdeviceActive();

      expect(result).toBe(false);
    });
  });

  describe('getIdeviceInstalled', () => {
    it('delegates to list.getIdeviceInstalled()', () => {
      const mockIdevice = { id: 'installed-idevice' };

      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(mockIdevice);

      const result = manager.getIdeviceInstalled('installed-idevice');

      expect(manager.list.getIdeviceInstalled).toHaveBeenCalledWith('installed-idevice');
      expect(result).toBe(mockIdevice);
    });

    it('returns null when not found', () => {
      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(null);

      const result = manager.getIdeviceInstalled('non-existing');

      expect(result).toBeNull();
    });
  });

  describe('getIdeviceInstallEditionPath', () => {
    it('returns pathEdition when idevice exists', () => {
      const mockIdevice = {
        id: 'text',
        pathEdition: 'http://localhost/idevices/text/edition/',
      };

      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(mockIdevice);

      const result = manager.getIdeviceInstallEditionPath('text');

      expect(result).toBe('http://localhost/idevices/text/edition/');
    });

    it('returns empty string when idevice not found', () => {
      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(null);

      const result = manager.getIdeviceInstallEditionPath('non-existing');

      expect(result).toBe('');
    });
  });

  describe('getIdeviceInstalledExportPath', () => {
    it('returns pathExport when idevice exists', () => {
      const mockIdevice = {
        id: 'quiz',
        pathExport: 'http://localhost/idevices/quiz/export/',
      };

      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(mockIdevice);

      const result = manager.getIdeviceInstalledExportPath('quiz');

      expect(result).toBe('http://localhost/idevices/quiz/export/');
    });

    it('returns empty string when idevice not found', () => {
      const manager = new IdeviceManager(mockApp);
      vi.spyOn(manager.list, 'getIdeviceInstalled').mockReturnValue(null);

      const result = manager.getIdeviceInstalledExportPath('non-existing');

      expect(result).toBe('');
    });
  });
});
