import MenuEngine from './menuEngine.js';
import MenuNavbar from './navbar/menuNavbar.js';
import MenuStructure from './structure/menuStructure.js';
import MenuIdevices from './idevices/menuIdevices.js';

export default class MenuManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * Load menus
     *
     */
    async load() {
        // Load menu objects
        this.loadJsMenusClasses();
        // Load structure menu
        await this.menuStructure.load();
        // Load idevices menu
        this.menuIdevices.load();
        // Set navbar menu events
        this.navbar.load();
        // Menus engine events
        this.menuEngine.behaviour();
    }

    /**
     * Load menu js classes
     *
     */
    loadJsMenusClasses() {
        this.navbar = new MenuNavbar();
        this.menuStructure = new MenuStructure(this.app.project.structure);
        this.menuIdevices = new MenuIdevices(this.app.idevices.list);
        this.menuEngine = new MenuEngine();
    }
}
