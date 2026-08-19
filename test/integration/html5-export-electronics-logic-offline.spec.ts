import { beforeAll, describe, expect, it } from 'bun:test';
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
        title: 'Electronics Logic',
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
                        type: 'electronics-logic',
                        order: 0,
                        content: '<p>Electronics logic iDevice</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
    {
        id: 'page-2',
        title: 'Page 2',
        parentId: 'page-1',
        order: 1,
        blocks: [
            {
                id: 'block-2',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-2',
                        type: 'electronics-logic',
                        order: 0,
                        content: '<p>Electronics logic iDevice subpage</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
];

const ideviceEntries = [
    'idevices/electronics-logic/electronics-logic-grader.bundle.js',
    'idevices/electronics-logic/electronics-logic.js',
    'idevices/electronics-logic/electronics-logic.css',
    'idevices/electronics-logic/electronics-logic.html',
] as const;

describe('Html5Exporter electronics-logic offline integration', () => {
    let result: Awaited<ReturnType<Html5Exporter['export']>>;
    let exportedZip: Record<string, Uint8Array>;

    beforeAll(async () => {
        const document = new MockDocument({}, samplePages);
        const resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
        const assets = new FileSystemAssetProvider(process.cwd());
        const zip = new FflateZipProvider();
        const exporter = new Html5Exporter(document, resources, assets, zip);

        result = await exporter.export();
        if (result.data) {
            exportedZip = unzipSync(result.data);
        }
    });

    it('exports the electronics-logic document successfully', () => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    it('packages the four electronics-logic runtime, CSS, and template entries', () => {
        for (const entry of ideviceEntries) {
            expect(exportedZip[entry]).toBeDefined();
        }
        console.log(`[I02 ZIP entries] ${ideviceEntries.join(' | ')}`);
    });

    it('uses relative electronics-logic paths in the index and subpage', () => {
        const indexHtml = new TextDecoder().decode(exportedZip['index.html']);
        expect(indexHtml).toContain('src="idevices/electronics-logic/electronics-logic.js"');
        expect(indexHtml).toContain('src="idevices/electronics-logic/electronics-logic-grader.bundle.js"');
        expect(indexHtml).toContain('href="idevices/electronics-logic/electronics-logic.css"');
        const ideviceReferences = [
            ...indexHtml.matchAll(/(?:src|href)="([^"]*idevices\/electronics-logic\/[^"]+)"/g),
        ].map(match => match[1]);
        for (const reference of ideviceReferences) {
            for (const prefix of ['/api/', 'http://', 'https://', 'file://', 'C:\\']) {
                expect(reference.startsWith(prefix)).toBe(false);
            }
        }

        const subpageHtml = new TextDecoder().decode(exportedZip['html/page-2.html']);
        expect(subpageHtml).toContain('../idevices/electronics-logic/electronics-logic.js');
    });

    it('keeps the four electronics-logic entries free of AI folders, secrets, absolute paths, and stack traces', () => {
        const forbiddenPatterns = [
            '.agents/',
            '.claude/',
            '.ai/',
            'sk-',
            'ghp_',
            'AIza',
            'Bearer ',
            '/api/',
            'http://',
            'https://',
            'file://',
            'C:\\',
            '/Users/',
            '/home/',
            'stack trace',
            'at Object.',
            'at <anonymous>',
        ];

        for (const entry of ideviceEntries) {
            const content = new TextDecoder().decode(exportedZip[entry]).replaceAll('http://www.w3.org/2000/svg', '');
            for (const pattern of forbiddenPatterns) {
                expect(content).not.toContain(pattern);
            }
        }
    });

    it('keeps the packaged electronics-logic runtime JavaScript network-free', () => {
        const runtimeEntries = ideviceEntries.slice(0, 2);
        for (const entry of runtimeEntries) {
            const content = new TextDecoder().decode(exportedZip[entry]).replaceAll('http://www.w3.org/2000/svg', '');
            expect(content).not.toContain('fetch(');
            expect(content).not.toContain('XMLHttpRequest');
            expect(content).not.toContain('/api/');
            expect(content).not.toContain('https://');
            expect(content).not.toContain('http://');
        }
    });
});
