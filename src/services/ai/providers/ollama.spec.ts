import { describe, expect, it } from 'bun:test';
import { parseAiConfig } from '../config';
import { generate } from './ollama';

function captureFetch(responseData: unknown) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => responseData } as unknown as Response;
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
}

const ollamaConfig = parseAiConfig({
    AI_PROVIDER: 'ollama',
    AI_OLLAMA_ENDPOINT: 'http://localhost:11434',
    AI_OLLAMA_MODEL: 'llama3',
    AI_MAX_OUTPUT_TOKENS: '512',
    AI_TEMPERATURE: '0.1',
});

describe('ollama provider', () => {
    it('calls the non-streaming chat endpoint without an auth header', async () => {
        const { calls, fetchImpl } = captureFetch({ message: { content: 'a\nb' } });

        const text = await generate(ollamaConfig, 'make questions', { fetchImpl });

        expect(text).toBe('a\nb');
        expect(calls[0].url).toBe('http://localhost:11434/api/chat');
        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
        expect(headers['api-key']).toBeUndefined();
    });

    it('sends model, non-streaming flag and options', async () => {
        const { calls, fetchImpl } = captureFetch({ message: { content: 'ok' } });
        await generate(ollamaConfig, 'prompt', { fetchImpl });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.model).toBe('llama3');
        expect(body.stream).toBe(false);
        expect(body.messages).toEqual([{ role: 'user', content: 'prompt' }]);
        expect(body.options.temperature).toBeCloseTo(0.1);
        expect(body.options.num_predict).toBe(512);
    });

    it('throws a provider error when the response has no message content', async () => {
        const { fetchImpl } = captureFetch({ message: {} });
        await expect(generate(ollamaConfig, 'p', { fetchImpl })).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
    });
});
