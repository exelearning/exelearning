import { initIdeviceHost } from './ideviceHost.js';

function setupDom() {
    document.body.innerHTML = `
        <header>
            <span id="lab-title"></span>
            <button class="lab-tab is-active" data-state="edition" aria-pressed="true">Edit</button>
            <button class="lab-tab" data-state="view" disabled aria-pressed="false">View</button>
            <button class="lab-tab" data-state="export" disabled aria-pressed="false">Export</button>
            <button id="lab-save">Save</button>
            <button id="lab-reset">Reset</button>
        </header>
        <pre id="lab-error" hidden></pre>
        <div id="lab-pane-edit"   class="lab-pane" data-state="edition"></div>
        <div id="lab-pane-view"   class="lab-pane" data-state="view" hidden></div>
        <div id="lab-pane-export" class="lab-pane" data-state="export" hidden></div>
    `;
    document.body.dataset.testid = 'idevice-host-page';
    document.body.dataset.idevice = 'text';
    document.body.dataset.basePath = '';
}

function makeConfig(overrides = {}) {
    return {
        name: 'text',
        title: 'Text',
        url: '/v0.0.0-alpha/files/perm/idevices/base/text',
        componentType: 'json',
        exportObject: '$text',
        exportTemplateContent: '<div class="exe-text-template">{content}</div>',
        editionJs: [],
        exportJs: [],
        editionCss: [],
        exportCss: [],
        ...overrides,
    };
}

function makeFetch(configs) {
    return vi.fn((url) => {
        if (url.includes('/api/idevices/installed')) {
            return Promise.resolve({ ok: true, json: async () => ({ idevices: configs }) });
        }
        return Promise.resolve({ ok: false, status: 404, text: async () => 'not found' });
    });
}

describe('initIdeviceHost', () => {
    beforeEach(() => {
        document.head.querySelectorAll('script, link[rel="stylesheet"]').forEach(n => n.remove());
        delete window.$exeDevice;
        delete window.$text;
    });

    it('starts in edition state and renders the form when $exeDevice.init is available', async () => {
        setupDom();
        const initSpy = vi.fn((mount) => { mount.innerHTML = '<form id="my-form">FORM</form>'; });
        window.$exeDevice = { init: initSpy };
        const host = await initIdeviceHost({ fetchFn: makeFetch([makeConfig()]) });
        expect(initSpy).toHaveBeenCalled();
        expect(document.getElementById('lab-pane-edit').innerHTML).toContain('FORM');
        expect(host.state).toBe('edition');
        expect(document.querySelector('.lab-tab[data-state="view"]').disabled).toBe(true);
        expect(document.querySelector('.lab-tab[data-state="export"]').disabled).toBe(true);
    });

    it('stays in edition when $exeDevice.save() returns falsy (validation failed)', async () => {
        setupDom();
        window.$exeDevice = { init: () => {}, save: vi.fn(() => null) };
        const host = await initIdeviceHost({ fetchFn: makeFetch([makeConfig()]) });
        document.getElementById('lab-save').click();
        expect(window.$exeDevice.save).toHaveBeenCalled();
        expect(host.state).toBe('edition');
        expect(document.querySelector('.lab-tab[data-state="view"]').disabled).toBe(true);
    });

    it('switches to view + enables tabs when save returns data and renders via export module', async () => {
        setupDom();
        window.$exeDevice = { init: () => {}, save: () => ({ textTextarea: 'hello' }) };
        window.$text = {
            renderView: vi.fn((data, _acc, template) => template.replace('{content}', data.textTextarea)),
            renderBehaviour: vi.fn(),
            init: vi.fn(),
        };
        const host = await initIdeviceHost({ fetchFn: makeFetch([makeConfig()]) });
        document.getElementById('lab-save').click();
        expect(host.state).toBe('view');
        expect(window.$text.renderView).toHaveBeenCalled();
        expect(document.getElementById('lab-pane-view').innerHTML).toContain('hello');
        expect(document.getElementById('lab-pane-view').hidden).toBe(false);
        expect(document.getElementById('lab-pane-edit').hidden).toBe(true);
        expect(document.querySelector('.lab-tab[data-state="view"]').disabled).toBe(false);
        expect(document.querySelector('.lab-tab[data-state="export"]').disabled).toBe(false);
    });

    it('runs renderBehaviour + init when the user switches to the export tab', async () => {
        setupDom();
        window.$exeDevice = { init: () => {}, save: () => ({ textTextarea: 'hi' }) };
        window.$text = {
            renderView: (data, _a, t) => t.replace('{content}', data.textTextarea),
            renderBehaviour: vi.fn(),
            init: vi.fn(),
        };
        await initIdeviceHost({ fetchFn: makeFetch([makeConfig()]) });
        document.getElementById('lab-save').click();
        // After save: renderBehaviour+init already run once on the export pane.
        window.$text.renderBehaviour.mockClear();
        window.$text.init.mockClear();
        document.querySelector('.lab-tab[data-state="export"]').click();
        expect(window.$text.renderBehaviour).toHaveBeenCalled();
        expect(window.$text.init).toHaveBeenCalled();
    });

    it('treats html-type iDevices: save() returns HTML, view shows it without calling renderView', async () => {
        setupDom();
        const cfg = makeConfig({ componentType: 'html', exportObject: '$checklist' });
        window.$exeDevice = { init: () => {}, save: () => '<article class="exe-html-already-rendered">DONE</article>' };
        window.$checklist = { renderView: vi.fn() }; // should NOT be called for html-type
        await initIdeviceHost({ fetchFn: makeFetch([cfg]) });
        document.getElementById('lab-save').click();
        expect(window.$checklist.renderView).not.toHaveBeenCalled();
        expect(document.getElementById('lab-pane-view').innerHTML).toContain('exe-html-already-rendered');
    });

    it('shows a host-level error when the iDevice config cannot be found in the API', async () => {
        setupDom();
        await initIdeviceHost({ fetchFn: makeFetch([]) });
        const err = document.getElementById('lab-error');
        expect(err.hidden).toBe(false);
        expect(err.textContent).toContain('text');
    });
});
