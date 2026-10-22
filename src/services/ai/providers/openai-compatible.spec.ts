import { describe, expect, it } from 'bun:test';
import { parseAiConfig } from '../config';
import { generate } from './openai-compatible';

function captureFetch(responseData: unknown) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => responseData } as unknown as Response;
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
}

describe('openai-compatible provider', () => {
    it('calls {endpoint}/chat/completions with a Bearer token when a key is set', async () => {
        const config = parseAiConfig({
            AI_PROVIDER: 'openai_compat',
            AI_COMPAT_ENDPOINT: 'https://api.example.com/v1',
            AI_COMPAT_API_KEY: 'compat-secret',
            AI_COMPAT_MODEL: 'gpt-4o-mini',
        });
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'x' } }] });

        const text = await generate(config, 'prompt', { fetchImpl });

        expect(text).toBe('x');
        expect(calls[0].url).toBe('https://api.example.com/v1/chat/completions');
        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer compat-secret');
        const body = JSON.parse(calls[0].init.body as string);
        expect(body.model).toBe('gpt-4o-mini');
        expect(body.messages).toEqual([{ role: 'user', content: 'prompt' }]);
    });

    it('sends max_completion_tokens and temperature in the request body', async () => {
        const config = parseAiConfig({
            AI_PROVIDER: 'openai_compat',
            AI_COMPAT_ENDPOINT: 'https://api.example.com/v1',
            AI_COMPAT_MODEL: 'gpt-4o-mini',
            AI_MAX_OUTPUT_TOKENS: '512',
            AI_TEMPERATURE: '0.5',
        });
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'x' } }] });

        await generate(config, 'p', { fetchImpl });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.max_completion_tokens).toBe(512);
        expect(body).not.toHaveProperty('max_tokens');
        expect(body.temperature).toBeCloseTo(0.5);
    });

    it('omits the Authorization header when no key is configured', async () => {
        const config = parseAiConfig({
            AI_PROVIDER: 'openai_compat',
            AI_COMPAT_ENDPOINT: 'https://gateway.local/v1',
            AI_COMPAT_MODEL: 'local-model',
        });
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'x' } }] });

        await generate(config, 'p', { fetchImpl });

        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });
});
