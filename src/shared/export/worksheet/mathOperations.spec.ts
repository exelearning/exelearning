import { describe, expect, it } from 'bun:test';
import { askedPart, fractionToLatex, generateOperations } from './mathOperations';

/** A source that walks a fixed sequence, so a draw can be pinned without being constant. */
function sequence(values: number[]): () => number {
    let index = 0;
    return () => values[index++ % values.length];
}

describe('generateOperations', () => {
    it('sets as many operations as the activity asks for', () => {
        expect(generateOperations({ number: 6 })).toHaveLength(6);
    });

    it('sets ten when the activity says nothing', () => {
        expect(generateOperations({})).toHaveLength(10);
    });

    it('sets none when the activity asks for none', () => {
        expect(generateOperations({ number: 0 })).toEqual([]);
    });

    it('writes the signs a printed sum uses, not the ones the screen makes do with', () => {
        // × and ÷ rather than the letter x and a colon.
        const signs = new Set(generateOperations({ number: 40 }).map(operation => operation.operator));

        expect([...signs].every(sign => '+−×÷'.includes(sign))).toBe(true);
        expect([...signs].some(sign => 'x:'.includes(sign))).toBe(false);
    });

    it('uses only the operators the activity switched on', () => {
        // The flags run add, subtract, multiply, divide.
        const adds = generateOperations({ number: 20, operations: '1000' });
        expect(new Set(adds.map(operation => operation.operator))).toEqual(new Set(['+']));

        const divides = generateOperations({ number: 20, operations: '0001' });
        expect(new Set(divides.map(operation => operation.operator))).toEqual(new Set(['÷']));
    });

    it('falls back to every operator when the activity switched them all off', () => {
        expect(generateOperations({ number: 4, operations: '0000' })).toHaveLength(4);
    });

    it('draws its operands from the range the activity gives', () => {
        for (const operation of generateOperations({ number: 30, min: 5, max: 9, operations: '1000' })) {
            for (const operand of [Number(operation.operandA), Number(operation.operandB)]) {
                expect(operand).toBeGreaterThanOrEqual(5);
                expect(operand).toBeLessThanOrEqual(9);
            }
        }
    });

    it('works the answer out', () => {
        const operations = generateOperations({ number: 20, min: 1, max: 9, operations: '1000' });

        for (const operation of operations) {
            expect(Number(operation.result)).toBe(Number(operation.operandA) + Number(operation.operandB));
        }
    });

    it('never divides by nothing', () => {
        for (const operation of generateOperations({ number: 40, min: 0, max: 3, operations: '0001' })) {
            expect(operation.operandB).not.toBe('0');
        }
    });

    describe('the results the activity allows', () => {
        it('keeps them whole when it allows no decimals', () => {
            const operations = generateOperations({
                number: 30,
                min: 1,
                max: 9,
                operations: '0001',
                decimalsInResults: false,
            });

            for (const operation of operations) expect(Number.isInteger(Number(operation.result))).toBe(true);
        });

        it('keeps them positive when it allows no negatives', () => {
            const operations = generateOperations({
                number: 30,
                min: 1,
                max: 9,
                operations: '0100',
                negative: false,
            });

            for (const operation of operations) expect(Number(operation.result)).toBeGreaterThanOrEqual(0);
        });

        it('keeps them off zero when it allows no zero', () => {
            const operations = generateOperations({ number: 30, min: 0, max: 4, operations: '1100', zero: false });

            for (const operation of operations) expect(Number(operation.result)).not.toBe(0);
        });

        it('sets something rather than nothing when no draw can satisfy the settings', () => {
            // Subtracting within 0-0 can only ever give zero, which the settings forbid.
            const operations = generateOperations({ number: 3, min: 0, max: 0, operations: '0100', zero: false });

            expect(operations).toHaveLength(3);
        });
    });

    describe('fractions', () => {
        const fractions = (overrides = {}) =>
            generateOperations({ number: 8, mode: 1, min: 1, max: 6, ...overrides }, sequence([0.1, 0.4, 0.7, 0.9]));

        it('writes them as the activity writes them, in LaTeX', () => {
            for (const operation of fractions()) {
                expect(operation.operandA).toMatch(/^\\\(/);
                expect(operation.result).toMatch(/^\\\(/);
            }
        });

        it('sets as many as asked', () => {
            expect(fractions()).toHaveLength(8);
        });

        it('uses the printed signs here too', () => {
            for (const operation of fractions()) expect('+−×÷').toContain(operation.operator);
        });
    });
});

describe('fractionToLatex', () => {
    it('writes a fraction as one', () => {
        expect(fractionToLatex({ numerator: 3, denominator: 4 })).toBe('\\(\\dfrac{3}{4}\\)');
    });

    it('writes a whole number as a number', () => {
        expect(fractionToLatex({ numerator: 5, denominator: 1 })).toBe('\\(5\\)');
        expect(fractionToLatex({ numerator: 5, denominator: -1 })).toBe('\\(-5\\)');
    });

    it('carries a negative denominator into the sign', () => {
        expect(fractionToLatex({ numerator: 3, denominator: -4 })).toBe('\\(\\dfrac{3}{-4}\\)');
    });
});

describe('askedPart', () => {
    it('asks for the result unless the activity says otherwise', () => {
        expect(askedPart({})).toBe('result');
        expect(askedPart({ type: undefined })).toBe('result');
    });

    it('asks for what the activity says', () => {
        expect(askedPart({ type: 'operandA' })).toBe('operandA');
        expect(askedPart({ type: 'operator' })).toBe('operator');
    });

    it('settles a random setting on one part for the whole activity', () => {
        // The runtime writes the drawn value back over the setting, so every operation in a sheet
        // asks for the same thing.
        expect(askedPart({ type: 'random' }, () => 0)).toBe('operator');
        expect(askedPart({ type: 'random' }, () => 0.99)).toBe('operandB');
    });
});
