import { describe, expect, it, mock } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    BROWSER_HEADERS,
    checkExternalLink,
    classifyHttpStatus,
    isPrivateAddress,
    resolvesToPrivateAddress,
} = require('./link-check');

const okResponse = { status: 200 };
const notFoundResponse = { status: 404 };

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
            const fetchImpl = mock(async () => okResponse);

            const error = await checkExternalLink('https://example.com', { fetchImpl });

            expect(error).toBeNull();
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
            const fetchImpl = mock(async () => notFoundResponse);

            expect(await checkExternalLink('https://example.com/missing', { fetchImpl })).toBe('404');
            expect(fetchImpl).toHaveBeenCalledTimes(1);
        });

        it('cancels the response body without reading it', async () => {
            const cancel = mock(async () => {});
            const fetchImpl = mock(async () => ({ status: 200, body: { cancel } }));

            expect(await checkExternalLink('https://example.com', { fetchImpl })).toBeNull();
            expect(cancel).toHaveBeenCalledTimes(1);
        });

        it('still classifies the status when cancelling the body throws', async () => {
            const fetchImpl = mock(async () => ({
                status: 404,
                body: {
                    cancel: async () => {
                        throw new Error('stream locked');
                    },
                },
            }));

            expect(await checkExternalLink('https://example.com/missing', { fetchImpl })).toBe('404');
        });

        it('reports Timeout when the request times out', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            const fetchImpl = mock(async () => {
                throw abortError;
            });

            expect(await checkExternalLink('https://slow.example.com', { fetchImpl })).toBe('Timeout');
            expect(fetchImpl).toHaveBeenCalledTimes(1);
        });

        it('maps DNS failures to a readable message', async () => {
            const dnsError = new TypeError('fetch failed');
            (dnsError as Error & { cause?: { code?: string } }).cause = { code: 'ENOTFOUND' };
            const fetchImpl = mock(async () => {
                throw dnsError;
            });

            expect(await checkExternalLink('https://no-such-host.invalid', { fetchImpl })).toBe(
                'Could not resolve host',
            );
        });

        it('maps Chromium net error messages (Electron net.fetch) to readable text', async () => {
            const fetchImpl = mock(async () => {
                throw new TypeError('net::ERR_NAME_NOT_RESOLVED');
            });

            expect(await checkExternalLink('https://no-such-host.invalid', { fetchImpl })).toBe(
                'Could not resolve host',
            );
        });

        it('maps refused connections to a readable message', async () => {
            const refusedError = new TypeError('fetch failed');
            (refusedError as Error & { code?: string }).code = 'ECONNREFUSED';
            const fetchImpl = mock(async () => {
                throw refusedError;
            });

            expect(await checkExternalLink('https://refused.example.com', { fetchImpl })).toBe(
                'Connection refused',
            );
        });

        it('surfaces the raw message for other network errors', async () => {
            const fetchImpl = mock(async () => {
                throw new TypeError('net::ERR_CONNECTION_RESET');
            });

            expect(await checkExternalLink('https://example.com', { fetchImpl })).toBe(
                'net::ERR_CONNECTION_RESET',
            );
        });

        it('normalizes protocol-relative URLs to https', async () => {
            const fetchImpl = mock(async () => okResponse);

            await checkExternalLink('//cdn.example.com/file.js', { fetchImpl });

            expect(fetchImpl.mock.calls[0][0]).toBe('https://cdn.example.com/file.js');
        });

        it('rejects malformed URLs without fetching', async () => {
            const fetchImpl = mock(async () => okResponse);

            expect(await checkExternalLink('https://', { fetchImpl })).toBe('URL using bad/illegal format');
            expect(fetchImpl).not.toHaveBeenCalled();
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
