/**
 * Tests for ImsManifestGenerator
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ImsManifestGenerator } from './ImsManifest';
import type { ExportPage } from '../interfaces';

describe('ImsManifestGenerator', () => {
    let generator: ImsManifestGenerator;

    const createTestPages = (): ExportPage[] => [
        { id: 'page-1', title: 'Introduction', parentId: null, order: 0, blocks: [] },
        { id: 'page-2', title: 'Chapter 1', parentId: null, order: 1, blocks: [] },
        { id: 'page-3', title: 'Section 1.1', parentId: 'page-2', order: 0, blocks: [] },
    ];

    beforeEach(() => {
        generator = new ImsManifestGenerator('test-project-123', createTestPages(), {
            title: 'Test Course',
            description: 'A test course for IMS CP',
            author: 'Test Author',
            language: 'en',
        });
    });

    describe('generate', () => {
        it('should generate valid XML declaration', () => {
            const xml = generator.generate();

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        });

        it('should include IMS CP namespaces', () => {
            const xml = generator.generate();

            expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"');
            expect(xml).toContain('xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"');
        });

        it('should not include SCORM-specific namespaces', () => {
            const xml = generator.generate();

            expect(xml).not.toContain('adlcp');
            expect(xml).not.toContain('adlseq');
            expect(xml).not.toContain('adlnav');
        });

        it('should include manifest identifier with project ID', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="eXe-MANIFEST-test-project-123"');
        });

        it('should include metadata section with IMS Content schema', () => {
            const xml = generator.generate();

            expect(xml).toContain('<schema>IMS Content</schema>');
            expect(xml).toContain('<schemaversion>1.1.3</schemaversion>');
        });
    });

    describe('generateMetadata', () => {
        it('should include inline LOM metadata', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsmd:lom>');
            expect(xml).toContain('<imsmd:general>');
            expect(xml).toContain('</imsmd:lom>');
        });

        it('should include title in LOM format', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsmd:title>');
            expect(xml).toContain('<imsmd:langstring xml:lang="en">Test Course</imsmd:langstring>');
        });

        it('should include description when provided', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsmd:description>');
            expect(xml).toContain('A test course for IMS CP');
        });

        it('should include language', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsmd:language>en</imsmd:language>');
        });

        it('should include author in lifecycle when provided', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsmd:lifecycle>');
            expect(xml).toContain('<imsmd:contribute>');
            expect(xml).toContain('<imsmd:value>Author</imsmd:value>');
            expect(xml).toContain('FN:Test Author');
        });

        it('should not include lifecycle when no author', () => {
            const noAuthorGen = new ImsManifestGenerator('test', createTestPages(), {
                title: 'No Author Course',
            });
            const xml = noAuthorGen.generate();

            expect(xml).not.toContain('<imsmd:lifecycle>');
        });
    });

    describe('generateResources', () => {
        it('should not include scormtype attribute', () => {
            const xml = generator.generate();

            expect(xml).not.toContain('scormtype');
            expect(xml).not.toContain('scormType');
        });

        it('should use type="webcontent" for resources', () => {
            const xml = generator.generate();

            expect(xml).toContain('type="webcontent"');
        });

        it('should use index.html for first page', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="RES-page-1" type="webcontent" href="index.html"');
        });

        it('should include COMMON_FILES resource without scormType', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="COMMON_FILES" type="webcontent"');
        });

        it('should include dependency on COMMON_FILES', () => {
            const xml = generator.generate();

            expect(xml).toContain('<dependency identifierref="COMMON_FILES"/>');
        });
    });

    describe('generateItems', () => {
        it('should generate items for all pages', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="ITEM-page-1"');
            expect(xml).toContain('identifier="ITEM-page-2"');
            expect(xml).toContain('identifier="ITEM-page-3"');
        });

        it('should include page titles', () => {
            const xml = generator.generate();

            expect(xml).toContain('<title>Introduction</title>');
            expect(xml).toContain('<title>Chapter 1</title>');
            expect(xml).toContain('<title>Section 1.1</title>');
        });

        it('should nest child items under parent', () => {
            const xml = generator.generate();

            const chapter1Index = xml.indexOf('identifier="ITEM-page-2"');
            const section11Index = xml.indexOf('identifier="ITEM-page-3"');

            expect(section11Index).toBeGreaterThan(chapter1Index);
        });

        it('should include isvisible attribute', () => {
            const xml = generator.generate();

            expect(xml).toContain('isvisible="true"');
        });
    });

    describe('escapeXml', () => {
        it('should escape XML special characters in metadata', () => {
            const generatorWithSpecialChars = new ImsManifestGenerator('test', [], {
                title: 'Test & Course <1>',
                description: 'Description with "quotes"',
            });
            const xml = generatorWithSpecialChars.generate();

            expect(xml).toContain('Test &amp; Course &lt;1&gt;');
            expect(xml).toContain('Description with &quot;quotes&quot;');
        });
    });

    describe('sanitizeFilename', () => {
        it('should convert to lowercase and handle special characters', () => {
            expect(generator.sanitizeFilename('Hello World!')).toBe('hello-world');
            expect(generator.sanitizeFilename('Café Résumé')).toBe('cafe-resume');
        });

        it('should return page for empty string', () => {
            expect(generator.sanitizeFilename('')).toBe('page');
        });
    });

    describe('empty project', () => {
        it('should handle empty pages array', () => {
            const emptyGenerator = new ImsManifestGenerator('empty', [], { title: 'Empty' });
            const xml = emptyGenerator.generate();

            expect(xml).toContain('<organizations');
            expect(xml).toContain('</organizations>');
            expect(xml).toContain('<resources>');
            expect(xml).toContain('</resources>');
        });
    });

    describe('allZipFiles - complete file listing', () => {
        it('should include all ZIP files in COMMON_FILES when allZipFiles is provided', () => {
            const xml = generator.generate({
                allZipFiles: [
                    'index.html',
                    'html/chapter-1.html',
                    'html/section-11.html',
                    'libs/jquery.js',
                    'content/css/base.css',
                    'theme/style.css',
                    'content/resources/image1.png',
                    'imsmanifest.xml',
                ],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                    'page-2': { fileUrl: 'html/chapter-1.html' },
                    'page-3': { fileUrl: 'html/section-11.html' },
                },
            });

            // Common files should be included
            expect(xml).toContain('<file href="libs/jquery.js"/>');
            expect(xml).toContain('<file href="content/css/base.css"/>');
            expect(xml).toContain('<file href="theme/style.css"/>');
            expect(xml).toContain('<file href="content/resources/image1.png"/>');

            // imsmanifest.xml should be excluded
            expect(xml).not.toContain('<file href="imsmanifest.xml"/>');
        });

        it('should include asset files added after initial file tracking', () => {
            const xml = generator.generate({
                commonFiles: ['libs/jquery.js'], // Old tracking (incomplete)
                allZipFiles: [
                    'index.html',
                    'libs/jquery.js',
                    'content/resources/asset-uuid-1/image.png',
                    'content/resources/asset-uuid-2/video.mp4',
                    'imsmanifest.xml',
                ],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                },
            });

            // Should include assets that weren't in the original commonFiles list
            expect(xml).toContain('<file href="content/resources/asset-uuid-1/image.png"/>');
            expect(xml).toContain('<file href="content/resources/asset-uuid-2/video.mp4"/>');
        });

        it('should fallback to commonFiles if allZipFiles is empty', () => {
            const xml = generator.generate({
                commonFiles: ['libs/jquery.js', 'theme/style.css'],
                allZipFiles: [],
            });

            expect(xml).toContain('<file href="libs/jquery.js"/>');
            expect(xml).toContain('<file href="theme/style.css"/>');
        });

        it('should use default page URLs when pageFiles not provided', () => {
            const xml = generator.generate({
                allZipFiles: [
                    'index.html',
                    'html/chapter-1.html',
                    'html/section-11.html',
                    'libs/common.js',
                    'imsmanifest.xml',
                ],
            });

            // libs/common.js should be in COMMON_FILES since page URLs are auto-generated
            expect(xml).toContain('<file href="libs/common.js"/>');
        });

        it('should sort common files alphabetically', () => {
            const xml = generator.generate({
                allZipFiles: [
                    'index.html',
                    'theme/z-file.css',
                    'content/a-file.css',
                    'libs/m-file.js',
                    'imsmanifest.xml',
                ],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                },
            });

            const contentIndex = xml.indexOf('content/a-file.css');
            const libsIndex = xml.indexOf('libs/m-file.js');
            const themeIndex = xml.indexOf('theme/z-file.css');

            expect(contentIndex).toBeLessThan(libsIndex);
            expect(libsIndex).toBeLessThan(themeIndex);
        });
    });
});
