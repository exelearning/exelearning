import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    aiApiBase,
    applyProviderVisibility,
    collectAiSettings,
    initAiTab,
    saveAiSettings,
    testAiConnection,
} from './ai.js';

const AI_SECTION_HTML = `
<section id="ai">
  <select id="aiProviderSelect" data-setting-key="AI_PROVIDER" data-setting-type="string">
    <option value="external">external</option>
    <option value="azure">azure</option>
    <option value="ollama" selected>ollama</option>
    <option value="openai_compat">compat</option>
  </select>
  <input id="enabled" type="checkbox" data-setting-key="AI_FEATURES_ENABLED" data-setting-type="boolean" checked>
  <input id="model" data-setting-key="AI_OLLAMA_MODEL" data-setting-type="string" value="llama3">
  <input id="timeout" type="number" data-setting-key="AI_REQUEST_TIMEOUT_MS" data-setting-type="number" value="60000">
  <input id="key" type="password" data-setting-key="AI_AZURE_API_KEY" data-setting-type="string" value="">
  <div data-ai-provider-group="azure">azure</div>
  <div data-ai-provider-group="ollama">ollama</div>
  <div data-ai-provider-group="openai_compat">compat</div>
  <div data-ai-provider-group="managed">managed</div>
  <button id="aiSaveBtn"></button>
  <button id="aiTestBtn"></button>
  <span id="aiSaveStatus"></span>
</section>`;

function groupDisplay(name) {
    return document.querySelector(`[data-ai-provider-group="${name}"]`).style.display;
}

beforeEach(() => {
    globalThis.API_BASE = '/base/api/admin';
    globalThis.T = {
        saving: 'Saving...',
        saved: 'Saved',
        error_saving: 'Error saving',
        ai_testing: 'Testing...',
        ai_test_ok: 'Connection successful',
        ai_test_failed: 'Connection failed',
    };
    document.body.innerHTML = AI_SECTION_HTML;
    // Set the selected provider explicitly (happy-dom does not always reflect the
    // `selected` attribute into select.value); mirrors the server-rendered state.
    document.getElementById('aiProviderSelect').value = 'ollama';
});

afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.API_BASE;
    delete globalThis.T;
    vi.restoreAllMocks();
});

describe('aiApiBase', () => {
    it('derives the /api/ai base from the admin base', () => {
        expect(aiApiBase()).toBe('/base/api/ai');
    });
});

describe('applyProviderVisibility', () => {
    it('hides all provider groups in external mode', () => {
        applyProviderVisibility('external');
        expect(groupDisplay('azure')).toBe('none');
        expect(groupDisplay('ollama')).toBe('none');
        expect(groupDisplay('openai_compat')).toBe('none');
        expect(groupDisplay('managed')).toBe('none');
    });

    it('shows only the selected managed provider plus the shared options', () => {
        applyProviderVisibility('ollama');
        expect(groupDisplay('ollama')).toBe('');
        expect(groupDisplay('managed')).toBe('');
        expect(groupDisplay('azure')).toBe('none');
        expect(groupDisplay('openai_compat')).toBe('none');
    });

    it('shows the azure group for azure', () => {
        applyProviderVisibility('azure');
        expect(groupDisplay('azure')).toBe('');
        expect(groupDisplay('managed')).toBe('');
        expect(groupDisplay('ollama')).toBe('none');
    });
});

describe('collectAiSettings', () => {
    it('collects scoped #ai inputs with normalized types', () => {
        const settings = collectAiSettings();
        const byKey = Object.fromEntries(settings.map(s => [s.key, s]));
        expect(byKey.AI_PROVIDER).toEqual({ key: 'AI_PROVIDER', value: 'ollama', type: 'string' });
        expect(byKey.AI_FEATURES_ENABLED).toEqual({ key: 'AI_FEATURES_ENABLED', value: 'true', type: 'boolean' });
        expect(byKey.AI_OLLAMA_MODEL.value).toBe('llama3');
        expect(byKey.AI_REQUEST_TIMEOUT_MS).toEqual({ key: 'AI_REQUEST_TIMEOUT_MS', value: '60000', type: 'number' });
        // Blank secret is sent as an empty string (backend treats it as "keep").
        expect(byKey.AI_AZURE_API_KEY.value).toBe('');
    });
});

describe('saveAiSettings', () => {
    it('PUTs the collected settings and reports success', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

        const ok = await saveAiSettings();

        expect(ok).toBe(true);
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe('/base/api/admin/settings');
        expect(init.method).toBe('PUT');
        expect(init.credentials).toBe('include');
        expect(JSON.parse(init.body).settings.some(s => s.key === 'AI_PROVIDER')).toBe(true);
        expect(document.getElementById('aiSaveStatus').textContent).toBe('Saved');
    });

    it('shows the server error message on failure', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            json: async () => ({ message: 'AI_PROVIDER must be one of: external, azure, ollama, openai_compat' }),
        });

        const ok = await saveAiSettings();
        expect(ok).toBe(false);
        expect(document.getElementById('aiSaveStatus').textContent).toContain('AI_PROVIDER must be one of');
    });
});

describe('testAiConnection', () => {
    it('reports success when the provider responds ok', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

        const ok = await testAiConnection();

        expect(ok).toBe(true);
        expect(fetchSpy.mock.calls[0][0]).toBe('/base/api/ai/test-connection');
        expect(document.getElementById('aiSaveStatus').textContent).toBe('Connection successful');
    });

    it('reports a clear error when the provider is misconfigured', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            json: async () => ({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'The AI provider is not fully configured.' }),
        });

        const ok = await testAiConnection();
        expect(ok).toBe(false);
        expect(document.getElementById('aiSaveStatus').textContent).toContain('not fully configured');
    });
});

describe('initAiTab', () => {
    it('applies provider visibility on init and on provider change', () => {
        initAiTab();
        // Initial select value is "ollama".
        expect(groupDisplay('ollama')).toBe('');
        expect(groupDisplay('azure')).toBe('none');

        const select = document.getElementById('aiProviderSelect');
        select.value = 'azure';
        select.dispatchEvent(new Event('change'));
        expect(groupDisplay('azure')).toBe('');
        expect(groupDisplay('ollama')).toBe('none');
    });
});
