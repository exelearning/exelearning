import MenuIdevicesCompose from './menuIdevicesCompose.js';
import MenuIdevicesBehaviour from './menuIdevicesBehaviour.js';
import MenuIdevicesBottom from './menuIdevicesBottom.js';

export default class MenuIdevices {
    constructor(idevicesList) {
        this.idevicesList = idevicesList;
        this.menuIdevices = document.querySelector('#menu_idevices');
        this.menuIdevicesBottomContent =
            document.querySelector('#idevices-bottom');
        this.categoriesIdevices = undefined;
        this.categoriesIdevicesLabels = undefined;
        this.menuIdevicesCompose = new MenuIdevicesCompose(this, idevicesList);
        this.menuIdevicesBehaviour = new MenuIdevicesBehaviour(this);
    }

    load() {
        this.compose();
        this.behaviour();
    }

    compose() {
        this.menuIdevicesCompose.compose();
        this.categoriesIdevices = document.querySelectorAll(
            '#menu_idevices .idevice_category'
        );
        this.categoriesIdevicesLabels = document.querySelectorAll(
            '#menu_idevices .idevice_category .label'
        );
    }

    behaviour() {
        this.menuIdevicesBehaviour.behaviour();
        let currentMenuIdevicesbutton =
            document.getElementById('idevices-bottom');
        if (
            !currentMenuIdevicesbutton ||
            currentMenuIdevicesbutton.children.length === 0
        ) {
            this.menuIdevicesBottom = new MenuIdevicesBottom(this);
            this.menuIdevicesBottom.init();
        }
    }
}
