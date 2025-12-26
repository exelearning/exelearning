import LogoutButton from './logoutButton.js';

describe('LogoutButton', () => {
  let logoutButton;
  let mockButton;
  let mockPostCheckCurrentOdeUsers;
  let mockPostCloseSession;
  let mockSessionLogoutModal;
  let mockConfirmModal;

  beforeEach(() => {
    // Mock DOM element
    mockButton = {
      addEventListener: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock translation function
    window._ = vi.fn((text) => text);

    // Mock API methods
    mockPostCheckCurrentOdeUsers = vi.fn().mockResolvedValue({ leaveSession: true });
    mockPostCloseSession = vi.fn().mockResolvedValue({});

    // Mock modals
    mockSessionLogoutModal = {
      show: vi.fn(),
    };

    mockConfirmModal = {
      show: vi.fn(),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: {
          odeSession: 'test-session-id',
          odeVersion: 'test-version-id',
          odeId: 'test-ode-id',
        },
        api: {
          postCheckCurrentOdeUsers: mockPostCheckCurrentOdeUsers,
          postCloseSession: mockPostCloseSession,
        },
        modals: {
          sessionlogout: mockSessionLogoutModal,
          confirm: mockConfirmModal,
        },
      },
    };

    // Mock window.location
    delete window.location;
    window.location = {
      pathname: '/base/path/workarea',
      origin: 'http://localhost:8080',
      href: '',
    };

    // Mock window.onbeforeunload
    window.onbeforeunload = vi.fn();

    logoutButton = new LogoutButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.eXeLearning;
    delete window._;
  });

  describe('constructor', () => {
    it('should query the logout button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-bottom-logout-button');
    });

    it('should store the button element reference', () => {
      expect(logoutButton.logoutMenuHeadButton).toBe(mockButton);
    });
  });

  describe('init', () => {
    it('should call addEventClick', () => {
      const spy = vi.spyOn(logoutButton, 'addEventClick');
      logoutButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      logoutButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    describe('offline mode (Electron)', () => {
      let mockWindowClose;

      beforeEach(() => {
        mockWindowClose = vi.fn();
        window.close = mockWindowClose;
        window.eXeLearning.config = { isOfflineInstallation: true };
      });

      it('should call handleOfflineExit in offline mode', async () => {
        const spy = vi.spyOn(logoutButton, 'handleOfflineExit');
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(spy).toHaveBeenCalled();
      });

      it('should not call API in offline mode', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(mockPostCheckCurrentOdeUsers).not.toHaveBeenCalled();
        expect(mockPostCloseSession).not.toHaveBeenCalled();
      });

      describe('handleOfflineExit', () => {
        it('should close directly when no unsaved changes', () => {
          window.eXeLearning.app.project = {
            _yjsBridge: {
              documentManager: {
                hasUnsavedChanges: vi.fn(() => false),
                isDirty: false,
              },
            },
          };

          logoutButton.handleOfflineExit();

          expect(mockWindowClose).toHaveBeenCalled();
          expect(window.onbeforeunload).toBeNull();
        });

        it('should show confirmation when hasUnsavedChanges returns true', () => {
          window.eXeLearning.app.project = {
            _yjsBridge: {
              documentManager: {
                hasUnsavedChanges: vi.fn(() => true),
                isDirty: false,
              },
            },
          };

          logoutButton.handleOfflineExit();

          expect(mockSessionLogoutModal.show).toHaveBeenCalledWith({
            title: 'Exit',
            offlineExit: true,
          });
          expect(mockWindowClose).not.toHaveBeenCalled();
        });

        it('should show confirmation when isDirty is true', () => {
          window.eXeLearning.app.project = {
            _yjsBridge: {
              documentManager: {
                hasUnsavedChanges: vi.fn(() => false),
                isDirty: true,
              },
            },
          };

          logoutButton.handleOfflineExit();

          expect(mockSessionLogoutModal.show).toHaveBeenCalledWith({
            title: 'Exit',
            offlineExit: true,
          });
        });

        it('should close directly when no yjsBridge', () => {
          window.eXeLearning.app.project = {};

          logoutButton.handleOfflineExit();

          expect(mockWindowClose).toHaveBeenCalled();
        });
      });

      describe('closeOfflineApp', () => {
        it('should clear onbeforeunload and close window', () => {
          logoutButton.closeOfflineApp();

          expect(window.onbeforeunload).toBeNull();
          expect(mockWindowClose).toHaveBeenCalled();
        });
      });

      describe('saveAndCloseOffline', () => {
        it('should call exportToElpxViaYjs and close', async () => {
          const mockExport = vi.fn().mockResolvedValue();
          window.eXeLearning.app.project = {
            _yjsEnabled: true,
            exportToElpxViaYjs: mockExport,
          };

          await logoutButton.saveAndCloseOffline();

          expect(mockExport).toHaveBeenCalledWith({ saveAs: false });
          expect(mockWindowClose).toHaveBeenCalled();
        });

        it('should show error on save failure', async () => {
          const mockExport = vi.fn().mockRejectedValue(new Error('Save failed'));
          const mockAlert = { show: vi.fn() };
          window.eXeLearning.app.project = {
            _yjsEnabled: true,
            exportToElpxViaYjs: mockExport,
          };
          window.eXeLearning.app.modals.alert = mockAlert;

          await logoutButton.saveAndCloseOffline();

          expect(mockAlert.show).toHaveBeenCalledWith({
            title: 'Error saving',
            body: 'An error occurred while saving the project',
            contentId: 'error',
          });
          expect(mockWindowClose).not.toHaveBeenCalled();
        });
      });
    });

    it('should call postCheckCurrentOdeUsers with correct params', async () => {
      logoutButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockPostCheckCurrentOdeUsers).toHaveBeenCalledWith({
        odeSessionId: 'test-session-id',
        odeVersionId: 'test-version-id',
        odeId: 'test-ode-id',
      });
    });

    describe('leaveSession flow', () => {
      beforeEach(() => {
        mockPostCheckCurrentOdeUsers.mockResolvedValue({ leaveSession: true });
      });

      it('should call postCloseSession when leaveSession is true', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(mockPostCloseSession).toHaveBeenCalledWith({
          odeSessionId: 'test-session-id',
          odeVersionId: 'test-version-id',
          odeId: 'test-ode-id',
        });
      });

      it('should clear onbeforeunload handler', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        await vi.waitFor(() => {
          expect(window.onbeforeunload).toBeNull();
        });
      });

      it('should redirect to logout page', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        await vi.waitFor(() => {
          expect(window.location.href).toBe('http://localhost:8080/base/path/logout');
        });
      });

      it('should construct correct logout URL from pathname', async () => {
        window.location.pathname = '/my/custom/path/workarea';
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        await vi.waitFor(() => {
          expect(window.location.href).toBe('http://localhost:8080/my/custom/path/logout');
        });
      });
    });

    describe('askSave flow', () => {
      beforeEach(() => {
        mockPostCheckCurrentOdeUsers.mockResolvedValue({ askSave: true });
      });

      it('should show session logout modal when askSave is true', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(mockSessionLogoutModal.show).toHaveBeenCalled();
      });

      it('should not call postCloseSession', async () => {
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(mockPostCloseSession).not.toHaveBeenCalled();
      });
    });

    describe('leaveEmptySession flow', () => {
      beforeEach(() => {
        mockPostCheckCurrentOdeUsers.mockResolvedValue({ leaveEmptySession: true });
      });

      it('should call leaveEmptySession when leaveEmptySession is true', async () => {
        const spy = vi.spyOn(logoutButton, 'leaveEmptySession');
        logoutButton.addEventClick();

        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        await clickHandler(new Event('click'));

        expect(spy).toHaveBeenCalledWith({
          odeSessionId: 'test-session-id',
          odeVersionId: 'test-version-id',
          odeId: 'test-ode-id',
        });
      });
    });
  });

  describe('leaveEmptySession', () => {
    const params = {
      odeSessionId: 'test-session-id',
      odeVersionId: 'test-version-id',
      odeId: 'test-ode-id',
    };

    it('should show confirm modal with correct options', () => {
      logoutButton.leaveEmptySession(params);

      expect(mockConfirmModal.show).toHaveBeenCalledWith({
        title: 'Empty session',
        contentId: 'empty-session',
        body: 'Do you want to logout anyway?',
        confirmButtonText: 'Logout',
        cancelButtonText: 'Cancel',
        focusFirstInputText: true,
        confirmExec: expect.any(Function),
      });
    });

    it('should use translation function for modal text', () => {
      logoutButton.leaveEmptySession(params);

      expect(window._).toHaveBeenCalledWith('Empty session');
      expect(window._).toHaveBeenCalledWith('Do you want to logout anyway?');
      expect(window._).toHaveBeenCalledWith('Logout');
      expect(window._).toHaveBeenCalledWith('Cancel');
    });

    it('should call postCloseSession when confirm is executed', async () => {
      logoutButton.leaveEmptySession(params);

      const showCall = mockConfirmModal.show.mock.calls[0][0];
      const confirmExec = showCall.confirmExec;

      await confirmExec();

      expect(mockPostCloseSession).toHaveBeenCalledWith(params);
    });

    it('should clear onbeforeunload handler on confirm', async () => {
      logoutButton.leaveEmptySession(params);

      const showCall = mockConfirmModal.show.mock.calls[0][0];
      const confirmExec = showCall.confirmExec;

      await confirmExec();

      await vi.waitFor(() => {
        expect(window.onbeforeunload).toBeNull();
      });
    });

    it('should redirect to logout page on confirm', async () => {
      logoutButton.leaveEmptySession(params);

      const showCall = mockConfirmModal.show.mock.calls[0][0];
      const confirmExec = showCall.confirmExec;

      await confirmExec();

      await vi.waitFor(() => {
        expect(window.location.href).toBe('http://localhost:8080/base/path/logout');
      });
    });

    it('should construct correct logout URL on confirm', async () => {
      window.location.pathname = '/another/base/workarea';
      logoutButton.leaveEmptySession(params);

      const showCall = mockConfirmModal.show.mock.calls[0][0];
      const confirmExec = showCall.confirmExec;

      await confirmExec();

      await vi.waitFor(() => {
        expect(window.location.href).toBe('http://localhost:8080/another/base/logout');
      });
    });
  });

  describe('integration', () => {
    it('should complete full leaveSession flow', async () => {
      mockPostCheckCurrentOdeUsers.mockResolvedValue({ leaveSession: true });
      logoutButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockPostCheckCurrentOdeUsers).toHaveBeenCalled();
      expect(mockPostCloseSession).toHaveBeenCalled();
      await vi.waitFor(() => {
        expect(window.location.href).toContain('/logout');
      });
    });

    it('should complete full askSave flow', async () => {
      mockPostCheckCurrentOdeUsers.mockResolvedValue({ askSave: true });
      logoutButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockPostCheckCurrentOdeUsers).toHaveBeenCalled();
      expect(mockSessionLogoutModal.show).toHaveBeenCalled();
      expect(mockPostCloseSession).not.toHaveBeenCalled();
    });

    it('should complete full leaveEmptySession flow with confirmation', async () => {
      mockPostCheckCurrentOdeUsers.mockResolvedValue({ leaveEmptySession: true });
      logoutButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockConfirmModal.show).toHaveBeenCalled();

      // Execute confirm
      const showCall = mockConfirmModal.show.mock.calls[0][0];
      await showCall.confirmExec();

      expect(mockPostCloseSession).toHaveBeenCalled();
      await vi.waitFor(() => {
        expect(window.location.href).toContain('/logout');
      });
    });
  });
});
