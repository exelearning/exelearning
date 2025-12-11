/**
 * ImportProgress
 * Shows inline progress during ELP import in the workarea content area.
 * Uses similar pattern to existing loadingScreen.js
 * Blocks UI interaction during import to prevent user actions.
 */
export default class ImportProgress {
    constructor() {
        this.containerSelector = '#node-content-container';
        this.element = null;
        // Menu selectors to disable during import
        this.menuSelectors = [
            '#menu_nav',
            '#menuidevices-menu',
            '#listmenuidevices'
        ];
    }

    /**
     * Show progress overlay inline in workarea
     */
    show() {
        const container = document.querySelector(this.containerSelector);
        if (!container) {
            console.warn('[ImportProgress] Container not found:', this.containerSelector);
            return;
        }

        // Remove existing overlay immediately (bypassing hide() animation)
        const existingOverlay = document.querySelector('#import-progress-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        this.element = null;

        // Create progress element
        this.element = document.createElement('div');
        this.element.id = 'import-progress-overlay';
        this.element.className = 'import-progress-overlay';

        const messageText = typeof _ === 'function' ? _('Importing...') : 'Importing...';

        this.element.innerHTML = `
            <div class="import-progress-content">
                <div class="import-progress-spinner"></div>
                <div class="import-progress-message">${messageText}</div>
                <div class="import-progress-bar-container">
                    <div class="import-progress-bar" style="width: 0%"></div>
                </div>
                <div class="import-progress-percent">0%</div>
            </div>
        `;

        // Insert as first child of container
        container.style.position = 'relative';
        container.prepend(this.element);

        // Block UI interaction
        container.classList.add('import-blocking');

        // Disable menus
        this.menuSelectors.forEach(selector => {
            document.querySelector(selector)?.classList.add('disabled');
        });
    }

    /**
     * Update progress display
     * @param {Object} progress - { phase, percent, message }
     */
    update(progress) {
        if (!this.element || !progress) return;

        const messageEl = this.element.querySelector('.import-progress-message');
        const barEl = this.element.querySelector('.import-progress-bar');
        const percentEl = this.element.querySelector('.import-progress-percent');

        if (messageEl && progress.message) {
            messageEl.textContent = progress.message;
        }
        if (barEl && typeof progress.percent === 'number') {
            barEl.style.width = `${progress.percent}%`;
        }
        if (percentEl && typeof progress.percent === 'number') {
            percentEl.textContent = `${Math.round(progress.percent)}%`;
        }
    }

    /**
     * Hide and remove progress overlay
     */
    hide() {
        // Unblock UI interaction
        const container = document.querySelector(this.containerSelector);
        container?.classList.remove('import-blocking');

        // Re-enable menus
        this.menuSelectors.forEach(selector => {
            document.querySelector(selector)?.classList.remove('disabled');
        });

        // Remove overlay with animation
        if (this.element) {
            this.element.classList.add('hiding');
            const el = this.element;
            setTimeout(() => {
                el.remove();
            }, 300);
            this.element = null;
        }
    }
}
