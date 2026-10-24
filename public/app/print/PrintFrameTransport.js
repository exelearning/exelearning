/** A narrow channel to the print frame. Never authorize a message by its null origin. */
export default class PrintFrameTransport {
    constructor(iframe, root, host = window, resourceUrls = {}) {
        this.iframe = iframe;
        this.root = root;
        this.host = host;
        this.resourceUrls = resourceUrls;
        this.pending = new Map();
        this.sequence = 0;
        this.receive = this.receive.bind(this);
        host.addEventListener('message', this.receive);
    }

    receive(event) {
        const data = event.data;
        if (event.source !== this.iframe.contentWindow || !data || data.channel !== 'exe-print' || data.token !== this.token) return;
        const pending = this.pending.get(data.id);
        if (!pending || data.type !== pending.type) return;
        clearTimeout(pending.timer);
        this.pending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error));
        else pending.resolve(data.value);
    }

    wait(id, type, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('Print frame did not respond'));
            }, timeout);
            this.pending.set(id, { type, resolve, reject, timer });
        });
    }

    load(html) {
        this.clear();
        // getRandomValues also works on exported courses hosted over plain HTTP.
        this.token = crypto.getRandomValues(new Uint32Array(4)).join('-');
        const ready = this.wait(0, 'ready', 30000);
        const frameUrl = this.resourceUrls['libs/exe_print/frame.js'] || new URL('libs/exe_print/frame.js', this.root).href;
        const script = `<script src="${frameUrl}" data-print-token="${this.token}"></script>`;
        // The editor's preview resources are served by its Service Worker, which needs
        // the client's origin. Local packages also need their file origin for assets.
        // Public views have an opaque host origin and must keep the nested frame opaque;
        // their response CSP additionally enforces that boundary on every descendant.
        const sharesOrigin = this.host.location?.protocol === 'file:' ||
            (this.host.origin && this.host.origin !== 'null');
        this.iframe.setAttribute('sandbox', 'allow-scripts allow-modals' + (sharesOrigin ? ' allow-same-origin' : ''));
        const documentHtml = html.replace(/<\/body>/i, () => `${script}</body>`);
        if (sharesOrigin && this.host.navigator?.serviceWorker?.controller) {
            // Navigate within the worker's scope first. Firefox does not inherit its
            // controller in srcdoc/blob frames, so their package requests bypass it.
            const frameUrl = new URL('libs/exe_print/frame.html?generation=' + this.token, this.root).href;
            this.frameLoadHandler = () => {
                const doc = this.iframe.contentDocument;
                // Cleanup may still be navigating to about:blank, or an older preview
                // may finish loading. Only write into this generation's document.
                if (doc?.URL !== frameUrl) return;
                this.iframe.removeEventListener('load', this.frameLoadHandler);
                this.frameLoadHandler = null;
                doc.open();
                doc.write(documentHtml);
                doc.close();
            };
            this.iframe.addEventListener('load', this.frameLoadHandler);
            this.iframe.src = frameUrl;
        } else {
            this.iframe.srcdoc = documentHtml;
        }
        return ready;
    }

    send(type, value, response, timeout = 2000) {
        const id = ++this.sequence;
        const result = response ? this.wait(id, response, timeout) : undefined;
        this.iframe.contentWindow?.postMessage({ channel: 'exe-print', token: this.token, id, type, value }, '*');
        return result;
    }

    setOptions(options) { this.send('options', options); }
    print() { return this.send('print', null, 'started'); }
    snapshot() { return this.send('snapshot', null, 'snapshot', 30000); }

    clear() {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            // A superseded load has no result to show; the controller checks its request id.
            pending.resolve(undefined);
        }
        this.pending.clear();
        this.token = null;
        this.iframe.removeAttribute('srcdoc');
        if (this.frameLoadHandler) this.iframe.removeEventListener('load', this.frameLoadHandler);
        this.frameLoadHandler = null;
    }

    destroy() {
        this.clear();
        this.host.removeEventListener('message', this.receive);
    }
}
