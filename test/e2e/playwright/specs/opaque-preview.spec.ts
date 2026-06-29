import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    openPreviewPanel,
    getPreviewFrame,
    waitForPreviewContent,
} from '../helpers/workarea-helpers';

/**
 * E2E tests: the editor content preview must render untrusted package content in an
 * OPAQUE-origin iframe, matching the host plugins (always-opaque hardening).
 *
 * The strongest, content-independent guarantee is the sandbox attribute itself: an iframe
 * whose sandbox omits `allow-same-origin` gets an opaque origin, so its document cannot read
 * the editor's DOM/cookies/storage (every such access throws SecurityError — enforced by the
 * browser). We assert the attribute as a regression guard, then confirm the preview still
 * renders (opaque mode did not break the Service-Worker viewer).
 *
 * Note: the editor regenerates the preview from the Y.Doc and the collaborative sanitizer
 * strips inline <script>, so the in-package probe in testing-the-sandbox.elpx is exercised by
 * the plugin suites (which serve the .elpx verbatim), not here.
 */

const OPAQUE_SANDBOX = 'allow-scripts allow-popups allow-forms';

test.describe('Editor preview is opaque', () => {
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
            // Regression guard: re-introducing allow-same-origin (or allow-modals/-downloads)
            // would de-isolate untrusted package content. Keep the exact opaque token set.
            expect(sandbox).toBe(OPAQUE_SANDBOX);
            expect(sandbox).not.toContain('allow-same-origin');
            expect(sandbox).not.toContain('allow-modals');
            expect(sandbox).not.toContain('allow-downloads');
        }
    });

    test('preview still renders content under the opaque sandbox (not blank)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Opaque preview renders');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openPreviewPanel(page);
        const loaded = await waitForPreviewContent(page);
        expect(loaded).toBe(true);

        // Playwright reads frames across origins, so we can confirm the opaque preview is not
        // a blank frame even though same-origin JS could not.
        const frame = getPreviewFrame(page);
        await expect(frame.locator('body')).not.toBeEmpty();
    });
});
