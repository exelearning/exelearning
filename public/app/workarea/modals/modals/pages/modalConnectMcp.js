import Modal from '../modal.js';

export default class ModalConnectMcp extends Modal {
    constructor(manager) {
        const id = 'modalConnectMcp';
        const titleDefault = undefined;
        super(manager, id, titleDefault, false);

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

        this.openDocsButton?.addEventListener('click', () => {
            const service = this.getWebMcpService();
            if (!service) {
                return;
            }

            const win = window.open(service.getDocsUrl(), '_blank');
            win?.focus?.();
        });
    }

    show() {
        this.titleDefault = _('Connect MCP');
        // Retry detection: the API may have become available after startup.
        this.getWebMcpService()?.init();
        this.refreshContent();

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

        const status = service.getStatus();
        if (this.statusValue) {
            this.statusValue.textContent = status.label;
            this.statusValue.className = status.className;
        }
        if (this.statusDescription) {
            this.statusDescription.textContent = status.description;
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

    getWebMcpService() {
        return this.manager?.app?.webmcp || null;
    }
}
