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
        <img id="share-visibility-icon" src="/icons/lock.svg" alt="" width="16" height="16">
        <select id="share-visibility-select"
                data-icon-private="/icons/exe-lock-icon-green.svg"
                data-icon-public="/icons/exe-globe-icon-green.svg">
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

    it('should fallback to execCommand when clipboard API is unavailable', async () => {
      const clipboardBackup = navigator.clipboard;
      delete navigator.clipboard;
      if (!document.execCommand) {
        document.execCommand = () => true;
      }
      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

      modal.linkInput.value = 'http://link.to/project';
      await modal.handleCopyLink();

      expect(execSpy).toHaveBeenCalledWith('copy');
      navigator.clipboard = clipboardBackup;
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

  describe('renderInviteSection', () => {
    it('should show invite section for owner', () => {
      modal.currentUserIsOwner = true;
      modal.renderInviteSection();
      expect(modal.inviteSection.style.display).toBe('');
    });

    it('should hide invite section for non-owner', () => {
      modal.currentUserIsOwner = false;
      modal.renderInviteSection();
      expect(modal.inviteSection.style.display).toBe('none');
    });
  });

  describe('renderPeopleList', () => {
    it('should render collaborator rows and attach action listeners', () => {
      modal.projectData = {
        collaborators: [
          { role: 'owner', user: { id: 1, email: 'owner@example.com' } },
          { role: 'editor', user: { id: 2, email: 'editor@example.com' } },
        ],
      };
      modal.currentUserIsOwner = true;
      window.eXeLearning.app.user = { id: 99 };

      const removeSpy = vi.spyOn(modal, 'handleRemove').mockImplementation(() => {});
      const makeOwnerSpy = vi.spyOn(modal, 'handleMakeOwner').mockImplementation(() => {});

      modal.renderPeopleList();
      const makeOwnerLink = modal.peopleList.querySelector('.share-action-make-owner');
      const removeLink = modal.peopleList.querySelector('.share-action-remove');

      makeOwnerLink.click();
      removeLink.click();

      expect(makeOwnerSpy).toHaveBeenCalledWith(2, 'editor@example.com');
      expect(removeSpy).toHaveBeenCalledWith(2, 'editor@example.com');
    });
  });

  describe('renderVisibilitySection', () => {
    it('should update labels and help for public visibility', () => {
      modal.projectData = { visibility: 'public' };
      modal.currentUserIsOwner = true;

      modal.renderVisibilitySection();

      expect(modal.visibilitySelect.value).toBe('public');
      expect(modal.visibilityHelp.classList.contains('d-none')).toBe(false);
    });

    it('should disable select for non-owner', () => {
      modal.projectData = { visibility: 'private' };
      modal.currentUserIsOwner = false;

      modal.renderVisibilitySection();

      expect(modal.visibilitySelect.disabled).toBe(true);
    });

    it('should update icon when rendering visibility section', () => {
      modal.projectData = { visibility: 'public' };
      modal.currentUserIsOwner = true;

      modal.renderVisibilitySection();

      expect(modal.visibilityIcon.src).toContain('exe-globe-icon-green.svg');
    });
  });

  describe('updateVisibilityIcon', () => {
    it('should set public icon when visibility is public', () => {
      modal.updateVisibilityIcon('public');
      expect(modal.visibilityIcon.src).toContain('exe-globe-icon-green.svg');
    });

    it('should set private icon when visibility is private', () => {
      modal.updateVisibilityIcon('private');
      expect(modal.visibilityIcon.src).toContain('exe-lock-icon-green.svg');
    });

    it('should handle missing visibilityIcon gracefully', () => {
      modal.visibilityIcon = null;
      expect(() => modal.updateVisibilityIcon('public')).not.toThrow();
    });

    it('should handle missing visibilitySelect gracefully', () => {
      modal.visibilitySelect = null;
      expect(() => modal.updateVisibilityIcon('public')).not.toThrow();
    });
  });

  describe('renderLinkSection', () => {
    it('should use share button url when available', () => {
      window.eXeLearning.app.interface = {
        shareButton: { getCurrentDocumentUrl: vi.fn(() => 'http://share/url') },
      };

      modal.renderLinkSection();
      expect(modal.linkInput.value).toBe('http://share/url');
    });
  });

  describe('buildShareUrl', () => {
    it('should set project param and remove legacy params', () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { href: 'http://example.com/?projectId=1&odeSessionId=2' },
        configurable: true,
      });
      window.eXeLearning.app.project.odeId = 'proj-123';

      const url = modal.buildShareUrl();

      expect(url).toContain('project=proj-123');
      expect(url).not.toContain('projectId=');
      expect(url).not.toContain('odeSessionId=');

      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
    });
  });

  describe('handleInvite', () => {
    it('should show error for empty email', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = '';
      const errorSpy = vi.spyOn(modal, 'showInviteError');

      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should show error for invalid email', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'invalid-email';
      const errorSpy = vi.spyOn(modal, 'showInviteError');

      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle already collaborator response', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'dup@example.com';
      window.eXeLearning.app.api.addProjectCollaborator.mockResolvedValueOnce({
        responseMessage: 'ALREADY_COLLABORATOR',
      });
      const errorSpy = vi.spyOn(modal, 'showInviteError');

      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('handleVisibilityChange', () => {
    it('should show error if projectId missing', async () => {
      window.eXeLearning.app.project.odeId = null;
      const errorSpy = vi.spyOn(modal, 'showError');

      await modal.handleVisibilityChange('public');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should ignore change when not owner', async () => {
      modal.currentUserIsOwner = false;
      modal.projectData = { visibility: 'private' };
      modal.visibilitySelect.value = 'public';

      await modal.handleVisibilityChange('public');
      expect(modal.visibilitySelect.value).toBe('private');
    });

    it('should update visibility on success', async () => {
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({ responseMessage: 'OK' });

      await modal.handleVisibilityChange('public');
      expect(modal.projectData.visibility).toBe('public');
    });

    it('should save project before changing visibility to public', async () => {
      const saveToServer = vi.fn().mockResolvedValue({});
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.project._yjsBridge = { saveToServer };
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({ responseMessage: 'OK' });

      await modal.handleVisibilityChange('public');

      // Save should be called before visibility change
      expect(saveToServer).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.updateProjectVisibility).toHaveBeenCalledWith('proj-123', 'public');
    });

    it('should NOT save project when changing visibility to private', async () => {
      const saveToServer = vi.fn().mockResolvedValue({});
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'public', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.project._yjsBridge = { saveToServer };
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({ responseMessage: 'OK' });

      await modal.handleVisibilityChange('private');

      // Save should NOT be called when going to private
      expect(saveToServer).not.toHaveBeenCalled();
      expect(window.eXeLearning.app.api.updateProjectVisibility).toHaveBeenCalledWith('proj-123', 'private');
    });

    it('should continue with visibility change even if save fails', async () => {
      const saveToServer = vi.fn().mockRejectedValue(new Error('Save failed'));
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.project._yjsBridge = { saveToServer };
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({ responseMessage: 'OK' });

      await modal.handleVisibilityChange('public');

      // Should still update visibility even if save fails
      expect(saveToServer).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.updateProjectVisibility).toHaveBeenCalled();
      expect(modal.projectData.visibility).toBe('public');
    });

    it('should revert visibility and icon when API returns error', async () => {
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({
        responseMessage: 'ERROR',
        detail: 'Failed to update',
      });
      const updateIconSpy = vi.spyOn(modal, 'updateVisibilityIcon');

      await modal.handleVisibilityChange('public');

      expect(modal.visibilitySelect.value).toBe('private');
      expect(updateIconSpy).toHaveBeenCalledWith('private');
    });

    it('should revert visibility and icon when API throws exception', async () => {
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private', uuid: 'proj-123' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.api.updateProjectVisibility.mockRejectedValueOnce(
        new Error('Network error')
      );
      const updateIconSpy = vi.spyOn(modal, 'updateVisibilityIcon');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await modal.handleVisibilityChange('public');

      expect(modal.visibilitySelect.value).toBe('private');
      expect(updateIconSpy).toHaveBeenCalledWith('private');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('utilities', () => {
    it('validateEmail should accept valid email and reject invalid', () => {
      expect(modal.validateEmail('user@example.com')).toBe(true);
      expect(modal.validateEmail('invalid-email')).toBe(false);
    });

    it('escapeHtml should escape markup', () => {
      expect(modal.escapeHtml('<script>')).toBe('&lt;script&gt;');
    });
  });
});
