let Tooltip;

/** Create editor tooltips with the same lifecycle for native and former jQuery callers. */
export default function createTooltip(element, options) {
    if (!Tooltip) {
        Tooltip = class extends window.bootstrap.Tooltip {
            show() {
                // Bootstrap throws before show.bs.tooltip, including from its delayed hover callback.
                if (!this._element?.isConnected || !this._element.getClientRects().length ||
                    getComputedStyle(this._element).visibility !== 'visible') {
                    this.hide();
                    return;
                }
                super.show();
            }

            hide() {
                // Bootstrap's hide() returns early before a tooltip has appeared. Cancel its
                // pending show too, so clicks/modal closure cannot reopen a hidden trigger.
                clearTimeout(this._timeout);
                this._isHovered = false;
                this._activeTrigger = {};
                super.hide();
            }
        };
    }
    return Tooltip.getOrCreateInstance(element, options);
}
