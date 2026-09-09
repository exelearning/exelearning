/**
 * Tests for the exported-package unload/beforeunload scanner.
 *
 * The scanner guards a hard acceptance criterion (a SCORM 1.2 package must
 * contain zero unload-family handlers), so both halves matter: every real
 * registration shape has to be detected, and text that merely mentions the
 * word must not be.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
    UNLOAD_SCAN_ALLOWLIST,
    formatUnloadFindings,
    isScannableFile,
    scanPackageForUnloadHandlers,
    scanTextForUnloadHandlers,
} from './unload-handler-scanner';

const encoder = new TextEncoder();

/**
 * Build an unzipped-package shape from plain strings.
 *
 * @param files - Map of package-relative path to file text.
 * @returns The bytes map the scanner consumes.
 */
function pack(files: Record<string, string>): Record<string, Uint8Array> {
    const entries: Record<string, Uint8Array> = {};
    for (const [name, text] of Object.entries(files)) {
        entries[name] = encoder.encode(text);
    }
    return entries;
}

describe('unload handler scanner', () => {
    describe('detects every registration shape', () => {
        it.each([
            [
                'body onunload attribute',
                '<body onload="loadPage()" onunload="unloadPage()">',
                'on-attribute-or-property',
            ],
            ['body onbeforeunload attribute', '<body onbeforeunload="unloadPage()">', 'on-attribute-or-property'],
            ['window.onunload assignment', 'window.onunload = function () {};', 'on-attribute-or-property'],
            ['window.onbeforeunload assignment', 'window.onbeforeunload = handler;', 'on-attribute-or-property'],
            ['bare onunload assignment', 'onunload = handler;', 'on-attribute-or-property'],
            ['addEventListener unload', "window.addEventListener('unload', fn);", 'addEventListener'],
            ['addEventListener beforeunload', 'window.addEventListener("beforeunload", fn);', 'addEventListener'],
            ['addEventListener with backticks', 'globalScope.addEventListener(`unload`, fn);', 'addEventListener'],
            ['addEventListener with spacing', "addEventListener ( 'beforeunload' , fn )", 'addEventListener'],
            ['removeEventListener unload', "window.removeEventListener('unload', fn);", 'removeEventListener'],
            ['jQuery on unload', "$(window).on('unload', fn);", 'jquery-on'],
            ['jQuery on namespaced unload', "$(window).on('unload.eXeRosco', fn);", 'jquery-on'],
            [
                'jQuery combined unload/beforeunload string',
                "$(window).on('unload.eXeRosco beforeunload.eXeRosco', fn);",
                'jquery-on',
            ],
            ['jQuery one', "$(window).one('beforeunload', fn);", 'jquery-on'],
            ['jQuery bind', "$(window).bind('unload', fn);", 'jquery-on'],
            ['jQuery shorthand unload', '$(window).unload(function () {});', 'jquery-shorthand'],
            ['jQuery shorthand beforeunload', '$(window).beforeunload(handler);', 'jquery-shorthand'],
        ])('flags %s', (_label, source, expectedPattern) => {
            const findings = scanTextForUnloadHandlers('sample.js', source);

            expect(findings.length).toBeGreaterThan(0);
            expect(findings.some(finding => finding.pattern === expectedPattern)).toBe(true);
        });

        it('flags an inline script inside an HTML page', () => {
            const html = [
                '<html>',
                '<body>',
                '<script>',
                "window.addEventListener('unload', save);",
                '</script>',
                '</body>',
                '</html>',
            ].join('\n');

            const findings = scanTextForUnloadHandlers('index.html', html);

            expect(findings).toHaveLength(1);
            expect(findings[0].line).toBe(4);
        });

        it('reports every occurrence in a file, ordered by line', () => {
            const source = ["$(window).on('unload.a', fn);", '', "window.addEventListener('beforeunload', fn);"].join(
                '\n',
            );

            const findings = scanTextForUnloadHandlers('a.js', source);

            expect(findings.map(finding => finding.line)).toEqual([1, 3]);
        });

        it('does not inherit a previous scan position', () => {
            const source = "$(window).on('unload.a', fn);";

            expect(scanTextForUnloadHandlers('a.js', source)).toHaveLength(1);
            expect(scanTextForUnloadHandlers('b.js', source)).toHaveLength(1);
        });
    });

    describe('does not flag text that merely mentions unload', () => {
        it.each([
            ['prose in a comment', '// cleanup on unload was removed in favour of pagehide'],
            ['a minified library string', 'console.error("Cloning an unloaded material, call ensureLoaded()")'],
            ['a pagehide registration', "$(window).on('pagehide.eXeRosco', fn);"],
            ['a pageshow registration', "window.addEventListener('pageshow', fn);"],
            ['a visibilitychange registration', "document.addEventListener('visibilitychange', fn);"],
            ['an identifier containing the word', 'const unloadedCount = 3;'],
            ['a property read', 'if (state.unloaded) { return; }'],
            ['an unrelated download attribute', '<a download="file.zip" href="#">x</a>'],
        ])('ignores %s', (_label, source) => {
            expect(scanTextForUnloadHandlers('sample.js', source)).toEqual([]);
        });
    });

    describe('file selection', () => {
        it.each(['index.html', 'page.htm', 'page.xhtml', 'libs/SCOFunctions.js', 'mod.mjs', 'imsmanifest.xml'])(
            'scans %s',
            name => {
                expect(isScannableFile(name)).toBe(true);
            },
        );

        it.each(['theme/base.css', 'content/image.png', 'fonts/inter.woff2', 'README'])('skips %s', name => {
            expect(isScannableFile(name)).toBe(false);
        });

        it('is case-insensitive about extensions', () => {
            expect(isScannableFile('INDEX.HTML')).toBe(true);
        });
    });

    describe('package scan', () => {
        it('finds handlers across several files', () => {
            const entries = pack({
                'index.html': '<body onunload="unloadPage()">',
                'libs/game.js': "$(window).on('beforeunload.x', fn);",
                'theme/base.css': 'body { color: red; }',
            });

            const findings = scanPackageForUnloadHandlers(entries);

            expect(findings.map(finding => finding.file)).toEqual(['index.html', 'libs/game.js']);
        });

        it('returns nothing for a clean package', () => {
            const entries = pack({
                'index.html': '<body onload="loadPage()">',
                'libs/SCOFunctions.js': "window.addEventListener('pagehide', onPageHide);",
            });

            expect(scanPackageForUnloadHandlers(entries)).toEqual([]);
        });

        it('honours an exact-path allowlist', () => {
            const entries = pack({ 'vendor/legacy.js': "window.addEventListener('unload', fn);" });

            expect(scanPackageForUnloadHandlers(entries)).toHaveLength(1);
            expect(scanPackageForUnloadHandlers(entries, ['vendor/legacy.js'])).toEqual([]);
        });

        it('allowlists exactly the vendored jQuery bundle and nothing else', () => {
            // Widening this list hides regressions; every entry needs the
            // justification recorded next to it in the scanner module.
            expect(UNLOAD_SCAN_ALLOWLIST).toEqual(['libs/jquery/jquery.min.js']);
        });

        // The allowlist entry suppresses the only real hit a scanned SCORM 1.2
        // package produces, so its justification is checked against the actual
        // vendored bytes rather than a hand-typed excerpt: a jQuery upgrade
        // that added an unguarded registration must fail this test instead of
        // being silently suppressed everywhere.
        it('every unload registration in the vendored jQuery is the inert IE-only Sizzle guard', () => {
            const jquery = readFileSync(join(process.cwd(), 'public', 'libs', 'jquery', 'jquery.min.js'), 'utf8');

            const findings = scanTextForUnloadHandlers('libs/jquery/jquery.min.js', jquery);

            // The allowlist must be doing real work…
            expect(findings.length).toBeGreaterThan(0);
            // …and every occurrence must sit behind `msMatchesSelector`, which
            // exists only on Internet Explorer / legacy Edge, so no listener is
            // registered on any engine that implements a back/forward cache.
            for (const finding of findings) {
                const at = jquery.indexOf(finding.excerpt);
                expect(at, finding.excerpt).toBeGreaterThan(-1);
                const guardWindow = jquery.slice(Math.max(0, at - 200), at);
                expect(guardWindow, `unguarded registration: ${finding.excerpt}`).toContain('msMatchesSelector');
            }
        });
    });

    describe('reporting', () => {
        it('formats findings as file:line [pattern] excerpt', () => {
            const findings = scanTextForUnloadHandlers('index.html', '<body onunload="unloadPage()">');

            expect(formatUnloadFindings(findings)).toBe('index.html:1 [on-attribute-or-property] onunload=');
        });

        it('formats an empty result as an empty string', () => {
            expect(formatUnloadFindings([])).toBe('');
        });
    });
});
