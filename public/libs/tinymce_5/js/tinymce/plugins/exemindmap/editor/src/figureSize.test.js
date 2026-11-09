/**
 * Tests for the size a saved map is shown at: its own size, or the author's Dimensions.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FIGURE_SIZE, figureSize, isCustomSize, parsePixels } from './figureSize.ts';

const natural = { width: 800, height: 400 };

describe('parsePixels', () => {
    it('reads a positive number of pixels, rounded', () => {
        expect(parsePixels('640')).toBe(640);
        expect(parsePixels(' 99.6 ')).toBe(100);
    });

    it('leaves empty, invalid and non-positive values to the map (automatic)', () => {
        for (const value of ['', '  ', 'abc', '0', '-20', 'NaN', 'Infinity']) expect(parsePixels(value)).toBeUndefined();
    });

    it('caps very large values', () => {
        expect(parsePixels('999999')).toBe(MAX_FIGURE_SIZE);
    });
});

describe('figureSize', () => {
    it('is the map size when no dimension is set', () => {
        expect(figureSize(natural, { constrain: true })).toEqual(natural);
        expect(figureSize(natural, { constrain: false })).toEqual(natural);
    });

    it('keeps the proportions from the width or the height', () => {
        expect(figureSize(natural, { width: 1600, constrain: true })).toEqual({ width: 1600, height: 800 });
        expect(figureSize(natural, { height: 100, constrain: true })).toEqual({ width: 200, height: 100 });
        // With both set, the width leads, so a map that changed shape is not distorted
        expect(figureSize(natural, { width: 400, height: 900, constrain: true })).toEqual({ width: 400, height: 200 });
    });

    it('uses both dimensions as given when proportions are not constrained', () => {
        expect(figureSize(natural, { width: 400, height: 900, constrain: false })).toEqual({ width: 400, height: 900 });
        expect(figureSize(natural, { width: 400, constrain: false })).toEqual({ width: 400, height: 200 });
    });

    it('never gives an empty image', () => {
        expect(figureSize({ width: 10000, height: 1 }, { width: 10, constrain: true })).toEqual({ width: 10, height: 1 });
        expect(figureSize({ width: 0, height: 0 }, { width: 10, constrain: true })).toEqual({ width: 10, height: 10 });
    });
});

describe('isCustomSize', () => {
    it('is false for the size the map was saved at, give or take rounding', () => {
        expect(isCustomSize(natural, natural)).toBe(false);
        expect(isCustomSize({ width: 801, height: 399 }, natural)).toBe(false);
    });

    it('is true when the author chose other dimensions', () => {
        expect(isCustomSize({ width: 1600, height: 800 }, natural)).toBe(true);
        expect(isCustomSize({ width: 800, height: 300 }, natural)).toBe(true);
    });

    it('is false when nothing usable was stored', () => {
        expect(isCustomSize(undefined, natural)).toBe(false);
        expect(isCustomSize({ width: Number.NaN, height: 10 }, natural)).toBe(false);
        expect(isCustomSize({ width: 0, height: 0 }, natural)).toBe(false);
    });
});
