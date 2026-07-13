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

describe('exe_effects scoped initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('initializes only FX elements inside the provided container', () => {
    document.body.innerHTML = `
      <section id="outside">
        <div class="exe-fx exe-tabs">
          <h2>Outside one</h2><p>Outside first</p>
          <h2>Outside two</h2><p>Outside second</p>
        </div>
      </section>
      <section id="inside">
        <div class="exe-fx exe-tabs">
          <h2>Inside one</h2><p>Inside first</p>
          <h2>Inside two</h2><p>Inside second</p>
        </div>
      </section>
    `;

    const outsideEffect = document.querySelector('#outside .exe-fx');
    const insideEffect = document.querySelector('#inside .exe-fx');

    exeFX.init(document.getElementById('inside'));

    expect(outsideEffect.querySelector('.fx-tabs')).toBeNull();
    expect(insideEffect.querySelector('.fx-tabs')).not.toBeNull();
    expect(insideEffect.id).toBe('exe-tabs-1');
  });

  it('initializes a detached FX element when it is the provided root', () => {
    const effect = document.createElement('div');
    effect.className = 'exe-fx exe-tabs';
    effect.innerHTML = '<h2>One</h2><p>First</p><h2>Two</h2><p>Second</p>';

    exeFX.init(effect);

    expect(effect.querySelector('.fx-tabs')).not.toBeNull();
    expect(effect.id).toBe('exe-tabs-0');
  });
});
