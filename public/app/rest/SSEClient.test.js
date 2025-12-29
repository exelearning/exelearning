import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SSEClient, { parseJsonStream, streamEvents } from './SSEClient.js';

describe('SSEClient', () => {
    describe('parseJsonStream', () => {
        it('should parse a single JSON object', () => {
            const buffer = '{"event":"test","data":"{\\"key\\":\\"value\\"}"}';
            const { parsed, remaining } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].event).toBe('test');
            expect(parsed[0].data).toEqual({ key: 'value' });
            expect(remaining).toBe('');
        });

        it('should parse multiple concatenated JSON objects', () => {
            const buffer =
                '{"event":"a","data":"{\\"id\\":1}"}{"event":"b","data":"{\\"id\\":2}"}';
            const { parsed, remaining } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(2);
            expect(parsed[0].event).toBe('a');
            expect(parsed[0].data).toEqual({ id: 1 });
            expect(parsed[1].event).toBe('b');
            expect(parsed[1].data).toEqual({ id: 2 });
            expect(remaining).toBe('');
        });

        it('should handle incomplete JSON at end of buffer', () => {
            const buffer = '{"event":"complete","data":"{}"}{"event":"inc';
            const { parsed, remaining } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].event).toBe('complete');
            expect(remaining).toBe('{"event":"inc');
        });

        it('should handle empty buffer', () => {
            const { parsed, remaining } = parseJsonStream('');

            expect(parsed).toHaveLength(0);
            expect(remaining).toBe('');
        });

        it('should handle JSON with nested objects in data', () => {
            const buffer =
                '{"event":"test","data":"{\\"nested\\":{\\"a\\":1,\\"b\\":2}}"}';
            const { parsed } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].data).toEqual({ nested: { a: 1, b: 2 } });
        });

        it('should handle JSON with arrays in data', () => {
            const buffer = '{"event":"test","data":"{\\"items\\":[1,2,3]}"}';
            const { parsed } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].data).toEqual({ items: [1, 2, 3] });
        });

        it('should handle strings with escaped quotes', () => {
            const buffer =
                '{"event":"test","data":"{\\"msg\\":\\"Hello \\\\\\"World\\\\\\"\\"}"}';
            const { parsed } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].data.msg).toBe('Hello "World"');
        });

        it('should keep data as string if not valid JSON', () => {
            const buffer = '{"event":"test","data":"not json"}';
            const { parsed } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(1);
            expect(parsed[0].data).toBe('not json');
        });

        it('should parse real Elysia link validation response', () => {
            const buffer =
                '{"event":"link-validated","data":"{\\"id\\":\\"abc123\\",\\"url\\":\\"https://example.com\\",\\"status\\":\\"valid\\",\\"error\\":null}"}{"event":"done","data":"{\\"complete\\":true,\\"totalValidated\\":1}"}';
            const { parsed } = parseJsonStream(buffer);

            expect(parsed).toHaveLength(2);

            expect(parsed[0].event).toBe('link-validated');
            expect(parsed[0].data.id).toBe('abc123');
            expect(parsed[0].data.status).toBe('valid');
            expect(parsed[0].data.error).toBeNull();

            expect(parsed[1].event).toBe('done');
            expect(parsed[1].data.complete).toBe(true);
            expect(parsed[1].data.totalValidated).toBe(1);
        });
    });

    describe('streamEvents', () => {
        let mockFetch;

        beforeEach(() => {
            mockFetch = vi.fn();
            global.fetch = mockFetch;
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should yield events from stream', async () => {
            const mockReader = {
                read: vi
                    .fn()
                    .mockResolvedValueOnce({
                        done: false,
                        value: new TextEncoder().encode(
                            '{"event":"test","data":"{\\"value\\":1}"}'
                        ),
                    })
                    .mockResolvedValueOnce({ done: true }),
                releaseLock: vi.fn(),
            };

            mockFetch.mockResolvedValue({
                ok: true,
                body: { getReader: () => mockReader },
            });

            const events = [];
            for await (const event of streamEvents(
                'http://test.com/stream',
                { test: true }
            )) {
                events.push(event);
            }

            expect(events).toHaveLength(1);
            expect(events[0].event).toBe('test');
            expect(events[0].data.value).toBe(1);
        });

        it('should throw on HTTP error', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(async () => {
                for await (const _ of streamEvents('http://test.com/stream', {})) {
                    // Should not reach here
                }
            }).rejects.toThrow('HTTP 500');
        });

        it('should handle chunked responses', async () => {
            const mockReader = {
                read: vi
                    .fn()
                    // First chunk: incomplete JSON
                    .mockResolvedValueOnce({
                        done: false,
                        value: new TextEncoder().encode('{"event":"a","data":"{\\"id\\":'),
                    })
                    // Second chunk: completes first, starts second
                    .mockResolvedValueOnce({
                        done: false,
                        value: new TextEncoder().encode(
                            '1}"}{"event":"b","data":"{\\"id\\":2}"}'
                        ),
                    })
                    .mockResolvedValueOnce({ done: true }),
                releaseLock: vi.fn(),
            };

            mockFetch.mockResolvedValue({
                ok: true,
                body: { getReader: () => mockReader },
            });

            const events = [];
            for await (const event of streamEvents('http://test.com/stream', {})) {
                events.push(event);
            }

            expect(events).toHaveLength(2);
            expect(events[0].data.id).toBe(1);
            expect(events[1].data.id).toBe(2);
        });
    });

    describe('SSEClient.createStream', () => {
        let mockFetch;

        beforeEach(() => {
            mockFetch = vi.fn();
            global.fetch = mockFetch;
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should call onEvent for each event', async () => {
            const mockReader = {
                read: vi
                    .fn()
                    .mockResolvedValueOnce({
                        done: false,
                        value: new TextEncoder().encode(
                            '{"event":"test","data":"{\\"id\\":1}"}'
                        ),
                    })
                    .mockResolvedValueOnce({ done: true }),
                releaseLock: vi.fn(),
            };

            mockFetch.mockResolvedValue({
                ok: true,
                body: { getReader: () => mockReader },
            });

            const events = [];
            const onEvent = vi.fn((e) => events.push(e));
            const onComplete = vi.fn();

            SSEClient.createStream('http://test.com/stream', {}, { onEvent, onComplete });

            // Wait for stream to complete
            await new Promise((r) => setTimeout(r, 50));

            expect(onEvent).toHaveBeenCalledTimes(1);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(events[0].event).toBe('test');
        });

        it('should call onError on failure', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const onError = vi.fn();

            SSEClient.createStream('http://test.com/stream', {}, { onError });

            // Wait for error
            await new Promise((r) => setTimeout(r, 50));

            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should support cancellation via AbortError', async () => {
            // Mock fetch that throws AbortError when signal is aborted
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';

            mockFetch.mockImplementation(async (url, options) => {
                // Simulate abort check
                if (options.signal?.aborted) {
                    throw abortError;
                }
                // If not aborted immediately, check signal during slow operation
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(resolve, 100);
                    options.signal?.addEventListener('abort', () => {
                        clearTimeout(timeout);
                        reject(abortError);
                    });
                });
                throw abortError; // Will be aborted by then
            });

            const onComplete = vi.fn();
            const onError = vi.fn();
            const stream = SSEClient.createStream(
                'http://test.com/stream',
                {},
                { onComplete, onError }
            );

            // Cancel immediately
            stream.cancel();

            // Wait for completion callback
            await new Promise((r) => setTimeout(r, 150));

            // Should call onComplete with cancelled flag, not onError
            expect(onComplete).toHaveBeenCalledWith({ cancelled: true });
            expect(onError).not.toHaveBeenCalled();
        });
    });
});
