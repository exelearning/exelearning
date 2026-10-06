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

        // A previous iDevice saved from TinyMCE fullscreen can leave a stale
        // `tox-fullscreen` class on <html>/<body> (the editor is destroyed before
        // fullscreen's own teardown runs). That keeps the document scroll-locked
        // and, via the defensive CSS guard, suspends this focus layout. Clear it
        // before laying out the new editor so each iDevice starts from a clean
        // state. See _clearStaleTinymceFullscreen().
        this._clearStaleTinymceFullscreen();

        // The focused box is `position:absolute; inset:0` inside
        // #node-content-container, so it only aligns with the visible viewport
        // when the container is not scrolled. Any residual scroll (e.g. the user
        // scrolled down to a lower iDevice, or the engine scrolled to a just-saved
        // one) would otherwise render the overlay off-screen above the fold,
        // making the editor invisible while it is still in edition. Pin the
        // container to the top; savedScrollTop is restored on exit. (Refs #1871.)
        if (this.nodeContentContainer) this.nodeContentContainer.scrollTop = 0;

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

        // The iDevice leaving edition tears down its editor; if it was in TinyMCE
        // fullscreen, the `tox-fullscreen` class can outlive the editor and keep
        // the document scroll-locked. Clear any such stale state on exit too.
        this._clearStaleTinymceFullscreen();

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
     * Mark the global header controls as unavailable while an iDevice is open.
     *
     * This is a visual + tooltip cue only (a dimmed class and an explanatory
     * `title`). We intentionally do NOT set `aria-disabled` or the `disabled`
     * attribute: the control must stay clickable so the existing
     * `checkOpenIdevice()` guard can show its "save or discard first" alert,
     * exactly as outside focus mode. (`aria-disabled`/`disabled` would also make
     * the control unactionable for automated tooling.)
     *
     * @param {boolean} disabled
     */
    _setGlobalControlsDisabled(disabled) {
        const message = _('Save or discard the open iDevice before saving the project.');
        CONTROL_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (disabled) {
                el.classList.add(CONTROL_DISABLED_CLASS);
                if (el.dataset.exeFocusOriginalTitle === undefined) {
                    el.dataset.exeFocusOriginalTitle = el.getAttribute('title') || '';
                }
                el.setAttribute('title', message);
            } else {
                el.classList.remove(CONTROL_DISABLED_CLASS);
                if (el.dataset.exeFocusOriginalTitle !== undefined) {
                    el.setAttribute('title', el.dataset.exeFocusOriginalTitle);
                    delete el.dataset.exeFocusOriginalTitle;
                }
            }
        });
    }

    /**
     * Remove a stale TinyMCE `tox-fullscreen` class from `<html>`/`<body>`.
     *
     * TinyMCE's fullscreen plugin toggles `tox-fullscreen` on the editor element
     * *and* on `<html>`/`<body>` (which adds `overflow:hidden`, locking document
     * scroll). When an iDevice is saved/discarded while TinyMCE is in fullscreen,
     * the editor is destroyed before the plugin's own teardown runs, so the
     * document-level class is never removed. The next iDevice then opens with the
     * page scroll-locked and — via the `.tox-fullscreen` CSS guard in
     * _idevice-focus.scss — its focus layout suspended, so it renders off-screen.
     *
     * A *live* fullscreen editor always keeps `tox-fullscreen` on its own
     * `.tox-tinymce` element, so we only strip the document-level class when no
     * such element exists — never interfering with a genuinely active fullscreen.
     */
    _clearStaleTinymceFullscreen() {
        if (document.querySelector('.tox-tinymce.tox-fullscreen')) return;
        document.documentElement.classList.remove('tox-fullscreen');
        document.body.classList.remove('tox-fullscreen');
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
