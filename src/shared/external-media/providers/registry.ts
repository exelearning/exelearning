/**
 * The single declarative registry of external-media providers.
 *
 * Every id pattern is anchored, and `buildCanonicalEmbedUrl` re-checks the id before
 * templating it, so a value that could carry a path, query or fragment out of the
 * template can never reach a live URL. The parse side is separate from the build side
 * on purpose: the child reports `{provider, resourceId}` and the trusted host rebuilds
 * the URL, so an author-supplied URL never crosses the boundary for a known provider.
 */
import {
    hostMatches,
    PLAYER_ALLOW,
    PLAYER_REFERRER_POLICY,
    PLAYER_SANDBOX,
    type ProviderDefinition,
    type ProviderResource,
} from './types';

/** Passive-only defaults: the single transport shipped today. */
const PASSIVE_ONLY = {
    passive: {
        supported: true,
        sandbox: PLAYER_SANDBOX,
        allow: PLAYER_ALLOW,
        referrerPolicy: PLAYER_REFERRER_POLICY,
    },
    controlled: { supported: false },
    facade: { posterStrategy: 'none' as const },
};

/** YouTube ids are 11 url-safe chars; the canonical target is the no-cookie host. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const youtube: ProviderDefinition = {
    id: 'youtube',
    hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    resourceIdPattern: YOUTUBE_ID,
    kind: 'video',
    parse(url) {
        const host = url.hostname.toLowerCase().replace(/\.$/, '');
        let id = '';
        if (hostMatches(host, 'youtu.be')) {
            id = url.pathname.split('/').filter(Boolean)[0] ?? '';
        } else {
            id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|v|shorts)\/([^/?#]+)/)?.[1] ?? '';
        }
        return YOUTUBE_ID.test(id) ? { provider: 'youtube', resourceId: id, kind: 'video' } : null;
    },
    buildCanonicalEmbedUrl(resourceId) {
        return YOUTUBE_ID.test(resourceId) ? `https://www.youtube-nocookie.com/embed/${resourceId}` : null;
    },
    ...PASSIVE_ONLY,
};

const VIMEO_ID = /^[0-9]{6,12}$/;

const vimeo: ProviderDefinition = {
    id: 'vimeo',
    hosts: ['vimeo.com'],
    resourceIdPattern: VIMEO_ID,
    kind: 'video',
    parse(url) {
        const id = url.pathname.match(/^\/video\/([0-9]+)/)?.[1] ?? url.pathname.split('/').filter(Boolean)[0] ?? '';
        return VIMEO_ID.test(id) ? { provider: 'vimeo', resourceId: id, kind: 'video' } : null;
    },
    buildCanonicalEmbedUrl(resourceId) {
        return VIMEO_ID.test(resourceId) ? `https://player.vimeo.com/video/${resourceId}` : null;
    },
    ...PASSIVE_ONLY,
};

const DAILYMOTION_ID = /^[A-Za-z0-9]{5,}$/;

const dailymotion: ProviderDefinition = {
    id: 'dailymotion',
    hosts: ['dailymotion.com', 'dai.ly'],
    resourceIdPattern: DAILYMOTION_ID,
    kind: 'video',
    parse(url) {
        const id =
            url.pathname.match(/^\/embed\/video\/([A-Za-z0-9]+)/)?.[1] ??
            url.pathname.match(/^\/video\/([A-Za-z0-9]+)/)?.[1] ??
            '';
        return DAILYMOTION_ID.test(id) ? { provider: 'dailymotion', resourceId: id, kind: 'video' } : null;
    },
    buildCanonicalEmbedUrl(resourceId) {
        return DAILYMOTION_ID.test(resourceId) ? `https://www.dailymotion.com/embed/video/${resourceId}` : null;
    },
    ...PASSIVE_ONLY,
};

const MEDIATECA_ID = /^[A-Za-z0-9]{8,}$/;

/** Madrid's regional media library — the second-most used source in the S4 corpus. */
const mediatecaMadrid: ProviderDefinition = {
    id: 'mediateca-madrid',
    hosts: ['mediateca.educa.madrid.org'],
    resourceIdPattern: MEDIATECA_ID,
    kind: 'video',
    parse(url) {
        const id = url.pathname.match(/^\/video\/([A-Za-z0-9]+)(?:\/fs)?\/?$/)?.[1] ?? '';
        return MEDIATECA_ID.test(id) ? { provider: 'mediateca-madrid', resourceId: id, kind: 'video' } : null;
    },
    buildCanonicalEmbedUrl(resourceId) {
        return MEDIATECA_ID.test(resourceId) ? `https://mediateca.educa.madrid.org/video/${resourceId}/fs` : null;
    },
    ...PASSIVE_ONLY,
};

export const PROVIDERS: readonly ProviderDefinition[] = [youtube, vimeo, dailymotion, mediatecaMadrid];

const BY_ID = new Map(PROVIDERS.map(provider => [provider.id, provider]));

export function getProvider(id: string): ProviderDefinition | null {
    return BY_ID.get(id) ?? null;
}

/** The provider owning this URL's host, or null. Host match only — no id checking. */
export function findProviderForUrl(url: URL): ProviderDefinition | null {
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return PROVIDERS.find(provider => provider.hosts.some(candidate => hostMatches(host, candidate))) ?? null;
}

/**
 * Normalise any supported provider URL into `{provider, resourceId, kind}`.
 * Rejects anything that is not plain https without credentials before matching, so a
 * `javascript:` value or `https://evil@youtube.com/…` never reaches a provider parser.
 */
export function parseExternalMedia(input: string): ProviderResource | null {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;

    return findProviderForUrl(url)?.parse(url) ?? null;
}

/** Rebuild a provider's canonical embed URL from a bare id. */
export function buildCanonicalEmbedUrl(providerId: string, resourceId: string): string | null {
    return getProvider(providerId)?.buildCanonicalEmbedUrl(resourceId) ?? null;
}
