import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    changeTheme,
    addTextIdeviceWithContent,
    waitForPreviewContent,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * License font with a global content font (issue #1939).
 *
 * Selecting a tall handwriting content font (Playwrite ES) used to apply it to
 * the whole page, including the Creative Commons license footer (#packageLicense),
 * clipping the legal text. The fix lives in the shared GlobalFontGenerator, so the
 * license stays on a neutral, legible font in every theme — never the global one.
 */
test.describe('License font with global font', () => {
    for (const themeId of ['flux', 'nova']) {
        test(`keeps the CC license legible in ${themeId} when Playwrite ES is selected`, async ({
            authenticatedPage,
            createProject,
        }, testInfo) => {
            skipInStaticMode(test, testInfo, 'Requires server to create projects and render preview');

            const page = authenticatedPage;

            const projectUuid = await createProject(page, `License Font ${themeId}`);
            expect(projectUuid).toBeDefined();

            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await changeTheme(page, themeId);

            // Add content so the preview renders a real page.
            await addTextIdeviceWithContent(page, '<p>Some content</p>');

            // Select Playwrite ES as the global/content font and a CC license.
            await page.evaluate(() => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.updateMetadata({
                    globalFont: 'playwrite-es',
                    license: 'creative commons: attribution - share alike 4.0',
                });
            });
            await page.waitForTimeout(500);

            // Render the preview (the license footer only exists in preview/export).
            const loaded = await waitForPreviewContent(page);
            expect(loaded).toBe(true);

            const iframe = getPreviewFrame(page);
            const license = iframe.locator('#packageLicense');
            await license.waitFor({ state: 'attached', timeout: 15000 });

            // The global font (Playwrite ES) is applied to the page body...
            const bodyFont = await iframe.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
            expect(bodyFont.toLowerCase()).toContain('playwrite');

            // ...but the license box and its link stay off the global font.
            const licenseFont = await license.evaluate(el => getComputedStyle(el).fontFamily);
            expect(licenseFont.toLowerCase()).not.toContain('playwrite');

            const licenseLinkFont = await iframe
                .locator('#packageLicense .license')
                .first()
                .evaluate(el => getComputedStyle(el).fontFamily);
            expect(licenseLinkFont.toLowerCase()).not.toContain('playwrite');
        });
    }
});
