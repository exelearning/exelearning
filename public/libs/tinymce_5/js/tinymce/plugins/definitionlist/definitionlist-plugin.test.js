/**
 * Unit tests for the definitionlist TinyMCE plugin.
 *
 * addListOrTerm() re-fetches the surrounding DL before moving the cursor to
 * the new term. With a stale selection (e.g. a non-collapsed selection outside
 * any DL) that re-fetch returns null and the plugin crashed on
 * p.getElementsByTagName (issue #2273, 2 Sentry events). These tests execute
 * the real plugin source against a mocked tinymce global.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_PATH = join(__dirname, 'plugin.min.js');
const pluginSource = readFileSync(PLUGIN_PATH, 'utf-8');

describe('definitionlist plugin - addListOrTerm stale DL guard (issue #2273)', () => {
    function makeEditor({ node, collapsed, dlParent }) {
        return {
            ui: {
                registry: {
                    addIcon: vi.fn(),
                    addButton: vi.fn(),
                    addMenuItem: vi.fn(),
                },
            },
            on: vi.fn(),
            selection: {
                getNode: () => node,
                isCollapsed: () => collapsed,
                setCursorLocation: vi.fn(),
            },
            dom: {
                getParent: vi.fn(() => dlParent || null),
                getNext: vi.fn(() => null),
                loadCSS: vi.fn(),
            },
            windowManager: {
                confirm: vi.fn(),
            },
        };
    }

    // Executes the real plugin source (sloppy mode, like a classic script) and
    // registers it on the editor. Returns the collaborators the plugin uses.
    function loadPlugin(editor) {
        let registered = null;
        const tinymceMock = {
            PluginManager: {
                add: (name, callback) => {
                    registered = callback;
                },
            },
        };
        const tinyMCEMock = { execCommand: vi.fn() };
        const appended = [];
        const jQueryStub = (target) => ({
            before: vi.fn(),
            append: (content) => appended.push({ target, content }),
        });
        new Function('tinymce', 'tinyMCE', '_', '$', pluginSource)(tinymceMock, tinyMCEMock, (s) => s, jQueryStub);
        expect(typeof registered).toBe('function');
        registered(editor, '/libs/tinymce_5/js/tinymce/plugins/definitionlist');
        const onAction = editor.ui.registry.addButton.mock.calls[0][1].onAction;
        return { onAction, tinyMCEMock, appended };
    }

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('does not throw when the selection is not inside a DL (Sentry repro)', () => {
        // Non-collapsed selection outside any DL: the confirm branch is
        // skipped and the DL re-fetch returns null.
        const editor = makeEditor({
            node: document.createElement('p'),
            collapsed: false,
            dlParent: null,
        });
        const { onAction, appended } = loadPlugin(editor);

        expect(() => onAction()).not.toThrow();

        // The jQuery append above the re-fetch tolerates null and still runs.
        expect(appended.length).toBe(1);
        expect(editor.selection.setCursorLocation).not.toHaveBeenCalled();
    });

    it('moves the cursor to the new term when the selection is inside a DL (normal path)', () => {
        document.body.innerHTML = '<dl class="exe-dl"><dt id="dt">Term</dt><dd><p id="p">def</p></dd></dl>';
        const dl = document.querySelector('dl');
        const editor = makeEditor({
            node: document.getElementById('p'),
            collapsed: true,
            dlParent: dl,
        });
        const { onAction, appended } = loadPlugin(editor);

        expect(() => onAction()).not.toThrow();

        expect(appended.length).toBe(1);
        expect(appended[0].target).toBe(dl);
        expect(editor.selection.setCursorLocation).toHaveBeenCalledWith(document.getElementById('dt'), 1);
    });

    it('offers to create a new DL on a collapsed selection outside any DL (normal path)', () => {
        const editor = makeEditor({
            node: document.createElement('p'),
            collapsed: true,
            dlParent: null,
        });
        const { onAction, tinyMCEMock } = loadPlugin(editor);

        onAction();

        expect(editor.windowManager.confirm).toHaveBeenCalledTimes(1);
        const confirmCallback = editor.windowManager.confirm.mock.calls[0][1];

        confirmCallback(true);
        expect(tinyMCEMock.execCommand).toHaveBeenCalledTimes(1);
        const [command, ui, html] = tinyMCEMock.execCommand.mock.calls[0];
        expect(command).toBe('mceInsertContent');
        expect(ui).toBe(false);
        expect(html).toContain('<dl class="exe-dl">');
        expect(html).toContain('<dt>');
    });
});
