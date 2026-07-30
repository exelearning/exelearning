/**
 * Deterministic interaction scheduling, used by the learner runtime and the
 * editor's timeline. Pure: never mutates its input.
 */

import { toSeconds } from './time';
import type { Interaction, JumpInteraction } from './types';

/** A minimal forEach-able collection of ids (covers `Set` and arrays). */
export interface IdCollection {
    forEach(callback: (id: string) => void): void;
    /** Direct membership test (a `Set`); spares building a lookup per call. */
    has?(id: string): boolean;
}

/** Build an id -> true lookup from an array or Set of ids (falsy => empty). */
export function toIdLookup(ids: IdCollection | null | undefined): Record<string, true> {
    const lookup: Record<string, true> = {};
    if (ids && typeof ids.forEach === 'function') {
        ids.forEach(id => {
            lookup[String(id)] = true;
        });
    }
    return lookup;
}

/**
 * Return a new array of interactions sorted by time ascending. The cover is
 * always first, whatever its time; other ties keep the author's original order
 * (stable), so multiple interactions at the same time are handled predictably.
 */
export function sortInteractions(list: readonly Interaction[] | null | undefined): Interaction[] {
    const arr = Array.isArray(list) ? list : [];
    return arr
        .map((interaction, index) => ({ interaction, index }))
        .sort((a, b) => {
            const aCover = a.interaction && a.interaction.type === 'cover';
            const bCover = b.interaction && b.interaction.type === 'cover';
            if (aCover !== bCover) {
                return aCover ? -1 : 1;
            }
            const ta = toSeconds(a.interaction?.time);
            const tb = toSeconds(b.interaction?.time);
            if (ta !== tb) {
                return ta - tb;
            }
            return a.index - b.index;
        })
        .map(entry => entry.interaction);
}

/**
 * Interactions whose time falls in the half-open interval `(fromTime, toTime]`
 * — those crossed as playback advances. Seeking backward yields none.
 * `consumedIds` (array or Set) are skipped, which is how the runtime prevents
 * a backward jump from re-triggering itself into an infinite loop.
 */
export function interactionsInRange(
    sorted: readonly Interaction[] | null | undefined,
    fromTime: number,
    toTime: number,
    consumedIds?: IdCollection | null,
): Interaction[] {
    let from = Number(fromTime);
    if (!isFinite(from)) {
        from = -Infinity;
    }
    const to = Number(toTime);
    if (!isFinite(to) || to < from) {
        return [];
    }
    // The runtime passes a Set on every time tick — test it directly instead
    // of materializing a fresh lookup object per call.
    let isConsumed: (id: string) => boolean;
    if (consumedIds && typeof consumedIds.has === 'function') {
        isConsumed = id => consumedIds.has?.(id) === true;
    } else {
        const lookup = toIdLookup(consumedIds);
        isConsumed = id => lookup[id] === true;
    }
    const list = Array.isArray(sorted) ? sorted : [];
    const out: Interaction[] = [];
    for (const interaction of list) {
        if (!interaction) {
            continue;
        }
        const t = toSeconds(interaction.time);
        if (t > from && t <= to && !isConsumed(interaction.id)) {
            out.push(interaction);
        }
    }
    return out;
}

/**
 * Validate a jump interaction and return its (optionally duration-clamped)
 * numeric target, or null if it is not a jump or the target is invalid.
 */
export function resolveJumpTarget(interaction: Interaction | null | undefined, duration?: number): number | null {
    if (!interaction || interaction.type !== 'jump' || !(interaction as JumpInteraction).jump) {
        return null;
    }
    let target = Number(interaction.jump.toTime);
    if (!isFinite(target) || target < 0) {
        return null;
    }
    const max = Number(duration);
    if (isFinite(max) && max >= 0 && target > max) {
        target = max;
    }
    return target;
}
