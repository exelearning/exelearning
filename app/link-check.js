/**
 * External link checking for the Electron desktop app.
 *
 * A renderer cannot read the HTTP status of a cross-origin response (CORS
 * makes it opaque), so the main process checks external links on the
 * renderer's behalf and reports the real status code — the same behaviour the
 * server-side validator (src/services/link-validator.ts) provides in online
 * mode.
 *
 * Security model: local and private addresses (loopback, RFC1918,
 * link-local/metadata, CGNAT…) are NEVER probed automatically — an untrusted
 * OER must not turn link validation into a LAN scan. Those links are flagged
 * for manual review instead of being requested. Public addresses are checked
 * from the user's machine, like a normal navigation would be.
 *
 * `fetchImpl` (Electron's `net.fetch` in production) and `lookupFn` are
 * injected so the policy can be unit-tested hermetically.
 */

const nodeNet = require('net');
const dns = require('dns');

const DEFAULT_TIMEOUT = 10000;

// Browser-like headers: some hosts drop or 403 bare bot-like requests.
const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Classify an HTTP status as valid (null) or broken (message).
 * Any 2xx/3xx response means the resource exists for link-check purposes.
 * @param {number} status
 * @returns {string|null}
 */
function classifyHttpStatus(status) {
    if (status >= 200 && status < 400) return null;
    // 416 = our `Range: bytes=0-0` was not satisfiable (zero-length
    // resource): the resource exists, there is just no byte 0 to serve.
    if (status === 416) return null;
    return String(status);
}

function isTimeoutError(err) {
    return err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

/**
 * True for IPv4 addresses that must not be probed automatically.
 * Mirrors the ranges enforced server-side by src/utils/ssrf-guard.ts
 * (the authority on this list): loopback, RFC1918, link-local (which
 * includes cloud metadata 169.254.169.254), CGNAT and "this host".
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIpv4(ip) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

/**
 * True for IPv6 addresses that must not be probed automatically:
 * loopback/unspecified, unique-local (fc00::/7), link-local (fe80::/10)
 * and IPv4-mapped forms of the ranges above.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIpv6(ip) {
    const addr = ip.split('%')[0].toLowerCase();
    if (addr === '::1' || addr === '::') return true;
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(addr)) return true;
    const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return false;
}

/**
 * True when the address is local/private and must not be probed.
 * @param {string} address
 * @param {number} family - 4 or 6
 * @returns {boolean}
 */
function isPrivateAddress(address, family) {
    return family === 6 ? isPrivateIpv6(address) : isPrivateIpv4(address);
}

/**
 * True when a URL's host is a local/private address — either a literal IP
 * or a name that resolves to one. Unresolvable names return false so the
 * check itself reports the DNS failure ("Could not resolve host").
 *
 * @param {string} url
 * @param {{ lookupFn?: (hostname: string) => Promise<Array<{address: string, family: number}>> }} [options]
 * @returns {Promise<boolean>}
 */
async function resolvesToPrivateAddress(url, { lookupFn } = {}) {
    let hostname;
    try {
        hostname = new URL(url.startsWith('//') ? `https:${url}` : url).hostname;
    } catch (_e) {
        return false;
    }
    // URL keeps brackets around IPv6 literals ("[::1]").
    const bare = hostname.replace(/^\[|\]$/g, '');
    if (bare === 'localhost' || bare.endsWith('.localhost')) return true;

    const literalFamily = nodeNet.isIP(bare);
    if (literalFamily) return isPrivateAddress(bare, literalFamily);

    const lookup = lookupFn || (async (name) => dns.promises.lookup(name, { all: true, verbatim: true }));
    try {
        const addresses = await lookup(bare);
        return addresses.some(({ address, family }) => isPrivateAddress(address, family));
    } catch (_e) {
        return false;
    }
}

/**
 * Check one external http(s) URL. Returns null when the link is reachable or
 * an error message when it is broken (same contract as the server validator).
 *
 * A single ranged GET is used — no HEAD. Too many hosts reject HEAD
 * (405/403), lie about it (educa.madrid answers HEAD with 404 while GET
 * returns the real status) or simply hang on it. A GET is what a browser
 * sends, so hosts answer it truthfully; `Range: bytes=0-0` keeps the
 * transfer to one byte on servers that honor it, and the body is cancelled
 * unread either way.
 *
 * @param {string} url - http(s) or protocol-relative URL
 * @param {{ fetchImpl: typeof fetch, timeout?: number }} options
 * @returns {Promise<string|null>}
 */
async function checkExternalLink(url, { fetchImpl, timeout = DEFAULT_TIMEOUT }) {
    const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;
    try {
        new URL(normalizedUrl);
    } catch (_e) {
        return 'URL using bad/illegal format';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetchImpl(normalizedUrl, {
            method: 'GET',
            // identity: a compressed body sliced by Range is a truncated
            // gzip stream that some fetch implementations refuse to accept.
            headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0', 'Accept-Encoding': 'identity' },
            redirect: 'follow',
            signal: controller.signal,
        });
        try {
            await response.body?.cancel();
        } catch (_e) {
            // Stream already closed or locked — the status is all we need.
        }
        return classifyHttpStatus(response.status);
    } catch (err) {
        if (isTimeoutError(err)) return 'Timeout';
        // Node's fetch reports failures via error.cause.code (ENOTFOUND);
        // Electron's net.fetch puts the Chromium code in the message
        // (e.g. "net::ERR_NAME_NOT_RESOLVED"). Map both to readable text.
        const detail = `${err?.cause?.code || err?.code || ''} ${err?.message || ''}`;
        if (detail.includes('ENOTFOUND') || detail.includes('ERR_NAME_NOT_RESOLVED')) return 'Could not resolve host';
        if (detail.includes('ECONNREFUSED') || detail.includes('ERR_CONNECTION_REFUSED')) return 'Connection refused';
        return err?.message || 'Network error';
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = {
    BROWSER_HEADERS,
    checkExternalLink,
    classifyHttpStatus,
    isPrivateAddress,
    resolvesToPrivateAddress,
};
