import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for BeforeAfter iDevice
 *
 * Tests the BeforeAfter iDevice functionality including:
 * - Basic operations (add, upload image pairs)
 * - Multiple image pairs (2-3 pairs)
 * - Preview rendering (especially first image - tests cached image bug fix)
 * - Navigation between image pairs
 */

const TEST_FIXTURES = {
    beforeImage: 'test/fixtures/sample-2.jpg',
    afterImage: 'test/fixtures/sample-3.jpg',
};

/**
 * Helper to select a page in the navigation tree (required before adding iDevices)
 */
async function selectPageNode(page: Page): Promise<void> {
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
}

/**
 * Helper to add a BeforeAfter iDevice by expanding the category and clicking the iDevice
 */
async function addBeforeAfterIdeviceFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree
    await selectPageNode(page);

    // Expand "Interactive activities" category in iDevices panel
    const interactiveCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Interactive|Interactiv/i }),
        })
        .first();

    if ((await interactiveCategory.count()) > 0) {
        // Check if category is collapsed (has "off" class)
        const isCollapsed = await interactiveCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            // Click on the .label to expand
            const label = interactiveCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    // Wait for the category content to be visible
    await page.waitForTimeout(500);

    // Find the BeforeAfter iDevice
    const beforeAfterIdevice = page
        .locator('.idevice_item[id="beforeafter"], [data-testid="idevice-beforeafter"]')
        .first();

    // Wait for it to be visible and then click
    await beforeAfterIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await beforeAfterIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.beforeafter').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to upload an image via the file picker input
 * Opens the media library modal, uploads the file, selects it, and inserts it
 */
async function uploadImageViaFilePicker(page: Page, inputSelector: string, fixturePath: string): Promise<void> {
    // Click the file picker button next to the input
    const input = page.locator(inputSelector);
    await input.waitFor({ state: 'visible', timeout: 5000 });

    // Find the associated pick button (next sibling with exe-pick class)
    const pickButton = page.locator(`${inputSelector} + .exe-pick-any-file, ${inputSelector} + .exe-pick-image`);

    if ((await pickButton.count()) > 0) {
        await pickButton.click();
    } else {
        // Alternative: click directly on the input if it has a click handler
        await input.click();
    }

    // Wait for Media Library modal to appear
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Find the file input in the modal
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // Wait for upload to complete and item to appear
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 15000 });

    // Click on the uploaded item to select it
    await mediaItem.click();
    await page.waitForTimeout(500);

    // Click insert button
    const insertBtn = page.locator(
        '#modalFileManager .media-library-insert-btn, #modalFileManager button:has-text("Insert"), #modalFileManager button:has-text("Insertar")',
    );
    await insertBtn.first().click();

    // Wait for modal to close
    await page.waitForFunction(
        () => {
            const modal = document.querySelector('#modalFileManager');
            return !modal || !modal.classList.contains('show');
        },
        { timeout: 10000 },
    );

    await page.waitForTimeout(500);
}

/**
 * Helper to fill the description field and upload Before/After images for a card
 */
async function fillCardData(
    page: Page,
    description: string,
    beforeImagePath: string,
    afterImagePath: string,
): Promise<void> {
    // Fill description (required field)
    const descInput = page.locator('#bfafEDescription');
    await descInput.waitFor({ state: 'visible', timeout: 5000 });
    await descInput.clear();
    await descInput.fill(description);

    // Upload Before image
    await uploadImageViaFilePicker(page, '#bfafEURLImageBack', beforeImagePath);

    // Upload After image
    await uploadImageViaFilePicker(page, '#bfafEURLImage', afterImagePath);
}

/**
 * Helper to add a new card by clicking the Add button
 */
async function addNewCard(page: Page): Promise<void> {
    const addBtn = page.locator('#bfafEAddC');
    await addBtn.click();
    await page.waitForTimeout(500);
}

/**
 * Helper to save the BeforeAfter iDevice
 */
async function saveBeforeAfterIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.beforeafter').first();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click();

    // Wait for edition mode to end
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.beforeafter');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        { timeout: 15000 },
    );
}

/**
 * Helper to verify that the first image rendered correctly in preview
 * This is the critical test for the cached image bug
 */
async function verifyFirstImageRendered(iframe: FrameLocator): Promise<void> {
    // Wait for the beforeafter container to be visible
    const container = iframe.locator('.BFAFP-ContainerBA').first();
    await container.waitFor({ state: 'visible', timeout: 15000 });

    // Critical check: container should have opacity > 0 (not stuck at 0 due to cached image bug)
    const opacity = await container.evaluate(el => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.opacity);
    });

    // If the bug is present, opacity will be 0
    expect(opacity).toBeGreaterThan(0);

    // Verify images have src set (blob: URLs from asset resolution)
    const beforeImg = iframe.locator('.BFAFP-ImageBefore').first();
    const afterImg = iframe.locator('[id^="bfafpImageAfter-"]').first();

    const beforeSrc = await beforeImg.getAttribute('src');
    const afterSrc = await afterImg.getAttribute('src');

    expect(beforeSrc).toBeTruthy();
    expect(afterSrc).toBeTruthy();

    // Should be blob URLs (asset resolution)
    expect(beforeSrc).toMatch(/^blob:/);
    expect(afterSrc).toMatch(/^blob:/);
}

test.describe('BeforeAfter iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add beforeafter iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'BeforeAfter Basic Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            // Verify iDevice was added and is in edition mode
            const idevice = page.locator('#node-content article .idevice_node.beforeafter').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });

            // Verify edition form elements are visible
            await expect(page.locator('#bfafEDescription')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#bfafEURLImageBack')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#bfafEURLImage')).toBeVisible({ timeout: 5000 });
        });

        test('should add multiple image pairs and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Multiple Pairs Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            // Fill first card
            await fillCardData(
                page,
                'First pair: Building renovation',
                TEST_FIXTURES.beforeImage,
                TEST_FIXTURES.afterImage,
            );

            // Add second card
            await addNewCard(page);
            await fillCardData(
                page,
                'Second pair: Garden transformation',
                TEST_FIXTURES.afterImage,
                TEST_FIXTURES.beforeImage,
            );

            // Verify we have 2 cards (check the card counter)
            const cardCounter = page.locator('#bfafENumCards');
            await expect(cardCounter).toHaveText('2', { timeout: 5000 });

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            // Verify the iDevice is saved and displayed in view mode
            const viewModeIdevice = page.locator(
                '#node-content article .idevice_node.beforeafter .beforeafter-IDevice',
            );
            await expect(viewModeIdevice).toBeVisible({ timeout: 10000 });

            // Save project
            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should render first image correctly on preview open', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Preview First Image Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            // Fill first card with images
            await fillCardData(page, 'Test: First image render', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Add second card (to test navigation later)
            await addNewCard(page);
            await fillCardData(page, 'Test: Second image', TEST_FIXTURES.afterImage, TEST_FIXTURES.beforeImage);

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');

            // Wait for page to load in iframe
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for beforeafter to initialize
            await page.waitForTimeout(2000);

            // CRITICAL TEST: Verify first image rendered correctly
            // This catches the cached image race condition bug
            await verifyFirstImageRendered(iframe);

            // Verify the number info shows "1/2"
            const numberInfo = iframe.locator('.BFAFP-NumberInfo').first();
            await expect(numberInfo).toContainText(/1.*2/, { timeout: 5000 });
        });

        test('should navigate between images with Next/Previous buttons', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Navigation Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            // Fill first card
            await fillCardData(page, 'Navigation Test Pair 1', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Add second card
            await addNewCard(page);
            await fillCardData(page, 'Navigation Test Pair 2', TEST_FIXTURES.afterImage, TEST_FIXTURES.beforeImage);

            // Add third card
            await addNewCard(page);
            await fillCardData(page, 'Navigation Test Pair 3', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for beforeafter to initialize
            await page.waitForTimeout(2000);

            // Verify we start at image 1/3
            const numberInfo = iframe.locator('.BFAFP-NumberInfo').first();
            await expect(numberInfo).toContainText(/1.*3/, { timeout: 5000 });

            // Click Next button
            const nextBtn = iframe.locator('[id^="bfafNext-"]').first();
            await nextBtn.click();
            await page.waitForTimeout(1000);

            // Verify we're now at image 2/3
            await expect(numberInfo).toContainText(/2.*3/, { timeout: 5000 });

            // Verify image 2 rendered correctly (opacity > 0)
            const container = iframe.locator('.BFAFP-ContainerBA').first();
            const opacity = await container.evaluate(el => {
                const style = window.getComputedStyle(el);
                return parseFloat(style.opacity);
            });
            expect(opacity).toBeGreaterThan(0);

            // Click Next again to go to image 3
            await nextBtn.click();
            await page.waitForTimeout(1000);
            await expect(numberInfo).toContainText(/3.*3/, { timeout: 5000 });

            // Click Previous to go back to image 2
            const prevBtn = iframe.locator('[id^="bfafPrevious-"]').first();
            await prevBtn.click();
            await page.waitForTimeout(1000);
            await expect(numberInfo).toContainText(/2.*3/, { timeout: 5000 });
        });

        test('should display comparison slider', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Slider Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            // Fill first card
            await fillCardData(page, 'Slider Test', TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for beforeafter to initialize
            await page.waitForTimeout(2000);

            // Verify slider is present
            const slider = iframe.locator('.BFAFP-Slider').first();
            await expect(slider).toBeVisible({ timeout: 10000 });

            // Verify overlay (the draggable comparison area) is present
            const overlay = iframe.locator('.BFAFP-Overlay').first();
            await expect(overlay).toBeVisible({ timeout: 5000 });

            // Verify the overlay has some width (slider functionality is initialized)
            const overlayWidth = await overlay.evaluate(el => el.offsetWidth);
            expect(overlayWidth).toBeGreaterThan(0);
        });
    });

    test.describe('Persistence', () => {
        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'BeforeAfter Persistence Test');
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

            // Add a beforeafter iDevice
            await addBeforeAfterIdeviceFromPanel(page);

            const uniqueDescription = `Persistence Test ${Date.now()}`;
            await fillCardData(page, uniqueDescription, TEST_FIXTURES.beforeImage, TEST_FIXTURES.afterImage);

            // Save the iDevice
            await saveBeforeAfterIdevice(page);

            // Save project
            await workarea.save();
            await page.waitForTimeout(1000);

            // Reload the page
            await page.reload();
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Navigate to the page
            await selectPageNode(page);

            // Verify beforeafter iDevice is still there
            const idevice = page.locator('#node-content article .idevice_node.beforeafter').first();
            await expect(idevice).toBeVisible({ timeout: 15000 });

            // Verify it contains our unique description
            await expect(idevice).toContainText(uniqueDescription, { timeout: 10000 });
        });
    });
});
