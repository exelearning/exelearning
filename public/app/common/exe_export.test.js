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

      expect(resultsList.innerHTML).toContain('Test Page');
    });
  });

  describe('searchBar.getLink', () => {
    it('returns link as-is for preview', () => {
      window.$exeExport.searchBar.isPreview = true;
      expect(window.$exeExport.searchBar.getLink('html/page.html')).toBe('html/page.html');
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

      expect(res).toContain('bloque 2');
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

      expect(res).toContain('bloque 1');
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
      expect(res).not.toContain('bloque');
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
});
