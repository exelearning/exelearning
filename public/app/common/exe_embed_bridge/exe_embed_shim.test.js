import { beforeEach, describe, expect, it, vi } from 'vitest';
import './exe_embed_shim.js';

const shim = window.exeEmbedShim;

/**
 * A framed, opaque-origin window stand-in. The shim must read the window it is
 * given (not the global) so the handshake can be exercised without a real
 * cross-origin frame.
 */
function makeWin({ opaque = true } = {}) {
    const parent = { postMessage: vi.fn() };
    const listeners = {};
    const timers = [];
    const win = {
        parent,
        origin: opaque ? 'null' : 'https://lms.example',
        addEventListener: (type, fn) => {
            (listeners[type] = listeners[type] || []).push(fn);
        },
        removeEventListener: (type, fn) => {
            const a = listeners[type] || [];
            const i = a.indexOf(fn);
            if (i >= 0) a.splice(i, 1);
        },
        setTimeout: (fn, ms) => {
            timers.push({ fn, ms });
            return timers.length;
        },
        clearTimeout: vi.fn(),
        requestAnimationFrame: (fn) => {
            fn();
            return 1;
        },
        location: { href: 'https://lms.example/preview/page.html', hostname: 'lms.example' },
    };
    return {
        win,
        parent,
        emit: (type, event) => (listeners[type] || []).forEach((fn) => fn(event)),
        runTimers: () => {
            const due = timers.splice(0, timers.length);
            due.forEach((t) => t.fn());
        },
        pendingTimers: () => timers.length,
    };
}

/**
 * A DETACHED container standing in for the content document. The shim scans and
 * collects from whatever root it is given, and a detached tree never connects its
 * iframes to a document — so the fixture's real provider URLs are never fetched.
 */
function makeRoot(html) {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
}

const YT = '<iframe id="yt" src="https://www.youtube.com/embed/abc123def" width="560" height="315"></iframe>';

describe('exe_embed_shim host handshake', () => {
    let ctx;
    let root;

    beforeEach(() => {
        ctx = makeWin();
        root = makeRoot(YT);
    });

    it('does not touch the embed before a host answers', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();

        // The whole point of F1: an unanswered handshake must leave the author's
        // native embed exactly as it was, never an orphan placeholder.
        expect(root.querySelector('#yt')).not.toBeNull();
        expect(root.querySelectorAll('[data-exe-embed-id]')).toHaveLength(0);
        expect(runtime.isActivated()).toBe(false);
    });

    it('announces itself to the parent on start', () => {
        shim.createRuntime(ctx.win, root).start();

        expect(ctx.parent.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'exe-embed', action: 'hello' }),
            '*'
        );
    });

    it('promotes the embed once the host welcomes it', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();

        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'welcome' } });

        expect(runtime.isActivated()).toBe(true);
        expect(root.querySelector('#yt')).toBeNull();
        expect(root.querySelectorAll('[data-exe-embed-id]')).toHaveLength(1);
    });

    it('ignores an answer from a window that is not the parent', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();

        ctx.emit('message', { source: { other: true }, data: { type: 'exe-embed', action: 'welcome' } });

        expect(runtime.isActivated()).toBe(false);
        expect(root.querySelector('#yt')).not.toBeNull();
    });

    it('ignores a parent message that is not the embed handshake', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();

        ctx.emit('message', { source: ctx.win.parent, data: { type: 'something-else', action: 'request' } });
        ctx.emit('message', { source: ctx.win.parent, data: null });

        expect(runtime.isActivated()).toBe(false);
        expect(root.querySelector('#yt')).not.toBeNull();
    });

    it('re-announces while unanswered, so a lazily loaded host is still found', () => {
        shim.createRuntime(ctx.win, root).start();
        const first = ctx.parent.postMessage.mock.calls.length;

        ctx.runTimers();

        expect(ctx.parent.postMessage.mock.calls.length).toBeGreaterThan(first);
    });

    it('stops announcing once the host has answered', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();
        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'welcome' } });

        const afterActivation = ctx.parent.postMessage.mock.calls.filter(
            (c) => c[0] && c[0].action === 'hello'
        ).length;
        ctx.runTimers();
        const later = ctx.parent.postMessage.mock.calls.filter((c) => c[0] && c[0].action === 'hello').length;

        expect(later).toBe(afterActivation);
        expect(runtime.isActivated()).toBe(true);
    });

    it('stays dormant outside an opaque origin', () => {
        const plain = makeWin({ opaque: false });
        const runtime = shim.createRuntime(plain.win, root);

        expect(runtime.start()).toBe(false);
        expect(plain.parent.postMessage).not.toHaveBeenCalled();
        expect(root.querySelector('#yt')).not.toBeNull();
    });

    it('stays dormant when it is not framed', () => {
        const top = makeWin();
        top.win.parent = top.win;
        const runtime = shim.createRuntime(top.win, root);

        expect(runtime.start()).toBe(false);
        expect(root.querySelector('#yt')).not.toBeNull();
    });

    it('re-syncs on a later host welcome instead of promoting twice', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();
        const answer = { source: ctx.win.parent, data: { type: 'exe-embed', action: 'welcome' } };
        ctx.emit('message', answer);
        const afterFirst = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'sync').length;

        ctx.emit('message', answer);

        const afterSecond = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'sync').length;
        expect(afterSecond).toBeGreaterThan(afterFirst);
        // Still exactly one placeholder: the second answer re-reports, it does not re-promote.
        expect(root.querySelectorAll('[data-exe-embed-id]')).toHaveLength(1);
    });

    /**
     * `request` is the relay's geometry re-sync ping, and it is BROADCAST to every
     * content frame without resolving any of them. Only the addressed `welcome`
     * answer may unlock a document, so a broadcast can never promote a frame the
     * host has not actually accepted.
     */
    it('does not activate on a re-sync ping, only on a welcome', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();

        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'request' } });

        expect(runtime.isActivated()).toBe(false);
        expect(root.querySelector('#yt')).not.toBeNull();
        expect(root.querySelectorAll('[data-exe-embed-id]')).toHaveLength(0);
    });

    it('re-announces when a ping arrives while dormant, so a late host still completes the handshake', () => {
        shim.createRuntime(ctx.win, root).start();
        const before = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'hello').length;

        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'request' } });

        const after = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'hello').length;
        expect(after).toBeGreaterThan(before);
    });

    it('re-reports geometry on a ping once activated', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();
        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'welcome' } });
        const before = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'sync').length;

        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'request' } });

        const after = ctx.parent.postMessage.mock.calls.filter(c => c[0]?.action === 'sync').length;
        expect(after).toBeGreaterThan(before);
        expect(runtime.isActivated()).toBe(true);
    });

    it('treats a parent it cannot reach as framed, so it stays gated on the handshake', () => {
        const unreachable = {};
        Object.defineProperty(unreachable, 'parent', {
            get() {
                throw new Error('cross-origin');
            },
        });
        expect(shim.isFramed(unreachable)).toBe(true);
    });

    it('recognises a PDF against the content location, and against the global when none is given', () => {
        expect(shim.isPdfUrl('handout.pdf', 'https://lms.example/preview/page.html')).toBe(true);
        expect(shim.isPdfUrl('handout.PDF', 'https://lms.example/preview/page.html')).toBe(true);
        expect(shim.isPdfUrl('notes.txt', 'https://lms.example/preview/page.html')).toBe(false);
        // No base: falls back to the global window's location rather than throwing.
        expect(shim.isPdfUrl('handout.pdf')).toBe(true);
    });

    it('reports geometry to the host after activation', () => {
        const runtime = shim.createRuntime(ctx.win, root);
        runtime.start();
        ctx.emit('message', { source: ctx.win.parent, data: { type: 'exe-embed', action: 'welcome' } });

        const sync = ctx.parent.postMessage.mock.calls
            .map((c) => c[0])
            .find((m) => m && m.action === 'sync');
        expect(sync).toBeTruthy();
        expect(sync.embeds).toHaveLength(1);
        expect(sync.embeds[0].provider).toBe('youtube');
        expect(runtime.isActivated()).toBe(true);
    });
});
