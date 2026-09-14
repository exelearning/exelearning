/**
 * SSRF guard — a safe wrapper around fetch for server-side requests to
 * user-influenced URLs.
 *
 * Background: server-side link validation and platform callbacks fetched
 * arbitrary attacker-supplied URLs with `redirect: 'follow'` and no egress
 * filtering, allowing SSRF to loopback / RFC1918 / link-local (cloud metadata
 * 169.254.169.254) and an internal-port oracle. This guard:
 *   - allows only http(s) schemes,
 *   - resolves the host and rejects requests whose resolved address is
 *     private/loopback/link-local/CGNAT/unspecified,
 *   - follows redirects MANUALLY, re-validating the host of every hop (so a
 *     public host cannot redirect to an internal one),
 *   - is dependency-injectable (DNS lookup + fetch) for hermetic tests.
 */
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { isIpInCidr, isPrivateIp } from './proxy-url.util';

/** Thrown when a URL/host is rejected by the SSRF guard. */
export class SsrfBlockedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SsrfBlockedError';
    }
}

/** Extra IPv4 ranges that are not "private" per RFC1918 but must not be reachable. */
const EXTRA_BLOCKED_V4_CIDRS = [
    '0.0.0.0/8', // "this host"
    '100.64.0.0/10', // CGNAT
    '192.0.0.0/24', // IETF protocol assignments
    '198.18.0.0/15', // benchmarking
    '224.0.0.0/4', // multicast
    '240.0.0.0/4', // reserved
];

export type LookupFn = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: LookupFn = async hostname => {
    const result = await lookup(hostname, { all: true });
    return result.map(r => ({ address: r.address }));
};

/**
 * Convert an IPv4-mapped IPv6 address (`::ffff:1.2.3.4` dotted form, or
 * `::ffff:hhhh:hhhh` hex form) to its dotted IPv4 string, else `null`. Node's
 * `isIP()` reports these as IPv6, so without this normalization the IPv4-only
 * controls below (`isIP(addr) === 4` gating the `EXTRA_BLOCKED_V4_CIDRS` loop)
 * are skipped and the mapped form bypasses the egress guard.
 */
function mappedIpv4(host: string): string | null {
    const m = /^::ffff:(.+)$/i.exec(host);
    if (!m) {
        return null;
    }
    const rest = m[1];
    if (isIP(rest) === 4) {
        return rest; // dotted tail, e.g. ::ffff:169.254.169.254
    }
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(rest);
    if (hex) {
        const hi = parseInt(hex[1], 16);
        const lo = parseInt(hex[2], 16);
        return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
    return null;
}

/**
 * Returns true if the given resolved IP must not be contacted (loopback,
 * private, link-local, CGNAT, unspecified, multicast, reserved...).
 */
export function isBlockedAddress(ip: string): boolean {
    if (!ip) {
        return true;
    }
    // Strip an IPv6 zone id (e.g. fe80::1%eth0).
    const stripped = ip.split('%')[0].trim();
    // Normalize IPv4-mapped IPv6 to dotted IPv4 first, so EVERY v4 control below
    // (isPrivateIp AND the EXTRA_BLOCKED_V4_CIDRS loop, which isIP gates on v4)
    // applies. Without this, ::ffff:100.64.0.1 / ::ffff:224.0.0.1 etc. slip past
    // as "IPv6" and reach CGNAT / multicast / reserved / this-host ranges.
    const addr = mappedIpv4(stripped) ?? stripped;
    if (addr === '' || addr === '0.0.0.0' || addr === '::' || addr === '0:0:0:0:0:0:0:0') {
        return true;
    }
    if (isPrivateIp(addr)) {
        return true;
    }
    if (isIP(addr) === 4) {
        for (const cidr of EXTRA_BLOCKED_V4_CIDRS) {
            if (isIpInCidr(addr, cidr)) {
                return true;
            }
        }
    }
    return false;
}

export interface AssertUrlAllowedOptions {
    lookupFn?: LookupFn;
}

/**
 * Validate a single URL: must be http(s) and must not resolve to a blocked
 * address. Throws {@link SsrfBlockedError} otherwise. Returns the parsed URL.
 */
export async function assertUrlAllowed(urlStr: string, opts: AssertUrlAllowedOptions = {}): Promise<URL> {
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch {
        throw new SsrfBlockedError('Invalid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new SsrfBlockedError(`Disallowed scheme: ${url.protocol}`);
    }
    // url.hostname keeps brackets for IPv6 literals; strip them for isIP/checks.
    const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!host) {
        throw new SsrfBlockedError('Missing host');
    }

    let addresses: string[];
    if (isIP(host) !== 0) {
        addresses = [host];
    } else {
        const lookupFn = opts.lookupFn ?? defaultLookup;
        let resolved: Array<{ address: string }>;
        try {
            resolved = await lookupFn(host);
        } catch {
            throw new SsrfBlockedError('Host did not resolve');
        }
        addresses = resolved.map(r => r.address);
        if (addresses.length === 0) {
            throw new SsrfBlockedError('Host did not resolve');
        }
    }

    for (const address of addresses) {
        if (isBlockedAddress(address)) {
            throw new SsrfBlockedError(`Blocked address for host ${host}: ${address}`);
        }
    }
    return url;
}

export interface SafeFetchOptions extends RequestInit {
    /** Maximum redirect hops to follow (each re-validated). Default 5. */
    maxRedirects?: number;
    /** Injectable DNS resolver (for tests). */
    lookupFn?: LookupFn;
    /** Injectable fetch implementation (for tests). */
    fetchImpl?: typeof fetch;
}

/**
 * Fetch a URL with SSRF protection. Validates the initial URL and every
 * redirect hop against {@link isBlockedAddress}; redirects are followed
 * manually so the host of each hop is checked before the next request.
 *
 * KNOWN LIMITATION (intentional, documented): DNS TOCTOU / rebinding.
 * {@link assertUrlAllowed} resolves the host and checks the returned addresses,
 * but the subsequent `fetchImpl(currentUrl, ...)` performs its OWN, independent
 * DNS resolution. An attacker who controls an authoritative DNS server can
 * answer the guard's lookup with a public IP and then answer the fetch's lookup
 * (a few milliseconds later, e.g. with a 0-TTL record) with a private/loopback
 * IP — a classic DNS-rebinding bypass. We do NOT pin the validated IP into the
 * actual connection here, so the check is best-effort against the common cases
 * (literal internal IPs, hosts that statically resolve internal, redirects to
 * internal hosts) rather than a hard guarantee. Full protection requires
 * connecting to the exact address that was validated (e.g. a custom
 * agent/dispatcher that pins the resolved IP, or an outbound egress proxy /
 * network policy). Treat `safeFetch` as defence-in-depth, not a complete egress
 * firewall.
 */
export async function safeFetch(urlStr: string, options: SafeFetchOptions = {}): Promise<Response> {
    const { maxRedirects = 5, lookupFn, fetchImpl = fetch, ...init } = options;
    let currentUrl = urlStr;

    for (let hop = 0; hop <= maxRedirects; hop++) {
        // NOTE: this validates the host's currently-resolved addresses; the
        // fetch below resolves DNS again independently (see DNS TOCTOU /
        // rebinding limitation in this function's doc comment).
        await assertUrlAllowed(currentUrl, { lookupFn });
        const response = await fetchImpl(currentUrl, { ...init, redirect: 'manual' });

        const location = response.headers.get('location');
        const isRedirect = response.status >= 300 && response.status < 400 && location;
        if (!isRedirect) {
            return response;
        }
        // Resolve the next hop relative to the current URL and re-validate.
        currentUrl = new URL(location, currentUrl).toString();
    }
    throw new SsrfBlockedError('Too many redirects');
}
