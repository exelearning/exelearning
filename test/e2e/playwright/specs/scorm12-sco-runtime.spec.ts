/**
 * Executable SCORM 1.2 SCO end-to-end test.
 *
 * Inspecting the exported ZIP proves the right files ship; it does not prove
 * the runtime inside them talks to an LMS correctly. This spec therefore
 * *runs* a real exported SCO:
 *
 *   1. create a project and export it as SCORM 1.2 through the browser
 *      pipeline,
 *   2. extract the ZIP,
 *   3. serve the extracted bytes over HTTP from a clean origin,
 *   4. load a parent page on that origin exposing a strict `window.API`,
 *   5. load the SCO in an iframe below it,
 *   6. drive real browser lifecycle transitions,
 *   7. assert the recorded LMS traffic and the stored data model.
 *
 * Serving: the bytes are served by `page.route()` + `route.fulfill()` on a
 * dedicated origin. That is the established pattern in this suite (see
 * specs/idevices/three-d-viewer.spec.ts) and it gives the SCO a real
 * `http://` origin, a real cross-document iframe boundary and a real parent
 * window to find the API in — while keeping the test hermetic. Spawning a
 * separate static server would add a port to manage and no additional
 * coverage.
 *
 * Documented limitations of this harness (the semantics they would cover are
 * asserted at unit level instead, in
 * public/app/common/scorm/scorm12/exe-scorm12-lifecycle.test.js):
 *
 * - **Real back/forward cache is unreachable.** Playwright's Chromium reports
 *   `BackForwardCacheDisabledForDelegate` — an embedder-level opt-out no
 *   launch flag overrides — and in Firefox `page.goBack()` after a bfcache
 *   entry hangs and leaves the Page object desynchronised. The spec therefore
 *   dispatches `PageTransitionEvent`s with the real `persisted` flag, which is
 *   exactly what the runtime branches on.
 * - **`document.visibilityState` is always `'visible'`** for a Playwright
 *   page in every engine, so the visibility test overrides the getter inside
 *   the page while it dispatches the event.
 * - **WebKit is not covered**: this repository configures only the
 *   `chromium`, `firefox` and `static` Playwright projects (the `webkit`
 *   project is commented out in playwright.config.ts).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { unzipSync } from '../../../../src/shared/export';
import { buildResumeRaceScorm12Package } from '../../../helpers/scorm12-resume-package';
import { expect, test } from '../fixtures/auth.fixture';
import { addTextIdeviceWithContent, gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/** Origin the exported package and the LMS harness page are served from. */
const ORIGIN = 'http://scorm12-sco-harness.test';

/** Best-effort content type for serving the unzipped export. */
function exportContentType(name: string): string {
    if (name.endsWith('.html')) return 'text/html; charset=utf-8';
    if (name.endsWith('.js') || name.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (name.endsWith('.css')) return 'text/css; charset=utf-8';
    if (name.endsWith('.json')) return 'application/json; charset=utf-8';
    if (name.endsWith('.xml') || name.endsWith('.xsd')) return 'application/xml; charset=utf-8';
    if (name.endsWith('.svg')) return 'image/svg+xml';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.woff2')) return 'font/woff2';
    if (name.endsWith('.woff')) return 'font/woff';
    if (name.endsWith('.ttf')) return 'font/ttf';
    return 'application/octet-stream';
}

/**
 * The LMS harness page: a strict-enough SCORM 1.2 API adapter plus the SCO in
 * an iframe. The adapter records every call, refuses the calls SCORM 1.2
 * forbids, and answers with the official error codes — a runtime that makes an
 * illegal call fails the test rather than being quietly tolerated.
 *
 * `harnessPage(seed)` overlays LMS-side data (a stored lesson_status, a
 * previous attempt's suspend_data) onto the defaults, so a resumed attempt can
 * be simulated with real stored state.
 */
const HARNESS_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>SCORM 1.2 LMS harness</title></head>
<body>
<script>
(function () {
    'use strict';
    var WRITE_ONLY = ['cmi.core.exit', 'cmi.core.session_time'];
    var READ_ONLY = ['cmi._version', 'cmi.core.student_id', 'cmi.core.student_name', 'cmi.core.credit',
        'cmi.core.entry', 'cmi.core.total_time', 'cmi.core.lesson_mode', 'cmi.launch_data'];
    var STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed'];
    var EXIT = ['time-out', 'suspend', 'logout', ''];
    var data = {
        'cmi._version': '3.4',
        'cmi.core.student_id': 'e2e-learner',
        'cmi.core.student_name': 'Doe, Jane',
        'cmi.core.lesson_location': '',
        'cmi.core.credit': 'credit',
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.entry': 'ab-initio',
        'cmi.core.score.raw': '',
        'cmi.core.score.min': '',
        'cmi.core.score.max': '',
        'cmi.core.total_time': '0000:00:00.00',
        'cmi.core.lesson_mode': 'normal',
        'cmi.suspend_data': '',
        'cmi.launch_data': ''
    };
    Object.assign(data, __SEED__);
    var calls = [];
    var errorCode = '0';
    var initialized = false;
    var finished = false;

    function isWriteOnly(el) {
        return WRITE_ONLY.indexOf(el) !== -1 || (el.indexOf('cmi.interactions.') === 0 && el.indexOf('_count') === -1);
    }
    function record(method, args) { calls.push({ method: method, args: Array.prototype.slice.call(args) }); }

    window.__scorm = {
        calls: calls,
        data: data,
        signatures: function () {
            return calls.map(function (c) {
                if (c.method === 'LMSSetValue') return 'LMSSetValue(' + c.args[0] + '=' + c.args[1] + ')';
                if (c.method === 'LMSGetValue') return 'LMSGetValue(' + c.args[0] + ')';
                return c.method;
            });
        },
        /** Calls the runtime made that SCORM 1.2 forbids. */
        violations: []
    };

    function violate(message) { window.__scorm.violations.push(message); }

    window.API = {
        LMSInitialize: function (arg) {
            record('LMSInitialize', arguments);
            if (arg !== '') { violate('LMSInitialize argument was not ""'); errorCode = '201'; return 'false'; }
            if (initialized || finished) { violate('duplicate LMSInitialize'); errorCode = '101'; return 'false'; }
            initialized = true; errorCode = '0'; return 'true';
        },
        LMSFinish: function (arg) {
            record('LMSFinish', arguments);
            if (arg !== '') { violate('LMSFinish argument was not ""'); errorCode = '201'; return 'false'; }
            if (!initialized) { violate('LMSFinish without an active session'); errorCode = '301'; return 'false'; }
            initialized = false; finished = true; errorCode = '0'; return 'true';
        },
        LMSCommit: function (arg) {
            record('LMSCommit', arguments);
            if (arg !== '') { violate('LMSCommit argument was not ""'); errorCode = '201'; return 'false'; }
            if (!initialized) { violate('LMSCommit without an active session'); errorCode = '301'; return 'false'; }
            errorCode = '0'; return 'true';
        },
        LMSGetValue: function (el) {
            record('LMSGetValue', arguments);
            if (!initialized) { violate('LMSGetValue after the session ended: ' + el); errorCode = '301'; return ''; }
            if (isWriteOnly(el)) { violate('LMSGetValue on the write-only ' + el); errorCode = '404'; return ''; }
            errorCode = '0';
            return Object.prototype.hasOwnProperty.call(data, el) ? data[el] : '';
        },
        LMSSetValue: function (el, value) {
            record('LMSSetValue', arguments);
            if (!initialized) { violate('LMSSetValue after the session ended: ' + el); errorCode = '301'; return 'false'; }
            if (READ_ONLY.indexOf(el) !== -1) { violate('LMSSetValue on the read-only ' + el); errorCode = '403'; return 'false'; }
            if (el === 'cmi.core.lesson_status' && STATUS.indexOf(value) === -1) {
                violate('lesson_status out of vocabulary: ' + value); errorCode = '405'; return 'false';
            }
            if (el === 'cmi.core.exit' && EXIT.indexOf(value) === -1) {
                violate('exit out of vocabulary: ' + value); errorCode = '405'; return 'false';
            }
            if (el === 'cmi.core.session_time' && !/^[0-9]{2,4}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,2})?$/.test(value)) {
                violate('session_time is not a CMITimespan: ' + value); errorCode = '405'; return 'false';
            }
            if (el.indexOf('cmi.core.score.') === 0 && value !== '' && !(Number(value) >= 0 && Number(value) <= 100)) {
                violate('score out of range: ' + el + '=' + value); errorCode = '405'; return 'false';
            }
            if (el === 'cmi.suspend_data' && String(value).length > 4096) {
                violate('suspend_data exceeds 4096 characters'); errorCode = '405'; return 'false';
            }
            data[el] = String(value); errorCode = '0'; return 'true';
        },
        LMSGetLastError: function () { return errorCode; },
        LMSGetErrorString: function () { return 'error'; },
        LMSGetDiagnostic: function () { return ''; }
    };
})();
</script>
<iframe id="sco" title="SCO" src="/package/index.html" style="width:900px;height:600px;border:0"></iframe>
</body></html>`;

/**
 * Render the harness with LMS-side seed data (previous-attempt state).
 *
 * @param seed - cmi element values overlaid onto the defaults.
 */
function harnessPage(seed: Record<string, string> = {}): string {
    return HARNESS_PAGE.replace('__SEED__', JSON.stringify(seed));
}

/** Export the current project as SCORM 1.2 through the File menu. */
async function exportScorm12(page: import('@playwright/test').Page) {
    await page.locator('#dropdownFile').click();
    const onlineSubmenu = page.locator('#dropdownExportAs');
    const usesOnlineMenu = await onlineSubmenu.isVisible().catch(() => false);
    await (usesOnlineMenu ? onlineSubmenu : page.locator('#dropdownExportAsOffline')).click();
    const exportButton = page.locator(
        usesOnlineMenu ? '#navbar-button-export-scorm12' : '#navbar-button-exportas-scorm12',
    );
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportButton.click();
    return downloadPromise;
}

test.describe('SCORM 1.2 exported SCO runtime', () => {
    test('runs against a strict parent SCORM 1.2 API across the page lifecycle', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180000);
        const page = authenticatedPage;
        const uuid = await createProject(page, 'SCORM 1.2 SCO runtime');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdeviceWithContent(page, '<p>Executable SCO runtime check.</p>');

        const download = await exportScorm12(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm12-sco-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
        fs.rmSync(tmpDir, { recursive: true, force: true });

        expect(zip['index.html']).toBeTruthy();
        expect(zip['libs/SCOFunctions.js']).toBeTruthy();

        // Serve the harness page and the exported bytes from one clean origin,
        // so the SCO sits in a real same-origin iframe below a real parent.
        await page.route(`${ORIGIN}/**`, async route => {
            const url = new URL(route.request().url());
            const pathname = decodeURIComponent(url.pathname);
            if (pathname === '/lms.html') {
                await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harnessPage() });
                return;
            }
            const key = pathname.replace(/^\/package\//, '');
            const bytes = zip[key];
            if (bytes) {
                await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
            } else {
                await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
            }
        });

        try {
            await page.goto(`${ORIGIN}/lms.html`);

            // ---- Initialize -------------------------------------------------
            await page.waitForFunction(
                () => (window as any).__scorm.calls.some((call: any) => call.method === 'LMSInitialize'),
                null,
                { timeout: 30000 },
            );

            // Entry policy: a not-attempted SCO becomes incomplete, and the
            // status is never downgraded to "not attempted".
            await expect
                .poll(() => page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status']), {
                    timeout: 15000,
                })
                .toBe('incomplete');

            const afterInit = await page.evaluate(() => (window as any).__scorm.signatures());
            expect(afterInit[0]).toBe('LMSInitialize');
            expect(afterInit.filter((s: string) => s === 'LMSInitialize')).toHaveLength(1);

            // ---- Content writes a score ------------------------------------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.setScore(60, 100, 0);
            });
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.score.raw'])).toBe('60');

            // ---- visibilitychange → hidden: session time + commit, no finish -
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                const scoDocument = sco.document;
                // A Playwright page is always "visible"; the runtime reads
                // document.visibilityState, so the getter has to be overridden
                // for the dispatched event to mean anything.
                Object.defineProperty(scoDocument, 'visibilityState', { configurable: true, get: () => 'hidden' });
                scoDocument.dispatchEvent(new sco.Event('visibilitychange'));
                delete scoDocument.visibilityState;
            });

            const afterHidden = await page.evaluate(() => (window as any).__scorm.signatures());
            const commitIndex = afterHidden.lastIndexOf('LMSCommit');
            expect(commitIndex).toBeGreaterThan(-1);
            expect(afterHidden[commitIndex - 1]).toMatch(/^LMSSetValue\(cmi\.core\.session_time=/);
            expect(afterHidden).not.toContain('LMSFinish');

            // ---- The session is still usable after being hidden ------------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.scorm.set('cmi.core.lesson_location', 'page-2');
            });
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_location'])).toBe('page-2');

            // ---- pagehide(persisted=true): commit, never finish -------------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.dispatchEvent(new sco.PageTransitionEvent('pagehide', { persisted: true }));
            });
            expect(await page.evaluate(() => (window as any).__scorm.signatures())).not.toContain('LMSFinish');

            // ---- pageshow(persisted=true): the session stays usable ---------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.dispatchEvent(new sco.PageTransitionEvent('pageshow', { persisted: true }));
                sco.scorm.set('cmi.core.lesson_location', 'page-3');
            });
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_location'])).toBe('page-3');
            expect(await page.evaluate(() => (window as any).__scorm.signatures())).not.toContain('LMSFinish');

            // ---- Real exit: commit + finish, exactly once -------------------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.dispatchEvent(new sco.PageTransitionEvent('pagehide', { persisted: false }));
            });

            const final = await page.evaluate(() => (window as any).__scorm.signatures());
            expect(final.filter((s: string) => s === 'LMSFinish')).toHaveLength(1);
            const finishIndex = final.indexOf('LMSFinish');
            expect(final[finishIndex - 1]).toBe('LMSCommit');
            // No LMS call after the finish.
            expect(final.slice(finishIndex + 1)).toEqual([]);

            // A page with no scored activity is completed by being viewed, and
            // the attempt ends normally rather than suspended.
            const stored = await page.evaluate(() => (window as any).__scorm.data);
            expect(stored['cmi.core.lesson_status']).toBe('completed');
            expect(stored['cmi.core.exit']).toBe('');
            expect(stored['cmi.core.session_time']).toMatch(/^[0-9]{4}:[0-9]{2}:[0-9]{2}\.[0-9]{2}$/);

            // ---- A further call is refused locally, never forwarded ---------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.scorm.set('cmi.core.lesson_location', 'page-4');
                sco.scorm.save();
                sco.doQuit();
            });
            expect(await page.evaluate(() => (window as any).__scorm.signatures())).toEqual(final);

            // ---- The runtime never made a call SCORM 1.2 forbids ------------
            expect(await page.evaluate(() => (window as any).__scorm.violations)).toEqual([]);
        } finally {
            await page.unroute(`${ORIGIN}/**`);
        }
    });

    test('tracks multi-activity completion through the registry, across suspension and resume', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180000);
        const page = authenticatedPage;
        const uuid = await createProject(page, 'SCORM 1.2 registry runtime');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdeviceWithContent(page, '<p>Registry completion check.</p>');

        const download = await exportScorm12(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm12-registry-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
        fs.rmSync(tmpDir, { recursive: true, force: true });

        // Session 1 serves the fresh harness; session 2 replays the stored
        // LMS state (suspend_data + lesson_status) captured at the first exit.
        let resumeSeed: Record<string, string> = {};
        await page.route(`${ORIGIN}/**`, async route => {
            const url = new URL(route.request().url());
            const pathname = decodeURIComponent(url.pathname);
            if (pathname === '/lms.html') {
                await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harnessPage() });
                return;
            }
            if (pathname === '/lms-resume.html') {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html; charset=utf-8',
                    body: harnessPage(resumeSeed),
                });
                return;
            }
            const key = pathname.replace(/^\/package\//, '');
            const bytes = zip[key];
            if (bytes) {
                await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
            } else {
                await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
            }
        });

        try {
            // ---- Session 1: two required activities, one completed ----------
            await page.goto(`${ORIGIN}/lms.html`);
            await page.waitForFunction(
                () => (window as any).__scorm.calls.some((call: any) => call.method === 'LMSInitialize'),
                null,
                { timeout: 30000 },
            );

            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.scorm.activities.register('act-1', { evaluable: true, completionRequired: true, total: 4 });
                sco.scorm.activities.register('act-2', { evaluable: true, completionRequired: true, total: 4 });
                sco.scorm.activities.update('act-1', { completed: true, answered: 4, score: 80 });
            });

            // Hidden must persist the registry (not only the session time), so
            // a killed mobile page can restore its activities.
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                const scoDocument = sco.document;
                Object.defineProperty(scoDocument, 'visibilityState', { configurable: true, get: () => 'hidden' });
                scoDocument.dispatchEvent(new sco.Event('visibilitychange'));
                delete scoDocument.visibilityState;
            });
            const hiddenSuspend = await page.evaluate(() => (window as any).__scorm.data['cmi.suspend_data']);
            expect(hiddenSuspend).toMatch(/^exe12\//);
            expect(hiddenSuspend).toContain('act-1');

            // Real exit with a required activity pending → incomplete + suspend.
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.dispatchEvent(new sco.PageTransitionEvent('pagehide', { persisted: false }));
            });
            const firstExit = await page.evaluate(() => (window as any).__scorm.data);
            expect(firstExit['cmi.core.lesson_status']).toBe('incomplete');
            expect(firstExit['cmi.core.exit']).toBe('suspend');
            expect(firstExit['cmi.suspend_data']).toMatch(/^exe12\//);

            // ---- Session 2: resume, finish the second activity --------------
            resumeSeed = {
                'cmi.core.lesson_status': firstExit['cmi.core.lesson_status'],
                'cmi.suspend_data': firstExit['cmi.suspend_data'],
                'cmi.core.entry': 'resume',
            };
            await page.goto(`${ORIGIN}/lms-resume.html`);
            await page.waitForFunction(
                () => (window as any).__scorm.calls.some((call: any) => call.method === 'LMSInitialize'),
                null,
                { timeout: 30000 },
            );

            // The entry policy restored the first activity's progress.
            const restored = await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                return sco.scorm.activities.get('act-1');
            });
            expect(restored).toMatchObject({ completed: true, score: 80 });

            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.scorm.activities.register('act-2', { evaluable: true, completionRequired: true, total: 4 });
                sco.scorm.activities.update('act-2', { completed: true, answered: 4, score: 60 });
                sco.dispatchEvent(new sco.PageTransitionEvent('pagehide', { persisted: false }));
            });

            // Both required activities complete, aggregate 70 ≥ 50 → passed,
            // normal end.
            const secondExit = await page.evaluate(() => (window as any).__scorm.data);
            expect(secondExit['cmi.core.lesson_status']).toBe('passed');
            expect(secondExit['cmi.core.exit']).toBe('');

            expect(await page.evaluate(() => (window as any).__scorm.violations)).toEqual([]);
        } finally {
            await page.unroute(`${ORIGIN}/**`);
        }
    });

    test('drives real exported iDevices through the common.js bridge', async ({ authenticatedPage, createProject }) => {
        test.setTimeout(180000);
        const page = authenticatedPage;
        const uuid = await createProject(page, 'SCORM 1.2 common.js bridge');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdeviceWithContent(page, '<p>First activity host.</p>');
        await addTextIdeviceWithContent(page, '<p>Second activity host.</p>');
        // The helper's own wait only watches the first text iDevice; make
        // sure both are saved before exporting.
        await page.waitForFunction(
            () => {
                const nodes = document.querySelectorAll('#node-content article .idevice_node.text');
                return nodes.length === 2 && Array.from(nodes).every(node => node.getAttribute('mode') !== 'edition');
            },
            undefined,
            { timeout: 20000 },
        );

        const download = await exportScorm12(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm12-bridge-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
        fs.rmSync(tmpDir, { recursive: true, force: true });

        // The bridge under test ships with every export.
        expect(zip['libs/common.js']).toBeTruthy();

        await page.route(`${ORIGIN}/**`, async route => {
            const url = new URL(route.request().url());
            const pathname = decodeURIComponent(url.pathname);
            if (pathname === '/lms.html') {
                await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harnessPage() });
                return;
            }
            const key = pathname.replace(/^\/package\//, '');
            const bytes = zip[key];
            if (bytes) {
                await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
            } else {
                await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
            }
        });

        try {
            await page.goto(`${ORIGIN}/lms.html`);
            await page.waitForFunction(
                () => (window as any).__scorm.calls.some((call: any) => call.method === 'LMSInitialize'),
                null,
                { timeout: 30000 },
            );
            await expect
                .poll(() => page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status']), {
                    timeout: 15000,
                })
                .toBe('incomplete');

            // ---- Register both activities through common.js -----------------
            // Exactly what a game iDevice does on load: build its options
            // object and call the public registerActivity entry point, which
            // resolves the identity from the real exported DOM.
            const nodeIds: string[] = await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                const ids = Array.from(sco.document.querySelectorAll('.idevice_node')).map(
                    (node: any) => node.id as string,
                );
                const makeGame = (nodeId: string, isScorm: number) => ({
                    main: nodeId,
                    idevice: 'bridge-check',
                    isScorm,
                    weighted: 1,
                    numberQuestions: 2,
                    userName: '',
                    msgs: {
                        msgYouScore: 'Score',
                        msgYouLastScore: 'Last score',
                        msgActityComply: 'Done',
                        msgSaveAuto: 'Saved automatically',
                        msgPlaySeveralTimes: 'Play again',
                        msgOnlySaveAuto: 'Saved once',
                        msgOnlySaveScore: 'Submitted once',
                        msgSeveralScore: 'Submit any time',
                        msgScoreScorm: 'No SCORM',
                        msgEndGameScore: 'Finish first',
                        msgScore: 'Score',
                        msgWeight: 'Weight',
                    },
                });
                sco.__bridgeGames = [makeGame(ids[0], 1), makeGame(ids[1], 2)];
                for (const game of sco.__bridgeGames) {
                    sco.$exeDevices.iDevice.gamification.scorm.registerActivity(game);
                }
                return ids;
            });
            expect(nodeIds).toHaveLength(2);

            // Two required activities pending: the page must stay incomplete.
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status'])).toBe(
                'incomplete',
            );

            // ---- First activity finishes; the game reports automatically ----
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                const game = sco.__bridgeGames[0];
                game.gameStarted = true;
                game.gameOver = true;
                game.scorerp = 8;
                game.answered = 2;
                sco.$exeDevices.iDevice.gamification.scorm.sendScoreNew(true, game);
            });

            // Aggregate 80/2 activities = 40; the other activity is still
            // pending, so the recorded score moves but the status does not.
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.score.raw'])).toBe('40');
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status'])).toBe(
                'incomplete',
            );
            const midSuspend = await page.evaluate(() => (window as any).__scorm.data['cmi.suspend_data']);
            expect(midSuspend).toMatch(/^exe12\//);
            expect(midSuspend).toContain(nodeIds[0]);
            expect(midSuspend).toContain(nodeIds[1]);

            // ---- Second activity: the learner submits by hand ---------------
            // ADR-2209-02: a manual submission is the learner's explicit act of
            // finishing the attempt, so it completes the activity.
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                const game = sco.__bridgeGames[1];
                game.gameStarted = true;
                game.gameOver = false;
                game.scorerp = 4;
                game.answered = 1;
                sco.$exeDevices.iDevice.gamification.scorm.sendScoreNew(false, game);
            });

            // Both complete: aggregate (80 + 40) / 2 = 60 ≥ 50 → passed, and
            // the score the LMS stores is the same aggregate the policy read.
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.score.raw'])).toBe('60');
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status'])).toBe('passed');

            // ---- Exit: one finish, a normal end ------------------------------
            await page.evaluate(() => {
                const sco = (document.getElementById('sco') as HTMLIFrameElement).contentWindow as any;
                sco.dispatchEvent(new sco.PageTransitionEvent('pagehide', { persisted: false }));
            });
            const stored = await page.evaluate(() => (window as any).__scorm.data);
            expect(stored['cmi.core.lesson_status']).toBe('passed');
            expect(stored['cmi.core.exit']).toBe('');
            const signatures = await page.evaluate(() => (window as any).__scorm.signatures());
            expect(signatures.filter((s: string) => s === 'LMSFinish')).toHaveLength(1);

            expect(await page.evaluate(() => (window as any).__scorm.violations)).toEqual([]);
        } finally {
            await page.unroute(`${ORIGIN}/**`);
        }
    });

    test('does not zero a restored score when the quiz registers before loadPage', async ({ browser }) => {
        test.setTimeout(60000);
        const page = await browser.newPage();
        const zip = unzipSync(buildResumeRaceScorm12Package());

        await page.route(`${ORIGIN}/**`, async route => {
            const url = new URL(route.request().url());
            const pathname = decodeURIComponent(url.pathname);
            if (pathname === '/lms.html') {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html; charset=utf-8',
                    body: harnessPage({
                        'cmi.core.lesson_status': 'incomplete',
                        'cmi.core.score.raw': '80',
                        'cmi.core.entry': 'resume',
                        'cmi.suspend_data': 'exe12/1|quiz-1;3;0;0;80;1;0;100',
                    }),
                });
                return;
            }
            const key = pathname.replace(/^\/package\//, '');
            const bytes = zip[key];
            if (bytes) {
                await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
            } else {
                await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
            }
        });

        try {
            await page.goto(`${ORIGIN}/lms.html`);
            await page.waitForFunction(
                () => (window as any).__scorm.calls.some((call: any) => call.method === 'LMSInitialize'),
                null,
                { timeout: 30000 },
            );

            await expect
                .poll(() => page.evaluate(() => (window as any).__scorm.data['cmi.core.score.raw']), {
                    timeout: 15000,
                })
                .toBe('80');
            expect(await page.evaluate(() => (window as any).__scorm.data['cmi.core.lesson_status'])).toBe(
                'incomplete',
            );

            const rawWrites = await page.evaluate(() =>
                (window as any).__scorm
                    .signatures()
                    .filter((s: string) => s.startsWith('LMSSetValue(cmi.core.score.raw=')),
            );
            expect(rawWrites).not.toContain('LMSSetValue(cmi.core.score.raw=0)');
            expect(await page.evaluate(() => (window as any).__scorm.violations)).toEqual([]);
        } finally {
            await page.unroute(`${ORIGIN}/**`);
            await page.close();
        }
    });
});
