/**
 * Integration round-trip tests for internal links (#1927).
 *
 * Proves the full export → re-import cycle: a project with an `exe-node:` internal link
 * is exported (ELPX / HTML5 / IMS), the resulting package is fed back through the real
 * ElpxImporter, and the imported document must still carry `exe-node:` references — not the
 * static export path. Before the fix, content.xml persisted `html/about.html`, which the
 * importer cannot map back, silently breaking the link.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import { zipSync, strToU8 } from 'fflate';

import { ElpxExporter } from '../../../src/shared/export/exporters/ElpxExporter';
import { Html5Exporter } from '../../../src/shared/export/exporters/Html5Exporter';
import { ImsExporter } from '../../../src/shared/export/exporters/ImsExporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
} from '../../../src/shared/export/interfaces';
import { ElpxImporter } from '../../../src/shared/import/ElpxImporter';
import { FileSystemAssetHandler } from '../../../src/shared/import/FileSystemAssetHandler';
import type { Logger } from '../../../src/shared/import/interfaces';

const silentLogger: Logger = { log: () => {}, warn: () => {}, error: () => {} };

class MockDocument implements ExportDocument {
    constructor(
        private metadata: ExportMetadata,
        private pages: ExportPage[],
    ) {}
    getMetadata(): ExportMetadata {
        return this.metadata;
    }
    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

class MockResourceProvider implements ResourceProvider {
    async fetchTheme(): Promise<Map<string, Buffer>> {
        return new Map([['style.css', Buffer.from('/* css */')]]);
    }
    async fetchIdeviceResources(): Promise<Map<string, Buffer>> {
        return new Map();
    }
    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        return new Map();
    }
    async fetchLibraryFiles(): Promise<Map<string, Buffer>> {
        return new Map();
    }
    async fetchScormFiles(): Promise<Map<string, Buffer>> {
        return new Map();
    }
    normalizeIdeviceType(type: string): string {
        return type.toLowerCase().replace(/idevice$/i, '');
    }
    async fetchExeLogo(): Promise<Buffer | null> {
        return null;
    }
    async fetchContentCss(): Promise<Map<string, Buffer>> {
        return new Map([['content/css/base.css', Buffer.from('/* base */')]]);
    }
    async fetchI18nFile(): Promise<string> {
        return '';
    }
    async fetchI18nTranslations(): Promise<Map<string, string>> {
        return new Map();
    }
}

class MockAssetProvider implements AssetProvider {
    async getAsset(): Promise<Buffer | null> {
        return null;
    }
    async getAllAssets(): Promise<
        Array<{ id: string; filename: string; path: string; mimeType: string; data: Buffer }>
    > {
        return [];
    }
}

class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();
    addFile(p: string, c: string | Buffer): void {
        this.files.set(p, c);
    }
    hasFile(p: string): boolean {
        return this.files.has(p);
    }
    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }
    async generateAsync(): Promise<Buffer> {
        const data: Record<string, Uint8Array> = {};
        for (const [p, c] of this.files) {
            data[p] = typeof c === 'string' ? strToU8(c) : new Uint8Array(c);
        }
        return Buffer.from(zipSync(data));
    }
}

function makeLinkedPages(): ExportPage[] {
    return [
        {
            id: 'page-1',
            title: 'Home',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Content Block',
                    order: 0,
                    components: [
                        {
                            id: 'comp-1',
                            type: 'FreeTextIdevice',
                            order: 0,
                            content:
                                '<p>Go to <a href="exe-node:page-2">About</a> and <a href="exe-node:page-2#sec">a section</a>.</p>',
                        },
                    ],
                },
            ],
        },
        {
            id: 'page-2',
            title: 'About',
            parentId: null,
            order: 1,
            blocks: [
                {
                    id: 'block-2',
                    name: 'Content Block',
                    order: 0,
                    components: [
                        {
                            id: 'comp-2',
                            type: 'FreeTextIdevice',
                            order: 0,
                            content: '<p>Back to <a href="exe-node:page-1">Home</a>.</p>',
                        },
                    ],
                },
            ],
        },
    ];
}

function collectImportedHtml(ydoc: Y.Doc): string {
    const parts: string[] = [];
    const navigation = ydoc.getArray('navigation');
    for (let i = 0; i < navigation.length; i++) {
        const page = navigation.get(i) as Y.Map<unknown>;
        const blocks = page.get('blocks') as Y.Array<unknown> | undefined;
        if (!blocks) continue;
        for (let b = 0; b < blocks.length; b++) {
            const block = blocks.get(b) as Y.Map<unknown>;
            const components = block.get('components') as Y.Array<unknown> | undefined;
            if (!components) continue;
            for (let c = 0; c < components.length; c++) {
                const comp = components.get(c) as Y.Map<unknown>;
                parts.push(JSON.stringify(comp.toJSON()));
            }
        }
    }
    return parts.join('\n');
}

const META: ExportMetadata = {
    title: 'Round Trip Project',
    author: 'Tester',
    language: 'en',
    description: 'round trip',
    license: 'CC-BY-SA',
    theme: 'base',
};

type ExporterCtor = new (
    doc: ExportDocument,
    resources: ResourceProvider,
    assets: AssetProvider,
    zip: ZipProvider,
) => { export(): Promise<{ success: boolean; data?: Uint8Array }> };

const FORMATS: Array<{ name: string; Exporter: ExporterCtor }> = [
    { name: 'ELPX', Exporter: ElpxExporter },
    { name: 'HTML5', Exporter: Html5Exporter },
    { name: 'IMS', Exporter: ImsExporter },
];

describe('Internal link export → re-import round trip (#1927)', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `roundtrip-1927-${process.pid}-${Math.floor(performance.now())}`);
        if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    });

    for (const { name, Exporter } of FORMATS) {
        it(`restores exe-node: internal links after a ${name} round trip`, async () => {
            // Export
            const exporter = new Exporter(
                new MockDocument(META, makeLinkedPages()),
                new MockResourceProvider(),
                new MockAssetProvider(),
                new MockZipProvider(),
            );
            const result = await exporter.export();
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Re-import the produced package through the real importer
            const ydoc = new Y.Doc();
            const assetHandler = new FileSystemAssetHandler(testDir);
            const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);
            const imported = await importer.importFromBuffer(new Uint8Array(result.data!));
            expect(imported.pages).toBe(2);

            // The imported document must carry exe-node: references again, not static paths.
            const html = collectImportedHtml(ydoc);
            expect(html).toContain('exe-node:');
            expect(html).not.toContain('html/about.html');
            expect(html).not.toContain('../index.html');

            ydoc.destroy();
        });
    }
});
