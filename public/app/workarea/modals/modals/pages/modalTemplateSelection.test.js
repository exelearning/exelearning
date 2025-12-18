import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import modalTemplateSelection from './modalTemplateSelection.js';

describe('modalTemplateSelection', () => {
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
        locale: { lang: 'en' },
        api: {
          getTemplates: vi.fn().mockResolvedValue([
            { name: 'Template 1', path: 'path/1' },
            { name: 'Template 2', path: 'path/2' }
          ]),
        },
        modals: {
          openuserodefiles: {
            largeFilesUpload: vi.fn().mockResolvedValue(true),
          },
          alert: {
            show: vi.fn(),
          },
        },
      },
    };

    // Mock global fetch
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/octet-stream' })),
    });

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalTemplateSelection';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body">
        <div class="modal-body-content"></div>
        <div id="template-list"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary">Confirm</button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalTemplateSelection') return mockElement;
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
      closeModals: vi.fn(() => false),
    };

    modal = new modalTemplateSelection(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should fetch templates and render list', async () => {
      vi.useFakeTimers();
      modal.show();
      vi.advanceTimersByTime(500);
      
      // Need to wait for async fetchTemplates within setTimeout
      await Promise.resolve(); // for fetchTemplates
      await Promise.resolve(); // for renderTemplateList
      
      expect(window.eXeLearning.app.api.getTemplates).toHaveBeenCalled();
      const items = mockElement.querySelectorAll('.list-group-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Template 1');
      vi.useRealTimers();
    });
  });

  describe('selectTemplate', () => {
    it('should enable confirm button when template is selected', () => {
      const template = { name: 'T1', path: 'P1' };
      modal.selectTemplate(template);
      expect(modal.selectedTemplate).toBe(template);
      expect(modal.confirmButton.disabled).toBe(false);
    });
  });

  describe('loadTemplate', () => {
    it('should fetch template blob and call largeFilesUpload', async () => {
      const template = { name: 'T1', path: 'P1' };
      await modal.loadTemplate(template);
      
      expect(window.fetch).toHaveBeenCalledWith('P1');
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalled();
    });
  });
});
