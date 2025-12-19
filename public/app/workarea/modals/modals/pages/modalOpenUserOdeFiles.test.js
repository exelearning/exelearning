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
          getOdeUserFiles: vi.fn().mockResolvedValue([]),
          getUserOdeFiles: vi.fn().mockResolvedValue({ odeFiles: { odeFilesSync: {} } }),
          apiUrlBase: 'http://localhost',
          apiUrlBasePath: '/exelearning'
        },
        modals: {
          alert: { show: vi.fn() }
        }
      },
      symfony: { basePath: '/exelearning' }
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalOpenUserOdeFiles';
    mockElement.innerHTML = `
      <button class="btn btn-primary">Open</button>
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body">
        <div class="modal-body-content"></div>
      </div>
      <div class="modal-footer"></div>
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

    const storage = {};
    global.localStorage = {
      getItem: vi.fn((key) => (key in storage ? storage[key] : null)),
      setItem: vi.fn((key, value) => {
        storage[key] = String(value);
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach((key) => delete storage[key]);
      }),
      removeItem: vi.fn((key) => {
        delete storage[key];
      }),
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

    it('should fallback to defaults when API fails', async () => {
      window.eXeLearning.app.api.getUploadLimits.mockRejectedValueOnce(
        new Error('fail')
      );
      await modal.loadUploadLimits();
      expect(modal.uploadLimits.maxFileSize).toBe(100 * 1024 * 1024);
      expect(modal.uploadLimits.maxFileSizeFormatted).toBe('100 MB');
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

    it('should allow when limits are not loaded', () => {
      modal.uploadLimits = null;
      const file = { size: 999 };
      expect(modal.validateFileSize(file)).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(modal.formatBytes(1024)).toBe('1.00 KB');
      expect(modal.formatBytes(1024 * 1024)).toBe('1.00 MB');
    });
  });

  describe('countProjectsByRole', () => {
    it('should count unique projects by role', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'owner' },
          a2: { odeId: 'a', role: 'owner' },
          b1: { odeId: 'b', role: 'editor' },
        },
      };

      expect(modal.countProjectsByRole()).toEqual({ owned: 1, shared: 1 });
    });
  });

  describe('makeElementListOdeFiles', () => {
    const baseData = {
      odeFilesSync: {
        a1: {
          odeId: 'a',
          role: 'owner',
          versionName: '1',
          title: 'Owned Project',
          fileName: 'owned.elp',
          sizeFormatted: '1 MB',
          updatedAt: new Date().toISOString(),
          visibility: 'private',
          isManualSave: true,
        },
        b1: {
          odeId: 'b',
          role: 'editor',
          versionName: '1',
          title: 'Shared Project',
          fileName: 'shared.elp',
          sizeFormatted: '2 MB',
          updatedAt: new Date().toISOString(),
          visibility: 'public',
          ownerEmail: 'owner@example.com',
          isManualSave: false,
        },
      },
    };

    it('should show only owned projects on my-projects tab', () => {
      modal.currentTab = 'my-projects';
      const list = modal.makeElementListOdeFiles(baseData);
      expect(list.querySelectorAll('.ode-group').length).toBe(1);
      expect(list.querySelector('.ode-group').getAttribute('ode-id')).toBe('a');
    });

    it('should show only shared projects on shared-with-me tab', () => {
      modal.currentTab = 'shared-with-me';
      const list = modal.makeElementListOdeFiles(baseData);
      expect(list.querySelectorAll('.ode-group').length).toBe(1);
      expect(list.querySelector('.ode-group').getAttribute('ode-id')).toBe('b');
    });

    it('should show empty message when no data', () => {
      modal.currentTab = 'my-projects';
      const list = modal.makeElementListOdeFiles({ odeFilesSync: {} });
      expect(list.classList.contains('alert')).toBe(true);
    });
  });

  describe('switchTab', () => {
    it('should update active tab and re-render list', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Owned Project',
            fileName: 'owned.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          b1: {
            odeId: 'b',
            role: 'editor',
            versionName: '1',
            title: 'Shared Project',
            fileName: 'shared.elp',
            sizeFormatted: '2 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'public',
            ownerEmail: 'owner@example.com',
            isManualSave: false,
          },
        },
      };

      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      modal.switchTab('shared-with-me');

      const activeTab = modal.modalElementBodyContent.querySelector(
        '.ode-project-tab.active'
      );
      expect(activeTab.getAttribute('data-tab')).toBe('shared-with-me');
      expect(
        modal.modalElementBodyContent.querySelectorAll('.ode-group').length
      ).toBe(1);
    });
  });

  describe('renderOdeRow', () => {
    it('should enable open button and store selection on click', () => {
      const ode = {
        odeId: 'a',
        role: 'owner',
        versionName: '1',
        title: 'Owned Project',
        fileName: 'owned.elp',
        sizeFormatted: '1 MB',
        updatedAt: new Date().toISOString(),
        visibility: 'private',
        isManualSave: true,
      };

      modal.confirmButton.disabled = true;
      modal.confirmButton.classList.add('disabled');

      const row = modal.renderOdeRow(ode, { principal: true }, false);
      modal.modalElement.append(row);

      row.click();

      expect(modal.selectedProjectUuid).toBe('a');
      expect(modal.confirmButton.disabled).toBe(false);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(false);
    });
  });

  describe('updateTabCounts', () => {
    it('should update counts in tabs', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'owner' },
          b1: { odeId: 'b', role: 'editor' },
        },
      };

      const tabs = modal.makeProjectTabs();
      modal.setBodyElement(tabs);
      modal.updateTabCounts();

      const ownedCount = modal.modalElementBodyContent.querySelector(
        '[data-tab="my-projects"] .ode-tab-count'
      );
      const sharedCount = modal.modalElementBodyContent.querySelector(
        '[data-tab="shared-with-me"] .ode-tab-count'
      );

      expect(ownedCount.textContent).toBe('(1)');
      expect(sharedCount.textContent).toBe('(1)');
    });
  });

  describe('showFreeDiskSpace', () => {
    it('should return empty element when data is missing', () => {
      const el = modal.showFreeDiskSpace(null);
      expect(el.classList.contains('progress-bar-div')).toBe(true);
    });

    it('should set danger class when usage is high', () => {
      const data = {
        maxDiskSpaceFormatted: '100 MB',
        usedSpaceFormatted: '90 MB',
        maxDiskSpace: 100,
        usedSpace: 90,
      };
      const el = modal.showFreeDiskSpace(data);
      const bar = el.querySelector('.progress-bar');
      expect(bar.classList.contains('bg-danger')).toBe(true);
    });
  });

  describe('getAuthToken', () => {
    it('should prefer yjs auth token', () => {
      window.eXeLearning.app.project = {
        _yjsBridge: { authToken: 'yjs-token' },
      };
      expect(modal.getAuthToken()).toBe('yjs-token');
    });

    it('should fallback to app auth token', () => {
      window.eXeLearning.app.project = { _yjsBridge: null };
      window.eXeLearning.app.auth = { getToken: vi.fn(() => 'app-token') };
      expect(modal.getAuthToken()).toBe('app-token');
    });

    it('should fallback to symfony token then localStorage', () => {
      window.eXeLearning.app.auth = null;
      window.eXeLearning.symfony = { token: 'sym-token' };
      expect(modal.getAuthToken()).toBe('sym-token');

      window.eXeLearning.symfony = null;
      localStorage.setItem('authToken', 'local-token');
      expect(modal.getAuthToken()).toBe('local-token');
      localStorage.clear();
    });
  });

  describe('refreshList', () => {
    it('should reset selection and update list state', async () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'owner' },
        },
      };
      const tabs = modal.makeProjectTabs();
      modal.setBodyElement(tabs);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      modal.selectedProjectUuid = 'a';
      modal.confirmButton.disabled = false;
      modal.confirmButton.classList.remove('disabled');
      modal.odeFiles = ['a'];

      const updateSpy = vi.spyOn(modal, 'updateTabCounts');
      const switchSpy = vi.spyOn(modal, 'switchTab');

      await modal.refreshList();

      expect(updateSpy).toHaveBeenCalled();
      expect(switchSpy).toHaveBeenCalledWith('my-projects');
      expect(modal.selectedProjectUuid).toBe(null);
      expect(modal.confirmButton.disabled).toBe(true);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(true);
      expect(modal.odeFiles).toEqual([]);
    });
  });

  describe('selectProjectByUuid', () => {
    it('should select the project and enable open', () => {
      const list = document.createElement('div');
      list.classList.add('ode-files-list-container');
      list.innerHTML = `
        <article class="ode-row" ode-id="proj-1">
          <div class="ode-file-title" id="proj-1"></div>
        </article>
      `;
      modal.setBodyElement(list);
      const row = list.querySelector('.ode-row');
      row.scrollIntoView = vi.fn();

      modal.confirmButton.disabled = true;
      modal.confirmButton.classList.add('disabled');

      modal.selectProjectByUuid('proj-1');

      expect(row.classList.contains('selected')).toBe(true);
      expect(modal.selectedProjectUuid).toBe('proj-1');
      expect(modal.confirmButton.disabled).toBe(false);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(false);
      expect(row.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('duplicateOdeFileEvent', () => {
    it('should refresh, switch tab, and select new project on success', async () => {
      window.eXeLearning.app.project = { _yjsBridge: { authToken: 'token-1' } };
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          responseMessage: 'OK',
          data: { uuid: 'new-uuid' },
        }),
      });

      const refreshSpy = vi.spyOn(modal, 'refreshList').mockResolvedValue();
      const switchSpy = vi.spyOn(modal, 'switchTab');
      const selectSpy = vi.spyOn(modal, 'selectProjectByUuid');
      modal.currentTab = 'shared-with-me';

      await modal.duplicateOdeFileEvent('proj-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/projects/uuid/proj-1/duplicate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-1',
          }),
        })
      );
      expect(refreshSpy).toHaveBeenCalled();
      expect(switchSpy).toHaveBeenCalledWith('my-projects');
      expect(selectSpy).toHaveBeenCalledWith('new-uuid');
    });

    it('should show alert on error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          responseMessage: 'ERROR',
          message: 'nope',
        }),
      });

      await modal.duplicateOdeFileEvent('proj-1');

      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error' })
      );
    });
  });

  describe('deleteOdeFileEvent', () => {
    it('should refresh list after delete', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      });
      const refreshSpy = vi.spyOn(modal, 'refreshList').mockResolvedValue();

      await modal.deleteOdeFileEvent('proj-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/exelearning/api/projects/uuid/proj-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('massiveDeleteOdeFileEvent', () => {
    it('should delete all projects and refresh list', async () => {
      global.fetch = vi.fn().mockResolvedValue({ json: vi.fn() });
      const refreshSpy = vi.spyOn(modal, 'refreshList').mockResolvedValue();

      await modal.massiveDeleteOdeFileEvent(['a', 'b']);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('showInlineDeleteConfirmation', () => {
    it('should call delete on confirm and refresh on cancel', async () => {
      const row = document.createElement('article');
      row.classList.add('ode-row');
      row.innerHTML = '<div>Row</div>';
      modal.modalElementBodyContent.appendChild(row);

      const deleteSpy = vi.spyOn(modal, 'deleteOdeFileEvent').mockResolvedValue();
      const switchSpy = vi.spyOn(modal, 'switchTab');

      modal.showInlineDeleteConfirmation(row, { odeId: 'proj-1' });

      const confirmBtn = row.querySelector('.ode-delete-confirm-yes');
      const cancelBtn = row.querySelector('.ode-delete-confirm-no');

      await confirmBtn.click();
      expect(deleteSpy).toHaveBeenCalledWith('proj-1');
      expect(confirmBtn.disabled).toBe(true);

      cancelBtn.click();
      expect(switchSpy).toHaveBeenCalledWith('my-projects');
    });
  });

  describe('makeProgressBar', () => {
    it('should set warning and success classes by percentage', () => {
      const warning = modal.makeProgressBar('100', '60', 60);
      expect(warning.classList.contains('bg-warning')).toBe(true);

      const success = modal.makeProgressBar('100', '10', 10);
      expect(success.classList.contains('bg-success')).toBe(true);
    });
  });

  describe('openSelectedOdeFile', () => {
    it('should open selected project after timeout', () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(modal, 'openUserOdeFilesEvent').mockImplementation(
        () => {}
      );

      modal.modalElementBody.innerHTML = `
        <article class="ode-row selected">
          <div class="ode-file-title" id="proj-1"></div>
        </article>
      `;

      modal.openSelectedOdeFile();
      vi.advanceTimersByTime(modal.timeMax);

      expect(spy).toHaveBeenCalledWith('proj-1');
      vi.useRealTimers();
    });
  });
});
