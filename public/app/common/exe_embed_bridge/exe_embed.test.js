// Unit tests for the secure-mode external-embed shim + relay (DEC-0061). The shim
// (in-iframe) promotes any cross-origin https / .pdf iframe; the relay (parent) is the
// authoritative gate: in 'open' mode the structural invariant (https + cross-origin to
// the LMS), in 'strict' mode the maintained host allowlist. Side-effect imports expose
// the API on window.* (and module.exports); globals come from the Vitest config.
import './exe_embed_shim.js';
import './exe_embed_relay.js';

const shim = window.exeEmbedShim;
const relay = window.exeEmbedRelay;

const HOSTS = [
    'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com',
    'youtube-nocookie.com', 'player.vimeo.com', 'vimeo.com',
    'www.dailymotion.com', 'dailymotion.com', 'geo.dailymotion.com',
    'mediateca.educa.madrid.org',
];
const STRICT = { strict: true, whitelist: relay.buildWhitelist(HOSTS) };
const ORIGIN = window.location.origin;       // happy-dom default (the "host" origin here).
const CONTENT_SRC = ORIGIN + '/preview/9f6b2c1e-0000-4000-8000-000000000000/index.html';

// This happy-dom build populates window.location.href but leaves .hostname undefined,
// which the shim's cross-origin check relies on (real browsers always set it). Define it
// from the href so the cross-origin/same-origin decisions match a real environment.
beforeAll(() => {
    if (!window.location.hostname) {
        try {
            Object.defineProperty(window.location, 'hostname', {
                value: new URL(window.location.href).hostname,
                configurable: true,
            });
        } catch {
            /* location may be read-only in some environments; tests then reflect that */
        }
    }
});

describe('exe_embed_relay validate() — open mode (default): structural invariant', () => {
    it('accepts any cross-origin https video iframe verbatim (no host list, no reconstruction)', () => {
        expect(relay.validate('https://www.youtube.com/embed/aqz-KE-bpKQ', CONTENT_SRC))
            .toEqual({ url: 'https://www.youtube.com/embed/aqz-KE-bpKQ', kind: 'video' });
        expect(relay.validate('https://some-new-provider.example/player/42', CONTENT_SRC))
            .toEqual({ url: 'https://some-new-provider.example/player/42', kind: 'video' });
    });

    it('rejects same-origin (the LMS itself)', () => {
        expect(relay.validate(ORIGIN + '/course/view.php?id=2', CONTENT_SRC)).toBeNull();
    });

    it('rejects non-https', () => {
        expect(relay.validate('http://www.youtube.com/embed/aqz-KE-bpKQ', CONTENT_SRC)).toBeNull();
    });

    it('rejects userinfo (https://evil.com@youtube.com/...)', () => {
        expect(relay.validate('https://evil.com@www.youtube.com/embed/aqz-KE-bpKQ', CONTENT_SRC)).toBeNull();
    });

    it('rejects IP-literal and loopback/local hosts', () => {
        expect(relay.validate('https://1.2.3.4/player', CONTENT_SRC)).toBeNull();
        expect(relay.validate('https://[2001:db8::1]/player', CONTENT_SRC)).toBeNull();
        expect(relay.validate('https://localhost/player', CONTENT_SRC)).toBeNull();
        expect(relay.validate('https://intranet.local/player', CONTENT_SRC)).toBeNull();
    });

    it('rejects non-http(s) schemes (data:/javascript:/blob:)', () => {
        expect(relay.validate('data:text/html,<h1>x</h1>', CONTENT_SRC)).toBeNull();
        expect(relay.validate('javascript:alert(1)', CONTENT_SRC)).toBeNull();
        expect(relay.validate('blob:https://x.test/uuid', CONTENT_SRC)).toBeNull();
    });

    it('rejects a relative URL (the shim must report absolute)', () => {
        expect(relay.validate('files/local.pdf', CONTENT_SRC)).toBeNull();
        expect(relay.validate('/admin/secret', CONTENT_SRC)).toBeNull();
    });
});

describe('exe_embed_relay validate() — PDFs (always allowed by structure)', () => {
    it('accepts any cross-origin https PDF (no sameorigin flag)', () => {
        expect(relay.validate('https://example.com/docs/report.pdf', CONTENT_SRC))
            .toEqual({ url: 'https://example.com/docs/report.pdf', kind: 'pdf' });
    });

    it('accepts a same-origin PDF under the content directory (flagged sameorigin)', () => {
        const pdf = ORIGIN + '/preview/9f6b2c1e-0000-4000-8000-000000000000/files/local.pdf';
        expect(relay.validate(pdf, CONTENT_SRC)).toEqual({ url: pdf, kind: 'pdf', sameorigin: true });
    });

    it('rejects a same-origin PDF outside the package (e.g. an admin route)', () => {
        expect(relay.validate(ORIGIN + '/admin/secret.pdf', CONTENT_SRC)).toBeNull();
    });

    it('rejects an http PDF', () => {
        expect(relay.validate('http://example.com/x.pdf', CONTENT_SRC)).toBeNull();
    });
});

describe('exe_embed_relay validate() — strict mode (opt-in allowlist)', () => {
    it('rebuilds the canonical youtube-nocookie URL from a youtube.com embed', () => {
        expect(relay.validate('https://www.youtube.com/embed/aqz-KE-bpKQ', CONTENT_SRC, STRICT))
            .toEqual({ url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', kind: 'video' });
    });

    it('rebuilds the canonical Vimeo / Dailymotion / EducaMadrid URLs', () => {
        expect(relay.validate('https://player.vimeo.com/video/76979871', CONTENT_SRC, STRICT).url)
            .toBe('https://player.vimeo.com/video/76979871');
        expect(relay.validate('https://www.dailymotion.com/embed/video/x8abc12', CONTENT_SRC, STRICT).url)
            .toBe('https://www.dailymotion.com/embed/video/x8abc12');
        expect(relay.validate('https://mediateca.educa.madrid.org/video/u555bvi3bk5wsabh', CONTENT_SRC, STRICT).url)
            .toBe('https://mediateca.educa.madrid.org/video/u555bvi3bk5wsabh/fs');
    });

    it('rejects a non-whitelisted cross-origin https host (unlike open mode)', () => {
        expect(relay.validate('https://some-new-provider.example/player/42', CONTENT_SRC, STRICT)).toBeNull();
        expect(relay.validate('https://example.com/', CONTENT_SRC, STRICT)).toBeNull();
    });

    it('rejects look-alike hosts and malformed ids', () => {
        expect(relay.validate('https://www.youtube.com.evil.com/embed/aqz-KE-bpKQ', CONTENT_SRC, STRICT)).toBeNull();
        expect(relay.validate('https://www.youtube.com/embed/', CONTENT_SRC, STRICT)).toBeNull();
        expect(relay.validate('https://player.vimeo.com/video/not-a-number', CONTENT_SRC, STRICT)).toBeNull();
    });

    it('still accepts cross-origin PDFs in strict mode', () => {
        expect(relay.validate('https://example.com/x.pdf', CONTENT_SRC, STRICT))
            .toEqual({ url: 'https://example.com/x.pdf', kind: 'pdf' });
    });
});

describe('exe_embed_relay structural helpers', () => {
    it('isIpOrLocalHost flags IP literals and loopback/local names', () => {
        ['1.2.3.4', '255.0.0.1', '[::1]', '[2001:db8::1]', 'localhost', 'x.localhost', 'host.local', ''].forEach(
            (h) => expect(relay.isIpOrLocalHost(h)).toBe(true)
        );
        ['youtube.com', 'player.vimeo.com', 'example.org'].forEach(
            (h) => expect(relay.isIpOrLocalHost(h)).toBe(false)
        );
    });

    it('isRelatedToLms flags the LMS host, its subdomains and superdomains (dotted boundary)', () => {
        expect(relay.isRelatedToLms('lms.example.org', 'lms.example.org')).toBe(true);   // equal
        expect(relay.isRelatedToLms('cdn.lms.example.org', 'lms.example.org')).toBe(true); // subdomain
        expect(relay.isRelatedToLms('example.org', 'lms.example.org')).toBe(true);        // superdomain
        expect(relay.isRelatedToLms('evil-lms.example.org', 'lms.example.org')).toBe(false); // look-alike
        expect(relay.isRelatedToLms('youtube.com', 'lms.example.org')).toBe(false);
    });

    it('isRelatedToLms normalises the trailing-dot FQDN-root form (no host. bypass)', () => {
        // 'lms.example.org.' resolves to the same vhost but compares unequal as a raw
        // string; without normalisation it would slip past the related-to-LMS gate and
        // be promoted as a cross-origin player with allow-same-origin.
        expect(relay.isRelatedToLms('lms.example.org.', 'lms.example.org')).toBe(true);   // dotted host
        expect(relay.isRelatedToLms('lms.example.org', 'lms.example.org.')).toBe(true);   // dotted lmsHost
        expect(relay.isRelatedToLms('cdn.lms.example.org.', 'lms.example.org')).toBe(true); // dotted subdomain
        expect(relay.normalizeHost('LMS.Example.ORG.')).toBe('lms.example.org');
    });
});

describe('exe_embed_shim promotion decisions', () => {
    it('isPdfUrl detects .pdf paths (ignoring the query)', () => {
        expect(shim.isPdfUrl('https://x.test/a/b.pdf')).toBe(true);
        expect(shim.isPdfUrl('https://x.test/a/b.pdf?download=1')).toBe(true);
        expect(shim.isPdfUrl('https://x.test/a/b.html')).toBe(false);
    });

    it('isPromotable: any cross-origin https or .pdf yes; same-origin / http no', () => {
        expect(shim.isPromotable('https://www.youtube.com/embed/x12345')).toBe(true);
        expect(shim.isPromotable('https://anything.example/player')).toBe(true);
        expect(shim.isPromotable('https://files.test/manual.pdf')).toBe(true);
        expect(shim.isPromotable('files/local.pdf')).toBe(true);              // relative .pdf
        expect(shim.isPromotable(ORIGIN + '/course/view.php')).toBe(false);   // same-origin, not pdf
        expect(shim.isPromotable('http://www.youtube.com/embed/x')).toBe(false); // not https
    });

    it('promote() replaces cross-origin/PDF iframes and leaves same-origin ones', () => {
        // Scan a DETACHED container so happy-dom never navigates the iframe srcs.
        const root = document.createElement('div');
        root.innerHTML =
            '<iframe id="yt" src="https://www.youtube.com/embed/aqz-KE-bpKQ" width="560" height="315"></iframe>' +
            '<iframe id="pdf" src="https://example.com/x.pdf" width="600" height="400"></iframe>' +
            '<iframe id="same" src="' + ORIGIN + '/local/page.html" width="320" height="120"></iframe>';

        const created = shim.promote(root, { n: 0 });

        expect(created.length).toBe(2);
        expect(root.querySelector('#same')).not.toBeNull();   // same-origin survives
        expect(root.querySelector('#yt')).toBeNull();
        expect(root.querySelector('#pdf')).toBeNull();

        const ph = created[0];
        expect(ph.getAttribute('data-exe-embed-id')).toBe('exe-embed-1');
        expect(ph.getAttribute('data-exe-embed-url')).toContain('youtube.com');
        expect(ph.style.width).toBe('560px');
        expect(ph.style.height).toBe('315px');
    });

    it('reports a RELATIVE src as an absolute URL (the parent relay cannot resolve relatives)', () => {
        const root = document.createElement('div');
        root.innerHTML = '<iframe id="lpdf" src="files/local-sample.pdf" width="600" height="400"></iframe>';

        const created = shim.promote(root, { n: 0 });

        expect(created.length).toBe(1);
        const reported = created[0].getAttribute('data-exe-embed-url');
        expect(reported).toMatch(/^https?:\/\//);
        expect(reported).toMatch(/files\/local-sample\.pdf$/);
    });
});

describe('exe_embed_relay makePlayer() — sandboxed players', () => {
    it('video player is sandboxed with allow-same-origin but NOT top-navigation/modals', () => {
        const frame = relay.makePlayer({ url: 'https://www.youtube.com/embed/abc123', kind: 'video' });
        const sb = frame.getAttribute('sandbox');
        expect(sb).toContain('allow-scripts');
        expect(sb).toContain('allow-same-origin');   // cross-origin src keeps its own origin; renders.
        expect(sb).not.toContain('allow-top-navigation');
        expect(sb).not.toContain('allow-modals');
        expect(frame.getAttribute('data-exe-embed-player')).toBe('1'); // excluded from message auth
        expect(frame.getAttribute('allow')).toContain('autoplay');
        expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    });

    it('cross-origin PDF player is sandboxed WITHOUT top-navigation/scripts (cannot redirect the tab)', () => {
        // A server can serve scripted HTML at a .pdf path; the sandbox stops it top-navigating
        // the Moodle tab. allow-same-origin keeps the provider origin (SOP-isolated).
        const frame = relay.makePlayer({ url: 'https://files.test/manual.pdf', kind: 'pdf' });
        const sb = frame.getAttribute('sandbox');
        expect(sb).not.toBeNull();
        expect(sb).toContain('allow-same-origin');
        expect(sb).not.toContain('allow-top-navigation');
        expect(sb).not.toContain('allow-scripts');
        expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    });

    it('same-origin package PDF is left unsandboxed (served application/pdf, the viewer needs it)', () => {
        const frame = relay.makePlayer({ url: ORIGIN + '/pluginfile.php/5/mod_exelearning/content/3/files/local.pdf', kind: 'pdf', sameorigin: true });
        expect(frame.hasAttribute('sandbox')).toBe(false);
        expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    });
});

describe('exe_embed_relay createRelay() overlays players from messages', () => {
    let iframe;
    beforeEach(() => {
        document.body.innerHTML = '';
        iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
    });

    it('creates an inline overlay player for a valid embed and removes it when no longer reported', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        const players = document.querySelectorAll('.exe-embed-overlay iframe');
        expect(players.length).toBe(1);
        expect(players[0].src).toMatch(/www\.youtube\.com\/embed\/abc123$/);   // verbatim in open mode

        r.onMessage({ source: iframe.contentWindow, data: { type: 'exe-embed', action: 'sync', embeds: [] } });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);
    });

    it('reflow() repositions overlays to the current iframe box (host animated the iframe)', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        const overlay = document.querySelector('.exe-embed-overlay');
        // The host (editor panel) slides the iframe via transform after the sync; the
        // move fires no scroll/resize, so the overlay must be re-placed explicitly.
        iframe.getBoundingClientRect = () => ({ left: 50, top: 60, width: 400, height: 300, right: 450, bottom: 360 });
        r.reflow();
        expect(overlay.style.left).toBe('50px');
        expect(overlay.style.top).toBe('60px');
        expect(overlay.style.width).toBe('400px');
    });

    it('checkDrift() re-pins an overlay whose content iframe moved without any event', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        const overlay = document.querySelector('.exe-embed-overlay');
        // Nothing moved yet: the drift check must be a no-op.
        expect(r.checkDrift()).toBe(0);
        // The host toggles a sidebar: the iframe box shifts with no scroll/resize.
        iframe.getBoundingClientRect = () => ({ left: 120, top: 30, width: 500, height: 320, right: 620, bottom: 350 });
        expect(r.checkDrift()).toBe(1);
        expect(overlay.style.left).toBe('120px');
        expect(overlay.style.top).toBe('30px');
        expect(overlay.style.width).toBe('500px');
        // Settled: a second pass changes nothing.
        expect(r.checkDrift()).toBe(0);
    });

    it('clear() removes every overlay and player (teardown when the preview closes)', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay').length).toBe(1);
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(1);

        r.clear();
        expect(document.querySelectorAll('.exe-embed-overlay').length).toBe(0);
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);

        // After clear(), a fresh sync rebuilds cleanly (reopen path).
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(1);
    });

    it('dispose() tears down overlays like clear() and can be called before init()', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(1);

        r.dispose();
        expect(document.querySelectorAll('.exe-embed-overlay').length).toBe(0);
        // Idempotent: a second dispose() (or one before init) must not throw.
        expect(() => r.dispose()).not.toThrow();
    });

    it('replaces the player when a reused embed id navigates to a different URL (no lingering video)', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'exe-embed-1', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        expect(document.querySelector('.exe-embed-overlay iframe').src).toMatch(/www\.youtube\.com\/embed\/abc123$/);

        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'exe-embed-1', url: 'https://player.vimeo.com/video/12345', x: 0, y: 0, w: 425, h: 350 }],
            },
        });
        const players = document.querySelectorAll('.exe-embed-overlay iframe');
        expect(players.length).toBe(1);
        expect(players[0].src).toMatch(/player\.vimeo\.com\/video\/12345$/);
        expect(players[0].src).not.toMatch(/youtube/);
    });

    it('never treats a promoted player as a content source (forged-message defence)', () => {
        const r = relay.createRelay({ mode: 'open' });
        // A sandboxed player with allow-same-origin must not be able to impersonate the
        // content iframe and inject embeds: tag an iframe like a player and verify a
        // message from it is ignored.
        const player = document.createElement('iframe');
        player.setAttribute('data-exe-embed-player', '1');
        document.body.appendChild(player);
        r.onMessage({
            source: player.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'x', url: 'https://evil.example/phish', x: 0, y: 0, w: 100, h: 100 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);
    });

    it('ignores a message whose source is not a known content iframe', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: {},
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'x', url: 'https://www.youtube.com/embed/abc123', x: 0, y: 0, w: 1, h: 1 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);
    });

    it('ignores non-embed messages', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({ source: iframe.contentWindow, data: { type: 'scorm', action: 'track', cmi: {} } });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);
    });
});

describe('exe_embed_shim collect() geometry report', () => {
    it('reports id + (absolute) url + numeric geometry for each placeholder', () => {
        const root = document.createElement('div');
        root.innerHTML =
            '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" width="560" height="315"></iframe>';
        shim.promote(root, { n: 0 });

        const embeds = shim.collect(root);
        expect(embeds.length).toBe(1);
        expect(embeds[0].id).toMatch(/^exe-embed-/);
        expect(embeds[0].url).toContain('youtube.com');
        ['x', 'y', 'w', 'h'].forEach((k) => expect(typeof embeds[0][k]).toBe('number'));
    });
});

// DEC-0067 option 1: id-only provider channel. For recognized providers the shim sends
// {provider, objectId} (not the author URL) and the parent reconstructs the canonical URL
// from a fixed template after re-checking the object id against a strict regex, so a
// malicious id cannot inject a path/query and escape the canonical embed path. The
// structural invariant (validate) still runs on the reconstructed URL.
describe('exe_embed_shim extractProvider() — recognized providers only', () => {
    it('extracts {provider, objectId} for youtube/vimeo/dailymotion/educamadrid', () => {
        expect(shim.extractProvider('https://www.youtube.com/embed/aqz-KE-bpKQ'))
            .toEqual({ provider: 'youtube', objectId: 'aqz-KE-bpKQ' });
        expect(shim.extractProvider('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'))
            .toEqual({ provider: 'youtube', objectId: 'aqz-KE-bpKQ' });
        expect(shim.extractProvider('https://youtu.be/aqz-KE-bpKQ'))
            .toEqual({ provider: 'youtube', objectId: 'aqz-KE-bpKQ' });
        expect(shim.extractProvider('https://player.vimeo.com/video/76979871'))
            .toEqual({ provider: 'vimeo', objectId: '76979871' });
        expect(shim.extractProvider('https://www.dailymotion.com/embed/video/x8abc12'))
            .toEqual({ provider: 'dailymotion', objectId: 'x8abc12' });
        expect(shim.extractProvider('https://mediateca.educa.madrid.org/video/u555bvi3bk5wsabh/fs'))
            .toEqual({ provider: 'mediateca-madrid', objectId: 'u555bvi3bk5wsabh' });
    });

    it('returns null for unknown hosts and malformed paths (falls back to URL mode)', () => {
        expect(shim.extractProvider('https://some-new-provider.example/player/42')).toBeNull();
        expect(shim.extractProvider('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBeNull(); // not /embed/
        expect(shim.extractProvider('https://player.vimeo.com/video/not-a-number')).toBeNull();
        expect(shim.extractProvider('files/local.pdf')).toBeNull();
    });

    it('promote() stamps provider + objectId and collect() reports them (no raw author URL needed downstream)', () => {
        const root = document.createElement('div');
        root.innerHTML =
            '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" width="560" height="315"></iframe>';
        shim.promote(root, { n: 0 });
        const e = shim.collect(root)[0];
        expect(e.provider).toBe('youtube');
        expect(e.objectId).toBe('aqz-KE-bpKQ');
    });
});

describe('exe_embed_relay reconstructProvider() — canonical URL from id, strict id regex', () => {
    it('builds the canonical URL for each provider', () => {
        expect(relay.reconstructProvider('youtube', 'aqz-KE-bpKQ'))
            .toBe('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
        expect(relay.reconstructProvider('vimeo', '76979871'))
            .toBe('https://player.vimeo.com/video/76979871');
        expect(relay.reconstructProvider('dailymotion', 'x8abc12'))
            .toBe('https://www.dailymotion.com/embed/video/x8abc12');
        expect(relay.reconstructProvider('mediateca-madrid', 'u555bvi3bk5wsabh'))
            .toBe('https://mediateca.educa.madrid.org/video/u555bvi3bk5wsabh/fs');
    });

    it('rejects an objectId that tries to escape the canonical path (traversal/slash/query/space)', () => {
        ['../../evil', 'abc/def', 'abc?x=1', 'abc#frag', 'abc def', 'a b/c', '..', '', 'a@b'].forEach((bad) => {
            expect(relay.reconstructProvider('youtube', bad)).toBeNull();
        });
        expect(relay.reconstructProvider('vimeo', 'not-a-number')).toBeNull();
        expect(relay.reconstructProvider('unknown-provider', 'abc123')).toBeNull();
        expect(relay.reconstructProvider('youtube', 42)).toBeNull(); // non-string
    });
});

describe('exe_embed_relay createRelay() — id-only embeds', () => {
    let iframe;
    beforeEach(() => {
        document.body.innerHTML = '';
        iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
    });

    it('overlays the reconstructed canonical player from an id-only embed (no url field)', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', provider: 'youtube', objectId: 'aqz-KE-bpKQ', x: 0, y: 0, w: 480, h: 270 }],
            },
        });
        const players = document.querySelectorAll('.exe-embed-overlay iframe');
        expect(players.length).toBe(1);
        expect(players[0].src).toMatch(/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ$/);
    });

    it('drops an id-only embed whose objectId tries to escape the canonical path', () => {
        const r = relay.createRelay({ mode: 'open' });
        r.onMessage({
            source: iframe.contentWindow,
            data: {
                type: 'exe-embed', action: 'sync',
                embeds: [{ id: 'e1', provider: 'youtube', objectId: 'x/../../admin', x: 0, y: 0, w: 1, h: 1 }],
            },
        });
        expect(document.querySelectorAll('.exe-embed-overlay iframe').length).toBe(0);
    });
});
