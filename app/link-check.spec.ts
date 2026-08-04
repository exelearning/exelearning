import { describe, expect, it, mock } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BROWSER_HEADERS, checkExternalLink, classifyHttpStatus, shouldFallbackFromHead } = require('./link-check');

const okResponse = { status: 200 };
const notFoundResponse = { status: 404 };

describe('link-check', () => {
    describe('classifyHttpStatus', () => {
        it('treats 2xx and 3xx as valid', () => {
            expect(classifyHttpStatus(200)).toBeNull();
            expect(classifyHttpStatus(204)).toBeNull();
            expect(classifyHttpStatus(301)).toBeNull();
        });

        it('reports other statuses as the broken-link error', () => {
            expect(classifyHttpStatus(404)).toBe('404');
            expect(classifyHttpStatus(500)).toBe('500');
        });
    });

    describe('shouldFallbackFromHead', () => {
        it('falls back for method-hostile statuses only', () => {
            expect(shouldFallbackFromHead(405)).toBe(true);
            expect(shouldFallbackFromHead(403)).toBe(true);
            expect(shouldFallbackFromHead(401)).toBe(true);
            expect(shouldFallbackFromHead(501)).toBe(true);
            expect(shouldFallbackFromHead(404)).toBe(false);
            expect(shouldFallbackFromHead(200)).toBe(false);
        });
    });

    describe('checkExternalLink', () => {
        it('returns null when HEAD answers 2xx', async () => {
            const fetchImpl = mock(async () => okResponse);

            const error = await checkExternalLink('https://example.com', { fetchImpl });

            expect(error).toBeNull();
            expect(fetchImpl).toHaveBeenCalledTimes(1);
            const [url, options] = fetchImpl.mock.calls[0];
            expect(url).toBe('https://example.com');
            expect(options.method).toBe('HEAD');
            expect(options.redirect).toBe('follow');
            expect(options.headers['User-Agent']).toBe(BROWSER_HEADERS['User-Agent']);
        });

        it('reports the real status code when HEAD answers 404', async () => {
            const fetchImpl = mock(async () => notFoundResponse);

            expect(await checkExternalLink('https://example.com/missing', { fetchImpl })).toBe('404');
        });

        it('falls back from a 403 HEAD to a ranged GET and uses its status', async () => {
            const fetchImpl = mock()
                .mockResolvedValueOnce({ status: 403 })
                .mockResolvedValueOnce(okResponse);

            const error = await checkExternalLink('https://example.com', { fetchImpl });

            expect(error).toBeNull();
            expect(fetchImpl).toHaveBeenCalledTimes(2);
            const [, getOptions] = fetchImpl.mock.calls[1];
            expect(getOptions.method).toBe('GET');
            expect(getOptions.headers.Range).toBe('bytes=0-0');
        });

        it('falls back to GET when the host drops HEAD connections', async () => {
            const fetchImpl = mock()
                .mockRejectedValueOnce(new TypeError('fetch failed'))
                .mockResolvedValueOnce(notFoundResponse);

            expect(await checkExternalLink('https://example.com', { fetchImpl })).toBe('404');
            expect(fetchImpl).toHaveBeenCalledTimes(2);
        });

        it('does not retry with GET when HEAD timed out', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            const fetchImpl = mock(async () => {
                throw abortError;
            });

            expect(await checkExternalLink('https://slow.example.com', { fetchImpl })).toBe('Timeout');
            expect(fetchImpl).toHaveBeenCalledTimes(1);
        });

        it('reports a timeout when the GET fallback times out', async () => {
            const timeoutError = new Error('The operation timed out');
            timeoutError.name = 'TimeoutError';
            const fetchImpl = mock()
                .mockRejectedValueOnce(new TypeError('fetch failed'))
                .mockRejectedValueOnce(timeoutError);

            expect(await checkExternalLink('https://example.com', { fetchImpl })).toBe('Timeout');
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

            expect(await checkExternalLink('https://localhost:1', { fetchImpl })).toBe('Connection refused');
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
});
