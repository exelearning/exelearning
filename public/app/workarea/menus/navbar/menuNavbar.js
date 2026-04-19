import NavbarFile from './items/navbarFile.js';
import NavbarUtilities from './items/navbarUtilities.js';
import NavbarStyles from './items/navbarStyles.js';
import NavbarHelp from './items/navbarHelp.js';

export default class MenuNavbar {
    constructor() {
        this.navbar = document.querySelector('#main #head #eXeLearningNavbar');
    }

    /**
     * Load navbar menu
     *
     */
    load() {
        this.disableLinks();
        this.loadJsNavbarClasses();
        this.addNavbarEvents();
    }

    /**
     * Disable all navbar links that are JS-driven (href="#").
     * Links with a real href (e.g. the admin panel link) are left alone so
     * the browser navigates normally.
     *
     */
    disableLinks() {
        this.navbar.querySelectorAll('a').forEach((link) => {
            const href = link.getAttribute('href');
            if (href === '#' || href === null) {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                });
            }
        });
    }

    /**
     * Load navbar menu classes
     *
     */
    loadJsNavbarClasses() {
        this.file = new NavbarFile(this);
        this.utilities = new NavbarUtilities(this);
        this.styles = new NavbarStyles(this);
        this.help = new NavbarHelp(this);
    }

    /**
     * Add navbar events
     *
     */
    addNavbarEvents() {
        this.file.setEvents();
        this.utilities.setEvents();
        this.styles.setStyleManagerEvent();
        this.help.setEvents();
    }
}
