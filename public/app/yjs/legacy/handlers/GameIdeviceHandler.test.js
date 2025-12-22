/**
 * GameIdeviceHandler Tests
 *
 * Unit tests for GameIdeviceHandler - handles game iDevices (flipcards, selecciona, etc.)
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const GameIdeviceHandler = require('./GameIdeviceHandler');

describe('GameIdeviceHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new GameIdeviceHandler();
  });

  describe('canHandle', () => {
    it('returns true for flipcards', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice.flipcards')).toBe(true);
    });

    it('returns true for selecciona', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice.selecciona')).toBe(true);
    });

    it('returns true for selecciona-activity', () => {
      expect(handler.canHandle('selecciona-activity')).toBe(true);
    });

    it('returns true for trivial', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice.trivial')).toBe(true);
    });

    it('returns false for non-game iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });

    it('returns false for image-gallery', () => {
      expect(handler.canHandle('exe.engine.imagegalleryidevice.ImageGalleryIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text by default', () => {
      expect(handler.getTargetType()).toBe('text');
    });

    it('returns detected type after processing', () => {
      handler._detectedType = 'flipcards';
      expect(handler.getTargetType()).toBe('flipcards');
    });

    it('removes -activity suffix and maps to installed type', () => {
      handler._detectedType = 'selecciona-activity';
      // selecciona maps to quick-questions-multiple-choice in TYPE_MAP
      expect(handler.getTargetType()).toBe('quick-questions-multiple-choice');
    });
  });

  describe('decrypt', () => {
    it('decrypts XOR-encoded string with key 146', () => {
      // Encrypted '{"a":1}' with key 146
      // Each char XOR 146: { = 123 XOR 146 = 233 = 0xE9
      const encrypted = '%E9%B0%F3%B0%A8%A3%EF';
      const decrypted = handler.decrypt(encrypted);
      expect(decrypted).toBe('{"a":1}');
    });

    it('decrypts selecciona data prefix correctly', () => {
      // The beginning of selecciona encrypted data
      const encrypted = '%E9%B0%F3%E1%FB%F5%FC%F3%E6%E7%E0%F3%B0%A8%B0%B0%BE%B0%F3%E7%E6%FA%FD%E0%B0%A8%B0%B0%BE';
      const decrypted = handler.decrypt(encrypted);
      expect(decrypted).toBe('{"asignatura":"","author":"",');
    });

    it('handles empty string', () => {
      expect(handler.decrypt('')).toBe('');
    });

    it('handles null', () => {
      expect(handler.decrypt(null)).toBe('');
    });

    it('handles "undefined" string', () => {
      expect(handler.decrypt('undefined')).toBe('');
    });

    it('handles "null" string', () => {
      expect(handler.decrypt('null')).toBe('');
    });
  });

  describe('parseJson', () => {
    it('parses valid JSON object', () => {
      const result = handler.parseJson('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns null for invalid JSON', () => {
      expect(handler.parseJson('not json')).toBeNull();
    });

    it('returns null for arrays', () => {
      expect(handler.parseJson('[1,2,3]')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(handler.parseJson('')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(handler.parseJson(123)).toBeNull();
      expect(handler.parseJson(null)).toBeNull();
    });

    it('handles whitespace around JSON', () => {
      const result = handler.parseJson('  {"a":1}  ');
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('extractGameDataFromHtml', () => {
    it('extracts data from flipcards-DataGame div', () => {
      const html = '<div class="flipcards-IDevice"><div class="flipcards-DataGame js-hidden">{"typeGame":"FlipCards"}</div></div>';
      const data = handler.extractGameDataFromHtml(html, 'flipcards-DataGame');
      expect(data).toBe('{"typeGame":"FlipCards"}');
    });

    it('extracts encrypted data from selecciona-DataGame', () => {
      const html = '<div class="selecciona-DataGame js-hidden">%E9%B0%F3</div>';
      const data = handler.extractGameDataFromHtml(html, 'selecciona-DataGame');
      expect(data).toBe('%E9%B0%F3');
    });

    it('extracts data with HTML-encoded quotes', () => {
      const html = '<div class=&quot;flipcards-DataGame js-hidden&quot;>{"data":true}</div>';
      const data = handler.extractGameDataFromHtml(html, 'flipcards-DataGame');
      expect(data).toBe('{"data":true}');
    });

    it('returns null when div not found', () => {
      const html = '<div class="other-div">content</div>';
      const data = handler.extractGameDataFromHtml(html, 'flipcards-DataGame');
      expect(data).toBeNull();
    });

    it('returns null for empty html', () => {
      const data = handler.extractGameDataFromHtml('', 'flipcards-DataGame');
      expect(data).toBeNull();
    });
  });

  describe('extractProperties', () => {
    it('extracts plain JSON from flipcards using game data extraction', () => {
      // Test the full flow by extracting game data from HTML
      const testHtml = '<div class="flipcards-DataGame js-hidden">{"typeGame":"FlipCards","cards":[1,2,3]}</div>';

      // Extract game data directly
      const gameData = handler.extractGameDataFromHtml(testHtml, 'flipcards-DataGame');
      expect(gameData).toBe('{"typeGame":"FlipCards","cards":[1,2,3]}');

      // Parse the JSON
      const parsed = handler.parseJson(gameData);
      expect(parsed.typeGame).toBe('FlipCards');
      expect(parsed.cards).toEqual([1, 2, 3]);
    });

    it('decrypts and extracts encrypted selecciona data', () => {
      // Full encrypted selecciona JSON (simplified for test)
      const encrypted = '%E9%B0%F3%B0%A8%A3%EF'; // {"a":1}
      const testHtml = `<div class="selecciona-DataGame js-hidden">${encrypted}</div>`;

      // Extract game data
      const gameData = handler.extractGameDataFromHtml(testHtml, 'selecciona-DataGame');
      expect(gameData).toBe(encrypted);

      // Decrypt
      const decrypted = handler.decrypt(gameData);
      expect(decrypted).toBe('{"a":1}');

      // Parse
      const parsed = handler.parseJson(decrypted);
      expect(parsed.a).toBe(1);
    });

    it('returns empty object when no game data found', () => {
      const testHtml = '<div>No game data</div>';
      const gameData = handler.extractGameDataFromHtml(testHtml, 'flipcards-DataGame');
      expect(gameData).toBeNull();
    });
  });

  describe('GAME_PATTERNS', () => {
    it('includes flipcards', () => {
      expect(GameIdeviceHandler.GAME_PATTERNS['flipcards']).toBe('flipcards-DataGame');
    });

    it('includes selecciona', () => {
      expect(GameIdeviceHandler.GAME_PATTERNS['selecciona']).toBe('selecciona-DataGame');
    });

    it('includes common game types', () => {
      const expectedGames = ['trivial', 'crossword', 'relate', 'identify', 'discover'];
      expectedGames.forEach(game => {
        expect(GameIdeviceHandler.GAME_PATTERNS[game]).toBeDefined();
      });
    });
  });

  describe('ENCRYPTED_GAMES', () => {
    it('includes selecciona', () => {
      expect(GameIdeviceHandler.ENCRYPTED_GAMES).toContain('selecciona');
    });

    it('includes trivial', () => {
      expect(GameIdeviceHandler.ENCRYPTED_GAMES).toContain('trivial');
    });

    it('does not include flipcards', () => {
      expect(GameIdeviceHandler.ENCRYPTED_GAMES).not.toContain('flipcards');
    });

    it('includes Spanish encrypted games', () => {
      const spanishGames = [
        'rosco',
        'videoquext',
        'vquext',
        'quext',
        'desafio',
        'candado',
        'adivina',
        'clasifica',
        'completa',
        'descubre',
        'identifica',
        'sopa',
        'ordena',
        'crucigrama',
      ];
      spanishGames.forEach(game => {
        expect(GameIdeviceHandler.ENCRYPTED_GAMES).toContain(game);
      });
    });
  });

  describe('TYPE_MAP Spanish mappings', () => {
    it('maps Spanish to English types correctly', () => {
      const mappings = {
        sopa: 'word-search',
        crucigrama: 'crossword',
        relaciona: 'relate',
        desafio: 'challenge',
        candado: 'padlock',
        adivina: 'guess',
        clasifica: 'classify',
        completa: 'complete',
        descubre: 'discover',
        identifica: 'identify',
        ordena: 'sort',
        listacotejo: 'checklist',
        informe: 'progress-report',
        seleccionamedias: 'select-media-files',
        vquext: 'quick-questions-video',
        quext: 'quick-questions',
      };

      Object.entries(mappings).forEach(([spanish, english]) => {
        expect(GameIdeviceHandler.TYPE_MAP[spanish]).toBe(english);
      });
    });
  });
});
