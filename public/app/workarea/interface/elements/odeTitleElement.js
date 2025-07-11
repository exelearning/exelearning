export default class OdeTitleMenu {
    constructor() {
        this.odeTitleMenuHeadElement = document.querySelector(
            '#exe-title > .exe-title.content'
        );
    }

    /**
     * Init element
     *
     */
    init() {
        this.setTitle();
    }

    /**
     * Set title text to menu element
     *
     */
    setTitle() {
        let odeTitleProperty =
            eXeLearning.app.project.properties.properties.pp_title;
        let odeTitleText = odeTitleProperty.value
            ? odeTitleProperty.value
            : _('Untitled document');
        this.odeTitleMenuHeadElement.textContent = odeTitleText;
        this.odeTitleMenuHeadElement.setAttribute('title', odeTitleText);
    }
}
