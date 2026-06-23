/**
 * OpenAI-compatible provider.
 *
 * Targets any endpoint exposing the OpenAI chat-completions API
 * ({endpoint}/chat/completions), e.g. self-hosted gateways (LiteLLM, vLLM) or
 * OpenAI itself. The API key is optional — some gateways are unauthenticated.
 */
import type { AiConfig, GenerateTextOptions } from '../types';
import { extractChatCompletionText, joinUrl, postJson } from './http';

export async function generate(config: AiConfig, prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    const url = joinUrl(config.compat.endpoint, 'chat/completions');
    const headers: Record<string, string> = {};
    if (config.compat.apiKey) {
        headers.Authorization = `Bearer ${config.compat.apiKey}`;
    }

    const data = await postJson({
        url,
        headers,
        body: {
            model: config.compat.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
            temperature: options.temperature ?? config.temperature,
        },
        signal: options.signal,
        fetchImpl: options.fetchImpl,
    });

    return extractChatCompletionText(data);
}
