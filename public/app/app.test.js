import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app.js';

// Mock sub-managers to avoid complex side effects and DOM dependencies
vi.mock('./rest/apiCallManager.js');
vi.mock('./locate/locale.js');
vi.mock('./common/app_common.js');
vi.mock('./workarea/idevices/idevicesManager.js');
vi.mock('./workarea/project/projectManager.js');
vi.mock('./workarea/toasts/toastsManager.js');
vi.mock('./workarea/modals/modalsManager.js');
vi.mock('./workarea/interface/interfaceManager.js');
vi.mock('./workarea/menus/menuManager.js');
vi.mock('./workarea/themes/themesManager.js');
vi.mock('./workarea/user/userManager.js');
vi.mock('./common/app_actions.js');
vi.mock('./common/shortcuts.js');
vi.mock('./common/sessionMonitor.js');

describe('App utility methods', () => {
  let appInstance;
  let mockApp;

  beforeEach(() => {
    // Mock global eXeLearning object required by constructor
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":false}',
      symfony: '{"basePath":"/exelearning"}',
    };

    // Mock global _ function for translations
    global._ = (str) => str;

    // Mock DOM elements that might be accessed during construction/init
    document.body.innerHTML = `
      <div id="main"><div id="workarea"><div id="node-content-container"></div></div></div>
      <div id="node-content"></div>
    `;

    mockApp = window.eXeLearning;
    appInstance = new App(mockApp);
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('getBasePath', () => {
    it('returns empty string when basePath is not set', () => {
      appInstance.eXeLearning.symfony.basePath = '';
      expect(appInstance.getBasePath()).toBe('');
    });

    it('returns empty string when basePath is /', () => {
      appInstance.eXeLearning.symfony.basePath = '/';
      expect(appInstance.getBasePath()).toBe('');
    });

    it('returns basePath without trailing slash', () => {
      appInstance.eXeLearning.symfony.basePath = '/app/';
      expect(appInstance.getBasePath()).toBe('/app');
    });

    it('returns basePath without trailing slashes for multiple slashes', () => {
      appInstance.eXeLearning.symfony.basePath = '/app///';
      expect(appInstance.getBasePath()).toBe('/app');
    });

    it('handles undefined basePath', () => {
      appInstance.eXeLearning.symfony.basePath = undefined;
      expect(appInstance.getBasePath()).toBe('');
    });
  });

  describe('composeUrl', () => {
    it('prepends basePath to path', () => {
      appInstance.eXeLearning.symfony.basePath = '/app';
      expect(appInstance.composeUrl('api/test')).toBe('/app/api/test');
    });

    it('handles path starting with slash', () => {
      appInstance.eXeLearning.symfony.basePath = '/app';
      expect(appInstance.composeUrl('/api/test')).toBe('/app/api/test');
    });

    it('returns path with leading slash when no basePath', () => {
      appInstance.eXeLearning.symfony.basePath = '';
      expect(appInstance.composeUrl('api/test')).toBe('/api/test');
    });

    it('handles empty path', () => {
      appInstance.eXeLearning.symfony.basePath = '/app';
      expect(appInstance.composeUrl('')).toBe('/app/');
    });

    it('handles path without argument', () => {
      appInstance.eXeLearning.symfony.basePath = '/app';
      expect(appInstance.composeUrl()).toBe('/app/');
    });
  });

  describe('parseExelearningSymfonyData', () => {
    it('parses JSON from escaped HTML entities', () => {
      window.eXeLearning.user = '{"id":2,"name":"test"}';
      window.eXeLearning.config = '{"isOfflineInstallation":true}';
      window.eXeLearning.symfony = '{"basePath":"/test"}';

      appInstance.parseExelearningSymfonyData();

      expect(window.eXeLearning.user.id).toBe(2);
      expect(window.eXeLearning.config.isOfflineInstallation).toBe(true);
      expect(window.eXeLearning.symfony.basePath).toBe('/test');
    });

    it('forces HTTPS when protocol is https:', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false}';
      window.eXeLearning.symfony = '{"baseURL":"http://localhost","fullURL":"http://localhost/api","changelogURL":"http://localhost/changelog"}';

      // Mock https protocol
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://localhost/test', protocol: 'https:' };

      appInstance.parseExelearningSymfonyData();

      expect(window.eXeLearning.symfony.baseURL).toBe('https://localhost');
      expect(window.eXeLearning.symfony.fullURL).toBe('https://localhost/api');
      expect(window.eXeLearning.symfony.changelogURL).toBe('https://localhost/changelog');

      window.location = originalLocation;
    });

    it('does not change URLs when protocol is http:', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false}';
      window.eXeLearning.symfony = '{"baseURL":"http://localhost"}';

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost/test', protocol: 'http:' };

      appInstance.parseExelearningSymfonyData();

      expect(window.eXeLearning.symfony.baseURL).toBe('http://localhost');

      window.location = originalLocation;
    });

    it('handles test environment mercure override', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false}';
      window.eXeLearning.symfony = '{"environment":"test"}';
      window.eXeLearning.mercure = { url: 'http://test:9080' };

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost:9080/test', protocol: 'http:', port: '9080' };

      appInstance.parseExelearningSymfonyData();

      expect(window.eXeLearning.mercure.url).toBe('http://exelearning:8080/.well-known/mercure');

      window.location = originalLocation;
    });
  });

  describe('showProvisionalDemoWarning', () => {
    it('shows warning for alpha version', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '-1';
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.getElementById('eXeBetaWarning')).not.toBeNull();
    });

    it('shows warning for beta version', async () => {
      window.eXeLearning.version = '4.0-beta';
      window.eXeLearning.expires = '-1';
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.getElementById('eXeBetaWarning')).not.toBeNull();
    });

    it('shows warning for rc version', async () => {
      window.eXeLearning.version = '4.0-rc1';
      window.eXeLearning.expires = '-1';
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.getElementById('eXeBetaWarning')).not.toBeNull();
    });

    it('does not show warning for stable version', async () => {
      window.eXeLearning.version = '4.0';
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.getElementById('eXeBetaWarning')).toBeNull();
    });

    it('shows expiry message for expired offline demo', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '20200101'; // Past date
      document.body.setAttribute('installation-type', 'offline');
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.querySelector('.expired')).not.toBeNull();
    });

    it('shows days remaining for non-expired offline demo', async () => {
      window.eXeLearning.version = '4.0-alpha';
      // Set expiry to far future
      window.eXeLearning.expires = '20991231';
      document.body.setAttribute('installation-type', 'offline');
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      const warning = document.getElementById('eXeBetaWarning');
      expect(warning).not.toBeNull();
    });

    it('does not duplicate warning if already present', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '';
      document.body.innerHTML = '<div id="eXeBetaWarning"></div><div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      const warnings = document.querySelectorAll('#eXeBetaWarning');
      expect(warnings.length).toBe(1);
    });

    it('returns early if node-content element not found', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '';
      document.body.innerHTML = '<div id="other-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.getElementById('eXeBetaWarning')).toBeNull();
    });
  });

  describe('showProvisionalToDoWarning', () => {
    it('does not show warning for stable version', async () => {
      window.eXeLearning.version = '4.0';
      document.body.innerHTML = '<div id="eXeLearningNavbar"><nav><div><ul></ul></div></nav></div>';

      await appInstance.showProvisionalToDoWarning();

      expect(document.getElementById('eXeToDoWarning')).toBeNull();
    });

    it('shows warning for development version', async () => {
      window.eXeLearning.version = '4.0-alpha';
      document.body.innerHTML = '<div id="eXeLearningNavbar"><nav><div><ul></ul></div></nav></div>';

      await appInstance.showProvisionalToDoWarning();

      expect(document.getElementById('eXeToDoWarning')).not.toBeNull();
    });

    it('does not duplicate warning if already present', async () => {
      window.eXeLearning.version = '4.0-alpha';
      document.body.innerHTML = '<div id="eXeLearningNavbar"><nav><div><ul></ul></div></nav></div><div id="eXeToDoWarning"></div>';

      await appInstance.showProvisionalToDoWarning();

      const warnings = document.querySelectorAll('#eXeToDoWarning');
      expect(warnings.length).toBe(1);
    });
  });

  describe('Protocol handler logic', () => {
    it('identifies elp protocol links', () => {
      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      expect(link.closest('a[href="exe-package:elp"]')).toBe(link);
    });

    it('initExePackageProtocolHandler adds click listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      appInstance.initExePackageProtocolHandler();
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('closeYjsConnections', () => {
    it('closes wsProvider when bridge exists', () => {
      const mockDisconnect = vi.fn();
      appInstance.project = {
        _yjsBridge: {
          manager: {
            wsProvider: {
              disconnect: mockDisconnect,
            },
          },
        },
      };

      appInstance.closeYjsConnections('test-reason');

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('closes global yjsDocumentManager when available', () => {
      const mockDisconnect = vi.fn();
      window.yjsDocumentManager = {
        wsProvider: {
          disconnect: mockDisconnect,
        },
      };

      appInstance.closeYjsConnections('test-reason');

      expect(mockDisconnect).toHaveBeenCalled();
      delete window.yjsDocumentManager;
    });

    it('handles missing bridge gracefully', () => {
      appInstance.project = null;
      expect(() => appInstance.closeYjsConnections('test-reason')).not.toThrow();
    });

    it('handles errors during disconnect gracefully', () => {
      appInstance.project = {
        _yjsBridge: {
          manager: {
            wsProvider: {
              disconnect: () => { throw new Error('Test error'); },
            },
          },
        },
      };

      expect(() => appInstance.closeYjsConnections('test-reason')).not.toThrow();
    });
  });

  describe('handleSessionExpiration', () => {
    it('sets sessionExpirationHandled flag', () => {
      appInstance.handleSessionExpiration('test-reason');
      expect(appInstance.sessionExpirationHandled).toBe(true);
    });

    it('returns early if already handled', () => {
      appInstance.sessionExpirationHandled = true;
      const cleanupSpy = vi.fn();
      appInstance.project = { cleanupCurrentIdeviceTimer: cleanupSpy };

      appInstance.handleSessionExpiration('test-reason');

      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('calls cleanupCurrentIdeviceTimer when available', () => {
      const cleanupSpy = vi.fn();
      appInstance.project = { cleanupCurrentIdeviceTimer: cleanupSpy };

      appInstance.handleSessionExpiration('test-reason');

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('destroys Yjs bridge when available', () => {
      const destroySpy = vi.fn();
      appInstance.project = {
        _yjsBridge: { destroy: destroySpy },
      };

      appInstance.handleSessionExpiration('test-reason');

      expect(destroySpy).toHaveBeenCalled();
    });

    it('handles errors during cleanup gracefully', () => {
      appInstance.project = {
        cleanupCurrentIdeviceTimer: () => { throw new Error('Test error'); },
      };

      expect(() => appInstance.handleSessionExpiration('test-reason')).not.toThrow();
    });
  });

  describe('check', () => {
    it('shows alert when filesDirPermission is not checked', async () => {
      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.eXeLearning.symfony.filesDirPermission = {
        checked: false,
        info: ['Error 1', 'Error 2'],
      };

      await appInstance.check();

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.any(String),
        contentId: 'error',
      }));
    });

    it('does not show alert when filesDirPermission is checked', async () => {
      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.eXeLearning.symfony.filesDirPermission = {
        checked: true,
        info: [],
      };

      await appInstance.check();

      expect(showSpy).not.toHaveBeenCalled();
    });
  });

  describe('tmpStringList', () => {
    it('does not throw', async () => {
      await expect(appInstance.tmpStringList()).resolves.not.toThrow();
    });
  });

  describe('addNoTranslateForGoogle', () => {
    it('adds notranslate class to exe-icon elements', async () => {
      document.body.innerHTML = '<span class="exe-icon">icon</span>';
      await appInstance.addNoTranslateForGoogle();
      expect(document.querySelector('.exe-icon').classList.contains('notranslate')).toBe(true);
    });

    it('adds notranslate class to auto-icon elements', async () => {
      document.body.innerHTML = '<span class="auto-icon">icon</span>';
      await appInstance.addNoTranslateForGoogle();
      expect(document.querySelector('.auto-icon').classList.contains('notranslate')).toBe(true);
    });

    it('adds notranslate class to nav_list root-icon elements', async () => {
      document.body.innerHTML = '<div id="nav_list"><span class="root-icon">icon</span></div>';
      await appInstance.addNoTranslateForGoogle();
      expect(document.querySelector('.root-icon').classList.contains('notranslate')).toBe(true);
    });
  });

  describe('runCustomJavaScriptCode', () => {
    it('calls $eXeLearningCustom.init when available', async () => {
      const initSpy = vi.fn();
      window.$eXeLearningCustom = { init: initSpy };

      await appInstance.runCustomJavaScriptCode();

      expect(initSpy).toHaveBeenCalled();
      delete window.$eXeLearningCustom;
    });

    it('does not throw when $eXeLearningCustom is not defined', async () => {
      delete window.$eXeLearningCustom;
      await expect(appInstance.runCustomJavaScriptCode()).resolves.not.toThrow();
    });
  });

  describe('bindElectronDownloadToasts', () => {
    it('returns early when electronAPI is not available', () => {
      delete window.electronAPI;
      expect(() => appInstance.bindElectronDownloadToasts()).not.toThrow();
    });

    it('registers download handler when electronAPI is available', () => {
      const onDownloadDoneSpy = vi.fn();
      window.electronAPI = { onDownloadDone: onDownloadDoneSpy };

      appInstance.bindElectronDownloadToasts();

      expect(onDownloadDoneSpy).toHaveBeenCalled();
      delete window.electronAPI;
    });

    it('creates success toast on successful download', () => {
      const createToastSpy = vi.fn();
      appInstance.toasts = { createToast: createToastSpy };

      let downloadCallback;
      window.electronAPI = {
        onDownloadDone: (cb) => { downloadCallback = cb; },
      };

      appInstance.bindElectronDownloadToasts();
      downloadCallback({ ok: true, path: '/test/path.elpx' });

      expect(createToastSpy).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'task_alt',
      }));
      delete window.electronAPI;
    });

    it('creates error toast on failed download', () => {
      const createToastSpy = vi.fn();
      appInstance.toasts = { createToast: createToastSpy };

      let downloadCallback;
      window.electronAPI = {
        onDownloadDone: (cb) => { downloadCallback = cb; },
      };

      appInstance.bindElectronDownloadToasts();
      downloadCallback({ ok: false, error: 'Test error' });

      expect(createToastSpy).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'error',
        error: true,
      }));
      delete window.electronAPI;
    });
  });

  describe('bindElectronFileOpenHandler', () => {
    it('returns early when electronAPI is not available', () => {
      delete window.electronAPI;
      expect(() => appInstance.bindElectronFileOpenHandler()).not.toThrow();
    });

    it('registers file open handler when electronAPI is available', () => {
      const onOpenFileSpy = vi.fn();
      window.electronAPI = { onOpenFile: onOpenFileSpy };

      appInstance.bindElectronFileOpenHandler();

      expect(onOpenFileSpy).toHaveBeenCalled();
      delete window.electronAPI;
    });
  });

  describe('openFileFromPath', () => {
    it('handles file read error', async () => {
      window.electronAPI = {
        readFile: vi.fn().mockResolvedValue({ ok: false, error: 'Read error' }),
      };

      await appInstance.openFileFromPath('/test/path.elpx');

      // Should return early without throwing
      delete window.electronAPI;
    });

    it('converts base64 to File object and uploads', async () => {
      const largeFilesUploadSpy = vi.fn();
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: largeFilesUploadSpy },
      };

      window.electronAPI = {
        readFile: vi.fn().mockResolvedValue({
          ok: true,
          base64: btoa('test content'),
          mtimeMs: Date.now(),
        }),
        setSavedPath: vi.fn(),
      };

      await appInstance.openFileFromPath('/test/project.elpx');

      expect(largeFilesUploadSpy).toHaveBeenCalledWith(expect.any(File));
      delete window.electronAPI;
    });
  });

  describe('initializedToasts', () => {
    it('calls toasts.init', async () => {
      const initSpy = vi.fn();
      appInstance.toasts = { init: initSpy };

      await appInstance.initializedToasts();

      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('initializedModals', () => {
    it('calls modals.init and behaviour', async () => {
      const initSpy = vi.fn();
      const behaviourSpy = vi.fn();
      appInstance.modals = { init: initSpy, behaviour: behaviourSpy };

      await appInstance.initializedModals();

      expect(initSpy).toHaveBeenCalled();
      expect(behaviourSpy).toHaveBeenCalled();
    });
  });

  describe('initializedShortcuts', () => {
    it('calls shortcuts.init', async () => {
      const initSpy = vi.fn();
      appInstance.shortcuts = { init: initSpy };

      await appInstance.initializedShortcuts();

      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('loadApiParameters', () => {
    it('calls api.loadApiParameters', async () => {
      const loadSpy = vi.fn();
      appInstance.api = { loadApiParameters: loadSpy };

      await appInstance.loadApiParameters();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadIdevicesInstalled', () => {
    it('calls idevices.loadIdevicesFromAPI', async () => {
      const loadSpy = vi.fn();
      appInstance.idevices = { loadIdevicesFromAPI: loadSpy };

      await appInstance.loadIdevicesInstalled();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadThemesInstalled', () => {
    it('calls themes.loadThemesFromAPI', async () => {
      const loadSpy = vi.fn();
      appInstance.themes = { loadThemesFromAPI: loadSpy };

      await appInstance.loadThemesInstalled();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadProject', () => {
    it('calls project.load', async () => {
      const loadSpy = vi.fn();
      appInstance.project = { load: loadSpy };

      await appInstance.loadProject();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadUser', () => {
    it('calls user.loadUserPreferences', async () => {
      const loadSpy = vi.fn();
      appInstance.user = { loadUserPreferences: loadSpy };

      await appInstance.loadUser();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadInstallationType', () => {
    it('calls project.reloadInstallationType', async () => {
      const reloadSpy = vi.fn();
      appInstance.project = { reloadInstallationType: reloadSpy };

      await appInstance.loadInstallationType();

      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('loadLocale', () => {
    it('calls locale.init', async () => {
      const initSpy = vi.fn();
      appInstance.locale = { init: initSpy };

      await appInstance.loadLocale();

      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('selectFirstNodeStructure', () => {
    it('calls project.structure.selectFirst', async () => {
      const selectFirstSpy = vi.fn();
      appInstance.project = { structure: { selectFirst: selectFirstSpy } };

      await appInstance.selectFirstNodeStructure();

      expect(selectFirstSpy).toHaveBeenCalled();
    });
  });

  describe('ideviceEngineBehaviour', () => {
    it('calls project.idevices.behaviour', async () => {
      const behaviourSpy = vi.fn();
      appInstance.project = { idevices: { behaviour: behaviourSpy } };

      await appInstance.ideviceEngineBehaviour();

      expect(behaviourSpy).toHaveBeenCalled();
    });
  });

  describe('showModalLopd', () => {
    it('shows LOPD modal when not accepted', async () => {
      window.eXeLearning.user = { acceptedLopd: false };
      const showSpy = vi.fn();
      const hideSpy = vi.fn();
      const loadModalsContentSpy = vi.fn();

      appInstance.project = { loadModalsContent: loadModalsContentSpy };
      appInstance.interface = { loadingScreen: { hide: hideSpy } };
      appInstance.modals = {
        lopd: {
          show: showSpy,
          modal: { _config: {}, _ignoreBackdropClick: false },
        },
      };

      await appInstance.showModalLopd();

      expect(loadModalsContentSpy).toHaveBeenCalled();
      expect(hideSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalled();
    });

    it('loads project when LOPD is accepted', async () => {
      window.eXeLearning.user = { acceptedLopd: true };
      const loadSpy = vi.fn();
      const checkSpy = vi.spyOn(appInstance, 'check').mockImplementation(() => {});

      appInstance.project = { load: loadSpy };

      await appInstance.showModalLopd();

      expect(loadSpy).toHaveBeenCalled();
      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('setupSessionMonitor', () => {
    it('creates session monitor with correct parameters', () => {
      appInstance.eXeLearning.config.sessionCheckIntervalMs = 30000;

      appInstance.setupSessionMonitor();

      expect(appInstance.sessionMonitor).not.toBeNull();
      expect(window.eXeSessionMonitor).toBe(appInstance.sessionMonitor);
    });

    it('uses default interval when not configured', () => {
      appInstance.eXeLearning.config.sessionCheckIntervalMs = 0;

      appInstance.setupSessionMonitor();

      expect(appInstance.sessionMonitor).not.toBeNull();
    });
  });

  describe('constructor', () => {
    it('sets up session monitor for online installation', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":false}',
        symfony: '{"basePath":""}',
      };

      const app = new App(window.eXeLearning);

      expect(app.sessionMonitor).not.toBeNull();
    });

    it('does not set up session monitor for offline installation', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":true}',
        symfony: '{"basePath":""}',
      };

      const app = new App(window.eXeLearning);

      expect(app.sessionMonitor).toBeNull();
    });

    it('initializes all managers', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":true}',
        symfony: '{"basePath":""}',
      };

      const app = new App(window.eXeLearning);

      expect(app.api).toBeDefined();
      expect(app.locale).toBeDefined();
      expect(app.common).toBeDefined();
      expect(app.toasts).toBeDefined();
      expect(app.idevices).toBeDefined();
      expect(app.themes).toBeDefined();
      expect(app.project).toBeDefined();
      expect(app.interface).toBeDefined();
      expect(app.modals).toBeDefined();
      expect(app.menus).toBeDefined();
      expect(app.user).toBeDefined();
      expect(app.actions).toBeDefined();
      expect(app.shortcuts).toBeDefined();
    });
  });
});
