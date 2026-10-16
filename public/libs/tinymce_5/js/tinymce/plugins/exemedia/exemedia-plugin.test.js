/**
 * ExeMedia Plugin tests.
 *
 * Covers two contracts that share this plugin source:
 * - Centralized caption / attribution helpers (Workstream B, PR #1868 family).
 *   The plugin is a hand-maintained IIFE that cannot be imported, so — following
 *   the exeimage-plugin.test.js convention — those pure helpers are mirrored here
 *   and MUST be kept in lockstep with plugin.min.js. The figure builder mirror
 *   uses the REAL shared caption builder (figureCaption.js).
 * - SetNewEmbedData missing-dimensions guard (issue #2273). Those tests extract
 *   and execute the real function from the plugin source so the shipped code is
 *   what gets exercised.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildFigureCaption } from '../../../../../../app/common/figureCaption.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Mirror of exeAssetIdFromSrc().
function exeAssetIdFromSrc(src) {
  const m = /^asset:\/\/([a-z0-9-]+?)(?:\.[a-z0-9]+)?(?:[/?#]|$)/i.exec(src || '');
  return m ? m[1] : '';
}

// Mirror of exeBuildCentralizedMediaFigure(). `state` mirrors the module vars
// (mediaHeader/captionNotes/captionHidden + actualFigureClass), `meta` mirrors the
// centralized metadata exeResolveAssetMeta() returns.
function exeBuildCentralizedMediaFigure(html, assetId, mediaWidth, state, meta) {
  const instance = { heading: state.heading, notes: state.notes, hidden: state.hidden };
  const captionParts = buildFigureCaption(meta || {}, instance);
  const visibleParts = state.hidden
    ? buildFigureCaption(meta || {}, { heading: state.heading, notes: state.notes, hidden: false })
    : captionParts;
  if (visibleParts.header === '' && visibleParts.caption === '') {
    return html;
  }

  let alignment = 'position-center';
  const previousClass = state.previousClass || '';
  ['float-left', 'float-right', 'position-left', 'position-right', 'position-center'].some(cls => {
    if (previousClass.indexOf(cls) !== -1) {
      alignment = cls;
      return true;
    }
    return false;
  });

  const figure = document.createElement('figure');
  figure.className = 'exe-figure exe-media ' + alignment;
  if (mediaWidth) figure.setAttribute('style', 'width:' + mediaWidth + 'px;');
  figure.setAttribute('data-asset-id', assetId);
  if (state.heading) figure.setAttribute('data-caption-heading', state.heading);
  if (state.notes) figure.setAttribute('data-caption-notes', state.notes);
  if (state.hidden) figure.setAttribute('data-caption-hidden', 'true');
  figure.innerHTML = (captionParts.header || '') + html + (captionParts.caption || '');
  figure.querySelectorAll('.figcaption.header, figcaption.figcaption').forEach(node => {
    node.setAttribute('contenteditable', 'false');
  });
  return figure.outerHTML;
}

// Mirror of buildTabs() branching (tab names only). The attribution tab is ALWAYS
// present now: editable for external media, a read-only mirror for asset:// media.
function buildTabNames(isAsset, hasAdvanced) {
  const tabs = ['general', 'attribution', 'attributes', 'subtitles'];
  if (hasAdvanced) tabs.push('advanced');
  return tabs;
}

// Mirror of exeAttributionMirror(): maps centralized File Manager metadata to the
// read-only ro_* fields shown (disabled) for asset:// media. MUST stay in lockstep
// with plugin.min.js.
function exeAttributionMirror(meta) {
  meta = meta || {};
  return {
    ro_title: meta.title || '',
    ro_author: meta.author || '',
    ro_authorlink: meta.authorUrl || '',
    ro_source: meta.sourceUrl || '',
    ro_license: meta.license || '',
  };
}

// Mirror of the GetActualData() figure-state branching.
function readFigureCaptionState(figure) {
  if (figure && figure.getAttribute('data-asset-id')) {
    return {
      centralized: true,
      heading: figure.getAttribute('data-caption-heading') || '',
      notes: figure.getAttribute('data-caption-notes') || '',
      hidden: figure.getAttribute('data-caption-hidden') === 'true',
    };
  }
  return { centralized: false };
}

// Mirror of the handleInsert() legacy class-fixup guard.
function shouldApplyLegacyClassFixups(html) {
  return html.indexOf('data-asset-id=') === -1;
}

const VIDEO = '<video width="560" height="315" controls="controls"><source src="asset://m1.mp4"></video>';

describe('ExeMedia Plugin - asset id extraction', () => {
  it('extracts the asset id from asset:// media sources', () => {
    expect(exeAssetIdFromSrc('asset://abc123.mp4')).toBe('abc123');
    expect(exeAssetIdFromSrc('asset://abc123')).toBe('abc123');
    expect(exeAssetIdFromSrc('asset://uuid-with-dashes.webm')).toBe('uuid-with-dashes');
  });

  it('returns no id for external sources (YouTube / Vimeo / plain URLs / blobs)', () => {
    expect(exeAssetIdFromSrc('https://www.youtube.com/watch?v=xyz')).toBe('');
    expect(exeAssetIdFromSrc('https://vimeo.com/123')).toBe('');
    expect(exeAssetIdFromSrc('https://example.org/clip.mp4')).toBe('');
    expect(exeAssetIdFromSrc('blob:http://localhost/abc')).toBe('');
    expect(exeAssetIdFromSrc('')).toBe('');
  });
});

describe('ExeMedia Plugin - centralized figure build', () => {
  const meta = { title: 'Intro clip', author: 'Ada Lovelace', license: 'Creative Commons BY' };

  it('wraps asset media in figure[data-asset-id] with the caption derived from metadata', () => {
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: '', notes: '', hidden: false }, meta);
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    const figure = wrap.firstElementChild;

    expect(figure.tagName).toBe('FIGURE');
    expect(figure.className).toBe('exe-figure exe-media position-center');
    expect(figure.getAttribute('data-asset-id')).toBe('m1');
    expect(figure.getAttribute('style')).toBe('width:560px;');
    // The media element round-trips inside the figure.
    expect(figure.querySelector('video source').getAttribute('src')).toBe('asset://m1.mp4');
    const caption = figure.querySelector('figcaption.figcaption');
    expect(caption.textContent).toContain('Intro clip');
    expect(caption.textContent).toContain('Ada Lovelace');
    expect(caption.querySelector('a.license[rel~="license"]')).not.toBeNull();
  });

  it('does NOT wrap when no caption would render (#1664/#1668 guard)', () => {
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: '', notes: '', hidden: false }, {});
    expect(out).toBe(VIDEO);
  });

  it('keeps the figure (and data-caption-hidden) when the caption is hidden but would render', () => {
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: '', notes: '', hidden: true }, meta);
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    const figure = wrap.firstElementChild;
    expect(figure.tagName).toBe('FIGURE');
    expect(figure.getAttribute('data-caption-hidden')).toBe('true');
    // Hidden: no caption nodes rendered, but the state round-trips on the figure.
    expect(figure.querySelector('figcaption')).toBeNull();
    expect(figure.querySelector('.figcaption.header')).toBeNull();
  });

  it('unwraps to plain media when hiding and nothing would render anyway', () => {
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: '', notes: '', hidden: true }, {});
    expect(out).toBe(VIDEO);
  });

  it('stamps per-instance heading/notes as data-* and renders them', () => {
    const out = exeBuildCentralizedMediaFigure(
      VIDEO,
      'm1',
      560,
      { heading: 'Clip 1', notes: 'Trimmed for length', hidden: false },
      meta,
    );
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    const figure = wrap.firstElementChild;
    expect(figure.getAttribute('data-caption-heading')).toBe('Clip 1');
    expect(figure.getAttribute('data-caption-notes')).toBe('Trimmed for length');
    expect(figure.querySelector('.figcaption.header').textContent).toBe('Clip 1');
    expect(figure.querySelector('.notes').textContent).toBe('Trimmed for length');
  });

  it('locks the auto-derived caption nodes (contenteditable="false")', () => {
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: 'H', notes: '', hidden: false }, meta);
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    expect(wrap.querySelector('.figcaption.header').getAttribute('contenteditable')).toBe('false');
    expect(wrap.querySelector('figcaption.figcaption').getAttribute('contenteditable')).toBe('false');
  });

  it('preserves the previous figure alignment class', () => {
    const out = exeBuildCentralizedMediaFigure(
      VIDEO,
      'm1',
      560,
      { heading: '', notes: '', hidden: false, previousClass: 'exe-figure exe-media float-right' },
      meta,
    );
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    expect(wrap.firstElementChild.className).toBe('exe-figure exe-media float-right');
  });

  it('quotes in heading/notes stay inert (DOM-built attributes, no injection)', () => {
    const evil = '" onmouseover="window.__xss=1';
    const out = exeBuildCentralizedMediaFigure(VIDEO, 'm1', 560, { heading: evil, notes: '', hidden: false }, meta);
    const wrap = document.createElement('div');
    wrap.innerHTML = out;
    const figure = wrap.firstElementChild;
    expect(figure.getAttribute('data-caption-heading')).toBe(evil);
    expect(figure.getAttribute('onmouseover')).toBeNull();
    expect(figure.querySelector('.figcaption.header').textContent).toContain('onmouseover');
  });
});

describe('ExeMedia Plugin - dialog tab set per source kind', () => {
  it('asset:// media shows the attribution tab as a read-only mirror', () => {
    expect(buildTabNames(true, false)).toEqual(['general', 'attribution', 'attributes', 'subtitles']);
  });

  it('external media keeps the attribution tab editable (per-instance storage)', () => {
    expect(buildTabNames(false, false)).toEqual(['general', 'attribution', 'attributes', 'subtitles']);
    expect(buildTabNames(false, true)).toEqual(['general', 'attribution', 'attributes', 'subtitles', 'advanced']);
  });
});

describe('ExeMedia Plugin - read-only attribution mirror (asset:// media)', () => {
  it('maps centralized File Manager metadata to the disabled ro_* fields', () => {
    const meta = {
      title: 'Intro clip',
      author: 'Ada Lovelace',
      authorUrl: 'https://example.org/ada',
      sourceUrl: 'https://example.org/clip',
      license: 'Creative Commons BY-SA',
    };
    expect(exeAttributionMirror(meta)).toEqual({
      ro_title: 'Intro clip',
      ro_author: 'Ada Lovelace',
      ro_authorlink: 'https://example.org/ada',
      ro_source: 'https://example.org/clip',
      ro_license: 'Creative Commons BY-SA',
    });
  });

  it('yields empty strings for missing metadata or an unmanaged (external) source', () => {
    expect(exeAttributionMirror({})).toEqual({
      ro_title: '',
      ro_author: '',
      ro_authorlink: '',
      ro_source: '',
      ro_license: '',
    });
    expect(exeAttributionMirror(null)).toEqual({
      ro_title: '',
      ro_author: '',
      ro_authorlink: '',
      ro_source: '',
      ro_license: '',
    });
    expect(exeAttributionMirror({ title: 'Only title' }).ro_author).toBe('');
  });
});

describe('ExeMedia Plugin - existing figure state read-back', () => {
  it('reads data-caption-* from centralized figures', () => {
    const figure = document.createElement('figure');
    figure.setAttribute('data-asset-id', 'm1');
    figure.setAttribute('data-caption-heading', 'Clip 1');
    figure.setAttribute('data-caption-hidden', 'true');
    expect(readFigureCaptionState(figure)).toEqual({
      centralized: true,
      heading: 'Clip 1',
      notes: '',
      hidden: true,
    });
  });

  it('treats figures without data-asset-id as legacy (per-instance scraping path)', () => {
    const figure = document.createElement('figure');
    figure.className = 'exe-figure exe-media';
    expect(readFigureCaptionState(figure).centralized).toBe(false);
  });
});

describe('ExeMedia Plugin - handleInsert legacy fixup guard', () => {
  it('skips the single-quote class fixups for centralized figures', () => {
    const centralized = '<figure class="exe-figure exe-media position-center" data-asset-id="m1"></figure>';
    expect(shouldApplyLegacyClassFixups(centralized)).toBe(false);
  });

  it('keeps the fixups for legacy external figures', () => {
    const legacy = "<figure class='exe-figure exe-media position-center' style='width:560px;'></figure>";
    expect(shouldApplyLegacyClassFixups(legacy)).toBe(true);
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_PATH = join(__dirname, 'plugin.min.js');
const pluginSource = readFileSync(PLUGIN_PATH, 'utf-8');

// The plugin is a large IIFE; pull the two relevant top-level functions out of
// it verbatim (they are self-contained) so the real source runs in the tests.
function extractFunction(name) {
    const start = pluginSource.indexOf(`    function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const closing = '\n    }';
    const end = pluginSource.indexOf(closing, start);
    expect(end).toBeGreaterThan(start);
    return pluginSource.slice(start, end + closing.length);
}

const setNewEmbedData = new Function(
    'api',
    'type',
    `${extractFunction('isLocalPDF')}\n${extractFunction('SetNewEmbedData')}\nreturn SetNewEmbedData(api, type);`,
);

function makeApi(data) {
    const state = { ...data };
    return {
        getData: () => state,
        setData: vi.fn((patch) => Object.assign(state, patch)),
    };
}

describe('exemedia plugin - SetNewEmbedData missing dimensions guard (issue #2273)', () => {
    it('does not throw when getData() has no dimensions field (Sentry repro)', () => {
        const api = makeApi({ source: { value: 'files/tmp/session/movie.mp4' } });

        let embed;
        expect(() => {
            embed = setNewEmbedData(api, 'video');
        }).not.toThrow();

        // Falls back to the generic default size.
        expect(embed).toContain('<video');
        expect(embed).toContain('width ="300"');
        expect(embed).toContain('height="150"');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '300', height: '150' } });
    });

    it('uses the Mediateca EducaMadrid audio default when dimensions are missing', () => {
        const api = makeApi({ source: { value: 'https://mediateca.educa.madrid.org/audio/abc123' } });

        const embed = setNewEmbedData(api, 'iframe');

        expect(embed).toContain('<iframe');
        expect(embed).toContain('width ="420"');
        expect(embed).toContain('height="44"');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '420', height: '44' } });
    });

    it('still applies the defaults when dimensions are empty strings (previous behavior)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '', height: '' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toContain('width ="300"');
        expect(embed).toContain('height="150"');
    });

    it('keeps explicit dimensions untouched (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '640', height: '360' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toBe(
            '<video width ="640" height="360" controls ="controls"><source src="files/tmp/session/movie.mp4"/></video>',
        );
        expect(api.setData).not.toHaveBeenCalled();
    });

    it("keeps a literal '0' size (size inputs are strings, so '0' is not treated as missing)", () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '0', height: '0' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toContain('width ="0"');
        expect(embed).toContain('height="0"');
        expect(api.setData).not.toHaveBeenCalled();
    });

    it('still clears dimensions for audio embeds (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/track.mp3' },
            dimensions: { width: '300', height: '150' },
        });

        const embed = setNewEmbedData(api, 'audio');

        expect(embed).toBe('<audio controls ="controls" src="files/tmp/session/track.mp3"></audio>');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '', height: '' } });
    });

    it('still embeds local PDFs when no media type matches (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/doc.pdf' },
            dimensions: { width: '500', height: '400' },
        });

        const embed = setNewEmbedData(api, '');

        expect(embed).toContain('<embed');
        expect(embed).toContain('type="application/pdf"');
        expect(embed).toContain('src="files/tmp/session/doc.pdf"');
    });
});
