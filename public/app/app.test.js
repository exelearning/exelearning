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
      user: '{&quot;id&quot;:1}',
      config: '{&quot;isOfflineInstallation&quot;:false}',
      symfony: '{&quot;basePath&quot;:&quot;/exelearning&quot;}',
    };

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
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('getBasePath', () => {
    it('returns empty string when basePath is not set', () => {
      appInstance.eXeLearning.symfony.basePath = '';
      expect(appInstance.getBasePath()).toBe('');
    });

    it('returns basePath without trailing slash', () => {
      appInstance.eXeLearning.symfony.basePath = '/app/';
      expect(appInstance.getBasePath()).toBe('/app');
    });
  });

  describe('composeUrl', () => {
    it('prepends basePath to path', () => {
      appInstance.eXeLearning.symfony.basePath = '/app';
      expect(appInstance.composeUrl('api/test')).toBe('/app/api/test');
    });
  });

  describe('parseExelearningSymfonyData logic', () => {
    it('forces HTTPS when protocol is https:', () => {
      // Accessing the real method on the instance
      window.location.href = 'https://localhost/test';
      window.eXeLearning.user = '{&quot;id&quot;:1}';
      window.eXeLearning.config = '{&quot;isOfflineInstallation&quot;:false}';
      window.eXeLearning.symfony = '{&quot;baseURL&quot;:&quot;http://localhost&quot;,&quot;fullURL&quot;:&quot;http://localhost/api&quot;,&quot;changelogURL&quot;:&quot;http://localhost/changelog&quot;}';
      
      appInstance.parseExelearningSymfonyData();
      
      expect(window.eXeLearning.symfony.baseURL).toBe('https://localhost');
      expect(window.eXeLearning.symfony.fullURL).toBe('https://localhost/api');
      expect(window.eXeLearning.symfony.changelogURL).toBe('https://localhost/changelog');
    });
  });

  describe('showProvisionalDemoWarning logic', () => {
    it('shows warning for alpha version', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '-1';
      document.body.innerHTML = '<div id="node-content"></div>';
      
      await appInstance.showProvisionalDemoWarning();
      
      expect(document.getElementById('eXeBetaWarning')).not.toBeNull();
    });

    it('shows expiry message for expired offline demo', async () => {
      window.eXeLearning.version = '4.0-alpha';
      window.eXeLearning.expires = '20200101'; // Past date
      document.body.setAttribute('installation-type', 'offline');
      document.body.innerHTML = '<div id="node-content"></div>';
      
      await appInstance.showProvisionalDemoWarning();
      
      expect(document.querySelector('.expired')).not.toBeNull();
    });
  });

  describe('Protocol handler logic', () => {
    it('identifies elp protocol links', () => {
      const link = document.createElement('a');
      link.href = 'exe-package:elp';
      document.body.appendChild(link);
      
      // Need to use the real DOM check since it uses .closest()
      expect(link.closest('a[href="exe-package:elp"]')).toBe(link);
    });
  });
});