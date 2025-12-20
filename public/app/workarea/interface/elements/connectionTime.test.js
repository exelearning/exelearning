import ConnectionTime from './connectionTime.js';

describe('ConnectionTime', () => {
  let connectionTime;
  let mockWrapper;
  let mockContent;
  let mockSaveButton;
  let mockApp;

  beforeEach(() => {
    // Mock DOM
    mockWrapper = document.createElement('div');
    mockWrapper.id = 'exe-last-edition';
    mockContent = document.createElement('div');
    mockContent.className = 'content';
    mockWrapper.appendChild(mockContent);
    document.body.appendChild(mockWrapper);

    mockSaveButton = document.createElement('button');
    mockSaveButton.id = 'head-top-save-button';
    document.body.appendChild(mockSaveButton);

    vi.spyOn(document, 'querySelector').mockImplementation(selector => {
      if (selector === '#exe-last-edition') return mockWrapper;
      if (selector === '#exe-last-edition .content') return mockContent;
      if (selector === '#head-top-save-button') return mockSaveButton;
      return null;
    });

    // Mock eXeLearning
    mockApp = {
      project: {
        odeId: 'test-ode-1',
        offlineInstallation: false,
      },
      api: {
        getOdeLastUpdated: vi.fn(),
      },
      user: {
        preferences: {
          preferences: {
            versionControl: { value: 'true' }
          }
        }
      }
    };

    window.eXeLearning = {
      app: mockApp,
      config: {
        clientIntervalGetLastEdition: 60000,
      },
    };

    // jQuery mock (minimal as provided by setup or manually)
    window.$ = vi.fn(el => {
      const element = typeof el === 'string' ? document.querySelector(el) : el;
      const obj = {
        attr: vi.fn(() => obj),
        removeClass: vi.fn(cls => {
          if (element && element.classList) element.classList.remove(cls);
          return obj;
        }),
        addClass: vi.fn(cls => {
          if (element && element.classList) element.classList.add(cls);
          return obj;
        }),
        tooltip: vi.fn(() => obj),
        0: element,
        length: element ? 1 : 0,
      };
      return obj;
    });

    connectionTime = new ConnectionTime();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with elements', () => {
      expect(connectionTime.connTimeElementWrapper).toBe(mockWrapper);
      expect(connectionTime.connTimeElement).toBe(mockContent);
      expect(connectionTime.intervalTime).toBe(60000);
    });
  });

  describe('loadLastUpdated', () => {
    it('should call api and store result', async () => {
      const mockResponse = { lastUpdatedDate: 123456789 };
      mockApp.api.getOdeLastUpdated.mockResolvedValue(mockResponse);

      await connectionTime.loadLastUpdated();

      expect(mockApp.api.getOdeLastUpdated).toHaveBeenCalledWith('test-ode-1');
      expect(connectionTime.lastUpdatedDate).toBe(123456789);
    });
  });

  describe('setLastUpdatedToElement', () => {
    it('should set text for recent save', () => {
      const now = Math.floor(new Date().getTime() / 1000);
      connectionTime.lastUpdatedDate = now - 30; // 30 seconds ago
      
      connectionTime.setLastUpdatedToElement();
      
      expect(mockContent.innerHTML).toContain('Saved a few seconds ago');
      expect(mockWrapper.className).toBe('saved');
    });

    it('should set text for minutes ago', () => {
      const now = Math.floor(new Date().getTime() / 1000);
      connectionTime.lastUpdatedDate = now - 120; // 2 minutes ago
      
      connectionTime.setLastUpdatedToElement();
      
      expect(mockContent.innerHTML).toContain('Saved 2 minutes ago');
    });

    it('should show unsaved if no lastUpdatedDate', () => {
      connectionTime.lastUpdatedDate = null;
      
      connectionTime.setLastUpdatedToElement();
      
      expect(mockContent.innerHTML).toContain('Unsaved project');
      expect(mockWrapper.className).toBe('unsaved');
      expect(mockSaveButton.classList.contains('unsaved')).toBe(true);
    });

    it('should show no-versions if offline and version control disabled', () => {
      connectionTime.lastUpdatedDate = null;
      mockApp.project.offlineInstallation = true;
      mockApp.user.preferences.preferences.versionControl.value = 'false';
      
      connectionTime.setLastUpdatedToElement();
      
      expect(mockContent.innerHTML).toContain('No previous versions');
      expect(mockWrapper.className).toBe('no-versions');
    });
  });

  describe('makeStringTimeDiff', () => {
    it('should format days', () => {
      expect(connectionTime.makeStringTimeDiff(1, 0, 0)).toBe('Saved one day ago');
      expect(connectionTime.makeStringTimeDiff(5, 0, 0)).toBe('Saved 5 days ago');
    });

    it('should format hours', () => {
      expect(connectionTime.makeStringTimeDiff(0, 1, 0)).toBe('Saved an hours ago');
      expect(connectionTime.makeStringTimeDiff(0, 3, 0)).toBe('Saved 3 hours ago');
    });

    it('should format minutes', () => {
      expect(connectionTime.makeStringTimeDiff(0, 0, 10)).toBe('Saved 10 minutes ago');
    });
  });
});
