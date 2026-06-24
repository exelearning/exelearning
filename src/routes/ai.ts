/**
 * AI Routes for Elysia.
 *
 * Online-only, authenticated endpoint that runs the configured managed AI
 * provider on the user's behalf. It is intentionally absent from STATIC_ROUTES
 * so static/offline builds neither ship it nor require provider secrets.
 *
 * Security:
 *  - Requires a valid session (requireAuth).
 *  - Returns a safe, typed error (never provider URLs/keys/payloads).
 *  - When AI is disabled or set to the external provider it fails closed with a
 *    clear error and never calls a public AI service.
 */
import { Elysia, t } from 'elysia';
import type { Kysely } from 'kysely';
import { db as defaultDb } from '../db/client';
import type { Database } from '../db/types';
import { withJwtAuth } from '../utils/route-auth';
import { requireAdmin, requireAuth } from '../utils/guards';
import { AiError, generateText as generateTextDefault, loadAiConfig as loadAiConfigDefault } from '../services/ai';

export interface AiRoutesDeps {
    db: Kysely<Database>;
    loadAiConfig: typeof loadAiConfigDefault;
    generateText: typeof generateTextDefault;
}

const defaultDeps: AiRoutesDeps = {
    db: defaultDb,
    loadAiConfig: loadAiConfigDefault,
    generateText: generateTextDefault,
};

const generateTextSchema = t.Object({
    prompt: t.String({ minLength: 1, maxLength: 20000 }),
});

/**
 * Factory to create the AI routes with dependency injection (used by tests).
 */
export function createAiRoutes(deps: AiRoutesDeps = defaultDeps) {
    const { db, loadAiConfig, generateText } = deps;

    return (
        new Elysia({ name: 'ai-routes' })
            .use(withJwtAuth())
            .onBeforeHandle(({ jwtPayload, set }) => {
                const err = requireAuth(jwtPayload);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
            })
            .post(
                '/api/ai/generate-text',
                async ({ body, set }) => {
                    const { prompt } = body as { prompt: string };
                    const config = await loadAiConfig(db);
                    try {
                        const result = await generateText(config, prompt);
                        return { text: result.text };
                    } catch (error) {
                        if (error instanceof AiError) {
                            set.status = error.status;
                            return { error: error.code, message: error.message };
                        }
                        set.status = 502;
                        return { error: 'AI_PROVIDER_ERROR', message: 'The AI request failed.' };
                    }
                },
                { body: generateTextSchema },
            )
            // Admin-only diagnostic: verify the configured managed provider responds.
            .post('/api/ai/test-connection', async ({ jwtPayload, set }) => {
                const adminErr = requireAdmin(jwtPayload);
                if (adminErr) {
                    set.status = adminErr.status;
                    return { ok: false, error: adminErr.error, message: adminErr.message };
                }
                const config = await loadAiConfig(db);
                try {
                    await generateText(config, 'Reply with the single word: OK.');
                    return { ok: true };
                } catch (error) {
                    if (error instanceof AiError) {
                        set.status = error.status;
                        // Admin-only diagnostic: include the upstream `details` snippet
                        // (e.g. Ollama's "model not found" body) so an administrator can
                        // see exactly why the managed provider failed. This endpoint is
                        // guarded by requireAdmin, so the snippet is never exposed publicly.
                        return { ok: false, error: error.code, message: error.message, details: error.details };
                    }
                    set.status = 502;
                    return { ok: false, error: 'AI_PROVIDER_ERROR', message: 'The AI request failed.' };
                }
            })
    );
}

export const aiRoutes = createAiRoutes();
