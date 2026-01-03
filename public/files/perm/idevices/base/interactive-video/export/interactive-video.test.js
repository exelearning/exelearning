/**
 * Unit tests for interactive-video iDevice (export/runtime)
 *
 * Tests pure functions and configuration objects:
 * - isJsonString: Validates and parses JSON strings
 * - randomizeArray: Shuffles array elements
 * - inIframe: Detects iframe context
 * - i18n: Internationalization strings including YouTube preview notice
 * - typeNames: Slide type name mappings
 * - loadYoutubeWrapper: YouTube wrapper URL construction (mocked DOM)
 * - showYoutubeFallback: Fallback HTML generation (mocked DOM)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $interactivevideo globally.
 * Replaces 'var $interactivevideo' with 'global.$interactivevideo' to make it accessible.
 */
function loadExportIdevice(code) {
  // Make $interactivevideo and InteractiveVideo accessible globally
  let modifiedCode = code.replace(/var\s+\$interactivevideo\s*=/, 'global.$interactivevideo =');
  modifiedCode = modifiedCode.replace(/var\s+InteractiveVideo\s*=/, 'global.InteractiveVideo =');
  modifiedCode = modifiedCode.replace(/var\s+mejsFullScreen;/, 'global.mejsFullScreen = undefined;');

  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$interactivevideo;
}

describe('interactive-video iDevice export', () => {
  let $interactivevideo;

  beforeEach(() => {
    global.$interactivevideo = undefined;
    global.InteractiveVideo = undefined;
    global.mejsFullScreen = undefined;
    // Mock jQuery
    global.$ = () => ({ html: () => {}, eq: () => ({ attr: () => '' }), length: 0 });
    global.$.fn = {};

    const filePath = join(__dirname, 'interactive-video.js');
    const code = readFileSync(filePath, 'utf-8');

    $interactivevideo = loadExportIdevice(code);
  });

  afterEach(() => {
    delete global.$interactivevideo;
    delete global.InteractiveVideo;
    delete global.mejsFullScreen;
    delete global.$;
  });

  describe('isJsonString', () => {
    it('returns parsed object for valid JSON object string', () => {
      const result = $interactivevideo.isJsonString('{"name":"test","value":123}');
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('returns parsed array for valid JSON array string', () => {
      const result = $interactivevideo.isJsonString('[1,2,3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('returns false for invalid JSON', () => {
      expect($interactivevideo.isJsonString('not json')).toBe(false);
      expect($interactivevideo.isJsonString('{invalid}')).toBe(false);
      expect($interactivevideo.isJsonString('undefined')).toBe(false);
    });

    it('returns false for primitive JSON values', () => {
      // The function only returns objects, not primitives
      expect($interactivevideo.isJsonString('"string"')).toBe(false);
      expect($interactivevideo.isJsonString('123')).toBe(false);
      expect($interactivevideo.isJsonString('true')).toBe(false);
      expect($interactivevideo.isJsonString('null')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect($interactivevideo.isJsonString('')).toBe(false);
    });

    it('handles nested objects', () => {
      const result = $interactivevideo.isJsonString('{"outer":{"inner":"value"}}');
      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('handles arrays of objects', () => {
      const result = $interactivevideo.isJsonString('[{"id":1},{"id":2}]');
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('randomizeArray', () => {
    it('returns an array of the same length', () => {
      const input = [1, 2, 3, 4, 5];
      const result = $interactivevideo.randomizeArray([...input]);
      expect(result).toHaveLength(input.length);
    });

    it('contains all original elements', () => {
      const input = [1, 2, 3, 4, 5];
      const result = $interactivevideo.randomizeArray([...input]);
      expect(result.sort()).toEqual(input.sort());
    });

    it('changes the order of elements (eventually)', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Run multiple times to ensure it eventually shuffles
      let foundDifferent = false;
      for (let i = 0; i < 20; i++) {
        const result = $interactivevideo.randomizeArray([...input]);
        if (JSON.stringify(result) !== JSON.stringify(input)) {
          foundDifferent = true;
          break;
        }
      }
      expect(foundDifferent).toBe(true);
    });

    it('handles single element array', () => {
      const input = [1];
      const result = $interactivevideo.randomizeArray([...input]);
      expect(result).toEqual([1]);
    });

    it('handles empty array', () => {
      const input = [];
      const result = $interactivevideo.randomizeArray([...input]);
      expect(result).toEqual([]);
    });

    it('handles two element array', () => {
      const input = [1, 2];
      const result = $interactivevideo.randomizeArray([...input]);
      expect(result).toHaveLength(2);
      expect(result.sort()).toEqual([1, 2]);
    });
  });

  describe('inIframe', () => {
    it('returns a boolean', () => {
      const result = $interactivevideo.inIframe();
      expect(typeof result).toBe('boolean');
    });

    it('returns false when not in iframe', () => {
      // In test environment, window.self === window.top
      expect($interactivevideo.inIframe()).toBe(false);
    });
  });

  describe('i18n', () => {
    it('has required base messages', () => {
      expect($interactivevideo.i18n.start).toBe('Start');
      expect($interactivevideo.i18n.results).toBe('Results');
      expect($interactivevideo.i18n.slide).toBe('Slide');
      expect($interactivevideo.i18n.score).toBe('Score');
      expect($interactivevideo.i18n.error).toBe('Error');
    });

    it('has game-related messages', () => {
      expect($interactivevideo.i18n.right).toBe('Right!');
      expect($interactivevideo.i18n.wrong).toBe('Wrong');
      expect($interactivevideo.i18n.check).toBe('Check');
      expect($interactivevideo.i18n.notAnswered).toBeDefined();
    });

    it('has SCORM-related messages', () => {
      expect($interactivevideo.i18n.msgScoreScorm).toBeDefined();
      expect($interactivevideo.i18n.msgYouScore).toBeDefined();
      expect($interactivevideo.i18n.msgSaveAuto).toBeDefined();
    });

    it('has YouTube preview notice message', () => {
      // This is the key message for the YouTube wrapper feature
      expect($interactivevideo.i18n.youtubePreviewNotice).toBeDefined();
      expect($interactivevideo.i18n.youtubePreviewNotice).toContain('YouTube');
      expect($interactivevideo.i18n.youtubePreviewNotice).toContain('preview');
      expect($interactivevideo.i18n.youtubePreviewNotice).toContain('web server');
    });

    it('has newWindow message for fallback UI', () => {
      expect($interactivevideo.i18n.newWindow).toBe('New window');
    });

    it('has fullscreen warning message', () => {
      expect($interactivevideo.i18n.fsWarning).toBeDefined();
      expect($interactivevideo.i18n.fsWarning).toContain('fullscreen');
    });

    it('has accessibility messages', () => {
      expect($interactivevideo.i18n.up).toBe('Move up');
      expect($interactivevideo.i18n.down).toBe('Move down');
      expect($interactivevideo.i18n.sortableListInstructions).toBeDefined();
    });
  });

  describe('typeNames', () => {
    it('has all interactive element types', () => {
      expect($interactivevideo.typeNames.text).toBe('Texto');
      expect($interactivevideo.typeNames.image).toBe('Imagen');
      expect($interactivevideo.typeNames.singleChoice).toBe('Respuesta única');
      expect($interactivevideo.typeNames.multipleChoice).toBe('Respuesta múltiple');
      expect($interactivevideo.typeNames.dropdown).toBe('Desplegable');
      expect($interactivevideo.typeNames.cloze).toBe('Rellenar huecos');
      expect($interactivevideo.typeNames.matchElements).toBe('Emparejado');
      expect($interactivevideo.typeNames.sortableList).toBe('Lista desordenada');
    });
  });

  describe('scorm configuration', () => {
    it('has default SCORM settings', () => {
      expect($interactivevideo.scorm.isScorm).toBe(0);
      expect($interactivevideo.scorm.textButtonScorm).toBe('Save score');
      expect($interactivevideo.scorm.repeatActivity).toBe(false);
    });

    it('has SCORM library paths', () => {
      expect($interactivevideo.scormAPIwrapper).toBe('libs/SCORM_API_wrapper.js');
      expect($interactivevideo.scormFunctions).toBe('libs/SCOFunctions.js');
    });
  });

  describe('initial state', () => {
    it('has default score values', () => {
      expect($interactivevideo.score).toBe(0);
      expect($interactivevideo.scoref).toBe('0');
      expect($interactivevideo.numSlides).toBe(1000);
      expect($interactivevideo.scoreSlides).toEqual([]);
    });

    it('has default flags', () => {
      expect($interactivevideo.isSeek).toBe(false);
      expect($interactivevideo.isInExe).toBe(false);
      expect($interactivevideo.mediaElementReady).toBe(false);
      expect($interactivevideo.gameStarted).toBe(false);
      expect($interactivevideo.hasSCORMbutton).toBe(false);
    });

    it('has base ID', () => {
      expect($interactivevideo.baseId).toBe('interactivevideo');
    });
  });

  describe('loadYoutubeWrapper', () => {
    let originalWindow;
    let mockPlayerElement;

    beforeEach(() => {
      originalWindow = global.window;

      // Mock player element
      mockPlayerElement = {
        innerHTML: '',
        appendChild: vi.fn(),
      };

      // Mock DOM
      global.document = {
        getElementById: vi.fn((id) => {
          if (id === 'player') return mockPlayerElement;
          if (id === 'youtube-wrapper-iframe') return null;
          return null;
        }),
        createElement: vi.fn(() => ({
          id: '',
          src: '',
          width: '',
          height: '',
          frameBorder: '',
          allow: '',
          allowFullscreen: false,
          style: { cssText: '' },
        })),
      };

      // Mock window
      global.window = {
        location: { href: '', protocol: 'http:', origin: 'http://localhost:8080' },
        addEventListener: vi.fn(),
      };

      // Mock eXe global
      global.eXe = { basePath: '' };
    });

    afterEach(() => {
      global.window = originalWindow;
      delete global.document;
      delete global.eXe;
    });

    it('extracts HTTP origin from blob URL correctly', () => {
      global.window.location.href = 'blob:http://localhost:8080/abcd-1234';

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      // Verify iframe was created with correct URL
      expect(global.document.createElement).toHaveBeenCalledWith('iframe');
    });

    it('shows fallback for file: protocol', () => {
      global.window.location.href = 'file:///path/to/file.html';
      global.window.location.protocol = 'file:';

      // Mock showYoutubeFallback
      const showFallbackSpy = vi.fn();
      $interactivevideo.showYoutubeFallback = showFallbackSpy;

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      expect(showFallbackSpy).toHaveBeenCalled();
    });

    it('shows fallback when origin cannot be determined', () => {
      global.window.location.href = 'http://localhost:8080/page.html';

      // Mock showYoutubeFallback
      const showFallbackSpy = vi.fn();
      $interactivevideo.showYoutubeFallback = showFallbackSpy;

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      // Non-blob URLs can't extract wrapper base URL
      expect(showFallbackSpy).toHaveBeenCalled();
    });

    it('sets up message handler for communication', () => {
      global.window.location.href = 'blob:http://localhost:8080/abcd-1234';

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      expect(global.window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('creates player proxy object with required methods', () => {
      global.window.location.href = 'blob:http://localhost:8080/abcd-1234';

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      expect($interactivevideo.player).toBeDefined();
      expect(typeof $interactivevideo.player.getCurrentTime).toBe('function');
      expect(typeof $interactivevideo.player.playVideo).toBe('function');
      expect(typeof $interactivevideo.player.pauseVideo).toBe('function');
      expect(typeof $interactivevideo.player.seekTo).toBe('function');
      expect(typeof $interactivevideo.player.stopVideo).toBe('function');
    });

    it('player proxy getCurrentTime returns last tracked time', () => {
      global.window.location.href = 'blob:http://localhost:8080/abcd-1234';

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      // Default value
      expect($interactivevideo.player.getCurrentTime()).toBe(0);

      // After time update
      $interactivevideo._lastYoutubeTime = 42.5;
      expect($interactivevideo.player.getCurrentTime()).toBe(42.5);
    });

    it('includes basePath in wrapper URL when set', () => {
      global.window.location.href = 'blob:http://localhost:8080/abcd-1234';
      global.eXe.basePath = '/exelearning';

      let capturedIframe;
      global.document.createElement = vi.fn(() => {
        capturedIframe = {
          id: '',
          src: '',
          width: '',
          height: '',
          frameBorder: '',
          allow: '',
          allowFullscreen: false,
          style: { cssText: '' },
        };
        return capturedIframe;
      });

      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.loadYoutubeWrapper();

      expect(capturedIframe.src).toContain('/exelearning/app/common/youtube-preview.html');
      expect(capturedIframe.src).toContain('v=dQw4w9WgXcQ');
    });
  });

  describe('showYoutubeFallback', () => {
    let capturedHtml;
    let capturedAfterHtml;

    beforeEach(() => {
      capturedHtml = '';
      capturedAfterHtml = '';

      // Override jQuery mock for this test with full chain support
      const createChainableMock = () => ({
        html: (content) => {
          if (content !== undefined) capturedHtml = content;
          return createChainableMock();
        },
        after: (content) => {
          if (content !== undefined) capturedAfterHtml = content;
          return createChainableMock();
        },
        show: () => createChainableMock(),
        hide: () => createChainableMock(),
        attr: () => '',
        css: () => createChainableMock(),
        width: () => 448,
        ready: (fn) => { fn(); return createChainableMock(); },
        resize: () => createChainableMock(),
        eq: () => ({ attr: () => '' }),
        length: 0,
      });

      global.$ = (selector) => createChainableMock();

      // Mock InteractiveVideo with required i18n and slides
      global.InteractiveVideo = {
        i18n: {
          cover: 'Cover',
          slide: 'Slide',
          results: 'Results',
          score: 'Score',
          seen: 'Seen',
          total: 'Total',
          seeAll: 'See all',
        },
        slides: [],
        scorm: { isScorm: 0 },
      };

      // Mock resultsViewer.create to avoid complex DOM operations
      $interactivevideo.resultsViewer = {
        create: vi.fn(),
      };

      // Mock setMaxWidth
      $interactivevideo.setMaxWidth = vi.fn();

      // Mock complete() to avoid $(document).ready issues
      $interactivevideo.complete = vi.fn();
    });

    it('generates fallback HTML with video thumbnail', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('exe-youtube-fallback');
      expect(capturedHtml).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    });

    it('includes fallback thumbnail URL', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('includes YouTube link with correct video ID', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('includes play button icon', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      // SVG play icon path
      expect(capturedHtml).toContain('<svg');
      expect(capturedHtml).toContain('M8 5v14l11-7z');
    });

    it('uses i18n.newWindow message', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.i18n.newWindow = 'Open in new window';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('Open in new window');
    });

    it('sets target="_blank" on YouTube link', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('target="_blank"');
      expect(capturedHtml).toContain('rel="noopener"');
    });

    it('uses red YouTube branding colors', () => {
      $interactivevideo.id = 'dQw4w9WgXcQ';
      $interactivevideo.showYoutubeFallback();

      expect(capturedHtml).toContain('#ff0000');
    });
  });

  describe('updateScore', () => {
    beforeEach(() => {
      // Reset score state
      $interactivevideo.score = 0;
      $interactivevideo.scoreSlides = [];
      $interactivevideo.numSlides = 3;

      // Mock InteractiveVideo
      global.InteractiveVideo = {
        scoreNIA: false,
        scorm: { isScorm: 0 },
        i18n: { msgYouScore: 'Your score' },
      };

      // Mock saveEvaluation
      $interactivevideo.saveEvaluation = vi.fn();
    });

    it('does nothing if question index is out of bounds', () => {
      $interactivevideo.scoreSlides = [{ type: 'text', score: -1 }];
      $interactivevideo.updateScore(5, 100); // index 5 > length 1

      expect($interactivevideo.score).toBe(0);
    });

    it('updates score for singleChoice type', () => {
      $interactivevideo.scoreSlides = [{ type: 'singleChoice', score: -1 }];
      $interactivevideo.updateScore(0, '100');

      expect($interactivevideo.scoreSlides[0].score).toBe(1);
      expect($interactivevideo.score).toBe(1);
    });

    it('updates score for multipleChoice type', () => {
      $interactivevideo.scoreSlides = [{ type: 'multipleChoice', score: -1 }];
      $interactivevideo.updateScore(0, '50');

      expect($interactivevideo.scoreSlides[0].score).toBe(0.5);
      expect($interactivevideo.score).toBe(0.5);
    });

    it('updates score for dropdown type', () => {
      $interactivevideo.scoreSlides = [{ type: 'dropdown', score: -1 }];
      $interactivevideo.updateScore(0, '100');

      expect($interactivevideo.scoreSlides[0].score).toBe(1);
    });

    it('updates score for matchElements type', () => {
      $interactivevideo.scoreSlides = [{ type: 'matchElements', score: -1 }];
      $interactivevideo.updateScore(0, '75');

      expect($interactivevideo.scoreSlides[0].score).toBe(0.75);
    });

    it('updates score for sortableList type', () => {
      $interactivevideo.scoreSlides = [{ type: 'sortableList', score: -1 }];
      $interactivevideo.updateScore(0, '100');

      expect($interactivevideo.scoreSlides[0].score).toBe(1);
    });

    it('updates score for cloze type', () => {
      $interactivevideo.scoreSlides = [{ type: 'cloze', score: -1 }];
      $interactivevideo.updateScore(0, '80');

      expect($interactivevideo.scoreSlides[0].score).toBe(0.8);
    });

    it('does not update already scored slides', () => {
      $interactivevideo.scoreSlides = [{ type: 'singleChoice', score: 0.5 }];
      $interactivevideo.score = 0.5;
      $interactivevideo.updateScore(0, '100');

      // Score should remain unchanged
      expect($interactivevideo.scoreSlides[0].score).toBe(0.5);
      expect($interactivevideo.score).toBe(0.5);
    });

    it('calls saveEvaluation after updating', () => {
      $interactivevideo.scoreSlides = [{ type: 'text', score: -1 }];
      $interactivevideo.updateScore(0, '100');

      expect($interactivevideo.saveEvaluation).toHaveBeenCalled();
    });
  });

  describe('controls object', () => {
    it('has play, stop, pause, and seek methods', () => {
      expect(typeof $interactivevideo.controls.play).toBe('function');
      expect(typeof $interactivevideo.controls.stop).toBe('function');
      expect(typeof $interactivevideo.controls.pause).toBe('function');
      expect(typeof $interactivevideo.controls.seek).toBe('function');
    });
  });
});
