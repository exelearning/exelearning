import MenuEngine from './menuEngine.js';

describe('MenuEngine', () => {
  let menuEngine;
  let mockBody;
  let mockHead;
  let mockWorkarea;
  let mockMenus;
  let mockMenuNav;
  let mockMenuIdevices;

  beforeEach(() => {
    // Mock DOM elements
    mockBody = {
      id: 'main',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    mockHead = { id: 'head' };
    mockWorkarea = { id: 'workarea' };

    mockMenuNav = {
      id: 'menu_nav',
    };

    mockMenuIdevices = {
      id: 'menu_idevices',
    };

    mockMenus = [mockMenuNav, mockMenuIdevices];

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === 'body#main') return mockBody;
      if (selector === '#main #head') return mockHead;
      if (selector === '#main #workarea') return mockWorkarea;
      if (selector === '#main #workarea #menu_nav') return mockMenuNav;
      if (selector === '#main #workarea #menu_idevices') return mockMenuIdevices;
      return null;
    });

    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === '#main #workarea .menu') return mockMenus;
      return [];
    });

    // Mock document.body (used by initMobileLayout)
    Object.defineProperty(document, 'body', {
      writable: true,
      configurable: true,
      value: mockBody,
    });

    // Mock window
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    window.addEventListener = vi.fn();
    document.addEventListener = vi.fn();

    menuEngine = new MenuEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.bootstrap;
  });

  describe('constructor', () => {
    it('should query main body element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('body#main');
    });

    it('should query head element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #head');
    });

    it('should query workarea element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #workarea');
    });

    it('should query all menu elements', () => {
      expect(document.querySelectorAll).toHaveBeenCalledWith('#main #workarea .menu');
    });

    it('should query menu nav element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #workarea #menu_nav');
    });

    it('should query menu idevices element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #workarea #menu_idevices');
    });

    it('should store main element reference', () => {
      expect(menuEngine.main).toBe(mockBody);
    });

    it('should store head element reference', () => {
      expect(menuEngine.head).toBe(mockHead);
    });

    it('should store workarea element reference', () => {
      expect(menuEngine.workarea).toBe(mockWorkarea);
    });

    it('should store menus elements reference', () => {
      expect(menuEngine.menus).toBe(mockMenus);
    });

    it('should initialize relationSizeMenus with menu_nav', () => {
      expect(menuEngine.relationSizeMenus['menu_nav']).toBe(50);
    });

    it('should initialize relationSizeMenus with menu_idevices', () => {
      expect(menuEngine.relationSizeMenus['menu_idevices']).toBe(50);
    });
  });

  describe('behaviour', () => {
    it('should call closeMenusEvent', () => {
      const spy = vi.spyOn(menuEngine, 'closeMenusEvent');
      menuEngine.behaviour();

      expect(spy).toHaveBeenCalled();
    });

    it('should call initMobileMenuBehavior', () => {
      const spy = vi.spyOn(menuEngine, 'initMobileMenuBehavior');
      menuEngine.behaviour();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('initMobileMenuBehavior', () => {
    let mockUserDropdown;
    let mockDropdownToggle;

    beforeEach(() => {
      mockUserDropdown = {
        addEventListener: vi.fn(),
      };

      mockDropdownToggle = {
        id: 'exeUserMenuToggler',
      };

      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#head-bottom-user-logged') return mockUserDropdown;
        if (selector === '#exeUserMenuToggler') return mockDropdownToggle;
        if (selector === 'body#main') return mockBody;
        if (selector === '#main #head') return mockHead;
        if (selector === '#main #workarea') return mockWorkarea;
        if (selector === '#main #workarea #menu_nav') return mockMenuNav;
        if (selector === '#main #workarea #menu_idevices') return mockMenuIdevices;
        return null;
      });
    });

    it('should return early if userDropdown is not found', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      menuEngine.initMobileMenuBehavior();

      expect(window.addEventListener).not.toHaveBeenCalled();
    });

    it('should add click event listener to userDropdown', () => {
      menuEngine.initMobileMenuBehavior();

      expect(mockUserDropdown.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call initMobileButtonHandlers', () => {
      const spy = vi.spyOn(menuEngine, 'initMobileButtonHandlers');
      menuEngine.initMobileMenuBehavior();

      expect(spy).toHaveBeenCalled();
    });

    it('should call initMobileLayout', () => {
      const spy = vi.spyOn(menuEngine, 'initMobileLayout');
      menuEngine.initMobileMenuBehavior();

      expect(spy).toHaveBeenCalled();
    });

    it('should add resize event listener', () => {
      menuEngine.initMobileMenuBehavior();

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('initMobileButtonHandlers', () => {
    let mockMobileButton;
    let mockDesktopButton;

    beforeEach(() => {
      mockMobileButton = {
        addEventListener: vi.fn(),
      };

      mockDesktopButton = {
        click: vi.fn(),
      };

      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id.startsWith('mobile-')) return mockMobileButton;
        if (id.startsWith('navbar-button-')) return mockDesktopButton;
        return null;
      });
    });

    it('should add click listeners to mobile buttons', () => {
      menuEngine.initMobileButtonHandlers();

      expect(mockMobileButton.addEventListener).toHaveBeenCalled();
    });

    it('should trigger desktop button click when mobile button is clicked', () => {
      menuEngine.initMobileButtonHandlers();

      // Get the click handler for the first button mapping
      const clickHandler = mockMobileButton.addEventListener.mock.calls[0]?.[1];
      if (clickHandler) {
        const mockEvent = {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        };

        clickHandler(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(mockDesktopButton.click).toHaveBeenCalled();
      }
    });

    it('should handle missing mobile button gracefully', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);

      expect(() => menuEngine.initMobileButtonHandlers()).not.toThrow();
    });

    it('should handle missing desktop button gracefully', () => {
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id.startsWith('mobile-')) return mockMobileButton;
        return null;
      });

      expect(() => menuEngine.initMobileButtonHandlers()).not.toThrow();
    });
  });

  describe('initMobileLayout', () => {
    it('should add left-column-hidden class on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });

      menuEngine.initMobileLayout();

      expect(mockBody.classList.add).toHaveBeenCalledWith('left-column-hidden');
    });

    it('should not add class on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });

      menuEngine.initMobileLayout();

      expect(mockBody.classList.add).not.toHaveBeenCalled();
    });

    it('should use 768px as mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true });
      menuEngine.initMobileLayout();
      expect(mockBody.classList.add).toHaveBeenCalledWith('left-column-hidden');

      mockBody.classList.add.mockClear();
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
      const engine2 = new MenuEngine();
      engine2.initMobileLayout();
      expect(mockBody.classList.add).not.toHaveBeenCalled();
    });
  });

  describe('handleResponsiveLayout', () => {
    beforeEach(() => {
      mockBody.classList.add.mockClear();
      delete menuEngine._wasResizedToMobile;
    });

    it('should add left-column-hidden on first resize to mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });

      menuEngine.handleResponsiveLayout();

      expect(mockBody.classList.add).toHaveBeenCalledWith('left-column-hidden');
      expect(menuEngine._wasResizedToMobile).toBe(true);
    });

    it('should not add class again if already resized to mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });

      menuEngine.handleResponsiveLayout();
      mockBody.classList.add.mockClear();

      menuEngine.handleResponsiveLayout();

      expect(mockBody.classList.add).not.toHaveBeenCalled();
    });

    it('should reset flag when resizing to desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });
      menuEngine.handleResponsiveLayout();

      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      menuEngine.handleResponsiveLayout();

      expect(menuEngine._wasResizedToMobile).toBe(false);
    });
  });

  describe('closeMenusEvent', () => {
    let mockTitleButton;
    let mockTitleDots;
    let mockMenuElements;

    beforeEach(() => {
      mockTitleButton = { className: 'title-menu-button' };
      mockTitleDots = { className: 'dots-menu-vertical-icon' };

      mockMenuElements = [
        {
          contains: vi.fn(() => false),
          click: vi.fn(),
          classList: {
            contains: vi.fn(() => false),
          },
        },
      ];

      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '.title-menu-button') return mockTitleButton;
        if (selector === '.title-menu-button .dots-menu-vertical-icon') return mockTitleDots;
        if (selector === 'body#main') return mockBody;
        if (selector === '#main #head') return mockHead;
        if (selector === '#main #workarea') return mockWorkarea;
        if (selector === '#main #workarea #menu_nav') return mockMenuNav;
        if (selector === '#main #workarea #menu_idevices') return mockMenuIdevices;
        return null;
      });

      vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
        if (selector === '[data-bs-toggle="dropdown"].show') return mockMenuElements;
        if (selector === '#main #workarea .menu') return mockMenus;
        return [];
      });
    });

    it('should query title project button', () => {
      menuEngine.closeMenusEvent();

      expect(document.querySelector).toHaveBeenCalledWith('.title-menu-button');
    });

    it('should query title button dots', () => {
      menuEngine.closeMenusEvent();

      expect(document.querySelector).toHaveBeenCalledWith('.title-menu-button .dots-menu-vertical-icon');
    });

    it('should add event listeners for multiple events', () => {
      menuEngine.closeMenusEvent();

      const expectedEvents = [
        'click', 'dragstart', 'drag', 'dragend',
        'dragenter', 'dragover', 'dragleave', 'drop'
      ];

      expectedEvents.forEach((event) => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          false
        );
      });
    });

    it('should close open menus when clicking outside', () => {
      menuEngine.closeMenusEvent();

      // Get the click event handler
      const clickHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        const mockEvent = {
          target: {
            closest: vi.fn(() => null),
            classList: {
              contains: vi.fn(() => false),
            },
          },
        };

        clickHandler(mockEvent);

        expect(mockMenuElements[0].click).toHaveBeenCalled();
      }
    });

    it('should not close menu if clicking inside menu', () => {
      mockMenuElements[0].contains.mockReturnValue(true);
      menuEngine.closeMenusEvent();

      const clickHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        const mockEvent = {
          target: {
            closest: vi.fn(() => null),
            classList: {
              contains: vi.fn(() => false),
            },
          },
        };

        clickHandler(mockEvent);

        expect(mockMenuElements[0].click).not.toHaveBeenCalled();
      }
    });

    it('should not close menu if clicking on dropdown-toggle', () => {
      menuEngine.closeMenusEvent();

      const clickHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        const mockEvent = {
          target: {
            closest: vi.fn((selector) => (selector === '.dropdown-toggle' ? {} : null)),
            classList: {
              contains: vi.fn((className) => className === 'dropdown-toggle'),
            },
          },
        };

        clickHandler(mockEvent);

        expect(mockMenuElements[0].click).not.toHaveBeenCalled();
      }
    });
  });

  describe('integration', () => {
    it('should initialize all behaviors on behaviour call', () => {
      const closeMenusSpy = vi.spyOn(menuEngine, 'closeMenusEvent');
      const mobileSpy = vi.spyOn(menuEngine, 'initMobileMenuBehavior');

      menuEngine.behaviour();

      expect(closeMenusSpy).toHaveBeenCalled();
      expect(mobileSpy).toHaveBeenCalled();
    });

    it('should handle mobile and desktop layout transitions', () => {
      mockBody.classList.add.mockClear();

      // Test mobile layout
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });
      menuEngine.initMobileLayout();
      expect(mockBody.classList.add).toHaveBeenCalledWith('left-column-hidden');

      // Test desktop layout (using existing instance)
      mockBody.classList.add.mockClear();
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
      menuEngine.initMobileLayout();
      expect(mockBody.classList.add).not.toHaveBeenCalled();
    });
  });
});
