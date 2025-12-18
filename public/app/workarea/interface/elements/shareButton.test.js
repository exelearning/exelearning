import ShareProjectButton from './shareButton.js';

describe('ShareProjectButton', () => {
  let shareButton;
  let mockButton;
  let mockVisibilityIcon;
  let mockCheckOpenIdevice;
  let mockShareModal;

  beforeEach(() => {
    // Mock DOM elements
    mockVisibilityIcon = {
      textContent: '',
    };

    mockButton = {
      addEventListener: vi.fn(),
      querySelector: vi.fn((selector) => {
        if (selector === '.share-visibility-icon') return mockVisibilityIcon;
        return null;
      }),
    };

    vi.spyOn(document, 'querySelector').mockReturnValue(mockButton);

    // Mock eXeLearning global
    mockCheckOpenIdevice = vi.fn(() => false);
    mockShareModal = {
      show: vi.fn(),
    };

    window.eXeLearning = {
      app: {
        project: {
          checkOpenIdevice: mockCheckOpenIdevice,
          odeId: 'test-project-id',
          requestedProjectId: null,
        },
        modals: {
          share: mockShareModal,
        },
        api: {
          getProject: vi.fn().mockResolvedValue({
            responseMessage: 'OK',
            project: { visibility: 'private' },
          }),
        },
        params: {
          defaultProjectVisibility: 'private',
        },
      },
    };

    // Mock window.location
    delete window.location;
    window.location = {
      href: 'http://localhost:8080/workarea?project=test-id',
      origin: 'http://localhost:8080',
    };

    shareButton = new ShareProjectButton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should query the share button element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#head-top-share-button');
    });

    it('should store the button element reference', () => {
      expect(shareButton.shareButton).toBe(mockButton);
    });

    it('should query visibility icon', () => {
      expect(mockButton.querySelector).toHaveBeenCalledWith('.share-visibility-icon');
      expect(shareButton.visibilityIcon).toBe(mockVisibilityIcon);
    });

    it('should initialize currentVisibility to private', () => {
      expect(shareButton.currentVisibility).toBe('private');
    });
  });

  describe('init', () => {
    it('should call addEventClick', () => {
      const spy = vi.spyOn(shareButton, 'addEventClick');
      shareButton.init();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClick', () => {
    it('should add click event listener to button', () => {
      shareButton.addEventClick();
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should return early if button is null', () => {
      shareButton.shareButton = null;
      expect(() => shareButton.addEventClick()).not.toThrow();
    });

    it('should return early if idevice is open', async () => {
      mockCheckOpenIdevice.mockReturnValue(true);
      shareButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockCheckOpenIdevice).toHaveBeenCalled();
      expect(mockShareModal.show).not.toHaveBeenCalled();
    });

    it('should call openShareModal when clicked and no idevice is open', async () => {
      const spy = vi.spyOn(shareButton, 'openShareModal');
      shareButton.addEventClick();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('openShareModal', () => {
    it('should call share modal show method', () => {
      shareButton.openShareModal();
      expect(mockShareModal.show).toHaveBeenCalled();
    });

    it('should log error if share modal not available', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      window.eXeLearning.app.modals.share = null;

      shareButton.openShareModal();

      expect(consoleErrorSpy).toHaveBeenCalledWith('ShareProjectButton: Share modal not available');
      consoleErrorSpy.mockRestore();
    });

    it('should log error if modals object not available', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      window.eXeLearning.app.modals = null;

      shareButton.openShareModal();

      expect(consoleErrorSpy).toHaveBeenCalledWith('ShareProjectButton: Share modal not available');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateVisibilityPill', () => {
    it('should update currentVisibility property', () => {
      shareButton.updateVisibilityPill('public');
      expect(shareButton.currentVisibility).toBe('public');
    });

    it('should set public icon when visibility is public', () => {
      shareButton.updateVisibilityPill('public');
      expect(mockVisibilityIcon.textContent).toBe('public');
    });

    it('should set lock icon when visibility is private', () => {
      shareButton.updateVisibilityPill('private');
      expect(mockVisibilityIcon.textContent).toBe('lock');
    });

    it('should return early if visibilityIcon is null', () => {
      shareButton.visibilityIcon = null;
      expect(() => shareButton.updateVisibilityPill('public')).not.toThrow();
    });
  });

  describe('loadVisibilityFromProject', () => {
    it('should call getProject API with project ID', async () => {
      await shareButton.loadVisibilityFromProject();
      expect(window.eXeLearning.app.api.getProject).toHaveBeenCalledWith('test-project-id');
    });

    it('should update visibility pill with API response', async () => {
      const spy = vi.spyOn(shareButton, 'updateVisibilityPill');
      window.eXeLearning.app.api.getProject.mockResolvedValue({
        responseMessage: 'OK',
        project: { visibility: 'public' },
      });

      await shareButton.loadVisibilityFromProject();

      expect(spy).toHaveBeenCalledWith('public');
    });

    it('should use default visibility if no project ID', async () => {
      const spy = vi.spyOn(shareButton, 'updateVisibilityPill');
      window.eXeLearning.app.project.odeId = null;

      await shareButton.loadVisibilityFromProject();

      expect(spy).toHaveBeenCalledWith('private');
      expect(window.eXeLearning.app.api.getProject).not.toHaveBeenCalled();
    });

    it('should use default visibility from params if available', async () => {
      const spy = vi.spyOn(shareButton, 'updateVisibilityPill');
      window.eXeLearning.app.project.odeId = null;
      window.eXeLearning.app.params.defaultProjectVisibility = 'public';

      await shareButton.loadVisibilityFromProject();

      expect(spy).toHaveBeenCalledWith('public');
    });

    it('should handle API errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new Error('Network error');
      window.eXeLearning.app.api.getProject.mockRejectedValue(error);

      await shareButton.loadVisibilityFromProject();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[ShareButton] Could not load project visibility:', error);
      consoleWarnSpy.mockRestore();
    });

    it('should not update if response message is not OK', async () => {
      const spy = vi.spyOn(shareButton, 'updateVisibilityPill');
      window.eXeLearning.app.api.getProject.mockResolvedValue({
        responseMessage: 'ERROR',
        project: { visibility: 'public' },
      });

      await shareButton.loadVisibilityFromProject();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should not update if project visibility is missing', async () => {
      const spy = vi.spyOn(shareButton, 'updateVisibilityPill');
      window.eXeLearning.app.api.getProject.mockResolvedValue({
        responseMessage: 'OK',
        project: {},
      });

      await shareButton.loadVisibilityFromProject();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentDocumentUrl', () => {
    it('should return URL with project query parameter', () => {
      const url = shareButton.getCurrentDocumentUrl();
      expect(url).toContain('project=test-project-id');
    });

    it('should use odeId from project', () => {
      window.eXeLearning.app.project.odeId = 'my-project-id';
      const url = shareButton.getCurrentDocumentUrl();
      expect(url).toContain('project=my-project-id');
    });

    it('should fallback to requestedProjectId if odeId is null', () => {
      window.eXeLearning.app.project.odeId = null;
      window.eXeLearning.app.project.requestedProjectId = 'requested-id';

      const url = shareButton.getCurrentDocumentUrl();
      expect(url).toContain('project=requested-id');
    });

    it('should fallback to URL query param if both odeId and requestedProjectId are null', () => {
      window.eXeLearning.app.project.odeId = null;
      window.eXeLearning.app.project.requestedProjectId = null;
      window.location.href = 'http://localhost:8080/workarea?project=url-id';

      const url = shareButton.getCurrentDocumentUrl();
      expect(url).toContain('project=url-id');
    });

    it('should remove legacy projectId parameter', () => {
      window.location.href = 'http://localhost:8080/workarea?projectId=old-id&project=new-id';
      const url = shareButton.getCurrentDocumentUrl();
      expect(url).not.toContain('projectId');
    });

    it('should remove legacy odeSessionId parameter', () => {
      window.location.href = 'http://localhost:8080/workarea?odeSessionId=session-id&project=new-id';
      const url = shareButton.getCurrentDocumentUrl();
      expect(url).not.toContain('odeSessionId');
    });

    it('should preserve other query parameters', () => {
      window.location.href = 'http://localhost:8080/workarea?foo=bar&project=test-id';
      const url = shareButton.getCurrentDocumentUrl();
      expect(url).toContain('foo=bar');
      expect(url).toContain('project=test-project-id');
    });
  });

  describe('integration', () => {
    it('should set up click handler when initialized', () => {
      shareButton.init();

      expect(mockButton.addEventListener).toHaveBeenCalled();
    });

    it('should open modal when clicked with no idevice open', async () => {
      shareButton.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      await clickHandler(new Event('click'));

      expect(mockShareModal.show).toHaveBeenCalled();
    });

    it('should load and update visibility from API', async () => {
      window.eXeLearning.app.api.getProject.mockResolvedValue({
        responseMessage: 'OK',
        project: { visibility: 'public' },
      });

      await shareButton.loadVisibilityFromProject();

      expect(mockVisibilityIcon.textContent).toBe('public');
      expect(shareButton.currentVisibility).toBe('public');
    });
  });
});
