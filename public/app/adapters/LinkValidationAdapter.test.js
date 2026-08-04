/**
 * LinkValidationAdapter Tests
 *
 * Unit tests for the client-side link validation adapter.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LinkValidationAdapter from './LinkValidationAdapter.js';

describe('LinkValidationAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new LinkValidationAdapter();

        // Mock global _ (translation function)
        global._ = vi.fn((str) => str);

        // Mock window.eXeLearning
        global.window = {
            eXeLearning: {
                app: {
                    project: {
                        _yjsBridge: null,
                    },
                },
            },
        };
        global.eXeLearning = global.window.eXeLearning;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete global._;
        delete global.window;
        delete global.eXeLearning;
    });

    describe('extractLinks', () => {
        it('should return empty links array for empty idevices', () => {
            const result = adapter.extractLinks({ idevices: [] });

            expect(result.responseMessage).toBe('OK');
            expect(result.links).toEqual([]);
            expect(result.totalLinks).toBe(0);
        });

        it('should extract href links from HTML', () => {
            const idevices = [
                {
                    html: '<a href="https://example.com">Link</a>',
                    pageName: 'Page 1',
                    blockName: 'Block 1',
                    ideviceType: 'text',
                    order: 0,
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(1);
            expect(result.links[0].url).toBe('https://example.com');
            expect(result.links[0].pageName).toBe('Page 1');
            expect(result.links[0].blockName).toBe('Block 1');
            expect(result.links[0].ideviceType).toBe('text');
        });

        it('should extract src links from HTML', () => {
            const idevices = [
                {
                    html: '<img src="https://example.com/image.png"/>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(1);
            expect(result.links[0].url).toBe('https://example.com/image.png');
        });

        it('should NOT extract asset:// URLs (internal)', () => {
            const idevices = [
                {
                    html: '<img src="asset://abc123-def4-5678-90ab-cdef12345678"/>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should NOT extract files/ URLs (internal)', () => {
            const idevices = [
                {
                    html: '<img src="files/images/photo.jpg"/>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should skip exe-node: URLs (internal page links)', () => {
            const idevices = [
                {
                    html: '<a href="exe-node:page1">Link</a>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should skip anchor links (#)', () => {
            const idevices = [
                {
                    html: '<a href="#section1">Link</a>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should skip javascript: URLs', () => {
            const idevices = [
                {
                    html: '<a href="javascript:void(0)">Link</a>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should skip data: URLs', () => {
            const idevices = [
                {
                    html: '<img src="data:image/png;base64,abc123"/>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should count duplicate URLs', () => {
            const idevices = [
                {
                    html: '<a href="https://example.com">Link 1</a><a href="https://example.com">Link 2</a>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(1);
            expect(result.links[0].count).toBe(2);
        });

        it('should handle multiple idevices', () => {
            const idevices = [
                {
                    html: '<a href="https://a.com">A</a>',
                    pageName: 'Page 1',
                },
                {
                    html: '<a href="https://b.com">B</a>',
                    pageName: 'Page 2',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(2);
        });

        it('should skip idevices without html', () => {
            const idevices = [
                { pageName: 'Page 1' },
                { html: null, pageName: 'Page 2' },
                { html: '', pageName: 'Page 3' },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(0);
        });

        it('should handle protocol-relative URLs (//)', () => {
            const idevices = [
                {
                    html: '<img src="//cdn.example.com/image.png"/>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links.length).toBe(1);
            expect(result.links[0].url).toBe('//cdn.example.com/image.png');
        });

        it('should generate unique IDs for each link', () => {
            const idevices = [
                {
                    html: '<a href="https://a.com">A</a><a href="https://b.com">B</a>',
                    pageName: 'Page 1',
                },
            ];

            const result = adapter.extractLinks({ idevices });

            expect(result.links[0].id).toBeDefined();
            expect(result.links[1].id).toBeDefined();
            expect(result.links[0].id).not.toBe(result.links[1].id);
        });
    });

    describe('getValidationStreamUrl', () => {
        it('should return null for client-side validation', () => {
            const result = adapter.getValidationStreamUrl();

            expect(result).toBeNull();
        });
    });

    describe('validateLink', () => {
        describe('internal URLs (skip validation)', () => {
            it('should mark exe-node: URLs as valid without validation', async () => {
                const result = await adapter.validateLink('exe-node:page1');

                expect(result.status).toBe('valid');
                expect(result.error).toBeNull();
            });

            it('should mark asset:// URLs as valid without validation', async () => {
                const result = await adapter.validateLink('asset://abc123-def456');

                expect(result.status).toBe('valid');
                expect(result.error).toBeNull();
            });

            it('should mark files/ URLs as valid without validation', async () => {
                const result = await adapter.validateLink('files/image.png');

                expect(result.status).toBe('valid');
                expect(result.error).toBeNull();
            });
        });

        describe('external URLs in a plain browser (static web flavor)', () => {
            /**
             * A cross-origin response is opaque under CORS, so the browser cannot
             * tell a 200 from a 404 — a live YouTube channel and a deleted one look
             * identical (issue #2207, review of PR #2208 by @ignaciogros). No probe
             * can improve on that, so the adapter performs no network traffic at
             * all and reports every external link as needing a manual review.
             */
            it('should report external URLs as needing manual review without fetching', async () => {
                global.fetch = vi.fn();

                const result = await adapter.validateLink('https://www.youtube.com/@thisisjustanexample');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Not checked automatically: open the link to review it');
                expect(global.fetch).not.toHaveBeenCalled();
            });

            it('should never claim an external URL is valid', async () => {
                const result = await adapter.validateLink('https://example.com/does-not-exist');

                expect(result.status).toBe('unknown');
            });

            it('should treat protocol-relative URLs like any external URL', async () => {
                const result = await adapter.validateLink('//cdn.example.com/file.js');

                expect(result.status).toBe('unknown');
            });
        });

        describe('external URLs in the desktop app (Electron main-process check)', () => {
            let checkLink;

            beforeEach(() => {
                checkLink = vi.fn();
                global.window.electronAPI = { checkLink };
            });

            it('should report the main-process result for a valid link', async () => {
                checkLink.mockResolvedValue({ status: 'valid', error: null });

                const result = await adapter.validateLink('https://www.youtube.com/@bbc');

                expect(result).toEqual({ status: 'valid', error: null });
                expect(checkLink).toHaveBeenCalledWith('https://www.youtube.com/@bbc');
            });

            it('should report the main-process result for a broken link', async () => {
                checkLink.mockResolvedValue({ status: 'broken', error: '404' });

                const result = await adapter.validateLink('https://www.youtube.com/@thisisjustanexample');

                expect(result).toEqual({ status: 'broken', error: '404' });
            });

            it('should normalize protocol-relative URLs before delegating', async () => {
                checkLink.mockResolvedValue({ status: 'valid', error: null });

                await adapter.validateLink('//cdn.example.com/file.js');

                expect(checkLink).toHaveBeenCalledWith('https://cdn.example.com/file.js');
            });

            it('should fall back to manual review when the IPC call fails', async () => {
                checkLink.mockRejectedValue(new Error('IPC channel not available'));

                const result = await adapter.validateLink('https://example.com');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Not checked automatically: open the link to review it');
            });

            it('should fall back to manual review on a malformed IPC result', async () => {
                checkLink.mockResolvedValue({ status: 'weird' });

                const result = await adapter.validateLink('https://example.com');

                expect(result.status).toBe('unknown');
            });

            it('should explain when the main process refused a local/private address', async () => {
                checkLink.mockResolvedValue({ status: 'unknown', reason: 'private-address', error: null });

                const result = await adapter.validateLink('http://192.168.1.1/admin');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Local or private address: open the link to review it manually');
            });

            it('should explain a cross-host redirect (consent gates, shorteners) with the final host', async () => {
                checkLink.mockResolvedValue({
                    status: 'unknown',
                    reason: 'cross-host-redirect',
                    detail: 'consent.youtube.com',
                    error: null,
                });

                const result = await adapter.validateLink('https://www.youtube.com/@bbc');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe(
                    'Redirects to another site — open the link to verify it (consent.youtube.com)',
                );
            });

            it('should explain a 2xx that could only be obtained through the system proxy', async () => {
                checkLink.mockResolvedValue({ status: 'unknown', reason: 'unverified-proxy', error: null });

                const result = await adapter.validateLink('https://example.com');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Could not be fully verified: open the link to confirm it');
            });

            it('should explain an unresolved redirect', async () => {
                checkLink.mockResolvedValue({ status: 'unknown', reason: 'unresolved-redirect', error: null });

                const result = await adapter.validateLink('https://example.com/moved');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Redirects could not be followed: open the link to review it');
            });

            it('should use the generic review message for unknown results without a reason', async () => {
                checkLink.mockResolvedValue({ status: 'unknown', error: null });

                const result = await adapter.validateLink('https://example.com');

                expect(result.status).toBe('unknown');
                expect(result.error).toBe('Not checked automatically: open the link to review it');
            });

            it('should not delegate internal URLs to the main process', async () => {
                const result = await adapter.validateLink('exe-node:page1');

                expect(result.status).toBe('valid');
                expect(checkLink).not.toHaveBeenCalled();
            });
        });

        describe('other URLs', () => {
            it('should mark relative URLs as valid (not validated)', async () => {
                const result = await adapter.validateLink('images/photo.jpg');

                expect(result.status).toBe('valid');
            });
        });
    });

    describe('_generateUUID', () => {
        it('should generate valid UUID format', () => {
            const uuid = adapter._generateUUID();

            // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set();
            for (let i = 0; i < 100; i++) {
                uuids.add(adapter._generateUUID());
            }
            expect(uuids.size).toBe(100);
        });
    });

    describe('private extraction methods', () => {
        describe('_extractLinksFromHtml', () => {
            it('should extract href and src attributes', () => {
                const html = '<a href="link1">A</a><img src="img1"/>';
                const links = adapter._extractLinksFromHtml(html);

                expect(links.length).toBe(2);
                expect(links[0].url).toBe('link1');
                expect(links[1].url).toBe('img1');
            });

            it('should handle empty HTML', () => {
                expect(adapter._extractLinksFromHtml('')).toEqual([]);
                expect(adapter._extractLinksFromHtml(null)).toEqual([]);
            });
        });

        describe('_cleanAndCountLinks', () => {
            it('should count duplicate URLs', () => {
                const links = [
                    { url: 'a', count: 1 },
                    { url: 'a', count: 1 },
                    { url: 'b', count: 1 },
                ];
                const result = adapter._cleanAndCountLinks(links);

                expect(result.length).toBe(2);
                expect(result.find((l) => l.url === 'a').count).toBe(2);
                expect(result.find((l) => l.url === 'b').count).toBe(1);
            });

            it('should clean quotes from URLs', () => {
                const links = [{ url: '"quoted"', count: 1 }];
                const result = adapter._cleanAndCountLinks(links);

                expect(result[0].url).toBe('quoted');
            });
        });

        describe('_removeInvalidLinks', () => {
            it('should filter out invalid URLs', () => {
                const links = [
                    { url: 'https://valid.com', count: 1 },
                    { url: '', count: 1 },
                    { url: '#anchor', count: 1 },
                    { url: 'javascript:void(0)', count: 1 },
                    { url: 'data:image/png;base64,abc', count: 1 },
                ];
                const result = adapter._removeInvalidLinks(links);

                expect(result.length).toBe(1);
                expect(result[0].url).toBe('https://valid.com');
            });
        });

        describe('_deduplicateLinks', () => {
            it('should keep link with highest count', () => {
                const links = [
                    { url: 'a', count: 1 },
                    { url: 'a', count: 3 },
                    { url: 'a', count: 2 },
                ];
                const result = adapter._deduplicateLinks(links);

                expect(result.length).toBe(1);
                expect(result[0].count).toBe(3);
            });
        });

        describe('_shouldValidateLink', () => {
            it('should return true for external URLs', () => {
                expect(adapter._shouldValidateLink('https://example.com')).toBe(true);
                expect(adapter._shouldValidateLink('http://example.com')).toBe(true);
                expect(adapter._shouldValidateLink('//cdn.example.com')).toBe(true);
            });

            it('should return false for internal URLs', () => {
                expect(adapter._shouldValidateLink('exe-node:page1')).toBe(false);
                expect(adapter._shouldValidateLink('asset://abc123')).toBe(false);
                expect(adapter._shouldValidateLink('files/image.png')).toBe(false);
                expect(adapter._shouldValidateLink('relative/path.html')).toBe(false);
            });
        });
    });
});
