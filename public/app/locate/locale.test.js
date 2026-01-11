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

  it('loadTranslationsStrings populates strings via API and calls translateStaticUI', async () => {
    // Spy on translateStaticUI
    const translateSpy = vi.spyOn(locale, 'translateStaticUI').mockImplementation(() => {});

    await locale.setLocaleLang('es');
    await locale.loadTranslationsStrings();

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('es');
    expect(locale.strings.translations.hello).toBe('~Hola');
    expect(translateSpy).toHaveBeenCalled();
  });

  it('translateStaticUI translates menu elements using _() function', () => {
    // Set up translations
    locale.strings = {
      translations: {
        File: 'Archivo',
        Utilities: 'Utilidades',
      },
    };

    // Create mock DOM elements
    document.body.innerHTML = `
      <a id="dropdownFile">File</a>
      <a id="dropdownUtilities">Utilities</a>
    `;

    locale.translateStaticUI();

    expect(document.querySelector('#dropdownFile').textContent).toBe('Archivo');
    expect(document.querySelector('#dropdownUtilities').textContent).toBe('Utilidades');
  });

  describe('translateStaticUI - icon handling', () => {
    beforeEach(() => {
      locale.strings = {
        translations: {
          'Recent projects': 'Proyectos recientes',
          'New': 'Nuevo',
          'Save': 'Guardar',
          'Open': 'Abrir',
          'Preview': 'Vista previa',
        },
      };
    });

    it('should translate element with span icon and place text after icon', () => {
      document.body.innerHTML = `
        <a id="navbar-button-dropdown-recent-projects">
          <span class="small-icon recent-icon-green"></span> Recent projects
        </a>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-dropdown-recent-projects');
      expect(el.textContent.trim()).toBe('Proyectos recientes');
      // Icon should still be there
      expect(el.querySelector('span.small-icon')).not.toBeNull();
    });

    it('should translate element with div icon', () => {
      document.body.innerHTML = `
        <button id="navbar-button-new">
          <div class="small-icon new-icon-green"></div> New
        </button>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-new');
      expect(el.textContent.trim()).toBe('Nuevo');
      expect(el.querySelector('div.small-icon')).not.toBeNull();
    });

    it('should remove duplicate text nodes and add only one after icon', () => {
      // Simulate the bug case where text appears both before and after icon
      document.body.innerHTML = `
        <a id="navbar-button-dropdown-recent-projects">
          Recent projects<span class="small-icon recent-icon-green"></span> Recent projects
        </a>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-dropdown-recent-projects');
      // Should only have the icon and one text node after it
      expect(el.textContent.trim()).toBe('Proyectos recientes');
      // Count text content occurrences
      const textContent = el.textContent;
      const count = (textContent.match(/Proyectos recientes/g) || []).length;
      expect(count).toBe(1);
    });

    it('should handle element with icon but no existing text nodes', () => {
      document.body.innerHTML = `
        <a id="navbar-button-dropdown-recent-projects">
          <span class="small-icon recent-icon-green"></span>
        </a>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-dropdown-recent-projects');
      expect(el.textContent).toContain('Proyectos recientes');
    });
  });

  describe('translateStaticUI - button/link handling', () => {
    beforeEach(() => {
      locale.strings = {
        translations: {
          'Save': 'Guardar',
          'Open': 'Abrir',
        },
      };
    });

    it('should translate link without icon', () => {
      document.body.innerHTML = `
        <a id="navbar-button-save">Save</a>
      `;

      locale.translateStaticUI();

      expect(document.querySelector('#navbar-button-save').textContent).toBe('Guardar');
    });

    it('should translate button without icon', () => {
      document.body.innerHTML = `
        <button id="navbar-button-save">Save</button>
      `;

      locale.translateStaticUI();

      expect(document.querySelector('#navbar-button-save').textContent).toBe('Guardar');
    });

    it('should preserve child elements when translating', () => {
      document.body.innerHTML = `
        <a id="navbar-button-save">Save<kbd>Ctrl+S</kbd></a>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-save');
      expect(el.querySelector('kbd')).not.toBeNull();
      expect(el.querySelector('kbd').textContent).toBe('Ctrl+S');
    });
  });

  describe('translateStaticUI - span elements', () => {
    beforeEach(() => {
      locale.strings = {
        translations: {
          'Save': 'Guardar',
        },
      };
    });

    it('should translate span element inside save button', () => {
      document.body.innerHTML = `
        <button id="head-top-save-button">
          <div class="small-icon save-icon-white"></div>
          <span>Save</span>
        </button>
      `;

      locale.translateStaticUI();

      const span = document.querySelector('#head-top-save-button > span:not([class*="icon"])');
      expect(span.textContent).toBe('Guardar');
    });
  });

  describe('translateStaticUI - modal titles', () => {
    beforeEach(() => {
      locale.strings = {
        translations: {
          'Preferences': 'Preferencias',
          'About eXeLearning': 'Acerca de eXeLearning',
        },
      };
    });

    it('should translate modal titles', () => {
      document.body.innerHTML = `
        <div id="modalProperties">
          <div class="modal-title">Preferences</div>
        </div>
        <div id="modalAbout">
          <div class="modal-title">About eXeLearning</div>
        </div>
      `;

      locale.translateStaticUI();

      expect(document.querySelector('#modalProperties .modal-title').textContent).toBe('Preferencias');
      expect(document.querySelector('#modalAbout .modal-title').textContent).toBe('Acerca de eXeLearning');
    });
  });

  describe('translateStaticUI - no matching elements', () => {
    it('should not throw when elements do not exist', () => {
      locale.strings = {
        translations: {
          'File': 'Archivo',
        },
      };
      document.body.innerHTML = '<div>Empty</div>';

      expect(() => locale.translateStaticUI()).not.toThrow();
    });
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

  it('loadContentTranslationsStrings stores content translations from the API', async () => {
    const contentPayload = {
      translations: {
        notes: 'Notas',
      },
    };
    mockApp.api.getTranslations.mockResolvedValueOnce(contentPayload);

    await locale.loadContentTranslationsStrings('en');

    expect(mockApp.api.getTranslations).toHaveBeenCalledWith('en');
    expect(locale.c_strings).toBe(contentPayload);
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

  describe('translateStaticUI - icon with existing text sibling', () => {
    beforeEach(() => {
      locale.strings = {
        translations: {
          'Save': 'Guardar',
        },
      };
    });

    it('should update existing text node after icon instead of creating new one', () => {
      // Create element with icon followed by text node
      document.body.innerHTML = `
        <a id="navbar-button-save"><span class="small-icon save-icon"></span> Save</a>
      `;

      locale.translateStaticUI();

      const el = document.querySelector('#navbar-button-save');
      // Should have updated the text node, not created a new one
      expect(el.textContent.trim()).toBe('Guardar');
      // Count child nodes - should be icon + one text node
      const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
      expect(textNodes.length).toBe(1);
    });
  });
});
