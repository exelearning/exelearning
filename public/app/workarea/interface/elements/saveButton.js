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
        this.saveMenuHeadButton.addEventListener('click', async (event) => {
            // Check if an iDevice is open, but without saving the package properties
            if (await eXeLearning.app.project.checkOpenIdevice(true)) return;

            // Collaborative mode synchronization
            let exe = eXeLearning.app.project;
            if (exe.realTimeEventNotifier) {
                exe.realTimeEventNotifier.notify(exe.odeSession, {
                    name: 'save-menu-head-button',
                    payload: true,
                });
            }

            // Check if the Properties form is visible and save the package properties if needed
            const propertiesForm = document.querySelector(
                '#node-content[node-selected="root"]'
            );
            const isVisible =
                propertiesForm && propertiesForm.offsetParent !== null;

            if (isVisible) {
                // Wait until project properties are fully saved
                const ok =
                    await eXeLearning.app.project.properties.formProperties.saveAction();

                if (!ok) return; // Required fields missing → stop here
            }

            // Execute final action after saveAction is completed
            if (eXeLearning.config.isOfflineInstallation) {
                eXeLearning.app.menus.navbar.file.downloadProjectEvent();
            } else {
                eXeLearning.app.project.save();
            }
        });
    }
}
