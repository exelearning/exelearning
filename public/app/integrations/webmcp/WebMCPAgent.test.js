import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPAgent, { MAX_STEPS, fromFunctionName, resultText, toFunctionName } from './WebMCPAgent.js';

const envelope = (payload, isError = false) => ({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
});

function makeService() {
    return {
        getToolDefinitions: vi.fn(() => [
            {
                name: 'exe.pages.create',
                description: 'Create a page.',
                writes: true,
                inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
            },
        ]),
        executeTool: vi.fn(async () => envelope({ success: true, data: { pageId: 'p1' } })),
    };
}

function jsonResponse(body, ok = true, status = 200) {
    return { ok, status, json: async () => body };
}

beforeEach(() => {
    window._ = (text) => text;
});

afterEach(() => {
    document.documentElement.removeAttribute('lang');
});

describe('helpers', () => {
    it('maps tool names to OpenAI function names and back', () => {
        expect(toFunctionName('exe.pages.create')).toBe('exe__pages__create');
        expect(fromFunctionName('exe__pages__create')).toBe('exe.pages.create');
    });

    it('extracts and truncates result text', () => {
        expect(resultText(envelope({ a: 1 }))).toBe('{"a":1}');
        expect(resultText(null)).toBe('');
        const long = resultText({ content: [{ type: 'text', text: 'x'.repeat(5000) }, { type: 'image' }] });
        expect(long).toMatch(/\[truncated\]$/);
        expect(long.length).toBeLessThan(4100);
    });
});

describe('OpenAI-compatible provider', () => {
    const config = { provider: 'openai', baseUrl: 'https://api.example.com/v1/', model: 'm1', apiKey: 'sk-test' };

    it('runs tool calls until the model replies', async () => {
        const service = makeService();
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: null,
                                tool_calls: [
                                    {
                                        id: 'call-1',
                                        type: 'function',
                                        function: { name: 'exe__pages__create', arguments: '{"name":"Volcanoes"}' },
                                    },
                                ],
                            },
                        },
                    ],
                }),
            )
            .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'Page added.' } }] }));
        const agent = new WebMCPAgent({ service, fetchImpl });
        const onEvent = vi.fn();

        const reply = await agent.send('Add a page about volcanoes', config, onEvent);

        expect(reply).toBe('Page added.');
        expect(service.executeTool).toHaveBeenCalledWith('exe.pages.create', { name: 'Volcanoes' });
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'tool', name: 'exe.pages.create', isError: false }),
        );

        const [url, request] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.example.com/v1/chat/completions');
        expect(request.headers.Authorization).toBe('Bearer sk-test');
        expect(request.headers['anthropic-dangerous-direct-browser-access']).toBeUndefined();
        const body = JSON.parse(request.body);
        expect(body.model).toBe('m1');
        expect(body.tools[0].function.name).toBe('exe__pages__create');
        expect(body.messages[0].role).toBe('system');

        const second = JSON.parse(fetchImpl.mock.calls[1][1].body);
        expect(second.messages.at(-1)).toEqual({
            role: 'tool',
            tool_call_id: 'call-1',
            content: '{"success":true,"data":{"pageId":"p1"}}',
        });
    });

    it('keeps the conversation until reset()', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
        const agent = new WebMCPAgent({ service: makeService(), fetchImpl });

        await agent.send('one', config);
        await agent.send('two', config);
        expect(JSON.parse(fetchImpl.mock.calls[1][1].body).messages).toHaveLength(4);

        agent.reset();
        await agent.send('three', config);
        expect(JSON.parse(fetchImpl.mock.calls[2][1].body).messages).toHaveLength(2);
    });

    it('opts in to browser access for Anthropic and omits Authorization without a key', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'hi' } }] }));
        const agent = new WebMCPAgent({ service: makeService(), fetchImpl });

        await agent.send('hi', { ...config, baseUrl: 'https://api.anthropic.com/v1', apiKey: '' });

        const { headers } = fetchImpl.mock.calls[0][1];
        expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
        expect(headers.Authorization).toBeUndefined();
    });

    it('reports API, empty-response and configuration errors', async () => {
        const service = makeService();
        const failing = new WebMCPAgent({
            service,
            fetchImpl: vi.fn(async () => jsonResponse({ error: { message: 'Invalid key' } }, false, 401)),
        });
        await expect(failing.send('x', config)).rejects.toThrow('Invalid key');

        const noJson = new WebMCPAgent({
            service,
            fetchImpl: vi.fn(async () => ({ ok: false, status: 502, json: async () => Promise.reject(new Error('bad')) })),
        });
        await expect(noJson.send('x', config)).rejects.toThrow('HTTP 502');

        const empty = new WebMCPAgent({ service, fetchImpl: vi.fn(async () => jsonResponse({ choices: [] })) });
        await expect(empty.send('x', config)).rejects.toThrow('empty response');

        await expect(new WebMCPAgent({ service }).send('x', { provider: 'openai' })).rejects.toThrow(
            'Set the endpoint URL and the model.',
        );
    });

    it('stops after MAX_STEPS tool rounds and tolerates bad arguments', async () => {
        const service = makeService();
        const fetchImpl = vi.fn(async () =>
            jsonResponse({
                choices: [
                    {
                        message: {
                            tool_calls: [{ id: 'c', function: { name: 'exe__pages__create', arguments: '{not json' } }],
                        },
                    },
                ],
            }),
        );
        const agent = new WebMCPAgent({ service, fetchImpl });

        await expect(agent.send('loop', config)).rejects.toThrow('too many steps');
        expect(fetchImpl).toHaveBeenCalledTimes(MAX_STEPS);
        expect(service.executeTool).toHaveBeenCalledWith('exe.pages.create', {});
    });
});

describe('browser built-in provider', () => {
    function makeLanguageModel(responses) {
        const session = { prompt: vi.fn(), destroy: vi.fn() };
        for (const response of responses) session.prompt.mockResolvedValueOnce(response);
        const languageModel = {
            availability: vi.fn(async () => 'available'),
            create: vi.fn(async (options) => {
                options.monitor?.({ addEventListener: (_type, listener) => listener({ loaded: 0.5 }) });
                return session;
            }),
        };
        return { languageModel, session };
    }

    it('calls tools chosen through structured output and returns the reply', async () => {
        document.documentElement.lang = 'es';
        const service = makeService();
        const { languageModel, session } = makeLanguageModel([
            JSON.stringify({ action: 'tool', tool: 'exe.pages.create', arguments: { name: 'Volcanes' } }),
            JSON.stringify({ action: 'reply', text: 'Hecho.' }),
        ]);
        const agent = new WebMCPAgent({ service, languageModel });
        const onEvent = vi.fn();

        const reply = await agent.send('Crea una página', { provider: 'builtin' }, onEvent);

        expect(reply).toBe('Hecho.');
        expect(service.executeTool).toHaveBeenCalledWith('exe.pages.create', { name: 'Volcanes' });
        expect(onEvent).toHaveBeenCalledWith({ type: 'download', loaded: 0.5 });

        const options = languageModel.create.mock.calls[0][0];
        expect(options.expectedOutputs[0].languages).toEqual(['es']);
        expect(options.initialPrompts[0].content).toContain('- exe.pages.create: Create a page.');
        // Worked examples follow the system prompt as user/assistant turns.
        expect(options.initialPrompts.slice(1).map((turn) => turn.role)).toEqual([
            'user',
            'assistant',
            'user',
            'assistant',
            'user',
            'assistant',
            'user',
            'assistant',
        ]);
        expect(JSON.parse(options.initialPrompts[2].content)).toEqual({
            action: 'tool',
            tool: 'exe.project.ensure_metadata',
            arguments: { title: 'Historia de Canarias' },
        });
        const [, promptOptions] = session.prompt.mock.calls[0];
        expect(promptOptions.responseConstraint.properties.tool.enum).toEqual(['exe.pages.create']);
        expect(session.prompt.mock.calls[1][0]).toMatch(/^Result of exe\.pages\.create:/);

        // The session is reused and destroyed on reset.
        session.prompt.mockResolvedValueOnce('plain text answer');
        expect(await agent.send('again', { provider: 'builtin' })).toBe('plain text answer');
        expect(languageModel.create).toHaveBeenCalledTimes(1);
        agent.reset();
        expect(session.destroy).toHaveBeenCalled();
    });

    it('falls back to English for unsupported page languages', async () => {
        document.documentElement.lang = 'eu';
        const { languageModel } = makeLanguageModel([]);
        const agent = new WebMCPAgent({ service: makeService(), languageModel });

        expect(await agent.builtinAvailability()).toBe('available');
        expect(languageModel.availability.mock.calls[0][0].expectedInputs[0].languages).toEqual(['en']);
    });

    it('reports a missing or failing Prompt API', async () => {
        const agent = new WebMCPAgent({ service: makeService(), languageModel: null });
        // Constructor falls back to the global, which the test environment does not have.
        agent.languageModel = undefined;
        expect(await agent.builtinAvailability()).toBe('unavailable');
        await expect(agent.send('x', { provider: 'builtin' })).rejects.toThrow('no built-in AI model');

        agent.languageModel = { availability: vi.fn(async () => Promise.reject(new Error('boom'))) };
        expect(await agent.builtinAvailability()).toBe('unavailable');
    });

    it('stops after MAX_STEPS tool calls', async () => {
        const { languageModel, session } = makeLanguageModel([]);
        session.prompt.mockResolvedValue(JSON.stringify({ action: 'tool', tool: 'exe.pages.create' }));
        const agent = new WebMCPAgent({ service: makeService(), languageModel });

        await expect(agent.send('loop', { provider: 'builtin' })).rejects.toThrow('too many steps');
        expect(session.prompt).toHaveBeenCalledTimes(MAX_STEPS);
    });
});
