import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDomJQuery } from '../../test-helpers/createDomJQuery.js';

global.$ = createDomJQuery();

global.$exe_i18n = {
  exeGames: {
    hangManGame: 'Hangman',
    yes: 'Yes',
    no: 'No',
    accept: 'Accept',
    az: 'abcdef',
    play: 'Play',
    playAgain: 'Play again',
    selectedLetters: 'Letters',
    stat: 'Status',
    word: 'Word',
    results: 'Results',
    total: 'Total',
    right: 'Right',
    wrong: 'Wrong',
    words: 'Words',
    otherWord: 'Other word',
    gameOver: 'Game over',
    confirmReload: 'Reload',
    clickOnPlay: 'Click to play',
    clickOnOtherWord: 'Click on other word',
    rightAnswer: 'Correct answer',
  },
};

global.$exe = {
  isIE: vi.fn(() => false),
};

const { $exeGames, hangMan } = require('./exe_games.js');

describe('exe_games (app/common)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.__runHook = undefined;
  });

  it('adds a confirmation message and removes it on hide', () => {
    document.body.innerHTML = '<div id="test-game" style="height:160px"></div>';
    $exeGames.message.show('test-game', 'Confirm action', 'hangMan.doClean(0)');
    const message = document.getElementById('test-game-message');
    expect(message).toBeTruthy();
    expect(message.querySelector('p').innerHTML).toContain('Confirm action');
    $exeGames.message.hide('test-game');
    expect(document.getElementById('test-game-message')).toBeNull();
  });

  it('renders accept link when callback is absent', () => {
    document.body.innerHTML = '<div id="test-game"></div>';
    $exeGames.message.show('test-game', 'Simple alert');
    const html = document.getElementById('test-game-message').innerHTML;
    expect(html).toContain('Accept');
    expect(html).not.toContain('Yes');
  });

  it('runs provided action and hides the message', () => {
    const hideSpy = vi.spyOn($exeGames.message, 'hide');
    $exeGames.run("window.__runHook = 'done';", 'test-game');
    expect(window.__runHook).toBe('done');
    expect(hideSpy).toHaveBeenCalledWith('test-game');
    hideSpy.mockRestore();
  });

  it('initializes hangman with decoded words', () => {
    document.body.innerHTML = `
      <div id="question-0"><ol><li>clue</li></ol></div>
      <div id="total-0-counter"></div>
      <input id="start-0" />
      <input id="clean-0" />
    `;
    hangMan.init(0, ['SGVsbG8='], false);
    expect(window['hangMan0'].words[0]).toBe('H e l l o');
    expect(document.getElementById('total-0-counter').textContent).toBe('1');
  });
});
