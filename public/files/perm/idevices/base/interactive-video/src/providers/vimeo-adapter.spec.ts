import { describe, expect, it } from 'vitest';
import { asIframe, dispatchMessage, makeFakeIframe } from '../test/frame-harness';
import { createVimeoAdapter, VIMEO_ORIGIN, vimeoEmbedUrl } from './vimeo-adapter';

function mkVimeo(timeout?: number) {
    const iframe = makeFakeIframe(`${VIMEO_ORIGIN}/video/123?dnt=1`);
    const adapter = createVimeoAdapter(asIframe(iframe), timeout != null ? { timeout } : undefined);
    return { iframe, adapter };
}

describe('Vimeo adapter (documented postMessage)', () => {
    it('builds the do-not-track embed URL', () => {
        expect(vimeoEmbedUrl('123')).toBe(`${VIMEO_ORIGIN}/video/123?dnt=1`);
    });

    it('registers timeupdate/play/pause/finish listeners on load to the exact origin', async () => {
        const { iframe, adapter } = mkVimeo();
        const pending = adapter.load();
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'ready' }),
        });
        await pending;
        const registered = iframe.postsMatching(m => m.method === 'addEventListener').map(m => m.parsed.value);
        expect(registered).toEqual(expect.arrayContaining(['timeupdate', 'play', 'pause', 'finish']));
        expect(iframe.posts[0]?.targetOrigin).toBe(VIMEO_ORIGIN);
        adapter.destroy();
    });

    it('posts play/pause/setCurrentTime commands', () => {
        const { iframe, adapter } = mkVimeo();
        adapter.play();
        expect(iframe.lastParsed()).toMatchObject({ method: 'play' });
        adapter.pause();
        expect(iframe.lastParsed()).toMatchObject({ method: 'pause' });
        adapter.seekTo(15);
        expect(iframe.lastParsed()).toMatchObject({ method: 'setCurrentTime', value: 15 });
        expect(iframe.lastPost()?.targetOrigin).toBe(VIMEO_ORIGIN);
        adapter.destroy();
    });

    it('emits onTimeUpdate from timeupdate events and captures duration', async () => {
        const { iframe, adapter } = mkVimeo();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'timeupdate', data: { seconds: 8.25, duration: 300 } }),
        });
        expect(times).toEqual([8.25]);
        await expect(adapter.getDuration()).resolves.toBe(300);
        adapter.destroy();
    });

    // The live player DISCARDS every addEventListener received before it
    // announces `ready`, so the load-time handshake alone leaves the adapter
    // deaf: no timeupdate ever arrives and no interaction can fire.
    it('re-subscribes to the player events when ready arrives', async () => {
        const { iframe, adapter } = mkVimeo();
        const pending = adapter.load(); // posts the load-time (too-early) handshake
        const before = iframe.postsMatching(m => m.method === 'addEventListener').length;
        expect(before).toBeGreaterThan(0);
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'ready' }),
        });
        await pending;
        const after = iframe.postsMatching(m => m.method === 'addEventListener');
        expect(after.slice(before).map(m => m.parsed.value)).toEqual(
            expect.arrayContaining(['ready', 'timeupdate', 'play', 'pause', 'finish']),
        );
        adapter.destroy();
    });

    // On the wire the player emits `playProgress`, not the SDK-level `timeupdate`.
    it('emits onTimeUpdate from playProgress events and captures duration', async () => {
        const { iframe, adapter } = mkVimeo();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'playProgress', data: { seconds: 5.2, percent: 0.08, duration: 61.8 } }),
        });
        expect(times).toEqual([5.2]);
        await expect(adapter.getDuration()).resolves.toBe(61.8);
        adapter.destroy();
    });

    it('maps play/pause/finish to onStateChange', () => {
        const { iframe, adapter } = mkVimeo();
        const states: string[] = [];
        adapter.onStateChange(s => states.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'play' }),
        });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'pause' }),
        });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'finish' }),
        });
        expect(states).toEqual(['playing', 'paused', 'ended']);
        adapter.destroy();
    });

    it('ignores wrong-origin, wrong-source and malformed messages', () => {
        const { iframe, adapter } = mkVimeo();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        dispatchMessage({
            source: iframe.contentWindow,
            origin: 'https://evil.example',
            data: JSON.stringify({ event: 'timeupdate', data: { seconds: 1 } }),
        });
        dispatchMessage({
            source: { other: 1 },
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'timeupdate', data: { seconds: 1 } }),
        });
        expect(() =>
            dispatchMessage({ source: iframe.contentWindow, origin: VIMEO_ORIGIN, data: 'nope' }),
        ).not.toThrow();
        expect(times).toEqual([]);
        adapter.destroy();
    });

    it('destroy() removes the message listener', () => {
        const { iframe, adapter } = mkVimeo();
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        adapter.destroy();
        dispatchMessage({
            source: iframe.contentWindow,
            origin: VIMEO_ORIGIN,
            data: JSON.stringify({ event: 'timeupdate', data: { seconds: 5 } }),
        });
        expect(times).toEqual([]);
    });

    it('load() rejects after the bounded timeout when no ready arrives', async () => {
        const { adapter } = mkVimeo(10);
        await expect(adapter.load()).rejects.toBeTruthy();
        adapter.destroy();
    });
});
