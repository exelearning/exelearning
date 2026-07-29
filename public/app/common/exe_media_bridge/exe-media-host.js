/**
 * exe-media-host — reference PARENT-side relay for the eXeLearning external-media bridge.
 *
 * Host plugins (Moodle, WordPress, Procomún, …) include this one file on the trusted page
 * that embeds an eXeLearning package inside an opaque-origin sandboxed iframe. It lets the
 * package's YouTube/Vimeo videos play (which they cannot do inside the opaque frame) by:
 *
 *   - completing the capability handshake announced by the child runtime (window identity
 *     + per-view nonce + a transferred MessageChannel port),
 *   - opening an accessible <dialog> with the real provider player on the trusted side, and
 *   - relaying a tiny, validated set of media commands/events over the private port.
 *
 * Security: the relay NEVER trusts `event.origin` (it is the string "null"). The only
 * window-level message accepted is the child's `welcome`-triggering `hello`, gated by
 * `event.source === iframe.contentWindow`. Steady-state media traffic flows only over the
 * private port. The child sends just `{provider, videoId}`; the relay reconstructs the
 * canonical URL from a fixed per-provider template (never a child-supplied URL).
 *
 * Classic browser script (no ES module syntax); depends on the shared `exeMediaPolicy`.
 *
 * Copyright (C) 2026 eXeLearning Team
 *
 * Dual-licensed so this ONE file can ship inside eXeLearning (AGPL-3.0-or-later)
 * and inside the GPL-3.0-or-later host plugins (mod_exelearning) without either
 * project relicensing it. GPLv3 s13 and AGPLv3 s13 already permit COMBINING the
 * two, but combining never relicenses a file: only the copyright holder can offer
 * it under both, which is what this grant does. Keep this notice in every mirror.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later
 */
(function (root) {
    'use strict';

    var policy = root.exeMediaPolicy;
    var TYPE = policy.TYPE;
    var VERSION = policy.VERSION;

    function tr(key) {
        return typeof root._ === 'function' ? root._(key) : key;
    }

    function isThenable(v) {
        return v && typeof v.then === 'function';
    }

    function genNonce(opts) {
        if (opts && typeof opts.genId === 'function') return opts.genId();
        if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
        return 'n-' + Math.random().toString(36).slice(2);
    }

    function makeChannel(opts) {
        if (opts && typeof opts.channelFactory === 'function') return opts.channelFactory();
        return new MessageChannel();
    }

    function getInterval(opts) {
        return {
            set: (opts && opts.setInterval) || (root.setInterval ? root.setInterval.bind(root) : function () {}),
            clear: (opts && opts.clearInterval) || (root.clearInterval ? root.clearInterval.bind(root) : function () {}),
        };
    }

    // ---- Default provider adapters (real SDKs; injectable for tests) ------------------

    function youtubeAdapter(container, videoId, cb) {
        var player = new root.YT.Player(container, {
            host: 'https://www.youtube-nocookie.com',
            videoId: videoId,
            playerVars: { rel: 0, modestbranding: 1, start: cb.start || 0, autoplay: cb.autoplay ? 1 : 0 },
            events: {
                onReady: function (e) {
                    var p = (e && e.target) || player;
                    // Best-effort: tag the API-created iframe so YouTube identifies the host
                    // page (avoids Error 153 when the host's Referrer-Policy is restrictive).
                    try {
                        var ifr = p && p.getIframe && p.getIframe();
                        if (ifr && ifr.setAttribute) {
                            ifr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                        }
                    } catch (err) {
                        /* ignore */
                    }
                    if (cb.onReady) cb.onReady(p && p.getDuration ? p.getDuration() : undefined);
                },
                onStateChange: function (e) {
                    if (e.data === 1 && cb.onPlay) cb.onPlay();
                    else if (e.data === 2 && cb.onPause) cb.onPause();
                    else if (e.data === 0 && cb.onEnded) cb.onEnded();
                },
                onError: function (e) {
                    if (cb.onError) cb.onError(e.data);
                },
            },
        });
        return {
            play: function () { player.playVideo(); },
            pause: function () { player.pauseVideo(); },
            seek: function (t) { player.seekTo(t, true); },
            getCurrentTime: function () { return player.getCurrentTime(); },
            getDuration: function () { return player.getDuration(); },
            destroy: function () { if (player.destroy) player.destroy(); },
        };
    }

    function vimeoAdapter(container, videoId, cb) {
        var player = new root.Vimeo.Player(container, { id: videoId });
        if (player.on) {
            player.on('loaded', function () {
                if (!cb.onReady) return;
                if (player.getDuration) player.getDuration().then(function (d) { cb.onReady(d); });
                else cb.onReady();
            });
            player.on('play', function () { if (cb.onPlay) cb.onPlay(); });
            player.on('pause', function () { if (cb.onPause) cb.onPause(); });
            player.on('ended', function () { if (cb.onEnded) cb.onEnded(); });
            player.on('timeupdate', function (d) { if (cb.onTimeupdate) cb.onTimeupdate(d.seconds, d.duration); });
            player.on('seeked', function (d) { if (cb.onSeeked) cb.onSeeked(d.seconds); });
            player.on('error', function () { if (cb.onError) cb.onError('vimeo_error'); });
        }
        return {
            play: function () { player.play(); },
            pause: function () { player.pause(); },
            seek: function (t) { player.setCurrentTime(t); },
            getCurrentTime: function () { return player.getCurrentTime(); },
            getDuration: function () { return player.getDuration(); },
            destroy: function () { if (player.destroy) player.destroy(); },
        };
    }

    // ---- Accessible modal -------------------------------------------------------------

    function buildModal(session) {
        var opts = session.opts || {};
        var doc = opts.document || root.document;
        var dialog = doc.createElement('dialog');
        dialog.className = 'exe-media-modal';
        dialog.setAttribute('aria-label', tr('Video player'));
        try {
            dialog.setAttribute('closedby', 'any'); // light-dismiss where supported
        } catch (e) {
            /* older engines */
        }

        var closeBtn = doc.createElement('button');
        closeBtn.setAttribute('type', 'button');
        closeBtn.className = 'exe-media-modal__close';
        closeBtn.setAttribute('aria-label', tr('Close video'));
        closeBtn.textContent = tr('Close');
        closeBtn.addEventListener('click', function () {
            requestClose(session);
        });

        var body = doc.createElement('div');
        body.className = 'exe-media-modal__body';

        dialog.appendChild(closeBtn);
        dialog.appendChild(body);

        // Safari light-dismiss fallback: a click whose target is the dialog itself is the backdrop.
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) requestClose(session);
        });
        // Esc / platform close request.
        dialog.addEventListener('close', function () {
            if (session.hiding) {
                session.hiding = false;
                return;
            }
            requestClose(session);
        });

        (doc.body || doc.documentElement).appendChild(dialog);
        if (typeof dialog.showModal === 'function') dialog.showModal();

        session.dialog = dialog;
        return body;
    }

    function showModal(session) {
        if (session.dialog && typeof session.dialog.showModal === 'function') session.dialog.showModal();
    }

    function hideModal(session) {
        if (session.dialog && typeof session.dialog.close === 'function') {
            session.hiding = true;
            session.dialog.close();
        }
    }

    function requestClose(session) {
        if (session.closed) return;
        session.closed = true;
        sendEvent(session, { action: 'closed' });
        destroyAdapter(session);
        if (session.dialog) {
            if (typeof session.dialog.close === 'function') session.dialog.close();
            if (typeof session.dialog.remove === 'function') session.dialog.remove();
        }
    }

    function destroyAdapter(session) {
        if (session.pollTimer != null) {
            session.interval.clear(session.pollTimer);
            session.pollTimer = null;
        }
        if (session.adapter && session.adapter.destroy) session.adapter.destroy();
        session.adapter = null;
    }

    // ---- Media event relay ------------------------------------------------------------

    function sendEvent(session, ev) {
        ev.type = TYPE;
        ev.v = VERSION;
        if (session.port1) session.port1.postMessage(ev);
    }

    function emitTimeupdate(session, ct, dur) {
        if (typeof ct === 'number' && isFinite(ct) && typeof dur === 'number' && isFinite(dur)) {
            sendEvent(session, { action: 'timeupdate', currentTime: ct, duration: dur });
        }
    }

    function startPolling(session) {
        if (session.pollTimer != null) return;
        session.pollTimer = session.interval.set(function () {
            if (!session.adapter) return;
            var ct = session.adapter.getCurrentTime();
            var dur = session.adapter.getDuration();
            if (isThenable(ct) || isThenable(dur)) {
                Promise.all([Promise.resolve(ct), Promise.resolve(dur)]).then(function (r) {
                    emitTimeupdate(session, r[0], r[1]);
                });
            } else {
                emitTimeupdate(session, ct, dur);
            }
        }, 250);
    }

    function openMedia(session, provider, videoId, openOpts) {
        var opts = session.opts || {};
        // Single active media per session: discard any previous player/poll-timer/<dialog>
        // before opening a new one, so repeated 'open' commands cannot stack modals or orphan
        // provider players (host-page resource exhaustion). Remove the old dialog directly
        // (no .close()) so its 'close' listener does not fire a spurious 'closed' to the child.
        destroyAdapter(session);
        if (session.dialog) {
            if (typeof session.dialog.remove === 'function') session.dialog.remove();
            session.dialog = null;
        }
        var container = buildModal(session);
        var callbacks = {
            start: openOpts.start,
            autoplay: openOpts.autoplay,
            onReady: function (duration) {
                sendEvent(session, { action: 'ready', duration: duration });
                startPolling(session);
            },
            onPlay: function () { sendEvent(session, { action: 'play' }); },
            onPause: function () { sendEvent(session, { action: 'pause' }); },
            onEnded: function () { sendEvent(session, { action: 'ended' }); },
            onSeeked: function (t) { sendEvent(session, { action: 'seeked', currentTime: t }); },
            onError: function (code) { sendEvent(session, { action: 'error', code: String(code), fatal: true }); },
        };
        var factory =
            provider === 'vimeo'
                ? opts.vimeoFactory || vimeoAdapter
                : opts.youtubeFactory || youtubeAdapter;
        session.adapter = factory(container, videoId, callbacks);
    }

    function answerState(session, reqId, field) {
        if (!session.adapter) return;
        var value = field === 'duration' ? session.adapter.getDuration() : session.adapter.getCurrentTime();
        Promise.resolve(value).then(function (v) {
            var ev = { action: 'state', reqId: reqId };
            ev[field === 'duration' ? 'duration' : 'currentTime'] = v;
            sendEvent(session, ev);
        });
    }

    function processCommand(session, data) {
        if (!data || data.type !== TYPE || data.v !== VERSION) return;
        if (data.exelearningBridge !== session.nonce) return; // nonce gate
        if (!policy.COMMANDS[data.action]) return;

        if (data.action === 'open') {
            var url = policy.canonicalEmbedUrl(data.provider, data.videoId);
            if (!url) {
                sendEvent(session, { action: 'error', code: 'unsupported_provider', fatal: true });
                return;
            }
            session.closed = false;
            openMedia(session, data.provider, data.videoId, { start: data.start, autoplay: data.autoplay });
            return;
        }
        if (!policy.validateCommand(data, session.nonce)) return;

        var a = session.adapter;
        switch (data.action) {
            case 'play': if (a) a.play(); break;
            case 'pause': if (a) a.pause(); break;
            case 'seek': if (a) a.seek(data.t); break;
            case 'getCurrentTime': answerState(session, data.reqId, 'currentTime'); break;
            case 'getDuration': answerState(session, data.reqId, 'duration'); break;
            case 'hide': hideModal(session); break;
            case 'show': showModal(session); break;
            case 'close': requestClose(session); break;
            default: break;
        }
    }

    // ---- Handshake + attachment -------------------------------------------------------

    var records = [];

    function teardown(session) {
        if (!session) return;
        destroyAdapter(session);
        if (session.port1 && session.port1.close) session.port1.close();
        if (session.dialog && session.dialog.remove) session.dialog.remove();
    }

    function handleHello(rec, data) {
        var existing = rec.session;
        if (existing && existing.helloId === data.helloId) return; // duplicate
        if (existing) teardown(existing); // new helloId → re-pair

        var nonce = genNonce(rec.opts);
        var channel = makeChannel(rec.opts);
        var session = {
            iframe: rec.iframe,
            opts: rec.opts,
            nonce: nonce,
            helloId: data.helloId,
            port1: channel.port1,
            adapter: null,
            dialog: null,
            pollTimer: null,
            hiding: false,
            closed: false,
            interval: getInterval(rec.opts),
        };
        rec.session = session;

        channel.port1.onmessage = function (e) {
            processCommand(session, e.data);
        };
        if (typeof channel.port1.start === 'function') channel.port1.start();

        rec.iframe.contentWindow.postMessage(
            { type: TYPE, v: VERSION, action: 'welcome', helloId: data.helloId, exelearningBridge: nonce },
            '*',
            [channel.port2],
        );
    }

    function onWindowMessage(rec, e) {
        if (!rec.iframe || !rec.iframe.contentWindow || e.source !== rec.iframe.contentWindow) return;
        if (policy.isHello(e.data)) handleHello(rec, e.data);
    }

    /**
     * Register an iframe that renders eXeLearning content and start relaying its media.
     * @returns {{detach: function}} handle
     */
    function attach(iframe, opts) {
        opts = opts || {};
        var win = opts.win || root;
        var rec = { iframe: iframe, opts: opts, session: null, win: win, handler: null };
        rec.handler = function (e) {
            onWindowMessage(rec, e);
        };
        if (win.addEventListener) win.addEventListener('message', rec.handler);
        records.push(rec);
        return {
            detach: function () {
                if (win.removeEventListener) win.removeEventListener('message', rec.handler);
                teardown(rec.session);
                var i = records.indexOf(rec);
                if (i >= 0) records.splice(i, 1);
            },
        };
    }

    function resetForTests() {
        for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            if (rec.win && rec.win.removeEventListener) rec.win.removeEventListener('message', rec.handler);
            teardown(rec.session);
        }
        records = [];
    }

    root.exeMediaHost = {
        attach: attach,
        buildModal: buildModal,
        _youtubeAdapter: youtubeAdapter,
        _vimeoAdapter: vimeoAdapter,
        _processCommand: processCommand,
        _resetForTests: resetForTests,
    };
})(typeof window !== 'undefined' ? window : globalThis);
