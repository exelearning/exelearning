/**
 * Tests for Scorm2004ManifestGenerator
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Scorm2004ManifestGenerator } from './Scorm2004Manifest';
import type { ExportPage } from '../interfaces';

describe('Scorm2004ManifestGenerator', () => {
    let generator: Scorm2004ManifestGenerator;

    const createTestPages = (): ExportPage[] => [
        { id: 'page-1', title: 'Introduction', parentId: null, order: 0, blocks: [] },
        { id: 'page-2', title: 'Chapter 1', parentId: null, order: 1, blocks: [] },
        { id: 'page-3', title: 'Section 1.1', parentId: 'page-2', order: 0, blocks: [] },
    ];

    beforeEach(() => {
        generator = new Scorm2004ManifestGenerator('test-project-123', createTestPages(), {
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

        it('should include SCORM 2004 namespaces', () => {
            const xml = generator.generate();

            expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"');
            expect(xml).toContain('xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"');
            expect(xml).toContain('xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"');
            expect(xml).toContain('xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"');
            expect(xml).toContain('xmlns:imsss="http://www.imsglobal.org/xsd/imsss"');
        });

        it('should include manifest identifier with project ID', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="eXe-MANIFEST-test-project-123"');
        });

        it('should include metadata section with SCORM 2004 schema', () => {
            const xml = generator.generate();

            expect(xml).toContain('<schema>ADL SCORM</schema>');
            expect(xml).toContain('<schemaversion>2004 4th Edition</schemaversion>');
            expect(xml).toContain('<adlcp:location>imslrm.xml</adlcp:location>');
        });
    });

    describe('sequencing', () => {
        it('should include organization-level sequencing', () => {
            const xml = generator.generate();

            expect(xml).toContain('<imsss:sequencing>');
            expect(xml).toContain('choice="true"');
            expect(xml).toContain('choiceExit="true"');
            expect(xml).toContain('flow="true"');
            expect(xml).toContain('forwardOnly="false"');
        });

        it('should include sequencing for items with children', () => {
            const xml = generator.generate();

            // Chapter 1 has a child (Section 1.1), so it should have sequencing
            // Count the number of imsss:sequencing elements (should be 2: organization + Chapter 1)
            const sequencingMatches = xml.match(/<imsss:sequencing>/g);
            expect(sequencingMatches?.length).toBe(2);
        });
    });

    describe('generateResources', () => {
        it('should use adlcp:scormType (capital T) for SCORM 2004', () => {
            const xml = generator.generate();

            expect(xml).toContain('adlcp:scormType="sco"');
            expect(xml).toContain('adlcp:scormType="asset"');
            expect(xml).not.toContain('adlcp:scormtype'); // lowercase should not exist
        });

        it('should use index.html for first page', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="RES-page-1" type="webcontent" adlcp:scormType="sco" href="index.html"');
        });

        it('should include COMMON_FILES resource', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="COMMON_FILES"');
        });
    });

    describe('generateItems', () => {
        it('should generate items for all pages', () => {
            const xml = generator.generate();

            expect(xml).toContain('identifier="ITEM-page-1"');
            expect(xml).toContain('identifier="ITEM-page-2"');
            expect(xml).toContain('identifier="ITEM-page-3"');
        });

        it('should nest child items under parent', () => {
            const xml = generator.generate();

            // Section 1.1 should be nested under Chapter 1
            const chapter1Index = xml.indexOf('identifier="ITEM-page-2"');
            const section11Index = xml.indexOf('identifier="ITEM-page-3"');

            expect(section11Index).toBeGreaterThan(chapter1Index);
        });
    });

    describe('escapeXml', () => {
        it('should escape XML special characters', () => {
            const generatorWithSpecialChars = new Scorm2004ManifestGenerator('test', [], {
                title: 'Test & Course <1>',
            });
            const xml = generatorWithSpecialChars.generate();

            expect(xml).toContain('Test &amp; Course &lt;1&gt;');
        });
    });

    describe('sanitizeFilename', () => {
        it('should convert to lowercase and remove special characters', () => {
            expect(generator.sanitizeFilename('Hello World!')).toBe('hello-world');
        });

        it('should remove accents', () => {
            expect(generator.sanitizeFilename('Résumé')).toBe('resume');
        });
    });

    describe('empty project', () => {
        it('should handle empty pages array', () => {
            const emptyGenerator = new Scorm2004ManifestGenerator('empty', [], { title: 'Empty' });
            const xml = emptyGenerator.generate();

            expect(xml).toContain('<organizations');
            expect(xml).toContain('</organizations>');
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
                    'imslrm.xml',
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

            // imsmanifest.xml should be excluded (it's the manifest itself)
            expect(xml).not.toContain('<file href="imsmanifest.xml"/>');

            // imslrm.xml SHOULD be included (it's referenced by adlcp:location in metadata)
            expect(xml).toContain('<file href="imslrm.xml"/>');
        });

        it('should include asset files added after initial file tracking', () => {
            const xml = generator.generate({
                commonFiles: ['libs/jquery.js'],
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

    describe('imslrm.xml handling', () => {
        it('should include imslrm.xml in COMMON_FILES when present', () => {
            const xml = generator.generate({
                allZipFiles: ['index.html', 'libs/jquery.js', 'imslrm.xml', 'imsmanifest.xml'],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                },
            });

            // imslrm.xml should be included (referenced by adlcp:location in metadata)
            expect(xml).toContain('<file href="imslrm.xml"/>');
            // imsmanifest.xml should NOT be included (it's the manifest itself)
            expect(xml).not.toContain('<file href="imsmanifest.xml"/>');
        });

        it('should reference imslrm.xml in metadata section', () => {
            const xml = generator.generate();

            // Metadata should reference imslrm.xml via adlcp:location
            expect(xml).toContain('<adlcp:location>imslrm.xml</adlcp:location>');
        });

        it('should include imslrm.xml alongside other common files', () => {
            const xml = generator.generate({
                allZipFiles: ['index.html', 'libs/jquery.js', 'theme/style.css', 'imslrm.xml', 'imsmanifest.xml'],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                },
            });

            // All common files should be in COMMON_FILES resource
            const commonFilesStart = xml.indexOf('identifier="COMMON_FILES"');
            const commonFilesEnd = xml.indexOf('</resource>', commonFilesStart);
            const commonFilesSection = xml.substring(commonFilesStart, commonFilesEnd);

            expect(commonFilesSection).toContain('href="imslrm.xml"');
            expect(commonFilesSection).toContain('href="libs/jquery.js"');
            expect(commonFilesSection).toContain('href="theme/style.css"');
        });

        it('should not duplicate imslrm.xml in page resources', () => {
            const xml = generator.generate({
                allZipFiles: ['index.html', 'imslrm.xml', 'imsmanifest.xml'],
                pageFiles: {
                    'page-1': { fileUrl: 'index.html' },
                },
            });

            // imslrm.xml should only appear once (in COMMON_FILES)
            const matches = xml.match(/<file href="imslrm\.xml"\/>/g);
            expect(matches?.length).toBe(1);
        });
    });
});
