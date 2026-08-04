import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import {
    extractLinksFromHtml,
    cleanAndCountLinks,
    removeInvalidLinks,
    deduplicateLinks,
    shouldValidateLink,
    extractLinksFromIdevices,
    validateLink,
    validateLinkWithResult,
    validateLinksStream,
    toBrokenLinkInfo,
    classifyHttpStatus,
    type ExtractedLink,
    type RawExtractedLink,
    type IdeviceContent,
} from './link-validator';
import type { LookupFn } from '../utils/ssrf-guard';

// A DNS resolver that maps any host to a single public IP, so the SSRF guard
// allows the request and control reaches the (mocked) fetch. Keeps tests
// hermetic: no real DNS or network is touched.
const publicLookup: LookupFn = async () => [{ address: '93.184.216.34' }];

// Helper to build a minimal Response-like mock that includes a working
// `headers.get()` so safeFetch can inspect the Location header. Pass a
// `location` to simulate a redirect hop.
function mockResponse(init: { status: number; ok: boolean; location?: string }): Response {
    const headers = new Headers();
    if (init.location) {
        headers.set('location', init.location);
    }
    return { status: init.status, ok: init.ok, headers } as Response;
}

describe('Link Validator Service', () => {
    describe('extractLinksFromHtml', () => {
        it('should extract href links from HTML', () => {
            const html = '<a href="https://example.com">Link</a>';
            const links = extractLinksFromHtml(html);
            expect(links).toHaveLength(1);
            expect(links[0].url).toBe('https://example.com');
            expect(links[0].count).toBe(1);
        });

        it('should extract src links from HTML', () => {
            const html = '<img src="files/image.jpg">';
            const links = extractLinksFromHtml(html);
            expect(links).toHaveLength(1);
            expect(links[0].url).toBe('files/image.jpg');
        });

        it('should extract multiple links', () => {
            const html = `
                <a href="https://google.com">Google</a>
                <img src="files/pic.png">
                <a href="https://github.com">GitHub</a>
            `;
            const links = extractLinksFromHtml(html);
            expect(links).toHaveLength(3);
        });

        it('should return empty array for null/empty HTML', () => {
            expect(extractLinksFromHtml('')).toHaveLength(0);
            expect(extractLinksFromHtml(null as unknown as string)).toHaveLength(0);
        });

        it('should handle HTML with no links', () => {
            const html = '<p>Hello World</p>';
            const links = extractLinksFromHtml(html);
            expect(links).toHaveLength(0);
        });
    });

    describe('cleanAndCountLinks', () => {
        it('should count duplicate URLs', () => {
            const links: RawExtractedLink[] = [
                { url: 'https://example.com', count: 1 },
                { url: 'https://example.com', count: 1 },
                { url: 'https://google.com', count: 1 },
            ];
            const result = cleanAndCountLinks(links);
            expect(result).toHaveLength(2);
            const exampleLink = result.find(l => l.url === 'https://example.com');
            expect(exampleLink?.count).toBe(2);
        });

        it('should remove quotes from URLs', () => {
            const links: RawExtractedLink[] = [{ url: 'https://example.com"', count: 1 }];
            const result = cleanAndCountLinks(links);
            expect(result[0].url).toBe('https://example.com');
        });
    });

    describe('removeInvalidLinks', () => {
        it('should remove empty URLs', () => {
            const links: RawExtractedLink[] = [
                { url: '', count: 1 },
                { url: '   ', count: 1 },
                { url: 'https://example.com', count: 1 },
            ];
            const result = removeInvalidLinks(links);
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://example.com');
        });

        it('should remove anchor links', () => {
            const links: RawExtractedLink[] = [
                { url: '#section1', count: 1 },
                { url: '#', count: 1 },
                { url: 'https://example.com#anchor', count: 1 },
            ];
            const result = removeInvalidLinks(links);
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://example.com#anchor');
        });

        it('should remove javascript: links', () => {
            const links: RawExtractedLink[] = [
                { url: 'javascript:void(0)', count: 1 },
                { url: 'javascript:alert("hi")', count: 1 },
            ];
            const result = removeInvalidLinks(links);
            expect(result).toHaveLength(0);
        });

        it('should remove data: URLs', () => {
            const links: RawExtractedLink[] = [
                { url: 'data:image/png;base64,abc123', count: 1 },
                { url: 'data:text/html,<h1>Hi</h1>', count: 1 },
            ];
            const result = removeInvalidLinks(links);
            expect(result).toHaveLength(0);
        });
    });

    describe('deduplicateLinks', () => {
        it('should keep link with highest count', () => {
            const links: RawExtractedLink[] = [
                { url: 'https://example.com', count: 2 },
                { url: 'https://example.com', count: 5 },
                { url: 'https://example.com', count: 3 },
            ];
            const result = deduplicateLinks(links);
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(5);
        });

        it('should keep all unique URLs', () => {
            const links: RawExtractedLink[] = [
                { url: 'https://a.com', count: 1 },
                { url: 'https://b.com', count: 2 },
                { url: 'https://c.com', count: 3 },
            ];
            const result = deduplicateLinks(links);
            expect(result).toHaveLength(3);
        });
    });

    describe('shouldValidateLink', () => {
        it('should return false for exe-node: links', () => {
            expect(shouldValidateLink('exe-node:page-123')).toBe(false);
            expect(shouldValidateLink('exe-node:some-id')).toBe(false);
        });

        it('should return true for files/ links', () => {
            expect(shouldValidateLink('files/image.jpg')).toBe(true);
            expect(shouldValidateLink('files/docs/file.pdf')).toBe(true);
            expect(shouldValidateLink('files\\image.jpg')).toBe(true);
        });

        it('should return true for HTTP(S) links', () => {
            expect(shouldValidateLink('https://example.com')).toBe(true);
            expect(shouldValidateLink('http://example.com')).toBe(true);
            expect(shouldValidateLink('//example.com')).toBe(true);
        });

        it('should return false for relative URLs', () => {
            expect(shouldValidateLink('images/pic.jpg')).toBe(false);
            expect(shouldValidateLink('../other/file.html')).toBe(false);
            expect(shouldValidateLink('page.html')).toBe(false);
        });
    });

    describe('extractLinksFromIdevices', () => {
        it('should extract links from multiple idevices', () => {
            const idevices: IdeviceContent[] = [
                {
                    html: '<a href="https://google.com">Google</a>',
                    pageName: 'Page 1',
                    blockName: 'Block 1',
                    ideviceType: 'text',
                    order: 1,
                },
                {
                    html: '<img src="files/image.jpg">',
                    pageName: 'Page 2',
                    blockName: 'Block 2',
                    ideviceType: 'image',
                    order: 2,
                },
            ];

            const links = extractLinksFromIdevices(idevices);
            expect(links).toHaveLength(2);

            expect(links[0].url).toBe('https://google.com');
            expect(links[0].pageName).toBe('Page 1');
            expect(links[0].ideviceType).toBe('text');

            expect(links[1].url).toBe('files/image.jpg');
            expect(links[1].pageName).toBe('Page 2');
        });

        it('should skip exe-node: links', () => {
            const idevices: IdeviceContent[] = [
                {
                    html: '<a href="exe-node:page-123">Internal</a><a href="https://external.com">External</a>',
                    pageName: 'Page 1',
                },
            ];

            const links = extractLinksFromIdevices(idevices);
            expect(links).toHaveLength(1);
            expect(links[0].url).toBe('https://external.com');
        });

        it('should generate unique IDs for each link', () => {
            const idevices: IdeviceContent[] = [{ html: '<a href="https://a.com">A</a><a href="https://b.com">B</a>' }];

            const links = extractLinksFromIdevices(idevices);
            expect(links[0].id).toBeDefined();
            expect(links[1].id).toBeDefined();
            expect(links[0].id).not.toBe(links[1].id);
        });

        it('should handle empty idevices array', () => {
            const links = extractLinksFromIdevices([]);
            expect(links).toHaveLength(0);
        });

        it('should skip idevices without HTML', () => {
            const idevices: IdeviceContent[] = [
                { html: '', pageName: 'Page 1' },
                { html: '<a href="https://example.com">Link</a>', pageName: 'Page 2' },
            ];

            const links = extractLinksFromIdevices(idevices);
            expect(links).toHaveLength(1);
        });
    });

    describe('validateLink', () => {
        const tempDir = '/tmp/test-link-validator';

        beforeEach(async () => {
            await fs.ensureDir(tempDir);
            await fs.writeFile(`${tempDir}/existing-file.jpg`, 'test content');
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        it('should return null for exe-node: links (always valid)', async () => {
            const result = await validateLink('exe-node:page-123', { filesDir: tempDir });
            expect(result).toBeNull();
        });

        it('should return null for existing internal files', async () => {
            const result = await validateLink('files/existing-file.jpg', { filesDir: tempDir });
            expect(result).toBeNull();
        });

        it('should return 404 for missing internal files', async () => {
            const result = await validateLink('files/nonexistent.jpg', { filesDir: tempDir });
            expect(result).toBe('404');
        });

        it('should return null for relative URLs (skip validation)', async () => {
            const result = await validateLink('images/pic.jpg', { filesDir: tempDir });
            expect(result).toBeNull();
        });

        it('should validate HTTP links and return error for broken ones', async () => {
            // Deterministic: avoid relying on real DNS/network (can be hijacked in some environments).
            const originalFetch = globalThis.fetch;
            globalThis.fetch = async () => {
                const err = new Error('getaddrinfo ENOTFOUND') as Error & { cause?: { code?: string } };
                err.cause = { code: 'ENOTFOUND' };
                throw err;
            };

            try {
                const result = await validateLink('https://this-domain-definitely-does-not-exist-12345.com', {
                    filesDir: tempDir,
                    timeout: 5000,
                    // Resolve to a public IP so the SSRF guard allows the host and
                    // control reaches the (mocked) fetch which throws ENOTFOUND.
                    lookupFn: publicLookup,
                });
                expect(result).toBe('Could not resolve host');
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('should handle protocol-relative URLs', async () => {
            // Deterministic: avoid relying on real DNS/network (can be hijacked in some environments).
            const originalFetch = globalThis.fetch;
            globalThis.fetch = async () => {
                const err = new Error('getaddrinfo ENOTFOUND') as Error & { cause?: { code?: string } };
                err.cause = { code: 'ENOTFOUND' };
                throw err;
            };

            try {
                // This will normalize //... to https://...
                const result = await validateLink('//this-domain-definitely-does-not-exist-12345.com', {
                    filesDir: tempDir,
                    timeout: 5000,
                    lookupFn: publicLookup,
                });
                expect(result).toBe('Could not resolve host');
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('should return 500 for file validation errors', async () => {
            // Pass null filesDir to trigger error in path.join
            const result = await validateLink('files/test.jpg', {
                filesDir: null as unknown as string,
            });
            expect(result).toBe('500');
        });

        it('should handle 301 redirects as valid', async () => {
            // A 301 with no Location header is returned by safeFetch as-is (not
            // treated as a redirect to follow), so validateLink sees status 301.
            // Inject fetchImpl + a public lookup to stay hermetic.
            const fetchImpl = (async () => mockResponse({ status: 301, ok: false })) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/redirect', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBeNull(); // 301 is considered valid
        });

        it('should validate with a single ranged GET using browser-like headers', async () => {
            // No HEAD phase: too many hosts reject, lie about or hang on HEAD
            // (educa.madrid answers HEAD with 404 while GET has the real status).
            let callCount = 0;
            const fetchImpl = (async (_url: string, options?: RequestInit) => {
                callCount++;
                expect(options?.method).toBe('GET');
                expect(options?.headers).toMatchObject({ Range: 'bytes=0-0' });
                expect(options?.headers).toHaveProperty('User-Agent');
                return mockResponse({ status: 200, ok: true });
            }) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/page', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBeNull();
            expect(callCount).toBe(1);
        });

        it('should report the real status code on 404', async () => {
            const fetchImpl = (async () => mockResponse({ status: 404, ok: false })) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/not-found', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBe('404');
        });

        it('should treat 416 as valid (zero-length resource cannot satisfy bytes=0-0)', async () => {
            const fetchImpl = (async () => mockResponse({ status: 416, ok: false })) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/empty-file', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBeNull();
        });

        it('should cancel the response body without reading it', async () => {
            let cancelled = false;
            const fetchImpl = (async () => ({
                ...mockResponse({ status: 200, ok: true }),
                body: {
                    cancel: async () => {
                        cancelled = true;
                    },
                },
            })) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/big-file', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBeNull();
            expect(cancelled).toBe(true);
        });

        it('should report Timeout when the request times out', async () => {
            const fetchImpl = (async () => {
                const abortError = new Error('The operation was aborted');
                abortError.name = 'AbortError';
                throw abortError;
            }) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/slow', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBe('Timeout');
        });

        it('should report a broken URL when the request fails with a network error', async () => {
            const fetchImpl = (async () => {
                throw new Error('The socket connection was closed unexpectedly');
            }) as unknown as typeof fetch;

            const result = await validateLink('https://example.com/dead', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: publicLookup,
                fetchImpl,
            });
            expect(result).toBe('The socket connection was closed unexpectedly');
        });

        it('should block a host that resolves to a private/loopback address (SSRF guard)', async () => {
            // lookupFn maps the public-looking host to a loopback address. The
            // guard must reject it before any fetch is attempted.
            let fetchCalled = false;
            const fetchImpl = (async () => {
                fetchCalled = true;
                return mockResponse({ status: 200, ok: true });
            }) as unknown as typeof fetch;
            const loopbackLookup: LookupFn = async () => [{ address: '127.0.0.1' }];

            const result = await validateLink('https://internal.example.com/secret', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: loopbackLookup,
                fetchImpl,
            });

            // Broken, not null — and a generic message that does not leak the IP.
            expect(result).toBe('Blocked address');
            expect(result).not.toContain('127.0.0.1');
            expect(fetchCalled).toBe(false);
        });

        it('should block a cloud-metadata IP literal (169.254.169.254)', async () => {
            // IP literal: the guard checks it directly without DNS.
            let fetchCalled = false;
            const fetchImpl = (async () => {
                fetchCalled = true;
                return mockResponse({ status: 200, ok: true });
            }) as unknown as typeof fetch;

            const result = await validateLink('http://169.254.169.254/latest/meta-data/', {
                filesDir: tempDir,
                timeout: 5000,
                fetchImpl,
            });

            expect(result).toBe('Blocked address');
            expect(fetchCalled).toBe(false);
        });

        it('should block a redirect from a public host to an internal host', async () => {
            // First hop resolves public and returns a 302 to an internal host;
            // safeFetch re-validates the next hop (resolved to loopback) and blocks.
            const fetchImpl = (async () =>
                mockResponse({
                    status: 302,
                    ok: false,
                    location: 'http://internal.example.com/admin',
                })) as unknown as typeof fetch;
            const redirectLookup: LookupFn = async hostname =>
                hostname === 'internal.example.com' ? [{ address: '127.0.0.1' }] : [{ address: '93.184.216.34' }];

            const result = await validateLink('https://public.example.com/go', {
                filesDir: tempDir,
                timeout: 5000,
                lookupFn: redirectLookup,
                fetchImpl,
            });

            expect(result).toBe('Blocked address');
        });
    });

    describe('validateLinkWithResult', () => {
        const tempDir = '/tmp/test-link-validator-result';

        beforeEach(async () => {
            await fs.ensureDir(tempDir);
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        it('should return valid status for exe-node links', async () => {
            const link: ExtractedLink = {
                id: 'test-id',
                url: 'exe-node:page-123',
                count: 1,
                pageName: 'Page 1',
                blockName: 'Block 1',
                ideviceType: 'text',
                order: '1',
            };

            const result = await validateLinkWithResult(link, { filesDir: tempDir });
            expect(result.id).toBe('test-id');
            expect(result.url).toBe('exe-node:page-123');
            expect(result.status).toBe('valid');
            expect(result.error).toBeNull();
        });

        it('should return broken status for missing files', async () => {
            const link: ExtractedLink = {
                id: 'test-id',
                url: 'files/missing.jpg',
                count: 1,
                pageName: 'Page 1',
                blockName: 'Block 1',
                ideviceType: 'text',
                order: '1',
            };

            const result = await validateLinkWithResult(link, { filesDir: tempDir });
            expect(result.status).toBe('broken');
            expect(result.error).toBe('404');
        });
    });

    describe('validateLinksStream', () => {
        const tempDir = '/tmp/test-link-validator-stream';

        beforeEach(async () => {
            await fs.ensureDir(tempDir);
            await fs.writeFile(`${tempDir}/file1.jpg`, 'content');
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        it('should yield results for each link', async () => {
            const links: ExtractedLink[] = [
                { id: '1', url: 'exe-node:page-1', count: 1, pageName: '', blockName: '', ideviceType: '', order: '' },
                { id: '2', url: 'files/file1.jpg', count: 1, pageName: '', blockName: '', ideviceType: '', order: '' },
                {
                    id: '3',
                    url: 'files/missing.jpg',
                    count: 1,
                    pageName: '',
                    blockName: '',
                    ideviceType: '',
                    order: '',
                },
            ];

            const results: { id: string; status: string }[] = [];
            for await (const result of validateLinksStream(links, { filesDir: tempDir, batchSize: 2 })) {
                results.push({ id: result.id, status: result.status });
            }

            expect(results).toHaveLength(3);
            expect(results.find(r => r.id === '1')?.status).toBe('valid');
            expect(results.find(r => r.id === '2')?.status).toBe('valid');
            expect(results.find(r => r.id === '3')?.status).toBe('broken');
        });

        it('should process links in batches', async () => {
            const links: ExtractedLink[] = Array.from({ length: 7 }, (_, i) => ({
                id: String(i),
                url: 'exe-node:page',
                count: 1,
                pageName: '',
                blockName: '',
                ideviceType: '',
                order: '',
            }));

            const results: string[] = [];
            for await (const result of validateLinksStream(links, { filesDir: tempDir, batchSize: 3 })) {
                results.push(result.id);
            }

            // All 7 links should be processed
            expect(results).toHaveLength(7);
        });
    });

    describe('classifyHttpStatus', () => {
        it('should treat 2xx and 3xx as valid', () => {
            expect(classifyHttpStatus(200)).toBeNull();
            expect(classifyHttpStatus(204)).toBeNull();
            expect(classifyHttpStatus(301)).toBeNull();
            expect(classifyHttpStatus(302)).toBeNull();
            expect(classifyHttpStatus(303)).toBeNull();
        });

        it('should treat 416 as valid (zero-length resource cannot satisfy bytes=0-0)', () => {
            expect(classifyHttpStatus(416)).toBeNull();
        });

        it('should report 4xx/5xx as the status string', () => {
            expect(classifyHttpStatus(404)).toBe('404');
            expect(classifyHttpStatus(500)).toBe('500');
        });
    });

    describe('toBrokenLinkInfo', () => {
        it('should convert ExtractedLink to BrokenLinkInfo format', () => {
            const link: ExtractedLink = {
                id: 'test-id',
                url: 'https://broken.com',
                count: 3,
                pageName: 'Page 1',
                blockName: 'Block 1',
                ideviceType: 'text',
                order: '2',
            };

            const result = toBrokenLinkInfo(link, '404');

            expect(result.brokenLinks).toBe('https://broken.com');
            expect(result.nTimesBrokenLinks).toBe(3);
            expect(result.brokenLinksError).toBe('404');
            expect(result.pageNamesBrokenLinks).toBe('Page 1');
            expect(result.blockNamesBrokenLinks).toBe('Block 1');
            expect(result.typeComponentSyncBrokenLinks).toBe('text');
            expect(result.orderComponentSyncBrokenLinks).toBe('2');
        });
    });
});
