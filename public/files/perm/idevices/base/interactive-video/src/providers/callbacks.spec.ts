import { describe, expect, it, vi } from 'vitest';
import { callbacks, createBaseAdapter, DEFAULT_TIMEOUT_MS } from './callbacks';

describe('callbacks registry', () => {
    it('fans out to every subscriber and isolates errors', () => {
        const registry = callbacks<number>();
        const seen: number[] = [];
        registry.add(() => {
            throw new Error('one bad subscriber');
        });
        registry.add(value => seen.push(value));
        expect(() => registry.emit(7)).not.toThrow();
        expect(seen).toEqual([7]);
    });

    it('ignores non-function subscribers and supports clear()', () => {
        const registry = callbacks<void>();
        registry.add(null);
        registry.add(undefined);
        const fn = vi.fn();
        registry.add(fn);
        registry.clear();
        registry.emit();
        expect(fn).not.toHaveBeenCalled();
    });
});

describe('base adapter plumbing', () => {
    it('emitTime caches lastTime and only accepts finite numbers', () => {
        const base = createBaseAdapter();
        const times: number[] = [];
        base.onTimeUpdate(s => times.push(s));
        base.emitTime(4);
        base.emitTime(NaN);
        base.emitTime(Infinity);
        expect(times).toEqual([4]);
        expect(base.lastTime).toBe(4);
    });

    it('emitState skips null states', () => {
        const base = createBaseAdapter();
        const states: string[] = [];
        base.onStateChange(s => states.push(s));
        base.emitState('playing');
        base.emitState(null);
        expect(states).toEqual(['playing']);
    });

    it('emitReady fires once and replays for late subscribers', () => {
        const base = createBaseAdapter();
        const early = vi.fn();
        base.onReady(early);
        base.emitReady();
        base.emitReady();
        expect(early).toHaveBeenCalledTimes(1);
        const late = vi.fn();
        base.onReady(late);
        expect(late).toHaveBeenCalledTimes(1);
    });

    it('exposes a sane default timeout', () => {
        expect(DEFAULT_TIMEOUT_MS).toBe(7000);
    });
});
