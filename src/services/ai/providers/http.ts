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

export interface PostJsonOptions {
    url: string;
    headers?: Record<string, string>;
    body: unknown;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
}

/**
 * POST a JSON body and parse a JSON response, mapping transport/HTTP failures to
 * a typed {@link AiError} that never leaks request details (URL, key, payload).
 */
export async function postJson<T = unknown>(opts: PostJsonOptions): Promise<T> {
    const fetchImpl = opts.fetchImpl ?? fetch;
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
            throw new AiError('AI_TIMEOUT', 'The AI provider did not respond in time.', 504);
        }
        throw new AiError('AI_PROVIDER_ERROR', 'Could not reach the AI provider.', 502);
    }

    if (!response.ok) {
        throw new AiError('AI_PROVIDER_ERROR', `The AI provider returned an error (HTTP ${response.status}).`, 502);
    }

    try {
        return (await response.json()) as T;
    } catch {
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
