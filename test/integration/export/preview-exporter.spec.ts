/**
 * Integration Tests for WebsitePreviewExporter
 *
 * Tests the unified preview generation system and verifies parity
 * between preview and export rendering pipelines.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

// Import from shared export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    WebsitePreviewExporter,
    type ParsedOdeStructure,
} from '../../../src/shared/export';

const testDir = path.join(process.cwd(), 'test', 'temp', 'preview-exporter-test');

// Sample parsed structure for testing
const sampleParsedStructure: ParsedOdeStructure = {
    meta: {
        title: 'Preview Test Project',
        author: 'Test Author',
        language: 'en',
        theme: 'base',
        description: 'A test project for preview',
    },
    pages: [
        {
            id: 'page-1',
            title: 'Introduction',
            components: [
                {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    content: '<p>Welcome to the course.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 0,
            parent_id: null,
            position: 0,
        },
        {
            id: 'page-2',
            title: 'Chapter 1',
            components: [
                {
                    id: 'comp-2',
                    type: 'FreeTextIdevice',
                    content: '<p>This is chapter 1 content.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 0,
            parent_id: null,
            position: 1,
        },
        {
            id: 'page-3',
            title: 'Subchapter 1.1',
            components: [
                {
                    id: 'comp-3',
                    type: 'FreeTextIdevice',
                    content: '<p>This is a subchapter.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 1,
            parent_id: 'page-2',
            position: 2,
        },
    ],
    navigation: null,
    raw: null,
};

describe('WebsitePreviewExporter Integration', () => {
    beforeEach(async () => {
        await fs.ensureDir(testDir);
        await fs.ensureDir(path.join(testDir, 'public'));
        await fs.ensureDir(path.join(testDir, 'public', 'theme', 'base'));
        await fs.ensureDir(path.join(testDir, 'public', 'libs'));
        await fs.ensureDir(path.join(testDir, 'extracted'));

        // Create required CSS file for exporters
        await fs.ensureDir(path.join(testDir, 'public', 'style', 'content', 'css'));
        await fs.writeFile(path.join(testDir, 'public', 'style', 'content', 'css', 'base.css'), '/* Test base CSS */');

        // Create minimal theme files
        await fs.writeFile(path.join(testDir, 'public', 'theme', 'base', 'style.css'), '/* Test theme CSS */');
        await fs.writeFile(path.join(testDir, 'public', 'theme', 'base', 'style.js'), '/* Test theme JS */');
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('generatePreview', () => {
        it('should generate preview HTML successfully', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toBeDefined();
            expect(typeof result.html).toBe('string');
        });

        it('should include DOCTYPE and HTML structure', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('<html');
            expect(result.html).toContain('</html>');
            expect(result.html).toContain('<head>');
            expect(result.html).toContain('<body');
        });

        it('should include project title in output', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('Preview Test Project');
        });

        it('should include all pages as SPA content', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // All page IDs should be present
            expect(result.html).toContain('page-1');
            expect(result.html).toContain('page-2');
            expect(result.html).toContain('page-3');
        });

        it('should include page content', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('Welcome to the course');
            expect(result.html).toContain('chapter 1 content');
            expect(result.html).toContain('subchapter');
        });

        it('should include navigation structure', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('siteNav');
            expect(result.html).toContain('Introduction');
            expect(result.html).toContain('Chapter 1');
        });

        it('should NOT include page counter by default (addPagination=false)', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // Check that the HTML element with class page-counter is NOT present
            // (note: the JS code may reference .page-counter-current-page class, but the HTML element should not exist)
            expect(result.html).not.toContain('<p class="page-counter">');
        });

        it('should include page counter when addPagination is true', async () => {
            const structureWithPagination: ParsedOdeStructure = {
                ...sampleParsedStructure,
                meta: {
                    ...sampleParsedStructure.meta,
                    addPagination: true,
                },
            };
            const document = new ElpDocumentAdapter(structureWithPagination, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('page-counter');
        });

        it('should include made-with-eXe credit', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('made-with-eXe');
            expect(result.html).toContain('exelearning.net');
        });

        it('should include SPA navigation JavaScript', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('showPage');
            expect(result.html).toContain('SPA Navigation');
        });

        it('should return error when no pages exist', async () => {
            const emptyStructure: ParsedOdeStructure = {
                meta: { title: 'Empty', author: '', language: 'en', theme: 'base' },
                pages: [],
                navigation: null,
                raw: null,
            };
            const document = new ElpDocumentAdapter(emptyStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.success).toBe(false);
            expect(result.error).toBe('No pages to preview');
        });
    });

    describe('versioned resource paths', () => {
        it('should use versioned paths when provided', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview({
                baseUrl: 'http://localhost:3001',
                basePath: '/app',
                version: 'v2.0.0',
            });

            expect(result.html).toContain('http://localhost:3001/app/v2.0.0/');
        });

        it('should include theme CSS path with version', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview({
                version: 'v1.0.0',
            });

            expect(result.html).toContain('/v1.0.0/');
            expect(result.html).toContain('style.css');
        });
    });

    describe('nested navigation structure', () => {
        it('should render parent pages with daddy class', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // page-2 has child page-3, so it should have 'daddy' class
            expect(result.html).toContain('daddy');
        });

        it('should render child pages in nested structure', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // Child should be in other-section
            expect(result.html).toContain('other-section');
            expect(result.html).toContain('Subchapter 1.1');
        });
    });

    describe('HTML escaping', () => {
        it('should escape HTML in page titles to prevent XSS', async () => {
            const xssStructure: ParsedOdeStructure = {
                meta: { title: 'Safe Title', author: '', language: 'en', theme: 'base' },
                pages: [
                    {
                        id: 'page-1',
                        title: '<script>alert("xss")</script>',
                        components: [],
                        level: 0,
                        parent_id: null,
                        position: 0,
                    },
                ],
                navigation: null,
                raw: null,
            };
            const document = new ElpDocumentAdapter(xssStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('&lt;script&gt;');
            expect(result.html).not.toContain('<script>alert("xss")</script>');
        });
    });

    describe('preview vs export parity', () => {
        it('should render iDevices with same structure as export', async () => {
            // This test verifies that WebsitePreviewExporter uses the same IdeviceRenderer
            // as Html5Exporter, producing consistent iDevice HTML structure
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));

            // Generate preview
            const previewExporter = new WebsitePreviewExporter(document, resources);
            const previewResult = await previewExporter.generatePreview();

            // Preview should succeed
            expect(previewResult.success).toBe(true);

            // Preview should contain iDevice structure matching export format:
            // - idevice_node class (from IdeviceRenderer.render)
            // - exe-text wrapper for text content (from IdeviceRenderer.render)
            expect(previewResult.html).toContain('idevice_node');
            expect(previewResult.html).toContain('exe-text');
        });

        it('should include license in footer', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            // License should be in footer (author is not rendered in HTML per Symfony legacy behavior)
            expect(result.html).toContain('siteFooter');
            expect(result.html).toContain('packageLicense');
        });
    });
});
