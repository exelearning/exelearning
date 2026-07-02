/**
 * exe_media_policy — pure, framework-free policy for the external-media bridge.
 *
 * Single source of truth shared by:
 *   - the child runtime (exe_media_bridge.js) that runs inside exported content, and
 *   - the reference parent relay (exe-media-host.js) that runs in the trusted host page.
 *
 * Responsibilities (all pure — no DOM mutation, no postMessage):
 *   - Detect and normalize supported external media (YouTube, Vimeo) into a neutral
 *     descriptor; recognize PDFs for a deferred open-in-new-tab fallback.
 *   - Rebuild canonical, privacy-friendly embed URLs from a bare provider id, so the
 *     bridge never has to trust an attacker-supplied URL (kills redirect-laundering).
 *   - Validate the versioned postMessage/MessageChannel contract (handshake, commands,
 *     events) with a strict schema, a closed action enum and a provider allowlist.
 *
 * This file is a CLASSIC browser script (no ES module syntax) so it can be shipped
 * verbatim inside exported packages and loaded over file:// — while still being
 * importable (for its side effect) by the Vitest suite, which reads the global it sets.
 *
 * @license AGPL-3.0
 */
(function (root) {
    'use strict';

    var TYPE = 'exe-media';
    var VERSION = 1;

    // Bare-id shapes. YouTube ids are exactly 11 url-safe chars; Vimeo ids are numeric.
    var ID_RE = {
        youtube: /^[A-Za-z0-9_-]{11}$/,
        vimeo: /^[0-9]{6,12}$/,
    };

    // Host allow-lists per provider. Anything else never matches a provider, so IPs,
    // loopback, *.local and look-alike domains (evil.com/watch?v=...) cannot slip in.
    var YOUTUBE_HOSTS = {
        'youtube.com': 1,
        'www.youtube.com': 1,
        'm.youtube.com': 1,
        'music.youtube.com': 1,
        'youtube-nocookie.com': 1,
        'www.youtube-nocookie.com': 1,
    };
    var YOUTU_BE_HOSTS = { 'youtu.be': 1, 'www.youtu.be': 1 };
    var VIMEO_HOSTS = { 'vimeo.com': 1, 'www.vimeo.com': 1 };
    var VIMEO_PLAYER_HOSTS = { 'player.vimeo.com': 1 };

    // Closed action enums. Anything outside these is dropped before any work happens.
    var COMMANDS = { open: 1, play: 1, pause: 1, seek: 1, getCurrentTime: 1, getDuration: 1, hide: 1, show: 1, close: 1 };
    var EVENTS = { ready: 1, play: 1, pause: 1, ended: 1, timeupdate: 1, seeked: 1, state: 1, error: 1, closed: 1 };

    function isObject(v) {
        return v !== null && typeof v === 'object';
    }

    function finiteNonNeg(n) {
        return typeof n === 'number' && isFinite(n) && n >= 0;
    }

    function isAllowedProvider(provider) {
        return provider === 'youtube' || provider === 'vimeo';
    }

    function isValidVideoId(provider, id) {
        var re = ID_RE[provider];
        return !!re && typeof id === 'string' && re.test(id);
    }

    /**
     * Build the canonical, privacy-friendly embed URL for a provider id. Returns null
     * for unknown providers or ids that fail the provider's shape — so a malicious id
     * can never be templated into a live URL.
     */
    function canonicalEmbedUrl(provider, id) {
        if (provider === 'youtube' && isValidVideoId('youtube', id)) {
            return 'https://www.youtube-nocookie.com/embed/' + id;
        }
        if (provider === 'vimeo' && isValidVideoId('vimeo', id)) {
            return 'https://player.vimeo.com/video/' + id;
        }
        return null;
    }

    function firstPathSegment(pathname) {
        var parts = pathname.split('/');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i]) return parts[i];
        }
        return '';
    }

    function youtubeIdFromUrl(u) {
        var host = u.hostname.toLowerCase();
        if (YOUTU_BE_HOSTS[host]) {
            return firstPathSegment(u.pathname);
        }
        if (YOUTUBE_HOSTS[host]) {
            var v = u.searchParams.get('v');
            if (v) return v;
            var m = u.pathname.match(/^\/(?:embed|v|shorts)\/([^/?#]+)/);
            if (m) return m[1];
        }
        return '';
    }

    function vimeoIdFromUrl(u) {
        var host = u.hostname.toLowerCase();
        if (VIMEO_PLAYER_HOSTS[host]) {
            var m = u.pathname.match(/^\/video\/([0-9]+)/);
            if (m) return m[1];
        }
        if (VIMEO_HOSTS[host]) {
            return firstPathSegment(u.pathname);
        }
        return '';
    }

    function descriptor(provider, id, originalUrl, embedUrl, extra) {
        var d = {
            provider: provider,
            providerVideoId: id,
            originalUrl: originalUrl,
            embedUrl: embedUrl,
            aspectRatio: provider === 'pdf' ? undefined : '16:9',
            interactive: false,
            requiresBridge: provider !== 'pdf',
        };
        if (extra && extra.title) d.title = extra.title;
        return d;
    }

    /**
     * Normalize a URL string or an element (iframe/anchor) into a neutral media
     * descriptor, or null when it is not a supported external embed.
     */
    function parseExternalMedia(input) {
        var url = input;
        var title;
        if (input && typeof input.getAttribute === 'function') {
            url = input.getAttribute('src') || input.getAttribute('href') || '';
            title = input.getAttribute('title') || undefined;
        }
        if (typeof url !== 'string' || !url) return null;

        var u;
        try {
            u = new URL(url);
        } catch (e) {
            return null;
        }
        // Reject userinfo (https://user@host/...) and non-web schemes outright.
        if (u.username || u.password) return null;
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

        var ytId = youtubeIdFromUrl(u);
        if (ytId) {
            if (!isValidVideoId('youtube', ytId)) return null;
            return descriptor('youtube', ytId, url, canonicalEmbedUrl('youtube', ytId), { title: title });
        }

        var vId = vimeoIdFromUrl(u);
        if (vId) {
            if (!isValidVideoId('vimeo', vId)) return null;
            return descriptor('vimeo', vId, url, canonicalEmbedUrl('vimeo', vId), { title: title });
        }

        if (u.pathname.toLowerCase().slice(-4) === '.pdf') {
            return descriptor('pdf', null, url, url, { title: title });
        }

        return null;
    }

    function hasEnvelope(d) {
        return isObject(d) && d.type === TYPE && d.v === VERSION;
    }

    function isHello(d) {
        return hasEnvelope(d) && d.action === 'hello' && typeof d.helloId === 'string' && d.helloId.length > 0;
    }

    function isWelcome(d) {
        return (
            hasEnvelope(d) &&
            d.action === 'welcome' &&
            typeof d.helloId === 'string' &&
            typeof d.exelearningBridge === 'string' &&
            d.exelearningBridge.length > 0
        );
    }

    /**
     * Validate a child→parent command. Defense in depth: envelope + a present, matching
     * nonce (the `!!expectedNonce` guard prevents an absent expected nonce from ever
     * authenticating a forged message) + closed action enum + per-action payload checks.
     */
    function validateCommand(d, expectedNonce) {
        if (!hasEnvelope(d)) return false;
        if (!expectedNonce) return false;
        if (typeof d.exelearningBridge !== 'string' || d.exelearningBridge !== expectedNonce) return false;
        if (!COMMANDS[d.action]) return false;
        switch (d.action) {
            case 'open':
                return (
                    Number.isInteger(d.reqId) &&
                    isAllowedProvider(d.provider) &&
                    isValidVideoId(d.provider, d.videoId) &&
                    (d.start == null || finiteNonNeg(d.start))
                );
            case 'seek':
                return finiteNonNeg(d.t);
            case 'getCurrentTime':
            case 'getDuration':
                return Number.isInteger(d.reqId);
            default:
                return true; // play / pause / hide / show / close — no payload
        }
    }

    /**
     * Validate a parent→child event. Same envelope + closed enum + per-action payload.
     */
    function validateEvent(d) {
        if (!hasEnvelope(d)) return false;
        if (!EVENTS[d.action]) return false;
        switch (d.action) {
            case 'timeupdate':
                return finiteNonNeg(d.currentTime) && finiteNonNeg(d.duration);
            case 'seeked':
                return finiteNonNeg(d.currentTime);
            case 'state':
                return Number.isInteger(d.reqId);
            case 'ready':
                return d.duration == null || finiteNonNeg(d.duration);
            case 'error':
                return typeof d.code === 'string' && typeof d.fatal === 'boolean';
            default:
                return true; // play / pause / ended / closed
        }
    }

    var api = {
        TYPE: TYPE,
        VERSION: VERSION,
        COMMANDS: COMMANDS,
        EVENTS: EVENTS,
        parseExternalMedia: parseExternalMedia,
        canonicalEmbedUrl: canonicalEmbedUrl,
        isAllowedProvider: isAllowedProvider,
        isValidVideoId: isValidVideoId,
        isHello: isHello,
        isWelcome: isWelcome,
        validateCommand: validateCommand,
        validateEvent: validateEvent,
    };

    root.exeMediaPolicy = api;
})(typeof window !== 'undefined' ? window : globalThis);
