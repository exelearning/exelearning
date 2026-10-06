/**
 * Tests for CollaborativeAutosaveManager (issue #1592).
 *
 * Test helpers (describe/it/expect/vi/beforeEach/afterEach) are exposed as
 * globals by public/vitest.setup.js, and `mock`/`spyOn` are the bun:test
 * compatibility aliases for vi.fn/vi.spyOn. Real Yjs is not needed here — the
 * manager only talks to the document manager's hand-rolled emitter and the
 * save manager, both of which we mock as plain objects.
 */

const CollaborativeAutosaveManager = require('./CollaborativeAutosaveManager');

/**
 * Minimal stand-in for YjsDocumentManager: the on/off/emit registry plus the
 * dirty/presence accessors the autosave manager relies on.
 */
function makeDocManager(overrides = {}) {
    const listeners = {};
    const dm = {
        config: { offline: false },
        wsProvider: { wsconnected: true, synced: true },
        synced: true,
        isDirty: false,
        _users: [],
        on(event, cb) {
            (listeners[event] = listeners[event] || []).push(cb);
        },
        off(event, cb) {
            listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
        },
        emit(event, data) {
            (listeners[event] || []).slice().forEach((cb) => cb(data));
        },
        hasUnsavedChanges() {
            return this.isDirty === true;
        },
        getOnlineUsers() {
            return this._users;
        },
        onUsersChange(cb) {
            this.on('usersChange', cb);
            return () => this.off('usersChange', cb);
        },
        ...overrides,
    };
    dm._listeners = listeners;
    return dm;
}

/**
 * Build a bridge whose capabilities/documentManager/saveManager are all
 * controllable. By default it is a fully eligible collaborative session.
 */
function makeBridge(overrides = {}) {
    const documentManager = overrides.documentManager || makeDocManager();
    const saveManager =
        overrides.saveManager ||
        {
            isSaving: false,
            save: vi.fn().mockImplementation(async () => {
                // Simulate a successful save: SaveManager calls markClean() which
                // flips isDirty and emits the 'saved' event.
                documentManager.isDirty = false;
                documentManager.emit('saveStatus', { status: 'saved', isDirty: false });
                return { success: true };
            }),
        };
    return {
        app: {
            capabilities: {
                collaboration: { enabled: true },
                storage: { remote: true },
            },
        },
        documentManager,
        saveManager,
        ...overrides,
    };
}

/** Mark a remote collaborator as present in the session. */
function addCollaborator(documentManager) {
    documentManager._users = [
        { clientId: 1, isLocal: true },
        { clientId: 2, isLocal: false },
    ];
    documentManager.emit('usersChange', { users: documentManager._users });
}

/** Flip the document to dirty and emit the one-shot 'dirty' transition event. */
function makeDirty(documentManager) {
    documentManager.isDirty = true;
    documentManager.emit('saveStatus', { status: 'dirty', isDirty: true });
}

const OPTIONS = { idleDelayMs: 10000, retryBaseMs: 2000, maxRetries: 3 };

describe('CollaborativeAutosaveManager', () => {
    let bridge;
    let manager;
    let onStatusChange;

    beforeEach(() => {
        vi.useFakeTimers();
        onStatusChange = vi.fn();
        bridge = makeBridge();
        manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange });
    });

    afterEach(() => {
        if (manager && typeof manager.destroy === 'function') {
            manager.destroy();
        }
        vi.useRealTimers();
    });

    describe('scheduling', () => {
        it('schedules a save after the idle delay following a dirty change', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            expect(bridge.saveManager.save).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);

            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
            expect(bridge.saveManager.save).toHaveBeenCalledWith({
                showProgress: false,
                silent: true,
                reason: 'collaborative-autosave',
            });
        });

        it('debounce resets on repeated changes (only one save runs)', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            bridge.documentManager.isDirty = true;

            manager.scheduleSave();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs - 1);
            manager.scheduleSave(); // reset the debounce window
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs - 1);

            // Total elapsed > idleDelay, but never idle for a full window.
            expect(bridge.saveManager.save).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });

        it('schedules immediately on start() when already dirty and eligible', async () => {
            bridge.documentManager._users = [{ clientId: 2, isLocal: false }];
            bridge.documentManager.isDirty = true;

            manager.start();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);

            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('mode gating', () => {
        it('does not autosave when remote storage is unavailable (static/offline)', async () => {
            bridge.app.capabilities.storage.remote = false;
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave when collaboration capability is disabled', async () => {
            bridge.app.capabilities.collaboration.enabled = false;
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave when the websocket provider is absent', async () => {
            bridge.documentManager.wsProvider = null;
            bridge.documentManager.synced = false;
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave when the document manager is offline', async () => {
            bridge.documentManager.config.offline = true;
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });
    });

    describe('collaborator gating', () => {
        it('does not autosave before any other collaborator has been present', async () => {
            manager.start();
            makeDirty(bridge.documentManager); // no collaborator yet

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('autosaves once a collaborator appears while changes are pending', async () => {
            manager.start();
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();

            addCollaborator(bridge.documentManager); // collaborator joins now
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });

        it('keeps autosaving after a collaborator who was present has left', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            // Collaborator leaves: only the local user remains.
            bridge.documentManager._users = [{ clientId: 1, isLocal: true }];
            bridge.documentManager.emit('usersChange', { users: bridge.documentManager._users });

            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);

            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('overlap prevention', () => {
        it('does not start a second autosave while one is running', async () => {
            let resolveSave;
            bridge.saveManager.save = vi.fn().mockReturnValue(
                new Promise((resolve) => {
                    resolveSave = resolve;
                })
            );

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            // A second window elapses while the first save is still in flight.
            manager.scheduleSave();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            resolveSave({ success: true });
            await vi.advanceTimersByTimeAsync(0);
        });

        it('runs a follow-up save after the in-flight one if still dirty', async () => {
            let resolveSave;
            bridge.saveManager.save = vi.fn().mockImplementation(() => {
                bridge.saveManager.isSaving = true;
                return new Promise((resolve) => {
                    resolveSave = () => {
                        bridge.saveManager.isSaving = false;
                        resolve({ success: true });
                    };
                });
            });

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            // More edits arrive during the save; document stays dirty.
            manager.scheduleSave();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            // Finish the first save; the pending follow-up should run.
            bridge.documentManager.isDirty = true; // remained dirty
            resolveSave();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(2);
        });
    });

    describe('failure handling', () => {
        it('retries a failed autosave after a backoff delay', async () => {
            bridge.saveManager.save = vi.fn().mockResolvedValue({ success: false, error: 'boom' });

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(OPTIONS.retryBaseMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(2);
        });

        it('reports failure through the status callback', async () => {
            bridge.saveManager.save = vi.fn().mockRejectedValue(new Error('network down'));

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(onStatusChange).toHaveBeenCalledWith('failed');
        });

        it('stops retrying after the maximum number of attempts', async () => {
            bridge.saveManager.save = vi.fn().mockResolvedValue({ success: false, error: 'boom' });

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            // Run far past every backoff window.
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            for (let i = 0; i < 10; i++) {
                await vi.advanceTimersByTimeAsync(OPTIONS.retryBaseMs * Math.pow(2, i));
            }

            // 1 initial attempt + maxRetries retries, then it gives up.
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(OPTIONS.maxRetries + 1);
        });

        it('leaves the document dirty when autosave fails', async () => {
            bridge.saveManager.save = vi.fn().mockResolvedValue({ success: false, error: 'boom' });

            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.documentManager.hasUnsavedChanges()).toBe(true);
            expect(manager.getPhase()).toBe('failed');
        });
    });

    describe('success handling', () => {
        it('marks the document clean after a successful autosave', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.documentManager.hasUnsavedChanges()).toBe(false);
            expect(manager.getPhase()).toBe('clean');
        });

        it('emits pending then saving then clean status transitions', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);
            expect(onStatusChange).toHaveBeenCalledWith('pending');

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            const phases = onStatusChange.mock.calls.map((c) => c[0]);
            expect(phases).toContain('saving');
            expect(phases).toContain('clean');
        });
    });

    describe('manual save interaction', () => {
        it('cancel() discards a pending autosave timer', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            manager.cancel();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('goes clean and cancels the timer when a manual save emits saved', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            // A manual save elsewhere completes and marks the doc clean.
            bridge.documentManager.isDirty = false;
            bridge.documentManager.emit('saveStatus', { status: 'saved', isDirty: false });
            expect(manager.getPhase()).toBe('clean');

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle', () => {
        it('stops timers and detaches listeners on destroy', async () => {
            const offSpy = vi.spyOn(bridge.documentManager, 'off');
            manager.start();
            addCollaborator(bridge.documentManager);
            makeDirty(bridge.documentManager);

            manager.destroy();

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
            expect(offSpy).toHaveBeenCalledWith('saveStatus', expect.any(Function));
        });

        it('ignores dirty events emitted after destroy', async () => {
            manager.start();
            addCollaborator(bridge.documentManager);
            manager.destroy();

            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('falls back to documentManager.isDirty when hasUnsavedChanges is unavailable', async () => {
            const dm = makeDocManager();
            delete dm.hasUnsavedChanges;
            const otherBridge = makeBridge({ documentManager: dm });
            const otherManager = new CollaborativeAutosaveManager(otherBridge, { ...OPTIONS });

            otherManager.start();
            addCollaborator(dm);
            dm.isDirty = true;
            dm.emit('saveStatus', { status: 'dirty', isDirty: true });

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(otherBridge.saveManager.save).toHaveBeenCalledTimes(1);
            otherManager.destroy();
        });

        it('start() is idempotent and does not double-subscribe', () => {
            const onSpy = vi.spyOn(bridge.documentManager, 'on');
            manager.start();
            manager.start();
            const saveStatusSubscriptions = onSpy.mock.calls.filter((c) => c[0] === 'saveStatus');
            expect(saveStatusSubscriptions).toHaveLength(1);
        });
    });
});
