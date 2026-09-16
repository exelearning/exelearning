/**
 * Played segments — what the learner has ACTUALLY watched, as a set of
 * disjoint ranges. The `ended` event says the playhead reached the end, which
 * a single drag of the scrub bar achieves without watching anything — so a
 * watch-based completion has to be built on covered ranges instead.
 *
 * Pure and allocation-only: every function returns new values and never
 * mutates its input, so the editor, the preview and the export can share them
 * and the runtime keeps the state.
 */

import type { PlaybackProgress, PlayedSegment } from './types';

/**
 * Ranges closer than this are treated as contiguous. `timeupdate` fires about
 * every 250 ms, and a seek of a quarter of a second is not a skip, so bridging
 * that gap keeps normal playback as one segment instead of hundreds.
 */
export const SEGMENT_MERGE_EPSILON = 0.5;

/**
 * The share of the video a learner must actually have watched for a
 * `watch`-mode activity to count as complete.
 *
 * 0.95 rather than 1: the last frames are routinely never reported (the player
 * stops firing time events, or `ended` arrives from 0.3 s short), so demanding
 * 100% would make watch-completion unreachable on some providers. Not
 * author-configurable yet — see the changes/2147-interactive-video-refactor design for the reasoning.
 */
export const WATCH_COMPLETION_THRESHOLD = 0.95;

/** An empty played-segments state. */
export function emptyPlayback(): PlaybackProgress {
    return { segments: [], totalWatchTime: 0 };
}

/**
 * Merge a list of `[from, to]` ranges into sorted, disjoint segments.
 * Overlapping or adjacent ranges (within SEGMENT_MERGE_EPSILON) become one.
 */
export function mergeSegments(segments: unknown): PlayedSegment[] {
    const list: PlayedSegment[] = (Array.isArray(segments) ? segments : [])
        .filter(
            (range): range is [number, number] =>
                Array.isArray(range) && isFinite(range[0]) && isFinite(range[1]) && Number(range[1]) > Number(range[0]),
        )
        .map((range): PlayedSegment => [Number(range[0]), Number(range[1])])
        .sort((a, b) => a[0] - b[0]);
    const merged: PlayedSegment[] = [];
    for (const range of list) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1] + SEGMENT_MERGE_EPSILON) {
            last[1] = Math.max(last[1], range[1]);
        } else {
            merged.push([range[0], range[1]]);
        }
    }
    return merged;
}

/**
 * Add one watched range to a playback state, returning a NEW state.
 *
 * Invalid, reversed, zero-length and non-finite ranges are ignored; ranges are
 * clamped to a known duration. `totalWatchTime` counts every second played,
 * including re-watched ones, while the segments only ever describe unique
 * coverage.
 */
export function addPlayedRange(
    playback: PlaybackProgress | null | undefined,
    from: number,
    to: number,
    duration?: number,
): PlaybackProgress {
    const state = playback && Array.isArray(playback.segments) ? playback : emptyPlayback();
    let start = Number(from);
    let end = Number(to);
    if (!isFinite(start) || !isFinite(end)) {
        return { segments: state.segments.slice(), totalWatchTime: state.totalWatchTime || 0 };
    }
    start = Math.max(0, start);
    end = Math.max(0, end);
    const max = Number(duration);
    if (isFinite(max) && max > 0) {
        start = Math.min(start, max);
        end = Math.min(end, max);
    }
    if (end <= start) {
        return { segments: state.segments.slice(), totalWatchTime: state.totalWatchTime || 0 };
    }
    const totalWatchTime = (state.totalWatchTime || 0) + (end - start);
    // Fast path for the per-tick case: forward playback simply extends the
    // last segment, so skip the full filter/sort/merge pass.
    const last = state.segments[state.segments.length - 1];
    if (last && start >= last[0] && start <= last[1] + SEGMENT_MERGE_EPSILON) {
        const segments = state.segments.slice(0, -1) as PlayedSegment[];
        segments.push([last[0], Math.max(last[1], end)]);
        return { segments, totalWatchTime };
    }
    return {
        segments: mergeSegments(state.segments.concat([[start, end]])),
        totalWatchTime,
    };
}

/** Seconds covered by the segments, counting overlaps once. */
export function uniqueWatchedTime(playback: PlaybackProgress | null | undefined): number {
    const segments = playback?.segments || [];
    let total = 0;
    for (const segment of segments) {
        total += segment[1] - segment[0];
    }
    return total;
}

/**
 * Unique watched fraction of the video, 0..1. Returns 0 when the duration is
 * unknown: with no denominator there is no honest progress to report, and
 * callers must not treat "unknown" as "complete".
 */
export function watchedProgress(playback: PlaybackProgress | null | undefined, duration: unknown): number {
    const max = Number(duration);
    if (!isFinite(max) || max <= 0) {
        return 0;
    }
    const fraction = uniqueWatchedTime(playback) / max;
    if (!isFinite(fraction) || fraction < 0) {
        return 0;
    }
    return fraction > 1 ? 1 : fraction;
}

/**
 * Whether the video counts as watched: enough unique coverage, not merely an
 * `ended` event. Falls back to `ended` only when the duration is unknown
 * (some providers never report one), which is the pre-existing behaviour.
 */
export function isVideoCompleted(
    playback: PlaybackProgress | null | undefined,
    duration: unknown,
    ended?: boolean,
): boolean {
    const max = Number(duration);
    if (!isFinite(max) || max <= 0) {
        return ended === true;
    }
    return watchedProgress(playback, max) >= WATCH_COMPLETION_THRESHOLD;
}
