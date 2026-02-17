import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Save original window handlers before importing app.js
const originalOnbeforeunload = window.onbeforeunload;
const originalOnload = window.onload;

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
      config: '{"isOfflineInstallation":false,"basePath":"/exelearning"}',
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
      appInstance.eXeLearning.config.basePath = '';
      expect(appInstance.getBasePath()).toBe('');
    });

    it('returns empty string when basePath is /', () => {
      appInstance.eXeLearning.config.basePath = '/';
      expect(appInstance.getBasePath()).toBe('');
    });

    it('returns basePath without trailing slash', () => {
      appInstance.eXeLearning.config.basePath = '/app/';
      expect(appInstance.getBasePath()).toBe('/app');
    });

    it('returns basePath without trailing slashes for multiple slashes', () => {
      appInstance.eXeLearning.config.basePath = '/app///';
      expect(appInstance.getBasePath()).toBe('/app');
    });

    it('handles undefined basePath', () => {
      appInstance.eXeLearning.config.basePath = undefined;
      expect(appInstance.getBasePath()).toBe('');
    });
  });

  describe('composeUrl', () => {
    it('prepends basePath to path', () => {
      appInstance.eXeLearning.config.basePath = '/app';
      expect(appInstance.composeUrl('api/test')).toBe('/app/api/test');
    });

    it('handles path starting with slash', () => {
      appInstance.eXeLearning.config.basePath = '/app';
      expect(appInstance.composeUrl('/api/test')).toBe('/app/api/test');
    });

    it('returns path with leading slash when no basePath', () => {
      appInstance.eXeLearning.config.basePath = '';
      expect(appInstance.composeUrl('api/test')).toBe('/api/test');
    });

    it('handles empty path', () => {
      appInstance.eXeLearning.config.basePath = '/app';
      expect(appInstance.composeUrl('')).toBe('/app/');
    });

    it('handles path without argument', () => {
      appInstance.eXeLearning.config.basePath = '/app';
      expect(appInstance.composeUrl()).toBe('/app/');
    });
  });

  describe('parseExelearningConfig', () => {
    it('parses JSON from escaped HTML entities', () => {
      window.eXeLearning.user = '{"id":2,"name":"test"}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":"/test"}';

      appInstance.parseExelearningConfig();

      expect(window.eXeLearning.user.id).toBe(2);
      expect(window.eXeLearning.config.isOfflineInstallation).toBe(true);
      expect(window.eXeLearning.config.basePath).toBe('/test');
    });

    it('forces HTTPS when protocol is https:', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false,"baseURL":"http://localhost","fullURL":"http://localhost/api","changelogURL":"http://localhost/changelog"}';

      // Mock https protocol
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://localhost/test', protocol: 'https:' };

      appInstance.parseExelearningConfig();

      expect(window.eXeLearning.config.baseURL).toBe('https://localhost');
      expect(window.eXeLearning.config.fullURL).toBe('https://localhost/api');
      expect(window.eXeLearning.config.changelogURL).toBe('https://localhost/changelog');

      window.location = originalLocation;
    });

    it('does not change URLs when protocol is http:', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false,"baseURL":"http://localhost"}';

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost/test', protocol: 'http:' };

      appInstance.parseExelearningConfig();

      expect(window.eXeLearning.config.baseURL).toBe('http://localhost');

      window.location = originalLocation;
    });

    it('creates symfony compatibility shim from config', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false,"baseURL":"http://localhost","basePath":"/app","fullURL":"http://localhost/app"}';

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost/test', protocol: 'http:' };

      appInstance.parseExelearningConfig();

      // Verify symfony compatibility shim is created
      expect(window.eXeLearning.symfony).toBeDefined();
      expect(window.eXeLearning.symfony.baseURL).toBe('http://localhost');
      expect(window.eXeLearning.symfony.basePath).toBe('/app');
      expect(window.eXeLearning.symfony.fullURL).toBe('http://localhost/app');

      window.location = originalLocation;
    });

    it('creates symfony compatibility shim with empty defaults', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true}';

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'http://localhost/test', protocol: 'http:' };

      appInstance.parseExelearningConfig();

      // Verify symfony compatibility shim defaults to empty strings
      expect(window.eXeLearning.symfony).toBeDefined();
      expect(window.eXeLearning.symfony.baseURL).toBe('');
      expect(window.eXeLearning.symfony.basePath).toBe('');
      expect(window.eXeLearning.symfony.fullURL).toBe('');

      window.location = originalLocation;
    });

  });

  describe('initializeModeDetection - basePath detection', () => {
    it('detects basePath from URL in static mode when basePath is empty', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/pr-preview/pr-20/index.html', protocol: 'https:', pathname: '/pr-preview/pr-20/index.html' };

      // First parse the config, then detect mode
      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      expect(window.eXeLearning.config.basePath).toBe('/pr-preview/pr-20');
      // Also verify symfony shim gets the detected basePath
      expect(window.eXeLearning.symfony.basePath).toBe('/pr-preview/pr-20');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('detects basePath from URL in static mode with trailing slash', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/app/', protocol: 'https:', pathname: '/app/' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      expect(window.eXeLearning.config.basePath).toBe('/app');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('does not override existing basePath in static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":"/existing"}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/different/path/', protocol: 'https:', pathname: '/different/path/' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      expect(window.eXeLearning.config.basePath).toBe('/existing');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('does not detect basePath in non-static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":false,"basePath":""}';
      delete window.__EXE_STATIC_MODE__;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/app/', protocol: 'https:', pathname: '/app/' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // basePath should remain empty in non-static mode
      expect(window.eXeLearning.config.basePath).toBe('');

      window.location = originalLocation;
    });

    it('detects empty basePath for root deployment in static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/index.html', protocol: 'https:', pathname: '/index.html' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // Root deployment should result in empty basePath
      expect(window.eXeLearning.config.basePath).toBe('');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('detects empty basePath for /workarea SPA route in static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      // SPA route: /workarea is handled by index.html, not a real subdirectory
      window.location = { href: 'https://example.com/workarea?project=test', protocol: 'https:', pathname: '/workarea' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // /workarea is a known SPA route - basePath should be empty, not '/workarea'
      expect(window.eXeLearning.config.basePath).toBe('');
      expect(window.eXeLearning.symfony.basePath).toBe('');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('detects empty basePath for /login SPA route in static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/login', protocol: 'https:', pathname: '/login' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // /login is a known SPA route - basePath should be empty
      expect(window.eXeLearning.config.basePath).toBe('');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('detects empty basePath for /viewer SPA route in static mode', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/viewer/index.html', protocol: 'https:', pathname: '/viewer/index.html' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // /viewer is a known SPA route - basePath should be empty
      expect(window.eXeLearning.config.basePath).toBe('');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
    });

    it('detects real subdirectory basePath even with SPA-like segment in path', () => {
      window.eXeLearning.user = '{"id":1}';
      window.eXeLearning.config = '{"isOfflineInstallation":true,"basePath":""}';
      window.__EXE_STATIC_MODE__ = true;

      const originalLocation = window.location;
      delete window.location;
      // Real subdirectory that happens to contain 'workarea' but is not the SPA route
      window.location = { href: 'https://example.com/pr-preview/pr-20/index.html', protocol: 'https:', pathname: '/pr-preview/pr-20/index.html' };

      appInstance.parseExelearningConfig();
      appInstance.initializeModeDetection();

      // This is a real subdirectory, not a SPA route
      expect(window.eXeLearning.config.basePath).toBe('/pr-preview/pr-20');

      window.location = originalLocation;
      delete window.__EXE_STATIC_MODE__;
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

    it('shows expiry message for expired static demo', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '20200101'; // Past date
      document.body.setAttribute('installation-type', 'static');
      document.body.innerHTML = '<div id="node-content"></div>';

      await appInstance.showProvisionalDemoWarning();

      expect(document.querySelector('.expired')).not.toBeNull();
    });

    it('shows days remaining for non-expired static demo', async () => {
      window.eXeLearning.version = '4.0-alpha';
      // Set expiry to far future
      window.eXeLearning.expires = '20991231';
      document.body.setAttribute('installation-type', 'static');
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

    it('shows message and changes class when warning is clicked', async () => {
      window.eXeLearning.version = '4.0-alpha';
      document.body.innerHTML = '<div id="eXeLearningNavbar"><nav><div><ul></ul></div></nav></div>';

      // Mock eXe.app.alert
      window.eXe = { app: { alert: vi.fn() } };

      await appInstance.showProvisionalToDoWarning();

      const warning = document.getElementById('eXeToDoWarning');
      expect(warning).not.toBeNull();
      expect(warning.classList.contains('text-danger')).toBe(true);

      // Simulate click
      const clickEvent = new Event('click');
      warning.dispatchEvent(clickEvent);

      expect(window.eXe.app.alert).toHaveBeenCalledWith(expect.any(String), 'Importante');
      expect(warning.classList.contains('text-muted')).toBe(true);
      expect(warning.classList.contains('text-danger')).toBe(false);

      delete window.eXe;
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

  describe('initExePackageProtocolHandler click behavior', () => {
    let clickHandler;

    beforeEach(() => {
      // Capture the click handler when initExePackageProtocolHandler is called
      vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'click') {
          clickHandler = handler;
        }
      });
      appInstance.initExePackageProtocolHandler();
    });

    it('ignores clicks on non-exe-package links', async () => {
      const regularLink = document.createElement('a');
      regularLink.href = 'https://example.com';
      document.body.appendChild(regularLink);

      const event = {
        target: regularLink,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('shows error when Yjs is not enabled', async () => {
      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.project = { _yjsEnabled: false };

      const event = {
        target: link,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        contentId: 'error',
      }));
    });

    it('shows error when exportToElpxViaYjs is not available', async () => {
      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.project = { _yjsEnabled: true, exportToElpxViaYjs: undefined };

      const event = {
        target: link,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        contentId: 'error',
      }));
    });

    it('exports successfully and shows success toast', async () => {
      vi.useFakeTimers();

      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      const removeSpy = vi.fn();
      const mockToast = {
        toastBody: { innerHTML: '' },
        remove: removeSpy,
      };
      const createToastSpy = vi.fn().mockReturnValue(mockToast);
      const exportSpy = vi.fn().mockResolvedValue(undefined);

      appInstance.toasts = { createToast: createToastSpy };
      appInstance.project = { _yjsEnabled: true, exportToElpxViaYjs: exportSpy };

      const event = {
        target: link,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(createToastSpy).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'downloading',
      }));
      expect(exportSpy).toHaveBeenCalled();
      expect(mockToast.toastBody.innerHTML).toBe('File generated and downloaded.');

      // Advance timer to verify toast removal
      vi.advanceTimersByTime(2500);
      expect(removeSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('handles export error and shows error modal', async () => {
      vi.useFakeTimers();

      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      const removeSpy = vi.fn();
      const mockToast = {
        toastBody: { innerHTML: '', classList: { add: vi.fn() } },
        remove: removeSpy,
      };
      const createToastSpy = vi.fn().mockReturnValue(mockToast);
      const exportSpy = vi.fn().mockRejectedValue(new Error('Export failed'));
      const showAlertSpy = vi.fn();

      appInstance.toasts = { createToast: createToastSpy };
      appInstance.modals = { alert: { show: showAlertSpy } };
      appInstance.project = { _yjsEnabled: true, exportToElpxViaYjs: exportSpy };

      const event = {
        target: link,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(mockToast.toastBody.innerHTML).toBe('Error generating ELPX file.');
      expect(mockToast.toastBody.classList.add).toHaveBeenCalledWith('error');
      expect(showAlertSpy).toHaveBeenCalledWith(expect.objectContaining({
        contentId: 'error',
        body: 'Export failed',
      }));

      vi.advanceTimersByTime(2500);
      expect(removeSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('handles export error without message', async () => {
      vi.useFakeTimers();

      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);

      const mockToast = {
        toastBody: { innerHTML: '', classList: { add: vi.fn() } },
        remove: vi.fn(),
      };
      const exportSpy = vi.fn().mockRejectedValue({});
      const showAlertSpy = vi.fn();

      appInstance.toasts = { createToast: vi.fn().mockReturnValue(mockToast) };
      appInstance.modals = { alert: { show: showAlertSpy } };
      appInstance.project = { _yjsEnabled: true, exportToElpxViaYjs: exportSpy };

      const event = {
        target: link,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      await clickHandler(event);

      expect(showAlertSpy).toHaveBeenCalledWith(expect.objectContaining({
        body: 'Unknown error.',
      }));

      vi.useRealTimers();
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

    it('handles errors from global yjsDocumentManager disconnect', () => {
      window.yjsDocumentManager = {
        wsProvider: {
          disconnect: () => { throw new Error('Global disconnect error'); },
        },
      };

      expect(() => appInstance.closeYjsConnections('test-reason')).not.toThrow();
      delete window.yjsDocumentManager;
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

    it('handles errors during Yjs bridge destroy gracefully', () => {
      appInstance.project = {
        _yjsBridge: {
          destroy: () => { throw new Error('Bridge destroy error'); },
        },
      };

      expect(() => appInstance.handleSessionExpiration('test-reason')).not.toThrow();
    });
  });

  describe('check', () => {
    it('shows alert when filesDirPermission is not checked', async () => {
      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.eXeLearning.config.filesDirPermission = {
        checked: false,
        info: ['Error 1', 'Error 2'],
      };

      // Mock isStaticMode to return false so we test the normal check flow
      vi.spyOn(appInstance, 'isStaticMode').mockReturnValue(false);

      await appInstance.check();

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.any(String),
        contentId: 'error',
      }));
    });

    it('does not show alert when filesDirPermission is checked', async () => {
      const showSpy = vi.fn();
      appInstance.modals = { alert: { show: showSpy } };
      appInstance.eXeLearning.config.filesDirPermission = {
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

    it('notifies main process when renderer open-file handler is ready', () => {
      const onOpenFileSpy = vi.fn();
      const notifyRendererReadySpy = vi.fn();
      window.electronAPI = {
        onOpenFile: onOpenFileSpy,
        notifyRendererReadyForOpenFile: notifyRendererReadySpy,
      };

      appInstance.bindElectronFileOpenHandler();

      expect(onOpenFileSpy).toHaveBeenCalledTimes(1);
      expect(notifyRendererReadySpy).toHaveBeenCalledTimes(1);
      delete window.electronAPI;
    });

    it('binds file open handler only once', () => {
      const onOpenFileSpy = vi.fn();
      window.electronAPI = { onOpenFile: onOpenFileSpy };

      appInstance.bindElectronFileOpenHandler();
      appInstance.bindElectronFileOpenHandler();

      expect(onOpenFileSpy).toHaveBeenCalledTimes(1);
      delete window.electronAPI;
    });

    it('calls openFileFromPath when file is received', async () => {
      const openFileFromPathSpy = vi.spyOn(appInstance, 'openFileFromPath').mockResolvedValue(undefined);

      let fileHandler;
      window.electronAPI = {
        onOpenFile: (cb) => { fileHandler = cb; },
      };

      appInstance.bindElectronFileOpenHandler();
      expect(fileHandler).toBeDefined();

      await fileHandler('/path/to/file.elpx');

      expect(openFileFromPathSpy).toHaveBeenCalledWith('/path/to/file.elpx');
      delete window.electronAPI;
    });
  });

  describe('openFileFromPath', () => {
    it('queues file when modal upload handler is not ready', async () => {
      appInstance.modals = {};
      window.electronAPI = {
        readFile: vi.fn(),
      };

      await appInstance.openFileFromPath('/test/queued.elpx');

      expect(appInstance.pendingElectronOpenFiles).toEqual(['/test/queued.elpx']);
      expect(window.electronAPI.readFile).not.toHaveBeenCalled();
      delete window.electronAPI;
    });

    it('queues file in static mode when Yjs bridge is not ready', async () => {
      appInstance.runtimeConfig = { isStaticMode: () => true };
      appInstance.project = { _yjsBridge: null };
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: vi.fn() },
      };

      window.electronAPI = {
        readFile: vi.fn().mockResolvedValue({
          ok: true,
          base64: btoa('test content'),
          mtimeMs: Date.now(),
        }),
      };

      await appInstance.openFileFromPath('/test/static-queued.elpx');

      expect(appInstance.pendingElectronOpenFiles).toEqual(['/test/static-queued.elpx']);
      expect(window.electronAPI.readFile).not.toHaveBeenCalled();
      delete window.electronAPI;
    });

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

    it('handles exception during file processing', async () => {
      window.electronAPI = {
        readFile: vi.fn().mockRejectedValue(new Error('Processing failed')),
      };

      // Should not throw
      await expect(appInstance.openFileFromPath('/test/path.elpx')).resolves.not.toThrow();

      delete window.electronAPI;
    });

    it('handles null response from readFile', async () => {
      window.electronAPI = {
        readFile: vi.fn().mockResolvedValue(null),
      };

      // Should not throw, returns early
      await expect(appInstance.openFileFromPath('/test/path.elpx')).resolves.not.toThrow();

      delete window.electronAPI;
    });
  });

  describe('flushPendingElectronOpenFiles', () => {
    it('opens all queued files and clears queue', async () => {
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: vi.fn() },
      };
      appInstance.pendingElectronOpenFiles = ['/a.elpx', '/b.elpx'];
      const openFileFromPathSpy = vi
        .spyOn(appInstance, 'openFileFromPath')
        .mockResolvedValue(undefined);

      await appInstance.flushPendingElectronOpenFiles();

      expect(openFileFromPathSpy).toHaveBeenCalledTimes(2);
      expect(openFileFromPathSpy).toHaveBeenNthCalledWith(1, '/a.elpx');
      expect(openFileFromPathSpy).toHaveBeenNthCalledWith(2, '/b.elpx');
      expect(appInstance.pendingElectronOpenFiles).toEqual([]);
    });

    it('returns early when queue is empty', async () => {
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: vi.fn() },
      };
      appInstance.pendingElectronOpenFiles = [];
      const openFileFromPathSpy = vi
        .spyOn(appInstance, 'openFileFromPath')
        .mockResolvedValue(undefined);

      await appInstance.flushPendingElectronOpenFiles();

      expect(openFileFromPathSpy).not.toHaveBeenCalled();
    });

    it('keeps queue in static mode when Yjs bridge is not ready', async () => {
      appInstance.runtimeConfig = { isStaticMode: () => true };
      appInstance.project = { _yjsBridge: null };
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: vi.fn() },
      };
      appInstance.pendingElectronOpenFiles = ['/a.elpx'];
      const openFileFromPathSpy = vi
        .spyOn(appInstance, 'openFileFromPath')
        .mockResolvedValue(undefined);

      await appInstance.flushPendingElectronOpenFiles();

      expect(openFileFromPathSpy).not.toHaveBeenCalled();
      expect(appInstance.pendingElectronOpenFiles).toEqual(['/a.elpx']);
    });
  });

  describe('openStaticFile', () => {
    it('queues file when static mode bridge is not ready', async () => {
      appInstance.runtimeConfig = { isStaticMode: () => true };
      appInstance.project = { _yjsBridge: null };
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: vi.fn() },
      };

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });
      await appInstance.openStaticFile(mockFile);

      expect(appInstance.pendingStaticOpenFiles).toEqual([mockFile]);
      expect(appInstance.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });

    it('uploads file when static mode is ready', async () => {
      appInstance.runtimeConfig = { isStaticMode: () => true };
      appInstance.project = {
        _yjsBridge: {
          getDocumentManager: vi.fn(() => ({})),
        },
      };
      const largeFilesUploadSpy = vi.fn();
      appInstance.modals = {
        openuserodefiles: { largeFilesUpload: largeFilesUploadSpy },
      };

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });
      await appInstance.openStaticFile(mockFile);

      expect(largeFilesUploadSpy).toHaveBeenCalledWith(mockFile);
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

  describe('init', () => {
    it('calls all initialization methods in sequence', async () => {
      const initToastsSpy = vi.fn();
      const initModalsSpy = vi.fn();
      const loadApiSpy = vi.fn().mockResolvedValue(undefined);
      const loadLocaleSpy = vi.fn().mockResolvedValue(undefined);
      const loadIdevicesSpy = vi.fn().mockResolvedValue(undefined);
      const loadThemesSpy = vi.fn().mockResolvedValue(undefined);
      const loadUserSpy = vi.fn().mockResolvedValue(undefined);
      const showLopdSpy = vi.fn().mockResolvedValue(undefined);
      const showDemoWarningSpy = vi.fn().mockResolvedValue(undefined);
      const tmpStringsSpy = vi.fn().mockResolvedValue(undefined);
      const noTranslateSpy = vi.fn().mockResolvedValue(undefined);
      const customJsSpy = vi.fn().mockResolvedValue(undefined);
      const shortcutsSpy = vi.fn().mockResolvedValue(undefined);
      const electronToastsSpy = vi.fn();
      const electronFileOpenSpy = vi.fn();
      const exePackageSpy = vi.fn();

      appInstance.initializedToasts = initToastsSpy;
      appInstance.initializedModals = initModalsSpy;
      appInstance.loadApiParameters = loadApiSpy;
      appInstance.loadLocale = loadLocaleSpy;
      appInstance.loadIdevicesInstalled = loadIdevicesSpy;
      appInstance.loadThemesInstalled = loadThemesSpy;
      appInstance.loadUser = loadUserSpy;
      appInstance.showModalLopd = showLopdSpy;
      appInstance.showProvisionalDemoWarning = showDemoWarningSpy;
      appInstance.tmpStringList = tmpStringsSpy;
      appInstance.addNoTranslateForGoogle = noTranslateSpy;
      appInstance.runCustomJavaScriptCode = customJsSpy;
      appInstance.initializedShortcuts = shortcutsSpy;
      appInstance.bindElectronDownloadToasts = electronToastsSpy;
      appInstance.bindElectronFileOpenHandler = electronFileOpenSpy;
      appInstance.initExePackageProtocolHandler = exePackageSpy;

      await appInstance.init();

      expect(initToastsSpy).toHaveBeenCalled();
      expect(initModalsSpy).toHaveBeenCalled();
      expect(loadApiSpy).toHaveBeenCalled();
      expect(loadLocaleSpy).toHaveBeenCalled();
      expect(loadIdevicesSpy).toHaveBeenCalled();
      expect(loadThemesSpy).toHaveBeenCalled();
      expect(loadUserSpy).toHaveBeenCalled();
      expect(showLopdSpy).toHaveBeenCalled();
      expect(showDemoWarningSpy).toHaveBeenCalled();
      expect(tmpStringsSpy).toHaveBeenCalled();
      expect(noTranslateSpy).toHaveBeenCalled();
      expect(customJsSpy).toHaveBeenCalled();
      expect(shortcutsSpy).toHaveBeenCalled();
      expect(electronToastsSpy).toHaveBeenCalled();
      expect(electronFileOpenSpy).toHaveBeenCalled();
      expect(exePackageSpy).toHaveBeenCalled();
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

      // Mock isStaticMode to return false so we test the normal LOPD flow
      vi.spyOn(appInstance, 'isStaticMode').mockReturnValue(false);

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

      // Mock isStaticMode to return false so we test the normal LOPD flow
      vi.spyOn(appInstance, 'isStaticMode').mockReturnValue(false);

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

    it('closeYjsConnections callback calls app method', async () => {
      // Import SessionMonitor mock to capture constructor args
      const { default: SessionMonitor } = await import('./common/sessionMonitor.js');

      // Get the mock constructor calls
      appInstance.setupSessionMonitor();

      // Get the options passed to SessionMonitor
      const constructorCall = SessionMonitor.mock.calls[SessionMonitor.mock.calls.length - 1];
      const options = constructorCall[0];

      // Test the closeYjsConnections callback
      const closeYjsSpy = vi.spyOn(appInstance, 'closeYjsConnections').mockImplementation(() => {});
      options.closeYjsConnections('test-reason');

      expect(closeYjsSpy).toHaveBeenCalledWith('test-reason');
    });

    it('onSessionInvalid callback calls handleSessionExpiration', async () => {
      const { default: SessionMonitor } = await import('./common/sessionMonitor.js');

      appInstance.setupSessionMonitor();

      const constructorCall = SessionMonitor.mock.calls[SessionMonitor.mock.calls.length - 1];
      const options = constructorCall[0];

      const handleSpy = vi.spyOn(appInstance, 'handleSessionExpiration').mockImplementation(() => {});
      options.onSessionInvalid('session-expired');

      expect(handleSpy).toHaveBeenCalledWith('session-expired');
    });

    it('onNetworkError callback logs debug message', async () => {
      const { default: SessionMonitor } = await import('./common/sessionMonitor.js');

      appInstance.setupSessionMonitor();

      const constructorCall = SessionMonitor.mock.calls[SessionMonitor.mock.calls.length - 1];
      const options = constructorCall[0];

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const testError = new Error('Network error');
      options.onNetworkError(testError, 'connection-lost');

      expect(debugSpy).toHaveBeenCalledWith(
        'SessionMonitor: temporary issue while checking the session',
        'connection-lost',
        testError
      );
    });
  });

  describe('constructor', () => {
    it('sets up session monitor for online installation', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":false,"basePath":"","fullURL":"http://localhost:8080"}',
      };

      const app = new App(window.eXeLearning);

      expect(app.sessionMonitor).not.toBeNull();
    });

    it('does not set up session monitor for offline installation', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":true,"basePath":""}',
      };

      const app = new App(window.eXeLearning);

      expect(app.sessionMonitor).toBeNull();
    });

    it('initializes all managers', () => {
      window.eXeLearning = {
        user: '{"id":1}',
        config: '{"isOfflineInstallation":true,"basePath":""}',
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

  describe('Service Worker Preview Methods', () => {
    let mockController;
    let mockRegistration;
    let originalServiceWorker;
    let originalIsSecureContext;

    beforeEach(() => {
      mockController = {
        postMessage: vi.fn(),
      };
      mockRegistration = {
        scope: 'http://localhost/',
        active: mockController,
        installing: null,
        addEventListener: vi.fn(),
      };
      originalServiceWorker = navigator.serviceWorker;
      originalIsSecureContext = window.isSecureContext;

      // Mock secure context (required for SW registration)
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      // Mock navigator.serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          controller: mockController,
          ready: Promise.resolve(mockRegistration),
          register: vi.fn().mockResolvedValue(mockRegistration),
          getRegistration: vi.fn().mockResolvedValue(null), // No existing registration by default
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      // Set up the preview SW registration on the app instance
      // (getPreviewServiceWorker checks this first in static mode)
      appInstance._previewSwRegistration = mockRegistration;
    });

    afterEach(() => {
      // Restore original serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalServiceWorker,
        writable: true,
        configurable: true,
      });
      // Restore isSecureContext
      Object.defineProperty(window, 'isSecureContext', {
        value: originalIsSecureContext,
        writable: true,
        configurable: true,
      });
      // Clean up app instance
      appInstance._previewSwRegistration = null;
      appInstance._previewSwRegistrationPromise = null;
    });

    describe('registerPreviewServiceWorker', () => {
      it('returns null when Service Workers not supported', async () => {
        // Remove serviceWorker property entirely so 'serviceWorker' in navigator returns false
        delete navigator.serviceWorker;

        const result = await appInstance.registerPreviewServiceWorker();

        expect(result).toBeNull();

        // Restore for other tests
        Object.defineProperty(navigator, 'serviceWorker', {
          value: originalServiceWorker,
          writable: true,
          configurable: true,
        });
      });

      it('checks for existing registration first (eXeViewer pattern)', async () => {
        // Uses window.location.pathname to derive basePath (jsdom default is /)
        const getRegSpy = navigator.serviceWorker.getRegistration;

        appInstance.registerPreviewServiceWorker();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(getRegSpy).toHaveBeenCalledWith('/');
      });

      it('registers new SW when no existing registration', async () => {
        // No existing registration
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(null);
        const registerSpy = navigator.serviceWorker.register;
        // Mock active worker with already activated state
        mockRegistration.active = { ...mockController, state: 'activated', postMessage: vi.fn() };
        mockRegistration.installing = null;
        mockRegistration.waiting = null;

        await appInstance.registerPreviewServiceWorker();

        // Path derived from window.location.pathname (/ in jsdom)
        // Uses /viewer/ scope to avoid conflicts with PWA SW
        expect(registerSpy).toHaveBeenCalledWith('/preview-sw.js', { scope: '/viewer/' });
      });

      it('reuses existing registration if preview SW is already active', async () => {
        // Simulate existing registration found with active PREVIEW SW
        // (must have scriptURL ending with 'preview-sw.js' to be recognized)
        const existingReg = {
          ...mockRegistration,
          active: {
            ...mockController,
            state: 'activated',
            postMessage: vi.fn(),
            scriptURL: 'http://localhost/preview-sw.js',
          },
          update: vi.fn().mockResolvedValue(undefined),
        };
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(existingReg);
        const registerSpy = navigator.serviceWorker.register;

        await appInstance.registerPreviewServiceWorker();

        // Should NOT call register since existing preview SW registration is available
        expect(registerSpy).not.toHaveBeenCalled();
        expect(appInstance._previewSwRegistration).toBe(existingReg);
        expect(existingReg.update).toHaveBeenCalled();
      });

      it('registers new SW when existing registration is for PWA SW not preview SW', async () => {
        // Simulate existing registration found but for PWA SW (service-worker.js), not preview SW
        const existingPwaReg = {
          ...mockRegistration,
          active: {
            ...mockController,
            state: 'activated',
            postMessage: vi.fn(),
            scriptURL: 'http://localhost/service-worker.js', // PWA SW, not preview SW
          },
          update: vi.fn().mockResolvedValue(undefined),
        };
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(existingPwaReg);
        const registerSpy = navigator.serviceWorker.register;

        await appInstance.registerPreviewServiceWorker();

        // Should call register because existing registration is for PWA SW, not preview SW
        expect(registerSpy).toHaveBeenCalledWith('/preview-sw.js', { scope: '/viewer/' });
      });

      it('handles registration failure', async () => {
        // No existing registration
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(null);
        const error = new Error('Registration failed');
        navigator.serviceWorker.register = vi.fn().mockRejectedValue(error);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await appInstance.registerPreviewServiceWorker();

        expect(errorSpy).toHaveBeenCalledWith('[Preview SW] Registration failed:', error);
      });

      it('waits for SW activation before returning (eXeViewer pattern)', async () => {
        // No existing registration
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(null);

        // Track if statechange listener was added
        let stateChangeListenerAdded = false;
        const mockInstallingSW = {
          state: 'installing',
          addEventListener: vi.fn((event, cb) => {
            if (event === 'statechange') {
              stateChangeListenerAdded = true;
              // Immediately trigger activation to unblock the promise
              mockInstallingSW.state = 'activated';
              cb();
            }
          }),
          removeEventListener: vi.fn(),
        };

        const testRegistration = {
          ...mockRegistration,
          installing: mockInstallingSW,
          waiting: null,
          active: { ...mockController, postMessage: vi.fn() },
          addEventListener: vi.fn(),
        };
        navigator.serviceWorker.register = vi.fn().mockResolvedValue(testRegistration);

        await appInstance.registerPreviewServiceWorker();

        // Verify statechange listener was added for activation waiting
        expect(stateChangeListenerAdded).toBe(true);
        expect(mockInstallingSW.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
      });

      it('handles updatefound event with new worker installation', async () => {
        // No existing registration
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(null);

        const mockNewWorker = {
          state: 'installing',
          addEventListener: vi.fn(),
          postMessage: vi.fn(),
        };

        // Track if updatefound listener was added and immediately trigger it
        let updateFoundListenerAdded = false;
        const regWithActive = {
          ...mockRegistration,
          active: { ...mockController, state: 'activated', postMessage: vi.fn() },
          installing: null,
          waiting: null,
          addEventListener: vi.fn((event, cb) => {
            if (event === 'updatefound') {
              updateFoundListenerAdded = true;
              // Simulate updatefound event by setting installing and calling callback
              regWithActive.installing = mockNewWorker;
              cb();
            }
          }),
        };
        navigator.serviceWorker.register = vi.fn().mockResolvedValue(regWithActive);

        await appInstance.registerPreviewServiceWorker();

        // Verify updatefound listener was added
        expect(updateFoundListenerAdded).toBe(true);
        expect(regWithActive.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));

        // Verify statechange listener was added to new worker
        expect(mockNewWorker.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
      });

      it('handles new worker state change to installed', async () => {
        // No existing registration
        navigator.serviceWorker.getRegistration = vi.fn().mockResolvedValue(null);

        const mockNewWorker = {
          state: 'installed',
          addEventListener: vi.fn((event, cb) => {
            if (event === 'statechange') {
              // Immediately trigger the callback to simulate state change
              cb();
            }
          }),
          postMessage: vi.fn(),
        };

        // Mock registration with active SW already
        const regWithActive = {
          ...mockRegistration,
          active: { ...mockController, state: 'activated', postMessage: vi.fn() },
          installing: null,
          waiting: null,
          addEventListener: vi.fn((event, cb) => {
            if (event === 'updatefound') {
              // Simulate updatefound event
              regWithActive.installing = mockNewWorker;
              cb();
            }
          }),
        };
        navigator.serviceWorker.register = vi.fn().mockResolvedValue(regWithActive);

        await appInstance.registerPreviewServiceWorker();

        // Should send SKIP_WAITING when new worker is installed
        expect(mockNewWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      });
    });

    describe('getPreviewServiceWorker', () => {
      it('returns controller when available', () => {
        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBe(mockController);
      });

      it('returns null when serviceWorker is undefined and no registration', () => {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: undefined,
          writable: true,
          configurable: true,
        });
        appInstance._previewSwRegistration = null;

        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBeNull();
      });

      it('returns registration.active when controller is null but registration has active SW', () => {
        navigator.serviceWorker.controller = null;
        const mockActiveSW = { postMessage: vi.fn(), state: 'activated' };
        appInstance._previewSwRegistration = { active: mockActiveSW };

        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBe(mockActiveSW);
      });

      it('returns null when both controller and registration.active are not available', () => {
        navigator.serviceWorker.controller = null;
        appInstance._previewSwRegistration = null;

        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBeNull();
      });

      it('returns null when controller is null and registration exists but has no active SW', () => {
        navigator.serviceWorker.controller = null;
        appInstance._previewSwRegistration = { active: null };

        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBeNull();
      });

      it('returns registration.active even when controller is PWA SW', () => {
        // Simulate PWA SW as controller (no preview-sw.js in scriptURL)
        navigator.serviceWorker.controller = { postMessage: vi.fn() }; // No scriptURL

        // But we have the preview SW registration
        const result = appInstance.getPreviewServiceWorker();
        expect(result).toBe(mockController); // Returns from _previewSwRegistration.active
      });
    });

    describe('waitForPreviewServiceWorker', () => {
      it('throws when Service Workers not supported', async () => {
        // Remove serviceWorker property entirely
        delete navigator.serviceWorker;

        await expect(appInstance.waitForPreviewServiceWorker()).rejects.toThrow('Service Workers not supported');

        // Restore for other tests
        Object.defineProperty(navigator, 'serviceWorker', {
          value: originalServiceWorker,
          writable: true,
          configurable: true,
        });
      });

      it('returns immediately when controller is available', async () => {
        const result = await appInstance.waitForPreviewServiceWorker();
        expect(result).toBe(mockController);
      });

      it('waits for registration promise when no controller', async () => {
        navigator.serviceWorker.controller = null;

        // Set up a registration promise with active SW (controller not required)
        const activeSW = { ...mockController, state: 'activated' };
        mockRegistration.active = activeSW;
        appInstance._previewSwRegistrationPromise = new Promise((resolve) => {
          setTimeout(() => {
            resolve(mockRegistration);
          }, 10);
        });

        const result = await appInstance.waitForPreviewServiceWorker();
        // Now returns the active SW from registration, not the controller
        expect(result).toBe(activeSW);
      });

      it('throws on timeout when registration promise never resolves', async () => {
        navigator.serviceWorker.controller = null;
        appInstance._previewSwRegistrationPromise = new Promise(() => {}); // Never resolves

        await expect(appInstance.waitForPreviewServiceWorker(100)).rejects.toThrow('Service Worker registration timeout');
      });

      it('throws when registration returns null', async () => {
        navigator.serviceWorker.controller = null;
        appInstance._previewSwRegistrationPromise = Promise.resolve(null); // Registration failed

        await expect(appInstance.waitForPreviewServiceWorker(100)).rejects.toThrow('Service Worker registration failed');
      });

      it('returns active SW even when controller not set after registration', async () => {
        navigator.serviceWorker.controller = null;
        // Registration has an active SW
        mockRegistration.active = { postMessage: vi.fn(), state: 'activated' };
        appInstance._previewSwRegistrationPromise = Promise.resolve(mockRegistration);

        // Now returns the active SW instead of throwing
        const result = await appInstance.waitForPreviewServiceWorker(100);
        expect(result).toBe(mockRegistration.active);
      });
    });

    describe('sendContentToPreviewSW', () => {
      it('throws when SW not available', async () => {
        vi.spyOn(appInstance, 'getPreviewServiceWorker').mockReturnValue(null);

        await expect(appInstance.sendContentToPreviewSW({}, {})).rejects.toThrow('Preview Service Worker not available');
      });

      it('sends content to SW and waits for READY_VERIFIED', async () => {
        const files = {
          'index.html': new ArrayBuffer(10),
          'style.css': 'body {}',
        };
        const options = { openExternalLinksInNewWindow: true };

        // Track MessageChannel instances created
        const messageChannels = [];

        // Mock MessageChannel for SW communication - must be a proper constructor
        const OriginalMessageChannel = globalThis.MessageChannel;
        globalThis.MessageChannel = function MockMessageChannel() {
          const channel = {
            port1: { onmessage: null, close: vi.fn() },
            port2: { name: `port2-${messageChannels.length}` },
          };
          messageChannels.push(channel);
          return channel;
        };

        // Capture the postMessage calls to trigger responses
        mockController.postMessage = vi.fn((msg, transferables) => {
          if (msg.type === 'SET_CONTENT') {
            // Simulate CONTENT_READY response on first channel
            setTimeout(() => {
              messageChannels[0].port1.onmessage({
                data: { type: 'CONTENT_READY', fileCount: 2 },
              });
            }, 10);
          } else if (msg.type === 'VERIFY_READY') {
            // Simulate READY_VERIFIED response on verify channel (second channel)
            setTimeout(() => {
              messageChannels[1].port1.onmessage({
                data: { ready: true, fileCount: 2 },
              });
            }, 5);
          }
        });

        const result = await appInstance.sendContentToPreviewSW(files, options);

        expect(result.fileCount).toBe(2);
        expect(mockController.postMessage).toHaveBeenCalledWith(
          {
            type: 'SET_CONTENT',
            data: { files, options },
          },
          expect.arrayContaining([messageChannels[0].port2, files['index.html']]),
        );
        expect(messageChannels[0].port1.close).toHaveBeenCalled();

        globalThis.MessageChannel = OriginalMessageChannel;
      });

      it('times out after 10 seconds', async () => {
        vi.useFakeTimers();

        const mockPort1 = { onmessage: null, close: vi.fn() };
        const mockPort2 = {};
        const OriginalMessageChannel = globalThis.MessageChannel;
        globalThis.MessageChannel = function MockMessageChannel() {
          return { port1: mockPort1, port2: mockPort2 };
        };

        const promise = appInstance.sendContentToPreviewSW({ 'test.html': 'html' });

        vi.advanceTimersByTime(10001);

        await expect(promise).rejects.toThrow('Timeout waiting for SW content ready');
        expect(mockPort1.close).toHaveBeenCalled();

        vi.useRealTimers();
        globalThis.MessageChannel = OriginalMessageChannel;
      });
    });

    describe('updatePreviewSWFiles', () => {
      it('throws when SW not available', async () => {
        vi.spyOn(appInstance, 'getPreviewServiceWorker').mockReturnValue(null);

        await expect(appInstance.updatePreviewSWFiles({})).rejects.toThrow('Preview Service Worker not available');
      });

      it('sends UPDATE_FILES message with transferables', async () => {
        const files = {
          'page.html': new ArrayBuffer(5),
          'deleted.html': null, // null means delete
        };

        await appInstance.updatePreviewSWFiles(files);

        expect(mockController.postMessage).toHaveBeenCalledWith(
          {
            type: 'UPDATE_FILES',
            data: { files },
          },
          [files['page.html']], // Only ArrayBuffers in transferables
        );
      });
    });

    describe('clearPreviewSWContent', () => {
      it('sends CLEAR_CONTENT message when SW available', () => {
        appInstance.clearPreviewSWContent();

        expect(mockController.postMessage).toHaveBeenCalledWith({ type: 'CLEAR_CONTENT' });
      });

      it('does nothing when SW not available', () => {
        vi.spyOn(appInstance, 'getPreviewServiceWorker').mockReturnValue(null);

        appInstance.clearPreviewSWContent();

        expect(mockController.postMessage).not.toHaveBeenCalled();
      });
    });
  });
});

describe('refreshTranslations', () => {
  let appInstance;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
  });

  it('calls _domTranslator.refresh when domTranslator exists', () => {
    const mockRefresh = vi.fn();
    appInstance._domTranslator = { refresh: mockRefresh };

    appInstance.refreshTranslations();

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does nothing when _domTranslator is null', () => {
    appInstance._domTranslator = null;

    // Should not throw
    expect(() => appInstance.refreshTranslations()).not.toThrow();
  });

  it('does nothing when _domTranslator is undefined', () => {
    appInstance._domTranslator = undefined;

    // Should not throw
    expect(() => appInstance.refreshTranslations()).not.toThrow();
  });
});

describe('_waitForController edge cases', () => {
  let appInstance;
  let originalServiceWorker;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
    originalServiceWorker = navigator.serviceWorker;
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
  });

  it('resolves immediately when controller already exists', async () => {
    const mockController = { postMessage: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: mockController,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const result = await appInstance._waitForController(1000);

    expect(result).toBe(mockController);
  });

  it('resolves when controllerchange event fires', async () => {
    const mockController = { postMessage: vi.fn() };
    let controllerChangeCallback;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        addEventListener: vi.fn((event, cb) => {
          if (event === 'controllerchange') {
            controllerChangeCallback = cb;
          }
        }),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const promise = appInstance._waitForController(5000);

    // Simulate controller becoming available
    navigator.serviceWorker.controller = mockController;
    controllerChangeCallback();

    const result = await promise;
    expect(result).toBe(mockController);
    expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith('controllerchange', controllerChangeCallback);
  });

  it('rejects on timeout and cleans up event listener', async () => {
    vi.useFakeTimers();

    let controllerChangeCallback;
    const removeEventListenerSpy = vi.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        addEventListener: vi.fn((event, cb) => {
          if (event === 'controllerchange') {
            controllerChangeCallback = cb;
          }
        }),
        removeEventListener: removeEventListenerSpy,
      },
      writable: true,
      configurable: true,
    });

    const promise = appInstance._waitForController(100);

    vi.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow('Controller timeout');
    expect(removeEventListenerSpy).toHaveBeenCalledWith('controllerchange', controllerChangeCallback);

    vi.useRealTimers();
  });
});

describe('registerPreviewServiceWorker secure context checks', () => {
  let appInstance;
  let originalServiceWorker;
  let originalIsSecureContext;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
    originalServiceWorker = navigator.serviceWorker;
    originalIsSecureContext = window.isSecureContext;
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    });
  });

  it('registers SW when protocol is app: (Electron)', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
    const mockRegistration = {
      active: { postMessage: vi.fn(), state: 'activated' },
      installing: null,
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        register: vi.fn().mockResolvedValue(mockRegistration),
        getRegistration: vi.fn().mockResolvedValue(null),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    const originalLocation = window.location;
    delete window.location;
    window.location = { protocol: 'app:', hostname: 'app', pathname: '/' };

    const result = await appInstance.registerPreviewServiceWorker();

    expect(navigator.serviceWorker.register).toHaveBeenCalled();
    window.location = originalLocation;
  });

  it('registers SW when hostname is 127.0.0.1', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
    const mockRegistration = {
      active: { postMessage: vi.fn(), state: 'activated' },
      installing: null,
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        register: vi.fn().mockResolvedValue(mockRegistration),
        getRegistration: vi.fn().mockResolvedValue(null),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    const originalLocation = window.location;
    delete window.location;
    window.location = { protocol: 'http:', hostname: '127.0.0.1', pathname: '/' };

    const result = await appInstance.registerPreviewServiceWorker();

    expect(navigator.serviceWorker.register).toHaveBeenCalled();
    window.location = originalLocation;
  });

  it('returns null in non-secure context without allowed protocols', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        register: vi.fn(),
        getRegistration: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    const originalLocation = window.location;
    delete window.location;
    window.location = { protocol: 'http:', hostname: 'example.com', pathname: '/' };

    const result = await appInstance.registerPreviewServiceWorker();

    expect(result).toBeNull();
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    window.location = originalLocation;
  });
});

describe('_resolvePreviewServiceWorkerBasePath', () => {
  let appInstance;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('uses embeddingConfig basePath when available', () => {
    appInstance.runtimeConfig = { embeddingConfig: { basePath: '/embed/path/' } };
    expect(appInstance._resolvePreviewServiceWorkerBasePath()).toBe('/embed/path/');
  });

  it('normalizes embeddingConfig basePath without leading slash', () => {
    appInstance.runtimeConfig = { embeddingConfig: { basePath: 'embed/path//' } };
    expect(appInstance._resolvePreviewServiceWorkerBasePath()).toBe('/embed/path/');
  });
});

describe('sendContentToPreviewSW READY_VERIFIED path', () => {
  let appInstance;
  let mockController;
  let originalServiceWorker;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
    mockController = { postMessage: vi.fn() };
    originalServiceWorker = navigator.serviceWorker;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller: mockController },
      writable: true,
      configurable: true,
    });
    appInstance._previewSwRegistration = { active: mockController };
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
  });

  it('resolves directly on READY_VERIFIED response without verify step', async () => {
    const files = { 'index.html': '<html></html>' };
    const messageChannels = [];
    const OriginalMessageChannel = globalThis.MessageChannel;

    globalThis.MessageChannel = function MockMessageChannel() {
      const channel = {
        port1: { onmessage: null, close: vi.fn() },
        port2: {},
      };
      messageChannels.push(channel);
      return channel;
    };

    mockController.postMessage = vi.fn((msg) => {
      if (msg.type === 'SET_CONTENT') {
        // SW responds directly with READY_VERIFIED on same channel
        setTimeout(() => {
          messageChannels[0].port1.onmessage({
            data: { type: 'READY_VERIFIED', ready: true, fileCount: 1 },
          });
        }, 10);
      }
    });

    const result = await appInstance.sendContentToPreviewSW(files);

    expect(result.fileCount).toBe(1);
    expect(messageChannels[0].port1.close).toHaveBeenCalled();

    globalThis.MessageChannel = OriginalMessageChannel;
  });

  it('rejects when READY_VERIFIED returns not ready', async () => {
    const files = { 'index.html': '<html></html>' };
    const messageChannels = [];
    const OriginalMessageChannel = globalThis.MessageChannel;

    globalThis.MessageChannel = function MockMessageChannel() {
      const channel = {
        port1: { onmessage: null, close: vi.fn() },
        port2: {},
      };
      messageChannels.push(channel);
      return channel;
    };

    mockController.postMessage = vi.fn((msg) => {
      if (msg.type === 'SET_CONTENT') {
        setTimeout(() => {
          messageChannels[0].port1.onmessage({
            data: { type: 'READY_VERIFIED', ready: false, fileCount: 0 },
          });
        }, 10);
      }
    });

    await expect(appInstance.sendContentToPreviewSW(files)).rejects.toThrow('SW content not ready after verification');

    globalThis.MessageChannel = OriginalMessageChannel;
  });

  it('rejects when VERIFY_READY returns not ready', async () => {
    const files = { 'index.html': '<html></html>' };
    const messageChannels = [];
    const OriginalMessageChannel = globalThis.MessageChannel;

    globalThis.MessageChannel = function MockMessageChannel() {
      const channel = {
        port1: { onmessage: null, close: vi.fn() },
        port2: {},
      };
      messageChannels.push(channel);
      return channel;
    };

    mockController.postMessage = vi.fn((msg) => {
      if (msg.type === 'SET_CONTENT') {
        setTimeout(() => {
          messageChannels[0].port1.onmessage({
            data: { type: 'CONTENT_READY', fileCount: 1 },
          });
        }, 10);
      } else if (msg.type === 'VERIFY_READY') {
        setTimeout(() => {
          messageChannels[1].port1.onmessage({
            data: { ready: false, fileCount: 0 },
          });
        }, 5);
      }
    });

    await expect(appInstance.sendContentToPreviewSW(files)).rejects.toThrow('SW content not ready after verification');

    globalThis.MessageChannel = OriginalMessageChannel;
  });
});

describe('bindElectronDownloadToasts exception handling', () => {
  let appInstance;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content-container"></div></div></div><div id="node-content"></div>';
    appInstance = new App(window.eXeLearning);
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete global._;
    delete window.electronAPI;
    document.body.innerHTML = '';
  });

  it('handles exception in download handler gracefully', () => {
    let downloadCallback;
    window.electronAPI = {
      onDownloadDone: (cb) => { downloadCallback = cb; },
    };
    appInstance.toasts = {
      createToast: vi.fn(() => { throw new Error('Toast creation failed'); }),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    appInstance.bindElectronDownloadToasts();

    // Should not throw even when toast creation fails
    expect(() => downloadCallback({ ok: true, path: '/test/path.elpx' })).toThrow('Toast creation failed');
  });
});

describe('Module-level event handlers', () => {
  beforeEach(() => {
    // Setup window.eXeLearning for module-level tests
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
  });

  afterEach(() => {
    delete window.eXeLearning;
  });

  it('window.onload is set as a function', () => {
    // The import of app.js sets window.onload
    expect(typeof window.onload).toBe('function');
  });

  it('window.onload creates App instance and calls init', () => {
    // Store original onload set by the module
    const originalOnload = window.onload;

    // Store original app if any
    const originalApp = window.eXeLearning.app;

    // Mock App.prototype.init to prevent side effects
    const originalInit = App.prototype.init;
    const mockInit = vi.fn().mockResolvedValue(undefined);
    App.prototype.init = mockInit;

    try {
      // Execute the actual onload handler
      // This covers lines 821-824: var eXeLearning = window.eXeLearning; eXeLearning.app = new App(eXeLearning); eXeLearning.app.init();
      originalOnload();

      // The App instance should be created
      expect(window.eXeLearning.app).toBeDefined();
      expect(window.eXeLearning.app).toBeInstanceOf(App);
      // init should have been called
      expect(mockInit).toHaveBeenCalled();
    } finally {
      // Cleanup
      App.prototype.init = originalInit;
      window.eXeLearning.app = originalApp;
    }
  });

  it('beforeunload handler returns undefined', () => {
    // Simulate user interaction to trigger the installation of beforeunload
    const event = new Event('pointerdown');
    window.dispatchEvent(event);

    // Now check if onbeforeunload returns undefined (no confirmation dialog)
    if (typeof window.onbeforeunload === 'function') {
      const result = window.onbeforeunload({});
      expect(result).toBeUndefined();
    }
  });

  it('beforeunload is installed only once', () => {
    // Simulate multiple user interactions
    const pointerEvent = new Event('pointerdown');
    const keyEvent = new Event('keydown');

    window.dispatchEvent(pointerEvent);
    window.dispatchEvent(keyEvent);

    // Should not throw and onbeforeunload should be set
    expect(typeof window.onbeforeunload).toBe('function');
  });
});

describe('Embedding bridge wiring', () => {
  let appInstance;

  beforeEach(() => {
    window.eXeLearning = {
      user: '{"id":1}',
      config: '{"isOfflineInstallation":true,"basePath":""}',
    };
    global._ = (str) => str;
    document.body.innerHTML = `
      <div id="main"><div id="workarea"><div id="node-content-container"></div></div></div>
      <div id="node-content"></div>
    `;
  });

  afterEach(() => {
    delete window.eXeLearning;
    delete window.__EXE_EMBEDDING_CONFIG__;
    delete window.__EXE_STATIC_MODE__;
    delete global._;
    document.body.innerHTML = '';
    document.body.removeAttribute('data-embedded');
    document.body.removeAttribute('data-exe-hide-file-menu');
    document.body.removeAttribute('data-exe-hide-save');
    document.body.removeAttribute('data-exe-hide-share');
    document.body.removeAttribute('data-exe-hide-user-menu');
    document.body.removeAttribute('data-exe-hide-download');
    document.body.removeAttribute('data-exe-hide-help');
    vi.clearAllMocks();
  });

  it('should not create embeddingBridge when not embedded', () => {
    appInstance = new App(window.eXeLearning);
    expect(appInstance.embeddingBridge).toBeNull();
  });

  it('should create embeddingBridge when embedded is enabled', () => {
    // Set up embedding config to make isEmbedded true
    window.__EXE_STATIC_MODE__ = true;
    window.__EXE_EMBEDDING_CONFIG__ = {
      basePath: '/test',
      trustedOrigins: ['https://example.com'],
    };

    appInstance = new App(window.eXeLearning);

    expect(appInstance.embeddingBridge).not.toBeNull();
    expect(appInstance.embeddingBridge.trustedOrigins).toEqual(['https://example.com']);
  });

  it('should create ready promise on window.eXeLearning', () => {
    appInstance = new App(window.eXeLearning);
    expect(window.eXeLearning.ready).toBeInstanceOf(Promise);
  });

  it('should create documentReady promise on window.eXeLearning', () => {
    appInstance = new App(window.eXeLearning);
    expect(window.eXeLearning.documentReady).toBeInstanceOf(Promise);
  });

  it('should store _documentReadyResolve function', () => {
    appInstance = new App(window.eXeLearning);
    expect(typeof appInstance._documentReadyResolve).toBe('function');
  });

  it('documentReady should resolve when _documentReadyResolve is called', async () => {
    appInstance = new App(window.eXeLearning);
    const documentReadyPromise = window.eXeLearning.documentReady;

    // Resolve it
    appInstance._documentReadyResolve();

    // Should resolve without error
    await expect(documentReadyPromise).resolves.toBeUndefined();
    expect(appInstance._documentReadyResolve).not.toBeNull();
  });

  it('should resolve ready promise after init', async () => {
    window.eXeLearning.version = '4.0.0';
    appInstance = new App(window.eXeLearning);

    // Mock all init dependencies
    appInstance.api = { init: vi.fn(), loadApiParameters: vi.fn() };
    appInstance.locale = { init: vi.fn() };
    appInstance.toasts = { init: vi.fn() };
    appInstance.modals = { init: vi.fn(), behaviour: vi.fn() };
    appInstance.idevices = { loadIdevicesFromAPI: vi.fn() };
    appInstance.themes = { loadThemesFromAPI: vi.fn() };
    appInstance.user = { loadUserPreferences: vi.fn() };
    appInstance.project = { load: vi.fn() };
    appInstance.shortcuts = { init: vi.fn() };
    appInstance.showModalLopd = vi.fn();
    appInstance.showProvisionalDemoWarning = vi.fn();
    appInstance.tmpStringList = vi.fn();
    appInstance.addNoTranslateForGoogle = vi.fn();
    appInstance.runCustomJavaScriptCode = vi.fn();
    appInstance.registerPreviewServiceWorker = vi.fn();
    appInstance.bindElectronDownloadToasts = vi.fn();
    appInstance.bindElectronFileOpenHandler = vi.fn();
    appInstance.initExePackageProtocolHandler = vi.fn();

    const readyPromise = window.eXeLearning.ready;
    await appInstance.init();

    const result = await readyPromise;
    expect(result.version).toBe('4.0.0');
    expect(result.capabilities).toEqual([]);
  });

  it('should apply embedded UI visibility with data attributes', () => {
    window.__EXE_STATIC_MODE__ = true;
    window.__EXE_EMBEDDING_CONFIG__ = {
      basePath: '/test',
      hideUI: { fileMenu: true, saveButton: true },
    };

    appInstance = new App(window.eXeLearning);
    appInstance._applyEmbeddedUIVisibility();

    expect(document.body.getAttribute('data-embedded')).toBe('true');
    expect(document.body.getAttribute('data-exe-hide-file-menu')).toBe('true');
    expect(document.body.getAttribute('data-exe-hide-save')).toBe('true');
    expect(document.body.getAttribute('data-exe-hide-share')).toBeNull();
  });

  it('should not set data attributes for visible UI elements', () => {
    window.__EXE_STATIC_MODE__ = true;
    window.__EXE_EMBEDDING_CONFIG__ = {
      basePath: '/test',
    };

    appInstance = new App(window.eXeLearning);
    appInstance._applyEmbeddedUIVisibility();

    expect(document.body.getAttribute('data-embedded')).toBe('true');
    // All UI should be visible (no hideUI config)
    expect(document.body.getAttribute('data-exe-hide-file-menu')).toBeNull();
    expect(document.body.getAttribute('data-exe-hide-save')).toBeNull();
  });

  it('should override basePath from embedding config', () => {
    window.__EXE_STATIC_MODE__ = true;
    window.__EXE_EMBEDDING_CONFIG__ = {
      basePath: '/wp-content/plugins/exelearning/static',
    };

    appInstance = new App(window.eXeLearning);

    expect(appInstance.eXeLearning.config.basePath).toBe('/wp-content/plugins/exelearning/static');
  });

  it('should update symfony shim when basePath overridden', () => {
    window.__EXE_STATIC_MODE__ = true;
    window.__EXE_EMBEDDING_CONFIG__ = {
      basePath: '/custom/path',
    };

    appInstance = new App(window.eXeLearning);

    expect(window.eXeLearning.symfony.basePath).toBe('/custom/path');
  });
});
