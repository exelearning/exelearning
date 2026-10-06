/**
 * Unit tests for the exemermaid TinyMCE plugin
 *
 * The button opens Sirena, the Mermaid diagram editor vendored at
 * app/common/sirena/, in a TinyMCE window. Sirena itself reads the diagram under
 * the cursor and writes it back, so what the plugin owns is how the window is
 * opened, the toggle state of the button, the Mermaid preload and the CSS path.
 */

describe('exemermaid plugin - Path Handling', () => {
    describe('CSS path construction', () => {
        // The plugin uses: editor.dom.loadCSS(url + "/css/content.css")
        // where `url` is provided by TinyMCE plugin loader
        function getCssPath(pluginUrl) {
            return pluginUrl + '/css/content.css';
        }

        it('should construct correct CSS path with root installation', () => {
            const pluginUrl = '/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with basePath prefix', () => {
            const pluginUrl = '/web/exe/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/web/exe/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with deep basePath', () => {
            const pluginUrl = '/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/deep/nested/path/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with version prefix', () => {
            const pluginUrl = '/v3.0/libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/v3.0/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should construct correct CSS path with relative URL (static mode)', () => {
            const pluginUrl = './libs/tinymce_5/js/tinymce/plugins/exemermaid';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('./libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('should handle URL with trailing slash', () => {
            const pluginUrl = '/libs/tinymce_5/js/tinymce/plugins/exemermaid/';
            const result = getCssPath(pluginUrl);
            // Note: This produces a double slash, which browsers typically normalize
            expect(result).toBe('/libs/tinymce_5/js/tinymce/plugins/exemermaid//css/content.css');
        });

        it('should handle empty URL', () => {
            const pluginUrl = '';
            const result = getCssPath(pluginUrl);
            expect(result).toBe('/css/content.css');
        });
    });

    describe('Sirena window (real plugin source)', () => {
        // These tests run the real plugin.min.js against a stub editor.
        const fs = require('node:fs');
        const path = require('node:path');
        const PLUGIN_SRC = fs.readFileSync(path.join(__dirname, 'plugin.min.js'), 'utf8');

        const body = { nodeName: 'BODY', parentNode: null };
        const selected = { node: { nodeName: 'P', className: '', parentNode: body }, text: '' };

        function loadPlugin(settings = { sirena_url: './app/common/sirena/index.html' }) {
            const calls = [];
            const handlers = {};
            const registry = {};
            const opened = [];
            const editor = {
                settings,
                ui: {
                    registry: {
                        addIcon: () => {},
                        addToggleButton: (name, spec) => {
                            registry.button = spec;
                        },
                        addMenuItem: (name, spec) => {
                            registry.menuItem = spec;
                        },
                    },
                },
                on: (name, fn) => {
                    handlers[name] = fn;
                },
                off: (name) => {
                    delete handlers[name];
                },
                dom: { loadCSS: (href) => calls.push('css:' + href) },
                getBody: () => body,
                selection: {
                    getNode: () => selected.node,
                    getContent: () => selected.text,
                    getBookmark: (type, normalized) => ({ type, normalized, at: 'cursor' }),
                },
                windowManager: {
                    openUrl: (spec) => {
                        calls.push('openUrl');
                        opened.push(spec);
                    },
                },
            };
            const tinymce = {
                PluginManager: { add: (name, factory) => tinymce.PluginManager._factories.push(factory) },
            };
            tinymce.PluginManager._factories = [];
            new Function('tinymce', '_', PLUGIN_SRC)(tinymce, (s) => s);
            const api = tinymce.PluginManager._factories[0](editor, '/libs/tinymce_5/js/tinymce/plugins/exemermaid');
            return { editor, registry, handlers, calls, opened, api };
        }

        let originalExe;
        let originalWidth;
        let originalHeight;

        beforeEach(() => {
            originalExe = globalThis.$exe;
            originalWidth = window.innerWidth;
            originalHeight = window.innerHeight;
        });

        afterEach(() => {
            if (typeof originalExe === 'undefined') {
                delete globalThis.$exe;
            } else {
                globalThis.$exe = originalExe;
            }
            window.innerWidth = originalWidth;
            window.innerHeight = originalHeight;
        });

        it('opens Sirena from the toolbar button, at the URL of the editor settings', () => {
            globalThis.$exe = { mermaid: { loadMermaid: () => {}, init: () => {} } };
            const plugin = loadPlugin();
            plugin.registry.button.onAction();

            expect(plugin.opened).toHaveLength(1);
            expect(plugin.opened[0].url).toBe('./app/common/sirena/index.html');
            // The title says what the window is, and which editor it is
            expect(plugin.opened[0].title).toBe('Mermaid diagram (Sirena)');
            // Sirena has its own Insert and Cancel: the window adds no buttons
            expect(plugin.opened[0].buttons).toEqual([]);
        });

        it('opens Sirena from the menu item too', () => {
            globalThis.$exe = { mermaid: { loadMermaid: () => {}, init: () => {} } };
            const plugin = loadPlugin();
            plugin.registry.menuItem.onAction();

            expect(plugin.opened).toHaveLength(1);
        });

        it('falls back to the server path when the settings do not name one', () => {
            globalThis.$exe = { mermaid: { loadMermaid: () => {}, init: () => {} } };
            const plugin = loadPlugin({});
            plugin.registry.button.onAction();

            expect(plugin.opened[0].url).toBe('/app/common/sirena/index.html');
        });

        it('starts loading Mermaid before the window is opened', () => {
            const order = [];
            globalThis.$exe = { mermaid: { loadMermaid: () => order.push('loadMermaid'), init: () => {} } };
            const plugin = loadPlugin();
            plugin.editor.windowManager.openUrl = () => order.push('openUrl');
            plugin.registry.button.onAction();

            expect(order).toEqual(['loadMermaid', 'openUrl']);
        });

        it('gives the window room for code and drawing, capped on a large screen', () => {
            window.innerWidth = 1920;
            window.innerHeight = 1080;
            const plugin = loadPlugin();
            plugin.registry.button.onAction();

            expect(plugin.opened[0].width).toBe(1200);
            expect(plugin.opened[0].height).toBe(760);
        });

        it('keeps a margin around the window on a small screen', () => {
            window.innerWidth = 800;
            window.innerHeight = 600;
            const plugin = loadPlugin();
            plugin.registry.button.onAction();

            expect(plugin.opened[0].width).toBe(760);
            expect(plugin.opened[0].height).toBe(480);
        });

        it('never makes the window smaller than a usable minimum', () => {
            window.innerWidth = 300;
            window.innerHeight = 300;
            const plugin = loadPlugin();
            plugin.registry.button.onAction();

            expect(plugin.opened[0].width).toBe(320);
            expect(plugin.opened[0].height).toBe(400);
        });

        it('marks the button as active only inside a Mermaid block', () => {
            const plugin = loadPlugin();
            const states = [];
            const release = plugin.registry.button.onSetup({ setActive: (value) => states.push(value) });

            plugin.handlers.NodeChange({ element: { nodeName: 'PRE', className: 'mermaid' } });
            plugin.handlers.NodeChange({ element: { nodeName: 'PRE', className: 'language-js' } });
            plugin.handlers.NodeChange({ element: { nodeName: 'P', className: 'mermaid' } });
            plugin.handlers.NodeChange({ element: null });
            expect(states).toEqual([true, false, false, false]);

            release();
            expect(plugin.handlers.NodeChange).toBeUndefined();
        });

        it('loads its content CSS when the editor starts', () => {
            const plugin = loadPlugin();
            plugin.handlers.init({});

            expect(plugin.calls).toContain('css:/libs/tinymce_5/js/tinymce/plugins/exemermaid/css/content.css');
        });

        it('still renders the diagram when the editor is deactivated', () => {
            const init = vi.fn();
            globalThis.$exe = { mermaid: { loadMermaid: () => {}, init } };
            const plugin = loadPlugin();
            plugin.handlers.deactivate({});

            expect(init).toHaveBeenCalledTimes(1);
        });

        describe('context handed to Sirena', () => {
            // The editor loses its selection while the window loads, so the plugin
            // records it when the button is pressed; Sirena reads it through getContext().
            afterEach(() => {
                selected.node = { nodeName: 'P', className: '', parentNode: body };
                selected.text = '';
            });

            it('is empty before the button is pressed', () => {
                const plugin = loadPlugin();

                expect(plugin.api.getContext()).toEqual({ block: null, selectedText: '', bookmark: null });
            });

            it('records the Mermaid block under the cursor, with no bookmark', () => {
                const pre = { nodeName: 'PRE', className: 'mermaid', parentNode: body };
                selected.node = pre;
                const plugin = loadPlugin();
                plugin.registry.button.onAction();

                expect(plugin.api.getContext()).toEqual({ block: pre, selectedText: '', bookmark: null });
            });

            it('finds the block when the cursor is inside a child of it', () => {
                const pre = { nodeName: 'PRE', className: 'mermaid', parentNode: body };
                selected.node = { nodeName: 'SPAN', className: '', parentNode: pre };
                const plugin = loadPlugin();
                plugin.registry.button.onAction();

                expect(plugin.api.getContext().block).toBe(pre);
            });

            it('records the selected text and where to insert a new diagram', () => {
                selected.text = 'graph LR\n A --> B';
                const plugin = loadPlugin();
                plugin.registry.menuItem.onAction();

                expect(plugin.api.getContext()).toEqual({
                    block: null,
                    selectedText: 'graph LR\n A --> B',
                    bookmark: { type: 2, normalized: true, at: 'cursor' },
                });
            });

            it('does not treat a code block of another language as a diagram', () => {
                selected.node = { nodeName: 'PRE', className: 'language-js', parentNode: body };
                const plugin = loadPlugin();
                plugin.registry.button.onAction();

                expect(plugin.api.getContext().block).toBeNull();
            });
        });

        it('does not throw when $exe is undefined', () => {
            delete globalThis.$exe;
            const plugin = loadPlugin();

            expect(() => plugin.registry.button.onAction()).not.toThrow();
            expect(plugin.opened).toHaveLength(1);
        });

        it('does not throw when $exe.mermaid is missing', () => {
            globalThis.$exe = {};
            const plugin = loadPlugin();

            expect(() => plugin.registry.button.onAction()).not.toThrow();
        });
    });
});
