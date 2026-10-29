/**
 * iDevice resource links in server exports
 *
 * Every idevices/ path a server export writes into its pages must exist in the package it
 * produces. Issue #2543: the 3dmol iDevice was packaged under idevices/3dmol/ but linked as
 * idevices/dmole/ (the <css-class> in its config.xml), so it never loaded in CLI exports.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    unzipSync,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
    type ParsedOdeStructure,
} from '../../../src/shared/export';
import { createDocumentFromStructure } from '../../helpers/document-test-utils';

const publicDir = path.join(process.cwd(), 'public');
const testDir = path.join(process.cwd(), 'test', 'temp', 'idevice-resource-links');

const EXPORTERS = [
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
];

function moleculePage(id: string, title: string, position: number): ParsedOdeStructure['pages'][number] {
    return {
        id,
        title,
        components: [
            { id: `${id}-mol`, type: '3dmol', content: '<div class="dmole-IDevice"></div>', order: 0, position: 0 },
        ],
        level: 0,
        parent_id: null,
        position,
    };
}

// The home page links from the package root and the subpage from html/: both relative forms are checked
const structure: ParsedOdeStructure = {
    meta: { title: 'Molecules', author: 'Test', language: 'en', theme: 'base' },
    pages: [moleculePage('home', 'Home', 0), moleculePage('sub', 'Subpage', 1)],
};

/**
 * Resolve every idevices/ reference in the package's pages against the package itself.
 *
 * @param files - Unzipped package, keyed by path
 * @returns The references that point at nothing inside the package, as "page -> reference"
 */
function findBrokenIdeviceLinks(files: Record<string, Uint8Array>): string[] {
    const paths = Object.keys(files);
    const broken: string[] = [];
    for (const page of paths.filter(p => /\.x?html$/.test(p))) {
        const html = new TextDecoder().decode(files[page]);
        for (const [, ref] of html.matchAll(/(?:src|href|data-idevice-path)="([^"]*idevices\/[^"]*)"/g)) {
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(page), ref));
            // data-idevice-path names a folder: it resolves when the package has files inside it
            const exists = target.endsWith('/') ? paths.some(p => p.startsWith(target)) : paths.includes(target);
            if (!exists) broken.push(`${page} -> ${ref}`);
        }
    }
    return broken;
}

describe('iDevice resource links in server exports', () => {
    beforeAll(async () => {
        await fs.ensureDir(testDir);
    });

    afterAll(async () => {
        await fs.remove(testDir);
    });

    for (const Exporter of EXPORTERS) {
        it(`${Exporter.name} packages every idevices/ resource its 3dmol pages link to`, async () => {
            const exporter = new Exporter(
                createDocumentFromStructure(structure, testDir),
                new FileSystemResourceProvider(publicDir),
                new FileSystemAssetProvider(testDir),
                new FflateZipProvider(),
            );

            const result = await exporter.export();
            expect(result.success).toBe(true);

            const files = unzipSync(new Uint8Array(result.data!));
            expect(findBrokenIdeviceLinks(files)).toEqual([]);

            // Check required references on EACH expected page. Checking only existing links
            // would miss an omitted stylesheet, script, node, or entire subpage.
            const expectedPages =
                Exporter === Epub3Exporter
                    ? ['EPUB/index.xhtml', 'EPUB/html/subpage.xhtml']
                    : Exporter === PageExporter
                      ? ['index.html']
                      : ['index.html', 'html/subpage.html'];
            for (const page of expectedPages) {
                expect(files[page], `${Exporter.name}: ${page}`).toBeDefined();
                const html = new TextDecoder().decode(files[page]);
                const basePath = page.includes('/html/') || page.startsWith('html/') ? '../' : '';
                const idevicePath = `${basePath}idevices/3dmol/`;
                expect(html).toContain(`src="${idevicePath}3dmol.js"`);
                expect(html).toContain(`href="${idevicePath}3dmol.css"`);

                const nodes = html.match(/<div\b[^>]*\bclass="[^"]*\bidevice_node\b[^"]*"[^>]*>/g) || [];
                expect(nodes).toHaveLength(Exporter === PageExporter ? 2 : 1);
                for (const node of nodes) {
                    // Not 'dmole' (its <css-class>): initGame() reads the iDevice path from
                    // .idevice_node.3dmol, and with 'dmole' that path is undefined and the images break
                    expect(node).toMatch(/class="[^"]*\b3dmol\b[^"]*"/);
                    expect(node).toContain(`data-idevice-path="${idevicePath}"`);
                    expect(node).toContain('data-idevice-type="3dmol"');
                }
            }
        });
    }
});
