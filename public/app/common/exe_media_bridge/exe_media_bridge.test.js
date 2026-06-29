/**
 * Unit tests for exe_media_bridge — the child-side runtime shipped inside exported
 * eXeLearning packages. It detects an opaque-origin sandboxed iframe, performs the
 * capability handshake with the trusted parent, exposes a provider-neutral
 * BridgeController for the video iDevices, and replaces nested YouTube/Vimeo embeds
 * with an accessible placeholder (degrading to open-in-new-tab when no parent answers).
 *
 * Loaded for its side effect; it reads its policy dependency from the global, so the
 * policy is imported first.
 */

import './exe_media_policy.js';
import './exe_media_bridge.js';

const bridge = globalThis.exeMediaBridge;
const policy = globalThis.exeMediaPolicy;

/** Minimal fake of a MessagePort: records posted messages, lets tests push inbound. */
function makeFakePort() {
    return {
        posted: [],
        onmessage: null,
        started: false,
        postMessage(msg) {
            this.posted.push(msg);
        },
        start() {
            this.started = true;
        },
        close() {
            this.closed = true;
        },
        _deliver(data) {
            if (this.onmessage) this.onmessage({ data });
        },
    };
}

describe('exe_media_bridge', () => {
    it('exposes the expected runtime surface', () => {
        expect(bridge).toBeTruthy();
        expect(typeof bridge.isSandboxedOpaque).toBe('function');
        expect(typeof bridge.shouldUseBridge).toBe('function');
        expect(typeof bridge.openMedia).toBe('function');
        expect(typeof bridge.buildPlaceholder).toBe('function');
        expect(typeof bridge.createBridgeController).toBe('function');
    });

    describe('isSandboxedOpaque', () => {
        it('is true when the window origin is the opaque string "null"', () => {
            const win = { origin: 'null', localStorage: window.localStorage };
            expect(bridge.isSandboxedOpaque(win)).toBe(true);
        });

        it('is true when storage access throws (partitioned/opaque)', () => {
            const win = {
                origin: 'https://host.example',
                get localStorage() {
                    throw new DOMException('denied', 'SecurityError');
                },
            };
            expect(bridge.isSandboxedOpaque(win)).toBe(true);
        });

        it('is false for a normal same-origin window with working storage', () => {
            const store = {};
            const win = {
                origin: 'https://host.example',
                localStorage: {
                    setItem(k, v) {
                        store[k] = v;
                    },
                    removeItem(k) {
                        delete store[k];
                    },
                },
            };
            expect(bridge.isSandboxedOpaque(win)).toBe(false);
        });
    });

    describe('createBridgeController', () => {
        it('open() posts a validated open command carrying the nonce', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            ctl.open({ provider: 'youtube', videoId: 'dQw4w9WgXcQ', start: 5 });
            expect(port.posted).toHaveLength(1);
            const msg = port.posted[0];
            expect(msg.action).toBe('open');
            expect(msg.exelearningBridge).toBe('N1');
            expect(policy.validateCommand(msg, 'N1')).toBe(true);
        });

        it('play/pause/seek post validated commands', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            ctl.play();
            ctl.pause();
            ctl.seek(12.5);
            expect(port.posted.map((m) => m.action)).toEqual(['play', 'pause', 'seek']);
            expect(port.posted.every((m) => policy.validateCommand(m, 'N1'))).toBe(true);
            expect(port.posted[2].t).toBe(12.5);
        });

        it('hide/show/close post their commands (used by interactive-video question sync)', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            ctl.hide();
            ctl.show();
            ctl.close();
            expect(port.posted.map((m) => m.action)).toEqual(['hide', 'show', 'close']);
        });

        it('dispatches inbound timeupdate/ready/ended events to on() subscribers', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            const times = [];
            let ready = false;
            let ended = false;
            ctl.on('timeupdate', (e) => times.push(e.currentTime));
            ctl.on('ready', () => {
                ready = true;
            });
            ctl.on('ended', () => {
                ended = true;
            });
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'ready', duration: 100 });
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'timeupdate', currentTime: 3, duration: 100 });
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'ended' });
            expect(ready).toBe(true);
            expect(times).toEqual([3]);
            expect(ended).toBe(true);
        });

        it('ignores malformed inbound events (schema-invalid)', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            const times = [];
            ctl.on('timeupdate', (e) => times.push(e.currentTime));
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'timeupdate', currentTime: -1, duration: 100 });
            ctl.handleEvent({ type: 'evil', action: 'timeupdate', currentTime: 3 });
            expect(times).toEqual([]);
        });

        it('off() unsubscribes a listener', () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            const calls = [];
            const cb = () => calls.push(1);
            ctl.on('play', cb);
            ctl.off('play', cb);
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'play' });
            expect(calls).toEqual([]);
        });

        it('supersedes the previous controller on a shared port (single active media)', () => {
            bridge._resetForTests();
            const port = makeFakePort();
            const aTimes = [];
            let aClosed = false;
            const ctlA = bridge.createBridgeController({ port, nonce: 'N1' });
            ctlA.on('timeupdate', (e) => aTimes.push(e.currentTime));
            ctlA.on('closed', () => {
                aClosed = true;
            });
            // A second media opens on the same transferred port → it supersedes A.
            const bTimes = [];
            const ctlB = bridge.createBridgeController({ port, nonce: 'N1' });
            ctlB.on('timeupdate', (e) => bTimes.push(e.currentTime));
            // A is notified it was retired (so its iDevice can stop driving) ...
            expect(aClosed).toBe(true);
            // ... and inbound port events reach ONLY the active controller B (no silent freeze,
            // no double delivery) — the regression that broke pages with >1 bridged video.
            port._deliver({ type: 'exe-media', v: 1, action: 'timeupdate', currentTime: 7, duration: 100 });
            expect(bTimes).toEqual([7]);
            expect(aTimes).toEqual([]);
        });

        it('getCurrentTime() resolves via the matching state reqId', async () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            const p = ctl.getCurrentTime();
            const req = port.posted.find((m) => m.action === 'getCurrentTime');
            expect(Number.isInteger(req.reqId)).toBe(true);
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'state', reqId: req.reqId, currentTime: 42, duration: 90 });
            await expect(p).resolves.toBe(42);
        });

        it('getCurrentTime() ignores a state with a mismatched reqId', async () => {
            const port = makeFakePort();
            const ctl = bridge.createBridgeController({ port, nonce: 'N1' });
            const p = ctl.getCurrentTime();
            const req = port.posted.find((m) => m.action === 'getCurrentTime');
            // A stale/forged state for another request must not resolve this promise.
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'state', reqId: req.reqId + 999, currentTime: 7 });
            let settled = false;
            p.then(() => {
                settled = true;
            });
            await Promise.resolve();
            expect(settled).toBe(false);
            // The correct reqId still resolves it.
            ctl.handleEvent({ type: 'exe-media', v: 1, action: 'state', reqId: req.reqId, currentTime: 8 });
            await expect(p).resolves.toBe(8);
        });
    });

    describe('buildPlaceholder', () => {
        it('renders an accessible, click-to-open placeholder for a youtube descriptor', () => {
            const descriptor = policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ');
            descriptor.title = 'My lesson video';
            const el = bridge.buildPlaceholder(descriptor, { document });
            expect(el.getAttribute('data-exe-media-provider')).toBe('youtube');
            expect(el.getAttribute('data-exe-media-id')).toBe('dQw4w9WgXcQ');
            const button = el.querySelector('button');
            expect(button).toBeTruthy();
            expect(button.getAttribute('type')).toBe('button');
            // Accessible name references the title.
            expect((el.textContent || '').includes('My lesson video')).toBe(true);
        });

        it('renders an open-in-new-tab fallback (degraded mode) with rel=noopener', () => {
            const descriptor = policy.parseExternalMedia('https://vimeo.com/76979871');
            const el = bridge.buildPlaceholder(descriptor, { document, degraded: true });
            const link = el.querySelector('a[target="_blank"]');
            expect(link).toBeTruthy();
            expect(link.getAttribute('rel')).toContain('noopener');
            expect(link.getAttribute('href')).toBe('https://vimeo.com/76979871');
        });
    });

    describe('ensureSession handshake', () => {
        /** Build a fake child window whose .parent records posts and lets tests reply. */
        function makeEnv() {
            const handlers = [];
            const parent = {
                posts: [],
                postMessage(msg) {
                    this.posts.push(msg);
                },
            };
            const win = {
                parent,
                addEventListener(type, cb) {
                    if (type === 'message') handlers.push(cb);
                },
                removeEventListener(type, cb) {
                    const i = handlers.indexOf(cb);
                    if (i >= 0) handlers.splice(i, 1);
                },
            };
            win.self = win;
            win.top = parent;
            // Deliver a message event to all current listeners.
            win._emit = (evt) => handlers.slice().forEach((h) => h(evt));
            return { win, parent };
        }

        beforeEach(() => bridge._resetForTests());

        it('resolves { nonce, port } on a valid welcome from the parent', async () => {
            const { win, parent } = makeEnv();
            const fakePort = makeFakePort();
            const p = bridge.ensureSession({ win, genId: () => 'HID', timeoutMs: 1000 });
            // The child announced hello to the parent.
            expect(parent.posts[0]).toMatchObject({ type: 'exe-media', v: 1, action: 'hello', helloId: 'HID' });
            // Parent replies welcome transferring a port, from the parent window.
            win._emit({
                source: parent,
                data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'HID', exelearningBridge: 'NONCE' },
                ports: [fakePort],
            });
            const session = await p;
            expect(session).toEqual({ nonce: 'NONCE', port: fakePort });
        });

        it('ignores a welcome whose source is not the parent (window-identity check)', async () => {
            const { win, parent } = makeEnv();
            const p = bridge.ensureSession({ win, genId: () => 'HID', timeoutMs: 30 });
            win._emit({
                source: { not: 'parent' },
                data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'HID', exelearningBridge: 'X' },
                ports: [makeFakePort()],
            });
            await expect(p).resolves.toBeNull(); // falls through to the watchdog → null
        });

        it('ignores a welcome with a mismatched helloId', async () => {
            const { win, parent } = makeEnv();
            const p = bridge.ensureSession({ win, genId: () => 'HID', timeoutMs: 30 });
            win._emit({
                source: parent,
                data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'WRONG', exelearningBridge: 'X' },
                ports: [makeFakePort()],
            });
            await expect(p).resolves.toBeNull();
        });

        it('resolves null when there is no framing parent', async () => {
            const lone = {};
            lone.self = lone;
            lone.top = lone;
            lone.parent = lone;
            await expect(bridge.ensureSession({ win: lone, genId: () => 'X' })).resolves.toBeNull();
        });

        it('resolves null after the watchdog when the parent never answers', async () => {
            const { win } = makeEnv();
            await expect(bridge.ensureSession({ win, genId: () => 'HID', timeoutMs: 10 })).resolves.toBeNull();
        });
    });

    describe('openMedia', () => {
        beforeEach(() => bridge._resetForTests());

        /** A framed env wired to a fake port; calling reply() simulates the parent welcome. */
        function makeBridgedEnv() {
            const handlers = [];
            const parent = { posts: [], postMessage(m) { this.posts.push(m); } };
            const win = {
                parent,
                addEventListener(t, cb) { if (t === 'message') handlers.push(cb); },
                removeEventListener(t, cb) { const i = handlers.indexOf(cb); if (i >= 0) handlers.splice(i, 1); },
            };
            win.self = win;
            win.top = parent;
            const port = makeFakePort();
            const welcome = () =>
                handlers.slice().forEach((h) =>
                    h({
                        source: parent,
                        data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'HID', exelearningBridge: 'N' },
                        ports: [port],
                    }),
                );
            return { win, parent, port, welcome };
        }

        it('rejects with no-bridge when the handshake yields no session', async () => {
            const lone = {};
            lone.self = lone;
            lone.top = lone;
            lone.parent = lone;
            await expect(
                bridge.openMedia({ win: lone, provider: 'youtube', videoId: 'dQw4w9WgXcQ', genId: () => 'X' }),
            ).rejects.toThrow(/no-bridge/);
        });

        it('resolves a controller once the parent reports ready, after sending open', async () => {
            const { win, port, welcome } = makeBridgedEnv();
            const p = bridge.openMedia({
                win,
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                genId: () => 'HID',
                timeoutMs: 1000,
                readyTimeoutMs: 1000,
            });
            welcome();
            // Let ensureSession resolve and openMedia send the open command.
            await Promise.resolve();
            await Promise.resolve();
            const openMsg = port.posted.find((m) => m.action === 'open');
            expect(openMsg).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            // Parent says ready → promise resolves with a working controller.
            port._deliver({ type: 'exe-media', v: 1, action: 'ready', duration: 100 });
            const ctl = await p;
            ctl.play();
            expect(port.posted.some((m) => m.action === 'play')).toBe(true);
        });

        it('rejects when the parent reports a fatal error instead of ready', async () => {
            const { win, welcome, port } = makeBridgedEnv();
            const p = bridge.openMedia({ win, provider: 'vimeo', videoId: '76979871', genId: () => 'HID' });
            welcome();
            await Promise.resolve();
            await Promise.resolve();
            port._deliver({ type: 'exe-media', v: 1, action: 'error', code: 'unsupported_provider', fatal: true });
            await expect(p).rejects.toThrow(/unsupported_provider/);
        });

        it('rejects with ready-timeout when the parent never reports ready', async () => {
            vi.useFakeTimers();
            try {
                const { win, welcome } = makeBridgedEnv();
                const p = bridge.openMedia({
                    win,
                    provider: 'youtube',
                    videoId: 'dQw4w9WgXcQ',
                    genId: () => 'HID',
                    readyTimeoutMs: 50,
                });
                // Attach the rejection handler now so the (fake-timer) rejection is never
                // momentarily unhandled.
                const expectation = expect(p).rejects.toThrow(/ready-timeout/);
                welcome();
                await vi.advanceTimersByTimeAsync(0); // let the session + open settle
                await vi.advanceTimersByTimeAsync(60); // trip the ready watchdog
                await expectation;
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('scanAndReplace', () => {
        beforeEach(() => bridge._resetForTests());

        // A normal (non-sandboxed, non-framed) window.
        function lone() {
            const w = {};
            w.self = w;
            w.top = w;
            w.parent = w;
            return w;
        }
        // An opaque sandboxed iframe whose parent never answers the handshake.
        function opaqueNoParent() {
            const parent = { postMessage() {} };
            const w = { origin: 'null', parent, addEventListener() {}, removeEventListener() {} };
            w.self = w;
            w.top = parent;
            return w;
        }

        it('opaque mode: replaces a youtube iframe with a degraded placeholder when no parent answers', async () => {
            const container = document.createElement('div');
            container.innerHTML =
                '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Lesson"></iframe>' +
                '<iframe src="https://example.com/not-media"></iframe>';
            const placeholders = await bridge.scanAndReplace(container, { win: opaqueNoParent(), timeoutMs: 20 });
            expect(placeholders).toHaveLength(1);
            expect(container.querySelector('.exe-external-media[data-exe-media-provider="youtube"]')).toBeTruthy();
            // Non-media iframe is left untouched.
            expect(container.querySelector('iframe[src="https://example.com/not-media"]')).toBeTruthy();
        });

        it('normal mode: never swaps any recognized embed (always inline)', async () => {
            const container = document.createElement('div');
            container.innerHTML =
                '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Lesson"></iframe>' +
                '<iframe src="https://vimeo.com/76979871"></iframe>';
            const placeholders = await bridge.scanAndReplace(container, { win: lone() });
            // Normal (non-opaque) rendering is a no-op: every embed plays inline directly
            // (referrerpolicy lets YouTube/Vimeo load), so nothing is replaced.
            expect(placeholders).toHaveLength(0);
            expect(container.querySelector('iframe[src="https://www.youtube.com/embed/dQw4w9WgXcQ"]')).toBeTruthy();
            expect(container.querySelector('iframe[src="https://vimeo.com/76979871"]')).toBeTruthy();
            expect(container.querySelector('.exe-external-media')).toBeNull();
        });

        it('opaque mode: protects every recognized embed regardless of the floating attribute', async () => {
            const container = document.createElement('div');
            // Even data-exe-media-floating="false" must be protected — inline can't run opaque.
            container.innerHTML =
                '<iframe src="https://vimeo.com/76979871" data-exe-media-floating="false"></iframe>';
            const placeholders = await bridge.scanAndReplace(container, { win: opaqueNoParent(), timeoutMs: 20 });
            expect(placeholders).toHaveLength(1);
            expect(container.querySelector('.exe-external-media[data-exe-media-provider="vimeo"]')).toBeTruthy();
        });

        it('returns an empty list when there is no external media to replace', async () => {
            const container = document.createElement('div');
            container.innerHTML = '<p>no media here</p>';
            await expect(bridge.scanAndReplace(container, { win: lone() })).resolves.toEqual([]);
        });

        it('makes a click-to-open placeholder when the bridge is available, and clicking sends open', async () => {
            const handlers = [];
            const parent = { posts: [], postMessage(m) { this.posts.push(m); } };
            const win = {
                parent,
                addEventListener(t, cb) { if (t === 'message') handlers.push(cb); },
                removeEventListener(t, cb) { const i = handlers.indexOf(cb); if (i >= 0) handlers.splice(i, 1); },
            };
            win.self = win;
            win.top = parent;
            const port = makeFakePort();
            const container = document.createElement('div');
            container.innerHTML = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';

            const scanP = bridge.scanAndReplace(container, { win, genId: () => 'HID', timeoutMs: 1000 });
            handlers.slice().forEach((h) =>
                h({
                    source: parent,
                    data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'HID', exelearningBridge: 'N' },
                    ports: [port],
                }),
            );
            const placeholders = await scanP;
            expect(placeholders).toHaveLength(1);
            const button = placeholders[0].querySelector('button.exe-external-media__open');
            expect(button).toBeTruthy();
            button.dispatchEvent(new window.Event('click'));
            await Promise.resolve();
            await Promise.resolve();
            expect(port.posted.some((m) => m.action === 'open' && m.videoId === 'dQw4w9WgXcQ')).toBe(true);
        });

        it('swaps a click-to-open placeholder to a degraded fallback if opening fails', async () => {
            vi.useFakeTimers();
            try {
                const handlers = [];
                const parent = { posts: [], postMessage(m) { this.posts.push(m); } };
                const win = {
                    parent,
                    addEventListener(t, cb) { if (t === 'message') handlers.push(cb); },
                    removeEventListener(t, cb) { const i = handlers.indexOf(cb); if (i >= 0) handlers.splice(i, 1); },
                };
                win.self = win;
                win.top = parent;
                const port = makeFakePort();
                const container = document.createElement('div');
                container.innerHTML = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';

                const scanP = bridge.scanAndReplace(container, {
                    win,
                    genId: () => 'HID',
                    timeoutMs: 1000,
                    readyTimeoutMs: 30,
                });
                handlers.slice().forEach((h) =>
                    h({
                        source: parent,
                        data: { type: 'exe-media', v: 1, action: 'welcome', helloId: 'HID', exelearningBridge: 'N' },
                        ports: [port],
                    }),
                );
                await vi.advanceTimersByTimeAsync(0);
                const placeholders = await scanP;
                placeholders[0].querySelector('button').dispatchEvent(new window.Event('click'));
                // open is sent but ready never arrives → ready watchdog rejects → degraded swap.
                await vi.advanceTimersByTimeAsync(40);
                await vi.advanceTimersByTimeAsync(0);
                expect(container.querySelector('a.exe-external-media__open[target="_blank"]')).toBeTruthy();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('buildPlaceholder extras', () => {
        it('marks interactive media with a data attribute', () => {
            const descriptor = policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ');
            descriptor.interactive = true;
            const el = bridge.buildPlaceholder(descriptor, { document });
            expect(el.getAttribute('data-exe-media-interactive')).toBe('true');
        });

        it('uses resolved $exe_i18n strings when present', () => {
            const original = globalThis.$exe_i18n;
            globalThis.$exe_i18n = { exeMediaPlay: 'Reproducir vídeo' };
            try {
                const descriptor = policy.parseExternalMedia('https://youtu.be/dQw4w9WgXcQ');
                const el = bridge.buildPlaceholder(descriptor, { document });
                expect(el.querySelector('button').textContent).toBe('Reproducir vídeo');
            } finally {
                if (original === undefined) delete globalThis.$exe_i18n;
                else globalThis.$exe_i18n = original;
            }
        });
    });

    describe('autoInit', () => {
        beforeEach(() => bridge._resetForTests());

        it('is a no-op without a document', () => {
            expect(bridge.autoInit({}, null)).toBe(false);
        });

        it('runs in normal mode (returns true) and leaves embeds inline', () => {
            const body = document.createElement('div');
            body.innerHTML = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
            const doc = { body, readyState: 'complete' };
            expect(bridge.autoInit(window, doc)).toBe(true);
            // Normal mode is a no-op → the embed plays inline (referrerpolicy).
            expect(body.querySelector('iframe[src="https://www.youtube.com/embed/dQw4w9WgXcQ"]')).toBeTruthy();
        });

        it('scans immediately when the document is ready inside an opaque iframe', () => {
            const parent = { postMessage() {} };
            const win = { origin: 'null', parent, addEventListener() {}, removeEventListener() {} };
            win.self = win;
            win.top = parent;
            const body = document.createElement('div');
            const doc = { body, readyState: 'complete' };
            expect(bridge.autoInit(win, doc)).toBe(true);
        });
    });
});
