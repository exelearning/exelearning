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

    // Mock prompt function (not available in happy-dom)
    window.prompt = vi.fn();

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: { 
            odeId: 'proj-123',
            _yjsBridge: {
                assetManager: {
                    getProjectAssets: vi.fn().mockResolvedValue([]),
                    formatFileSize: vi.fn(b => `${b} bytes`),
                    insertImage: vi.fn().mockResolvedValue(),
                    deleteAsset: vi.fn().mockResolvedValue(),
                    getAsset: vi.fn().mockResolvedValue(null),
                    getImageDimensions: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
                    getAssetUrl: vi.fn((assetId, filename) => {
                        const ext = filename?.includes('.') ? filename.split('.').pop().toLowerCase() : '';
                        return ext ? `asset://${assetId}.${ext}` : `asset://${assetId}`;
                    }),
                    generateLoadingPlaceholder: vi.fn(() => 'data:image/svg+xml,loading-placeholder'),
                    blobURLCache: new Map(),
                    reverseBlobCache: new Map(),
                    pendingFetches: new Set()
                }
            }
        },
        modals: {
          alert: { show: vi.fn() }
        },
        toasts: {
          createToast: vi.fn()
        }
      }
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalFileManager';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
        <div class="media-library-header-search">
          <input class="media-library-search" type="search">
        </div>
      </div>
      <div class="modal-body">
        <div class="media-library-main">
          <div class="media-library-empty"></div>
          <div class="media-library-grid"></div>
          <div class="media-library-list-container" style="display:none;"><table class="media-library-list"><thead><th data-sort="name"></th></thead><tbody></tbody></table></div>
        </div>
        <div class="media-library-sidebar">
          <div class="media-library-sidebar-empty"></div>
          <div class="media-library-sidebar-content"></div>
        </div>
        <button class="media-library-upload-btn">Upload</button>
        <input class="media-library-upload-input" type="file">
        <div class="media-library-view-btn" data-view="grid"></div>
        <div class="media-library-view-btn" data-view="list"></div>
        <select class="media-library-sort">
          <option value="name-asc">name-asc</option>
          <option value="size-asc">size-asc</option>
          <option value="type-asc">type-asc</option>
          <option value="type-desc">type-desc</option>
        </select>
        <select class="media-library-filter">
          <option value="">All</option>
        </select>

        <img class="media-library-preview-img">
        <video class="media-library-preview-video"></video>
        <audio class="media-library-preview-audio"></audio>
        <div class="media-library-preview-file"></div>
        <iframe class="media-library-preview-pdf"></iframe>

        <span class="media-library-filename"></span>
        <span class="media-library-type"></span>
        <span class="media-library-size"></span>
        <div class="media-library-dimensions-row"><span class="media-library-dimensions"></span></div>
        <span class="media-library-date"></span>
        <div class="url-input-group">
          <input class="media-library-url" readonly>
          <button class="media-library-copy-url-btn"><span class="exe-icon">content_copy</span></button>
        </div>
        <span class="media-library-count-value">0</span>
      </div>
      <div class="media-library-footer">
        <div class="media-library-footer-actions">
          <button class="media-library-delete-btn">Delete</button>
          <button class="media-library-rename-btn">Rename</button>
          <button class="media-library-duplicate-btn">Duplicate</button>
          <button class="media-library-move-btn">Move</button>
          <button class="media-library-download-btn">Download</button>
          <div class="dropdown">
            <button class="media-library-more-btn dropdown-toggle">More</button>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item media-library-extract-btn d-none" href="#">Extract ZIP</a></li>
              <li><a class="dropdown-item media-library-copyurl-btn" href="#">Copy URL</a></li>
              <li><a class="dropdown-item media-library-fullsize-btn" href="#">View full size</a></li>
            </ul>
          </div>
        </div>
        <button class="media-library-insert-btn">Insert</button>
      </div>
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
    modal.initElements();
    modal.initBehaviour();
    modal.assetManager = window.eXeLearning.app.project._yjsBridge.assetManager;

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.confirm = vi.fn(() => true);
    global.alert = vi.fn();
    global.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(),
    };
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

    it('should show error when assetManager is missing', async () => {
      vi.useFakeTimers();
      window.eXeLearning.app.project._yjsBridge.assetManager = null;
      await modal.show();
      vi.advanceTimersByTime(500);
      expect(modal.grid.innerHTML).toContain('Media library not available');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('initElements', () => {
      it('should find DOM elements', () => {
          modal.initElements();
          expect(modal.grid).not.toBeNull();
          expect(modal.uploadBtn).not.toBeNull();
      });

      it('should find action buttons (delete and insert)', () => {
          modal.initElements();
          expect(modal.deleteBtn).not.toBeNull();
          expect(modal.insertBtn).not.toBeNull();
          expect(modal.deleteBtn.classList.contains('media-library-delete-btn')).toBe(true);
          expect(modal.insertBtn.classList.contains('media-library-insert-btn')).toBe(true);
      });

      it('should find sidebar elements', () => {
          modal.initElements();
          expect(modal.sidebar).not.toBeNull();
          expect(modal.sidebarEmpty).not.toBeNull();
          expect(modal.sidebarContent).not.toBeNull();
      });

      it('should find both copy URL buttons (footer dropdown and sidebar)', () => {
          modal.initElements();
          expect(modal.dropdownCopyUrlBtn).not.toBeNull();
          expect(modal.copyUrlBtn).not.toBeNull();
          expect(modal.dropdownCopyUrlBtn).not.toBe(modal.copyUrlBtn);
      });
  });

  describe('initBehaviour', () => {
    it('should trigger upload input when upload button clicked', () => {
      const clickSpy = vi.spyOn(modal.uploadInput, 'click');
      modal.uploadBtn.click();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should call uploadFiles on input change', async () => {
      const uploadSpy = vi.spyOn(modal, 'uploadFiles').mockResolvedValue();
      const file = new File(['x'], 'sample.png', { type: 'image/png' });
      Object.defineProperty(modal.uploadInput, 'files', {
        value: [file],
        configurable: true,
      });
      modal.uploadInput.dispatchEvent(new Event('change'));
      expect(uploadSpy).toHaveBeenCalledWith([file]);
      expect(modal.uploadInput.value).toBe('');
    });

    it('should call filterAssets on search input', () => {
      const filterSpy = vi.spyOn(modal, 'filterAssets');
      modal.searchInput.value = 'test';
      modal.searchInput.dispatchEvent(new Event('input'));
      expect(filterSpy).toHaveBeenCalledWith('test');
    });

    it('should call delete and insert actions', () => {
      const deleteSpy = vi.spyOn(modal, 'deleteSelectedAsset').mockResolvedValue();
      const insertSpy = vi.spyOn(modal, 'insertSelectedAsset');
      modal.deleteBtn.click();
      modal.insertBtn.click();
      expect(deleteSpy).toHaveBeenCalled();
      expect(insertSpy).toHaveBeenCalled();
    });

    it('should toggle view mode from view buttons', () => {
      const setViewSpy = vi.spyOn(modal, 'setViewMode');
      const listBtn = mockElement.querySelector('[data-view="list"]');
      listBtn.click();
      expect(setViewSpy).toHaveBeenCalledWith('list');
    });

    it('should update sorting from select', () => {
      const applySpy = vi.spyOn(modal, 'applyFiltersAndRender');
      modal.sortSelect.value = 'name-asc';
      modal.sortSelect.dispatchEvent(new Event('change'));
      expect(modal.sortBy).toBe('name-asc');
      expect(applySpy).toHaveBeenCalled();
    });

    // Pagination has been removed - now using infinite scroll
  });

  describe('handleHeaderSort', () => {
    it('should toggle direction when clicking same header', () => {
      modal.sortBy = 'name-asc';
      modal.handleHeaderSort('name');
      expect(modal.sortBy).toBe('name-desc');
    });

    it('should set asc when clicking new header', () => {
      modal.sortBy = 'date-desc';
      modal.handleHeaderSort('size');
      expect(modal.sortBy).toBe('size-asc');
      expect(modal.sortSelect.value).toBe('size-asc');
    });
  });

  describe('setViewMode', () => {
    it('should switch to list view when has assets', () => {
      // Need assets to see list container (otherwise empty state is shown)
      modal.filteredAssets = [{ id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) }];
      modal.setViewMode('list');
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('flex');
    });

    it('should show empty state when switching to list view with no assets', () => {
      modal.filteredAssets = [];
      modal.setViewMode('list');
      expect(modal.emptyState.classList.contains('visible')).toBe(true);
      expect(modal.listContainer.style.display).toBe('none');
    });
  });

  describe('loadAssets', () => {
    it('should load assets and render', async () => {
      const assets = [
        { id: '1', filename: 'a.png', mime: 'image/png', size: 10, createdAt: Date.now() },
      ];
      window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets.mockResolvedValueOnce(assets);
      const applySpy = vi.spyOn(modal, 'applyFiltersAndRender');
      await modal.loadAssets();
      expect(modal.assets).toEqual(assets);
      expect(applySpy).toHaveBeenCalled();
    });

    it('should show error when load fails', async () => {
      window.eXeLearning.app.project._yjsBridge.assetManager.getProjectAssets.mockRejectedValueOnce(new Error('fail'));
      await modal.loadAssets();
      expect(modal.grid.innerHTML).toContain('Failed to load assets');
    });
  });

  describe('applyFiltersAndRender', () => {
    it('should filter by accept and search term', () => {
      modal.acceptFilter = 'image';
      modal.searchInput.value = 'pic';
      modal.assets = [
        { id: '1', filename: 'pic.png', mime: 'image/png' },
        { id: '2', filename: 'song.mp3', mime: 'audio/mpeg' },
      ];
      const renderSpy = vi.spyOn(modal, 'renderCurrentView');
      modal.applyFiltersAndRender();
      expect(modal.filteredAssets.length).toBe(1);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should search recursively across all folders when search term is entered', () => {
      modal.currentPath = '';
      modal.searchInput.value = 'test';
      modal.assets = [
        { id: '1', filename: 'test.png', mime: 'image/png', folderPath: '' },
        { id: '2', filename: 'test-sub.png', mime: 'image/png', folderPath: 'folder1' },
        { id: '3', filename: 'test-deep.png', mime: 'image/png', folderPath: 'folder1/subfolder' },
        { id: '4', filename: 'other.png', mime: 'image/png', folderPath: '' },
      ];
      modal.applyFiltersAndRender();
      expect(modal.isSearchMode).toBe(true);
      expect(modal.filteredAssets.length).toBe(3);
      expect(modal.filteredAssets.map(a => a.id)).toContain('1');
      expect(modal.filteredAssets.map(a => a.id)).toContain('2');
      expect(modal.filteredAssets.map(a => a.id)).toContain('3');
    });

    it('should set isSearchMode to true when search term is present', () => {
      modal.searchInput.value = 'something';
      modal.assets = [];
      modal.applyFiltersAndRender();
      expect(modal.isSearchMode).toBe(true);
    });

    it('should set isSearchMode to false when search term is empty', () => {
      modal.searchInput.value = '';
      modal.assets = [];
      modal.applyFiltersAndRender();
      expect(modal.isSearchMode).toBe(false);
    });

    it('should only show current folder assets when not searching', () => {
      modal.currentPath = 'folder1';
      modal.searchInput.value = '';
      modal.assets = [
        { id: '1', filename: 'root.png', mime: 'image/png', folderPath: '' },
        { id: '2', filename: 'folder1.png', mime: 'image/png', folderPath: 'folder1' },
        { id: '3', filename: 'subfolder.png', mime: 'image/png', folderPath: 'folder1/sub' },
      ];
      modal.applyFiltersAndRender();
      expect(modal.isSearchMode).toBe(false);
      expect(modal.filteredAssets.length).toBe(1);
      expect(modal.filteredAssets[0].id).toBe('2');
    });
  });

  describe('recursive search - folders and path display', () => {
    it('should hide folders when in search mode', () => {
      modal.isSearchMode = true;
      modal.folders = ['folder1', 'folder2'];
      modal.filteredAssets = [{ id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) }];
      modal.renderGrid(modal.filteredAssets);
      expect(modal.grid.querySelectorAll('.media-library-folder').length).toBe(0);
    });

    it('should show folders when not in search mode', () => {
      modal.isSearchMode = false;
      modal.folders = ['folder1', 'folder2'];
      modal.filteredAssets = [{ id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) }];
      modal.renderGrid(modal.filteredAssets);
      expect(modal.grid.querySelectorAll('.media-library-folder').length).toBe(2);
    });

    it('should show path badge in grid item when in search mode', () => {
      modal.isSearchMode = true;
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', folderPath: 'images/photos', blob: new Blob(['x']) };
      const item = modal.createGridItem(asset);
      expect(item.querySelector('.item-path-badge')).not.toBeNull();
      expect(item.querySelector('.item-path-badge').textContent).toContain('/images/photos');
    });

    it('should not show path badge in grid item when not in search mode', () => {
      modal.isSearchMode = false;
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', folderPath: 'images/photos', blob: new Blob(['x']) };
      const item = modal.createGridItem(asset);
      expect(item.querySelector('.item-path-badge')).toBeNull();
    });

    it('should show visible location cell in list row when in search mode', () => {
      modal.isSearchMode = true;
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', folderPath: 'docs/pdfs', blob: new Blob(['x']) };
      const row = modal.createListRow(asset);
      const locationCell = row.querySelector('.col-location');
      expect(locationCell).not.toBeNull();
      expect(locationCell.classList.contains('d-none')).toBe(false);
      const locationLink = locationCell.querySelector('.location-link');
      expect(locationLink).not.toBeNull();
      expect(locationLink.textContent).toContain('/docs/pdfs');
    });

    it('should hide location cell in list row when not in search mode', () => {
      modal.isSearchMode = false;
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', folderPath: 'docs/pdfs', blob: new Blob(['x']) };
      const row = modal.createListRow(asset);
      const locationCell = row.querySelector('.col-location');
      expect(locationCell).not.toBeNull();
      expect(locationCell.classList.contains('d-none')).toBe(true);
    });
  });

  describe('showSearchIndicator', () => {
    it('should show location column header when entering search mode', () => {
      // Setup: add location column header to mock DOM
      const th = document.createElement('th');
      th.className = 'col-location d-none';
      modal.locationColumnHeader = th;

      modal.showSearchIndicator('test');

      expect(th.classList.contains('d-none')).toBe(false);
    });

    it('should hide breadcrumbs and show search indicator', () => {
      // Setup mock DOM elements
      const breadcrumbs = document.createElement('div');
      breadcrumbs.className = 'media-library-breadcrumbs';
      modal.breadcrumbs = breadcrumbs;

      const searchIndicator = document.createElement('div');
      searchIndicator.className = 'media-library-search-indicator d-none';
      searchIndicator.innerHTML = '<strong class="search-term"></strong>';
      modal.searchIndicator = searchIndicator;

      modal.showSearchIndicator('query');

      expect(breadcrumbs.classList.contains('d-none')).toBe(true);
      expect(searchIndicator.classList.contains('d-none')).toBe(false);
      expect(searchIndicator.querySelector('.search-term').textContent).toBe('query');
    });
  });

  describe('showBreadcrumbs', () => {
    it('should hide location column header when exiting search mode', () => {
      // Setup: add location column header to mock DOM
      const th = document.createElement('th');
      th.className = 'col-location'; // visible
      modal.locationColumnHeader = th;

      modal.showBreadcrumbs();

      expect(th.classList.contains('d-none')).toBe(true);
    });

    it('should show breadcrumbs and hide search indicator', () => {
      // Setup mock DOM elements
      const breadcrumbs = document.createElement('div');
      breadcrumbs.className = 'media-library-breadcrumbs d-none';
      modal.breadcrumbs = breadcrumbs;

      const searchIndicator = document.createElement('div');
      searchIndicator.className = 'media-library-search-indicator';
      searchIndicator.innerHTML = '<strong class="search-term">test</strong>';
      modal.searchIndicator = searchIndicator;

      // Call showBreadcrumbs
      modal.showBreadcrumbs();

      expect(breadcrumbs.classList.contains('d-none')).toBe(false);
      expect(searchIndicator.classList.contains('d-none')).toBe(true);
    });
  });

  describe('clearSearchAndNavigate', () => {
    it('should clear search input and navigate to folder', () => {
      modal.searchInput.value = 'test';
      modal.isSearchMode = true;
      const navigateSpy = vi.spyOn(modal, 'navigateToFolder');
      modal.clearSearchAndNavigate('some/path');
      expect(modal.searchInput.value).toBe('');
      expect(modal.isSearchMode).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith('some/path');
    });
  });

  describe('sortAssets', () => {
    it('should sort by name desc', () => {
      modal.sortBy = 'name-desc';
      modal.filteredAssets = [
        { filename: 'a' },
        { filename: 'z' },
      ];
      modal.sortAssets();
      expect(modal.filteredAssets[0].filename).toBe('z');
    });
  });

  describe('renderGrid/renderList', () => {
    it('should show empty state when no assets', () => {
      modal.renderGrid([]);
      expect(modal.emptyState.classList.contains('visible')).toBe(true);
      expect(modal.grid.style.display).toBe('none');
    });

    it('should hide empty state when has assets', () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      modal.renderGrid([asset]);
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('grid');
    });

    it('should render grid and list items', () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      modal.renderGrid([asset]);
      expect(modal.grid.querySelectorAll('.media-library-item').length).toBe(1);
      modal.renderList([asset]);
      expect(modal.listTbody.querySelectorAll('tr').length).toBe(1);
    });
  });

  describe('showEmptyState/hideEmptyState', () => {
    it('should show empty state and hide grid/list', () => {
      modal.showEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(true);
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('none');
    });

    it('should hide empty state and show grid in grid mode', () => {
      modal.viewMode = 'grid';
      modal.hideEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('grid');
      expect(modal.listContainer.style.display).toBe('none');
    });

    it('should hide empty state and show list in list mode', () => {
      modal.viewMode = 'list';
      modal.hideEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('flex');
    });
  });

  describe('selectAsset/showSidebarContent', () => {
    it('should select grid item and show image preview', async () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', size: 10, createdAt: Date.now(), blob: new Blob(['x']) };
      const item = modal.createGridItem(asset);
      modal.grid.appendChild(item);
      await modal.selectAsset(asset, item);
      expect(modal.selectedAsset).toBe(asset);
      expect(modal.previewImg.style.display).toBe('block');
      expect(modal.dimensionsSpan.textContent).toContain('640');
    });

    it('should show Unknown for image dimensions when getImageDimensions returns null', async () => {
      modal.assetManager.getImageDimensions.mockResolvedValueOnce(null);
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', size: 10, createdAt: Date.now(), blob: new Blob(['x']) };
      await modal.showSidebarContent(asset);
      expect(modal.dimensionsSpan.textContent).toBe('Unknown');
    });

    it('should show Unknown for image dimensions when getImageDimensions throws error', async () => {
      modal.assetManager.getImageDimensions.mockRejectedValueOnce(new Error('Failed to get dimensions'));
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', size: 10, createdAt: Date.now(), blob: new Blob(['x']) };
      await modal.showSidebarContent(asset);
      expect(modal.dimensionsSpan.textContent).toBe('Unknown');
    });

    it('should use display:flex for sidebar-content to preserve action buttons layout', async () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      await modal.showSidebarContent(asset);
      // Must be flex, not block - block breaks the flexbox layout and hides action buttons
      expect(modal.sidebarContent.style.display).toBe('flex');
    });

    it('should show video/audio/pdf/file previews', async () => {
      const video = { id: 'v', filename: 'a.mp4', mime: 'video/mp4', blob: new Blob(['x']) };
      await modal.showSidebarContent(video);
      expect(modal.previewVideo.style.display).toBe('block');

      const audio = { id: 'a', filename: 'a.mp3', mime: 'audio/mpeg', blob: new Blob(['x']) };
      await modal.showSidebarContent(audio);
      expect(modal.previewAudio.style.display).toBe('block');

      const pdf = { id: 'p', filename: 'a.pdf', mime: 'application/pdf', blob: new Blob(['x']) };
      await modal.showSidebarContent(pdf);
      expect(modal.previewPdf.style.display).toBe('block');

      const other = { id: 'o', filename: 'a.txt', mime: 'text/plain', blob: new Blob(['x']) };
      await modal.showSidebarContent(other);
      expect(modal.previewFile.style.display).toBe('flex');
    });
  });

  describe('uploadFiles', () => {
    it('should upload files and reload assets', async () => {
      const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();
      const file = new File(['x'], 'sample.png', { type: 'image/png' });
      await modal.uploadFiles([file]);
      // Now uploads to current folder (empty = root by default)
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalledWith(file, { folderPath: '' });
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should upload files to current folder', async () => {
      const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();
      modal.currentPath = 'images/icons';
      const file = new File(['x'], 'icon.svg', { type: 'image/svg+xml' });
      await modal.uploadFiles([file]);
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalledWith(file, { folderPath: 'images/icons' });
      expect(loadSpy).toHaveBeenCalled();
      modal.currentPath = ''; // Reset
    });

    it('should keep going when upload fails', async () => {
      window.eXeLearning.app.project._yjsBridge.assetManager.insertImage.mockRejectedValueOnce(new Error('fail'));
      const file = new File(['x'], 'sample.png', { type: 'image/png' });
      await modal.uploadFiles([file]);
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalled();
    });
  });

  describe('deleteSelectedAsset', () => {
    it('should delete selected asset when confirmed', async () => {
      modal.selectedAsset = { id: '1' };
      const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();
      await modal.deleteSelectedAsset();
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.deleteAsset).toHaveBeenCalledWith('1');
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should not delete when confirm is false', async () => {
      global.confirm.mockReturnValueOnce(false);
      modal.selectedAsset = { id: '1' };
      await modal.deleteSelectedAsset();
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.deleteAsset).not.toHaveBeenCalled();
    });

    it('should delete all selected assets in batch when confirmed', async () => {
      modal.selectedAssets = [{ id: '1' }, { id: '2' }];
      const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();

      await modal.deleteSelectedAsset();

      expect(window.eXeLearning.app.project._yjsBridge.assetManager.deleteAsset).toHaveBeenCalledTimes(2);
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.deleteAsset).toHaveBeenCalledWith('1');
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.deleteAsset).toHaveBeenCalledWith('2');
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('generateUniqueCopyName', () => {
    it('should generate name with (copy) suffix when no conflict', () => {
      const result = modal.generateUniqueCopyName('image.png', []);
      expect(result).toBe('image (copy).png');
    });

    it('should generate name with (copy) (1) when copy exists', () => {
      const result = modal.generateUniqueCopyName('image.png', ['image (copy).png']);
      expect(result).toBe('image (copy) (1).png');
    });

    it('should generate name with (copy) (2) when copy and (1) exist', () => {
      const result = modal.generateUniqueCopyName('image.png', ['image (copy).png', 'image (copy) (1).png']);
      expect(result).toBe('image (copy) (2).png');
    });

    it('should handle case-insensitive comparison', () => {
      const result = modal.generateUniqueCopyName('Image.PNG', ['IMAGE (copy).PNG']);
      expect(result).toBe('Image (copy) (1).PNG');
    });

    it('should handle files without extension', () => {
      const result = modal.generateUniqueCopyName('README', []);
      expect(result).toBe('README (copy)');
    });

    it('should handle files without extension with conflicts', () => {
      const result = modal.generateUniqueCopyName('README', ['README (copy)', 'README (copy) (1)']);
      expect(result).toBe('README (copy) (2)');
    });

    it('should handle multiple dots in filename', () => {
      const result = modal.generateUniqueCopyName('file.backup.tar.gz', []);
      expect(result).toBe('file.backup.tar (copy).gz');
    });
  });

  describe('duplicateSelectedAsset', () => {
    it('should duplicate asset with unique name', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: '' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: '' }];

      // Mock prompt to return the suggested name (which is 'image (copy).png')
      window.prompt.mockReturnValueOnce('image (copy).png');

      await modal.duplicateSelectedAsset();

      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ folderPath: '', forceNewId: true })
      );
      const insertedFile = window.eXeLearning.app.project._yjsBridge.assetManager.insertImage.mock.calls[0][0];
      expect(insertedFile.name).toBe('image (copy).png');
    });

    it('should generate unique name when copy already exists', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: '' };
      modal.assets = [
        { id: '1', filename: 'image.png', folderPath: '' },
        { id: '2', filename: 'image (copy).png', folderPath: '' }
      ];

      // Mock prompt to return the suggested unique name
      window.prompt.mockReturnValueOnce('image (copy) (1).png');

      await modal.duplicateSelectedAsset();

      const insertedFile = window.eXeLearning.app.project._yjsBridge.assetManager.insertImage.mock.calls[0][0];
      expect(insertedFile.name).toBe('image (copy) (1).png');
    });

    it('should duplicate in same folder', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: 'images/icons' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: 'images/icons' }];

      // Mock prompt to return the suggested name
      window.prompt.mockReturnValueOnce('image (copy).png');

      await modal.duplicateSelectedAsset();

      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ folderPath: 'images/icons', forceNewId: true })
      );
    });

    it('should not duplicate if no asset selected', async () => {
      modal.selectedAsset = null;
      await modal.duplicateSelectedAsset();
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).not.toHaveBeenCalled();
    });

    it('should not duplicate if user cancels prompt', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: '' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: '' }];

      // Mock prompt to return null (user cancelled)
      window.prompt.mockReturnValueOnce(null);

      await modal.duplicateSelectedAsset();

      expect(modal.assetManager.insertImage).not.toHaveBeenCalled();
    });

    it('should show error if user enters empty name', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: '' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: '' }];

      // Mock prompt to return empty string
      window.prompt.mockReturnValueOnce('   ');

      await modal.duplicateSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Please enter a valid filename', modal: true })
      );
      expect(modal.assetManager.insertImage).not.toHaveBeenCalled();
    });

    it('should show error if name already exists', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', blob, folderPath: '' };
      modal.assets = [
        { id: '1', filename: 'image.png', folderPath: '' },
        { id: '2', filename: 'existing.png', folderPath: '' }
      ];

      // Mock prompt to return a name that already exists
      window.prompt.mockReturnValueOnce('existing.png');

      await modal.duplicateSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'A file with this name already exists in this folder', modal: true })
      );
      expect(modal.assetManager.insertImage).not.toHaveBeenCalled();
    });

    it('should fetch blob if not present on asset', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', folderPath: '' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: '' }];
      modal.assetManager.getAsset.mockResolvedValue({ blob });

      // Mock prompt to return the suggested name
      window.prompt.mockReturnValueOnce('image (copy).png');

      await modal.duplicateSelectedAsset();

      expect(modal.assetManager.getAsset).toHaveBeenCalledWith('1');
      expect(modal.assetManager.insertImage).toHaveBeenCalled();
    });

    it('should show error if blob cannot be retrieved', async () => {
      modal.selectedAsset = { id: '1', filename: 'image.png', mime: 'image/png', folderPath: '' };
      modal.assets = [{ id: '1', filename: 'image.png', folderPath: '' }];
      modal.assetManager.getAsset.mockResolvedValue(null);

      await modal.duplicateSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Could not read file', modal: true })
      );
      expect(modal.assetManager.insertImage).not.toHaveBeenCalled();
    });
  });

  describe('insertSelectedAsset', () => {
    it('should call onSelect callback and close', () => {
      modal.selectedAsset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      const cb = vi.fn();
      const closeSpy = vi.spyOn(modal, 'close');
      modal.onSelectCallback = cb;
      modal.insertSelectedAsset();
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ assetUrl: 'asset://1.png' }));
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should insert into editor when available', () => {
      window.tinymce = { activeEditor: { insertContent: vi.fn() } };
      modal.selectedAsset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      const closeSpy = vi.spyOn(modal, 'close');
      modal.insertSelectedAsset();
      expect(window.tinymce.activeEditor.insertContent).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should copy to clipboard when no editor', async () => {
      window.tinymce = null;
      modal.selectedAsset = { id: '1', filename: 'a.txt', mime: 'text/plain' };
      modal.insertSelectedAsset();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('asset://1.txt');
    });

    it('should insert HTML as iframe with data-mce-html attribute', () => {
      window.tinymce = { activeEditor: { insertContent: vi.fn() } };
      modal.selectedAsset = {
        id: 'abc12345-def6-7890-abcd-ef1234567890',
        filename: 'index.html',
        mime: 'text/html',
        blob: new Blob(['<html><body>Test</body></html>'], { type: 'text/html' }),
      };

      modal.insertSelectedAsset();

      // HTML files should be inserted as iframe with data-mce-html attribute
      expect(window.tinymce.activeEditor.insertContent).toHaveBeenCalledWith(
        expect.stringContaining('data-mce-html="true"')
      );
      expect(window.tinymce.activeEditor.insertContent).toHaveBeenCalledWith(
        expect.stringContaining('<iframe')
      );
      expect(window.tinymce.activeEditor.insertContent).toHaveBeenCalledWith(
        expect.stringContaining('asset://abc12345-def6-7890-abcd-ef1234567890')
      );
    });

    it('should detect HTML by file extension for .htm files', () => {
      window.tinymce = { activeEditor: { insertContent: vi.fn() } };
      modal.selectedAsset = {
        id: 'def56789-0abc-1234-5678-90abcdef1234',
        filename: 'page.htm',
        mime: 'text/html',
        blob: new Blob(['<html><body>HTM file</body></html>'], { type: 'text/html' }),
      };

      modal.insertSelectedAsset();

      expect(window.tinymce.activeEditor.insertContent).toHaveBeenCalledWith(
        expect.stringContaining('data-mce-html="true"')
      );
    });

    it('should not add data-mce-html for non-HTML files', () => {
      window.tinymce = { activeEditor: { insertContent: vi.fn() } };
      modal.selectedAsset = {
        id: 'pdf-uuid-1234',
        filename: 'document.pdf',
        mime: 'application/pdf',
        blob: new Blob(['PDF content'], { type: 'application/pdf' }),
      };

      modal.insertSelectedAsset();

      // PDF files should not have data-mce-html attribute
      expect(window.tinymce.activeEditor.insertContent).not.toHaveBeenCalledWith(
        expect.stringContaining('data-mce-html="true"')
      );
    });
  });

  // Note: selectAsset HTML resolution with resolveHtmlWithAssets is tested
  // via E2E tests in text.spec.ts which covers the full ZIP extraction and
  // HTML insertion flow with proper CSS resolution. The insertSelectedAsset
  // tests above verify the data-mce-html attribute is added for HTML files.

  describe('close', () => {
    it('should reset preview and state', () => {
      modal.previewVideo.src = 'blob:video';
      modal.previewAudio.src = 'blob:audio';
      modal.selectedAsset = { id: '1' };
      modal.onSelectCallback = vi.fn();
      modal.acceptFilter = 'image';
      modal.searchInput.value = 'query';
      modal.close();
      expect(modal.previewVideo.getAttribute('src') || '').toBe('');
      expect(modal.previewAudio.getAttribute('src') || '').toBe('');
      expect(modal.selectedAsset).toBeNull();
      expect(modal.onSelectCallback).toBeNull();
      expect(modal.acceptFilter).toBeNull();
      expect(modal.searchInput.value).toBe('');
      expect(modal.currentPage).toBe(1);
    });

    it('should reset typeFilter and filterSelect', () => {
      modal.typeFilter = 'image';
      modal.filterSelect.value = 'image';
      modal.close();
      expect(modal.typeFilter).toBe('');
      expect(modal.filterSelect.value).toBe('');
    });
  });

  describe('getAssetTypeCategory', () => {
    it('should return image for image mime types', () => {
      expect(modal.getAssetTypeCategory('image/png')).toBe('image');
      expect(modal.getAssetTypeCategory('image/jpeg')).toBe('image');
      expect(modal.getAssetTypeCategory('image/gif')).toBe('image');
    });

    it('should return video for video mime types', () => {
      expect(modal.getAssetTypeCategory('video/mp4')).toBe('video');
      expect(modal.getAssetTypeCategory('video/webm')).toBe('video');
    });

    it('should return audio for audio mime types', () => {
      expect(modal.getAssetTypeCategory('audio/mpeg')).toBe('audio');
      expect(modal.getAssetTypeCategory('audio/wav')).toBe('audio');
    });

    it('should return pdf for application/pdf', () => {
      expect(modal.getAssetTypeCategory('application/pdf')).toBe('pdf');
    });

    it('should return other for unknown types', () => {
      expect(modal.getAssetTypeCategory('application/json')).toBe('other');
      expect(modal.getAssetTypeCategory('text/plain')).toBe('other');
      expect(modal.getAssetTypeCategory('')).toBe('other');
      expect(modal.getAssetTypeCategory(null)).toBe('other');
      expect(modal.getAssetTypeCategory(undefined)).toBe('other');
    });
  });

  describe('updateFilterOptions', () => {
    it('should populate filter options based on available asset types', () => {
      modal.assets = [
        { id: '1', filename: 'a.png', mime: 'image/png' },
        { id: '2', filename: 'b.mp4', mime: 'video/mp4' },
        { id: '3', filename: 'c.pdf', mime: 'application/pdf' },
      ];
      modal.updateFilterOptions();

      const options = modal.filterSelect.querySelectorAll('option');
      expect(options.length).toBe(4); // All + image + video + pdf
      expect(options[0].value).toBe('');
      expect(options[1].value).toBe('image');
      expect(options[2].value).toBe('video');
      expect(options[3].value).toBe('pdf');
    });

    it('should only show types that exist', () => {
      modal.assets = [
        { id: '1', filename: 'a.png', mime: 'image/png' },
      ];
      modal.updateFilterOptions();

      const options = modal.filterSelect.querySelectorAll('option');
      expect(options.length).toBe(2); // All + image
      expect(options[1].value).toBe('image');
    });

    it('should reset typeFilter if current filter type no longer exists', () => {
      modal.typeFilter = 'video';
      modal.assets = [
        { id: '1', filename: 'a.png', mime: 'image/png' },
      ];
      modal.updateFilterOptions();

      expect(modal.typeFilter).toBe('');
      expect(modal.filterSelect.value).toBe('');
    });
  });

  describe('type filtering', () => {
    it('should filter assets by type', () => {
      modal.assets = [
        { id: '1', filename: 'a.png', mime: 'image/png' },
        { id: '2', filename: 'b.mp4', mime: 'video/mp4' },
        { id: '3', filename: 'c.mp3', mime: 'audio/mpeg' },
      ];
      modal.typeFilter = 'image';
      const renderSpy = vi.spyOn(modal, 'renderCurrentView');
      modal.applyFiltersAndRender();

      expect(modal.filteredAssets.length).toBe(1);
      expect(modal.filteredAssets[0].mime).toBe('image/png');
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should show all when typeFilter is empty', () => {
      modal.assets = [
        { id: '1', filename: 'a.png', mime: 'image/png' },
        { id: '2', filename: 'b.mp4', mime: 'video/mp4' },
      ];
      modal.typeFilter = '';
      modal.applyFiltersAndRender();

      expect(modal.filteredAssets.length).toBe(2);
    });

    it('should combine typeFilter with search', () => {
      modal.assets = [
        { id: '1', filename: 'cat.png', mime: 'image/png' },
        { id: '2', filename: 'dog.png', mime: 'image/png' },
        { id: '3', filename: 'cat.mp4', mime: 'video/mp4' },
      ];
      modal.typeFilter = 'image';
      modal.searchInput.value = 'cat';
      modal.applyFiltersAndRender();

      expect(modal.filteredAssets.length).toBe(1);
      expect(modal.filteredAssets[0].filename).toBe('cat.png');
    });

    it('should update filter on select change', () => {
      // Add image option to filter select (simulating updateFilterOptions)
      const option = document.createElement('option');
      option.value = 'image';
      option.textContent = 'Images';
      modal.filterSelect.appendChild(option);

      const applySpy = vi.spyOn(modal, 'applyFiltersAndRender');
      modal.filterSelect.value = 'image';
      modal.filterSelect.dispatchEvent(new Event('change'));
      expect(modal.typeFilter).toBe('image');
      expect(modal.currentPage).toBe(1);
      expect(applySpy).toHaveBeenCalled();
    });
  });

  describe('type sorting', () => {
    it('should sort by type ascending', () => {
      modal.sortBy = 'type-asc';
      modal.filteredAssets = [
        { filename: 'a', mime: 'video/mp4' },
        { filename: 'b', mime: 'audio/mpeg' },
        { filename: 'c', mime: 'image/png' },
      ];
      modal.sortAssets();
      expect(modal.filteredAssets[0].mime).toBe('audio/mpeg');
      expect(modal.filteredAssets[1].mime).toBe('image/png');
      expect(modal.filteredAssets[2].mime).toBe('video/mp4');
    });

    it('should sort by type descending', () => {
      modal.sortBy = 'type-desc';
      modal.filteredAssets = [
        { filename: 'a', mime: 'audio/mpeg' },
        { filename: 'b', mime: 'video/mp4' },
        { filename: 'c', mime: 'image/png' },
      ];
      modal.sortAssets();
      expect(modal.filteredAssets[0].mime).toBe('video/mp4');
      expect(modal.filteredAssets[1].mime).toBe('image/png');
      expect(modal.filteredAssets[2].mime).toBe('audio/mpeg');
    });
  });

  describe('extractZipAsset', () => {
    it('should not extract if no asset selected', async () => {
      modal.selectedAsset = null;
      await modal.extractZipAsset();
      // Should return early without error
    });

    it('should not extract if file is not a ZIP', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.png', mime: 'image/png' };
      const warnSpy = vi.spyOn(console, 'warn');
      await modal.extractZipAsset();
      expect(warnSpy).toHaveBeenCalledWith('[MediaLibrary] Selected file is not a ZIP');
    });

    it('should show extract button only for ZIP files', async () => {
      // Extract button should be visible (no d-none class) for ZIP files
      // and hidden (has d-none class) for non-ZIP files

      // Test with ZIP file
      const zipAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      modal.selectedAsset = zipAsset;
      await modal.showSidebarContent(zipAsset);
      expect(modal.extractBtn.classList.contains('d-none')).toBe(false);

      // Test with non-ZIP file
      const pngAsset = { id: '2', filename: 'test.png', mime: 'image/png', blob: new Blob(['x']) };
      modal.selectedAsset = pngAsset;
      await modal.showSidebarContent(pngAsset);
      expect(modal.extractBtn.classList.contains('d-none')).toBe(true);
    });

    it('should not extract if user cancels prompt', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      vi.spyOn(window, 'prompt').mockReturnValue(null); // User clicked Cancel
      const loadSpy = vi.spyOn(modal, 'loadAssets');
      await modal.extractZipAsset();
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should show error if blob is not available', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: null };
      modal.assetManager.getAsset = vi.fn().mockResolvedValue(null);
      vi.spyOn(window, 'prompt').mockReturnValue('extracted-folder');
      await modal.extractZipAsset();
      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Could not read ZIP file', modal: true })
      );
    });

    it('should show error if fflate is not available', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      vi.spyOn(window, 'prompt').mockReturnValue('extracted-folder');
      const originalFflate = window.fflate;
      window.fflate = undefined;
      await modal.extractZipAsset();
      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'ZIP extraction is not available', modal: true })
      );
      window.fflate = originalFflate;
    });

    it('should extract files from ZIP and reload assets', async () => {
      // Mock fflate
      window.fflate = {
        unzipSync: vi.fn().mockReturnValue({
          'file1.png': new Uint8Array([1, 2, 3]),
          'folder/file2.jpg': new Uint8Array([4, 5, 6]),
          '.hidden': new Uint8Array([7, 8, 9]),
          '__system': new Uint8Array([10, 11, 12]),
        })
      };

      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['zipdata']) };
      vi.spyOn(window, 'prompt').mockReturnValue('test');
      modal.assetManager.insertImage = vi.fn().mockResolvedValue({ id: 'new-id' });
      const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();

      await modal.extractZipAsset();

      expect(window.fflate.unzipSync).toHaveBeenCalled();
      // Should have inserted 2 files (skipping hidden and system files)
      expect(modal.assetManager.insertImage).toHaveBeenCalledTimes(2);
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should handle extraction errors gracefully', async () => {
      window.fflate = {
        unzipSync: vi.fn().mockImplementation(() => { throw new Error('Invalid ZIP'); })
      };

      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['bad']) };
      vi.spyOn(window, 'prompt').mockReturnValue('test');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await modal.extractZipAsset();

      expect(consoleSpy).toHaveBeenCalled();
      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Failed to extract ZIP file', modal: true })
      );
    });

    it('should detect ZIP by extension when mime is not set', async () => {
      modal.selectedAsset = { id: '1', filename: 'archive.ZIP', mime: 'application/octet-stream', blob: new Blob(['x']) };
      vi.spyOn(window, 'prompt').mockReturnValue(null); // User cancels
      // Should not warn about non-ZIP (means it detected it as ZIP)
      const warnSpy = vi.spyOn(console, 'warn');
      await modal.extractZipAsset();
      expect(warnSpy).not.toHaveBeenCalledWith('[MediaLibrary] Selected file is not a ZIP');
    });
  });

  describe('getMimeTypeFromFilename', () => {
    it('should return correct mime types for image extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.jpg')).toBe('image/jpeg');
      expect(modal.getMimeTypeFromFilename('test.jpeg')).toBe('image/jpeg');
      expect(modal.getMimeTypeFromFilename('test.png')).toBe('image/png');
      expect(modal.getMimeTypeFromFilename('test.gif')).toBe('image/gif');
      expect(modal.getMimeTypeFromFilename('test.webp')).toBe('image/webp');
      expect(modal.getMimeTypeFromFilename('test.svg')).toBe('image/svg+xml');
      expect(modal.getMimeTypeFromFilename('test.bmp')).toBe('image/bmp');
      expect(modal.getMimeTypeFromFilename('test.ico')).toBe('image/x-icon');
    });

    it('should return correct mime types for video extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.mp4')).toBe('video/mp4');
      expect(modal.getMimeTypeFromFilename('test.webm')).toBe('video/webm');
      expect(modal.getMimeTypeFromFilename('test.mov')).toBe('video/quicktime');
      expect(modal.getMimeTypeFromFilename('test.avi')).toBe('video/x-msvideo');
    });

    it('should return correct mime types for audio extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.mp3')).toBe('audio/mpeg');
      expect(modal.getMimeTypeFromFilename('test.wav')).toBe('audio/wav');
      expect(modal.getMimeTypeFromFilename('test.flac')).toBe('audio/flac');
      expect(modal.getMimeTypeFromFilename('test.m4a')).toBe('audio/mp4');
    });

    it('should return correct mime types for document extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.pdf')).toBe('application/pdf');
      expect(modal.getMimeTypeFromFilename('test.doc')).toBe('application/msword');
      expect(modal.getMimeTypeFromFilename('test.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(modal.getMimeTypeFromFilename('test.xls')).toBe('application/vnd.ms-excel');
      expect(modal.getMimeTypeFromFilename('test.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(modal.getMimeTypeFromFilename('test.ppt')).toBe('application/vnd.ms-powerpoint');
      expect(modal.getMimeTypeFromFilename('test.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });

    it('should return correct mime types for other extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.zip')).toBe('application/zip');
      expect(modal.getMimeTypeFromFilename('test.json')).toBe('application/json');
      expect(modal.getMimeTypeFromFilename('test.xml')).toBe('application/xml');
      expect(modal.getMimeTypeFromFilename('test.html')).toBe('text/html');
      expect(modal.getMimeTypeFromFilename('test.css')).toBe('text/css');
      expect(modal.getMimeTypeFromFilename('test.js')).toBe('application/javascript');
      expect(modal.getMimeTypeFromFilename('test.txt')).toBe('text/plain');
      expect(modal.getMimeTypeFromFilename('test.md')).toBe('text/markdown');
      expect(modal.getMimeTypeFromFilename('test.csv')).toBe('text/csv');
      expect(modal.getMimeTypeFromFilename('test.stl')).toBe('model/stl');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(modal.getMimeTypeFromFilename('test.xyz')).toBe('application/octet-stream');
      expect(modal.getMimeTypeFromFilename('noextension')).toBe('application/octet-stream');
    });

    it('should handle uppercase extensions', () => {
      expect(modal.getMimeTypeFromFilename('TEST.JPG')).toBe('image/jpeg');
      expect(modal.getMimeTypeFromFilename('TEST.PDF')).toBe('application/pdf');
    });
  });

  describe('getFileIcon', () => {
    it('should return correct icon for mime types', () => {
      expect(modal.getFileIcon('image/png', 'test.png')).toBe('image');
      expect(modal.getFileIcon('video/mp4', 'test.mp4')).toBe('videocam');
      expect(modal.getFileIcon('audio/mpeg', 'test.mp3')).toBe('audiotrack');
      expect(modal.getFileIcon('application/pdf', 'test.pdf')).toBe('picture_as_pdf');
      expect(modal.getFileIcon('application/zip', 'test.zip')).toBe('folder_zip');
    });

    it('should return correct icon for file extensions', () => {
      expect(modal.getFileIcon(null, 'test.zip')).toBe('folder_zip');
      expect(modal.getFileIcon(null, 'test.elp')).toBe('school');
      expect(modal.getFileIcon(null, 'test.elpx')).toBe('school');
      expect(modal.getFileIcon(null, 'test.stl')).toBe('view_in_ar');
      expect(modal.getFileIcon(null, 'test.docx')).toBe('description');
      expect(modal.getFileIcon(null, 'test.xlsx')).toBe('table_chart');
      expect(modal.getFileIcon(null, 'test.pptx')).toBe('slideshow');
      expect(modal.getFileIcon(null, 'test.txt')).toBe('article');
      expect(modal.getFileIcon(null, 'test.html')).toBe('code');
      expect(modal.getFileIcon(null, 'test.js')).toBe('terminal');
    });

    it('should return default icon for unknown types', () => {
      expect(modal.getFileIcon(null, 'test.unknown')).toBe('insert_drive_file');
      expect(modal.getFileIcon(null, null)).toBe('insert_drive_file');
      expect(modal.getFileIcon('application/octet-stream', 'file')).toBe('insert_drive_file');
    });
  });

  describe('drag and drop', () => {
    it('should initialize drag and drop on main area', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      expect(mainArea).not.toBeNull();
    });

    it('should add drag-over class on dragenter', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      const event = new Event('dragenter', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      mainArea.dispatchEvent(event);
      expect(mainArea.classList.contains('drag-over')).toBe(true);
    });

    it('should remove drag-over class on dragleave', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      // First enter
      const enterEvent = new Event('dragenter', { bubbles: true });
      enterEvent.preventDefault = vi.fn();
      enterEvent.stopPropagation = vi.fn();
      mainArea.dispatchEvent(enterEvent);
      // Then leave
      const leaveEvent = new Event('dragleave', { bubbles: true });
      leaveEvent.preventDefault = vi.fn();
      leaveEvent.stopPropagation = vi.fn();
      mainArea.dispatchEvent(leaveEvent);
      expect(mainArea.classList.contains('drag-over')).toBe(false);
    });

    it('should upload files on drop', async () => {
      const uploadSpy = vi.spyOn(modal, 'uploadFiles').mockResolvedValue();
      const mainArea = mockElement.querySelector('.media-library-main');
      const file = new File(['x'], 'test.png', { type: 'image/png' });

      const dropEvent = new Event('drop', { bubbles: true });
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer = { files: [file] };

      mainArea.dispatchEvent(dropEvent);
      expect(uploadSpy).toHaveBeenCalledWith([file]);
    });

    it('should show dropzone overlay on drag', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      modal.showDropzoneOverlay(mainArea);
      expect(mainArea.querySelector('.media-library-dropzone-overlay')).not.toBeNull();
    });

    it('should hide dropzone overlay', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      modal.showDropzoneOverlay(mainArea);
      modal.hideDropzoneOverlay(mainArea);
      expect(mainArea.querySelector('.media-library-dropzone-overlay')).toBeNull();
    });

    it('should not show overlay when empty state is visible', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      // Make empty state visible
      modal.emptyState.classList.add('visible');

      // Trigger dragenter
      const event = new Event('dragenter', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      mainArea.dispatchEvent(event);

      // Should add drag-over class but NOT show overlay
      expect(mainArea.classList.contains('drag-over')).toBe(true);
      expect(mainArea.querySelector('.media-library-dropzone-overlay')).toBeNull();
    });

    it('should show overlay when empty state is not visible', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      // Ensure empty state is not visible
      modal.emptyState.classList.remove('visible');

      // Trigger dragenter
      const event = new Event('dragenter', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      mainArea.dispatchEvent(event);

      expect(mainArea.classList.contains('drag-over')).toBe(true);
      expect(mainArea.querySelector('.media-library-dropzone-overlay')).not.toBeNull();
    });

    it('should prevent default on dragover', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();
      event.stopPropagation = vi.fn();
      mainArea.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should handle drop with no files gracefully', async () => {
      const uploadSpy = vi.spyOn(modal, 'uploadFiles').mockResolvedValue();
      const mainArea = mockElement.querySelector('.media-library-main');

      const dropEvent = new Event('drop', { bubbles: true });
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer = { files: [] };

      mainArea.dispatchEvent(dropEvent);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('should handle drop with null dataTransfer', async () => {
      const uploadSpy = vi.spyOn(modal, 'uploadFiles').mockResolvedValue();
      const mainArea = mockElement.querySelector('.media-library-main');

      const dropEvent = new Event('drop', { bubbles: true });
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer = null;

      mainArea.dispatchEvent(dropEvent);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('should remove existing overlay before showing new one', () => {
      const mainArea = mockElement.querySelector('.media-library-main');
      // Show overlay twice
      modal.showDropzoneOverlay(mainArea);
      modal.showDropzoneOverlay(mainArea);
      // Should only have one overlay
      const overlays = mainArea.querySelectorAll('.media-library-dropzone-overlay');
      expect(overlays.length).toBe(1);
    });
  });

  describe('triggerAssetFetch', () => {
    it('should request asset via WebSocket handler when available', async () => {
      const mockWsHandler = {
        requestAsset: vi.fn().mockResolvedValue(),
      };
      window.eXeLearning.app.project._yjsBridge.assetWebSocketHandler = mockWsHandler;

      modal.triggerAssetFetch('test-asset-id');

      expect(mockWsHandler.requestAsset).toHaveBeenCalledWith('test-asset-id');
      expect(modal.assetManager.pendingFetches.has('test-asset-id')).toBe(true);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(modal.assetManager.pendingFetches.has('test-asset-id')).toBe(false);
    });

    it('should not request if asset is already being fetched', () => {
      const mockWsHandler = {
        requestAsset: vi.fn().mockResolvedValue(),
      };
      window.eXeLearning.app.project._yjsBridge.assetWebSocketHandler = mockWsHandler;

      // Add to pending
      modal.assetManager.pendingFetches.add('test-asset-id');

      modal.triggerAssetFetch('test-asset-id');

      expect(mockWsHandler.requestAsset).not.toHaveBeenCalled();
    });

    it('should not fail when WebSocket handler is not available', () => {
      window.eXeLearning.app.project._yjsBridge.assetWebSocketHandler = null;

      // Should not throw
      expect(() => modal.triggerAssetFetch('test-asset-id')).not.toThrow();
    });

    it('should call updateDomImagesForAsset when P2P fetch succeeds', async () => {
      const mockUpdateDom = vi.fn().mockResolvedValue(1);
      modal.assetManager.updateDomImagesForAsset = mockUpdateDom;

      const mockWsHandler = {
        requestAsset: vi.fn().mockResolvedValue(true), // Success
      };
      window.eXeLearning.app.project._yjsBridge.assetWebSocketHandler = mockWsHandler;

      modal.triggerAssetFetch('test-asset-id');

      // Wait for promises to resolve
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockUpdateDom).toHaveBeenCalledWith('test-asset-id');
    });

    it('should not call updateDomImagesForAsset when P2P fetch fails', async () => {
      const mockUpdateDom = vi.fn().mockResolvedValue(1);
      modal.assetManager.updateDomImagesForAsset = mockUpdateDom;

      const mockWsHandler = {
        requestAsset: vi.fn().mockResolvedValue(false), // Failed
      };
      window.eXeLearning.app.project._yjsBridge.assetWebSocketHandler = mockWsHandler;

      modal.triggerAssetFetch('test-asset-id');

      // Wait for promises to resolve
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockUpdateDom).not.toHaveBeenCalled();
    });

    it('should use loading placeholder in createGridItem when blob is not available', () => {
      const asset = { id: 'peer-asset', filename: 'test.jpg', mime: 'image/jpeg' };
      // No blob, no cache
      modal.assetManager.blobURLCache.clear();

      const item = modal.createGridItem(asset);

      const img = item.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('data:image/svg+xml');
      expect(img.getAttribute('data-asset-id')).toBe('peer-asset');
      expect(img.getAttribute('data-asset-loading')).toBe('true');
    });
  });

  describe('Yjs observers', () => {
    let mockYMap;

    beforeEach(() => {
      // Create mock Y.Map with observe/unobserve
      mockYMap = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };
      modal.assetManager.getAssetsYMap = vi.fn(() => mockYMap);
    });

    describe('_subscribeToYjsChanges', () => {
      it('should subscribe to Yjs assets map changes', () => {
        modal._subscribeToYjsChanges();

        expect(modal.assetManager.getAssetsYMap).toHaveBeenCalled();
        expect(mockYMap.observe).toHaveBeenCalledWith(expect.any(Function));
        expect(modal._assetsMap).toBe(mockYMap);
        expect(modal._onYjsAssetsChange).toBeDefined();
      });

      it('should not subscribe when Yjs map is not available', () => {
        modal.assetManager.getAssetsYMap = vi.fn(() => null);

        modal._subscribeToYjsChanges();

        expect(mockYMap.observe).not.toHaveBeenCalled();
        expect(modal._assetsMap).toBeUndefined();
      });

      it('should not subscribe when assetManager is null', () => {
        modal.assetManager = null;

        modal._subscribeToYjsChanges();

        expect(mockYMap.observe).not.toHaveBeenCalled();
      });
    });

    describe('_unsubscribeFromYjsChanges', () => {
      it('should unsubscribe from Yjs map when subscribed', () => {
        // First subscribe
        modal._subscribeToYjsChanges();
        const handler = modal._onYjsAssetsChange;

        // Then unsubscribe
        modal._unsubscribeFromYjsChanges();

        expect(mockYMap.unobserve).toHaveBeenCalledWith(handler);
        expect(modal._assetsMap).toBeNull();
        expect(modal._onYjsAssetsChange).toBeNull();
      });

      it('should do nothing when not subscribed', () => {
        modal._assetsMap = null;
        modal._onYjsAssetsChange = null;

        modal._unsubscribeFromYjsChanges();

        expect(mockYMap.unobserve).not.toHaveBeenCalled();
      });
    });

    describe('_handleYjsAssetsChange', () => {
      it('should reload assets on remote Yjs change', () => {
        const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();
        const event = {
          transaction: { local: false }
        };

        modal._handleYjsAssetsChange(event);

        expect(loadSpy).toHaveBeenCalled();
      });

      it('should ignore local Yjs changes', () => {
        const loadSpy = vi.spyOn(modal, 'loadAssets').mockResolvedValue();
        const event = {
          transaction: { local: true }
        };

        modal._handleYjsAssetsChange(event);

        expect(loadSpy).not.toHaveBeenCalled();
      });

      it('should refresh sidebar when selectedAsset exists and is found after reload', async () => {
        const testAsset = { id: 'asset-1', filename: 'test.jpg', mime: 'image/jpeg' };
        const updatedAsset = { id: 'asset-1', filename: 'test-updated.jpg', mime: 'image/jpeg' };
        modal.selectedAsset = testAsset;
        modal.assets = [updatedAsset];

        const showSidebarSpy = vi.spyOn(modal, 'showSidebarContent').mockResolvedValue();
        vi.spyOn(modal, 'loadAssets').mockResolvedValue();

        const event = { transaction: { local: false } };
        modal._handleYjsAssetsChange(event);

        // Wait for the .then() callback to execute
        await vi.waitFor(() => {
          expect(showSidebarSpy).toHaveBeenCalledWith(updatedAsset);
        });

        expect(modal.selectedAsset).toBe(updatedAsset);
      });

      it('should not refresh sidebar when no selectedAsset', async () => {
        modal.selectedAsset = null;
        modal.assets = [{ id: 'asset-1', filename: 'test.jpg', mime: 'image/jpeg' }];

        const showSidebarSpy = vi.spyOn(modal, 'showSidebarContent').mockResolvedValue();
        vi.spyOn(modal, 'loadAssets').mockResolvedValue();

        const event = { transaction: { local: false } };
        modal._handleYjsAssetsChange(event);

        // Wait a tick for the .then() to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(showSidebarSpy).not.toHaveBeenCalled();
      });

      it('should not refresh sidebar when selectedAsset not found in updated assets', async () => {
        modal.selectedAsset = { id: 'deleted-asset', filename: 'deleted.jpg', mime: 'image/jpeg' };
        modal.assets = [{ id: 'other-asset', filename: 'other.jpg', mime: 'image/jpeg' }];

        const showSidebarSpy = vi.spyOn(modal, 'showSidebarContent').mockResolvedValue();
        vi.spyOn(modal, 'loadAssets').mockResolvedValue();

        const event = { transaction: { local: false } };
        modal._handleYjsAssetsChange(event);

        // Wait a tick for the .then() to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(showSidebarSpy).not.toHaveBeenCalled();
      });
    });

    describe('close unsubscribes from Yjs', () => {
      it('should unsubscribe from Yjs when modal closes', () => {
        // Subscribe first
        modal._subscribeToYjsChanges();
        const unsubSpy = vi.spyOn(modal, '_unsubscribeFromYjsChanges');

        // Close modal
        modal.close();

        expect(unsubSpy).toHaveBeenCalled();
      });
    });
  });

  describe('folder navigation', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assets = [
        { id: 'root1', filename: 'root-file.jpg', folderPath: '', mime: 'image/jpeg' },
        { id: 'docs1', filename: 'doc.pdf', folderPath: 'docs', mime: 'application/pdf' },
        { id: 'docs2', filename: 'note.txt', folderPath: 'docs', mime: 'text/plain' },
        { id: 'sub1', filename: 'nested.jpg', folderPath: 'docs/images', mime: 'image/jpeg' },
        { id: 'deep1', filename: 'deep.png', folderPath: 'docs/images/icons', mime: 'image/png' },
      ];
      modal.createdFolders = new Set();
    });

    describe('deriveSubfolders', () => {
      it('should derive root-level folders', () => {
        const folders = modal.deriveSubfolders(modal.assets, '');
        expect(folders).toEqual(['docs']);
      });

      it('should derive subfolders at a specific path', () => {
        const folders = modal.deriveSubfolders(modal.assets, 'docs');
        expect(folders).toEqual(['images']);
      });

      it('should derive deeply nested subfolders', () => {
        const folders = modal.deriveSubfolders(modal.assets, 'docs/images');
        expect(folders).toEqual(['icons']);
      });

      it('should return empty array for leaf folders', () => {
        const folders = modal.deriveSubfolders(modal.assets, 'docs/images/icons');
        expect(folders).toEqual([]);
      });

      it('should handle assets with no folderPath', () => {
        modal.assets = [
          { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg' },
        ];
        const folders = modal.deriveSubfolders(modal.assets, '');
        expect(folders).toEqual([]);
      });

      it('should sort folders alphabetically case-insensitive', () => {
        modal.assets = [
          { id: 'a1', filename: 'test.jpg', folderPath: 'Zebra', mime: 'image/jpeg' },
          { id: 'a2', filename: 'test2.jpg', folderPath: 'alpha', mime: 'image/jpeg' },
          { id: 'a3', filename: 'test3.jpg', folderPath: 'Beta', mime: 'image/jpeg' },
        ];
        const folders = modal.deriveSubfolders(modal.assets, '');
        expect(folders).toEqual(['alpha', 'Beta', 'Zebra']);
      });
    });

    describe('getCreatedSubfolders', () => {
      it('should return created folders at root level', () => {
        modal.createdFolders = new Set(['empty1', 'empty2']);
        const folders = modal.getCreatedSubfolders('');
        expect(folders).toContain('empty1');
        expect(folders).toContain('empty2');
      });

      it('should return created subfolders at a specific path', () => {
        modal.createdFolders = new Set(['docs/new-folder', 'docs/another']);
        const folders = modal.getCreatedSubfolders('docs');
        expect(folders).toContain('new-folder');
        expect(folders).toContain('another');
      });

      it('should not return folders from other paths', () => {
        modal.createdFolders = new Set(['other/folder', 'docs/subfolder']);
        const folders = modal.getCreatedSubfolders('docs');
        expect(folders).not.toContain('folder');
        expect(folders).toContain('subfolder');
      });

      it('should return unique folder names', () => {
        modal.createdFolders = new Set(['docs/sub', 'docs/sub/nested']);
        const folders = modal.getCreatedSubfolders('docs');
        // Should only have 'sub' once even though it appears in multiple paths
        expect(folders.filter(f => f === 'sub').length).toBe(1);
      });
    });

    describe('loadFolderContents', () => {
      it('should set currentPath', () => {
        modal.loadFolderContents('docs');
        expect(modal.currentPath).toBe('docs');
      });

      it('should filter assets to current folder', () => {
        modal.loadFolderContents('docs');
        expect(modal.filteredAssets.length).toBe(2);
        expect(modal.filteredAssets.map(a => a.id)).toContain('docs1');
        expect(modal.filteredAssets.map(a => a.id)).toContain('docs2');
      });

      it('should derive subfolders for current path', () => {
        modal.loadFolderContents('docs');
        expect(modal.folders).toContain('images');
      });

      it('should include created empty folders', () => {
        modal.createdFolders.add('docs/empty-folder');
        modal.loadFolderContents('docs');
        expect(modal.folders).toContain('empty-folder');
      });

      it('should load root when path is empty', () => {
        modal.loadFolderContents('');
        expect(modal.currentPath).toBe('');
        expect(modal.filteredAssets.length).toBe(1);
        expect(modal.filteredAssets[0].id).toBe('root1');
      });
    });

    describe('navigateToFolder', () => {
      it('should clear selections when navigating', () => {
        modal.selectedAsset = { id: 'test' };
        modal.selectedAssets = [{ id: 'test' }];
        modal.selectedFolder = 'test';

        modal.navigateToFolder('docs');

        expect(modal.selectedAsset).toBeNull();
        expect(modal.selectedAssets).toEqual([]);
        expect(modal.selectedFolder).toBeNull();
      });

      it('should reset to page 1', () => {
        modal.currentPage = 3;
        modal.navigateToFolder('docs');
        expect(modal.currentPage).toBe(1);
      });

      it('should load folder contents', () => {
        const loadSpy = vi.spyOn(modal, 'loadFolderContents');
        modal.navigateToFolder('docs/images');
        expect(loadSpy).toHaveBeenCalledWith('docs/images');
      });
    });

    describe('enterFolder', () => {
      it('should navigate to subfolder from root', () => {
        modal.currentPath = '';
        const navSpy = vi.spyOn(modal, 'navigateToFolder');

        modal.enterFolder('docs');

        expect(navSpy).toHaveBeenCalledWith('docs');
      });

      it('should navigate to nested subfolder', () => {
        modal.currentPath = 'docs';
        const navSpy = vi.spyOn(modal, 'navigateToFolder');

        modal.enterFolder('images');

        expect(navSpy).toHaveBeenCalledWith('docs/images');
      });
    });

    describe('navigateUp', () => {
      it('should do nothing when at root', () => {
        modal.currentPath = '';
        const navSpy = vi.spyOn(modal, 'navigateToFolder');

        modal.navigateUp();

        expect(navSpy).not.toHaveBeenCalled();
      });

      it('should navigate to parent folder', () => {
        modal.currentPath = 'docs/images';
        const navSpy = vi.spyOn(modal, 'navigateToFolder');

        modal.navigateUp();

        expect(navSpy).toHaveBeenCalledWith('docs');
      });

      it('should navigate to root from top-level folder', () => {
        modal.currentPath = 'docs';
        const navSpy = vi.spyOn(modal, 'navigateToFolder');

        modal.navigateUp();

        expect(navSpy).toHaveBeenCalledWith('');
      });
    });

    describe('renderBreadcrumbs', () => {
      beforeEach(() => {
        modal.breadcrumbs = document.createElement('div');
      });

      it('should render home icon for root', () => {
        modal.currentPath = '';
        modal.renderBreadcrumbs();

        expect(modal.breadcrumbs.innerHTML).toContain('home');
        expect(modal.breadcrumbs.querySelector('[data-path=""]')).not.toBeNull();
      });

      it('should render path segments', () => {
        modal.currentPath = 'docs/images/icons';
        modal.renderBreadcrumbs();

        expect(modal.breadcrumbs.innerHTML).toContain('docs');
        expect(modal.breadcrumbs.innerHTML).toContain('images');
        expect(modal.breadcrumbs.innerHTML).toContain('icons');
      });

      it('should include separators between segments', () => {
        modal.currentPath = 'docs/images';
        modal.renderBreadcrumbs();

        const separators = modal.breadcrumbs.querySelectorAll('.breadcrumb-separator');
        expect(separators.length).toBe(2); // After home and after docs
      });

      it('should not render if breadcrumbs element is missing', () => {
        modal.breadcrumbs = null;
        expect(() => modal.renderBreadcrumbs()).not.toThrow();
      });
    });

    describe('createNewFolder', () => {
      beforeEach(() => {
        modal.currentPath = '';
        modal.folders = [];
        modal.createdFolders = new Set();
      });

      it('should do nothing if prompt returns null', async () => {
        window.prompt.mockReturnValue(null);

        await modal.createNewFolder();

        expect(modal.createdFolders.size).toBe(0);
      });

      it('should do nothing if prompt returns empty string', async () => {
        window.prompt.mockReturnValue('');

        await modal.createNewFolder();

        expect(modal.createdFolders.size).toBe(0);
      });

      it('should reject invalid folder names', async () => {
        window.prompt.mockReturnValue('invalid/name');

        await modal.createNewFolder();

        expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
          expect.objectContaining({ modal: true })
        );
        expect(modal.createdFolders.size).toBe(0);
      });

      it('should reject duplicate folder names', async () => {
        modal.folders = ['existing'];
        window.prompt.mockReturnValue('existing');

        await modal.createNewFolder();

        expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
          expect.objectContaining({ body: 'A folder with this name already exists.', modal: true })
        );
        expect(modal.createdFolders.size).toBe(0);
      });

      it('should create folder at root level', async () => {
        window.prompt.mockReturnValue('new-folder');

        await modal.createNewFolder();

        expect(modal.createdFolders.has('new-folder')).toBe(true);
        expect(modal.folders).toContain('new-folder');
      });

      it('should create nested folder', async () => {
        modal.currentPath = 'docs';
        window.prompt.mockReturnValue('subfolder');

        await modal.createNewFolder();

        expect(modal.createdFolders.has('docs/subfolder')).toBe(true);
        expect(modal.folders).toContain('subfolder');
      });
    });

    describe('isValidFolderName', () => {
      it('should reject empty names', () => {
        expect(modal.isValidFolderName('')).toBe(false);
        expect(modal.isValidFolderName(null)).toBe(false);
        expect(modal.isValidFolderName(undefined)).toBe(false);
      });

      it('should reject names with leading/trailing whitespace', () => {
        expect(modal.isValidFolderName(' name')).toBe(false);
        expect(modal.isValidFolderName('name ')).toBe(false);
        expect(modal.isValidFolderName(' name ')).toBe(false);
      });

      it('should reject . and ..', () => {
        expect(modal.isValidFolderName('.')).toBe(false);
        expect(modal.isValidFolderName('..')).toBe(false);
      });

      it('should reject special characters', () => {
        expect(modal.isValidFolderName('test/name')).toBe(false);
        expect(modal.isValidFolderName('test\\name')).toBe(false);
        expect(modal.isValidFolderName('test:name')).toBe(false);
        expect(modal.isValidFolderName('test*name')).toBe(false);
        expect(modal.isValidFolderName('test?name')).toBe(false);
        expect(modal.isValidFolderName('test"name')).toBe(false);
        expect(modal.isValidFolderName('test<name')).toBe(false);
        expect(modal.isValidFolderName('test>name')).toBe(false);
        expect(modal.isValidFolderName('test|name')).toBe(false);
      });

      it('should accept valid names', () => {
        expect(modal.isValidFolderName('valid-name')).toBe(true);
        expect(modal.isValidFolderName('valid_name')).toBe(true);
        expect(modal.isValidFolderName('valid name')).toBe(true);
        expect(modal.isValidFolderName('123')).toBe(true);
        expect(modal.isValidFolderName('folder.name')).toBe(true);
        expect(modal.isValidFolderName('Ñoño')).toBe(true);
        expect(modal.isValidFolderName('日本語')).toBe(true);
      });
    });
  });

  describe('asset actions', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assetManager = {
        getAssetUrl: vi.fn((id, filename) => `asset://${id}`),
        getBlobURLSynced: vi.fn(() => 'blob:test-url'),
        blobURLCache: new Map([['asset1', 'blob:cached-url']]),
      };
      modal.selectedAsset = {
        id: 'asset1',
        filename: 'test-image.jpg',
        mime: 'image/jpeg',
      };
    });

    describe('downloadSelectedAsset', () => {
      it('should do nothing if no asset selected', () => {
        modal.selectedAsset = null;
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        modal.downloadSelectedAsset();

        expect(appendSpy).not.toHaveBeenCalled();
      });

      it('should download asset using blob URL from getBlobURLSynced', () => {
        const appendSpy = vi.spyOn(document.body, 'appendChild');
        const removeSpy = vi.spyOn(document.body, 'removeChild');

        modal.downloadSelectedAsset();

        expect(appendSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
        const link = appendSpy.mock.calls[0][0];
        expect(link.download).toBe('test-image.jpg');
      });

      it('should use blobURLCache if getBlobURLSynced not available', () => {
        modal.assetManager.getBlobURLSynced = undefined;
        modal.assetManager.blobURLCache.set('asset1', 'blob:from-cache');

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        modal.downloadSelectedAsset();

        expect(appendSpy).toHaveBeenCalled();
      });

      it('should create blob URL from asset.blob if no cached URL', () => {
        modal.assetManager.getBlobURLSynced = vi.fn(() => null);
        modal.assetManager.blobURLCache = new Map();
        modal.selectedAsset.blob = new Blob(['test'], { type: 'image/jpeg' });

        const createURLSpy = vi.spyOn(URL, 'createObjectURL');
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        modal.downloadSelectedAsset();

        expect(createURLSpy).toHaveBeenCalled();
        expect(appendSpy).toHaveBeenCalled();
      });

      it('should not download if no blob URL available', () => {
        modal.assetManager.getBlobURLSynced = vi.fn(() => null);
        modal.assetManager.blobURLCache = new Map();
        modal.selectedAsset.blob = null;

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        modal.downloadSelectedAsset();

        expect(appendSpy).not.toHaveBeenCalled();
      });
    });

    describe('copyAssetUrl', () => {
      beforeEach(() => {
        navigator.clipboard = {
          writeText: vi.fn().mockResolvedValue(),
        };
      });

      it('should do nothing if no asset selected', () => {
        modal.selectedAsset = null;

        modal.copyAssetUrl();

        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      });

      it('should copy asset URL to clipboard', async () => {
        modal.copyAssetUrl();

        expect(modal.assetManager.getAssetUrl).toHaveBeenCalledWith('asset1', 'test-image.jpg');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('asset://asset1');
      });

      it('should handle clipboard errors gracefully', async () => {
        navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        modal.copyAssetUrl();

        // Wait for promise to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('viewFullSize', () => {
      beforeEach(() => {
        window.open = vi.fn();
      });

      it('should do nothing if no asset selected', () => {
        modal.selectedAsset = null;

        modal.viewFullSize();

        expect(window.open).not.toHaveBeenCalled();
      });

      it('should open asset in new tab', () => {
        modal.viewFullSize();

        expect(window.open).toHaveBeenCalledWith('blob:test-url', '_blank');
      });

      it('should use blobURLCache if getBlobURLSynced not available', () => {
        modal.assetManager.getBlobURLSynced = undefined;

        modal.viewFullSize();

        expect(window.open).toHaveBeenCalledWith('blob:cached-url', '_blank');
      });

      it('should create blob URL from asset.blob if no cached URL', () => {
        modal.assetManager.getBlobURLSynced = vi.fn(() => null);
        modal.assetManager.blobURLCache = new Map();
        modal.selectedAsset.blob = new Blob(['test'], { type: 'image/jpeg' });

        const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:created-url');

        modal.viewFullSize();

        expect(createURLSpy).toHaveBeenCalled();
        expect(window.open).toHaveBeenCalledWith('blob:created-url', '_blank');
      });

      it('should not open if no blob URL available', () => {
        modal.assetManager.getBlobURLSynced = vi.fn(() => null);
        modal.assetManager.blobURLCache = new Map();
        modal.selectedAsset.blob = null;

        modal.viewFullSize();

        expect(window.open).not.toHaveBeenCalled();
      });
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(modal.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(modal.escapeHtml('a & b')).toBe('a &amp; b');
      // Note: textContent doesn't escape quotes, they pass through as-is
      expect(modal.escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it('should handle normal text', () => {
      expect(modal.escapeHtml('Hello World')).toBe('Hello World');
      expect(modal.escapeHtml('test-file.jpg')).toBe('test-file.jpg');
    });
  });

  describe('updateButtonStates', () => {
    beforeEach(() => {
      modal.initElements();
      // Add the missing buttons to the modal element
      const footer = modal.modalElement.querySelector('.media-library-footer');
      footer.innerHTML = `
        <button class="media-library-delete-btn">Delete</button>
        <button class="media-library-insert-btn">Insert</button>
        <button class="media-library-rename-btn">Rename</button>
        <button class="media-library-duplicate-btn">Duplicate</button>
        <button class="media-library-move-btn">Move</button>
        <button class="media-library-download-btn">Download</button>
        <button class="media-library-more-btn">More</button>
        <button class="media-library-extract-btn">Extract</button>
        <button class="media-library-copyurl-btn">Copy URL</button>
        <button class="media-library-fullsize-btn">Full Size</button>
      `;
      modal.initElements(); // Re-init to pick up new buttons
    });

    it('should disable all buttons when no selection', () => {
      modal.selectedAsset = null;
      modal.selectedFolder = null;

      modal.updateButtonStates();

      expect(modal.deleteBtn?.disabled).toBe(true);
      expect(modal.insertBtn?.disabled).toBe(true);
    });

    it('should enable buttons when asset is selected', () => {
      modal.selectedAsset = { id: 'test', filename: 'test.jpg', mime: 'image/jpeg' };
      modal.selectedAssets = [{ id: 'test', filename: 'test.jpg', mime: 'image/jpeg' }];

      modal.updateButtonStates();

      expect(modal.deleteBtn?.disabled).toBe(false);
    });

    it('should enable insert button when file is selected', () => {
      // Insert button is enabled based on file selection, not callback
      modal.selectedAsset = { id: 'test', filename: 'test.jpg', mime: 'image/jpeg' };
      modal.selectedAssets = [{ id: 'test', filename: 'test.jpg', mime: 'image/jpeg' }];

      modal.updateButtonStates();

      expect(modal.insertBtn?.disabled).toBe(false);
    });

    it('should disable insert button when no file is selected', () => {
      modal.selectedAsset = null;
      modal.selectedAssets = [];
      modal.selectedFolder = 'some-folder';

      modal.updateButtonStates();

      expect(modal.insertBtn?.disabled).toBe(true);
    });

    it('should keep delete and move enabled but disable single-item actions for multi selection', () => {
      modal.selectedAsset = { id: 'a1', filename: '1.jpg', mime: 'image/jpeg' };
      modal.selectedAssets = [
        { id: 'a1', filename: '1.jpg', mime: 'image/jpeg' },
        { id: 'a2', filename: '2.jpg', mime: 'image/jpeg' }
      ];
      modal.selectedFolder = null;

      modal.updateButtonStates();

      expect(modal.deleteBtn?.disabled).toBe(false);
      expect(modal.moveBtn?.disabled).toBe(false);
      expect(modal.renameBtn?.disabled).toBe(true);
      expect(modal.downloadBtn?.disabled).toBe(true);
      expect(modal.duplicateBtn?.disabled).toBe(true);
      expect(modal.moreBtn?.disabled).toBe(true);
      expect(modal.insertBtn?.disabled).toBe(true);
    });
  });

  describe('createFolderGridItem', () => {
    beforeEach(() => {
      modal.initElements();
      modal.currentPath = '';
    });

    it('should create a folder item with correct structure', () => {
      const item = modal.createFolderGridItem('test-folder');

      expect(item.className).toContain('media-library-item');
      expect(item.className).toContain('media-library-folder');
      expect(item.dataset.folderName).toBe('test-folder');
      expect(item.innerHTML).toContain('folder');
      expect(item.innerHTML).toContain('test-folder');
    });

    it('should escape HTML in folder name', () => {
      const item = modal.createFolderGridItem('<script>alert(1)</script>');

      expect(item.innerHTML).not.toContain('<script>');
      expect(item.innerHTML).toContain('&lt;script&gt;');
    });

    it('should handle click to select folder', () => {
      modal.grid = document.createElement('div');
      modal.selectedAsset = { id: 'some-asset' };
      modal.selectedAssets = [{ id: 'some-asset' }];

      const item = modal.createFolderGridItem('my-folder');
      modal.grid.appendChild(item);

      const showSidebarSpy = vi.spyOn(modal, 'showFolderSidebarContent');
      item.click();

      expect(modal.selectedAsset).toBeNull();
      expect(modal.selectedAssets).toEqual([]);
      expect(showSidebarSpy).toHaveBeenCalledWith('my-folder');
    });

    it('should handle double-click to enter folder', () => {
      const item = modal.createFolderGridItem('my-folder');
      const enterSpy = vi.spyOn(modal, 'enterFolder');

      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(enterSpy).toHaveBeenCalledWith('my-folder');
    });
  });

  describe('showFolderSidebarContent', () => {
    beforeEach(() => {
      modal.initElements();
      modal.currentPath = '';
      modal.assets = [
        { id: 'a1', folderPath: 'docs', filename: 'file1.txt' },
        { id: 'a2', folderPath: 'docs', filename: 'file2.txt' },
        { id: 'a3', folderPath: 'docs/sub', filename: 'file3.txt' },
        { id: 'a4', folderPath: 'other', filename: 'file4.txt' },
      ];

      // Add required elements
      modal.sidebarEmpty = document.createElement('div');
      modal.sidebarContent = document.createElement('div');
      modal.previewFile = document.createElement('div');
      modal.previewFile.innerHTML = '<span class="file-icon"></span>';
      modal.filenameSpan = document.createElement('span');
      modal.typeSpan = document.createElement('span');
      modal.sizeSpan = document.createElement('span');
      modal.dimensionsRow = document.createElement('div');
      modal.dateSpan = document.createElement('span');
      modal.urlInput = document.createElement('input');
    });

    it('should display folder info in sidebar', () => {
      modal.showFolderSidebarContent('docs');

      expect(modal.selectedFolder).toBe('docs');
      expect(modal.selectedFolderPath).toBe('docs');
      expect(modal.filenameSpan.textContent).toBe('docs');
      expect(modal.typeSpan.textContent).toBe('Folder');
      expect(modal.sizeSpan.textContent).toContain('3'); // 3 items in docs folder
    });

    it('should count nested folder contents', () => {
      modal.showFolderSidebarContent('docs');

      // Should count files in docs and docs/sub
      expect(modal.sizeSpan.textContent).toContain('3');
    });

    it('should hide dimensions row for folders', () => {
      modal.showFolderSidebarContent('docs');

      expect(modal.dimensionsRow.style.display).toBe('none');
    });

    it('should update button states', () => {
      const updateSpy = vi.spyOn(modal, 'updateButtonStates');
      modal.showFolderSidebarContent('docs');

      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('createFolderListRow', () => {
    beforeEach(() => {
      modal.initElements();
      modal.currentPath = '';
      modal.assets = [
        { id: 'a1', folderPath: 'docs', filename: 'file1.txt' },
        { id: 'a2', folderPath: 'docs/sub', filename: 'file2.txt' },
      ];
    });

    it('should create a table row with correct structure', () => {
      const row = modal.createFolderListRow('docs');

      expect(row.tagName).toBe('TR');
      expect(row.className).toContain('media-library-folder-row');
      expect(row.dataset.folderName).toBe('docs');
    });

    it('should include folder icon', () => {
      const row = modal.createFolderListRow('docs');
      const thumbCell = row.querySelector('.col-thumb');

      expect(thumbCell.innerHTML).toContain('folder');
    });

    it('should show folder name', () => {
      const row = modal.createFolderListRow('my-folder');
      const nameCell = row.querySelector('.col-name');

      expect(nameCell.textContent).toBe('my-folder');
    });

    it('should show item count in size column', () => {
      const row = modal.createFolderListRow('docs');
      const sizeCell = row.querySelector('.col-size');

      // Should count 2 files (docs and docs/sub)
      expect(sizeCell.textContent).toContain('2');
    });

    it('should handle double-click to enter folder', () => {
      const row = modal.createFolderListRow('docs');
      const enterSpy = vi.spyOn(modal, 'enterFolder');

      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(enterSpy).toHaveBeenCalledWith('docs');
    });
  });

  describe('countAssetReferences', () => {
    it('should return 0 for null/undefined assetId', () => {
      expect(modal.countAssetReferences(null)).toBe(0);
      expect(modal.countAssetReferences(undefined)).toBe(0);
      expect(modal.countAssetReferences('')).toBe(0);
    });

    it('should return 0 when yjsBridge is not available', () => {
      window.eXeLearning = { app: { project: {} } };

      const count = modal.countAssetReferences('some-asset-id');

      expect(count).toBe(0);
    });

    it('should return 0 when navigation is empty', () => {
      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({ length: 0 })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('some-asset-id');

      expect(count).toBe(0);
    });

    it('should handle errors gracefully', () => {
      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockImplementation(() => {
                    throw new Error('Test error');
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('some-asset-id');

      expect(count).toBe(0);
    });
  });

  describe('calculateAllAssetUsages', () => {
    beforeEach(() => {
      modal.assets = [
        { id: 'asset-1', filename: 'file1.jpg' },
        { id: 'asset-2', filename: 'file2.jpg' },
        { id: null, filename: 'no-id.jpg' },
      ];
      modal.assetUsageCounts = new Map();
    });

    it('should calculate usage counts for all assets with IDs', () => {
      const countSpy = vi.spyOn(modal, 'countAssetReferences').mockReturnValue(2);

      modal.calculateAllAssetUsages();

      expect(countSpy).toHaveBeenCalledTimes(2); // Only for assets with IDs
      expect(modal.assetUsageCounts.get('asset-1')).toBe(2);
      expect(modal.assetUsageCounts.get('asset-2')).toBe(2);
    });

    it('should clear previous cache', () => {
      modal.assetUsageCounts.set('old-asset', 5);
      vi.spyOn(modal, 'countAssetReferences').mockReturnValue(1);

      modal.calculateAllAssetUsages();

      expect(modal.assetUsageCounts.has('old-asset')).toBe(false);
    });
  });

  describe('getAssetUsageCount', () => {
    beforeEach(() => {
      modal.assetUsageCounts = new Map();
    });

    it('should return cached count if available', () => {
      modal.assetUsageCounts.set('asset-1', 5);
      const countSpy = vi.spyOn(modal, 'countAssetReferences');

      const count = modal.getAssetUsageCount('asset-1');

      expect(count).toBe(5);
      expect(countSpy).not.toHaveBeenCalled();
    });

    it('should calculate and cache count if not cached', () => {
      vi.spyOn(modal, 'countAssetReferences').mockReturnValue(3);

      const count = modal.getAssetUsageCount('asset-2');

      expect(count).toBe(3);
      expect(modal.assetUsageCounts.get('asset-2')).toBe(3);
    });
  });

  describe('renameSelectedAsset', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assetManager = {
        renameFolder: vi.fn().mockResolvedValue(),
        renameAsset: vi.fn().mockResolvedValue(),
        getAssetUrl: vi.fn((id) => `asset://${id}`),
      };
      modal.filenameSpan = document.createElement('span');
      modal.urlInput = document.createElement('input');
      modal.currentPath = '';
      modal.createdFolders = new Set();
    });

    it('should do nothing if prompt returns null for folder', async () => {
      modal.selectedFolder = 'test-folder';
      modal.selectedFolderPath = 'test-folder';
      window.prompt.mockReturnValue(null);

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameFolder).not.toHaveBeenCalled();
    });

    it('should do nothing if new name equals current folder name', async () => {
      modal.selectedFolder = 'test-folder';
      modal.selectedFolderPath = 'test-folder';
      window.prompt.mockReturnValue('test-folder');

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameFolder).not.toHaveBeenCalled();
    });

    it('should reject invalid folder names', async () => {
      modal.selectedFolder = 'test-folder';
      modal.selectedFolderPath = 'test-folder';
      window.prompt.mockReturnValue('invalid/name');

      await modal.renameSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ modal: true })
      );
      expect(modal.assetManager.renameFolder).not.toHaveBeenCalled();
    });

    it('should rename folder successfully', async () => {
      modal.selectedFolder = 'old-folder';
      modal.selectedFolderPath = 'old-folder';
      window.prompt.mockReturnValue('new-folder');
      modal.loadAssets = vi.fn().mockResolvedValue();

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameFolder).toHaveBeenCalledWith('old-folder', 'new-folder');
      expect(modal.loadAssets).toHaveBeenCalled();
    });

    it('should update createdFolders when renaming a created folder', async () => {
      modal.selectedFolder = 'my-folder';
      modal.selectedFolderPath = 'my-folder';
      modal.createdFolders.add('my-folder');
      window.prompt.mockReturnValue('renamed-folder');
      modal.loadAssets = vi.fn().mockResolvedValue();

      await modal.renameSelectedAsset();

      expect(modal.createdFolders.has('my-folder')).toBe(false);
      expect(modal.createdFolders.has('renamed-folder')).toBe(true);
    });

    it('should rename file successfully', async () => {
      modal.selectedFolder = null;
      modal.selectedAsset = { id: 'asset-1', filename: 'old-name.jpg' };
      window.prompt.mockReturnValue('new-name.jpg');
      modal.loadAssets = vi.fn().mockResolvedValue();

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameAsset).toHaveBeenCalledWith('asset-1', 'new-name.jpg');
      expect(modal.loadAssets).toHaveBeenCalled();
    });

    it('should handle rename errors', async () => {
      modal.selectedFolder = 'test-folder';
      modal.selectedFolderPath = 'test-folder';
      window.prompt.mockReturnValue('new-name');
      modal.assetManager.renameFolder.mockRejectedValue(new Error('Rename failed'));

      await modal.renameSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Failed to rename folder', modal: true })
      );
    });
  });

  describe('showSearchIndicator', () => {
    beforeEach(() => {
      modal.initElements();
      modal.breadcrumbs = document.createElement('div');
      modal.searchIndicator = document.createElement('div');
      modal.searchIndicator.innerHTML = '<span class="search-term"></span>';
      modal.locationColumnHeader = document.createElement('th');
      modal.locationColumnHeader.classList.add('d-none');
    });

    it('should hide breadcrumbs and show search indicator', () => {
      modal.showSearchIndicator('test search');

      expect(modal.breadcrumbs.classList.contains('d-none')).toBe(true);
      expect(modal.searchIndicator.classList.contains('d-none')).toBe(false);
    });

    it('should display search term', () => {
      modal.showSearchIndicator('my query');

      const termSpan = modal.searchIndicator.querySelector('.search-term');
      expect(termSpan.textContent).toBe('my query');
    });

    it('should show location column header', () => {
      modal.showSearchIndicator('query');

      expect(modal.locationColumnHeader.classList.contains('d-none')).toBe(false);
    });
  });

  describe('renderGrid with folders', () => {
    beforeEach(() => {
      modal.initElements();
      modal.grid = document.createElement('div');
      modal.grid.className = 'media-library-grid';
      modal.emptyState = document.createElement('div');
      modal.folders = ['folder1', 'folder2'];
      modal.filteredAssets = [
        { id: 'a1', filename: 'file.jpg', mime: 'image/jpeg' }
      ];
      modal.isSearchMode = false;
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder')
      };
    });

    it('should render folders and files', () => {
      modal.renderGrid();

      const items = modal.grid.querySelectorAll('.media-library-item');
      expect(items.length).toBe(3); // 2 folders + 1 file
    });

    it('should hide folders in search mode', () => {
      modal.isSearchMode = true;

      modal.renderGrid();

      const folders = modal.grid.querySelectorAll('.media-library-folder');
      expect(folders.length).toBe(0);
    });

    it('should show empty state when no content', () => {
      modal.folders = [];
      modal.filteredAssets = [];
      const showEmptySpy = vi.spyOn(modal, 'showEmptyState');

      modal.renderGrid();

      expect(showEmptySpy).toHaveBeenCalled();
    });
  });

  describe('renderList with folders', () => {
    beforeEach(() => {
      modal.initElements();
      modal.listTbody = document.createElement('tbody');
      modal.emptyState = document.createElement('div');
      modal.folders = ['folder1'];
      modal.filteredAssets = [
        { id: 'a1', filename: 'file.jpg', mime: 'image/jpeg', size: 1024 }
      ];
      modal.isSearchMode = false;
      modal.currentPath = '';
      modal.assets = [];
      modal.assetManager = {
        formatFileSize: vi.fn(() => '1 KB'),
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder')
      };
    });

    it('should render folders and files in list view', () => {
      modal.renderList();

      const rows = modal.listTbody.querySelectorAll('tr');
      expect(rows.length).toBe(2); // 1 folder + 1 file
    });

    it('should hide folders in search mode', () => {
      modal.isSearchMode = true;

      modal.renderList();

      const folderRows = modal.listTbody.querySelectorAll('.media-library-folder-row');
      expect(folderRows.length).toBe(0);
    });
  });

  describe('getFileTypeLabel', () => {
    it('should return Image for image mime types', () => {
      expect(modal.getFileTypeLabel('image/jpeg')).toBe('Image');
      expect(modal.getFileTypeLabel('image/png')).toBe('Image');
      expect(modal.getFileTypeLabel('image/gif')).toBe('Image');
    });

    it('should return Video for video mime types', () => {
      expect(modal.getFileTypeLabel('video/mp4')).toBe('Video');
      expect(modal.getFileTypeLabel('video/webm')).toBe('Video');
    });

    it('should return Audio for audio mime types', () => {
      expect(modal.getFileTypeLabel('audio/mp3')).toBe('Audio');
      expect(modal.getFileTypeLabel('audio/wav')).toBe('Audio');
    });

    it('should return PDF for pdf mime type', () => {
      expect(modal.getFileTypeLabel('application/pdf')).toBe('PDF');
    });

    it('should return File for other mime types', () => {
      expect(modal.getFileTypeLabel('application/zip')).toBe('File');
      expect(modal.getFileTypeLabel('text/plain')).toBe('File');
    });

    it('should return Unknown for undefined mime', () => {
      expect(modal.getFileTypeLabel(undefined)).toBe('Unknown');
      expect(modal.getFileTypeLabel(null)).toBe('Unknown');
      expect(modal.getFileTypeLabel('')).toBe('Unknown');
    });
  });

  describe('showMoveDialog', () => {
    beforeEach(() => {
      modal.initElements();
      modal.folderPicker = document.createElement('div');
      modal.folderPicker.style.display = 'none';
      modal.folderPickerList = document.createElement('div');
      modal.assets = [];
      modal.createdFolders = new Set();
    });

    it('should do nothing if no folderPicker', () => {
      modal.folderPicker = null;
      modal.selectedAsset = { id: 'a1' };

      modal.showMoveDialog();

      // No error thrown
    });

    it('should do nothing if no asset or folder selected', () => {
      modal.selectedAsset = null;
      modal.selectedFolderPath = null;

      modal.showMoveDialog();

      expect(modal.folderPicker.style.display).toBe('none');
    });

    it('should show picker when asset is selected', () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', folderPath: '' };
      modal.buildFolderPickerList = vi.fn();

      modal.showMoveDialog();

      expect(modal.folderPicker.style.display).toBe('flex');
      expect(modal.buildFolderPickerList).toHaveBeenCalled();
    });

    it('should show picker when folder is selected', () => {
      modal.selectedFolderPath = 'my-folder';
      modal.buildFolderPickerList = vi.fn();

      modal.showMoveDialog();

      expect(modal.folderPicker.style.display).toBe('flex');
      expect(modal.buildFolderPickerList).toHaveBeenCalled();
    });
  });

  describe('hideFolderPicker', () => {
    beforeEach(() => {
      modal.initElements();
      modal.folderPicker = document.createElement('div');
      modal.folderPicker.style.display = 'flex';
      modal.selectedMoveTarget = 'some-path';
    });

    it('should hide folder picker and clear selection', () => {
      modal.hideFolderPicker();

      expect(modal.folderPicker.style.display).toBe('none');
      expect(modal.selectedMoveTarget).toBeNull();
    });

    it('should not error if folderPicker is null', () => {
      modal.folderPicker = null;

      modal.hideFolderPicker();

      expect(modal.selectedMoveTarget).toBeNull();
    });
  });

  describe('buildFolderPickerList', () => {
    beforeEach(() => {
      modal.initElements();
      modal.folderPickerList = document.createElement('div');
      modal.assets = [
        { id: 'a1', filename: 'file1.jpg', folderPath: 'photos' },
        { id: 'a2', filename: 'file2.jpg', folderPath: 'photos/2024' },
        { id: 'a3', filename: 'file3.jpg', folderPath: '' },
      ];
      modal.createdFolders = new Set(['docs']);
      modal.selectedAsset = { id: 'a1', folderPath: 'photos' };
      modal.selectedFolderPath = null;
    });

    it('should build list with all folders including root', () => {
      modal.buildFolderPickerList();

      const items = modal.folderPickerList.querySelectorAll('.folder-picker-item');
      expect(items.length).toBeGreaterThan(0);
      // Should include root
      expect(modal.folderPickerList.innerHTML).toContain('Root');
    });

    it('should mark current folder for file selection', () => {
      modal.buildFolderPickerList();

      const currentItem = modal.folderPickerList.querySelector('.folder-picker-item.current');
      expect(currentItem).not.toBeNull();
      expect(currentItem.dataset.path).toBe('photos');
    });

    it('should exclude source folder when moving a folder', () => {
      modal.selectedAsset = null;
      modal.selectedFolderPath = 'photos/2024';
      modal.selectedFolder = '2024';

      modal.buildFolderPickerList();

      const paths = Array.from(modal.folderPickerList.querySelectorAll('.folder-picker-item'))
        .map(item => item.dataset.path);

      expect(paths).not.toContain('photos/2024');
    });

    it('should add click handlers to folder items', () => {
      modal.buildFolderPickerList();

      const item = modal.folderPickerList.querySelector('.folder-picker-item');
      item.click();

      expect(item.classList.contains('selected')).toBe(true);
      expect(modal.selectedMoveTarget).toBe(item.dataset.path);
    });

    it('should do nothing if folderPickerList is null', () => {
      modal.folderPickerList = null;

      modal.buildFolderPickerList();

      // No error thrown
    });
  });

  describe('confirmMove', () => {
    beforeEach(() => {
      modal.initElements();
      modal.folderPicker = document.createElement('div');
      modal.folderPicker.style.display = 'flex';
      modal.assetManager = {
        moveFolder: vi.fn().mockResolvedValue(),
        updateAssetFolderPath: vi.fn().mockResolvedValue(),
      };
      modal.assets = [];
      modal.createdFolders = new Set();
      modal.loadAssets = vi.fn().mockResolvedValue();
      modal.showSidebarEmpty = vi.fn();
    });

    it('should show toast if no destination selected', async () => {
      modal.selectedMoveTarget = null;

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Please select a destination folder', modal: true })
      );
    });

    it('should hide picker if assetManager is missing', async () => {
      modal.assetManager = null;
      modal.selectedMoveTarget = 'folder';
      modal.hideFolderPicker = vi.fn();

      await modal.confirmMove();

      expect(modal.hideFolderPicker).toHaveBeenCalled();
    });

    it('should show toast if folder is already in destination', async () => {
      modal.selectedFolderPath = 'parent/myfolder';
      modal.selectedFolder = 'myfolder';
      modal.selectedMoveTarget = 'parent';

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Folder is already in this location', modal: true })
      );
    });

    it('should show toast if destination has folder with same name', async () => {
      modal.selectedFolderPath = 'source/myfolder';
      modal.selectedFolder = 'myfolder';
      modal.selectedMoveTarget = 'dest';
      modal.assets = [{ id: 'a1', folderPath: 'dest/myfolder' }];

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'A folder with this name already exists in the destination.', modal: true })
      );
    });

    it('should move folder successfully', async () => {
      modal.selectedFolderPath = 'source/myfolder';
      modal.selectedFolder = 'myfolder';
      modal.selectedMoveTarget = 'newdest';
      modal.hideFolderPicker = vi.fn();

      await modal.confirmMove();

      expect(modal.assetManager.moveFolder).toHaveBeenCalledWith('source/myfolder', 'newdest');
      expect(modal.hideFolderPicker).toHaveBeenCalled();
      expect(modal.loadAssets).toHaveBeenCalled();
    });

    it('should show toast if file is already in destination folder', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', folderPath: 'current' };
      modal.selectedFolderPath = null;
      modal.selectedMoveTarget = 'current';

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'File is already in this folder', modal: true })
      );
    });

    it('should move file successfully', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', folderPath: 'old' };
      modal.selectedAssets = [modal.selectedAsset];
      modal.selectedFolderPath = null;
      modal.selectedMoveTarget = 'new';
      modal.hideFolderPicker = vi.fn();

      await modal.confirmMove();

      expect(modal.assetManager.updateAssetFolderPath).toHaveBeenCalledWith('a1', 'new');
      expect(modal.hideFolderPicker).toHaveBeenCalled();
      expect(modal.loadAssets).toHaveBeenCalled();
    });

    it('should handle folder move error', async () => {
      modal.selectedFolderPath = 'folder';
      modal.selectedFolder = 'folder';
      modal.selectedMoveTarget = 'dest';
      modal.assetManager.moveFolder.mockRejectedValue(new Error('Move failed'));

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Failed to move folder', modal: true })
      );
    });

    it('should handle file move error', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', folderPath: 'old' };
      modal.selectedAssets = [modal.selectedAsset];
      modal.selectedFolderPath = null;
      modal.selectedMoveTarget = 'new';
      modal.assetManager.updateAssetFolderPath.mockRejectedValue(new Error('Move failed'));

      await modal.confirmMove();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Failed to move file', modal: true })
      );
    });

    it('should hide picker if no asset selected when moving file', async () => {
      modal.selectedAsset = null;
      modal.selectedAssets = [];
      modal.selectedFolderPath = null;
      modal.selectedMoveTarget = 'dest';
      modal.hideFolderPicker = vi.fn();

      await modal.confirmMove();

      expect(modal.hideFolderPicker).toHaveBeenCalled();
    });

    it('should move multiple files successfully', async () => {
      modal.selectedAsset = { id: 'a2', filename: 'second.jpg', folderPath: 'folder-a' };
      modal.selectedAssets = [
        { id: 'a1', filename: 'first.jpg', folderPath: 'folder-a' },
        { id: 'a2', filename: 'second.jpg', folderPath: 'folder-b' }
      ];
      modal.selectedFolderPath = null;
      modal.selectedMoveTarget = 'new-folder';
      modal.hideFolderPicker = vi.fn();

      await modal.confirmMove();

      expect(modal.assetManager.updateAssetFolderPath).toHaveBeenCalledTimes(2);
      expect(modal.assetManager.updateAssetFolderPath).toHaveBeenCalledWith('a1', 'new-folder');
      expect(modal.assetManager.updateAssetFolderPath).toHaveBeenCalledWith('a2', 'new-folder');
      expect(modal.hideFolderPicker).toHaveBeenCalled();
      expect(modal.loadAssets).toHaveBeenCalled();
    });
  });

  describe('showSidebarEmpty', () => {
    beforeEach(() => {
      modal.initElements();
      modal.sidebarContent = document.createElement('div');
      modal.sidebarEmpty = document.createElement('div');
      modal.sidebarEmpty.style.display = 'none';
      modal.sidebarContent.style.display = 'block';
    });

    it('should show empty state and hide content', () => {
      modal.showSidebarEmpty();

      expect(modal.sidebarEmpty.style.display).toBe('block');
      expect(modal.sidebarContent.style.display).toBe('none');
    });
  });

  describe('filterAssets', () => {
    beforeEach(() => {
      modal.initElements();
      modal.grid = document.createElement('div');
      modal.listContainer = document.createElement('div');
      modal.listTbody = document.createElement('tbody');
      modal.emptyState = document.createElement('div');
      modal.assets = [
        { id: 'a1', filename: 'photo.jpg', folderPath: 'images', mime: 'image/jpeg' },
        { id: 'a2', filename: 'document.pdf', folderPath: '', mime: 'application/pdf' },
        { id: 'a3', filename: 'photo-backup.jpg', folderPath: 'backup', mime: 'image/jpeg' },
      ];
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder'),
        formatFileSize: vi.fn(() => '1 KB'),
      };
      modal.viewMode = 'grid';
      modal.currentPath = '';
      modal.createdFolders = new Set();
    });

    it('should reset currentPage when called', () => {
      modal.currentPage = 5;
      modal.applyFiltersAndRender = vi.fn();

      modal.filterAssets('photo');

      expect(modal.currentPage).toBe(1);
    });

    it('should call applyFiltersAndRender', () => {
      modal.applyFiltersAndRender = vi.fn();

      modal.filterAssets('test');

      expect(modal.applyFiltersAndRender).toHaveBeenCalled();
    });
  });

  describe('renderCurrentView', () => {
    beforeEach(() => {
      modal.initElements();
      modal.grid = document.createElement('div');
      modal.listContainer = document.createElement('div');
      modal.listTbody = document.createElement('tbody');
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder'),
        formatFileSize: vi.fn(() => '1 KB'),
      };
      modal.filteredAssets = [];
      modal.folders = [];
    });

    it('should render grid view when mode is grid', () => {
      modal.viewMode = 'grid';
      modal.renderGrid = vi.fn();
      modal.renderList = vi.fn();

      modal.renderCurrentView();

      expect(modal.renderGrid).toHaveBeenCalled();
      expect(modal.renderList).not.toHaveBeenCalled();
    });

    it('should render list view when mode is list', () => {
      modal.viewMode = 'list';
      modal.renderGrid = vi.fn();
      modal.renderList = vi.fn();

      modal.renderCurrentView();

      expect(modal.renderList).toHaveBeenCalled();
      expect(modal.renderGrid).not.toHaveBeenCalled();
    });
  });

  describe('selectAssetInList', () => {
    beforeEach(() => {
      modal.initElements();
      modal.listTbody = document.createElement('tbody');
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder'),
        formatFileSize: vi.fn(() => '1 KB'),
      };
      modal.showSidebarContent = vi.fn();
      modal.showMultiSelectionSidebarContent = vi.fn();
      modal.selectedAsset = null;
    });

    it('should select asset and update row styling', async () => {
      const row = document.createElement('tr');
      row.classList.add('media-library-list-row');
      modal.listTbody.appendChild(row);

      const asset = { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg' };

      await modal.selectAssetInList(asset, row);

      expect(modal.selectedAsset).toBe(asset);
      expect(row.classList.contains('selected')).toBe(true);
      expect(modal.showSidebarContent).toHaveBeenCalledWith(asset);
    });

    it('should deselect previous selection', async () => {
      const prevRow = document.createElement('tr');
      prevRow.classList.add('media-library-list-row', 'selected');
      const newRow = document.createElement('tr');
      newRow.classList.add('media-library-list-row');
      modal.listTbody.appendChild(prevRow);
      modal.listTbody.appendChild(newRow);

      const asset = { id: 'a2', filename: 'new.jpg' };

      await modal.selectAssetInList(asset, newRow);

      expect(prevRow.classList.contains('selected')).toBe(false);
      expect(newRow.classList.contains('selected')).toBe(true);
    });

    it('should add asset to selectedAssets array', async () => {
      const row = document.createElement('tr');
      const asset = { id: 'a1', filename: 'test.jpg' };

      await modal.selectAssetInList(asset, row);

      expect(modal.selectedAssets).toContain(asset);
      expect(modal.selectedAssets.length).toBe(1);
    });

    it('should support additive selection with ctrl/cmd click', async () => {
      const row1 = document.createElement('tr');
      const row2 = document.createElement('tr');
      modal.listTbody.appendChild(row1);
      modal.listTbody.appendChild(row2);

      const asset1 = { id: 'a1', filename: 'first.jpg' };
      const asset2 = { id: 'a2', filename: 'second.jpg' };

      await modal.selectAssetInList(asset1, row1);
      await modal.selectAssetInList(asset2, row2, { ctrlKey: true });

      expect(modal.selectedAssets).toHaveLength(2);
      expect(row1.classList.contains('selected')).toBe(true);
      expect(row2.classList.contains('selected')).toBe(true);
      expect(modal.showMultiSelectionSidebarContent).toHaveBeenCalledWith(modal.selectedAssets);
      expect(modal.showSidebarContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('showMultiSelectionSidebarContent', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assetManager = {
        formatFileSize: vi.fn((bytes) => `${bytes} bytes`),
      };
      modal.locationRow = document.createElement('div');
      modal.updateButtonStates = vi.fn();
    });

    it('should show aggregate info for multiple selected files', () => {
      modal.showMultiSelectionSidebarContent([
        { id: 'a1', size: 100 },
        { id: 'a2', size: 250 },
      ]);

      expect(modal.filenameSpan.textContent).toBe('2 files selected');
      expect(modal.typeSpan.textContent).toBe('Multiple files');
      expect(modal.sizeSpan.textContent).toBe('350 bytes');
      expect(modal.urlInput.value).toBe('');
      expect(modal.locationRow.style.display).toBe('none');
      expect(modal.updateButtonStates).toHaveBeenCalled();
    });
  });

  describe('createListRow', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test'),
        generateLoadingPlaceholder: vi.fn(() => 'placeholder'),
        formatFileSize: vi.fn((size) => `${size} B`),
      };
      modal.currentPath = '';
      modal.isSearchMode = false;
    });

    it('should create a row with asset info', () => {
      const asset = {
        id: 'a1',
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        size: 1024,
        timestamp: Date.now(),
      };

      const row = modal.createListRow(asset);

      expect(row.tagName).toBe('TR');
      expect(row.dataset.assetId).toBe('a1');
      expect(row.dataset.filename).toBe('photo.jpg');
    });

    it('should show location column in search mode', () => {
      modal.isSearchMode = true;

      const asset = {
        id: 'a1',
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        size: 1024,
        folderPath: 'images/2024',
      };

      const row = modal.createListRow(asset);
      const locationCell = row.querySelector('td:nth-child(5)');

      expect(locationCell).not.toBeNull();
    });

    it('should handle missing timestamp', () => {
      const asset = {
        id: 'a1',
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        size: 1024,
        timestamp: null,
      };

      const row = modal.createListRow(asset);

      expect(row).not.toBeNull();
    });
  });

  describe('createGridItem', () => {
    beforeEach(() => {
      modal.initElements();
      modal.assetManager = {
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test-url'),
        generateLoadingPlaceholder: vi.fn(() => 'data:image/svg+xml,placeholder'),
      };
    });

    it('should create grid item for image asset', () => {
      const asset = {
        id: 'a1',
        filename: 'photo.jpg',
        mime: 'image/jpeg',
      };

      const item = modal.createGridItem(asset);

      expect(item.classList.contains('media-library-item')).toBe(true);
      expect(item.dataset.assetId).toBe('a1');
      expect(item.dataset.filename).toBe('photo.jpg');
    });

    it('should create grid item for video asset with icon', () => {
      const asset = {
        id: 'a2',
        filename: 'video.mp4',
        mime: 'video/mp4',
      };

      const item = modal.createGridItem(asset);

      expect(item.classList.contains('media-library-item')).toBe(true);
      const icon = item.querySelector('.exe-icon');
      expect(icon).not.toBeNull();
    });

    it('should create grid item for audio asset with icon', () => {
      const asset = {
        id: 'a3',
        filename: 'audio.mp3',
        mime: 'audio/mpeg',
      };

      const item = modal.createGridItem(asset);

      expect(item.classList.contains('media-library-item')).toBe(true);
      const icon = item.querySelector('.exe-icon');
      expect(icon).not.toBeNull();
    });

    it('should create grid item for PDF asset', () => {
      const asset = {
        id: 'a4',
        filename: 'document.pdf',
        mime: 'application/pdf',
      };

      const item = modal.createGridItem(asset);

      expect(item.classList.contains('media-library-item')).toBe(true);
    });

    it('should create grid item for ZIP asset', () => {
      const asset = {
        id: 'a5',
        filename: 'archive.zip',
        mime: 'application/zip',
      };

      const item = modal.createGridItem(asset);

      expect(item.classList.contains('media-library-item')).toBe(true);
    });

    it('should add click handler for selection', () => {
      const asset = { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg' };
      modal.selectAsset = vi.fn();

      const item = modal.createGridItem(asset);
      item.click();

      expect(modal.selectAsset).toHaveBeenCalled();
    });

    it('should add double-click handler when callback exists', () => {
      const asset = { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg' };
      modal.onSelectCallback = vi.fn();
      modal.insertSelectedAsset = vi.fn();
      modal.selectAsset = vi.fn().mockResolvedValue();

      const item = modal.createGridItem(asset);

      // Simulate double click
      const dblclickEvent = new Event('dblclick');
      item.dispatchEvent(dblclickEvent);

      // The insertSelectedAsset should be called after selectAsset resolves
    });
  });

  describe('countAssetReferences - deeper traversal', () => {
    it('should count references in htmlContent', () => {
      const mockComponent = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') {
            return { toString: () => 'src="asset://test-asset-id/image.jpg"' };
          }
          return null;
        })
      };

      const mockBlock = {
        get: vi.fn((key) => {
          if (key === 'components') {
            return {
              length: 1,
              get: () => mockComponent
            };
          }
          return null;
        })
      };

      const mockPage = {
        get: vi.fn((key) => {
          if (key === 'blocks') {
            return {
              length: 1,
              get: () => mockBlock
            };
          }
          return null;
        })
      };

      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({
                    length: 1,
                    get: () => mockPage
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('test-asset-id');
      expect(count).toBe(1);
    });

    it('should count references in jsonProperties', () => {
      const mockComponent = {
        get: vi.fn((key) => {
          if (key === 'htmlContent' || key === 'htmlView') return null;
          if (key === 'jsonProperties') {
            return { toJSON: () => ({ url: 'asset://test-json-asset/img.png' }) };
          }
          return null;
        })
      };

      const mockBlock = {
        get: vi.fn((key) => {
          if (key === 'components') {
            return {
              length: 1,
              get: () => mockComponent
            };
          }
          return null;
        })
      };

      const mockPage = {
        get: vi.fn((key) => {
          if (key === 'blocks') {
            return {
              length: 1,
              get: () => mockBlock
            };
          }
          return null;
        })
      };

      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({
                    length: 1,
                    get: () => mockPage
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('test-json-asset');
      expect(count).toBe(1);
    });

    it('should count references in properties', () => {
      const mockComponent = {
        get: vi.fn((key) => {
          if (key === 'htmlContent' || key === 'htmlView' || key === 'jsonProperties' || key === 'ideviceProperties') return null;
          if (key === 'properties') {
            return { toJSON: () => ({ src: 'asset://props-asset/file.mp3' }) };
          }
          return null;
        })
      };

      const mockBlock = {
        get: vi.fn((key) => {
          if (key === 'components') {
            return {
              length: 1,
              get: () => mockComponent
            };
          }
          return null;
        })
      };

      const mockPage = {
        get: vi.fn((key) => {
          if (key === 'blocks') {
            return {
              length: 1,
              get: () => mockBlock
            };
          }
          return null;
        })
      };

      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({
                    length: 1,
                    get: () => mockPage
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('props-asset');
      expect(count).toBe(1);
    });

    it('should not count same component twice when found in htmlContent', () => {
      const mockComponent = {
        get: vi.fn((key) => {
          if (key === 'htmlContent') {
            return { toString: () => 'src="asset://multi-asset/image.jpg"' };
          }
          if (key === 'jsonProperties') {
            return { toJSON: () => ({ url: 'asset://multi-asset/image.jpg' }) };
          }
          return null;
        })
      };

      const mockBlock = {
        get: vi.fn((key) => {
          if (key === 'components') {
            return {
              length: 1,
              get: () => mockComponent
            };
          }
          return null;
        })
      };

      const mockPage = {
        get: vi.fn((key) => {
          if (key === 'blocks') {
            return {
              length: 1,
              get: () => mockBlock
            };
          }
          return null;
        })
      };

      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({
                    length: 1,
                    get: () => mockPage
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('multi-asset');
      // Should be 1, not 2, because found flag prevents double counting
      expect(count).toBe(1);
    });

    it('should handle null page/block/component', () => {
      window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              documentManager: {
                ydoc: {
                  getArray: vi.fn().mockReturnValue({
                    length: 2,
                    get: (i) => i === 0 ? null : {
                      get: () => null
                    }
                  })
                }
              }
            }
          }
        }
      };

      const count = modal.countAssetReferences('null-test');
      expect(count).toBe(0);
    });
  });

  describe('duplicateSelectedAsset edge cases', () => {
    beforeEach(() => {
      modal.assetManager = {
        getAsset: vi.fn(),
        insertImage: vi.fn().mockResolvedValue(),
        formatFileSize: vi.fn(() => '1 KB'),
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        getBlobURLSynced: vi.fn(() => 'blob:test')
      };
      modal.loadAssets = vi.fn().mockResolvedValue();
    });

    it('should handle asset without blob by fetching from assetManager', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg', folderPath: '' };
      modal.assets = [];

      // No blob on selectedAsset, but getAsset returns one
      modal.assetManager.getAsset.mockResolvedValue({
        blob: new Blob(['test'], { type: 'image/jpeg' })
      });

      // Mock prompt to return a value
      const originalPrompt = window.prompt;
      window.prompt = vi.fn().mockReturnValue('new-name.jpg');

      await modal.duplicateSelectedAsset();

      expect(modal.assetManager.getAsset).toHaveBeenCalledWith('a1');
      expect(modal.assetManager.insertImage).toHaveBeenCalled();

      window.prompt = originalPrompt;
    });

    it('should show toast when blob cannot be retrieved', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'test.jpg', mime: 'image/jpeg' };
      modal.assets = [];

      // No blob anywhere
      modal.assetManager.getAsset.mockResolvedValue(null);

      await modal.duplicateSelectedAsset();

      expect(eXeLearning.app.toasts.createToast).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Could not read file', modal: true })
      );
    });
  });

  describe('renameSelectedAsset edge cases', () => {
    beforeEach(() => {
      modal.assetManager = {
        renameAsset: vi.fn().mockResolvedValue(true),
        formatFileSize: vi.fn(() => '1 KB'),
        blobURLCache: new Map(),
        reverseBlobCache: new Map()
      };
      modal.applyFiltersAndRender = vi.fn();
    });

    it('should do nothing when no asset selected', async () => {
      modal.selectedAsset = null;
      modal.selectedFolderPath = null;

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameAsset).not.toHaveBeenCalled();
    });

    it('should call renameAsset when valid new name is provided', async () => {
      modal.selectedAsset = { id: 'a1', filename: 'old.jpg', mime: 'image/jpeg', folderPath: '' };
      modal.assets = [];

      const originalPrompt = window.prompt;
      window.prompt = vi.fn().mockReturnValue('new.jpg');

      await modal.renameSelectedAsset();

      expect(modal.assetManager.renameAsset).toHaveBeenCalledWith('a1', 'new.jpg');

      window.prompt = originalPrompt;
    });
  });

  describe('buildFolderPickerList with empty folders', () => {
    beforeEach(() => {
      modal.folderPickerList = document.createElement('div');
      modal.selectedMoveTarget = null;
    });

    it('should include created folders in picker list', () => {
      modal.createdFolders = new Set(['empty-folder', 'empty-folder/sub']);
      modal.assets = [];
      modal.selectedAsset = { id: 'a1', folderPath: '' };
      modal.selectedFolderPath = null;

      modal.buildFolderPickerList();

      // Should have root + empty-folder + empty-folder/sub = 3 items
      const items = modal.folderPickerList.querySelectorAll('.folder-picker-item');
      expect(items.length).toBe(3);
    });

    it('should filter out folder being moved and its subfolders', () => {
      modal.createdFolders = new Set(['parent', 'parent/child', 'other']);
      modal.assets = [];
      modal.selectedAsset = null;
      modal.selectedFolderPath = 'parent';

      modal.buildFolderPickerList();

      // Should have root + other = 2 items (parent and parent/child excluded)
      const items = modal.folderPickerList.querySelectorAll('.folder-picker-item');
      expect(items.length).toBe(2);
    });
  });
});
