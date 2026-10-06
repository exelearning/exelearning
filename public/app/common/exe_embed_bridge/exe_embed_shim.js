/**
 * In-iframe external-embed shim for the opaque-origin preview / secure package mode.
 *
 * Loaded from the <head> of every rendered page. In opaque-origin mode the document
 * runs in a sandbox without allow-same-origin, so the sandbox flag propagates to nested
 * iframes and cross-origin players (YouTube, Vimeo) plus PDFs render blank. This shim
 * replaces each cross-origin (https) or .pdf iframe with a same-size placeholder and
 * reports its geometry to the parent, which validates it and overlays the real player
 * inline (see exe_embed_relay.js). It self-activates ONLY in the opaque origin, so the
 * same file stays dormant in same-origin rendering (where external players already
 * render inline and the relay is not loaded).
 *
 * There is no host list here: the shim promotes any cross-origin https (or .pdf) iframe
 * as a candidate and the parent relay is the authoritative gate (open vs strict mode).
 * postMessage targetOrigin is '*' because the opaque origin has no stable value; the
 * parent authenticates messages by event.source instead.
 *
 * Exposed two ways from a single body: window.exeEmbedShim (browser bootstrap) and
 * module.exports (tests).
 *
 * NO LONGER THE CANONICAL SOURCE, and no longer shipped. The canonical implementation
 * is the TypeScript under src/shared/external-media/, which is what the distributed
 * artifacts are built from. This file stays as the EQUIVALENCE REFERENCE: the parity
 * specs execute it and compare both implementations vector by vector, which is what
 * keeps "the rewrite behaves the same" a measured claim. Editing it changes nothing
 * that ships -- change the TypeScript. Removed at Phase 8 (ADR-2199-11).
 *
 * Canonicity lives in eXeLearning core and flows outward to the host plugins
 * (mod_exelearning, wp-exelearning, omeka-s-exelearning, procomun, nextcloud); they
 * mirror core, never the other way round.
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
(function () {
    'use strict';

    /**
     * Whether this document runs in an opaque origin (secure sandbox). In an opaque
     * origin document.cookie throws and window.origin is "null".
     *
     * @param {Window} [win] Defaults to the global window (injectable for tests).
     * @returns {boolean}
     */
    function isOpaqueOrigin(win) {
        win = win || (typeof window !== 'undefined' ? window : undefined);
        try {
            void (win && win.document ? win.document : document).cookie;
            return win.origin === 'null';
        } catch (e) {
            return true;
        }
    }

    /**
     * Whether this window is nested in another browsing context.
     *
     * @param {Window} [win]
     * @returns {boolean}
     */
    function isFramed(win) {
        win = win || (typeof window !== 'undefined' ? window : undefined);
        try {
            return !!win && win.parent !== win;
        } catch (e) {
            return true; // Cross-origin parent access throws -> we are framed.
        }
    }

    /**
     * The content document's own location, used to resolve relative srcs and to
     * decide what counts as same-host. Defaults to the global window's.
     *
     * @param {string} [baseHref]
     * @returns {string|undefined}
     */
    function contentBase(baseHref) {
        if (baseHref) {
            return baseHref;
        }
        return typeof window !== 'undefined' && window.location ? window.location.href : undefined;
    }

    /**
     * Whether a URL path ends in .pdf (PDFs also fail under the opaque sandbox).
     *
     * @param {string} url
     * @param {string} [baseHref] Content location (defaults to the global window's).
     * @returns {boolean}
     */
    function isPdfUrl(url, baseHref) {
        try {
            return /\.pdf$/i.test(new URL(url, contentBase(baseHref)).pathname);
        } catch (e) {
            return false;
        }
    }

    /**
     * Whether a src resolves to an https URL on a host other than this document's own
     * (served) host -- i.e. a cross-origin external embed. The opaque document is still
     * served from the platform, so the content location's hostname is the platform host
     * and the comparison is reliable. The parent relay re-validates authoritatively
     * (DEC-0061); this is only a candidate filter so same-origin content iframes are
     * left untouched.
     *
     * The own-host side is derived by PARSING the base rather than reading
     * `location.hostname`: a document can expose an href while leaving `hostname`
     * unset, and reading it blind would throw and be swallowed as "not cross-origin",
     * silently disabling promotion.
     *
     * @param {string} src
     * @param {string} [baseHref] Content location (defaults to the global window's).
     * @returns {boolean}
     */
    function isCrossOriginHttps(src, baseHref) {
        try {
            var base = contentBase(baseHref);
            var u = new URL(src, base);
            // Strip a single trailing dot so the LMS host in its FQDN-root form
            // ('host.') counts as same-host and is not reported as a candidate.
            var host = u.hostname.toLowerCase().replace(/\.$/, '');
            var here = new URL(base).hostname.toLowerCase().replace(/\.$/, '');
            return u.protocol === 'https:' && host !== here;
        } catch (e) {
            return false;
        }
    }

    /**
     * Whether an iframe src should be promoted to the parent: any cross-origin https
     * embed or a .pdf (both render blank under the opaque sandbox). No host list -- the
     * parent relay decides what actually renders (open vs strict mode).
     *
     * @param {string} src
     * @param {string} [baseHref] Content location (defaults to the global window's).
     * @returns {boolean}
     */
    function isPromotable(src, baseHref) {
        return isCrossOriginHttps(src, baseHref) || isPdfUrl(src, baseHref);
    }

    /**
     * Recognise a known video provider from an embed src and extract its object id, so the
     * shim can report {provider, objectId} instead of the author URL (DEC-0067 id-only
     * channel). The parent rebuilds the canonical URL from a fixed template; this avoids
     * passing the author's URL across the boundary for recognised providers. Returns null
     * for unknown hosts or unexpected paths (the caller then falls back to URL mode). The
     * id shape is intentionally permissive here; the parent re-checks it against a strict
     * regex before templating it.
     *
     * @param {string} src
     * @returns {?{provider: string, objectId: string}}
     */
    function extractProvider(src) {
        var u;
        try {
            u = new URL(src, window.location.href);
        } catch (e) {
            return null;
        }
        if (u.protocol !== 'https:') {
            return null;
        }
        var host = u.hostname.toLowerCase().replace(/\.$/, '');
        var m;
        if (host === 'youtu.be') {
            m = u.pathname.match(/^\/([A-Za-z0-9_-]{6,})$/);
            return m ? { provider: 'youtube', objectId: m[1] } : null;
        }
        if (host.indexOf('youtube') !== -1) {
            m = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,})$/);
            return m ? { provider: 'youtube', objectId: m[1] } : null;
        }
        if (host.indexOf('vimeo') !== -1) {
            m = u.pathname.match(/^\/video\/([0-9]+)$/);
            return m ? { provider: 'vimeo', objectId: m[1] } : null;
        }
        if (host.indexOf('dailymotion') !== -1) {
            m = u.pathname.match(/^\/embed\/video\/([A-Za-z0-9]{5,})$/);
            return m ? { provider: 'dailymotion', objectId: m[1] } : null;
        }
        if (host === 'mediateca.educa.madrid.org') {
            m = u.pathname.match(/^\/video\/([A-Za-z0-9]{8,})(?:\/fs)?$/);
            return m ? { provider: 'mediateca-madrid', objectId: m[1] } : null;
        }
        return null;
    }

    /**
     * Render a width/height attribute value as a CSS length.
     *
     * @param {?string} value
     * @param {string} fallback
     * @returns {string}
     */
    function cssSize(value, fallback) {
        if (!value) {
            return fallback;
        }
        return /^[0-9]+$/.test(String(value)) ? value + 'px' : String(value);
    }

    /**
     * Replace whitelisted/PDF iframes with placeholders that reserve their box and
     * carry the embed id + url. Returns the created placeholder elements.
     *
     * @param {Document|Element} root A document or a container element to scan.
     * @param {Object} counter {n:int} mutable id counter (kept across calls).
     * @param {string} [baseHref] Content location to resolve relative srcs against.
     * @returns {Element[]}
     */
    function promote(root, counter, baseHref) {
        var base = contentBase(baseHref);
        var created = [];
        var maker = root.ownerDocument || root;
        var frames = root.querySelectorAll('iframe[src]');
        for (var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if (frame.getAttribute('data-exe-embed-id')) {
                continue;
            }
            var src = frame.getAttribute('src');
            if (!isPromotable(src, base)) {
                continue;
            }
            var rect = frame.getBoundingClientRect ? frame.getBoundingClientRect() : { width: 0, height: 0 };
            var placeholder = maker.createElement('div');
            counter.n += 1;
            placeholder.setAttribute('data-exe-embed-id', 'exe-embed-' + counter.n);
            // Report an ABSOLUTE url: the shim runs inside the content, so resolve the
            // (possibly relative) src against the content location. The parent relay
            // cannot — it would resolve a relative url against the host page instead.
            var absoluteUrl = src;
            try {
                absoluteUrl = new URL(src, base).href;
            } catch (e) {
                absoluteUrl = src;
            }
            placeholder.setAttribute('data-exe-embed-url', absoluteUrl);
            // For recognised providers also stamp {provider, objectId} so the parent can
            // rebuild the canonical URL from a fixed template (DEC-0067 id-only channel)
            // instead of trusting the author URL. Unknown hosts keep URL-only mode.
            var provider = extractProvider(absoluteUrl);
            if (provider) {
                placeholder.setAttribute('data-exe-embed-provider', provider.provider);
                placeholder.setAttribute('data-exe-embed-object-id', provider.objectId);
            }
            placeholder.className = frame.className;
            placeholder.style.display = 'block';
            placeholder.style.maxWidth = '100%';
            placeholder.style.width = cssSize(frame.getAttribute('width'), (rect.width || 0) + 'px');
            placeholder.style.height = cssSize(frame.getAttribute('height'), (rect.height || 0) + 'px');
            placeholder.style.background = '#000';
            frame.parentNode.replaceChild(placeholder, frame);
            created.push(placeholder);
        }
        return created;
    }

    /**
     * Collect the geometry of every placeholder in the document.
     *
     * @param {Document} doc
     * @returns {Object[]}
     */
    function collect(doc) {
        var embeds = [];
        var nodes = doc.querySelectorAll('[data-exe-embed-id]');
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var rect = node.getBoundingClientRect();
            var rec = {
                id: node.getAttribute('data-exe-embed-id'),
                url: node.getAttribute('data-exe-embed-url'),
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height
            };
            var provider = node.getAttribute('data-exe-embed-provider');
            var objectId = node.getAttribute('data-exe-embed-object-id');
            if (provider && objectId) {
                rec.provider = provider;
                rec.objectId = objectId;
            }
            embeds.push(rec);
        }
        return embeds;
    }

    // Re-announcement schedule (ms after the previous attempt). The host relay is
    // loaded LAZILY by its page (most previews embed nothing), so it may start
    // listening after this document has already run. Announcing more than once
    // closes that race without ever promoting on our own authority.
    var ANNOUNCE_DELAYS = [250, 750, 1500, 3000];

    /**
     * Build the in-content runtime for one document.
     *
     * The shim NEVER promotes an embed on its own authority. It announces itself to
     * the parent and waits for the host relay to answer; only then does it replace
     * the author's iframes with placeholders. Without that answer the document is
     * left exactly as authored — an unanswered placeholder is a permanent black box,
     * strictly worse than an unprotected embed, and exported content routinely runs
     * where no host exists at all (file://, a third-party LMS, an ePub reader).
     *
     * Note `file://` is itself an opaque origin in every engine, so "opaque" alone
     * can never be the activation signal.
     *
     * @param {Window} win Injectable for tests.
     * @param {Document} doc Injectable for tests.
     * @returns {Object} {start, isActivated, handleHostMessage}
     */
    function createRuntime(win, doc) {
        win = win || (typeof window !== 'undefined' ? window : undefined);
        doc = doc || (typeof document !== 'undefined' ? document : undefined);

        var counter = { n: 0 };
        var scheduled = false;
        var lastReported = '';
        var activated = false;
        var baseHref = win && win.location ? win.location.href : undefined;

        function post(message) {
            try {
                win.parent.postMessage(message, '*');
            } catch (e) {
                // An unreachable parent is the no-host case; the watchdog handles it.
            }
        }

        // force=true always posts (activation, load, and parent 'request' pings —
        // the parent may have just started listening or lost its state); observer
        // -driven reports skip when the geometry did not actually change, so an
        // attribute-noisy page (carousel animations, aria flips) cannot spam the
        // parent with identical syncs.
        function report(force) {
            var embeds = collect(doc);
            var serialized = JSON.stringify(embeds);
            if (!force && serialized === lastReported) {
                return;
            }
            lastReported = serialized;
            post({ type: 'exe-embed', action: 'sync', embeds: embeds });
        }

        function schedule() {
            if (scheduled) {
                return;
            }
            scheduled = true;
            win.requestAnimationFrame(function () {
                scheduled = false;
                report(false);
            });
        }

        function run() {
            promote(doc, counter, baseHref);
            report(true);
        }

        /* v8 ignore start -- browser-only observer glue, covered by the e2e specs */
        function observe() {
            if (win.MutationObserver) {
                // attributes too, not just childList: layout-affecting UI (the exported
                // page's nav toggle, accordions) usually flips a class/style on an
                // existing node, which reflows the placeholders without adding or
                // removing any element. The filter keeps the observer to the
                // reflow-causing attributes.
                new win.MutationObserver(function () {
                    promote(doc, counter, baseHref);
                    schedule();
                }).observe(doc.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style', 'hidden', 'open'],
                });
            }
            win.addEventListener('scroll', schedule, true);
            win.addEventListener('resize', schedule);
            // A class-toggled layout change usually ANIMATES (CSS transition on the nav
            // drawer): the mutation fires at the start, so re-measure again when the
            // transition/animation lands to report the settled geometry.
            win.addEventListener('transitionend', schedule, true);
            win.addEventListener('animationend', schedule, true);
            if (win.ResizeObserver) {
                // Catches content-box changes that fire no window resize (the drawer
                // pushing the content column, images loading late and growing the page).
                var resizeObserver = new win.ResizeObserver(schedule);
                resizeObserver.observe(doc.documentElement);
                if (doc.body) {
                    resizeObserver.observe(doc.body);
                }
            }
            win.addEventListener('load', function () {
                report(true);
            });
        }
        /* v8 ignore stop */

        // Promote for the first time. Only ever reached from a host answer.
        function activate() {
            if (activated) {
                return;
            }
            activated = true;
            observe();
            run();
        }

        function announce(index) {
            if (activated) {
                return;
            }
            post({ type: 'exe-embed', action: 'hello' });
            if (index < ANNOUNCE_DELAYS.length) {
                win.setTimeout(function () {
                    announce(index + 1);
                }, ANNOUNCE_DELAYS[index]);
            }
        }

        // Two inbound actions, deliberately distinct:
        //
        //   'welcome' — the relay's ANSWER to this document's hello. It is addressed:
        //               the relay resolved this exact window before replying. This is
        //               the only thing that may unlock promotion.
        //   'request' — the relay's geometry re-sync ping, BROADCAST to every content
        //               frame without resolving any of them. It must never unlock a
        //               document; while dormant it only prompts another hello, which
        //               recovers a relay that started after we stopped announcing.
        function handleHostMessage(event) {
            if (!event || event.source !== win.parent) {
                return;
            }
            var data = event.data;
            if (!data || data.type !== 'exe-embed') {
                return;
            }
            if (data.action === 'welcome') {
                if (activated) {
                    run();
                    return;
                }
                activate();
                return;
            }
            if (data.action === 'request') {
                if (activated) {
                    run();
                } else {
                    announce(0);
                }
            }
        }

        function start() {
            if (!isFramed(win) || !isOpaqueOrigin(win)) {
                return false;
            }
            win.addEventListener('message', handleHostMessage);
            announce(0);
            return true;
        }

        return {
            start: start,
            isActivated: function () {
                return activated;
            },
            handleHostMessage: handleHostMessage,
        };
    }

    /**
     * Bootstrap inside the package iframe (no-op outside a framed opaque origin, and
     * dormant until a host relay answers the handshake).
     */
    /* v8 ignore next 3 */
    function init() {
        return createRuntime(window, document).start();
    }

    var exp = {
        isOpaqueOrigin: isOpaqueOrigin,
        isFramed: isFramed,
        createRuntime: createRuntime,
        isPdfUrl: isPdfUrl,
        isCrossOriginHttps: isCrossOriginHttps,
        isPromotable: isPromotable,
        extractProvider: extractProvider,
        promote: promote,
        collect: collect,
        init: init
    };
    // Test runner (Vitest/Node) consumes module.exports.
    if (typeof module !== 'undefined' && module.exports) { module.exports = exp; }
    // Browser bootstrap consumes window.exeEmbedShim; auto-run inside the iframe.
    if (typeof window !== 'undefined') {
        window.exeEmbedShim = exp;
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }
        }
    }
})();
