/**
 * The trusted-side runtime: welcome content frames, then render what they report.
 *
 * Every decision this makes has already been made in a tested module — which frames are
 * peers (`frame-registry`), what may load (`url-policy`), with what isolation
 * (`player-descriptor`), and where it goes (`overlay-geometry`). What is left here is
 * orchestration, and the DOM is injected so that orchestration is testable without a
 * browser. The adapter is deliberately dumb: it applies, it does not decide.
 */
import { EMBED_TYPE } from '../protocol/messages';
import { validateEmbedChildMessage } from '../protocol/schemas';
import type { FrameHandle, FrameRegistry } from './frame-registry';
import {
    clampPlayer,
    hasDrifted,
    overlayBox,
    reconcilePlayers,
    type Rect,
    type ReportedEmbed,
    type ResolvedEmbed,
    type ScrollOffset,
} from './overlay-geometry';
import { describePlayer, type PlayerDescriptor } from './player-descriptor';
import { validate, type HostLocation, type ValidateOptions } from './url-policy';
import { buildCanonicalEmbedUrl } from '../providers/registry';

/** A geometry report as the child sends it, after schema validation. */
export interface ReportedEmbedRecord extends ReportedEmbed {
    url?: string;
    /** Present for a recognised provider — the id-only channel. */
    provider?: string;
    objectId?: string;
}

/**
 * What URL this report is asking the host to load.
 *
 * For a recognised provider the child sends `{provider, objectId}` and nothing else is
 * trusted: the host rebuilds the canonical URL from its own registry, so an author URL
 * never crosses the boundary. Only unrecognised embeds fall back to the reported URL,
 * and that still has to pass the policy afterwards.
 */
function requestedUrl(embed: ReportedEmbedRecord): string | null {
    if (embed.provider && embed.objectId) {
        return buildCanonicalEmbedUrl(embed.provider, embed.objectId);
    }
    return embed.url ?? null;
}

/** Everything the runtime needs from the document. It applies; it never decides. */
export interface OverlayAdapter {
    /** Current box of the content iframe, or null if it is gone. */
    measureFrame(handle: FrameHandle): Rect | null;
    scrollOffset(): ScrollOffset;
    positionOverlay(handle: FrameHandle, box: Rect): void;
    mountPlayer(handle: FrameHandle, id: string, descriptor: PlayerDescriptor): void;
    positionPlayer(handle: FrameHandle, id: string, rect: Rect): void;
    unmountPlayer(handle: FrameHandle, id: string): void;
    /** Post to the frame's content window. */
    postToFrame(handle: FrameHandle, message: unknown): void;
    /**
     * Whether the content frame is currently unable to be seen — zero-sized, detached, or
     * painted over by other UI. Optional: an adapter with no DOM to inspect (tests, the
     * equivalence harness) simply never reports occlusion.
     */
    isFrameObscured?(handle: FrameHandle): boolean;
    /** Show or hide the whole overlay for a frame, players included. */
    setOverlayHidden?(handle: FrameHandle, hidden: boolean): void;
}

export interface HostRuntimeOptions extends ValidateOptions {
    location: HostLocation;
    registry: FrameRegistry;
    adapter: OverlayAdapter;
}

export interface HostRuntime {
    attach(source: unknown, contentSrc: string): FrameHandle;
    detach(handle: FrameHandle): void;
    handleMessage(event: { source?: unknown; data?: unknown }): void;
    /**
     * Ask a frame — or every frame — to re-report its embeds, for when the host lost its
     * state and the child has no way to know. Never unlocks a frame; see `welcome`.
     */
    requestSync(handle?: FrameHandle): void;
    /** Re-place overlays whose frame moved with no scroll or resize event. */
    checkDrift(): number;
    /** The frame navigated: drop its session so the next document must handshake. */
    notifyNavigated(handle: FrameHandle, contentSrc?: string): void;
}

export function createHostRuntime({ location, registry, adapter, ...policy }: HostRuntimeOptions): HostRuntime {
    /**
     * Keep the overlay's visibility tied to the frame's.
     *
     * The overlay sits at the top of the stacking order on the trusted page, so nothing the
     * embedder draws can cover a player — which is right while the frame is on screen, and
     * exactly the problem once it is not. A preview panel swapped for an editor leaves the
     * frame in the DOM and still measurable, so without this the video kept playing on top
     * of unrelated UI.
     */
    function syncVisibility(handle: FrameHandle): void {
        adapter.setOverlayHidden?.(handle, adapter.isFrameObscured?.(handle) ?? false);
    }

    /** Re-place the overlay and every player for one frame from a fresh report. */
    function render(handle: FrameHandle, embeds: ReportedEmbedRecord[], contentSrc: string): void {
        const frameRect = adapter.measureFrame(handle);
        if (!frameRect) return;

        syncVisibility(handle);

        adapter.positionOverlay(handle, overlayBox(frameRect, adapter.scrollOffset()));
        registry.setLastRect(handle, frameRect);

        // Only embeds the policy accepts survive. Anything refused is simply absent, and
        // reconciliation then unmounts whatever player it used to have. The verdict is
        // kept alongside so the player is described from the same decision that admitted
        // it — re-validating later would be a second chance to disagree with itself.
        const resolved: ResolvedEmbed[] = [];
        const verdicts = new Map<string, ReturnType<typeof validate>>();
        for (const embed of embeds) {
            const requested = requestedUrl(embed);
            if (!requested) continue;
            const verdict = validate(requested, contentSrc, location, policy);
            if (!verdict) continue;
            resolved.push({ embed, url: verdict.url });
            verdicts.set(embed.id, verdict);
        }

        const record = registry.get(handle);
        const plan = reconcilePlayers(record?.players ?? [], resolved);

        for (const id of plan.toRemove) adapter.unmountPlayer(handle, id);
        for (const item of plan.toCreate) {
            const verdict = verdicts.get(item.embed.id);
            if (verdict) adapter.mountPlayer(handle, item.embed.id, describePlayer(verdict));
        }
        for (const item of [...plan.toCreate, ...plan.toReposition]) {
            adapter.positionPlayer(handle, item.embed.id, clampPlayer(item.embed, frameRect));
        }

        registry.setPlayers(
            handle,
            resolved.map(item => ({ id: item.embed.id, src: item.url })),
        );
    }

    return {
        attach(source, contentSrc) {
            return registry.register(source, contentSrc);
        },

        detach(handle) {
            const record = registry.get(handle);
            for (const player of record?.players ?? []) adapter.unmountPlayer(handle, player.id);
            registry.unregister(handle);
        },

        handleMessage(event) {
            // Window identity is the only trust anchor: an opaque document's
            // `event.origin` is the string "null".
            const record = registry.resolve(event?.source);
            if (!record) return;

            const data = event.data as { type?: unknown; action?: unknown; embeds?: unknown } | null | undefined;
            if (!data || data.type !== EMBED_TYPE) return;

            if (data.action === 'hello') {
                registry.welcome(record.handle);
                adapter.postToFrame(record.handle, { type: EMBED_TYPE, action: 'welcome' });
                return;
            }

            if (data.action === 'sync') {
                // A frame that has not been welcomed may not report geometry. This is what
                // gives `invalidate()` its teeth: after navigation the welcome is gone, so
                // the new document's reports are refused until it handshakes for itself.
                if (!record.welcomed) return;
                if (!validateEmbedChildMessage(data)) return;
                render(record.handle, data.embeds as ReportedEmbedRecord[], record.contentSrc);
            }
        },

        requestSync(handle) {
            // Deliberately NOT a promotion: `request` is a broadcast, so it reaches windows
            // we do not host, and a broadcast must never be able to unlock one. Only the
            // addressed `welcome` does that.
            const targets = handle === undefined ? registry.all() : [registry.get(handle)];
            for (const record of targets) {
                if (record) adapter.postToFrame(record.handle, { type: EMBED_TYPE, action: 'request' });
            }
        },

        checkDrift() {
            let moved = 0;
            for (const record of registry.all()) {
                const rect = adapter.measureFrame(record.handle);
                if (!rect) continue;
                syncVisibility(record.handle);
                if (!hasDrifted(record.lastRect, rect)) continue;
                adapter.positionOverlay(record.handle, overlayBox(rect, adapter.scrollOffset()));
                registry.setLastRect(record.handle, rect);
                moved += 1;
            }
            return moved;
        },

        notifyNavigated(handle, contentSrc) {
            const record = registry.get(handle);
            for (const player of record?.players ?? []) adapter.unmountPlayer(handle, player.id);
            registry.invalidate(handle, contentSrc);
        },
    };
}
