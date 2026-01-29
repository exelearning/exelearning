import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GlobalSearchModal from './GlobalSearchModal.js';
import { debounce } from './SearchEngine.js';

describe('GlobalSearchModal', () => {
    let modal;
    let mockManager;
    let mockModalElement;
    let mockBootstrapModal;

    beforeEach(() => {
        // Mock translation function
        window._ = vi.fn((key) => key);

        // Mock eXeLearning global
        window.eXeLearning = {
            app: {
                project: {
                    _yjsBridge: {
                        binding: {
                            getPages: vi.fn().mockReturnValue([
                                { id: 'page-1', pageId: 'page-1', pageName: 'Introduction' },
                                { id: 'page-2', pageId: 'page-2', pageName: 'Chapter 1' },
                            ]),
                            getBlocks: vi.fn().mockReturnValue([]),
                            getComponents: vi.fn().mockReturnValue([]),
                        },
                    },
                    structure: {
                        menuStructureBehaviour: {
                            selectNode: vi.fn().mockResolvedValue(true),
                            nodeSelected: {
                                getAttribute: vi.fn().mockReturnValue('page-1'),
                            },
                        },
                    },
                },
                menus: {
                    menuStructure: {
                        menuStructureBehaviour: {
                            selectNode: vi.fn().mockResolvedValue(true),
                        },
                    },
                },
            },
        };

        // Mock DOM
        mockModalElement = document.createElement('div');
        mockModalElement.id = 'modalGlobalSearch';
        mockModalElement.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-body">
                        <div class="global-search-input-wrapper">
                            <input type="text" id="global-search-input" />
                        </div>
                        <ul class="global-search-results" role="listbox"></ul>
                        <div class="global-search-empty d-none"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(mockModalElement);

        // Mock bootstrap.Modal
        mockBootstrapModal = {
            show: vi.fn(),
            hide: vi.fn(),
            _isShown: false,
        };
        window.bootstrap = {
            Modal: vi.fn().mockImplementation(function () {
                return mockBootstrapModal;
            }),
        };

        mockManager = {
            closeModals: vi.fn(() => false),
        };

        modal = new GlobalSearchModal(mockManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct element references', () => {
            expect(modal.modalElement).toBe(mockModalElement);
            expect(modal.searchInput).toBe(document.getElementById('global-search-input'));
            expect(modal.resultsContainer).toBeTruthy();
            expect(modal.emptyState).toBeTruthy();
        });

        it('should create bootstrap modal instance', () => {
            expect(window.bootstrap.Modal).toHaveBeenCalledWith(mockModalElement, expect.any(Object));
        });

        it('should initialize with empty results', () => {
            expect(modal.results).toEqual([]);
            expect(modal.selectedIndex).toBe(0);
        });

        it('should handle missing modal element gracefully', () => {
            // Remove the modal element from DOM
            document.body.innerHTML = '';

            // Create a new modal instance - should not throw
            const modalWithoutElement = new GlobalSearchModal(mockManager);

            // Should have null/empty values
            expect(modalWithoutElement.modal).toBeNull();
            expect(modalWithoutElement.modalElement).toBeNull();
            expect(modalWithoutElement.results).toEqual([]);
        });
    });

    describe('show', () => {
        it('should show the modal', () => {
            modal.show();
            expect(mockBootstrapModal.show).toHaveBeenCalled();
        });

        it('should clear search input on show', () => {
            modal.searchInput.value = 'previous search';
            modal.show();
            expect(modal.searchInput.value).toBe('');
        });

        it('should focus search input on show', () => {
            const focusSpy = vi.spyOn(modal.searchInput, 'focus');
            modal.show();
            expect(focusSpy).toHaveBeenCalled();
        });

        it('should build search index on show', () => {
            const buildIndexSpy = vi.spyOn(modal, 'buildIndex');
            modal.show();
            expect(buildIndexSpy).toHaveBeenCalled();
        });

        it('should clear previous results on show', () => {
            modal.results = [{ id: 'test' }];
            modal.show();
            expect(modal.resultsContainer.innerHTML).toBe('');
        });
    });

    describe('close', () => {
        it('should hide the modal', () => {
            modal.close();
            expect(mockBootstrapModal.hide).toHaveBeenCalled();
        });

        it('should not throw when modal not initialized', () => {
            document.body.innerHTML = '';
            const modalWithoutElement = new GlobalSearchModal(mockManager);
            // Should not throw
            expect(() => modalWithoutElement.close()).not.toThrow();
        });
    });

    describe('handleInput', () => {
        it('should trigger debounced search on input', () => {
            vi.useFakeTimers();
            // Create a new debounced search spy before calling handleInput
            const performSearchSpy = vi.fn();
            modal.debouncedSearch = debounce(performSearchSpy, 150);

            modal.searchInput.value = 'test';
            modal.handleInput();

            vi.advanceTimersByTime(150);
            expect(performSearchSpy).toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('should clear results for empty query', () => {
            modal.searchInput.value = '';
            modal.handleInput();
            expect(modal.results).toEqual([]);
        });
    });

    describe('performSearch', () => {
        beforeEach(() => {
            modal.searchIndex = [
                {
                    id: 'page-1',
                    type: 'page',
                    pageId: 'page-1',
                    pageName: 'Introduction',
                    title: 'Introduction',
                    content: '',
                    _titleLower: 'introduction',
                    _contentLower: '',
                },
            ];
        });

        it('should search the index and update results', () => {
            modal.searchInput.value = 'intro';
            modal.performSearch();
            expect(modal.results.length).toBeGreaterThan(0);
        });

        it('should render results after search', () => {
            const renderSpy = vi.spyOn(modal, 'renderResults');
            modal.searchInput.value = 'intro';
            modal.performSearch();
            expect(renderSpy).toHaveBeenCalled();
        });

        it('should reset selected index after search', () => {
            modal.selectedIndex = 5;
            modal.searchInput.value = 'intro';
            modal.performSearch();
            expect(modal.selectedIndex).toBe(0);
        });
    });

    describe('renderResults', () => {
        it('should render result items', () => {
            const results = [
                {
                    id: 'page-1',
                    type: 'page',
                    pageId: 'page-1',
                    pageName: 'Test Page',
                    title: 'Test Page',
                    content: '',
                },
            ];
            modal.renderResults(results);
            const items = modal.resultsContainer.querySelectorAll('.global-search-result-item');
            expect(items.length).toBe(1);
        });

        it('should show empty state when no results and query exists', () => {
            modal.searchInput.value = 'nonexistent';
            modal.renderResults([]);
            expect(modal.emptyState.classList.contains('d-none')).toBe(false);
        });

        it('should hide empty state when results exist', () => {
            const results = [
                {
                    id: 'page-1',
                    type: 'page',
                    pageId: 'page-1',
                    pageName: 'Test',
                    title: 'Test',
                    content: '',
                },
            ];
            modal.renderResults(results);
            expect(modal.emptyState.classList.contains('d-none')).toBe(true);
        });

        it('should mark first result as selected', () => {
            const results = [
                { id: 'page-1', type: 'page', pageId: 'page-1', pageName: 'Test 1', title: 'Test 1', content: '' },
                { id: 'page-2', type: 'page', pageId: 'page-2', pageName: 'Test 2', title: 'Test 2', content: '' },
            ];
            modal.renderResults(results);
            const items = modal.resultsContainer.querySelectorAll('.global-search-result-item');
            expect(items[0].classList.contains('selected')).toBe(true);
            expect(items[1].classList.contains('selected')).toBe(false);
        });

        it('should display page type for page results', () => {
            const results = [
                { id: 'page-1', type: 'page', pageId: 'page-1', pageName: 'Test', title: 'Test', content: '' },
            ];
            modal.renderResults(results);
            const typeSpan = modal.resultsContainer.querySelector('.result-type');
            expect(typeSpan.textContent).toContain('Page');
        });

        it('should display iDevice type for component results', () => {
            const results = [
                {
                    id: 'comp-1',
                    type: 'component',
                    pageId: 'page-1',
                    pageName: 'Test Page',
                    title: 'Free Text',
                    content: 'Some content',
                    ideviceType: 'freetext',
                },
            ];
            modal.renderResults(results);
            const typeSpan = modal.resultsContainer.querySelector('.result-type');
            expect(typeSpan.textContent).toContain('iDevice');
        });

        it('should show content snippet for component results', () => {
            const results = [
                {
                    id: 'comp-1',
                    type: 'component',
                    pageId: 'page-1',
                    pageName: 'Test Page',
                    title: 'Free Text',
                    content: 'This is some important content',
                    ideviceType: 'freetext',
                },
            ];
            modal.renderResults(results);
            const snippet = modal.resultsContainer.querySelector('.result-snippet');
            expect(snippet).toBeTruthy();
            expect(snippet.textContent).toContain('important content');
        });

        it('should show page context for component results', () => {
            const results = [
                {
                    id: 'comp-1',
                    type: 'component',
                    pageId: 'page-1',
                    pageName: 'Introduction',
                    title: 'Free Text',
                    content: 'Content',
                    ideviceType: 'freetext',
                },
            ];
            modal.renderResults(results);
            const context = modal.resultsContainer.querySelector('.result-context');
            expect(context).toBeTruthy();
            expect(context.textContent).toContain('Introduction');
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            modal.results = [
                { id: 'page-1', type: 'page', pageId: 'page-1', pageName: 'Test 1', title: 'Test 1', content: '' },
                { id: 'page-2', type: 'page', pageId: 'page-2', pageName: 'Test 2', title: 'Test 2', content: '' },
                { id: 'page-3', type: 'page', pageId: 'page-3', pageName: 'Test 3', title: 'Test 3', content: '' },
            ];
            modal.renderResults(modal.results);
            modal.selectedIndex = 0;
        });

        it('should move selection down on ArrowDown', () => {
            modal.handleKeydown({ key: 'ArrowDown', preventDefault: vi.fn() });
            expect(modal.selectedIndex).toBe(1);
        });

        it('should move selection up on ArrowUp', () => {
            modal.selectedIndex = 2;
            modal.handleKeydown({ key: 'ArrowUp', preventDefault: vi.fn() });
            expect(modal.selectedIndex).toBe(1);
        });

        it('should wrap around at bottom on ArrowDown', () => {
            modal.selectedIndex = 2;
            modal.handleKeydown({ key: 'ArrowDown', preventDefault: vi.fn() });
            expect(modal.selectedIndex).toBe(0);
        });

        it('should wrap around at top on ArrowUp', () => {
            modal.selectedIndex = 0;
            modal.handleKeydown({ key: 'ArrowUp', preventDefault: vi.fn() });
            expect(modal.selectedIndex).toBe(2);
        });

        it('should navigate to result on Enter', async () => {
            const navigateSpy = vi.spyOn(modal, 'navigateToResult').mockResolvedValue();
            await modal.handleKeydown({ key: 'Enter', preventDefault: vi.fn() });
            expect(navigateSpy).toHaveBeenCalledWith(modal.results[0]);
        });

        it('should close modal on Escape', () => {
            const closeSpy = vi.spyOn(modal, 'close');
            modal.handleKeydown({ key: 'Escape', preventDefault: vi.fn() });
            expect(closeSpy).toHaveBeenCalled();
        });

        it('should prevent default for navigation keys', () => {
            const event = { key: 'ArrowDown', preventDefault: vi.fn() };
            modal.handleKeydown(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should update visual selection', () => {
            modal.handleKeydown({ key: 'ArrowDown', preventDefault: vi.fn() });
            const items = modal.resultsContainer.querySelectorAll('.global-search-result-item');
            expect(items[0].classList.contains('selected')).toBe(false);
            expect(items[1].classList.contains('selected')).toBe(true);
        });
    });

    describe('navigateToResult', () => {
        beforeEach(() => {
            // Add nav element to DOM
            const navElement = document.createElement('div');
            navElement.classList.add('nav-element');
            navElement.setAttribute('nav-id', 'page-1');
            document.body.appendChild(navElement);
        });

        it('should navigate to page result', async () => {
            const result = { id: 'page-1', type: 'page', pageId: 'page-1' };
            await modal.navigateToResult(result);

            const navElement = document.querySelector('.nav-element[nav-id="page-1"]');
            const selectNodeFn = window.eXeLearning.app.menus.menuStructure.menuStructureBehaviour.selectNode;
            expect(selectNodeFn).toHaveBeenCalledWith(navElement);
        });

        it('should close modal after navigation', async () => {
            const closeSpy = vi.spyOn(modal, 'close');
            const result = { id: 'page-1', type: 'page', pageId: 'page-1' };
            await modal.navigateToResult(result);
            expect(closeSpy).toHaveBeenCalled();
        });

        it('should scroll to iDevice for component results', async () => {
            const scrollSpy = vi.spyOn(modal, 'scrollToIdevice').mockResolvedValue();
            const result = {
                id: 'comp-1',
                type: 'component',
                pageId: 'page-1',
                blockId: 'block-1',
            };
            await modal.navigateToResult(result);
            expect(scrollSpy).toHaveBeenCalledWith('comp-1');
        });
    });

    describe('scrollToIdevice', () => {
        it('should scroll iDevice into view and add highlight class', async () => {
            vi.useFakeTimers();

            // Create mock iDevice element with id (iDevices have id=odeIdeviceId)
            document.body.innerHTML = '<div id="node-content"></div>';
            const ideviceEl = document.createElement('article');
            ideviceEl.id = 'comp-1';
            ideviceEl.classList.add('idevice_node');
            document.getElementById('node-content').appendChild(ideviceEl);

            const scrollSpy = vi.spyOn(ideviceEl, 'scrollIntoView').mockImplementation(() => {});

            modal.scrollToIdevice('comp-1');
            await vi.advanceTimersByTimeAsync(300);

            expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
            expect(ideviceEl.classList.contains('search-highlight')).toBe(true);

            vi.useRealTimers();
        });

        it('should remove highlight class after timeout', async () => {
            vi.useFakeTimers();

            // Create mock iDevice element with id (iDevices have id=odeIdeviceId)
            document.body.innerHTML = '<div id="node-content"></div>';
            const ideviceEl = document.createElement('article');
            ideviceEl.id = 'comp-1';
            ideviceEl.classList.add('idevice_node');
            document.getElementById('node-content').appendChild(ideviceEl);

            modal.scrollToIdevice('comp-1');
            await vi.advanceTimersByTimeAsync(300);

            expect(ideviceEl.classList.contains('search-highlight')).toBe(true);

            await vi.advanceTimersByTimeAsync(2000);
            expect(ideviceEl.classList.contains('search-highlight')).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('result click handling', () => {
        it('should navigate to result on click', async () => {
            const navigateSpy = vi.spyOn(modal, 'navigateToResult').mockResolvedValue();
            const results = [
                { id: 'page-1', type: 'page', pageId: 'page-1', pageName: 'Test', title: 'Test', content: '' },
            ];
            modal.results = results;
            modal.renderResults(results);

            const item = modal.resultsContainer.querySelector('.global-search-result-item');
            item.click();

            expect(navigateSpy).toHaveBeenCalledWith(results[0]);
        });
    });

    describe('behaviour', () => {
        it('should set up input event listener', () => {
            const addEventSpy = vi.spyOn(modal.searchInput, 'addEventListener');
            modal.behaviour();
            expect(addEventSpy).toHaveBeenCalledWith('input', expect.any(Function));
        });

        it('should set up keydown event listener', () => {
            const addEventSpy = vi.spyOn(modal.searchInput, 'addEventListener');
            modal.behaviour();
            expect(addEventSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('should set up modal shown event listener', () => {
            const addEventSpy = vi.spyOn(modal.modalElement, 'addEventListener');
            modal.behaviour();
            expect(addEventSpy).toHaveBeenCalledWith('shown.bs.modal', expect.any(Function));
        });
    });
});
