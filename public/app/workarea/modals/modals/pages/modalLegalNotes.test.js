import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalLegalNotes from './modalLegalNotes.js';

describe('ModalLegalNotes', () => {
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
          getThirdPartyCodeText: vi.fn().mockResolvedValue('third party content'),
          getLicensesList: vi.fn().mockResolvedValue('licenses list'),
        },
        common: {
          markdownToHTML: vi.fn((text) => `<p>${text}</p>`),
        },
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalLegalNotes';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body">
        <div class="body-content"></div>
        <div id="modalLegalNotes">
           <div class="third-party-content"></div>
           <div class="licenses-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalLegalNotes') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function () {
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

    modal = new ModalLegalNotes(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with correct ID', () => {
      expect(modal.id).toBe('modalLegalNotes');
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
      const html = '<span>Test Content</span>';
      modal.setBodyContent(html);
      expect(mockElement.querySelector('.body-content').innerHTML).toBe(html);
    });
  });

  describe('generateBodyElement', () => {
    it('should generate tabs and content based on translations', () => {
      // Setup mock translations for 2 tabs
      window._.mockImplementation((key) => {
        if (key === 'workarea.help.legalnotes.tab.1.title.html') return 'Tab 1';
        if (key === 'workarea.help.legalnotes.tab.1.content.html') return 'Content 1';
        if (key === 'workarea.help.legalnotes.tab.2.title.html') return 'Tab 2';
        if (key === 'workarea.help.legalnotes.tab.2.content.html') return 'Content 2';
        return key;
      });

      const body = modal.generateBodyElement();
      const tabs = body.querySelectorAll('.exe-tab');
      const contents = body.querySelectorAll('.exe-form-content');

      expect(tabs.length).toBe(2);
      expect(contents.length).toBe(2);
      expect(tabs[0].innerHTML).toBe('Tab 1');
      expect(contents[0].innerHTML).toBe('Content 1');
    });
  });

  describe('load', () => {
    it('should load third party code and licenses', async () => {
      await modal.load();
      
      expect(window.eXeLearning.app.api.getThirdPartyCodeText).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.getLicensesList).toHaveBeenCalled();
      
      const thirdPartyViewer = mockElement.querySelector('.third-party-content');
      const licensesViewer = mockElement.querySelector('.licenses-list');
      
      expect(thirdPartyViewer.innerHTML).toContain('third party content');
      expect(licensesViewer.innerHTML).toContain('licenses list');
    });
  });

  describe('hasTranslation', () => {
    it('should return true if translation exists and is different from key', () => {
      window._.mockImplementation((key) => {
        if (key === 'exists') return 'Translated';
        return key;
      });
      expect(modal.hasTranslation('exists')).toBe(true);
      expect(modal.hasTranslation('not-exists')).toBe(false);
    });
  });
});
