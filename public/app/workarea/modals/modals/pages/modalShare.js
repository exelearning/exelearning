import Modal from '../modal.js';

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
        this.inviteSection = this.modalElement.querySelector(
            '#share-invite-section'
        );
        this.inviteEmail = this.modalElement.querySelector(
            '#share-invite-email'
        );
        this.inviteButton = this.modalElement.querySelector(
            '#share-invite-button'
        );
        this.inviteError = this.modalElement.querySelector(
            '#share-invite-error'
        );

        this.peopleSection = this.modalElement.querySelector(
            '#share-people-section'
        );
        this.peopleList = this.modalElement.querySelector('#share-people-list');

        this.visibilitySelect = this.modalElement.querySelector(
            '#share-visibility-select'
        );
        this.visibilityHelp = this.modalElement.querySelector(
            '#share-visibility-help'
        );

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
     * Show the share modal for a specific project
     * @param {string} projectId - The project ID to share
     */
    async show(projectId) {
        if (!projectId) {
            console.error('Share modal: projectId is required');
            return;
        }

        // Store last focused element for accessibility
        this.lastFocusedElement = document.activeElement;

        // Load project data
        await this.loadProjectData(projectId);

        if (!this.projectData) {
            console.error('Share modal: Failed to load project data');
            return;
        }

        // Check if current user is the project owner
        // Try to get user ID from app.user (UserManager) or fallback to eXeLearning.user
        const currentUserId = eXeLearning.app.user?.id || eXeLearning.user?.id;
        console.log('Share modal debug:', {
            currentUserId,
            ownerId: this.projectData.owner?.id,
            ownerEmail: this.projectData.owner?.email,
            userObject: eXeLearning.app.user,
            fallbackUser: eXeLearning.user,
        });
        // Use flexible comparison to handle both string and number IDs
        this.currentUserIsOwner =
            this.projectData.owner &&
            String(this.projectData.owner.id) === String(currentUserId);

        // Close other modals first
        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;

        setTimeout(() => {
            // Update modal title
            const title = _('Share "{title}"').replace(
                '{title}',
                this.projectData.title || ''
            );
            this.setTitle(title);
            this.setContentId(projectId);

            // Show the Bootstrap modal directly (don't call super.show() as it clears the body)
            this.modal.show();

            // Render all sections after modal is shown
            setTimeout(() => {
                this.renderInviteSection();
                this.renderPeopleList();
                this.renderVisibilitySection();
                this.renderLinkSection();

                // Focus invite email input only if owner
                if (this.currentUserIsOwner) {
                    this.inviteEmail?.focus();
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
     * @param {string} projectId
     */
    async loadProjectData(projectId) {
        try {
            const response = await eXeLearning.app.api.getProject(projectId);

            if (response.responseMessage === 'OK') {
                this.projectData = response.project;
                return true;
            } else {
                this.showError(_('Failed to load project data'));
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
        const projectOwner = this.projectData.owner;
        const collaborators = this.projectData.collaborators || [];

        // Check if current user is the project owner (use flexible comparison)
        const currentUserIsOwner =
            projectOwner && String(projectOwner.id) === String(currentUserId);

        let html = '';

        // Render each collaborator
        collaborators.forEach((collab) => {
            const user = collab.user;
            const isOwner = collab.role === 'owner';
            const isCurrentUser = String(user.id) === String(currentUserId);

            html += this.renderPersonRow(
                user,
                collab.role,
                isOwner,
                isCurrentUser,
                currentUserIsOwner
            );
        });

        this.peopleList.innerHTML = html;

        // Add event listeners for action menus
        this.attachPersonRowListeners();
    }

    /**
     * Render a single person row
     * @param {object} user - User object {id, email, userId}
     * @param {string} role - User role (owner, editor)
     * @param {boolean} isOwner - Is this user an owner?
     * @param {boolean} isCurrentUser - Is this the current logged-in user?
     * @param {boolean} currentUserIsOwner - Is the current logged-in user the project owner?
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
                            ? `
                        <span class="share-person-owner-label text-muted">${_('Owner')}</span>
                    `
                            : currentUserIsOwner
                              ? `
                        <div class="dropdown">
                            <button class="share-person-menu-btn" type="button"
                                    data-bs-toggle="dropdown" aria-label="${_('More actions')}">
                                <i class="auto-icon">more_vert</i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item share-action-make-owner"
                                       href="#" data-user-id="${user.id}" data-email="${this.escapeHtml(user.email)}">
                                        <i class="auto-icon">person</i>
                                        ${_('Make owner')}
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item share-action-remove"
                                       href="#" data-user-id="${user.id}" data-email="${this.escapeHtml(user.email)}">
                                        <i class="auto-icon">person_remove</i>
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
     * Render avatar (Gravatar or initials)
     * @param {object} user
     * @param {string} initials
     */
    renderAvatar(user, initials) {
        // Note: Currently the API doesn't return gravatarUrl, but we prepare for it
        if (user.gravatarUrl) {
            return `<img src="${user.gravatarUrl}" alt="${this.escapeHtml(user.email)}" />`;
        } else {
            return initials;
        }
    }

    /**
     * Get initials from email
     * @param {string} email
     */
    getInitials(email) {
        if (!email) return '?';

        const parts = email.split('@')[0].split('.');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else {
            return email.substring(0, 2).toUpperCase();
        }
    }

    /**
     * Attach event listeners to person row actions
     */
    attachPersonRowListeners() {
        // Make owner actions
        this.peopleList
            .querySelectorAll('.share-action-make-owner')
            .forEach((link) => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const userId = parseInt(e.currentTarget.dataset.userId);
                    const email = e.currentTarget.dataset.email;
                    this.handleMakeOwner(userId, email);
                });
            });

        // Remove actions
        this.peopleList
            .querySelectorAll('.share-action-remove')
            .forEach((link) => {
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

        // Set current visibility
        this.visibilitySelect.value = this.projectData.visibility;

        // Only owner can change visibility
        if (this.currentUserIsOwner) {
            this.visibilitySelect.disabled = false;
        } else {
            this.visibilitySelect.disabled = true;
        }

        // Show/hide help text
        this.updateVisibilityHelp(this.projectData.visibility);
    }

    /**
     * Update visibility help text
     * @param {string} visibility
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

        // Use the ShareProjectButton method to get the current URL
        const shareButton = eXeLearning.app.interface?.shareButton;
        const url = shareButton
            ? shareButton.getCurrentDocumentUrl()
            : window.location.href;

        this.linkInput.value = url;
    }

    /**
     * Handle invite action
     */
    async handleInvite() {
        // Only owner can invite collaborators
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
            // Disable button while processing
            this.inviteButton.disabled = true;
            this.inviteButton.textContent = _('Inviting...');

            const response = await eXeLearning.app.api.addProjectCollaborator(
                this.projectData.id,
                email,
                'editor' // Default role
            );

            if (response.responseMessage === 'OK') {
                // Clear input
                this.inviteEmail.value = '';

                // Reload project data to get updated collaborators
                await this.loadProjectData(this.projectData.id);

                // Re-render people list
                this.renderPeopleList();

                // Show success message
                this.announce(_('Invited {email}').replace('{email}', email));
            } else {
                // Handle specific error messages
                if (response.responseMessage === 'ALREADY_COLLABORATOR') {
                    this.showInviteError(
                        _('This user is already a collaborator')
                    );
                } else if (response.responseMessage === 'USER_NOT_FOUND') {
                    this.showInviteError(_('User not found'));
                } else {
                    this.showInviteError(
                        response.detail || _('Failed to invite user')
                    );
                }
            }
        } catch (error) {
            console.error('Failed to invite collaborator:', error);
            this.showInviteError(_('Failed to invite user'));
        } finally {
            // Re-enable button
            this.inviteButton.disabled = false;
            this.inviteButton.textContent = _('Invite');
        }
    }

    /**
     * Handle remove access action
     * @param {number} userId
     * @param {string} email
     */
    async handleRemove(userId, email) {
        const confirmMessage = _(
            "Remove {email}'s access to this project?"
        ).replace('{email}', email);

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response =
                await eXeLearning.app.api.removeProjectCollaborator(
                    this.projectData.id,
                    userId
                );

            if (response.responseMessage === 'OK') {
                // Reload project data
                await this.loadProjectData(this.projectData.id);

                // Re-render people list
                this.renderPeopleList();

                // Show success message
                this.announce(_('Removed {email}').replace('{email}', email));
            } else {
                this.showError(
                    response.detail || _('Failed to remove collaborator')
                );
            }
        } catch (error) {
            console.error('Failed to remove collaborator:', error);
            this.showError(_('Failed to remove collaborator'));
        }
    }

    /**
     * Handle make owner action
     * @param {number} userId
     * @param {string} email
     */
    async handleMakeOwner(userId, email) {
        const confirmMessage = _(
            'Transfer ownership to {email}? You will become an editor.'
        ).replace('{email}', email);

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await eXeLearning.app.api.transferProjectOwnership(
                this.projectData.id,
                userId
            );

            if (response.responseMessage === 'OK') {
                // Reload project data
                await this.loadProjectData(this.projectData.id);

                // Re-render people list
                this.renderPeopleList();

                // Show success message
                this.announce(
                    _('Ownership transferred to {email}').replace(
                        '{email}',
                        email
                    )
                );

                // Update share button pill if available
                if (eXeLearning.app.interface?.shareButton) {
                    eXeLearning.app.interface.shareButton.updateVisibilityPill(
                        this.projectData.visibility
                    );
                }
            } else {
                this.showError(
                    response.detail || _('Failed to transfer ownership')
                );
            }
        } catch (error) {
            console.error('Failed to transfer ownership:', error);
            this.showError(_('Failed to transfer ownership'));
        }
    }

    /**
     * Handle visibility change
     * @param {string} newVisibility
     */
    async handleVisibilityChange(newVisibility) {
        // Only owner can change visibility
        if (!this.currentUserIsOwner) {
            console.warn('Only project owner can change visibility');
            this.visibilitySelect.value = this.projectData.visibility;
            return;
        }

        if (newVisibility === this.projectData.visibility) {
            return; // No change
        }

        try {
            const response = await eXeLearning.app.api.updateProjectVisibility(
                this.projectData.id,
                newVisibility
            );

            if (response.responseMessage === 'OK') {
                // Update local state
                this.projectData.visibility = newVisibility;

                // Update help text
                this.updateVisibilityHelp(newVisibility);

                // Show success message
                const message =
                    newVisibility === 'public'
                        ? _('Project is now public')
                        : _('Project is now private');
                this.announce(message);

                // Update share button pill
                if (eXeLearning.app.interface?.shareButton) {
                    eXeLearning.app.interface.shareButton.updateVisibilityPill(
                        newVisibility
                    );
                }
            } else {
                this.showError(
                    response.detail || _('Failed to update visibility')
                );
                // Revert select to previous value
                this.visibilitySelect.value = this.projectData.visibility;
            }
        } catch (error) {
            console.error('Failed to update visibility:', error);
            this.showError(_('Failed to update visibility'));
            // Revert select to previous value
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
            // Try Clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                this.showCopySuccess();
            } else {
                // Fallback for older browsers
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

        // Update button appearance
        this.copyButton.classList.add('copied');
        this.copyButton.innerHTML = `
            <i class="auto-icon">check</i>
            <span>${_('Copied!')}</span>
        `;

        // Reset after 2 seconds
        setTimeout(() => {
            this.copyButton.classList.remove('copied');
            this.copyButton.innerHTML = originalHTML;
        }, 2000);
    }

    /**
     * Show invite error
     * @param {string} message
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
     * @param {string} message
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
     * @param {string} message
     */
    announce(message) {
        if (!this.ariaLive) return;

        this.ariaLive.textContent = message;

        // Clear after 3 seconds
        setTimeout(() => {
            this.ariaLive.textContent = '';
        }, 3000);
    }

    /**
     * Validate email format
     * @param {string} email
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
