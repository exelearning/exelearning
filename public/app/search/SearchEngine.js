/**
 * SearchEngine - Core search functionality for global search
 * Provides HTML stripping, index building, and search algorithms
 */

/**
 * Strip HTML tags from content and normalize for search
 * @param {string} html - HTML content to strip
 * @param {number} maxLength - Maximum length of returned text (default: 1000)
 * @returns {string} Plain text content
 */
export function stripHtmlForSearch(html, maxLength = 1000) {
    if (!html) return '';

    // Use DOMParser for safe HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script and style elements
    doc.querySelectorAll('script, style').forEach((el) => el.remove());

    // Get text content
    let text = doc.body.textContent || '';

    // Normalize whitespace (collapse multiple spaces, tabs, newlines)
    text = text.replace(/\s+/g, ' ').trim();

    // Truncate if needed
    if (text.length > maxLength) {
        text = text.substring(0, maxLength);
    }

    return text;
}

/**
 * Build a search index from Yjs structure
 * @param {Object} yjsBinding - YjsStructureBinding instance
 * @param {Object} options - Options for index building
 * @returns {Array} Array of searchable items
 */
export function buildSearchIndex(yjsBinding, options = {}) {
    const index = [];
    const maxContentLength = options.maxContentLength || 1000;

    try {
        const pages = yjsBinding.getPages();
        console.debug(`[SearchEngine] Building index: found ${pages.length} pages`);

        for (const page of pages) {
            // Add page entry
            const pageEntry = {
                id: page.id || page.pageId,
                type: 'page',
                pageId: page.id || page.pageId,
                pageName: page.pageName || '',
                title: page.pageName || '',
                content: '',
                ideviceType: null,
                blockId: null,
                _titleLower: (page.pageName || '').toLowerCase(),
                _contentLower: '',
            };
            index.push(pageEntry);

            // Get blocks for this page
            const blocks = yjsBinding.getBlocks(page.id || page.pageId);

            for (const block of blocks) {
                // Get components in this block
                const components = yjsBinding.getComponents(
                    page.id || page.pageId,
                    block.id || block.blockId
                );

                for (const component of components) {
                    // Get component content from various possible fields
                    // The main content field in Yjs is 'htmlContent' or 'htmlView'
                    let rawContent = '';
                    if (component.htmlContent) {
                        rawContent = component.htmlContent;
                    } else if (component.htmlView) {
                        rawContent = component.htmlView;
                    } else if (component.content) {
                        rawContent = component.content;
                    } else if (component.html) {
                        rawContent = component.html;
                    } else if (component.text) {
                        rawContent = component.text;
                    }

                    // Also check jsonProperties for additional searchable content
                    // jsonProperties is a JSON string in Yjs
                    if (component.jsonProperties) {
                        try {
                            const props = typeof component.jsonProperties === 'string'
                                ? JSON.parse(component.jsonProperties)
                                : component.jsonProperties;
                            // Common content fields in iDevice properties
                            const propFields = ['content', 'html', 'text', 'question', 'answer',
                                               'feedback', 'instructions', 'description', 'title'];
                            for (const field of propFields) {
                                if (props[field] && typeof props[field] === 'string') {
                                    rawContent += ' ' + props[field];
                                }
                            }
                        } catch (e) {
                            // Ignore JSON parse errors
                        }
                    }

                    // Also check for additional content fields in different iDevice types
                    const additionalFields = ['question', 'answer', 'feedback', 'instructions', 'description'];
                    for (const field of additionalFields) {
                        if (component[field]) {
                            rawContent += ' ' + component[field];
                        }
                    }

                    const strippedContent = stripHtmlForSearch(rawContent, maxContentLength);

                    // Get title from iDevice type or try to extract from jsonProperties
                    let componentTitle = component.ideviceType || '';
                    if (component.jsonProperties) {
                        try {
                            const props = typeof component.jsonProperties === 'string'
                                ? JSON.parse(component.jsonProperties)
                                : component.jsonProperties;
                            if (props.title) {
                                componentTitle = props.title;
                            }
                        } catch (e) {
                            // Ignore JSON parse errors
                        }
                    }

                    const componentEntry = {
                        id: component.id || component.ideviceId,
                        type: 'component',
                        pageId: page.id || page.pageId,
                        pageName: page.pageName || '',
                        title: componentTitle,
                        content: strippedContent,
                        ideviceType: component.ideviceType || null,
                        blockId: block.id || block.blockId,
                        _titleLower: componentTitle.toLowerCase(),
                        _contentLower: strippedContent.toLowerCase(),
                    };
                    index.push(componentEntry);
                }
            }
        }
    } catch (error) {
        console.error('[SearchEngine] Error building index:', error);
    }

    return index;
}

/**
 * Search the index for matching items
 * @param {Array} index - Search index from buildSearchIndex
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Sorted array of matching results with scores
 */
export function search(index, query, options = {}) {
    const { maxResults = 20 } = options;

    // Handle empty query
    const trimmedQuery = (query || '').trim();
    if (!trimmedQuery) {
        return [];
    }

    const queryLower = trimmedQuery.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);

    const results = [];

    for (const item of index) {
        let score = 0;
        let matches = false;

        // Check if all query words match (AND logic)
        let allWordsMatch = true;
        for (const word of queryWords) {
            const wordMatches =
                item._titleLower.includes(word) ||
                item._contentLower.includes(word) ||
                (item.pageName && item.pageName.toLowerCase().includes(word));

            if (!wordMatches) {
                allWordsMatch = false;
                break;
            }
        }

        if (!allWordsMatch) {
            continue;
        }

        matches = true;

        // Calculate score based on match quality
        // Exact title match
        if (item._titleLower === queryLower) {
            score += 150;
        }
        // Title starts with query
        else if (item._titleLower.startsWith(queryLower)) {
            score += 130;
        }
        // Title contains query
        else if (item._titleLower.includes(queryLower)) {
            score += 100;
        }

        // Content match (lower priority)
        if (item._contentLower.includes(queryLower)) {
            score += 50;
        }

        // Bonus for individual word matches in title
        for (const word of queryWords) {
            if (item._titleLower.includes(word)) {
                score += 20;
            }
        }

        // Page type bonus (pages rank higher than components)
        if (item.type === 'page') {
            score += 10;
        }

        if (matches && score > 0) {
            results.push({
                ...item,
                _score: score,
            });
        }
    }

    // Sort by score (descending)
    results.sort((a, b) => b._score - a._score);

    // Limit results
    return results.slice(0, maxResults);
}

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Delay in milliseconds (default: 150)
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(fn, wait = 150) {
    let timeoutId = null;

    const debouncedFn = function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, wait);
    };

    debouncedFn.cancel = function () {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debouncedFn;
}
