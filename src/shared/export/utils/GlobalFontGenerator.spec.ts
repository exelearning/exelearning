/**
 * Unit tests for GlobalFontGenerator
 * Tests CSS generation for global fonts with various configurations
 */

import { describe, test, expect } from 'bun:test';
import { GlobalFontGenerator, GLOBAL_FONTS } from './GlobalFontGenerator';

describe('GlobalFontGenerator', () => {
    describe('GLOBAL_FONTS configuration', () => {
        test('should have all expected fonts defined', () => {
            expect(GLOBAL_FONTS).toHaveProperty('opendyslexic');
            expect(GLOBAL_FONTS).toHaveProperty('andika');
            expect(GLOBAL_FONTS).toHaveProperty('nunito');
            expect(GLOBAL_FONTS).toHaveProperty('playwrite-es');
        });

        test('each font should have required properties', () => {
            for (const [fontId, config] of Object.entries(GLOBAL_FONTS)) {
                expect(config.fontFamily).toBeDefined();
                expect(config.fallback).toBeDefined();
                expect(config.files).toBeDefined();
                expect(config.files.length).toBeGreaterThan(0);
            }
        });

        test('opendyslexic should have 4 font files (regular, bold, italic, bold-italic)', () => {
            expect(GLOBAL_FONTS.opendyslexic.files).toHaveLength(4);
        });

        test('playwrite-es should have cursive fallback', () => {
            expect(GLOBAL_FONTS['playwrite-es'].fallback).toContain('cursive');
        });

        test('playwrite-es should have lineHeight defined', () => {
            expect(GLOBAL_FONTS['playwrite-es'].lineHeight).toBe('2em');
        });

        test('other fonts should not have lineHeight defined', () => {
            expect(GLOBAL_FONTS.opendyslexic.lineHeight).toBeUndefined();
            expect(GLOBAL_FONTS.andika.lineHeight).toBeUndefined();
            expect(GLOBAL_FONTS.nunito.lineHeight).toBeUndefined();
        });
    });

    describe('generateCss', () => {
        test('should return empty string for default font', () => {
            const result = GlobalFontGenerator.generateCss('default');
            expect(result).toBe('');
        });

        test('should return empty string for invalid font', () => {
            const result = GlobalFontGenerator.generateCss('invalid-font');
            expect(result).toBe('');
        });

        test('should generate @font-face rules for valid fonts', () => {
            const result = GlobalFontGenerator.generateCss('opendyslexic');

            expect(result).toContain('@font-face');
            expect(result).toContain("font-family: 'OpenDyslexic'");
            expect(result).toContain('font-display: swap');
        });

        test('should include body/main/article font-family rule', () => {
            const result = GlobalFontGenerator.generateCss('andika');

            expect(result).toContain('body, main, article');
            expect(result).toContain("font-family: 'Andika'");
            expect(result).toContain('!important');
        });

        test('should use correct paths without basePath', () => {
            const result = GlobalFontGenerator.generateCss('nunito');

            expect(result).toContain("url('fonts/global/nunito/");
        });

        test('should use correct paths with basePath', () => {
            const result = GlobalFontGenerator.generateCss('nunito', '../');

            expect(result).toContain("url('../fonts/global/nunito/");
        });

        test('should generate correct font weights and styles', () => {
            const result = GlobalFontGenerator.generateCss('opendyslexic');

            // Should have regular (400)
            expect(result).toContain('font-weight: 400');
            expect(result).toContain('font-style: normal');

            // Should have bold (700)
            expect(result).toContain('font-weight: 700');

            // Should have italic
            expect(result).toContain('font-style: italic');
        });

        test('should include fallback font in body rule', () => {
            const result = GlobalFontGenerator.generateCss('opendyslexic');

            expect(result).toContain('serif'); // OpenDyslexic fallback
        });

        test('should generate correct CSS for playwrite-es', () => {
            const result = GlobalFontGenerator.generateCss('playwrite-es');

            expect(result).toContain("font-family: 'Playwrite ES'");
            expect(result).toContain('PlaywriteES-Regular.woff2');
        });

        test('should include line-height for fonts that have it defined', () => {
            const result = GlobalFontGenerator.generateCss('playwrite-es');

            expect(result).toContain('line-height: 2em !important');
        });

        test('should not include line-height for fonts without it defined', () => {
            const result = GlobalFontGenerator.generateCss('opendyslexic');

            expect(result).not.toContain('line-height');
        });
    });

    describe('generatePreviewCss', () => {
        test('should return empty string for default font', () => {
            const result = GlobalFontGenerator.generatePreviewCss('default');
            expect(result).toBe('');
        });

        test('should return empty string for invalid font', () => {
            const result = GlobalFontGenerator.generatePreviewCss('invalid-font');
            expect(result).toBe('');
        });

        test('should use absolute server paths', () => {
            const result = GlobalFontGenerator.generatePreviewCss('nunito', '/files/perm');

            expect(result).toContain("url('/files/perm/fonts/global/nunito/");
        });

        test('should use correct baseUrl', () => {
            const result = GlobalFontGenerator.generatePreviewCss('andika', 'http://localhost:8080/v1/files/perm');

            expect(result).toContain("url('http://localhost:8080/v1/files/perm/fonts/global/andika/");
        });

        test('should generate correct preview CSS for playwrite-es', () => {
            const result = GlobalFontGenerator.generatePreviewCss('playwrite-es');

            expect(result).toContain("font-family: 'Playwrite ES'");
            expect(result).toContain('playwrite-es/PlaywriteES-Regular.woff2');
        });
    });

    describe('getFontFilePaths', () => {
        test('should return empty array for default font', () => {
            const result = GlobalFontGenerator.getFontFilePaths('default');
            expect(result).toEqual([]);
        });

        test('should return empty array for invalid font', () => {
            const result = GlobalFontGenerator.getFontFilePaths('invalid-font');
            expect(result).toEqual([]);
        });

        test('should return correct paths for opendyslexic', () => {
            const result = GlobalFontGenerator.getFontFilePaths('opendyslexic');

            expect(result).toHaveLength(4);
            expect(result).toContain('fonts/global/opendyslexic/OpenDyslexic-Regular.woff');
            expect(result).toContain('fonts/global/opendyslexic/OpenDyslexic-Bold.woff');
            expect(result).toContain('fonts/global/opendyslexic/OpenDyslexic-Italic.woff');
            expect(result).toContain('fonts/global/opendyslexic/OpenDyslexic-BoldItalic.woff');
        });

        test('should return correct paths for playwrite-es', () => {
            const result = GlobalFontGenerator.getFontFilePaths('playwrite-es');

            expect(result).toHaveLength(1);
            expect(result).toContain('fonts/global/playwrite-es/PlaywriteES-Regular.woff2');
        });
    });

    describe('getAttribution', () => {
        test('should return null for all fonts (no inline attribution)', () => {
            expect(GlobalFontGenerator.getAttribution('opendyslexic')).toBeNull();
            expect(GlobalFontGenerator.getAttribution('andika')).toBeNull();
            expect(GlobalFontGenerator.getAttribution('nunito')).toBeNull();
            expect(GlobalFontGenerator.getAttribution('playwrite-es')).toBeNull();
        });

        test('should return null for invalid fonts', () => {
            expect(GlobalFontGenerator.getAttribution('invalid')).toBeNull();
        });
    });

    describe('isValidFont', () => {
        test('should return true for valid fonts', () => {
            expect(GlobalFontGenerator.isValidFont('opendyslexic')).toBe(true);
            expect(GlobalFontGenerator.isValidFont('andika')).toBe(true);
            expect(GlobalFontGenerator.isValidFont('nunito')).toBe(true);
            expect(GlobalFontGenerator.isValidFont('playwrite-es')).toBe(true);
        });

        test('should return false for invalid fonts', () => {
            expect(GlobalFontGenerator.isValidFont('invalid')).toBe(false);
            expect(GlobalFontGenerator.isValidFont('')).toBe(false);
        });

        test('should return false for default', () => {
            // 'default' is a special value meaning "use theme default"
            expect(GlobalFontGenerator.isValidFont('default')).toBe(false);
        });
    });

    describe('getFontConfig', () => {
        test('should return font config for valid fonts', () => {
            const config = GlobalFontGenerator.getFontConfig('opendyslexic');
            expect(config).not.toBeNull();
            expect(config?.fontFamily).toBe('OpenDyslexic');
            expect(config?.files.length).toBeGreaterThan(0);
        });

        test('should return null for invalid fonts', () => {
            expect(GlobalFontGenerator.getFontConfig('invalid')).toBeNull();
        });

        test('should return null for empty font id', () => {
            expect(GlobalFontGenerator.getFontConfig('')).toBeNull();
        });
    });

    describe('getAvailableFontIds', () => {
        test('should return all available font IDs', () => {
            const ids = GlobalFontGenerator.getAvailableFontIds();
            expect(ids).toContain('opendyslexic');
            expect(ids).toContain('andika');
            expect(ids).toContain('nunito');
            expect(ids).toContain('playwrite-es');
        });

        test('should not include default', () => {
            const ids = GlobalFontGenerator.getAvailableFontIds();
            expect(ids).not.toContain('default');
        });
    });

    describe('getBodyClassName', () => {
        test('should return correct class name for valid fonts', () => {
            expect(GlobalFontGenerator.getBodyClassName('opendyslexic')).toBe('exe-global-font-opendyslexic');
            expect(GlobalFontGenerator.getBodyClassName('andika')).toBe('exe-global-font-andika');
            expect(GlobalFontGenerator.getBodyClassName('nunito')).toBe('exe-global-font-nunito');
            expect(GlobalFontGenerator.getBodyClassName('playwrite-es')).toBe('exe-global-font-playwrite-es');
        });

        test('should return empty string for default font', () => {
            expect(GlobalFontGenerator.getBodyClassName('default')).toBe('');
        });

        test('should return empty string for empty string', () => {
            expect(GlobalFontGenerator.getBodyClassName('')).toBe('');
        });

        test('should return class name even for unknown fonts', () => {
            // getBodyClassName doesn't validate font existence, it just generates the class name
            expect(GlobalFontGenerator.getBodyClassName('unknown-font')).toBe('exe-global-font-unknown-font');
        });
    });
});
