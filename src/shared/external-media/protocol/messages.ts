/**
 * The closed message vocabulary spoken between untrusted content and its trusted host.
 *
 * Two families exist today and are unified here:
 *  - EMBED: geometry promotion (`hello`/`welcome`/`request`/`sync`), ADR-0017.
 *  - MEDIA: player control over a private MessageChannel.
 *
 * Everything is a closed enum. An unknown `action` is dropped before any work happens,
 * so adding a message is a deliberate act rather than an accident of shape.
 */

export const PROTOCOL_VERSION = 1;

/** Namespace on the wire. Kept as-is so the shipped runtimes stay interoperable. */
export const EMBED_TYPE = 'exe-embed';
export const MEDIA_TYPE = 'exe-media';

/** Content → host. */
export const EMBED_CHILD_ACTIONS = ['hello', 'sync'] as const;
/** Host → content. */
export const EMBED_HOST_ACTIONS = ['welcome', 'request'] as const;

export type EmbedChildAction = (typeof EMBED_CHILD_ACTIONS)[number];
export type EmbedHostAction = (typeof EMBED_HOST_ACTIONS)[number];

/** Content → host, over the private port. */
export const MEDIA_COMMANDS = [
    'open',
    'play',
    'pause',
    'seek',
    'getCurrentTime',
    'getDuration',
    'hide',
    'show',
    'close',
] as const;

/** Host → content, over the private port. */
export const MEDIA_EVENTS = [
    'ready',
    'play',
    'pause',
    'ended',
    'timeupdate',
    'seeked',
    'state',
    'error',
    'closed',
] as const;

export type MediaCommand = (typeof MEDIA_COMMANDS)[number];
export type MediaEvent = (typeof MEDIA_EVENTS)[number];

export function isEmbedChildAction(value: unknown): value is EmbedChildAction {
    return typeof value === 'string' && (EMBED_CHILD_ACTIONS as readonly string[]).includes(value);
}

export function isEmbedHostAction(value: unknown): value is EmbedHostAction {
    return typeof value === 'string' && (EMBED_HOST_ACTIONS as readonly string[]).includes(value);
}

export function isMediaCommand(value: unknown): value is MediaCommand {
    return typeof value === 'string' && (MEDIA_COMMANDS as readonly string[]).includes(value);
}

export function isMediaEvent(value: unknown): value is MediaEvent {
    return typeof value === 'string' && (MEDIA_EVENTS as readonly string[]).includes(value);
}
