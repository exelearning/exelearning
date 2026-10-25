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
        `${pluginDir}css/content.css`,
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
