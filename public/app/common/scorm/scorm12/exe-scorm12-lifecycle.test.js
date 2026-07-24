import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
const client = require('./exe-scorm12-client.js');
const policy = require('./exe-scorm12-policy.js');
const lifecycle = require('./exe-scorm12-lifecycle.js');
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

/** Minimal event target capturing listeners so tests can fire them. */
function createFakeEventTarget() {
    const listeners = {};
    return {
        listeners,
        addEventListener(type, handler) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter(entry => entry !== handler);
        },
        fire(type) {
            for (const handler of listeners[type] || []) {
                handler();
            }
        },
    };
}

describe('exe-scorm12-lifecycle', () => {
    let api;
    let fakeWindow;
    let fakeDocument;

    function startSession(initialData) {
        api = createFakeScorm12Api({ data: initialData });
        vi.stubGlobal('window', createFakeWindowTree('self', api));
        expect(client.initialize()).toBe(true);
        api.calls.length = 0;
    }

    beforeEach(() => {
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({ getPipwerks: () => pipwerks, now: () => 1000, error: vi.fn(), warn: vi.fn() });
        policy.resetDependencies();
        policy.configure({ getClient: () => client, warn: vi.fn() });
        fakeWindow = createFakeEventTarget();
        fakeDocument = createFakeEventTarget();
        fakeDocument.visibilityState = 'visible';
        lifecycle.resetDependencies();
        lifecycle.configure({
            getClient: () => client,
            getPolicy: () => policy,
            getWindow: () => fakeWindow,
            getDocument: () => fakeDocument,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        lifecycle.resetDependencies();
        policy.resetDependencies();
        client.resetDependencies();
    });

    it('registers no unload or beforeunload handlers', () => {
        lifecycle.install();

        expect(Object.keys(fakeWindow.listeners)).toEqual(['pagehide']);
        expect(Object.keys(fakeDocument.listeners)).toEqual(['visibilitychange']);
    });

    it('installs its listeners only once', () => {
        lifecycle.install();
        lifecycle.install();

        expect(fakeWindow.listeners.pagehide).toHaveLength(1);
        expect(fakeDocument.listeners.visibilitychange).toHaveLength(1);
    });

    it('pagehide ends the session once: status, exit, session time, commit, finish', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();

        fakeWindow.fire('pagehide');

        expect(api.callSignatures()).toEqual([
            'LMSGetValue(cmi.core.lesson_status)',
            'LMSSetValue(cmi.core.lesson_status=completed)',
            'LMSSetValue(cmi.core.exit=)',
            'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
            'LMSCommit',
            'LMSFinish',
        ]);
    });

    it('a second pagehide does nothing', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();
        fakeWindow.fire('pagehide');
        const callCount = api.calls.length;

        fakeWindow.fire('pagehide');

        expect(api.calls.length).toBe(callCount);
        expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
    });

    it('visibilitychange to hidden commits only and keeps the session usable', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();

        fakeDocument.visibilityState = 'hidden';
        fakeDocument.fire('visibilitychange');

        expect(api.callSignatures()).toEqual(['LMSCommit']);
        expect(client.isActive()).toBe(true);
        expect(client.setValue('cmi.core.score.raw', '70')).toBe(true);
    });

    it('visibilitychange while visible does nothing', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();

        fakeDocument.fire('visibilitychange');

        expect(api.calls).toEqual([]);
    });

    it('visibilitychange after finish does nothing', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();
        fakeWindow.fire('pagehide');
        const callCount = api.calls.length;

        fakeDocument.visibilityState = 'hidden';
        fakeDocument.fire('visibilitychange');

        expect(api.calls.length).toBe(callCount);
    });

    it('finish is a no-op when the session never started', () => {
        api = createFakeScorm12Api();
        vi.stubGlobal('window', createFakeWindowTree('none', api));
        lifecycle.install();

        expect(lifecycle.finish()).toBe(true);
        expect(api.calls).toEqual([]);
    });

    it('exposes hasFinished()', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        expect(lifecycle.hasFinished()).toBe(false);
        lifecycle.finish();
        expect(lifecycle.hasFinished()).toBe(true);
    });

    it('falls back to the page window/document and global layer lookups by default', () => {
        lifecycle.resetDependencies();

        // install() on the real happy-dom window/document; finish() resolves
        // the client via window.exeScorm12 (attached by the layer modules).
        expect(() => lifecycle.install()).not.toThrow();
        expect(lifecycle.finish()).toBe(true);

        // resetDependencies removes the real listeners it installed.
        lifecycle.resetDependencies();
    });

    it('finish without the completion rule keeps the stored status', () => {
        startSession({ 'cmi.core.lesson_status': 'incomplete' });
        lifecycle.install();

        lifecycle.finish(false);

        expect(api.callSignatures()).toEqual([
            'LMSGetValue(cmi.core.lesson_status)',
            'LMSSetValue(cmi.core.exit=suspend)',
            'LMSSetValue(cmi.core.session_time=0000:00:00.00)',
            'LMSCommit',
            'LMSFinish',
        ]);
    });
});
