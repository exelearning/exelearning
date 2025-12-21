import ModalInfo from './modalInfo.js';

describe('ModalInfo', () => {
  let modalInfo;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalInfo';
    mockElement.innerHTML = `
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
      <button class="close btn btn-secondary"></button>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id => {
      if (id === 'modalInfo') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
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

    mockManager = {
      closeModals: vi.fn(() => false),
    };

    modalInfo = new ModalInfo(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID and title', () => {
      expect(modalInfo.id).toBe('modalInfo');
      expect(modalInfo.titleDefault).toBe('Info');
      expect(modalInfo.clearAfterClose).toBe(true);
    });
  });

  describe('show', () => {
    it('should call bootstrap show and set content', () => {
      vi.useFakeTimers();
      modalInfo.show({ title: 'New Title', body: 'New Body' });
      
      vi.advanceTimersByTime(50); // Default timeMin
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('New Title');
      expect(mockElement.querySelector('.modal-body').innerHTML).toBe('New Body');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
