import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPAgentPanel from './WebMCPAgentPanel.js';

const PANEL_HTML = `
  <button id="webmcp-agent-close" type="button"></button>
  <select id="webmcp-agent-provider">
    <option value="builtin">builtin</option>
    <option value="openai">openai</option>
  </select>
  <p id="webmcp-agent-builtin-status" data-provider="builtin"></p>
  <div id="openai-fields" data-provider="openai">
    <input id="webmcp-agent-base-url" value="https://api.openai.com/v1">
    <input id="webmcp-agent-model">
    <input id="webmcp-agent-api-key" type="password">
  </div>
  <div id="webmcp-agent-log"></div>
  <form id="webmcp-agent-form">
    <textarea id="webmcp-agent-prompt"></textarea>
    <button id="webmcp-agent-send" type="submit"></button>
    <button id="webmcp-agent-reset" type="button"></button>
  </form>
`;

describe('WebMCPAgentPanel', () => {
    let root;
    let agent;
    let service;

    function createPanel() {
        return new WebMCPAgentPanel(root, { getService: () => service, createAgent: () => agent });
    }

    const $ = (id) => root.querySelector(`#${id}`);
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        window._ = (text) => text;
        localStorage.clear();
        sessionStorage.clear();
        root = document.createElement('aside');
        root.hidden = true;
        root.innerHTML = PANEL_HTML;
        document.body.append(root);
        service = { init: vi.fn() };
        agent = {
            builtinAvailability: vi.fn(async () => 'available'),
            send: vi.fn(async () => 'All done'),
            reset: vi.fn(),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        root.remove();
    });

    it('opens, refreshes the built-in status and closes', async () => {
        const panel = createPanel();

        panel.open();
        await flush();

        expect(root.hidden).toBe(false);
        expect(service.init).toHaveBeenCalled();
        expect($('webmcp-agent-builtin-status').textContent).toBe('The browser model is ready.');
        expect($('openai-fields').hidden).toBe(true);

        agent.builtinAvailability.mockResolvedValueOnce('something-new');
        await panel.refreshBuiltinStatus();
        expect($('webmcp-agent-builtin-status').textContent).toContain('no built-in AI model');

        $('webmcp-agent-close').click();
        expect(root.hidden).toBe(true);
    });

    it('stores settings in localStorage and the key only in sessionStorage', () => {
        const panel = createPanel();
        const provider = $('webmcp-agent-provider');
        provider.value = 'openai';
        provider.dispatchEvent(new Event('change'));
        $('webmcp-agent-model').value = 'gpt-test';
        $('webmcp-agent-api-key').value = 'sk-secret';
        $('webmcp-agent-api-key').dispatchEvent(new Event('change'));

        expect($('openai-fields').hidden).toBe(false);
        expect(JSON.parse(localStorage.getItem('exe-webmcp-agent'))).toEqual({
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-test',
        });
        expect(localStorage.getItem('exe-webmcp-agent')).not.toContain('sk-secret');
        expect(sessionStorage.getItem('exe-webmcp-agent-key')).toBe('sk-secret');

        root.innerHTML = PANEL_HTML;
        const restored = createPanel();
        expect($('webmcp-agent-provider').value).toBe('openai');
        expect($('webmcp-agent-model').value).toBe('gpt-test');
        expect($('webmcp-agent-api-key').value).toBe('sk-secret');
        expect(restored.getConfig()).toEqual({
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-test',
            apiKey: 'sk-secret',
        });
        expect(panel).toBeTruthy();
    });

    it('ignores corrupt or unavailable storage', () => {
        localStorage.setItem('exe-webmcp-agent', '{broken');
        expect(() => createPanel()).not.toThrow();

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        root.innerHTML = PANEL_HTML;
        const panel = createPanel();
        expect(() => panel.saveSettings()).not.toThrow();
    });

    it('sends the prompt on Enter and shows tool steps and the reply as text', async () => {
        agent.send.mockImplementation(async (_text, _config, onEvent) => {
            onEvent({ type: 'tool', name: 'exe.pages.create', args: { name: 'A' }, result: '{"ok":true}', isError: false });
            onEvent({ type: 'download', loaded: 0.42 });
            return '<b>not html</b>';
        });
        createPanel();
        const prompt = $('webmcp-agent-prompt');
        prompt.value = 'Add a page';

        prompt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await flush();

        expect(agent.send).toHaveBeenCalledWith('Add a page', expect.objectContaining({ provider: 'builtin' }), expect.any(Function));
        const entries = [...$('webmcp-agent-log').children].map((entry) => entry.className);
        expect(entries).toEqual([
            'webmcp-agent-entry webmcp-agent-user',
            'webmcp-agent-entry webmcp-agent-tool',
            'webmcp-agent-entry webmcp-agent-assistant',
        ]);
        expect($('webmcp-agent-log').querySelector('pre').textContent).toContain('"name": "A"');
        expect($('webmcp-agent-log').querySelector('b')).toBeNull();
        expect($('webmcp-agent-log').lastElementChild.textContent).toBe('<b>not html</b>');
        expect($('webmcp-agent-builtin-status').textContent).toBe('Downloading the browser model: 42%');
        expect(prompt.value).toBe('');
        expect($('webmcp-agent-send').disabled).toBe(false);
    });

    it('shows errors, ignores empty prompts and Shift+Enter, and resets the conversation', async () => {
        agent.send.mockRejectedValueOnce(new Error('Invalid key'));
        createPanel();
        const prompt = $('webmcp-agent-prompt');

        $('webmcp-agent-form').dispatchEvent(new Event('submit', { cancelable: true }));
        prompt.value = 'x';
        prompt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
        expect(agent.send).not.toHaveBeenCalled();

        $('webmcp-agent-form').dispatchEvent(new Event('submit', { cancelable: true }));
        await flush();
        expect($('webmcp-agent-log').lastElementChild.className).toContain('webmcp-agent-error');
        expect($('webmcp-agent-log').lastElementChild.textContent).toBe('Invalid key');

        $('webmcp-agent-reset').click();
        expect(agent.reset).toHaveBeenCalled();
        expect($('webmcp-agent-log').children).toHaveLength(0);
    });

    it('marks failed tool calls and replaces an empty reply with Done.', async () => {
        agent.send.mockImplementation(async (_text, _config, onEvent) => {
            onEvent({ type: 'tool', name: 'exe.pages.delete', args: {}, result: 'Cancelled by user', isError: true });
            return '';
        });
        createPanel();
        $('webmcp-agent-prompt').value = 'Delete it';

        $('webmcp-agent-form').dispatchEvent(new Event('submit', { cancelable: true }));
        await flush();

        expect($('webmcp-agent-log').querySelector('.webmcp-agent-tool-error')).not.toBeNull();
        expect($('webmcp-agent-log').lastElementChild.textContent).toBe('Done.');
    });
});
