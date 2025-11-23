export default class DownloadProjectButton {
    constructor() {
        this.downloadMenuHeadButton = document.querySelector(
            '#head-top-download-button'
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
        this.downloadMenuHeadButton.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            eXeLearning.app.menus.navbar.file.downloadProjectEvent();
        });
    }
}
