import Modal from '../modal.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * File Manager Modal
 *
 * Displays project assets from IndexedDB (AssetManager) in a WordPress-style
 * file manager interface. Allows viewing, uploading, deleting, and inserting
 * assets into TinyMCE editors.
 */
export default class ModalFilemanager extends Modal {
    constructor(manager) {
        const id = 'modalFileManager';
        const titleDefault = _('File manager');
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
        this.assetUsageCounts = new Map(); // Cache of asset ID -> usage count in iDevices

        // Folder navigation state
        this.currentPath = ''; // Current folder path (empty = root)
        this.folders = []; // Subfolders in current path
        this.createdFolders = new Set(); // Explicitly created empty folders (full paths)

        // Search mode state
        this.isSearchMode = false; // True when search term is active (recursive search)

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

        // Footer action buttons
        this.downloadBtn = null;
        this.moreBtn = null;
        this.extractBtn = null;
        this.copyUrlBtn = null;
        this.fullSizeBtn = null;
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
        // Search input is now in header
        this.searchInput = this.modalElement.querySelector('.media-library-header-search .media-library-search');

        // Footer action buttons
        const footer = this.modalElement.querySelector('.media-library-footer');
        this.deleteBtn = footer?.querySelector('.media-library-delete-btn');
        this.insertBtn = footer?.querySelector('.media-library-insert-btn');
        this.renameBtn = footer?.querySelector('.media-library-rename-btn');
        this.duplicateBtn = footer?.querySelector('.media-library-duplicate-btn');
        this.moveBtn = footer?.querySelector('.media-library-move-btn');
        this.downloadBtn = footer?.querySelector('.media-library-download-btn');
        this.moreBtn = footer?.querySelector('.media-library-more-btn');

        // More options dropdown items
        this.extractBtn = footer?.querySelector('.media-library-extract-btn');
        this.copyUrlBtn = footer?.querySelector('.media-library-copyurl-btn');
        this.fullSizeBtn = footer?.querySelector('.media-library-fullsize-btn');

        // WebSocket handler reference and bound event handlers for rename sync
        this._wsHandler = null;
        this._onAssetRenamed = null;
        this._onFolderRenamed = null;

        // View controls
        this.viewBtns = this.modalElement.querySelectorAll('.media-library-view-btn');
        this.sortSelect = this.modalElement.querySelector('.media-library-sort');
        this.filterSelect = this.modalElement.querySelector('.media-library-filter');
        this.showRefCountCheckbox = this.modalElement.querySelector('.media-library-show-refcount');
        this.showRefCount = false; // Badge visibility state (off by default)

        // Preview elements
        this.previewImg = this.modalElement.querySelector('.media-library-preview-img');
        this.previewVideo = this.modalElement.querySelector('.media-library-preview-video');
        this.previewAudio = this.modalElement.querySelector('.media-library-preview-audio');
        this.previewFile = this.modalElement.querySelector('.media-library-preview-file');
        this.previewPdf = this.modalElement.querySelector('.media-library-preview-pdf');

        // Folder navigation elements
        this.breadcrumbs = this.modalElement.querySelector('.media-library-breadcrumbs');
        this.searchIndicator = this.modalElement.querySelector('.media-library-search-indicator');
        this.newFolderBtn = this.modalElement.querySelector('.media-library-newfolder-btn');

        // Folder picker dialog
        this.folderPicker = this.modalElement.querySelector('.media-library-folder-picker');
        this.folderPickerList = this.modalElement.querySelector('.folder-picker-list');
        this.folderPickerConfirm = this.modalElement.querySelector('.folder-picker-confirm');
        this.folderPickerCancel = this.modalElement.querySelector('.folder-picker-cancel');
        this.folderPickerClose = this.modalElement.querySelector('.folder-picker-close');
        this.folderPickerOverlay = this.modalElement.querySelector('.folder-picker-overlay');

        // Metadata elements
        this.filenameSpan = this.modalElement.querySelector('.media-library-filename');
        this.copyUrlBtn = this.modalElement.querySelector('.media-library-copy-url-btn');
        this.fileCountSpan = this.modalElement.querySelector('.media-library-count-value');
        this.typeSpan = this.modalElement.querySelector('.media-library-type');
        this.sizeSpan = this.modalElement.querySelector('.media-library-size');
        this.dimensionsRow = this.modalElement.querySelector('.media-library-dimensions-row');
        this.dimensionsSpan = this.modalElement.querySelector('.media-library-dimensions');
        this.dateSpan = this.modalElement.querySelector('.media-library-date');
        this.usageRow = this.modalElement.querySelector('.media-library-usage-row');
        this.usageSpan = this.modalElement.querySelector('.media-library-usage');
        this.urlInput = this.modalElement.querySelector('.media-library-url');
        this.locationRow = this.modalElement.querySelector('.media-library-location-row');
        this.locationValue = this.modalElement.querySelector('.media-library-location-value');
        this.openFolderBtn = this.modalElement.querySelector('.media-library-open-folder-btn');

        // List view location column header (for toggling visibility in search mode)
        this.locationColumnHeader = this.listTable?.querySelector('th.col-location');
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

        // Download button
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => {
                this.downloadSelectedAsset();
            });
        }

        // More options dropdown items
        if (this.extractBtn) {
            this.extractBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.extractZipAsset();
            });
        }

        if (this.copyUrlBtn) {
            this.copyUrlBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.copyAssetUrl();
            });
        }

        if (this.fullSizeBtn) {
            this.fullSizeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.viewFullSize();
            });
        }

        // Copy URL button in sidebar metadata
        if (this.copyUrlBtn) {
            this.copyUrlBtn.addEventListener('click', () => {
                this.copyAssetUrl();
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

        // Show reference count checkbox
        if (this.showRefCountCheckbox) {
            this.showRefCountCheckbox.addEventListener('change', (e) => {
                this.showRefCount = e.target.checked;
                this.applyFiltersAndRender();
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

        // New folder button
        if (this.newFolderBtn) {
            this.newFolderBtn.addEventListener('click', () => {
                this.createNewFolder();
            });
        }

        // Breadcrumb navigation (delegated)
        if (this.breadcrumbs) {
            this.breadcrumbs.addEventListener('click', (e) => {
                const item = e.target.closest('.breadcrumb-item');
                if (item) {
                    const path = item.dataset.path || '';
                    this.navigateToFolder(path);
                }
            });
        }

        // Search indicator events
        if (this.searchIndicator) {
            // Home icon click - go to root
            const homeIcon = this.searchIndicator.querySelector('.breadcrumb-home');
            homeIcon?.addEventListener('click', () => {
                this.clearSearchAndNavigate('');
            });

            // X button click - clear search, stay in current view
            const clearBtn = this.searchIndicator.querySelector('.clear-search-btn');
            clearBtn?.addEventListener('click', () => {
                if (this.searchInput) this.searchInput.value = '';
                this.isSearchMode = false;
                this.applyFiltersAndRender();
            });
        }

        // Open folder button in sidebar
        if (this.openFolderBtn) {
            this.openFolderBtn.addEventListener('click', () => {
                if (this.selectedAsset) {
                    this.clearSearchAndNavigate(this.selectedAsset.folderPath || '');
                }
            });
        }

        // File operation buttons
        if (this.renameBtn) {
            this.renameBtn.addEventListener('click', () => {
                this.renameSelectedAsset();
            });
        }

        if (this.duplicateBtn) {
            this.duplicateBtn.addEventListener('click', () => {
                this.duplicateSelectedAsset();
            });
        }

        if (this.moveBtn) {
            this.moveBtn.addEventListener('click', () => {
                this.showMoveDialog();
            });
        }

        // Folder picker dialog events
        if (this.folderPickerCancel) {
            this.folderPickerCancel.addEventListener('click', () => {
                this.hideFolderPicker();
            });
        }
        if (this.folderPickerClose) {
            this.folderPickerClose.addEventListener('click', () => {
                this.hideFolderPicker();
            });
        }
        if (this.folderPickerOverlay) {
            this.folderPickerOverlay.addEventListener('click', () => {
                this.hideFolderPicker();
            });
        }
        if (this.folderPickerConfirm) {
            this.folderPickerConfirm.addEventListener('click', () => {
                this.confirmMove();
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
        this.titleDefault = _('File manager');
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

            // Reset selection state
            this.selectedAsset = null;
            this.selectedFolder = null;
            this.selectedFolderPath = null;

            // Reset folder navigation to home
            this.currentPath = '';

            // Initialize elements if not done (MUST be before accessing this.grid)
            if (!this.grid) {
                this.initElements();
                this.initBehaviour();
            }

            // Reset reference count toggle (off by default) - after initElements
            this.showRefCount = false;
            if (this.showRefCountCheckbox) {
                this.showRefCountCheckbox.checked = false;
            }

            // Clear usage count cache so it's recalculated fresh
            this.assetUsageCounts.clear();

            // Update button states (all disabled since no selection)
            this.updateButtonStates();

            // Reset sidebar to empty state
            this.showSidebarEmpty();

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

            // Subscribe to Yjs asset changes for real-time sync
            this._subscribeToYjsChanges();
        }, time);
    }

    /**
     * Subscribe to Yjs asset changes for real-time sync with other clients
     * Yjs handles all sync automatically - we just need to refresh the UI
     */
    _subscribeToYjsChanges() {
        // Get the Yjs assets map from AssetManager
        const assetsMap = this.assetManager?.getAssetsYMap?.();
        if (!assetsMap) {
            Logger.log('[MediaLibrary] Yjs assets map not available for real-time sync');
            return;
        }

        // Create bound handler for Yjs changes
        this._onYjsAssetsChange = (event) => this._handleYjsAssetsChange(event);

        // Observe the Y.Map for changes (add, delete, update)
        assetsMap.observe(this._onYjsAssetsChange);
        this._assetsMap = assetsMap;
        Logger.log('[MediaLibrary] Subscribed to Yjs asset changes');
    }

    /**
     * Unsubscribe from Yjs asset changes
     */
    _unsubscribeFromYjsChanges() {
        if (!this._assetsMap || !this._onYjsAssetsChange) return;

        this._assetsMap.unobserve(this._onYjsAssetsChange);
        this._assetsMap = null;
        this._onYjsAssetsChange = null;
        Logger.log('[MediaLibrary] Unsubscribed from Yjs asset changes');
    }

    /**
     * Handle Yjs assets map changes
     * @param {Y.YMapEvent} event - Yjs map event
     */
    _handleYjsAssetsChange(event) {
        // Check if change was from this client (transaction origin)
        if (event.transaction.local) {
            // Local change - we already have the UI updated
            return;
        }

        Logger.log(`[MediaLibrary] Remote Yjs asset change detected`);

        // Reload assets from Yjs (fast - metadata only from memory)
        this.loadAssets();
    }


    /**
     * Load all assets (metadata from Yjs, blobs from IndexedDB)
     */
    async loadAssets() {
        if (!this.assetManager) return;

        this.grid.innerHTML = `<div class="media-library-loading">${_('Loading assets...')}</div>`;

        try {
            this.assets = await this.assetManager.getProjectAssets();
            Logger.log(`[MediaLibrary] Loaded ${this.assets.length} assets`);
            this.currentPage = 1;
            this.updateFilterOptions();
            this.loadFolderContents(this.currentPath);
        } catch (err) {
            console.error('[MediaLibrary] Failed to load assets:', err);
            this.grid.innerHTML = `<div class="media-library-error">${_('Failed to load assets')}</div>`;
        }
    }

    /**
     * Load and display contents of a specific folder
     * @param {string} path - Folder path (empty = root)
     */
    loadFolderContents(path = '') {
        this.currentPath = path;

        // Get assets in this exact folder
        const assetsInFolder = this.assets.filter(asset =>
            (asset.folderPath || '') === path
        );

        // Derive subfolders from all assets
        const derivedFolders = this.deriveSubfolders(this.assets, path);

        // Also include explicitly created folders that are children of current path
        const createdSubfolders = this.getCreatedSubfolders(path);

        // Merge and dedupe
        const allFolders = new Set([...derivedFolders, ...createdSubfolders]);
        this.folders = Array.from(allFolders).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );

        // Store assets for filtering
        this.filteredAssets = assetsInFolder;

        // Update breadcrumbs
        this.renderBreadcrumbs();

        // Apply filters and render
        this.applyFiltersAndRender();
    }

    /**
     * Get created folder names that are immediate children of the given path
     * @param {string} parentPath - Parent path to check
     * @returns {Array} Subfolder names
     */
    getCreatedSubfolders(parentPath) {
        const subfolders = [];
        const prefix = parentPath ? parentPath + '/' : '';

        for (const folderPath of this.createdFolders) {
            // Check if this folder is under parentPath
            if (parentPath) {
                if (!folderPath.startsWith(prefix)) continue;
                const remaining = folderPath.slice(prefix.length);
                // Get immediate child only
                const firstSegment = remaining.split('/')[0];
                if (firstSegment) subfolders.push(firstSegment);
            } else {
                // Root level - get first segment
                const firstSegment = folderPath.split('/')[0];
                if (firstSegment) subfolders.push(firstSegment);
            }
        }

        return [...new Set(subfolders)];
    }

    /**
     * Derive unique subfolders at a given path
     * @param {Array} assets - All assets
     * @param {string} parentPath - Parent folder path
     * @returns {Array} Sorted array of subfolder names
     */
    deriveSubfolders(assets, parentPath = '') {
        const subfolders = new Set();
        const prefix = parentPath ? parentPath + '/' : '';

        for (const asset of assets) {
            const assetPath = asset.folderPath || '';

            // Skip assets not under this path
            if (!assetPath.startsWith(prefix)) continue;

            // Get remaining path after prefix
            const remainingPath = assetPath.slice(prefix.length);
            if (!remainingPath) continue;

            // Get the first segment (immediate subfolder)
            const firstSegment = remainingPath.split('/')[0];
            if (firstSegment) {
                subfolders.add(firstSegment);
            }
        }

        return Array.from(subfolders).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );
    }

    /**
     * Navigate to a folder
     * @param {string} path - Target folder path
     */
    navigateToFolder(path) {
        Logger.log(`[MediaLibrary] Navigating to folder: "${path}"`);
        // Clear all selections
        this.selectedAsset = null;
        this.selectedAssets = [];
        this.selectedFolder = null;
        this.selectedFolderPath = null;
        this.showSidebarEmpty();
        this.updateButtonStates();
        this.currentPage = 1;
        this.loadFolderContents(path);
    }

    /**
     * Navigate into a subfolder
     * @param {string} folderName - Name of subfolder to enter
     */
    enterFolder(folderName) {
        const newPath = this.currentPath
            ? `${this.currentPath}/${folderName}`
            : folderName;
        this.navigateToFolder(newPath);
    }

    /**
     * Navigate to parent folder
     */
    navigateUp() {
        if (!this.currentPath) return; // Already at root

        const parts = this.currentPath.split('/');
        parts.pop();
        this.navigateToFolder(parts.join('/'));
    }

    /**
     * Render breadcrumb navigation
     */
    renderBreadcrumbs() {
        if (!this.breadcrumbs) return;

        const parts = this.currentPath ? this.currentPath.split('/') : [];

        // Start with root/home
        let html = `<span class="breadcrumb-item" data-path="" title="${_('Root')}">
            <span class="exe-icon">home</span>
        </span>`;

        // Add path segments
        let accumulated = '';
        for (let i = 0; i < parts.length; i++) {
            accumulated += (i > 0 ? '/' : '') + parts[i];
            html += `<span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item" data-path="${accumulated}">${this.escapeHtml(parts[i])}</span>`;
        }

        this.breadcrumbs.innerHTML = html;
    }

    /**
     * Create a new folder
     */
    async createNewFolder() {
        const name = prompt(_('Enter folder name:'));
        if (!name) return;

        // Validate folder name
        if (!this.isValidFolderName(name)) {
            alert(_('Invalid folder name. Avoid special characters like / \\ : * ? " < > |'));
            return;
        }

        // Check if folder already exists
        if (this.folders.includes(name)) {
            alert(_('A folder with this name already exists.'));
            return;
        }

        // Create folder path
        const folderPath = this.currentPath ? `${this.currentPath}/${name}` : name;

        Logger.log(`[MediaLibrary] Creating folder: ${folderPath}`);

        // Track this folder in createdFolders (persists across navigation)
        this.createdFolders.add(folderPath);

        // Add to local folders list for immediate display
        this.folders.push(name);
        this.folders.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Re-render to show new folder
        this.renderCurrentView();

        // TODO: Persist empty folder to server when backend supports it
    }

    /**
     * Validate folder name
     * @param {string} name - Folder name to validate
     * @returns {boolean} True if valid
     */
    isValidFolderName(name) {
        if (!name || name.trim() !== name) return false;
        if (name === '.' || name === '..') return false;
        // Disallow special characters
        const invalidChars = /[/\\:*?"<>|]/;
        return !invalidChars.test(name);
    }

    /**
     * Escape HTML special characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Apply search filter and sorting, then render
     */
    applyFiltersAndRender() {
        const searchTerm = this.searchInput?.value?.toLowerCase().trim() || '';

        // Determine search mode - when search term is active, search recursively
        this.isSearchMode = searchTerm.length > 0;

        // When searching: search ALL assets recursively
        // When not searching: only current folder
        const assetsToSearch = this.isSearchMode
            ? this.assets
            : this.assets.filter(asset => (asset.folderPath || '') === this.currentPath);

        // Filter
        this.filteredAssets = assetsToSearch.filter(asset => {
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

        // Update file count
        if (this.fileCountSpan) {
            this.fileCountSpan.textContent = this.filteredAssets.length;
        }

        // Toggle breadcrumb/search indicator
        if (this.isSearchMode) {
            this.showSearchIndicator(searchTerm);
        } else {
            this.showBreadcrumbs();
        }

        // Sort
        this.sortAssets();

        // Render
        this.renderCurrentView();
    }

    /**
     * Show search indicator (replaces breadcrumbs during search)
     * @param {string} term - Search term to display
     */
    showSearchIndicator(term) {
        if (this.breadcrumbs) this.breadcrumbs.classList.add('d-none');
        if (this.searchIndicator) {
            this.searchIndicator.classList.remove('d-none');
            const termSpan = this.searchIndicator.querySelector('.search-term');
            if (termSpan) termSpan.textContent = term;
        }
        // Show location column header in list view during search
        if (this.locationColumnHeader) this.locationColumnHeader.classList.remove('d-none');
    }

    /**
     * Show breadcrumbs (restore normal navigation)
     */
    showBreadcrumbs() {
        if (this.breadcrumbs) this.breadcrumbs.classList.remove('d-none');
        if (this.searchIndicator) this.searchIndicator.classList.add('d-none');
        // Hide location column header in list view when not searching
        if (this.locationColumnHeader) this.locationColumnHeader.classList.add('d-none');
    }

    /**
     * Clear search and navigate to a specific folder
     * @param {string} path - Target folder path
     */
    clearSearchAndNavigate(path) {
        // Clear search input
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        // Exit search mode
        this.isSearchMode = false;
        // Navigate to folder
        this.navigateToFolder(path);
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
        // Render all filtered assets (infinite scroll, no pagination)
        if (this.viewMode === 'grid') {
            this.renderGrid(this.filteredAssets);
        } else {
            this.renderList(this.filteredAssets);
        }

        // Update footer button states
        this.updateButtonStates();

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
     * Update footer button states based on current selection
     */
    updateButtonStates() {
        const hasFileSelection = this.selectedAsset !== null;
        const hasFolderSelection = this.selectedFolder !== null;
        const hasSelection = hasFileSelection || hasFolderSelection;
        const isZip = hasFileSelection && (
            this.selectedAsset.mime === 'application/zip' ||
            this.selectedAsset.mime === 'application/x-zip-compressed' ||
            this.selectedAsset.filename?.toLowerCase().endsWith('.zip')
        );

        // File/folder operation buttons
        if (this.deleteBtn) this.deleteBtn.disabled = !hasSelection;
        if (this.renameBtn) this.renameBtn.disabled = !hasSelection;
        if (this.moveBtn) this.moveBtn.disabled = !hasSelection;

        // File-only buttons
        if (this.downloadBtn) this.downloadBtn.disabled = !hasFileSelection;
        if (this.duplicateBtn) this.duplicateBtn.disabled = !hasFileSelection;
        if (this.insertBtn) this.insertBtn.disabled = !hasFileSelection;
        if (this.moreBtn) this.moreBtn.disabled = !hasFileSelection;

        // Extract button visibility (only for ZIP files)
        if (this.extractBtn) {
            this.extractBtn.classList.toggle('d-none', !isZip);
        }
    }

    /**
     * Render the asset grid
     */
    renderGrid(pageAssets = null) {
        if (!this.grid) return;

        const assetsToRender = pageAssets || this.filteredAssets;

        // Check if we have folders or files to show
        // Hide folders when in search mode (recursive search shows files only)
        const hasFolders = !this.isSearchMode && this.folders.length > 0;
        const hasFiles = assetsToRender.length > 0;

        if (!hasFolders && !hasFiles) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.grid.innerHTML = '';

        // Render folders first (only when NOT in search mode)
        if (!this.isSearchMode) {
            for (const folderName of this.folders) {
                const folderItem = this.createFolderGridItem(folderName);
                this.grid.appendChild(folderItem);
            }
        }

        // Then render files
        for (const asset of assetsToRender) {
            const item = this.createGridItem(asset);
            this.grid.appendChild(item);
        }
    }

    /**
     * Create a grid item for a folder
     * @param {string} folderName - Name of the folder
     * @returns {HTMLElement}
     */
    createFolderGridItem(folderName) {
        const item = document.createElement('div');
        item.className = 'media-library-item media-library-folder';
        item.dataset.folderName = folderName;

        item.innerHTML = `
            <div class="media-thumbnail folder-thumbnail">
                <span class="exe-icon folder-icon">folder</span>
                <span class="media-label">${this.escapeHtml(folderName)}</span>
            </div>`;

        // Double-click to enter folder
        item.addEventListener('dblclick', () => {
            this.enterFolder(folderName);
        });

        // Single click to select (for context menu later)
        item.addEventListener('click', () => {
            // Clear any file selection
            this.selectedAsset = null;
            this.selectedAssets = [];

            // Clear visual selection from files
            this.grid.querySelectorAll('.media-library-item').forEach(el => {
                el.classList.remove('selected');
            });

            // Select this folder
            item.classList.add('selected');

            // Show folder info in sidebar
            this.showFolderSidebarContent(folderName);
        });

        return item;
    }

    /**
     * Show folder details in sidebar
     * @param {string} folderName - Name of the folder
     */
    showFolderSidebarContent(folderName) {
        if (this.sidebarEmpty) this.sidebarEmpty.style.display = 'none';
        if (this.sidebarContent) this.sidebarContent.style.display = 'flex';

        // Hide all preview elements
        if (this.previewImg) this.previewImg.style.display = 'none';
        if (this.previewVideo) this.previewVideo.style.display = 'none';
        if (this.previewAudio) this.previewAudio.style.display = 'none';
        if (this.previewPdf) this.previewPdf.style.display = 'none';
        if (this.previewFile) {
            this.previewFile.style.display = 'flex';
            const icon = this.previewFile.querySelector('.file-icon');
            if (icon) icon.textContent = 'folder';
        }

        // Count items in folder
        const folderPath = this.currentPath
            ? `${this.currentPath}/${folderName}`
            : folderName;

        const filesInFolder = this.assets.filter(a => {
            const path = a.folderPath || '';
            return path === folderPath || path.startsWith(folderPath + '/');
        }).length;

        // Update metadata
        if (this.filenameSpan) this.filenameSpan.textContent = folderName;
        if (this.typeSpan) this.typeSpan.textContent = _('Folder');
        if (this.sizeSpan) this.sizeSpan.textContent = `${filesInFolder} ${_('items')}`;
        if (this.dimensionsRow) this.dimensionsRow.style.display = 'none';
        if (this.dateSpan) this.dateSpan.textContent = '-';
        if (this.urlInput) this.urlInput.value = folderPath;

        // Store selected folder info for operations
        this.selectedFolder = folderName;
        this.selectedFolderPath = folderPath;

        // Update footer button states
        this.updateButtonStates();
    }


    /**
     * Render the asset list table
     */
    renderList(pageAssets = null) {
        if (!this.listTbody) return;

        const assetsToRender = pageAssets || this.filteredAssets;

        // Check if we have folders or files to show
        // Hide folders when in search mode (recursive search shows files only)
        const hasFolders = !this.isSearchMode && this.folders.length > 0;
        const hasFiles = assetsToRender.length > 0;

        if (!hasFolders && !hasFiles) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.listTbody.innerHTML = '';

        // Render folders first (only when NOT in search mode)
        if (!this.isSearchMode) {
            for (const folderName of this.folders) {
                const row = this.createFolderListRow(folderName);
                this.listTbody.appendChild(row);
            }
        }

        // Then render files
        for (const asset of assetsToRender) {
            const row = this.createListRow(asset);
            this.listTbody.appendChild(row);
        }
    }

    /**
     * Create a table row for a folder in list view
     * @param {string} folderName - Name of the folder
     * @returns {HTMLElement}
     */
    createFolderListRow(folderName) {
        const row = document.createElement('tr');
        row.className = 'media-library-folder-row';
        row.dataset.folderName = folderName;

        // Thumbnail cell (folder icon)
        const thumbCell = document.createElement('td');
        thumbCell.className = 'col-thumb';
        thumbCell.innerHTML = `<div class="list-thumb-icon"><span class="exe-icon folder-icon">folder</span></div>`;
        row.appendChild(thumbCell);

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'col-name';
        nameCell.textContent = folderName;
        row.appendChild(nameCell);

        // Location cell (hidden - folders only show when not in search mode)
        const locationCell = document.createElement('td');
        locationCell.className = 'col-location d-none';
        row.appendChild(locationCell);

        // Type cell
        const typeCell = document.createElement('td');
        typeCell.className = 'col-type';
        typeCell.textContent = _('Folder');
        row.appendChild(typeCell);

        // Size cell (item count)
        const folderPath = this.currentPath
            ? `${this.currentPath}/${folderName}`
            : folderName;
        const filesInFolder = this.assets.filter(a => {
            const path = a.folderPath || '';
            return path === folderPath || path.startsWith(folderPath + '/');
        }).length;

        const sizeCell = document.createElement('td');
        sizeCell.className = 'col-size';
        sizeCell.textContent = `${filesInFolder} ${_('items')}`;
        row.appendChild(sizeCell);

        // Date cell
        const dateCell = document.createElement('td');
        dateCell.className = 'col-date';
        dateCell.textContent = '-';
        row.appendChild(dateCell);

        // Double-click to enter folder
        row.addEventListener('dblclick', () => {
            this.enterFolder(folderName);
        });

        // Single click to select
        row.addEventListener('click', () => {
            // Clear file selections
            this.selectedAsset = null;
            this.selectedAssets = [];

            // Clear visual selection
            if (this.listTbody) {
                this.listTbody.querySelectorAll('tr').forEach(el => {
                    el.classList.remove('selected');
                });
            }

            // Select this folder
            row.classList.add('selected');

            // Show folder info in sidebar
            this.showFolderSidebarContent(folderName);
        });

        return row;
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

        // Name cell (with optional usage badge)
        const nameCell = document.createElement('td');
        nameCell.className = 'col-name';
        if (this.showRefCount) {
            const usageCount = this.getAssetUsageCount(asset.id);
            const badgeClass = usageCount > 0 ? 'bg-primary' : 'bg-danger';
            nameCell.innerHTML = `<span class="filename">${asset.filename || 'Unknown'}</span> <span class="badge rounded-pill ${badgeClass} badge-sm">${usageCount}</span>`;
        } else {
            nameCell.textContent = asset.filename || 'Unknown';
        }
        row.appendChild(nameCell);

        // Location cell (only visible in search mode)
        const locationCell = document.createElement('td');
        locationCell.className = this.isSearchMode ? 'col-location' : 'col-location d-none';
        if (this.isSearchMode) {
            const displayPath = asset.folderPath ? `/${asset.folderPath}` : '/';
            locationCell.innerHTML = `
                <span class="location-link"
                      data-path="${this.escapeHtml(asset.folderPath || '')}"
                      title="${this.escapeHtml(displayPath)}">
                    ${this.escapeHtml(displayPath)}
                </span>`;

            const locationLink = locationCell.querySelector('.location-link');
            if (locationLink) {
                locationLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.clearSearchAndNavigate(asset.folderPath || '');
                });
            }
        }
        row.appendChild(locationCell);

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
        let isLoading = false;

        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
            this.assetManager.blobURLCache.set(asset.id, blobUrl);
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        } else if (!blobUrl) {
            // Asset not available locally - show loading placeholder and trigger fetch
            blobUrl = this.assetManager.generateLoadingPlaceholder(asset.id);
            isLoading = true;
            this.triggerAssetFetch(asset.id);
        } else if (blobUrl && !this.assetManager.reverseBlobCache.has(blobUrl)) {
            // Ensure reverseBlobCache is synced for existing blob URLs
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        }

        // Get usage count badge (only when showRefCount is enabled)
        let usageBadge = '';
        if (this.showRefCount) {
            const usageCount = this.getAssetUsageCount(asset.id);
            const badgeClass = usageCount > 0 ? 'bg-primary' : 'bg-danger';
            usageBadge = `<span class="position-absolute top-0 end-0 badge rounded-pill ${badgeClass} m-2 shadow-sm">${usageCount}</span>`;
        }

        // Path badge (only in search mode)
        let pathBadgeHtml = '';
        if (this.isSearchMode) {
            const displayPath = asset.folderPath ? `/${asset.folderPath}` : '/';
            pathBadgeHtml = `
                <span class="item-path-badge text-truncate"
                      data-path="${this.escapeHtml(asset.folderPath || '')}"
                      title="${this.escapeHtml(displayPath)}">
                    <span class="exe-icon">folder</span>
                    in ${this.escapeHtml(displayPath)}
                </span>`;
        }

        // Determine content based on type
        // Add data-asset-id for loading images so updateDomImagesForAsset can update them when asset arrives
        const loadingAttrs = isLoading ? ` data-asset-id="${asset.id}" data-asset-loading="true"` : '';
        if (asset.mime && asset.mime.startsWith('image/')) {
            if (this.isSearchMode) {
                // In search mode: show image with info overlay
                item.innerHTML = `
                    <img src="${blobUrl}" alt="${this.escapeHtml(asset.filename || 'Image')}" loading="lazy"${loadingAttrs}>
                    ${usageBadge}
                    <div class="item-info">
                        <span class="item-name text-truncate">${this.escapeHtml(asset.filename || 'Image')}</span>
                        ${pathBadgeHtml}
                    </div>`;
            } else {
                // Normal mode: just image
                item.innerHTML = `<img src="${blobUrl}" alt="${this.escapeHtml(asset.filename || 'Image')}" loading="lazy"${loadingAttrs}>${usageBadge}`;
            }
        } else {
            // Use icon for non-image files
            const icon = this.getFileIcon(asset.mime, asset.filename);
            if (this.isSearchMode) {
                // In search mode: show with info overlay
                item.innerHTML = `
                    <div class="media-thumbnail file-thumbnail">
                        <span class="exe-icon">${icon}</span>
                    </div>
                    ${usageBadge}
                    <div class="item-info">
                        <span class="item-name text-truncate">${this.escapeHtml(asset.filename || 'File')}</span>
                        ${pathBadgeHtml}
                    </div>`;
            } else {
                // Normal mode: icon with label
                item.innerHTML = `
                    <div class="media-thumbnail file-thumbnail">
                        <span class="exe-icon">${icon}</span>
                        <span class="media-label">${this.escapeHtml(asset.filename || 'File')}</span>
                    </div>${usageBadge}`;
            }
        }

        // Path badge click handler (navigate to folder)
        const pathBadge = item.querySelector('.item-path-badge');
        if (pathBadge) {
            pathBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearSearchAndNavigate(asset.folderPath || '');
            });
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
     * Trigger background fetch for a missing asset via WebSocket
     * This is used when a peer has uploaded an asset that we don't have locally yet
     * @param {string} assetId - Asset UUID
     */
    triggerAssetFetch(assetId) {
        const yjsBridge = window.eXeLearning?.app?.project?._yjsBridge;
        const wsHandler = yjsBridge?.assetWebSocketHandler;

        if (wsHandler && !this.assetManager.pendingFetches?.has(assetId)) {
            this.assetManager.pendingFetches?.add(assetId);
            Logger.log(`[MediaLibrary] Fetching asset ${assetId.substring(0, 8)}... via WebSocket`);
            wsHandler.requestAsset(assetId).then(success => {
                if (success) {
                    // Update DOM images to replace loading placeholder with actual blob URL
                    this.assetManager.updateDomImagesForAsset(assetId).catch(err => {
                        console.warn(`[MediaLibrary] Failed to update DOM for ${assetId.substring(0, 8)}:`, err);
                    });
                    Logger.log(`[MediaLibrary] Asset ${assetId.substring(0, 8)}... received via P2P`);
                }
            }).catch(error => {
                console.error(`[MediaLibrary] Failed to fetch asset ${assetId.substring(0, 8)}:`, error);
            }).finally(() => {
                this.assetManager.pendingFetches?.delete(assetId);
            });
        }
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
    }

    /**
     * Show empty sidebar state
     */
    showSidebarEmpty() {
        if (this.sidebarEmpty) this.sidebarEmpty.style.display = 'block';
        if (this.sidebarContent) this.sidebarContent.style.display = 'none';
        this.updateButtonStates();
    }

    /**
     * Show sidebar with asset details
     * @param {Object} asset
     */
    async showSidebarContent(asset) {
        // Clear folder selection when showing file
        this.selectedFolder = null;
        this.selectedFolderPath = null;

        if (this.sidebarEmpty) this.sidebarEmpty.style.display = 'none';
        if (this.sidebarContent) this.sidebarContent.style.display = 'flex';

        // Get blob URL (using synced method to ensure reverseBlobCache consistency)
        let blobUrl = this.assetManager.getBlobURLSynced?.(asset.id) ?? this.assetManager.blobURLCache.get(asset.id);
        let isLoading = false;
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
            this.assetManager.blobURLCache.set(asset.id, blobUrl);
            this.assetManager.reverseBlobCache.set(blobUrl, asset.id);
        } else if (!blobUrl) {
            // Asset not available locally - show loading placeholder and trigger fetch
            blobUrl = this.assetManager.generateLoadingPlaceholder(asset.id);
            isLoading = true;
            this.triggerAssetFetch(asset.id);
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
                // Add data-asset-id for loading images so updateDomImagesForAsset can update them
                if (isLoading) {
                    this.previewImg.setAttribute('data-asset-id', asset.id);
                    this.previewImg.setAttribute('data-asset-loading', 'true');
                } else {
                    this.previewImg.removeAttribute('data-asset-id');
                    this.previewImg.removeAttribute('data-asset-loading');
                }
            }
        } else if (asset.mime && asset.mime.startsWith('video/')) {
            if (this.previewVideo) {
                this.previewVideo.src = blobUrl;
                this.previewVideo.style.display = 'block';
                if (isLoading) {
                    this.previewVideo.setAttribute('data-asset-id', asset.id);
                    this.previewVideo.setAttribute('data-asset-loading', 'true');
                } else {
                    this.previewVideo.removeAttribute('data-asset-id');
                    this.previewVideo.removeAttribute('data-asset-loading');
                }
            }
        } else if (asset.mime && asset.mime.startsWith('audio/')) {
            if (this.previewAudio) {
                this.previewAudio.src = blobUrl;
                this.previewAudio.style.display = 'block';
                if (isLoading) {
                    this.previewAudio.setAttribute('data-asset-id', asset.id);
                    this.previewAudio.setAttribute('data-asset-loading', 'true');
                } else {
                    this.previewAudio.removeAttribute('data-asset-id');
                    this.previewAudio.removeAttribute('data-asset-loading');
                }
            }
        } else if (asset.mime === 'application/pdf') {
            if (this.previewPdf) {
                this.previewPdf.src = blobUrl;
                this.previewPdf.style.display = 'block';
                if (isLoading) {
                    this.previewPdf.setAttribute('data-asset-id', asset.id);
                    this.previewPdf.setAttribute('data-asset-loading', 'true');
                } else {
                    this.previewPdf.removeAttribute('data-asset-id');
                    this.previewPdf.removeAttribute('data-asset-loading');
                }
            }
        } else {
            if (this.previewFile) {
                this.previewFile.style.display = 'flex';
            }
        }

        // Update metadata
        if (this.filenameSpan) this.filenameSpan.textContent = asset.filename || 'Unknown';
        if (this.typeSpan) this.typeSpan.textContent = asset.mime || 'Unknown';
        if (this.sizeSpan) this.sizeSpan.textContent = this.assetManager.formatFileSize(asset.size || 0);

        // Date
        if (this.dateSpan) {
            const date = asset.createdAt ? new Date(asset.createdAt) : null;
            this.dateSpan.textContent = date ? date.toLocaleDateString() : 'Unknown';
        }

        // Usage count
        if (this.usageSpan) {
            const usageCount = this.getAssetUsageCount(asset.id);
            this.usageSpan.textContent = `${usageCount} iDevices`;
        }

        // URL
        if (this.urlInput) {
            this.urlInput.value = this.assetManager.getAssetUrl(asset.id, asset.filename);
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
                        this.dimensionsSpan.textContent = _('Unknown');
                    }
                } catch (e) {
                    this.dimensionsSpan.textContent = _('Unknown');
                }
            } else {
                this.dimensionsRow.style.display = 'none';
            }
        }

        // Location (always show to help user understand where the file is)
        if (this.locationRow && this.locationValue) {
            const displayPath = asset.folderPath ? `/${asset.folderPath}` : '/';
            this.locationRow.style.display = 'flex';
            this.locationValue.textContent = displayPath;
            this.locationValue.title = displayPath;
        }

        // Update footer button states
        this.updateButtonStates();
    }

    /**
     * Upload files
     * @param {FileList} files
     */
    async uploadFiles(files) {
        if (!this.assetManager) return;

        Logger.log(`[MediaLibrary] uploadFiles: assetManager.projectId = ${this.assetManager.projectId}, folder = "${this.currentPath}"`);

        let uploadedCount = 0;

        for (const file of files) {
            try {
                Logger.log(`[MediaLibrary] Uploading: ${file.name} to projectId: ${this.assetManager.projectId}, folder: "${this.currentPath}"`);
                // Upload to current folder
                await this.assetManager.insertImage(file, { folderPath: this.currentPath });
                uploadedCount++;
            } catch (err) {
                console.error(`[MediaLibrary] Failed to upload ${file.name}:`, err);
            }
        }

        if (uploadedCount > 0) {
            Logger.log(`[MediaLibrary] Uploaded ${uploadedCount} files to folder "${this.currentPath}"`);
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
     * Delete selected asset or folder
     */
    async deleteSelectedAsset() {
        if (!this.assetManager) return;

        // Check if folder is selected
        if (this.selectedFolder && this.selectedFolderPath) {
            const folderName = this.selectedFolder;
            const folderPath = this.selectedFolderPath;

            // Count items in folder
            const itemCount = this.assets.filter(a => {
                const path = a.folderPath || '';
                return path === folderPath || path.startsWith(folderPath + '/');
            }).length;

            const confirmMsg = itemCount > 0
                ? _('Are you sure you want to delete the folder "%1" and all %2 files inside?').replace('%1', folderName).replace('%2', itemCount)
                : _('Are you sure you want to delete the empty folder "%1"?').replace('%1', folderName);

            if (!confirm(confirmMsg)) return;

            try {
                if (itemCount > 0) {
                    await this.assetManager.deleteFolderContents(folderPath);
                }

                // Remove from created folders (for empty folders created with "New folder")
                this.createdFolders.delete(folderPath);
                // Also remove any nested created folders
                for (const path of this.createdFolders) {
                    if (path.startsWith(folderPath + '/')) {
                        this.createdFolders.delete(path);
                    }
                }

                Logger.log(`[MediaLibrary] Deleted folder: ${folderPath} (${itemCount} items)`);

                // Clear selection
                this.selectedFolder = null;
                this.selectedFolderPath = null;
                this.showSidebarEmpty();

                // Reload grid
                await this.loadAssets();
            } catch (err) {
                console.error('[MediaLibrary] Failed to delete folder:', err);
                alert(_('Failed to delete folder'));
            }
            return;
        }

        // Delete file
        if (!this.selectedAsset) return;

        const filename = this.selectedAsset.filename || 'Unknown';
        const usageCount = this.getAssetUsageCount(this.selectedAsset.id);

        let confirmMsg = _('Delete "%1"?').replace('%1', filename);
        if (usageCount > 0) {
            confirmMsg += '\n' + _('This asset is referenced in %1 iDevices.').replace('%1', usageCount);
        }

        if (!confirm(confirmMsg)) return;

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
     * Rename the selected asset or folder
     */
    async renameSelectedAsset() {
        if (!this.assetManager) return;

        // Check if folder is selected
        if (this.selectedFolder && this.selectedFolderPath) {
            const currentName = this.selectedFolder;
            const newName = prompt(_('Enter new folder name:'), currentName);

            if (!newName || newName === currentName) return;

            // Validate folder name
            if (!this.isValidFolderName(newName)) {
                alert(_('Invalid folder name. Avoid special characters like / \\ : * ? " < > |'));
                return;
            }

            // Check if folder with same name already exists in parent
            if (this.folders.includes(newName)) {
                alert(_('A folder with this name already exists.'));
                return;
            }

            try {
                // Build new path
                const oldPath = this.selectedFolderPath;
                const parentPath = this.currentPath;
                const newPath = parentPath ? `${parentPath}/${newName}` : newName;

                await this.assetManager.renameFolder(oldPath, newPath);
                Logger.log(`[MediaLibrary] Renamed folder: ${oldPath} to ${newPath}`);

                // Update createdFolders if this folder was explicitly created
                if (this.createdFolders.has(oldPath)) {
                    this.createdFolders.delete(oldPath);
                    this.createdFolders.add(newPath);
                }
                // Also update any nested created folders
                for (const path of [...this.createdFolders]) {
                    if (path.startsWith(oldPath + '/')) {
                        this.createdFolders.delete(path);
                        this.createdFolders.add(newPath + path.slice(oldPath.length));
                    }
                }

                // Update local state
                this.selectedFolder = newName;
                this.selectedFolderPath = newPath;

                // Update sidebar
                if (this.filenameSpan) {
                    this.filenameSpan.textContent = newName;
                }
                if (this.urlInput) {
                    this.urlInput.value = newPath;
                }

                // Reload to update grid/list
                await this.loadAssets();
            } catch (err) {
                console.error('[MediaLibrary] Failed to rename folder:', err);
                alert(_('Failed to rename folder'));
            }
            return;
        }

        // Rename file
        if (!this.selectedAsset) return;

        const currentName = this.selectedAsset.filename || '';
        const newName = prompt(_('Enter new filename:'), currentName);

        if (!newName || newName === currentName) return;

        // Validate filename
        if (!this.isValidFolderName(newName)) {
            alert(_('Invalid filename. Avoid special characters like / \\ : * ? " < > |'));
            return;
        }

        try {
            await this.assetManager.renameAsset(this.selectedAsset.id, newName);
            Logger.log(`[MediaLibrary] Renamed asset: ${this.selectedAsset.id} to ${newName}`);

            // Update local reference
            this.selectedAsset.filename = newName;

            // Update sidebar
            if (this.filenameSpan) {
                this.filenameSpan.textContent = newName;
            }
            if (this.urlInput) {
                // URL format uses only UUID + extension, path is resolved at export time
                this.urlInput.value = this.assetManager.getAssetUrl(this.selectedAsset.id, newName);
            }

            // Reload to update grid/list
            await this.loadAssets();
        } catch (err) {
            console.error('[MediaLibrary] Failed to rename asset:', err);
            alert(_('Failed to rename file'));
        }
    }

    /**
     * Generate a unique filename for duplication
     * Count how many iDevices reference a specific asset
     * @param {string} assetId - Asset UUID to search for
     * @returns {number} Number of iDevices referencing this asset
     */
    countAssetReferences(assetId) {
        if (!assetId) return 0;

        try {
            const yjsBridge = window.eXeLearning?.app?.project?._yjsBridge;
            if (!yjsBridge?.documentManager?.ydoc) return 0;

            const navigation = yjsBridge.documentManager.ydoc.getArray('navigation');
            if (!navigation) return 0;

            let count = 0;
            const assetRegex = new RegExp(`asset://${assetId}`, 'gi');

            // Traverse all pages
            for (let i = 0; i < navigation.length; i++) {
                const pageMap = navigation.get(i);
                if (!pageMap) continue;

                const blocks = pageMap.get('blocks');
                if (!blocks) continue;

                // Traverse all blocks in the page
                for (let j = 0; j < blocks.length; j++) {
                    const blockMap = blocks.get(j);
                    if (!blockMap) continue;

                    const components = blockMap.get('components');
                    if (!components) continue;

                    // Traverse all components (iDevices) in the block
                    for (let k = 0; k < components.length; k++) {
                        const compMap = components.get(k);
                        if (!compMap) continue;

                        let found = false;

                        // Check htmlView or htmlContent (Y.Text or string)
                        const htmlContent = compMap.get('htmlView') || compMap.get('htmlContent');
                        if (htmlContent) {
                            const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
                            if (assetRegex.test(content)) {
                                found = true;
                            }
                            assetRegex.lastIndex = 0; // Reset for reuse
                        }

                        // Check jsonProperties or ideviceProperties (Y.Map)
                        if (!found) {
                            const ideviceProperties = compMap.get('jsonProperties') || compMap.get('ideviceProperties');
                            if (ideviceProperties) {
                                const propsStr = JSON.stringify(
                                    ideviceProperties.toJSON ? ideviceProperties.toJSON() : ideviceProperties
                                );
                                if (assetRegex.test(propsStr)) {
                                    found = true;
                                }
                                assetRegex.lastIndex = 0; // Reset for reuse
                            }
                        }

                        // Also check properties (another possible location)
                        if (!found) {
                            const properties = compMap.get('properties');
                            if (properties) {
                                const propsStr = JSON.stringify(
                                    properties.toJSON ? properties.toJSON() : properties
                                );
                                if (assetRegex.test(propsStr)) {
                                    found = true;
                                }
                                assetRegex.lastIndex = 0; // Reset for reuse
                            }
                        }

                        if (found) count++;
                    }
                }
            }

            return count;
        } catch (err) {
            Logger.warn('[MediaLibrary] Error counting asset references:', err);
            return 0;
        }
    }

    /**
     * Calculate usage counts for all assets and cache them
     */
    calculateAllAssetUsages() {
        this.assetUsageCounts.clear();
        for (const asset of this.assets) {
            if (asset.id) {
                const count = this.countAssetReferences(asset.id);
                this.assetUsageCounts.set(asset.id, count);
            }
        }
    }

    /**
     * Get usage count for an asset (from cache or calculate)
     * @param {string} assetId
     * @returns {number}
     */
    getAssetUsageCount(assetId) {
        if (this.assetUsageCounts.has(assetId)) {
            return this.assetUsageCounts.get(assetId);
        }
        const count = this.countAssetReferences(assetId);
        this.assetUsageCounts.set(assetId, count);
        return count;
    }

    /**
     * Generate unique copy name for duplication
     * Pattern: "file (copy).ext", "file (copy) (1).ext", "file (copy) (2).ext", etc.
     * @param {string} originalName - Original filename
     * @param {string[]} existingNames - List of existing filenames in the folder
     * @returns {string} Unique filename
     */
    generateUniqueCopyName(originalName, existingNames) {
        const ext = originalName.lastIndexOf('.') > 0
            ? originalName.substring(originalName.lastIndexOf('.'))
            : '';
        const baseName = ext
            ? originalName.substring(0, originalName.lastIndexOf('.'))
            : originalName;

        const copyText = _('copy');
        const existingSet = new Set(existingNames.map(n => n.toLowerCase()));

        // Try "filename (copy).ext" first
        let candidate = `${baseName} (${copyText})${ext}`;
        if (!existingSet.has(candidate.toLowerCase())) {
            return candidate;
        }

        // Try "filename (copy) (1).ext", "filename (copy) (2).ext", etc.
        let counter = 1;
        while (counter < 1000) { // Safety limit
            candidate = `${baseName} (${copyText}) (${counter})${ext}`;
            if (!existingSet.has(candidate.toLowerCase())) {
                return candidate;
            }
            counter++;
        }

        // Fallback with timestamp
        return `${baseName} (${copyText}) (${Date.now()})${ext}`;
    }

    /**
     * Duplicate the selected asset
     */
    async duplicateSelectedAsset() {
        if (!this.selectedAsset || !this.assetManager) return;

        try {
            const asset = this.selectedAsset;

            // Get the blob first to validate we can read the file
            let blob = asset.blob;
            if (!blob) {
                const fullAsset = await this.assetManager.getAsset(asset.id);
                blob = fullAsset?.blob;
            }

            if (!blob) {
                alert(_('Could not read file'));
                return;
            }

            // Get existing filenames in the same folder to check for duplicates
            const folderPath = asset.folderPath || '';
            const assetsInFolder = this.assets.filter(a => (a.folderPath || '') === folderPath);
            const existingNames = assetsInFolder.map(a => a.filename || '');

            // Generate suggested filename with translated "(copy)" text
            const originalName = asset.filename || 'file';
            const suggestedName = this.generateUniqueCopyName(originalName, existingNames);

            // Prompt user for the new filename
            const newName = prompt(_('Enter name for the duplicate:'), suggestedName);

            // User cancelled
            if (newName === null) return;

            // Validate the name
            const trimmedName = newName.trim();
            if (!trimmedName) {
                alert(_('Please enter a valid filename'));
                return;
            }

            // Check if name already exists (case-insensitive)
            const existingSet = new Set(existingNames.map(n => n.toLowerCase()));
            if (existingSet.has(trimmedName.toLowerCase())) {
                alert(_('A file with this name already exists in this folder'));
                return;
            }

            // Create a File object
            const file = new File([blob], trimmedName, { type: asset.mime || 'application/octet-stream' });

            // Insert as new asset in the same folder (forceNewId to bypass content-addressed storage)
            await this.assetManager.insertImage(file, { folderPath, forceNewId: true });

            Logger.log(`[MediaLibrary] Duplicated asset: ${asset.id} as ${trimmedName}`);

            // Reload to show new asset
            await this.loadAssets();
        } catch (err) {
            console.error('[MediaLibrary] Failed to duplicate asset:', err);
            alert(_('Failed to duplicate file'));
        }
    }

    /**
     * Show the move dialog for the selected asset or folder
     */
    showMoveDialog() {
        if (!this.folderPicker) return;

        // Need either a file or folder selected
        if (!this.selectedAsset && !this.selectedFolderPath) return;

        // Build list of available folders
        this.buildFolderPickerList();

        // Show the picker
        this.folderPicker.style.display = 'flex';
        this.selectedMoveTarget = null;
    }

    /**
     * Hide the folder picker dialog
     */
    hideFolderPicker() {
        if (this.folderPicker) {
            this.folderPicker.style.display = 'none';
        }
        this.selectedMoveTarget = null;
    }

    /**
     * Build the folder picker list from all available folders
     */
    buildFolderPickerList() {
        if (!this.folderPickerList) return;

        const isMovingFolder = !!this.selectedFolderPath;
        const movingFolderPath = this.selectedFolderPath || null;

        // Get all unique folder paths from assets AND created folders
        const folderPaths = new Set(['']); // Always include root

        // Add folders from assets
        for (const asset of this.assets) {
            const path = asset.folderPath || '';
            if (path) {
                folderPaths.add(path);
                // Also add parent paths
                const parts = path.split('/');
                for (let i = 1; i < parts.length; i++) {
                    folderPaths.add(parts.slice(0, i).join('/'));
                }
            }
        }

        // Add empty folders from createdFolders set
        if (this.createdFolders) {
            for (const folder of this.createdFolders) {
                if (folder) {
                    folderPaths.add(folder);
                    // Also add parent paths
                    const parts = folder.split('/');
                    for (let i = 1; i < parts.length; i++) {
                        folderPaths.add(parts.slice(0, i).join('/'));
                    }
                }
            }
        }

        // Sort paths
        let sortedPaths = Array.from(folderPaths).sort((a, b) => {
            if (a === '') return -1;
            if (b === '') return 1;
            return a.localeCompare(b);
        });

        // If moving a folder, exclude it and its subfolders from destinations
        if (isMovingFolder) {
            sortedPaths = sortedPaths.filter(path => {
                if (path === movingFolderPath) return false;
                if (path.startsWith(movingFolderPath + '/')) return false;
                return true;
            });
        }

        // Determine current folder (for highlighting)
        let currentFolderPath;
        if (isMovingFolder) {
            // For folder move, current is parent of the folder being moved
            const parts = movingFolderPath.split('/');
            parts.pop();
            currentFolderPath = parts.join('/');
        } else {
            // For file move, current is the folder the file is in
            currentFolderPath = this.selectedAsset?.folderPath || '';
        }

        // Build HTML
        let html = '';
        for (const path of sortedPaths) {
            const displayName = path === '' ? _('Root') : path.split('/').pop();
            const indent = path === '' ? 0 : path.split('/').length;
            const isCurrentFolder = path === currentFolderPath;

            html += `<div class="folder-picker-item${isCurrentFolder ? ' current' : ''}"
                          data-path="${this.escapeHtml(path)}"
                          style="padding-left: ${12 + indent * 16}px">
                <span class="exe-icon">folder</span>
                <span class="folder-picker-name">${this.escapeHtml(displayName)}</span>
                ${isCurrentFolder ? `<span class="folder-picker-current">(${_('current')})</span>` : ''}
            </div>`;
        }

        this.folderPickerList.innerHTML = html;

        // Add click handlers
        this.folderPickerList.querySelectorAll('.folder-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove previous selection
                this.folderPickerList.querySelectorAll('.folder-picker-item').forEach(el => {
                    el.classList.remove('selected');
                });
                // Select this one
                item.classList.add('selected');
                this.selectedMoveTarget = item.dataset.path;
            });
        });
    }

    /**
     * Confirm the move operation
     */
    async confirmMove() {
        if (this.selectedMoveTarget === null || this.selectedMoveTarget === undefined) {
            alert(_('Please select a destination folder'));
            return;
        }

        if (!this.assetManager) {
            this.hideFolderPicker();
            return;
        }

        const destinationPath = this.selectedMoveTarget;

        // Check if moving a folder
        if (this.selectedFolderPath) {
            const folderPath = this.selectedFolderPath;
            const folderName = this.selectedFolder;

            // Get parent path of the folder being moved
            const parts = folderPath.split('/');
            parts.pop();
            const currentParent = parts.join('/');

            if (currentParent === destinationPath) {
                alert(_('Folder is already in this location'));
                return;
            }

            // Check if destination already has a folder with this name
            const newPath = destinationPath ? `${destinationPath}/${folderName}` : folderName;
            const existingFolders = this.deriveSubfolders(this.assets, destinationPath);
            if (existingFolders.includes(folderName)) {
                alert(_('A folder with this name already exists in the destination.'));
                return;
            }

            try {
                await this.assetManager.moveFolder(folderPath, destinationPath);
                Logger.log(`[MediaLibrary] Moved folder ${folderPath} to ${newPath}`);

                // Clear selection
                this.selectedFolder = null;
                this.selectedFolderPath = null;

                this.hideFolderPicker();
                this.showSidebarEmpty();

                // Reload assets to reflect the change
                await this.loadAssets();
            } catch (err) {
                console.error('[MediaLibrary] Failed to move folder:', err);
                alert(_('Failed to move folder'));
            }
            return;
        }

        // Moving a file
        if (!this.selectedAsset) {
            this.hideFolderPicker();
            return;
        }

        const currentPath = this.selectedAsset.folderPath || '';

        if (currentPath === destinationPath) {
            alert(_('File is already in this folder'));
            return;
        }

        try {
            await this.assetManager.updateAssetFolderPath(this.selectedAsset.id, destinationPath);
            Logger.log(`[MediaLibrary] Moved asset ${this.selectedAsset.id} from "${currentPath}" to "${destinationPath}"`);

            this.hideFolderPicker();

            // Reload assets to reflect the change
            await this.loadAssets();
        } catch (err) {
            console.error('[MediaLibrary] Failed to move asset:', err);
            alert(_('Failed to move file'));
        }
    }

    /**
     * Insert selected asset(s) into editor
     */
    async insertSelectedAsset() {
        const assetsToInsert = this.multiSelect ? this.selectedAssets : (this.selectedAsset ? [this.selectedAsset] : []);
        if (assetsToInsert.length === 0) return;

        // If callback provided, use it
        if (this.onSelectCallback) {
            // Build array of asset info for callback
            const assetInfos = [];
            for (const asset of assetsToInsert) {
                const assetUrl = this.assetManager.getAssetUrl(asset.id, asset.filename);

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

                // For HTML files, resolve internal URLs for proper display in iframes
                if (asset.mime === 'text/html' ||
                    (asset.filename && /\.html?$/i.test(asset.filename))) {
                    try {
                        const resolvedUrl = await this.assetManager.resolveHtmlWithAssets(asset.id);
                        if (resolvedUrl) {
                            blobUrl = resolvedUrl;
                        }
                    } catch (err) {
                        console.warn('[MediaLibrary] Failed to resolve HTML with assets:', err);
                    }
                }

                assetInfos.push({
                    assetUrl: assetUrl,
                    blobUrl: blobUrl,
                    asset: asset
                });
            }

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
        const assetUrl = this.assetManager.getAssetUrl(this.selectedAsset.id, this.selectedAsset.filename);

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
            } else if (this.selectedAsset.mime === 'text/html' ||
                       (this.selectedAsset.filename && /\.html?$/i.test(this.selectedAsset.filename))) {
                // Insert HTML as iframe using asset:// URL (resolved to blob:// by resolveAssetUrlsInEditor)
                // This ensures the asset:// URL is preserved in data-mce-p-src for correct persistence
                // The resolveAssetUrlsInEditor function will use resolveHtmlWithAssets() for display
                editor.insertContent(`<iframe src="${assetUrl}" data-mce-html="true" style="width:100%; height:600px; border:1px solid #ccc;"></iframe>`);
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
     * Download the selected asset
     */
    downloadSelectedAsset() {
        if (!this.selectedAsset) return;

        const asset = this.selectedAsset;

        // Get blob URL
        let blobUrl = this.assetManager?.getBlobURLSynced?.(asset.id) ?? this.assetManager?.blobURLCache.get(asset.id);
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
        }

        if (!blobUrl) {
            console.error('[MediaLibrary] No blob URL available for download');
            return;
        }

        // Create a temporary link and trigger download
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = asset.filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        Logger.log(`[MediaLibrary] Downloaded asset: ${asset.id}`);
    }

    /**
     * Copy the asset URL to clipboard
     */
    copyAssetUrl() {
        if (!this.selectedAsset) return;

        const asset = this.selectedAsset;
        const assetUrl = this.assetManager.getAssetUrl(asset.id, asset.filename);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(assetUrl).then(() => {
                // Could show a toast notification here
                Logger.log(`[MediaLibrary] Copied URL to clipboard: ${assetUrl}`);
            }).catch(err => {
                console.error('[MediaLibrary] Failed to copy URL:', err);
            });
        }
    }

    /**
     * View the asset in full size (new tab)
     */
    viewFullSize() {
        if (!this.selectedAsset) return;

        const asset = this.selectedAsset;

        // Get blob URL
        let blobUrl = this.assetManager?.getBlobURLSynced?.(asset.id) ?? this.assetManager?.blobURLCache.get(asset.id);
        if (!blobUrl && asset.blob) {
            blobUrl = URL.createObjectURL(asset.blob);
        }

        if (!blobUrl) {
            console.error('[MediaLibrary] No blob URL available for full size view');
            return;
        }

        // Open in new tab
        window.open(blobUrl, '_blank');
        Logger.log(`[MediaLibrary] Opened asset in new tab: ${asset.id}`);
    }

    /**
     * Extract contents of a ZIP file and add them as assets
     * Preserves the internal folder structure of the ZIP
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

        // Suggest folder name based on ZIP filename (without extension)
        const zipFilename = asset.filename || 'archive';
        const suggestedName = zipFilename.replace(/\.zip$/i, '');

        // Ask for target folder
        const targetFolder = prompt(
            _('Extract to folder:') + '\n\n' +
            _('The internal folder structure of the ZIP will be preserved.'),
            suggestedName
        );

        if (targetFolder === null) return; // User cancelled

        // Validate folder name
        if (targetFolder && !this.isValidFolderName(targetFolder)) {
            alert(_('Invalid folder name. Avoid special characters like / \\ : * ? " < > |'));
            return;
        }

        // Build base path (current path + target folder)
        const basePath = targetFolder
            ? (this.currentPath ? `${this.currentPath}/${targetFolder}` : targetFolder)
            : this.currentPath;

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

            // Show loading state - disable the More button during extraction
            if (this.moreBtn) {
                this.moreBtn.disabled = true;
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

                // Get filename and folder path from ZIP entry
                const parts = filepath.split('/');
                const basename = parts.pop();

                // Skip hidden files and system files
                if (!basename || basename.startsWith('.') || basename.startsWith('__')) {
                    skippedCount++;
                    continue;
                }

                // Skip directories like __MACOSX
                if (parts.some(p => p.startsWith('__') || p.startsWith('.'))) {
                    skippedCount++;
                    continue;
                }

                // Build the full folder path for this file
                let folderPath = basePath;
                if (parts.length > 0) {
                    const zipSubpath = parts.join('/');
                    folderPath = basePath ? `${basePath}/${zipSubpath}` : zipSubpath;
                }

                try {
                    // Create blob from extracted content
                    const mimeType = this.getMimeTypeFromFilename(basename);
                    const fileBlob = new Blob([content], { type: mimeType });

                    // Create a File object with the correct name
                    const file = new File([fileBlob], basename, { type: mimeType });

                    // Upload to asset manager with folder path
                    await this.assetManager.insertImage(file, { folderPath });
                    extractedCount++;
                    Logger.log(`[MediaLibrary] Extracted: ${folderPath}/${basename}`);
                } catch (err) {
                    console.error(`[MediaLibrary] Failed to extract ${filepath}:`, err);
                    skippedCount++;
                }
            }

            // Restore button state
            if (this.moreBtn) {
                this.moreBtn.disabled = false;
            }

            // Show result
            if (extractedCount > 0) {
                Logger.log(`[MediaLibrary] Extracted ${extractedCount} files from ZIP to "${basePath}"`);
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
            if (this.moreBtn) {
                this.moreBtn.disabled = false;
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
        // Unsubscribe from Yjs asset changes
        this._unsubscribeFromYjsChanges();

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
        this.selectedFolder = null;
        this.selectedFolderPath = null;
        this.multiSelect = false;
        this.onSelectCallback = null;
        this.acceptFilter = null;
        this.typeFilter = '';

        // Reset folder navigation
        this.currentPath = '';
        this.folders = [];
        this.createdFolders.clear();

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
