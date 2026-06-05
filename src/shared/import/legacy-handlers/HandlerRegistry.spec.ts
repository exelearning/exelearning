/**
 * HandlerRegistry Unit Tests
 *
 * Tests for the legacy iDevice handler registry.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName } from './HandlerRegistry';

import { DefaultHandler } from './DefaultHandler';
import { FreeTextHandler } from './FreeTextHandler';
import { MultichoiceHandler } from './MultichoiceHandler';
import { TrueFalseHandler } from './TrueFalseHandler';
import { GalleryHandler } from './GalleryHandler';
import { CaseStudyHandler } from './CaseStudyHandler';
import { GameHandler } from './GameHandler';

describe('HandlerRegistry', () => {
    beforeEach(() => {
        LegacyHandlerRegistry.reset();
    });

    afterEach(() => {
        LegacyHandlerRegistry.reset();
    });

    describe('LEGACY_TYPE_MAP', () => {
        it('should map FreeTextIdevice to text', () => {
            expect(LEGACY_TYPE_MAP.FreeTextIdevice).toBe('text');
        });

        it('should map MultichoiceIdevice to form', () => {
            expect(LEGACY_TYPE_MAP.MultichoiceIdevice).toBe('form');
        });

        it('should map TrueFalseIdevice to trueorfalse', () => {
            expect(LEGACY_TYPE_MAP.TrueFalseIdevice).toBe('trueorfalse');
        });

        it('should map CaseStudyIdevice to casestudy', () => {
            expect(LEGACY_TYPE_MAP.CaseStudyIdevice).toBe('casestudy');
        });

        it('should map ImageGalleryIdevice to image-gallery', () => {
            expect(LEGACY_TYPE_MAP.ImageGalleryIdevice).toBe('image-gallery');
        });

        it('should map ExternalUrlIdevice to external-website', () => {
            expect(LEGACY_TYPE_MAP.ExternalUrlIdevice).toBe('external-website');
        });

        it('should map GeogebraIdevice to geogebra-activity', () => {
            expect(LEGACY_TYPE_MAP.GeogebraIdevice).toBe('geogebra-activity');
        });

        it('should map ImageMagnifierIdevice to magnifier', () => {
            expect(LEGACY_TYPE_MAP.ImageMagnifierIdevice).toBe('magnifier');
        });

        it('should map WikipediaIdevice to text', () => {
            expect(LEGACY_TYPE_MAP.WikipediaIdevice).toBe('text');
        });

        it('should map RssIdevice to text', () => {
            expect(LEGACY_TYPE_MAP.RssIdevice).toBe('text');
        });

        it('should map FPD variants correctly', () => {
            expect(LEGACY_TYPE_MAP.FreeTextfpdIdevice).toBe('text');
            expect(LEGACY_TYPE_MAP.ReflectionfpdIdevice).toBe('text');
            expect(LEGACY_TYPE_MAP.VerdaderoFalsoFPDIdevice).toBe('trueorfalse');
        });
    });

    describe('getLegacyTypeName', () => {
        it('should extract type from full class path', () => {
            expect(getLegacyTypeName('exe.engine.freetextidevice.FreeTextIdevice')).toBe('text');
        });

        it('should handle simple class names', () => {
            expect(getLegacyTypeName('MultichoiceIdevice')).toBe('form');
        });

        it('should return text for empty string', () => {
            expect(getLegacyTypeName('')).toBe('text');
        });

        it('should convert unknown classes to kebab-case', () => {
            expect(getLegacyTypeName('CustomNewIdevice')).toBe('custom-new');
        });

        it('should remove FPD suffix', () => {
            expect(getLegacyTypeName('SomethingFpdIdevice')).toBe('something');
        });

        it('should handle nested class names', () => {
            expect(getLegacyTypeName('exe.engine.truefalseidevice.TrueFalseIdevice')).toBe('trueorfalse');
        });

        it('should normalize case variations', () => {
            // These aren't in the map but should be normalized
            expect(getLegacyTypeName('NewFeatureIdevice')).toBe('new-feature');
        });
    });

    describe('LegacyHandlerRegistry.getHandler', () => {
        it('should return FreeTextHandler for FreeTextIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.freetextidevice.FreeTextIdevice');
            expect(handler).toBeInstanceOf(FreeTextHandler);
        });

        it('should return MultichoiceHandler for MultichoiceIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.multichoiceidevice.MultichoiceIdevice');
            expect(handler).toBeInstanceOf(MultichoiceHandler);
        });

        it('should return TrueFalseHandler for TrueFalseIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.truefalseidevice.TrueFalseIdevice');
            expect(handler).toBeInstanceOf(TrueFalseHandler);
        });

        it('should return GalleryHandler for ImageGalleryIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.galleryidevice.ImageGalleryIdevice');
            expect(handler).toBeInstanceOf(GalleryHandler);
        });

        it('should return CaseStudyHandler for CaseStudyIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.casestudyidevice.CaseStudyIdevice');
            expect(handler).toBeInstanceOf(CaseStudyHandler);
        });

        it('should return GameHandler for JsIdevice with flipcards type', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.jsidevice.JsIdevice', 'flipcards-activity');
            expect(handler).toBeInstanceOf(GameHandler);
        });

        it('should return GameHandler for JsIdevice with selecciona type', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.jsidevice.JsIdevice', 'selecciona-activity');
            expect(handler).toBeInstanceOf(GameHandler);
        });

        it('should return DefaultHandler for unknown class', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.unknownidevice.UnknownIdevice');
            expect(handler).toBeInstanceOf(DefaultHandler);
        });

        it('should handle Spanish variant classes', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.verdaderofalso.VerdaderoFalsoFPDIdevice');
            expect(handler).toBeInstanceOf(TrueFalseHandler);
        });

        it('should return FreeTextHandler for ReflectionIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.reflectionidevice.ReflectionIdevice');
            expect(handler).toBeInstanceOf(FreeTextHandler);
        });

        it('should return FreeTextHandler for GenericIdevice', () => {
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.genericidevice.GenericIdevice');
            expect(handler).toBeInstanceOf(FreeTextHandler);
        });
    });

    describe('LegacyHandlerRegistry.getAllHandlers', () => {
        it('should return array of handlers', () => {
            const handlers = LegacyHandlerRegistry.getAllHandlers();
            expect(Array.isArray(handlers)).toBe(true);
            expect(handlers.length).toBeGreaterThan(0);
        });

        it('should include DefaultHandler as last handler', () => {
            const handlers = LegacyHandlerRegistry.getAllHandlers();
            const lastHandler = handlers[handlers.length - 1];
            expect(lastHandler).toBeInstanceOf(DefaultHandler);
        });

        it('should return copies, not original array', () => {
            const handlers1 = LegacyHandlerRegistry.getAllHandlers();
            const handlers2 = LegacyHandlerRegistry.getAllHandlers();
            expect(handlers1).not.toBe(handlers2);
        });

        it('should have at least 18 handlers', () => {
            const handlers = LegacyHandlerRegistry.getAllHandlers();
            // We have 17 specific handlers + 1 DefaultHandler
            expect(handlers.length).toBeGreaterThanOrEqual(18);
        });
    });

    describe('LegacyHandlerRegistry.reset', () => {
        it('should allow handlers to be reinitialized', () => {
            // Get handlers first time
            const handlers1 = LegacyHandlerRegistry.getAllHandlers();

            // Reset
            LegacyHandlerRegistry.reset();

            // Get handlers again
            const handlers2 = LegacyHandlerRegistry.getAllHandlers();

            // Should be equal in length but different instances
            expect(handlers1.length).toBe(handlers2.length);
            expect(handlers1[0]).not.toBe(handlers2[0]);
        });
    });

    describe('Handler priority', () => {
        it('should select MultichoiceHandler before FreeTextHandler', () => {
            // Both might match certain classes, but MultichoiceHandler should come first
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.multichoiceidevice.MultichoiceIdevice');
            expect(handler).toBeInstanceOf(MultichoiceHandler);
        });

        it('should select specific handlers before DefaultHandler', () => {
            // Any known class should not go to DefaultHandler
            const handler = LegacyHandlerRegistry.getHandler('exe.engine.freetextidevice.FreeTextIdevice');
            expect(handler).not.toBeInstanceOf(DefaultHandler);
        });
    });
});
