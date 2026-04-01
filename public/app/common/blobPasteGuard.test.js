import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BlobPasteGuard from './blobPasteGuard.js';

// _() is a global in the app; stub it for tests
globalThis._ = (s) => s;

const BLOB_URL = 'blob:https://localhost/abc-123';
const BLOB_URL_2 = 'blob:https://localhost/def-456';

/**
 * Build a synthetic paste event with controlled clipboardData.
 * DataTransfer.setData is not writable in all jsdom versions, so we mock
 * clipboardData directly.
 */
function makePasteEventWith({ html = '', text = '' } = {}) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    event.clipboardData = {
        getData: (type) => {
            if (type === 'text/html') return html;
            if (type === 'text/plain') return text;
            return '';
        },
    };
    return event;
}

describe('BlobPasteGuard', () => {
    let toastsManager;
    let guard;

    beforeEach(() => {
        toastsManager = { createToast: vi.fn() };
        guard = new BlobPasteGuard({ toastsManager });
        guard.start();
    });

    afterEach(() => {
        guard.stop();
        vi.clearAllMocks();
    });

    it('shows a warning when pasted HTML contains an unknown blob: URL', () => {
        const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).toHaveBeenCalledOnce();
        expect(toastsManager.createToast.mock.calls[0][0].icon).toBe('warning');
    });

    it('shows a warning when pasted plain text is an unknown blob: URL', () => {
        const event = makePasteEventWith({ text: BLOB_URL });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).toHaveBeenCalledOnce();
    });

    it('does not warn for normal HTML without blob: URLs', () => {
        const event = makePasteEventWith({ html: '<img src="asset://abc-123.jpg">' });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).not.toHaveBeenCalled();
    });

    it('does not warn for plain text that happens to contain the word "blob"', () => {
        const event = makePasteEventWith({ text: 'blob: the story of a database' });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).not.toHaveBeenCalled();
    });

    it('does not warn when clipboardData is absent', () => {
        const event = new Event('paste', { bubbles: true });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).not.toHaveBeenCalled();
    });

    it('does not warn after stop() is called', () => {
        guard.stop();
        const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
        document.dispatchEvent(event);
        expect(toastsManager.createToast).not.toHaveBeenCalled();
    });

    it('does not crash when toastsManager is not provided', () => {
        const guardNoToasts = new BlobPasteGuard({});
        guardNoToasts.start();
        const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
        expect(() => document.dispatchEvent(event)).not.toThrow();
        guardNoToasts.stop();
    });

    describe('reverseBlobCache integration', () => {
        const assetManager = { reverseBlobCache: new Map() };

        beforeEach(() => {
            assetManager.reverseBlobCache.clear();
            globalThis.window.eXeLearning = {
                app: { project: { _yjsBridge: { assetManager } } },
            };
        });

        afterEach(() => {
            delete globalThis.window.eXeLearning;
        });

        it('does not warn when all blob URLs are known to AssetManager', () => {
            assetManager.reverseBlobCache.set(BLOB_URL, 'asset-id-1');
            const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
            document.dispatchEvent(event);
            expect(toastsManager.createToast).not.toHaveBeenCalled();
        });

        it('warns when at least one blob URL is not in reverseBlobCache', () => {
            assetManager.reverseBlobCache.set(BLOB_URL, 'asset-id-1');
            // BLOB_URL_2 is unknown
            const event = makePasteEventWith({
                html: `<img src="${BLOB_URL}"><img src="${BLOB_URL_2}">`,
            });
            document.dispatchEvent(event);
            expect(toastsManager.createToast).toHaveBeenCalledOnce();
        });

        it('warns when reverseBlobCache is empty (no assets loaded)', () => {
            const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
            document.dispatchEvent(event);
            expect(toastsManager.createToast).toHaveBeenCalledOnce();
        });

        it('warns when AssetManager is unavailable (no project open)', () => {
            globalThis.window.eXeLearning = { app: {} };
            const event = makePasteEventWith({ html: `<img src="${BLOB_URL}">` });
            document.dispatchEvent(event);
            expect(toastsManager.createToast).toHaveBeenCalledOnce();
        });
    });
});
