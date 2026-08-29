/**
 * Moodle serving model for exported eXeLearning packages.
 *
 * Reproduces, in a real browser, exactly how `mod_exelearning` serves an extracted
 * package to a learner:
 *
 *  1. The package is an eXeLearning export, unzipped, served file-by-file from a
 *     single clean origin (page.route + route.fulfill — no dev server, no service
 *     worker, no caching).
 *  2. Every `*.htm` / `*.html` entry is rewritten exactly like
 *     `classes/local/scorm/scorm_injector.php`: the two wrapper <script> tags plus
 *     the 50 ms `setInterval` bootstrap are inserted before the first `</head>`, with
 *     `libs/...` at the package root and `../libs/...` under `html/`. Two revisions of
 *     that bootstrap exist and both are reproduced verbatim — see {@link InjectorVariant}.
 *     The default is the one the plugin will ship (#105).
 *  3. `libs/SCORM_API_wrapper.js` and `libs/SCOFunctions.js` are served from the
 *     PLUGIN's own copies (`<mod_exelearning>/assets/scorm/`, named by the
 *     `MOD_EXELEARNING_SCORM_ASSETS` variable) — an HTML5 export ships neither.
 *  4. Every served `form.js` / `scrambled-list.js` gets the plugin's iDevice patch
 *     (`classes/local/scorm/idevice_patch.php`): the `body.exe-scorm` half of their
 *     save guard is stripped. Without it neither type can score in a web package.
 *  5. A parent page holds the SCORM 1.2 `window.API` (a RECORDING one, with a real
 *     cmi map) and a single `<iframe id="exelearningobject">`. Navigation between
 *     package pages is an `iframe.src` assignment — the parent, its `window.API` and
 *     its `cmi` map survive it, which is what makes the cross-page
 *     `cmi.suspend_data` behaviour observable.
 *
 * The recorded traffic is written to a trace file per the trace contract
 * (test/fixtures/grading/TRACE-CONTRACT.md, v2), which is what a plugin-side replay
 * reads. A v2 trace names the bytes that produced it: the sha256 of the exported zip
 * ({@link BuiltPackage.zipSha256}) and of the served runtime plus its version stamp
 * ({@link ServedRuntime}).
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    unzipSync,
} from '../../../../src/shared/export';
import { createGradingDocumentWithYDoc, type ProjectSpec } from '../../../helpers/grading-fixtures';
import type * as Y from 'yjs';

/**
 * Environment variable naming the directory where the PLUGIN keeps the two wrapper
 * files it injects (`<mod_exelearning>/assets/scorm`, not core's copies).
 *
 * The pair is not part of this repository and there is no default: a checkout without
 * the plugin cannot serve a package the way the plugin does, and pretending otherwise
 * with a path from someone's disk turns every CI machine red with ENOENT. The variable
 * is only read when a package is actually installed on a page, so a spec can be listed
 * and can skip itself cleanly when it is unset.
 */
export const PLUGIN_SCORM_ASSETS_ENV = 'MOD_EXELEARNING_SCORM_ASSETS';

/** The two files `scorm_injector.php` references and `package_manager.php` supplies. */
export const PLUGIN_RUNTIME_FILES = ['SCORM_API_wrapper.js', 'SCOFunctions.js'] as const;

/** The plugin assets directory named by {@link PLUGIN_SCORM_ASSETS_ENV}, if any. */
export function pluginScormAssetsFromEnv(): string | undefined {
    return process.env[PLUGIN_SCORM_ASSETS_ENV] || undefined;
}

/**
 * Check that `assetsDir` holds the plugin's runtime pair, or say exactly what to do.
 *
 * @param assetsDir the configured directory (an option, or the environment variable)
 * @returns the same directory, once both files are known to exist
 */
export function resolvePluginScormAssets(assetsDir: string | undefined): string {
    if (!assetsDir) {
        throw new Error(
            `${PLUGIN_SCORM_ASSETS_ENV} is not set. Point it at the mod_exelearning checkout's assets/scorm ` +
                `directory (the ${PLUGIN_RUNTIME_FILES.join(' + ')} pair the plugin injects) to run this lane.`,
        );
    }
    for (const name of PLUGIN_RUNTIME_FILES) {
        const file = path.join(assetsDir, name);
        if (!fs.existsSync(file)) {
            throw new Error(
                `plugin runtime file not found: ${file} (${PLUGIN_SCORM_ASSETS_ENV}=${assetsDir}). ` +
                    'It must name a directory holding both SCORM_API_wrapper.js and SCOFunctions.js.',
            );
        }
    }
    return assetsDir;
}

/** Hex SHA-256 of some bytes — how a trace names the package and runtime it was recorded from. */
export function sha256Hex(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Header line the SCORM 1.2 exporter stamps into an assembled `SCOFunctions.js`
 * (`SCORM12_RUNTIME_VERSION_TAG` in src/shared/export/utils/Scorm12Runtime.ts). Kept
 * greppable there on purpose, so this stays a text scan rather than a JS evaluation.
 */
export const RUNTIME_VERSION_TAG = 'eXeLearning-SCORM12-Runtime';

/**
 * The version stamp of a served `SCOFunctions.js`, or null when it carries none —
 * the legacy pair predates the stamp, and that absence is itself provenance.
 */
export function runtimeVersionStamp(source: string): string | null {
    const match = new RegExp(`${RUNTIME_VERSION_TAG}:\\s*(\\S+)`).exec(source);
    return match ? match[1] : null;
}

/** The exact marker `scorm_injector.php` writes, used verbatim (and as its idempotence guard). */
const INJECT_MARKER = '<!-- mod_exelearning:scorm-loader -->';

/**
 * Which revision of the plugin's `scorm_injector.php` to reproduce.
 *
 * The two differ in how the SCORM session is opened, and that difference decides
 * whether anything is recorded at all:
 *
 *  - `main` forces `pipwerks.SCORM.init()`. With the legacy runtime pair that opens the
 *    connection and every write reaches `window.API`. With the rewritten runtime
 *    (exelearning#2209, which the plugin ships from #105 on) the pipwerks connection
 *    opens but the runtime's own client stays idle, so it refuses every write locally
 *    with 301: `finalCmi` stays empty and nothing says so.
 *  - `105` waits for `exeScorm12.session.open({ ownsLifecycle: false })`, the runtime's
 *    entry point for a host that owns the page, and falls back to `init()` after two
 *    seconds for a package whose runtime predates it.
 */
export type InjectorVariant = 'main' | '105';

/** The runtime the plugin will ship; `main` stays available to reproduce legacy traffic. */
export const DEFAULT_INJECTOR: InjectorVariant = '105';

/**
 * Where each snippet below was copied from. test/helpers/moodle-serving-model.spec.ts
 * keeps a second, independent transcription of the same PHP strings and diffs the two,
 * so an update to one side without the other is caught.
 */
export const INJECTOR_SOURCES: Record<InjectorVariant, { repo: string; ref: string; commit: string; file: string }> = {
    main: {
        repo: 'exelearning/moodle-mod_exelearning',
        ref: 'main',
        commit: '3b6a7cd45ca9b762189d5e7ebc8f953c4d939023',
        file: 'classes/local/scorm/scorm_injector.php',
    },
    '105': {
        repo: 'exelearning/moodle-mod_exelearning',
        ref: 'pull/105',
        commit: '09b3f4ce77cbf9bffccc66b7f1630c1d3be5f66d',
        file: 'classes/local/scorm/scorm_injector.php',
    },
};

/** The exact `$initscript` each revision of `scorm_injector.php` builds, byte for byte. */
const INIT_SCRIPTS: Record<InjectorVariant, string> = {
    main:
        '\n    <script>\n' +
        '      (function(){\n' +
        '        var t = setInterval(function(){\n' +
        '          if (window.pipwerks && window.pipwerks.SCORM) {\n' +
        '            clearInterval(t);\n' +
        '            try { window.pipwerks.SCORM.init(); } catch(e){}\n' +
        '          }\n' +
        '        }, 50);\n' +
        '      })();\n' +
        '    </script>\n',
    '105':
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
        '    </script>\n',
};

/**
 * #105's dedupe: the package's own `<script>` tags for the runtime pair are dropped
 * before the plugin's are inserted, so the runtime is parsed and executed exactly once
 * (`preg_replace` in `scorm_injector.php::inject`, same commit). Plugin main has no
 * such step. An HTML5 export carries neither tag, so for it this is a no-op.
 */
const PACKAGE_RUNTIME_TAGS =
    /[ \t]*<script\b[^>]*\bsrc\s*=\s*"[^"]*(?:SCORM_API_wrapper|SCOFunctions)\.js"[^>]*>\s*<\/script>[ \t]*\r?\n?/gi;

/**
 * The exact `$tags` (`atRoot`) / `$tagshtml` payload one injector revision inserts.
 *
 * @param injector which `scorm_injector.php` to reproduce
 * @param atRoot   true for `index.html` (`libs/...`), false for `html/*` (`../libs/...`)
 */
export function injectorPayload(injector: InjectorVariant, atRoot: boolean): string {
    const prefix = atRoot ? '' : '../';
    return (
        INJECT_MARKER +
        `\n    <script src="${prefix}libs/SCORM_API_wrapper.js"></script>` +
        `\n    <script src="${prefix}libs/SCOFunctions.js"></script>` +
        INIT_SCRIPTS[injector]
    );
}

/**
 * The plugin's serve-time iDevice patch (`idevice_patch.php::patch`), verbatim.
 *
 * `form` and `scrambled-list` are the only two gradable types that put
 * `body.exe-scorm` in front of their `sendScore()` call, and a web/HTML5 export never
 * carries that class — so without this patch both stay silently at their seeded 0.
 */
export const IDEVICE_PATCHES: Record<string, Record<string, string>> = {
    'form.js': {
        "$('body').hasClass('exe-scorm') && data.isScorm > 0": 'data.isScorm > 0',
    },
    'scrambled-list.js': {
        "document.body.classList.contains('exe-scorm') && data.isScorm > 0": 'data.isScorm > 0',
    },
};

/** Apply {@link IDEVICE_PATCHES} to one served file. Returns the (possibly unchanged) source. */
export function applyIdevicePatch(key: string, source: string): { source: string; applied: number } {
    const name = key.split('/').pop() ?? key;
    const patches = IDEVICE_PATCHES[name];
    if (!patches) return { source, applied: 0 };
    let out = source;
    let applied = 0;
    for (const [search, replace] of Object.entries(patches)) {
        if (out.indexOf(search) !== -1) {
            out = out.split(search).join(replace);
            applied++;
        }
    }
    return { source: out, applied };
}

/** One page of the served package, in navigation order. */
export interface ServedPage {
    index: number;
    /** Package-relative path, e.g. `index.html` or `html/page-two.html`. */
    url: string;
    /** `.idevice_node` element ids in DOM order — slot i+1 of cmi.suspend_data. */
    ideviceNodes: string[];
}

export interface BuiltPackage {
    /** Raw export entries, keyed by package-relative path. */
    files: Record<string, Uint8Array>;
    /** Hex SHA-256 of the exported zip these entries came from, before any serve-time patch. */
    zipSha256: string;
    /** Pages in navigation order (index.html first). */
    pages: ServedPage[];
    /** The `window.exeXapi` config parsed out of index.html (`{}` when absent). */
    xapiConfig: Record<string, unknown>;
    /** Which served files the iDevice patch actually changed. */
    patchedFiles: string[];
}

/** `.idevice_node` element ids, in DOM order, for one page's HTML. */
export function ideviceNodeIds(html: string): string[] {
    const ids: string[] = [];
    const re = /<div\s+id="([^"]+)"\s+class="idevice_node[^"]*"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

/** Best-effort content type for serving the unzipped export over page.route(). */
export function exportContentType(p: string): string {
    if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html; charset=utf-8';
    if (p.endsWith('.js') || p.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (p.endsWith('.css')) return 'text/css; charset=utf-8';
    if (p.endsWith('.json')) return 'application/json; charset=utf-8';
    if (p.endsWith('.xml') || p.endsWith('.dtd')) return 'application/xml; charset=utf-8';
    if (p.endsWith('.svg')) return 'image/svg+xml';
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.gif')) return 'image/gif';
    if (p.endsWith('.ico')) return 'image/x-icon';
    if (p.endsWith('.woff2')) return 'font/woff2';
    if (p.endsWith('.woff')) return 'font/woff';
    if (p.endsWith('.ttf')) return 'font/ttf';
    return 'application/octet-stream';
}

/** Overrides applied to the fixture's Y.Doc before export. */
export interface FixtureRepairs {
    /**
     * Override `isTest` on every `trueorfalse` component after the generator ran.
     *
     * The generator now authors `isTest: true` (the only value that can score — see
     * `GradableSpec.isTest`), so this is no longer needed to record a scoring run. It
     * stays for the control recording: `false` leaves `startGame()` unreachable, so
     * `gameStarted`/`gameOver` never turn true and `sendScoreNew()` takes its `else`
     * branch — "Por favor, empieza el juego antes de guardar tu puntuación" — and
     * writes NOTHING.
     */
    isTest?: boolean;
    /**
     * Close the `<div>`s the stored `trueorfalse` container markup leaves open.
     *
     * Only needed when several iDevices share ONE block; with one block per iDevice
     * the `</article>` end tag closes the stray `<div>` implicitly.
     */
    balanceHtml?: boolean;
}

/** Close the `<div>`s an iDevice's stored `htmlView` leaves open. */
export function balanceDivs(html: string): string {
    const opens = (html.match(/<div\b/gi) || []).length;
    const closes = (html.match(/<\/div>/gi) || []).length;
    return opens > closes ? html + '</div>'.repeat(opens - closes) : html;
}

/** Apply {@link FixtureRepairs} to every component of a populated Y.Doc. */
function applyFixtureRepairs(ydoc: Y.Doc, repairs: FixtureRepairs): void {
    const navigation = ydoc.getArray('navigation') as Y.Array<Y.Map<unknown>>;
    for (let p = 0; p < navigation.length; p++) {
        const blocks = navigation.get(p).get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;
        for (let b = 0; b < blocks.length; b++) {
            const components = blocks.get(b).get('components') as Y.Array<Y.Map<unknown>> | undefined;
            if (!components) continue;
            for (let c = 0; c < components.length; c++) {
                const comp = components.get(c);
                if (repairs.balanceHtml) {
                    comp.set('content', balanceDivs(String(comp.get('content') ?? '')));
                }
                if (repairs.isTest !== undefined) {
                    const json = JSON.parse(String(comp.get('jsonProperties') ?? '{}')) as Record<string, unknown>;
                    // Only trueorfalse carries (and reads) isTest; leave the others alone.
                    if (json.typeGame === 'TrueOrFalse') {
                        json.isTest = repairs.isTest;
                        comp.set('jsonProperties', JSON.stringify(json));
                    }
                }
            }
        }
    }
}

/**
 * Build a REAL HTML5 export from a grading fixture spec, in this process.
 *
 * Same code path as `test/integration/grading-fixtures.spec.ts`: the fixture
 * generator feeds a Y.Doc-backed ExportDocument straight into `Html5Exporter`.
 */
export async function buildHtml5Package(
    spec: ProjectSpec,
    tmpDir: string,
    repairs: FixtureRepairs = {},
): Promise<BuiltPackage> {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const extracted = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extracted, { recursive: true });

    const { document, ydoc } = createGradingDocumentWithYDoc(spec, extracted);
    applyFixtureRepairs(ydoc, repairs);
    const result = await new Html5Exporter(
        document,
        new FileSystemResourceProvider(path.join(repoRoot, 'public')),
        new FileSystemAssetProvider(extracted),
        new FflateZipProvider(),
    ).export();

    if (!result.success || !result.data) {
        throw new Error(`Html5Exporter failed: ${result.error ?? 'unknown error'}`);
    }

    const zipBytes = result.data as unknown as Uint8Array;
    const zipSha256 = sha256Hex(zipBytes);
    const files = unzipSync(zipBytes) as unknown as Record<string, Uint8Array>;
    const decode = (name: string) => new TextDecoder().decode(files[name]);

    // Apply the plugin's iDevice patch ONCE, to the stored bytes, exactly like
    // idevice_patch.php does at extraction time.
    const patchedFiles: string[] = [];
    for (const key of Object.keys(files)) {
        const name = key.split('/').pop() ?? key;
        if (!IDEVICE_PATCHES[name]) continue;
        const { source, applied } = applyIdevicePatch(key, decode(key));
        if (applied > 0) {
            files[key] = new TextEncoder().encode(source);
            patchedFiles.push(key);
        }
    }

    const htmlNames = Object.keys(files)
        .filter(name => /\.html?$/i.test(name))
        .filter(name => name === 'index.html' || name.startsWith('html/'))
        .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

    const pages: ServedPage[] = htmlNames.map((name, index) => ({
        index,
        url: name,
        ideviceNodes: ideviceNodeIds(decode(name)),
    }));

    const cfgMatch = /window\.exeXapi=(\{.*?\});/.exec(decode('index.html'));
    const xapiConfig = cfgMatch ? (JSON.parse(cfgMatch[1]) as Record<string, unknown>) : {};

    return { files, zipSha256, pages, xapiConfig, patchedFiles };
}

/**
 * The plugin's HTML mutation, reproduced exactly (`scorm_injector.php::inject`).
 *
 * @param html     the served page bytes
 * @param atRoot   true for `index.html` (`libs/...`), false for `html/*` (`../libs/...`)
 * @param injector which revision of the injector to reproduce
 */
export function injectScormLoader(html: string, atRoot: boolean, injector: InjectorVariant = DEFAULT_INJECTOR): string {
    if (html === '' || html.indexOf(INJECT_MARKER) !== -1) return html;
    const payload = injectorPayload(injector, atRoot);
    const source = injector === '105' ? html.replace(PACKAGE_RUNTIME_TAGS, '') : html;
    // preg_replace('~</head>~i', $payload . '</head>', $html, 1)
    return source.replace(/<\/head>/i, `${payload}</head>`);
}

/** How {@link installMoodleServing} serves one package. */
export interface ServingOptions {
    /** Which `scorm_injector.php` to reproduce. Defaults to {@link DEFAULT_INJECTOR}. */
    injector?: InjectorVariant;
    /**
     * Directory holding the plugin's runtime pair. Defaults to the
     * {@link PLUGIN_SCORM_ASSETS_ENV} variable; one of the two is required.
     */
    assetsDir?: string;
}

/** The parent page: recording SCORM 1.2 window.API + the package iframe. */
export function parentPageHtml(firstPage: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>mod_exelearning serving model</title>
</head>
<body>
<script>
window.__trace = { scorm: [], xapi: [], page: 0 };
(function () {
    // A real cmi map: LMSGetValue must return what LMSSetValue stored, and it must
    // survive iframe navigation, exactly like the LMS-side buffer in the plugin's
    // scorm_tracker.js.
    var cmi = {};
    function currentHref() {
        try {
            var f = document.getElementById('exelearningobject');
            return f && f.contentWindow ? f.contentWindow.location.href : '';
        } catch (e) { return ''; }
    }
    function rec(method, args, ret) {
        window.__trace.scorm.push({
            seq: window.__trace.scorm.length,
            page: window.__trace.page,
            href: currentHref(),
            method: method,
            args: args,
            ret: ret
        });
    }
    window.API = {
        LMSInitialize: function (p) { rec('LMSInitialize', [String(p)], 'true'); return 'true'; },
        LMSFinish: function (p) { rec('LMSFinish', [String(p)], 'true'); return 'true'; },
        LMSGetValue: function (k) {
            var key = String(k);
            var v = Object.prototype.hasOwnProperty.call(cmi, key) ? cmi[key] : '';
            rec('LMSGetValue', [key], v);
            return v;
        },
        LMSSetValue: function (k, v) {
            var key = String(k), val = String(v);
            cmi[key] = val;
            rec('LMSSetValue', [key, val], 'true');
            return 'true';
        },
        LMSCommit: function (p) { rec('LMSCommit', [String(p)], 'true'); return 'true'; },
        // Not recorded: constant answers, called after every wrapper operation.
        LMSGetLastError: function () { return '0'; },
        LMSGetErrorString: function () { return ''; },
        LMSGetDiagnostic: function () { return ''; }
    };
    window.__cmi = cmi;
    window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (d && d.type === 'exe-xapi-statement') {
            window.__trace.xapi.push({
                seq: window.__trace.xapi.length,
                page: window.__trace.page,
                href: currentHref(),
                statement: d.statement
            });
        }
    });
})();
</script>
<iframe id="exelearningobject" src="${firstPage}" style="width:1200px;height:2400px;border:0"></iframe>
</body>
</html>`;
}

/** What was served alongside the package — the provenance a v2 trace records. */
export interface ServedRuntime {
    /** Which `scorm_injector.php` rewrote the pages. */
    injector: InjectorVariant;
    /** The plugin commit that snippet was copied from. */
    injectorSource: (typeof INJECTOR_SOURCES)[InjectorVariant];
    /** Hex SHA-256 of the served `libs/SCORM_API_wrapper.js`. */
    wrapperSha256: string;
    /** Hex SHA-256 of the served `libs/SCOFunctions.js`. */
    runtimeSha256: string;
    /** Its `eXeLearning-SCORM12-Runtime` stamp; null for the legacy pair. */
    runtimeVersion: string | null;
}

/**
 * Install the plugin serving model on `page` for one built package.
 *
 * @returns what was served with it, for the trace's provenance fields
 */
export async function installMoodleServing(
    page: Page,
    pkg: BuiltPackage,
    origin: string,
    options: ServingOptions = {},
): Promise<ServedRuntime> {
    const injector = options.injector ?? DEFAULT_INJECTOR;
    const assetsDir = resolvePluginScormAssets(options.assetsDir ?? pluginScormAssetsFromEnv());
    const wrapper = fs.readFileSync(path.join(assetsDir, 'SCORM_API_wrapper.js'));
    const scoFunctions = fs.readFileSync(path.join(assetsDir, 'SCOFunctions.js'));
    const served: ServedRuntime = {
        injector,
        injectorSource: INJECTOR_SOURCES[injector],
        wrapperSha256: sha256Hex(wrapper),
        runtimeSha256: sha256Hex(scoFunctions),
        runtimeVersion: runtimeVersionStamp(scoFunctions.toString('utf8')),
    };

    await page.route(`${origin}/**`, async route => {
        const url = new URL(route.request().url());
        let key = decodeURIComponent(url.pathname.replace(/^\//, ''));
        if (key === '') key = 'index.html';

        if (key === '__parent.html') {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: parentPageHtml(`${origin}/${pkg.pages[0].url}`),
            });
            return;
        }

        // The plugin's own wrapper copies — an HTML5 export ships neither file.
        if (key === 'libs/SCORM_API_wrapper.js') {
            await route.fulfill({ status: 200, contentType: exportContentType(key), body: wrapper });
            return;
        }
        if (key === 'libs/SCOFunctions.js') {
            await route.fulfill({ status: 200, contentType: exportContentType(key), body: scoFunctions });
            return;
        }

        const bytes = pkg.files[key];
        if (!bytes) {
            await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
            return;
        }

        if (/\.html?$/i.test(key)) {
            const atRoot = !key.includes('/');
            const html = injectScormLoader(new TextDecoder().decode(bytes), atRoot, injector);
            await route.fulfill({ status: 200, contentType: exportContentType(key), body: html });
            return;
        }

        await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
    });

    return served;
}

/** Open the parent page (which loads page 0 into the iframe). */
export async function openPackage(page: Page, origin: string): Promise<void> {
    await page.goto(`${origin}/__parent.html`);
}

/**
 * Navigate the iframe to another package page, the way the player's own links do.
 *
 * The parent window (and therefore `window.API` and its `cmi` map) is untouched.
 */
export async function navigateIframe(page: Page, origin: string, pkg: BuiltPackage, pageIndex: number): Promise<void> {
    const target = `${origin}/${pkg.pages[pageIndex].url}`;
    await page.evaluate(
        ({ src, index }) => {
            window.__trace.page = index;
            const frame = document.getElementById('exelearningobject') as HTMLIFrameElement;
            frame.src = src;
        },
        { src: target, index: pageIndex },
    );
    await page.waitForFunction(
        expected => {
            const frame = document.getElementById('exelearningobject') as HTMLIFrameElement;
            return !!frame.contentWindow && frame.contentWindow.location.href === expected;
        },
        target,
        { timeout: 20000 },
    );
}

/**
 * Wait until the injected bootstrap has opened the SCORM session in the iframe.
 *
 * Which state counts depends on the injector, and the distinction is the whole point:
 *
 *  - `main`: `pipwerks.SCORM.connection.isActive` — before `init()` has connected,
 *    `pipwerks.SCORM.set()` is a documented no-op and nothing would reach `window.API`.
 *  - `105`: the runtime's OWN client state, `exeScorm12.client.isActive()`. The pipwerks
 *    connection shares the same object and turns active either way, so gating on it
 *    would also pass in the failure mode #105 exists to avoid — connection open, client
 *    idle, every write refused with 301. A page served with the `105` injector but a
 *    runtime that never defines `exeScorm12` (the legacy pair) times out here, on
 *    purpose: that pairing does not exist in the plugin, which always ships its own pair.
 */
export async function waitForScormActive(page: Page, injector: InjectorVariant = DEFAULT_INJECTOR): Promise<void> {
    await page.waitForFunction(
        variant => {
            const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
            const w = f.contentWindow as unknown as {
                pipwerks?: { SCORM?: { connection?: { isActive?: boolean } } };
                exeScorm12?: { client?: { isActive?: () => boolean } };
            } | null;
            if (!w) return false;
            if (variant === '105') {
                const client = w.exeScorm12?.client;
                return typeof client?.isActive === 'function' && client.isActive() === true;
            }
            return w.pipwerks?.SCORM?.connection?.isActive === true;
        },
        injector,
        { timeout: 30000 },
    );
}

/** Wait until a selector exists inside the package iframe. */
export async function waitForInFrame(page: Page, selector: string, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        sel => {
            const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
            const d = f?.contentDocument;
            return !!d && !!d.querySelector(sel);
        },
        selector,
        { timeout },
    );
}

// ---------------------------------------------------------------------------
// Real-UI drivers, one per gradable type
// ---------------------------------------------------------------------------

/**
 * trueorfalse — click one answer radio.
 *
 * @param value 1 = Verdadero, 0 = Falso (the radio's `value`)
 */
export async function answerTrueOrFalse(page: Page, ideviceId: string, questionIndex: number, value: 0 | 1) {
    await page
        .frameLocator('#exelearningobject')
        .locator(
            `#tofPGameContainer-${ideviceId} .TOFP-QuestionDiv[data-number="${questionIndex}"] ` +
                `.TOFP-Answer[value="${value}"]`,
        )
        .click();
}

/** trueorfalse — its own "Comprobar" button (`gameOver()` → `sendScore(true)`). */
export async function checkTrueOrFalse(page: Page, ideviceId: string) {
    await page.frameLocator('#exelearningobject').locator(`#tofPCheckTest-${ideviceId}`).click();
}

/**
 * dragdrop — the PAGE-GLOBAL instance index of the board inside `ideviceId`.
 *
 * Element ids are keyed by `$eXeDragDrop.activities.each(function (i))`, not by the
 * iDevice id, so this resolves `i` from the DOM.
 */
export async function dragDropInstance(page: Page, ideviceId: string): Promise<number> {
    return (await page.evaluate(id => {
        const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
        const d = f.contentDocument as Document;
        const node = d.getElementById(id);
        const main = node?.querySelector('[id^="dadPMainContainer-"]');
        if (!main) throw new Error(`no dragdrop board inside #${id}`);
        return parseInt(main.id.replace('dadPMainContainer-', ''), 10);
    }, ideviceId)) as number;
}

/**
 * dragdrop — drag the source card `cardId` onto the target `targetId`, with real
 * mouse events (jQuery UI draggable/droppable). Both sides are matched on `data-id`
 * because both containers are reshuffled on every load.
 */
export async function dragCard(page: Page, instance: number, cardId: number, targetId: number): Promise<void> {
    const frame = page.frameLocator('#exelearningobject');
    const source = frame.locator(`#dadPDragSourcesContainer-${instance} .DADP-DS[data-id="${cardId}"]`).first();
    const target = frame
        .locator(`#dadPDragTargetsContainer-${instance} .DADP-DragTargetContainer[data-id="${targetId}"]`)
        .first();
    await source.scrollIntoViewIfNeeded();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error(`dragdrop ${instance}: card ${cardId} or target ${targetId} has no box`);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // jQuery UI needs several moves past its distance threshold before it starts.
    for (let step = 1; step <= 8; step++) {
        await page.mouse.move(
            from.x + from.width / 2 + ((to.x + to.width / 2 - (from.x + from.width / 2)) * step) / 8,
            from.y + from.height / 2 + ((to.y + to.height / 2 - (from.y + from.height / 2)) * step) / 8,
        );
    }
    await page.mouse.up();
}

/** dragdrop — its own "Comprobar" button (`checkState()` → `sendScore(true)`). */
export async function checkDragDrop(page: Page, instance: number) {
    await page.frameLocator('#exelearningobject').locator(`#dadPCheckButton-${instance}`).click();
}

/**
 * dragdrop — the live state of every card, keyed by card id ('0' = correctly placed).
 *
 * `moveCard()` writes the state with jQuery's `.data()`, which updates jQuery's internal
 * store and NOT the `data-state` attribute — and `checkStateDrags()` reads it back the
 * same way. Reading the attribute would always report the authored value, so this goes
 * through the frame's own jQuery, exactly like the scorer does.
 */
export async function dragDropStates(page: Page, instance: number): Promise<Record<string, string>> {
    return (await page.evaluate(i => {
        const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
        const w = f.contentWindow as unknown as {
            jQuery: (s: unknown) => {
                each: (cb: (i: number, el: Element) => void) => void;
                data: (k: string) => unknown;
            };
        };
        const out: Record<string, string> = {};
        w.jQuery(`#dadPGameContainer-${i} .DADP-DS`).each((_: number, el: Element) => {
            const $el = w.jQuery(el);
            out[String($el.data('id'))] = String($el.data('state'));
        });
        return out;
    }, instance)) as Record<string, string>;
}

/** scrambled-list — the PAGE-GLOBAL `listOrder` of the list inside `ideviceId`. */
export async function scrambledListOrderIndex(page: Page, ideviceId: string): Promise<number> {
    return (await page.evaluate(id => {
        const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
        const d = f.contentDocument as Document;
        const node = d.getElementById(id);
        const ul = node?.querySelector('ul[id^="exe-sortableList-"]');
        if (!ul) throw new Error(`no sortable list inside #${id}`);
        return parseInt(ul.id.replace('exe-sortableList-', ''), 10);
    }, ideviceId)) as number;
}

/** scrambled-list — the current `data-orig-index` of every `li`, in display order. */
export async function scrambledListOrigIndices(page: Page, listOrder: number): Promise<number[]> {
    return (await page.evaluate(order => {
        const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
        const d = f.contentDocument as Document;
        const lis = d.querySelectorAll(`#exe-sortableList-${order} > li`);
        return Array.from(lis).map(li => parseInt(String(li.getAttribute('data-orig-index')), 10));
    }, listOrder)) as number[];
}

/**
 * scrambled-list — reorder the list into `wanted` (an array of `data-orig-index`
 * values in the order they should end up) using ONLY the runtime's own up-arrows.
 *
 * Selection sort: for each target position, find where that item currently is and
 * click its `.up` arrow until it arrives. The runtime re-renders the arrows after
 * every move, so everything is re-queried each iteration.
 */
export async function sortScrambledList(page: Page, listOrder: number, wanted: number[]): Promise<void> {
    const frame = page.frameLocator('#exelearningobject');
    for (let position = 0; position < wanted.length; position++) {
        for (let guard = 0; guard < wanted.length + 2; guard++) {
            const current = await scrambledListOrigIndices(page, listOrder);
            const at = current.indexOf(wanted[position]);
            if (at === -1) throw new Error(`orig-index ${wanted[position]} not in list ${listOrder}`);
            if (at === position) break;
            const link = frame.locator(`#exe-sortableList-${listOrder} > li`).nth(at).locator('a.up').first();
            await link.click({ force: true });
        }
    }
}

/** scrambled-list — its own check button (`check()` → `showResultFeedback()` → `sendScore()`). */
export async function checkScrambledList(page: Page, listOrder: number) {
    await page
        .frameLocator('#exelearningobject')
        .locator(`#exe-sortableListButton-${listOrder} input[type="button"]`)
        .click();
}

/**
 * form — click one true/false radio.
 *
 * @param value 1 = Verdadero, 0 = Falso
 */
export async function answerForm(page: Page, ideviceId: string, questionIndex: number, value: 0 | 1) {
    await page
        .frameLocator('#exelearningobject')
        .locator(
            `#frmMainContainer-${ideviceId} li.FormView_question[data-question-index="${questionIndex}"] ` +
                `.true-false-radio-buttons-container input[value="${value}"]`,
        )
        .first()
        .click();
}

/**
 * form — wait until the runtime has BOUND its buttons.
 *
 * `renderBehaviour()` renders the questions synchronously but defers
 * `setBehaviourButtonCheckQuestions()` into a `setInterval(..., 200)`. A recorder that
 * clicks "Comprobar" as soon as the questions exist therefore clicks an unbound button
 * and nothing happens at all — no score, no xAPI statement, silently. Poll jQuery's
 * event store for the real handler instead of sleeping.
 */
export async function waitForFormBound(page: Page, ideviceId: string, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        id => {
            const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
            const w = f.contentWindow as unknown as { jQuery?: { _data?: (el: Element, key: string) => unknown } };
            const d = f.contentDocument as Document | null;
            const btn = d?.getElementById(`form-button-check-${id}`);
            if (!btn || !w?.jQuery?._data) return false;
            const events = w.jQuery._data(btn, 'events') as { click?: unknown[] } | undefined;
            return !!events?.click?.length;
        },
        ideviceId,
        { timeout },
    );
}

/** form — its own "Comprobar" button (`gameOver()` → `checkAllQuestions()` → `sendScore()`). */
export async function checkForm(page: Page, ideviceId: string) {
    await page.frameLocator('#exelearningobject').locator(`#form-button-check-${ideviceId}`).click();
}

/** The recorded trace so far, straight off the parent window. */
export interface RecordedTrace {
    scorm: { seq: number; page: number; href: string; method: string; args: string[]; ret?: string }[];
    xapi: { seq: number; page: number; href: string; statement: Record<string, unknown> }[];
    page: number;
}

export async function readTrace(page: Page): Promise<RecordedTrace> {
    return (await page.evaluate(() => window.__trace)) as RecordedTrace;
}

/** The parent's live cmi map (what an LMS would have persisted). */
export async function readCmi(page: Page): Promise<Record<string, string>> {
    return (await page.evaluate(() => window.__cmi)) as Record<string, string>;
}

/** Wait until neither the SCORM nor the xAPI trace has grown for one quiet interval. */
export async function settle(page: Page, quietMs = 200, maxRounds = 30): Promise<void> {
    let last = -1;
    for (let i = 0; i < maxRounds; i++) {
        const now = (await page.evaluate(() => window.__trace.xapi.length + window.__trace.scorm.length)) as number;
        if (now === last) return;
        last = now;
        await page.waitForTimeout(quietMs);
    }
}

declare global {
    interface Window {
        __trace: RecordedTrace;
        __cmi: Record<string, string>;
    }
}
