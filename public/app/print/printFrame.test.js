import { describe, it, expect, vi } from 'vitest';
import { bindPrintFrame } from './printFrame.js';

function frame() {
    const host = new EventTarget();
    host.document = document.implementation.createHTMLDocument('Printed page');
    host.document.body.innerHTML = '<input value="Original"><script>danger()</script>';
    host.parent = { postMessage: vi.fn() };
    host.print = vi.fn(() => host.dispatchEvent(new Event('beforeprint')));
    const dispose = bindPrintFrame('token', host);
    const send = (data, source = host.parent) => host.dispatchEvent(new MessageEvent('message', {
        source, data: { channel: 'exe-print', token: 'token', id: 1, ...data },
    }));
    return { host, send, dispose };
}

describe('print frame', () => {
    it('only applies commands from its embedding window with the current token', async () => {
        const { host, send, dispose } = frame();
        send({ type: 'print' }, {});
        send({ type: 'print', token: 'stale' });
        send({ type: 'print', channel: 'other' });
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
        dispose();
        send({ type: 'print' });
        expect(host.print).toHaveBeenCalledTimes(1);
    });

    it('acknowledges readiness and makes an inert copy of the current DOM', async () => {
        const { host, send, dispose } = frame();
        host.document.querySelector('input').value = 'Current';
        host.dispatchEvent(new Event('load'));
        await vi.waitFor(() => expect(host.parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 0, type: 'ready' }), '*'));
        send({ type: 'snapshot' });
        await vi.waitFor(() => expect(host.parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'snapshot', value: expect.stringContaining('value="Current"') }), '*'));
        const snapshot = host.parent.postMessage.mock.calls.find(([data]) => data.type === 'snapshot')[0].value;
        expect(snapshot).not.toContain('<script');
        expect(snapshot).toContain("script-src 'none'");
        dispose();
    });

    it('returns snapshot and resource errors to the host instead of hanging', async () => {
        const { host, send, dispose } = frame();
        host.document.fonts = { ready: Promise.resolve() };
        host.MathJax = { startup: { promise: { then: (_resolve, reject) => reject(new Error('Math failed')) } } };
        host.dispatchEvent(new Event('load'));
        await vi.waitFor(() => expect(host.parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', error: expect.stringContaining('Math failed') }), '*'));
        vi.spyOn(host.document.documentElement, 'cloneNode').mockImplementation(() => { throw new Error('Copy failed'); });
        send({ type: 'snapshot' });
        await vi.waitFor(() => expect(host.parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'snapshot', error: expect.stringContaining('Copy failed') }), '*'));
        dispose();
    });
});
