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
 * Empty site footer (issue #2145).
 *
 * A project with no "Page footer" content and no displayable license still
 * renders <footer id="siteFooter">, and several themes give it a background,
 * border and padding — so it showed up as a stray empty bar. PageRenderer now
 * tags those footers with the `siteFooter-empty` class and base.css hides them.
 *
 * These tests run against the preview, which uses the same renderer and the same
 * content/css/base.css as the real exports, so they verify the class survives all
 * the way to the rendered page and that no theme rule overrides the hiding.
 */
test.describe('Empty site footer', () => {
    // universal draws the most visible empty footer (background + border);
    // flux repaints #siteFooterContent, so it covers the other theme family.
    for (const themeId of ['universal', 'flux']) {
        test(`hides the footer in ${themeId} when there is no license and no footer content`, async ({
            authenticatedPage,
            createProject,
        }, testInfo) => {
            skipInStaticMode(test, testInfo, 'Requires server to create projects and render preview');

            const page = authenticatedPage;

            const projectUuid = await createProject(page, `Empty Footer ${themeId}`);
            expect(projectUuid).toBeDefined();

            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await changeTheme(page, themeId);
            await addTextIdeviceWithContent(page, '<p>Some content</p>');

            // "Not appropriate" is a license that is never displayed in the footer,
            // and the footer property is left empty: nothing to show at all.
            await page.evaluate(() => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.updateMetadata({ license: 'not appropriate', footer: '' });
            });
            await page.waitForTimeout(500);

            const loaded = await waitForPreviewContent(page);
            expect(loaded).toBe(true);

            const iframe = getPreviewFrame(page);
            const footer = iframe.locator('#siteFooter');
            await footer.waitFor({ state: 'attached', timeout: 15000 });

            // The element is still in the DOM (themes may opt out) but hidden...
            await expect(footer).toHaveClass(/siteFooter-empty/);
            expect(await footer.evaluate(el => getComputedStyle(el).display)).toBe('none');

            // ...and it takes up no space, which is the actual bug being fixed.
            expect(await footer.boundingBox()).toBeNull();
        });
    }

    test('keeps the footer visible when the project has footer content', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server to create projects and render preview');

        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Footer With Content');
        expect(projectUuid).toBeDefined();

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await changeTheme(page, 'universal');
        await addTextIdeviceWithContent(page, '<p>Some content</p>');

        // No displayable license, but the user typed something in "Page footer".
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.updateMetadata({ license: 'not appropriate', footer: '<p>Contact: someone@example.org</p>' });
        });
        await page.waitForTimeout(500);

        const loaded = await waitForPreviewContent(page);
        expect(loaded).toBe(true);

        const iframe = getPreviewFrame(page);
        const footer = iframe.locator('#siteFooter');
        await footer.waitFor({ state: 'attached', timeout: 15000 });

        await expect(footer).not.toHaveClass(/siteFooter-empty/);
        await expect(footer).toBeVisible();
        await expect(iframe.locator('#siteUserFooter')).toContainText('someone@example.org');
    });
});
