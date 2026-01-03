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
});
