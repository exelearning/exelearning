import { beforeEach, describe, expect, it } from 'vitest';
import { createDomJQuery } from '../../test-helpers/createDomJQuery.js';

global.$ = createDomJQuery();
global.jQuery = global.$;
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

  it('wraps h2 titles with spans and keeps title attribute only', () => {
    const html =
      '<h2 title="Heading" data-extra="value" xmlns="http://www.w3.org/1999/xhtml">Text</h2>';
    document.body.className = 'exe-epub3';
    const normalized = exeFX.rftTitles(html);
    expect(normalized).toContain('<span title="Heading"');
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
    expect(content?.style.display).toBe('none');
  });
});
