import { describe, expect, it } from 'vitest';
import { asIframe, dispatchMessage, makeFakeIframe } from '../test/frame-harness';
import { createYouTubeAdapter, YT_ORIGIN, youTubeEmbedUrl } from './youtube-adapter';

function mkYt(timeout?: number) {
    const iframe = makeFakeIframe(`${YT_ORIGIN}/embed/ID?enablejsapi=1&rel=0&origin=http%3A%2F%2Flocalhost%3A3001`);
    const adapter = createYouTubeAdapter(asIframe(iframe), timeout != null ? { timeout } : undefined);
    return { iframe, adapter };
}

describe('YouTube adapter (SDK-free postMessage)', () => {
    it('builds the embed URL through the shared helper', () => {
        expect(youTubeEmbedUrl('ID')).toContain(`${YT_ORIGIN}/embed/ID?enablejsapi=1&rel=0`);
    });

    it('posts the listening handshake to the exact provider origin on load', async () => {
        const { iframe, adapter } = mkYt();
        const pending = adapter.load();
        // A ready message resolves load() cleanly.
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'onReady' }),
        });
        await pending;
        const listening = iframe.postsMatching(m => m.event === 'listening');
        expect(listening.length).toBeGreaterThan(0);
        expect(iframe.posts[0]?.targetOrigin).toBe(YT_ORIGIN);
        adapter.destroy();
    });

    it('posts play/pause/seek commands with the exact targetOrigin', () => {
        const { iframe, adapter } = mkYt();
        adapter.play();
        expect(iframe.lastParsed()).toMatchObject({ event: 'command', func: 'playVideo' });
        expect(iframe.lastPost()?.targetOrigin).toBe(YT_ORIGIN);
        adapter.pause();
        expect(iframe.lastParsed()).toMatchObject({ event: 'command', func: 'pauseVideo' });
        adapter.seekTo(30);
        expect(iframe.lastParsed()).toMatchObject({ event: 'command', func: 'seekTo', args: [30, true] });
        adapter.destroy();
    });

    it('emits onTimeUpdate from infoDelivery currentTime pushes', () => {
        const { iframe, adapter } = mkYt();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12.5 } }),
        });
        expect(times).toEqual([12.5]);
        adapter.destroy();
    });

    it('maps playerState 1/2/0 to playing/paused/ended', () => {
        const { iframe, adapter } = mkYt();
        const states: string[] = [];
        adapter.onStateChange(s => states.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { playerState: 1 } }),
        });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'onStateChange', info: 2 }),
        });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { playerState: 0 } }),
        });
        expect(states).toEqual(['playing', 'paused', 'ended']);
        adapter.destroy();
    });

    it('ignores messages from the wrong origin', () => {
        const { iframe, adapter } = mkYt();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: 'https://evil.example',
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 9 } }),
        });
        expect(times).toEqual([]);
        adapter.destroy();
    });

    it('ignores messages from the wrong source window', () => {
        const { adapter } = mkYt();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: { notTheIframe: true },
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 9 } }),
        });
        expect(times).toEqual([]);
        adapter.destroy();
    });

    it('ignores malformed JSON without throwing', () => {
        const { iframe, adapter } = mkYt();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        expect(() =>
            dispatchMessage({ source: iframe.contentWindow, origin: YT_ORIGIN, data: '{ not json' }),
        ).not.toThrow();
        expect(times).toEqual([]);
        adapter.destroy();
    });

    it('getCurrentTime resolves the last pushed time; getDuration the reported duration', async () => {
        const { iframe, adapter } = mkYt();
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 20, duration: 200 } }),
        });
        await expect(adapter.getCurrentTime()).resolves.toBe(20);
        await expect(adapter.getDuration()).resolves.toBe(200);
        adapter.destroy();
    });

    it('destroy() removes the message listener', () => {
        const { iframe, adapter } = mkYt();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        adapter.destroy();
        dispatchMessage({
            source: iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 5 } }),
        });
        expect(times).toEqual([]);
    });

    it('load() rejects after the bounded timeout when no ready arrives', async () => {
        const { adapter } = mkYt(10);
        await expect(adapter.load()).rejects.toBeTruthy();
        adapter.destroy();
    });

    it('isolates two instances on one page (dispatch by source)', () => {
        const a = mkYt();
        const b = mkYt();
        const ta: number[] = [];
        const tb: number[] = [];
        a.adapter.onTimeUpdate(s => ta.push(s));
        b.adapter.onTimeUpdate(s => tb.push(s));
        dispatchMessage({
            source: a.iframe.contentWindow,
            origin: YT_ORIGIN,
            data: JSON.stringify({ event: 'infoDelivery', info: { currentTime: 1 } }),
        });
        expect(ta).toEqual([1]);
        expect(tb).toEqual([]);
        a.adapter.destroy();
        b.adapter.destroy();
    });
});
