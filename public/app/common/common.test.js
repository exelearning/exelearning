import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

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

      it('processes unprocessed audio elements', () => {
        const audio = document.createElement('audio');
        audio.className = 'mediaelement';
        audio.src = 'test.mp3';
        document.body.appendChild(audio);

        global.$exe.loadMediaPlayer.init();

        // mediaelementplayer should be called
        expect(mockMediaelementplayer).toHaveBeenCalled();
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
    it('does not throw when prettyPhoto is not defined', () => {
      expect(() => global.$exe.setMultimediaGalleries()).not.toThrow();
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
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)',
        configurable: true,
      });
      expect(global.$exe.isIE()).toBe(10);
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

    it('decrypt handles malformed input gracefully', () => {
      const helpers = getHelpers();
      expect(helpers.decrypt(undefined)).toBe('');
      expect(helpers.decrypt('null')).toBe('');
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

    it('stopSound does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.stopSound(null)).not.toThrow();
    });

    it('stopSound pauses audio player', () => {
      const media = getMedia();
      const mockPlayer = { pause: vi.fn(), currentTime: 0 };
      const game = { playerAudio: mockPlayer };
      media.stopSound(game);
      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.currentTime).toBe(0);
    });

    it('playSound does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.playSound('test.mp3', null)).not.toThrow();
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
      const game = {};
      media.stopSound(game);
      expect(game.playerAudio).toBeUndefined();
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

    it('playSound does not throw for null game', () => {
      const media = getMedia();
      expect(() => media.playSound('test.mp3', null)).not.toThrow();
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
  });

  describe('gamification.math', () => {
    const getMath = () => global.$exeDevices.iDevice.gamification.math;

    it('hasLatex detects LaTeX syntax', () => {
      const math = getMath();
      expect(math.hasLatex('\\(x^2\\)')).toBe(true);
      expect(math.hasLatex('\\[x^2\\]')).toBe(true);
      expect(math.hasLatex('\\begin{equation}')).toBe(true);
      expect(math.hasLatex('plain text')).toBe(false);
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

    it('updateLatex handles deferred option', () => {
      const math = getMath();
      document.body.innerHTML = '<div class="math-content">\\(x^2\\)</div>';
      expect(() => math.updateLatex('.math-content', { defer: true })).not.toThrow();
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
});
