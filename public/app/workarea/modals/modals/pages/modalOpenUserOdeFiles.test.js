import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import modalOpenUserOdeFiles from './modalOpenUserOdeFiles.js';

// Mock ImportProgress
vi.mock('../../../interface/importProgress.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    hide: vi.fn()
  }))
}));

describe('modalOpenUserOdeFiles', () => {
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
          getUploadLimits: vi.fn().mockResolvedValue({
              maxFileSize: 1024 * 1024,
              maxFileSizeFormatted: '1 MB'
          }),
          getOdeUserFiles: vi.fn().mockResolvedValue([])
        },
        modals: {
          alert: { show: vi.fn() }
        }
      }
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalOpenUserOdeFiles';
    mockElement.innerHTML = `
      <div class="modal-body-content"></div>
      <div class="modal-footer"></div>
      <button class="btn btn-primary">Open</button>
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalOpenUserOdeFiles') return mockElement;
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

    modal = new modalOpenUserOdeFiles(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('loadUploadLimits', () => {
    it('should fetch limits from API', async () => {
      await modal.loadUploadLimits();
      expect(window.eXeLearning.app.api.getUploadLimits).toHaveBeenCalled();
      expect(modal.uploadLimits.maxFileSize).toBe(1024 * 1024);
    });
  });

  describe('validateFileSize', () => {
    it('should return true if file is within limits', async () => {
      await modal.loadUploadLimits();
      const file = { size: 512 * 1024 };
      expect(modal.validateFileSize(file)).toBe(true);
    });

    it('should return false and show alert if file exceeds limits', async () => {
      await modal.loadUploadLimits();
      const file = { size: 2 * 1024 * 1024 };
      expect(modal.validateFileSize(file)).toBe(false);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(modal.formatBytes(1024)).toBe('1.00 KB');
      expect(modal.formatBytes(1024 * 1024)).toBe('1.00 MB');
    });
  });
});
