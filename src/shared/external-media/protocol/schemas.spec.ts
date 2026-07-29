import { describe, expect, it } from 'bun:test';
import {
    validateEmbedChildMessage,
    validateEmbedHostMessage,
    validateMediaCommand,
    validateMediaEvent,
    MAX_EMBEDS_PER_SYNC,
} from './schemas';

const embed = (over: Record<string, unknown> = {}) => ({ id: 'exe-embed-1', x: 0, y: 0, w: 480, h: 270, ...over });
const sync = (embeds: unknown[]) => ({ type: 'exe-embed', action: 'sync', embeds });
const media = (over: Record<string, unknown>) => ({ type: 'exe-media', v: 1, ...over });

describe('embed messages', () => {
    it('accepts the handshake in both directions', () => {
        expect(validateEmbedChildMessage({ type: 'exe-embed', action: 'hello' })).toBe(true);
        expect(validateEmbedHostMessage({ type: 'exe-embed', action: 'welcome' })).toBe(true);
        expect(validateEmbedHostMessage({ type: 'exe-embed', action: 'request' })).toBe(true);
    });

    it('never lets a direction accept the other side actions', () => {
        expect(validateEmbedChildMessage({ type: 'exe-embed', action: 'welcome' })).toBe(false);
        expect(validateEmbedHostMessage({ type: 'exe-embed', action: 'hello' })).toBe(false);
    });

    it('drops anything outside the namespace or the closed enum', () => {
        expect(validateEmbedChildMessage({ type: 'other', action: 'hello' })).toBe(false);
        expect(validateEmbedChildMessage({ type: 'exe-embed', action: 'whatever' })).toBe(false);
        expect(validateEmbedChildMessage(null)).toBe(false);
        expect(validateEmbedChildMessage('hello')).toBe(false);
    });

    it('accepts a well-formed geometry report', () => {
        expect(validateEmbedChildMessage(sync([embed(), embed({ id: 'exe-embed-2' })]))).toBe(true);
        expect(validateEmbedChildMessage(sync([embed({ provider: 'youtube', objectId: 'aqz-KE-bpKQ' })]))).toBe(true);
    });

    /** Geometry drives host-side layout, so a non-finite value must never get through. */
    it('rejects non-finite or absurd geometry', () => {
        expect(validateEmbedChildMessage(sync([embed({ x: Number.NaN })]))).toBe(false);
        expect(validateEmbedChildMessage(sync([embed({ y: Number.POSITIVE_INFINITY })]))).toBe(false);
        expect(validateEmbedChildMessage(sync([embed({ w: -1 })]))).toBe(false);
        expect(validateEmbedChildMessage(sync([embed({ h: 1e9 })]))).toBe(false);
        expect(validateEmbedChildMessage(sync([embed({ id: '' })]))).toBe(false);
        expect(validateEmbedChildMessage(sync([embed({ id: 'x'.repeat(200) })]))).toBe(false);
    });

    it('caps how many embeds one sync may report, so the host cannot be exhausted', () => {
        const many = Array.from({ length: MAX_EMBEDS_PER_SYNC + 1 }, (_, i) => embed({ id: `e${i}` }));
        expect(validateEmbedChildMessage(sync(many))).toBe(false);
        expect(validateEmbedChildMessage(sync(many.slice(0, MAX_EMBEDS_PER_SYNC)))).toBe(true);
    });

    it('requires sync to carry an array', () => {
        expect(validateEmbedChildMessage({ type: 'exe-embed', action: 'sync' })).toBe(false);
        expect(validateEmbedChildMessage({ type: 'exe-embed', action: 'sync', embeds: 'nope' })).toBe(false);
    });
});

describe('media commands', () => {
    it('accepts each command with its required payload', () => {
        expect(validateMediaCommand(media({ action: 'play' }))).toBe(true);
        expect(validateMediaCommand(media({ action: 'seek', t: 12.5 }))).toBe(true);
        expect(validateMediaCommand(media({ action: 'getDuration', reqId: 3 }))).toBe(true);
        expect(
            validateMediaCommand(media({ action: 'open', reqId: 1, provider: 'youtube', videoId: 'aqz-KE-bpKQ' })),
        ).toBe(true);
    });

    it('rejects a wrong protocol version', () => {
        expect(validateMediaCommand({ type: 'exe-media', v: 2, action: 'play' })).toBe(false);
    });

    it('rejects out-of-range or missing arguments', () => {
        expect(validateMediaCommand(media({ action: 'seek', t: -1 }))).toBe(false);
        expect(validateMediaCommand(media({ action: 'seek', t: Number.NaN }))).toBe(false);
        expect(validateMediaCommand(media({ action: 'seek' }))).toBe(false);
        expect(validateMediaCommand(media({ action: 'getCurrentTime' }))).toBe(false);
        expect(validateMediaCommand(media({ action: 'open', reqId: 1, provider: 'youtube' }))).toBe(false);
    });

    /**
     * The incumbent policy gated `open` on `isAllowedProvider(provider)` AND
     * `isValidVideoId(provider, videoId)`. The first canonical version accepted any two
     * strings, which is a silent loosening of exactly the kind ADR-0020 warned about: a
     * behaviour with no test, dropped in the rewrite. The id check is the load-bearing
     * half — it is what stops a crafted id from being pasted into a provider URL.
     *
     * The provider set now comes from the registry rather than a second hardcoded list,
     * which does widen it from the incumbent's youtube|vimeo. That widening is deliberate
     * (one source of provider truth) and is recorded, not incidental.
     */
    it('accepts open for each provider the registry knows, with a well-formed id', () => {
        const valid: [string, string][] = [
            ['youtube', 'aqz-KE-bpKQ'],
            ['vimeo', '123456789'],
            ['dailymotion', 'x8abcd1'],
            ['mediateca-madrid', 'abcd1234efgh'],
        ];
        for (const [provider, videoId] of valid) {
            expect(
                validateMediaCommand(media({ action: 'open', reqId: 1, provider, videoId })),
                `${provider} should be accepted`,
            ).toBe(true);
        }
    });

    it('rejects open for a provider the registry does not know', () => {
        expect(
            validateMediaCommand(media({ action: 'open', reqId: 1, provider: 'evil.example', videoId: 'aqz-KE-bpKQ' })),
        ).toBe(false);
    });

    /** The half that matters: an id shaped to escape the URL template. */
    it.each([
        ['../../evil', 'path traversal'],
        ['aqz-KE-bpKQ/../x', 'traversal inside a valid-looking id'],
        ['aqz KE bpKQ', 'whitespace'],
        ['aqz-KE-bpK', 'too short for youtube'],
        ['', 'empty'],
    ])('rejects open with a malformed youtube id: %s', videoId => {
        expect(validateMediaCommand(media({ action: 'open', reqId: 1, provider: 'youtube', videoId }))).toBe(false);
    });

    it('rejects an id that is valid for another provider', () => {
        // A vimeo-shaped numeric id is not a youtube id, and must not be treated as one.
        expect(
            validateMediaCommand(media({ action: 'open', reqId: 1, provider: 'youtube', videoId: '123456789' })),
        ).toBe(false);
    });

    it('rejects an action outside the closed enum', () => {
        expect(validateMediaCommand(media({ action: 'evaluate' }))).toBe(false);
    });
});

describe('media events', () => {
    it('accepts each event with its required payload', () => {
        expect(validateMediaEvent(media({ action: 'ready' }))).toBe(true);
        expect(validateMediaEvent(media({ action: 'ready', duration: 90 }))).toBe(true);
        expect(validateMediaEvent(media({ action: 'timeupdate', currentTime: 1, duration: 90 }))).toBe(true);
        expect(validateMediaEvent(media({ action: 'error', code: 'x', fatal: true }))).toBe(true);
    });

    it('rejects malformed payloads', () => {
        expect(validateMediaEvent(media({ action: 'timeupdate', currentTime: 1 }))).toBe(false);
        expect(validateMediaEvent(media({ action: 'error', code: 'x' }))).toBe(false);
        expect(validateMediaEvent(media({ action: 'state' }))).toBe(false);
        expect(validateMediaEvent(media({ action: 'nope' }))).toBe(false);
    });
});
