/**
 * Operations for a maths drill
 *
 * A Maths operations activity stores no questions at all: it stores the rules for making them —
 * which operators are in play, the range the operands come from, whether results may be negative,
 * decimal or zero — and invents a fresh set every time it loads. There is therefore nothing on
 * screen for a printed sheet to match, and this makes one set the same way.
 *
 * Two kinds of drill share those rules: plain numbers, and fractions. Fractions are written as
 * LaTeX, exactly as the activity writes them, so a printed sheet sets them the way the screen
 * does.
 */

import type { RandomSource } from './questionSelection';

/** One operation, with each part as it is read. */
export interface Operation {
    operandA: string;
    operator: string;
    operandB: string;
    result: string;
}

/** Which part of an operation the student supplies. */
export type AskedPart = 'result' | 'operator' | 'operandA' | 'operandB';

/** What the activity stores about the drill it sets. */
export interface OperationSettings {
    /** How many operations to set. */
    number?: number;
    /** A flag per operator, in the order add, subtract, multiply, divide. */
    operations?: string;
    min?: number;
    max?: number;
    decimalsInOperands?: number;
    /** Whether a result may have decimals in it. */
    decimalsInResults?: boolean;
    /** Whether a result may be negative, or zero. */
    negative?: boolean;
    zero?: boolean;
    /** 1 sets fractions, anything else plain numbers. */
    mode?: number;
    /** Whether a fraction may be negative. */
    negativeFractions?: boolean;
    /** Which part is asked. 'random' picks one for the whole activity, as the runtime does. */
    type?: AskedPart | 'random';
}

/**
 * The four operators, in the order the activity's own flags list them.
 *
 * These are what the arithmetic is done with; what gets printed is the sign below.
 */
const OPERATORS = ['+', '-', '*', '/'];

/**
 * How each operator is written on paper.
 *
 * A printed sum uses the proper signs — × and ÷ — rather than the letter and the colon the screen
 * makes do with. On screen they sit in a line of text among form controls; on a worksheet they
 * are the arithmetic itself, and a lowercase x beside a number reads as an unknown.
 */
const PRINTED_SIGN: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** The parts that can be asked, in the order the activity lists them. */
const ASKED_PARTS: AskedPart[] = ['operator', 'result', 'operandA', 'operandB'];

/** Defaults the activity falls back to. */
const DEFAULTS = { number: 10, operations: '1111', min: 0, max: 10 };

/** Bound on the rejection loop: settings can ask for a result no draw will ever satisfy. */
const MAX_DRAWS = 200;

/** A whole number in the range, or one with decimals when the activity asks for them. */
function drawOperand(min: number, max: number, decimals: number, random: RandomSource): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);

    if (decimals <= 0) return Math.floor(random() * (high - low + 1)) + low;
    return Number((random() * (high - low) + low).toFixed(decimals));
}

/** Which operators the activity has switched on. */
function enabledOperators(mask: string | undefined, operators: string[]): string[] {
    const flags = mask ?? DEFAULTS.operations;
    const enabled = operators.filter((_, index) => flags[index] !== undefined && flags[index] !== '0');

    // An activity with every operator switched off would have nothing to set.
    return enabled.length > 0 ? enabled : operators;
}

/** Trim a result the way the activity does: two decimals, then any that turn out to be zeros. */
function tidyResult(value: number): string {
    return String(Number(value.toFixed(2)));
}

/** Whether a result is one the activity's settings allow. */
function resultAllowed(value: number, settings: OperationSettings): boolean {
    if (settings.decimalsInResults === false && !Number.isInteger(value)) return false;
    if (settings.negative === false && value < 0) return false;
    if (settings.zero === false && value === 0) return false;
    return true;
}

/** One operation on plain numbers. */
function drawNumberOperation(settings: OperationSettings, random: RandomSource): Operation {
    const operators = enabledOperators(settings.operations, OPERATORS);
    const min = Number.isFinite(settings.min) ? (settings.min as number) : DEFAULTS.min;
    const max = Number.isFinite(settings.max) ? (settings.max as number) : DEFAULTS.max;
    const decimals = Number.isFinite(settings.decimalsInOperands) ? (settings.decimalsInOperands as number) : 0;

    let drawn: Operation | null = null;

    for (let attempt = 0; attempt < MAX_DRAWS; attempt++) {
        const operator = operators[Math.floor(random() * operators.length) % operators.length];
        const a = drawOperand(min, max, decimals, random);
        const b = drawOperand(min, max, decimals, random);

        // Division by zero is the one draw that cannot stand whatever the settings say.
        if (operator === '/' && b === 0) continue;

        const value = operator === '+' ? a + b : operator === '-' ? a - b : operator === '*' ? a * b : a / b;
        const candidate = {
            operandA: String(a),
            operator: PRINTED_SIGN[operator],
            operandB: String(b),
            result: tidyResult(value),
        };

        drawn ??= candidate;
        if (resultAllowed(Number(candidate.result), settings)) return candidate;
    }

    // Settings no draw can satisfy: the first attempt is set anyway, rather than nothing at all.
    return drawn as Operation;
}

/** Greatest common divisor, for reducing a fraction. */
function gcd(a: number, b: number): number {
    let [x, y] = [Math.abs(a), Math.abs(b)];
    while (y !== 0) [x, y] = [y, x % y];
    return x === 0 ? 1 : x;
}

/** A fraction in its lowest terms, with any sign carried by the numerator. */
function simplify(numerator: number, denominator: number): { numerator: number; denominator: number } {
    const divisor = gcd(numerator, denominator);
    const sign = denominator < 0 ? -1 : 1;

    return { numerator: (numerator / divisor) * sign, denominator: (denominator / divisor) * sign };
}

/** A fraction drawn from the range, reduced. */
function drawFraction(
    min: number,
    max: number,
    signed: boolean,
    random: RandomSource,
): { numerator: number; denominator: number } {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    let numerator = Math.floor(random() * (high - low + 1)) + low;
    let denominator = Math.floor(random() * (high - low + 1)) + low;

    if (denominator === 0) denominator = 1;
    if (signed) {
        if (random() < 0.5) numerator *= -1;
        if (random() < 0.3) denominator *= -1;
    }

    return simplify(numerator, denominator);
}

type Fraction = { numerator: number; denominator: number };

/** Apply one operator to two fractions. */
function operateFractions(a: Fraction, b: Fraction, operator: string): Fraction | null {
    if (operator === '+')
        return simplify(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
    if (operator === '-')
        return simplify(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
    if (operator === '*') return simplify(a.numerator * b.numerator, a.denominator * b.denominator);
    // Dividing by a fraction with nothing on top has no answer to set.
    if (b.numerator === 0) return null;
    return simplify(a.numerator * b.denominator, a.denominator * b.numerator);
}

/** Whether the first fraction is the smaller of the two. */
function isSmaller(a: Fraction, b: Fraction): boolean {
    return a.numerator * b.denominator < b.numerator * a.denominator;
}

/**
 * Write a fraction the way the activity writes it: as LaTeX, and as a plain number when its
 * denominator is one.
 */
export function fractionToLatex({ numerator, denominator }: Fraction): string {
    if (denominator === 1) return `\\(${numerator}\\)`;
    if (denominator === -1) return `\\(${-numerator}\\)`;

    const sign = denominator < 0 ? '-' : '';
    return `\\(\\dfrac{${numerator}}{${sign}${Math.abs(denominator)}}\\)`;
}

/** One operation on fractions. */
function drawFractionOperation(settings: OperationSettings, random: RandomSource): Operation | null {
    const operators = enabledOperators(settings.operations, OPERATORS);
    const min = Number.isFinite(settings.min) ? (settings.min as number) : DEFAULTS.min;
    const max = Number.isFinite(settings.max) ? (settings.max as number) : DEFAULTS.max;
    const signed = settings.negativeFractions === true;

    for (let attempt = 0; attempt < MAX_DRAWS; attempt++) {
        const operator = operators[Math.floor(random() * operators.length) % operators.length];
        let a = drawFraction(min, max, signed, random);
        let b = drawFraction(min, max, signed, random);

        // Taking the smaller from the larger, when the activity allows no negative fraction.
        if (operator === '-' && !signed && isSmaller(a, b)) [a, b] = [b, a];

        const result = operateFractions(a, b, operator);
        if (!result) continue;

        return {
            operandA: fractionToLatex(a),
            operator: PRINTED_SIGN[operator],
            operandB: fractionToLatex(b),
            result: fractionToLatex(result),
        };
    }

    return null;
}

/**
 * Which part of an operation the student supplies.
 *
 * `random` is settled once for the whole activity rather than per operation, which is how the
 * runtime reads it: it writes the drawn value back over the setting.
 */
export function askedPart(settings: OperationSettings, random: RandomSource = Math.random): AskedPart {
    if (settings.type === 'random') return ASKED_PARTS[Math.floor(random() * ASKED_PARTS.length) % ASKED_PARTS.length];
    return ASKED_PARTS.includes(settings.type as AskedPart) ? (settings.type as AskedPart) : 'result';
}

/**
 * Make one set of operations, as the activity makes one on every load.
 *
 * @param settings - What the activity stores about the drill
 * @param random - Source of randomness, injectable so a sheet can be made reproducible
 * @returns The operations, as many as the activity asks for
 */
export function generateOperations(settings: OperationSettings, random: RandomSource = Math.random): Operation[] {
    const wanted = Number.isFinite(settings.number) ? Math.floor(settings.number as number) : DEFAULTS.number;
    const fractions = settings.mode === 1;
    const operations: Operation[] = [];

    for (let index = 0; index < Math.max(0, wanted); index++) {
        const operation = fractions ? drawFractionOperation(settings, random) : drawNumberOperation(settings, random);
        if (operation) operations.push(operation);
    }

    return operations;
}
