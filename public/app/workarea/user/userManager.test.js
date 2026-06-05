import UserManager from './userManager.js';
import UserPreferences from './preferences/userPreferences.js';

vi.mock('./preferences/userPreferences.js');

describe('UserManager', () => {
  let userManager;
  let mockApp;

  beforeEach(() => {
    // Mock global eXeLearning
    globalThis.eXeLearning = {
      user: {
        id: 1,
        username: 'test@example.com',
        gravatarUrl: 'http://gravatar.com/test',
        usernameFirsLetter: 'T',
        acceptedLopd: true
      },
      config: {
        isOfflineInstallation: false
      },
      app: {
        api: {
          postDeleteOdeFilesByDate: vi.fn().mockResolvedValue({}),
        },
        locale: {
          setLocaleLang: vi.fn().mockResolvedValue(),
          loadTranslationsStrings: vi.fn().mockResolvedValue(),
        }
      }
    };

    mockApp = {
      app: globalThis.eXeLearning.app
    };

    userManager = new UserManager(mockApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.eXeLearning;
  });

  describe('Getters', () => {
    it('should return correct user data from getters', () => {
      expect(userManager.id).toBe(1);
      expect(userManager.email).toBe('test@example.com');
      expect(userManager.username).toBe('test@example.com');
      expect(userManager.name).toBe('test@example.com');
      expect(userManager.gravatarUrl).toBe('http://gravatar.com/test');
      expect(userManager.usernameFirsLetter).toBe('T');
      expect(userManager.acceptedLopd).toBe(true);
    });

    it('should identify guest user correctly', () => {
      globalThis.eXeLearning.user.username = 'guest@guest.local';
      expect(userManager.isGuest).toBe(true);
      
      globalThis.eXeLearning.user.username = 'realuser@example.com';
      expect(userManager.isGuest).toBe(false);
    });
  });

  describe('reloadMode', () => {
    it('should set mode to advanced when true is passed', () => {
      userManager.reloadMode('true');
      expect(userManager.mode).toBe('advanced');
      expect(document.body.getAttribute('mode')).toBe('advanced');
    });

    it('should set mode to default when false is passed', () => {
      userManager.reloadMode('false');
      expect(userManager.mode).toBe('default');
      expect(document.body.getAttribute('mode')).toBe('default');
    });
  });

  describe('reloadVersionControl', () => {
    it('should set versionControl to inactive and call deleteOdeFilesByDate if offline and false', async () => {
      globalThis.eXeLearning.config.isOfflineInstallation = true;
      const deleteSpy = vi.spyOn(userManager, 'deleteOdeFilesByDate');
      
      userManager.reloadVersionControl('false');
      
      expect(userManager.versionControl).toBe('inactive');
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('should set versionControl to active otherwise', () => {
      globalThis.eXeLearning.config.isOfflineInstallation = false;
      userManager.reloadVersionControl('false');
      expect(userManager.versionControl).toBe('active');
      
      globalThis.eXeLearning.config.isOfflineInstallation = true;
      userManager.reloadVersionControl('true');
      expect(userManager.versionControl).toBe('active');
    });
  });

  describe('reloadLang', () => {
    it('should call setLocaleLang and loadTranslationsStrings', async () => {
      await userManager.reloadLang('es');
      expect(globalThis.eXeLearning.app.locale.setLocaleLang).toHaveBeenCalledWith('es');
      expect(globalThis.eXeLearning.app.locale.loadTranslationsStrings).toHaveBeenCalled();
    });
  });
});
