/**
 * Public entry point for the server-managed AI subsystem.
 */
export * from './types';
export {
    AI_SECRET_KEYS,
    AI_SETTING_KEYS,
    DEFAULT_OLLAMA_ENDPOINT,
    isAiProvider,
    isProviderConfigured,
    loadAiConfig,
    parseAiConfig,
    parseProvider,
    toPublicAiConfig,
} from './config';
export { assertCanGenerate, generateText, type GenerateTextResult, type ManagerDeps } from './manager';
