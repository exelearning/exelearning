import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';
import { waitForAppReady, saveProject } from '../helpers/workarea-helpers';

/**
 * Public view isolation tests.
 *
 * The public read-only viewer serves author-provided HTML/JS. It must run in an
 * OPAQUE ORIGIN (sandboxed iframe without `allow-same-origin`) so the content can
 * never reach the authenticated session, cookies, IndexedDB, the API or the
 * parent window — not even in fullscreen, and even if the content URL is opened
 * directly. The opaque origin is a property of the document itself, so it is
 * unaffected by fullscreen; asserting `window.origin === 'null'` covers that case.
 *
 * Requires the server API (project creation + public view), so it is skipped in
 * static mode.
 */
test.describe('Public view isolation (opaque-origin sandbox)', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Server API for public view');
    });

    test('published content runs in an opaque origin and cannot reach the session', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Create and persist a project so the server can build its export.
        const uuid = await createProject(page, 'Public Isolation Project');
        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);
        await saveProject(page);

        // Enable the public read-only link and read its URL.
        const shareModal = new ShareModalPage(page);
        await page.locator('#head-top-share-button').click();
        await shareModal.waitForOpen();
        await shareModal.setPublicView('enabled');

        let publicUrl = '';
        await expect(async () => {
            publicUrl = await shareModal.getPublicViewerLink();
            expect(publicUrl).toContain('/view/');
        }).toPass();
        await shareModal.close();

        const publicViewId = publicUrl.split('/view/')[1].replace(/\/.*$/, '').replace(/\/$/, '');

        // R3: the content response itself carries the `sandbox` CSP directive, so
        // it stays opaque even if opened directly (new tab / fullscreen / raw URL).
        const contentResp = await page.request.get(`/view/${publicViewId}/_/index.html`);
        expect(contentResp.status()).toBe(200);
        const csp = contentResp.headers()['content-security-policy'] ?? '';
        expect(csp).toContain('sandbox allow-scripts');
        expect(csp).not.toContain('allow-same-origin');
        expect(contentResp.headers()['x-content-type-options']).toBe('nosniff');

        // Open the public viewer page and verify the iframe is sandboxed without
        // allow-same-origin.
        await page.goto(publicUrl);
        const iframeEl = page.locator('#viewer-iframe');
        const sandboxAttr = await iframeEl.getAttribute('sandbox');
        expect(sandboxAttr).toContain('allow-scripts');
        expect(sandboxAttr).not.toContain('allow-same-origin');

        // Probe isolation from INSIDE the content frame.
        await expect(iframeEl).toBeVisible();
        const handle = await iframeEl.elementHandle();
        const frame = await handle!.contentFrame();
        expect(frame).not.toBeNull();

        const probe = await frame!.evaluate(() => {
            const out = { origin: '', parentBlocked: false, cookieBlocked: false, idbBlocked: false };
            // Opaque origins report 'null'.
            out.origin = String(window.origin);
            try {
                // Reaching the parent (app origin) must throw SecurityError.
                void window.parent.location.href;
            } catch {
                out.parentBlocked = true;
            }
            try {
                void document.cookie;
            } catch {
                out.cookieBlocked = true;
            }
            try {
                if (!window.indexedDB) {
                    out.idbBlocked = true;
                } else {
                    window.indexedDB.open('exelearning');
                }
            } catch {
                out.idbBlocked = true;
            }
            return out;
        });

        // Core isolation guarantees.
        expect(probe.origin).toBe('null');
        expect(probe.parentBlocked).toBe(true);
        expect(probe.cookieBlocked).toBe(true);
    });
});
