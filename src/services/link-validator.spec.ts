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
    type ExtractedLink,
    type RawExtractedLink,
    type IdeviceContent,
} from './link-validator';

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
            // Use a domain that definitely doesn't exist
            const result = await validateLink('https://this-domain-definitely-does-not-exist-12345.com', {
                filesDir: tempDir,
                timeout: 5000,
            });
            expect(result).toBeTruthy(); // Should return an error
        });

        it('should handle protocol-relative URLs', async () => {
            // This will try to validate //example.com as https://example.com
            const result = await validateLink('//this-domain-definitely-does-not-exist-12345.com', {
                filesDir: tempDir,
                timeout: 5000,
            });
            expect(result).toBeTruthy(); // Should return an error
        });

        it('should return 500 for file validation errors', async () => {
            // Pass null filesDir to trigger error in path.join
            const result = await validateLink('files/test.jpg', {
                filesDir: null as unknown as string,
            });
            expect(result).toBe('500');
        });

        it('should handle 301 redirects as valid', async () => {
            // Mock fetch to return 301
            const originalFetch = globalThis.fetch;
            globalThis.fetch = async () =>
                ({
                    status: 301,
                    ok: false,
                }) as Response;

            try {
                const result = await validateLink('https://example.com/redirect', {
                    filesDir: tempDir,
                    timeout: 5000,
                });
                expect(result).toBeNull(); // 301 is considered valid
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('should fallback to GET with Range header when HEAD returns 405', async () => {
            // Mock fetch to return 405 on HEAD, then 200 on GET
            const originalFetch = globalThis.fetch;
            let callCount = 0;
            globalThis.fetch = async (url: string, options?: RequestInit) => {
                callCount++;
                if (options?.method === 'HEAD') {
                    return { status: 405, ok: false } as Response;
                }
                // GET request with Range header
                expect(options?.method).toBe('GET');
                expect(options?.headers).toHaveProperty('Range', 'bytes=0-0');
                return { status: 200, ok: true } as Response;
            };

            try {
                const result = await validateLink('https://example.com/head-not-allowed', {
                    filesDir: tempDir,
                    timeout: 5000,
                });
                expect(result).toBeNull(); // Should be valid after GET fallback
                expect(callCount).toBe(2); // HEAD then GET
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('should return error when GET fallback also fails', async () => {
            // Mock fetch to return 405 on HEAD, then 404 on GET
            const originalFetch = globalThis.fetch;
            globalThis.fetch = async (_url: string, options?: RequestInit) => {
                if (options?.method === 'HEAD') {
                    return { status: 405, ok: false } as Response;
                }
                return { status: 404, ok: false } as Response;
            };

            try {
                const result = await validateLink('https://example.com/not-found', {
                    filesDir: tempDir,
                    timeout: 5000,
                });
                expect(result).toBe('404');
            } finally {
                globalThis.fetch = originalFetch;
            }
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
