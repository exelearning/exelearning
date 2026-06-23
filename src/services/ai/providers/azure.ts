/**
 * Azure OpenAI provider.
 *
 * Calls the chat-completions deployment endpoint:
 *   {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}
 * authenticating with the `api-key` header expected by Azure OpenAI.
 */
import type { AiConfig, GenerateTextOptions } from '../types';
import { extractChatCompletionText, joinUrl, postJson } from './http';

export async function generate(config: AiConfig, prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    const { endpoint, deployment, apiVersion, apiKey } = config.azure;
    const base = joinUrl(endpoint, `openai/deployments/${encodeURIComponent(deployment)}/chat/completions`);
    const url = `${base}?api-version=${encodeURIComponent(apiVersion)}`;

    const data = await postJson({
        url,
        headers: { 'api-key': apiKey },
        body: {
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
            temperature: options.temperature ?? config.temperature,
        },
        signal: options.signal,
        fetchImpl: options.fetchImpl,
    });

    return extractChatCompletionText(data);
}
