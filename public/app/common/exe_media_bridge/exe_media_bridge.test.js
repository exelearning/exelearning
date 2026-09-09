import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './exe_media_policy.js';
import './exe_media_bridge.js';

const bridge = window.exeMediaBridge;
const policy = window.exeMediaPolicy;

function fakePort() {
    return {
        posted: [],
        postMessage(msg) {
            this.posted.push(msg);
        },
        start: vi.fn(),
    };
}

function event(action, extra = {}) {
    return { type: policy.TYPE, v: policy.VERSION, action, ...extra };
}

beforeEach(() => {
    bridge._resetForTests();
    delete window.exeEmbedShim;
    delete window.$exe_i18n;
});

afterEach(() => {
    bridge._resetForTests();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('exeMediaBridge detection', () => {
    it('treats origin "null" or a throwing origin as opaque', () => {
        expect(bridge.isSandboxedOpaque({ origin: 'null' })).toBe(true);
        expect(
            bridge.isSandboxedOpaque(
                new Proxy(
                    {},
                    {
                        get() {
                            throw new Error('blocked');
                        },
                    },
                ),
            ),
        ).toBe(true);
    });

    it('probes localStorage and reports opaque when storage throws', () => {
        expect(bridge.isSandboxedOpaque({ origin: 'https://example', localStorage: { setItem() {}, removeItem() {} } })).toBe(
            false,
        );
        expect(
            bridge.isSandboxedOpaque({
                origin: 'https://example',
                localStorage: {
                    setItem() {
                        throw new Error('denied');
                    },
                },
            }),
        ).toBe(true);
    });

    it('detects an iframe even when top access throws', () => {
        const win = { self: {} };
        win.top = win.self;
        expect(bridge.inIframe(win)).toBe(false);
        expect(
            bridge.inIframe(
                new Proxy(
                    { self: {} },
                    {
                        get(target, prop) {
                            if (prop === 'top') throw new Error('cross-origin');
                            return target[prop];
                        },
                    },
                ),
            ),
        ).toBe(true);
    });

    it('only uses the bridge inside an opaque iframe', () => {
        const opaqueFrame = { origin: 'null', self: {}, top: {} };
        expect(bridge.shouldUseBridge(opaqueFrame)).toBe(true);
        const topWindow = { origin: 'https://app', self: null, top: null, localStorage: { setItem() {}, removeItem() {} } };
        topWindow.self = topWindow;
        topWindow.top = topWindow;
        expect(bridge.shouldUseBridge(topWindow)).toBe(false);
    });
});

describe('createBridgeController', () => {
    it('posts validated commands and ignores invalid ones', () => {
        const port = fakePort();
        const ctl = bridge.createBridgeController({ port, nonce: 'n1' });
        ctl.play();
        ctl.pause();
        ctl.seek(4);
        ctl.hide();
        ctl.show();
        ctl.close();
        ctl.open({ provider: 'youtube', videoId: 'dQw4w9WgXcQ', start: 1, autoplay: false });
        expect(port.posted.every(m => m.exelearningBridge === 'n1')).toBe(true);
        expect(port.posted.map(m => m.action)).toEqual(['play', 'pause', 'seek', 'hide', 'show', 'close', 'open']);
        const before = port.posted.length;
        ctl.seek(-1);
        expect(port.posted.length).toBe(before);
    });

    it('fans events to listeners and isolates a throwing listener', () => {
        const ctl = bridge.createBridgeController({ port: fakePort(), nonce: 'n1' });
        const good = vi.fn();
        const bad = vi.fn(() => {
            throw new Error('listener boom');
        });
        ctl.on('play', bad);
        ctl.on('play', good);
        ctl.handleEvent(event('play'));
        expect(good).toHaveBeenCalledOnce();
        ctl.off('play', good);
        ctl.handleEvent(event('play'));
        expect(good).toHaveBeenCalledOnce();
    });

    it('resolves getCurrentTime / getDuration via state replies', async () => {
        const port = fakePort();
        const ctl = bridge.createBridgeController({ port, nonce: 'n1' });
        const timeP = ctl.getCurrentTime();
        const durP = ctl.getDuration();
        const timeReq = port.posted.find(m => m.action === 'getCurrentTime');
        const durReq = port.posted.find(m => m.action === 'getDuration');
        ctl.handleEvent(event('state', { reqId: timeReq.reqId, currentTime: 7 }));
        ctl.handleEvent(event('state', { reqId: durReq.reqId, duration: 90 }));
        await expect(timeP).resolves.toBe(7);
        await expect(durP).resolves.toBe(90);
    });

    it('drops invalid events and ignores them after supersede', () => {
        const ctl = bridge.createBridgeController({ port: fakePort(), nonce: 'n1' });
        const closed = vi.fn();
        ctl.on('closed', closed);
        ctl.handleEvent({ type: 'nope' });
        ctl._supersede();
        expect(closed).toHaveBeenCalledWith(expect.objectContaining({ superseded: true }));
        ctl.handleEvent(event('play'));
        ctl._supersede();
    });

    it('supersedes the previous controller when a new one binds the same port', () => {
        const port = fakePort();
        const first = bridge.createBridgeController({ port, nonce: 'n1' });
        const closed = vi.fn();
        first.on('closed', closed);
        const second = bridge.createBridgeController({ port, nonce: 'n1' });
        expect(closed).toHaveBeenCalled();
        port.onmessage({ data: event('play') });
        expect(second).toBeTruthy();
        expect(port.start).toHaveBeenCalledOnce();
    });
});

describe('ensureSession / openMedia', () => {
    it('resolves null when there is no parent window', async () => {
        const win = {};
        win.parent = win;
        await expect(bridge.ensureSession({ win, fresh: true })).resolves.toBeNull();
    });

    it('accepts a welcome from the parent that carries a port', async () => {
        const listeners = [];
        const parent = { postMessage: vi.fn() };
        const win = {
            parent,
            addEventListener: (_t, fn) => listeners.push(fn),
            removeEventListener: vi.fn(),
        };
        const pending = bridge.ensureSession({ win, fresh: true, genId: () => 'hello-1', timeoutMs: 5000 });
        expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'hello', helloId: 'hello-1' }), '*');
        const port = fakePort();
        listeners[0]({
            source: parent,
            data: { type: policy.TYPE, v: policy.VERSION, action: 'welcome', helloId: 'hello-1', exelearningBridge: 'nonce-1' },
            ports: [port],
        });
        await expect(pending).resolves.toEqual({ nonce: 'nonce-1', port });
    });

    it('times out when the parent never answers', async () => {
        vi.useFakeTimers();
        const parent = { postMessage: vi.fn() };
        const win = {
            parent,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        const pending = bridge.ensureSession({ win, fresh: true, timeoutMs: 100 });
        await vi.advanceTimersByTimeAsync(100);
        await expect(pending).resolves.toBeNull();
    });

    function framedWin() {
        const listeners = [];
        const parent = { postMessage: vi.fn() };
        return {
            listeners,
            parent,
            win: {
                parent,
                addEventListener: (_t, fn) => listeners.push(fn),
                removeEventListener: vi.fn(),
            },
        };
    }

    function welcome(listeners, parent, port, helloId = 'hello-1') {
        listeners[0]({
            source: parent,
            data: {
                type: policy.TYPE,
                v: policy.VERSION,
                action: 'welcome',
                helloId,
                exelearningBridge: 'n1',
            },
            ports: [port],
        });
    }

    it('opens media once the player reports ready', async () => {
        const port = fakePort();
        const { listeners, parent, win } = framedWin();
        const pending = bridge.openMedia({
            provider: 'youtube',
            videoId: 'dQw4w9WgXcQ',
            win,
            genId: () => 'hello-1',
        });
        welcome(listeners, parent, port);
        await vi.waitFor(() => expect(typeof port.onmessage).toBe('function'));
        port.onmessage({ data: event('ready', { duration: 10 }) });
        const ctl = await pending;
        expect(ctl.play).toBeTypeOf('function');
        expect(port.posted.some(m => m.action === 'open')).toBe(true);
    });

    it('rejects when there is no parent bridge', async () => {
        const win = {};
        win.parent = win;
        await expect(bridge.openMedia({ provider: 'youtube', videoId: 'dQw4w9WgXcQ', win, fresh: true })).rejects.toThrow(
            'no-bridge',
        );
    });

    it('rejects on a fatal player error before ready', async () => {
        const port = fakePort();
        const { listeners, parent, win } = framedWin();
        const pending = bridge.openMedia({
            provider: 'youtube',
            videoId: 'dQw4w9WgXcQ',
            win,
            genId: () => 'hello-1',
        });
        welcome(listeners, parent, port);
        await vi.waitFor(() => expect(typeof port.onmessage).toBe('function'));
        port.onmessage({ data: event('error', { code: 'embed_denied', fatal: true }) });
        await expect(pending).rejects.toThrow('embed_denied');
    });
});

describe('placeholders and scanAndReplace', () => {
    it('builds a play button for bridged media and a new-tab link when degraded', () => {
        const yt = policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ');
        const play = bridge.buildPlaceholder(yt, { document });
        expect(play.querySelector('button.exe-external-media__open')).toBeTruthy();
        expect(play.getAttribute('data-exe-media-provider')).toBe('youtube');

        const pdf = policy.parseExternalMedia('https://example.com/a.pdf');
        const link = bridge.buildPlaceholder(pdf, { document, degraded: true });
        const a = link.querySelector('a.exe-external-media__open');
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toContain('noopener');
    });

    it('uses $exe_i18n when present', () => {
        window.$exe_i18n = { exeMediaPlay: 'Reproducir' };
        const yt = policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ');
        const play = bridge.buildPlaceholder({ ...yt, title: 'Song' }, { document });
        expect(play.querySelector('button').textContent).toBe('Reproducir');
    });

    it('is a no-op when the page is not an opaque iframe', async () => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'about:blank');
        document.body.appendChild(iframe);
        const top = { origin: 'https://app', self: null, top: null, localStorage: { setItem() {}, removeItem() {} } };
        top.self = top;
        top.top = top;
        await expect(bridge.scanAndReplace(document.body, { win: top })).resolves.toEqual([]);
        expect(document.querySelector('iframe')).toBe(iframe);
    });

    it('defers to exeEmbedShim when present', async () => {
        window.exeEmbedShim = {};
        const opaque = { origin: 'null', self: {}, top: {} };
        await expect(bridge.scanAndReplace(document.body, { win: opaque })).resolves.toEqual([]);
    });

    it('replaces recognized embeds with placeholders in opaque mode', async () => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'about:blank');
        document.body.appendChild(iframe);
        // Avoid happy-dom fetching YouTube: parseExternalMedia reads getAttribute('src').
        iframe.getAttribute = name => (name === 'src' ? 'https://www.youtube.com/embed/dQw4w9WgXcQ' : '');
        const opaque = { origin: 'null', self: {}, top: {} };
        const listeners = [];
        const parent = { postMessage: vi.fn() };
        opaque.parent = parent;
        opaque.addEventListener = (_t, fn) => listeners.push(fn);
        opaque.removeEventListener = vi.fn();
        // Degraded path: no welcome arrives, so placeholders become open-in-new-tab.
        const placeholders = await bridge.scanAndReplace(document.body, { win: opaque, timeoutMs: 20 });
        expect(placeholders).toHaveLength(1);
        expect(document.querySelector('iframe')).toBeNull();
        expect(document.querySelector('.exe-external-media--degraded')).toBeTruthy();
    });

    it('autoInit is a no-op without a document and wires DOMContentLoaded when loading', () => {
        expect(bridge.autoInit({}, null)).toBe(false);
        const listeners = [];
        const doc = {
            readyState: 'loading',
            addEventListener: (type, fn) => listeners.push({ type, fn }),
            body: document.createElement('div'),
        };
        expect(bridge.autoInit({ origin: 'https://app', self: null }, doc)).toBe(true);
        expect(listeners[0].type).toBe('DOMContentLoaded');
    });
});
