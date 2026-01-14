/**
 * OdeXmlGenerator tests
 */

import { describe, it, expect } from 'bun:test';
import { generateOdeXml, generateOdeId, escapeXml, escapeCdata } from './OdeXmlGenerator';
import type { ExportMetadata, ExportPage } from '../interfaces';

describe('OdeXmlGenerator', () => {
    describe('generateOdeXml', () => {
        it('should generate valid ODE XML with DOCTYPE declaration', () => {
            const meta: ExportMetadata = {
                title: 'Test Project',
                author: 'Test Author',
                language: 'en',
                theme: 'base',
            };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">');
            expect(xml).toContain('</ode>');
        });

        it('should include userPreferences section with theme', () => {
            const meta: ExportMetadata = {
                title: 'Test',
                theme: 'blue',
            };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<userPreferences>');
            expect(xml).toContain('<key>theme</key>');
            expect(xml).toContain('<value>blue</value>');
            expect(xml).toContain('</userPreferences>');
        });

        it('should include odeResources section with IDs and version', () => {
            const meta: ExportMetadata = {
                title: 'Test',
            };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeResources>');
            expect(xml).toContain('<key>odeId</key>');
            expect(xml).toContain('<key>odeVersionId</key>');
            expect(xml).toContain('<key>exe_version</key>');
            expect(xml).toContain('</odeResources>');
        });

        it('should include odeProperties section with metadata', () => {
            const meta: ExportMetadata = {
                title: 'My Title',
                subtitle: 'My Subtitle',
                author: 'John Doe',
                language: 'es',
                description: 'A description',
                license: 'CC-BY-SA',
                keywords: 'test, project',
            };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeProperties>');
            expect(xml).toContain('<key>pp_title</key>');
            expect(xml).toContain('<value>My Title</value>');
            expect(xml).toContain('<key>pp_subtitle</key>');
            expect(xml).toContain('<value>My Subtitle</value>');
            expect(xml).toContain('<key>pp_author</key>');
            expect(xml).toContain('<value>John Doe</value>');
            expect(xml).toContain('<key>pp_lang</key>');
            expect(xml).toContain('<value>es</value>');
            expect(xml).toContain('</odeProperties>');
        });

        it('should include empty odeNavStructures for no pages', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeNavStructures>');
            expect(xml).toContain('</odeNavStructures>');
            // Should not contain any odeNavStructure elements
            expect(xml).not.toContain('<odeNavStructure>');
        });

        it('should generate odeNavStructure for each page', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'page-2',
                    title: 'Page 2',
                    parentId: null,
                    order: 1,
                    blocks: [],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeNavStructures>');
            expect(xml).toContain('<odeNavStructure>');
            expect(xml).toContain('<odePageId>page-1</odePageId>');
            expect(xml).toContain('<pageName>Page 1</pageName>');
            expect(xml).toContain('<odePageId>page-2</odePageId>');
            expect(xml).toContain('<pageName>Page 2</pageName>');
        });

        it('should include page-level properties in odeNavStructureProperties', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: {
                        visibility: true,
                        highlight: false,
                        customProp: 'custom-value',
                    },
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeNavStructureProperties>');
            expect(xml).toContain('<key>titlePage</key>');
            expect(xml).toContain('<key>visibility</key>');
            expect(xml).toContain('<value>true</value>');
            expect(xml).toContain('<key>highlight</key>');
            expect(xml).toContain('<value>false</value>');
            expect(xml).toContain('<key>customProp</key>');
            expect(xml).toContain('<value>custom-value</value>');
        });

        it('should include parentId for child pages', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'parent',
                    title: 'Parent',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'child',
                    title: 'Child',
                    parentId: 'parent',
                    order: 0,
                    blocks: [],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odePageId>child</odePageId>');
            expect(xml).toContain('<odeParentPageId>parent</odeParentPageId>');
        });

        it('should generate odePagStructure for blocks', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block 1',
                            order: 0,
                            components: [],
                        },
                    ],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odePagStructures>');
            expect(xml).toContain('<odePagStructure>');
            expect(xml).toContain('<odeBlockId>block-1</odeBlockId>');
            expect(xml).toContain('<blockName>Block 1</blockName>');
        });

        it('should generate odeComponent for components', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Hello World</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeComponents>');
            expect(xml).toContain('<odeComponent>');
            expect(xml).toContain('<odeIdeviceId>comp-1</odeIdeviceId>');
            expect(xml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
            expect(xml).toContain('<htmlView><![CDATA[<p>Hello World</p>]]></htmlView>');
        });

        it('should include jsonProperties for component properties', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>Test</p>',
                                    properties: {
                                        textFeedbackInput: 'Show Feedback',
                                        textFeedbackTextarea: '<p>Feedback</p>',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<jsonProperties><![CDATA[');
            expect(xml).toContain('textFeedbackInput');
            expect(xml).toContain('Show Feedback');
        });

        it('should use custom odeId and versionId when provided', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages, {
                odeId: 'CUSTOM-ODE-ID',
                versionId: 'CUSTOM-VERSION-ID',
            });

            expect(xml).toContain('<value>CUSTOM-ODE-ID</value>');
            expect(xml).toContain('<value>CUSTOM-VERSION-ID</value>');
        });

        it('should include DOCTYPE by default', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
        });

        it('should exclude DOCTYPE when includeDoctype is false', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages, { includeDoctype: false });

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).not.toContain('<!DOCTYPE');
            expect(xml).not.toContain('content.dtd');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">');
        });

        it('should include DOCTYPE when includeDoctype is true', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages, { includeDoctype: true });

            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
        });

        it('should escape XML special characters in content', () => {
            const meta: ExportMetadata = {
                title: 'Test & Demo <Project>',
                author: '"Author"',
            };
            const pages: ExportPage[] = [];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('Test &amp; Demo &lt;Project&gt;');
            expect(xml).toContain('&quot;Author&quot;');
        });

        it('should include block properties', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block 1',
                            order: 0,
                            components: [],
                            properties: {
                                visibility: 'true',
                                teacherOnly: 'false',
                                allowToggle: 'true',
                                minimized: 'false',
                                identifier: 'my-block',
                                cssClass: 'custom-class',
                            },
                        },
                    ],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odePagStructureProperties>');
            expect(xml).toContain('<key>visibility</key>');
            expect(xml).toContain('<value>true</value>');
            expect(xml).toContain('<key>teacherOnly</key>');
            expect(xml).toContain('<key>allowToggle</key>');
        });

        it('should include component structure properties', () => {
            const meta: ExportMetadata = { title: 'Test' };
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '',
                                    properties: {},
                                    structureProperties: {
                                        visibility: 'true',
                                        teacherOnly: 'false',
                                        identifier: 'my-comp',
                                        cssClass: 'custom',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const xml = generateOdeXml(meta, pages);

            expect(xml).toContain('<odeComponentsProperties>');
            expect(xml).toContain('<key>visibility</key>');
            expect(xml).toContain('<key>identifier</key>');
            expect(xml).toContain('<value>my-comp</value>');
        });
    });

    describe('generateOdeId', () => {
        it('should generate ID with timestamp and random suffix', () => {
            const id = generateOdeId();

            // Should be 14 digits (timestamp) + 6 random chars = 20 chars
            expect(id.length).toBe(20);
            // First 14 chars should be digits (timestamp)
            expect(/^\d{14}/.test(id)).toBe(true);
            // Last 6 chars should be alphanumeric
            expect(/[A-Z0-9]{6}$/.test(id)).toBe(true);
        });

        it('should generate unique IDs', () => {
            const id1 = generateOdeId();
            const id2 = generateOdeId();

            expect(id1).not.toBe(id2);
        });
    });

    describe('escapeXml', () => {
        it('should escape ampersand', () => {
            expect(escapeXml('a & b')).toBe('a &amp; b');
        });

        it('should escape less than', () => {
            expect(escapeXml('a < b')).toBe('a &lt; b');
        });

        it('should escape greater than', () => {
            expect(escapeXml('a > b')).toBe('a &gt; b');
        });

        it('should escape double quote', () => {
            expect(escapeXml('"text"')).toBe('&quot;text&quot;');
        });

        it('should escape single quote', () => {
            expect(escapeXml("'text'")).toBe('&apos;text&apos;');
        });

        it('should handle null and undefined', () => {
            expect(escapeXml(null)).toBe('');
            expect(escapeXml(undefined)).toBe('');
        });

        it('should escape multiple special characters', () => {
            expect(escapeXml('<a href="test">Link & Text</a>')).toBe(
                '&lt;a href=&quot;test&quot;&gt;Link &amp; Text&lt;/a&gt;',
            );
        });
    });

    describe('escapeCdata', () => {
        it('should handle normal text', () => {
            expect(escapeCdata('Hello World')).toBe('Hello World');
        });

        it('should escape CDATA closing sequence', () => {
            expect(escapeCdata('Text with ]]> inside')).toBe('Text with ]]]]><![CDATA[> inside');
        });

        it('should handle multiple CDATA closing sequences', () => {
            expect(escapeCdata('First ]]> and second ]]> here')).toBe(
                'First ]]]]><![CDATA[> and second ]]]]><![CDATA[> here',
            );
        });

        it('should handle null and undefined', () => {
            expect(escapeCdata(null)).toBe('');
            expect(escapeCdata(undefined)).toBe('');
        });
    });
});
