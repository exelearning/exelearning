/**
 * Unit tests for interactive-video iDevice (export/runtime)
 *
 * Tests pure functions and configuration objects:
 * - isJsonString: Validates and parses JSON strings
 * - randomizeArray: Shuffles array elements
 * - inIframe: Detects iframe context
 * - i18n: Internationalization strings including YouTube preview notice
 * - typeNames: Slide type name mappings
 * - showYoutubeFallback: Fallback HTML generation (mocked DOM)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jquery = global.$;

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

  describe('progress report', () => {
    beforeEach(() => {
      global.$ = jquery;
      window.$ = jquery;
    });

    it('targets the interactive video iDevice body for report icons', () => {
      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Interactive video</h1></header>
          <div class="idevice_body interactive-videoIdevice">
            <div id="interactive-video-1" class="idevice_node interactive-video">
              <div class="exe-interactive-video"></div>
            </div>
          </div>
        </article>
      `;

      const options = $interactivevideo.getOptions({
        ideviceID: 'interactive-video-1',
        evaluation: true,
        evaluationID: 'progress-1',
        scorm: { isScorm: 0, textButtonScorm: 'Save score' },
        i18n: $interactivevideo.i18n,
      });

      expect(options.idevice).toBe('interactive-videoIdevice');
      expect(options.main).toBe('.exe-interactive-video');
      expect(options.evaluation).toBe(true);
      expect(options.evaluationID).toBe('progress-1');
    });

    it('falls back to the exported iDevice node when no iDevice body wrapper exists', () => {
      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Interactive video</h1></header>
          <div id="interactive-video-1" class="idevice_node interactive-video">
            <div class="exe-interactive-video"></div>
          </div>
        </article>
      `;

      const options = $interactivevideo.getOptions({
        ideviceID: 'interactive-video-1',
        evaluation: true,
        evaluationID: 'progress-1',
        scorm: { isScorm: 0, textButtonScorm: 'Save score' },
        i18n: $interactivevideo.i18n,
      });

      expect(options.idevice).toBe('idevice_node');
    });

    it('shows progress report information during export initialization', () => {
      const previousScorm = $exeDevices.iDevice.gamification.scorm;
      const previousReport = $exeDevices.iDevice.gamification.report;
      const previousIsInExe = eXe.app.isInExe;
      const updateEvaluationIcon = vi.fn();

      eXe.app.isInExe = vi.fn(() => false);
      $exeDevices.iDevice.gamification.scorm = {
        ...previousScorm,
        addButtonScoreNew: vi.fn(() => ''),
      };
      $exeDevices.iDevice.gamification.report = { updateEvaluationIcon };
      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Interactive video</h1></header>
          <div id="interactive-video-1" class="idevice_node interactive-video">
            <div class="exe-interactive-video"></div>
          </div>
        </article>
      `;
      global.InteractiveVideo = {
        ideviceID: 'interactive-video-1',
        evaluation: true,
        evaluationID: 'progress-1',
        scorm: { isScorm: 0, textButtonScorm: 'Save score' },
        scoreNIA: true,
        slides: [],
        i18n: $interactivevideo.i18n,
      };

      try {
        $interactivevideo.enable();
      } finally {
        eXe.app.isInExe = previousIsInExe;
        $exeDevices.iDevice.gamification.scorm = previousScorm;
        $exeDevices.iDevice.gamification.report = previousReport;
      }

      expect(updateEvaluationIcon).toHaveBeenCalledWith(
        expect.objectContaining({
          idevice: 'idevice_node',
          evaluation: true,
          evaluationID: 'progress-1',
        }),
        false,
      );
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

  /**
   * YouTube, driven by the host instead of by a player this iDevice mounts itself.
   *
   * A package runs inside an iframe sandboxed WITHOUT `allow-same-origin` on every host
   * that matters, so its document has a null origin. YouTube's iframe API cannot work
   * from there twice over: the content CSP blocks `youtube.com/iframe_api`, and even if
   * the script did load it could not satisfy the `origin` check that `enablejsapi`
   * requires, because there is no origin to send. Switching to the SDK does not help —
   * the SDK IS a postMessage client with the same requirement.
   *
   * So the video is opened by the trusted page over the external-media bridge, and this
   * iDevice's job is to ask for it and listen. The symptom this replaces: after pressing
   * start the panel stayed blank, the node never mounted, and the only trace was a CSP
   * error inside a frame nobody reads.
   */
  describe('YouTube through the external-media bridge', () => {
    let bridge;
    let controller;
    let listeners;

    /** A stand-in for the host's controller; its contract is covered by controller.spec.ts. */
    function makeController() {
      listeners = new Map();
      return {
        on: (event, fn) => {
          listeners.set(event, [...(listeners.get(event) || []), fn]);
          return controller;
        },
        emit: (event, payload) => {
          for (const fn of listeners.get(event) || []) fn(payload);
        },
        play: vi.fn(),
        pause: vi.fn(),
        seek: vi.fn(),
        close: vi.fn(),
      };
    }

    beforeEach(() => {
      controller = makeController();
      bridge = { openMedia: vi.fn(() => Promise.resolve(controller)) };

      $interactivevideo.type = 'youtube';
      $interactivevideo.id = 'aqz-KE-bpKQ';
      $interactivevideo.complete = vi.fn();
      $interactivevideo.checkSlides = vi.fn();
      $interactivevideo.track = vi.fn();
      $interactivevideo.showYoutubeFallback = vi.fn();
      $interactivevideo.orderSlides = vi.fn();

      // The SDK path inserts itself before the first script, so there has to be one.
      document.head.innerHTML = '<script></script>';
    });

    afterEach(() => {
      delete window.exeMediaBridge;
      delete window.exeExternalMediaChild;
      document.head.innerHTML = '';
    });

    it('asks the host to open the video instead of loading the YouTube SDK', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();

      expect(bridge.openMedia).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'youtube', videoId: 'aqz-KE-bpKQ' })
      );
      expect(document.querySelector('script[src*="iframe_api"]')).toBeNull();
    });

    it('accepts the legacy bridge global when the canonical one is absent', async () => {
      window.exeMediaBridge = bridge;

      await $interactivevideo.startYoutube();

      expect(bridge.openMedia).toHaveBeenCalled();
    });

    /**
     * The bug this whole change exists for: with no clock arriving, `track()` was never
     * called, so no slide ever became due and the questions simply did not fire.
     */
    it('feeds the slide scheduler from the host clock', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();
      controller.emit('timeupdate', { currentTime: 12.5, duration: 60 });

      expect($interactivevideo.track).toHaveBeenCalledWith(12.5);
    });

    /**
     * `ready()` orders the slides before a self-mounted player starts reporting, and the
     * bridged path needs it just as much: against an unordered list nothing is ever due,
     * so the clock would advance past questions that never become eligible to fire.
     */
    it('orders the slides before the host clock starts arriving', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();

      expect($interactivevideo.orderSlides).toHaveBeenCalled();
    });

    it('shows the fallback when the host reports a fatal player error', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();
      controller.emit('error', { code: '150', fatal: true });

      expect($interactivevideo.showYoutubeFallback).toHaveBeenCalled();
    });

    it('reports the video as playing so the slides are checked', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();
      controller.emit('play', {});

      expect($interactivevideo.hasPlayed).toBe(true);
      expect($interactivevideo.checkSlides).toHaveBeenCalled();
    });

    it('completes once the host reports the player ready', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();
      controller.emit('ready', {});

      expect($interactivevideo.complete).toHaveBeenCalled();
    });

    /**
     * The three methods the runtime already calls on `player`. Keeping exactly this shape
     * is what lets every existing call site stay as it is.
     */
    it('keeps the controls the runtime already calls working over the bridge', async () => {
      window.exeExternalMediaChild = { media: bridge };

      await $interactivevideo.startYoutube();

      $interactivevideo.controls.play();
      expect(controller.play).toHaveBeenCalled();

      $interactivevideo.controls.pause();
      expect(controller.pause).toHaveBeenCalled();

      $interactivevideo.controls.seek(30);
      expect(controller.seek).toHaveBeenCalledWith(30);
    });

    /**
     * Not every context is opaque: a package opened straight from disk, or served by a
     * host with no media half, has no bridge to talk to. That path predates this change
     * and must keep working, so the absence of a host is a fallback rather than a failure.
     */
    it('still loads the YouTube SDK when there is no host to ask', async () => {
      await $interactivevideo.startYoutube();

      expect(document.querySelector('script[src*="iframe_api"]')).not.toBeNull();
    });

    /**
     * A host that answers LATE is the dangerous case, not the one that never answers.
     *
     * `openMedia` only sends `open` once the handshake completes, and the host opens its
     * modal and starts loading the real player the moment it receives that. So a reply
     * arriving after the local wait gave up leaves a modal playing on the host page while
     * this iDevice has already mounted a second player of its own — two videos, one of them
     * unreachable. Giving up has to mean telling the host so.
     */
    it('closes a controller that arrives after the wait gave up', async () => {
      vi.useFakeTimers();
      try {
        let answer;
        window.exeExternalMediaChild = {
          media: { openMedia: () => new Promise(resolve => { answer = resolve; }) },
        };

        const started = $interactivevideo.startYoutube();
        await vi.advanceTimersByTimeAsync(10000);
        await started;

        // The host replies late, after the fallback has already been taken.
        answer(controller);
        await vi.advanceTimersByTimeAsync(0);

        expect(controller.close).toHaveBeenCalled();
        expect(document.querySelector('script[src*="iframe_api"]')).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    /**
     * A host that never answers leaves the handshake promise unsettled by design, so an
     * unbounded wait would show the learner a blank panel forever. Bounded, it degrades
     * into the same fallback as "no host at all".
     */
    it('falls back when a bridge is present but no host answers', async () => {
      vi.useFakeTimers();
      try {
        window.exeExternalMediaChild = { media: { openMedia: () => new Promise(() => {}) } };

        const started = $interactivevideo.startYoutube();
        await vi.advanceTimersByTimeAsync(10000);
        await started;

        expect(document.querySelector('script[src*="iframe_api"]')).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
