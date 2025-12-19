import ConcurrentUsers from './concurrentUsers.js';
import * as avatarUtils from '../../../utils/avatarUtils.js';

// Mock avatarUtils
vi.mock('../../../utils/avatarUtils.js', () => ({
  getInitials: vi.fn(name => 'JD'),
  isGuestAccount: vi.fn(email => false),
  generateGravatarUrl: vi.fn((email, size) => `https://gravatar.com/${email}`),
}));

describe('ConcurrentUsers', () => {
  let concurrentUsers;
  let mockElement;
  let mockApp;
  let mockDocumentManager;
  let mockUnsubscribe;

  beforeEach(() => {
    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'exe-concurrent-users';
    const moreButton = document.createElement('div');
    moreButton.id = 'button-more-exe-concurrent-users';
    mockElement.appendChild(moreButton);
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'querySelector').mockImplementation(selector => {
      if (selector === '#exe-concurrent-users') return mockElement;
      return null;
    });

    // Mock Yjs Document Manager
    mockUnsubscribe = vi.fn();
    mockDocumentManager = {
      setUserInfo: vi.fn(),
      onUsersChange: vi.fn(cb => {
        // Store callback to trigger it manually
        mockDocumentManager._onUsersChangeCallback = cb;
        return mockUnsubscribe;
      }),
      getOnlineUsers: vi.fn(() => []),
    };

    // Mock App
    mockApp = {
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        gravatarUrl: 'http://example.com/avatar.png',
      },
      project: {
        _yjsEnabled: true,
        _yjsBridge: {
          getDocumentManager: vi.fn(() => mockDocumentManager),
        },
      },
      modals: {
        info: {
          show: vi.fn(),
        },
      },
    };

    window.eXeLearning = {
      app: mockApp,
    };

    concurrentUsers = new ConcurrentUsers(mockApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(concurrentUsers.maxUsersShow).toBe(5);
      expect(concurrentUsers.concurrentUsersElement).toBe(mockElement);
      expect(concurrentUsers.currentUsers).toEqual([]);
    });
  });

  describe('isYjsReady', () => {
    it('should return true if Yjs is enabled and document manager is available', () => {
      expect(concurrentUsers.isYjsReady()).toBe(true);
    });

    it('should return false if Yjs is disabled', () => {
      mockApp.project._yjsEnabled = false;
      expect(concurrentUsers.isYjsReady()).toBe(false);
    });
  });

  describe('init', () => {
    it('should subscribe to Yjs awareness if ready', async () => {
      const subscribeSpy = vi.spyOn(concurrentUsers, 'subscribeToYjsAwareness');
      const updateDisplaySpy = vi.spyOn(concurrentUsers, 'updateUsersDisplay');

      await concurrentUsers.init();

      expect(subscribeSpy).toHaveBeenCalled();
      expect(updateDisplaySpy).toHaveBeenCalled();
    });

    it('should retry if Yjs is not ready', () => {
      vi.useFakeTimers();
      mockApp.project._yjsEnabled = false;
      const initSpy = vi.spyOn(concurrentUsers, 'init');
      
      concurrentUsers.init();
      
      expect(initSpy).toHaveBeenCalledTimes(1);
      
      mockApp.project._yjsEnabled = true;
      vi.advanceTimersByTime(1000);
      
      expect(initSpy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('subscribeToYjsAwareness', () => {
    it('should set user info and subscribe to changes', () => {
      concurrentUsers.subscribeToYjsAwareness();

      expect(mockDocumentManager.setUserInfo).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        gravatarUrl: 'http://example.com/avatar.png',
      });
      expect(mockDocumentManager.onUsersChange).toHaveBeenCalled();
    });

    it('should warn when document manager is missing', () => {
      mockApp.project._yjsBridge.getDocumentManager = vi.fn(() => null);
      expect(() => concurrentUsers.subscribeToYjsAwareness()).not.toThrow();
    });
  });

  describe('updateUsersDisplay', () => {
    it('should add user elements to the DOM', () => {
      concurrentUsers.currentUsers = [
        { clientId: 1, name: 'User 1', color: 'red', isLocal: true },
        { clientId: 2, name: 'User 2', email: 'user2@example.com' },
      ];

      concurrentUsers.updateUsersDisplay();

      const userIcons = mockElement.querySelectorAll('.user-current-letter-icon:not(#button-more-exe-concurrent-users)');
      expect(userIcons.length).toBe(2);
      expect(userIcons[0].getAttribute('data-username')).toBe('User 1');
      expect(userIcons[0].classList.contains('is-local-user')).toBe(true);
      expect(userIcons[0].style.borderColor).toBe('red');
    });

    it('should limit shown users to maxUsersShow', () => {
      concurrentUsers.currentUsers = Array.from({ length: 10 }, (_, i) => ({
        clientId: i,
        name: `User ${i}`,
      }));

      concurrentUsers.updateUsersDisplay();

      const userIcons = mockElement.querySelectorAll('.user-current-letter-icon:not(#button-more-exe-concurrent-users)');
      expect(userIcons.length).toBe(5); // Default maxUsersShow
    });
  });

  describe('updateMoreButton', () => {
    it('should show more button if there are multiple users', () => {
      concurrentUsers.currentUsers = [
        { clientId: 1, name: 'User 1' },
        { clientId: 2, name: 'User 2' },
      ];
      
      concurrentUsers.updateUsersDisplay();
      
      const moreButton = mockElement.querySelector('#button-more-exe-concurrent-users');
      expect(moreButton.style.display).toBe('block');
    });

    it('should hide more button if there is only one user', () => {
      concurrentUsers.currentUsers = [
        { clientId: 1, name: 'User 1' },
      ];
      
      concurrentUsers.updateUsersDisplay();
      
      const moreButton = mockElement.querySelector('#button-more-exe-concurrent-users');
      expect(moreButton.style.display).toBe('none');
    });

    it('should show info modal on click', () => {
      concurrentUsers.currentUsers = [
        { clientId: 1, name: 'User 1' },
        { clientId: 2, name: 'User 2' },
      ];
      
      concurrentUsers.updateUsersDisplay();
      
      const moreButton = mockElement.querySelector('#button-more-exe-concurrent-users');
      moreButton.click();
      
      expect(mockApp.modals.info.show).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('Users online'),
      }));
    });
  });

  describe('createUserElement', () => {
    it('should add guest badge when user is guest', () => {
      avatarUtils.isGuestAccount.mockReturnValue(true);

      const node = concurrentUsers.createUserElement({
        clientId: 1,
        name: 'Guest',
        email: 'guest@example.com',
      });

      expect(node.querySelector('.guest-badge')?.textContent).toBe('Guest');
    });

    it('should fallback to initials on image error', () => {
      const node = concurrentUsers.createUserElement({
        clientId: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const img = node.querySelector('img');
      expect(img).not.toBeNull();
      img.onerror();

      const initials = node.querySelector('.avatar-initials');
      expect(initials?.textContent).toBe('JD');
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from changes', () => {
      concurrentUsers.subscribeToYjsAwareness();
      concurrentUsers.destroy();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
