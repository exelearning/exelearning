// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * Class names and element ids used by the focused-edit experiment.
 * Centralised so the whole feature can be reasoned about (and reverted) in one place.
 */
const BODY_CLASS = 'exe-idevice-focus-editing';
const NODE_CLASS = 'idevice-node--focused-editing';
const CONTROL_DISABLED_CLASS = 'exe-disabled-during-focus';
const LIVE_REGION_ID = 'exe-focus-editing-live';

/**
 * Global header controls that should be visually disabled while an iDevice is
 * open for editing. The authoritative guard remains `checkOpenIdevice()` in the
 * save/download/share handlers — this layer only adds an accessible, visible
 * "disabled" affordance so the user understands why the action is unavailable.
 */
const CONTROL_IDS = [
    'head-top-download-button',
    'head-top-save-button',
    'head-bottom-preview',
    'dropdownStyles',
    'head-top-settings-button',
    'head-top-share-button',
    'mobile-navbar-button-download-project',
    'mobile-navbar-button-export-web',
];

/**
 * Experimental "focused full-workarea iDevice edit mode".
 *
 * When an iDevice enters edit mode the engine sets `mode="edition"` on
 * `#node-content` (IdevicesEngine.updateMode). This module listens for that
 * single attribute via a MutationObserver — decoupled from the iDevice
 * save/discard/delete lifecycle — and toggles a focused editing layout:
 *
 *  - the editor fills the content workarea, outer scroll is locked;
 *  - the iDevice action toolbar stays pinned at the top;
 *  - only the editor body scrolls;
 *  - global Save/Download/Share controls are visually disabled with an
 *    accessible explanation.
 *
 * All layout is driven by CSS keyed on `body.exe-idevice-focus-editing`
 * (assets/styles/layout/_idevice-focus.scss). This is the final editing
 * behaviour: it is always active and not configurable.
 *
 * Related issues: #1811, #1411.
 */
export default class FocusedEditMode {
    constructor(app) {
        this.app = app;
        this.observer = null;
        this.nodeContent = null;
        this.nodeContentContainer = null;
        this.liveRegion = null;
        /** The iDevice node currently in focused edit mode, or null. */
        this.activeNode = null;
        /** Element that had focus before entering, restored on exit. */
        this.previousFocus = null;
        /** Outer workarea scroll position saved on enter, restored on exit. */
        this.savedScrollTop = 0;
    }

    /**
     * Start observing iDevice edit-mode transitions. No-op only when the
     * content node is not present (e.g. a page without the workarea canvas).
     */
    init() {
        this.nodeContent = document.querySelector('#node-content');
        if (!this.nodeContent) {
            Logger.log('[FocusedEditMode] #node-content not found; not initialising');
            return;
        }

        this.observer = new MutationObserver(() => this._sync());
        this.observer.observe(this.nodeContent, {
            attributes: true,
            attributeFilter: ['mode'],
        });

        // Sync once in case an iDevice is already in edition at init time.
        this._sync();
    }

    /**
     * Reconcile the focused-edit state with the DOM. Idempotent: entering and
     * exiting only fire on real transitions, which also absorbs the duplicate
     * `updateMode()` calls in `loadInitScriptIdevice`.
     */
    _sync() {
        const node = this._getEditingNode();
        if (node === this.activeNode) return;
        if (this.activeNode) this.exit(this.activeNode);
        if (node) this.enter(node);
    }

    /**
     * @returns {HTMLElement|null} the iDevice node currently in edition mode.
     */
    _getEditingNode() {
        if (!this.nodeContent) return null;
        return this.nodeContent.querySelector('div.idevice_node[mode="edition"]');
    }

    /**
     * Enter focused edit mode for the given iDevice node.
     *
     * @param {HTMLElement} node
     */
    enter(node) {
        this.activeNode = node;

        // Preserve context so we can restore it on exit.
        this.nodeContentContainer =
            this.nodeContentContainer || document.querySelector('#node-content-container');
        this.savedScrollTop = this.nodeContentContainer ? this.nodeContentContainer.scrollTop : 0;
        this.previousFocus = document.activeElement;

        document.body.classList.add(BODY_CLASS);
        node.classList.add(NODE_CLASS);
        this._setGlobalControlsDisabled(true);
        this._announce(_('Editing iDevice. Other actions are disabled until you save or discard.'));

        // Intentionally do NOT move focus here. The editor (e.g. TinyMCE) manages
        // its own focus as it initialises; stealing focus to the node could
        // disrupt that for freshly-added iDevices. The polite live region above
        // already announces the focused-editing state to assistive tech.
    }

    /**
     * Leave focused edit mode and restore the normal layout, scroll and focus.
     *
     * @param {HTMLElement} node
     */
    exit(node) {
        document.body.classList.remove(BODY_CLASS);
        if (node) {
            node.classList.remove(NODE_CLASS);
            node.removeAttribute('tabindex');
        }
        this._setGlobalControlsDisabled(false);
        this._announce(_('Finished editing the iDevice.'));

        const previousFocus = this.previousFocus;
        const savedScrollTop = this.savedScrollTop;

        // Restore focus/scroll after the engine has rebuilt the export view and
        // performed any of its own scrolling. Best-effort; the engine wins if it
        // also scrolls (e.g. goWindowToIdevice on save).
        const restore = () => {
            const editButton = node ? node.querySelector('.btn-edit-idevice') : null;
            const target =
                editButton ||
                (previousFocus && document.contains(previousFocus) ? previousFocus : null);
            if (target && typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
            }
            if (this.nodeContentContainer && this.nodeContentContainer.scrollTop === 0) {
                this.nodeContentContainer.scrollTop = savedScrollTop;
            }
        };
        requestAnimationFrame(() => requestAnimationFrame(restore));

        this.activeNode = null;
        this.previousFocus = null;
    }

    /**
     * Toggle the visible/accessible disabled state on the global header
     * controls. Uses `aria-disabled` + a class (never the `disabled` attribute,
     * which `saveButton.js` manages itself during a save).
     *
     * @param {boolean} disabled
     */
    _setGlobalControlsDisabled(disabled) {
        const message = _('Save or discard the open iDevice before saving the project.');
        CONTROL_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (disabled) {
                el.setAttribute('aria-disabled', 'true');
                el.classList.add(CONTROL_DISABLED_CLASS);
                if (el.dataset.exeFocusOriginalTitle === undefined) {
                    el.dataset.exeFocusOriginalTitle = el.getAttribute('title') || '';
                }
                el.setAttribute('title', message);
            } else {
                el.removeAttribute('aria-disabled');
                el.classList.remove(CONTROL_DISABLED_CLASS);
                if (el.dataset.exeFocusOriginalTitle !== undefined) {
                    el.setAttribute('title', el.dataset.exeFocusOriginalTitle);
                    delete el.dataset.exeFocusOriginalTitle;
                }
            }
        });
    }

    /**
     * Announce a message to assistive technology via a polite live region.
     *
     * @param {string} msg
     */
    _announce(msg) {
        this._ensureLiveRegion();
        this.liveRegion.textContent = msg;
    }

    /**
     * Lazily create the visually-hidden polite live region used for
     * enter/exit announcements.
     */
    _ensureLiveRegion() {
        if (this.liveRegion && document.contains(this.liveRegion)) return;
        let region = document.getElementById(LIVE_REGION_ID);
        if (!region) {
            region = document.createElement('div');
            region.id = LIVE_REGION_ID;
            region.className = 'visually-hidden';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'true');
            document.body.appendChild(region);
        }
        this.liveRegion = region;
    }

    /**
     * Stop observing and exit focused mode if active. Used for teardown/tests.
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.activeNode) {
            this.exit(this.activeNode);
        }
    }
}
