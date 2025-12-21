import ModeButton from './modeButton.js';

describe('ModeButton', () => {
  let modeButton;
  let mockButton;
  let mockBody;

  beforeEach(() => {
    // Mock DOM elements
    mockButton = {
      addEventListener: vi.fn(),
      setAttribute: vi.fn(),
      title: '',
    };

    mockBody = {
      setAttribute: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#exe-mode-check') return mockButton;
      if (selector === 'body') return mockBody;
      return null;
    });

    // Mock translation function
    window._ = vi.fn((text) => text);

    modeButton = new ModeButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window._;
  });

  describe('constructor', () => {
    it('should query the mode button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#exe-mode-check');
    });

    it('should store the button element reference', () => {
      expect(modeButton.modeMenuHeadButton).toBe(mockButton);
    });

    it('should initialize mode to advanced', () => {
      expect(modeButton.mode).toBe('advanced');
    });

    it('should have modesText object with translations', () => {
      expect(modeButton.modesText).toBeDefined();
      expect(modeButton.modesText.default).toBe('Default');
      expect(modeButton.modesText.advanced).toBe('Advanced');
    });
  });

  describe('init', () => {
    it('should call updateMode with initial mode', () => {
      const spy = vi.spyOn(modeButton, 'updateMode');
      modeButton.init();
      expect(spy).toHaveBeenCalledWith('advanced');
    });

    it('should call addEventClick', () => {
      const spy = vi.spyOn(modeButton, 'addEventClick');
      modeButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('updateMode', () => {
    it('should update mode property', () => {
      modeButton.updateMode('default');
      expect(modeButton.mode).toBe('default');
    });

    it('should set mode attribute on button', () => {
      modeButton.updateMode('default');
      expect(mockButton.setAttribute).toHaveBeenCalledWith('mode', 'default');
    });

    it('should set mode attribute on body', () => {
      modeButton.updateMode('advanced');
      expect(mockBody.setAttribute).toHaveBeenCalledWith('mode', 'advanced');
    });

    it('should update button title with mode text', () => {
      modeButton.updateMode('default');
      expect(mockButton.title).toBe('Mode: Default');
    });

    it('should use translation function for title', () => {
      modeButton.updateMode('advanced');
      expect(window._).toHaveBeenCalledWith('Mode:');
      expect(window._).toHaveBeenCalledWith('Advanced');
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      modeButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should toggle from default to advanced on click', () => {
      modeButton.mode = 'default';
      const spy = vi.spyOn(modeButton, 'updateMode');
      modeButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(spy).toHaveBeenCalledWith('advanced');
    });

    it('should toggle from advanced to default on click', () => {
      modeButton.mode = 'advanced';
      const spy = vi.spyOn(modeButton, 'updateMode');
      modeButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(spy).toHaveBeenCalledWith('default');
    });
  });

  describe('integration', () => {
    it('should set up click handler when initialized', () => {
      modeButton.init();

      expect(mockButton.addEventListener).toHaveBeenCalled();
      expect(mockButton.setAttribute).toHaveBeenCalledWith('mode', 'advanced');
    });

    it('should toggle mode on multiple clicks', () => {
      modeButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];

      // First click (advanced -> default)
      clickHandler(new Event('click'));
      expect(modeButton.mode).toBe('default');
      expect(mockBody.setAttribute).toHaveBeenCalledWith('mode', 'default');

      // Second click (default -> advanced)
      clickHandler(new Event('click'));
      expect(modeButton.mode).toBe('advanced');
      expect(mockBody.setAttribute).toHaveBeenCalledWith('mode', 'advanced');

      // Third click (advanced -> default)
      clickHandler(new Event('click'));
      expect(modeButton.mode).toBe('default');
    });
  });
});
