import { describe, expect, it } from 'vitest';
import {
    addPlayedRange,
    emptyPlayback,
    furthestPosition,
    isVideoCompleted,
    mergeSegments,
    uniqueWatchedTime,
    WATCH_COMPLETION_THRESHOLD,
    watchedProgress,
} from './playback';
import type { PlaybackProgress } from './types';

const play = (ranges: Array<[number, number]>, duration?: number): PlaybackProgress =>
    ranges.reduce((state, [a, b]) => addPlayedRange(state, a, b, duration), emptyPlayback());

describe('played segments', () => {
    it('merges overlapping and adjacent ranges into disjoint segments', () => {
        expect(
            mergeSegments([
                [0, 5],
                [3, 8],
            ]),
        ).toEqual([[0, 8]]);
        expect(
            mergeSegments([
                [10, 12],
                [0, 5],
            ]),
        ).toEqual([
            [0, 5],
            [10, 12],
        ]);
        // A gap under the epsilon is normal playback, not a skip.
        expect(
            mergeSegments([
                [0, 5],
                [5.2, 9],
            ]),
        ).toEqual([[0, 9]]);
        // A real gap stays a gap.
        expect(
            mergeSegments([
                [0, 5],
                [8, 9],
            ]),
        ).toEqual([
            [0, 5],
            [8, 9],
        ]);
    });

    it('ignores ranges that cannot describe watched time', () => {
        const state = play(
            [
                [5, 5], // zero length
                [8, 3], // reversed
                [NaN, 4],
                [1, Infinity],
            ],
            60,
        );
        expect(state.segments).toEqual([]);
        expect(uniqueWatchedTime(state)).toBe(0);
        expect(state.totalWatchTime).toBe(0);
    });

    it('clamps ranges to a known duration', () => {
        const state = play([[-5, 20]], 10);
        expect(state.segments).toEqual([[0, 10]]);
        expect(watchedProgress(state, 10)).toBe(1);
    });

    it('counts re-watching in total time but not in unique time', () => {
        const state = play(
            [
                [0, 10],
                [0, 10],
            ],
            60,
        );
        expect(uniqueWatchedTime(state)).toBe(10);
        expect(state.totalWatchTime).toBe(20);
    });

    it('does not count content skipped by a forward seek', () => {
        // Watch 0-10, jump to 50, watch to 60.
        const state = play(
            [
                [0, 10],
                [50, 60],
            ],
            60,
        );
        expect(uniqueWatchedTime(state)).toBe(20);
        expect(watchedProgress(state, 60)).toBeCloseTo(0.333, 2);
        expect(furthestPosition(state)).toBe(60);
    });

    it('accumulates non-linear viewing across several sessions of watching', () => {
        const state = play(
            [
                [20, 30],
                [0, 10],
                [10, 20],
            ],
            60,
        );
        expect(state.segments).toEqual([[0, 30]]);
        expect(uniqueWatchedTime(state)).toBe(30);
    });

    it('reports no progress when the duration is unknown', () => {
        const state = play([[0, 30]], undefined);
        expect(watchedProgress(state, undefined)).toBe(0);
        expect(watchedProgress(state, 0)).toBe(0);
        expect(watchedProgress(state, NaN)).toBe(0);
    });

    it('never reports more than full progress', () => {
        const state = play([[0, 10]], 10);
        expect(watchedProgress(state, 10)).toBe(1);
        expect(watchedProgress(emptyPlayback(), 10)).toBe(0);
        expect(furthestPosition(emptyPlayback())).toBe(0);
    });

    it('treats the video as watched only past the threshold', () => {
        expect(WATCH_COMPLETION_THRESHOLD).toBe(0.95);
        // Seeking to the end: the end was reached, almost nothing was watched.
        const skipped = play(
            [
                [0, 1],
                [99, 100],
            ],
            100,
        );
        expect(isVideoCompleted(skipped, 100, true)).toBe(false);
        // Watched through.
        const watched = play([[0, 96]], 100);
        expect(isVideoCompleted(watched, 100, false)).toBe(true);
    });

    it('falls back to the ended event when the duration is unknown', () => {
        const state = play([[0, 5]], undefined);
        expect(isVideoCompleted(state, undefined, true)).toBe(true);
        expect(isVideoCompleted(state, undefined, false)).toBe(false);
    });

    it('never mutates the state it is given', () => {
        const first = play([[0, 10]], 60);
        const second = addPlayedRange(first, 20, 30, 60);
        expect(first.segments).toEqual([[0, 10]]);
        expect(second.segments).toEqual([
            [0, 10],
            [20, 30],
        ]);
        expect(addPlayedRange(undefined, 0, 5, 60).segments).toEqual([[0, 5]]);
    });
});
