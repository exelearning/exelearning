import Modal from '../modal.js';

export default class ModalAbout extends Modal {
    constructor(manager) {
        const id = 'modalAbout';
        const titleDefault = undefined;
        super(manager, id, titleDefault, false);

        this._easterEggState = {
            clickCount: 0,
            lastClickAt: 0,
            keyIndex: 0,
            lastKeyAt: 0,
            triggered: false,
        };
        this._easterEggPhrase = ['a', 'u', 'l', 'a'];
        this._easterEggInitialized = false;
    }

    behaviour() {
        super.behaviour();
        this.initEasterEgg();
    }

    initEasterEgg() {
        if (this._easterEggInitialized) return;
        this._easterEggInitialized = true;

        this.logoEl = this.modalElement.querySelector('.exe-logo');

        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.resetEasterEggState();
        });

        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.resetEasterEggState();
        });

        if (this.logoEl) {
            this.logoEl.addEventListener('click', () => this.onLogoClick());
        }

        window.addEventListener('keydown', (event) => this.onKeyDown(event));
    }

    resetEasterEggState() {
        this._easterEggState.clickCount = 0;
        this._easterEggState.lastClickAt = 0;
        this._easterEggState.keyIndex = 0;
        this._easterEggState.lastKeyAt = 0;
        this._easterEggState.triggered = false;
    }

    isAboutOpen() {
        return this.modalElement?.getAttribute('data-open') === 'true';
    }

    onLogoClick() {
        if (!this.isAboutOpen() || this._easterEggState.triggered) return;

        const now = Date.now();
        const resetAfterMs = 900;
        const requiredClicks = 7;

        if (now - this._easterEggState.lastClickAt > resetAfterMs) {
            this._easterEggState.clickCount = 0;
        }
        this._easterEggState.lastClickAt = now;
        this._easterEggState.clickCount++;

        if (this._easterEggState.clickCount >= requiredClicks) {
            this.triggerEasterEgg();
        }
    }

    onKeyDown(event) {
        if (!this.isAboutOpen() || this._easterEggState.triggered) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const key =
            typeof event.key === 'string' && event.key.length === 1
                ? event.key.toLowerCase()
                : null;
        if (!key) return;

        const now = Date.now();
        const resetAfterMs = 1200;
        if (now - this._easterEggState.lastKeyAt > resetAfterMs) {
            this._easterEggState.keyIndex = 0;
        }
        this._easterEggState.lastKeyAt = now;

        const expected = this._easterEggPhrase[this._easterEggState.keyIndex];

        if (key === expected) {
            this._easterEggState.keyIndex++;
            if (this._easterEggState.keyIndex >= this._easterEggPhrase.length) {
                this.triggerEasterEgg();
            }
            return;
        }

        this._easterEggState.keyIndex = key === this._easterEggPhrase[0] ? 1 : 0;
    }

    triggerEasterEgg() {
        if (this._easterEggState.triggered) return;
        this._easterEggState.triggered = true;

        const openEgg = () => {
            this.modalElement.removeEventListener('hidden.bs.modal', openEgg);
            this.manager?.easteregg?.show();
        };

        this.modalElement.addEventListener('hidden.bs.modal', openEgg);
        this.close(true);
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        // Set title
        this.titleDefault = _('About eXeLearning');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            this.setTitle(this.titleDefault);
            this.modal.show();
        }, time);
    }
}
