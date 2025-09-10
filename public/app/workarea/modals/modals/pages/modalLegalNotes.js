import Modal from '../modal.js';

export default class ModalLegalNotes extends Modal {
    constructor(manager) {
        let id = 'modalLegalNotes';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.addBehaviourExeTabs();
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('Legal notes');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            this.setTitle(this.titleDefault);
            //this.setBodyContent(this.generateBodyElement().innerHTML);
            this.modal.show();
        }, time);
    }

    /**
     * Set body-content html
     *
     * @param {*} html
     */
    setBodyContent(html) {
        this.modalElementBody.querySelector('.body-content').innerHTML = html;
    }

    /**
     * Generate exe-form body element
     *
     */
    generateBodyElement() {
        let maxTabs = 20;
        let poStringTemplateTab = 'workarea.help.legalnotes.tab.{i}.title.html';
        let poStringTemplateContent =
            'workarea.help.legalnotes.tab.{i}.content.html';
        let bodyContent = document.createElement('div');
        let tabsContainer = document.createElement('ul');
        tabsContainer.classList.add('exe-form-tabs');
        bodyContent.append(tabsContainer);
        for (let i = 1; i < maxTabs; i++) {
            let tabHtmlStringKey = poStringTemplateTab.replace('{i}', i);
            let contentStringKey = poStringTemplateContent.replace('{i}', i);
            if (
                !this.hasTranslation(tabHtmlStringKey) ||
                !this.hasTranslation(contentStringKey)
            ) {
                break;
            }
            tabsContainer.append(this.generateExeFormTab(tabHtmlStringKey, i));
            bodyContent.append(
                this.generateExeFormContent(contentStringKey, i)
            );
        }

        return bodyContent;
    }

    /**
     * Generate tab element
     *
     * @param {String} tabHtmlStringKey
     * @param {Number} i
     */
    generateExeFormTab(tabHtmlStringKey, i) {
        let tabHtmlValue = _(tabHtmlStringKey);
        let tab = document.createElement('li');
        let tabLink = document.createElement('a');
        tabLink.setAttribute('href', `#${this.id}-tab-${i}`);
        tabLink.classList.add('exe-tab');
        if (i == 1) tabLink.classList.add('exe-form-active-tab');
        tabLink.innerHTML = tabHtmlValue;
        tab.append(tabLink);
        return tab;
    }

    /**
     * Generate content element
     *
     * @param {String} tabHtmlStringKey
     * @param {Number} i
     */
    generateExeFormContent(contentStringKey, i) {
        let contentHtmlValue = _(contentStringKey);
        let content = document.createElement('div');
        content.id = `${this.id}-tab-${i}`;
        content.classList.add('exe-form-content');
        if (i == 1) content.classList.add('exe-form-active-content');
        content.innerHTML = contentHtmlValue;
        return content;
    }

    /**
     * Set contents (third party code information and licenses)
     *
     */
    async load() {
        // Third party code
        let contents = await eXeLearning.app.api.getThirdPartyCodeText();
        let viewer = this.modalElementBody.querySelector(
            '#modalLegalNotes .third-party-content'
        );
        viewer.innerHTML = eXeLearning.app.common.markdownToHTML(contents);
        // Licenses
        contents = await eXeLearning.app.api.getLicensesList();
        viewer = this.modalElementBody.querySelector(
            '#modalLegalNotes .licenses-list'
        );
        viewer.innerHTML = eXeLearning.app.common.markdownToHTML(contents);
        // Add some CSS classes to the titles
        $('#modalLegalNotes .md-converted-content h2').attr(
            'class',
            'lead mb-4'
        );
        $('#modalLegalNotes .md-converted-content a')
            .attr('title', _('New window'))
            .on('click', function () {
                window.open(this.href);
                return false;
            });
    }

    /**
     * Check if string has translation
     *
     * @param {String} string
     * @returns {Boolean}
     */
    hasTranslation(string) {
        return _(string) && _(string) != string;
    }
}
