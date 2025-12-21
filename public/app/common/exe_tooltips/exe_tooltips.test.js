import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const scriptPath = './exe_tooltips.js';
const loadScriptMock = vi.fn();

global.$exe = {
  options: {
    atools: {
      modeToggler: false,
      translator: false,
      i18n: {},
    },
  },
  loadScript: loadScriptMock,
};

const exeTooltips = require(scriptPath);

describe('exe_tooltips (app/common)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    loadScriptMock.mockClear();
    exeTooltips.links = window.$([]);
    exeTooltips.isAJAXAllowed = undefined;
    exeTooltips.currentWord = undefined;
    // Remove any added glossary terms container
    $('#exe-glossary-terms').remove();
    // Clean up global state
    delete window.eXeLearning;
    delete window._;
    // Reset location to http: by default
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Ensure cleanup after each test
    delete window.eXeLearning;
    delete window._;
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('getTooltipTitle', () => {
    it('extracts title from "Title | Detail" format', () => {
      expect(exeTooltips.getTooltipTitle('Title | Detail')).toBe('Title');
    });

    it('returns empty string when no pipe separator', () => {
      expect(exeTooltips.getTooltipTitle('Just text')).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(exeTooltips.getTooltipTitle('')).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(exeTooltips.getTooltipTitle(undefined)).toBe('');
    });

    it('returns empty string for null input', () => {
      expect(exeTooltips.getTooltipTitle(null)).toBe('');
    });
  });

  describe('getTooltipText', () => {
    it('extracts text from "Title | Detail" format', () => {
      expect(exeTooltips.getTooltipText('Title | Detail')).toBe('Detail');
    });

    it('returns full text when no pipe separator', () => {
      expect(exeTooltips.getTooltipText('Just text')).toBe('Just text');
    });

    it('returns original text when more than one pipe separator', () => {
      // With more than 2 parts, the original text is returned
      expect(exeTooltips.getTooltipText('Title | Part1 | Part2')).toBe('Title | Part1 | Part2');
    });
  });

  describe('getFriendlyURL', () => {
    it('builds friendly URLs from text', () => {
      expect(exeTooltips.getFriendlyURL('Hello, World!')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(exeTooltips.getFriendlyURL('Test@#$%^&*()')).toBe('test');
    });

    it('replaces spaces with hyphens', () => {
      expect(exeTooltips.getFriendlyURL('multiple words here')).toBe('multiple-words-here');
    });

    it('converts to lowercase', () => {
      expect(exeTooltips.getFriendlyURL('UPPERCASE')).toBe('uppercase');
    });

    it('handles empty string', () => {
      expect(exeTooltips.getFriendlyURL('')).toBe('');
    });
  });

  describe('getPageName', () => {
    it('returns the page name for linked anchor', () => {
      document.body.innerHTML = `
        <nav id="siteNav">
          <a href="page.html">Page Title</a>
        </nav>
      `;
      expect(exeTooltips.getPageName('page.html#section')).toBe('Page Title');
    });

    it('returns original href when no match found', () => {
      document.body.innerHTML = `
        <nav id="siteNav">
          <a href="other.html">Other Page</a>
        </nav>
      `;
      expect(exeTooltips.getPageName('page.html')).toBe('page.html');
    });

    it('handles href without hash', () => {
      document.body.innerHTML = `
        <nav id="siteNav">
          <a href="page.html">Page Title</a>
        </nav>
      `;
      expect(exeTooltips.getPageName('page.html')).toBe('Page Title');
    });

    it('returns href when siteNav is empty', () => {
      document.body.innerHTML = '<nav id="siteNav"></nav>';
      expect(exeTooltips.getPageName('page.html')).toBe('page.html');
    });
  });

  describe('getClasses', () => {
    it('returns light theme class', () => {
      expect(exeTooltips.getClasses('plain light-tt')).toBe('qtip-light');
    });

    it('returns dark theme class', () => {
      expect(exeTooltips.getClasses('plain dark-tt')).toBe('qtip-dark');
    });

    it('returns red theme class', () => {
      expect(exeTooltips.getClasses('plain red-tt')).toBe('qtip-red');
    });

    it('returns blue theme class', () => {
      expect(exeTooltips.getClasses('plain blue-tt')).toBe('qtip-blue');
    });

    it('returns green theme class', () => {
      expect(exeTooltips.getClasses('plain green-tt')).toBe('qtip-green');
    });

    it('adds rounded class', () => {
      expect(exeTooltips.getClasses('plain rounded-tt')).toContain('qtip-rounded');
    });

    it('adds shadow class', () => {
      expect(exeTooltips.getClasses('plain shadowed-tt')).toContain('qtip-shadow');
    });

    it('adds definition class', () => {
      expect(exeTooltips.getClasses('plain definition-tt')).toContain('qtip-definition');
    });

    it('combines multiple classes', () => {
      const classes = exeTooltips.getClasses('plain light-tt rounded-tt shadowed-tt');
      expect(classes).toContain('qtip-light');
      expect(classes).toContain('qtip-rounded');
      expect(classes).toContain('qtip-shadow');
    });

    it('returns empty string for no matching classes', () => {
      expect(exeTooltips.getClasses('plain')).toBe('');
    });

    it('prioritizes light over other colors if multiple present', () => {
      // Due to else-if, only the first matching color is applied
      const classes = exeTooltips.getClasses('plain light-tt dark-tt');
      expect(classes).toBe('qtip-light');
    });
  });

  describe('hasCloseButton', () => {
    it('always returns false', () => {
      expect(exeTooltips.hasCloseButton()).toBe(false);
      expect(exeTooltips.hasCloseButton({})).toBe(false);
      expect(exeTooltips.hasCloseButton(null)).toBe(false);
    });
  });

  describe('autoClose', () => {
    it('always returns true', () => {
      expect(exeTooltips.autoClose()).toBe(true);
    });
  });

  describe('init', () => {
    it('initializes when tooltips are present and loads assets', () => {
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="title | text"></a>';
      exeTooltips.init('/assets/');
      expect(exeTooltips.path).toBe('/assets/');
      expect(exeTooltips.links?.length).toBe(1);
      expect(loadScriptMock).toHaveBeenCalledWith('/assets/jquery.qtip.min.css');
      expect(loadScriptMock).toHaveBeenCalledWith(
        '/assets/jquery.qtip.min.js',
        '$exe.tooltips.loadImageLoader()'
      );
    });

    it('does not load assets when no tooltips present', () => {
      document.body.innerHTML = '<a class="regular-link">Link</a>';
      exeTooltips.init('/assets/');
      expect(loadScriptMock).not.toHaveBeenCalled();
    });

    it('sets viewport to window', () => {
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="text"></a>';
      exeTooltips.init('/path/');
      expect(exeTooltips.viewport).toBeDefined();
    });

    it('enables AJAX for http protocol', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:' },
        writable: true,
      });
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="text"></a>';
      exeTooltips.init('/path/');
      expect(exeTooltips.isAJAXAllowed).toBe(true);
    });

    it('enables AJAX for https protocol', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'https:' },
        writable: true,
      });
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="text"></a>';
      exeTooltips.init('/path/');
      expect(exeTooltips.isAJAXAllowed).toBe(true);
    });

    it('disables AJAX tooltips on single page views', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:' },
        writable: true,
      });
      document.body.className = 'exe-single-page';
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="text"></a>';
      exeTooltips.init('/');
      expect(exeTooltips.isAJAXAllowed).toBe(false);
    });

    it('does not set isAJAXAllowed for file protocol', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'file:' },
        writable: true,
      });
      document.body.innerHTML = '<a class="exe-tooltip plain-tt" title="text"></a>';
      exeTooltips.isAJAXAllowed = undefined;
      exeTooltips.init('/path/');
      // isAJAXAllowed should remain undefined for file protocol
      expect(exeTooltips.isAJAXAllowed).toBeUndefined();
    });
  });

  describe('loadCSS', () => {
    it('loads the CSS file', () => {
      exeTooltips.path = '/test/path/';
      exeTooltips.loadCSS();
      expect(loadScriptMock).toHaveBeenCalledWith('/test/path/jquery.qtip.min.css');
    });
  });

  describe('loadJS', () => {
    it('loads the JS file with callback', () => {
      exeTooltips.path = '/test/path/';
      exeTooltips.loadJS();
      expect(loadScriptMock).toHaveBeenCalledWith(
        '/test/path/jquery.qtip.min.js',
        '$exe.tooltips.loadImageLoader()'
      );
    });
  });

  describe('loadImageLoader', () => {
    it('loads the imagesloaded library with callback', () => {
      exeTooltips.path = '/test/path/';
      exeTooltips.loadImageLoader();
      expect(loadScriptMock).toHaveBeenCalledWith(
        '/test/path/imagesloaded.pkg.min.js',
        '$exe.tooltips.run()'
      );
    });
  });

  describe('run', () => {
    let qtipMock;

    beforeEach(() => {
      qtipMock = vi.fn();
      $.fn.qtip = qtipMock;
    });

    describe('plain tooltips', () => {
      it('creates qtip for plain tooltip', () => {
        document.body.innerHTML = '<a class="exe-tooltip plain" title="Title | Text" id="link1"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        expect(qtipMock).toHaveBeenCalled();
      });

      it('creates qtip for plain tooltip with button', () => {
        document.body.innerHTML = '<a class="exe-tooltip plain with-button" title="Title | Text"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        expect(qtipMock).toHaveBeenCalled();
        const config = qtipMock.mock.calls[0][0];
        expect(config.content.button).toBe(true);
      });

      it('creates qtip for plain tooltip without button', () => {
        document.body.innerHTML = '<a class="exe-tooltip plain" title="Title | Text"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        expect(qtipMock).toHaveBeenCalled();
        const config = qtipMock.mock.calls[0][0];
        expect(config.content.button).toBe(false);
      });

      it('configures hide event for tooltip with button', () => {
        document.body.innerHTML = '<a class="exe-tooltip plain with-button" title="Title | Text"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        const config = qtipMock.mock.calls[0][0];
        expect(config.hide.event).toBe(false);
      });

      it('applies style classes', () => {
        document.body.innerHTML = '<a class="exe-tooltip plain light-tt rounded-tt" title="Title | Text"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        const config = qtipMock.mock.calls[0][0];
        expect(config.style.classes).toContain('qtip-light');
        expect(config.style.classes).toContain('qtip-rounded');
      });
    });

    describe('definition tooltips', () => {
      it('creates qtip for definition tooltip', () => {
        document.body.innerHTML = `
          <a class="exe-tooltip definition" id="link-term" title="Term"></a>
          <div id="t-term">Definition content</div>
        `;
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        expect(qtipMock).toHaveBeenCalled();
      });

      it('references content by id', () => {
        document.body.innerHTML = `
          <a class="exe-tooltip definition" id="link-myterm" title="My Term"></a>
          <div id="t-myterm">This is the definition</div>
        `;
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        expect(qtipMock).toHaveBeenCalled();
        const config = qtipMock.mock.calls[0][0];
        expect(config.content.text.length).toBe(1);
        expect(config.content.text.attr('id')).toBe('t-myterm');
      });

      it('creates qtip for definition tooltip with button', () => {
        document.body.innerHTML = `
          <a class="exe-tooltip definition with-button" id="link-term" title="Term"></a>
          <div id="t-term">Definition</div>
        `;
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        const config = qtipMock.mock.calls[0][0];
        expect(config.content.button).toBe(true);
      });
    });

    describe('ajax tooltips', () => {
      it('tests AJAX availability when undefined', () => {
        const ajaxMock = vi.fn().mockReturnValue({
          done: vi.fn().mockReturnThis(),
          fail: vi.fn().mockReturnThis(),
        });
        $.ajax = ajaxMock;

        document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = undefined;
        exeTooltips.run();

        expect(ajaxMock).toHaveBeenCalledWith({
          dataType: 'text',
          cache: true,
          url: 'exe_tooltips.js',
        });
      });

      it('enables tooltip when AJAX test succeeds', () => {
        const enableAJAXSpy = vi.spyOn(exeTooltips, 'enableAJAXTooltip').mockImplementation(() => {});
        const doneFn = vi.fn();
        const failFn = vi.fn();
        $.ajax = vi.fn().mockReturnValue({
          done: (cb) => {
            doneFn.mockImplementation(cb);
            return { fail: failFn };
          },
          fail: failFn,
        });

        document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = undefined;
        exeTooltips.run();

        // Simulate successful AJAX response
        doneFn();
        expect(exeTooltips.isAJAXAllowed).toBe(true);
        expect(enableAJAXSpy).toHaveBeenCalled();
      });

      it('disables AJAX when test fails', () => {
        const doneFn = vi.fn().mockReturnThis();
        let failCallback;
        $.ajax = vi.fn().mockReturnValue({
          done: doneFn,
          fail: (cb) => {
            failCallback = cb;
            return { done: doneFn };
          },
        });

        document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = undefined;
        exeTooltips.run();

        // Simulate failed AJAX response
        failCallback();
        expect(exeTooltips.isAJAXAllowed).toBe(false);
      });

      it('directly enables tooltip when AJAX is already allowed', () => {
        const enableAJAXSpy = vi.spyOn(exeTooltips, 'enableAJAXTooltip').mockImplementation(() => {});

        document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = true;
        exeTooltips.run();

        expect(enableAJAXSpy).toHaveBeenCalled();
      });

      it('does nothing when AJAX is not allowed', () => {
        const enableAJAXSpy = vi.spyOn(exeTooltips, 'enableAJAXTooltip').mockImplementation(() => {});

        document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = false;
        exeTooltips.run();

        expect(enableAJAXSpy).not.toHaveBeenCalled();
      });
    });

    describe('glossary tooltips', () => {
      it('adds hash to href if not present', () => {
        document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = false;
        exeTooltips.run();

        const link = $('a.exe-tooltip');
        expect(link.attr('href')).toBe('glossary.html#term');
      });

      it('does not modify href if hash already present', () => {
        document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html#existing">Term</a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = false;
        exeTooltips.run();

        const link = $('a.exe-tooltip');
        expect(link.attr('href')).toBe('glossary.html#existing');
      });

      it('tests AJAX availability when undefined', () => {
        const ajaxMock = vi.fn().mockReturnValue({
          done: vi.fn().mockReturnThis(),
          fail: vi.fn().mockReturnThis(),
        });
        $.ajax = ajaxMock;

        document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = undefined;
        exeTooltips.run();

        expect(ajaxMock).toHaveBeenCalled();
      });

      it('enables glossary tooltip when AJAX test succeeds', () => {
        const enableGlossarySpy = vi.spyOn(exeTooltips, 'enableGlossaryTooltip').mockImplementation(() => {});
        let doneCallback;
        $.ajax = vi.fn().mockReturnValue({
          done: (cb) => {
            doneCallback = cb;
            return { fail: vi.fn() };
          },
          fail: vi.fn().mockReturnThis(),
        });

        document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = undefined;
        exeTooltips.run();

        doneCallback();
        expect(exeTooltips.isAJAXAllowed).toBe(true);
        expect(enableGlossarySpy).toHaveBeenCalled();
      });

      it('directly enables glossary tooltip when AJAX is already allowed', () => {
        const enableGlossarySpy = vi.spyOn(exeTooltips, 'enableGlossaryTooltip').mockImplementation(() => {});

        document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.isAJAXAllowed = true;
        exeTooltips.run();

        expect(enableGlossarySpy).toHaveBeenCalled();
      });
    });

    describe('unmatched tooltip types', () => {
      it('does nothing for unrecognized tooltip class', () => {
        document.body.innerHTML = '<a class="exe-tooltip unknown-type" href="page.html" title="Title"></a>';
        exeTooltips.links = $('a.exe-tooltip');
        exeTooltips.run();
        // No qtip should be called for unknown types
        expect(qtipMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('enableAJAXTooltip', () => {
    let qtipMock;

    beforeEach(() => {
      qtipMock = vi.fn();
      $.fn.qtip = qtipMock;
    });

    it('creates qtip with AJAX content', () => {
      document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title | Desc"></a>';
      const link = document.querySelector('a');
      exeTooltips.enableAJAXTooltip('ajax', link);

      expect(qtipMock).toHaveBeenCalled();
      const config = qtipMock.mock.calls[0][0];
      expect(config.content.title).toBe('Title');
      expect(typeof config.content.text).toBe('function');
    });

    it('configures button based on class', () => {
      document.body.innerHTML = '<a class="exe-tooltip ajax with-button" href="page.html" title="Title"></a>';
      const link = document.querySelector('a');
      exeTooltips.enableAJAXTooltip('ajax with-button', link);

      const config = qtipMock.mock.calls[0][0];
      expect(config.content.button).toBe(true);
      expect(config.hide.event).toBe(false);
      expect(config.style.tip.corner).toBe(false);
    });

    it('content text function returns loading indicator', () => {
      document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
      const link = document.querySelector('a');
      exeTooltips.enableAJAXTooltip('ajax', link);

      const config = qtipMock.mock.calls[0][0];
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('page.html'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: vi.fn(),
      });

      const result = config.content.text({}, mockApi);
      expect(result).toBe('&hellip;');
    });

    it('content text returns preview message in eXeLearning mode', () => {
      window.eXeLearning = {};
      window._ = (s) => s;

      document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
      const link = document.querySelector('a');
      exeTooltips.enableAJAXTooltip('ajax', link);

      const config = qtipMock.mock.calls[0][0];
      const mockApi = {
        elements: { target: { attr: vi.fn() } },
        set: vi.fn(),
      };

      const result = config.content.text({}, mockApi);
      expect(result).toBe('Go to Tools - Preview to see the tooltip content');
    });

    it('AJAX success callback calls api.set with content', () => {
      document.body.innerHTML = '<a class="exe-tooltip ajax" href="page.html" title="Title"></a>';
      const link = document.querySelector('a');
      exeTooltips.enableAJAXTooltip('ajax', link);

      const config = qtipMock.mock.calls[0][0];
      let successCallback;
      const mockApi = {
        elements: { target: { attr: vi.fn().mockReturnValue('page.html') } },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: (success, fail) => {
          successCallback = success;
        },
      });

      config.content.text({}, mockApi);

      // Simulate AJAX success with FreeTextIdevice content
      const htmlContent = '<div class="FreeTextIdevice"><div class="iDevice_content">Tooltip content</div></div>';
      successCallback(htmlContent);

      // Should call set with content.text
      expect(mockApi.set).toHaveBeenCalled();
      expect(mockApi.set.mock.calls[0][0]).toBe('content.text');
    });

    it('AJAX failure callback sets page name', () => {
      document.body.innerHTML = `
        <nav id="siteNav"><a href="page.html">Page Name</a></nav>
        <a class="exe-tooltip ajax" href="page.html" title="Title"></a>
      `;
      const link = document.querySelector('a.exe-tooltip');
      exeTooltips.enableAJAXTooltip('ajax', link);

      const config = qtipMock.mock.calls[0][0];
      let failCallback;
      const mockApi = {
        elements: { target: { attr: vi.fn().mockReturnValue('page.html') } },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: (success, fail) => {
          failCallback = fail;
        },
      });

      config.content.text({}, mockApi);
      failCallback();

      expect(mockApi.set).toHaveBeenCalledWith('content.text', 'Page Name');
    });
  });

  describe('enableGlossaryTooltip', () => {
    let qtipMock;

    beforeEach(() => {
      qtipMock = vi.fn();
      $.fn.qtip = qtipMock;
    });

    it('creates qtip for glossary', () => {
      document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html#term">Term</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      expect(qtipMock).toHaveBeenCalled();
    });

    it('stores current word in lowercase', () => {
      document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html#term">MyTerm</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html#term'),
            text: vi.fn().mockReturnValue('MyTerm'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({ then: vi.fn() });

      config.content.text({}, mockApi);
      expect(exeTooltips.currentWord).toBe('myterm');
    });

    it('configures button based on class', () => {
      document.body.innerHTML = '<a class="exe-tooltip glossary with-button" href="glossary.html">Term</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary with-button', link);

      const config = qtipMock.mock.calls[0][0];
      expect(config.content.button).toBe(true);
    });

    it('content text returns preview message in eXeLearning mode', () => {
      window.eXeLearning = {};
      window._ = (s) => s;

      document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html'),
            text: vi.fn().mockReturnValue('Term'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({ then: vi.fn() });

      const result = config.content.text({}, mockApi);
      expect(result).toBe('Go to Tools - Preview to see the tooltip content');

      delete window.eXeLearning;
      delete window._;
    });

    it('returns loading indicator when not in eXeLearning mode', () => {
      delete window.eXeLearning;

      document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html">Term</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html'),
            text: vi.fn().mockReturnValue('Term'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({ then: vi.fn() });

      const result = config.content.text({}, mockApi);
      expect(result).toBe('&hellip;');
    });

    it('AJAX success callback calls api.set with content', () => {
      document.body.innerHTML = '<a class="exe-tooltip glossary" href="glossary.html#term">MyTerm</a>';
      const link = document.querySelector('a');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      let successCallback;
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html#term'),
            text: vi.fn().mockReturnValue('myterm'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: (success, fail) => {
          successCallback = success;
        },
      });

      config.content.text({}, mockApi);

      // Simulate AJAX success with glossary content
      const htmlContent = `
        <div class="FreeTextIdevice">
          <div class="iDevice_content">
            <dl>
              <dt>myterm:</dt>
              <dd>Definition of my term</dd>
            </dl>
          </div>
        </div>
      `;
      successCallback(htmlContent);

      // Should call set with content.text
      expect(mockApi.set).toHaveBeenCalled();
      expect(mockApi.set.mock.calls[0][0]).toBe('content.text');
    });

    it('AJAX failure callback sets page name', () => {
      document.body.innerHTML = `
        <nav id="siteNav"><a href="glossary.html">Glossary Page</a></nav>
        <a class="exe-tooltip glossary" href="glossary.html#term">Term</a>
      `;
      const link = document.querySelector('a.exe-tooltip');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      let failCallback;
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html'),
            text: vi.fn().mockReturnValue('Term'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: (success, fail) => {
          failCallback = fail;
        },
      });

      config.content.text({}, mockApi);
      failCallback();

      expect(mockApi.set).toHaveBeenCalledWith('content.text', 'Glossary Page');
    });

    it('reuses existing glossary terms container on local file protocol', () => {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'file:', href: 'file:///test/' },
        writable: true,
        configurable: true,
      });

      // Pre-create the glossary container with glossary terms
      document.body.innerHTML = `
        <div id="exe-glossary-terms" style="display:none">
          <dl><dt>existing</dt><dd>Existing definition</dd></dl>
        </div>
        <a class="exe-tooltip glossary" href="glossary.html#existing">existing</a>
      `;
      const link = document.querySelector('a.exe-tooltip');
      exeTooltips.enableGlossaryTooltip('glossary', link);

      const config = qtipMock.mock.calls[0][0];
      let successCallback;
      const mockApi = {
        elements: {
          target: {
            attr: vi.fn().mockReturnValue('glossary.html#existing'),
            text: vi.fn().mockReturnValue('existing'),
          },
        },
        set: vi.fn(),
      };

      $.ajax = vi.fn().mockReturnValue({
        then: (success, fail) => {
          successCallback = success;
        },
      });

      config.content.text({}, mockApi);

      // Simulate AJAX success - the pre-existing container should be used
      successCallback('<div class="FreeTextIdevice"><div class="iDevice_content"><dl><dt>new</dt><dd>New def</dd></dl></div></div>');

      // Should find the existing term from the cached container
      expect(mockApi.set).toHaveBeenCalledWith('content.text', 'Existing definition');
    });
  });

  describe('className property', () => {
    it('has default className', () => {
      expect(exeTooltips.className).toBe('exe-tooltip');
    });
  });
});
