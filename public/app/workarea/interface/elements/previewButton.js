import PreviewPanelManager from './previewPanel.js';

export default class PreviewButton {
    constructor() {
        this.previewMenuHeadButton = document.querySelector(
            '#head-bottom-preview'
        );
        this.previewPanel = new PreviewPanelManager();
    }

    /**
     * Init element
     */
    init() {
        this.previewPanel.init();
        this.addEventClick();
    }

    /**
     * Add event click to button
     */
    addEventClick() {
        this.previewMenuHeadButton.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;

            // Use the new panel-based preview
            this.previewPanel.toggle();
        });
    }

    /**
     * Get the preview panel manager instance
     * @returns {PreviewPanelManager}
     */
    getPanel() {
        return this.previewPanel;
    }
}
