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

    it('should save project before inviting collaborator', async () => {
      const saveToServer = vi.fn().mockResolvedValue({});
      window.eXeLearning.app.project._yjsBridge = { saveToServer };
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'new@example.com';

      await modal.handleInvite();

      expect(saveToServer).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.addProjectCollaborator).toHaveBeenCalledWith(
        'proj-123',
        'new@example.com',
        'editor'
      );
    });

    it('should continue inviting even if save before invite fails', async () => {
      const saveToServer = vi.fn().mockRejectedValue(new Error('Save failed'));
      window.eXeLearning.app.project._yjsBridge = { saveToServer };
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'new2@example.com';

      await modal.handleInvite();

      expect(saveToServer).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.addProjectCollaborator).toHaveBeenCalledWith(
        'proj-123',
        'new2@example.com',
        'editor'
      );
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

  describe('close', () => {
    it('should return focus to last focused element', () => {
      const focusEl = { focus: vi.fn() };
      modal.lastFocusedElement = focusEl;
      modal.close();
      expect(focusEl.focus).toHaveBeenCalled();
    });

    it('should not throw when lastFocusedElement is null', () => {
      modal.lastFocusedElement = null;
      expect(() => modal.close()).not.toThrow();
    });
  });

  describe('loadProjectData', () => {
    it('should show error when response is not OK', async () => {
      window.eXeLearning.app.api.getProject.mockResolvedValueOnce({
        responseMessage: 'ERROR',
        detail: 'Not found',
      });
      const errorSpy = vi.spyOn(modal, 'showError');
      const result = await modal.loadProjectData('proj-123');
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Not found');
    });

    it('should show fallback error when detail is missing', async () => {
      window.eXeLearning.app.api.getProject.mockResolvedValueOnce({
        responseMessage: 'ERROR',
      });
      const errorSpy = vi.spyOn(modal, 'showError');
      await modal.loadProjectData('proj-123');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should show error on network exception', async () => {
      window.eXeLearning.app.api.getProject.mockRejectedValueOnce(new Error('Network error'));
      const errorSpy = vi.spyOn(modal, 'showError');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await modal.loadProjectData('proj-123');
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('behaviour - keyboard events', () => {
    it('should call handleInvite on Enter key in email input', () => {
      const inviteSpy = vi.spyOn(modal, 'handleInvite').mockImplementation(() => {});
      modal.behaviour();
      const event = new KeyboardEvent('keypress', { key: 'Enter' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      modal.inviteEmail.dispatchEvent(event);
      expect(inviteSpy).toHaveBeenCalled();
    });

    it('should not call handleInvite on non-Enter key', () => {
      const inviteSpy = vi.spyOn(modal, 'handleInvite').mockImplementation(() => {});
      modal.behaviour();
      modal.inviteEmail.dispatchEvent(new KeyboardEvent('keypress', { key: 'a' }));
      expect(inviteSpy).not.toHaveBeenCalled();
    });

    it('should call close on Escape key', () => {
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});
      modal.behaviour();
      mockElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should not call close on non-Escape key', () => {
      const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {});
      modal.behaviour();
      mockElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleInvite - additional branches', () => {
    it('should return early when not owner', async () => {
      modal.currentUserIsOwner = false;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await modal.handleInvite();
      expect(window.eXeLearning.app.api.addProjectCollaborator).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should show error for USER_NOT_FOUND response', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'notfound@example.com';
      window.eXeLearning.app.api.addProjectCollaborator.mockResolvedValueOnce({
        responseMessage: 'USER_NOT_FOUND',
      });
      const errorSpy = vi.spyOn(modal, 'showInviteError');
      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should show generic error for unknown response', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'user@example.com';
      window.eXeLearning.app.api.addProjectCollaborator.mockResolvedValueOnce({
        responseMessage: 'UNKNOWN_ERROR',
        detail: 'Something went wrong',
      });
      const errorSpy = vi.spyOn(modal, 'showInviteError');
      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalledWith('Something went wrong');
    });

    it('should show invite error on API exception', async () => {
      modal.currentUserIsOwner = true;
      modal.inviteEmail.value = 'user@example.com';
      window.eXeLearning.app.api.addProjectCollaborator.mockRejectedValueOnce(new Error('fail'));
      const errorSpy = vi.spyOn(modal, 'showInviteError');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await modal.handleInvite();
      expect(errorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleRemove', () => {
    beforeEach(() => {
      window.eXeLearning.app.api.removeProjectCollaborator = vi.fn().mockResolvedValue({
        responseMessage: 'OK',
      });
      modal.projectData = { collaborators: [], visibility: 'private' };
    });

    it('should do nothing when user cancels confirm', async () => {
      window.confirm = vi.fn(() => false);
      await modal.handleRemove(2, 'editor@example.com');
      expect(window.eXeLearning.app.api.removeProjectCollaborator).not.toHaveBeenCalled();
    });

    it('should remove collaborator and reload on success', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.project.odeId = 'proj-123';
      const announceSpy = vi.spyOn(modal, 'announce');
      await modal.handleRemove(2, 'editor@example.com');
      expect(window.eXeLearning.app.api.removeProjectCollaborator).toHaveBeenCalledWith('proj-123', 2);
      expect(announceSpy).toHaveBeenCalled();
    });

    it('should show error on failed response', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.api.removeProjectCollaborator.mockResolvedValueOnce({
        responseMessage: 'ERROR',
        detail: 'Cannot remove',
      });
      const errorSpy = vi.spyOn(modal, 'showError');
      await modal.handleRemove(2, 'editor@example.com');
      expect(errorSpy).toHaveBeenCalledWith('Cannot remove');
    });

    it('should show error on API exception', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.api.removeProjectCollaborator.mockRejectedValueOnce(new Error('fail'));
      const errorSpy = vi.spyOn(modal, 'showError');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await modal.handleRemove(2, 'editor@example.com');
      expect(errorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleMakeOwner', () => {
    beforeEach(() => {
      window.eXeLearning.app.api.transferProjectOwnership = vi.fn().mockResolvedValue({
        responseMessage: 'OK',
      });
      modal.projectData = { collaborators: [], visibility: 'private', isOwner: false };
    });

    it('should do nothing when user cancels confirm', async () => {
      window.confirm = vi.fn(() => false);
      await modal.handleMakeOwner(2, 'editor@example.com');
      expect(window.eXeLearning.app.api.transferProjectOwnership).not.toHaveBeenCalled();
    });

    it('should transfer ownership and re-render on success', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.project.odeId = 'proj-123';
      const announceSpy = vi.spyOn(modal, 'announce');
      await modal.handleMakeOwner(2, 'editor@example.com');
      expect(window.eXeLearning.app.api.transferProjectOwnership).toHaveBeenCalledWith('proj-123', 2);
      expect(announceSpy).toHaveBeenCalled();
    });

    it('should update share button pill after ownership transfer', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.project.odeId = 'proj-123';
      const updatePillSpy = vi.fn();
      window.eXeLearning.app.interface = {
        shareButton: { updateVisibilityPill: updatePillSpy },
      };
      await modal.handleMakeOwner(2, 'editor@example.com');
      expect(updatePillSpy).toHaveBeenCalledWith('private');
    });

    it('should show error on failed response', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.api.transferProjectOwnership.mockResolvedValueOnce({
        responseMessage: 'ERROR',
        detail: 'Not allowed',
      });
      const errorSpy = vi.spyOn(modal, 'showError');
      await modal.handleMakeOwner(2, 'editor@example.com');
      expect(errorSpy).toHaveBeenCalledWith('Not allowed');
    });

    it('should show error on API exception', async () => {
      window.confirm = vi.fn(() => true);
      window.eXeLearning.app.api.transferProjectOwnership.mockRejectedValueOnce(new Error('fail'));
      const errorSpy = vi.spyOn(modal, 'showError');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await modal.handleMakeOwner(2, 'editor@example.com');
      expect(errorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleVisibilityChange - additional branches', () => {
    it('should do nothing when new visibility equals current', async () => {
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'public' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      await modal.handleVisibilityChange('public');
      expect(window.eXeLearning.app.api.updateProjectVisibility).not.toHaveBeenCalled();
    });

    it('should update share button pill on successful visibility change', async () => {
      modal.currentUserIsOwner = true;
      modal.projectData = { visibility: 'private' };
      window.eXeLearning.app.project.odeId = 'proj-123';
      window.eXeLearning.app.api.updateProjectVisibility.mockResolvedValueOnce({ responseMessage: 'OK' });
      const updatePillSpy = vi.fn();
      window.eXeLearning.app.interface = {
        shareButton: { updateVisibilityPill: updatePillSpy },
      };
      await modal.handleVisibilityChange('public');
      expect(updatePillSpy).toHaveBeenCalledWith('public');
    });
  });

  describe('handleCopyLink - additional branches', () => {
    it('should return early when linkInput has no value', async () => {
      modal.linkInput.value = '';
      await modal.handleCopyLink();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('should show error on clipboard exception', async () => {
      modal.linkInput.value = 'http://link.to/project';
      navigator.clipboard.writeText = vi.fn().mockRejectedValueOnce(new Error('denied'));
      const errorSpy = vi.spyOn(modal, 'showError');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await modal.handleCopyLink();
      expect(errorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('showCopySuccess - setTimeout revert', () => {
    it('should revert button HTML after 2 seconds', () => {
      vi.useFakeTimers();
      const originalHTML = modal.copyButton.innerHTML;
      modal.showCopySuccess();
      expect(modal.copyButton.classList.contains('copied')).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(modal.copyButton.classList.contains('copied')).toBe(false);
      expect(modal.copyButton.innerHTML).toBe(originalHTML);
      vi.useRealTimers();
    });

    it('should not throw when copyButton is null', () => {
      modal.copyButton = null;
      expect(() => modal.showCopySuccess()).not.toThrow();
    });
  });

  describe('announce - setTimeout clear', () => {
    it('should set and then clear ariaLive text', () => {
      vi.useFakeTimers();
      modal.announce('Test message');
      expect(modal.ariaLive.textContent).toBe('Test message');
      vi.advanceTimersByTime(3000);
      expect(modal.ariaLive.textContent).toBe('');
      vi.useRealTimers();
    });

    it('should not throw when ariaLive is null', () => {
      modal.ariaLive = null;
      expect(() => modal.announce('Test')).not.toThrow();
    });
  });

  describe('buildShareUrl - no projectUuid', () => {
    it('should return url without project param when no project uuid', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'http://example.com/' },
        configurable: true,
      });
      window.eXeLearning.app.project = null;
      const url = modal.buildShareUrl();
      expect(url).not.toContain('project=');
    });
  });

  describe('saveProjectBeforeSharing - no bridge', () => {
    it('should return early when no _yjsBridge', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      await expect(modal.saveProjectBeforeSharing('test')).resolves.toBeUndefined();
    });
  });

  describe('showInviteError / clearInviteError - null guards', () => {
    it('should not throw when inviteError is null', () => {
      modal.inviteError = null;
      expect(() => modal.showInviteError('msg')).not.toThrow();
      expect(() => modal.clearInviteError()).not.toThrow();
    });
  });

  describe('updateVisibilityHelp', () => {
    it('should add d-none for private visibility', () => {
      modal.visibilityHelp.classList.remove('d-none');
      modal.updateVisibilityHelp('private');
      expect(modal.visibilityHelp.classList.contains('d-none')).toBe(true);
    });

    it('should not throw when visibilityHelp is null', () => {
      modal.visibilityHelp = null;
      expect(() => modal.updateVisibilityHelp('public')).not.toThrow();
    });
  });

  describe('renderLinkSection - null guard', () => {
    it('should return early when linkInput is null', () => {
      modal.linkInput = null;
      expect(() => modal.renderLinkSection()).not.toThrow();
    });

    it('should call buildShareUrl when no shareButton', () => {
      window.eXeLearning.app.interface = null;
      const buildSpy = vi.spyOn(modal, 'buildShareUrl').mockReturnValue('http://built/url');
      modal.renderLinkSection();
      expect(buildSpy).toHaveBeenCalled();
      expect(modal.linkInput.value).toBe('http://built/url');
    });
  });
});
