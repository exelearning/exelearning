/**
 * GlobalSearchModal - Command palette style search modal
 * Provides global search across pages and iDevice content with keyboard navigation
 */
import { buildSearchIndex, search, debounce } from './SearchEngine.js';

export default class GlobalSearchModal {
    /**
     * @param {Object} manager - ModalsManager instance
     */
    constructor(manager) {
        this.manager = manager;
        this.modalElement = document.getElementById('modalGlobalSearch');

        // Defensive check - modal element must exist
        if (!this.modalElement) {
            console.warn('[GlobalSearchModal] Modal element not found in DOM');
            this.modal = null;
            this.searchInput = null;
            this.resultsContainer = null;
            this.emptyState = null;
            this.searchIndex = null;
            this.results = [];
            this.selectedIndex = 0;
            this.debouncedSearch = () => {};
            this.permanent = false;
            return;
        }

        this.modal = new bootstrap.Modal(this.modalElement, { backdrop: true });
        this.searchInput = document.getElementById('global-search-input');
        this.resultsContainer = this.modalElement.querySelector('.global-search-results');
        this.emptyState = this.modalElement.querySelector('.global-search-empty');

        this.searchIndex = null;
        this.results = [];
        this.selectedIndex = 0;
        this.debouncedSearch = debounce(this.performSearch.bind(this), 150);
        this.permanent = false;

        // Initialize data-open attribute
        this.modalElement.setAttribute('data-open', 'false');
    }

    /**
     * Set up event listeners
     */
    behaviour() {
        // Skip if modal element not available
        if (!this.modalElement || !this.modal) {
            return;
        }

        // Input event for search
        this.searchInput.addEventListener('input', () => this.handleInput());

        // Keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Modal shown event - focus input
        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.searchInput.focus();
            this.modalElement.setAttribute('data-open', 'true');
        });

        // Modal hidden event
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.modalElement.setAttribute('data-open', 'false');
        });

        // Close button
        const closeButton = this.modalElement.querySelector('.close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }
    }

    /**
     * Show the modal
     */
    show() {
        // Skip if modal not available
        if (!this.modal) {
            console.warn('[GlobalSearchModal] Cannot show - modal not initialized');
            return;
        }

        // Build/refresh search index
        this.buildIndex();

        // Clear previous state
        this.searchInput.value = '';
        this.results = [];
        this.selectedIndex = 0;
        this.resultsContainer.innerHTML = '';
        this.emptyState.classList.add('d-none');

        // Show modal
        this.modal.show();

        // Focus will be handled by shown.bs.modal event
        this.searchInput.focus();
    }

    /**
     * Close the modal
     * @param {boolean} [force=false] - Force close without animation (used by closeModals)
     */
    close(force = false) {
        // Skip if modal not available
        if (!this.modal || !this.modalElement) {
            return;
        }

        // Move focus out before hiding to avoid aria-hidden warning
        if (document.activeElement && this.modalElement.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        this.modal.hide();
    }

    /**
     * Build search index from Yjs structure
     */
    buildIndex() {
        try {
            const yjsBinding = eXeLearning.app.project._yjsBridge?.structureBinding;
            if (yjsBinding) {
                this.searchIndex = buildSearchIndex(yjsBinding);
                console.debug(`[GlobalSearchModal] Search index built with ${this.searchIndex.length} items`);
            } else {
                // Yjs not ready yet - this is normal during initial load
                // Search will work once content is loaded
                console.debug('[GlobalSearchModal] Yjs structureBinding not available yet');
                this.searchIndex = [];
            }
        } catch (error) {
            console.error('[GlobalSearchModal] Error building index:', error);
            this.searchIndex = [];
        }
    }

    /**
     * Handle input events
     */
    handleInput() {
        const query = this.searchInput.value.trim();

        if (!query) {
            this.results = [];
            this.renderResults([]);
            return;
        }

        this.debouncedSearch();
    }

    /**
     * Perform the actual search
     */
    performSearch() {
        const query = this.searchInput.value.trim();

        if (!query || !this.searchIndex) {
            this.results = [];
            this.renderResults([]);
            return;
        }

        this.results = search(this.searchIndex, query, { maxResults: 15 });
        this.selectedIndex = 0;
        this.renderResults(this.results);
    }

    /**
     * Render search results
     * @param {Array} results - Array of search results
     */
    renderResults(results) {
        this.resultsContainer.innerHTML = '';

        // Handle empty state
        if (results.length === 0) {
            const hasQuery = this.searchInput.value.trim().length > 0;
            if (hasQuery) {
                this.emptyState.classList.remove('d-none');
            } else {
                this.emptyState.classList.add('d-none');
            }
            return;
        }

        this.emptyState.classList.add('d-none');

        results.forEach((result, index) => {
            const item = this.createResultItem(result, index);
            this.resultsContainer.appendChild(item);
        });

        // Mark first item as selected
        this.updateSelection();
    }

    /**
     * Create a result item element
     * @param {Object} result - Search result
     * @param {number} index - Result index
     * @returns {HTMLElement}
     */
    createResultItem(result, index) {
        const li = document.createElement('li');
        li.className = 'global-search-result-item';
        li.setAttribute('role', 'option');
        li.setAttribute('data-result-index', index);

        // Header with icon and title
        const header = document.createElement('div');
        header.className = 'result-header';

        // Icon
        const icon = document.createElement('span');
        icon.className = 'exe-icon result-icon';
        icon.textContent = result.type === 'page' ? 'description' : 'edit_note';
        header.appendChild(icon);

        // Title
        const title = document.createElement('span');
        title.className = 'result-title';
        title.textContent = result.title || result.pageName || '';
        header.appendChild(title);

        // Type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = 'result-type';
        typeBadge.textContent = result.type === 'page' ? _('Page') : _('iDevice');
        header.appendChild(typeBadge);

        li.appendChild(header);

        // Content snippet for components
        if (result.type === 'component' && result.content) {
            const snippet = document.createElement('div');
            snippet.className = 'result-snippet';

            // Highlight query in snippet
            const query = this.searchInput.value.trim().toLowerCase();
            let snippetText = result.content;
            if (snippetText.length > 120) {
                // Find query position and center around it
                const queryPos = snippetText.toLowerCase().indexOf(query);
                if (queryPos > 60) {
                    snippetText = '...' + snippetText.substring(queryPos - 40);
                }
                if (snippetText.length > 120) {
                    snippetText = snippetText.substring(0, 120) + '...';
                }
            }

            // Highlight matching text
            if (query) {
                const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
                snippetText = snippetText.replace(regex, '<mark>$1</mark>');
            }

            snippet.innerHTML = snippetText;
            li.appendChild(snippet);

            // Page context
            const context = document.createElement('div');
            context.className = 'result-context';
            context.textContent = _('in') + ' ' + result.pageName;
            li.appendChild(context);
        }

        // Click handler
        li.addEventListener('click', () => {
            this.selectedIndex = index;
            this.navigateToResult(result);
        });

        return li;
    }

    /**
     * Escape special regex characters
     * @param {string} str - String to escape
     * @returns {string}
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.moveSelection(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveSelection(-1);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.results.length > 0) {
                    this.navigateToResult(this.results[this.selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    /**
     * Move selection up or down
     * @param {number} direction - 1 for down, -1 for up
     */
    moveSelection(direction) {
        if (this.results.length === 0) return;

        this.selectedIndex += direction;

        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.results.length - 1;
        } else if (this.selectedIndex >= this.results.length) {
            this.selectedIndex = 0;
        }

        this.updateSelection();
    }

    /**
     * Update visual selection state
     */
    updateSelection() {
        const items = this.resultsContainer.querySelectorAll('.global-search-result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                // Scroll into view if needed
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Navigate to a search result
     * @param {Object} result - Search result to navigate to
     */
    async navigateToResult(result) {
        if (!result) return;

        // Find the nav element for this page
        const navElement = document.querySelector(`.nav-element[nav-id="${result.pageId}"]`);
        if (!navElement) {
            console.warn(`[GlobalSearchModal] Nav element not found for page: ${result.pageId}`);
            this.close();
            return;
        }

        // Use existing selectNode for page navigation
        const behaviour = eXeLearning.app.menus?.menuStructure?.menuStructureBehaviour;
        if (behaviour) {
            await behaviour.selectNode(navElement);
        }

        // If component result, scroll to and highlight the iDevice
        if (result.type === 'component' && result.id) {
            await this.scrollToIdevice(result.id);
        }

        this.close();
    }

    /**
     * Scroll to an iDevice and highlight it
     * @param {string} componentId - Component/iDevice ID
     */
    async scrollToIdevice(componentId) {
        // Wait for content to load
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Find iDevice element by ID directly (iDevices have id=odeIdeviceId)
        // or by class idevice_node with matching id
        let idevice = document.getElementById(componentId);

        // Fallback: search by class if not found by ID
        if (!idevice) {
            idevice = document.querySelector(`#node-content .idevice_node[id="${componentId}"]`);
        }

        if (idevice) {
            idevice.scrollIntoView({ behavior: 'smooth', block: 'center' });
            idevice.classList.add('search-highlight');

            // Remove highlight after animation
            setTimeout(() => {
                idevice.classList.remove('search-highlight');
            }, 2000);
        }
    }
}
