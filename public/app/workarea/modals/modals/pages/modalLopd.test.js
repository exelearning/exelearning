import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalLopd from './modalLopd.js';

describe('ModalLopd', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        api: {
          postUserSetLopdAccepted: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
        },
        loadProject: vi.fn().mockResolvedValue(true),
        check: vi.fn(),
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalLopd';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary">Accept</button>
      </div>
      <div id="node-content-container" style="display: none;"></div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalLopd') return mockElement;
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

    mockManager = {
      app: window.eXeLearning.app,
      closeModals: vi.fn(() => false),
    };

    modal = new ModalLopd(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should set title and configure static backdrop', () => {
      modal.show();
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('eXeLearning');
      expect(mockBootstrapModal._config.keyboard).toBe(false);
      expect(mockBootstrapModal._config.backdrop).toBe('static');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
    });
  });

  describe('setLopdAccepted', () => {
    it('should call api and load project on success', async () => {
      await modal.setLopdAccepted();
      await Promise.resolve(); // Wait for the .then() block
      
      expect(mockManager.app.api.postUserSetLopdAccepted).toHaveBeenCalled();
      expect(window.eXeLearning.app.loadProject).toHaveBeenCalled();
      expect(window.eXeLearning.app.check).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('should call confirmExec (which calls setLopdAccepted) when confirm is called', () => {
      const spy = vi.spyOn(modal, 'setLopdAccepted');
      modal.show();
      modal.confirm();
      expect(spy).toHaveBeenCalled();
    });
  });
});