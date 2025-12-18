import ModalLopd from './modalLopd.js';

describe('ModalLopd', () => {
  let modalLopd;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn(key => key);

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalLopd';
    mockElement.innerHTML = `
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
      <button class="btn btn-primary">Accept</button>
      <div id="node-content-container" style="display: none;"></div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id => {
      if (id === 'modalLopd') return mockElement;
      return null;
    });

    vi.spyOn(document, 'querySelector').mockImplementation(selector => {
      if (selector === 'button.btn.btn-primary') return mockElement.querySelector('button.btn.btn-primary');
      if (selector === '#node-content-container') return mockElement.querySelector('#node-content-container');
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
      _config: {},
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };

    // Mock interact
    const mockInteractable = {
      draggable: vi.fn().mockReturnThis(),
    };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        loadProject: vi.fn().mockResolvedValue(undefined),
        check: vi.fn(),
      },
    };

    mockManager = {
      closeModals: vi.fn(() => false),
      app: {
        api: {
          postUserSetLopdAccepted: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
        }
      }
    };

    modalLopd = new ModalLopd(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID and permanent state', () => {
      expect(modalLopd.id).toBe('modalLopd');
      expect(modalLopd.permanent).toBe(true);
    });
  });

  describe('show', () => {
    it('should configure modal as static and show it', () => {
      modalLopd.show();
      
      expect(mockBootstrapModal._config.keyboard).toBe(false);
      expect(mockBootstrapModal._config.backdrop).toBe('static');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('should call setLopdAccepted via confirmExec', async () => {
      modalLopd.show();
      const setLopdAcceptedSpy = vi.spyOn(modalLopd, 'setLopdAccepted');
      
      modalLopd.confirm();
      
      expect(setLopdAcceptedSpy).toHaveBeenCalled();
    });
  });

  describe('setLopdAccepted', () => {
    it('should call API and load project on success', async () => {
      const loadProjectSpy = vi.spyOn(modalLopd, 'loadProjectLopdAccepted');
      
      await modalLopd.setLopdAccepted();
      
      expect(mockManager.app.api.postUserSetLopdAccepted).toHaveBeenCalled();
      expect(loadProjectSpy).toHaveBeenCalled();
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
    });
  });

  describe('loadProjectLopdAccepted', () => {
    it('should call eXeLearning loadProject and show content container', async () => {
      await modalLopd.loadProjectLopdAccepted();
      
      expect(window.eXeLearning.app.loadProject).toHaveBeenCalled();
      expect(document.querySelector('#node-content-container').style.display).toBe('');
      expect(window.eXeLearning.app.check).toHaveBeenCalled();
    });
  });
});
