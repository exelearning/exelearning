import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

  it('getMaterialIconPath falls back when icon is missing from catalog', () => {
    const runtime = require('./blockIconRuntime.js');

    expect(runtime.getMaterialIconPath('', { catalog: ['alarm'] })).toContain('help.svg');
    expect(runtime.getMaterialIconPath('unknown', { catalog: ['alarm'] })).toContain('help.svg');
    expect(runtime.getMaterialIconPath('alarm', { catalog: ['alarm'] })).toContain('alarm.svg');
  });

  it('renderMaterialMaskIcon emits a span with the resolved icon URL', () => {
    const runtime = require('./blockIconRuntime.js');
    const html = runtime.renderMaterialMaskIcon('alarm', { config: { basePath: '/exe' } });

    expect(html).toContain('class="exe-material-icon"');
    expect(html).toContain("--exe-material-icon-url:url('/exe/libs/material-icons/icons/alarm.svg');");
  });
});
