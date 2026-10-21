/**
 * Values for a maths problem
 *
 * A Maths problems activity does not store finished problems: it stores a statement with holes in
 * it — `{a}`, `{b}` — and says where the numbers that fill them may come from. Every time the
 * activity loads it draws a fresh set, so two plays never pose the same problem and there is
 * nothing on screen for a printed sheet to match.
 *
 * This draws one set, the same way the activity does, so a sheet poses one version of each
 * problem. The formula is never touched: the printed exercise asks the student to solve it, so the
 * answer is not needed — which also keeps the export path from evaluating expressions an author
 * wrote.
 */

import type { RandomSource } from './questionSelection';

/** A hole in a statement: a single letter in braces. */
const PLACEHOLDER = /\{([a-zA-Z])\}/g;

/**
 * Most values one domain may offer.
 *
 * A bound rather than a rule: a range with a step small enough to enumerate millions of values
 * would hold up a print for a choice the student cannot tell apart anyway.
 */
const MAX_DOMAIN_VALUES = 10_000;

/** One named set of values a variable may take. */
export interface ValueDomain {
    name?: string;
    /** The expression that says which values are allowed. */
    value?: string;
}

/** What one problem stores about the numbers in it. */
export interface ProblemValues {
    /** Whether the variables have named domains rather than a plain range. */
    definedVariables?: boolean;
    domains?: ValueDomain[];
    min?: number;
    max?: number;
    decimals?: number;
}

/** How many decimals a written number shows. */
function decimalPlaces(text: string): number {
    const point = text.indexOf('.');
    return point === -1 ? 0 : text.length - point - 1;
}

/** Drop the trailing zeros a fixed-decimal rendering leaves behind. */
function tidy(value: number, decimals: number): number {
    return Number(value.toFixed(decimals));
}

/**
 * Expand one element of a domain expression into the values it stands for.
 *
 * An element is a single number, or a range `from - to`, optionally with a step `# n`. Without a
 * step a whole-number range walks by one, and a decimal one by the smallest unit either end
 * shows — so `1.5 - 2` means 1.5, 1.6 … 2, as the activity reads it.
 */
function expandElement(element: string): number[] {
    const [range, stepText] = element.split('#').map(part => part.trim());
    const bounds = range.split(' - ').map(part => part.trim());

    if (bounds.length < 2) {
        const single = Number(range);
        return Number.isFinite(single) ? [single] : [];
    }

    const [startText, endText] = bounds;
    const start = Number(startText);
    const end = Number(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    const decimals = Math.max(
        decimalPlaces(startText),
        decimalPlaces(endText),
        stepText === undefined ? 0 : decimalPlaces(stepText),
    );
    const step = stepText === undefined ? (decimals === 0 ? 1 : 1 / 10 ** decimals) : Number(stepText);

    // A step that cannot advance would spin forever on a range the author got wrong.
    if (!Number.isFinite(step) || step <= 0) return [start];

    const values: number[] = [];
    // The rounded value is what decides the end, not the accumulator: stepping by a tenth from 1.5
    // arrives at 1.9999999999999998, which would stop the range one value short of 2.
    for (let value = start; values.length <= MAX_DOMAIN_VALUES; value += step) {
        const rounded = tidy(value, decimals);
        if (rounded > end) break;
        values.push(rounded);
    }

    return values;
}

/**
 * Read a domain expression: the values a variable may take.
 *
 * Elements are separated by commas, and one prefixed with `!` is excluded rather than offered.
 *
 * @param expression - The author's own expression, e.g. `1 - 10, !5`
 * @returns Every value allowed, in the order they were written
 */
export function expandDomain(expression: string | undefined): number[] {
    const allowed: number[] = [];
    const disallowed = new Set<number>();

    for (const raw of (expression ?? '').split(',')) {
        const element = raw.trim();
        if (!element) continue;

        const excluded = element.startsWith('!');
        for (const value of expandElement(excluded ? element.slice(1).trim() : element)) {
            if (excluded) disallowed.add(value);
            else if (!allowed.includes(value)) allowed.push(value);
        }
    }

    return allowed.filter(value => !disallowed.has(value));
}

/**
 * Draw one value for a variable.
 *
 * With named domains the value comes from that variable's own list. Without them it comes from the
 * activity's range.
 *
 * @param name - The variable's letter, without its braces
 * @param values - What the problem stores about its numbers
 * @param random - Source of randomness, injectable so a sheet can be made reproducible
 */
export function drawValue(name: string, values: ProblemValues, random: RandomSource): number {
    if (values.definedVariables) {
        const domain = (values.domains ?? []).find(entry => entry.name === name);
        const allowed = expandDomain(domain?.value);
        if (allowed.length > 0) return allowed[Math.floor(random() * allowed.length) % allowed.length];
        // The activity falls back to 1 for a variable with nothing allowed, and so does this.
        return 1;
    }

    const min = Number.isFinite(values.min) ? (values.min as number) : 0;
    const max = Number.isFinite(values.max) ? (values.max as number) : 10;
    const decimals = Number.isFinite(values.decimals) ? (values.decimals as number) : 0;

    // Kept inside the author's own range. The activity computes `random * max + min`, which runs
    // past the maximum whenever the minimum is above zero — invisible in the common case, where
    // the minimum is zero, and plainly not what a stated range means.
    const low = Math.min(min, max);
    const high = Math.max(min, max);

    if (decimals <= 0) return Math.floor(random() * (high - low + 1)) + low;
    return tidy(random() * (high - low) + low, decimals);
}

/**
 * Fill the holes in a statement with drawn values.
 *
 * The same variable gets the same value everywhere it appears, as the activity's own substitution
 * does: it replaces every occurrence of a placeholder at once.
 *
 * @param statement - The stored statement, with its holes
 * @param values - What the problem stores about its numbers
 * @param random - Source of randomness
 * @returns The statement, with a number in place of every hole
 */
export function fillStatement(
    statement: string | undefined,
    values: ProblemValues,
    random: RandomSource = Math.random,
): string {
    const drawn = new Map<string, number>();

    return (statement ?? '').replace(PLACEHOLDER, (hole, name: string) => {
        if (!drawn.has(name)) drawn.set(name, drawValue(name, values, random));
        return String(drawn.get(name) ?? hole);
    });
}
