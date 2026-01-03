import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalSessionLogout from './modalSessionLogout.js';

describe('ModalSessionLogout', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock window.location
    const oldLocation = window.location;
    delete window.location;
    window.location = { ...oldLocation, href: '', origin: 'http://localhost', pathname: '/test' };

    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: {
          odeSession: 'session-id',
          odeVersion: '1.0',
          odeId: 'project-id',
        },
        api: {
          postOdeSave: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postCloseSession: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
        },
        modals: {
          openuserodefiles: {
            openUserOdeFilesWithOpenSession: vi.fn(),
            openUserLocalOdeFilesWithOpenSession: vi.fn(),
            largeFilesUpload: vi.fn(),
          },
          alert: {
            show: vi.fn(),
          },
        },
        menus: {
          navbar: {
            file: {
              createSession: vi.fn(),
            },
          },
        },
      },
      user: {
        username: 'testuser',
      },
      config: {
        basePath: '/base',
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalSessionLogout';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer"></div>
      <button class="session-logout-save btn btn-primary">Yes</button>
      <button class="session-logout-without-save btn btn-primary">No</button>
      <button class="close btn btn-secondary">Cancel</button>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalSessionLogout') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };

    // Mock interact
    const mockInteractable = {
      draggable: vi.fn().mockReturnThis(),
    };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    mockManager = {
      closeModals: vi.fn(() => false),
    };

    modal = new ModalSessionLogout(mockManager);
    modal.realTimeEventNotifier = {
        notify: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should set title and body content', async () => {
      vi.useFakeTimers();
      modal.show();
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Logout');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('saveSession', () => {
    it('should call api.postOdeSave and createSession on success with newFile', async () => {
      const odeParams = { odeSessionId: 's', odeVersion: 'v', odeId: 'i' };
      await modal.saveSession(odeParams, { newFile: true });
      expect(window.eXeLearning.app.api.postOdeSave).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.postOdeSave).toHaveBeenCalled();
      expect(window.eXeLearning.app.menus.navbar.file.createSession).toHaveBeenCalled();
    });

    it('should save Yjs project and navigate when openYjsProject is set', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession({ odeSessionId: 's' }, { openYjsProject: true, projectUuid: 'uuid-1' });

      expect(saveSpy).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/workarea?project=uuid-1');
    });

    it('should show alert when Yjs save fails', async () => {
      const saveSpy = vi.fn().mockRejectedValue(new Error('fail'));
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession({ odeSessionId: 's' }, { openYjsProject: true, projectUuid: 'uuid-1' });

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
        title: 'Error saving',
        body: 'An error occurred while saving the project',
        contentId: 'error',
      });
    });
  });

  describe('buttons functionality', () => {
    it('should trigger save on Yes click', () => {
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(modal, 'saveSession');
      modal.show();
      vi.advanceTimersByTime(500);
      const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
      yesButton.click();
      expect(saveSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should navigate directly for Yjs project without saving', () => {
      vi.useFakeTimers();
      const closeSpy = vi.spyOn(modal, 'close');
      modal.show({ openYjsProject: true, projectUuid: 'uuid-2' });
      vi.advanceTimersByTime(500);

      const noButton = mockElement.querySelector('.modal-footer .session-logout-without-save');
      noButton.click();

      expect(window.location.href).toBe('/base/workarea?project=uuid-2');
      expect(closeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should use large file upload when local large file is provided', () => {
      vi.useFakeTimers();
      modal.show({ openOdeFile: true, localOdeFile: true, isLargeFile: true, odeFile: 'file' });
      vi.advanceTimersByTime(500);

      const noButton = mockElement.querySelector('.modal-footer .session-logout-without-save');
      noButton.click();

      expect(window.eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(
        'file',
        false,
        false,
        true,
        true
      );
      vi.useRealTimers();
    });
  });

  describe('offline exit (Electron)', () => {
    let mockWindowClose;

    beforeEach(() => {
      mockWindowClose = vi.fn();
      window.close = mockWindowClose;
      window.onbeforeunload = vi.fn();
    });

    describe('closeOfflineApp', () => {
      it('should clear onbeforeunload and close window', () => {
        modal.closeOfflineApp();

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

        await modal.saveAndCloseOffline();

        expect(mockExport).toHaveBeenCalledWith({ saveAs: false });
        expect(mockWindowClose).toHaveBeenCalled();
      });

      it('should show error on save failure', async () => {
        const mockExport = vi.fn().mockRejectedValue(new Error('Save failed'));
        window.eXeLearning.app.project = {
          _yjsEnabled: true,
          exportToElpxViaYjs: mockExport,
        };

        await modal.saveAndCloseOffline();

        expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
          title: 'Error saving',
          body: 'An error occurred while saving the project',
          contentId: 'error',
        });
        expect(mockWindowClose).not.toHaveBeenCalled();
      });

      it('should close directly if Yjs not enabled', async () => {
        window.eXeLearning.app.project = {
          _yjsEnabled: false,
        };

        await modal.saveAndCloseOffline();

        expect(mockWindowClose).toHaveBeenCalled();
      });
    });

    describe('buttons with offlineExit', () => {
      it('should save and close when Yes clicked with offlineExit', async () => {
        vi.useFakeTimers();
        const saveSpy = vi.spyOn(modal, 'saveAndCloseOffline').mockResolvedValue();
        const closeSpy = vi.spyOn(modal, 'close');

        modal.show({ offlineExit: true });
        vi.advanceTimersByTime(500);

        const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
        await yesButton.click();

        expect(closeSpy).toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should close without saving when No clicked with offlineExit', () => {
        vi.useFakeTimers();
        const closeAppSpy = vi.spyOn(modal, 'closeOfflineApp');
        const closeSpy = vi.spyOn(modal, 'close');

        modal.show({ offlineExit: true });
        vi.advanceTimersByTime(500);

        const noButton = mockElement.querySelector('.modal-footer .session-logout-without-save');
        noButton.click();

        expect(closeSpy).toHaveBeenCalled();
        expect(closeAppSpy).toHaveBeenCalled();
        vi.useRealTimers();
      });
    });
  });

  describe('closeSession', () => {
    it('should create session when newFile is true', async () => {
      const closeSpy = vi.spyOn(modal, 'close');

      await modal.closeSession('session-id', { newFile: true });

      expect(window.eXeLearning.app.menus.navbar.file.createSession).toHaveBeenCalledWith({
        odeSessionId: 'session-id',
      });
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should notify and redirect on successful close', async () => {
      vi.useFakeTimers();
      modal.offlineInstallation = false;

      await modal.closeSession('session-id', { newFile: false });
      vi.advanceTimersByTime(500);

      expect(window.eXeLearning.app.api.postCloseSession).toHaveBeenCalledWith({
        odeSessionId: 'session-id',
      });
      expect(modal.realTimeEventNotifier.notify).toHaveBeenCalledWith('session-id', {
        name: 'user-exiting',
        payload: 'testuser',
      });
      expect(window.location.href).toBe('http://localhost/logout');
      vi.useRealTimers();
    });
  });
});
