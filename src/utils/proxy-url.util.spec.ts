/**
 * Tests for proxy-url utility functions
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    parseIPv4,
    parseIPv6,
    isIPv4InCidr,
    isIPv6InCidr,
    isIpInCidr,
    isPrivateIp,
    isTrustedProxy,
    getTrustedHeaders,
    getPublicUrl,
    getPublicCallbackUrl,
    type ServerContext,
} from './proxy-url.util';

describe('proxy-url.util', () => {
    // Store original env values
    let originalTrustedProxies: string | undefined;
    let originalTrustedHeaders: string | undefined;
    let originalBasePath: string | undefined;

    beforeEach(() => {
        originalTrustedProxies = process.env.TRUSTED_PROXIES;
        originalTrustedHeaders = process.env.TRUSTED_HEADERS;
        originalBasePath = process.env.BASE_PATH;
        // Clear env for clean tests
        delete process.env.TRUSTED_PROXIES;
        delete process.env.TRUSTED_HEADERS;
        delete process.env.BASE_PATH;
    });

    afterEach(() => {
        // Restore original values
        if (originalTrustedProxies !== undefined) {
            process.env.TRUSTED_PROXIES = originalTrustedProxies;
        } else {
            delete process.env.TRUSTED_PROXIES;
        }
        if (originalTrustedHeaders !== undefined) {
            process.env.TRUSTED_HEADERS = originalTrustedHeaders;
        } else {
            delete process.env.TRUSTED_HEADERS;
        }
        if (originalBasePath !== undefined) {
            process.env.BASE_PATH = originalBasePath;
        } else {
            delete process.env.BASE_PATH;
        }
    });

    describe('parseIPv4', () => {
        it('should parse valid IPv4 addresses', () => {
            expect(parseIPv4('192.168.1.1')).toBe(0xc0a80101);
            expect(parseIPv4('10.0.0.1')).toBe(0x0a000001);
            expect(parseIPv4('127.0.0.1')).toBe(0x7f000001);
            expect(parseIPv4('0.0.0.0')).toBe(0);
            expect(parseIPv4('255.255.255.255')).toBe(0xffffffff);
        });

        it('should return null for invalid IPv4 addresses', () => {
            expect(parseIPv4('256.1.1.1')).toBeNull();
            expect(parseIPv4('1.2.3')).toBeNull();
            expect(parseIPv4('1.2.3.4.5')).toBeNull();
            expect(parseIPv4('abc.def.ghi.jkl')).toBeNull();
            expect(parseIPv4('')).toBeNull();
            expect(parseIPv4('::1')).toBeNull();
        });
    });

    describe('parseIPv6', () => {
        it('should parse full IPv6 addresses', () => {
            const result = parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001');
            expect(result).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
        });

        it('should parse compressed IPv6 addresses', () => {
            const result = parseIPv6('2001:db8::1');
            expect(result).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
        });

        it('should parse loopback address', () => {
            const result = parseIPv6('::1');
            expect(result).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
        });

        it('should parse unspecified address', () => {
            const result = parseIPv6('::');
            expect(result).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
        });

        it('should parse IPv4-mapped IPv6 addresses', () => {
            const result = parseIPv6('::ffff:192.168.1.1');
            expect(result).toEqual([0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0101]);
        });

        it('should return null for invalid IPv6 addresses', () => {
            expect(parseIPv6('2001:db8:::1')).toBeNull(); // Triple colon
            expect(parseIPv6('2001:db8:gggg::1')).toBeNull(); // Invalid hex
            expect(parseIPv6('2001:db8:1:2:3:4:5:6:7:8:9')).toBeNull(); // Too many segments
        });
    });

    describe('isIPv4InCidr', () => {
        it('should match IPs within CIDR ranges', () => {
            expect(isIPv4InCidr('192.168.1.100', '192.168.0.0/16')).toBe(true);
            expect(isIPv4InCidr('192.168.255.255', '192.168.0.0/16')).toBe(true);
            expect(isIPv4InCidr('10.0.0.1', '10.0.0.0/8')).toBe(true);
            expect(isIPv4InCidr('10.255.255.255', '10.0.0.0/8')).toBe(true);
            expect(isIPv4InCidr('172.16.0.1', '172.16.0.0/12')).toBe(true);
            expect(isIPv4InCidr('172.31.255.255', '172.16.0.0/12')).toBe(true);
        });

        it('should not match IPs outside CIDR ranges', () => {
            expect(isIPv4InCidr('192.169.1.1', '192.168.0.0/16')).toBe(false);
            expect(isIPv4InCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
            expect(isIPv4InCidr('172.32.0.1', '172.16.0.0/12')).toBe(false);
        });

        it('should handle /32 (single IP)', () => {
            expect(isIPv4InCidr('192.168.1.1', '192.168.1.1/32')).toBe(true);
            expect(isIPv4InCidr('192.168.1.2', '192.168.1.1/32')).toBe(false);
        });

        it('should handle /0 (all IPs)', () => {
            expect(isIPv4InCidr('192.168.1.1', '0.0.0.0/0')).toBe(true);
            expect(isIPv4InCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
        });

        it('should return false for invalid inputs', () => {
            expect(isIPv4InCidr('invalid', '192.168.0.0/16')).toBe(false);
            expect(isIPv4InCidr('192.168.1.1', 'invalid/16')).toBe(false);
            expect(isIPv4InCidr('192.168.1.1', '192.168.0.0/33')).toBe(false);
            expect(isIPv4InCidr('192.168.1.1', '192.168.0.0/-1')).toBe(false);
        });
    });

    describe('isIPv6InCidr', () => {
        it('should match IPs within CIDR ranges', () => {
            expect(isIPv6InCidr('fc00::1', 'fc00::/7')).toBe(true);
            expect(isIPv6InCidr('fd00::1', 'fc00::/7')).toBe(true);
            expect(isIPv6InCidr('fe80::1', 'fe80::/10')).toBe(true);
            expect(isIPv6InCidr('::1', '::1/128')).toBe(true);
        });

        it('should not match IPs outside CIDR ranges', () => {
            expect(isIPv6InCidr('2001:db8::1', 'fc00::/7')).toBe(false);
            expect(isIPv6InCidr('2001:db8::1', 'fe80::/10')).toBe(false);
        });

        it('should handle /0 (all IPs)', () => {
            expect(isIPv6InCidr('2001:db8::1', '::/0')).toBe(true);
        });

        it('should return false for invalid inputs', () => {
            expect(isIPv6InCidr('invalid', 'fc00::/7')).toBe(false);
            expect(isIPv6InCidr('fc00::1', 'invalid/7')).toBe(false);
            expect(isIPv6InCidr('fc00::1', 'fc00::/129')).toBe(false);
        });
    });

    describe('isIpInCidr', () => {
        it('should work with IPv4', () => {
            expect(isIpInCidr('192.168.1.1', '192.168.0.0/16')).toBe(true);
            expect(isIpInCidr('10.0.0.1', '192.168.0.0/16')).toBe(false);
        });

        it('should work with IPv6', () => {
            expect(isIpInCidr('fc00::1', 'fc00::/7')).toBe(true);
            expect(isIpInCidr('2001:db8::1', 'fc00::/7')).toBe(false);
        });

        it('should return false for mixed IP versions', () => {
            expect(isIpInCidr('192.168.1.1', 'fc00::/7')).toBe(false);
            expect(isIpInCidr('fc00::1', '192.168.0.0/16')).toBe(false);
        });
    });

    describe('isPrivateIp', () => {
        describe('IPv4 private ranges', () => {
            it('should identify 10.0.0.0/8 as private', () => {
                expect(isPrivateIp('10.0.0.1')).toBe(true);
                expect(isPrivateIp('10.255.255.255')).toBe(true);
            });

            it('should identify 172.16.0.0/12 as private', () => {
                expect(isPrivateIp('172.16.0.1')).toBe(true);
                expect(isPrivateIp('172.31.255.255')).toBe(true);
                expect(isPrivateIp('172.15.0.1')).toBe(false);
                expect(isPrivateIp('172.32.0.1')).toBe(false);
            });

            it('should identify 192.168.0.0/16 as private', () => {
                expect(isPrivateIp('192.168.0.1')).toBe(true);
                expect(isPrivateIp('192.168.255.255')).toBe(true);
            });

            it('should identify 127.0.0.0/8 (loopback) as private', () => {
                expect(isPrivateIp('127.0.0.1')).toBe(true);
                expect(isPrivateIp('127.255.255.255')).toBe(true);
            });

            it('should identify 169.254.0.0/16 (link-local) as private', () => {
                expect(isPrivateIp('169.254.0.1')).toBe(true);
                expect(isPrivateIp('169.254.255.255')).toBe(true);
            });

            it('should identify public IPs as not private', () => {
                expect(isPrivateIp('8.8.8.8')).toBe(false);
                expect(isPrivateIp('1.1.1.1')).toBe(false);
                expect(isPrivateIp('203.0.113.1')).toBe(false);
            });
        });

        describe('IPv6 private ranges', () => {
            it('should identify ::1 (loopback) as private', () => {
                expect(isPrivateIp('::1')).toBe(true);
            });

            it('should identify fc00::/7 (ULA) as private', () => {
                expect(isPrivateIp('fc00::1')).toBe(true);
                expect(isPrivateIp('fd00::1')).toBe(true);
            });

            it('should identify fe80::/10 (link-local) as private', () => {
                expect(isPrivateIp('fe80::1')).toBe(true);
                expect(isPrivateIp('fe80::abcd:1234')).toBe(true);
            });

            it('should identify IPv4-mapped private addresses', () => {
                expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
                expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
            });

            it('should identify public IPv6 as not private', () => {
                expect(isPrivateIp('2001:db8::1')).toBe(false);
                expect(isPrivateIp('2607:f8b0:4004:800::200e')).toBe(false);
            });
        });

        it('should return false for invalid IPs', () => {
            expect(isPrivateIp('invalid')).toBe(false);
            expect(isPrivateIp('')).toBe(false);
        });
    });

    describe('isTrustedProxy', () => {
        it('should return false when TRUSTED_PROXIES is not set', () => {
            expect(isTrustedProxy('192.168.1.1')).toBe(false);
        });

        it('should return false for null/undefined IP', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            expect(isTrustedProxy(null)).toBe(false);
            expect(isTrustedProxy(undefined)).toBe(false);
        });

        it('should trust all IPs with REMOTE_ADDR', () => {
            process.env.TRUSTED_PROXIES = 'REMOTE_ADDR';
            expect(isTrustedProxy('192.168.1.1')).toBe(true);
            expect(isTrustedProxy('8.8.8.8')).toBe(true);
            expect(isTrustedProxy('fc00::1')).toBe(true);
        });

        it('should handle case-insensitive REMOTE_ADDR', () => {
            process.env.TRUSTED_PROXIES = 'remote_addr';
            expect(isTrustedProxy('8.8.8.8')).toBe(true);
        });

        it('should trust private IPs with private_ranges', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            expect(isTrustedProxy('192.168.1.1')).toBe(true);
            expect(isTrustedProxy('10.0.0.1')).toBe(true);
            expect(isTrustedProxy('fc00::1')).toBe(true);
            expect(isTrustedProxy('8.8.8.8')).toBe(false);
        });

        it('should trust specific IPs', () => {
            process.env.TRUSTED_PROXIES = '192.168.1.100,10.0.0.50';
            expect(isTrustedProxy('192.168.1.100')).toBe(true);
            expect(isTrustedProxy('10.0.0.50')).toBe(true);
            expect(isTrustedProxy('192.168.1.101')).toBe(false);
        });

        it('should trust IPs in CIDR ranges', () => {
            process.env.TRUSTED_PROXIES = '192.168.1.0/24,10.0.0.0/8';
            expect(isTrustedProxy('192.168.1.50')).toBe(true);
            expect(isTrustedProxy('192.168.2.50')).toBe(false);
            expect(isTrustedProxy('10.255.255.255')).toBe(true);
        });

        it('should handle combined values', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges,REMOTE_ADDR';
            expect(isTrustedProxy('8.8.8.8')).toBe(true);
            expect(isTrustedProxy('192.168.1.1')).toBe(true);
        });

        it('should handle whitespace in config', () => {
            process.env.TRUSTED_PROXIES = ' private_ranges , REMOTE_ADDR ';
            expect(isTrustedProxy('8.8.8.8')).toBe(true);
        });

        it('should handle empty ranges gracefully', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges,,REMOTE_ADDR';
            expect(isTrustedProxy('8.8.8.8')).toBe(true);
        });
    });

    describe('getTrustedHeaders', () => {
        it('should return default headers when not configured', () => {
            const headers = getTrustedHeaders();
            expect(headers.has('x-forwarded-for')).toBe(true);
            expect(headers.has('x-forwarded-host')).toBe(true);
            expect(headers.has('x-forwarded-proto')).toBe(true);
            expect(headers.has('x-forwarded-port')).toBe(true);
        });

        it('should return configured headers', () => {
            process.env.TRUSTED_HEADERS = 'x-forwarded-host,x-forwarded-proto';
            const headers = getTrustedHeaders();
            expect(headers.has('x-forwarded-host')).toBe(true);
            expect(headers.has('x-forwarded-proto')).toBe(true);
            expect(headers.has('x-forwarded-for')).toBe(false);
            expect(headers.has('x-forwarded-port')).toBe(false);
        });

        it('should lowercase header names', () => {
            process.env.TRUSTED_HEADERS = 'X-Forwarded-Host,X-FORWARDED-PROTO';
            const headers = getTrustedHeaders();
            expect(headers.has('x-forwarded-host')).toBe(true);
            expect(headers.has('x-forwarded-proto')).toBe(true);
        });

        it('should handle whitespace', () => {
            process.env.TRUSTED_HEADERS = ' x-forwarded-host , x-forwarded-proto ';
            const headers = getTrustedHeaders();
            expect(headers.has('x-forwarded-host')).toBe(true);
            expect(headers.has('x-forwarded-proto')).toBe(true);
        });
    });

    describe('getPublicUrl', () => {
        function createRequest(url: string, headers: Record<string, string> = {}): Request {
            return new Request(url, { headers });
        }

        function createServer(ip: string): ServerContext {
            return {
                requestIP: () => ({ address: ip }),
            };
        }

        it('should return request URL when no proxy is trusted', () => {
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            expect(url.href).toBe('http://internal:8080/path');
        });

        it('should use proxy headers when proxy is trusted', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            expect(url.href).toBe('https://public.example.org/path');
        });

        it('should handle X-Forwarded-Port', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
                'x-forwarded-port': '8443',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            expect(url.href).toBe('https://public.example.org:8443/path');
        });

        it('should omit standard ports', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';

            // HTTPS on 443
            let request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
                'x-forwarded-port': '443',
            });
            let server = createServer('192.168.1.1');
            let url = getPublicUrl(request, server);
            expect(url.href).toBe('https://public.example.org/path');

            // HTTP on 80
            request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'http',
                'x-forwarded-port': '80',
            });
            server = createServer('192.168.1.1');
            url = getPublicUrl(request, server);
            expect(url.href).toBe('http://public.example.org/path');
        });

        it('should handle comma-separated header values', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'proxy1.example.org, proxy2.example.org',
                'x-forwarded-proto': 'https, http',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            // Should use first value
            expect(url.href).toBe('https://proxy1.example.org/path');
        });

        it('should handle host with port in header', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org:443',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            // Should strip port from host header and use standard port
            expect(url.href).toBe('https://public.example.org/path');
        });

        it('should preserve query string', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path?foo=bar&baz=qux', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            expect(url.href).toBe('https://public.example.org/path?foo=bar&baz=qux');
        });

        it('should use fallback when no server context', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });

            // No server context means no IP, so not trusted
            const url = getPublicUrl(request);
            expect(url.href).toBe('http://internal:8080/path');
        });

        it('should respect TRUSTED_HEADERS configuration', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            process.env.TRUSTED_HEADERS = 'x-forwarded-proto'; // Only trust proto
            const request = createRequest('http://internal:8080/path', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicUrl(request, server);
            // Should use https but keep internal host
            expect(url.href).toBe('https://internal:8080/path');
        });
    });

    describe('getPublicCallbackUrl', () => {
        function createRequest(url: string, headers: Record<string, string> = {}): Request {
            return new Request(url, { headers });
        }

        function createServer(ip: string): ServerContext {
            return {
                requestIP: () => ({ address: ip }),
            };
        }

        it('should build callback URL without BASE_PATH', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            const request = createRequest('http://internal:8080/login/cas', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicCallbackUrl(request, '/login/cas/callback', server);
            expect(url).toBe('https://public.example.org/login/cas/callback');
        });

        it('should include BASE_PATH in callback URL', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            process.env.BASE_PATH = '/app';
            const request = createRequest('http://internal:8080/app/login/cas', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicCallbackUrl(request, '/login/cas/callback', server);
            expect(url).toBe('https://public.example.org/app/login/cas/callback');
        });

        it('should handle multi-level BASE_PATH', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            process.env.BASE_PATH = '/aplicaciones/medusa/exelearning';
            const request = createRequest('http://internal:8080/aplicaciones/medusa/exelearning/login/cas', {
                'x-forwarded-host': 'www3-pre.gobiernodecanarias.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicCallbackUrl(request, '/login/cas/callback', server);
            expect(url).toBe(
                'https://www3-pre.gobiernodecanarias.org/aplicaciones/medusa/exelearning/login/cas/callback',
            );
        });

        it('should use internal URL when proxy not trusted', () => {
            // No TRUSTED_PROXIES configured
            const request = createRequest('http://internal:8080/login/cas', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicCallbackUrl(request, '/login/cas/callback', server);
            expect(url).toBe('http://internal:8080/login/cas/callback');
        });

        it('should handle path without leading slash', () => {
            process.env.TRUSTED_PROXIES = 'private_ranges';
            process.env.BASE_PATH = '/app';
            const request = createRequest('http://internal:8080/app/login/cas', {
                'x-forwarded-host': 'public.example.org',
                'x-forwarded-proto': 'https',
            });
            const server = createServer('192.168.1.1');

            const url = getPublicCallbackUrl(request, 'login/openid/callback', server);
            expect(url).toBe('https://public.example.org/app/login/openid/callback');
        });
    });

    describe('Canarias deployment scenario', () => {
        it('should correctly build callback URLs for the Canarias deployment', () => {
            // Simulate the Canarias deployment environment
            process.env.TRUSTED_PROXIES = 'private_ranges,REMOTE_ADDR';
            process.env.BASE_PATH = '/aplicaciones/medusa/exelearning';

            // Request comes from internal server through proxy
            const request = new Request('http://omvs0001.medusa.gobiernodecanarias.net:8080/login/cas', {
                headers: {
                    'x-forwarded-host': 'www3-pre.gobiernodecanarias.org',
                    'x-forwarded-proto': 'https',
                    'x-forwarded-for': '10.0.0.1',
                },
            });

            // Server reports proxy IP from internal network
            const server: ServerContext = {
                requestIP: () => ({ address: '10.0.0.1' }),
            };

            const casCallbackUrl = getPublicCallbackUrl(request, '/login/cas/callback', server);
            expect(casCallbackUrl).toBe(
                'https://www3-pre.gobiernodecanarias.org/aplicaciones/medusa/exelearning/login/cas/callback',
            );

            const openidCallbackUrl = getPublicCallbackUrl(request, '/login/openid/callback', server);
            expect(openidCallbackUrl).toBe(
                'https://www3-pre.gobiernodecanarias.org/aplicaciones/medusa/exelearning/login/openid/callback',
            );
        });
    });
});
