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

describe('exeEmbedRelay.validate (open mode)', () => {
    const contentSrc = 'https://cdn.example/pkg/abcdef0123456789/index.html';

    it('accepts a cross-origin https video URL', () => {
        const result = relayApi.validate('https://player.vimeo.com/video/76979871', contentSrc);
        expect(result).toEqual({ url: 'https://player.vimeo.com/video/76979871', kind: 'video' });
    });

    it('rejects userinfo, http, relative URLs, IPs and loopback', () => {
        expect(relayApi.validate('https://evil.com@youtube.com/embed/dQw4w9WgXcQ', contentSrc)).toBeNull();
        expect(relayApi.validate('http://player.vimeo.com/video/1', contentSrc)).toBeNull();
        expect(relayApi.validate('/relative/embed', contentSrc)).toBeNull();
        expect(relayApi.validate('https://127.0.0.1/embed', contentSrc)).toBeNull();
        expect(relayApi.validate('https://localhost/embed', contentSrc)).toBeNull();
        expect(relayApi.validate('https://[::1]/embed', contentSrc)).toBeNull();
    });

    it('accepts a same-origin package PDF and a cross-origin https PDF', () => {
        const sameOriginPdf = `${window.location.origin}/pkg/abcdef0123456789/notes.pdf`;
        expect(relayApi.validate(sameOriginPdf, contentSrc)).toEqual(
            expect.objectContaining({ kind: 'pdf', sameorigin: true }),
        );
        expect(relayApi.validate('https://files.example/doc.pdf', contentSrc)).toEqual(
            expect.objectContaining({ kind: 'pdf', url: 'https://files.example/doc.pdf' }),
        );
        expect(relayApi.validate(`${window.location.origin}/other/secret.pdf`, contentSrc)).toBeNull();
    });

    it('rejects same-origin video URLs and hosts related to the LMS', () => {
        expect(relayApi.validate(`${window.location.origin}/embed/x`, contentSrc)).toBeNull();
    });
});

describe('exeEmbedRelay.validate (strict mode)', () => {
    const contentSrc = 'https://cdn.example/pkg/index.html';
    const whitelist = ['www.youtube-nocookie.com', 'player.vimeo.com', 'www.dailymotion.com', 'mediateca.educa.madrid.org'];

    it('reconstructs canonical YouTube / Vimeo / Dailymotion / Mediateca URLs', () => {
        const relay = relayApi.createRelay({ mode: 'strict', whitelist });
        expect(relay.validate('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', contentSrc).url).toBe(
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        );
        expect(relay.validate('https://player.vimeo.com/video/76979871', contentSrc).url).toBe(
            'https://player.vimeo.com/video/76979871',
        );
        expect(relay.validate('https://www.dailymotion.com/embed/video/x7tgd2l', contentSrc).url).toBe(
            'https://www.dailymotion.com/embed/video/x7tgd2l',
        );
        expect(relay.validate('https://mediateca.educa.madrid.org/video/abc12345/fs', contentSrc).url).toBe(
            'https://mediateca.educa.madrid.org/video/abc12345/fs',
        );
    });

    it('rejects hosts that are not on the allow-list and malformed paths', () => {
        const relay = relayApi.createRelay({ mode: 'strict', whitelist });
        expect(relay.validate('https://evil.example/embed/dQw4w9WgXcQ', contentSrc)).toBeNull();
        expect(relay.validate('https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ', contentSrc)).toBeNull();
    });
});

describe('exeEmbedRelay helpers', () => {
    it('rebuilds provider URLs from a well-shaped object id', () => {
        expect(relayApi.reconstructProvider('youtube', 'dQw4w9WgXcQ')).toBe(
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        );
        expect(relayApi.reconstructProvider('vimeo', '76979871')).toBe('https://player.vimeo.com/video/76979871');
        expect(relayApi.reconstructProvider('youtube', 'short')).toBeNull();
        expect(relayApi.reconstructProvider('unknown', 'dQw4w9WgXcQ')).toBeNull();
    });

    it('normalizes hosts and detects LMS-related / local names', () => {
        expect(relayApi.normalizeHost('LMS.Example.ORG.')).toBe('lms.example.org');
        expect(relayApi.isIpOrLocalHost('localhost')).toBe(true);
        expect(relayApi.isIpOrLocalHost('box.local')).toBe(true);
        expect(relayApi.isIpOrLocalHost('10.0.0.5')).toBe(true);
        expect(relayApi.isIpOrLocalHost('player.vimeo.com')).toBe(false);
        expect(relayApi.isRelatedToLms('editor.lms.example', 'lms.example')).toBe(true);
        expect(relayApi.isRelatedToLms('evil-lms.example', 'lms.example')).toBe(false);
        expect(relayApi.packageId('https://cdn.example/abcdef0123456789/index.html')).toBe('abcdef0123456789');
        expect(relayApi.packageId('https://cdn.example/index.html')).toBeNull();
    });

    it('builds a sandboxed video player and a no-navigation PDF player', () => {
        const video = relayApi.makePlayer({ url: 'https://player.vimeo.com/video/1', kind: 'video' });
        expect(video.getAttribute('data-exe-embed-player')).toBe('1');
        expect(video.getAttribute('sandbox')).toContain('allow-scripts');
        expect(video.getAttribute('allow')).toContain('autoplay');

        const remotePdf = relayApi.makePlayer({ url: 'https://files.example/a.pdf', kind: 'pdf' });
        expect(remotePdf.getAttribute('sandbox')).toBe('allow-same-origin');
        expect(remotePdf.getAttribute('referrerpolicy')).toBe('no-referrer');

        const localPdf = relayApi.makePlayer({
            url: `${window.location.origin}/pkg/notes.pdf`,
            kind: 'pdf',
            sameorigin: true,
        });
        expect(localPdf.getAttribute('sandbox')).toBeNull();
        expect(localPdf.getAttribute('allow')).toBe('fullscreen');
    });
});

describe('exeEmbedRelay.sync overlays', () => {
    it('promotes a YouTube id-only embed, repositions it, and drops it when gone', () => {
        const relay = relayApi.createRelay({});
        const { iframe, contentWindow } = addFrame();
        iframe.getBoundingClientRect = () => ({ left: 10, top: 20, width: 640, height: 360 });

        relay.onMessage({
            source: contentWindow,
            data: {
                type: 'exe-embed',
                action: 'sync',
                embeds: [
                    { id: 'exe-embed-1', provider: 'youtube', objectId: 'dQw4w9WgXcQ', x: 0, y: 0, w: 640, h: 360 },
                    { id: 'bad', x: NaN, y: 0, w: 1, h: 1 },
                    null,
                ],
            },
        });

        const overlay = document.querySelector('.exe-embed-overlay');
        expect(overlay).toBeTruthy();
        const player = overlay.querySelector('iframe[data-exe-embed-player]');
        expect(player.getAttribute('data-exe-embed-src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
        expect(player.style.width).toBe('640px');

        expect(relay.checkDrift()).toBe(0);
        iframe.getBoundingClientRect = () => ({ left: 40, top: 80, width: 640, height: 360 });
        expect(relay.checkDrift()).toBe(1);

        relay.onMessage({
            source: contentWindow,
            data: { type: 'exe-embed', action: 'sync', embeds: [] },
        });
        expect(overlay.querySelector('iframe[data-exe-embed-player]')).toBeNull();

        relay.reflow();
        relay.clear();
        expect(document.querySelector('.exe-embed-overlay')).toBeNull();
        relay.dispose();
    });

    it('replaces a stale player when the same embed id points at a new URL', () => {
        const relay = relayApi.createRelay({});
        const { contentWindow } = addFrame();

        relay.onMessage({
            source: contentWindow,
            data: {
                type: 'exe-embed',
                action: 'sync',
                embeds: [{ id: 'exe-embed-1', url: 'https://player.vimeo.com/video/111111', x: 0, y: 0, w: 100, h: 100 }],
            },
        });
        const first = document.querySelector('iframe[data-exe-embed-player]').getAttribute('data-exe-embed-src');
        relay.onMessage({
            source: contentWindow,
            data: {
                type: 'exe-embed',
                action: 'sync',
                embeds: [{ id: 'exe-embed-1', url: 'https://player.vimeo.com/video/222222', x: 0, y: 0, w: 100, h: 100 }],
            },
        });
        const second = document.querySelector('iframe[data-exe-embed-player]').getAttribute('data-exe-embed-src');
        expect(first).toContain('111111');
        expect(second).toContain('222222');
        relay.dispose();
    });
});
