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
 * CANONICAL SOURCE for the eXeLearning embedder family lives here in eXeLearning core
 * (public/app/common/exe_embed_bridge/exe_embed_shim.js). The host plugins
 * (mod_exelearning, wp-exelearning, omeka-s-exelearning, procomun) mirror this logic
 * (only the export wrapper differs). Keep them in sync; changes flow from core outward.
 */
(function () {
    'use strict';

    /**
     * Whether this document runs in an opaque origin (secure sandbox). In an opaque
     * origin document.cookie throws and window.origin is "null".
     *
     * @returns {boolean}
     */
    function isOpaqueOrigin() {
        try {
            void document.cookie;
            return window.origin === 'null';
        } catch (e) {
            return true;
        }
    }

    /**
     * Whether a URL path ends in .pdf (PDFs also fail under the opaque sandbox).
     *
     * @param {string} url
     * @returns {boolean}
     */
    function isPdfUrl(url) {
        try {
            return /\.pdf$/i.test(new URL(url, window.location.href).pathname);
        } catch (e) {
            return false;
        }
    }

    /**
     * Whether a src resolves to an https URL on a host other than this document's own
     * (served) host -- i.e. a cross-origin external embed. The opaque document is still
     * served from the platform, so window.location.hostname is the platform host and the
     * comparison is reliable. The parent relay re-validates authoritatively (DEC-0061);
     * this is only a candidate filter so same-origin content iframes are left untouched.
     *
     * @param {string} src
     * @returns {boolean}
     */
    function isCrossOriginHttps(src) {
        try {
            var u = new URL(src, window.location.href);
            // Strip a single trailing dot so the LMS host in its FQDN-root form
            // ('host.') counts as same-host and is not reported as a candidate.
            var host = u.hostname.toLowerCase().replace(/\.$/, '');
            var here = window.location.hostname.toLowerCase().replace(/\.$/, '');
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
     * @returns {boolean}
     */
    function isPromotable(src) {
        return isCrossOriginHttps(src) || isPdfUrl(src);
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
     * @returns {Element[]}
     */
    function promote(root, counter) {
        var created = [];
        var maker = root.ownerDocument || root;
        var frames = root.querySelectorAll('iframe[src]');
        for (var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if (frame.getAttribute('data-exe-embed-id')) {
                continue;
            }
            var src = frame.getAttribute('src');
            if (!isPromotable(src)) {
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
                absoluteUrl = new URL(src, window.location.href).href;
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

    /**
     * Bootstrap inside the package iframe (no-op outside the secure opaque origin).
     * Browser-only glue (requires a framed, opaque-origin window); exercised by the
     * Playwright/Firefox e2e (tests/e2e/embed.spec.cjs), not the happy-dom unit tests.
     */
    /* v8 ignore start */
    function init() {
        if (window.parent === window || !isOpaqueOrigin()) {
            return;
        }
        var counter = { n: 0 };
        var scheduled = false;

        function report() {
            window.parent.postMessage({ type: 'exe-embed', action: 'sync', embeds: collect(document) }, '*');
        }
        function schedule() {
            if (scheduled) {
                return;
            }
            scheduled = true;
            window.requestAnimationFrame(function () {
                scheduled = false;
                report();
            });
        }
        function run() {
            promote(document, counter);
            report();
        }

        run();
        if (window.MutationObserver) {
            new MutationObserver(function () {
                promote(document, counter);
                schedule();
            }).observe(document.documentElement, { childList: true, subtree: true });
        }
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        window.addEventListener('load', report);
        window.addEventListener('message', function (event) {
            if (event.source !== window.parent) {
                return;
            }
            var data = event.data;
            if (data && data.type === 'exe-embed' && data.action === 'request') {
                run();
            }
        });
    }
    /* v8 ignore stop */

    var exp = {
        isOpaqueOrigin: isOpaqueOrigin,
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
