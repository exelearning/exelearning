/**
 * Tests for Yjs Test Utilities
 */
import { describe, it, expect } from 'bun:test';
import * as Y from 'yjs';
import {
    extractMetadataFromYjs,
    extractAllPagesFromYjs,
    extractNavigationFromYjs,
    extractAllBlocksFromYjs,
    countTotalPages,
    countTotalBlocks,
    countRootPages,
    compareYjsDocuments,
    verifyMetadataEquality,
    verifyPageHierarchy,
    verifyParsedStructureMatchesYjs,
    createTestYjsDocument,
    encodeYjsDocument,
    decodeYjsDocument,
    compareYjsStates,
    cloneYjsDocument,
    printYjsStructure,
} from './yjs-test-utils';
import type { OdeXmlMeta, NormalizedPage, ParsedOdeStructure } from '../../src/services/xml/interfaces';

describe('yjs-test-utils', () => {
    describe('createTestYjsDocument', () => {
        it('should create document with default options', () => {
            const doc = createTestYjsDocument();
            expect(doc).toBeInstanceOf(Y.Doc);

            const metadata = doc.getMap('metadata');
            expect(metadata.get('title')).toBe('Test Document');
            expect(metadata.get('author')).toBe('Test Author');
            expect(metadata.get('language')).toBe('en');
        });

        it('should create document with custom title and author', () => {
            const doc = createTestYjsDocument({
                title: 'Custom Title',
                author: 'Custom Author',
                language: 'es',
            });

            const metadata = doc.getMap('metadata');
            expect(metadata.get('title')).toBe('Custom Title');
            expect(metadata.get('author')).toBe('Custom Author');
            expect(metadata.get('language')).toBe('es');
        });

        it('should create document with multiple pages', () => {
            const doc = createTestYjsDocument({ pageCount: 3 });
            const navigation = doc.getArray('navigation');
            expect(navigation.length).toBe(3);
        });

        it('should create pages with multiple blocks', () => {
            const doc = createTestYjsDocument({ pageCount: 1, blocksPerPage: 3 });
            const navigation = doc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<any>;
            const blocks = page.get('blocks') as Y.Array<any>;
            expect(blocks.length).toBe(3);
        });

        it('should create nested page hierarchy', () => {
            const doc = createTestYjsDocument({ pageCount: 1, nestedLevels: 2 });
            const navigation = doc.getArray('navigation');
            const rootPage = navigation.get(0) as Y.Map<any>;
            const children = rootPage.get('children') as Y.Array<any>;
            expect(children.length).toBe(1);

            const childPage = children.get(0) as Y.Map<any>;
            const grandchildren = childPage.get('children') as Y.Array<any>;
            expect(grandchildren.length).toBe(1);
        });
    });

    describe('extractMetadataFromYjs', () => {
        it('should extract metadata from document', () => {
            const doc = createTestYjsDocument({ title: 'Test', author: 'Author' });
            const meta = extractMetadataFromYjs(doc);

            expect(meta).not.toBeNull();
            expect(meta!.title).toBe('Test');
            expect(meta!.author).toBe('Author');
        });

        it('should return null for empty metadata', () => {
            const doc = new Y.Doc();
            const meta = extractMetadataFromYjs(doc);
            expect(meta).toBeNull();
        });
    });

    describe('extractNavigationFromYjs', () => {
        it('should extract root pages only', () => {
            const doc = createTestYjsDocument({ pageCount: 2, nestedLevels: 1 });
            const pages = extractNavigationFromYjs(doc);

            expect(pages.length).toBe(2);
            expect(pages[0].children.length).toBe(1);
        });
    });

    describe('extractAllPagesFromYjs', () => {
        it('should extract all pages flattened', () => {
            const doc = createTestYjsDocument({ pageCount: 2, nestedLevels: 1 });
            const pages = extractAllPagesFromYjs(doc);

            // 2 root pages + 2 child pages
            expect(pages.length).toBe(4);
        });
    });

    describe('extractAllBlocksFromYjs', () => {
        it('should extract all blocks from all pages', () => {
            const doc = createTestYjsDocument({ pageCount: 2, blocksPerPage: 3 });
            const blocks = extractAllBlocksFromYjs(doc);

            expect(blocks.length).toBe(6);
        });
    });

    describe('countTotalPages', () => {
        it('should count all pages including nested', () => {
            const doc = createTestYjsDocument({ pageCount: 2, nestedLevels: 2 });
            const count = countTotalPages(doc);

            // 2 root + 2 level1 + 2 level2 = 6
            expect(count).toBe(6);
        });
    });

    describe('countTotalBlocks', () => {
        it('should count all blocks', () => {
            const doc = createTestYjsDocument({ pageCount: 3, blocksPerPage: 2 });
            const count = countTotalBlocks(doc);

            expect(count).toBe(6);
        });
    });

    describe('countRootPages', () => {
        it('should count only root pages', () => {
            const doc = createTestYjsDocument({ pageCount: 3, nestedLevels: 2 });
            const count = countRootPages(doc);

            expect(count).toBe(3);
        });
    });

    describe('compareYjsDocuments', () => {
        it('should return true for identical documents', () => {
            const doc1 = createTestYjsDocument({ title: 'Same', author: 'Author' });
            const doc2 = createTestYjsDocument({ title: 'Same', author: 'Author' });

            expect(compareYjsDocuments(doc1, doc2)).toBe(true);
        });

        it('should return false for different titles', () => {
            const doc1 = createTestYjsDocument({ title: 'Title1' });
            const doc2 = createTestYjsDocument({ title: 'Title2' });

            expect(compareYjsDocuments(doc1, doc2)).toBe(false);
        });

        it('should return false for different page counts', () => {
            const doc1 = createTestYjsDocument({ pageCount: 2 });
            const doc2 = createTestYjsDocument({ pageCount: 3 });

            expect(compareYjsDocuments(doc1, doc2)).toBe(false);
        });
    });

    describe('verifyMetadataEquality', () => {
        it('should return true when metadata matches', () => {
            const doc = createTestYjsDocument({ title: 'Test', author: 'Author', language: 'en' });
            const meta: OdeXmlMeta = {
                title: 'Test',
                author: 'Author',
                language: 'en',
                locale: 'en',
                version: '1.0',
                description: '',
                keywords: '',
                license: '',
                theme: 'base',
                odeIdentifier: '',
                exportMediaFiles: 0,
            };

            expect(verifyMetadataEquality(meta, doc)).toBe(true);
        });

        it('should return false when metadata does not match', () => {
            const doc = createTestYjsDocument({ title: 'Different' });
            const meta: OdeXmlMeta = {
                title: 'Test',
                author: '',
                language: 'en',
                locale: 'en',
                version: '1.0',
                description: '',
                keywords: '',
                license: '',
                theme: 'base',
                odeIdentifier: '',
                exportMediaFiles: 0,
            };

            expect(verifyMetadataEquality(meta, doc)).toBe(false);
        });

        it('should return false for empty document', () => {
            const doc = new Y.Doc();
            const meta: OdeXmlMeta = {
                title: 'Test',
                author: '',
                language: 'en',
                locale: 'en',
                version: '1.0',
                description: '',
                keywords: '',
                license: '',
                theme: 'base',
                odeIdentifier: '',
                exportMediaFiles: 0,
            };

            expect(verifyMetadataEquality(meta, doc)).toBe(false);
        });
    });

    describe('verifyPageHierarchy', () => {
        it('should return true when page hierarchy matches', () => {
            const doc = createTestYjsDocument({ pageCount: 1, blocksPerPage: 1 });
            const pages: NormalizedPage[] = [
                {
                    id: 'page-0',
                    title: 'Page 1',
                    parent_id: null,
                    level: 0,
                    position: 0,
                    components: [
                        {
                            id: 'page-0-block-0',
                            type: 'FreeTextIdevice',
                            content: '<p>Test content</p>',
                        },
                    ],
                },
            ];

            expect(verifyPageHierarchy(pages, doc)).toBe(true);
        });

        it('should return false when page count differs', () => {
            const doc = createTestYjsDocument({ pageCount: 2 });
            const pages: NormalizedPage[] = [
                {
                    id: 'page-0',
                    title: 'Page 1',
                    parent_id: null,
                    level: 0,
                    position: 0,
                    components: [],
                },
            ];

            expect(verifyPageHierarchy(pages, doc)).toBe(false);
        });

        it('should return false when page id differs', () => {
            const doc = createTestYjsDocument({ pageCount: 1 });
            const pages: NormalizedPage[] = [
                {
                    id: 'different-id',
                    title: 'Page 1',
                    parent_id: null,
                    level: 0,
                    position: 0,
                    components: [
                        {
                            id: 'block-0',
                            type: 'FreeTextIdevice',
                            content: '',
                        },
                    ],
                },
            ];

            expect(verifyPageHierarchy(pages, doc)).toBe(false);
        });

        it('should verify nested children', () => {
            const doc = createTestYjsDocument({ pageCount: 1, nestedLevels: 1, blocksPerPage: 1 });
            const pages: NormalizedPage[] = [
                {
                    id: 'page-0',
                    title: 'Page 1',
                    parent_id: null,
                    level: 0,
                    position: 0,
                    components: [
                        {
                            id: 'page-0-block-0',
                            type: 'FreeTextIdevice',
                            content: '',
                        },
                    ],
                    children: [
                        {
                            id: 'page-0-child',
                            title: 'Page 1 Child',
                            parent_id: 'page-0',
                            level: 1,
                            position: 0,
                            components: [
                                {
                                    id: 'page-0-child-block-0',
                                    type: 'FreeTextIdevice',
                                    content: '',
                                },
                            ],
                        },
                    ],
                },
            ];

            expect(verifyPageHierarchy(pages, doc)).toBe(true);
        });

        it('should return false when children count differs', () => {
            const doc = createTestYjsDocument({ pageCount: 1, nestedLevels: 1, blocksPerPage: 1 });
            const pages: NormalizedPage[] = [
                {
                    id: 'page-0',
                    title: 'Page 1',
                    parent_id: null,
                    level: 0,
                    position: 0,
                    components: [
                        {
                            id: 'page-0-block-0',
                            type: 'FreeTextIdevice',
                            content: '',
                        },
                    ],
                    // Has 2 children but doc only has 1 child
                    children: [
                        {
                            id: 'page-0-child',
                            title: 'Page 1 Child',
                            parent_id: 'page-0',
                            level: 1,
                            position: 0,
                            components: [
                                {
                                    id: 'page-0-child-block-0',
                                    type: 'FreeTextIdevice',
                                    content: '',
                                },
                            ],
                        },
                        {
                            id: 'page-0-child-2',
                            title: 'Page 1 Child 2',
                            parent_id: 'page-0',
                            level: 1,
                            position: 1,
                            components: [
                                {
                                    id: 'page-0-child-2-block-0',
                                    type: 'FreeTextIdevice',
                                    content: '',
                                },
                            ],
                        },
                    ],
                },
            ];

            expect(verifyPageHierarchy(pages, doc)).toBe(false);
        });
    });

    describe('verifyParsedStructureMatchesYjs', () => {
        it('should return isEqual true when structures match', () => {
            const doc = createTestYjsDocument({ title: 'Test', pageCount: 1, blocksPerPage: 1 });
            const parsed: ParsedOdeStructure = {
                meta: {
                    title: 'Test',
                    author: '',
                    language: 'en',
                    locale: 'en',
                    version: '1.0',
                    description: '',
                    keywords: '',
                    license: '',
                    theme: 'base',
                    odeIdentifier: '',
                    exportMediaFiles: 0,
                },
                pages: [
                    {
                        id: 'page-0',
                        title: 'Page 1',
                        parent_id: null,
                        level: 0,
                        position: 0,
                        components: [
                            {
                                id: 'block-0',
                                type: 'FreeTextIdevice',
                                content: '',
                            },
                        ],
                    },
                ],
                raw: {} as any,
                srcRoutes: new Set(),
            };

            const result = verifyParsedStructureMatchesYjs(parsed, doc);
            expect(result.isEqual).toBe(true);
            expect(result.differences.length).toBe(0);
        });

        it('should detect title mismatch', () => {
            const doc = createTestYjsDocument({ title: 'Different' });
            const parsed: ParsedOdeStructure = {
                meta: {
                    title: 'Test',
                    author: '',
                    language: 'en',
                    locale: 'en',
                    version: '1.0',
                    description: '',
                    keywords: '',
                    license: '',
                    theme: 'base',
                    odeIdentifier: '',
                    exportMediaFiles: 0,
                },
                pages: [
                    {
                        id: 'page-0',
                        title: 'Page 1',
                        parent_id: null,
                        level: 0,
                        position: 0,
                        components: [
                            {
                                id: 'block-0',
                                type: 'FreeTextIdevice',
                                content: '',
                            },
                        ],
                    },
                ],
                raw: {} as any,
                srcRoutes: new Set(),
            };

            const result = verifyParsedStructureMatchesYjs(parsed, doc);
            expect(result.isEqual).toBe(false);
            expect(result.differences.some(d => d.includes('Title'))).toBe(true);
        });

        it('should detect page count mismatch', () => {
            const doc = createTestYjsDocument({ title: 'Test', pageCount: 3 });
            const parsed: ParsedOdeStructure = {
                meta: {
                    title: 'Test',
                    author: '',
                    language: 'en',
                    locale: 'en',
                    version: '1.0',
                    description: '',
                    keywords: '',
                    license: '',
                    theme: 'base',
                    odeIdentifier: '',
                    exportMediaFiles: 0,
                },
                pages: [
                    {
                        id: 'page-0',
                        title: 'Page 1',
                        parent_id: null,
                        level: 0,
                        position: 0,
                        components: [],
                    },
                ],
                raw: {} as any,
                srcRoutes: new Set(),
            };

            const result = verifyParsedStructureMatchesYjs(parsed, doc);
            expect(result.isEqual).toBe(false);
            expect(result.differences.some(d => d.includes('Page count'))).toBe(true);
        });

        it('should detect block count mismatch', () => {
            const doc = createTestYjsDocument({ title: 'Test', pageCount: 1, blocksPerPage: 3 });
            const parsed: ParsedOdeStructure = {
                meta: {
                    title: 'Test',
                    author: '',
                    language: 'en',
                    locale: 'en',
                    version: '1.0',
                    description: '',
                    keywords: '',
                    license: '',
                    theme: 'base',
                    odeIdentifier: '',
                    exportMediaFiles: 0,
                },
                pages: [
                    {
                        id: 'page-0',
                        title: 'Page 1',
                        parent_id: null,
                        level: 0,
                        position: 0,
                        components: [
                            {
                                id: 'block-0',
                                type: 'FreeTextIdevice',
                                content: '',
                            },
                        ],
                    },
                ],
                raw: {} as any,
                srcRoutes: new Set(),
            };

            const result = verifyParsedStructureMatchesYjs(parsed, doc);
            expect(result.isEqual).toBe(false);
            expect(result.differences.some(d => d.includes('Block count'))).toBe(true);
        });
    });

    describe('encodeYjsDocument and decodeYjsDocument', () => {
        it('should encode document to Uint8Array', () => {
            const doc = createTestYjsDocument({ title: 'Test' });
            const encoded = encodeYjsDocument(doc);

            expect(encoded).toBeInstanceOf(Uint8Array);
            expect(encoded.length).toBeGreaterThan(0);
        });

        it('should decode Uint8Array back to document', () => {
            const doc = createTestYjsDocument({ title: 'Test' });
            const encoded = encodeYjsDocument(doc);
            const decoded = decodeYjsDocument(encoded);

            const meta = extractMetadataFromYjs(decoded);
            expect(meta!.title).toBe('Test');
        });
    });

    describe('compareYjsStates', () => {
        it('should return true for identical states', () => {
            const doc = createTestYjsDocument({ title: 'Test', author: 'Author' });
            const state = encodeYjsDocument(doc);

            expect(compareYjsStates(state, state)).toBe(true);
        });

        it('should return false for different states', () => {
            const doc1 = createTestYjsDocument({ title: 'Test1' });
            const doc2 = createTestYjsDocument({ title: 'Test2' });
            const state1 = encodeYjsDocument(doc1);
            const state2 = encodeYjsDocument(doc2);

            expect(compareYjsStates(state1, state2)).toBe(false);
        });
    });

    describe('cloneYjsDocument', () => {
        it('should create an independent clone', () => {
            const original = createTestYjsDocument({ title: 'Original' });
            const clone = cloneYjsDocument(original);

            // Modify clone
            const cloneMeta = clone.getMap('metadata');
            cloneMeta.set('title', 'Modified');

            // Original should be unchanged
            const originalMeta = original.getMap('metadata');
            expect(originalMeta.get('title')).toBe('Original');
            expect(cloneMeta.get('title')).toBe('Modified');
        });
    });

    describe('printYjsStructure', () => {
        it('should return formatted structure string', () => {
            const doc = createTestYjsDocument({ title: 'Test Doc', pageCount: 2, blocksPerPage: 1 });
            const output = printYjsStructure(doc);

            expect(output).toContain('Yjs Document Structure');
            expect(output).toContain('Test Doc');
            expect(output).toContain('Pages (2)');
            expect(output).toContain('Page 1');
            expect(output).toContain('Page 2');
        });

        it('should show nested pages', () => {
            const doc = createTestYjsDocument({ pageCount: 1, nestedLevels: 1 });
            const output = printYjsStructure(doc);

            expect(output).toContain('Page 1');
            expect(output).toContain('Page 1 Child');
        });
    });
});
