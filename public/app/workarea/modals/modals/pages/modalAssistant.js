import Modal from '../modal.js';

export default class ModalAssistant extends Modal {
    constructor(manager) {
        let id = 'modalAssistant';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.addBehaviourExeTabs();
        this.addBehaviourShowTabsButton();
    }

    /**
     * Show modal
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('Assistant');
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
        let poStringTemplateTab = 'workarea.help.assistant.tab.{i}.title.html';
        let poStringTemplateContent =
            'workarea.help.assistant.tab.{i}.content.html';
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
        tabLink.innerHTML = `${i}. ${tabHtmlValue}`;
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
     * Check if string has translation
     *
     * @param {String} string
     * @returns {Boolean}
     */
    hasTranslation(string) {
        return _(string) && _(string) != string;
    }

    /**
     * Add event click to show tabs button
     *
     */
    addBehaviourShowTabsButton() {
        this.modalElementBody
            .querySelector('icon.show-tabs')
            .addEventListener('click', (event) => {
                event.preventDefault();
                let bodyContent =
                    this.modalElementBody.querySelector('.body-content');
                if (bodyContent) {
                    if (bodyContent.classList.contains('show-tabs')) {
                        bodyContent.classList.remove('show-tabs');
                    } else {
                        bodyContent.classList.add('show-tabs');
                    }
                }
            });
    }
}
