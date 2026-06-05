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
        modals: {
          alert: {
            show: vi.fn(),
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
