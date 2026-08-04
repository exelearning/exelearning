/**
 * External link checking for the Electron desktop app.
 *
 * A renderer cannot read the HTTP status of a cross-origin response (CORS
 * makes it opaque), so the main process checks external links on the
 * renderer's behalf and reports the real status code — the same behaviour the
 * server-side validator (src/services/link-validator.ts) provides in online
 * mode. Unlike the server, no SSRF guard is needed: requests originate from
 * the user's own machine for the user's own links, the same trust model as
 * clicking them.
 *
 * `fetchImpl` is injected (Electron's `net.fetch` in production) so the
 * policy can be unit-tested with a mocked fetch.
 */

const DEFAULT_TIMEOUT = 10000;

// Browser-like headers: some hosts drop or 403 bare bot-like HEAD/GET.
const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * HEAD statuses that commonly mean "method not welcome" rather than "URL
 * missing". Fall back to a ranged GET before classifying the link as broken.
 * @param {number} status
 * @returns {boolean}
 */
function shouldFallbackFromHead(status) {
    return status === 405 || status === 403 || status === 401 || status === 501;
}

/**
 * Classify an HTTP status as valid (null) or broken (message).
 * Any 2xx/3xx response means the resource exists for link-check purposes.
 * @param {number} status
 * @returns {string|null}
 */
function classifyHttpStatus(status) {
    if (status >= 200 && status < 400) return null;
    return String(status);
}

function isTimeoutError(err) {
    return err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

/**
 * Check one external http(s) URL. Returns null when the link is reachable or
 * an error message when it is broken (same contract as the server validator).
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

    const request = (method, extraHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        return fetchImpl(normalizedUrl, {
            method,
            headers: { ...BROWSER_HEADERS, ...extraHeaders },
            redirect: 'follow',
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
    };

    try {
        let response;
        try {
            response = await request('HEAD');
        } catch (headError) {
            if (isTimeoutError(headError)) throw headError;
            // Some hosts drop HEAD connections entirely; retry with a ranged
            // GET before treating the link as a network failure.
            response = await request('GET', { Range: 'bytes=0-0' });
            return classifyHttpStatus(response.status);
        }
        if (shouldFallbackFromHead(response.status)) {
            response = await request('GET', { Range: 'bytes=0-0' });
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
    }
}

module.exports = {
    BROWSER_HEADERS,
    checkExternalLink,
    classifyHttpStatus,
    shouldFallbackFromHead,
};
