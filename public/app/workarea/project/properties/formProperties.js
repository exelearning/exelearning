// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class FormProperties {
    constructor(properties) {
        this.properties = properties;
        this.metadataProperties = {};
        this.categories = [];
        this.cataloguingCategoryKey = 'cataloguing';
        this.nodeContent = document.querySelector(
            '#main #workarea #node-content'
        );
        this.addBehaviourBodyToHideHelpDialogs();

        // Yjs properties binding instance
        this.yjsBinding = null;
    }

    show() {
        this.combineMetadataProperties();
        const formElement = this.makeBodyElement(this.metadataProperties);
        this.setBodyElement(formElement);
        this.addBehaviourExeHelp();

        // Initialize Yjs binding for real-time sync
        this.initYjsBinding();

        setTimeout(() => {
            this.focusTextInput(
                this.nodeContent.querySelector('input[type="text"')
            );
        }, 500);
    }

    /**
     * Initialize Yjs binding for automatic property sync
     */
    initYjsBinding() {
        const project = this.properties.project;
        if (project._yjsBridge && project._yjsBridge.initialized) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager && documentManager.initialized && window.YjsPropertiesBinding) {
                // Cleanup previous binding if exists
                if (this.yjsBinding) {
                    this.yjsBinding.unbindForm();
                }

                // Create new binding
                this.yjsBinding = new window.YjsPropertiesBinding(documentManager);
                this.yjsBinding.bindForm(this.propertiesFormElement);

                Logger.log('[FormProperties] Yjs binding initialized - changes sync automatically');
            }
        }
    }

    combineMetadataProperties() {
        this.metadataProperties = {};
        this.metadataPropertiesBase = Object.assign(
            {},
            this.properties.properties,
            this.properties.cataloguing
        );
        if (
            eXeLearning.app.user.preferences.preferences.advancedMode.value ==
            'true'
        ) {
            this.metadataProperties = this.metadataPropertiesBase;
        } else {
            for (let [key, property] of Object.entries(
                this.metadataPropertiesBase
            )) {
                if (property.alwaysVisible)
                    this.metadataProperties[key] = property;
            }
        }
        return this.metadataProperties;
    }

    setBodyElement(bodyElement) {
        this.propertiesFormElement = this.nodeContent.querySelector(
            '#properties-node-content-form'
        );
        if (this.propertiesFormElement) {
            this.propertiesFormElement.replaceWith(bodyElement);
        } else {
            this.propertiesFormElement = bodyElement;
            this.nodeContent.append(this.propertiesFormElement);
        }
    }

    remove() {
        // Cleanup Yjs binding
        if (this.yjsBinding) {
            this.yjsBinding.unbindForm();
            this.yjsBinding = null;
        }
        if (this.propertiesFormElement) this.propertiesFormElement.remove();
    }

    makeBodyElement(properties) {
        const element = document.createElement('form');
        element.id = 'properties-node-content-form';
        element.classList.add('loading');
        element.setAttribute('novalidate', '');

        const formContentElement = document.createElement('div');
        formContentElement.classList.add('exe-properties-form-content');
        element.append(formContentElement);

        const propertiesTableElement = document.createElement('div');
        propertiesTableElement.classList.add('exe-table-content');
        propertiesTableElement.classList.add('pb-1');

        this.addRowsFlatWithSectionTitles(properties, propertiesTableElement);

        // No save button - changes sync automatically via Yjs
        formContentElement.append(propertiesTableElement);

        setTimeout(() => element.classList.remove('loading'), 100);

        return element;
    }
    addRowsFlatWithSectionTitles(properties, table) {
        let propertiesArray = Object.entries(properties);
        propertiesArray = propertiesArray.sort((a, b) => {
            if (
                a[1].multipleId &&
                b[1].multipleId &&
                a[1].multipleId === b[1].multipleId
            ) {
                if (a[1].multipleIndex === b[1].multipleIndex) return 0;
                return a[1].multipleIndex > b[1].multipleIndex ? 1 : -1;
            } else if (
                a[1].multipleId &&
                b[1].multipleId &&
                a[1].prefix === b[1].prefix
            ) {
                if (a[1].multipleIndex === b[1].multipleIndex) {
                    if (a[1].index === b[1].index) return 0;
                    return a[1].index > b[1].index ? 1 : -1;
                } else {
                    if (a[1].multipleIndex === b[1].multipleIndex) return 0;
                    return a[1].multipleIndex > b[1].multipleIndex ? 1 : -1;
                }
            } else {
                return 0;
            }
        });

        const groupContainers = new Map();

        const ensureGroupContainer = (topGroupKey, topGroupTitle, property) => {
            if (groupContainers.has(topGroupKey))
                return groupContainers.get(topGroupKey);

            const groupDiv = document.createElement('div');
            groupDiv.classList.add(
                'properties-group',
                'properties-body-container',
                'form-properties'
            );
            groupDiv.setAttribute('data-group', topGroupKey);

            const groupElementTitle = document.createElement('div');
            groupElementTitle.classList.add('properties-group-title');

            const collapseId = `collapse-${topGroupKey}`;
            groupElementTitle.setAttribute('data-bs-toggle', 'collapse');
            groupElementTitle.setAttribute('data-bs-target', `#${collapseId}`);
            groupElementTitle.setAttribute('role', 'button');
            Logger.log(topGroupKey, topGroupTitle, property);
            if (topGroupKey === 'properties_package') {
                groupElementTitle.setAttribute('aria-expanded', 'true');
            } else {
                groupElementTitle.classList.add('collapsed');
                groupElementTitle.setAttribute('aria-expanded', 'false');
            }
            groupElementTitle.setAttribute('aria-controls', collapseId);

            let titleText =
                "<span class='title-text'>" + _(topGroupTitle) + '</span>';
            const catKey = Object.keys(property.category || { '': '' })[0];
            if (catKey == this.cataloguingCategoryKey) {
                if (property.required) {
                    titleText =
                        '* ' +
                        titleText +
                        " · <span class='required-text'>(" +
                        _('Required') +
                        ')</span>';
                } else {
                    titleText +=
                        " · <span class='optional-text'>(" +
                        _('Optional') +
                        ')</span>';
                }
            }
            groupElementTitle.innerHTML =
                "<h2 class='title'>" + titleText + '</h2>';

            const collapseDiv = document.createElement('div');
            if (topGroupKey === 'properties_package') {
                collapseDiv.classList.add('collapse', 'show');
            } else {
                collapseDiv.classList.add('collapse');
            }

            collapseDiv.id = collapseId;

            groupDiv.append(groupElementTitle, collapseDiv);
            table.append(groupDiv);
            groupContainers.set(topGroupKey, collapseDiv);
            return collapseDiv;
        };

        for (const [key, property] of propertiesArray) {
            let topGroupKey = null;
            let topGroupTitle = null;
            if (property.groups && Object.keys(property.groups).length) {
                topGroupKey = Object.keys(property.groups)[0];
                topGroupTitle = property.groups[topGroupKey];
            }

            let groupContainer;
            if (topGroupKey) {
                groupContainer = ensureGroupContainer(
                    topGroupKey,
                    topGroupTitle,
                    property
                );
            } else {
                const noGroupKey = '__no_group__';
                if (!groupContainers.has(noGroupKey)) {
                    const g = document.createElement('div');
                    g.classList.add('properties-group');
                    g.setAttribute('data-group', 'no-group');
                    groupContainers.set(noGroupKey, g);
                    table.append(g);
                }
                groupContainer = groupContainers.get(noGroupKey);
            }

            const propertyRow = this.makeRowElement(key, property);
            if (propertyRow) groupContainer.append(propertyRow);
        }
    }

    makeRowElement(name, property) {
        property.id = name;
        const propertyId = property.multipleId
            ? property.multipleId
            : property.id;
        const propertyIdGenerated =
            propertyId + '-' + eXeLearning.app.common.generateId();

        const propertyRow = document.createElement('div');
        propertyRow.id = propertyIdGenerated + '-container';
        propertyRow.classList.add('property-row');
        propertyRow.setAttribute('property', property.id);
        propertyRow.setAttribute('type', property.type);
        propertyRow.setAttribute(
            'category',
            Object.keys(property.category || { '': '' })[0]
        );
        propertyRow.setAttribute(
            'group',
            property.groups ? Object.keys(property.groups).pop() : ''
        );
        propertyRow.setAttribute(
            'duplicate',
            property.duplicate ? property.duplicate : false
        );

        if (property.multipleId) {
            propertyRow.classList.add('copied-row');
        }

        const propertyTitle = this.makeRowElementLabel(
            propertyIdGenerated,
            property
        );
        const propertyValue = this.makeRowValueElement(
            propertyIdGenerated,
            propertyId,
            property
        );
        const helpContainer = this.makeRowElementHelp(property);
        const actionsContainer = this.makeRowActionsElement(
            property,
            propertyRow
        );
        if (actionsContainer && property.multipleId)
            actionsContainer.setAttribute('original', false);

        if (property.type == 'checkbox') {
            const item = document.createElement('span');
            item.classList.add('toggle-item');
            item.style.cursor = 'pointer';

            const control = document.createElement('span');
            control.classList.add('toggle-control');

            const visual = document.createElement('span');
            visual.classList.add('toggle-visual');
            visual.setAttribute('aria-hidden', 'true');

            propertyValue.classList.add('toggle-input');

            control.append(propertyValue, visual);

            propertyTitle.classList.add('toggle-label', 'mb-0');
            propertyTitle.style.cursor = 'pointer';

            item.addEventListener('click', (e) => {
                if (e.target !== propertyValue) {
                    e.preventDefault();
                    propertyValue.checked = !propertyValue.checked;
                    propertyValue.dispatchEvent(
                        new Event('change', { bubbles: true })
                    );
                }
            });
            propertyTitle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                propertyValue.checked = !propertyValue.checked;
                propertyValue.dispatchEvent(
                    new Event('change', { bubbles: true })
                );
            });

            item.append(control, propertyTitle);
            propertyRow.append(item);

            if (helpContainer) {
                helpContainer.classList.add('ms-2');
                propertyRow.append(helpContainer);
            }
            if (actionsContainer) {
                actionsContainer.classList.add('ms-2');
                propertyRow.append(actionsContainer);
            }
        } else {
            const header = document.createElement('div');
            header.classList.add(
                'header-container',
                'd-flex',
                'align-items-center',
                'gap-2',
                'mb-1'
            );
            propertyTitle.classList.add('form-label', 'mb-0');
            header.append(propertyTitle);
            if (helpContainer) {
                header.append(helpContainer);
            }
            propertyRow.append(header);
            const controlStack = document.createElement('div');
            controlStack.classList.add(
                'd-flex',
                'align-items-center',
                'gap-2',
                'flex-nowrap',
                'content-field'
            );
            controlStack.append(propertyValue);
            if (actionsContainer) {
                actionsContainer.classList.add('mt-1');
                controlStack.append(actionsContainer);
            }
            propertyRow.append(controlStack);
        }

        return propertyRow;
    }

    makeRowElementLabel(id, property) {
        const propertyTitle = document.createElement('label');
        // Translate the property title
        let propertyTitleText = _(property.title);
        if (property.required) propertyTitleText = '* ' + propertyTitleText;
        propertyTitle.innerHTML = propertyTitleText;
        propertyTitle.setAttribute('for', id);
        return propertyTitle;
    }

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
                valueElement.classList.add('toggle-input');
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
                for (let [value, text] of Object.entries(
                    property.options || {}
                )) {
                    const optionElement = document.createElement('option');
                    optionElement.value = value;
                    optionElement.innerHTML = text;
                    if (value === property.value)
                        optionElement.setAttribute('selected', 'selected');
                    valueElement.append(optionElement);
                }
                break;
            default:
                valueElement = document.createElement('div');
                break;
        }

        valueElement = this.addAttributesRowValueElement(
            id,
            name,
            property,
            valueElement
        );

        switch (property.type) {
            case 'select':
                valueElement.classList.add('form-select');
                break;
            case 'textarea':
                valueElement.classList.add('form-control');
                valueElement.setAttribute(
                    'rows',
                    property.rows ? property.rows : 3
                );
                break;
            case 'checkbox':
                break;
            case 'date':
            case 'text':
            default:
                valueElement.classList.add('form-control');
                break;
        }

        return valueElement;
    }

    addAttributesRowValueElement(id, name, property, valueElement) {
        valueElement.id = id;
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
        valueElement.classList.add('property-value');

        // Testing: stable data-testid for common properties
        const idToTestId = {
            titleNode: 'prop-title',
            editableInPage: 'prop-editable-in-page',
            visibility: 'prop-visible-export',
            description: 'prop-description',
            titlePage: 'prop-title-page',
            titleHtml: 'prop-title-html',
        };
        const kebab = (s) =>
            (s || '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const testId = idToTestId[property.id] || `prop-${kebab(property.id)}`;
        valueElement.setAttribute('data-testid', testId);

        valueElement.addEventListener('focus', () => this.hideHelpContentAll());

        if (property.required) {
            valueElement.setAttribute('required', '');
            valueElement.classList.add('required');
        }
        if (property.readonly) valueElement.setAttribute('readonly', '');

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

    makeRowElementHelp(property) {
        if (property.help) {
            const helpContainer = document.createElement('div');
            helpContainer.classList.add(
                'exe-form-help',
                'help-content-disabled'
            );

            const helpIcon = document.createElement('span');
            helpIcon.classList.add(
                'form-help-exe-icon',
                'icon-medium',
                'info-icon-solid-green'
            );

            const helpSpanText = document.createElement('span');
            helpSpanText.classList.add('help-content', 'help-hidden');
            helpSpanText.innerHTML = _(property.help);

            helpContainer.append(helpIcon, helpSpanText);
            return helpContainer;
        } else {
            return false;
        }
    }

    makeRowActionsElement(property, row) {
        let actionsContainer = false;
        if (property.duplicate) {
            actionsContainer = document.createElement('div');
            actionsContainer.classList.add(
                'actions-duplicate-properties-container',
                'd-inline-flex',
                'align-items-center',
                'gap-2'
            );
            actionsContainer.setAttribute('duplicate', property.duplicate);
            actionsContainer.setAttribute('original', 'true');
            const actionAdd = document.createElement('div');
            actionAdd.classList.add('exe-icon', 'add-properties');
            actionAdd.setAttribute('duplicate', property.duplicate);
            actionAdd.innerHTML = 'add_circle_outline';
            this.addEventClickToActionAddButton(
                actionAdd,
                property.duplicate,
                property,
                row
            );
            actionsContainer.append(actionAdd);
            const actionDelete = document.createElement('div');
            actionDelete.classList.add('exe-icon', 'delete-properties');
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

    addEventClickToActionAddButton(button, duplicate, property, row) {
        button.addEventListener('click', () => {
            const rowsToDuplicate = [];
            let nextRow = row;
            for (let i = 0; i < duplicate; i++) {
                if (nextRow) {
                    const cloneRow = this.cloneRowElement(nextRow, property, i);
                    rowsToDuplicate.push(cloneRow);
                    if (i < duplicate - 1) nextRow = nextRow.nextElementSibling;
                }
            }
            rowsToDuplicate.reverse().forEach((cloneRowElement) => {
                this.insertAfter(nextRow, cloneRowElement);
                cloneRowElement
                    .querySelectorAll('.actions-duplicate-properties-container')
                    .forEach((actionsContainer) => {
                        const prevElement =
                            actionsContainer.parentNode.previousSibling;
                        if (actionsContainer && prevElement) {
                            const showRemoveButton =
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

    addEventClickToActionDeleteButton(button, duplicate, property, row) {
        button.addEventListener('click', () => {
            const container = row.parentNode;
            const propertyId = row
                .querySelector('.property-value')
                .getAttribute('property');
            const isOriginal =
                button.parentNode.getAttribute('original') == 'true';
            const propertiesRows = container.querySelectorAll(
                `.property-value[property="${propertyId}"]`
            );
            const nPropertiesRows = propertiesRows ? propertiesRows.length : 0;

            if (nPropertiesRows > 1 && !isOriginal) {
                const rowsToDelete = [];
                let nextRow = row;
                for (let i = 0; i < duplicate; i++) {
                    if (
                        nextRow &&
                        nextRow != row &&
                        nextRow.classList.contains('first-copied-row')
                    )
                        break;
                    rowsToDelete.push(nextRow);
                    if (i < duplicate - 1)
                        nextRow = nextRow.nextElementSibling
                            ? nextRow.nextElementSibling
                            : false;
                }
                rowsToDelete.forEach((rowElement) => {
                    if (rowElement) rowElement.remove();
                });
            }
        });
    }

    cloneRowElement(row, propertyBase, num) {
        const cloneRow = row.cloneNode(true);
        const childrenLabel = cloneRow.querySelector('label');
        const childrenValue = cloneRow.querySelector('.property-value');
        const propertyId = cloneRow.getAttribute('property');
        const property = this.metadataProperties[propertyId];

        cloneRow.classList.add('copied-row');
        if (childrenLabel) childrenLabel.classList.add('copied');
        if (childrenValue) childrenValue.classList.add('copied');
        if (num == 0) cloneRow.classList.add('first-copied-row');
        else cloneRow.classList.remove('first-copied-row');

        cloneRow.id = `${cloneRow.id.split('-')[0]}-${eXeLearning.app.common.generateId()}-container`;

        const newId = `${row.id}-${eXeLearning.app.common.generateId()}`;
        if (childrenLabel) {
            childrenLabel.id = newId;
            childrenLabel.setAttribute('for', newId);
            childrenLabel.addEventListener('click', () => {
                childrenValue?.focus();
            });
        }
        if (childrenValue) {
            childrenValue.id = newId;
            childrenValue.setAttribute('name', newId);
            childrenValue.setAttribute(
                'groupCopied',
                propertyBase.groups
                    ? Object.keys(propertyBase.groups).pop()
                    : ''
            );
            if (childrenValue.tagName.toLowerCase() !== 'select')
                childrenValue.value = '';
        }

        // Note: No save action needed - changes sync automatically via Yjs
        const actionsContainer = cloneRow.querySelector(
            '.actions-duplicate-properties-container'
        );
        if (actionsContainer) {
            const nDuplicate = actionsContainer.getAttribute('duplicate');
            const buttonAdd = actionsContainer.querySelector('.add-properties');
            const buttonDelete =
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
     * BEHAVIOUR
     *******************************************************************************/

    addBehaviourExeHelp() {
        const exeHelp = this.nodeContent.querySelectorAll('.exe-form-help');
        exeHelp.forEach((help) => {
            const helpContent = help.querySelector('.help-content');
            help.setAttribute('title', _('Information'));
            this.hideHelpContent(help);
            help.querySelector('.form-help-exe-icon').addEventListener(
                'click',
                () => {
                    const show = helpContent.classList.contains('help-hidden');
                    this.hideHelpContentAll();
                    if (show) this.showHelpContent(help);
                }
            );
        });
    }

    addBehaviourBodyToHideHelpDialogs() {
        document.querySelector('body').addEventListener('click', (event) => {
            if (!event.target.classList.contains('form-help-exe-icon'))
                this.hideHelpContentAll();
        });
    }

    showHelpContent(helpContainer) {
        const helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.remove('help-hidden');
        helpContainer.classList.add('help-content-active');
        helpContainer.classList.remove('help-content-disabled');
    }

    hideHelpContent(helpContainer) {
        const helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.add('help-hidden');
        helpContainer.classList.add('help-content-disabled');
        helpContainer.classList.remove('help-content-active');
    }

    hideHelpContentAll() {
        const exeHelp = this.nodeContent.querySelectorAll('.exe-form-help');
        exeHelp.forEach((help) => this.hideHelpContent(help));
    }

    focusTextInput(input) {
        if (input) {
            input.focus();
            const inputElementValue = input.value;
            input.value = '';
            input.value = inputElementValue;
        }
    }

    insertAfter(referenceNode, newNode) {
        referenceNode.parentNode.insertBefore(
            newNode,
            referenceNode.nextSibling
        );
    }

    reloadValues() {
        this.combineMetadataProperties();
        for (let [key, property] of Object.entries(this.metadataProperties)) {
            let element;
            if (property.multipleId) {
                const elementsMultiples = this.nodeContent.querySelectorAll(
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
                case 'select': {
                    const select = element.querySelector(
                        `option[value="${property.value}"]`
                    );
                    if (select) select.setAttribute('selected', 'selected');
                    break;
                }
                case 'text':
                case 'date':
                case 'textarea':
                default:
                    element.value = property.value;
                    break;
            }
        }
    }
}
