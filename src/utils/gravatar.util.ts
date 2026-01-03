import { createHash } from 'crypto';

const DEFAULT_SIZE = 96;
const DEFAULT_RATING = 'g';

// Default Gravatar constants
const DEFAULTS = {
    GRAVATAR_BASE_URL: 'https://www.gravatar.com/avatar/',
    GRAVATAR_DEFAULT_IMAGE: 'initials', // Regular users get initials
    GRAVATAR_GUEST_DEFAULT_IMAGE: 'identicon', // Guest accounts get identicon
    GRAVATAR_GUEST_ACCOUNT_DOMAIN: '@guest.local', // Guest account domain
};

const getConfigValue = (envKey: string, fallback: string): string => {
    return (process.env[envKey] || fallback || '').trim();
};

const GRAVATAR_BASE_URL = getConfigValue('GRAVATAR_BASE_URL', DEFAULTS.GRAVATAR_BASE_URL);
const GRAVATAR_DEFAULT_IMAGE = getConfigValue('GRAVATAR_DEFAULT_IMAGE', DEFAULTS.GRAVATAR_DEFAULT_IMAGE);
const GRAVATAR_GUEST_DEFAULT_IMAGE = getConfigValue(
    'GRAVATAR_GUEST_DEFAULT_IMAGE',
    DEFAULTS.GRAVATAR_GUEST_DEFAULT_IMAGE,
);
const GRAVATAR_GUEST_ACCOUNT_DOMAIN = getConfigValue(
    'GRAVATAR_GUEST_ACCOUNT_DOMAIN',
    DEFAULTS.GRAVATAR_GUEST_ACCOUNT_DOMAIN,
).toLowerCase();

const ensureTrailingSlash = (url: string): string => {
    if (!url) return '';
    return url.endsWith('/') ? url : `${url}/`;
};

const sanitizeInitials = (initials?: string | null): string => {
    if (!initials) return '';
    const filtered = initials.replace(/[^\p{L}\p{N}]+/gu, '').trim();
    if (!filtered) return '';
    return filtered.toUpperCase().slice(0, 4);
};

const initialsFromText = (text: string): string => {
    const parts = text
        .trim()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);

    if (!parts.length) return '';

    let result = '';
    for (const part of parts) {
        result += part.charAt(0).toUpperCase();
        if (result.length >= 4) break;
    }
    return result;
};

const initialsFromIdentifier = (identifier: string): string => {
    if (!identifier) return '';
    const atIndex = identifier.indexOf('@');
    const localPart = (atIndex >= 0 ? identifier.slice(0, atIndex) : identifier).toLowerCase();
    return initialsFromText(localPart.replace(/[._-]/g, ' '));
};

const resolveInitials = (identifier: string, initials?: string | null, displayName?: string | null): string => {
    return sanitizeInitials(initials) || initialsFromText(displayName || '') || initialsFromIdentifier(identifier);
};

const isGuestAccount = (identifier: string): boolean => {
    if (!identifier || !GRAVATAR_GUEST_ACCOUNT_DOMAIN) return false;
    return identifier.toLowerCase().endsWith(GRAVATAR_GUEST_ACCOUNT_DOMAIN);
};

const resolveDefaultImage = (identifier: string): string => {
    if (identifier && isGuestAccount(identifier) && GRAVATAR_GUEST_DEFAULT_IMAGE) {
        return GRAVATAR_GUEST_DEFAULT_IMAGE;
    }
    return GRAVATAR_DEFAULT_IMAGE;
};

/**
 * Generate a Gravatar URL compatible with the Symfony implementation.
 */
export const createGravatarUrl = (
    identifier?: string | null,
    initials?: string | null,
    displayName?: string | null,
): string => {
    const baseUrl = ensureTrailingSlash(GRAVATAR_BASE_URL);
    if (!baseUrl) return '';

    const normalizedIdentifier = (identifier || '').trim();
    const defaultImage = resolveDefaultImage(normalizedIdentifier);

    const params = new URLSearchParams({
        s: String(DEFAULT_SIZE),
        d: defaultImage,
        r: DEFAULT_RATING,
    });

    if (defaultImage === 'initials') {
        const resolvedInitials = resolveInitials(normalizedIdentifier, initials, displayName);
        if (resolvedInitials) {
            params.set('initials', resolvedInitials);
        }
    }

    if (!normalizedIdentifier) {
        return `${baseUrl}?${params.toString()}`;
    }

    const hash = createHash('md5').update(normalizedIdentifier.toLowerCase()).digest('hex');
    return `${baseUrl}${hash}?${params.toString()}`;
};
