import { describe, expect, it } from 'bun:test';
import {
    clampPlayer,
    hasDrifted,
    overlayBox,
    reconcilePlayers,
    type MountedPlayer,
    type ResolvedEmbed,
} from './overlay-geometry';

const CONTENT: { left: number; top: number; width: number; height: number } = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
};

describe('overlayBox', () => {
    it('shifts the viewport rect into document space by the scroll offset', () => {
        expect(overlayBox(CONTENT, { x: 0, y: 200 })).toEqual({ left: 100, top: 250, width: 800, height: 600 });
        expect(overlayBox(CONTENT, { x: 40, y: 0 })).toEqual({ left: 140, top: 50, width: 800, height: 600 });
    });

    it('leaves the box unchanged at the top of the document', () => {
        expect(overlayBox(CONTENT, { x: 0, y: 0 })).toEqual(CONTENT);
    });

    it('handles a negative rect, as a frame scrolled above the viewport has', () => {
        expect(overlayBox({ left: -20, top: -300, width: 800, height: 600 }, { x: 0, y: 500 })).toEqual({
            left: -20,
            top: 200,
            width: 800,
            height: 600,
        });
    });
});

describe('hasDrifted', () => {
    it('treats a never-placed overlay as drifted, so it gets positioned', () => {
        expect(hasDrifted(null, CONTENT)).toBe(true);
        expect(hasDrifted(undefined, CONTENT)).toBe(true);
    });

    it('is false when nothing moved', () => {
        expect(hasDrifted({ ...CONTENT }, CONTENT)).toBe(false);
    });

    /**
     * Each of these can happen with no scroll or resize event at all — a sidebar toggle,
     * a panel slide-in, a CSS transform — which is exactly the case a poll exists for.
     */
    it('detects a move or a resize on any edge', () => {
        expect(hasDrifted({ ...CONTENT, left: 101 }, CONTENT)).toBe(true);
        expect(hasDrifted({ ...CONTENT, top: 51 }, CONTENT)).toBe(true);
        expect(hasDrifted({ ...CONTENT, width: 799 }, CONTENT)).toBe(true);
        expect(hasDrifted({ ...CONTENT, height: 601 }, CONTENT)).toBe(true);
    });
});

describe('clampPlayer', () => {
    it('keeps a player that fits exactly as reported', () => {
        expect(clampPlayer({ id: 'e1', x: 10, y: 20, w: 480, h: 270 }, CONTENT)).toEqual({
            left: 10,
            top: 20,
            width: 480,
            height: 270,
        });
    });

    /**
     * The clickjacking clamp. The content reports geometry, so an oversized report must
     * not be able to grow a player past the box the overlay clips to.
     */
    it('caps a player larger than the content box', () => {
        const clamped = clampPlayer({ id: 'e1', x: 0, y: 0, w: 99999, h: 99999 }, CONTENT);
        expect(clamped.width).toBe(CONTENT.width);
        expect(clamped.height).toBe(CONTENT.height);
    });

    it('caps each dimension independently', () => {
        expect(clampPlayer({ id: 'e1', x: 0, y: 0, w: 99999, h: 100 }, CONTENT)).toMatchObject({
            width: 800,
            height: 100,
        });
    });

    /** A player scrolled out of view inside the content should stay out of view. */
    it('passes the offset through unchanged, including negative values', () => {
        expect(clampPlayer({ id: 'e1', x: -300, y: -80, w: 480, h: 270 }, CONTENT)).toMatchObject({
            left: -300,
            top: -80,
        });
    });
});

describe('reconcilePlayers', () => {
    const embed = (id: string, url: string): ResolvedEmbed => ({
        embed: { id, x: 0, y: 0, w: 480, h: 270 },
        url,
    });
    const mounted = (id: string, src: string): MountedPlayer => ({ id, src });

    it('mounts a player for an embed that has none', () => {
        const result = reconcilePlayers([], [embed('e1', 'https://p/1')]);
        expect(result.toCreate).toHaveLength(1);
        expect(result.toReposition).toHaveLength(0);
        expect(result.toRemove).toHaveLength(0);
    });

    it('repositions rather than remounts when the URL is unchanged', () => {
        const result = reconcilePlayers([mounted('e1', 'https://p/1')], [embed('e1', 'https://p/1')]);
        expect(result.toReposition.map(r => r.embed.id)).toEqual(['e1']);
        expect(result.toCreate).toHaveLength(0);
        expect(result.toRemove).toHaveLength(0);
    });

    /**
     * The id-reuse rule. The child restarts its counter on every page, so `e1` on the
     * next page is a different embed; keeping the player would leave the previous page's
     * video running inside the overlay.
     */
    it('replaces a player whose id now renders a different URL', () => {
        const result = reconcilePlayers([mounted('e1', 'https://p/old')], [embed('e1', 'https://p/new')]);
        expect(result.toRemove).toEqual(['e1']);
        expect(result.toCreate.map(r => r.url)).toEqual(['https://p/new']);
        expect(result.toReposition).toHaveLength(0);
    });

    it('unmounts a player the content no longer reports', () => {
        const result = reconcilePlayers(
            [mounted('e1', 'https://p/1'), mounted('e2', 'https://p/2')],
            [embed('e1', 'https://p/1')],
        );
        expect(result.toRemove).toEqual(['e2']);
        expect(result.toReposition.map(r => r.embed.id)).toEqual(['e1']);
    });

    /**
     * A refused embed is simply absent from `resolved`, so any player it had is removed.
     * That is what stops a rejected URL keeping a player alive from an earlier pass.
     */
    it('unmounts everything when the host accepted nothing', () => {
        const result = reconcilePlayers([mounted('e1', 'https://p/1'), mounted('e2', 'https://p/2')], []);
        expect(result.toRemove.sort()).toEqual(['e1', 'e2']);
        expect(result.toCreate).toHaveLength(0);
    });

    it('handles a whole page turning over at once', () => {
        const result = reconcilePlayers(
            [mounted('e1', 'https://p/a'), mounted('e2', 'https://p/b')],
            [embed('e1', 'https://p/x'), embed('e2', 'https://p/y')],
        );
        expect(result.toRemove.sort()).toEqual(['e1', 'e2']);
        expect(result.toCreate.map(r => r.url).sort()).toEqual(['https://p/x', 'https://p/y']);
    });

    it('is a no-op for an empty overlay and an empty report', () => {
        expect(reconcilePlayers([], [])).toEqual({ toCreate: [], toReposition: [], toRemove: [] });
    });
});
