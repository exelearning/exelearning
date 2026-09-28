/**
 * Unit tests for the iDevice edition lifecycle.
 *
 * These exercise real behaviour — real jQuery 3.7.1, real timers driven by
 * Vitest fake timers, real AbortController — rather than asserting that a
 * `destroy()` method exists.
 */

import EditionLifecycle, { EDITION_DESTROY_HOOK } from './editionLifecycle.js';

describe('EditionLifecycle', () => {
    let lifecycle;
    let device;

    beforeEach(() => {
        device = {
            calls: [],
            doWork() {
                this.calls.push('doWork');
                return 'done';
            },
        };
        lifecycle = new EditionLifecycle({ device, name: 'test-idevice', logger: { warn: vi.fn() } });
    });

    afterEach(() => {
        if (lifecycle && !lifecycle.isDestroyed()) lifecycle.destroy();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    /*******************************************************************************
     * STATE AND BINDING
     *******************************************************************************/

    describe('state', () => {
        it('starts active and ends destroyed', () => {
            expect(lifecycle.isActive()).toBe(true);
            expect(lifecycle.isDestroyed()).toBe(false);

            lifecycle.destroy();

            expect(lifecycle.isActive()).toBe(false);
            expect(lifecycle.isDestroyed()).toBe(true);
        });

        it('gives each edition instance a unique jQuery namespace', () => {
            const other = new EditionLifecycle({ device: {} });
            expect(other.namespace).not.toBe(lifecycle.namespace);
            expect(lifecycle.namespace).toMatch(/^exeEdition\d+$/);
            other.destroy();
        });
    });

    describe('bind()', () => {
        it('runs the callback with the owning device as `this`', () => {
            const bound = lifecycle.bind(function () {
                return this;
            });
            expect(bound()).toBe(device);
        });

        it('forwards arguments and the return value', () => {
            const bound = lifecycle.bind((a, b) => a + b);
            expect(bound(2, 3)).toBe(5);
        });

        it('no-ops after teardown instead of throwing', () => {
            const spy = vi.fn();
            const bound = lifecycle.bind(spy);

            lifecycle.destroy();

            expect(() => bound()).not.toThrow();
            expect(spy).not.toHaveBeenCalled();
        });

        it('tolerates a non-function argument', () => {
            expect(() => lifecycle.bind(undefined)()).not.toThrow();
        });

        /**
         * The regression this whole issue is about: optional chaining on the
         * global cannot express this guarantee, because by the time the stale
         * callback runs the global points at a valid — but different — device.
         */
        it('never lets a callback from edition A reach edition B', () => {
            const deviceA = { name: 'A', touched: 0, touch() { this.touched++; } };
            const deviceB = { name: 'B', touched: 0, touch() { this.touched++; } };

            const lifecycleA = new EditionLifecycle({ device: deviceA });
            const staleCallback = lifecycleA.bind(function () {
                this.touch();
            });

            // Edition A closes, edition B opens and becomes the current global.
            lifecycleA.destroy();
            const lifecycleB = new EditionLifecycle({ device: deviceB });
            global.$exeDevice = deviceB;

            expect(() => staleCallback()).not.toThrow();
            expect(deviceA.touched).toBe(0);
            expect(deviceB.touched).toBe(0);

            lifecycleB.destroy();
            delete global.$exeDevice;
        });
    });

    /*******************************************************************************
     * DISPOSERS
     *******************************************************************************/

    describe('own()', () => {
        it('runs disposers on teardown', () => {
            const disposer = vi.fn();
            lifecycle.own(disposer);

            lifecycle.destroy();

            expect(disposer).toHaveBeenCalledTimes(1);
        });

        it('runs disposers in reverse registration order', () => {
            const order = [];
            lifecycle.own(() => order.push('first'));
            lifecycle.own(() => order.push('second'));
            lifecycle.own(() => order.push('third'));

            lifecycle.destroy();

            expect(order).toEqual(['third', 'second', 'first']);
        });

        it('is idempotent: a second teardown disposes nothing again', () => {
            const disposer = vi.fn();
            lifecycle.own(disposer);

            lifecycle.destroy();
            lifecycle.destroy();
            lifecycle.destroy();

            expect(disposer).toHaveBeenCalledTimes(1);
        });

        it('releases a resource early and does not dispose it twice', () => {
            const disposer = vi.fn();
            const release = lifecycle.own(disposer);

            release();
            expect(disposer).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            expect(disposer).toHaveBeenCalledTimes(1);
        });

        it('runs a late registration immediately rather than leaking it', () => {
            lifecycle.destroy();

            const disposer = vi.fn();
            lifecycle.own(disposer);

            expect(disposer).toHaveBeenCalledTimes(1);
            expect(lifecycle.disposers).toHaveLength(0);
        });

        it('keeps cleaning up after a disposer throws, and reports the failure', () => {
            const logger = { warn: vi.fn() };
            lifecycle.logger = logger;
            const after = vi.fn();
            const before = vi.fn();

            lifecycle.own(before);
            lifecycle.own(() => {
                throw new Error('disposer exploded');
            });
            lifecycle.own(after);

            const errors = lifecycle.destroy();

            expect(after).toHaveBeenCalledTimes(1);
            expect(before).toHaveBeenCalledTimes(1);
            expect(errors).toHaveLength(1);
            expect(errors[0].error.message).toBe('disposer exploded');
            expect(logger.warn).toHaveBeenCalled();
            expect(lifecycle.isDestroyed()).toBe(true);
        });

        /**
         * Reporting a cleanup failure must not become one: a logger that throws
         * would otherwise abort the very teardown it is reporting on.
         */
        it('completes teardown even when the logger itself throws', () => {
            lifecycle.logger = {
                warn: () => {
                    throw new Error('logger exploded');
                },
            };
            const after = vi.fn();
            lifecycle.own(after);
            lifecycle.own(() => {
                throw new Error('disposer exploded');
            });

            expect(() => lifecycle.destroy()).not.toThrow();
            expect(after).toHaveBeenCalledTimes(1);
            expect(lifecycle.isDestroyed()).toBe(true);
        });
    });

    /*******************************************************************************
     * TIMERS
     *******************************************************************************/

    describe('timers', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('runs a timeout while the edition is active', () => {
            const spy = vi.fn();
            lifecycle.setTimeout(spy, 100);

            vi.advanceTimersByTime(100);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('cancels pending timeouts on teardown', () => {
            const spy = vi.fn();
            lifecycle.setTimeout(spy, 1000);

            lifecycle.destroy();
            vi.advanceTimersByTime(5000);

            expect(spy).not.toHaveBeenCalled();
        });

        it('cancels intervals on teardown', () => {
            const spy = vi.fn();
            lifecycle.setInterval(spy, 100);

            vi.advanceTimersByTime(250);
            expect(spy).toHaveBeenCalledTimes(2);

            lifecycle.destroy();
            vi.advanceTimersByTime(5000);

            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('refuses to schedule new timers once the edition is closed', () => {
            lifecycle.destroy();

            const spy = vi.fn();
            expect(lifecycle.setTimeout(spy, 10)).toBeNull();
            expect(lifecycle.setInterval(spy, 10)).toBeNull();

            vi.advanceTimersByTime(1000);
            expect(spy).not.toHaveBeenCalled();
        });

        it('binds timer callbacks to the owning device', () => {
            let seen = null;
            lifecycle.setTimeout(function () {
                seen = this;
            }, 10);

            vi.advanceTimersByTime(10);

            expect(seen).toBe(device);
        });

        it('supports cancelling a single timer without teardown', () => {
            const spy = vi.fn();
            const id = lifecycle.setTimeout(spy, 100);

            lifecycle.clearTimeout(id);
            vi.advanceTimersByTime(500);

            expect(spy).not.toHaveBeenCalled();
            expect(lifecycle.timeouts.size).toBe(0);
        });

        it('stops tracking a timeout once it has fired', () => {
            lifecycle.setTimeout(() => {}, 10);
            expect(lifecycle.timeouts.size).toBe(1);

            vi.advanceTimersByTime(10);

            expect(lifecycle.timeouts.size).toBe(0);
        });

        it('cancels animation frames on teardown', () => {
            const spy = vi.fn();
            const raf = vi.fn(() => 42);
            const cancel = vi.fn();
            const originalRaf = window.requestAnimationFrame;
            const originalCancel = window.cancelAnimationFrame;
            window.requestAnimationFrame = raf;
            window.cancelAnimationFrame = cancel;

            try {
                const id = lifecycle.requestAnimationFrame(spy);
                expect(id).toBe(42);

                lifecycle.destroy();

                expect(cancel).toHaveBeenCalledWith(42);
            } finally {
                window.requestAnimationFrame = originalRaf;
                window.cancelAnimationFrame = originalCancel;
            }
        });
    });

    /*******************************************************************************
     * NATIVE EVENT LISTENERS
     *******************************************************************************/

    describe('addEventListener()', () => {
        it('receives events while active and stops after teardown', () => {
            const spy = vi.fn();
            lifecycle.addEventListener(document, 'click', spy);

            document.dispatchEvent(new window.Event('click'));
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            document.dispatchEvent(new window.Event('click'));

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('removes listeners from window too', () => {
            const spy = vi.fn();
            lifecycle.addEventListener(window, 'resize', spy);

            window.dispatchEvent(new window.Event('resize'));
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            window.dispatchEvent(new window.Event('resize'));

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('leaves listeners registered by unrelated code untouched', () => {
            const mine = vi.fn();
            const theirs = vi.fn();
            document.addEventListener('click', theirs);
            lifecycle.addEventListener(document, 'click', mine);

            lifecycle.destroy();
            document.dispatchEvent(new window.Event('click'));

            expect(mine).not.toHaveBeenCalled();
            expect(theirs).toHaveBeenCalledTimes(1);

            document.removeEventListener('click', theirs);
        });

        it('binds the handler to the owning device', () => {
            let seen = null;
            lifecycle.addEventListener(document, 'click', function () {
                seen = this;
            });

            document.dispatchEvent(new window.Event('click'));

            expect(seen).toBe(device);
        });

        it('removes a single listener early', () => {
            const spy = vi.fn();
            const remove = lifecycle.addEventListener(document, 'click', spy);

            remove();
            document.dispatchEvent(new window.Event('click'));

            expect(spy).not.toHaveBeenCalled();
        });

        it('refuses to register once the edition is closed', () => {
            lifecycle.destroy();
            const spy = vi.fn();

            lifecycle.addEventListener(document, 'click', spy);
            document.dispatchEvent(new window.Event('click'));

            expect(spy).not.toHaveBeenCalled();
        });

        it('tolerates a target that is not an EventTarget', () => {
            expect(() => lifecycle.addEventListener(null, 'click', vi.fn())).not.toThrow();
        });

        /**
         * The guard already stops a stale listener from *running*, so these
         * assert the other half: that the registration itself is torn down
         * rather than left attached to a shared target for the page's lifetime.
         * A boolean third argument cannot carry a signal, so it has to be
         * normalized into the options form.
         */
        it('attaches the abort signal even when capture is passed as a boolean', () => {
            const target = document.createElement('div');
            const add = vi.spyOn(target, 'addEventListener');

            lifecycle.addEventListener(target, 'click', vi.fn(), true);

            const options = add.mock.calls[0][2];
            expect(options.signal).toBe(lifecycle.signal);
            expect(options.capture).toBe(true);
            add.mockRestore();
        });

        it('preserves other listener options alongside the abort signal', () => {
            const target = document.createElement('div');
            const add = vi.spyOn(target, 'addEventListener');

            lifecycle.addEventListener(target, 'click', vi.fn(), { capture: true, passive: true });

            const options = add.mock.calls[0][2];
            expect(options).toMatchObject({ capture: true, passive: true });
            expect(options.signal).toBe(lifecycle.signal);
            add.mockRestore();
        });

        it('honours the once option', () => {
            const spy = vi.fn();
            lifecycle.addEventListener(document, 'click', spy, { once: true });

            document.dispatchEvent(new window.Event('click'));
            document.dispatchEvent(new window.Event('click'));

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('registers an explicit disposer when AbortSignal is unavailable', () => {
            const bare = new EditionLifecycle({ device });
            bare.controller = null;
            const target = document.createElement('div');
            const remove = vi.spyOn(target, 'removeEventListener');

            bare.addEventListener(target, 'click', vi.fn(), true);
            bare.destroy();

            expect(remove).toHaveBeenCalledTimes(1);
            expect(remove.mock.calls[0][2]).toBe(true);
            remove.mockRestore();
        });
    });

    /*******************************************************************************
     * JQUERY HANDLERS
     *******************************************************************************/

    describe('jQuery handlers', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="form">
                    <button id="inside">inside</button>
                </div>
                <button id="outside">outside</button>
            `;
        });

        it('removes form-local handlers on teardown', () => {
            const spy = vi.fn();
            lifecycle.on('#inside', 'click', spy);

            $('#inside').trigger('click');
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            $('#inside').trigger('click');

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('removes delegated handlers bound on document', () => {
            const spy = vi.fn();
            lifecycle.on(document, 'click', '#inside', spy);

            $('#inside').trigger('click');
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            $('#inside').trigger('click');

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('removes handlers bound on window', () => {
            const spy = vi.fn();
            lifecycle.on(window, 'resize', spy);

            $(window).trigger('resize');
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            $(window).trigger('resize');

            expect(spy).toHaveBeenCalledTimes(1);
        });

        /**
         * The namespace is what makes teardown surgical: a blanket
         * `$(document).off('click')` would take unrelated handlers with it.
         */
        it('leaves unrelated jQuery handlers on shared targets registered', () => {
            const mine = vi.fn();
            const theirs = vi.fn();
            $(document).on('click', theirs);
            lifecycle.on(document, 'click', mine);

            lifecycle.destroy();
            $(document).trigger('click');

            expect(mine).not.toHaveBeenCalled();
            expect(theirs).toHaveBeenCalledTimes(1);

            $(document).off('click', theirs);
        });

        it('leaves handlers owned by another edition registered', () => {
            const other = new EditionLifecycle({ device: { id: 'other' } });
            const mine = vi.fn();
            const others = vi.fn();

            lifecycle.on(document, 'click', mine);
            other.on(document, 'click', others);

            lifecycle.destroy();
            $(document).trigger('click');

            expect(mine).not.toHaveBeenCalled();
            expect(others).toHaveBeenCalledTimes(1);

            other.destroy();
            $(document).trigger('click');
            expect(others).toHaveBeenCalledTimes(1);
        });

        it('supports several space-separated events', () => {
            const spy = vi.fn();
            lifecycle.on('#inside', 'click keyup', spy);

            $('#inside').trigger('click');
            $('#inside').trigger('keyup');
            expect(spy).toHaveBeenCalledTimes(2);

            lifecycle.destroy();
            $('#inside').trigger('click');
            $('#inside').trigger('keyup');

            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('binds jQuery handlers to the owning device', () => {
            let seen = null;
            lifecycle.on('#inside', 'click', function () {
                seen = this;
            });

            $('#inside').trigger('click');

            expect(seen).toBe(device);
        });

        it('removes a single jQuery handler early', () => {
            const spy = vi.fn();
            const off = lifecycle.on('#inside', 'click', spy);

            off();
            $('#inside').trigger('click');

            expect(spy).not.toHaveBeenCalled();
        });

        it('tolerates a selector that matches nothing', () => {
            expect(() => lifecycle.on('#missing', 'click', vi.fn())).not.toThrow();
        });

        it('refuses to register once the edition is closed', () => {
            lifecycle.destroy();
            const spy = vi.fn();

            lifecycle.on('#inside', 'click', spy);
            $('#inside').trigger('click');

            expect(spy).not.toHaveBeenCalled();
        });
    });

    /*******************************************************************************
     * ABORTABLE WORK AND OWNED RESOURCES
     *******************************************************************************/

    describe('abortable work', () => {
        it('exposes a signal that is aborted on teardown', () => {
            const signal = lifecycle.signal;
            expect(signal.aborted).toBe(false);

            lifecycle.destroy();

            expect(signal.aborted).toBe(true);
        });

        it('fires the signal abort event exactly once across repeated teardown', () => {
            const onAbort = vi.fn();
            lifecycle.signal.addEventListener('abort', onAbort);

            lifecycle.destroy();
            lifecycle.destroy();

            expect(onAbort).toHaveBeenCalledTimes(1);
        });
    });

    describe('ownFileReader()', () => {
        it('aborts a read that is still in progress', () => {
            const reader = { readyState: 1, abort: vi.fn() };
            lifecycle.ownFileReader(reader);

            lifecycle.destroy();

            expect(reader.abort).toHaveBeenCalledTimes(1);
        });

        it('leaves a finished read alone', () => {
            const reader = { readyState: 2, abort: vi.fn() };
            lifecycle.ownFileReader(reader);

            lifecycle.destroy();

            expect(reader.abort).not.toHaveBeenCalled();
        });

        it('tolerates a value that is not a FileReader', () => {
            expect(() => lifecycle.ownFileReader(null)).not.toThrow();
        });
    });

    describe('ownInstance()', () => {
        it('calls the named cleanup method', () => {
            const player = { destroy: vi.fn() };
            lifecycle.ownInstance(player, 'destroy');

            lifecycle.destroy();

            expect(player.destroy).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the instance lacks that method', () => {
            expect(() => lifecycle.ownInstance({}, 'destroy')).not.toThrow();
            expect(() => lifecycle.destroy()).not.toThrow();
        });
    });

    describe('ownMedia()', () => {
        it('stops playback and releases the stream', () => {
            const media = document.createElement('video');
            media.setAttribute('src', 'movie.mp4');
            media.pause = vi.fn();
            media.load = vi.fn();
            lifecycle.ownMedia(media);

            lifecycle.destroy();

            expect(media.pause).toHaveBeenCalledTimes(1);
            expect(media.hasAttribute('src')).toBe(false);
            expect(media.load).toHaveBeenCalledTimes(1);
        });

        /**
         * With `<source>` children left in place, `load()` re-selects one and
         * starts the download again — the opposite of releasing the stream.
         */
        it('removes source children so load() cannot restart the download', () => {
            const media = document.createElement('video');
            media.innerHTML = '<source src="movie.webm" type="video/webm"><source src="movie.mp4">';
            media.pause = vi.fn();
            media.load = vi.fn();
            lifecycle.ownMedia(media);

            lifecycle.destroy();

            expect(media.querySelectorAll('source')).toHaveLength(0);
            expect(media.load).toHaveBeenCalledTimes(1);
        });

        it('tolerates a value that is not a media element', () => {
            expect(() => lifecycle.ownMedia(null, 'preview')).not.toThrow();
            expect(lifecycle.slots.has('preview')).toBe(false);
        });

        /**
         * Editions rebuild the audio preview on every click. Without a slot,
         * each click leaves one more live `Audio` and one more disposer behind
         * until the editor closes.
         */
        it('releases the element a slot already held', () => {
            const first = document.createElement('audio');
            first.setAttribute('src', 'first.mp3');
            first.pause = vi.fn();
            first.load = vi.fn();
            const second = document.createElement('audio');
            second.setAttribute('src', 'second.mp3');
            second.pause = vi.fn();
            second.load = vi.fn();

            lifecycle.ownMedia(first, 'preview');
            lifecycle.ownMedia(second, 'preview');

            expect(first.pause).toHaveBeenCalledTimes(1);
            expect(first.hasAttribute('src')).toBe(false);
            expect(second.pause).not.toHaveBeenCalled();
            expect(lifecycle.disposers).toHaveLength(1);
        });

        it('still releases the element left in a slot on teardown', () => {
            const media = document.createElement('audio');
            media.setAttribute('src', 'clip.mp3');
            media.pause = vi.fn();
            media.load = vi.fn();
            lifecycle.ownMedia(media, 'preview');

            lifecycle.destroy();

            expect(media.pause).toHaveBeenCalledTimes(1);
            expect(media.hasAttribute('src')).toBe(false);
        });

        /**
         * Releasing first would stop the very clip the edition just asked to
         * keep, so re-owning the same element under its own slot does nothing.
         */
        it('leaves the element alone when the same one is re-owned', () => {
            const media = document.createElement('audio');
            media.setAttribute('src', 'clip.mp3');
            media.pause = vi.fn();
            media.load = vi.fn();

            lifecycle.ownMedia(media, 'preview');
            lifecycle.ownMedia(media, 'preview');

            expect(media.pause).not.toHaveBeenCalled();
            expect(media.hasAttribute('src')).toBe(true);
            expect(lifecycle.disposers).toHaveLength(1);
        });

        it('keeps one element per slot name', () => {
            const clip = document.createElement('audio');
            clip.pause = vi.fn();
            clip.load = vi.fn();
            const intro = document.createElement('audio');
            intro.pause = vi.fn();
            intro.load = vi.fn();

            lifecycle.ownMedia(clip, 'clip');
            lifecycle.ownMedia(intro, 'intro');

            expect(clip.pause).not.toHaveBeenCalled();
            expect(intro.pause).not.toHaveBeenCalled();
            expect(lifecycle.disposers).toHaveLength(2);
        });

        it('stacks a disposer per call when no slot is given', () => {
            const first = document.createElement('audio');
            first.pause = vi.fn();
            first.load = vi.fn();
            const second = document.createElement('audio');
            second.pause = vi.fn();
            second.load = vi.fn();

            lifecycle.ownMedia(first);
            lifecycle.ownMedia(second);

            expect(lifecycle.disposers).toHaveLength(2);
        });

        /**
         * `own()` runs a late registration at once rather than leaking it, and
         * a slot must not get in the way of that.
         */
        it('releases an element handed to a slot after teardown', () => {
            const media = document.createElement('audio');
            media.setAttribute('src', 'clip.mp3');
            media.pause = vi.fn();
            media.load = vi.fn();
            lifecycle.destroy();

            lifecycle.ownMedia(media, 'preview');

            expect(media.pause).toHaveBeenCalledTimes(1);
            expect(media.hasAttribute('src')).toBe(false);
            expect(lifecycle.slots.has('preview')).toBe(false);
        });

        it('frees the slot when the element is released early', () => {
            const first = document.createElement('audio');
            first.pause = vi.fn();
            first.load = vi.fn();
            const release = lifecycle.ownMedia(first, 'preview');

            release();

            expect(lifecycle.slots.has('preview')).toBe(false);
            expect(lifecycle.disposers).toHaveLength(0);
        });
    });

    /*******************************************************************************
     * PROMISED FILE READS
     *******************************************************************************/

    describe('readFile()', () => {
        it('resolves with the reader result', async () => {
            const file = new Blob(['hello'], { type: 'text/plain' });

            await expect(lifecycle.readFile(file, 'readAsText')).resolves.toBe('hello');
        });

        it('reads through the method it is given', async () => {
            const file = new Blob(['hello'], { type: 'text/plain' });

            const result = await lifecycle.readFile(file, 'readAsArrayBuffer');

            expect(result.byteLength).toBe(5);
        });

        it('defaults to reading text', async () => {
            const file = new Blob(['hello'], { type: 'text/plain' });

            await expect(lifecycle.readFile(file)).resolves.toBe('hello');
        });

        /**
         * `abort()` fires no `error` event and a bound `loadend` no-ops, so
         * without this the caller awaiting the read would hang forever, holding
         * the file, the reader and its own continuation.
         */
        it('rejects a read that teardown interrupts', async () => {
            const file = new Blob(['hello'], { type: 'text/plain' });
            const pending = lifecycle.readFile(file, 'readAsText');

            lifecycle.destroy();

            await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        });

        it('rejects at once when the edition is already closed', async () => {
            lifecycle.destroy();

            await expect(lifecycle.readFile(new Blob(['hello']), 'readAsText')).rejects.toMatchObject({
                name: 'AbortError',
            });
        });

        it('leaves a completed read settled when teardown follows', async () => {
            const file = new Blob(['hello'], { type: 'text/plain' });

            const result = await lifecycle.readFile(file, 'readAsText');
            lifecycle.destroy();

            expect(result).toBe('hello');
        });

        it('rejects an unusable read method instead of hanging', async () => {
            await expect(lifecycle.readFile(new Blob(['hello']), 'readAsNothing')).rejects.toBeInstanceOf(TypeError);
        });

        it('rejects when the reader fails', async () => {
            const reader = { readyState: 1, abort: vi.fn(), error: new Error('boom'), readAsText() {} };
            const originalFileReader = window.FileReader;
            window.FileReader = function () {
                return reader;
            };

            try {
                const pending = lifecycle.readFile(new Blob(['hello']), 'readAsText');
                reader.onerror();
                await expect(pending).rejects.toThrow('boom');
            } finally {
                window.FileReader = originalFileReader;
            }
        });
    });

    /*******************************************************************************
     * SETTLED PROMISES
     *******************************************************************************/

    describe('promise()', () => {
        it('settles like the executor asks', async () => {
            await expect(lifecycle.promise((resolve) => resolve('ok'))).resolves.toBe('ok');
            await expect(lifecycle.promise((_resolve, reject) => reject(new Error('no')))).rejects.toThrow('no');
        });

        it('rejects an executor that throws', async () => {
            await expect(
                lifecycle.promise(() => {
                    throw new Error('thrown');
                }),
            ).rejects.toThrow('thrown');
        });

        /**
         * Whatever would have completed the promise — a timer, a listener — is
         * released by teardown, so without this the caller hangs forever.
         */
        it('rejects work that teardown interrupts', async () => {
            const pending = lifecycle.promise(() => {});

            lifecycle.destroy();

            await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        });

        it('rejects at once, without running the executor, when the edition is closed', async () => {
            const executor = vi.fn();
            lifecycle.destroy();

            await expect(lifecycle.promise(executor)).rejects.toMatchObject({ name: 'AbortError' });
            expect(executor).not.toHaveBeenCalled();
        });

        it('forgets its teardown hook once settled, so a long edition does not pile them up', async () => {
            const before = lifecycle.disposers.length;

            await lifecycle.promise((resolve) => resolve());
            await lifecycle.promise((_resolve, reject) => reject(new Error('x'))).catch(() => {});

            expect(lifecycle.disposers.length).toBe(before);
        });
    });

    describe('delay()', () => {
        it('resolves after the delay', async () => {
            vi.useFakeTimers();
            const done = vi.fn();
            lifecycle.delay(100).then(done);

            await vi.advanceTimersByTimeAsync(99);
            expect(done).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(done).toHaveBeenCalled();
        });

        it('rejects when the edition closes before the delay ends', async () => {
            vi.useFakeTimers();
            const pending = lifecycle.delay(100);
            const outcome = expect(pending).rejects.toMatchObject({ name: 'AbortError' });

            lifecycle.destroy();
            await vi.advanceTimersByTimeAsync(200);

            await outcome;
        });
    });

    describe('isAbortError()', () => {
        it('recognises the error teardown settles with, and aborted fetches', async () => {
            const pending = lifecycle.promise(() => {});
            lifecycle.destroy();
            const error = await pending.catch((e) => e);

            expect(lifecycle.isAbortError(error)).toBe(true);
            expect(lifecycle.isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
            expect(lifecycle.isAbortError(new Error('network'))).toBe(false);
            expect(lifecycle.isAbortError(null)).toBe(false);
        });
    });

    /*******************************************************************************
     * DESTROY HOOK
     *******************************************************************************/

    describe('destroy hook', () => {
        it('calls the iDevice hook while the instance is still available', () => {
            let deviceDuringHook = null;
            device[EDITION_DESTROY_HOOK] = function () {
                deviceDuringHook = this;
            };

            lifecycle.destroy();

            expect(deviceDuringHook).toBe(device);
            expect(lifecycle.device).toBeNull();
        });

        it('runs the hook before registered disposers', () => {
            const order = [];
            device[EDITION_DESTROY_HOOK] = () => order.push('hook');
            lifecycle.own(() => order.push('disposer'));

            lifecycle.destroy();

            expect(order).toEqual(['hook', 'disposer']);
        });

        it('runs the hook at most once', () => {
            device[EDITION_DESTROY_HOOK] = vi.fn();

            lifecycle.destroy();
            lifecycle.destroy();

            expect(device[EDITION_DESTROY_HOOK]).toHaveBeenCalledTimes(1);
        });

        it('keeps tearing down when the hook throws', () => {
            const disposer = vi.fn();
            device[EDITION_DESTROY_HOOK] = () => {
                throw new Error('hook exploded');
            };
            lifecycle.own(disposer);

            const errors = lifecycle.destroy();

            expect(disposer).toHaveBeenCalledTimes(1);
            expect(errors.map((e) => e.label)).toContain(EDITION_DESTROY_HOOK);
            expect(lifecycle.isDestroyed()).toBe(true);
        });

        it('is optional', () => {
            expect(() => lifecycle.destroy()).not.toThrow();
        });
    });

    /*******************************************************************************
     * RETENTION
     *******************************************************************************/

    describe('retention', () => {
        it('drops the edition it owned, so a stray bound callback retains nothing', () => {
            const formElement = document.createElement('div');
            const ownerNode = { engine: {} };
            const owned = new EditionLifecycle({
                device: { name: 'device' },
                formElement,
                ownerNode,
            });
            // `bind()` closes over the whole lifecycle, so anything parked in an
            // application-lifetime registry keeps it — and whatever it still
            // points at — reachable.
            const stray = owned.bind(function () {});

            owned.destroy();

            expect(owned.device).toBeNull();
            expect(owned.formElement).toBeNull();
            expect(owned.ownerNode).toBeNull();
            expect(owned.disposers).toEqual([]);
            // The callback survives and stays inert, which is the point.
            expect(() => stray()).not.toThrow();
            expect(stray()).toBeUndefined();
        });
    });

    /*******************************************************************************
     * PARTIAL INITIALIZATION
     *******************************************************************************/

    describe('partial initialization', () => {
        it('tears down safely when nothing was ever registered', () => {
            const bare = new EditionLifecycle({ device: null });
            expect(() => bare.destroy()).not.toThrow();
            expect(bare.isDestroyed()).toBe(true);
        });

        it('tears down safely when the device never finished initializing', () => {
            const partial = new EditionLifecycle({ device: undefined });
            const disposer = vi.fn();
            partial.own(disposer);

            expect(() => partial.destroy()).not.toThrow();
            expect(disposer).toHaveBeenCalledTimes(1);
        });

        it('marks itself inactive before running any cleanup', () => {
            let stateDuringCleanup = null;
            lifecycle.own(() => {
                stateDuringCleanup = lifecycle.isActive();
            });

            lifecycle.destroy();

            expect(stateDuringCleanup).toBe(false);
        });
    });
});
