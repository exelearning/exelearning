import MenuIdevices from './menuIdevices.js';
import MenuIdevicesCompose from './menuIdevicesCompose.js';
import MenuIdevicesBehaviour from './menuIdevicesBehaviour.js';
import MenuIdevicesBottom from './menuIdevicesBottom.js';

// Mock MenuIdevicesCompose
vi.mock('./menuIdevicesCompose.js', () => {
  return {
    default: vi.fn().mockImplementation(function(menu, idevicesList) {
      this.menu = menu;
      this.idevicesList = idevicesList;
      this.compose = vi.fn();
    })
  };
});

// Mock MenuIdevicesBehaviour
vi.mock('./menuIdevicesBehaviour.js', () => {
  return {
    default: vi.fn().mockImplementation(function(menu) {
      this.menu = menu;
      this.behaviour = vi.fn();
    })
  };
});

// Mock MenuIdevicesBottom
vi.mock('./menuIdevicesBottom.js', () => {
  return {
    default: vi.fn().mockImplementation(function(menu) {
      this.menu = menu;
      this.init = vi.fn();
    })
  };
});

describe('MenuIdevices', () => {
  let menuIdevices;
  let mockIdevicesList;
  let mockMenuElement;
  let mockBottomElement;
  let mockCategoryElements;
  let mockLabelElements;

  beforeEach(() => {
    // Mock DOM elements
    mockMenuElement = {
      id: 'menu_idevices',
    };

    mockBottomElement = {
      id: 'idevices-bottom',
      children: [],
    };

    mockCategoryElements = [
      { className: 'idevice_category' },
      { className: 'idevice_category' },
    ];

    mockLabelElements = [
      { className: 'label' },
      { className: 'label' },
    ];

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#menu_idevices') return mockMenuElement;
      if (selector === '#idevices-bottom') return mockBottomElement;
      return null;
    });

    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === '#menu_idevices .idevice_category') return mockCategoryElements;
      if (selector === '#menu_idevices .idevice_category .label') return mockLabelElements;
      return [];
    });

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'idevices-bottom') return mockBottomElement;
      return null;
    });

    // Mock idevices list
    mockIdevicesList = {
      items: [],
    };

    menuIdevices = new MenuIdevices(mockIdevicesList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should store idevicesList reference', () => {
      expect(menuIdevices.idevicesList).toBe(mockIdevicesList);
    });

    it('should query menu idevices element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#menu_idevices');
    });

    it('should query bottom content element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#idevices-bottom');
    });

    it('should store menu element reference', () => {
      expect(menuIdevices.menuIdevices).toBe(mockMenuElement);
    });

    it('should store bottom content element reference', () => {
      expect(menuIdevices.menuIdevicesBottomContent).toBe(mockBottomElement);
    });

    it('should initialize categoriesIdevices as undefined', () => {
      expect(menuIdevices.categoriesIdevices).toBeUndefined();
    });

    it('should initialize categoriesIdevicesLabels as undefined', () => {
      expect(menuIdevices.categoriesIdevicesLabels).toBeUndefined();
    });

    it('should create MenuIdevicesCompose instance', () => {
      expect(MenuIdevicesCompose).toHaveBeenCalledWith(menuIdevices, mockIdevicesList);
      expect(menuIdevices.menuIdevicesCompose).toBeDefined();
    });

    it('should create MenuIdevicesBehaviour instance', () => {
      expect(MenuIdevicesBehaviour).toHaveBeenCalledWith(menuIdevices);
      expect(menuIdevices.menuIdevicesBehaviour).toBeDefined();
    });
  });

  describe('load', () => {
    it('should call compose', () => {
      const spy = vi.spyOn(menuIdevices, 'compose');
      menuIdevices.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call behaviour', () => {
      const spy = vi.spyOn(menuIdevices, 'behaviour');
      menuIdevices.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call compose before behaviour', () => {
      const composeSpy = vi.spyOn(menuIdevices, 'compose');
      const behaviourSpy = vi.spyOn(menuIdevices, 'behaviour');

      menuIdevices.load();

      expect(composeSpy).toHaveBeenCalledBefore(behaviourSpy);
    });
  });

  describe('compose', () => {
    it('should call compose on menuIdevicesCompose', () => {
      menuIdevices.compose();

      expect(menuIdevices.menuIdevicesCompose.compose).toHaveBeenCalled();
    });

    it('should query category elements', () => {
      menuIdevices.compose();

      expect(document.querySelectorAll).toHaveBeenCalledWith('#menu_idevices .idevice_category');
    });

    it('should query label elements', () => {
      menuIdevices.compose();

      expect(document.querySelectorAll).toHaveBeenCalledWith('#menu_idevices .idevice_category .label');
    });

    it('should store category elements', () => {
      menuIdevices.compose();

      expect(menuIdevices.categoriesIdevices).toBe(mockCategoryElements);
    });

    it('should store label elements', () => {
      menuIdevices.compose();

      expect(menuIdevices.categoriesIdevicesLabels).toBe(mockLabelElements);
    });
  });

  describe('behaviour', () => {
    beforeEach(() => {
      // Clear MenuIdevicesBottom mock before each test
      MenuIdevicesBottom.mockClear();
    });

    it('should call behaviour on menuIdevicesBehaviour', () => {
      menuIdevices.behaviour();

      expect(menuIdevices.menuIdevicesBehaviour.behaviour).toHaveBeenCalled();
    });

    it('should check for bottom menu button', () => {
      menuIdevices.behaviour();

      expect(document.getElementById).toHaveBeenCalledWith('idevices-bottom');
    });

    it('should create MenuIdevicesBottom when element has no children', () => {
      // Create fresh instance for this test
      const emptyElement = { id: 'idevices-bottom', children: [] };
      document.getElementById.mockReturnValueOnce(emptyElement);

      menuIdevices.behaviour();

      expect(MenuIdevicesBottom).toHaveBeenCalledWith(menuIdevices);
      expect(menuIdevices.menuIdevicesBottom).toBeDefined();
    });

    it('should initialize MenuIdevicesBottom when created', () => {
      const emptyElement = { id: 'idevices-bottom', children: [] };
      document.getElementById.mockReturnValueOnce(emptyElement);

      menuIdevices.behaviour();

      expect(menuIdevices.menuIdevicesBottom.init).toHaveBeenCalled();
    });

    it('should not create MenuIdevicesBottom when element has children', () => {
      const elementWithChildren = {
        id: 'idevices-bottom',
        children: [{ id: 'child' }],
      };

      document.getElementById.mockReturnValueOnce(elementWithChildren);

      menuIdevices.behaviour();

      expect(MenuIdevicesBottom).not.toHaveBeenCalled();
    });

    it('should create MenuIdevicesBottom when element is null', () => {
      document.getElementById.mockReturnValueOnce(null);

      menuIdevices.behaviour();

      // Should create because element doesn't exist
      expect(MenuIdevicesBottom).toHaveBeenCalledWith(menuIdevices);
    });
  });

  describe('integration', () => {
    beforeEach(() => {
      MenuIdevicesBottom.mockClear();
    });

    it('should load compose and behaviour together', () => {
      const elementWithContent = {
        id: 'idevices-bottom',
        children: [{ id: 'existing' }],
      };
      document.getElementById.mockReturnValueOnce(elementWithContent);

      menuIdevices.load();

      expect(menuIdevices.menuIdevicesCompose.compose).toHaveBeenCalled();
      expect(menuIdevices.menuIdevicesBehaviour.behaviour).toHaveBeenCalled();
      expect(menuIdevices.categoriesIdevices).toBe(mockCategoryElements);
      expect(menuIdevices.categoriesIdevicesLabels).toBe(mockLabelElements);
    });

    it('should create bottom menu when loading with empty container', () => {
      const emptyElement = {
        id: 'idevices-bottom',
        children: [],
      };

      document.getElementById.mockReturnValueOnce(emptyElement);

      menuIdevices.load();

      expect(menuIdevices.menuIdevicesBottom).toBeDefined();
      expect(menuIdevices.menuIdevicesBottom.init).toHaveBeenCalled();
    });

    it('should not create bottom menu when container has content', () => {
      const elementWithContent = {
        id: 'idevices-bottom',
        children: [{ id: 'existing' }],
      };

      document.getElementById.mockReturnValueOnce(elementWithContent);

      menuIdevices.load();

      expect(MenuIdevicesBottom).not.toHaveBeenCalled();
    });
  });
});
