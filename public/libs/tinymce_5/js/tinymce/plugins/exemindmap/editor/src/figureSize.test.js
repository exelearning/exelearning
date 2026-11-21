/**
 * Tests for the size a saved map is shown at: its own size, or the author's Dimensions.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FIGURE_SIZE, figureSize, openingChoice, parsePixels, sizeMode } from './figureSize.ts';

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

describe('sizeMode', () => {
    it('is empty when no dimension is set: the map keeps its own size', () => {
        expect(sizeMode({ constrain: true })).toBe('');
        expect(sizeMode({ constrain: false })).toBe('');
    });

    it('records whether the proportions are constrained when a dimension is set', () => {
        expect(sizeMode({ width: 1600, constrain: true })).toBe('constrain');
        expect(sizeMode({ height: 900, constrain: true })).toBe('constrain');
        expect(sizeMode({ width: 1600, height: 300, constrain: false })).toBe('free');
    });
});

describe('openingChoice', () => {
    it('leaves a map without the marker at its own size, even if it measures differently now', () => {
        // Other fonts lay the map out a few pixels larger or smaller (issue raised on PR #2557)
        expect(openingChoice({ width: 805, height: 396 }, '', natural, false)).toBeUndefined();
        expect(openingChoice({ width: 1600, height: 800 }, null, natural, false)).toBeUndefined();
    });

    it('keeps the width the author set, with the proportions of the map as it is now', () => {
        expect(openingChoice({ width: 1600, height: 805 }, 'constrain', natural, false)).toEqual({
            width: 1600,
            constrain: true,
        });
    });

    it('keeps both dimensions when the author set them without constraining the proportions', () => {
        expect(openingChoice({ width: 800, height: 300 }, 'free', natural, false)).toEqual({
            width: 800,
            height: 300,
            constrain: false,
        });
    });

    it('keeps the width of a converted legacy map whose size differs from the new layout', () => {
        expect(openingChoice({ width: 300, height: 200 }, '', natural, true)).toEqual({ width: 300, constrain: true });
        expect(openingChoice({ width: 801, height: 399 }, '', natural, true)).toBeUndefined();
    });

    it('ignores unusable stored sizes and unknown markers', () => {
        expect(openingChoice(undefined, 'constrain', natural, false)).toBeUndefined();
        expect(openingChoice({ width: Number.NaN, height: 10 }, 'free', natural, true)).toBeUndefined();
        expect(openingChoice({ width: 0, height: 0 }, 'constrain', natural, false)).toBeUndefined();
        expect(openingChoice({ width: 1600, height: 800 }, 'bogus', natural, false)).toBeUndefined();
    });
});
