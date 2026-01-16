import Idevice from './idevice.js';

export default class IdeviceList {
    constructor(manager) {
        this.manager = manager;
        this.installed = {};
    }

    /**
     *
     */
    async load() {
        await this.loadIdevicesInstalled();
    }

    /**
     * Load installed iDevices from API (works in both static and server modes)
     */
    async loadIdevicesInstalled() {
        // Use ApiCallManager which handles both static and server modes internally
        let installedIdevicesJSON =
            await this.manager.app.api.getIdevicesInstalled();
        if (installedIdevicesJSON && installedIdevicesJSON.idevices) {
            installedIdevicesJSON.idevices.forEach((ideviceData) => {
                let idevice = new Idevice(this.manager, ideviceData);
                this.installed[ideviceData.name] = idevice;
            });
        }
    }

    /**
     * Load idevice in client
     *
     * @param {*} ideviceData
     */
    loadIdevice(ideviceData) {
        let idevice = new Idevice(this.manager, ideviceData);
        this.installed[ideviceData.name] = idevice;
    }

    /**
     * Remove idevice
     *
     * @param {*} id
     */
    removeIdevice(id) {
        delete this.installed[id];
    }

    /**
     * Get idevice by name
     *
     */
    getIdeviceInstalled(name) {
        for (let [key, idevice] of Object.entries(this.installed)) {
            if (key == name) {
                return idevice;
            }
        }
        return null;
    }
}
