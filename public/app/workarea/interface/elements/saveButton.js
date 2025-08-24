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
            eXeLearning.app.project.save();
        });
    }
}
