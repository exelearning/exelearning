import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalOdeUsedFiles from './modalOdeUsedFiles.js';

describe('ModalOdeUsedFiles', () => {
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
        project: { odeSession: 'test-session' },
        api: {
          getOdeSessionUsedFiles: vi.fn().mockResolvedValue({ usedFiles: [] }),
          app: {
            menus: {
              navbar: {
                utilities: {
                  json2Csv: vi.fn().mockReturnValue('csv-content'),
                }
              }
            }
          }
        },
      },
    };

    // Mock URL.createObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalOdeUsedFiles';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary">End</button>
        <button class="close btn btn-secondary">Cancel</button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalOdeUsedFiles') return mockElement;
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

    modal = new ModalOdeUsedFiles(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('makeTbodyElements', () => {
    it('should create table rows from used files data', () => {
      const data = {
        usedFiles: [
          {
            usedFiles: 'image.png',
            usedFilesPath: '/resources',
            usedFilesSize: '100KB',
            pageNamesUsedFiles: 'Home',
            blockNamesUsedFiles: 'Header',
            typeComponentSyncUsedFiles: 'Image',
            orderComponentSyncUsedFiles: 1
          }
        ]
      };
      const tbody = modal.makeTbodyElements(data);
      expect(tbody.querySelectorAll('tr').length).toBe(1);
      expect(tbody.querySelector('td').textContent).toBe('image.png');
    });
  });

  describe('show', () => {
    it('should set title and body content', async () => {
      vi.useFakeTimers();
      modal.show({ usedFiles: [] });
      vi.advanceTimersByTime(500);
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Resource Report');
      expect(mockElement.querySelector('table')).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('downloadCsv', () => {
    it('should call api and trigger download', async () => {
      await modal.downloadCsv();
      expect(window.eXeLearning.app.api.getOdeSessionUsedFiles).toHaveBeenCalled();
      expect(window.eXeLearning.app.api.app.menus.navbar.utilities.json2Csv).toHaveBeenCalled();
    });
  });
});
