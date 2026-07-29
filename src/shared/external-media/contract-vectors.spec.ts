import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildCanonicalEmbedUrl, parseExternalMedia } from './providers/registry';
import {
    validateEmbedChildMessage,
    validateEmbedHostMessage,
    validateMediaCommand,
    validateMediaEvent,
} from './protocol/schemas';

/**
 * The shared contract vectors run twice here:
 *
 *  1. against the NEW canonical registry and schemas, and
 *  2. against the CURRENTLY SHIPPED runtimes (`exe_embed_relay.js`,
 *     `exe_media_policy.js`), executed as the classic scripts they are.
 *
 * The second pass is the point. Phase 1 must introduce no behaviour change, so the new
 * single source of truth has to be pinned to what the scattered code already does —
 * otherwise the swap in a later phase would silently alter what users see, and nothing
 * would catch it.
 */

const ROOT = join(import.meta.dir, '../../..');
const VECTORS = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/external-media-contract/v1.json'), 'utf8')) as {
    version: number;
    url: {
        name: string;
        input: string;
        expect: null | { provider: string; resourceId: string; canonicalUrl: string };
    }[];
    messages: { name: string; direction: string; message: unknown; valid: boolean }[];
};

/** Execute a classic script and hand back the globals it publishes. */
function loadClassic(relative: string, extraGlobals: Record<string, unknown> = {}): Record<string, unknown> {
    // A fresh vm context has no `URL`, so without this the incumbent parsers would throw
    // on every input and "parity" would be two implementations agreeing to reject
    // everything. Give the context the globals a browser provides.
    const sandbox: Record<string, unknown> = { URL, ...extraGlobals };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    runInNewContext(readFileSync(join(ROOT, relative), 'utf8'), sandbox);
    return sandbox;
}

const incumbentRelay = loadClassic('public/app/common/exe_embed_bridge/exe_embed_relay.js') as {
    exeEmbedRelay: { reconstructProvider: (provider: string, id: string) => string | null };
};
const shippedPolicy = loadClassic('public/app/common/exe_media_bridge/exe_media_policy.js') as {
    exeMediaPolicy: {
        parseExternalMedia: (input: string) => { provider: string; providerVideoId: string } | null;
        canonicalEmbedUrl: (provider: string, id: string) => string | null;
    };
};

/**
 * Vectors where the canonical registry and the incumbent policy genuinely disagree, each
 * pinned by its own assertion below. Anything not listed here must agree.
 */
const KNOWN_DIVERGENCES = new Set(['plain http']);

/**
 * Media-command vectors where canonical and incumbent legitimately differ, pinned below.
 *
 * Only the provider SET differs: the incumbent policy carries its own `youtube|vimeo`
 * allowlist, while canonical asks the registry, which knows four. That widening is the
 * point of having one source of provider truth. Everything about how a command is
 * *validated* must still agree.
 */
const KNOWN_MEDIA_DIVERGENCES = new Set(['media open with a well-formed mediateca id']);

const VALIDATORS: Record<string, (message: unknown) => boolean> = {
    'embed-child': validateEmbedChildMessage,
    'embed-host': validateEmbedHostMessage,
    'media-command': validateMediaCommand,
    'media-event': validateMediaEvent,
};

describe('contract vectors — canonical registry', () => {
    it('covers the file version this suite was written for', () => {
        expect(VECTORS.version).toBe(1);
        expect(VECTORS.url.length).toBeGreaterThan(15);
    });

    for (const vector of VECTORS.url) {
        it(`url: ${vector.name}`, () => {
            const parsed = parseExternalMedia(vector.input);
            if (vector.expect === null) {
                expect(parsed).toBeNull();
                return;
            }
            expect(parsed).not.toBeNull();
            expect(parsed?.provider).toBe(vector.expect.provider);
            expect(parsed?.resourceId).toBe(vector.expect.resourceId);
            expect(buildCanonicalEmbedUrl(vector.expect.provider, vector.expect.resourceId)).toBe(
                vector.expect.canonicalUrl,
            );
        });
    }

    for (const vector of VECTORS.messages) {
        it(`message: ${vector.name}`, () => {
            const validate = VALIDATORS[vector.direction];
            expect(validate, `unknown direction: ${vector.direction}`).toBeDefined();
            expect(validate(vector.message)).toBe(vector.valid);
        });
    }
});

describe('contract vectors — parity with the incumbent runtimes', () => {
    /**
     * The registry owns canonical-URL reconstruction now, but the incumbent relay stays
     * here as the reference: every vector the registry accepts must rebuild to the
     * identical URL there, or the rewrite changed what gets loaded into the player.
     */
    for (const vector of VECTORS.url.filter(v => v.expect !== null)) {
        it(`relay rebuilds the same URL: ${vector.name}`, () => {
            const expected = vector.expect as { provider: string; resourceId: string; canonicalUrl: string };
            expect(incumbentRelay.exeEmbedRelay.reconstructProvider(expected.provider, expected.resourceId)).toBe(
                expected.canonicalUrl,
            );
        });
    }

    /**
     * The media policy owns URL → {provider, id} parsing today, for the providers it
     * supports (YouTube and Vimeo). Where both implementations claim a vector they must
     * agree; the registry additionally covers Dailymotion and Mediateca, which the
     * policy never handled.
     */
    for (const vector of VECTORS.url.filter(v => !KNOWN_DIVERGENCES.has(v.name))) {
        it(`policy agrees where it has an opinion: ${vector.name}`, () => {
            const mine = parseExternalMedia(vector.input);
            const theirs = shippedPolicy.exeMediaPolicy.parseExternalMedia(vector.input);
            if (!theirs || (theirs.provider !== 'youtube' && theirs.provider !== 'vimeo')) {
                return; // outside the incumbent policy's remit
            }
            expect(mine).not.toBeNull();
            expect(mine?.provider).toBe(theirs.provider);
            expect(mine?.resourceId).toBe(theirs.providerVideoId);
        });
    }

    it('never accepts a URL the incumbent policy rejects for a provider it owns', () => {
        for (const vector of VECTORS.url.filter(v => v.expect === null && !KNOWN_DIVERGENCES.has(v.name))) {
            const theirs = shippedPolicy.exeMediaPolicy.parseExternalMedia(vector.input);
            expect(parseExternalMedia(vector.input), vector.name).toBeNull();
            if (theirs && (theirs.provider === 'youtube' || theirs.provider === 'vimeo')) {
                throw new Error(
                    `shipped policy ACCEPTS a vector the contract rejects: ${vector.name} -> ${theirs.provider}`,
                );
            }
        }
    });

    /**
     * One real divergence, recorded rather than hidden.
     *
     * `exe_media_policy.js` accepts `http:` as well as `https:`, so it will parse a
     * plain-http provider URL. The canonical registry refuses it: promoting an http
     * embed is a downgrade, and the relay's own structural invariant already requires
     * https, so the policy is the lax one of the pair. The registry is deliberately NOT
     * loosened to match.
     *
     * This is asserted in both directions so it cannot drift silently: if the policy is
     * tightened, or the registry is loosened, this fails and someone revisits.
     */
    it('is stricter than the incumbent policy about plain http, deliberately', () => {
        const httpVector = VECTORS.url.find(v => v.name === 'plain http');
        expect(httpVector, 'the http vector must exist').toBeDefined();

        const theirs = shippedPolicy.exeMediaPolicy.parseExternalMedia(httpVector!.input);
        expect(theirs?.provider, 'the incumbent policy still accepts plain http').toBe('youtube');
        expect(parseExternalMedia(httpVector!.input), 'the registry still refuses it').toBeNull();
    });
});

/**
 * The media half had no parity gate at all — every media vector was checked against the
 * canonical validator and nothing else. That is precisely how `open` came to accept any
 * two strings where the incumbent required a known provider and a well-formed id: a
 * loosening with no test to notice it (ADR-0020's named risk, realised).
 *
 * The incumbent additionally demands a nonce. That is its own requirement, not the
 * protocol's — commands travel over a transferred MessagePort that only two endpoints can
 * reach, so the nonce authenticates a channel that is already exclusive (P5). One is
 * supplied here purely so the incumbent will look at the rest of the message.
 */
describe('media commands — parity with the incumbent policy', () => {
    const NONCE = 'nonce-for-the-incumbent';
    const withNonce = (message: unknown) => ({ ...(message as object), exelearningBridge: NONCE });

    const mediaVectors = VECTORS.messages.filter(
        v => v.direction === 'media-command' && !KNOWN_MEDIA_DIVERGENCES.has(v.name),
    );

    it('has vectors to compare', () => {
        expect(mediaVectors.length).toBeGreaterThan(0);
    });

    for (const vector of mediaVectors) {
        it(`agrees on: ${vector.name}`, () => {
            const theirs = shippedPolicy.exeMediaPolicy.validateCommand(withNonce(vector.message), NONCE);
            expect(theirs, `incumbent disagrees with the contract on "${vector.name}"`).toBe(vector.valid);
        });
    }

    /** The pinned divergence, asserted rather than merely excluded. */
    it('is wider than the incumbent only in which providers exist', () => {
        const open = {
            type: 'exe-media',
            v: 1,
            action: 'open',
            reqId: 1,
            provider: 'mediateca-madrid',
            videoId: 'abcd1234efgh',
        };

        expect(validateMediaCommand(open), 'canonical asks the registry').toBe(true);
        expect(
            shippedPolicy.exeMediaPolicy.validateCommand(withNonce(open), NONCE),
            'the incumbent carries its own youtube|vimeo allowlist',
        ).toBe(false);
    });
});
