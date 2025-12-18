import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalShare from './modalShare.js';

// Mock avatar utils
vi.mock('../../../../utils/avatarUtils.js', () => ({
  getInitials: vi.fn(name => name[0]),
  createAvatarHTML: vi.fn((name, color) => `<div class="avatar">${name[0]}</div>`)
}));

describe('ModalShare', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: { odeId: 'proj-123' },
        modals: {
          alert: { show: vi.fn() },
          toast: { show: vi.fn() },
        },
        api: {
           getProject: vi.fn().mockResolvedValue({
               responseMessage: 'OK',
               project: {
                   id: 'proj-123',
                   title: 'Test Project',
                   visibility: 'private',
                   collaborators: []
               }
           }),
           getProjectSharing: vi.fn().mockResolvedValue({
               projectId: 'proj-123',
               visibility: 'private',
               collaborators: []
           }),
           updateProjectVisibility: vi.fn().mockResolvedValue({ success: true }),
           addProjectCollaborator: vi.fn().mockResolvedValue({ responseMessage: 'OK' })
        }
      },
      user: { id: 'user-1' }
    };

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(true)
      }
    });

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalShare';
    mockElement.innerHTML = `
      <div id="share-invite-section">
        <input id="share-invite-email" type="email">
        <button id="share-invite-button">Invite</button>
        <div id="share-invite-error"></div>
      </div>
      <div id="share-people-section">
        <div id="share-people-list"></div>
      </div>
      <div id="share-general-access-section">
        <select id="share-visibility-select">
            <option value="private">Private</option>
            <option value="public">Public</option>
        </select>
        <div id="share-visibility-help"></div>
      </div>
      <input id="share-link-input">
      <button id="share-copy-button">Copy</button>
      <div id="share-aria-live"></div>
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalShare') return mockElement;
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
    window.bootstrap.Modal.getInstance = vi.fn(() => mockBootstrapModal);

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

    modal = new ModalShare(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should load project data and show modal', async () => {
      vi.useFakeTimers();
      await modal.show();
      vi.advanceTimersByTime(500);
      expect(window.eXeLearning.app.api.getProject).toHaveBeenCalledWith('proj-123');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should show error if no project ID', async () => {
      window.eXeLearning.app.project = null;
      await modal.show();
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
    });
  });

  describe('handleCopyLink', () => {
    it('should copy link to clipboard and show success feedback', async () => {
      vi.useFakeTimers();
      modal.linkInput.value = 'http://link.to/project';
      await modal.handleCopyLink();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://link.to/project');
      expect(modal.copyButton.classList.contains('copied')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('behaviour', () => {
      it('should add event listeners', () => {
          const inviteSpy = vi.spyOn(modal, 'handleInvite').mockImplementation(() => {});
          modal.behaviour();
          modal.inviteButton.click();
          expect(inviteSpy).toHaveBeenCalled();
      });
  });
});
