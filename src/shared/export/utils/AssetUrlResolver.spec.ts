import { beforeEach, afterEach, describe, expect, it } from 'bun:test';
import { AssetUrlResolver } from './AssetUrlResolver';
import type { AssetProvider, ExportAsset } from '../interfaces';

const originalCreateObjectURL = URL.createObjectURL;

/** Build a provider over a fixed set of assets, optionally without the streaming method. */
function providerOf(assets: ExportAsset[], streaming = true): AssetProvider {
    const provider: Partial<AssetProvider> = {
        getAllAssets: async () => assets,
    };

    if (streaming) {
        provider.forEachAsset = async (callback: (asset: ExportAsset) => Promise<void>) => {
            for (const asset of assets) await callback(asset);
        };
    }

    return provider as AssetProvider;
}

function assetOf(overrides: Partial<ExportAsset> = {}): ExportAsset {
    return {
        id: 'uuid-1',
        filename: 'castle.png',
        mime: 'image/png',
        data: new Blob(['bytes'], { type: 'image/png' }),
        ...overrides,
    } as ExportAsset;
}

describe('AssetUrlResolver', () => {
    beforeEach(() => {
        let counter = 0;
        URL.createObjectURL = () => `blob:http://localhost/${++counter}`;
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
    });

    it('rewrites asset:// references to blob URLs', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.resolve('<img src="asset://uuid-1">')).toBe('<img src="blob:http://localhost/1">');
    });

    it('rewrites content/resources references by filename', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.resolve('<img src="content/resources/castle.png">')).toBe(
            '<img src="blob:http://localhost/1">',
        );
    });

    it('matches a reference that carries an extension the id lacks', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf({ id: 'uuid-1', filename: 'other.png' })]));
        await resolver.build();

        expect(resolver.resolve('<img src="asset://uuid-1.png">')).toBe('<img src="blob:http://localhost/1">');
    });

    it('falls back to the export path for unknown asset:// references', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.resolve('<img src="asset://missing">')).toBe('<img src="content/resources/missing">');
    });

    it('leaves unknown content/resources references untouched', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.resolve('<img src="content/resources/missing.png">')).toBe(
            '<img src="content/resources/missing.png">',
        );
    });

    it('does not consume JSON escape characters', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.resolve('{"url":"asset://uuid-1","alt":"a"}')).toBe(
            '{"url":"blob:http://localhost/1","alt":"a"}',
        );
    });

    it('rewrites every reference in a string', async () => {
        const resolver = new AssetUrlResolver(
            providerOf([assetOf({ id: 'a', filename: 'a.png' }), assetOf({ id: 'b', filename: 'b.png' })]),
        );
        await resolver.build();

        const resolved = resolver.resolve('<a href="asset://a">0</a><a href="asset://b">1</a>');

        expect(resolved).toBe('<a href="blob:http://localhost/1">0</a><a href="blob:http://localhost/2">1</a>');
    });

    it('falls back to getAllAssets when streaming is unavailable', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()], false));
        await resolver.build();

        expect(resolver.resolve('asset://uuid-1')).toBe('blob:http://localhost/1');
    });

    it('builds only once', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();
        await resolver.build();

        expect(resolver.resolve('asset://uuid-1')).toBe('blob:http://localhost/1');
    });

    it('exposes the id map for renderers that resolve paths themselves', async () => {
        const resolver = new AssetUrlResolver(providerOf([assetOf()]));
        await resolver.build();

        expect(resolver.getExportPathMap()?.get('uuid-1')).toBe('blob:http://localhost/1');
    });

    describe('building only what some content references', () => {
        const three = () => [
            assetOf({ id: 'a', filename: 'a.png' }),
            assetOf({ id: 'b', filename: 'b.png', folderPath: 'docs' }),
            assetOf({ id: 'c', filename: 'c.png' }),
        ];
        let walks: number;
        /** The three assets, counting how often they are walked. */
        const counted = () => {
            walks = 0;
            const provider = providerOf(three());
            const walk = provider.forEachAsset!;
            provider.forEachAsset = async callback => {
                walks++;
                await walk(callback);
            };
            return provider;
        };

        it('copies only the assets the content references', async () => {
            const resolver = new AssetUrlResolver(counted());
            await resolver.build('<img src="asset://a.png"><img src="content/resources/docs/b.png">');

            expect(resolver.resolve('asset://a content/resources/docs/b.png asset://c')).toBe(
                'blob:http://localhost/1 blob:http://localhost/2 content/resources/c',
            );
        });

        it('adds what a later call references, without copying again what is mapped', async () => {
            const resolver = new AssetUrlResolver(counted());
            await resolver.build('asset://a');
            await resolver.build('asset://a asset://c');

            expect(resolver.resolve('asset://a asset://c')).toBe('blob:http://localhost/1 blob:http://localhost/2');
        });

        it('does not walk the assets again when everything referenced is mapped', async () => {
            const resolver = new AssetUrlResolver(counted());
            await resolver.build('asset://a');
            await resolver.build('<img src="asset://a.png"> <img src="content/resources/a.png">');

            expect(walks).toBe(1);
        });

        it('maps the rest when later asked for every asset, and nothing after that', async () => {
            const resolver = new AssetUrlResolver(counted());
            await resolver.build('asset://a');
            await resolver.build();
            await resolver.build('asset://missing');

            expect(resolver.resolve('asset://a asset://b asset://c')).toBe(
                'blob:http://localhost/1 blob:http://localhost/2 blob:http://localhost/3',
            );
            expect(walks).toBe(2);
        });

        it('starts again once disposed', async () => {
            const resolver = new AssetUrlResolver(counted());
            await resolver.build();
            resolver.dispose();
            await resolver.build('asset://b');

            expect(resolver.resolve('asset://b')).toBe('blob:http://localhost/4');
        });
    });

    describe('without usable assets', () => {
        it('passes content through when there is no provider', async () => {
            const resolver = new AssetUrlResolver(null);
            await resolver.build();

            expect(resolver.resolve('<img src="asset://uuid-1">')).toBe('<img src="asset://uuid-1">');
            expect(resolver.getExportPathMap()).toBeUndefined();
        });

        it('skips assets that carry no data', async () => {
            const resolver = new AssetUrlResolver(providerOf([assetOf({ data: undefined })]));
            await resolver.build();

            expect(resolver.resolve('asset://uuid-1')).toBe('content/resources/uuid-1');
        });

        it('survives a provider that throws', async () => {
            const provider = {
                forEachAsset: async () => {
                    throw new Error('provider exploded');
                },
                getAllAssets: async () => [],
            } as unknown as AssetProvider;

            const resolver = new AssetUrlResolver(provider);
            await resolver.build();

            expect(resolver.resolve('asset://uuid-1')).toBe('content/resources/uuid-1');
        });

        it('returns empty content unchanged', async () => {
            const resolver = new AssetUrlResolver(providerOf([assetOf()]));
            await resolver.build();

            expect(resolver.resolve('')).toBe('');
        });
    });
});
