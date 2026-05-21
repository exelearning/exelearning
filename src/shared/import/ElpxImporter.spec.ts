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

        it('should make incremental imports undoable when UndoManager tracks clientID origin', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const navigation = ydoc.getArray('navigation');
            const metadata = ydoc.getMap('metadata');

            // Seed one base page so clearExisting=false appends imported pages.
            ydoc.transact(() => {
                const basePage = new Y.Map();
                basePage.set('id', 'base-page');
                basePage.set('pageId', 'base-page');
                basePage.set('pageName', 'Base');
                basePage.set('title', 'Base');
                basePage.set('parentId', null);
                basePage.set('order', 0);
                basePage.set('blocks', new Y.Array());
                navigation.push([basePage]);
            }, ydoc.clientID);

            const undoManager = new Y.UndoManager([navigation, metadata], {
                trackedOrigins: new Set([ydoc.clientID]),
                captureTimeout: 0,
            });
            undoManager.clear();

            const importer = new ElpxImporter(ydoc, null, silentLogger);
            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer), { clearExisting: false });

            expect(result.pages).toBeGreaterThan(0);
            expect(navigation.length).toBe(1 + result.pages);
            expect(undoManager.undoStack.length).toBeGreaterThan(0);

            undoManager.undo();
            expect(navigation.length).toBe(1);

            undoManager.destroy();
            ydoc.destroy();
        });

        it('should make full project replacement import undoable when UndoManager tracks clientID origin', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const navigation = ydoc.getArray('navigation');
            const metadata = ydoc.getMap('metadata');

            // Seed previous project state to verify clearExisting import can be reverted.
            ydoc.transact(() => {
                const basePage = new Y.Map();
                basePage.set('id', 'base-page');
                basePage.set('pageId', 'base-page');
                basePage.set('pageName', 'Base');
                basePage.set('title', 'Base');
                basePage.set('parentId', null);
                basePage.set('order', 0);
                basePage.set('blocks', new Y.Array());
                navigation.push([basePage]);
                metadata.set('title', 'Base Project');
            }, ydoc.clientID);

            const undoManager = new Y.UndoManager([navigation, metadata], {
                trackedOrigins: new Set([ydoc.clientID]),
                captureTimeout: 0,
            });
            undoManager.clear();

            const importer = new ElpxImporter(ydoc, null, silentLogger);
            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer), { clearExisting: true });

            expect(result.pages).toBeGreaterThan(0);
            expect(navigation.length).toBe(result.pages);
            expect(metadata.get('title')).not.toBe('Base Project');
            expect(undoManager.undoStack.length).toBeGreaterThan(0);

            undoManager.undo();
            expect(navigation.length).toBe(1);
            expect(metadata.get('title')).toBe('Base Project');

            undoManager.destroy();
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

        it('should preserve escaped script-like text in text iDevice JSON properties', async () => {
            const textTextarea =
                'Text with the word &lt;script&gt; as plain text. Content after the marker must remain visible.';
            const jsonProperties = JSON.stringify({ textTextarea });
            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>base</value>
  </userPreference>
</userPreferences>
<odeResources></odeResources>
<odeProperties>
  <odeProperty>
    <key>pp_title</key>
    <value>Script Literal Test</value>
  </odeProperty>
</odeProperties>
<odeNavStructures>
  <odeNavStructure>
    <odePageId>page-1</odePageId>
    <odeParentPageId></odeParentPageId>
    <pageName>Page</pageName>
    <odeNavStructureOrder>0</odeNavStructureOrder>
    <odeNavStructureProperties></odeNavStructureProperties>
    <odePagStructures>
      <odePagStructure>
        <odePageId>page-1</odePageId>
        <odeBlockId>block-1</odeBlockId>
        <blockName>Text</blockName>
        <iconName></iconName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odePagStructureProperties></odePagStructureProperties>
        <odeComponents>
          <odeComponent>
            <odePageId>page-1</odePageId>
            <odeBlockId>block-1</odeBlockId>
            <odeIdeviceId>component-1</odeIdeviceId>
            <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
            <htmlView><![CDATA[${textTextarea}]]></htmlView>
            <jsonProperties><![CDATA[${jsonProperties}]]></jsonProperties>
            <odeComponentsOrder>0</odeComponentsOrder>
            <odeComponentsProperties>
              <odeComponentsProperty>
                <key>visibility</key>
                <value>true</value>
              </odeComponentsProperty>
            </odeComponentsProperties>
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>
</odeNavStructures>
</ode>`;

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await importer.importFromZipContents({
                'content.xml': new TextEncoder().encode(contentXml),
            });

            const navigation = ydoc.getArray('navigation');
            const page = navigation.get(0) as Y.Map<unknown>;
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown>;
            const component = components.get(0) as Y.Map<unknown>;
            const importedProps = JSON.parse(component.get('jsonProperties') as string) as { textTextarea: string };

            expect(importedProps.textTextarea).toBe(textTextarea);
            expect(importedProps.textTextarea).toContain('&lt;script&gt;');
            expect(importedProps.textTextarea).toContain('Content after the marker must remain visible.');
            expect(importedProps.textTextarea).not.toContain('<script>');

            ydoc.destroy();
        });
    });

    describe('top-level directory wrapper', () => {
        it('should import an ELP whose contents are nested under a single top-level directory', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            // Re-pack the fixture so every entry lives under "repo-main/" — this mirrors
            // the shape of a GitHub repository archive served by github-proxy.exelearning.dev.
            const fflate = await import('fflate');
            const originalEntries = fflate.unzipSync(new Uint8Array(elpBuffer));
            const wrapped: Record<string, Uint8Array> = {};
            for (const [path, data] of Object.entries(originalEntries)) {
                wrapped[`repo-main/${path}`] = data;
            }
            const wrappedBuffer = fflate.zipSync(wrapped);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const result = await importer.importFromBuffer(wrappedBuffer);

            expect(result.pages).toBeGreaterThan(0);
            expect(ydoc.getArray('navigation').length).toBe(result.pages);

            ydoc.destroy();
        });

        it('should not strip the prefix when files also live at the root', async () => {
            const fflate = await import('fflate');
            const zip = fflate.zipSync({
                'repo-main/unrelated.txt': new Uint8Array([1]),
                'README.md': new Uint8Array([2]),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            // No content.xml anywhere, and the root isn't a single-directory wrapper,
            // so the importer must still reject the archive.
            await expect(importer.importFromBuffer(zip)).rejects.toThrow(
                'Unable to open this file: content.xml is missing',
            );

            ydoc.destroy();
        });

        it('should not strip when there are multiple top-level directories', async () => {
            const fflate = await import('fflate');
            const zip = fflate.zipSync({
                'a/content.xml': new Uint8Array([1]),
                'b/other.txt': new Uint8Array([2]),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            await expect(importer.importFromBuffer(zip)).rejects.toThrow(
                'Unable to open this file: content.xml is missing',
            );

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

            await expect(importer.importFromBuffer(emptyZip)).rejects.toThrow(
                'Unable to open this file: content.xml is missing',
            );

            ydoc.destroy();
        });
    });

    describe('legacy ID remapping', () => {
        it('should remap legacy page IDs and preserve hierarchy mapping', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-4',
                    title: 'Root',
                    parent_id: null,
                    position: 0,
                    blocks: [],
                },
                {
                    id: 'page-5',
                    title: 'Child',
                    parent_id: 'page-4',
                    position: 0,
                    blocks: [],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, 'host-parent', 3);

            expect(pageStructures).toHaveLength(2);
            expect(pageStructures[0].id).not.toBe('page-4');
            expect(pageStructures[1].id).not.toBe('page-5');
            expect(pageStructures[0].parentId).toBe('host-parent');
            expect(pageStructures[0].order).toBe(3);
            expect(pageStructures[1].parentId).toBe(pageStructures[0].id);

            ydoc.destroy();
        });

        it('should remap block and component IDs for legacy imports', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-4',
                    title: 'Root',
                    parent_id: null,
                    position: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Main',
                            iconName: 'text',
                            position: 0,
                            blockProperties: {},
                            idevices: [
                                {
                                    id: 'idevice-2',
                                    type: 'text',
                                    title: 'Text',
                                    icon: 'text',
                                    position: 0,
                                    htmlView: '<p>Hello</p>',
                                    feedbackHtml: '',
                                    feedbackButton: '',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, null, 0);
            const block = pageStructures[0].blocks[0];
            const component = block.components[0];

            expect(block.id).not.toBe('block-1');
            expect(block.blockId).toBe(block.id);
            expect(component.id).not.toBe('idevice-2');
            expect(component.ideviceId).toBe(component.id);

            ydoc.destroy();
        });

        it('should remap exe-node: internal links in legacy import htmlView', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-1',
                    title: 'Home',
                    parent_id: null,
                    position: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Main',
                            iconName: 'text',
                            position: 0,
                            blockProperties: {},
                            idevices: [
                                {
                                    id: 'idevice-1',
                                    type: 'text',
                                    title: 'Text',
                                    icon: 'text',
                                    position: 0,
                                    htmlView: '<p><a href="exe-node:page-2#section1">Link to page 2</a></p>',
                                    feedbackHtml: '',
                                    feedbackButton: '',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page-2',
                    title: 'Second',
                    parent_id: null,
                    position: 1,
                    blocks: [],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, null, 0);

            // The new page-2 ID should not be 'page-2'
            const newPage2Id = pageStructures[1].id;
            expect(newPage2Id).not.toBe('page-2');

            // The link in page-1's component should reference the new ID
            const htmlView = pageStructures[0].blocks[0].components[0].htmlView;
            expect(htmlView).toContain(`exe-node:${newPage2Id}#section1`);
            expect(htmlView).not.toContain('exe-node:page-2');

            ydoc.destroy();
        });

        it('should remap exe-node: links without anchor fragment in legacy import', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-10',
                    title: 'Home',
                    parent_id: null,
                    position: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Main',
                            iconName: 'text',
                            position: 0,
                            blockProperties: {},
                            idevices: [
                                {
                                    id: 'idevice-1',
                                    type: 'text',
                                    title: 'Text',
                                    icon: 'text',
                                    position: 0,
                                    htmlView: '<p><a href="exe-node:page-20">Link to page 20</a></p>',
                                    feedbackHtml: '',
                                    feedbackButton: '',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page-20',
                    title: 'Target',
                    parent_id: null,
                    position: 1,
                    blocks: [],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, null, 0);

            const newPage20Id = pageStructures[1].id;
            expect(newPage20Id).not.toBe('page-20');

            const htmlView = pageStructures[0].blocks[0].components[0].htmlView;
            expect(htmlView).toContain(`exe-node:${newPage20Id}`);
            expect(htmlView).not.toContain('exe-node:page-20');

            ydoc.destroy();
        });

        it('should remap exe-node: internal links in properties.textTextarea for text idevices', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-7',
                    title: 'Home',
                    parent_id: null,
                    position: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Main',
                            iconName: 'text',
                            position: 0,
                            blockProperties: {},
                            idevices: [
                                {
                                    id: 'idevice-1',
                                    type: 'text',
                                    title: 'Text',
                                    icon: 'text',
                                    position: 0,
                                    htmlView: '<p><a href="exe-node:page-9">Go to page 9</a></p>',
                                    feedbackHtml: '',
                                    feedbackButton: '',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page-9',
                    title: 'Target Page',
                    parent_id: null,
                    position: 1,
                    blocks: [],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, null, 0);

            const newPage9Id = pageStructures[1].id;
            expect(newPage9Id).not.toBe('page-9');

            // htmlView should be remapped (already works)
            const htmlView = pageStructures[0].blocks[0].components[0].htmlView;
            expect(htmlView).toContain(`exe-node:${newPage9Id}`);
            expect(htmlView).not.toContain('exe-node:page-9');

            // properties.textTextarea must ALSO be remapped — this is what the workarea renders
            const props = pageStructures[0].blocks[0].components[0].properties;
            expect(props.textTextarea).toBeDefined();
            expect(props.textTextarea).toContain(`exe-node:${newPage9Id}`);
            expect(props.textTextarea).not.toContain('exe-node:page-9');

            ydoc.destroy();
        });

        it('should remap exe-node: links in nested properties objects', () => {
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);

            const legacyPages = [
                {
                    id: 'page-3',
                    title: 'Source',
                    parent_id: null,
                    position: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Main',
                            iconName: 'custom',
                            position: 0,
                            blockProperties: {},
                            idevices: [
                                {
                                    id: 'idevice-1',
                                    type: 'custom-idevice',
                                    title: 'Custom',
                                    icon: 'custom',
                                    position: 0,
                                    htmlView: '',
                                    feedbackHtml: '',
                                    feedbackButton: '',
                                    properties: {
                                        someField: '<a href="exe-node:page-5#intro">link</a>',
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page-5',
                    title: 'Target',
                    parent_id: null,
                    position: 1,
                    blocks: [],
                },
            ] as any;

            const pageStructures = (importer as any).convertLegacyPagesToPageData(legacyPages, null, 0);

            const newPage5Id = pageStructures[1].id;
            expect(newPage5Id).not.toBe('page-5');

            const props = pageStructures[0].blocks[0].components[0].properties;
            expect(props.someField).toContain(`exe-node:${newPage5Id}#intro`);
            expect(props.someField).not.toContain('exe-node:page-5');

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

        it('should make legacy incremental imports undoable when UndoManager tracks clientID origin', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const navigation = ydoc.getArray('navigation');
            const metadata = ydoc.getMap('metadata');

            ydoc.transact(() => {
                const basePage = new Y.Map();
                basePage.set('id', 'base-page');
                basePage.set('pageId', 'base-page');
                basePage.set('pageName', 'Base');
                basePage.set('title', 'Base');
                basePage.set('parentId', null);
                basePage.set('order', 0);
                basePage.set('blocks', new Y.Array());
                navigation.push([basePage]);
            }, ydoc.clientID);

            const undoManager = new Y.UndoManager([navigation, metadata], {
                trackedOrigins: new Set([ydoc.clientID]),
                captureTimeout: 0,
            });
            undoManager.clear();

            const importer = new ElpxImporter(ydoc, null, silentLogger);
            const result = await importer.importFromBuffer(new Uint8Array(elpBuffer), { clearExisting: false });

            expect(result.pages).toBeGreaterThan(0);
            expect(navigation.length).toBe(1 + result.pages);
            expect(undoManager.undoStack.length).toBeGreaterThan(0);

            undoManager.undo();
            expect(navigation.length).toBe(1);

            undoManager.destroy();
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

            await expect(importer.importFromZipContents(zipContents)).rejects.toThrow('content.xml is missing');

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

    describe('metadata clearing on re-import (clearExisting: true)', () => {
        it('should clear stale subtitle/footer/extraHeadContent/theme when importing a project without them', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/basic-example.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');

            // Simulate stale values from a previous project
            metadata.set('subtitle', 'Old Subtitle');
            metadata.set('footer', 'Old Footer');
            metadata.set('extraHeadContent', '<meta name="old">');
            metadata.set('theme', 'fancy-theme');

            // Import a project that does NOT have these fields set (basic-example.elp)
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            // Stale values should be cleared (set to empty/undefined/default), not persist
            expect(metadata.get('subtitle')).toBeFalsy();
            expect(metadata.get('footer')).toBeFalsy();
            expect(metadata.get('extraHeadContent')).toBeFalsy();
            // Theme should fall back to 'base' when not set in the imported file
            expect(metadata.get('theme')).toBe('base');
            // Title should be set from the imported file
            expect(metadata.get('title')).toBe('Main title');

            ydoc.destroy();
        });

        it('should clear stale subtitle/footer/extraHeadContent when importing legacy format', async () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Legacy Project"/>
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
            const metadata = ydoc.getMap('metadata');

            // Simulate stale values from a previous project
            metadata.set('subtitle', 'Old Subtitle');
            metadata.set('footer', 'Old Footer');
            metadata.set('extraHeadContent', '<meta name="old">');
            metadata.set('theme', 'fancy-theme');

            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromZipContents(zipContents);

            // Legacy format should clear stale values
            expect(metadata.get('subtitle')).toBe('');
            expect(metadata.get('footer')).toBeFalsy();
            expect(metadata.get('extraHeadContent')).toBeFalsy();
            expect(metadata.get('theme')).toBe('base');
            expect(metadata.get('title')).toBe('Legacy Project');

            ydoc.destroy();
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

describe('ElpxImporter - exe-node link remapping on import', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `elp-anchor-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should keep exe-node: cross-page anchor links pointing at the imported pages when importing anchors.zip', async () => {
        const elpPath = path.join(process.cwd(), 'test/fixtures/anchors.zip');
        const elpBuffer = await fs.readFile(elpPath);

        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        await importer.importFromBuffer(new Uint8Array(elpBuffer));

        const navigation = ydoc.getArray('navigation');
        expect(navigation.length).toBe(3); // aaa, bbb, ccc

        // Collect imported page IDs and the HTML content of components
        const importedPageIds: string[] = [];
        const allHtmlContent: string[] = [];

        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            importedPageIds.push((page.get('id') as string) || (page.get('pageId') as string));

            const blocks = page.get('blocks') as Y.Array<unknown>;
            for (let j = 0; j < (blocks?.length ?? 0); j++) {
                const block = blocks.get(j) as Y.Map<unknown>;
                const components = block.get('components') as Y.Array<unknown>;
                for (let k = 0; k < (components?.length ?? 0); k++) {
                    const comp = components.get(k) as Y.Map<unknown>;
                    const html = comp.get('htmlView') as string;
                    if (html) allHtmlContent.push(html);
                }
            }
        }

        const combinedHtml = allHtmlContent.join('\n');

        // After the v4 ID preservation fix, internal exe-node: links should
        // continue to point at the (preserved) imported page IDs. At least one
        // of the imported page IDs must appear as the target of an exe-node link.
        const hasResolvedLink = importedPageIds.some(id => combinedHtml.includes(`exe-node:${id}`));
        expect(hasResolvedLink).toBe(true);

        // No dangling exe-node: link should reference an ID that is not in
        // the imported navigation (collision-only remap still applies in
        // merge-mode imports, but this fixture is a fresh import).
        // Match every char the importer's boundary considers part of an id
        // (mirrors the (?![A-Za-z0-9_-]) lookahead in remapInternalPageLinks).
        const linkPattern = /exe-node:([a-zA-Z0-9_-]+)/g;
        const referencedIds = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = linkPattern.exec(combinedHtml)) !== null) {
            referencedIds.add(m[1]);
        }
        for (const refId of referencedIds) {
            expect(importedPageIds).toContain(refId);
        }

        ydoc.destroy();
    });

    it('should preserve anchor fragments when remapping exe-node: links', async () => {
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        // Build a minimal ELP with two pages where page 1 links to page 2 with an anchor
        const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>Anchor Test</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>original-page-aaa</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-aaa-1</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>comp-aaa-1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <odeComponentOrder>0</odeComponentOrder>
          <htmlView><![CDATA[<p><a href="exe-node:original-page-bbb#my-anchor">Link with anchor</a></p>]]></htmlView>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
<odeNavStructure>
  <odePageId>original-page-bbb</odePageId>
  <odeParentPageId>original-page-aaa</odeParentPageId>
  <pageName>Page B</pageName>
  <odeNavStructureOrder>1</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zipData = fflate.zipSync({
            'content.xml': encoder.encode(contentXml),
        });

        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);
        await importer.importFromBuffer(zipData);

        const navigation = ydoc.getArray('navigation');
        expect(navigation.length).toBe(2);

        const pageB = navigation.get(1) as Y.Map<unknown>;
        const newPageBId = (pageB.get('id') ?? pageB.get('pageId')) as string;
        // After the v4 ID preservation fix, a fresh import keeps the original
        // <odePageId> verbatim, so the imported Page B id equals the XML id.
        expect(newPageBId).toBe('original-page-bbb');

        // Get the component HTML from page A
        const pageA = navigation.get(0) as Y.Map<unknown>;
        const blocks = pageA.get('blocks') as Y.Array<unknown>;
        const block = blocks.get(0) as Y.Map<unknown>;
        const components = block.get('components') as Y.Array<unknown>;
        const comp = components.get(0) as Y.Map<unknown>;
        const html = comp.get('htmlView') as string;

        // Link must reference the imported page id and preserve the fragment.
        expect(html).toContain(`exe-node:${newPageBId}#my-anchor`);

        ydoc.destroy();
    });

    it('should remove legacy exe-text wrapper from JsIdevice htmlView and jsonProperties textTextarea', async () => {
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>JsIdevice Wrapper Test</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-a-1</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>comp-a-1</odeIdeviceId>
          <odeIdeviceTypeName>JsIdevice</odeIdeviceTypeName>
          <odeComponentOrder>0</odeComponentOrder>
          <htmlView><![CDATA[<div class="exe-text"><p>HTML content</p></div>]]></htmlView>
          <jsonProperties><![CDATA[{"textTextarea":"&lt;div class=&quot;exe-text&quot;&gt;&lt;p&gt;JSON content&lt;/p&gt;&lt;/div&gt;","htmlView":"&lt;div class=&quot;exe-text&quot;&gt;&lt;p&gt;JSON htmlView&lt;/p&gt;&lt;/div&gt;"}]]></jsonProperties>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zipData = fflate.zipSync({
            'content.xml': encoder.encode(contentXml),
        });

        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);
        await importer.importFromBuffer(zipData);

        const navigation = ydoc.getArray('navigation');
        const page = navigation.get(0) as Y.Map<unknown>;
        const blocks = page.get('blocks') as Y.Array<unknown>;
        const block = blocks.get(0) as Y.Map<unknown>;
        const components = block.get('components') as Y.Array<unknown>;
        const comp = components.get(0) as Y.Map<unknown>;

        const html = comp.get('htmlView') as string;
        expect(html).toBe('<p>HTML content</p>');
        expect(html).not.toContain('class="exe-text"');

        const rawJson = comp.get('jsonProperties') as string;
        const props = JSON.parse(rawJson) as { textTextarea?: string };
        expect(props.textTextarea).toBe('<p>JSON content</p>');
        expect(props.textTextarea).not.toContain('class="exe-text"');
        expect((props as Record<string, string>).htmlView).toBe('<p>JSON htmlView</p>');
        expect((props as Record<string, string>).htmlView).not.toContain('class="exe-text"');

        ydoc.destroy();
    });

    it('should unwrap exe-text and preserve trailing feedback siblings in text htmlView', async () => {
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>Text Wrapper Test</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-a-1</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>comp-a-1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <odeComponentOrder>0</odeComponentOrder>
          <htmlView><![CDATA[<div class="exe-text"><p>Main</p></div><div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Info" /></div><div class="feedback js-feedback js-hidden">Info content</div>]]></htmlView>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zipData = fflate.zipSync({ 'content.xml': encoder.encode(contentXml) });

        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);
        await importer.importFromBuffer(zipData);

        const navigation = ydoc.getArray('navigation');
        const page = navigation.get(0) as Y.Map<unknown>;
        const blocks = page.get('blocks') as Y.Array<unknown>;
        const block = blocks.get(0) as Y.Map<unknown>;
        const components = block.get('components') as Y.Array<unknown>;
        const comp = components.get(0) as Y.Map<unknown>;

        const html = comp.get('htmlView') as string;
        expect(html).toContain('<p>Main</p>');
        expect(html).toContain('iDevice_buttons feedback-button');
        expect(html).toContain('Info content');
        expect(html).not.toContain('<div class="exe-text">');

        ydoc.destroy();
    });

    // =========================================================================
    // Screenshot import tests
    // =========================================================================
    describe('screenshot import', () => {
        // Minimal valid 1x1 PNG (binary)
        const MINIMAL_PNG_BYTES = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
            0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2,
            0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ]);

        const MINIMAL_CONTENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>Screenshot Test</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-1</odePageId>
  <pageName>Home</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures/>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        it('should import screenshot.png from archive root into metadata', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(MINIMAL_CONTENT_XML),
                'screenshot.png': MINIMAL_PNG_BYTES,
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const screenshot = metadata.get('screenshot') as string;
            expect(screenshot).toBeDefined();
            expect(screenshot).toContain('data:image/png;base64,');

            ydoc.destroy();
        });

        it('should work without screenshot.png (backward compatibility)', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(MINIMAL_CONTENT_XML),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const screenshot = metadata.get('screenshot');
            expect(screenshot).toBeUndefined();

            // Other metadata should still be set
            expect(metadata.get('title')).toBe('Screenshot Test');

            ydoc.destroy();
        });

        it('should store screenshot as valid base64 data URL that round-trips', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(MINIMAL_CONTENT_XML),
                'screenshot.png': MINIMAL_PNG_BYTES,
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const screenshot = metadata.get('screenshot') as string;

            // Verify the base64 can be decoded back to original bytes
            const base64Part = screenshot.split(',')[1];
            const decoded = atob(base64Part);
            const roundTripped = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                roundTripped[i] = decoded.charCodeAt(i);
            }
            // Check PNG signature is preserved
            expect(roundTripped[0]).toBe(0x89);
            expect(roundTripped[1]).toBe(0x50);
            expect(roundTripped[2]).toBe(0x4e);
            expect(roundTripped[3]).toBe(0x47);

            ydoc.destroy();
        });
    });

    describe('odeResources preservation', () => {
        it('should populate metadata.odeIdentifier and metadata.odeVersionId from <odeResources> on v4 import', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>20251201123456ABCDEF</value></odeResource>
  <odeResource><key>odeVersionId</key><value>20251201123456FEDCBA</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>OdeResources Preservation</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(contentXml),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('odeIdentifier')).toBe('20251201123456ABCDEF');
            expect(metadata.get('odeVersionId')).toBe('20251201123456FEDCBA');

            ydoc.destroy();
        });

        it('should tolerate missing <odeResources> block on v4 import', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            // v4-style content.xml WITHOUT odeResources
            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>No OdeResources</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(contentXml),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const odeId = metadata.get('odeIdentifier');
            const odeVersionId = metadata.get('odeVersionId');
            // Either undefined or empty string — export-side fallback will fill them in.
            expect(odeId === undefined || odeId === '').toBe(true);
            expect(odeVersionId === undefined || odeVersionId === '').toBe(true);

            ydoc.destroy();
        });

        it('should still populate metadata.odeIdentifier when <odeProperties> is absent (DTD edge case)', async () => {
            // The DTD makes <odeProperties> optional. A valid v4 content.xml
            // may carry <odeResources> alone. Stable identifiers must reach the
            // Y.Doc metadata regardless of whether <odeProperties> exists.
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>20251201123456ABCDEF</value></odeResource>
  <odeResource><key>odeVersionId</key><value>20251201123456FEDCBA</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0.0</value></odeResource>
</odeResources>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(contentXml),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('odeIdentifier')).toBe('20251201123456ABCDEF');
            expect(metadata.get('odeVersionId')).toBe('20251201123456FEDCBA');

            ydoc.destroy();
        });

        it('should round-trip scormIdentifier through <odeResources> (#1786)', async () => {
            // The user-set SCORM override survives ELPX download-and-reopen so
            // re-exports keep using the same manifest@identifier the LMS expects.
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>20251201123456ABCDEF</value></odeResource>
  <odeResource><key>odeVersionId</key><value>20251201123456FEDCBA</value></odeResource>
  <odeResource><key>scormIdentifier</key><value>LMS-COURSE-XYZ</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>SCORM ID round-trip</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({ 'content.xml': encoder.encode(contentXml) });
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('scormIdentifier')).toBe('LMS-COURSE-XYZ');

            ydoc.destroy();
        });

        it('should populate odeIdentifier even when odeVersionId is missing (partial odeResources)', async () => {
            // Partial resources -- importer keeps odeId, leaves odeVersionId
            // unset so the exporter's fallback generates a fresh value.
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>20251201123456ABCDEF</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Partial</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({ 'content.xml': encoder.encode(contentXml) });
            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            expect(metadata.get('odeIdentifier')).toBe('20251201123456ABCDEF');
            const versionId = metadata.get('odeVersionId');
            expect(versionId === undefined || versionId === '').toBe(true);

            ydoc.destroy();
        });

        it('should tolerate empty <odeResources> block on v4 import', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources></odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Empty OdeResources</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(contentXml),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const odeId = metadata.get('odeIdentifier');
            const odeVersionId = metadata.get('odeVersionId');
            expect(odeId === undefined || odeId === '').toBe(true);
            expect(odeVersionId === undefined || odeVersionId === '').toBe(true);

            ydoc.destroy();
        });

        it('should generate odeIdentifier and odeVersionId once on legacy v3 import', async () => {
            const elpPath = path.join(process.cwd(), 'test/fixtures/old_tema-10-ejemplo.elp');
            const elpBuffer = await fs.readFile(elpPath);

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(new Uint8Array(elpBuffer));

            const metadata = ydoc.getMap('metadata');
            const odeId = metadata.get('odeIdentifier') as string;
            const odeVersionId = metadata.get('odeVersionId') as string;
            expect(typeof odeId).toBe('string');
            expect(typeof odeVersionId).toBe('string');
            expect(odeId).toMatch(/^\d{14}[A-Z0-9]{6}$/);
            expect(odeVersionId).toMatch(/^\d{14}[A-Z0-9]{6}$/);

            ydoc.destroy();
        });

        it('should round-trip odeId and odeVersionId through import -> generateOdeXml -> re-parse', async () => {
            const fflate = await import('fflate');
            const encoder = new TextEncoder();
            const { generateOdeXml } = await import('../export/generators/OdeXmlGenerator');

            const inputOdeId = '20251201123456ABCDEF';
            const inputOdeVersionId = '20251201123456FEDCBA';

            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>${inputOdeId}</value></odeResource>
  <odeResource><key>odeVersionId</key><value>${inputOdeVersionId}</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Round Trip</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-a</odePageId>
  <pageName>Page A</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

            const zipData = fflate.zipSync({
                'content.xml': encoder.encode(contentXml),
            });

            const ydoc = new Y.Doc();
            const importer = new ElpxImporter(ydoc, null, silentLogger);
            await importer.importFromBuffer(zipData);

            const metadata = ydoc.getMap('metadata');
            const exportedXml = generateOdeXml(
                {
                    title: 'Round Trip',
                    author: '',
                    language: 'en',
                    theme: 'base',
                    odeIdentifier: metadata.get('odeIdentifier') as string,
                    odeVersionId: metadata.get('odeVersionId') as string,
                },
                [],
            );

            const odeIdMatch = exportedXml.match(/<key>odeId<\/key>\s*<value>([^<]+)<\/value>/);
            const odeVersionIdMatch = exportedXml.match(/<key>odeVersionId<\/key>\s*<value>([^<]+)<\/value>/);
            expect(odeIdMatch).not.toBeNull();
            expect(odeVersionIdMatch).not.toBeNull();
            expect(odeIdMatch![1]).toBe(inputOdeId);
            expect(odeVersionIdMatch![1]).toBe(inputOdeVersionId);

            ydoc.destroy();
        });
    });
});

describe('ElpxImporter - id preservation across v4 import', () => {
    // Minimal v4 content.xml with two sibling root pages, each with one block + one iDevice.
    // IDs use the canonical "Format A" shape produced by the workarea.
    const PAGE_A = 'page-mp0fppwf-71v64kl4r';
    const PAGE_B = 'page-mp0fppwf-71v64kl4s';
    const BLOCK_A = 'block-mp0fppwf-blkaaaaaa';
    const BLOCK_B = 'block-mp0fppwf-blkbbbbbb';
    const IDEVICE_A = 'idevice-mp0fppwf-idvaaaaaa';
    const IDEVICE_B = 'idevice-mp0fppwf-idvbbbbbb';

    const buildV4ContentXml = (pageAId = PAGE_A, pageBId = PAGE_B): string => `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>ID Preservation Test</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
  <odeNavStructure>
    <odePageId>${pageAId}</odePageId>
    <odeParentPageId></odeParentPageId>
    <pageName>Page A</pageName>
    <odeNavStructureOrder>0</odeNavStructureOrder>
    <odePagStructures>
      <odePagStructure>
        <odePageId>${pageAId}</odePageId>
        <odeBlockId>${BLOCK_A}</odeBlockId>
        <blockName>BlockA</blockName>
        <iconName></iconName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odeComponents>
          <odeComponent>
            <odePageId>${pageAId}</odePageId>
            <odeBlockId>${BLOCK_A}</odeBlockId>
            <odeIdeviceId>${IDEVICE_A}</odeIdeviceId>
            <odeIdeviceTypeName>text</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Hello A with <a href="exe-node:${pageBId}">link</a></p>]]></htmlView>
            <jsonProperties><![CDATA[{"ideviceId":"${IDEVICE_A}","textTextarea":"<p>Hello A</p>"}]]></jsonProperties>
            <odeComponentsOrder>0</odeComponentsOrder>
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>
  <odeNavStructure>
    <odePageId>${pageBId}</odePageId>
    <odeParentPageId></odeParentPageId>
    <pageName>Page B</pageName>
    <odeNavStructureOrder>1</odeNavStructureOrder>
    <odePagStructures>
      <odePagStructure>
        <odePageId>${pageBId}</odePageId>
        <odeBlockId>${BLOCK_B}</odeBlockId>
        <blockName>BlockB</blockName>
        <iconName></iconName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odeComponents>
          <odeComponent>
            <odePageId>${pageBId}</odePageId>
            <odeBlockId>${BLOCK_B}</odeBlockId>
            <odeIdeviceId>${IDEVICE_B}</odeIdeviceId>
            <odeIdeviceTypeName>text</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Hello B</p>]]></htmlView>
            <jsonProperties><![CDATA[{"ideviceId":"${IDEVICE_B}","textTextarea":"<p>Hello B</p>"}]]></jsonProperties>
            <odeComponentsOrder>0</odeComponentsOrder>
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>
</odeNavStructures>
</ode>`;

    it('fresh-import preserves <odePageId> values verbatim', async () => {
        const zipContents: Record<string, Uint8Array> = {
            'content.xml': new TextEncoder().encode(buildV4ContentXml()),
        };

        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);

        await importer.importFromZipContents(zipContents, { clearExisting: true });

        const navigation = ydoc.getArray('navigation');
        expect(navigation.length).toBe(2);

        const importedIds = new Set<string>();
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            importedIds.add(page.get('id') as string);
            // pageId mirror field must also match
            expect(page.get('pageId')).toBe(page.get('id'));
        }
        expect(importedIds.has(PAGE_A)).toBe(true);
        expect(importedIds.has(PAGE_B)).toBe(true);

        ydoc.destroy();
    });

    it('fresh-import preserves <odeBlockId> and <odeIdeviceId> values verbatim', async () => {
        const zipContents: Record<string, Uint8Array> = {
            'content.xml': new TextEncoder().encode(buildV4ContentXml()),
        };

        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);

        await importer.importFromZipContents(zipContents, { clearExisting: true });

        const navigation = ydoc.getArray('navigation');
        // Locate Page A by its preserved id
        let pageA: Y.Map<unknown> | null = null;
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            if (page.get('id') === PAGE_A) {
                pageA = page;
                break;
            }
        }
        expect(pageA).not.toBeNull();

        const blocks = pageA!.get('blocks') as Y.Array<unknown>;
        expect(blocks.length).toBe(1);
        const block = blocks.get(0) as Y.Map<unknown>;
        expect(block.get('id')).toBe(BLOCK_A);
        expect(block.get('blockId')).toBe(BLOCK_A);

        const components = block.get('components') as Y.Array<unknown>;
        expect(components.length).toBe(1);
        const component = components.get(0) as Y.Map<unknown>;
        expect(component.get('id')).toBe(IDEVICE_A);
        expect(component.get('ideviceId')).toBe(IDEVICE_A);

        ydoc.destroy();
    });

    it('merge-mode collision remaps the page id and updates exe-node: links', async () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        // Pre-populate the navigation with a page that collides with PAGE_B
        ydoc.transact(() => {
            const existing = new Y.Map();
            existing.set('id', PAGE_B);
            existing.set('pageId', PAGE_B);
            existing.set('pageName', 'Pre-existing');
            existing.set('title', 'Pre-existing');
            existing.set('parentId', null);
            existing.set('order', 0);
            existing.set('blocks', new Y.Array());
            navigation.push([existing]);
        });

        const zipContents: Record<string, Uint8Array> = {
            'content.xml': new TextEncoder().encode(buildV4ContentXml()),
        };

        const importer = new ElpxImporter(ydoc, null, silentLogger);
        await importer.importFromZipContents(zipContents, { clearExisting: false });

        // navigation now has: pre-existing page + 2 imported pages
        expect(navigation.length).toBe(3);

        // Find the imported pages (skip the pre-existing one at index 0)
        const importedAId = (navigation.get(1) as Y.Map<unknown>).get('id') as string;
        const importedBId = (navigation.get(2) as Y.Map<unknown>).get('id') as string;

        // Page A had no collision -> preserved verbatim
        expect(importedAId).toBe(PAGE_A);

        // Page B collided -> must have been regenerated
        expect(importedBId).not.toBe(PAGE_B);
        expect(importedBId.startsWith('page-')).toBe(true);

        // The internal link inside Page A's iDevice that pointed at PAGE_B must
        // have been rewritten to the new imported B id (not the pre-existing one).
        const importedA = navigation.get(1) as Y.Map<unknown>;
        const blocks = importedA.get('blocks') as Y.Array<unknown>;
        const block = blocks.get(0) as Y.Map<unknown>;
        const components = block.get('components') as Y.Array<unknown>;
        const component = components.get(0) as Y.Map<unknown>;
        const htmlView = component.get('htmlView') as string;

        expect(htmlView).toContain(`exe-node:${importedBId}`);
        expect(htmlView).not.toContain(`exe-node:${PAGE_B}"`);

        ydoc.destroy();
    });

    it('legacy v3 contentv3.xml path still regenerates page IDs', async () => {
        // Legacy IDs are short non-namespaced strings; they collide trivially across
        // documents, so the v3 path must keep regenerating. This pins the v3/v4 boundary.
        const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Legacy"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root"/>
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
        await importer.importFromZipContents(zipContents, { clearExisting: true });

        const navigation = ydoc.getArray('navigation');
        expect(navigation.length).toBeGreaterThan(0);
        const page = navigation.get(0) as Y.Map<unknown>;
        const id = page.get('id') as string;

        // The legacy parser uses ids like "page-1" / "node-..." internally;
        // the importer must replace them with freshly generated namespaced ids.
        expect(id.startsWith('page-')).toBe(true);
        // Generated ids include the timestamp segment, so the id is longer than "page-1".
        expect(id.length).toBeGreaterThan('page-1'.length + 4);

        ydoc.destroy();
    });
});

describe('ElpxImporter - remapInternalPageLinks prefix-collision safety', () => {
    it('does not partially remap when one page id is a prefix of another (page-1 vs page-10)', async () => {
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        // Two pages with prefix-colliding short ids; page-1 carries a link to page-10.
        // After a merge-mode collision both ids get remapped via idRemap. The link
        // must remap to the new <page-10> id verbatim -- not to the new <page-1> id
        // plus a trailing "0", which is what a naive alternation regex produces.
        const buildContent = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>Prefix collision</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-1</odePageId>
  <pageName>Page 1</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-1</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>idevice-1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView>&lt;p&gt;&lt;a href="exe-node:page-10"&gt;Go to page 10&lt;/a&gt;&lt;/p&gt;</htmlView>
          <odeComponentOrder>0</odeComponentOrder>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
<odeNavStructure>
  <odePageId>page-10</odePageId>
  <pageName>Page 10</pageName>
  <odeNavStructureOrder>1</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zipData = fflate.zipSync({ 'content.xml': encoder.encode(buildContent()) });
        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);

        // First import preserves page-1 and page-10 verbatim (fresh doc, no collision).
        await importer.importFromBuffer(zipData, { clearExisting: true });
        // Second import collides on both ids -> both get remapped, link must follow.
        await importer.importFromBuffer(zipData, { clearExisting: false });

        const navigation = ydoc.getArray('navigation');
        const idsByName = new Map<string, string>();
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            idsByName.set((page.get('pageName') ?? page.get('title')) as string, page.get('id') as string);
        }
        // Sanity: first import kept the originals, second created two new ids -> 4 pages.
        expect(navigation.length).toBe(4);

        // Find the htmlView that originated from the SECOND import (its links must
        // have been remapped). It's on the remapped "Page 1" -- not on the original.
        let remappedLink: string | null = null;
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            const pageId = page.get('id') as string;
            if (pageId === 'page-1') continue; // skip the originals from first import
            const blocks = page.get('blocks') as Y.Array<unknown>;
            for (let j = 0; j < (blocks?.length ?? 0); j++) {
                const block = blocks.get(j) as Y.Map<unknown>;
                const components = block.get('components') as Y.Array<unknown>;
                for (let k = 0; k < (components?.length ?? 0); k++) {
                    const comp = components.get(k) as Y.Map<unknown>;
                    const html = comp.get('htmlView') as string | undefined;
                    if (html?.includes('exe-node:')) {
                        remappedLink = html;
                    }
                }
            }
        }
        expect(remappedLink).not.toBeNull();

        // Find the second-import id for page-10 (not equal to the original "page-10").
        const newPage10Ids: string[] = [];
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<unknown>;
            const id = page.get('id') as string;
            const name = page.get('pageName') as string;
            if (name === 'Page 10' && id !== 'page-10') newPage10Ids.push(id);
        }
        expect(newPage10Ids.length).toBe(1);
        const newPage10 = newPage10Ids[0];

        // Bug pinned: the link must point at the new page-10 id, exactly.
        expect(remappedLink).toContain(`exe-node:${newPage10}`);
        // ...and must NOT contain a partial remap leaving a stray "0" tail.
        // A naive alternation regex would produce e.g. exe-node:<new-page-1>0.
        const stray = /exe-node:[a-z0-9-]+0(?![a-z0-9-])/i;
        const matches = remappedLink!.match(stray);
        if (matches) {
            const m = matches[0];
            // Acceptable only if it equals the legitimate newPage10 link itself.
            expect(m).toBe(`exe-node:${newPage10}`);
        }

        ydoc.destroy();
    });

    it('rewrites embedded ideviceId in jsonProperties when the component is regenerated on collision', async () => {
        // Many iDevices serialise their own id inside jsonProperties (text/quiz
        // self-reference). When merge-mode forces the component to regenerate
        // its id, the JSON payload must follow -- otherwise the workarea would
        // try to resolve the old id and silently fail.
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>JSON remap</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-jp-1</odePageId>
  <pageName>Page</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-jp-1</odeBlockId>
      <blockName>Block</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>idevice-jp-1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView>&lt;p&gt;hi&lt;/p&gt;</htmlView>
          <jsonProperties>{"ideviceId":"idevice-jp-1","textTextarea":"&lt;p&gt;hi&lt;/p&gt;"}</jsonProperties>
          <odeComponentOrder>0</odeComponentOrder>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zip = fflate.zipSync({ 'content.xml': encoder.encode(xml) });
        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);

        // First import keeps idevice-jp-1 verbatim (fresh doc, no collision).
        await importer.importFromBuffer(zip, { clearExisting: true });
        // Second import collides on idevice-jp-1 -> regenerate.
        await importer.importFromBuffer(zip, { clearExisting: false });

        const nav = ydoc.getArray('navigation');
        // Locate the second-import copy of the component (its outer id is NOT
        // 'idevice-jp-1' because it was regenerated).
        let newCompId: string | null = null;
        let jsonProps: string | null = null;
        for (let i = 0; i < nav.length; i++) {
            const page = nav.get(i) as Y.Map<unknown>;
            if (page.get('id') === 'page-jp-1') continue; // skip first-import originals
            const blocks = page.get('blocks') as Y.Array<unknown>;
            if (!blocks?.length) continue;
            const block = blocks.get(0) as Y.Map<unknown>;
            const comps = block.get('components') as Y.Array<unknown>;
            const comp = comps.get(0) as Y.Map<unknown>;
            const compId = comp.get('id') as string;
            if (compId !== 'idevice-jp-1') {
                newCompId = compId;
                jsonProps = comp.get('jsonProperties') as string;
            }
        }
        expect(newCompId).not.toBeNull();
        expect(jsonProps).not.toBeNull();
        const parsed = JSON.parse(jsonProps as string);
        // Embedded ideviceId now points at the FRESH id, not the stale XML one.
        expect(parsed.ideviceId).toBe(newCompId);
        expect(parsed.ideviceId).not.toBe('idevice-jp-1');

        ydoc.destroy();
    });

    it('handles multi-level prefix nesting (page-1, page-10, page-100) without stray remaps', async () => {
        // Three ids where each is a prefix of the next. Belt-and-suspenders:
        // descending-length sort puts page-100 before page-10 before page-1 in
        // the alternation; the (?![A-Za-z0-9_-]) lookahead would still reject a
        // shorter match inside a longer id even if the sort regressed.
        const fflate = await import('fflate');
        const encoder = new TextEncoder();

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty><key>pp_title</key><value>Triple prefix</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-1</odePageId>
  <pageName>Page 1</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-multi-1</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>idevice-multi-1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView>&lt;p&gt;&lt;a href="exe-node:page-100"&gt;to 100&lt;/a&gt; &lt;a href="exe-node:page-10"&gt;to 10&lt;/a&gt;&lt;/p&gt;</htmlView>
          <odeComponentOrder>0</odeComponentOrder>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
<odeNavStructure>
  <odePageId>page-10</odePageId>
  <pageName>Page 10</pageName>
  <odeNavStructureOrder>1</odeNavStructureOrder>
</odeNavStructure>
<odeNavStructure>
  <odePageId>page-100</odePageId>
  <pageName>Page 100</pageName>
  <odeNavStructureOrder>2</odeNavStructureOrder>
</odeNavStructure>
</odeNavStructures>
</ode>`;

        const zip = fflate.zipSync({ 'content.xml': encoder.encode(xml) });
        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);
        await importer.importFromBuffer(zip, { clearExisting: true });
        // Second import forces full remap of all three ids.
        await importer.importFromBuffer(zip, { clearExisting: false });

        const nav = ydoc.getArray('navigation');
        // Map "Page N" -> the FRESH id (the one that's not equal to the original).
        const fresh = new Map<string, string>();
        for (let i = 0; i < nav.length; i++) {
            const page = nav.get(i) as Y.Map<unknown>;
            const id = page.get('id') as string;
            const name = page.get('pageName') as string;
            if (id !== `page-${name.replace('Page ', '')}`) fresh.set(name, id);
        }
        expect(fresh.size).toBe(3);

        // Find the remapped htmlView on the second-import copy of page-1.
        let remapped: string | null = null;
        for (let i = 0; i < nav.length; i++) {
            const page = nav.get(i) as Y.Map<unknown>;
            if (page.get('pageName') !== 'Page 1') continue;
            if (page.get('id') === 'page-1') continue; // skip the original (first import)
            const blocks = page.get('blocks') as Y.Array<unknown>;
            const block = blocks.get(0) as Y.Map<unknown>;
            const comps = block.get('components') as Y.Array<unknown>;
            const html = (comps.get(0) as Y.Map<unknown>).get('htmlView') as string;
            remapped = html;
        }
        expect(remapped).not.toBeNull();

        // Each link must point at the EXACT fresh id of its target page --
        // no stray "0" or "00" tail from a shorter-prefix partial match.
        expect(remapped).toContain(`exe-node:${fresh.get('Page 100')}`);
        expect(remapped).toContain(`exe-node:${fresh.get('Page 10')}`);
        expect(remapped).not.toContain(`exe-node:${fresh.get('Page 1')}0`);
        expect(remapped).not.toContain(`exe-node:${fresh.get('Page 10')}0`);

        ydoc.destroy();
    });
});
