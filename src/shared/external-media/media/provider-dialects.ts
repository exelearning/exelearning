/**
 * Per-provider `postMessage` dialects: how to address a player, encode a command for it,
 * and decode what it says back.
 *
 * These are the pure halves of controlling an external player, kept apart from the iframe
 * wiring because this is where all the edge cases live and the DOM part is assignment.
 *
 * PROVENANCE. Ported from `mod_exelearning/js/exe_media_host.js` — the raw-`postMessage`
 * implementation that has actually been running in a host plugin. Core's own media host
 * used the provider SDKs and constructed `new YT.Player(...)` from globals core never
 * loads, so there was no working implementation here to preserve (ADR-2199-13). The flow is
 * normally core → plugins; in this one case the better implementation was downstream, and
 * bringing it up is what ADR-2199-12 requires rather than pushing core's inferior one out.
 *
 * WHY RAW MESSAGES AT ALL. The player iframe is mounted by the HOST, on a page with a real
 * origin, so it can satisfy YouTube's `enablejsapi=1` + `origin` requirement. That is the
 * fact the whole approach rests on — from the opaque child neither the SDK nor raw
 * messaging would work. In exchange, nothing third-party is fetched on the path that runs
 * while a learner is watching.
 */

/** The neutral commands a dialect can express. Deliberately closed. */
export type PlayerCommand = 'play' | 'pause' | 'seek';

/** A provider event, normalised so the host never branches on provider again. */
export type DialectEvent =
    | { kind: 'ready' }
    | { kind: 'play' }
    | { kind: 'pause' }
    | { kind: 'ended' }
    | { kind: 'error'; code: string }
    | { kind: 'state'; playerState?: number }
    | { kind: 'info'; currentTime?: number; duration?: number; playerState?: number }
    | { kind: 'timeupdate'; currentTime?: number; duration?: number };

export interface PlayerUrlOptions {
    /** The embedding page's origin. Empty when there is none to give. */
    origin: string;
    start?: number;
    autoplay?: boolean;
}

export interface ProviderDialect {
    id: string;
    /** Commands are addressed here, never to a wildcard. */
    targetOrigin: string;
    buildPlayerUrl(videoId: string, options: PlayerUrlOptions): string;
    /** @returns the wire message, or null for an action this provider cannot express. */
    encodeCommand(action: PlayerCommand, value?: number): unknown | null;
    /**
     * Messages to post once the frame has loaded.
     *
     * Not optional and not empty for either provider: YouTube says NOTHING until it is
     * subscribed to, so a missing subscription looks like a player that works and reports
     * no events — a silent failure rather than an error.
     */
    subscribeCommands(): unknown[];
    decodeEvent(raw: unknown): DialectEvent | null;
}

/** A finite number, or undefined. Keeps NaN and Infinity out of reported times. */
function finite(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Seconds for a player command: never NaN, never negative. */
function seconds(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Both providers post JSON strings; an object is accepted just as readily. */
function parseRaw(raw: unknown): Record<string, unknown> | null {
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

const youtube: ProviderDialect = {
    id: 'youtube',
    targetOrigin: YOUTUBE_ORIGIN,

    buildPlayerUrl(videoId, { origin, start, autoplay }) {
        const url = new URL(`${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(videoId)}`);
        // Both are required for the player to accept commands at all.
        url.searchParams.set('enablejsapi', '1');
        url.searchParams.set('rel', '0');
        url.searchParams.set('modestbranding', '1');
        // An opaque document has no origin to give. Emitting `origin=null` would be worse
        // than omitting it, so it is omitted and the symptom is a player that ignores us.
        if (origin) url.searchParams.set('origin', origin);
        if (start) url.searchParams.set('start', String(Math.floor(start)));
        if (autoplay) url.searchParams.set('autoplay', '1');
        return url.href;
    },

    encodeCommand(action, value) {
        switch (action) {
            case 'play':
                return { event: 'command', func: 'playVideo', args: [] };
            case 'pause':
                return { event: 'command', func: 'pauseVideo', args: [] };
            case 'seek':
                return { event: 'command', func: 'seekTo', args: [seconds(value), true] };
            default:
                return null;
        }
    },

    subscribeCommands: () => [{ event: 'listening' }],

    decodeEvent(raw) {
        const data = parseRaw(raw);
        if (!data || typeof data.event !== 'string') return null;

        if (data.event === 'onReady') return { kind: 'ready' };
        if (data.event === 'onError') return { kind: 'error', code: String(data.info ?? '') };

        // Time and duration arrive unasked, which is why nothing here round-trips.
        if (data.event === 'infoDelivery' && typeof data.info === 'object' && data.info !== null) {
            const info = data.info as Record<string, unknown>;
            return {
                kind: 'info',
                currentTime: finite(info.currentTime),
                duration: finite(info.duration),
                playerState: finite(info.playerState),
            };
        }

        if (data.event === 'onStateChange') {
            const nested =
                typeof data.info === 'object' && data.info !== null
                    ? (data.info as Record<string, unknown>).playerState
                    : data.info;
            return { kind: 'state', playerState: finite(nested) };
        }

        return null;
    },
};

const VIMEO_ORIGIN = 'https://player.vimeo.com';
/**
 * `playProgress` is the one that actually fires.
 *
 * With `api=1` the player answers time in `playProgress` ({seconds, percent, duration});
 * `timeupdate` is the name the newer Player SDK uses. Both are subscribed because the
 * subscription is cheap and the failure when the wrong one is picked is invisible: Vimeo
 * accepts the subscription, never sends the event, and every time-driven feature reads
 * zero forever.
 */
const VIMEO_EVENTS = ['playProgress', 'timeupdate', 'play', 'pause', 'ended', 'error'] as const;

const vimeo: ProviderDialect = {
    id: 'vimeo',
    targetOrigin: VIMEO_ORIGIN,

    buildPlayerUrl(videoId, { autoplay }) {
        const url = new URL(`${VIMEO_ORIGIN}/video/${encodeURIComponent(videoId)}`);
        url.searchParams.set('api', '1');
        // Vimeo addresses its replies by player_id, so it has to be set and stable.
        url.searchParams.set('player_id', `exe-vimeo-${videoId}`);
        if (autoplay) url.searchParams.set('autoplay', '1');
        return url.href;
    },

    encodeCommand(action, value) {
        switch (action) {
            case 'play':
                return { method: 'play' };
            case 'pause':
                return { method: 'pause' };
            case 'seek':
                return { method: 'setCurrentTime', value: seconds(value) };
            default:
                return null;
        }
    },

    // Vimeo subscribes per event name, so this is a list rather than one message.
    subscribeCommands: () => VIMEO_EVENTS.map(name => ({ method: 'addEventListener', value: name })),

    decodeEvent(raw) {
        const data = parseRaw(raw);
        if (!data || typeof data.event !== 'string') return null;

        switch (data.event) {
            case 'ready':
                return { kind: 'ready' };
            case 'play':
                return { kind: 'play' };
            case 'pause':
                return { kind: 'pause' };
            // Vimeo has used both names for the same thing.
            case 'ended':
            case 'finish':
                return { kind: 'ended' };
            case 'error':
                return { kind: 'error', code: 'vimeo_error' };
            // Same payload shape under both names; see VIMEO_EVENTS.
            case 'playProgress':
            case 'timeupdate': {
                if (typeof data.data !== 'object' || data.data === null) return null;
                const payload = data.data as Record<string, unknown>;
                return {
                    kind: 'timeupdate',
                    currentTime: finite(payload.seconds),
                    duration: finite(payload.duration),
                };
            }
            default:
                return null;
        }
    },
};

/**
 * The providers whose players can be CONTROLLED, which is a narrower set than the
 * providers that can be embedded. Dailymotion and Mediateca are embeddable and passive;
 * adding control means adding a dialect here, not a flag elsewhere.
 */
export const PROVIDER_DIALECTS: Record<string, ProviderDialect> = { youtube, vimeo };

export function getDialect(providerId: string): ProviderDialect | null {
    return PROVIDER_DIALECTS[providerId] ?? null;
}
