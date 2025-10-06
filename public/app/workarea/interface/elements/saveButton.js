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
            // Offline desktop: map Save to persistent ELP save
            if (
                eXeLearning.config.isOfflineInstallation &&
                window.electronAPI
            ) {
                eXeLearning.app.menus.navbar.file.downloadProjectEvent();
            } else {
                eXeLearning.app.project.save();
            }
        });
    }
}
