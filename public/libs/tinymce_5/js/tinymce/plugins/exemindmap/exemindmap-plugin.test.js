/**
 * Unit tests for exemindmap TinyMCE plugin path handling
 *
 * Tests:
 * - Editor URL selection (static vs online mode)
 * - The shipped plugin reading and storing maps
 * - The editor page only loading its local bundle
 */

describe('exemindmap plugin - Path Handling', () => {
    describe('Editor URL selection', () => {
        // Mirror plugin.min.js: in server mode, route through composeUrl() so
        // BASE_PATH is prepended (issue #1802). Fall back to a bare path only
        // when the eXeLearning app/composeUrl helper isn't available (early init,
        // or environments without the host app).
        function getEditorUrl(config, app) {
            let editorUrl =
                app && typeof app.composeUrl === 'function'
                    ? app.composeUrl('/api/exemindmap-editor/index.html')
                    : '/api/exemindmap-editor/index.html';
            if (config?.isStaticMode || config?.isOfflineInstallation) {
                editorUrl = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
            }
            return editorUrl;
        }

        // Mirror window.eXeLearning.app.composeUrl from public/app/app.js:849-858
        function makeApp(basePath) {
            return {
                composeUrl(p) {
                    const normalized = !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
                    const path = p.startsWith('/') ? p : `/${p}`;
                    return `${normalized}${path}`;
                },
            };
        }

        it('should return bare API URL when no host app is available (back-compat fallback)', () => {
            expect(getEditorUrl(null)).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl(undefined)).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl({})).toBe('/api/exemindmap-editor/index.html');
            expect(getEditorUrl({ isStaticMode: false })).toBe('/api/exemindmap-editor/index.html');
        });

        it('should prefix BASE_PATH via composeUrl in server mode (issue #1802)', () => {
            const app = makeApp('/aplicaciones/medusa/exelearning');
            expect(getEditorUrl(null, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
            expect(getEditorUrl({}, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
            expect(getEditorUrl({ isStaticMode: false }, app)).toBe(
                '/aplicaciones/medusa/exelearning/api/exemindmap-editor/index.html',
            );
        });

        it('should fall through to bare URL when BASE_PATH is empty', () => {
            const app = makeApp('');
            expect(getEditorUrl(null, app)).toBe('/api/exemindmap-editor/index.html');
        });

        it('should return relative URL in static mode regardless of composeUrl', () => {
            const expected = './libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html';
            const app = makeApp('/aplicaciones/medusa/exelearning');
            expect(getEditorUrl({ isStaticMode: true })).toBe(expected);
            expect(getEditorUrl({ isStaticMode: true }, app)).toBe(expected);
            expect(getEditorUrl({ isOfflineInstallation: true }, app)).toBe(expected);
            expect(getEditorUrl({ isStaticMode: true, isOfflineInstallation: true }, app)).toBe(expected);
        });
    });

    describe('the shipped plugin', () => {
        // Runs the real plugin.min.js against a stub editor
        const fs = require('node:fs');
        const path = require('node:path');
        const PLUGIN_SRC = fs.readFileSync(path.join(__dirname, 'plugin.min.js'), 'utf8');

        let editorBody;
        let originalTop;

        function loadPlugin() {
            const opened = [];
            const inserted = [];
            const registry = {};
            editorBody = document.createElement('div');
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
                selection: { getNode: () => registry.selected || editorBody },
                execCommand: (cmd, ui, content) => inserted.push(content),
                windowManager: {
                    open: (spec) => {
                        opened.push(spec);
                        return { setData: () => {} };
                    },
                    openUrl: () => {},
                    close: () => {},
                    alert: (message) => inserted.push(`alert:${message}`),
                },
            };
            const tinymce = {
                PluginManager: { add: (name, factory) => (tinymce.factory = factory) },
                dom: { DomQuery: global.jQuery },
                DOM: { setAttrib: () => {}, setStyle: () => {}, create: () => document.createElement('div') },
                activeEditor: { name: 'another editor' },
            };
            new Function('tinymce', '_', PLUGIN_SRC)(tinymce, (s) => s);
            tinymce.factory(editor, '/libs/tinymce_5/js/tinymce/plugins/exemindmap');
            return { editor, opened, inserted, registry };
        }

        beforeEach(() => {
            originalTop = globalThis.top.mindmapEditor;
        });

        afterEach(() => {
            globalThis.top.mindmapEditor = originalTop;
            delete globalThis.eXeMediaPluginDialog;
            delete globalThis.win;
            document.body.innerHTML = '';
        });

        /** The format radio buttons, rendered as TinyMCE would, with one of them chosen. */
        function renderFormat(plugin, value) {
            const panel = plugin.opened[0].body.items.find((item) => item.type === 'htmlpanel');
            document.body.innerHTML = `<div class="tox-dialog">${panel.html}</div>`;
            if (value) document.querySelector(`input[value="${value}"]`).checked = true;
            return document.querySelector('input[name="mindmapFormat"]:checked').value;
        }

        it('opens a legacy image map from any element selected inside it', () => {
            const plugin = loadPlugin();
            editorBody.innerHTML =
                '<div class="exe-mind-map"><figure><img src="map.png" width="300" height="200" alt="Seres vivos"></figure>' +
                '<p class="exe-mindmap-code">{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}</p></div>';
            plugin.registry.selected = editorBody.querySelector('img');
            plugin.registry.button.onAction();

            expect(globalThis.eXeMediaPluginDialog.mode).toBe('edit');
            expect(globalThis.top.mindmapEditor.data).toBe('{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}');
            expect(plugin.opened[0].initialData).toMatchObject({
                mindmapDiagram: '',
                mindmapImgToSave: 'map.png',
                mindmapImgSize: '300x200',
                mindmapTitle: 'Seres vivos',
                mindmapCaption: false,
            });
            expect(renderFormat(plugin)).toBe('png');
        });

        it('opens a Mermaid map with its code, format and hidden caption', () => {
            const plugin = loadPlugin();
            editorBody.innerHTML =
                '<div class="exe-mind-map"><figure><pre class="mermaid">mindmap\n  n0(("x"))</pre>' +
                '<figcaption class="figcaption sr-av"><span class="title"><em>Ciencias</em></span></figcaption></figure>' +
                '<p class="exe-mindmap-code">{"nodeData":{"id":"r","topic":"x"}}</p></div>';
            plugin.registry.selected = editorBody.querySelector('pre');
            plugin.registry.button.onAction();

            expect(globalThis.eXeMediaPluginDialog.mode).toBe('edit');
            expect(plugin.opened[0].initialData).toMatchObject({
                mindmapDiagram: 'mindmap\n  n0(("x"))',
                mindmapTitle: 'Ciencias',
                mindmapCaption: false,
            });
            expect(renderFormat(plugin)).toBe('svg');
        });

        it('hands the editor iframe the editor that opened it, not tinymce.activeEditor', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            // A Text iDevice has more than one TinyMCE, so activeEditor can be another one
            expect(globalThis.top.mindmapEditor.tinymce).toBe(plugin.editor);
            expect(globalThis.top.mindmapEditor.pluginDialog).toBeDefined();
            expect(globalThis.eXeMediaPluginDialog.mode).toBe('new');
            // New maps are saved as an image unless the author chooses otherwise
            expect(renderFormat(plugin)).toBe('png');
        });

        /** What the editor fills in when it saves, plus `values`. */
        function submit(plugin, values) {
            plugin.opened[0].onSubmit({
                getData: () => ({
                    mindmapDiagram: 'mindmap\n  n0(("#lt;clima#gt; & x"))',
                    mindmapImgToSave: 'data:image/png;base64,AAAA',
                    mindmapImgSize: '120x80',
                    mindmapCode: '{"nodeData":{"id":"r","topic":"x"}}',
                    mindmapTitle: 'Clima',
                    mindmapCaption: true,
                    ...values,
                }),
            });
            return plugin.inserted[0];
        }

        it('stores the image and the editor source unchanged', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            const code = '{"nodeData":{"id":"r","topic":"&lt;clima&gt; &amp; \\"x\\""}}';
            const html = submit(plugin, { mindmapCode: code });
            expect(html).toContain(`<p class="exe-mindmap-code">${code}</p>`);
            expect(html).toContain('style="width: 120px;"');
            expect(html).toContain('<img src="data:image/png;base64,AAAA" width="120" height="80" alt="Clima">');
            expect(html).toContain('<figcaption class="figcaption"><span class="title"><em>Clima</em></span></figcaption>');
            expect(html).not.toContain('mermaid');
        });

        it('leaves the caption out of an image when it is off; the alt names it', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            const html = submit(plugin, { mindmapTitle: '&lt;b&gt; & "q"', mindmapCaption: false, mindmapImgSize: '' });
            expect(html).toContain('width="600" height="400" alt="&lt;b&gt; &amp; &quot;q&quot;"');
            expect(html).not.toContain('figcaption');
        });

        it('stores the Mermaid code escaped when SVG is chosen', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            renderFormat(plugin, 'svg');
            const html = submit(plugin);
            expect(html).toContain('<pre class="mermaid">mindmap\n  n0((&quot;#lt;clima#gt; &amp; x&quot;))</pre>');
            expect(html).toContain('<figcaption class="figcaption"><span class="title"><em>Clima</em></span></figcaption>');
            expect(html).not.toContain('<img');
            expect(html).not.toContain('style=');
        });

        it('keeps the title of an SVG map for screen readers when the caption is off', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            renderFormat(plugin, 'svg');
            const html = submit(plugin, { mindmapTitle: '&lt;b&gt; & "q"', mindmapCaption: false });
            expect(html).toContain('<figcaption class="figcaption sr-av"><span class="title"><em>&lt;b&gt; &amp; &quot;q&quot;</em>');
        });

        it('refuses to save without a map, the chosen view or a title', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            expect(submit(plugin, { mindmapCode: '' })).toBe('alert:Please create a mind map.');
            plugin.inserted.length = 0;
            expect(submit(plugin, { mindmapImgToSave: '' })).toBe(
                'alert:Open the mind map editor and save the map to change its format.',
            );
            plugin.inserted.length = 0;
            // A legacy image map has no Mermaid code until the editor saves it
            renderFormat(plugin, 'svg');
            expect(submit(plugin, { mindmapDiagram: '' })).toBe(
                'alert:Open the mind map editor and save the map to change its format.',
            );
            plugin.inserted.length = 0;
            expect(submit(plugin, { mindmapTitle: ' ' })).toBe('alert:Please provide a title.');
        });
    });

    describe('editor/index.html', () => {
        it('loads only the built editor files next to it', () => {
            const fs = require('node:fs');
            const path = require('node:path');
            const html = fs.readFileSync(path.join(__dirname, 'editor/index.html'), 'utf8');
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
                const fs = require('node:fs');
                const path = require('node:path');
                const html = fs.readFileSync(path.join(__dirname, 'editor/index.html'), 'utf8');
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
});
