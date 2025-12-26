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
                    insertImage: vi.fn().mockResolvedValue(),
                    deleteAsset: vi.fn().mockResolvedValue(),
                    getImageDimensions: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
                    blobURLCache: new Map(),
                    reverseBlobCache: new Map()
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
      <div class="media-library-main">
        <div class="media-library-empty"></div>
        <div class="media-library-grid"></div>
        <div class="media-library-list-container" style="display:none;"><table class="media-library-list"><thead><th data-sort="name"></th></thead><tbody></tbody></table></div>
        <div class="media-library-pagination"></div>
      </div>
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
      <select class="media-library-sort">
        <option value="name-asc">name-asc</option>
        <option value="size-asc">size-asc</option>
        <option value="type-asc">type-asc</option>
        <option value="type-desc">type-desc</option>
      </select>
      <select class="media-library-filter">
        <option value="">All</option>
      </select>
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

    it('should move pages with pagination buttons', () => {
      modal.filteredAssets = new Array(120).fill(null).map((_, i) => ({ id: i }));
      modal.currentPage = 2;
      modal.prevBtn.click();
      expect(modal.currentPage).toBe(1);

      modal.currentPage = 1;
      modal.nextBtn.click();
      expect(modal.currentPage).toBe(2);
    });
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
      expect(modal.pagination.style.display).toBe('none');
    });

    it('should hide empty state when has assets', () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      modal.renderGrid([asset]);
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('grid');
      expect(modal.pagination.style.display).toBe('flex');
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
    it('should show empty state and hide grid/list/pagination', () => {
      modal.showEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(true);
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('none');
      expect(modal.pagination.style.display).toBe('none');
    });

    it('should hide empty state and show grid in grid mode', () => {
      modal.viewMode = 'grid';
      modal.hideEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('grid');
      expect(modal.listContainer.style.display).toBe('none');
      expect(modal.pagination.style.display).toBe('flex');
    });

    it('should hide empty state and show list in list mode', () => {
      modal.viewMode = 'list';
      modal.hideEmptyState();
      expect(modal.emptyState.classList.contains('visible')).toBe(false);
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('flex');
      expect(modal.pagination.style.display).toBe('flex');
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
      expect(window.eXeLearning.app.project._yjsBridge.assetManager.insertImage).toHaveBeenCalledWith(file);
      expect(loadSpy).toHaveBeenCalled();
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
  });

  describe('insertSelectedAsset', () => {
    it('should call onSelect callback and close', () => {
      modal.selectedAsset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      const cb = vi.fn();
      const closeSpy = vi.spyOn(modal, 'close');
      modal.onSelectCallback = cb;
      modal.insertSelectedAsset();
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ assetUrl: 'asset://1/a.png' }));
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
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('asset://1/a.txt');
    });
  });

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

    it('should show unzip button only for ZIP files', async () => {
      // Mock unzip button
      const unzipBtn = document.createElement('button');
      unzipBtn.className = 'media-library-unzip-btn';
      mockElement.appendChild(unzipBtn);
      modal.unzipBtn = unzipBtn;

      // Test with ZIP file
      const zipAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      await modal.showSidebarContent(zipAsset);
      expect(unzipBtn.style.display).toBe('inline-flex');

      // Test with non-ZIP file
      const pngAsset = { id: '2', filename: 'test.png', mime: 'image/png', blob: new Blob(['x']) };
      await modal.showSidebarContent(pngAsset);
      expect(unzipBtn.style.display).toBe('none');
    });

    it('should not extract if user cancels confirmation', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const loadSpy = vi.spyOn(modal, 'loadAssets');
      await modal.extractZipAsset();
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should show error if blob is not available', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: null };
      modal.assetManager.getAsset = vi.fn().mockResolvedValue(null);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      await modal.extractZipAsset();
      expect(alertSpy).toHaveBeenCalled();
    });

    it('should show error if fflate is not available', async () => {
      modal.selectedAsset = { id: '1', filename: 'test.zip', mime: 'application/zip', blob: new Blob(['x']) };
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const originalFflate = window.fflate;
      window.fflate = undefined;
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      await modal.extractZipAsset();
      expect(alertSpy).toHaveBeenCalled();
      window.fflate = originalFflate;
    });

    it('should extract files from ZIP and reload assets', async () => {
      // Setup unzip button
      const unzipBtn = document.createElement('button');
      unzipBtn.innerHTML = '<span class="exe-icon">folder_zip</span> Extract';
      mockElement.appendChild(unzipBtn);
      modal.unzipBtn = unzipBtn;

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
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'alert').mockImplementation(() => {});
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
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await modal.extractZipAsset();

      expect(consoleSpy).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });

    it('should detect ZIP by extension when mime is not set', async () => {
      modal.selectedAsset = { id: '1', filename: 'archive.ZIP', mime: 'application/octet-stream', blob: new Blob(['x']) };
      vi.spyOn(window, 'confirm').mockReturnValue(false);
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
});
