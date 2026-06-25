/**
 * exe_media_bridge — child-side runtime for external media in opaque-iframe mode.
 *
 * Shipped inside every exported eXeLearning package (classic <script>, file:// safe).
 * When the package is rendered inside an opaque-origin sandboxed iframe (no
 * `allow-same-origin`), nested YouTube/Vimeo players cannot run, so this runtime:
 *
 *   1. Detects the opaque/sandboxed context and handshakes with the trusted parent
 *      host page (capability token + transferred MessageChannel port).
 *   2. Replaces nested YouTube/Vimeo embeds with an accessible placeholder that asks
 *      the parent to open the real player in a trusted modal on click.
 *   3. Exposes a provider-neutral BridgeController so the interactive video iDevices
 *      can relay play/pause/seek/time/ended/error and keep their question timing.
 *   4. Degrades gracefully (visible notice + open-in-new-tab) when no parent answers —
 *      never a blank iframe.
 *
 * Security: never trusts `event.origin` (it is the string "null" here). The only
 * window-level message accepted is the parent's `welcome`, gated by window identity
 * (`event.source === window.parent`) + the echoed handshake id. All subsequent media
 * traffic flows over the private MessageChannel port, validated by exe_media_policy.
 *
 * Depends on the global `exeMediaPolicy` (exe_media_policy.js), which must load first.
 *
 * @license AGPL-3.0
 */
(function (root) {
    'use strict';

    var policy = root.exeMediaPolicy;

    var DEFAULT_TIMEOUT_MS = 8000;

    function trc(key, fallback) {
        // Exported content reads resolved strings from the $exe_i18n bundle (built from
        // the c_("...") keys in common_i18n.js); fall back to English when absent.
        var i18n = typeof root.$exe_i18n !== 'undefined' ? root.$exe_i18n : null;
        return (i18n && i18n[key]) || fallback;
    }

    function providerName(provider) {
        if (provider === 'youtube') return 'YouTube';
        if (provider === 'vimeo') return 'Vimeo';
        if (provider === 'pdf') return 'PDF';
        return provider || '';
    }

    function getScheduler(opts) {
        opts = opts || {};
        return {
            setTimeout: opts.setTimeout || root.setTimeout.bind(root),
            clearTimeout: opts.clearTimeout || root.clearTimeout.bind(root),
        };
    }

    function genId(opts) {
        if (opts && typeof opts.genId === 'function') return opts.genId();
        if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
        return 'h-' + Math.random().toString(36).slice(2) + '-' + (root.performance ? root.performance.now() : 0);
    }

    /**
     * Detect an opaque-origin sandboxed iframe: either the origin is the literal
     * string "null", or web storage access throws (the browser blocks storage for an
     * opaque/partitioned origin). Mirrors the detection used by the SCORM bridge shim.
     */
    function isSandboxedOpaque(win) {
        win = win || root;
        try {
            if (win.origin === 'null') return true;
        } catch (e) {
            return true;
        }
        try {
            var ls = win.localStorage;
            var k = '__exeMediaProbe__';
            ls.setItem(k, '1');
            ls.removeItem(k);
            return false;
        } catch (e) {
            return true;
        }
    }

    function inIframe(win) {
        win = win || root;
        try {
            return win.self !== win.top;
        } catch (e) {
            return true; // cross-origin parent access throws → we are framed
        }
    }

    function shouldUseBridge(win) {
        win = win || root;
        return inIframe(win) && isSandboxedOpaque(win);
    }

    /**
     * Provider-neutral controller bound to a MessageChannel port + nonce. Serializes
     * neutral commands to validated messages and fans inbound events out to listeners.
     * getCurrentTime/getDuration are async (they round-trip the port).
     */
    function createBridgeController(opts) {
        var port = opts.port;
        var nonce = opts.nonce;
        var listeners = {};
        var pending = {};
        var reqSeq = 0;

        function emit(evt, payload) {
            var arr = listeners[evt];
            if (!arr) return;
            for (var i = 0; i < arr.length; i++) {
                try {
                    arr[i](payload);
                } catch (e) {
                    /* a listener must not break the relay */
                }
            }
        }

        function send(cmd) {
            cmd.type = policy.TYPE;
            cmd.v = policy.VERSION;
            cmd.exelearningBridge = nonce;
            if (policy.validateCommand(cmd, nonce) && port) {
                port.postMessage(cmd);
            }
        }

        function request(action, field) {
            var reqId = ++reqSeq;
            return new Promise(function (resolve) {
                pending[reqId] = { resolve: resolve, field: field };
                send({ action: action, reqId: reqId });
            });
        }

        var ctl = {
            on: function (evt, cb) {
                (listeners[evt] = listeners[evt] || []).push(cb);
                return ctl;
            },
            off: function (evt, cb) {
                var a = listeners[evt];
                if (a) {
                    var i = a.indexOf(cb);
                    if (i >= 0) a.splice(i, 1);
                }
                return ctl;
            },
            open: function (o) {
                send({
                    action: 'open',
                    reqId: ++reqSeq,
                    provider: o.provider,
                    videoId: o.videoId,
                    start: o.start,
                    autoplay: o.autoplay,
                });
            },
            play: function () {
                send({ action: 'play' });
            },
            pause: function () {
                send({ action: 'pause' });
            },
            seek: function (t) {
                send({ action: 'seek', t: t });
            },
            hide: function () {
                send({ action: 'hide' });
            },
            show: function () {
                send({ action: 'show' });
            },
            close: function () {
                send({ action: 'close' });
            },
            getCurrentTime: function () {
                return request('getCurrentTime', 'currentTime');
            },
            getDuration: function () {
                return request('getDuration', 'duration');
            },
            handleEvent: function (data) {
                if (!policy.validateEvent(data)) return;
                if (data.action === 'state') {
                    var r = pending[data.reqId];
                    if (r) {
                        delete pending[data.reqId];
                        r.resolve(r.field === 'duration' ? data.duration : data.currentTime);
                    }
                    return;
                }
                emit(data.action, data);
            },
        };

        if (port) {
            port.onmessage = function (e) {
                ctl.handleEvent(e.data);
            };
            if (typeof port.start === 'function') port.start();
        }
        return ctl;
    }

    // One shared handshake per page: many embeds, one parent bridge.
    var sessionPromise = null;

    /**
     * Announce to the parent and wait for a `welcome` carrying a transferred port.
     * Resolves { nonce, port } on success, or null if no parent answers within the
     * watchdog (→ graceful degradation). Shared/cached across all callers on the page.
     */
    function ensureSession(opts) {
        opts = opts || {};
        if (sessionPromise && !opts.fresh) return sessionPromise;
        var win = opts.win || root;
        var sched = getScheduler(opts);

        sessionPromise = new Promise(function (resolve) {
            var parent = null;
            try {
                parent = win.parent;
            } catch (e) {
                parent = null;
            }
            if (!parent || parent === win) {
                resolve(null);
                return;
            }

            var helloId = genId(opts);
            var settled = false;
            var timer;

            function cleanup() {
                if (win.removeEventListener) win.removeEventListener('message', onMessage);
                if (timer) sched.clearTimeout(timer);
            }
            function finish(value) {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(value);
            }
            function onMessage(e) {
                if (settled) return;
                if (e.source !== parent) return; // window identity — the only trust anchor here
                var data = e.data;
                if (!policy.isWelcome(data) || data.helloId !== helloId) return;
                var port = (e.ports && e.ports[0]) || null;
                if (!port) return;
                finish({ nonce: data.exelearningBridge, port: port });
            }

            if (win.addEventListener) win.addEventListener('message', onMessage);
            try {
                parent.postMessage(
                    { type: policy.TYPE, v: policy.VERSION, action: 'hello', helloId: helloId, exelearningBridge: null },
                    '*',
                );
            } catch (e) {
                /* posting to an unreachable parent → watchdog handles it */
            }
            timer = sched.setTimeout(function () {
                finish(null);
            }, opts.timeoutMs || DEFAULT_TIMEOUT_MS);
        });
        return sessionPromise;
    }

    /**
     * High-level entry for the video iDevices: ensure the bridge, ask the parent to
     * open the player, and resolve a BridgeController once the player reports `ready`.
     * Rejects when there is no parent bridge (→ caller shows its fallback).
     */
    function openMedia(opts) {
        opts = opts || {};
        var sched = getScheduler(opts);
        return ensureSession(opts).then(function (session) {
            if (!session) {
                return Promise.reject(new Error('no-bridge'));
            }
            var ctl = createBridgeController({ port: session.port, nonce: session.nonce });
            return new Promise(function (resolve, reject) {
                var done = false;
                var timer = sched.setTimeout(function () {
                    if (!done) {
                        done = true;
                        reject(new Error('ready-timeout'));
                    }
                }, opts.readyTimeoutMs || DEFAULT_TIMEOUT_MS);
                ctl.on('ready', function () {
                    if (done) return;
                    done = true;
                    sched.clearTimeout(timer);
                    resolve(ctl);
                });
                ctl.on('error', function (e) {
                    if (done || !e || !e.fatal) return;
                    done = true;
                    sched.clearTimeout(timer);
                    reject(new Error(e.code || 'error'));
                });
                ctl.open({ provider: opts.provider, videoId: opts.videoId, start: opts.start, autoplay: opts.autoplay });
            });
        });
    }

    /**
     * Build an accessible placeholder for an external media descriptor. In normal
     * (bridge) mode it is a play button that asks the parent to open the modal; in
     * degraded mode (or for PDF) it is an "open in a new tab" link.
     */
    function buildPlaceholder(descriptor, opts) {
        opts = opts || {};
        var doc = opts.document || root.document;
        var degraded = opts.degraded || !descriptor.requiresBridge;
        var title = descriptor.title || '';
        var label = providerName(descriptor.provider);

        // Self-contained inline styles so the placeholder presents reasonably inside any
        // exported theme (mirrors the existing showYoutubeFallback approach in iDevices).
        var wrap = doc.createElement('div');
        wrap.className = 'exe-external-media' + (degraded ? ' exe-external-media--degraded' : '');
        wrap.setAttribute('data-exe-media-provider', descriptor.provider);
        if (descriptor.providerVideoId) wrap.setAttribute('data-exe-media-id', descriptor.providerVideoId);
        wrap.setAttribute('data-exe-media-url', descriptor.originalUrl || descriptor.embedUrl || '');
        if (descriptor.interactive) wrap.setAttribute('data-exe-media-interactive', 'true');
        wrap.setAttribute(
            'style',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;' +
                'min-height:180px;padding:24px;text-align:center;border:1px solid #ccc;border-radius:8px;' +
                'background:#f5f5f5;',
        );

        var caption = doc.createElement('span');
        caption.className = 'exe-external-media__label';
        caption.textContent = label + (title ? ' — ' + title : '');
        wrap.appendChild(caption);

        var openStyle =
            'display:inline-block;padding:10px 24px;border-radius:6px;border:none;cursor:pointer;' +
            'background:#0b5fff;color:#fff;font-size:1rem;text-decoration:none;';

        if (degraded) {
            var a = doc.createElement('a');
            a.className = 'exe-external-media__open';
            a.setAttribute('href', descriptor.originalUrl || descriptor.embedUrl || '#');
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
            a.setAttribute('style', openStyle);
            a.textContent = trc('exeMediaOpenNewTab', 'Open in a new tab');
            a.setAttribute('aria-label', (title ? title + ' — ' : '') + label + ' — ' + trc('exeMediaOpenNewTab', 'Open in a new tab'));
            wrap.appendChild(a);
        } else {
            var btn = doc.createElement('button');
            btn.className = 'exe-external-media__open';
            btn.setAttribute('type', 'button');
            btn.setAttribute('style', openStyle);
            btn.textContent = trc('exeMediaPlay', 'Play video');
            btn.setAttribute('aria-label', (title ? title + ' — ' : '') + label + ' — ' + trc('exeMediaPlay', 'Play video'));
            wrap.appendChild(btn);
        }
        return wrap;
    }

    /**
     * Replace nested external embeds in `rootEl` with placeholders.
     *
     * - Opaque/sandboxed mode: every recognized embed (unless the author opted out with
     *   `data-exe-media-floating="false"`) becomes a placeholder that asks the trusted
     *   parent to open the player (or degrades to open-in-new-tab when no parent answers).
     * - Normal (non-sandboxed) mode: only embeds the author marked
     *   `data-exe-media-floating="true"` become placeholders, and they open in a
     *   self-contained floating lightbox within the export document.
     *
     * Returns a promise resolving to the created placeholders (for tests).
     */
    function scanAndReplace(rootEl, opts) {
        opts = opts || {};
        var doc = (rootEl && rootEl.ownerDocument) || root.document;
        var win = opts.win || root;
        var bridgeMode = shouldUseBridge(win);
        var nodes = rootEl && rootEl.querySelectorAll ? rootEl.querySelectorAll('iframe[src]') : [];
        var found = [];
        for (var i = 0; i < nodes.length; i++) {
            var floating = nodes[i].getAttribute && nodes[i].getAttribute('data-exe-media-floating');
            // Normal rendering only swaps embeds the author opted into floating; everything
            // else plays inline (referrerpolicy makes that work). Opaque mode protects EVERY
            // recognized embed — inline can't run there, so the checkbox does not apply.
            if (!bridgeMode && floating !== 'true') continue;
            var d = policy.parseExternalMedia(nodes[i]);
            if (d) found.push({ node: nodes[i], descriptor: d });
        }
        if (!found.length) return Promise.resolve([]);

        if (!bridgeMode) {
            // Self-contained floating playback (lightbox) in the export document.
            var lightboxPlaceholders = [];
            for (var k = 0; k < found.length; k++) {
                var fit = found[k];
                var lph = buildPlaceholder(fit.descriptor, {
                    document: doc,
                    degraded: !fit.descriptor.requiresBridge,
                });
                if (fit.descriptor.requiresBridge) wireLightbox(lph, fit.descriptor, opts);
                if (fit.node.parentNode) fit.node.parentNode.replaceChild(lph, fit.node);
                lightboxPlaceholders.push(lph);
            }
            return Promise.resolve(lightboxPlaceholders);
        }

        return ensureSession(opts).then(function (session) {
            var degraded = !session;
            var placeholders = [];
            for (var j = 0; j < found.length; j++) {
                var item = found[j];
                var ph = buildPlaceholder(item.descriptor, { document: doc, degraded: degraded });
                if (!degraded && item.descriptor.requiresBridge) {
                    wireOpen(ph, item.descriptor, opts);
                }
                if (item.node.parentNode) item.node.parentNode.replaceChild(ph, item.node);
                placeholders.push(ph);
            }
            return placeholders;
        });
    }

    /**
     * Open a provider video in a self-contained, accessible floating lightbox within the
     * current document. Used in normal (non-sandboxed) rendering where the document has a
     * real origin and the provider iframe works directly. Returns { overlay, close }.
     */
    function openLightbox(descriptor, opts) {
        opts = opts || {};
        var doc = opts.document || root.document;
        var labelText = descriptor.title || providerName(descriptor.provider);

        var overlay = doc.createElement('div');
        overlay.className = 'exe-media-lightbox';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', labelText);
        overlay.setAttribute(
            'style',
            'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
                'background:rgba(0,0,0,0.85);',
        );

        var frame = doc.createElement('div');
        frame.setAttribute(
            'style',
            'position:relative;width:min(90vw,960px);max-height:90vh;aspect-ratio:16/9;background:#000;',
        );

        var sep = descriptor.embedUrl && descriptor.embedUrl.indexOf('?') >= 0 ? '&' : '?';
        var iframe = doc.createElement('iframe');
        iframe.setAttribute('src', (descriptor.embedUrl || '') + sep + 'autoplay=1');
        iframe.setAttribute('title', labelText);
        iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
        iframe.setAttribute('allowfullscreen', 'allowfullscreen');
        // Needed so YouTube/Vimeo identify the page (avoids "Error 153").
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0;');

        var close = doc.createElement('button');
        close.type = 'button';
        close.className = 'exe-media-lightbox__close';
        close.setAttribute('aria-label', trc('exeMediaClose', 'Close'));
        close.textContent = '×';
        close.setAttribute(
            'style',
            'position:absolute;top:-40px;right:0;width:36px;height:36px;background:transparent;border:none;' +
                'color:#fff;font-size:30px;line-height:1;cursor:pointer;',
        );

        function destroy() {
            if (doc.removeEventListener) doc.removeEventListener('keydown', onKey, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (opts.returnFocus && typeof opts.returnFocus.focus === 'function') {
                try {
                    opts.returnFocus.focus();
                } catch (e) {
                    /* ignore */
                }
            }
        }
        function onKey(e) {
            if (e.key === 'Escape' || e.keyCode === 27) destroy();
        }

        close.addEventListener('click', destroy);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) destroy();
        });
        if (doc.addEventListener) doc.addEventListener('keydown', onKey, true);

        frame.appendChild(iframe);
        frame.appendChild(close);
        overlay.appendChild(frame);
        (doc.body || doc.documentElement).appendChild(overlay);
        if (typeof close.focus === 'function') {
            try {
                close.focus();
            } catch (e) {
                /* ignore */
            }
        }
        return { overlay: overlay, close: destroy };
    }

    function wireLightbox(placeholder, descriptor, opts) {
        var btn = placeholder.querySelector('.exe-external-media__open');
        if (!btn) return;
        btn.addEventListener('click', function () {
            openLightbox(descriptor, {
                document: placeholder.ownerDocument || (opts && opts.document) || root.document,
                returnFocus: btn,
            });
        });
    }

    function wireOpen(placeholder, descriptor, opts) {
        var btn = placeholder.querySelector('.exe-external-media__open');
        if (!btn) return;
        btn.addEventListener('click', function () {
            openMedia({
                provider: descriptor.provider,
                videoId: descriptor.providerVideoId,
                win: opts && opts.win,
                timeoutMs: opts && opts.timeoutMs,
                readyTimeoutMs: opts && opts.readyTimeoutMs,
                genId: opts && opts.genId,
            }).catch(function () {
                // Lost the bridge after handshake → swap to the degraded fallback.
                var doc = placeholder.ownerDocument || root.document;
                var fallback = buildPlaceholder(descriptor, { document: doc, degraded: true });
                if (placeholder.parentNode) placeholder.parentNode.replaceChild(fallback, placeholder);
            });
        });
    }

    function resetForTests() {
        sessionPromise = null;
    }

    /**
     * Auto-activate on every exported page. In opaque/sandboxed mode it protects every
     * recognized embed; in normal rendering it only swaps embeds the author marked
     * `data-exe-media-floating="true"` for a click-to-open lightbox, so existing content
     * (and local/file:// / Electron use) is unaffected.
     */
    function autoInit(win, doc) {
        win = win || root;
        if (!doc) return false;
        var run = function () {
            scanAndReplace(doc.body || doc.documentElement, { win: win });
        };
        if (doc.readyState === 'loading' && doc.addEventListener) {
            doc.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
        return true;
    }

    var api = {
        isSandboxedOpaque: isSandboxedOpaque,
        inIframe: inIframe,
        shouldUseBridge: shouldUseBridge,
        createBridgeController: createBridgeController,
        ensureSession: ensureSession,
        openMedia: openMedia,
        openLightbox: openLightbox,
        buildPlaceholder: buildPlaceholder,
        scanAndReplace: scanAndReplace,
        autoInit: autoInit,
        _resetForTests: resetForTests,
    };

    root.exeMediaBridge = api;

    autoInit(root, typeof document !== 'undefined' ? document : null);
})(typeof window !== 'undefined' ? window : globalThis);
