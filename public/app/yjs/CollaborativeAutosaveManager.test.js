/**
 * Tests for CollaborativeAutosaveManager (issues #1592 and #2615).
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
        ...overrides,
    };
    dm._listeners = listeners;
    return dm;
}

/**
 * Build a bridge whose capabilities/documentManager/saveManager are all
 * controllable. By default it is a fully eligible online (cloud) session.
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
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave when collaboration capability is disabled', async () => {
            bridge.app.capabilities.collaboration.enabled = false;
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave when the websocket provider is absent', async () => {
            bridge.documentManager.wsProvider = null;
            bridge.documentManager.synced = false;
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('does not autosave after the socket closed even though the document manager once synced', async () => {
            // y-websocket resets its own flags on close; dm.synced is never reset.
            bridge.documentManager.wsProvider = { wsconnected: false, synced: false };
            bridge.documentManager.synced = true;
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
            expect(manager.isEligible()).toBe(false);
        });

        it('does not autosave when the document manager is offline', async () => {
            bridge.documentManager.config.offline = true;
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });
    });

    describe('single-user online sessions (issue #2615)', () => {
        it('autosaves without any other collaborator ever being present', async () => {
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
            expect(bridge.saveManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ silent: true, showProgress: false, reason: 'collaborative-autosave' }),
            );
        });

        it('isEligible() depends only on the runtime mode and a live connection', () => {
            expect(manager.isEligible()).toBe(true);
            bridge.documentManager.wsProvider = { wsconnected: false, synced: false };
            bridge.documentManager.synced = false;
            expect(manager.isEligible()).toBe(false);
        });

        it('ignores presence events (they no longer gate autosave)', async () => {
            manager.start();
            bridge.documentManager.emit('usersChange', { users: [{ clientId: 1, isLocal: true }] });
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('connection-aware start (issue #2615)', () => {
        function makeDisconnectedBridge() {
            const dm = makeDocManager({ wsProvider: { wsconnected: false, synced: false }, synced: false });
            return makeBridge({ documentManager: dm });
        }

        it('announces the current phase once at start when already eligible', () => {
            manager.start();
            expect(onStatusChange).toHaveBeenCalledTimes(1);
            expect(onStatusChange).toHaveBeenCalledWith('clean');
        });

        it('does not announce or schedule while the websocket is still connecting', async () => {
            bridge = makeDisconnectedBridge();
            manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange });
            bridge.documentManager.isDirty = true;

            manager.start();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);

            expect(onStatusChange).not.toHaveBeenCalled();
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('autosaves a dirty state restored from a reload once the connection syncs', async () => {
            bridge = makeDisconnectedBridge();
            manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange });
            bridge.documentManager.isDirty = true;
            manager.start();

            bridge.documentManager.wsProvider = { wsconnected: true, synced: true };
            bridge.documentManager.synced = true;
            bridge.documentManager.emit('sync', { synced: true });

            expect(onStatusChange).toHaveBeenCalledWith('pending');
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
            expect(manager.getPhase()).toBe('clean');
        });

        it('announces clean once when a clean session becomes connected', () => {
            bridge = makeDisconnectedBridge();
            manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange });
            manager.start();

            bridge.documentManager.wsProvider = { wsconnected: true, synced: true };
            bridge.documentManager.emit('connectionChange', { connected: true });
            bridge.documentManager.emit('connectionChange', { connected: true });

            expect(onStatusChange).toHaveBeenCalledTimes(1);
            expect(onStatusChange).toHaveBeenCalledWith('clean');
        });

        it('ignores connection events that leave the session ineligible', () => {
            bridge = makeDisconnectedBridge();
            manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange });
            bridge.documentManager.isDirty = true;
            manager.start();

            bridge.documentManager.emit('connectionChange', { connected: false });

            expect(onStatusChange).not.toHaveBeenCalled();
        });

        it('does not double-schedule when a connection event arrives while a save is pending', async () => {
            manager.start();
            makeDirty(bridge.documentManager);
            bridge.documentManager.emit('sync', { synced: true });
            bridge.documentManager.emit('connectionChange', { connected: true });

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });

        it('detaches the connection listeners on destroy', () => {
            const offSpy = vi.spyOn(bridge.documentManager, 'off');
            manager.start();
            manager.destroy();
            const events = offSpy.mock.calls.map((c) => c[0]).sort();
            expect(events).toEqual(['connectionChange', 'saveStatus', 'sync']);
        });

        it('swallows listener errors raised by the initial announcement', () => {
            const throwing = vi.fn(() => {
                throw new Error('ui exploded');
            });
            manager = new CollaborativeAutosaveManager(bridge, { ...OPTIONS, onStatusChange: throwing });
            expect(() => manager.start()).not.toThrow();
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
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(OPTIONS.retryBaseMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(2);
        });

        it('reports failure through the status callback', async () => {
            bridge.saveManager.save = vi.fn().mockRejectedValue(new Error('network down'));

            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(onStatusChange).toHaveBeenCalledWith('failed');
        });

        it('keeps retrying at the capped interval after the fast attempts are used up', async () => {
            bridge.saveManager.save.mockImplementation(async () => ({ success: false, error: 'boom' }));
            manager.start();
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);

            // Fast retries: 2s, 4s, 8s (maxRetries = 3) ...
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(4000);
            await vi.advanceTimersByTimeAsync(8000);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(4);

            // ... then the interval stays capped at 2^maxRetries * base = 16s, forever.
            await vi.advanceTimersByTimeAsync(16000);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(5);
            await vi.advanceTimersByTimeAsync(16000);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(6);
            await vi.advanceTimersByTimeAsync(16000 * 10);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(16);
            expect(manager.getPhase()).toBe('failed');
        });

        it('retries promptly when the connection comes back after failures', async () => {
            bridge.saveManager.save.mockImplementation(async () => ({ success: false, error: 'offline' }));
            manager.start();
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(4000);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(3);
            expect(manager.getPhase()).toBe('failed');

            // The endpoint is reachable again and the websocket reconnects.
            bridge.saveManager.save.mockImplementation(async () => {
                bridge.documentManager.isDirty = false;
                bridge.documentManager.emit('saveStatus', { status: 'saved', isDirty: false });
                return { success: true };
            });
            bridge.documentManager.emit('connectionChange', { connected: true });

            // The backoff (8s next) is replaced by the idle delay.
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(4);
            expect(manager.getPhase()).toBe('clean');
        });

        it('recovers on its own once the endpoint is back, without a manual save', async () => {
            let failures = 2;
            bridge.saveManager.save.mockImplementation(async () => {
                if (failures > 0) {
                    failures -= 1;
                    return { success: false, error: '503' };
                }
                bridge.documentManager.isDirty = false;
                bridge.documentManager.emit('saveStatus', { status: 'saved', isDirty: false });
                return { success: true };
            });
            manager.start();
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            await vi.advanceTimersByTimeAsync(2000);
            expect(manager.getPhase()).toBe('failed');
            await vi.advanceTimersByTimeAsync(4000);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(3);
            expect(manager.getPhase()).toBe('clean');
            expect(onStatusChange.mock.calls.map((c) => c[0])).toEqual([
                'clean',
                'pending',
                'saving',
                'failed',
                'saving',
                'failed',
                'saving',
                'clean',
            ]);
        });

        it('leaves the document dirty when autosave fails', async () => {
            bridge.saveManager.save = vi.fn().mockResolvedValue({ success: false, error: 'boom' });

            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.documentManager.hasUnsavedChanges()).toBe(true);
            expect(manager.getPhase()).toBe('failed');
        });
    });

    describe('success handling', () => {
        it('marks the document clean after a successful autosave', async () => {
            manager.start();
            makeDirty(bridge.documentManager);

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.documentManager.hasUnsavedChanges()).toBe(false);
            expect(manager.getPhase()).toBe('clean');
        });

        it('emits pending then saving then clean status transitions', async () => {
            manager.start();
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
            makeDirty(bridge.documentManager);

            manager.cancel();
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });

        it('goes clean and cancels the timer when a manual save emits saved', async () => {
            manager.start();
            makeDirty(bridge.documentManager);

            // A manual save elsewhere completes and marks the doc clean.
            bridge.documentManager.isDirty = false;
            bridge.documentManager.emit('saveStatus', { status: 'saved', isDirty: false });
            expect(manager.getPhase()).toBe('clean');

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });
    });

    describe('external save failures (issue #2615)', () => {
        it('re-arms the retry loop after a failed manual save cancelled the queued autosave', async () => {
            manager.start();
            makeDirty(bridge.documentManager);
            // SaveManager cancels the autosave when a manual save starts ...
            manager.cancel();
            // ... and reports its failure here.
            manager.notifyExternalSaveFailed();
            expect(manager.getPhase()).toBe('pending');

            await vi.advanceTimersByTimeAsync(OPTIONS.retryBaseMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
            expect(bridge.saveManager.save.mock.calls[0][0].reason).toBe('collaborative-autosave');
        });

        it('keeps the failed phase when autosave was already failing', async () => {
            bridge.saveManager.save.mockResolvedValueOnce({ success: false, error: 'down' });
            manager.start();
            makeDirty(bridge.documentManager);
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(manager.getPhase()).toBe('failed');

            manager.cancel();
            manager.notifyExternalSaveFailed();
            expect(manager.getPhase()).toBe('failed');
        });

        it('runs the autosave that was deferred behind a manual save once that save fails', async () => {
            manager.start();
            makeDirty(bridge.documentManager);
            bridge.saveManager.isSaving = true;
            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();

            bridge.saveManager.isSaving = false;
            manager.notifyExternalSaveFailed();
            await vi.advanceTimersByTimeAsync(OPTIONS.retryBaseMs);
            expect(bridge.saveManager.save).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the document is clean, ineligible or destroyed', async () => {
            manager.start();
            manager.notifyExternalSaveFailed();
            bridge.documentManager.isDirty = true;
            bridge.app.capabilities.storage.remote = false;
            manager.notifyExternalSaveFailed();
            bridge.app.capabilities.storage.remote = true;
            manager.destroy();
            manager.notifyExternalSaveFailed();

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 4);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle', () => {
        it('stops timers and detaches listeners on destroy', async () => {
            const offSpy = vi.spyOn(bridge.documentManager, 'off');
            manager.start();
            makeDirty(bridge.documentManager);

            manager.destroy();

            await vi.advanceTimersByTimeAsync(OPTIONS.idleDelayMs * 2);
            expect(bridge.saveManager.save).not.toHaveBeenCalled();
            expect(offSpy).toHaveBeenCalledWith('saveStatus', expect.any(Function));
        });

        it('ignores dirty events emitted after destroy', async () => {
            manager.start();
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
