import { test, expect } from '../fixtures/auth.fixture';
import {
    gotoWorkarea,
    waitForAppReady,
    openPreviewPanel,
    getPreviewFrame,
    openElpFile,
} from '../helpers/workarea-helpers';

const themes = ['base', 'cedec', 'educablue', 'etwinning', 'flux', 'intef', 'kids', 'neo', 'nova', 'universal', 'zen'];

for (const theme of themes) {
    test(`print action fits the ${theme} theme in editor preview`, async ({
        authenticatedPage: page,
        createProject,
    }, testInfo) => {
        test.setTimeout(120_000);
        const missingPrintResources: string[] = [];
        page.on('response', response => {
            if (response.status() >= 400 && response.url().includes('/libs/exe_print/')) {
                missingPrintResources.push(response.url());
            }
        });
        await page.setViewportSize({ width: 1920, height: 1080 });
        const uuid = await createProject(page, 'Print activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        const fixture = process.env.PRINT_THEME_FIXTURE;
        if (fixture) await openElpFile(page, fixture);
        await page.evaluate(
            async ({ selectedTheme, imported }) => {
                const app = (window as any).eXeLearning.app;
                const bridge = app.project._yjsBridge;
                const metadata = bridge.documentManager.getMetadata();
                metadata.set('addPrintButton', true);
                metadata.set('addPagination', true);
                metadata.set('language', 'es');
                for (const title of imported ? [] : ['Reading', 'Activities', 'Answers']) {
                    const node = bridge.structureBinding.createPage(title);
                    const block = bridge.structureBinding.createBlock(node.id, 'Text');
                    bridge.structureBinding.createComponent(node.id, block, 'text', {
                        htmlContent: '<p>A resource with several pages for checking navigation and printing.</p>',
                    });
                }
                await app.themes.selectTheme(selectedTheme, true, true);
            },
            { selectedTheme: theme, imported: !!fixture },
        );
        await openPreviewPanel(page);
        const preview = getPreviewFrame(page);
        await expect(preview.locator('#exe-print-btn svg')).toBeVisible({ timeout: 30000 });
        await expect(preview.locator('#exe-print-btn')).toHaveAttribute('title', 'Imprimir');
        if (!fixture) {
            await preview
                .locator('#siteNav a')
                .filter({ hasText: /^Reading$/ })
                .click();
            await expect(preview.locator('.page-title')).toHaveText('Reading');
        }
        await preview.locator('body').evaluate(async () => {
            await document.fonts.ready;
        });

        for (const width of [1920, 1100, 560, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await preview
                .locator('body')
                .evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.locator('#preview-iframe').screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
            const layout = await preview.locator('body').evaluate(() => {
                const rect = (element: Element) => {
                    const box = element.getBoundingClientRect();
                    return {
                        left: box.left,
                        right: box.right,
                        top: box.top,
                        bottom: box.bottom,
                        width: box.width,
                        height: box.height,
                    };
                };
                const print = document.querySelector('#exe-print-btn')!;
                const readControls = () =>
                    [
                        ...document.querySelectorAll(
                            '.nav-button, #darkModeToggler, #siteNavToggler, #searchBarToggler, .page-counter',
                        ),
                    ]
                        .filter(
                            element =>
                                element.getClientRects().length > 0 &&
                                getComputedStyle(element).visibility !== 'hidden',
                        )
                        .map(element => ({ name: element.id || element.className, ...rect(element) }));
                const controls = readControls();
                // Removing only the print action exposes the theme's original layout.
                // Restore the same nodes so their click handlers remain intact.
                const action = print.closest('.exe-print-action')!;
                const parent = action.parentNode!;
                const sibling = action.nextSibling;
                const hadClass = document.body.classList.contains('has-print-button');
                action.remove();
                document.body.classList.remove('has-print-button');
                const original = readControls();
                parent.insertBefore(action, sibling);
                document.body.classList.toggle('has-print-button', hadClass);
                return { print: rect(print), controls, original, width: innerWidth };
            });
            await testInfo.attach(`${theme}-${width}-layout`, {
                body: JSON.stringify(layout),
                contentType: 'application/json',
            });
            expect.soft(layout.print.right, `${theme}: inside viewport`).toBeLessThanOrEqual(layout.width);
            expect.soft(layout.print.left, `${theme}: right side`).toBeGreaterThan(layout.width / 2);
            for (const control of layout.controls) {
                const overlaps =
                    layout.print.left < control.right &&
                    layout.print.right > control.left &&
                    layout.print.top < control.bottom &&
                    layout.print.bottom > control.top;
                expect.soft(overlaps, `${theme} at ${width}: print overlaps ${control.name}`).toBe(false);
            }
            const next = layout.controls.find(control => control.name.includes('nav-button-right'))!;
            const previous = layout.controls.find(control => control.name.includes('nav-button-left'))!;
            expect.soft(previous.right, `${theme}: previous before next`).toBeLessThanOrEqual(next.left);
            const originalNext = layout.original.find(control => control.name.includes('nav-button-right'))!;
            const offset = next.left - originalNext.left;
            for (const control of layout.controls) {
                const original = layout.original.find(item => item.name === control.name)!;
                for (const dimension of ['width', 'height', 'top'] as const) {
                    expect
                        .soft(control[dimension], `${theme}: preserve ${control.name} ${dimension}`)
                        .toBeCloseTo(original[dimension], 0);
                }
                const staysOnLeft =
                    control.name === 'siteNavToggler' ||
                    control.name === 'searchBarToggler' ||
                    (theme === 'base' && control === previous) ||
                    (theme === 'educablue' && !control.name.includes('nav-button'));
                expect
                    .soft(
                        control.left - original.left,
                        `${theme}: preserve original control spacing for ${control.name}`,
                    )
                    .toBeCloseTo(staysOnLeft ? 0 : offset, 0);
            }
            expect.soft(layout.print.left - next.right, `${theme}: print after next`).toBeGreaterThanOrEqual(4);
            expect
                .soft(
                    Math.abs((layout.print.top + layout.print.bottom - next.top - next.bottom) / 2),
                    `${theme}: aligned with navigation`,
                )
                .toBeLessThanOrEqual(3);
        }
        await page.setViewportSize({ width: 1920, height: 1000 });
        const darkMode = preview.locator('#darkModeToggler');
        if (await darkMode.isVisible()) {
            await darkMode.click();
            await expect(preview.locator('html')).toHaveClass(/exe-dark-mode/);
            await page.locator('#preview-iframe').screenshot({ path: testInfo.outputPath(`${theme}-dark.png`) });
            await darkMode.click();
        }
        await preview.locator('#exe-print-btn').click();
        await expect(preview.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'true');
        await expect(preview.locator('#printPreviewOverlay')).toHaveAttribute('data-busy', 'false', { timeout: 60000 });
        await expect(preview.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60000 });
        expect(missingPrintResources).toEqual([]);
    });
}
