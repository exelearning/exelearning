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

    // No dangerous characters that could be used for header injection
    if (url.includes('\n') || url.includes('\r') || url.includes('\\')) {
        return false;
    }

    // No javascript: or data: URLs (case insensitive check)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:')) {
        return false;
    }

    // If BASE_PATH is set, validate the URL starts with it or is under root
    const basePath = getBasePath();
    if (basePath) {
        // Allow paths that start with basePath or are at root (for assets, etc.)
        // e.g., /exelearning/workarea or /workarea (both valid)
        return true;
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
