import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Magnifier iDevice
 *
 * Tests the Magnifier iDevice functionality including:
 * - Basic operations (add to blank document)
 * - Image configuration (add custom image via file picker)
 * - Magnifier effect on hover
 * - Preview panel display
 */

/**
 * Helper to add a magnifier iDevice by selecting the page and clicking the magnifier iDevice
 */
async function addMagnifierIdeviceFromPanel(page: Page): Promise<void> {
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

    // Wait for node-content to show page content
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

    // The iDevices menu uses categories with h3 headings
    // We need to click on the category heading to expand it
    // Magnifier is in "Information and presentation" category

    // Find and click the "Information and presentation" category heading
    const categoryHeading = page.locator('#menu_idevices_content h3').filter({
        hasText: /Information|Información/i,
    });

    if ((await categoryHeading.count()) > 0) {
        await categoryHeading.first().click();
        await page.waitForTimeout(500);
    }

    // Now find the magnifier iDevice in the expanded category
    const magnifierIdevice = page.locator('.idevice_item[id="magnifier"], [data-testid="idevice-magnifier"]').first();

    // Wait for it to be visible after expanding category
    await magnifierIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await magnifierIdevice.click();

    // Wait for iDevice to appear in content area (in edition mode)
    await page.locator('#node-content article .idevice_node.magnifier').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to select an image using the file picker in magnifier editor
 */
async function selectImageForMagnifier(page: Page, fixturePath: string): Promise<void> {
    // The file picker button is generated dynamically next to #mnfFileInput
    // Wait for the button to be created
    await page.waitForTimeout(500);

    // Find the file picker button - it's created after the input by common_edition.js
    const pickFileBtn = page.locator(
        'input.exe-pick-any-file[data-filepicker="mnfFileInput"], #mnfFileInput + input[type="button"]',
    );

    // If button not found by specific selector, try generic button in the magnifier form
    if ((await pickFileBtn.count()) === 0) {
        const genericBtn = page.locator(
            '#magnifierIdeviceForm .exe-pick-any-file, #magnifierIdeviceForm input[type="button"][value*="Select"]',
        );
        await expect(genericBtn.first()).toBeVisible({ timeout: 10000 });
        await genericBtn.first().click();
    } else {
        await expect(pickFileBtn.first()).toBeVisible({ timeout: 10000 });
        await pickFileBtn.first().click();
    }

    // Wait for Media Library modal
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload image from fixture
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // Wait for the uploaded image to appear in the grid
    const imageItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(imageItem).toBeVisible({ timeout: 15000 });

    // Click to select the uploaded image
    await imageItem.click();

    // Wait for sidebar content to show (appears when asset is selected)
    const sidebarContent = page.locator('#modalFileManager .media-library-sidebar-content');
    await expect(sidebarContent).toBeVisible({ timeout: 5000 });

    // Click insert button in Media Library
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(insertBtn).toBeVisible({ timeout: 5000 });
    await insertBtn.click();

    // Wait for modal to close and input to update
    await page.waitForTimeout(1000);

    // Verify the input was updated
    const inputValue = await page.locator('#mnfFileInput').inputValue();
    if (!inputValue) {
        throw new Error('Image was not selected - #mnfFileInput is still empty');
    }
}

test.describe('Magnifier iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add magnifier iDevice to blank document', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'Magnifier Basic Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            // Wait for app initialization
            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add a magnifier iDevice using the panel
            await addMagnifierIdeviceFromPanel(page);

            // Verify iDevice was added and is in edition mode
            const magnifierIdevice = page.locator('#node-content article .idevice_node.magnifier').first();
            await expect(magnifierIdevice).toBeVisible({ timeout: 10000 });

            // Verify the magnifier form elements are visible
            await expect(page.locator('#mnfFileInput')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#mnfPreviewImage')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Image Configuration', () => {
        test('should select custom image from file picker and display correctly', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Custom Image Test');
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

            // Add magnifier iDevice
            await addMagnifierIdeviceFromPanel(page);

            // Select custom image using file picker
            await selectImageForMagnifier(page, 'test/fixtures/sample-3.jpg');

            // Verify preview image was updated
            const previewImg = page.locator('#mnfPreviewImage');
            await expect(previewImg).toBeVisible({ timeout: 5000 });

            // Verify the file input has the custom image path with asset:// URL format
            const fileInputValue = await page.locator('#mnfFileInput').inputValue();
            console.log('File input value:', fileInputValue);
            expect(fileInputValue).toBeTruthy();
            expect(fileInputValue).toContain('sample-3');
            // The file input should contain asset:// URL, not blob: URL
            expect(fileInputValue.startsWith('asset://')).toBe(true);

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.magnifier').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.magnifier');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Verify the image container is visible in view mode
            const viewModeContainer = page.locator(
                '#node-content article .idevice_node.magnifier .ImageMagnifierIdevice, #node-content article .idevice_node.magnifier .MNF-MainContainer',
            );
            await expect(viewModeContainer.first()).toBeVisible({ timeout: 10000 });

            // Verify an image exists in the magnifier
            const viewModeImg = viewModeContainer.locator('img').first();
            await expect(viewModeImg).toBeVisible({ timeout: 5000 });

            // Wait for image to load
            await page.waitForTimeout(2000);

            // Debug: log the image src
            const imgSrc = await viewModeImg.getAttribute('src');
            console.log('Image src after save:', imgSrc);

            // Verify image loaded correctly (naturalWidth > 0)
            const naturalWidth = await viewModeImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            console.log('Image naturalWidth:', naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // Save project
            await workarea.save();
        });

        test('should save with default image and display correctly', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Image Test');
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

            // Add magnifier iDevice
            await addMagnifierIdeviceFromPanel(page);

            // The magnifier loads with a default image (hood.jpg)
            // Verify preview image is visible in editor
            const previewImg = page.locator('#mnfPreviewImage');
            await expect(previewImg).toBeVisible({ timeout: 5000 });

            // Verify the default image src contains hood.jpg
            const previewSrc = await previewImg.getAttribute('src');
            expect(previewSrc).toContain('hood.jpg');

            // Save the iDevice (with default image)
            const block = page.locator('#node-content article .idevice_node.magnifier').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.magnifier');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Verify the image container is visible in view mode
            const viewModeContainer = page.locator(
                '#node-content article .idevice_node.magnifier .ImageMagnifierIdevice, #node-content article .idevice_node.magnifier .MNF-MainContainer',
            );
            await expect(viewModeContainer.first()).toBeVisible({ timeout: 10000 });

            // Verify an image exists in the magnifier
            const viewModeImg = viewModeContainer.locator('img').first();
            await expect(viewModeImg).toBeVisible({ timeout: 5000 });

            // Wait for image to load and verify it loaded correctly
            await page.waitForTimeout(1000);
            const naturalWidth = await viewModeImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // Save project
            await workarea.save();
        });
    });

    test.describe('Magnifier Effect', () => {
        test('should have magnifier data attributes after save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Magnifier Hover Test');
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

            // Add magnifier iDevice
            await addMagnifierIdeviceFromPanel(page);

            // Save the iDevice with default image
            const block = page.locator('#node-content article .idevice_node.magnifier').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.magnifier');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Find the magnifier image container
            const magnifierContainer = page.locator(
                '#node-content article .idevice_node.magnifier .ImageMagnifierIdevice, #node-content article .idevice_node.magnifier .MNF-MainContainer',
            );
            await expect(magnifierContainer.first()).toBeVisible({ timeout: 10000 });

            // Get the image inside the container
            const magnifierImg = magnifierContainer.locator('img').first();
            await expect(magnifierImg).toBeVisible({ timeout: 5000 });

            // Wait for image to load
            await page.waitForTimeout(1000);

            // Verify the magnifier is set up with proper data attributes
            // The image should have data-magnifysrc and data-zoom attributes for the magnifier effect
            const hasDataAttributes = await magnifierImg.evaluate((el: HTMLImageElement) => {
                return (
                    el.hasAttribute('data-magnifysrc') || el.hasAttribute('data-zoom') || el.id.includes('magnifier')
                );
            });

            expect(hasDataAttributes).toBe(true);

            // Verify the image loaded correctly
            const naturalWidth = await magnifierImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        });
    });

    test.describe('Preview Panel', () => {
        test('should display correctly in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Magnifier Preview Test');
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

            // Add magnifier iDevice
            await addMagnifierIdeviceFromPanel(page);

            // Save the iDevice with default image
            const block = page.locator('#node-content article .idevice_node.magnifier').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.magnifier');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Save project
            await workarea.save();
            await page.waitForTimeout(2000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Wait for iframe to load
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Verify magnifier container exists in preview
            const previewMagnifierContainer = iframe.locator('.MNF-MainContainer, .ImageMagnifierIdevice');
            await expect(previewMagnifierContainer.first()).toBeVisible({ timeout: 10000 });

            // Verify image is visible in preview
            const previewImg = iframe.locator('.ImageMagnifierIdevice img, .MNF-MainContainer img');
            await expect(previewImg.first()).toBeVisible({ timeout: 10000 });

            // Wait for image to load
            await page.waitForTimeout(1000);

            // Verify image loaded correctly (not broken)
            const naturalWidth = await previewImg.first().evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        });
    });
});
