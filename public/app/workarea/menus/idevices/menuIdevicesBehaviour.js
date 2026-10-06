export default class MenuIdevicesBehaviour {
    constructor(parent) {
        this.parent = parent;
        this.activeLabel = null;
    }

    /**
     *
     */
    behaviour() {
        this.addEventClickIdeviceCategory(); // Handles click events
        this.changeAttributePosBehaviour(); //Observes changes in attributes
        this.addResizeListener(); // Handles resize events
        this.observeRootPageState();
    }

    /**
     * Observes changes to the selected node and disables the iDevices panel
     * when the root page (Project Properties) is active.
     */
    observeRootPageState() {
        const nodeContent = document.querySelector('#node-content');
        if (!nodeContent) return;

        this.updateIdevicesDisabledState(nodeContent.getAttribute('node-selected'));

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'node-selected') {
                    this.updateIdevicesDisabledState(
                        nodeContent.getAttribute('node-selected')
                    );
                }
            });
        });
        observer.observe(nodeContent, { attributes: true, attributeFilter: ['node-selected'] });
    }

    /**
     * Toggles the disabled state of the iDevices panel and quickbar
     * based on whether the root page is currently selected.
     *
     * @param {string|null} nodeSelected - Value of the node-selected attribute
     */
    updateIdevicesDisabledState(nodeSelected) {
        const isRoot = nodeSelected === 'root';
        const tooltipText = _("You can't add an iDevice on the root page");

        const listMenuIdevices = document.querySelector('#list_menu_idevices');
        if (listMenuIdevices) {
            listMenuIdevices.classList.toggle('disabled', isRoot);
            if (isRoot) {
                listMenuIdevices.setAttribute('title', tooltipText);
                this.parent.categoriesIdevices?.forEach((el) => {
                    el.classList.remove('on', 'last-open');
                    el.classList.add('off');
                });
            } else {
                listMenuIdevices.removeAttribute('title');
            }
        }

        const idevicesBottom = document.querySelector('#idevices-bottom');
        if (idevicesBottom) {
            idevicesBottom.classList.toggle('disabled', isRoot);
            if (isRoot) {
                idevicesBottom.setAttribute('title', tooltipText);
            } else {
                idevicesBottom.removeAttribute('title');
            }
        }
    }

    /**
     *
     */
    addEventClickIdeviceCategory() {
        this.parent.categoriesIdevicesLabels.forEach((label) => {
            label.addEventListener('click', (event) => {
                let category = label.parentNode;

                // saving active label
                this.activeLabel = label;
                this.positionSibling(label);

                // thick menu behaviour
                if (this.parent.menuIdevices.getAttribute('size') === 'thick') {
                    this.parent.categoriesIdevices.forEach((element) => {
                        element.classList.remove('on');
                        element.classList.add('off');
                    });
                    eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                }
                if (category.classList.contains('off')) {
                    this.parent.categoriesIdevices.forEach((element) => {
                        element.classList.remove('last-open');
                        element.classList.remove('on');
                        element.classList.add('off');
                    });
                    eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    category.classList.remove('off');
                    category.classList.add('on');
                    category.classList.add('last-open');
                    // on -> off
                } else {
                    category.classList.remove('on');
                    category.classList.remove('last-open');
                    category.classList.add('off');
                }
            });
        });

        [
            'click',
            'dragstart',
            'drag',
            'dragend',
            'dragenter',
            'dragover',
            'dragleave',
            'drop',
        ].forEach((closeEvent) => {
            document.addEventListener(
                closeEvent,
                (event) => {
                    const menu = document.getElementById(
                        'menu_idevices_content'
                    );
                    if (!menu.contains(event.target)) {
                        this.parent.categoriesIdevices.forEach((element) => {
                            element.classList.remove('last-open');
                            element.classList.remove('on');
                            element.classList.add('off');
                        });
                    }
                    eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                },
                true
            );
        });
    }

    /**
     *
     */
    addResizeListener() {
        window.addEventListener('resize', () => {
            if (this.activeLabel) {
                this.positionSibling(this.activeLabel);
            }
        });
    }

    /**
     * Helper method for calculating positioning of elements
     * On mobile (< 768px), skip horizontal positioning and let CSS handle vertical layout
     */
    positionSibling(label) {
        const category = label.parentNode;
        const sibling = label.nextElementSibling;

        if (!sibling) return;

        // Skip horizontal positioning on mobile - let CSS handle vertical layout
        if (window.innerWidth < 768) {
            sibling.style.left = ''; // Clear inline style
            return;
        }

        const rect = category.getBoundingClientRect();
        sibling.style.left = `${rect.right + 14}px`;
    }

    /**
     *
     */
    changeAttributePosBehaviour() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName == 'size'
                ) {
                    this.parent.categoriesIdevices.forEach((category) => {
                        category.classList.remove('on');
                        category.classList.add('off');
                    });
                    let lastOpen = this.parent.menuIdevices.querySelector(
                        '.idevice_category.last-open'
                    );
                    if (lastOpen) {
                        lastOpen.classList.remove('off');
                        lastOpen.classList.add('on');
                    }
                }
            });
        });
        observer.observe(this.parent.menuIdevices, { attributes: true });
    }
}
