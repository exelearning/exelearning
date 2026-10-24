import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import PrintFrameTransport from './PrintFrameTransport.js';

describe('opaque print frame transport', () => {
    let iframe, host, transport;
    beforeEach(() => {
        vi.useFakeTimers();
        host = new EventTarget();
        iframe = { contentWindow: { postMessage: vi.fn() }, setAttribute: vi.fn(), removeAttribute: vi.fn(), srcdoc: '' };
        const events = new EventTarget();
        iframe.addEventListener = events.addEventListener.bind(events);
        iframe.removeEventListener = events.removeEventListener.bind(events);
        iframe.dispatchEvent = events.dispatchEvent.bind(events);
        transport = new PrintFrameTransport(iframe, 'https://example.test/html/course/', host);
    });
    afterEach(() => { transport.destroy(); vi.useRealTimers(); });
    const reply = (transport, iframe, data, source = iframe.contentWindow) => transport.receive({
        source, data: { channel: 'exe-print', token: transport.token, ...data },
    });

    it('loads with an opaque origin and only accepts the current frame, token and response type', async () => {
        const ready = transport.load('<html><body>Print</body></html>');
        expect(iframe.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts allow-modals');
        expect(iframe.srcdoc).toContain('https://example.test/html/course/libs/exe_print/frame.js');
        reply(transport, iframe, { id: 0, type: 'ready' }, {});
        reply(transport, iframe, { id: 0, type: 'ready', token: 'stale' });
        reply(transport, iframe, { id: 0, type: 'ready', channel: 'other' });
        reply(transport, iframe, { id: 0, type: 'snapshot' });
        expect(transport.pending.size).toBe(1);
        reply(transport, iframe, { id: 0, type: 'ready' });
        await ready;
        expect(transport.pending.size).toBe(0);
        transport.setOptions({ teacherOnly: true });
        expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'options', value: { teacherOnly: true } }), '*');
    });

    it('acknowledges printing and returns a snapshot through the same channel', async () => {
        const printing = transport.print();
        reply(transport, iframe, { id: 1, type: 'started' });
        await printing;
        const snapshot = transport.snapshot();
        reply(transport, iframe, { id: 2, type: 'snapshot', value: '<html>Copy</html>' });
        expect(await snapshot).toBe('<html>Copy</html>');
    });

    it('loads the bridge from the supplied blob resource map', async () => {
        transport.resourceUrls = { 'libs/exe_print/frame.js': 'blob:frame-script' };
        const ready = transport.load('<body></body>');
        expect(iframe.srcdoc).toContain('src="blob:frame-script"');
        reply(transport, iframe, { id: 0, type: 'ready' });
        await ready;
    });

    it('navigates within a Service Worker scope before writing and cancels stale navigation', async () => {
        host.origin = 'https://example.test';
        host.location = { protocol: 'https:' };
        host.navigator = { serviceWorker: { controller: {} } };
        iframe.contentDocument = { URL: 'about:blank', open: vi.fn(), write: vi.fn(), close: vi.fn() };
        const ready = transport.load('<html><body>Course</body></html>');
        expect(iframe.src).toContain('libs/exe_print/frame.html?generation=');
        iframe.dispatchEvent(new Event('load'));
        expect(iframe.contentDocument.write).not.toHaveBeenCalled();
        iframe.contentDocument.URL = iframe.src;
        iframe.dispatchEvent(new Event('load'));
        expect(iframe.contentDocument.write).toHaveBeenCalledWith(expect.stringContaining('Course<script'));
        expect(iframe.contentDocument.close).toHaveBeenCalledOnce();
        iframe.dispatchEvent(new Event('load'));
        expect(iframe.contentDocument.write).toHaveBeenCalledOnce();
        reply(transport, iframe, { id: 0, type: 'ready' });
        await ready;
        const pending = transport.load('<body>Cancelled</body>');
        iframe.dispatchEvent(new Event('load'));
        expect(iframe.contentDocument.write).toHaveBeenCalledOnce();
        transport.clear();
        iframe.dispatchEvent(new Event('load'));
        await pending;
        expect(iframe.contentDocument.write).toHaveBeenCalledOnce();
    });

    it.each([
        ['https://editor.test', 'https:', true],
        ['null', 'https:', false],
        ['null', 'file:', true],
    ])('preserves the hosting boundary for origin %s and protocol %s', async (origin, protocol, shared) => {
        host.origin = origin;
        host.location = { protocol };
        const ready = transport.load('<body>Document</body>');
        expect(iframe.setAttribute).toHaveBeenCalledWith('sandbox',
            'allow-scripts allow-modals' + (shared ? ' allow-same-origin' : ''));
        reply(transport, iframe, { id: 0, type: 'ready' });
        await ready;
    });

    it('reports resource errors and timeouts, and cancels superseded loads', async () => {
        const failed = transport.load('<body></body>');
        reply(transport, iframe, { id: 0, type: 'ready', error: 'Missing font' });
        await expect(failed).rejects.toThrow('Missing font');
        const print = transport.print();
        const rejected = expect(print).rejects.toThrow('did not respond');
        await vi.advanceTimersByTimeAsync(2000);
        await rejected;
        const stale = transport.load('<body>Old</body>');
        const oldToken = transport.token;
        const current = transport.load('<body>New</body>');
        await stale;
        expect(transport.token).not.toBe(oldToken);
        transport.destroy();
        await current;
        expect(transport.pending.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});
