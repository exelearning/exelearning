import MenuNavbar from './menuNavbar.js';
import NavbarFile from './items/navbarFile.js';
import NavbarUtilities from './items/navbarUtilities.js';
import NavbarStyles from './items/navbarStyles.js';
import NavbarHelp from './items/navbarHelp.js';

// Mock NavbarFile
vi.mock('./items/navbarFile.js', () => {
  return {
    default: vi.fn().mockImplementation(function(navbar) {
      this.navbar = navbar;
      this.setEvents = vi.fn();
    })
  };
});

// Mock NavbarUtilities
vi.mock('./items/navbarUtilities.js', () => {
  return {
    default: vi.fn().mockImplementation(function(navbar) {
      this.navbar = navbar;
      this.setEvents = vi.fn();
    })
  };
});

// Mock NavbarStyles
vi.mock('./items/navbarStyles.js', () => {
  return {
    default: vi.fn().mockImplementation(function(navbar) {
      this.navbar = navbar;
      this.setStyleManagerEvent = vi.fn();
    })
  };
});

// Mock NavbarHelp
vi.mock('./items/navbarHelp.js', () => {
  return {
    default: vi.fn().mockImplementation(function(navbar) {
      this.navbar = navbar;
      this.setEvents = vi.fn();
    })
  };
});

describe('MenuNavbar', () => {
  let menuNavbar;
  let mockNavbarElement;
  let mockLinks;

  beforeEach(() => {
    // Mock links: two JS-driven (href="#") and one real navigation link
    mockLinks = [
      { addEventListener: vi.fn(), getAttribute: vi.fn().mockReturnValue('#') },
      { addEventListener: vi.fn(), getAttribute: vi.fn().mockReturnValue('#') },
      { addEventListener: vi.fn(), getAttribute: vi.fn().mockReturnValue('/admin') },
    ];

    // Mock navbar element
    mockNavbarElement = {
      id: 'eXeLearningNavbar',
      querySelectorAll: vi.fn((selector) => {
        if (selector === 'a') return mockLinks;
        return [];
      }),
    };

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#main #head #eXeLearningNavbar') return mockNavbarElement;
      return null;
    });

    menuNavbar = new MenuNavbar();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should query navbar element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#main #head #eXeLearningNavbar');
    });

    it('should store navbar element reference', () => {
      expect(menuNavbar.navbar).toBe(mockNavbarElement);
    });
  });

  describe('load', () => {
    it('should call disableLinks', () => {
      const spy = vi.spyOn(menuNavbar, 'disableLinks');
      menuNavbar.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call loadJsNavbarClasses', () => {
      const spy = vi.spyOn(menuNavbar, 'loadJsNavbarClasses');
      menuNavbar.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call addNavbarEvents', () => {
      const spy = vi.spyOn(menuNavbar, 'addNavbarEvents');
      menuNavbar.load();

      expect(spy).toHaveBeenCalled();
    });

    it('should call methods in correct order', () => {
      const disableSpy = vi.spyOn(menuNavbar, 'disableLinks');
      const loadSpy = vi.spyOn(menuNavbar, 'loadJsNavbarClasses');
      const eventsSpy = vi.spyOn(menuNavbar, 'addNavbarEvents');

      menuNavbar.load();

      expect(disableSpy).toHaveBeenCalledBefore(loadSpy);
      expect(loadSpy).toHaveBeenCalledBefore(eventsSpy);
    });
  });

  describe('disableLinks', () => {
    it('should query all anchor links in navbar', () => {
      menuNavbar.disableLinks();

      expect(mockNavbarElement.querySelectorAll).toHaveBeenCalledWith('a');
    });

    it('should add click event listener only to JS-driven links (href="#")', () => {
      menuNavbar.disableLinks();

      // Links with href="#" get a listener
      expect(mockLinks[0].addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLinks[1].addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      // Link with a real href must NOT get a listener
      expect(mockLinks[2].addEventListener).not.toHaveBeenCalled();
    });

    it('should prevent default on JS-driven link click', () => {
      menuNavbar.disableLinks();

      const clickHandler = mockLinks[0].addEventListener.mock.calls[0][1];
      const mockEvent = { preventDefault: vi.fn() };
      clickHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not prevent default navigation for real-href links', () => {
      menuNavbar.disableLinks();

      // The real-href link (index 2) has no listener attached, so no preventDefault is called
      expect(mockLinks[2].addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('loadJsNavbarClasses', () => {
    it('should create NavbarFile instance', () => {
      menuNavbar.loadJsNavbarClasses();

      expect(NavbarFile).toHaveBeenCalledWith(menuNavbar);
      expect(menuNavbar.file).toBeDefined();
    });

    it('should create NavbarUtilities instance', () => {
      menuNavbar.loadJsNavbarClasses();

      expect(NavbarUtilities).toHaveBeenCalledWith(menuNavbar);
      expect(menuNavbar.utilities).toBeDefined();
    });

    it('should create NavbarStyles instance', () => {
      menuNavbar.loadJsNavbarClasses();

      expect(NavbarStyles).toHaveBeenCalledWith(menuNavbar);
      expect(menuNavbar.styles).toBeDefined();
    });

    it('should create NavbarHelp instance', () => {
      menuNavbar.loadJsNavbarClasses();

      expect(NavbarHelp).toHaveBeenCalledWith(menuNavbar);
      expect(menuNavbar.help).toBeDefined();
    });
  });

  describe('addNavbarEvents', () => {
    beforeEach(() => {
      menuNavbar.loadJsNavbarClasses();
    });

    it('should call setEvents on file', () => {
      menuNavbar.addNavbarEvents();

      expect(menuNavbar.file.setEvents).toHaveBeenCalled();
    });

    it('should call setEvents on utilities', () => {
      menuNavbar.addNavbarEvents();

      expect(menuNavbar.utilities.setEvents).toHaveBeenCalled();
    });

    it('should call setStyleManagerEvent on styles', () => {
      menuNavbar.addNavbarEvents();

      expect(menuNavbar.styles.setStyleManagerEvent).toHaveBeenCalled();
    });

    it('should call setEvents on help', () => {
      menuNavbar.addNavbarEvents();

      expect(menuNavbar.help.setEvents).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should fully initialize navbar on load', () => {
      menuNavbar.load();

      // JS-driven links (href="#") should be disabled
      expect(mockLinks[0].addEventListener).toHaveBeenCalled();
      expect(mockLinks[1].addEventListener).toHaveBeenCalled();
      // Real-href links must remain enabled
      expect(mockLinks[2].addEventListener).not.toHaveBeenCalled();

      // All navbar items should be created
      expect(menuNavbar.file).toBeDefined();
      expect(menuNavbar.utilities).toBeDefined();
      expect(menuNavbar.styles).toBeDefined();
      expect(menuNavbar.help).toBeDefined();

      // All events should be set
      expect(menuNavbar.file.setEvents).toHaveBeenCalled();
      expect(menuNavbar.utilities.setEvents).toHaveBeenCalled();
      expect(menuNavbar.styles.setStyleManagerEvent).toHaveBeenCalled();
      expect(menuNavbar.help.setEvents).toHaveBeenCalled();
    });

    it('should prevent link navigation for JS-driven links after load', () => {
      menuNavbar.load();

      // Simulate clicking a JS-driven link (href="#")
      const clickHandler = mockLinks[0].addEventListener.mock.calls[0][1];
      const mockEvent = { preventDefault: vi.fn() };
      clickHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });
});
