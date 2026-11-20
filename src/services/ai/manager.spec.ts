import { describe, expect, it } from 'bun:test';
import { parseAiConfig } from './config';
import { assertCanGenerate, generateText, type ManagerDeps } from './manager';
import { AiError, type AiConfig, type GenerateTextOptions } from './types';

function recordingDeps() {
    const calls: Array<{ provider: string; prompt: string; options: GenerateTextOptions }> = [];
    const make = (provider: string) => async (_config: AiConfig, prompt: string, options: GenerateTextOptions) => {
        calls.push({ provider, prompt, options });
        return `from-${provider}`;
    };
    const deps: ManagerDeps = {
        providers: { azure: make('azure'), ollama: make('ollama'), openai_compat: make('openai_compat') },
    };
    return { calls, deps };
}

const azureConfig = parseAiConfig({
    AI_PROVIDER: 'azure',
    AI_AZURE_ENDPOINT: 'https://x.openai.azure.com',
    AI_AZURE_API_KEY: 'k',
    AI_AZURE_DEPLOYMENT: 'd',
    AI_AZURE_API_VERSION: '2024-02-01',
});

function expectAiError(fn: () => void, code: string, status: number) {
    let caught: unknown;
    try {
        fn();
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).code).toBe(code as AiError['code']);
    expect((caught as AiError).status).toBe(status);
}

describe('assertCanGenerate', () => {
    it('rejects disabled AI', () => {
        expectAiError(() => assertCanGenerate(parseAiConfig({ AI_FEATURES_ENABLED: 'false' })), 'AI_DISABLED', 403);
    });

    it('rejects external mode (no server-side generation)', () => {
        expectAiError(() => assertCanGenerate(parseAiConfig({ AI_PROVIDER: 'external' })), 'AI_EXTERNAL_MODE', 400);
    });

    it('rejects a misconfigured managed provider (fail closed)', () => {
        expectAiError(() => assertCanGenerate(parseAiConfig({ AI_PROVIDER: 'azure' })), 'AI_NOT_CONFIGURED', 503);
    });

    it('passes for a fully configured managed provider', () => {
        expect(() => assertCanGenerate(azureConfig)).not.toThrow();
    });
});

describe('generateText', () => {
    it('does not call any provider in external mode', async () => {
        const { calls, deps } = recordingDeps();
        await expect(generateText(parseAiConfig({ AI_PROVIDER: 'external' }), 'p', {}, deps)).rejects.toMatchObject({
            code: 'AI_EXTERNAL_MODE',
        });
        expect(calls).toHaveLength(0);
    });

    it('selects the configured provider and returns its text', async () => {
        const { calls, deps } = recordingDeps();
        const result = await generateText(azureConfig, 'make questions', {}, deps);
        expect(result).toEqual({ text: 'from-azure' });
        expect(calls).toHaveLength(1);
        expect(calls[0].provider).toBe('azure');
        // The manager wires a timeout-driven AbortSignal through to the provider.
        expect(calls[0].options.signal).toBeInstanceOf(AbortSignal);
    });

    it('selects ollama when configured', async () => {
        const { calls, deps } = recordingDeps();
        const config = parseAiConfig({ AI_PROVIDER: 'ollama', AI_OLLAMA_MODEL: 'llama3' });
        await generateText(config, 'p', {}, deps);
        expect(calls[0].provider).toBe('ollama');
    });

    it('fails closed when the managed provider is not configured', async () => {
        const { deps } = recordingDeps();
        await expect(generateText(parseAiConfig({ AI_PROVIDER: 'ollama' }), 'p', {}, deps)).rejects.toMatchObject({
            code: 'AI_NOT_CONFIGURED',
        });
    });

    it('passes through AiError thrown by the provider', async () => {
        const deps: ManagerDeps = {
            providers: {
                azure: async () => {
                    throw new AiError('AI_PROVIDER_ERROR', 'boom', 502);
                },
                ollama: async () => 'x',
                openai_compat: async () => 'x',
            },
        };
        await expect(generateText(azureConfig, 'p', {}, deps)).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' });
    });

    it('wraps an unexpected provider error as AI_PROVIDER_ERROR', async () => {
        const deps: ManagerDeps = {
            providers: {
                azure: async () => {
                    throw new Error('kaboom');
                },
                ollama: async () => 'x',
                openai_compat: async () => 'x',
            },
        };
        await expect(generateText(azureConfig, 'p', {}, deps)).rejects.toMatchObject({
            code: 'AI_PROVIDER_ERROR',
            status: 502,
        });
    });

    it('maps a provider AbortError to AI_TIMEOUT', async () => {
        const deps: ManagerDeps = {
            providers: {
                azure: async () => {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    throw err;
                },
                ollama: async () => 'x',
                openai_compat: async () => 'x',
            },
        };
        await expect(generateText(azureConfig, 'p', {}, deps)).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
    });
});
