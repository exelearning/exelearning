import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

require('./common.js');

describe('MathJax configuration', () => {
  it('exposes the speech locales the vendored tree ships', () => {
    // Kept equal to VENDORED_SRE_LOCALES in scripts/vendor-mathjax.ts by
    // src/shared/export/prerender/mathjax-packages.spec.ts.
    expect(global.window.MATHJAX_SPEECH_LOCALES).toEqual(['ca', 'de', 'en', 'es', 'it']);
  });

  it('loads assistive MathML, which is the only a11y path that needs no worker', () => {
    // MathJax 4 turns assistive MathML off in favour of the speech extension, but
    // speech needs a web worker and a fetch, and neither survives an export opened
    // from the filesystem. Hidden MathML is what screen readers actually consume.
    expect(global.window.MathJax.loader.load).toContain('a11y/assistive-mml');
    expect(global.window.MathJax.options.enableAssistiveMml).toBe(true);
  });

  it('does not enable extensions whose fonts MathJax does not publish', () => {
    // bbm and bboldx render undefined-macro errors with the mathjax-newcm font.
    const packages = global.window.MathJax.tex.packages['[+]'];
    expect(packages).not.toContain('bbm');
    expect(packages).not.toContain('bboldx');
  });

  it('enables the extensions the 3.2.2 bundle could not load', () => {
    const packages = global.window.MathJax.tex.packages['[+]'];
    for (const extension of ['begingroup', 'colorv2', 'dsfont', 'texhtml', 'units']) {
      expect(packages).toContain(extension);
    }
  });

  it('requests every configured extension from the loader', () => {
    const packages = global.window.MathJax.tex.packages['[+]'];
    for (const extension of packages) {
      expect(global.window.MathJax.loader.load).toContain(`[tex]/${extension}`);
    }
  });
});

describe('MathJax startup.ready', () => {
  let defaultReady;

  beforeEach(() => {
    defaultReady = vi.fn();
    global.window.MathJax.startup.defaultReady = defaultReady;
  });

  afterEach(() => {
    delete global.window.MathJax.startup.defaultReady;
    delete global.window.MathJax._;
  });

  it('hands control to MathJax before touching anything', () => {
    global.window.MathJax.startup.ready();

    expect(defaultReady).toHaveBeenCalledTimes(1);
  });

  it('trims the language menu once MathJax has started', () => {
    const locales = new Map([
      ['en', 'English'],
      ['es', 'Spanish'],
      ['sv', 'Swedish'],
    ]);
    global.window.MathJax._ = { a11y: { sre_ts: { locales } } };

    global.window.MathJax.startup.ready();

    expect([...locales.keys()]).toEqual(['en', 'es']);
  });

  it('still starts MathJax when $exe is unavailable', () => {
    // Anything thrown here would leave MathJax permanently un-started, costing every
    // formula on the page to tidy up one menu.
    const originalMath = global.$exe.math;
    delete global.$exe.math;
    try {
      expect(() => global.window.MathJax.startup.ready()).not.toThrow();
      expect(defaultReady).toHaveBeenCalledTimes(1);
    } finally {
      global.$exe.math = originalMath;
    }
  });
});

describe('$exe.math.trimSpeechLocaleMenu', () => {
  beforeEach(() => {
    delete global.window.MathJax._;
  });

  it('reports failure rather than throwing when MathJax has not exposed SRE yet', () => {
    expect(global.$exe.math.trimSpeechLocaleMenu()).toBe(false);
  });

  it('reports failure when the locales map is not a Map', () => {
    global.window.MathJax._ = { a11y: { sre_ts: { locales: {} } } };

    expect(global.$exe.math.trimSpeechLocaleMenu()).toBe(false);
  });

  it('removes languages whose speech rules are not vendored', () => {
    // MathJax offers every locale its bundle knows about, not the ones on disk, and
    // choosing a missing one makes the speech worker hang forever. See issue #2259.
    const locales = new Map([
      ['af', 'Afrikaans'],
      ['ca', 'Catalan'],
      ['da', 'Danish'],
      ['de', 'German'],
      ['en', 'English'],
      ['es', 'Spanish'],
      ['fr', 'French'],
      ['hi', 'Hindi'],
      ['it', 'Italian'],
      ['ko', 'Korean'],
      ['nb', 'Bokmål'],
      ['nn', 'Nynorsk'],
      ['sv', 'Swedish'],
      ['euro', 'Euro'],
      ['nemeth', 'Nemeth'],
    ]);
    global.window.MathJax._ = { a11y: { sre_ts: { locales } } };

    expect(global.$exe.math.trimSpeechLocaleMenu()).toBe(true);
    expect([...locales.keys()].sort()).toEqual(['ca', 'de', 'en', 'es', 'euro', 'it', 'nemeth']);
  });

  it('keeps the euro and nemeth support maps, which are not languages', () => {
    const locales = new Map([
      ['en', 'English'],
      ['euro', 'Euro'],
      ['nemeth', 'Nemeth'],
      ['sv', 'Swedish'],
    ]);
    global.window.MathJax._ = { a11y: { sre_ts: { locales } } };
    global.$exe.math.trimSpeechLocaleMenu();

    expect(locales.has('euro')).toBe(true);
    expect(locales.has('nemeth')).toBe(true);
    expect(locales.has('sv')).toBe(false);
  });

  it('leaves an already-trimmed map untouched', () => {
    const locales = new Map([
      ['en', 'English'],
      ['es', 'Spanish'],
    ]);
    global.window.MathJax._ = { a11y: { sre_ts: { locales } } };
    global.$exe.math.trimSpeechLocaleMenu();

    expect([...locales.keys()]).toEqual(['en', 'es']);
  });
});

describe('MathJax font paths', () => {
  it('resolves the font glyph ranges next to the vendored bundle', () => {
    // The stock value is https://cdn.jsdelivr.net/npm/@mathjax, which would put an
    // external request inside every exported package and leave \mathbb, \mathcal and
    // the stretchy arrows blank wherever there is no network.
    expect(global.window.MathJax.loader.paths.fonts).toBe('[mathjax]/fonts');
  });
});

describe('$exe.math.hideUnavailableRendererMenu', () => {
  afterEach(() => {
    delete global.window.MathJax.startup.document;
  });

  it('reports failure rather than throwing before the menu exists', () => {
    expect(global.$exe.math.hideUnavailableRendererMenu()).toBe(false);
  });

  it('reports failure when the menu exposes no findID', () => {
    global.window.MathJax.startup.document = { menu: { menu: {} } };

    expect(global.$exe.math.hideUnavailableRendererMenu()).toBe(false);
  });

  it('hides the renderer submenu', () => {
    // CHTML is not vendored and its woff2 font is a separate package, so choosing it
    // would request two files that are not there.
    const hide = vi.fn();
    const findID = vi.fn(() => ({ hide }));
    global.window.MathJax.startup.document = { menu: { menu: { findID } } };

    expect(global.$exe.math.hideUnavailableRendererMenu()).toBe(true);
    expect(findID).toHaveBeenCalledWith('Settings', 'Renderer');
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('reports failure when MathJax stops offering that entry', () => {
    global.window.MathJax.startup.document = { menu: { menu: { findID: () => null } } };

    expect(global.$exe.math.hideUnavailableRendererMenu()).toBe(false);
  });
});

describe('$exe.math.forgetUnavailableMenuSettings', () => {
  const KEY = 'MathJax-Menu-Settings';
  let store;

  beforeEach(() => {
    // The setup file gives common.js a bare window, with no Storage. Stub the two
    // calls the helper makes rather than pulling in a DOM for one localStorage read.
    store = new Map();
    global.window.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  });

  afterEach(() => {
    delete global.window.localStorage;
  });

  it('does nothing when the menu has never been used', () => {
    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(false);
  });

  it('leaves settings that do not name a renderer alone', () => {
    store.set(KEY, JSON.stringify({ zoom: 'Click' }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(false);
    expect(JSON.parse(store.get(KEY))).toEqual({ zoom: 'Click' });
  });

  it('drops a stored renderer choice, which would load on every page', () => {
    // The menu persists per origin, so one CHTML click on any MathJax page of the
    // site would make every later page request the missing component at startup.
    store.set(KEY, JSON.stringify({ renderer: 'CHTML', zoom: 'Click' }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(true);
    expect(JSON.parse(store.get(KEY))).toEqual({ zoom: 'Click' });
  });

  it('removes the entry entirely when the renderer was the only setting', () => {
    store.set(KEY, JSON.stringify({ renderer: 'CHTML' }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(true);
    expect(store.has(KEY)).toBe(false);
  });

  it('survives corrupt stored JSON', () => {
    store.set(KEY, '{not json');

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(false);
  });
});
