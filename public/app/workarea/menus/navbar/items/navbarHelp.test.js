import NavbarHelp from './navbarHelp.js';

describe('NavbarHelp', () => {
  let navbarHelp;
  let mockMenu;
  let mockNavbar;
  let mockButtons;

  beforeEach(() => {
    // Mock window.open
    window.open = vi.fn(() => ({ focus: vi.fn() }));

    // Mock eXeLearning modals
    window.eXeLearning = {
      app: {
        modals: {
          assistant: {
            show: vi.fn(),
          },
          releasenotes: {
            show: vi.fn(),
          },
          legalnotes: {
            show: vi.fn(),
          },
          about: {
            show: vi.fn(),
          },
        },
      },
    };

    // Mock buttons
    mockButtons = {
      assistant: { addEventListener: vi.fn() },
      tutorial: { addEventListener: vi.fn() },
      apiDocs: { addEventListener: vi.fn() },
      releaseNotes: { addEventListener: vi.fn() },
      legalNotes: { addEventListener: vi.fn() },
      exeWeb: { addEventListener: vi.fn() },
      reportBug: { addEventListener: vi.fn() },
      about: { addEventListener: vi.fn() },
    };

    // Mock navbar element with querySelector
    mockNavbar = {
      querySelector: vi.fn((selector) => {
        if (selector === '#dropdownHelp') return { id: 'dropdownHelp' };
        if (selector === '#navbar-button-assistant') return mockButtons.assistant;
        if (selector === '#navbar-button-exe-tutorial') return mockButtons.tutorial;
        if (selector === '#navbar-button-api-docs') return mockButtons.apiDocs;
        if (selector === '#navbar-button-release-notes') return mockButtons.releaseNotes;
        if (selector === '#navbar-button-legal-notes') return mockButtons.legalNotes;
        if (selector === '#navbar-button-exe-web') return mockButtons.exeWeb;
        if (selector === '#navbar-button-report-bug') return mockButtons.reportBug;
        if (selector === '#navbar-button-about-exe') return mockButtons.about;
        return null;
      }),
    };

    mockMenu = {
      navbar: mockNavbar,
    };

    navbarHelp = new NavbarHelp(mockMenu);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should store menu reference', () => {
      expect(navbarHelp.menu).toBe(mockMenu);
    });

    it('should query help button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#dropdownHelp');
    });

    it('should query assistant button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-assistant');
    });

    it('should query tutorial button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-exe-tutorial');
    });

    it('should query API docs button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-api-docs');
    });

    it('should query release notes button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-release-notes');
    });

    it('should query legal notes button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-legal-notes');
    });

    it('should query eXe web button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-exe-web');
    });

    it('should query report bug button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-report-bug');
    });

    it('should query about button', () => {
      expect(mockNavbar.querySelector).toHaveBeenCalledWith('#navbar-button-about-exe');
    });

    it('should store button references', () => {
      expect(navbarHelp.assistantButton).toBe(mockButtons.assistant);
      expect(navbarHelp.tutorialButton).toBe(mockButtons.tutorial);
      expect(navbarHelp.apiDocsButton).toBe(mockButtons.apiDocs);
      expect(navbarHelp.releaseNotesButton).toBe(mockButtons.releaseNotes);
      expect(navbarHelp.legalNotesButton).toBe(mockButtons.legalNotes);
      expect(navbarHelp.exeWebButton).toBe(mockButtons.exeWeb);
      expect(navbarHelp.reportBugButton).toBe(mockButtons.reportBug);
      expect(navbarHelp.aboutButton).toBe(mockButtons.about);
    });
  });

  describe('setEvents', () => {
    it('should call all set event methods', () => {
      const spies = {
        assistant: vi.spyOn(navbarHelp, 'setAssistantEvent'),
        tutorial: vi.spyOn(navbarHelp, 'setTutorialEvent'),
        apiDocs: vi.spyOn(navbarHelp, 'setApiDocsEvent'),
        releaseNotes: vi.spyOn(navbarHelp, 'setReleaseNotesEvent'),
        legalNotes: vi.spyOn(navbarHelp, 'setLegalNotesEvent'),
        exeWeb: vi.spyOn(navbarHelp, 'setExeWebEvent'),
        reportBug: vi.spyOn(navbarHelp, 'setReportBugEvent'),
        about: vi.spyOn(navbarHelp, 'setAboutExeEvent'),
      };

      navbarHelp.setEvents();

      Object.values(spies).forEach((spy) => {
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe('setAssistantEvent', () => {
    it('should add click event listener to assistant button', () => {
      navbarHelp.setAssistantEvent();

      expect(mockButtons.assistant.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call assistantEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'assistantEvent');
      navbarHelp.setAssistantEvent();

      const clickHandler = mockButtons.assistant.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setTutorialEvent', () => {
    it('should add click event listener to tutorial button', () => {
      navbarHelp.setTutorialEvent();

      expect(mockButtons.tutorial.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call tutorialEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'tutorialEvent');
      navbarHelp.setTutorialEvent();

      const clickHandler = mockButtons.tutorial.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setApiDocsEvent', () => {
    it('should add click event listener to API docs button', () => {
      navbarHelp.setApiDocsEvent();

      expect(mockButtons.apiDocs.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call apiDocsEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'apiDocsEvent');
      navbarHelp.setApiDocsEvent();

      const clickHandler = mockButtons.apiDocs.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setReleaseNotesEvent', () => {
    it('should add click event listener to release notes button', () => {
      navbarHelp.setReleaseNotesEvent();

      expect(mockButtons.releaseNotes.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call releaseNotesEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'releaseNotesEvent');
      navbarHelp.setReleaseNotesEvent();

      const clickHandler = mockButtons.releaseNotes.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setLegalNotesEvent', () => {
    it('should add click event listener to legal notes button', () => {
      navbarHelp.setLegalNotesEvent();

      expect(mockButtons.legalNotes.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call legalNotesEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'legalNotesEvent');
      navbarHelp.setLegalNotesEvent();

      const clickHandler = mockButtons.legalNotes.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setExeWebEvent', () => {
    it('should add click event listener to eXe web button', () => {
      navbarHelp.setExeWebEvent();

      expect(mockButtons.exeWeb.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call eXeWebEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'eXeWebEvent');
      navbarHelp.setExeWebEvent();

      const clickHandler = mockButtons.exeWeb.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setReportBugEvent', () => {
    it('should add click event listener to report bug button', () => {
      navbarHelp.setReportBugEvent();

      expect(mockButtons.reportBug.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call reportBugEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'reportBugEvent');
      navbarHelp.setReportBugEvent();

      const clickHandler = mockButtons.reportBug.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setAboutExeEvent', () => {
    it('should add click event listener to about button', () => {
      navbarHelp.setAboutExeEvent();

      expect(mockButtons.about.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call aboutExeEvent when button is clicked', () => {
      const spy = vi.spyOn(navbarHelp, 'aboutExeEvent');
      navbarHelp.setAboutExeEvent();

      const clickHandler = mockButtons.about.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('assistantEvent', () => {
    it('should show assistant modal', () => {
      navbarHelp.assistantEvent();

      expect(window.eXeLearning.app.modals.assistant.show).toHaveBeenCalled();
    });
  });

  describe('tutorialEvent', () => {
    it('should open tutorial URL in new tab', () => {
      navbarHelp.tutorialEvent();

      expect(window.open).toHaveBeenCalledWith('https://exelearning.net/ayuda/', '_blank');
    });

    it('should focus the new tab', () => {
      const mockFocus = vi.fn();
      window.open = vi.fn(() => ({ focus: mockFocus }));

      navbarHelp.tutorialEvent();

      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('apiDocsEvent', () => {
    it('should open API docs URL in new tab', () => {
      navbarHelp.apiDocsEvent();

      expect(window.open).toHaveBeenCalledWith('/api/docs', '_blank');
    });

    it('should focus the new tab', () => {
      const mockFocus = vi.fn();
      window.open = vi.fn(() => ({ focus: mockFocus }));

      navbarHelp.apiDocsEvent();

      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('releaseNotesEvent', () => {
    it('should show release notes modal', () => {
      navbarHelp.releaseNotesEvent();

      expect(window.eXeLearning.app.modals.releasenotes.show).toHaveBeenCalled();
    });
  });

  describe('legalNotesEvent', () => {
    it('should show legal notes modal', () => {
      navbarHelp.legalNotesEvent();

      expect(window.eXeLearning.app.modals.legalnotes.show).toHaveBeenCalled();
    });
  });

  describe('eXeWebEvent', () => {
    it('should open eXeLearning website in new tab', () => {
      navbarHelp.eXeWebEvent();

      expect(window.open).toHaveBeenCalledWith('https://exelearning.net/', '_blank');
    });

    it('should focus the new tab', () => {
      const mockFocus = vi.fn();
      window.open = vi.fn(() => ({ focus: mockFocus }));

      navbarHelp.eXeWebEvent();

      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('reportBugEvent', () => {
    it('should open GitHub issues page in new tab', () => {
      navbarHelp.reportBugEvent();

      expect(window.open).toHaveBeenCalledWith('https://github.com/exelearning/exelearning/issues', '_blank');
    });

    it('should focus the new tab', () => {
      const mockFocus = vi.fn();
      window.open = vi.fn(() => ({ focus: mockFocus }));

      navbarHelp.reportBugEvent();

      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('aboutExeEvent', () => {
    it('should show about modal', () => {
      navbarHelp.aboutExeEvent();

      expect(window.eXeLearning.app.modals.about.show).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should setup all event listeners on setEvents call', () => {
      navbarHelp.setEvents();

      expect(mockButtons.assistant.addEventListener).toHaveBeenCalled();
      expect(mockButtons.tutorial.addEventListener).toHaveBeenCalled();
      expect(mockButtons.apiDocs.addEventListener).toHaveBeenCalled();
      expect(mockButtons.releaseNotes.addEventListener).toHaveBeenCalled();
      expect(mockButtons.legalNotes.addEventListener).toHaveBeenCalled();
      expect(mockButtons.exeWeb.addEventListener).toHaveBeenCalled();
      expect(mockButtons.reportBug.addEventListener).toHaveBeenCalled();
      expect(mockButtons.about.addEventListener).toHaveBeenCalled();
    });

    it('should show modals when respective buttons clicked', () => {
      navbarHelp.setEvents();

      // Click assistant button
      const assistantHandler = mockButtons.assistant.addEventListener.mock.calls[0][1];
      assistantHandler();
      expect(window.eXeLearning.app.modals.assistant.show).toHaveBeenCalled();

      // Click release notes button
      const releaseNotesHandler = mockButtons.releaseNotes.addEventListener.mock.calls[0][1];
      releaseNotesHandler();
      expect(window.eXeLearning.app.modals.releasenotes.show).toHaveBeenCalled();

      // Click legal notes button
      const legalNotesHandler = mockButtons.legalNotes.addEventListener.mock.calls[0][1];
      legalNotesHandler();
      expect(window.eXeLearning.app.modals.legalnotes.show).toHaveBeenCalled();

      // Click about button
      const aboutHandler = mockButtons.about.addEventListener.mock.calls[0][1];
      aboutHandler();
      expect(window.eXeLearning.app.modals.about.show).toHaveBeenCalled();
    });

    it('should open URLs in new tabs when respective buttons clicked', () => {
      navbarHelp.setEvents();

      // Click tutorial button
      const tutorialHandler = mockButtons.tutorial.addEventListener.mock.calls[0][1];
      tutorialHandler();
      expect(window.open).toHaveBeenCalledWith('https://exelearning.net/ayuda/', '_blank');

      // Click eXe web button
      const exeWebHandler = mockButtons.exeWeb.addEventListener.mock.calls[0][1];
      exeWebHandler();
      expect(window.open).toHaveBeenCalledWith('https://exelearning.net/', '_blank');

      // Click report bug button
      const reportBugHandler = mockButtons.reportBug.addEventListener.mock.calls[0][1];
      reportBugHandler();
      expect(window.open).toHaveBeenCalledWith('https://github.com/exelearning/exelearning/issues', '_blank');
    });
  });
});
