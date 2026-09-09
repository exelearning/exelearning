/**
 * The shape every external-media provider is described by.
 *
 * Today the same knowledge — which hosts belong to a provider, what an id looks like,
 * and what the canonical embed URL is — is restated in four places
 * (`exe_embed_shim.js`, `exe_embed_relay.js`, `exe_media_policy.js`, `exe-media-host.js`)
 * and forked again across five host plugins. This module is the single definition those
 * collapse into; a parity spec pins it to the behaviour they ship today so the swap in a
 * later phase cannot change what users see.
 */

export type ExternalMediaKind = 'video' | 'pdf' | 'iframe' | 'audio';

/**
 * How a provider may be rendered.
 *
 * - `passive` — an `<iframe>` the user drives; the only mode shipped today.
 * - `controlled` — the host drives the player over RPC. Not claimed by anyone yet:
 *   Phase 0 (S7b) established that provider player APIs validate the embedder's origin,
 *   which an opaque frame cannot supply.
 */
export interface PassiveTransport {
    supported: boolean;
    /** Sandbox tokens for the promoted player iframe. */
    sandbox: string;
    /** Permissions-Policy `allow` list. */
    allow: string;
    referrerPolicy: string;
}

export interface ControlledTransport {
    supported: boolean;
    /**
     * How the host would talk to the player if controlled mode were enabled.
     *
     * `postmessage` is deliberate: WordPress and Omeka already ship raw-postMessage
     * adapters and load no third-party SDK, which is both fewer moving parts and the
     * only version of controlled mode that keeps the click-to-load privacy argument
     * intact (an SDK fetch contacts the provider before the user asks for the video).
     */
    transport?: 'postmessage';
}

/** Where a facade's poster image comes from. Never a third-party fetch on load. */
export type PosterStrategy = 'packaged' | 'none';

export interface ProviderResource {
    provider: string;
    resourceId: string;
    kind: ExternalMediaKind;
}

export interface ProviderDefinition {
    id: string;
    /** Exact host, or a dotted-suffix match (`vimeo.com` matches `player.vimeo.com`). */
    hosts: readonly string[];
    /** The exact shape of an id, anchored. Anything else must never reach a template. */
    resourceIdPattern: RegExp;
    kind: ExternalMediaKind;
    /** Extract the resource id from any URL shape this provider publishes. */
    parse(url: URL): ProviderResource | null;
    /** Rebuild the canonical embed URL from a bare id, or null if the id is not valid. */
    buildCanonicalEmbedUrl(resourceId: string): string | null;
    passive: PassiveTransport;
    controlled: ControlledTransport;
    facade: { posterStrategy: PosterStrategy };
}

/**
 * Sandbox applied to a promoted player. `allow-same-origin` here is the PROVIDER's own
 * origin, isolated from the host page by the same-origin policy; it re-grants nothing.
 * `allow-top-navigation` and `allow-modals` are deliberately absent so a hostile embed
 * can neither redirect the host tab nor spam dialogs.
 */
export const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation';

export const PLAYER_ALLOW = 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write';

export const PLAYER_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/** Whether `host` is `candidate` or a subdomain of it — never a look-alike suffix. */
export function hostMatches(host: string, candidate: string): boolean {
    const normalised = host.toLowerCase().replace(/\.$/, '');
    return normalised === candidate || normalised.endsWith(`.${candidate}`);
}
