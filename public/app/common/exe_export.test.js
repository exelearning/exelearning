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
});
