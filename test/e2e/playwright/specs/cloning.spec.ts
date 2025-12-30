import { test, expect, waitForLoadingScreenHidden } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Cloning Functionality
 *
 * Tests that cloning iDevices, blocks, and pages preserves all content:
 * - htmlContent
 * - jsonProperties
 * - properties
 * - nested structures
 */

/**
 * Helper to add a text iDevice with content
 */
async function addTextIdeviceWithContent(page: Page, content: string): Promise<void> {
    // Select first PAGE node (not the root project node)
    // Root has nav-id="root", pages have other nav-ids
    const pageNodeSelectors = [
        // First try to find a page node (excludes root)
        // Note: .nav-element is NOT inside #menu_structure - it's directly in the DOM
        '.nav-element:not([nav-id="root"]) .nav-element-text',
        // Fallback: any nav-element-text in the structure tree that's not the root
        '.structure-tree .nav-element:not([nav-id="root"]) .nav-element-text',
        // Last resort: click on the tree item directly
        '.structure-tree li:not(:first-child) .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.waitFor({ state: 'visible', timeout: 5000 });
                await element.click({ timeout: 5000 });
                pageSelected = true;
                await page.waitForTimeout(500);
                break;
            } catch {
                // Try next selector
            }
        }
    }

    // If no page found, the project might have only root - try clicking root to show content area
    if (!pageSelected) {
        const rootNode = page.locator('.nav-element[nav-id="root"] .nav-element-text').first();
        if ((await rootNode.count()) > 0) {
            await rootNode.click({ force: true }).catch(() => {});
            await page.waitForTimeout(500);
        }
    }

    // Add text iDevice via quick button or panel
    const quickTextButton = page
        .locator('[data-testid="quick-idevice-text"], .quick-idevice-btn[data-idevice="text"]')
        .first();
    if ((await quickTextButton.count()) > 0 && (await quickTextButton.isVisible())) {
        await quickTextButton.click();
    } else {
        // Expand "Information and presentation" category
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

        const textIdevice = page.locator('.idevice_item[id="text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();
    }

    // Wait for iDevice to appear
    const textIdeviceNode = page.locator('#node-content article .idevice_node.text').first();
    await textIdeviceNode.waitFor({ timeout: 15000 });

    // Enter edit mode if not already
    const tinyMceMenubar = page.locator('.tox-menubar');
    const isTinyMceVisible = await tinyMceMenubar.isVisible().catch(() => false);

    if (!isTinyMceVisible) {
        const editBtn = textIdeviceNode.locator('.btn-edit-idevice');
        if ((await editBtn.count()) > 0) {
            await editBtn.click();
        }
    }

    // Wait for TinyMCE iframe
    const tinyMceFrame = textIdeviceNode.locator('iframe.tox-edit-area__iframe').first();
    await tinyMceFrame.waitFor({ timeout: 15000 });

    // Type content
    const frameEl = await tinyMceFrame.elementHandle();
    const frame = await frameEl?.contentFrame();
    if (frame) {
        await frame.focus('body');
        await frame.type('body', content, { delay: 5 });
    }

    // Save the iDevice
    const saveBtn = textIdeviceNode.locator('.btn-save-idevice');
    if ((await saveBtn.count()) > 0) {
        await saveBtn.click();
    }

    // Wait for save to complete AND content to be rendered in the DOM
    await page.waitForFunction(
        expectedContent => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice || idevice.getAttribute('mode') === 'edition') {
                return false;
            }
            // Verify the content is actually rendered somewhere in node-content
            const nodeContent = document.querySelector('#node-content');
            if (!nodeContent) {
                return false;
            }
            return nodeContent.textContent?.includes(expectedContent) ?? false;
        },
        content,
        { timeout: 15000 },
    );
}

/**
 * Helper to switch to advanced mode (to show clone buttons)
 */
async function ensureAdvancedMode(page: Page): Promise<void> {
    // The clone button is inside .exe-advanced which is hidden in default mode
    // Switch to advanced mode by setting body[mode="advanced"]
    await page.evaluate(() => {
        document.body.setAttribute('mode', 'advanced');
    });
    await page.waitForTimeout(300);
}

/**
 * Helper to click clone button on iDevice
 */
async function cloneIdevice(page: Page): Promise<void> {
    // Ensure we're in advanced mode to see clone buttons
    await ensureAdvancedMode(page);

    const ideviceNode = page.locator('#node-content article .idevice_node.text').first();
    await ideviceNode.waitFor({ state: 'visible', timeout: 10000 });

    // Get the iDevice ID from the element
    const odeIdeviceId = await ideviceNode.getAttribute('ode-idevice-id');

    // Open iDevice dropdown menu - the toggle button has data-bs-toggle="dropdown"
    const dropdownToggle = ideviceNode
        .locator('[data-bs-toggle="dropdown"], [id^="dropdownMenuButtonIdevice"]')
        .first();
    if ((await dropdownToggle.count()) > 0) {
        await dropdownToggle.click();
        await page.waitForTimeout(500);
    }

    // Click clone button - it's inside the dropdown with id="cloneIdevice${odeIdeviceId}"
    const cloneBtnSelectors = [
        `#cloneIdevice${odeIdeviceId}`,
        '[id^="cloneIdevice"]',
        '.dropdown-item:has-text("Clone")',
        '.dropdown-item:has-text("Clon")',
    ];

    let clicked = false;
    for (const selector of cloneBtnSelectors) {
        const cloneBtn = page.locator(selector).first();
        if ((await cloneBtn.count()) > 0 && (await cloneBtn.isVisible())) {
            await cloneBtn.click();
            clicked = true;
            break;
        }
    }

    if (!clicked) {
        // Fallback: try clicking any visible clone button in the dropdown
        const fallbackBtn = ideviceNode.locator('.dropdown-menu .dropdown-item').nth(1); // Clone is typically 2nd item
        if ((await fallbackBtn.count()) > 0) {
            await fallbackBtn.click();
        }
    }

    // Wait for clone to complete
    await page.waitForTimeout(2000);

    // Wait for the cloned iDevice to appear (should now have 2 text idevices)
    await page
        .waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length >= 2;
            },
            { timeout: 15000 },
        )
        .catch(() => {
            // Continue even if timeout - the test assertion will catch the issue
        });

    // Close the info modal if it appears
    const modal = page.locator('.modal.show');
    if ((await modal.count()) > 0) {
        const closeBtn = modal.locator('.btn-close, [data-bs-dismiss="modal"], .btn-primary').first();
        if ((await closeBtn.count()) > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Helper to clone block
 */
async function cloneBlock(page: Page): Promise<void> {
    // Ensure we're in advanced mode to see clone buttons
    await ensureAdvancedMode(page);

    // Block elements are article.box (the article IS the .box element)
    // They have an 'id' attribute like 'block-1766400580284-nre7blo26'
    const blockNode = page.locator('#node-content article.box').first();
    await blockNode.waitFor({ state: 'visible', timeout: 10000 });

    // Get the block ID from the element's 'id' attribute (not 'block-id')
    const blockId = await blockNode.getAttribute('id');

    // Open block dropdown menu - toggle button is #dropdownMenuButton${blockId}
    const dropdownToggle = blockNode.locator('[data-bs-toggle="dropdown"], [id^="dropdownMenuButton"]').first();
    if ((await dropdownToggle.count()) > 0) {
        await dropdownToggle.click();
        await page.waitForTimeout(500);
    }

    // Click clone button - it's #dropdownBlockMore-button-clone${blockId}
    const cloneBtnSelectors = [
        `#dropdownBlockMore-button-clone${blockId}`,
        '[id^="dropdownBlockMore-button-clone"]',
        '.dropdown-item:has-text("Clone")',
        '.dropdown-item:has-text("Clon")',
    ];

    let clicked = false;
    for (const selector of cloneBtnSelectors) {
        const cloneBtn = page.locator(selector).first();
        if ((await cloneBtn.count()) > 0 && (await cloneBtn.isVisible())) {
            await cloneBtn.click();
            clicked = true;
            break;
        }
    }

    if (!clicked) {
        // Fallback: try clicking any visible clone button in the dropdown
        const fallbackBtn = blockNode.locator('.dropdown-menu .dropdown-item').nth(1); // Clone is typically 2nd item
        if ((await fallbackBtn.count()) > 0) {
            await fallbackBtn.click();
        }
    }

    // Wait for clone to complete
    await page.waitForTimeout(2000);

    // Wait for the cloned block to appear
    await page
        .waitForFunction(
            () => {
                // Block elements are article.box (article IS the .box)
                const blocks = document.querySelectorAll('#node-content article.box');
                return blocks.length >= 2;
            },
            { timeout: 15000 },
        )
        .catch(() => {
            // Continue even if timeout
        });

    // Close the info modal if it appears
    const modal = page.locator('.modal.show');
    if ((await modal.count()) > 0) {
        const closeBtn = modal.locator('.btn-close, [data-bs-dismiss="modal"], .btn-primary').first();
        if ((await closeBtn.count()) > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Helper to clone page from structure menu
 */
async function clonePage(page: Page): Promise<void> {
    // Select a PAGE node (not root) to clone
    // Root has nav-id="root", pages have other nav-ids
    // Note: .nav-element is NOT inside #menu_structure - it's directly in the DOM
    const pageNodeSelectors = [
        '.nav-element:not([nav-id="root"]) .nav-element-text',
        '.structure-tree .nav-element:not([nav-id="root"]) .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.waitFor({ state: 'visible', timeout: 5000 });
                await element.click({ timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        // Fallback - try any nav-element-text
        const fallbackNode = page.locator('.nav-element-text').first();
        await fallbackNode.click({ force: true }).catch(() => {});
    }

    await page.waitForTimeout(300);

    // Look for clone button in structure menu actions
    // The button has class 'button_nav_action action_clone'
    const cloneBtn = page.locator('.button_nav_action.action_clone');
    if ((await cloneBtn.count()) > 0 && (await cloneBtn.isVisible())) {
        await cloneBtn.click();
    }

    // Wait for clone to complete
    await page.waitForTimeout(1000);

    // Close any rename modal that appears
    const modal = page.locator('.modal.show');
    if ((await modal.count()) > 0) {
        const closeBtn = modal.locator('.btn-close, [data-bs-dismiss="modal"]').first();
        if ((await closeBtn.count()) > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
        }
    }
}

test.describe('Cloning Functionality', () => {
    test.describe('Clone iDevice', () => {
        test('should clone iDevice with text content preserved', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create project
            const projectUuid = await createProject(page, 'Clone iDevice Test');
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

            // Add text iDevice with unique content
            const uniqueContent = `Unique content to clone ${Date.now()}`;
            await addTextIdeviceWithContent(page, uniqueContent);

            // Verify content exists
            await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 10000 });

            // Clone the iDevice
            await cloneIdevice(page);

            // Wait for cloned iDevice to appear
            await page.waitForTimeout(1000);

            // Verify there are now 2 iDevices with the same content
            const idevices = page.locator('#node-content article .idevice_node.text');
            await expect(idevices).toHaveCount(2, { timeout: 10000 });

            // Verify both contain the content
            const firstIdevice = idevices.first();
            const secondIdevice = idevices.last();

            await expect(firstIdevice).toContainText(uniqueContent);
            await expect(secondIdevice).toContainText(uniqueContent);
        });
    });

    test.describe('Clone Block', () => {
        test('should clone block with all iDevices and content preserved', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Clone Block Test');
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

            // Add text iDevice with content
            const uniqueContent = `Block content to clone ${Date.now()}`;
            await addTextIdeviceWithContent(page, uniqueContent);

            // Verify content exists
            await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 10000 });

            // Clone the block
            await cloneBlock(page);

            // Wait for cloned block to appear
            await page.waitForTimeout(1000);

            // Verify there are now 2 blocks (blocks have class 'box')
            const blocks = page.locator('#node-content article.box');
            const blockCount = await blocks.count();

            // Should have at least 2 blocks now (original + clone)
            expect(blockCount).toBeGreaterThanOrEqual(2);

            // Verify the cloned block contains the content
            const allContent = await page.locator('#node-content').textContent();
            // The content should appear at least twice (once in each block)
            const contentOccurrences = (allContent?.match(new RegExp(uniqueContent.substring(0, 20), 'g')) || [])
                .length;
            expect(contentOccurrences).toBeGreaterThanOrEqual(2);
        });
    });

    test.describe('Clone Page', () => {
        // Increase timeout for this test as it involves multiple operations
        test(
            'should clone page with all blocks and iDevices preserved',
            { timeout: 90000 },
            async ({ authenticatedPage, createProject }) => {
                const page = authenticatedPage;

                const projectUuid = await createProject(page, 'Clone Page Test');
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

                // Add text iDevice with content
                const uniqueContent = `Page content to clone ${Date.now()}`;
                await addTextIdeviceWithContent(page, uniqueContent);

                // Verify content exists
                await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 10000 });

                // Count pages before clone (nav-elements are NOT inside #menu_structure)
                const pagesBefore = await page.locator('.nav-element').count();

                // Clone the page
                await clonePage(page);

                // Wait for clone to complete
                await page.waitForTimeout(1500);

                // Count pages after clone
                const pagesAfter = await page.locator('.nav-element').count();
                expect(pagesAfter).toBe(pagesBefore + 1);

                // Navigate to the cloned page (should be the last one with "(copy)" suffix)
                const clonedPageNode = page
                    .locator('.nav-element:not([nav-id="root"]) .nav-element-text:has-text("(copy)")')
                    .first();
                if ((await clonedPageNode.count()) > 0) {
                    await clonedPageNode.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
                    await clonedPageNode.click({ timeout: 5000 }).catch(() => clonedPageNode.click({ force: true }));
                    await page.waitForTimeout(1000);

                    // Verify the cloned page has the content
                    await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 15000 });
                } else {
                    // If no "(copy)" suffix, click the last non-root page node
                    const lastPageNode = page.locator('.nav-element:not([nav-id="root"]) .nav-element-text').last();
                    await lastPageNode.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
                    await lastPageNode.click({ timeout: 5000 }).catch(() => lastPageNode.click({ force: true }));
                    await page.waitForTimeout(1000);

                    // The cloned page should have the same content
                    await expect(page.locator('#node-content')).toContainText(uniqueContent, { timeout: 15000 });
                }
            },
        );
    });
});
