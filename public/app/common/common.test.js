import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

require('./common.js');

describe('common.js $exe helpers', () => {
  let originalExeLearning;

  beforeEach(() => {
    originalExeLearning = global.eXeLearning;
    document.body.className = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (typeof originalExeLearning === 'undefined') {
      delete global.eXeLearning;
    } else {
      global.eXeLearning = originalExeLearning;
    }
    vi.restoreAllMocks();
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('rgb2hex returns hex for rgb values and preserves hex input', () => {
    expect(global.$exe.rgb2hex('#aabbcc')).toBe('#aabbcc');
    expect(global.$exe.rgb2hex('rgb(255, 0, 128)')).toBe('#ff0080');
  });

  it('useBlackOrWhite returns appropriate text color', () => {
    expect(global.$exe.useBlackOrWhite('ffffff')).toBe('black');
    expect(global.$exe.useBlackOrWhite('000000')).toBe('white');
  });

  it('isInExe and isPreview reflect global and body state', () => {
    global.eXeLearning = {};
    expect(global.$exe.isInExe()).toBe(true);
    delete global.eXeLearning;
    expect(global.$exe.isInExe()).toBe(false);

    document.body.classList.add('preview');
    expect(global.$exe.isPreview()).toBe(true);
  });

  it('getIdeviceInstalledExportPath reads correct attributes', () => {
    global.eXeLearning = {};
    document.body.innerHTML = `
      <article class="idevice_node" idevice-type="text" idevice-path="/exe/path"></article>
    `;
    expect(global.$exe.getIdeviceInstalledExportPath('text')).toBe('/exe/path');

    delete global.eXeLearning;
    document.body.innerHTML = `
      <article class="idevice_node" data-idevice-type="text" data-idevice-path="/export/path"></article>
    `;
    expect(global.$exe.getIdeviceInstalledExportPath('text')).toBe('/export/path');
  });

  it('hasTooltips loads tooltip script when tooltips are present', () => {
    global.eXeLearning = { symfony: { fullURL: 'http://example.com' } };
    document.body.innerHTML = '<a class="exe-tooltip" href="#"></a>';

    const loadSpy = vi.spyOn(global.$exe, 'loadScript').mockImplementation(() => {});

    global.$exe.hasTooltips();

    expect(loadSpy).toHaveBeenCalledWith(
      'http://example.com/app/common/exe_tooltips/exe_tooltips.js',
      "$exe.tooltips.init('http://example.com/app/common/exe_tooltips/')"
    );
  });

  it('loadScript appends script and link elements to the document head', () => {
    const head = document.getElementsByTagName('head')[0];
    const appendSpy = vi.spyOn(head, 'appendChild');
    appendSpy.mockImplementation((node) => node);

    global.$exe.loadScript('http://example.com/theme.css');
    global.$exe.loadScript('http://example.com/theme.js');

    const tags = appendSpy.mock.calls.map((call) => call[0]?.tagName);
    expect(tags).toContain('LINK');
    expect(tags).toContain('SCRIPT');
  });

  it('setIframesProperties marks external iframes and inserts source links', () => {
    document.body.innerHTML = '<iframe src=\"http://example.com\"></iframe>';

    global.$exe.setIframesProperties();

    const iframe = document.querySelector('iframe');
    expect(iframe.classList.contains('external-iframe')).toBe(true);
    const link = document.querySelector('span.external-iframe-src a');
    expect(link.getAttribute('href')).toBe('http://example.com');
  });

  it('isIE detects MSIE user agents', () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0)',
      configurable: true,
    });
    expect(global.$exe.isIE()).toBe(8);

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    expect(global.$exe.isIE()).toBe(false);

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });
});
