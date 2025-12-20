import PropertiesProjectButton from './propertiesButton.js';

describe('PropertiesProjectButton', () => {
  let propertiesButton;
  let mockButton;
  let mockShowModalProperties;

  beforeEach(() => {
    // Mock DOM element
    mockButton = {
      addEventListener: vi.fn(),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock eXeLearning global
    mockShowModalProperties = vi.fn();
    window.eXeLearning = {
      app: {
        project: {
          properties: {
            showModalProperties: mockShowModalProperties,
          },
        },
      },
    };

    propertiesButton = new PropertiesProjectButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should query the properties button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-top-project-properties-button');
    });

    it('should store the button element reference', () => {
      expect(propertiesButton.propertiesMenuHeadButton).toBe(mockButton);
    });
  });

  describe('init', () => {
    it('should call addEventClick', () => {
      const spy = vi.spyOn(propertiesButton, 'addEventClick');
      propertiesButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      propertiesButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call showModalProperties when button is clicked', () => {
      propertiesButton.addEventClick();

      // Get the event handler
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];

      // Simulate click
      clickHandler(new Event('click'));

      expect(mockShowModalProperties).toHaveBeenCalled();
    });

    it('should pass event to the click handler', () => {
      propertiesButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      const mockEvent = new Event('click');

      expect(() => clickHandler(mockEvent)).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should set up click handler when initialized', () => {
      propertiesButton.init();

      expect(mockButton.addEventListener).toHaveBeenCalled();

      // Simulate click
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler(new Event('click'));

      expect(mockShowModalProperties).toHaveBeenCalled();
    });
  });
});
