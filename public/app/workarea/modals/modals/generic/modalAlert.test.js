import ModalAlert from './modalAlert.js';

describe('ModalAlert', () => {
  let modalAlert;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn(key => key);

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalAlert';
    mockElement.innerHTML = `
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
      <button class="close btn btn-secondary"></button>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id => {
      if (id === 'modalAlert') return mockElement;
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

    modalAlert = new ModalAlert(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID and title', () => {
      expect(modalAlert.id).toBe('modalAlert');
      expect(modalAlert.titleDefault).toBe('Alert');
    });
  });

  describe('show', () => {
    it('should set content and show modal', () => {
      vi.useFakeTimers();
      modalAlert.show({ title: 'Attention', body: 'Error occurred' });
      
      vi.advanceTimersByTime(50);
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Attention');
      expect(mockElement.querySelector('.modal-body').innerHTML).toBe('Error occurred');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
