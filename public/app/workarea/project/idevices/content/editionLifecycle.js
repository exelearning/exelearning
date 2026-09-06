/**
 * eXeLearning
 *
 * iDevice edition lifecycle.
 *
 * Every time an iDevice editor is opened, `IdeviceNode` creates one
 * `EditionLifecycle` and hands it to the edition script through
 * `$exeDevice.$lifecycle` (and the `$exeEditionLifecycle` global, for the
 * shared edition helpers that run outside the device object).
 *
 * The lifecycle owns everything the edition creates that can outlive it:
 * timers, event handlers, abortable requests, file readers, media elements and
 * third-party instances. When the editor closes, `destroy()` releases
 * all of it **before** the global `$exeDevice` is cleared or replaced.
 *
 * Two invariants make this safe:
 *
 * 1. Use-after-destroy is impossible: a destroyed lifecycle refuses to run any
 *    callback it owns.
 * 2. Cross-instance leakage is impossible: callbacks registered through this
 *    object are bound to the device instance that owned them, so a callback
 *    created by edition A can never operate on a later edition B. Resolving the
 *    mutable `$exeDevice` global inside a deferred callback does not give that
 *    guarantee, which is why edition code should call `this.<method>()` on the
 *    bound `this` instead of `$exeDevice.<method>()`.
 *
 * Usage from an edition script:
 *
 *     init: function (element, data) {
 *         this.$lifecycle.setTimeout(function () {
 *             // `this` is this edition instance, never a later one.
 *             this.refreshPreview();
 *         }, 500);
 *
 *         this.$lifecycle.on(document, 'keydown', this.onKeyDown);
 *         this.$lifecycle.own(() => player.destroy());
 *     },
 *
 *     // Optional per-iDevice hook, called while the DOM and the instance are
 *     // still alive. Anything registered above is released automatically, so
 *     // most iDevices do not need this at all.
 *     destroyEdition: function () { ... },
 */

/**
 * Name of the optional teardown hook an edition object may implement.
 * Checked against the whole repository before being chosen: no edition script
 * defines `destroyEdition`, while `destroy` and `dispose` are already used by
 * the 3D/360 viewers with a different meaning.
 */
export const EDITION_DESTROY_HOOK = 'destroyEdition';

/**
 * `FileReader.LOADING`. Hard-coded because the constant is fixed by the File
 * API specification and is not exposed as a static in every environment the
 * workarea and its tests run in.
 */
const FILE_READER_LOADING = 1;

/** Incremented once per edition instance, so every lifecycle is identifiable. */
let generation = 0;

/**
 * The lifecycle of the edition currently open, if any.
 *
 * Only one iDevice can be edited at a time, so a single slot is enough. It is
 * kept here rather than on a node because teardown can be triggered by a node
 * other than the one that opened the editor.
 */
let activeLifecycle = null;

/**
 * @returns {EditionLifecycle|null}
 */
export function getActiveEditionLifecycle() {
    return activeLifecycle;
}

/**
 * Publish the lifecycle of the edition being opened, and expose it to the
 * edition scripts and shared edition helpers, which are classic scripts and
 * cannot import this module.
 *
 * @param {EditionLifecycle|null} lifecycle
 * @returns {EditionLifecycle|null}
 */
export function setActiveEditionLifecycle(lifecycle) {
    activeLifecycle = lifecycle || null;
    if (typeof window !== 'undefined') {
        window.$exeEditionLifecycle = activeLifecycle;
    }
    return activeLifecycle;
}

/**
 * jQuery event namespaces accept word characters only. The generation counter
 * keeps them unique per edition instance, which is what makes `.off(namespace)`
 * remove this edition's handlers and nothing else.
 *
 * @param {Number} id
 * @returns {String}
 */
function buildNamespace(id) {
    return `exeEdition${id}`;
}

/**
 * Resolve the jQuery factory lazily: edition scripts always run with jQuery
 * loaded, but the workarea bundle must not hard-depend on it.
 *
 * @returns {Function|null}
 */
function getJQuery() {
    return typeof window !== 'undefined' ? window.jQuery || window.$ || null : null;
}

export default class EditionLifecycle {
    /**
     * @param {Object} options
     * @param {Object} [options.device] Owning `$exeDevice` instance.
     * @param {String} [options.name] iDevice type name, for diagnostics.
     * @param {Element} [options.formElement] Root of the edition form, so the
     *        caller can clean the right subtree after teardown.
     * @param {Object} [options.ownerNode] `IdeviceNode` that opened the edition,
     *        so whoever disposes it can drop the owner's reference too.
     * @param {Object} [options.logger] Logger with `warn`; defaults to AppLogger.
     */
    constructor(options = {}) {
        this.id = ++generation;
        this.name = options.name || 'idevice';
        this.device = options.device || null;
        this.formElement = options.formElement || null;
        this.ownerNode = options.ownerNode || null;
        this.destroyed = false;
        this.namespace = buildNamespace(this.id);
        this.logger = options.logger || (typeof window !== 'undefined' && window.AppLogger) || console;

        this.controller = typeof AbortController === 'function' ? new AbortController() : null;

        this.disposers = [];
        this.timeouts = new Set();
        this.intervals = new Set();
        this.animationFrames = new Set();
        /** Errors raised by disposers, kept for tests and diagnostics. */
        this.errors = [];
    }

    /*******************************************************************************
     * STATE
     *******************************************************************************/

    /**
     * True only while the edition is live. Turns false as soon as teardown
     * starts, so callbacks fired synchronously by a plugin being destroyed are
     * already rejected.
     *
     * @returns {Boolean}
     */
    isActive() {
        return !this.destroyed;
    }

    /**
     * @returns {Boolean}
     */
    isDestroyed() {
        return this.destroyed;
    }

    /**
     * AbortSignal shared by every abortable operation this edition owns.
     * Pass it to `fetch()`, or to `addEventListener` when registering listeners
     * by hand.
     *
     * @returns {AbortSignal|null}
     */
    get signal() {
        return this.controller ? this.controller.signal : null;
    }

    /**
     * Bind a callback to this edition instance.
     *
     * The returned function no-ops once the edition is closed and always runs
     * with `this` set to the device that owned the lifecycle, so it can never
     * reach a later `$exeDevice`.
     *
     * Arrow callbacks ignore `this`; capture the instance lexically instead
     * (`const self = this;` in `init()`). A lexical capture is bound to the
     * instance that created it, so it offers the same guarantee.
     *
     * @param {Function} callback
     * @returns {Function}
     */
    bind(callback) {
        if (typeof callback !== 'function') {
            return () => undefined;
        }
        const lifecycle = this;
        return function boundToEdition(...args) {
            if (!lifecycle.isActive()) return undefined;
            const device = lifecycle.device;
            return callback.apply(device === null ? this : device, args);
        };
    }

    /*******************************************************************************
     * OWNERSHIP
     *******************************************************************************/

    /**
     * Register an arbitrary cleanup function. Disposers run in reverse
     * registration order (LIFO), so resources are released in the opposite
     * order they were created.
     *
     * Returns a function that releases the resource early and unregisters it,
     * matching the disposer convention already used by
     * `IdeviceNode.inactivityInElement()`.
     *
     * @param {Function} disposer
     * @returns {Function} Runs the disposer now and forgets it.
     */
    own(disposer) {
        if (typeof disposer !== 'function') {
            return () => undefined;
        }
        // Refusing late registrations is what stops teardown from resurrecting
        // work; run the disposer at once so the resource is not leaked either.
        if (!this.isActive()) {
            this.safely(disposer, 'late-disposer');
            return () => undefined;
        }
        this.disposers.push(disposer);
        return () => {
            const index = this.disposers.indexOf(disposer);
            if (index === -1) return undefined;
            this.disposers.splice(index, 1);
            return this.safely(disposer, 'disposer');
        };
    }

    /**
     * Own a third-party instance that exposes a cleanup method.
     * The method name must be given explicitly: never assume an instance has
     * `destroy()`.
     *
     * @param {Object} instance
     * @param {String} methodName e.g. 'destroy', 'dispose', 'disconnect'
     * @returns {Function}
     */
    ownInstance(instance, methodName) {
        if (!instance || typeof instance[methodName] !== 'function') {
            return () => undefined;
        }
        return this.own(() => instance[methodName]());
    }

    /**
     * Own a FileReader: an in-flight read is aborted on teardown, and reads
     * that already completed are left alone.
     *
     * Abort only stops the read; guard the reader's callbacks with `bind()` so
     * a `loadend` that is already queued cannot touch a closed edition.
     *
     * @param {FileReader} reader
     * @returns {Function}
     */
    ownFileReader(reader) {
        if (!reader || typeof reader.abort !== 'function') {
            return () => undefined;
        }
        return this.own(() => {
            if (reader.readyState === FILE_READER_LOADING) reader.abort();
        });
    }

    /**
     * Own a media element so playback and its network activity stop when the
     * edition closes. Clearing the source and calling `load()` is what actually
     * releases the stream; `pause()` alone does not.
     *
     * Child `<source>` elements are removed as well: with them in place,
     * `load()` simply re-selects one of them and starts the download again,
     * which is the opposite of what teardown wants.
     *
     * @param {HTMLMediaElement} media
     * @returns {Function}
     */
    ownMedia(media) {
        if (!media || typeof media.pause !== 'function') {
            return () => undefined;
        }
        return this.own(() => {
            media.pause();
            media.removeAttribute('src');
            if (typeof media.querySelectorAll === 'function') {
                media.querySelectorAll('source').forEach((source) => source.remove());
            }
            if (typeof media.load === 'function') media.load();
        });
    }

    /*******************************************************************************
     * TIMERS
     *******************************************************************************/

    /**
     * `setTimeout` owned by this edition. The callback is bound with `bind()`,
     * so it neither runs after teardown nor reaches another instance.
     *
     * @param {Function} callback
     * @param {Number} delay
     * @param {...*} args
     * @returns {Number|null} Timer id, or null if the edition is closed.
     */
    setTimeout(callback, delay, ...args) {
        if (!this.isActive()) return null;
        const guarded = this.bind(callback);
        const id = window.setTimeout(
            (...callbackArgs) => {
                this.timeouts.delete(id);
                guarded(...callbackArgs);
            },
            delay,
            ...args
        );
        this.timeouts.add(id);
        return id;
    }

    /**
     * @param {Number} id
     */
    clearTimeout(id) {
        if (id === null || id === undefined) return;
        this.timeouts.delete(id);
        window.clearTimeout(id);
    }

    /**
     * `setInterval` owned by this edition.
     *
     * @param {Function} callback
     * @param {Number} delay
     * @param {...*} args
     * @returns {Number|null}
     */
    setInterval(callback, delay, ...args) {
        if (!this.isActive()) return null;
        const guarded = this.bind(callback);
        const id = window.setInterval(guarded, delay, ...args);
        this.intervals.add(id);
        return id;
    }

    /**
     * @param {Number} id
     */
    clearInterval(id) {
        if (id === null || id === undefined) return;
        this.intervals.delete(id);
        window.clearInterval(id);
    }

    /**
     * `requestAnimationFrame` owned by this edition.
     *
     * @param {Function} callback
     * @returns {Number|null}
     */
    requestAnimationFrame(callback) {
        if (!this.isActive() || typeof window.requestAnimationFrame !== 'function') return null;
        const guarded = this.bind(callback);
        const id = window.requestAnimationFrame((...args) => {
            this.animationFrames.delete(id);
            guarded(...args);
        });
        this.animationFrames.add(id);
        return id;
    }

    /*******************************************************************************
     * EVENT HANDLERS
     *******************************************************************************/

    /**
     * Native listener owned by this edition.
     *
     * Registration uses the lifecycle's `AbortSignal`, so the listener is
     * removed by the browser on teardown whatever the target is: `document`,
     * `window`, a media element or a node outside the edition form. Handlers
     * are bound, so a listener that fires between abort and removal still
     * cannot touch a closed edition.
     *
     * @param {EventTarget} target
     * @param {String} type
     * @param {Function} handler
     * @param {Object|Boolean} [options] Passed through; `signal` is added.
     * @returns {Function} Removes this single listener early.
     */
    addEventListener(target, type, handler, options) {
        if (!target || typeof target.addEventListener !== 'function' || !this.isActive()) {
            return () => undefined;
        }
        const guarded = this.bind(handler);
        const capture = options === true || (options && options.capture === true);

        // A boolean third argument cannot carry a signal, so normalize it into
        // the options form; otherwise the listener would never be removed.
        const usesSignal = Boolean(this.signal);
        const listenerOptions = usesSignal
            ? { ...(typeof options === 'boolean' ? { capture: options } : options || {}), signal: this.signal }
            : options;

        target.addEventListener(type, guarded, listenerOptions);

        const remove = () => target.removeEventListener(type, guarded, capture);
        // Registered even when a signal is attached: an `EventTarget` that
        // ignores the `signal` option — a shim, or a third-party emitter — would
        // otherwise keep the listener for the lifetime of the page. Removing an
        // already-removed listener is a no-op, so the backstop is free.
        const release = this.own(remove);
        return () => release();
    }

    /**
     * jQuery handler owned by this edition.
     *
     * The handler is registered under a namespace unique to this edition, so
     * teardown removes exactly these handlers and leaves every unrelated one in
     * place — which matters for shared targets such as `document` and `window`.
     * Delegated handlers are supported: pass a selector before the handler.
     *
     * @param {*} target Element, selector or jQuery object.
     * @param {String} events Space-separated event names, without namespace.
     * @param {String|Function} selector Delegation selector, or the handler.
     * @param {Function} [handler]
     * @returns {Function} Removes these handlers early.
     */
    on(target, events, selector, handler) {
        return this.bindJQuery('on', target, events, selector, handler);
    }

    /**
     * Shared implementation of the jQuery binding helpers.
     *
     * @param {String} method
     * @param {*} target
     * @param {String} events
     * @param {String|Function} selector
     * @param {Function} [handler]
     * @returns {Function}
     */
    bindJQuery(method, target, events, selector, handler) {
        const jq = getJQuery();
        if (!jq || !this.isActive() || typeof events !== 'string') {
            return () => undefined;
        }

        const $target = jq(target);
        if (!$target || $target.length === 0) {
            return () => undefined;
        }

        const namespaced = events
            .split(/\s+/)
            .filter(Boolean)
            .map((name) => `${name}.${this.namespace}`)
            .join(' ');

        const realHandler = typeof selector === 'function' ? selector : handler;
        const delegation = typeof selector === 'function' ? undefined : selector;
        const guarded = this.bind(realHandler);

        if (delegation === undefined) {
            $target[method](namespaced, guarded);
        } else {
            $target[method](namespaced, delegation, guarded);
        }

        return this.own(() => {
            if (delegation === undefined) {
                jq(target).off(namespaced, guarded);
            } else {
                jq(target).off(namespaced, delegation, guarded);
            }
        });
    }

    /*******************************************************************************
     * TEARDOWN
     *******************************************************************************/

    /**
     * Release everything this edition owns. Safe to call repeatedly: only the
     * first call does any work.
     *
     * Order matters. The lifecycle is marked inactive first so nothing it owns
     * can run while teardown is in progress; pending async work is cancelled
     * next; the iDevice's own hook then runs while its instance and its DOM are
     * both still available; registered disposers follow, in reverse order.
     *
     * A failing disposer never aborts teardown: errors are collected, logged
     * and reported, and the remaining resources are still released.
     *
     * @returns {Array} Errors raised while disposing, empty when clean.
     */
    destroy() {
        if (this.destroyed) {
            return this.errors;
        }
        // Set first, so nothing this owns can run while teardown is in progress
        // and a reentrant call returns immediately.
        this.destroyed = true;

        try {
            this.cancelPendingWork();
            this.runDestroyHook();
            this.runDisposers();
        } finally {
            // Released unconditionally, so a failing disposer cannot leave the
            // lifecycle holding the edition. `bind()` closes over the whole
            // lifecycle, so a bound callback that outlives teardown — parked in
            // an app-lifetime registry, say — would otherwise keep the form's
            // DOM subtree and the owning node's entire engine reachable.
            this.disposers = [];
            this.device = null;
            this.formElement = null;
            this.ownerNode = null;
        }

        return this.errors;
    }

    /**
     * Abort every cancellable operation and stop every timer.
     */
    cancelPendingWork() {
        this.safely(() => {
            if (this.controller && !this.controller.signal.aborted) {
                this.controller.abort();
            }
        }, 'abort');

        this.timeouts.forEach((id) => window.clearTimeout(id));
        this.timeouts.clear();
        this.intervals.forEach((id) => window.clearInterval(id));
        this.intervals.clear();
        if (typeof window.cancelAnimationFrame === 'function') {
            this.animationFrames.forEach((id) => window.cancelAnimationFrame(id));
        }
        this.animationFrames.clear();
    }

    /**
     * Run the iDevice's optional teardown hook, if it declares one.
     */
    runDestroyHook() {
        const device = this.device;
        if (!device || typeof device[EDITION_DESTROY_HOOK] !== 'function') return;
        this.safely(() => device[EDITION_DESTROY_HOOK](), EDITION_DESTROY_HOOK);
    }

    /**
     * Run registered disposers in reverse registration order.
     */
    runDisposers() {
        const disposers = this.disposers;
        this.disposers = [];
        for (let i = disposers.length - 1; i >= 0; i--) {
            this.safely(disposers[i], 'disposer');
        }
    }

    /**
     * Run a cleanup step, recording and logging any failure instead of letting
     * it abort the rest of the teardown.
     *
     * @param {Function} step
     * @param {String} label
     * @returns {*}
     */
    safely(step, label) {
        try {
            return step();
        } catch (error) {
            this.errors.push({ label, error });
            try {
                const message = `[EditionLifecycle] ${this.name}#${this.id} cleanup failed (${label}):`;
                if (this.logger && typeof this.logger.warn === 'function') {
                    this.logger.warn(message, error);
                }
            } catch {
                // Reporting a cleanup failure must never become one: a logger
                // that throws would abort the teardown it is reporting on.
            }
            return undefined;
        }
    }
}
