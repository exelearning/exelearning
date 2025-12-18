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
  });
});
