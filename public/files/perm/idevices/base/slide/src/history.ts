/**
 * Slide iDevice — undo/redo history manager.
 *
 * Snapshots are opaque strings (`JSON.stringify(canvas.toJSON())`) so the
 * manager has no dependency on Fabric. Continuous changes (drag/resize/
 * rotate) coalesce into a single snapshot via a debounce window. Identical
 * consecutive snapshots are skipped.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { HISTORY_DEBOUNCE_MS, HISTORY_LIMIT } from './constants.js';

export interface SlideHistoryOptions {
    limit?: number;
    debounceMs?: number;
    /**
     * Optional clock used by tests to pin Date.now / setTimeout semantics.
     */
    now?: () => number;
}

export class SlideHistoryManager {
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private pending: string | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private readonly limit: number;
    private readonly debounceMs: number;

    constructor(options: SlideHistoryOptions = {}) {
        this.limit = options.limit && options.limit > 0 ? options.limit : HISTORY_LIMIT;
        this.debounceMs = options.debounceMs && options.debounceMs >= 0 ? options.debounceMs : HISTORY_DEBOUNCE_MS;
    }

    /**
     * Record a baseline snapshot synchronously (used when the editor first
     * loads its starting state).
     */
    seed(snapshot: string): void {
        this.cancelPending();
        this.undoStack = [snapshot];
        this.redoStack = [];
    }

    /**
     * Capture a snapshot immediately, bypassing debounce.
     */
    commit(snapshot: string): void {
        this.cancelPending();
        this.append(snapshot);
    }

    /**
     * Schedule a deferred snapshot. Repeated calls within the debounce
     * window keep replacing the pending payload, so a continuous gesture
     * commits exactly once at the end.
     */
    push(snapshot: string): void {
        this.pending = snapshot;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), this.debounceMs);
    }

    /**
     * Force the pending snapshot (if any) to commit immediately.
     */
    flush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.pending !== null) {
            const snap = this.pending;
            this.pending = null;
            this.append(snap);
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 1;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Undo by one step. Returns the snapshot to apply, or null if the
     * baseline is already current.
     */
    undo(): string | null {
        this.flush();
        if (!this.canUndo()) return null;
        const current = this.undoStack.pop() as string;
        this.redoStack.push(current);
        return this.undoStack[this.undoStack.length - 1] ?? null;
    }

    /**
     * Redo by one step. Returns the snapshot to apply, or null if there is
     * nothing to redo.
     */
    redo(): string | null {
        this.flush();
        if (!this.canRedo()) return null;
        const next = this.redoStack.pop() as string;
        this.undoStack.push(next);
        return next;
    }

    snapshot(): { undo: number; redo: number } {
        return { undo: this.undoStack.length, redo: this.redoStack.length };
    }

    clear(): void {
        this.cancelPending();
        this.undoStack = [];
        this.redoStack = [];
    }

    private append(snapshot: string): void {
        const top = this.undoStack[this.undoStack.length - 1];
        if (top === snapshot) return;
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.limit) {
            this.undoStack.splice(0, this.undoStack.length - this.limit);
        }
        this.redoStack = [];
    }

    private cancelPending(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = null;
    }
}
