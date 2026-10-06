import MenuIdevicesBehaviour from './menuIdevicesBehaviour.js';

describe('MenuIdevicesBehaviour', () => {
  let menuIdevicesBehaviour;
  let mockParent;
  let mockMenuIdevices;
  let mockCategoryElements;
  let mockLabelElements;
  let mockMenuContent;

  beforeEach(() => {
    // Mock eXeLearning
    window.eXeLearning = {
      app: {
        menus: {
          menuStructure: {
            menuStructureBehaviour: {
              checkIfEmptyNode: vi.fn(),
            },
          },
        },
        project: {
          checkOpenIdevice: vi.fn(() => false),
        },
      },
    };

    // Mock menu content element
    mockMenuContent = {
      id: 'menu_idevices_content',
      contains: vi.fn(() => false),
    };

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'menu_idevices_content') return mockMenuContent;
      return null;
    });

    // Mock category elements
    mockCategoryElements = [
      {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(() => false),
        },
        getBoundingClientRect: vi.fn(() => ({
          right: 200,
        })),
      },
      {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(() => false),
        },
        getBoundingClientRect: vi.fn(() => ({
          right: 200,
        })),
      },
    ];

    // Mock label elements with siblings
    mockLabelElements = [
      {
        addEventListener: vi.fn(),
        parentNode: mockCategoryElements[0],
        nextElementSibling: {
          style: {},
        },
      },
      {
        addEventListener: vi.fn(),
        parentNode: mockCategoryElements[1],
        nextElementSibling: {
          style: {},
        },
      },
    ];

    // Mock menu idevices element
    mockMenuIdevices = {
      getAttribute: vi.fn(() => 'thin'),
      querySelector: vi.fn(() => null),
    };

    // Mock parent
    mockParent = {
      menuIdevices: mockMenuIdevices,
      categoriesIdevices: mockCategoryElements,
      categoriesIdevicesLabels: mockLabelElements,
    };

    // Mock window
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    window.addEventListener = vi.fn();
    document.addEventListener = vi.fn();

    // Mock MutationObserver
    global.MutationObserver = vi.fn(function (callback) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.callback = callback;
    });

    menuIdevicesBehaviour = new MenuIdevicesBehaviour(mockParent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.eXeLearning;
    delete global.MutationObserver;
  });

  describe('constructor', () => {
    it('should store parent reference', () => {
      expect(menuIdevicesBehaviour.parent).toBe(mockParent);
    });

    it('should initialize activeLabel as null', () => {
      expect(menuIdevicesBehaviour.activeLabel).toBeNull();
    });
  });

  describe('behaviour', () => {
    it('should call addEventClickIdeviceCategory', () => {
      const spy = vi.spyOn(menuIdevicesBehaviour, 'addEventClickIdeviceCategory');
      menuIdevicesBehaviour.behaviour();

      expect(spy).toHaveBeenCalled();
    });

    it('should call changeAttributePosBehaviour', () => {
      const spy = vi.spyOn(menuIdevicesBehaviour, 'changeAttributePosBehaviour');
      menuIdevicesBehaviour.behaviour();

      expect(spy).toHaveBeenCalled();
    });

    it('should call addResizeListener', () => {
      const spy = vi.spyOn(menuIdevicesBehaviour, 'addResizeListener');
      menuIdevicesBehaviour.behaviour();

      expect(spy).toHaveBeenCalled();
    });

    it('should call methods in correct order', () => {
      const spy1 = vi.spyOn(menuIdevicesBehaviour, 'addEventClickIdeviceCategory');
      const spy2 = vi.spyOn(menuIdevicesBehaviour, 'changeAttributePosBehaviour');
      const spy3 = vi.spyOn(menuIdevicesBehaviour, 'addResizeListener');
      const spy4 = vi.spyOn(menuIdevicesBehaviour, 'observeRootPageState');

      menuIdevicesBehaviour.behaviour();

      expect(spy1).toHaveBeenCalledBefore(spy2);
      expect(spy2).toHaveBeenCalledBefore(spy3);
      expect(spy3).toHaveBeenCalledBefore(spy4);
    });

    it('should call observeRootPageState', () => {
      const spy = vi.spyOn(menuIdevicesBehaviour, 'observeRootPageState');
      menuIdevicesBehaviour.behaviour();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('addEventClickIdeviceCategory', () => {
    it('should add click event listeners to all labels', () => {
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      expect(mockLabelElements[0].addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLabelElements[1].addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should set activeLabel when label is clicked', () => {
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(menuIdevicesBehaviour.activeLabel).toBe(mockLabelElements[0]);
    });

    it('should call positionSibling when label is clicked', () => {
      const spy = vi.spyOn(menuIdevicesBehaviour, 'positionSibling');
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(spy).toHaveBeenCalledWith(mockLabelElements[0]);
    });

    it('should handle thick menu behaviour', () => {
      mockMenuIdevices.getAttribute.mockReturnValue('thick');
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('on');
      expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('off');
      expect(window.eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode).toHaveBeenCalled();
    });

    it('should toggle category from off to on', () => {
      mockCategoryElements[0].classList.contains.mockReturnValue(true);
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('off');
      expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('on');
      expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('last-open');
    });

    it('should toggle category from on to off', () => {
      mockCategoryElements[0].classList.contains.mockReturnValue(false);
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('on');
      expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('last-open');
      expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('off');
    });

    it('should return early if checkOpenIdevice returns true', () => {
      window.eXeLearning.app.project.checkOpenIdevice.mockReturnValue(true);
      mockCategoryElements[0].classList.contains.mockReturnValue(true);
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      // Should not add 'on' class if checkOpenIdevice returns true
      expect(mockCategoryElements[0].classList.add).not.toHaveBeenCalledWith('on');
    });

    it('should add document event listeners for close events', () => {
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const expectedEvents = [
        'click',
        'dragstart',
        'drag',
        'dragend',
        'dragenter',
        'dragover',
        'dragleave',
        'drop',
      ];

      expectedEvents.forEach((event) => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          true
        );
      });
    });

    it('should close categories when clicking outside menu', () => {
      mockMenuContent.contains.mockReturnValue(false);
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler({ target: { id: 'outside-element' } });

        expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('on');
        expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('last-open');
        expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('off');
      }
    });

    it('should not close categories when clicking inside menu', () => {
      mockMenuContent.contains.mockReturnValue(true);
      menuIdevicesBehaviour.addEventClickIdeviceCategory();

      const clickHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        mockCategoryElements[0].classList.remove.mockClear();
        mockCategoryElements[0].classList.add.mockClear();

        clickHandler({ target: mockMenuContent });

        // Should only call checkIfEmptyNode, not modify classes
        expect(window.eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode).toHaveBeenCalled();
      }
    });
  });

  describe('addResizeListener', () => {
    it('should add resize event listener to window', () => {
      menuIdevicesBehaviour.addResizeListener();

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should call positionSibling on resize if activeLabel exists', () => {
      menuIdevicesBehaviour.activeLabel = mockLabelElements[0];
      const spy = vi.spyOn(menuIdevicesBehaviour, 'positionSibling');

      menuIdevicesBehaviour.addResizeListener();

      const resizeHandler = window.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      if (resizeHandler) {
        resizeHandler();
        expect(spy).toHaveBeenCalledWith(mockLabelElements[0]);
      }
    });

    it('should not call positionSibling on resize if activeLabel is null', () => {
      menuIdevicesBehaviour.activeLabel = null;
      const spy = vi.spyOn(menuIdevicesBehaviour, 'positionSibling');

      menuIdevicesBehaviour.addResizeListener();

      const resizeHandler = window.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      if (resizeHandler) {
        resizeHandler();
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  describe('positionSibling', () => {
    it('should return early if sibling does not exist', () => {
      const labelWithoutSibling = {
        parentNode: mockCategoryElements[0],
        nextElementSibling: null,
      };

      menuIdevicesBehaviour.positionSibling(labelWithoutSibling);

      // Should not throw error
      expect(true).toBe(true);
    });

    it('should clear left style on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });

      menuIdevicesBehaviour.positionSibling(mockLabelElements[0]);

      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('');
    });

    it('should set left position on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });

      menuIdevicesBehaviour.positionSibling(mockLabelElements[0]);

      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('214px');
    });

    it('should use 768px as mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true, configurable: true });
      menuIdevicesBehaviour.positionSibling(mockLabelElements[0]);
      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('');

      mockLabelElements[0].nextElementSibling.style.left = '100px';
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true, configurable: true });
      menuIdevicesBehaviour.positionSibling(mockLabelElements[0]);
      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('214px');
    });

    it('should calculate position based on getBoundingClientRect', () => {
      mockCategoryElements[0].getBoundingClientRect.mockReturnValue({ right: 300 });

      menuIdevicesBehaviour.positionSibling(mockLabelElements[0]);

      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('314px');
    });
  });

  describe('changeAttributePosBehaviour', () => {
    it('should create MutationObserver', () => {
      menuIdevicesBehaviour.changeAttributePosBehaviour();

      expect(global.MutationObserver).toHaveBeenCalled();
    });

    it('should observe menuIdevices element', () => {
      menuIdevicesBehaviour.changeAttributePosBehaviour();

      const observer = global.MutationObserver.mock.results[0].value;
      expect(observer.observe).toHaveBeenCalledWith(mockMenuIdevices, { attributes: true });
    });

    it('should handle size attribute changes', () => {
      const mockLastOpen = {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      };
      mockMenuIdevices.querySelector.mockReturnValue(mockLastOpen);

      menuIdevicesBehaviour.changeAttributePosBehaviour();

      const observer = global.MutationObserver.mock.results[0].value;
      const mutations = [
        {
          type: 'attributes',
          attributeName: 'size',
        },
      ];

      observer.callback(mutations);

      expect(mockCategoryElements[0].classList.remove).toHaveBeenCalledWith('on');
      expect(mockCategoryElements[0].classList.add).toHaveBeenCalledWith('off');
      expect(mockLastOpen.classList.remove).toHaveBeenCalledWith('off');
      expect(mockLastOpen.classList.add).toHaveBeenCalledWith('on');
    });

    it('should handle when no last-open category exists', () => {
      mockMenuIdevices.querySelector.mockReturnValue(null);

      menuIdevicesBehaviour.changeAttributePosBehaviour();

      const observer = global.MutationObserver.mock.results[0].value;
      const mutations = [
        {
          type: 'attributes',
          attributeName: 'size',
        },
      ];

      expect(() => observer.callback(mutations)).not.toThrow();
    });

    it('should ignore non-size attribute changes', () => {
      menuIdevicesBehaviour.changeAttributePosBehaviour();

      const observer = global.MutationObserver.mock.results[0].value;
      const mutations = [
        {
          type: 'attributes',
          attributeName: 'class',
        },
      ];

      mockCategoryElements[0].classList.remove.mockClear();

      observer.callback(mutations);

      expect(mockCategoryElements[0].classList.remove).not.toHaveBeenCalled();
    });

    it('should ignore non-attribute mutations', () => {
      menuIdevicesBehaviour.changeAttributePosBehaviour();

      const observer = global.MutationObserver.mock.results[0].value;
      const mutations = [
        {
          type: 'childList',
        },
      ];

      mockCategoryElements[0].classList.remove.mockClear();

      observer.callback(mutations);

      expect(mockCategoryElements[0].classList.remove).not.toHaveBeenCalled();
    });
  });

  describe('observeRootPageState', () => {
    let mockNodeContent;
    let mockListMenuIdevices;
    let mockIdevicesBottom;

    beforeEach(() => {
      mockNodeContent = {
        getAttribute: vi.fn(() => null),
      };
      mockListMenuIdevices = {
        classList: { toggle: vi.fn(), remove: vi.fn(), add: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };
      mockIdevicesBottom = {
        classList: { toggle: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };

      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#node-content') return mockNodeContent;
        if (selector === '#list_menu_idevices') return mockListMenuIdevices;
        if (selector === '#idevices-bottom') return mockIdevicesBottom;
        return null;
      });
    });

    it('should not throw when #node-content is absent', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);
      expect(() => menuIdevicesBehaviour.observeRootPageState()).not.toThrow();
    });

    it('should initialize disabled state from current attribute value', () => {
      mockNodeContent.getAttribute.mockReturnValue('root');
      const spy = vi.spyOn(menuIdevicesBehaviour, 'updateIdevicesDisabledState');

      menuIdevicesBehaviour.observeRootPageState();

      expect(spy).toHaveBeenCalledWith('root');
    });

    it('should create a MutationObserver on #node-content', () => {
      menuIdevicesBehaviour.observeRootPageState();

      const observer = global.MutationObserver.mock.results[0].value;
      expect(observer.observe).toHaveBeenCalledWith(
        mockNodeContent,
        { attributes: true, attributeFilter: ['node-selected'] }
      );
    });

    it('should call updateIdevicesDisabledState when node-selected attribute changes', () => {
      mockNodeContent.getAttribute.mockReturnValue('page-1');
      menuIdevicesBehaviour.observeRootPageState();

      const spy = vi.spyOn(menuIdevicesBehaviour, 'updateIdevicesDisabledState');
      mockNodeContent.getAttribute.mockReturnValue('root');

      const observer = global.MutationObserver.mock.results[0].value;
      observer.callback([{ attributeName: 'node-selected' }]);

      expect(spy).toHaveBeenCalledWith('root');
    });

    it('should ignore mutations for other attributes', () => {
      menuIdevicesBehaviour.observeRootPageState();

      const spy = vi.spyOn(menuIdevicesBehaviour, 'updateIdevicesDisabledState');
      const observer = global.MutationObserver.mock.results[0].value;
      observer.callback([{ attributeName: 'class' }]);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('updateIdevicesDisabledState', () => {
    let mockListMenuIdevices;
    let mockIdevicesBottom;

    beforeEach(() => {
      mockListMenuIdevices = {
        classList: { toggle: vi.fn(), remove: vi.fn(), add: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };
      mockIdevicesBottom = {
        classList: { toggle: vi.fn() },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      };

      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#list_menu_idevices') return mockListMenuIdevices;
        if (selector === '#idevices-bottom') return mockIdevicesBottom;
        return null;
      });
    });

    it('should add disabled class and title to both elements when root', () => {
      menuIdevicesBehaviour.updateIdevicesDisabledState('root');

      expect(mockListMenuIdevices.classList.toggle).toHaveBeenCalledWith('disabled', true);
      expect(mockListMenuIdevices.setAttribute).toHaveBeenCalledWith('title', expect.any(String));
      expect(mockIdevicesBottom.classList.toggle).toHaveBeenCalledWith('disabled', true);
      expect(mockIdevicesBottom.setAttribute).toHaveBeenCalledWith('title', expect.any(String));
    });

    it('should remove disabled class and title from both elements when not root', () => {
      menuIdevicesBehaviour.updateIdevicesDisabledState('page-1');

      expect(mockListMenuIdevices.classList.toggle).toHaveBeenCalledWith('disabled', false);
      expect(mockListMenuIdevices.removeAttribute).toHaveBeenCalledWith('title');
      expect(mockIdevicesBottom.classList.toggle).toHaveBeenCalledWith('disabled', false);
      expect(mockIdevicesBottom.removeAttribute).toHaveBeenCalledWith('title');
    });

    it('should close open categories when switching to root', () => {
      menuIdevicesBehaviour.updateIdevicesDisabledState('root');

      mockCategoryElements.forEach((el) => {
        expect(el.classList.remove).toHaveBeenCalledWith('on', 'last-open');
        expect(el.classList.add).toHaveBeenCalledWith('off');
      });
    });

    it('should not throw when #list_menu_idevices or #idevices-bottom are absent', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);
      expect(() => menuIdevicesBehaviour.updateIdevicesDisabledState('root')).not.toThrow();
      expect(() => menuIdevicesBehaviour.updateIdevicesDisabledState('page-1')).not.toThrow();
    });

    it('should treat null nodeSelected as non-root', () => {
      menuIdevicesBehaviour.updateIdevicesDisabledState(null);

      expect(mockListMenuIdevices.classList.toggle).toHaveBeenCalledWith('disabled', false);
    });
  });

  describe('integration', () => {
    it('should initialize all behaviors on behaviour call', () => {
      const spy1 = vi.spyOn(menuIdevicesBehaviour, 'addEventClickIdeviceCategory');
      const spy2 = vi.spyOn(menuIdevicesBehaviour, 'changeAttributePosBehaviour');
      const spy3 = vi.spyOn(menuIdevicesBehaviour, 'addResizeListener');
      const spy4 = vi.spyOn(menuIdevicesBehaviour, 'observeRootPageState');

      menuIdevicesBehaviour.behaviour();

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(spy3).toHaveBeenCalled();
      expect(spy4).toHaveBeenCalled();
    });

    it('should handle complete click and position workflow', () => {
      menuIdevicesBehaviour.addEventClickIdeviceCategory();
      menuIdevicesBehaviour.addResizeListener();

      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      expect(menuIdevicesBehaviour.activeLabel).toBe(mockLabelElements[0]);
      expect(mockLabelElements[0].nextElementSibling.style.left).toBe('214px');
    });

    it('should reposition on window resize after click', () => {
      menuIdevicesBehaviour.addEventClickIdeviceCategory();
      menuIdevicesBehaviour.addResizeListener();

      // Click label
      const clickHandler = mockLabelElements[0].addEventListener.mock.calls[0][1];
      clickHandler({ target: mockLabelElements[0] });

      // Change window size to mobile
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });

      // Trigger resize
      const resizeHandler = window.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      if (resizeHandler) {
        resizeHandler();
        expect(mockLabelElements[0].nextElementSibling.style.left).toBe('');
      }
    });
  });
});
