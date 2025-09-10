export default class FormProperties {
    constructor(properties) {
        this.properties = properties;
        this.metadataProperties = {};
        this.categories = [];
        this.categoryView = null;
        this.confirmButtonDefaultText = _('Save');
        this.cancelButtonDefaultText = _('Cancel');
        this.propertiesCategoryKey = 'properties';
        this.cataloguingCategoryKey = 'cataloguing';
        this.nodeContent = document.querySelector(
            '#main #workarea #node-content'
        );
        // Add behaviour to body to hide helps dialogs
        this.addBehaviourBodyToHideHelpDialogs();
    }

    /**
     *
     * @param {*} data
     */
    show() {
        this.combineMetadataProperties();
        let formElement = this.makeBodyElement(this.metadataProperties);
        this.setBodyElement(formElement);
        // Add behaviour to save button
        this.addBehaviourSaveButton();
        // Add default help behaviour
        this.addBehaviourExeHelp();
        // Add behaviour to text inputs
        this.addBehaviourTextInputs();
        // Focus first input text
        setTimeout(() => {
            this.focusTextInput(
                this.nodeContent.querySelector('input[type="text"')
            );
        }, 500);
    }

    /**
     * Combine properties and cataloguing metadata
     *
     * @returns
     */
    combineMetadataProperties() {
        // All metadata: properties and cataloguing
        this.metadataProperties = {};
        this.metadataPropertiesBase = Object.assign(
            {},
            this.properties.properties,
            this.properties.cataloguing
        );
        // Check advanced mode
        if (
            eXeLearning.app.user.preferences.preferences.advancedMode.value ==
            'true'
        ) {
            // - Get all properties
            this.metadataProperties = this.metadataPropertiesBase;
        } else {
            // - Get "always-visible" properties
            for (let [key, property] of Object.entries(
                this.metadataPropertiesBase
            )) {
                if (property.alwaysVisible)
                    this.metadataProperties[key] = property;
            }
        }
        return this.metadataProperties;
    }

    /**
     *
     * @param {*} bodyElement
     */
    setBodyElement(bodyElement) {
        this.propertiesFormElement = this.nodeContent.querySelector(
            '#properties-node-content-form'
        );
        if (this.propertiesFormElement) {
            this.propertiesFormElement.innerHTML = bodyElement.innerHTML;
        } else {
            this.propertiesFormElement = bodyElement;
            this.nodeContent.append(this.propertiesFormElement);
        }
        // Select first category
        let firstCategory = this.nodeContent.querySelector(
            '.exe-form-tabs a.exe-tab'
        );
        if (firstCategory) firstCategory.click();
    }

    /**
     *
     */
    remove() {
        if (this.propertiesFormElement) {
            this.propertiesFormElement.remove();
        }
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
        element.id = 'properties-node-content-form';
        element.classList.add('properties-body-container');
        element.classList.add('form-properties');
        element.classList.add('loading');
        // Categories tabs
        let categoriesElement = this.makeCategoriesTabs(properties);
        if (categoriesElement) {
            element.classList.add('categories');
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
        // Add form buttons
        let saveButton = this.makeSaveButton();
        formContentElement.append(saveButton);
        // Remove class Loading
        setTimeout(() => {
            element.classList.remove('loading');
        }, 100);

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
                    groups[key].category = Object.keys(property.category)[0];
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
        if (id != 'properties_package' && !data.required)
            groupElement.classList.add('hide-content');
        // Title
        let groupElementTitle = document.createElement('h6');
        groupElementTitle.classList.add('properties-group-title');
        let titleText = "<span class='title-text'>" + data.title + '</span>';
        if (data.category == this.cataloguingCategoryKey) {
            if (data.required) {
                titleText +=
                    " - <span class='required-text'>(" +
                    _('Required') +
                    ')</span>';
                titleText = '* ' + titleText;
            } else {
                titleText +=
                    " - <span class='optional-text'>(" +
                    _('Optional') +
                    ')</span>';
            }
        }
        groupElementTitle.innerHTML =
            "<span class='title'>" + titleText + '</span>';
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
        // Sort multiple properties
        let propertiesArray = Object.entries(properties);
        propertiesArray = propertiesArray.sort((a, b) => {
            if (
                a[1].multipleId &&
                b[1].multipleId &&
                a[1].multipleId == b[1].multipleId
            ) {
                if (a[1].multipleIndex == b[1].multipleIndex) return 0;
                if (a[1].multipleIndex > b[1].multipleIndex) return 1;
                if (a[1].multipleIndex < b[1].multipleIndex) return -1;
            } else if (
                a[1].multipleId &&
                b[1].multipleId &&
                a[1].prefix == b[1].prefix
            ) {
                if (a[1].multipleIndex == b[1].multipleIndex) {
                    if (a[1].index == b[1].index) return 0;
                    if (a[1].index > b[1].index) return 1;
                    if (a[1].index < b[1].index) return -1;
                } else {
                    if (a[1].multipleIndex == b[1].multipleIndex) return 0;
                    if (a[1].multipleIndex > b[1].multipleIndex) return 1;
                    if (a[1].multipleIndex < b[1].multipleIndex) return -1;
                }
            } else {
                return 0;
            }
        });
        // Add a row for each property
        for (let [key, property] of propertiesArray) {
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
            } else {
                // Not group
                if (table.querySelector('.properties-group')) {
                    table.prepend(propertyRow);
                } else {
                    table.append(propertyRow);
                }
            }
        }
    }

    /**
     * Reload form values
     *
     */
    reloadValues() {
        this.combineMetadataProperties();
        for (let [key, property] of Object.entries(this.metadataProperties)) {
            let element;
            if (property.multipleId) {
                let elementsMultiples = this.nodeContent.querySelectorAll(
                    `.property-value[property="${property.multipleId}"]`
                );
                element = elementsMultiples[property.multipleIndex - 1];
            } else {
                element = this.nodeContent.querySelector(
                    `.property-value[property="${key}"]`
                );
            }
            if (!element) continue;
            switch (property.type) {
                case 'checkbox':
                    element.checked = property.value == 'true' ? true : false;
                    break;
                case 'select':
                    let select = element.querySelector(
                        `option[value="${property.value}"]`
                    );
                    if (select) select.setAttribute('selected', 'selected');
                    break;
                case 'text':
                case 'date':
                case 'textarea':
                default:
                    element.value = property.value;
                    break;
            }
        }
    }

    /**
     *
     */
    makeSaveButton() {
        let footer = document.createElement('div');
        footer.classList.add('footer');
        let buttonSave = document.createElement('button');
        buttonSave.setAttribute('type', 'button');
        buttonSave.classList.add('confirm');
        buttonSave.classList.add('btn');
        buttonSave.classList.add('btn-primary');
        buttonSave.classList.add('mt-3');
        buttonSave.innerHTML = _('Save metadata and properties');
        footer.append(buttonSave);

        return footer;
    }

    /**
     *
     * @param {*} properties
     */
    makeCategoriesTabs(properties) {
        // Get categories
        this.categories = this.getListCategories(properties);
        if (this.categories.length >= 2) {
            // Generate elements
            let categoriesElement = document.createElement('ul');
            categoriesElement.classList.add('exe-form-tabs');
            this.categories.forEach((categoryPar) => {
                let categoryElement = this.makeCategoryTabElement(
                    categoryPar[0],
                    categoryPar[1]
                );
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
    makeCategoryTabElement(key, categoryTitle) {
        let categoryElement = document.createElement('li');
        categoryElement.setAttribute('category-id', key);
        let categoryLink = document.createElement('a');
        categoryLink.setAttribute('category-id', key);
        categoryLink.setAttribute('href', '#');
        categoryLink.classList.add('exe-tab');
        categoryLink.innerHTML = categoryTitle;
        // Add event to tab
        categoryLink.addEventListener('click', (event) => {
            event.preventDefault();
            // Set category
            this.categoryView = key;
            // Hide help texts
            this.hideHelpContentAll();
            // Remove tabs active class
            this.nodeContent.querySelectorAll('a.exe-tab').forEach((tab) => {
                tab.classList.remove('exe-form-active-tab');
            });
            // Add active class to current tab
            categoryLink.classList.add('exe-form-active-tab');
            // Hide/show rows
            this.nodeContent
                .querySelectorAll('.property-row')
                .forEach((row) => {
                    if (row.getAttribute('category') == key) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                });
            // Hide show groups
            this.nodeContent
                .querySelectorAll('.properties-group')
                .forEach((row) => {
                    if (row.getAttribute('category') == key) {
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
        let categories = {};
        let categoriesKeys = [];
        for (let [key, property] of Object.entries(properties)) {
            let propertyCategoryKey = Object.keys(property.category)[0];
            let propertyCategoryValue = Object.values(property.category)[0];
            if (!categoriesKeys.includes(propertyCategoryKey)) {
                categoriesKeys.push(propertyCategoryKey);
                categories[propertyCategoryKey] = propertyCategoryValue;
            }
        }
        let categoriesList = Object.entries(categories);
        categoriesList.sort((a, b) => {
            return a[0] == this.propertiesCategoryKey ? -1 : 1;
        });

        return categoriesList;
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
     * @param {*} groupElement
     * @returns
     */
    makeRowElement(name, property, groupElement, tableElement) {
        // Id
        property.id = name;
        let propertyId = property.multipleId
            ? property.multipleId
            : property.id;
        let propertyIdGenerated =
            propertyId + '-' + eXeLearning.app.common.generateId();
        // Property row
        let propertyRow = document.createElement('div');
        propertyRow.id = propertyIdGenerated + '-container';
        propertyRow.classList.add('property-row');
        propertyRow.setAttribute('property', property.id);
        propertyRow.setAttribute('type', property.type);
        propertyRow.setAttribute('category', Object.keys(property.category)[0]);
        propertyRow.setAttribute('group', groupElement.id);
        propertyRow.setAttribute(
            'duplicate',
            property.duplicate ? property.duplicate : false
        );
        // Multiple property classes
        if (property.multipleId) {
            propertyRow.classList.add('copied-row');
            let lastRowElement = groupElement.querySelector(
                '.property-row:last-child'
            );
            if (lastRowElement) {
                if (
                    !lastRowElement.classList.contains('copied-row') ||
                    (lastRowElement.classList.contains('copied-row') &&
                        propertyRow.getAttribute('duplicate') >= 1)
                ) {
                    propertyRow.classList.add('first-copied-row');
                }
            }
        }
        // Label property
        let propertyTitle = this.makeRowElementLabel(
            propertyIdGenerated,
            property
        );
        if (property.multipleId) propertyTitle.classList.add('copied');
        // Value property
        let propertyValue = this.makeRowValueElement(
            propertyIdGenerated,
            propertyId,
            property
        );
        if (property.multipleId) propertyValue.classList.add('copied');
        // Help
        let helpContainer = this.makeRowElementHelp(property);
        // Actions add/delete
        let actionsContainer = this.makeRowActionsElement(
            property,
            propertyRow
        );
        if (actionsContainer && property.multipleId)
            actionsContainer.setAttribute('original', false);
        // Add elements to row
        // - Title and value
        if (property.type == 'checkbox') {
            propertyRow.append(propertyValue);
            propertyRow.append(propertyTitle);
        } else {
            propertyRow.append(propertyTitle);
            propertyRow.append(propertyValue);
        }
        // - Help element
        if (helpContainer) {
            propertyRow.append(helpContainer);
        }
        // - Actions element
        if (actionsContainer) {
            propertyRow.append(actionsContainer);
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
        if (property.type != 'checkbox') propertyTitleText += ':';
        if (property.required) propertyTitleText = '* ' + propertyTitleText;
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
                valueElement.value = property.value;
                break;
            case 'checkbox':
                valueElement = document.createElement('input');
                valueElement.checked = property.value == 'true' ? true : false;
                break;
            case 'date':
                valueElement = document.createElement('input');
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
        // Add attributes to element
        valueElement = this.addAttributesRowValueElement(
            id,
            name,
            property,
            valueElement
        );

        return valueElement;
    }

    /**
     *
     * @param {*} id
     * @param {*} name
     * @param {*} property
     * @param {*} valueElement
     */
    addAttributesRowValueElement(id, name, property, valueElement) {
        // Value element id
        valueElement.id = id;
        // Value element attributes
        valueElement.setAttribute('name', id);
        valueElement.setAttribute('property', name);
        valueElement.setAttribute('type', property.type);
        valueElement.setAttribute(
            'category',
            property.category ? Object.keys(property.category)[0] : ''
        );
        valueElement.setAttribute(
            'group',
            property.groups ? Object.keys(property.groups).pop() : ''
        );
        valueElement.setAttribute('data-type', property.type);
        // Value element class
        valueElement.classList.add('property-value');
        // Value element event click
        valueElement.addEventListener('focus', (event) => {
            // Hide help texts
            this.hideHelpContentAll();
        });
        // required property
        if (property.required) {
            valueElement.setAttribute('required', '');
            valueElement.classList.add('required');
        }
        // readonly property
        if (property.readonly) {
            valueElement.setAttribute('readonly', '');
        }
        // onchange
        if (property.onchange) {
            valueElement.addEventListener('change', () => {
                let value;
                switch (property.type) {
                    case 'select':
                        value =
                            valueElement.selectedOptions[0].innerHTML.trim();
                        break;
                    default:
                        value = valueElement.value.trim();
                        break;
                }
                this.propertiesFormElement.querySelector(
                    `#${property.onchange} input`
                ).value = value;
            });
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

    /**
     *
     * @param {*} property
     * @param {*} row
     * @returns
     */
    makeRowActionsElement(property, row) {
        let actionsContainer = false;
        if (property.duplicate) {
            // Actions container
            actionsContainer = document.createElement('div');
            actionsContainer.classList.add(
                'actions-duplicate-properties-container'
            );
            actionsContainer.setAttribute('duplicate', property.duplicate);
            actionsContainer.setAttribute('original', 'true');
            // Action add
            let actionAdd = document.createElement('div');
            actionAdd.classList.add('exe-icon');
            actionAdd.classList.add('add-properties');
            actionAdd.setAttribute('duplicate', property.duplicate);
            actionAdd.innerHTML = 'add_circle_outline';
            this.addEventClickToActionAddButton(
                actionAdd,
                property.duplicate,
                property,
                row
            );
            actionsContainer.append(actionAdd);
            // Action delete
            let actionDelete = document.createElement('div');
            actionDelete.classList.add('exe-icon');
            actionDelete.classList.add('delete-properties');
            actionDelete.setAttribute('duplicate', property.duplicate);
            actionDelete.innerHTML = 'remove_circle_outline';
            this.addEventClickToActionDeleteButton(
                actionDelete,
                property.duplicate,
                property,
                row
            );
            actionsContainer.append(actionDelete);
        }
        return actionsContainer;
    }

    /**
     *
     * @param {*} button
     * @param {*} duplicate
     * @param {*} property
     * @param {*} row
     */
    addEventClickToActionAddButton(button, duplicate, property, row) {
        button.addEventListener('click', (event) => {
            // Clone rows elements
            let rowsToDuplicate = [];
            let nextRow = row.classList.contains('properties-group')
                ? row.children[1]
                : row;
            for (let i = 0; i < duplicate; i++) {
                if (nextRow) {
                    let cloneRow = this.cloneRowElement(nextRow, property, i);
                    rowsToDuplicate.push(cloneRow);
                    if (i < duplicate - 1) nextRow = nextRow.nextElementSibling;
                }
            }
            // Add rows to container
            rowsToDuplicate.reverse().forEach((cloneRowElement) => {
                this.insertAfter(nextRow, cloneRowElement);
                // Check visibility of action buttons
                cloneRowElement
                    .querySelectorAll('.actions-duplicate-properties-container')
                    .forEach((actionsContainer) => {
                        let prevElement =
                            actionsContainer.parentNode.previousSibling;
                        if (actionsContainer && prevElement) {
                            let showRemoveButton =
                                prevElement.classList.contains(
                                    'property-row'
                                ) ||
                                cloneRowElement.classList.contains(
                                    'first-copied-row'
                                );
                            actionsContainer.setAttribute(
                                'original',
                                !showRemoveButton
                            );
                        }
                    });
            });
        });
    }

    /**
     *
     * @param {*} button
     * @param {*} duplicate
     * @param {*} property
     * @param {*} row
     */
    addEventClickToActionDeleteButton(button, duplicate, property, row) {
        button.addEventListener('click', (event) => {
            let container = row.classList.contains('properties-group')
                ? row
                : row.parentNode;
            let propertyId = row
                .querySelector('.property-value')
                .getAttribute('property');
            let isOriginal =
                button.parentNode.getAttribute('original') == 'true';
            let propertiesRows = container.querySelectorAll(
                `.property-value[property="${propertyId}"]`
            );
            let nPropertiesRows = propertiesRows ? propertiesRows.length : 0;
            if (nPropertiesRows > 1 && !isOriginal) {
                let rowsToDelete = [];
                let nextRow = row.classList.contains('properties-group')
                    ? row.children[1]
                    : row;
                for (let i = 0; i < duplicate; i++) {
                    // todo: check in multiple chained properties
                    if (
                        nextRow &&
                        nextRow != row &&
                        nextRow.classList.contains('first-copied-row')
                    )
                        break;
                    rowsToDelete.push(nextRow);
                    if (i < duplicate - 1) {
                        nextRow = nextRow.nextElementSibling
                            ? nextRow.nextElementSibling
                            : false;
                    }
                }
                rowsToDelete.forEach((rowElement) => {
                    if (rowElement) rowElement.remove();
                });
            }
        });
    }

    /**
     *
     * @param {*} row
     * @param {*} property
     * @param {*} num
     * @returns
     */
    cloneRowElement(row, propertyBase, num) {
        // Row
        let cloneRow = row.cloneNode(true);
        // In case it is a group we go through the rows recursively
        if (cloneRow.classList.contains('properties-group')) {
            cloneRow.id = `${cloneRow.id.split('-')[0]}-${eXeLearning.app.common.generateId()}`;
            for (let child of cloneRow.children) {
                if (child.classList.contains('properties-group-title')) {
                    // Add event to group title
                    child.addEventListener('click', (event) => {
                        // Hide help texts
                        this.hideHelpContentAll();
                        // Show/Hide group properties
                        if (cloneRow.classList.contains('hide-content')) {
                            cloneRow.classList.remove('hide-content');
                        } else {
                            cloneRow.classList.add('hide-content');
                        }
                    });
                } else {
                    // Clone row
                    let cloneChild = this.cloneRowElement(
                        child,
                        propertyBase,
                        -1
                    );
                    cloneRow.append(cloneChild);
                    child.remove();
                }
            }
            return cloneRow;
        }
        // Elements
        let childrenLabel =
            cloneRow.getAttribute('type') == 'checkbox'
                ? cloneRow.children[1]
                : cloneRow.children[0];
        let childrenValue =
            cloneRow.getAttribute('type') == 'checkbox'
                ? cloneRow.children[0]
                : cloneRow.children[1];
        // Get property id
        let propertyId = cloneRow.getAttribute('property');
        let property = this.metadataProperties[propertyId];
        // Add class copied
        cloneRow.classList.add('copied-row');
        childrenLabel.classList.add('copied');
        childrenValue.classList.add('copied');
        // Add class to first copy row
        if (num == 0) {
            cloneRow.classList.add('first-copied-row');
        } else {
            cloneRow.classList.remove('first-copied-row');
        }
        // New id string
        cloneRow.id = `${cloneRow.id.split('-')[0]}-${eXeLearning.app.common.generateId()}-container`;
        // Modify attribute names
        let newId = `${row.id}-${eXeLearning.app.common.generateId()}`;
        childrenLabel.id = newId;
        childrenLabel.setAttribute('for', newId);
        childrenValue.id = newId;
        childrenValue.setAttribute('name', newId);
        // Add clone attribute group
        childrenValue.setAttribute(
            'groupCopied',
            Object.keys(propertyBase.groups).pop()
        );
        // Clear value
        childrenValue.value = '';
        // Add event to label
        childrenLabel.addEventListener('click', (event) => {
            childrenValue.focus();
        });
        // Add event enter
        cloneRow.querySelectorAll('input[type="text"]').forEach((input) => {
            input.addEventListener('keyup', (event) => {
                event.preventDefault();
                if (event.key == 'Enter') {
                    this.saveAction();
                }
            });
        });
        // Add events to action buttons
        let actionsContainer = cloneRow.querySelector(
            '.actions-duplicate-properties-container'
        );
        if (actionsContainer) {
            let nDuplicate = actionsContainer.getAttribute('duplicate');
            let buttonAdd = actionsContainer.querySelector('.add-properties');
            let buttonDelete =
                actionsContainer.querySelector('.delete-properties');
            this.addEventClickToActionAddButton(
                buttonAdd,
                nDuplicate,
                property,
                cloneRow
            );
            this.addEventClickToActionDeleteButton(
                buttonDelete,
                nDuplicate,
                property,
                cloneRow
            );
        }

        return cloneRow;
    }

    /*******************************************************************************
     * SAVE
     *******************************************************************************/

    /**
     *
     *
     */
    saveAction() {
        // Hide help texts
        this.hideHelpContentAll();
        // Properties dict
        let propertiesDict = this.getPropertiesData();
        // Check required properties
        let missingFields = false;
        let query = `#properties-node-content-form .property-value.required[category="${this.categoryView}"]`;
        this.nodeContent.querySelectorAll(query).forEach((field) => {
            let value = this.getFieldValueByType(field);
            if (value == '') {
                field.classList.add('field-missing');
                missingFields = true;
            } else {
                field.classList.remove('field-missing');
            }
        });
        if (missingFields) {
            eXeLearning.app.modals.alert.show({
                title: _('Project properties'),
                body: _('Please fill in all required fields.'),
                contentId: 'error',
            });
        } else {
            // Save properties in database
            this.saveProperties(propertiesDict, false).then((response) => {
                this.properties.project.app.locale.loadContentTranslationsStrings(
                    propertiesDict.pp_lang
                );
                // eXeLearning.app.modals.alert.show({
                //     title: _('Project properties'),
                //     body: _('Project properties saved.'),
                // });

                // Show message
                let toastData = {
                    title: _('Project properties'),
                    body: _('Project properties saved.'),
                    icon: 'downloading',
                };
                let toast =
                    window.eXeLearning.app.toasts.createToast(toastData);

                // Remove message
                setTimeout(() => {
                    toast.remove();
                }, 1000);
            });
        }
    }

    /**
     *
     *
     */
    getPropertiesData() {
        let propertiesDict = {};
        let propertiesGroupNum = {};
        let propertiesValueElements =
            this.nodeContent.querySelectorAll('.property-value');
        // Loop through all property values of the form
        propertiesValueElements.forEach((propertyValue) => {
            let property =
                this.metadataProperties[propertyValue.getAttribute('property')];
            let value = this.getFieldValueByType(propertyValue);
            // Get key
            let propertyKeyBase = propertyValue.getAttribute('property');
            let propertyKey;
            if (propertyValue.classList.contains('copied')) {
                // Generate property key in case it is a multiple property
                propertyKey = this.getPropertyKeyMultiple(
                    propertyValue,
                    property,
                    propertyKeyBase,
                    propertiesGroupNum,
                    propertiesDict
                );
            } else {
                // If the property is not a copy we send the id of the property as is
                propertyKey = propertyKeyBase;
            }
            // Add to dict
            propertiesDict[propertyKey] = value;
        });

        return propertiesDict;
    }

    /**
     * Generate property key in case it is a multiple property
     *
     * @param {*} propertyValue
     * @param {*} property
     * @returns
     */
    getPropertyKeyMultiple(
        propertyValue,
        property,
        propertyKeyBase,
        propertiesGroupNum,
        propertiesDict
    ) {
        let propertyKeyPrefixGroup = propertyValue.getAttribute('group');
        let propertyKeyPrefixGroupCopied =
            propertyValue.getAttribute('groupCopied');
        let prevGroup = '';
        let propertyKey = '';
        // Loop through all groups
        for (let group of Object.keys(property.groups)) {
            let groupDiff = group.replace(prevGroup, '');
            // Add sufix
            if (group == propertyKeyPrefixGroup) {
                let propertyPre = propertyKey + groupDiff;
                let numStringSuffix = propertiesGroupNum[propertyPre]
                    ? propertiesGroupNum[propertyPre]
                    : '';
                let groupSuffix = propertyKeyBase.replace(
                    propertyKeyPrefixGroup,
                    ''
                );
                let propertyKeyPrototipe =
                    propertyKey + groupDiff + numStringSuffix + groupSuffix;
                // Add group to dict
                if (propertiesDict[propertyKeyPrototipe] !== undefined) {
                    let numGroup = propertiesGroupNum[propertyPre]
                        ? propertiesGroupNum[propertyPre] + 1
                        : 2;
                    propertiesGroupNum[propertyPre] = numGroup;
                }
                let numGroupString = propertiesGroupNum[propertyPre]
                    ? propertiesGroupNum[propertyPre]
                    : '';
                propertyKey += groupDiff + numGroupString + groupSuffix;
            } else {
                // Add group string
                let numStringGroup = propertiesGroupNum[propertyKey]
                    ? propertiesGroupNum[propertyKey]
                    : '';
                propertyKey += groupDiff + numStringGroup;
            }
            // Previous group
            prevGroup = group;
        }
        return propertyKey;
    }

    /**
     * Get property field value
     *
     * @param {*} propertyValue
     * @returns
     */
    getFieldValueByType(propertyValue) {
        let value = '';
        switch (propertyValue.getAttribute('data-type')) {
            case 'checkbox':
                value = propertyValue.checked ? 'true' : 'false';
                break;
            case 'select':
                value = propertyValue.selectedOptions[0].value.trim();
                break;
            case 'text':
            case 'date':
            case 'textarea':
                value = propertyValue.value.trim();
                break;
        }
        return value;
    }

    /**
     *
     * @param {Array} propertiesDict
     * @param {Boolean} inherit
     */
    async saveProperties(propertiesDict, inherit) {
        let response = await this.properties.apiSaveProperties(
            propertiesDict,
            inherit
        );
        return response;
    }

    /*******************************************************************************
     * BEHAVIOUR
     *******************************************************************************/

    /**
     * Add event click to save button
     *
     */
    addBehaviourSaveButton() {
        let saveButton =
            this.propertiesFormElement.querySelector('button.confirm');
        saveButton.addEventListener('click', (event) => {
            this.saveAction();
        });
    }

    /**
     * Add event keyup to all text inputs
     *
     */
    addBehaviourTextInputs() {
        // Press enter to confirm in text inputs
        this.propertiesFormElement
            .querySelectorAll('input[type="text"]')
            .forEach((input) => {
                input.addEventListener('keyup', (event) => {
                    event.preventDefault();
                    if (event.key == 'Enter') {
                        this.saveAction();
                    }
                });
            });
    }

    /**
     * Add event click to help icons
     *
     */
    addBehaviourExeHelp() {
        let exeHelp = this.nodeContent.querySelectorAll('.exe-form-help');
        exeHelp.forEach((help) => {
            // Help text
            let helpContent = help.querySelector('.help-content');
            // Add title
            help.setAttribute('title', _('Information'));
            // Close
            this.hideHelpContent(help);
            // Click event
            help.querySelector('icon').addEventListener('click', (icon) => {
                let show = helpContent.classList.contains('help-hidden');
                this.hideHelpContentAll();
                if (show) this.showHelpContent(help);
            });
        });
    }

    /**
     * Hide helps dialog when clicking on body
     *
     */
    addBehaviourBodyToHideHelpDialogs() {
        document.querySelector('body').addEventListener('click', (event) => {
            if (!event.target.classList.contains('form-help-exe-icon')) {
                this.hideHelpContentAll();
            }
        });
    }

    /**
     * Show help row text
     *
     * @param {*} helpContainer
     */
    showHelpContent(helpContainer) {
        let helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.remove('help-hidden');
        helpContainer.classList.add('help-content-active');
        helpContainer.classList.remove('help-content-disabled');
    }

    /**
     * Hide help row text
     *
     * @param {*} helpContainer
     */
    hideHelpContent(helpContainer) {
        let helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.add('help-hidden');
        helpContainer.classList.add('help-content-disabled');
        helpContainer.classList.remove('help-content-active');
    }

    /**
     * Hide all help texts
     *
     */
    hideHelpContentAll() {
        let exeHelp = this.nodeContent.querySelectorAll('.exe-form-help');
        exeHelp.forEach((help) => {
            this.hideHelpContent(help);
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
