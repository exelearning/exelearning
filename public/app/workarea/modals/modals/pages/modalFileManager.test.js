import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalFilemanager from './modalFileManager.js';

describe('ModalFilemanager', () => {
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
            odeId: 'proj-123',
            _yjsBridge: {
                assetManager: {
                    getProjectAssets: vi.fn().mockResolvedValue([]),
                    formatFileSize: vi.fn(b => `${b} bytes`),
                    blobURLCache: { get: vi.fn(), set: vi.fn() },
                    reverseBlobCache: { set: vi.fn() }
                }
            }
        },
        modals: {
          alert: { show: vi.fn() }
        }
      }
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalFileManager';
    mockElement.innerHTML = `
      <div class="media-library-grid"></div>
      <table class="media-library-list"><thead><th data-sort="name"></th></thead><tbody></tbody></table>
      <div class="media-library-sidebar">
        <div class="media-library-sidebar-empty"></div>
        <div class="media-library-sidebar-content"></div>
      </div>
      <button class="media-library-upload-btn">Upload</button>
      <input class="media-library-upload-input" type="file">
      <input class="media-library-search">
      <button class="media-library-delete-btn">Delete</button>
      <button class="media-library-insert-btn">Insert</button>
      <div class="media-library-view-btn" data-view="grid"></div>
      <div class="media-library-view-btn" data-view="list"></div>
      <select class="media-library-sort"></select>
      <div class="media-library-page-info"></div>
      <button class="media-library-page-btn" data-action="prev"></button>
      <button class="media-library-page-btn" data-action="next"></button>
      
      <img class="media-library-preview-img">
      <video class="media-library-preview-video"></video>
      <audio class="media-library-preview-audio"></audio>
      <div class="media-library-preview-file"></div>
      <iframe class="media-library-preview-pdf"></iframe>
      
      <input class="media-library-filename">
      <span class="media-library-type"></span>
      <span class="media-library-size"></span>
      <div class="media-library-dimensions-row"><span class="media-library-dimensions"></span></div>
      <span class="media-library-date"></span>
      <input class="media-library-url">

      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body"></div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalFileManager') return mockElement;
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
    window.bootstrap.Modal.getInstance = vi.fn(() => mockBootstrapModal);

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

    modal = new ModalFilemanager(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should initialize and show modal', async () => {
      vi.useFakeTimers();
      await modal.show();
      vi.advanceTimersByTime(500);
      
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      expect(modal.assetManager).toBeDefined();
      vi.useRealTimers();
    });
  });

  describe('initElements', () => {
      it('should find DOM elements', () => {
          modal.initElements();
          expect(modal.grid).not.toBeNull();
          expect(modal.uploadBtn).not.toBeNull();
      });
  });
});
