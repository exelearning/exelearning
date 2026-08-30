import { beforeEach, describe, expect, it } from 'vitest';

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
