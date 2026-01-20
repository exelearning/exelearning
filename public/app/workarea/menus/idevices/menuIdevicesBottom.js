export default class MenuIdevicesBottom {
    constructor() {
        this.defaultIdevices = [
            'text',
            'az-quiz-game',
            'form',
            'download-source-file',
            'image-gallery',
        ];
        this.menuIdevices = document.querySelector('#idevices-bottom');
    }

    init() {
        this.nodeContainer = document.querySelector('#node-content');
        this.centerMenuIdevices();
        const resizeObserver = new ResizeObserver(() =>
            this.centerMenuIdevices()
        );
        if (this.nodeContainer) resizeObserver.observe(this.nodeContainer);
        window.addEventListener('resize', this.centerMenuIdevices);
        this.getIdevices().then((response) => {
            if (response === null) {
                this.idevicesData = this.filtreIdevices(this.defaultIdevices);
                this.saveIdevices(this.defaultIdevices);
            } else {
                this.idevicesData = this.filtreIdevices(response);
            }
            Object.values(this.idevicesData).forEach((ideviceData) => {
                this.menuIdevices.append(this.elementDivIdevice(ideviceData));
            });
            this.menuIdevices.append(this.elementConfigIdevices());
            // DEBUG: Check visibility
            console.log('[DEBUG] MenuIdevicesBottom: Appended config. #idevices-bottom classes:', this.menuIdevices.className);
            console.log('[DEBUG] MenuIdevicesBottom: #idevices-bottom style:', this.menuIdevices.getAttribute('style'));
            try {
                const style = window.getComputedStyle(this.menuIdevices);
                console.log('[DEBUG] Computed display:', style.display, 'visibility:', style.visibility, 'opacity:', style.opacity, 'bottom:', style.bottom);
            } catch (e) {
                console.error('[DEBUG] Error checking computed style', e);
            }
            this.ideviceManagerButton = document.querySelector(
                '#setting-menuIdevices'
            );
            this.ideviceManagerButton.addEventListener('click', () => {
                eXeLearning.app.idevices.showModalIdeviceManager();
            });
            eXeLearning.app.project.idevices.behaviour();
        });
    }

    centerMenuIdevices() {
        if (!this.nodeContainer || !this.menuIdevices) return;
        const rect = this.nodeContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        this.menuIdevices.style.position = 'fixed';
        this.menuIdevices.style.left = `${centerX}px`;
        this.menuIdevices.style.transform = 'translateX(-50%)';
    }

    elementDivIdevice(ideviceData) {
        let ideviceDiv = document.createElement('div');
        ideviceDiv.id = ideviceData.id;
        ideviceDiv.classList.add('idevice_item');
        ideviceDiv.classList.add('draggable');
        ideviceDiv.setAttribute('draggable', 'true');
        ideviceDiv.setAttribute('drag', 'idevice');
        ideviceDiv.setAttribute('icon-type', ideviceData.icon.type);
        ideviceDiv.setAttribute('icon-name', ideviceData.icon.name);
        ideviceDiv.setAttribute('title', ideviceData.title);
        ideviceDiv.setAttribute('data-bs-title', ideviceData.title);
        ideviceDiv.setAttribute('data-bs-placement', 'top');
        ideviceDiv.setAttribute('data-bs-toggle', 'tooltip');
        window.bootstrap.Tooltip.getOrCreateInstance(ideviceDiv);
        // Testing: quickbar item testid
        ideviceDiv.setAttribute(
            'data-testid',
            `quick-idevice-${ideviceData.id}`
        );
        ideviceDiv.append(this.elementDivIcon(ideviceData));
        // Accessibility (visually-hidden text)
        let ideviceDivDesc = document.createElement('span');
        ideviceDivDesc.className = 'visually-hidden';
        ideviceDivDesc.textContent = ideviceData.title;
        ideviceDiv.append(ideviceDivDesc);

        return ideviceDiv;
    }

    filtreIdevices(keys) {
        const all = eXeLearning.app.idevices.list.installed;
        return keys.reduce((acc, key, index) => {
            if (all.hasOwnProperty(key)) {
                const idevice = { ...all[key] };
                idevice.__order = index;
                acc[key] = idevice;
            }
            return acc;
        }, {});
    }

    elementDivIcon(ideviceData) {
        let ideviceIcon = document.createElement('div');
        ideviceIcon.classList.add('idevice_icon');
        if (ideviceData.icon.type === 'exe-icon') {
            ideviceIcon.innerHTML = ideviceData.icon.name;
        } else if (ideviceData.icon.type === 'img') {
            ideviceIcon.classList.add('idevice-img-icon');
            ideviceIcon.style.backgroundImage = `url(${ideviceData.path}/${ideviceData.icon.url})`;
            ideviceIcon.style.backgroundRepeat = 'no-repeat';
            ideviceIcon.style.backgroundPosition = 'center';
            ideviceIcon.style.backgroundSize = '24px';
        }
        return ideviceIcon;
    }

    elementConfigIdevices() {
        let settingIcon = document.createElement('div');
        settingIcon.classList.add('idevice_icon', 'settings-icon');
        settingIcon.id = 'setting-menuIdevices';
        settingIcon.setAttribute('title', _('iDevices'));
        settingIcon.setAttribute('data-bs-title', _('iDevices'));
        settingIcon.setAttribute('data-bs-placement', 'top');
        settingIcon.setAttribute('data-bs-toggle', 'tooltip');
        window.bootstrap.Tooltip.getOrCreateInstance(settingIcon);
        return settingIcon;
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('exelearning', 1);
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('idevicesSettings')) {
                    db.createObjectStore('idevicesSettings', { keyPath: 'id' });
                }
            };
            request.onsuccess = function (event) {
                resolve(event.target.result);
            };
            request.onerror = function (event) {
                reject(event.target.error);
            };
        });
    }

    /**
     * Save selected idevices to user preferences in backend
     * @param {Array} array List of selected idevice names
     */
    saveIdevices(array) {
        return new Promise((resolve, reject) => {
            const preferences = {
                idevices_selected: JSON.stringify(array)
            };
            
            eXeLearning.app.api.putSaveUserPreferences(preferences)
                .then((response) => {
                    // Update local preferences cache
                    if (eXeLearning.app.user && eXeLearning.app.user.preferences) {
                        eXeLearning.app.user.preferences.setPreferences(response);
                    }
                    resolve(response);
                })
                .catch((error) => {
                    console.error('Error saving iDevices preferences (Bottom Menu):', error);
                    reject(error);
                });
        });
    }

    /**
     * Get selected iDevices from preferences (with IndexedDB fallback for migration)
     * @returns {Promise<Array|null>} List of idevices or null
     */
    async getIdevices() {
        return new Promise((resolve) => {
            // 1. Try to get from loaded user preferences
            if (eXeLearning.app.user && eXeLearning.app.user.preferences) {
                // We could assume preferences are loaded, but let's try to fetch if unsure or check cache
                // Given this runs on init, we might want to fetch fresh or rely on what's loaded.
                // Safest to try to get from API to ensure we have it, mirroring modal logic.
                
                eXeLearning.app.api.getUserPreferences().then(preferences => {
                     if (preferences && 
                         preferences.userPreferences && 
                         preferences.userPreferences.idevices_selected) {
                             
                         let val = preferences.userPreferences.idevices_selected.value;
                         if (typeof val === 'string') {
                             try {
                                 val = JSON.parse(val);
                             } catch (e) {
                                 console.error("Error parsing idevices_selected", e);
                                 val = [];
                             }
                         }
                         resolve(Array.isArray(val) ? val : []);
                         return;
                     }
                     
                     // 2. Fallback to IndexedDB (Migration)
                     this.openDB().then(db => {
                         const tx = db.transaction('idevicesSettings', 'readonly');
                         const store = tx.objectStore('idevicesSettings');
                         const key = eXeLearning.app.user.name;
                         const request = store.get(key);
                         
                         request.onsuccess = () => {
                             const result = request.result ? request.result.value : null;
                             if (result) {
                                 // Found in IndexedDB, migrate to Backend
                                 console.log("Migrating iDevices from IndexedDB to User Preferences...");
                                 this.saveIdevices(result).then(() => resolve(result));
                             } else {
                                 resolve(null); // Return null to trigger default initialization
                             }
                         };
                         request.onerror = () => {
                             resolve(null);
                         };
                     }).catch(err => {
                         console.error("Error opening IndexedDB for fallback", err);
                         resolve(null);
                     });
                }).catch(err => {
                    console.error("Error fetching user preferences", err);
                    resolve(null);
                 });
            } else {
                resolve(null);
            }
        });
    }
}
