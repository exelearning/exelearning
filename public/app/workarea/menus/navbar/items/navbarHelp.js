export default class NavbarFile {
    constructor(menu) {
        this.menu = menu;
        // Menu elements
        this.button = this.menu.navbar.querySelector('#dropdownHelp');
        this.assistantButton = this.menu.navbar.querySelector(
            '#navbar-button-assistant'
        );
        this.tutorialButton = this.menu.navbar.querySelector(
            '#navbar-button-exe-tutorial'
        );
        this.apiDocsButton = this.menu.navbar.querySelector(
            '#navbar-button-api-docs'
        );
        this.releaseNotesButton = this.menu.navbar.querySelector(
            '#navbar-button-release-notes'
        );
        this.legalNotesButton = this.menu.navbar.querySelector(
            '#navbar-button-legal-notes'
        );
        this.exeWebButton = this.menu.navbar.querySelector(
            '#navbar-button-exe-web'
        );
        this.reportBugButton = this.menu.navbar.querySelector(
            '#navbar-button-report-bug'
        );
        this.aboutButton = this.menu.navbar.querySelector(
            '#navbar-button-about-exe'
        );
    }

    /**
     * Set all events
     *
     */
    setEvents() {
        this.setAssistantEvent();
        this.setTutorialEvent();
        this.setApiDocsEvent();
        this.setReleaseNotesEvent();
        this.setLegalNotesEvent();
        this.setExeWebEvent();
        this.setReportBugEvent();
        this.setAboutExeEvent();
    }

    /**************************************************************************************
     * LISTENERS
     **************************************************************************************/

    /**
     * Assistant
     * Help -> Assistant
     *
     */
    setAssistantEvent() {
        this.assistantButton.addEventListener('click', () => {
            this.assistantEvent();
        });
    }

    /**
     * Tutorial
     * Help -> Tutorial
     *
     */
    setTutorialEvent() {
        this.tutorialButton.addEventListener('click', () => {
            this.tutorialEvent();
        });
    }

    /**
     * API Docs
     * Help -> API Docs (Swagger)
     */
    setApiDocsEvent() {
        this.apiDocsButton.addEventListener('click', () => {
            this.apiDocsEvent();
        });
    }

    /**
     * Release notes
     * Help -> Release notes
     *
     */
    setReleaseNotesEvent() {
        this.releaseNotesButton.addEventListener('click', () => {
            this.releaseNotesEvent();
        });
    }

    /**
     * Legal notes
     * Help -> Legal notes
     *
     */
    setLegalNotesEvent() {
        this.legalNotesButton.addEventListener('click', () => {
            this.legalNotesEvent();
        });
    }

    /**
     * eXe website
     * Help -> eXe website
     *
     */
    setExeWebEvent() {
        this.exeWebButton.addEventListener('click', () => {
            this.eXeWebEvent();
        });
    }

    /**
     * Report bug
     * Help -> Report bug
     *
     */
    setReportBugEvent() {
        this.reportBugButton.addEventListener('click', () => {
            this.reportBugEvent();
        });
    }

    /**
     * About eXe
     * Help -> About eXe
     *
     */
    setAboutExeEvent() {
        this.aboutButton.addEventListener('click', () => {
            this.aboutExeEvent();
        });
    }

    /**************************************************************************************
     * EVENTS
     **************************************************************************************/

    /**
     * Show assistant modal
     *
     */
    assistantEvent() {
        eXeLearning.app.modals.assistant.show();
    }

    /**
     * Open tutorial url in new tab
     *
     */
    tutorialEvent() {
        let url = 'https://exelearning.net/ayuda/';
        window.open(url, '_blank').focus();
    }

    /**
     * Open API Swagger docs in new tab
     */
    apiDocsEvent() {
        let url = '/api/docs'; // ruta de API docs
        window.open(url, '_blank').focus();
    }

    /**
     * Show release notes modal
     *
     */
    releaseNotesEvent() {
        eXeLearning.app.modals.releasenotes.show();
    }

    /**
     * Show legal notes modal
     *
     */
    legalNotesEvent() {
        eXeLearning.app.modals.legalnotes.show();
    }

    /**
     * Open report bug url in new tab
     *
     */
    eXeWebEvent() {
        let url = 'https://exelearning.net/';
        window.open(url, '_blank').focus();
    }

    /**
     * Open report bug url in new tab
     *
     */
    reportBugEvent() {
        let url = 'https://github.com/exelearning/exelearning/issues';
        window.open(url, '_blank').focus();
    }

    /**
     * Show About eXe modal
     *
     */
    aboutExeEvent() {
        eXeLearning.app.modals.about.show();
    }
}
