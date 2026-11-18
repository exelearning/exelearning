/**
 * Unit tests for exe_abc_music.js tune loading.
 *
 * abcjsLoad() must take the tunes from the page's own pre.abc-music blocks and never read
 * parent.document, which throws in sandboxed or cross-origin frames (public view, LMS, EPUB).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const script = readFileSync(join(__dirname, 'exe_abc_music.js'), 'utf8');

function loadPage(body) {
    const { window } = new JSDOM(`<body>${body}</body>`, {
        runScripts: 'outside-only',
        virtualConsole: new VirtualConsole(),
    });
    Object.defineProperty(window, 'parent', {
        get() {
            return {
                get document() {
                    throw new window.DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError');
                },
            };
        },
    });
    window.$ = () => {}; // $(function () { ... }) on DOM ready is not needed here
    window.eval(script);
    return window;
}

describe('exe_abc_music.js abcjsLoad', () => {
    it('loads one tune per pre.abc-music without touching parent.document', () => {
        const win = loadPage('<pre class="abc-music">X:1\nK:C\nabc</pre><pre class="abc-music abc-music-midi">X:2\nK:G\ndef</pre>');
        expect(() => win.abcjsLoad()).not.toThrow();
        expect(win.eval('abc')).toEqual(['X:1\nK:C\nabc', 'X:2\nK:G\ndef']);
    });

    it('loads no tune when the page has no ABC blocks', () => {
        const win = loadPage('<p>No music</p>');
        win.abcjsLoad();
        expect(win.eval('abc')).toEqual([]);
    });
});
