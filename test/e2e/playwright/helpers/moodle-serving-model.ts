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
 *     the 50 ms `setInterval` that forces `window.pipwerks.SCORM.init()` are
 *     inserted before the first `</head>`, with `libs/...` at the package root and
 *     `../libs/...` under `html/`.
 *  3. `libs/SCORM_API_wrapper.js` and `libs/SCOFunctions.js` are served from the
 *     PLUGIN's own copies (`mod-eval/assets/scorm/`) — an HTML5 export ships neither.
 *  4. Every served `form.js` / `scrambled-list.js` gets the plugin's iDevice patch
 *     (`classes/local/scorm/idevice_patch.php`): the `body.exe-scorm` half of their
 *     save guard is stripped. Without it neither type can score in a web package.
 *  5. A parent page holds the SCORM 1.2 `window.API` (a RECORDING one, with a real
 *     cmi map) and a single `<iframe id="exelearningobject">`. Navigation between
 *     package pages is an `iframe.src` assignment — the parent, its `window.API` and
 *     its `cmi` map survive it, which is what makes the cross-page
 *     `cmi.suspend_data` behaviour observable.
 *
 * The recorded traffic is written to a trace file per the frozen trace contract
 * (TRACE-CONTRACT.md v1) and replayed by the plugin-side lanes.
 */

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

/** Where the PLUGIN keeps the two wrapper files it injects (not core's copies). */
export const PLUGIN_SCORM_ASSETS =
    process.env.MOD_EXELEARNING_SCORM_ASSETS ?? '/Users/ernesto/Downloads/git/xapi-eval/mod-eval/assets/scorm';

/** The exact marker `scorm_injector.php` writes, used verbatim (and as its idempotence guard). */
const INJECT_MARKER = '<!-- mod_exelearning:scorm-loader -->';

/** The exact init script `scorm_injector.php` builds, byte for byte. */
const INIT_SCRIPT =
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

const TAGS_ROOT =
    INJECT_MARKER +
    '\n    <script src="libs/SCORM_API_wrapper.js"></script>' +
    '\n    <script src="libs/SCOFunctions.js"></script>' +
    INIT_SCRIPT;

const TAGS_SUBDIR =
    INJECT_MARKER +
    '\n    <script src="../libs/SCORM_API_wrapper.js"></script>' +
    '\n    <script src="../libs/SCOFunctions.js"></script>' +
    INIT_SCRIPT;

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
     * `isTest` for every gradable iDevice that carries jsonProperties.
     *
     * Only `trueorfalse` reads it. The fixture authors `isTest: false`, and with it
     * `startGame()` is never invoked (it is only called from the start / reboot button
     * click handlers), so `gameStarted` stays false, `gameOver` stays false, and
     * `sendScoreNew()` takes its `else` branch: it shows
     * "Por favor, empieza el juego antes de guardar tu puntuación" and writes NOTHING.
     * `true` with `time: 0` shows the questions immediately plus the "Comprobar"
     * button, whose `gameOver()` sets `gameOver = true` and does report the score.
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

    const files = unzipSync(result.data) as unknown as Record<string, Uint8Array>;
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

    return { files, pages, xapiConfig, patchedFiles };
}

/**
 * The plugin's HTML mutation, reproduced exactly (`scorm_injector.php::inject`).
 *
 * @param html   the served page bytes
 * @param atRoot true for `index.html` (`libs/...`), false for `html/*` (`../libs/...`)
 */
export function injectScormLoader(html: string, atRoot: boolean): string {
    if (html === '' || html.indexOf(INJECT_MARKER) !== -1) return html;
    const payload = atRoot ? TAGS_ROOT : TAGS_SUBDIR;
    // preg_replace('~</head>~i', $payload . '</head>', $html, 1)
    return html.replace(/<\/head>/i, `${payload}</head>`);
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

/**
 * Install the plugin serving model on `page` for one built package.
 */
export async function installMoodleServing(page: Page, pkg: BuiltPackage, origin: string): Promise<void> {
    const wrapper = fs.readFileSync(path.join(PLUGIN_SCORM_ASSETS, 'SCORM_API_wrapper.js'));
    const scoFunctions = fs.readFileSync(path.join(PLUGIN_SCORM_ASSETS, 'SCOFunctions.js'));

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
            const html = injectScormLoader(new TextDecoder().decode(bytes), atRoot);
            await route.fulfill({ status: 200, contentType: exportContentType(key), body: html });
            return;
        }

        await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
    });
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
 * Wait until the injected `pipwerks.SCORM.init()` has connected — before that,
 * `pipwerks.SCORM.set()` is a documented no-op and nothing would reach `window.API`.
 */
export async function waitForScormActive(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
            const w = f.contentWindow as unknown as { pipwerks?: { SCORM?: { connection?: { isActive?: boolean } } } };
            return !!w && !!w.pipwerks && !!w.pipwerks.SCORM && w.pipwerks.SCORM.connection?.isActive === true;
        },
        undefined,
        { timeout: 30000 },
    );
}

/** Wait until a selector exists inside the package iframe. */
export async function waitForInFrame(page: Page, selector: string, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        sel => {
            const f = document.getElementById('exelearningobject') as HTMLIFrameElement;
            const d = f && f.contentDocument;
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
        const main = node && node.querySelector('[id^="dadPMainContainer-"]');
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
        const ul = node && node.querySelector('ul[id^="exe-sortableList-"]');
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
            const btn = d && d.getElementById(`form-button-check-${id}`);
            if (!btn || !w || !w.jQuery || !w.jQuery._data) return false;
            const events = w.jQuery._data(btn, 'events') as { click?: unknown[] } | undefined;
            return !!(events && events.click && events.click.length);
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
