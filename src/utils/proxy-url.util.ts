/**
 * Utility functions for handling reverse proxy headers and building public URLs.
 *
 * When the application is behind a reverse proxy (Nginx, Apache, load balancer, etc.),
 * the original client request details (protocol, host, port) are lost unless the proxy
 * forwards them via X-Forwarded-* headers.
 *
 * This utility provides functions to:
 * - Validate that requests come from trusted proxies
 * - Extract public URL information from trusted proxy headers
 * - Build callback URLs for SSO (CAS, OpenID) that use the public hostname
 */

import { prefixPath } from './basepath.util';

/**
 * Private IPv4 subnets (RFC 1918, RFC 4193, loopback)
 * Using BigInt for accurate unsigned 32-bit comparisons
 */
const PRIVATE_SUBNETS_V4 = [
    { prefix: 0x0a000000n, mask: 0xff000000n }, // 10.0.0.0/8
    { prefix: 0xac100000n, mask: 0xfff00000n }, // 172.16.0.0/12
    { prefix: 0xc0a80000n, mask: 0xffff0000n }, // 192.168.0.0/16
    { prefix: 0x7f000000n, mask: 0xff000000n }, // 127.0.0.0/8 (loopback)
    { prefix: 0xa9fe0000n, mask: 0xffff0000n }, // 169.254.0.0/16 (link-local)
];

/**
 * Server context interface for accessing request IP
 */
export interface ServerContext {
    requestIP?: (request: Request) => { address: string } | null;
}

/**
 * Parse an IPv4 address string into a 32-bit integer
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns The IP as a 32-bit unsigned integer, or null if invalid
 */
export function parseIPv4(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 0 || num > 255) return null;
        result = (result << 8) | num;
    }

    return result >>> 0; // Convert to unsigned 32-bit
}

/**
 * Check if an IPv4 address is within a CIDR range
 * @param ip - IPv4 address string
 * @param cidr - CIDR notation (e.g., "192.168.0.0/16")
 * @returns True if the IP is within the CIDR range
 */
export function isIPv4InCidr(ip: string, cidr: string): boolean {
    const [network, prefixLenStr] = cidr.split('/');
    const prefixLen = parseInt(prefixLenStr, 10);

    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

    const ipNum = parseIPv4(ip);
    const networkNum = parseIPv4(network);

    if (ipNum === null || networkNum === null) return false;

    // Create mask: e.g., /24 -> 0xFFFFFF00
    const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;

    return (ipNum & mask) === (networkNum & mask);
}

/**
 * Parse an IPv6 address into 8 16-bit segments
 * Handles :: notation for zero compression
 * @param ip - IPv6 address string
 * @returns Array of 8 16-bit segments, or null if invalid
 */
export function parseIPv6(ip: string): number[] | null {
    // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
    if (ip.includes('.')) {
        const lastColon = ip.lastIndexOf(':');
        if (lastColon !== -1) {
            const ipv4Part = ip.slice(lastColon + 1);
            const ipv6Part = ip.slice(0, lastColon);
            const ipv4Num = parseIPv4(ipv4Part);
            if (ipv4Num === null) return null;

            // Parse the IPv6 prefix (typically ::ffff:)
            const prefix = parseIPv6Pure(ipv6Part + ':0:0');
            if (!prefix) return null;

            // Replace last two segments with IPv4
            prefix[6] = (ipv4Num >>> 16) & 0xffff;
            prefix[7] = ipv4Num & 0xffff;
            return prefix;
        }
    }

    return parseIPv6Pure(ip);
}

/**
 * Parse a pure IPv6 address (no IPv4 component)
 */
function parseIPv6Pure(ip: string): number[] | null {
    // Handle :: notation
    const parts = ip.split('::');
    if (parts.length > 2) return null;

    let segments: number[] = [];

    if (parts.length === 2) {
        // Has :: compression
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];

        const leftNums = left.map(s => parseInt(s, 16));
        const rightNums = right.map(s => parseInt(s, 16));

        if (leftNums.some(n => isNaN(n) || n < 0 || n > 0xffff)) return null;
        if (rightNums.some(n => isNaN(n) || n < 0 || n > 0xffff)) return null;

        const zerosNeeded = 8 - leftNums.length - rightNums.length;
        if (zerosNeeded < 0) return null;

        segments = [...leftNums, ...Array(zerosNeeded).fill(0), ...rightNums];
    } else {
        // No :: compression
        const segs = ip.split(':');
        if (segs.length !== 8) return null;

        segments = segs.map(s => parseInt(s, 16));
        if (segments.some(n => isNaN(n) || n < 0 || n > 0xffff)) return null;
    }

    return segments;
}

/**
 * Check if an IPv6 address is within a CIDR range
 * @param ip - IPv6 address string
 * @param cidr - CIDR notation (e.g., "fc00::/7")
 * @returns True if the IP is within the CIDR range
 */
export function isIPv6InCidr(ip: string, cidr: string): boolean {
    const [network, prefixLenStr] = cidr.split('/');
    const prefixLen = parseInt(prefixLenStr, 10);

    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) return false;

    const ipSegs = parseIPv6(ip);
    const networkSegs = parseIPv6(network);

    if (!ipSegs || !networkSegs) return false;

    // Compare bit by bit up to prefixLen
    let bitsRemaining = prefixLen;
    for (let i = 0; i < 8 && bitsRemaining > 0; i++) {
        const bitsInSegment = Math.min(bitsRemaining, 16);
        const mask = bitsInSegment === 16 ? 0xffff : (0xffff << (16 - bitsInSegment)) & 0xffff;

        if ((ipSegs[i] & mask) !== (networkSegs[i] & mask)) {
            return false;
        }

        bitsRemaining -= 16;
    }

    return true;
}

/**
 * Check if an IP address is within a CIDR range
 * Supports both IPv4 and IPv6
 * @param ip - IP address string
 * @param cidr - CIDR notation
 * @returns True if the IP is within the CIDR range
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
    // Detect IP version
    const isIPv6 = ip.includes(':');
    const cidrIsIPv6 = cidr.includes(':');

    // Mixed versions can't match
    if (isIPv6 !== cidrIsIPv6) return false;

    if (isIPv6) {
        return isIPv6InCidr(ip, cidr);
    } else {
        return isIPv4InCidr(ip, cidr);
    }
}

/**
 * Check if an IP address is in a private range
 * @param ip - IP address string (IPv4 or IPv6)
 * @returns True if the IP is in a private range
 */
export function isPrivateIp(ip: string): boolean {
    // IPv6 addresses
    if (ip.includes(':')) {
        const segments = parseIPv6(ip);
        if (!segments) return false;

        // ::1 (loopback)
        if (segments.slice(0, 7).every(s => s === 0) && segments[7] === 1) {
            return true;
        }

        // fc00::/7 (Unique Local Address)
        if ((segments[0] & 0xfe00) === 0xfc00) {
            return true;
        }

        // fe80::/10 (Link-local)
        if ((segments[0] & 0xffc0) === 0xfe80) {
            return true;
        }

        // ::ffff:x.x.x.x (IPv4-mapped) - check the IPv4 part
        if (
            segments[0] === 0 &&
            segments[1] === 0 &&
            segments[2] === 0 &&
            segments[3] === 0 &&
            segments[4] === 0 &&
            segments[5] === 0xffff
        ) {
            const ipv4Num = BigInt(((segments[6] << 16) | segments[7]) >>> 0);
            for (const subnet of PRIVATE_SUBNETS_V4) {
                if ((ipv4Num & subnet.mask) === subnet.prefix) {
                    return true;
                }
            }
        }

        return false;
    }

    // IPv4 addresses
    const ipNum = parseIPv4(ip);
    if (ipNum === null) return false;

    const ipBigInt = BigInt(ipNum);
    for (const subnet of PRIVATE_SUBNETS_V4) {
        if ((ipBigInt & subnet.mask) === subnet.prefix) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a client IP is a trusted proxy
 * @param clientIp - The IP address of the connecting client
 * @returns True if the IP is trusted to set proxy headers
 */
export function isTrustedProxy(clientIp: string | null | undefined): boolean {
    if (!clientIp) return false;

    const trusted = process.env.TRUSTED_PROXIES || '';
    if (!trusted) return false;

    const ranges = trusted.split(',').map(s => s.trim().toLowerCase());

    for (const range of ranges) {
        if (!range) continue;

        // REMOTE_ADDR means trust the immediate connecting IP
        if (range === 'remote_addr') {
            return true;
        }

        // private_ranges means trust all private IPv4/IPv6 subnets
        if (range === 'private_ranges') {
            if (isPrivateIp(clientIp)) {
                return true;
            }
            continue;
        }

        // Check if it's a specific IP (no /)
        if (!range.includes('/')) {
            if (clientIp.toLowerCase() === range) {
                return true;
            }
            continue;
        }

        // Check CIDR range
        if (isIpInCidr(clientIp, range)) {
            return true;
        }
    }

    return false;
}

/**
 * Get the set of headers that should be trusted from proxies
 * @returns Set of lowercase header names
 */
export function getTrustedHeaders(): Set<string> {
    const headers = process.env.TRUSTED_HEADERS || '';
    if (!headers) {
        // Default trusted headers
        return new Set(['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port']);
    }

    return new Set(
        headers
            .split(',')
            .map(h => h.trim().toLowerCase())
            .filter(h => h),
    );
}

/**
 * Get the public URL from a request, respecting reverse proxy headers
 * @param request - The incoming request
 * @param server - Optional server context for getting client IP
 * @returns The public URL
 */
export function getPublicUrl(request: Request, server?: ServerContext): URL {
    const fallbackUrl = new URL(request.url);
    const clientIp = server?.requestIP?.(request)?.address ?? null;

    // If not from a trusted proxy, use the request URL as-is
    if (!isTrustedProxy(clientIp)) {
        return fallbackUrl;
    }

    const headers = request.headers;
    const trustedHeaders = getTrustedHeaders();

    // Extract protocol
    let proto = fallbackUrl.protocol.replace(':', '');
    if (trustedHeaders.has('x-forwarded-proto')) {
        const forwardedProto = headers.get('x-forwarded-proto');
        if (forwardedProto) {
            // Take only the first value if comma-separated
            proto = forwardedProto.split(',')[0].trim().toLowerCase();
        }
    }

    // Extract host
    let host = fallbackUrl.hostname;
    let hostFromProxy = false;
    if (trustedHeaders.has('x-forwarded-host')) {
        const forwardedHost = headers.get('x-forwarded-host');
        if (forwardedHost) {
            // Take only the first value if comma-separated
            host = forwardedHost.split(',')[0].trim();
            // Remove port if included in host
            if (host.includes(':')) {
                host = host.split(':')[0];
            }
            hostFromProxy = true;
        }
    }

    // Extract port
    // If host came from proxy, default to no port (standard ports)
    // If host is from original request, preserve the original port
    let port: string | null = hostFromProxy ? null : fallbackUrl.port || null;
    if (trustedHeaders.has('x-forwarded-port')) {
        const forwardedPort = headers.get('x-forwarded-port');
        if (forwardedPort) {
            port = forwardedPort.split(',')[0].trim();
        }
    }

    // Build the URL
    const isStandardPort =
        (proto === 'https' && (port === '443' || port === null)) ||
        (proto === 'http' && (port === '80' || port === null));

    const origin = isStandardPort || !port ? `${proto}://${host}` : `${proto}://${host}:${port}`;

    return new URL(fallbackUrl.pathname + fallbackUrl.search, origin);
}

/**
 * Build a public callback URL for SSO authentication
 * This function constructs the full callback URL including BASE_PATH
 *
 * @param request - The incoming request
 * @param callbackPath - The callback path (e.g., '/login/cas/callback')
 * @param server - Optional server context for getting client IP
 * @returns The full public callback URL
 *
 * @example
 * // With BASE_PATH=/app and public host https://example.org
 * getPublicCallbackUrl(request, '/login/cas/callback', server)
 * // Returns: 'https://example.org/app/login/cas/callback'
 */
export function getPublicCallbackUrl(request: Request, callbackPath: string, server?: ServerContext): string {
    const publicUrl = getPublicUrl(request, server);

    // Build the callback path with BASE_PATH prefix
    const fullPath = prefixPath(callbackPath);

    return `${publicUrl.protocol}//${publicUrl.host}${fullPath}`;
}
