import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * The Electron row of the preview trust boundary: enabling author active content serves the
 * snapshot from the main process on `preview://{id}`, a different origin from the editor's
 * `app://localhost`, in an iframe sandboxed without `allow-same-origin`. The author's code
 * RUNS (that is the point) and reaches neither the editor nor the IPC bridge; the same holds
 * for the snapshot opened in its own window.
 *
 * Needs `dist/static` (make build-static) and the `electron` package.
 */

const ROOT = resolve(__dirname, '../../..');

const PROBE_COMPONENT_HTML = `
<div id="custom-content">
<p id="math">Formula: \\(E = mc^2\\)</p>
<script>
(async () => {
    const r = {};
    const attempt = (k, fn) => { try { r[k] = String(fn()); } catch (e) { r[k] = 'THROWS:' + e.name; } };
    attempt('origin', () => window.origin);
    attempt('href', () => location.href);
    attempt('electronAPI', () => typeof window.electronAPI);
    attempt('topElectronAPI', () => typeof top.electronAPI);
    attempt('parentDocument', () => (parent.document ? 'ACCESSIBLE' : 'no'));
    attempt('localStorage', () => localStorage.getItem('exe-sentinel') ?? 'null');
    r.indexedDB = await new Promise(done => {
        try {
            const req = indexedDB.open('exe-sentinel');
            req.onsuccess = () => {
                try {
                    const get = req.result.transaction('kv').objectStore('kv').get('secret');
                    get.onsuccess = () => done('READ:' + get.result);
                    get.onerror = () => done('ERROR');
                } catch (e) { done('THROWS:' + e.name); }
            };
            req.onerror = () => done('ERROR:' + (req.error && req.error.name));
        } catch (e) { done('THROWS:' + e.name); }
    });
    document.body.setAttribute('data-marker', 'ran');
    const out = document.createElement('pre');
    out.id = 'probe-result';
    out.textContent = JSON.stringify(r);
    document.body.appendChild(out);
})();
</script>
<img id="custom-error-image" src="missing-preview-image" onerror="document.body.setAttribute('data-handler', 'ran')">
</div>`;

const SENTINEL = 'capability-sentinel-' + 'x'.repeat(8);

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
    app = await electron.launch({
        args: ['./app'],
        cwd: ROOT,
        env: { ...process.env, CI: '1' },
    });
    page = await app.firstWindow();
    await page.waitForFunction(() => Boolean((window as any).eXeLearning?.app?.project?._yjsBridge), undefined, {
        timeout: 60_000,
    });
    await page
        .waitForFunction(() => !document.querySelector('#load-screen-main, .load-screen:not(.hidden)'), undefined, {
            timeout: 60_000,
        })
        .catch(() => {});
});

test.afterAll(async () => {
    if (!app) return;
    // The seeded project has unsaved changes, so a normal close would stop at the editor's
    // native "unsaved changes" dialog; destroy the windows instead, then quit.
    await app
        .evaluate(({ BrowserWindow }) => {
            for (const win of BrowserWindow.getAllWindows()) win.destroy();
        })
        .catch(() => {});
    await app.close();
});

test('the enabled preview runs author code in a preview:// origin that cannot reach the editor or the bridge', async () => {
    test.setTimeout(180_000);

    // The editor itself is app://localhost and holds the bridge.
    expect(await page.evaluate(() => window.origin)).toBe('app://localhost');
    expect(await page.evaluate(() => typeof (window as any).electronAPI?.previewSnapshot?.replace)).toBe('function');

    await page.evaluate(
        async ({ html, secret }) => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0).get('id');
            const blockId = bridge.structureBinding.createBlock(pageId, 'Probe');
            bridge.structureBinding.createComponent(pageId, blockId, 'text', { htmlContent: html });
            bridge.documentManager.getMetadata().set('addMathJax', true);
            localStorage.setItem('exe-sentinel', secret);
            await new Promise<void>((resolveDb, reject) => {
                const req = indexedDB.open('exe-sentinel', 1);
                req.onupgradeneeded = () => req.result.createObjectStore('kv');
                req.onsuccess = () => {
                    const tx = req.result.transaction('kv', 'readwrite');
                    tx.objectStore('kv').put(secret, 'secret');
                    tx.oncomplete = () => {
                        req.result.close();
                        resolveDb();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                req.onerror = () => reject(req.error);
            });
        },
        { html: PROBE_COMPONENT_HTML, secret: SENTINEL },
    );

    await page.locator('#head-bottom-preview').click();
    await expect(page.locator('#previewsidenav')).toHaveClass(/active/);
    const frame = page.frameLocator('#preview-iframe');
    await frame.locator('#custom-content').waitFor({ state: 'attached', timeout: 60_000 });

    // Default: filtered, same-origin Service Worker preview, no author code.
    expect(await frame.locator('body').getAttribute('data-marker')).toBeNull();
    const warning = page.locator('#preview-active-content-button');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('aria-pressed', 'false');

    // Enable: the dialog offers isolation (Electron is no longer "blocked").
    await warning.click();
    const modal = page.locator('#modalConfirm');
    await expect(modal).toBeVisible();
    await expect(modal).not.toContainText('desktop application');
    await expect(modal).toContainText('isolated context');
    await modal.getByRole('button', { name: 'Allow external scripts' }).click();
    await expect(warning).toHaveAttribute('aria-pressed', 'true');

    const iframe = page.locator('#preview-iframe');
    await expect
        .poll(async () => (await iframe.getAttribute('src')) ?? '')
        .toMatch(/^preview:\/\/[0-9a-f]{32}\/index\.html$/);
    const capabilityUrl = (await iframe.getAttribute('src')) ?? '';
    const sandbox = (await iframe.getAttribute('sandbox')) ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');

    // The author's code runs — script and inline handler — …
    await expect.poll(() => frame.locator('body').getAttribute('data-marker'), { timeout: 30_000 }).toBe('ran');
    await expect.poll(() => frame.locator('body').getAttribute('data-handler')).toBe('ran');
    // … served well enough that MathJax, which fetches its components at runtime, typesets.
    await expect.poll(() => frame.locator('mjx-container').count(), { timeout: 30_000 }).toBeGreaterThan(0);

    // … and reaches nothing of the editor's.
    await frame.locator('#probe-result').waitFor({ state: 'attached' });
    const probe = JSON.parse((await frame.locator('#probe-result').textContent()) ?? '{}');
    // Served from preview://{id}, and opaque on top of that (the sandbox has no allow-same-origin).
    expect(probe.href).toMatch(/^preview:\/\/[0-9a-f]{32}\/index\.html$/);
    expect(probe.origin).toBe('null');
    expect(probe.electronAPI).toBe('undefined');
    expect(probe.topElectronAPI).toMatch(/^THROWS:/);
    expect(probe.parentDocument).toMatch(/^THROWS:/);
    expect(probe.localStorage).toMatch(/^THROWS:/);
    expect(probe.indexedDB).not.toContain(SENTINEL);

    // Process placement (informational): with site isolation the preview:// frame runs in
    // another renderer process than the editor.
    const placement = await app.evaluate(({ webContents }) => {
        const editor = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('app://localhost'));
        if (!editor) return null;
        const main = editor.mainFrame;
        return main.framesInSubtree
            .filter(f => f.url.startsWith('preview://') || f === main)
            .map(f => ({ url: f.url.slice(0, 40), processId: f.processId }));
    });
    test.info().annotations.push({ type: 'process-placement', description: JSON.stringify(placement) });
    console.log('PROCESS_PLACEMENT ' + JSON.stringify(placement));

    // "Open in a new tab": a window the main process creates WITHOUT the preload; the document
    // stays preview:// and sandboxed by its CSP, and still has no bridge.
    const popupPromise = app.waitForEvent('window');
    await page.locator('#preview-extract-button').click();
    const popup = await popupPromise;
    // The window exists before its navigation does: wait for the snapshot URL, not for a load.
    await popup.waitForURL(/^preview:\/\/[0-9a-f]{32}\/index\.html$/, { timeout: 30_000 });
    expect(popup.url()).toMatch(/^preview:\/\/[0-9a-f]{32}\/index\.html$/);
    await expect.poll(() => popup.locator('body').getAttribute('data-marker'), { timeout: 30_000 }).toBe('ran');
    const popupState = await popup.evaluate(() => ({
        href: location.href,
        origin: window.origin,
        electronAPI: typeof (window as any).electronAPI,
        opener: window.opener === null ? 'null' : typeof window.opener,
    }));
    expect(popupState.href).toMatch(/^preview:\/\//);
    // The response CSP (`sandbox …`) keeps the top-level document opaque too.
    expect(popupState.origin).toBe('null');
    expect(popupState.electronAPI).toBe('undefined');
    expect(popupState.opener).toBe('null');
    await popup.close();

    // Disable: back to the filtered Service Worker preview with the template sandbox.
    await warning.click();
    await page.locator('#modalConfirm').getByRole('button', { name: 'Block external scripts' }).click();
    await expect(warning).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await iframe.getAttribute('sandbox')) ?? '').toContain('allow-same-origin');
    await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/viewer/index.html');
    await expect.poll(() => frame.locator('body').getAttribute('data-marker')).toBeNull();

    // The disposed snapshot is gone from the main process: the capability URL now 404s.
    const status = await app.evaluate(async ({ net }, url) => (await net.fetch(url)).status, capabilityUrl);
    expect(status).toBe(404);
});
