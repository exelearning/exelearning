/**
 * Unit tests for text iDevice (export/runtime)
 *
 * Tests configuration and basic functions.
 * Note: This file doesn't have auto-init call.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $text globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  // Mock $exe_i18n which is used at load time
  global.$exe_i18n = {
    showFeedback: 'Show feedback'
  };
  const modifiedCode = code.replace(/var\s+\$text\s*=/, 'global.$text =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$text;
}

describe('text iDevice export', () => {
  let $text;

  beforeEach(() => {
    global.$text = undefined;
    global.$exe_i18n = undefined;

    const filePath = join(__dirname, 'text.js');
    const code = readFileSync(filePath, 'utf-8');

    $text = loadExportIdevice(code);
  });

  describe('ideviceClass', () => {
    it('has expected class name', () => {
      expect($text.ideviceClass).toBe('textIdeviceContent');
    });
  });

  describe('working', () => {
    it('is initially false', () => {
      expect($text.working).toBe(false);
    });
  });

  describe('id constants', () => {
    it('has durationId', () => {
      expect($text.durationId).toBe('textInfoDurationInput');
    });

    it('has durationTextId', () => {
      expect($text.durationTextId).toBe('textInfoDurationTextInput');
    });

    it('has participantsId', () => {
      expect($text.participantsId).toBe('textInfoParticipantsInput');
    });

    it('has participantsTextId', () => {
      expect($text.participantsTextId).toBe('textInfoParticipantsTextInput');
    });

    it('has mainContentId', () => {
      expect($text.mainContentId).toBe('textTextarea');
    });

    it('has feedbackTitleId', () => {
      expect($text.feedbackTitleId).toBe('textFeedbackInput');
    });

    it('has feedbackContentId', () => {
      expect($text.feedbackContentId).toBe('textFeedbackTextarea');
    });
  });

  describe('renderView', () => {
    it('is a function', () => {
      expect(typeof $text.renderView).toBe('function');
    });

    describe('preserves existing content', () => {
      beforeEach(() => {
        // Mock eXe.app.isInExe for getHTMLView
        global.eXe = { app: { isInExe: () => false } };
      });

      afterEach(() => {
        delete global.eXe;
        // Clean up DOM
        document.body.innerHTML = '';
      });

      it('returns null when content already exists in DOM', () => {
        // Create a DOM node with existing content (simulating server-side render)
        const ideviceNode = document.createElement('div');
        ideviceNode.id = 'test-idevice-123';
        ideviceNode.innerHTML = `
          <div class="textIdeviceContent">
            <div class="exe-text-activity">
              <div><p>Existing processed content with <span class="highlighted">highlighting</span></p></div>
            </div>
          </div>
        `;
        document.body.appendChild(ideviceNode);

        const data = {
          ideviceId: 'test-idevice-123',
          textTextarea: '<p>Raw content from JSON</p>',
          textInfoDurationInput: '',
          textInfoParticipantsInput: '',
          textFeedbackInput: '',
          textFeedbackTextarea: '',
        };

        const result = $text.renderView(data, null, '{content}');

        // Should return null to prevent innerHTML replacement
        expect(result).toBeNull();
      });

      it('generates content when DOM node does not exist', () => {
        // No DOM node exists
        const data = {
          ideviceId: 'non-existent-id',
          textTextarea: '<p>Content from JSON</p>',
          textInfoDurationInput: '',
          textInfoParticipantsInput: '',
          textFeedbackInput: '',
          textFeedbackTextarea: '',
        };

        const result = $text.renderView(data, null, '{content}');

        // Should generate content
        expect(result).not.toBeNull();
        expect(result).toContain('Content from JSON');
        expect(result).toContain('textIdeviceContent');
      });

      it('generates content when DOM node exists but has no content', () => {
        // Create a DOM node without content (db-no-data case)
        const ideviceNode = document.createElement('div');
        ideviceNode.id = 'empty-idevice';
        ideviceNode.innerHTML = '';
        document.body.appendChild(ideviceNode);

        const data = {
          ideviceId: 'empty-idevice',
          textTextarea: '<p>Generated content</p>',
          textInfoDurationInput: '',
          textInfoParticipantsInput: '',
          textFeedbackInput: '',
          textFeedbackTextarea: '',
        };

        const result = $text.renderView(data, null, '{content}');

        // Should generate content since existing is empty
        expect(result).not.toBeNull();
        expect(result).toContain('Generated content');
      });

      it('preserves processed content like code highlighting', () => {
        // Create a DOM node with highlighted code (simulating server-side render)
        const ideviceNode = document.createElement('div');
        ideviceNode.id = 'highlighted-idevice';
        ideviceNode.innerHTML = `
          <div class="textIdeviceContent">
            <div class="exe-text-activity">
              <div>
                <div class="highlighted-code language-latex">
                  <pre class="language-latex"><code class="language-latex">\\[x = y\\]</code></pre>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(ideviceNode);

        const data = {
          ideviceId: 'highlighted-idevice',
          // Raw content without highlighting classes
          textTextarea: '<div class="highlighted-code language-latex"><pre><code>\\[x = y\\]</code></pre></div>',
          textInfoDurationInput: '',
          textInfoParticipantsInput: '',
          textFeedbackInput: '',
          textFeedbackTextarea: '',
        };

        const result = $text.renderView(data, null, '{content}');

        // Should return null to preserve the server-rendered highlighted content
        expect(result).toBeNull();

        // Verify original content is still in DOM (with highlighting classes)
        const existingContent = document.querySelector('#highlighted-idevice .highlighted-code');
        expect(existingContent).not.toBeNull();
        expect(existingContent.querySelector('pre.language-latex')).not.toBeNull();
      });
    });
  });

  describe('getHTMLView', () => {
    it('is a function', () => {
      expect(typeof $text.getHTMLView).toBe('function');
    });
  });

  describe('createMainContent', () => {
    it('is a function', () => {
      expect(typeof $text.createMainContent).toBe('function');
    });
  });

  describe('createFeedbackHTML', () => {
    it('is a function', () => {
      expect(typeof $text.createFeedbackHTML).toBe('function');
    });

    it('returns HTML with feedback button and content', () => {
      const result = $text.createFeedbackHTML('Show Feedback', '<p>Feedback content</p>');
      expect(result).toContain('Show Feedback');
      expect(result).toContain('Feedback content');
      expect(result).toContain('feedbacktooglebutton');
    });
  });

  describe('getHTMLView with mermaid content', () => {
    beforeEach(() => {
      // Mock eXe.app.isInExe for getHTMLView
      global.eXe = { app: { isInExe: () => false } };
    });

    afterEach(() => {
      delete global.eXe;
    });

    it('preserves pre.mermaid elements with original code', () => {
      const data = {
        textTextarea: '<p>Some text</p><pre class="mermaid">graph TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[Great!]</pre><p>More text</p>',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textFeedbackInput: '',
        textFeedbackTextarea: '',
      };

      const result = $text.getHTMLView(data);

      // The pre.mermaid element should be preserved
      expect(result).toContain('<pre class="mermaid">');
      expect(result).toContain('graph TD');
      expect(result).toContain('A[Start]');
    });

    it('preserves pre.mermaid with runtime-rendered SVG', () => {
      // Simulate what TinyMCE saves after mermaid.run() - SVG inside pre
      const data = {
        textTextarea: '<p>Text</p><pre class="mermaid" data-processed="true"><svg id="mermaid-123" viewBox="0 0 100 100"><g><rect></rect><text>Start</text></g></svg></pre>',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textFeedbackInput: '',
        textFeedbackTextarea: '',
      };

      const result = $text.getHTMLView(data);

      // The pre.mermaid element should be preserved (even with SVG inside)
      expect(result).toContain('<pre class="mermaid"');
      expect(result).toContain('data-processed="true"');
    });
  });

  describe('init - exe-dl processing', () => {
    // Helper to create a minimal jQuery-like mock
    function createJQueryMock() {
      const $ = function (selector, context) {
        let elements;
        // Handle $('selector', contextElement) syntax
        const searchRoot = context instanceof Element ? context : document;

        if (typeof selector === 'string') {
          if (selector.startsWith('#') && !context) {
            const el = document.getElementById(selector.slice(1));
            elements = el ? [el] : [];
          } else {
            elements = Array.from(searchRoot.querySelectorAll(selector));
          }
        } else if (selector instanceof Element) {
          elements = [selector];
        } else if (Array.isArray(selector)) {
          elements = selector;
        } else {
          elements = [];
        }

        const jqObj = {
          find: (sel) => $(Array.from(elements).flatMap(el => Array.from(el.querySelectorAll(sel)))),
          each: (fn) => {
            elements.forEach((el, i) => fn.call(el, i, el));
            return jqObj;
          },
          first: () => $(elements.length > 0 ? [elements[0]] : []),
          html: (content) => {
            if (content === undefined) {
              return elements[0]?.innerHTML || '';
            }
            elements.forEach(el => { el.innerHTML = content; });
            return jqObj;
          },
          css: (prop) => {
            if (elements[0]) {
              return getComputedStyle(elements[0])[prop] || '#333333';
            }
            return '#333333';
          },
          click: (fn) => {
            elements.forEach(el => el.addEventListener('click', fn));
            return jqObj;
          },
          index: (el) => elements.indexOf(el),
          length: elements.length,
        };
        return jqObj;
      };

      // Handle array input for find results
      $.fn = $.prototype;
      return $;
    }

    beforeEach(() => {
      document.body.innerHTML = '';
      // Mock jQuery
      global.$ = createJQueryMock();
      // Mock $exe with required functions
      global.$exe = {
        rgb2hex: (rgb) => '#333333',
        useBlackOrWhite: (hex) => 'white',
      };
      // Mock $exeFX for exe-fx processing (accordion, tabs, etc.)
      global.$exeFX = {
        baseClass: 'exe',
        accordion: { init: () => {} },
        tabs: { init: () => {} },
        paginated: { init: () => {} },
        carousel: { init: () => {} },
      };
    });

    afterEach(() => {
      delete global.$;
      delete global.$exe;
      delete global.$exeFX;
      document.body.innerHTML = '';
    });

    it('should NOT add icons if togglers already exist', () => {
      // Setup: Create DOM with exe-dl that already has togglers (already processed)
      document.body.innerHTML = `
        <div id="test-idevice">
          <dl class="exe-dl" id="exe-dl-0">
            <dt><a href="#" class="exe-dd-toggler exe-dd-toggler-closed"><span class="icon" style="background:#333333;color:white">+ </span>Term 1</a></dt>
            <dd>Definition 1</dd>
            <dt><a href="#" class="exe-dd-toggler exe-dd-toggler-closed"><span class="icon" style="background:#333333;color:white">+ </span>Term 2</a></dt>
            <dd>Definition 2</dd>
          </dl>
        </div>`;

      // Count icons before
      const iconsBefore = document.querySelectorAll('span.icon').length;
      expect(iconsBefore).toBe(2);

      // Act: Call init
      $text.init({ ideviceId: 'test-idevice' }, null);

      // Assert: Should still have only 2 icons (not 4)
      const iconsAfter = document.querySelectorAll('span.icon').length;
      expect(iconsAfter).toBe(2);
    });

    it('should add icons if exe-dl has no togglers', () => {
      // Setup: Create DOM with exe-dl without togglers (unprocessed)
      document.body.innerHTML = `
        <div id="test-idevice">
          <dl class="exe-dl">
            <dt>Term 1</dt>
            <dd>Definition 1</dd>
            <dt>Term 2</dt>
            <dd>Definition 2</dd>
          </dl>
        </div>`;

      // Count icons before
      const iconsBefore = document.querySelectorAll('span.icon').length;
      expect(iconsBefore).toBe(0);

      // Act: Call init
      $text.init({ ideviceId: 'test-idevice' }, null);

      // Assert: Should have exactly 2 icons (one per dt)
      const iconsAfter = document.querySelectorAll('span.icon').length;
      expect(iconsAfter).toBe(2);

      // Should have togglers
      const togglers = document.querySelectorAll('a.exe-dd-toggler');
      expect(togglers.length).toBe(2);
    });

    it('should set correct ID on exe-dl elements', () => {
      // Setup: Create DOM with unprocessed exe-dl
      document.body.innerHTML = `
        <div id="test-idevice">
          <dl class="exe-dl">
            <dt>Term</dt>
            <dd>Definition</dd>
          </dl>
        </div>`;

      // Act: Call init
      $text.init({ ideviceId: 'test-idevice' }, null);

      // Assert: Should set ID with idevice ID prefix
      const dl = document.querySelector('dl.exe-dl');
      expect(dl.id).toBe('exe-dl-test-idevice-0');
    });

    it('should not process multiple times on repeated init calls', () => {
      // Setup: Create DOM with unprocessed exe-dl
      document.body.innerHTML = `
        <div id="test-idevice">
          <dl class="exe-dl">
            <dt>Term</dt>
            <dd>Definition</dd>
          </dl>
        </div>`;

      // Act: Call init multiple times
      $text.init({ ideviceId: 'test-idevice' }, null);
      $text.init({ ideviceId: 'test-idevice' }, null);
      $text.init({ ideviceId: 'test-idevice' }, null);

      // Assert: Should still have exactly 1 icon
      const icons = document.querySelectorAll('span.icon');
      expect(icons.length).toBe(1);
    });
  });
});
