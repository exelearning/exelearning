/**
 * Unit tests for ImageOptimizerWorker.js
 *
 * Tests the pure utility functions used for image optimization.
 * The actual Web Worker and WASM-dependent code is tested via E2E tests.
 */

import {
    PRESETS,
    rgbaToRgb,
    normalizeQuality,
    calculateSavings,
    buildResultBase,
    getPreset,
    detectAlpha,
} from './ImageOptimizerWorker.js';

describe('ImageOptimizerWorker', () => {
    describe('PRESETS', () => {
        it('should have light preset', () => {
            expect(PRESETS.light).toBeDefined();
            expect(PRESETS.light.pixoPreset).toBe(0);
            expect(PRESETS.light.jpegQuality).toBe(90);
            expect(PRESETS.light.lossy).toBe(false);
        });

        it('should have medium preset', () => {
            expect(PRESETS.medium).toBeDefined();
            expect(PRESETS.medium.pixoPreset).toBe(1);
            expect(PRESETS.medium.jpegQuality).toBe(85);
            expect(PRESETS.medium.lossy).toBe(false);
        });

        it('should have strong preset', () => {
            expect(PRESETS.strong).toBeDefined();
            expect(PRESETS.strong.pixoPreset).toBe(2);
            expect(PRESETS.strong.jpegQuality).toBe(75);
            expect(PRESETS.strong.lossy).toBe(true);
        });
    });

    describe('rgbaToRgb', () => {
        it('should convert RGBA to RGB correctly', () => {
            // 1 pixel: RGBA (255, 128, 64, 255)
            const rgba = new Uint8Array([255, 128, 64, 255]);
            const rgb = rgbaToRgb(rgba);

            expect(rgb).toBeInstanceOf(Uint8Array);
            expect(rgb.length).toBe(3);
            expect(rgb[0]).toBe(255);
            expect(rgb[1]).toBe(128);
            expect(rgb[2]).toBe(64);
        });

        it('should handle multiple pixels', () => {
            // 2 pixels: RGBA
            const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);
            const rgb = rgbaToRgb(rgba);

            expect(rgb.length).toBe(6);
            // First pixel
            expect(rgb[0]).toBe(255);
            expect(rgb[1]).toBe(0);
            expect(rgb[2]).toBe(0);
            // Second pixel
            expect(rgb[3]).toBe(0);
            expect(rgb[4]).toBe(255);
            expect(rgb[5]).toBe(0);
        });

        it('should handle empty array', () => {
            const rgba = new Uint8Array([]);
            const rgb = rgbaToRgb(rgba);

            expect(rgb.length).toBe(0);
        });

        it('should strip alpha channel completely', () => {
            // Pixel with semi-transparent alpha
            const rgba = new Uint8Array([100, 150, 200, 127]);
            const rgb = rgbaToRgb(rgba);

            expect(rgb.length).toBe(3);
            expect(rgb[0]).toBe(100);
            expect(rgb[1]).toBe(150);
            expect(rgb[2]).toBe(200);
        });
    });

    describe('normalizeQuality', () => {
        it('should keep values in 2-100 range unchanged', () => {
            expect(normalizeQuality(50)).toBe(50);
            expect(normalizeQuality(2)).toBe(2);
            expect(normalizeQuality(100)).toBe(100);
        });

        it('should treat 1 as 0-1 range (100%)', () => {
            // Value of 1 is interpreted as 100% in 0-1 scale
            expect(normalizeQuality(1)).toBe(100);
        });

        it('should convert 0-1 range to 1-100', () => {
            expect(normalizeQuality(0.5)).toBe(50);
            expect(normalizeQuality(0.85)).toBe(85);
            expect(normalizeQuality(1)).toBe(100);
            expect(normalizeQuality(0.01)).toBe(1);
        });

        it('should clamp values above 100', () => {
            expect(normalizeQuality(150)).toBe(100);
            expect(normalizeQuality(200)).toBe(100);
        });

        it('should clamp values below 1 to minimum 1', () => {
            expect(normalizeQuality(0)).toBe(1);
            expect(normalizeQuality(-10)).toBe(1);
        });

        it('should round fractional values', () => {
            expect(normalizeQuality(75.4)).toBe(75);
            expect(normalizeQuality(75.6)).toBe(76);
        });
    });

    describe('calculateSavings', () => {
        it('should calculate savings correctly', () => {
            const result = calculateSavings(1000, 600);

            expect(result.savings).toBe(400);
            expect(result.savingsPercent).toBe('40.0');
        });

        it('should handle zero savings', () => {
            const result = calculateSavings(1000, 1000);

            expect(result.savings).toBe(0);
            expect(result.savingsPercent).toBe('0.0');
        });

        it('should handle negative savings (file got bigger)', () => {
            const result = calculateSavings(1000, 1200);

            expect(result.savings).toBe(-200);
            expect(result.savingsPercent).toBe('-20.0');
        });

        it('should format percentage with one decimal place', () => {
            const result = calculateSavings(3, 1);

            expect(result.savings).toBe(2);
            expect(result.savingsPercent).toBe('66.7');
        });
    });

    describe('buildResultBase', () => {
        it('should build result object with all fields', () => {
            const decoded = {
                hasAlpha: true,
                width: 100,
                height: 100,
            };
            const compressed = {
                data: new Uint8Array(500),
                format: 'image/png',
            };
            const originalSize = 1000;

            const result = buildResultBase(decoded, compressed, originalSize);

            expect(result.success).toBe(true);
            expect(result.hasAlpha).toBe(true);
            expect(result.outputFormat).toBe('image/png');
            expect(result.originalSize).toBe(1000);
            expect(result.savings).toBe(500);
            expect(result.savingsPercent).toBe('50.0');
        });

        it('should handle JPEG format', () => {
            const decoded = {
                hasAlpha: false,
            };
            const compressed = {
                data: new Uint8Array(300),
                format: 'image/jpeg',
            };
            const originalSize = 1000;

            const result = buildResultBase(decoded, compressed, originalSize);

            expect(result.outputFormat).toBe('image/jpeg');
            expect(result.hasAlpha).toBe(false);
        });
    });

    describe('getPreset', () => {
        it('should return light preset', () => {
            const preset = getPreset('light');

            expect(preset).toBe(PRESETS.light);
            expect(preset.pixoPreset).toBe(0);
        });

        it('should return medium preset', () => {
            const preset = getPreset('medium');

            expect(preset).toBe(PRESETS.medium);
            expect(preset.pixoPreset).toBe(1);
        });

        it('should return strong preset', () => {
            const preset = getPreset('strong');

            expect(preset).toBe(PRESETS.strong);
            expect(preset.pixoPreset).toBe(2);
        });

        it('should default to medium for unknown preset', () => {
            const preset = getPreset('unknown');

            expect(preset).toBe(PRESETS.medium);
        });

        it('should default to medium for null/undefined', () => {
            expect(getPreset(null)).toBe(PRESETS.medium);
            expect(getPreset(undefined)).toBe(PRESETS.medium);
        });
    });

    describe('detectAlpha', () => {
        it('should return false for fully opaque image', () => {
            // 2 pixels, all with alpha = 255
            const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);

            expect(detectAlpha(pixels)).toBe(false);
        });

        it('should return true for semi-transparent pixel', () => {
            // 2 pixels, second has alpha = 128
            const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);

            expect(detectAlpha(pixels)).toBe(true);
        });

        it('should return true for fully transparent pixel', () => {
            // 1 pixel with alpha = 0
            const pixels = new Uint8Array([255, 255, 255, 0]);

            expect(detectAlpha(pixels)).toBe(true);
        });

        it('should return true for alpha = 254', () => {
            // Edge case: almost opaque
            const pixels = new Uint8Array([100, 100, 100, 254]);

            expect(detectAlpha(pixels)).toBe(true);
        });

        it('should handle empty array', () => {
            const pixels = new Uint8Array([]);

            expect(detectAlpha(pixels)).toBe(false);
        });

        it('should detect alpha in the last pixel', () => {
            // 3 pixels, only the last has transparency
            const pixels = new Uint8Array([
                255, 0, 0, 255, // opaque
                0, 255, 0, 255, // opaque
                0, 0, 255, 100, // transparent
            ]);

            expect(detectAlpha(pixels)).toBe(true);
        });

        it('should work with Uint8ClampedArray', () => {
            const pixels = new Uint8ClampedArray([255, 0, 0, 128]);

            expect(detectAlpha(pixels)).toBe(true);
        });
    });

    describe('Integration scenarios', () => {
        it('should work together for complete workflow simulation', () => {
            // Simulate decoded image data
            const decoded = {
                data: new Uint8Array(100 * 100 * 4), // 100x100 RGBA image
                width: 100,
                height: 100,
                hasAlpha: false,
            };

            // Get preset
            const preset = getPreset('medium');
            expect(preset.jpegQuality).toBe(85);

            // Normalize quality
            const quality = normalizeQuality(preset.jpegQuality);
            expect(quality).toBe(85);

            // Simulate compressed result
            const compressed = {
                data: new Uint8Array(5000),
                format: 'image/jpeg',
            };

            // Build result
            const result = buildResultBase(decoded, compressed, 40000);

            expect(result.success).toBe(true);
            expect(result.hasAlpha).toBe(false);
            expect(result.outputFormat).toBe('image/jpeg');
            expect(result.originalSize).toBe(40000);
            expect(result.savings).toBe(35000);
            expect(result.savingsPercent).toBe('87.5');
        });

        it('should handle PNG workflow with alpha', () => {
            // Simulate image with alpha
            const pixels = new Uint8Array([255, 0, 0, 128]); // Semi-transparent red
            const hasAlpha = detectAlpha(pixels);
            expect(hasAlpha).toBe(true);

            // Get preset for PNG
            const preset = getPreset('light');
            expect(preset.lossy).toBe(false);

            // Simulate compressed PNG result
            const compressed = {
                data: new Uint8Array(500),
                format: 'image/png',
            };

            const decoded = { hasAlpha: true };
            const result = buildResultBase(decoded, compressed, 1000);

            expect(result.outputFormat).toBe('image/png');
            expect(result.hasAlpha).toBe(true);
        });
    });
});
