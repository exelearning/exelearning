/**
 * Shared HTTP helpers for AI providers.
 *
 * Outbound calls use the injected `fetchImpl` (defaults to global `fetch`) so
 * tests stay hermetic. We deliberately do NOT route these through the SSRF
 * guard: the endpoint is configured server-side by an administrator (a trusted
 * value) and the browser only supplies the prompt text — never the URL. The
 * SSRF guard also blocks loopback/RFC1918 addresses, which would break the
 * primary managed use case (a local Ollama on http://localhost:11434).
 */
import { AiError } from '../types';

/** Join a base URL and a path with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
    const trimmedBase = base.replace(/\/+$/, '');
    const trimmedPath = path.replace(/^\/+/, '');
    return `${trimmedBase}/${trimmedPath}`;
}

/** Max length of an upstream body snippet captured for diagnostics/logging. */
export const PROVIDER_DETAILS_MAX_LENGTH = 500;

/** Host (never the full URL/secret query) of a provider endpoint, for log context. */
export function endpointHost(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return 'unknown-host';
    }
}

/**
 * Read and truncate an upstream response body for diagnostics. Best-effort:
 * a body that cannot be read yields an empty string rather than throwing.
 */
export async function readDetails(response: Response): Promise<string> {
    try {
        const text = (await response.text()).trim();
        return text.length > PROVIDER_DETAILS_MAX_LENGTH ? `${text.slice(0, PROVIDER_DETAILS_MAX_LENGTH)}…` : text;
    } catch {
        return '';
    }
}

export interface PostJsonOptions {
    url: string;
    headers?: Record<string, string>;
    body: unknown;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    /** Provider label (e.g. `ollama`) used only for server-side log context. */
    provider?: string;
}

/**
 * POST a JSON body and parse a JSON response, mapping transport/HTTP failures to
 * a typed {@link AiError}.
 *
 * The public error message never leaks request details (URL, key, payload), but
 * the failure is logged server-side (provider, endpoint host, HTTP status and a
 * truncated body snippet) and the snippet is attached to the error's `details`
 * so the admin-only test-connection diagnostic can surface why a managed
 * provider failed. This is what makes `HTTP 500`-style failures debuggable from
 * the container logs instead of silently opaque.
 */
export async function postJson<T = unknown>(opts: PostJsonOptions): Promise<T> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const label = opts.provider ?? 'unknown';
    const host = endpointHost(opts.url);
    let response: Response;
    try {
        response = await fetchImpl(opts.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
            body: JSON.stringify(opts.body),
            signal: opts.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`[ai] provider "${label}" request to ${host} timed out.`);
            throw new AiError('AI_TIMEOUT', 'The AI provider did not respond in time.', 504);
        }
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[ai] provider "${label}" request to ${host} failed: ${reason}`);
        throw new AiError('AI_PROVIDER_ERROR', 'Could not reach the AI provider.', 502, reason);
    }

    if (!response.ok) {
        const details = await readDetails(response);
        console.error(
            `[ai] provider "${label}" at ${host} returned HTTP ${response.status}${details ? `: ${details}` : ''}`,
        );
        throw new AiError(
            'AI_PROVIDER_ERROR',
            `The AI provider returned an error (HTTP ${response.status}).`,
            502,
            details || undefined,
        );
    }

    try {
        return (await response.json()) as T;
    } catch {
        console.error(`[ai] provider "${label}" at ${host} returned a non-JSON response.`);
        throw new AiError('AI_PROVIDER_ERROR', 'The AI provider returned an invalid response.', 502);
    }
}

/** Validate that a provider produced non-empty text, else raise a provider error. */
export function requireText(value: unknown): string {
    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }
    throw new AiError('AI_PROVIDER_ERROR', 'The AI provider returned an empty response.', 502);
}

/** Extract the assistant message from an OpenAI/Azure chat-completions payload. */
export function extractChatCompletionText(data: unknown): string {
    const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    return requireText(content);
}
