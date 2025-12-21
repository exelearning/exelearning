import ToastManagement from './toastsManager.js';
import Toast from './toasts/toast.js';
import ToastDefault from './toasts/generic/toastDefault.js';

// Mock Toast as a class
vi.mock('./toasts/toast.js', () => {
  return {
    default: vi.fn().mockImplementation(function(manager, id) {
      this.manager = manager;
      this.id = id;
      this.show = vi.fn();
      this.hide = vi.fn();
      this.remove = vi.fn();
    })
  };
});

// Mock ToastDefault as a class extending Toast
vi.mock('./toasts/generic/toastDefault.js', () => {
  return {
    default: vi.fn().mockImplementation(function(manager) {
      this.manager = manager;
      this.toastElement = {
        cloneNode: vi.fn(),
        id: 'toastDefault',
      };
    })
  };
});

describe('ToastManagement', () => {
  let toastManager;
  let mockApp;
  let mockToastElement;
  let mockClonedElement;
  let mockContainer;

  beforeEach(() => {
    // Mock app
    mockApp = {
      common: {
        generateId: vi.fn(() => '20251218123456789ABC'),
      },
    };

    // Mock global eXeLearning
    window.eXeLearning = {
      app: mockApp,
    };

    // Mock DOM elements
    mockToastElement = {
      cloneNode: vi.fn(),
      id: 'toastDefault',
    };

    mockClonedElement = {
      id: '',
    };

    mockContainer = {
      append: vi.fn(),
    };

    mockToastElement.cloneNode.mockReturnValue(mockClonedElement);

    vi.spyOn(document, 'querySelector').mockReturnValue(mockContainer);

    toastManager = new ToastManagement(mockApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.eXeLearning;
  });

  describe('constructor', () => {
    it('should store app reference', () => {
      expect(toastManager.app).toBe(mockApp);
    });

    it('should initialize default to null', () => {
      expect(toastManager.default).toBeNull();
    });
  });

  describe('init', () => {
    beforeEach(() => {
      // Update mock to return the mockToastElement when default is created
      ToastDefault.mockImplementation(function(manager) {
        this.manager = manager;
        this.toastElement = mockToastElement;
      });
    });

    it('should create a ToastDefault instance', () => {
      toastManager.init();

      expect(ToastDefault).toHaveBeenCalledWith(toastManager);
      expect(toastManager.default).toBeDefined();
    });

    it('should store the ToastDefault instance in default property', () => {
      toastManager.init();

      expect(toastManager.default).not.toBeNull();
      expect(toastManager.default.manager).toBe(toastManager);
    });
  });

  describe('createToast', () => {
    beforeEach(() => {
      toastManager.init();
    });

    it('should generate a temporary toast ID', () => {
      const data = { title: 'Test', body: 'Test body' };
      toastManager.createToast(data);

      expect(mockApp.common.generateId).toHaveBeenCalled();
    });

    it('should clone the default toast element', () => {
      const data = { title: 'Test' };
      toastManager.createToast(data);

      expect(mockToastElement.cloneNode).toHaveBeenCalledWith(true);
    });

    it('should set the ID on the cloned element', () => {
      const data = { title: 'Test' };
      toastManager.createToast(data);

      expect(mockClonedElement.id).toBe('tmp-toast-20251218123456789ABC');
    });

    it('should append the cloned element to the toasts container', () => {
      const data = { title: 'Test' };
      toastManager.createToast(data);

      expect(document.querySelector).toHaveBeenCalledWith('body > .toasts-container');
      expect(mockContainer.append).toHaveBeenCalledWith(mockClonedElement);
    });

    it('should create a new Toast instance with the temporary ID', () => {
      const data = { title: 'Test' };
      toastManager.createToast(data);

      expect(Toast).toHaveBeenCalledWith(toastManager, 'tmp-toast-20251218123456789ABC');
    });

    it('should call show on the new toast with the data', () => {
      const data = { title: 'Test', body: 'Test body' };
      const toast = toastManager.createToast(data);

      expect(toast.show).toHaveBeenCalledWith(data);
    });

    it('should return the created toast instance', () => {
      const data = { title: 'Test' };
      const toast = toastManager.createToast(data);

      expect(toast).toBeDefined();
      expect(toast.id).toBe('tmp-toast-20251218123456789ABC');
      expect(toast.manager).toBe(toastManager);
    });

    it('should handle empty data object', () => {
      const toast = toastManager.createToast({});

      expect(toast).toBeDefined();
      expect(toast.show).toHaveBeenCalledWith({});
    });

    it('should handle data with all properties', () => {
      const data = {
        title: 'Success',
        body: 'Operation completed',
        icon: 'check_circle',
        error: false,
        remove: 3000,
      };

      const toast = toastManager.createToast(data);

      expect(toast.show).toHaveBeenCalledWith(data);
    });

    it('should create unique IDs for multiple toasts', () => {
      mockApp.common.generateId
        .mockReturnValueOnce('ID1')
        .mockReturnValueOnce('ID2')
        .mockReturnValueOnce('ID3');

      const toast1 = toastManager.createToast({ title: 'Toast 1' });
      const toast2 = toastManager.createToast({ title: 'Toast 2' });
      const toast3 = toastManager.createToast({ title: 'Toast 3' });

      expect(toast1.id).toBe('tmp-toast-ID1');
      expect(toast2.id).toBe('tmp-toast-ID2');
      expect(toast3.id).toBe('tmp-toast-ID3');
    });
  });

  describe('integration', () => {
    it('should init and create toast in sequence', () => {
      toastManager.init();
      expect(toastManager.default).not.toBeNull();

      const toast = toastManager.createToast({ title: 'Test' });
      expect(toast).toBeDefined();
      expect(toast.show).toHaveBeenCalled();
    });

    it('should be able to create multiple toasts', () => {
      toastManager.init();

      const toast1 = toastManager.createToast({ title: 'First' });
      const toast2 = toastManager.createToast({ title: 'Second' });

      expect(mockContainer.append).toHaveBeenCalledTimes(2);
      expect(Toast).toHaveBeenCalledTimes(2);
    });
  });
});
