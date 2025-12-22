// TODO delete this file when finish navbarStyles.js.
import Modal from '../modal.js';

export default class ModalStyleManager extends Modal {
    constructor(manager) {
        let id = 'modalStyleManager';
        let titleDefault;
        super(manager, id, titleDefault, false);
        // Modal body content element
        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        // Modal footer
        this.modalFooter = this.modalElement.querySelector('.modal-footer');
        // Modal buttons
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        // Modal alert element
        this.modalElementAlert = this.modalElementBody.querySelector(
            '.alert.alert-danger'
        );
        this.modalElementAlertText =
            this.modalElementBody.querySelector('.text');
        this.modalElementAlertCloseButton =
            this.modalElementAlert.querySelector('.close-alert');
        this.addBehaviourButtonCloseAlert();
        // Input readers
        this.readers = [];
    }

    /**
     * Show modal
     *
     * @param {*} themes
     */
    show(themes) {
        // Set title
        this.titleDefault = _('Styles');
        this.paramInstallThemes = JSON.parse(
            JSON.stringify(eXeLearning.app.api.parameters.canInstallThemes)
        );
        // Parameters of a theme that we will show in the information
        this.paramsInfo = JSON.parse(
            JSON.stringify(eXeLearning.app.api.parameters.themeInfoFieldsConfig)
        );
        // Parameters of a theme that we can edit
        this.paramsEdit = JSON.parse(
            JSON.stringify(
                eXeLearning.app.api.parameters.themeEditionFieldsConfig
            )
        );
        // Installed themes
        if (themes) this.themes = themes;
        this.themeSelectedPrevId = this.themes.manager.selected.id;
        this.themeSelectedId = this.themes.manager.selected.id;
        this.themesBase = this.getBaseThemes(this.themes.installed);
        this.themesUser = this.getUserThemes(this.themes.installed);
        this.themeEdition = false;
        let bodyContent = this.makeBodyElement();
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.setBodyElement(bodyContent);
            this.showButtonsConfirmCancel();
            this.setConfirmExec(async () => {
                await this.confirmExecEvent();
            });
            this.setCloseExec(() => {
                this.themes.manager.selectTheme(
                    this.themeSelectedPrevId,
                    false
                );
            });
            this.addBehaviourExeTabs();
            if (themes) this.modalElementAlert.classList.remove('show');
            this.modal.show();
            this.initCloseCheckInterval();
        }, time);
    }

    /**
     * Save event
     *
     */
    async confirmExecEvent() {
        if (this.themeEdition) {
            this.preventCloseModal = true;
            let formFieldsValues = this.getFormEditThemeValues();
            if (this.themeEdition.id) {
                // Edit theme files
                await this.editTheme(
                    this.themeEdition.dirName,
                    formFieldsValues
                );
                // Reload the theme if you have the edited theme selected
                if (this.themeEdition.id == this.themes.manager.selected.id) {
                    await this.themes.manager.selectTheme(
                        this.themeSelectedId,
                        true,
                        true
                    );
                }
            } else {
                // Create theme files
                await this.newTheme(formFieldsValues);
            }
            this.backExecEvent();
        } else {
            // Get change of theme to update current ode users theme too
            // Get selected page
            let nodeSelected =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour
                    .nodeSelected;
            let selectedPageId = nodeSelected.getAttribute('page-id');
            await this.themes.manager.selectTheme(this.themeSelectedId, true);
        }
    }

    /**
     *
     */
    getFormEditThemeValues() {
        var valueFields = { data: {} };
        let fields = this.modalElementBodyContent.querySelectorAll(
            '.theme-edit-value-field'
        );
        fields.forEach((field) => {
            let id = field.getAttribute('field');
            let value = field.value ? field.value : field.getAttribute('value');
            valueFields['data'][id] = value;
        });
        return valueFields;
    }

    /**
     *
     * @param {*} buttonText
     */
    setConfirmButtonText(buttonText) {
        this.confirmButton.innerHTML = buttonText;
    }

    /**
     *
     */
    hideConfirmButtonText() {
        this.confirmButton.style.display = 'none';
    }

    /**
     *
     */
    showConfirmButtonText() {
        this.confirmButton.style.display = 'flex';
    }

    /**
     *
     * @param {*} buttonText
     */
    setCancelButtonText(buttonText) {
        this.cancelButton.innerHTML = buttonText;
    }

    /**
     *
     */
    hideCancelButtonText() {
        this.cancelButton.style.display = 'none';
    }

    /**
     *
     */
    showCancelButtonText() {
        this.cancelButton.style.display = 'flex';
    }

    /**
     *
     */
    generateButtonBack() {
        this.buttonBack = document.createElement('button');
        this.buttonBack.classList.add('back');
        this.buttonBack.classList.add('btn');
        this.buttonBack.classList.add('btn-secondary');
        this.buttonBack.setAttribute('type', 'button');
        this.buttonBack.innerHTML = _('Back');
        // Add event
        this.buttonBack.addEventListener('click', (event) => {
            this.backExecEvent();
        });
        // Add button to modal
        this.modalFooter.append(this.buttonBack);

        return this.buttonBack;
    }

    /**
     *
     */
    removeButtonBack() {
        if (this.buttonBack) {
            this.buttonBack.remove();
        }
    }

    /**
     *
     */
    backExecEvent() {
        this.themeEdition = false;
        this.setBodyElement(this.makeBodyElement(this.themes));
        this.addBehaviourExeTabs();
        this.clickSelectedTab();
        this.showButtonsConfirmCancel();
    }

    /**
     *
     */
    showButtonsConfirmCancel() {
        this.removeButtonBack();
        this.showConfirmButtonText();
        this.showCancelButtonText();
    }

    /**
     *
     */
    clickSelectedTab() {
        if (this.tabSelectedLink) {
            this.modalElementBody
                .querySelector(`a[href="${this.tabSelectedLink}"]`)
                .click();
        }
    }

    /**
     * Show modal alert
     *
     * @param {*} text
     */
    showAlert(text) {
        this.modalElementAlert.innerHTML = text;
        this.modalElementAlert.classList.add('show');
    }

    /**
     * Set body element
     *
     * @param {*} bodyElement
     */
    setBodyElement(bodyElement) {
        this.modalElementBodyContent.innerHTML = '';
        this.modalElementBodyContent.append(bodyElement);
    }

    /*******************************************************************************
     * THEME LIST
     *******************************************************************************/

    /**
     * Get base themes from dict
     *
     * @param {*} themes
     */
    getBaseThemes(themes) {
        let baseThemes = {};
        for (let [key, value] of Object.entries(themes)) {
            if (value.type == eXeLearning.config.themeTypeBase) {
                baseThemes[key] = value;
            }
        }

        return baseThemes;
    }

    /**
     * Get user themes from dict
     *
     * @param {*} themes
     */
    getUserThemes(themes) {
        let userThemes = {};
        for (let [key, value] of Object.entries(themes)) {
            if (value.type == eXeLearning.config.themeTypeUser) {
                userThemes[key] = value;
            }
        }

        return userThemes;
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    /**
     * Generate body element
     *
     * @returns {Element}
     */
    makeBodyElement() {
        let bodyContainer = document.createElement('div');
        bodyContainer.classList.add('body-themes-container');
        // Head buttons
        bodyContainer.append(
            this.makeElementToButtons(this.paramInstallThemes)
        );
        // Themes list
        let themesListContainer = document.createElement('div');
        themesListContainer.classList.add('themes-list-container');
        bodyContainer.append(themesListContainer);
        // Tables
        let defaultThemesTabData = {
            title: _('Default styles'),
            id: 'base-themes-tab',
            active: true,
        };
        if (Object.keys(this.themesUser).length > 0) {
            // Generate tabs
            let userThemesTabData = {
                title: _('My styles'),
                id: 'user-themes-tab',
            };
            let tabs = [defaultThemesTabData, userThemesTabData];
            themesListContainer.append(this.makeThemesFormTabs(tabs));
            themesListContainer.append(
                this.makeElementTableThemes(
                    this.themesBase,
                    defaultThemesTabData
                )
            );
            themesListContainer.append(
                this.makeElementTableThemes(this.themesUser, userThemesTabData)
            );
        } else {
            // Only show base themes
            themesListContainer.append(
                this.makeElementTableThemes(
                    this.themesBase,
                    defaultThemesTabData
                )
            );
            themesListContainer.classList.add('no-tabs');
        }

        return bodyContainer;
    }

    /**
     * Generate button container
     *
     * @returns {Element}
     */
    makeElementToButtons(ithemes) {
        // Buttons container element
        let buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('themes-button-container');
        // Button new theme
        buttonsContainer.append(this.makeElementButtonNewTheme());
        // Button import style
        var importStyleButton = this.makeElementButtonImportTheme(ithemes);
        if (importStyleButton != false) {
            buttonsContainer.append(this.makeElementInputFileImportTheme());
            buttonsContainer.append(this.makeElementButtonImportTheme(ithemes));
        }

        return buttonsContainer;
    }

    /**
     * Generate new theme button
     *
     * @returns {Element}
     */
    makeElementButtonNewTheme() {
        let buttonNewTheme = document.createElement('button');
        buttonNewTheme.classList.add('themes-button-new');
        buttonNewTheme.classList.add('btn');
        buttonNewTheme.classList.add('btn-secondary');
        buttonNewTheme.innerHTML = _('New style');
        // Add event
        buttonNewTheme.addEventListener('click', (event) => {
            this.themeEdition = this.themes.newTheme({
                title: _('My new style'),
            });
            this.modalElementBodyContent.innerHTML = '';
            this.modalElementBodyContent.append(
                this.makeElementEditTheme(this.themeEdition)
            );
            this.addBehaviourExeTabs();
            this.modalElementBodyContent
                .querySelector('.exe-form-tabs li a')
                .click();
            this.focusTextInput(
                this.modalElementBodyContent.querySelector('input')
            );
            this.generateButtonBack();
            this.hideCancelButtonText();
        });

        return buttonNewTheme;
    }

    /**
     * Generate input file import
     *
     * @returns {Element}
     */
    makeElementInputFileImportTheme() {
        let inputFile = document.createElement('input');
        inputFile.setAttribute('type', 'file');
        inputFile.setAttribute('accept', '.zip');
        inputFile.classList.add('hidden');
        inputFile.classList.add('theme-file-import');
        // Add event
        inputFile.addEventListener('change', (event) => {
            Array.from(inputFile.files).forEach((theme) => {
                // Add new file reader
                this.addNewReader(theme);
            });
            inputFile.value = null;
        });

        return inputFile;
    }

    /**
     * Generate import button
     *
     * @returns
     */
    makeElementButtonImportTheme(ithemes) {
        if (
            eXeLearning.config.isOfflineInstallation == false &&
            eXeLearning.config.userStyles == false
        )
            return false;
        let buttonImportTheme = document.createElement('button');
        buttonImportTheme.classList.add('themes-button-import');
        buttonImportTheme.classList.add('btn');
        buttonImportTheme.classList.add('btn-secondary');
        if (!ithemes) {
            buttonImportTheme.disabled = true;
        }
        buttonImportTheme.innerHTML = _('Import style');
        // Add event
        buttonImportTheme.addEventListener('click', (event) => {
            this.modalElementBody
                .querySelector('input.theme-file-import')
                .click();
        });

        return buttonImportTheme;
    }

    /**
     *
     * @param {Array} tabs
     * @returns {Element}
     */
    makeThemesFormTabs(tabs) {
        let formTabs = document.createElement('ul');
        formTabs.classList.add('exe-form-tabs');
        tabs.forEach((data) => {
            let li = document.createElement('li');
            let link = document.createElement('a');
            link.setAttribute('href', `#${data.id}`);
            link.classList.add('exe-tab');
            if (data.active) link.classList.add('exe-form-active-tab');
            link.innerText = data.title;
            li.append(link);
            formTabs.append(li);
        });

        return formTabs;
    }

    /**
     * Make element table themes
     *
     * @param {*} themes
     * @param {*} dataTab
     * @returns {Element}
     */
    makeElementTableThemes(themes, dataTab) {
        // Table rows container
        let tableContainer = document.createElement('div');
        tableContainer.classList.add('themes-table-rows-container');
        tableContainer.classList.add('exe-form-content');
        if (dataTab.active)
            tableContainer.classList.add('exe-form-active-content');
        if (dataTab.id) tableContainer.id = dataTab.id;
        // Table rows element
        let table = document.createElement('table');
        tableContainer.append(table);
        table.classList.add('table');
        table.classList.add('themes-table');
        table.classList.add('table-striped');
        // Thead
        let tableThead = document.createElement('thead');
        let tableTheadRow = document.createElement('tr');
        tableThead.append(tableTheadRow);
        table.append(tableThead);
        let thDataList = [
            { title: _('Title') },
            { title: _('Actions'), colspan: 3 },
        ];
        thDataList.forEach((data) => {
            let th = document.createElement('th');
            th.setAttribute('scope', 'col');
            if (data.colspan) th.setAttribute('colspan', data.colspan);
            th.innerText = data.title;
            tableTheadRow.append(th);
        });
        // Rows
        let tableBody = document.createElement('tbody');
        table.append(tableBody);
        for (let [id, theme] of Object.entries(themes)) {
            let row = this.makeRowTableThemesElement(theme);
            tableBody.append(row);
        }

        return tableContainer;
    }

    /**
     *
     * @param {*} theme
     * @returns {Node}
     */
    makeRowTableThemesElement(theme) {
        // Row element
        let row = document.createElement('tr');
        // Attributes
        row.setAttribute('theme-id', theme.id);
        // Classes
        row.classList.add('theme-row');
        if (eXeLearning.app.themes.selected) {
            if (theme.id == eXeLearning.app.themes.selected.id) {
                row.classList.add('selected');
            }
        }
        // Title
        row.append(this.makeTitleThemeTd(theme));
        // Actions
        if (theme.type == 'user') row.append(this.makeActionEditThemeTd(theme));
        if (theme.type == 'user')
            row.append(this.makeActionRemoveThemeTd(theme));
        row.append(this.makeActionExportThemeTd(theme));
        row.append(this.makeActionInfoThemeTd(theme));

        return row;
    }

    /**
     *
     * @param {*} theme
     * @returns
     */
    makeTitleThemeTd(theme) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('theme-title');
        titleTd.innerHTML = theme.title;
        titleTd.addEventListener('click', (event) => {
            this.selectTheme(theme.id, false);
        });

        return titleTd;
    }

    /**
     *
     * @param {*} theme
     * @returns
     */
    makeActionEditThemeTd(theme) {
        let actionEditTd = document.createElement('td');
        actionEditTd.classList.add('exe-icon');
        actionEditTd.classList.add('theme-action');
        actionEditTd.classList.add('theme-action-edit');
        actionEditTd.title = _('Edit');
        actionEditTd.innerHTML = 'edit';
        // Click event
        actionEditTd.addEventListener('click', (event) => {
            this.themeEdition = theme;
            this.modalElementBodyContent.innerHTML = '';
            this.modalElementBodyContent.append(
                this.makeElementEditTheme(theme)
            );
            this.addBehaviourExeTabs();
            this.modalElementBodyContent
                .querySelector('.exe-form-tabs li a')
                .click();
            this.focusTextInput(
                this.modalElementBodyContent.querySelector('input')
            );
            this.generateButtonBack();
            this.hideCancelButtonText();
        });

        return actionEditTd;
    }

    /**
     *
     * @param {*} theme
     * @returns
     */
    makeActionRemoveThemeTd(theme) {
        let actionRemoveTd = document.createElement('td');
        actionRemoveTd.classList.add('exe-icon');
        actionRemoveTd.classList.add('theme-action');
        actionRemoveTd.classList.add('theme-action-remove');
        actionRemoveTd.title = _('Delete');
        actionRemoveTd.innerHTML = 'delete_forever';
        // Click event
        actionRemoveTd.addEventListener('click', (event) => {
            eXeLearning.app.modals.confirm.show({
                title: _('Delete style'),
                body: _(
                    `Are you sure you want to delete the style: ${theme.id}?`
                ),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => {
                    // Delete style dir
                    this.removeTheme(theme.id);
                },
            });
        });

        return actionRemoveTd;
    }

    /**
     *
     * @param {*} theme
     * @returns
     */
    makeActionExportThemeTd(theme) {
        let actionExportTd = document.createElement('td');
        actionExportTd.classList.add('exe-icon');
        actionExportTd.classList.add('theme-action');
        actionExportTd.classList.add('theme-action-export');
        actionExportTd.title = _('Download');
        actionExportTd.innerHTML = 'download';
        // Downloadable
        if (theme.downloadable) {
            actionExportTd.setAttribute('downloadable', true);
        } else {
            actionExportTd.setAttribute('downloadable', false);
        }
        // Click event
        actionExportTd.addEventListener('click', (event) => {
            this.downloadThemeZip(theme);
        });

        return actionExportTd;
    }

    /**
     *
     * @param {*} theme
     * @returns
     */
    makeActionInfoThemeTd(theme) {
        let actionInfoTd = document.createElement('td');
        actionInfoTd.classList.add('exe-icon');
        actionInfoTd.classList.add('theme-action');
        actionInfoTd.classList.add('theme-action-info');
        actionInfoTd.title = _('Info');
        actionInfoTd.innerHTML = 'info';
        // Click event
        actionInfoTd.addEventListener('click', (event) => {
            this.modalElementBodyContent.innerHTML = '';
            this.modalElementBodyContent.append(
                this.makeElementInfoTheme(theme)
            );
            this.generateButtonBack();
            this.hideConfirmButtonText();
            this.hideCancelButtonText();
        });

        return actionInfoTd;
    }

    /***************************************
     * TABLE INFO THEME
     **************************************/

    /**
     *
     * @param {*} theme
     * @returns {Node}
     */
    makeElementInfoTheme(theme) {
        // Container
        let infoThemeContainer = document.createElement('div');
        infoThemeContainer.classList.add('info-theme-container');
        // Head text
        let infoThemeText = document.createElement('p');
        infoThemeText.classList.add('theme-properties-title');
        infoThemeText.innerHTML = _('Style properties');
        infoThemeContainer.append(infoThemeText);
        // Table
        infoThemeContainer.append(this.makeElementInfoThemeTable(theme));

        return infoThemeContainer;
    }

    /**
     *
     * @param {*} theme
     */
    makeElementInfoThemeTable(theme) {
        let tableInfoTheme = document.createElement('table');
        tableInfoTheme.classList.add('info-theme-table');
        for (let [param, config] of Object.entries(this.paramsInfo)) {
            if (theme[param]) {
                tableInfoTheme.append(
                    this.makeElementInfoThemeTableRow(
                        param,
                        theme[param],
                        config
                    )
                );
            }
        }

        return tableInfoTheme;
    }

    /**
     *
     * @param {*} key
     * @param {*} value
     * @returns
     */
    makeElementInfoThemeTableRow(key, value, config) {
        let rowTableInfo = document.createElement('tr');
        rowTableInfo.classList.add('row-table-info-theme');
        rowTableInfo.append(this.makeElementInfoThemeTableRowKey(key, config));
        rowTableInfo.append(
            this.makeElementInfoThemeTableRowValue(value, config)
        );

        return rowTableInfo;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementInfoThemeTableRowKey(text, config) {
        let rowTdKeyTableInfo = document.createElement('td');
        rowTdKeyTableInfo.classList.add('theme-info-key');
        rowTdKeyTableInfo.innerHTML = `${config.title}`;

        return rowTdKeyTableInfo;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementInfoThemeTableRowValue(text, config) {
        let rowTdValueTableInfo = document.createElement('td');
        rowTdValueTableInfo.classList.add('theme-info-value');
        switch (config.tag) {
            case 'text':
                let input = document.createElement('input');
                input.classList.add('theme-info-value-text');
                input.setAttribute('type', 'text');
                input.setAttribute('disabled', 'disabled');
                input.setAttribute('value', text);
                rowTdValueTableInfo.append(input);
                break;
            case 'textarea':
                let textarea = document.createElement('textarea');
                textarea.classList.add('theme-info-value-text');
                textarea.setAttribute('disabled', 'disabled');
                textarea.innerHTML = text;
                rowTdValueTableInfo.append(textarea);
                break;
        }

        return rowTdValueTableInfo;
    }

    /***************************************
     * TABLE EDIT THEME
     **************************************/

    /**
     *
     * @param {*} theme
     * @returns {Node}
     */
    makeElementEditTheme(theme) {
        // Container
        let editThemeContainer = document.createElement('div');
        editThemeContainer.classList.add('edit-theme-container');
        // Head text
        let editThemeText = document.createElement('p');
        editThemeText.classList.add('theme-edit-title');
        editThemeText.innerHTML = _('Style') + ': ' + theme.title;
        editThemeContainer.append(editThemeText);
        // Table
        editThemeContainer.append(this.makeElementEditThemeTable(theme));

        return editThemeContainer;
    }

    /**
     *
     * @param {*} theme
     */
    makeElementEditThemeTable(theme) {
        let tableEditTheme = document.createElement('div');
        tableEditTheme.classList.add('edit-theme-table');
        // Tabs
        let tabsData = {};
        for (let [param, config] of Object.entries(this.paramsEdit)) {
            let id = config.category
                .replaceAll(/[^a-zA-Z ]/g, '')
                .replaceAll(' ', '')
                .toLowerCase();
            tabsData[id] = config.category;
            config.tabId = id;
        }
        let tabs = [];
        for (let [key, title] of Object.entries(tabsData)) {
            tabs.push({ id: key, title: title });
        }
        if (tabs.length > 0) tabs[0].active = true;
        let tableEditThemeTabs = this.makeThemesFormTabs(tabs);
        tableEditTheme.append(tableEditThemeTabs);
        // Form
        let tableEditThemeForm = document.createElement('div');
        tableEditThemeForm.classList.add('edit-theme-table-rows-container');
        tableEditThemeForm.classList.add('exe-form-content-rows');
        tableEditTheme.append(tableEditThemeForm);
        // Rows
        for (let [param, config] of Object.entries(this.paramsEdit)) {
            let value = theme[param] ? theme[param] : '';
            tableEditThemeForm.append(
                this.makeElementEditThemeTableRow(param, value, config)
            );
        }
        // Add event enter to inputs
        tableEditThemeForm.querySelectorAll('input').forEach((input) => {
            input.addEventListener('keyup', (event) => {
                event.preventDefault();
                if (event.key == 'Enter') {
                    this.confirm();
                }
            });
        });
        return tableEditTheme;
    }

    /**
     *
     * @param {*} key
     * @param {*} value
     * @returns
     */
    makeElementEditThemeTableRow(key, value, config) {
        let rowTableEdit = document.createElement('div');
        rowTableEdit.classList.add('row-table-edit-theme');
        rowTableEdit.classList.add('row-form-content');
        rowTableEdit.setAttribute('category', config.tabId);
        rowTableEdit.append(this.makeElementEditThemeTableRowKey(key, config));
        rowTableEdit.append(
            this.makeElementEditThemeTableRowValue(key, value, config)
        );

        return rowTableEdit;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementEditThemeTableRowKey(key, config) {
        let rowTdKeyTableEdit = document.createElement('label');
        rowTdKeyTableEdit.classList.add('theme-edit-key');
        rowTdKeyTableEdit.setAttribute(
            'for',
            `${this.themeEdition.id}-${key}-field`
        );
        rowTdKeyTableEdit.innerHTML = `${config.title}:`;

        return rowTdKeyTableEdit;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementEditThemeTableRowValue(key, value, config) {
        let element;
        switch (config.tag) {
            case 'textarea':
                element = this.makeElementEditThemeTextarea(value);
                break;
            case 'text':
                element = this.makeElementEditThemeText(value);
                break;
            case 'color':
                element = this.makeElementEditThemeColor(value);
                break;
            case 'img':
                element = this.makeElementEditThemeImg(value);
                break;
        }

        if (element) {
            if (config.tag == 'img') {
                let inputFile = element.querySelector('input');
                inputFile.id = `${this.themeEdition.id}-${key}-field`;
            } else {
                element.id = `${this.themeEdition.id}-${key}-field`;
            }
            element.classList.add('theme-edit-value-field');
            element.setAttribute('field', config.config);
        }

        return element;
    }

    /**
     *
     * @param {*} value
     * @returns
     */
    makeElementEditThemeTextarea(value) {
        let element = document.createElement('textarea');
        element.classList.add('theme-edit-value-text');
        element.innerHTML = value;

        return element;
    }

    /**
     *
     * @param {*} value
     * @returns
     */
    makeElementEditThemeText(value) {
        let element = document.createElement('input');
        element.classList.add('theme-edit-value-text');
        element.setAttribute('type', 'text');
        element.setAttribute('value', value);

        return element;
    }

    /**
     *
     * @param {*} value
     * @returns
     */
    makeElementEditThemeColor(value) {
        let element = document.createElement('input');
        element.setAttribute('type', 'color');
        element.setAttribute('value', value);

        return element;
    }

    /**
     *
     * @param {*} value
     * @returns
     */
    makeElementEditThemeImg(value) {
        // Container
        let element = document.createElement('div');
        element.classList.add('img-container');
        element.setAttribute('value', value);
        if (!value) element.classList.add('no-img');
        // - Image
        let imgElement = document.createElement('img');
        imgElement.classList.add('preview-img');
        if (value)
            imgElement.setAttribute(
                'src',
                `${eXeLearning.config.basePath}${value}?v=${Date.now()}`
            );
        // - Input
        let inputFileElement = document.createElement('input');
        inputFileElement.setAttribute('type', 'file');
        inputFileElement.setAttribute('accept', 'image/*');
        // - Button
        let inputButtonElement = document.createElement('input');
        inputButtonElement.setAttribute('type', 'button');
        inputButtonElement.setAttribute('value', _('Select image'));
        // - Remove
        let removeElement = document.createElement('div');
        removeElement.classList.add('exe-icon');
        removeElement.classList.add('remove-img');
        removeElement.innerHTML = 'close';
        // Events
        inputButtonElement.addEventListener('click', (e) => {
            inputFileElement.click();
        });
        inputFileElement.addEventListener('change', (e) => {
            let file = e.target.files.length > 0 ? e.target.files[0] : false;
            if (file) {
                this.readFile(file).then((data) => {
                    if (data) {
                        element.classList.remove('no-img');
                        element.setAttribute('value', data);
                        imgElement.setAttribute('src', data);
                    }
                });
            }
        });
        removeElement.addEventListener('click', (e) => {
            inputFileElement.value = '';
            element.classList.add('no-img');
            element.setAttribute('value', '');
            imgElement.setAttribute('src', '');
        });

        element.append(inputButtonElement);
        element.append(imgElement);
        element.append(removeElement);

        return element;
    }

    /***************************************
     * SHOW ERRORS
     **************************************/

    /**
     *
     */
    showElementAlert(txt, response) {
        let defErrorText = txt;
        let resErrorText = response && response.error ? response.error : '';
        let errorText = resErrorText
            ? `<p>${defErrorText}:</p><p>&nbsp;${resErrorText}</p>`
            : `<p>${defErrorText}</p>`;
        this.modalElementAlertText.innerHTML = errorText;
        this.modalElementAlert.classList.add('show');
    }

    /*******************************************************************************
     * EVENTS
     *******************************************************************************/

    /**
     * Add click event to close alert button
     *
     */
    addBehaviourButtonCloseAlert() {
        this.modalElementAlertCloseButton.addEventListener('click', (event) => {
            // Hide modal
            this.modalElementAlertText.innerHTML = '';
            this.modalElementAlert.classList.remove('show');
        });
    }

    /**
     * Select theme in style manager
     *
     * @param {*} id
     */
    async selectTheme(id, save) {
        await this.themes.manager.selectTheme(id, save);
        this.themeSelectedId = id;
        this.addClassSelectThemeRow(id);
    }

    /**
     * Add class selected to row
     *
     * @param {*} id
     */
    addClassSelectThemeRow(id) {
        this.modalElementBody
            .querySelectorAll('.themes-table .theme-row')
            .forEach((row) => {
                if (row.getAttribute('theme-id') == id) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            });
    }

    /**
     * Reader of upload theme input
     *
     * @param {*} file
     */
    addNewReader(file) {
        // New reader
        let reader = new FileReader();
        this.readers.push(reader);
        // Closure to capture the file information.
        reader.onload = (event) => {
            this.uploadTheme(file.name, event.target.result);
        };
        // Read in the image file as a data URL.
        reader.readAsDataURL(file);
    }

    /**
     * Focus input text element
     *
     * @param {*} input
     */
    focusTextInput(input) {
        if (input) {
            input.focus();
            let inputElementValue = input.value;
            input.value = '';
            input.value = inputElementValue;
        }
    }

    /**
     * Get file data
     *
     * @param {*} file
     * @returns
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (field) => {
                resolve(field.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /*******************************************************************************
     * API
     *******************************************************************************/

    /**
     * Upload/Import theme to app
     *
     */
    uploadTheme(fileName, fileData) {
        let params = {};
        params.filename = fileName;
        params.file = fileData;
        eXeLearning.app.api.postUploadTheme(params).then((response) => {
            if (response && response.responseMessage == 'OK') {
                // Load theme in client
                this.themes.loadTheme(response.theme);
                this.themes.orderThemesInstalled();
                this.themesBase = this.getBaseThemes(this.themes.installed);
                this.themesUser = this.getUserThemes(this.themes.installed);
                // Make body element themes table
                let bodyContent = this.makeBodyElement();
                this.setBodyElement(bodyContent);
                this.addBehaviourExeTabs();
            } else {
                // Show alert
                this.showElementAlert(
                    _('Failed to install the new style'),
                    response
                );
            }
        });
    }

    /**
     * New style
     *
     * @param {*} fields
     */
    async newTheme(fields) {
        let response = await eXeLearning.app.api.postNewTheme(fields);
        if (response && response.responseMessage == 'OK' && response.themes) {
            let promise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Load themes
                    this.themes.loadThemes(response.themes.themes);
                    // Get themes
                    this.themesBase = this.getBaseThemes(this.themes.installed);
                    this.themesUser = this.getUserThemes(this.themes.installed);
                    // Make body element themes table
                    let bodyContent = this.makeBodyElement();
                    this.setBodyElement(bodyContent);
                    this.addBehaviourExeTabs();
                    resolve(true);
                }, 1000);
            });
            return promise;
        } else {
            // Show alert
            this.showElementAlert(_('Failed to create the style'), response);
        }
    }

    /**
     * Edit theme
     *
     * @param {*} dirName
     * @param {*} fields
     */
    async editTheme(dirName, fields) {
        let response = await eXeLearning.app.api.putEditTheme(dirName, fields);
        if (response && response.responseMessage == 'OK' && response.themes) {
            let promise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Load themes
                    this.themes.loadThemes(response.themes.themes);
                    // Get themes
                    this.themesBase = this.getBaseThemes(this.themes.installed);
                    this.themesUser = this.getUserThemes(this.themes.installed);
                    // Make body element themes table
                    let bodyContent = this.makeBodyElement();
                    this.setBodyElement(bodyContent);
                    this.addBehaviourExeTabs();
                    resolve(true);
                }, 1000);
            });
            return promise;
        } else {
            // Show alert
            this.showElementAlert(_('Failed to edit the style '), response);
        }
    }

    /**
     * Delete style and load modal again
     *
     * @param {*} id
     */
    async removeTheme(id) {
        let params = {};
        params.id = id;
        let response = await eXeLearning.app.api.deleteTheme(params);
        if (
            response &&
            response.responseMessage == 'OK' &&
            response.deleted &&
            response.deleted.name
        ) {
            // Load themes in client
            this.themes.removeTheme(response.deleted.name);
            // Show modal
            setTimeout(() => {
                if (!this.modal._isShown) this.show(false);
            }, this.timeMax);
        } else {
            // Show modal
            setTimeout(() => {
                if (!this.modal._isShown) this.show(false);
                this.showElementAlert(_('Failed to remove style'), response);
            }, this.timeMax);
        }
    }

    /**
     * Download/Export theme
     *
     * @param {*} theme
     */
    downloadThemeZip(theme) {
        eXeLearning.app.api
            .getThemeZip(eXeLearning.app.project.odeSession, theme.dirName)
            .then((response) => {
                if (response && response.zipFileName && response.zipBase64) {
                    let link = document.createElement('a');
                    link.setAttribute('type', 'hidden');
                    link.href = 'data:text/plain;base64,' + response.zipBase64;
                    link.download = response.zipFileName;
                    link.click();
                    link.remove();
                }
            });
    }
}
