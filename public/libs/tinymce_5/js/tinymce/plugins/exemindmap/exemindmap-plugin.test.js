/**
 * Unit tests for the exemindmap TinyMCE plugin, which only converts legacy mind maps
 * (PNG + mindmaps JSON) to Mermaid now that the mindmaps editor is retired.
 *
 * The real plugin source runs against a small editor fake backed by the DOM; the
 * conversion itself is the shared TypeScript converter (src/shared/import/legacyMindmap.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertLegacyMindmapCode, LegacyMindmapError } from '../../../../../../../src/shared/import/legacyMindmap';

const pluginSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'plugin.min.js'), 'utf8');

const SIMPLE_CODE =
    '{"id":"d","title":"Mapa","mindmap":{"root":{"id":"r","text":{"caption":"Raíz &amp; \\\\"q\\\\""},"children":[{"id":"a","text":{"caption":"Hijo"},"children":[]}]}}}';

function legacyMap({ caption = true, link = false, code = SIMPLE_CODE } = {}) {
    const img = '<img src="resources/map.png" width="600" height="400" alt="Mapa sencillo">';
    return (
        '<div class="exe-mind-map">' +
        '<figure class="exe-figure exe-image position-center" style="width: 600px;">' +
        (link ? `<a href="resources/map.png" rel="lightbox" title="Mapa sencillo">${img}</a>` : img) +
        (caption ? '<figcaption class="figcaption"><span class="title"><em>Mapa sencillo</em></span></figcaption>' : '') +
        '</figure>' +
        `<p class="exe-mindmap-code">${code}</p>` +
        '</div>'
    );
}

function makeEditor(root) {
    const handlers = {};
    let selected = null;
    const editor = {
        dom: {
            getParent: (node, selector, rootNode) => {
                const found = (node.nodeType === 1 ? node : node.parentElement)?.closest(selector) ?? null;
                return found && (!rootNode || rootNode.contains(found)) ? found : null;
            },
            create: (name, attrs) => {
                const el = document.createElement(name);
                for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
                return el;
            },
            setStyle: (el, name, value) => {
                el.style.setProperty(name, value ?? '');
                if (!el.getAttribute('style')) el.removeAttribute('style');
            },
            removeClass: (el, name) => el.classList.remove(name),
            setAttrib: (el, name, value) => el.setAttribute(name, value),
            replace: (newNode, oldNode) => oldNode.replaceWith(newNode),
            loadCSS: vi.fn(),
            addStyle: vi.fn(),
        },
        selection: {
            getNode: () => selected,
            select: node => {
                selected = node;
            },
        },
        undoManager: { transact: vi.fn(fn => fn()) },
        windowManager: { open: vi.fn(), alert: vi.fn() },
        ui: { registry: { addButton: vi.fn(), addContextToolbar: vi.fn() } },
        on: (name, fn) => {
            handlers[name] = fn;
        },
        nodeChanged: vi.fn(),
        fire: name => handlers[name]?.(),
        root,
    };
    return editor;
}

function loadPlugin(editor) {
    let factory = null;
    const tinymce = {
        PluginManager: { add: (name, fn) => (factory = fn) },
        DOM: { encode: text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') },
    };
    new Function('tinymce', '_', pluginSource)(tinymce, s => s);
    factory(editor, '/libs/tinymce_5/js/tinymce/plugins/exemindmap');
    return {
        button: editor.ui.registry.addButton.mock.calls[0][1],
        toolbar: editor.ui.registry.addContextToolbar.mock.calls[0][1],
    };
}

async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('exemindmap plugin', () => {
    let root;
    let editor;
    let plugin;

    beforeEach(() => {
        root = document.createElement('div');
        document.body.appendChild(root);
        editor = makeEditor(root);
        window.SharedImporters = { legacyMindmap: { convertLegacyMindmapCode, LegacyMindmapError } };
        window.$exe = {
            mermaid: {
                fontFamily: 'sans-serif',
                load: vi.fn(() => Promise.resolve({ render: source => ({ svg: `<svg data-source="${source.length}"></svg>` }) })),
            },
        };
        plugin = loadPlugin(editor);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.SharedImporters;
        delete window.$exe;
        vi.restoreAllMocks();
    });

    function select(html, selector = 'img') {
        root.innerHTML = html;
        editor.selection.select(root.querySelector(selector));
    }

    async function openDialog() {
        plugin.button.onAction();
        await flush();
        return editor.windowManager.open.mock.calls.at(-1)?.[0];
    }

    it('registers only a contextual action, with a text label, and no toolbar button or editor iframe', () => {
        expect(editor.ui.registry.addButton).toHaveBeenCalledTimes(1);
        expect(editor.ui.registry.addButton.mock.calls[0][0]).toBe('exemindmapconvert');
        expect(plugin.button.text).toBe('Convert to Mermaid');
        expect(plugin.toolbar.items).toBe('exemindmapconvert');
        expect(pluginSource).not.toMatch(/openUrl|exemindmap-editor|editor\/index\.html/);
    });

    it('shows the action only inside a legacy map that has an image and source data', () => {
        root.innerHTML = `${legacyMap()}<p id="other">Text</p><div class="exe-mind-map"><p>no image</p></div>`;
        expect(plugin.toolbar.predicate(root.querySelector('.exe-mind-map img'))).toBe(true);
        expect(plugin.toolbar.predicate(root.querySelector('figcaption em'))).toBe(true);
        expect(plugin.toolbar.predicate(root.querySelector('#other'))).toBe(false);
        expect(plugin.toolbar.predicate(root.querySelectorAll('.exe-mind-map')[1])).toBe(false);
    });

    it('loads its content CSS and labels legacy maps with generated content', () => {
        editor.fire('init');
        expect(editor.dom.loadCSS).toHaveBeenCalledWith('/libs/tinymce_5/js/tinymce/plugins/exemindmap/css/content.css');
        expect(editor.dom.addStyle.mock.calls[0][0]).toMatch(/^\.exe-mind-map::before\{content:".+"\}$/);
    });

    it('opens a confirmation with the warning and a Pele preview, without changing the content', async () => {
        select(legacyMap());
        const before = root.innerHTML;
        const dialog = await openDialog();
        const html = dialog.body.items[0].html;
        expect(html).toContain('not the colours, fonts, styles');
        expect(html).toContain('(2)');
        expect(html).toContain('<svg data-source=');
        expect(dialog.buttons.map(b => b.type)).toEqual(['cancel', 'submit']);
        expect(root.innerHTML).toBe(before);
        expect(editor.undoManager.transact).not.toHaveBeenCalled();
    });

    it('still offers the conversion when Pele cannot be loaded', async () => {
        window.$exe.mermaid.load = vi.fn(() => Promise.reject(new Error('offline')));
        select(legacyMap());
        const dialog = await openDialog();
        expect(dialog.body.items[0].html).toContain('The preview is not available');
    });

    it('converts in one undo step, keeping caption and the original source data', async () => {
        select(legacyMap());
        const code = root.querySelector('.exe-mindmap-code').innerHTML;
        const dialog = await openDialog();
        const api = { close: vi.fn() };
        dialog.onSubmit(api);

        expect(api.close).toHaveBeenCalled();
        expect(editor.undoManager.transact).toHaveBeenCalledTimes(1);
        expect(root.querySelector('.exe-mind-map')).toBeNull();
        expect(root.querySelector('img')).toBeNull();
        const wrapper = root.querySelector('.exe-mindmap-converted');
        const figure = wrapper.querySelector('figure');
        expect(figure.className).toBe('exe-figure position-center');
        expect(figure.getAttribute('style')).toBeNull();
        expect(figure.querySelector('figcaption').textContent).toBe('Mapa sencillo');
        const pre = figure.querySelector('pre.mermaid');
        expect(pre.textContent).toBe(convertLegacyMindmapCode(code).source);
        expect(pre.textContent).toContain('Raíz & #quot;q#quot;');
        expect(wrapper.querySelector('.exe-mindmap-code').innerHTML).toBe(code);
        expect(editor.selection.getNode()).toBe(pre);
        expect(editor.nodeChanged).toHaveBeenCalled();
    });

    it('drops the full-size image link and keeps the alternative text when there is no caption', async () => {
        select(legacyMap({ caption: false, link: true }));
        (await openDialog()).onSubmit({ close() {} });
        const figure = root.querySelector('.exe-mindmap-converted figure');
        expect(figure.querySelector('a')).toBeNull();
        expect(figure.getAttribute('aria-label')).toBe('Mapa sencillo');
        expect(figure.firstElementChild.matches('pre.mermaid')).toBe(true);
    });

    it('converts only the selected map', async () => {
        root.innerHTML = legacyMap() + legacyMap();
        editor.selection.select(root.querySelectorAll('img')[1]);
        (await openDialog()).onSubmit({ close() {} });
        expect(root.querySelectorAll('.exe-mind-map')).toHaveLength(1);
        expect(root.firstElementChild.classList.contains('exe-mind-map')).toBe(true);
        expect(root.lastElementChild.classList.contains('exe-mindmap-converted')).toBe(true);
    });

    it('explains and changes nothing when the source data is damaged', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        select(legacyMap({ code: '{"mindmap":{"root":' }));
        const before = root.innerHTML;
        expect(await openDialog()).toBeUndefined();
        expect(editor.windowManager.alert).toHaveBeenCalledWith(expect.stringContaining('has not been changed'));
        expect(root.innerHTML).toBe(before);
    });

    it('does not convert when Pele cannot draw the diagram', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        window.$exe.mermaid.load = vi.fn(() => Promise.resolve({ render: () => { throw new Error('parse'); } }));
        select(legacyMap());
        const before = root.innerHTML;
        expect(await openDialog()).toBeUndefined();
        expect(editor.windowManager.alert).toHaveBeenCalled();
        expect(root.innerHTML).toBe(before);
    });

    it('does nothing when the selection is not a legacy map', async () => {
        select('<p>Text</p>', 'p');
        expect(await openDialog()).toBeUndefined();
        expect(editor.windowManager.alert).not.toHaveBeenCalled();
    });

    it('uses its own editor instance, not the active one', async () => {
        const other = makeEditor(document.createElement('div'));
        loadPlugin(other);
        select(legacyMap());
        (await openDialog()).onSubmit({ close() {} });
        expect(editor.undoManager.transact).toHaveBeenCalledTimes(1);
        expect(other.undoManager.transact).not.toHaveBeenCalled();
        expect(other.windowManager.open).not.toHaveBeenCalled();
    });
});
