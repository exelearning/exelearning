import OdeTitleMenu from './odeTitleElement.js';

describe('OdeTitleMenu', () => {
  let odeTitleMenu;
  let mockTitleElement;
  let mockButtonElement;
  let mockContainerElement;
  let mockMutationObserver;
  let mockResizeObserver;
  let mockMetadata;
  let mockDoc;
  let mockDocumentManager;
  let mockBridge;

  beforeEach(() => {
    // Mock DOM elements
    mockTitleElement = {
      textContent: 'Initial Title',
      click: vi.fn(),
      focus: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      },
      scrollTop: 0,
      scrollHeight: 100,
      childNodes: [],
      firstChild: null,
    };

    mockButtonElement = {
      addEventListener: vi.fn(),
    };

    mockContainerElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      },
    };

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#exe-title > .exe-title.content') return mockTitleElement;
      if (selector === '.title-menu-button') return mockButtonElement;
      if (selector === '#exe-title') return mockContainerElement;
      return null;
    });

    // Mock MutationObserver
    mockMutationObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    global.MutationObserver = vi.fn().mockImplementation(function() {
      return mockMutationObserver;
    });

    // Mock ResizeObserver
    mockResizeObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    global.ResizeObserver = vi.fn().mockImplementation(function() {
      return mockResizeObserver;
    });

    // Mock Yjs structures
    mockMetadata = {
      get: vi.fn(),
      set: vi.fn(),
      observe: vi.fn(),
    };
    mockDoc = {
      transact: vi.fn((cb) => cb()),
      clientID: 123,
    };
    mockDocumentManager = {
      getMetadata: vi.fn(() => mockMetadata),
      getDoc: vi.fn(() => mockDoc),
    };
    mockBridge = {
      getDocumentManager: vi.fn(() => mockDocumentManager),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: {
          _yjsBridge: mockBridge,
          checkOpenIdevice: vi.fn(() => false),
        },
        common: {
          initTooltips: vi.fn(),
        },
      },
    };

    // Mock Range and Selection
    global.document.createRange = vi.fn(() => ({
      selectNodeContents: vi.fn(),
      collapse: vi.fn(),
      getClientRects: vi.fn(() => []),
      setStart: vi.fn(),
      insertNode: vi.fn(),
      setStartAfter: vi.fn(),
      deleteContents: vi.fn(),
    }));

    window.getSelection = vi.fn(() => ({
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      rangeCount: 0,
      getRangeAt: vi.fn(),
    }));

    odeTitleMenu = new OdeTitleMenu();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should initialize elements and MutationObserver', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#exe-title > .exe-title.content');
      expect(document.querySelector).toHaveBeenCalledWith('.title-menu-button');
      expect(document.querySelector).toHaveBeenCalledWith('#exe-title');
      expect(global.MutationObserver).toHaveBeenCalled();
      expect(mockMutationObserver.observe).toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('should initialize title, Yjs binding and ResizeObserver', () => {
      const setTitleSpy = vi.spyOn(odeTitleMenu, 'setTitle');
      const setChangeTitleSpy = vi.spyOn(odeTitleMenu, 'setChangeTitle');
      const checkTitleLineCountSpy = vi.spyOn(odeTitleMenu, 'checkTitleLineCount');
      const initYjsBindingSpy = vi.spyOn(odeTitleMenu, 'initYjsBinding');

      odeTitleMenu.init();

      expect(setTitleSpy).toHaveBeenCalled();
      expect(setChangeTitleSpy).toHaveBeenCalled();
      expect(checkTitleLineCountSpy).toHaveBeenCalled();
      expect(initYjsBindingSpy).toHaveBeenCalled();
      expect(global.ResizeObserver).toHaveBeenCalled();
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(mockTitleElement);
    });
  });

  describe('setTitle', () => {
    it('should set title from Yjs if available', () => {
      mockMetadata.get.mockReturnValue('Yjs Title');
      odeTitleMenu.setTitle();
      expect(mockTitleElement.textContent).toBe('Yjs Title');
    });

    it('should set default title if Yjs title not available', () => {
      mockMetadata.get.mockReturnValue(null);
      odeTitleMenu.setTitle();
      expect(mockTitleElement.textContent).toBe('Untitled document');
    });
  });

  describe('initYjsBinding', () => {
    it('should load initial title and observe changes', () => {
      mockMetadata.get.mockReturnValue('Initial Yjs Title');
      odeTitleMenu.initYjsBinding();

      expect(mockTitleElement.textContent).toBe('Initial Yjs Title');
      expect(mockMetadata.observe).toHaveBeenCalled();
    });

    it('should handle remote title changes', () => {
      odeTitleMenu.initYjsBinding();
      const observerCallback = mockMetadata.observe.mock.calls[0][0];

      mockMetadata.get.mockReturnValue('New Remote Title');
      observerCallback({
        transaction: { origin: 'remote' },
        changes: { keys: new Map([['title', { action: 'update' }]]) },
      });

      expect(mockTitleElement.textContent).toBe('New Remote Title');
    });

    it('should ignore local title changes', () => {
      odeTitleMenu.initYjsBinding();
      const observerCallback = mockMetadata.observe.mock.calls[0][0];

      mockTitleElement.textContent = 'My Local Change';
      observerCallback({
        transaction: { origin: 'user' },
        changes: { keys: new Map([['title', { action: 'update' }]]) },
      });

      expect(mockTitleElement.textContent).toBe('My Local Change');
    });
  });

  describe('setChangeTitle', () => {
    it('should add click listener to title button', () => {
      odeTitleMenu.setChangeTitle();
      expect(mockButtonElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should enter editing mode on title click', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();
      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];

      clickHandler();

      expect(mockTitleElement.setAttribute).toHaveBeenCalledWith('contenteditable', 'true');
      expect(mockContainerElement.classList.add).toHaveBeenCalledWith('title-editing');
      
      vi.runAllTimers();
      expect(mockTitleElement.focus).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should prevent editing if an idevice is open', () => {
      window.eXeLearning.app.project.checkOpenIdevice.mockReturnValue(true);
      odeTitleMenu.setChangeTitle();
      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];

      clickHandler();

      expect(mockTitleElement.setAttribute).not.toHaveBeenCalledWith('contenteditable', 'true');
    });

    it('should finish editing on Enter key', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();
      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
      clickHandler();
      vi.runAllTimers();

      const keydownHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'keydown')[1];

      const preventDefault = vi.fn();
      keydownHandler({ key: 'Enter', preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(mockTitleElement.removeAttribute).toHaveBeenCalledWith('contenteditable');
      vi.useRealTimers();
    });

    it('should save to Yjs on input with debounce', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();
      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
      clickHandler();

      const inputHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
      mockTitleElement.textContent = 'New Title Typing';
      inputHandler();

      expect(mockMetadata.set).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(mockMetadata.set).toHaveBeenCalledWith('title', 'New Title Typing');
      vi.useRealTimers();
    });
  });

  describe('saveTitle', () => {
    it('should save title to Yjs', async () => {
      const result = await odeTitleMenu.saveTitle('Manually Saved Title');
      expect(result.responseMessage).toBe('OK');
      expect(mockMetadata.set).toHaveBeenCalledWith('title', 'Manually Saved Title');
    });

    it('should return error if Yjs not available', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      const result = await odeTitleMenu.saveTitle('Title');
      expect(result.responseMessage).toBe('ERROR');
    });
  });

  describe('checkTitleLineCount', () => {
    it('should set one-line class if no content', () => {
      mockTitleElement.firstChild = null;
      odeTitleMenu.checkTitleLineCount();
      expect(mockContainerElement.classList.add).toHaveBeenCalledWith('one-line');
    });

    it('should set two-lines class if content spans multiple lines', () => {
      mockTitleElement.firstChild = {};
      const mockRange = {
        selectNodeContents: vi.fn(),
        getClientRects: vi.fn(() => [{}, {}]), // 2 rects = 2 lines
      };
      document.createRange.mockReturnValue(mockRange);

      odeTitleMenu.checkTitleLineCount();

      expect(mockContainerElement.classList.add).toHaveBeenCalledWith('two-lines');
    });
  });
});
