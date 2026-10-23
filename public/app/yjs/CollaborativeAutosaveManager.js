/**
 * CollaborativeAutosaveManager
 *
 * Autosave coordinator for online (cloud) editing sessions. Every browser holds
 * the authoritative Y.Doc, and the server only receives it through the explicit
 * save path. Until issue #2615 that path ran only on a manual Save (plus a
 * best-effort `sendBeacon` on unload that silently fails above 64 KiB), so
 * closing the tab without saving lost the edits once the next fresh tab wiped
 * the local IndexedDB copy. Issue #1592 added this idle autosave for
 * collaborative sessions; #2615 extends it to every online session, so cloud
 * mode persists like Google Docs: edits are saved automatically after a short
 * idle period and the toolbar shows the save state instead of a Save button.
 *
 * Behaviour:
 *
 *   - It never runs in static / offline / Electron mode (no remote storage):
 *     those keep the file-based Save flow unchanged.
 *   - It requires a live WebSocket/synced document so the first autosave never
 *     races the initial load.
 *   - It never overlaps with another save (manual or automatic).
 *   - It retries failed saves with a bounded backoff rather than tight-looping.
 *
 * Persistence note: autosave uses the SAME explicit save path as a manual save
 * (`SaveManager.save`), which encodes the latest Yjs snapshot, uploads pending
 * assets and calls `markClean()`. The only product distinction is intent: an
 * autosave passes `reason: 'collaborative-autosave'` and is silent (no progress
 * toast). A blank project that was never edited never becomes dirty, so it is
 * never autosaved and keeps today's "unsaved project" lifecycle.
 *
 * The manager is intentionally DOM-free so it can be unit-tested in isolation.
 * UI feedback is delivered through the `onStatusChange(phase)` callback, where
 * `phase` is one of: 'clean' | 'pending' | 'saving' | 'failed'.
 */
class CollaborativeAutosaveManager {
    /**
     * @param {Object} bridge - The YjsProjectBridge instance. The manager reads
     *   `bridge.app.capabilities`, `bridge.documentManager` and
     *   `bridge.saveManager` from it.
     * @param {Object} [options]
     * @param {number} [options.idleDelayMs=8000] - Debounce window after the
     *   last change before autosaving.
     * @param {number} [options.retryBaseMs=5000] - Base delay for backoff retry.
     * @param {number} [options.maxRetries=5] - Maximum consecutive retry attempts.
     * @param {(phase: string) => void} [options.onStatusChange] - Notified when
     *   the collaborative save phase changes.
     */
    constructor(bridge, options = {}) {
        this.bridge = bridge;
        this.idleDelayMs = options.idleDelayMs != null ? options.idleDelayMs : 8000;
        this.retryBaseMs = options.retryBaseMs != null ? options.retryBaseMs : 5000;
        this.maxRetries = options.maxRetries != null ? options.maxRetries : 5;
        this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : null;

        this._timer = null;
        this._saveInProgress = false;
        this._pendingAfterSave = false;
        this._retryCount = 0;
        this._started = false;
        this._destroyed = false;
        this._phase = 'clean';
        this._announced = false;

        // Stable references so they can be detached with off().
        this._onSaveStatus = this._handleSaveStatus.bind(this);
        this._onConnectionChange = this._handleConnectionChange.bind(this);
    }

    /**
     * Begin observing the document manager. Safe to call more than once.
     */
    start() {
        if (this._started || this._destroyed) return;
        const dm = this.bridge && this.bridge.documentManager;
        if (!dm || typeof dm.on !== 'function') return;

        this._started = true;
        dm.on('saveStatus', this._onSaveStatus);
        // The WebSocket is usually still connecting when autosave starts, so a
        // dirty state restored from a reload (#2615) must be picked up once the
        // connection is live, not only on the next edit.
        dm.on('sync', this._onConnectionChange);
        dm.on('connectionChange', this._onConnectionChange);

        this._handleConnectionChange();
    }

    /**
     * Whether the current session is eligible for autosave: remote storage +
     * collaboration enabled and a live, synced websocket connection. Presence
     * of other collaborators is irrelevant since issue #2615.
     * @returns {boolean}
     */
    isEligible() {
        return this._isModeEligible();
    }

    /**
     * Mode-level eligibility (capabilities + live connection).
     * @returns {boolean}
     * @private
     */
    _isModeEligible() {
        const caps = this.bridge && this.bridge.app && this.bridge.app.capabilities;
        if (!caps || !caps.collaboration || !caps.collaboration.enabled) return false;
        if (!caps.storage || !caps.storage.remote) return false;

        const dm = this.bridge && this.bridge.documentManager;
        if (!dm) return false;
        if (dm.config && dm.config.offline) return false;

        const ws = dm.wsProvider;
        if (!ws) return false;
        return ws.wsconnected === true || ws.synced === true || dm.synced === true;
    }

    /**
     * (Re)arm the debounced autosave timer. No-op when not eligible, so callers
     * never need to gate the call themselves. Phase is intentionally not changed
     * here — that is the caller's responsibility — so retries can keep the
     * 'failed' notice visible while waiting.
     * @param {Object} [opts]
     * @param {boolean} [opts.retry=false] - Use the backoff delay instead of the
     *   idle delay.
     */
    scheduleSave(opts = {}) {
        if (this._destroyed || !this.isEligible()) return;
        this._clearTimer();
        const delay = opts.retry ? this._retryDelay() : this.idleDelayMs;
        this._timer = setTimeout(() => {
            this._timer = null;
            this._runAutosave();
        }, delay);
    }

    /**
     * Cancel any pending autosave timer. Called when a manual save takes over so
     * a queued autosave does not fire redundantly afterwards.
     */
    cancel() {
        this._clearTimer();
    }

    /**
     * Stop all timers and detach every listener. Must be called from the
     * bridge's disconnect()/teardown so timers never fire against a destroyed
     * document manager.
     */
    destroy() {
        this._destroyed = true;
        this._clearTimer();
        const dm = this.bridge && this.bridge.documentManager;
        if (dm && this._started && typeof dm.off === 'function') {
            dm.off('saveStatus', this._onSaveStatus);
            dm.off('sync', this._onConnectionChange);
            dm.off('connectionChange', this._onConnectionChange);
        }
        this._started = false;
    }

    /** @returns {string} The current collaborative save phase. */
    getPhase() {
        return this._phase;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /**
     * Handle save-status transitions from the document manager.
     * @param {{status: string}} data
     * @private
     */
    _handleSaveStatus(data) {
        if (this._destroyed || !data) return;

        if (data.status === 'dirty') {
            if (!this.isEligible()) return;
            this._setPhase('pending');
            this.scheduleSave();
        } else if (data.status === 'saving') {
            // Emitted by the document manager's own save path; mirror it.
            if (this.isEligible()) this._setPhase('saving');
        } else if (data.status === 'saved') {
            // The document became clean (manual or automatic save). Any queued
            // autosave is now redundant.
            this._retryCount = 0;
            this._pendingAfterSave = false;
            this._clearTimer();
            if (this._isModeEligible()) this._setPhase('clean');
        }
    }

    /**
     * Re-evaluate eligibility when the connection state changes (and once at
     * start). The first time the session is eligible the current phase is
     * announced so the UI shows the autosave state before any edit; a dirty
     * document (restored after a reload, or edited while offline) is scheduled
     * for autosave as soon as the connection is live.
     * @private
     */
    _handleConnectionChange() {
        if (this._destroyed || !this._started || !this.isEligible()) return;
        if (!this._announced) {
            this._announced = true;
            this._notify(this._phase);
        }
        if (this._isDirty() && !this._timer && !this._saveInProgress) {
            this._setPhase('pending');
            this.scheduleSave();
        }
    }

    /**
     * Run a single autosave attempt with overlap protection and retry/backoff.
     * @private
     */
    async _runAutosave() {
        if (this._destroyed || !this.isEligible()) return;
        const dm = this.bridge.documentManager;
        const sm = this.bridge.saveManager;
        if (!dm || !sm || typeof sm.save !== 'function') return;

        // Never overlap with another save — autosave or manual. Remember that a
        // save is still wanted and run it once the current one finishes.
        if (this._saveInProgress || sm.isSaving) {
            this._pendingAfterSave = true;
            return;
        }

        if (!this._isDirty()) {
            this._setPhase('clean');
            return;
        }

        this._saveInProgress = true;
        this._setPhase('saving');

        let result;
        try {
            result = await sm.save({ showProgress: false, silent: true, reason: 'collaborative-autosave' });
        } catch (error) {
            result = { success: false, error: error && error.message ? error.message : String(error) };
        }
        this._saveInProgress = false;

        if (result && result.success) {
            this._retryCount = 0;
            if (this._pendingAfterSave || this._isDirty()) {
                // More edits arrived while saving; schedule another idle save.
                this._pendingAfterSave = false;
                this._setPhase('pending');
                this.scheduleSave();
            } else {
                this._setPhase('clean');
            }
        } else {
            this._pendingAfterSave = false;
            this._setPhase('failed');
            if (this._retryCount < this.maxRetries) {
                this.scheduleSave({ retry: true });
                this._retryCount += 1;
            }
            // Otherwise give up retrying and leave the 'failed' notice up; the
            // user must save manually, and the beforeunload warning still fires.
        }
    }

    /**
     * Exponential backoff delay for the current retry attempt, capped so the
     * interval never grows without bound.
     * @returns {number}
     * @private
     */
    _retryDelay() {
        const exponent = Math.min(this._retryCount, 4);
        return this.retryBaseMs * Math.pow(2, exponent);
    }

    /** @returns {boolean} @private */
    _isDirty() {
        const dm = this.bridge && this.bridge.documentManager;
        if (!dm) return false;
        if (typeof dm.hasUnsavedChanges === 'function') return dm.hasUnsavedChanges() === true;
        return dm.isDirty === true;
    }

    /** @private */
    _clearTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /**
     * Update the phase and notify the listener, but only on an actual change.
     * @param {string} phase
     * @private
     */
    _setPhase(phase) {
        if (this._phase === phase) return;
        this._phase = phase;
        this._notify(phase);
    }

    /**
     * Deliver a phase to the listener (used by _setPhase and for the one-off
     * announcement once the session becomes eligible).
     * @param {string} phase
     * @private
     */
    _notify(phase) {
        if (!this.onStatusChange) return;
        try {
            this.onStatusChange(phase);
        } catch (error) {
            // A UI listener must never break the autosave loop.
        }
    }
}

// The Yjs frontend is plain vanilla JS: expose as a CommonJS export for tests
// and as a global for the browser bundle, matching the sibling modules.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollaborativeAutosaveManager;
} else if (typeof window !== 'undefined') {
    window.CollaborativeAutosaveManager = CollaborativeAutosaveManager;
}
