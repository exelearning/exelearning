import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalEasterEgg from './modalEasterEgg.js';
import AulaSecreta3D from '../../../easteregg/aulaSecreta3d.js';

vi.mock('../../../easteregg/aulaSecreta3d.js', () => {
  const mockGame = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    default: vi.fn().mockImplementation(function() {
      return mockGame;
    }),
  };
});

describe('ModalEasterEgg', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalEasterEgg';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body">
        <canvas data-easteregg="canvas"></canvas>
        <div data-easteregg="stats"></div>
        <div data-easteregg="timer"></div>
        <div data-easteregg="overlay"></div>
        <div data-easteregg="overlay-title"></div>
        <div data-easteregg="overlay-text"></div>
        <button data-easteregg="start"></button>
        <button data-easteregg="close"></button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalEasterEgg') return mockElement;
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

    modal = new ModalEasterEgg(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('behaviour', () => {
    it('should initialize and set canvas tabindex', () => {
      modal.behaviour();
      const canvas = mockElement.querySelector('[data-easteregg="canvas"]');
      expect(canvas.getAttribute('tabindex')).toBe('0');
    });

    it('should start game on shown event', () => {
      modal.behaviour();
      const startGameSpy = vi.spyOn(modal, 'startGame');
      
      const event = new CustomEvent('shown.bs.modal');
      mockElement.dispatchEvent(event);
      
      expect(startGameSpy).toHaveBeenCalled();
    });

    it('should stop game on hidden event', () => {
      modal.behaviour();
      const stopGameSpy = vi.spyOn(modal, 'stopGame');
      
      const event = new CustomEvent('hidden.bs.modal');
      mockElement.dispatchEvent(event);
      
      expect(stopGameSpy).toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should set title and show modal', () => {
      vi.useFakeTimers();
      modal.show();
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Aula Secreta');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('startGame', () => {
    it('should create and start game', () => {
      modal.behaviour();
      modal.startGame();
      
      expect(AulaSecreta3D).toHaveBeenCalled();
      expect(modal.game.start).toHaveBeenCalled();
    });
  });

  describe('stopGame', () => {
    it('should stop game if it exists', () => {
      modal.behaviour();
      modal.startGame();
      modal.stopGame();
      
      expect(modal.game.stop).toHaveBeenCalled();
    });
  });
});
