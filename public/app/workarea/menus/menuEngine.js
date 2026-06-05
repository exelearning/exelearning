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
        this.initMobileMenuBehavior();
    }

    /**
     * Initialize mobile menu behavior
     * Auto-closes user dropdown after clicking on mobile menu items
     */
    initMobileMenuBehavior() {
        const userDropdown = document.querySelector('#head-bottom-user-logged');
        if (!userDropdown) return;

        // Close the dropdown when clicking on any mobile menu item
        userDropdown.addEventListener('click', (e) => {
            const clickedItem = e.target.closest('.dropdown-item');
            if (!clickedItem) return;

            // Skip if it's a dropdown-toggle (sub-menu trigger)
            if (clickedItem.classList.contains('dropdown-toggle')) return;

            // Close the main user dropdown
            const dropdownToggle = document.querySelector('#exeUserMenuToggler');
            if (dropdownToggle && window.bootstrap) {
                const dropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdown) {
                    dropdown.hide();
                }
            }
        });

        // Initialize mobile button handlers
        this.initMobileButtonHandlers();

        // Initialize mobile layout based on screen size
        this.initMobileLayout();

        // Handle resize events
        window.addEventListener('resize', () => {
            this.handleResponsiveLayout();
        });
    }

    /**
     * Initialize mobile button handlers
     * Maps mobile button clicks to their desktop counterparts
     */
    initMobileButtonHandlers() {
        // Map mobile button IDs to desktop button IDs
        // Each mobile button forwards to the first matching desktop button. Listing the offline
        // (`exportas-*`) variant first means static mode prefers the browser-only handler; in
        // pure online mode that variant isn't rendered and we fall through to the online one.
        const buttonMappings = {
            'mobile-navbar-button-new': ['navbar-button-new'],
            'mobile-navbar-button-openuserodefiles': ['navbar-button-openuserodefiles'],
            'mobile-navbar-button-open-offline': ['navbar-button-open-offline'],
            'mobile-navbar-button-download-project': ['navbar-button-download-project'],
            'mobile-navbar-button-export-web': ['navbar-button-exportas-html5', 'navbar-button-export-html5'],
            'mobile-navbar-button-filemanager': ['navbar-button-filemanager'],
            'mobile-navbar-button-about-exe': ['navbar-button-about-exe']
        };

        Object.entries(buttonMappings).forEach(([mobileId, desktopIds]) => {
            const mobileButton = document.getElementById(mobileId);
            if (!mobileButton) return;
            mobileButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                for (const id of desktopIds) {
                    const desktopButton = document.getElementById(id);
                    if (desktopButton) {
                        desktopButton.click();
                        return;
                    }
                }
            });
        });
    }

    /**
     * Initialize mobile layout - collapse left panel by default on mobile
     */
    initMobileLayout() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            document.body.classList.add('left-column-hidden');
        }
    }

    /**
     * Handle responsive layout changes
     */
    handleResponsiveLayout() {
        const isMobile = window.innerWidth < 768;
        if (isMobile && !this._wasResizedToMobile) {
            document.body.classList.add('left-column-hidden');
            this._wasResizedToMobile = true;
        } else if (!isMobile) {
            this._wasResizedToMobile = false;
        }
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
                    const clickedDropdownToggle =
                        event.target?.closest?.('.dropdown-toggle');
                    if (menus.length > 0) {
                        menus.forEach((menu) => {
                            if (
                                !menu.contains(event.target) &&
                                !clickedDropdownToggle
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
