import DownloadProjectButton from './downloadButton.js';

describe('DownloadProjectButton', () => {
  let downloadButton;
  let mockButton;
  let mockCheckOpenIdevice;
  let mockDownloadProjectEvent;

  beforeEach(() => {
    // Mock DOM element
    mockButton = {
      addEventListener: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock eXeLearning global
    mockCheckOpenIdevice = vi.fn(() => false);
    mockDownloadProjectEvent = vi.fn();

    window.eXeLearning = {
      app: {
        project: {
          checkOpenIdevice: mockCheckOpenIdevice,
        },
        menus: {
          navbar: {
            file: {
              downloadProjectEvent: mockDownloadProjectEvent,
            },
          },
        },
      },
    };

    downloadButton = new DownloadProjectButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should query the download button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-top-download-button');
    });

    it('should store the button element reference', () => {
      expect(downloadButton.downloadMenuHeadButton).toBe(mockButton);
    });
  });

  describe('init', () => {
    it('should call addEventClick', () => {
      const spy = vi.spyOn(downloadButton, 'addEventClick');
      downloadButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      downloadButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call downloadProjectEvent when button is clicked and no idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(false);
      downloadButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(mockDownloadProjectEvent).toHaveBeenCalled();
    });

    it('should not call downloadProjectEvent when an idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      downloadButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(mockDownloadProjectEvent).not.toHaveBeenCalled();
    });

    it('should check for open idevice before downloading', () => {
      downloadButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalledBefore(mockDownloadProjectEvent);
    });

    it('should return early if idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      downloadButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      const result = clickHandler(new Event('click'));

      expect(result).toBeUndefined();
      expect(mockDownloadProjectEvent).not.toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should set up click handler when initialized', () => {
      downloadButton.init();

      expect(mockButton.addEventListener).toHaveBeenCalled();

      // Simulate click with no idevice open
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockDownloadProjectEvent).toHaveBeenCalled();
    });

    it('should handle multiple clicks', () => {
      downloadButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];

      // First click
      clickHandler(new Event('click'));
      expect(mockDownloadProjectEvent).toHaveBeenCalledTimes(1);

      // Second click
      clickHandler(new Event('click'));
      expect(mockDownloadProjectEvent).toHaveBeenCalledTimes(2);
    });
  });
});
