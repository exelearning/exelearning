/**
 * Tests for SlideAssetService — eXeLearning AssetManager / file manager
 * integration.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlideAssetService } from './assetService.ts';

function setExeLearningGlobals(globals) {
    if (globals === null) {
        delete globalThis.eXeLearning;
        return;
    }
    globalThis.eXeLearning = globals;
}

beforeEach(() => {
    setExeLearningGlobals(null);
    document.body.innerHTML = '';
});

afterEach(() => {
    setExeLearningGlobals(null);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('pickImage with file manager modal', () => {
    it('opens the file manager and resolves with assetUrl + displayUrl', async () => {
        const showMock = vi.fn(({ onSelect }) =>
            onSelect({
                assetUrl: 'asset://abc.jpg',
                blobUrl: 'blob:http://x/123',
                asset: { filename: 'photo.jpg' },
            }),
        );
        setExeLearningGlobals({ app: { modals: { filemanager: { show: showMock } } } });

        const host = document.createElement('div');
        const svc = new SlideAssetService(host);
        const result = await svc.pickImage();

        expect(showMock).toHaveBeenCalledOnce();
        expect(showMock.mock.calls[0][0].accept).toBe('image');
        expect(showMock.mock.calls[0][0].multiSelect).toBe(false);
        expect(result).toEqual({
            assetUrl: 'asset://abc.jpg',
            displayUrl: 'blob:http://x/123',
            name: 'photo.jpg',
        });
    });

    it('falls back to assetUrl as displayUrl when blob is missing', async () => {
        const showMock = vi.fn(({ onSelect }) => onSelect({ assetUrl: 'asset://x.png' }));
        setExeLearningGlobals({ app: { modals: { filemanager: { show: showMock } } } });
        const svc = new SlideAssetService(document.createElement('div'));
        const result = await svc.pickImage();
        expect(result?.displayUrl).toBe('asset://x.png');
    });

    it('resolves with null when the user cancels', async () => {
        const showMock = vi.fn(({ onSelect }) => onSelect(null));
        setExeLearningGlobals({ app: { modals: { filemanager: { show: showMock } } } });
        const svc = new SlideAssetService(document.createElement('div'));
        expect(await svc.pickImage()).toBeNull();
    });

    it('resolves with null when the file manager throws', async () => {
        const showMock = vi.fn(() => {
            throw new Error('boom');
        });
        setExeLearningGlobals({ app: { modals: { filemanager: { show: showMock } } } });
        const svc = new SlideAssetService(document.createElement('div'));
        expect(await svc.pickImage()).toBeNull();
    });

    it('does not store unsafe raw URLs (always uses provided assetUrl from the modal)', async () => {
        const showMock = vi.fn(({ onSelect }) =>
            onSelect({ assetUrl: 'asset://safe.png', blobUrl: 'blob:http://x/1' }),
        );
        setExeLearningGlobals({ app: { modals: { filemanager: { show: showMock } } } });
        const svc = new SlideAssetService(document.createElement('div'));
        const result = await svc.pickImage();
        expect(result?.assetUrl.startsWith('asset://')).toBe(true);
    });
});

describe('pickImage fallback (no file manager)', () => {
    it('clicks the hidden input and creates a data URL when the user picks a file', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);

        // Stub FileReader to a synchronous mock returning a known data URL
        const originalFileReader = global.FileReader;
        global.FileReader = class {
            readAsDataURL() {
                this.result = 'data:image/png;base64,AAAA';
                if (this.onload) this.onload({ target: this });
            }
        };

        const svc = new SlideAssetService(host);
        const promise = svc.pickImage();

        // The fallback input is appended to the host on demand.
        const input = host.querySelector('input[type=file]');
        expect(input).toBeTruthy();

        // Simulate the user picking a file.
        const file = new File(['hello'], 'pic.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { value: [file] });
        input.dispatchEvent(new Event('change'));

        const result = await promise;
        global.FileReader = originalFileReader;

        expect(result?.assetUrl).toBe('data:image/png;base64,AAAA');
        expect(result?.displayUrl).toBe('data:image/png;base64,AAAA');
        expect(result?.name).toBe('pic.png');
    });

    it('uses AssetManager.insertImage when available so we get an asset:// URL', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);

        const insertImage = vi.fn(async () => 'asset://generated.png');
        const blobURLCache = new Map([['generated.png', 'blob:http://x/abc']]);
        setExeLearningGlobals({
            app: {
                project: {
                    _yjsBridge: {
                        assetManager: {
                            insertImage,
                            blobURLCache,
                            extractAssetId: url => url.replace('asset://', ''),
                        },
                    },
                },
            },
        });

        const svc = new SlideAssetService(host);
        const promise = svc.pickImage();

        const input = host.querySelector('input[type=file]');
        const file = new File(['x'], 'p.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { value: [file] });
        input.dispatchEvent(new Event('change'));

        const result = await promise;
        expect(insertImage).toHaveBeenCalledOnce();
        expect(result?.assetUrl).toBe('asset://generated.png');
        expect(result?.displayUrl).toBe('blob:http://x/abc');
    });
});

describe('resolveDisplayUrl', () => {
    it('returns the original URL when there is no AssetManager available', async () => {
        const svc = new SlideAssetService(document.createElement('div'));
        expect(await svc.resolveDisplayUrl('asset://abc.png')).toBe('asset://abc.png');
        expect(await svc.resolveDisplayUrl('https://x/a.png')).toBe('https://x/a.png');
        expect(await svc.resolveDisplayUrl('')).toBe('');
    });

    it('uses AssetManager.resolveAssetURL to fetch a blob URL when available', async () => {
        const resolveAssetURL = vi.fn(async () => 'blob:http://y/9');
        setExeLearningGlobals({
            app: { project: { _yjsBridge: { assetManager: { resolveAssetURL } } } },
        });
        const svc = new SlideAssetService(document.createElement('div'));
        expect(await svc.resolveDisplayUrl('asset://x.png')).toBe('blob:http://y/9');
        expect(resolveAssetURL).toHaveBeenCalledWith('asset://x.png');
    });

    it('falls back to the original URL when the resolver throws', async () => {
        setExeLearningGlobals({
            app: {
                project: {
                    _yjsBridge: {
                        assetManager: {
                            resolveAssetURL: async () => {
                                throw new Error('nope');
                            },
                        },
                    },
                },
            },
        });
        const svc = new SlideAssetService(document.createElement('div'));
        expect(await svc.resolveDisplayUrl('asset://x.png')).toBe('asset://x.png');
    });
});
