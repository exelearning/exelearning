import Modal from '../modal.js';

export default class ModalConnectMcp extends Modal {
    constructor(manager) {
        const id = 'modalConnectMcp';
        const titleDefault = undefined;
        super(manager, id, titleDefault, false);

        this.configSnippet = this.modalElement.querySelector('#webmcp-config-snippet');
        this.copyConfigButton = this.modalElement.querySelector('#button-copy-webmcp-config');
        this.loadScriptButton = this.modalElement.querySelector('#button-load-webmcp-script');
        this.openWidgetButton = this.modalElement.querySelector('#button-open-webmcp-widget');
        this.openDocsButton = this.modalElement.querySelector('#button-open-webmcp-docs');
        this.statusValue = this.modalElement.querySelector('#webmcp-status-value');
        this.statusDescription = this.modalElement.querySelector('#webmcp-status-description');
        this.toolsList = this.modalElement.querySelector('#webmcp-tools-list');

        this._eventsBound = false;
    }

    behaviour() {
        super.behaviour();
        this.bindEvents();
    }

    bindEvents() {
        if (this._eventsBound) {
            return;
        }

        this._eventsBound = true;

        this.copyConfigButton?.addEventListener('click', async () => {
            await this.copyConfigToClipboard();
        });

        this.loadScriptButton?.addEventListener('click', async () => {
            const service = this.getWebMcpService();
            if (!service) {
                return;
            }

            await service.ensureReady({ forceReload: true });
            this.refreshContent();
        });

        this.openWidgetButton?.addEventListener('click', async () => {
            const service = this.getWebMcpService();
            if (!service) {
                return;
            }

            await service.ensureReady();
            this.refreshContent();

            if (!service.canOpenWidget()) {
                window.alert(
                    _('Native WebMCP mode is active. No token widget is required.')
                );
                return;
            }

            const opened = service.openWidget();
            if (!opened) {
                window.alert(_('WebMCP widget not found.'));
            }
        });

        this.openDocsButton?.addEventListener('click', () => {
            const service = this.getWebMcpService();
            if (!service) {
                return;
            }

            const url = service.getDocsUrl();
            const win = window.open(url, '_blank');
            win?.focus?.();
        });
    }

    show(data) {
        this.titleDefault = _('Connect MCP');
        this.refreshContent();

        const service = this.getWebMcpService();
        if (service) {
            const ensureReadyPromise = service.ensureReady();
            this.refreshContent();
            ensureReadyPromise.finally(() => this.refreshContent());
        }

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.modal.show();
        }, time);
    }

    refreshContent() {
        const service = this.getWebMcpService();
        if (!service) {
            return;
        }

        if (this.configSnippet) {
            this.configSnippet.textContent = service.getClientConfigSnippet();
        }

        const status = service.getStatus();
        if (this.statusValue) {
            this.statusValue.textContent = status.label;
            this.statusValue.className = status.className;
        }
        if (this.statusDescription) {
            this.statusDescription.textContent = status.description;
        }
        if (this.loadScriptButton) {
            this.loadScriptButton.disabled = service.isLoading();
        }
        if (this.openWidgetButton) {
            this.openWidgetButton.disabled =
                !service.isReady() || !service.canOpenWidget();
        }

        if (this.toolsList) {
            this.toolsList.innerHTML = '';
            const tools = service.getRegisteredTools();
            if (tools.length === 0) {
                const li = document.createElement('li');
                li.textContent = _('No tools registered yet.');
                this.toolsList.append(li);
            } else {
                tools.forEach((tool) => {
                    const li = document.createElement('li');
                    li.textContent = tool.name;
                    this.toolsList.append(li);
                });
            }
        }
    }

    async copyConfigToClipboard() {
        const text = this.configSnippet?.textContent || '';
        if (!text) {
            return;
        }

        const copied = await this.copyText(text);
        if (!copied) {
            window.alert(_('Could not copy configuration to clipboard.'));
        }
    }

    async copyText(text) {
        if (navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // Fallback below.
            }
        }

        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.setAttribute('readonly', 'readonly');
            textArea.style.position = 'absolute';
            textArea.style.left = '-9999px';
            document.body.append(textArea);
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
            return true;
        } catch {
            return false;
        }
    }

    getWebMcpService() {
        return this.manager?.app?.webmcp || null;
    }
}
