import { beforeEach, describe, expect, it } from 'bun:test';
import { createFrameRegistry, type FrameRegistry } from './frame-registry';
import { createHostRuntime, type HostRuntime, type OverlayAdapter } from './host-runtime';
import type { PlayerDescriptor } from './player-descriptor';
import type { Rect } from './overlay-geometry';

const LMS = { origin: 'https://lms.example', hostname: 'lms.example' };
const CONTENT = 'https://lms.example/pluginfile/1/mod/a1b2c3d4e5f6a7b8/index.html';
const FRAME_RECT: Rect = { left: 100, top: 50, width: 800, height: 600 };

interface Recorded {
    mounted: { id: string; descriptor: PlayerDescriptor }[];
    positioned: { id: string; rect: Rect }[];
    unmounted: string[];
    overlays: Rect[];
    posted: unknown[];
}

let registry: FrameRegistry;
let runtime: HostRuntime;
let rec: Recorded;
let frameRect: Rect | null;
let scroll: { x: number; y: number };
const contentWindow = { name: 'content' };
let handle: string;

function makeAdapter(): OverlayAdapter {
    return {
        measureFrame: () => frameRect,
        scrollOffset: () => scroll,
        positionOverlay: (_h, box) => rec.overlays.push(box),
        mountPlayer: (_h, id, descriptor) => rec.mounted.push({ id, descriptor }),
        positionPlayer: (_h, id, rect) => rec.positioned.push({ id, rect }),
        unmountPlayer: (_h, id) => rec.unmounted.push(id),
        postToFrame: (_h, message) => rec.posted.push(message),
    };
}

/** A geometry report from a recognised provider, using the id-only channel. */
const ytEmbed = (id: string, objectId = 'aqz-KE-bpKQ') => ({
    id,
    x: 10,
    y: 20,
    w: 480,
    h: 270,
    url: 'https://www.youtube.com/embed/ignored',
    provider: 'youtube',
    objectId,
});

const sync = (embeds: unknown[]) => ({ source: contentWindow, data: { type: 'exe-embed', action: 'sync', embeds } });
const hello = () => ({ source: contentWindow, data: { type: 'exe-embed', action: 'hello' } });

beforeEach(() => {
    registry = createFrameRegistry();
    rec = { mounted: [], positioned: [], unmounted: [], overlays: [], posted: [] };
    frameRect = { ...FRAME_RECT };
    scroll = { x: 0, y: 0 };
    runtime = createHostRuntime({ location: LMS, registry, adapter: makeAdapter() });
    handle = runtime.attach(contentWindow, CONTENT);
});

describe('the handshake', () => {
    it('welcomes a registered frame that says hello', () => {
        runtime.handleMessage(hello());
        expect(rec.posted).toEqual([{ type: 'exe-embed', action: 'welcome' }]);
        expect(registry.get(handle)?.welcomed).toBe(true);
    });

    it('ignores a hello from a window it does not host', () => {
        runtime.handleMessage({ source: { other: true }, data: { type: 'exe-embed', action: 'hello' } });
        expect(rec.posted).toHaveLength(0);
    });

    it('ignores messages outside the protocol', () => {
        runtime.handleMessage({ source: contentWindow, data: { type: 'other', action: 'hello' } });
        runtime.handleMessage({ source: contentWindow, data: null });
        expect(rec.posted).toHaveLength(0);
    });

    /** The rule that gives navigation invalidation its teeth. */
    it('refuses geometry from a frame it has not welcomed', () => {
        runtime.handleMessage(sync([ytEmbed('e1')]));
        expect(rec.mounted).toHaveLength(0);
        expect(rec.overlays).toHaveLength(0);
    });
});

describe('rendering a report', () => {
    beforeEach(() => runtime.handleMessage(hello()));

    it('places the overlay in document space and mounts the player', () => {
        scroll = { x: 5, y: 200 };
        runtime.handleMessage(sync([ytEmbed('e1')]));

        expect(rec.overlays).toEqual([{ left: 105, top: 250, width: 800, height: 600 }]);
        expect(rec.mounted).toHaveLength(1);
        expect(rec.mounted[0].descriptor.sandbox).toContain('allow-scripts');
    });

    /**
     * The id-only channel: for a recognised provider the host rebuilds the canonical URL
     * from its own registry and ignores whatever URL the content reported.
     */
    it('rebuilds the provider URL rather than trusting the reported one', () => {
        runtime.handleMessage(sync([ytEmbed('e1')]));
        expect(rec.mounted[0].descriptor.src).toBe('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
    });

    it('refuses a provider id that does not parse', () => {
        runtime.handleMessage(sync([ytEmbed('e1', 'nope')]));
        expect(rec.mounted).toHaveLength(0);
    });

    it('falls back to the reported URL for an unrecognised embed, still policed', () => {
        runtime.handleMessage(sync([{ id: 'e1', x: 0, y: 0, w: 480, h: 270, url: 'https://example.com/p' }]));
        expect(rec.mounted[0].descriptor.src).toBe('https://example.com/p');
    });

    it('refuses an embed the policy rejects, and mounts nothing', () => {
        runtime.handleMessage(sync([{ id: 'e1', x: 0, y: 0, w: 480, h: 270, url: 'https://lms.example/secret' }]));
        expect(rec.mounted).toHaveLength(0);
    });

    it('clamps the player to the content box', () => {
        runtime.handleMessage(sync([{ ...ytEmbed('e1'), w: 99999, h: 99999 }]));
        expect(rec.positioned[0].rect).toMatchObject({ width: 800, height: 600 });
    });

    it('drops a malformed report wholesale rather than rendering part of it', () => {
        runtime.handleMessage(sync([{ ...ytEmbed('e1'), w: Number.NaN }]));
        expect(rec.mounted).toHaveLength(0);
        expect(rec.overlays).toHaveLength(0);
    });

    it('does nothing when the frame can no longer be measured', () => {
        frameRect = null;
        runtime.handleMessage(sync([ytEmbed('e1')]));
        expect(rec.overlays).toHaveLength(0);
    });
});

describe('successive reports', () => {
    beforeEach(() => runtime.handleMessage(hello()));

    it('repositions an unchanged embed instead of remounting it', () => {
        runtime.handleMessage(sync([ytEmbed('e1')]));
        runtime.handleMessage(sync([{ ...ytEmbed('e1'), x: 40 }]));

        expect(rec.mounted).toHaveLength(1);
        expect(rec.positioned).toHaveLength(2);
        expect(rec.positioned[1].rect.left).toBe(40);
    });

    /** Id reuse after the content navigates within itself. */
    it('replaces a player whose id now resolves to a different URL', () => {
        runtime.handleMessage(sync([ytEmbed('e1')]));
        runtime.handleMessage(sync([ytEmbed('e1', 'dQw4w9WgXcQ')]));

        expect(rec.unmounted).toEqual(['e1']);
        expect(rec.mounted).toHaveLength(2);
    });

    it('unmounts a player the content stopped reporting', () => {
        runtime.handleMessage(sync([ytEmbed('e1'), ytEmbed('e2', 'dQw4w9WgXcQ')]));
        runtime.handleMessage(sync([ytEmbed('e1')]));

        expect(rec.unmounted).toEqual(['e2']);
    });

    it('unmounts everything when an embed stops passing the policy', () => {
        runtime.handleMessage(sync([ytEmbed('e1')]));
        runtime.handleMessage(sync([ytEmbed('e1', 'nope')]));

        expect(rec.unmounted).toEqual(['e1']);
    });
});

describe('drift', () => {
    beforeEach(() => {
        runtime.handleMessage(hello());
        runtime.handleMessage(sync([ytEmbed('e1')]));
        rec.overlays.length = 0;
    });

    it('does nothing while the frame stays put', () => {
        expect(runtime.checkDrift()).toBe(0);
        expect(rec.overlays).toHaveLength(0);
    });

    /** A panel slide-in or sidebar toggle fires no scroll or resize event. */
    it('re-places the overlay when the frame moved with no event', () => {
        frameRect = { ...FRAME_RECT, left: 300 };
        expect(runtime.checkDrift()).toBe(1);
        expect(rec.overlays[0].left).toBe(300);
    });

    it('skips a frame that can no longer be measured', () => {
        frameRect = null;
        expect(runtime.checkDrift()).toBe(0);
    });
});

describe('lifecycle', () => {
    it('unmounts every player on detach and forgets the frame', () => {
        runtime.handleMessage(hello());
        runtime.handleMessage(sync([ytEmbed('e1')]));

        runtime.detach(handle);

        expect(rec.unmounted).toEqual(['e1']);
        expect(registry.resolve(contentWindow)).toBeNull();
    });

    /**
     * §7.3: `event.source` survives navigation, so the next document must not inherit the
     * session — nor the previous document's players.
     */
    it('tears down and re-gates the frame when it navigates', () => {
        runtime.handleMessage(hello());
        runtime.handleMessage(sync([ytEmbed('e1')]));

        runtime.notifyNavigated(handle, 'https://lms.example/pkg/page2.html');

        expect(rec.unmounted).toEqual(['e1']);
        expect(registry.get(handle)?.welcomed).toBe(false);

        // The new document is refused until it handshakes for itself.
        rec.mounted.length = 0;
        runtime.handleMessage(sync([ytEmbed('e2')]));
        expect(rec.mounted).toHaveLength(0);

        runtime.handleMessage(hello());
        runtime.handleMessage(sync([ytEmbed('e2')]));
        expect(rec.mounted).toHaveLength(1);
    });
});

/**
 * The host can lose its state without the child noticing: a relay disposed and started
 * again, or a page whose listener was installed after the child already announced itself.
 * The re-sync ping is how it recovers — and, unlike `welcome`, it must never be able to
 * unlock a frame, because it is a broadcast that reaches windows we do not host.
 */
describe('asking for a re-sync', () => {
    it('pings every registered frame', () => {
        const second = { name: 'second' };
        runtime.attach(second, 'https://lms.example/pkg/other.html');

        runtime.requestSync();

        expect(rec.posted).toEqual([
            { type: 'exe-embed', action: 'request' },
            { type: 'exe-embed', action: 'request' },
        ]);
    });

    it('pings one frame when asked for one', () => {
        runtime.attach({ name: 'second' }, 'https://lms.example/pkg/other.html');

        runtime.requestSync(handle);

        expect(rec.posted).toEqual([{ type: 'exe-embed', action: 'request' }]);
    });

    it('cannot promote a frame on its own', () => {
        runtime.requestSync();
        runtime.handleMessage(sync([ytEmbed('e1')]));

        expect(registry.get(handle)?.welcomed).toBe(false);
        expect(rec.mounted).toHaveLength(0);
    });
});

/**
 * A promoted player belongs to the content frame. When that frame stops being visible —
 * hidden, detached, or simply covered by other UI — the player must go with it.
 *
 * The overlay lives on the trusted page at the top of the stacking order, so nothing else
 * can paint over it. That is deliberate (a player must not be obscured by page chrome) and
 * it is exactly why an orphaned overlay is so bad: pressing play in the preview and then
 * switching to the editor left the video floating above the metadata form, on top of a
 * panel that has nothing to do with it. Reported from the Omeka-embedded editor.
 */
describe('overlay follows the visibility of its frame', () => {
    function harness(obscured: boolean) {
        const hidden: { handle: FrameHandle; hidden: boolean }[] = [];
        const registry = createFrameRegistry();
        const adapter = {
            ...makeAdapter(),
            measureFrame: () => ({ left: 0, top: 0, width: 640, height: 360 }),
            isFrameObscured: () => obscured,
            setOverlayHidden: (handle: FrameHandle, value: boolean) => hidden.push({ handle, hidden: value }),
        };
        const runtime = createHostRuntime({
            location: { origin: 'https://host.example' },
            registry,
            adapter,
        });
        return { runtime, hidden, registry };
    }

    it('hides the overlay once the frame is covered by other UI', () => {
        const { runtime, hidden } = harness(true);
        runtime.attach({}, 'https://host.example/content.html');

        runtime.checkDrift();

        expect(hidden.at(-1)?.hidden).toBe(true);
    });

    it('shows it again when the frame is back in view', () => {
        const { runtime, hidden } = harness(false);
        runtime.attach({}, 'https://host.example/content.html');

        runtime.checkDrift();

        expect(hidden.at(-1)?.hidden).toBe(false);
    });
});
