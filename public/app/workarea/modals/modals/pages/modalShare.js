import Modal from '../modal.js';
import { getInitials as getAvatarInitials, createAvatarHTML } from '../../../../utils/avatarUtils.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * Share Modal - Google Docs-style project sharing interface
 */
export default class ModalShare extends Modal {
    constructor(manager) {
        let id = 'modalShare';
        let titleDefault = _('Share');
        super(manager, id, titleDefault, false);

        // State
        this.projectData = null;
        this.lastFocusedElement = null;
        this.currentUserIsOwner = false;

        // DOM elements
        this.inviteSection = this.modalElement.querySelector('#share-invite-section');
        this.inviteEmail = this.modalElement.querySelector('#share-invite-email');
        this.inviteButton = this.modalElement.querySelector('#share-invite-button');
        this.inviteError = this.modalElement.querySelector('#share-invite-error');

        this.peopleSection = this.modalElement.querySelector('#share-people-section');
        this.peopleList = this.modalElement.querySelector('#share-people-list');

        this.generalAccessSection = this.modalElement.querySelector('#share-general-access-section');
        this.visibilitySelect = this.modalElement.querySelector('#share-visibility-select');
        this.visibilityHelp = this.modalElement.querySelector('#share-visibility-help');

        this.linkInput = this.modalElement.querySelector('#share-link-input');
        this.copyButton = this.modalElement.querySelector('#share-copy-button');

        this.ariaLive = this.modalElement.querySelector('#share-aria-live');
    }

    /**
     * Add custom behaviors for the share modal
     */
    behaviour() {
        super.behaviour();

        // Invite button
        this.inviteButton?.addEventListener('click', () => this.handleInvite());

        // Invite on Enter key
        this.inviteEmail?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleInvite();
            }
        });

        // Visibility dropdown
        this.visibilitySelect?.addEventListener('change', (e) =>
            this.handleVisibilityChange(e.target.value)
        );

        // Copy link button
        this.copyButton?.addEventListener('click', () => this.handleCopyLink());

        // ESC key to close
        this.modalElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    /**
     * Show the share modal
     * Gets the project ID from the current project
     */
    async show() {
        // Get project ID from current project
        const projectId = eXeLearning.app.project?.odeId;

        if (!projectId) {
            console.error('Share modal: No project ID available');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: _('No project available to share'),
                contentId: 'error',
            });
            return;
        }

        // Store last focused element for accessibility
        this.lastFocusedElement = document.activeElement;

        // Load project data
        const loaded = await this.loadProjectData(projectId);

        if (!loaded) {
            return;
        }

        // Check if current user is the project owner
        const currentUserId = eXeLearning.app.user?.id || eXeLearning.user?.id;
        this.currentUserIsOwner = this.projectData?.isOwner === true;

        // Close other modals first
        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;

        setTimeout(() => {
            // Update modal title
            const documentTitle = eXeLearning.app.project?.properties?.properties?.pp_title?.value;
            const projectTitle = (this.projectData?.title === _('Untitled document') || !this.projectData?.title)
                ? documentTitle
                : this.projectData?.title;

            const title = _('Share "{title}"').replace(
                '{title}',
                projectTitle || _('Untitled document')
            );
            this.setTitle(title);
            this.setContentId(projectId);

            // Show the Bootstrap modal
            this.modal.show();

            // Render all sections after modal is shown
            setTimeout(() => {
                this.renderInviteSection();
                this.renderPeopleList();
                this.renderVisibilitySection();
                this.renderLinkSection();

                // Focus invite email input only if owner
                if (this.currentUserIsOwner && this.inviteEmail) {
                    this.inviteEmail.focus();
                }
            }, 300);
        }, time);
    }

    /**
     * Close modal and return focus
     */
    close() {
        super.close();

        // Return focus to the element that opened the modal
        if (this.lastFocusedElement) {
            this.lastFocusedElement.focus();
        }
    }

    /**
     * Load project data from API
     * @param {number|string} projectId
     */
    async loadProjectData(projectId) {
        try {
            const response = await eXeLearning.app.api.getProject(projectId);

            if (response.responseMessage === 'OK') {
                this.projectData = response.project;
                return true;
            } else {
                this.showError(response.detail || _('Failed to load project data'));
                return false;
            }
        } catch (error) {
            console.error('Failed to load project:', error);
            this.showError(_('Failed to load project data'));
            return false;
        }
    }

    /**
     * Render the invite section (only visible for owner)
     */
    renderInviteSection() {
        if (!this.inviteSection) return;

        // Only owner can invite collaborators
        if (this.currentUserIsOwner) {
            this.inviteSection.style.display = '';
        } else {
            this.inviteSection.style.display = 'none';
        }
    }

    /**
     * Render the people list section
     */
    renderPeopleList() {
        if (!this.projectData || !this.peopleList) return;

        const currentUserId = eXeLearning.app.user?.id;
        const collaborators = this.projectData.collaborators || [];

        let html = '';

        // Render each collaborator (owner is included with role='owner')
        collaborators.forEach((collab) => {
            const user = collab.user;
            const isOwner = collab.role === 'owner';
            const isCurrentUser = String(user.id) === String(currentUserId);

            html += this.renderPersonRow(
                user,
                collab.role,
                isOwner,
                isCurrentUser,
                this.currentUserIsOwner
            );
        });

        this.peopleList.innerHTML = html;

        // Add event listeners for action menus
        this.attachPersonRowListeners();
    }

    /**
     * Render a single person row
     */
    renderPersonRow(user, role, isOwner, isCurrentUser, currentUserIsOwner) {
        const initials = this.getInitials(user.email);
        const roleLabel = role === 'owner' ? _('Owner') : _('Editor');

        return `
            <div class="share-person-row" data-user-id="${user.id}">
                <div class="share-person-avatar">
                    ${this.renderAvatar(user, initials)}
                </div>
                <div class="share-person-info">
                    <div class="share-person-email">
                        ${this.escapeHtml(user.email)}
                        ${isCurrentUser ? `<span class="text-muted ms-1">(${_('you')})</span>` : ''}
                        <span class="share-person-role-badge">${roleLabel}</span>
                    </div>
                </div>
                <div class="share-person-actions">
                    ${
                        isOwner
                            ? `<span class="share-person-owner-label text-muted">${_('Owner')}</span>`
                            : currentUserIsOwner
                              ? `
                        <div class="dropdown">
                            <button class="share-person-menu-btn" type="button"
                                    data-bs-toggle="dropdown" aria-label="${_('More actions')}">
                                <div class="auto-icon">more_vert</div>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item share-action-make-owner"
                                       href="#" data-user-id="${user.id}" data-email="${this.escapeHtml(user.email)}">
                                        <div class="auto-icon">person</div>
                                        ${_('Make owner')}
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item share-action-remove"
                                       href="#" data-user-id="${user.id}" data-email="${this.escapeHtml(user.email)}">
                                        <div class="auto-icon">person_remove</div>
                                        ${_('Remove access')}
                                    </a>
                                </li>
                            </ul>
                        </div>
                    `
                              : ''
                    }
                </div>
            </div>
        `;
    }

    /**
     * Render avatar (Gravatar or initials) with fallback and tooltip
     */
    renderAvatar(user, initials) {
        return createAvatarHTML({
            email: user.email,
            name: user.name,
            gravatarUrl: user.gravatarUrl,
            initials: initials,
            size: 40
        });
    }

    /**
     * Get initials from email (uses centralized avatarUtils)
     */
    getInitials(email) {
        return getAvatarInitials(email);
    }

    /**
     * Attach event listeners to person row actions
     */
    attachPersonRowListeners() {
        // Make owner actions
        this.peopleList?.querySelectorAll('.share-action-make-owner').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const userId = parseInt(e.currentTarget.dataset.userId);
                const email = e.currentTarget.dataset.email;
                this.handleMakeOwner(userId, email);
            });
        });

        // Remove actions
        this.peopleList?.querySelectorAll('.share-action-remove').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const userId = parseInt(e.currentTarget.dataset.userId);
                const email = e.currentTarget.dataset.email;
                this.handleRemove(userId, email);
            });
        });
    }

    /**
     * Render visibility section
     */
    renderVisibilitySection() {
        if (!this.projectData || !this.visibilitySelect) return;

        this.updateVisibilityOptionLabels();

        // Set current visibility
        this.visibilitySelect.value = this.projectData.visibility || 'public';

        // Only owner can change visibility
        this.visibilitySelect.disabled = !this.currentUserIsOwner;

        // Show/hide help text
        this.updateVisibilityHelp(this.projectData.visibility);
    }

    /**
     * Ensure visibility option labels include icons and no public/private suffix.
     */
    updateVisibilityOptionLabels() {
        if (!this.visibilitySelect) return;

        const privateOption = this.visibilitySelect.querySelector(
            'option[value="private"]'
        );
        const publicOption = this.visibilitySelect.querySelector(
            'option[value="public"]'
        );

        if (privateOption) privateOption.textContent = '🔒 Restricted (Private)';
        if (publicOption) publicOption.textContent = '🌐 Anyone with the link (Public)';
    }

    /**
     * Update visibility help text
     */
    updateVisibilityHelp(visibility) {
        if (!this.visibilityHelp) return;

        if (visibility === 'public') {
            this.visibilityHelp.classList.remove('d-none');
        } else {
            this.visibilityHelp.classList.add('d-none');
        }
    }

    /**
     * Render link section
     */
    renderLinkSection() {
        if (!this.linkInput) return;

        const shareButton = eXeLearning.app.interface?.shareButton;
        const url = shareButton
            ? shareButton.getCurrentDocumentUrl()
            : this.buildShareUrl();

        this.linkInput.value = url;
    }

    /**
     * Build share URL
     * Note: Uses 'project' query parameter to match server-side pages.ts route
     */
    buildShareUrl() {
        const url = new URL(window.location.href);
        const projectUuid =
            eXeLearning.app.project?.odeId ||
            eXeLearning.app.project?.requestedProjectId ||
            url.searchParams.get('project');

        if (projectUuid) {
            url.searchParams.set('project', projectUuid);
            // Clean up legacy parameters
            url.searchParams.delete('projectId');
            url.searchParams.delete('odeSessionId');
        }

        return url.toString();
    }

    /**
     * Handle invite action
     */
    async handleInvite() {
        if (!this.currentUserIsOwner) {
            console.warn('Only project owner can invite collaborators');
            return;
        }

        const email = this.inviteEmail?.value.trim();

        if (!email) {
            this.showInviteError(_('Please enter an email address'));
            return;
        }

        if (!this.validateEmail(email)) {
            this.showInviteError(_('Please enter a valid email address'));
            return;
        }

        this.clearInviteError();

        try {
            this.inviteButton.disabled = true;
            this.inviteButton.textContent = _('Inviting...');

            const projectId = eXeLearning.app.project?.odeId;
            const response = await eXeLearning.app.api.addProjectCollaborator(
                projectId,
                email,
                'editor'
            );

            if (response.responseMessage === 'OK') {
                this.inviteEmail.value = '';
                await this.loadProjectData(projectId);
                this.renderPeopleList();
                this.announce(_('Invited {email}').replace('{email}', email));
            } else {
                if (response.responseMessage === 'ALREADY_COLLABORATOR') {
                    this.showInviteError(_('This user is already a collaborator'));
                } else if (response.responseMessage === 'USER_NOT_FOUND') {
                    this.showInviteError(_('User not found'));
                } else {
                    this.showInviteError(response.detail || _('Failed to invite user'));
                }
            }
        } catch (error) {
            console.error('Failed to invite collaborator:', error);
            this.showInviteError(_('Failed to invite user'));
        } finally {
            this.inviteButton.disabled = false;
            this.inviteButton.textContent = _('Invite');
        }
    }

    /**
     * Handle remove access action
     */
    async handleRemove(userId, email) {
        const confirmMessage = _("Remove {email}'s access to this project?").replace('{email}', email);

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const projectId = eXeLearning.app.project?.odeId;
            const response = await eXeLearning.app.api.removeProjectCollaborator(
                projectId,
                userId
            );

            if (response.responseMessage === 'OK') {
                await this.loadProjectData(projectId);
                this.renderPeopleList();
                this.announce(_('Removed {email}').replace('{email}', email));
            } else {
                this.showError(response.detail || _('Failed to remove collaborator'));
            }
        } catch (error) {
            console.error('Failed to remove collaborator:', error);
            this.showError(_('Failed to remove collaborator'));
        }
    }

    /**
     * Handle make owner action
     */
    async handleMakeOwner(userId, email) {
        const confirmMessage = _('Transfer ownership to {email}? You will become an editor.').replace('{email}', email);

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const projectId = eXeLearning.app.project?.odeId;
            const response = await eXeLearning.app.api.transferProjectOwnership(
                projectId,
                userId
            );

            if (response.responseMessage === 'OK') {
                await this.loadProjectData(projectId);

                // Update isOwner flag
                this.currentUserIsOwner = this.projectData?.isOwner === true;

                // Re-render all sections
                this.renderInviteSection();
                this.renderPeopleList();
                this.renderVisibilitySection();

                this.announce(_('Ownership transferred to {email}').replace('{email}', email));

                // Update share button pill
                if (eXeLearning.app.interface?.shareButton) {
                    eXeLearning.app.interface.shareButton.updateVisibilityPill(
                        this.projectData.visibility
                    );
                }
            } else {
                this.showError(response.detail || _('Failed to transfer ownership'));
            }
        } catch (error) {
            console.error('Failed to transfer ownership:', error);
            this.showError(_('Failed to transfer ownership'));
        }
    }

    /**
     * Handle visibility change
     */
    async handleVisibilityChange(newVisibility) {
        // Always use current odeId to avoid stale project reference
        const projectId = eXeLearning.app.project?.odeId;
        if (!projectId) {
            console.error('[Share] Cannot update visibility: no current project', {
                projectData: this.projectData,
                odeId: projectId
            });
            this.showError(_('Project data not loaded. Please try again.'));
            return;
        }

        Logger.log('[Share] handleVisibilityChange:', {
            projectId: projectId,
            uuid: this.projectData?.uuid,
            currentVisibility: this.projectData?.visibility,
            newVisibility: newVisibility
        });

        if (!this.currentUserIsOwner) {
            console.warn('Only project owner can change visibility');
            this.visibilitySelect.value = this.projectData.visibility;
            return;
        }

        if (newVisibility === this.projectData.visibility) {
            return;
        }

        try {
            // Force save BEFORE changing visibility to public/shared
            // This ensures the Yjs document is on the server so other clients can load it
            // and don't create duplicate blank pages when joining
            if (newVisibility !== 'private') {
                const bridge = eXeLearning.app.project?._yjsBridge;
                if (bridge?.saveToServer) {
                    Logger.log('[Share] Saving project before visibility change to:', newVisibility);
                    try {
                        await bridge.saveToServer();
                        Logger.log('[Share] Project saved successfully');
                    } catch (saveError) {
                        // Log but continue - visibility change can still work
                        console.warn('[Share] Failed to save before visibility change:', saveError);
                    }
                }
            }

            const response = await eXeLearning.app.api.updateProjectVisibility(
                projectId,
                newVisibility
            );
            Logger.log('[Share] updateProjectVisibility response:', response);

            if (response.responseMessage === 'OK') {
                this.projectData.visibility = newVisibility;
                this.updateVisibilityHelp(newVisibility);

                const message =
                    newVisibility === 'public'
                        ? _('Project is now public')
                        : _('Project is now private');
                this.announce(message);

                // Update share button pill
                if (eXeLearning.app.interface?.shareButton) {
                    eXeLearning.app.interface.shareButton.updateVisibilityPill(newVisibility);
                }
            } else {
                this.showError(response.detail || _('Failed to update visibility'));
                this.visibilitySelect.value = this.projectData.visibility;
            }
        } catch (error) {
            console.error('Failed to update visibility:', error);
            this.showError(_('Failed to update visibility'));
            this.visibilitySelect.value = this.projectData.visibility;
        }
    }

    /**
     * Handle copy link action
     */
    async handleCopyLink() {
        const url = this.linkInput?.value;

        if (!url) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                this.showCopySuccess();
            } else {
                this.linkInput.select();
                document.execCommand('copy');
                this.showCopySuccess();
            }

            this.announce(_('Link copied to clipboard'));
        } catch (error) {
            console.error('Failed to copy link:', error);
            this.showError(_('Failed to copy link'));
        }
    }

    /**
     * Show copy success feedback
     */
    showCopySuccess() {
        if (!this.copyButton) return;

        const originalHTML = this.copyButton.innerHTML;

        this.copyButton.classList.add('copied');
        this.copyButton.innerHTML = `
            <div class="auto-icon">check</div>
            <span>${_('Copied!')}</span>
        `;

        setTimeout(() => {
            this.copyButton.classList.remove('copied');
            this.copyButton.innerHTML = originalHTML;
        }, 2000);
    }

    /**
     * Show invite error
     */
    showInviteError(message) {
        if (!this.inviteError) return;

        this.inviteError.textContent = message;
        this.inviteError.classList.remove('d-none');
        this.inviteError.classList.add('d-block');
        this.inviteEmail?.classList.add('is-invalid');
    }

    /**
     * Clear invite error
     */
    clearInviteError() {
        if (!this.inviteError) return;

        this.inviteError.textContent = '';
        this.inviteError.classList.remove('d-block');
        this.inviteError.classList.add('d-none');
        this.inviteEmail?.classList.remove('is-invalid');
    }

    /**
     * Show general error message
     */
    showError(message) {
        eXeLearning.app.modals.alert.show({
            title: _('Error'),
            body: message,
            contentId: 'error',
        });
    }

    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (!this.ariaLive) return;

        this.ariaLive.textContent = message;

        setTimeout(() => {
            this.ariaLive.textContent = '';
        }, 3000);
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
