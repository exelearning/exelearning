/**
 * Strict per-message validation.
 *
 * Deliberately absent: nonce, replay protection and timestamp validation. Once the
 * private `MessagePort` has been transferred, the only party that can send on it is the
 * child — which is the untrusted party already. Replaying one of its own messages is
 * indistinguishable from it simply sending that message again, so the machinery bought
 * no guarantee while costing six repositories a maintenance burden.
 *
 * What does carry weight, and is enforced here: a namespaced and versioned envelope, a
 * closed action enum, and per-action argument checks with finite numeric bounds.
 * Message ORIGIN is authenticated by window identity at the transport layer
 * (`event.source`), never by `event.origin` — an opaque origin is the string "null".
 */
import { getProvider } from '../providers/registry';
import {
    EMBED_TYPE,
    MEDIA_TYPE,
    PROTOCOL_VERSION,
    isEmbedChildAction,
    isEmbedHostAction,
    isMediaCommand,
    isMediaEvent,
} from './messages';

/** Upper bound on any time value, in seconds: ~277 hours. Rejects Infinity and NaN. */
const MAX_TIME_SECONDS = 1_000_000;

/** Cap on embeds reported in one sync, so a hostile child cannot exhaust the host. */
export const MAX_EMBEDS_PER_SYNC = 64;

/** Cap on a reported geometry edge, in CSS pixels. */
const MAX_GEOMETRY_PX = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isTime(value: unknown): value is number {
    return isFiniteInRange(value, 0, MAX_TIME_SECONDS);
}

/** A geometry edge may be negative (scrolled off-screen) but must be finite and bounded. */
function isCoordinate(value: unknown): value is number {
    return isFiniteInRange(value, -MAX_GEOMETRY_PX, MAX_GEOMETRY_PX);
}

function isExtent(value: unknown): value is number {
    return isFiniteInRange(value, 0, MAX_GEOMETRY_PX);
}

function hasEnvelope(data: unknown, type: string): data is Record<string, unknown> {
    return isRecord(data) && data.type === type;
}

/** One promoted embed as reported by the child. */
export function isEmbedRecord(value: unknown): boolean {
    if (!isRecord(value)) return false;
    if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 128) return false;
    if (!isCoordinate(value.x) || !isCoordinate(value.y)) return false;
    if (!isExtent(value.w) || !isExtent(value.h)) return false;
    // Either the id-only channel (provider + resource id) or a URL, never both required.
    if (value.provider !== undefined && typeof value.provider !== 'string') return false;
    if (value.objectId !== undefined && typeof value.objectId !== 'string') return false;
    if (value.url !== undefined && typeof value.url !== 'string') return false;
    return true;
}

/** Validate a content → host embed message. */
export function validateEmbedChildMessage(data: unknown): boolean {
    if (!hasEnvelope(data, EMBED_TYPE)) return false;
    if (!isEmbedChildAction(data.action)) return false;
    if (data.action === 'sync') {
        if (!Array.isArray(data.embeds)) return false;
        if (data.embeds.length > MAX_EMBEDS_PER_SYNC) return false;
        return data.embeds.every(isEmbedRecord);
    }
    return true; // hello carries no payload
}

/** Validate a host → content embed message. */
export function validateEmbedHostMessage(data: unknown): boolean {
    return hasEnvelope(data, EMBED_TYPE) && isEmbedHostAction(data.action);
}

/** Validate a content → host media command. */
export function validateMediaCommand(data: unknown): boolean {
    if (!hasEnvelope(data, MEDIA_TYPE)) return false;
    if (data.v !== PROTOCOL_VERSION) return false;
    if (!isMediaCommand(data.action)) return false;
    switch (data.action) {
        case 'open': {
            if (!Number.isInteger(data.reqId)) return false;
            if (!(data.start === undefined || data.start === null || isTime(data.start))) return false;
            // The provider and its id are checked against the registry, not merely typed
            // as strings. The id check is the load-bearing half: this value is pasted into
            // a provider URL template, so an id that escapes its shape is the whole attack.
            // The registry is also the single place that knows which providers exist, so
            // this does not restate a second allowlist that could drift from it.
            if (typeof data.provider !== 'string' || typeof data.videoId !== 'string') return false;
            const provider = getProvider(data.provider);
            return !!provider && provider.resourceIdPattern.test(data.videoId);
        }
        case 'seek':
            return isTime(data.t);
        case 'getCurrentTime':
        case 'getDuration':
            return Number.isInteger(data.reqId);
        default:
            return true; // play / pause / hide / show / close carry no payload
    }
}

/** Validate a host → content media event. */
export function validateMediaEvent(data: unknown): boolean {
    if (!hasEnvelope(data, MEDIA_TYPE)) return false;
    if (data.v !== PROTOCOL_VERSION) return false;
    if (!isMediaEvent(data.action)) return false;
    switch (data.action) {
        case 'timeupdate':
            return isTime(data.currentTime) && isTime(data.duration);
        case 'seeked':
            return isTime(data.currentTime);
        case 'state':
            return Number.isInteger(data.reqId);
        case 'ready':
            return data.duration === undefined || data.duration === null || isTime(data.duration);
        case 'error':
            return typeof data.code === 'string' && typeof data.fatal === 'boolean';
        default:
            return true;
    }
}
