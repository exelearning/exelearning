/**
 * Unit tests for exe-media-host — the reference PARENT-side relay that host plugins
 * (Moodle/WordPress/Procomún) drop into the trusted page. It validates the capability
 * handshake from the opaque child, opens an accessible <dialog> with the real
 * YouTube/Vimeo player, and relays media commands/events over a private MessageChannel.
 *
 * Loaded for its side effect; depends on the shared policy global (imported first).
 */

import './exe_media_policy.js';
import './exe-media-host.js';

const host = globalThis.exeMediaHost;
const policy = globalThis.exeMediaPolicy;

/** Two linked fake MessagePorts: posting on one delivers to the other's onmessage. */
function makeFakeChannel() {
    const port1 = { onmessage: null, started: false, start() { this.started = true; }, close() { this.closed = true; } };
    const port2 = { onmessage: null, started: false, start() { this.started = true; }, close() { this.closed = true; } };
    port1.postMessage = (m) => { if (port2.onmessage) port2.onmessage({ data: m }); };
    port2.postMessage = (m) => { if (port1.onmessage) port1.onmessage({ data: m }); };
    return { port1, port2 };
}

/** A fake iframe whose contentWindow records postMessage calls (msg, targetOrigin, transfer). */
function makeIframe() {
    const posts = [];
    return {
        _posts: posts,
        contentWindow: {
            postMessage(m, o, t) {
                posts.push({ m, o, t });
            },
        },
    };
}

/** A fake window the relay attaches its 'message' listener to. */
function makeWin() {
    const handlers = [];
    return {
        addEventListener(t, cb) { if (t === 'message') handlers.push(cb); },
        removeEventListener(t, cb) { const i = handlers.indexOf(cb); if (i >= 0) handlers.splice(i, 1); },
        _emit(evt) { handlers.slice().forEach((h) => h(evt)); },
    };
}

/** A fake provider adapter factory exposing the callbacks so tests can fire player events. */
function makeFakeFactory() {
    const state = { created: [], adapter: null, callbacks: null, container: null };
    function factory(container, videoId, callbacks) {
        state.created.push({ container, videoId, callbacks });
        state.container = container;
        state.callbacks = callbacks;
        state.adapter = {
            calls: [],
            destroyed: false,
            play() { this.calls.push('play'); },
            pause() { this.calls.push('pause'); },
            seek(t) { this.calls.push(['seek', t]); },
            getCurrentTime() { return 42; },
            getDuration() { return 100; },
            destroy() { this.destroyed = true; },
        };
        return state.adapter;
    }
    return { factory, state };
}

const TYPE = 'exe-media';
const V = 1;

describe('exe-media-host', () => {
    beforeEach(() => host._resetForTests && host._resetForTests());
    afterEach(() => {
        if (typeof document !== 'undefined') {
            document.querySelectorAll('dialog.exe-media-modal').forEach((d) => d.remove());
        }
    });

    it('exposes attach + the expected surface', () => {
        expect(host).toBeTruthy();
        expect(typeof host.attach).toBe('function');
    });

    describe('handshake', () => {
        it('replies with a welcome transferring a port on a valid hello from the iframe', () => {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => ch });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            expect(iframe._posts).toHaveLength(1);
            const post = iframe._posts[0];
            expect(post.m).toMatchObject({ type: TYPE, v: V, action: 'welcome', helloId: 'H1', exelearningBridge: 'N1' });
            expect(post.o).toBe('*');
            expect(post.t).toEqual([ch.port2]);
        });

        it('ignores a hello whose source is not the iframe contentWindow', () => {
            const win = makeWin();
            const iframe = makeIframe();
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => makeFakeChannel() });
            win._emit({ source: { not: 'it' }, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            expect(iframe._posts).toHaveLength(0);
        });

        it('ignores a duplicate hello with the same helloId', () => {
            const win = makeWin();
            const iframe = makeIframe();
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => makeFakeChannel() });
            const hello = { source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } };
            win._emit(hello);
            win._emit(hello);
            expect(iframe._posts).toHaveLength(1);
        });

        it('re-pairs when a new helloId arrives (frame reloaded)', () => {
            const win = makeWin();
            const iframe = makeIframe();
            let n = 0;
            host.attach(iframe, { win, genId: () => 'N' + ++n, channelFactory: () => makeFakeChannel() });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H2' } });
            expect(iframe._posts).toHaveLength(2);
            expect(iframe._posts[1].m.helloId).toBe('H2');
            expect(iframe._posts[1].m.exelearningBridge).toBe('N2');
        });

        it('detach() stops listening', () => {
            const win = makeWin();
            const iframe = makeIframe();
            const handle = host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => makeFakeChannel() });
            handle.detach();
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            expect(iframe._posts).toHaveLength(0);
        });
    });

    describe('commands over the port', () => {
        function setup(extraOpts) {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const fab = makeFakeFactory();
            const events = [];
            ch.port2.onmessage = (e) => events.push(e.data);
            const opts = Object.assign(
                { win, genId: () => 'N1', channelFactory: () => ch, youtubeFactory: fab.factory, vimeoFactory: fab.factory },
                extraOpts,
            );
            host.attach(iframe, opts);
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            const send = (cmd) => ch.port2.postMessage(Object.assign({ type: TYPE, v: V, exelearningBridge: 'N1' }, cmd));
            return { win, iframe, ch, fab, events, send };
        }

        it('rejects a command carrying the wrong nonce', () => {
            const { ch, fab } = setup();
            ch.port2.postMessage({ type: TYPE, v: V, exelearningBridge: 'WRONG', action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect(fab.state.adapter).toBeNull();
        });

        it('emits a fatal error and opens no modal for an unsupported provider', () => {
            const { send, events, fab } = setup();
            send({ action: 'open', reqId: 1, provider: 'evil', videoId: 'xxxxxxxxxxx' });
            expect(fab.state.adapter).toBeNull();
            expect(events.find((e) => e.action === 'error' && e.fatal === true)).toBeTruthy();
        });

        it('on a valid open, builds the player from the bare id and reconstructs the canonical url', () => {
            const { send, fab } = setup();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect(fab.state.adapter).toBeTruthy();
            expect(fab.state.created[0].videoId).toBe('dQw4w9WgXcQ');
            expect(policy.canonicalEmbedUrl('youtube', 'dQw4w9WgXcQ')).toBe(
                'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            );
        });

        it('routes play/pause/seek to the adapter', () => {
            const { send, fab } = setup();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            send({ action: 'play' });
            send({ action: 'pause' });
            send({ action: 'seek', t: 9 });
            expect(fab.state.adapter.calls).toEqual(['play', 'pause', ['seek', 9]]);
        });

        it('answers getCurrentTime/getDuration with a state event echoing reqId', async () => {
            const { send, events } = setup();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            send({ action: 'getCurrentTime', reqId: 7 });
            send({ action: 'getDuration', reqId: 8 });
            await Promise.resolve();
            await Promise.resolve();
            expect(events.find((e) => e.action === 'state' && e.reqId === 7 && e.currentTime === 42)).toBeTruthy();
            expect(events.find((e) => e.action === 'state' && e.reqId === 8 && e.duration === 100)).toBeTruthy();
        });
    });

    describe('adapter event mapping', () => {
        function setup() {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const fab = makeFakeFactory();
            const events = [];
            const intervals = [];
            ch.port2.onmessage = (e) => events.push(e.data);
            host.attach(iframe, {
                win,
                genId: () => 'N1',
                channelFactory: () => ch,
                youtubeFactory: fab.factory,
                setInterval: (cb) => { intervals.push(cb); return intervals.length; },
                clearInterval: () => {},
            });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            ch.port2.postMessage({ type: TYPE, v: V, exelearningBridge: 'N1', action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            return { fab, events, intervals };
        }

        it('forwards ready/play/pause/ended and starts the timeupdate poll', () => {
            const { fab, events, intervals } = setup();
            const cb = fab.state.callbacks;
            cb.onReady(100);
            cb.onPlay();
            cb.onPause();
            cb.onEnded();
            expect(events.find((e) => e.action === 'ready' && e.duration === 100)).toBeTruthy();
            expect(events.filter((e) => ['play', 'pause', 'ended'].includes(e.action)).map((e) => e.action)).toEqual([
                'play',
                'pause',
                'ended',
            ]);
            // The poll started on ready; firing it emits a timeupdate from the adapter clock.
            expect(intervals).toHaveLength(1);
            intervals[0]();
            expect(events.find((e) => e.action === 'timeupdate' && e.currentTime === 42 && e.duration === 100)).toBeTruthy();
        });

        it('maps onSeeked and onError to the corresponding events', () => {
            const { fab, events } = setup();
            fab.state.callbacks.onSeeked(5);
            fab.state.callbacks.onError(150);
            expect(events.find((e) => e.action === 'seeked' && e.currentTime === 5)).toBeTruthy();
            const err = events.find((e) => e.action === 'error');
            expect(err).toMatchObject({ code: '150', fatal: true });
        });
    });

    describe('accessible modal', () => {
        function setupReal() {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const fab = makeFakeFactory();
            const events = [];
            ch.port2.onmessage = (e) => events.push(e.data);
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => ch, youtubeFactory: fab.factory, document });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            const send = (cmd) => ch.port2.postMessage(Object.assign({ type: TYPE, v: V, exelearningBridge: 'N1' }, cmd));
            return { fab, events, send };
        }

        it('creates an accessible dialog with a close button on open', () => {
            const { send } = setupReal();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            const dialog = document.querySelector('dialog.exe-media-modal');
            expect(dialog).toBeTruthy();
            expect(dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby')).toBeTruthy();
            const close = dialog.querySelector('button.exe-media-modal__close');
            expect(close).toBeTruthy();
            expect(close.getAttribute('type')).toBe('button');
        });

        it('emits closed and destroys the adapter when the close button is clicked', () => {
            const { send, events, fab } = setupReal();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            const close = document.querySelector('dialog.exe-media-modal button.exe-media-modal__close');
            close.dispatchEvent(new window.Event('click'));
            expect(events.find((e) => e.action === 'closed')).toBeTruthy();
            expect(fab.state.adapter.destroyed).toBe(true);
        });

        it('hide closes the dialog WITHOUT destroying the adapter; show reopens it', () => {
            const { send, fab } = setupReal();
            send({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            send({ action: 'hide' });
            expect(fab.state.adapter.destroyed).toBe(false);
            send({ action: 'show' });
            expect(fab.state.adapter.destroyed).toBe(false);
        });

        it('calls showModal on a document that provides it', () => {
            const calls = { showModal: 0, close: 0, appended: 0 };
            const fakeDoc = {
                createElement(tag) {
                    const el = {
                        tag,
                        children: [],
                        attrs: {},
                        listeners: {},
                        setAttribute(k, v) { this.attrs[k] = v; },
                        getAttribute(k) { return this.attrs[k]; },
                        appendChild(c) { this.children.push(c); return c; },
                        addEventListener(t, cb) { (this.listeners[t] = this.listeners[t] || []).push(cb); },
                        querySelector() { return null; },
                    };
                    if (tag === 'dialog') {
                        el.showModal = () => { calls.showModal++; el.open = true; };
                        el.close = () => { calls.close++; el.open = false; };
                    }
                    return el;
                },
                body: { appendChild() { calls.appended++; } },
            };
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const fab = makeFakeFactory();
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => ch, youtubeFactory: fab.factory, document: fakeDoc });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            ch.port2.postMessage({ type: TYPE, v: V, exelearningBridge: 'N1', action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect(calls.showModal).toBe(1);
            expect(calls.appended).toBe(1);
        });
    });

    describe('default provider adapters', () => {
        it('builds a YouTube adapter wired to a YT.Player-like global', () => {
            const ytCalls = [];
            const fakePlayer = {
                playVideo() { ytCalls.push('play'); },
                pauseVideo() { ytCalls.push('pause'); },
                seekTo(t, a) { ytCalls.push(['seek', t, a]); },
                getCurrentTime() { return 12; },
                getDuration() { return 120; },
                destroy() { ytCalls.push('destroy'); },
            };
            let captured;
            globalThis.YT = {
                Player: function (container, cfg) {
                    captured = cfg;
                    Object.assign(this, fakePlayer);
                    // simulate ready + a state change
                    if (cfg.events && cfg.events.onReady) cfg.events.onReady({ target: this });
                    if (cfg.events && cfg.events.onStateChange) cfg.events.onStateChange({ data: 1 });
                    if (cfg.events && cfg.events.onError) cfg.events.onError({ data: 150 });
                    return this;
                },
            };
            try {
                const fired = [];
                const adapter = host._youtubeAdapter(document.createElement('div'), 'dQw4w9WgXcQ', {
                    start: 5,
                    onReady: (d) => fired.push(['ready', d]),
                    onPlay: () => fired.push('play'),
                    onPause: () => fired.push('pause'),
                    onEnded: () => fired.push('ended'),
                    onError: (c) => fired.push(['error', c]),
                });
                // Cover the remaining YT state codes.
                captured.events.onStateChange({ data: 2 });
                captured.events.onStateChange({ data: 0 });
                adapter.play();
                adapter.pause();
                adapter.seek(3);
                expect(ytCalls).toContain('play');
                expect(ytCalls).toContain('pause');
                expect(adapter.getCurrentTime()).toBe(12);
                expect(adapter.getDuration()).toBe(120);
                // host is reconstructed to the privacy-friendly nocookie domain.
                expect(captured.host).toBe('https://www.youtube-nocookie.com');
                expect(fired.find((f) => Array.isArray(f) && f[0] === 'ready')).toBeTruthy();
                expect(fired).toContain('play'); // state 1 → onPlay
                expect(fired).toContain('pause'); // state 2 → onPause
                expect(fired).toContain('ended'); // state 0 → onEnded
                expect(fired.find((f) => Array.isArray(f) && f[0] === 'error')).toBeTruthy();
                adapter.destroy();
                expect(ytCalls).toContain('destroy');
            } finally {
                delete globalThis.YT;
            }
        });

        it('builds a Vimeo adapter wired to a Vimeo.Player-like global', async () => {
            const vcalls = [];
            const handlers = {};
            globalThis.Vimeo = {
                Player: function () {
                    this.play = () => vcalls.push('play');
                    this.pause = () => vcalls.push('pause');
                    this.setCurrentTime = (t) => vcalls.push(['seek', t]);
                    this.getCurrentTime = () => Promise.resolve(7);
                    this.getDuration = () => Promise.resolve(70);
                    this.on = (ev, cb) => { handlers[ev] = cb; };
                    this.destroy = () => vcalls.push('destroy');
                    return this;
                },
            };
            try {
                const fired = [];
                const adapter = host._vimeoAdapter(document.createElement('div'), '76979871', {
                    onReady: (d) => fired.push(['ready', d]),
                    onPlay: () => fired.push('play'),
                    onPause: () => fired.push('pause'),
                    onEnded: () => fired.push('ended'),
                    onSeeked: (t) => fired.push(['seeked', t]),
                    onError: () => fired.push('error'),
                });
                adapter.play();
                adapter.pause();
                adapter.seek(4);
                handlers.loaded && handlers.loaded();
                handlers.play && handlers.play();
                handlers.pause && handlers.pause();
                handlers.ended && handlers.ended();
                handlers.timeupdate && handlers.timeupdate({ seconds: 3, duration: 70 });
                handlers.seeked && handlers.seeked({ seconds: 4 });
                handlers.error && handlers.error();
                await Promise.resolve();
                expect(fired.find((f) => Array.isArray(f) && f[0] === 'ready' && f[1] === 70)).toBeTruthy();
                await expect(adapter.getCurrentTime()).resolves.toBe(7);
                expect(vcalls).toContain('play');
                expect(vcalls).toContain('pause');
                expect(vcalls.find((c) => Array.isArray(c) && c[0] === 'seek')).toBeTruthy();
                expect(fired).toContain('play');
                expect(fired).toContain('pause');
                expect(fired).toContain('ended');
                expect(fired).toContain('error');
                expect(fired.find((f) => Array.isArray(f) && f[0] === 'seeked' && f[1] === 4)).toBeTruthy();
                adapter.destroy();
                expect(vcalls).toContain('destroy');
            } finally {
                delete globalThis.Vimeo;
            }
        });
    });

    describe('defaults and lifecycle', () => {
        it('mints a nonce with crypto.randomUUID when no genId is injected', () => {
            const win = makeWin();
            const iframe = makeIframe();
            host.attach(iframe, { win, channelFactory: () => makeFakeChannel() });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            expect(typeof iframe._posts[0].m.exelearningBridge).toBe('string');
            expect(iframe._posts[0].m.exelearningBridge.length).toBeGreaterThan(0);
        });

        it('uses a real MessageChannel when no channelFactory is injected', () => {
            if (typeof MessageChannel === 'undefined') return; // engine without MessageChannel
            const win = makeWin();
            const iframe = makeIframe();
            host.attach(iframe, { win, genId: () => 'N1' });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            expect(iframe._posts[0].t).toHaveLength(1); // a transferred MessagePort
        });

        it('detach() tears down an active session', () => {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const fab = makeFakeFactory();
            const handle = host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => ch, youtubeFactory: fab.factory });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            ch.port2.postMessage({ type: TYPE, v: V, exelearningBridge: 'N1', action: 'open', reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            handle.detach();
            expect(fab.state.adapter.destroyed).toBe(true);
            expect(ch.port1.closed).toBe(true);
        });

        it('a getCurrentTime before any open is a safe no-op', () => {
            const win = makeWin();
            const iframe = makeIframe();
            const ch = makeFakeChannel();
            const events = [];
            ch.port2.onmessage = (e) => events.push(e.data);
            host.attach(iframe, { win, genId: () => 'N1', channelFactory: () => ch });
            win._emit({ source: iframe.contentWindow, data: { type: TYPE, v: V, action: 'hello', helloId: 'H1' } });
            ch.port2.postMessage({ type: TYPE, v: V, exelearningBridge: 'N1', action: 'getCurrentTime', reqId: 3 });
            expect(events.find((e) => e.action === 'state')).toBeFalsy();
        });
    });
});
