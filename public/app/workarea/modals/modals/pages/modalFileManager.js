import Modal from '../modal.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * Media Library Modal
 *
 * Displays project assets from IndexedDB (AssetManager) in a WordPress-style
 * media library interface. Allows viewing, uploading, deleting, and inserting
 * assets into TinyMCE editors.
 */
export default class ModalFilemanager extends Modal {
    constructor(manager) {
        const id = 'modalFileManager';
        const titleDefault = _('Media Library');
        super(manager, id, titleDefault, false);

        // State
        this.assets = [];
        this.filteredAssets = [];
        this.selectedAsset = null;
        this.selectedAssets = []; // For multi-select mode
        this.multiSelect = false; // Whether to allow multiple selection
        this.onSelectCallback = null;
        this.acceptFilter = null; // 'image', 'audio', 'video', or null for all
        this.typeFilter = ''; // User-selected type filter from dropdown
        this.assetManager = null;

        // View state
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.sortBy = 'date-desc';
        this.currentPage = 1;
        this.itemsPerPage = 50;

        // DOM references (set in initElements)
        this.grid = null;
        this.listTable = null;
        this.listTbody = null;
        this.sidebar = null;
        this.sidebarEmpty = null;
        this.sidebarContent = null;
        this.uploadBtn = null;
        this.uploadInput = null;
        this.searchInput = null;
        this.deleteBtn = null;
        this.insertBtn = null;
        this.viewBtns = null;
        this.sortSelect = null;
        this.paginationInfo = null;
        this.prevBtn = null;
        this.nextBtn = null;
    }

    /**
     * Initialize DOM element references
     */
    initElements() {
        this.grid = this.modalElement.querySelector('.media-library-grid');
        this.listContainer = this.modalElement.querySelector('.media-library-list-container');
        this.listTable = this.modalElement.querySelector('.media-library-list');
        this.listTbody = this.listTable?.querySelector('tbody');
        this.emptyState = this.modalElement.querySelector('.media-library-empty');
        this.sidebar = this.modalElement.querySelector('.media-library-sidebar');
        this.sidebarEmpty = this.modalElement.querySelector('.media-library-sidebar-empty');
        this.sidebarContent = this.modalElement.querySelector('.media-library-sidebar-content');
        this.uploadBtn = this.modalElement.querySelector('.media-library-upload-btn');
        this.uploadInput = this.modalElement.querySelector('.media-library-upload-input');
        this.searchInput = this.modalElement.querySelector('.media-library-search');
        this.deleteBtn = this.modalElement.querySelector('.media-library-delete-btn');
        this.insertBtn = this.modalElement.querySelector('.media-library-insert-btn');
        this.unzipBtn = this.modalElement.querySelector('.media-library-unzip-btn');

        // View controls
        this.viewBtns = this.modalElement.querySelectorAll('.media-library-view-btn');
        this.sortSelect = this.modalElement.querySelector('.media-library-sort');
        this.filterSelect = this.modalElement.querySelector('.media-library-filter');

        // Pagination
        this.pagination = this.modalElement.querySelector('.media-library-pagination');
        this.paginationInfo = this.modalElement.querySelector('.media-library-page-info');
        this.prevBtn = this.modalElement.querySelector('.media-library-page-btn[data-action="prev"]');
        this.nextBtn = this.modalElement.querySelector('.media-library-page-btn[data-action="next"]');

        // Preview elements
        this.previewImg = this.modalElement.querySelector('.media-library-preview-img');
        this.previewVideo = this.modalElement.querySelector('.media-library-preview-video');
        this.previewAudio = this.modalElement.querySelector('.media-library-preview-audio');
        this.previewFile = this.modalElement.querySelector('.media-library-preview-file');
        this.previewPdf = this.modalElement.querySelector('.media-library-preview-pdf');

        // Metadata elements
        this.filenameInput = this.modalElement.querySelector('.media-library-filename');
        this.typeSpan = this.modalElement.querySelector('.media-library-type');
        this.sizeSpan = this.modalElement.querySelector('.media-library-size');
        this.dimensionsRow = this.modalElement.querySelector('.media-library-dimensions-row');
        this.dimensionsSpan = this.modalElement.querySelector('.media-library-dimensions');
        this.dateSpan = this.modalElement.querySelector('.media-library-date');
        this.urlInput = this.modalElement.querySelector('.media-library-url');
    }

    /**
     * Set up event handlers
     */
    initBehaviour() {
        // Upload button click
        if (this.uploadBtn && this.uploadInput) {
            this.uploadBtn.addEventListener('click', () => {
                this.uploadInput.click();
            });

            this.uploadInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    await this.uploadFiles(files);
                }
                // Reset input for re-selection
                this.uploadInput.value = '';
            });
        }

        // Drag & drop support
        this.initDragAndDrop();

        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterAssets(e.target.value);
            });
        }

        // Delete button
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => {
                this.deleteSelectedAsset();
            });
        }

        // Insert button
        if (this.insertBtn) {
            this.insertBtn.addEventListener('click', () => {
                this.insertSelectedAsset();
            });
        }

        // Unzip button
        if (this.unzipBtn) {
            this.unzipBtn.addEventListener('click', () => {
                this.extractZipAsset();
            });
        }

        // View toggle buttons
        if (this.viewBtns) {
            this.viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.dataset.view;
                    if (view) {
                        this.setViewMode(view);
                    }
                });
            });
        }

        // Sort select
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.currentPage = 1;
                this.applyFiltersAndRender();
            });
        }

        // Filter select
        if (this.filterSelect) {
            this.filterSelect.addEventListener('change', (e) => {
                this.typeFilter = e.target.value;
                this.currentPage = 1;
                this.applyFiltersAndRender();
            });
        }

        // Pagination buttons
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderCurrentView();
                }
            });
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredAssets.length / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderCurrentView();
                }
            });
        }

        // List table header click for sorting
        if (this.listTable) {
            const headers = this.listTable.querySelectorAll('th[data-sort]');
            headers.forEach(th => {
                th.addEventListener('click', () => {
                    const sortKey = th.dataset.sort;
                    this.handleHeaderSort(sortKey);
                });
            });
        }
    }

    /**
     * Handle table header click for sorting
     */
    handleHeaderSort(sortKey) {
        // Toggle direction if same key, otherwise default to asc
        const currentKey = this.sortBy.split('-')[0];
        const currentDir = this.sortBy.split('-')[1];

        if (currentKey === sortKey) {
            this.sortBy = `${sortKey}-${currentDir === 'asc' ? 'desc' : 'asc'}`;
        } else {
            this.sortBy = `${sortKey}-asc`;
        }

        // Update select if exists
        if (this.sortSelect) {
            this.sortSelect.value = this.sortBy;
        }

        this.currentPage = 1;
        this.applyFiltersAndRender();
    }

    /**
     * Set view mode (grid or list)
     */
    setViewMode(mode) {
        this.viewMode = mode;

        // Update button states
        if (this.viewBtns) {
            this.viewBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === mode);
            });
        }

        // Show/hide appropriate view
        if (mode === 'grid') {
            if (this.grid) this.grid.style.display = 'grid';
            if (this.listContainer) this.listContainer.style.display = 'none';
        } else {
            if (this.grid) this.grid.style.display = 'none';
            if (this.listContainer) this.listContainer.style.display = 'flex';
        }

        this.renderCurrentView();
    }

    /**
     * Show the modal
     * @param {Object} data - Optional configuration
     * @param {Function} data.onSelect - Callback when asset is inserted
     * @param {boolean} data.multiSelect - Allow multiple selection (default: false)
     * @param {string} data.accept - Filter by type ('image', 'audio', 'video')
     */
    async show(data = {}) {
        this.titleDefault = _('Media Library');
        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;

        setTimeout(async () => {
            this.setTitle(this.titleDefault);

            // Store callback
            this.onSelectCallback = data.onSelect || null;

            // Store multi-select mode
            this.multiSelect = data.multiSelect || false;
            this.selectedAssets = [];

            // Store accept filter ('image', 'audio', 'video', or null for all)
            this.acceptFilter = data.accept || null;

            // Initialize elements if not done (MUST be before accessing this.grid)
            if (!this.grid) {
                this.initElements();
                this.initBehaviour();
            }

            // Get AssetManager from YjsProjectBridge
            this.assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
            Logger.log(`[MediaLibrary] Opening with assetManager.projectId: ${this.assetManager?.projectId}`);

            if (!this.assetManager) {
                console.error('[MediaLibrary] AssetManager not available');
                if (this.grid) {
                    this.grid.innerHTML = `<div class="media-library-error">${_('Media library not available')}</div>`;
                }
                this.modal.show();
                return;
            }

            // Show modal
            this.modal.show();

            // Load assets
            await this.loadAssets();
        }, time);
    }

    /**
     * Load all assets from IndexedDB
     */
    async loadAssets() {
        if (!this.assetManager) return;

        this.grid.innerHTML = `<div class="media-library-loading">${_('Loading assets...')}</div>`;

        try {
            this.assets = await this.assetManager.getProjectAssets();
            Logger.log(`[MediaLibrary] Loaded ${this.assets.length} assets`);
            this.currentPage = 1;
            this.updateFilterOptions();
            this.applyFiltersAndRender();
        } catch (err) {
            console.error('[MediaLibrary] Failed to load assets:', err);
            this.grid.innerHTML = `<div class="media-library-error">${_('Failed to load assets')}</div>`;
        }
    }

    /**
     * Apply search filter and sorting, then render
     */
    applyFiltersAndRender() {
        const searchTerm = this.searchInput?.value?.toLowerCase().trim() || '';

        // Filter
        this.filteredAssets = this.assets.filter(asset => {
            // Filter by file type (accept filter - programmatic)
            if (this.acceptFilter) {
                const mime = asset.mime || '';
                if (this.acceptFilter === 'image' && !mime.startsWith('image/')) return false;
                if (this.acceptFilter === 'audio' && !mime.startsWith('audio/')) return false;
                if (this.acceptFilter === 'video' && !mime.startsWith('video/')) return false;
            }
            // Filter by type (user-selected filter)
            if (this.typeFilter) {
                const category = this.getAssetTypeCategory(asset.mime);
                if (category !== this.typeFilter) return false;
            }
            // Filter by search term
            if (!searchTerm) return true;
            const filename = (asset.filename || '').toLowerCase();
            return filename.includes(searchTerm);
        });

        // Sort
        this.sortAssets();

        // Render
        this.renderCurrentView();
    }

    /**
     * Sort filtered assets based on current sortBy setting
     */
    sortAssets() {
        const [key, direction] = this.sortBy.split('-');
        const modifier = direction === 'asc' ? 1 : -1;

        this.filteredAssets.sort((a, b) => {
            let valA, valB;

            switch (key) {
                case 'name':
                    valA = (a.filename || '').toLowerCase();
                    valB = (b.filename || '').toLowerCase();
                    return valA.localeCompare(valB) * modifier;
                case 'date':
                    valA = a.createdAt || 0;
                    valB = b.createdAt || 0;
                    return (valA - valB) * modifier;
                case 'size':
                    valA = a.size || 0;
                    valB = b.size || 0;
                    return (valA - valB) * modifier;
                case 'type':
                    valA = (a.mime || '').toLowerCase();
                    valB = (b.mime || '').toLowerCase();
                    return valA.localeCompare(valB) * modifier;
                default:
                    return 0;
            }
        });
    }

    /**
     * Render current view (grid or list) with pagination
     */
    renderCurrentView() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageAssets = this.filteredAssets.slice(startIndex, endIndex);

        if (this.viewMode === 'grid') {
            this.renderGrid(pageAssets);
        } else {
            this.renderList(pageAssets);
        }

        this.updatePagination();

        // Restore visual selection for multi-select mode
        if (this.multiSelect && this.selectedAssets.length > 0) {
            const selectedIds = new Set(this.selectedAssets.map(a => a.id));
            // Re-apply selected class to items in current view
            if (this.viewMode === 'grid' && this.grid) {
                this.grid.querySelectorAll('.media-library-item').forEach(el => {
                    if (selectedIds.has(el.dataset.assetId)) {
                        el.classList.add('selected');
                    }
                });
            } else if (this.listTbody) {
                this.listTbody.querySelectorAll('tr').forEach(el => {
                    if (selectedIds.has(el.dataset.assetId)) {
                        el.classList.add('selected');
                    }
                });
            }
        } else if (!this.multiSelect) {
            // Single select mode - reset selection on view change
            this.selectedAsset = null;
            this.selectedAssets = [];
            this.showSidebarEmpty();
        }
    }

    /**
     * Update pagination controls
     */
    updatePagination() {
        const totalPages = Math.max(1, Math.ceil(this.filteredAssets.length / this.itemsPerPage));

        if (this.paginationInfo) {
            this.paginationInfo.textContent = `${_('Page')} ${this.currentPage} ${_('of')} ${totalPages}`;
        }
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentPage <= 1;
        }
        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentPage >= totalPages;
        }
    }

    /**
     * Render the asset grid
     */
    renderGrid(pageAssets = null) {
        if (!this.grid) return;

        const assetsToRender = pageAssets || this.filteredAssets;

        if (assetsToRender.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.grid.innerHTML = '';

        for (const asset of assetsToRender) {
            const item = this.createGridItem(asset);
            this.grid.appendChild(item);
        }
    }

    /**
     * Render the asset list table
     */
    renderList(pageAssets = null) {
        if (!this.listTbody) return;

        const assetsToRender = pageAssets || this.filteredAssets;

        if (assetsToRender.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.listTbody.innerHTML = '';

        for (const asset of assetsToRender) {
            const row = this.createListRow(asset);
            this.listTbody.appendChild(row);
        }
    }

    /**
     * Create a table row for list view
     */
    createListRow(asset) {
        const row = document.createElement('tr');
        row.dataset.assetId = asset.id;
        row.dataset.filename = asset.filename || '';

        // Get or create blob URL (using synced method to ensure reverseBlobCache consistency)
        let blobUrl = this.assetManager.getBlobURLSynced?.(asset.id) ?? this.assetManager.blobURLCache.get(asset.id);
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
            this.assetManager.blobURLCache.set(asset.id, blobUrl);
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
            // Ensure reverseBlobCache is synced for existing blob URLs
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        }

        // Thumbnail cell
        const thumbCell = document.createElement('td');
        thumbCell.className = 'col-thumb';
        if (asset.mime && asset.mime.startsWith('image/')) {
            thumbCell.innerHTML = `<img src="${blobUrl}" alt="" loading="lazy">`;
        } else {
            const icon = this.getFileIcon(asset.mime, asset.filename);
            thumbCell.innerHTML = `<div class="list-thumb-icon"><span class="exe-icon">${icon}</span></div>`;
        }
        row.appendChild(thumbCell);

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'col-name';
        nameCell.textContent = asset.filename || 'Unknown';
        row.appendChild(nameCell);

        // Type cell
        const typeCell = document.createElement('td');
        typeCell.className = 'col-type';
        typeCell.textContent = this.getFileTypeLabel(asset.mime);
        row.appendChild(typeCell);

        // Size cell
        const sizeCell = document.createElement('td');
        sizeCell.className = 'col-size';
        sizeCell.textContent = this.assetManager.formatFileSize(asset.size || 0);
        row.appendChild(sizeCell);

        // Date cell
        const dateCell = document.createElement('td');
        dateCell.className = 'col-date';
        const date = asset.createdAt ? new Date(asset.createdAt) : null;
        dateCell.textContent = date ? date.toLocaleDateString() : 'Unknown';
        row.appendChild(dateCell);

        // Click handler
        row.addEventListener('click', () => {
            this.selectAssetInList(asset, row);
        });

        // Double-click to insert
        row.addEventListener('dblclick', () => {
            this.insertSelectedAsset();
        });

        return row;
    }

    /**
     * Get human-readable file type label
     */
    getFileTypeLabel(mime) {
        if (!mime) return 'Unknown';
        if (mime.startsWith('image/')) return 'Image';
        if (mime.startsWith('video/')) return 'Video';
        if (mime.startsWith('audio/')) return 'Audio';
        if (mime.includes('pdf')) return 'PDF';
        return 'File';
    }

    /**
     * Get icon name for file type based on mime type and filename
     * @param {string} mime - MIME type
     * @param {string} filename - Filename with extension
     * @returns {string} Material icon name
     */
    getFileIcon(mime, filename) {
        // Check by MIME type first
        if (mime) {
            if (mime.startsWith('image/')) return 'image';
            if (mime.startsWith('video/')) return 'videocam';
            if (mime.startsWith('audio/')) return 'audiotrack';
            if (mime === 'application/pdf') return 'picture_as_pdf';
            if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'folder_zip';
            if (mime === 'model/stl' || mime === 'application/sla') return 'view_in_ar';
        }

        // Check by file extension
        if (filename) {
            const ext = filename.split('.').pop()?.toLowerCase();
            switch (ext) {
                case 'pdf':
                    return 'picture_as_pdf';
                case 'zip':
                case 'rar':
                case '7z':
                case 'tar':
                case 'gz':
                    return 'folder_zip';
                case 'elp':
                case 'elpx':
                    return 'school';
                case 'stl':
                case 'obj':
                case 'fbx':
                case 'gltf':
                case 'glb':
                    return 'view_in_ar';
                case 'doc':
                case 'docx':
                case 'odt':
                    return 'description';
                case 'xls':
                case 'xlsx':
                case 'ods':
                case 'csv':
                    return 'table_chart';
                case 'ppt':
                case 'pptx':
                case 'odp':
                    return 'slideshow';
                case 'txt':
                case 'md':
                    return 'article';
                case 'html':
                case 'htm':
                case 'xml':
                case 'json':
                    return 'code';
                case 'js':
                case 'css':
                case 'py':
                case 'java':
                case 'php':
                    return 'terminal';
                default:
                    return 'insert_drive_file';
            }
        }

        return 'insert_drive_file';
    }

    /**
     * Get asset type category for filtering
     */
    getAssetTypeCategory(mime) {
        if (!mime) return 'other';
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        if (mime === 'application/pdf') return 'pdf';
        return 'other';
    }

    /**
     * Update filter dropdown options based on available file types
     */
    updateFilterOptions() {
        if (!this.filterSelect) return;

        // Get unique type categories from assets
        const typeCategories = new Set();
        for (const asset of this.assets) {
            const category = this.getAssetTypeCategory(asset.mime);
            typeCategories.add(category);
        }

        // Clear existing options except "All"
        this.filterSelect.innerHTML = `<option value="">${_('All')}</option>`;

        // Type labels mapping
        const typeLabels = {
            image: _('Images'),
            video: _('Videos'),
            audio: _('Audio'),
            pdf: _('PDF'),
            other: _('Other')
        };

        // Type order for consistent display
        const typeOrder = ['image', 'video', 'audio', 'pdf', 'other'];

        // Add options for existing types
        for (const type of typeOrder) {
            if (typeCategories.has(type)) {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = typeLabels[type] || type;
                this.filterSelect.appendChild(option);
            }
        }

        // Reset filter if current filter type no longer exists
        if (this.typeFilter && !typeCategories.has(this.typeFilter)) {
            this.typeFilter = '';
            this.filterSelect.value = '';
        }
    }

    /**
     * Select asset in list view
     */
    async selectAssetInList(asset, rowElement) {
        if (this.multiSelect) {
            // Multi-select mode: toggle selection
            const index = this.selectedAssets.findIndex(a => a.id === asset.id);
            if (index >= 0) {
                // Already selected - remove it
                this.selectedAssets.splice(index, 1);
                rowElement.classList.remove('selected');
            } else {
                // Not selected - add it
                this.selectedAssets.push(asset);
                rowElement.classList.add('selected');
            }

            // Update sidebar to show last selected or empty
            if (this.selectedAssets.length > 0) {
                const lastSelected = this.selectedAssets[this.selectedAssets.length - 1];
                this.selectedAsset = lastSelected;
                await this.showSidebarContent(lastSelected);
            } else {
                this.selectedAsset = null;
                this.showSidebarEmpty();
            }
        } else {
            // Single select mode: clear others and select this one
            if (this.listTbody) {
                this.listTbody.querySelectorAll('tr').forEach(el => {
                    el.classList.remove('selected');
                });
            }
            rowElement.classList.add('selected');

            this.selectedAsset = asset;
            this.selectedAssets = [asset];
            await this.showSidebarContent(asset);
        }
    }

    /**
     * Create a grid item for an asset
     * @param {Object} asset
     * @returns {HTMLElement}
     */
    createGridItem(asset) {
        const item = document.createElement('div');
        item.className = 'media-library-item';
        item.dataset.assetId = asset.id;
        item.dataset.filename = asset.filename || '';

        // Get or create blob URL (using synced method to ensure reverseBlobCache consistency)
        let blobUrl = this.assetManager.getBlobURLSynced?.(asset.id) ?? this.assetManager.blobURLCache.get(asset.id);
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
            this.assetManager.blobURLCache.set(asset.id, blobUrl);
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
            // Ensure reverseBlobCache is synced for existing blob URLs
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        }

        // Determine content based on type
        if (asset.mime && asset.mime.startsWith('image/')) {
            item.innerHTML = `<img src="${blobUrl}" alt="${asset.filename || 'Image'}" loading="lazy">`;
        } else {
            // Use icon for non-image files
            const icon = this.getFileIcon(asset.mime, asset.filename);
            item.innerHTML = `
                <div class="media-thumbnail file-thumbnail">
                    <span class="exe-icon">${icon}</span>
                    <span class="media-label">${asset.filename || 'File'}</span>
                </div>`;
        }

        // Click handler
        item.addEventListener('click', () => {
            this.selectAsset(asset, item);
        });

        // Double-click to insert
        item.addEventListener('dblclick', () => {
            this.insertSelectedAsset();
        });

        return item;
    }

    /**
     * Select an asset
     * @param {Object} asset
     * @param {HTMLElement} itemElement
     */
    async selectAsset(asset, itemElement) {
        if (this.multiSelect) {
            // Multi-select mode: toggle selection
            const index = this.selectedAssets.findIndex(a => a.id === asset.id);
            if (index >= 0) {
                // Already selected - remove it
                this.selectedAssets.splice(index, 1);
                itemElement.classList.remove('selected');
            } else {
                // Not selected - add it
                this.selectedAssets.push(asset);
                itemElement.classList.add('selected');
            }

            // Update sidebar to show last selected or empty
            if (this.selectedAssets.length > 0) {
                const lastSelected = this.selectedAssets[this.selectedAssets.length - 1];
                this.selectedAsset = lastSelected;
                await this.showSidebarContent(lastSelected);
            } else {
                this.selectedAsset = null;
                this.showSidebarEmpty();
            }
        } else {
            // Single select mode: clear others and select this one
            this.grid.querySelectorAll('.media-library-item').forEach(el => {
                el.classList.remove('selected');
            });
            itemElement.classList.add('selected');

            this.selectedAsset = asset;
            this.selectedAssets = [asset];
            await this.showSidebarContent(asset);
        }
    }

    /**
     * Show empty state (no files)
     */
    showEmptyState() {
        if (this.emptyState) {
            this.emptyState.classList.add('visible');
        }
        if (this.grid) {
            this.grid.style.display = 'none';
        }
        if (this.listContainer) {
            this.listContainer.style.display = 'none';
        }
        if (this.pagination) {
            this.pagination.style.display = 'none';
        }
    }

    /**
     * Hide empty state (has files)
     */
    hideEmptyState() {
        if (this.emptyState) {
            this.emptyState.classList.remove('visible');
        }
        if (this.viewMode === 'grid') {
            if (this.grid) this.grid.style.display = 'grid';
            if (this.listContainer) this.listContainer.style.display = 'none';
        } else {
            if (this.grid) this.grid.style.display = 'none';
            if (this.listContainer) this.listContainer.style.display = 'flex';
        }
        if (this.pagination) {
            this.pagination.style.display = 'flex';
        }
    }

    /**
     * Show empty sidebar state
     */
    showSidebarEmpty() {
        if (this.sidebarEmpty) this.sidebarEmpty.style.display = 'block';
        if (this.sidebarContent) this.sidebarContent.style.display = 'none';
    }

    /**
     * Show sidebar with asset details
     * @param {Object} asset
     */
    async showSidebarContent(asset) {
        if (this.sidebarEmpty) this.sidebarEmpty.style.display = 'none';
        if (this.sidebarContent) this.sidebarContent.style.display = 'flex';

        // Get blob URL (using synced method to ensure reverseBlobCache consistency)
        let blobUrl = this.assetManager.getBlobURLSynced?.(asset.id) ?? this.assetManager.blobURLCache.get(asset.id);
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
            this.assetManager.blobURLCache.set(asset.id, blobUrl);
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
            // Ensure reverseBlobCache is synced for existing blob URLs
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        }

        // Hide all preview elements
        if (this.previewImg) this.previewImg.style.display = 'none';
        if (this.previewVideo) this.previewVideo.style.display = 'none';
        if (this.previewAudio) this.previewAudio.style.display = 'none';
        if (this.previewPdf) this.previewPdf.style.display = 'none';
        if (this.previewFile) this.previewFile.style.display = 'none';

        // Show appropriate preview
        if (asset.mime && asset.mime.startsWith('image/')) {
            if (this.previewImg) {
                this.previewImg.src = blobUrl;
                this.previewImg.style.display = 'block';
            }
        } else if (asset.mime && asset.mime.startsWith('video/')) {
            if (this.previewVideo) {
                this.previewVideo.src = blobUrl;
                this.previewVideo.style.display = 'block';
            }
        } else if (asset.mime && asset.mime.startsWith('audio/')) {
            if (this.previewAudio) {
                this.previewAudio.src = blobUrl;
                this.previewAudio.style.display = 'block';
            }
        } else if (asset.mime === 'application/pdf') {
            if (this.previewPdf) {
                this.previewPdf.src = blobUrl;
                this.previewPdf.style.display = 'block';
            }
        } else {
            if (this.previewFile) {
                this.previewFile.style.display = 'flex';
            }
        }

        // Update metadata
        if (this.filenameInput) this.filenameInput.value = asset.filename || 'Unknown';
        if (this.typeSpan) this.typeSpan.textContent = asset.mime || 'Unknown';
        if (this.sizeSpan) this.sizeSpan.textContent = this.assetManager.formatFileSize(asset.size || 0);

        // Date
        if (this.dateSpan) {
            const date = asset.createdAt ? new Date(asset.createdAt) : null;
            this.dateSpan.textContent = date ? date.toLocaleDateString() : 'Unknown';
        }

        // URL
        if (this.urlInput) {
            this.urlInput.value = `asset://${asset.id}/${asset.filename || ''}`;
        }

        // Dimensions (only for images)
        if (this.dimensionsRow && this.dimensionsSpan) {
            if (asset.mime && asset.mime.startsWith('image/')) {
                this.dimensionsRow.style.display = 'flex';
                try {
                    const dims = await this.assetManager.getImageDimensions(asset.id);
                    if (dims) {
                        this.dimensionsSpan.textContent = `${dims.width} x ${dims.height} px`;
                    } else {
                        this.dimensionsSpan.textContent = 'Unknown';
                    }
                } catch (e) {
                    this.dimensionsSpan.textContent = 'Unknown';
                }
            } else {
                this.dimensionsRow.style.display = 'none';
            }
        }

        // Show/hide unzip button based on file type
        if (this.unzipBtn) {
            const isZip = asset.mime === 'application/zip' ||
                          asset.mime === 'application/x-zip-compressed' ||
                          asset.filename?.toLowerCase().endsWith('.zip');
            this.unzipBtn.style.display = isZip ? 'inline-flex' : 'none';
        }
    }

    /**
     * Upload files
     * @param {FileList} files
     */
    async uploadFiles(files) {
        if (!this.assetManager) return;

        Logger.log(`[MediaLibrary] uploadFiles: assetManager.projectId = ${this.assetManager.projectId}`);

        let uploadedCount = 0;

        for (const file of files) {
            try {
                Logger.log(`[MediaLibrary] Uploading: ${file.name} to projectId: ${this.assetManager.projectId}`);
                await this.assetManager.insertImage(file);
                uploadedCount++;
            } catch (err) {
                console.error(`[MediaLibrary] Failed to upload ${file.name}:`, err);
            }
        }

        if (uploadedCount > 0) {
            Logger.log(`[MediaLibrary] Uploaded ${uploadedCount} files`);
            await this.loadAssets();
        }
    }

    /**
     * Filter assets by search term
     * @param {string} searchTerm
     */
    filterAssets(searchTerm) {
        this.currentPage = 1;
        this.applyFiltersAndRender();
    }

    /**
     * Delete selected asset
     */
    async deleteSelectedAsset() {
        if (!this.selectedAsset || !this.assetManager) return;

        const confirmDelete = confirm(_('Are you sure you want to delete this file?'));
        if (!confirmDelete) return;

        try {
            await this.assetManager.deleteAsset(this.selectedAsset.id);
            Logger.log(`[MediaLibrary] Deleted asset: ${this.selectedAsset.id}`);

            // Reload grid
            await this.loadAssets();
        } catch (err) {
            console.error('[MediaLibrary] Failed to delete asset:', err);
            alert(_('Failed to delete file'));
        }
    }

    /**
     * Insert selected asset(s) into editor
     */
    insertSelectedAsset() {
        const assetsToInsert = this.multiSelect ? this.selectedAssets : (this.selectedAsset ? [this.selectedAsset] : []);
        if (assetsToInsert.length === 0) return;

        // If callback provided, use it
        if (this.onSelectCallback) {
            // Build array of asset info for callback
            const assetInfos = assetsToInsert.map(asset => {
                const assetUrl = `asset://${asset.id}/${asset.filename || ''}`;

                // Get blob URL for immediate display (using synced method to ensure reverseBlobCache consistency)
                let blobUrl = this.assetManager.getBlobURLSynced?.(asset.id) ?? this.assetManager.blobURLCache.get(asset.id);
                if (!blobUrl && asset.blob) {
                    blobUrl = URL.createObjectURL(asset.blob);
                    this.assetManager.blobURLCache.set(asset.id, blobUrl);
                    this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
                } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
                    // CRITICAL: Ensure reverseBlobCache is synced - this is required for convertBlobUrlsToAssetUrls
                    this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
                }

                return {
                    assetUrl: assetUrl,
                    blobUrl: blobUrl,
                    asset: asset
                };
            });

            // For backwards compatibility, if single select mode, pass single object
            // If multi-select, pass array
            if (this.multiSelect) {
                this.onSelectCallback(assetInfos);
            } else {
                this.onSelectCallback(assetInfos[0]);
            }
            this.close();
            return;
        }

        // Single asset for non-callback mode
        const assetUrl = `asset://${this.selectedAsset.id}/${this.selectedAsset.filename || ''}`;

        // Default: try to insert into active TinyMCE editor
        const editor = window.tinymce?.activeEditor;
        if (editor) {
            // Get blob URL (using synced method to ensure reverseBlobCache consistency)
            let blobUrl = this.assetManager.getBlobURLSynced?.(this.selectedAsset.id) ?? this.assetManager.blobURLCache.get(this.selectedAsset.id);
            if (!blobUrl && this.selectedAsset.blob) {
                blobUrl = URL.createObjectURL(this.selectedAsset.blob);
                this.assetManager.blobURLCache.set(this.selectedAsset.id, blobUrl);
                this.assetManager.reverseBlobCache.set(blobUrl, this.selectedAsset.id);
            } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
                // CRITICAL: Ensure reverseBlobCache is synced - this is required for convertBlobUrlsToAssetUrls
                this.assetManager.reverseBlobCache.set(blobUrl, this.selectedAsset.id);
            }

            if (this.selectedAsset.mime && this.selectedAsset.mime.startsWith('image/')) {
                // Insert image
                editor.insertContent(`<img src="${blobUrl}" alt="${this.selectedAsset.filename || ''}" data-asset-url="${assetUrl}">`);
            } else if (this.selectedAsset.mime && this.selectedAsset.mime.startsWith('video/')) {
                // Insert video
                editor.insertContent(`<video src="${blobUrl}" controls data-asset-url="${assetUrl}"></video>`);
            } else if (this.selectedAsset.mime && this.selectedAsset.mime.startsWith('audio/')) {
                // Insert audio
                editor.insertContent(`<audio src="${blobUrl}" controls data-asset-url="${assetUrl}"></audio>`);
            } else if (this.selectedAsset.mime === 'application/pdf') {
                // Insert PDF as iframe using asset:// URL (resolved to blob:// by asset system)
                editor.insertContent(`<iframe src="${assetUrl}" data-mce-pdf="true" style="width:100%; height:600px; border:1px solid #ccc;"></iframe>`);
            } else {
                // Insert as link
                editor.insertContent(`<a href="${blobUrl}" data-asset-url="${assetUrl}">${this.selectedAsset.filename || 'File'}</a>`);
            }

            Logger.log(`[MediaLibrary] Inserted asset into editor: ${this.selectedAsset.id}`);
            this.close();
        } else {
            console.warn('[MediaLibrary] No active editor to insert into');
            // Copy URL to clipboard as fallback
            if (navigator.clipboard) {
                navigator.clipboard.writeText(assetUrl);
                alert(_('Asset URL copied to clipboard'));
            }
        }
    }

    /**
     * Extract contents of a ZIP file and add them as assets
     */
    async extractZipAsset() {
        if (!this.selectedAsset || !this.assetManager) return;

        const asset = this.selectedAsset;
        const isZip = asset.mime === 'application/zip' ||
                      asset.mime === 'application/x-zip-compressed' ||
                      asset.filename?.toLowerCase().endsWith('.zip');

        if (!isZip) {
            console.warn('[MediaLibrary] Selected file is not a ZIP');
            return;
        }

        // Confirm extraction
        const confirmExtract = confirm(_('Extract all files from this ZIP archive?\n\nThis will add all files from the ZIP to your media library.'));
        if (!confirmExtract) return;

        try {
            // Get the blob for this asset
            let blob = asset.blob;
            if (!blob) {
                // Try to get from IndexedDB
                const fullAsset = await this.assetManager.getAsset(asset.id);
                blob = fullAsset?.blob;
            }

            if (!blob) {
                alert(_('Could not read ZIP file'));
                return;
            }

            // Check if fflate is available
            if (!window.fflate) {
                alert(_('ZIP extraction is not available'));
                return;
            }

            // Show loading state
            if (this.unzipBtn) {
                this.unzipBtn.disabled = true;
                this.unzipBtn.innerHTML = `<span class="exe-icon">hourglass_empty</span> ${_('Extracting...')}`;
            }

            // Convert blob to Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Data = new Uint8Array(arrayBuffer);

            // Extract ZIP using fflate
            const unzipped = window.fflate.unzipSync(uint8Data);
            const files = Object.keys(unzipped);
            let extractedCount = 0;
            let skippedCount = 0;

            for (const filepath of files) {
                const content = unzipped[filepath];

                // Skip empty entries (directories)
                if (!content || content.length === 0) continue;

                // Get basename
                const basename = filepath.split('/').pop();

                // Skip hidden files and system files
                if (!basename || basename.startsWith('.') || basename.startsWith('__')) {
                    skippedCount++;
                    continue;
                }

                try {
                    // Create blob from extracted content
                    const mimeType = this.getMimeTypeFromFilename(basename);
                    const fileBlob = new Blob([content], { type: mimeType });

                    // Create a File object with the correct name
                    const file = new File([fileBlob], basename, { type: mimeType });

                    // Upload to asset manager
                    await this.assetManager.insertImage(file);
                    extractedCount++;
                    Logger.log(`[MediaLibrary] Extracted: ${basename}`);
                } catch (err) {
                    console.error(`[MediaLibrary] Failed to extract ${filepath}:`, err);
                    skippedCount++;
                }
            }

            // Restore button state
            if (this.unzipBtn) {
                this.unzipBtn.disabled = false;
                this.unzipBtn.innerHTML = `<span class="exe-icon">folder_zip</span> ${_('Extract')}`;
            }

            // Show result
            if (extractedCount > 0) {
                Logger.log(`[MediaLibrary] Extracted ${extractedCount} files from ZIP`);
                // Reload assets to show new files
                await this.loadAssets();
            }

            // Notify user
            if (skippedCount > 0) {
                alert(_('Extracted %1 files. %2 files were skipped.').replace('%1', extractedCount).replace('%2', skippedCount));
            } else if (extractedCount > 0) {
                alert(_('Extracted %1 files successfully.').replace('%1', extractedCount));
            } else {
                alert(_('No files were extracted from the ZIP.'));
            }

        } catch (err) {
            console.error('[MediaLibrary] Failed to extract ZIP:', err);
            alert(_('Failed to extract ZIP file'));

            // Restore button state
            if (this.unzipBtn) {
                this.unzipBtn.disabled = false;
                this.unzipBtn.innerHTML = `<span class="exe-icon">folder_zip</span> ${_('Extract')}`;
            }
        }
    }

    /**
     * Get MIME type from filename extension
     */
    getMimeTypeFromFilename(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'bmp': 'image/bmp',
            // Video
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogv': 'video/ogg',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            // Audio
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'oga': 'audio/ogg',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac',
            'm4a': 'audio/mp4',
            // Documents
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Other
            'zip': 'application/zip',
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'csv': 'text/csv',
            'stl': 'model/stl',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Initialize drag & drop support for file uploads
     */
    initDragAndDrop() {
        const mainArea = this.modalElement.querySelector('.media-library-main');
        if (!mainArea) return;

        let dragCounter = 0;

        // Prevent default drag behaviors on the whole modal
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            mainArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Handle dragenter
        mainArea.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (dragCounter === 1) {
                mainArea.classList.add('drag-over');
                // Only show overlay when there are files (empty state already shows drop hint)
                if (!this.emptyState?.classList.contains('visible')) {
                    this.showDropzoneOverlay(mainArea);
                }
            }
        });

        // Handle dragleave
        mainArea.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                mainArea.classList.remove('drag-over');
                this.hideDropzoneOverlay(mainArea);
            }
        });

        // Handle drop
        mainArea.addEventListener('drop', async (e) => {
            dragCounter = 0;
            mainArea.classList.remove('drag-over');
            this.hideDropzoneOverlay(mainArea);

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                await this.uploadFiles(files);
            }
        });
    }

    /**
     * Show dropzone overlay when dragging files
     */
    showDropzoneOverlay(container) {
        // Remove existing overlay if any
        this.hideDropzoneOverlay(container);

        const overlay = document.createElement('div');
        overlay.className = 'media-library-dropzone-overlay';
        overlay.innerHTML = `<p>${_('Drop files here to upload')}</p>`;
        container.appendChild(overlay);
    }

    /**
     * Hide dropzone overlay
     */
    hideDropzoneOverlay(container) {
        const overlay = container.querySelector('.media-library-dropzone-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Override close to clean up
     */
    close(confirm) {
        // Stop any playing media
        if (this.previewVideo) {
            this.previewVideo.pause();
            this.previewVideo.src = '';
        }
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio.src = '';
        }

        // Clear selection
        this.selectedAsset = null;
        this.selectedAssets = [];
        this.multiSelect = false;
        this.onSelectCallback = null;
        this.acceptFilter = null;
        this.typeFilter = '';

        // Reset search and view state
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.filterSelect) {
            this.filterSelect.value = '';
        }
        this.currentPage = 1;

        super.close(confirm);
    }
}
