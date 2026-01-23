/**
 * Individual Handler Unit Tests
 *
 * Tests for each legacy iDevice handler's canHandle, getTargetType, and getBlockProperties.
 *
 * Note: Tests for extractHtmlView, extractFeedback, and extractProperties methods
 * are covered by integration tests through LegacyXmlParser since they require
 * complex DOM operations that @xmldom/xmldom doesn't fully support.
 */

import { describe, it, expect, beforeEach } from 'bun:test';

// Import all handlers
import { DefaultHandler } from './DefaultHandler';
import { FreeTextHandler } from './FreeTextHandler';
import { MultichoiceHandler } from './MultichoiceHandler';
import { TrueFalseHandler } from './TrueFalseHandler';
import { FillHandler } from './FillHandler';
import { DropdownHandler } from './DropdownHandler';
import { ScormTestHandler } from './ScormTestHandler';
import { CaseStudyHandler } from './CaseStudyHandler';
import { GalleryHandler } from './GalleryHandler';
import { ExternalUrlHandler } from './ExternalUrlHandler';
import { FileAttachHandler } from './FileAttachHandler';
import { ImageMagnifierHandler } from './ImageMagnifierHandler';
import { GeogebraHandler } from './GeogebraHandler';
import { InteractiveVideoHandler } from './InteractiveVideoHandler';
import { GameHandler } from './GameHandler';
import { FpdSolvedExerciseHandler } from './FpdSolvedExerciseHandler';
import { WikipediaHandler } from './WikipediaHandler';
import { RssHandler } from './RssHandler';
import { NotaHandler } from './NotaHandler';

describe('DefaultHandler', () => {
    let handler: DefaultHandler;

    beforeEach(() => {
        handler = new DefaultHandler();
    });

    describe('canHandle', () => {
        it('should handle any class name', () => {
            expect(handler.canHandle('AnyClass')).toBe(true);
        });

        it('should handle empty string', () => {
            expect(handler.canHandle('')).toBe(true);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('FreeTextHandler', () => {
    let handler: FreeTextHandler;

    beforeEach(() => {
        handler = new FreeTextHandler();
    });

    describe('canHandle', () => {
        it('should handle FreeTextIdevice', () => {
            expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(true);
        });

        it('should handle FreeTextfpdIdevice', () => {
            expect(handler.canHandle('FreeTextfpdIdevice')).toBe(true);
        });

        it('should handle ReflectionIdevice', () => {
            expect(handler.canHandle('ReflectionIdevice')).toBe(true);
        });

        it('should handle GenericIdevice', () => {
            expect(handler.canHandle('GenericIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });

        it('should not handle ObjectivesIdevice (handled by DefaultHandler)', () => {
            // ObjectivesIdevice is not in FreeTextHandler's canHandle list
            expect(handler.canHandle('ObjectivesIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('MultichoiceHandler', () => {
    let handler: MultichoiceHandler;

    beforeEach(() => {
        handler = new MultichoiceHandler();
    });

    describe('canHandle', () => {
        it('should handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(true);
        });

        it('should handle MultiSelectIdevice', () => {
            expect(handler.canHandle('MultiSelectIdevice')).toBe(true);
        });

        it('should not handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });
});

describe('TrueFalseHandler', () => {
    let handler: TrueFalseHandler;

    beforeEach(() => {
        handler = new TrueFalseHandler();
    });

    describe('canHandle', () => {
        it('should handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(true);
        });

        it('should handle VerdaderoFalsoFPDIdevice', () => {
            expect(handler.canHandle('VerdaderoFalsoFPDIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return trueorfalse', () => {
            expect(handler.getTargetType()).toBe('trueorfalse');
        });
    });
});

describe('FillHandler', () => {
    let handler: FillHandler;

    beforeEach(() => {
        handler = new FillHandler();
    });

    describe('canHandle', () => {
        it('should handle ClozeIdevice', () => {
            expect(handler.canHandle('ClozeIdevice')).toBe(true);
        });

        it('should handle ClozeActivityIdevice', () => {
            expect(handler.canHandle('ClozeActivityIdevice')).toBe(true);
        });

        it('should handle ClozeLanguageIdevice', () => {
            expect(handler.canHandle('ClozeLanguageIdevice')).toBe(true);
        });

        it('should handle ClozeLangIdevice', () => {
            expect(handler.canHandle('ClozeLangIdevice')).toBe(true);
        });

        it('should not handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });
});

describe('DropdownHandler', () => {
    let handler: DropdownHandler;

    beforeEach(() => {
        handler = new DropdownHandler();
    });

    describe('canHandle', () => {
        it('should handle ListaIdevice', () => {
            expect(handler.canHandle('ListaIdevice')).toBe(true);
        });

        it('should not handle ClozeIdevice', () => {
            expect(handler.canHandle('ClozeIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });
});

describe('ScormTestHandler', () => {
    let handler: ScormTestHandler;

    beforeEach(() => {
        handler = new ScormTestHandler();
    });

    describe('canHandle', () => {
        it('should handle ScormTestIdevice', () => {
            expect(handler.canHandle('ScormTestIdevice')).toBe(true);
        });

        it('should handle QuizTestIdevice', () => {
            expect(handler.canHandle('QuizTestIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });
});

describe('CaseStudyHandler', () => {
    let handler: CaseStudyHandler;

    beforeEach(() => {
        handler = new CaseStudyHandler();
    });

    describe('canHandle', () => {
        it('should handle CaseStudyIdevice', () => {
            expect(handler.canHandle('CaseStudyIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return casestudy', () => {
            expect(handler.getTargetType()).toBe('casestudy');
        });
    });
});

describe('GalleryHandler', () => {
    let handler: GalleryHandler;

    beforeEach(() => {
        handler = new GalleryHandler();
    });

    describe('canHandle', () => {
        it('should handle ImageGalleryIdevice', () => {
            expect(handler.canHandle('ImageGalleryIdevice')).toBe(true);
        });

        it('should handle GalleryIdevice', () => {
            expect(handler.canHandle('GalleryIdevice')).toBe(true);
        });

        it('should not handle ImageMagnifierIdevice', () => {
            expect(handler.canHandle('ImageMagnifierIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return image-gallery', () => {
            expect(handler.getTargetType()).toBe('image-gallery');
        });
    });
});

describe('ExternalUrlHandler', () => {
    let handler: ExternalUrlHandler;

    beforeEach(() => {
        handler = new ExternalUrlHandler();
    });

    describe('canHandle', () => {
        it('should handle ExternalUrlIdevice', () => {
            expect(handler.canHandle('ExternalUrlIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return external-website', () => {
            expect(handler.getTargetType()).toBe('external-website');
        });
    });
});

describe('FileAttachHandler', () => {
    let handler: FileAttachHandler;

    beforeEach(() => {
        handler = new FileAttachHandler();
    });

    describe('canHandle', () => {
        it('should handle FileAttachIdevice', () => {
            expect(handler.canHandle('FileAttachIdevice')).toBe(true);
        });

        it('should handle FileAttachIdeviceInc', () => {
            expect(handler.canHandle('FileAttachIdeviceInc')).toBe(true);
        });

        it('should handle AttachmentIdevice', () => {
            expect(handler.canHandle('AttachmentIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('ImageMagnifierHandler', () => {
    let handler: ImageMagnifierHandler;

    beforeEach(() => {
        handler = new ImageMagnifierHandler();
    });

    describe('canHandle', () => {
        it('should handle ImageMagnifierIdevice', () => {
            expect(handler.canHandle('ImageMagnifierIdevice')).toBe(true);
        });

        it('should not handle ImageGalleryIdevice', () => {
            expect(handler.canHandle('ImageGalleryIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return magnifier', () => {
            expect(handler.getTargetType()).toBe('magnifier');
        });
    });
});

describe('GeogebraHandler', () => {
    let handler: GeogebraHandler;

    beforeEach(() => {
        handler = new GeogebraHandler();
    });

    describe('canHandle', () => {
        it('should handle GeogebraIdevice', () => {
            expect(handler.canHandle('GeogebraIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return geogebra-activity', () => {
            expect(handler.getTargetType()).toBe('geogebra-activity');
        });
    });
});

describe('InteractiveVideoHandler', () => {
    let handler: InteractiveVideoHandler;

    beforeEach(() => {
        handler = new InteractiveVideoHandler();
    });

    describe('canHandle', () => {
        it('should handle JsIdevice with interactive-video type', () => {
            expect(handler.canHandle('JsIdevice', 'interactive-video')).toBe(true);
        });

        it('should not handle JsIdevice with flipcards type', () => {
            expect(handler.canHandle('JsIdevice', 'flipcards')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return interactive-video', () => {
            expect(handler.getTargetType()).toBe('interactive-video');
        });
    });
});

describe('GameHandler', () => {
    let handler: GameHandler;

    beforeEach(() => {
        handler = new GameHandler();
    });

    describe('canHandle', () => {
        it('should handle JsIdevice with flipcards type', () => {
            expect(handler.canHandle('JsIdevice', 'flipcards-activity')).toBe(true);
        });

        it('should handle JsIdevice with selecciona type', () => {
            expect(handler.canHandle('JsIdevice', 'selecciona-activity')).toBe(true);
        });

        it('should handle JsIdevice with trivial type', () => {
            expect(handler.canHandle('JsIdevice', 'trivial-activity')).toBe(true);
        });

        it('should handle JsIdevice with crossword type', () => {
            expect(handler.canHandle('JsIdevice', 'crossword-activity')).toBe(true);
        });

        it('should handle class name containing flipcards', () => {
            expect(handler.canHandle('FlipcardsIdevice')).toBe(true);
        });

        it('should not handle JsIdevice with interactive-video type', () => {
            expect(handler.canHandle('JsIdevice', 'interactive-video')).toBe(false);
        });

        it('should handle Spanish game types', () => {
            expect(handler.canHandle('JsIdevice', 'sopa-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'crucigrama-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'rosco-activity')).toBe(true);
        });
    });

    describe('getTargetType', () => {
        it('should return flipcards for flipcards type', () => {
            handler.canHandle('JsIdevice', 'flipcards-activity');
            expect(handler.getTargetType()).toBe('flipcards');
        });

        it('should map selecciona to quick-questions-multiple-choice', () => {
            handler.canHandle('JsIdevice', 'selecciona-activity');
            expect(handler.getTargetType()).toBe('quick-questions-multiple-choice');
        });

        it('should map sopa to word-search', () => {
            handler.canHandle('JsIdevice', 'sopa-activity');
            expect(handler.getTargetType()).toBe('word-search');
        });

        it('should map crucigrama to crossword', () => {
            handler.canHandle('JsIdevice', 'crucigrama-activity');
            expect(handler.getTargetType()).toBe('crossword');
        });

        it('should map rosco to az-quiz-game', () => {
            handler.canHandle('JsIdevice', 'rosco-activity');
            expect(handler.getTargetType()).toBe('az-quiz-game');
        });

        it('should return text as fallback when no type detected', () => {
            const newHandler = new GameHandler();
            expect(newHandler.getTargetType()).toBe('text');
        });
    });
});

describe('FpdSolvedExerciseHandler', () => {
    let handler: FpdSolvedExerciseHandler;

    beforeEach(() => {
        handler = new FpdSolvedExerciseHandler();
    });

    describe('canHandle', () => {
        it('should handle SolvedExerciseIdevice', () => {
            expect(handler.canHandle('SolvedExerciseIdevice')).toBe(true);
        });

        it('should handle EjercicioResueltoFpdIdevice', () => {
            expect(handler.canHandle('EjercicioResueltoFpdIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('WikipediaHandler', () => {
    let handler: WikipediaHandler;

    beforeEach(() => {
        handler = new WikipediaHandler();
    });

    describe('canHandle', () => {
        it('should handle WikipediaIdevice', () => {
            expect(handler.canHandle('WikipediaIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('RssHandler', () => {
    let handler: RssHandler;

    beforeEach(() => {
        handler = new RssHandler();
    });

    describe('canHandle', () => {
        it('should handle RssIdevice', () => {
            expect(handler.canHandle('RssIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });
});

describe('NotaHandler', () => {
    let handler: NotaHandler;

    beforeEach(() => {
        handler = new NotaHandler();
    });

    describe('canHandle', () => {
        it('should handle NotaIdevice', () => {
            expect(handler.canHandle('NotaIdevice')).toBe(true);
        });

        it('should handle NotaInformacionIdevice', () => {
            expect(handler.canHandle('NotaInformacionIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('getBlockProperties', () => {
        it('should return visibility false', () => {
            const props = handler.getBlockProperties();
            expect(props.visibility).toBe('false');
        });
    });
});

describe('isIdeviceHandler type guard', () => {
    it('should be exported from IdeviceHandler', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        expect(typeof isIdeviceHandler).toBe('function');
    });

    it('should return true for handler instances', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        const handler = new FreeTextHandler();
        expect(isIdeviceHandler(handler)).toBe(true);
    });

    it('should return false for non-handler objects', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        expect(isIdeviceHandler({})).toBe(false);
        expect(isIdeviceHandler(null)).toBe(false);
        expect(isIdeviceHandler('string')).toBe(false);
    });
});
