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
        });

        it('opens an existing map from any element selected inside it', () => {
            const plugin = loadPlugin();
            editorBody.innerHTML =
                '<div class="exe-mind-map"><figure><img src="map.png" width="300" height="200" alt="Seres vivos">' +
                '<figcaption><span class="title"><em>Seres vivos</em></span></figcaption></figure>' +
                '<p class="exe-mindmap-code">{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}</p></div>';
            plugin.registry.selected = editorBody.querySelector('img');
            plugin.registry.button.onAction();

            expect(globalThis.eXeMediaPluginDialog.mode).toBe('edit');
            expect(globalThis.top.mindmapEditor.data).toBe('{"nodeData":{"id":"r","topic":"a &amp; &lt;b&gt;"}}');
            expect(plugin.opened[0].initialData).toMatchObject({
                mindmapImgToSave: 'map.png',
                mindmapTitle: 'Seres vivos',
                dimensions: { width: '300', height: '200' },
            });
        });

        it('hands the editor iframe the editor that opened it, not tinymce.activeEditor', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            // A Text iDevice has more than one TinyMCE, so activeEditor can be another one
            expect(globalThis.top.mindmapEditor.tinymce).toBe(plugin.editor);
            expect(globalThis.top.mindmapEditor.pluginDialog).toBeDefined();
            expect(globalThis.eXeMediaPluginDialog.mode).toBe('new');
        });

        it('stores the escaped source the editor returns unchanged', () => {
            const plugin = loadPlugin();
            plugin.registry.button.onAction();
            const code = '{"nodeData":{"id":"r","topic":"&lt;clima&gt; &amp; \\"x\\""}}';
            plugin.opened[0].onSubmit({
                getData: () => ({
                    mindmapImgToSave: 'data:image/png;base64,AAAA',
                    mindmapCode: code,
                    mindmapTitle: 'Clima',
                    mindmapCaption: true,
                    linkToFullSizeImage: false,
                    dimensions: { width: '120', height: '80' },
                }),
            });
            expect(plugin.inserted[0]).toContain(`<p class="exe-mindmap-code">${code}</p>`);
            expect(plugin.inserted[0]).toContain('width="120" height="80" alt="Clima"');
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
