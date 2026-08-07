import { beforeEach, describe, expect, it } from 'vitest';

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
  epubDisabled: 'This activity does not work in ePub.',
  print: 'Print',
};

require('./exe_effects.js');
const exeFX = global.$exeFX;

const TABS_MARKUP = '<h2>One</h2><p>First</p><h2>Two</h2><p>Second</p>';

describe('exe_effects initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    exeFX.counter = 0;
  });

  it('initializes only FX elements inside the provided container', () => {
    document.body.innerHTML = `
      <section id="outside"><div class="exe-fx exe-tabs">${TABS_MARKUP}</div></section>
      <section id="inside"><div class="exe-fx exe-tabs">${TABS_MARKUP}</div></section>
    `;

    const outsideEffect = document.querySelector('#outside .exe-fx');
    const insideEffect = document.querySelector('#inside .exe-fx');

    exeFX.init(document.getElementById('inside'));

    expect(outsideEffect.querySelector('.fx-tabs')).toBeNull();
    expect(insideEffect.querySelector('.fx-tabs')).not.toBeNull();
  });

  it('initializes a detached FX element when it is the provided root', () => {
    const effect = document.createElement('div');
    effect.className = 'exe-fx exe-tabs';
    effect.innerHTML = TABS_MARKUP;

    exeFX.init(effect);

    expect(effect.querySelector('.fx-tabs')).not.toBeNull();
    expect(effect.id).toBe('exe-tabs-0');
  });

  it('does not reuse ids when an effect is injected before an initialized one', () => {
    // The page-wide init runs first, while the JSON iDevice placeholder is still
    // empty. When that iDevice renders its content afterwards, the new effect
    // precedes the already initialized one in document order: deriving the id from
    // that position would duplicate it. See #2170.
    document.body.innerHTML = `
      <div id="idevice"></div>
      <div class="exe-fx exe-tabs">${TABS_MARKUP}</div>
    `;

    exeFX.init();
    const pageEffect = document.querySelector('body > .exe-fx');

    const ideviceNode = document.getElementById('idevice');
    ideviceNode.innerHTML = `<div class="exe-fx exe-tabs">${TABS_MARKUP}</div>`;
    exeFX.init(ideviceNode);
    const ideviceEffect = ideviceNode.querySelector('.exe-fx');

    expect(pageEffect.id).toBe('exe-tabs-0');
    expect(ideviceEffect.id).toBe('exe-tabs-1');
    expect(document.querySelectorAll('#exe-tabs-0').length).toBe(1);

    // The generated panel ids must stay unique too: the tab links target them.
    const panelIds = [...document.querySelectorAll('.fx-tab-content')].map((panel) => panel.id);
    expect(new Set(panelIds).size).toBe(panelIds.length);
  });

  it('leaves an already initialized effect untouched on a later pass', () => {
    document.body.innerHTML = `<div class="exe-fx exe-tabs">${TABS_MARKUP}</div>`;

    exeFX.init();
    const effect = document.querySelector('.exe-fx');
    const initializedHtml = effect.innerHTML;

    exeFX.init();

    expect(effect.id).toBe('exe-tabs-0');
    expect(effect.innerHTML).toBe(initializedHtml);
    expect(effect.querySelectorAll('.fx-tabs').length).toBe(1);
  });
});
