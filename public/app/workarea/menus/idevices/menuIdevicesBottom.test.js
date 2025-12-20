import MenuIdevicesBottom from './menuIdevicesBottom.js';

describe('MenuIdevicesBottom', () => {
  let menuIdevicesBottom;
  let mockMenuElement;
  let mockNodeContainer;
  let mockIdevicesList;
  let mockDB;
  let mockTransaction;
  let mockStore;

  beforeEach(() => {
    // Mock translation function
    global._ = vi.fn((key) => key);

    // Mock Bootstrap Tooltip
    window.bootstrap = {
      Tooltip: {
        getOrCreateInstance: vi.fn(),
      },
    };

    // Mock idevices list
    mockIdevicesList = {
      text: {
        id: 'text',
        title: 'Text',
        icon: { type: 'exe-icon', name: '<i class="bi bi-text"></i>' },
        path: '/path/to/text',
        __order: 0,
      },
      'az-quiz-game': {
        id: 'az-quiz-game',
        title: 'Quiz Game',
        icon: { type: 'exe-icon', name: '<i class="bi bi-quiz"></i>' },
        path: '/path/to/quiz',
        __order: 1,
      },
      form: {
        id: 'form',
        title: 'Form',
        icon: { type: 'img', name: 'form.png', url: 'icon.png' },
        path: '/path/to/form',
        __order: 2,
      },
    };

    // Mock eXeLearning
    window.eXeLearning = {
      app: {
        idevices: {
          list: {
            installed: mockIdevicesList,
          },
          showModalIdeviceManager: vi.fn(),
        },
        project: {
          idevices: {
            behaviour: vi.fn(),
          },
        },
        user: {
          name: 'testuser',
        },
      },
    };

    // Mock menu element
    mockMenuElement = {
      id: 'idevices-bottom',
      append: vi.fn(),
      style: {},
    };

    // Mock node container
    mockNodeContainer = {
      id: 'node-content',
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        width: 800,
      })),
    };

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#idevices-bottom') return mockMenuElement;
      if (selector === '#node-content') return mockNodeContainer;
      if (selector === '#setting-menuIdevices') {
        return {
          id: 'setting-menuIdevices',
          addEventListener: vi.fn(),
        };
      }
      return null;
    });

    // Mock IndexedDB
    mockStore = {
      put: vi.fn(),
      get: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
        result: { id: 'testuser', value: ['text', 'form'] },
      })),
    };

    mockTransaction = {
      objectStore: vi.fn(() => mockStore),
      complete: Promise.resolve(),
    };

    mockDB = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(),
    };

    global.indexedDB = {
      open: vi.fn(() => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      })),
    };

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn(function (callback) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.callback = callback;
    });

    window.addEventListener = vi.fn();

    menuIdevicesBottom = new MenuIdevicesBottom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global._;
    delete window.bootstrap;
    delete window.eXeLearning;
    delete global.indexedDB;
    delete global.ResizeObserver;
  });

  describe('constructor', () => {
    it('should store default idevices list', () => {
      expect(menuIdevicesBottom.defaultIdevices).toEqual([
        'text',
        'az-quiz-game',
        'form',
        'download-source-file',
        'image-gallery',
      ]);
    });

    it('should query menu idevices element', () => {
      expect(document.querySelector).toHaveBeenCalledWith('#idevices-bottom');
    });

    it('should store menu element reference', () => {
      expect(menuIdevicesBottom.menuIdevices).toBe(mockMenuElement);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      vi.spyOn(menuIdevicesBottom, 'centerMenuIdevices');
      vi.spyOn(menuIdevicesBottom, 'getIdevices').mockResolvedValue(null);
      vi.spyOn(menuIdevicesBottom, 'saveIdevices').mockResolvedValue(undefined);
      vi.spyOn(menuIdevicesBottom, 'filtreIdevices').mockReturnValue({
        text: mockIdevicesList.text,
      });
      vi.spyOn(menuIdevicesBottom, 'elementDivIdevice').mockReturnValue(
        document.createElement('div')
      );
      vi.spyOn(menuIdevicesBottom, 'elementConfigIdevices').mockReturnValue(
        document.createElement('div')
      );
    });

    it('should query node container', async () => {
      await menuIdevicesBottom.init();

      expect(document.querySelector).toHaveBeenCalledWith('#node-content');
    });

    it('should call centerMenuIdevices', async () => {
      await menuIdevicesBottom.init();

      expect(menuIdevicesBottom.centerMenuIdevices).toHaveBeenCalled();
    });

    it('should create ResizeObserver', async () => {
      await menuIdevicesBottom.init();

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it('should observe node container with ResizeObserver', async () => {
      await menuIdevicesBottom.init();

      const observer = global.ResizeObserver.mock.results[0].value;
      expect(observer.observe).toHaveBeenCalledWith(mockNodeContainer);
    });

    it('should not observe if node container is null', async () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);
      const newInstance = new MenuIdevicesBottom();
      await newInstance.init();

      const observer = global.ResizeObserver.mock.results[0].value;
      expect(observer.observe).not.toHaveBeenCalled();
    });

    it('should add resize event listener to window', async () => {
      await menuIdevicesBottom.init();

      expect(window.addEventListener).toHaveBeenCalledWith('resize', menuIdevicesBottom.centerMenuIdevices);
    });

    it('should use default idevices when getIdevices returns null', async () => {
      await menuIdevicesBottom.init();

      expect(menuIdevicesBottom.filtreIdevices).toHaveBeenCalledWith(menuIdevicesBottom.defaultIdevices);
      expect(menuIdevicesBottom.saveIdevices).toHaveBeenCalledWith(menuIdevicesBottom.defaultIdevices);
    });

    it('should use saved idevices when getIdevices returns data', async () => {
      const savedIdevices = ['text', 'form'];
      menuIdevicesBottom.getIdevices.mockResolvedValue(savedIdevices);

      await menuIdevicesBottom.init();

      expect(menuIdevicesBottom.filtreIdevices).toHaveBeenCalledWith(savedIdevices);
      expect(menuIdevicesBottom.saveIdevices).not.toHaveBeenCalled();
    });

    it('should append idevice elements to menu', async () => {
      await menuIdevicesBottom.init();

      expect(mockMenuElement.append).toHaveBeenCalled();
    });

    it('should append config button to menu', async () => {
      await menuIdevicesBottom.init();

      expect(menuIdevicesBottom.elementConfigIdevices).toHaveBeenCalled();
    });

    it('should query setting button', async () => {
      await menuIdevicesBottom.init();

      expect(document.querySelector).toHaveBeenCalledWith('#setting-menuIdevices');
    });

    it('should add click listener to setting button', async () => {
      const mockButton = {
        addEventListener: vi.fn(),
      };
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#setting-menuIdevices') return mockButton;
        if (selector === '#idevices-bottom') return mockMenuElement;
        if (selector === '#node-content') return mockNodeContainer;
        return null;
      });

      await menuIdevicesBottom.init();

      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should show modal when setting button clicked', async () => {
      const mockButton = {
        addEventListener: vi.fn(),
      };
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#setting-menuIdevices') return mockButton;
        if (selector === '#idevices-bottom') return mockMenuElement;
        if (selector === '#node-content') return mockNodeContainer;
        return null;
      });

      await menuIdevicesBottom.init();

      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(window.eXeLearning.app.idevices.showModalIdeviceManager).toHaveBeenCalled();
    });

    it('should call project idevices behaviour', async () => {
      await menuIdevicesBottom.init();

      expect(window.eXeLearning.app.project.idevices.behaviour).toHaveBeenCalled();
    });
  });

  describe('centerMenuIdevices', () => {
    it('should return early if nodeContainer is null', () => {
      menuIdevicesBottom.nodeContainer = null;

      menuIdevicesBottom.centerMenuIdevices();

      expect(mockNodeContainer.getBoundingClientRect).not.toHaveBeenCalled();
    });

    it('should return early if menuIdevices is null', () => {
      menuIdevicesBottom.nodeContainer = mockNodeContainer;
      menuIdevicesBottom.menuIdevices = null;

      menuIdevicesBottom.centerMenuIdevices();

      expect(mockNodeContainer.getBoundingClientRect).not.toHaveBeenCalled();
    });

    it('should calculate center position', () => {
      menuIdevicesBottom.nodeContainer = mockNodeContainer;
      menuIdevicesBottom.menuIdevices = { style: {} };

      menuIdevicesBottom.centerMenuIdevices();

      expect(mockNodeContainer.getBoundingClientRect).toHaveBeenCalled();
      expect(menuIdevicesBottom.menuIdevices.style.left).toBe('500px'); // 100 + 800/2
    });

    it('should set position to fixed', () => {
      menuIdevicesBottom.nodeContainer = mockNodeContainer;
      menuIdevicesBottom.menuIdevices = { style: {} };

      menuIdevicesBottom.centerMenuIdevices();

      expect(menuIdevicesBottom.menuIdevices.style.position).toBe('fixed');
    });

    it('should set transform to center', () => {
      menuIdevicesBottom.nodeContainer = mockNodeContainer;
      menuIdevicesBottom.menuIdevices = { style: {} };

      menuIdevicesBottom.centerMenuIdevices();

      expect(menuIdevicesBottom.menuIdevices.style.transform).toBe('translateX(-50%)');
    });
  });

  describe('elementDivIdevice', () => {
    it('should create div element with correct id', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.id).toBe('text');
    });

    it('should add correct classes', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.classList.contains('idevice_item')).toBe(true);
      expect(element.classList.contains('draggable')).toBe(true);
    });

    it('should set draggable attribute', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.getAttribute('draggable')).toBe('true');
    });

    it('should set drag attribute', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.getAttribute('drag')).toBe('idevice');
    });

    it('should set icon attributes', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.getAttribute('icon-type')).toBe('exe-icon');
      expect(element.getAttribute('icon-name')).toBe('<i class="bi bi-text"></i>');
    });

    it('should set tooltip attributes', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.getAttribute('data-bs-title')).toBe('Text');
      expect(element.getAttribute('data-bs-placement')).toBe('top');
      expect(element.getAttribute('data-bs-toggle')).toBe('tooltip');
    });

    it('should create Bootstrap tooltip', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(window.bootstrap.Tooltip.getOrCreateInstance).toHaveBeenCalledWith(element);
    });

    it('should set testid attribute', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(element.getAttribute('data-testid')).toBe('quick-idevice-text');
    });

    it('should append icon element', () => {
      const ideviceData = mockIdevicesList.text;
      vi.spyOn(menuIdevicesBottom, 'elementDivIcon').mockReturnValue(document.createElement('div'));

      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      expect(menuIdevicesBottom.elementDivIcon).toHaveBeenCalledWith(ideviceData);
      expect(element.children.length).toBeGreaterThan(0);
    });

    it('should append visually-hidden description', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIdevice(ideviceData);

      const hiddenSpan = Array.from(element.children).find(
        (child) => child.className === 'visually-hidden'
      );

      expect(hiddenSpan).toBeDefined();
      expect(hiddenSpan.textContent).toBe('Text');
    });
  });

  describe('filtreIdevices', () => {
    it('should filter idevices by keys', () => {
      const keys = ['text', 'form'];
      const result = menuIdevicesBottom.filtreIdevices(keys);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('form');
      expect(result).not.toHaveProperty('az-quiz-game');
    });

    it('should add __order property', () => {
      const keys = ['text', 'form'];
      const result = menuIdevicesBottom.filtreIdevices(keys);

      expect(result.text.__order).toBe(0);
      expect(result.form.__order).toBe(1);
    });

    it('should skip non-existent idevices', () => {
      const keys = ['text', 'non-existent', 'form'];
      const result = menuIdevicesBottom.filtreIdevices(keys);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('form');
      expect(result).not.toHaveProperty('non-existent');
    });

    it('should preserve original idevice data', () => {
      const keys = ['text'];
      const result = menuIdevicesBottom.filtreIdevices(keys);

      expect(result.text.title).toBe('Text');
      expect(result.text.id).toBe('text');
    });
  });

  describe('elementDivIcon', () => {
    it('should create div with idevice_icon class', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIcon(ideviceData);

      expect(element.classList.contains('idevice_icon')).toBe(true);
    });

    it('should set innerHTML for exe-icon type', () => {
      const ideviceData = mockIdevicesList.text;
      const element = menuIdevicesBottom.elementDivIcon(ideviceData);

      expect(element.innerHTML).toBe('<i class="bi bi-text"></i>');
    });

    it('should set background image for img type', () => {
      const ideviceData = mockIdevicesList.form;
      const element = menuIdevicesBottom.elementDivIcon(ideviceData);

      expect(element.classList.contains('idevice-img-icon')).toBe(true);
      expect(element.style.backgroundImage).toBe('url("/path/to/form/icon.png")');
      expect(element.style.backgroundRepeat).toBe('no-repeat');
      expect(element.style.backgroundPosition).toBe('center center');
      expect(element.style.backgroundSize).toBe('24px');
    });
  });

  describe('elementConfigIdevices', () => {
    it('should create settings icon element', () => {
      const element = menuIdevicesBottom.elementConfigIdevices();

      expect(element.classList.contains('idevice_icon')).toBe(true);
      expect(element.classList.contains('settings-icon')).toBe(true);
    });

    it('should set id', () => {
      const element = menuIdevicesBottom.elementConfigIdevices();

      expect(element.id).toBe('setting-menuIdevices');
    });

    it('should set tooltip attributes', () => {
      const element = menuIdevicesBottom.elementConfigIdevices();

      expect(element.getAttribute('data-bs-title')).toBe('iDevices');
      expect(element.getAttribute('data-bs-placement')).toBe('top');
      expect(element.getAttribute('data-bs-toggle')).toBe('tooltip');
    });

    it('should create Bootstrap tooltip', () => {
      const element = menuIdevicesBottom.elementConfigIdevices();

      expect(window.bootstrap.Tooltip.getOrCreateInstance).toHaveBeenCalledWith(element);
    });
  });

  describe('openDB', () => {
    it('should open indexedDB with correct name', async () => {
      const mockRequest = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      global.indexedDB.open.mockReturnValue(mockRequest);

      const promise = menuIdevicesBottom.openDB();

      // Simulate success
      mockRequest.onsuccess({ target: { result: mockDB } });

      const result = await promise;
      expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning', 1);
      expect(result).toBe(mockDB);
    });

    it('should create object store on upgrade', async () => {
      const mockRequest = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      global.indexedDB.open.mockReturnValue(mockRequest);

      const promise = menuIdevicesBottom.openDB();

      // Simulate upgrade needed
      mockRequest.onupgradeneeded({ target: { result: mockDB } });

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('idevicesSettings', { keyPath: 'id' });

      // Complete with success
      mockRequest.onsuccess({ target: { result: mockDB } });
      await promise;
    });

    it('should not create object store if it exists', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(true);
      const mockRequest = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      global.indexedDB.open.mockReturnValue(mockRequest);

      const promise = menuIdevicesBottom.openDB();

      mockRequest.onupgradeneeded({ target: { result: mockDB } });

      expect(mockDB.createObjectStore).not.toHaveBeenCalled();

      mockRequest.onsuccess({ target: { result: mockDB } });
      await promise;
    });

    it('should reject on error', async () => {
      const mockRequest = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      global.indexedDB.open.mockReturnValue(mockRequest);

      const promise = menuIdevicesBottom.openDB();

      const error = new Error('DB error');
      mockRequest.onerror({ target: { error } });

      await expect(promise).rejects.toThrow('DB error');
    });
  });

  describe('saveIdevices', () => {
    it('should save idevices to IndexedDB', async () => {
      vi.spyOn(menuIdevicesBottom, 'openDB').mockResolvedValue(mockDB);

      await menuIdevicesBottom.saveIdevices(['text', 'form']);

      expect(mockDB.transaction).toHaveBeenCalledWith('idevicesSettings', 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith({
        id: 'testuser',
        value: ['text', 'form'],
      });
    });

    it('should use user name as key', async () => {
      vi.spyOn(menuIdevicesBottom, 'openDB').mockResolvedValue(mockDB);
      window.eXeLearning.app.user.name = 'different-user';

      await menuIdevicesBottom.saveIdevices(['text']);

      expect(mockStore.put).toHaveBeenCalledWith({
        id: 'different-user',
        value: ['text'],
      });
    });
  });

  describe('getIdevices', () => {
    it('should retrieve idevices from IndexedDB', async () => {
      vi.spyOn(menuIdevicesBottom, 'openDB').mockResolvedValue(mockDB);

      let capturedRequest;
      mockStore.get.mockImplementation(() => {
        capturedRequest = {
          onsuccess: null,
          onerror: null,
          result: { id: 'testuser', value: ['text', 'form'] },
        };
        return capturedRequest;
      });

      const promise = menuIdevicesBottom.getIdevices();

      // Wait for promise to set up handlers
      await Promise.resolve();

      // Simulate IndexedDB calling onsuccess
      if (capturedRequest.onsuccess) {
        capturedRequest.onsuccess();
      }

      const result = await promise;
      expect(mockDB.transaction).toHaveBeenCalledWith('idevicesSettings', 'readonly');
      expect(mockStore.get).toHaveBeenCalledWith('testuser');
      expect(result).toEqual(['text', 'form']);
    });

    it('should return null when no data exists', async () => {
      vi.spyOn(menuIdevicesBottom, 'openDB').mockResolvedValue(mockDB);

      let capturedRequest;
      mockStore.get.mockImplementation(() => {
        capturedRequest = {
          onsuccess: null,
          onerror: null,
          result: null,
        };
        return capturedRequest;
      });

      const promise = menuIdevicesBottom.getIdevices();

      // Wait for promise to set up handlers
      await Promise.resolve();

      // Simulate IndexedDB calling onsuccess
      if (capturedRequest.onsuccess) {
        capturedRequest.onsuccess();
      }

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      vi.spyOn(menuIdevicesBottom, 'openDB').mockResolvedValue(mockDB);

      let capturedRequest;
      mockStore.get.mockImplementation(() => {
        capturedRequest = {
          onsuccess: null,
          onerror: null,
        };
        return capturedRequest;
      });

      const promise = menuIdevicesBottom.getIdevices();

      // Wait for promise to set up handlers
      await Promise.resolve();

      // Simulate IndexedDB calling onerror
      if (capturedRequest.onerror) {
        capturedRequest.onerror();
      }

      const result = await promise;
      expect(result).toBeNull();
    });
  });
});
