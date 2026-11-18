/**
 * Executes the real tooltips plugin source against a mocked tinymce global to
 * guard activateButton() against stale editor state: NodeChange can fire on a
 * destroyed editor whose `dom` is already gone (same failure as #2273 in
 * pastecode, reported by Sentry for tooltips).
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const pluginSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'plugin.min.js'), 'utf-8');

function makeEditor() {
    const handlers = {};
    return {
        ui: { registry: { addIcon: vi.fn(), addToggleButton: vi.fn(), addButton: vi.fn(), addMenuItem: vi.fn() } },
        on(name, callback) {
            (handlers[name] = handlers[name] || []).push(callback);
        },
        off: vi.fn(),
        dom: {
            getParent(node, selector) {
                let current = node && node.parentNode;
                while (current && current.nodeName !== selector) current = current.parentNode;
                return current || null;
            },
            loadCSS: vi.fn(),
        },
        _handlers: handlers,
    };
}

function loadPlugin(editor) {
    let registered = null;
    const tinymceMock = {
        PluginManager: { add: (name, callback) => (registered = callback) },
        dom: { DomQuery: vi.fn() },
        DOM: { setStyle: vi.fn(), setStyles: vi.fn(), setAttrib: vi.fn(), removeClass: vi.fn() },
    };
    new Function('tinymce', 'tinyMCE', '_', pluginSource)(tinymceMock, tinymceMock, (s) => s);
    registered(editor, '/libs/tinymce_5/js/tinymce/plugins/tooltips');
    return globalThis.TooltipDialog;
}

describe('tooltips plugin - activateButton stale editor guard', () => {
    afterEach(() => {
        delete globalThis.TooltipDialog;
        document.body.innerHTML = '';
    });

    it('does not throw when NodeChange fires after the editor was destroyed (Sentry repro)', () => {
        const editor = makeEditor();
        loadPlugin(editor);
        const buttonApi = { setActive: vi.fn() };
        editor.ui.registry.addToggleButton.mock.calls[0][1].onSetup(buttonApi);

        editor.dom = undefined;

        expect(() => editor._handlers.NodeChange[0]({ element: document.createElement('a') })).not.toThrow();
        expect(buttonApi.setActive).toHaveBeenCalledWith(false);
    });

    it('still activates the button inside a tooltip link (normal path)', () => {
        const dialog = loadPlugin(makeEditor());
        document.body.innerHTML = `<a class="${dialog.className}" href="#"><span id="t">x</span></a><p id="p">y</p>`;

        expect(dialog.activateButton(document.getElementById('t'))).toBe(true);
        expect(dialog.activateButton(document.getElementById('p'))).toBe(false);
    });
});
