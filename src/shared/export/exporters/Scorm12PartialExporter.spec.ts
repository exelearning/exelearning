import { describe, expect, it } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import type {
    AssetProvider,
    ExportAsset,
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
} from '../interfaces';
import { FflateZipProvider } from '../providers/FflateZipProvider';
import { Scorm12BlockExporter } from './Scorm12BlockExporter';
import { Scorm12IdeviceExporter } from './Scorm12IdeviceExporter';
import { Scorm12SinglePageExporter } from './Scorm12SinglePageExporter';

const USED_ASSET_ID = '11111111-1111-1111-1111-111111111111';
const UNUSED_ASSET_ID = '22222222-2222-2222-2222-222222222222';
const CHILD_ASSET_ID = '33333333-3333-3333-3333-333333333333';
const SIBLING_ASSET_ID = '44444444-4444-4444-4444-444444444444';

class MockDocument implements ExportDocument {
    constructor(
        private readonly pages: ExportPage[],
        private readonly metadata: Partial<ExportMetadata> = {},
    ) {}

    getMetadata(): ExportMetadata {
        return {
            title: 'Partial SCORM Project',
            author: 'Test Author',
            language: 'en',
            description: 'Partial SCORM test project',
            license: '',
            theme: 'base',
            addExeLink: true,
            addPagination: true,
            addSearchBox: true,
            ...this.metadata,
        };
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

class MockResourceProvider implements ResourceProvider {
    async fetchTheme(_name: string): Promise<Map<string, Uint8Array>> {
        return new Map([
            ['style.css', encode('/* theme css */')],
            ['style.js', encode('// theme js')],
        ]);
    }

    async fetchIdeviceResources(ideviceType: string): Promise<Map<string, Uint8Array>> {
        return new Map([
            [`${ideviceType}.js`, encode(`// ${ideviceType} js`)],
            [`${ideviceType}.css`, encode(`/* ${ideviceType} css */`)],
        ]);
    }

    async fetchBaseLibraries(): Promise<Map<string, Uint8Array>> {
        return new Map([
            ['jquery/jquery.min.js', encode('// jquery')],
            ['common.js', encode('// common')],
            ['exe_export.js', encode('// export')],
            ['bootstrap/bootstrap.bundle.min.js', encode('// bootstrap')],
            ['bootstrap/bootstrap.min.css', encode('/* bootstrap */')],
        ]);
    }

    async fetchLibraryFiles(files: string[]): Promise<Map<string, Uint8Array>> {
        return new Map(files.map(file => [file, encode(`/* ${file} */`)]));
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '') || 'text';
    }

    async fetchExeLogo(): Promise<Uint8Array | null> {
        return encode('logo');
    }

    async fetchContentCss(): Promise<Map<string, Uint8Array>> {
        return new Map([['content/css/base.css', encode('/* base css */')]]);
    }

    async fetchScormFiles(_version: '1.2' | '2004'): Promise<Map<string, Uint8Array>> {
        return new Map([
            ['SCORM_API_wrapper.js', encode('// SCORM API')],
            ['SCOFunctions.js', encode('// SCO functions')],
        ]);
    }

    async fetchGlobalFontFiles(_fontName: string): Promise<Map<string, Uint8Array> | null> {
        return null;
    }

    async fetchI18nFile(_language: string): Promise<string> {
        return '// i18n';
    }

    async fetchI18nTranslations(_language: string): Promise<Map<string, string>> {
        return new Map();
    }
}

class MockAssetProvider implements AssetProvider {
    constructor(private readonly assets: ExportAsset[]) {}

    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.assets;
    }

    async getAllAssets(): Promise<ExportAsset[]> {
        return this.assets;
    }

    async getAsset(assetId: string): Promise<ExportAsset | null> {
        return this.assets.find(asset => asset.id === assetId) || null;
    }

    async forEachAsset(callback: (asset: ExportAsset) => Promise<void>): Promise<number> {
        for (const asset of this.assets) {
            await callback(asset);
        }
        return this.assets.length;
    }
}

function makePages(): ExportPage[] {
    return [
        {
            id: 'page-1',
            title: 'Root Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Root Block',
                    order: 0,
                    components: [
                        {
                            id: 'component-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Root page content</p>',
                            properties: {},
                        },
                    ],
                },
            ],
        },
        {
            id: 'page-2',
            title: 'Selected Page',
            parentId: 'page-1',
            order: 1,
            blocks: [
                {
                    id: 'block-2',
                    name: 'Selected Block',
                    order: 0,
                    components: [
                        {
                            id: 'component-2',
                            type: 'text',
                            order: 0,
                            content: `<p>Selected iDevice content</p><img class="exe-game" src="asset://${USED_ASSET_ID}.png">`,
                            properties: {
                                title: 'Selected iDevice',
                                image: `asset://${USED_ASSET_ID}.png`,
                            },
                        },
                        {
                            id: 'component-sibling',
                            type: 'text',
                            order: 1,
                            content: `<p>Sibling iDevice content</p><img src="asset://${SIBLING_ASSET_ID}.png">`,
                            properties: {},
                        },
                    ],
                },
            ],
        },
        {
            id: 'page-3',
            title: 'Child Page',
            parentId: 'page-2',
            order: 2,
            blocks: [
                {
                    id: 'block-3',
                    name: 'Child Block',
                    order: 0,
                    components: [
                        {
                            id: 'component-3',
                            type: 'text',
                            order: 0,
                            content: `<p>Child page content</p><img src="asset://${CHILD_ASSET_ID}.png">`,
                            properties: {},
                        },
                    ],
                },
            ],
        },
    ];
}

function makeAssets(): ExportAsset[] {
    return [
        makeAsset(USED_ASSET_ID, 'used.png', 'used asset'),
        makeAsset(UNUSED_ASSET_ID, 'unused.png', 'unused asset'),
        makeAsset(CHILD_ASSET_ID, 'child.png', 'child asset'),
        makeAsset(SIBLING_ASSET_ID, 'sibling.png', 'sibling asset'),
    ];
}

function makeAsset(id: string, filename: string, content: string): ExportAsset {
    return {
        id,
        filename,
        originalPath: `${id}/${filename}`,
        mime: 'image/png',
        data: encode(content),
    };
}

function makeSinglePageExporter(): Scorm12SinglePageExporter {
    return new Scorm12SinglePageExporter(
        new MockDocument(makePages()),
        new MockResourceProvider(),
        new MockAssetProvider(makeAssets()),
        new FflateZipProvider(),
    );
}

function makeIdeviceExporter(): Scorm12IdeviceExporter {
    return new Scorm12IdeviceExporter(
        new MockDocument(makePages()),
        new MockResourceProvider(),
        new MockAssetProvider(makeAssets()),
        new FflateZipProvider(),
    );
}

function makeBlockExporter(): Scorm12BlockExporter {
    return new Scorm12BlockExporter(
        new MockDocument(makePages()),
        new MockResourceProvider(),
        new MockAssetProvider(makeAssets()),
        new FflateZipProvider(),
    );
}

function encode(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

function unzipResult(data: Uint8Array): Record<string, Uint8Array> {
    return unzipSync(data);
}

function readFile(files: Record<string, Uint8Array>, path: string): string {
    return strFromU8(files[path]);
}

function expectMinimalScormPackage(files: Record<string, Uint8Array>): void {
    const paths = Object.keys(files);

    expect(paths).toContain('imsmanifest.xml');
    expect(paths).toContain('imslrm.xml');
    expect(paths).toContain('index.html');
    expect(paths).toContain('content/css/base.css');
    expect(paths).toContain('libs/jquery/jquery.min.js');
    expect(paths).toContain('libs/common.js');
    expect(paths).toContain('libs/common_i18n.js');
    expect(paths).toContain('libs/exe_export.js');
    expect(paths).toContain('libs/SCORM_API_wrapper.js');
    expect(paths).toContain('libs/SCOFunctions.js');
    expect(paths).toContain('libs/exe_games/exe_games.js');
    expect(paths).toContain('libs/exe_games/exe_games.css');
    expect(paths).toContain('idevices/text/text.js');
    expect(paths).toContain('idevices/text/text.css');
    expect(paths).toContain('content/resources/used.png');
    expect(paths.some(path => path.startsWith('theme/'))).toBe(false);
    expect(paths.some(path => path.startsWith('html/'))).toBe(false);
    expect(paths).not.toContain('content.xml');
    expect(paths).not.toContain('content.dtd');

    const html = readFile(files, 'index.html');
    expect(html).toContain('libs/SCORM_API_wrapper.js');
    expect(html).toContain('libs/SCOFunctions.js');
    expect(html).toContain('content/css/base.css');
    expect(html).not.toContain('theme/');
    expect(html).not.toContain('<nav id="siteNav"');

    const manifest = readFile(files, 'imsmanifest.xml');
    expect((manifest.match(/<item /g) || []).length).toBe(1);
    expect(manifest).toContain('href="index.html"');
    expect(manifest).not.toContain('html/');
}

describe('SCORM 1.2 partial exporters', () => {
    it('exports a single selected page without descendants or theme files', async () => {
        const result = await makeSinglePageExporter().export({ pageId: 'page-2', filename: 'page.zip' });

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Uint8Array);

        const files = unzipResult(result.data as Uint8Array);
        expectMinimalScormPackage(files);

        const html = readFile(files, 'index.html');
        expect(html).toContain('Selected iDevice content');
        expect(html).toContain('Sibling iDevice content');
        expect(html).not.toContain('Root page content');
        expect(html).not.toContain('Child page content');

        const paths = Object.keys(files);
        expect(paths).toContain('content/resources/sibling.png');
        expect(paths).not.toContain('content/resources/unused.png');
        expect(paths).not.toContain('content/resources/child.png');
    });

    it('returns an error when the selected page is missing', async () => {
        const result = await makeSinglePageExporter().export({ pageId: 'missing-page' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Page not found');
    });

    it('requires a page id for page SCORM export', async () => {
        const result = await makeSinglePageExporter().export();

        expect(result.success).toBe(false);
        expect(result.error).toBe('pageId is required');
    });

    it('exports a single selected iDevice without sibling iDevices', async () => {
        const result = await makeIdeviceExporter().export({
            blockId: 'block-2',
            ideviceId: 'component-2',
            filename: 'idevice.zip',
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Uint8Array);

        const files = unzipResult(result.data as Uint8Array);
        expectMinimalScormPackage(files);

        const html = readFile(files, 'index.html');
        expect(html).toContain('Selected iDevice content');
        expect(html).not.toContain('Sibling iDevice content');
        expect(html).not.toContain('Root page content');
        expect(html).not.toContain('Child page content');

        const paths = Object.keys(files);
        expect(paths).not.toContain('content/resources/sibling.png');
        expect(paths).not.toContain('content/resources/unused.png');
        expect(paths).not.toContain('content/resources/child.png');
    });

    it('returns an error when the selected iDevice block is missing', async () => {
        const result = await makeIdeviceExporter().export({
            blockId: 'missing-block',
            ideviceId: 'component-2',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Block not found');
    });

    it('returns an error when the selected iDevice is missing', async () => {
        const result = await makeIdeviceExporter().export({
            blockId: 'block-2',
            ideviceId: 'missing-component',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('iDevice not found');
    });

    it('exports a single selected box with all its iDevices', async () => {
        const result = await makeBlockExporter().export({
            blockId: 'block-2',
            filename: 'box.zip',
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Uint8Array);

        const files = unzipResult(result.data as Uint8Array);
        expectMinimalScormPackage(files);

        const html = readFile(files, 'index.html');
        expect(html).toContain('Selected iDevice content');
        expect(html).toContain('Sibling iDevice content');
        expect(html).not.toContain('Root page content');
        expect(html).not.toContain('Child page content');

        const paths = Object.keys(files);
        expect(paths).toContain('content/resources/sibling.png');
        expect(paths).not.toContain('content/resources/unused.png');
        expect(paths).not.toContain('content/resources/child.png');
    });

    it('returns an error when the selected box is missing', async () => {
        const result = await makeBlockExporter().export({ blockId: 'missing-block' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Block not found');
    });

    it('requires a block id for box SCORM export', async () => {
        const result = await makeBlockExporter().export();

        expect(result.success).toBe(false);
        expect(result.error).toBe('blockId is required');
    });
});
