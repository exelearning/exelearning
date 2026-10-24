import { test, expect } from '../fixtures/auth.fixture';
import {
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    selectFirstPage,
    waitForAppReady,
} from '../helpers/workarea-helpers';

/**
 * The static/PWA trust boundary (ADR-2199-16), against the BUILT static distribution.
 *
 * Static builds have no backend, so enabling author active content cannot use a capability
 * URL; the panel inlines the snapshot and loads it through `srcdoc` into an iframe sandboxed
 * WITHOUT `allow-same-origin`. These specs seed adversarial content — a script that tries to
 * read editor-origin sentinels through every sink PR ateeducacion/exelearning#48 named — and
 * assert, from outside the frame, that the script RUNS (the boundary is the origin, not a
 * filter) and that none of the sentinels becomes observable to it.
 *
 * Sentinels are disposable values created by the test in the editor origin; nothing here
 * touches user data.
 */

const SENTINEL = 'capability-sentinel-' + 'x'.repeat(8);

/**
 * Author content: a probe that reports what it can reach, an inline handler, and a provider
 * embed. `<\/script>` keeps the HTML parser from closing the component's own script early.
 */
const PROBE_COMPONENT_HTML = `
<div id="custom-content">
<script>
(async () => {
    const r = {};
    const attempt = (k, fn) => { try { r[k] = String(fn()); } catch (e) { r[k] = 'THROWS:' + e.name; } };
    attempt('origin', () => window.origin);
    attempt('parentDocument', () => (parent.document ? 'ACCESSIBLE' : 'no'));
    attempt('topCookie', () => top.document.cookie);
    attempt('cookie', () => document.cookie);
    attempt('localStorage', () => localStorage.getItem('exe-sentinel') ?? 'null');
    attempt('swController', () => (navigator.serviceWorker && navigator.serviceWorker.controller ? 'CONTROLLED' : 'null'));
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
    try { const res = await fetch('/viewer/index.html'); r.fetchViewer = 'OK:' + res.status; } catch (e) { r.fetchViewer = 'THROWS:' + e.name; }
    document.body.setAttribute('data-marker', 'ran');
    const out = document.createElement('pre');
    out.id = 'probe-result';
    out.textContent = JSON.stringify(r);
    document.body.appendChild(out);
})();
</script>
<img id="custom-error-image" src="missing-preview-image" onerror="document.body.setAttribute('data-handler', 'ran')">
<iframe id="custom-youtube" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
</div>`;

async function seedProject(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(
        ({ html }) => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0).get('id');
            const blockId = bridge.structureBinding.createBlock(pageId, 'Probe');
            bridge.structureBinding.createComponent(pageId, blockId, 'text', { htmlContent: html });
            const second = bridge.structureBinding.addPage('Second page', null);
            const secondId = second.id || second.pageId;
            const secondBlock = bridge.structureBinding.createBlock(secondId, 'Second');
            bridge.structureBinding.createComponent(secondId, secondBlock, 'text', {
                htmlContent: '<p id="page-two-marker">second page content</p>',
            });
        },
        { html: PROBE_COMPONENT_HTML },
    );
}

/** Editor-origin secrets the author script must never be able to observe. */
async function plantSentinels(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(async secret => {
        document.cookie = `exe-sentinel=${secret}; path=/`;
        localStorage.setItem('exe-sentinel', secret);
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open('exe-sentinel', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('kv');
            req.onsuccess = () => {
                const tx = req.result.transaction('kv', 'readwrite');
                tx.objectStore('kv').put(secret, 'secret');
                tx.oncomplete = () => {
                    req.result.close();
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        });
    }, SENTINEL);
}

async function enableActiveContent(page: import('@playwright/test').Page): Promise<void> {
    const warning = page.locator('#preview-active-content-button');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('aria-pressed', 'false');
    await warning.click();
    const modal = page.locator('#modalConfirm');
    await expect(modal).toBeVisible();
    // The dialog promises isolation — and never the old same-origin consent text.
    await expect(modal).toContainText('isolated context');
    await expect(modal).not.toContainText('cannot isolate');
    await modal.getByRole('button', { name: 'Allow external scripts' }).click();
    await expect(warning).toHaveAttribute('aria-pressed', 'true');
}

const OPAQUE_SANDBOX_TOKEN = 'allow-scripts';

test.describe('Static preview trust boundary — opaque srcdoc on enable', () => {
    test.beforeEach(async ({ authenticatedPage: page, createProject }) => {
        const projectUuid = await createProject(page, 'Static preview isolation');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedProject(page);
        await plantSentinels(page);
    });

    test('filters author active content by default', async ({ authenticatedPage: page }) => {
        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);
        await frame.locator('#custom-content').waitFor({ state: 'attached' });

        expect(await frame.locator('body').getAttribute('data-marker')).toBeNull();
        expect(await frame.locator('body').getAttribute('data-handler')).toBeNull();
        await expect(frame.locator('#probe-result')).toHaveCount(0);
        // The filtered preview is the Service Worker one: a same-origin URL, no sandbox change.
        const iframe = page.locator('#preview-iframe');
        expect(await iframe.getAttribute('src')).toContain('/viewer/index.html');
        expect(await iframe.getAttribute('sandbox')).toContain('allow-same-origin');
        await expect(page.locator('#preview-active-content-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('enabling runs the author script in an opaque srcdoc document that cannot reach the editor', async ({
        authenticatedPage: page,
    }) => {
        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        await enableActiveContent(page);

        // Transport: srcdoc, sandboxed without allow-same-origin, no URL at all.
        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => Boolean(await iframe.getAttribute('srcdoc'))).toBe(true);
        const sandbox = (await iframe.getAttribute('sandbox')) ?? '';
        expect(sandbox).toContain(OPAQUE_SANDBOX_TOKEN);
        expect(sandbox).not.toContain('allow-same-origin');
        expect(await iframe.evaluate(el => el.hasAttribute('src'))).toBe(false);

        // The author's code RUNS — script and inline handler alike. This is the point: the
        // boundary is the origin, not a filter.
        const frame = getPreviewFrame(page);
        await expect.poll(() => frame.locator('body').getAttribute('data-marker')).toBe('ran');
        await expect.poll(() => frame.locator('body').getAttribute('data-handler')).toBe('ran');

        // …and reaches none of the editor's sentinels or surfaces.
        await frame.locator('#probe-result').waitFor({ state: 'attached' });
        const probe = JSON.parse((await frame.locator('#probe-result').textContent()) ?? '{}');
        expect(probe.origin).toBe('null');
        expect(probe.parentDocument).toMatch(/^THROWS:/);
        expect(probe.topCookie).toMatch(/^THROWS:/);
        expect(probe.cookie).not.toContain(SENTINEL);
        expect(probe.localStorage).toMatch(/^THROWS:/);
        expect(probe.indexedDB).not.toContain(SENTINEL);
        expect(probe.indexedDB).toMatch(/^(THROWS|ERROR)/);
        expect(probe.swController).not.toBe('CONTROLLED');
        // The Service-Worker-served viewer is not reachable from the opaque document.
        expect(probe.fetchViewer).not.toBe('OK:200');

        // The provider embed became a geometry placeholder for the trusted-side relay (the
        // opaque origin fails YouTube's embedder check); the raw iframe is gone.
        await expect(frame.locator('[data-exe-embed-id]')).toHaveCount(1);
        await expect(frame.locator('#custom-youtube')).toHaveCount(0);

        // Multi-page navigation is parent-bridged and needs NO network: the inlined document
        // carries everything, which is what makes the transport hold offline.
        await page.context().setOffline(true);
        try {
            await frame.locator('#siteNav a', { hasText: 'Second page' }).click();
            await expect(frame.locator('#page-two-marker')).toBeVisible();
            expect((await iframe.getAttribute('sandbox')) ?? '').not.toContain('allow-same-origin');
            expect(await iframe.evaluate(el => el.hasAttribute('srcdoc'))).toBe(true);
        } finally {
            await page.context().setOffline(false);
        }

        // Pinned mode uses the same transport on the pinned frame.
        await page.locator('#preview-pin-button').click();
        const pinned = page.locator('#preview-pinned-iframe');
        await expect.poll(async () => Boolean(await pinned.getAttribute('srcdoc'))).toBe(true);
        expect((await pinned.getAttribute('sandbox')) ?? '').not.toContain('allow-same-origin');
        await page.locator('#preview-unpin-button').click();
        await expect(page.locator('#previewsidenav')).toHaveClass(/active/);

        // "Open in a new tab" never carries the unfiltered document: a srcdoc has no URL, so
        // the tab shows the filtered Service Worker preview.
        const popupPromise = page.waitForEvent('popup');
        await page.locator('#preview-extract-button').click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        expect(popup.url()).toContain('/viewer/index.html');
        await popup.locator('#custom-content').waitFor({ state: 'attached' });
        expect(await popup.locator('body').getAttribute('data-marker')).toBeNull();
        await popup.close();

        // Disabling returns to the Service Worker preview with the author code stripped.
        const warning = page.locator('#preview-active-content-button');
        await warning.click();
        await page.locator('#modalConfirm').getByRole('button', { name: 'Block external scripts' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');
        await expect.poll(async () => (await iframe.getAttribute('sandbox')) ?? '').toContain('allow-same-origin');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/viewer/index.html');
        expect(await iframe.evaluate(el => el.hasAttribute('srcdoc'))).toBe(false);
        await expect.poll(() => frame.locator('body').getAttribute('data-marker')).toBeNull();

        // The stored project was never touched by any of this.
        const stored = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const component = bridge.documentManager
                .getNavigation()
                .get(0)
                .get('blocks')
                .get(0)
                .get('components')
                .get(0);
            return String(component.get('htmlContent'));
        });
        expect(stored).toBe(PROBE_COMPONENT_HTML);
    });

    test('an update not identified as local revokes the grant and unloads the opaque document (D1)', async ({
        authenticatedPage: page,
    }) => {
        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        await enableActiveContent(page);
        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => Boolean(await iframe.getAttribute('srcdoc'))).toBe(true);

        // A local (untagged) edit keeps the grant.
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('subtitle', 'local edit');
        });
        await expect(page.locator('#preview-active-content-button')).toHaveAttribute('aria-pressed', 'true');

        // An update with a foreign origin (what an import or a remote provider would carry)
        // revokes it, and the opaque document is dropped immediately — not at the next load.
        await page.evaluate(() => {
            const Y = (window as any).Y;
            const ydoc = (window as any).eXeLearning.app.project._yjsBridge.documentManager.ydoc;
            const scratch = new Y.Doc();
            scratch.getMap('metadata').set('injected', 'remote');
            Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(scratch), { remoteProviderStub: true });
        });
        await expect(page.locator('#preview-active-content-button')).toHaveAttribute('aria-pressed', 'false');
        await expect.poll(() => iframe.evaluate(el => el.hasAttribute('srcdoc'))).toBe(false);
        await expect.poll(async () => (await iframe.getAttribute('sandbox')) ?? '').toContain('allow-same-origin');
    });
});
