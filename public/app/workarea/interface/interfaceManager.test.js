import InterfaceManager from './interfaceManager.js';
import LoadingScreen from './loadingScreen.js';
import OdeTitleElement from './elements/odeTitleElement.js';
import ConcurrentUsers from './elements/concurrentUsers.js';
import ConnectionTime from './elements/connectionTime.js';
import SaveProjectButton from './elements/saveButton.js';
import ShareProjectButton from './elements/shareButton.js';
import DownloadProjectButton from './elements/downloadButton.js';
import PreviewButton from './elements/previewButton.js';
import LogoutButton from './elements/logoutButton.js';

// Mock all dependencies
vi.mock('./loadingScreen.js');
vi.mock('./elements/odeTitleElement.js');
vi.mock('./elements/concurrentUsers.js');
vi.mock('./elements/connectionTime.js');
vi.mock('./elements/saveButton.js');
vi.mock('./elements/shareButton.js');
vi.mock('./elements/downloadButton.js');
vi.mock('./elements/previewButton.js');
vi.mock('./elements/logoutButton.js');

describe('InterfaceManager', () => {
  let manager;
  let mockApp;

  beforeEach(() => {
    mockApp = {
      project: {
        offlineInstallation: false,
      },
    };

    window.eXeLearning = {
      app: mockApp,
    };

    manager = new InterfaceManager(mockApp);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should instantiate all interface elements', () => {
      expect(LoadingScreen).toHaveBeenCalled();
      expect(OdeTitleElement).toHaveBeenCalled();
      expect(ConcurrentUsers).toHaveBeenCalledWith(mockApp);
      expect(ConnectionTime).toHaveBeenCalled();
      expect(SaveProjectButton).toHaveBeenCalled();
      expect(ShareProjectButton).toHaveBeenCalled();
      expect(DownloadProjectButton).toHaveBeenCalled();
      expect(PreviewButton).toHaveBeenCalled();
      expect(LogoutButton).toHaveBeenCalled();
    });
  });

  describe('load', () => {
    it('should initialize all elements', async () => {
      await manager.load();

      expect(manager.odeTitleElement.init).toHaveBeenCalled();
      expect(manager.connectionTime.init).toHaveBeenCalled();
      expect(manager.concurrentUsers.init).toHaveBeenCalled();
      expect(manager.saveButton.init).toHaveBeenCalled();
      expect(manager.downloadButton.init).toHaveBeenCalled();
      expect(manager.shareButton.init).toHaveBeenCalled();
      expect(manager.previewButton.init).toHaveBeenCalled();
      expect(manager.logoutButton.init).toHaveBeenCalled();
    });

    it('should not initialize concurrentUsers in offline mode', async () => {
      mockApp.project.offlineInstallation = true;
      await manager.load();

      expect(manager.concurrentUsers.init).not.toHaveBeenCalled();
    });
  });
});
