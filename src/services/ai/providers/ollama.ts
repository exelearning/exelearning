/**
 * Ollama provider.
 *
 * Uses the non-streaming chat endpoint ({endpoint}/api/chat) so the whole
 * answer is returned in a single JSON response. No API key is required —
 * Ollama is typically a local or institutional service.
 */
import type { AiConfig, GenerateTextOptions } from '../types';
import { joinUrl, postJson, requireText } from './http';

interface OllamaChatResponse {
    message?: { content?: unknown };
}

export async function generate(config: AiConfig, prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    const url = joinUrl(config.ollama.endpoint, 'api/chat');

    const data = await postJson<OllamaChatResponse>({
        url,
        body: {
            model: config.ollama.model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            options: {
                temperature: options.temperature ?? config.temperature,
                num_predict: options.maxOutputTokens ?? config.maxOutputTokens,
            },
        },
        signal: options.signal,
        fetchImpl: options.fetchImpl,
    });

    return requireText(data?.message?.content);
}
