/**
 * Search module exports
 * Provides global search functionality for eXeLearning
 */

export { default as GlobalSearchModal } from './GlobalSearchModal.js';
export { stripHtmlForSearch, buildSearchIndex, search, debounce } from './SearchEngine.js';
