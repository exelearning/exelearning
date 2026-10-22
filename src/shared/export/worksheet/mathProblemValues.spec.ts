import { describe, expect, it } from 'bun:test';
import { drawValue, expandDomain, fillStatement } from './mathProblemValues';

describe('expandDomain', () => {
    it('reads a list of values', () => {
        expect(expandDomain('2, 3, 5')).toEqual([2, 3, 5]);
    });

    it('walks a whole-number range one at a time', () => {
        expect(expandDomain('1 - 5')).toEqual([1, 2, 3, 4, 5]);
    });

    it('walks a range by the step it is given', () => {
        expect(expandDomain('0 - 10 # 2.5')).toEqual([0, 2.5, 5, 7.5, 10]);
    });

    it('walks a decimal range by the smallest unit either end shows', () => {
        expect(expandDomain('1.5 - 2')).toEqual([1.5, 1.6, 1.7, 1.8, 1.9, 2]);
    });

    it('leaves out what the author excluded', () => {
        expect(expandDomain('1 - 5, !3')).toEqual([1, 2, 4, 5]);
    });

    it('excludes a whole range at once', () => {
        expect(expandDomain('1 - 10, !4 - 8')).toEqual([1, 2, 3, 9, 10]);
    });

    it('keeps each value once, however many times it is offered', () => {
        expect(expandDomain('1 - 3, 2, 3')).toEqual([1, 2, 3]);
    });

    it('returns nothing for an expression that says nothing', () => {
        expect(expandDomain(undefined)).toEqual([]);
        expect(expandDomain('')).toEqual([]);
        expect(expandDomain('  ,  ')).toEqual([]);
    });

    it('survives a range the author got wrong', () => {
        // A step of zero would walk forever.
        expect(expandDomain('1 - 10 # 0')).toEqual([1]);
        expect(expandDomain('x - y')).toEqual([]);
    });
});

describe('drawValue', () => {
    it('takes a value from the variable’s own domain', () => {
        const value = drawValue('a', { definedVariables: true, domains: [{ name: 'a', value: '7' }] }, () => 0);

        expect(value).toBe(7);
    });

    it('keeps each variable to its own domain', () => {
        const values = {
            definedVariables: true,
            domains: [
                { name: 'a', value: '1' },
                { name: 'b', value: '2' },
            ],
        };

        expect(drawValue('a', values, () => 0)).toBe(1);
        expect(drawValue('b', values, () => 0)).toBe(2);
    });

    it('falls back to one for a variable with nothing allowed, as the activity does', () => {
        expect(drawValue('z', { definedVariables: true, domains: [] }, () => 0)).toBe(1);
    });

    it('stays inside the range the author stated', () => {
        // The activity computes random * max + min, which runs past the maximum whenever the
        // minimum is above zero. A printed problem keeps to what the range says.
        for (const random of [() => 0, () => 0.5, () => 0.999]) {
            const value = drawValue('a', { min: 10, max: 20 }, random);

            expect(value).toBeGreaterThanOrEqual(10);
            expect(value).toBeLessThanOrEqual(20);
        }
    });

    it('draws whole numbers when the activity asks for no decimals', () => {
        for (const random of [() => 0, () => 0.4, () => 0.99]) {
            expect(Number.isInteger(drawValue('a', { min: 1, max: 6 }, random))).toBe(true);
        }
    });

    it('draws to the number of decimals the activity asks for', () => {
        const value = drawValue('a', { min: 0, max: 1, decimals: 2 }, () => 1 / 3);

        expect(value).toBe(0.33);
    });

    it('reaches both ends of a whole-number range', () => {
        expect(drawValue('a', { min: 1, max: 6 }, () => 0)).toBe(1);
        expect(drawValue('a', { min: 1, max: 6 }, () => 0.999)).toBe(6);
    });

    it('survives a range written back to front', () => {
        const value = drawValue('a', { min: 20, max: 10 }, () => 0.5);

        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
    });
});

describe('fillStatement', () => {
    it('puts a number in place of every hole', () => {
        const filled = fillStatement('Compra {a} manzanas a {b} euros', { min: 3, max: 3 }, () => 0);

        expect(filled).toBe('Compra 3 manzanas a 3 euros');
    });

    it('gives the same variable the same value everywhere it appears', () => {
        const filled = fillStatement('{a} y {a} y {a}', { min: 1, max: 9 }, () => 0.5);
        const [first, second, third] = filled.split(' y ');

        expect(second).toBe(first);
        expect(third).toBe(first);
    });

    it('gives different variables their own values', () => {
        const filled = fillStatement('{a} {b}', {
            definedVariables: true,
            domains: [
                { name: 'a', value: '4' },
                { name: 'b', value: '9' },
            ],
        });

        expect(filled).toBe('4 9');
    });

    it('leaves alone anything that is not a hole', () => {
        expect(fillStatement('Cuesta {ab} euros, {1} y {}', { min: 5, max: 5 })).toBe('Cuesta {ab} euros, {1} y {}');
    });

    it('returns nothing for a statement that says nothing', () => {
        expect(fillStatement(undefined, {})).toBe('');
        expect(fillStatement('', {})).toBe('');
    });

    it('leaves a statement with no holes as it was', () => {
        expect(fillStatement('Sin variables', { min: 1, max: 9 })).toBe('Sin variables');
    });
});
