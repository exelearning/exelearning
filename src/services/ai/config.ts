/**
 * AI configuration parsing and loading.
 *
 * `parseAiConfig` is a pure function over a flat record of raw string values so
 * it can be unit-tested without a database. `loadAiConfig` is a thin async
 * wrapper that reads each key from `app_settings` (admin overrides) falling back
 * to the matching `process.env` value, then delegates to `parseAiConfig`.
 *
 * Defaults: AI features are ENABLED and the provider is `external`, which
 * preserves the historical behaviour (public AI assistant links) for
 * installations that do not configure anything.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import { getSettingString as getSettingStringDefault, parseBoolean, parseNumber } from '../app-settings';
import { AI_PROVIDERS, type AiConfig, type AiProvider, type PublicAiConfig } from './types';

/** Every setting key the AI subsystem reads. Shared by the admin allow-list. */
export const AI_SETTING_KEYS = [
    'AI_FEATURES_ENABLED',
    'AI_PROVIDER',
    'AI_AZURE_ENDPOINT',
    'AI_AZURE_API_KEY',
    'AI_AZURE_DEPLOYMENT',
    'AI_AZURE_API_VERSION',
    'AI_OLLAMA_ENDPOINT',
    'AI_OLLAMA_MODEL',
    'AI_COMPAT_ENDPOINT',
    'AI_COMPAT_API_KEY',
    'AI_COMPAT_MODEL',
    'AI_REQUEST_TIMEOUT_MS',
    'AI_MAX_OUTPUT_TOKENS',
    'AI_TEMPERATURE',
] as const;

/** AI setting keys whose value is a secret and must never be returned to a client. */
export const AI_SECRET_KEYS = new Set<string>(['AI_AZURE_API_KEY', 'AI_COMPAT_API_KEY']);

/** Default Ollama endpoint when none is configured. */
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;

/** Returns true when `raw` is a recognised provider. */
export function isAiProvider(raw: string): raw is AiProvider {
    return (AI_PROVIDERS as readonly string[]).includes(raw);
}

/**
 * Parse a provider string against the allow-list. Unknown values fall back to
 * `external` (fail-safe: we never silently activate a managed provider).
 */
export function parseProvider(raw: string | undefined): AiProvider {
    const value = (raw ?? '').trim().toLowerCase();
    return isAiProvider(value) ? value : 'external';
}

function parseFloatOr(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse a strictly positive integer setting. Non-positive values (0 or
 * negative) fall back to the default so a misconfiguration cannot, for example,
 * set a 0ms timeout that aborts every request immediately.
 */
function positiveNumber(value: string | undefined, fallback: number): number {
    const parsed = parseNumber(value, fallback);
    return parsed > 0 ? parsed : fallback;
}

/**
 * Build a typed {@link AiConfig} from a flat record of raw string values.
 * Pure and synchronous — the canonical place to unit-test parsing rules.
 */
export function parseAiConfig(raw: Record<string, string | undefined>): AiConfig {
    const provider = parseProvider(raw.AI_PROVIDER);
    const mode = provider === 'external' ? 'external' : 'managed';
    return {
        enabled: parseBoolean(raw.AI_FEATURES_ENABLED, true),
        provider,
        mode,
        azure: {
            endpoint: (raw.AI_AZURE_ENDPOINT ?? '').trim(),
            apiKey: (raw.AI_AZURE_API_KEY ?? '').trim(),
            deployment: (raw.AI_AZURE_DEPLOYMENT ?? '').trim(),
            apiVersion: (raw.AI_AZURE_API_VERSION ?? '').trim(),
        },
        ollama: {
            endpoint: (raw.AI_OLLAMA_ENDPOINT ?? '').trim() || DEFAULT_OLLAMA_ENDPOINT,
            model: (raw.AI_OLLAMA_MODEL ?? '').trim(),
        },
        compat: {
            endpoint: (raw.AI_COMPAT_ENDPOINT ?? '').trim(),
            apiKey: (raw.AI_COMPAT_API_KEY ?? '').trim(),
            model: (raw.AI_COMPAT_MODEL ?? '').trim(),
        },
        requestTimeoutMs: positiveNumber(raw.AI_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
        maxOutputTokens: positiveNumber(raw.AI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
        temperature: parseFloatOr(raw.AI_TEMPERATURE, DEFAULT_TEMPERATURE),
    };
}

/**
 * Whether the configured managed provider has all required fields. For the
 * `external` provider this is always true (no server-side configuration needed).
 */
export function isProviderConfigured(config: AiConfig): boolean {
    switch (config.provider) {
        case 'external':
            return true;
        case 'azure':
            return Boolean(
                config.azure.endpoint && config.azure.apiKey && config.azure.deployment && config.azure.apiVersion,
            );
        case 'ollama':
            // Endpoint always has a default; only the model is mandatory.
            return Boolean(config.ollama.endpoint && config.ollama.model);
        case 'openai_compat':
            // API key is optional (e.g. self-hosted gateways); endpoint + model required.
            return Boolean(config.compat.endpoint && config.compat.model);
        default:
            return false;
    }
}

/** Derive the safe, client-facing capability object. Never includes secrets. */
export function toPublicAiConfig(config: AiConfig): PublicAiConfig {
    return {
        enabled: config.enabled,
        provider: config.provider,
        mode: config.mode,
        configured: isProviderConfigured(config),
    };
}

export interface LoadAiConfigDeps {
    getSettingString: typeof getSettingStringDefault;
}

const defaultLoadDeps: LoadAiConfigDeps = { getSettingString: getSettingStringDefault };

/**
 * Read every AI setting from the database (with `process.env` as the fallback)
 * and return the parsed configuration. Values are read as strings and parsed by
 * {@link parseAiConfig} so there is a single source of truth for parsing.
 */
export async function loadAiConfig(db: Kysely<Database>, deps: LoadAiConfigDeps = defaultLoadDeps): Promise<AiConfig> {
    const raw: Record<string, string | undefined> = {};
    for (const key of AI_SETTING_KEYS) {
        raw[key] = await deps.getSettingString(db, key, process.env[key] ?? '');
    }
    return parseAiConfig(raw);
}
