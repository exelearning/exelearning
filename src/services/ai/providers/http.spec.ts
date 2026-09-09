import { describe, expect, it } from 'bun:test';
import { AiError } from '../types';
import { extractChatCompletionText, joinUrl, postJson, requireText } from './http';

function jsonResponse(data: unknown, init: { ok?: boolean; status?: number } = {}): Response {
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => data,
    } as unknown as Response;
}

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

    it('maps a non-2xx response to a provider error (no details leaked)', async () => {
        const fetchImpl = (async () =>
            jsonResponse({ error: 'secret detail' }, { ok: false, status: 401 })) as unknown as typeof fetch;
        const promise = postJson({ url: 'https://x/chat', body: {}, fetchImpl });
        await expect(promise).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', status: 502 });
        await expect(promise).rejects.toBeInstanceOf(AiError);
    });

    it('maps an AbortError to a timeout error', async () => {
        const fetchImpl = (async () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        }) as unknown as typeof fetch;
        await expect(postJson({ url: 'https://x/chat', body: {}, fetchImpl })).rejects.toMatchObject({
            code: 'AI_TIMEOUT',
            status: 504,
        });
    });

    it('maps a generic network failure to a provider error', async () => {
        const fetchImpl = (async () => {
            throw new Error('ECONNREFUSED');
        }) as unknown as typeof fetch;
        await expect(postJson({ url: 'https://x/chat', body: {}, fetchImpl })).rejects.toMatchObject({
            code: 'AI_PROVIDER_ERROR',
            status: 502,
        });
    });

    it('maps an invalid JSON body to a provider error', async () => {
        const fetchImpl = (async () =>
            ({
                ok: true,
                status: 200,
                json: async () => {
                    throw new Error('not json');
                },
            }) as unknown as Response) as unknown as typeof fetch;
        await expect(postJson({ url: 'https://x/chat', body: {}, fetchImpl })).rejects.toMatchObject({
            code: 'AI_PROVIDER_ERROR',
        });
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
