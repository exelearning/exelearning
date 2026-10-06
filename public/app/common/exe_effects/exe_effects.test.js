import { beforeEach, describe, expect, it, vi } from 'vitest';
global.window.eXeLearning = undefined;

global.$exeFX_i18n = {
  previous: 'Previous',
  next: 'Next',
  show: 'Show',
  hide: 'Hide',
  showFeedback: 'Show Feedback',
  hideFeedback: 'Hide Feedback',
  correct: 'Correct',
  incorrect: 'Incorrect',
  menu: 'Menu',
  download: 'Download',
  yourScoreIs: 'Your score is ',
  dataError: 'Error recovering data',
  epubJSerror: 'This might not work in this ePub reader.',
  solution: 'Solution',
  epubDisabled: 'This activity does not work in this ePub.',
  print: 'Print',
};

require('./exe_effects.js');
const exeFX = global.$exeFX;

describe('exe_effects (app/common)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('converts hex colors to rgb(a) strings', () => {
    expect(exeFX.hex2rgb('#ff0000')).toBe('rgb(255,0,0)');
    expect(exeFX.hex2rgb('#000000', 0.5)).toBe('rgba(0,0,0,0.5)');
  });

  it('removes xmlns attributes when running inside EPUB', () => {
    document.body.className = 'exe-epub3';
    const input = '<h2 xmlns="http://www.w3.org/1999/xhtml">Title</h2>';
    expect(exeFX.removeXMLNS(input)).toBe('<h2>Title</h2>');
  });

  it('keeps xmlns attributes when not in EPUB', () => {
    const input = '<h2 xmlns="http://www.w3.org/1999/xhtml">Title</h2>';
    expect(exeFX.removeXMLNS(input)).toBe(input);
  });

  it('wraps h2 titles with spans and keeps title attribute only', () => {
    const html =
      '<h2 title="Heading" data-extra="value" xmlns="http://www.w3.org/1999/xhtml">Text</h2>';
    document.body.className = 'exe-epub3';
    const normalized = exeFX.rftTitles(html);
    expect(normalized).toContain('<span title="Heading"');
  });

  it('returns original html when no h2 title markers are present', () => {
    const html = '<p>Just text</p>';
    expect(exeFX.rftTitles(html)).toBe(html);
  });

  it('resets malformed blocks to default styling', () => {
    const container = document.createElement('div');
    container.className = 'fx-broken';
    document.body.appendChild(container);
    exeFX.noFX($(container));
    expect(container.className).toBe('');
    expect(container.style.padding).toBe('1em');
  });

  it('closes accordion blocks and hides content', () => {
    document.body.innerHTML = `
      <div id="accordion">
        <div class="fx-accordion-title active"></div>
        <div class="fx-accordion-content open"></div>
      </div>
    `;
    exeFX.accordion.closeBlock('accordion');
    expect(
      document.querySelector('.fx-accordion-title')?.classList.contains('active')
    ).toBe(false);
    const content = document.querySelector('.fx-accordion-content');
    expect(content?.classList.contains('open')).toBe(false);
  });

  it('detects legacy IE versions', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'msie 8',
      configurable: true,
    });
    expect(exeFX.checkIE()).toBe(8);
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
    });
  });

  it('reloads h5p iframes when height is missing', () => {
    const block = document.createElement('div');
    const iframe = document.createElement('iframe');
    let src = 'https://h5p.org/embedded/123';
    let assigned = 0;
    Object.defineProperty(iframe, 'src', {
      get: () => src,
      set: (value) => {
        src = value;
        assigned += 1;
      },
      configurable: true,
    });
    block.appendChild(iframe);
    exeFX.h5pResize($(block));
    expect(assigned).toBe(1);
  });

  it('builds accordion structure from headings', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h2>One</h2><p>A</p><h2>Two</h2><p>B</p>';
    document.body.appendChild(container);
    exeFX.accordion.rft($(container), 0);
    expect(container.querySelector('.fx-accordion-section')).not.toBeNull();
    expect(container.querySelectorAll('.fx-accordion-title').length).toBe(2);
  });

  it('builds tabs and switches active tab', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h2>First</h2><p>A</p><h2>Second</h2><p>B</p>';
    document.body.appendChild(container);
    exeFX.tabs.rft($(container), 1);
    const gID = 'exe-tabs-1';
    expect(container.id).toBe(gID);
    expect(container.querySelectorAll('.fx-tab-content').length).toBe(2);

    exeFX.tabs.show(gID, 'exe-tab-1-1');
    expect(
      container.querySelector('#exe-tab-1-1')?.classList.contains('fx-current')
    ).toBe(true);
  });

  // Regression: #2191 — LaTeX rendering issue in FX Tabs.
  // When a tab heading contains an equation that has already been pre-rendered
  // to SVG + assistive MathML (class "exe-math-rendered", as stored by the
  // workarea and by exports), the tab navigation label must keep the rendered
  // equation. Building the label from h2.text() strips the SVG and leaves only
  // the concatenated MathML text (e.g. "sumn=110n"), which is the bug.
  const preRenderedHeading = (latex, mml, salt) =>
    `<span class="exe-math-rendered" data-latex="${latex}">` +
    '<svg role="img" aria-hidden="true"><defs>' +
    `<path id="MJX-${salt}-A" d="M0 0"></path></defs>` +
    `<g><use xlink:href="#MJX-${salt}-A"></use></g></svg>` +
    `<math xmlns="http://www.w3.org/1998/Math/MathML">${mml}</math>` +
    '</span>';

  it('keeps pre-rendered equations visible in tab labels (#2191)', () => {
    const heading = preRenderedHeading(
      '\\(sum_{n=1}^{10}n\\)',
      '<mi>s</mi><mi>u</mi><mi>m</mi><mi>n</mi><mo>=</mo><mn>1</mn><mn>10</mn><mi>n</mi>',
      1
    );
    const container = document.createElement('div');
    container.innerHTML = `<h2>${heading}</h2><p>Content A</p><h2>Plain title</h2><p>Content B</p>`;
    document.body.appendChild(container);

    exeFX.tabs.rft($(container), 7);

    const labels = container.querySelectorAll('.fx-tabs a');
    // The rendered equation must survive into the first (visible) tab label.
    expect(labels[0].querySelector('.exe-math-rendered')).not.toBeNull();
    expect(labels[0].querySelector('svg')).not.toBeNull();
    // Plain-text titles keep working unchanged.
    expect(labels[1].textContent.trim()).toBe('Plain title');
  });

  it('keeps raw LaTeX delimiters in tab labels so MathJax can render them (#2191)', () => {
    // Contexts that ship MathJax store the raw formula in the heading; the tab
    // label must keep the \(...\) delimiters so MathJax typesets the label too.
    const container = document.createElement('div');
    container.innerHTML =
      '<h2>\\(a^2+b^2\\)</h2><p>A</p><h2>Second</h2><p>B</p>';
    document.body.appendChild(container);

    exeFX.tabs.rft($(container), 2);

    const firstLabel = container.querySelector('.fx-tabs a');
    expect(firstLabel.textContent).toContain('\\(a^2+b^2\\)');
  });

  it('avoids duplicate element ids when copying a pre-rendered equation into the label (#2191)', () => {
    const heading = preRenderedHeading(
      '\\(x\\)',
      '<mi>x</mi>',
      9
    );
    const container = document.createElement('div');
    container.innerHTML = `<h2>${heading}</h2><p>A</p><h2>Plain</h2><p>B</p>`;
    document.body.appendChild(container);

    exeFX.tabs.rft($(container), 4);

    // The original id lives once (in the sr-only panel heading); the copy in
    // the navigation label was suffixed, so no id is duplicated in the DOM.
    const originalId = 'MJX-9-A';
    expect(container.querySelectorAll(`#${originalId}`).length).toBe(1);
    // The label's <use> reference points at the suffixed id, not the original.
    const label = container.querySelector('.fx-tabs a');
    const use = label.querySelector('use');
    expect(use.getAttribute('xlink:href')).toBe(`#${originalId}-exe-tabs-4-0`);
  });

  it('does not duplicate tab controls when initialization runs twice (#2191)', () => {
    const container = document.createElement('div');
    container.className = 'exe-fx exe-tabs';
    container.innerHTML =
      '<h2>First</h2><p>A</p><h2>Second</h2><p>B</p>';
    document.body.appendChild(container);

    exeFX.tabs.init(container, 0);
    exeFX.tabs.init(container, 0);

    expect(container.querySelectorAll('ul.fx-tabs').length).toBe(1);
    expect(container.querySelectorAll('ul.fx-tabs > li').length).toBe(2);
  });

  it('builds pagination and updates prev/next states', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h2>First</h2><p>A</p><h2>Second</h2><p>B</p>';
    document.body.appendChild(container);
    exeFX.paginated.rft($(container), 0);
    const gID = 'exe-paginated-0';

    exeFX.paginated.show(gID, 'exe-paginated-0-0', 0);
    expect(document.getElementById(`${gID}-prev-lnk`)?.className).toBe(
      'fx-disabled-link'
    );

    exeFX.paginated.show(gID, 'exe-paginated-0-1', 1);
    expect(document.getElementById(`${gID}-next-lnk`)?.className).toBe(
      'fx-disabled-link'
    );
  });

  it('builds carousel and updates pagination', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h2>First</h2><p>A</p><h2>Second</h2><p>B</p>';
    document.body.appendChild(container);
    exeFX.carousel.rft($(container), 0);
    const gID = 'exe-carousel-0';
    expect(container.querySelectorAll('.fx-carousel-content').length).toBe(2);

    exeFX.carousel.isWorking = false;
    exeFX.carousel.show(gID, 'exe-carousel-0-0', 0);
    expect(document.getElementById(`${gID}-prev-lnk`)?.className).toBe(
      'fx-disabled-link'
    );

    exeFX.carousel.isWorking = false;
    exeFX.carousel.show(gID, 'exe-carousel-0-1', 1);
    expect(document.getElementById(`${gID}-next-lnk`)?.className).toBe(
      'fx-disabled-link'
    );
  });

  it('builds timeline structure from headings', () => {
    global.$exe = {
      rgb2hex: vi.fn(() => '#ff0000'),
      useBlackOrWhite: vi.fn(() => '#000000'),
    };

    const container = document.createElement('div');
    container.style.color = 'rgb(255, 0, 0)';
    container.innerHTML = '<h2>Year</h2><h3>Event</h3><p>Detail</p>';
    document.body.appendChild(container);

    exeFX.timeline.rft($(container), 0);

    expect(container.classList.contains('fx-timeline-container')).toBe(true);
    expect(container.querySelector('.fx-timeline-toggler')).not.toBeNull();
    expect(container.querySelectorAll('.fx-timeline-major').length).toBe(1);
  });

  it('initializes timeline with fallback when headings are missing', () => {
    global.$exe = {
      rgb2hex: vi.fn(() => '#ff0000'),
      useBlackOrWhite: vi.fn(() => '#000000'),
    };

    const container = document.createElement('div');
    container.innerHTML = '<h2>Year</h2><p>Detail</p>';
    document.body.appendChild(container);

    exeFX.timeline.init(container, 1);

    expect(container.className).toBe('');
    expect(container.style.padding).toBe('1em');
  });
});
