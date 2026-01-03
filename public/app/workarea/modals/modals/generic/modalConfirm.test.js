import ModalConfirm from './modalConfirm.js';

describe('ModalConfirm', () => {
  let modalConfirm;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn(key => key);

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalConfirm';
    mockElement.innerHTML = `
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
      <button class="btn button-primary">Yes</button>
      <button class="cancel btn button-tertiary">No</button>
      <button class="confirm"></button>
      <button class="close"></button>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id => {
      if (id === 'modalConfirm') return mockElement;
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

    modalConfirm = new ModalConfirm(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID and button text', () => {
      expect(modalConfirm.id).toBe('modalConfirm');
      expect(modalConfirm.confirmButtonDefaultText).toBe('Yes');
      expect(modalConfirm.cancelButtonDefaultText).toBe('No');
    });
  });

  describe('show', () => {
    it('should set content and show modal', () => {
      vi.useFakeTimers();
      const mockConfirmExec = vi.fn();
      modalConfirm.show({ 
        body: 'This action is permanent.',
        confirmExec: mockConfirmExec
      });
      
      vi.advanceTimersByTime(50);
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Confirm');
      expect(mockElement.querySelector('.modal-body').innerHTML).toBe('This action is permanent.');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      expect(modalConfirm.confirmExec).toBe(mockConfirmExec);
      vi.useRealTimers();
    });

    it('should handle custom button text', () => {
      vi.useFakeTimers();
      modalConfirm.show({ 
        confirmButtonText: 'Delete',
        cancelButtonText: 'Abort'
      });
      
      vi.advanceTimersByTime(50);
      
      expect(modalConfirm.confirmButton.innerHTML).toBe('Delete');
      expect(modalConfirm.cancelButton.innerHTML).toBe('Abort');
      vi.useRealTimers();
    });
  });

  describe('confirm', () => {
    it('should call confirmExec and close modal', async () => {
      vi.useFakeTimers();
      const mockConfirmExec = vi.fn();
      modalConfirm.setConfirmExec(mockConfirmExec);
      
      await modalConfirm.confirm();
      
      expect(mockConfirmExec).toHaveBeenCalled();
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('input behaviour and focus', () => {
    it('should trigger confirm on Enter for text inputs', () => {
      const input = document.createElement('input');
      input.type = 'text';
      modalConfirm.modalElementBody.appendChild(input);

      const confirmSpy = vi.spyOn(modalConfirm, 'confirm').mockImplementation(() => Promise.resolve());
      modalConfirm.setConfirmExec(() => {});

      modalConfirm.addBehaviourTextInputs();
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expect(confirmSpy).toHaveBeenCalled();
    });

    it('should focus cancel button when requested', () => {
      vi.useFakeTimers();
      modalConfirm.cancelButton.focus = vi.fn();

      modalConfirm.show({ focusCancelButton: true });

      vi.advanceTimersByTime(550);
      expect(modalConfirm.cancelButton.focus).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should preserve input value when focusing text input', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Keep me';
      input.focus = vi.fn();

      modalConfirm.focusTextInput(input);

      expect(input.focus).toHaveBeenCalled();
      expect(input.value).toBe('Keep me');
    });
  });
});
