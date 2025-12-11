/**
 * HTML Path Normalizer Utility
 *
 * Provides functions to normalize file paths in HTML content for cross-platform compatibility.
 * Converts Windows backslashes (\) to forward slashes (/) in HTML attributes containing URLs/paths.
 */

/**
 * Normalize file paths in HTML content
 * Converts Windows backslashes to forward slashes in src, href, and other URL attributes
 * This ensures HTML works correctly on all platforms
 *
 * @param html HTML content to normalize
 * @returns Normalized HTML content
 *
 * @example
 * ```typescript
 * const html = '<img src="resources\\image.jpg">';
 * const normalized = normalizeHtmlPaths(html);
 * // Result: '<img src="resources/image.jpg">'
 * ```
 */
export function normalizeHtmlPaths(html: string | null | undefined): string {
    if (!html) return '';

    // Normalize paths in common attributes that contain URLs/paths
    // Pattern matches: attribute="path\with\backslashes" or attribute='path\with\backslashes'
    // Handles: src, href, data, poster, srcset, and other common attributes
    return html.replace(
        /((?:src|href|data|poster|srcset|action|formaction|cite|longdesc|manifest|archive|codebase|profile)=["'])([^"']*)(["'])/gi,
        (match, prefix, path, suffix) => {
            // Convert all backslashes to forward slashes
            const normalized = path.replace(/\\/g, '/');
            return prefix + normalized + suffix;
        },
    );
}

/**
 * Check if HTML content contains Windows-style paths
 * Useful for testing and debugging
 *
 * @param html HTML content to check
 * @returns true if Windows paths are found
 */
export function hasWindowsPaths(html: string | null | undefined): boolean {
    if (!html) return false;

    // Check for backslashes in attribute values
    return /((?:src|href|data|poster|srcset)=["'])[^"']*\\[^"']*(["'])/i.test(html);
}
