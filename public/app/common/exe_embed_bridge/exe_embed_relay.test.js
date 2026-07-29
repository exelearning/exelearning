import { afterEach, describe, expect, it, vi } from 'vitest';
import './exe_embed_relay.js';

const relayApi = window.exeEmbedRelay;

/**
 * A content iframe the relay can resolve by `event.source`. `contentWindow` is
 * read-only on a real element, so it is defined explicitly.
 */
function addFrame({ player = false } = {}) {
    const iframe = document.createElement('iframe');
    // about:blank keeps happy-dom from fetching anything; the handshake path
    // resolves frames by window identity and never reads `src`.
    iframe.setAttribute('src', 'about:blank');
    if (player) iframe.setAttribute('data-exe-embed-player', '1');
    const contentWindow = { postMessage: vi.fn() };
    Object.defineProperty(iframe, 'contentWindow', { value: contentWindow, configurable: true });
    document.body.appendChild(iframe);
    return { iframe, contentWindow };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('exe_embed_relay handshake reply', () => {
    it('welcomes a content frame hello so the shim may promote', () => {
        const relay = relayApi.createRelay({});
        const { contentWindow } = addFrame();

        relay.onMessage({ source: contentWindow, data: { type: 'exe-embed', action: 'hello' } });

        expect(contentWindow.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'exe-embed', action: 'welcome' }),
            '*'
        );
    });

    it('ignores a hello from a window it does not host', () => {
        const relay = relayApi.createRelay({});
        addFrame();
        const stranger = { postMessage: vi.fn() };

        relay.onMessage({ source: stranger, data: { type: 'exe-embed', action: 'hello' } });

        expect(stranger.postMessage).not.toHaveBeenCalled();
    });

    it('never answers a promoted player frame', () => {
        const relay = relayApi.createRelay({});
        const { contentWindow } = addFrame({ player: true });

        relay.onMessage({ source: contentWindow, data: { type: 'exe-embed', action: 'hello' } });

        expect(contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it('ignores a message that is not the embed protocol', () => {
        const relay = relayApi.createRelay({});
        const { contentWindow } = addFrame();

        relay.onMessage({ source: contentWindow, data: { type: 'other', action: 'hello' } });
        relay.onMessage({ source: contentWindow, data: null });

        expect(contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it('ignores an embed-protocol action it does not implement', () => {
        const relay = relayApi.createRelay({});
        const { contentWindow } = addFrame();

        relay.onMessage({ source: contentWindow, data: { type: 'exe-embed', action: 'whatever' } });
        // A malformed sync (no embeds array) must not be answered or acted on either.
        relay.onMessage({ source: contentWindow, data: { type: 'exe-embed', action: 'sync' } });

        expect(contentWindow.postMessage).not.toHaveBeenCalled();
    });
});
