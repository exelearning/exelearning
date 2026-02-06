import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import modalOpenUserOdeFiles from './modalOpenUserOdeFiles.js';

// Mock ImportProgress
vi.mock('../../../interface/importProgress.js', () => ({
  default: vi.fn().mockImplementation(function MockImportProgress() {
    return {
      show: vi.fn(),
      update: vi.fn(),
      hide: vi.fn()
    };
  })
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
      config: {
        isOfflineInstallation: false,
        basePath: '/exelearning',
      },
      extension: 'elpx',
      app: {
        api: {
          getUploadLimits: vi.fn().mockResolvedValue({
              maxFileSize: 1024 * 1024,
              maxFileSizeFormatted: '1 MB'
          }),
          getOdeUserFiles: vi.fn().mockResolvedValue([]),
          getUserOdeFiles: vi.fn().mockResolvedValue({ odeFiles: { odeFilesSync: {} } }),
          postCheckCurrentOdeUsers: vi.fn().mockResolvedValue({}),
          postLocalLargeOdeFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postLocalOdeFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postLocalOdeComponents: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postLocalXmlPropertiesFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postSelectedOdeFile: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
          postObtainOdeBlockSync: vi.fn().mockResolvedValue({ blockId: 'block-1' }),
          postOdeImportTheme: vi.fn().mockResolvedValue({ responseMessage: 'OK', themes: { themes: {} } }),
          apiUrlBase: 'http://localhost',
          apiUrlBasePath: '/exelearning'
        },
        modals: {
          alert: { show: vi.fn() },
          confirm: { show: vi.fn() },
          sessionlogout: { show: vi.fn() },
          uploadprogress: {
            show: vi.fn(),
            hide: vi.fn().mockResolvedValue(),
            setProcessingPhase: vi.fn(),
            updateUploadProgress: vi.fn(),
            showError: vi.fn(),
          },
        },
        menus: {
          menuStructure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: vi.fn(() => 'page-1'),
              },
            },
          },
        },
        themes: {
          list: { installed: { base: true } },
          selectTheme: vi.fn(),
        },
        project: {
          _yjsBridge: {
            authToken: 'token-1',
            getDocumentManager: vi.fn(() => ({})),
            assetManager: {},
          },
          _yjsEnabled: false,
          odeSession: 'session-1',
          odeVersion: '1',
          odeId: 'ode-1',
          openLoad: vi.fn().mockResolvedValue(),
          reinitializeWithProject: vi.fn().mockResolvedValue(),
          importElpDirectly: vi.fn().mockResolvedValue({}),
          refreshAfterDirectImport: vi.fn().mockResolvedValue(),
          idevices: {
            loadApiIdevicesInPage: vi.fn().mockResolvedValue(),
          },
          properties: {
            loadPropertiesFromYjs: vi.fn(),
          },
          addOdeBlock: vi.fn().mockResolvedValue(),
          updateUserPage: vi.fn(),
          app: {
            themes: {
              list: { loadThemes: vi.fn() },
              selectTheme: vi.fn(),
            },
          },
        }
      }
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
    modal.uploadOdeFilesToServer = vi.fn();
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

    it('should use static mode defaults when capabilities.storage.remote is false', async () => {
      // Clear any calls from modal construction
      window.eXeLearning.app.api.getUploadLimits.mockClear();

      window.eXeLearning.app.capabilities = { storage: { remote: false } };
      await modal.loadUploadLimits();
      expect(window.eXeLearning.app.api.getUploadLimits).not.toHaveBeenCalled();
      expect(modal.uploadLimits.maxFileSize).toBe(100 * 1024 * 1024);
      expect(modal.uploadLimits.maxFileSizeFormatted).toBe('100 MB');
    });

    it('should call API when capabilities.storage.remote is true', async () => {
      window.eXeLearning.app.capabilities = { storage: { remote: true } };
      await modal.loadUploadLimits();
      expect(window.eXeLearning.app.api.getUploadLimits).toHaveBeenCalled();
    });

    it('should call API when capabilities is undefined', async () => {
      delete window.eXeLearning.app.capabilities;
      await modal.loadUploadLimits();
      expect(window.eXeLearning.app.api.getUploadLimits).toHaveBeenCalled();
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

  describe('typesetTitles', () => {
    it('should call MathJax.typesetPromise for titles with LaTeX', async () => {
      const mockTypesetPromise = vi.fn().mockResolvedValue();
      window.MathJax = { typesetPromise: mockTypesetPromise };

      // Add title elements with LaTeX
      const title = document.createElement('div');
      title.className = 'ode-file-title';
      title.textContent = 'Project with \\(x^2\\)';
      modal.modalElementBodyContent.appendChild(title);

      modal.typesetTitles();

      expect(mockTypesetPromise).toHaveBeenCalled();
      expect(mockTypesetPromise).toHaveBeenCalledWith([title]);
    });

    it('should not call MathJax if no titles have LaTeX', () => {
      const mockTypesetPromise = vi.fn().mockResolvedValue();
      window.MathJax = { typesetPromise: mockTypesetPromise };

      // Add title without LaTeX
      const title = document.createElement('div');
      title.className = 'ode-file-title';
      title.textContent = 'Normal Project Title';
      modal.modalElementBodyContent.appendChild(title);

      modal.typesetTitles();

      expect(mockTypesetPromise).not.toHaveBeenCalled();
    });

    it('should not fail when MathJax is not available', () => {
      delete window.MathJax;

      // Add title with LaTeX
      const title = document.createElement('div');
      title.className = 'ode-file-title';
      title.textContent = 'Project with \\(x^2\\)';
      modal.modalElementBodyContent.appendChild(title);

      // Should not throw
      expect(() => modal.typesetTitles()).not.toThrow();
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

  describe('show', () => {
    it('should render modal actions and list and show modal', () => {
      vi.useFakeTimers();
      const data = {
        odeFiles: {
          maxDiskSpaceFormatted: '100 MB',
          usedSpaceFormatted: '10 MB',
          maxDiskSpace: 100,
          usedSpace: 10,
        },
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
        },
      };

      modal.show({ odeFiles: data });
      vi.advanceTimersByTime(modal.timeMin);

      expect(modal.modalElementBodyContent.querySelector('.modal-actions')).toBeTruthy();
      expect(modal.modalElementBodyContent.querySelector('.ode-files-list')).toBeTruthy();
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('makeModalActions', () => {
    it('should include tabs, filter, and upload', () => {
      modal.allOdeFilesData = { odeFilesSync: {} };
      const actions = modal.makeModalActions();
      expect(actions.querySelector('.ode-project-tabs')).toBeTruthy();
      expect(actions.querySelector('.ode-filter-input')).toBeTruthy();
      expect(actions.querySelector('#local-ode-file-upload-div')).toBeTruthy();
    });
  });

  describe('makeProjectTabs', () => {
    it('should call switchTab on tab click', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'owner' },
          b1: { odeId: 'b', role: 'editor' },
        },
      };
      const switchSpy = vi.spyOn(modal, 'switchTab');
      const tabs = modal.makeProjectTabs();
      const sharedBtn = tabs.querySelector('[data-tab="shared-with-me"]');
      sharedBtn.click();
      expect(switchSpy).toHaveBeenCalledWith('shared-with-me');
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

    it('should show delete only for owned project and call showInlineDeleteConfirmation', () => {
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
      const deleteSpy = vi.spyOn(modal, 'showInlineDeleteConfirmation');
      const row = modal.renderOdeRow(ode, { principal: true }, false);
      const deleteBtn = row.querySelector('.open-user-ode-file-action-delete');
      expect(deleteBtn).toBeTruthy();
      deleteBtn.click();
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('should hide delete for shared project and call duplicate on copy', () => {
      const ode = {
        odeId: 'b',
        role: 'editor',
        versionName: '1',
        title: 'Shared Project',
        fileName: 'shared.elp',
        sizeFormatted: '1 MB',
        updatedAt: new Date().toISOString(),
        visibility: 'public',
        ownerEmail: 'owner@example.com',
        isManualSave: false,
      };
      const duplicateSpy = vi.spyOn(modal, 'duplicateOdeFileEvent');
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          success: true,
          newProjectId: 'new-uuid',
          project: { uuid: 'new-uuid' },
        }),
      });
      const row = modal.renderOdeRow(ode, { principal: true }, false);
      expect(row.querySelector('.open-user-ode-file-action-delete')).toBeFalsy();
      row.querySelector('.open-user-ode-file-action-copy').click();
      expect(duplicateSpy).toHaveBeenCalledWith('b');
      expect(row.querySelector('.ode-owner-info')).toBeTruthy();
    });
  });

  describe('renderOdeGroup', () => {
    it('should toggle versions visibility', () => {
      const principal = {
        odeId: 'a',
        role: 'owner',
        versionName: '2',
        title: 'Owned Project',
        fileName: 'owned.elp',
        sizeFormatted: '1 MB',
        updatedAt: new Date().toISOString(),
        visibility: 'private',
        isManualSave: true,
      };
      const other = {
        ...principal,
        versionName: '1',
      };
      const group = modal.renderOdeGroup(principal, [other]);
      const versions = group.querySelector('.ode-versions');
      const toggle = group.querySelector('.ode-toggle');
      expect(versions.hidden).toBe(true);
      toggle.click();
      expect(versions.hidden).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
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

  describe('setFooterElement', () => {
    it('should replace old progress bar div', () => {
      const old = document.createElement('div');
      old.classList.add('progress-bar-div');
      modal.modalFooterContent.appendChild(old);
      const footer = document.createElement('div');
      footer.classList.add('progress-bar-div');
      modal.setFooterElement(footer);
      expect(modal.modalFooterContent.querySelectorAll('.progress-bar-div').length).toBe(1);
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
      window.eXeLearning.app.project._yjsBridge = null;
      window.eXeLearning.config = { token: 'sym-token' };
      expect(modal.getAuthToken()).toBe('sym-token');

      window.eXeLearning.config = null;
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
          success: true,
          message: 'Project duplicated',
          newProjectId: 'new-uuid',
          project: { id: 1, uuid: 'new-uuid', title: 'Test (copy)' },
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

    it('should handle fetch error with alert', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network'));
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

    it('should log error on failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockRejectedValue(new Error('network'));
      await modal.massiveDeleteOdeFileEvent(['a']);
      expect(errorSpy).toHaveBeenCalled();
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

  describe('makeDeleteButtonFooter', () => {
    it('should set delete mode, enable button, and wire confirm to show confirmation', () => {
      const confirmSpy = vi.spyOn(modal, 'setConfirmExec');
      modal.confirmButton.disabled = true;
      modal.confirmButton.classList.add('disabled');

      modal.makeDeleteButtonFooter(['a']);

      expect(modal.confirmButton.textContent).toBe('Delete');
      expect(modal.confirmButton.disabled).toBe(false);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(false);
      expect(confirmSpy).toHaveBeenCalled();
    });
  });

  describe('showMassDeleteConfirmation', () => {
    it('should show confirm modal with single project message', () => {
      modal.showMassDeleteConfirmation(['proj-1']);
      expect(window.eXeLearning.app.modals.confirm.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete projects',
          confirmLabel: 'Delete',
          confirmClass: 'btn-danger',
        })
      );
    });

    it('should show confirm modal with multiple projects message', () => {
      modal.showMassDeleteConfirmation(['proj-1', 'proj-2', 'proj-3']);
      expect(window.eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
      const call = window.eXeLearning.app.modals.confirm.show.mock.calls[0][0];
      expect(call.body).toContain('3');
    });

    it('should call massiveDeleteOdeFileEvent on confirm', async () => {
      const deleteSpy = vi.spyOn(modal, 'massiveDeleteOdeFileEvent').mockResolvedValue();
      let confirmCallback;
      window.eXeLearning.app.modals.confirm.show.mockImplementation(({ confirmExec }) => {
        confirmCallback = confirmExec;
      });

      modal.showMassDeleteConfirmation(['proj-1']);
      await confirmCallback();

      expect(deleteSpy).toHaveBeenCalledWith(['proj-1']);
    });
  });

  describe('updateDeleteButtonState', () => {
    it('should call makeDeleteButtonFooter when odeFiles is not empty', () => {
      const makeSpy = vi.spyOn(modal, 'makeDeleteButtonFooter');
      modal.odeFiles = ['a', 'b'];
      modal.updateDeleteButtonState();
      expect(makeSpy).toHaveBeenCalledWith(['a', 'b']);
    });

    it('should call removeDeleteButtonFooter when odeFiles is empty', () => {
      const removeSpy = vi.spyOn(modal, 'removeDeleteButtonFooter');
      modal.odeFiles = [];
      modal.updateDeleteButtonState();
      expect(removeSpy).toHaveBeenCalledWith([]);
    });

    it('should pass a copy of odeFiles to avoid reference issues', () => {
      const makeSpy = vi.spyOn(modal, 'makeDeleteButtonFooter');
      modal.odeFiles = ['a', 'b'];
      modal.updateDeleteButtonState();

      // Verify it was called with a different array (copy)
      const passedArray = makeSpy.mock.calls[0][0];
      expect(passedArray).toEqual(['a', 'b']);
      expect(passedArray).not.toBe(modal.odeFiles); // Should be a different reference
    });

    it('should update delete button with correct list after deselecting one item', () => {
      // Setup: render projects
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Project A',
            fileName: 'a.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          b1: {
            odeId: 'b',
            role: 'owner',
            versionName: '1',
            title: 'Project B',
            fileName: 'b.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          c1: {
            odeId: 'c',
            role: 'owner',
            versionName: '1',
            title: 'Project C',
            fileName: 'c.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };

      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      // Spy on makeDeleteButtonFooter to capture the arrays passed
      const makeSpy = vi.spyOn(modal, 'makeDeleteButtonFooter');

      // Select all (3 projects)
      modal.toggleSelectAll(true);
      expect(modal.odeFiles.length).toBe(3);

      // Verify makeDeleteButtonFooter was called with all 3 projects
      expect(makeSpy).toHaveBeenLastCalledWith(expect.arrayContaining(['a', 'b', 'c']));

      // Manually deselect one checkbox
      const checkboxB = modal.modalElementBodyContent.querySelector('#check-b');
      checkboxB.checked = false;
      checkboxB.dispatchEvent(new Event('change'));

      // Should now have only 2 projects
      expect(modal.odeFiles.length).toBe(2);
      expect(modal.odeFiles).toContain('a');
      expect(modal.odeFiles).toContain('c');
      expect(modal.odeFiles).not.toContain('b');

      // Verify makeDeleteButtonFooter was called again with only 2 projects
      const lastCall = makeSpy.mock.calls[makeSpy.mock.calls.length - 1][0];
      expect(lastCall).toHaveLength(2);
      expect(lastCall).toContain('a');
      expect(lastCall).toContain('c');
      expect(lastCall).not.toContain('b');
    });
  });

  describe('toggleSelectAll', () => {
    it('should check all project checkboxes when called with true', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Project A',
            fileName: 'a.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          b1: {
            odeId: 'b',
            role: 'owner',
            versionName: '1',
            title: 'Project B',
            fileName: 'b.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };

      modal.currentTab = 'my-projects';
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      modal.toggleSelectAll(true);

      const checkboxes = modal.modalElementBodyContent.querySelectorAll('.ode-check');
      checkboxes.forEach((cb) => {
        expect(cb.checked).toBe(true);
      });
      expect(modal.odeFiles).toContain('a');
      expect(modal.odeFiles).toContain('b');
    });

    it('should uncheck all project checkboxes when called with false', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Project A',
            fileName: 'a.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };

      modal.currentTab = 'my-projects';
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      modal.toggleSelectAll(true);
      modal.toggleSelectAll(false);

      const checkboxes = modal.modalElementBodyContent.querySelectorAll('.ode-check');
      checkboxes.forEach((cb) => {
        expect(cb.checked).toBe(false);
      });
      expect(modal.odeFiles).toEqual([]);
    });

    it('should do nothing for shared-with-me tab', () => {
      modal.currentTab = 'shared-with-me';
      modal.odeFiles = [];
      modal.toggleSelectAll(true);
      expect(modal.odeFiles).toEqual([]);
    });
  });

  describe('updateSelectAllCheckbox', () => {
    it('should set indeterminate when some are selected', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Project A',
            fileName: 'a.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          b1: {
            odeId: 'b',
            role: 'owner',
            versionName: '1',
            title: 'Project B',
            fileName: 'b.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };

      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      // Check only one checkbox
      const firstCheckbox = modal.modalElementBodyContent.querySelector('.ode-check');
      firstCheckbox.checked = true;
      firstCheckbox.dispatchEvent(new Event('change'));

      const selectAll = modal.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
      expect(selectAll.indeterminate).toBe(true);
    });

    it('should set checked when all are selected', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Project A',
            fileName: 'a.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };

      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      // Check the only checkbox
      const checkbox = modal.modalElementBodyContent.querySelector('.ode-check');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      const selectAll = modal.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
      expect(selectAll.checked).toBe(true);
      expect(selectAll.indeterminate).toBe(false);
    });
  });

  describe('Select All visibility in tabs', () => {
    it('should show Select All checkbox for my-projects tab', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'owner' },
        },
      };
      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);

      const selectAllWrap = modal.modalElementBodyContent.querySelector('.ode-select-all-wrap');
      expect(selectAllWrap.style.display).toBe('flex');
    });

    it('should hide Select All checkbox for shared-with-me tab', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: { odeId: 'a', role: 'editor' },
        },
      };
      modal.currentTab = 'shared-with-me';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);

      const selectAllWrap = modal.modalElementBodyContent.querySelector('.ode-select-all-wrap');
      expect(selectAllWrap.style.display).toBe('none');
    });

    it('should toggle Select All visibility when switching tabs', () => {
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

      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      modal.switchTab('shared-with-me');

      const selectAllWrap = modal.modalElementBodyContent.querySelector('.ode-select-all-wrap');
      expect(selectAllWrap.style.display).toBe('none');

      modal.switchTab('my-projects');
      expect(selectAllWrap.style.display).toBe('flex');
    });

    it('should reset Select All checkbox when switching tabs', () => {
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

      modal.currentTab = 'my-projects';
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);

      // Select all
      modal.toggleSelectAll(true);
      const selectAllCheckbox = modal.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
      selectAllCheckbox.checked = true;

      // Switch tabs
      modal.switchTab('shared-with-me');

      // Switch back
      modal.switchTab('my-projects');

      const newSelectAllCheckbox = modal.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
      expect(newSelectAllCheckbox.checked).toBe(false);
      expect(modal.odeFiles).toEqual([]);
    });
  });

  describe('removeDeleteButtonFooter', () => {
    it('should restore open button and disable when empty and no project selected', () => {
      const confirmSpy = vi.spyOn(modal, 'setConfirmExec');
      modal.selectedProjectUuid = null;
      modal.confirmButton.disabled = false;
      modal.confirmButton.classList.remove('disabled');

      modal.removeDeleteButtonFooter([]);

      expect(modal.confirmButton.textContent).toBe('Open');
      expect(modal.confirmButton.disabled).toBe(true);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(true);
      expect(confirmSpy).toHaveBeenCalled();
    });

    it('should restore open button but keep enabled when a project is selected', () => {
      const confirmSpy = vi.spyOn(modal, 'setConfirmExec');
      modal.selectedProjectUuid = 'proj-1';
      modal.confirmButton.disabled = false;
      modal.confirmButton.classList.remove('disabled');

      modal.removeDeleteButtonFooter([]);

      expect(modal.confirmButton.textContent).toBe('Open');
      expect(modal.confirmButton.disabled).toBe(false);
      expect(modal.confirmButton.classList.contains('disabled')).toBe(false);
      expect(confirmSpy).toHaveBeenCalled();
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

  describe('makeFilterForList', () => {
    it('should filter and highlight matching titles', () => {
      modal.allOdeFilesData = {
        odeFilesSync: {
          a1: {
            odeId: 'a',
            role: 'owner',
            versionName: '1',
            title: 'Alpha Project',
            fileName: 'alpha.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
          a2: {
            odeId: 'a',
            role: 'owner',
            versionName: '2',
            title: 'Alpha Project',
            fileName: 'alpha.elp',
            sizeFormatted: '1 MB',
            updatedAt: new Date().toISOString(),
            visibility: 'private',
            isManualSave: true,
          },
        },
      };
      const actions = modal.makeModalActions();
      modal.setBodyElement(actions);
      const list = modal.makeElementListOdeFiles(modal.allOdeFilesData);
      modal.setBodyElement(list);
      const input = modal.modalElementBodyContent.querySelector('.ode-filter-input');
      input.value = 'alpha';
      input.dispatchEvent(new Event('input'));
      expect(modal.modalElementBodyContent.querySelectorAll('mark').length).toBeGreaterThan(0);
      input.value = 'nope';
      input.dispatchEvent(new Event('input'));
      const group = modal.modalElementBodyContent.querySelector('.ode-group');
      expect(group.style.display).toBe('none');
    });
  });

  describe('makeUploadInput', () => {
    it('should validate before uploading a single file', () => {
      const validateSpy = vi.spyOn(modal, 'validateFileSize').mockReturnValue(true);
      const uploadSpy = vi.spyOn(modal, 'largeFilesUpload').mockResolvedValue();
      const upload = modal.makeUploadInput();
      const input = upload.querySelector('#local-ode-modal-file-upload');
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      expect(validateSpy).toHaveBeenCalledWith(file);
      expect(uploadSpy).toHaveBeenCalledWith(file);
    });

    it('should skip upload when validation fails', () => {
      const validateSpy = vi.spyOn(modal, 'validateFileSize').mockReturnValue(false);
      const uploadSpy = vi.spyOn(modal, 'largeFilesUpload').mockResolvedValue();
      const upload = modal.makeUploadInput();
      const input = upload.querySelector('#local-ode-modal-file-upload');
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      expect(validateSpy).toHaveBeenCalled();
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('should validate multiple files before upload', () => {
      const validateSpy = vi.spyOn(modal, 'validateFileSize').mockReturnValue(true);
      const uploadSpy = vi.spyOn(modal, 'uploadOdeFilesToServer');
      const upload = modal.makeUploadInput();
      const input = upload.querySelector('#multiple-local-modal-ode-file-upload');
      const file1 = new File(['x'], 'sample1.elp', { type: 'application/zip' });
      const file2 = new File(['x'], 'sample2.elp', { type: 'application/zip' });
      Object.defineProperty(input, 'files', {
        value: [file1, file2],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      expect(validateSpy).toHaveBeenCalledTimes(2);
      expect(uploadSpy).toHaveBeenCalled();
    });
  });

  describe('openUserOdeFilesEvent', () => {
    it('should close modal and redirect to project when no unsaved changes', async () => {
      // No unsaved changes (no yjsBridge)
      window.eXeLearning.app.project._yjsBridge = null;
      const closeSpy = vi.spyOn(modal, 'close');
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });
      window.onbeforeunload = vi.fn();
      await modal.openUserOdeFilesEvent('proj-1');
      expect(closeSpy).toHaveBeenCalled();
      expect(window.onbeforeunload).toBeNull();
      expect(window.location.href).toContain('/workarea?project=proj-1');
    });

    it('should redirect when hasUnsavedChanges returns false', async () => {
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => false),
        },
      };
      const closeSpy = vi.spyOn(modal, 'close');
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });
      await modal.openUserOdeFilesEvent('proj-1');
      expect(closeSpy).toHaveBeenCalled();
      expect(window.location.href).toContain('/workarea?project=proj-1');
      expect(window.eXeLearning.app.modals.sessionlogout.show).not.toHaveBeenCalled();
    });

    it('should show session logout when hasUnsavedChanges returns true', async () => {
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => true),
        },
      };
      const closeSpy = vi.spyOn(modal, 'close');
      await modal.openUserOdeFilesEvent('proj-1');
      expect(closeSpy).toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalledWith({
        title: 'Open project',
        forceOpen: 'Open without saving',
        openYjsProject: true,
        projectUuid: 'proj-1',
      });
    });
  });

  describe('openUserOdeFilesWithOpenSession', () => {
    it('should load project when response OK', async () => {
      window.eXeLearning.app.api.postSelectedOdeFile.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeSessionId: 's1',
        odeVersionId: 'v1',
        odeId: 'o1',
      });
      const loadSpy = vi.spyOn(modal, 'loadOdeTheme');
      await modal.openUserOdeFilesWithOpenSession('proj-1');
      expect(window.eXeLearning.app.project.odeSession).toBe('s1');
      expect(window.eXeLearning.app.project.openLoad).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should show error when response fails', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.api.postSelectedOdeFile.mockResolvedValueOnce({
        responseMessage: 'NOPE',
      });
      await modal.openUserOdeFilesWithOpenSession('proj-1');
      vi.advanceTimersByTime(modal.timeMax);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('largeFilesUpload', () => {
    it('should reject invalid idevice file types', async () => {
      vi.useFakeTimers();
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      await modal.largeFilesUpload(file, true);
      vi.advanceTimersByTime(modal.timeMax);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Import error' })
      );
      vi.useRealTimers();
    });

    it('should import idevice via ComponentImporter', async () => {
      const preloadAllAssetsMock = vi.fn().mockResolvedValue(1);
      window.eXeLearning.app.project._yjsBridge = {
        authToken: 'token-1',
        getDocumentManager: vi.fn(() => ({})),
        assetManager: { preloadAllAssets: preloadAllAssetsMock },
      };
      window.ComponentImporter = class {
        constructor() {}
        async importComponent() {
          return { success: true, blockId: 'block-1' };
        }
      };
      const file = new File(['x'], 'sample.idevice', { type: 'application/octet-stream' });
      await modal.largeFilesUpload(file, true);
      expect(window.eXeLearning.app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
    });

    it('should call preloadAllAssets after successful component import (issue #953 fix)', async () => {
      // Setup: Mock preloadAllAssets to verify it's called
      const preloadAllAssetsMock = vi.fn().mockResolvedValue(1);
      window.eXeLearning.app.project._yjsBridge = {
        authToken: 'token-1',
        getDocumentManager: vi.fn(() => ({})),
        assetManager: { preloadAllAssets: preloadAllAssetsMock },
      };
      window.ComponentImporter = class {
        constructor() {}
        async importComponent() {
          return { success: true, blockId: 'block-1' };
        }
      };
      const file = new File(['x'], 'sample.idevice', { type: 'application/octet-stream' });

      // Execute import
      await modal.largeFilesUpload(file, true);

      // Verify preloadAllAssets was called BEFORE loadApiIdevicesInPage
      // This ensures images display immediately without needing page refresh
      expect(preloadAllAssetsMock).toHaveBeenCalled();
      expect(window.eXeLearning.app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(true);
    });

    it('should use pre-uploaded data when provided', async () => {
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      file._preUploadedOdeData = { odeFileName: 'pre.elp', odeFilePath: '/tmp/pre.elp' };
      const openSpy = vi.spyOn(modal, 'openLocalElpFile').mockResolvedValue();
      const cleanupSpy = vi.spyOn(modal, 'ensureModalBackdropCleared');
      await modal.largeFilesUpload(file, false, false, true, true);
      expect(openSpy).toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should show session logout when unsaved changes detected', async () => {
      // Setup Yjs bridge with unsaved changes
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => true),
        },
      };
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      await modal.largeFilesUpload(file);
      expect(window.eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalled();
    });

    it('should not show session logout when no unsaved changes', async () => {
      // Setup Yjs bridge without unsaved changes
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => false),
        },
      };
      window.history.pushState = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ uuid: 'proj-1' })),
      });
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      await modal.largeFilesUpload(file);
      expect(window.eXeLearning.app.modals.sessionlogout.show).not.toHaveBeenCalled();
    });

    it('should process in-memory import and refresh UI', async () => {
      window.history.pushState = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ uuid: 'proj-1' })),
      });
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      await modal.largeFilesUpload(file);
      expect(window.eXeLearning.app.project.reinitializeWithProject).toHaveBeenCalledWith('proj-1', { skipSyncWait: true });
      expect(window.eXeLearning.app.project.importElpDirectly).toHaveBeenCalled();
      expect(window.eXeLearning.app.project.refreshAfterDirectImport).toHaveBeenCalled();
    });

    it('should upload and open properties file', async () => {
      window.eXeLearning.app.api.postLocalLargeOdeFile.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeFileName: 'sample.elp',
        odeFilePath: '/tmp/sample.elp',
      });
      const xmlSpy = vi.spyOn(modal, 'openLocalXmlPropertiesFile').mockResolvedValue();
      const file = new File(['x'], 'sample.elp', { type: 'application/zip' });
      await modal.largeFilesUpload(file, false, true);
      expect(xmlSpy).toHaveBeenCalledWith('sample.elp', '/tmp/sample.elp');
      expect(window.eXeLearning.app.modals.uploadprogress.hide).toHaveBeenCalled();
    });
  });

  describe('openLocalXmlPropertiesFile', () => {
    it('should load properties on success', async () => {
      window.eXeLearning.app.api.postLocalXmlPropertiesFile.mockResolvedValueOnce({
        responseMessage: 'OK',
      });
      await modal.openLocalXmlPropertiesFile('a.elp', '/tmp/a.elp');
      expect(window.eXeLearning.app.project.properties.loadPropertiesFromYjs).toHaveBeenCalled();
      expect(window.eXeLearning.app.project.openLoad).toHaveBeenCalled();
    });

    it('should show error on failure', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.api.postLocalXmlPropertiesFile.mockResolvedValueOnce({
        responseMessage: 'ERROR',
      });
      await modal.openLocalXmlPropertiesFile('a.elp', '/tmp/a.elp');
      vi.advanceTimersByTime(modal.timeMax);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('openLocalElpFile', () => {
    it('should redirect when server returns projectUuid', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeSessionId: 's1',
        odeVersionId: 'v1',
        odeId: 'o1',
        projectUuid: 'proj-1',
        elpImportPath: '/tmp/a.elp',
      });
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', false, window.eXeLearning.app.modals.uploadprogress);
      expect(window.location.href).toContain('/workarea?project=proj-1&import=');
    });

    it('should load project without redirect on success', async () => {
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeSessionId: 's1',
        odeVersionId: 'v1',
        odeId: 'o1',
      });
      const loadSpy = vi.spyOn(modal, 'loadOdeTheme');
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', false, window.eXeLearning.app.modals.uploadprogress);
      expect(window.eXeLearning.app.project.openLoad).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should add block for import idevices', async () => {
      window.eXeLearning.app.api.postLocalOdeComponents.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeBlockId: 'block-1',
      });
      window.eXeLearning.app.api.postObtainOdeBlockSync.mockResolvedValueOnce({ blockId: 'block-1' });
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', true);
      expect(window.eXeLearning.app.project.addOdeBlock).toHaveBeenCalled();
    });

    it('should show session logout on open session error', async () => {
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'User already has an open session',
      });
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', false, window.eXeLearning.app.modals.uploadprogress);
      expect(window.eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalled();
    });

    it('should open directly when no unsaved changes', async () => {
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'ERROR',
      });
      // Setup Yjs bridge without unsaved changes
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => false),
        },
      };
      const openSpy = vi.spyOn(modal, 'openUserLocalOdeFilesWithOpenSession').mockResolvedValue();
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', false);
      expect(openSpy).toHaveBeenCalledWith('a.elp', '/tmp/a.elp');
    });

    it('should show session logout when unsaved changes exist', async () => {
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'ERROR',
      });
      // Setup Yjs bridge with unsaved changes
      window.eXeLearning.app.project._yjsBridge = {
        documentManager: {
          hasUnsavedChanges: vi.fn(() => true),
        },
      };
      await modal.openLocalElpFile('a.elp', '/tmp/a.elp', false);
      expect(window.eXeLearning.app.modals.sessionlogout.show).toHaveBeenCalled();
    });
  });

  describe('openUserLocalOdeFilesWithOpenSession', () => {
    it('should redirect on Yjs response', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'OK',
        odeSessionId: 's1',
        odeVersionId: 'v1',
        odeId: 'o1',
        projectUuid: 'proj-1',
        elpImportPath: '/tmp/a.elp',
      });
      await modal.openUserLocalOdeFilesWithOpenSession('a.elp', '/tmp/a.elp');
      expect(window.location.href).toContain('/workarea?project=proj-1&import=');
    });

    it('should show error on failure', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.api.postLocalOdeFile.mockResolvedValueOnce({
        responseMessage: 'ERROR',
      });
      await modal.openUserLocalOdeFilesWithOpenSession('a.elp', '/tmp/a.elp');
      vi.advanceTimersByTime(modal.timeMax);
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('cleanupOrphanedBackdrops', () => {
    it('should remove backdrops and modal-open when no modal shown', () => {
      const backdrop = document.createElement('div');
      backdrop.classList.add('modal-backdrop');
      document.body.classList.add('modal-open');
      document.body.appendChild(backdrop);
      modal.cleanupOrphanedBackdrops();
      expect(document.querySelector('.modal-backdrop')).toBeNull();
      expect(document.body.classList.contains('modal-open')).toBe(false);
    });
  });

  describe('ensureModalBackdropCleared', () => {
    it('should remove backdrops after delay', () => {
      vi.useFakeTimers();
      const backdrop = document.createElement('div');
      backdrop.classList.add('modal-backdrop');
      document.body.classList.add('modal-open');
      document.body.appendChild(backdrop);
      modal.ensureModalBackdropCleared(10);
      vi.advanceTimersByTime(10);
      expect(document.querySelector('.modal-backdrop')).toBeNull();
      expect(document.body.classList.contains('modal-open')).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('loadOdeTheme', () => {
    it('should select installed theme', () => {
      modal.loadOdeTheme({
        theme: 'base',
        themeDir: 'base',
        authorized: true,
      });
      expect(window.eXeLearning.app.themes.selectTheme).toHaveBeenCalledWith('base');
    });

    it('should show alert for missing theme and use default on confirm', () => {
      const confirmExec = vi.fn();
      window.eXeLearning.app.modals.alert = {
        show: vi.fn().mockImplementation(({ confirmExec: exec }) => {
          if (exec) confirmExec.mockImplementation(exec);
        }),
      };
      modal.loadOdeTheme({
        theme: 'missing',
        themeDir: 'missing',
        authorized: true,
      });
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      // Confirm callback selects default theme
      if (confirmExec.getMockImplementation()) {
        confirmExec();
        expect(window.eXeLearning.app.themes.selectTheme).toHaveBeenCalledWith('base', false);
      }
    });
  });

  describe('largeFilesUpload static mode', () => {
    it('should use YjsBridge.importFromElpx in static mode', async () => {
      window.eXeLearning.app.capabilities = { storage: { remote: false } };
      const mockYjsBridge = {
        importFromElpx: vi.fn().mockResolvedValue({}),
      };
      window.eXeLearning.app.project._yjsBridge = mockYjsBridge;
      window.eXeLearning.app.project.refreshAfterDirectImport = vi.fn().mockResolvedValue();

      // Note: second param is isImportIdevices (false), not filename
      // Filename comes from file.name
      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

      await modal.largeFilesUpload(mockFile, false, false, false, false);

      expect(mockYjsBridge.importFromElpx).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({ onProgress: expect.any(Function) })
      );
    });

    it('should call refreshAfterDirectImport after static mode import', async () => {
      window.eXeLearning.app.capabilities = { storage: { remote: false } };
      const mockYjsBridge = {
        importFromElpx: vi.fn().mockResolvedValue({}),
      };
      window.eXeLearning.app.project._yjsBridge = mockYjsBridge;
      window.eXeLearning.app.project.refreshAfterDirectImport = vi.fn().mockResolvedValue();

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

      await modal.largeFilesUpload(mockFile, false, false, false, false);

      expect(window.eXeLearning.app.project.refreshAfterDirectImport).toHaveBeenCalled();
    });

    it('should fallback to legacy flow when yjsBridge is not available in static mode', async () => {
      window.eXeLearning.app.capabilities = { storage: { remote: false } };
      window.eXeLearning.app.project._yjsBridge = null;

      // Mock legacy upload path
      window.eXeLearning.app.api.postLocalLargeOdeFile = vi.fn().mockResolvedValue({
        responseMessage: 'OK',
        odeFileName: 'test.elpx',
        odeFilePath: '/tmp/test.elpx',
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

      await modal.largeFilesUpload(mockFile, false, false, false, false);

      // Should log error and fallback to legacy flow
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[OpenFile] Error in direct client processing:',
        expect.any(Error)
      );
      expect(window.eXeLearning.app.api.postLocalLargeOdeFile).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should skip static mode when capabilities is undefined and use direct processing', async () => {
      delete window.eXeLearning.app.capabilities;

      // Mock fetch for direct in-memory processing path
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ uuid: 'test-uuid' })),
      });
      window.fetch = mockFetch;

      // Mock project reinitialize for direct processing
      window.eXeLearning.app.project.reinitializeWithProject = vi.fn().mockResolvedValue();
      window.eXeLearning.app.project.importElpDirectly = vi.fn().mockResolvedValue({});
      window.eXeLearning.app.project.refreshAfterDirectImport = vi.fn().mockResolvedValue();

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

      await modal.largeFilesUpload(mockFile, false, false, false, false);

      // Should use fetch for direct processing, not legacy API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/create-quick'),
        expect.any(Object)
      );
    });

    it('should skip static mode when storage.remote is true and use direct processing', async () => {
      window.eXeLearning.app.capabilities = { storage: { remote: true } };

      // Mock fetch for direct in-memory processing path
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ uuid: 'test-uuid' })),
      });
      window.fetch = mockFetch;

      // Mock project reinitialize for direct processing
      window.eXeLearning.app.project.reinitializeWithProject = vi.fn().mockResolvedValue();
      window.eXeLearning.app.project.importElpDirectly = vi.fn().mockResolvedValue({});
      window.eXeLearning.app.project.refreshAfterDirectImport = vi.fn().mockResolvedValue();

      const mockFile = new File(['test'], 'test.elpx', { type: 'application/octet-stream' });

      await modal.largeFilesUpload(mockFile, false, false, false, false);

      // Should use fetch for direct processing, not static mode
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/create-quick'),
        expect.any(Object)
      );
    });
  });
});
