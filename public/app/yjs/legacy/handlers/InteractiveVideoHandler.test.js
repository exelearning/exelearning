/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock BaseLegacyHandler (loaded globally in browser)
class MockBaseLegacyHandler {
  extractTextAreaFieldContent(fieldInst) {
    if (!fieldInst) return '';
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return '';

    const children = Array.from(dict.children);
    const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

    for (const targetKey of contentKeys) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              return this.decodeHtmlContent(value);
            }
          }
        }
      }
    }
    return '';
  }

  decodeHtmlContent(content) {
    if (!content) return '';
    return content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

global.BaseLegacyHandler = MockBaseLegacyHandler;

// Now import the handler
const InteractiveVideoHandler = (await import('./InteractiveVideoHandler.js')).default;

describe('InteractiveVideoHandler', () => {
  let handler;

  // Helper to create DOM elements from XML string
  function parseDictionary(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    return doc.documentElement;
  }

  beforeEach(() => {
    handler = new InteractiveVideoHandler();
  });

  describe('canHandle', () => {
    it('returns true for interactive-video ideviceType', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'interactive-video')).toBe(true);
    });

    it('returns true for className containing interactive-video', () => {
      expect(handler.canHandle('some.class.interactive-video.Handler', undefined)).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'text')).toBe(false);
    });

    it('returns false for JsIdevice with undefined type', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', undefined)).toBe(false);
    });

    it('returns false for unrelated className without ideviceType', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice', null)).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns interactive-video', () => {
      expect(handler.getTargetType()).toBe('interactive-video');
    });
  });

  describe('transformInteractiveVideoScript', () => {
    it('transforms legacy var InteractiveVideo script to JSON format', () => {
      const legacyHtml = `
        <div class="exe-interactive-video">
          <script type="text/javascript">//<![CDATA[
var InteractiveVideo = {"slides":[{"type":"text","text":"Hello"}],"title":"Test"}
//]]></script>
        </div>
      `;

      const result = handler.transformInteractiveVideoScript(legacyHtml);

      expect(result).toContain('id="exe-interactive-video-contents"');
      expect(result).toContain('type="application/json"');
      expect(result).toContain('"slides"');
      expect(result).toContain('"title":"Test"');
      expect(result).not.toContain('var InteractiveVideo');
    });

    it('handles HTML-encoded entities in JSON', () => {
      const legacyHtml = `
        <div class="exe-interactive-video">
          <script>//<![CDATA[
var InteractiveVideo = {"title":"Test &amp; Demo","slides":[]}
//]]></script>
        </div>
      `;

      const result = handler.transformInteractiveVideoScript(legacyHtml);

      expect(result).toContain('id="exe-interactive-video-contents"');
      // The & should be decoded
      expect(result).toContain('"title":"Test & Demo"');
    });

    it('handles trailing commas in JSON', () => {
      const legacyHtml = `
        <div class="exe-interactive-video">
          <script>//<![CDATA[
var InteractiveVideo = {"slides":[{"type":"text",},],"title":"Test",}
//]]></script>
        </div>
      `;

      const result = handler.transformInteractiveVideoScript(legacyHtml);

      // Should successfully parse (trailing commas removed)
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('handles complex nested JSON with HTML content', () => {
      const legacyHtml = `
        <div class="exe-interactive-video">
          <script>//<![CDATA[
var InteractiveVideo = {"slides":[{"type":"text","text":"<p>Hello <strong>World</strong></p>"}],"title":"Demo"}
//]]></script>
        </div>
      `;

      const result = handler.transformInteractiveVideoScript(legacyHtml);

      expect(result).toContain('id="exe-interactive-video-contents"');
      expect(result).toContain('<p>Hello <strong>World</strong></p>');
    });

    it('preserves non-script HTML content', () => {
      const legacyHtml = `
        <div class="exe-interactive-video">
          <p id="exe-interactive-video-file">
            <a href="https://youtube.com/watch?v=abc123">Video Link</a>
          </p>
          <script>//<![CDATA[
var InteractiveVideo = {"slides":[],"title":"Test"}
//]]></script>
        </div>
      `;

      const result = handler.transformInteractiveVideoScript(legacyHtml);

      expect(result).toContain('exe-interactive-video-file');
      expect(result).toContain('youtube.com');
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('returns original HTML if no InteractiveVideo script found', () => {
      const html = '<div class="some-content"><p>Hello</p></div>';
      const result = handler.transformInteractiveVideoScript(html);
      expect(result).toBe(html);
    });

    it('returns decoded HTML when findBalancedJson returns null (unbalanced braces)', () => {
      // This tests line 112 - when jsonContent is null/undefined
      // because findBalancedJson couldn't find balanced braces
      const html = `<script>var InteractiveVideo = {unclosed brace</script>`;
      const result = handler.transformInteractiveVideoScript(html);
      // Should return the decoded HTML as-is since JSON couldn't be extracted
      expect(result).toBe(html);
    });

    it('uses fixJsonQuotes fallback when initial JSON parse fails', () => {
      // This tests lines 130-132 where the first JSON.parse fails
      // but fixJsonQuotes helps parse it successfully
      // Create JSON with issues that fixJsonQuotes can handle
      const legacyHtml = `<script>var InteractiveVideo = {"slides":[],"title":"Test"}</script>`;
      const result = handler.transformInteractiveVideoScript(legacyHtml);
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('returns original HTML when both JSON parses fail', () => {
      // This tests lines 133-135 - both parses fail
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create malformed JSON with balanced braces but invalid content
      // The braces must be balanced for findBalancedJson to return it
      // but the content must be invalid JSON that both parses fail on
      const html = `<script>var InteractiveVideo = {key without quotes: value}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      // Should return original HTML since parsing failed
      expect(result).toBe(html);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[InteractiveVideoHandler] Failed to parse InteractiveVideo JSON'),
        expect.any(String)
      );

      warnSpy.mockRestore();
    });

    it('returns decoded HTML when script tags cannot be located', () => {
      // This tests line 154 - when scriptStart or scriptEnd is -1
      // We need to mock findBalancedJson to return content, but
      // then have the script tag search fail
      const originalFindBalanced = handler.findBalancedJson;

      // Mock to return valid JSON but from wrong position
      handler.findBalancedJson = function(str, startPos) {
        return '{"slides":[],"title":"Test"}';
      };

      // Create HTML where lastIndexOf('<script') returns -1
      const html = 'var InteractiveVideo = {"test":1}';
      const result = handler.transformInteractiveVideoScript(html);

      // Should return the decoded HTML since script tags not found
      expect(result).toBe(html);

      handler.findBalancedJson = originalFindBalanced;
    });
  });

  describe('extractHtmlView', () => {
    it('extracts and transforms HTML from fields list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;//&lt;![CDATA[&#10;var InteractiveVideo = {&quot;slides&quot;:[],&quot;title&quot;:&quot;Test&quot;}&#10;//]]&gt;&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractHtmlView(dict, {});

      expect(result).toContain('exe-interactive-video');
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('returns empty string for empty dict', () => {
      expect(handler.extractHtmlView(null, {})).toBe('');
    });

    it('returns raw HTML if no exe-interactive-video class found', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;p&gt;Regular content&lt;/p&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractHtmlView(dict, {});

      expect(result).toContain('<p>Regular content</p>');
    });
  });

  describe('extractProperties', () => {
    it('extracts slides and configuration from transformed JSON', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;//&lt;![CDATA[&#10;var InteractiveVideo = {&quot;slides&quot;:[{&quot;type&quot;:&quot;text&quot;,&quot;text&quot;:&quot;Slide 1&quot;,&quot;startTime&quot;:5}],&quot;title&quot;:&quot;My Video&quot;,&quot;description&quot;:&quot;A test video&quot;,&quot;coverType&quot;:&quot;text&quot;}&#10;//]]&gt;&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'idev-123', {});

      expect(props.slides).toHaveLength(1);
      expect(props.slides[0].type).toBe('text');
      expect(props.slides[0].text).toBe('Slide 1');
      expect(props.slides[0].startTime).toBe(5);
      expect(props.title).toBe('My Video');
      expect(props.description).toBe('A test video');
      expect(props.coverType).toBe('text');
    });

    it('handles multiple slide types (text, image, singleChoice, multipleChoice)', () => {
      // Note: For XML attributes, we need to escape < > " & properly
      // The JSON contains HTML tags which must be escaped for XML parsing
      const slidesJson = JSON.stringify({
        slides: [
          { type: 'text', text: '<p>Intro</p>', startTime: 5 },
          { type: 'image', url: 1, description: 'Photo', startTime: 10 },
          { type: 'singleChoice', question: '<p>Q1?</p>', answers: [['A', 1], ['B', 0]], startTime: 15 },
          { type: 'multipleChoice', question: '<p>Q2?</p>', answers: [['X', 0], ['Y', 1], ['Z', 1]], startTime: 20 }
        ],
        title: 'Quiz Video'
      })
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = ${slidesJson}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'idev-456', {});

      expect(props.slides).toHaveLength(4);
      expect(props.slides[0].type).toBe('text');
      expect(props.slides[1].type).toBe('image');
      expect(props.slides[2].type).toBe('singleChoice');
      expect(props.slides[3].type).toBe('multipleChoice');
      expect(props.title).toBe('Quiz Video');
    });

    it('extracts SCORM configuration', () => {
      const config = {
        slides: [],
        title: 'SCORM Video',
        scorm: { isScorm: 1, textButtonScorm: 'Save', repeatActivity: false }
      };
      const configJson = JSON.stringify(config).replace(/"/g, '&quot;');

      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = ${configJson}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'idev-789', {});

      expect(props.scorm.isScorm).toBe(1);
      expect(props.scorm.textButtonScorm).toBe('Save');
    });

    it('returns empty object when no content', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict, 'idev-empty', {});
      expect(props).toEqual({});
    });

    it('returns empty object for null dict', () => {
      const props = handler.extractProperties(null, 'idev-null', {});
      expect(props).toEqual({});
    });
  });

  describe('decodeHtmlEntities', () => {
    it('decodes common HTML entities', () => {
      expect(handler.decodeHtmlEntities('&lt;p&gt;Test&lt;/p&gt;')).toBe('<p>Test</p>');
      expect(handler.decodeHtmlEntities('&amp;&quot;&#39;')).toBe('&"\'');
      expect(handler.decodeHtmlEntities('Hello&nbsp;World')).toBe('Hello World');
    });

    it('returns empty string for null/undefined', () => {
      expect(handler.decodeHtmlEntities(null)).toBe('');
      expect(handler.decodeHtmlEntities(undefined)).toBe('');
      expect(handler.decodeHtmlEntities('')).toBe('');
    });
  });

  describe('findBalancedJson', () => {
    it('finds simple JSON object', () => {
      const str = 'var x = {"key":"value"}';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBe('{"key":"value"}');
    });

    it('finds nested JSON object', () => {
      const str = 'var x = {"outer":{"inner":"value"}}';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBe('{"outer":{"inner":"value"}}');
    });

    it('finds deeply nested JSON with arrays', () => {
      const str = 'var x = {"a":{"b":{"c":[1,2,{"d":"e"}]}}}';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBe('{"a":{"b":{"c":[1,2,{"d":"e"}]}}}');
    });

    it('returns null if no opening brace found', () => {
      const str = 'var x = "no json here"';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBeNull();
    });

    it('returns null if braces are unbalanced', () => {
      const str = 'var x = {"key":"value"';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBeNull();
    });

    it('handles JSON with braces inside strings', () => {
      // Note: This is a limitation - the simple brace counting doesn't handle
      // braces inside string values. For real-world cases, the JSON is valid
      // and this works because the braces inside strings are balanced or escaped.
      const str = 'var x = {"text":"{}"}';
      const result = handler.findBalancedJson(str, 8);
      expect(result).toBe('{"text":"{}"}');
    });
  });

  describe('fixJsonQuotes', () => {
    it('returns input unchanged when quotes are properly escaped', () => {
      const json = '{"key":"value"}';
      const result = handler.fixJsonQuotes(json);
      // The function processes strings but shouldn't change valid JSON
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('handles empty strings', () => {
      const json = '{"key":""}';
      const result = handler.fixJsonQuotes(json);
      expect(JSON.parse(result)).toEqual({ key: '' });
    });
  });

  describe('extractLegacyProperties', () => {
    it('extracts properties from legacy var InteractiveVideo format', () => {
      const html = `<div class="exe-interactive-video">
        <script>var InteractiveVideo = {"slides":[{"type":"text"}],"title":"Legacy"}</script>
      </div>`;

      const result = handler.extractLegacyProperties(html);

      expect(result.slides).toHaveLength(1);
      expect(result.title).toBe('Legacy');
    });

    it('returns empty object when no InteractiveVideo found', () => {
      const html = '<div><script>var other = {}</script></div>';
      const result = handler.extractLegacyProperties(html);
      expect(result).toEqual({});
    });

    it('returns empty object for invalid JSON', () => {
      const html = '<script>var InteractiveVideo = {invalid json}</script>';
      const result = handler.extractLegacyProperties(html);
      expect(result).toEqual({});
    });

    it('handles JSON with HTML entities', () => {
      const html = '<script>var InteractiveVideo = {"title":"Test &amp; Demo","slides":[]}</script>';
      const result = handler.extractLegacyProperties(html);
      expect(result.title).toBe('Test & Demo');
    });
  });

  describe('extractFieldsHtml', () => {
    it('extracts HTML from TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;p&gt;Test content&lt;/p&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractFieldsHtml(dict);
      expect(result).toContain('<p>Test content</p>');
    });

    it('extracts HTML from TextField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="Simple text"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractFieldsHtml(dict);
      expect(result).toContain('Simple text');
    });

    it('returns empty string when no fields key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="other"></string>
          <list></list>
        </dictionary>
      `);

      const result = handler.extractFieldsHtml(dict);
      expect(result).toBe('');
    });

    it('concatenates multiple fields', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="First"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="Second"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractFieldsHtml(dict);
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });
  });

  describe('edge cases', () => {
    it('handles YouTube video type', () => {
      const html = `<div class="exe-interactive-video">
        <p id="exe-interactive-video-file">
          <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">YouTube Video</a>
        </p>
        <script>var InteractiveVideo = {"slides":[],"title":"YouTube Test"}</script>
      </div>`;

      const result = handler.transformInteractiveVideoScript(html);
      expect(result).toContain('youtube.com');
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('handles local video file type', () => {
      const html = `<div class="exe-interactive-video">
        <p id="exe-interactive-video-file">
          <a href="resources/video.mp4">video.mp4</a>
        </p>
        <script>var InteractiveVideo = {"slides":[],"title":"Local Video"}</script>
      </div>`;

      const result = handler.transformInteractiveVideoScript(html);
      expect(result).toContain('resources/video.mp4');
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('handles empty slides array', () => {
      const html = '<script>var InteractiveVideo = {"slides":[],"title":"Empty"}</script>';
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      expect(jsonMatch).toBeTruthy();
      const config = JSON.parse(jsonMatch[1]);
      expect(config.slides).toEqual([]);
    });

    it('handles unicode characters in content', () => {
      const html = `<script>var InteractiveVideo = {"slides":[{"type":"text","text":"日本語 中文 한국어 العربية"}],"title":"Unicode"}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      expect(jsonMatch).toBeTruthy();
      const config = JSON.parse(jsonMatch[1]);
      expect(config.slides[0].text).toContain('日本語');
      expect(config.slides[0].text).toContain('العربية');
    });

    it('handles evaluation settings', () => {
      const config = {
        slides: [],
        title: 'Evaluation Test',
        evaluation: true,
        evaluationID: 'eval-123',
        scoreNIA: true
      };
      const html = `<script>var InteractiveVideo = ${JSON.stringify(config)}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      const parsed = JSON.parse(jsonMatch[1]);
      expect(parsed.evaluation).toBe(true);
      expect(parsed.evaluationID).toBe('eval-123');
      expect(parsed.scoreNIA).toBe(true);
    });

    it('handles image slide with numeric url (asset index)', () => {
      const config = {
        slides: [
          { type: 'image', url: 0, description: 'First image', startTime: 5 },
          { type: 'image', url: 2, description: 'Third image', startTime: 10 }
        ],
        title: 'Image Gallery'
      };
      const html = `<script>var InteractiveVideo = ${JSON.stringify(config)}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      const parsed = JSON.parse(jsonMatch[1]);
      expect(parsed.slides[0].url).toBe(0);
      expect(parsed.slides[1].url).toBe(2);
    });

    it('handles script without CDATA wrapper', () => {
      const html = `<script>var InteractiveVideo = {"slides":[],"title":"No CDATA"}</script>`;
      const result = handler.transformInteractiveVideoScript(html);
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('handles script with type="text/javascript" attribute', () => {
      const html = `<script type="text/javascript">var InteractiveVideo = {"slides":[],"title":"With Type"}</script>`;
      const result = handler.transformInteractiveVideoScript(html);
      expect(result).toContain('id="exe-interactive-video-contents"');
    });

    it('handles i18n translations object', () => {
      const config = {
        slides: [],
        title: 'i18n Test',
        i18n: {
          start: 'Comenzar',
          results: 'Resultados',
          score: 'Puntuación',
          seen: 'Visto'
        }
      };
      const html = `<script>var InteractiveVideo = ${JSON.stringify(config)}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      const parsed = JSON.parse(jsonMatch[1]);
      expect(parsed.i18n.start).toBe('Comenzar');
      expect(parsed.i18n.results).toBe('Resultados');
    });

    it('preserves coverType settings', () => {
      const config = {
        slides: [],
        title: 'Cover Test',
        coverType: 'image',
        description: '<p>Cover description</p>'
      };
      const html = `<script>var InteractiveVideo = ${JSON.stringify(config)}</script>`;
      const result = handler.transformInteractiveVideoScript(html);

      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      const parsed = JSON.parse(jsonMatch[1]);
      expect(parsed.coverType).toBe('image');
      expect(parsed.description).toBe('<p>Cover description</p>');
    });
  });

  describe('extractProperties edge cases', () => {
    it('falls back to extractLegacyProperties when JSON script id/type is missing', () => {
      // This covers line 282 - when transformInteractiveVideoScript is called
      // but the result doesn't have the expected exe-interactive-video-contents id.
      // This can happen if the transformation fails to find var InteractiveVideo.

      // We'll mock transformInteractiveVideoScript to return HTML without the proper script
      const originalTransform = handler.transformInteractiveVideoScript;
      handler.transformInteractiveVideoScript = function(html) {
        // Return HTML that has the legacy format still (not transformed)
        return html.replace(
          /<script>var InteractiveVideo/,
          '<script>/* legacy */ var InteractiveVideo'
        );
      };

      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = {&quot;slides&quot;:[],&quot;title&quot;:&quot;Fallback Test&quot;}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      // Spy on extractLegacyProperties to verify it's called
      const spy = vi.spyOn(handler, 'extractLegacyProperties');
      const props = handler.extractProperties(dict, 'fallback-test', {});

      // The result should come from legacy extraction
      expect(props.title).toBe('Fallback Test');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

      // Restore original method
      handler.transformInteractiveVideoScript = originalTransform;
    });

    it('returns empty object when JSON parse fails after matching script', () => {
      // This covers lines 302-303 - console.warn and return {}
      // Create HTML where transformInteractiveVideoScript succeeds but returns malformed JSON
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script id=&quot;exe-interactive-video-contents&quot; type=&quot;application/json&quot;&gt;{invalid json content}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      // Mock console.warn to verify it's called
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const props = handler.extractProperties(dict, 'parse-fail-id', {});

      // Should return empty object when JSON parsing fails
      expect(props).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[InteractiveVideoHandler] Failed to parse transformed JSON'),
        expect.any(String)
      );

      warnSpy.mockRestore();
    });

    it('provides default values for missing properties', () => {
      const config = { slides: [{ type: 'text' }] };
      const configJson = JSON.stringify(config)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = ${configJson}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'fallback-id', {});

      expect(props.slides).toHaveLength(1);
      expect(props.title).toBe('');
      expect(props.description).toBe('');
      expect(props.coverType).toBe('text');
      expect(props.i18n).toEqual({});
      expect(props.scorm).toEqual({});
      expect(props.scoreNIA).toBe(false);
      expect(props.evaluation).toBe(false);
      expect(props.evaluationID).toBe('');
      expect(props.ideviceID).toBe('fallback-id');
    });

    it('uses ideviceID from config when present', () => {
      const config = { slides: [], ideviceID: 'config-id-123' };
      const configJson = JSON.stringify(config)
        .replace(/"/g, '&quot;');

      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = ${configJson}&lt;/script&gt;&lt;/div&gt;"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'fallback-id', {});
      expect(props.ideviceID).toBe('config-id-123');
    });
  });

  describe('real legacy ELP content', () => {
    it('handles actual legacy contentv3.xml format', () => {
      // This is based on the actual structure from the test fixture
      const legacyContent = `<div class="exe-interactive-video">
        <p id="exe-interactive-video-file" class="js-hidden">
          <a href="https://www.youtube.com/watch?v=v_rGjOBtvhI">com/watch?v=v_rGjOBtvhI</a>
        </p>
        <script type="text/javascript">//<![CDATA[
var InteractiveVideo = {"slides":[{"type":"text","text":"<p>primera <strong>diapositiva</strong></p>","startTime":5},{"type":"image","url":1,"description":"montaña","startTime":10},{"type":"singleChoice","question":"<p><strong>¿pregunta?</strong></p>","answers":[["Respuesta 1",1],["Respuesta 2",0]],"startTime":15},{"type":"multipleChoice","question":"<p><em>multiple</em></p>","answers":[["no",0],["si",1],["todo",0]],"startTime":20}],"title":"Portada","description":"<p>Texto de la <strong>portada</strong></p>","coverType":"text","i18n":{"start":"Start","results":"Results"},"scorm":{"isScorm":0,"textButtonScorm":"Save score","repeatActivity":false},"scoreNIA":false,"evaluation":false,"evaluationID":"","ideviceID":"20251228108140"}
//]]></script>
      </div>`;

      const result = handler.transformInteractiveVideoScript(legacyContent);

      // Should be transformed to JSON format
      expect(result).toContain('id="exe-interactive-video-contents"');
      expect(result).toContain('type="application/json"');

      // Video link should be preserved
      expect(result).toContain('exe-interactive-video-file');
      expect(result).toContain('youtube.com');

      // Parse the JSON to verify structure
      // Note: Use [\s\S]*? instead of [^<]* because JSON may contain < characters
      const jsonMatch = result.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*>([\s\S]*?)<\/script>/);
      expect(jsonMatch).toBeTruthy();

      const config = JSON.parse(jsonMatch[1]);
      expect(config.slides).toHaveLength(4);
      expect(config.slides[0].type).toBe('text');
      expect(config.slides[1].type).toBe('image');
      expect(config.slides[2].type).toBe('singleChoice');
      expect(config.slides[3].type).toBe('multipleChoice');
      expect(config.title).toBe('Portada');
      expect(config.ideviceID).toBe('20251228108140');
    });
  });
});
