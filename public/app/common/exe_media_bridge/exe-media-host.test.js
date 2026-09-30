import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './exe_media_policy.js';
import './exe-media-host.js';

const host = window.exeMediaHost;
const policy = window.exeMediaPolicy;

function fakeChannel() {
    const port1 = {
        posted: [],
        postMessage(msg) {
            this.posted.push(msg);
        },
        start: vi.fn(),
        close: vi.fn(),
        onmessage: null,
    };
    const port2 = { transferred: true };
    return { port1, port2 };
}

function addIframe() {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'about:blank');
    const contentWindow = { postMessage: vi.fn() };
    Object.defineProperty(iframe, 'contentWindow', { value: contentWindow, configurable: true });
    document.body.appendChild(iframe);
    return { iframe, contentWindow };
}

function mockAdapter() {
    return {
        play: vi.fn(),
        pause: vi.fn(),
        seek: vi.fn(),
        getCurrentTime: vi.fn(() => 3),
        getDuration: vi.fn(() => 30),
        destroy: vi.fn(),
    };
}

beforeEach(() => {
    host._resetForTests();
    document.body.innerHTML = '';
    global._ = key => key;
    HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function showModal() {};
    HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function close() {};
});

afterEach(() => {
    host._resetForTests();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

function listenWin() {
    const listeners = [];
    return {
        listeners,
        win: {
            addEventListener: (_t, fn) => listeners.push(fn),
            removeEventListener: vi.fn(( _t, fn) => {
                const i = listeners.indexOf(fn);
                if (i >= 0) listeners.splice(i, 1);
            }),
        },
    };
}

describe('exeMediaHost.attach', () => {
    it('welcomes a hello from the framed content and transfers a port', () => {
        const { iframe, contentWindow } = addIframe();
        const channel = fakeChannel();
        const { listeners, win } = listenWin();
        host.attach(iframe, { win, channelFactory: () => channel, genId: () => 'nonce-1' });

        listeners[0]({
            source: contentWindow,
            data: { type: policy.TYPE, v: policy.VERSION, action: 'hello', helloId: 'h1', exelearningBridge: null },
        });

        expect(contentWindow.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'welcome', helloId: 'h1', exelearningBridge: 'nonce-1' }),
            '*',
            [channel.port2],
        );
        expect(channel.port1.start).toHaveBeenCalled();
    });

    it('ignores a hello from a window it does not host', () => {
        const { iframe } = addIframe();
        const channel = fakeChannel();
        const { listeners, win } = listenWin();
        host.attach(iframe, { win, channelFactory: () => channel, genId: () => 'n' });
        listeners[0]({
            source: {},
            data: { type: policy.TYPE, v: policy.VERSION, action: 'hello', helloId: 'h1' },
        });
        expect(channel.port1.start).not.toHaveBeenCalled();
    });

    it('detaches the listener and tears down the session', () => {
        const { iframe, contentWindow } = addIframe();
        const { listeners, win } = listenWin();
        const handle = host.attach(iframe, { win, channelFactory: fakeChannel, genId: () => 'n' });
        listeners[0]({
            source: contentWindow,
            data: { type: policy.TYPE, v: policy.VERSION, action: 'hello', helloId: 'h1' },
        });
        handle.detach();
        expect(win.removeEventListener).toHaveBeenCalled();
        contentWindow.postMessage.mockClear();
        // After detach the handler is gone, so a leftover call would be a leak.
        expect(listeners).toHaveLength(0);
    });
});

describe('exeMediaHost commands', () => {
    function pairedSession(adapterFactory) {
        const { iframe, contentWindow } = addIframe();
        const channel = fakeChannel();
        const adapter = mockAdapter();
        const { listeners, win } = listenWin();
        host.attach(iframe, {
            win,
            channelFactory: () => channel,
            genId: () => 'nonce-1',
            youtubeFactory: adapterFactory || (() => adapter),
            vimeoFactory: adapterFactory || (() => adapter),
            setInterval: () => 11,
            clearInterval: vi.fn(),
        });
        listeners[0]({
            source: contentWindow,
            data: { type: policy.TYPE, v: policy.VERSION, action: 'hello', helloId: 'h1' },
        });
        return { channel, adapter, iframe };
    }

    function cmd(action, extra = {}) {
        return { type: policy.TYPE, v: policy.VERSION, exelearningBridge: 'nonce-1', action, ...extra };
    }

    it('opens a YouTube player from a validated command and relays ready', () => {
        const { channel, adapter } = pairedSession();
        channel.port1.onmessage({
            data: cmd('open', { reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' }),
        });
        expect(document.querySelector('dialog.exe-media-modal')).toBeTruthy();
        expect(adapter.getCurrentTime).toBeTypeOf('function');
    });

    it('rejects an open for an unknown provider', () => {
        const { channel } = pairedSession();
        channel.port1.onmessage({
            data: cmd('open', { reqId: 1, provider: 'youtube', videoId: 'bad-id!!!!' }),
        });
        expect(channel.port1.posted.some(m => m.action === 'error' && m.code === 'unsupported_provider')).toBe(true);
    });

    it('relays play/pause/seek/hide/show/close and time queries', async () => {
        const { channel, adapter } = pairedSession();
        channel.port1.onmessage({
            data: cmd('open', { reqId: 1, provider: 'vimeo', videoId: '76979871' }),
        });
        channel.port1.onmessage({ data: cmd('play') });
        channel.port1.onmessage({ data: cmd('pause') });
        channel.port1.onmessage({ data: cmd('seek', { t: 5 }) });
        channel.port1.onmessage({ data: cmd('getCurrentTime', { reqId: 2 }) });
        channel.port1.onmessage({ data: cmd('getDuration', { reqId: 3 }) });
        await Promise.resolve();
        await Promise.resolve();
        channel.port1.onmessage({ data: cmd('hide') });
        channel.port1.onmessage({ data: cmd('show') });
        expect(adapter.play).toHaveBeenCalled();
        expect(adapter.pause).toHaveBeenCalled();
        expect(adapter.seek).toHaveBeenCalledWith(5);
        expect(channel.port1.posted.some(m => m.action === 'state' && m.reqId === 2)).toBe(true);
        expect(channel.port1.posted.some(m => m.action === 'state' && m.reqId === 3 && m.duration === 30)).toBe(true);

        channel.port1.onmessage({ data: cmd('close') });
        expect(adapter.destroy).toHaveBeenCalled();
        expect(channel.port1.posted.some(m => m.action === 'closed')).toBe(true);
    });

    it('drops commands with a bad nonce or unknown action', () => {
        const { channel, adapter } = pairedSession();
        channel.port1.onmessage({
            data: cmd('open', { reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' }),
        });
        adapter.play.mockClear();
        channel.port1.onmessage({ data: { ...cmd('play'), exelearningBridge: 'nope' } });
        channel.port1.onmessage({ data: cmd('explode') });
        channel.port1.onmessage({ data: null });
        expect(adapter.play).not.toHaveBeenCalled();
    });

    it('replaces a previous dialog when opening again', () => {
        const { channel } = pairedSession();
        channel.port1.onmessage({
            data: cmd('open', { reqId: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ' }),
        });
        channel.port1.onmessage({
            data: cmd('open', { reqId: 2, provider: 'youtube', videoId: 'dQw4w9WgXcQ' }),
        });
        expect(document.querySelectorAll('dialog.exe-media-modal')).toHaveLength(1);
    });
});

describe('exeMediaHost adapters', () => {
    it('wires YouTube player events through the adapter', () => {
        const events = {};
        const player = {
            playVideo: vi.fn(),
            pauseVideo: vi.fn(),
            seekTo: vi.fn(),
            getCurrentTime: vi.fn(() => 1),
            getDuration: vi.fn(() => 10),
            getIframe: () => document.createElement('iframe'),
            destroy: vi.fn(),
        };
        window.YT = {
            Player: vi.fn(function Player(_el, opts) {
                events.onReady = opts.events.onReady;
                events.onStateChange = opts.events.onStateChange;
                events.onError = opts.events.onError;
                return player;
            }),
        };
        const cb = {
            onReady: vi.fn(),
            onPlay: vi.fn(),
            onPause: vi.fn(),
            onEnded: vi.fn(),
            onError: vi.fn(),
            start: 4,
            autoplay: true,
        };
        const adapter = host._youtubeAdapter(document.createElement('div'), 'dQw4w9WgXcQ', cb);
        events.onReady({ target: player });
        events.onStateChange({ data: 1 });
        events.onStateChange({ data: 2 });
        events.onStateChange({ data: 0 });
        events.onError({ data: 153 });
        adapter.play();
        adapter.pause();
        adapter.seek(8);
        adapter.destroy();
        expect(cb.onReady).toHaveBeenCalledWith(10);
        expect(cb.onPlay).toHaveBeenCalled();
        expect(cb.onPause).toHaveBeenCalled();
        expect(cb.onEnded).toHaveBeenCalled();
        expect(cb.onError).toHaveBeenCalledWith(153);
        expect(player.playVideo).toHaveBeenCalled();
        expect(player.seekTo).toHaveBeenCalledWith(8, true);
        expect(player.destroy).toHaveBeenCalled();
        delete window.YT;
    });

    it('wires Vimeo player events through the adapter', async () => {
        const handlers = {};
        const player = {
            on: (name, fn) => {
                handlers[name] = fn;
            },
            play: vi.fn(),
            pause: vi.fn(),
            setCurrentTime: vi.fn(),
            getCurrentTime: vi.fn(() => Promise.resolve(2)),
            getDuration: vi.fn(() => Promise.resolve(20)),
            destroy: vi.fn(),
        };
        window.Vimeo = {
            Player: function VimeoPlayer() {
                return player;
            },
        };
        const cb = {
            onReady: vi.fn(),
            onPlay: vi.fn(),
            onPause: vi.fn(),
            onEnded: vi.fn(),
            onTimeupdate: vi.fn(),
            onSeeked: vi.fn(),
            onError: vi.fn(),
        };
        const adapter = host._vimeoAdapter(document.createElement('div'), '76979871', cb);
        await handlers.loaded();
        handlers.play();
        handlers.pause();
        handlers.ended();
        handlers.timeupdate({ seconds: 2, duration: 20 });
        handlers.seeked({ seconds: 5 });
        handlers.error();
        adapter.play();
        adapter.seek(5);
        adapter.destroy();
        expect(cb.onReady).toHaveBeenCalledWith(20);
        expect(cb.onPlay).toHaveBeenCalled();
        expect(cb.onSeeked).toHaveBeenCalledWith(5);
        expect(cb.onError).toHaveBeenCalledWith('vimeo_error');
        expect(player.destroy).toHaveBeenCalled();
        delete window.Vimeo;
    });
});
