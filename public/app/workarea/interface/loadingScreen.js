export default class LoadingScreen {
    constructor() {
        this.loadingScreenNode = document.querySelector(
            '#main > #load-screen-main'
        );
        this.hideTime = 1000;
    }

    /**
     *
     */
    show() {
        this.loadingScreenNode.classList.remove('hide');
        this.loadingScreenNode.classList.add('loading');
    }

    /**
     *
     */
    hide() {
        this.loadingScreenNode.classList.remove('loading');
        this.loadingScreenNode.classList.add('hiding');
        setTimeout(() => {
            this.loadingScreenNode.classList.remove('hiding');
            this.loadingScreenNode.classList.add('hide');
        }, this.hideTime);
    }
}
