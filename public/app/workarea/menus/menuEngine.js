/**
 * eXeLearning
 *
 * Responsible for the resize and drag and drop operation of the menu elements
 */

export default class MenuEngine {
    constructor() {
        this.menuWidthBaseSide = 250;
        this.menuHeightBaseTop = 250;
        this.separationHeight = 10;
        this.separationWidth = 5;
        this.zIndexMenuAnchored = 997;
        this.zIndexMenu = 998;
        this.zIndexMenuDrag = 999;
        this.menuClassLong = 'long';
        this.menuClassThick = 'thick';
        this.main = document.querySelector('body > #main');
        this.head = document.querySelector('#main > #head');
        this.headTop = document.querySelector('#main > #head > .top');
        this.headBottom = document.querySelector('#main > #head > .bottom');
        this.workarea = document.querySelector('#main > #workarea');
        this.nodeContainer = document.querySelector(
            '#main > #workarea > #node-content-container'
        );
        this.menus = document.querySelectorAll('#main > #workarea > .menu');
        this.menuLabels = document.querySelectorAll(
            '#main > #workarea > .menu > .menu_content > .label'
        );
        this.menuNav = document.querySelector('#main > #workarea > #menu_nav');
        this.menuIdevices = document.querySelector(
            '#main > #workarea > #menu_idevices'
        );
        this.buttonMenuHeadNav = document.querySelector('#button_menu_nav');
        this.buttonMenuHeadIdevices = document.querySelector(
            '#button_menu_idevices'
        );
        this.sideMenusIds = [this.menuNav.id, this.menuIdevices.id];
        this.relationSizeMenus = {};
        this.relationSizeMenus[this.menuNav.id] = 50;
        this.relationSizeMenus[this.menuIdevices.id] = 50;
    }

    /**
     * Main behaviour
     *
     */
    behaviour() {
        this.addEventsHeadButtonMenus();
        this.interactMenus();
        this.addButtonsToMenuLabels();
        this.addEventResize();
        this.setDefaultZindex();
        this.addaptPosAndSizes();
    }

    /**
     * Set default z-index of menus
     *
     */
    setDefaultZindex() {
        this.menuNav.style.zIndex = this.zIndexMenu;
        this.menuIdevices.style.zIndex = this.zIndexMenu;
    }

    /**
     * Get #main height
     *
     * @returns float
     */
    getMainHeight() {
        return this.main.clientHeight;
    }

    /**
     * Get #main width
     *
     * @returns float
     */
    getMainWidth() {
        return this.main.clientWidth;
    }

    /**
     * Get #head height
     *
     * @returns float
     */
    getHeadHeight() {
        return this.headTop.clientHeight + this.headBottom.clientHeight;
    }

    /**
     * Get #head width
     *
     * @returns float
     */
    getHeadWidth() {
        return this.head.clientWidth;
    }

    /**
     * Get #workarea height
     *
     * @returns float
     */
    getWorkareaHeight() {
        return this.getMainHeight() - this.getHeadHeight();
    }

    /**
     * Get #workarea width
     *
     * @returns float
     */
    getWorkareaWidth() {
        return this.workarea.clientWidth;
    }

    /**
     * Get #menu_nav height
     *
     * @returns float
     */
    getMenuNavHeight() {
        return this.menuNav.clientHeight;
    }

    /**
     * Get #menu_nav width
     *
     * @returns float
     */
    getMenuNavWidth() {
        return this.menuNav.clientWidth;
    }

    /**
     * Get #menu_idevices height
     *
     * @returns float
     */
    getMenuIdevicesHeight() {
        return this.menuIdevices.clientHeight;
    }

    /**
     * Get #menu_idevices width
     *
     * @returns float
     */
    getMenuIdevicesWidth() {
        return this.menuIdevices.clientWidth;
    }

    /**
     * Get the remaining menu
     *
     * @param nodeElement
     * @returns nodeElement
     */
    getOtherSideMenu(menu) {
        let listIdsMenus = [...this.sideMenusIds];
        let otherMenuId = listIdsMenus.splice(listIdsMenus.indexOf(menu.id), 1);
        otherMenuId = listIdsMenus[0];
        let otherMenu = document.getElementById(otherMenuId);
        return otherMenu;
    }

    /**
     * Interact resize and drag and drop menus
     *
     */
    interactMenus() {
        interact('.menu').resizable({
            // Vertical resize onlye
            edges: { left: false, right: false, bottom: true, top: true },
            listeners: { move: this.resizeMenusListener.bind(this) },
            modifiers: [],
            inertia: false,
        });
        /* Disable drag and drop for the demo (To do: See #381)
        interact('.menu > .menu_content > .label').draggable({
            listeners: {
                move: this.dragMoveMenusListener.bind(this),
                end: this.dragendMoveMenusListener.bind(this),
            },
            inertia: false,
        });
        */
    }

    /**
     * Interact resize listener
     *
     * @param {*} event
     */
    resizeMenusListener(event) {
        var target = event.target;
        // Containers
        var workareaHeight = this.getWorkareaHeight();
        var workareaWidth = this.getWorkareaWidth();
        // New size
        var newWidth = event.rect.width;
        var newHeight = event.rect.height;
        // Resize
        let { x, y } = target.dataset;
        x = (parseFloat(x) || 0) + event.deltaRect.left;
        y = (parseFloat(y) || 0) + event.deltaRect.top;
        Object.assign(target.style, {
            width: `${newWidth}px`,
            height: `${newHeight}px`,
            transform: `translate(${x}px, ${y}px)`,
        });
        Object.assign(target.dataset, { x, y });
        // If menu is anchored addapt the other menu
        if (target.getAttribute('pos') != 'free') {
            // Get the other menu
            let otherMenu = this.getOtherSideMenu(target);
            // Addapt the other menu
            // - Left / Right
            if (
                target.getAttribute('pos') == 'left' ||
                target.getAttribute('pos') == 'right'
            ) {
                if (
                    target.getAttribute('pos') == otherMenu.getAttribute('pos')
                ) {
                    otherMenu.style.width = newWidth + 'px';
                    otherMenu.style.height =
                        workareaHeight -
                        (newHeight + this.separationHeight * 3) +
                        'px';
                }
                if (
                    otherMenu.getAttribute('pos') == 'top' ||
                    otherMenu.getAttribute('pos') == 'bottom'
                ) {
                    otherMenu.style.width =
                        workareaWidth -
                        (newWidth + this.separationWidth * 3) +
                        'px';
                }
            }
            // - Top
            if (target.getAttribute('pos') == 'top') {
                if (otherMenu.getAttribute('pos') == 'top') {
                    otherMenu.style.height = newHeight + 'px';
                    otherMenu.style.width =
                        workareaWidth -
                        (newWidth + this.separationWidth * 2) +
                        'px';
                }
            }
        }
        // Addapt menus max/min sizes
        this.addaptMenusSizes(false);
        // Adapt menus position top/left
        this.addaptMenusPosition();
        // Addapt node container
        this.addaptNodeContainer();
        this.setClassRelationMenu();
    }

    /**
     * Interact drag and drop move listener
     *
     * @param {*} event
     */
    dragMoveMenusListener(event) {
        var target = event.target;
        var parent = target.parentNode.parentNode;
        // Add class dragging
        parent.classList.add('dragging');
        // Keep the dragged position in the data-x/data-y attributes
        var x = (parseFloat(parent.getAttribute('data-x')) || 0) + event.dx;
        var y = (parseFloat(parent.getAttribute('data-y')) || 0) + event.dy;
        // Correct data-y of idevices menu
        let positionsMenu = this.getPositionsMenus();
        if (
            parent.id == 'menu_idevices' &&
            parent.style.top &&
            ((parent.getAttribute('pos') == 'left' &&
                positionsMenu.left.length > 1) ||
                (parent.getAttribute('pos') == 'right' &&
                    positionsMenu.right.length > 1)) &&
            parent.classList.contains('dragging') &&
            parent.getAttribute('data-y') == 0
        ) {
            y += parent.style.top.slice(0, -2) / 1.3;
            parent.style.top = '';
        }
        // Set max/min sizes of menu
        let actualHeight = parent.style.height.slice(0, -2);
        let actualWidth = parent.style.width.slice(0, -2);
        let maxHeight = Math.max(
            this.getWorkareaHeight() / 2,
            this.menuHeightBaseTop
        );
        let maxWidth = Math.max(
            this.getWorkareaWidth() / 2,
            this.menuWidthBaseSide
        );
        parent.style.maxHeight = maxHeight + 'px';
        parent.style.maxWidth = maxWidth + 'px';
        if (actualHeight > maxHeight) {
            parent.style.minHeight = maxHeight + 'px';
            parent.style.height = maxHeight + 'px';
        }
        if (actualWidth > maxWidth) {
            parent.style.minWidth = maxWidth + 'px';
            parent.style.width = maxWidth + 'px';
        }
        // Translate the element
        parent.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        // Update the position attributes
        parent.setAttribute('data-x', x);
        parent.setAttribute('data-y', y);
        // Set positions
        this.setMenuPositionAttribute(parent);
        // Set z-index
        this.menus.forEach((menu) => {
            if (menu.getAttribute('pos') == 'free') {
                menu.style.zIndex = this.zIndexMenu;
            } else {
                menu.style.zIndex = this.zIndexMenuAnchored;
            }
        });
        if (parent.getAttribute('pos') == 'free') {
            parent.style.zIndex = this.zIndexMenuDrag;
        }
    }

    /**
     * Interact drag and drop end listener
     *
     * @param {*} event
     */
    dragendMoveMenusListener(event) {
        var target = event.target;
        var parent = target.parentNode.parentNode;
        // Remove class dragging
        parent.classList.remove('dragging');
        // Remove attribute to node container
        this.nodeContainer.setAttribute('dragging-pos', '');
        if (parent.getAttribute('pos') == 'free') {
            // Adapt size of menus and node container
            this.addaptMenusPosition();
            this.addaptMenusSizes();
            this.addaptNodeContainer();
            parent.style.minHeight = this.menuHeightBaseTop + 'px';
            parent.style.minWidth = this.menuWidthBaseSide + 'px';
            parent.style.maxHeight = '';
            parent.style.maxWidth = '';
        } else {
            // Adapt size/pos of menus and size of node container
            this.addaptPosAndSizes();
        }
        // Set class based on the relationship between the width and height
        this.setClassRelationMenu();
    }

    /**
     * Set menu position attribute
     *
     * @param {*} element
     */
    setMenuPositionAttribute(element) {
        let vw = Math.max(
            document.documentElement.clientWidth || 0,
            window.innerWidth || 0
        );
        let vh = Math.max(
            document.documentElement.clientHeight || 0,
            window.innerHeight || 0
        );
        let rect = element.getBoundingClientRect();
        let newPosAttribute = 'free';
        if (rect.left <= vw * 0.05) newPosAttribute = 'left';
        if (rect.right >= vw) newPosAttribute = 'right';
        if (rect.top <= document.querySelector('#head').offsetHeight)
            newPosAttribute = 'top';
        // Add attribute to node container
        this.nodeContainer.setAttribute('dragging-pos', newPosAttribute);
        // Add attribute to menu
        element.setAttribute('pos', newPosAttribute);
    }

    /**
     * Adapt the size/pos of menus
     *
     */
    addaptMenus() {
        this.addaptMenusSizesByBase();
        this.addaptMenusSizes();
        this.addaptMenusPosition();
    }

    addaptMenusSizesByBase() {
        this.menus.forEach((menu) => {
            switch (menu.getAttribute('pos')) {
                case 'top':
                    menu.style.left = this.separationWidth + 'px';
                    menu.style.height = this.menuHeightBaseTop + 'px';
                    menu.style.minHeight = this.menuHeightBaseTop + 'px';
                    menu.style.minWidth = this.menuWidthBaseSide + 'px';
                    break;
                case 'left':
                    menu.style.left = this.separationWidth + 'px';
                    menu.style.width = this.menuWidthBaseSide + 'px';
                    menu.style.minHeight = this.menuHeightBaseTop + 'px';
                    menu.style.minWidth = this.menuWidthBaseSide + 'px';
                    break;
                case 'right':
                    menu.style.left =
                        this.getWorkareaWidth() -
                        (this.menuWidthBaseSide + this.separationWidth) +
                        'px';
                    menu.style.width = this.menuWidthBaseSide + 'px';
                    menu.style.minHeight = this.menuHeightBaseTop + 'px';
                    menu.style.minWidth = this.menuWidthBaseSide + 'px';
                    break;
                case 'bottom':
                    break;
                case 'free':
                    menu.style.minHeight = this.menuHeightBaseTop + 'px';
                    menu.style.minWidth = this.menuWidthBaseSide + 'px';
                    break;
            }
        });
    }

    /**
     * Change sizes of menús
     *
     * @param {*} write to change height/width
     */
    addaptMenusSizes(write = true) {
        // Containers height
        var workareaHeight = this.getWorkareaHeight();
        // Containers width
        var workareaWidth = this.getWorkareaWidth();
        // Menu size adaptation
        this.menus.forEach((menu) => {
            // Get the other menu
            let otherMenu = this.getOtherSideMenu(menu);
            // Set styles by pos
            // - Left / Right
            if (
                menu.getAttribute('pos') == 'right' ||
                menu.getAttribute('pos') == 'left'
            ) {
                menu.style.maxWidth =
                    workareaWidth -
                    (this.menuWidthBaseSide + this.separationWidth * 3) +
                    'px';
                if (menu.getAttribute('pos') == otherMenu.getAttribute('pos')) {
                    if (otherMenu.classList.contains('minimized')) {
                        if (write)
                            menu.style.height =
                                workareaHeight -
                                (otherMenu.clientHeight +
                                    this.separationHeight * 3) +
                                'px';
                        menu.style.maxHeight = '';
                    } else {
                        if (write)
                            menu.style.height =
                                (workareaHeight *
                                    this.relationSizeMenus[menu.id]) /
                                100;
                        this.separationHeight * 1.5 + 'px';
                        menu.style.maxHeight =
                            Math.max(
                                workareaHeight -
                                    (this.menuHeightBaseTop +
                                        this.separationHeight * 3),
                                this.menuHeightBaseTop
                            ) + 'px';
                    }
                } else if (
                    otherMenu.getAttribute('pos') != 'free' &&
                    otherMenu.getAttribute('pos') != 'top' &&
                    otherMenu.getAttribute('pos') != 'bottom' &&
                    menu.getAttribute('pos') != otherMenu.getAttribute('pos')
                ) {
                    if (write)
                        menu.style.height =
                            workareaHeight - this.separationHeight * 2 + 'px';
                    menu.style.maxWidth =
                        workareaWidth -
                        (otherMenu.clientWidth +
                            this.separationWidth * 3 +
                            this.menuWidthBaseSide) +
                        'px';
                    menu.style.maxHeight =
                        workareaHeight - this.separationHeight * 2 + 'px';
                    menu.style.minHeight =
                        workareaHeight - this.separationHeight * 2 + 'px';
                } else {
                    if (write)
                        menu.style.height =
                            workareaHeight - this.separationHeight * 2 + 'px';
                    menu.style.maxHeight =
                        workareaHeight - this.separationHeight * 2 + 'px';
                    menu.style.minHeight =
                        workareaHeight - this.separationHeight * 2 + 'px';
                }
            }
            // - Top / Bottom
            if (
                menu.getAttribute('pos') == 'top' ||
                menu.getAttribute('pos') == 'bottom'
            ) {
                if (menu.getAttribute('pos') == otherMenu.getAttribute('pos')) {
                    if (write)
                        menu.style.width =
                            (workareaWidth * this.relationSizeMenus[menu.id]) /
                            100;
                    this.separationWidth * 1.5 + 'px';
                    menu.style.maxWidth =
                        Math.max(
                            workareaWidth -
                                (this.menuWidthBaseSide +
                                    this.separationWidth * 2),
                            this.menuWidthBaseSide
                        ) + 'px';
                } else if (
                    otherMenu.getAttribute('pos') == 'left' ||
                    otherMenu.getAttribute('pos') == 'right'
                ) {
                    if (write)
                        menu.style.width =
                            workareaWidth -
                            (otherMenu.clientWidth + this.separationWidth * 3) +
                            'px';
                    menu.style.maxWidth =
                        workareaWidth -
                        (otherMenu.clientWidth + this.separationWidth * 3) +
                        'px';
                    menu.style.minWidth =
                        workareaWidth -
                        (otherMenu.clientWidth + this.separationWidth * 3) +
                        'px';
                } else {
                    if (write)
                        menu.style.width =
                            workareaWidth - this.separationWidth * 2 + 'px';
                    menu.style.maxWidth =
                        workareaWidth - this.separationWidth * 2 + 'px';
                    menu.style.minWidth =
                        workareaWidth - this.separationWidth * 2 + 'px';
                }
            }
            // - Free
            if (menu.getAttribute('pos') == 'free') {
                menu.style.maxHeight =
                    Math.max(workareaHeight / 1.5, this.menuHeightBaseTop) +
                    'px';
                menu.style.maxWidth =
                    Math.max(workareaWidth / 1.5, this.menuWidthBaseSide) +
                    'px';
            }
            // Reset menu data (x,y) and transform
            if (menu.getAttribute('pos') != 'free') {
                this.resetMenu(menu);
            }
        });
        this.setClassRelationMenu();
    }

    addaptMenusPosition() {
        // Get positions of menus
        let positions = this.getPositionsMenus();
        // Containers height
        var headHeight = this.getHeadHeight();
        // Reset anchor menus
        this.menus.forEach((menu) => {
            if (menu.getAttribute('pos') == 'right') {
                menu.style.left =
                    this.getWorkareaWidth() -
                    (menu.clientWidth + this.separationWidth) +
                    'px';
            }
            if (
                menu.getAttribute('pos') == 'left' ||
                menu.getAttribute('pos') == 'right' ||
                menu.getAttribute('pos') == 'top'
            ) {
                menu.style.top = headHeight + this.separationHeight + 'px';
            }
            if (
                menu.getAttribute('pos') == 'top' ||
                menu.getAttribute('pos') == 'bottom'
            ) {
                menu.style.left = this.separationWidth + 'px';
            }
        });
        // Addapt pos
        // - All menus sides
        if (positions.left.length == 2 || positions.right.length == 2) {
            this.menuIdevices.style.top =
                headHeight +
                this.getMenuNavHeight() +
                this.separationHeight * 2 +
                'px';
        }
        // - All menus top
        else if (positions.top.length == 2 || positions.bottom.length == 2) {
            this.menuIdevices.style.left =
                this.getMenuNavWidth() + this.separationWidth * 2 + 'px';
        }
        // - Menu top menu side
        else if (positions.top.length && positions.right.length) {
            let topMenu = document.getElementById(positions.top[0]);
            topMenu.style.left = this.separationWidth + 'px';
        } else if (positions.top.length && positions.left.length) {
            let leftMenu = document.getElementById(positions.left[0]);
            let topMenu = document.getElementById(positions.top[0]);
            topMenu.style.left =
                leftMenu.clientWidth + this.separationWidth * 2 + 'px';
        }
    }

    /**
     * Adapt the size of the content container
     *
     */
    addaptNodeContainer() {
        // Get workarea sizes
        let headHeight = this.getHeadHeight();
        let workareaHeight = this.getWorkareaHeight();
        let workareaWidth = this.getWorkareaWidth();
        // Base node container sizes
        var nodeContainerHeight = workareaHeight - this.separationHeight * 2;
        var nodeContainerWidth = workareaWidth - this.separationWidth * 2;
        // Base pos left/top of node content
        var nodeContainerLeft = this.separationWidth;
        var nodeContainerTop = headHeight + this.separationHeight;
        // Get positions of menus
        let positions = this.getPositionsMenus();
        // Set node container size and pos based on menus
        // - Left
        if (positions.left.length) {
            var maxWidthMenuLeft = 0;
            positions.left.forEach((id) => {
                if (
                    document.getElementById(id).clientWidth > maxWidthMenuLeft
                ) {
                    maxWidthMenuLeft = document.getElementById(id).clientWidth;
                }
            });
            nodeContainerWidth -= maxWidthMenuLeft;
            nodeContainerWidth -= this.separationWidth;
            nodeContainerLeft += maxWidthMenuLeft + this.separationWidth;
        }
        // - Right
        if (positions.right.length) {
            var maxWidthMenuRight = 0;
            positions.right.forEach((id) => {
                if (
                    document.getElementById(id).clientWidth > maxWidthMenuRight
                ) {
                    maxWidthMenuRight = document.getElementById(id).clientWidth;
                }
            });
            nodeContainerWidth -= maxWidthMenuRight;
            nodeContainerWidth -= this.separationWidth;
        }
        // - Top
        if (positions.top.length) {
            var maxHeightMenuTop = 0;
            positions.top.forEach((id) => {
                if (
                    document.getElementById(id).clientHeight > maxHeightMenuTop
                ) {
                    maxHeightMenuTop = document.getElementById(id).clientHeight;
                }
            });
            nodeContainerHeight -= maxHeightMenuTop;
            nodeContainerHeight -= this.separationHeight;
            nodeContainerTop += maxHeightMenuTop + this.separationHeight;
        }
        // Set styles
        this.nodeContainer.style.width = nodeContainerWidth + 'px';
        this.nodeContainer.style.height = nodeContainerHeight + 'px';
        this.nodeContainer.style.top = nodeContainerTop + 'px';
        this.nodeContainer.style.left = nodeContainerLeft + 'px';
    }

    /**
     * Adapt the size and pos of the content container and menus
     *
     */
    addaptPosAndSizes() {
        this.addaptMenus();
        this.addaptNodeContainer();
    }

    /**
     * Add class based on the relationship between the width and height of the menu
     *
     */
    setClassRelationMenu() {
        this.menus.forEach((menu) => {
            let width = menu.offsetWidth;
            let height = menu.offsetHeight;
            if (
                width >= height * 1.8 &&
                height < this.getWorkareaHeight() / 2
            ) {
                menu.classList.remove(this.menuClassLong);
                menu.classList.add(this.menuClassThick);
                if (menu.getAttribute('size') == this.menuClassLong) {
                    menu.setAttribute('size', this.menuClassThick);
                }
            } else {
                menu.classList.remove(this.menuClassThick);
                menu.classList.add(this.menuClassLong);
                if (menu.getAttribute('size') == this.menuClassThick) {
                    menu.setAttribute('size', this.menuClassLong);
                }
            }
        });
    }

    /**
     * Add events to menu head buttons
     *
     */
    addEventsHeadButtonMenus() {
        var p = this;
        this.buttonMenuHeadNav.addEventListener('click', function () {
            p.toggleMenu(p.menuNav);
        });
        this.buttonMenuHeadIdevices.addEventListener('click', function () {
            p.toggleMenu(p.menuIdevices);
        });
    }

    /**
     * Addapt Menus and node content by resize event
     *
     */
    addEventResize() {
        var p = this;
        window.addEventListener('resize', function () {
            p.addaptPosAndSizes();
        });
    }

    /**
     * Toggle menu
     *
     * @param {*} menu
     */
    toggleMenu(menu) {
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            menu.classList.remove('minimized');
            this.resetMenu(menu, 'left');
            this.addaptMenus();
            this.addaptNodeContainer();
        } else {
            menu.classList.add('hidden');
            this.resetMenu(menu, 'free');
        }
        this.addaptPosAndSizes();
    }

    /**
     * Reset menu
     *
     * @param {*} menu
     * @param {*} pos
     */
    resetMenu(menu, pos = false) {
        if (pos) menu.setAttribute('pos', pos);
        menu.setAttribute('data-x', 0);
        menu.setAttribute('data-y', 0);
        menu.style.transform = '';
    }

    /**
     * Get positions of menus
     *
     */
    getPositionsMenus() {
        let positions = { top: [], bottom: [], left: [], right: [], free: [] };
        // Get positions of menus
        this.menus.forEach((menu) => {
            positions[menu.getAttribute('pos')].push(menu.id);
        });
        return positions;
    }

    /**
     * Add button x to menu labels
     *
     * TODO: Move to menu class file
     */
    addButtonsCloseToMenuLabels() {
        var p = this;
        this.menuLabels.forEach((label) => {
            let button = document.createElement('div');
            button.title = _('Close panel');
            button.classList.add('button-remove');
            button.classList.add('showmin');
            button.addEventListener('click', function () {
                p.closeMenu(label.parentElement.parentElement);
            });
            label.appendChild(button);
        });
    }

    /**
     * Add button - to menu labels
     *
     * TODO: Move to menu class file
     */
    addButtonsMinToMenuLabels() {
        var p = this;
        this.menuLabels.forEach((label) => {
            let button = document.createElement('div');
            button.title = _('Minimize');
            button.classList.add('button-minimize');
            button.classList.add('showmin');
            button.classList.add('exe-app-tooltip');
            button.addEventListener('click', function () {
                p.minimizeMenu(label.parentElement.parentElement);
            });
            label.appendChild(button);
        });
        eXeLearning.app.common.initTooltips(this.menuLabels);
    }

    /**
     * Add buttons to menus label
     *
     * TODO: Move to menu class file
     */
    addButtonsToMenuLabels() {
        this.addButtonsMinToMenuLabels();
        this.addButtonsCloseToMenuLabels();
    }

    /**
     * Minimize menu
     *
     * TODO
     */
    minimizeMenu(menu) {
        if (menu.classList.contains('menu')) {
            if (menu.classList.contains('minimized')) {
                menu.classList.remove('minimized');
            } else {
                menu.classList.add('minimized');
            }
            // Get the other menu
            let otherMenu = this.getOtherSideMenu(menu);
            // If menu is anchored addapt the other menu
            if (menu.getAttribute('pos') != 'free') {
                // Addapt the other menu
                // - Left / Right
                if (
                    menu.getAttribute('pos') == 'left' ||
                    menu.getAttribute('pos') == 'right'
                ) {
                    if (
                        menu.getAttribute('pos') ==
                        otherMenu.getAttribute('pos')
                    ) {
                        otherMenu.style.height =
                            this.getWorkareaHeight() -
                            (menu.clientHeight + this.separationHeight * 3) +
                            'px';
                    }
                }
                // - Top
                if (menu.getAttribute('pos') == 'top') {
                    if (otherMenu.getAttribute('pos') == 'top') {
                        otherMenu.style.height = menu.clientHeight + 'px';
                    }
                }
            }
            // Addapt menus max/min sizes
            this.addaptMenusSizes(false);
            // Remove max height of other menu
            otherMenu.style.maxHeight = '';
            menu.style.maxHeight = '';
            // Adapt menus position top/left
            this.addaptMenusPosition();
            // Addapt node container
            this.addaptNodeContainer();
        }
    }

    /**
     * Close menu
     */
    closeMenu(menu) {
        if (menu.classList.contains('menu')) {
            menu.classList.add('hidden');
            this.resetMenu(menu, 'free');
            this.addaptPosAndSizes();
        }
    }
}
