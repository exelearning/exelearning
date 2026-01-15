/**
 * Integration tests for LaTeX pre-rendering and Text iDevice export
 *
 * Prevents regression of:
 * 1. LaTeX data-latex attribute corruption when same LaTeX appears multiple times
 * 2. Text iDevice JSON data preservation in exports
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Html5Exporter } from '../../src/shared/export/exporters/Html5Exporter';
import { FflateZipProvider } from '../../src/shared/export/providers/FflateZipProvider';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
} from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';
import { extractZip } from '../../src/services/zip';
import { parseFromFile } from '../../src/services/xml/xml-parser';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

// Mock resource provider
const createMockResourceProvider = (): ResourceProvider => ({
    fetchTheme: async () => new Map(),
    fetchIdeviceResources: async () => new Map(),
    fetchBaseLibraries: async () => new Map(),
    fetchScormFiles: async () => new Map(),
    fetchLibraryFiles: async () => new Map(),
    fetchExeLogo: async () => null,
    fetchContentCss: async () => new Map(),
    normalizeIdeviceType: (type: string) => type.toLowerCase().replace(/idevice$/i, '') || 'text',
});

// Mock asset provider
const createMockAssetProvider = (): AssetProvider => ({
    getAsset: async () => null,
    getProjectAssets: async () => [],
    getAllAssets: async () => [],
});

// Helper to extract HTML from preview files
const getHtmlFromPreviewFiles = (files: Map<string, Uint8Array | string>, filename: string): string => {
    const content = files.get(filename);
    if (!content) return '';
    if (typeof content === 'string') return content;
    return new TextDecoder().decode(content);
};

// Create document with LaTeX content that has duplicated expressions
const createDocumentWithDuplicateLatex = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'LaTeX Duplicate Test',
        author: 'Test',
        description: '',
        language: 'en',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'base',
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'LaTeX Test Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            // Content with SAME LaTeX expression appearing multiple times
                            // This is the exact scenario that caused data-latex corruption
                            content: `<p>First formula: \\(\\LaTeX\\)</p>
                                      <p>Second time: \\(\\LaTeX\\)</p>
                                      <p>Third time: \\(\\LaTeX\\)</p>`,
                            properties: {},
                        },
                    ],
                },
            ],
        },
    ],
});

// Create document with various LaTeX expressions
const createDocumentWithVariousLatex = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'LaTeX Various Test',
        author: 'Test',
        description: '',
        language: 'en',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'base',
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'Math Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: `<p>Inline: \\(E = mc^2\\)</p>
                                      <p>Display: \\[\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\\]</p>
                                      <p>Dollar inline: $x^2 + y^2 = z^2$</p>
                                      <p>Dollar display: $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$</p>`,
                            properties: {},
                        },
                    ],
                },
            ],
        },
    ],
});

// Create document with text iDevice containing JSON data attribute
const createDocumentWithTextIdeviceJson = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Text iDevice JSON Test',
        author: 'Test',
        description: '',
        language: 'en',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'base',
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'Text Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Simple text content</p>',
                            properties: {
                                textTextarea: '<p>Simple text content</p>',
                            },
                        },
                    ],
                },
            ],
        },
    ],
});

// Create document with text iDevice containing LaTeX in JSON
const createDocumentWithLatexInTextJson = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Text iDevice LaTeX JSON Test',
        author: 'Test',
        description: '',
        language: 'en',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'base',
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'Text with LaTeX',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Math: \\(\\alpha + \\beta\\)</p><p>Same: \\(\\alpha + \\beta\\)</p>',
                            properties: {
                                textTextarea: '<p>Math: \\(\\alpha + \\beta\\)</p><p>Same: \\(\\alpha + \\beta\\)</p>',
                            },
                        },
                    ],
                },
            ],
        },
    ],
});

describe('LaTeX Pre-rendering Export Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('duplicate LaTeX expressions', () => {
        it('should NOT corrupt data-latex when same LaTeX appears multiple times', async () => {
            const document = createDocumentWithDuplicateLatex();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // Check that NO data-latex attribute contains HTML tags (corruption)
            // This was the exact bug: data-latex="<span class=" instead of data-latex="\(\LaTeX\)"
            const corruptedDataLatex = html.match(/data-latex="[^"]*<span[^"]*"/g);
            expect(corruptedDataLatex).toBeNull();

            // Also check for encoded corruption
            const encodedCorruption = html.match(/data-latex="[^"]*&lt;span[^"]*"/g);
            expect(encodedCorruption).toBeNull();

            // If pre-rendered, all data-latex should contain valid LaTeX, not HTML
            const dataLatexMatches = html.match(/data-latex="([^"]*)"/g) || [];
            for (const match of dataLatexMatches) {
                const value = match.replace('data-latex="', '').replace('"', '');
                // data-latex should contain LaTeX delimiters or LaTeX commands, not HTML
                expect(value).not.toContain('<span');
                expect(value).not.toContain('&lt;span');
                expect(value).not.toContain('exe-math-rendered');
            }
        });

        it('should render all duplicate LaTeX expressions correctly', async () => {
            const document = createDocumentWithDuplicateLatex();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            // Content should mention all three formulas
            expect(html).toContain('First formula');
            expect(html).toContain('Second time');
            expect(html).toContain('Third time');

            // If pre-rendered, should have exe-math-rendered spans
            // Count them - should have 3 (one for each LaTeX expression)
            const mathRenderedMatches = html.match(/exe-math-rendered/g) || [];
            // We expect 3 occurrences if pre-rendering is enabled
            // At minimum, there should be no corrupted ones
            if (mathRenderedMatches.length > 0) {
                // All should have valid data-latex
                const spans = html.match(/<span[^>]*exe-math-rendered[^>]*data-latex="([^"]*)"[^>]*>/g) || [];
                for (const span of spans) {
                    expect(span).not.toContain('data-latex="<');
                    expect(span).not.toContain('data-latex="&lt;');
                }
            }
        });
    });

    describe('various LaTeX formats', () => {
        it('should preserve LaTeX content in output', async () => {
            const document = createDocumentWithVariousLatex();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // Content descriptions should be present
            expect(html).toContain('Inline');
            expect(html).toContain('Display');

            // No corruption in any data-latex attributes
            const dataLatexMatches = html.match(/data-latex="([^"]*)"/g) || [];
            for (const match of dataLatexMatches) {
                expect(match).not.toContain('<span');
                expect(match).not.toContain('exe-math-rendered');
            }
        });
    });
});

describe('Text iDevice JSON Export Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('JSON data preservation', () => {
        it('should preserve text iDevice content in export', async () => {
            const document = createDocumentWithTextIdeviceJson();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('Simple text content');
        });

        it('should preserve LaTeX in text iDevice JSON without corruption', async () => {
            const document = createDocumentWithLatexInTextJson();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // If there are data-idevice-json-data attributes, parse and verify
            const jsonDataMatches = html.match(/data-idevice-json-data="([^"]*)"/g) || [];
            for (const match of jsonDataMatches) {
                // Extract the JSON string (HTML entities need decoding)
                const jsonStr = match
                    .replace('data-idevice-json-data="', '')
                    .replace(/"$/, '')
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');

                // If it has textTextarea, verify no corruption
                if (jsonStr.includes('textTextarea')) {
                    // textTextarea should NOT contain nested exe-math-rendered with corrupted data-latex
                    // The corruption pattern was: data-latex="<span class=" inside textTextarea
                    const corruptionPattern = /data-latex=\\"[^"]*<span[^"]*\\"/;
                    expect(jsonStr).not.toMatch(corruptionPattern);
                }
            }

            // General check: no corrupted data-latex anywhere in HTML
            const corruptedDataLatex = html.match(/data-latex="[^"]*<span[^"]*"/g);
            expect(corruptedDataLatex).toBeNull();
        });
    });
});

describe('LaTeX fixture import test', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join('/tmp', `latex-fixture-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        if (tempDir && (await fs.pathExists(tempDir))) {
            await fs.remove(tempDir);
        }
    });

    const latexFixturePath = path.join(FIXTURES_DIR, 'latex.elp');

    it('should extract and parse latex.elp without errors', async () => {
        if (!(await fs.pathExists(latexFixturePath))) {
            console.log('Skipping: latex.elp fixture not found');
            return;
        }

        const extractDir = path.join(tempDir, 'extracted');
        await extractZip(latexFixturePath, extractDir);

        // Should have content.xml or contentv3.xml (legacy format)
        const contentPath = path.join(extractDir, 'content.xml');
        const contentV3Path = path.join(extractDir, 'contentv3.xml');
        const hasContent = (await fs.pathExists(contentPath)) || (await fs.pathExists(contentV3Path));
        expect(hasContent).toBe(true);

        // For legacy format (contentv3.xml), we just verify extraction works
        // The XML parsing would need legacy parser which is client-side
        if (await fs.pathExists(contentPath)) {
            const structure = await parseFromFile(contentPath, 'test-session');
            expect(structure).toBeDefined();
            expect(structure.pages).toBeDefined();
            expect(Array.isArray(structure.pages)).toBe(true);
        } else {
            // Legacy format - verify contentv3.xml exists and has LaTeX
            const contentV3 = await fs.readFile(contentV3Path, 'utf-8');
            expect(contentV3.length).toBeGreaterThan(0);
            // Legacy files with LaTeX should contain LaTeX markers
            const hasLatexContent = contentV3.includes('\\(') || contentV3.includes('\\[') || contentV3.includes('$');
            expect(hasLatexContent).toBe(true);
        }
    }, 30000);

    it('should find LaTeX content in latex.elp components', async () => {
        if (!(await fs.pathExists(latexFixturePath))) {
            console.log('Skipping: latex.elp fixture not found');
            return;
        }

        const extractDir = path.join(tempDir, 'extracted_latex');
        await extractZip(latexFixturePath, extractDir);

        // Handle both modern (content.xml) and legacy (contentv3.xml) formats
        const contentPath = path.join(extractDir, 'content.xml');
        const contentV3Path = path.join(extractDir, 'contentv3.xml');

        if (await fs.pathExists(contentPath)) {
            // Modern format - parse and check components
            const structure = await parseFromFile(contentPath, 'test-session');

            // Collect all components
            const allComponents: any[] = [];
            for (const page of structure.pages) {
                if (page.components && Array.isArray(page.components)) {
                    allComponents.push(...page.components);
                }
                if (page.blocks && Array.isArray(page.blocks)) {
                    for (const block of page.blocks) {
                        if (block.components && Array.isArray(block.components)) {
                            allComponents.push(...block.components);
                        }
                    }
                }
            }

            // Find components with LaTeX content
            const latexPatterns = [/\\\(.*?\\\)/, /\\\[.*?\\\]/, /\$[^$]+\$/, /\$\$[^$]+\$\$/];
            const componentsWithLatex = allComponents.filter(c => {
                const content = c.content || c.htmlView || '';
                return latexPatterns.some(p => p.test(content));
            });

            // The fixture should have LaTeX content
            expect(componentsWithLatex.length).toBeGreaterThan(0);
        } else if (await fs.pathExists(contentV3Path)) {
            // Legacy format - check raw XML for LaTeX markers
            const contentV3 = await fs.readFile(contentV3Path, 'utf-8');

            // Look for LaTeX patterns in raw XML
            const latexPatterns = [/\\\(/, /\\\[/, /\\\)/, /\\\]/, /\\LaTeX/i, /\\frac/, /\\sqrt/, /\\alpha/, /\\beta/];
            const hasLatexContent = latexPatterns.some(p => p.test(contentV3));
            expect(hasLatexContent).toBe(true);
        } else {
            throw new Error('Neither content.xml nor contentv3.xml found');
        }
    }, 30000);
});
