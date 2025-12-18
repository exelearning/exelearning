import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalUploadtodropbox from './modalUploadDropbox.js';

describe('ModalUploadtodropbox', () => {
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
        project: { 
            odeSession: 'sess-123',
            odeId: 'ode-123',
            odeVersion: '1.0'
        },
        api: {
          uploadFileDropbox: vi.fn().mockResolvedValue({ status: 'Success', statusMsg: 'Uploaded' }),
        },
        modals: {
          alert: {
            show: vi.fn(),
          },
        },
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalUploadToDropbox';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary">Upload</button>
        <button class="close btn btn-secondary">Cancel</button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalUploadToDropbox') return mockElement;
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

    modal = new ModalUploadtodropbox(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should set title and generate body with folders', async () => {
      vi.useFakeTimers();
      const files = {
        files: [
          { id: 'f1', name: 'Folder B' },
          { id: 'f2', name: 'Folder A' }
        ]
      };
      modal.show(files);
      vi.advanceTimersByTime(500);
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Upload to Dropbox');
      const select = mockElement.querySelector('select#dropbox-folders');
      expect(select).not.toBeNull();
      // Root + 2 folders
      expect(select.querySelectorAll('option').length).toBe(3);
      // Check sorting: Folder A should be before Folder B
      expect(select.querySelectorAll('option')[1].text).toBe('Folder A');
      vi.useRealTimers();
    });
  });

  describe('uploadFile', () => {
    it('should call api and show alert', async () => {
      vi.useFakeTimers();
      const files = { files: [{ id: 'f1', name: 'F1' }] };
      modal.show(files);
      vi.advanceTimersByTime(500);
      
      // Mock querySelector for the specific call in uploadFile
      const originalQuerySelector = modal.modalElementBody.querySelector;
      modal.modalElementBody.querySelector = vi.fn().mockImplementation((selector) => {
        if (selector === 'select#dropbox-folders option:checked') {
          return { value: 'f1' };
        }
        return originalQuerySelector.call(modal.modalElementBody, selector);
      });
      
      await modal.uploadFile();
      
      expect(window.eXeLearning.app.api.uploadFileDropbox).toHaveBeenCalledWith(expect.objectContaining({
        folder: 'f1',
        odeSessionId: 'sess-123'
      }));
      
      vi.advanceTimersByTime(300);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith({
        title: 'Success',
        body: 'Uploaded'
      });
      vi.useRealTimers();
    });
  });
});
