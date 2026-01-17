import { test, expect } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync, waitForTextInContent } from '../../helpers/sync-helpers';
import { waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Collaborative Text iDevice Tests
 *
 * These tests verify that text iDevice content (including images) syncs
 * in real-time between multiple users connected to the same project.
 */

/**
 * Helper to wait for Yjs bridge initialization
 */
async function waitForYjsBridge(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const app = (window as any).eXeLearning?.app;
            return app?.project?._yjsBridge !== undefined;
        },
        { timeout: 30000 },
    );
}

/**
 * Helper to add a text iDevice from the panel
 */
async function addTextIdeviceFromPanel(page: Page): Promise<void> {
    // Select first PAGE node (not the root project node)
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

    // Wait for content area to be ready
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

    // Add text iDevice via quick button or panel
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        const infoCategory = page
            .locator('#menu_idevices .accordion-item')
            .filter({ hasText: /Information|Información/i })
            .locator('.accordion-button');

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.first().evaluate(el => el.classList.contains('collapsed'));
            if (isCollapsed) {
                await infoCategory.first().click();
                await page.waitForTimeout(500);
            }
        }

        const textIdevice = page.locator('.idevice_item[id="text"], [data-testid="idevice-text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    // Wait for iDevice to appear
    await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to type content in TinyMCE editor
 */
async function typeInTinyMCE(page: Page, content: string): Promise<void> {
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    const tinyMceFrame = textIdeviceNode.locator('iframe.tox-edit-area__iframe').first();
    await tinyMceFrame.waitFor({ timeout: 15000 });

    const frameEl = await tinyMceFrame.elementHandle();
    const frame = await frameEl?.contentFrame();
    if (frame) {
        await frame.focus('body');
        await frame.type('body', content, { delay: 5 });
    }

    // Wait for TinyMCE to process the input
    await page.waitForTimeout(500);
}

/**
 * Helper to insert image via TinyMCE Media Library
 */
async function insertImageViaTinyMCE(page: Page, fixturePath: string): Promise<void> {
    // Click image button in TinyMCE toolbar
    const imageBtn = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageBtn).toBeVisible({ timeout: 10000 });
    await imageBtn.click();

    // Wait for TinyMCE's image dialog to open
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    // Click the Browse button to open Media Library
    const browseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseBtn).toBeVisible({ timeout: 5000 });
    await browseBtn.click();

    // Wait for Media Library modal
    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // Upload image from fixture
    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // Wait for the uploaded image to appear in the grid
    const imageItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(imageItem).toBeVisible({ timeout: 10000 });

    // Click to select the uploaded image
    await imageItem.click();

    // Wait for sidebar content to show
    const sidebarContent = page.locator('#modalFileManager .media-library-sidebar-content');
    await expect(sidebarContent).toBeVisible({ timeout: 5000 });

    // Click insert button in Media Library
    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(insertBtn).toBeVisible({ timeout: 5000 });
    await insertBtn.click();

    // Wait for modal to close and URL to be set
    await page.waitForTimeout(1000);

    // Close TinyMCE dialog by clicking Save button
    const tinyMceSaveBtn = page.locator('.tox-dialog .tox-button:has-text("Save")');
    if ((await tinyMceSaveBtn.count()) > 0) {
        await tinyMceSaveBtn.click();
    }

    // Handle accessibility warning dialog that appears when no alt text is provided
    // The dialog asks: "Are you sure you want to continue without including an Image Description?"
    const accessibilityConfirmBtn = page.locator('.tox-dialog button:has-text("Yes")');
    try {
        await accessibilityConfirmBtn.waitFor({ state: 'visible', timeout: 3000 });
        await accessibilityConfirmBtn.click();
    } catch {
        // Dialog may not appear if alt text was provided
    }

    await page.waitForTimeout(1000);
}

/**
 * Helper to save the text iDevice (exit edit mode)
 */
async function saveTextIdevice(page: Page): Promise<void> {
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    // Wait for edition mode to end
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        { timeout: 15000 },
    );
}

test.describe('Collaborative Text iDevice', () => {
    // Collaboration tests need more time for WebSocket sync between clients
    test.setTimeout(180000); // 3 minutes per test

    test.describe('Text and Image Sync', () => {
        test('should sync text iDevice with image content between users', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage; // Guest user in separate browser context

            // Client A (authenticated user) creates a project
            const projectUuid = await createProject(pageA, 'Collaborative Text iDevice Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreenHidden(pageA);

            // Client A makes project public and gets share URL BEFORE adding content
            // (so Client B can join and observe real-time sync)
            const shareUrl = await getShareUrl(pageA);

            // Client B (guest user) joins via share URL
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Both clients wait for sync
            await waitForYjsSync(pageA);
            await waitForYjsSync(pageB);

            // Client A adds a text iDevice
            await addTextIdeviceFromPanel(pageA);

            // Wait for TinyMCE to be ready
            await pageA.waitForSelector('.tox-menubar', { timeout: 15000 });

            // Client A types unique text content
            const uniqueText = `Collaborative text content ${Date.now()}`;
            await typeInTinyMCE(pageA, uniqueText);

            // Client A inserts an image via Media Library
            await insertImageViaTinyMCE(pageA, 'test/fixtures/sample-2.jpg');

            // Client A saves the iDevice
            await saveTextIdevice(pageA);

            // Wait for Yjs sync to propagate to Client B
            await pageA.waitForTimeout(3000);

            // Verify on Client A that content is visible
            await expect(pageA.locator('#node-content')).toContainText(uniqueText, { timeout: 10000 });
            const imgOnA = pageA.locator('#node-content article .idevice_node.text img');
            await expect(imgOnA).toBeVisible({ timeout: 10000 });

            // Client B navigates to the same page (if needed)
            const pageNode = pageB
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true });
                await pageB.waitForTimeout(1500);
            }

            // Verify on Client B: Text content is synced
            await waitForTextInContent(pageB, uniqueText, 20000);

            // Verify on Client B: Text iDevice is visible
            const textIdeviceOnB = pageB.locator('#node-content article .idevice_node.text');
            await expect(textIdeviceOnB).toBeVisible({ timeout: 15000 });

            // Verify on Client B: Image is visible and loaded (not broken)
            const imgOnB = pageB.locator('#node-content article .idevice_node.text img');
            await expect(imgOnB).toBeVisible({ timeout: 15000 });

            // Verify image actually loaded (naturalWidth > 0 means image rendered successfully)
            const naturalWidth = await imgOnB.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        });

        test('should sync text-only iDevice content between users', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            // This test verifies basic text sync without images
            // The first test already covers text + image sync
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Text-Only Sync Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await waitForYjsBridge(pageA);
            await waitForLoadingScreenHidden(pageA);

            // Client A adds a text iDevice and types content
            await addTextIdeviceFromPanel(pageA);
            await pageA.waitForSelector('.tox-menubar', { timeout: 15000 });

            const uniqueText = `Text-only collaborative content ${Date.now()}`;
            await typeInTinyMCE(pageA, uniqueText);
            await saveTextIdevice(pageA);

            // Wait for content to be saved to Yjs
            await pageA.waitForTimeout(2000);

            // Verify content is visible on Client A
            await expect(pageA.locator('#node-content')).toContainText(uniqueText, { timeout: 10000 });

            // Client A makes project public and shares
            const shareUrl = await getShareUrl(pageA);

            // Client B joins
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);

            // Wait for Yjs document to sync
            await pageB.waitForTimeout(3000);

            // Client B navigates to the page with the iDevice
            const pageNode = pageB
                .locator('.nav-element-text')
                .filter({ hasText: /New page|Nueva página/i })
                .first();
            if ((await pageNode.count()) > 0) {
                await pageNode.click({ force: true });
                await pageB.waitForTimeout(1500);
            }

            // Verify Client B sees the text content
            await waitForTextInContent(pageB, uniqueText, 25000);

            // Verify text iDevice is visible on Client B
            const textIdeviceOnB = pageB.locator('#node-content article .idevice_node.text');
            await expect(textIdeviceOnB).toBeVisible({ timeout: 15000 });
        });
    });
});
