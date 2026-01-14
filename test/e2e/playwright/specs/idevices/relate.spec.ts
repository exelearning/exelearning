import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page, FrameLocator } from '@playwright/test';

/**
 * E2E Tests for Relate iDevice
 *
 * Tests the Relate (matching pairs) iDevice functionality including:
 * - Basic operations (add pairs, upload images)
 * - Multiple pairs (2-3 pairs)
 * - Preview rendering (canvas dimensions fix)
 * - Creating connections/arrows between pairs in preview
 */

const TEST_FIXTURES = {
    image1: 'test/fixtures/sample-2.jpg',
    image2: 'test/fixtures/sample-3.jpg',
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

    await page.waitForTimeout(1000);

    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {});
}

/**
 * Helper to add a Relate iDevice by expanding the category and clicking the iDevice
 */
async function addRelateIdeviceFromPanel(page: Page): Promise<void> {
    await selectPageNode(page);

    // Expand "Interactive activities" category
    const interactiveCategory = page
        .locator('.idevice_category')
        .filter({
            has: page.locator('h3.idevice_category_name').filter({ hasText: /Interactive|Interactiv/i }),
        })
        .first();

    if ((await interactiveCategory.count()) > 0) {
        const isCollapsed = await interactiveCategory.evaluate(el => el.classList.contains('off'));
        if (isCollapsed) {
            const label = interactiveCategory.locator('.label');
            await label.click();
            await page.waitForTimeout(800);
        }
    }

    await page.waitForTimeout(500);

    // Find and click the Relate iDevice
    const relateIdevice = page.locator('.idevice_item[id="relate"], [data-testid="idevice-relate"]').first();
    await relateIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await relateIdevice.click();

    // Wait for iDevice to appear in content area
    await page.locator('#node-content article .idevice_node.relate').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to upload an image via the file picker input
 */
async function uploadImageViaFilePicker(page: Page, inputSelector: string, fixturePath: string): Promise<void> {
    const input = page.locator(inputSelector);
    await input.waitFor({ state: 'visible', timeout: 5000 });

    const pickButton = page.locator(`${inputSelector} + .exe-pick-any-file, ${inputSelector} + .exe-pick-image`);

    if ((await pickButton.count()) > 0) {
        await pickButton.click();
    } else {
        await input.click();
    }

    // Wait for Media Library modal
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload file
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // Wait for item and select it
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 15000 });
    await mediaItem.click();
    await page.waitForTimeout(500);

    // Insert
    const insertBtn = page.locator(
        '#modalFileManager .media-library-insert-btn, #modalFileManager button:has-text("Insert"), #modalFileManager button:has-text("Insertar")',
    );
    await insertBtn.first().click();

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
 * Helper to fill pair data (front and back) for Relate iDevice
 */
async function fillPairData(
    page: Page,
    frontText: string,
    frontImagePath: string | null,
    backText: string,
    backImagePath: string | null,
): Promise<void> {
    // Fill front side text
    const frontTextInput = page.locator('#rclEText');
    await frontTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await frontTextInput.clear();
    await frontTextInput.fill(frontText);

    // Upload front image if provided
    if (frontImagePath) {
        await uploadImageViaFilePicker(page, '#rclEURLImage', frontImagePath);
    }

    // Fill back side text
    const backTextInput = page.locator('#rclETextBack');
    await backTextInput.waitFor({ state: 'visible', timeout: 5000 });
    await backTextInput.clear();
    await backTextInput.fill(backText);

    // Upload back image if provided
    if (backImagePath) {
        await uploadImageViaFilePicker(page, '#rclEURLImageBack', backImagePath);
    }
}

/**
 * Helper to add a new pair card
 */
async function addNewPair(page: Page): Promise<void> {
    const addBtn = page.locator('#rclEAddC');
    await addBtn.click();
    await page.waitForTimeout(500);
}

/**
 * Helper to save the Relate iDevice
 */
async function saveRelateIdevice(page: Page): Promise<void> {
    const block = page.locator('#node-content article .idevice_node.relate').first();
    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.relate');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        { timeout: 15000 },
    );
}

/**
 * Helper to verify canvas is properly initialized with correct dimensions
 */
async function verifyCanvasInitialized(iframe: FrameLocator): Promise<void> {
    // Wait for the game container to be visible
    const gameContainer = iframe.locator('[id^="rlcContainerGame-"]').first();
    await gameContainer.waitFor({ state: 'visible', timeout: 15000 });

    // Check canvas has proper dimensions
    const canvas = iframe.locator('.RLCP-Canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify canvas has non-zero dimensions
    const canvasDimensions = await canvas.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    });

    expect(canvasDimensions.width).toBeGreaterThan(0);
    expect(canvasDimensions.height).toBeGreaterThan(0);
}

/**
 * Helper to create a connection/arrow between a word and a definition in preview
 */
async function createConnection(iframe: FrameLocator, wordIndex: number, definitionIndex: number): Promise<void> {
    const word = iframe.locator('.RLCP-Word').nth(wordIndex);
    const definition = iframe.locator('.RLCP-Definition').nth(definitionIndex);

    await word.waitFor({ state: 'visible', timeout: 10000 });
    await definition.waitFor({ state: 'visible', timeout: 10000 });

    // Get bounding boxes
    const wordBox = await word.boundingBox();
    const defBox = await definition.boundingBox();

    if (!wordBox || !defBox) {
        throw new Error('Could not get bounding boxes for word and definition');
    }

    // Simulate drag from word to definition
    const startX = wordBox.x + wordBox.width - 5;
    const startY = wordBox.y + wordBox.height / 2;
    const endX = defBox.x + 5;
    const endY = defBox.y + defBox.height / 2;

    // Get the page from frame
    const page = iframe.owner().page();

    // Perform the drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
}

test.describe('Relate iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add relate iDevice to page', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Relate Basic Test');
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

            // Add a relate iDevice
            await addRelateIdeviceFromPanel(page);

            // Verify iDevice was added and is in edition mode
            const idevice = page.locator('#node-content article .idevice_node.relate').first();
            await expect(idevice).toBeVisible({ timeout: 10000 });

            // Verify edition form elements are visible
            await expect(page.locator('#rclEText')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclEURLImage')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclETextBack')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('#rclEURLImageBack')).toBeVisible({ timeout: 5000 });
        });

        test('should add multiple pairs and save', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Multiple Pairs Test');
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

            await addRelateIdeviceFromPanel(page);

            // Fill first pair
            await fillPairData(page, 'Cat', TEST_FIXTURES.image1, 'Gato', TEST_FIXTURES.image2);

            // Add second pair
            await addNewPair(page);
            await fillPairData(page, 'Dog', TEST_FIXTURES.image2, 'Perro', TEST_FIXTURES.image1);

            // Add third pair
            await addNewPair(page);
            await fillPairData(page, 'Bird', null, 'Pájaro', null);

            // Verify we have 3 pairs
            const cardCounter = page.locator('#rclENumCards');
            await expect(cardCounter).toHaveText('3', { timeout: 5000 });

            // Save the iDevice
            await saveRelateIdevice(page);

            // Verify saved
            const viewModeIdevice = page.locator('#node-content article .idevice_node.relate .relaciona-IDevice');
            await expect(viewModeIdevice).toBeVisible({ timeout: 10000 });

            await workarea.save();
        });
    });

    test.describe('Preview Panel', () => {
        test('should render canvas with correct dimensions on preview open', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Canvas Test');
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

            await addRelateIdeviceFromPanel(page);

            // Add pairs with images
            await fillPairData(page, 'Apple', TEST_FIXTURES.image1, 'Manzana', TEST_FIXTURES.image2);
            await addNewPair(page);
            await fillPairData(page, 'Orange', TEST_FIXTURES.image2, 'Naranja', TEST_FIXTURES.image1);

            await saveRelateIdevice(page);
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Access preview iframe
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for game to initialize
            await page.waitForTimeout(2000);

            // CRITICAL TEST: Verify canvas has correct dimensions
            // This catches the bug where canvas was 0x0 on first load
            await verifyCanvasInitialized(iframe);
        });

        test('should display words and definitions for matching', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Display Test');
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

            await addRelateIdeviceFromPanel(page);

            // Add pairs with text
            await fillPairData(page, 'Hello', null, 'Hola', null);
            await addNewPair(page);
            await fillPairData(page, 'World', null, 'Mundo', null);

            await saveRelateIdevice(page);
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(2000);

            // Verify words container is visible
            const wordsContainer = iframe.locator('[id^="rlcContainerWords-"]').first();
            await expect(wordsContainer).toBeVisible({ timeout: 10000 });

            // Verify definitions container is visible
            const definitionsContainer = iframe.locator('[id^="rlcContainerDefinitions-"]').first();
            await expect(definitionsContainer).toBeVisible({ timeout: 10000 });

            // Verify we have 2 words and 2 definitions
            const words = iframe.locator('.RLCP-Word');
            const definitions = iframe.locator('.RLCP-Definition');

            await expect(words).toHaveCount(2, { timeout: 10000 });
            await expect(definitions).toHaveCount(2, { timeout: 10000 });
        });

        test('should have images displayed correctly in preview', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Images Test');
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

            await addRelateIdeviceFromPanel(page);

            // Add pairs with images
            await fillPairData(page, '', TEST_FIXTURES.image1, '', TEST_FIXTURES.image2);
            await addNewPair(page);
            await fillPairData(page, '', TEST_FIXTURES.image2, '', TEST_FIXTURES.image1);

            await saveRelateIdevice(page);
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(3000);

            // Verify images are loaded (have valid src)
            const images = iframe.locator('.RLCP-Image');
            const imageCount = await images.count();
            expect(imageCount).toBeGreaterThanOrEqual(2);

            // Check first image has a valid src (blob URL or relative path)
            const firstImageSrc = await images.first().getAttribute('src');
            expect(firstImageSrc).toBeTruthy();
            // With SW-based preview, assets are served via relative paths (content/resources/...)
            expect(firstImageSrc).toMatch(/^(blob:|content\/resources\/)/);
        });
    });

    test.describe('Game Interaction', () => {
        test('should allow creating connections between pairs', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Connection Test');
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

            await addRelateIdeviceFromPanel(page);

            // Add pairs
            await fillPairData(page, 'One', null, 'Uno', null);
            await addNewPair(page);
            await fillPairData(page, 'Two', null, 'Dos', null);

            await saveRelateIdevice(page);
            await workarea.save();
            await page.waitForTimeout(1000);

            // Open preview
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

            await page.waitForTimeout(2000);

            // Verify game is ready (canvas has dimensions)
            await verifyCanvasInitialized(iframe);

            // Try to create a connection
            const words = iframe.locator('.RLCP-Word');
            const definitions = iframe.locator('.RLCP-Definition');

            // Click on first word to select it
            await words.first().click();
            await page.waitForTimeout(300);

            // Verify word got selected class
            const firstWord = words.first();
            const isSelected = await firstWord.evaluate(el => el.classList.contains('RLCP-Selected'));
            expect(isSelected).toBe(true);
        });
    });

    test.describe('Persistence', () => {
        test('should persist after reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Relate Persistence Test');
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

            await addRelateIdeviceFromPanel(page);

            const uniqueText = `Persistence Test ${Date.now()}`;
            await fillPairData(page, uniqueText, null, 'Match', null);

            await saveRelateIdevice(page);
            await workarea.save();
            await page.waitForTimeout(1000);

            // Reload
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

            await selectPageNode(page);

            // Verify iDevice is still there
            const idevice = page.locator('#node-content article .idevice_node.relate').first();
            await expect(idevice).toBeVisible({ timeout: 15000 });
        });
    });
});
