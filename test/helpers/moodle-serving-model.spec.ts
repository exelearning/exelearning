/**
 * Tests for the mod_exelearning serving model helper
 * (test/e2e/playwright/helpers/moodle-serving-model.ts).
 *
 * The helper itself lives with the Playwright specs that drive it, but everything it
 * does to bytes — resolving the plugin's runtime pair, rewriting the served HTML the
 * way the plugin's injector does — is plain Node code, so it is pinned here under
 * `bun test` where CI runs it on every push.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { zipSync } from '../../src/shared/export';
import {
    DEFAULT_INJECTOR,
    INJECTOR_SOURCES,
    PLUGIN_RUNTIME_FILES,
    PLUGIN_SCORM_ASSETS_ENV,
    RUNTIME_VERSION_TAG,
    buildHtml5Package,
    injectScormLoader,
    injectorPayload,
    resolvePluginScormAssets,
    runtimeVersionStamp,
    sha256Hex,
} from '../e2e/playwright/helpers/moodle-serving-model';
import { loadHtml5PackageFromZip } from '../e2e/playwright/helpers/prebuilt-package';
import type { ProjectSpec } from './grading-fixtures';

/**
 * The plugin's injector, transcribed by hand from `classes/local/scorm/scorm_injector.php`
 * of mod_exelearning — the `$initscript` / `$tags` / `$tagshtml` PHP strings after
 * concatenation, byte for byte:
 *
 *  - `main` — commit 3b6a7cd45ca9b762189d5e7ebc8f953c4d939023 (`$initscript` at lines 50-60)
 *  - `105`  — commit 09b3f4ce77cbf9bffccc66b7f1630c1d3be5f66d, PR #105 (`$initscript` at
 *             lines 74-88; the same commit adds the dedupe `preg_replace` at lines 121-131)
 *
 * These constants are deliberately NOT imported from the helper: they are the second
 * copy that makes drift visible. When the plugin changes its injector, update the helper
 * and this pin together, from the new plugin commit, and record that commit above.
 */
const MARKER = '<!-- mod_exelearning:scorm-loader -->';

const MAIN_INIT_SCRIPT =
    '\n    <script>\n' +
    '      (function(){\n' +
    '        var t = setInterval(function(){\n' +
    '          if (window.pipwerks && window.pipwerks.SCORM) {\n' +
    '            clearInterval(t);\n' +
    '            try { window.pipwerks.SCORM.init(); } catch(e){}\n' +
    '          }\n' +
    '        }, 50);\n' +
    '      })();\n' +
    '    </script>\n';

const PR105_INIT_SCRIPT =
    '\n    <script>\n' +
    '      (function(){\n' +
    '        var opened = false, ticks = 0;\n' +
    '        var t = setInterval(function(){\n' +
    '          ticks++;\n' +
    '          var ns = window.exeScorm12;\n' +
    "          if (!opened && ns && ns.session && typeof ns.session.open === 'function') {\n" +
    '            try { opened = ns.session.open({ ownsLifecycle: false }) === true; } catch(e){}\n' +
    '          } else if (!opened && ticks > 40 && window.pipwerks && window.pipwerks.SCORM) {\n' +
    '            try { window.pipwerks.SCORM.init(); opened = true; } catch(e){}\n' +
    '          }\n' +
    '          if (opened || ticks > 200) { clearInterval(t); }\n' +
    '        }, 50);\n' +
    '      })();\n' +
    '    </script>\n';

function tags(prefix: string, initScript: string): string {
    return (
        MARKER +
        `\n    <script src="${prefix}libs/SCORM_API_wrapper.js"></script>` +
        `\n    <script src="${prefix}libs/SCOFunctions.js"></script>` +
        initScript
    );
}

const PAGE = '<!DOCTYPE html>\n<html><head>\n<title>t</title>\n</HEAD>\n<body><p>x</p></body></html>';

describe('moodle-serving-model', () => {
    describe('injector variants', () => {
        it('ships the #105 injector by default — the runtime the plugin will serve', () => {
            expect(DEFAULT_INJECTOR).toBe('105');
        });

        it('records which plugin commit each snippet was copied from', () => {
            expect(INJECTOR_SOURCES.main.commit).toBe('3b6a7cd45ca9b762189d5e7ebc8f953c4d939023');
            expect(INJECTOR_SOURCES['105'].commit).toBe('09b3f4ce77cbf9bffccc66b7f1630c1d3be5f66d');
        });

        it("reproduces plugin main's pipwerks.SCORM.init() bootstrap byte for byte", () => {
            expect(injectorPayload('main', true)).toBe(tags('', MAIN_INIT_SCRIPT));
            expect(injectorPayload('main', false)).toBe(tags('../', MAIN_INIT_SCRIPT));
        });

        it("reproduces #105's session.open({ ownsLifecycle: false }) bootstrap byte for byte", () => {
            expect(injectorPayload('105', true)).toBe(tags('', PR105_INIT_SCRIPT));
            expect(injectorPayload('105', false)).toBe(tags('../', PR105_INIT_SCRIPT));
        });
    });

    describe('injectScormLoader', () => {
        it('inserts the payload once, before the first </head>, case-insensitively', () => {
            const out = injectScormLoader(PAGE, true, '105');
            // preg_replace('~</head>~i', $payload . '</head>', $html, 1): the matched
            // tag is rewritten in lower case, and only the first one.
            expect(out).toBe(PAGE.replace('</HEAD>', `${tags('', PR105_INIT_SCRIPT)}</head>`));
            expect(out.split(MARKER).length - 1).toBe(1);
        });

        it('uses ../libs/ for pages under html/', () => {
            expect(injectScormLoader(PAGE, false, 'main')).toContain('<script src="../libs/SCOFunctions.js">');
        });

        it('is idempotent on the marker, like the PHP guard', () => {
            const once = injectScormLoader(PAGE, true, '105');
            expect(injectScormLoader(once, true, '105')).toBe(once);
        });

        it('leaves an empty page and a page without </head> untouched', () => {
            expect(injectScormLoader('', true, '105')).toBe('');
            expect(injectScormLoader('<html><body></body></html>', true, '105')).toBe('<html><body></body></html>');
        });

        it("#105 drops the package's own runtime tags so the runtime loads exactly once", () => {
            const html =
                '<html><head>\n' +
                '    <script type="text/javascript" src="libs/SCORM_API_wrapper.js"></script>\n' +
                '    <script src="../libs/SCOFunctions.js" defer></script>\n' +
                '    <script src="libs/common.js"></script>\n' +
                '</head><body></body></html>';
            const out = injectScormLoader(html, true, '105');
            // Only the plugin's own two tags remain — one reference to each file.
            expect(out).not.toContain('type="text/javascript"');
            expect(out).not.toContain('defer');
            expect(out.split('SCORM_API_wrapper.js').length - 1).toBe(1);
            expect(out.split('SCOFunctions.js').length - 1).toBe(1);
            expect(out).toContain('<script src="libs/common.js"></script>');
            expect(out).toContain(tags('', PR105_INIT_SCRIPT));
        });

        it("plugin main keeps the package's own runtime tags (it never deduplicated)", () => {
            const html = '<html><head>\n    <script src="libs/SCOFunctions.js"></script>\n</head><body></body></html>';
            const out = injectScormLoader(html, true, 'main');
            expect(out.split('src="libs/SCOFunctions.js"').length - 1).toBe(2);
        });
    });

    const tempDirs: string[] = [];

    function makeAssetsDir(files: readonly string[]): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-scorm-assets-'));
        tempDirs.push(dir);
        for (const name of files) {
            fs.writeFileSync(path.join(dir, name), `// ${name}\n`);
        }
        return dir;
    }

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    describe('package and runtime provenance (trace contract v2)', () => {
        it('sha256Hex is the hex SHA-256 of the bytes', () => {
            // `printf abc | shasum -a 256`
            expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
                'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
            );
        });

        it('reads the eXeLearning-SCORM12-Runtime stamp out of an assembled SCOFunctions.js', () => {
            const header =
                '/*\n * SCOFunctions.js — eXeLearning SCORM 1.2 runtime (assembled file).\n' +
                ` * ${RUNTIME_VERSION_TAG}: v0.0.0-alpha\n *\n * Generated by the SCORM 1.2 exporter\n */\n`;
            expect(runtimeVersionStamp(header)).toBe('v0.0.0-alpha');
        });

        it('reports null for the legacy pair, which carries no stamp', () => {
            expect(runtimeVersionStamp('/* SCOFunctions.js — legacy */\nfunction loadPage() {}\n')).toBeNull();
        });

        it('loadHtml5PackageFromZip records the sha256 of the zip it was given', () => {
            const bytes = zipSync({
                'index.html': new TextEncoder().encode(
                    '<html><head></head><body><div id="ide-a" class="idevice_node"></div></body></html>',
                ),
                'html/two.html': new TextEncoder().encode('<html><head></head><body></body></html>'),
            });
            const dir = makeAssetsDir([]);
            const zipPath = path.join(dir, 'pkg.zip');
            fs.writeFileSync(zipPath, bytes);
            const pkg = loadHtml5PackageFromZip(zipPath);
            expect(pkg.zipSha256).toBe(sha256Hex(bytes));
            expect(pkg.pages.map(p => p.url)).toEqual(['index.html', 'html/two.html']);
            expect(pkg.pages[0].ideviceNodes).toEqual(['ide-a']);
        });

        it('buildHtml5Package records the sha256 of the export it produced', async () => {
            const spec: ProjectSpec = {
                title: 'provenance',
                odeId: 'GRADING-FIXTURE-PROVENANCE',
                pages: [{ id: 'page-1', title: 'P1', idevices: [{ id: 'ide-a', weighted: 100, questions: 2 }] }],
            };
            const dir = makeAssetsDir([]);
            const pkg = await buildHtml5Package(spec, dir);
            expect(pkg.zipSha256).toMatch(/^[0-9a-f]{64}$/);
            expect(pkg.pages[0].ideviceNodes).toEqual(['ide-a']);
            expect(pkg.xapiConfig.odeId).toBe('GRADING-FIXTURE-PROVENANCE');
        }, 30000);
    });

    describe('resolvePluginScormAssets', () => {
        it('names the environment variable when no directory is configured', () => {
            expect(() => resolvePluginScormAssets(undefined)).toThrow(PLUGIN_SCORM_ASSETS_ENV);
            expect(() => resolvePluginScormAssets('')).toThrow(PLUGIN_SCORM_ASSETS_ENV);
        });

        it('names the missing runtime file when the directory is incomplete', () => {
            const dir = makeAssetsDir(['SCORM_API_wrapper.js']);
            expect(() => resolvePluginScormAssets(dir)).toThrow(path.join(dir, 'SCOFunctions.js'));
        });

        it('returns the directory when both runtime files are present', () => {
            const dir = makeAssetsDir(PLUGIN_RUNTIME_FILES);
            expect(resolvePluginScormAssets(dir)).toBe(dir);
        });
    });
});
