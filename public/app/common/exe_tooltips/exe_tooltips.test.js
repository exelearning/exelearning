import { beforeEach, describe, expect, it, vi } from 'vitest';

const scriptPath = './exe_tooltips.js';
const loadScriptMock = vi.fn();

global.$exe = {
  options: {
    atools: {
      modeToggler: false,
      translator: false,
      i18n: {},
    },
  },
  loadScript: loadScriptMock,
};

const exeTooltips = require(scriptPath);

describe('exe_tooltips (app/common)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    loadScriptMock.mockClear();
    exeTooltips.links = window.$([]);
    exeTooltips.isAJAXAllowed = undefined;
    window.location.protocol = 'http:';
  });

  it('extracts title and text from tooltip labels', () => {
    expect(exeTooltips.getTooltipTitle('Title | Detail')).toBe('Title');
    expect(exeTooltips.getTooltipText('Title | Detail')).toBe('Detail');
  });

  it('builds friendly URLs', () => {
    expect(exeTooltips.getFriendlyURL('Hello, World!')).toBe('hello-world');
  });

  it('returns the page name for linked anchor', () => {
    document.body.innerHTML = `
      <nav id="siteNav">
        <a href="page.html">Page Title</a>
      </nav>
    `;
    expect(exeTooltips.getPageName('page.html#section')).toBe('Page Title');
  });

  it('assembles classes for tooltip skins', () => {
    const classes = exeTooltips.getClasses('plain light-tt rounded-tt shadowed-tt');
    expect(classes).toContain('qtip-light');
    expect(classes).toContain('qtip-rounded');
  });

  it('initializes when tooltips are present and loads assets', () => {
    document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="title | text"></a>';
    exeTooltips.init('/assets/');
    expect(exeTooltips.path).toBe('/assets/');
    expect(exeTooltips.links?.length).toBe(1);
    expect(loadScriptMock).toHaveBeenCalledWith('/assets/jquery.qtip.min.css');
    expect(loadScriptMock).toHaveBeenCalledWith(
      '/assets/jquery.qtip.min.js',
      '$exe.tooltips.loadImageLoader()'
    );
  });

  it('disables AJAX tooltips on single page views', () => {
    document.body.className = 'exe-single-page';
    exeTooltips.init('/');
    expect(exeTooltips.isAJAXAllowed).toBe(false);
  });
});
