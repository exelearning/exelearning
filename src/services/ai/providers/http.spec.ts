import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { AiError } from '../types';
import {
    endpointHost,
    extractChatCompletionText,
    joinUrl,
    PROVIDER_DETAILS_MAX_LENGTH,
    postJson,
    readDetails,
    requireText,
} from './http';

function jsonResponse(data: unknown, init: { ok?: boolean; status?: number } = {}): Response {
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => data,
        text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
    } as unknown as Response;
}

// Silence and capture the diagnostic logs the provider layer now emits.
let errorSpy: ReturnType<typeof spyOn>;
beforeEach(() => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    errorSpy.mockRestore();
});

describe('joinUrl', () => {
    it('joins with exactly one slash regardless of trailing/leading slashes', () => {
        expect(joinUrl('http://h:1234', 'api/chat')).toBe('http://h:1234/api/chat');
        expect(joinUrl('http://h:1234/', '/api/chat')).toBe('http://h:1234/api/chat');
        expect(joinUrl('https://x/v1///', '///chat/completions')).toBe('https://x/v1/chat/completions');
    });
});

describe('postJson', () => {
    it('sends a JSON body with merged headers and returns the parsed response', async () => {
        let captured: { url: string; init: RequestInit } | null = null;
        const fetchImpl = (async (url: string, init: RequestInit) => {
            captured = { url, init };
            return jsonResponse({ ok: 1 });
        }) as unknown as typeof fetch;

        const result = await postJson({
            url: 'https://api.example.com/chat',
            headers: { Authorization: 'Bearer k' },
            body: { a: 1 },
            fetchImpl,
        });

        expect(result).toEqual({ ok: 1 });
        expect(captured!.url).toBe('https://api.example.com/chat');
        expect(captured!.init.method).toBe('POST');
        expect(captured!.init.body).toBe(JSON.stringify({ a: 1 }));
        expect((captured!.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
        expect((captured!.init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    });

    it('maps a non-2xx response to a provider error whose public message omits the body', async () => {
        const fetchImpl = (async () =>
            jsonResponse({ error: 'upstream detail' }, { ok: false, status: 500 })) as unknown as typeof fetch;
        const promise = postJson({ url: 'https://x/chat', body: {}, fetchImpl, provider: 'ollama' });
        await expect(promise).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', status: 502 });
        await expect(promise).rejects.toBeInstanceOf(AiError);
        // The public message states the status only; the body is never inlined into it.
        const err = (await promise.catch(e => e)) as AiError;
        expect(err.message).toBe('The AI provider returned an error (HTTP 500).');
        expect(err.message).not.toContain('upstream detail');
    });

    it('captures the upstream body as `details` and logs it for diagnostics', async () => {
        const fetchImpl = (async () =>
            jsonResponse({ error: "model 'llama3' not found" }, { ok: false, status: 500 })) as unknown as typeof fetch;
        const err = (await postJson({
            url: 'http://localhost:11434/api/chat',
            body: {},
            fetchImpl,
            provider: 'ollama',
        }).catch(e => e)) as AiError;
        expect(err.details).toContain("model 'llama3' not found");
        // Logged with provider + host context so it shows up in the container logs.
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logged = String(errorSpy.mock.calls[0][0]);
        expect(logged).toContain('ollama');
        expect(logged).toContain('localhost:11434');
        expect(logged).toContain('HTTP 500');
    });

    it('maps an AbortError to a timeout error and logs it', async () => {
        const fetchImpl = (async () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        }) as unknown as typeof fetch;
        await expect(postJson({ url: 'https://x/chat', body: {}, fetchImpl, provider: 'azure' })).rejects.toMatchObject(
            {
                code: 'AI_TIMEOUT',
                status: 504,
            },
        );
        expect(String(errorSpy.mock.calls[0][0])).toContain('timed out');
    });

    it('maps a generic network failure to a provider error and records the reason', async () => {
        const fetchImpl = (async () => {
            throw new Error('ECONNREFUSED');
        }) as unknown as typeof fetch;
        const err = (await postJson({ url: 'https://x/chat', body: {}, fetchImpl, provider: 'ollama' }).catch(
            e => e,
        )) as AiError;
        expect(err).toMatchObject({ code: 'AI_PROVIDER_ERROR', status: 502 });
        expect(err.details).toBe('ECONNREFUSED');
        expect(String(errorSpy.mock.calls[0][0])).toContain('ECONNREFUSED');
    });

    it('maps an invalid JSON body to a provider error and logs it', async () => {
        const fetchImpl = (async () =>
            ({
                ok: true,
                status: 200,
                json: async () => {
                    throw new Error('not json');
                },
            }) as unknown as Response) as unknown as typeof fetch;
        await expect(
            postJson({ url: 'https://x/chat', body: {}, fetchImpl, provider: 'openai_compat' }),
        ).rejects.toMatchObject({
            code: 'AI_PROVIDER_ERROR',
        });
        expect(String(errorSpy.mock.calls[0][0])).toContain('non-JSON');
    });
});

describe('endpointHost', () => {
    it('returns the host of a valid URL', () => {
        expect(endpointHost('http://localhost:11434/api/chat')).toBe('localhost:11434');
        expect(endpointHost('https://my-resource.openai.azure.com/openai')).toBe('my-resource.openai.azure.com');
    });

    it('returns a placeholder for an unparseable URL', () => {
        expect(endpointHost('not a url')).toBe('unknown-host');
    });
});

describe('readDetails', () => {
    it('returns the trimmed body text', async () => {
        const response = { text: async () => '  boom  ' } as unknown as Response;
        expect(await readDetails(response)).toBe('boom');
    });

    it('truncates an over-long body', async () => {
        const long = 'x'.repeat(PROVIDER_DETAILS_MAX_LENGTH + 50);
        const response = { text: async () => long } as unknown as Response;
        const result = await readDetails(response);
        expect(result.length).toBe(PROVIDER_DETAILS_MAX_LENGTH + 1); // +1 for the ellipsis
        expect(result.endsWith('…')).toBe(true);
    });

    it('returns an empty string when the body cannot be read', async () => {
        const response = {
            text: mock(async () => {
                throw new Error('stream consumed');
            }),
        } as unknown as Response;
        expect(await readDetails(response)).toBe('');
    });
});

describe('requireText', () => {
    it('returns non-empty strings', () => {
        expect(requireText('hello')).toBe('hello');
    });

    it('throws a provider error for empty/non-string values', () => {
        expect(() => requireText('')).toThrow(AiError);
        expect(() => requireText('   ')).toThrow(AiError);
        expect(() => requireText(null)).toThrow(AiError);
        expect(() => requireText(42)).toThrow(AiError);
    });
});

describe('extractChatCompletionText', () => {
    it('extracts the assistant message content', () => {
        expect(extractChatCompletionText({ choices: [{ message: { content: 'answer' } }] })).toBe('answer');
    });

    it('throws when the payload is malformed', () => {
        expect(() => extractChatCompletionText({})).toThrow(AiError);
        expect(() => extractChatCompletionText({ choices: [] })).toThrow(AiError);
    });
});
