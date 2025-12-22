import Common from './app_common.js';

describe('Common', () => {
  let common;

  beforeEach(() => {
    // Mock eXeLearning global
    window.eXeLearning = {
      version: 'v1.2.3',
      config: { environment: 'prod' }
    };

    common = new Common({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
  });

  describe('generateRandomString', () => {
    it('should generate string of correct length', () => {
      const result = common.generateRandomString(5);
      expect(result).toHaveLength(5);
    });

    it('should generate string of length 1', () => {
      const result = common.generateRandomString(1);
      expect(result).toHaveLength(1);
    });

    it('should generate string of length 10', () => {
      const result = common.generateRandomString(10);
      expect(result).toHaveLength(10);
    });

    it('should generate string of length 100', () => {
      const result = common.generateRandomString(100);
      expect(result).toHaveLength(100);
    });

    it('should only contain uppercase letters and numbers', () => {
      const result = common.generateRandomString(100);
      expect(result).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate different strings on multiple calls', () => {
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(common.generateRandomString(10));
      }
      expect(results.size).toBeGreaterThan(90);
    });

    it('should handle length 0', () => {
      const result = common.generateRandomString(0);
      expect(result).toBe('');
    });
  });

  describe('generateId', () => {
    it('should generate ID with date components and random suffix', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      const result = common.generateId();
      expect(result).toMatch(/^20251217103045123[A-Z0-9]{3}$/);
    });

    it('should generate different IDs on multiple calls', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      const id1 = common.generateId();
      const id2 = common.generateId();
      expect(id1).not.toBe(id2);
    });

    it('should include year in ID', () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00.000'));
      const result = common.generateId();
      expect(result.startsWith('2025')).toBe(true);
    });

    it('should include month with padding in ID', () => {
      vi.setSystemTime(new Date('2025-01-15T00:00:00.000'));
      const result = common.generateId();
      expect(result.substring(4, 6)).toBe('01');
    });

    it('should include day with padding in ID', () => {
      vi.setSystemTime(new Date('2025-12-05T00:00:00.000'));
      const result = common.generateId();
      expect(result.substring(6, 8)).toBe('05');
    });

    it('should handle midnight', () => {
      vi.setSystemTime(new Date('2025-06-15T00:00:00.000'));
      const result = common.generateId();
      expect(result).toMatch(/^20250615000000000[A-Z0-9]{3}$/);
    });

    it('should handle end of day', () => {
      vi.setSystemTime(new Date('2025-12-31T23:59:59.999'));
      const result = common.generateId();
      expect(result).toMatch(/^20251231235959999[A-Z0-9]{3}$/);
    });
  });

  describe('timer', () => {
    it('should return a Promise', () => {
      const result = common.timer(100);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve after specified milliseconds', async () => {
      vi.useFakeTimers();
      const promise = common.timer(100);
      let resolved = false;
      promise.then(() => { resolved = true; });

      expect(resolved).toBe(false);

      vi.advanceTimersByTime(99);
      await Promise.resolve();
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await Promise.resolve();
      expect(resolved).toBe(true);

      vi.useRealTimers();
    });

    it('should resolve with undefined', async () => {
      vi.useFakeTimers();
      const promise = common.timer(100);
      vi.advanceTimersByTime(100);
      const result = await promise;
      expect(result).toBeUndefined();
      vi.useRealTimers();
    });

    it('should work with 0 milliseconds', async () => {
      vi.useFakeTimers();
      const promise = common.timer(0);
      vi.advanceTimersByTime(0);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it('should work with large timeout values', async () => {
      vi.useFakeTimers();
      const promise = common.timer(10000);
      vi.advanceTimersByTime(10000);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('getVersionTimeStamp', () => {
    it('should return version in production environment', () => {
      window.eXeLearning.config.environment = 'prod';
      window.eXeLearning.version = 'v1.2.3';
      expect(common.getVersionTimeStamp()).toBe('v1.2.3');
    });

    it('should return version when not in dev environment', () => {
      window.eXeLearning.config.environment = 'test';
      window.eXeLearning.version = 'v2.0.0';
      expect(common.getVersionTimeStamp()).toBe('v2.0.0');
    });

    it('should return Date.now() in dev environment', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      window.eXeLearning.config.environment = 'dev';
      const result = common.getVersionTimeStamp();
      expect(typeof result).toBe('number');
      expect(result).toBe(Date.now());
    });

    it('should return Date.now() when version is v0.0.0-alpha', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      window.eXeLearning.version = 'v0.0.0-alpha';
      window.eXeLearning.config.environment = 'prod';
      const result = common.getVersionTimeStamp();
      expect(typeof result).toBe('number');
      expect(result).toBe(Date.now());
    });

    it('should handle different version formats', () => {
      window.eXeLearning.version = 'v3.1.0-beta';
      window.eXeLearning.config.environment = 'prod';
      expect(common.getVersionTimeStamp()).toBe('v3.1.0-beta');
    });
  });

  describe('constructor', () => {
    it('should store app reference', () => {
      const mockApp = { name: 'test' };
      const instance = new Common(mockApp);
      expect(instance.app).toBe(mockApp);
    });

    it('should create DateConversion instance', () => {
      expect(common.dateConversion).toBeDefined();
      expect(common.dateConversion.constructor.name).toBe('DateConversion');
    });
  });

  describe('integration with DateConversion', () => {
    it('should use DateConversion methods in generateId', () => {
      vi.setSystemTime(new Date('2025-12-17T10:30:45.123'));
      const getYearSpy = vi.spyOn(common.dateConversion, 'getDateYear');
      const getMonthSpy = vi.spyOn(common.dateConversion, 'getDateMonth');
      const getDaySpy = vi.spyOn(common.dateConversion, 'getDateDay');
      const getHourSpy = vi.spyOn(common.dateConversion, 'getDateHour');
      const getMinutesSpy = vi.spyOn(common.dateConversion, 'getDateMinutes');
      const getSecondsSpy = vi.spyOn(common.dateConversion, 'getDateSeconds');
      const getMillisecondsSpy = vi.spyOn(common.dateConversion, 'getDateMilliseconds');

      common.generateId();

      expect(getYearSpy).toHaveBeenCalled();
      expect(getMonthSpy).toHaveBeenCalled();
      expect(getDaySpy).toHaveBeenCalled();
      expect(getHourSpy).toHaveBeenCalled();
      expect(getMinutesSpy).toHaveBeenCalled();
      expect(getSecondsSpy).toHaveBeenCalled();
      expect(getMillisecondsSpy).toHaveBeenCalled();
    });
  });

  describe('markdownToHTML', () => {
    beforeEach(() => {
      // Mock showdown.Converter as a class
      const MockConverter = vi.fn().mockImplementation(function() {
        this.setOption = vi.fn();
        this.makeHtml = vi.fn((content) => `<p>${content}</p>`);
      });

      window.showdown = {
        Converter: MockConverter,
      };
    });

    afterEach(() => {
      delete window.showdown;
    });

    it('should convert markdown to HTML', () => {
      const markdown = '# Hello World';
      const result = common.markdownToHTML(markdown);
      expect(result).toBe('<p># Hello World</p>');
    });

    it('should create a new Converter instance', () => {
      common.markdownToHTML('test');
      expect(window.showdown.Converter).toHaveBeenCalled();
    });

    it('should handle empty content', () => {
      const result = common.markdownToHTML('');
      expect(result).toBe('<p></p>');
    });

    it('should return a string', () => {
      const result = common.markdownToHTML('test');
      expect(typeof result).toBe('string');
    });
  });

  describe('initTooltips', () => {
    let mockElements;
    let mockTooltipInstance;

    beforeEach(() => {
      // Mock Bootstrap Tooltip
      mockTooltipInstance = {
        hide: vi.fn(),
      };

      window.bootstrap = {
        Tooltip: {
          getInstance: vi.fn(() => null),
          getOrCreateInstance: vi.fn(() => mockTooltipInstance),
        },
      };

      // Mock DOM elements
      mockElements = [
        {
          addEventListener: vi.fn(),
          classList: { contains: vi.fn(() => true) },
        },
        {
          addEventListener: vi.fn(),
          classList: { contains: vi.fn(() => true) },
        },
      ];

      vi.spyOn(document, 'querySelectorAll').mockReturnValue(mockElements);
    });

    afterEach(() => {
      delete window.bootstrap;
    });

    it('should find elements with exe-app-tooltip class', () => {
      common.initTooltips();
      expect(document.querySelectorAll).toHaveBeenCalledWith('.exe-app-tooltip');
    });

    it('should create tooltip instances for each element', () => {
      common.initTooltips();
      expect(window.bootstrap.Tooltip.getOrCreateInstance).toHaveBeenCalledTimes(2);
      expect(window.bootstrap.Tooltip.getOrCreateInstance).toHaveBeenCalledWith(mockElements[0]);
      expect(window.bootstrap.Tooltip.getOrCreateInstance).toHaveBeenCalledWith(mockElements[1]);
    });

    it('should add click event listener to hide tooltip', () => {
      common.initTooltips();
      expect(mockElements[0].addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        { passive: true }
      );
    });

    it('should add mouseleave event listener to hide tooltip', () => {
      common.initTooltips();
      expect(mockElements[0].addEventListener).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function),
        { passive: true }
      );
    });

    it('should not create tooltip if one already exists', () => {
      window.bootstrap.Tooltip.getInstance = vi.fn(() => mockTooltipInstance);

      common.initTooltips();

      expect(window.bootstrap.Tooltip.getOrCreateInstance).not.toHaveBeenCalled();
    });

    it('should work with specific element scope', () => {
      const mockScope = document.createElement('div');
      vi.spyOn(mockScope, 'querySelectorAll').mockReturnValue(mockElements);

      common.initTooltips(mockScope);

      expect(mockScope.querySelectorAll).toHaveBeenCalledWith('.exe-app-tooltip');
    });

    it('should not throw if Bootstrap is not available and jQuery is available', () => {
      delete window.bootstrap;

      // vitest.setup.js already provides a jQuery mock, just verify it doesn't throw
      expect(() => common.initTooltips()).not.toThrow();
    });

    it('should handle null element scope gracefully', () => {
      expect(() => common.initTooltips(null)).not.toThrow();
    });
  });
});
