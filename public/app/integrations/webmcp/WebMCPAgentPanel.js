import WebMCPAgent from './WebMCPAgent.js';

const SETTINGS_KEY = 'exe-webmcp-agent';
const API_KEY_KEY = 'exe-webmcp-agent-key';

function readStorage(storage, key) {
    try {
        return storage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeStorage(storage, key, value) {
    try {
        storage?.setItem(key, value);
    } catch {
        // Private mode or blocked storage: settings simply are not remembered.
    }
}

/**
 * Side panel that chats with WebMCPAgent. It does not block the workarea, so the
 * changes the agent makes are visible while it works.
 */
export default class WebMCPAgentPanel {
    /**
     * @param {HTMLElement} root - the #webmcp-agent-panel element
     * @param {object} options
     * @param {() => object|null} options.getService - returns the WebMCPService
     * @param {(service: object) => WebMCPAgent} [options.createAgent]
     */
    constructor(root, { getService, createAgent = (service) => new WebMCPAgent({ service }) } = {}) {
        this.root = root;
        this.getService = getService;
        this.createAgent = createAgent;
        this.agent = null;
        this.busy = false;
        this.pending = null;

        const $ = (id) => root.querySelector(`#${id}`);
        this.provider = $('webmcp-agent-provider');
        this.builtinStatus = $('webmcp-agent-builtin-status');
        this.baseUrl = $('webmcp-agent-base-url');
        this.model = $('webmcp-agent-model');
        this.apiKey = $('webmcp-agent-api-key');
        this.log = $('webmcp-agent-log');
        this.form = $('webmcp-agent-form');
        this.prompt = $('webmcp-agent-prompt');
        this.sendButton = $('webmcp-agent-send');

        this.loadSettings();
        this.provider.addEventListener('change', () => this.onProviderChange());
        for (const input of [this.baseUrl, this.model, this.apiKey]) {
            input.addEventListener('change', () => this.saveSettings());
        }
        $('webmcp-agent-close').addEventListener('click', () => this.close());
        $('webmcp-agent-reset').addEventListener('click', () => this.resetConversation());
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.submit();
        });
        this.prompt.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.submit();
            }
        });
    }

    loadSettings() {
        let saved = {};
        try {
            saved = JSON.parse(readStorage(globalThis.localStorage, SETTINGS_KEY) || '{}');
        } catch {
            saved = {};
        }
        if (saved.provider) this.provider.value = saved.provider;
        if (saved.baseUrl) this.baseUrl.value = saved.baseUrl;
        if (saved.model) this.model.value = saved.model;
        this.apiKey.value = readStorage(globalThis.sessionStorage, API_KEY_KEY) || '';
        this.showProviderFields();
    }

    saveSettings() {
        const settings = { provider: this.provider.value, baseUrl: this.baseUrl.value, model: this.model.value };
        writeStorage(globalThis.localStorage, SETTINGS_KEY, JSON.stringify(settings));
        // The key never goes to localStorage: it is forgotten when the tab closes.
        writeStorage(globalThis.sessionStorage, API_KEY_KEY, this.apiKey.value);
    }

    getConfig() {
        return {
            provider: this.provider.value,
            baseUrl: this.baseUrl.value.trim(),
            model: this.model.value.trim(),
            apiKey: this.apiKey.value.trim(),
        };
    }

    showProviderFields() {
        for (const element of this.root.querySelectorAll('[data-provider]')) {
            element.hidden = element.dataset.provider !== this.provider.value;
        }
    }

    onProviderChange() {
        this.saveSettings();
        this.showProviderFields();
        this.resetConversation();
        this.refreshBuiltinStatus();
    }

    async refreshBuiltinStatus() {
        if (this.provider.value !== 'builtin') return;
        const availability = await this.getAgent().builtinAvailability();
        const messages = {
            available: _('The browser model is ready.'),
            downloadable: _('The browser will download its model the first time you send a message.'),
            downloading: _('The browser is downloading its model.'),
            unavailable: _(
                'This browser has no built-in AI model. Use Chrome with the Prompt API enabled, or choose an API with your key.',
            ),
        };
        this.builtinStatus.textContent = messages[availability] || messages.unavailable;
    }

    getAgent() {
        if (!this.agent) {
            this.agent = this.createAgent(this.getService());
        }
        return this.agent;
    }

    open() {
        this.getService()?.init();
        this.root.hidden = false;
        this.refreshBuiltinStatus();
        this.prompt.focus();
    }

    close() {
        this.root.hidden = true;
    }

    resetConversation() {
        this.agent?.reset();
        this.log.replaceChildren();
    }

    addEntry(kind, text) {
        const entry = document.createElement('div');
        entry.className = `webmcp-agent-entry webmcp-agent-${kind}`;
        // Model output is shown as text, never as HTML.
        entry.textContent = text;
        this.log.append(entry);
        this.log.scrollTop = this.log.scrollHeight;
        return entry;
    }

    onAgentEvent(event) {
        if (event.type === 'tool') {
            const entry = this.addEntry(event.isError ? 'tool-error' : 'tool', `🔧 ${event.name}`);
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = _('Details');
            const pre = document.createElement('pre');
            pre.textContent = `${JSON.stringify(event.args, null, 2)}\n→ ${event.result}`;
            details.append(summary, pre);
            entry.append(details);
            // Keep the "Thinking…" line last.
            if (this.pending) this.log.append(this.pending);
        } else if (event.type === 'download') {
            this.builtinStatus.textContent = _('Downloading the browser model: %s%').replace(
                '%s',
                String(Math.round((event.loaded || 0) * 100)),
            );
        }
    }

    async submit() {
        const text = this.prompt.value.trim();
        if (!text || this.busy) return;

        this.busy = true;
        this.sendButton.disabled = true;
        this.prompt.value = '';
        this.addEntry('user', text);
        const pending = this.addEntry('pending', _('Thinking…'));
        this.pending = pending;
        try {
            const reply = await this.getAgent().send(text, this.getConfig(), (event) => this.onAgentEvent(event));
            pending.remove();
            this.addEntry('assistant', reply || _('Done.'));
        } catch (error) {
            pending.remove();
            this.addEntry('error', String(error?.message || error));
        } finally {
            this.pending = null;
            this.busy = false;
            this.sendButton.disabled = false;
            this.prompt.focus();
        }
    }
}
