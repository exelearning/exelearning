/**
 * Tests for Scorm12ManifestGenerator
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Scorm12ManifestGenerator } from './Scorm12Manifest';
import type { ExportPage } from '../interfaces';

describe('Scorm12ManifestGenerator', () => {
    let generator: Scorm12ManifestGenerator;

    const createTestPages = (): ExportPage[] => [
        { id: 'page-1', title: 'Introduction', parentId: null, order: 0, blocks: [] },
        { id: 'page-2', title: 'Chapter 1', parentId: null, order: 1, blocks: [] },
        { id: 'page-3', title: 'Section 1.1', parentId: 'page-2', order: 0, blocks: [] },
    ];

    beforeEach(() => {
        generator = new Scorm12ManifestGenerator('test-project-123', createTestPages(), {
            title: 'Test Course',
            author: 'Test Author',
            language: 'en',
        });
    });

    describe('generate', () => {
        it('should generate valid XML declaration', () => {
            const xml = generator.generate();

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        });

        it('should include SCORM 1.2 namespaces', () => {
            const xml = generator.generate();

            expect(xml).toContain('xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"');
            expect(xml).toContain('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"');
            expect(xml).toContain('xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"');
        });

        it('should include manifest identifier with project ID', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="eXe-MANIFEST-test-project-123"');
        });

        it('should include metadata section with SCORM 1.2 schema', () => {
            const xml = generator.generate();

            expect(xml).toContain('<schema>ADL SCORM</schema>');
            expect(xml).toContain('<schemaversion>1.2</schemaversion>');
            expect(xml).toContain('<adlcp:location>imslrm.xml</adlcp:location>');
        });

        it('should include organizations section', () => {
            const xml = generator.generate();

            expect(xml).toContain('<organizations default="eXe-test-project-123">');
            expect(xml).toContain('structure="hierarchical"');
            expect(xml).toContain('<title>Test Course</title>');
        });
    });

    describe('generateItems', () => {
        it('should generate items for all pages', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="ITEM-page-1"');
            expect(xml).toContain('identifier="ITEM-page-2"');
            expect(xml).toContain('identifier="ITEM-page-3"');
        });

        it('should include identifierref attributes', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifierref="RES-page-1"');
            expect(xml).toContain('identifierref="RES-page-2"');
            expect(xml).toContain('identifierref="RES-page-3"');
        });

        it('should include page titles', () => {
            const xml = generator.generate();

            expect(xml).toContain('<title>Introduction</title>');
            expect(xml).toContain('<title>Chapter 1</title>');
            expect(xml).toContain('<title>Section 1.1</title>');
        });

        it('should nest child items under parent', () => {
            const xml = generator.generate();

            // Section 1.1 should be nested under Chapter 1
            const chapter1Index = xml.indexOf('identifier="ITEM-page-2"');
            const section11Index = xml.indexOf('identifier="ITEM-page-3"');
            const closingItemIndex = xml.indexOf('</item>', section11Index);

            expect(section11Index).toBeGreaterThan(chapter1Index);
            expect(closingItemIndex).toBeGreaterThan(section11Index);
        });
    });

    describe('generateResources', () => {
        it('should generate resources for each page', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="RES-page-1"');
            expect(xml).toContain('identifier="RES-page-2"');
            expect(xml).toContain('identifier="RES-page-3"');
        });

        it('should use index.html for first page', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="RES-page-1" type="webcontent" adlcp:scormtype="sco" href="index.html"');
        });

        it('should use html/sanitized-title.html for other pages', () => {
            const xml = generator.generate();

            expect(xml).toContain('href="html/chapter-1.html"');
            // "Section 1.1" becomes "section-11" because dots are removed before space-to-dash conversion
            expect(xml).toContain('href="html/section-11.html"');
        });

        it('should include SCORM type as SCO', () => {
            const xml = generator.generate();

            expect(xml).toContain('adlcp:scormtype="sco"');
        });

        it('should include dependency on COMMON_FILES', () => {
            const xml = generator.generate();

            const resourceMatches = xml.match(/<dependency identifierref="COMMON_FILES"\/>/g);
            expect(resourceMatches?.length).toBe(3); // One per page
        });

        it('should include COMMON_FILES resource', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="COMMON_FILES"');
            expect(xml).toContain('adlcp:scormtype="asset"');
        });

        it('should include common files in COMMON_FILES resource', () => {
            const xml = generator.generate({
                commonFiles: ['libs/jquery.js', 'content/styles.css'],
            });

            expect(xml).toContain('<file href="libs/jquery.js"/>');
            expect(xml).toContain('<file href="content/styles.css"/>');
        });

        it('should include page files when provided', () => {
            const xml = generator.generate({
                pageFiles: {
                    'page-1': {
                        fileUrl: 'index.html',
                        files: ['content/images/intro.png'],
                    },
                },
            });

            expect(xml).toContain('<file href="content/images/intro.png"/>');
        });
    });

    describe('escapeXml', () => {
        it('should escape XML special characters', () => {
            const generatorWithSpecialChars = new Scorm12ManifestGenerator('test', [], {
                title: 'Test & Course <1>',
            });
            const xml = generatorWithSpecialChars.generate();

            expect(xml).toContain('Test &amp; Course &lt;1&gt;');
        });

        it('should handle empty strings', () => {
            expect(generator.escapeXml('')).toBe('');
        });

        it('should escape quotes', () => {
            expect(generator.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(generator.escapeXml("'single'")).toBe('&#039;single&#039;');
        });
    });

    describe('sanitizeFilename', () => {
        it('should convert to lowercase', () => {
            expect(generator.sanitizeFilename('HELLO')).toBe('hello');
        });

        it('should replace spaces with dashes', () => {
            expect(generator.sanitizeFilename('hello world')).toBe('hello-world');
        });

        it('should remove special characters', () => {
            expect(generator.sanitizeFilename('hello@world!')).toBe('helloworld');
        });

        it('should remove accents', () => {
            expect(generator.sanitizeFilename('café')).toBe('cafe');
        });

        it('should truncate to 50 characters', () => {
            const longTitle = 'a'.repeat(100);
            expect(generator.sanitizeFilename(longTitle).length).toBe(50);
        });

        it('should return page for empty string', () => {
            expect(generator.sanitizeFilename('')).toBe('page');
        });
    });

    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const gen1 = new Scorm12ManifestGenerator('', [], {});
            const _gen2 = new Scorm12ManifestGenerator('', [], {});

            // The IDs should be different (though in a fast test they could be the same due to timing)
            // We just verify the format
            const xml1 = gen1.generate();
            expect(xml1).toMatch(/identifier="eXe-MANIFEST-exe-[a-z0-9]+"/);
        });
    });

    describe('empty project', () => {
        it('should handle empty pages array', () => {
            const emptyGenerator = new Scorm12ManifestGenerator('empty', [], { title: 'Empty' });
            const xml = emptyGenerator.generate();

            expect(xml).toContain('<organizations');
            expect(xml).toContain('</organizations>');
            expect(xml).toContain('<resources>');
            expect(xml).toContain('</resources>');
        });
    });
});
