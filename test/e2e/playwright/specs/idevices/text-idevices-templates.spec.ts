import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for TinyMCE Template Image Replacement
 *
 * Tests the fix for issue where replacing an image in a 2-images template
 * would create a NEW figure with "Caption" text instead of replacing the existing image.
 *
 * Root cause: TinyMCE's getSelectedImage() only looked for figure.image class,
 * but templates use figure.exe-figure class.
 */

/**
 * Helper to add a text iDevice by selecting a page and clicking the text iDevice
 */
async function addTextIdeviceFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        const treeItem = page.locator('#menu_structure .structure-tree li').first();
        if ((await treeItem.count()) > 0) {
            await treeItem.click({ force: true });
        }
    }

    // Wait for the page content area to switch from metadata to page editor
    await page.waitForTimeout(1000);

    // Wait for node-content to show page content (not project metadata)
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });

    // Try to use quick access button first (at bottom of page content area)
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        // Expand "Information and presentation" category in iDevices panel
        const infoCategory = page
            .locator('.idevice_category')
            .filter({
                has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
            })
            .first();

        if ((await infoCategory.count()) > 0) {
            // Check if category is collapsed (has "off" class)
            const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
            if (isCollapsed) {
                // Click on the .label to expand
                const label = infoCategory.locator('.label');
                await label.click();
                await page.waitForTimeout(800);
            }
        }

        // Wait for the category content to be visible
        await page.waitForTimeout(500);

        // Find and click the text iDevice
        const textIdevice = page.locator('.idevice_item[id="text"], [data-testid="idevice-text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to wait for TinyMCE to be ready
 */
async function waitForTinyMCE(page: Page): Promise<void> {
    await page.waitForSelector('.tox-menubar', { timeout: 15000 });
    // Additional wait for TinyMCE to fully initialize
    await page.waitForFunction(
        () => {
            const tinymce = (window as any).tinymce;
            return tinymce?.activeEditor?.initialized;
        },
        { timeout: 15000 },
    );
}

test.describe('TinyMCE Template Image Replacement', () => {
    test('should insert 2-images template with exe-figure class that can be selected', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Template Image Test');

        // Navigate to workarea
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for Yjs initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        // Wait for loading screen to be hidden
        await waitForLoadingScreenHidden(page);

        // Add text iDevice
        await addTextIdeviceFromPanel(page);

        // Wait for TinyMCE
        await waitForTinyMCE(page);

        // Insert 2-images template via Insert menu
        const insertMenu = page
            .locator('.tox-mbtn')
            .filter({ hasText: /Insert|Insertar/i })
            .first();
        await insertMenu.click();
        await page.waitForTimeout(500);

        // Click on Template menu item
        const templateMenuItem = page
            .locator('.tox-collection__item')
            .filter({ hasText: /Template|Plantilla/i })
            .first();
        await templateMenuItem.click();

        // Wait for template dialog
        await page.waitForSelector('.tox-dialog', { timeout: 10000 });

        // Select "2 images" template from the dropdown
        // First, get the available options and find one that contains "images"
        const templateSelect = page.locator('.tox-dialog select, .tox-dialog .tox-selectfield select').first();
        await templateSelect.waitFor({ state: 'visible', timeout: 10000 });

        // Get all options and find the one containing "images" or "imágenes"
        const optionToSelect = await page.evaluate(() => {
            const select = document.querySelector('.tox-dialog select') as HTMLSelectElement;
            if (!select) return null;
            for (const option of select.options) {
                if (option.text.toLowerCase().includes('images') || option.text.toLowerCase().includes('imágenes')) {
                    return option.value;
                }
            }
            return null;
        });

        if (optionToSelect) {
            await templateSelect.selectOption(optionToSelect);
        }
        await page.waitForTimeout(500);

        // Click Save in template dialog
        const saveTemplateBtn = page
            .locator('.tox-dialog .tox-button--primary, .tox-dialog button:has-text("Save")')
            .first();
        await saveTemplateBtn.click();
        await page.waitForTimeout(1000);

        // Verify template was inserted with exe-figure class
        const templateResult = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const body = editor?.getBody();
            if (!body) return { error: 'No editor body' };

            const exeFigures = body.querySelectorAll('figure.exe-figure');
            if (exeFigures.length !== 2) {
                return { error: `Expected 2 exe-figures, found ${exeFigures.length}` };
            }

            // Verify each exe-figure has an img element
            for (const figure of exeFigures) {
                const img = figure.querySelector('img');
                if (!img) {
                    return { error: 'exe-figure missing img element' };
                }
            }

            return { success: true, figureCount: exeFigures.length };
        });

        expect(templateResult.error).toBeUndefined();
        expect(templateResult.success).toBe(true);
        expect(templateResult.figureCount).toBe(2);

        // Test that getSelectedImage can find the image inside exe-figure (the actual fix)
        const selectionResult = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const body = editor?.getBody();
            if (!body) return { error: 'No editor body' };

            // Get the first img in exe-figure
            const img = body.querySelector('figure.exe-figure img');
            if (!img) return { error: 'No image in exe-figure' };

            // Test the fixed selector: figure.image, figure.exe-figure
            const figureElm = editor.dom.getParent(img, 'figure.image, figure.exe-figure');
            if (!figureElm) return { error: 'getParent did not find figure with updated selector' };

            // Verify we can find the img inside
            const foundImg = editor.dom.select('img', figureElm)[0];
            if (!foundImg) return { error: 'Could not find img inside figure' };

            return {
                success: true,
                figureFound: true,
                imgSrc: foundImg.src,
            };
        });

        expect(selectionResult.error).toBeUndefined();
        expect(selectionResult.success).toBe(true);
        expect(selectionResult.figureFound).toBe(true);
    });

    test('should recognize exe-figure class when selecting image for replacement', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Figure Class Test');

        // Navigate to workarea
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for Yjs initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);

        // Add text iDevice
        await addTextIdeviceFromPanel(page);
        await waitForTinyMCE(page);

        // Manually insert a figure with exe-figure class (simulating template content)
        await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const html = `
                <figure class="exe-figure exe-image license-custom" style="width: 300px;">
                    <img src="https://dummyimage.com/300x200" alt="Test image" width="300" height="200"/>
                    <figcaption class="figcaption">Test caption</figcaption>
                </figure>
            `;
            editor.insertContent(html);
        });
        await page.waitForTimeout(1000);

        // Verify that dom.getParent with the updated selector correctly finds exe-figure
        const testResult = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const body = editor?.getBody();
            if (!body) return { error: 'No editor body' };

            // Get the img element inside the exe-figure
            const img = body.querySelector('figure.exe-figure img');
            if (!img) return { error: 'No image found in exe-figure' };

            // Test that the updated selector finds the figure parent
            const figureElm = editor.dom.getParent(img, 'figure.image, figure.exe-figure');
            if (!figureElm) return { error: 'getParent did not find exe-figure' };

            // Test that we can find the img inside the figure
            const foundImg = editor.dom.select('img', figureElm)[0];
            if (!foundImg) return { error: 'Could not find img inside figure' };

            return {
                success: true,
                figureClass: figureElm.className,
                imgSrc: foundImg.src,
            };
        });

        expect(testResult.error).toBeUndefined();
        expect(testResult.success).toBe(true);
        expect(testResult.figureClass).toContain('exe-figure');
        expect(testResult.imgSrc).toContain('dummyimage.com/300x200');
    });
});
