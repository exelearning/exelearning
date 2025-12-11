import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileHelperService } from '../../file-management/services/file-helper.service';

export interface BrokenLinkInfo {
    brokenLinks: string;
    nTimesBrokenLinks: number | null;
    brokenLinksError: string | null;
    pageNamesBrokenLinks: string;
    blockNamesBrokenLinks: string;
    typeComponentSyncBrokenLinks: string;
    orderComponentSyncBrokenLinks: string;
}

export interface LinkValidationResult {
    brokenLinks: BrokenLinkInfo[];
}

interface ExtractedLink {
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

@Injectable()
export class LinkValidatorService {
    private readonly logger = new Logger(LinkValidatorService.name);

    // HTTP timeout for external link validation (ms)
    private readonly HTTP_TIMEOUT = 10000;

    // Status code for moved permanently (not considered broken)
    private readonly STATUS_CODE_MOVED_PERMANENTLY = 301;

    constructor(private readonly fileHelperService: FileHelperService) {}

    /**
     * Validate links in multiple idevices
     * Similar to Symfony's OdeComponentsSyncService::getBrokenLinks
     * @param idevices Array of idevice content with HTML
     * @param odeSessionId Session ID for internal file validation
     * @returns Validation result with broken links
     */
    async validateLinks(
        idevices: IdeviceContent[],
        odeSessionId?: string,
    ): Promise<LinkValidationResult> {
        const allBrokenLinks: BrokenLinkInfo[] = [];
        const filesDir = this.fileHelperService.getFilesDir();

        for (const idevice of idevices) {
            if (!idevice.html) continue;

            // Extract links from HTML (matches Symfony's getOdeHtmlLinks)
            let links = this.extractLinks(idevice.html);

            // Remove apostrophes and count (matches getOdeHtmlLinksWithoutAphostrophes)
            links = this.cleanAndCountLinks(links);

            // Remove empty and anchor-only links (matches getOdeHtmlLinksClean)
            links = this.removeInvalidLinks(links);

            // Remove duplicates, keeping highest count (matches getOdeHtmlLinksWithoutRepeated)
            links = this.deduplicateLinks(links);

            for (const link of links) {
                const validationError = await this.validateLink(link.url, filesDir);

                if (validationError) {
                    allBrokenLinks.push({
                        brokenLinks: link.url,
                        nTimesBrokenLinks: link.count,
                        brokenLinksError: validationError,
                        pageNamesBrokenLinks: idevice.pageName || '',
                        blockNamesBrokenLinks: idevice.blockName || '',
                        typeComponentSyncBrokenLinks: idevice.ideviceType || '',
                        orderComponentSyncBrokenLinks: String(idevice.order ?? ''),
                    });
                }
            }
        }

        // If no broken links found, return the "no broken links" message (matches Symfony behavior)
        if (allBrokenLinks.length === 0) {
            return {
                brokenLinks: [
                    {
                        brokenLinks: 'No broken links found',
                        nTimesBrokenLinks: null,
                        brokenLinksError: null,
                        pageNamesBrokenLinks: '',
                        blockNamesBrokenLinks: '',
                        typeComponentSyncBrokenLinks: '',
                        orderComponentSyncBrokenLinks: '',
                    },
                ],
            };
        }

        return { brokenLinks: allBrokenLinks };
    }

    /**
     * Extract links from HTML content
     * Matches Symfony's getOdeHtmlLinks: preg_match_all('/(href|src)=("[^"]*")/', $htmlView, $match)
     * @param html HTML string to parse
     * @returns Array of links (may contain duplicates)
     */
    private extractLinks(html: string): ExtractedLink[] {
        if (!html) return [];

        // Match href and src attributes - same regex as Symfony
        const regex = /(href|src)="([^"]*)"/gi;
        const links: ExtractedLink[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(html)) !== null) {
            links.push({ url: match[2], count: 1 });
        }

        return links;
    }

    /**
     * Remove quotes and count occurrences
     * Matches Symfony's getOdeHtmlLinksWithoutAphostrophes
     */
    private cleanAndCountLinks(links: ExtractedLink[]): ExtractedLink[] {
        // Count occurrences of each URL
        const urlCounts = new Map<string, number>();

        for (const link of links) {
            // Remove quotes (though regex already handles this)
            const cleanUrl = link.url.replace(/"/g, '');
            urlCounts.set(cleanUrl, (urlCounts.get(cleanUrl) || 0) + 1);
        }

        return Array.from(urlCounts.entries()).map(([url, count]) => ({
            url,
            count,
        }));
    }

    /**
     * Remove empty and anchor-only links
     * Matches Symfony's getOdeHtmlLinksClean
     */
    private removeInvalidLinks(links: ExtractedLink[]): ExtractedLink[] {
        return links.filter((link) => {
            // Remove empty URLs
            if (!link.url || link.url.trim() === '') return false;
            // Remove anchor-only URLs (starting with #)
            if (link.url.startsWith('#')) return false;
            // Remove javascript: URLs
            if (link.url.startsWith('javascript:')) return false;
            // Remove data: URLs
            if (link.url.startsWith('data:')) return false;
            return true;
        });
    }

    /**
     * Remove duplicate links, keeping highest count
     * Matches Symfony's getOdeHtmlLinksWithoutRepeated
     */
    private deduplicateLinks(links: ExtractedLink[]): ExtractedLink[] {
        const uniqueLinks = new Map<string, ExtractedLink>();

        for (const link of links) {
            const existing = uniqueLinks.get(link.url);
            if (!existing || link.count > existing.count) {
                uniqueLinks.set(link.url, link);
            }
        }

        return Array.from(uniqueLinks.values());
    }

    /**
     * Validate a single link
     * Matches Symfony's validation logic in getBrokenLinks
     * @param url URL to validate
     * @param filesDir Base directory for internal files
     * @returns Error message if broken, null if valid
     */
    async validateLink(url: string, filesDir: string): Promise<string | null> {
        // Check for exe-node: internal page links
        if (url.startsWith('exe-node:')) {
            // These link to internal pages - frontend should validate
            // For now, consider them valid (Symfony checked DB)
            return null;
        }

        // Check for internal file links (files/...)
        // Matches Symfony's isInternalLink: Constants::FILES_DIR_NAME == substr($link, 0, 5)
        if (url.startsWith('files/') || url.startsWith('files\\')) {
            return this.validateInternalFile(url, filesDir);
        }

        // Skip relative URLs that aren't files/ (likely assets)
        if (
            !url.startsWith('http://') &&
            !url.startsWith('https://') &&
            !url.startsWith('//')
        ) {
            // Relative URLs like "../images/foo.png" - assume valid
            return null;
        }

        // External link - validate with HTTP request
        // Matches Symfony's sendCurlHttpRequest
        return this.validateExternalLink(url);
    }

    /**
     * Validate an internal file exists
     * Matches Symfony's getInternalFileHttpResponse
     */
    private async validateInternalFile(url: string, filesDir: string): Promise<string | null> {
        try {
            // Remove "files/" prefix (Symfony: substr($internalLinkSource, 6))
            const relativePath = url.substring(6);
            const fullPath = path.join(filesDir, relativePath);

            if (await fs.pathExists(fullPath)) {
                return null;
            }
            // Matches Symfony: DefaultApiController::STATUS_CODE_NOT_FOUND
            return '404';
        } catch (error) {
            this.logger.warn(`Error checking internal file ${url}: ${error.message}`);
            return '500';
        }
    }

    /**
     * Validate an external link with HTTP request
     * Matches Symfony's sendCurlHttpRequest
     */
    private async validateExternalLink(url: string): Promise<string | null> {
        try {
            // Normalize URL
            let normalizedUrl = url;
            if (url.startsWith('//')) {
                normalizedUrl = 'https:' + url;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.HTTP_TIMEOUT);

            try {
                // First try HEAD request (lighter)
                let response = await fetch(normalizedUrl, {
                    method: 'HEAD',
                    signal: controller.signal,
                    redirect: 'follow',
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                });

                clearTimeout(timeoutId);

                // If HEAD returns 405, try GET
                if (response.status === 405) {
                    const controller2 = new AbortController();
                    const timeoutId2 = setTimeout(() => controller2.abort(), this.HTTP_TIMEOUT);

                    response = await fetch(normalizedUrl, {
                        method: 'GET',
                        signal: controller2.signal,
                        redirect: 'follow',
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            Range: 'bytes=0-0',
                        },
                    });

                    clearTimeout(timeoutId2);
                }

                // 301 is not considered broken (matches Symfony)
                if (response.status === this.STATUS_CODE_MOVED_PERMANENTLY) {
                    return null;
                }

                // 200-299 are OK
                if (response.ok) {
                    return null;
                }

                // Return status code as error (matches Symfony behavior)
                return String(response.status);
            } catch (fetchError: any) {
                clearTimeout(timeoutId);

                if (fetchError.name === 'AbortError') {
                    return 'Timeout';
                }

                // Network errors - match Symfony's curl_errno handling
                const cause = fetchError.cause;
                if (cause?.code === 'ENOTFOUND') {
                    // Matches Symfony's curl_errno(6) - Could not resolve host
                    return 'Could not resolve host';
                }
                if (cause?.code === 'ECONNREFUSED') {
                    return 'Connection refused';
                }
                if (cause?.code === 'CERT_HAS_EXPIRED' || cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                    return 'SSL error';
                }

                // Generic error (matches Symfony's curl_error)
                return fetchError.message || 'Network error';
            }
        } catch (error: any) {
            this.logger.warn(`Error validating external link ${url}: ${error.message}`);
            // Matches Symfony's CURL_ERROR_3
            return 'URL using bad/illegal format or missing URL';
        }
    }
}
