import { beforeEach, describe, expect, it, vi } from 'vitest';
import Locale from './locale.js';

describe('Locale translations', () => {
  let locale;
  let mockApp;
  let translations;
  let contentTranslations;
  const originalWindow = window;

  beforeEach(() => {
    document.body.innerHTML = '<body></body>';
    translations = {
      translations: {
        hello: '~Hola',
        escaped: '\\"quoted\\"',
        'idevice.hello': 'Idevice Hola',
      },
    };
    contentTranslations = {
      translations: {
        content: '~Contenido',
        slash: 'path\\/resource',
      },
    };
    mockApp = {
      eXeLearning: {
        config: {
          locale: 'es',
        },
      },
      api: {
        getTranslations: vi.fn().mockResolvedValue(translations),
      },
    };
    locale = new Locale(mockApp);
  });

  afterEach(() => {
    window._ = () => undefined;
    window.c_ = () => undefined;
    vi.restoreAllMocks();
  });

  it('sets locale language attribute when setLocaleLang called', async () => {
    await locale.setLocaleLang('fr');
    expect(document.querySelector('body').getAttribute('lang')).toBe('fr');
  });

  it('loadTranslationsStrings populates strings via api', async () => {
    await locale.setLocaleLang('es');
    await locale.loadTranslationsStrings();

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('es');
    // The result object is stored directly, with translations in the translations property
    expect(locale.strings.translations.hello).toBe('~Hola');
  });

  it('getGUITranslation returns cleaned translation with tilde removed', () => {
    locale.strings = translations;
    expect(locale.getGUITranslation('hello')).toBe('Hola');
    expect(locale.getGUITranslation('escaped')).toBe('"quoted"');
    expect(locale.getGUITranslation(null)).toBe('');
  });

  it('getContentTranslation resolves content translations and strips tilde', () => {
    locale.c_strings = contentTranslations;
    expect(locale.getContentTranslation('content')).toBe('Contenido');
    expect(locale.getContentTranslation('slash')).toBe('path/resource');
    expect(locale.getContentTranslation(123)).toBe('');
  });

  it('getTranslation resolves idevice-specific keys before default', () => {
    locale.strings = translations;
    expect(locale.getTranslation('hello', null, 'idevice')).toBe('Idevice Hola');
    expect(locale.getTranslation('hello')).toBe('~Hola');
    expect(locale.getTranslation('missing')).toBe('missing');
  });

  it('window _ and c_ helpers delegate to translation helpers and adjust elp suffix', () => {
    locale.strings = translations;
    locale.c_strings = contentTranslations;

    const guiResult = window._('hello');
    const contentResult = window.c_('file.elp');

    expect(guiResult).toBe('Hola');
    expect(contentResult).toBe('file.elpx');
  });

  it('window _ with idevice parameter uses idevice-specific translation', () => {
    locale.strings = translations; // Already includes 'idevice.hello': 'Idevice Hola'

    // Without idevice: uses getGUITranslation (removes ~ prefix)
    expect(window._('hello')).toBe('Hola');

    // With idevice: uses getTranslation with idevice support
    expect(window._('hello', 'idevice')).toBe('Idevice Hola');
  });

  it('loadContentTranslationsStrings stores content translations from api', async () => {
    const contentPayload = {
      translations: {
        notes: 'Notas',
      },
    };
    mockApp.api.getTranslations.mockResolvedValueOnce(contentPayload);

    await locale.loadContentTranslationsStrings('en');

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('en');
    // The result object is stored directly, with translations in the translations property
    expect(locale.c_strings).toEqual({ translations: { notes: 'Notas' } });
  });

  it('getContentTranslation returns sanitized fallback when missing', () => {
    locale.c_strings = { translations: {} };

    expect(locale.getContentTranslation('path\\/to\\"file')).toBe('path/to\\"file');
  });

  it('getTranslation returns empty for non-string inputs', () => {
    expect(locale.getTranslation(123)).toBe('');
  });

  describe('init', () => {
    it('should call setLocaleLang and loadTranslationsStrings', async () => {
      const setLocaleLangSpy = vi.spyOn(locale, 'setLocaleLang').mockImplementation(() => {});
      const loadTranslationsSpy = vi.spyOn(locale, 'loadTranslationsStrings').mockResolvedValue();

      await locale.init();

      expect(setLocaleLangSpy).toHaveBeenCalledWith('es');
      expect(loadTranslationsSpy).toHaveBeenCalled();
    });
  });

  describe('getGUITranslation edge cases', () => {
    it('should return original string with escaped quotes removed when key not found', () => {
      locale.strings = { translations: {} };
      expect(locale.getGUITranslation('unknown key')).toBe('unknown key');
    });

    it('should handle string with quotes when key not found', () => {
      locale.strings = { translations: {} };
      expect(locale.getGUITranslation('text "quoted"')).toBe('text "quoted"');
    });
  });
});
