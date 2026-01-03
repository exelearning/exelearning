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
          getTemplates: vi.fn().mockResolvedValue({
            templates: [
              { name: 'Template 1', path: 'path/1' },
              { name: 'Template 2', path: 'path/2' }
            ],
            locale: 'en',
            supportedLocales: ['en', 'es']
          }),
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

  describe('fetchTemplates', () => {
    it('should handle errors and reset templates', async () => {
      window.eXeLearning.app.api.getTemplates.mockRejectedValue(new Error('fail'));
      await modal.fetchTemplates();
      expect(modal.templates).toEqual([]);
    });
  });

  describe('renderTemplateList', () => {
    it('should render empty state when no templates', () => {
      modal.templates = [];
      modal.renderTemplateList();

      const emptyMessage = mockElement.querySelector('.alert.alert-info');
      expect(emptyMessage).not.toBeNull();
      expect(emptyMessage.textContent).toBe('No templates available for your language.');
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

  describe('confirm button', () => {
    it('should call loadTemplate when selectedTemplate exists', () => {
      const template = { name: 'T1', path: 'P1' };
      const loadSpy = vi.spyOn(modal, 'loadTemplate').mockResolvedValue();

      modal.selectTemplate(template);
      modal.confirmButton.click();

      expect(loadSpy).toHaveBeenCalledWith(template);
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

    it('should clear saved path when electron API is available', async () => {
      vi.useFakeTimers();
      window.__originalElpPath = '/tmp/original.elpx';
      window.__currentProjectId = 'project-1';
      window.electronAPI = {
        clearSavedPath: vi.fn().mockResolvedValue(true),
      };

      const template = { name: 'T1', path: 'P1' };
      const loadPromise = modal.loadTemplate(template);
      await vi.runAllTimersAsync();
      await loadPromise;

      expect(window.__originalElpPath).toBeUndefined();
      expect(window.electronAPI.clearSavedPath).toHaveBeenCalledWith('project-1');
      vi.useRealTimers();
    });

    it('should show alert when fetch fails', async () => {
      window.fetch.mockResolvedValue({ ok: false });

      const template = { name: 'T1', path: 'P1' };
      await modal.loadTemplate(template);

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
        title: 'Error',
        message: 'Failed to load template. Please try again.',
      });
    });
  });
});
