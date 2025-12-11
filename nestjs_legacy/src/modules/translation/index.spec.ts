/**
 * Tests for translation module exports
 * Ensures all public API is properly exported from index.ts
 */
import * as TranslationModule from './index';

describe('Translation Module Exports', () => {
    describe('Module export', () => {
        it('should export TranslationModule', () => {
            expect(TranslationModule.TranslationModule).toBeDefined();
        });
    });

    describe('Service exports', () => {
        it('should export TranslationService', () => {
            expect(TranslationModule.TranslationService).toBeDefined();
        });

        it('should export XlfParserService', () => {
            expect(TranslationModule.XlfParserService).toBeDefined();
        });

        it('should export CommonI18nService', () => {
            expect(TranslationModule.CommonI18nService).toBeDefined();
        });

        it('should export LocaleService', () => {
            expect(TranslationModule.LocaleService).toBeDefined();
        });
    });

    describe('Constant exports', () => {
        it('should export LOCALES', () => {
            expect(TranslationModule.LOCALES).toBeDefined();
            expect(typeof TranslationModule.LOCALES).toBe('object');
        });

        it('should export DEFAULT_LOCALE', () => {
            expect(TranslationModule.DEFAULT_LOCALE).toBeDefined();
            expect(typeof TranslationModule.DEFAULT_LOCALE).toBe('string');
        });

        it('should export PACKAGE_LOCALES', () => {
            expect(TranslationModule.PACKAGE_LOCALES).toBeDefined();
            expect(typeof TranslationModule.PACKAGE_LOCALES).toBe('object');
        });

        it('should export TRANSLATION_CONSTANTS', () => {
            expect(TranslationModule.TRANSLATION_CONSTANTS).toBeDefined();
            expect(TranslationModule.TRANSLATION_CONSTANTS.FILENAME).toBe('messages');
        });
    });

    describe('DTO exports', () => {
        it('should export TranslationListDto', () => {
            expect(TranslationModule.TranslationListDto).toBeDefined();
        });

        it('should export TranslationResponseDto', () => {
            expect(TranslationModule.TranslationResponseDto).toBeDefined();
        });

        it('should allow creating DTO instances', () => {
            const listDto = new TranslationModule.TranslationListDto();
            expect(listDto).toBeInstanceOf(TranslationModule.TranslationListDto);

            const responseDto = new TranslationModule.TranslationResponseDto();
            expect(responseDto).toBeInstanceOf(TranslationModule.TranslationResponseDto);
        });
    });

    describe('Interface exports', () => {
        it('should export Translation interface (via type checking)', () => {
            // TypeScript interfaces don't exist at runtime, but we can verify
            // the module compiles and exports are accessible
            const exports = Object.keys(TranslationModule);
            expect(exports.length).toBeGreaterThan(0);
        });
    });

    describe('Export completeness', () => {
        it('should export all expected items', () => {
            const expectedExports = [
                'TranslationModule',
                'TranslationService',
                'XlfParserService',
                'CommonI18nService',
                'LocaleService',
                'LOCALES',
                'DEFAULT_LOCALE',
                'PACKAGE_LOCALES',
                'TRANSLATION_CONSTANTS',
                'TranslationListDto',
                'TranslationResponseDto',
            ];

            expectedExports.forEach((exportName) => {
                expect(TranslationModule).toHaveProperty(exportName);
            });
        });
    });
});
