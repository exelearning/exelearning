import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Mock jQuery BEFORE requiring the module
const mockElement = {
  length: 0,
  each: vi.fn(),
  hasClass: vi.fn().mockReturnValue(false),
  addClass: vi.fn().mockReturnThis(),
  removeClass: vi.fn().mockReturnThis(),
  html: vi.fn().mockReturnValue(''),
  val: vi.fn().mockReturnValue(''),
  hide: vi.fn().mockReturnThis(),
  show: vi.fn().mockReturnThis(),
  css: vi.fn().mockReturnThis(),
  append: vi.fn().mockReturnThis(),
  prepend: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  height: vi.fn().mockReturnValue(100),
  attr: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnValue(''),
};

const mockJQuery = vi.fn((selector) => {
  if (typeof selector === 'function') {
    // $(function() {...}) - document ready handler - DON'T call it automatically
    return mockElement;
  }
  return mockElement;
});
mockJQuery.ajax = vi.fn().mockReturnValue({
  then: vi.fn().mockReturnThis(),
  done: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
});

globalThis.$ = mockJQuery;

// Mock $exe_i18n
globalThis.$exe_i18n = {
  exeGames: {
    hangManGame: 'Hangman Game',
    yes: 'Yes',
    no: 'No',
    accept: 'Accept',
    az: 'abcdefghijklmnopqrstuvwxyz',
    play: 'Play',
    playAgain: 'Play Again',
    otherWord: 'Other Word',
    selectedLetters: 'Selected Letters',
    stat: 'Status',
    word: 'Word',
    results: 'Results',
    total: 'Total',
    right: 'Right',
    wrong: 'Wrong',
    words: 'Words',
    gameOver: 'Game Over',
    confirmReload: 'Confirm reload?',
    clickOnPlay: 'Click on Play',
    clickOnOtherWord: 'Click on Other Word',
    rightAnswer: 'Right answer',
  },
};

// Mock $exe
globalThis.$exe = {
  isIE: vi.fn().mockReturnValue(false),
};

// Now require the module
const { $exeGames, hangMan } = require('./exe_games.js');

// Also assign to globalThis for tests that expect them there
globalThis.$exeGames = $exeGames;
globalThis.hangMan = hangMan;

describe('exe_games.js', () => {
  let originalGetElementById;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset $ mock to return mockElement (important for test isolation)
    mockJQuery.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return mockElement;
      }
      return mockElement;
    });

    // Save original getElementById
    originalGetElementById = document.getElementById;

    // Mock eXeLearning as undefined (since script checks for it)
    if (typeof globalThis.eXeLearning !== 'undefined') {
      delete globalThis.eXeLearning;
    }
  });

  afterEach(() => {
    // Restore original getElementById
    document.getElementById = originalGetElementById;
    vi.restoreAllMocks();
  });

  describe('script structure', () => {
    it('should define $exeGames object', () => {
      expect($exeGames).toBeDefined();
      expect(typeof $exeGames).toBe('object');
    });

    it('should define hangMan object', () => {
      expect(hangMan).toBeDefined();
      expect(typeof hangMan).toBe('object');
    });

    it('should have init method on $exeGames', () => {
      expect(typeof globalThis.$exeGames.init).toBe('function');
    });

    it('should have run method on $exeGames', () => {
      expect(typeof globalThis.$exeGames.run).toBe('function');
    });

    it('should have message object with show and hide methods', () => {
      expect(typeof globalThis.$exeGames.message.show).toBe('function');
      expect(typeof globalThis.$exeGames.message.hide).toBe('function');
    });

    it('should have hangman method on $exeGames', () => {
      expect(typeof globalThis.$exeGames.hangman).toBe('function');
    });
  });

  describe('hangMan structure', () => {
    it('should have man array with 9 parts', () => {
      expect(globalThis.hangMan.man).toBeInstanceOf(Array);
      expect(globalThis.hangMan.man.length).toBe(9);
    });

    it('should have _keyStr for base64', () => {
      expect(globalThis.hangMan._keyStr).toBe(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
      );
    });

    it('should have create method', () => {
      expect(typeof globalThis.hangMan.create).toBe('function');
    });

    it('should have decode64 method', () => {
      expect(typeof globalThis.hangMan.decode64).toBe('function');
    });

    it('should have _utf8_decode method', () => {
      expect(typeof globalThis.hangMan._utf8_decode).toBe('function');
    });

    it('should have init method', () => {
      expect(typeof globalThis.hangMan.init).toBe('function');
    });

    it('should have start method', () => {
      expect(typeof globalThis.hangMan.start).toBe('function');
    });

    it('should have play method', () => {
      expect(typeof globalThis.hangMan.play).toBe('function');
    });

    it('should have finish method', () => {
      expect(typeof globalThis.hangMan.finish).toBe('function');
    });
  });

  describe('hangMan.decode64', () => {
    it('should decode simple ASCII text', () => {
      // "Hello" in base64 is "SGVsbG8="
      const result = globalThis.hangMan.decode64('SGVsbG8=');
      expect(result).toBe('Hello');
    });

    it('should decode empty string', () => {
      const result = globalThis.hangMan.decode64('');
      expect(result).toBe('');
    });

    it('should decode "world" base64', () => {
      // "world" in base64 is "d29ybGQ="
      const result = globalThis.hangMan.decode64('d29ybGQ=');
      expect(result).toBe('world');
    });

    it('should decode numbers', () => {
      // "12345" in base64 is "MTIzNDU="
      const result = globalThis.hangMan.decode64('MTIzNDU=');
      expect(result).toBe('12345');
    });

    it('should handle base64 without padding', () => {
      // "Hi" in base64 is "SGk="
      const result = globalThis.hangMan.decode64('SGk=');
      expect(result).toBe('Hi');
    });

    it('should decode longer text', () => {
      // "The quick brown fox" in base64
      const result = globalThis.hangMan.decode64('VGhlIHF1aWNrIGJyb3duIGZveA==');
      expect(result).toBe('The quick brown fox');
    });

    it('should strip invalid characters', () => {
      // Base64 with some invalid characters
      const result = globalThis.hangMan.decode64('SGV!@#sbG8=');
      expect(result).toBe('Hello');
    });

    it('should decode single character', () => {
      // "A" in base64 is "QQ=="
      const result = globalThis.hangMan.decode64('QQ==');
      expect(result).toBe('A');
    });

    it('should decode two characters', () => {
      // "AB" in base64 is "QUI="
      const result = globalThis.hangMan.decode64('QUI=');
      expect(result).toBe('AB');
    });

    it('should decode three characters', () => {
      // "ABC" in base64 is "QUJD"
      const result = globalThis.hangMan.decode64('QUJD');
      expect(result).toBe('ABC');
    });
  });

  describe('hangMan._utf8_decode', () => {
    it('should decode simple ASCII string', () => {
      const result = globalThis.hangMan._utf8_decode('Hello');
      expect(result).toBe('Hello');
    });

    it('should decode empty string', () => {
      const result = globalThis.hangMan._utf8_decode('');
      expect(result).toBe('');
    });

    it('should handle characters with code < 128', () => {
      const result = globalThis.hangMan._utf8_decode('ABC123');
      expect(result).toBe('ABC123');
    });

    it('should decode 2-byte UTF-8 characters', () => {
      // é is encoded as 0xC3 0xA9 in UTF-8
      const input = String.fromCharCode(0xc3) + String.fromCharCode(0xa9);
      const result = globalThis.hangMan._utf8_decode(input);
      expect(result).toBe('é');
    });

    it('should decode 3-byte UTF-8 characters', () => {
      // € (euro sign) is encoded as 0xE2 0x82 0xAC in UTF-8
      const input = String.fromCharCode(0xe2) + String.fromCharCode(0x82) + String.fromCharCode(0xac);
      const result = globalThis.hangMan._utf8_decode(input);
      expect(result).toBe('€');
    });

    it('should handle mixed ASCII and UTF-8', () => {
      // "café" with é as UTF-8
      const input = 'caf' + String.fromCharCode(0xc3) + String.fromCharCode(0xa9);
      const result = globalThis.hangMan._utf8_decode(input);
      expect(result).toBe('café');
    });
  });

  describe('$exeGames.init', () => {
    it('should return false if no games found', () => {
      globalThis.$.mockReturnValue({ length: 0 });
      const result = globalThis.$exeGames.init();
      expect(result).toBe(false);
    });
  });

  describe('$exeGames.message', () => {
    it('should have show method', () => {
      expect(typeof globalThis.$exeGames.message.show).toBe('function');
    });

    it('should have hide method', () => {
      expect(typeof globalThis.$exeGames.message.hide).toBe('function');
    });

    it('hide should call remove on message element', () => {
      const mockRemove = vi.fn();
      globalThis.$.mockReturnValue({ remove: mockRemove });

      globalThis.$exeGames.message.hide('test-id');

      expect(globalThis.$).toHaveBeenCalledWith('#test-id-message');
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('$exeGames.run', () => {
    it('should call hide after action', () => {
      const hideSpy = vi.spyOn(globalThis.$exeGames.message, 'hide');

      // Safe action that doesn't need eval
      globalThis.$exeGames.run('1+1', 'test-id');

      expect(hideSpy).toHaveBeenCalledWith('test-id');
    });
  });

  describe('hangMan.init', () => {
    it('should return false if words array is empty', () => {
      const result = globalThis.hangMan.init(0, [], false);
      expect(result).toBe(false);
    });

    it('should create game state object', () => {
      // Mock getElementById to return proper elements
      document.getElementById = vi.fn().mockReturnValue({
        innerHTML: '',
      });

      globalThis.hangMan.init(0, ['SGVsbG8='], false);

      expect(globalThis.window['hangMan0']).toBeDefined();
      expect(globalThis.window['hangMan0'].words).toBeInstanceOf(Array);
      expect(globalThis.window['hangMan0'].isCaseSensitive).toBe(false);
    });

    it('should decode base64 words', () => {
      document.getElementById = vi.fn().mockReturnValue({
        innerHTML: '',
      });

      globalThis.hangMan.init(0, ['SGVsbG8='], false);

      // Word "Hello" decoded and split with spaces
      expect(globalThis.window['hangMan0'].words[0]).toBe('H e l l o');
    });

    it('should handle case sensitive flag', () => {
      document.getElementById = vi.fn().mockReturnValue({
        innerHTML: '',
      });

      globalThis.hangMan.init(1, ['SGk='], true);

      expect(globalThis.window['hangMan1'].isCaseSensitive).toBe(true);
    });
  });

  describe('hangMan.paintMan', () => {
    it('should paint empty man for 0 parts', () => {
      const mockVal = vi.fn();
      globalThis.$.mockReturnValue({ val: mockVal });

      globalThis.hangMan.paintMan(0, 0);

      expect(mockVal).toHaveBeenCalledWith('');
    });

    it('should paint one part for 1 parts', () => {
      const mockVal = vi.fn();
      globalThis.$.mockReturnValue({ val: mockVal });

      globalThis.hangMan.paintMan(1, 0);

      expect(mockVal).toHaveBeenCalledWith('___\n');
    });

    it('should paint multiple parts', () => {
      const mockVal = vi.fn();
      globalThis.$.mockReturnValue({ val: mockVal });

      globalThis.hangMan.paintMan(3, 0);

      expect(mockVal).toHaveBeenCalledWith('___\n   |\n   O\n');
    });

    it('should not paint beyond 9 parts', () => {
      const mockVal = vi.fn();
      globalThis.$.mockReturnValue({ val: mockVal });

      globalThis.hangMan.paintMan(10, 0);

      // When partes >= 10, loop doesn't execute
      expect(mockVal).toHaveBeenCalledWith('');
    });
  });

  describe('hangMan.message', () => {
    it('should set innerHTML and className', () => {
      const mockElement = {
        innerHTML: '',
        className: '',
      };
      document.getElementById = vi.fn().mockReturnValue(mockElement);

      globalThis.hangMan.message(0, 'success', 'Test message');

      expect(mockElement.innerHTML).toBe('Test message');
      expect(mockElement.className).toBe('success');
    });

    it('should handle empty message', () => {
      const mockElement = {
        innerHTML: 'old',
        className: 'old',
      };
      document.getElementById = vi.fn().mockReturnValue(mockElement);

      globalThis.hangMan.message(0, '', '');

      expect(mockElement.innerHTML).toBe('');
      expect(mockElement.className).toBe('');
    });
  });

  describe('hangMan.addLetter', () => {
    it('should add letter to displayLetters', () => {
      const mockElement = { value: '' };
      document.getElementById = vi.fn().mockReturnValue(mockElement);

      globalThis.hangMan.addLetter('A', 0);

      expect(mockElement.value).toBe('A ');
    });

    it('should append to existing letters', () => {
      const mockElement = { value: 'B ' };
      document.getElementById = vi.fn().mockReturnValue(mockElement);

      globalThis.hangMan.addLetter('C', 0);

      expect(mockElement.value).toBe('B C ');
    });
  });

  describe('hangMan.checkWord', () => {
    it('should return false if word has underscores', () => {
      document.getElementById = vi.fn().mockReturnValue({ value: 'H _ l l o ' });

      const result = globalThis.hangMan.checkWord(0);

      expect(result).toBe(false);
    });

    it('should return true if word is complete', () => {
      document.getElementById = vi.fn().mockReturnValue({ value: 'H e l l o ' });

      const result = globalThis.hangMan.checkWord(0);

      expect(result).toBe(true);
    });

    it('should return true for empty word', () => {
      document.getElementById = vi.fn().mockReturnValue({ value: '' });

      const result = globalThis.hangMan.checkWord(0);

      expect(result).toBe(true);
    });
  });

  describe('hangMan.updateResults', () => {
    it('should update result counters', () => {
      const wonElement = { innerHTML: '' };
      const lostElement = { innerHTML: '' };
      const wonValue = { value: '3' };
      const lostValue = { value: '2' };

      document.getElementById = vi.fn((id) => {
        if (id === 'won-0-counter') return wonElement;
        if (id === 'lost-0-counter') return lostElement;
        if (id === 'won-0') return wonValue;
        if (id === 'lost-0') return lostValue;
        return { value: '', innerHTML: '' };
      });

      globalThis.hangMan.updateResults(0);

      expect(wonElement.innerHTML).toBe('3');
      expect(lostElement.innerHTML).toBe('2');
    });
  });

  describe('hangMan.showQuestion', () => {
    it('should highlight current question', () => {
      const mockRemoveClass = vi.fn().mockReturnThis();
      const mockAddClass = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnValue({ addClass: mockAddClass });
      const mockHtml = vi.fn();

      globalThis.$.mockReturnValue({
        removeClass: mockRemoveClass,
        eq: mockEq,
        html: mockHtml,
      });

      globalThis.hangMan.showQuestion(0, 2);

      expect(mockRemoveClass).toHaveBeenCalledWith('current');
      expect(mockEq).toHaveBeenCalledWith(2);
      expect(mockAddClass).toHaveBeenCalledWith('current');
    });
  });

  describe('hangMan man ASCII art', () => {
    it('should have correct ASCII art for hangman', () => {
      const man = globalThis.hangMan.man;
      expect(man[0]).toBe('___\n');
      expect(man[1]).toBe('   |\n');
      expect(man[2]).toBe('   O\n');
      expect(man[3]).toBe('  /');
      expect(man[4]).toBe('|');
      expect(man[5]).toBe('\\\n');
      expect(man[6]).toBe('  /');
      expect(man[7]).toBe(' \\\n');
      expect(man[8]).toBe('___');
    });
  });
});
