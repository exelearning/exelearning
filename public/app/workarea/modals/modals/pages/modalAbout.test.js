import ModalAbout from './modalAbout.js';

describe('ModalAbout', () => {
  let modalAbout;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;
  let mockLogo;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn(key => key);

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalAbout';
    mockElement.innerHTML = `
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
      <div class="exe-logo"></div>
      <button class="close btn btn-secondary"></button>
    `;
    mockLogo = mockElement.querySelector('.exe-logo');
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id => {
      if (id === 'modalAbout') return mockElement;
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
      easteregg: {
        show: vi.fn(),
      },
    };

    modalAbout = new ModalAbout(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID', () => {
      expect(modalAbout.id).toBe('modalAbout');
    });
  });

  describe('easter egg (clicks)', () => {
    it('should trigger easter egg after 7 clicks', () => {
      modalAbout.behaviour();
      mockElement.setAttribute('data-open', 'true');
      
      const triggerSpy = vi.spyOn(modalAbout, 'triggerEasterEgg');
      
      for(let i = 0; i < 7; i++) {
        mockLogo.click();
      }
      
      expect(triggerSpy).toHaveBeenCalled();
    });
  });

  describe('easter egg (keys)', () => {
    it('should trigger easter egg after typing "aula"', () => {
      modalAbout.behaviour();
      mockElement.setAttribute('data-open', 'true');
      
      const triggerSpy = vi.spyOn(modalAbout, 'triggerEasterEgg');
      
      ['a', 'u', 'l', 'a'].forEach(key => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      });
      
      expect(triggerSpy).toHaveBeenCalled();
    });
  });

  describe('triggerEasterEgg', () => {
    it('should close current modal and show easter egg', () => {
      modalAbout.triggerEasterEgg();
      
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
      
      // Simulate modal hidden event
      const event = new CustomEvent('hidden.bs.modal');
      mockElement.dispatchEvent(event);
      
      expect(mockManager.easteregg.show).toHaveBeenCalled();
    });
  });
});
