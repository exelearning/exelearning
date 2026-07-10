/**
 * CollaborativeSaveStatusView
 *
 * Focused presentation layer for the collaborative autosave status (issue
 * #1592). It is a UI hotfix follow-up to PR #1985: that PR communicated the
 * autosave state through a persistent full-sentence pill in the top toolbar
 * (#exe-collab-save-status), which consumed too much horizontal space next to
 * Save, Preview, Styles, Settings, Share, the concurrent-user list and the user
 * menu. This view keeps exactly the same autosave behaviour but renders the
 * state compactly.
 *
 * It translates the DOM-free CollaborativeAutosaveManager phases
 * ('clean' | 'pending' | 'saving' | 'failed') into three accessible surfaces:
 *
 *   1. A small state badge overlaid on the existing Save button
 *      (#head-top-save-button). Each phase uses a distinct glyph SHAPE — not
 *      only a colour — so the state is perceivable without colour (WCAG 1.4.1),
 *      and the badge is absolutely positioned so the button never changes size.
 *   2. A visually-hidden ARIA live region (#exe-collab-save-status,
 *      role="status" aria-live="polite") that keeps screen-reader users
 *      informed of state transitions without occupying any toolbar space.
 *   3. A single error toast, emitted only when autosave reaches the terminal
 *      'failed' state, deduplicated per failure episode and re-armed after a
 *      recovery, so routine pending/saving/clean transitions never toast.
 *
 * This view owns presentation ONLY. It never touches the autosave scheduling,
 * retry, gating, persistence or teardown behaviour, and it deliberately does
 * NOT alter the manual Save button's own dirty/saving/saved semantics. It is a
 * thin, self-contained helper (not a general-purpose status manager) so it can
 * be unit-tested in isolation against a real DOM.
 */

// Element hooks shared with the Nunjucks template and the SCSS.
const SAVE_BUTTON_ID = 'head-top-save-button';
const LIVE_REGION_ID = 'exe-collab-save-status';
const BADGE_SELECTOR = '.collab-autosave-badge';

/**
 * Per-phase visual badge configuration. `glyph` is a Material Icons Round
 * ligature (rendered through --icons-ff by the SCSS); the shapes are distinct
 * so the phase is legible without relying on colour. `busy` drives aria-busy on
 * the Save button while a collaborative save is in flight.
 */
const PHASE_BADGES = {
    clean: { glyph: 'check', busy: false },
    pending: { glyph: 'cloud_upload', busy: false },
    saving: { glyph: 'sync', busy: true },
    failed: { glyph: 'priority_high', busy: false },
};

class CollaborativeSaveStatusView {
    /**
     * @param {Object} [deps] - Injectable dependencies (all optional; sensible
     *   browser defaults are used when omitted). Injecting them keeps the view
     *   unit-testable without touching globals.
     * @param {Document} [deps.document] - Document to query.
     * @param {(source: string) => string} [deps.translate] - GUI translator;
     *   defaults to the global `_()`.
     * @param {() => ({createToast: Function}|null)} [deps.getToastManager] -
     *   Resolver for the app's toast manager; defaults to
     *   window.eXeLearning.app.toasts.
     */
    constructor(deps = {}) {
        this._document = deps.document || (typeof document !== 'undefined' ? document : null);
        this._translate = deps.translate || ((source) => (typeof _ === 'function' ? _(source) : source));
        this._getToastManager =
            deps.getToastManager ||
            (() =>
                typeof window !== 'undefined' && window.eXeLearning && window.eXeLearning.app
                    ? window.eXeLearning.app.toasts
                    : null);

        // Failure-toast episode state. The toast is shown once when autosave
        // first fails and stays deduplicated across the manager's retry loop
        // (which re-emits 'failed'); it is re-armed only after a genuine
        // recovery ('clean').
        this._failureToastShown = false;
        this._failureToast = null;
    }

    /**
     * Render a collaborative autosave phase across every surface.
     * @param {('clean'|'pending'|'saving'|'failed'|string)} phase
     */
    setPhase(phase) {
        const badge = PHASE_BADGES[phase];
        this._renderLiveRegion(phase);
        this._renderBadge(phase, badge);
        this._handleToast(phase);
    }

    /**
     * Reset every surface to a neutral state and dismiss any lingering failure
     * toast. Called from the bridge teardown so a destroyed session never
     * leaves a sticky badge or alert behind.
     */
    destroy() {
        this._renderBadge(null, undefined);
        this._clearLiveRegion();
        this._dismissFailureToast();
        this._failureToastShown = false;
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    /**
     * Update the compact Save-button badge and the button's aria-busy flag.
     * @param {?string} phase
     * @param {?{glyph: string, busy: boolean}} badge - undefined for an
     *   unknown/reset phase.
     * @private
     */
    _renderBadge(phase, badge) {
        const button = this._getSaveButton();
        if (!button) return;

        // aria-busy signals an in-progress collaborative save on the control the
        // status describes; removed for every other phase.
        if (badge && badge.busy) {
            button.setAttribute('aria-busy', 'true');
        } else {
            button.removeAttribute('aria-busy');
        }

        const el = typeof button.querySelector === 'function' ? button.querySelector(BADGE_SELECTOR) : null;
        if (!el) return;

        if (!badge) {
            // Unknown/reset phase: hide the badge without revealing anything.
            el.classList.add('d-none');
            el.removeAttribute('data-collab-phase');
            el.removeAttribute('title');
            el.textContent = '';
            return;
        }

        el.textContent = badge.glyph;
        el.setAttribute('data-collab-phase', phase);
        // A hover tooltip for sighted mouse users. The badge is aria-hidden, so
        // this title is never the source of the accessible name/description —
        // that comes from the live region below.
        el.setAttribute('title', this._messageFor(phase));
        el.classList.remove('d-none');
    }

    /**
     * Announce the phase through the visually-hidden live region.
     * @param {string} phase
     * @private
     */
    _renderLiveRegion(phase) {
        const region = this._getLiveRegion();
        if (!region) return;
        const message = this._liveMessageFor(phase);
        // Unknown phase: leave the previous announcement untouched.
        if (message === null) return;
        this._liveContent(region).textContent = message;
    }

    /**
     * The message for the polite live region. On failure the assertive error
     * toast (role="alert") already carries the full, actionable sentence, so the
     * polite region announces only a short status token — otherwise a screen
     * reader would hear the identical sentence twice. Every other phase reuses
     * the full message (there is no competing announcement channel for them).
     * @param {string} phase
     * @returns {?string}
     * @private
     */
    _liveMessageFor(phase) {
        if (phase === 'failed') {
            return this._translate('Autosave failed.');
        }
        return this._messageFor(phase);
    }

    /** @private */
    _clearLiveRegion() {
        const region = this._getLiveRegion();
        if (!region) return;
        this._liveContent(region).textContent = '';
    }

    /**
     * The text sink inside the live region (the `.content` span, falling back to
     * the region itself).
     * @param {Element} region
     * @returns {Element}
     * @private
     */
    _liveContent(region) {
        const content = typeof region.querySelector === 'function' ? region.querySelector('.content') : null;
        return content || region;
    }

    // ---------------------------------------------------------------------
    // Failure toast
    // ---------------------------------------------------------------------

    /**
     * Own the failure-toast lifecycle: show exactly one toast per failure
     * episode, and re-arm + dismiss it once autosave recovers.
     * @param {string} phase
     * @private
     */
    _handleToast(phase) {
        if (phase === 'failed') {
            if (!this._failureToastShown) {
                this._failureToastShown = true;
                this._showFailureToast();
            }
            return;
        }
        if (phase === 'clean') {
            // A genuine recovery (a successful save): re-arm for a later,
            // independent failure and remove the now-stale warning.
            this._failureToastShown = false;
            this._dismissFailureToast();
        }
    }

    /** @private */
    _showFailureToast() {
        const toasts = this._getToastManager();
        if (!toasts || typeof toasts.createToast !== 'function') return;
        // No `remove` timeout: the default toast template does not auto-hide, so
        // this data-loss warning stays visible (and dismissable) until autosave
        // recovers, rather than vanishing before it can be read.
        this._failureToast =
            toasts.createToast({
                title: this._translate('Collaborative autosave failed'),
                body: this._failureMessage(),
                icon: 'error',
                error: true,
            }) || null;
    }

    /** @private */
    _dismissFailureToast() {
        const toast = this._failureToast;
        this._failureToast = null;
        if (toast && typeof toast.remove === 'function') {
            try {
                toast.remove();
            } catch (error) {
                // The toast may have already been dismissed by the user.
            }
        }
    }

    // ---------------------------------------------------------------------
    // Messages
    // ---------------------------------------------------------------------

    /**
     * Localised message for a phase, or null for an unknown phase. The
     * clean/pending/saving strings are reused verbatim from PR #1985 so their
     * existing translations still apply.
     * @param {string} phase
     * @returns {?string}
     * @private
     */
    _messageFor(phase) {
        switch (phase) {
            case 'clean':
                return this._translate('All collaborative changes are saved.');
            case 'pending':
                return this._translate('Collaborative changes are shared live and will be saved automatically.');
            case 'saving':
                return this._translate('Saving collaborative changes...');
            case 'failed':
                return this._failureMessage();
            default:
                return null;
        }
    }

    /**
     * The failure message, phrased for whether a manual Save affordance is
     * available in the current mode (embedded/LMS modes hide the Save button,
     * so telling the user to click Save would be misleading).
     * @returns {string}
     * @private
     */
    _failureMessage() {
        return this._isManualSaveAvailable()
            ? this._translate('Autosave failed. Please click Save before leaving.')
            : this._translate('Autosave failed. Your latest collaborative changes may not be saved.');
    }

    // ---------------------------------------------------------------------
    // DOM lookups
    // ---------------------------------------------------------------------

    /**
     * Whether the manual Save button is present and visible. Some supported
     * modes (platform integration / data-exe-hide-save) hide it entirely.
     * @returns {boolean}
     * @private
     */
    _isManualSaveAvailable() {
        const button = this._getSaveButton();
        if (!button) return false;
        if (button.classList && button.classList.contains('d-none')) return false;

        const doc = this._document;
        const body = doc && doc.body;
        if (body && typeof body.getAttribute === 'function' && body.getAttribute('data-exe-hide-save') === 'true') {
            return false;
        }

        const view = doc && doc.defaultView;
        if (view && typeof view.getComputedStyle === 'function') {
            try {
                if (view.getComputedStyle(button).display === 'none') return false;
            } catch (error) {
                // getComputedStyle can be unavailable in some environments.
            }
        }
        return true;
    }

    /** @private */
    _getSaveButton() {
        return this._document && typeof this._document.getElementById === 'function'
            ? this._document.getElementById(SAVE_BUTTON_ID)
            : null;
    }

    /** @private */
    _getLiveRegion() {
        return this._document && typeof this._document.getElementById === 'function'
            ? this._document.getElementById(LIVE_REGION_ID)
            : null;
    }
}

// The Yjs frontend is plain vanilla JS: expose as a CommonJS export for tests
// and as a global for the browser bundle, matching the sibling modules.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollaborativeSaveStatusView;
} else if (typeof window !== 'undefined') {
    window.CollaborativeSaveStatusView = CollaborativeSaveStatusView;
}
