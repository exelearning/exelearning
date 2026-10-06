import { describe, expect, it } from 'vitest';
import { interactionsInRange, resolveJumpTarget, sortInteractions, toIdLookup } from './scheduling';
import type { Interaction } from './types';

function note(id: string, time: number): Interaction {
    return { id, type: 'note', time, duration: null, pause: true, body: '' };
}

describe('sortInteractions', () => {
    it('sorts interactions by time ascending', () => {
        const sorted = sortInteractions([note('a', 30), note('b', 5), note('c', 12)]);
        expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a']);
    });

    it('is stable for equal times (preserves author order)', () => {
        const sorted = sortInteractions([note('a', 5), note('b', 5), note('c', 5)]);
        expect(sorted.map(i => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('always puts the cover first, whatever its time', () => {
        const cover: Interaction = {
            id: 'iv-cover',
            type: 'cover',
            time: 0,
            duration: null,
            pause: false,
            title: '',
            body: '',
        };
        const sorted = sortInteractions([note('a', 0), cover, note('b', 3)]);
        expect(sorted.map(i => i.id)).toEqual(['iv-cover', 'a', 'b']);
    });

    it('does not mutate the input array', () => {
        const input = [note('a', 30), note('b', 5)];
        sortInteractions(input);
        expect(input.map(i => i.id)).toEqual(['a', 'b']);
    });

    it('handles empty or non-array input', () => {
        expect(sortInteractions([])).toEqual([]);
        expect(sortInteractions(null)).toEqual([]);
        expect(sortInteractions(undefined)).toEqual([]);
    });
});

describe('interactionsInRange', () => {
    const sorted = [note('i5', 5), note('i10', 10), note('i15', 15)];

    it('returns interactions crossed in the half-open interval (from, to]', () => {
        expect(interactionsInRange(sorted, 4, 10).map(i => i.id)).toEqual(['i5', 'i10']);
    });

    it('excludes interactions at or before `from`', () => {
        expect(interactionsInRange(sorted, 5, 20).map(i => i.id)).toEqual(['i10', 'i15']);
    });

    it('includes an interaction exactly at `to`', () => {
        expect(interactionsInRange(sorted, 9, 10).map(i => i.id)).toEqual(['i10']);
    });

    it('returns [] when seeking backward (to < from)', () => {
        expect(interactionsInRange(sorted, 20, 5)).toEqual([]);
    });

    it('treats a missing `from` as the start of the timeline', () => {
        expect(interactionsInRange(sorted, undefined as unknown as number, 5).map(i => i.id)).toEqual(['i5']);
    });

    it('fires duplicate-time interactions together in stable order', () => {
        const dup = [note('a', 5), note('b', 5)];
        expect(interactionsInRange(dup, 0, 5).map(i => i.id)).toEqual(['a', 'b']);
    });

    it('skips already-consumed interactions (jump loop prevention)', () => {
        expect(interactionsInRange(sorted, 0, 20, ['i10']).map(i => i.id)).toEqual(['i5', 'i15']);
        expect(interactionsInRange(sorted, 0, 20, new Set(['i5', 'i15'])).map(i => i.id)).toEqual(['i10']);
    });
});

describe('resolveJumpTarget', () => {
    const jump = (toTime: number): Interaction => ({
        id: 'j',
        type: 'jump',
        time: 10,
        duration: null,
        pause: true,
        jump: { toTime },
    });

    it('returns the numeric target for a valid jump', () => {
        expect(resolveJumpTarget(jump(5))).toBe(5);
    });

    it('returns null for non-jump interactions or missing targets', () => {
        expect(resolveJumpTarget(note('n', 1))).toBeNull();
        expect(resolveJumpTarget({ type: 'jump' } as unknown as Interaction)).toBeNull();
        expect(resolveJumpTarget(null)).toBeNull();
    });

    it('returns null for invalid targets', () => {
        expect(resolveJumpTarget(jump(-1))).toBeNull();
        expect(resolveJumpTarget(jump('x' as unknown as number))).toBeNull();
    });

    it('clamps a target beyond the video duration', () => {
        expect(resolveJumpTarget(jump(100), 60)).toBe(60);
    });
});

describe('toIdLookup', () => {
    it('accepts arrays, Sets and falsy input', () => {
        expect(toIdLookup(['a', 'b'])).toEqual({ a: true, b: true });
        expect(toIdLookup(new Set(['x']))).toEqual({ x: true });
        expect(toIdLookup(null)).toEqual({});
    });
});

describe('a consumed backward jump does not re-fire (no infinite loop)', () => {
    it('skips the jump on the second crossing', () => {
        // Jump at 10 -> 5. After firing once it is consumed; re-crossing time
        // 10 must not re-trigger it, so playback is never trapped.
        const sorted = sortInteractions([
            note('note5', 5),
            { id: 'jump10', type: 'jump', time: 10, duration: null, pause: true, jump: { toTime: 5 } },
        ]);
        const consumed = new Set<string>();
        const firstPass = interactionsInRange(sorted, 9, 11, consumed);
        expect(firstPass.map(i => i.id)).toContain('jump10');
        consumed.add('jump10'); // the runtime consumes the jump on fire
        const target = resolveJumpTarget(sorted.find(i => i.id === 'jump10'));
        expect(target).toBe(5);
        // After seeking back and replaying across 10 again, the jump is skipped.
        const secondPass = interactionsInRange(sorted, 9, 11, consumed);
        expect(secondPass.map(i => i.id)).not.toContain('jump10');
    });
});
