import { describe, expect, it, mock } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    BROWSER_HEADERS,
    checkExternalLink,
    checkLink,
    classifyHttpStatus,
    isPrivateAddress,
    resolvesToPrivateAddress,
} = require('./link-check');

// undici reports the final URL after redirect: 'follow'; same-origin unless stated.
const response = (status: number, url?: string) => ({ status, url });

describe('link-check', () => {
    describe('classifyHttpStatus', () => {
        it('treats 2xx and 3xx as valid', () => {
            expect(classifyHttpStatus(200)).toBeNull();
            expect(classifyHttpStatus(204)).toBeNull();
            expect(classifyHttpStatus(206)).toBeNull();
            expect(classifyHttpStatus(301)).toBeNull();
        });

        it('treats 416 as valid (zero-length resource cannot satisfy bytes=0-0)', () => {
            expect(classifyHttpStatus(416)).toBeNull();
        });

        it('reports other statuses as the broken-link error', () => {
            expect(classifyHttpStatus(404)).toBe('404');
            expect(classifyHttpStatus(500)).toBe('500');
            expect(classifyHttpStatus(403)).toBe('403');
        });
    });

    describe('checkExternalLink', () => {
        it('sends a single ranged GET with browser-like headers', async () => {
            const fetchImpl = mock(async () => response(200, 'https://example.com/'));

            const result = await checkExternalLink('https://example.com', { fetchImpl });

            expect(result).toEqual({ status: 'valid', error: null });
            expect(fetchImpl).toHaveBeenCalledTimes(1);
            const [url, options] = fetchImpl.mock.calls[0];
            expect(url).toBe('https://example.com');
            expect(options.method).toBe('GET');
            expect(options.redirect).toBe('follow');
            expect(options.headers.Range).toBe('bytes=0-0');
            expect(options.headers['Accept-Encoding']).toBe('identity');
            expect(options.headers['User-Agent']).toBe(BROWSER_HEADERS['User-Agent']);
        });

        it('reports the real status code on 404', async () => {
            const fetchImpl = mock(async () => response(404, 'https://example.com/missing'));

            const result = await checkExternalLink('https://example.com/missing', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: '404' });
        });

        it('cancels the response body without reading it', async () => {
            const cancel = mock(async () => {});
            const fetchImpl = mock(async () => ({ status: 200, url: 'https://example.com/', body: { cancel } }));

            const result = await checkExternalLink('https://example.com', { fetchImpl });

            expect(result.status).toBe('valid');
            expect(cancel).toHaveBeenCalledTimes(1);
        });

        it('still classifies the status when cancelling the body throws', async () => {
            const fetchImpl = mock(async () => ({
                status: 404,
                url: 'https://example.com/missing',
                body: {
                    cancel: async () => {
                        throw new Error('stream locked');
                    },
                },
            }));

            const result = await checkExternalLink('https://example.com/missing', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: '404' });
        });

        describe('final-host rule (PR #2208 review: green must mean the requested host answered)', () => {
            it('flags a 2xx that landed on another host for manual review (consent gate)', async () => {
                const fetchImpl = mock(async () =>
                    response(200, 'https://consent.youtube.com/m?continue=https://www.youtube.com/@bbc'),
                );

                const result = await checkExternalLink('https://www.youtube.com/@bbc', { fetchImpl });

                expect(result.status).toBe('unknown');
                expect(result.reason).toBe('cross-host-redirect');
                expect(result.detail).toBe('consent.youtube.com');
            });

            it('reports an error status as broken even when it landed on another host', async () => {
                const fetchImpl = mock(async () => response(404, 'https://other.example.net/gone'));

                const result = await checkExternalLink('https://example.com/page', { fetchImpl });

                expect(result).toEqual({ status: 'broken', error: '404' });
            });

            it('accepts the resolved consent chain that returns to the requested host', async () => {
                // undici follows 302 → consent.youtube.com → 303 → back with
                // ?ucbcb=1: same host, real status (measured 2026-08-04, EU IP).
                const fetchImpl = mock(async () =>
                    response(404, 'https://www.youtube.com/@thisisjustanexample?cbrd=1&ucbcb=1'),
                );

                const result = await checkExternalLink('https://www.youtube.com/@thisisjustanexample', {
                    fetchImpl,
                });

                expect(result).toEqual({ status: 'broken', error: '404' });
            });

            it('ignores a www. prefix when comparing hosts', async () => {
                const fetchImpl = mock(async () => response(200, 'https://www.example.com/page'));

                const result = await checkExternalLink('https://example.com/page', { fetchImpl });

                expect(result).toEqual({ status: 'valid', error: null });
            });

            it('classifies by status alone when the final URL is unavailable', async () => {
                const fetchImpl = mock(async () => response(200, ''));

                const result = await checkExternalLink('https://example.com', { fetchImpl });

                expect(result).toEqual({ status: 'valid', error: null });
            });
        });

        it('flags an unresolved 3xx (no Location) for manual review, never as valid', async () => {
            const fetchImpl = mock(async () => response(301, 'https://example.com/moved'));

            const result = await checkExternalLink('https://example.com/moved', { fetchImpl });

            expect(result.status).toBe('unknown');
            expect(result.reason).toBe('unresolved-redirect');
        });

        it('reports a redirect loop as broken without retrying through the fallback stack', async () => {
            const loopError = new TypeError('fetch failed');
            (loopError as Error & { cause?: { message?: string } }).cause = {
                message: 'redirect count exceeded',
            };
            const fetchImpl = mock(async () => {
                throw loopError;
            });
            const fallbackFetchImpl = mock(async () => response(200, 'https://example.com/'));

            const result = await checkExternalLink('https://example.com', { fetchImpl, fallbackFetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'Too many redirects' });
            expect(fallbackFetchImpl).not.toHaveBeenCalled();
        });

        describe('system-proxy fallback (undici cannot use the OS proxy; net.fetch can)', () => {
            const connectionError = () => {
                const err = new TypeError('fetch failed');
                (err as Error & { cause?: { code?: string } }).cause = { code: 'ECONNREFUSED' };
                return err;
            };

            it('trusts an error status obtained through the fallback stack', async () => {
                const fetchImpl = mock(async () => {
                    throw connectionError();
                });
                const fallbackFetchImpl = mock(async () => response(404, ''));

                const result = await checkExternalLink('https://example.com', { fetchImpl, fallbackFetchImpl });

                expect(result).toEqual({ status: 'broken', error: '404' });
                expect(fallbackFetchImpl).toHaveBeenCalledTimes(1);
            });

            it('flags a 2xx obtained through the fallback stack for manual review (unverifiable host)', async () => {
                const fetchImpl = mock(async () => {
                    throw connectionError();
                });
                // net.fetch reports an empty response.url in Electron, so a 200
                // cannot be attributed to the requested host (consent walls
                // answer 200 too).
                const fallbackFetchImpl = mock(async () => response(200, ''));

                const result = await checkExternalLink('https://example.com', { fetchImpl, fallbackFetchImpl });

                expect(result.status).toBe('unknown');
                expect(result.reason).toBe('unverified-proxy');
            });

            it('retries through the fallback stack after a direct timeout (proxy-only networks drop SYNs)', async () => {
                const abortError = new Error('Aborted');
                abortError.name = 'AbortError';
                const fetchImpl = mock(async () => {
                    throw abortError;
                });
                const fallbackFetchImpl = mock(async () => response(404, ''));

                const result = await checkExternalLink('https://example.com', { fetchImpl, fallbackFetchImpl });

                expect(result).toEqual({ status: 'broken', error: '404' });
            });

            it('reports the direct error when both stacks fail', async () => {
                const fetchImpl = mock(async () => {
                    throw connectionError();
                });
                const fallbackFetchImpl = mock(async () => {
                    throw new TypeError('net::ERR_CONNECTION_REFUSED');
                });

                const result = await checkExternalLink('https://example.com', { fetchImpl, fallbackFetchImpl });

                expect(result).toEqual({ status: 'broken', error: 'Connection refused' });
            });

            it('reports the direct error when no fallback stack is provided', async () => {
                const fetchImpl = mock(async () => {
                    throw connectionError();
                });

                const result = await checkExternalLink('https://example.com', { fetchImpl });

                expect(result).toEqual({ status: 'broken', error: 'Connection refused' });
            });
        });

        it('reports Timeout when the request times out and no fallback is available', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            const fetchImpl = mock(async () => {
                throw abortError;
            });

            const result = await checkExternalLink('https://slow.example.com', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'Timeout' });
        });

        it('maps DNS failures to a readable message', async () => {
            const dnsError = new TypeError('fetch failed');
            (dnsError as Error & { cause?: { code?: string } }).cause = { code: 'ENOTFOUND' };
            const fetchImpl = mock(async () => {
                throw dnsError;
            });

            const result = await checkExternalLink('https://no-such-host.invalid', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'Could not resolve host' });
        });

        it('maps Chromium net error messages (net.fetch) to readable text', async () => {
            const fetchImpl = mock(async () => {
                throw new TypeError('net::ERR_NAME_NOT_RESOLVED');
            });

            const result = await checkExternalLink('https://no-such-host.invalid', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'Could not resolve host' });
        });

        it('surfaces the raw message for other network errors', async () => {
            const fetchImpl = mock(async () => {
                throw new TypeError('net::ERR_CONNECTION_RESET');
            });

            const result = await checkExternalLink('https://example.com', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'net::ERR_CONNECTION_RESET' });
        });

        it('normalizes protocol-relative URLs to https', async () => {
            const fetchImpl = mock(async () => response(200, 'https://cdn.example.com/file.js'));

            await checkExternalLink('//cdn.example.com/file.js', { fetchImpl });

            expect(fetchImpl.mock.calls[0][0]).toBe('https://cdn.example.com/file.js');
        });

        it('rejects malformed URLs without fetching', async () => {
            const fetchImpl = mock(async () => response(200));

            const result = await checkExternalLink('https://', { fetchImpl });

            expect(result).toEqual({ status: 'broken', error: 'URL using bad/illegal format' });
            expect(fetchImpl).not.toHaveBeenCalled();
        });
    });

    describe('checkLink (full desktop policy, behind app:checkLink)', () => {
        it('does not probe non-external URLs', async () => {
            const fetchImpl = mock(async () => response(200));

            const result = await checkLink('exe-node:page1', { fetchImpl });

            expect(result.status).toBe('unknown');
            expect(result.reason).toBe('not-external');
            expect(fetchImpl).not.toHaveBeenCalled();
        });

        it('refuses to probe local/private addresses', async () => {
            const fetchImpl = mock(async () => response(200));

            const result = await checkLink('http://192.168.1.1/admin', { fetchImpl, lookupFn: async () => [] });

            expect(result.status).toBe('unknown');
            expect(result.reason).toBe('private-address');
            expect(fetchImpl).not.toHaveBeenCalled();
        });

        it('probes public URLs and returns the external check result', async () => {
            const fetchImpl = mock(async () => response(200, 'https://example.com/'));

            const result = await checkLink('https://example.com', {
                fetchImpl,
                lookupFn: async () => [{ address: '93.184.216.34', family: 4 }],
            });

            expect(result).toEqual({ status: 'valid', error: null });
        });
    });

    describe('isPrivateAddress', () => {
        it('flags IPv4 loopback, RFC1918, link-local/metadata and CGNAT', () => {
            expect(isPrivateAddress('127.0.0.1', 4)).toBe(true);
            expect(isPrivateAddress('10.1.2.3', 4)).toBe(true);
            expect(isPrivateAddress('192.168.1.1', 4)).toBe(true);
            expect(isPrivateAddress('172.16.0.1', 4)).toBe(true);
            expect(isPrivateAddress('172.31.255.255', 4)).toBe(true);
            expect(isPrivateAddress('169.254.169.254', 4)).toBe(true);
            expect(isPrivateAddress('100.64.0.1', 4)).toBe(true);
            expect(isPrivateAddress('0.0.0.0', 4)).toBe(true);
        });

        it('allows public IPv4 addresses', () => {
            expect(isPrivateAddress('142.250.184.14', 4)).toBe(false);
            expect(isPrivateAddress('172.15.0.1', 4)).toBe(false);
            expect(isPrivateAddress('172.32.0.1', 4)).toBe(false);
            expect(isPrivateAddress('100.128.0.1', 4)).toBe(false);
        });

        it('flags IPv6 loopback, unique-local, link-local and mapped private IPv4', () => {
            expect(isPrivateAddress('::1', 6)).toBe(true);
            expect(isPrivateAddress('::', 6)).toBe(true);
            expect(isPrivateAddress('fd12:3456::1', 6)).toBe(true);
            expect(isPrivateAddress('fe80::1%en0', 6)).toBe(true);
            expect(isPrivateAddress('::ffff:192.168.1.1', 6)).toBe(true);
        });

        it('allows public IPv6 addresses', () => {
            expect(isPrivateAddress('2a00:1450:4003:80f::200e', 6)).toBe(false);
            expect(isPrivateAddress('::ffff:142.250.184.14', 6)).toBe(false);
        });
    });

    describe('resolvesToPrivateAddress', () => {
        it('flags localhost without resolving', async () => {
            const lookupFn = mock(async () => []);

            expect(await resolvesToPrivateAddress('http://localhost:8080/admin', { lookupFn })).toBe(true);
            expect(await resolvesToPrivateAddress('https://foo.localhost/', { lookupFn })).toBe(true);
            expect(lookupFn).not.toHaveBeenCalled();
        });

        it('flags literal private IPs without resolving', async () => {
            const lookupFn = mock(async () => []);

            expect(await resolvesToPrivateAddress('http://192.168.1.1/', { lookupFn })).toBe(true);
            expect(await resolvesToPrivateAddress('http://169.254.169.254/latest/meta-data/', { lookupFn })).toBe(
                true,
            );
            expect(await resolvesToPrivateAddress('http://[::1]:3000/', { lookupFn })).toBe(true);
            expect(lookupFn).not.toHaveBeenCalled();
        });

        it('allows literal public IPs', async () => {
            expect(await resolvesToPrivateAddress('http://142.250.184.14/', { lookupFn: async () => [] })).toBe(
                false,
            );
        });

        it('flags hostnames that resolve to a private address', async () => {
            const lookupFn = mock(async () => [{ address: '10.0.0.5', family: 4 }]);

            expect(await resolvesToPrivateAddress('https://intranet.example.org/', { lookupFn })).toBe(true);
            expect(lookupFn).toHaveBeenCalledWith('intranet.example.org');
        });

        it('allows hostnames that resolve publicly', async () => {
            const lookupFn = mock(async () => [{ address: '142.250.184.14', family: 4 }]);

            expect(await resolvesToPrivateAddress('https://www.google.com/', { lookupFn })).toBe(false);
        });

        it('returns false when resolution fails, so the check reports the DNS failure', async () => {
            const lookupFn = mock(async () => {
                throw new Error('ENOTFOUND');
            });

            expect(await resolvesToPrivateAddress('https://no-such-host.invalid/', { lookupFn })).toBe(false);
        });

        it('returns false for malformed URLs', async () => {
            expect(await resolvesToPrivateAddress('https://', { lookupFn: async () => [] })).toBe(false);
        });
    });
});
