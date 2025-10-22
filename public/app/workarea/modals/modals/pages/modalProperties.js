import Modal from '../modal.js';

export default class ModalProperties extends Modal {
    constructor(manager) {
        let id = 'modalProperties';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.confirmButtonDefaultText = _('Save');
        this.cancelButtonDefaultText = _('Cancel');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        this.node = null;
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('Preferences');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            this.node = data.node ? data.node : null;
            let title = data.title ? data.title : this.titleDefault;
            let contentId = data.contentId ? data.contentId : null;
            let properties = data.properties ? data.properties : {};
            let fullScreen = data.fullScreen ? data.fullScreen : null;
            this.setTitle(title);
            this.setContentId(contentId);
            this.setBodyElement(this.makeBodyElement(properties));
            this.setFullScreen(fullScreen);
            this.setConfirmExec(() => {
                this.saveAction();
            });
            this.modal.show();
            // Add modal default help behaviour
            this.addBehaviourExeHelp();
            // Add default behaviour to text inputs
            this.addBehaviourTextInputs();
            // Avoid configuration errors
            this.addBehaviourToggleOptions();
            // Focus first input text
            setTimeout(() => {
                this.focusTextInput(
                    this.modalElementBody.querySelector('input[type="text"')
                );
            }, this.timeMax);
        }, time);
    }

    /**
     *
     * @param {*} bodyElement
     */
    setBodyElement(bodyElement) {
        this.modalElementBody.innerHTML = '';
        this.modalElementBody.append(bodyElement);
        // Select first category
        let firstCategory = this.modalElementBody.querySelector(
            '.exe-form-tabs a.exe-tab'
        );
        if (firstCategory) firstCategory.click();
    }

    /**
     *
     * @param {*} fullScreen
     */
    setFullScreen(fullScreen) {
        this.modalElement.setAttribute('fullscreen', fullScreen);
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    /**
     * Generate body node element
     *
     * @param {*} properties
     * @returns {Node}
     */
    makeBodyElement(properties) {
        let element = document.createElement('div');
        element.classList.add('properties-body-container');
        // Categories tabs
        let categoriesElement = this.makeCategoriesTabs(properties);
        if (categoriesElement) {
            element.append(categoriesElement);
        }
        // Form content
        let formContentElement = document.createElement('div');
        formContentElement.classList.add('exe-properties-form-content');
        if (categoriesElement)
            formContentElement.classList.add('has-categories');
        element.append(formContentElement);
        // Properties table
        let propertiesTableElement = document.createElement('div');
        propertiesTableElement.classList.add('exe-table-content');
        // Add table to form
        formContentElement.append(propertiesTableElement);
        // Add groups to table
        this.addGroupsToTable(properties, propertiesTableElement);
        // Add rows to table
        this.addRowsToTable(properties, propertiesTableElement);

        return element;
    }

    /**
     *
     * @param {*} properties
     * @param {*} table
     */
    addGroupsToTable(properties, table) {
        let groups = this.makeGroupTree(properties);
        // Add groups to table
        for (let [id, data] of Object.entries(groups)) {
            // Create group element
            let groupElement = this.createGroupElement(id, data);
            // in case the group has a parent, we add the element to it
            if (data.parent) {
                let dictSearchParentGroup = {};
                dictSearchParentGroup[data.parent] = {};
                let parentGroupElement = this.getGroupElement(
                    dictSearchParentGroup,
                    table
                );
                if (parentGroupElement) {
                    parentGroupElement.append(groupElement);
                } else {
                    table.append(groupElement);
                }
            } else {
                table.append(groupElement);
            }
        }
    }

    /**
     *
     * @param {*} properties
     * @returns
     */
    makeGroupTree(properties) {
        let groups = {};
        for (let [id, property] of Object.entries(properties)) {
            if (property.hide) continue;
            // Add groups
            let groupParent = null;
            if (property.groups) {
                for (let [key, value] of Object.entries(property.groups)) {
                    if (!groups[key]) groups[key] = {};
                    groups[key].title = value;
                    groups[key].parent = groupParent;
                    groups[key].category = property.category;
                    if (property.required) groups[key].required = true;
                    groupParent = key;
                }
            }
        }
        return groups;
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    createGroupElement(id, data) {
        let groupElement = document.createElement('div');
        groupElement.id = id;
        groupElement.setAttribute('category', data.category);
        groupElement.classList.add('properties-group');
        if (data.required) groupElement.classList.add('required');
        // Toggle off by default
        if (!data.required) groupElement.classList.add('hide-content');
        // Title
        let groupElementTitle = document.createElement('h6');
        groupElementTitle.classList.add('properties-group-title');
        let titleText = data.title;
        if (data.required) titleText += ' *';
        groupElementTitle.innerHTML = titleText;
        groupElement.append(groupElementTitle);
        // Add event to group title
        groupElementTitle.addEventListener('click', (event) => {
            // Hide help texts
            this.hideHelpContentAll();
            // Show/Hide group properties
            if (groupElement.classList.contains('hide-content')) {
                groupElement.classList.remove('hide-content');
            } else {
                groupElement.classList.add('hide-content');
            }
        });
        return groupElement;
    }

    /**
     *
     * @param {*} properties
     * @param {*} table
     */
    addRowsToTable(properties, table) {
        for (let [key, property] of Object.entries(properties)) {
            if (property.hide) continue;
            // Group
            let groupElement = this.getGroupElement(property.groups, table);
            // Row
            let propertyRow = this.makeRowElement(
                key,
                property,
                groupElement,
                table
            );
            if (!propertyRow) continue;
            // If there is a group we put the row inside
            if (groupElement) {
                let groupChildren =
                    groupElement.querySelectorAll('.properties-group');
                if (groupChildren) {
                    var inserted = false;
                    groupChildren.forEach((groupChildrenElement) => {
                        if (
                            !groupChildrenElement.querySelector(
                                '.property-row'
                            ) &&
                            !inserted
                        ) {
                            groupElement.insertBefore(
                                propertyRow,
                                groupChildrenElement
                            );
                            inserted = true;
                        }
                    });
                    if (!inserted) {
                        groupElement.append(propertyRow);
                    }
                } else {
                    groupElement.append(propertyRow);
                }
                // Not group
            } else {
                if (table.querySelector('.properties-group')) {
                    table.prepend(propertyRow);
                } else {
                    table.append(propertyRow);
                }
            }
        }
    }

    /**
     *
     * @param {*} properties
     */
    makeCategoriesTabs(properties) {
        // Get categories
        let categories = this.getListCategories(properties);
        if (categories.length >= 2) {
            // Generate elements
            let categoriesElement = document.createElement('ul');
            categoriesElement.classList.add('exe-form-tabs');
            categories.forEach((category) => {
                let categoryElement = this.makeCategoryTabElement(category);
                categoriesElement.append(categoryElement);
            });
            return categoriesElement;
        }
        return false;
    }

    /**
     *
     * @param {String} categoryTitle
     * @returns {Node}
     */
    makeCategoryTabElement(categoryTitle) {
        let categoryElement = document.createElement('li');
        let categoryLink = document.createElement('a');
        categoryLink.setAttribute('href', '#');
        categoryLink.classList.add('exe-tab');
        categoryLink.classList.add('exe-advanced');
        categoryLink.innerHTML = categoryTitle;
        // Add event to tab
        categoryLink.addEventListener('click', (event) => {
            event.preventDefault();
            // Hide help texts
            this.hideHelpContentAll();
            // Remove tabs active class
            this.modalElementBody
                .querySelectorAll('a.exe-tab')
                .forEach((tab) => {
                    tab.classList.remove('exe-form-active-tab');
                });
            // Add active class to current tab
            categoryLink.classList.add('exe-form-active-tab');
            // Hide/show rows
            this.modalElementBody
                .querySelectorAll('.property-row')
                .forEach((row) => {
                    if (row.getAttribute('category') == categoryTitle) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                });
            // Hide show groups
            this.modalElementBody
                .querySelectorAll('.properties-group')
                .forEach((row) => {
                    if (row.getAttribute('category') == categoryTitle) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                });
        });
        categoryElement.append(categoryLink);

        return categoryElement;
    }

    /**
     *
     * @param {*} properties
     */
    getListCategories(properties) {
        let categories = [];
        for (let [key, property] of Object.entries(properties)) {
            if (property.hide) continue;
            if (!categories.includes(property.category)) {
                categories.push(property.category);
            }
        }
        return categories;
    }

    /**
     *
     * @param {*} groups
     * @returns {Node}
     */
    getGroupElement(groups, table) {
        if (groups) {
            let groupsArray = Object.entries(groups);
            let groupLast = groupsArray[groupsArray.length - 1];
            let groupId = groupLast[0];
            let groupElement = table.querySelector(`#${groupId}`);
            return groupElement;
        }
        return false;
    }

    /**
     *
     * @param {*} name
     * @param {*} property
     * @returns
     */
    makeRowElement(name, property) {
        property.id = name;
        let propertyIdGenerated =
            property.id + '-' + eXeLearning.app.common.generateId();
        let propertyRow = document.createElement('div');
        propertyRow.id = property.id;
        propertyRow.setAttribute('category', property.category);
        propertyRow.classList.add('property-row');
        let propertyTitle = this.makeRowElementLabel(
            propertyIdGenerated,
            property
        );
        let propertyValue = this.makeRowValueElement(
            propertyIdGenerated,
            property.id,
            property
        );
        let helpContainer = this.makeRowElementHelp(property);
        if (property.type === 'checkbox') {
            propertyRow.classList.add('is-toggle-row');
            propertyTitle.classList.add('toggle-label');

            const item = propertyValue;
            item.style.cursor = 'pointer';

            const toggleInput = item.querySelector('.toggle-input');
            item.addEventListener('click', (e) => {
                if (e.target !== toggleInput) {
                    e.preventDefault();
                    toggleInput.checked = !toggleInput.checked;
                    toggleInput.dispatchEvent(
                        new Event('change', { bubbles: true })
                    );
                }
            });
            propertyRow.append(propertyValue);
            propertyRow.append(propertyTitle);

            propertyTitle.style.cursor = 'pointer';
            propertyTitle.addEventListener('click', (e) => {
                e.preventDefault();
                toggleInput.checked = !toggleInput.checked;
                toggleInput.dispatchEvent(
                    new Event('change', { bubbles: true })
                );
            });
        } else {
            propertyRow.append(propertyTitle);
            propertyRow.append(propertyValue);
        }
        if (helpContainer) {
            propertyRow.append(helpContainer);
        }

        return propertyRow;
    }

    /**
     *
     * @param {*} id
     * @param {*} property
     * @returns
     */
    makeRowElementLabel(id, property) {
        let propertyTitle = document.createElement('label');
        let propertyTitleText = property.title;
        if (property.type != 'checkbox') {
            propertyTitleText += ':';
        }
        if (property.required) {
            propertyTitleText = '* ' + propertyTitleText;
        }
        propertyTitle.innerHTML = propertyTitleText;
        propertyTitle.setAttribute('for', id);

        return propertyTitle;
    }

    /**
     *
     * @param {*} data
     */
    makeRowValueElement(id, name, property) {
        let valueElement;
        switch (property.type) {
            case 'text':
                valueElement = document.createElement('input');
                valueElement.setAttribute('type', 'text');
                valueElement.value = property.value;
                break;
            case 'checkbox':
                const item = document.createElement('span');
                item.classList.add('toggle-item');

                const control = document.createElement('span');
                control.classList.add('toggle-control');

                const input = document.createElement('input');
                input.setAttribute('type', 'checkbox');
                input.id = id;
                input.setAttribute('name', id);
                input.setAttribute('property', name);
                input.setAttribute('data-type', 'checkbox');
                input.classList.add('property-value', 'toggle-input');
                input.checked = property.value == 'true' ? true : false;

                const visual = document.createElement('span');
                visual.classList.add('toggle-visual');
                visual.setAttribute('aria-hidden', 'true');

                control.append(input, visual);
                item.append(control);

                if (property.required) {
                    input.setAttribute('required', '');
                    input.classList.add('required');
                }

                input.addEventListener('focus', () => {
                    this.hideHelpContentAll();
                });

                valueElement = item;
                break;
            case 'date':
                valueElement = document.createElement('input');
                valueElement.setAttribute('type', 'date');
                valueElement.value = property.value;
                break;
            case 'textarea':
                valueElement = document.createElement('textarea');
                valueElement.innerHTML = property.value;
                valueElement.value = property.value;
                break;
            case 'select':
                valueElement = document.createElement('select');
                for (let [value, text] of Object.entries(property.options)) {
                    let optionElement = document.createElement('option');
                    optionElement.value = value;
                    optionElement.innerHTML = text;
                    if (value == property.value)
                        optionElement.setAttribute('selected', 'selected');
                    valueElement.append(optionElement);
                }
                break;
            default:
                valueElement = document.createElement('div');
                break;
        }

        // Value element id
        if (property.type !== 'checkbox') {
            // Value element id
            valueElement.id = id;
            // Value element attributes
            valueElement.setAttribute('name', id);
            valueElement.setAttribute('property', name);
            valueElement.setAttribute('data-type', property.type);
            // Value element class
            valueElement.classList.add('property-value');
            // Value element event click
            valueElement.addEventListener('focus', (event) => {
                // Hide help texts
                this.hideHelpContentAll();
            });
            // Required property
            if (property.required) {
                valueElement.setAttribute('required', '');
                valueElement.classList.add('required');
            }
        }
        return valueElement;
    }

    /**
     *
     * @param {*} property
     * @returns
     */
    makeRowElementHelp(property) {
        if (property.help) {
            let helpContainer = document.createElement('div');
            helpContainer.classList.add('exe-form-help');
            helpContainer.classList.add('help-content-disabled');
            let helpIcon = document.createElement('icon');
            helpIcon.innerHTML = 'contact_support';
            helpIcon.classList.add('form-help-exe-icon');
            helpIcon.classList.add('auto-icon');
            let helpSpanText = document.createElement('span');
            helpSpanText.classList.add('help-content');
            helpSpanText.classList.add('help-hidden');
            helpSpanText.innerHTML = property.help;
            helpContainer.append(helpIcon);
            helpContainer.append(helpSpanText);
            return helpContainer;
        } else {
            return false;
        }
    }

    /*******************************************************************************
     * SAVE
     *******************************************************************************/

    /**
     *
     *
     */
    saveAction() {
        let propertiesDict = this.getModalPropertiesData();
        // Get ode last save
        if (this.node.constructor.name === 'UserPreferences') {
            eXeLearning.app.interface.connectionTime.loadLasUpdatedInInterface();
        }

        // Save properties of node
        this.saveProperties(propertiesDict, false);
    }

    /**
     *
     *
     */
    getModalPropertiesData() {
        let propertiesDict = {};
        let propertiesElements =
            this.modalElementBody.querySelectorAll('.property-value');
        propertiesElements.forEach((property) => {
            let value;
            switch (property.getAttribute('data-type')) {
                case 'checkbox':
                    value = property.checked ? 'true' : 'false';
                    break;
                case 'select':
                    value = property.selectedOptions[0].value.trim();
                    break;
                case 'text':
                case 'date':
                case 'textarea':
                    value = property.value.trim();
                    break;
            }
            propertiesDict[property.getAttribute('property')] = value;
        });

        return propertiesDict;
    }

    /**
     *
     * @param {Array} propertiesDict
     * @param {Boolean} inherit
     */
    async saveProperties(propertiesDict, inherit) {
        let response = await this.node.apiSaveProperties(
            propertiesDict,
            inherit
        );
        return response;
    }

    /*******************************************************************************
     * BEHAVIOUR
     *******************************************************************************/

    /**
     * Add event keyup to all text inputs
     *
     */
    addBehaviourTextInputs() {
        // Press enter to confirm in text inputs
        if (this.confirmExec) {
            this.modalElementBody
                .querySelectorAll('input[type="text"]')
                .forEach((input) => {
                    input.addEventListener('keyup', (event) => {
                        event.preventDefault();
                        if (event.key == 'Enter') {
                            this.confirm();
                        }
                    });
                });
        }
    }

    /**
     * Avoid minimized iDevices with no toggling option
     *
     */
    addBehaviourToggleOptions() {
        $('#modalProperties #minimized input').on('change', function () {
            if (this.checked) {
                $('#modalProperties #allowToggle input').prop('checked', true);
            }
        });
        $('#modalProperties #allowToggle input').on('change', function () {
            if (!this.checked) {
                $('#modalProperties #minimized input').prop('checked', false);
            }
        });
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

    /*******************************************************************************
     * AUXILIAR
     *******************************************************************************/

    /**
     *
     * @param {*} referenceNode
     * @param {*} newNode
     */
    insertAfter(referenceNode, newNode) {
        referenceNode.parentNode.insertBefore(
            newNode,
            referenceNode.nextSibling
        );
    }
}
