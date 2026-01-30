import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    stripHtmlForSearch,
    buildSearchIndex,
    search,
    debounce,
} from './SearchEngine.js';

describe('SearchEngine', () => {
    describe('stripHtmlForSearch', () => {
        it('should remove HTML tags from content', () => {
            const html = '<p>Hello <strong>world</strong>!</p>';
            const result = stripHtmlForSearch(html);
            expect(result).toBe('Hello world!');
        });

        it('should decode HTML entities', () => {
            const html = '&lt;script&gt; &amp; &quot;test&quot; &apos;value&apos;';
            const result = stripHtmlForSearch(html);
            expect(result).toContain('&');
            expect(result).toContain('"test"');
        });

        it('should handle nested tags', () => {
            const html = '<div><p><span>Nested <em>content</em></span></p></div>';
            const result = stripHtmlForSearch(html);
            expect(result).toBe('Nested content');
        });

        it('should handle empty input', () => {
            expect(stripHtmlForSearch('')).toBe('');
            expect(stripHtmlForSearch(null)).toBe('');
            expect(stripHtmlForSearch(undefined)).toBe('');
        });

        it('should truncate content to maxLength', () => {
            const html = '<p>This is a very long text that should be truncated</p>';
            const result = stripHtmlForSearch(html, 20);
            expect(result.length).toBeLessThanOrEqual(20);
        });

        it('should normalize whitespace', () => {
            const html = '<p>Multiple   spaces\n\nand\ttabs</p>';
            const result = stripHtmlForSearch(html);
            expect(result).toBe('Multiple spaces and tabs');
        });

        it('should handle plain text without HTML', () => {
            const text = 'Just plain text';
            const result = stripHtmlForSearch(text);
            expect(result).toBe('Just plain text');
        });

        it('should remove script and style contents', () => {
            const html = '<p>Text</p><script>alert("xss")</script><style>.foo{}</style><p>More</p>';
            const result = stripHtmlForSearch(html);
            expect(result).not.toContain('alert');
            expect(result).not.toContain('foo');
            expect(result).toContain('Text');
            expect(result).toContain('More');
        });
    });

    describe('buildSearchIndex', () => {
        let mockYjsBinding;

        beforeEach(() => {
            mockYjsBinding = {
                getPages: vi.fn().mockReturnValue([
                    {
                        id: 'page-1',
                        pageId: 'page-1',
                        pageName: 'Introduction',
                        parentId: null,
                    },
                    {
                        id: 'page-2',
                        pageId: 'page-2',
                        pageName: 'Chapter 1',
                        parentId: null,
                    },
                ]),
                getBlocks: vi.fn().mockImplementation((pageId) => {
                    if (pageId === 'page-1') {
                        return [
                            { id: 'block-1', blockId: 'block-1', pageId: 'page-1' },
                        ];
                    }
                    return [];
                }),
                getComponents: vi.fn().mockImplementation((pageId, blockId) => {
                    if (pageId === 'page-1' && blockId === 'block-1') {
                        return [
                            {
                                id: 'comp-1',
                                ideviceId: 'comp-1',
                                ideviceType: 'freetext',
                                htmlContent: '<p>This is the content of the iDevice</p>',
                                jsonProperties: JSON.stringify({
                                    title: 'Free Text',
                                    description: 'A sample free text iDevice',
                                }),
                                blockId: 'block-1',
                            },
                        ];
                    }
                    return [];
                }),
            };
        });

        it('should build index from Yjs structure', () => {
            const index = buildSearchIndex(mockYjsBinding);
            expect(Array.isArray(index)).toBe(true);
            expect(index.length).toBeGreaterThan(0);
        });

        it('should include pages in the index', () => {
            const index = buildSearchIndex(mockYjsBinding);
            const pageEntries = index.filter((item) => item.type === 'page');
            expect(pageEntries.length).toBe(2);
            expect(pageEntries[0].pageName).toBe('Introduction');
        });

        it('should include components in the index', () => {
            const index = buildSearchIndex(mockYjsBinding);
            const componentEntries = index.filter((item) => item.type === 'component');
            expect(componentEntries.length).toBe(1);
            expect(componentEntries[0].ideviceType).toBe('freetext');
        });

        it('should pre-compute lowercase fields for search', () => {
            const index = buildSearchIndex(mockYjsBinding);
            const pageEntry = index.find((item) => item.id === 'page-1');
            expect(pageEntry._titleLower).toBe('introduction');
        });

        it('should strip HTML from component content', () => {
            const index = buildSearchIndex(mockYjsBinding);
            const compEntry = index.find((item) => item.id === 'comp-1');
            expect(compEntry.content).not.toContain('<p>');
            expect(compEntry.content).toContain('content of the iDevice');
        });

        it('should handle empty Yjs structure', () => {
            mockYjsBinding.getPages.mockReturnValue([]);
            const index = buildSearchIndex(mockYjsBinding);
            expect(index).toEqual([]);
        });

        it('should include page reference in component entries', () => {
            const index = buildSearchIndex(mockYjsBinding);
            const compEntry = index.find((item) => item.id === 'comp-1');
            expect(compEntry.pageId).toBe('page-1');
            expect(compEntry.pageName).toBe('Introduction');
        });
    });

    describe('search', () => {
        let testIndex;

        beforeEach(() => {
            testIndex = [
                {
                    id: 'page-1',
                    type: 'page',
                    pageId: 'page-1',
                    pageName: 'Introduction to Biology',
                    title: 'Introduction to Biology',
                    content: '',
                    ideviceType: null,
                    blockId: null,
                    _titleLower: 'introduction to biology',
                    _contentLower: '',
                },
                {
                    id: 'page-2',
                    type: 'page',
                    pageId: 'page-2',
                    pageName: 'Chapter 1: Cells',
                    title: 'Chapter 1: Cells',
                    content: '',
                    ideviceType: null,
                    blockId: null,
                    _titleLower: 'chapter 1: cells',
                    _contentLower: '',
                },
                {
                    id: 'comp-1',
                    type: 'component',
                    pageId: 'page-1',
                    pageName: 'Introduction to Biology',
                    title: 'Free Text',
                    content: 'The process of photosynthesis converts light energy',
                    ideviceType: 'freetext',
                    blockId: 'block-1',
                    _titleLower: 'free text',
                    _contentLower: 'the process of photosynthesis converts light energy',
                },
                {
                    id: 'comp-2',
                    type: 'component',
                    pageId: 'page-2',
                    pageName: 'Chapter 1: Cells',
                    title: 'Multiple Choice',
                    content: 'What is the basic unit of life? A cell is the basic unit.',
                    ideviceType: 'multichoice',
                    blockId: 'block-2',
                    _titleLower: 'multiple choice',
                    _contentLower: 'what is the basic unit of life? a cell is the basic unit.',
                },
            ];
        });

        it('should return empty array for empty query', () => {
            expect(search(testIndex, '')).toEqual([]);
            expect(search(testIndex, '   ')).toEqual([]);
        });

        it('should find pages by title', () => {
            const results = search(testIndex, 'Introduction');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('page-1');
        });

        it('should find components by content', () => {
            const results = search(testIndex, 'photosynthesis');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('comp-1');
        });

        it('should be case-insensitive', () => {
            const resultsLower = search(testIndex, 'biology');
            const resultsUpper = search(testIndex, 'BIOLOGY');
            expect(resultsLower.length).toBe(resultsUpper.length);
            expect(resultsLower[0].id).toBe(resultsUpper[0].id);
        });

        it('should rank exact title matches higher', () => {
            const results = search(testIndex, 'Introduction to Biology');
            expect(results[0].id).toBe('page-1');
            expect(results[0]._score).toBeGreaterThan(100);
        });

        it('should rank title starts-with matches higher than contains', () => {
            const results = search(testIndex, 'Chapter');
            const chaptersFirst = results.filter((r) => r.title.startsWith('Chapter'));
            expect(chaptersFirst.length).toBeGreaterThan(0);
        });

        it('should rank page results higher than component results', () => {
            const results = search(testIndex, 'cell');
            const pageResult = results.find((r) => r.type === 'page');
            const compResult = results.find((r) => r.type === 'component');
            if (pageResult && compResult) {
                expect(pageResult._score).toBeGreaterThan(compResult._score);
            }
        });

        it('should limit results to maxResults', () => {
            const results = search(testIndex, 'the', { maxResults: 2 });
            expect(results.length).toBeLessThanOrEqual(2);
        });

        it('should handle special characters in query', () => {
            const results = search(testIndex, 'Chapter 1:');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should match partial words', () => {
            const results = search(testIndex, 'Bio');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some((r) => r.pageName.includes('Biology'))).toBe(true);
        });

        it('should search multiple words (AND logic)', () => {
            const results = search(testIndex, 'basic unit');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].content).toContain('basic unit');
        });
    });

    describe('debounce', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should delay function execution', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should reset timer on subsequent calls', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn();
            vi.advanceTimersByTime(50);
            debouncedFn();
            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to the function', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn('arg1', 'arg2');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should use default wait time of 150ms', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn);

            debouncedFn();
            vi.advanceTimersByTime(149);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should return a cancel method', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn();
            debouncedFn.cancel();
            vi.advanceTimersByTime(100);

            expect(fn).not.toHaveBeenCalled();
        });
    });
});
