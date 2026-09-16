/**
 * Which content frames the host is willing to talk to, and what it remembers about each.
 *
 * This is the trust anchor. A message from an opaque-origin document carries
 * `event.origin === "null"`, so origin cannot authenticate anything; the only usable
 * signal is **window identity** — does this `event.source` belong to a frame we
 * deliberately registered? Everything else in the host half depends on that answer being
 * right, which is why it lives here, pure, instead of inline in a message handler.
 *
 * Two deliberate differences from the shipped relay, both called for by the design brief
 * and both flagged rather than smuggled in:
 *
 *  1. **Explicit registration, never a document-wide scan.** The incumbent resolves a
 *     sender by walking `document.getElementsByTagName('iframe')` and skipping anything
 *     tagged as a promoted player. That works, but it means any iframe that appears in the
 *     host document is a potential peer, and the exclusion is a negative check that has to
 *     stay correct. Registration inverts it: a frame is a peer because the host said so.
 *
 *  2. **Navigation invalidates the session.** `event.source` survives navigation — the
 *     same `contentWindow` can host a different document — so a session granted to one
 *     document would otherwise remain available to whatever loads next. `invalidate()`
 *     drops the remembered state and forces a fresh handshake. The incumbent has no
 *     equivalent; this closes §7.3 of the brief.
 */
import type { MountedPlayer, Rect } from './overlay-geometry';

/** Opaque handle for a registered frame. */
export type FrameHandle = string;

export interface FrameRecord {
    handle: FrameHandle;
    /** The frame's `contentWindow`. Compared by identity, never by value. */
    source: unknown;
    /** The frame's `src`, used to decide what counts as one of this package's files. */
    contentSrc: string;
    /** True once the frame has been welcomed and may report geometry. */
    welcomed: boolean;
    /** Where the overlay was last placed, for drift detection. */
    lastRect: Rect | null;
    /** Players currently mounted for this frame. */
    players: MountedPlayer[];
}

export interface FrameRegistry {
    register(source: unknown, contentSrc: string): FrameHandle;
    unregister(handle: FrameHandle): void;
    /** Resolve a message sender by window identity. Null means "not a peer". */
    resolve(source: unknown): FrameRecord | null;
    get(handle: FrameHandle): FrameRecord | null;
    /** Mark a frame as welcomed, so its geometry reports are accepted. */
    welcome(handle: FrameHandle): void;
    /** Forget everything about a frame's document, keeping the registration. */
    invalidate(handle: FrameHandle, contentSrc?: string): void;
    setLastRect(handle: FrameHandle, rect: Rect | null): void;
    setPlayers(handle: FrameHandle, players: MountedPlayer[]): void;
    /** Every registered frame, in registration order. */
    all(): FrameRecord[];
}

export function createFrameRegistry(): FrameRegistry {
    const records = new Map<FrameHandle, FrameRecord>();
    let nextId = 0;

    function fresh(handle: FrameHandle, source: unknown, contentSrc: string): FrameRecord {
        return { handle, source, contentSrc, welcomed: false, lastRect: null, players: [] };
    }

    return {
        register(source, contentSrc) {
            // Re-registering the same window replaces its record rather than adding a
            // second one: two records for one window would make `resolve` ambiguous.
            for (const [handle, record] of records) {
                if (record.source === source) {
                    records.set(handle, fresh(handle, source, contentSrc));
                    return handle;
                }
            }
            const handle: FrameHandle = `frame-${++nextId}`;
            records.set(handle, fresh(handle, source, contentSrc));
            return handle;
        },

        unregister(handle) {
            records.delete(handle);
        },

        resolve(source) {
            // A null or undefined sender must never match a record whose source is also
            // absent, or an unaddressed message would authenticate itself.
            if (source === null || source === undefined) return null;
            for (const record of records.values()) {
                if (record.source === source) return record;
            }
            return null;
        },

        get(handle) {
            return records.get(handle) ?? null;
        },

        welcome(handle) {
            const record = records.get(handle);
            if (record) record.welcomed = true;
        },

        invalidate(handle, contentSrc) {
            const record = records.get(handle);
            if (!record) return;
            // Keep the registration and the window identity; drop everything that
            // belonged to the document that has just gone away.
            records.set(handle, fresh(handle, record.source, contentSrc ?? record.contentSrc));
        },

        setLastRect(handle, rect) {
            const record = records.get(handle);
            if (record) record.lastRect = rect;
        },

        setPlayers(handle, players) {
            const record = records.get(handle);
            if (record) record.players = players;
        },

        all() {
            return [...records.values()];
        },
    };
}
