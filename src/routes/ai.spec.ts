import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createAiRoutes, type AiRoutesDeps } from './ai';
import { parseAiConfig } from '../services/ai/config';
import { generateText as realGenerateText } from '../services/ai/manager';
import { AiError, type AiConfig } from '../services/ai/types';

const TEST_JWT_SECRET = 'ai-route-test-secret';
const originalEnv = { ...process.env };

beforeEach(() => {
    process.env.API_JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterEach(() => {
    process.env = { ...originalEnv };
});

async function signToken(payload: Record<string, unknown>): Promise<string> {
    const tempApp = new Elysia().use(jwt({ name: 'jwt', secret: TEST_JWT_SECRET }));
    // @ts-expect-error decorator typing is loose in tests
    return tempApp.decorator.jwt.sign(payload);
}

function buildApp(overrides: Partial<AiRoutesDeps> = {}) {
    const deps: AiRoutesDeps = {
        db: {} as Kysely<Database>,
        loadAiConfig: async () => parseAiConfig({ AI_PROVIDER: 'external' }),
        generateText: realGenerateText,
        ...overrides,
    };
    return new Elysia().use(createAiRoutes(deps));
}

function postGenerate(token: string | null, body: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return new Request('http://localhost/api/ai/generate-text', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

const userToken = () => signToken({ sub: 7, email: 'u@e.net', roles: ['ROLE_USER'], isGuest: false });
const adminToken = () => signToken({ sub: 1, email: 'a@e.net', roles: ['ROLE_USER', 'ROLE_ADMIN'], isGuest: false });

const azureConfig = parseAiConfig({
    AI_PROVIDER: 'azure',
    AI_AZURE_ENDPOINT: 'https://x.openai.azure.com',
    AI_AZURE_API_KEY: 'secret-key',
    AI_AZURE_DEPLOYMENT: 'd',
    AI_AZURE_API_VERSION: '2024-02-01',
});

describe('POST /api/ai/generate-text', () => {
    it('requires authentication', async () => {
        const app = buildApp();
        const res = await app.handle(postGenerate(null, { prompt: 'hello' }));
        expect(res.status).toBe(401);
    });

    it('returns a safe disabled response when AI is disabled', async () => {
        const app = buildApp({ loadAiConfig: async () => parseAiConfig({ AI_FEATURES_ENABLED: 'false' }) });
        const res = await app.handle(postGenerate(await userToken(), { prompt: 'hello' }));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('AI_DISABLED');
    });

    it('rejects external mode (no server-side generation)', async () => {
        const app = buildApp({ loadAiConfig: async () => parseAiConfig({ AI_PROVIDER: 'external' }) });
        const res = await app.handle(postGenerate(await userToken(), { prompt: 'hello' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('AI_EXTERNAL_MODE');
    });

    it('returns generated text for a configured managed provider', async () => {
        const app = buildApp({
            loadAiConfig: async () => azureConfig,
            generateText: async (_config: AiConfig, prompt: string) => ({ text: `Q for: ${prompt}` }),
        });
        const res = await app.handle(postGenerate(await userToken(), { prompt: 'biology' }));
        expect(res.status).toBe(200);
        expect((await res.json()).text).toBe('Q for: biology');
    });

    it('maps provider failures to a useful error without leaking secrets or upstream details', async () => {
        const app = buildApp({
            loadAiConfig: async () => azureConfig,
            generateText: async () => {
                // The error carries an upstream `details` snippet for admin diagnostics;
                // the public generate-text response must NOT expose it.
                throw new AiError(
                    'AI_PROVIDER_ERROR',
                    'The AI provider returned an error (HTTP 500).',
                    502,
                    'upstream stack trace with secret-key',
                );
            },
        });
        const res = await app.handle(postGenerate(await userToken(), { prompt: 'p' }));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toBe('AI_PROVIDER_ERROR');
        expect(body.details).toBeUndefined();
        expect(JSON.stringify(body)).not.toContain('secret-key');
        expect(JSON.stringify(body)).not.toContain('upstream stack trace');
    });

    it('validates the request body (empty prompt rejected)', async () => {
        const app = buildApp();
        const res = await app.handle(postGenerate(await userToken(), { prompt: '' }));
        expect(res.status).toBe(422);
    });
});

describe('POST /api/ai/test-connection', () => {
    function postTest(token: string | null) {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        return new Request('http://localhost/api/ai/test-connection', { method: 'POST', headers });
    }

    it('rejects non-admin users', async () => {
        const app = buildApp({ loadAiConfig: async () => azureConfig });
        const res = await app.handle(postTest(await userToken()));
        expect(res.status).toBe(403);
        expect((await res.json()).ok).toBe(false);
    });

    it('reports success when the provider responds for an admin', async () => {
        const app = buildApp({
            loadAiConfig: async () => azureConfig,
            generateText: async () => ({ text: 'OK' }),
        });
        const res = await app.handle(postTest(await adminToken()));
        expect(res.status).toBe(200);
        expect((await res.json()).ok).toBe(true);
    });

    it('reports a clear error when the managed provider is misconfigured', async () => {
        const app = buildApp({
            loadAiConfig: async () => parseAiConfig({ AI_PROVIDER: 'ollama' }),
            generateText: realGenerateText,
        });
        const res = await app.handle(postTest(await adminToken()));
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error).toBe('AI_NOT_CONFIGURED');
    });

    it('surfaces the upstream `details` snippet to an admin so a provider failure is debuggable', async () => {
        const app = buildApp({
            loadAiConfig: async () => azureConfig,
            generateText: async () => {
                throw new AiError(
                    'AI_PROVIDER_ERROR',
                    'The AI provider returned an error (HTTP 500).',
                    502,
                    "model 'llama3' not found, try pulling it first",
                );
            },
        });
        const res = await app.handle(postTest(await adminToken()));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error).toBe('AI_PROVIDER_ERROR');
        expect(body.details).toContain("model 'llama3' not found");
    });
});
