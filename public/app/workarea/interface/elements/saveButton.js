// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class SaveProjectButton {
    constructor() {
        this.saveMenuHeadButton = document.querySelector(
            '#head-top-save-button'
        );
        this.isSaving = false;
    }

    /**
     * Init element
     *
     */
    init() {
        this.addEventClick();
    }

    /**
     * Add event click to button
     *
     */
    addEventClick() {
        this.saveMenuHeadButton.addEventListener('click', async (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;

            // Prevent double clicks while saving
            if (this.isSaving) {
                Logger.log('[SaveButton] Save already in progress');
                return;
            }

            // Collaborative notification
            let exe = eXeLearning.app.project;
            if (exe.realTimeEventNotifier) {
                exe.realTimeEventNotifier.notify(exe.odeSession, {
                    name: 'save-menu-head-button',
                    payload: true,
                });
            }

            // Offline mode (Electron or browser): download ELP file
            // Online mode: save to server with progress modal
            if (eXeLearning.config.isOfflineInstallation) {
                eXeLearning.app.menus.navbar.file.downloadProjectEvent();
            } else {
                await this.saveToServer();
            }
        });
    }

    /**
     * Save project to server using SaveManager with progress modal
     */
    async saveToServer() {
        this.isSaving = true;
        this.setButtonLoading(true);

        try {
            const bridge = eXeLearning.app.project._yjsBridge;

            if (!bridge || !bridge.saveManager) {
                console.warn('[SaveButton] SaveManager not available, using legacy save');
                await eXeLearning.app.project.save();
                return;
            }

            const result = await bridge.saveManager.save({
                showProgress: true,
            });

            if (result.success) {
                Logger.log('[SaveButton] Project saved successfully');
            } else {
                console.error('[SaveButton] Save failed:', result.error);
            }
        } catch (error) {
            console.error('[SaveButton] Save error:', error);
        } finally {
            this.isSaving = false;
            this.setButtonLoading(false);
        }
    }

    /**
     * Set button loading state
     * @param {boolean} loading
     */
    setButtonLoading(loading) {
        if (!this.saveMenuHeadButton) return;

        if (loading) {
            this.saveMenuHeadButton.classList.add('saving');
            this.saveMenuHeadButton.setAttribute('disabled', 'disabled');
        } else {
            this.saveMenuHeadButton.classList.remove('saving');
            this.saveMenuHeadButton.removeAttribute('disabled');
        }
    }
}
