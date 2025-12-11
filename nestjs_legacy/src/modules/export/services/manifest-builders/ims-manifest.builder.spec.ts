import { ImsManifestBuilder } from './ims-manifest.builder';
import { ExportContext } from '../../interfaces/export-strategy.interface';
import { IMS } from '../../constants/export.constants';
import { ParsedOdeStructure } from '../../../xml/interfaces/ode-xml.interface';

describe('ImsManifestBuilder', () => {
    let builder: ImsManifestBuilder;

    const createMockStructure = (overrides: Partial<ParsedOdeStructure> = {}): ParsedOdeStructure => ({
        meta: {
            title: 'Test IMS Package',
            author: 'Test Author',
            description: 'A test IMS content package',
            language: 'en',
            keywords: 'ims, content, package',
            license: 'CC BY-SA 4.0',
        },
        pages: [
            {
                id: 'page1',
                title: 'Introduction',
                level: 0,
                parent_id: null,
                position: 0,
                components: [],
            },
            {
                id: 'page2',
                title: 'Chapter 1',
                level: 0,
                parent_id: null,
                position: 1,
                components: [{ id: 'comp1', type: 'text', content: '' }],
            },
        ],
        navigation: { page: { id: 'page1', title: 'Introduction' } },
        raw: { ode: {} },
        ...overrides,
    });

    const createMockContext = (overrides: Partial<ExportContext> = {}): ExportContext => ({
        sessionId: 'test-session-123',
        structure: createMockStructure(),
        sessionPath: '/tmp/session-123',
        exportDir: '/tmp/export-123',
        options: {
            includeNavigation: true,
            responsive: true,
        },
        ...overrides,
    });

    beforeEach(() => {
        builder = new ImsManifestBuilder();
    });

    describe('generateManifest()', () => {
        it('should generate valid IMS manifest XML', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(manifest).toContain('<manifest identifier=');
            expect(manifest).toContain(`xmlns="${IMS.NAMESPACES.DEFAULT}"`);
            expect(manifest).toContain(`xmlns:imsmd="${IMS.NAMESPACES.IMS}"`);
            expect(manifest).toContain('</manifest>');
        });

        it('should include IMS Content schema in metadata', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<metadata>');
            expect(manifest).toContain('<schema>IMS Content</schema>');
            expect(manifest).toContain('<schemaversion>1.1.3</schemaversion>');
            expect(manifest).toContain('</metadata>');
        });

        it('should include inline LOM metadata', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:lom>');
            expect(manifest).toContain('<imsmd:general>');
            expect(manifest).toContain('<imsmd:title>');
            expect(manifest).toContain('Test IMS Package');
            expect(manifest).toContain('</imsmd:lom>');
        });

        it('should include description in metadata when provided', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:description>');
            expect(manifest).toContain('A test IMS content package');
            expect(manifest).toContain('</imsmd:description>');
        });

        it('should include keywords in metadata when provided', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:keyword>');
            expect(manifest).toContain('ims');
            expect(manifest).toContain('content');
            expect(manifest).toContain('package');
        });

        it('should include author lifecycle information', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:lifecycle>');
            expect(manifest).toContain('<imsmd:contribute>');
            expect(manifest).toContain('<imsmd:role><imsmd:value>Author</imsmd:value></imsmd:role>');
            expect(manifest).toContain('Test Author');
            expect(manifest).toContain('</imsmd:lifecycle>');
        });

        it('should include technical format section', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:technical>');
            expect(manifest).toContain('<imsmd:format>text/html</imsmd:format>');
            expect(manifest).toContain('</imsmd:technical>');
        });

        it('should include rights section when license provided', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<imsmd:rights>');
            expect(manifest).toContain('CC BY-SA 4.0');
            expect(manifest).toContain('</imsmd:rights>');
        });

        it('should include organizations section with title', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<organizations default=');
            expect(manifest).toContain('structure="hierarchical"');
            expect(manifest).toContain('<title>Test IMS Package</title>');
            expect(manifest).toContain('</organizations>');
        });

        it('should generate items for all pages', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('Introduction');
            expect(manifest).toContain('Chapter 1');
        });

        it('should generate resources without SCORM attributes', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<resources>');
            expect(manifest).toContain('RES-PAGE1');
            expect(manifest).toContain('RES-PAGE2');
            // IMS should NOT have SCORM-specific attributes
            expect(manifest).not.toContain('adlcp:scormtype');
            expect(manifest).toContain('</resources>');
        });

        it('should include COMMON_FILES resource without SCORM JS', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('identifier="COMMON_FILES"');
            // Should NOT include SCORM JS files
            expect(manifest).not.toContain('SCORM_API_wrapper.js');
            expect(manifest).not.toContain('SCOFunctions.js');
            // Should include common files
            expect(manifest).toContain('libs/jquery/jquery.min.js');
            expect(manifest).toContain('libs/common.js');
        });

        it('should include IMS schema files', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('imscp_rootv1p1p2.xsd');
            expect(manifest).toContain('imsmd_rootv1p2p1.xsd');
            expect(manifest).toContain('ims_xml.xsd');
            // Should NOT include SCORM schema
            expect(manifest).not.toContain('adlcp_rootv1p2.xsd');
        });

        it('should use default title when not provided', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: {},
                    pages: [{ id: 'page1', title: 'Page', level: 0, parent_id: null, position: 0, components: [] }],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<title>eXeLearning Content</title>');
        });

        it('should escape XML special characters', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'IMS <Course> & "Package"' },
                    pages: [
                        {
                            id: 'page1',
                            title: 'Page with <special> chars',
                            level: 0,
                            parent_id: null,
                            position: 0,
                            components: [],
                        },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('&lt;Course&gt;');
            expect(manifest).toContain('&amp;');
            expect(manifest).toContain('&quot;Package&quot;');
        });

        it('should handle hierarchical page structure', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'root', title: 'Root', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'child1', title: 'Child 1', level: 1, parent_id: 'root', position: 0, components: [] },
                        { id: 'child2', title: 'Child 2', level: 1, parent_id: 'root', position: 1, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<item identifier=');
            expect(manifest).toContain('Root');
            expect(manifest).toContain('Child 1');
            expect(manifest).toContain('Child 2');
        });
    });

    describe('getManifestFilename()', () => {
        it('should return imsmanifest.xml', () => {
            const filename = builder.getManifestFilename();

            expect(filename).toBe(IMS.MANIFEST_FILE);
            expect(filename).toBe('imsmanifest.xml');
        });
    });

    describe('edge cases', () => {
        it('should handle empty pages array', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Empty Package' },
                    pages: [],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<organizations');
            expect(manifest).toContain('<resources>');
            expect(manifest).toContain('</manifest>');
        });

        it('should handle missing optional metadata fields', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Minimal Package' },
                    pages: [],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('Minimal Package');
            expect(manifest).not.toContain('<imsmd:description>');
            expect(manifest).not.toContain('<imsmd:keyword>');
            expect(manifest).not.toContain('<imsmd:rights>');
            expect(manifest).not.toContain('<imsmd:lifecycle>');
        });

        it('should use default language (en) when not specified', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('xml:lang="en"');
        });

        it('should sanitize filenames for resources', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'page1', title: 'Home', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'page2', title: 'Page With Spaces!', level: 0, parent_id: null, position: 1, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('html/page-with-spaces.html');
        });

        it('should generate unique IDs', async () => {
            const context = createMockContext();

            const manifest1 = await builder.generateManifest(context);
            const manifest2 = await builder.generateManifest(context);

            const idMatch1 = manifest1.match(/identifier="(eXe-MANIFEST-[^"]+)"/);
            const idMatch2 = manifest2.match(/identifier="(eXe-MANIFEST-[^"]+)"/);

            expect(idMatch1).toBeTruthy();
            expect(idMatch2).toBeTruthy();
            expect(idMatch1![1]).not.toBe(idMatch2![1]);
        });

        it('should include dependency on COMMON_FILES for each page resource', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'page1', title: 'Page 1', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'page2', title: 'Page 2', level: 0, parent_id: null, position: 1, components: [] },
                        { id: 'page3', title: 'Page 3', level: 0, parent_id: null, position: 2, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            const dependencyMatches = manifest.match(/identifierref="COMMON_FILES"/g);
            expect(dependencyMatches).toHaveLength(3);
        });
    });
});
