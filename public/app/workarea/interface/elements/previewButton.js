export default class PreviewButton {
    constructor() {
        this.previewMenuHeadButton = document.querySelector(
            '#head-bottom-preview'
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
        this.previewMenuHeadButton.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            eXeLearning.app.menus.navbar.utilities.previewEvent();
        });
    }
}
