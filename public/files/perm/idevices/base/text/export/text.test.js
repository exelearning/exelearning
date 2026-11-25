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

    it('replaces {content} with textTextarea in template', () => {
      global.c_ = (v) => v;
      const data = { textTextarea: '<p>Hello</p>', textFeedbackTextarea: '' };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toBe('<div><p>Hello</p></div>');
    });

    it('returns template with empty content when textTextarea is missing', () => {
      global.c_ = (v) => v;
      const data = { textFeedbackTextarea: '' };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toBe('<div></div>');
    });

    it('appends feedback HTML when feedbackContent exists and content has no feedback elements', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Main content</p>',
        textFeedbackTextarea: '<p>My feedback</p>',
        textFeedbackInput: 'Show Feedback',
      };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toContain('<p>Main content</p>');
      expect(result).toContain('feedbacktooglebutton');
      expect(result).toContain('Show Feedback');
      expect(result).toContain('My feedback');
    });

    it('does not duplicate feedback when content already has .feedback-button', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p><div class="feedback-button"><input class="feedbackbutton" value="Btn"></div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      // Should not contain a second feedbacktooglebutton from createFeedbackHTML
      const matches = result.match(/feedbacktooglebutton/g);
      expect(matches).toBeNull();
    });

    it('does not duplicate feedback when content already has .feedbacktooglebutton', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p><input class="feedbacktooglebutton" value="Toggle">',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      // Only the original one, no extra from createFeedbackHTML appended
      const matches = result.match(/feedbacktooglebutton/g);
      expect(matches).toHaveLength(1);
    });

    it('does not duplicate feedback when content already has .feedback.js-feedback', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<div class="feedback js-feedback">Existing</div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).not.toContain('feedbacktooglebutton');
    });

    it('does not duplicate feedback when content already has div.feedback', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<div class="feedback">Existing</div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).not.toContain('feedbacktooglebutton');
    });

    it('uses defaultBtnFeedbackText when feedbackTitleId is empty', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: '',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).toContain('Show feedback');
    });

    it('uses c_() to translate the feedback button text', () => {
      global.c_ = (v) => `[translated] ${v}`;
      const data = {
        textTextarea: '<p>Text</p>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Mostrar',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).toContain('[translated] Mostrar');
    });
  });

  describe('getHTMLView', () => {
    it('is a function', () => {
      expect(typeof $text.getHTMLView).toBe('function');
    });

    it('extracts button text from feedbackbutton (legacy eXe 2.9) when textFeedbackInput is empty', () => {
      global.c_ = (v) => v;
      // eXe is provided by vitest.setup.js; patch only isInExe for this test
      const origIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = () => false;
      const data = {
        textTextarea: `<p>Content</p>
<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Evaluación" /></div>
<div class="feedback js-feedback js-hidden"><p>Feedback content</p></div>`,
        textFeedbackInput: '',
        textFeedbackTextarea: '',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsTextInput: '',
      };
      const result = $text.getHTMLView(data, '');
      eXe.app.isInExe = origIsInExe;
      expect(result).toContain('Evaluación');
      expect(result).toContain('Feedback content');
      expect(result).toContain('Content');
    });

    it('extracts button text from feedbacktooglebutton (eXe 4.0) when textFeedbackInput is empty', () => {
      global.c_ = (v) => v;
      const origIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = () => false;
      const data = {
        textTextarea: `<p>Content</p>
<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbacktooglebutton" value="Mostrar" /></div>
<div class="feedback js-feedback js-hidden"><p>Respuesta</p></div>`,
        textFeedbackInput: '',
        textFeedbackTextarea: '',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsTextInput: '',
      };
      const result = $text.getHTMLView(data, '');
      eXe.app.isInExe = origIsInExe;
      expect(result).toContain('Mostrar');
      expect(result).toContain('Respuesta');
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

  describe('fullscreen', () => {
    let node;
    let listeners;
    let addListener;

    beforeEach(() => {
      // Track the document listeners each test registers, so they can be
      // removed: every test loads a fresh $text, but the document is shared.
      listeners = [];
      addListener = document.addEventListener;
      document.addEventListener = function (type, fn, opts) {
        listeners.push([type, fn, opts]);
        return addListener.call(this, type, fn, opts);
      };
      document._textFullscreenWired = false;
      document.body.innerHTML = '';
      document.body.style.overflow = '';
      node = document.createElement('div');
      node.id = 'text-1';
      node.className = 'idevice_node text';
      node.innerHTML = '<div class="exe-text-template"><p>Hello</p></div>';
      document.body.appendChild(node);
    });

    afterEach(() => {
      listeners.forEach(([type, fn, opts]) => document.removeEventListener(type, fn, opts));
      document.addEventListener = addListener;
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    });

    const setFullscreenElement = (el) => {
      Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
    };

    it('uses translated labels when available and English fallbacks otherwise', () => {
      global.$exe_i18n = { fullScreen: 'Pantalla completa', exitFullScreen: 'Salir' };
      expect($text.getFullscreenLabel(false)).toBe('Pantalla completa');
      expect($text.getFullscreenLabel(true)).toBe('Salir');
      global.$exe_i18n = undefined;
      expect($text.getFullscreenLabel(false)).toBe('Full screen');
      expect($text.getFullscreenLabel(true)).toBe('Exit full screen');
    });

    it('adds one accessible button to the text template wrapper', () => {
      const wrap = $text.addFullscreenButton(node);
      expect(wrap.classList.contains('exe-text-template')).toBe(true);
      expect(wrap.classList.contains('text-fullscreen-wrap')).toBe(true);
      const btn = wrap.firstElementChild;
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.type).toBe('button');
      expect(btn.className).toBe('text-fullscreen-btn');
      expect(btn.getAttribute('aria-label')).toBe('Full screen');
      expect(btn.innerHTML).toContain('<svg');
    });

    it('is idempotent', () => {
      $text.addFullscreenButton(node);
      $text.addFullscreenButton(node);
      expect(node.querySelectorAll('.text-fullscreen-btn').length).toBe(1);
    });

    it('falls back to .idevice_body, then to the node itself (exported pages)', () => {
      node.innerHTML = '<div class="idevice_body"><p>Editor</p></div>';
      expect($text.addFullscreenButton(node).className).toContain('idevice_body');

      const exported = document.createElement('div');
      exported.innerHTML = '<p>Exported</p>';
      expect($text.addFullscreenButton(exported)).toBe(exported);
      expect(exported.firstElementChild.className).toBe('text-fullscreen-btn');
    });

    it('returns null for a missing node', () => {
      expect($text.addFullscreenButton(null)).toBeNull();
    });

    it('requests native fullscreen on the wrapper when the button is clicked', () => {
      const wrap = $text.addFullscreenButton(node);
      wrap.requestFullscreen = vi.fn(() => Promise.resolve());
      wrap.firstElementChild.click();
      expect(wrap.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(wrap.classList.contains('text-fs-active')).toBe(false);
    });

    it('exits native fullscreen when the wrapper is already fullscreen', () => {
      const wrap = $text.addFullscreenButton(node);
      setFullscreenElement(wrap);
      document.exitFullscreen = vi.fn();
      wrap.firstElementChild.click();
      expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    it('updates the button when native fullscreen changes', () => {
      const wrap = $text.addFullscreenButton(node);
      const btn = wrap.firstElementChild;
      setFullscreenElement(wrap);
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(btn.getAttribute('aria-label')).toBe('Exit full screen');
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      setFullscreenElement(null);
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(btn.getAttribute('aria-label')).toBe('Full screen');
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    it('uses the CSS fallback when the Fullscreen API is unavailable, and leaves it on a second click', () => {
      const wrap = $text.addFullscreenButton(node);
      wrap.requestFullscreen = undefined;
      const btn = wrap.firstElementChild;
      btn.click();
      expect(wrap.classList.contains('text-fs-active')).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
      expect(btn.getAttribute('aria-label')).toBe('Exit full screen');
      btn.click();
      expect(wrap.classList.contains('text-fs-active')).toBe(false);
      expect(document.body.style.overflow).toBe('');
      expect(btn.getAttribute('aria-label')).toBe('Full screen');
    });

    it('uses the CSS fallback when the browser refuses fullscreen', async () => {
      const wrap = $text.addFullscreenButton(node);
      wrap.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
      wrap.firstElementChild.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(wrap.classList.contains('text-fs-active')).toBe(true);
    });

    it('uses the CSS fallback when requestFullscreen throws', () => {
      const wrap = $text.addFullscreenButton(node);
      wrap.requestFullscreen = () => {
        throw new Error('not allowed');
      };
      $text.toggleFullscreen(wrap);
      expect(wrap.classList.contains('text-fs-active')).toBe(true);
    });

    it('leaves the CSS fallback with Escape', () => {
      const wrap = $text.addFullscreenButton(node);
      $text.setCssFullscreen(wrap, true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(wrap.classList.contains('text-fs-active')).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(wrap.classList.contains('text-fs-active')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });

    it('ignores clicks outside the button', () => {
      const wrap = $text.addFullscreenButton(node);
      wrap.requestFullscreen = vi.fn();
      wrap.querySelector('p').click();
      expect(wrap.requestFullscreen).not.toHaveBeenCalled();
    });

    it('registers the document listeners only once', () => {
      $text.wireFullscreenEvents();
      $text.wireFullscreenEvents();
      expect(listeners.map(([type]) => type)).toEqual(['click', 'keydown', 'fullscreenchange']);
    });

    it('makes the whole block (with its title) go fullscreen in exported pages', () => {
      document.body.innerHTML =
        '<article class="box"><header class="box-head"><h1 class="box-title">Title</h1></header>' +
        '<div class="box-content"><div id="text-2" class="idevice_node text">' +
        '<div class="exe-text-template"><p>Hi</p></div></div></div></article>';
      const box = document.querySelector('article.box');
      const wrap = $text.addFullscreenButton(document.getElementById('text-2'));
      expect($text.getFullscreenTarget(wrap)).toBe(box);
      expect(box.classList.contains('text-fullscreen-target')).toBe(true);
      box.requestFullscreen = undefined;
      const btn = wrap.firstElementChild;
      btn.click();
      expect(box.classList.contains('text-fs-active')).toBe(true);
      expect(wrap.classList.contains('text-fs-active')).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(box.classList.contains('text-fs-active')).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    it('keeps only the content as target inside the editor', () => {
      document.body.innerHTML =
        '<div id="node-content"><article class="box"><div class="idevice_node text" id="text-3">' +
        '<div class="idevice_body"><p>Editor</p></div></div></article></div>';
      const wrap = $text.addFullscreenButton(document.getElementById('text-3'));
      expect($text.getFullscreenTarget(wrap)).toBe(wrap);
      expect(wrap.classList.contains('text-fullscreen-target')).toBe(true);
      expect(document.querySelector('article.box').classList.contains('text-fullscreen-target')).toBe(false);
    });

    it('renderBehaviour adds the fullscreen button', () => {
      const origIsInExe = eXe.app.isInExe;
      const origExeDevices = global.$exeDevices;
      eXe.app.isInExe = () => false;
      global.$exeDevices = {
        iDevice: { gamification: { math: { hasLatex: () => false, updateLatex: vi.fn() } } },
      };
      try {
        $text.renderBehaviour({ ideviceId: 'text-1' });
        expect(node.querySelectorAll('.text-fullscreen-btn').length).toBe(1);
      } finally {
        eXe.app.isInExe = origIsInExe;
        global.$exeDevices = origExeDevices;
      }
    });
  });
});
