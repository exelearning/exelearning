/**
 * handlerRegistry Tests
 *
 * Unit tests for LegacyHandlerRegistry and type mapping utilities.
 */

// Load BaseLegacyHandler first and make it global
const BaseLegacyHandler = require('./BaseLegacyHandler');
global.BaseLegacyHandler = BaseLegacyHandler;

// Load handlers and make them global
global.MultichoiceHandler = require('./handlers/MultichoiceHandler');
global.TrueFalseHandler = require('./handlers/TrueFalseHandler');
global.FillHandler = require('./handlers/FillHandler');
global.DropdownHandler = require('./handlers/DropdownHandler');
global.ScormTestHandler = require('./handlers/ScormTestHandler');
global.CaseStudyHandler = require('./handlers/CaseStudyHandler');
global.GalleryHandler = require('./handlers/GalleryHandler');
global.ExternalUrlHandler = require('./handlers/ExternalUrlHandler');
global.FileAttachHandler = require('./handlers/FileAttachHandler');
global.ImageMagnifierHandler = require('./handlers/ImageMagnifierHandler');
global.GeogebraHandler = require('./handlers/GeogebraHandler');
global.InteractiveVideoHandler = require('./handlers/InteractiveVideoHandler');
global.GameIdeviceHandler = require('./handlers/GameIdeviceHandler');
global.FpdSolvedExerciseHandler = require('./handlers/FpdSolvedExerciseHandler');
global.WikipediaHandler = require('./handlers/WikipediaHandler');
global.RssHandler = require('./handlers/RssHandler');
global.NotaHandler = require('./handlers/NotaHandler');
global.FreeTextHandler = require('./handlers/FreeTextHandler');
global.DefaultHandler = require('./handlers/DefaultHandler');

const { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName } = require('./handlerRegistry');

describe('LegacyHandlerRegistry', () => {
  beforeEach(() => {
    // Reset handlers to force re-initialization
    LegacyHandlerRegistry.handlers = null;
  });

  describe('init', () => {
    it('initializes handlers array', () => {
      LegacyHandlerRegistry.init();
      expect(LegacyHandlerRegistry.handlers).toBeDefined();
      expect(Array.isArray(LegacyHandlerRegistry.handlers)).toBe(true);
      expect(LegacyHandlerRegistry.handlers.length).toBeGreaterThan(0);
    });

    it('only initializes once', () => {
      LegacyHandlerRegistry.init();
      const first = LegacyHandlerRegistry.handlers;
      LegacyHandlerRegistry.init();
      expect(LegacyHandlerRegistry.handlers).toBe(first);
    });

    it('includes DefaultHandler as last handler', () => {
      LegacyHandlerRegistry.init();
      const lastHandler = LegacyHandlerRegistry.handlers[LegacyHandlerRegistry.handlers.length - 1];
      expect(lastHandler.constructor.name).toBe('DefaultHandler');
    });
  });

  describe('getHandler', () => {
    it('returns MultichoiceHandler for MultichoiceIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.multichoiceidevice.MultichoiceIdevice');
      expect(handler.constructor.name).toBe('MultichoiceHandler');
      expect(handler.getTargetType()).toBe('form');
    });

    it('returns MultichoiceHandler for MultiSelectIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.multiselectidevice.MultiSelectIdevice');
      expect(handler.constructor.name).toBe('MultichoiceHandler');
    });

    it('returns TrueFalseHandler for TrueFalseIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.truefalseidevice.TrueFalseIdevice');
      expect(handler.constructor.name).toBe('TrueFalseHandler');
      expect(handler.getTargetType()).toBe('trueorfalse');
    });

    it('returns TrueFalseHandler for VerdaderoFalsoFPDIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.verdaderofalsofpdidevice.VerdaderoFalsoFPDIdevice');
      expect(handler.constructor.name).toBe('TrueFalseHandler');
    });

    it('returns FillHandler for ClozeIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.clozeidevice.ClozeIdevice');
      expect(handler.constructor.name).toBe('FillHandler');
      expect(handler.getTargetType()).toBe('form');
    });

    it('returns DropdownHandler for ListaIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.listaidevice.ListaIdevice');
      expect(handler.constructor.name).toBe('DropdownHandler');
      expect(handler.getTargetType()).toBe('form');
    });

    it('returns CaseStudyHandler for CaseStudyIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.casestudyidevice.CaseStudyIdevice');
      expect(handler.constructor.name).toBe('CaseStudyHandler');
      expect(handler.getTargetType()).toBe('casestudy');
    });

    it('returns GalleryHandler for ImageGalleryIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.imagegalleryidevice.ImageGalleryIdevice');
      expect(handler.constructor.name).toBe('GalleryHandler');
      expect(handler.getTargetType()).toBe('image-gallery');
    });

    it('returns GalleryHandler for GalleryIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.galleryidevice.GalleryIdevice');
      expect(handler.constructor.name).toBe('GalleryHandler');
    });

    it('returns ExternalUrlHandler for ExternalUrlIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.externalurlidevice.ExternalUrlIdevice');
      expect(handler.constructor.name).toBe('ExternalUrlHandler');
      expect(handler.getTargetType()).toBe('external-website');
    });

    it('returns FileAttachHandler for FileAttachIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.fileattachidevice.FileAttachIdevice');
      expect(handler.constructor.name).toBe('FileAttachHandler');
      expect(handler.getTargetType()).toBe('text');
    });

    it('returns FileAttachHandler for AttachmentIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.attachmentidevice.AttachmentIdevice');
      expect(handler.constructor.name).toBe('FileAttachHandler');
    });

    it('returns ImageMagnifierHandler for ImageMagnifierIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.imagemagnifieridevice.ImageMagnifierIdevice');
      expect(handler.constructor.name).toBe('ImageMagnifierHandler');
      expect(handler.getTargetType()).toBe('magnifier');
    });

    it('returns FreeTextHandler for FreeTextIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.freetextidevice.FreeTextIdevice');
      expect(handler.constructor.name).toBe('FreeTextHandler');
      expect(handler.getTargetType()).toBe('text');
    });

    it('returns FreeTextHandler for ReflectionIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.reflectionidevice.ReflectionIdevice');
      expect(handler.constructor.name).toBe('FreeTextHandler');
    });

    it('returns FreeTextHandler for GenericIdevice', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.genericidevice.GenericIdevice');
      expect(handler.constructor.name).toBe('FreeTextHandler');
    });

    it('returns DefaultHandler for unknown iDevice types', () => {
      const handler = LegacyHandlerRegistry.getHandler('exe.engine.unknownidevice.UnknownIdevice');
      expect(handler.constructor.name).toBe('DefaultHandler');
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('getAllHandlers', () => {
    it('returns copy of handlers array', () => {
      const handlers = LegacyHandlerRegistry.getAllHandlers();
      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers).not.toBe(LegacyHandlerRegistry.handlers);
    });

    it('includes all registered handlers', () => {
      const handlers = LegacyHandlerRegistry.getAllHandlers();
      expect(handlers.length).toBe(19); // All handlers including InteractiveVideoHandler, NotaHandler and DefaultHandler
    });
  });
});

describe('LEGACY_TYPE_MAP', () => {
  it('maps FreeTextIdevice to text', () => {
    expect(LEGACY_TYPE_MAP['FreeTextIdevice']).toBe('text');
  });

  it('maps MultichoiceIdevice to form', () => {
    expect(LEGACY_TYPE_MAP['MultichoiceIdevice']).toBe('form');
  });

  it('maps TrueFalseIdevice to trueorfalse', () => {
    expect(LEGACY_TYPE_MAP['TrueFalseIdevice']).toBe('trueorfalse');
  });

  it('maps CaseStudyIdevice to casestudy', () => {
    expect(LEGACY_TYPE_MAP['CaseStudyIdevice']).toBe('casestudy');
  });

  it('maps ImageGalleryIdevice to image-gallery', () => {
    expect(LEGACY_TYPE_MAP['ImageGalleryIdevice']).toBe('image-gallery');
  });

  it('maps ImageMagnifierIdevice to magnifier', () => {
    expect(LEGACY_TYPE_MAP['ImageMagnifierIdevice']).toBe('magnifier');
  });

  it('maps ExternalUrlIdevice to external-website', () => {
    expect(LEGACY_TYPE_MAP['ExternalUrlIdevice']).toBe('external-website');
  });

  it('maps FileAttachIdevice to text', () => {
    expect(LEGACY_TYPE_MAP['FileAttachIdevice']).toBe('text');
  });
});

describe('getLegacyTypeName', () => {
  it('extracts type from full class name', () => {
    expect(getLegacyTypeName('exe.engine.freetextidevice.FreeTextIdevice')).toBe('text');
  });

  it('returns text for null/undefined', () => {
    expect(getLegacyTypeName(null)).toBe('text');
    expect(getLegacyTypeName(undefined)).toBe('text');
  });

  it('uses mapping for known types', () => {
    expect(getLegacyTypeName('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe('form');
  });

  it('normalizes unknown types to kebab-case', () => {
    expect(getLegacyTypeName('exe.engine.customidevice.CustomNewIdevice')).toBe('custom-new');
  });

  it('removes Idevice suffix', () => {
    expect(getLegacyTypeName('exe.engine.test.SomethingIdevice')).toBe('something');
  });

  it('removes fpd suffix', () => {
    expect(getLegacyTypeName('exe.engine.test.TestfpdIdevice')).toBe('test');
  });

  it('returns text for empty normalized result', () => {
    expect(getLegacyTypeName('exe.engine.idevice.Idevice')).toBe('text');
  });
});
