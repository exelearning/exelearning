/**
 * External link checking for the Electron desktop app.
 *
 * A renderer cannot read the HTTP status of a cross-origin response (CORS
 * makes it opaque), so the main process checks external links on the
 * renderer's behalf and reports the real status code — the same behaviour the
 * server-side validator (src/services/link-validator.ts) provides in online
 * mode.
 *
 * Network stack: Node's fetch (undici) is used on purpose instead of
 * Electron's `net.fetch`. Measured 2026-08-04 from an EU IP (PR #2208
 * review): Chromium's stack receives Google's cookie-consent interstitial as
 * a plain 200 — for existing and deleted YouTube channels alike — and its
 * `response.url` is empty in Electron 43, so the redirect cannot even be
 * detected. undici resolves the consent chain (302 → consent.youtube.com →
 * 303 → `?ucbcb=1`) to the real page status and reports a reliable
 * `response.url`. `net.fetch` remains as a fallback for networks undici
 * cannot reach directly (it honors the system proxy, undici does not).
 *
 * Security model: local and private addresses (loopback, RFC1918,
 * link-local/metadata, CGNAT…) are NEVER probed automatically — an untrusted
 * OER must not turn link validation into a LAN scan. Those links are flagged
 * for manual review instead of being requested. Public addresses are checked
 * from the user's machine, like a normal navigation would be.
 *
 * `fetchImpl`, `fallbackFetchImpl` and `lookupFn` are injected so the policy
 * can be unit-tested hermetically.
 *
 * Result contract (also the `app:checkLink` IPC contract):
 *   { status: 'valid' }                    — the requested host answered 2xx/3xx-resolved
 *   { status: 'broken', error }            — proven dead (HTTP error code or network failure)
 *   { status: 'unknown', reason, detail? } — needs a manual review; the renderer
 *                                            maps `reason` to a translated message
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
 * Map a fetch failure to a readable broken-link message. Node's fetch
 * reports failures via error.cause (code/message); Electron's net.fetch puts
 * the Chromium code in the message (e.g. "net::ERR_NAME_NOT_RESOLVED").
 * @param {unknown} err
 * @returns {string}
 */
function mapNetworkError(err) {
    const detail = `${err?.cause?.code || err?.code || ''} ${err?.cause?.message || ''} ${err?.message || ''}`;
    if (detail.includes('ENOTFOUND') || detail.includes('ERR_NAME_NOT_RESOLVED')) return 'Could not resolve host';
    if (detail.includes('ECONNREFUSED') || detail.includes('ERR_CONNECTION_REFUSED')) return 'Connection refused';
    if (detail.includes('redirect count') || detail.includes('ERR_TOO_MANY_REDIRECTS')) return 'Too many redirects';
    return err?.message || 'Network error';
}

/**
 * Host of a URL, lowercased and without a leading "www." — the unit used to
 * decide whether a redirect stayed on the requested site.
 * @param {string} url
 * @returns {string}
 */
function comparableHost(url) {
    return new URL(url).host.replace(/^www\./, '');
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
 * One ranged GET with browser-like headers and a timeout, body cancelled
 * unread. `Accept-Encoding: identity` because a compressed body sliced by
 * Range is a truncated gzip stream that some fetch implementations refuse.
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
async function rangedGet(fetchImpl, url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0', 'Accept-Encoding': 'identity' },
            redirect: 'follow',
            signal: controller.signal,
        });
        try {
            await response.body?.cancel();
        } catch (_e) {
            // Stream already closed or locked — the status is all we need.
        }
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check one external http(s) URL with a single ranged GET — no HEAD (too
 * many hosts reject it, spoof it or hang on it).
 *
 * @param {string} url - http(s) or protocol-relative URL
 * @param {{ fetchImpl: typeof fetch, fallbackFetchImpl?: typeof fetch, timeout?: number }} options
 * @returns {Promise<{status: 'valid'|'broken'|'unknown', reason?: string, detail?: string, error: string|null}>}
 */
async function checkExternalLink(url, { fetchImpl, fallbackFetchImpl, timeout = DEFAULT_TIMEOUT }) {
    const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;
    try {
        new URL(normalizedUrl);
    } catch (_e) {
        return { status: 'broken', error: 'URL using bad/illegal format' };
    }

    let response;
    try {
        response = await rangedGet(fetchImpl, normalizedUrl, timeout);
    } catch (err) {
        const error = isTimeoutError(err) ? 'Timeout' : mapNetworkError(err);
        // A redirect loop is the server's behaviour, not a reachability
        // problem: retrying through another stack cannot improve on it.
        if (error === 'Too many redirects') {
            return { status: 'broken', error };
        }
        // Unreachable directly: retry once through Chromium's stack, which
        // honors the system proxy that undici knows nothing about
        // (school/corporate networks).
        if (fallbackFetchImpl) {
            try {
                const proxied = await rangedGet(fallbackFetchImpl, normalizedUrl, timeout);
                const proxiedError = classifyHttpStatus(proxied.status);
                if (proxiedError) {
                    return { status: 'broken', error: proxiedError };
                }
                // 2xx through net.fetch: its response.url is empty in
                // Electron, so we cannot verify WHO answered (consent walls
                // answer 200 too) — only a human can confirm this one.
                return { status: 'unknown', reason: 'unverified-proxy', error: null };
            } catch (_fallbackError) {
                // Both stacks failed: report the direct error.
            }
        }
        return { status: 'broken', error };
    }

    // Final-host rule (PR #2208 review): green must mean the REQUESTED host
    // answered, not that someone answered. A 2xx that landed on another host
    // (consent gate, captive portal, login wall, URL shortener target) needs
    // a human; an error status on another host is broken either way.
    if (response.url) {
        try {
            const requestedHost = comparableHost(normalizedUrl);
            const finalHost = comparableHost(response.url);
            if (finalHost !== requestedHost) {
                const statusError = classifyHttpStatus(response.status);
                if (statusError) {
                    return { status: 'broken', error: statusError };
                }
                return { status: 'unknown', reason: 'cross-host-redirect', detail: finalHost, error: null };
            }
        } catch (_e) {
            // Unparseable final URL: fall through to plain status classification.
        }
    }

    // A response that is still a redirect after `redirect: 'follow'` (3xx
    // without a Location header) proves nothing about the target.
    if (response.status >= 300 && response.status < 400) {
        return { status: 'unknown', reason: 'unresolved-redirect', error: null };
    }

    const error = classifyHttpStatus(response.status);
    return error ? { status: 'broken', error } : { status: 'valid', error: null };
}

/**
 * Full desktop link check: guards non-external URLs, refuses local/private
 * addresses, then probes with {@link checkExternalLink}. This is the
 * behaviour behind the `app:checkLink` IPC handler.
 *
 * @param {string} url
 * @param {{ fetchImpl: typeof fetch, fallbackFetchImpl?: typeof fetch, lookupFn?: Function, timeout?: number }} options
 * @returns {Promise<{status: 'valid'|'broken'|'unknown', reason?: string, detail?: string, error: string|null}>}
 */
async function checkLink(url, { fetchImpl, fallbackFetchImpl, lookupFn, timeout } = {}) {
    if (typeof url !== 'string' || !/^(https?:)?\/\//.test(url)) {
        return { status: 'unknown', reason: 'not-external', error: null };
    }
    if (await resolvesToPrivateAddress(url, { lookupFn })) {
        return { status: 'unknown', reason: 'private-address', error: null };
    }
    return checkExternalLink(url, { fetchImpl, fallbackFetchImpl, timeout });
}

module.exports = {
    BROWSER_HEADERS,
    checkExternalLink,
    checkLink,
    classifyHttpStatus,
    isPrivateAddress,
    resolvesToPrivateAddress,
};
