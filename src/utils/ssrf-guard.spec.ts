import { assertUrlAllowed, isBlockedAddress, safeFetch, SsrfBlockedError, type LookupFn } from './ssrf-guard';

/** Lookup that always resolves to a given address (hermetic — no real DNS). */
function lookupTo(address: string): LookupFn {
    return async () => [{ address }];
}

function res(status: number, location?: string): Response {
    const headers = new Headers();
    if (location) {
        headers.set('location', location);
    }
    return new Response(null, { status, headers });
}

describe('ssrf-guard', () => {
    describe('isBlockedAddress', () => {
        it('blocks loopback, private, link-local and unspecified addresses', () => {
            expect(isBlockedAddress('127.0.0.1')).toBe(true);
            expect(isBlockedAddress('10.1.2.3')).toBe(true);
            expect(isBlockedAddress('172.16.5.4')).toBe(true);
            expect(isBlockedAddress('192.168.0.1')).toBe(true);
            expect(isBlockedAddress('169.254.169.254')).toBe(true); // cloud metadata
            expect(isBlockedAddress('0.0.0.0')).toBe(true);
            expect(isBlockedAddress('::1')).toBe(true);
            expect(isBlockedAddress('fe80::1')).toBe(true);
            expect(isBlockedAddress('fc00::1')).toBe(true);
        });

        it('blocks CGNAT / reserved / multicast ranges', () => {
            expect(isBlockedAddress('100.64.1.1')).toBe(true);
            expect(isBlockedAddress('224.0.0.1')).toBe(true);
            expect(isBlockedAddress('240.0.0.1')).toBe(true);
        });

        it('blocks IPv4-mapped IPv6 forms of the extra (non-RFC1918) ranges', () => {
            // Node's isIP() reports these as v6, so without mapped-address
            // normalization the EXTRA_BLOCKED_V4_CIDRS loop is skipped and an
            // attacker can reach CGNAT / this-host / multicast / reserved /
            // benchmarking via ::ffff: notation (SSRF egress bypass).
            expect(isBlockedAddress('::ffff:100.64.0.1')).toBe(true); // CGNAT
            expect(isBlockedAddress('::ffff:0.0.0.0')).toBe(true); // "this host"
            expect(isBlockedAddress('::ffff:224.0.0.1')).toBe(true); // multicast
            expect(isBlockedAddress('::ffff:240.0.0.1')).toBe(true); // reserved
            expect(isBlockedAddress('::ffff:198.18.0.1')).toBe(true); // benchmarking
            // Hex form of the same mapped address (::ffff:6440:0001 == 100.64.0.1).
            expect(isBlockedAddress('::ffff:6440:1')).toBe(true);
        });

        it('allows public addresses', () => {
            expect(isBlockedAddress('8.8.8.8')).toBe(false);
            expect(isBlockedAddress('93.184.216.34')).toBe(false);
            expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
            // A mapped public address must still be allowed (no over-blocking).
            expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
            // A `::ffff:` prefix whose tail is neither dotted IPv4 nor 2-group
            // hex is not a mapped address; it falls through to the normal path
            // (unresolvable → not a blocked v4 range).
            expect(isBlockedAddress('::ffff:not-an-ip')).toBe(false);
        });

        it('treats empty input as blocked', () => {
            expect(isBlockedAddress('')).toBe(true);
        });
    });

    describe('assertUrlAllowed', () => {
        it('rejects non-http(s) schemes', async () => {
            await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfBlockedError);
            await expect(assertUrlAllowed('ftp://example.com/x')).rejects.toBeInstanceOf(SsrfBlockedError);
            await expect(assertUrlAllowed('gopher://example.com')).rejects.toBeInstanceOf(SsrfBlockedError);
        });

        it('rejects an IP literal that is loopback/private without DNS', async () => {
            await expect(assertUrlAllowed('http://127.0.0.1/')).rejects.toBeInstanceOf(SsrfBlockedError);
            await expect(assertUrlAllowed('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(
                SsrfBlockedError,
            );
            await expect(assertUrlAllowed('http://[::1]/')).rejects.toBeInstanceOf(SsrfBlockedError);
        });

        it('rejects a public host that resolves to a private address', async () => {
            await expect(
                assertUrlAllowed('https://rebind.evil.example/', { lookupFn: lookupTo('10.0.0.5') }),
            ).rejects.toBeInstanceOf(SsrfBlockedError);
        });

        it('allows a public host that resolves to a public address', async () => {
            const url = await assertUrlAllowed('https://example.com/page', { lookupFn: lookupTo('93.184.216.34') });
            expect(url.hostname).toBe('example.com');
        });

        it('rejects a host that does not resolve', async () => {
            const failing: LookupFn = async () => {
                throw new Error('ENOTFOUND');
            };
            await expect(assertUrlAllowed('https://nope.invalid/', { lookupFn: failing })).rejects.toBeInstanceOf(
                SsrfBlockedError,
            );
        });
    });

    describe('safeFetch', () => {
        it('fetches a safe URL', async () => {
            let called = '';
            const fetchImpl = (async (url: string) => {
                called = String(url);
                return res(200);
            }) as unknown as typeof fetch;
            const response = await safeFetch('https://example.com/ok', {
                lookupFn: lookupTo('93.184.216.34'),
                fetchImpl,
            });
            expect(response.status).toBe(200);
            expect(called).toBe('https://example.com/ok');
        });

        it('follows a redirect to another public host', async () => {
            const fetchImpl = (async (url: string) => {
                if (String(url) === 'https://a.example/') {
                    return res(302, 'https://b.example/landing');
                }
                return res(200);
            }) as unknown as typeof fetch;
            const response = await safeFetch('https://a.example/', {
                lookupFn: lookupTo('93.184.216.34'),
                fetchImpl,
            });
            expect(response.status).toBe(200);
        });

        it('blocks a redirect that points at an internal address', async () => {
            // First hop resolves public, then redirects to a host resolving to loopback.
            const lookupFn: LookupFn = async hostname =>
                hostname === 'public.example' ? [{ address: '93.184.216.34' }] : [{ address: '127.0.0.1' }];
            const fetchImpl = (async (url: string) => {
                if (String(url) === 'https://public.example/') {
                    return res(302, 'http://internal.example/admin');
                }
                return res(200);
            }) as unknown as typeof fetch;
            await expect(safeFetch('https://public.example/', { lookupFn, fetchImpl })).rejects.toBeInstanceOf(
                SsrfBlockedError,
            );
        });

        it('stops after too many redirects', async () => {
            const fetchImpl = (async () => res(302, 'https://loop.example/next')) as unknown as typeof fetch;
            await expect(
                safeFetch('https://loop.example/', { lookupFn: lookupTo('93.184.216.34'), fetchImpl, maxRedirects: 2 }),
            ).rejects.toBeInstanceOf(SsrfBlockedError);
        });

        it('refuses to follow any redirect when maxRedirects is 0 (no body re-POST)', async () => {
            // Sensitive POSTs (platform integration carries the JWT + full
            // package) pass maxRedirects: 0 so a provider open-redirect throws
            // instead of replaying the body to the redirect target.
            let calls = 0;
            const fetchImpl = (async (url: string) => {
                calls++;
                if (String(url) === 'https://provider.example/') {
                    return res(302, 'https://attacker.example/collect');
                }
                return res(200);
            }) as unknown as typeof fetch;
            await expect(
                safeFetch('https://provider.example/', {
                    method: 'POST',
                    body: 'secret',
                    lookupFn: lookupTo('93.184.216.34'),
                    fetchImpl,
                    maxRedirects: 0,
                }),
            ).rejects.toBeInstanceOf(SsrfBlockedError);
            // The redirect target must never be contacted.
            expect(calls).toBe(1);
        });
    });
});
