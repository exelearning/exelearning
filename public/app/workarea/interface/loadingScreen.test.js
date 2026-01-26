import LoadingScreen from './loadingScreen.js';

describe('LoadingScreen', () => {
  let loadingScreen;
  let mockElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock DOM element
    mockElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      setAttribute: vi.fn(),
      style: {
        display: '',
      },
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

    loadingScreen = new LoadingScreen();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with loadingScreenNode from DOM', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main > #load-screen-main');
      expect(loadingScreen.loadingScreenNode).toBe(mockElement);
    });

    it('should set hideTime to 1000ms', () => {
      expect(loadingScreen.hideTime).toBe(1000);
    });
  });

  describe('show', () => {
    it('should remove hide class', () => {
      loadingScreen.show();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('hide');
    });

    it('should add loading class', () => {
      loadingScreen.show();
      expect(mockElement.classList.add).toHaveBeenCalledWith('loading');
    });

    it('should set data-visible attribute to true', () => {
      loadingScreen.show();
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-visible', 'true');
    });

    it('should call classList methods in correct order', () => {
      loadingScreen.show();
      expect(mockElement.classList.remove).toHaveBeenCalledBefore(mockElement.classList.add);
    });
  });

  describe('hide', () => {
    it('should remove loading class immediately', () => {
      loadingScreen.hide();
      expect(mockElement.classList.remove).toHaveBeenCalledWith('loading');
    });

    it('should add hiding class immediately', () => {
      loadingScreen.hide();
      expect(mockElement.classList.add).toHaveBeenCalledWith('hiding');
    });

    it('should remove hiding class after hideTime', () => {
      loadingScreen.hide();

      expect(mockElement.classList.remove).toHaveBeenCalledTimes(1);
      expect(mockElement.classList.remove).toHaveBeenCalledWith('loading');

      vi.advanceTimersByTime(1000);

      expect(mockElement.classList.remove).toHaveBeenCalledTimes(2);
      expect(mockElement.classList.remove).toHaveBeenCalledWith('hiding');
    });

    it('should add hide class after hideTime', () => {
      loadingScreen.hide();

      expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
      expect(mockElement.classList.add).toHaveBeenCalledWith('hiding');

      vi.advanceTimersByTime(1000);

      expect(mockElement.classList.add).toHaveBeenCalledTimes(2);
      expect(mockElement.classList.add).toHaveBeenCalledWith('hide');
    });

    it('should set data-visible to false after hideTime', () => {
      loadingScreen.hide();

      expect(mockElement.setAttribute).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-visible', 'false');
    });

    it('should not trigger final changes before hideTime elapses', () => {
      loadingScreen.hide();

      vi.advanceTimersByTime(999);

      expect(mockElement.classList.remove).toHaveBeenCalledTimes(1);
      expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
      expect(mockElement.setAttribute).not.toHaveBeenCalled();
    });

    it('should respect custom hideTime if changed', () => {
      loadingScreen.hideTime = 500;
      loadingScreen.hide();

      vi.advanceTimersByTime(499);
      expect(mockElement.classList.remove).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(mockElement.classList.remove).toHaveBeenCalledTimes(2);
      expect(mockElement.classList.remove).toHaveBeenCalledWith('hiding');
    });
  });

  describe('integration', () => {
    it('should handle show followed by hide', () => {
      loadingScreen.show();

      expect(mockElement.classList.remove).toHaveBeenCalledWith('hide');
      expect(mockElement.classList.add).toHaveBeenCalledWith('loading');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-visible', 'true');

      mockElement.classList.remove.mockClear();
      mockElement.classList.add.mockClear();
      mockElement.setAttribute.mockClear();

      loadingScreen.hide();

      expect(mockElement.classList.remove).toHaveBeenCalledWith('loading');
      expect(mockElement.classList.add).toHaveBeenCalledWith('hiding');

      vi.advanceTimersByTime(1000);

      expect(mockElement.classList.remove).toHaveBeenCalledWith('hiding');
      expect(mockElement.classList.add).toHaveBeenCalledWith('hide');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-visible', 'false');
    });

    it('should handle multiple show calls', () => {
      loadingScreen.show();
      mockElement.classList.remove.mockClear();
      mockElement.classList.add.mockClear();
      mockElement.setAttribute.mockClear();

      loadingScreen.show();

      expect(mockElement.classList.remove).toHaveBeenCalledWith('hide');
      expect(mockElement.classList.add).toHaveBeenCalledWith('loading');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-visible', 'true');
    });

    it('should handle multiple hide calls', () => {
      loadingScreen.hide();
      loadingScreen.hide();

      vi.advanceTimersByTime(1000);

      // Both hides should have been processed
      expect(mockElement.classList.remove).toHaveBeenCalledWith('loading');
      expect(mockElement.classList.remove).toHaveBeenCalledWith('hiding');
      expect(mockElement.classList.add).toHaveBeenCalledWith('hiding');
      expect(mockElement.classList.add).toHaveBeenCalledWith('hide');
    });
  });
});
