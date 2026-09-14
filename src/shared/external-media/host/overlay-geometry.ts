/**
 * Where the overlay and each promoted player are placed.
 *
 * The content reports geometry; the trusted host owns rendering. That asymmetry is the
 * whole point, so the arithmetic that turns a report into a position lives here, pure,
 * where every rule can be stated as a test instead of inferred from a browser.
 *
 * Two of these rules carry weight beyond layout:
 *
 *  - the **clamp** is defence in depth against clickjacking. The overlay is pinned to the
 *    content iframe's box and clips; capping each player to that box as well means a
 *    hostile report cannot make a player cover host UI outside the frame.
 *  - **id reuse**: the child restarts its counter on every page, so `exe-embed-1` on the
 *    next page is a different embed. A player kept across that boundary would leave the
 *    previous page's video running. Reconciliation keys on id *and* URL for that reason.
 */

export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ScrollOffset {
    x: number;
    y: number;
}

/** A geometry report from the content, already schema-validated. */
export interface ReportedEmbed {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Document-space box for the overlay covering a content iframe.
 *
 * The overlay is positioned absolutely against the document, so the viewport-relative
 * rect from `getBoundingClientRect()` has to be shifted by the current scroll.
 */
export function overlayBox(iframeRect: Rect, scroll: ScrollOffset): Rect {
    return {
        left: iframeRect.left + scroll.x,
        top: iframeRect.top + scroll.y,
        width: iframeRect.width,
        height: iframeRect.height,
    };
}

/**
 * Whether the content iframe has moved or resized since the overlay was last placed.
 *
 * The host page can move the iframe with no scroll or resize event at all — a sidebar
 * toggle, a panel slide-in, a CSS transform — which would strand the overlay at its old
 * position. A cheap poll comparing boxes is what catches that.
 */
export function hasDrifted(lastRect: Rect | null | undefined, currentRect: Rect): boolean {
    if (!lastRect) return true;
    return (
        lastRect.left !== currentRect.left ||
        lastRect.top !== currentRect.top ||
        lastRect.width !== currentRect.width ||
        lastRect.height !== currentRect.height
    );
}

/**
 * Position and size for one player, clamped to the content box.
 *
 * The offset is left as reported — a player scrolled out of view inside the content
 * should be out of view — but the SIZE is capped, so no report can grow a player beyond
 * the box the overlay clips to.
 */
export function clampPlayer(embed: ReportedEmbed, containerRect: Rect): Rect {
    return {
        left: embed.x,
        top: embed.y,
        width: Math.min(embed.w, containerRect.width),
        height: Math.min(embed.h, containerRect.height),
    };
}

/** A player currently mounted in the overlay, identified by what it renders. */
export interface MountedPlayer {
    id: string;
    /** The URL this player was created for. */
    src: string;
}

/** What one embed resolved to after the host validated it. */
export interface ResolvedEmbed {
    embed: ReportedEmbed;
    url: string;
}

export interface Reconciliation {
    /** Embeds with no live player, or whose player renders a different URL. */
    toCreate: ResolvedEmbed[];
    /** Embeds whose existing player is still correct and only needs repositioning. */
    toReposition: ResolvedEmbed[];
    /** Player ids to unmount: gone from the report, or superseded by a new URL. */
    toRemove: string[];
}

/**
 * Decide what to mount, move and unmount for one sync pass.
 *
 * `resolved` holds only embeds the host accepted; anything it refused is simply absent,
 * and any player left over is removed. That is what stops a rejected embed keeping a
 * player alive from an earlier pass.
 */
export function reconcilePlayers(
    mounted: readonly MountedPlayer[],
    resolved: readonly ResolvedEmbed[],
): Reconciliation {
    const byId = new Map(mounted.map(player => [player.id, player]));
    const toCreate: ResolvedEmbed[] = [];
    const toReposition: ResolvedEmbed[] = [];
    const toRemove: string[] = [];
    const seen = new Set<string>();

    for (const item of resolved) {
        seen.add(item.embed.id);
        const existing = byId.get(item.embed.id);
        if (!existing) {
            toCreate.push(item);
            continue;
        }
        if (existing.src !== item.url) {
            // Same id, different URL: the content navigated and reused the counter.
            toRemove.push(existing.id);
            toCreate.push(item);
            continue;
        }
        toReposition.push(item);
    }

    for (const player of mounted) {
        if (!seen.has(player.id)) toRemove.push(player.id);
    }

    return { toCreate, toReposition, toRemove };
}
