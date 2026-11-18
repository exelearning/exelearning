/**
 * Utility functions for validating redirect URLs.
 * Prevents open redirect vulnerabilities while allowing
 * legitimate post-login redirects.
 */

import { getBasePath } from './basepath.util';

/**
 * Validate that a URL is safe for post-login redirect.
 * Only allows relative paths that start with / and don't attempt
 * to redirect to external sites.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe for redirect
 */
export function isValidReturnUrl(url: string | undefined | null): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Must start with /
    if (!url.startsWith('/')) {
        return false;
    }

    // Prevent protocol-relative URLs that could redirect to external sites
    // e.g., //evil.com
    if (url.startsWith('//')) {
        return false;
    }

    // No control characters or backslashes: browsers strip tab/newline and treat
    // '\' as '/', which turns '/<TAB>/evil.com' or '/\evil.com' into '//evil.com'
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
    if (/[\x00-\x1f\x7f\\]/.test(url)) {
        return false;
    }

    // No javascript: or data: URLs (case insensitive check)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:')) {
        return false;
    }

    return true;
}

/**
 * Build a safe redirect URL, falling back to default if invalid.
 *
 * @param returnUrl - The requested return URL
 * @param defaultPath - The default path to use if returnUrl is invalid (default: '/workarea')
 * @returns A safe URL string for redirect
 */
export function getSafeRedirectUrl(returnUrl: string | undefined | null, defaultPath: string = '/workarea'): string {
    const basePath = getBasePath();

    if (isValidReturnUrl(returnUrl)) {
        // If returnUrl already has basePath, return as-is
        // If not, prefix it
        if (basePath && !returnUrl!.startsWith(basePath)) {
            return `${basePath}${returnUrl}`;
        }
        return returnUrl!;
    }

    return basePath ? `${basePath}${defaultPath}` : defaultPath;
}
