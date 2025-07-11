/**
 * eXeLearning
 *
 * Loading the package nav structure in the menu
 */

export default class MenuStructureCompose {
    constructor(structureEngine) {
        this.structureEngine = structureEngine;
        this.menuNav = document.querySelector('#main #menu_nav');
        this.menuNavList = this.menuNav.querySelector('#main #nav_list');
        // Add object to engine
        this.structureEngine.menuStructureCompose = this;
    }

    compose() {
        // Project structure
        this.data = this.structureEngine.data ? this.structureEngine.data : {};
        // Compose menuNavList
        this.menuNavList.innerHTML = '';
        // Add project nodes
        for (let [i, element] of Object.entries(this.data)) {
            if (element.parent) {
                let parentElement = this.menuNavList.querySelector(
                    `.nav-element[nav-id="${element.parent}"]`
                );
                let parentChildrenContainer = parentElement.querySelector(
                    `.nav-element-children-container`
                );
                parentElement.setAttribute('is-parent', true);
                this.makeNodeStructureContentNode(
                    parentChildrenContainer,
                    element
                );
            } else {
                this.makeNodeStructureContentNode(this.menuNavList, element);
            }
        }
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    navElementsById(data) {
        let orderData = {};
        data.forEach((element) => {
            orderData[element.id] = element;
        });

        return orderData;
    }

    /**
     * Generate node structure content element
     *
     * @param {Element} parent
     * @param {Object} node
     */
    makeNodeStructureContentNode(parent, node) {
        let nodeDivElementNav = document.createElement('div');
        nodeDivElementNav.classList.add('nav-element');
        // Atributes
        nodeDivElementNav.setAttribute('is-parent', false);
        nodeDivElementNav.setAttribute('nav-id', node.id);
        nodeDivElementNav.setAttribute('page-id', node.pageId);
        nodeDivElementNav.setAttribute('nav-parent', node.parent);
        nodeDivElementNav.setAttribute('order', node.order);
        // Classes
        if (node.open) {
            nodeDivElementNav.classList.add('toggle-on');
        } else {
            nodeDivElementNav.classList.add('toggle-off');
        }
        // Properties attributes/classes
        this.setPropertiesClassesToElement(nodeDivElementNav, node);
        // Icon
        let iconElement = this.makeNodeIconElement(node);
        nodeDivElementNav.appendChild(iconElement);
        // Text
        let textElement = this.makeNodeTextElement(node);
        nodeDivElementNav.appendChild(textElement);
        // Children container
        let childrenElement = document.createElement('div');
        childrenElement.classList.add('nav-element-children-container');
        nodeDivElementNav.appendChild(childrenElement);

        parent.appendChild(nodeDivElementNav);
    }

    /**
     *
     * @param {Object} node
     * @returns {Element}
     */
    makeNodeIconElement(node) {
        let iconElement = document.createElement('span');
        iconElement.classList.add('exe-icon');
        iconElement.classList.add('nav-element-toggle');
        if (node.open) {
            iconElement.innerHTML = 'remove';
        } else {
            iconElement.innerHTML = 'add';
        }
        return iconElement;
    }

    /**
     *
     * @param {*} node
     * @returns {Element}
     */
    makeNodeRootIconElement(node) {
        let iconElement = document.createElement('span');
        iconElement.classList.add('root-icon');
        iconElement.innerHTML = node.icon;
        return iconElement;
    }

    /**
     *
     * @param {Object} node
     * @returns {Element}
     */
    makeNodeTextElement(node) {
        // Text nav element
        let textElement = document.createElement('span');
        textElement.classList.add('nav-element-text');
        let spanText = document.createElement('span');
        spanText.classList.add('node-text-span');
        spanText.innerText = node.pageName;
        textElement.append(spanText);
        if (node.id == 'root') {
            let iconRootElement = this.makeNodeRootIconElement(node);
            textElement.append(iconRootElement);
        } else {
            textElement.setAttribute('draggable', true);
        }
        // Drag over nav element
        let dragOverElement = document.createElement('span');
        dragOverElement.classList.add('drag-over-border');
        textElement.append(dragOverElement);

        return textElement;
    }

    /**
     * Add atributes and classes to node element element based in properties
     *
     * @param {Element} node
     * @param {Object} node
     */
    setPropertiesClassesToElement(nodeElement, node) {
        // visibility
        if (node.properties.visibility.value != '') {
            nodeElement.setAttribute(
                'export-view',
                node.properties.visibility.value
            );
        }
    }
}
