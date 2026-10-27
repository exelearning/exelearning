import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { bindPrintFrame } from './printFrame.js';

const disposers = [];
const flush = () => vi.advanceTimersByTimeAsync(0);
function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
function setState(host, state) {
    Object.defineProperty(host.document, 'readyState', { configurable: true, value: state });
}
function frame(setup = () => {}) {
    const host = new EventTarget();
    host.document = document.implementation.createHTMLDocument('Printed page');
    host.document.body.innerHTML = '<input value="Original"><script>danger()</script>';
    host.parent = { postMessage: vi.fn() };
    host.print = vi.fn(() => host.dispatchEvent(new Event('beforeprint')));
    setState(host, 'complete');
    setup(host);
    const dispose = bindPrintFrame('token', host);
    disposers.push(dispose);
    const send = (data, source = host.parent) => host.dispatchEvent(new MessageEvent('message', {
        source, data: { channel: 'exe-print', token: 'token', id: 1, ...data },
    }));
    return { host, send, dispose };
}
function addImage(host, source = 'image.svg', attribute = 'src') {
    const image = host.document.createElement('img');
    image.setAttribute(attribute, source);
    image.loading = 'lazy';
    image.decode = vi.fn(() => new Promise(() => {}));
    Object.defineProperty(image, 'complete', { configurable: true, value: false });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 0 });
    host.document.body.append(image);
    return image;
}
function completeImage(image, width = 100) {
    Object.defineProperty(image, 'complete', { configurable: true, value: true });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
    image.dispatchEvent(new Event(width ? 'load' : 'error'));
}
function expectReady(host, error) {
    expect(host.parent.postMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        id: 0, type: 'ready', token: 'token', error,
    }), '*');
}

describe('print frame', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        for (const dispose of disposers.splice(0)) dispose();
        expect(vi.getTimerCount()).toBe(0);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('only applies commands from its embedding window with the current token', async () => {
        const { host, send, dispose } = frame();
        send({ type: 'print' }, {});
        send({ type: 'print', token: 'stale' });
        send({ type: 'print', channel: 'other' });
        host.dispatchEvent(new MessageEvent('message', { source: host.parent, data: null }));
        expect(host.print).not.toHaveBeenCalled();
        send({ type: 'options', value: { teacherOnly: true, unfoldBlocks: false } });
        expect(host.document.documentElement.className).toContain('mode-teacher');
        expect(host.document.documentElement.className).toContain('exe-print-as-shown');
        send({ type: 'options', value: { teacherOnly: false, unfoldBlocks: true } });
        expect(host.document.documentElement.className).toBe('');
        send({ type: 'options' });
        send({ type: 'print' });
        expect(host.print).toHaveBeenCalledTimes(1);
        expect(host.parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 1, type: 'started', token: 'token' }), '*');
        host.dispatchEvent(new Event('beforeprint'));
        expect(host.parent.postMessage).toHaveBeenCalledTimes(1);
        dispose();
        send({ type: 'print' });
        expect(host.print).toHaveBeenCalledTimes(1);
        await flush();
        expect(host.parent.postMessage).toHaveBeenCalledTimes(1);
    });

    it('acknowledges an already loaded document and makes an inert copy of its current DOM', async () => {
        const { host, send } = frame();
        await flush();
        expectReady(host);
        expect(vi.getTimerCount()).toBe(0);
        host.document.querySelector('input').value = 'Current';
        send({ type: 'snapshot' });
        await flush();
        const snapshot = host.parent.postMessage.mock.calls.find(([data]) => data.type === 'snapshot')[0].value;
        expect(snapshot).toContain('value="Current"');
        expect(snapshot).not.toContain('<script');
        expect(snapshot).toContain("script-src 'none'");
    });

    it.each(['readystatechange', 'DOMContentLoaded', 'load', 'missed event'])(
        'starts once after document loading, including %s', async event => {
            const { host } = frame(host => setState(host, 'loading'));
            await vi.advanceTimersByTimeAsync(2100);
            expect(host.parent.postMessage).not.toHaveBeenCalled();
            setState(host, 'interactive');
            host.document.dispatchEvent(new Event('DOMContentLoaded'));
            await vi.advanceTimersByTimeAsync(250);
            expect(host.parent.postMessage).not.toHaveBeenCalled();
            setState(host, 'complete');
            if (event === 'load') host.dispatchEvent(new Event(event));
            else if (event !== 'missed event') host.document.dispatchEvent(new Event(event));
            await vi.advanceTimersByTimeAsync(250);
            host.document.dispatchEvent(new Event('readystatechange'));
            host.document.dispatchEvent(new Event('DOMContentLoaded'));
            host.dispatchEvent(new Event('load'));
            await flush();
            expectReady(host);
            expect(vi.getTimerCount()).toBe(0);
        },
    );

    it.each([
        ['image.svg', 'src'], ['image.png', 'src'], ['blob:opaque-image', 'src'],
        ['data:image/svg+xml,<svg/>', 'src'], ['responsive.svg 1x', 'srcset'],
    ])('waits past two seconds for %s instead of assuming decoding finished', async (source, attribute) => {
        let image;
        const { host } = frame(host => { image = addImage(host, source, attribute); });
        const remove = vi.spyOn(image, 'removeEventListener');
        await vi.advanceTimersByTimeAsync(3500);
        expect(image.loading).toBe('eager');
        expect(host.parent.postMessage).not.toHaveBeenCalled();
        completeImage(image);
        await flush();
        expectReady(host);
        expect(image.decode).not.toHaveBeenCalled();
        expect(remove.mock.calls.map(([event]) => event)).toEqual(['load', 'error']);
    });

    it('waits for a picture source and ignores empty activity placeholders', async () => {
        let image;
        const { host } = frame(host => {
            host.document.body.insertAdjacentHTML('beforeend', '<img><picture><source srcset="responsive.svg"></picture>');
            image = addImage(host, '');
            host.document.querySelector('picture').append(image);
        });
        await flush();
        expect(host.parent.postMessage).not.toHaveBeenCalled();
        completeImage(image);
        await flush();
        expectReady(host);
    });

    it.each([100, 0])('checks cached images for successful loading (width %i)', async width => {
        const { host } = frame(host => completeImage(addImage(host), width));
        await flush();
        expectReady(host, width ? undefined : 'Error: PRINT_IMAGE_FAILED');
    });

    it('reports an image error and detaches listeners from other pending images', async () => {
        let broken, pending;
        const { host } = frame(host => { broken = addImage(host); pending = addImage(host); });
        const remove = vi.spyOn(pending, 'removeEventListener');
        await flush();
        completeImage(broken, 0);
        await flush();
        expectReady(host, 'Error: PRINT_IMAGE_FAILED');
        expect(remove).toHaveBeenCalledTimes(2);
        completeImage(pending);
        await vi.advanceTimersByTimeAsync(30000);
        expectReady(host, 'Error: PRINT_IMAGE_FAILED');
    });

    it.each(['fonts', 'MathJax'])('waits for slow %s and reports rejection', async resource => {
        const loading = deferred();
        const { host, send } = frame(host => {
            if (resource === 'fonts') host.document.fonts = { ready: loading.promise };
            else host.MathJax = { startup: { promise: loading.promise } };
        });
        await vi.advanceTimersByTimeAsync(3500);
        expect(host.parent.postMessage).not.toHaveBeenCalled();
        loading.reject(new Error('Resource failed'));
        await flush();
        expectReady(host, 'Error: Resource failed');
        vi.spyOn(host.document.documentElement, 'cloneNode').mockImplementation(() => { throw new Error('Copy failed'); });
        send({ type: 'snapshot' });
        await flush();
        expect(host.parent.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'snapshot', error: 'Error: Copy failed' }), '*');
    });

    it('waits for images created during MathJax startup and for fonts', async () => {
        const math = deferred(), fonts = deferred();
        const { host } = frame(host => {
            host.MathJax = { startup: { promise: math.promise } };
            host.document.fonts = { ready: fonts.promise };
        });
        await vi.advanceTimersByTimeAsync(3000);
        const image = addImage(host);
        math.resolve();
        await flush();
        completeImage(image);
        await flush();
        expect(host.parent.postMessage).not.toHaveBeenCalled();
        fonts.resolve();
        await flush();
        expectReady(host);
    });

    it.each(['fonts', 'MathJax', 'image', 'document'])(
        'reports a deadline error, never readiness, for stalled %s', async resource => {
            const loading = deferred();
            let image;
            const { host } = frame(host => {
                if (resource === 'fonts') host.document.fonts = { ready: loading.promise };
                if (resource === 'MathJax') host.MathJax = { startup: { promise: loading.promise } };
                if (resource === 'image') image = addImage(host);
                if (resource === 'document') setState(host, 'loading');
            });
            await vi.advanceTimersByTimeAsync(24999);
            expect(host.parent.postMessage).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expectReady(host, 'Error: PRINT_RESOURCES_TIMEOUT');
            expect(vi.getTimerCount()).toBe(0);
            loading.resolve();
            if (image) completeImage(image);
            setState(host, 'complete');
            host.dispatchEvent(new Event('load'));
            await flush();
            expectReady(host, 'Error: PRINT_RESOURCES_TIMEOUT');
        },
    );

    it.each(['dispose', 'pagehide', 'command'])(
        'cancels pending readiness and snapshots on %s without late replies', async method => {
            let image;
            const fonts = deferred();
            const { host, send, dispose } = frame(host => {
                image = addImage(host);
                host.document.fonts = { ready: fonts.promise };
            });
            const remove = vi.spyOn(image, 'removeEventListener');
            await flush();
            send({ type: 'snapshot' });
            if (method === 'dispose') dispose();
            else if (method === 'pagehide') host.dispatchEvent(new Event('pagehide'));
            else send({ type: 'dispose' });
            expect(remove).toHaveBeenCalledTimes(2);
            expect(vi.getTimerCount()).toBe(0);
            completeImage(image);
            fonts.resolve();
            send({ type: 'print' });
            await vi.advanceTimersByTimeAsync(30000);
            expect(host.parent.postMessage).not.toHaveBeenCalled();
            expect(host.print).not.toHaveBeenCalled();
        },
    );

    it('cancels stalled MathJax without creating image listeners later', async () => {
        const math = deferred();
        const { host, dispose } = frame(host => { host.MathJax = { startup: { promise: math.promise } }; });
        const image = addImage(host);
        const add = vi.spyOn(image, 'addEventListener');
        await flush();
        dispose();
        math.resolve();
        await flush();
        expect(add).not.toHaveBeenCalled();
        expect(host.parent.postMessage).not.toHaveBeenCalled();
    });
});
