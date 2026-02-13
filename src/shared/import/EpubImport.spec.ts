import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { ElpxImporter } from './ElpxImporter';
import { FileSystemAssetHandler } from './FileSystemAssetHandler';
import type { Logger } from './interfaces';
import * as fflate from 'fflate';

// Silent logger for tests
const silentLogger: Logger = {
    log: () => {},
    warn: () => {},
    error: () => {},
};

describe('ElpxImporter - EPUB3 Support', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `epub-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should import EPUB3 structure with fix', async () => {
        const ydoc = new Y.Doc();
        const importer = new ElpxImporter(ydoc, null, silentLogger);

        // Create a ZIP structure mimicking an EPUB3 export
        // content.xml is inside EPUB/ directory
        const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<odeNavStructures>
    <odeNavStructure odeNavStructureId="page-1" odePageName="Home" odeNavStructureOrder="0">
        <odePagStructures>
            <odePagStructure odePagStructureId="block-1" odePagStructureOrder="0">
                <odeComponents>
                    <odeComponent odeComponentId="comp-1" odeComponentOrder="0" odeIdeviceTypeName="FreeTextIdevice">
                        <htmlView>&lt;p&gt;Hello World&lt;/p&gt;</htmlView>
                    </odeComponent>
                </odeComponents>
            </odePagStructure>
        </odePagStructures>
    </odeNavStructure>
</odeNavStructures>`;

        const zipData = fflate.zipSync({
            'EPUB/content.xml': fflate.strToU8(contentXml), // Minimal valid content
            'EPUB/css/base.css': fflate.strToU8('body { color: black; }'),
            'mimetype': fflate.strToU8('application/epub+zip'),
        });

        // Should succeed with the fix
        const result = await importer.importFromBuffer(zipData);
        expect(result.pages).toBe(1);
        expect(result.components).toBe(1);

        ydoc.destroy();
    });
});
