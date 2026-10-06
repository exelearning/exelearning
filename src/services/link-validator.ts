/**
 * Link Validator Service
 *
 * Extracts and validates links from HTML content.
 * Supports internal file links (files/...), internal page links (exe-node:), and external HTTP(S) links.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { safeFetch, SsrfBlockedError, type LookupFn } from '../utils/ssrf-guard';

// =====================================================
// Interfaces
// =====================================================

export interface ExtractedLink {
    id: string;
    url: string;
    count: number;
    pageName: string;
    blockName: string;
    ideviceType: string;
    order: string;
}

export interface RawExtractedLink {
    url: string;
    count: number;
}

export interface IdeviceContent {
    html: string;
    pageName?: string;
    blockName?: string;
    ideviceType?: string;
    order?: number;
}

export interface ValidationResult {
    id: string;
    url: string;
    status: 'valid' | 'broken';
    error: string | null;
}

export interface BrokenLinkInfo {
    brokenLinks: string;
    nTimesBrokenLinks: number | null;
    brokenLinksError: string | null;
    pageNamesBrokenLinks: string;
    blockNamesBrokenLinks: string;
    typeComponentSyncBrokenLinks: string;
    orderComponentSyncBrokenLinks: string;
}

// =====================================================
// Link Extraction Functions
// =====================================================

/**
 * Extract links (href/src attributes) from HTML content
 */
export function extractLinksFromHtml(html: string): RawExtractedLink[] {
    if (!html) return [];
    const regex = /(href|src)="([^"]*)"/gi;
    const links: RawExtractedLink[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
        links.push({ url: match[2], count: 1 });
    }
    return links;
}

/**
 * Clean URLs and count duplicates
 */
export function cleanAndCountLinks(links: RawExtractedLink[]): RawExtractedLink[] {
    const urlCounts = new Map<string, number>();
    for (const link of links) {
        const cleanUrl = link.url.replace(/"/g, '');
        urlCounts.set(cleanUrl, (urlCounts.get(cleanUrl) || 0) + 1);
    }
    return Array.from(urlCounts.entries()).map(([url, count]) => ({ url, count }));
}

/**
 * Remove invalid/non-validatable links
 * Filters out: empty, anchors (#), javascript:, data: URLs
 */
export function removeInvalidLinks(links: RawExtractedLink[]): RawExtractedLink[] {
    return links.filter(link => {
        if (!link.url || link.url.trim() === '') return false;
        if (link.url.startsWith('#')) return false;
        if (link.url.startsWith('javascript:')) return false;
        if (link.url.startsWith('data:')) return false;
        return true;
    });
}

/**
 * Deduplicate links, keeping the one with highest count
 */
export function deduplicateLinks(links: RawExtractedLink[]): RawExtractedLink[] {
    const uniqueLinks = new Map<string, RawExtractedLink>();
    for (const link of links) {
        const existing = uniqueLinks.get(link.url);
        if (!existing || link.count > existing.count) {
            uniqueLinks.set(link.url, link);
        }
    }
    return Array.from(uniqueLinks.values());
}

/**
 * Check if a URL should be validated
 * Returns false for internal page links (exe-node:) and relative URLs that aren't files/
 */
export function shouldValidateLink(url: string): boolean {
    // Internal page links - skip validation (they're handled by the app)
    if (url.startsWith('exe-node:')) return false;

    // Internal file links - should validate
    if (url.startsWith('files/') || url.startsWith('files\\')) return true;

    // External HTTP(S) links - should validate
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return true;

    // Other relative URLs - skip validation
    return false;
}

/**
 * Extract all validatable links from idevices content
 * Returns links with unique IDs and metadata
 */
export function extractLinksFromIdevices(idevices: IdeviceContent[]): ExtractedLink[] {
    const allLinks: ExtractedLink[] = [];

    for (const idevice of idevices) {
        if (!idevice.html) continue;

        let links = extractLinksFromHtml(idevice.html);
        links = cleanAndCountLinks(links);
        links = removeInvalidLinks(links);
        links = deduplicateLinks(links);

        // Filter to only validatable links and add metadata
        for (const link of links) {
            if (shouldValidateLink(link.url)) {
                allLinks.push({
                    id: randomUUID(),
                    url: link.url,
                    count: link.count,
                    pageName: idevice.pageName || '',
                    blockName: idevice.blockName || '',
                    ideviceType: idevice.ideviceType || '',
                    order: String(idevice.order ?? ''),
                });
            }
        }
    }

    return allLinks;
}

// =====================================================
// Link Validation
// =====================================================

/**
 * Classify an HTTP status from a completed request as valid (null) or broken (message).
 * Any 2xx/3xx response means the resource exists for link-check purposes.
 */
export function classifyHttpStatus(status: number): string | null {
    if (status >= 200 && status < 400) return null;
    // 416 = our `Range: bytes=0-0` was not satisfiable (zero-length
    // resource): the resource exists, there is just no byte 0 to serve.
    if (status === 416) return null;
    return String(status);
}

export interface ValidateLinkOptions {
    filesDir: string;
    timeout?: number;
    /** Maximum redirect hops to follow when validating external links (each re-validated). */
    maxRedirects?: number;
    /** Injectable DNS resolver, forwarded to the SSRF guard (for hermetic tests). */
    lookupFn?: LookupFn;
    /** Injectable fetch implementation, forwarded to the SSRF guard (for hermetic tests). */
    fetchImpl?: typeof fetch;
}

/**
 * Validate a single link
 * Returns null if valid, or an error message if broken
 */
export async function validateLink(url: string, options: ValidateLinkOptions): Promise<string | null> {
    const { filesDir, timeout = 10000, maxRedirects, lookupFn, fetchImpl } = options;

    // Internal page links (exe-node:) - consider valid
    if (url.startsWith('exe-node:')) {
        return null;
    }

    // Internal file links (files/...)
    if (url.startsWith('files/') || url.startsWith('files\\')) {
        try {
            const relativePath = url.substring(6);
            const fullPath = path.join(filesDir, relativePath);
            if (await fs.pathExists(fullPath)) {
                return null;
            }
            return '404';
        } catch {
            return '500';
        }
    }

    // Skip relative URLs that aren't files/
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
        return null;
    }

    // External link validation
    try {
        let normalizedUrl = url;
        if (url.startsWith('//')) {
            normalizedUrl = 'https:' + url;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Browser-like headers: some hosts drop or 403 bare bot-like requests.
        const browserHeaders: Record<string, string> = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        try {
            // A single ranged GET — no HEAD. Too many hosts reject HEAD
            // (405/403), lie about it (educa.madrid answers HEAD with 404
            // while GET returns the real status) or simply hang on it. A GET
            // is what a browser sends, so hosts answer it truthfully; Range
            // keeps the transfer to one byte on servers that honor it, and
            // the body is cancelled unread either way.
            //
            // safeFetch enforces SSRF egress filtering (allow only http(s),
            // reject private/loopback/link-local/CGNAT addresses) and follows
            // redirects manually, re-validating every hop. It forces
            // redirect: 'manual' internally, so we must NOT pass
            // redirect: 'follow'.
            const response = await safeFetch(normalizedUrl, {
                method: 'GET',
                signal: controller.signal,
                maxRedirects,
                lookupFn,
                fetchImpl,
                headers: {
                    ...browserHeaders,
                    Range: 'bytes=0-0',
                    // identity: a compressed body sliced by Range is a
                    // truncated gzip stream that some fetch implementations
                    // refuse to accept.
                    'Accept-Encoding': 'identity',
                },
            });
            try {
                await response.body?.cancel();
            } catch {
                // Stream already closed or locked — the status is all we need.
            }
            return classifyHttpStatus(response.status);
        } catch (fetchError: unknown) {
            // The SSRF guard blocked the URL or one of its redirect hops (private/
            // loopback/link-local/CGNAT, disallowed scheme, etc.). Treat as broken
            // without reflecting the resolved address (no internal-host oracle).
            if (fetchError instanceof SsrfBlockedError) {
                return 'Blocked address';
            }
            const err = fetchError as { name?: string; message?: string; cause?: { code?: string } };
            if (err.name === 'AbortError') return 'Timeout';
            const cause = err.cause;
            if (cause?.code === 'ENOTFOUND') return 'Could not resolve host';
            if (cause?.code === 'ECONNREFUSED') return 'Connection refused';
            return err.message || 'Network error';
        } finally {
            clearTimeout(timeoutId);
        }
    } catch {
        return 'URL using bad/illegal format';
    }
}

/**
 * Validate a link and return a ValidationResult
 */
export async function validateLinkWithResult(
    link: ExtractedLink,
    options: ValidateLinkOptions,
): Promise<ValidationResult> {
    const error = await validateLink(link.url, options);
    return {
        id: link.id,
        url: link.url,
        status: error ? 'broken' : 'valid',
        error,
    };
}

/**
 * Validate multiple links in batches
 * Yields results as they complete
 */
export async function* validateLinksStream(
    links: ExtractedLink[],
    options: ValidateLinkOptions & { batchSize?: number },
): AsyncGenerator<ValidationResult> {
    const { batchSize = 5, ...validateOptions } = options;

    for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(link => validateLinkWithResult(link, validateOptions)));

        for (const result of results) {
            yield result;
        }
    }
}

/**
 * Convert ExtractedLink to BrokenLinkInfo format (for legacy API compatibility)
 */
export function toBrokenLinkInfo(link: ExtractedLink, error: string): BrokenLinkInfo {
    return {
        brokenLinks: link.url,
        nTimesBrokenLinks: link.count,
        brokenLinksError: error,
        pageNamesBrokenLinks: link.pageName,
        blockNamesBrokenLinks: link.blockName,
        typeComponentSyncBrokenLinks: link.ideviceType,
        orderComponentSyncBrokenLinks: link.order,
    };
}
