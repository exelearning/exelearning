import { describe, expect, it } from 'bun:test';
import { getDialect, PROVIDER_DIALECTS } from './provider-dialects';

/**
 * Each provider speaks its own `postMessage` dialect, and these are the pure halves of
 * that: how a neutral command is encoded, and how an inbound message is decoded into
 * something provider-neutral.
 *
 * Ported from `mod_exelearning/js/exe_media_host.js`, which is the implementation that has
 * actually been running — core's own media host used the provider SDKs and depended on
 * globals core never loads (ADR-2199-13). The flow is normally core → plugins; here the
 * better implementation was downstream, so it comes up rather than being reinvented.
 *
 * Keeping these separate from the iframe wiring is what makes them testable at all: the
 * dialects are where the edge cases live, and the DOM part is assignment.
 */
const yt = getDialect('youtube');
const vimeo = getDialect('vimeo');

describe('the dialect registry', () => {
    it('covers exactly the providers that can be controlled', () => {
        expect(Object.keys(PROVIDER_DIALECTS).sort()).toEqual(['vimeo', 'youtube']);
    });

    it('has nothing to say about a provider it does not speak for', () => {
        expect(getDialect('dailymotion')).toBeNull();
        expect(getDialect('evil.example')).toBeNull();
    });
});

describe('youtube', () => {
    it('encodes the closed command set and nothing else', () => {
        expect(yt?.encodeCommand('play')).toEqual({ event: 'command', func: 'playVideo', args: [] });
        expect(yt?.encodeCommand('pause')).toEqual({ event: 'command', func: 'pauseVideo', args: [] });
        expect(yt?.encodeCommand('seek', 12.5)).toEqual({ event: 'command', func: 'seekTo', args: [12.5, true] });
        expect(yt?.encodeCommand('open' as never)).toBeNull();
    });

    /** A non-numeric seek must become a number, not `NaN` in a player command. */
    it('coerces a nonsense seek to zero rather than sending NaN', () => {
        expect(yt?.encodeCommand('seek', Number.NaN)).toEqual({ event: 'command', func: 'seekTo', args: [0, true] });
        expect(yt?.encodeCommand('seek')).toEqual({ event: 'command', func: 'seekTo', args: [0, true] });
    });

    /**
     * YouTube says nothing until it is subscribed to. Without this the player loads,
     * plays, and reports no events at all — the failure is silence, not an error.
     */
    it('subscribes on load', () => {
        expect(yt?.subscribeCommands()).toEqual([{ event: 'listening' }]);
    });

    it('decodes ready, errors and playback state', () => {
        expect(yt?.decodeEvent(JSON.stringify({ event: 'onReady' }))).toEqual({ kind: 'ready' });
        expect(yt?.decodeEvent(JSON.stringify({ event: 'onError', info: 150 }))).toEqual({
            kind: 'error',
            code: '150',
        });
        expect(yt?.decodeEvent(JSON.stringify({ event: 'onStateChange', info: 1 }))).toEqual({
            kind: 'state',
            playerState: 1,
        });
    });

    /** The time and duration arrive here, unasked — which is why no round-trip is needed. */
    it('decodes the unsolicited time updates', () => {
        expect(
            yt?.decodeEvent(
                JSON.stringify({ event: 'infoDelivery', info: { currentTime: 42.5, duration: 300, playerState: 1 } }),
            ),
        ).toEqual({ kind: 'info', currentTime: 42.5, duration: 300, playerState: 1 });
    });

    it('reads playerState whether it arrives nested or bare', () => {
        expect(yt?.decodeEvent(JSON.stringify({ event: 'onStateChange', info: { playerState: 2 } }))).toEqual({
            kind: 'state',
            playerState: 2,
        });
    });

    it('ignores anything it does not recognise', () => {
        expect(yt?.decodeEvent(JSON.stringify({ event: 'somethingElse' }))).toBeNull();
        expect(yt?.decodeEvent('not json at all')).toBeNull();
        expect(yt?.decodeEvent(null)).toBeNull();
        expect(yt?.decodeEvent(JSON.stringify({ noEvent: true }))).toBeNull();
    });

    it('builds a privacy-preserving player URL that can be talked to', () => {
        const url = new URL(yt?.buildPlayerUrl('aqz-KE-bpKQ', { origin: 'https://lms.example' }) ?? '');

        expect(url.origin).toBe('https://www.youtube-nocookie.com');
        expect(url.pathname).toBe('/embed/aqz-KE-bpKQ');
        // Without both of these YouTube ignores every command we send.
        expect(url.searchParams.get('enablejsapi')).toBe('1');
        expect(url.searchParams.get('origin')).toBe('https://lms.example');
    });

    it('carries start and autoplay only when asked', () => {
        const plain = new URL(yt?.buildPlayerUrl('aqz-KE-bpKQ', { origin: 'https://lms.example' }) ?? '');
        expect(plain.searchParams.has('start')).toBe(false);
        expect(plain.searchParams.has('autoplay')).toBe(false);

        const withBoth = new URL(
            yt?.buildPlayerUrl('aqz-KE-bpKQ', { origin: 'https://lms.example', start: 30.7, autoplay: true }) ?? '',
        );
        expect(withBoth.searchParams.get('start')).toBe('30');
        expect(withBoth.searchParams.get('autoplay')).toBe('1');
    });

    /**
     * An opaque document has no origin to supply. Emitting `origin=null` would be worse
     * than omitting it, so the parameter is dropped and the caller finds out by the player
     * ignoring commands rather than by a malformed URL.
     */
    it('omits the origin parameter when there is no origin to give', () => {
        const url = new URL(yt?.buildPlayerUrl('aqz-KE-bpKQ', { origin: '' }) ?? '');
        expect(url.searchParams.has('origin')).toBe(false);
    });

    it('addresses commands to the player origin, never a wildcard', () => {
        expect(yt?.targetOrigin).toBe('https://www.youtube-nocookie.com');
    });
});

describe('vimeo', () => {
    it('encodes the closed command set and nothing else', () => {
        expect(vimeo?.encodeCommand('play')).toEqual({ method: 'play' });
        expect(vimeo?.encodeCommand('pause')).toEqual({ method: 'pause' });
        expect(vimeo?.encodeCommand('seek', 12.5)).toEqual({ method: 'setCurrentTime', value: 12.5 });
        expect(vimeo?.encodeCommand('open' as never)).toBeNull();
    });

    /** Vimeo subscribes per event name, so this is a list rather than one message. */
    it('subscribes to each event it needs, by name', () => {
        const commands = vimeo?.subscribeCommands() ?? [];

        expect(commands).toHaveLength(6);
        expect(commands).toContainEqual({ method: 'addEventListener', value: 'timeupdate' });
        expect(commands).toContainEqual({ method: 'addEventListener', value: 'error' });
    });

    it('decodes playback events', () => {
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'ready' }))).toEqual({ kind: 'ready' });
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'play' }))).toEqual({ kind: 'play' });
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'pause' }))).toEqual({ kind: 'pause' });
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'error' }))).toEqual({ kind: 'error', code: 'vimeo_error' });
    });

    /** Vimeo has used both names for the same thing; both must mean ended. */
    it('treats ended and finish as the same event', () => {
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'ended' }))).toEqual({ kind: 'ended' });
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'finish' }))).toEqual({ kind: 'ended' });
    });

    it('decodes time updates from its nested data object', () => {
        expect(
            vimeo?.decodeEvent(JSON.stringify({ event: 'timeupdate', data: { seconds: 10, duration: 120 } })),
        ).toEqual({ kind: 'timeupdate', currentTime: 10, duration: 120 });
    });

    /**
     * The name Vimeo actually uses on the wire with `api=1`.
     *
     * Measured against the real player, not read from a doc page: subscribing to
     * `timeupdate` gets a subscription Vimeo accepts and then never fires, while the
     * player streams `playProgress` throughout. The failure is silent and total — the
     * time cache stays at zero, `getCurrentTime()` answers 0 forever, and an
     * interactive-video question keyed to a timestamp simply never triggers on Vimeo.
     */
    it('decodes playProgress, which is what the player really emits', () => {
        expect(
            vimeo?.decodeEvent(
                JSON.stringify({ event: 'playProgress', data: { seconds: 2.194, percent: 0.035, duration: 61.867 } }),
            ),
        ).toEqual({ kind: 'timeupdate', currentTime: 2.194, duration: 61.867 });
    });

    it('subscribes to playProgress as well, or nothing ever arrives', () => {
        expect(vimeo?.subscribeCommands()).toContainEqual({ method: 'addEventListener', value: 'playProgress' });
    });

    it('ignores a playProgress with no data rather than reporting zeroes', () => {
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'playProgress' }))).toBeNull();
    });

    it('ignores a timeupdate with no data rather than reporting zeroes', () => {
        expect(vimeo?.decodeEvent(JSON.stringify({ event: 'timeupdate' }))).toBeNull();
    });

    it('builds a player URL the API can be addressed through', () => {
        const url = new URL(vimeo?.buildPlayerUrl('123456789', { origin: 'https://lms.example' }) ?? '');

        expect(url.origin).toBe('https://player.vimeo.com');
        expect(url.pathname).toBe('/video/123456789');
        expect(url.searchParams.get('api')).toBe('1');
        expect(url.searchParams.get('player_id')).toBe('exe-vimeo-123456789');
    });

    it('addresses commands to the player origin, never a wildcard', () => {
        expect(vimeo?.targetOrigin).toBe('https://player.vimeo.com');
    });
});

describe('both dialects', () => {
    /**
     * Accepting an already-parsed object as well as a JSON string: the providers post
     * strings, but a test harness or a future provider may not, and parsing is the only
     * thing that differs.
     */
    it.each([
        ['youtube', 'onReady'],
        ['vimeo', 'ready'],
    ])('%s accepts an object as readily as a JSON string', (id, readyEvent) => {
        const dialect = getDialect(id);
        expect(dialect?.decodeEvent({ event: readyEvent })).toEqual({ kind: 'ready' });
        expect(dialect?.decodeEvent(JSON.stringify({ event: readyEvent }))).toEqual({ kind: 'ready' });
    });

    it.each(['youtube', 'vimeo'])('%s refuses a seek to a negative time', id => {
        const dialect = getDialect(id);
        const encoded = dialect?.encodeCommand('seek', -5) as { args?: number[]; value?: number };
        const seconds = encoded.args ? encoded.args[0] : encoded.value;
        expect(seconds).toBe(0);
    });
});
