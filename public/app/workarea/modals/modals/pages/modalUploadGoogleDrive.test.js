import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalUploadtodrive from './modalUploadGoogleDrive.js';

describe('ModalUploadtodrive', () => {
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
            odeSession: 'sess-drive',
            odeId: 'ode-drive',
            odeVersion: '1.0'
        },
        api: {
          uploadFileGoogleDrive: vi.fn().mockResolvedValue({ status: 'OK', statusMsg: 'Success Drive' }),
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
    mockElement.id = 'modalUploadToDrive';
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
      if (id === 'modalUploadToDrive') return mockElement;
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

    modal = new ModalUploadtodrive(mockManager);
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
          { id: 'd1', name: 'Drive B' },
          { id: 'd2', name: 'Drive A' }
        ]
      };
      modal.show(files);
      vi.advanceTimersByTime(500);
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Upload to Google Drive');
      const select = mockElement.querySelector('select#drive-folders');
      expect(select).not.toBeNull();
      expect(select.querySelectorAll('option').length).toBe(3);
      expect(select.querySelectorAll('option')[1].text).toBe('Drive A');
      vi.useRealTimers();
    });
  });

  describe('uploadFile', () => {
    it('should call api and show alert', async () => {
      vi.useFakeTimers();
      const files = { files: [{ id: 'd1', name: 'D1' }] };
      modal.show(files);
      vi.advanceTimersByTime(500);
      
      // Mock querySelector for the specific call in uploadFile
      const originalQuerySelector = modal.modalElementBody.querySelector;
      modal.modalElementBody.querySelector = vi.fn().mockImplementation((selector) => {
        if (selector === 'select#drive-folders option:checked') {
          return { value: 'd1' };
        }
        return originalQuerySelector.call(modal.modalElementBody, selector);
      });
      
      await modal.uploadFile();
      
      expect(window.eXeLearning.app.api.uploadFileGoogleDrive).toHaveBeenCalled();
      
      vi.advanceTimersByTime(300);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
