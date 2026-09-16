import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

require('./common.js');

describe('MathJax configuration', () => {
  it('turns off every feature the Speech Rule Engine backs', () => {
    // The engine is not vendored (ADR-2259-03) and speech lives inside the combined
    // component, so the toggles have to be off or they request a missing file and
    // leave typesetPromise() unsettled. `enrich` gates all four.
    const settings = global.window.MathJax.options.menuOptions.settings;
    expect(settings.enrich).toBe(false);
    expect(settings.speech).toBe(false);
    expect(settings.braille).toBe(false);
    expect(settings.collapsible).toBe(false);
  });

  it('keeps assistive MathML on, which is independent of enrichment', () => {
    expect(global.window.MathJax.options.menuOptions.settings.assistiveMml).toBe(true);
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
    delete global.window.MathJax.startup.document;
    delete global.window.MathJax._;
  });

  it('hands control to MathJax before touching anything', () => {
    global.window.MathJax.startup.ready();

    expect(defaultReady).toHaveBeenCalledTimes(1);
  });

  it('hides the unavailable menu entries once MathJax has started', () => {
    const hide = vi.fn();
    const findID = vi.fn(() => ({ hide }));
    global.window.MathJax.startup.document = { menu: { menu: { findID } } };

    global.window.MathJax.startup.ready();

    expect(hide).toHaveBeenCalledTimes(5);
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

describe('MathJax font paths', () => {
  it('resolves the font glyph ranges next to the vendored bundle', () => {
    // The stock value is https://cdn.jsdelivr.net/npm/@mathjax, which would put an
    // external request inside every exported package and leave \mathbb, \mathcal and
    // the stretchy arrows blank wherever there is no network.
    expect(global.window.MathJax.loader.paths.fonts).toBe('[mathjax]/fonts');
  });
});

describe('$exe.math.silenceUnvendoredFontRanges', () => {
  function fontWith(chars) {
    return {
      variant: { normal: { chars } },
      CLASS: { dynamicFiles: { latin: { file: 'latin', promise: null, setup: () => {} } } },
    };
  }

  afterEach(() => {
    delete global.window.MathJax.startup.document;
  });

  it('reports nothing dropped rather than throwing before MathJax has started', () => {
    expect(global.$exe.math.silenceUnvendoredFontRanges()).toBe(0);
  });

  it('drops the placeholders of ranges this build does not ship', () => {
    // A placeholder is the range descriptor; real glyph data is an array. Leaving an
    // unvendored placeholder in place makes the second request for that range reject
    // and fail the whole typeset call.
    const chars = {
      225: { file: 'latin' },
      8477: { file: 'double-struck' },
      65: [0, 0, 0.5],
    };
    global.window.MathJax.startup.document = { outputJax: { font: fontWith(chars) } };

    expect(global.$exe.math.silenceUnvendoredFontRanges()).toBe(1);
    expect(chars[225]).toBeUndefined();
  });

  it('keeps the placeholders of ranges that are vendored', () => {
    const chars = { 8477: { file: 'double-struck' } };
    global.window.MathJax.startup.document = { outputJax: { font: fontWith(chars) } };

    global.$exe.math.silenceUnvendoredFontRanges();

    expect(chars[8477]).toEqual({ file: 'double-struck' });
  });

  it('leaves real glyph data alone', () => {
    const chars = { 65: [0, 0, 0.5] };
    global.window.MathJax.startup.document = { outputJax: { font: fontWith(chars) } };

    expect(global.$exe.math.silenceUnvendoredFontRanges()).toBe(0);
    expect(chars[65]).toEqual([0, 0, 0.5]);
  });

  it('makes an unvendored range resolve instead of reject, as a second line', () => {
    const font = fontWith({});
    global.window.MathJax.startup.document = { outputJax: { font } };

    global.$exe.math.silenceUnvendoredFontRanges();

    expect(font.CLASS.dynamicFiles.latin.promise).toBeInstanceOf(Promise);
  });
});

describe('$exe.math.hideUnavailableMenuEntries', () => {
  afterEach(() => {
    delete global.window.MathJax.startup.document;
  });

  it('reports nothing hidden rather than throwing before the menu exists', () => {
    expect(global.$exe.math.hideUnavailableMenuEntries()).toBe(0);
  });

  it('reports nothing hidden when the menu exposes no findID', () => {
    global.window.MathJax.startup.document = { menu: { menu: {} } };

    expect(global.$exe.math.hideUnavailableMenuEntries()).toBe(0);
  });

  it('hides the SRE sections and the renderer', () => {
    const hide = vi.fn();
    const findID = vi.fn(() => ({ hide }));
    global.window.MathJax.startup.document = { menu: { menu: { findID } } };

    expect(global.$exe.math.hideUnavailableMenuEntries()).toBe(5);
    expect(findID.mock.calls).toEqual([
      ['Accessibility'],
      ['Speech'],
      ['Braille'],
      ['Explorer'],
      ['Settings', 'Renderer'],
    ]);
  });

  it('skips entries MathJax stops offering instead of throwing', () => {
    global.window.MathJax.startup.document = { menu: { menu: { findID: () => null } } };

    expect(global.$exe.math.hideUnavailableMenuEntries()).toBe(0);
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

  it('drops an assistiveMml:false that the Speech toggle persisted', () => {
    // Measured in Chrome: toggling Speech off and on in the contextual menu leaves
    // {"assistiveMml":false} in localStorage and zero mjx-assistive-mml nodes. In an
    // export opened from the filesystem speech cannot start either, so the reader
    // would be left with no accessible maths at all. ADR-2259-02.
    store.set(KEY, JSON.stringify({ assistiveMml: false, zoom: 'Click' }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(true);
    expect(JSON.parse(store.get(KEY))).toEqual({ zoom: 'Click' });
  });

  it('leaves an assistiveMml:true alone, which is already the floor', () => {
    store.set(KEY, JSON.stringify({ assistiveMml: true }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(false);
    expect(JSON.parse(store.get(KEY))).toEqual({ assistiveMml: true });
  });

  it('drops both keys at once', () => {
    store.set(KEY, JSON.stringify({ renderer: 'CHTML', assistiveMml: false }));

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(true);
    expect(store.has(KEY)).toBe(false);
  });

  it('survives corrupt stored JSON', () => {
    store.set(KEY, '{not json');

    expect(global.$exe.math.forgetUnavailableMenuSettings()).toBe(false);
  });
});
