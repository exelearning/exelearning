import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

global.$exe_i18n = {
  exeGames: {
    hangManGame: 'Hangman',
    yes: 'Yes',
    no: 'No',
    accept: 'Accept',
    az: 'abcdefghijklmnopqrstuvwxyz',
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

global.eXeLearning = undefined;

const { $exeGames, hangMan } = require('./exe_games.js');

describe('exe_games (app/common)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Remove any dynamically added style tags from previous tests
    document.querySelectorAll('head style').forEach(s => s.remove());
    window.__runHook = undefined;
    // Clean up any hangman instances
    for (const key of Object.keys(window)) {
      if (key.startsWith('hangMan') && typeof window[key] === 'object') {
        delete window[key];
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('$exeGames.message', () => {
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

    it('renders yes/no links when callback is provided', () => {
      document.body.innerHTML = '<div id="test-game"></div>';
      $exeGames.message.show('test-game', 'Confirm?', 'someAction()');
      const html = document.getElementById('test-game-message').innerHTML;
      expect(html).toContain('Yes');
      expect(html).toContain('No');
      expect(html).not.toContain('Accept');
    });

    it('centers the message vertically', () => {
      document.body.innerHTML = '<div id="test-game" style="height:200px"></div>';
      $exeGames.message.show('test-game', 'Centered message');
      const msgP = document.querySelector('#test-game-message p');
      expect(msgP.style.marginTop).toBeDefined();
    });
  });

  describe('$exeGames.run', () => {
    it('runs provided action and hides the message', () => {
      const hideSpy = vi.spyOn($exeGames.message, 'hide');
      $exeGames.run("window.__runHook = 'done';", 'test-game');
      expect(window.__runHook).toBe('done');
      expect(hideSpy).toHaveBeenCalledWith('test-game');
    });
  });

  describe('$exeGames.init', () => {
    it('returns false when no game divs found', () => {
      document.body.innerHTML = '<div class="no-game"></div>';
      const result = $exeGames.init();
      expect(result).toBe(false);
    });

    it('initializes hangman games when found', () => {
      const hangmanSpy = vi.spyOn($exeGames, 'hangman').mockImplementation(() => {});
      document.body.innerHTML = '<div class="exe-game exe-hangman"></div>';
      $exeGames.init();
      expect(hangmanSpy).toHaveBeenCalled();
    });

    it('adds CSS when eXeLearning is defined and has hangman', () => {
      window.eXeLearning = {};
      const hangmanSpy = vi.spyOn($exeGames, 'hangman').mockImplementation(() => {});
      document.body.innerHTML = '<div class="exe-game exe-hangman"></div>';
      $exeGames.init();
      expect(hangmanSpy).toHaveBeenCalled();
      const styleTag = document.querySelector('style');
      expect(styleTag).toBeTruthy();
      expect(styleTag.textContent).toContain('exe-hangman:before');
      delete window.eXeLearning;
    });

    it('does not add CSS when no hangman games', () => {
      window.eXeLearning = {};
      document.body.innerHTML = '<div class="exe-game other-game"></div>';
      $exeGames.init();
      const styleTag = document.querySelector('style');
      expect(styleTag).toBeNull();
      delete window.eXeLearning;
    });
  });

  describe('$exeGames.hangman', () => {
    beforeEach(() => {
      vi.spyOn(hangMan, 'create').mockImplementation(() => {});
    });

    it('sets id on the element', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman">
          <dl><dt>Clue 1</dt><dd>SGVsbG8=</dd></dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 0);
      expect(elem.id).toBe('exe-hangman-0');
    });

    it('uses default letters from i18n', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman">
          <dl><dt>Clue</dt><dd>dGVzdA==</dd></dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 0);
      expect(hangMan.create).toHaveBeenCalledWith(
        0,
        'abcdefghijklmnopqrstuvwxyz',
        expect.any(Array),
        expect.any(Array),
        false,
        false
      );
    });

    it('uses custom letters when provided', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman">
          <span class="exe-hangman-letters">xyz</span>
          <dl><dt>Clue</dt><dd>dGVzdA==</dd></dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 1);
      expect(hangMan.create).toHaveBeenCalledWith(
        1,
        'xyz',
        expect.any(Array),
        expect.any(Array),
        false,
        false
      );
    });

    it('detects add-capital-letters class', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman add-capital-letters">
          <dl><dt>Clue</dt><dd>dGVzdA==</dd></dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 2);
      expect(hangMan.create).toHaveBeenCalledWith(
        2,
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        true,
        false
      );
    });

    it('detects case-sensitive class', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman case-sensitive">
          <dl><dt>Clue</dt><dd>dGVzdA==</dd></dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 3);
      expect(hangMan.create).toHaveBeenCalledWith(
        3,
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        false,
        true
      );
    });

    it('extracts questions from DT elements', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman">
          <dl>
            <dt>Question 1</dt><dd>SGVsbG8=</dd>
            <dt>Question 2</dt><dd>V29ybGQ=</dd>
          </dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 0);
      expect(hangMan.create).toHaveBeenCalledWith(
        0,
        expect.any(String),
        ['Question 1', 'Question 2'],
        expect.any(Array),
        false,
        false
      );
    });

    it('extracts answers from DD elements', () => {
      document.body.innerHTML = `
        <div class="exe-game exe-hangman">
          <dl>
            <dt>Q1</dt><dd>SGVsbG8=</dd>
            <dt>Q2</dt><dd>V29ybGQ=</dd>
          </dl>
        </div>
      `;
      const elem = document.querySelector('.exe-hangman');
      $exeGames.hangman(elem, 0);
      expect(hangMan.create).toHaveBeenCalledWith(
        0,
        expect.any(String),
        expect.any(Array),
        ['SGVsbG8=', 'V29ybGQ='],
        false,
        false
      );
    });
  });

  describe('hangMan.decode64', () => {
    it('decodes base64 string correctly', () => {
      expect(hangMan.decode64('SGVsbG8=')).toBe('Hello');
    });

    it('decodes empty string', () => {
      expect(hangMan.decode64('')).toBe('');
    });

    it('handles padding correctly', () => {
      expect(hangMan.decode64('SGk=')).toBe('Hi');
      expect(hangMan.decode64('QUJD')).toBe('ABC');
    });

    it('ignores invalid characters', () => {
      expect(hangMan.decode64('SGVs!!!bG8=')).toBe('Hello');
    });
  });

  describe('hangMan._utf8_decode', () => {
    it('decodes simple ASCII', () => {
      expect(hangMan._utf8_decode('Hello')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(hangMan._utf8_decode('')).toBe('');
    });

    it('decodes 2-byte UTF-8 characters', () => {
      // "é" UTF-8: [0xC3, 0xA9] encoded as base64 "w6k="
      const result = hangMan.decode64('w6k=');
      expect(result).toBe('é');
    });

    it('decodes 3-byte UTF-8 characters', () => {
      // "€" UTF-8: [0xE2, 0x82, 0xAC] encoded as base64 "4oKs"
      const result = hangMan.decode64('4oKs');
      expect(result).toBe('€');
    });

    it('decodes mixed ASCII and UTF-8', () => {
      // "Café" has ASCII and 2-byte UTF-8
      const result = hangMan.decode64('Q2Fmw6k=');
      expect(result).toBe('Café');
    });
  });

  describe('hangMan.init', () => {
    it('returns false for empty words array', () => {
      const result = hangMan.init(0, [], false);
      expect(result).toBe(false);
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

    it('stores isCaseSensitive flag', () => {
      document.body.innerHTML = `
        <div id="question-1"><ol><li>clue</li></ol></div>
        <div id="total-1-counter"></div>
      `;
      hangMan.init(1, ['dGVzdA=='], true);
      expect(window['hangMan1'].isCaseSensitive).toBe(true);
    });

    it('stores isCaseSensitive as false', () => {
      document.body.innerHTML = `
        <div id="question-2"><ol><li>clue</li></ol></div>
        <div id="total-2-counter"></div>
      `;
      hangMan.init(2, ['dGVzdA=='], false);
      expect(window['hangMan2'].isCaseSensitive).toBe(false);
    });

    it('initializes parts to 0', () => {
      document.body.innerHTML = `
        <div id="question-3"><ol><li>clue</li></ol></div>
        <div id="total-3-counter"></div>
      `;
      hangMan.init(3, ['dGVzdA=='], false);
      expect(window['hangMan3'].parts).toBe(0);
    });
  });

  describe('hangMan.create', () => {
    it('creates game HTML structure', () => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue 1'], ['SGVsbG8='], false, false);

      const wrapper = document.getElementById('exe-hangman-0');
      expect(wrapper.querySelector('.exe-game-js-content')).toBeTruthy();
      expect(wrapper.querySelector('#hangMan0')).toBeTruthy();
      expect(wrapper.querySelector('#start-0')).toBeTruthy();
      expect(wrapper.querySelector('#clean-0')).toBeTruthy();
    });

    it('uses default letters when empty', () => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, '', ['Clue'], ['dGVzdA=='], false, false);

      const abc = document.getElementById('abc-0');
      expect(abc.querySelectorAll('li').length).toBe(26); // a-z
    });

    it('adds capital letters when addCapitalLetters is true', () => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], true, false);

      const abc = document.getElementById('abc-0');
      const letters = abc.querySelectorAll('li');
      // Should have lowercase + uppercase = 6 letters
      expect(letters.length).toBe(6);
      // Check for capital letters class
      expect(abc.querySelector('.first-capital-letter')).toBeTruthy();
    });

    it('adds ie-lt-9 class for old IE', () => {
      global.$exe.isIE.mockReturnValue(8);
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);

      expect(document.getElementById('exe-hangman-0').classList.contains('ie-lt-9')).toBe(true);
      global.$exe.isIE.mockReturnValue(false);
    });

    it('does not add ie-lt-9 class for IE 9+', () => {
      global.$exe.isIE.mockReturnValue(9);
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);

      expect(document.getElementById('exe-hangman-0').classList.contains('ie-lt-9')).toBe(false);
      global.$exe.isIE.mockReturnValue(false);
    });

    it('renders all tips in the wording section', () => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Tip 1', 'Tip 2', 'Tip 3'], ['dGVzdA==', 'dGVzdA==', 'dGVzdA=='], false, false);

      const tips = document.querySelectorAll('#question-0 li');
      expect(tips.length).toBe(3);
      expect(tips[0].textContent).toBe('Tip 1');
      expect(tips[1].textContent).toBe('Tip 2');
      expect(tips[2].textContent).toBe('Tip 3');
    });
  });

  describe('hangMan.start', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abcde', ['Guess the word'], ['SGk='], false, false);
    });

    it('shows game elements', () => {
      hangMan.start(0);
      expect(document.getElementById('hangManResults0').style.display).not.toBe('none');
      expect(document.getElementById('hangManWrapper0').style.display).not.toBe('none');
    });

    it('sets isPlaying to true', () => {
      hangMan.start(0);
      expect(window['hangMan0'].isPlaying).toBe(true);
    });

    it('resets parts to 0', () => {
      window['hangMan0'].parts = 5;
      hangMan.start(0);
      expect(window['hangMan0'].parts).toBe(0);
    });

    it('displays underscores for word', () => {
      hangMan.start(0);
      const displayWord = document.getElementById('displayWord-0');
      expect(displayWord.value).toContain('_');
    });

    it('clears displayed letters', () => {
      document.getElementById('displayLetters-0').value = 'abc';
      hangMan.start(0);
      expect(document.getElementById('displayLetters-0').value).toBe('');
    });
  });

  describe('hangMan.getWord', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue 1', 'Clue 2'], ['SGk=', 'SGVsbG8='], false, false);
    });

    it('updates start button text after first word', () => {
      hangMan.start(0);
      expect(document.getElementById('start-0').value).toBe($exe_i18n.exeGames.otherWord);
    });

    it('shows clean button after first word', () => {
      hangMan.start(0);
      expect(document.getElementById('clean-0').style.display).toBe('inline');
    });

    it('increments lost counter if previous word was unfinished', () => {
      hangMan.start(0);
      window['hangMan0'].isWordFinished = false;
      hangMan.getWord(0);
      expect(document.getElementById('lost-0').value).toBe('1');
    });

    it('returns false when all words are played', () => {
      hangMan.start(0);
      hangMan.getWord(0); // Second word
      const showSpy = vi.spyOn($exeGames.message, 'show');
      const result = hangMan.getWord(0); // Third attempt - no more words
      expect(result).toBe(false);
      expect(showSpy).toHaveBeenCalledWith('exe-hangman-0', $exe_i18n.exeGames.gameOver);
    });

    it('hides start button on last word', () => {
      hangMan.start(0);
      hangMan.getWord(0); // Move to second (last) word
      expect(document.getElementById('start-0').style.display).toBe('none');
    });
  });

  describe('hangMan.showQuestion', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue 1', 'Clue 2'], ['SGk=', 'SGVsbG8='], false, false);
    });

    it('highlights current question', () => {
      hangMan.showQuestion(0, 1);
      const lis = document.querySelectorAll('#question-0 li');
      expect(lis[1].classList.contains('current')).toBe(true);
      expect(lis[0].classList.contains('current')).toBe(false);
    });

    it('updates current word number', () => {
      hangMan.showQuestion(0, 1);
      expect(document.getElementById('currentWord-0').textContent).toBe('2');
    });
  });

  describe('hangMan.paintMan', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);
    });

    it('draws nothing for 0 parts', () => {
      hangMan.paintMan(0, 0);
      expect(document.getElementById('displayMan-0').value).toBe('');
    });

    it('draws partial man for some parts', () => {
      hangMan.paintMan(3, 0);
      const drawing = document.getElementById('displayMan-0').value;
      expect(drawing).toContain('___');
      expect(drawing).toContain('|');
      expect(drawing).toContain('O');
    });

    it('draws full man at 9 parts', () => {
      hangMan.paintMan(9, 0);
      const drawing = document.getElementById('displayMan-0').value;
      expect(drawing).toContain('___');
    });

    it('does not draw for 10+ parts', () => {
      hangMan.paintMan(10, 0);
      expect(document.getElementById('displayMan-0').value).toBe('');
    });
  });

  describe('hangMan.writeLetter', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['SGVsbG8='], false, false); // "Hello"
      hangMan.start(0);
    });

    it('returns true when letter is found', () => {
      const result = hangMan.writeLetter('H', 0);
      expect(result).toBe(true);
    });

    it('returns false when letter is not found', () => {
      const result = hangMan.writeLetter('z', 0);
      expect(result).toBe(false);
    });

    it('reveals letter in display', () => {
      hangMan.writeLetter('l', 0);
      const display = document.getElementById('displayWord-0').value;
      expect(display).toContain('l');
    });

    it('is case insensitive when configured', () => {
      window['hangMan0'].isCaseSensitive = false;
      const result = hangMan.writeLetter('h', 0);
      expect(result).toBe(true);
    });

    it('is case sensitive when configured', () => {
      window['hangMan0'].isCaseSensitive = true;
      const result = hangMan.writeLetter('h', 0); // lowercase h won't match uppercase H
      expect(result).toBe(false);
    });
  });

  describe('hangMan.message', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);
    });

    it('sets feedback message content', () => {
      hangMan.message(0, 'success', 'Well done!');
      const feedback = document.getElementById('displayWord-0-feedback');
      expect(feedback.innerHTML).toBe('Well done!');
      expect(feedback.className).toBe('success');
    });

    it('clears message when empty', () => {
      hangMan.message(0, '', '');
      const feedback = document.getElementById('displayWord-0-feedback');
      expect(feedback.innerHTML).toBe('');
      expect(feedback.className).toBe('');
    });
  });

  describe('hangMan.addLetter', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);
    });

    it('adds letter to displayed letters', () => {
      hangMan.addLetter('a', 0);
      expect(document.getElementById('displayLetters-0').value).toBe('a ');
    });

    it('accumulates multiple letters', () => {
      hangMan.addLetter('a', 0);
      hangMan.addLetter('b', 0);
      expect(document.getElementById('displayLetters-0').value).toBe('a b ');
    });
  });

  describe('hangMan.checkWord', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['SGk='], false, false); // "Hi"
      hangMan.start(0);
    });

    it('returns false when word has underscores', () => {
      expect(hangMan.checkWord(0)).toBe(false);
    });

    it('returns true when word is complete', () => {
      hangMan.writeLetter('H', 0);
      hangMan.writeLetter('i', 0);
      expect(hangMan.checkWord(0)).toBe(true);
    });
  });

  describe('hangMan.updateResults', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);
    });

    it('updates won counter display', () => {
      document.getElementById('won-0').value = '3';
      hangMan.updateResults(0);
      expect(document.getElementById('won-0-counter').innerHTML).toBe('3');
    });

    it('updates lost counter display', () => {
      document.getElementById('lost-0').value = '2';
      hangMan.updateResults(0);
      expect(document.getElementById('lost-0-counter').innerHTML).toBe('2');
    });
  });

  describe('hangMan.finish', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['SGk='], false, false);
      hangMan.start(0);
    });

    it('sets isPlaying to false', () => {
      hangMan.finish(true, 0);
      expect(window['hangMan0'].isPlaying).toBe(false);
    });

    it('increments won counter on success', () => {
      hangMan.finish(true, 0);
      expect(document.getElementById('won-0').value).toBe('1');
    });

    it('increments lost counter on failure', () => {
      hangMan.finish(false, 0);
      expect(document.getElementById('lost-0').value).toBe('1');
    });

    it('displays success message on win', () => {
      hangMan.finish(true, 0);
      const feedback = document.getElementById('displayWord-0-feedback');
      expect(feedback.className).toBe('success');
      expect(feedback.innerHTML).toContain($exe_i18n.exeGames.right);
    });

    it('displays error message on loss', () => {
      hangMan.finish(false, 0);
      const feedback = document.getElementById('displayWord-0-feedback');
      expect(feedback.className).toBe('error');
      expect(feedback.innerHTML).toContain($exe_i18n.exeGames.wrong);
    });

    it('adds word to won words list', () => {
      hangMan.finish(true, 0);
      const wonWords = document.getElementById('won-0-words');
      expect(wonWords.innerHTML).toContain('Hi');
    });

    it('adds word to lost words list', () => {
      hangMan.finish(false, 0);
      const lostWords = document.getElementById('lost-0-words');
      expect(lostWords.innerHTML).toContain('Hi');
    });

    it('appends to existing won words list', () => {
      document.getElementById('won-0-words').innerHTML = 'Test';
      hangMan.finish(true, 0);
      const wonWords = document.getElementById('won-0-words');
      expect(wonWords.innerHTML).toContain('<br');
      expect(wonWords.innerHTML).toContain('Hi');
    });

    it('appends to existing lost words list', () => {
      document.getElementById('lost-0-words').innerHTML = 'Test';
      hangMan.finish(false, 0);
      const lostWords = document.getElementById('lost-0-words');
      expect(lostWords.innerHTML).toContain('<br');
    });

    it('sets isWordFinished to true', () => {
      hangMan.finish(true, 0);
      expect(window['hangMan0'].isWordFinished).toBe(true);
    });
  });

  describe('hangMan.clean', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue'], ['dGVzdA=='], false, false);
    });

    it('shows confirmation message', () => {
      const showSpy = vi.spyOn($exeGames.message, 'show');
      hangMan.clean(0);
      expect(showSpy).toHaveBeenCalledWith(
        'exe-hangman-0',
        $exe_i18n.exeGames.confirmReload,
        'hangMan.doClean(0)'
      );
    });
  });

  describe('hangMan.doClean', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abc', ['Clue 1', 'Clue 2'], ['SGk=', 'dGVzdA=='], false, false);
      hangMan.start(0);
    });

    it('resets start button text and shows it', () => {
      hangMan.doClean(0);
      const startBtn = document.getElementById('start-0');
      expect(startBtn.value).toBe($exe_i18n.exeGames.play);
      expect(startBtn.style.display).toBe('inline');
    });

    it('hides game wrapper and results', () => {
      hangMan.doClean(0);
      expect(document.getElementById('hangManResults0').style.display).toBe('none');
      expect(document.getElementById('hangManWrapper0').style.display).toBe('none');
    });

    it('removes current class from questions', () => {
      hangMan.showQuestion(0, 0);
      hangMan.doClean(0);
      const currentLis = document.querySelectorAll('#question-0 li.current');
      expect(currentLis.length).toBe(0);
    });

    it('hides clean button', () => {
      hangMan.doClean(0);
      expect(document.getElementById('clean-0').style.display).toBe('none');
    });

    it('resets game state', () => {
      hangMan.doClean(0);
      expect(window['hangMan0'].playedWords).toBe(0);
      expect(window['hangMan0'].isPlaying).toBe(false);
      expect(window['hangMan0'].isWordFinished).toBeNull();
    });

    it('clears text fields', () => {
      hangMan.doClean(0);
      expect(document.getElementById('displayLetters-0').value).toBe('');
      expect(document.getElementById('displayMan-0').value).toBe('');
    });

    it('resets counters', () => {
      document.getElementById('won-0').value = '3';
      document.getElementById('lost-0').value = '2';
      hangMan.doClean(0);
      expect(document.getElementById('won-0').value).toBe('0');
      expect(document.getElementById('lost-0').value).toBe('0');
      expect(document.getElementById('won-0-counter').innerHTML).toBe('0 ');
      expect(document.getElementById('lost-0-counter').innerHTML).toBe('0 ');
    });

    it('resets words lists', () => {
      document.getElementById('won-0-words').innerHTML = 'Word1';
      document.getElementById('lost-0-words').innerHTML = 'Word2';
      hangMan.doClean(0);
      expect(document.getElementById('won-0-words').innerHTML).toBe('-');
      expect(document.getElementById('lost-0-words').innerHTML).toBe('-');
    });

    it('resets total counter', () => {
      hangMan.doClean(0);
      expect(document.getElementById('total-0-counter').innerHTML).toBe('2');
    });

    it('clears feedback message', () => {
      hangMan.message(0, 'success', 'Test');
      hangMan.doClean(0);
      const feedback = document.getElementById('displayWord-0-feedback');
      expect(feedback.innerHTML).toBe('');
    });
  });

  describe('hangMan.play', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="exe-hangman-0"></div>';
      hangMan.create(0, 'abcdefghijklmnop', ['Clue'], ['SGk='], false, false); // "Hi"
    });

    it('shows click to play message when not started', () => {
      const showSpy = vi.spyOn($exeGames.message, 'show');
      const letterLink = document.querySelector('#abc-0 a');
      hangMan.play(letterLink, 0);
      expect(showSpy).toHaveBeenCalledWith('exe-hangman-0', $exe_i18n.exeGames.clickOnPlay);
    });

    it('shows game over message when all words played', () => {
      hangMan.start(0);
      window['hangMan0'].isPlaying = false;
      window['hangMan0'].playedWords = 1; // Only 1 word in game, so this means game over

      const showSpy = vi.spyOn($exeGames.message, 'show');
      const letterLink = document.querySelector('#abc-0 a');
      hangMan.play(letterLink, 0);
      expect(showSpy).toHaveBeenCalledWith('exe-hangman-0', $exe_i18n.exeGames.gameOver);
    });

    it('shows click other word message when word finished but more words remain', () => {
      // Need a game with multiple words for this test
      document.body.innerHTML = '<div id="exe-hangman-1"></div>';
      hangMan.create(1, 'abcdefghijklmnop', ['Clue 1', 'Clue 2'], ['SGk=', 'SGVsbG8='], false, false);
      hangMan.start(1);
      window['hangMan1'].isPlaying = false;
      window['hangMan1'].playedWords = 1; // First word done, but second remains

      const showSpy = vi.spyOn($exeGames.message, 'show');
      const letterLink = document.querySelector('#abc-1 a');
      hangMan.play(letterLink, 1);
      expect(showSpy).toHaveBeenCalledWith('exe-hangman-1', $exe_i18n.exeGames.clickOnOtherWord);
    });

    it('adds letter and updates display when playing', () => {
      hangMan.start(0);
      const letterLinks = document.querySelectorAll('#abc-0 a');
      // Find the 'h' link (8th letter)
      const hLink = letterLinks[7];
      hangMan.play(hLink, 0);

      expect(document.getElementById('displayLetters-0').value).toContain('h');
    });

    it('increments parts on wrong guess', () => {
      hangMan.start(0);
      const initialParts = window['hangMan0'].parts;
      const letterLinks = document.querySelectorAll('#abc-0 a');
      // Find 'a' link (first letter, not in "Hi")
      hangMan.play(letterLinks[0], 0);

      expect(window['hangMan0'].parts).toBe(initialParts + 1);
    });

    it('calls finish when parts reach 9', () => {
      hangMan.start(0);
      window['hangMan0'].parts = 8;

      const finishSpy = vi.spyOn(hangMan, 'finish');
      const letterLinks = document.querySelectorAll('#abc-0 a');
      hangMan.play(letterLinks[0], 0); // Wrong letter

      expect(finishSpy).toHaveBeenCalledWith(false, 0);
    });

    it('calls finish when word is complete', () => {
      hangMan.start(0);

      const finishSpy = vi.spyOn(hangMan, 'finish');
      const letterLinks = document.querySelectorAll('#abc-0 a');

      // Find and click 'H' (8th letter)
      hangMan.play(letterLinks[7], 0);
      // Find and click 'i' (9th letter)
      hangMan.play(letterLinks[8], 0);

      expect(finishSpy).toHaveBeenCalledWith(true, 0);
    });
  });

  describe('hangMan.man array', () => {
    it('has 9 parts for the hangman drawing', () => {
      expect(hangMan.man.length).toBe(9);
    });

    it('contains expected drawing elements', () => {
      expect(hangMan.man).toContain('   O\n');
    });
  });
});
