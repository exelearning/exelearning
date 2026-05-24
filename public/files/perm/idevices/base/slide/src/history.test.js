/**
 * Tests for SlideHistoryManager.
 */

/* eslint-disable no-undef */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlideHistoryManager } from './history.ts';

describe('SlideHistoryManager — synchronous basics', () => {
    it('starts with no undo or redo available', () => {
        const h = new SlideHistoryManager();
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
        expect(h.undo()).toBeNull();
        expect(h.redo()).toBeNull();
    });

    it('seed records a baseline that cannot be undone', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        expect(h.canUndo()).toBe(false);
        expect(h.snapshot()).toEqual({ undo: 1, redo: 0 });
    });

    it('commits create undoable snapshots in order', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        h.commit('b');
        h.commit('c');
        expect(h.canUndo()).toBe(true);
        expect(h.undo()).toBe('b');
        expect(h.undo()).toBe('a');
        expect(h.undo()).toBeNull();
    });

    it('redo replays the most recently undone snapshot', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        h.commit('b');
        h.commit('c');
        h.undo();
        expect(h.canRedo()).toBe(true);
        expect(h.redo()).toBe('c');
        expect(h.canRedo()).toBe(false);
    });

    it('commit after undo clears the redo stack', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        h.commit('b');
        h.commit('c');
        h.undo();
        expect(h.canRedo()).toBe(true);
        h.commit('d');
        expect(h.canRedo()).toBe(false);
    });

    it('skips identical consecutive snapshots', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        h.commit('a');
        h.commit('a');
        expect(h.snapshot()).toEqual({ undo: 1, redo: 0 });
    });

    it('respects the configured size limit', () => {
        const h = new SlideHistoryManager({ limit: 3 });
        h.seed('s');
        h.commit('1');
        h.commit('2');
        h.commit('3');
        h.commit('4');
        expect(h.snapshot().undo).toBe(3);
    });

    it('clear empties both stacks', () => {
        const h = new SlideHistoryManager();
        h.seed('a');
        h.commit('b');
        h.clear();
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });
});

describe('SlideHistoryManager — debounced push', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('coalesces rapid pushes into one commit', () => {
        const h = new SlideHistoryManager({ debounceMs: 50 });
        h.seed('a');
        h.push('b');
        h.push('c');
        h.push('d');
        vi.advanceTimersByTime(60);
        expect(h.snapshot().undo).toBe(2);
        expect(h.undo()).toBe('a');
    });

    it('flush forces the pending snapshot to commit immediately', () => {
        const h = new SlideHistoryManager({ debounceMs: 1000 });
        h.seed('a');
        h.push('b');
        expect(h.snapshot().undo).toBe(1);
        h.flush();
        expect(h.snapshot().undo).toBe(2);
    });

    it('undo flushes pending pushes first', () => {
        const h = new SlideHistoryManager({ debounceMs: 1000 });
        h.seed('a');
        h.commit('b');
        h.push('c');
        expect(h.undo()).toBe('b');
    });

    it('clear cancels pending push', () => {
        const h = new SlideHistoryManager({ debounceMs: 1000 });
        h.seed('a');
        h.push('b');
        h.clear();
        vi.advanceTimersByTime(2000);
        expect(h.canUndo()).toBe(false);
    });
});
