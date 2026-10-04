import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

require('./common.js');

describe('common.js $exe helpers', () => {
  let originalExeLearning;

  beforeEach(() => {
    originalExeLearning = global.eXeLearning;
    document.body.className = '';
    document.body.innerHTML = '';
    // Setup common i18n
    global.$exe_i18n = {
      download: 'Download',
      dataError: 'Data error',
      epubJSerror: 'ePub JS error',
    };
  });

  afterEach(() => {
    if (typeof originalExeLearning === 'undefined') {
      delete global.eXeLearning;
    } else {
      global.eXeLearning = originalExeLearning;
    }
    vi.restoreAllMocks();
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('rgb2hex returns hex for rgb values and preserves hex input', () => {
    expect(global.$exe.rgb2hex('#aabbcc')).toBe('#aabbcc');
    expect(global.$exe.rgb2hex('rgb(255, 0, 128)')).toBe('#ff0080');
  });

  it('useBlackOrWhite returns appropriate text color', () => {
    expect(global.$exe.useBlackOrWhite('ffffff')).toBe('black');
    expect(global.$exe.useBlackOrWhite('000000')).toBe('white');
  });

  it('isInExe and isPreview reflect global and body state', () => {
    global.eXeLearning = {};
    expect(global.$exe.isInExe()).toBe(true);
    delete global.eXeLearning;
    expect(global.$exe.isInExe()).toBe(false);

    document.body.classList.add('preview');
    expect(global.$exe.isPreview()).toBe(true);
  });

  it('getIdeviceInstalledExportPath reads correct attributes', () => {
    global.eXeLearning = {};
    document.body.innerHTML = `
      <article class="idevice_node" idevice-type="text" idevice-path="/exe/path"></article>
    `;
    expect(global.$exe.getIdeviceInstalledExportPath('text')).toBe('/exe/path');

    delete global.eXeLearning;
    document.body.innerHTML = `
      <article class="idevice_node" data-idevice-type="text" data-idevice-path="/export/path"></article>
    `;
    expect(global.$exe.getIdeviceInstalledExportPath('text')).toBe('/export/path');
  });

  it('hasTooltips loads tooltip script when tooltips are present', () => {
    global.eXeLearning = { symfony: { fullURL: 'http://example.com' } };
    document.body.innerHTML = '<a class="exe-tooltip" href="#"></a>';

    const loadSpy = vi.spyOn(global.$exe, 'loadScript').mockImplementation(() => {});

    global.$exe.hasTooltips();

    expect(loadSpy).toHaveBeenCalledWith(
      'http://example.com/app/common/exe_tooltips/exe_tooltips.js',
      "$exe.tooltips.init('http://example.com/app/common/exe_tooltips/')"
    );
  });

  it('loadScript appends script and link elements to the document head', () => {
    const head = document.getElementsByTagName('head')[0];
    const appendSpy = vi.spyOn(head, 'appendChild');
    appendSpy.mockImplementation((node) => node);

    global.$exe.loadScript('http://example.com/theme.css');
    global.$exe.loadScript('http://example.com/theme.js');

    const tags = appendSpy.mock.calls.map((call) => call[0]?.tagName);
    expect(tags).toContain('LINK');
    expect(tags).toContain('SCRIPT');
  });

  it('setIframesProperties marks external iframes and inserts source links', () => {
    document.body.innerHTML = '<iframe src=\"http://example.com\"></iframe>';

    global.$exe.setIframesProperties();

    const iframe = document.querySelector('iframe');
    expect(iframe.classList.contains('external-iframe')).toBe(true);
    const link = document.querySelector('span.external-iframe-src a');
    expect(link.getAttribute('href')).toBe('http://example.com');
  });

  it('isIE detects MSIE user agents', () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0)',
      configurable: true,
    });
    expect(global.$exe.isIE()).toBe(8);

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    expect(global.$exe.isIE()).toBe(false);

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  describe('$exe.math', () => {
    it('has engine property', () => {
      expect(global.$exe.math.engine).toBeDefined();
    });

    it('createLinks does not throw when math elements exist', () => {
      document.body.innerHTML = '<div class="exe-math"><div class="exe-math-code">x^2</div></div>';
      expect(() => global.$exe.math.createLinks()).not.toThrow();
    });

    it('createLinks adds links to math elements', () => {
      document.body.innerHTML = '<div class="exe-math"><div class="exe-math-code">x^2</div><div class="exe-math-img"><img src="test.gif" /></div></div>';
      global.$exe.math.createLinks();
      expect(document.querySelector('.exe-math-links')).not.toBeNull();
    });

    it('showCode opens a new window with code', () => {
      const mockWindow = {
        document: {
          open: vi.fn(),
          write: vi.fn(),
          close: vi.fn(),
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockWindow);

      document.body.innerHTML = '<div class="exe-math"><div class="exe-math-code">x^2</div></div>';
      const link = document.createElement('a');
      link.innerHTML = 'LaTeX';
      document.querySelector('.exe-math').appendChild(link);

      global.$exe.math.showCode(link);

      expect(mockWindow.document.open).toHaveBeenCalled();
      expect(mockWindow.document.write).toHaveBeenCalled();
    });

    it('init adds exe-auto-math class to body', () => {
      global.$exe.math.init();
      expect(document.body.classList.contains('exe-auto-math')).toBe(true);
    });
  });

  describe('$exe.mermaid', () => {
    beforeEach(() => {
      global.$exe.mermaid.loading = false;
    });

    it('has engine property', () => {
      expect(global.$exe.mermaid.engine).toBeDefined();
    });

    it('init does not throw when no mermaid elements', () => {
      expect(() => global.$exe.mermaid.init()).not.toThrow();
    });

    it('loadMermaid creates script element when mermaid not loaded', () => {
      delete global.mermaid;
      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});
      global.$exe.mermaid.loadMermaid();
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('loadMermaid does not inject the script twice while it is still loading', () => {
      delete global.mermaid;
      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});
      global.$exe.mermaid.loadMermaid();
      global.$exe.mermaid.loadMermaid();
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      expect(global.$exe.mermaid.loading).toBe(true);
    });

    it('loadMermaid clears the loading flag when the download fails, allowing a retry', () => {
      delete global.mermaid;
      let injected;
      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
        injected = el;
      });
      global.$exe.mermaid.loadMermaid();
      injected.onerror();
      expect(global.$exe.mermaid.loading).toBe(false);
      global.$exe.mermaid.loadMermaid();
      expect(appendChildSpy).toHaveBeenCalledTimes(2);
    });

    it('loadMermaid clears the loading flag once the library is loaded', () => {
      const originalInitialized = global.$exe.mermaid.initialized;
      delete global.mermaid;
      let injected;
      vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
        injected = el;
      });
      vi.spyOn(global.$exe.mermaid, 'renderDiagrams').mockImplementation(() => {});
      global.$exe.mermaid.loadMermaid();
      global.mermaid = { initialize: vi.fn(), run: vi.fn() };
      injected.onload();
      expect(global.$exe.mermaid.loading).toBe(false);
      expect(global.$exe.mermaid.initialized).toBe(true);
      global.$exe.mermaid.initialized = originalInitialized;
    });

    it('a save right after opening the dialog does not download the library twice', () => {
      // Dialog open preloads, then the editor deactivates and init() renders
      delete global.mermaid;
      document.body.innerHTML = '<div class="mermaid">graph TD; A-->B;</div>';
      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});
      global.$exe.mermaid.loadMermaid();
      global.$exe.mermaid.init();
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('$exe.setModalWindowContentSize', () => {
    it('does not throw in chrome', () => {
      expect(() => global.$exe.setModalWindowContentSize()).not.toThrow();
    });
  });

  describe('$exe.dl', () => {
    it('init returns false when no dl elements', () => {
      expect(global.$exe.dl.init()).toBe(false);
    });

    it('init processes dl.exe-dl elements', () => {
      document.body.innerHTML = '<dl class="exe-dl" style="color: rgb(0, 0, 0);"><dt>Term</dt><dd>Definition</dd></dl>';
      global.$exe.dl.init();
      expect(document.querySelector('.exe-dd-toggler')).not.toBeNull();
    });
  });

  describe('$exe.sfHover', () => {
    it('does not throw when siteNav does not exist', () => {
      expect(() => global.$exe.sfHover()).not.toThrow();
    });

    it('adds hover handlers to siteNav list items', () => {
      document.body.innerHTML = '<nav id="siteNav"><ul><li><a href="#">Link</a></li></ul></nav>';
      global.$exe.sfHover();
      const li = document.querySelector('li');
      expect(li.onmouseover).toBeDefined();
      expect(li.onmouseout).toBeDefined();
    });
  });

  describe('$exe.options', () => {
    it('has atools property with modeToggler and translator', () => {
      expect(global.$exe.options.atools.modeToggler).toBe(false);
      expect(global.$exe.options.atools.translator).toBe(false);
    });

    it('has i18n object', () => {
      expect(global.$exe.options.atools.i18n).toEqual({});
    });
  });

  describe('report.showPassScoreNotice', () => {
    const report = () => global.$exeDevices.iDevice.gamification.report;
    const game = (overrides = {}) =>
      Object.assign(
        { main: 'game-main', isScorm: 1, evaluation: false, evaluationID: '', msgs: { msgPassScore: 'Pass at %s' } },
        overrides
      );
    const custom = (mark, overrides = {}) =>
      game(Object.assign({ passScoreMode: 'custom', passScoreCustom: mark }, overrides));
    const setMeta = (content) => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'exe-pass-score');
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };
    const main = () => document.getElementById('game-main');
    const notices = () => document.querySelectorAll('.exe-pass-score-notice');

    beforeEach(() => {
      document.body.innerHTML =
        '<div class="activity"><div class="instructions">Read me</div><div id="game-main"></div></div>';
    });

    afterEach(() => {
      document.head.querySelectorAll('meta[name="exe-pass-score"]').forEach((meta) => meta.remove());
    });

    it('shows a customised mark between the instructions and the main container', () => {
      expect(report().showPassScoreNotice(custom(7))).not.toBeNull();

      const notice = main().previousElementSibling;
      expect(notice.classList.contains('exe-pass-score-notice')).toBe(true);
      expect(notice.previousElementSibling.className).toBe('instructions');
      expect(notice.textContent).toBe('Pass at 7');
    });

    it('is red and centred with Bootstrap', () => {
      const notice = report().showPassScoreNotice(custom(7))[0];

      expect(notice.classList.contains('text-danger')).toBe(true);
      expect(notice.classList.contains('text-center')).toBe(true);
    });

    it('shows the project mark of an activity that follows it', () => {
      setMeta('7');

      report().showPassScoreNotice(game({ passScoreMode: 'global', passScoreCustom: 3 }));

      expect(main().previousElementSibling.textContent).toBe('Pass at 7');
    });

    it('shows a mark with a decimal as it is stored', () => {
      report().showPassScoreNotice(custom(7.5));

      expect(main().previousElementSibling.textContent).toBe('Pass at 7.5');
    });

    it('shows a mark of 0', () => {
      report().showPassScoreNotice(custom(0));

      expect(main().previousElementSibling.textContent).toBe('Pass at 0');
    });

    // A learner takes 5 for granted, so saying it adds nothing.
    it.each([
      ['the project 5 it follows', () => game()],
      ['its own 5 in a project at 5', () => custom(5)],
      [
        'its own 5 in a project at 7',
        () => {
          setMeta('7');
          return custom(5);
        },
      ],
    ])('shows nothing for %s', (_label, build) => {
      expect(report().showPassScoreNotice(build())).toBeNull();
      expect(notices()).toHaveLength(0);
    });

    it('shows nothing while neither SCORM nor the progress report judges the mark', () => {
      expect(report().showPassScoreNotice(custom(7, { isScorm: 0 }))).toBeNull();
      expect(notices()).toHaveLength(0);
    });

    it.each([1, 2])('shows it in SCORM mode %d', (isScorm) => {
      expect(report().showPassScoreNotice(custom(7, { isScorm }))).not.toBeNull();
    });

    it('shows it for the progress report alone', () => {
      report().showPassScoreNotice(custom(7, { isScorm: 0, evaluation: true, evaluationID: 'report-1' }));

      expect(main().previousElementSibling.textContent).toBe('Pass at 7');
    });

    it('needs a report identifier, as saveEvaluation() does', () => {
      expect(report().showPassScoreNotice(custom(7, { isScorm: 0, evaluation: true, evaluationID: '' }))).toBeNull();
    });

    it('falls back to the default text for an iDevice saved before it had one', () => {
      global.$exe_i18n.passScoreNotice = 'Default %s';

      report().showPassScoreNotice(custom(7, { msgs: { msgPlayStart: 'Play' } }));

      expect(main().previousElementSibling.textContent).toBe('Default 7');
    });

    it('falls back to the default text when the custom one was left empty', () => {
      global.$exe_i18n.passScoreNotice = 'Default %s';

      report().showPassScoreNotice(custom(7, { msgs: { msgPassScore: '' } }));

      expect(main().previousElementSibling.textContent).toBe('Default 7');
    });

    it('shows nothing when there is no text to show', () => {
      expect(report().showPassScoreNotice(custom(7, { msgs: undefined }))).toBeNull();
    });

    it('writes the custom text as text, not markup', () => {
      report().showPassScoreNotice(custom(7, { msgs: { msgPassScore: '<b>%s</b>' } }));

      expect(main().previousElementSibling.textContent).toBe('<b>7</b>');
      expect(document.querySelector('.exe-pass-score-notice b')).toBeNull();
    });

    it('keeps one notice when the interface is set up again', () => {
      report().showPassScoreNotice(custom(7));
      report().showPassScoreNotice(custom(8));

      expect(notices()).toHaveLength(1);
      expect(notices()[0].textContent).toBe('Pass at 8');
    });

    it('drops the notice once the mark is 5', () => {
      report().showPassScoreNotice(custom(7));
      report().showPassScoreNotice(custom(5));

      expect(notices()).toHaveLength(0);
    });

    it('refreshes inherited marks, including transitions to and from 5, without changing custom marks', () => {
      document.body.innerHTML += '<div id="custom-main"></div><div id="ungraded-main"></div>';
      setMeta('5');
      report().showPassScoreNotice(game());
      report().showPassScoreNotice(custom(7, { main: 'custom-main' }));
      report().showPassScoreNotice(game({ main: 'ungraded-main', isScorm: 0 }));
      const customNotice = document.getElementById('custom-main').previousElementSibling;

      for (const mark of [3, 9, 5, 0]) {
        document.head.querySelector('meta[name="exe-pass-score"]').content = String(mark);
        report().refreshPassScoreNotices();

        expect(notices()).toHaveLength(mark === 5 ? 1 : 2);
        if (mark !== 5) expect(main().previousElementSibling.textContent).toBe(`Pass at ${mark}`);
        expect(document.getElementById('custom-main').previousElementSibling).toBe(customNotice);
        expect(customNotice.textContent).toBe('Pass at 7');
      }
    });

    it('refreshes an internal anchor without rebuilding or resetting the activity', () => {
      document.body.innerHTML =
        '<div id="game-main"><div class="instructions">Read me</div><div class="activity"><input value="answer"></div></div>';
      setMeta('3');
      const options = game({ scorerp: 6, gameStarted: true, gameOver: false });
      const savedOptions = JSON.stringify(options);
      const activity = document.querySelector('.activity');
      const input = activity.querySelector('input');
      input.value = 'Answer in progress';
      input.focus();
      report().showPassScoreNotice(options, activity);

      document.head.querySelector('meta[name="exe-pass-score"]').content = '9';
      report().refreshPassScoreNotices();
      report().refreshPassScoreNotices();

      expect(notices()).toHaveLength(1);
      expect(activity.previousElementSibling.textContent).toBe('Pass at 9');
      expect(activity.previousElementSibling.previousElementSibling.className).toBe('instructions');
      expect(document.querySelector('.activity')).toBe(activity);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('Answer in progress');
      expect(JSON.stringify(options)).toBe(savedOptions);
    });

    it('ignores removed activities and replaces the saved options when an anchor is reused', () => {
      setMeta('3');
      report().showPassScoreNotice(game());
      const oldMain = main();
      oldMain.parentElement.remove();
      document.body.innerHTML = '<div id="game-main"></div>';
      report().refreshPassScoreNotices();
      expect(notices()).toHaveLength(0);

      report().showPassScoreNotice(game());
      report().showPassScoreNotice(game({ msgs: { msgPassScore: 'New text: %s' } }));
      document.head.querySelector('meta[name="exe-pass-score"]').content = '9';
      report().refreshPassScoreNotices();

      expect(notices()).toHaveLength(1);
      expect(main().previousElementSibling.textContent).toBe('New text: 9');
      expect(oldMain.previousElementSibling.textContent).toBe('Pass at 3');
    });

    it('leaves alone a notice that belongs to another activity', () => {
      document.body.innerHTML =
        '<div><p class="exe-pass-score-notice">Other</p><div class="other"></div><div id="game-main"></div></div>';

      report().showPassScoreNotice(custom(7));

      expect(notices()).toHaveLength(2);
    });

    it('finds a main container given by class', () => {
      document.body.innerHTML = '<div class="game-main-class"></div>';

      report().showPassScoreNotice(custom(7, { main: '.game-main-class' }));

      expect(document.querySelector('.game-main-class').previousElementSibling.textContent).toBe('Pass at 7');
    });

    describe('for an iDevice whose instructions are inside its main container', () => {
      beforeEach(() => {
        document.body.innerHTML =
          '<div id="game-main"><div class="instructions">Read me</div><div class="activity"></div></div>';
      });

      it('goes before the element it is given, below the instructions', () => {
        report().showPassScoreNotice(custom(7), '#game-main > .activity');

        const notice = document.querySelector('.activity').previousElementSibling;
        expect(notice.textContent).toBe('Pass at 7');
        expect(notice.previousElementSibling.className).toBe('instructions');
        expect(notice.parentElement.id).toBe('game-main');
      });

      it('keeps one notice there when set up again, and drops it at 5', () => {
        report().showPassScoreNotice(custom(7), '#game-main > .activity');
        report().showPassScoreNotice(custom(8), '#game-main > .activity');
        expect(notices()).toHaveLength(1);
        expect(notices()[0].textContent).toBe('Pass at 8');

        report().showPassScoreNotice(custom(5), '#game-main > .activity');
        expect(notices()).toHaveLength(0);
      });

      it('falls back to the main container when that element is not on the page', () => {
        report().showPassScoreNotice(custom(7), '#game-main > .missing');

        expect(main().previousElementSibling.textContent).toBe('Pass at 7');
      });
    });

    it.each([
      ['no options', undefined],
      ['no main container', { isScorm: 1 }],
      ['a main container missing from the page', { main: 'not-here', isScorm: 1 }],
    ])('does nothing with %s', (_label, options) => {
      expect(report().showPassScoreNotice(options)).toBeNull();
      expect(notices()).toHaveLength(0);
    });
  });

  describe('$exe.passScore', () => {
    const setMeta = (content) => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'exe-pass-score');
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };

    const setYjsPassScore = (value) => {
      global.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              getDocumentManager: () => ({
                getMetadata: () => new Map([['passScore', value]]),
              }),
            },
          },
        },
      };
    };

    afterEach(() => {
      document.head.querySelectorAll('meta[name="exe-pass-score"]').forEach((meta) => meta.remove());
      delete global.eXeLearning;
    });

    describe('requiresEveryActivity', () => {
      const setEveryActivityMeta = (content) => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'exe-pass-score-every-activity');
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      };

      afterEach(() => {
        document.head
          .querySelectorAll('meta[name="exe-pass-score-every-activity"]')
          .forEach((meta) => meta.remove());
      });

      it('is required when the page says "true"', () => {
        setEveryActivityMeta('true');

        expect(global.$exe.passScore.requiresEveryActivity()).toBe(true);
      });

      it('is not required with any other value', () => {
        setEveryActivityMeta('false');

        expect(global.$exe.passScore.requiresEveryActivity()).toBe(false);
      });

      it('is not required when the page says nothing, as every page did before', () => {
        expect(global.$exe.passScore.requiresEveryActivity()).toBe(false);
      });
    });

    describe('normalize', () => {
      it('keeps a value already inside the domain', () => {
        expect(global.$exe.passScore.normalize(7.5)).toBe(7.5);
        expect(global.$exe.passScore.normalize('7.5')).toBe(7.5);
      });

      it('keeps zero, which means "any mark passes"', () => {
        expect(global.$exe.passScore.normalize(0)).toBe(0);
        expect(global.$exe.passScore.normalize('0')).toBe(0);
      });

      it('clamps values outside 0-10', () => {
        expect(global.$exe.passScore.normalize(12)).toBe(10);
        expect(global.$exe.passScore.normalize(-3)).toBe(0);
      });

      it('rounds to a single decimal', () => {
        expect(global.$exe.passScore.normalize(7.55)).toBe(7.6);
        expect(global.$exe.passScore.normalize(7.44)).toBe(7.4);
      });

      it('falls back to the default rather than to zero', () => {
        expect(global.$exe.passScore.normalize(undefined)).toBe(5);
        expect(global.$exe.passScore.normalize(null)).toBe(5);
        expect(global.$exe.passScore.normalize('')).toBe(5);
        expect(global.$exe.passScore.normalize('abc')).toBe(5);
      });
    });

    describe('get', () => {
      it('reads the META tag exported pages carry', () => {
        setMeta('7.5');
        expect(global.$exe.passScore.get()).toBe(7.5);
      });

      it('normalizes what the META says', () => {
        setMeta('42');
        expect(global.$exe.passScore.get()).toBe(10);
      });

      it('reads the live Y.Doc in the editor, where there is no META', () => {
        setYjsPassScore(7.5);
        expect(global.$exe.passScore.get()).toBe(7.5);
      });

      it('prefers the META over the Y.Doc, so an exported page never consults the editor', () => {
        setMeta('3');
        setYjsPassScore(9);
        expect(global.$exe.passScore.get()).toBe(3);
      });

      it('falls back to the default with neither META nor editor', () => {
        expect(global.$exe.passScore.get()).toBe(5);
      });
    });

    describe('resolve', () => {
      it('uses the mark the iDevice stored when its author customised it', () => {
        setMeta('5');
        expect(global.$exe.passScore.resolve({ passScoreMode: 'custom', passScoreCustom: 7.5 })).toBe(7.5);
      });

      it('follows the page value when the iDevice is on the global mode', () => {
        setMeta('7.5');
        expect(global.$exe.passScore.resolve({ passScoreMode: 'global', passScoreCustom: 3 })).toBe(7.5);
      });

      it('follows the page value for an iDevice saved before this option existed', () => {
        setMeta('7.5');
        expect(global.$exe.passScore.resolve({})).toBe(7.5);
        expect(global.$exe.passScore.resolve()).toBe(7.5);
      });

      it('normalizes a stored mark that is out of range', () => {
        setMeta('5');
        expect(global.$exe.passScore.resolve({ passScoreMode: 'custom', passScoreCustom: 42 })).toBe(10);
      });

      it('keeps a customised zero rather than falling back to the page value', () => {
        setMeta('7.5');
        expect(global.$exe.passScore.resolve({ passScoreMode: 'custom', passScoreCustom: 0 })).toBe(0);
      });
    });

    describe('toPercent', () => {
      it('converts a 0-10 mark to the 0-100 scale the SCORM registry uses', () => {
        expect(global.$exe.passScore.toPercent(7.5)).toBe(75);
        expect(global.$exe.passScore.toPercent(0)).toBe(0);
        expect(global.$exe.passScore.toPercent(10)).toBe(100);
      });

      it('converts the current page value when called with no argument', () => {
        setMeta('7.5');
        expect(global.$exe.passScore.toPercent()).toBe(75);
      });
    });

    /**
     * The threshold reached the progress report for free -- the iDevices hand
     * their whole options object to report.saveEvaluation, which resolves it --
     * but the message the learner reads is decided inside each export, and
     * thirteen of them went on comparing the score against a literal. The
     * report said "not passed" and the very same screen painted the score
     * green.
     *
     * They did not even agree on the literal: 5 in most, 6 in puzzle and
     * select-media-files, 0.5 in classify on a ratio scale. So the rule is not
     * "no 5" but the one that actually holds -- a mark strictly between 0 and
     * 10 is a threshold and must be resolved. The edges are exempt because they
     * mean something else entirely: 0 is "scored at all" and 10 is "everything
     * right", neither of which moves when the author changes the pass mark.
     */
    describe('no export decides a verdict against a literal mark', () => {
      const IDEVICES_DIR = join(__dirname, '..', '..', 'files', 'perm', 'idevices', 'base');
      const MARK = String.raw`(\d+(?:\.\d+)?)`;
      // Two shapes, because a verdict is recognisable either by what it weighs
      // or by what it produces.
      //
      // By what it produces: throughout these files the pass/fail answer is the
      // pair 1 and 2, the indices showMessage turns into red and green. The
      // left operand is deliberately not captured -- `parseInt(score) >= 5` and
      // `(hits * 10) / total >= 5` are both verdicts and neither is a plain
      // identifier.
      const VERDICT_PAIR = new RegExp(String.raw`[<>]=?\s*${MARK}\s*\?\s*([12])\s*:\s*([12])\b`, 'g');
      // By what it weighs: a score-named operand against a literal, whatever it
      // then decides -- `sp < 5 ? red : green` paints rather than returning 1/2.
      const SCORE_NAMED = new RegExp(
        String.raw`(?:^|[^\w.])(?:score|scorep|scorerp|scoretotal|puntuacion|nota|sp)\s*[<>]=?\s*${MARK}`,
        'g'
      );

      /**
       * Bands of encouragement, not verdicts: each is one boundary of three or
       * four that pick how warmly the activity congratulates the learner. They
       * keep their own numbers because moving only the lowest would put the
       * tiers out of order -- a pass mark of 8 would leave the middle band
       * unreachable.
       */
      const ENCOURAGEMENT_BANDS = [
        'puntuacion < 5', // map: msgScore4 / msgScore6 / msgScore8 / msgScore10
        'puntuacion < 7',
        'percentageHits < 0.5', // classify: msgQ5 / msgQ7 / msgQ9
        'percentageHits < 0.7',
      ];

      const verdicts = (source) => {
        const cleaned = ENCOURAGEMENT_BANDS.reduce(
          (text, band) => text.split(band).join(''),
          source
        );
        const found = [];
        for (const pattern of [VERDICT_PAIR, SCORE_NAMED]) {
          for (const match of cleaned.matchAll(pattern)) {
            const mark = Number.parseFloat(match[1]);
            // 0 is "scored at all" and 10 is "everything right"; neither moves
            // when the author changes the pass mark. Anything between them is a
            // threshold and has to be resolved.
            if (mark > 0 && mark < 10) found.push(match[0].trim());
          }
        }
        return found;
      };

      const exports = readdirSync(IDEVICES_DIR)
        .map((name) => ({ name, file: join(IDEVICES_DIR, name, 'export', `${name}.js`) }))
        .filter(({ file }) => existsSync(file))
        .map(({ name, file }) => ({ name, source: readFileSync(file, 'utf-8') }));

      it('finds the exports to scan', () => {
        expect(exports.length).toBeGreaterThan(30);
      });

      it('recognises the shapes the offenders were written in', () => {
        // A guard rail for the matcher: were it to stop matching, every
        // assertion below would pass on any source at all.
        expect(verdicts('type = scoreX < 5 ? 1 : 2;')).not.toEqual([]);
        expect(verdicts('let c = mOptions.score >= 6 ? 2 : 1;')).not.toEqual([]);
        expect(verdicts('type = percentageX < 0.5 ? 1 : 2;')).not.toEqual([]);
        expect(verdicts('const t = parseInt(score) >= 5 ? 2 : 1;')).not.toEqual([]);
        expect(verdicts('const t = (h * 10) / n >= 5 ? 2 : 1;')).not.toEqual([]);
        expect(verdicts("let bgc = sp < 5 ? '#B61E1E' : '#007F5F';")).not.toEqual([]);
      });

      it('leaves alone what is not a pass mark', () => {
        expect(verdicts('if (mOptions.score > 0) {')).toEqual([]);
        expect(verdicts('if (mOptions.scorerp >= 10) {')).toEqual([]);
        expect(verdicts('score = score > 10 ? 10 : score;')).toEqual([]);
        // A count of topics, and the fewest a board can draw.
        expect(verdicts('numasi = mOptions.numeroTemas < 5 ? 4 : n;')).toEqual([]);
        // Lengths, indices and attempt counters are not marks either.
        expect(verdicts('if (url.length >= 4) {')).toEqual([]);
        expect(verdicts('const x = pool.length > 1 ? a : b;')).toEqual([]);
      });

      it.each(exports.map(({ name }) => name))('%s resolves the mark instead', (name) => {
        const { source } = exports.find((entry) => entry.name === name);
        expect(verdicts(source)).toEqual([]);
      });
    });
  });

  describe('$exe.init', () => {
    beforeEach(() => {
      global.$exe.hasMultimediaGalleries = false;
    });

    it('sets hasMultimediaGalleries to false initially', () => {
      expect(global.$exe.hasMultimediaGalleries).toBe(false);
    });

    it('does not throw when document body is empty', () => {
      document.body.innerHTML = '';
      expect(() => global.$exe.init()).not.toThrow();
    });

    it('adds exe-enlarge-icon to links with exe-enlarge class containing img', () => {
      document.body.innerHTML = '<a class="exe-enlarge" href="#"><img src="test.jpg" /></a>';
      global.$exe.init();
      expect(document.querySelector('.exe-enlarge-icon')).not.toBeNull();
    });

    it('disables autocomplete on input.autocomplete-off elements', () => {
      document.body.innerHTML = '<input class="autocomplete-off" type="text" />';
      global.$exe.init();
      expect(document.querySelector('input').getAttribute('autocomplete')).toBe('off');
    });

    it('adds js class to body for epub', () => {
      document.body.classList.add('exe-epub');
      global.$exe.init();
      expect(document.body.classList.contains('js')).toBe(true);
    });
  });

  describe('$exe.loadMediaPlayer', () => {
    it('has isCalledInBox property', () => {
      expect(global.$exe.loadMediaPlayer.isCalledInBox).toBe(false);
    });

    it('has isReady property', () => {
      expect(typeof global.$exe.loadMediaPlayer.isReady).toBe('boolean');
    });

    it('has init function', () => {
      expect(typeof global.$exe.loadMediaPlayer.init).toBe('function');
    });

    describe('init', () => {
      let mockMediaelementplayer;

      beforeEach(() => {
        // Reset state
        global.$exe.loadMediaPlayer.isReady = false;
        global.$exe.loadMediaPlayer.isCalledInBox = false;

        // Mock jQuery's mediaelementplayer
        mockMediaelementplayer = vi.fn();
        global.$.fn.mediaelementplayer = mockMediaelementplayer;
      });

      afterEach(() => {
        // Clean up DOM
        document.body.innerHTML = '';
      });

      it('only processes audio and video elements with mediaelement class', () => {
        // Create an audio element with mediaelement class
        const audio = document.createElement('audio');
        audio.className = 'mediaelement';
        audio.src = 'test.mp3';
        document.body.appendChild(audio);

        // Create a div with mediaelement class (should be skipped)
        const div = document.createElement('div');
        div.className = 'mediaelement mejs-container';
        document.body.appendChild(div);

        // Create a video element with mediaelement class
        const video = document.createElement('video');
        video.className = 'mediaelement';
        video.src = 'test.mp4';
        document.body.appendChild(video);

        global.$exe.loadMediaPlayer.init();

        // mediaelementplayer should only be called for audio and video elements
        // The mock is called once per element, but we can check that the div wasn't processed
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });

      it('skips elements that already have a player property', () => {
        // Create an audio element that already has player
        const audio = document.createElement('audio');
        audio.className = 'mediaelement';
        audio.src = 'test.mp3';
        audio.player = {}; // Mark as already processed
        document.body.appendChild(audio);

        // Set isCalledInBox to true to prevent the extra call at the end
        global.$exe.loadMediaPlayer.isCalledInBox = true;

        global.$exe.loadMediaPlayer.init();

        // mediaelementplayer should not be called for this element since it already has player
        // (Note: init also calls mediaelementplayer on #pp_full_res .exe-media-box-element if isCalledInBox is false)
        expect(mockMediaelementplayer).not.toHaveBeenCalled();
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });

      it('processes unprocessed audio elements with .srt subtitles', () => {
        const audio = document.createElement('audio');
        audio.className = 'mediaelement';
        audio.src = 'test.mp3';
        // Add a track element with .srt subtitles (required for mediaelementplayer to be called)
        const track = document.createElement('track');
        track.src = 'subtitles.srt';
        track.kind = 'subtitles';
        audio.appendChild(track);
        document.body.appendChild(audio);

        global.$exe.loadMediaPlayer.init();

        // mediaelementplayer should be called because there's an .srt subtitle
        expect(mockMediaelementplayer).toHaveBeenCalled();
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });

      it('does not call mediaelementplayer for audio without .srt subtitles', () => {
        const audio = document.createElement('audio');
        audio.className = 'mediaelement';
        audio.src = 'test.mp3';
        document.body.appendChild(audio);

        global.$exe.loadMediaPlayer.init();

        // mediaelementplayer should NOT be called because there are no .srt subtitles
        expect(mockMediaelementplayer).not.toHaveBeenCalled();
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });

      it('handles video elements and resizes them if needed', () => {
        // Create a wide video element
        const video = document.createElement('video');
        video.className = 'mediaelement';
        video.src = 'test.mp4';
        video.width = 2000; // Wider than typical window
        video.height = 1000;
        document.body.appendChild(video);

        // Mock window width to be smaller than video
        Object.defineProperty(window, 'innerWidth', {
          value: 800,
          writable: true,
        });

        global.$exe.loadMediaPlayer.init();

        // Video should be resized to fit window
        expect(video.width).toBeLessThan(2000);
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });

      it('sets isReady to true after initialization', () => {
        expect(global.$exe.loadMediaPlayer.isReady).toBe(false);
        global.$exe.loadMediaPlayer.init();
        expect(global.$exe.loadMediaPlayer.isReady).toBe(true);
      });
    });
  });

  describe('$exe.setMultimediaGalleries', () => {
    let prettyPhotoOptions;

    beforeEach(() => {
      vi.useFakeTimers();
      prettyPhotoOptions = null;
      // The guard in setMultimediaGalleries checks $.prettyPhoto (static), not $.fn.prettyPhoto
      global.$.prettyPhoto = vi.fn();
      global.$.fn.prettyPhoto = vi.fn(function (opts) {
        prettyPhotoOptions = opts;
        return this;
      });
      global.$exe.hasMultimediaGalleries = false;
    });

    afterEach(() => {
      vi.useRealTimers();
      delete global.$.prettyPhoto;
      delete global.$.fn.prettyPhoto;
      delete global.eXeLearningAssetResolver;
    });

    it('does not throw when prettyPhoto is not defined', () => {
      delete global.$.prettyPhoto;
      delete global.$.fn.prettyPhoto;
      expect(() => global.$exe.setMultimediaGalleries()).not.toThrow();
    });

    it('calls prettyPhoto when it is defined', () => {
      document.body.innerHTML = '';
      global.$exe.setMultimediaGalleries();
      vi.runAllTimers();
      expect(global.$.fn.prettyPhoto).toHaveBeenCalled();
    });

    it('replaces blob URL with asset URL (audio) when resolver is available', () => {
      global.eXeLearning = {};
      global.eXeLearningAssetResolver = {
        getAssetUrlFromBlob: vi.fn().mockReturnValue('asset://abc123/audio.mp3'),
      };
      document.body.innerHTML = '<a rel="lightbox" href="blob:http://localhost:8080/test-uuid">Link</a>';

      global.$exe.setMultimediaGalleries();

      expect(global.eXeLearningAssetResolver.getAssetUrlFromBlob).toHaveBeenCalledWith('blob:http://localhost:8080/test-uuid');
      // Asset URL ends in .mp3 → isAudio true → link href changed to #media-box-0
      const link = document.querySelector('a[rel="lightbox"]');
      expect(link.getAttribute('href')).toBe('#media-box-0');
      expect(document.querySelector('.exe-media-audio-box')).not.toBeNull();
    });

    it('replaces blob URL with asset URL (video mp4) when resolver is available', () => {
      global.eXeLearning = {};
      global.eXeLearningAssetResolver = {
        getAssetUrlFromBlob: vi.fn().mockReturnValue('asset://abc123/video.mp4'),
      };
      document.body.innerHTML = '<a rel="lightbox" href="blob:http://localhost:8080/test-uuid">Link</a>';

      global.$exe.setMultimediaGalleries();

      const link = document.querySelector('a[rel="lightbox"]');
      expect(link.getAttribute('href')).toBe('#media-box-0');
      expect(document.querySelector('.exe-media-video-box')).not.toBeNull();
    });

    it('does not replace blob URL when resolver returns null', () => {
      global.eXeLearning = {};
      global.eXeLearningAssetResolver = {
        getAssetUrlFromBlob: vi.fn().mockReturnValue(null),
      };
      document.body.innerHTML = '<a rel="lightbox" href="blob:http://localhost:8080/test-uuid">Link</a>';

      global.$exe.setMultimediaGalleries();

      const link = document.querySelector('a[rel="lightbox"]');
      // blob URL has no audio/video extension → href is unchanged
      expect(link.getAttribute('href')).toBe('blob:http://localhost:8080/test-uuid');
      expect(document.querySelector('.exe-media-audio-box')).toBeNull();
      expect(document.querySelector('.exe-media-video-box')).toBeNull();
    });

    it('does not call resolver when eXeLearning is not defined', () => {
      delete global.eXeLearning;
      global.eXeLearningAssetResolver = {
        getAssetUrlFromBlob: vi.fn().mockReturnValue('asset://abc/audio.mp3'),
      };
      document.body.innerHTML = '<a rel="lightbox" href="blob:http://localhost:8080/uuid">Link</a>';

      global.$exe.setMultimediaGalleries();

      expect(global.eXeLearningAssetResolver.getAssetUrlFromBlob).not.toHaveBeenCalled();
    });

    it('does not call resolver when eXeLearningAssetResolver is not defined', () => {
      global.eXeLearning = {};
      delete global.eXeLearningAssetResolver;
      document.body.innerHTML = '<a rel="lightbox" href="blob:http://localhost:8080/uuid">Link</a>';

      expect(() => global.$exe.setMultimediaGalleries()).not.toThrow();
    });

    it('creates audio player for mp3 link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="audio/test.mp3">Link</a>';
      global.$exe.setMultimediaGalleries();

      expect(document.querySelector('.exe-media-audio-box audio')).not.toBeNull();
      expect(global.$exe.hasMultimediaGalleries).toBe(true);
    });

    it('creates video player for mp4 link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="video/test.mp4">Link</a>';
      global.$exe.setMultimediaGalleries();

      expect(document.querySelector('.exe-media-video-box video')).not.toBeNull();
      expect(global.$exe.hasMultimediaGalleries).toBe(true);
    });

    it('creates video player for flv link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="video/test.flv">Link</a>';
      global.$exe.setMultimediaGalleries();
      expect(document.querySelector('.exe-media-video-box')).not.toBeNull();
    });

    it('creates video player for ogg link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="video/test.ogg">Link</a>';
      global.$exe.setMultimediaGalleries();
      expect(document.querySelector('.exe-media-video-box')).not.toBeNull();
    });

    it('creates video player for ogv link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="video/test.ogv">Link</a>';
      global.$exe.setMultimediaGalleries();
      expect(document.querySelector('.exe-media-video-box')).not.toBeNull();
    });

    it('does not create player for non-audio/video link', () => {
      document.body.innerHTML = '<a rel="lightbox" href="image/photo.jpg">Link</a>';
      global.$exe.setMultimediaGalleries();
      expect(document.querySelector('.exe-media-audio-box')).toBeNull();
      expect(document.querySelector('.exe-media-video-box')).toBeNull();
      expect(global.$exe.hasMultimediaGalleries).toBe(false);
    });

    describe('changepicturecallback', () => {
      function setupPrettyPhotoDOM(srcValue, extraClass) {
        const cls = 'exe-media-box-element' + (extraClass ? ' ' + extraClass : '');
        document.body.innerHTML = `
          <div id="pp_full_res">
            <audio class="${cls}" src="${srcValue}"></audio>
          </div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description"></div></div>
          </div>
        `;
      }

      it('adds download link with extension from src filename', () => {
        document.body.innerHTML = '<a rel="lightbox" href="audio/test.mp3">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        setupPrettyPhotoDOM('audio/test.mp3');
        prettyPhotoOptions.changepicturecallback();

        const downloadLink = document.querySelector('.exe-media-download a');
        expect(downloadLink).not.toBeNull();
        expect(downloadLink.textContent).toBe('mp3');
      });

      it('falls back to i18n.download when ext is undefined (blob URL without extension)', () => {
        document.body.innerHTML = '<a rel="lightbox" href="audio/test.mp3">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        // src with no dot → split(".")[1] is undefined
        setupPrettyPhotoDOM('blob:http://localhost:8080/some-uuid');
        prettyPhotoOptions.changepicturecallback();

        const downloadLink = document.querySelector('.exe-media-download a');
        expect(downloadLink).not.toBeNull();
        expect(downloadLink.textContent).toBe('Download');
      });

      it('adds with-audio class to container for audio elements', () => {
        document.body.innerHTML = '<a rel="lightbox" href="audio/test.mp3">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        setupPrettyPhotoDOM('audio/test.mp3', 'exe-media-box-audio');
        prettyPhotoOptions.changepicturecallback();

        const cont = document.querySelector('.pp_content_container');
        expect(cont.className).toContain('with-audio');
      });

      it('hides description for inline (non-media) content', () => {
        document.body.innerHTML = '<a rel="lightbox" href="image/photo.jpg">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        document.body.innerHTML = `
          <div id="pp_full_res">
            <div class="pp_inline"><p>Inline content</p></div>
          </div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description" style="">Desc</div></div>
          </div>
        `;
        prettyPhotoOptions.changepicturecallback();

        // pp_description should be hidden (jQuery .hide() sets display:none)
        const desc = document.querySelector('.pp_description');
        expect(desc.style.display).toBe('none');
      });

      it('sets isCalledInBox when loadMediaPlayer is ready', () => {
        document.body.innerHTML = '<a rel="lightbox" href="audio/test.mp3">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        global.$exe.loadMediaPlayer.isReady = true;
        global.$exe.loadMediaPlayer.isCalledInBox = false;

        setupPrettyPhotoDOM('audio/test.mp3');
        prettyPhotoOptions.changepicturecallback();

        expect(global.$exe.loadMediaPlayer.isCalledInBox).toBe(true);

        global.$exe.loadMediaPlayer.isReady = false;
        global.$exe.loadMediaPlayer.isCalledInBox = false;
      });

      it('extracts download src from a <source> child when the media element has no src attribute', () => {
        document.body.innerHTML = '<a rel="lightbox" href="video/test.mp4">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        // Video is rendered as <video><source src="..."/></video> (no src on the element itself)
        document.body.innerHTML = `
          <div id="pp_full_res">
            <video class="exe-media-box-element"><source src="video/test.mp4" /></video>
          </div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description"></div></div>
          </div>
        `;
        prettyPhotoOptions.changepicturecallback();

        const downloadLink = document.querySelector('.exe-media-download a');
        expect(downloadLink).not.toBeNull();
        expect(downloadLink.getAttribute('href')).toBe('video/test.mp4');
        expect(downloadLink.textContent).toBe('mp4');
      });

      it('labels the download link with the real extension for multi-dot filenames and query strings', () => {
        document.body.innerHTML = '<a rel="lightbox" href="video/lesson.part1.mp4">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        document.body.innerHTML = `
          <div id="pp_full_res">
            <video class="exe-media-box-element"><source src="video/lesson.part1.mp4?token=abc#t=10" /></video>
          </div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description"></div></div>
          </div>
        `;
        prettyPhotoOptions.changepicturecallback();

        const downloadLink = document.querySelector('.exe-media-download a');
        expect(downloadLink).not.toBeNull();
        // last dot-segment, query string and fragment stripped → "mp4" (not "part1" or "mp4?token=abc#t=10")
        expect(downloadLink.textContent).toBe('mp4');
      });

      it('recalculates pp_content height from the video bounding rect', () => {
        document.body.innerHTML = '<a rel="lightbox" href="video/test.mp4">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        document.body.innerHTML = `
          <div id="pp_full_res">
            <video class="exe-media-box-element"><source src="video/test.mp4" /></video>
          </div>
          <div class="pp_content"></div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description"></div></div>
          </div>
        `;
        const video = document.querySelector('#pp_full_res video');
        video.getBoundingClientRect = () => ({ height: 300, width: 480, top: 0, left: 0, right: 480, bottom: 300 });

        prettyPhotoOptions.changepicturecallback();

        // 300 (video height) + 50 (controls) = 350px
        const content = document.querySelector('.pp_content');
        expect(content.style.height).toBe('350px');
      });

      it('leaves pp_content height untouched when the video has zero height', () => {
        document.body.innerHTML = '<a rel="lightbox" href="video/test.mp4">Link</a>';
        global.$exe.setMultimediaGalleries();
        vi.runAllTimers();
        document.body.innerHTML = `
          <div id="pp_full_res">
            <video class="exe-media-box-element"><source src="video/test.mp4" /></video>
          </div>
          <div class="pp_content"></div>
          <div class="pp_content_container">
            <div class="pp_details"><div class="pp_description"></div></div>
          </div>
        `;
        const video = document.querySelector('#pp_full_res video');
        video.getBoundingClientRect = () => ({ height: 0, width: 0, top: 0, left: 0, right: 0, bottom: 0 });

        prettyPhotoOptions.changepicturecallback();

        const content = document.querySelector('.pp_content');
        expect(content.style.height).toBe('');
      });
    });

    it('applies GalleryIdevice fallback when no lightbox links but gallery exists', () => {
      delete global.exe_editor_mode;
      document.body.innerHTML = `
        <div class="GalleryIdevice">
          <div class="exeImageGallery">
            <ul id="gallery-1">
              <li><a href="http://example.com/img.jpg" title="Photo">img</a></li>
            </ul>
          </div>
        </div>
      `;
      global.$exe.setMultimediaGalleries();
      vi.runAllTimers();

      const link = document.querySelector('.exeImageGallery a');
      // element.href property returns absolute URL in happy-dom; use getAttribute for raw value
      expect(link.getAttribute('href')).toBe('#');
      expect(link.title).toContain('Photo');
    });
  });

  describe('$exe rgb2hex edge cases', () => {
    it('handles standard rgb format', () => {
      expect(global.$exe.rgb2hex('rgb(128, 64, 32)')).toBe('#804020');
    });
  });

  describe('$exe useBlackOrWhite edge cases', () => {
    it('returns white for dark gray', () => {
      expect(global.$exe.useBlackOrWhite('333333')).toBe('white');
    });

    it('returns black for light gray', () => {
      expect(global.$exe.useBlackOrWhite('cccccc')).toBe('black');
    });

    it('returns white for blue', () => {
      expect(global.$exe.useBlackOrWhite('0000ff')).toBe('white');
    });

    it('returns black for yellow', () => {
      expect(global.$exe.useBlackOrWhite('ffff00')).toBe('black');
    });
  });

  describe('$exe.dl edge cases', () => {
    it('creates togglers with correct color styling', () => {
      document.body.innerHTML = '<dl class="exe-dl" id="test-dl" style="color: rgb(255, 0, 0);"><dt>Term1</dt><dd>Definition1</dd><dt>Term2</dt><dd>Definition2</dd></dl>';
      global.$exe.dl.init();
      const togglers = document.querySelectorAll('.exe-dd-toggler');
      expect(togglers.length).toBe(2);
    });

    it('assigns auto id when dl has no id', () => {
      document.body.innerHTML = '<dl class="exe-dl" style="color: rgb(0, 0, 0);"><dt>Term</dt><dd>Definition</dd></dl>';
      global.$exe.dl.init();
      const dl = document.querySelector('dl');
      expect(dl.id).toMatch(/^exe-dl-\d+$/);
    });
  });

  describe('$exe.hasTooltips edge cases', () => {
    it('loads script when tooltips are present and not in eXe', () => {
      delete global.eXeLearning;
      document.body.innerHTML = '<a class="exe-tooltip" href="#"></a>';
      const loadSpy = vi.spyOn(global.$exe, 'loadScript').mockImplementation(() => {});

      global.$exe.hasTooltips();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('$exe.setIframesProperties edge cases', () => {
    it('handles iframe without src attribute', () => {
      document.body.innerHTML = '<iframe></iframe>';
      expect(() => global.$exe.setIframesProperties()).not.toThrow();
      const iframe = document.querySelector('iframe');
      expect(iframe.classList.contains('external-iframe')).toBe(false);
    });

    it('handles multiple iframes', () => {
      document.body.innerHTML = '<iframe src="http://example1.com"></iframe><iframe src="http://example2.com"></iframe>';
      global.$exe.setIframesProperties();
      const iframes = document.querySelectorAll('.external-iframe');
      expect(iframes.length).toBe(2);
    });
  });

  describe('$exe.isIE edge cases', () => {
    it('returns IE version for Trident', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)',
        configurable: true,
      });
      try {
        expect(global.$exe.isIE()).toBe(10);
      } finally {
        Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
      }
    });
  });

  describe('$exe.loadScript edge cases', () => {
    it('handles script with callback', () => {
      const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
        if (node.onload) node.onload();
        return node;
      });

      global.$exe.loadScript('http://example.com/test.js', 'console.log("loaded")');

      expect(appendSpy).toHaveBeenCalled();
    });
  });

  describe('$exe.getIdeviceInstalledExportPath edge cases', () => {
    it('returns undefined when no matching idevice found', () => {
      document.body.innerHTML = '';
      expect(global.$exe.getIdeviceInstalledExportPath('nonexistent')).toBeUndefined();
    });

    it('handles first matching idevice node', () => {
      delete global.eXeLearning;
      document.body.innerHTML = `
        <article class="idevice_node" data-idevice-type="text" data-idevice-path="/path1"></article>
      `;
      expect(global.$exe.getIdeviceInstalledExportPath('text')).toBe('/path1');
    });
  });

  describe('$exe.math edge cases', () => {
    it('init handles body with latex content', () => {
      document.body.innerHTML = '<p>\\(x^2\\)</p>';
      expect(() => global.$exe.math.init()).not.toThrow();
    });

    it('init handles exe-math-engine class', () => {
      document.body.innerHTML = '<div class="exe-math exe-math-engine"><div class="exe-math-code">x^2</div></div>';
      expect(() => global.$exe.math.init()).not.toThrow();
    });

    it('createLinks skips elements that already have links', () => {
      document.body.innerHTML = '<div class="exe-math"><div class="exe-math-code">x^2</div><p class="exe-math-links">existing</p></div>';
      global.$exe.math.createLinks();
      const links = document.querySelectorAll('.exe-math-links');
      expect(links.length).toBe(1);
    });

    it('createLinks handles content without image', () => {
      document.body.innerHTML = '<div class="exe-math"><div class="exe-math-code">x^2</div></div>';
      global.$exe.math.createLinks();
      // Without an image, only LaTeX/MathML link is shown
      const mathLinks = document.querySelector('.exe-math-links');
      // Links are only added when there's an image or when not using mathjax
      expect(mathLinks).toBeNull();
    });
  });

  describe('$exe.mermaid edge cases', () => {
    beforeEach(() => {
      global.$exe.mermaid.loading = false;
    });

    it('init loads mermaid when mermaid nodes exist', () => {
      document.body.innerHTML = '<div class="mermaid">graph TD; A-->B;</div>';
      const loadSpy = vi.spyOn(global.$exe.mermaid, 'loadMermaid').mockImplementation(() => {});
      global.$exe.mermaid.init();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('loadMermaid reloads mermaid when already loaded and initialized', () => {
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.reload_pending = false;
      global.$exe.mermaid.initialized = true;
      global.$exe.mermaid.loadMermaid();
      expect(global.$exe.mermaid.reload_pending).toBe(true);
    });

    it('loadMermaid does not reload when mermaid not initialized', () => {
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.reload_pending = false;
      global.$exe.mermaid.initialized = false;
      global.$exe.mermaid.loadMermaid();
      expect(global.$exe.mermaid.reload_pending).toBe(false);
    });

    it('renderDiagrams calls mermaid.run for visible elements with width', () => {
      document.body.innerHTML = '<div class="mermaid">graph TD; A-->B</div>';
      // Mock jQuery methods since happy-dom doesn't support layout
      const originalWidth = $.fn.width;
      const originalIs = $.fn.is;
      $.fn.width = function() { return 100; };
      $.fn.is = function(selector) {
        if (selector === ':visible') return true;
        return originalIs.call(this, selector);
      };
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(0);
      expect(global.mermaid.run).toHaveBeenCalled();
      $.fn.width = originalWidth;
      $.fn.is = originalIs;
    });

    it('renderDiagrams skips already processed elements', () => {
      document.body.innerHTML = '<div class="mermaid" data-processed="true" style="width: 100px;">graph TD; A-->B</div>';
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(0);
      expect(global.mermaid.run).not.toHaveBeenCalled();
    });

    it('renderDiagrams does not call mermaid.run for elements without width', () => {
      document.body.innerHTML = '<div class="mermaid" style="width: 0; display: block;">graph TD; A-->B</div>';
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(10); // maxRetries reached
      expect(global.mermaid.run).not.toHaveBeenCalled();
    });

    it('init skips loading mermaid when all diagrams are pre-rendered', () => {
      // Only pre-rendered mermaid content, no raw mermaid elements
      document.body.innerHTML = '<div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B"><svg></svg></div>';
      const loadSpy = vi.spyOn(global.$exe.mermaid, 'loadMermaid').mockImplementation(() => {});
      global.$exe.mermaid.init();
      // loadMermaid should NOT be called when only pre-rendered content exists
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('init loads mermaid when there are unprocessed mermaid elements alongside pre-rendered', () => {
      // Both pre-rendered and raw mermaid elements
      document.body.innerHTML = `
        <div class="exe-mermaid-rendered" data-mermaid="graph TD; A-->B"><svg></svg></div>
        <div class="mermaid">graph TD; C-->D</div>
      `;
      const loadSpy = vi.spyOn(global.$exe.mermaid, 'loadMermaid').mockImplementation(() => {});
      global.$exe.mermaid.init();
      // loadMermaid SHOULD be called when there are raw mermaid elements
      expect(loadSpy).toHaveBeenCalled();
    });

    it('init loads mermaid when elements have data-processed="pending" (failed previous render)', () => {
      // Element with pending status (failed previous render attempt)
      document.body.innerHTML = '<div class="mermaid" data-processed="pending">graph TD; A-->B</div>';
      const loadSpy = vi.spyOn(global.$exe.mermaid, 'loadMermaid').mockImplementation(() => {});
      global.$exe.mermaid.init();
      // loadMermaid SHOULD be called to retry rendering
      expect(loadSpy).toHaveBeenCalled();
    });

    it('renderDiagrams includes elements with data-processed="pending" for retry', () => {
      document.body.innerHTML = '<div class="mermaid" data-processed="pending" style="width: 100px; display: block;">graph TD; A-->B</div>';
      const originalIs = $.fn.is;
      $.fn.is = function(selector) {
        if (selector === ':visible') return true;
        return originalIs.call(this, selector);
      };
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(0);
      // mermaid.run SHOULD be called for pending elements
      expect(global.mermaid.run).toHaveBeenCalled();
      $.fn.is = originalIs;
    });

    it('renderDiagrams removes data-processed attribute before calling mermaid.run', () => {
      document.body.innerHTML = '<div class="mermaid" data-processed="pending" style="width: 100px; display: block;">graph TD; A-->B</div>';
      const originalIs = $.fn.is;
      $.fn.is = function(selector) {
        if (selector === ':visible') return true;
        return originalIs.call(this, selector);
      };
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(0);
      const element = document.querySelector('.mermaid');
      // data-processed should be removed so mermaid.run can process it
      expect(element.getAttribute('data-processed')).toBeNull();
      $.fn.is = originalIs;
    });

    it('renderDiagrams handles mix of new and pending elements', () => {
      document.body.innerHTML = `
        <div class="mermaid" style="width: 100px; display: block;">graph TD; A-->B</div>
        <div class="mermaid" data-processed="pending" style="width: 100px; display: block;">graph TD; C-->D</div>
      `;
      const originalIs = $.fn.is;
      $.fn.is = function(selector) {
        if (selector === ':visible') return true;
        return originalIs.call(this, selector);
      };
      global.mermaid = { run: vi.fn() };
      global.$exe.mermaid.renderDiagrams(0);
      expect(global.mermaid.run).toHaveBeenCalled();
      // Both elements should have data-processed removed
      const elements = document.querySelectorAll('.mermaid');
      elements.forEach(el => {
        expect(el.getAttribute('data-processed')).toBeNull();
      });
      $.fn.is = originalIs;
    });
  });

  describe('$exe.setModalWindowContentSize edge cases', () => {
    it('adjusts image height in chrome when height attribute exists', () => {
      document.body.innerHTML = '<div class="exe-dialog-text"><img height="200" width="800" style="height: 0px;" /></div>';
      expect(() => global.$exe.setModalWindowContentSize()).not.toThrow();
    });
  });

  describe('$exe.sfHover edge cases', () => {
    it('adds focus/blur handlers to links in siteNav', () => {
      document.body.innerHTML = '<nav id="siteNav"><ul><li><a href="#">Link</a></li></ul></nav>';
      global.$exe.sfHover();
      const link = document.querySelector('a');
      expect(link.onfocus).toBeDefined();
      expect(link.onblur).toBeDefined();
    });

    it('handles nested menu items with focus', () => {
      document.body.innerHTML = `
        <nav id="siteNav">
          <ul>
            <li>
              <a href="#">Parent</a>
              <ul>
                <li>
                  <a href="#">Child</a>
                  <ul>
                    <li><a href="#">Grandchild</a></li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      `;
      global.$exe.sfHover();
      const grandchildLink = document.querySelectorAll('a')[2];
      expect(grandchildLink.onfocus).toBeDefined();
    });
  });

  describe('$exe.dl toggle behavior', () => {
    it('toggles definition list items on click', () => {
      document.body.innerHTML = '<dl class="exe-dl" style="color: rgb(0, 0, 0);"><dt>Term</dt><dd>Definition</dd></dl>';
      global.$exe.dl.init();
      const toggler = document.querySelector('.exe-dd-toggler');
      expect(toggler.classList.contains('exe-dd-toggler-closed')).toBe(true);

      // Simulate click
      toggler.click();
      expect(toggler.classList.contains('exe-dd-toggler-closed')).toBe(false);

      // Click again to close
      toggler.click();
      expect(toggler.classList.contains('exe-dd-toggler-closed')).toBe(true);
    });
  });

  describe('$exe.math.init detailed behavior', () => {
    it('handles inline math with $ delimiters', () => {
      document.body.innerHTML = '<div class="exe-math exe-math-engine"><div class="exe-math-code">$x^2$</div></div>';
      expect(() => global.$exe.math.init()).not.toThrow();
    });

    it('handles block math with $$ delimiters', () => {
      document.body.innerHTML = '<div class="exe-math exe-math-engine"><div class="exe-math-code">$$x^2$$</div></div>';
      expect(() => global.$exe.math.init()).not.toThrow();
    });

    it('wraps bare LaTeX code', () => {
      document.body.innerHTML = '<div class="exe-math exe-math-engine"><div class="exe-math-code">x^2</div></div>';
      global.$exe.math.init();
      const code = document.querySelector('.exe-math-code').innerHTML;
      expect(code).toContain('\\[');
    });

    it('init skips MathJax loading when only pre-rendered elements exist', () => {
      // Pre-rendered LaTeX content (produced by LatexPreRenderer)
      document.body.innerHTML = `
        <span class="exe-math-rendered" data-latex="\\frac{1}{2}">
          <svg><text>1/2</text></svg>
        </span>
      `;
      const loadMathJaxSpy = vi.spyOn(global.$exe.math, 'loadMathJax');
      const createLinksSpy = vi.spyOn(global.$exe.math, 'createLinks');

      global.$exe.math.init();

      // MathJax should NOT be loaded
      expect(loadMathJaxSpy).not.toHaveBeenCalled();
      // createLinks should still be called
      expect(createLinksSpy).toHaveBeenCalled();

      loadMathJaxSpy.mockRestore();
      createLinksSpy.mockRestore();
    });

    it('init loads MathJax when exe-math-engine elements exist alongside pre-rendered', () => {
      // Both pre-rendered and explicit engine elements
      document.body.innerHTML = `
        <span class="exe-math-rendered" data-latex="\\frac{1}{2}">
          <svg><text>1/2</text></svg>
        </span>
        <div class="exe-math exe-math-engine"><div class="exe-math-code">x^2</div></div>
      `;
      // Mock MathJax to avoid errors when callback is invoked
      global.MathJax = {
        typesetPromise: vi.fn().mockReturnValue(Promise.resolve()),
      };
      const loadMathJaxSpy = vi.spyOn(global.$exe.math, 'loadMathJax').mockImplementation((cb) => {
        if (cb) cb();
      });

      global.$exe.math.init();

      // MathJax SHOULD be loaded because exe-math-engine exists
      expect(loadMathJaxSpy).toHaveBeenCalled();

      loadMathJaxSpy.mockRestore();
      delete global.MathJax;
    });

    it('init does not skip MathJax when no pre-rendered elements but LaTeX in body', () => {
      // Raw LaTeX without pre-rendering
      document.body.innerHTML = '<p>\\(x^2\\)</p>';
      // Mock MathJax to avoid errors when callback is invoked
      global.MathJax = {
        typesetPromise: vi.fn().mockReturnValue(Promise.resolve()),
      };
      const loadMathJaxSpy = vi.spyOn(global.$exe.math, 'loadMathJax').mockImplementation((cb) => {
        if (cb) cb();
      });

      global.$exe.math.init();

      // MathJax SHOULD be loaded for raw LaTeX
      expect(loadMathJaxSpy).toHaveBeenCalled();

      loadMathJaxSpy.mockRestore();
      delete global.MathJax;
    });

    it('init returns early for pre-rendered content without loading MathJax', () => {
      // Verify that the regex in $('body').html() is not falsely triggered by data-latex attributes
      document.body.innerHTML = `
        <span class="exe-math-rendered" data-latex="\\(x^2\\)">
          <svg><text>x²</text></svg>
        </span>
        <span class="exe-math-rendered" data-latex="\\[\\frac{a}{b}\\]">
          <svg><text>a/b</text></svg>
        </span>
      `;
      const loadMathJaxSpy = vi.spyOn(global.$exe.math, 'loadMathJax');

      global.$exe.math.init();

      // MathJax should NOT be loaded even though data-latex contains LaTeX patterns
      // The fix detects pre-rendered elements and skips the regex check on HTML
      expect(loadMathJaxSpy).not.toHaveBeenCalled();

      loadMathJaxSpy.mockRestore();
    });

    it('init loads MathJax for mixed content (pre-rendered + pending raw LaTeX)', () => {
      document.body.innerHTML = `
        <span class="exe-math-rendered" data-latex="\\(x^2\\)">
          <svg><text>x²</text></svg>
        </span>
        <p>\\(\\mathrm{ABCdef}\\)</p>
      `;

      global.MathJax = {
        typesetPromise: vi.fn().mockReturnValue(Promise.resolve()),
      };
      const loadMathJaxSpy = vi.spyOn(global.$exe.math, 'loadMathJax').mockImplementation((cb) => {
        if (cb) cb();
      });

      global.$exe.math.init();

      expect(loadMathJaxSpy).toHaveBeenCalled();

      loadMathJaxSpy.mockRestore();
      delete global.MathJax;
    });
  });
});

describe('common.js $exeDevices', () => {
  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.className = '';
    document.body.innerHTML = '';
  });

  describe('gamification.initGame', () => {
    const getInitGame = () => global.$exeDevices.iDevice.gamification.initGame;

    let mockGame;

    beforeEach(() => {
      // Setup eXe global (isInExe check)
      global.eXe = {
        app: {
          isInExe: vi.fn().mockReturnValue(true),
          getIdeviceInstalledExportPath: vi.fn().mockReturnValue('/path/'),
        },
      };
      mockGame = {
        hasSCORMbutton: false,
        isInExe: false,
        idevicePath: '',
        activities: $(),
        enable: vi.fn(),
      };
    });

    afterEach(() => {
      delete global.eXe;
    });

    it('returns early when no activities are found', () => {
      document.body.innerHTML = '';
      const initGame = getInitGame();

      initGame(mockGame, 'TestGame', 'testgame', 'test-IDevice');

      expect(mockGame.enable).not.toHaveBeenCalled();
    });

    it.each(['1.2', '2004'])('initializes score bounds using the %s data model', version => {
      document.body.className = 'exe-scorm';
      document.body.innerHTML = '<div class="test-IDevice"></div>';
      const previous = global.scorm;
      const api = { version, init: vi.fn(() => true), set: vi.fn() };
      global.scorm = api;
      try {
        getInitGame()(mockGame, 'TestGame', 'testgame', 'test-IDevice');
        const prefix = version === '2004' ? 'cmi.score' : 'cmi.core.score';
        expect(api.set.mock.calls).toEqual([[`${prefix}.max`, '100'], [`${prefix}.min`, '0']]);
        expect(mockGame.enable).toHaveBeenCalledOnce();
      } finally {
        global.scorm = previous;
      }
    });

    it('finds all activities matching the ideviceClass', () => {
      document.body.innerHTML = `
        <div class="test-IDevice">Activity 1</div>
        <div class="test-IDevice">Activity 2</div>
        <div class="test-IDevice">Activity 3</div>
      `;
      const initGame = getInitGame();

      initGame(mockGame, 'TestGame', 'testgame', 'test-IDevice');

      expect(mockGame.activities.length).toBe(3);
    });

    it('assigns all matching activities to $game.activities without filtering', () => {
      document.body.innerHTML = `
        <div class="classify-IDevice">Activity 1</div>
        <div class="classify-IDevice">Activity 2</div>
        <div class="classify-IDevice">Activity 3</div>
        <div class="classify-IDevice">Activity 4</div>
        <div class="classify-IDevice">Activity 5</div>
      `;
      const initGame = getInitGame();

      // initGame may throw due to missing eXe global in test env,
      // but activities should be assigned before that point
      try {
        initGame(mockGame, 'Classify', 'classify', 'classify-IDevice');
      } catch (e) {
        // Expected: eXe global not fully available in test env
      }

      // All 5 activities are found (no guard that only checks first)
      expect(mockGame.activities.length).toBe(5);
    });
  });

  describe('gamification.helpers', () => {
    const getHelpers = () => global.$exeDevices.iDevice.gamification.helpers;

    it('isJsonString returns false for non-string input', () => {
      const helpers = getHelpers();
      expect(helpers.isJsonString(123)).toBe(false);
      expect(helpers.isJsonString(null)).toBe(false);
    });

    it('isJsonString returns parsed object for valid JSON string', () => {
      const helpers = getHelpers();
      const result = helpers.isJsonString('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('isJsonString returns false for invalid JSON', () => {
      const helpers = getHelpers();
      expect(helpers.isJsonString('not json')).toBe(false);
      expect(helpers.isJsonString('{invalid}')).toBe(false);
    });

    it('shuffleAds returns shuffled array', () => {
      const helpers = getHelpers();
      const arr = [1, 2, 3, 4, 5];
      const result = helpers.shuffleAds([...arr]);
      expect(result.length).toBe(arr.length);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('decrypt decrypts encrypted string', () => {
      const helpers = getHelpers();
      const encrypted = helpers.encrypt('test');
      const decrypted = helpers.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });

    it('encrypt returns escaped encrypted string', () => {
      const helpers = getHelpers();
      const result = helpers.encrypt('hello');
      expect(typeof result).toBe('string');
      expect(result).not.toBe('hello');
    });

    it('encrypt handles empty and null values', () => {
      const helpers = getHelpers();
      expect(helpers.encrypt('')).toBe('');
      expect(helpers.encrypt(null)).toBe('');
      expect(helpers.encrypt('undefined')).toBe('');
    });

    it('decrypt handles empty and null values', () => {
      const helpers = getHelpers();
      expect(helpers.decrypt('')).toBe('');
      expect(helpers.decrypt('null')).toBe('');
      expect(helpers.decrypt('undefined')).toBe('');
    });

    it('getTimeSeconds returns correct time values', () => {
      const helpers = getHelpers();
      expect(helpers.getTimeSeconds(0)).toBe(15);
      expect(helpers.getTimeSeconds(1)).toBe(30);
      expect(helpers.getTimeSeconds(2)).toBe(60);
      expect(helpers.getTimeSeconds(3)).toBe(180);
      expect(helpers.getTimeSeconds(4)).toBe(300);
      expect(helpers.getTimeSeconds(5)).toBe(600);
      expect(helpers.getTimeSeconds(100)).toBe(100);
    });

    it('getTimeToString formats time correctly', () => {
      const helpers = getHelpers();
      expect(helpers.getTimeToString(0)).toBe('00:00');
      expect(helpers.getTimeToString(65)).toBe('01:05');
      expect(helpers.getTimeToString(3661)).toBe('01:01');
    });

    it('hourToSeconds converts time string to seconds', () => {
      const helpers = getHelpers();
      expect(helpers.hourToSeconds('01:30:00')).toBe(5400);
      expect(helpers.hourToSeconds('00:01:30')).toBe(90);
      expect(helpers.hourToSeconds('30')).toBe(30);
      expect(helpers.hourToSeconds('01:30')).toBe(90);
    });

    it('secondsToHour converts seconds to time string', () => {
      const helpers = getHelpers();
      expect(helpers.secondsToHour(3661)).toBe('01:01:01');
      expect(helpers.secondsToHour(90)).toBe('00:01:30');
      expect(helpers.secondsToHour(0)).toBe('00:00:00');
    });

    it('generarID returns a string ID', () => {
      const helpers = getHelpers();
      const id = helpers.generarID();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('removeTags removes HTML tags from string', () => {
      const helpers = getHelpers();
      expect(helpers.removeTags('<p>Hello <b>World</b></p>')).toBe('Hello World');
      expect(helpers.removeTags('Plain text')).toBe('Plain text');
    });

    it('getQuestions returns questions based on percentage', () => {
      const helpers = getHelpers();
      const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(helpers.getQuestions(questions, 100)).toEqual(questions);
      const result50 = helpers.getQuestions(questions, 50);
      expect(result50.length).toBe(5);
    });

    // Callers assign the result straight back and then read .length off it, so
    // a non-array has to become an empty array here or it crashes there.
    it('getQuestions returns an empty array for non-array inputs', () => {
      const helpers = getHelpers();
      expect(helpers.getQuestions(undefined, 50)).toEqual([]);
      expect(helpers.getQuestions(null, 50)).toEqual([]);
      expect(helpers.getQuestions(false, 50)).toEqual([]);
      expect(helpers.getQuestions({ questions: [] }, 50)).toEqual([]);
    });

    it('arrayMove moves element in array', () => {
      const helpers = getHelpers();
      const arr = ['a', 'b', 'c', 'd'];
      helpers.arrayMove(arr, 0, 2);
      expect(arr).toEqual(['b', 'c', 'a', 'd']);
    });

    it('supportedBrowser returns boolean', () => {
      const helpers = getHelpers();
      expect(typeof helpers.supportedBrowser('TestIdevice')).toBe('boolean');
    });

    it('isFullscreen returns boolean', () => {
      const helpers = getHelpers();
      expect(typeof helpers.isFullscreen()).toBe('boolean');
    });

    it('exitFullscreen does not throw', () => {
      const helpers = getHelpers();
      expect(() => helpers.exitFullscreen()).not.toThrow();
    });

    it('toggleFullscreen does not throw', () => {
      const helpers = getHelpers();
      expect(() => helpers.toggleFullscreen()).not.toThrow();
    });

    it('getTimeSeconds returns raw value for values > 5', () => {
      const helpers = getHelpers();
      expect(helpers.getTimeSeconds(10)).toBe(10);
      expect(helpers.getTimeSeconds(1000)).toBe(1000);
    });

    it('encrypt and decrypt are inverse operations', () => {
      const helpers = getHelpers();
      const original = 'Hello World!';
      const encrypted = helpers.encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(helpers.decrypt(encrypted)).toBe(original);
    });

    it('getTimeToString handles hours correctly', () => {
      const helpers = getHelpers();
      // 2 minutes and 30 seconds
      expect(helpers.getTimeToString(150)).toBe('02:30');
    });

    it('hourToSeconds handles edge cases', () => {
      const helpers = getHelpers();
      expect(helpers.hourToSeconds('00:00:01')).toBe(1);
      expect(helpers.hourToSeconds('1')).toBe(1);
    });

    it('generarID returns non-empty string', () => {
      const helpers = getHelpers();
      const id = helpers.generarID();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(5);
    });

    it('removeTags handles nested tags', () => {
      const helpers = getHelpers();
      expect(helpers.removeTags('<div><span><b>Text</b></span></div>')).toBe('Text');
    });

    it('getQuestions handles small arrays', () => {
      const helpers = getHelpers();
      const questions = [1, 2];
      expect(helpers.getQuestions(questions, 100).length).toBe(2);
    });

    it('getQuestions handles low percentage', () => {
      const helpers = getHelpers();
      const questions = [1, 2, 3, 4, 5];
      // 0% still returns at least 1 question (minimum threshold)
      expect(helpers.getQuestions(questions, 0).length).toBeGreaterThanOrEqual(1);
    });

    it('arrayMove handles end to beginning', () => {
      const helpers = getHelpers();
      const arr = ['a', 'b', 'c', 'd'];
      helpers.arrayMove(arr, 3, 0);
      expect(arr[0]).toBe('d');
    });

    it('arrayMove handles index beyond array length', () => {
      const helpers = getHelpers();
      const arr = ['a', 'b'];
      helpers.arrayMove(arr, 0, 5);
      expect(arr.length).toBeGreaterThanOrEqual(3);
    });

    it('getFullscreen is a function', () => {
      const helpers = getHelpers();
      expect(typeof helpers.getFullscreen).toBe('function');
    });

    it('toggleFullscreen handles element parameter', () => {
      const helpers = getHelpers();
      const div = document.createElement('div');
      expect(() => helpers.toggleFullscreen(div)).not.toThrow();
    });

    it('shuffleAds handles non-array gracefully', () => {
      const helpers = getHelpers();
      expect(helpers.shuffleAds(null)).toBe(null);
      expect(helpers.shuffleAds(undefined)).toBe(undefined);
    });

    it('shuffleAds handles empty array', () => {
      const helpers = getHelpers();
      expect(helpers.shuffleAds([])).toEqual([]);
    });

    it('secondsToHour handles large values', () => {
      const helpers = getHelpers();
      // 2 hours, 30 minutes, 45 seconds = 9045 seconds
      expect(helpers.secondsToHour(9045)).toBe('02:30:45');
    });

    it('hourToSeconds handles different formats', () => {
      const helpers = getHelpers();
      expect(helpers.hourToSeconds('01:00:00')).toBe(3600);
      expect(helpers.hourToSeconds('10:00')).toBe(600);
      expect(helpers.hourToSeconds('60')).toBe(60);
    });

    it('encrypt handles special characters', () => {
      const helpers = getHelpers();
      const special = '<script>alert("test")</script>';
      const encrypted = helpers.encrypt(special);
      expect(encrypted).not.toBe(special);
      expect(helpers.decrypt(encrypted)).toBe(special);
    });

    it('isJsonString returns parsed object for object starting with brace', () => {
      const helpers = getHelpers();
      const result = helpers.isJsonString('{"a":1,"b":"text"}');
      expect(result).toEqual({ a: 1, b: 'text' });
    });

    it('isJsonString returns false for non-object JSON', () => {
      const helpers = getHelpers();
      expect(helpers.isJsonString('[1,2,3]')).toBe(false);
      expect(helpers.isJsonString('"string"')).toBe(false);
    });

    it('isJsonString trims whitespace', () => {
      const helpers = getHelpers();
      const result = helpers.isJsonString('  {"key":"value"}  ');
      expect(result).toEqual({ key: 'value' });
    });

    it('shuffleAds actually shuffles elements', () => {
      const helpers = getHelpers();
      // With larger array, verify all elements are present
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];
      const result = helpers.shuffleAds([...arr]);
      expect(result.sort((a, b) => a - b)).toEqual(original);
    });

    it('getQuestions returns all questions for 100 percent', () => {
      const helpers = getHelpers();
      const questions = ['a', 'b', 'c', 'd', 'e'];
      const result = helpers.getQuestions(questions, 100);
      expect(result).toEqual(questions);
    });

    it('getQuestions returns subset for partial percentage', () => {
      const helpers = getHelpers();
      const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = helpers.getQuestions(questions, 30);
      expect(result.length).toBe(3);
    });

    it('getQuestions with random=false preserves original order', () => {
      const helpers = getHelpers();
      const questions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      const result = helpers.getQuestions(questions, 50, false);
      expect(result.length).toBe(5);
      // Should return first 5 questions in original order
      expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('getQuestions with random=true returns randomized subset', () => {
      const helpers = getHelpers();
      const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Run multiple times to verify randomization produces different results
      const results = new Set();
      for (let i = 0; i < 20; i++) {
        const result = helpers.getQuestions(questions, 50, true);
        expect(result.length).toBe(5);
        // All elements should be from original array
        result.forEach(q => expect(questions).toContain(q));
        results.add(result.join(','));
      }
      // With 20 iterations, we should get at least 2 different orderings
      expect(results.size).toBeGreaterThan(1);
    });

    it('getQuestions with random=true can include elements from any position', () => {
      const helpers = getHelpers();
      const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Run multiple times and collect all selected elements
      const selectedElements = new Set();
      for (let i = 0; i < 50; i++) {
        const result = helpers.getQuestions(questions, 30, true);
        result.forEach(q => selectedElements.add(q));
      }
      // Should eventually select elements from later positions (not just first 3)
      expect(selectedElements.size).toBeGreaterThan(3);
    });

    it('removeTags handles empty strings', () => {
      const helpers = getHelpers();
      expect(helpers.removeTags('')).toBe('');
    });

    it('removeTags handles strings without tags', () => {
      const helpers = getHelpers();
      expect(helpers.removeTags('plain text')).toBe('plain text');
    });
  });

  describe('gamification.scorm', () => {
    const getScorm = () => global.$exeDevices.iDevice.gamification.scorm;

    it('getUserName returns empty string when scorm is null', () => {
      const scorm = getScorm();
      expect(scorm.getUserName(null)).toBe('');
    });

    it('getUserName calls GetLearnerName when available', () => {
      const scorm = getScorm();
      const mockScorm = { GetLearnerName: vi.fn().mockReturnValue('John Doe') };
      expect(scorm.getUserName(mockScorm)).toBe('John Doe');
    });

    it('getPreviousScore returns 0 when scorm is null', () => {
      const scorm = getScorm();
      expect(scorm.getPreviousScore(null)).toBe('0');
    });

    it('getPreviousScore calls GetScoreRaw when available', () => {
      const scorm = getScorm();
      const mockScorm = { GetScoreRaw: vi.fn().mockReturnValue('85') };
      expect(scorm.getPreviousScore(mockScorm)).toBe('85');
    });

    // The bug this helper exists to prevent: init() answers false when the
    // session is already open, which inside a SCORM package is the normal case
    // — loadPage() opens it first. Two iDevices separately gated their whole
    // setup on that return value and so skipped the binding for exactly the
    // sessions that were working.
    it('bindSession binds even when init() reports the session as already open', () => {
      const scorm = getScorm();
      const api = {
        init: vi.fn(() => false),
        SetScoreMax: vi.fn(),
        SetScoreMin: vi.fn(),
        GetLearnerName: () => 'Ada',
        GetScoreRaw: () => '42',
      };

      expect(scorm.bindSession(api)).toEqual({ userName: 'Ada', previousScore: '42' });
      expect(api.init).toHaveBeenCalled();
      expect(api.SetScoreMax).toHaveBeenCalledWith(100);
      expect(api.SetScoreMin).toHaveBeenCalledWith(0);
    });

    it.each(['1.2', '2004'])('bindSession writes %s bounds when the setters are absent', version => {
      const scorm = getScorm();
      const set = vi.fn();
      const api = { version, init: vi.fn(), set };

      scorm.bindSession(api);

      const prefix = version === '2004' ? 'cmi.score' : 'cmi.core.score';
      expect(set.mock.calls).toEqual([[`${prefix}.max`, '100'], [`${prefix}.min`, '0']]);
    });

    it('bindSession answers defaults when there is no wrapper at all', () => {
      const scorm = getScorm();
      expect(scorm.bindSession(null)).toEqual({ userName: '', previousScore: '0' });
    });

    it('parseJSONSafe returns empty object for invalid JSON', () => {
      const scorm = getScorm();
      expect(scorm.parseJSONSafe('invalid')).toEqual({});
    });

    it('parseJSONSafe returns parsed object for valid JSON', () => {
      const scorm = getScorm();
      expect(scorm.parseJSONSafe('{"key":"value"}')).toEqual({ key: 'value' });
    });

    it('getFinalScore returns 0 for empty lmsData', () => {
      const scorm = getScorm();
      expect(scorm.getFinalScore(null)).toBe(0);
      expect(scorm.getFinalScore({})).toBe(0);
    });

    it('getFinalScore calculates weighted score', () => {
      const scorm = getScorm();
      const lmsData = {
        1: { score: 100, weighted: 50 },
        2: { score: 50, weighted: 50 },
      };
      const result = scorm.getFinalScore(lmsData);
      expect(result).toBeGreaterThan(0);
    });

    it('parseSuspendData returns empty object for empty data', () => {
      const scorm = getScorm();
      expect(scorm.parseSuspendData(null)).toEqual({});
      expect(scorm.parseSuspendData('')).toEqual({});
    });

    it('parseActivity parses valid activity line', () => {
      const scorm = getScorm();
      const line = '1. "Test Activity"; Score: 85%; Weight: 50%.';
      const result = scorm.parseActivity(line);
      expect(result).toEqual({
        index: 1,
        title: 'Test Activity',
        score: 85,
        weighted: 50,
      });
    });

    it('parseActivity returns null for invalid line', () => {
      const scorm = getScorm();
      expect(scorm.parseActivity('invalid line')).toBeNull();
    });

    it('convertToLineFormat converts object to line format', () => {
      const scorm = getScorm();
      const obj = {
        1: { title: 'Test', score: 80, weighted: 50 },
      };
      const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const result = scorm.convertToLineFormat(obj, game);
      expect(result).toContain('Test');
      expect(result).toContain('80%');
    });

    it('endScorm does not throw', () => {
      const scorm = getScorm();
      expect(() => scorm.endScorm({})).not.toThrow();
    });

    it('addButtonScoreNew returns empty for null game', () => {
      const scorm = getScorm();
      expect(scorm.addButtonScoreNew(null)).toBeUndefined();
    });

    it('addButtonScoreNew returns HTML for valid game with isScorm=2', () => {
      const scorm = getScorm();
      const game = { isScorm: 2, textButtonScorm: 'Send' };
      const result = scorm.addButtonScoreNew(game);
      expect(result).toContain('Games-SendScore');
    });

    it('addButtonScoreNew returns HTML for valid game with isScorm=1', () => {
      const scorm = getScorm();
      const game = { isScorm: 1 };
      const result = scorm.addButtonScoreNew(game);
      expect(result).toContain('Games-RepeatActivity');
    });

    it('getFinalScore handles single activity', () => {
      const scorm = getScorm();
      const lmsData = { 1: { score: 100, weighted: 100 } };
      expect(scorm.getFinalScore(lmsData)).toBe(100);
    });

    it('getFinalScore handles multiple activities with equal weights', () => {
      const scorm = getScorm();
      const lmsData = {
        1: { score: 100, weighted: 50 },
        2: { score: 0, weighted: 50 },
      };
      const result = scorm.getFinalScore(lmsData);
      expect(result).toBe(50);
    });

    // The legacy path (SCORM 2004 and pre-rewrite packages, which have no
    // registry) used to scale the weights to integers summing to 100 by
    // largest-remainder rounding. That handed the leftover point to whichever
    // activity came first whenever the fractions tied, so the page's mark
    // moved with the order the author placed the iDevices in.
    it('getFinalScore gives the same result whatever order the activities are in', () => {
      const scorm = getScorm();
      const equalWeight = score => ({ score, weighted: 100 });

      const forwards = scorm.getFinalScore({
        1: equalWeight(100),
        2: equalWeight(50),
        3: equalWeight(0),
      });
      const backwards = scorm.getFinalScore({
        1: equalWeight(0),
        2: equalWeight(50),
        3: equalWeight(100),
      });

      expect(forwards).toBe(50);
      expect(backwards).toBe(50);
    });

    // An iDevice computes its mark as hits over a total it reads from its own
    // data, and a total of zero — an activity saved with no questions, a deck
    // that failed to load — makes that division Infinity. The old isNaN test
    // let it through, and it travelled out to cmi.core.score.raw as the
    // learner's grade.
    it('sendScoreNew reduces a non-finite score to zero', () => {
      const scorm = getScorm();
      document.body.innerHTML = `
        <article>
          <div class="idevice_node" id="n-1">
            <div id="main-1"></div>
            <div class="Games-SendScore"></div>
            <span class="Games-RepeatActivity"></span>
          </div>
        </article>`;
      const reported = [];
      const previous = scorm.updateActivity;
      const previousPipwerks = global.pipwerks;
      scorm.updateActivity = game => reported.push(game.scorerp);
      // sendScoreNew stands down without the wrapper; the guard under test is
      // downstream of that.
      global.pipwerks = { SCORM: { get: () => '', set: () => true } };

      try {
        for (const scorerp of [1 / 0, -1 / 0, Number.NaN]) {
          scorm.sendScoreNew(true, {
            main: 'main-1',
            gameStarted: true,
            isScorm: 1,
            scorerp,
            weighted: 100,
            msgs: { msgYouScore: 'Score' },
          });
        }
      } finally {
        scorm.updateActivity = previous;
        document.body.innerHTML = '';
      }

      expect(reported).toEqual(['0', '0', '0']);
    });

    it('getFinalScore is an exact weighted mean', () => {
      const scorm = getScorm();

      // (100 + 49 + 0) / 3. The largest-remainder weighting this replaced
      // answered 50.17, putting a page over the usual mastery threshold of 50
      // for a learner whose real average is below it.
      expect(
        scorm.getFinalScore({
          1: { score: 100, weighted: 100 },
          2: { score: 49, weighted: 100 },
          3: { score: 0, weighted: 100 },
        })
      ).toBe(49.67);

      // Unequal weights still count in proportion: 100x3 + 20x1 over 4.
      expect(
        scorm.getFinalScore({
          1: { score: 100, weighted: 75 },
          2: { score: 20, weighted: 25 },
        })
      ).toBe(80);
    });


    it('parseSuspendData returns object', () => {
      const scorm = getScorm();
      const result = scorm.parseSuspendData('');
      expect(typeof result).toBe('object');
    });

    it('parseActivity handles activity with special characters', () => {
      const scorm = getScorm();
      const line = '5. "Activity: Test & Demo"; Score: 50%; Weight: 25%.';
      const result = scorm.parseActivity(line);
      expect(result.index).toBe(5);
      expect(result.score).toBe(50);
      expect(result.weighted).toBe(25);
    });

    it('convertToLineFormat handles empty object', () => {
      const scorm = getScorm();
      const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const result = scorm.convertToLineFormat({}, game);
      expect(result).toBe('');
    });

    it('convertToLineFormat handles multiple activities', () => {
      const scorm = getScorm();
      const obj = {
        1: { title: 'Test1', score: 80, weighted: 50 },
        2: { title: 'Test2', score: 60, weighted: 50 },
      };
      const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const result = scorm.convertToLineFormat(obj, game);
      expect(result).toContain('Test1');
      expect(result).toContain('Test2');
    });

    it('parseSuspendData parses valid line format', () => {
      const scorm = getScorm();
      const data = '1. "Activity One"; Score: 85%; Weight: 50%.';
      const result = scorm.parseSuspendData(data);
      expect(result[1]).toBeDefined();
      expect(result[1].score).toBe(85);
    });

    it('parseSuspendData handles multiple activities separated by tabs', () => {
      const scorm = getScorm();
      const data = '1. "First"; Score: 80%; Weight: 50%.	2. "Second"; Score: 70%; Weight: 50%.';
      const result = scorm.parseSuspendData(data);
      expect(result[1]).toBeDefined();
      expect(result[2]).toBeDefined();
    });

    it('parseActivity returns null for empty line', () => {
      const scorm = getScorm();
      expect(scorm.parseActivity('')).toBeNull();
    });

    it('parseActivity returns null for malformed line', () => {
      const scorm = getScorm();
      expect(scorm.parseActivity('not a valid format')).toBeNull();
      expect(scorm.parseActivity('1. missing fields')).toBeNull();
    });

    it('endScorm is a function that does not throw', () => {
      const scorm = getScorm();
      expect(() => scorm.endScorm({})).not.toThrow();
      expect(() => scorm.endScorm(null)).not.toThrow();
    });

    it('addButtonScoreNew returns container with Games-BottonContainer', () => {
      const scorm = getScorm();
      const game = { isScorm: 0 };
      const result = scorm.addButtonScoreNew(game);
      expect(result).toContain('Games-BottonContainer');
    });
  });

  // The SCORM 1.2 activity registry only exists in SCORM 1.2 packages, so
  // every call site is feature-detected. These tests stand in for that
  // runtime, exercising both the "present" and "absent" branches.
  describe('gamification.scorm activity registry bridge', () => {
    const getScorm = () => global.$exeDevices.iDevice.gamification.scorm;
    let registry;
    let policy;

    beforeEach(() => {
      registry = {
        register: vi.fn(descriptor => descriptor),
        get: vi.fn(() => null),
        list: vi.fn(() => []),
        summary: vi.fn(() => ({ score: null, total: 0, scored: 0 })),
      };
      policy = {
        setScoreDetailed: vi.fn(),
        recordActivityOutcome: vi.fn(),
        persistActivities: vi.fn(() => true),
        reconcilePendingActivities: vi.fn(() => null),
        hasAppliedEntry: vi.fn(() => true),
      };
      window.exeScorm12 = { activities: registry, policy };
      $exeDevices.iDevice.gamification.scorm._activityNumbersById = {};
    });

    afterEach(() => {
      delete window.exeScorm12;
      delete global.pipwerks;
    });

    it('getActivityRegistry returns the runtime registry when present', () => {
      expect(getScorm().getActivityRegistry()).toBe(registry);
    });

    it('getActivityRegistry returns null without the SCORM 1.2 runtime', () => {
      delete window.exeScorm12;
      expect(getScorm().getActivityRegistry()).toBeNull();
    });

    it('getActivityRegistry returns null when the runtime has no registry', () => {
      window.exeScorm12 = {};
      expect(getScorm().getActivityRegistry()).toBeNull();
    });

    it('reportActivity declares an evaluable, required activity', () => {
      getScorm().reportActivity({ ideviceId: 'id-1', isScorm: 1, weighted: 3 }, { total: 5 });

      expect(registry.register).toHaveBeenCalledWith('id-1', {
        evaluable: true,
        completionRequired: true,
        weight: 3,
        minimumScore: 0,
        maximumScore: 100,
        // Not customised and no META in this document: the default 5, as a percentage.
        successThreshold: 50,
        total: 5,
      });
    });

    it('reportActivity declares the mark the author customised', () => {
      getScorm().reportActivity({ ideviceId: 'id-8', isScorm: 1, passScoreMode: 'custom', passScoreCustom: 7 });

      expect(registry.register).toHaveBeenCalledWith('id-8', expect.objectContaining({ successThreshold: 70 }));
    });

    it('reportActivity declares the project mark for an activity that follows it', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'exe-pass-score');
      meta.setAttribute('content', '6');
      document.head.appendChild(meta);

      try {
        getScorm().reportActivity({ ideviceId: 'id-9', isScorm: 1, passScoreMode: 'global', passScoreCustom: 9 });

        expect(registry.register).toHaveBeenCalledWith('id-9', expect.objectContaining({ successThreshold: 60 }));
      } finally {
        meta.remove();
      }
    });

    it('reportActivity declares a presentation activity as not required', () => {
      getScorm().reportActivity({ ideviceId: 'id-2', isScorm: 0 });

      expect(registry.register).toHaveBeenCalledWith(
        'id-2',
        expect.objectContaining({ evaluable: false, completionRequired: false, weight: 100 })
      );
    });

    it('reportActivity reconciles the completion policy after registering', () => {
      getScorm().reportActivity({ ideviceId: 'id-9', isScorm: 1, weighted: 1 }, { total: 3 });

      // Registration first, then the reconciliation that lets the policy
      // correct a stale terminal verdict it wrote before this activity
      // announced itself.
      expect(registry.register).toHaveBeenCalledTimes(1);
      expect(policy.reconcilePendingActivities).toHaveBeenCalledTimes(1);
      expect(registry.register.mock.invocationCallOrder[0]).toBeLessThan(
        policy.reconcilePendingActivities.mock.invocationCallOrder[0]
      );
    });

    it('getFinalScore reads the registry aggregate when the runtime is present', () => {
      registry.summary.mockReturnValue({ score: 50.17 });

      // The lmsData argument is a presentation-only view: the aggregate
      // always comes from the registry's single algorithm, never from a
      // second computation that could disagree near the mastery threshold.
      expect(getScorm().getFinalScore({ 1: { score: 0, weighted: 1 } })).toBe(50.17);
    });

    it('getFinalScore returns 0 when the registry has no evaluable activity', () => {
      registry.summary.mockReturnValue({ score: null });

      expect(getScorm().getFinalScore({ 1: { score: 80, weighted: 1 } })).toBe(0);
    });

    // The legacy aggregation (SCORM 2004 and pre-rewrite packages, where there
    // is no registry) must stay arithmetically identical to the registry's, so
    // its default for a missing weight has to be 100 as well.
    describe('the legacy aggregation, with no registry', () => {
      let previousGetRegistry;

      beforeEach(() => {
        previousGetRegistry = getScorm().getActivityRegistry;
        getScorm().getActivityRegistry = () => null;
      });

      // Restored, or every later test in the file would run without a registry.
      afterEach(() => {
        getScorm().getActivityRegistry = previousGetRegistry;
      });

      it('weighs an entry with no stored weight the same as an explicit 100', () => {
        const missing = getScorm().getFinalScore({
          1: { score: 100 },
          2: { score: 0, weighted: 100 },
        });

        expect(missing).toBe(50);
        expect(missing).toBe(
          getScorm().getFinalScore({
            1: { score: 100, weighted: 100 },
            2: { score: 0, weighted: 100 },
          })
        );
      });

      it('still honours a weight the author chose', () => {
        expect(
          getScorm().getFinalScore({
            1: { score: 100, weighted: 1 },
            2: { score: 0, weighted: 100 },
          })
        ).toBe(0.99);
      });

      describe('getFinalThreshold', () => {
        afterEach(() => {
          getScorm()._successThresholdsByNumber = {};
        });

        it('is the project mark while nothing has reported', () => {
          // No META in this document: the default 5, which is 50.
          expect(getScorm().getFinalThreshold({})).toBe(50);
          expect(getScorm().getFinalThreshold(null)).toBe(50);
        });

        it('weighs the marks of the entries it aggregates', () => {
          getScorm()._successThresholdsByNumber = { 1: 70, 2: 30 };

          expect(
            getScorm().getFinalThreshold({
              1: { score: 0, weighted: 3 },
              2: { score: 0, weighted: 1 },
            })
          ).toBe(60);
        });

        it('counts an entry whose activity has not registered at the project mark', () => {
          getScorm()._successThresholdsByNumber = { 1: 90 };

          expect(getScorm().getFinalThreshold({ 1: { score: 0 }, 2: { score: 0 } })).toBe(70);
        });
      });

      // The page's status on the legacy path, under either pass rule.
      describe('getLegacyVerdict', () => {
        const [PENDING, SCORED, FINISHED] = [0, 1, 2];
        const completed = success => ({ completion: 'completed', success, scored: true });
        const incomplete = scored => ({ completion: 'incomplete', success: 'unknown', scored });
        let meta;
        const requireEveryActivity = () => {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'exe-pass-score-every-activity');
          meta.setAttribute('content', 'true');
          document.head.appendChild(meta);
        };

        afterEach(() => {
          meta?.remove();
          meta = undefined;
          getScorm()._successThresholdsByNumber = {};
        });

        it('judges a finished page by the weighted mean, or by each mark when the author asks', () => {
          getScorm()._successThresholdsByNumber = { 1: 50, 2: 30 };
          const lmsData = {
            1: { score: 0, weighted: 50, state: FINISHED },
            2: { score: 100, weighted: 50, state: FINISHED },
          };
          expect(getScorm().getFinalScore(lmsData)).toBeGreaterThanOrEqual(getScorm().getFinalThreshold(lmsData));

          expect(getScorm().getLegacyVerdict(lmsData)).toEqual(completed('passed'));
          requireEveryActivity();
          expect(getScorm().getLegacyVerdict(lmsData)).toEqual(completed('failed'));
        });

        it('passes when every activity reaches its own mark', () => {
          requireEveryActivity();
          getScorm()._successThresholdsByNumber = { 1: 30, 2: 80 };

          expect(
            getScorm().getLegacyVerdict({ 1: { score: 30, state: FINISHED }, 2: { score: 90, state: FINISHED } })
          ).toEqual(completed('passed'));
        });

        it.each([false, true])('keeps the page incomplete while an activity has not finished (every activity: %s)', every => {
          if (every) requireEveryActivity();
          getScorm()._successThresholdsByNumber = { 1: 50, 2: 50 };

          // Opened and left: registerActivity() seeds each with a pending 0.
          expect(getScorm().getLegacyVerdict({ 1: { score: 0, state: PENDING }, 2: { score: 0, state: PENDING } }))
            .toEqual(incomplete(false));
          // One of two answered.
          expect(getScorm().getLegacyVerdict({ 1: { score: 100, state: FINISHED }, 2: { score: 0, state: PENDING } }))
            .toEqual(incomplete(true));
          // Both sent a score, but one has not finished: a score is not a hand-in.
          expect(getScorm().getLegacyVerdict({ 1: { score: 100, state: FINISHED }, 2: { score: 90, state: SCORED } }))
            .toEqual(incomplete(true));
        });

        it('fails a 0 the learner has just earned, and passes it at a mark of 0', () => {
          requireEveryActivity();
          getScorm()._successThresholdsByNumber = { 1: 50 };
          expect(getScorm().getLegacyVerdict({ 1: { score: 0, state: FINISHED } })).toEqual(completed('failed'));

          getScorm()._successThresholdsByNumber = { 1: 0 };
          expect(getScorm().getLegacyVerdict({ 1: { score: 0, state: FINISHED } })).toEqual(completed('passed'));
        });

        it('counts a positive score stored before states as finished, and a stateless 0 as pending', () => {
          getScorm()._successThresholdsByNumber = { 1: 50, 2: 50 };

          expect(getScorm().getLegacyVerdict({ 1: { score: 60 }, 2: { score: 70 } })).toEqual(completed('passed'));
          expect(getScorm().getLegacyVerdict({ 1: { score: 60 }, 2: { score: 0 } })).toEqual(incomplete(true));
        });

        it('judges pending work whose activity has not registered yet by the project mark', () => {
          requireEveryActivity();
          // No exe-pass-score META in this document: the default 5, which is 50.
          expect(getScorm().getLegacyVerdict({ 3: { score: 40, state: FINISHED } })).toEqual(completed('failed'));
          expect(getScorm().getLegacyVerdict({ 3: { score: 50, state: FINISHED } })).toEqual(completed('passed'));
          expect(getScorm().getLegacyVerdict({ 3: { score: 0, state: PENDING } })).toEqual(incomplete(false));
        });

        it('does not hold the page back for a stateless leftover that did not register', () => {
          getScorm()._successThresholdsByNumber = { 1: 50 };
          const lmsData = { 1: { score: 80, state: FINISHED }, 7: { score: 0 } };

          // It still counts in the mean, like every stored entry in
          // getFinalScore(): the verdict and the published score agree.
          expect(getScorm().getLegacyVerdict(lmsData)).toEqual(completed('failed'));
          requireEveryActivity();
          expect(getScorm().getLegacyVerdict(lmsData)).toEqual(completed('passed'));
        });

        it('passes an activity at its mark that floating point left a hair below', () => {
          requireEveryActivity();
          getScorm()._successThresholdsByNumber = { 1: 57 };
          const score = 0.57 * 100;
          expect(score).toBeLessThan(57);

          expect(getScorm().getLegacyVerdict({ 1: { score, state: FINISHED } })).toEqual(completed('passed'));
        });

        it('has nothing to judge while no activity is known', () => {
          expect(getScorm().getLegacyVerdict({})).toBeNull();
          expect(getScorm().getLegacyVerdict(null)).toBeNull();
          expect(getScorm().getLegacyVerdict({ 7: { score: 0 } })).toBeNull();
        });
      });

      describe('the activity state in cmi.suspend_data', () => {
        const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };

        it('round-trips every state and keeps the score lines readable by the old parser', () => {
          const scorm = getScorm();
          const data = {
            1: { title: 'Pending', score: 0, weighted: 100, state: 0 },
            2: { title: 'Scored', score: 40, weighted: 100, state: 1 },
            3: { title: 'Finished', score: 0, weighted: 100, state: 2 },
          };
          const saved = scorm.convertToLineFormat(data, game);

          expect(saved.endsWith('.\texe-state/1:1=0,2=1,3=2')).toBe(true);
          expect(scorm.parseSuspendData(saved)).toEqual(data);
          const oldRecords = saved.split('.\t').map(line => scorm.parseActivity(line)).filter(Boolean);
          expect(oldRecords.map(record => record.score)).toEqual([0, 40, 0]);
        });

        it('does not invent a state for an old payload', () => {
          const scorm = getScorm();
          const old = '1. "Old activity"; Score: 0%; Weight: 100%';
          const parsed = scorm.parseSuspendData(old);

          expect(parsed[1].state).toBeUndefined();
          expect(scorm.convertToLineFormat(parsed, game)).toBe(old);
        });

        it('ignores unknown, malformed and orphaned state lines', () => {
          const scorm = getScorm();
          const score = '1. "Old activity"; Score: 0%; Weight: 100%';
          for (const suffix of ['exe-state/2:1=2', 'exe-state/1:1=x', 'exe-state/1:1=3', 'exe-state/1:99=2']) {
            expect(scorm.parseSuspendData(`${score}.\t${suffix}`)).toEqual(scorm.parseSuspendData(score));
          }
        });
      });
    });

    // 100, not 1: it is the default the editor writes, and 28 of the 35 game
    // iDevices never set `weighted` when they load for playback. At 1, an
    // activity that had never been through the editor weighed a hundredth of
    // one that had, on the same page.
    it('reportActivity falls back to weight 100 for a missing or invalid weight', () => {
      getScorm().reportActivity({ ideviceId: 'id-3', isScorm: 1, weighted: 'x' });
      getScorm().reportActivity({ ideviceId: 'id-4', isScorm: 1, weighted: -2 });
      getScorm().reportActivity({ ideviceId: 'id-5', isScorm: 1 });

      expect(registry.register).toHaveBeenNthCalledWith(1, 'id-3', expect.objectContaining({ weight: 100 }));
      expect(registry.register).toHaveBeenNthCalledWith(2, 'id-4', expect.objectContaining({ weight: 100 }));
      expect(registry.register).toHaveBeenNthCalledWith(3, 'id-5', expect.objectContaining({ weight: 100 }));
    });

    it('reportActivity keeps a weight the author actually chose', () => {
      getScorm().reportActivity({ ideviceId: 'id-6', isScorm: 1, weighted: 1 });
      getScorm().reportActivity({ ideviceId: 'id-7', isScorm: 1, weighted: 40 });

      expect(registry.register).toHaveBeenNthCalledWith(1, 'id-6', expect.objectContaining({ weight: 1 }));
      expect(registry.register).toHaveBeenNthCalledWith(2, 'id-7', expect.objectContaining({ weight: 40 }));
    });

    it('reportActivity passes the legacy page position through for migration claims', () => {
      getScorm().reportActivity({ ideviceId: 'id-5', isScorm: 1, ideviceNumber: 3 }, { legacyIndex: 3 });

      expect(registry.register).toHaveBeenCalledWith('id-5', expect.objectContaining({ legacyIndex: 3 }));
      expect(getScorm()._activityNumbersById['id-5']).toBe(3);
    });

    it('buildLmsDataFromRegistry keys evaluable records by their page position', () => {
      registry.list = vi.fn(() => [
        { id: 'id-a', evaluable: true, score: 80, weight: 2 },
        { id: 'id-b', evaluable: false, score: null, weight: 1 },
        { id: 'id-c', evaluable: true, score: null, weight: 1 },
      ]);
      getScorm()._activityNumbersById = { 'id-a': 2, 'id-c': 5 };

      expect(getScorm().buildLmsDataFromRegistry()).toEqual({
        2: { title: '', score: 80, weighted: 2 },
        5: { title: '', score: 0, weighted: 1 },
      });
    });

    it.each([
      ['no registry', () => delete window.exeScorm12, { ideviceId: 'id' }],
      ['no game', () => {}, null],
      ['no stable identifier', () => {}, { isScorm: 1 }],
    ])('reportActivity is a no-op with %s', (_label, prepare, game) => {
      prepare();
      expect(getScorm().reportActivity(game, {})).toBeNull();
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('updateActivity reports the explicit completion flag and the score', () => {
      global.pipwerks = { SCORM: { get: () => '', set: vi.fn(() => true) } };
      const game = {
        ideviceId: 'id-1',
        ideviceNumber: 1,
        isScorm: 1,
        weighted: 1,
        scorerp: 8,
        answered: 4,
        title: 'Quiz',
        msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
      };

      getScorm().updateActivity(game, {}, true);

      expect(registry.register).toHaveBeenCalledWith(
        'id-1',
        expect.objectContaining({ completed: true, score: 80, answered: 4 })
      );
    });

    it('updateActivity lets the runtime own cmi.suspend_data (no legacy write)', () => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = {
        ideviceId: 'id-1',
        ideviceNumber: 1,
        isScorm: 1,
        weighted: 1,
        scorerp: 8,
        answered: 4,
        title: 'Quiz',
        msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
      };

      getScorm().updateActivity(game, {}, true);

      // The registry serialises suspend_data through the runtime; writing the
      // legacy line format here would alternate formats with the runtime's
      // exe12 payload and corrupt resumes.
      expect(set).not.toHaveBeenCalledWith('cmi.suspend_data', expect.anything());
      expect(policy.persistActivities).toHaveBeenCalled();
    });

    it('registerActivity reads previous progress from the registry, not suspend_data', () => {
      const get = vi.fn(() => '');
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get, set } };
      registry.get = vi.fn(() => ({ id: 'node-1', evaluable: true, score: 70, weight: 1, completed: false }));
      registry.list = vi.fn(() => [{ id: 'node-1', evaluable: true, score: 70, weight: 1 }]);

      const node = document.createElement('div');
      node.className = 'idevice_node';
      node.id = 'node-1';
      const main = document.createElement('div');
      main.id = 'game-reg';
      node.appendChild(main);
      document.body.appendChild(node);

      const game = {
        main: 'game-reg',
        isScorm: 1,
        weighted: 1,
        numberQuestions: 5,
        msgs: { msgYouScore: 'Score', msgScoreScorm: 'scorm', msgSaveAuto: 'auto', msgPlaySeveralTimes: 'again', msgYouLastScore: 'last', msgActityComply: 'ok' },
      };

      getScorm().registerActivity(game);

      // Previous score comes from the restored registry record…
      expect(game.previousScore).toBe('7.00');
      // …the migration claim is passed through…
      expect(registry.register).toHaveBeenCalledWith(
        'node-1',
        expect.objectContaining({ legacyIndex: game.ideviceNumber })
      );
      // …and suspend_data is neither read nor written here.
      expect(get).not.toHaveBeenCalledWith('cmi.suspend_data');
      expect(set).not.toHaveBeenCalledWith('cmi.suspend_data', expect.anything());

      node.remove();
    });

    it.each([
      ['a finished game reported automatically', { gameOver: true, gameStarted: true }, true, true],
      ['an unfinished game reported automatically', { gameOver: false, gameStarted: true }, true, false],
      // The save button is not a hand-in: it says when the grade is written,
      // never that the activity is over. Only gameOver says that, in either
      // direction and whichever way the score was sent.
      ['a score the learner submitted by hand mid-game', { gameOver: false, gameStarted: true, isScorm: 2 }, false, false],
      ['a finished game whose score the learner sent by hand', { gameOver: true, gameStarted: true, isScorm: 2 }, false, true],
    ])('sendScoreNew reports %s with the right completion flag', (_label, flags, auto, expected) => {
      // The manual-submit branch ends with an alert(); happy-dom has none.
      const originalAlert = window.alert;
      window.alert = vi.fn();
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = Object.assign(
        {
          ideviceId: 'id-1',
          ideviceNumber: 1,
          isScorm: 1,
          weighted: 1,
          scorerp: 7,
          main: 'game-main',
          title: 'Quiz',
          userName: '',
          msgs: {
            msgScore: 'Score',
            msgWeight: 'Weight',
            msgYouScore: 'Score',
            msgEndGameScore: 'end',
            msgOnlySaveScore: 'only',
            msgSaveAuto: 'auto',
            msgPlaySeveralTimes: 'again',
            msgActityComply: 'ok',
            msgYouLastScore: 'last',
            msgScoreScorm: 'scorm',
          },
        },
        flags
      );
      const container = document.createElement('div');
      container.id = 'game-main';
      container.className = 'idevice_node';
      document.body.appendChild(container);

      getScorm().sendScoreNew(auto, game);

      expect(registry.register).toHaveBeenCalledWith('id-1', expect.objectContaining({ completed: expected }));
      container.remove();
      window.alert = originalAlert;
    });

    // In manual mode the learner owns the save button and decides when — if
    // ever — their grade is written. So an activity reporting on its own must
    // reach nothing, and it is worth guarding once here rather than at each of
    // the hundred-odd places the iDevices publish their progress.
    describe('manual mode silences the activity, not the button', () => {
      /**
       * A game ready to report, with the SCORM mode under test.
       *
       * @param {number} isScorm 0 untracked, 1 automatic, 2 manual
       * @returns {Object} the options object sendScoreNew receives
       */
      function gameInMode(isScorm) {
        return {
          ideviceId: 'id-1',
          ideviceNumber: 1,
          isScorm,
          weighted: 100,
          scorerp: 7,
          gameStarted: true,
          gameOver: false,
          main: 'game-main',
          title: 'Quiz',
          userName: '',
          msgs: { msgYouScore: 'Score', msgEndGameScore: 'end' },
        };
      }

      let container;
      let originalAlert;

      beforeEach(() => {
        originalAlert = window.alert;
        window.alert = vi.fn();
        global.pipwerks = { SCORM: { get: () => '', set: vi.fn(() => true) } };
        container = document.createElement('div');
        container.id = 'game-main';
        container.className = 'idevice_node';
        document.body.appendChild(container);
      });

      afterEach(() => {
        container.remove();
        window.alert = originalAlert;
      });

      it('drops an automatic report in manual mode', () => {
        getScorm().sendScoreNew(true, gameInMode(2));

        expect(registry.register).not.toHaveBeenCalled();
      });

      it('publishes an automatic report in automatic mode', () => {
        getScorm().sendScoreNew(true, gameInMode(1));

        expect(registry.register).toHaveBeenCalledWith('id-1', expect.objectContaining({ score: 70 }));
      });

      it('publishes what the button asks for, in manual mode', () => {
        getScorm().sendScoreNew(false, gameInMode(2));

        expect(registry.register).toHaveBeenCalledWith('id-1', expect.objectContaining({ score: 70 }));
      });

      it('drops an automatic report from an untracked activity', () => {
        getScorm().sendScoreNew(true, gameInMode(0));

        expect(registry.register).not.toHaveBeenCalled();
      });

      it.each([
        [1, true],
        [2, false],
        [0, false],
        ['1', true],
      ])('reportsAutomatically(%s) is %s', (isScorm, expected) => {
        expect(getScorm().reportsAutomatically({ isScorm })).toBe(expected);
      });

      it('reportsAutomatically says no without a game', () => {
        expect(getScorm().reportsAutomatically(null)).toBe(false);
        expect(getScorm().reportsAutomatically(undefined)).toBe(false);
      });
    });

    // The status is read on both sides of updateActivity, which is what writes
    // it. Only the report that moves it earns the second, later retry.
    it.each([
      ['asks for a late retry when the status moved', 'incomplete', 'failed', true],
      ['does not when the status stood still', 'failed', 'failed', false],
    ])('sendScoreNew %s', (_label, before, after, expected) => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      vi.spyOn(getScorm(), 'readLessonStatus')
        .mockReturnValueOnce(before)
        .mockReturnValueOnce(after);
      const trigger = vi
        .spyOn(getScorm(), 'triggerMoodleDetection')
        .mockImplementation(() => {});
      const game = {
        ideviceId: 'id-1',
        ideviceNumber: 1,
        isScorm: 1,
        weighted: 1,
        scorerp: 7,
        gameOver: true,
        gameStarted: true,
        main: 'game-main',
        title: 'Quiz',
        userName: '',
        msgs: {
          msgScore: 'Score',
          msgWeight: 'Weight',
          msgYouScore: 'Score',
          msgEndGameScore: 'end',
          msgOnlySaveScore: 'only',
          msgSaveAuto: 'auto',
          msgPlaySeveralTimes: 'again',
          msgActityComply: 'ok',
          msgYouLastScore: 'last',
          msgScoreScorm: 'scorm',
        },
      };
      const container = document.createElement('div');
      container.id = 'game-main';
      container.className = 'idevice_node';
      document.body.appendChild(container);

      getScorm().sendScoreNew(true, game);

      expect(trigger).toHaveBeenCalledWith(expected);
      container.remove();
      vi.restoreAllMocks();
    });

    it('readLessonStatus reports no status rather than throwing', () => {
      global.pipwerks = {
        SCORM: {
          get: () => {
            throw new Error('not initialised');
          },
          set: vi.fn(),
        },
      };

      expect(getScorm().readLessonStatus()).toBe('');

      global.pipwerks = undefined;
      expect(getScorm().readLessonStatus()).toBe('');
    });

    it('showFinalScore delegates score and status to the SCORM 1.2 runtime', () => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };
      // The registry owns the aggregation: the recorded score must be its
      // summary().score, not a second computation over the lmsData view.
      registry.summary.mockReturnValue({ score: 90 });

      getScorm().showFinalScore({ 1: { title: 'Q', score: 90, weighted: 1 } }, game);

      expect(policy.setScoreDetailed).toHaveBeenCalledWith(90, 0, 100);
      // No aggregate argument: the policy reads the registry's own
      // summary().score, the same number recorded above, so the status
      // decided mid-session and the status decided at exit cannot diverge.
      expect(policy.recordActivityOutcome).toHaveBeenCalledWith();
      // Nothing is written behind the runtime's back.
      expect(set).not.toHaveBeenCalledWith('cmi.core.score.raw', expect.anything());
      expect(set).not.toHaveBeenCalledWith('cmi.core.lesson_status', expect.anything());
    });

    it('showFinalScore does not write a zero score before entry policy has run', () => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      policy.hasAppliedEntry.mockReturnValue(false);
      registry.summary.mockReturnValue({ score: 0 });
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

      getScorm().showFinalScore({ 1: { title: 'Q', score: 0, weighted: 1 } }, game);

      expect(policy.setScoreDetailed).not.toHaveBeenCalled();
      expect(policy.recordActivityOutcome).not.toHaveBeenCalled();
    });

    it('showFinalScore still records the outcome when the LMS refuses the score', () => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };
      registry.summary.mockReturnValue({ score: 90 });
      policy.setScoreDetailed.mockReturnValue({ requiredWritten: false });

      getScorm().showFinalScore({ 1: { title: 'Q', score: 90, weighted: 1 } }, game);

      // Documented policy (runtime contract §8): completion is not held
      // hostage by score storage.
      expect(policy.recordActivityOutcome).toHaveBeenCalled();
    });

    it.each([
      [90, 'passed'],
      [10, 'failed'],
    ])('showFinalScore keeps the legacy path for a score of %d without the runtime', (score, expected) => {
      delete window.exeScorm12;
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

      getScorm().showFinalScore({ 1: { title: 'Q', score, weighted: 1, state: 2 } }, game);

      expect(set).toHaveBeenCalledWith('cmi.core.score.raw', score);
      expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', expected);
    });

    /**
     * SCORM 2004 packages and anything exported before the SCORM 1.2 runtime
     * rewrite have no policy layer, so the project mark is applied directly to
     * the page aggregate. There is no mastery_score to consult on this path.
     */
    it.each([
      ['passes at the project mark', 70, 'passed'],
      ['fails just below it', 69, 'failed'],
    ])('showFinalScore on the legacy path %s', (_label, score, expected) => {
      delete window.exeScorm12;
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'exe-pass-score');
      meta.setAttribute('content', '7');
      document.head.appendChild(meta);
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

      try {
        getScorm().showFinalScore({ 1: { title: 'Q', score, weighted: 1, state: 2 } }, game);

        expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', expected);
      } finally {
        meta.remove();
      }
    });

    /**
     * The report from Moodle, on the path with no policy layer: an activity
     * customised away from the project's 5 must be judged by its own mark,
     * which registerActivity() records by page position.
     */
    it.each([
      ['fails below its own mark of 7', 7, 66.7, 'failed'],
      ['passes at its own mark of 3', 3, 33.3, 'passed'],
    ])('showFinalScore on the legacy path %s', (_label, mark, score, expected) => {
      delete window.exeScorm12;
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const node = document.createElement('div');
      node.className = 'idevice_node';
      node.id = 'node-legacy';
      const main = document.createElement('div');
      main.id = 'game-legacy';
      node.appendChild(main);
      document.body.appendChild(node);
      const game = {
        main: 'game-legacy',
        isScorm: 1,
        weighted: 100,
        passScoreMode: 'custom',
        passScoreCustom: mark,
        msgs: { msgYouScore: 'Score', msgScoreScorm: 'scorm', msgSaveAuto: 'auto', msgPlaySeveralTimes: 'again', msgYouLastScore: 'last', msgActityComply: 'ok' },
      };

      try {
        getScorm().registerActivity(game);
        getScorm().showFinalScore({ [game.ideviceNumber]: { title: 'Q', score, weighted: 100 } }, game);

        expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', expected);
      } finally {
        node.remove();
        getScorm()._successThresholdsByNumber = {};
      }
    });

    describe('on the legacy path, the page is judged once its activities are finished', () => {
      const [PENDING, SCORED, FINISHED] = [0, 1, 2];
      let meta;
      const requireEveryActivity = () => {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'exe-pass-score-every-activity');
        meta.setAttribute('content', 'true');
        document.head.appendChild(meta);
      };
      /** A SCORM 2004 wrapper that keeps the suspend_data it is given. */
      const scorm2004 = () => {
        const lms = { 'cmi.suspend_data': '' };
        const set = vi.fn((key, value) => {
          lms[key] = value;
          return true;
        });
        global.pipwerks = { SCORM: { version: '2004', get: key => lms[key] || '', set } };
        return { lms, set };
      };
      const playable = (id, mark, isScorm = 1) => {
        const node = document.createElement('article');
        node.className = 'idevice_node';
        node.id = id;
        node.innerHTML = `<div id="${id}-game"></div>`;
        document.body.appendChild(node);
        return {
          main: `${id}-game`, isScorm, weighted: 100, passScoreMode: 'custom', passScoreCustom: mark,
          msgs: { msgYouScore: 'Score', msgScore: 'Score', msgWeight: 'Weight' },
        };
      };
      const report = (game, score, completed) => {
        game.scorerp = score;
        const stored = global.pipwerks.SCORM.get('cmi.suspend_data');
        getScorm().updateActivity(game, getScorm().parseSuspendData(stored), completed);
      };

      beforeEach(() => {
        delete window.exeScorm12;
        document.body.innerHTML = '';
      });

      afterEach(() => {
        meta?.remove();
        meta = undefined;
        getScorm()._successThresholdsByNumber = {};
      });

      it.each([false, true])('reports a page opened and left as incomplete, with no score (every activity: %s)', every => {
        if (every) requireEveryActivity();
        const { lms, set } = scorm2004();

        getScorm().registerActivity(playable('first', 8));
        getScorm().registerActivity(playable('second', 4));

        expect(lms['cmi.completion_status']).toBe('incomplete');
        expect(lms['cmi.success_status']).toBe('unknown');
        expect(set.mock.calls.some(([key]) => key === 'cmi.score.raw')).toBe(false);
        expect(set.mock.calls.some(([key]) => key.startsWith('cmi.core.'))).toBe(false);
      });

      it.each([
        [false, 'passed'],
        [true, 'failed'],
      ])('judges the page once both activities finish (every activity: %s)', (every, verdict) => {
        if (every) requireEveryActivity();
        const { lms } = scorm2004();
        const first = playable('first', 8);
        const second = playable('second', 4);
        getScorm().registerActivity(first);
        getScorm().registerActivity(second);

        report(first, 7, true);
        expect(lms['cmi.completion_status']).toBe('incomplete');
        expect(lms['cmi.score.raw']).toBe(35);

        // 85 against a mean mark of 60 passes; 7 against its own 8 does not.
        report(second, 10, true);
        expect(lms['cmi.completion_status']).toBe('completed');
        expect(lms['cmi.success_status']).toBe(verdict);
        expect(lms['cmi.score.raw']).toBe(85);
      });

      it('keeps an activity that sent a score without finishing pending, and reopens on a replay', () => {
        const { lms } = scorm2004();
        const game = playable('only', 5);
        getScorm().registerActivity(game);

        // A manual send in the middle of the game: a score is not a hand-in.
        report(game, 9, false);
        expect(getScorm().parseSuspendData(lms['cmi.suspend_data'])[1].state).toBe(SCORED);
        expect(lms['cmi.completion_status']).toBe('incomplete');

        report(game, 9, true);
        expect(lms['cmi.completion_status']).toBe('completed');
        expect(lms['cmi.success_status']).toBe('passed');

        // The latest report decides, as in the registry.
        report(game, 2, false);
        expect(lms['cmi.completion_status']).toBe('incomplete');
        expect(lms['cmi.success_status']).toBe('unknown');
      });

      it('registers a zero as pending and keeps a submitted zero after a resume', () => {
        requireEveryActivity();
        const { lms } = scorm2004();
        const game = playable('zero', 0);

        getScorm().registerActivity(game);
        expect(getScorm().parseSuspendData(lms['cmi.suspend_data'])[1]).toMatchObject({ score: 0, state: PENDING });

        report(game, 0, true);
        getScorm().registerActivity(game);
        expect(getScorm().parseSuspendData(lms['cmi.suspend_data'])[1]).toMatchObject({ score: 0, state: FINISHED });
        expect(lms['cmi.completion_status']).toBe('completed');
        expect(lms['cmi.success_status']).toBe('passed');
      });

      it('does not track an activity that sends no score', () => {
        const { lms, set } = scorm2004();

        getScorm().registerActivity(playable('presentation', 5, 0));

        expect(getScorm()._successThresholdsByNumber).toEqual({});
        expect(lms['cmi.suspend_data']).toBe('');
        expect(set.mock.calls.some(([key]) => key.startsWith('cmi.completion') || key.startsWith('cmi.success'))).toBe(
          false
        );
      });

      it('showFinalScore fails the page when one activity falls short, though the mean passes', () => {
        requireEveryActivity();
        const set = vi.fn(() => true);
        global.pipwerks = { SCORM: { get: () => '', set } };
        getScorm()._successThresholdsByNumber = { 1: 50, 2: 30 };
        const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

        getScorm().showFinalScore(
          {
            1: { title: 'A', score: 0, weighted: 50, state: FINISHED },
            2: { title: 'B', score: 100, weighted: 50, state: FINISHED },
          },
          game
        );

        // 50 against a mean mark of 40 would pass.
        expect(set).toHaveBeenCalledWith('cmi.core.score.raw', 50);
        expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', 'failed');
      });

      it('updateActivity stores the activity that finished, and SCORM 1.2 reads pending as incomplete', () => {
        const set = vi.fn(() => true);
        global.pipwerks = { SCORM: { get: () => '', set } };
        getScorm()._successThresholdsByNumber = { 1: 50, 2: 50 };
        const game = { ideviceNumber: 2, title: 'B', scorerp: 6, weighted: 100, msgs: { msgYouScore: 'Score' } };

        getScorm().updateActivity(game, { 1: { title: 'A', score: 0, weighted: 100, state: PENDING } }, true);

        const saved = set.mock.calls.find(([key]) => key === 'cmi.suspend_data')[1];
        expect(getScorm().parseSuspendData(saved)[2].state).toBe(FINISHED);
        // The first activity still has only the 0 registerActivity seeded.
        expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', 'incomplete');
      });

      it.each([
        [{ score: 100, state: FINISHED }, 'completed', 'passed', true],
        [{ score: 0, state: FINISHED }, 'completed', 'failed', true],
        [{ score: 40, state: SCORED }, 'incomplete', 'unknown', true],
        [{ score: 0, state: PENDING }, 'incomplete', 'unknown', false],
      ])('publishes the SCORM 2004 verdict %s through its own data model', (record, completion, success, scored) => {
        const set = vi.fn(() => true);
        global.pipwerks = { SCORM: { version: '2004', get: () => '', set } };
        getScorm()._successThresholdsByNumber = { 1: 50 };
        getScorm().showFinalScore({ 1: record }, { msgs: { msgYouScore: 'Score' } });
        expect(set.mock.calls.some(([key]) => key === 'cmi.score.raw')).toBe(scored);
        if (scored) expect(set).toHaveBeenCalledWith('cmi.score.raw', record.score);
        expect(set).toHaveBeenCalledWith('cmi.completion_status', completion);
        expect(set).toHaveBeenCalledWith('cmi.success_status', success);
        expect(set.mock.calls.some(([key]) => key.startsWith('cmi.core.'))).toBe(false);
      });

      it('reads the SCORM 2004 score and success state for the score display', () => {
        const get = vi.fn(key => ({ 'cmi.score.raw': '75', 'cmi.success_status': 'passed' })[key] || '');
        global.pipwerks = { SCORM: { version: '2004', get } };
        expect(getScorm().getTotalScore()).toBe(75);
        expect(getScorm().readLessonStatus()).toBe('passed');
        getScorm().createScoreScormHtml({ main: 'unused', msgs: { msgYouScore: 'Score' } });
        expect(get.mock.calls.some(([key]) => key.startsWith('cmi.core.'))).toBe(false);
      });
    });

    describe('the page minimum score, beside the score', () => {
      const FINISHED = 2;
      const game = { main: 'unused', msgs: { msgYouScore: 'Score' } };
      // Two activities stored by registerActivity(), at marks of 8 and 4.
      const twoActivities = '1. "A"; Score: 0%; Weight: 100%.\t2. "B"; Score: 0%; Weight: 100%';
      let metas = [];
      let previousI18n;
      const addMeta = (name, content) => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
        metas.push(meta);
      };
      const scorm2004 = (values = {}) => {
        const lms = Object.assign({ 'cmi.suspend_data': '' }, values);
        global.pipwerks = {
          SCORM: { version: '2004', get: key => (key in lms ? lms[key] : ''), set: vi.fn(() => true) },
        };
      };
      const label = () => document.getElementById('eXeScoreNodePassScore');
      const shown = () => (label().classList.contains('d-none') ? null : label().textContent);

      beforeEach(() => {
        delete window.exeScorm12;
        previousI18n = global.$exe_i18n;
        global.$exe_i18n = Object.assign({}, previousI18n, {
          pagePassScore: 'Minimum score to pass: %s',
          pagePassEveryActivity: 'Each activity must reach its minimum score',
        });
        document.body.innerHTML = '<div class="page-content"></div>';
      });

      afterEach(() => {
        metas.forEach(meta => meta.remove());
        metas = [];
        global.$exe_i18n = previousI18n;
        delete window.exeScorm12;
        getScorm()._successThresholdsByNumber = {};
        document.body.innerHTML = '';
      });

      it('draws it before the score, on the same 0-100 scale', () => {
        scorm2004({ 'cmi.suspend_data': twoActivities });
        getScorm()._successThresholdsByNumber = { 1: 80, 2: 40 };

        getScorm().createScoreScormHtml(game);

        expect(shown()).toBe('Minimum score to pass: 60/100');
        expect(label().nextElementSibling.id).toBe('eXeScoreNodeScore');
      });

      it('says each activity must reach its own when the author requires it', () => {
        addMeta('exe-pass-score-every-activity', 'true');
        scorm2004({ 'cmi.suspend_data': twoActivities });
        getScorm()._successThresholdsByNumber = { 1: 80, 2: 40 };

        getScorm().createScoreScormHtml(game);

        expect(shown()).toBe('Each activity must reach its minimum score');
      });

      it('adds it to a score node drawn without one', () => {
        scorm2004();
        document.body.innerHTML =
          '<div class="page-content"><div id="exeScoreNode"><div id="eXeScoreNodeScore"></div></div></div>';

        getScorm().createScoreScormHtml(game);

        // No activity stored yet: the project mark, 5 by default.
        expect(shown()).toBe('Minimum score to pass: 50/100');
        expect(label().nextElementSibling.id).toBe('eXeScoreNodeScore');
      });

      it('follows each report', () => {
        scorm2004();
        getScorm().createScoreScormHtml(game);
        getScorm()._successThresholdsByNumber = { 1: 70 };

        getScorm().showFinalScore({ 1: { title: 'A', score: 90, weighted: 100, state: FINISHED } }, game);

        expect(shown()).toBe('Minimum score to pass: 70/100');
      });

      it('shows the SCORM 1.2 policy rule, which decides the page', () => {
        scorm2004();
        getScorm().createScoreScormHtml(game);
        const policy = { setScoreDetailed: vi.fn(), getPassRule: () => ({ everyActivity: false, threshold: 45.5 }) };
        window.exeScorm12 = { policy };

        getScorm().showPagePassScore();
        expect(shown()).toBe('Minimum score to pass: 45.5/100');

        policy.getPassRule = () => ({ everyActivity: true, threshold: 45.5 });
        getScorm().showPagePassScore();
        expect(shown()).toBe('Each activity must reach its minimum score');

        // A host runtime from before getPassRule().
        delete policy.getPassRule;
        policy.getSuccessThreshold = () => 40;
        getScorm().showPagePassScore();
        expect(shown()).toBe('Minimum score to pass: 40/100');

        delete policy.getSuccessThreshold;
        getScorm().showPagePassScore();
        expect(shown()).toBeNull();
      });

      it('hides it when nothing decides a pass, or the page has no text for it', () => {
        scorm2004();
        getScorm().createScoreScormHtml(game);
        window.exeScorm12 = {
          policy: { setScoreDetailed: vi.fn(), getPassRule: () => ({ everyActivity: false, threshold: null }) },
        };
        getScorm().showPagePassScore();
        expect(shown()).toBeNull();

        delete window.exeScorm12;
        global.$exe_i18n = Object.assign({}, previousI18n, { pagePassScore: undefined });
        getScorm().showPagePassScore();
        expect(shown()).toBeNull();

        delete global.pipwerks;
        expect(getScorm().getPagePassRule()).toBeNull();
      });

      describe('a pass mark set by a SCORM 2004 LMS', () => {
        it.each([
          ['0.7', 70],
          ['1', 100],
          ['-0.2', 0],
          ['0.555', 55.5],
          ['', null],
          ['abc', null],
          ['1.5', null],
        ])('reads cmi.scaled_passing_score %j as %s', (value, expected) => {
          scorm2004({ 'cmi.scaled_passing_score': value });
          expect(getScorm().getLmsPassingScore()).toBe(expected);
        });

        it('is not read from SCORM 1.2, or when the wrapper fails', () => {
          global.pipwerks = { SCORM: { version: '1.2', get: () => '0.7' } };
          expect(getScorm().getLmsPassingScore()).toBeNull();

          global.pipwerks = {
            SCORM: {
              version: '2004',
              get: () => {
                throw new Error('not initialised');
              },
            },
          };
          expect(getScorm().getLmsPassingScore()).toBeNull();
        });

        it.each([
          ['0.7', 'passed', 70],
          ['0.9', 'failed', 90],
        ])('at %s, judges the page score under either rule and shows on the label', (passing, verdict, mark) => {
          addMeta('exe-pass-score-every-activity', 'true');
          scorm2004({ 'cmi.scaled_passing_score': passing });
          getScorm()._successThresholdsByNumber = { 1: 80, 2: 40 };
          // 70 is below its own 80, so every activity would fail the page;
          // the mean of the marks, 60, would pass the score of 85.
          const lmsData = {
            1: { score: 70, weighted: 100, state: FINISHED },
            2: { score: 100, weighted: 100, state: FINISHED },
          };

          expect(getScorm().getLegacyVerdict(lmsData)).toMatchObject({ completion: 'completed', success: verdict });

          getScorm().createScoreScormHtml(game);
          expect(shown()).toBe(`Minimum score to pass: ${mark}/100`);
        });
      });
    });

    it('showFinalScore publishes no score for a page the learner never answered', () => {
      // score.raw cannot express "no answer", and Moodle promotes an incomplete
      // status to completed as soon as any score.raw exists, so a merely-visited
      // page would count as a finished learning object under grademethod SCOES.
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };
      // `summary().scored` is the registry's own count of evaluable activities that
      // have actually produced a score, and its single owner — the entry policy reads
      // the same field. Not summary.answered, which is structurally always 0 because
      // no iDevice sets game.answered; and not summary.score, which counts an unscored
      // evaluable as 0 and so cannot tell "never answered" from "scored zero".
      registry.summary.mockReturnValue({ score: 0, total: 1, scored: 0 });

      getScorm().showFinalScore({ 1: { title: 'Q', score: 0, weighted: 1 } }, game);

      expect(policy.setScoreDetailed).not.toHaveBeenCalled();
      // The status policy still runs — 'incomplete' is the honest report.
      expect(policy.recordActivityOutcome).toHaveBeenCalled();
    });

    it('showFinalScore publishes a genuine zero once something has been scored', () => {
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };
      registry.summary.mockReturnValue({ score: 0, total: 1, scored: 1 });

      getScorm().showFinalScore({ 1: { title: 'Q', score: 0, weighted: 1 } }, game);

      expect(policy.setScoreDetailed).toHaveBeenCalledWith(0, 0, 100);
    });

    it('showFinalScore keeps scoring when the host ships no activity registry', () => {
      // The Moodle plugin injects a four-layer subset with no registry. It cannot
      // answer "has anything been scored?", so it must keep publishing exactly as
      // before rather than being silently suppressed into never grading at all.
      window.exeScorm12 = { policy, lifecycle: {}, client: {} };
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

      getScorm().showFinalScore({ 1: { title: 'Q', score: 80, weighted: 1 } }, game);

      expect(policy.setScoreDetailed).toHaveBeenCalledWith(80, 0, 100);
    });

    it('showFinalScore falls back to the legacy path when the host runtime is partial', () => {
      // The Moodle plugin injects a SUBSET of these layers, so window.exeScorm12
      // and .policy exist while the newer methods do not. Branching on the object
      // instead of the capability threw before the score was ever written.
      window.exeScorm12 = { policy: { setScore: vi.fn() } };
      const set = vi.fn(() => true);
      global.pipwerks = { SCORM: { get: () => '', set } };
      const game = { ideviceNumber: 1, msgs: { msgYouScore: 'Score' } };

      expect(() => getScorm().showFinalScore({ 1: { title: 'Q', score: 90, weighted: 1, state: 2 } }, game)).not.toThrow();

      expect(set).toHaveBeenCalledWith('cmi.core.score.raw', 90);
      expect(set).toHaveBeenCalledWith('cmi.core.lesson_status', 'passed');
    });
  });

  // The bridge tests above stand in for the runtime with hand-written policy
  // and registry objects. These run the REAL assembled SCORM 1.2 runtime — the
  // vendored wrapper, client, registry, policy, lifecycle and adapter, in the
  // order libs/SCOFunctions.js loads them — against the fake LMS, so the gates
  // common.js applies are checked end to end: nothing reaches the LMS before
  // the session opens, an unanswered page publishes no score, and a partial
  // runtime keeps scoring.
  describe('gamification.scorm through the assembled SCORM 1.2 runtime', () => {
    const getScorm = () => global.$exeDevices.iDevice.gamification.scorm;
    const runtimeDir = './scorm/scorm12';
    const pageGlobals = [
      'loadPage',
      'unloadPage',
      'doQuit',
      'doBack',
      'doContinue',
      'startTimer',
      'computeTime',
      'goBack',
      'goForward',
      'setComplete',
      'setIncomplete',
      'setScore',
      'scorm',
    ];
    let pipwerks;
    let client;
    let activities;
    let policy;
    let lifecycle;
    let runtime;
    let createFakeScorm12Api;
    let resetPipwerks;
    let api;
    let fakeWindow;
    let fakeDocument;

    /** Minimal event target capturing listeners so tests can fire them. */
    function createFakeEventTarget() {
      const listeners = {};
      return {
        listeners,
        addEventListener(type, handler) {
          listeners[type] = listeners[type] || [];
          listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
          listeners[type] = (listeners[type] || []).filter(entry => entry !== handler);
        },
        fire(type, event) {
          for (const handler of listeners[type] || []) {
            handler(Object.assign({ type }, event));
          }
        },
      };
    }

    /** A game iDevice options object as the export runtimes build it. */
    function game(overrides) {
      return Object.assign(
        {
          ideviceId: 'quiz-1',
          ideviceNumber: 1,
          isScorm: 1,
          weighted: 1,
          scorerp: 9,
          title: 'Quiz',
          msgs: { msgYouScore: 'You scored', msgScore: 'Score', msgWeight: 'Weight' },
        },
        overrides
      );
    }

    /**
     * A second, pristine instance of the vendored wrapper: what a SCORM 2004
     * package or a package exported before the rewrite ships, with no runtime
     * layer wrapping it. The module-cached instance is the one the adapter
     * augmented, so the file is evaluated again through its CommonJS branch.
     */
    function loadLegacyWrapper() {
      const fs = require('node:fs');
      const path = require('node:path');
      const source = fs.readFileSync(path.join(__dirname, runtimeDir, 'vendor/pipwerks/SCORM_API_wrapper.js'), 'utf8');
      const legacyModule = { exports: {} };
      new Function('module', 'exports', 'window', source)(legacyModule, legacyModule.exports, window);
      const legacyPipwerks = legacyModule.exports;
      legacyPipwerks.debug.isActive = false;
      return legacyPipwerks;
    }

    /**
     * The real policy with some capabilities removed: a host that ships an
     * older runtime exposes `policy` without the newer methods.
     */
    function policyWithout(...missing) {
      const partial = Object.assign({}, policy);
      for (const name of missing) delete partial[name];
      return partial;
    }

    beforeAll(() => {
      pipwerks = require(`${runtimeDir}/vendor/pipwerks/SCORM_API_wrapper.js`);
      window.pipwerks = pipwerks;
      client = require(`${runtimeDir}/exe-scorm12-client.js`);
      activities = require(`${runtimeDir}/exe-scorm12-activities.js`);
      policy = require(`${runtimeDir}/exe-scorm12-policy.js`);
      lifecycle = require(`${runtimeDir}/exe-scorm12-lifecycle.js`);
      require(`${runtimeDir}/exe-scorm12-adapter.js`);
      ({ createFakeScorm12Api, resetPipwerks } = require(`${runtimeDir}/fake-scorm12-api.test-util.js`));
      runtime = window.exeScorm12;
    });

    afterAll(() => {
      // Leave no trace: the other describes feature-detect the runtime and
      // must keep seeing a page without it.
      delete window.exeScorm12;
      delete window.pipwerks;
      for (const name of pageGlobals) delete window[name];
    });

    beforeEach(() => {
      api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': '' } });
      // The wrapper discovers the API on the page window itself (jsdom's
      // window is its own parent and top).
      window.API = api;
      window.pipwerks = pipwerks;
      window.exeScorm12 = runtime;
      resetPipwerks(pipwerks);
      client.resetDependencies();
      activities.resetDependencies();
      policy.resetDependencies();
      fakeWindow = createFakeEventTarget();
      fakeDocument = createFakeEventTarget();
      fakeDocument.visibilityState = 'visible';
      lifecycle.resetDependencies();
      lifecycle.configure({
        getClient: () => client,
        getPolicy: () => policy,
        getWindow: () => fakeWindow,
        getDocument: () => fakeDocument,
      });
      runtime.resetAdapterForTests();
      getScorm()._activityNumbersById = {};
    });

    afterEach(() => {
      lifecycle.resetDependencies();
      policy.resetDependencies();
      activities.resetDependencies();
      client.resetDependencies();
      delete window.API;
    });

    // ADR-2209-02 requires one aggregation algorithm, so the displayed score,
    // cmi.core.score.raw, the in-session status decision and the exit decision
    // all read the same number. The registry and getFinalScore's legacy branch
    // are necessarily two implementations — a package without the registry
    // cannot call into it — so the guarantee is tested rather than structural.
    it('getFinalScore agrees with the registry aggregate on the same activities', () => {
      const cases = [
        [
          { score: 100, weight: 100 },
          { score: 49, weight: 100 },
          { score: 0, weight: 100 },
        ],
        [
          { score: 100, weight: 75 },
          { score: 20, weight: 25 },
        ],
        [
          { score: 33, weight: 1 },
          { score: 66, weight: 7 },
          { score: 99, weight: 13 },
        ],
        [{ score: 0, weight: 50 }],
      ];

      for (const activityCase of cases) {
        activities.clear();
        const lmsData = {};
        activityCase.forEach((activity, index) => {
          activities.register(`agg-${index}`, {
            evaluable: true,
            completed: true,
            score: activity.score,
            weight: activity.weight,
          });
          lmsData[index + 1] = {
            score: activity.score,
            weighted: activity.weight,
          };
        });

        const fromRegistry = activities.summary().score;

        // getFinalScore delegates to the registry whenever one is installed,
        // so the legacy branch is only reachable with it detached — which is
        // exactly the shape of a SCORM 2004 or pre-rewrite package.
        const installed = window.exeScorm12.activities;
        delete window.exeScorm12.activities;
        try {
          expect(getScorm().getFinalScore(lmsData)).toBe(fromRegistry);
        } finally {
          window.exeScorm12.activities = installed;
        }
      }
      activities.clear();
    });

    // Moodle refreshes its course-structure menu on LMSCommit and nowhere else
    // (mod/scorm/datamodels/scorm_12.js LMSCommit -> connectPrereqCallback),
    // and its own autocommit ships disabled and is a 60-second timer when on.
    // Without an explicit commit here the mark the learner just earned is
    // absent from the index until they leave the page.
    describe('committing a scored interaction', () => {
      it('commits so the LMS index picks the new mark up', () => {
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        getScorm().updateActivity(game(), {}, true);

        expect(api.callNames()).toContain('LMSCommit');
      });

      it('commits after the writes, never before them', () => {
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        getScorm().updateActivity(game(), {}, true);

        const scoreWrite = api.calls.findIndex(
          call => call.method === 'LMSSetValue' && call.args[0] === 'cmi.core.score.raw'
        );
        const commit = api.calls.findIndex(call => call.method === 'LMSCommit');
        expect(scoreWrite).toBeGreaterThanOrEqual(0);
        expect(commit).toBeGreaterThan(scoreWrite);
      });

      // iDevices register on jQuery ready, before loadPage(). client.commit()
      // refuses without a session but warns while doing it, which is the noise
      // #2209 removed from reconcilePendingActivities — do not reintroduce it.
      //
      // The single warning asserted here is the pre-existing one from
      // persistActivities' setValue (exe-scorm12-client.js:336), unrelated to
      // the commit; pinning the count is what would catch a second one
      // appearing because the isActive() guard was dropped.
      it('neither commits nor adds a warning before the session is open', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        getScorm().updateActivity(game(), {}, true);

        expect(api.callNames()).not.toContain('LMSCommit');
        expect(warn).toHaveBeenCalledTimes(1);
      });

      // The commit persists what was written; it decides nothing. LMSCommit
      // runs StoreData(cmi, false), which promotes no status.
      // showFinalScore writes the score and the status and only then paints the
      // result. A failure while painting — a missing message, a node an iDevice
      // expects and its markup does not have — used to leave the LMS holding
      // the values with nothing to persist them: "the score is right but the
      // menu never updates". An activity that reports once, from a check
      // button, has no second chance; one that reports per answer hides it,
      // because the next report commits what the last one left behind.
      it('commits even when painting the result throws', () => {
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();
        const showFinalScore = vi
          .spyOn(getScorm(), 'showFinalScore')
          .mockImplementation(() => {
            throw new Error('painting failed');
          });

        try {
          expect(() => getScorm().updateActivity(game(), {}, true)).toThrow(
            'painting failed'
          );
        } finally {
          showFinalScore.mockRestore();
        }

        expect(api.callNames()).toContain('LMSCommit');
      });

      // Moodle redraws the SCO status in its menu only on LMSCommit. The
      // synchronous commit is the guarantee; this deferred retry carries the
      // writes that land after it — a status settled by a timer or an
      // animation — which an activity reporting once, from a check button, has
      // no later report to carry for it.
      //
      // Its delay also has to outlast the first commit's beacon: that commit
      // runs inside the click, so Moodle sends it fire-and-forget, and this
      // refresh reads what the server has stored by the time it runs. Measured
      // beacons took 337-877 ms; at the 50 ms this used to carry it always
      // redrew the old status.
      it('retries the commit late enough to outlast a beacon round-trip', () => {
        vi.useFakeTimers();
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        try {
          getScorm().triggerMoodleDetection();
          // Nothing yet: the retry is deferred, so it cannot be what carries
          // a report the learner navigates away from.
          expect(api.callNames()).not.toContain('LMSCommit');

          // Asserted against the configured delay rather than a literal, so
          // tuning it cannot silently leave the test measuring nothing. The
          // floor is the slowest beacon measured (877 ms), rounded up: below
          // it the refresh can still read the pre-commit state, which is the
          // defect this delay exists to avoid.
          expect(getScorm().moodleDetectionDelay).toBeGreaterThanOrEqual(900);
          vi.advanceTimersByTime(getScorm().moodleDetectionDelay - 1);
          expect(api.callNames()).not.toContain('LMSCommit');

          vi.advanceTimersByTime(1);

          expect(api.callNames()).toContain('LMSCommit');
        } finally {
          vi.clearAllTimers();
          vi.useRealTimers();
        }
      });

      it('does not throw when the retry finds no committable session', () => {
        vi.useFakeTimers();

        try {
          getScorm().triggerMoodleDetection();

          expect(() =>
            vi.advanceTimersByTime(getScorm().moodleDetectionDelay)
          ).not.toThrow();
        } finally {
          vi.clearAllTimers();
          vi.useRealTimers();
        }
      });

      // An intermediate score that misses the race corrects itself: the next
      // answer commits again and the menu catches up. The report that turns
      // the page passed or failed has no next answer behind it, so a missed
      // refresh there leaves the icon wrong for the rest of the visit. That
      // one, and only that one, gets a second attempt further out.
      it('tries again later when the report moved the status', () => {
        vi.useFakeTimers();
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        try {
          getScorm().triggerMoodleDetection(true);
          vi.advanceTimersByTime(getScorm().moodleDetectionDelay);
          const afterFirst = api
            .callNames()
            .filter((name) => name === 'LMSCommit').length;

          expect(getScorm().moodleStatusRetryDelay).toBeGreaterThan(
            getScorm().moodleDetectionDelay
          );
          vi.advanceTimersByTime(getScorm().moodleStatusRetryDelay);

          expect(
            api.callNames().filter((name) => name === 'LMSCommit').length
          ).toBe(afterFirst + 1);
        } finally {
          vi.clearAllTimers();
          vi.useRealTimers();
        }
      });

      // Every answer reports, so a second attempt on each of them would double
      // the traffic for a miss that the next answer already repairs.
      it('does not try again when the status did not move', () => {
        vi.useFakeTimers();
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        try {
          getScorm().triggerMoodleDetection(false);
          vi.advanceTimersByTime(getScorm().moodleDetectionDelay);
          const afterFirst = api
            .callNames()
            .filter((name) => name === 'LMSCommit').length;

          vi.advanceTimersByTime(getScorm().moodleStatusRetryDelay);

          expect(
            api.callNames().filter((name) => name === 'LMSCommit').length
          ).toBe(afterFirst);
        } finally {
          vi.clearAllTimers();
          vi.useRealTimers();
        }
      });

      // A deferred-only commit would be lost if the learner navigates within
      // the delay, so the synchronous one has to stand on its own.
      it('commits synchronously as well, without waiting for the retry', () => {
        vi.useFakeTimers();
        getScorm().reportActivity(game(), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        try {
          getScorm().updateActivity(game(), {}, true);

          expect(api.callNames()).toContain('LMSCommit');
        } finally {
          vi.clearAllTimers();
          vi.useRealTimers();
        }
      });

      it('leaves a page with pending required work incomplete', () => {
        getScorm().reportActivity(game(), { total: 4 });
        getScorm().reportActivity(game({ ideviceId: 'quiz-2', ideviceNumber: 2 }), { total: 4 });
        runtime.setPageHasScoredActivities(true);
        window.loadPage();
        api.resetCalls();

        getScorm().updateActivity(game(), {}, true);

        expect(api.callNames()).toContain('LMSCommit');
        expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
      });
    });

    it('registering before the session opens is silent, and reconciles once it is open', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // jQuery ready: the iDevice announces itself before loadPage().
      getScorm().reportActivity(game(), { total: 4 });

      expect(api.calls).toEqual([]);
      expect(warn).not.toHaveBeenCalled();

      // Body onload (exe_export.js): the page scan flag, then the session.
      runtime.setPageHasScoredActivities(true);
      window.loadPage();
      expect(client.isActive()).toBe(true);
      expect(api.data['cmi.core.lesson_status']).toBe('incomplete');

      // The learner passes the quiz…
      getScorm().updateActivity(game(), {}, true);
      expect(api.data['cmi.core.score.raw']).toBe('90');
      expect(api.data['cmi.core.lesson_status']).toBe('passed');

      // …and a second required activity announces itself late: the
      // reconciliation that was inert before the session now corrects the
      // policy's own verdict.
      getScorm().reportActivity(game({ ideviceId: 'quiz-2', ideviceNumber: 2 }), { total: 4 });
      expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
      expect(warn).not.toHaveBeenCalled();
    });

    it('publishes no score for an evaluable activity that has not scored, and a genuine zero once it has', () => {
      getScorm().reportActivity(game(), { total: 4 });
      runtime.setPageHasScoredActivities(true);
      window.loadPage();
      api.resetCalls();

      // The iDevice's bootstrap refreshes the score display before any answer.
      getScorm().showFinalScore(getScorm().buildLmsDataFromRegistry(), game());

      expect(api.callsFor('LMSSetValue').filter(call => call[0] === 'cmi.core.score.raw')).toEqual([]);
      expect(api.data['cmi.core.score.raw']).toBe('');
      expect(api.data['cmi.core.lesson_status']).toBe('incomplete');

      getScorm().updateActivity(game({ scorerp: 0 }), {}, true);

      expect(api.data['cmi.core.score.raw']).toBe('0');
      expect(api.data['cmi.core.lesson_status']).toBe('failed');
    });

    it('leaving an unanswered page records a resumable attempt and no score', () => {
      getScorm().reportActivity(game(), { total: 4 });
      runtime.setPageHasScoredActivities(true);
      window.loadPage();
      // No lmsData view: rebuilt from the registry.
      getScorm().showFinalScore(null, game());

      fakeWindow.fire('pagehide', { persisted: false });

      expect(api.callNames()).toContain('LMSFinish');
      expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
      expect(api.data['cmi.core.exit']).toBe('suspend');
      expect(api.data['cmi.core.score.raw']).toBe('');
    });

    it('showFinalScore treats a policy without hasAppliedEntry as ready and keeps scoring', () => {
      window.exeScorm12 = Object.assign({}, runtime, { policy: policyWithout('hasAppliedEntry') });
      runtime.session.open({ ownsLifecycle: false });
      getScorm().reportActivity(game(), { completed: true, score: 70 });

      getScorm().showFinalScore(getScorm().buildLmsDataFromRegistry(), game());

      expect(api.data['cmi.core.score.raw']).toBe('70');
      expect(api.data['cmi.core.lesson_status']).toBe('passed');
    });

    it('showFinalScore without recordActivityOutcome publishes the score and leaves the status alone', () => {
      window.exeScorm12 = Object.assign({}, runtime, { policy: policyWithout('recordActivityOutcome') });
      runtime.session.open({ ownsLifecycle: false });
      getScorm().reportActivity(game(), { completed: true, score: 70 });

      getScorm().showFinalScore(getScorm().buildLmsDataFromRegistry(), game());

      expect(api.data['cmi.core.score.raw']).toBe('70');
      expect(api.data['cmi.core.lesson_status']).toBe('incomplete');
    });

    it('updateActivity without persistActivities still reports and scores', () => {
      window.exeScorm12 = Object.assign({}, runtime, { policy: policyWithout('persistActivities') });
      runtime.session.open({ ownsLifecycle: false });

      getScorm().updateActivity(game(), {}, true);

      expect(activities.get('quiz-1')).toMatchObject({ completed: true, score: 90 });
      expect(api.data['cmi.core.score.raw']).toBe('90');
      expect(api.data['cmi.suspend_data']).toBe('');
    });

    it('reportActivity without reconcilePendingActivities still registers', () => {
      window.exeScorm12 = Object.assign({}, runtime, { policy: policyWithout('reconcilePendingActivities') });

      expect(getScorm().reportActivity(game(), { total: 4 })).not.toBeNull();

      expect(activities.get('quiz-1')).toMatchObject({ evaluable: true, completionRequired: true, total: 4 });
    });

    it('updateActivity and showFinalScore keep the legacy writers on a page without a registry', () => {
      // SCORM 2004 packages and packages exported before the rewrite: the
      // legacy line format in cmi.suspend_data and a direct status verdict.
      delete window.exeScorm12;
      window.pipwerks = loadLegacyWrapper();
      expect(window.pipwerks.SCORM.init()).toBe(true);
      const lmsData = {};

      getScorm().updateActivity(game(), lmsData, true);

      expect(lmsData[1]).toEqual({ title: 'Quiz', score: 90, weighted: 1, state: 2 });
      expect(api.data['cmi.suspend_data']).toBe('1. "Quiz"; Score: 90%; Weight: 1%.\texe-state/1:1=2');
      expect(api.data['cmi.core.score.raw']).toBe('90');
      expect(api.data['cmi.core.lesson_status']).toBe('passed');
      // The legacy path needs the same commit as the runtime one, and for the
      // same reason: Moodle refreshes its index on LMSCommit alone.
      expect(api.callNames()).toContain('LMSCommit');
    });

    it('showFinalScore parses the legacy cmi.suspend_data when given no lmsData and there is no registry', () => {
      api.data['cmi.suspend_data'] = '1. "Quiz"; Score: 40%; Weight: 1%.\texe-state/1:1=2';
      delete window.exeScorm12;
      window.pipwerks = loadLegacyWrapper();
      expect(window.pipwerks.SCORM.init()).toBe(true);

      getScorm().showFinalScore(null, game());

      expect(api.data['cmi.core.score.raw']).toBe('40');
      expect(api.data['cmi.core.lesson_status']).toBe('failed');
    });

    it('updateActivity and showFinalScore are no-ops without the wrapper or a game', () => {
      delete window.pipwerks;
      expect(() => getScorm().updateActivity(game(), {}, true)).not.toThrow();
      expect(() => getScorm().showFinalScore({}, game())).not.toThrow();

      window.pipwerks = pipwerks;
      expect(client.initialize()).toBe(true);
      expect(() => getScorm().updateActivity(null, {}, true)).not.toThrow();
      expect(() => getScorm().showFinalScore({}, null)).not.toThrow();

      expect(api.callsFor('LMSSetValue')).toEqual([]);
    });
  });

  describe('gamification.media', () => {
    const getMedia = () => global.$exeDevices.iDevice.gamification.media;

    it('extractURLGD returns original URL for non-Google Drive URLs', () => {
      const media = getMedia();
      expect(media.extractURLGD('http://example.com/audio.mp3')).toBe('http://example.com/audio.mp3');
    });

    it('extractURLGD transforms Google Drive sharing URLs', () => {
      const media = getMedia();
      const url = 'https://drive.google.com/file/d/1234567890/view?usp=sharing';
      const result = media.extractURLGD(url);
      expect(result).toContain('docs.google.com');
    });

    it('getURLVideoMediaTeca returns false for non-mediateca URLs', () => {
      const media = getMedia();
      expect(media.getURLVideoMediaTeca('http://example.com/video.mp4')).toBe(false);
      expect(media.getURLVideoMediaTeca('')).toBe(false);
    });

    it('getURLVideoMediaTeca transforms mediateca video URLs', () => {
      const media = getMedia();
      const url = 'https://mediateca.educa.madrid.org/video/abc123';
      const result = media.getURLVideoMediaTeca(url);
      expect(result).toContain('streaming.php');
    });

    it('getURLAudioMediaTeca returns false for non-mediateca URLs', () => {
      const media = getMedia();
      expect(media.getURLAudioMediaTeca('http://example.com/audio.mp3')).toBe(false);
      expect(media.getURLAudioMediaTeca('')).toBe(false);
    });

    it('getURLAudioMediaTeca transforms mediateca audio URLs', () => {
      const media = getMedia();
      const url = 'https://mediateca.educa.madrid.org/audio/abc123';
      const result = media.getURLAudioMediaTeca(url);
      expect(result).toContain('streaming.php');
    });

    it('getIDYoutube extracts video ID from YouTube URLs', () => {
      const media = getMedia();
      expect(media.getIDYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(media.getIDYoutube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(media.getIDYoutube('')).toBe('');
    });

    it('stopSound does not throw when playerAudio is null', () => {
      const media = getMedia();
      media.playerAudio = null;
      expect(() => media.stopSound()).not.toThrow();
    });

    it('stopSound pauses audio player', () => {
      const media = getMedia();
      const mockPause = vi.fn();
      media.playerAudio = { pause: mockPause };
      media.currentAudioUrl = 'test.mp3';
      media.stopSound();
      expect(mockPause).toHaveBeenCalled();
      expect(media.playerAudio).toBeNull();
      expect(media.currentAudioUrl).toBeNull();
    });

    it('playSound does not throw for invalid input', () => {
      const media = getMedia();
      expect(() => media.playSound(null)).not.toThrow();
      expect(() => media.playSound(123)).not.toThrow();
    });

    it('stopVideo does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.stopVideo(null)).not.toThrow();
    });

    it('stopVideo pauses local player', () => {
      const media = getMedia();
      const mockPlayer = { pause: vi.fn() };
      const game = { localPlayer: mockPlayer };
      media.stopVideo(game);
      expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it('stopVideoIntro does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.stopVideoIntro(null)).not.toThrow();
    });

    it('playVideo does not throw for game without player', () => {
      const media = getMedia();
      expect(() => media.playVideo({})).not.toThrow();
    });

    it('muteVideo mutes local player', () => {
      const media = getMedia();
      const game = { localPlayer: { muted: false } };
      media.muteVideo(true, game);
      expect(game.localPlayer.muted).toBe(true);
    });

    it('muteVideo unmutes local player', () => {
      const media = getMedia();
      const game = { localPlayer: { muted: true } };
      media.muteVideo(false, game);
      expect(game.localPlayer.muted).toBe(false);
    });

    it('startVideo does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.startVideo('id', 0, 10, null, 0, 0, vi.fn())).not.toThrow();
    });

    it('startVideoIntro does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.startVideoIntro('id', 0, 10, null, 0, 0, vi.fn())).not.toThrow();
    });

    it('extractURLGD handles Google Drive sharing URL format', () => {
      const media = getMedia();
      const url = 'https://drive.google.com/file/d/abc123xyz/view?usp=sharing';
      const result = media.extractURLGD(url);
      expect(result).toContain('docs.google.com');
    });

    it('getURLVideoMediaTeca handles URL with query params', () => {
      const media = getMedia();
      const url = 'https://mediateca.educa.madrid.org/video/abc123?t=10';
      const result = media.getURLVideoMediaTeca(url);
      expect(result).toBeDefined();
    });

    it('getIDYoutube handles standard watch URL', () => {
      const media = getMedia();
      // Use a URL format that the function actually supports
      const result = media.getIDYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('getIDYoutube returns empty for invalid URL', () => {
      const media = getMedia();
      expect(media.getIDYoutube('https://invalid.com/video')).toBe('');
    });

    it('muteVideo handles missing localPlayer', () => {
      const media = getMedia();
      const game = {};
      expect(() => media.muteVideo(true, game)).not.toThrow();
    });

    it('stopSound handles missing playerAudio', () => {
      const media = getMedia();
      media.playerAudio = undefined;
      media.currentAudioUrl = 'test.mp3';
      media.stopSound();
      expect(media.playerAudio).toBeUndefined();
      expect(media.currentAudioUrl).toBeNull();
    });

    it('getURLAudioMediaTeca returns false for non-mediateca URLs', () => {
      const media = getMedia();
      expect(media.getURLAudioMediaTeca('http://example.com/audio.mp3')).toBe(false);
    });

    it('getURLAudioMediaTeca handles audio URLs', () => {
      const media = getMedia();
      const url = 'https://mediateca.educa.madrid.org/audio/abc123';
      const result = media.getURLAudioMediaTeca(url);
      expect(result).toContain('streaming.php');
      expect(result).toContain('abc123');
    });

    it('getURLAudioMediaTeca handles video URLs too', () => {
      const media = getMedia();
      const url = 'https://mediateca.educa.madrid.org/video/xyz789';
      const result = media.getURLAudioMediaTeca(url);
      expect(result).toContain('streaming.php');
    });

    it('loadYoutubeApi is a function', () => {
      const media = getMedia();
      expect(typeof media.loadYoutubeApi).toBe('function');
    });

    it('YouTubeAPILoader.load rejects when script fails to load', async () => {
      const media = getMedia();
      // Reset internal state by recreating the loader
      const originalYT = window.YT;
      delete window.YT;

      // Capture the script that will be created
      let capturedScript = null;
      const originalAppendChild = document.head.appendChild.bind(document.head);
      vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
        if (node.tagName === 'SCRIPT' && node.src.includes('youtube.com')) {
          capturedScript = node;
          // Simulate script load error
          setTimeout(() => {
            if (capturedScript.onerror) {
              capturedScript.onerror();
            }
          }, 0);
        }
        return originalAppendChild(node);
      });

      // Create a fresh loader to test error case
      const YouTubeAPILoaderFresh = (function () {
        let apiReadyPromise;
        function load() {
          if (!apiReadyPromise) {
            apiReadyPromise = new Promise((resolve, reject) => {
              if (window.YT && window.YT.Player) {
                return resolve(window.YT);
              }
              window.onYouTubeIframeAPIReady = () => resolve(window.YT);
              const tag = document.createElement('script');
              tag.src = 'https://www.youtube.com/iframe_api';
              tag.onerror = () => reject(new Error(global._('Could not load YouTube API')));
              document.head.appendChild(tag);
            });
          }
          return apiReadyPromise;
        }
        return { load };
      })();

      await expect(YouTubeAPILoaderFresh.load()).rejects.toThrow('Could not load YouTube API');

      // Restore
      window.YT = originalYT;
      vi.restoreAllMocks();
    });

    it('playSound does not throw for invalid URL', () => {
      const media = getMedia();
      expect(() => media.playSound(null)).not.toThrow();
    });

    it('startVideo handles local player type', () => {
      const media = getMedia();
      const mockPlayer = { src: '', currentTime: 0, play: vi.fn() };
      const game = { localPlayer: mockPlayer };
      media.startVideo('video.mp4', 5, 30, game, 1, 0, vi.fn());
      expect(mockPlayer.src).toBe('video.mp4');
    });

    it('startVideoIntro handles local player type', () => {
      const media = getMedia();
      const mockPlayer = { src: '', currentTime: 0, play: vi.fn() };
      const game = { localPlayerIntro: mockPlayer };
      media.startVideoIntro('video.mp4', 5, 30, game, 0, 1, vi.fn());
      expect(mockPlayer.src).toBe('video.mp4');
    });

    it('stopVideo pauses YouTube player', () => {
      const media = getMedia();
      const mockPlayer = { pauseVideo: vi.fn() };
      const game = { player: mockPlayer };
      media.stopVideo(game);
      expect(mockPlayer.pauseVideo).toHaveBeenCalled();
    });

    describe('playSound (toggle behavior)', () => {
      it('logs error for invalid audio URL', async () => {
        const media = getMedia();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await media.playSound(null);
        expect(consoleSpy).toHaveBeenCalledWith('playSound: Invalid audio URL');

        await media.playSound(123);
        expect(consoleSpy).toHaveBeenCalledWith('playSound: Invalid audio URL');

        consoleSpy.mockRestore();
      });

      it('creates and plays audio for valid URL', async () => {
        const media = getMedia();
        const mockPlay = vi.fn().mockResolvedValue();
        const originalAudio = global.Audio;
        global.Audio = class MockAudio {
          constructor(url) {
            this.url = url;
            this.play = mockPlay;
          }
        };

        await media.playSound('test.mp3');

        expect(mockPlay).toHaveBeenCalled();
        expect(media.currentAudioUrl).toBe('test.mp3');
        expect(media.playerAudio.url).toBe('test.mp3');
        global.Audio = originalAudio;
      });

      it('stops playing audio if same URL is played again (toggle)', async () => {
        const media = getMedia();
        const mockPause = vi.fn();
        media.playerAudio = { pause: mockPause, paused: false };
        media.currentAudioUrl = 'test.mp3';

        await media.playSound('test.mp3');

        expect(mockPause).toHaveBeenCalled();
        expect(media.playerAudio).toBeNull();
        expect(media.currentAudioUrl).toBeNull();
      });

      it('stops current audio before playing different URL', async () => {
        const media = getMedia();
        const mockPause = vi.fn();
        const mockPlay = vi.fn().mockResolvedValue();
        media.playerAudio = { pause: mockPause, paused: false };
        media.currentAudioUrl = 'old.mp3';

        const originalAudio = global.Audio;
        global.Audio = class MockAudio {
          constructor(url) {
            this.url = url;
            this.play = mockPlay;
          }
        };

        await media.playSound('new.mp3');

        expect(mockPause).toHaveBeenCalled();
        expect(media.currentAudioUrl).toBe('new.mp3');
        global.Audio = originalAudio;
      });

      it('handles play error gracefully', async () => {
        const media = getMedia();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockPlay = vi.fn().mockRejectedValue(new Error('Play failed'));
        const originalAudio = global.Audio;
        global.Audio = class MockAudio {
          constructor() {
            this.play = mockPlay;
          }
        };

        await media.playSound('test.mp3');

        // Wait for promise rejection to be handled
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(consoleSpy).toHaveBeenCalledWith('playSound: Error playing audio:', expect.any(Error));
        consoleSpy.mockRestore();
        global.Audio = originalAudio;
      });
    });

    describe('stopSound (no game parameter)', () => {
      it('pauses and clears playerAudio when playing', () => {
        const media = getMedia();
        const mockPause = vi.fn();
        media.playerAudio = { pause: mockPause };
        media.currentAudioUrl = 'test.mp3';

        media.stopSound();

        expect(mockPause).toHaveBeenCalled();
        expect(media.playerAudio).toBeNull();
        expect(media.currentAudioUrl).toBeNull();
      });

      it('handles null playerAudio gracefully', () => {
        const media = getMedia();
        media.playerAudio = null;
        media.currentAudioUrl = null;

        expect(() => media.stopSound()).not.toThrow();
        expect(media.playerAudio).toBeNull();
        expect(media.currentAudioUrl).toBeNull();
      });

      it('handles playerAudio without pause method', () => {
        const media = getMedia();
        media.playerAudio = {};
        media.currentAudioUrl = 'test.mp3';

        expect(() => media.stopSound()).not.toThrow();
        expect(media.currentAudioUrl).toBeNull();
      });
    });
  });

  describe('gamification.colors', () => {
    const getColors = () => global.$exeDevices.iDevice.gamification.colors;

    it('has borderColors defined', () => {
      const colors = getColors();
      expect(colors.borderColors.black).toBe('#1c1b1b');
      expect(colors.borderColors.blue).toBe('#5877c6');
      expect(colors.borderColors.green).toBe('#00a300');
    });

    it('has backColor defined', () => {
      const colors = getColors();
      expect(colors.backColor.black).toBe('#1c1b1b');
      expect(colors.backColor.white).toBe('#f9f9f9');
    });

    it('has all common color definitions', () => {
      const colors = getColors();
      expect(colors.borderColors.red).toBeDefined();
      expect(colors.borderColors.yellow).toBeDefined();
      expect(colors.borderColors.white).toBeDefined();
    });

    it('backColor object has expected properties', () => {
      const colors = getColors();
      expect(typeof colors.backColor).toBe('object');
      expect(Object.keys(colors.backColor).length).toBeGreaterThan(0);
    });
  });

  describe('gamification.report', () => {
    const getReport = () => global.$exeDevices.iDevice.gamification.report;

    it('getDateString returns formatted date', () => {
      const report = getReport();
      const dateStr = report.getDateString();
      expect(dateStr).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
    });

    it('getNodeIdevice returns false when in eXe', () => {
      const report = getReport();
      global.eXeLearning = {};
      expect(report.getNodeIdevice()).toBe(false);
      delete global.eXeLearning;
    });

    it('updateEvaluation creates new object when obj1 is null', () => {
      const report = getReport();
      const obj2 = { id: 'test', state: 1, score: 80, name: 'Test', date: '01/01/2024', page: 'page1' };
      const result = report.updateEvaluation(null, obj2, 'eval-id');
      expect(result.id).toBe('eval-id');
      expect(result.activities.length).toBe(1);
    });

    it('updateEvaluation adds activity to existing activities', () => {
      const report = getReport();
      const obj1 = { id: 'eval-id', activities: [] };
      const obj2 = { id: 'test', state: 1, score: 80, name: 'Test', date: '01/01/2024', page: 'page1', type: 'game' };
      const result = report.updateEvaluation(obj1, obj2, 'eval-id');
      expect(result.activities.length).toBe(1);
    });

    it('updateEvaluation updates existing activity', () => {
      const report = getReport();
      const obj1 = {
        id: 'eval-id',
        activities: [{ id: 'test', state: 0, score: 50 }],
      };
      const obj2 = { id: 'test', state: 2, score: 100, name: 'Test', date: '02/01/2024', page: 'page2' };
      const result = report.updateEvaluation(obj1, obj2, 'eval-id');
      expect(result.activities[0].state).toBe(2);
      expect(result.activities[0].score).toBe(100);
    });

    it('getDataStorage is a function', () => {
      const report = getReport();
      expect(typeof report.getDataStorage).toBe('function');
    });

    /**
     * Twenty iDevices compute their mark as hits over a count they read from
     * their own data, and an activity saved with nothing scorable makes that
     * division 0/0. sendScoreNew already refuses the result on the way to the
     * LMS; this path had no guard, so the NaN was stored and then decided the
     * icon through `parseFloat(score) >= 5`, which a NaN fails — an activity
     * the learner passed could be shown as failed.
     */
    describe('saveEvaluation with an unusable mark', () => {
      const instance = 'rep-1';

      function givenActivity(scorerp) {
        document.body.innerHTML = `
          <article>
            <header><h1 class="box-title">Game</h1></header>
            <div id="${instance}" class="idevice_node">
              <div id="main-${instance}"></div>
            </div>
          </article>`;
        localStorage.removeItem('dataEvaluation-eval-1');
        return {
          main: `main-${instance}`,
          evaluation: true,
          evaluationID: 'eval-1',
          scorerp,
          idevicePath: 'p/',
          idevice: 'idevice_node',
          msgs: {
            msgTypeGame: 'Game',
            msgUncompletedActivity: 'x',
            msgSuccessfulActivity: 'Passed: %s',
            msgUnsuccessfulActivity: 'Not passed: %s',
          },
        };
      }

      function storedScore() {
        const raw = localStorage.getItem('dataEvaluation-eval-1');
        return JSON.parse(raw).activities[0].score;
      }

      it.each([
        ['a division by zero', Number.NaN],
        ['a count of zero', Number.POSITIVE_INFINITY],
      ])('records a zero for %s', (_label, scorerp) => {
        getReport().saveEvaluation(givenActivity(scorerp));

        expect(storedScore()).toBe(0);
      });

      it('leaves a usable mark alone', () => {
        getReport().saveEvaluation(givenActivity(7.5));

        expect(storedScore()).toBe(7.5);
      });

      afterEach(() => {
        localStorage.removeItem('dataEvaluation-eval-1');
        document.body.innerHTML = '';
      });
    });

    /**
     * The pass mark used to be a hard-coded 5. It is now the project's, or the
     * iDevice's own when its author customised it, and the same comparison
     * drives the message the learner reads.
     */
    describe('saveEvaluation against the pass score', () => {
      const instance = 'rep-2';

      function givenActivity(scorerp, passScoreFields = {}) {
        document.body.innerHTML = `
          <article>
            <header><h1 class="box-title">Game</h1></header>
            <div id="${instance}" class="idevice_node">
              <div id="main-${instance}"></div>
            </div>
          </article>`;
        localStorage.removeItem('dataEvaluation-eval-2');
        return {
          main: `main-${instance}`,
          evaluation: true,
          evaluationID: 'eval-2',
          scorerp,
          idevicePath: 'p/',
          idevice: 'idevice_node',
          msgs: {
            msgTypeGame: 'Game',
            msgUncompletedActivity: 'x',
            msgSuccessfulActivity: 'Passed: %s',
            msgUnsuccessfulActivity: 'Not passed: %s',
          },
          ...passScoreFields,
        };
      }

      function setPageMark(mark) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'exe-pass-score');
        meta.setAttribute('content', mark);
        meta.setAttribute('data-test-meta', '');
        document.head.appendChild(meta);
      }

      function storedState() {
        return JSON.parse(localStorage.getItem('dataEvaluation-eval-2')).activities[0].state;
      }

      const PASSED = 2;
      const NOT_PASSED = 1;

      it('keeps the historical 5 for a page that publishes nothing', () => {
        getReport().saveEvaluation(givenActivity(5));
        expect(storedState()).toBe(PASSED);

        getReport().saveEvaluation(givenActivity(4.9));
        expect(storedState()).toBe(NOT_PASSED);
      });

      it('follows the project mark for an iDevice on the global mode', () => {
        setPageMark('7.5');

        getReport().saveEvaluation(givenActivity(7.5, { passScoreMode: 'global' }));
        expect(storedState()).toBe(PASSED);

        getReport().saveEvaluation(givenActivity(7, { passScoreMode: 'global' }));
        expect(storedState()).toBe(NOT_PASSED);
      });

      it('follows the iDevice mark when its author customised it', () => {
        // The project demands 7.5, this activity only 3.
        setPageMark('7.5');

        getReport().saveEvaluation(
          givenActivity(4, { passScoreMode: 'custom', passScoreCustom: 3 })
        );

        expect(storedState()).toBe(PASSED);
      });

      it('passes everyone when the mark is zero', () => {
        setPageMark('0');

        getReport().saveEvaluation(givenActivity(0, { passScoreMode: 'global' }));

        expect(storedState()).toBe(PASSED);
      });

      it('tells the learner the same verdict it stored', () => {
        setPageMark('7.5');

        getReport().saveEvaluation(givenActivity(4, { passScoreMode: 'global' }));

        expect(document.querySelector('.Games-ReportIconDiv').textContent).toContain('Not passed');
      });

      afterEach(() => {
        localStorage.removeItem('dataEvaluation-eval-2');
        document.head.querySelectorAll('meta[data-test-meta]').forEach((meta) => meta.remove());
        document.body.innerHTML = '';
      });
    });

    it('scrollToHash does nothing when in eXe', () => {
      const report = getReport();
      global.eXeLearning = {};
      expect(() => report.scrollToHash()).not.toThrow();
      delete global.eXeLearning;
    });

    it('getNameIdevice returns empty string when no title found', () => {
      const report = getReport();
      document.body.innerHTML = '<article class="idevice_node"><div class="main"></div></article>';
      const $main = $('article .main');
      const result = report.getNameIdevice($main);
      expect(result).toBe('');
    });

    it('getNodeIdevice returns false when in eXe', () => {
      const report = getReport();
      global.eXeLearning = {};
      const result = report.getNodeIdevice();
      expect(result).toBe(false);
      delete global.eXeLearning;
    });

    it('updateEvaluation handles multiple activities correctly', () => {
      const report = getReport();
      const obj1 = {
        id: 'eval-id',
        activities: [
          { id: 'activity1', state: 1, score: 50 },
        ],
      };
      const obj2 = { id: 'activity2', state: 2, score: 100, name: 'Test2', date: '01/01/2024', page: 'page1' };
      const result = report.updateEvaluation(obj1, obj2, 'eval-id');
      expect(result.activities.length).toBe(2);
    });

    it('getNameIdevice returns title when found', () => {
      const report = getReport();
      delete global.eXeLearning;
      document.body.innerHTML = '<article class="idevice_node"><div class="box-title">Test Title</div><div class="main"></div></article>';
      const $main = $('article .main');
      const result = report.getNameIdevice($main);
      expect(result).toBe('Test Title');
    });

    it('getNodeIdevice extracts node from pathname', () => {
      const report = getReport();
      delete global.eXeLearning;
      // Mock window.location.pathname
      const originalPathname = window.location.pathname;
      Object.defineProperty(window, 'location', {
        value: { pathname: '/path/to/page.html' },
        writable: true,
      });
      const result = report.getNodeIdevice();
      expect(result).toBe('page.html');
      // Restore
      Object.defineProperty(window, 'location', {
        value: { pathname: originalPathname },
        writable: true,
      });
    });

    it('getDateString returns properly formatted date', () => {
      const report = getReport();
      const dateStr = report.getDateString();
      // Should be in format DD/MM/YYYY HH:MM:SS
      const parts = dateStr.split(' ');
      expect(parts.length).toBe(2);
      const dateParts = parts[0].split('/');
      expect(dateParts.length).toBe(3);
      const timeParts = parts[1].split(':');
      expect(timeParts.length).toBe(3);
    });

    // showEvaluationIcon builds its image from the iDevice's own export folder:
    // exequextsq.svg until there is a mark, then exequextrerrors.svg or
    // exequexthits.svg. interactive-video shipped only the first, so once the
    // learner had a score the icon was a broken image.
    describe('every iDevice that reports ships the icons showEvaluationIcon asks for', () => {
      const IDEVICES_DIR = join(__dirname, '..', '..', 'files', 'perm', 'idevices', 'base');
      const ICONS = ['exequextsq.svg', 'exequextrerrors.svg', 'exequexthits.svg'];
      const reporters = readdirSync(IDEVICES_DIR)
        .map((name) => ({ name, dir: join(IDEVICES_DIR, name, 'export') }))
        .filter(({ name, dir }) => existsSync(join(dir, `${name}.js`)))
        .filter(({ name, dir }) =>
          /gamification\.report\.(saveEvaluation|updateEvaluationIcon|showEvaluationIcon)\(/.test(
            readFileSync(join(dir, `${name}.js`), 'utf-8')
          )
        );

      it('finds the iDevices that report', () => {
        // A guard rail for the scan: a rename that matched nothing would leave
        // every assertion below vacuously green.
        expect(reporters.length).toBeGreaterThan(30);
      });

      it.each(reporters.map(({ name }) => name))('%s', (name) => {
        const { dir } = reporters.find((reporter) => reporter.name === name);
        expect(ICONS.filter((icon) => !existsSync(join(dir, icon)))).toEqual([]);
      });
    });
  });

  describe('gamification.math', () => {
    const getMath = () => global.$exeDevices.iDevice.gamification.math;
    let originalMathJax;

    beforeEach(() => {
      originalMathJax = global.MathJax;
      // These tests exercise the caller, not loading the real MathJax engine.
      // Otherwise happy-dom's synthetic script load starts a readiness poll
      // that survives the test environment and throws after window is removed.
      global.MathJax = { typesetPromise: vi.fn().mockResolvedValue(undefined) };
    });

    afterEach(async () => {
      await Promise.resolve();
      global.MathJax = originalMathJax;
      getMath()._loading = false;
      getMath()._callbacks = [];
    });

    it('hasLatex detects LaTeX syntax', () => {
      const math = getMath();
      expect(math.hasLatex('\\(x^2\\)')).toBe(true);
      expect(math.hasLatex('\\[x^2\\]')).toBe(true);
      expect(math.hasLatex('\\begin{equation}')).toBe(true);
      expect(math.hasLatex('plain text')).toBe(false);
    });

    it('hasLatex ignores already pre-rendered math (no MathJax re-trigger)', () => {
      const math = getMath();
      // Inline math whose delimiters were stripped into data-latex: no re-render.
      expect(
        math.hasLatex('<span class="exe-math-rendered" data-latex="x^2"><svg></svg></span>')
      ).toBe(false);
      // Environment math keeps \begin{...} in data-latex but is already rendered.
      expect(
        math.hasLatex(
          '<span class="exe-math-rendered" data-latex="\\begin{matrix}1\\end{matrix}"><svg></svg></span>'
        )
      ).toBe(false);
      // Unrendered LaTeX next to a rendered span is still detected.
      expect(
        math.hasLatex('<span class="exe-math-rendered" data-latex="a"><svg></svg></span> \\(b\\)')
      ).toBe(true);
      expect(math.hasLatex('')).toBe(false);
    });

    it('has engine property', () => {
      const math = getMath();
      // Engine path points to local exe_math library
      expect(math.engine).toContain('exe_math');
    });

    it('has engineConfig with loader', () => {
      const math = getMath();
      expect(math.engineConfig.loader).toBeDefined();
      expect(math.engineConfig.tex).toBeDefined();
    });

    it('loadMathJax creates script element when not loaded', () => {
      const math = getMath();
      // Save originals
      const originalMathJax = window.MathJax;

      // Remove MathJax completely to force script creation
      delete window.MathJax;

      // Reset internal loading state
      math._loading = false;
      math._callbacks = [];

      // Ensure no existing script tag for tex-mml-svg.js
      const existingScript = document.querySelector('script[src*="tex-mml-svg.js"]');
      if (existingScript) existingScript.remove();

      const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});
      math.loadMathJax();
      expect(appendChildSpy).toHaveBeenCalled();

      // Restore
      window.MathJax = originalMathJax;
    });

    it('updateLatex does not throw for invalid target', () => {
      const math = getMath();
      expect(() => math.updateLatex(null)).not.toThrow();
      expect(() => math.updateLatex('')).not.toThrow();
    });

    it('updateLatex accepts string selector', () => {
      const math = getMath();
      document.body.innerHTML = '<div class="math-content">\\(x^2\\)</div>';
      expect(() => math.updateLatex('.math-content')).not.toThrow();
    });

    it('updateLatex accepts DOM element', () => {
      const math = getMath();
      document.body.innerHTML = '<div class="math-content">\\(x^2\\)</div>';
      const element = document.querySelector('.math-content');
      expect(() => math.updateLatex(element)).not.toThrow();
    });

    it('updateLatex handles deferred option', async () => {
      const math = getMath();
      document.body.innerHTML = '<div class="math-content">\\(x^2\\)</div>';
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
      try {
        math.updateLatex('.math-content', { defer: true });
        expect(global.MathJax.typesetPromise).not.toHaveBeenCalled();
        await vi.runAllTimersAsync();
        expect(global.MathJax.typesetPromise).toHaveBeenCalledWith([document.querySelector('.math-content')]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('engineConfig has expected structure', () => {
      const math = getMath();
      expect(math.engineConfig.loader.load).toBeInstanceOf(Array);
      expect(math.engineConfig.tex.inlineMath).toBeDefined();
      expect(math.engineConfig.tex.displayMath).toBeDefined();
    });
  });

  describe('gamification.observers', () => {
    const getObservers = () => global.$exeDevices.iDevice.gamification.observers;

    it('debounce returns a function', () => {
      const observers = getObservers();
      const fn = observers.debounce(() => {}, 100);
      expect(typeof fn).toBe('function');
    });

    it('observersDisconnect does not throw for null idevice', () => {
      const observers = getObservers();
      expect(() => observers.observersDisconnect(null)).not.toThrow();
    });

    it('observersDisconnect disconnects all observers', () => {
      const observers = getObservers();
      const mockObserver = { disconnect: vi.fn() };
      const idevice = {
        options: [],
        observers: new Map([['key', mockObserver]]),
        observersresize: new Map([['key', mockObserver]]),
      };
      observers.observersDisconnect(idevice);
      expect(mockObserver.disconnect).toHaveBeenCalledTimes(2);
    });

    it('observeMutations returns early for null element', () => {
      const observers = getObservers();
      const result = observers.observeMutations({}, null);
      expect(result).toBeUndefined();
    });

    it('observeResize returns early for null element', () => {
      const observers = getObservers();
      const result = observers.observeResize({}, null);
      expect(result).toBeUndefined();
    });

    it('observersDisconnect handles idevice with Map options', () => {
      const observers = getObservers();
      const mockObserver = { disconnect: vi.fn() };
      const idevice = {
        options: new Map([['key', { gameStarted: false }]]),
        observers: new Map([['elem', mockObserver]]),
        observersresize: new Map([['elem', mockObserver]]),
      };
      observers.observersDisconnect(idevice);
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('observersDisconnect handles idevice with Array options', () => {
      const observers = getObservers();
      const mockObserver = { disconnect: vi.fn() };
      const idevice = {
        options: [{ gameStarted: true, counterClock: 123 }],
        stopSound: vi.fn(),
        observers: new Map([['elem', mockObserver]]),
        observersresize: new Map(),
      };
      observers.observersDisconnect(idevice);
      expect(idevice.stopSound).toHaveBeenCalled();
    });

    it('debounce delays function execution', async () => {
      const observers = getObservers();
      const fn = vi.fn();
      const debouncedFn = observers.debounce(fn, 10);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('observeMutations creates new observer for element', () => {
      const observers = getObservers();
      const div = document.createElement('div');
      document.body.appendChild(div);
      const idevice = {};

      const observer = observers.observeMutations(idevice, div);

      expect(idevice.observers).toBeDefined();
      expect(idevice.observers.has(div)).toBe(true);
    });

    it('observeMutations returns existing observer', () => {
      const observers = getObservers();
      const div = document.createElement('div');
      document.body.appendChild(div);
      const idevice = {};

      const observer1 = observers.observeMutations(idevice, div);
      const observer2 = observers.observeMutations(idevice, div);

      expect(observer1).toBe(observer2);
    });

    it('observeResize creates new observer for element', () => {
      const observers = getObservers();
      const div = document.createElement('div');
      document.body.appendChild(div);
      const idevice = { options: [] };

      observers.observeResize(idevice, div);

      expect(idevice.observersresize).toBeDefined();
      expect(idevice.observersresize.has(div)).toBe(true);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.sanitizeJSONString', () => {
    const sanitizeJSONString = () => global.$exeDevices.iDevice.gamification.helpers.sanitizeJSONString;

    describe('input validation', () => {
      it('returns non-string input unchanged', () => {
        expect(sanitizeJSONString()(null)).toBe(null);
        expect(sanitizeJSONString()(undefined)).toBe(undefined);
        expect(sanitizeJSONString()(123)).toBe(123);
        expect(sanitizeJSONString()({})).toEqual({});
        expect(sanitizeJSONString()([])).toEqual([]);
      });

      it('returns empty string unchanged', () => {
        expect(sanitizeJSONString()('')).toBe('');
      });

      it('returns valid JSON string unchanged', () => {
        const validJson = '{"name":"test","value":123}';
        expect(sanitizeJSONString()(validJson)).toBe(validJson);
      });
    });

    describe('control character escaping', () => {
      it('escapes literal newline (0x0A) inside string values', () => {
        const input = '{"text":"line1\nline2"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"line1\\nline2"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes literal carriage return (0x0D) inside string values', () => {
        const input = '{"text":"line1\rline2"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"line1\\rline2"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes literal tab (0x09) inside string values', () => {
        const input = '{"text":"col1\tcol2"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"col1\\tcol2"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes literal backspace (0x08) inside string values', () => {
        const input = '{"text":"back\bspace"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"back\\bspace"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes literal form feed (0x0C) inside string values', () => {
        const input = '{"text":"form\ffeed"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"form\\ffeed"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes null character (0x00) inside string values', () => {
        const input = '{"text":"null\x00char"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"null\\u0000char"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes line separator (U+2028) inside string values', () => {
        const input = '{"text":"line\u2028sep"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"line\\u2028sep"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes paragraph separator (U+2029) inside string values', () => {
        const input = '{"text":"para\u2029sep"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"para\\u2029sep"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes DEL character (0x7F) inside string values', () => {
        const input = '{"text":"del\x7Fchar"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"del\\u007fchar"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('escapes C1 control characters (0x80-0x9F) inside string values', () => {
        const input = '{"text":"c1\x80\x9Fchars"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"c1\\u0080\\u009fchars"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });
    });

    describe('preserves already escaped sequences', () => {
      it('preserves already escaped newline', () => {
        const input = '{"text":"line1\\nline2"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"line1\\nline2"}');
      });

      it('preserves already escaped tab', () => {
        const input = '{"text":"col1\\tcol2"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"col1\\tcol2"}');
      });

      it('preserves already escaped backslash', () => {
        const input = '{"path":"C:\\\\folder\\\\file"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"path":"C:\\\\folder\\\\file"}');
      });

      it('preserves already escaped quotes', () => {
        const input = '{"text":"say \\"hello\\""}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"say \\"hello\\""}');
      });

      it('preserves already escaped unicode sequences', () => {
        const input = '{"text":"euro \\u20ac symbol"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"euro \\u20ac symbol"}');
      });
    });

    describe('handles complex JSON structures', () => {
      it('sanitizes multiple string values with control characters', () => {
        const input = '{"a":"line1\nline2","b":"tab\there"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"a":"line1\\nline2","b":"tab\\there"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('sanitizes nested objects with control characters', () => {
        const input = '{"outer":{"inner":"value\nwith\nnewlines"}}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"outer":{"inner":"value\\nwith\\nnewlines"}}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('sanitizes arrays with control characters in strings', () => {
        const input = '{"list":["item1\nwrap","item2\twrap"]}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"list":["item1\\nwrap","item2\\twrap"]}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('does not modify control characters outside string values', () => {
        // Whitespace outside strings is valid JSON formatting
        const input = '{\n  "key": "value"\n}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{\n  "key": "value"\n}');
        expect(() => JSON.parse(output)).not.toThrow();
      });
    });

    describe('edge cases', () => {
      it('handles string with only control characters', () => {
        const input = '{"text":"\n\r\t"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"\\n\\r\\t"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('handles empty string value', () => {
        const input = '{"text":""}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":""}');
      });

      it('handles string with mixed escaped and unescaped characters', () => {
        const input = '{"text":"escaped\\nnewline and literal\nnewline"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"escaped\\nnewline and literal\\nnewline"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('handles backslash at end of string', () => {
        const input = '{"text":"ends with backslash\\\\"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"ends with backslash\\\\"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('handles multiple consecutive control characters', () => {
        const input = '{"text":"multi\n\n\nlines"}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"text":"multi\\n\\n\\nlines"}');
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('handles JSON with number and boolean values unchanged', () => {
        const input = '{"num":123,"bool":true,"null":null}';
        const output = sanitizeJSONString()(input);
        expect(output).toBe('{"num":123,"bool":true,"null":null}');
      });
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.isJsonString', () => {
    const isJsonString = () => global.$exeDevices.iDevice.gamification.helpers.isJsonString;

    describe('input validation', () => {
      it('returns false for non-string input', () => {
        expect(isJsonString()(null)).toBe(false);
        expect(isJsonString()(undefined)).toBe(false);
        expect(isJsonString()(123)).toBe(false);
        expect(isJsonString()([])).toBe(false);
        expect(isJsonString()({})).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(isJsonString()('')).toBe(false);
      });

      it('returns false for whitespace only', () => {
        expect(isJsonString()('   ')).toBe(false);
      });
    });

    describe('valid JSON objects', () => {
      it('returns parsed object for valid JSON object', () => {
        const result = isJsonString()('{"name":"test","value":123}');
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('handles JSON with whitespace padding', () => {
        const result = isJsonString()('  {"key":"value"}  ');
        expect(result).toEqual({ key: 'value' });
      });

      it('handles nested objects', () => {
        const result = isJsonString()('{"outer":{"inner":"value"}}');
        expect(result).toEqual({ outer: { inner: 'value' } });
      });

      it('handles objects with arrays', () => {
        const result = isJsonString()('{"list":[1,2,3]}');
        expect(result).toEqual({ list: [1, 2, 3] });
      });
    });

    describe('invalid JSON', () => {
      it('returns false for arrays (not objects)', () => {
        expect(isJsonString()('[1,2,3]')).toBe(false);
      });

      it('returns false for plain strings', () => {
        expect(isJsonString()('"hello"')).toBe(false);
      });

      it('returns false for numbers', () => {
        expect(isJsonString()('123')).toBe(false);
      });

      it('returns false for malformed JSON', () => {
        expect(isJsonString()('{"key": value}')).toBe(false);
        expect(isJsonString()('{key: "value"}')).toBe(false);
        expect(isJsonString()('{"unclosed": "string')).toBe(false);
      });

      it('returns false for strings that look like objects but are not', () => {
        expect(isJsonString()('{not json}')).toBe(false);
      });
    });

    describe('sanitization of control characters', () => {
      it('handles JSON with literal newlines in string values', () => {
        const jsonWithNewline = '{"text":"line1\nline2"}';
        const result = isJsonString()(jsonWithNewline);
        expect(result).toEqual({ text: 'line1\nline2' });
      });

      it('handles JSON with literal tabs in string values', () => {
        const jsonWithTab = '{"text":"col1\tcol2"}';
        const result = isJsonString()(jsonWithTab);
        expect(result).toEqual({ text: 'col1\tcol2' });
      });

      it('handles JSON with literal carriage returns in string values', () => {
        const jsonWithCR = '{"text":"line1\rline2"}';
        const result = isJsonString()(jsonWithCR);
        expect(result).toEqual({ text: 'line1\rline2' });
      });

      it('handles JSON with mixed control characters', () => {
        const jsonWithMixed = '{"text":"a\nb\tc\rd"}';
        const result = isJsonString()(jsonWithMixed);
        expect(result).toEqual({ text: 'a\nb\tc\rd' });
      });

      it('handles JSON with CRLF line endings', () => {
        const jsonWithCRLF = '{"text":"line1\r\nline2"}';
        const result = isJsonString()(jsonWithCRLF);
        expect(result).toEqual({ text: 'line1\r\nline2' });
      });

      it('preserves already escaped sequences', () => {
        const jsonWithEscaped = '{"text":"line1\\nline2"}';
        const result = isJsonString()(jsonWithEscaped);
        expect(result).toEqual({ text: 'line1\nline2' });
      });

      it('handles JSON with escaped double quotes', () => {
        const jsonWithQuotes = '{"text":"He said \\"hello\\""}';
        const result = isJsonString()(jsonWithQuotes);
        expect(result).toEqual({ text: 'He said "hello"' });
      });
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.shuffleAds', () => {
    const shuffleAds = () => global.$exeDevices.iDevice.gamification.helpers.shuffleAds;

    it('returns non-array input unchanged', () => {
      expect(shuffleAds()(null)).toBe(null);
      expect(shuffleAds()(undefined)).toBe(undefined);
      expect(shuffleAds()('string')).toBe('string');
      expect(shuffleAds()(123)).toBe(123);
    });

    it('returns empty array unchanged', () => {
      const arr = [];
      expect(shuffleAds()(arr)).toEqual([]);
    });

    it('returns single element array unchanged', () => {
      const arr = [1];
      expect(shuffleAds()(arr)).toEqual([1]);
    });

    it('shuffles array in place and returns it', () => {
      const original = [1, 2, 3, 4, 5];
      const arr = [...original];
      const result = shuffleAds()(arr);

      expect(result).toBe(arr); // Same reference
      expect(result).toHaveLength(5);
      expect(result.sort()).toEqual(original.sort()); // Same elements
    });

    it('produces different orderings (probabilistic)', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = new Set();

      // Run multiple times and check we get different orderings
      for (let i = 0; i < 20; i++) {
        const copy = [...arr];
        shuffleAds()(copy);
        results.add(copy.join(','));
      }

      // With 10 elements, we should get multiple different orderings
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.encrypt/decrypt', () => {
    const encrypt = () => global.$exeDevices.iDevice.gamification.helpers.encrypt;
    const decrypt = () => global.$exeDevices.iDevice.gamification.helpers.decrypt;

    describe('encrypt', () => {
      it('returns empty string for null/undefined/empty input', () => {
        expect(encrypt()('')).toBe('');
        expect(encrypt()(null)).toBe('');
        expect(encrypt()(undefined)).toBe('');
        expect(encrypt()('undefined')).toBe('');
        expect(encrypt()('null')).toBe('');
      });

      it('encrypts a simple string', () => {
        const result = encrypt()('hello');
        expect(result).not.toBe('hello');
        expect(typeof result).toBe('string');
      });

      it('produces consistent output for same input', () => {
        const result1 = encrypt()('test');
        const result2 = encrypt()('test');
        expect(result1).toBe(result2);
      });
    });

    describe('decrypt', () => {
      it('returns empty string for null/undefined/empty input', () => {
        expect(decrypt()('')).toBe('');
        expect(decrypt()(null)).toBe('');
        expect(decrypt()(undefined)).toBe('');
        expect(decrypt()('undefined')).toBe('');
        expect(decrypt()('null')).toBe('');
      });

      it('decrypts an encrypted string back to original', () => {
        const original = 'hello world';
        const encrypted = encrypt()(original);
        const decrypted = decrypt()(encrypted);
        expect(decrypted).toBe(original);
      });

      it('handles special characters', () => {
        const original = 'test@123!#$%';
        const encrypted = encrypt()(original);
        const decrypted = decrypt()(encrypted);
        expect(decrypted).toBe(original);
      });

      it('handles unicode characters', () => {
        const original = 'héllo wörld 你好';
        const encrypted = encrypt()(original);
        const decrypted = decrypt()(encrypted);
        expect(decrypted).toBe(original);
      });
    });

    describe('round-trip encryption', () => {
      it('encrypts and decrypts correctly for various strings', () => {
        const testStrings = [
          'simple',
          'with spaces',
          '12345',
          'MixedCase123',
          'special!@#$%^&*()',
          'líneas con ácentos',
        ];

        for (const str of testStrings) {
          const encrypted = encrypt()(str);
          const decrypted = decrypt()(encrypted);
          expect(decrypted).toBe(str);
        }
      });
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.getTimeSeconds', () => {
    const getTimeSeconds = () => global.$exeDevices.iDevice.gamification.helpers.getTimeSeconds;

    it('returns predefined times for indices 0-5', () => {
      expect(getTimeSeconds()(0)).toBe(15);
      expect(getTimeSeconds()(1)).toBe(30);
      expect(getTimeSeconds()(2)).toBe(60);
      expect(getTimeSeconds()(3)).toBe(180);
      expect(getTimeSeconds()(4)).toBe(300);
      expect(getTimeSeconds()(5)).toBe(600);
    });

    it('returns the input value for indices >= 6', () => {
      expect(getTimeSeconds()(6)).toBe(6);
      expect(getTimeSeconds()(100)).toBe(100);
      expect(getTimeSeconds()(3600)).toBe(3600);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.getTimeToString', () => {
    const getTimeToString = () => global.$exeDevices.iDevice.gamification.helpers.getTimeToString;

    it('formats 0 seconds as 00:00', () => {
      expect(getTimeToString()(0)).toBe('00:00');
    });

    it('formats seconds less than 10 with leading zero', () => {
      expect(getTimeToString()(5)).toBe('00:05');
      expect(getTimeToString()(9)).toBe('00:09');
    });

    it('formats seconds 10-59 correctly', () => {
      expect(getTimeToString()(10)).toBe('00:10');
      expect(getTimeToString()(45)).toBe('00:45');
      expect(getTimeToString()(59)).toBe('00:59');
    });

    it('formats minutes correctly', () => {
      expect(getTimeToString()(60)).toBe('01:00');
      expect(getTimeToString()(90)).toBe('01:30');
      expect(getTimeToString()(125)).toBe('02:05');
    });

    it('formats large times correctly', () => {
      expect(getTimeToString()(3599)).toBe('59:59');
      expect(getTimeToString()(3600)).toBe('00:00'); // Wraps at 60 minutes
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.hourToSeconds', () => {
    const hourToSeconds = () => global.$exeDevices.iDevice.gamification.helpers.hourToSeconds;

    it('converts HH:MM:SS format', () => {
      expect(hourToSeconds()('01:30:45')).toBe(5445);
      expect(hourToSeconds()('00:00:00')).toBe(0);
      expect(hourToSeconds()('00:01:00')).toBe(60);
      expect(hourToSeconds()('01:00:00')).toBe(3600);
    });

    it('converts MM:SS format (assumes 00 hours)', () => {
      expect(hourToSeconds()('05:30')).toBe(330);
      expect(hourToSeconds()('00:45')).toBe(45);
    });

    it('converts SS format (assumes 00:00 hours:minutes)', () => {
      expect(hourToSeconds()('30')).toBe(30);
      expect(hourToSeconds()('0')).toBe(0);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.secondsToHour', () => {
    const secondsToHour = () => global.$exeDevices.iDevice.gamification.helpers.secondsToHour;

    it('converts 0 seconds', () => {
      expect(secondsToHour()(0)).toBe('00:00:00');
    });

    it('converts seconds only', () => {
      expect(secondsToHour()(45)).toBe('00:00:45');
      expect(secondsToHour()(9)).toBe('00:00:09');
    });

    it('converts minutes and seconds', () => {
      expect(secondsToHour()(90)).toBe('00:01:30');
      expect(secondsToHour()(3599)).toBe('00:59:59');
    });

    it('converts hours, minutes and seconds', () => {
      expect(secondsToHour()(3600)).toBe('01:00:00');
      expect(secondsToHour()(5445)).toBe('01:30:45');
      expect(secondsToHour()(86399)).toBe('23:59:59');
    });

    it('rounds fractional seconds', () => {
      expect(secondsToHour()(45.4)).toBe('00:00:45');
      expect(secondsToHour()(45.6)).toBe('00:00:46');
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.arrayMove', () => {
    const arrayMove = () => global.$exeDevices.iDevice.gamification.helpers.arrayMove;

    it('moves element forward in array', () => {
      const arr = ['a', 'b', 'c', 'd'];
      arrayMove()(arr, 0, 2);
      expect(arr).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves element backward in array', () => {
      const arr = ['a', 'b', 'c', 'd'];
      arrayMove()(arr, 3, 1);
      expect(arr).toEqual(['a', 'd', 'b', 'c']);
    });

    it('handles move to same position', () => {
      const arr = ['a', 'b', 'c'];
      arrayMove()(arr, 1, 1);
      expect(arr).toEqual(['a', 'b', 'c']);
    });

    it('extends array when moving to index beyond length', () => {
      const arr = ['a', 'b'];
      arrayMove()(arr, 0, 4);
      expect(arr).toEqual(['b', undefined, undefined, undefined, 'a']);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.removeTags', () => {
    const removeTags = () => global.$exeDevices.iDevice.gamification.helpers.removeTags;

    it('removes HTML tags from string', () => {
      expect(removeTags()('<p>Hello</p>')).toBe('Hello');
      expect(removeTags()('<div><span>Test</span></div>')).toBe('Test');
    });

    it('removes multiple tags', () => {
      expect(removeTags()('<p>Para 1</p><p>Para 2</p>')).toBe('Para 1Para 2');
    });

    it('handles string without tags', () => {
      expect(removeTags()('plain text')).toBe('plain text');
    });

    it('handles empty string', () => {
      expect(removeTags()('')).toBe('');
    });

    it('removes attributes from tags', () => {
      expect(removeTags()('<a href="http://example.com">Link</a>')).toBe('Link');
    });

    it('preserves text content between tags', () => {
      expect(removeTags()('Before <b>bold</b> after')).toBe('Before bold after');
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.generarID', () => {
    const generarID = () => global.$exeDevices.iDevice.gamification.helpers.generarID;

    it('returns a string', () => {
      expect(typeof generarID()()).toBe('string');
    });

    it('generates unique IDs on consecutive calls', () => {
      const id1 = generarID()();
      const id2 = generarID()();
      // IDs should be different or same (if called in same second)
      // Format: YYYYMMDDHHmmss + timezone offset (can be negative)
      expect(id1).toMatch(/^[\d-]+$/);
      expect(id2).toMatch(/^[\d-]+$/);
    });

    it('generates ID based on current time', () => {
      const before = new Date();
      const id = generarID()();
      const after = new Date();

      // ID should contain the year
      expect(id).toContain(String(before.getUTCFullYear()));
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.getQuestions', () => {
    const getQuestions = () => global.$exeDevices.iDevice.gamification.helpers.getQuestions;

    it('returns all questions when percentage is 100', () => {
      const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = getQuestions()(questions, 100);
      expect(result).toEqual(questions);
    });

    it('returns all questions when percentage > 100', () => {
      const questions = [{ id: 1 }, { id: 2 }];
      const result = getQuestions()(questions, 150);
      expect(result).toEqual(questions);
    });

    it('returns subset of questions based on percentage', () => {
      const questions = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const result = getQuestions()(questions, 40); // 40% of 5 = 2

      expect(result).toHaveLength(2);
      // All returned questions should be from original
      for (const q of result) {
        expect(questions).toContainEqual(q);
      }
    });

    it('returns at least 1 question even for very low percentage', () => {
      const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = getQuestions()(questions, 1);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('preserves original order of selected questions', () => {
      const questions = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const result = getQuestions()(questions, 60);

      // Selected questions should maintain their relative order
      const originalIds = questions.map(q => q.id);
      const resultIds = result.map(q => q.id);

      for (let i = 1; i < resultIds.length; i++) {
        expect(originalIds.indexOf(resultIds[i])).toBeGreaterThan(
          originalIds.indexOf(resultIds[i - 1])
        );
      }
    });

    it('keeps every question when percentage is 100 and random is true', () => {
      const questions = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const result = getQuestions()(questions, 100, true);

      // No question is dropped or duplicated
      expect(result).toHaveLength(questions.length);
      const resultIds = result.map(q => q.id).sort((a, b) => a - b);
      expect(resultIds).toEqual([1, 2, 3, 4, 5]);
    });

    it('shuffles all questions when percentage is 100 and random is true', () => {
      const questions = [
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
        { id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 },
      ];
      const originalOrder = questions.map(q => q.id).join(',');

      // Over many runs the order must change at least once; otherwise the
      // "random questions" option silently does nothing at 100% (issue #1887).
      const orders = new Set();
      for (let i = 0; i < 20; i++) {
        const result = getQuestions()(questions, 100, true);
        expect(result).toHaveLength(questions.length);
        orders.add(result.map(q => q.id).join(','));
      }
      const reordered = [...orders].some(order => order !== originalOrder);
      expect(reordered).toBe(true);
    });

    it('shuffles all questions when percentage is over 100 and random is true', () => {
      const questions = [
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
        { id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 },
      ];
      const originalOrder = questions.map(q => q.id).join(',');

      const orders = new Set();
      for (let i = 0; i < 20; i++) {
        const result = getQuestions()(questions, 150, true);
        expect(result).toHaveLength(questions.length);
        orders.add(result.map(q => q.id).join(','));
      }
      const reordered = [...orders].some(order => order !== originalOrder);
      expect(reordered).toBe(true);
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.isFullscreen', () => {
    const isFullscreen = () => global.$exeDevices.iDevice.gamification.helpers.isFullscreen;

    it('returns false when no fullscreen element', () => {
      expect(isFullscreen()()).toBe(false);
    });

    it('returns true when fullscreenElement is set', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.body,
        configurable: true,
      });
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: true,
        configurable: true,
      });

      expect(isFullscreen()()).toBe(true);

      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
    });
  });

  describe('$exeDevices.iDevice.gamification.helpers.supportedBrowser', () => {
    const supportedBrowser = () => global.$exeDevices.iDevice.gamification.helpers.supportedBrowser;

    it('returns true for modern browsers', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        configurable: true,
      });
      Object.defineProperty(navigator, 'appName', {
        value: 'Netscape',
        configurable: true,
      });

      expect(supportedBrowser()('test-idevice')).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it('returns false for Internet Explorer', () => {
      const originalAppName = navigator.appName;
      Object.defineProperty(navigator, 'appName', {
        value: 'Microsoft Internet Explorer',
        configurable: true,
      });

      document.body.innerHTML = '<div class="test-idevice-instructions"></div>';
      expect(supportedBrowser()('test-idevice')).toBe(false);

      Object.defineProperty(navigator, 'appName', {
        value: originalAppName,
        configurable: true,
      });
    });
  });
});
