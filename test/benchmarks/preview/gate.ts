/**
 * The pass/fail rule for the preview-refresh benchmark.
 *
 * This gate is ABSOLUTE, not relative, and that is deliberate.
 *
 * The measured quantity — one preview file-map generation — is ~8-10 ms. The
 * harness's own run-to-run spread on identical code reaches ~30% of that, because
 * a few hundred microseconds of GC or scheduler jitter landing inside a 9 ms
 * window moves the median. A 10% relative gate therefore reports failures no code
 * change can fix, and cannot distinguish that noise from a genuine regression of
 * the same magnitude. It is not a usable signal.
 *
 * What actually matters to the user is the absolute cost added to a 500 ms-debounced
 * refresh whose Service Worker hand-off and iframe reload are excluded from this
 * measurement entirely. A couple of milliseconds is imperceptible; a structural
 * regression (a policy that turns super-linear, a per-page reparse) is not, and
 * shows up as tens of milliseconds. The budget is set to catch the second without
 * flapping on the first.
 */

/** Extra milliseconds the filtered path may cost over the unfiltered one. */
export const DEFAULT_BUDGET_MS = 5;

export interface GateInput {
    /** Median ms for the unfiltered (`main`-equivalent) generation. */
    mainMs: number;
    /** Median ms for the filtered (default) generation. */
    filteredMs: number;
    /** Overrides {@link DEFAULT_BUDGET_MS}. */
    budgetMs?: number;
}

export interface GateResult {
    withinGate: boolean;
    /** Absolute extra cost; negative when filtered is faster. */
    deltaMs: number;
    /** Informational only — never the gate. */
    deltaPct: number;
    budgetMs: number;
}

/**
 * One-sided: filtered may be arbitrarily faster, and may be up to `budgetMs`
 * slower.
 */
export function evaluateGate({ mainMs, filteredMs, budgetMs = DEFAULT_BUDGET_MS }: GateInput): GateResult {
    const deltaMs = filteredMs - mainMs;
    return {
        withinGate: deltaMs <= budgetMs,
        deltaMs,
        // A zero baseline would make the ratio meaningless rather than infinite.
        deltaPct: mainMs > 0 ? (deltaMs / mainMs) * 100 : 0,
        budgetMs,
    };
}

/**
 * Render a sample set as `min–max (median X)`. The median alone hides the very
 * variance that makes a relative gate unusable, so every reported figure carries
 * its spread.
 */
export function formatSpread(samples: number[]): string {
    if (samples.length === 0) return 'n/a';
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return `${sorted[0].toFixed(1)}–${sorted[sorted.length - 1].toFixed(1)} (median ${median.toFixed(1)})`;
}
