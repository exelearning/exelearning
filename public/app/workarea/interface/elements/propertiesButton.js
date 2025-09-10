export default class PropertiesProjectButton {
    constructor() {
        this.propertiesMenuHeadButton = document.querySelector(
            '#head-top-project-properties-button'
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
        this.propertiesMenuHeadButton.addEventListener('click', (event) => {
            eXeLearning.app.project.properties.showModalProperties();
        });
    }
}
