/**
 * Unit tests for the pastecode TinyMCE plugin language list.
 *
 * The plugin defines the syntax-highlighting languages offered to the user
 * when wrapping a snippet of code with Prism. These tests guard the dropdown
 * entries so accidental removals during refactors are caught.
 *
 * They also execute the real plugin source against a mocked tinymce global to
 * guard activateButton() against stale editor state (issue #2273): NodeChange
 * can fire on a destroyed editor whose `dom` is already gone.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_PATH = join(__dirname, 'plugin.min.js');
const pluginSource = readFileSync(PLUGIN_PATH, 'utf-8');

function hasLanguageEntry(value) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`value:\\s*'${escaped}'`);
    return regex.test(pluginSource);
}

describe('pastecode plugin - syntax highlighting language list', () => {
    it('keeps the previously supported languages', () => {
        const previous = [
            'markup', 'aspnet', 'clike', 'c', 'cpp', 'css', 'java', 'js',
            'json', 'latex', 'pascal', 'perl', 'php', 'processing', 'python',
            'r', 'ruby', 'sql',
        ];
        for (const lang of previous) {
            expect(hasLanguageEntry(lang)).toBe(true);
        }
    });

    it('exposes Bash as a selectable language', () => {
        expect(hasLanguageEntry('bash')).toBe(true);
        expect(pluginSource).toContain("text: 'Bash'");
    });

    it('exposes PowerShell as a selectable language', () => {
        expect(hasLanguageEntry('powershell')).toBe(true);
        expect(pluginSource).toContain("text: 'PowerShell'");
    });

    it('exposes CMD (Batch) as a selectable language', () => {
        expect(hasLanguageEntry('batch')).toBe(true);
        expect(pluginSource).toContain("text: 'CMD (Batch)'");
    });

    it('exposes all other newly added languages', () => {
        const newLanguages = [
            { value: 'arduino', text: 'Arduino' },
            { value: 'csharp', text: 'C#' },
            { value: 'docker', text: 'Docker' },
            { value: 'git', text: 'Git' },
            { value: 'less', text: 'LESS' },
            { value: 'markdown', text: 'Markdown' },
            { value: 'markup-templating', text: 'Markup templating' },
            { value: 'mermaid', text: 'Mermaid' },
            { value: 'twig', text: 'Twig' },
            { value: 'typescript', text: 'TypeScript' },
        ];
        for (const { value, text } of newLanguages) {
            expect(hasLanguageEntry(value)).toBe(true);
            expect(pluginSource).toContain(`text: '${text}'`);
        }
    });

    it('places the new entries in the expected relative order', () => {
        // Bash sits in its alphabetical slot (B before C), so it appears before
        // the "C type" anchor. Batch and PowerShell are placed after clike.
        const cTypeIndex = pluginSource.indexOf("value: 'clike'");
        const bashIndex = pluginSource.indexOf("value: 'bash'");
        const batchIndex = pluginSource.indexOf("value: 'batch'");
        const powershellIndex = pluginSource.indexOf("value: 'powershell'");

        expect(cTypeIndex).toBeGreaterThan(-1);
        expect(bashIndex).toBeGreaterThan(-1);
        expect(batchIndex).toBeGreaterThan(cTypeIndex);
        expect(powershellIndex).toBeGreaterThan(batchIndex);
    });
});

describe('pastecode plugin - activateButton stale editor guard (issue #2273)', () => {
    function makeEditor() {
        const handlers = {};
        return {
            ui: {
                registry: {
                    addIcon: vi.fn(),
                    addToggleButton: vi.fn(),
                    addButton: vi.fn(),
                    addMenuItem: vi.fn(),
                },
            },
            on(name, callback) {
                (handlers[name] = handlers[name] || []).push(callback);
            },
            off: vi.fn(),
            dom: {
                // Same contract as TinyMCE's DOMUtils.getParents: collect the
                // ancestors matching the selector, walking up from the node.
                getParents(node, selector) {
                    const wanted = selector.toUpperCase();
                    const parents = [];
                    let current = node && node.parentNode;
                    while (current) {
                        if (current.nodeName === wanted) parents.push(current);
                        current = current.parentNode;
                    }
                    return parents;
                },
                loadCSS: vi.fn(),
            },
            _handlers: handlers,
        };
    }

    // Executes the real plugin source (sloppy mode, like a classic script) so
    // PasteCodeDialog lands on globalThis, then registers it on the editor.
    function loadPlugin(editor) {
        let registered = null;
        const tinymceMock = {
            PluginManager: {
                add: (name, callback) => {
                    registered = callback;
                },
            },
            dom: { DomQuery: vi.fn() },
            DOM: { setStyle: vi.fn(), setStyles: vi.fn(), setAttrib: vi.fn() },
        };
        new Function('tinymce', 'tinyMCE', '_', pluginSource)(tinymceMock, tinymceMock, (s) => s);
        expect(typeof registered).toBe('function');
        registered(editor, '/libs/tinymce_5/js/tinymce/plugins/pastecode');
        return globalThis.PasteCodeDialog;
    }

    afterEach(() => {
        delete globalThis.PasteCodeDialog;
        document.body.innerHTML = '';
    });

    it('does not throw when NodeChange fires after the editor was destroyed (Sentry repro)', () => {
        const editor = makeEditor();
        loadPlugin(editor);

        const toggleConfig = editor.ui.registry.addToggleButton.mock.calls[0][1];
        const buttonApi = { setActive: vi.fn() };
        toggleConfig.onSetup(buttonApi);

        // Destroying the editor removes its dom; a late NodeChange still fires.
        editor.dom = undefined;
        const nodeChange = editor._handlers.NodeChange[0];

        expect(() => nodeChange({ element: document.createElement('pre') })).not.toThrow();
        expect(buttonApi.setActive).toHaveBeenCalledWith(false);
    });

    it('returns false instead of crashing when editor.dom is gone', () => {
        const editor = makeEditor();
        const dialog = loadPlugin(editor);

        editor.dom = undefined;

        expect(dialog.activateButton(document.createElement('code'))).toBe(false);
    });

    it('still activates the button for CODE inside a pre-code wrapper (normal path)', () => {
        const editor = makeEditor();
        const dialog = loadPlugin(editor);

        document.body.innerHTML =
            '<div class="pre-code"><div><pre><code id="target">let a = 1;</code></pre></div></div>';
        const code = document.getElementById('target');

        expect(dialog.activateButton(code)).toBe(true);
    });

    it('still keeps the button inactive on plain content (normal path)', () => {
        const editor = makeEditor();
        const dialog = loadPlugin(editor);

        document.body.innerHTML = '<div><p id="plain">plain text</p></div>';
        const paragraph = document.getElementById('plain');

        expect(dialog.activateButton(paragraph)).toBe(false);
    });
});
