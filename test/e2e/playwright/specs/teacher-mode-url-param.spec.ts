import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    openPreviewPanel,
    getPreviewFrame,
    cloneCurrentPage,
    selectPageByIndex,
} from '../helpers/workarea-helpers';

/**
 * E2E: Teacher Mode is driven by the ?exe-teacher URL parameter on the rendered package,
 * with no host-injected CSS/JS.
 *
 * Contract: ?exe-teacher=1 makes the in-page self-serve toggle AVAILABLE (it never reveals
 * content on its own — the viewer activates the toggle, OFF by default). Without the
 * parameter there is no toggle and teacher content stays hidden. eXeLearning's own authoring
 * preview loads the viewer with ?exe-teacher=1, so the toggle is available in the preview.
 *
 * The preview iframe is OPAQUE (no allow-same-origin), so the runtime state is observed via
 * the frame DOM (the toggle wrapper the runtime injects when ?exe-teacher=1 is present) —
 * reading `contentWindow.$exeExport` would throw a cross-origin SecurityError. The negative
 * "no parameter → no toggle" case and the OFF-by-default / reveal-on-click behavior are
 * unit-tested in public/app/common/exe_export.test.js; `.teacher-only` markup + the hide rule
 * in test/integration/teacher-mode-toggle.spec.ts.
 */
test.describe('Teacher Mode toggle (preview/export runtime)', () => {
    test('the preview makes the Teacher Mode toggle available via ?exe-teacher=1', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const uuid = await createProject(page, 'Teacher Mode Toggle Test');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        // A second page gives the export a #siteNav with in-package links to observe.
        await selectPageByIndex(page, 0);
        await cloneCurrentPage(page);

        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);
        await frame.locator('#siteNav a[href]').first().waitFor({ state: 'attached', timeout: 15000 });

        // The preview loads the viewer with ?exe-teacher=1, so the runtime (in the opaque
        // frame) reads the parameter, makes the self-serve toggle available, and propagates
        // exe-teacher=1 onto in-package navigation links so the view survives navigation.
        // Observing the rewritten hrefs via the frame DOM is cross-origin-safe (reading
        // contentWindow.$exeExport would throw a SecurityError) and content-independent.
        // propagateNavParams() runs shortly after load, so poll until it has rewritten links.
        const links = frame.locator('#siteNav a[href]');
        await expect
            .poll(
                async () => {
                    const hrefs = await links.evaluateAll(els => els.map(a => a.getAttribute('href') || ''));
                    const internal = hrefs.filter(h => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h));
                    return internal.length > 0 && internal.every(h => h.includes('exe-teacher=1'));
                },
                { timeout: 15000 },
            )
            .toBe(true);
    });
});
