import { describe, expect, it } from 'vitest';
import { asIframe, makeFakeIframe } from '../test/frame-harness';
import { createAdapter, createDegradedAdapter, createProviderFactory, embedUrl } from './index';

describe('provider factory shape', () => {
    it('exposes embedUrl, mediatecaStreamUrl and createAdapter', () => {
        const factory = createProviderFactory();
        expect(typeof factory.embedUrl).toBe('function');
        expect(typeof factory.mediatecaStreamUrl).toBe('function');
        expect(typeof factory.createAdapter).toBe('function');
    });
});

describe('embedUrl', () => {
    it('builds a controllable YouTube nocookie URL with origin on http(s)', () => {
        // vitest.setup.js pins window.location.origin to http://localhost:3001
        expect(embedUrl('youtube', 'dQw4w9WgXcQ')).toBe(
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0&origin=http%3A%2F%2Flocalhost%3A3001',
        );
    });

    it('omits origin when location.origin is not an http(s) origin (opaque/file:)', () => {
        const location = window.location as unknown as { origin: string };
        const saved = location.origin;
        location.origin = 'null';
        try {
            expect(embedUrl('youtube', 'ID')).toBe('https://www.youtube-nocookie.com/embed/ID?enablejsapi=1&rel=0');
        } finally {
            location.origin = saved;
        }
    });

    it('builds a privacy-enhanced Vimeo URL (dnt)', () => {
        expect(embedUrl('vimeo', '123456789')).toBe('https://player.vimeo.com/video/123456789?dnt=1');
    });

    it('returns empty string for providers without an iframe embed (mediateca/local)', () => {
        expect(embedUrl('mediateca', '42')).toBe('');
        expect(embedUrl('local', 'x')).toBe('');
    });

    it('encodes the video id', () => {
        expect(embedUrl('youtube', 'a b&c')).toContain('/embed/a%20b%26c?');
    });
});

describe('createAdapter routing', () => {
    it('routes local/mediateca with a video element to the HTML5 adapter', () => {
        const video = document.createElement('video');
        const local = createAdapter({ provider: 'local', video });
        const mediateca = createAdapter({ provider: 'mediateca', video, videoId: '42' });
        video.currentTime = 3;
        const times: number[] = [];
        local.onTimeUpdate(s => times.push(s));
        video.dispatchEvent(new Event('timeupdate'));
        expect(times).toEqual([3]);
        expect(typeof mediateca.seekTo).toBe('function');
    });

    it('routes youtube/vimeo with an iframe to the frame adapters', () => {
        const yt = createAdapter({
            provider: 'youtube',
            iframe: asIframe(makeFakeIframe('https://www.youtube-nocookie.com/embed/ID')),
        });
        const vimeo = createAdapter({
            provider: 'vimeo',
            iframe: asIframe(makeFakeIframe('https://player.vimeo.com/video/1?dnt=1')),
        });
        expect(typeof yt.play).toBe('function');
        expect(typeof vimeo.play).toBe('function');
        yt.destroy();
        vimeo.destroy();
    });
});

describe('degraded adapter', () => {
    it('returns a safe no-op adapter when the element/iframe is missing', async () => {
        const adapter = createAdapter({ provider: 'youtube', videoId: 'ID' });
        expect(() => {
            adapter.play();
            adapter.pause();
            adapter.seekTo(1);
            adapter.onTimeUpdate(() => {});
            adapter.onStateChange(() => {});
            adapter.onReady(() => {});
            adapter.destroy();
        }).not.toThrow();
        await expect(adapter.getCurrentTime()).resolves.toBe(0);
        await expect(adapter.getDuration()).resolves.toBeNull();
        await expect(adapter.load()).rejects.toBeTruthy();
    });

    it('is also returned for a missing/unknown spec', async () => {
        await expect(createAdapter().load()).rejects.toBeTruthy();
        await expect(createAdapter(null).load()).rejects.toBeTruthy();
        await expect(createDegradedAdapter().load()).rejects.toBeTruthy();
    });
});
