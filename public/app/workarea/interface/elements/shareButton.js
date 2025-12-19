/**
 * Share Project Button - Opens share modal with project link
 */
export default class ShareProjectButton {
    constructor() {
        this.shareButton = document.querySelector('#head-top-share-button');
        this.visibilityIcon = this.shareButton?.querySelector(
            '.share-visibility-icon'
        );
        this.currentVisibility = 'private'; // Default
    }

    /**
     * Initialize the share button
     */
    init() {
        this.addEventClick();
    }

    /**
     * Add click event to open share modal
     */
    addEventClick() {
        if (!this.shareButton) return;

        this.shareButton.addEventListener('click', async (event) => {
            // Check if there's an open iDevice
            if (eXeLearning.app.project.checkOpenIdevice()) return;

            // Open share modal directly (no save)
            this.openShareModal();
        });
    }

    /**
     * Open the share modal
     */
    openShareModal() {
        // Open the share modal
        if (eXeLearning.app.modals?.share) {
            eXeLearning.app.modals.share.show();
        } else {
            console.error('ShareProjectButton: Share modal not available');
        }
    }

    /**
     * Update the visibility pill appearance
     * @param {string} visibility - 'public' or 'private'
     */
    updateVisibilityPill(visibility) {
        if (!this.visibilityIcon) return;

        this.currentVisibility = visibility;

        if (visibility === 'public') {
            this.visibilityIcon.textContent = 'public';
        } else {
            this.visibilityIcon.textContent = 'lock';
        }
    }

    /**
     * Load visibility from project API and update the pill
     * Called when a project is loaded to show the correct visibility state
     */
    async loadVisibilityFromProject() {
        const projectId = eXeLearning.app.project?.odeId;
        if (!projectId) {
            // No project loaded, use default from config
            const defaultVisibility = eXeLearning.app.params?.defaultProjectVisibility || 'private';
            this.updateVisibilityPill(defaultVisibility);
            return;
        }

        try {
            const response = await eXeLearning.app.api.getProject(projectId);
            // Response format: { responseMessage: 'OK', project: { visibility: '...' } }
            if (response?.responseMessage === 'OK' && response.project?.visibility) {
                this.updateVisibilityPill(response.project.visibility);
            }
        } catch (error) {
            console.warn('[ShareButton] Could not load project visibility:', error);
        }
    }

    /**
     * Get current document URL for sharing
     * Note: Uses 'project' query parameter to match server-side pages.ts route
     * @returns {string}
     */
    getCurrentDocumentUrl() {
        const url = new URL(window.location.href);
        const projectUuid =
            eXeLearning.app.project?.odeId ||
            eXeLearning.app.project?.requestedProjectId ||
            url.searchParams.get('project');

        if (projectUuid) {
            // Use 'project' param to match server-side route handling
            url.searchParams.set('project', projectUuid);
            // Clean up legacy parameters
            url.searchParams.delete('projectId');
            url.searchParams.delete('odeSessionId');
        }

        return url.toString();
    }
}
