export default class LogoutButton {
    constructor() {
        this.logoutMenuHeadButton = document.querySelector(
            '#head-bottom-logout-button'
        );
        this.exitMenuHeadButton = document.querySelector(
            '#head-bottom-exit-button'
        );
    }
    /**
     * Init element
     *
     */
    init() {
        this.addEventClick();
    }
    /**
     * Add event click to button
     *
     */
    addEventClick() {
        // Logout button handler (online mode only)
        if (this.logoutMenuHeadButton) {
            this.logoutMenuHeadButton.addEventListener('click', (event) => {
                this.handleLogout();
            });
        }

        // Exit button handler (Electron mode only)
        if (this.exitMenuHeadButton) {
            this.exitMenuHeadButton.addEventListener('click', (event) => {
                this.handleOfflineExit();
            });
        }
    }

    /**
     * Handle logout in online mode
     */
    handleLogout() {
        let odeSessionId = eXeLearning.app.project.odeSession;
        let odeVersionId = eXeLearning.app.project.odeVersion;
        let odeId = eXeLearning.app.project.odeId;
        let params = {
            odeSessionId: odeSessionId,
            odeVersionId: odeVersionId,
            odeId: odeId,
        };
        eXeLearning.app.api
            .postCheckCurrentOdeUsers(params)
            .then((response) => {
                if (response['leaveSession']) {
                    eXeLearning.app.api
                        .postCloseSession(params)
                        .then((response) => {
                            window.onbeforeunload = null;
                            let pathname =
                                window.location.pathname.split('/');
                            let basePathname = pathname
                                .splice(0, pathname.length - 1)
                                .join('/');
                            window.location.href =
                                window.location.origin +
                                basePathname +
                                '/logout';
                        });
                } else if (response['askSave']) {
                    eXeLearning.app.modals.sessionlogout.show();
                } else if (response['leaveEmptySession']) {
                    this.leaveEmptySession(params);
                }
            });
    }
    /**
     * Handle exit in offline mode (Electron)
     * Checks for unsaved changes and prompts user if needed
     */
    handleOfflineExit() {
        // Check for unsaved changes in Yjs architecture
        const yjsBridge = eXeLearning.app?.project?._yjsBridge;
        const hasUnsavedChanges =
            yjsBridge?.documentManager?.hasUnsavedChanges?.() ||
            yjsBridge?.documentManager?.isDirty ||
            false;

        if (hasUnsavedChanges) {
            // Show confirmation dialog with save option
            this.showOfflineExitConfirmation();
        } else {
            // No unsaved changes, close directly
            this.closeOfflineApp();
        }
    }

    /**
     * Show confirmation dialog for offline exit with unsaved changes
     */
    showOfflineExitConfirmation() {
        eXeLearning.app.modals.sessionlogout.show({
            title: _('Exit'),
            offlineExit: true,
        });
    }

    /**
     * Save project and close app in offline mode
     */
    async saveAndCloseOffline() {
        try {
            // Use Yjs export for saving
            if (
                eXeLearning.app.project?._yjsEnabled &&
                eXeLearning.app.project?.exportToElpxViaYjs
            ) {
                await eXeLearning.app.project.exportToElpxViaYjs({
                    saveAs: false,
                });
            }
            this.closeOfflineApp();
        } catch (error) {
            console.error('[LogoutButton] Error saving before exit:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Error saving'),
                body: _('An error occurred while saving the project'),
                contentId: 'error',
            });
        }
    }

    /**
     * Close the offline app (Electron window)
     */
    closeOfflineApp() {
        window.onbeforeunload = null;
        window.close();
    }

    leaveEmptySession(params) {
        eXeLearning.app.modals.confirm.show({
            title: _('Empty session'),
            contentId: 'empty-session',
            body: _('Do you want to logout anyway?'),
            confirmButtonText: _('Logout'),
            cancelButtonText: _('Cancel'),
            focusFirstInputText: true,
            confirmExec: () => {
                eXeLearning.app.api
                    .postCloseSession(params)
                    .then((response) => {
                        window.onbeforeunload = null;
                        let pathname = window.location.pathname.split('/');
                        let basePathname = pathname
                            .splice(0, pathname.length - 1)
                            .join('/');
                        window.location.href =
                            window.location.origin + basePathname + '/logout';
                    });
            },
        });
    }
}
