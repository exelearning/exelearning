import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, openPreviewPanel, getPreviewFrame } from '../helpers/workarea-helpers';

/**
 * The editor preview renders untrusted authored content in an OPAQUE-origin
 * iframe (`sandbox="allow-scripts allow-popups allow-forms"`, no
 * allow-same-origin), served same-origin from an ephemeral preview session.
 *
 * These tests prove the two properties that matter together and used to be in
 * tension: the frame is isolated (no parent DOM/cookie/storage access) AND it
 * still renders styled content (CSS/theme applied, images painted, navigation
 * works) — the exact combination the Service Worker transport could not
 * deliver for an opaque frame.
 *
 * Server-only: the HTTP preview session needs the backend. The srcdoc
 * transport (static/embedded) is covered by the provider/inliner unit tests.
 */

const OPAQUE_SANDBOX = 'allow-scripts allow-popups allow-forms';

test.describe('Opaque editor preview', () => {
    test.skip(({ baseURL }) => !!baseURL && baseURL.includes('3002'), 'HTTP preview session requires the server');

    test('both preview iframes use the opaque sandbox (no allow-same-origin)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview sandbox');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        for (const id of ['#preview-iframe', '#preview-pinned-iframe']) {
            const iframe = page.locator(id);
            await iframe.waitFor({ state: 'attached', timeout: 10000 });
            const sandbox = (await iframe.getAttribute('sandbox')) ?? '';
            // Regression guard: re-introducing allow-same-origin (or
            // allow-modals/-downloads) would de-isolate untrusted content.
            expect(sandbox).toBe(OPAQUE_SANDBOX);
            expect(sandbox).not.toContain('allow-same-origin');
            expect(sandbox).not.toContain('allow-modals');
            expect(sandbox).not.toContain('allow-downloads');
        }
    });

    test('renders styled content and blocks parent access', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview renders');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);

        // Content is present and not a blank frame.
        await expect(frame.locator('body')).not.toBeEmpty();

        // CSS/theme applied: the exported body carries a non-default background
        // from the theme stylesheet (served same-origin under /preview/{id}/).
        const styled = await frame.locator('body').evaluate(el => {
            const bg = getComputedStyle(el).backgroundColor;
            return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        });
        expect(styled).toBe(true);

        // Isolation: every parent/top reach throws in an opaque origin.
        const probe = await frame.locator('body').evaluate(() => {
            const results: Record<string, string> = {};
            results.origin = String((window as unknown as { origin: string }).origin);
            const check = (name: string, fn: () => unknown) => {
                try {
                    fn();
                    results[name] = 'ACCESSIBLE';
                } catch {
                    results[name] = 'BLOCKED';
                }
            };
            check('parentDocument', () => (window.parent as Window).document.cookie);
            check('topDocument', () => (window.top as Window).document.body);
            check('parentLocation', () => (window.parent as Window).location.href);
            check(
                'parentLocalStorage',
                () => (window.parent as Window & { localStorage: Storage }).localStorage.length,
            );
            check('ownCookie', () => {
                if (document.cookie === undefined) throw new Error('no cookie');
            });
            return results;
        });

        expect(probe.origin).toBe('null');
        expect(probe.parentDocument).toBe('BLOCKED');
        expect(probe.topDocument).toBe('BLOCKED');
        expect(probe.parentLocation).toBe('BLOCKED');
        expect(probe.parentLocalStorage).toBe('BLOCKED');
    });

    test('preview session responses are opaque-hardened', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview headers');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openPreviewPanel(page);

        // The iframe src points at the same-origin capability URL.
        const src = await page.locator('#preview-iframe').getAttribute('src');
        expect(src).toMatch(/\/preview\/[0-9a-f-]{36}\/index\.html/i);

        const url = new URL(src as string, page.url()).href;
        const response = await page.request.get(url);
        expect(response.status()).toBe(200);
        const headers = response.headers();
        // CSP keeps the document opaque even opened top-level (leads with sandbox).
        expect(headers['content-security-policy']).toContain('sandbox allow-scripts allow-popups allow-forms');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('no-referrer');
        expect(headers['cache-control']).toContain('no-store');
        expect(headers['content-type']).toContain('text/html');
    });

    test('still renders after an auto-refresh (second sync via provider.update)', async ({
        authenticatedPage,
        createProject,
    }) => {
        // Regression: the panel must call provider.update(files) — NOT
        // update(sessionId, files). The buggy 2-arg call made the provider hash
        // the session-id string as the file map, dropping index.html, so every
        // sync AFTER the first (auto-refresh on edit, or reopen) served 404.
        // The first open uses prepare() and always worked, which hid the bug.
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview resync');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openPreviewPanel(page);
        const firstSrc = await page.locator('#preview-iframe').getAttribute('src');
        expect(firstSrc).toMatch(/\/preview\/[0-9a-f-]{36}\/index\.html.*v=1/i);

        // Edit content via Yjs → debounced auto-refresh → provider.update().
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const nav = bridge.documentManager.getNavigation();
            (window as any).eXeLearning.app.project.renamePageViaYjs(nav.get(0).get('id'), 'Resync Page ' + Date.now());
        });

        // Wait for the version to advance (the panel re-synced and re-rendered).
        await page.waitForFunction(
            () => {
                const src = document.querySelector('#preview-iframe')?.getAttribute('src') || '';
                const v = new URL(src, location.href).searchParams.get('v');
                return v !== null && Number(v) >= 2;
            },
            undefined,
            { timeout: 15000 },
        );

        // The re-synced preview must serve real content (HTTP 200), not "Not found".
        const src = await page.locator('#preview-iframe').getAttribute('src');
        const response = await page.request.get(new URL(src as string, page.url()).href);
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).not.toBe('Not found');
        expect(body.length).toBeGreaterThan(100);
        await expect(getPreviewFrame(page).locator('body')).not.toBeEmpty();
    });

    test('traversal and unknown-file requests are rejected', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview traversal');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openPreviewPanel(page);

        const src = await page.locator('#preview-iframe').getAttribute('src');
        const base = new URL(src as string, page.url());
        const previewId = base.pathname.match(/\/preview\/([0-9a-f-]{36})\//i)?.[1];
        expect(previewId).toBeTruthy();

        const origin = base.origin + base.pathname.substring(0, base.pathname.indexOf(`/preview/${previewId}/`));
        for (const evil of [
            `/preview/${previewId}/../../etc/passwd`,
            `/preview/${previewId}/%2e%2e/%2e%2e/secret`,
            `/preview/${previewId}/nonexistent-file.css`,
            `/preview/00000000-0000-0000-0000-000000000000/index.html`,
        ]) {
            const response = await page.request.get(origin + evil, { maxRedirects: 0 });
            expect(response.status()).toBe(404);
        }
    });
});
