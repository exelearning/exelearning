import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
    FileSystemAssetProvider,
    FileSystemResourceProvider,
    FflateZipProvider,
    Html5Exporter,
    unzipSync,
    type ExportDocument,
    type ExportMetadata,
    type ExportPage,
} from '../../src/shared/export';

class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
        this.metadata = {
            title: 'Test Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test project',
            license: 'CC-BY-SA',
            theme: 'base',
            ...metadata,
        };
        this.pages = pages;
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

const samplePages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Media Page',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'text',
                        order: 0,
                        content: '<p>Media asset offline packaging check</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
];

// Nguồn thật trong test/fixtures/ — KHÔNG trỏ FileSystemAssetProvider thẳng vào
// test/fixtures/ (sẽ quét thêm 7 file .zip + sample-1.pdf + sample-4.jpg +
// sample-audio.wav không liên quan, xem "Bối cảnh" mục 5). Copy đúng 3 file
// cần vào thư mục tạm riêng trước khi export.
const mediaFixtures = [
    { source: 'sample-2.jpg', zipPath: 'content/resources/sample-2.jpg' },
    { source: 'sample-3.jpg', zipPath: 'content/resources/sample-3.jpg' },
    { source: 'sample-video-480-900kb.webm', zipPath: 'content/resources/sample-video-480-900kb.webm' },
] as const;

describe('Html5Exporter image/video asset offline packaging (I03)', () => {
    let result: Awaited<ReturnType<Html5Exporter['export']>>;
    let exportedZip: Record<string, Uint8Array>;
    let assetsDir: string;
    const fixturesDir = path.join(process.cwd(), 'test/fixtures');

    beforeAll(async () => {
        assetsDir = path.join(os.tmpdir(), `exe-media-offline-${Date.now()}`);
        await fs.ensureDir(assetsDir);
        for (const { source } of mediaFixtures) {
            await fs.copyFile(path.join(fixturesDir, source), path.join(assetsDir, source));
        }

        const document = new MockDocument({}, samplePages);
        const resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
        const assets = new FileSystemAssetProvider(assetsDir);
        const zip = new FflateZipProvider();
        const exporter = new Html5Exporter(document, resources, assets, zip);

        result = await exporter.export();
        if (result.data) {
            exportedZip = unzipSync(result.data);
        }
    });

    afterAll(async () => {
        await fs.remove(assetsDir);
    });

    it('exports successfully with a real image/video asset directory', () => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    it('packages every image/video fixture into content/resources/ with byte-identical content', async () => {
        for (const { source, zipPath } of mediaFixtures) {
            const original = await fs.readFile(path.join(fixturesDir, source));
            const packaged = exportedZip[zipPath];
            expect(packaged).toBeDefined();
            expect(Buffer.from(packaged as Uint8Array).equals(original)).toBe(true);
        }
        console.log(
            `[I03 media packaging] verified ${mediaFixtures.length} byte-identical entries under content/resources/`,
        );
    });
});
