import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const SPRITE = [
  '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
  '<symbol id="alarm" viewBox="0 -960 960 960"><path d="M40-200Z"/></symbol>',
  '<symbol id="lightbulb" viewBox="0 -960 960 960"><path d="M10-10Z"/></symbol>',
  '<symbol id="help" viewBox="0 -960 960 960"><path d="M1-1Z"/></symbol>',
  '</svg>',
].join('\n');

describe('blockIconRuntime', () => {
  let originalExeLearning;
  let originalRuntime;

  beforeEach(() => {
    originalExeLearning = global.eXeLearning;
    originalRuntime = global.eXeBlockIconRuntime;
    delete require.cache[require.resolve('./blockIconRuntime.js')];
  });

  afterEach(() => {
    if (typeof originalExeLearning === 'undefined') {
      delete global.eXeLearning;
    } else {
      global.eXeLearning = originalExeLearning;
    }

    if (typeof originalRuntime === 'undefined') {
      delete global.eXeBlockIconRuntime;
    } else {
      global.eXeBlockIconRuntime = originalRuntime;
    }
  });

  it('exports runtime helpers and assigns the global runtime', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.MATERIAL_ICON_FALLBACK).toBe('help');
    expect(global.eXeBlockIconRuntime).toBe(runtime);
  });

  it('resolveAppAssetUrl uses composeUrl when available', () => {
    const runtime = require('./blockIconRuntime.js');
    const app = {
      composeUrl(path) {
        return `/composed${path}`;
      },
    };

    expect(runtime.resolveAppAssetUrl('libs/test.svg', { app })).toBe('/composed/libs/test.svg');
  });

  it('resolveAppAssetUrl falls back to config JSON basePath and ignores invalid JSON', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.resolveAppAssetUrl('/libs/test.svg', {
      config: JSON.stringify({ basePath: '/exe' }),
    })).toBe('/exe/libs/test.svg');

    expect(runtime.resolveAppAssetUrl('/libs/test.svg', {
      config: '{invalid-json',
    })).toBe('/libs/test.svg');
  });

  it('deriveBlockIcon maps legacy icon names to structured descriptors', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.deriveBlockIcon('mi-lightbulb')).toEqual({ source: 'material', value: 'lightbulb' });
    expect(runtime.deriveBlockIcon('asset://uuid/icon.png')).toEqual({
      source: 'asset',
      value: 'asset://uuid/icon.png',
    });
    expect(runtime.deriveBlockIcon('/files/x.png')).toEqual({ source: 'asset', value: '/files/x.png' });
    expect(runtime.deriveBlockIcon('objectives')).toEqual({ source: 'theme', value: 'objectives' });
    expect(runtime.deriveBlockIcon('')).toEqual({ source: 'none', value: '' });
    expect(runtime.deriveBlockIcon(null)).toEqual({ source: 'none', value: '' });
  });

  it('renderMaterialMaskIcon emits a placeholder before the sprite is loaded', () => {
    const runtime = require('./blockIconRuntime.js');
    const html = runtime.renderMaterialMaskIcon('alarm');

    expect(html).toContain('class="exe-material-icon"');
    expect(html).toContain('data-exe-material-icon="alarm"');
    expect(html).not.toContain('--exe-material-icon-url');
  });

  it('renderMaterialMaskIcon emits a data: URI once the sprite is loaded', () => {
    const runtime = require('./blockIconRuntime.js');
    runtime.loadMaterialSprite(SPRITE);
    const html = runtime.renderMaterialMaskIcon('alarm');

    expect(html).toContain('class="exe-material-icon"');
    expect(html).toContain("--exe-material-icon-url:url('data:image/svg+xml;utf8,");
    expect(html).not.toContain('data-exe-material-icon');
    const encoded = html.match(/url\('([^']+)'\)/)[1].replace('data:image/svg+xml;utf8,', '');
    expect(decodeURIComponent(encoded)).toContain('<path d="M40-200Z"/>');
  });

  it('loadMaterialSprite parses the sprite and reports it loaded', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.isMaterialSpriteLoaded()).toBe(false);
    expect(runtime.loadMaterialSprite(SPRITE)).toBe(3);
    expect(runtime.isMaterialSpriteLoaded()).toBe(true);
  });

  it('getMaterialIconDataUri resolves icons and falls back to "help"', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.getMaterialIconDataUri('alarm')).toBeNull();

    runtime.loadMaterialSprite(SPRITE);
    const alarm = runtime.getMaterialIconDataUri('alarm');
    expect(decodeURIComponent(alarm)).toContain('<path d="M40-200Z"/>');

    const unknown = runtime.getMaterialIconDataUri('does-not-exist');
    expect(decodeURIComponent(unknown)).toContain('<path d="M1-1Z"/>');
  });

  it('hydrateMaterialIcons fills placeholders rendered before the sprite arrived', () => {
    const runtime = require('./blockIconRuntime.js');
    const applied = [];
    const removed = [];
    const placeholder = {
      getAttribute: () => 'alarm',
      style: { setProperty: (name, value) => applied.push([name, value]) },
      removeAttribute: attr => removed.push(attr),
    };
    const root = { querySelectorAll: () => [placeholder] };

    // loadMaterialSprite hydrates the provided root automatically.
    runtime.loadMaterialSprite(SPRITE, { root });

    expect(applied).toHaveLength(1);
    expect(applied[0][0]).toBe('--exe-material-icon-url');
    expect(applied[0][1]).toContain('data:image/svg+xml;utf8,');
    expect(removed).toContain('data-exe-material-icon');
  });
});
