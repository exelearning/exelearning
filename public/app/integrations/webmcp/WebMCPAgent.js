/**
 * Minimal in-page agent that drives the eXeLearning WebMCP tools, so the tools can be
 * tried without an external agent. Two providers:
 *
 * - "builtin": the browser's own model through the Prompt API (`LanguageModel`, Gemini
 *   Nano in Chrome). Its native tool calling is not generally available yet, so each
 *   turn asks for JSON constrained by `responseConstraint` that names a tool or replies.
 * - "openai": any OpenAI-compatible Chat Completions endpoint with function calling
 *   (OpenAI, Gemini's OpenAI endpoint, Mistral, OpenRouter, Ollama, ...) with the
 *   user's own API key. The key goes from the browser straight to that endpoint.
 *
 * Tools run through WebMCPService.executeTool(), so write confirmation and HTML
 * sanitisation are the same ones a browser agent gets.
 */

export const MAX_STEPS = 10;
const MAX_RESULT_CHARS = 4000;

const SYSTEM_PROMPT = [
    'You are an assistant inside eXeLearning, an editor of educational web content.',
    'You change the open project only by calling the provided tools.',
    'Call exe.context.current first when you need page ids or the project state.',
    'Keep replies short and answer in the language the user writes in.',
].join(' ');

const example = (value) => JSON.stringify(value);
const BUILTIN_EXAMPLES = [
    { role: 'user', content: 'Pon «Historia de Canarias» de título' },
    {
        role: 'assistant',
        content: example({ action: 'tool', tool: 'exe.project.ensure_metadata', arguments: { title: 'Historia de Canarias' } }),
    },
    { role: 'user', content: 'Result of exe.project.ensure_metadata:\n{"success":true}' },
    { role: 'assistant', content: example({ action: 'reply', text: 'Hecho: el título es «Historia de Canarias».' }) },
    { role: 'user', content: 'Add a page called Volcanoes' },
    { role: 'assistant', content: example({ action: 'tool', tool: 'exe.pages.create', arguments: { name: 'Volcanoes' } }) },
    { role: 'user', content: 'Result of exe.pages.create:\n{"success":true}' },
    { role: 'assistant', content: example({ action: 'reply', text: 'Added the page Volcanoes.' }) },
];

/** OpenAI function names only allow [a-zA-Z0-9_-]; eXe tool names use dots. */
export function toFunctionName(toolName) {
    return toolName.replaceAll('.', '__');
}

export function fromFunctionName(functionName) {
    return functionName.replaceAll('__', '.');
}

/** Text of an MCP result envelope, truncated so it fits small context windows. */
export function resultText(envelope) {
    const text = (envelope?.content || [])
        .map((part) => (part?.type === 'text' ? part.text : ''))
        .join('\n');
    return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated]` : text;
}

function parseArguments(raw) {
    if (raw && typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export default class WebMCPAgent {
    /**
     * @param {object} options
     * @param {{ getToolDefinitions: () => Array<object>, executeTool: (name: string, args: object) => Promise<object> }} options.service
     * @param {typeof fetch} [options.fetchImpl]
     * @param {object} [options.languageModel] - the Prompt API `LanguageModel` global
     */
    constructor({ service, fetchImpl, languageModel } = {}) {
        this.service = service;
        this.fetchImpl = fetchImpl ?? globalThis.fetch?.bind(globalThis);
        this.languageModel = languageModel ?? globalThis.LanguageModel;
        this.messages = [];
        this.builtinSession = null;
    }

    /** 'available' | 'downloadable' | 'downloading' | 'unavailable' */
    async builtinAvailability() {
        if (typeof this.languageModel?.availability !== 'function') return 'unavailable';
        try {
            return await this.languageModel.availability(this._languageOptions());
        } catch {
            return 'unavailable';
        }
    }

    reset() {
        this.messages = [];
        this.builtinSession?.destroy?.();
        this.builtinSession = null;
    }

    /**
     * Runs one user request until the model replies without calling a tool.
     *
     * @param {string} text
     * @param {{ provider: 'builtin'|'openai', baseUrl?: string, model?: string, apiKey?: string }} config
     * @param {(event: object) => void} [onEvent] - receives { type: 'tool', name, args, result, isError } and { type: 'download', loaded }
     * @returns {Promise<string>} final reply
     */
    async send(text, config, onEvent = () => {}) {
        if (config.provider === 'builtin') {
            return this._sendBuiltin(text, onEvent);
        }
        return this._sendOpenAi(text, config, onEvent);
    }

    async _runTool(name, args, onEvent) {
        const envelope = await this.service.executeTool(name, args);
        const result = resultText(envelope);
        onEvent({ type: 'tool', name, args, result, isError: envelope?.isError === true });
        return result;
    }

    // --- OpenAI-compatible Chat Completions --------------------------------------

    async _sendOpenAi(text, { baseUrl, model, apiKey }, onEvent) {
        if (!baseUrl || !model) {
            throw new Error(_('Set the endpoint URL and the model.'));
        }
        if (this.messages.length === 0) {
            this.messages.push({ role: 'system', content: SYSTEM_PROMPT });
        }
        this.messages.push({ role: 'user', content: text });

        const tools = this.service.getToolDefinitions().map((tool) => ({
            type: 'function',
            function: { name: toFunctionName(tool.name), description: tool.description, parameters: tool.inputSchema },
        }));
        const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        if (new URL(url).hostname === 'api.anthropic.com') {
            // Anthropic rejects browser (CORS) requests unless the page opts in explicitly.
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
        }

        for (let step = 0; step < MAX_STEPS; step++) {
            const response = await this.fetchImpl(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ model, messages: this.messages, tools }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error?.message || `HTTP ${response.status}`);
            }

            const message = data?.choices?.[0]?.message;
            if (!message) throw new Error(_('The model returned an empty response.'));
            this.messages.push(message);

            const calls = message.tool_calls || [];
            if (calls.length === 0) return message.content || '';

            for (const call of calls) {
                const name = fromFunctionName(call.function?.name || '');
                const result = await this._runTool(name, parseArguments(call.function?.arguments), onEvent);
                this.messages.push({ role: 'tool', tool_call_id: call.id, content: result });
            }
        }
        throw new Error(_('The assistant stopped after too many steps.'));
    }

    // --- Browser built-in model (Prompt API) --------------------------------------

    _languageOptions() {
        const lang = (globalThis.document?.documentElement?.lang || 'en').slice(0, 2);
        const language = ['en', 'es', 'ja'].includes(lang) ? lang : 'en';
        return {
            expectedInputs: [{ type: 'text', languages: [language] }],
            expectedOutputs: [{ type: 'text', languages: [language] }],
        };
    }

    async _builtinSession(onEvent) {
        if (this.builtinSession) return this.builtinSession;
        if (typeof this.languageModel?.create !== 'function') {
            throw new Error(_('This browser has no built-in AI model (Prompt API).'));
        }
        const toolList = this.service
            .getToolDefinitions()
            .map((tool) => `- ${tool.name}: ${tool.description} Arguments: ${JSON.stringify(tool.inputSchema.properties || {})}`)
            .join('\n');
        const instructions = [
            SYSTEM_PROMPT,
            'Reply with JSON only.',
            'To call a tool: {"action":"tool","tool":"<name>","arguments":{...}}.',
            'To answer the user: {"action":"reply","text":"..."}.',
            'When the user asks for a change, call the matching tool right away; do not ask for confirmation',
            'and do not just describe what you would do. Reply only after the tools ran, or for questions.',
            `Tools:\n${toolList}`,
        ].join('\n');

        this.builtinSession = await this.languageModel.create({
            ...this._languageOptions(),
            // Small on-device models follow worked examples far better than instructions alone.
            initialPrompts: [{ role: 'system', content: instructions }, ...BUILTIN_EXAMPLES],
            monitor(monitor) {
                monitor.addEventListener('downloadprogress', (event) => onEvent({ type: 'download', loaded: event.loaded }));
            },
        });
        return this.builtinSession;
    }

    async _sendBuiltin(text, onEvent) {
        const session = await this._builtinSession(onEvent);
        const names = this.service.getToolDefinitions().map((tool) => tool.name);
        const responseConstraint = {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['tool', 'reply'] },
                tool: { type: 'string', enum: names },
                arguments: { type: 'object' },
                text: { type: 'string' },
            },
            required: ['action'],
        };

        let input = text;
        for (let step = 0; step < MAX_STEPS; step++) {
            const raw = await session.prompt(input, { responseConstraint });
            const answer = parseArguments(raw);
            if (answer.action !== 'tool' || !answer.tool) {
                return answer.text ?? String(raw);
            }
            const result = await this._runTool(answer.tool, parseArguments(answer.arguments), onEvent);
            input = `Result of ${answer.tool}:\n${result}`;
        }
        throw new Error(_('The assistant stopped after too many steps.'));
    }
}
