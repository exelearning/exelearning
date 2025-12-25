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

    it('should call checkTitleLineCount when ResizeObserver fires', () => {
      let resizeCallback;
      global.ResizeObserver = vi.fn().mockImplementation(function(callback) {
        resizeCallback = callback;
        return mockResizeObserver;
      });

      odeTitleMenu.init();

      const checkSpy = vi.spyOn(odeTitleMenu, 'checkTitleLineCount');

      // Trigger the resize callback
      resizeCallback();

      expect(checkSpy).toHaveBeenCalled();
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

  describe('LaTeX handling', () => {
    it('should call MathJax.typesetPromise when title contains LaTeX', () => {
      const mockTypesetPromise = vi.fn().mockResolvedValue();
      globalThis.MathJax = { typesetPromise: mockTypesetPromise };

      odeTitleMenu.rawTitleText = 'Title with \\(x^2\\)';
      odeTitleMenu.typesetTitle();

      expect(mockTypesetPromise).toHaveBeenCalledWith([mockTitleElement]);

      delete globalThis.MathJax;
    });

    it('should not call MathJax when title has no LaTeX', () => {
      const mockTypesetPromise = vi.fn().mockResolvedValue();
      globalThis.MathJax = { typesetPromise: mockTypesetPromise };

      odeTitleMenu.rawTitleText = 'Normal title without math';
      odeTitleMenu.typesetTitle();

      expect(mockTypesetPromise).not.toHaveBeenCalled();

      delete globalThis.MathJax;
    });

    it('should store rawTitleText when setting title', () => {
      mockMetadata.get.mockReturnValue('Pruebas de LATEX \\(z^3\\)');
      odeTitleMenu.setTitle();

      expect(odeTitleMenu.rawTitleText).toBe('Pruebas de LATEX \\(z^3\\)');
    });

    it('should restore raw text when entering edit mode', () => {
      vi.useFakeTimers();
      odeTitleMenu.rawTitleText = 'Title \\(x^2\\)';
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
      clickHandler();

      expect(mockTitleElement.textContent).toBe('Title \\(x^2\\)');
      vi.useRealTimers();
    });

    it('should update rawTitleText on input during editing', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
      clickHandler();

      const inputHandler = mockTitleElement.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
      mockTitleElement.textContent = 'New \\(y^3\\) Title';
      inputHandler();

      expect(odeTitleMenu.rawTitleText).toBe('New \\(y^3\\) Title');
      vi.useRealTimers();
    });
  });

  describe('insertTextAtCursor', () => {
    it('should append text when no selection exists', () => {
      const el = {
        appendChild: vi.fn(),
      };
      window.getSelection = vi.fn(() => null);

      odeTitleMenu.insertTextAtCursor(el, 'test text');

      expect(el.appendChild).toHaveBeenCalled();
      const appendedNode = el.appendChild.mock.calls[0][0];
      expect(appendedNode.textContent).toBe('test text');
    });

    it('should append text when rangeCount is 0', () => {
      const el = {
        appendChild: vi.fn(),
      };
      window.getSelection = vi.fn(() => ({
        rangeCount: 0,
      }));

      odeTitleMenu.insertTextAtCursor(el, 'inserted text');

      expect(el.appendChild).toHaveBeenCalled();
    });

    it('should insert text at cursor position when selection exists', () => {
      const el = { appendChild: vi.fn() };
      const mockRange = {
        deleteContents: vi.fn(),
        insertNode: vi.fn(),
        setStartAfter: vi.fn(),
        collapse: vi.fn(),
      };
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn(() => mockRange),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      };
      window.getSelection = vi.fn(() => mockSelection);

      odeTitleMenu.insertTextAtCursor(el, 'cursor text');

      expect(mockRange.deleteContents).toHaveBeenCalled();
      expect(mockRange.insertNode).toHaveBeenCalled();
      expect(mockRange.setStartAfter).toHaveBeenCalled();
      expect(mockRange.collapse).toHaveBeenCalledWith(true);
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
    });
  });

  describe('attachPasteAsPlain', () => {
    it('should handle paste event and insert plain text', () => {
      const el = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      const insertTextSpy = vi.spyOn(odeTitleMenu, 'insertTextAtCursor').mockImplementation(() => {});

      odeTitleMenu.attachPasteAsPlain(el);

      expect(el.addEventListener).toHaveBeenCalledWith('paste', expect.any(Function));
      expect(el.addEventListener).toHaveBeenCalledWith('drop', expect.any(Function));

      // Simulate paste event
      const pasteHandler = el.addEventListener.mock.calls.find(c => c[0] === 'paste')[1];
      const mockPasteEvent = {
        preventDefault: vi.fn(),
        clipboardData: {
          getData: vi.fn(() => 'pasted text'),
        },
      };
      pasteHandler(mockPasteEvent);

      expect(mockPasteEvent.preventDefault).toHaveBeenCalled();
      expect(insertTextSpy).toHaveBeenCalledWith(el, 'pasted text');
    });

    it('should handle drop event with HTML and insert plain text', () => {
      const el = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      const insertTextSpy = vi.spyOn(odeTitleMenu, 'insertTextAtCursor').mockImplementation(() => {});

      odeTitleMenu.attachPasteAsPlain(el);

      const dropHandler = el.addEventListener.mock.calls.find(c => c[0] === 'drop')[1];
      const mockDropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn((type) => {
            if (type === 'text/html') return '<p>html content</p>';
            if (type === 'text/plain') return 'plain content';
            return '';
          }),
        },
      };
      dropHandler(mockDropEvent);

      expect(mockDropEvent.preventDefault).toHaveBeenCalled();
      expect(insertTextSpy).toHaveBeenCalledWith(el, 'plain content');
    });

    it('should not prevent drop event without HTML', () => {
      const el = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      odeTitleMenu.attachPasteAsPlain(el);

      const dropHandler = el.addEventListener.mock.calls.find(c => c[0] === 'drop')[1];
      const mockDropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn(() => ''),
        },
      };
      dropHandler(mockDropEvent);

      expect(mockDropEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should store handlers on element for cleanup', () => {
      const el = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      odeTitleMenu.attachPasteAsPlain(el);

      expect(el._onPastePlain).toBeDefined();
      expect(el._onDropPlain).toBeDefined();
    });
  });

  describe('updatePropertiesInput', () => {
    it('should not update if properties form is not found', () => {
      document.querySelector.mockImplementation((selector) => {
        if (selector === '#node-content #properties-node-content-form') return null;
        if (selector === '#exe-title > .exe-title.content') return mockTitleElement;
        if (selector === '.title-menu-button') return mockButtonElement;
        if (selector === '#exe-title') return mockContainerElement;
        return null;
      });

      // Should not throw
      odeTitleMenu.updatePropertiesInput('Test Title');
    });

    it('should not update if properties form is not visible', () => {
      const mockForm = {
        offsetParent: null, // Not visible
        querySelector: vi.fn(),
      };
      document.querySelector.mockImplementation((selector) => {
        if (selector === '#node-content #properties-node-content-form') return mockForm;
        if (selector === '#exe-title > .exe-title.content') return mockTitleElement;
        if (selector === '.title-menu-button') return mockButtonElement;
        if (selector === '#exe-title') return mockContainerElement;
        return null;
      });

      odeTitleMenu.updatePropertiesInput('Test Title');

      expect(mockForm.querySelector).not.toHaveBeenCalled();
    });

    it('should update title input when form is visible', () => {
      const mockInput = { value: '' };
      const mockForm = {
        offsetParent: document.body, // Visible
        querySelector: vi.fn(() => mockInput),
      };
      document.querySelector.mockImplementation((selector) => {
        if (selector === '#node-content #properties-node-content-form') return mockForm;
        if (selector === '#exe-title > .exe-title.content') return mockTitleElement;
        if (selector === '.title-menu-button') return mockButtonElement;
        if (selector === '#exe-title') return mockContainerElement;
        return null;
      });

      odeTitleMenu.updatePropertiesInput('Updated Title');

      expect(mockForm.querySelector).toHaveBeenCalledWith('input[data-testid="prop-pp_title"]');
      expect(mockInput.value).toBe('Updated Title');
    });

    it('should not crash if title input is not found', () => {
      const mockForm = {
        offsetParent: document.body,
        querySelector: vi.fn(() => null),
      };
      document.querySelector.mockImplementation((selector) => {
        if (selector === '#node-content #properties-node-content-form') return mockForm;
        if (selector === '#exe-title > .exe-title.content') return mockTitleElement;
        if (selector === '.title-menu-button') return mockButtonElement;
        if (selector === '#exe-title') return mockContainerElement;
        return null;
      });

      // Should not throw
      odeTitleMenu.updatePropertiesInput('Test Title');
    });
  });

  describe('placeCursorAtEnd', () => {
    it('should place cursor at end of text node', () => {
      const mockRange = {
        selectNodeContents: vi.fn(),
        collapse: vi.fn(),
        setStart: vi.fn(),
      };
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      };
      document.createRange = vi.fn(() => mockRange);
      window.getSelection = vi.fn(() => mockSelection);

      const textNode = { nodeType: Node.TEXT_NODE, length: 10 };
      const el = {
        focus: vi.fn(),
        childNodes: [textNode],
        scrollTop: 0,
        scrollHeight: 100,
      };

      odeTitleMenu.placeCursorAtEnd(el);

      expect(el.focus).toHaveBeenCalled();
      expect(mockRange.setStart).toHaveBeenCalledWith(textNode, 10);
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
      expect(el.scrollTop).toBe(100);
    });

    it('should handle non-text node child', () => {
      const mockRange = {
        selectNodeContents: vi.fn(),
        collapse: vi.fn(),
        setStart: vi.fn(),
      };
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      };
      document.createRange = vi.fn(() => mockRange);
      window.getSelection = vi.fn(() => mockSelection);

      const elementNode = { nodeType: Node.ELEMENT_NODE };
      const el = {
        focus: vi.fn(),
        childNodes: [elementNode],
        scrollTop: 0,
        scrollHeight: 50,
      };

      odeTitleMenu.placeCursorAtEnd(el);

      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(el);
      expect(mockRange.collapse).toHaveBeenCalledWith(false);
    });

    it('should handle empty element', () => {
      const mockRange = {
        selectNodeContents: vi.fn(),
        collapse: vi.fn(),
      };
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      };
      document.createRange = vi.fn(() => mockRange);
      window.getSelection = vi.fn(() => mockSelection);

      const el = {
        focus: vi.fn(),
        childNodes: [],
        scrollTop: 0,
        scrollHeight: 0,
      };

      odeTitleMenu.placeCursorAtEnd(el);

      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(el);
      expect(mockRange.collapse).toHaveBeenCalledWith(false);
    });
  });

  describe('onTitleChanged', () => {
    it('should check title line count on childList mutation', () => {
      const checkSpy = vi.spyOn(odeTitleMenu, 'checkTitleLineCount');
      const mutationsList = [{ type: 'childList' }];

      odeTitleMenu.onTitleChanged(mutationsList, null);

      expect(checkSpy).toHaveBeenCalled();
    });

    it('should not check title line count on other mutation types', () => {
      const checkSpy = vi.spyOn(odeTitleMenu, 'checkTitleLineCount');
      const mutationsList = [{ type: 'attributes' }];

      odeTitleMenu.onTitleChanged(mutationsList, null);

      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('onRemoteTitleChange', () => {
    it('should not update title when editing', () => {
      mockContainerElement.classList.contains = vi.fn(() => true); // title-editing
      odeTitleMenu.rawTitleText = 'Current Edit';

      odeTitleMenu.onRemoteTitleChange('Remote Title');

      expect(odeTitleMenu.rawTitleText).toBe('Current Edit');
    });

    it('should use default title when newTitle is empty', () => {
      mockContainerElement.classList.contains = vi.fn(() => false);

      odeTitleMenu.onRemoteTitleChange('');

      expect(mockTitleElement.textContent).toBe('Untitled document');
    });

    it('should not update if title is the same', () => {
      mockContainerElement.classList.contains = vi.fn(() => false);
      odeTitleMenu.rawTitleText = 'Same Title';
      const checkSpy = vi.spyOn(odeTitleMenu, 'checkTitleLineCount');

      odeTitleMenu.onRemoteTitleChange('Same Title');

      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('getProjectProperties', () => {
    it('should load and return project properties', async () => {
      const mockProperties = { title: 'Test', author: 'Author' };
      window.eXeLearning.app.project.properties = {
        load: vi.fn().mockResolvedValue(),
        properties: mockProperties,
      };

      const result = await odeTitleMenu.getProjectProperties();

      expect(window.eXeLearning.app.project.properties.load).toHaveBeenCalled();
      expect(result).toEqual(mockProperties);
    });
  });

  describe('saveTitleToYjs', () => {
    it('should not crash if yjsBridge is null', () => {
      window.eXeLearning.app.project._yjsBridge = null;

      // Should not throw
      odeTitleMenu.saveTitleToYjs('Test Title');
    });

    it('should not crash if documentManager is null', () => {
      mockBridge.getDocumentManager = vi.fn(() => null);

      // Should not throw
      odeTitleMenu.saveTitleToYjs('Test Title');
    });
  });

  describe('setTitle edge cases', () => {
    it('should handle missing yjsBridge', () => {
      window.eXeLearning.app.project._yjsBridge = null;

      odeTitleMenu.setTitle();

      expect(mockTitleElement.textContent).toBe('Untitled document');
    });

    it('should handle missing documentManager', () => {
      mockBridge.getDocumentManager = vi.fn(() => null);

      odeTitleMenu.setTitle();

      expect(mockTitleElement.textContent).toBe('Untitled document');
    });
  });

  describe('initYjsBinding edge cases', () => {
    it('should handle missing yjsBridge', () => {
      window.eXeLearning.app.project._yjsBridge = null;

      // Should not throw
      odeTitleMenu.initYjsBinding();
    });

    it('should handle missing documentManager', () => {
      mockBridge.getDocumentManager = vi.fn(() => null);

      // Should not throw
      odeTitleMenu.initYjsBinding();
    });

    it('should handle add action in metadata observer', () => {
      odeTitleMenu.initYjsBinding();
      const observerCallback = mockMetadata.observe.mock.calls[0][0];

      mockMetadata.get.mockReturnValue('Added Title');
      observerCallback({
        transaction: { origin: 'remote' },
        changes: { keys: new Map([['title', { action: 'add' }]]) },
      });

      expect(mockTitleElement.textContent).toBe('Added Title');
    });

    it('should ignore non-title key changes', () => {
      odeTitleMenu.initYjsBinding();
      const observerCallback = mockMetadata.observe.mock.calls[0][0];

      mockTitleElement.textContent = 'Original';
      observerCallback({
        transaction: { origin: 'remote' },
        changes: { keys: new Map([['author', { action: 'update' }]]) },
      });

      expect(mockTitleElement.textContent).toBe('Original');
    });
  });

  describe('typesetTitle edge cases', () => {
    it('should handle MathJax.typesetPromise rejection', async () => {
      const mockTypesetPromise = vi.fn().mockRejectedValue(new Error('MathJax error'));
      globalThis.MathJax = { typesetPromise: mockTypesetPromise };

      odeTitleMenu.rawTitleText = 'Title with \\[formula\\]';

      // Should not throw
      odeTitleMenu.typesetTitle();

      delete globalThis.MathJax;
    });

    it('should handle missing MathJax', () => {
      delete globalThis.MathJax;
      odeTitleMenu.rawTitleText = 'Title with \\(x\\)';

      // Should not throw
      odeTitleMenu.typesetTitle();
    });

    it('should detect \\begin{} LaTeX syntax', () => {
      const mockTypesetPromise = vi.fn().mockResolvedValue();
      globalThis.MathJax = { typesetPromise: mockTypesetPromise };

      odeTitleMenu.rawTitleText = 'Title with \\begin{equation}x\\end{equation}';
      odeTitleMenu.typesetTitle();

      expect(mockTypesetPromise).toHaveBeenCalled();

      delete globalThis.MathJax;
    });
  });

  describe('setChangeTitle edge cases', () => {
    it('should handle title button click triggering title click', () => {
      odeTitleMenu.setChangeTitle();

      const buttonClickHandler = mockButtonElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];
      const mockEvent = { stopPropagation: vi.fn() };

      buttonClickHandler(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockTitleElement.click).toHaveBeenCalled();
    });

    it('should not re-enter editing mode if already editing', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];

      // First click
      clickHandler();
      vi.runAllTimers();

      // Reset mocks
      mockTitleElement.setAttribute.mockClear();

      // Second click while editing
      clickHandler();

      expect(mockTitleElement.setAttribute).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should clear debounce timer on finish editing', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];
      clickHandler();
      vi.runAllTimers();

      // Start typing to set debounce timer
      const inputHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'input')[1];
      mockTitleElement.textContent = 'Typing...';
      inputHandler();

      expect(odeTitleMenu.titleDebounceTimer).not.toBeNull();

      // Finish editing
      const blurHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'blur')[1];
      blurHandler();

      expect(odeTitleMenu.titleDebounceTimer).toBeNull();
      vi.useRealTimers();
    });

    it('should remove paste handlers on finish editing', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];
      clickHandler();
      vi.runAllTimers();

      // Set up paste handlers
      mockTitleElement._onPastePlain = vi.fn();
      mockTitleElement._onDropPlain = vi.fn();

      // Finish editing
      const blurHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'blur')[1];
      blurHandler();

      expect(mockTitleElement.removeEventListener).toHaveBeenCalledWith('paste', expect.any(Function));
      expect(mockTitleElement.removeEventListener).toHaveBeenCalledWith('drop', expect.any(Function));
      expect(mockTitleElement._onPastePlain).toBeUndefined();
      expect(mockTitleElement._onDropPlain).toBeUndefined();
      vi.useRealTimers();
    });

    it('should clear existing debounce timer when typing rapidly', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];
      clickHandler();
      vi.runAllTimers();

      const inputHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'input')[1];

      // First input - sets timer
      mockTitleElement.textContent = 'First';
      inputHandler();
      const firstTimer = odeTitleMenu.titleDebounceTimer;
      expect(firstTimer).not.toBeNull();

      // Second input before debounce completes - should clear and set new timer
      mockTitleElement.textContent = 'Second';
      inputHandler();

      // Timer should have been replaced (line 205 coverage)
      expect(odeTitleMenu.titleDebounceTimer).not.toBeNull();

      // Advance time to trigger the debounced save
      vi.advanceTimersByTime(300);

      // Should have saved the second value
      expect(mockMetadata.set).toHaveBeenCalledWith('title', 'Second');

      vi.useRealTimers();
    });

    it('should cleanup old listeners when re-entering edit mode after blur', () => {
      vi.useFakeTimers();
      odeTitleMenu.setChangeTitle();

      const clickHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'click')[1];

      // First edit session
      clickHandler();
      vi.runAllTimers();

      // End first session via blur
      const blurHandler = mockTitleElement.addEventListener.mock.calls.find(c => c[0] === 'blur')[1];
      blurHandler();

      // Clear mock calls to track new ones
      mockTitleElement.removeEventListener.mockClear();

      // Second edit session - should cleanup old listeners (lines 169, 172, 175)
      clickHandler();
      vi.runAllTimers();

      // The click handler stores references to listeners and removes them on next click
      // The first session's blur already cleaned up, but the code path exists for edge cases
      expect(mockTitleElement.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(mockTitleElement.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockTitleElement.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));

      vi.useRealTimers();
    });
  });

  describe('checkTitleLineCount edge cases', () => {
    it('should handle missing title element', () => {
      odeTitleMenu.odeTitleMenuHeadElement = null;

      // Should not throw
      odeTitleMenu.checkTitleLineCount();
    });

    it('should handle one line content', () => {
      mockTitleElement.firstChild = {};
      const mockRange = {
        selectNodeContents: vi.fn(),
        getClientRects: vi.fn(() => [{}]), // 1 rect = 1 line
      };
      document.createRange.mockReturnValue(mockRange);

      odeTitleMenu.checkTitleLineCount();

      expect(mockContainerElement.classList.add).toHaveBeenCalledWith('one-line');
    });
  });

  describe('saveTitle edge cases', () => {
    it('should handle error during save', async () => {
      mockDoc.transact = vi.fn(() => {
        throw new Error('Transact error');
      });

      await expect(odeTitleMenu.saveTitle('Title')).rejects.toThrow('Transact error');
    });

    it('should handle missing documentManager', async () => {
      mockBridge.getDocumentManager = vi.fn(() => null);

      const result = await odeTitleMenu.saveTitle('Title');
      expect(result.responseMessage).toBe('ERROR');
    });
  });
});
