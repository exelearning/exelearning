import { describe, expect, it } from 'bun:test';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import {
    AI_SECRET_KEYS,
    DEFAULT_OLLAMA_ENDPOINT,
    isAiProvider,
    isProviderConfigured,
    loadAiConfig,
    parseAiConfig,
    parseProvider,
    toPublicAiConfig,
} from './config';

describe('parseProvider', () => {
    it('accepts known providers', () => {
        expect(parseProvider('external')).toBe('external');
        expect(parseProvider('azure')).toBe('azure');
        expect(parseProvider('ollama')).toBe('ollama');
        expect(parseProvider('openai_compat')).toBe('openai_compat');
    });

    it('is case-insensitive and trims', () => {
        expect(parseProvider('  AZURE ')).toBe('azure');
    });

    it('falls back to external for unknown or empty values', () => {
        expect(parseProvider('gpt-9000')).toBe('external');
        expect(parseProvider('')).toBe('external');
        expect(parseProvider(undefined)).toBe('external');
    });
});

describe('isAiProvider', () => {
    it('validates against the allow-list', () => {
        expect(isAiProvider('ollama')).toBe(true);
        expect(isAiProvider('nope')).toBe(false);
    });
});

describe('parseAiConfig', () => {
    it('uses safe defaults (enabled + external) when nothing is set', () => {
        const config = parseAiConfig({});
        expect(config.enabled).toBe(true);
        expect(config.provider).toBe('external');
        expect(config.mode).toBe('external');
        expect(config.ollama.endpoint).toBe(DEFAULT_OLLAMA_ENDPOINT);
        expect(config.requestTimeoutMs).toBe(60000);
        expect(config.maxOutputTokens).toBe(4096);
        expect(config.temperature).toBeCloseTo(0.2);
    });

    it('disables AI when AI_FEATURES_ENABLED is falsey', () => {
        expect(parseAiConfig({ AI_FEATURES_ENABLED: 'false' }).enabled).toBe(false);
        expect(parseAiConfig({ AI_FEATURES_ENABLED: '0' }).enabled).toBe(false);
        expect(parseAiConfig({ AI_FEATURES_ENABLED: 'off' }).enabled).toBe(false);
    });

    it('derives managed mode for non-external providers', () => {
        expect(parseAiConfig({ AI_PROVIDER: 'azure' }).mode).toBe('managed');
        expect(parseAiConfig({ AI_PROVIDER: 'ollama' }).mode).toBe('managed');
        expect(parseAiConfig({ AI_PROVIDER: 'openai_compat' }).mode).toBe('managed');
    });

    it('falls back to external for an invalid provider', () => {
        const config = parseAiConfig({ AI_PROVIDER: 'bogus' });
        expect(config.provider).toBe('external');
        expect(config.mode).toBe('external');
    });

    it('parses a fractional temperature and falls back on invalid input', () => {
        expect(parseAiConfig({ AI_TEMPERATURE: '0.7' }).temperature).toBeCloseTo(0.7);
        expect(parseAiConfig({ AI_TEMPERATURE: 'hot' }).temperature).toBeCloseTo(0.2);
    });

    it('clamps non-positive timeout and max-output-tokens to the defaults', () => {
        expect(parseAiConfig({ AI_REQUEST_TIMEOUT_MS: '0' }).requestTimeoutMs).toBe(60000);
        expect(parseAiConfig({ AI_REQUEST_TIMEOUT_MS: '-5' }).requestTimeoutMs).toBe(60000);
        expect(parseAiConfig({ AI_MAX_OUTPUT_TOKENS: '0' }).maxOutputTokens).toBe(4096);
        // Positive overrides are respected.
        expect(parseAiConfig({ AI_REQUEST_TIMEOUT_MS: '5000' }).requestTimeoutMs).toBe(5000);
        expect(parseAiConfig({ AI_MAX_OUTPUT_TOKENS: '256' }).maxOutputTokens).toBe(256);
    });

    it('keeps a configured Ollama endpoint but defaults a blank one', () => {
        expect(parseAiConfig({ AI_OLLAMA_ENDPOINT: 'http://ollama:11434' }).ollama.endpoint).toBe(
            'http://ollama:11434',
        );
        expect(parseAiConfig({ AI_OLLAMA_ENDPOINT: '   ' }).ollama.endpoint).toBe(DEFAULT_OLLAMA_ENDPOINT);
    });
});

describe('isProviderConfigured', () => {
    it('is always true for external', () => {
        expect(isProviderConfigured(parseAiConfig({ AI_PROVIDER: 'external' }))).toBe(true);
    });

    it('requires endpoint, key, deployment and api version for azure', () => {
        const incomplete = parseAiConfig({ AI_PROVIDER: 'azure', AI_AZURE_ENDPOINT: 'https://x.openai.azure.com' });
        expect(isProviderConfigured(incomplete)).toBe(false);
        const complete = parseAiConfig({
            AI_PROVIDER: 'azure',
            AI_AZURE_ENDPOINT: 'https://x.openai.azure.com',
            AI_AZURE_API_KEY: 'key',
            AI_AZURE_DEPLOYMENT: 'gpt4o',
            AI_AZURE_API_VERSION: '2024-02-01',
        });
        expect(isProviderConfigured(complete)).toBe(true);
    });

    it('requires a model for ollama (endpoint has a default)', () => {
        expect(isProviderConfigured(parseAiConfig({ AI_PROVIDER: 'ollama' }))).toBe(false);
        expect(isProviderConfigured(parseAiConfig({ AI_PROVIDER: 'ollama', AI_OLLAMA_MODEL: 'llama3' }))).toBe(true);
    });

    it('requires endpoint and model for openai_compat; api key optional', () => {
        expect(isProviderConfigured(parseAiConfig({ AI_PROVIDER: 'openai_compat', AI_COMPAT_MODEL: 'gpt' }))).toBe(
            false,
        );
        const ok = parseAiConfig({
            AI_PROVIDER: 'openai_compat',
            AI_COMPAT_ENDPOINT: 'https://api.example.com/v1',
            AI_COMPAT_MODEL: 'gpt',
        });
        expect(isProviderConfigured(ok)).toBe(true);
    });
});

describe('toPublicAiConfig', () => {
    it('exposes only capability flags and never secrets', () => {
        const config = parseAiConfig({
            AI_PROVIDER: 'azure',
            AI_AZURE_ENDPOINT: 'https://x.openai.azure.com',
            AI_AZURE_API_KEY: 'super-secret',
            AI_AZURE_DEPLOYMENT: 'gpt4o',
            AI_AZURE_API_VERSION: '2024-02-01',
        });
        const pub = toPublicAiConfig(config);
        expect(pub).toEqual({ enabled: true, provider: 'azure', mode: 'managed', configured: true });
        expect(JSON.stringify(pub)).not.toContain('super-secret');
    });

    it('reports not-configured for an incomplete managed provider', () => {
        const pub = toPublicAiConfig(parseAiConfig({ AI_PROVIDER: 'azure' }));
        expect(pub.configured).toBe(false);
    });
});

describe('AI_SECRET_KEYS', () => {
    it('marks the provider API keys as secrets', () => {
        expect(AI_SECRET_KEYS.has('AI_AZURE_API_KEY')).toBe(true);
        expect(AI_SECRET_KEYS.has('AI_COMPAT_API_KEY')).toBe(true);
        expect(AI_SECRET_KEYS.has('AI_PROVIDER')).toBe(false);
    });
});

describe('loadAiConfig', () => {
    it('reads each key via the injected settings reader (db overrides env)', async () => {
        const stored: Record<string, string> = {
            AI_FEATURES_ENABLED: 'true',
            AI_PROVIDER: 'ollama',
            AI_OLLAMA_MODEL: 'llama3',
        };
        const getSettingString = async (_db: Kysely<Database>, key: string, fallback: string) =>
            stored[key] ?? fallback;

        const config = await loadAiConfig({} as Kysely<Database>, { getSettingString });
        expect(config.provider).toBe('ollama');
        expect(config.mode).toBe('managed');
        expect(config.ollama.model).toBe('llama3');
        expect(isProviderConfigured(config)).toBe(true);
    });
});
