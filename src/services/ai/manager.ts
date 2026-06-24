/**
 * AI manager: selects the configured provider and runs the generate-text action.
 *
 * Fail-closed semantics:
 *  - disabled            -> AI_DISABLED
 *  - external provider   -> AI_EXTERNAL_MODE (no server-side generation)
 *  - managed but missing required fields -> AI_NOT_CONFIGURED
 * The manager never falls back to a public/external AI service.
 *
 * A per-request timeout is enforced with an AbortController driven by
 * `config.requestTimeoutMs`.
 */
import { AiError, type AiConfig, type GenerateTextOptions } from './types';
import { isProviderConfigured } from './config';
import * as azure from './providers/azure';
import * as ollama from './providers/ollama';
import * as openaiCompatible from './providers/openai-compatible';

export type ProviderGenerate = (config: AiConfig, prompt: string, options: GenerateTextOptions) => Promise<string>;

export interface ManagerDeps {
    providers: Record<'azure' | 'ollama' | 'openai_compat', ProviderGenerate>;
}

const defaultDeps: ManagerDeps = {
    providers: {
        azure: azure.generate,
        ollama: ollama.generate,
        openai_compat: openaiCompatible.generate,
    },
};

/**
 * Throw the appropriate {@link AiError} when the configuration does not allow a
 * server-side generation. Exposed so the route can fail fast before doing work.
 */
export function assertCanGenerate(config: AiConfig): void {
    if (!config.enabled) {
        throw new AiError('AI_DISABLED', 'AI features are disabled.', 403);
    }
    if (config.mode === 'external') {
        throw new AiError(
            'AI_EXTERNAL_MODE',
            'Server-side generation is not available with the external provider.',
            400,
        );
    }
    if (!isProviderConfigured(config)) {
        throw new AiError('AI_NOT_CONFIGURED', 'The AI provider is not fully configured.', 503);
    }
}

export interface GenerateTextResult {
    text: string;
}

/**
 * Generate plain text from a prompt using the configured managed provider.
 * Always throws an {@link AiError} (never leaks provider internals) on failure.
 */
export async function generateText(
    config: AiConfig,
    prompt: string,
    options: GenerateTextOptions = {},
    deps: ManagerDeps = defaultDeps,
): Promise<GenerateTextResult> {
    assertCanGenerate(config);

    const provider = deps.providers[config.provider as 'azure' | 'ollama' | 'openai_compat'];
    if (!provider) {
        // Defensive: parseProvider only yields known managed providers past assertCanGenerate.
        throw new AiError('AI_NOT_CONFIGURED', 'No AI provider is available.', 503);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
        const text = await provider(config, prompt, {
            maxOutputTokens: options.maxOutputTokens,
            temperature: options.temperature,
            fetchImpl: options.fetchImpl,
            signal: controller.signal,
        });
        return { text };
    } catch (error) {
        if (error instanceof AiError) {
            throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
            throw new AiError('AI_TIMEOUT', 'The AI provider did not respond in time.', 504);
        }
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[ai] provider "${config.provider}" generation failed: ${reason}`);
        throw new AiError('AI_PROVIDER_ERROR', 'The AI provider request failed.', 502, reason);
    } finally {
        clearTimeout(timer);
    }
}
