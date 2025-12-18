import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalAssistant from './modalAssistant.js';

describe('ModalAssistant', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalAssistant';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body">
        <div class="body-content"></div>
        <icon class="show-tabs"></icon>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalAssistant') return mockElement;
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

    modal = new ModalAssistant(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID', () => {
      expect(modal.id).toBe('modalAssistant');
    });
  });

  describe('show', () => {
    it('should show the modal after a timeout', async () => {
      vi.useFakeTimers();
      modal.show();
      vi.advanceTimersByTime(500);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('setBodyContent', () => {
    it('should set the innerHTML of the body content', () => {
      const html = '<span>Assistant Help</span>';
      modal.setBodyContent(html);
      expect(mockElement.querySelector('.body-content').innerHTML).toBe(html);
    });
  });

  describe('generateBodyElement', () => {
    it('should generate tabs and content based on translations', () => {
      window._.mockImplementation((key) => {
        if (key === 'workarea.help.assistant.tab.1.title.html') return 'Intro';
        if (key === 'workarea.help.assistant.tab.1.content.html') return 'Welcome';
        return key;
      });

      const body = modal.generateBodyElement();
      const tabs = body.querySelectorAll('.exe-tab');
      expect(tabs.length).toBe(1);
      expect(tabs[0].innerHTML).toContain('1. Intro');
    });
  });

  describe('addBehaviourShowTabsButton', () => {
    it('should toggle show-tabs class on body-content when icon is clicked', () => {
      const icon = mockElement.querySelector('icon.show-tabs');
      const bodyContent = mockElement.querySelector('.body-content');
      
      icon.click();
      expect(bodyContent.classList.contains('show-tabs')).toBe(true);
      
      icon.click();
      expect(bodyContent.classList.contains('show-tabs')).toBe(false);
    });
  });
});
