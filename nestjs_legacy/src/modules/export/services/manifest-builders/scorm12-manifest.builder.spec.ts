import { Scorm12ManifestBuilder } from './scorm12-manifest.builder';
import { ExportContext } from '../../interfaces/export-strategy.interface';
import { SCORM12 } from '../../constants/export.constants';
import { ParsedOdeStructure } from '../../../xml/interfaces/ode-xml.interface';

describe('Scorm12ManifestBuilder', () => {
    let builder: Scorm12ManifestBuilder;

    const createMockStructure = (overrides: Partial<ParsedOdeStructure> = {}): ParsedOdeStructure => ({
        meta: {
            title: 'Test Course',
            author: 'Test Author',
            description: 'A test course description',
            language: 'es',
            keywords: 'test, course, scorm',
            license: 'CC BY-SA 4.0',
            exelearning_version: '3.0',
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
            {
                id: 'page3',
                title: 'Section 1.1',
                level: 1,
                parent_id: 'page2',
                position: 0,
                components: [],
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
        builder = new Scorm12ManifestBuilder();
    });

    describe('generateManifest()', () => {
        it('should generate valid SCORM 1.2 manifest XML', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(manifest).toContain('<manifest identifier=');
            expect(manifest).toContain(`xmlns="${SCORM12.NAMESPACES.DEFAULT}"`);
            expect(manifest).toContain(`xmlns:adlcp="${SCORM12.NAMESPACES.ADLCP}"`);
            expect(manifest).toContain('</manifest>');
        });

        it('should include metadata section with ADL SCORM schema', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<metadata>');
            expect(manifest).toContain('<schema>ADL SCORM</schema>');
            expect(manifest).toContain('<schemaversion>1.2</schemaversion>');
            expect(manifest).toContain(`<adlcp:location>${SCORM12.LOM_FILE}</adlcp:location>`);
            expect(manifest).toContain('</metadata>');
        });

        it('should include organizations section with course title', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<organizations default=');
            expect(manifest).toContain('structure="hierarchical"');
            expect(manifest).toContain('<title>Test Course</title>');
            expect(manifest).toContain('</organizations>');
        });

        it('should generate items for all pages', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('Introduction');
            expect(manifest).toContain('Chapter 1');
            expect(manifest).toContain('Section 1.1');
        });

        it('should generate resources for each page', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<resources>');
            expect(manifest).toContain('RES-PAGE1');
            expect(manifest).toContain('RES-PAGE2');
            expect(manifest).toContain('RES-PAGE3');
            expect(manifest).toContain('</resources>');
        });

        it('should set first page as index.html', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('href="index.html"');
        });

        it('should set subsequent pages in html/ directory', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('href="html/');
        });

        it('should include COMMON_FILES resource', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain(`identifier="${SCORM12.COMMON_FILES_ID}"`);
            expect(manifest).toContain('adlcp:scormtype="asset"');
        });

        it('should include common JavaScript files in COMMON_FILES', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('libs/jquery/jquery.min.js');
            expect(manifest).toContain('libs/SCORM_API_wrapper.js');
            expect(manifest).toContain('libs/SCOFunctions.js');
            expect(manifest).toContain('libs/common.js');
        });

        it('should include schema files in COMMON_FILES', async () => {
            const context = createMockContext();

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('adlcp_rootv1p2.xsd');
            expect(manifest).toContain('imscp_rootv1p1p2.xsd');
            expect(manifest).toContain('imsmd_rootv1p2p1.xsd');
            expect(manifest).toContain('ims_xml.xsd');
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

        it('should escape XML special characters in titles', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test <Course> & "More"' },
                    pages: [
                        {
                            id: 'page1',
                            title: 'Page with <special> & "chars"',
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
            expect(manifest).toContain('&quot;More&quot;');
        });

        it('should handle hierarchical page structure', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'root', title: 'Root', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'child1', title: 'Child 1', level: 1, parent_id: 'root', position: 0, components: [] },
                        { id: 'child2', title: 'Child 2', level: 1, parent_id: 'root', position: 1, components: [] },
                        { id: 'grandchild', title: 'Grandchild', level: 2, parent_id: 'child1', position: 0, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            // Should have nested item structure
            expect(manifest).toContain('<item identifier=');
            expect(manifest).toContain('</item>');
        });
    });

    describe('getManifestFilename()', () => {
        it('should return imsmanifest.xml', () => {
            const filename = builder.getManifestFilename();

            expect(filename).toBe(SCORM12.MANIFEST_FILE);
            expect(filename).toBe('imsmanifest.xml');
        });
    });

    describe('generateLomMetadata()', () => {
        it('should generate valid LOM metadata XML', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(lom).toContain('<lom xmlns="http://www.imsglobal.org/xsd/imsmd_v1p2"');
            expect(lom).toContain('</lom>');
        });

        it('should include general section with title', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<general>');
            expect(lom).toContain('<title>');
            expect(lom).toContain('Test Course');
            expect(lom).toContain('</title>');
            expect(lom).toContain('</general>');
        });

        it('should include title with correct language', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<langstring xml:lang="es">Test Course</langstring>');
        });

        it('should include description when provided', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<description>');
            expect(lom).toContain('A test course description');
            expect(lom).toContain('</description>');
        });

        it('should include keywords when provided', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<keyword>');
            expect(lom).toContain('test');
            expect(lom).toContain('course');
            expect(lom).toContain('scorm');
            expect(lom).toContain('</keyword>');
        });

        it('should include lifecycle section with author', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<lifecycle>');
            expect(lom).toContain('<contribute>');
            expect(lom).toContain('<role><value>Author</value></role>');
            expect(lom).toContain('Test Author');
            expect(lom).toContain('</lifecycle>');
        });

        it('should include technical section', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<technical>');
            expect(lom).toContain('<format>text/html</format>');
            expect(lom).toContain('</technical>');
        });

        it('should include rights section when license provided', async () => {
            const context = createMockContext();

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('<rights>');
            expect(lom).toContain('CC BY-SA 4.0');
            expect(lom).toContain('</rights>');
        });

        it('should use default language (en) when not specified', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [],
                }),
            });

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('xml:lang="en"');
        });

        it('should escape XML special characters in metadata', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: {
                        title: 'Course <with> & "special" chars',
                        author: 'John "Johnny" O\'Connor',
                        description: 'Description with <tags> & symbols',
                    },
                    pages: [],
                }),
            });

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('&lt;with&gt;');
            expect(lom).toContain('&amp;');
            expect(lom).toContain('&quot;special&quot;');
            expect(lom).toContain('&#39;Connor');
        });

        it('should handle missing optional fields gracefully', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Minimal Course' },
                    pages: [],
                }),
            });

            const lom = await builder.generateLomMetadata(context);

            expect(lom).toContain('Minimal Course');
            expect(lom).not.toContain('<description>');
            expect(lom).not.toContain('<keyword>');
            expect(lom).not.toContain('<rights>');
        });

        it('should not include author section when not provided', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Course Without Author' },
                    pages: [],
                }),
            });

            const lom = await builder.generateLomMetadata(context);

            expect(lom).not.toContain('<contribute>');
            expect(lom).not.toContain('<vcard>');
        });
    });

    describe('edge cases', () => {
        it('should handle empty pages array', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Empty Course' },
                    pages: [],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('<organizations');
            expect(manifest).toContain('<resources>');
            expect(manifest).toContain('</manifest>');
        });

        it('should handle pages with special characters in titles', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        {
                            id: 'page1',
                            title: 'Página con ñ, ü y acentos áéíóú',
                            level: 0,
                            parent_id: null,
                            position: 0,
                            components: [],
                        },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            expect(manifest).toContain('Página con ñ, ü y acentos áéíóú');
        });

        it('should sanitize filenames for resources', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'page1', title: 'Home', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'page2', title: 'Page With Spaces & Symbols!', level: 0, parent_id: null, position: 1, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            // Second page should have sanitized filename
            expect(manifest).toContain('html/page-with-spaces-symbols.html');
        });

        it('should include dependency on COMMON_FILES for each page resource', async () => {
            const context = createMockContext({
                structure: createMockStructure({
                    meta: { title: 'Test' },
                    pages: [
                        { id: 'page1', title: 'Page 1', level: 0, parent_id: null, position: 0, components: [] },
                        { id: 'page2', title: 'Page 2', level: 0, parent_id: null, position: 1, components: [] },
                    ],
                }),
            });

            const manifest = await builder.generateManifest(context);

            // Should have dependency on COMMON_FILES for each resource
            const dependencyMatches = manifest.match(/identifierref="COMMON_FILES"/g);
            expect(dependencyMatches).toHaveLength(2);
        });

        it('should generate unique IDs', async () => {
            const context = createMockContext();

            const manifest1 = await builder.generateManifest(context);
            const manifest2 = await builder.generateManifest(context);

            // Extract manifest IDs
            const idMatch1 = manifest1.match(/identifier="(eXe-MANIFEST-[^"]+)"/);
            const idMatch2 = manifest2.match(/identifier="(eXe-MANIFEST-[^"]+)"/);

            expect(idMatch1).toBeTruthy();
            expect(idMatch2).toBeTruthy();
            // IDs should be different (they include timestamp and random component)
            expect(idMatch1![1]).not.toBe(idMatch2![1]);
        });
    });
});
