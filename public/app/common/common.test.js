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

    it('opens the session and delegates to initSession without gating on init()', () => {
      // Contract: the old buggy gate (`... && scorm.init()`) is gone, so the session setup is
      // no longer skipped when init() returns false (session already active). initGame now opens
      // the session and delegates to the shared initSession helper (whose no-gate binding is
      // covered by the gamification.scorm > initSession tests above).
      const fs = require('fs');
      const path = require('path');
      const code = fs.readFileSync(path.join(__dirname, 'common.js'), 'utf-8');

      expect(code).not.toMatch(/typeof scorm !== "undefined" && scorm\.init\(\)/);
      expect(code).toMatch(
        /scorm\.init\(\);\s*\$exeDevices\.iDevice\.gamification\.scorm\.initSession\(\$game\)/,
      );
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

    describe('initSession', () => {
      let prevWinScorm;

      beforeEach(() => {
        prevWinScorm = global.window.scorm;
      });

      afterEach(() => {
        global.window.scorm = prevWinScorm;
      });

      it('binds learner name, previous score and score bounds (no gating on init())', () => {
        const scormMock = {
          GetLearnerName: () => 'Ada',
          GetScoreRaw: () => '42',
          SetScoreMax: vi.fn(),
          SetScoreMin: vi.fn(),
        };
        global.window.scorm = scormMock;
        const game = {};

        getScorm().initSession(game);

        expect(game.mScorm).toBe(scormMock);
        expect(game.userName).toBe('Ada');
        expect(game.previousScore).toBe('42');
        expect(scormMock.SetScoreMax).toHaveBeenCalledWith(100);
        expect(scormMock.SetScoreMin).toHaveBeenCalledWith(0);
      });

      it('falls back to cmi.core.score.max/min when SetScoreMax is absent', () => {
        const set = vi.fn();
        global.window.scorm = { set };
        const game = {};

        getScorm().initSession(game);

        expect(set).toHaveBeenCalledWith('cmi.core.score.max', '100');
        expect(set).toHaveBeenCalledWith('cmi.core.score.min', '0');
      });

      it('is a no-op when window.scorm is undefined', () => {
        global.window.scorm = undefined;
        const game = {};
        expect(() => getScorm().initSession(game)).not.toThrow();
        expect(game.mScorm).toBeUndefined();
      });
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

    it('parseActivity parses a legacy line without state (defaults state to 0)', () => {
      const scorm = getScorm();
      const line = '1. "Test Activity"; Score: 85%; Weight: 50%.';
      const result = scorm.parseActivity(line);
      expect(result).toEqual({
        index: 1,
        title: 'Test Activity',
        score: 85,
        weighted: 50,
        state: 0,
      });
    });

    it('parseActivity parses the per-iDevice state when present', () => {
      const scorm = getScorm();
      const line = '2. "Quiz"; Score: 70%; Weight: 100%; Estado: 2';
      const result = scorm.parseActivity(line);
      expect(result).toEqual({
        index: 2,
        title: 'Quiz',
        score: 70,
        weighted: 100,
        state: 2,
      });
    });

    it('parseActivity returns null for invalid line', () => {
      const scorm = getScorm();
      expect(scorm.parseActivity('invalid line')).toBeNull();
    });

    it('convertToLineFormat converts object to line format including the state', () => {
      const scorm = getScorm();
      const obj = {
        1: { title: 'Test', score: 80, weighted: 50, state: 1 },
      };
      const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const result = scorm.convertToLineFormat(obj, game);
      expect(result).toContain('Test');
      expect(result).toContain('80%');
      expect(result).toContain('Estado: 1');
    });

    it('convertToLineFormat <-> parseSuspendData round-trips the state per iDevice', () => {
      const scorm = getScorm();
      const obj = {
        1: { title: 'A', score: 80, weighted: 100, state: 2 },
        2: { title: 'B', score: 0, weighted: 100, state: 0 },
        3: { title: 'C', score: 40, weighted: 100, state: 1 },
      };
      const game = { msgs: { msgScore: 'Score', msgWeight: 'Weight' } };

      const parsed = scorm.parseSuspendData(scorm.convertToLineFormat(obj, game));

      expect(parsed[1].state).toBe(2);
      expect(parsed[2].state).toBe(0);
      expect(parsed[3].state).toBe(1);
    });

    it('parseSuspendData drops a phantom entry with an invalid index 0', () => {
      const scorm = getScorm();
      // index 0 means the iDevice node could not be resolved at registration
      // (ideviceNumber is 1-based). Such an empty-title/state-0 phantom must be
      // dropped so it cannot block the SCO page from completing.
      const data =
        '0. ""; Puntuación: 0%; Peso: 100%; Estado: 0.\t' +
        '1. "Real"; Puntuación: 100%; Peso: 100%; Estado: 2';
      const parsed = scorm.parseSuspendData(data);

      expect(parsed[0]).toBeUndefined();
      expect(parsed[1]).toEqual({
        title: 'Real',
        score: 100,
        weighted: 100,
        state: 2,
      });
    });

    it('a phantom index-0 entry does not block completion and is self-healed on the next save', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;

      const store = {};
      global.pipwerks = {
        SCORM: {
          version: '1.2',
          get: (k) => (k in store ? store[k] : ''),
          set: (k, v) => {
            store[k] = String(v);
            return true;
          },
          save: () => true,
        },
      };
      document.body.innerHTML = '<span id="eXeScoreNodeScore"></span>';
      const msgs = { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' };

      try {
        // Reproduce the reported corrupted suspend_data: a phantom "0" entry plus
        // three real iDevices already completed (state 2).
        global.pipwerks.SCORM.set(
          'cmi.suspend_data',
          '0. ""; Puntuación: 0%; Peso: 100%; Estado: 0.\t' +
            '1. "Imagen oculta"; Puntuación: 100%; Peso: 100%; Estado: 2.\t' +
            '2. "Verdadero o falso"; Puntuación: 0%; Peso: 100%; Estado: 2.\t' +
            '3. "Lista desordenada"; Puntuación: 25%; Peso: 100%; Estado: 2',
        );

        // The parser drops the phantom, so the page aggregates to completed (2).
        const lmsData = scorm.parseSuspendData(
          global.pipwerks.SCORM.get('cmi.suspend_data'),
        );
        expect(lmsData[0]).toBeUndefined();
        expect(scorm.getActivityState(lmsData)).toBe(2);

        // Re-completing any iDevice writes the page status AND re-serializes
        // suspend_data without the phantom (self-heal).
        scorm.updateActivity(
          {
            main: '#g',
            ideviceNumber: 3,
            title: 'Lista desordenada',
            scorerp: '2.5',
            weighted: 100,
            gameStarted: true,
            gameOver: true,
            msgs,
          },
          lmsData,
        );

        // Every real iDevice is finished, so the page reaches a TERMINAL status
        // instead of staying "incomplete". With these scores (avg ~42 < 50) that
        // terminal status is "failed" — which is exactly what the learner expects
        // after completing all three activities (passed OR failed, not incomplete).
        expect(store['cmi.core.lesson_status']).toBe('failed');
        expect(store['cmi.core.lesson_status']).not.toBe('incomplete');
        expect(store['cmi.suspend_data']).not.toContain('0. ""');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('registerActivity writes no phantom entry when the iDevice node cannot be resolved', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;

      const store = { 'cmi.suspend_data': '' };
      global.pipwerks = {
        SCORM: {
          version: '1.2',
          get: (k) => (k in store ? store[k] : ''),
          set: (k, v) => {
            store[k] = String(v);
            return true;
          },
          save: () => true,
        },
      };
      document.body.innerHTML = ''; // no .idevice_node matches the game's main

      try {
        // The main container is not in the DOM -> ideviceNumber resolves to 0.
        // registerActivity must bail out instead of writing a "0" phantom entry.
        expect(() =>
          scorm.registerActivity({
            main: 'missing-container',
            weighted: 100,
            msgs: { msgYouScore: 'Score', msgScore: 'Score', msgWeight: 'Weight' },
          }),
        ).not.toThrow();

        expect(store['cmi.suspend_data']).toBe('');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('getActivityState aggregates the per-iDevice states into the page state', () => {
      const scorm = getScorm();
      // All unattempted -> 0
      expect(scorm.getActivityState({ 1: { state: 0 }, 2: { state: 0 }, 3: { state: 0 } })).toBe(0);
      // All completed -> 2
      expect(scorm.getActivityState({ 1: { state: 2 }, 2: { state: 2 }, 3: { state: 2 } })).toBe(2);
      // Only one of three finished -> incomplete (1)
      expect(scorm.getActivityState({ 1: { state: 2 }, 2: { state: 0 }, 3: { state: 0 } })).toBe(1);
      // A started-but-unfinished iDevice -> incomplete (1)
      expect(scorm.getActivityState({ 1: { state: 1 }, 2: { state: 2 } })).toBe(1);
      // No entries / missing state default to unattempted
      expect(scorm.getActivityState({})).toBe(0);
      expect(scorm.getActivityState({ 1: {} })).toBe(0);
    });

    it('marks the SCO passed once three iDevices are completed in sequence (full suspend_data round-trip)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;

      // Stateful pipwerks mock: really stores CMI values, so cmi.suspend_data
      // round-trips through convertToLineFormat/parseSuspendData exactly like a
      // real LMS would between each iDevice save.
      const store = {};
      global.pipwerks = {
        SCORM: {
          version: '1.2',
          get: (k) => (k in store ? store[k] : ''),
          set: (k, v) => {
            store[k] = String(v);
            return true;
          },
          save: () => true,
        },
      };
      document.body.innerHTML = '<span id="eXeScoreNodeScore"></span>';
      const msgs = { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' };

      try {
        // On load every evaluable iDevice registers with state 0.
        const initial = scorm.convertToLineFormat(
          {
            1: { title: 'HiddenImage', score: 0, weighted: 100, state: 0 },
            2: { title: 'Scrambled', score: 0, weighted: 100, state: 0 },
            3: { title: 'TrueFalse', score: 0, weighted: 100, state: 0 },
          },
          { msgs },
        );
        global.pipwerks.SCORM.set('cmi.suspend_data', initial);

        // Each completion reads the current suspend_data, parses it and saves,
        // exactly like sendScoreNew -> updateActivity does at runtime.
        const complete = (ideviceNumber, title, scorerp) => {
          const lmsData = scorm.parseSuspendData(
            global.pipwerks.SCORM.get('cmi.suspend_data'),
          );
          scorm.updateActivity(
            {
              main: '#g',
              ideviceNumber,
              title,
              scorerp,
              weighted: 100,
              gameStarted: true,
              gameOver: true,
              msgs,
            },
            lmsData,
          );
        };

        complete(1, 'HiddenImage', 8);
        complete(2, 'Scrambled', 9);
        complete(3, 'TrueFalse', 10);

        const finalData = scorm.parseSuspendData(
          global.pipwerks.SCORM.get('cmi.suspend_data'),
        );
        expect(scorm.getActivityState(finalData)).toBe(2);
        expect(store['cmi.core.lesson_status']).toBe('passed');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('normalizeMode coerces legacy manual mode (2) to automatic (1)', () => {
      const scorm = getScorm();
      // Auto-only iDevices must never run in manual mode (2).
      expect(scorm.normalizeMode(2)).toBe(1);
      expect(scorm.normalizeMode('2')).toBe(1);
      // Other modes are preserved.
      expect(scorm.normalizeMode(0)).toBe(0);
      expect(scorm.normalizeMode(1)).toBe(1);
      // Missing / invalid values fall back to "no SCORM" (0).
      expect(scorm.normalizeMode(undefined)).toBe(0);
      expect(scorm.normalizeMode('nan')).toBe(0);
    });

    it('sendScoreNew ignores automatic saves in manual SCORM mode (isScorm 2)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: { get: vi.fn(() => ''), set: vi.fn(), save: vi.fn() },
      };
      document.body.innerHTML = `
        <article class="idevice_node"><div id="game"></div></article>
      `;
      try {
        scorm.sendScoreNew(true, {
          main: 'game',
          ideviceNumber: 1,
          isScorm: 2,
          gameStarted: true,
          gameOver: true,
          scorerp: '8.50',
          weighted: 100,
          title: 'Activity',
          userName: '',
          msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score', msgEndGameScore: 'End' },
        });
        // Manual mode persists ONLY on a button press, so an automatic save
        // must not touch the LMS.
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.suspend_data', expect.anything());
        expect(global.pipwerks.SCORM.save).not.toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
      }
    });

    it('sendScoreNew persists a manual button press in manual SCORM mode (isScorm 2)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      const originalAlert = global.alert;
      global.alert = vi.fn();
      if (typeof window !== 'undefined') window.alert = global.alert;
      global.pipwerks = {
        SCORM: { get: vi.fn(() => ''), set: vi.fn(), save: vi.fn() },
      };
      document.body.innerHTML = `
        <article class="idevice_node"><div id="game"></div></article>
      `;
      try {
        scorm.sendScoreNew(false, {
          main: 'game',
          ideviceNumber: 1,
          isScorm: 2,
          gameStarted: true,
          gameOver: true,
          scorerp: '8.50',
          weighted: 100,
          title: 'Activity',
          userName: '',
          msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score', msgOnlySaveScore: 'Only', msgEndGameScore: 'End' },
        });
        // A button press (auto === false) is the only way manual mode saves; a
        // finished game records state 2 (completed) for the iDevice.
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.suspend_data', expect.stringContaining('Estado: 2'));
        expect(global.pipwerks.SCORM.save).toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
        global.alert = originalAlert;
        if (typeof window !== 'undefined') window.alert = originalAlert;
      }
    });

    it('sendScoreNew does not save a manual button press before the game starts', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      const originalAlert = global.alert;
      global.alert = vi.fn();
      if (typeof window !== 'undefined') window.alert = global.alert;
      global.pipwerks = {
        SCORM: { get: vi.fn(() => ''), set: vi.fn(), save: vi.fn() },
      };
      document.body.innerHTML = `
        <article class="idevice_node"><div id="game"></div></article>
      `;
      try {
        scorm.sendScoreNew(false, {
          main: 'game',
          ideviceNumber: 1,
          isScorm: 2,
          gameStarted: false,
          gameOver: false,
          scorerp: '0',
          weighted: 100,
          title: 'Activity',
          userName: '',
          msgs: { msgEndGameScore: 'Play first' },
        });
        // Pressing the button without playing is NOT an attempt: nothing is
        // persisted and the iDevice stays "not attempted".
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.suspend_data', expect.anything());
        expect(global.pipwerks.SCORM.save).not.toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
        global.alert = originalAlert;
        if (typeof window !== 'undefined') window.alert = originalAlert;
      }
    });

    it('sendScoreNew still persists automatic saves in automatic mode (isScorm 1)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: { get: vi.fn(() => ''), set: vi.fn(), save: vi.fn() },
      };
      document.body.innerHTML = `
        <article class="idevice_node"><div id="game"></div></article>
      `;
      try {
        scorm.sendScoreNew(true, {
          main: 'game',
          ideviceNumber: 1,
          isScorm: 1,
          gameStarted: true,
          gameOver: true,
          scorerp: '8.50',
          weighted: 100,
          title: 'Activity',
          userName: '',
          msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score', msgEndGameScore: 'End' },
        });
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.suspend_data', expect.stringContaining('Estado: 2'));
        expect(global.pipwerks.SCORM.save).toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
      }
    });

    it('updateActivity commits score changes to the LMS', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          set: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '8.50',
            weighted: 100,
            gameOver: true,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.suspend_data', expect.stringContaining('Activity'));
        // A finished iDevice persists its per-iDevice state code (2 = completed) in suspend_data.
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.suspend_data', expect.stringContaining('Estado: 2'));
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.score.raw', 85);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.lesson_status', 'passed');
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('updateActivity marks a SCORM 1.2 SCO as failed below the passing threshold', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          set: vi.fn(),
          SetExit: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '3.00',
            weighted: 100,
            gameOver: true,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.score.raw', 30);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.lesson_status', 'failed');
        // A finished page (even when failed) exits with the "normal" intent. showFinalScore routes
        // every exit write through the single SetExit writer, which normalizes "normal" -> "" for
        // SCORM 1.2 (asserted in SCORM_API_wrapper.test.js) so Moodle stops resuming the SCO. (#1831)
        expect(global.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
        expect(global.pipwerks.SCORM.SetExit).not.toHaveBeenCalledWith('suspend');
        // showFinalScore no longer writes the exit CMI element directly (SetExit owns the key).
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.exit', expect.anything());
        // SCORM 2004-only keys must NOT leak into a 1.2 package.
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.success_status', expect.anything());
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.score.scaled', expect.anything());
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('updateActivity uses SCORM 2004 CMI keys when the LMS reports version 2004', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          version: '2004',
          set: vi.fn(),
          SetExit: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '8.50',
            weighted: 100,
            gameOver: true,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        // SCORM 2004 keys live under cmi.* (no .core.) and split completion/success.
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.raw', 85);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.min', 0);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.max', 100);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.scaled', 0.85);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.completion_status', 'completed');
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.success_status', 'passed');
        // A finished 2004 page exits with the "normal" intent, routed through the single SetExit
        // writer (which targets cmi.exit under 2004). (#1831)
        expect(global.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('normal');
        expect(global.pipwerks.SCORM.SetExit).not.toHaveBeenCalledWith('suspend');
        // The SCORM 1.2-only keys must NOT leak into a 2004 package.
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.score.raw', expect.anything());
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.lesson_status', expect.anything());
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.exit', expect.anything());
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('updateActivity marks SCORM 2004 success_status as failed below the passing threshold', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          version: '2004',
          set: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '3.00',
            weighted: 100,
            gameOver: true,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.scaled', 0.3);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.completion_status', 'completed');
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.success_status', 'failed');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('marks a SCORM 2004 page incomplete while an iDevice is started but not finished', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          version: '2004',
          set: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '0.00',
            weighted: 100,
            gameStarted: true,
            gameOver: false,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        // The only iDevice is started but not finished (state 1) -> the page aggregates to
        // "incomplete". The pass/fail result is only reported once completed, so while the page
        // is incomplete success_status stays "unknown" (same as SCORM 1.2 not showing passed/failed).
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.score.scaled', 0);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.completion_status', 'incomplete');
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.success_status', 'unknown');
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('marks a SCORM 1.2 page incomplete while an iDevice is started but not finished', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          set: vi.fn(),
          SetExit: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.updateActivity(
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            scorerp: '8.50',
            weighted: 100,
            gameStarted: true,
            gameOver: false,
            msgs: {
              msgScore: 'Score',
              msgWeight: 'Weight',
              msgYouScore: 'Score',
            },
          },
          {},
        );

        // The only iDevice is started but not finished (state 1) -> the page is "incomplete".
        // In SCORM 1.2 the single lesson_status reads "incomplete" (not "passed") until the page
        // is fully completed, even though the running score would pass.
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.score.raw', 85);
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.core.lesson_status', 'incomplete');
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.lesson_status', 'passed');
        // An in-progress page stays resumable so the learner can continue where they left off. (#1831)
        expect(global.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
        expect(global.pipwerks.SCORM.SetExit).not.toHaveBeenCalledWith('normal');
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('showFinalScore does not downgrade an already-completed SCORM 2004 SCO on a review-only reopen', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          version: '2004',
          set: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        // Reopen scenario: the game has not been restarted (no gameStarted) nor finished
        // (no gameOver), but suspend_data still holds a passing score from a prior attempt.
        scorm.showFinalScore(
          { 1: { title: 'Activity', score: 80, weighted: 100 } },
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
          },
        );

        // The previous score is still shown to the learner...
        expect(document.querySelector('#eXeScoreNodeScore').textContent).toBe('Score: 80/100');
        // ...but the LMS data model must be left untouched so the persisted
        // "completed/passed" is preserved while the learner only reviews.
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('showFinalScore does not downgrade an already-completed SCORM 1.2 SCO on a review-only reopen', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          set: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.showFinalScore(
          { 1: { title: 'Activity', score: 80, weighted: 100 } },
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Activity',
            msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
          },
        );

        expect(document.querySelector('#eXeScoreNodeScore').textContent).toBe('Score: 80/100');
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.lesson_status', expect.anything());
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalledWith('cmi.core.score.raw', expect.anything());
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('showFinalScore marks the SCO incomplete when a restarted iDevice is no longer finished', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: {
          version: '2004',
          set: vi.fn(),
          SetExit: vi.fn(),
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        // iDevice 1 was restarted (state 1, not finished); iDevice 2 is still completed (state 2).
        // The page aggregates to "incomplete"; the pass/fail result is withheld until the page is
        // completed, so success_status is "unknown" even though the running score would pass.
        scorm.showFinalScore(
          {
            1: { title: 'A', score: 80, weighted: 100, state: 1 },
            2: { title: 'B', score: 80, weighted: 100, state: 2 },
          },
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'A',
            gameStarted: true,
            gameOver: false,
            msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
          },
        );

        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.completion_status', 'incomplete');
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.success_status', 'unknown');
        // The page is no longer finished, so it must stay resumable ("suspend"), not "normal". (#1831)
        expect(global.pipwerks.SCORM.SetExit).toHaveBeenCalledWith('suspend');
        expect(global.pipwerks.SCORM.SetExit).not.toHaveBeenCalledWith('normal');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('showFinalScore clears the resumable exit to normal once every iDevice is completed (timed SCO no longer re-opens as suspended)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;

      // Reproduce the Moodle report from #1831: a timed Sort SCO finalized with
      // lesson_status "failed" (25% < 50%) and Estado 2 in suspend_data, yet
      // cmi.core.exit stayed "suspend" (Moodle's in-progress default), so Moodle
      // resumed and re-opened the SCO as incomplete/suspended on the next visit.
      const store = { 'cmi.core.exit': 'suspend' };
      global.pipwerks = {
        SCORM: {
          set: vi.fn((k, v) => {
            store[k] = String(v);
            return true;
          }),
          // Mirror pipwerks.SCORM.SetExit under SCORM 1.2: the "normal" intent collapses to ""
          // (out-of-vocabulary in 1.2) and lands in cmi.core.exit. This exercises the same single
          // exit writer production now uses, end to end. (#1831)
          SetExit: (exit) => {
            store['cmi.core.exit'] = exit === 'normal' ? '' : String(exit);
          },
          save: vi.fn(),
        },
      };
      document.body.innerHTML = `
        <article class="idevice_node">
          <div id="game"></div>
          <span id="eXeScoreNodeScore"></span>
        </article>
      `;

      try {
        scorm.showFinalScore(
          { 1: { title: 'Ordena tarjetas', score: 25, weighted: 100, state: 2 } },
          {
            main: '#game',
            ideviceNumber: 1,
            title: 'Ordena tarjetas',
            // Timer expiry finalizes the activity: gameStarted false, gameOver true.
            gameStarted: false,
            gameOver: true,
            msgs: { msgScore: 'Score', msgWeight: 'Weight', msgYouScore: 'Score' },
          },
        );

        // The failed status is written (correct) AND showFinalScore's "normal" exit intent, routed
        // through SetExit, clears the resumable exit to "" for SCORM 1.2 so Moodle records a finished
        // attempt instead of resuming it.
        expect(store['cmi.core.lesson_status']).toBe('failed');
        expect(store['cmi.core.exit']).toBe('');
        expect(store['cmi.core.exit']).not.toBe('suspend');
      } finally {
        if (typeof originalPipwerks === 'undefined') {
          delete global.pipwerks;
        } else {
          global.pipwerks = originalPipwerks;
        }
      }
    });

    it('restartActivity drops a completed iDevice (and the page) back to incomplete', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      const game = { ideviceNumber: 1, title: 'A', weighted: 100, msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const completed = scorm.convertToLineFormat({ 1: { title: 'A', score: 80, weighted: 100, state: 2 } }, game);
      const updateScormPageStatus = vi.fn();
      const previousExeExport = window.$exeExport;
      global.pipwerks = { SCORM: { get: vi.fn(() => completed), set: vi.fn(), save: vi.fn() } };
      window.$exeExport = { updateScormPageStatus };
      try {
        scorm.restartActivity(game);
        // The iDevice entry is rewritten to state 1 ...
        expect(global.pipwerks.SCORM.set).toHaveBeenCalledWith('cmi.suspend_data', expect.stringContaining('Estado: 1'));
        // ... and the page is recomputed immediately (it becomes incomplete).
        expect(updateScormPageStatus).toHaveBeenCalledWith(true);
        expect(global.pipwerks.SCORM.save).toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
        window.$exeExport = previousExeExport;
      }
    });

    it('restartActivity nudges Moodle to redraw the TOC (deferred retry commit)', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      const game = { ideviceNumber: 1, title: 'A', weighted: 100, msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const completed = scorm.convertToLineFormat({ 1: { title: 'A', score: 80, weighted: 100, state: 2 } }, game);
      const previousExeExport = window.$exeExport;
      global.pipwerks = { SCORM: { get: vi.fn(() => completed), set: vi.fn(), save: vi.fn() } };
      window.$exeExport = { updateScormPageStatus: vi.fn() };
      vi.useFakeTimers();
      try {
        scorm.restartActivity(game);
        // The synchronous commit is the guarantee.
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
        // triggerMoodleDetection schedules a deferred retry commit so Moodle redraws
        // the SCO status in its TOC, just like the completion path does.
        vi.advanceTimersByTime(50);
        expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
        window.$exeExport = previousExeExport;
      }
    });

    it('restartActivity leaves a not-yet-completed or unknown iDevice untouched', () => {
      const scorm = getScorm();
      const originalPipwerks = global.pipwerks;
      const game = { ideviceNumber: 1, title: 'A', weighted: 100, msgs: { msgScore: 'Score', msgWeight: 'Weight' } };
      const started = scorm.convertToLineFormat({ 1: { title: 'A', score: 0, weighted: 100, state: 1 } }, game);
      const updateScormPageStatus = vi.fn();
      const previousExeExport = window.$exeExport;
      window.$exeExport = { updateScormPageStatus };
      try {
        // Started but not finished (state 1) -> no change.
        global.pipwerks = { SCORM: { get: vi.fn(() => started), set: vi.fn(), save: vi.fn() } };
        scorm.restartActivity(game);
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalled();
        expect(global.pipwerks.SCORM.save).not.toHaveBeenCalled();
        expect(updateScormPageStatus).not.toHaveBeenCalled();

        // No stored entry for this iDevice yet -> no change.
        global.pipwerks = { SCORM: { get: vi.fn(() => ''), set: vi.fn(), save: vi.fn() } };
        scorm.restartActivity(game);
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalled();

        // Missing ideviceNumber -> no change.
        global.pipwerks = { SCORM: { get: vi.fn(() => started), set: vi.fn(), save: vi.fn() } };
        scorm.restartActivity({ title: 'A', weighted: 100, msgs: game.msgs });
        expect(global.pipwerks.SCORM.set).not.toHaveBeenCalled();
      } finally {
        if (typeof originalPipwerks === 'undefined') delete global.pipwerks;
        else global.pipwerks = originalPipwerks;
        window.$exeExport = previousExeExport;
      }
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

  describe('$exeDevices.iDevice.gamification.scorm.triggerMoodleDetection', () => {
    const getTriggerMoodleDetection = () => global.$exeDevices.iDevice.gamification.scorm.triggerMoodleDetection;

    let originalPipwerks;

    beforeEach(() => {
      vi.useFakeTimers();
      originalPipwerks = global.pipwerks;
      global.pipwerks = {
        SCORM: { save: vi.fn() },
      };
      document.body.innerHTML = '';
    });

    afterEach(() => {
      vi.useRealTimers();
      global.pipwerks = originalPipwerks;
      document.body.innerHTML = '';
    });

    it('schedules a single deferred retry commit (LMSCommit) at 50ms', () => {
      const fn = getTriggerMoodleDetection();

      fn();
      // Nothing synchronous: the synchronous commit already happened in updateActivity.
      expect(global.pipwerks.SCORM.save).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(global.pipwerks.SCORM.save).toHaveBeenCalledTimes(1);
    });

    it('does not touch the DOM (Moodle reacts to LMSCommit, not to SCO DOM changes)', () => {
      const fn = getTriggerMoodleDetection();
      document.body.innerHTML = '<div id="test-container"></div>';
      const container = document.getElementById('test-container');

      fn();
      vi.advanceTimersByTime(50);

      // The old reflow/CSS "mechanisms" were cargo-cult: the container is untouched.
      expect(container.style.opacity).toBe('');
      expect(container.style.transform).toBe('');
    });

    it('returns early when pipwerks.SCORM.save is unavailable (no timer scheduled)', () => {
      const fn = getTriggerMoodleDetection();
      global.pipwerks = { SCORM: {} };

      expect(() => fn()).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('returns early when pipwerks is not globally available', () => {
      const fn = getTriggerMoodleDetection();
      delete global.pipwerks;

      expect(() => {
        fn();
        vi.advanceTimersByTime(50);
      }).not.toThrow();
    });

    it('silently fails when the deferred pipwerks.SCORM.save throws', () => {
      const fn = getTriggerMoodleDetection();
      global.pipwerks.SCORM.save = vi.fn(() => {
        throw new Error('SCORM not available');
      });

      expect(() => {
        fn();
        vi.advanceTimersByTime(50);
      }).not.toThrow();
    });
  });
});
