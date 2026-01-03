import PreviewButton from './previewButton.js';
import PreviewPanelManager from './previewPanel.js';

// Mock PreviewPanelManager as a class
vi.mock('./previewPanel.js', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      this.init = vi.fn();
      this.toggle = vi.fn();
    })
  };
});

describe('PreviewButton', () => {
  let previewButton;
  let mockButton;
  let mockCheckOpenIdevice;
  let mockPreviewPanelInstance;

  beforeEach(() => {
    // Mock DOM element
    mockButton = {
      addEventListener: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock eXeLearning global
    mockCheckOpenIdevice = vi.fn(() => false);

    window.eXeLearning = {
      app: {
        project: {
          checkOpenIdevice: mockCheckOpenIdevice,
        },
      },
    };

    previewButton = new PreviewButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should query the preview button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-bottom-preview');
    });

    it('should store the button element reference', () => {
      expect(previewButton.previewMenuHeadButton).toBe(mockButton);
    });

    it('should create a PreviewPanelManager instance', () => {
      expect(PreviewPanelManager).toHaveBeenCalled();
      expect(previewButton.previewPanel).toBeDefined();
    });
  });

  describe('init', () => {
    it('should initialize the preview panel', () => {
      previewButton.init();
      expect(previewButton.previewPanel.init).toHaveBeenCalled();
    });

    it('should call addEventClick', () => {
      const spy = vi.spyOn(previewButton, 'addEventClick');
      previewButton.init();
      expect(spy).toHaveBeenCalled();
    });

    it('should initialize panel before adding event listener', () => {
      previewButton.init();
      expect(previewButton.previewPanel.init).toHaveBeenCalledBefore(mockButton.addEventListener);
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      previewButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should toggle preview panel when button is clicked and no idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(false);
      previewButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(previewButton.previewPanel.toggle).toHaveBeenCalled();
    });

    it('should not toggle preview panel when an idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      previewButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(previewButton.previewPanel.toggle).not.toHaveBeenCalled();
    });

    it('should check for open idevice before toggling preview', () => {
      previewButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalledBefore(previewButton.previewPanel.toggle);
    });

    it('should return early if idevice is open', () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      previewButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      const result = clickHandler(new Event('click'));

      expect(result).toBeUndefined();
      expect(previewButton.previewPanel.toggle).not.toHaveBeenCalled();
    });
  });

  describe('getPanel', () => {
    it('should return the preview panel instance', () => {
      const panel = previewButton.getPanel();
      expect(panel).toBe(previewButton.previewPanel);
    });

    it('should return the same instance on multiple calls', () => {
      const panel1 = previewButton.getPanel();
      const panel2 = previewButton.getPanel();
      expect(panel1).toBe(panel2);
    });
  });

  describe('integration', () => {
    it('should set up click handler when initialized', () => {
      previewButton.init();

      expect(mockButton.addEventListener).toHaveBeenCalled();
      expect(previewButton.previewPanel.init).toHaveBeenCalled();

      // Simulate click with no idevice open
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(previewButton.previewPanel.toggle).toHaveBeenCalled();
    });

    it('should handle multiple toggles', () => {
      previewButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];

      // First click
      clickHandler(new Event('click'));
      expect(previewButton.previewPanel.toggle).toHaveBeenCalledTimes(1);

      // Second click
      clickHandler(new Event('click'));
      expect(previewButton.previewPanel.toggle).toHaveBeenCalledTimes(2);
    });
  });
});
