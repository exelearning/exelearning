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

        /* TO-DO: revert to previous version id no hyerarchy tree used. */
        // Inicialise items counter per level
        this.levelItemCounters = {};
    }

    compose() {
        this.data = this.structureEngine.data ? this.structureEngine.data : {};
        this.menuNavList.innerHTML = '';

        this.levelItemCounters = {};
        this.levelStructure = {};
        this.onlyChildMap = {};
        const childCount = {};
        for (let [id, element] of Object.entries(this.data)) {
            if (element.parent) {
                if (!childCount[element.parent]) {
                    childCount[element.parent] = 0;
                }
                childCount[element.parent]++;
            }
        }
        for (let [id, element] of Object.entries(this.data)) {
            if (element.parent && childCount[element.parent] === 1) {
                this.onlyChildMap[element.id] = true;
            }
        }
        for (let [id, element] of Object.entries(this.data)) {
            if (!element.parent) {
                this.buildTreeRecursive(element, this.menuNavList, 0);
            }
        }
        this.initAccesibility();
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

    /* TO-DO: revert to previous version id no hyerarchy tree used. */

    /**
     * Generate node structure content element
     *
     * @param {Element} parent
     * @param {Object} node
     */
    makeNodeStructureContentNode(
        parent,
        node,
        level = 0,
        itemIndex = 1,
        isOnlyItem = false
    ) {
        let nodeDivElementNav = document.createElement('div');
        nodeDivElementNav.classList.add('nav-element');
        nodeDivElementNav.classList.add(`level${level}`);
        nodeDivElementNav.classList.add(`item${itemIndex}`);
        if (isOnlyItem) {
            nodeDivElementNav.classList.add('onlyitem');
        }
        // Atributes
        nodeDivElementNav.setAttribute('is-parent', false);
        nodeDivElementNav.setAttribute('nav-id', node.id);
        nodeDivElementNav.setAttribute('page-id', node.pageId);
        nodeDivElementNav.setAttribute('nav-parent', node.parent);
        nodeDivElementNav.setAttribute('order', node.order);
        // Testing: stable identifiers and states
        nodeDivElementNav.setAttribute('data-node-id', node.id);
        nodeDivElementNav.setAttribute('data-selected', 'false');

        // Classes
        if (node.open) {
            nodeDivElementNav.classList.add('toggle-on');
            nodeDivElementNav.setAttribute('data-expanded', 'true');
        } else {
            nodeDivElementNav.classList.add('toggle-off');
            nodeDivElementNav.setAttribute('data-expanded', 'false');
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
        //console.log(`Node ${node.id} -> level${level} item${itemIndex} ${isOnlyItem ? '(onlyitem)' : ''}`);
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
            iconElement.innerHTML = 'keyboard_arrow_down';
        } else {
            iconElement.innerHTML = 'keyboard_arrow_right';
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
        let textElement = document.createElement('button');
        textElement.classList.add('nav-element-text');
        textElement.setAttribute('title', node.pageName);
        let pageIcon = document.createElement('i');
        pageIcon.setAttribute('aria-hidden', 'true');
        pageIcon.classList.add('medium-icon', 'page-icon');
        let spanText = document.createElement('span');
        spanText.classList.add('node-text-span');
        spanText.innerText = String(node.pageName);
        textElement.append(pageIcon);
        textElement.append(spanText);
        if (node.id === 'root') {
            let iconRootElement = this.makeNodeRootIconElement(node);
            textElement.append(iconRootElement);
        } else {
            textElement.setAttribute('draggable', true);
            let menuIcon = document.createElement('i');
            menuIcon.classList.add('small-icon', 'settings-icon-green');
            let titleElement = document.createElement('span');
            titleElement.classList.add('visually-hidden');
            titleElement.textContent = _('Page properties');
            let menuButton = document.createElement('button');
            menuButton.classList.add(
                'btn',
                'button-tertiary',
                'button-narrow',
                'd-flex',
                'justify-content-center',
                'align-items-center',
                'node-menu-button',
                'page-settings'
            );
            menuButton.setAttribute('data-menunavid', node.id);
            menuButton.style.cursor = 'pointer';
            menuButton.append(menuIcon);
            menuButton.append(titleElement);
            textElement.append(menuButton);
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

    /* TO-DO: revert to previous version id no hyerarchy tree used. */
    /**
     * Recalculate levelX classes whan DOM is ready
     */
    recalculateLevelsFromDomTree() {
        const updateNodeLevel = (element, level) => {
            element.classList.add(`level${level}`);

            const childrenContainer = element.querySelector(
                '.nav-element-children-container'
            );
            if (childrenContainer) {
                const children = [...childrenContainer.children].filter(
                    (child) => child.classList.contains('nav-element')
                );
                for (let child of children) {
                    updateNodeLevel(child, level + 1);
                }
            }
        };

        const rootNodes = [...this.menuNavList.children].filter((child) =>
            child.classList.contains('nav-element')
        );
        for (let rootNode of rootNodes) {
            updateNodeLevel(rootNode, 0);
        }
    }

    buildTreeRecursive(node, parentElement, level) {
        if (!this.levelItemCounters[level]) {
            this.levelItemCounters[level] = 1;
        }
        const itemIndex = this.levelItemCounters[level];
        const isOnlyItem = this.onlyChildMap[node.id] === true;

        this.makeNodeStructureContentNode(
            parentElement,
            node,
            level,
            itemIndex,
            isOnlyItem
        );

        this.levelItemCounters[level]++;

        const thisNodeElement = parentElement.querySelector(
            `.nav-element[nav-id="${node.id}"]`
        );
        const childrenContainer = thisNodeElement.querySelector(
            '.nav-element-children-container'
        );

        for (let [id, childNode] of Object.entries(this.data)) {
            if (childNode.parent === node.id) {
                thisNodeElement.setAttribute('is-parent', true);
                // Sync ARIA/data-expanded once we know it's a parent
                thisNodeElement.setAttribute(
                    'aria-expanded',
                    thisNodeElement.classList.contains('toggle-on')
                        ? 'true'
                        : 'false'
                );
                this.buildTreeRecursive(
                    childNode,
                    childrenContainer,
                    level + 1
                );
            }
        }
    }

    /**
     * Calculates node jerarchy through their parents
     * @param {Object} node
     * @returns {number}
     */
    getNodeLevel(node) {
        let level = 0;
        while (node.parent && this.data[node.parent]) {
            node = this.data[node.parent];
            level++;
        }
        return level;
    }

    /**
     * Enables basic keyboard navigation for TOC navigation.
     *
     * Adds ARIA roles (tree / treeitem / group) and uses roving tabindex so only one item is tabbable (tabindex="0"); others use -1.
     * Syncs state with aria-expanded (open/closed) and aria-selected (current).
     * Reuses existing click logic and classes (toggle-on / toggle-off); no layout changes.
     *
     * Keys
     * - ArrowUp / ArrowDown: move focus to previous/next VISIBLE item.
     * - ArrowRight: if parent and collapsed → expand; if expanded → first child.
     * - ArrowLeft: if expanded → collapse; otherwise → parent.
     * - Home / End: jump to first / last visible item.
     * - Enter / Space: activate (triggers the existing click behavior).
     *
     */
    initAccesibility() {
        const tree = document.getElementById('nav_list');
        if (!tree) return;
        tree.setAttribute('role', 'tree');
        tree.setAttribute('aria-label', 'Índice de contenidos');

        tree.querySelectorAll('.nav-element-children-container').forEach(
            (g) => {
                g.setAttribute('role', 'group');
            }
        );

        const items = Array.from(tree.querySelectorAll('.nav-element'));
        items.forEach((el) => {
            el.setAttribute('role', 'treeitem');
            el.setAttribute('tabindex', '0');
            const isParent = el.getAttribute('is-parent') === 'true';
            if (isParent) {
                el.setAttribute(
                    'aria-expanded',
                    el.classList.contains('toggle-on') ? 'true' : 'false'
                );
            }
            el.setAttribute(
                'aria-selected',
                el.classList.contains('selected') ? 'true' : 'false'
            );
            el.querySelectorAll(
                '.nav-element-toggle, .page-icon, .root-icon, .drag-over-border'
            ).forEach((icon) => icon.setAttribute('aria-hidden', 'true'));
        });
        const current = tree.querySelector('.nav-element.selected') || items[0];
        if (current) current.setAttribute('tabindex', '0');

        tree.addEventListener('keydown', onTreeKeydown);

        tree.querySelectorAll('.page-settings').forEach((btn) => {
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', 'Opciones de página');
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

        function onTreeKeydown(e) {
            const currentItem = document.activeElement.closest(
                '.nav-element[role="treeitem"]'
            );
            if (!currentItem) return;

            const visibleItems = getVisibleItems();
            const idx = visibleItems.indexOf(currentItem);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (idx < visibleItems.length - 1)
                        focusItem(visibleItems[idx + 1]);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (idx > 0) focusItem(visibleItems[idx - 1]);
                    break;
                case 'ArrowRight': {
                    e.preventDefault();
                    const isParent =
                        currentItem.getAttribute('is-parent') === 'true';
                    const expanded =
                        currentItem.classList.contains('toggle-on');
                    if (isParent && !expanded) {
                        toggleItem(currentItem, true);
                    } else {
                        const firstChild = currentItem.querySelector(
                            ':scope > .nav-element-children-container .nav-element[role="treeitem"]'
                        );
                        if (firstChild && isVisible(firstChild)) {
                            focusItem(firstChild);
                        }
                    }
                    break;
                }
                case 'ArrowLeft': {
                    e.preventDefault();
                    const isParent =
                        currentItem.getAttribute('is-parent') === 'true';
                    const expanded =
                        currentItem.classList.contains('toggle-on');
                    if (isParent && expanded) {
                        toggleItem(currentItem, false);
                    } else {
                        const parent = currentItem
                            .closest('.nav-element-children-container')
                            ?.closest('.nav-element[role="treeitem"]');
                        if (parent) focusItem(parent);
                    }
                    break;
                }
                case 'Home':
                    e.preventDefault();
                    focusItem(visibleItems[0]);
                    break;
                case 'End':
                    e.preventDefault();
                    focusItem(visibleItems[visibleItems.length - 1]);
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    const clickable =
                        currentItem.querySelector(
                            ':scope > .nav-element-text'
                        ) || currentItem;
                    clickable.click();
                    break;
            }
        }

        function focusItem(el) {
            const prev = tree.querySelector(
                '.nav-element[role="treeitem"][tabindex="0"]'
            );
            if (prev && prev !== el) prev.setAttribute('tabindex', '0');
            el.setAttribute('tabindex', '0');
            el.focus({ preventScroll: true });

            tree.querySelectorAll(
                '.nav-element[role="treeitem"][aria-selected="true"]'
            ).forEach((n) => {
                if (n !== el) n.setAttribute('aria-selected', 'false');
            });
            el.setAttribute('aria-selected', 'true');
        }

        function toggleItem(el, expand) {
            const isOpen = el.classList.contains('toggle-on');
            if ((expand && isOpen) || (!expand && !isOpen)) return;
            const chevron = el.querySelector(':scope > .nav-element-toggle');
            if (chevron) chevron.click();
            el.setAttribute('aria-expanded', expand ? 'true' : 'false');
        }

        function getVisibleItems() {
            return Array.from(
                tree.querySelectorAll('.nav-element[role="treeitem"]')
            ).filter(isVisible);
        }
        function isVisible(el) {
            return !!(el.offsetParent || el.getClientRects().length);
        }
    }
}
