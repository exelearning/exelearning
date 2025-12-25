import IdevicesList from './idevicesList.js';

export default class IdeviceManager {
    constructor(app) {
        this.app = app;
        this.list = new IdevicesList(this);
        this.symfonyURL = this.app.eXeLearning.config.fullURL;
    }

    /**
     *
     */
    async loadIdevicesFromAPI() {
        await this.list.load();
    }

    /**
     *
     */
    showModalIdeviceManager() {
        this.app.modals.idevicemanager.show(this.list);
    }

    /**
     *
     */
    ideviceEngineBehaviour() {
        this.app.project.idevices.behaviour();
    }

    /**
     *
     * @returns {Object}
     */
    getIdeviceActive() {
        return this.app.project.idevices.getIdeviceActive();
    }

    /**
     *
     * @param {String} id
     * @returns {Object}
     */
    getIdeviceById(id) {
        return this.app.project.idevices.getIdeviceById(id);
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    setIdeviceActive(idevice) {
        return this.app.project.idevices.setIdeviceActive(idevice);
    }

    /**
     *
     * @returns
     */
    unsetIdeviceActive() {
        return this.app.project.idevices.setIdeviceActive(undefined);
    }

    /**
     *
     * @param {*} name
     * @returns
     */
    getIdeviceInstalled(name) {
        return this.list.getIdeviceInstalled(name);
    }

    /**
     *
     * @param {*} name
     */
    getIdeviceInstallEditionPath(name) {
        let idevice = this.getIdeviceInstalled(name);
        if (idevice) {
            return idevice.pathEdition;
        } else {
            return '';
        }
    }

    /**
     *
     * @param {*} name
     */
    getIdeviceInstalledExportPath(name) {
        let idevice = this.getIdeviceInstalled(name);
        if (idevice) {
            return idevice.pathExport;
        } else {
            return '';
        }
    }
}
