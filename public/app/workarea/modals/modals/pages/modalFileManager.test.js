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
      <div class="media-library-grid"></div>
      <div class="media-library-list-container" style="display:none;"><table class="media-library-list"><thead><th data-sort="name"></th></thead><tbody></tbody></table></div>
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
    it('should switch to list view', () => {
      modal.setViewMode('list');
      expect(modal.grid.style.display).toBe('none');
      expect(modal.listContainer.style.display).toBe('flex');
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
      expect(modal.grid.innerHTML).toContain('No media files yet');
      modal.renderList([]);
      expect(modal.listTbody.innerHTML).toContain('No media files yet');
    });

    it('should render grid and list items', () => {
      const asset = { id: '1', filename: 'a.png', mime: 'image/png', blob: new Blob(['x']) };
      modal.renderGrid([asset]);
      expect(modal.grid.querySelectorAll('.media-library-item').length).toBe(1);
      modal.renderList([asset]);
      expect(modal.listTbody.querySelectorAll('tr').length).toBe(1);
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
});
