/**
 * Unit tests for the ABC Music Notation preview dialog (abcmusic.html).
 *
 * Cloudflare Pages (online.exelearning.dev) redirects `abcmusic.html` to the
 * extensionless `abcmusic`, so the dialog must resolve its resources from its own
 * location, not by stripping the file name from the URL (issue #2624).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(join(__dirname, 'abcmusic.html'), 'utf8');
const pluginDir = 'https://example.org/v1.0.0/libs/tinymce_5/js/tinymce/plugins/abcmusic/';

function resourceUrls(url) {
    // Inline scripts run, external ones are not fetched (abcjsLoad stays undefined).
    const { document } = new JSDOM(html, { url, runScripts: 'dangerously', virtualConsole: new VirtualConsole() })
        .window;
    return [...document.querySelectorAll('script[src], link[href]')].map(el => el.src || el.href);
}

describe('abcmusic.html resource URLs', () => {
    const expected = [
        'https://example.org/v1.0.0/libs/abcjs/abcjs-basic-min.js',
        'https://example.org/v1.0.0/libs/abcjs/abcjs-audio.css',
        'https://example.org/v1.0.0/libs/jquery/jquery.min.js',
        'https://example.org/v1.0.0/libs/abcjs/exe_abc_music.js',
    ];

    it('resolves from the .html URL', () => {
        expect(resourceUrls(`${pluginDir}abcmusic.html`)).toEqual(expected);
    });

    it('resolves from the extensionless URL served after a pretty-URL redirect', () => {
        expect(resourceUrls(`${pluginDir}abcmusic`)).toEqual(expected);
    });

    it('keeps the classes exe_abc_music.js uses to avoid reloading abcjs', () => {
        const { document } = new JSDOM(html).window;
        expect(document.querySelector('script.abcjs-basic-js')).not.toBeNull();
        expect(document.querySelector('link.abcjs-basic-css')).not.toBeNull();
    });
});

describe('abcmusic.html preview markup', () => {
    // The dialog builds the exported markup so exe_abc_music.js renders it as in the export (ABC/MIDI buttons).
    function previewDocument(parentWindow, fragment = '') {
        return new JSDOM(html, {
            url: `${pluginDir}abcmusic.html${fragment}`,
            runScripts: 'dangerously',
            virtualConsole: new VirtualConsole(),
            beforeParse(window) {
                Object.defineProperty(window, 'parent', { value: parentWindow });
            },
        }).window;
    }

    function editorWindow({ source = 'abcde', i18n } = {}) {
        const { window } = new JSDOM(`<textarea id="htmlSource">${source}</textarea>`);
        window.$exe_i18n = i18n;
        return window;
    }

    it('adds the ABC source as exported content with the MIDI class when the URL asks for MIDI', () => {
        const win = previewDocument(editorWindow({ source: 'X:1\nK:C\nabc' }), '#midi=1');
        const pre = win.document.querySelector('main > pre');
        expect(pre.className).toBe('abc-music abc-music-midi');
        expect(pre.textContent).toBe('X:1\nK:C\nabc');
    });

    it('omits the MIDI class when the URL does not ask for MIDI', () => {
        expect(previewDocument(editorWindow()).document.querySelector('pre').className).toBe('abc-music');
        expect(previewDocument(editorWindow(), '#midi=10').document.querySelector('pre').className).toBe('abc-music');
    });

    it('takes $exe_i18n from the editor window', () => {
        const i18n = { download: 'Descargar' };
        expect(previewDocument(editorWindow({ i18n })).$exe_i18n).toBe(i18n);
        expect(previewDocument(editorWindow()).$exe_i18n).toEqual({});
    });

    it('leaves the source empty when the editor textarea is missing', () => {
        const parent = new JSDOM('').window;
        expect(previewDocument(parent).document.querySelector('pre').textContent).toBe('');
    });
});
