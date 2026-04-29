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

    // Mock UnsavedChangesHelper
    window.UnsavedChangesHelper = {
      removeBeforeUnloadHandler: vi.fn(),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: {
          odeSession: 'session-id',
          odeVersion: '1.0',
          odeId: 'project-id',
          transitionToProject: vi.fn().mockResolvedValue(),
          _yjsBridge: {
            saveManager: { save: vi.fn().mockResolvedValue(true) },
          },
        },
        api: {
          postOdeSave: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
        },
        menus: {
          navbar: {
            file: {
              createSession: vi.fn(),
            },
          },
        },
        modals: {
          alert: {
            show: vi.fn(),
          },
          openuserodefiles: {
            openUserLocalOdeFilesWithOpenSession: vi.fn(),
            openUserOdeFilesWithOpenSession: vi.fn(),
            largeFilesUpload: vi.fn(),
          },
        },
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

  describe('save button (Yes) with pendingAction', () => {
    it('should call transitionToProject with skipSave false', async () => {
      vi.useFakeTimers();
      modal.show({ pendingAction: { action: 'open', projectUuid: 'uuid-1' } });
      vi.advanceTimersByTime(500);

      const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
      yesButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.project.transitionToProject).toHaveBeenCalledWith({
        action: 'open',
        projectUuid: 'uuid-1',
        skipSave: false,
      });
      vi.useRealTimers();
    });

    it('should show error alert when transition fails', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.project.transitionToProject = vi.fn().mockRejectedValue(new Error('fail'));

      modal.show({ pendingAction: { action: 'new' } });
      vi.advanceTimersByTime(500);
      const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
      yesButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
        title: 'Error saving',
        body: 'An error occurred while saving the project',
        contentId: 'error',
      });
      vi.useRealTimers();
    });
  });

  describe('saveSession', () => {
    it('should call api.postOdeSave and createSession on success with newFile (legacy mode)', async () => {
      // Legacy mode: _yjsEnabled is not set
      window.eXeLearning.app.project._yjsEnabled = false;
      const odeParams = { odeSessionId: 's', odeVersion: 'v', odeId: 'i' };
      await modal.saveSession(odeParams, { newFile: true });
      expect(window.eXeLearning.app.api.postOdeSave).toHaveBeenCalled();
      expect(window.eXeLearning.app.menus.navbar.file.createSession).toHaveBeenCalled();
    });

    it('should save Yjs project in static mode and start a new project locally', async () => {
      const exportSpy = vi.fn().mockResolvedValue();
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});

      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: vi.fn().mockResolvedValue(true) } };
      window.eXeLearning.app.project.exportToElpxViaYjs = exportSpy;
      window.eXeLearning.app.capabilities = { storage: { remote: false } };
      window.electronAPI = undefined;
      window.newProject = vi.fn();

      await modal.saveSession({ odeSessionId: 's' }, { newFile: true });

      expect(exportSpy).toHaveBeenCalledWith({ saveAs: false });
      expect(window.newProject).toHaveBeenCalled();
      expect(window.eXeLearning.app.project._yjsBridge.saveManager.save).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should save Yjs project and navigate when openYjsProject is set', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession({ odeSessionId: 's' }, { openYjsProject: true, projectUuid: 'uuid-1' });

      expect(saveSpy).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/workarea?project=uuid-1');
    });

    it('should save Yjs project and create new project when newFile is true', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uuid: 'new-uuid-123' }),
      });

      await modal.saveSession({ odeSessionId: 's' }, { newFile: true });

      expect(saveSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/base/api/project/create-quick',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(window.location.href).toBe('/base/workarea?project=new-uuid-123&new=1');
    });

    it('should save Yjs project and redirect to projects when create fails for newFile', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      await modal.saveSession({ odeSessionId: 's' }, { newFile: true });

      expect(saveSpy).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/projects');
    });

    it('should show alert when Yjs save fails', async () => {
      const saveSpy = vi.fn().mockRejectedValue(new Error('fail'));
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession({ odeSessionId: 's' }, { openYjsProject: true, projectUuid: 'uuid-1' });

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
        title: 'Error saving',
        body: 'An error occurred while saving the project',
        contentId: 'error',
      });
    });

    it('should save Yjs and open local file when openOdeFile with localOdeFile', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession(
        { odeSessionId: 's' },
        { openOdeFile: true, localOdeFile: true, odeFileName: 'test.elp', odeFilePath: '/path/to/test.elp' },
      );

      expect(saveSpy).toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.openuserodefiles.openUserLocalOdeFilesWithOpenSession).toHaveBeenCalledWith(
        'test.elp',
        '/path/to/test.elp',
      );
    });

    it('should save Yjs project and open a remote ODE file when requested', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession(
        { odeSessionId: 's' },
        { openOdeFile: true, localOdeFile: false, id: 'remote-id-1' },
      );

      expect(saveSpy).toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession).toHaveBeenCalledWith(
        'remote-id-1',
      );
    });

    it('should save Yjs project and resume a large local ODE file upload', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      const largeFile = { name: 'big.elp' };

      await modal.saveSession(
        { odeSessionId: 's' },
        {
          openOdeFile: true,
          localOdeFile: true,
          isLargeFile: true,
          odeFile: largeFile,
        },
      );

      expect(saveSpy).toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(
        largeFile,
        false,
        false,
        true,
        true,
      );
    });

    it('should call closeSession when Yjs save has no follow-up action', async () => {
      const saveSpy = vi.fn().mockResolvedValue(true);
      const closeSessionSpy = vi.spyOn(modal, 'closeSession').mockResolvedValue();

      window.eXeLearning.app.project._yjsEnabled = true;
      window.eXeLearning.app.project._yjsBridge = { saveManager: { save: saveSpy } };

      await modal.saveSession({ odeSessionId: 's' }, {});

      expect(saveSpy).toHaveBeenCalled();
      expect(closeSessionSpy).toHaveBeenCalledWith('s', {});
    });

    it('should show an alert when legacy save returns a non-OK response', async () => {
      window.eXeLearning.app.project._yjsEnabled = false;
      window.eXeLearning.app.api.postOdeSave = vi.fn().mockResolvedValue({ responseMessage: 'FAIL' });

      await modal.saveSession({ odeSessionId: 's', odeVersion: 'v', odeId: 'i' }, {});

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error saving',
          contentId: 'error',
        }),
      );
    });
  });

  describe('no-save button (No) with pendingAction', () => {
    it('should call transitionToProject with skipSave true', async () => {
      vi.useFakeTimers();
      modal.show({ pendingAction: { action: 'open', projectUuid: 'uuid-2' } });
      vi.advanceTimersByTime(500);

      const noButton = mockElement.querySelector('.modal-footer .session-logout-without-save');
      noButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.project.transitionToProject).toHaveBeenCalledWith({
        action: 'open',
        projectUuid: 'uuid-2',
        skipSave: true,
      });
      vi.useRealTimers();
    });

    it('should navigate directly to a Yjs project when not saving', async () => {
      vi.useFakeTimers();
      const button = document.createElement('button');
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});

      modal.notSaveSessionEventListener(button, {
        openYjsProject: true,
        projectUuid: 'uuid-3',
      });

      button.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.location.href).toBe('/base/workarea?project=uuid-3');
      expect(closeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should open a large local file upload when not saving', async () => {
      vi.useFakeTimers();
      const button = document.createElement('button');
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});
      const largeFile = { name: 'big.elp' };

      modal.notSaveSessionEventListener(button, {
        openOdeFile: true,
        localOdeFile: true,
        isLargeFile: true,
        odeFile: largeFile,
      });

      button.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(
        largeFile,
        false,
        false,
        true,
        true,
      );
      expect(closeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should open a remote ODE file when not saving', async () => {
      vi.useFakeTimers();
      const button = document.createElement('button');
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});

      modal.notSaveSessionEventListener(button, {
        openOdeFile: true,
        localOdeFile: false,
        id: 'remote-id-2',
      });

      button.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.modals.openuserodefiles.openUserOdeFilesWithOpenSession).toHaveBeenCalledWith(
        'remote-id-2',
      );
      expect(closeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('pure logout (no pendingAction)', () => {
    it('should save and redirect to /logout on Yes click', async () => {
      vi.useFakeTimers();
      modal.show({});
      vi.advanceTimersByTime(500);

      const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
      yesButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.eXeLearning.app.project._yjsBridge.saveManager.save).toHaveBeenCalled();
      expect(window.UnsavedChangesHelper.removeBeforeUnloadHandler).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/logout');
      vi.useRealTimers();
    });

    it('should still redirect to /logout when save throws on Yes click', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.project._yjsBridge.saveManager.save = vi.fn().mockRejectedValue(new Error('save error'));

      modal.show({});
      vi.advanceTimersByTime(500);

      const yesButton = mockElement.querySelector('.modal-footer .session-logout-save');
      yesButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.UnsavedChangesHelper.removeBeforeUnloadHandler).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/logout');
      vi.useRealTimers();
    });

    it('should redirect to /logout without saving on No click', async () => {
      vi.useFakeTimers();
      modal.show({});
      vi.advanceTimersByTime(500);

      const noButton = mockElement.querySelector('.modal-footer .session-logout-without-save');
      noButton.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(window.UnsavedChangesHelper.removeBeforeUnloadHandler).toHaveBeenCalled();
      expect(window.location.href).toBe('/base/logout');
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

        expect(window.UnsavedChangesHelper.removeBeforeUnloadHandler).toHaveBeenCalled();
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
});
