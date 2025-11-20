export default class SaveProjectButton {
    constructor() {
        this.saveMenuHeadButton = document.querySelector(
            '#head-top-save-button'
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
        this.saveMenuHeadButton.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            // Collaborative
            let exe = eXeLearning.app.project;
            if (exe.realTimeEventNotifier) {
                exe.realTimeEventNotifier.notify(exe.odeSession, {
                    name: 'save-menu-head-button',
                    payload: true,
                });
            }
            // Offline mode (Electron or browser): download ELP file
            // Online mode: save to database only
            if (eXeLearning.config.isOfflineInstallation) {
                eXeLearning.app.menus.navbar.file.downloadProjectEvent();
            } else {
                eXeLearning.app.project.save();
            }
        });
    }
}
