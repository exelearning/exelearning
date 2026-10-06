import LoadingScreen from './loadingScreen.js';
import OdeTitleElement from './elements/odeTitleElement.js';
import ConcurrentUsers from './elements/concurrentUsers.js';
import ConnectionTime from './elements/connectionTime.js';
// import PropertiesProjectButton from "./elements/propertiesButton.js";
import SaveProjectButton from './elements/saveButton.js';
import ShareProjectButton from './elements/shareButton.js';
import DownloadProjectButton from './elements/downloadButton.js';
// import ModeButton from "./elements/modeButton.js";
import PreviewButton from './elements/previewButton.js';
import LogoutButton from './elements/logoutButton.js';
import FocusedEditMode from './focusedEditMode.js';

export default class InterfaceManager {
    constructor(app) {
        this.app = app;
        // Loading screen
        this.loadingScreen = new LoadingScreen();
        // Interfaz elements
        this.odeTitleElement = new OdeTitleElement();
        this.connectionTime = new ConnectionTime();
        this.concurrentUsers = new ConcurrentUsers(app);
        this.saveButton = new SaveProjectButton();
        this.shareButton = new ShareProjectButton();
        this.downloadButton = new DownloadProjectButton();
        // this.modeButton = new ModeButton();
        // this.propertiesButton = new PropertiesProjectButton();
        this.previewButton = new PreviewButton();
        this.logoutButton = new LogoutButton();
        // Experimental focused full-workarea iDevice edit mode (Refs #1811, #1411)
        this.focusedEditMode = new FocusedEditMode(app);
    }

    /**
     * Load interface elements
     *
     */
    async load() {
        this.odeTitleElement.init();
        this.connectionTime.init();
        if (!eXeLearning.app.project.offlineInstallation) {
            this.concurrentUsers.init();
        }
        this.saveButton.init();
        this.downloadButton.init();
        this.shareButton.init();
        // this.modeButton.init(); - hidden for now
        // this.propertiesButton; - hidden for now
        this.previewButton.init();
        this.logoutButton.init();
        this.focusedEditMode.init();
    }
}
