/**
 * Share Project Button - Integrated visibility pill and share modal
 */
export default class ShareProjectButton {
    constructor() {
        this.shareButton = document.querySelector('#head-top-share-button');
        this.visibilityIcon = this.shareButton?.querySelector(
            '.share-visibility-icon'
        );
        this.visibilityText = this.shareButton?.querySelector(
            '.share-visibility-text'
        );
        this.currentVisibility = 'private'; // Default
    }

    /**
     * Initialize the share button
     */
    init() {
        this.addEventClick();
        this.loadInitialState();
    }

    /**
     * Add click event to open share modal
     */
    addEventClick() {
        if (!this.shareButton) return;

        this.shareButton.addEventListener('click', async (event) => {
            // Check if there's an open iDevice
            if (eXeLearning.app.project.checkOpenIdevice()) return;

            // Save project first
            await eXeLearning.app.project.save();

            // Open share modal
            this.openShareModal();
        });
    }

    /**
     * Open the share modal
     */
    openShareModal() {
        const projectId = this.getProjectId();

        if (!projectId) {
            console.error('ShareProjectButton: No project ID available');
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: _('No project available to share'),
                contentId: 'error',
            });
            return;
        }

        // Open the new share modal
        if (eXeLearning.app.modals?.share) {
            eXeLearning.app.modals.share.show(projectId);
        } else {
            console.error('ShareProjectButton: Share modal not available');
        }
    }

    /**
     * Load initial project state to set visibility pill
     */
    async loadInitialState() {
        const projectId = this.getProjectId();

        if (!projectId) {
            // No project loaded yet, use default
            this.updateVisibilityPill('private');
            return;
        }

        try {
            const response = await eXeLearning.app.api.getProject(projectId);

            if (response.responseMessage === 'OK' && response.project) {
                this.updateVisibilityPill(response.project.visibility);
            }
        } catch (error) {
            console.error(
                'ShareProjectButton: Failed to load initial state:',
                error
            );
            // Use default on error
            this.updateVisibilityPill('private');
        }
    }

    /**
     * Update the visibility pill appearance
     * @param {string} visibility - 'public' or 'private'
     */
    updateVisibilityPill(visibility) {
        if (!this.visibilityIcon || !this.visibilityText) return;

        this.currentVisibility = visibility;

        if (visibility === 'public') {
            this.visibilityIcon.textContent = 'link';
            this.visibilityText.textContent = _('Public');
        } else {
            this.visibilityIcon.textContent = 'lock';
            this.visibilityText.textContent = _('Private');
        }
    }

    /**
     * Get current project ID
     * @returns {string|null}
     */
    getProjectId() {
        return (
            eXeLearning.app.project?.odeId ||
            eXeLearning.app.project?.requestedProjectId ||
            new URL(window.location.href).searchParams.get('projectId') ||
            null
        );
    }

    /**
     * Get current document URL for sharing
     * @param {string} fallbackUrl - Fallback URL if no session/project ID
     * @returns {string}
     */
    getCurrentDocumentUrl(fallbackUrl) {
        const url = new URL(window.location.href);
        const projectId =
            eXeLearning.app.project.odeId ||
            eXeLearning.app.project.requestedProjectId ||
            url.searchParams.get('projectId');

        if (projectId) {
            // Only use projectId for sharing - cleaner URLs
            url.searchParams.set('projectId', projectId);
            // Remove odeSessionId to keep URL clean and permanent
            url.searchParams.delete('odeSessionId');
        }

        if (!projectId && fallbackUrl) {
            return fallbackUrl;
        }

        return url.toString();
    }
}
