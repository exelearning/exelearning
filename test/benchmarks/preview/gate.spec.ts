import { describe, expect, it } from 'bun:test';
import { DEFAULT_BUDGET_MS, evaluateGate, formatSpread } from './gate';

describe('evaluateGate', () => {
    it('passes when the filtered preview is faster than main', () => {
        const r = evaluateGate({ mainMs: 9, filteredMs: 8 });
        expect(r.withinGate).toBe(true);
        expect(r.deltaMs).toBeCloseTo(-1, 5);
    });

    it('passes when the extra cost is inside the absolute budget', () => {
        const r = evaluateGate({ mainMs: 9, filteredMs: 11.5, budgetMs: 5 });
        expect(r.withinGate).toBe(true);
        expect(r.deltaMs).toBeCloseTo(2.5, 5);
    });

    it('fails when the extra cost exceeds the absolute budget', () => {
        const r = evaluateGate({ mainMs: 9, filteredMs: 15, budgetMs: 5 });
        expect(r.withinGate).toBe(false);
        expect(r.deltaMs).toBeCloseTo(6, 5);
    });

    /**
     * The reason this gate is absolute. On a ~9 ms operation the harness's own
     * run-to-run spread reaches ~30%, so a relative gate reports failures that no
     * code change can fix — and hides real ones behind the same noise.
     */
    it('does not fail an alarming-looking percentage that is imperceptible in absolute terms', () => {
        const r = evaluateGate({ mainMs: 8.5, filteredMs: 11, budgetMs: 5 });
        expect(r.deltaPct).toBeGreaterThan(25);
        expect(r.withinGate).toBe(true);
    });

    it('still fails a structural regression even when the percentage looks similar', () => {
        const r = evaluateGate({ mainMs: 40, filteredMs: 52, budgetMs: 5 });
        expect(r.deltaPct).toBeLessThan(31);
        expect(r.withinGate).toBe(false);
    });

    it('reports the budget it applied, defaulting when none is given', () => {
        expect(evaluateGate({ mainMs: 9, filteredMs: 9 }).budgetMs).toBe(DEFAULT_BUDGET_MS);
        expect(evaluateGate({ mainMs: 9, filteredMs: 9, budgetMs: 2 }).budgetMs).toBe(2);
    });

    it('does not produce a non-finite percentage when main is zero', () => {
        const r = evaluateGate({ mainMs: 0, filteredMs: 1 });
        expect(Number.isFinite(r.deltaPct)).toBe(true);
    });
});

describe('formatSpread', () => {
    it('shows min/median/max so a reader can judge the noise', () => {
        expect(formatSpread([9, 8, 10, 8.5, 12])).toBe('8.0–12.0 (median 9.0)');
    });

    it('handles a single sample', () => {
        expect(formatSpread([7.25])).toBe('7.3–7.3 (median 7.3)');
    });

    it('handles no samples', () => {
        expect(formatSpread([])).toBe('n/a');
    });
});
