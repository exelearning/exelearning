/**
 * Shared types for the server-managed AI subsystem.
 *
 * The design separates concerns the way Moodle's AI subsystem does (without
 * copying its code):
 *  - Placement: where AI is offered in the UI (game-generation iDevices).
 *  - Action: what is requested (generate text / questions).
 *  - Provider: who executes the request (Azure, Ollama, OpenAI-compatible).
 *  - Manager: selects the configured provider and runs the action.
 *
 * Secrets (API keys) live only inside {@link AiConfig} on the server. The
 * frontend only ever receives {@link PublicAiConfig}, which exposes capability
 * flags but never endpoints, keys, deployment names or model names.
 */

/** Accepted values for the `AI_PROVIDER` setting (allow-list). */
export const AI_PROVIDERS = ['external', 'azure', 'ollama', 'openai_compat'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * High-level mode derived from the provider:
 *  - `external`: the user is offered public AI assistants (ChatGPT, Claude...)
 *    and the prompt is opened in their web UI. No server call happens.
 *  - `managed`: eXeLearning calls a server-side provider on the user's behalf.
 */
export type AiMode = 'external' | 'managed';

export interface AzureConfig {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
}

export interface OllamaConfig {
    endpoint: string;
    model: string;
}

export interface OpenAiCompatConfig {
    endpoint: string;
    apiKey: string;
    model: string;
}

/** Full, server-only AI configuration. Contains secrets — never serialize to the client. */
export interface AiConfig {
    enabled: boolean;
    provider: AiProvider;
    mode: AiMode;
    azure: AzureConfig;
    ollama: OllamaConfig;
    compat: OpenAiCompatConfig;
    requestTimeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
}

/**
 * Safe subset of the AI configuration sent to the browser.
 * Exposes only capability flags — no endpoints, keys, deployments or models.
 */
export interface PublicAiConfig {
    enabled: boolean;
    provider: AiProvider;
    mode: AiMode;
    configured: boolean;
}

/** Per-call overrides + injectable transport (for hermetic tests). */
export interface GenerateTextOptions {
    maxOutputTokens?: number;
    temperature?: number;
    /** Abort signal (the manager wires a timeout-driven controller here). */
    signal?: AbortSignal;
    /** Injectable fetch implementation. Defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
}

/** Stable error codes mapped to HTTP responses by the route layer. */
export type AiErrorCode = 'AI_DISABLED' | 'AI_EXTERNAL_MODE' | 'AI_NOT_CONFIGURED' | 'AI_PROVIDER_ERROR' | 'AI_TIMEOUT';

/**
 * Error raised by the AI manager/providers. Carries a stable {@link AiErrorCode}
 * and an HTTP status so the route can respond without leaking provider details.
 *
 * `details` is an optional, truncated diagnostic snippet of the upstream
 * provider's response/failure (e.g. Ollama's `model 'x' not found` body). It is
 * captured for server-side logging and the **admin-only** test-connection
 * diagnostic. It is NEVER included in the public `/api/ai/generate-text`
 * response, so it cannot leak provider internals to ordinary users.
 */
export class AiError extends Error {
    readonly code: AiErrorCode;
    readonly status: number;
    readonly details?: string;

    constructor(code: AiErrorCode, message: string, status: number, details?: string) {
        super(message);
        this.name = 'AiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
