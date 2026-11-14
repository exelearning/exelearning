import { describe, expect, it, vi } from 'vitest';
import { asIframe, dispatchMessage, makeFakeIframe } from '../test/frame-harness';
import type { FrameProviderSpec } from './frame-adapter';
import { createFrameAdapter } from './frame-adapter';

const ORIGIN = 'https://frames.example';

function mkAdapter(overrides?: Partial<FrameProviderSpec>, timeout?: number) {
    const iframe = makeFakeIframe(`${ORIGIN}/embed/1`);
    const onData = vi.fn();
    const spec: FrameProviderSpec = {
        handshake: post => post({ hello: true }),
        command: kind => ({ kind }),
        onData,
        ...overrides,
    };
    const adapter = createFrameAdapter(asIframe(iframe), timeout != null ? { timeout } : undefined, spec);
    return { iframe, adapter, onData };
}

describe('createFrameAdapter', () => {
    it('sends the handshake on iframe load and again when load() is called', () => {
        const { iframe, adapter } = mkAdapter();
        iframe.fireLoad();
        adapter.load().catch(() => {});
        const handshakes = iframe.postsMatching(m => m.hello === true);
        expect(handshakes.length).toBe(2);
        expect(handshakes[0]?.targetOrigin).toBe(ORIGIN);
        adapter.destroy();
    });

    it('delivers only messages from this iframe window AND its origin', () => {
        const { iframe, adapter, onData } = mkAdapter();
        dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: JSON.stringify({ ok: 1 }) });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: 'https://evil.example',
            data: JSON.stringify({ ok: 2 }),
        });
        dispatchMessage({ source: { other: true }, origin: ORIGIN, data: JSON.stringify({ ok: 3 }) });
        expect(onData).toHaveBeenCalledTimes(1);
        expect(onData.mock.calls[0]?.[1]).toEqual({ ok: 1 });
        adapter.destroy();
    });

    it('drops malformed and non-object payloads without throwing', () => {
        const { iframe, adapter, onData } = mkAdapter();
        expect(() => {
            dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: '{ nope' });
            dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: JSON.stringify([1, 2]) });
            dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: JSON.stringify(null) });
        }).not.toThrow();
        expect(onData).not.toHaveBeenCalled();
        adapter.destroy();
    });

    it('resolves load() when the spec reports ready, and immediately once loaded', async () => {
        const { iframe, adapter } = mkAdapter({
            onData: (context, data) => {
                if (data.ready) {
                    context.emitReady();
                }
            },
        });
        const pending = adapter.load();
        dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: JSON.stringify({ ready: 1 }) });
        await pending;
        await expect(adapter.load()).resolves.toBeUndefined();
        adapter.destroy();
    });

    it('rejects load() after the bounded timeout', async () => {
        const { adapter } = mkAdapter(undefined, 10);
        await expect(adapter.load()).rejects.toBeTruthy();
        adapter.destroy();
    });

    it('routes commands through the spec and caches time/duration from the context', async () => {
        const { iframe, adapter } = mkAdapter({
            onData: (context, data) => {
                if (typeof data.seconds === 'number') {
                    context.emitTime(data.seconds);
                }
                if (typeof data.duration === 'number') {
                    context.duration = data.duration;
                }
            },
        });
        adapter.seekTo(12);
        expect(iframe.lastParsed()).toEqual({ kind: 'seek' });
        dispatchMessage({
            source: iframe.contentWindow,
            origin: ORIGIN,
            data: JSON.stringify({ seconds: 3, duration: 30 }),
        });
        await expect(adapter.getCurrentTime()).resolves.toBe(3);
        await expect(adapter.getDuration()).resolves.toBe(30);
        adapter.destroy();
    });

    it('destroy() removes the message listener and mutes further posts', () => {
        const { iframe, adapter, onData } = mkAdapter();
        adapter.destroy();
        dispatchMessage({ source: iframe.contentWindow, origin: ORIGIN, data: JSON.stringify({ ok: 1 }) });
        expect(onData).not.toHaveBeenCalled();
        const posted = iframe.posts.length;
        adapter.play();
        expect(iframe.posts.length).toBe(posted);
    });
});
