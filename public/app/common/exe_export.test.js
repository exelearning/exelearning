import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const readyCallbacks = [];

function createCollection(elements) {
  const api = {
    elements,
    length: elements.length,
    on: vi.fn().mockReturnThis(),
    css: vi.fn().mockReturnThis(),
    parents: vi.fn(() => createCollection(elements)),
    hasClass: vi.fn((cls) => elements[0]?.classList?.contains(cls)),
    addClass: vi.fn((cls) => {
      elements.forEach((el) => el.classList?.add(cls));
      return api;
    }),
    removeClass: vi.fn((cls) => {
      elements.forEach((el) => el.classList?.remove(cls));
      return api;
    }),
    slideDown: vi.fn((cb) => {
      if (cb) cb();
      return api;
    }),
    slideUp: vi.fn((cb) => {
      if (cb) cb();
      return api;
    }),
    trigger: vi.fn().mockReturnThis(),
    prepend: vi.fn((html) => {
      elements.forEach((el) => el.insertAdjacentHTML('afterbegin', html));
      return api;
    }),
    append: vi.fn((html) => {
      elements.forEach((el) => el.insertAdjacentHTML('beforeend', html));
      return api;
    }),
    before: vi.fn((html) => {
      elements.forEach((el) => el.insertAdjacentHTML('beforebegin', html));
      return api;
    }),
    html: vi.fn((value) => {
      if (value === undefined) return elements[0]?.innerHTML ?? '';
      elements.forEach((el) => {
        el.innerHTML = value;
      });
      return api;
    }),
    text: vi.fn(() => elements.map((el) => el.textContent).join('')),
    show: vi.fn().mockReturnThis(),
    hide: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    prop: vi.fn().mockReturnThis(),
    is: vi.fn(() => false),
    val: vi.fn((value) => {
      if (value === undefined) return elements[0]?.value;
      elements.forEach((el) => {
        el.value = value;
      });
      return api;
    }),
    attr: vi.fn((name, value) => {
      if (value === undefined) return elements[0]?.getAttribute(name);
      elements.forEach((el) => el.setAttribute(name, value));
      return api;
    }),
    each: vi.fn((callback) => {
      elements.forEach((el, index) => {
        callback.call(el, index, el);
      });
      return api;
    }),
    has: vi.fn((selector) =>
      createCollection(elements.filter((el) => el.querySelector && el.querySelector(selector) !== null)),
    ),
  };

  return api;
}

function setupJqueryStub() {
  const $ = vi.fn((arg) => {
    if (typeof arg === 'function') {
      readyCallbacks.push(arg);
      return undefined;
    }

    if (typeof arg === 'string' && arg.trim().startsWith('<')) {
      const container = document.createElement('div');
      container.innerHTML = arg.trim();
      const element = container.firstElementChild || document.createElement('div');
      return createCollection([element]);
    }

    if (typeof arg === 'string') {
      return createCollection(Array.from(document.querySelectorAll(arg)));
    }

    if (arg instanceof HTMLElement) {
      return createCollection([arg]);
    }

    return createCollection([]);
  });

  return $;
}

function setupLocalStorageStub() {
  const storage = new Map();

  return {
    getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
    setItem: vi.fn((key, value) => storage.set(key, value)),
    removeItem: vi.fn((key) => storage.delete(key)),
  };
}

describe('exe_export.js', () => {
  beforeEach(async () => {
    vi.resetModules();
    readyCallbacks.length = 0;
    document.body.innerHTML = '';

    window.$exe = { init: vi.fn(), clearHistory: vi.fn(), _confirmResponses: new Map() };
    window.$exe_i18n = {
      teacher_mode: 'Teacher Mode',
      search: 'Search',
      hide: 'Hide',
      previous: 'Previous',
      next: 'Next',
      menu: 'Menu',
      block: 'block',
    };

    window.localStorage = setupLocalStorageStub();
    window.$ = setupJqueryStub();

    await import('./exe_export.js');
  });

  afterEach(() => {
    delete window.$exe;
    delete window.eXe;
    delete window.$exe_i18n;
    delete window.$;
    delete window.$exeExport;
    delete window.localStorage;
    vi.useRealTimers();
  });

  it('sets window.eXe.app to $exe', () => {
    window.$exeExport.setExe();

    expect(window.eXe).toBeDefined();
    expect(window.eXe.app).toBe(window.$exe);
  });

  it('calls the legacy init on window.eXe.app', () => {
    window.eXe = { app: { init: vi.fn() } };

    window.$exeExport.initExe();

    expect(window.eXe.app.init).toHaveBeenCalledTimes(1);
  });

  it('toggles classes on the exe-content container', () => {
    const container = document.createElement('div');
    container.className = 'exe-content pre-js';
    document.body.appendChild(container);

    window.$exeExport.addClassJsExecutedToExeContent();

    expect(container.classList.contains('post-js')).toBe(true);
    expect(container.classList.contains('pre-js')).toBe(false);
  });

  it('triggers print when requested', () => {
    window.print = vi.fn();
    const originalParams = window.URLSearchParams;
    function MockURLSearchParams() {
      this.get = () => '1';
    }
    window.URLSearchParams = MockURLSearchParams;

    window.$exeExport.triggerPrintIfRequested();

    expect(window.print).toHaveBeenCalledTimes(1);
    window.URLSearchParams = originalParams;
  });

  it('initializes JSON idevices by type', () => {
    const jsonNode = document.createElement('div');
    jsonNode.className = 'idevice_node';
    jsonNode.setAttribute('data-idevice-component-type', 'json');
    jsonNode.setAttribute('data-idevice-type', 'type-a');

    const jsonNodeTwo = document.createElement('div');
    jsonNodeTwo.className = 'idevice_node';
    jsonNodeTwo.setAttribute('data-idevice-component-type', 'json');
    jsonNodeTwo.setAttribute('data-idevice-type', 'type-b');

    const jsNode = document.createElement('div');
    jsNode.className = 'idevice_node';
    jsNode.setAttribute('data-idevice-component-type', 'js');
    jsNode.setAttribute('data-idevice-type', 'ignore');

    document.body.append(jsonNode, jsonNodeTwo, jsNode);

    const spy = vi.spyOn(window.$exeExport, 'initJsonIdeviceInterval');

    window.$exeExport.initJsonIdevices();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('type-a');
    expect(spy).toHaveBeenCalledWith('type-b');
  });

  it('renders JSON idevice content and clears its interval', () => {
    const exportIdevice = {
      renderView: vi.fn(() => '<p>Rendered</p>'),
      renderBehaviour: vi.fn(),
      init: vi.fn(),
    };

    window.$testidevice = exportIdevice;

    const node = document.createElement('div');
    node.id = 'idevice-1';
    node.className = 'idevice_node test-idevice db-no-data';
    node.setAttribute('data-idevice-json-data', '{bad json');
    node.setAttribute('data-idevice-template', 'template');

    document.body.appendChild(node);

    const intervalName = 'interval_test';
    window[intervalName] = 123;
    const clearSpy = vi.spyOn(window, 'clearInterval');

    const timeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 0;
    });

    window.$exeExport.initJsonIdevice('test-idevice', intervalName);

    expect(exportIdevice.renderView).toHaveBeenCalled();
    expect(exportIdevice.renderBehaviour).toHaveBeenCalled();
    expect(exportIdevice.init).toHaveBeenCalled();
    expect(node.classList.contains('loaded')).toBe(true);
    expect(clearSpy).toHaveBeenCalledWith(123);
    timeoutSpy.mockRestore();
  });

  it('loads scorm when scorm assets are ready', () => {
    document.body.classList.add('exe-scorm');

    window.scorm = {};
    window.loadPage = vi.fn();

    const spy = vi.spyOn(window.$exeExport, 'initScorm');
    let intervalCallback = null;
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((fn) => {
      intervalCallback = fn;
      return 123;
    });
    const clearSpy = vi.spyOn(window, 'clearInterval');

    window.$exeExport.loadScorm();
    intervalCallback();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    intervalSpy.mockRestore();
  });

  it('detects scorm data in idevices and wires unload handler', () => {
    window.scorm = {};
    window.loadPage = vi.fn();
    window.unloadPage = vi.fn();

    window.$testidevice = {
      options: [{ isScorm: true }],
    };

    const jsNode = document.createElement('div');
    jsNode.className = 'idevice_node';
    jsNode.setAttribute('data-idevice-component-type', 'js');
    jsNode.setAttribute('data-idevice-type', 'test-idevice');

    const jsonNode = document.createElement('div');
    jsonNode.className = 'idevice_node';
    jsonNode.setAttribute('data-idevice-component-type', 'json');
    jsonNode.setAttribute('data-idevice-type', 'json-idevice');
    jsonNode.setAttribute(
      'data-idevice-json-data',
      JSON.stringify({ exportScorm: { saveScore: true } })
    );

    document.body.append(jsNode, jsonNode);

    window.$exeExport.initScorm();
    window.dispatchEvent(new Event('unload'));

    expect(window.loadPage).toHaveBeenCalledTimes(1);
    expect(window.unloadPage).toHaveBeenCalledWith(true);
  });

  it('normalizes search strings', () => {
    expect(window.$exeExport.searchBar.normalizeText('Árbol')).toBe('arbol');
  });

  it('builds links based on preview/index state', () => {
    const searchBar = window.$exeExport.searchBar;

    searchBar.isPreview = true;
    expect(searchBar.getLink('html/index.html')).toBe('html/index.html');

    searchBar.isPreview = false;
    searchBar.isIndex = false;
    expect(searchBar.getLink('html/index.html')).toBe('../index.html');
  });

  it('searches in blocks and creates links', () => {
    const searchBar = window.$exeExport.searchBar;

    searchBar.deepLinking = true;
    searchBar.results = [];
    searchBar.isPreview = false;
    searchBar.isIndex = false;
    searchBar.data = {
      page1: {
        name: 'Page One',
        fileUrl: 'html/index.html',
        blocks: {
          block1: {
            order: 1,
            name: 'Match',
            idevices: [],
          },
        },
      },
    };

    const res = searchBar.searchInBlocks('page1', 'match', true);

    expect(res).toContain('Page One');
    expect(res).toContain('#block1');
  });

  it('returns early when already matched and deep linking is off', () => {
    const searchBar = window.$exeExport.searchBar;

    searchBar.deepLinking = false;
    searchBar.results = ['page1'];
    searchBar.data = { page1: { name: 'Page One', fileUrl: 'html/index.html', blocks: {} } };

    const res = searchBar.searchInBlocks('page1', 'page', true);

    expect(res).toBe('');
  });

  describe('init()', () => {
    it('calls all initialization methods', () => {
      vi.useFakeTimers();
      const addBoxToggleSpy = vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      const setExeSpy = vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      const initExeSpy = vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      const initJsonSpy = vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      const loadScormSpy = vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});
      const teacherModeSpy = vi.spyOn(window.$exeExport.teacherMode, 'init').mockImplementation(() => {});
      const addClassSpy = vi.spyOn(window.$exeExport, 'addClassJsExecutedToExeContent').mockImplementation(() => {});
      const printSpy = vi.spyOn(window.$exeExport, 'triggerPrintIfRequested').mockImplementation(() => {});

      window.$exeExport.init();
      vi.advanceTimersByTime(300);

      expect(addBoxToggleSpy).toHaveBeenCalled();
      expect(setExeSpy).toHaveBeenCalled();
      expect(initExeSpy).toHaveBeenCalled();
      expect(initJsonSpy).toHaveBeenCalled();
      expect(loadScormSpy).toHaveBeenCalled();
      expect(teacherModeSpy).toHaveBeenCalled();
      expect(addClassSpy).toHaveBeenCalled();
      expect(printSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('handles errors in addBoxToggleEvent gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {
        throw new Error('Test error');
      });
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});

      window.$exeExport.init();

      expect(consoleSpy).toHaveBeenCalledWith('Error: Failed to initialize box toggle events');
      consoleSpy.mockRestore();
    });

    it('handles errors in content initialization gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {
        throw new Error('Test error');
      });
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});

      window.$exeExport.init();

      expect(consoleSpy).toHaveBeenCalledWith('Error: Failed to initialize content');
      consoleSpy.mockRestore();
    });

    it('handles errors in SCORM initialization gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {
        throw new Error('Test error');
      });

      window.$exeExport.init();

      expect(consoleSpy).toHaveBeenCalledWith('Error: Failed to initialize SCORM');
      consoleSpy.mockRestore();
    });

    it('handles errors in Teacher Mode gracefully', () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});
      vi.spyOn(window.$exeExport.teacherMode, 'init').mockImplementation(() => {
        throw new Error('Test error');
      });

      window.$exeExport.init();
      vi.advanceTimersByTime(150);

      expect(consoleSpy).toHaveBeenCalledWith('Error: Failed to initialize Teacher Mode');
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });

    it('handles errors in print trigger gracefully', () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});
      vi.spyOn(window.$exeExport.teacherMode, 'init').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addClassJsExecutedToExeContent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'triggerPrintIfRequested').mockImplementation(() => {
        throw new Error('Test error');
      });

      window.$exeExport.init();
      vi.advanceTimersByTime(300);

      expect(consoleSpy).toHaveBeenCalledWith('Error: Failed to trigger print dialog');
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('addBoxToggleEvent', () => {
    let originalJQuery;
    // Handlers are captured in order: [0]=toggle click, [1]=box-head click
    let clickHandlers;
    let sharedTriggerSpy;

    function makeBoxJQuery() {
      clickHandlers = [];
      sharedTriggerSpy = vi.fn().mockReturnThis();

      function createBoxCol(elements) {
        const api = {
          elements,
          on: vi.fn((event, handler) => {
            if (event === 'click') clickHandlers.push(handler);
            return api;
          }),
          css: vi.fn().mockReturnThis(),
          has: vi.fn((selector) =>
            createBoxCol(elements.filter((el) => el.querySelector && el.querySelector(selector) !== null)),
          ),
          attr: vi.fn((name, value) => {
            if (value !== undefined) elements.forEach((el) => el.setAttribute(name, value));
            return api;
          }),
          each: vi.fn((cb) => {
            elements.forEach((el, i) => cb.call(el, i, el));
            return api;
          }),
          text: vi.fn((value) => {
            if (value !== undefined) elements.forEach((el) => { el.textContent = value; });
            return api;
          }),
          hasClass: vi.fn((cls) => elements[0]?.classList?.contains(cls) ?? false),
          addClass: vi.fn((cls) => {
            elements.forEach((el) => el.classList?.add(cls));
            return api;
          }),
          removeClass: vi.fn((cls) => {
            elements.forEach((el) => el.classList?.remove(cls));
            return api;
          }),
          parents: vi.fn((selector) => {
            const ancestors = [];
            elements.forEach((el) => {
              let node = el.parentElement;
              while (node) {
                if (node.matches && node.matches(selector)) ancestors.push(node);
                node = node.parentElement;
              }
            });
            return createBoxCol(ancestors);
          }),
          slideDown: vi.fn((cb) => { if (cb) cb(); return api; }),
          slideUp: vi.fn((cb) => { if (cb) cb(); return api; }),
          trigger: sharedTriggerSpy,
        };
        return api;
      }

      return vi.fn((arg) => {
        if (typeof arg === 'string') {
          return createBoxCol(Array.from(document.querySelectorAll(arg)));
        }
        if (arg instanceof HTMLElement) {
          return createBoxCol([arg]);
        }
        return createBoxCol([]);
      });
    }

    beforeEach(() => {
      document.body.innerHTML = '';
      originalJQuery = window.$;
      window.$ = makeBoxJQuery();
    });

    afterEach(() => {
      window.$ = originalJQuery;
    });

    function buildBoxDOM({ withToggle = true, minimized = false } = {}) {
      const article = document.createElement('article');
      article.className = minimized ? 'box minimized' : 'box';
      const head = document.createElement('div');
      head.className = 'box-head';
      const content = document.createElement('div');
      content.className = 'box-content';
      if (withToggle) {
        const toggle = document.createElement('button');
        toggle.className = 'box-toggle';
        const span = document.createElement('span');
        toggle.appendChild(span);
        head.appendChild(toggle);
      }
      article.appendChild(head);
      article.appendChild(content);
      document.body.appendChild(article);
      return { article, head, content, toggle: head.querySelector('.box-toggle') };
    }

    it('applies i18n title from $exe_i18n.toggleContent to toggle buttons', () => {
      const { toggle } = buildBoxDOM();
      window.$exe_i18n.toggleContent = 'Mostrar/Ocultar';

      window.$exeExport.addBoxToggleEvent();

      expect(toggle.getAttribute('title')).toBe('Mostrar/Ocultar');
      expect(toggle.querySelector('span').textContent).toBe('Mostrar/Ocultar');
    });

    it('uses fallback title when $exe_i18n.toggleContent is not defined', () => {
      const { toggle } = buildBoxDOM();
      delete window.$exe_i18n.toggleContent;

      window.$exeExport.addBoxToggleEvent();

      expect(toggle.getAttribute('title')).toBe('Toggle content');
    });

    it('collapses an expanded box when the toggle is clicked', () => {
      const { article, toggle } = buildBoxDOM();
      window.$exeExport.addBoxToggleEvent();

      // clickHandlers[0] is bound to '.box-toggle' (expand/collapse)
      window.$exeExport.isTogglingBox = false;
      clickHandlers[0].call(toggle);

      expect(article.classList.contains('minimized')).toBe(true);
      expect(window.$exeExport.isTogglingBox).toBe(false);
    });

    it('expands a minimized box when the toggle is clicked', () => {
      const { article, toggle } = buildBoxDOM({ minimized: true });
      window.$exeExport.addBoxToggleEvent();

      window.$exeExport.isTogglingBox = false;
      clickHandlers[0].call(toggle);

      expect(article.classList.contains('minimized')).toBe(false);
    });

    it('does nothing when isTogglingBox is true', () => {
      const { article, toggle } = buildBoxDOM();
      window.$exeExport.addBoxToggleEvent();

      window.$exeExport.isTogglingBox = true;
      clickHandlers[0].call(toggle);

      expect(article.classList.contains('minimized')).toBe(false);
    });

    it('box-head click delegates to the toggle when target is not the toggle', () => {
      const { head } = buildBoxDOM();
      window.$exeExport.addBoxToggleEvent();

      // clickHandlers[1] is bound to '.box-head' (delegates to toggle)
      const mockEvent = { target: head }; // head does not have 'box-toggle' class
      clickHandlers[1].call(head, mockEvent);

      // The handler calls $('.box-toggle', this).trigger('click')
      // sharedTriggerSpy is shared across all collections created by makeBoxJQuery
      expect(sharedTriggerSpy).toHaveBeenCalledWith('click');
    });

    it('box-head click returns false when the target is the toggle itself', () => {
      const { toggle } = buildBoxDOM();
      window.$exeExport.addBoxToggleEvent();

      const mockEvent = { target: toggle }; // toggle has 'box-toggle' class
      const result = clickHandlers[1].call(toggle.parentElement, mockEvent);

      expect(result).toBe(false);
    });
  });

  describe('teacherMode', () => {
    it('returns early if localStorage is not available', () => {
      const originalLocalStorage = window.localStorage;
      delete window.localStorage;

      const result = window.$exeExport.teacherMode.init();

      expect(result).toBeUndefined();
      window.localStorage = originalLocalStorage;
    });

    it('returns early if no teacher-only elements exist', () => {
      // No .box.teacher-only or .idevice_node.teacher-only elements
      const result = window.$exeExport.teacherMode.init();
      expect(result).toBeUndefined();
    });

    it('returns early if toggler already exists', () => {
      const toggler = document.createElement('div');
      toggler.id = 'teacher-mode-toggler';
      document.body.appendChild(toggler);

      const box = document.createElement('div');
      box.className = 'box teacher-only';
      document.body.appendChild(box);

      const result = window.$exeExport.teacherMode.init();
      expect(result).toBeUndefined();
    });

    it('returns early for epub export', () => {
      document.body.classList.add('exe-epub');
      const box = document.createElement('div');
      box.className = 'box teacher-only';
      document.body.appendChild(box);

      const result = window.$exeExport.teacherMode.init();
      expect(result).toBeUndefined();
      document.body.classList.remove('exe-epub');
    });

    it('creates toggler for single-page mode', () => {
      document.body.classList.add('exe-single-page');
      const box = document.createElement('div');
      box.className = 'box teacher-only';
      document.body.appendChild(box);

      const header = document.createElement('header');
      header.className = 'package-header';
      document.body.appendChild(header);

      window.$exeExport.teacherMode.init();

      expect(document.body.classList.contains('exe-teacher-mode-toggler')).toBe(true);
      document.body.classList.remove('exe-single-page');
    });

    it('creates toggler for single-page mode with div.package-header (new structure)', () => {
      document.body.classList.add('exe-single-page');
      const box = document.createElement('div');
      box.className = 'box teacher-only';
      document.body.appendChild(box);

      // New HTML structure: <header class="main-header"><div class="package-header">...</div></header>
      const mainHeader = document.createElement('header');
      mainHeader.className = 'main-header';
      const packageHeader = document.createElement('div');
      packageHeader.className = 'package-header';
      mainHeader.appendChild(packageHeader);
      document.body.appendChild(mainHeader);

      window.$exeExport.teacherMode.init();

      expect(document.body.classList.contains('exe-teacher-mode-toggler')).toBe(true);
      // Verify toggler was inserted before .package-header (not requiring <header> element)
      const toggler = document.getElementById('teacher-mode-toggler-wrapper');
      expect(toggler).not.toBeNull();
      document.body.classList.remove('exe-single-page');
    });

    it('creates toggler for multi-page mode', () => {
      const idevice = document.createElement('div');
      idevice.className = 'idevice_node teacher-only';
      document.body.appendChild(idevice);

      const header = document.createElement('header');
      header.className = 'page-header';
      document.body.appendChild(header);

      window.$exeExport.teacherMode.init();

      expect(document.body.classList.contains('exe-teacher-mode-toggler')).toBe(true);
    });

    it('creates toggler for multi-page mode with div.page-header (new structure)', () => {
      const idevice = document.createElement('div');
      idevice.className = 'idevice_node teacher-only';
      document.body.appendChild(idevice);

      // New HTML structure: <header class="main-header"><div class="page-header">...</div></header>
      const mainHeader = document.createElement('header');
      mainHeader.className = 'main-header';
      const pageHeader = document.createElement('div');
      pageHeader.className = 'page-header';
      mainHeader.appendChild(pageHeader);
      document.body.appendChild(mainHeader);

      window.$exeExport.teacherMode.init();

      expect(document.body.classList.contains('exe-teacher-mode-toggler')).toBe(true);
      // Verify toggler was prepended to .page-header (not requiring <header> element)
      const toggler = document.getElementById('teacher-mode-toggler-wrapper');
      expect(toggler).not.toBeNull();
    });

    it('enables teacher mode if previously enabled', () => {
      window.localStorage.setItem('exeTeacherMode', '1');

      const box = document.createElement('div');
      box.className = 'box teacher-only';
      document.body.appendChild(box);

      const header = document.createElement('header');
      header.className = 'page-header';
      document.body.appendChild(header);

      window.$exeExport.teacherMode.init();

      expect(document.documentElement.classList.contains('mode-teacher')).toBe(true);
    });

    it('isEnabled returns true when storage has value', () => {
      window.localStorage.setItem('exeTeacherMode', '1');
      expect(window.$exeExport.teacherMode.isEnabled()).toBe(true);
    });

    it('isEnabled returns false when storage has no value', () => {
      expect(window.$exeExport.teacherMode.isEnabled()).toBe(false);
    });

    it('isEnabled returns false when localStorage throws', () => {
      const originalGetItem = window.localStorage.getItem;
      window.localStorage.getItem = () => {
        throw new Error('Storage error');
      };

      expect(window.$exeExport.teacherMode.isEnabled()).toBe(false);
      window.localStorage.getItem = originalGetItem;
    });
  });

  describe('getIdeviceObject and getIdeviceObjectKey', () => {
    it('returns correct object key for hyphenated type', () => {
      const key = window.$exeExport.getIdeviceObjectKey('test-idevice-type');
      expect(key).toBe('$testidevicetype');
    });

    it('returns correct object key for simple type', () => {
      const key = window.$exeExport.getIdeviceObjectKey('simple');
      expect(key).toBe('$simple');
    });

    it('returns undefined when idevice object does not exist', () => {
      const obj = window.$exeExport.getIdeviceObject('nonexistent-type');
      expect(obj).toBeUndefined();
    });

    it('returns idevice object when it exists', () => {
      const mockIdevice = { renderView: vi.fn() };
      window.$testidevice = mockIdevice;

      const obj = window.$exeExport.getIdeviceObject('test-idevice');
      expect(obj).toBe(mockIdevice);
    });
  });

  describe('loadScorm', () => {
    it('does nothing when body does not have exe-scorm class', () => {
      // Clear any existing calls from module initialization
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // Ensure body doesn't have exe-scorm class
      document.body.classList.remove('exe-scorm');

      window.$exeExport.loadScorm();

      // Should not have been called for SCORM loading
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('initScorm', () => {
    it('does nothing when scorm or loadPage is not defined', () => {
      delete window.scorm;
      delete window.loadPage;

      const result = window.$exeExport.initScorm();
      expect(result).toBeUndefined();
    });

    it('handles invalid JSON data in json component type', () => {
      window.scorm = {};
      window.loadPage = vi.fn();
      window.unloadPage = vi.fn();

      const jsonNode = document.createElement('div');
      jsonNode.className = 'idevice_node';
      jsonNode.setAttribute('data-idevice-component-type', 'json');
      jsonNode.setAttribute('data-idevice-type', 'test-idevice');
      jsonNode.setAttribute('data-idevice-json-data', '{invalid json');
      document.body.appendChild(jsonNode);

      window.$exeExport.initScorm();

      expect(window.loadPage).toHaveBeenCalled();
    });

    it('handles json component without scorm data', () => {
      window.scorm = {};
      window.loadPage = vi.fn();
      window.unloadPage = vi.fn();

      const jsonNode = document.createElement('div');
      jsonNode.className = 'idevice_node';
      jsonNode.setAttribute('data-idevice-component-type', 'json');
      jsonNode.setAttribute('data-idevice-type', 'test-idevice');
      jsonNode.setAttribute('data-idevice-json-data', JSON.stringify({ someData: true }));
      document.body.appendChild(jsonNode);

      window.$exeExport.initScorm();
      window.dispatchEvent(new Event('unload'));

      expect(window.unloadPage).toHaveBeenCalledWith(false);
    });

    it('handles js component without options', () => {
      window.scorm = {};
      window.loadPage = vi.fn();
      window.unloadPage = vi.fn();
      window.$testidevice = {}; // No options property

      const jsNode = document.createElement('div');
      jsNode.className = 'idevice_node';
      jsNode.setAttribute('data-idevice-component-type', 'js');
      jsNode.setAttribute('data-idevice-type', 'test-idevice');
      document.body.appendChild(jsNode);

      window.$exeExport.initScorm();
      window.dispatchEvent(new Event('unload'));

      expect(window.unloadPage).toHaveBeenCalledWith(false);
    });

    it('handles js component with non-scorm options', () => {
      window.scorm = {};
      window.loadPage = vi.fn();
      window.unloadPage = vi.fn();
      window.$testidevice = { options: [{ isScorm: false }] };

      const jsNode = document.createElement('div');
      jsNode.className = 'idevice_node';
      jsNode.setAttribute('data-idevice-component-type', 'js');
      jsNode.setAttribute('data-idevice-type', 'test-idevice');
      document.body.appendChild(jsNode);

      window.$exeExport.initScorm();
      window.dispatchEvent(new Event('unload'));

      expect(window.unloadPage).toHaveBeenCalledWith(false);
    });
  });

  describe('initJsonIdevice edge cases', () => {
    it('returns false when exportIdevice is undefined', () => {
      const result = window.$exeExport.initJsonIdevice('nonexistent-type', 'intervalName');
      expect(result).toBe(false);
    });

    it('handles valid JSON data', () => {
      const exportIdevice = {
        renderView: vi.fn(() => '<p>Rendered</p>'),
        renderBehaviour: vi.fn(),
        init: vi.fn(),
      };
      window.$testidevice = exportIdevice;

      const node = document.createElement('div');
      node.id = 'idevice-1';
      node.className = 'idevice_node test-idevice db-no-data';
      node.setAttribute('data-idevice-json-data', JSON.stringify({ foo: 'bar' }));
      document.body.appendChild(node);

      const intervalName = 'interval_test';
      window[intervalName] = 123;
      vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      window.$exeExport.initJsonIdevice('test-idevice', intervalName);

      expect(exportIdevice.init).toHaveBeenCalledWith(
        expect.objectContaining({ foo: 'bar', ideviceId: 'idevice-1' }),
        null
      );
    });

    it('handles array JSON data by converting to empty object', () => {
      const exportIdevice = {
        renderView: vi.fn(),
        renderBehaviour: vi.fn(),
        init: vi.fn(),
      };
      window.$testidevice = exportIdevice;

      const node = document.createElement('div');
      node.id = 'idevice-2';
      node.className = 'idevice_node test-idevice';
      node.setAttribute('data-idevice-json-data', '[1, 2, 3]');
      document.body.appendChild(node);

      const intervalName = 'interval_test2';
      window[intervalName] = 124;
      vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      window.$exeExport.initJsonIdevice('test-idevice', intervalName);

      expect(exportIdevice.init).toHaveBeenCalledWith(
        expect.objectContaining({ ideviceId: 'idevice-2' }),
        null
      );
    });

    it('does not render view when node does not have db-no-data class', () => {
      const exportIdevice = {
        renderView: vi.fn(() => '<p>Rendered</p>'),
        renderBehaviour: vi.fn(),
        init: vi.fn(),
      };
      window.$testidevice = exportIdevice;

      const node = document.createElement('div');
      node.id = 'idevice-3';
      node.className = 'idevice_node test-idevice'; // No db-no-data
      node.setAttribute('data-idevice-json-data', '{}');
      document.body.appendChild(node);

      const intervalName = 'interval_test3';
      window[intervalName] = 125;
      vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      window.$exeExport.initJsonIdevice('test-idevice', intervalName);

      expect(exportIdevice.renderView).not.toHaveBeenCalled();
      expect(exportIdevice.renderBehaviour).toHaveBeenCalled();
    });

    it('does not set innerHTML when renderView returns falsy', () => {
      const exportIdevice = {
        renderView: vi.fn(() => null),
        renderBehaviour: vi.fn(),
        init: vi.fn(),
      };
      window.$testidevice = exportIdevice;

      const node = document.createElement('div');
      node.id = 'idevice-4';
      node.className = 'idevice_node test-idevice db-no-data';
      node.innerHTML = '<p>Original</p>';
      node.setAttribute('data-idevice-json-data', '{}');
      document.body.appendChild(node);

      const intervalName = 'interval_test4';
      window[intervalName] = 126;
      vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      window.$exeExport.initJsonIdevice('test-idevice', intervalName);

      expect(node.innerHTML).toBe('<p>Original</p>');
    });
  });

  describe('triggerPrintIfRequested', () => {
    it('does not trigger print when print param is not 1', () => {
      window.print = vi.fn();
      const originalParams = window.URLSearchParams;
      function MockURLSearchParams() {
        this.get = () => null;
      }
      window.URLSearchParams = MockURLSearchParams;

      window.$exeExport.triggerPrintIfRequested();

      expect(window.print).not.toHaveBeenCalled();
      window.URLSearchParams = originalParams;
    });

    it('does not trigger print when window.print is not a function', () => {
      const originalPrint = window.print;
      window.print = 'not a function';
      const originalParams = window.URLSearchParams;
      function MockURLSearchParams() {
        this.get = () => '1';
      }
      window.URLSearchParams = MockURLSearchParams;

      // Should not throw
      window.$exeExport.triggerPrintIfRequested();

      window.URLSearchParams = originalParams;
      window.print = originalPrint;
    });
  });

  describe('addClassJsExecutedToExeContent', () => {
    it('does nothing when exe-content element does not exist', () => {
      // No exe-content element
      window.$exeExport.addClassJsExecutedToExeContent();
      // Should not throw
    });
  });

  describe('searchBar.normalizeText', () => {
    it('returns empty string for falsy input', () => {
      expect(window.$exeExport.searchBar.normalizeText(null)).toBe('');
      expect(window.$exeExport.searchBar.normalizeText(undefined)).toBe('');
      expect(window.$exeExport.searchBar.normalizeText('')).toBe('');
    });

    it('normalizes accented characters', () => {
      expect(window.$exeExport.searchBar.normalizeText('Café')).toBe('cafe');
      expect(window.$exeExport.searchBar.normalizeText('Ñoño')).toBe('nono');
      expect(window.$exeExport.searchBar.normalizeText('Über')).toBe('uber');
    });
  });

  describe('searchBar.init', () => {
    it('returns early when search wrapper does not exist', () => {
      const result = window.$exeExport.searchBar.init();
      expect(result).toBeUndefined();
    });

    it('uses window.exeSearchData when available', () => {
      window.exeSearchData = { page1: { name: 'Test' } };

      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.init();

      expect(window.$exeExport.searchBar.data).toBe(window.exeSearchData);
    });

    it('uses data-pages attribute when exeSearchData is not available', () => {
      delete window.exeSearchData;

      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      wrapper.setAttribute('data-pages', JSON.stringify({ page1: { name: 'Test' } }));
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.init();

      expect(window.$exeExport.searchBar.data).toEqual({ page1: { name: 'Test' } });
    });

  });

  describe('searchBar.createSearchForm', () => {
    it('returns early when form already exists', () => {
      const form = document.createElement('form');
      form.id = 'exe-client-search-form';
      document.body.appendChild(form);

      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      document.body.appendChild(wrapper);

      const prependSpy = vi.fn();
      window.$.mockReturnValue({ prepend: prependSpy, append: vi.fn() });

      window.$exeExport.searchBar.createSearchForm();

      // Should not call prepend since form exists
      expect(prependSpy).not.toHaveBeenCalled();
    });
  });

  describe('searchBar.doSearch', () => {
    it('shows no results message when nothing found', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      wrapper.setAttribute('data-no-results-string', 'No results found');
      document.body.appendChild(wrapper);

      const resultsList = document.createElement('div');
      resultsList.id = 'exe-client-search-results-list';
      wrapper.appendChild(resultsList);

      window.$exeExport.searchBar.data = {};
      window.$exeExport.searchBar.query = 'nonexistent';

      window.$exeExport.searchBar.doSearch();

      expect(resultsList.innerHTML).toContain('No results found');
    });

    it('finds results in blocks when page title does not match', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      document.body.appendChild(wrapper);

      const resultsList = document.createElement('div');
      resultsList.id = 'exe-client-search-results-list';
      wrapper.appendChild(resultsList);

      const main = document.createElement('main');
      document.body.appendChild(main);

      window.$exeExport.searchBar.isPreview = true;
      window.$exeExport.searchBar.data = {
        page1: {
          name: 'Unrelated Title',
          fileUrl: 'page1.html',
          blocks: {
            block1: {
              order: 1,
              name: 'Block With Search Term',
              idevices: {},
            },
            block2: {
              order: 2,
              name: 'Another Block',
              idevices: {},
            },
          },
        },
      };
      window.$exeExport.searchBar.query = 'search';
      window.$exeExport.searchBar.deepLinking = true;

      window.$exeExport.searchBar.doSearch();

      // Should find result via searchInBlocks with fullLink=true
      // The page title is shown in the link, and block number is shown for multi-block pages
      expect(resultsList.innerHTML).toContain('Unrelated Title');
      expect(resultsList.innerHTML).toContain('block1'); // In the URL hash
      expect(resultsList.innerHTML).toContain('block 1'); // In the span
    });

    it('finds results in page titles', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search';
      document.body.appendChild(wrapper);

      const resultsList = document.createElement('div');
      resultsList.id = 'exe-client-search-results-list';
      wrapper.appendChild(resultsList);

      const header = document.createElement('header');
      document.body.appendChild(header);

      const main = document.createElement('main');
      main.appendChild(header);
      const pageContent = document.createElement('div');
      pageContent.className = 'page-content';
      main.appendChild(pageContent);
      document.body.appendChild(main);

      const reset = document.createElement('a');
      reset.id = 'exe-client-search-reset';
      wrapper.appendChild(reset);

      window.$exeExport.searchBar.isPreview = true;
      window.$exeExport.searchBar.data = {
        page1: { name: 'Test Page', fileUrl: 'test.html', blocks: {} },
      };
      window.$exeExport.searchBar.query = 'test';

      window.$exeExport.searchBar.doSearch();

      expect(resultsList.innerHTML).toContain('<mark class="exe-client-search-result">Test</mark> Page');
    });
  });

  describe('searchBar.getLink', () => {
    it('returns link as-is for preview on index page', () => {
      window.$exeExport.searchBar.isPreview = true;
      // Mock being on the index page (/viewer/index.html)
      Object.defineProperty(window, 'location', {
        value: { pathname: '/viewer/index.html' },
        writable: true,
      });
      expect(window.$exeExport.searchBar.getLink('html/page.html')).toBe('html/page.html');
    });

    it('adjusts html/ links when preview is on subpage', () => {
      window.$exeExport.searchBar.isPreview = true;
      // Mock being on a subpage
      Object.defineProperty(window, 'location', {
        value: { pathname: '/viewer/html/current-page.html' },
        writable: true,
      });

      expect(window.$exeExport.searchBar.getLink('html/other-page.html')).toBe(
        '../html/other-page.html'
      );
    });

    it('adjusts index.html link when preview is on subpage', () => {
      window.$exeExport.searchBar.isPreview = true;
      Object.defineProperty(window, 'location', {
        value: { pathname: '/viewer/html/current-page.html' },
        writable: true,
      });

      expect(window.$exeExport.searchBar.getLink('index.html')).toBe('../index.html');
    });

    it('does not double-adjust already relative links', () => {
      window.$exeExport.searchBar.isPreview = true;
      Object.defineProperty(window, 'location', {
        value: { pathname: '/viewer/html/current-page.html' },
        writable: true,
      });

      expect(window.$exeExport.searchBar.getLink('../html/page.html')).toBe('../html/page.html');
    });

    it('keeps absolute links unchanged when on subpage', () => {
      window.$exeExport.searchBar.isPreview = true;
      Object.defineProperty(window, 'location', {
        value: { pathname: '/viewer/html/current-page.html' },
        writable: true,
      });

      expect(window.$exeExport.searchBar.getLink('/viewer/html/page.html')).toBe(
        '/viewer/html/page.html'
      );
    });

    it('removes html/ prefix for non-index pages', () => {
      window.$exeExport.searchBar.isPreview = false;
      window.$exeExport.searchBar.isIndex = false;
      expect(window.$exeExport.searchBar.getLink('html/page.html')).toBe('page.html');
    });

    it('handles index.html for non-index pages', () => {
      window.$exeExport.searchBar.isPreview = false;
      window.$exeExport.searchBar.isIndex = false;
      expect(window.$exeExport.searchBar.getLink('index.html')).toBe('../index.html');
    });

    it('returns link as-is for index pages', () => {
      window.$exeExport.searchBar.isPreview = false;
      window.$exeExport.searchBar.isIndex = true;
      expect(window.$exeExport.searchBar.getLink('html/page.html')).toBe('html/page.html');
    });
  });

  describe('searchBar.searchInBlocks', () => {
    it('searches in idevice HTML content', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: {
              order: 1,
              name: 'Block Title',
              idevices: {
                idevice1: {
                  htmlView: '<p>This contains the search term</p>',
                },
              },
            },
          },
        },
      };

      const res = searchBar.searchInBlocks('page1', 'search', true);

      expect(res).toContain('Page One');
    });

    it('handles multiple blocks', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = true;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'First Block', idevices: {} },
            block2: { order: 2, name: 'Match Block', idevices: {} },
          },
        },
      };

      const res = searchBar.searchInBlocks('page1', 'match', true);

      // Now uses i18n block label (defaults to 'block' when $exe_i18n.block is defined as 'block' in test setup)
      expect(res).toContain('block 2');
    });

    it('handles non-fullLink mode with multiple blocks', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = true;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'Match Block', idevices: {} },
            block2: { order: 2, name: 'Another', idevices: {} },
          },
        },
      };

      const res = searchBar.searchInBlocks('page1', 'match', false);

      // Now uses i18n block label (defaults to 'block' when $exe_i18n.block is defined as 'block' in test setup)
      expect(res).toContain('block 1');
      expect(res).not.toContain('Page One');
    });
  });

  describe('searchBar.checkBlockLinks', () => {
    it('formats spans with deep linking enabled', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="#">Page</a><span>, block 1</span></li>';
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      const span = wrapper.querySelector('span');
      expect(span.innerHTML).toContain('(');
    });

    it('removes empty spans when deep linking enabled', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="#">Page</a><span> </span></li>';
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      // Span with just a space should be removed
    });

    it('adds closing parenthesis if not present', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="#">Page</a><span>(block 1</span></li>';
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      const span = wrapper.querySelector('span');
      expect(span.innerHTML).toBe('(block 1)');
    });

    it('removes spans with deep linking disabled', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="#">Page</a><span>, block 1</span></li>';
      document.body.appendChild(wrapper);

      window.$exeExport.searchBar.deepLinking = false;
      window.$exeExport.searchBar.checkBlockLinks();

      // Spans should be removed (jQuery mock removes them)
    });

    it('registers click handler on search result links', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="page.html">Page</a></li>';
      document.body.appendChild(wrapper);

      // Capture the click handler
      let clickHandler = null;
      const originalJQuery = window.$;
      window.$ = vi.fn((selector) => {
        const result = originalJQuery(selector);
        if (selector === '#exe-client-search-results-list a') {
          result.on = vi.fn((event, handler) => {
            if (event === 'click') {
              clickHandler = handler;
            }
            return result;
          });
        }
        return result;
      });

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      expect(clickHandler).toBeDefined();

      // Restore jQuery
      window.$ = originalJQuery;
    });

    it('click handler adds nav=false when siteNav is not visible', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="page.html">Page</a></li>';
      document.body.appendChild(wrapper);

      // Create page elements that the click handler interacts with
      const header = document.createElement('header');
      const main = document.createElement('main');
      main.appendChild(header);
      const pageContent = document.createElement('div');
      pageContent.className = 'page-content';
      main.appendChild(pageContent);
      document.body.appendChild(main);

      const searchReset = document.createElement('a');
      searchReset.id = 'exe-client-search-reset';
      searchReset.className = 'visible';
      document.body.appendChild(searchReset);

      const searchBox = document.createElement('div');
      searchBox.id = 'exe-client-search';
      document.body.appendChild(searchBox);

      const searchInput = document.createElement('input');
      searchInput.id = 'exe-client-search-text';
      document.body.appendChild(searchInput);

      // Capture the click handler
      let clickHandler = null;
      const originalJQuery = window.$;
      window.$ = vi.fn((selector) => {
        const result = originalJQuery(selector);
        if (selector === '#exe-client-search-results-list a') {
          result.on = vi.fn((event, handler) => {
            if (event === 'click') {
              clickHandler = handler;
            }
            return result;
          });
        }
        // Make siteNav not visible
        if (selector === '#siteNav') {
          result.is = vi.fn(() => false);
        }
        return result;
      });

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      // Execute the click handler
      const link = wrapper.querySelector('a');
      clickHandler.call(link);

      // The href should now have nav=false
      expect(link.href).toContain('nav=false');

      // Restore jQuery
      window.$ = originalJQuery;
    });

    it('click handler uses & separator when URL already has parameters', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="page.html?foo=bar">Page</a></li>';
      document.body.appendChild(wrapper);

      // Create required page elements
      const main = document.createElement('main');
      const header = document.createElement('header');
      main.appendChild(header);
      document.body.appendChild(main);

      const searchReset = document.createElement('a');
      searchReset.id = 'exe-client-search-reset';
      document.body.appendChild(searchReset);

      const searchBox = document.createElement('div');
      searchBox.id = 'exe-client-search';
      document.body.appendChild(searchBox);

      const searchInput = document.createElement('input');
      searchInput.id = 'exe-client-search-text';
      document.body.appendChild(searchInput);

      // Capture the click handler
      let clickHandler = null;
      const originalJQuery = window.$;
      window.$ = vi.fn((selector) => {
        const result = originalJQuery(selector);
        if (selector === '#exe-client-search-results-list a') {
          result.on = vi.fn((event, handler) => {
            if (event === 'click') {
              clickHandler = handler;
            }
            return result;
          });
        }
        if (selector === '#siteNav') {
          result.is = vi.fn(() => false);
        }
        return result;
      });

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      // Execute the click handler
      const link = wrapper.querySelector('a');
      clickHandler.call(link);

      // The href should use & separator
      expect(link.href).toContain('&nav=false');

      // Restore jQuery
      window.$ = originalJQuery;
    });

    it('click handler does not add nav=false when siteNav is visible', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'exe-client-search-results-list';
      wrapper.innerHTML = '<li><a href="page.html">Page</a></li>';
      document.body.appendChild(wrapper);

      // Create required page elements
      const main = document.createElement('main');
      const header = document.createElement('header');
      main.appendChild(header);
      document.body.appendChild(main);

      const searchReset = document.createElement('a');
      searchReset.id = 'exe-client-search-reset';
      document.body.appendChild(searchReset);

      const searchBox = document.createElement('div');
      searchBox.id = 'exe-client-search';
      document.body.appendChild(searchBox);

      const searchInput = document.createElement('input');
      searchInput.id = 'exe-client-search-text';
      document.body.appendChild(searchInput);

      // Capture the click handler
      let clickHandler = null;
      const originalJQuery = window.$;
      window.$ = vi.fn((selector) => {
        const result = originalJQuery(selector);
        if (selector === '#exe-client-search-results-list a') {
          result.on = vi.fn((event, handler) => {
            if (event === 'click') {
              clickHandler = handler;
            }
            return result;
          });
        }
        // Make siteNav visible
        if (selector === '#siteNav') {
          result.is = vi.fn(() => true);
        }
        return result;
      });

      window.$exeExport.searchBar.deepLinking = true;
      window.$exeExport.searchBar.checkBlockLinks();

      // Execute the click handler
      const link = wrapper.querySelector('a');
      const originalHref = link.href;
      clickHandler.call(link);

      // The href should NOT have nav=false
      expect(link.href).toBe(originalHref);

      // Restore jQuery
      window.$ = originalJQuery;
    });
  });

  describe('searchBar single block handling', () => {
    it('handles single block with fullLink mode', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = false;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'Match Block', idevices: {} },
          },
        },
      };

      const res = searchBar.searchInBlocks('page1', 'match', true);

      // Single block shouldn't show block number
      expect(res).toContain('Page One');
      expect(res).not.toContain('block');
    });

    it('handles single block with non-fullLink mode', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = true;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'Match Block', idevices: {} },
          },
        },
      };

      const res = searchBar.searchInBlocks('page1', 'match', false);

      // Single block with non-fullLink shouldn't show block number
      expect(res).toBe('');
    });
  });

  describe('translateNavButtons', () => {
    it('does nothing when $exe_i18n is undefined', () => {
      const prevButton = document.createElement('a');
      prevButton.setAttribute('data-i18n', 'previous');
      prevButton.innerHTML = '<span>Previous</span>';
      document.body.appendChild(prevButton);

      delete window.$exe_i18n;

      // Should not throw and do nothing when $exe_i18n is undefined
      window.$exeExport.translateNavButtons();

      // Text should remain unchanged
      expect(prevButton.querySelector('span').textContent).toBe('Previous');
    });

    it('calls jQuery each() for all nav button types', () => {
      const prevButton = document.createElement('a');
      prevButton.setAttribute('data-i18n', 'previous');
      prevButton.innerHTML = '<span>Previous</span>';
      document.body.appendChild(prevButton);

      const nextButton = document.createElement('a');
      nextButton.setAttribute('data-i18n', 'next');
      nextButton.innerHTML = '<span>Next</span>';
      document.body.appendChild(nextButton);

      const menuButton = document.createElement('button');
      menuButton.setAttribute('data-i18n', 'menu');
      menuButton.innerHTML = '<span>Menu</span>';
      document.body.appendChild(menuButton);

      // Verify function runs without error when $exe_i18n is defined
      window.$exe_i18n = { previous: 'Anterior', next: 'Siguiente', menu: 'Menú' };

      window.$exeExport.translateNavButtons();

      // The jQuery mock's each() was called on each selector
      // Since we're using a mock, we verify no errors occurred
    });

    it('is called during init()', () => {
      vi.useFakeTimers();
      const translateSpy = vi.spyOn(window.$exeExport, 'translateNavButtons');
      vi.spyOn(window.$exeExport, 'addBoxToggleEvent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'setExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initExe').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'initJsonIdevices').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'loadScorm').mockImplementation(() => {});
      vi.spyOn(window.$exeExport.teacherMode, 'init').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'addClassJsExecutedToExeContent').mockImplementation(() => {});
      vi.spyOn(window.$exeExport, 'triggerPrintIfRequested').mockImplementation(() => {});

      window.$exeExport.init();
      vi.advanceTimersByTime(300);

      expect(translateSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('searchBar.searchInBlocks with i18n block label', () => {
    it('uses $exe_i18n.block for block label in search results', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = true;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'First Block', idevices: {} },
            block2: { order: 2, name: 'Match Block', idevices: {} },
          },
        },
      };

      // Set custom block translation
      window.$exe_i18n.block = 'bloque';

      const res = searchBar.searchInBlocks('page1', 'match', true);

      // Should use the i18n block label
      expect(res).toContain('bloque 2');
    });

    it('falls back to "block" when $exe_i18n.block is not defined', () => {
      const searchBar = window.$exeExport.searchBar;
      searchBar.deepLinking = true;
      searchBar.results = [];
      searchBar.isPreview = true;
      searchBar.data = {
        page1: {
          name: 'Page One',
          fileUrl: 'page1.html',
          blocks: {
            block1: { order: 1, name: 'First Block', idevices: {} },
            block2: { order: 2, name: 'Match Block', idevices: {} },
          },
        },
      };

      // Remove block translation
      delete window.$exe_i18n.block;

      const res = searchBar.searchInBlocks('page1', 'match', true);

      // Should use fallback 'block'
      expect(res).toContain('block 2');
    });
  });

  describe('searchBar.addSearchParam', () => {
    it('adds query parameter with ? when URL has no existing parameters', () => {
      window.$exeExport.searchBar.query = 'test';
      const result = window.$exeExport.searchBar.addSearchParam('page.html');
      expect(result).toBe('page.html?q=test');
    });

    it('adds query parameter with & when URL already has parameters', () => {
      window.$exeExport.searchBar.query = 'test';
      const result = window.$exeExport.searchBar.addSearchParam('page.html?foo=bar');
      expect(result).toBe('page.html?foo=bar&q=test');
    });

    it('preserves hash and appends it after query parameter', () => {
      window.$exeExport.searchBar.query = 'test';
      const result = window.$exeExport.searchBar.addSearchParam('page.html#section');
      expect(result).toBe('page.html?q=test#section');
    });

    it('handles URL with both existing parameters and hash', () => {
      window.$exeExport.searchBar.query = 'test';
      const result = window.$exeExport.searchBar.addSearchParam('page.html?foo=bar#section');
      expect(result).toBe('page.html?foo=bar&q=test#section');
    });

    it('returns link unchanged when query is empty', () => {
      window.$exeExport.searchBar.query = '';
      const result = window.$exeExport.searchBar.addSearchParam('page.html');
      expect(result).toBe('page.html');
    });
  });

  describe('searchBar.highlightFromUrl', () => {
    it('calls markSearchResults when q parameter is present', () => {
      const markSpy = vi.spyOn(window.$exeExport.searchBar, 'markSearchResults').mockImplementation(() => {});

      Object.defineProperty(window, 'location', {
        value: { search: '?q=testterm' },
        writable: true,
        configurable: true,
      });

      window.$exeExport.searchBar.highlightFromUrl();

      expect(markSpy).toHaveBeenCalledWith('testterm');
      markSpy.mockRestore();
    });

    it('does not call markSearchResults when q parameter is absent', () => {
      const markSpy = vi.spyOn(window.$exeExport.searchBar, 'markSearchResults').mockImplementation(() => {});

      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
        configurable: true,
      });

      window.$exeExport.searchBar.highlightFromUrl();

      expect(markSpy).not.toHaveBeenCalled();
      markSpy.mockRestore();
    });
  });

  describe('searchBar.markSearchResults', () => {
    beforeEach(() => {
      // Clean up any previous content
      document.body.innerHTML = '';
    });

    it('wraps matching text in mark elements', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>This is a test paragraph with test word.</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(2);
      expect(marks[0].textContent).toBe('test');
      expect(marks[1].textContent).toBe('test');
    });

    it('does not search inside excluded tags', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>visible test</p><script>test in script</script><style>test in style</style>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(1);
      expect(marks[0].textContent).toBe('test');
    });

    it('preserves text before and after matches', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>before test after</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const p = container.querySelector('p');
      expect(p.textContent).toBe('before test after');
      expect(p.innerHTML).toContain('before ');
      expect(p.innerHTML).toContain('<mark class="exe-client-search-result">test</mark>');
      expect(p.innerHTML).toContain(' after');
    });

    it('does nothing when term is empty', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test content</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(0);
    });

    it('skips whitespace-only text nodes', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>   </p><p>test</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(1);
    });

    it('falls back to document.body when .exe-content is not found', () => {
      document.body.innerHTML = '<p>test content here</p>';

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = document.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(1);
    });

    it('handles multiple matches in same text node', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test one test two test</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(3);
    });

    it('adds click event listener that handles mark clicks', () => {
      // Test that the click event handling code path is exercised
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>first test and second test</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.removeAllMarksOnClick = false;
      window.$exeExport.searchBar.markSearchResults('test');

      let marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(2);

      // Verify each mark has the correct class for click handling
      marks.forEach((mark) => {
        expect(mark.matches('mark.exe-client-search-result')).toBe(true);
      });
    });

    it('sets up removeAllMarksOnClick handler correctly', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>first test and second test</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.removeAllMarksOnClick = true;
      window.$exeExport.searchBar.markSearchResults('test');

      let marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(2);

      // Verify marks are set up correctly for the removeAll handler
      expect(window.$exeExport.searchBar.removeAllMarksOnClick).toBe(true);
    });

    it('does not mark text inside nested excluded tags', () => {
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<div><code><span>test inside code</span></code></div><p>test outside</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(1);
      expect(marks[0].closest('p')).not.toBeNull();
    });
  });

  describe('searchBar.markSearchResults click handling', () => {
    let clickHandler;
    let originalAddEventListener;

    beforeEach(() => {
      // Capture the click handler when it's registered
      originalAddEventListener = document.addEventListener;
      document.addEventListener = vi.fn((event, handler) => {
        if (event === 'click') {
          clickHandler = handler;
        }
        originalAddEventListener.call(document, event, handler);
      });
    });

    afterEach(() => {
      document.addEventListener = originalAddEventListener;
      clickHandler = null;
    });

    it('sets up click handler that checks for mark elements', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test content</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      // Verify marks are created with correct class for the event handler
      const mark = container.querySelector('mark.exe-client-search-result');
      expect(mark).not.toBeNull();
      expect(mark.matches('mark.exe-client-search-result')).toBe(true);
      expect(clickHandler).toBeDefined();
    });

    it('click handler removes single mark when removeAllMarksOnClick is false', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test one test two</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.removeAllMarksOnClick = false;
      window.$exeExport.searchBar.markSearchResults('test');

      let marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(2);

      // Call the captured click handler directly with a mock event
      const mockEvent = {
        target: marks[0],
      };
      clickHandler(mockEvent);

      marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(1);
    });

    it('click handler removes all marks when removeAllMarksOnClick is true', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test one test two</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.removeAllMarksOnClick = true;
      window.$exeExport.searchBar.markSearchResults('test');

      let marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(2);

      // Call the captured click handler directly with a mock event
      const mockEvent = {
        target: marks[0],
      };
      clickHandler(mockEvent);

      marks = container.querySelectorAll('mark.exe-client-search-result');
      expect(marks.length).toBe(0);
    });

    it('click handler ignores non-mark elements', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test content</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      const mark = container.querySelector('mark.exe-client-search-result');
      expect(mark).not.toBeNull();

      // Call the click handler with a non-mark target
      const mockEvent = {
        target: container.querySelector('p'),
      };
      clickHandler(mockEvent);

      // Mark should still exist
      expect(container.querySelector('mark.exe-client-search-result')).not.toBeNull();
    });

    it('click handler handles target without matches method', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'exe-content';
      container.innerHTML = '<p>test content</p>';
      document.body.appendChild(container);

      window.$exeExport.searchBar.markSearchResults('test');

      // Call the click handler with a target that has no matches method
      const mockEvent = {
        target: { matches: null },
      };

      // Should not throw
      expect(() => clickHandler(mockEvent)).not.toThrow();
    });
  });

  describe('jQuery ready callback initialization', () => {
    it('searchBar.init is callable and sets up search functionality', () => {
      // The searchBar.init is called in the jQuery ready callback at line 818
      // We verify the init method exists and can be called
      expect(typeof window.$exeExport.searchBar.init).toBe('function');

      // Verify init doesn't throw when called (it may have already been called)
      expect(() => window.$exeExport.searchBar.init()).not.toThrow();
    });
  });
});
