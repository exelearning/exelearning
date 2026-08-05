import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { validate, type HostLocation } from './url-policy';
import { describePlayer } from './player-descriptor';
import { clampPlayer, overlayBox, reconcilePlayers } from './overlay-geometry';

/**
 * ADR-2199-11 Step 2: the canonical host policy could only replace the incumbent relay once
 * it decided the same thing for the same input. This executes `exe_embed_relay.js` as the
 * classic script it is and drives both implementations through the same vectors —
 * including the adversarial ones, where agreeing to REFUSE matters as much as agreeing to
 * accept.
 *
 * Equivalence is demonstrated, not asserted. The switch has happened, so this is now what
 * keeps the rewrite honest rather than what unblocks it: the incumbent is no longer built
 * into anything, and it stays in the tree until Phase 8 precisely so this can keep
 * running.
 */

const ROOT = join(import.meta.dir, '../../../..');
const RELAY = join(ROOT, 'public/app/common/exe_embed_bridge/exe_embed_relay.js');

const LMS: HostLocation = { origin: 'https://lms.example', hostname: 'lms.example' };
const CONTENT = 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/index.html';
const ALLOWLIST = ['www.youtube.com', 'player.vimeo.com', 'www.dailymotion.com', 'mediateca.educa.madrid.org'];

interface IncumbentVerdict {
    url: string;
    kind: string;
    sameorigin?: boolean;
}

/** Load the incumbent with the host page location it reads from `window`. */
function loadIncumbentRelay(): {
    validate: (raw: string, contentSrc: string, opts: unknown) => IncumbentVerdict | null;
    makePlayer: (result: IncumbentVerdict) => unknown;
} {
    const sandbox: Record<string, unknown> = {
        // A fresh vm context has no Node/browser globals, so `new URL(...)` would throw
        // and the incumbent would refuse EVERYTHING — an equivalence gate that passes by
        // comparing two rejections is worthless. Provide what a browser would.
        URL,
        location: { origin: LMS.origin, hostname: LMS.hostname, href: `${LMS.origin}/editor` },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    runInNewContext(readFileSync(RELAY, 'utf8'), sandbox);
    return (sandbox as { exeEmbedRelay: ReturnType<typeof loadIncumbentRelay> }).exeEmbedRelay;
}

const incumbent = loadIncumbentRelay();

type Comparable = { url: string; kind: string; sameOrigin: boolean } | null;

/**
 * The two implementations spell the same-origin flag differently — the incumbent uses
 * `sameorigin`, the canonical one `sameOrigin` — so each side is normalised with ITS OWN
 * field name. Reading one shape for both silently flattened the flag to false and made
 * this gate compare the wrong thing.
 */
function normaliseIncumbent(verdict: IncumbentVerdict | null): Comparable {
    return verdict ? { url: verdict.url, kind: verdict.kind, sameOrigin: !!verdict.sameorigin } : null;
}

function normaliseCanonical(verdict: { url: string; kind: string; sameOrigin?: boolean } | null): Comparable {
    return verdict ? { url: verdict.url, kind: verdict.kind, sameOrigin: !!verdict.sameOrigin } : null;
}

const VECTORS: { name: string; raw: string }[] = [
    { name: 'known provider embed', raw: 'https://www.youtube.com/embed/aqz-KE-bpKQ' },
    { name: 'canonical no-cookie embed', raw: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ' },
    { name: 'vimeo player', raw: 'https://player.vimeo.com/video/76979871' },
    { name: 'dailymotion embed', raw: 'https://www.dailymotion.com/embed/video/x8abc12' },
    { name: 'mediateca embed', raw: 'https://mediateca.educa.madrid.org/video/abcd1234/fs' },
    { name: 'arbitrary cross-origin provider', raw: 'https://example.com/player' },
    { name: 'package pdf', raw: 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/handout.pdf' },
    { name: 'package pdf by hash segment', raw: 'https://lms.example/other/a1b2c3d4e5f6a7b8/handout.pdf' },
    { name: 'remote pdf', raw: 'https://files.example.org/handout.pdf' },
    { name: 'same-origin pdf outside the package', raw: 'https://lms.example/elsewhere/secret.pdf' },
    { name: 'same origin', raw: 'https://lms.example/secret' },
    { name: 'subdomain of the host page', raw: 'https://files.lms.example/secret' },
    { name: 'superdomain of the host page', raw: 'https://example/secret' },
    { name: 'look-alike prefix', raw: 'https://evil-lms.example/x' },
    { name: 'FQDN-root form of the host page', raw: 'https://lms.example./secret' },
    { name: 'userinfo smuggling', raw: 'https://evil.example@www.youtube.com/embed/x' },
    { name: 'plain http', raw: 'http://www.youtube.com/embed/x' },
    { name: 'ipv4 literal', raw: 'https://192.168.1.10/x' },
    { name: 'ipv6 literal', raw: 'https://[::1]/x' },
    { name: 'localhost', raw: 'https://localhost/x' },
    { name: 'mdns local name', raw: 'https://box.local/x' },
    { name: 'relative value', raw: '/evil.html' },
    { name: 'scheme-relative value', raw: '//evil.example/x' },
    { name: 'unparseable', raw: 'not a url' },
    { name: 'javascript scheme', raw: 'javascript:alert(1)' },
    { name: 'remote pdf on a local host', raw: 'https://127.0.0.1/handout.pdf' },
];

describe('the canonical host policy matches the incumbent relay — open mode', () => {
    for (const vector of VECTORS) {
        it(vector.name, () => {
            const mine = validate(vector.raw, CONTENT, LMS);
            const theirs = incumbent.validate(vector.raw, CONTENT, { strict: false });
            expect(normaliseCanonical(mine)).toEqual(normaliseIncumbent(theirs));
        });
    }
});

describe('the canonical host policy matches the incumbent relay — strict mode', () => {
    for (const vector of VECTORS) {
        it(vector.name, () => {
            const mine = validate(vector.raw, CONTENT, LMS, { strict: true, allowlist: ALLOWLIST });
            const theirs = incumbent.validate(vector.raw, CONTENT, {
                strict: true,
                whitelist: Object.fromEntries(ALLOWLIST.map(host => [host, true])),
            });
            expect(normaliseCanonical(mine)).toEqual(normaliseIncumbent(theirs));
        });
    }
});

describe('the canonical player attributes match what the incumbent relay builds', () => {
    /** A DOM stub small enough to record exactly what the incumbent sets. */
    function incumbentAttributes(verdict: IncumbentVerdict): Record<string, string> {
        const attrs: Record<string, string> = {};
        const sandbox: Record<string, unknown> = {
            URL,
            location: { origin: LMS.origin, hostname: LMS.hostname, href: `${LMS.origin}/editor` },
            document: {
                createElement: () => ({
                    style: {},
                    setAttribute: (name: string, value: string) => {
                        attrs[name] = value;
                    },
                    set src(value: string) {
                        attrs.src = value;
                    },
                }),
            },
        };
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        runInNewContext(readFileSync(RELAY, 'utf8'), sandbox);
        (sandbox as { exeEmbedRelay: { makePlayer: (r: IncumbentVerdict) => unknown } }).exeEmbedRelay.makePlayer(
            verdict,
        );
        return attrs;
    }

    const cases: { name: string; verdict: IncumbentVerdict }[] = [
        { name: 'video', verdict: { url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', kind: 'video' } },
        { name: 'package pdf', verdict: { url: 'https://lms.example/pkg/h.pdf', kind: 'pdf', sameorigin: true } },
        { name: 'remote pdf', verdict: { url: 'https://files.example.org/h.pdf', kind: 'pdf' } },
    ];

    for (const { name, verdict } of cases) {
        it(name, () => {
            const attrs = incumbentAttributes(verdict);
            const mine = describePlayer({
                url: verdict.url,
                kind: verdict.kind as 'video' | 'pdf',
                sameOrigin: verdict.sameorigin,
            });

            expect(mine.src).toBe(attrs.src);
            expect(mine.sandbox).toBe(attrs.sandbox);
            expect(mine.referrerPolicy).toBe(attrs.referrerpolicy);
            expect(mine.allowFullscreen).toBe('allowfullscreen' in attrs);
        });
    }
});

describe('the canonical overlay rules match the incumbent relay', () => {
    const relaySource = readFileSync(RELAY, 'utf8');

    /**
     * The clickjacking clamp. The incumbent applies it inline inside `sync()`, which
     * needs a live DOM, so equivalence is pinned two ways: the exact expression must
     * still be in the incumbent source, and the canonical function must reproduce what
     * that expression computes.
     */
    it('caps a player to the content box the same way the relay does', () => {
        expect(relaySource).toContain('Math.min(embed.w, rect.width)');
        expect(relaySource).toContain('Math.min(embed.h, rect.height)');

        const container = { left: 0, top: 0, width: 800, height: 600 };
        for (const [w, h] of [
            [480, 270],
            [99999, 99999],
            [800, 600],
            [801, 599],
        ]) {
            const clamped = clampPlayer({ id: 'e1', x: 0, y: 0, w, h }, container);
            // The literal expression the relay evaluates, applied to the same inputs.
            expect(clamped.width).toBe(Math.min(w, container.width));
            expect(clamped.height).toBe(Math.min(h, container.height));
        }
    });

    /** The id-reuse rule: the relay keys a stale player on its rendered URL. */
    it('replaces a reused id the same way the relay does', () => {
        expect(relaySource).toContain('data-exe-embed-src');
        const result = reconcilePlayers(
            [{ id: 'exe-embed-1', src: 'https://p/old' }],
            [{ embed: { id: 'exe-embed-1', x: 0, y: 0, w: 480, h: 270 }, url: 'https://p/new' }],
        );
        expect(result.toRemove).toEqual(['exe-embed-1']);
        expect(result.toCreate).toHaveLength(1);
    });

    /** Overlay placement: document space, so the relay adds the scroll offset. */
    it('shifts the overlay into document space the same way the relay does', () => {
        expect(relaySource).toContain('rect.left + scrollX');
        expect(relaySource).toContain('rect.top + scrollY');
        expect(overlayBox({ left: 100, top: 50, width: 800, height: 600 }, { x: 5, y: 200 })).toMatchObject({
            left: 105,
            top: 250,
        });
    });
});
