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
        // Testing: explicit visibility flag
        this.loadingScreenNode.setAttribute('data-visible', 'true');
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
            // Clear any inline display style so CSS .hide class can take effect
            this.loadingScreenNode.style.display = '';
            // Testing: explicit visibility flag
            this.loadingScreenNode.setAttribute('data-visible', 'false');
        }, this.hideTime);
    }
}
