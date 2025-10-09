/**
 * eXeLearning
 *
 * Responsible for the resize and drag and drop operation of the menu elements
 */

export default class MenuEngine {
    constructor() {
        this.main = document.querySelector('body#main');
        this.head = document.querySelector('#main #head');
        this.workarea = document.querySelector('#main #workarea');
        this.menus = document.querySelectorAll('#main #workarea .menu');
        this.menuNav = document.querySelector('#main #workarea #menu_nav');
        this.menuIdevices = document.querySelector(
            '#main #workarea #menu_idevices'
        );
        this.relationSizeMenus = {};
        this.relationSizeMenus[this.menuNav.id] = 50;
        this.relationSizeMenus[this.menuIdevices.id] = 50;
    }

    /**
     * Main behaviour
     *
     */
    behaviour() {
        this.closeMenusEvent();
    }

    closeMenusEvent() {
        this.titleProjectButton = document.querySelector('.title-menu-button');
        this.titleButtonDots = document.querySelector(
            '.title-menu-button .dots-menu-vertical-icon'
        );
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
                    const menus = document.querySelectorAll(
                        '[data-bs-toggle="dropdown"].show'
                    );
                    if (menus.length > 0) {
                        menus.forEach((menu) => {
                            if (
                                !menu.contains(event.target) &&
                                !event.target.classList.contains(
                                    'dropdown-toggle'
                                )
                            ) {
                                menu.click();
                            }
                        });
                    }
                },
                false
            );
        });
    }
}
