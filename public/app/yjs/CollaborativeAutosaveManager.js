/**
 * CollaborativeAutosaveManager
 *
 * Conservative autosave coordinator for online collaborative editing sessions
 * (issue #1592). In a Yjs collaborative session every participant sees each
 * other's edits live, which makes the document feel like it autosaves the way
 * Google Docs does. It does not: the shared Yjs state is only persisted when
 * someone explicitly saves. If the last editor closes their tab without saving,
 * the visible collaborative changes are lost.
 *
 * This manager closes that gap by persisting the shared Yjs snapshot after a
 * short idle period, but ONLY in genuine online collaborative sessions. It is
 * deliberately conservative:
 *
 *   - It never runs in static / offline / Electron-packaged mode (no remote
 *     storage), so local-only editing behaviour is unchanged.
 *   - It only activates once another collaborator has been present during the
 *     session, so ordinary single-user online editing is not silently turned
 *     into autosave.
 *   - It never overlaps with another save (manual or automatic).
 *   - It retries failed saves with a bounded backoff rather than tight-looping.
 *
 * Persistence note: autosave uses the SAME explicit save path as the manual
 * Save button (`SaveManager.save`), which encodes the latest Yjs snapshot,
 * uploads pending assets and calls `markClean()`. There is no separate
 * "snapshot-only" persistence — a reopened project reliably contains the latest
 * autosaved collaborative state. The only product distinction is intent: an
 * autosave passes `reason: 'collaborative-autosave'` and is silent (no progress
 * modal), whereas a manual save shows progress. The manual Save button is left
 * completely unchanged; this is purely additive.
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
        this._collaboratorEverPresent = false;
        this._started = false;
        this._destroyed = false;
        this._phase = 'clean';
        this._unsubscribeUsers = null;

        // Stable references so they can be detached with off().
        this._onSaveStatus = this._handleSaveStatus.bind(this);
        this._onUsersChange = this._handleUsersChange.bind(this);
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

        if (typeof dm.onUsersChange === 'function') {
            this._unsubscribeUsers = dm.onUsersChange(this._onUsersChange);
        } else {
            dm.on('usersChange', this._onUsersChange);
        }

        this._refreshCollaboratorPresence();

        // A session may already be dirty (e.g. dirty state restored from a
        // previous reload) by the time autosave starts.
        if (this._isDirty() && this.isEligible()) {
            this._setPhase('pending');
            this.scheduleSave();
        }
    }

    /**
     * Whether the current session is eligible for collaborative autosave:
     * remote storage + collaboration enabled, a live websocket, and at least
     * one other collaborator seen during this session.
     * @returns {boolean}
     */
    isEligible() {
        return this._isModeEligible() && this._collaboratorEverPresent;
    }

    /**
     * Mode-level eligibility (capabilities + live connection), independent of
     * collaborator presence.
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
        if (dm && this._started) {
            if (typeof dm.off === 'function') {
                dm.off('saveStatus', this._onSaveStatus);
            }
            if (this._unsubscribeUsers) {
                this._unsubscribeUsers();
            } else if (typeof dm.off === 'function') {
                dm.off('usersChange', this._onUsersChange);
            }
        }
        this._unsubscribeUsers = null;
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
     * Track collaborator presence. Once another participant has been seen the
     * session stays eligible even after they leave, because any remaining
     * participant can persist the shared state.
     * @param {{users?: Array}} data
     * @private
     */
    _handleUsersChange(data) {
        if (this._destroyed) return;
        const users = (data && data.users) || [];
        const hadCollaborator = this._collaboratorEverPresent;
        if (users.some((u) => u && !u.isLocal)) {
            this._collaboratorEverPresent = true;
        }
        // If a collaborator has just appeared while changes are already pending,
        // arm the autosave that was previously gated out.
        if (!hadCollaborator && this._collaboratorEverPresent && this._isDirty() && this._isModeEligible()) {
            this._setPhase('pending');
            this.scheduleSave();
        }
    }

    /**
     * Read current collaborator presence from awareness (used at start()).
     * @private
     */
    _refreshCollaboratorPresence() {
        const dm = this.bridge && this.bridge.documentManager;
        if (!dm || typeof dm.getOnlineUsers !== 'function') return;
        const others = dm.getOnlineUsers().filter((u) => u && !u.isLocal);
        if (others.length > 0) {
            this._collaboratorEverPresent = true;
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
        if (this.onStatusChange) {
            try {
                this.onStatusChange(phase);
            } catch (error) {
                // A UI listener must never break the autosave loop.
            }
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
