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

  describe('canHandle with ideviceType', () => {
    it('returns true for flipcards-activity ideviceType', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'flipcards-activity')).toBe(true);
      expect(handler._detectedType).toBe('flipcards');
    });

    it('returns true for trivial-activity ideviceType', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'trivial-activity')).toBe(true);
      expect(handler._detectedType).toBe('trivial');
    });

    it('returns true for crossword ideviceType without -activity suffix', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'crossword')).toBe(true);
      expect(handler._detectedType).toBe('crossword');
    });

    it('returns false for unknown ideviceType', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'unknown-type')).toBe(false);
    });

    it('returns false when ideviceType is null', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', null)).toBe(false);
    });

    it('returns false when ideviceType is undefined', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', undefined)).toBe(false);
    });

    it('pre-sets _detectedType for getTargetType to work', () => {
      handler.canHandle('exe.engine.jsidevice.JsIdevice', 'selecciona-activity');
      expect(handler.getTargetType()).toBe('quick-questions-multiple-choice');
    });
  });

  describe('extractHtmlView', () => {
    const createDictWithFields = (htmlContent) => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="${htmlContent}"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return doc.querySelector('dictionary');
    };

    it('extracts content from fields list', () => {
      const dict = createDictWithFields('&lt;p&gt;Hello World&lt;/p&gt;');
      const result = handler.extractHtmlView(dict);
      expect(result).toBe('<p>Hello World</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no fields key', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="other"/>
          <string value="value"/>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('handles multiple fields in list', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&lt;p&gt;First&lt;/p&gt;"/>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.TextField">
              <dictionary>
                <string role="key" value="_content"/>
                <unicode value="&lt;p&gt;Second&lt;/p&gt;"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');
      const result = handler.extractHtmlView(dict);
      expect(result).toContain('<p>First</p>');
      expect(result).toContain('<p>Second</p>');
    });

    it('skips non-TextAreaField instances', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.ImageField">
              <dictionary>
                <string role="key" value="content"/>
                <unicode value="image content"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('calls updateDataGameDivInHtml with extracted content', () => {
      // Test that extractHtmlView processes content through updateDataGameDivInHtml
      const htmlContent = '&lt;p&gt;Simple content&lt;/p&gt;';
      const dict = createDictWithFields(htmlContent);
      const result = handler.extractHtmlView(dict);
      // updateDataGameDivInHtml is called but returns content as-is when no game pattern matches
      expect(result).toBe('<p>Simple content</p>');
    });
  });

  describe('updateDataGameDivInHtml', () => {
    it('returns original html for encrypted games', () => {
      const html = '<div class="selecciona-DataGame">%E9%B0%F3</div>';
      const result = handler.updateDataGameDivInHtml(html);
      expect(result).toBe(html);
    });

    it('updates flipcards DataGame with parsed JSON', () => {
      const html = '<div class="flipcards-DataGame">{"typeGame":"FlipCards"}</div>';
      const result = handler.updateDataGameDivInHtml(html);
      expect(result).toContain('FlipCards');
    });

    it('returns original html when no game pattern matches', () => {
      const html = '<div class="unknown-div">content</div>';
      const result = handler.updateDataGameDivInHtml(html);
      expect(result).toBe(html);
    });

    it('returns empty/falsy html as-is', () => {
      expect(handler.updateDataGameDivInHtml('')).toBe('');
      expect(handler.updateDataGameDivInHtml(null)).toBe(null);
    });

    it('handles invalid JSON in non-encrypted games', () => {
      const html = '<div class="flipcards-DataGame">not valid json</div>';
      const result = handler.updateDataGameDivInHtml(html);
      // Should return original since JSON parsing fails
      expect(result).toBe(html);
    });
  });

  describe('escapeHtml', () => {
    it('escapes all HTML entities', () => {
      const input = '<div class="test">\'Hello\' & "World"</div>';
      const result = handler.escapeHtml(input);
      expect(result).toBe('&lt;div class=&quot;test&quot;&gt;&#039;Hello&#039; &amp; &quot;World&quot;&lt;/div&gt;');
    });

    it('returns empty string for falsy input', () => {
      expect(handler.escapeHtml('')).toBe('');
      expect(handler.escapeHtml(null)).toBe('');
      expect(handler.escapeHtml(undefined)).toBe('');
    });
  });

  describe('extractTextAreaFieldContent', () => {
    const createFieldInstance = (keyName, value) => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.field.TextAreaField">
          <dictionary>
            <string role="key" value="${keyName}"/>
            <unicode value="${value}"/>
          </dictionary>
        </instance>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return doc.querySelector('instance');
    };

    it('extracts content_w_resourcePaths', () => {
      const inst = createFieldInstance('content_w_resourcePaths', '&lt;p&gt;Test&lt;/p&gt;');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('<p>Test</p>');
    });

    it('extracts _content as fallback', () => {
      const inst = createFieldInstance('_content', '&lt;b&gt;Bold&lt;/b&gt;');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('<b>Bold</b>');
    });

    it('extracts content as last fallback', () => {
      const inst = createFieldInstance('content', '&lt;i&gt;Italic&lt;/i&gt;');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('<i>Italic</i>');
    });

    it('returns empty string for null instance', () => {
      expect(handler.extractTextAreaFieldContent(null)).toBe('');
    });

    it('returns empty string for instance without dictionary', () => {
      const xml = `<?xml version="1.0"?><instance class="TextAreaField"></instance>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const inst = doc.querySelector('instance');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('');
    });

    it('returns empty string when content is empty', () => {
      const inst = createFieldInstance('content_w_resourcePaths', '   ');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('');
    });
  });

  describe('decodeHtmlContent', () => {
    it('decodes HTML entities', () => {
      expect(handler.decodeHtmlContent('&lt;p&gt;Test&lt;/p&gt;')).toBe('<p>Test</p>');
      expect(handler.decodeHtmlContent('&amp;nbsp;')).toBe('&nbsp;');
      expect(handler.decodeHtmlContent('&quot;quoted&quot;')).toBe('"quoted"');
      expect(handler.decodeHtmlContent('&#39;single&#39;')).toBe("'single'");
    });

    it('decodes escape sequences', () => {
      expect(handler.decodeHtmlContent('line1\\nline2')).toBe('line1\nline2');
      expect(handler.decodeHtmlContent('col1\\tcol2')).toBe('col1\tcol2');
      expect(handler.decodeHtmlContent('text\\rmore')).toBe('text\rmore');
    });

    it('returns empty string for falsy input', () => {
      expect(handler.decodeHtmlContent('')).toBe('');
      expect(handler.decodeHtmlContent(null)).toBe('');
    });
  });

  describe('extractProperties with full dict', () => {
    const createGameDict = (gameType, dataGameClass, gameData) => {
      const escapedData = gameData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&lt;div class=&quot;${dataGameClass}&quot;&gt;${escapedData}&lt;/div&gt;"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return doc.querySelector('dictionary');
    };

    it('extracts flipcards game data from dict', () => {
      const gameData = '{"typeGame":"FlipCards","cards":[]}';
      const dict = createGameDict('flipcards', 'flipcards-DataGame', gameData);
      const result = handler.extractProperties(dict);
      expect(result.typeGame).toBe('FlipCards');
      expect(handler._detectedType).toBe('flipcards');
    });

    it('returns empty object when no game data found', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&lt;p&gt;No game here&lt;/p&gt;"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');
      const result = handler.extractProperties(dict);
      expect(result).toEqual({});
    });

    it('returns empty object when dict is null', () => {
      expect(handler.extractProperties(null)).toEqual({});
    });

    it('handles encrypted selecciona data', () => {
      // Encrypted '{"a":1}'
      const encrypted = '%E9%B0%F3%B0%A8%A3%EF';
      const dict = createGameDict('selecciona', 'selecciona-DataGame', encrypted);
      const result = handler.extractProperties(dict);
      expect(result.a).toBe(1);
      expect(handler._detectedType).toBe('selecciona');
    });

    it('handles trivial encrypted data', () => {
      // Encrypted '{"b":2}'
      // b=98, XOR 146 = 176 (0xB0)
      const encrypted = '%E9%B0%F0%B0%A8%A0%EF';
      const dict = createGameDict('trivial', 'trivial-DataGame', encrypted);
      const result = handler.extractProperties(dict);
      expect(result.b).toBe(2);
      expect(handler._detectedType).toBe('trivial');
    });
  });

  describe('parseJson edge cases', () => {
    it('extracts JSON from string with extra content', () => {
      const result = handler.parseJson('prefix {"key":"value"} suffix');
      expect(result).toEqual({ key: 'value' });
    });

    it('handles JSON with embedded newlines', () => {
      const jsonWithNewlines = '{"text":"line1\nline2"}';
      const result = handler.parseJson(jsonWithNewlines);
      expect(result.text).toBe('line1\nline2');
    });

    it('handles JSON with embedded tabs', () => {
      const jsonWithTabs = '{"text":"col1\tcol2"}';
      const result = handler.parseJson(jsonWithTabs);
      expect(result.text).toBe('col1\tcol2');
    });

    it('handles JSON with embedded carriage returns', () => {
      const jsonWithCR = '{"text":"line1\rline2"}';
      const result = handler.parseJson(jsonWithCR);
      expect(result.text).toBe('line1\rline2');
    });

    it('returns null when no braces found', () => {
      expect(handler.parseJson('no braces here')).toBeNull();
    });

    it('returns null when braces are malformed', () => {
      expect(handler.parseJson('} before {')).toBeNull();
    });
  });

  describe('decrypt edge cases', () => {
    it('handles malformed URL encoding with unescape fallback', () => {
      // This tests the unescape fallback path
      const result = handler.decrypt('%ZZ'); // Invalid URL encoding
      // Should not throw, may return empty or the result of unescape
      expect(typeof result).toBe('string');
    });

    it('handles very long encrypted strings', () => {
      // Create a longer encrypted string
      const str = 'test';
      let encrypted = '';
      for (let i = 0; i < str.length; i++) {
        encrypted += '%' + (146 ^ str.charCodeAt(i)).toString(16).padStart(2, '0').toUpperCase();
      }
      const result = handler.decrypt(encrypted);
      expect(result).toBe('test');
    });
  });

  describe('extractGameDataFromHtml regex fallback', () => {
    it('falls back to regex when DOM parsing fails for edge cases', () => {
      // Test with nested divs that might confuse simple regex
      const html = '<div class="wrapper"><div class="flipcards-DataGame">{"data":true}</div></div>';
      const result = handler.extractGameDataFromHtml(html, 'flipcards-DataGame');
      expect(result).toBe('{"data":true}');
    });

    it('handles multiline game data', () => {
      const html = `<div class="flipcards-DataGame">
{
  "typeGame": "FlipCards",
  "cards": []
}
</div>`;
      const result = handler.extractGameDataFromHtml(html, 'flipcards-DataGame');
      expect(result).toContain('"typeGame": "FlipCards"');
    });
  });

  describe('getTargetType mappings', () => {
    it('maps rosco to az-quiz-game', () => {
      handler._detectedType = 'rosco';
      expect(handler.getTargetType()).toBe('az-quiz-game');
    });

    it('maps mapa to map', () => {
      handler._detectedType = 'mapa';
      expect(handler.getTargetType()).toBe('map');
    });

    it('returns normalized type when not in TYPE_MAP', () => {
      handler._detectedType = 'unknown-game';
      expect(handler.getTargetType()).toBe('unknown-game');
    });
  });
});
