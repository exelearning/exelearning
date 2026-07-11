/**
 * previewLayers tests — fixed-resource id builders and the id → bytes
 * resolver used by the HTTP preview transport (serving contract v2).
 */

import { describe, it, expect } from 'bun:test';
import { buildThemeFixedId, parseThemeFixedId, resolveFixedResourceBytes, sha256HexOf } from './previewLayers';
import type { ResourceProvider } from '../interfaces';

function createResources(overrides: Partial<ResourceProvider> = {}): ResourceProvider {
    const empty = async () => new Map<string, Uint8Array>();
    return {
        fetchTheme: empty,
        fetchIdeviceResources: empty,
        fetchBaseLibraries: empty,
        fetchLibraryFiles: empty,
        fetchScormFiles: empty,
        normalizeIdeviceType: (t: string) => t,
        fetchExeLogo: async () => null,
        fetchContentCss: empty,
        fetchGlobalFontFiles: empty,
        fetchI18nFile: async () => '',
        fetchI18nTranslations: async () => new Map(),
        ...overrides,
    } as ResourceProvider;
}

describe('previewLayers', () => {
    describe('theme fixed ids', () => {
        it('builds theme ids in the manifest shape', () => {
            expect(buildThemeFixedId('zen', 'content.css')).toBe('theme:zen/content.css');
            expect(buildThemeFixedId('base', 'icons/activity.svg')).toBe('theme:base/icons/activity.svg');
        });

        it('parses theme ids back into components', () => {
            expect(parseThemeFixedId('theme:zen/content.css')).toEqual({ themeName: 'zen', relPath: 'content.css' });
            expect(parseThemeFixedId('theme:base/icons/a.svg')).toEqual({
                themeName: 'base',
                relPath: 'icons/a.svg',
            });
        });

        it('rejects non-theme and malformed ids', () => {
            expect(parseThemeFixedId('libs/jquery/jquery.min.js')).toBeNull();
            expect(parseThemeFixedId('theme:no-slash')).toBeNull();
            expect(parseThemeFixedId('theme:/leading')).toBeNull();
            expect(parseThemeFixedId('theme:trailing/')).toBeNull();
        });

        it('round-trips build → parse', () => {
            const id = buildThemeFixedId('my theme', 'sub/dir/file.css');
            expect(parseThemeFixedId(id)).toEqual({ themeName: 'my theme', relPath: 'sub/dir/file.css' });
        });
    });

    describe('sha256HexOf', () => {
        it('hashes bytes to lowercase hex (known vector)', async () => {
            expect(await sha256HexOf(new Uint8Array(0))).toBe(
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            );
        });
    });

    describe('resolveFixedResourceBytes', () => {
        it('resolves theme ids through fetchTheme', async () => {
            const bytes = new Uint8Array([1, 2]);
            const resources = createResources({
                fetchTheme: async (name: string) => (name === 'zen' ? new Map([['content.css', bytes]]) : new Map()),
            });
            expect(await resolveFixedResourceBytes(resources, 'theme:zen/content.css')).toBe(bytes);
            expect(await resolveFixedResourceBytes(resources, 'theme:zen/missing.css')).toBeNull();
        });

        it('resolves the content css and the logo', async () => {
            const css = new Uint8Array([3]);
            const logo = new Uint8Array([4]);
            const resources = createResources({
                fetchContentCss: async () => new Map([['content/css/base.css', css]]),
                fetchExeLogo: async () => logo,
            });
            expect(await resolveFixedResourceBytes(resources, 'content/css/base.css')).toBe(css);
            expect(await resolveFixedResourceBytes(resources, 'content/img/exe_powered_logo.png')).toBe(logo);
        });

        it('resolves libs from the base bundle first, then per-file fetch', async () => {
            const fromBase = new Uint8Array([5]);
            const fetched = new Uint8Array([6]);
            const resources = createResources({
                fetchBaseLibraries: async () => new Map([['jquery/jquery.min.js', fromBase]]),
                fetchLibraryFiles: async (files: string[]) =>
                    new Map(files.map(f => [f, fetched] as [string, Uint8Array])),
            });
            expect(await resolveFixedResourceBytes(resources, 'libs/jquery/jquery.min.js')).toBe(fromBase);
            expect(await resolveFixedResourceBytes(resources, 'libs/exe_effects/exe_effects.js')).toBe(fetched);
        });

        it('resolves iDevice runtime files by normalized directory name', async () => {
            const bytes = new Uint8Array([7]);
            const resources = createResources({
                fetchIdeviceResources: async (type: string) =>
                    type === 'text' ? new Map([['export/text.js', bytes]]) : new Map(),
            });
            expect(await resolveFixedResourceBytes(resources, 'idevices/text/export/text.js')).toBe(bytes);
            expect(await resolveFixedResourceBytes(resources, 'idevices/text')).toBeNull();
        });

        it('resolves global font files (full-path keys)', async () => {
            const bytes = new Uint8Array([8]);
            const resources = createResources({
                fetchGlobalFontFiles: async (fontId: string) =>
                    fontId === 'opendyslexic'
                        ? new Map([['fonts/global/opendyslexic/OpenDyslexic-Regular.woff', bytes]])
                        : new Map(),
            });
            expect(
                await resolveFixedResourceBytes(resources, 'fonts/global/opendyslexic/OpenDyslexic-Regular.woff'),
            ).toBe(bytes);
        });

        it('returns null for unknown id shapes and on fetch failures', async () => {
            const resources = createResources({
                fetchTheme: async () => {
                    throw new Error('boom');
                },
            });
            expect(await resolveFixedResourceBytes(resources, 'something/else.js')).toBeNull();
            expect(await resolveFixedResourceBytes(resources, 'theme:zen/content.css')).toBeNull();
        });
    });
});
