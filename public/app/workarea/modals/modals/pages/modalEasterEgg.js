import Modal from '../modal.js';
import AulaSecreta3D from '../../../easteregg/aulaSecreta3d.js';

export default class ModalEasterEgg extends Modal {
    constructor(manager) {
        const id = 'modalEasterEgg';
        const titleDefault = 'Aula Secreta';
        super(manager, id, titleDefault, false);

        this._initialized = false;
        this.game = null;
    }

    behaviour() {
        super.behaviour();
        this.initEasterEgg();
    }

    initEasterEgg() {
        if (this._initialized) return;
        this._initialized = true;

        this.canvas = this.modalElement.querySelector('[data-easteregg="canvas"]');
        this.statsEl = this.modalElement.querySelector('[data-easteregg="stats"]');
        this.timerEl = this.modalElement.querySelector('[data-easteregg="timer"]');
        this.overlayEl = this.modalElement.querySelector('[data-easteregg="overlay"]');
        this.overlayTitleEl = this.modalElement.querySelector('[data-easteregg="overlay-title"]');
        this.overlayTextEl = this.modalElement.querySelector('[data-easteregg="overlay-text"]');
        this.startButton = this.modalElement.querySelector('[data-easteregg="start"]');
        this.closeButton = this.modalElement.querySelector('[data-easteregg="close"]');

        if (this.canvas) {
            this.canvas.setAttribute('tabindex', '0');
        }

        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.startGame();
        });

        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.stopGame();
        });
    }

    show() {
        this.titleDefault = 'Aula Secreta';
        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.modal.show();
        }, time);
    }

    startGame() {
        if (!this.game) {
            this.game = new AulaSecreta3D({
                canvas: this.canvas,
                statsEl: this.statsEl,
                timerEl: this.timerEl,
                overlayEl: this.overlayEl,
                overlayTitleEl: this.overlayTitleEl,
                overlayTextEl: this.overlayTextEl,
                startButton: this.startButton,
                closeButton: this.closeButton,
                onClose: () => this.close(true),
            });
        }
        this.game.start();
    }

    stopGame() {
        this.game?.stop();
    }
}

