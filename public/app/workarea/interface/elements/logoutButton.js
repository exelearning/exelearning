export default class LogoutButton {
    constructor() {
        // Don't query the element here - it might not exist yet
        this.buttonSelector = '#head-bottom-logout-button';
    }

    /**
     * Init element
     *
     */
    init() {
        this.addEventClick();
    }

    /**
     * Add event click to button using event delegation
     * This works even if the button is added to the DOM later
     */
    addEventClick() {
        // Use event delegation on document to handle clicks
        document.addEventListener('click', (event) => {
            // Check if the clicked element matches our button selector
            if (event.target.closest(this.buttonSelector)) {
                event.preventDefault(); // Prevent default link behavior
                this.handleLogout();
            }
        });
    }

    /**
     * Handle logout click
     */
    handleLogout() {
        if (eXeLearning.config.isOfflineInstallation) {
            // Disable the beforeunload handler to prevent the confirmation dialog and close the main window
            window.onbeforeunload = null;
            window.close();
            return;
        }

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
                            let pathname = window.location.pathname.split('/');
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
     *
     */
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
