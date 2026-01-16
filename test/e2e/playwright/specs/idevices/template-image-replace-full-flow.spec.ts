import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Full E2E test for replacing an image in a 2-images template using the toolbar button and File Manager.
 * This tests the complete user flow.
 */

async function addTextIdeviceFromPanel(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '.structure-tree li .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                break;
            } catch {
                // Try next selector
            }
        }
    }

    await page.waitForTimeout(1000);

    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        const infoCategory = page
            .locator('.idevice_category')
            .filter({
                has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }),
            })
            .first();

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
            if (isCollapsed) {
                await infoCategory.locator('.label').click();
                await page.waitForTimeout(800);
            }
        }

        const textIdevice = page.locator('.idevice_item[id="text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

async function waitForTinyMCE(page: Page): Promise<void> {
    await page.waitForSelector('.tox-menubar', { timeout: 15000 });
    await page.waitForFunction(
        () => {
            const tinymce = (window as any).tinymce;
            return tinymce?.activeEditor?.initialized;
        },
        { timeout: 15000 },
    );
}

test.describe('Template Image Replace - Full User Flow', () => {
    test('should replace image in 2-images template using toolbar button and file manager', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Template Replace Test');

        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        await waitForLoadingScreenHidden(page);
        await addTextIdeviceFromPanel(page);
        await waitForTinyMCE(page);

        // Step 1: Insert 2-images template
        const insertMenu = page
            .locator('.tox-mbtn')
            .filter({ hasText: /Insert|Insertar/i })
            .first();
        await insertMenu.click();
        await page.waitForTimeout(500);

        const templateMenuItem = page
            .locator('.tox-collection__item')
            .filter({ hasText: /Template|Plantilla/i })
            .first();
        await templateMenuItem.click();

        // Wait for TinyMCE template dialog
        await page.waitForSelector('.tox-dialog', { timeout: 10000 });
        await page.waitForTimeout(500);

        // Find the select in the TinyMCE dialog
        const templateSelect = page.locator('.tox-dialog select').first();
        await templateSelect.waitFor({ state: 'visible', timeout: 10000 });

        // Select "2 images" option
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

        // Click Save button in TinyMCE dialog
        const saveTemplateBtn = page
            .locator('.tox-dialog button:has-text("Save"), .tox-dialog button:has-text("Guardar")')
            .first();
        await saveTemplateBtn.waitFor({ state: 'visible', timeout: 5000 });
        await saveTemplateBtn.click();
        await page.waitForTimeout(1000);

        // Verify template was inserted
        const initialState = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const body = editor?.getBody();
            const exeFigures = body?.querySelectorAll('figure.exe-figure');
            const imgs = body?.querySelectorAll('figure.exe-figure img');
            return {
                figureCount: exeFigures?.length || 0,
                imgCount: imgs?.length || 0,
                firstImgSrc: imgs?.[0]?.src || 'none',
            };
        });

        console.log('After template insert:', initialState);
        expect(initialState.figureCount).toBe(2);
        expect(initialState.imgCount).toBe(2);

        // Step 2: Click on the first image in the template (inside TinyMCE iframe)
        // We need to click on the actual image element in the editor (use first iframe - main text area)
        const editorFrame = page.frameLocator('#textTextarea_ifr');
        const firstTemplateImg = editorFrame.locator('figure.exe-figure img').first();
        await firstTemplateImg.waitFor({ state: 'visible', timeout: 10000 });
        await firstTemplateImg.click();
        await page.waitForTimeout(500);

        // Verify image is selected
        const selectionAfterClick = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const node = editor?.selection?.getNode();
            return {
                nodeName: node?.nodeName,
                src: node?.src || 'none',
            };
        });
        console.log('Selection after clicking image:', selectionAfterClick);

        // Step 3: Click the image button in TinyMCE toolbar
        const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
        await imageBtn.click();
        await page.waitForSelector('.tox-dialog', { timeout: 10000 });
        await page.waitForTimeout(1000);

        // Check if the dialog has the image data
        const dialogValues = await page.evaluate(() => {
            const inputs = document.querySelectorAll('.tox-dialog input');
            const values: string[] = [];
            inputs.forEach(input => {
                const inp = input as HTMLInputElement;
                values.push(inp.value || '(empty)');
            });
            return values;
        });
        console.log('Dialog values after opening:', dialogValues);

        // Step 4: Click Browse button to open File Manager
        const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
        console.log('Clicking Browse button...');
        await browseBtn.click();
        await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });
        console.log('File Manager opened');

        // Step 5: Upload a new image
        const fileInput = page.locator('#modalFileManager .media-library-upload-input');
        await fileInput.setInputFiles('test/fixtures/sample-2.jpg');
        console.log('File uploaded');

        // Wait for upload and select the item
        const mediaItem = page.locator('#modalFileManager .media-library-item').first();
        await mediaItem.waitFor({ state: 'visible', timeout: 15000 });
        await mediaItem.click();
        console.log('Media item selected');
        await page.waitForTimeout(500);

        // Click insert button in Media Library
        const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
        await insertBtn.click();
        console.log('Insert button clicked');
        await page.waitForTimeout(1000);

        // Check the source value after Media Library insert
        const srcAfterMediaLibrary = await page.evaluate(() => {
            const inputs = document.querySelectorAll('.tox-dialog input');
            return (inputs[0] as HTMLInputElement)?.value || 'not found';
        });
        console.log('Source after Media Library insert:', srcAfterMediaLibrary);

        // Step 6: Save the TinyMCE image dialog
        // Look for Save button with multiple selectors
        const saveImageBtn = page
            .locator('.tox-dialog button:has-text("Save"), .tox-dialog .tox-button:has-text("Save")')
            .first();
        console.log('Looking for Save button...');
        await saveImageBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Clicking Save button');
        await saveImageBtn.click();

        // Handle any confirmation dialogs (e.g., "no alt text" warning)
        const yesBtn = page.locator('button:has-text("Yes")');
        if (await yesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Clicking Yes button on confirmation');
            await yesBtn.click();
        }
        await page.waitForTimeout(1000);

        // Step 7: Verify the final state
        const finalState = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            const body = editor?.getBody();
            const allFigures = body?.querySelectorAll('figure');
            const exeFigures = body?.querySelectorAll('figure.exe-figure');
            const allImgs = body?.querySelectorAll('img');
            const content = editor?.getContent() || '';

            // Check for orphan "Caption" text (indicates bug - new figure created)
            const hasCaptionBug = content.includes('>Caption<') && !content.includes('exe-figure');

            return {
                totalFigureCount: allFigures?.length || 0,
                exeFigureCount: exeFigures?.length || 0,
                imgCount: allImgs?.length || 0,
                allImgSrcs: Array.from(allImgs || []).map((img: any) => img.src),
                hasCaptionBug,
                contentPreview: content.substring(0, 800),
            };
        });

        console.log('Final state:', finalState);

        // Assertions
        // Should still have exactly 2 exe-figures (not more)
        expect(finalState.exeFigureCount).toBe(2);

        // Should not have extra figures created
        expect(finalState.totalFigureCount).toBeLessThanOrEqual(2);

        // Should have the new image src in one of the images (blob: URL from File Manager)
        const hasNewImage = finalState.allImgSrcs.some(
            (src: string) => src.includes('blob:') || src.includes('sample-2'),
        );
        expect(hasNewImage).toBe(true);

        // Should not have the "Caption" bug
        expect(finalState.hasCaptionBug).toBe(false);
    });
});
