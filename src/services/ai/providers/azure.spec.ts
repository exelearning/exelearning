import { describe, expect, it } from 'bun:test';
import { parseAiConfig } from '../config';
import { generate } from './azure';

function captureFetch(responseData: unknown) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, status: 200, json: async () => responseData } as unknown as Response;
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
}

const azureConfig = parseAiConfig({
    AI_PROVIDER: 'azure',
    AI_AZURE_ENDPOINT: 'https://my-resource.openai.azure.com',
    AI_AZURE_API_KEY: 'azure-secret-key',
    AI_AZURE_DEPLOYMENT: 'gpt-4o',
    AI_AZURE_API_VERSION: '2024-02-01',
    AI_MAX_OUTPUT_TOKENS: '1000',
    AI_TEMPERATURE: '0.3',
});

describe('azure provider', () => {
    it('calls the deployment chat-completions URL with the api-key header', async () => {
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'q1\nq2' } }] });

        const text = await generate(azureConfig, 'make questions', { fetchImpl });

        expect(text).toBe('q1\nq2');
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(
            'https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-01',
        );
        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers['api-key']).toBe('azure-secret-key');
        expect(headers.Authorization).toBeUndefined();
    });

    it('sends a chat-completions payload using config max_tokens/temperature', async () => {
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'ok' } }] });
        await generate(azureConfig, 'prompt text', { fetchImpl });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.messages).toEqual([{ role: 'user', content: 'prompt text' }]);
        expect(body.max_tokens).toBe(1000);
        expect(body.temperature).toBeCloseTo(0.3);
    });

    it('honours per-call option overrides', async () => {
        const { calls, fetchImpl } = captureFetch({ choices: [{ message: { content: 'ok' } }] });
        await generate(azureConfig, 'p', { fetchImpl, maxOutputTokens: 7, temperature: 0.9 });
        const body = JSON.parse(calls[0].init.body as string);
        expect(body.max_tokens).toBe(7);
        expect(body.temperature).toBeCloseTo(0.9);
    });

    it('throws a provider error on an empty completion', async () => {
        const { fetchImpl } = captureFetch({ choices: [{ message: { content: '' } }] });
        await expect(generate(azureConfig, 'p', { fetchImpl })).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
    });
});
