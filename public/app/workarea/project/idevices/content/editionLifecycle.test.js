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

    describe('run()', () => {
        it('executes while active and skips after teardown', () => {
            const spy = vi.fn();
            lifecycle.run(spy);
            expect(spy).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            lifecycle.run(spy);
            expect(spy).toHaveBeenCalledTimes(1);
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

        it('supports one() and removes it on teardown if it never fired', () => {
            const fired = vi.fn();
            const never = vi.fn();

            lifecycle.one('#inside', 'click', fired);
            lifecycle.one('#outside', 'click', never);

            $('#inside').trigger('click');
            $('#inside').trigger('click');
            expect(fired).toHaveBeenCalledTimes(1);

            lifecycle.destroy();
            $('#outside').trigger('click');

            expect(never).not.toHaveBeenCalled();
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

    describe('ownObserver()', () => {
        it('disconnects the observer on teardown', () => {
            const observer = { disconnect: vi.fn() };
            lifecycle.ownObserver(observer);

            lifecycle.destroy();

            expect(observer.disconnect).toHaveBeenCalledTimes(1);
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

    describe('ownObjectUrl()', () => {
        it('revokes the URL on teardown', () => {
            const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            lifecycle.ownObjectUrl('blob:fake-url');

            lifecycle.destroy();

            expect(revoke).toHaveBeenCalledWith('blob:fake-url');
            revoke.mockRestore();
        });

        it('ignores an empty URL', () => {
            const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            lifecycle.ownObjectUrl('');

            lifecycle.destroy();

            expect(revoke).not.toHaveBeenCalled();
            revoke.mockRestore();
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
