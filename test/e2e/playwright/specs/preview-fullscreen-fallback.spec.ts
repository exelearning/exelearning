import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { waitForAppReady } from '../helpers/workarea-helpers';

test.describe('Preview fullscreen fallback', () => {
    test.beforeEach(({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server to create projects and control SW state');
    });

    test('should show enlarge preview text and icon when SW is unavailable', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Test');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        const slideBtn = page.locator('#preview-extract-button');
        const pinnedBtn = page.locator('#preview-pinned-extract-button');
        await expect(slideBtn).toHaveAttribute('title', 'Enlarge preview');
        await expect(slideBtn).toHaveAttribute('aria-label', 'Enlarge preview');
        await expect(pinnedBtn).toHaveAttribute('title', 'Enlarge preview');
        await expect(pinnedBtn).toHaveAttribute('aria-label', 'Enlarge preview');

        const slideIcon = slideBtn.locator('.small-icon');
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);

        const pinnedIcon = pinnedBtn.locator('.small-icon');
        await expect(pinnedIcon).toHaveClass(/enlarge-icon/);
        await expect(pinnedIcon).not.toHaveClass(/external-link-icon/);
    });

    test('should keep enlarge icon but change text and aria-pressed when fullscreen activated', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Icon Test');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        const slideBtn = page.locator('#preview-extract-button');
        const slideIcon = slideBtn.locator('.small-icon');

        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);
        await expect(slideBtn).toHaveAttribute('aria-pressed', 'false');

        await slideBtn.click();

        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);
        await expect(slideBtn).toHaveAttribute('aria-pressed', 'true');

        await expect(slideBtn).toHaveAttribute('title', 'Restore preview size');
        await expect(slideBtn).toHaveAttribute('aria-label', 'Restore preview size');
    });

    test('should show enlarge icon with aria-pressed false when fullscreen exited', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Icon Exit');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        const slideBtn = page.locator('#preview-extract-button');
        const slideIcon = slideBtn.locator('.small-icon');

        await slideBtn.click();
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideBtn).toHaveAttribute('aria-pressed', 'true');

        await slideBtn.click();
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideBtn).toHaveAttribute('aria-pressed', 'false');

        await expect(slideBtn).toHaveAttribute('title', 'Enlarge preview');
        await expect(slideBtn).toHaveAttribute('aria-label', 'Enlarge preview');
    });

    test('should add preview-fullscreen class and aria-pressed when extract clicked without SW', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Toggle');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-extract-button').click();

        const hasFullscreen = await panel.evaluate(el => el.classList.contains('preview-fullscreen'));
        expect(hasFullscreen).toBe(true);

        const workareaFs = await page.locator('#workarea').getAttribute('data-preview-fullscreen');
        expect(workareaFs).toBe('true');

        await expect(page.locator('#preview-extract-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('should toggle fullscreen off on second extract click', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Double Click');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-extract-button').click();
        await expect(panel).toHaveClass(/preview-fullscreen/);

        await page.locator('#preview-extract-button').click();
        await expect(panel).not.toHaveClass(/preview-fullscreen/);

        const workareaFs = await page.locator('#workarea').getAttribute('data-preview-fullscreen');
        expect(workareaFs).toBe('false');

        await expect(page.locator('#preview-extract-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('should clear fullscreen state when panel is closed', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Close');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-extract-button').click();
        await expect(panel).toHaveClass(/preview-fullscreen/);

        // Don't use closePreviewPanel()'s waitFor({state: 'hidden'}) here:
        // .preview-sidenav is moved off-screen via `transform`, not actually
        // hidden (display/visibility/opacity), so Playwright still reports
        // it as visible - wait for the 'active' class instead.
        await page.locator('#previewsidenavclose').click({ force: true });
        await expect(panel).not.toHaveClass(/active/);

        await page.click('#head-bottom-preview');
        await expect(panel).toHaveClass(/active/, { timeout: 15000 });

        const hasFullscreen = await panel.evaluate(el => el.classList.contains('preview-fullscreen'));
        expect(hasFullscreen).toBe(false);
    });

    test('should unpin and open fullscreen slide-out when pinned and SW unavailable', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Pinned');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.locator('#preview-pin-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === true,
            undefined,
            { timeout: 5000 },
        );

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-pinned-extract-button').click();

        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === false,
            undefined,
            { timeout: 5000 },
        );

        const hasFullscreen = await panel.evaluate(el => el.classList.contains('preview-fullscreen'));
        expect(hasFullscreen).toBe(true);

        const wasPinned = await page.evaluate(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?._wasPinnedBeforeFullscreen,
        );
        expect(wasPinned).toBe(true);
    });

    test('should restore pinned state when exiting fullscreen from previously pinned', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Restore Pin');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.locator('#preview-pin-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === true,
            undefined,
            { timeout: 5000 },
        );

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-pinned-extract-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === false,
            undefined,
            { timeout: 5000 },
        );
        await expect(panel).toHaveClass(/preview-fullscreen/);

        await page.locator('#preview-extract-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === true,
            undefined,
            { timeout: 5000 },
        );

        const hasFullscreen = await panel.evaluate(el => el.classList.contains('preview-fullscreen'));
        expect(hasFullscreen).toBe(false);
    });

    test('should enter fullscreen fallback when the popup is blocked', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Popup Blocked');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => true; // recomputed at click time
            mgr.refreshWithServiceWorker = async () => {};
            (window as any).open = () => null;
        });

        await page.locator('#preview-extract-button').click();

        await expect(panel).toHaveClass(/preview-fullscreen/);
        await expect(page.locator('#preview-extract-button')).toHaveAttribute('aria-pressed', 'true');
        const workareaFs = await page.locator('#workarea').getAttribute('data-preview-fullscreen');
        expect(workareaFs).toBe('true');

        const slideIcon = page.locator('#preview-extract-button .small-icon');
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);
    });

    test('should enter fullscreen fallback when refreshWithServiceWorker throws', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Unexpected Error');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => true; // recomputed at click time
            mgr.refreshWithServiceWorker = async () => {
                throw new Error('Simulated SW refresh failure');
            };
        });

        await page.locator('#preview-extract-button').click();

        await expect(panel).toHaveClass(/preview-fullscreen/);
        await expect(page.locator('#preview-extract-button')).toHaveAttribute('aria-pressed', 'true');

        const slideIcon = page.locator('#preview-extract-button .small-icon');
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);
    });

    test('should enter fullscreen fallback from the pinned container when the popup is blocked', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Popup Blocked Pinned');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.locator('#preview-pin-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === true,
            undefined,
            { timeout: 5000 },
        );

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => true; // recomputed at click time
            mgr.refreshWithServiceWorker = async () => {};
            (window as any).open = () => null;
        });

        await page.locator('#preview-pinned-extract-button').click();

        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === false,
            undefined,
            { timeout: 5000 },
        );
        await expect(panel).toHaveClass(/preview-fullscreen/);

        const wasPinned = await page.evaluate(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?._wasPinnedBeforeFullscreen,
        );
        expect(wasPinned).toBe(true);

        const slideIcon = page.locator('#preview-extract-button .small-icon');
        await expect(slideIcon).toHaveClass(/enlarge-icon/);
        await expect(slideIcon).not.toHaveClass(/external-link-icon/);
    });

    test('should not bring the panel back fullscreen after enlarge, pin and unpin', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Pin Unpin');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            mgr.isServiceWorkerPreviewAvailable = () => false; // stub the method, not the cached field
            mgr._updateExtractButton();
        });

        await page.locator('#preview-extract-button').click();
        await expect(panel).toHaveClass(/preview-fullscreen/);

        await page.locator('#preview-pin-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === true,
            undefined,
            { timeout: 5000 },
        );
        await expect(panel).not.toHaveClass(/preview-fullscreen/);
        await expect(page.locator('#workarea')).toHaveAttribute('data-preview-fullscreen', 'false');

        await page.locator('#preview-unpin-button').click();
        await page.waitForFunction(
            () => (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel()?.isPinned === false,
            undefined,
            { timeout: 5000 },
        );

        await expect(panel).toHaveClass(/active/);
        await expect(panel).not.toHaveClass(/preview-fullscreen/);
        await expect(page.locator('#workarea')).toHaveAttribute('data-preview-fullscreen', 'false');
        await expect(page.locator('#preview-extract-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('should open a new tab if the SW becomes available after the panel opened', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen SW Becomes Available');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        // SW unavailable while the panel opens: the button offers "Enlarge preview"
        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            (window as any).__swAvailable = false;
            mgr.isServiceWorkerPreviewAvailable = () => (window as any).__swAvailable;
            mgr._updateExtractButton();
        });
        const slideBtn = page.locator('#preview-extract-button');
        await expect(slideBtn).toHaveAttribute('title', 'Enlarge preview');

        // The SW becomes available afterwards; the button state is still stale
        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            (window as any).__swAvailable = true;
            mgr.refreshWithServiceWorker = async () => {};
            (window as any).__openCalls = [];
            (window as any).open = (url: string) => {
                (window as any).__openCalls.push(url);
                return { closed: false };
            };
        });

        await slideBtn.click();

        const openCalls = await page.evaluate(() => (window as any).__openCalls);
        expect(openCalls).toHaveLength(1);
        expect(openCalls[0]).toContain('/viewer/index.html');

        await expect(panel).not.toHaveClass(/preview-fullscreen/);
        await expect(slideBtn).toHaveAttribute('aria-pressed', 'false');
        // Button state was refreshed at click time
        await expect(slideBtn).toHaveAttribute('title', 'Open in new tab');
        await expect(slideBtn.locator('.small-icon')).toHaveClass(/external-link-icon/);
    });

    test('should restore the panel size on click even if the SW became available while enlarged', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Fullscreen Restore With SW');

        await page.goto(`/workarea?project=${uuid}`);
        await waitForAppReady(page);

        await page.click('#head-bottom-preview');
        const panel = page.locator('#previewsidenav');
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await page.evaluate(() => {
            const mgr = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel();
            if (!mgr) throw new Error('PreviewPanelManager not found');
            (window as any).__swAvailable = false;
            mgr.isServiceWorkerPreviewAvailable = () => (window as any).__swAvailable;
            mgr._updateExtractButton();
        });

        const slideBtn = page.locator('#preview-extract-button');
        await slideBtn.click();
        await expect(panel).toHaveClass(/preview-fullscreen/);
        await expect(slideBtn).toHaveAttribute('title', 'Restore preview size');

        await page.evaluate(() => {
            (window as any).__swAvailable = true;
            (window as any).__openCalls = [];
            (window as any).open = (url: string) => {
                (window as any).__openCalls.push(url);
                return { closed: false };
            };
        });

        await slideBtn.click();

        await expect(panel).not.toHaveClass(/preview-fullscreen/);
        expect(await page.evaluate(() => (window as any).__openCalls)).toHaveLength(0);
    });
});
