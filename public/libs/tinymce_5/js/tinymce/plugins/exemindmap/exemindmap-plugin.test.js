/**
 * Unit tests for the exemindmap TinyMCE plugin
 *
 * Tests:
 * - Editor URL selection (static vs online mode, BASE_PATH)
 * - The single editor dialog: what it sends the editor and how it stores the saved map
 * - The editor page only loading its local bundle
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_SRC = fs.readFileSync(path.join(__dirname, 'plugin.min.js'), 'utf8');

/** Runs the real plugin.min.js against a stub TinyMCE editor. */
function loadPlugin() {
    const opened = [];
    const inserted = [];
    const registry = {};
    const body = document.createElement('div');
    const editor = {
        ui: {
            registry: {
                addIcon: () => {},
                addToggleButton: (name, spec) => (registry.button = spec),
            },
        },
        on: () => {},
        off: () => {},
        dom: { loadCSS: () => {} },
        getDoc: () => document,
        getBody: () => body,
        selection: {
            getNode: () => registry.selected || body,
            select: (node) => (registry.selection = node),
            setContent: (html) => {
                registry.selection.outerHTML = html;
                inserted.push(html);
            },
        },
        insertContent: (html) => {
            body.insertAdjacentHTML('beforeend', html);
            inserted.push(html);
        },
        undoManager: {
            transact: (fn) => {
                registry.transactions = (registry.transactions || 0) + 1;
                fn();
            },
        },
        windowManager: {
            openUrl: (spec) => opened.push(spec),
        },
    };
    const tinymce = {
        PluginManager: { add: (name, factory) => (tinymce.factory = factory) },
        dom: { DomQuery: global.jQuery },
        activeEditor: { name: 'another editor' },
    };
    new Function('tinymce', '_', PLUGIN_SRC)(tinymce, (s) => s);
    tinymce.factory(editor, '/libs/tinymce_5/js/tinymce/plugins/exemindmap');
    return { editor, body, opened, inserted, registry };
}

/** The URL dialog instance API TinyMCE hands to the callbacks. */
function dialogApi() {
    const calls = { sent: [], blocked: 0, unblocked: 0, closed: 0 };
    return {
        calls,
        block: () => calls.blocked++,
        unblock: () => calls.unblocked++,
        close: () => calls.closed++,
        sendMessage: (message) => calls.sent.push(message),
    };
}

/** Opens the dialog, as the toolbar button does, and lets the editor say it is ready. */
function open(plugin) {
    plugin.registry.button.onAction();
    const spec = plugin.opened[plugin.opened.length - 1];
    const api = dialogApi();
    spec.onMessage(api, { mceAction: 'exeMindmapReady' });
    return { spec, api };
}

/** Clicks Save and answers it as the editor does, with `values` over a valid map. */
function save({ spec, api }, values = {}) {
    spec.onAction(api, { name: 'save' });
    spec.onMessage(api, {
        mceAction: 'exeMindmapSaved',
        code: '{"nodeData":{"id":"r","topic":"x"}}',
        svg: 'data:image/svg+xml;base64,AAAA',
        width: 120,
        height: 80,
        title: 'Clima',
        caption: true,
        ...values,
    });
}

afterEach(() => {
    delete window.eXeLearning;
    delete window.__EXE_STATIC_MODE__;
    delete window.electronAPI;
    document.body.innerHTML = '';
});

describe('exemindmap plugin - editor URL', () => {
    // Mirror window.eXeLearning.app.composeUrl from public/app/app.js
    function makeApp(basePath) {
        return {
            composeUrl(p) {
                const normalized = !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
                return `${normalized}${p.startsWith('/') ? p : `/${p}`}`;
            },
        };
    }

    function editorUrl() {
        const plugin = loadPlugin();
        plugin.registry.button.onAction();
        return plugin.opened[0].url;
    }

    it('uses the bare API URL when no host app is available (back-compat fallback)', () => {
        expect(editorUrl()).toBe('/api/exemindmap-editor/index.html');
        window.eXeLearning = { config: { isStaticMode: false } };
        expect(editorUrl()).toBe('/api/exemindmap-editor/index.html');
    });

    it('prefixes BASE_PATH via composeUrl in server mode (issue #1802)', () => {
        window.eXeLearning = { app: makeApp('/aplicaciones/medusa/exelearning'), config: '{"isStaticMode":false}' };
        expect(editorUrl()).toBe('/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html');
        window.eXeLearning.app = makeApp('');
        expect(editorUrl()).toBe('/api/exemindmap-editor/index.html');
    });

    it('uses the relative file in static mode, offline installations and Electron', () => {
        const expected = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
        const app = makeApp('/aplicaciones/medusa/exelearning');
        window.eXeLearning = { app, config: { isStaticMode: true } };
        expect(editorUrl()).toBe(expected);
        window.eXeLearning = { app, config: { isOfflineInstallation: true } };
        expect(editorUrl()).toBe(expected);
        window.eXeLearning = { app, config: 'not json' };
        window.electronAPI = {};
        expect(editorUrl()).toBe(expected);
    });
});

describe('exemindmap plugin - the editor dialog', () => {
    it('opens the editor straight away, in one URL dialog with Cancel and Save', () => {
        const plugin = loadPlugin();
        plugin.registry.button.onAction();
        expect(plugin.opened).toHaveLength(1);
        expect(plugin.opened[0].title).toBe('Mind map');
        expect(plugin.opened[0].buttons.map((b) => [b.type, b.name, b.text, !!b.primary])).toEqual([
            ['cancel', 'cancel', 'Cancel', false],
            ['custom', 'save', 'Save', true],
        ]);
        // No size: TinyMCE's large dialog
        expect(plugin.opened[0].width).toBeUndefined();
    });

    it('sends a new map nothing to open, with the caption on', () => {
        const { api } = open(loadPlugin());
        expect(api.calls.sent).toEqual([{ mceAction: 'exeMindmapLoad', code: '', title: '', caption: true }]);
    });

    it('sends a legacy image map selected from any element inside it, captioned by its alt', () => {
        const plugin = loadPlugin();
        plugin.body.innerHTML =
            '<div class="exe-mind-map"><figure><img src="map.png" width="300" height="200" alt="Seres vivos"></figure>' +
            '<p class="exe-mindmap-code">{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}</p></div>';
        plugin.registry.selected = plugin.body.querySelector('img');
        const { api } = open(plugin);
        expect(api.calls.sent).toEqual([
            {
                mceAction: 'exeMindmapLoad',
                code: '{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}',
                title: 'Seres vivos',
                caption: false,
            },
        ]);
    });

    it('sends an SVG map with its caption', () => {
        const plugin = loadPlugin();
        plugin.body.innerHTML =
            '<div class="exe-mind-map"><figure><img src="asset://map.svg" width="300" height="200" alt="Ciencias">' +
            '<figcaption class="figcaption"><span class="title"><em>Ciencias</em></span></figcaption></figure>' +
            '<p class="exe-mindmap-code">{"nodeData":{"id":"r","topic":"x"}}</p></div>';
        plugin.registry.selected = plugin.body.querySelector('figcaption');
        const { api } = open(plugin);
        expect(api.calls.sent[0]).toMatchObject({ title: 'Ciencias', caption: true });
    });

    it('asks the editor for the map on Save, once, and only when it is ready', () => {
        const plugin = loadPlugin();
        plugin.registry.button.onAction();
        const spec = plugin.opened[0];
        const api = dialogApi();
        spec.onAction(api, { name: 'save' });
        expect(api.calls.sent).toEqual([]);

        spec.onMessage(api, { mceAction: 'exeMindmapReady' });
        spec.onAction(api, { name: 'save' });
        spec.onAction(api, { name: 'save' });
        expect(api.calls.sent.slice(1)).toEqual([{ mceAction: 'exeMindmapSave' }]);
        expect(api.calls.blocked).toBe(1);

        // The editor could not make it (it shows why): Save works again
        spec.onMessage(api, { mceAction: 'exeMindmapFailed' });
        expect(api.calls.unblocked).toBe(1);
        spec.onAction(api, { name: 'save' });
        expect(api.calls.sent.slice(-1)).toEqual([{ mceAction: 'exeMindmapSave' }]);
    });

    it('ignores a saved map it did not ask for', () => {
        const plugin = loadPlugin();
        const { spec, api } = open(plugin);
        spec.onMessage(api, { mceAction: 'exeMindmapSaved', code: '{}', svg: 'data:image/svg+xml;base64,A', title: 'x' });
        expect(plugin.inserted).toEqual([]);
        expect(api.calls.closed).toBe(0);
    });

    it('inserts a new map with the image, the escaped source and a paragraph after it, then closes', () => {
        const plugin = loadPlugin();
        const dialog = open(plugin);
        const code = '{"nodeData":{"id":"r","topic":"&lt;clima&gt; &amp; \\"x\\""}}';
        save(dialog, { code });
        const [html] = plugin.inserted;
        expect(html).toContain(`<p class="exe-mindmap-code">${code}</p>`);
        expect(html).toContain('style="width: 120px;"');
        expect(html).toContain('<img src="data:image/svg+xml;base64,AAAA" width="120" height="80" alt="Clima">');
        expect(html).toContain('<figcaption class="figcaption"><span class="title"><em>Clima</em></span></figcaption>');
        expect(html.trim().endsWith('...')).toBe(true);
        expect(plugin.registry.transactions).toBe(1);
        expect(dialog.api.calls.closed).toBe(1);
    });

    it('leaves the caption out when it is off; the alt names the map', () => {
        const plugin = loadPlugin();
        save(open(plugin), { title: '&lt;b&gt; & "q"', caption: false, width: undefined, height: undefined });
        expect(plugin.inserted[0]).toContain('width="600" height="400" alt="&lt;b&gt; &amp; &quot;q&quot;"');
        expect(plugin.inserted[0]).not.toContain('figcaption');
    });

    it('replaces the map that was opened, where it is, as one undo step', () => {
        const plugin = loadPlugin();
        plugin.body.innerHTML =
            '<p>Antes</p><div class="exe-mind-map" id="a"><figure><img src="a.svg" alt="A"></figure><p class="exe-mindmap-code">{"nodeData":{}}</p></div>' +
            '<div class="exe-mind-map" id="b"><figure><img src="b.svg" alt="B"></figure><p class="exe-mindmap-code">{"nodeData":{}}</p></div>';
        plugin.registry.selected = plugin.body.querySelector('#a img');
        const dialog = open(plugin);
        // The selection moving while the dialog is open does not change which map is replaced
        plugin.registry.selected = plugin.body.querySelector('#b img');
        save(dialog, { title: 'A2' });
        expect(Array.from(plugin.body.querySelectorAll('.exe-mind-map img'), (img) => img.alt)).toEqual(['A2', 'B']);
        expect(plugin.body.firstChild.textContent).toBe('Antes');
        expect(plugin.registry.transactions).toBe(1);
        expect(dialog.api.calls.closed).toBe(1);
    });

    it('keeps the dialog open and the document unchanged when the saved data is not usable', () => {
        const cases = [
            [{ code: '' }, 'Please create a mind map.'],
            [{ code: '{"nodeData":{"topic":"<b>"}}' }, 'Please create a mind map.'],
            [{ svg: 'data:image/png;base64,AAAA' }, 'Please create a mind map.'],
            [{ svg: 'javascript:alert(1)' }, 'Please create a mind map.'],
            [{ title: ' <i></i> ' }, 'Please provide a title.'],
        ];
        for (const [values, error] of cases) {
            const plugin = loadPlugin();
            const dialog = open(plugin);
            save(dialog, values);
            expect(plugin.inserted).toEqual([]);
            expect(dialog.api.calls.closed).toBe(0);
            expect(dialog.api.calls.unblocked).toBe(1);
            expect(dialog.api.calls.sent.slice(-1)).toEqual([{ mceAction: 'exeMindmapError', message: error }]);
        }
    });

    it('reports an insertion failure in the dialog instead of closing it', () => {
        const plugin = loadPlugin();
        plugin.editor.insertContent = () => {
            throw new Error('read-only');
        };
        const dialog = open(plugin);
        save(dialog);
        expect(dialog.api.calls.closed).toBe(0);
        expect(dialog.api.calls.sent.slice(-1)).toEqual([{ mceAction: 'exeMindmapError', message: 'read-only' }]);
    });

    it('stores the map in the editor that opened it, not in another TinyMCE of the page', () => {
        // A Text iDevice has two editors, and the second one is set up last
        const first = loadPlugin();
        const second = loadPlugin();
        save(open(first), { title: 'Primero' });
        expect(first.body.querySelector('img').alt).toBe('Primero');
        expect(second.body.innerHTML).toBe('');
        expect(globalThis.eXeMediaPluginDialog).toBeUndefined();
    });
});

describe('exemindmap plugin - editor/index.html', () => {
    const html = fs.readFileSync(path.join(__dirname, 'editor/index.html'), 'utf8');

    it('loads only the built editor files next to it', () => {
        // No static URL, and the files it adds are relative, so the page works under any
        // BASE_PATH, in static mode and in Electron
        expect(html).not.toMatch(/(?:src|href)="/);
        const refs = [...html.matchAll(/\.(?:src|href) = '([^']+)'/g)].map((m) => m[1]);
        expect(refs.sort()).toEqual(['mindmap-editor.bundle.css', 'mindmap-editor.bundle.js']);
    });

    // Static servers with clean URLs redirect .../editor/index.html to .../editor
    for (const [pathname, base] of [
        ['/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor', '/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/'],
        ['/wp/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index', '/wp/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/'],
        ['/api/exemindmap-editor/index.html', null],
        ['/api/exemindmap-editor/', null],
    ]) {
        it(`resolves its files from the editor folder when served as ${pathname}`, () => {
            const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
            const head = document.createElement('head');
            new Function('location', 'document', script)({ pathname }, {
                createElement: (tag) => document.createElement(tag),
                head,
            });
            const added = head.querySelector('base');
            expect(added ? added.getAttribute('href') : null).toBe(base);
            // The <base> comes first, so it applies to the editor files
            expect(Array.from(head.children).map((e) => e.tagName)).toEqual(
                base ? ['BASE', 'LINK', 'SCRIPT'] : ['LINK', 'SCRIPT'],
            );
        });
    }
});
