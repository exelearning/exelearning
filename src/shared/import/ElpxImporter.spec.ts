/**
 * ElpxImporter Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

import { ElpxImporter } from './ElpxImporter';
import { FileSystemAssetHandler } from './FileSystemAssetHandler';
import type { Logger } from './interfaces';

// Silent logger for tests
const silentLogger: Logger = {
    log: () => {},
    warn: () => {},
    error: () => {},
};

describe('ElpxImporter', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `elp-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('importFromBuffer', () => {
        it('should import a basic ELP file', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            expect(result.pages).toBeGreaterThan(0);
            expect(result.blocks).toBeGreaterThan(0);
            expect(result.components).toBeGreaterThan(0);

            // Verify Y.Doc structure
            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBe(result.pages);

            // Verify metadata was set
            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBeTruthy();

            // Cleanup
            ydoc.destroy();
        });

        it('should set correct metadata from ELP file', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBe('Main title');
            expect(metadata.get('theme')).toBe('base');

            ydoc.destroy();
        });

        it('should import pages with correct hierarchy', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBe(result.pages);

            // Get first page
            const firstPage = navigation.get(0) as Y.Map<unknown>;
            expect(firstPage.get('pageName')).toBeTruthy();
            expect(firstPage.get('parentId')).toBeNull();

            // Check second page has parentId referencing first page
            if (navigation.length > 1) {
                const secondPage = navigation.get(1) as Y.Map<unknown>;
                const secondParentId = secondPage.get('parentId');
                // Second page should either be a root page or child of first
                expect(secondParentId === null || typeof secondParentId === 'string').toBe(true);
            }

            ydoc.destroy();
        });

        it('should import blocks with components', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const navigation = ydoc.getArray('navigation');
            const firstPage = navigation.get(0) as Y.Map<unknown>;
            const blocks = firstPage.get('blocks') as Y.Array<unknown>;

            expect(blocks.length).toBeGreaterThan(0);

            const firstBlock = blocks.get(0) as Y.Map<unknown>;
            expect(firstBlock.get('blockName')).toBeDefined();

            const components = firstBlock.get('components') as Y.Array<unknown>;
            expect(components.length).toBeGreaterThan(0);

            const firstComponent = components.get(0) as Y.Map<unknown>;
            expect(firstComponent.get('type')).toBeTruthy();

            ydoc.destroy();
        });

        it('should handle ELP files with assets', async () => {
            // Use a file with assets
            const elpPath = path.join(process.cwd(), 'test/fixtures/todos-los-idevices.elp');
            if (!existsSync(elpPath)) {
                // Skip if file doesn't exist
                return;
            }

            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            expect(result.pages).toBeGreaterThan(0);
            // Assets may or may not be present depending on the file
            expect(result.assets).toBeGreaterThanOrEqual(0);

            ydoc.destroy();
        });

        it('should respect clearExisting option', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();

            // First import
            const importer1 = new ElpxImporter(ydoc, null, silentLogger);
            const result1 = await importer1.importFromBuffer(new Uint8Array(elpBuffer));

            // Second import without clearing
            const importer2 = new ElpxImporter(ydoc, null, silentLogger);
            const result2 = await importer2.importFromBuffer(new Uint8Array(elpBuffer), { clearExisting: false });

            const navigation = ydoc.getArray('navigation');
            // Should have pages from both imports
            expect(navigation.length).toBe(result1.pages + result2.pages);

            ydoc.destroy();
        });

        it('should report progress during import', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const progressEvents: string[] = [];

            await importer.importFromBuffer(new Uint8Array(elpBuffer), {
                onProgress: progress => {
                    progressEvents.push(progress.phase);
                },
            });

            // Should have all phases
            expect(progressEvents).toContain('decompress');
            expect(progressEvents).toContain('assets');
            expect(progressEvents).toContain('structure');
            expect(progressEvents).toContain('precache');

            ydoc.destroy();
        });

        it('should report incremental progress during asset extraction', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const progressMessages: { phase: string; percent: number; message: string }[] = [];

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer), {
                onProgress: progress => {
                    progressMessages.push({
                        phase: progress.phase,
                        percent: progress.percent,
                        message: progress.message,
                    });
                },
            });

            // If there were assets, we should see incremental progress updates
            if (result.assets > 0) {
                const extractingMessages = progressMessages.filter(
                    p => p.phase === 'assets' && p.message === 'Extracting assets...',
                );
                expect(extractingMessages.length).toBeGreaterThan(0);

                // All extracting messages should have percent between 10 and 50
                for (const msg of extractingMessages) {
                    expect(msg.percent).toBeGreaterThanOrEqual(10);
                    expect(msg.percent).toBeLessThanOrEqual(50);
                }
            }

            ydoc.destroy();
        });

        it('should return zipContents in result for theme import optimization', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // zipContents should be returned for theme import optimization
            expect(result.zipContents).toBeDefined();
            expect(typeof result.zipContents).toBe('object');
            // Should contain content.xml (the main content file)
            expect(result.zipContents!['content.xml']).toBeDefined();

            ydoc.destroy();
        });
    });

    describe('error handling', () => {
        it('should throw error for invalid ZIP file', async () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const invalidBuffer = new Uint8Array([0, 1, 2, 3, 4, 5]);

            await expect(importer.importFromBuffer(invalidBuffer)).rejects.toThrow();

            ydoc.destroy();
        });

        it('should throw error for ZIP without content.xml', async () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            // Create a minimal ZIP without content.xml
            const fflate = await import('fflate');
            const emptyZip = fflate.zipSync({
                'empty.txt': new Uint8Array([]),
            });

            await expect(importer.importFromBuffer(emptyZip)).rejects.toThrow('No content.xml');

            ydoc.destroy();
        });
    });
});

describe('ElpxImporter - Legacy Format', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `elp-legacy-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('importFromBuffer with legacy format', () => {
        it('should import a legacy ELP file (contentv3.xml)', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // Should import at least one page
            expect(result.pages).toBeGreaterThan(0);

            // Verify Y.Doc structure
            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBe(result.pages);

            // Verify metadata was set
            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBeTruthy();

            // Cleanup
            ydoc.destroy();
        });

        it('should set correct metadata from legacy ELP file', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const metadata = ydoc.getMap('metadata');
            // Legacy files should have default addMathJax and globalFont
            expect(metadata.get('addMathJax')).toBe(false);
            expect(metadata.get('globalFont')).toBe('default');
            // Should have language
            expect(metadata.get('language')).toBeTruthy();

            ydoc.destroy();
        });

        it('should import pages with iDevices from legacy format', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBeGreaterThan(0);

            // Get first page
            const firstPage = navigation.get(0) as Y.Map<unknown>;
            expect(firstPage.get('pageName')).toBeTruthy();

            // Check blocks exist
            const blocks = firstPage.get('blocks') as Y.Array<unknown>;
            expect(blocks).toBeDefined();

            ydoc.destroy();
        });

        it('should report progress during legacy import', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const progressEvents: string[] = [];

            await importer.importFromBuffer(new Uint8Array(elpBuffer), {
                onProgress: progress => {
                    progressEvents.push(progress.phase);
                },
            });

            // Should have all phases
            expect(progressEvents).toContain('decompress');
            expect(progressEvents).toContain('assets');
            expect(progressEvents).toContain('structure');
            expect(progressEvents).toContain('precache');

            ydoc.destroy();
        });

        it('should return zipContents in result for legacy format', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // zipContents should be returned for theme import optimization
            expect(result.zipContents).toBeDefined();
            expect(typeof result.zipContents).toBe('object');
            // Legacy files use contentv3.xml
            expect(result.zipContents!['contentv3.xml']).toBeDefined();

            ydoc.destroy();
        });

        it('should handle larger legacy ELP file', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_el_cid.elp');
            if (!existsSync(elpPath)) {
                return; // Skip if file doesn't exist
            }

            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // Should import multiple pages
            expect(result.pages).toBeGreaterThan(0);

            // Verify metadata
            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBeTruthy();

            ydoc.destroy();
        });

        it('should generate new format asset URLs (asset://uuid.ext) for legacy files with assets', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_el_cid.elp');
            if (!existsSync(elpPath)) {
                return; // Skip if file doesn't exist
            }

            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // This file should have assets
            expect(result.assets).toBeGreaterThan(0);

            // Helper to find all asset:// URLs in content
            const findAssetUrls = (obj: unknown): string[] => {
                const urls: string[] = [];
                const assetRegex = /asset:\/\/[a-f0-9-]+(?:\.[a-z0-9]+)?/gi;

                if (typeof obj === 'string') {
                    const matches = obj.match(assetRegex);
                    if (matches) urls.push(...matches);
                } else if (obj instanceof Y.Text) {
                    const text = obj.toString();
                    const matches = text.match(assetRegex);
                    if (matches) urls.push(...matches);
                } else if (obj instanceof Y.Map) {
                    obj.forEach(value => {
                        urls.push(...findAssetUrls(value));
                    });
                } else if (obj instanceof Y.Array) {
                    obj.forEach(item => {
                        urls.push(...findAssetUrls(item));
                    });
                } else if (typeof obj === 'object' && obj !== null) {
                    Object.values(obj).forEach(value => {
                        urls.push(...findAssetUrls(value));
                    });
                }
                return urls;
            };

            const navigation = ydoc.getArray('navigation');
            const assetUrls = findAssetUrls(navigation);

            // If there are asset URLs, verify they're in new format (uuid.ext or just uuid, not uuid/path)
            if (assetUrls.length > 0) {
                for (const url of assetUrls) {
                    // New format: asset://uuid.ext or asset://uuid (NO slash after uuid)
                    expect(url).not.toMatch(/asset:\/\/[a-f0-9-]+\//i);
                }
            }

            ydoc.destroy();
        });

        it('should respect clearExisting option with legacy format', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();

            // First import
            const importer1 = new ElpxImporter(ydoc, null, silentLogger);
            const result1 = await importer1.importFromBuffer(new Uint8Array(elpBuffer));

            // Second import without clearing
            const importer2 = new ElpxImporter(ydoc, null, silentLogger);
            const result2 = await importer2.importFromBuffer(new Uint8Array(elpBuffer), { clearExisting: false });

            const navigation = ydoc.getArray('navigation');
            // Should have pages from both imports
            expect(navigation.length).toBe(result1.pages + result2.pages);

            ydoc.destroy();
        });
    });

    describe('importFromZipContents with legacy format', () => {
        it('should import from pre-extracted legacy ZIP contents', async () => {
            const fflate = await import('fflate');
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            // Decompress the ZIP to get contents
            const zipContents = fflate.unzipSync(new Uint8Array(elpBuffer));

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            expect(result.pages).toBeGreaterThan(0);

            const navigation = ydoc.getArray('navigation');
            expect(navigation.length).toBe(result.pages);

            ydoc.destroy();
        });

        it('should detect legacy format from contentv3.xml', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test Project"/>
    <string role="key" value="_author"/>
    <unicode value="Test Author"/>
    <string role="key" value="_description"/>
    <unicode value="Test Description"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Hello World&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
            };

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            // Should import the page
            expect(result.pages).toBeGreaterThan(0);

            // Verify metadata
            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('title')).toBe('Test Project');
            expect(metadata.get('author')).toBe('Test Author');
            expect(metadata.get('language')).toBe('en');

            // Verify page structure
            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            expect(page.get('pageName')).toBe('Home Page');

            ydoc.destroy();
        });

        it('should throw error when no content.xml or contentv3.xml', async () => {
            const zipContents: Record<string, Uint8Array> = {
                'other-file.txt': new TextEncoder().encode('hello'),
            };

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await expect(importer.importFromZipContents(zipContents)).rejects.toThrow('No content.xml');

            ydoc.destroy();
        });

        it('should handle legacy XML with export options', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_addPagination"/>
    <bool value="1"/>
    <string role="key" value="_addSearchBox"/>
    <bool value="1"/>
    <string role="key" value="_addExeLink"/>
    <bool value="0"/>
    <string role="key" value="_addAccessibilityToolbar"/>
    <bool value="1"/>
    <string role="key" value="exportSource"/>
    <bool value="1"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
            };

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromZipContents(zipContents);

            // Verify export options are set
            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('addPagination')).toBe(true);
            expect(metadata.get('addSearchBox')).toBe(true);
            expect(metadata.get('addExeLink')).toBe(false);
            expect(metadata.get('addAccessibilityToolbar')).toBe(true);
            expect(metadata.get('exportSource')).toBe(true);
            // Legacy files use defaults for new fields
            expect(metadata.get('addMathJax')).toBe(false);
            expect(metadata.get('globalFont')).toBe('default');

            ydoc.destroy();
        });

        it('should handle legacy XML with footer and extra head content', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="footer"/>
    <unicode value="Custom Footer"/>
    <string role="key" value="_extraHeadContent"/>
    <unicode value="&lt;meta name=&quot;test&quot;&gt;"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
            };

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromZipContents(zipContents);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('footer')).toBe('Custom Footer');
            expect(metadata.get('extraHeadContent')).toContain('meta');

            ydoc.destroy();
        });

        it('should handle iDevice with feedback', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_lang"/>
    <unicode value="es"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.reflectionidevice.ReflectionIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Reflection"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Question&lt;/p&gt;"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.field.FeedbackField" reference="5">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Answer&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
            };

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromZipContents(zipContents);

            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            expect(blocks.length).toBeGreaterThan(0);

            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            expect(components.length).toBeGreaterThan(0);

            const component = components.get(0) as Y.Map<unknown>;
            const htmlView = component.get('htmlView') as string;
            expect(htmlView).toContain('Question');
            expect(htmlView).toContain('feedback');

            ydoc.destroy();
        });
    });
});

describe('ElpxImporter - findAssetUrlForPath coverage', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `elp-asset-url-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('findAssetUrlForPath via convertAssetPathsInObject', () => {
        it('should convert resources/ path with exact match in assetMap', async () => {
            // Create a legacy XML with a gallery iDevice that has image paths in properties
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test Gallery"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.galleryidevice.GalleryIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Gallery"/>
              <string role="key" value="images"/>
              <list>
                <instance class="exe.engine.galleryidevice.GalleryImage" reference="4">
                  <dictionary>
                    <string role="key" value="_imageResource"/>
                    <instance class="exe.engine.resource.Resource" reference="5">
                      <dictionary>
                        <string role="key" value="_storageName"/>
                        <unicode value="image1.jpg"/>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            // Create ZIP contents with the asset
            const imageData = new Uint8Array([255, 216, 255, 224]); // JPEG header
            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
                'resources/image1.jpg': imageData,
            };

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            // Asset extraction creates multiple mappings for lookup flexibility
            expect(result.assets).toBeGreaterThanOrEqual(1);
            expect(result.pages).toBe(1);

            ydoc.destroy();
        });

        it('should convert resources/ path by stripping prefix when asset stored at root', async () => {
            // Legacy ELP files store assets at root level but reference them as resources/filename
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;img src=&quot;resources/photo.png&quot; /&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            // Asset stored at root level (legacy format)
            const imageData = new Uint8Array([137, 80, 78, 71]); // PNG header
            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
                'photo.png': imageData, // Root level asset
            };

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            // Asset extraction creates multiple mappings for lookup flexibility
            expect(result.assets).toBeGreaterThanOrEqual(1);

            // Verify the HTML content was converted to use asset:// URL
            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            const component = components.get(0) as Y.Map<unknown>;
            const htmlView = component.get('htmlView') as string;

            // Should contain asset:// URL, not resources/ path
            expect(htmlView).toContain('asset://');
            expect(htmlView).not.toContain('resources/photo.png');

            ydoc.destroy();
        });

        it('should convert resources/ path by filename-only match', async () => {
            // Test case where assetMap has 'subfolder/image.png' but we search for 'resources/image.png'
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;img src=&quot;resources/document.pdf&quot; /&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            // Asset stored in subdirectory - filename-only match should find it
            const pdfData = new Uint8Array([37, 80, 68, 70]); // PDF header
            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
                'resources/files/document.pdf': pdfData, // Nested in subdirectory
            };

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            // Asset extraction creates multiple mappings for lookup flexibility
            expect(result.assets).toBeGreaterThanOrEqual(1);

            // Verify the HTML content was converted to use asset:// URL
            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            const component = components.get(0) as Y.Map<unknown>;
            const htmlView = component.get('htmlView') as string;

            // Should contain asset:// URL
            expect(htmlView).toContain('asset://');

            ydoc.destroy();
        });

        it('should handle files without extension in resources directory', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;a href=&quot;resources/LICENSE&quot;&gt;License&lt;/a&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            // Asset without extension in resources/ directory
            const textData = new TextEncoder().encode('MIT License...');
            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
                'resources/LICENSE': textData,
            };

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            const result = await importer.importFromZipContents(zipContents);

            // Files in resources/ directory are extracted as assets regardless of extension
            // The MEDIA_EXTENSIONS check only applies to root-level files
            expect(result.assets).toBeGreaterThanOrEqual(1);

            // Verify the file without extension generates an asset:// URL without extension
            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            const component = components.get(0) as Y.Map<unknown>;
            const htmlView = component.get('htmlView') as string;

            // Should contain asset:// URL for the file without extension
            expect(htmlView).toContain('asset://');

            ydoc.destroy();
        });

        it('should generate new format URLs (asset://uuid.ext) for all asset path lookups', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;img src=&quot;resources/test.gif&quot; /&gt;&lt;img src=&quot;resources/other.webp&quot; /&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const gifData = new Uint8Array([71, 73, 70, 56]); // GIF header
            const webpData = new Uint8Array([82, 73, 70, 70]); // WEBP header
            const zipContents: Record<string, Uint8Array> = {
                'contentv3.xml': new TextEncoder().encode(legacyXml),
                'resources/test.gif': gifData,
                'resources/other.webp': webpData,
            };

            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

            await importer.importFromZipContents(zipContents);

            // Get the HTML content and verify asset URLs are in new format
            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            const component = components.get(0) as Y.Map<unknown>;
            const htmlView = component.get('htmlView') as string;

            // Verify URLs are in new format: asset://uuid.ext (no slash after uuid)
            const assetUrlRegex = /asset:\/\/[a-z0-9./]+/gi;
            const assetUrls = htmlView.match(assetUrlRegex) || [];
            expect(assetUrls.length).toBeGreaterThan(0);

            for (const url of assetUrls) {
                // New format should NOT have slash after uuid: asset://uuid/something
                // Instead it should be asset://uuid.ext or asset://path.ext
                expect(url).not.toMatch(/asset:\/\/[a-f0-9-]{36}\//i);
            }

            ydoc.destroy();
        });
    });
});

describe('FileSystemAssetHandler', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `asset-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('storeAsset', () => {
        it('should store asset to filesystem', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const assetId = 'test-asset-123';
            const assetData = new Uint8Array([1, 2, 3, 4, 5]);
            const metadata = {
                filename: 'test.bin',
                mimeType: 'application/octet-stream',
            };

            const result = await handler.storeAsset(assetId, assetData, metadata);
            expect(result).toBe(assetId);

            // Verify file was created
            const filePath = path.join(testDir, 'resources', 'test.bin');
            expect(existsSync(filePath)).toBe(true);

            const storedData = await fs.readFile(filePath);
            expect(storedData.length).toBe(5);
        });

        it('should handle duplicate filenames', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const metadata = {
                filename: 'duplicate.txt',
                mimeType: 'text/plain',
            };

            await handler.storeAsset('id1', new Uint8Array([1]), metadata);
            await handler.storeAsset('id2', new Uint8Array([2]), metadata);

            // Both files should exist
            expect(existsSync(path.join(testDir, 'resources', 'duplicate.txt'))).toBe(true);
            expect(existsSync(path.join(testDir, 'resources', 'duplicate_1.txt'))).toBe(true);
        });
    });

    describe('extractAssetsFromZip', () => {
        it('should extract assets from ZIP object', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/image.png': new Uint8Array([137, 80, 78, 71]), // PNG header
                'resources/doc.pdf': new Uint8Array([37, 80, 68, 70]), // PDF header
                'content.xml': new Uint8Array([60, 63, 120, 109, 108]), // XML
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            // Should extract resources but not content.xml
            expect(assetMap.size).toBeGreaterThan(0);
            expect(assetMap.has('resources/image.png')).toBe(true);
            expect(assetMap.has('resources/doc.pdf')).toBe(true);
        });

        it('should skip non-asset directories', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'some-other-dir/file.txt': new Uint8Array([1, 2, 3]),
                'content.xml': new Uint8Array([60, 63]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            // Should not extract from non-asset directories
            expect(assetMap.has('some-other-dir/file.txt')).toBe(false);
        });

        it('should invoke progress callback for each asset during extraction', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/image1.png': new Uint8Array([137, 80, 78, 71]),
                'resources/image2.jpg': new Uint8Array([255, 216, 255, 224]),
                'resources/doc.pdf': new Uint8Array([37, 80, 68, 70]),
                'content.xml': new Uint8Array([60, 63, 120, 109, 108]),
            };

            const progressCalls: { current: number; total: number; filename: string }[] = [];

            await handler.extractAssetsFromZip(zip, (current, total, filename) => {
                progressCalls.push({ current, total, filename });
            });

            // Should have exactly 3 progress calls (one per asset)
            expect(progressCalls.length).toBe(3);

            // Total should be consistent across all calls
            expect(progressCalls[0].total).toBe(3);
            expect(progressCalls[1].total).toBe(3);
            expect(progressCalls[2].total).toBe(3);

            // Current should increment from 1 to 3
            expect(progressCalls[0].current).toBe(1);
            expect(progressCalls[1].current).toBe(2);
            expect(progressCalls[2].current).toBe(3);

            // Filenames should be the base names of the assets
            const filenames = progressCalls.map(p => p.filename);
            expect(filenames).toContain('image1.png');
            expect(filenames).toContain('image2.jpg');
            expect(filenames).toContain('doc.pdf');
        });
    });

    describe('convertContextPathToAssetRefs', () => {
        it('should convert context_path references to asset URLs', () => {
            const handler = new FileSystemAssetHandler(testDir);

            const assetMap = new Map<string, string>();
            assetMap.set('resources/image.png', 'uuid-123');
            assetMap.set('image.png', 'uuid-123');

            const html = '<img src="{{context_path}}/resources/image.png" />';
            const result = handler.convertContextPathToAssetRefs(html, assetMap);

            // The asset URL format is just asset://assetId (no filename suffix)
            // The export system resolves the full path using buildAssetExportPathMap
            expect(result).toContain('asset://uuid-123');
            expect(result).not.toContain('{{context_path}}');
        });

        it('should return unchanged html if no assets', () => {
            const handler = new FileSystemAssetHandler(testDir);

            const html = '<p>No assets here</p>';
            const result = handler.convertContextPathToAssetRefs(html, new Map());

            expect(result).toBe(html);
        });
    });
});
