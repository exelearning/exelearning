/**
 * SSE Client for streaming responses
 *
 * Handles Server-Sent Events via POST requests (native EventSource only supports GET).
 * Parses Elysia's generator response format (concatenated JSON objects).
 */

/**
 * Parse a buffer of concatenated JSON objects
 * Returns parsed events and remaining unparsed buffer
 *
 * @param {string} buffer - Buffer containing potentially multiple JSON objects
 * @returns {{ parsed: Array<{event: string, data: any}>, remaining: string }}
 */
export function parseJsonStream(buffer) {
    const parsed = [];
    let remaining = buffer;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let start = 0;

    for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\' && inString) {
            escapeNext = true;
            continue;
        }

        if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (char === '{') {
            if (braceCount === 0) {
                start = i;
            }
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                // Complete JSON object found
                const jsonStr = remaining.substring(start, i + 1);
                try {
                    const obj = JSON.parse(jsonStr);
                    // Parse the nested data field if it's a string
                    if (typeof obj.data === 'string') {
                        try {
                            obj.data = JSON.parse(obj.data);
                        } catch {
                            // Keep as string if not valid JSON
                        }
                    }
                    parsed.push(obj);
                } catch (e) {
                    console.warn('[SSEClient] Failed to parse JSON:', jsonStr, e);
                }
                start = i + 1;
            }
        }
    }

    // Return remaining unparsed buffer
    remaining = remaining.substring(start);

    return { parsed, remaining };
}

/**
 * Stream events from a POST endpoint
 *
 * @param {string} url - The endpoint URL
 * @param {Object} data - Data to POST
 * @param {Object} options - Options
 * @param {AbortSignal} [options.signal] - AbortController signal for cancellation
 * @returns {AsyncGenerator<{event: string, data: any}>}
 */
export async function* streamEvents(url, data, options = {}) {
    const { signal } = options;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal,
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                // Process any remaining buffer
                if (buffer.trim()) {
                    const { parsed } = parseJsonStream(buffer);
                    for (const event of parsed) {
                        yield event;
                    }
                }
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Parse complete JSON objects from buffer
            const { parsed, remaining } = parseJsonStream(buffer);
            buffer = remaining;

            for (const event of parsed) {
                yield event;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * SSEClient class for managing streaming connections
 */
export default class SSEClient {
    /**
     * Create a streaming connection to validate links
     *
     * @param {string} url - The endpoint URL
     * @param {Object} data - Data to POST (links array)
     * @param {Object} callbacks - Event callbacks
     * @param {Function} callbacks.onEvent - Called for each event
     * @param {Function} callbacks.onComplete - Called when stream completes
     * @param {Function} callbacks.onError - Called on error
     * @returns {{ cancel: Function }} - Object with cancel method
     */
    static createStream(url, data, callbacks = {}) {
        const { onEvent, onComplete, onError } = callbacks;
        const abortController = new AbortController();

        const runStream = async () => {
            try {
                for await (const event of streamEvents(url, data, {
                    signal: abortController.signal,
                })) {
                    if (onEvent) {
                        onEvent(event);
                    }
                }
                if (onComplete) {
                    onComplete();
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    // Cancelled by user, not an error
                    if (onComplete) {
                        onComplete({ cancelled: true });
                    }
                } else if (onError) {
                    onError(error);
                } else {
                    console.error('[SSEClient] Stream error:', error);
                }
            }
        };

        runStream();

        return {
            cancel: () => abortController.abort(),
        };
    }
}
